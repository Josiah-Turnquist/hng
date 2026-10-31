// One battle on the game server, with the players in it: the battle runs 60
// steps a second in real time, each player's inputs are used on the next step,
// and every player gets a snapshot 20 times a second (net/protocol.js). Bots
// fill the sides. A player who leaves is taken over by a bot. With nobody left
// for a minute (or the battle over), the room closes and stops using the
// processor, so the server can go to sleep (Railway's Serverless setting).
// Each player's rewards are worked out here, once: when the battle is decided,
// or when he leaves before (game/rewards.js); onReward keeps them.
//
//   const room = new BattleRoom({ perSide, attackers, defenders, send })
//   await room.ready
//   room.join(client, { userId, name, faction, cls, loadout, soldierId, tank })   -> soldier id or throws
//   room.input(client, message); room.leaving(client); room.leave(client)
//   room.onClose = () => ...
//   room.onReward = ({ client, userId, name, soldierId, reward }) => ...   (reward null: nothing earned)
//   await room.finish()   // the server is stopping: everyone's rewards kept, then closed
//
// client: any object; send(client, text) sends it a message.
import { makeBattle, addPlayer, ATT, DEF } from './battle.js';
import { Recorder, TICK, CHECK_EVERY } from './record.js';
import { snapshot, roster, scores, watchEvents, PROTOCOL_VERSION } from '../net/protocol.js';
import { BotBrain } from '../ai/bot.js';
import { battleReward } from '../game/rewards.js';
import { cleanChat, chatAllowed } from './social.js';
import { WEAPONS, DEFAULT_LOADOUT, LOADOUT_SLOTS, CLASS_POINTS, loadoutPoints } from '../weapons/defs.js';
import { TANK_IDS } from '../game/ribbons.js';

const SNAP_EVERY = 3; // 60 steps a second / 3 = 20 snapshots a second
const FULL_EVERY = 40; // every 40th snapshot (two seconds) has every vehicle, moved or not
const EMPTY_CLOSE = 60; // seconds with nobody in it
const OVER_CLOSE = 15; // seconds after the battle is decided
const INPUTS_PER_SECOND = 90; // more than this from one player and the rest wait
const STEPS_AT_ONCE = 4; // steps run in one go before the server answers anything else
const SLOW_WARN = 10; // seconds between notes in the log that a battle can't keep up

export class BattleRoom {
  constructor({ perSide = 12, minutes = 30, attackers = 'US', defenders = 'GE', seed = (Math.random() * 2 ** 31) | 0, send, record = false, vehicles = true, difficulty = 'easy' } = {}) {
    this.opts = { perSide, minutes, attackers, defenders, seed, vehicles, difficulty };
    this.send = send;
    this.players = new Map(); // client -> { pc, userId, name, queue, budget }
    this.tick = 0;
    this.closed = false;
    this.onClose = null;
    this.onReward = null;
    this.saving = []; // rewards on their way to the database
    this.rec = record ? new Recorder(this.opts) : null;
    this.ready = makeBattle(this.opts).then((g) => {
      this.g = g;
      this.events = watchEvents(g);
      this.emptyFor = 0;
      this.overFor = 0;
      this._start();
      return this;
    });
  }

  // How many players fight on this side.
  playersOn(team) {
    let n = 0;
    for (const [, p] of this.players) if (p.pc.soldier.team === team) n++;
    return n;
  }

  // Which side a player of this army fights on, or null if his army isn't in this battle.
  sideOf(faction) {
    return faction === this.opts.attackers ? ATT : faction === this.opts.defenders ? DEF : null;
  }

