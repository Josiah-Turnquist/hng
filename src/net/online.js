// An online battle in the browser (docs/MULTIPLAYER.md, Phase 1): the game
// server runs the battle; this page shows it and sends what the player does.
//
// - Everyone else (players and bots) and every vehicle are puppets: placed
//   where the server's snapshots say, a moment behind (75 to 150 thousandths
//   of a second, as the connection allows), gliding between snapshots rather
//   than jumping, and carried on a moment when one is late (shown.js).
// - The player's own soldier moves at once from his keys, run by the same
//   controls as offline, and is quietly corrected when the server saw him
//   somewhere else (compared at the input the server last used). So does the
//   vehicle he drives: run here as offline while he is at its wheel, and put
//   right the same way (a little at a time, or at once when far off).
// - Shots, deaths and blasts come as events and are drawn: tracers, impacts,
//   the kill feed. Only the server decides hits, health, deaths and points.
//
//   const conn = await connect(soldier)          // { ws, welcome, roster, inbox } or throws
//   game.online = new OnlineBattle(game, conn, { reconnect })    // once the world is built
//     (reconnect: () => connect({ ...soldier, rejoin: true }): used when the
//     connection drops, to get him back into his soldier, which the server
//     holds for a minute)
//   (Game calls online.update(dt) each step and online.sendInput() each frame)
import { ACTION_LIST, encodeInput, readSnapshot, ammoOf, applyVehicleState, PROTOCOL_VERSION } from './protocol.js';
import { token } from './auth.js';
import { Shown, MIN_DELAY } from './shown.js';
import { Soldier } from '../game/soldier.js';
import { attachSoldierModel } from '../game/soldierView.js';
import { WEAPONS } from '../weapons/defs.js';
import { AMMO } from '../weapons/ammo.js';
import { charModel } from '../vehicles/effects.js';
import * as THREE from 'three';

// The vehicle he drives, put right: a little over CORRECT_TIME when the
// server had it more than CORRECT_MIN metres (or CORRECT_TURN radians) off;
// at once when more than SNAP_DIST metres or SNAP_TURN radians.
const CORRECT_TIME = 0.3;
const CORRECT_MIN = 0.08;
const CORRECT_TURN = 0.02;
const SNAP_DIST = 5;
const SNAP_TURN = 0.8;
const _qd = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _vd = new THREE.Vector3();

