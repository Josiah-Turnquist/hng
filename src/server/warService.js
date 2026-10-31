// The shared war, run on the game server: one war for everyone, kept in the
// database (progressStore: war_state) and run on in real time, WAR_SPEED times
// faster (war.js tick). Its generals are chosen by hand on the admin page for
// the beta (progressStore: generals); an army with no general, or whose
// generals have been away a day, is led by the computer (war.humans).
//
// Generals give orders from the Generals tab, over the menu connection
// (social.js passes 'ww' and 'wo' on). Everyone watching sees the same war,
// sent every two seconds. A war battle is fought as an online battle on the
// game server (server/main.mjs warRoomFor): while one is open the battle waits
// for it; its result goes back into the war. A battle nobody fights settles on
// its own when its time is up.
//
//   const w = new WarService({ store, log, speed, battleWait })
//   await w.start()
//   w.watch(userId, send) / w.unwatch(userId)     // send({ k: 'war', you, war })
//   w.order(userId, { act, id, type, point, to }) -> { ok, why?, team? }
//   w.seen(userId)                                // a general looked in
//   w.setGeneral(userId, army | null, name)       // (admin page)
//   w.battleFor(number, id, army) -> battle or throws; w.opened / result / closedEarly
//   w.heroFunds(number, army, n)                  // warfunds his heroes earned
//   await w.stop()
import { newWar, nextWar, tick, save, load, buy, deploy, deployProblem, order, withdraw, upgrade, upgradeProblem, battleOf, teamOf, resolveBattle, ARMIES, TEAMS } from '../war/war.js';
import { MAP } from '../war/warMap.js';

const SAVE_EVERY = 30; // seconds between saves
const SEND_EVERY = 2; // seconds between sends to those watching
const AWAY_HOURS = 24; // a general away longer than this: the computer leads his army
const NEXT_WAR_AFTER = 10 * 60; // seconds from a war's end to the next
const LOAD_RETRY = 15; // seconds between tries when the database can't be reached
export const ONLINE = 'online'; // battle.hero while an online battle is fighting it

export class WarService {
  constructor({ store = null, log = console.log, speed = 6, battleWait = 10, now = () => Date.now() } = {}) {
    this.store = store?.loadWar ? store : null;
    this.log = log;
    this.speed = speed;
    this.battleWait = battleWait; // minutes a battle waits for players
    this.now = now;
    this.war = null;
    this.generals = new Map(); // user id -> { army, name, seen (ms) }
    this.watchers = new Map(); // user id -> send
    this.rooms = new Map(); // battle id -> online battle room
    this.saveT = 0;
    this.sendT = 0;
    this.overFor = 0;
  }

  // The war kept, or a new one when there is none. (A database that can't be
  // reached yet is tried again: a new war is never saved over a kept one.)
  async start() {
    let war;
    for (;;) {
      try {
        const kept = this.store ? await this.store.loadWar() : null;
        war = kept ? load(typeof kept === 'string' ? kept : JSON.stringify(kept)) : null;
        if (kept && !war) this.log('war: the kept war could not be read; a new one starts');
        if (this.store) for (const g of await this.store.generals()) this.generals.set(g.user_id, { army: g.army, name: g.name, seen: g.last_seen ? new Date(g.last_seen).getTime() : 0 });
        break;
      } catch (e) {
        this.log(`war: database not reached (${e.message}); trying again`);
        await new Promise((r) => setTimeout(r, LOAD_RETRY * 1000));
        if (this.stopped) return;
      }
    }
    if (!war || war.army) war = newWar({ army: null });
    // (Online battles from before a restart are gone: those battles settle on their own.)
    for (const b of war.battles) if (b.hero === ONLINE) b.hero = null;
    this._use(war);
    this.log(`war ${war.number}: running at ${this.speed} times real time`);
    this.last = this.now();
    this.timer = setInterval(() => this._run(), 1000);
    this.timer.unref?.();
  }

