// The messages between a player's browser and the game server (docs/
// MULTIPLAYER.md). Plain JSON with short keys and whole numbers, so they are
// small and easy to read when something goes wrong. Works in the browser and
// in Node.
//
// From the browser, about 30 a second:
//   input   { k: 'i', q: number, h: [held actions], p: [actions pressed since the last], l: [yaw, pitch], w: wheel }
//           actions by their number in ACTION_LIST (names, not keys: the
//           player's own key settings stay in the browser); the look as
//           where he faces (not mouse movement: sensitivity stays a browser
//           setting).
// From the server:
//   welcome { k: 'w', v: PROTOCOL_VERSION, you: soldier id, map, seed, side }
//   roster  { k: 'r', s: [[id, team, name, faction, cls, look seed, variant, loadout]] }   who is in the battle
//           (look: the face and uniform; a bot's comes from his number, as now)
//   snapshot{ k: 's', t: tick, tm: battle time, s: soldiers, v: vehicles, p: points, m: [clock tenths, sudden death], e: events, a: last input seq applied }
//
//   encodeInput(frame) / decodeInput(msg)
//   new RemoteInput()       // the server's stand-in for a player's keyboard and mouse
//   snapshot(game, tick)    // the battle as the server sends it
//   readSnapshot(msg)       // and back into objects, in the browser
//   watchEvents(game)       // shots, deaths and blasts as they happen: .take() empties the list
//   stateHash(game)         // a short fingerprint of the battle, for record and playback
import { DEFAULT_BINDINGS } from '../core/input.js';
import { AMMO } from '../weapons/ammo.js';
import { SHELLS } from '../vehicles/defs.js';

// (2: the hello names the soldier; rewards 'g', leaving 'l', a vehicle's aim.
// 3: the map key, a new action at the end of the list; how hard a soldier
// bleeds; which points are closed for coming back in; a vehicle's speed,
// engine, damage and guns, vehicleState.)
export const PROTOCOL_VERSION = 4;
export const ACTION_LIST = Object.keys(DEFAULT_BINDINGS);
const ACTION_NO = Object.fromEntries(ACTION_LIST.map((a, i) => [a, i]));

// Whole numbers: centimetres for places, ten-thousandths of a radian for angles.
const cm = (x) => Math.round(x * 100);
const ang = (a) => Math.round(a * 10000);

// --- Inputs ----------------------------------------------------------------------

// deploy: while down, the point he chose to come back in at (its id).
// In a vehicle, look is where the gun of his seat points, and range a tank
// gunner's sight setting (m).
export function encodeInput({ seq, held = [], pressed = [], look = [0, 0], wheel = 0, deploy = null, range = null }) {
  const m = { k: 'i', q: seq, h: [...held].map((a) => ACTION_NO[a]).filter((n) => n != null), p: [...pressed].map((a) => ACTION_NO[a]).filter((n) => n != null), l: [ang(look[0]), ang(look[1])], w: wheel | 0 };
  if (deploy) m.d = String(deploy);
  if (range != null) m.r = Math.round(range);
  return m;
}

export function decodeInput(m) {
  if (!m || m.k !== 'i' || !Array.isArray(m.h) || !Array.isArray(m.p) || !Array.isArray(m.l)) return null;
  const name = (n) => (Number.isInteger(n) ? ACTION_LIST[n] : undefined);
  return {
    seq: Number(m.q) || 0,
    held: new Set(m.h.map(name).filter(Boolean)),
    pressed: new Set(m.p.map(name).filter(Boolean)),
    look: [Number(m.l[0]) / 10000 || 0, Math.max(-1.6, Math.min(1.6, Number(m.l[1]) / 10000 || 0))],
    wheel: Math.max(-5, Math.min(5, Number(m.w) || 0)),
    deploy: typeof m.d === 'string' && m.d.length <= 8 ? m.d : null,
    range: Number.isFinite(m.r) ? Math.max(0, Math.min(5000, m.r)) : null,
  };
}

// The server's stand-in for a player's keyboard and mouse: answers the same
// questions as core/input.js (is, hit, up, takeWheel) from his input frames,
// so the same controls can drive a soldier on the server. A press between two
// steps counts once; the look is where he faces (look), so takeMouse is still.
export class RemoteInput {
  constructor() {
    this.remote = true;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.wheel = 0;
    this.look = null;
    this.seq = 0;
  }