// How far behind the newest snapshot others are shown at the least (seconds):
// shown.js, which stretches it when snapshots come unevenly.
export const INTERP_DELAY = MIN_DELAY;
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
    const timer = setTimeout(() => fail(Object.assign(new Error('The game server did not answer. Try again in a moment.'), { retry: true })), 30000);
    ws.onopen = () => ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, token: t, dev, soldier }));
    ws.onerror = () => fail(Object.assign(new Error('Could not reach the game server.'), { retry: true }));
    ws.onclose = (e) => {
      clearTimeout(timer);
      if (!welcome) fail(new Error(e.reason && e.reason !== 'refused' ? e.reason : 'The game server closed the connection.'));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.k === 'x') {
        clearTimeout(timer);
        // (retry: worth trying again in a moment, without troubling the player.)
        return fail(Object.assign(new Error(m.why), { retry: !!m.retry, reload: !!m.reload, gone: !!m.gone }));
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
  constructor(game, { ws, welcome, inbox = [] }, { reconnect = null } = {}) {
    this.game = game;
    this.ws = ws;
    this.reconnect = reconnect;
    this.welcome = welcome;
    this.me = game.player.soldier;
    this.me.id = welcome.you;
    this.puppets = new Map(); // soldier id -> Soldier
    this.vehicles = new Map(); // vehicle id -> Vehicle
    this.snaps = []; // the last few snapshots, oldest first
    this.shown = new Shown(); // when and where the others are shown (shown.js)
    this.seq = 0;
    this.history = []; // [{ seq, x, y, z }] where the player was as each input went
    this.driving = null; // the vehicle he drives, run here (not a puppet)
    this.vhistory = []; // [{ seq, p, q }] where it was as each input went
    this.vcorrect = null; // { e: Vector3, q: Quaternion, left } still to put right
    this.pressed = new Set();
    this.sendT = 0;
    this.over = null;
    this.closed = false;
    this.deployAt = null; // while down: the point he chose (game.js _playerDeploy)
    this.seatOff = 0; // snapshots in a row that put him in another seat than here
    // Every round fired here is drawn only: the server fires the real one.
    const fire = game.projectiles.fire.bind(game.projectiles);
    game.projectiles.fire = (o) => fire({ ...o, visual: true });
    this._attach(ws, inbox);
  }

  _attach(ws, inbox = []) {
    this.ws = ws;
    for (const m of inbox) this._message(m);
    ws.onmessage = (e) => this._message(JSON.parse(e.data));
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.closed = true;
      // Dropped (not leaving, not over): back in by itself if it can be.
      if (!this.over && !this.leftOnPurpose && this.reconnect) this._rejoin();
      else if (!this.over && !this.leftOnPurpose) this.game.hud?.flash('Lost the connection to the game server', 30);
    };
  }

  // The connection dropped: try again every few seconds for most of the
  // minute the server holds his soldier. The battle goes on meanwhile; his
  // soldier there stands still until he is back.
  async _rejoin() {
    if (this.rejoining) return;
    this.rejoining = true;
    const hud = this.game.hud;
    const started = performance.now();
    hud?.flash('Connection lost. Getting you back in...', 60);
    for (let attempt = 0; !this.over && !this.leftOnPurpose; attempt++) {
      await new Promise((r) => setTimeout(r, attempt ? Math.min(4000, 1000 * attempt) : 300));
      if (this.over || this.leftOnPurpose) break;
      try {
        const conn = await this.reconnect();
        if (conn.welcome.you !== this.me.id) {
          conn.ws.close();
          throw Object.assign(new Error('Your place in that battle is gone.'), { gone: true });
        }
        this.closed = false;
        this.history.length = 0;
        this._attach(conn.ws, conn.inbox);
        hud?.flash('Back in the battle', 3);
        this.onRejoin?.();
        break;
      } catch (e) {
        if (e.reload || e.gone || performance.now() - started > 55000) {
          hud?.flash(e.gone ? 'You were away too long: a bot took your place. Press Esc to leave.' : 'Could not get back into the battle. Press Esc to leave.', 60);
          break;
        }
      }
    }
    this.rejoining = false;
  }

  _message(m) {
    if (m.k === 's') {
      const snap = readSnapshot(m);
      this.snaps.push(snap);
      if (this.snaps.length > 30) this.snaps.shift();
      this.shown.arrived(snap.time, performance.now() / 1000);
      this._events(snap.events);
      this._self(snap);
      this._driven(snap);
      this._points(snap);
      if (snap.allVehicles) this._dropGone(snap);
    } else if (m.k === 'r') this._roster(m.s);
    else if (m.k === 'c') this._scores(m.s);
    else if (m.k === 't') this.onChat?.(m);
    else if (m.k === 'g') {
      // What the battle earned him, worked out and kept by the server.
      this.reward = m;
      this.onReward?.(m);
      this._left?.();
    }
    else if (m.k === 'o') {
      this.over = m;
      this.game.mode?.serverEnd?.(m.team, m.why);
    }
  }

  // The scoreboard as the server counts it.
  _scores(list) {
    for (const [id, kills, deaths, score, captures] of list || []) {
      const s = id === this.me.id ? this.me : this.puppets.get(id);
      if (!s) continue;
      s.kills = kills;
      s.deaths = deaths;
      s.score = score;
      s.captures = captures;
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
    // His bleeding as the server has it: the HUD's "Bleeding", the blurred
    // view, and the bandage key working here as on the server.
    me.bleed = st.alive ? st.bleed : 0;
    // The first word from the server: where it put him.
    if (!this.placed && st.alive) {
      this.placed = true;
      this._place(me, st);
      pc.look.yaw = st.yaw;
      pc.look.pitch = 0;
      this._seat(st, true);
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
      // (A tank crewman comes back in in his tank: in it at once.)
      this._seat(st, true);
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
  _seat(st, now = false) {
    const me = this.me;
    const pc = this.game.player;
    const sv = (st.vehicle && this.vehicles.get(st.vehicle)) || null;
    const here = me.vehicle || null;
    if (sv === here && (!sv || st.seat === me.seat)) return (this.seatOff = 0);
    if (++this.seatOff < 10 && !now) return;
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

  // --- The vehicle he drives ------------------------------------------------------------

  // At the wheel of a vehicle (and it whole): it is run here from his keys,
  // as offline. Out of it, or another seat: a puppet again, placed as the
  // server says.
  _driveCheck() {
    const me = this.me;
    const v = me.alive && me.seat === 0 && me.vehicle?.alive && this.vehicles.get(me.vehicle.id) === me.vehicle ? me.vehicle : null;
    if (v === this.driving) return;
    const was = this.driving;
    if (was) {
      was.puppet = true;
      was._pm = null; // (its speed worked out afresh from the snapshots)
      was._state = null;
    }
    this.driving = v;
    this.vhistory.length = 0;
    this.vcorrect = null;
    if (v) v.puppet = false;
  }

  // Where the server had it after the input it last used, against where it
  // was here as that input went: the difference is put right.
  _driven(snap) {
    const v = this.driving;
    if (!v) return;
    const st = snap.vehicles.find((x) => x.id === v.id);
    if (!st) return;
    const hist = this.vhistory;
    while (hist.length && hist[0].seq < snap.ack) hist.shift();
    const h = hist[0];
    if (!h || h.seq !== snap.ack) return;
    const e = new THREE.Vector3(st.x - h.p.x, st.y - h.p.y, st.z - h.p.z);
    // The turn from where it pointed here to where it pointed there.
    const q = new THREE.Quaternion(...st.q).normalize().multiply(_qi.copy(h.q).invert());
    const turn = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    const off = Math.hypot(e.x, e.z);
    if (off > SNAP_DIST || turn > SNAP_TURN) {
      // Far off (a crash here that didn't happen there, say): where the server has it, at once.
      this._moveDriven(e, q);
      this.vcorrect = null;
    } else if (off > CORRECT_MIN || turn > CORRECT_TURN || Math.abs(e.y) > 0.3) this.vcorrect = { e, q, left: CORRECT_TIME };
    else this.vcorrect = null;
  }

  // A share of the correction each step.
  _correctVehicle(dt) {
    const c = this.vcorrect;
    if (!c || !this.driving) return;
    const k = Math.min(1, dt / c.left);
    _vd.copy(c.e).multiplyScalar(k);
    _qd.identity().slerp(c.q, k);
    this._moveDriven(_vd, _qd);
    c.e.multiplyScalar(1 - k);
    c.q.premultiply(_qd.invert());
    c.left -= dt;
    if (c.left <= 0) this.vcorrect = null;
  }

  // Moved by e and turned by q (about its own middle), with where it was
  // as each input went, so the next comparison counts what is already put right.
  _moveDriven(e, q) {
    const b = this.driving.body;
    b.position.add(e);
    b.quaternion.premultiply(q).normalize();
    b.velocity?.applyQuaternion(q);
    b.updateDerived?.();
    for (const h of this.vhistory) {
      h.p.add(e);
      h.q.premultiply(q).normalize();
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
    const [look, range, gun, lay = null] = this._aimOut(pc);
    this.ws.send(JSON.stringify(encodeInput({ seq: this.seq, held, pressed: [...this.pressed], look, range, gun, lay, deploy: this.me.alive ? null : this.deployAt })));
    this.pressed.clear();
    const b = this.me.body;
    this.history.push({ seq: this.seq, x: b.x, y: b.y, z: b.z });
    if (this.history.length > 240) this.history.shift();
    const v = this.driving;
    if (v) {
      this.vhistory.push({ seq: this.seq, p: v.body.position.clone(), q: v.body.quaternion.clone() });
      if (this.vhistory.length > 240) this.vhistory.shift();
    }
  }

  // --- Everyone else, between snapshots ---------------------------------------------------

  update(dt) {
    this._correct(dt);
    this._driveCheck();
    this._correctVehicle(dt);
    const snaps = this.snaps;
    if (!snaps.length) return;
    // The moment in the past that is shown, and the two snapshots either side
    // of it (shown.js).
    const at = this.shown.at(snaps, dt);
    this._vehiclesAt(at.a, at.b, at.t);
    this._soldiersAt(at.a, at.b, at);
  }

  _soldiersAt(a, b, at) {
    const dt = at.dt;
    // (Turning and looking stop at the newest snapshot; only his going carries on past it.)
    const t = Math.min(1, at.t);
    const prev = new Map(a.soldiers.map((x) => [x.id, x]));
    for (const nb of b.soldiers) {
      const s = this.puppets.get(nb.id);
      if (!s) continue;
      const na = prev.get(nb.id) || nb;
      const bd = s.body;
      // Where he is, and his speed for the walking and running of his legs.
      this.shown.place(bd, na, nb, at);
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

  // An update with every vehicle: any we have that it doesn't (a wreck the
  // server took away) is gone.
  _dropGone(snap) {
    const g = this.game;
    const here = new Set(snap.vehicles.map((x) => x.id));
    for (const [id, v] of this.vehicles) {
      if (here.has(id) || v === this.me.vehicle) continue;
      this.vehicles.delete(id);
      v.removeFromWorld?.();
      const i = g.vehicles.indexOf(v);
      if (i >= 0) g.vehicles.splice(i, 1);
    }
  }

  // Vehicles between two updates. (One left out of an update hasn't moved: it
  // stays where it is.)
  _vehiclesAt(a, b, t0) {
    const g = this.game;
    // (Turning stops at the newest snapshot; going carries on a moment past it.)
    const t = Math.min(1, t0);
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
      // The one he drives goes as it goes here: only its damage, fire and
      // guns are the server's (where it is: _driven).
      if (v === this.driving) {
        v.hp = nb.hp;
        this._wrecked(v, nb.alive);
        if (nb.state) applyVehicleState(v, nb.state, { motion: false });
        continue;
      }
      const na = prev.get(nb.id) || nb;
      const p = v.body.position;
      // (Carried on past the newest snapshot the way it was going, unless it was put somewhere new; its turning stops there.)
      const tp = Math.hypot(nb.x - na.x, nb.y - na.y, nb.z - na.z) > 6 ? t : t0;
      p.set(lerp(na.x, nb.x, tp), lerp(na.y, nb.y, tp), lerp(na.z, nb.z, tp));
      const q = v.body.quaternion;
      q.set(...na.q);
      q.slerp(v._qb || (v._qb = q.clone()), 0);
      v._qb.set(...nb.q);
      q.slerp(v._qb, t);
      v.body.updateDerived?.();
      v.turretYaw = lerpAngle(na.turretYaw, nb.turretYaw, t);
      v.gunElev = lerp(na.gunElev, nb.gunElev, t);
      v.hp = nb.hp;
      this._wrecked(v, nb.alive);
      // Its speed, engine, damage and guns, as the server has them (puppets
      // aren't run here): for the HUD of whoever rides in it, and its sound.
      if (nb.state && v._state !== nb.state) {
        v._state = nb.state;
        applyVehicleState(v, nb.state);
      }
    }
    // One that just stopped (in the earlier update, not this one): where it stopped.
    const inB = new Set(b.vehicles.map((x) => x.id));
    for (const na of a.vehicles) {
      const v = inB.has(na.id) ? null : this.vehicles.get(na.id);
      if (!v || v === this.driving) continue;
      v.body.position.set(na.x, na.y, na.z);
      v.body.quaternion.set(...na.q);
      v.body.updateDerived?.();
      v.turretYaw = na.turretYaw;
      v.gunElev = na.gunElev;
    }
  }

  // Knocked out (the server says so): burnt black, as offline. (Its blast is
  // one of the server's events.)
  _wrecked(v, alive) {
    if (v.alive && !alive && !v.isBike) charModel(v);
    v.alive = alive;
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
      // Closed for coming back in (enemies on it) as the server has it, so the
      // deploy screen offers the points the server will put him at.
      if (mp.threat) {
        mp.threat[0] = mp.threat[1] = -99;
        if (p.closed && p.owner !== null) mp.threat[p.owner] = this.game.time;
      }
    }
    mode.timeLeft = snap.clock.timeLeft;
    mode.suddenDeath = snap.clock.suddenDeath;
  }

  // --- What happened ----------------------------------------------------------------------

  _events(list) {
    const g = this.game;
    for (const e of list) {
      if (e[0] === 'f') {
        // A round fired: drawn. The player's own already were, as he fired,
        // except a vehicle machine gun's (no weapon id) in a vehicle that is
        // not run here (a seat in one someone else drives): those fire only on
        // the server. (In the vehicle he drives the machine gun fires here too:
        // drawing the server's as well gave every round twice, with its flash,
        // its report and its strike, and the game stuttered.)
        const [, who, wid, x, y, z, vx, vy, vz, tracer, sound, aref] = e;
        const mine = who === this.me.id;
        if (mine && (wid !== '' || (this.driving && this.driving === this.me.vehicle))) continue;
        const s = mine ? this.me : this.puppets.get(who);
        const def = WEAPONS[wid];
        // (A tank's shell or a vehicle's machine gun: named by the server.)
        const ammo = ammoOf(aref) || AMMO[def?.ammo] || AMMO[s?.weapon?.def?.ammo];
        if (!ammo) continue;
        const px = x / 100,
          py = y / 100,
          pz = z / 100;
        g.projectiles.fire({ x: px, y: py, z: pz, vx: vx / 10, vy: vy / 10, vz: vz / 10, ammo, owner: s || null, weapon: def || { name: wid }, tracer: !!tracer, visual: true });
        if (s?.view && !mine) s.view.recoil = 1;
        const sp = Math.hypot(vx, vy, vz) || 1;
        if (!ammo.thrown) {
          g.effects.muzzle(px, py, pz, vx / sp, vy / sp, vz / sp, 0.8);
          const report = sound || def?.sound;
          if (report) g.audio?.gunshot?.(report, px, py, pz, { source: `s${who}`, isLocal: mine });
        }
      } else if (e[0] === 'd') {
        const [, who, by, wid] = e;
        const victim = who === this.me.id ? this.me : this.puppets.get(who);
        const killer = by === this.me.id ? this.me : this.puppets.get(by);
        if (!victim) continue;
        victim.killer = killer || null;
        g.hud?.killFeed?.(killer || null, victim, { weapon: WEAPONS[wid] || { name: String(wid || '') } });
        if (killer === this.me && victim !== this.me) g.hud?.killConfirm?.(victim.name);
      } else if (e[0] === 'h') {
        // He was hit (the server decides): the red, the jolt, the grunt, and
        // where it came from.
        const [, who, amount, x, z] = e;
        if (who !== this.me.id || !this.me.alive) continue;
        g.hurt?.(amount);
        if (x != null && z != null) g.hud?.shotFrom?.(x / 100, z / 100, 'hit', amount / 40);
      } else if (e[0] === 'x') {
        const [, x, y, z, size] = e;
        g.effects.explosion(x / 100, y / 100, z / 100, size / 10);
        // (A shell's burst from 12.5 up, as offline: game.js explode. It was 25, so a
        // tank's explosive shell sounded like a hand grenade online.)
        g.audio?.explosion?.(size >= 12.5 ? 'shellExplosion' : 'grenadeExplosion', x / 100, y / 100, z / 100);
      } else if (e[0] === 'vh') {
        // The vehicle he is in was struck: where from, and a jolt.
        const [, vid, how, big, x, z, by] = e;
        if (this.me.vehicle?.id !== vid || by === this.me.id) continue;
        g.hud?.shotFrom?.(x / 100, z / 100, big || how === 2 ? 'hit' : 'near', big ? 1 : 0.6);
        if (!big && how !== 2) continue;
        const vc = g.player?.vehicleCtl;
        if (vc) {
          vc.shake = Math.max(vc.shake || 0, how === 2 ? 1 : 0.6);
          vc.shakeT = 0;
        }
        const p = this.me.vehicle.body.position;
        g.audio?.impact?.('armor', p.x, p.y, p.z, 20000);
      } else if (e[0] === 've') {
        const [, vid, kind, by] = e;
        if (by === this.me.id) g.hud?.flash?.(kind === 'track' ? 'Track destroyed' : kind === 'fire' ? 'Target on fire' : kind, 2);
        // (His own tank's track or a fire: the tank's picture shows it, ui/hud.js _updateTank.)
        if (this.me.vehicle?.id === vid && this.me.vehicle.def.kind !== 'tracked') g.hud?.flash?.(kind === 'fire' ? 'We are on fire!' : kind, 2.5);
      }
    }
  }

  // Where he points: on foot his look, and his gun's line off it (with his
  // sway and his sight's setting, as his rounds are drawn here: the server's
  // leave along it too); in a vehicle the gun of his seat (and a tank
  // gunner's sight range), as his own controls set it.
  _aimOut(pc) {
    const v = this.me.vehicle;
    const role = v ? pc.vehicleCtl.role : null;
    if (role === 'gunner' && v.aim) return [[v.aim.yaw, v.aim.pitch], v.sightRange ?? null, null, v.layRange ?? null];
    if (role === 'bowMg' && v.bowAim) return [[v.bowAim.yaw, v.bowAim.pitch], null, null];
    if (role === 'sidecarMg' && v.mgAim) return [[v.mgAim.yaw, v.mgAim.pitch], null, null];
    return [[pc.look.yaw, pc.look.pitch], null, pc.gunOffset?.() ?? null];
  }

  // A line of chat to his side, or to everyone (all).
  say(text, all = false) {
    try {
      this.ws.send(JSON.stringify({ k: 't', text, all }));
    } catch {
      /* gone */
    }
  }

  // Leaving before the end: the server works out his rewards first (up to a few
  // seconds' wait for them).
  leave() {
    this.leftOnPurpose = true;
    if (this.reward || this.closed) return Promise.resolve(this.reward);
    try {
      this.ws.send(JSON.stringify({ k: 'l' }));
    } catch {
      return Promise.resolve(null);
    }
    return new Promise((ok) => {
      this._left = () => ok(this.reward);
      setTimeout(() => ok(this.reward), 6000);
    });
  }

  close() {
    this.closed = true;
    this.leftOnPurpose = true;
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