  _use(war) {
    war.battleTime = this.battleWait * 60 * this.speed;
    this.war = war;
    this.overFor = 0;
    this._leaders();
    this.sendT = SEND_EVERY;
  }

  // Which armies people lead: those with a general seen in the last day.
  _leaders() {
    if (!this.war) return;
    const since = this.now() - AWAY_HOURS * 3600 * 1000;
    this.war.humans = ARMIES.filter((a) => [...this.generals].some(([id, g]) => g.army === a && (g.seen > since || this.watchers.has(id))));
  }

  _run() {
    const t = this.now();
    const dt = Math.min(5, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    const war = this.war;
    if (!war) return;
    this._leaders();
    if (war.over) {
      this.overFor += dt;
      if (this.overFor >= NEXT_WAR_AFTER) {
        this._use(nextWar(war));
        this.log(`war ${this.war.number} begins`);
        this.save();
      }
    } else tick(war, dt * this.speed);
    this.sendT += dt;
    if (this.sendT >= SEND_EVERY) {
      this.sendT = 0;
      this._send();
    }
    this.saveT += dt;
    if (this.saveT >= SAVE_EVERY) {
      this.saveT = 0;
      this.save();
    }
  }

  async save() {
    if (!this.store || !this.war) return;
    try {
      await this.store.saveWar(save(this.war));
    } catch (e) {
      this.log(`war: not saved (${e.message})`);
    }
  }

  // --- Those watching (the Generals tab open) ---

  // What everyone sees: the war (without its dice), who leads each army, and
  // how many players fight each battle online.
  view() {
    const w = this.war;
    if (!w) return null;
    const leaders = Object.fromEntries(ARMIES.map((a) => [a, [...this.generals.values()].filter((g) => g.army === a).map((g) => g.name)]));
    const fights = Object.fromEntries([...this.rooms].map(([id, r]) => [id, r.players?.size ?? 0]));
    const { rng, ...rest } = w;
    void rng;
    return { ...rest, owner: Array.from(w.owner).join(''), leaders, fights, speed: this.speed, nextIn: w.over ? Math.max(0, NEXT_WAR_AFTER - this.overFor) : null };
  }

  _send(only = null) {
    if (!this.watchers.size) return;
    const text = JSON.stringify(this.view());
    for (const [id, send] of this.watchers) if (!only || only === id) send(`{"k":"war","you":${JSON.stringify(this.generals.get(id)?.army ?? null)},"war":${text}}`);
  }

  watch(id, send) {
    this.watchers.set(id, send);
    this.seen(id);
    this._send(id);
  }

  unwatch(id) {
    this.watchers.delete(id);
  }

  seen(id) {
    const g = this.generals.get(id);
    if (!g) return;
    g.seen = this.now();
    this.store?.generalSeen(id).catch(() => {});
  }

  // --- Generals ---

  async setGeneral(id, army, name = '') {
    if (army && !ARMIES.includes(army)) throw new Error('No such army');
    if (this.store) await this.store.setGeneral(id, army || null, name);
    if (army) this.generals.set(id, { army, name, seen: this.generals.get(id)?.seen ?? 0 });
    else this.generals.delete(id);
    this._leaders();
    this.log(`war: ${name || id} ${army ? `leads the ${army}` : 'is no longer a general'}`);
    this._send(id);
  }

  list() {
    return [...this.generals].map(([id, g]) => ({ id, army: g.army, name: g.name, seen: g.seen ? new Date(g.seen).toISOString() : null, watching: this.watchers.has(id) }));
  }

  // An order from a general for his army (the Generals tab).
  order(id, m = {}) {
    const g = this.generals.get(id);
    const war = this.war;
    if (!g) return { ok: false, why: 'Only generals give orders. For the beta they are chosen by the game\'s admins.' };
    if (!war) return { ok: false, why: 'The war is still loading' };
    if (war.over) return { ok: false, why: 'The war is over' };
    this.seen(id);
    const army = g.army;
    const point = Number(m.point);
    const okPoint = Number.isInteger(point) && point >= 0 && point < MAP.count;
    const t = m.act === 'buy' ? null : teamOf(war, Number(m.id));
    if (m.act !== 'buy' && (!t || t.army !== army)) return { ok: false, why: 'Not one of your teams' };
    const done = (out = {}) => {
      this.sendT = SEND_EVERY; // (everyone sees it at once)
      return { ok: true, ...out };
    };
    switch (m.act) {
      case 'buy': {
        const d = TEAMS[m.type];
        if (!d || d.from) return { ok: false, why: 'No such team' };
        const nt = buy(war, army, m.type);
        return nt ? done({ team: nt.id }) : { ok: false, why: 'Not enough warfunds' };
      }
      case 'deploy': {
        if (!okPoint) return { ok: false, why: 'No such place' };
        const why = deployProblem(war, t, point);
        if (why) return { ok: false, why };
        return deploy(war, t.id, point) ? done() : { ok: false, why: 'It could not be set down there' };
      }
      case 'move':
        if (!okPoint) return { ok: false, why: 'No such place' };
        if (t.at === null || t.battle) return { ok: false, why: t.battle ? 'In battle' : 'In the reserve' };
        return order(war, t.id, point) ? done() : { ok: false, why: `It can't get to ${MAP.name(point)}` };
      case 'stop':
        if (t.at === null || t.battle) return { ok: false, why: 'It is not on the move' };
        Object.assign(t, { path: [], leg: 0, hold: 0 });
        return done();
      case 'withdraw':
        return withdraw(war, t.id) ? done() : { ok: false, why: 'Only from your own land joined to a capital, and not in battle' };
      case 'upgrade': {
        const why = TEAMS[m.to] ? upgradeProblem(war, t, m.to) : 'No such upgrade';
        if (why) return { ok: false, why };
        return upgrade(war, t.id, m.to) ? done() : { ok: false, why: 'It could not be upgraded' };
      }
    }
    return { ok: false, why: 'Unknown order' };
  }

  // --- War battles fought online ---

  // The battle a soldier of this army may fight in (or why not).
  battleFor(number, id, army) {
    const war = this.war;
    const b = war && !war.over && war.number === number ? battleOf(war, id) : null;
    if (!b) throw new Error('That battle is over');
    if (b.att !== army && b.def !== army) throw new Error('Your army does not fight in that battle');
    return b;
  }

  // An online battle opened for it: the battle waits for its result.
  opened(number, id, room) {
    const b = this.war?.number === number ? battleOf(this.war, id) : null;
    if (!b) return;
    b.hero = ONLINE;
    this.rooms.set(id, room);
    this.sendT = SEND_EVERY;
  }

  // Decided online: the war goes on from it.
  result(number, id, attackersWon) {
    this.rooms.delete(id);
    if (this.war?.number !== number) return null;
    const r = resolveBattle(this.war, id, attackersWon);
    if (r) this.log(`war: ${r.winArmy} wins the online battle at ${MAP.name(r.point)}`);
    this.sendT = SEND_EVERY;
    return r;
  }

  // Everyone left before it was decided: it settles on its own (in a minute
  // or two if its time is already up, so a player may still come back).
  closedEarly(number, id) {
    this.rooms.delete(id);
    const b = this.war?.number === number ? battleOf(this.war, id) : null;
    if (!b) return;
    b.hero = null;
    b.ends = Math.max(b.ends, this.war.t + 120 * this.speed);
  }

  heroFunds(number, army, n) {
    if (this.war?.number !== number || !ARMIES.includes(army) || !(n > 0)) return;
    this.war.funds[army] += Math.round(n);
  }

  // (Admin page: a new war at once.)
  restart() {
    // (Online battles of the old war play out; their results are not used.)
    this.rooms.clear();
    this._use(this.war ? nextWar(this.war) : newWar({ army: null }));
    this.log(`war ${this.war.number} begins (started on the admin page)`);
    return this.save();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
    await this.save();
  }
}