  apply(frame) {
    if (!frame || frame.seq <= this.seq) return false;
    this.seq = frame.seq;
    for (const a of this.down) if (!frame.held.has(a)) this.released.add(a);
    for (const a of frame.pressed) this.pressed.add(a);
    this.down = new Set(frame.held);
    this.wheel += frame.wheel;
    this.look = frame.look;
    this.range = frame.range;
    return true;
  }

  is(action) {
    return this.down.has(action);
  }
  hit(action) {
    return this.pressed.has(action);
  }
  up(action) {
    return this.released.has(action) && !this.down.has(action);
  }
  takeMouse() {
    return [0, 0];
  }
  takeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}

// --- What the server sends ------------------------------------------------------------

// Soldier flags.
const ALIVE = 1,
  AIMING = 2,
  SPRINTING = 4,
  BLEEDING = 8;

// A vehicle's state past where it is, for the HUD of whoever rides in it (and
// its sound): [speed dm/s, rpm / 10, gear, flags, damage, load tenths, effort,
// power / 10 W, guns]. flags: the engine running, on fire, on its side (and
// which side), off-road gearing, changing gear. damage: two bits a part
// (VEHICLE_PARTS; 1 hurt, 2 broken). effort: a bicycle's (EFFORTS). guns: a
// tank's main gun [round loaded, round next (1 + their place in its list, 0
// none), reload tenths, then the rounds stowed of each kind], then each machine
// gun's [rounds in the belt, belts, reload tenths].
export const VEHICLE_PARTS = ['engine', 'transmission', 'trackL', 'trackR', 'turret', 'gun', 'fuel', 'ammo', 'tireF', 'tireR', 'tireS'];
const EFFORTS = ['idle', 'coast', 'cruise', 'sprint', 'spent', 'walk'];
const V_ENGINE = 1,
  V_FIRE = 2,
  V_FALLEN = 4,
  V_FALLEN_RIGHT = 8,
  V_OFFROAD = 16,
  V_SHIFTING = 32;
const tenths = (t) => Math.max(0, Math.round((t || 0) * 10));

export function vehicleState(v) {
  const flags = (v.engineOn ? V_ENGINE : 0) | (v.fire > 0 ? V_FIRE : 0) | (v.fallen ? V_FALLEN : 0) | (v.fallen > 0 ? V_FALLEN_RIGHT : 0) | (v.offroad ? V_OFFROAD : 0) | (v.shiftTimer > 0 ? V_SHIFTING : 0);
  let damage = 0;
  VEHICLE_PARTS.forEach((k, i) => {
    const m = v.modules?.[k];
    if (m !== undefined && m < 1) damage += (m <= 0 ? 2 : 1) * 4 ** i;
  });
  const guns = [];
  if (v.ammoTypes) {
    const no = (id) => (id ? v.ammoTypes.indexOf(id) + 1 : 0);
    guns.push(no(v.loaded), no(v.nextAmmo), tenths(v.reloadT), ...v.ammoTypes.map((id) => v.stowed[id] | 0));
  }
  for (const mg of [v.coax, v.bowMg, v.mg]) if (mg?.def) guns.push(mg.loaded | 0, mg.belts | 0, tenths(mg.reloadT));
  const speed = Math.round((v.speed || 0) * 10);
  return [speed || 0, Math.round((v.rpm || 0) / 10), v.gear | 0, flags, damage, tenths(v.load), Math.max(0, EFFORTS.indexOf(v.effort)), Math.round((v.power || 0) / 10), guns];
}

