// Using the medical kits and the repair wrench (weapons/items/kits.js), as in
// the original game.
//
// A first-aid kit or medic pouch treats the wounded man of your side you are
// looking at within reach (2 m), or else yourself. The dressing goes on first
// (the first fifth of the time): that stops the bleeding and spends a use, so
// a treatment cut short after it keeps what it gave; then the health comes
// back a little at a time, up to full. While you treat you can't shoot, and
// moving or being hit stops you (the soldier's action, as for a bandage).
//
// The wrench works on the vehicle you stand at and look at (within 3 m) while
// you hold fire: its health comes back a little at a time, and broken parts
// (tracks, tires, the engine, the transmission, the turret ring, the gun) are
// put right one after another, a few seconds each. Not while it burns, and a
// wreck is past repair.
//
// The player's own work feeds his Medic ribbon (game.ribbonTally): one heal
// per use, one repair per vehicle he really repaired (a tenth of its health or
// a broken part in one go at it).
import * as THREE from 'three';
import { KIT_TYPES } from '../weapons/items/kits.js';

// Parts the wrench mends, in the order it gets to them.
export const REPAIR_PARTS = ['trackL', 'trackR', 'tireF', 'tireR', 'tireS', 'engine', 'transmission', 'turret', 'gun'];
const PART_NAMES = { trackL: 'left track', trackR: 'right track', tireF: 'front tire', tireR: 'rear tire', tireS: 'sidecar tire', engine: 'engine', transmission: 'transmission', turret: 'turret', gun: 'gun' };
const APPLY = 0.2; // share of a treatment spent putting the dressing on
const SOUND_EVERY = 0.65; // s between the wrench's working sounds
const _e = { x: 0, y: 0, z: 0 };
const _p = new THREE.Vector3(),
  _pm = new THREE.Vector3(),
  _d = new THREE.Vector3(),
  _qi = new THREE.Quaternion();

export const isKit = (def) => !!def && KIT_TYPES.has(def.type);
export const isHealKit = (def) => !!def && (def.type === 'firstaid' || def.type === 'medkit');

// A first-aid kit or medic pouch he carries with a use left, or null.
export function healKitOf(s) {
  return s.weapons?.find((w) => w && isHealKit(w.def) && w.uses > 0) || null;
}

// The soldier's look: eye point and unit direction.
function look(s) {
  s.body.eyePosition(_e);
  const cp = Math.cos(s.pitch);
  return { x: _e.x, y: _e.y, z: _e.z, dx: -Math.sin(s.yaw) * cp, dy: Math.sin(s.pitch), dz: -Math.cos(s.yaw) * cp };
}

const hurt = (o) => o.bleed > 0 || o.health < o.maxHealth - 0.5;

// The wounded man of his side he is looking at within reach, or null: the
// nearest whose body (feet to eyes) passes within 40 cm of his line of sight.
export function healTarget(game, s, reach = 2) {
  const L = look(s);
  let best = null,
    bestD = Infinity;
  for (const o of game.soldiers || []) {
    if (o === s || !o.alive || o.team !== s.team || o.vehicle || !hurt(o)) continue;
    const b = o.body;
    const flat = Math.hypot(b.x - s.body.x, b.z - s.body.z);
    if (flat > reach + 0.3) continue;
    let miss = Infinity;
    for (let k = 0; k <= 4; k++) {
      const y = b.y + 0.15 + ((b.eye ?? 1.6) - 0.15) * (k / 4);
      const rx = b.x - L.x,
        ry = y - L.y,
        rz = b.z - L.z;
      const along = rx * L.dx + ry * L.dy + rz * L.dz;
      if (along <= 0) continue;
      miss = Math.min(miss, Math.sqrt(Math.max(0, rx * rx + ry * ry + rz * rz - along * along)));
    }
    if (miss <= 0.4 && flat < bestD) {
      bestD = flat;
      best = o;
    }
  }
  return best;
}

// The vehicle he is looking at within reach of his eyes (its outline box,
// def.dims), or null; burning and wrecked ones too (the caller says why it
// can't be done).
export function repairTarget(game, s, reach = 3) {
  const L = look(s);
  let best = null,
    bestT = reach;
  for (const v of game.vehicles || []) {
    if (!v.def?.dims || !v.worldToModel) continue;
    const [W, H, Ln] = v.def.dims;
    const p = v.worldToModel(_p.set(L.x, L.y, L.z), _pm);
    const d = _d.set(L.dx, L.dy, L.dz).applyQuaternion(_qi.copy(v.body.quaternion).invert());
    const t = rayBox(p, d, [-W / 2, 0, -Ln / 2], [W / 2, H, Ln / 2]);
    if (t !== null && t <= bestT) {
      bestT = t;
      best = v;
    }
  }
  return best;
}