  join(client, { userId, name, faction, cls = 'infantry', loadout = null, soldierId = null, tank = null }) {
    const g = this.g;
    const team = this.sideOf(faction);
    if (team === null) throw new Error(`This battle is ${this.opts.attackers} against ${this.opts.defenders}`);
    if (!DEFAULT_LOADOUT[faction]?.[cls]) throw new Error('Unknown class');
    for (const [, p] of this.players) if (p.userId === userId) throw new Error('You are already in this battle');
    const who = { faction, cls, team, name, loadout: checkLoadout(faction, cls, loadout), tank: cls === 'tanker' ? (TANK_IDS[faction].includes(tank) ? tank : TANK_IDS[faction][0]) : null };
    const pc = addPlayer(g, who);
    this.rec?.join(this.tick, who, pc.soldier.id);
    this.players.set(client, { pc, userId, name, soldierId, queue: [], budget: INPUTS_PER_SECOND });
    this.fullNext = true; // (he sees every vehicle at once)
    this.send(client, JSON.stringify({ k: 'w', v: PROTOCOL_VERSION, you: pc.soldier.id, map: g.mapDef.id ?? 'town', seed: this.opts.seed, side: team, attackers: this.opts.attackers, defenders: this.opts.defenders, tick: this.tick, rate: 1 / TICK }));
    this._broadcast(JSON.stringify(roster(g)));
    if (this._scores) this.send(client, this._scores);
    return pc.soldier.id;
  }

  // An input message: kept for the next step (up to a budget a second, so
  // nobody can flood the server).
  input(client, message) {
    const p = this.players.get(client);
    if (!p || p.budget <= 0) return;
    p.budget--;
    p.queue.push(message);
  }

  // A line of chat: to his side, or to everyone (all).
  chat(client, text, all = false) {
    const p = this.players.get(client);
    const t = cleanChat(text);
    if (!p || !t || !chatAllowed((p.chat ??= []))) return;
    const team = p.pc.soldier.team;
    const msg = JSON.stringify({ k: 't', from: p.pc.soldier.id, name: p.name, team, all: !!all, text: t });
    for (const [c, q] of this.players) if (all || q.pc.soldier.team === team) this.send(c, msg);
  }

  // He is leaving (the pause menu): his rewards now, so he can see them.
  leaving(client) {
    const p = this.players.get(client);
    if (p) this._reward(client, p, false);
  }

  // A player gone: a bot takes his soldier over where he stands. (Gone before
  // the battle is decided: a defeat for him.)
  leave(client) {
    const p = this.players.get(client);
    if (!p) return;
    this._reward(client, p, false);
    this.players.delete(client);
    const g = this.g;
    const s = p.pc.soldier;
    // (Aim that kept turning faster than a person can: in the log, to look into.)
    if (p.pc.snaps > 30) console.warn(`${p.name}: aim turned faster than a person can ${p.pc.snaps} times this battle`);
    s.tally = null;
    g.remotePlayers = g.remotePlayers.filter((x) => x !== p.pc);
    s.remote = false;
    s.retire = false;
    s.name = `${s.name} (bot)`;
    s.brain = new BotBrain(g, s);
    this._broadcast(JSON.stringify(roster(g)));
  }

  // A few steps at a time, then the server answers everything else waiting
  // (sign-in, saves, the other battles): a battle that can't keep up on a slow
  // machine runs a little slow rather than leaving the server deaf.
  _start() {
    let start = performance.now();
    let behind = 0;
    const loop = () => {
      if (this.closed) return;
      let due = Math.floor((performance.now() - start) / 1000 / TICK);
      // (More than a quarter second behind: the lost time is dropped.)
      if (due - this.tick > 15) {
        start += (due - this.tick - 1) * TICK * 1000;
        due = this.tick + 1;
        if (performance.now() - behind > SLOW_WARN * 1000) {
          behind = performance.now();
          console.warn(`battle ${this.opts.attackers} against ${this.opts.defenders}: the server can't keep up (${this.opts.perSide} a side)`);
        }
      }
      try {
        for (let n = 0; n < STEPS_AT_ONCE && this.tick < due && !this.closed; n++) this._step();
      } catch (e) {
        // One bad step mustn't stop the server: noted (once a second at most), and on.
        if (!(this._lastError > performance.now() - 1000)) {
          console.error('battle step failed', e);
          this.onError?.(e);
        }
        this._lastError = performance.now();
      }
      this._timer = setTimeout(loop, this.tick < due ? 0 : 4);
    };
    loop();
  }