// And back, onto a vehicle shown in the browser (a puppet: net/online.js).
export function applyVehicleState(v, st) {
  if (!Array.isArray(st) || st.length < 5) return;
  const [speed, rpm, gear, flags, damage, load = 0, effort = 0, power = 0, guns = []] = st;
  v.speed = speed / 10;
  v.rpm = rpm * 10;
  v.gear = gear;
  v.engineOn = !!(flags & V_ENGINE);
  v.fire = flags & V_FIRE ? Math.max(v.fire || 0, 1) : 0;
  v.fallen = flags & V_FALLEN ? (flags & V_FALLEN_RIGHT ? 1 : -1) : 0;
  v.offroad = !!(flags & V_OFFROAD);
  v.shiftTimer = flags & V_SHIFTING ? 0.1 : 0;
  if (v.modules) {
    VEHICLE_PARTS.forEach((k, i) => {
      if (!(k in v.modules)) return;
      const d = Math.floor(damage / 4 ** i) % 4;
      // (Hurt: how badly isn't sent; half is near enough for the smoke.)
      v.modules[k] = d === 2 ? 0 : d === 1 ? Math.min(v.modules[k] < 1 && v.modules[k] > 0 ? v.modules[k] : 0.5, 0.99) : 1;
    });
  }
  v.load = load / 10;
  if (v.isBike) {
    v.effort = EFFORTS[effort] || 'idle';
    v.power = power * 10;
  }
  if (!Array.isArray(guns)) return;
  let i = 0;
  if (v.ammoTypes) {
    const id = (n) => (n > 0 ? v.ammoTypes[n - 1] || null : null);
    v.loaded = id(guns[i++]);
    v.nextAmmo = id(guns[i++]);
    v.reloadT = (guns[i++] || 0) / 10;
    for (const k of v.ammoTypes) v.stowed[k] = guns[i++] | 0;
    v.ammoIndex = Math.max(0, v.ammoTypes.indexOf(v.nextAmmo));
  }
  for (const mg of [v.coax, v.bowMg, v.mg]) {
    if (!mg?.def || i + 3 > guns.length) continue;
    mg.loaded = guns[i++];
    mg.belts = guns[i++];
    mg.reloadT = guns[i++] / 10;
  }
}

// sent: the server's note of what it last sent of each vehicle; with it, a
// vehicle that hasn't moved or changed is left out (most are parked), unless
// full: then all are in, and the browser drops any it has that are gone (vf).
export function snapshot(game, tick, { events = [], ack = 0, sent = null, full = true } = {}) {
  const s = [];
  for (const x of game.soldiers) {
    const b = x.body;
    const flags = (x.alive ? ALIVE : 0) | (x.aiming ? AIMING : 0) | (b.sprinting ? SPRINTING : 0) | (x.bleed > 0 ? BLEEDING : 0);
    const row = [x.id, cm(b.x), cm(b.y), cm(b.z), ang(x.yaw), ang(x.pitch || 0), b.stance, flags, x.current, Math.ceil(x.health), x.vehicle ? x.vehicle.id : 0, x.seat];
    // (Bleeding: how hard, in tenths of health a second, for his own screen.)
    if (x.bleed > 0) row.push(Math.max(1, Math.round(x.bleed * 10)));
    s.push(row);
  }
  const v = [];
  for (const x of game.vehicles) {
    const p = x.body.position,
      q = x.body.quaternion;
    // (A tank's turret and gun, or a sidecar's machine gun.)
    const row = [x.id, x.def.id, cm(p.x), cm(p.y), cm(p.z), ang(q.x), ang(q.y), ang(q.z), ang(q.w), ang(x.turretYaw ?? x.mgYaw ?? 0), ang(x.gunElev ?? x.mgPitch ?? 0), Math.ceil(x.hp), x.alive ? 1 : 0, ...vehicleState(x)];
    if (sent) {
      const key = row.join(',');
      if (!full && sent.get(x.id) === key) continue;
      sent.set(x.id, key);
    }
    v.push(row);
  }
  // (closed: its side can't come back in there, enemies being on it: assault.js _spawnPoints.)
  const closed = (x) => (x.owner != null && x.threat && game.time - x.threat[x.owner] <= 10 ? 1 : 0);
  const p = (game.mode?.points || []).map((x) => [x.id, x.owner ?? -1, Math.round(x.c * 100), closed(x)]);
  const mode = game.mode || {};
  const out = { k: 's', t: tick, tm: Math.round(game.time * 1000), s, v, p, m: [Math.round((mode.timeLeft ?? 0) * 10), mode.suddenDeath ? 1 : 0], e: events, a: ack };
  if (sent) out.vf = full ? 1 : 0;
  return out;
}

export function readSnapshot(m) {
  return {
    tick: m.t,
    time: m.tm / 1000,
    soldiers: m.s.map(([id, x, y, z, yaw, pitch, stance, f, weapon, health, vehicle, seat, bleed]) => ({ id, x: x / 100, y: y / 100, z: z / 100, yaw: yaw / 10000, pitch: pitch / 10000, stance, alive: !!(f & ALIVE), aiming: !!(f & AIMING), sprinting: !!(f & SPRINTING), bleeding: !!(f & BLEEDING), bleed: f & BLEEDING ? (bleed || 10) / 10 : 0, weapon, health, vehicle, seat })),
    vehicles: m.v.map(([id, def, x, y, z, qx, qy, qz, qw, turret, gun, hp, alive, ...state]) => ({ id, def, x: x / 100, y: y / 100, z: z / 100, q: [qx / 10000, qy / 10000, qz / 10000, qw / 10000], turretYaw: turret / 10000, gunElev: gun / 10000, hp, alive: !!alive, state: state.length ? state : null })),
    points: m.p.map(([id, owner, c, closed]) => ({ id, owner: owner < 0 ? null : owner, control: c / 100, closed: !!closed })),
    clock: { timeLeft: (m.m?.[0] ?? 0) / 10, suddenDeath: !!m.m?.[1] },
    events: m.e,
    ack: m.a,
    allVehicles: m.vf !== 0,
  };
}

