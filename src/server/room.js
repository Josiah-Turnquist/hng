// One battle on the game server, with the players in it: the battle runs 60
// steps a second in real time, each player's inputs are used on the next step,
// and every player gets a snapshot 20 times a second (net/protocol.js). Bots
// fill the sides. A player who leaves is taken over by a bot. With nobody left
// for a minute (or the battle over), the room closes and stops using the
// processor, so the server can go to sleep (Railway's Serverless setting).
//
//   const room = new BattleRoom({ perSide, attackers, defenders, send })
//   await room.ready
//   room.join(client, { userId, name, faction, cls, loadout })   -> soldier id or throws
//   room.input(client, message); room.leave(client)
//   room.onClose = () => ...
//
// client: any object; send(client, text) sends it a message.
import { makeBattle, addPlayer, ATT, DEF } from './battle.js';
import { Recorder, TICK, CHECK_EVERY } from './record.js';
import { snapshot, roster, watchEvents, PROTOCOL_VERSION } from '../net/protocol.js';
import { BotBrain } from '../ai/bot.js';
import { WEAPONS, DEFAULT_LOADOUT, LOADOUT_SLOTS, CLASS_POINTS, loadoutPoints } from '../weapons/defs.js';

const SNAP_EVERY = 3; // 60 steps a second / 3 = 20 snapshots a second
const EMPTY_CLOSE = 60; // seconds with nobody in it
const OVER_CLOSE = 15; // seconds after the battle is decided
const INPUTS_PER_SECOND = 90; // more than this from one player and the rest wait

export class BattleRoom {
  constructor({ perSide = 12, minutes = 30, attackers = 'US', defenders = 'GE', seed = (Math.random() * 2 ** 31) | 0, send, record = false } = {}) {
    this.opts = { perSide, minutes, attackers, defenders, seed };
    this.send = send;
    this.players = new Map(); // client -> { pc, userId, name, queue, budget }
    this.tick = 0;
    this.closed = false;
    this.onClose = null;
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

  // Which side a player of this army fights on, or null if his army isn't in this battle.
  sideOf(faction) {
    return faction === this.opts.attackers ? ATT : faction === this.opts.defenders ? DEF : null;
  }

  join(client, { userId, name, faction, cls = 'infantry', loadout = null }) {
    const g = this.g;
    const team = this.sideOf(faction);
    if (team === null) throw new Error(`This battle is ${this.opts.attackers} against ${this.opts.defenders}`);
    if (!DEFAULT_LOADOUT[faction]?.[cls]) throw new Error('Unknown class');
    for (const [, p] of this.players) if (p.userId === userId) throw new Error('You are already in this battle');
    const who = { faction, cls, team, name, loadout: checkLoadout(faction, cls, loadout) };
    const pc = addPlayer(g, who);
    this.rec?.join(this.tick, who, pc.soldier.id);
    this.players.set(client, { pc, userId, name, queue: [], budget: INPUTS_PER_SECOND });
    this.send(client, JSON.stringify({ k: 'w', v: PROTOCOL_VERSION, you: pc.soldier.id, map: g.mapDef.id ?? 'town', seed: this.opts.seed, side: team, attackers: this.opts.attackers, defenders: this.opts.defenders, tick: this.tick, rate: 1 / TICK }));
    this._broadcast(JSON.stringify(roster(g)));
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

  // A player gone: a bot takes his soldier over where he stands.
  leave(client) {
    const p = this.players.get(client);
    if (!p) return;
    this.players.delete(client);
    const g = this.g;
    const s = p.pc.soldier;
    g.remotePlayers = g.remotePlayers.filter((x) => x !== p.pc);
    s.remote = false;
    s.name = `${s.name} (bot)`;
    s.brain = new BotBrain(g, s);
    this._broadcast(JSON.stringify(roster(g)));
  }

  _start() {
    const start = performance.now();
    const loop = () => {
      if (this.closed) return;
      const due = Math.floor((performance.now() - start) / 1000 / TICK);
      // (After a long stall, don't race to catch up: drop the lost time.)
      if (due - this.tick > 30) this.tick = due - 1;
      try {
        while (this.tick < due && !this.closed) this._step();
      } catch (e) {
        // One bad step mustn't stop the server: noted (once a second at most), and on.
        if (!(this._lastError > performance.now() - 1000)) console.error('battle step failed', e);
        this._lastError = performance.now();
      }
      this._timer = setTimeout(loop, 4);
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
    if (this.rec && this.tick % CHECK_EVERY === 0) this.rec.check(this.tick, g);
    if (this.tick % SNAP_EVERY === 0) {
      const snap = snapshot(g, this.tick, { events: this.events.take() });
      for (const [client, p] of this.players) {
        snap.a = p.pc.input.seq;
        this.send(client, JSON.stringify(snap));
      }
    }
    // Closing: empty for a minute, or a while after the battle is decided.
    if (this.tick % 60 === 0) {
      this.emptyFor = this.players.size ? 0 : this.emptyFor + 1;
      if (g.mode.over) {
        if (this.overFor === 0) this._broadcast(JSON.stringify({ k: 'o', team: g.mode.over.team, why: g.mode.over.why ?? '' }));
        this.overFor++;
      }
      if (this.emptyFor >= EMPTY_CLOSE || this.overFor >= OVER_CLOSE) this.close();
    }
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
