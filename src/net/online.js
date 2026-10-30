// An online battle in the browser (docs/MULTIPLAYER.md, Phase 1): the game
// server runs the battle; this page shows it and sends what the player does.
//
// - Everyone else (players and bots) and every vehicle are puppets: placed
//   where the server's snapshots say, a tenth of a second behind, gliding
//   between snapshots rather than jumping.
// - The player's own soldier moves at once from his keys, run by the same
//   controls as offline, and is quietly corrected when the server saw him
//   somewhere else (compared at the input the server last used).
// - Shots, deaths and blasts come as events and are drawn: tracers, impacts,
//   the kill feed. Only the server decides hits, health, deaths and points.
//
//   const conn = await connect(soldier)          // { ws, welcome, roster, inbox } or throws
//   game.online = new OnlineBattle(game, conn)    // once the world is built
//   (Game calls online.update(dt) each step and online.sendInput() each frame)
import { ACTION_LIST, encodeInput, readSnapshot, PROTOCOL_VERSION } from './protocol.js';
import { token } from './auth.js';
import { Soldier } from '../game/soldier.js';
import { attachSoldierModel } from '../game/soldierView.js';
import { WEAPONS } from '../weapons/defs.js';
import { AMMO } from '../weapons/ammo.js';

// How far behind the newest snapshot others are shown (seconds): two
// snapshots' worth, so there is nearly always one on each side.
export const INTERP_DELAY = 0.1;
const SEND_EVERY = 1 / 60;