// Distance along a ray (unit d) from p to an axis-aligned box, 0 from inside,
// or null.
function rayBox(p, d, lo, hi) {
  let t0 = 0,
    t1 = Infinity;
  for (const [o, dir, a, b] of [
    [p.x, d.x, lo[0], hi[0]],
    [p.y, d.y, lo[1], hi[1]],
    [p.z, d.z, lo[2], hi[2]],
  ]) {
    if (Math.abs(dir) < 1e-9) {
      if (o < a || o > b) return null;
      continue;
    }
    let ta = (a - o) / dir,
      tb = (b - o) / dir;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

const isPlayer = (game, s) => !!game.player && game.player.soldier === s;
const nameOf = (o) => o.name || 'him';

// Treat someone with kit w: the man given, or the one he looks at, or else
// himself. Returns the man being treated, or null (and says why to the player).
export function useKit(game, s, w, target = undefined) {
  const d = w?.def;
  if (!isHealKit(d) || !s.alive || s.action || s.vehicle) return null;
  const me = isPlayer(game, s);
  if (!(w.uses > 0)) {
    if (me) game.hud?.flash(`${d.name}: none left`);
    return null;
  }
  if (target === undefined) target = healTarget(game, s, d.reach) || s;
  if (!target.alive || !hurt(target)) {
    if (me) game.hud?.flash(target === s ? 'You are not wounded' : `${nameOf(target)} is not wounded`);
    return null;
  }
  s.action = 'kit';
  s.actionT = 0;
  s.kitUse = { w, target, dur: d.healTime, heal: d.heal, given: 0, spent: false };
  s.aiming = false;
  game.audio?.play?.('bandage', s.isPlayer ? null : s.body, { volume: 0.8 });
  return target;
}

// One step of a treatment under way (from Soldier.update, s.action 'kit').
export function updateKit(game, s, dt) {
  const k = s.kitUse;
  if (!k) {
    s.action = null;
    return;
  }
  const o = k.target;
  // The man he treats died, or is out of reach (or got in a vehicle).
  if (!o.alive || (o !== s && (o.vehicle || Math.hypot(o.body.x - s.body.x, o.body.z - s.body.z) > k.w.def.reach + 0.6))) {
    s.action = null;
    endKit(game, s);
    return;
  }
  const t = s.actionT;
  const apply = k.dur * APPLY;
  if (!k.spent && t >= apply) {
    // The dressing is on: the bleeding stops and the use is gone; the worst
    // of a wounded limb is seen to.
    k.spent = true;
    k.w.uses = Math.max(0, k.w.uses - 1);
    o.bleed = 0;
    o.body.legWound *= 0.5;
    o.armWound *= 0.5;
    if (isPlayer(game, s)) game.ribbonTally?.heal(o === s ? 'self' : 'other');
  }
  if (k.spent) {
    const rate = k.heal / (k.dur - apply);
    const add = Math.min(rate * dt, k.heal - k.given, o.maxHealth - o.health);
    if (add > 0) {
      o.health += add;
      k.given += add;
    }
  }
  if (t >= k.dur) {
    s.action = null;
    endKit(game, s);
  }
}

// A treatment over (done, or cut short): what it did, to the player.
export function endKit(game, s) {
  const k = s.kitUse;
  s.kitUse = null;
  if (!k?.spent || !isPlayer(game, s)) return;
  game.hud?.killConfirm(k.target === s ? 'yourself' : nameOf(k.target), { verb: 'Healed', points: Math.round(k.given), quiet: true });
}

// Broken (or damaged) parts of a vehicle the wrench can mend.
export function partsToMend(v) {
  return REPAIR_PARTS.filter((p) => v.modules?.[p] !== undefined && v.modules[p] < 1);
}

// Work on a vehicle with the wrench for dt seconds while fire is held (held
// false ends the work). Returns the vehicle worked on, or null.
export function workWrench(game, s, w, dt, held) {
  if (!held || !s.alive || s.vehicle || w?.def.type !== 'wrench') {
    endRepair(game, s);
    if (s.action === 'repair') s.action = null;
    return null;
  }
  const me = isPlayer(game, s);
  const v = repairTarget(game, s, w.def.reach);
  let r = s.repair;
  if (r && r.v !== v) {
    endRepair(game, s);
    r = null;
  }
  if (!v) {
    if (s.action === 'repair') s.action = null;
    if (me) game.hud?.workLine?.('Repair', 'no vehicle in reach');
    return null;
  }
  const name = v.def.name;
  if (!v.alive || v.fire > 0) {
    if (s.action === 'repair') s.action = null;
    if (me) game.hud?.workLine?.(v.alive ? 'Burning' : 'Wrecked', v.alive ? `${name}: put it out first` : name);
    return null;
  }
  const parts = partsToMend(v);
  if (!r && v.hp >= v.maxHp && !parts.length) {
    if (me) game.hud?.workLine?.('Undamaged', name);
    return null;
  }
  if (!r) r = s.repair = { v, hp0: v.hp, mended: 0, partT: 0, soundT: 0 };
  // On the move he can't work (and a hit stops him for that step).
  if (s.body.moving > 1.2) return v;
  s.action = 'repair';
  const d = w.def;
  v.hp = Math.min(v.maxHp, v.hp + v.maxHp * d.repairRate * dt);
  // One part at a time: a broken one takes the whole time, a damaged one less.
  const part = parts[0];
  if (part) {
    r.partT += dt;
    if (r.partT >= d.moduleTime * (1 - Math.max(0, v.modules[part]))) {
      if (v.modules[part] <= 0) r.mended++;
      v.modules[part] = 1;
      r.partT = 0;
      if (part === 'engine' && v.driver) v.engineOn = true;
      if (me) game.hud?.flash(`${name}: ${PART_NAMES[part]} repaired`, 1.5);
    }
  }
  r.soundT -= dt;
  if (r.soundT <= 0) {
    r.soundT = SOUND_EVERY;
    game.audio?.play?.('wrench', me ? null : s.body, { volume: 0.7 });
  }
  const done = v.hp >= v.maxHp && !partsToMend(v).length;
  if (me) game.hud?.workLine?.(done ? 'Repaired' : 'Repairing', done ? name : `${name} ${Math.floor((100 * v.hp) / v.maxHp)}%`);
  if (done) {
    endRepair(game, s);
    s.action = null;
  }
  return v;
}

// A spell of work on a vehicle over: a repair for the ribbon if it really
// mended something (a tenth of its health, or a broken part).
export function endRepair(game, s) {
  const r = s.repair;
  if (!r) return;
  s.repair = null;
  if ((r.v.hp - r.hp0 >= 0.1 * r.v.maxHp || r.mended > 0) && isPlayer(game, s)) game.ribbonTally?.repair();
}
