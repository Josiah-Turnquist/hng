// Close combat: a blow with a knife, bayonet, spade or bat, the same for the
// player and the bots.
//
// A blow takes def.attack.period seconds; def.attack.hit seconds in, it lands:
// a short reach test from the eyes along where he looks (def.reach, 1 to 1.4 m)
// against the hit zones of the men in front of him (the same capsules bullets
// strike, hitboxes.js), fanned a little to the sides and up and down as a real
// swing or thrust sweeps more than a line. The nearest man struck takes the
// blow's damage for the zone hit (def.damage: head, body, limb); a wall in the
// way stops it. The first- and third-person motions read s.melee:
//   { w, def, t (s since the blow started), struck, back }
// back: the slot to go back to afterwards (a quick blow with the melee key from
// whatever was in hand), or -1.
import { raycastSoldier } from './hitboxes.js';
import { RayHit } from '../physics/collision.js';

// Swish, flesh and wall sounds by kind of weapon (audio/recipes/foley.js).
export const MELEE_SOUNDS = {
  blade: { swing: 'swishLight', hit: 'stabHit', wall: 'bladeWall' },
  spade: { swing: 'swishHeavy', hit: 'spadeHit', wall: 'bladeWall' },
  bat: { swing: 'swishHeavy', hit: 'batHit', wall: 'batWall' },
};

// The rays of the reach test, as [yaw, pitch] off the line of sight (rad), in
// the order they are tried: straight ahead first. A thrust sweeps little; a
// swing from the shoulder crosses more of the view.
const FAN = {
  stab: [[0, 0], [0.09, 0], [-0.09, 0], [0, -0.12], [0, 0.08]],
  swing: [[0, 0], [0.14, 0], [-0.14, 0], [0, -0.14], [0, 0.1], [0.28, -0.05], [-0.28, -0.05]],
};

// Which damage a hit zone takes (def.damage).
export function zoneClass(part) {
  if (part === 'head' || part === 'neck') return 'head';
  if (part === 'chest' || part === 'abdomen' || part === 'pelvis') return 'body';
  return 'limb';
}

// The soldier's close-combat weapon (his slot 6), or null.
export function meleeOf(s) {
  const w = s.weapons[5];
  if (w?.def.type === 'melee') return w;
  return s.weapons.find((x) => x?.def.type === 'melee') || null;
}

export function canAttack(s) {
  return s.alive && !s.vehicle && !s.melee && !s.throwing && !s.action && !s.body?.sprinting;
}

// Start a blow with close-combat weapon w (in his hands, or taken up for a
// quick blow: then back is the slot to return to).
export function startAttack(s, w, { back = -1 } = {}) {
  if (!w || w.def.type !== 'melee' || !canAttack(s)) return false;
  const g = s.game;
  s.melee = { w, def: w.def, t: 0, struck: false, back };
  const mine = s === g?.player?.soldier;
  // Each blow counts as a shot for his ribbons.
  s.tally?.shot(w.def, s);
  const snd = MELEE_SOUNDS[w.def.sound] || MELEE_SOUNDS.blade;
  g?.audio?.play?.(snd.swing, mine ? null : { x: s.body.x, y: s.body.y + 1.3, z: s.body.z }, { volume: mine ? 0.6 : 0.8, rate: w.def.style === 'stab' ? 1.15 : 1 });
  s.lastShotTime = g?.time ?? 0;
  return true;
}

// Per simulation step (from Soldier.update).
export function updateMelee(game, s, dt) {
  const m = s.melee;
  if (!m) return;
  if (!s.alive || s.vehicle) {
    s.melee = null;
    return;
  }
  m.t += dt;
  if (!m.struck && m.t >= m.def.attack.hit) {
    m.struck = true;
    m.result = strike(game, s, m.def);
  }
  if (m.t >= m.def.attack.period) {
    s.melee = null;
    // A quick blow: back to what he had in his hands.
    if (m.back >= 0 && s.weapons[m.back]) {
      if (s === game.player?.soldier && game.player._requestSwitch) game.player._requestSwitch(m.back);
      else s.current = m.back;
    }
  }
}

// How far through the blow (0 .. 1), for the third-person motion.
export function meleeActionT(m) {
  return Math.min(1, m.t / m.def.attack.period);
}

const _ray = new RayHit();

// The reach test and the blow: { target, part, t, dmg } when it struck a man,
// { wall: true } when it struck something solid, or null.
export function strike(game, s, def) {
  const b = s.body;
  const eye = b.eyePosition({ x: 0, y: 0, z: 0 });
  const reach = def.reach;
  const coll = game.world?.collision;
  let best = null,
    wallT = Infinity;
  for (const [dyaw, dpitch] of FAN[def.style] || FAN.stab) {
    const yaw = s.yaw + dyaw,
      pitch = s.pitch + dpitch;
    const cp = Math.cos(pitch);
    const dx = -Math.sin(yaw) * cp,
      dy = Math.sin(pitch),
      dz = -Math.cos(yaw) * cp;
    // Walls, floors, the ground: the blow goes no further.
    let max = reach;
    if (coll && coll.raycast(eye.x, eye.y, eye.z, dx, dy, dz, reach, _ray)) {
      max = _ray.t;
      if (dyaw === 0 && dpitch === 0) wallT = max;
    }
    let near = null;
    for (const o of game.soldiers) {
      if (o === s || !o.alive || o.team === s.team) continue;
      if (o.vehicle && o.vehicle.def?.kind === 'tracked') continue;
      const ob = o.body;
      // (Quick reject: nobody within reach and a body's height.)
      if ((ob.x - eye.x) ** 2 + (ob.z - eye.z) ** 2 > (reach + 1) ** 2) continue;
      const h = raycastSoldier(o, eye.x, eye.y, eye.z, dx, dy, dz, max);
      if (h && h.t <= max && (!near || h.t < near.t)) near = { ...h, target: o, dx, dy, dz };
    }
    if (near) {
      best = near;
      break;
    }
  }
  if (!best) {
    if (wallT < reach) {
      const snd = MELEE_SOUNDS[def.sound] || MELEE_SOUNDS.blade;
      const mine = s === game.player?.soldier;
      game.audio?.play?.(snd.wall, mine ? null : { x: eye.x, y: eye.y, z: eye.z }, { volume: 0.7 });
      return { wall: true, t: wallT };
    }
    return null;
  }
  const o = best.target;
  const part = best.part;
  const dmg = def.damage[zoneClass(part)];
  const x = eye.x + best.dx * best.t,
    y = eye.y + best.dy * best.t,
    z = eye.z + best.dz * best.t;
  // He was struck from this side (the ragdoll falls away from it), and it
  // stops whatever he was doing.
  o.lastHitTime = game.time;
  o.lastHitDir = { x: -best.dx, z: -best.dz };
  o.action = null;
  o.damage(dmg, { kind: 'melee', attacker: s, weapon: def, part, headshot: part === 'head' });
  const snd = MELEE_SOUNDS[def.sound] || MELEE_SOUNDS.blade;
  game.audio?.play?.(snd.hit, { x, y, z }, { volume: 0.9 });
  game.effects?.impact?.({ x, y, z, nx: best.nx, ny: best.ny, nz: best.nz, dirX: best.dx, dirY: best.dy, dirZ: best.dz, energy: 60, effect: 'blood' });
  if (s === game.player?.soldier) game.hud?.hitMarker?.(o.alive ? 1 : 2);
  if (o === game.player?.soldier) game.hud?.shotFrom?.(b.x, b.z, 'hit', dmg / 40);
  o.brain?.shotAt?.(s);
  return { target: o, part, t: best.t, dmg };
}