// Join the battle: sign in to the game server with the player's token and
// soldier, and wait for the welcome. Messages that come meanwhile are kept.
export async function connect(soldier, { dev = null, url = null } = {}) {
  const t = dev ? null : await token();
  if (!t && !dev) throw new Error('Please sign in again');
  const ws = new WebSocket(url || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/play`);
  const inbox = [];
  return new Promise((ok, fail) => {
    let welcome = null;
    const timer = setTimeout(() => fail(new Error('The game server did not answer. Try again in a moment.')), 30000);
    ws.onopen = () => ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, token: t, dev, soldier }));
    ws.onerror = () => fail(new Error('Could not reach the game server.'));
    ws.onclose = (e) => {
      clearTimeout(timer);
      if (!welcome) fail(new Error(e.reason && e.reason !== 'refused' ? e.reason : 'The game server closed the connection.'));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.k === 'x') {
        clearTimeout(timer);
        return fail(new Error(m.why));
      }
      if (m.k === 'w') welcome = m;
      else inbox.push(m);
      // (Ready once the roster has come too.)
      if (welcome && inbox.some((x) => x.k === 'r')) {
        clearTimeout(timer);
        ok({ ws, welcome, inbox });
      }
    };
  });
}

export class OnlineBattle {
  constructor(game, { ws, welcome, inbox = [] }) {
    this.game = game;
    this.ws = ws;
    this.welcome = welcome;
    this.me = game.player.soldier;
    this.me.id = welcome.you;
    this.puppets = new Map(); // soldier id -> Soldier
    this.vehicles = new Map(); // vehicle id -> Vehicle
    this.snaps = []; // the last few snapshots, oldest first
    this.clock = null; // battle time shown for others
    this.seq = 0;
    this.history = []; // [{ seq, x, y, z }] where the player was as each input went
    this.pressed = new Set();
    this.sendT = 0;
    this.over = null;
    this.closed = false;
    this.deployAt = null; // while down: the point he chose (game.js _playerDeploy)
    this.seatOff = 0; // snapshots in a row that put him in another seat than here
    // Every round fired here is drawn only: the server fires the real one.
    const fire = game.projectiles.fire.bind(game.projectiles);
    game.projectiles.fire = (o) => fire({ ...o, visual: true });
    for (const m of inbox) this._message(m);
    ws.onmessage = (e) => this._message(JSON.parse(e.data));
    ws.onclose = () => {
      this.closed = true;
      if (!this.over) game.hud?.flash('Lost the connection to the game server', 30);
    };
  }

  _message(m) {
    if (m.k === 's') {
      const snap = readSnapshot(m);
      this.snaps.push(snap);
      if (this.snaps.length > 30) this.snaps.shift();
      this._events(snap.events);
      this._self(snap);
      this._points(snap);
    } else if (m.k === 'r') this._roster(m.s);
    else if (m.k === 'o') {
      this.over = m;
      this.game.mode?.serverEnd?.(m.team, m.why);
    }
  }

  // --- Who is in the battle -----------------------------------------------------------

  _roster(list) {
    const g = this.game;
    const seen = new Set();
    for (const [id, team, name, faction, cls, seed, variant, loadout] of list) {
      seen.add(id);
      if (id === this.me.id) continue;
      let s = this.puppets.get(id);
      if (!s) {
        s = new Soldier(g, { faction, cls, loadout, team, name, x: 0, z: 0 });
        s.id = id;
        s.puppet = true;
        s.look = { seed, variant };
        s.alive = false; // (until a snapshot places him)
        s.deathTime = 999;
        g.soldiers.push(s);
        if (!g.headless) attachSoldierModel(g, s);
        this.puppets.set(id, s);
      }
      s.name = name;
      s.team = team;
    }
    // Gone from the battle.
    for (const [id, s] of this.puppets) {
      if (seen.has(id)) continue;
      this.puppets.delete(id);
      g.soldiers.splice(g.soldiers.indexOf(s), 1);
      if (s.model) s.model.root.removeFromParent();
    }
  }

  // --- The player's own soldier ---------------------------------------------------------

  _self(snap) {
    const me = this.me;
    const st = snap.soldiers.find((x) => x.id === me.id);
    if (!st) return;
    const pc = this.game.player;
    me.health = st.health;
    // The first word from the server: where it put him.
    if (!this.placed && st.alive) {
      this.placed = true;
      this._place(me, st);
      pc.look.yaw = st.yaw;
      pc.look.pitch = 0;
    }
    if (me.alive && !st.alive) {
      // Down (the server says so): the death view, and back in when it puts him back.
      me.alive = false;
      me.health = 0;
      me.deathTime = 0;
      me.weapon?.setTrigger(false);
      this.history.length = 0;
      return;
    }
    if (!me.alive && st.alive) {
      this.deployAt = null;
      me.alive = true;
      me.bleed = 0;
      me.deathTime = 0;
      me.rearm();
      me.resupply();
      for (const w of me.weapons) w?.fill();
      me.current = -1;
      pc._equip(0);
      this._place(me, st);
      pc.look.yaw = st.yaw;
      pc.look.pitch = 0;
      this.history.length = 0;
      return;
    }
    if (!me.alive) return;
    this._seat(st);
    if (me.vehicle) return;
    // Where he was when the server used his last input, against where the
    // server has him: the difference is taken off a little each step.
    while (this.history.length && this.history[0].seq < snap.ack) this.history.shift();
    const h = this.history[0];
    if (!h || h.seq !== snap.ack) return;
    const ex = st.x - h.x,
      ey = st.y - h.y,
      ez = st.z - h.z;
    const err = Math.hypot(ex, ez);
    if (err > 3) {
      // Far off (stuck, pushed, a door): to the server's place at once.
      this._place(me, { ...st, x: me.body.x + ex, y: me.body.y + ey, z: me.body.z + ez });
      for (const q of this.history) {
        q.x += ex;
        q.y += ey;
        q.z += ez;
      }
    } else if (err > 0.05) this.correct = { x: ex, z: ez, left: 0.25 };
  }

  // In or out of a vehicle: done here at once on his key, and put right when
  // the server still has him elsewhere half a second later (a seat taken
  // first by someone else, say).
  _seat(st) {
    const me = this.me;
    const pc = this.game.player;
    const sv = (st.vehicle && this.vehicles.get(st.vehicle)) || null;
    const here = me.vehicle || null;
    if (sv === here && (!sv || st.seat === me.seat)) return (this.seatOff = 0);
    if (++this.seatOff < 10) return;
    this.seatOff = 0;
    if (here) {
      here.occupants[me.seat] = null;
      me.vehicle = null;
      me.seat = -1;
      pc.exitedVehicle(here);
      this._place(me, st);
    }
    if (sv) {
      if (sv.occupants[st.seat] && sv.occupants[st.seat] !== me) sv.occupants[st.seat] = null;
      if (sv.enter(me, st.seat)) pc.vehicleCtl.entered(sv);
    }
  }

  _place(s, st) {
    const b = s.body;
    b.x = st.x;
    b.y = st.y;
    b.z = st.z;
    b.vx = b.vy = b.vz = 0;
  }

  // Each step: a share of the correction (a quarter second in all).
  _correct(dt) {
    const c = this.correct;
    if (!c || !this.me.alive) return;
    const k = Math.min(1, dt / c.left);
    const b = this.me.body;
    b.x += c.x * k;
    b.z += c.z * k;
    for (const q of this.history) {
      q.x += c.x * k;
      q.z += c.z * k;
    }
    c.x *= 1 - k;
    c.z *= 1 - k;
    c.left -= dt;
    if (c.left <= 0) this.correct = null;
  }

  // --- What the player does -----------------------------------------------------------

  // Each frame, before the keys are cleared: what is held and what was pressed,
  // and where he faces, about 60 times a second.
  sendInput(dt) {
    if (this.closed || this.ws.readyState !== 1) return;
    const input = this.game.input;
    for (const a of ACTION_LIST) if (input.hit(a)) this.pressed.add(a);
    this.sendT += dt;
    if (this.sendT < SEND_EVERY) return;
    this.sendT = 0;
    const held = ACTION_LIST.filter((a) => input.is(a));
    const pc = this.game.player;
    // (Aiming that toggles on a press goes as held while it is on.)
    if (this.game.settings?.get('aimToggle')) {
      const i = held.indexOf('aim');
      if (i >= 0) held.splice(i, 1);
      if (pc.aimToggled) held.push('aim');
      this.pressed.delete('aim');
    }
    this.seq++;
    this.ws.send(JSON.stringify(encodeInput({ seq: this.seq, held, pressed: [...this.pressed], look: [pc.look.yaw, pc.look.pitch], deploy: this.me.alive ? null : this.deployAt })));
    this.pressed.clear();
    const b = this.me.body;
    this.history.push({ seq: this.seq, x: b.x, y: b.y, z: b.z });
    if (this.history.length > 240) this.history.shift();
  }

  // --- Everyone else, between snapshots ---------------------------------------------------

  update(dt) {
    this._correct(dt);
    const snaps = this.snaps;
    if (!snaps.length) return;
    const newest = snaps[snaps.length - 1].time;
    // The shown time runs with the clock, kept INTERP_DELAY behind the newest
    // snapshot (nudged, so a late snapshot doesn't make others jump).
    if (this.clock === null || Math.abs(newest - INTERP_DELAY - this.clock) > 1) this.clock = newest - INTERP_DELAY;
    else this.clock += dt * (1 + Math.max(-0.1, Math.min(0.1, (newest - INTERP_DELAY - this.clock) * 2)));
    let a = snaps[0],
      b = snaps[snaps.length - 1];
    for (let i = 0; i < snaps.length - 1; i++) {
      if (snaps[i].time <= this.clock && snaps[i + 1].time >= this.clock) {
        a = snaps[i];
        b = snaps[i + 1];
        break;
      }
    }
    const span = b.time - a.time;
    const t = span > 0 ? Math.max(0, Math.min(1, (this.clock - a.time) / span)) : 1;
    this._vehiclesAt(a, b, t);
    this._soldiersAt(a, b, t, span, dt);
  }

  _soldiersAt(a, b, t, span, dt) {
    const prev = new Map(a.soldiers.map((x) => [x.id, x]));
    for (const nb of b.soldiers) {
      const s = this.puppets.get(nb.id);
      if (!s) continue;
      const na = prev.get(nb.id) || nb;
      const bd = s.body;
      const x = lerp(na.x, nb.x, t),
        y = lerp(na.y, nb.y, t),
        z = lerp(na.z, nb.z, t);
      // His speed, for the walking and running of his legs.
      if (span > 0) {
        bd.vx = (nb.x - na.x) / span;
        bd.vz = (nb.z - na.z) / span;
      }
      bd.x = x;
      bd.y = y;
      bd.z = z;
      bd.yaw = lerpAngle(na.yaw, nb.yaw, t);
      s.yaw = bd.yaw;
      s.pitch = lerp(na.pitch, nb.pitch, t);
      if (bd.targetStance !== nb.stance) {
        bd.stanceFrom = bd.stance;
        bd.targetStance = nb.stance;
        bd.stanceT = 0;
      }
      bd.stanceT = Math.min(1, (bd.stanceT ?? 1) + dt * 3);
      if (bd.stanceT >= 1) bd.stance = nb.stance;
      bd.sprinting = nb.sprinting;
      bd.onGround = true;
      bd.moving = Math.hypot(bd.vx, bd.vz);
      s.aiming = nb.aiming;
      s.health = nb.health;
      if (nb.weapon !== s.current && s.weapons[nb.weapon]) s.current = nb.weapon;
      if (s.alive && !nb.alive) {
        s.alive = false;
        s.deathTime = 0;
      } else if (!s.alive && nb.alive) {
        s.alive = true;
        s.deathTime = 0;
        bd.vx = bd.vz = 0;
      }
      if (!s.alive) s.deathTime += dt;
      const v = nb.vehicle ? this.vehicles.get(nb.vehicle) : null;
      s.vehicle = v || null;
      s.seat = v ? nb.seat : -1;
    }
    for (const v of this.vehicles.values()) v.occupants.fill(null);
    for (const s of this.puppets.values()) if (s.vehicle && s.seat >= 0) s.vehicle.occupants[s.seat] = s;
    const me = this.me;
    if (me.vehicle && me.seat >= 0) me.vehicle.occupants[me.seat] = me;
  }

  _vehiclesAt(a, b, t) {
    const g = this.game;
    const prev = new Map(a.vehicles.map((x) => [x.id, x]));
    for (const nb of b.vehicles) {
      let v = this.vehicles.get(nb.id);
      if (!v) {
        try {
          v = g.spawnVehicle(nb.def, nb.x, nb.z, 0);
        } catch (e) {
          console.warn('No vehicle', nb.def, e);
          continue;
        }
        v.id = nb.id;
        v.puppet = true;
        this.vehicles.set(nb.id, v);
      }
      const na = prev.get(nb.id) || nb;
      const p = v.body.position;
      p.set(lerp(na.x, nb.x, t), lerp(na.y, nb.y, t), lerp(na.z, nb.z, t));
      const q = v.body.quaternion;
      q.set(...na.q);
      q.slerp(v._qb || (v._qb = q.clone()), 0);
      v._qb.set(...nb.q);
      q.slerp(v._qb, t);
      v.body.updateDerived?.();
      v.turretYaw = lerpAngle(na.turretYaw, nb.turretYaw, t);
      v.gunElev = lerp(na.gunElev, nb.gunElev, t);
      v.hp = nb.hp;
      v.alive = nb.alive;
    }
  }

  // --- Points and the clock -------------------------------------------------------------

  _points(snap) {
    const mode = this.game.mode;
    if (!mode?.points) return;
    for (const p of snap.points) {
      const mp = mode.byId?.[p.id];
      if (!mp) continue;
      mp.owner = p.owner;
      mp.c = p.control;
    }
    mode.timeLeft = snap.clock.timeLeft;
    mode.suddenDeath = snap.clock.suddenDeath;
  }

  // --- What happened ----------------------------------------------------------------------

  _events(list) {
    const g = this.game;
    for (const e of list) {
      if (e[0] === 'f') {
        // A round fired: drawn (the player's own already were, as he fired).
        const [, who, wid, x, y, z, vx, vy, vz, tracer] = e;
        if (who === this.me.id) continue;
        const s = this.puppets.get(who);
        const def = WEAPONS[wid];
        const ammo = AMMO[def?.ammo] || AMMO[s?.weapon?.def?.ammo];
        if (!ammo) continue;
        const px = x / 100,
          py = y / 100,
          pz = z / 100;
        g.projectiles.fire({ x: px, y: py, z: pz, vx: vx / 10, vy: vy / 10, vz: vz / 10, ammo, owner: s || null, weapon: def || { name: wid }, tracer: !!tracer, visual: true });
        if (s?.view) s.view.recoil = 1;
        const sp = Math.hypot(vx, vy, vz) || 1;
        if (!ammo.thrown) {
          g.effects.muzzle(px, py, pz, vx / sp, vy / sp, vz / sp, 0.8);
          g.audio?.gunshot?.(def?.sound, px, py, pz, { source: `s${who}` });
        }
      } else if (e[0] === 'd') {
        const [, who, by, wid] = e;
        const victim = who === this.me.id ? this.me : this.puppets.get(who);
        const killer = by === this.me.id ? this.me : this.puppets.get(by);
        if (!victim) continue;
        victim.killer = killer || null;
        g.hud?.killFeed?.(killer || null, victim, { weapon: WEAPONS[wid] || { name: String(wid || '') } });
        if (killer === this.me && victim !== this.me) g.hud?.killConfirm?.(victim.name);
      } else if (e[0] === 'x') {
        const [, x, y, z, size] = e;
        g.effects.explosion(x / 100, y / 100, z / 100, size / 10);
        g.audio?.explosion?.(size > 25 ? 'shellExplosion' : 'grenadeExplosion', x / 100, y / 100, z / 100);
      }
    }
  }

  close() {
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