  _step() {
    const g = this.g;
    this.tick++;
    for (const [, p] of this.players) {
      for (const m of p.queue) {
        this.rec?.input(this.tick, p.pc.soldier.id, m);
        g.applyInput(p.pc.soldier.id, m);
      }
      p.queue.length = 0;
      if (this.tick % 60 === 0) p.budget = INPUTS_PER_SECOND;
    }
    g.update(TICK);
    // Someone gone from the battle (a bot that made room for a player): everyone is told.
    if (g.rosterChanged) {
      g.rosterChanged = false;
      this._broadcast(JSON.stringify(roster(g)));
    }
    if (this.rec && this.tick % CHECK_EVERY === 0) this.rec.check(this.tick, g);
    if (this.tick % SNAP_EVERY === 0) {
      const n = this.tick / SNAP_EVERY;
      const full = this.fullNext || n % FULL_EVERY === 0;
      this.fullNext = false;
      const snap = snapshot(g, this.tick, { events: this.events.take(), sent: (this.sentVehicles ??= new Map()), full });
      for (const [client, p] of this.players) {
        snap.a = p.pc.input.seq;
        this.send(client, JSON.stringify(snap));
      }
    }
    // The scoreboard, when it changed (once a second at most).
    if (this.tick % 60 === 30) {
      const sc = scores(g);
      const text = JSON.stringify(sc);
      if (text !== this._scores) {
        this._scores = text;
        this._broadcast(text);
      }
    }
    // Closing: empty for a minute, or a while after the battle is decided.
    if (this.tick % 60 === 0) {
      this.emptyFor = this.players.size ? 0 : this.emptyFor + 1;
      if (g.mode.over) {
        if (this.overFor === 0) {
          this._broadcast(JSON.stringify({ k: 'o', team: g.mode.over.team, why: g.mode.over.why ?? '' }));
          for (const [client, p] of this.players) this._reward(client, p, p.pc.soldier.team === g.mode.over.team);
        }
        this.overFor++;
      }
      if (this.emptyFor >= EMPTY_CLOSE || this.overFor >= OVER_CLOSE) this.close();
    }
  }

  // What his battle earned him, once (game/rewards.js).
  _reward(client, p, won) {
    if (p.rewarded) return;
    p.rewarded = true;
    const s = p.pc.soldier;
    const reward = battleReward(s, { won, defending: s.team === DEF, seconds: this.g.time - (s.joinedAt ?? 0) });
    // (info: for the stats, telemetry.js.)
    const info = { army: s.faction, cls: s.cls, gun: s.weapons?.[0]?.def?.id || '', seconds: Math.round(this.g.time - (s.joinedAt ?? 0)), kills: s.kills || 0, deaths: s.deaths || 0, captures: s.captures || 0, won, early: !this.g.mode?.over };
    const saving = this.onReward?.({ client, userId: p.userId, name: p.name, soldierId: p.soldierId, reward, info });
    if (saving?.then) this.saving.push(saving.catch(() => {}));
  }

  // The server is stopping (a new version going up): each player's battle so
  // far is kept, as if he had left, and the room closes.
  async finish() {
    if (this.g) for (const [client, p] of this.players) this._reward(client, p, false);
    await Promise.all(this.saving);
    this.close();
  }

  _broadcast(text) {
    for (const [client] of this.players) this.send(client, text);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this._timer);
    this.onClose?.(this);
  }
}

// A loadout the player's browser asked for, if it is one his army and class may
// carry within his equipment points; else his class's starting kit. (Which
// guns he has opened and bought is checked on the server once soldiers are
// kept there, in Phase 2.)
export function checkLoadout(faction, cls, ids) {
  const dflt = DEFAULT_LOADOUT[faction][cls];
  if (!Array.isArray(ids) || ids.length !== LOADOUT_SLOTS.length) return dflt;
  const ok = ids.every((id, i) => {
    if (id == null) return i > 0;
    const w = WEAPONS[id];
    return w && (w.faction === faction || w.anyArmy) && w.classes.includes(cls) && w.slot === LOADOUT_SLOTS[i];
  });
  return ok && loadoutPoints(ids) <= CLASS_POINTS[cls] ? ids.map((x) => x ?? null) : dflt;
}