// The scoreboard: each soldier's kills, deaths, score and points taken, as the
// server counts them (sent when they change, at most once a second).
export function scores(game) {
  return { k: 'c', s: game.soldiers.map((x) => [x.id, x.kills || 0, x.deaths || 0, x.score || 0, x.captures || 0]) };
}

// Who is in the battle, sent when someone joins or leaves.
export function roster(game) {
  return { k: 'r', s: game.soldiers.map((x) => [x.id, x.team, x.name, x.faction, x.cls, x.look?.seed ?? x.id * 7919 + 13, x.look?.variant ?? 0, x.weapons.map((w) => w?.def.id ?? null)]) };
}

// The name a round's ammunition goes by in a message, and back.
let refs = null;
export function ammoRef(ammo) {
  if (!refs) {
    refs = new Map();
    for (const [k, a] of Object.entries(AMMO)) refs.set(a, `a:${k}`);
    for (const [k, a] of Object.entries(SHELLS)) refs.set(a, `s:${k}`);
  }
  return refs.get(ammo) ?? '';
}
export function ammoOf(ref) {
  if (typeof ref !== 'string') return null;
  return (ref.startsWith('a:') ? AMMO[ref.slice(2)] : ref.startsWith('s:') ? SHELLS[ref.slice(2)] : null) || null;
}

// Shots, deaths and blasts as they happen, for the snapshots' events:
//   ['f', shooter, weapon, x, y, z, vx, vy, vz, tracer, sound, ammo]   a round fired
//       (not grenade fragments); sound: its report (audio.js GUN_TYPES); ammo:
//       'a:<AMMO key>' or 's:<SHELLS key>' (a tank's shell, a vehicle's gun)
//   ['d', soldier, killer, weapon]                         a soldier down
//   ['x', x, y, z, size]                                   a blast
export function watchEvents(game) {
  const list = [];
  const fire = game.projectiles.fire.bind(game.projectiles);
  game.projectiles.fire = (o) => {
    const p = fire(o);
    if (!o.ammo?.fragment) list.push(['f', o.owner?.id ?? 0, o.weapon?.id ?? '', cm(o.x), cm(o.y), cm(o.z), Math.round(o.vx * 10), Math.round(o.vy * 10), Math.round(o.vz * 10), o.tracer ? 1 : 0, o.weapon?.sound ?? '', ammoRef(o.ammo)]);
    return p;
  };
  const death = game.onDeath?.bind(game);
  game.onDeath = (s, cause) => {
    list.push(['d', s.id, cause?.attacker?.id ?? 0, cause?.weapon?.id ?? cause?.kind ?? '']);
    return death?.(s, cause);
  };
  const blast = game.effects.explosion;
  game.effects.explosion = (x, y, z, size) => {
    list.push(['x', cm(x), cm(y), cm(z), Math.round(size * 10)]);
    return blast?.call(game.effects, x, y, z, size);
  };
  return {
    take() {
      return list.splice(0, list.length);
    },
  };
}

// A short fingerprint of the battle: every soldier's and vehicle's place and
// health, and the points (FNV-1a over the numbers, in hex).
export function stateHash(game) {
  let h = 0x811c9dc5;
  const mix = (n) => {
    n = Math.round(n * 1000) | 0;
    for (let i = 0; i < 4; i++) {
      h ^= (n >>> (i * 8)) & 255;
      h = Math.imul(h, 0x01000193);
    }
  };
  for (const s of game.soldiers) {
    mix(s.id);
    mix(s.alive ? 1 : 0);
    mix(s.body.x);
    mix(s.body.y);
    mix(s.body.z);
    mix(s.health);
  }
  for (const v of game.vehicles) {
    mix(v.id);
    mix(v.body.position.x);
    mix(v.body.position.z);
    mix(v.hp);
  }
  for (const p of game.mode?.points || []) mix(p.c);
  return (h >>> 0).toString(16).padStart(8, '0');
}
