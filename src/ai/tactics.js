// Infantry tactics the bots share: finding cover to fight from, fireteams that
// come at an objective from different sides, passing on where an enemy is, and
// the throw that lands a grenade where they want it.
//
//   findCover(game, s, threat, opts)  // a spot to fight (or hide) from, or null
//   coverHolds(game, spot, threat)    // is that spot still hidden from the threat?
//   fireteam(game, s)                 // { index, side, leader } of s's fireteam
//   callout(game, s, enemy)           // tell comrades close by where an enemy is
//   leavesBetween(coll, a.., b..)     // meters of leaves on a sight line; do they hide b?
//   grenadeLob(hand, target, vmax)    // launch velocity for a lob, or null
import { STANCE } from '../actors/body.js';
import { FLAG_SIGHT, RayHit } from '../physics/collision.js';

const _hit = new RayHit();
const _leaves = { dense: 0 };

// Bushes, shrubs and hedges hide a man completely beyond a few meters (as they
// do on screen): this many meters of them on a sight line
// (CollisionWorld.foliageAlong, dense) and the line is blocked, unless it is
// shorter than SEE_THROUGH_LEAVES. Thinner leaves (tree crowns) slow spotting.
export const THICK_LEAVES = 0.3;
export const SEE_THROUGH_LEAVES = 6;

// Meters of leaves from a to b ({ total, dense }) and whether they hide b.
export function leavesBetween(coll, ax, ay, az, bx, by, bz, out = { total: 0, dense: 0, hides: false }) {
  out.total = coll.foliageAlong(ax, ay, az, bx, by, bz, _leaves);
  out.dense = _leaves.dense;
  out.hides = out.dense >= THICK_LEAVES && Math.hypot(bx - ax, by - ay, bz - az) > SEE_THROUGH_LEAVES;
  return out;
}
const _lb = { total: 0, dense: 0, hides: false };

// Eye height by stance (stand, crouch, prone) and the heights an enemy would
// see of a soldier: head and chest (body.js STANCE_INFO).
const EYE = [1.64, 1.08, 0.32];
const BODY = [
  [1.5, 1.0],
  [1.15, 0.6],
  [0.32, 0.18],
];

// Nothing solid on the line from a to b, nor a thick bush or hedge (thinner
// leaves don't count: they hide a man only partly, see the bots' spotting).
function clear(coll, ax, ay, az, bx, by, bz) {
  const dx = bx - ax,
    dy = by - ay,
    dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.4) return true;
  if (coll.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.3, _hit, FLAG_SIGHT, true)) return false;
  return len <= SEE_THROUGH_LEAVES || !leavesBetween(coll, ax, ay, az, bx, by, bz, _lb).hides;
}

// Hidden from the eye e (head and chest both out of sight) at (x, y, z) in a stance.
export function hiddenAt(coll, e, x, y, z, stance) {
  const [hh, ch] = BODY[stance];
  return !clear(coll, e.x, e.y, e.z, x, y + hh, z) && !clear(coll, e.x, e.y, e.z, x, y + ch, z);
}

// From (x, y, z) in a stance, leaning lean metres to the side (+ = right of the
// line to t), can the eyes see the point t?
export function seesFrom(coll, x, y, z, stance, t, lean = 0) {
  let ex = x,
    ez = z;
  if (lean) {
    const dx = t.x - x,
      dz = t.z - z;
    const d = Math.hypot(dx, dz) || 1;
    ex += (-dz / d) * lean;
    ez += (dx / d) * lean;
  }
  return clear(coll, ex, y + EYE[stance] - (lean ? 0.06 : 0), ez, t.x, t.y, t.z);
}

// Walkable cells with something solid beside them (walls, fences, rocks,
// wrecks): where cover can be. Worked out once for each navigation grid.
function edgeMask(nav) {
  if (nav._edgeMask) return nav._edgeMask;
  const n = nav.n;
  const m = new Uint8Array(n * n);
  const c = nav.cost;
  for (let iz = 1; iz < n - 1; iz++)
    for (let ix = 1; ix < n - 1; ix++) {
      const i = iz * n + ix;
      if (!c[i] || c[i] >= 30) continue;
      // Bits: blocked to +x, -x, +z, -z.
      const bits = (c[i + 1] ? 0 : 1) | (c[i - 1] ? 0 : 2) | (c[i + n] ? 0 : 4) | (c[i - n] ? 0 : 8);
      m[i] = bits;
    }
  return (nav._edgeMask = m);
}

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// A spot to fight from within `radius` m: hidden when low (crouched or prone)
// and able to see the threat when up (standing or crouched), or hidden standing
// behind a corner it can lean out from. With fight: false any spot hidden
// standing will do (to reload, bandage or wait out heavy fire).
// threat: { x, y, z } of the enemy's eyes. away: > 0 prefers spots further
// from the threat (falling back). toward: { x, z } to take only spots at least
// 3 m nearer to it (moving up). taken: spots comrades already use.
// Returns { x, y, z, low, high, lean } (stances, lean in m) or null.
export function findCover(game, s, threat, { radius = 14, tries = 8, fight = true, away = 0, toward = null, taken = null } = {}) {
  const nav = game.nav;
  if (!nav) return null;
  const coll = game.world.collision;
  const mask = edgeMask(nav);
  const b = s.body;
  const n = nav.n,
    cell = nav.cell;
  const r = Math.ceil(radius / cell);
  const ci = nav.index(b.x, b.z);
  if (ci < 0) return null;
  const cx = ci % n,
    cz = Math.floor(ci / n);
  const tdx = threat.x - b.x,
    tdz = threat.z - b.z;
  const tdist = Math.hypot(tdx, tdz) || 1;
  const goal0 = toward ? Math.hypot(toward.x - b.x, toward.z - b.z) : 0;
  // Candidates: edge cells whose solid side faces the threat, nearest first.
  const cand = [];
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      const ix = cx + dx,
        iz = cz + dz;
      if (ix < 1 || iz < 1 || ix >= n - 1 || iz >= n - 1) continue;
      const i = iz * n + ix;
      const bits = mask[i];
      if (!bits) continue;
      const x = nav.cellX(i),
        z = nav.cellZ(i);
      const d = Math.hypot(x - b.x, z - b.z);
      if (d > radius) continue;
      const ux = threat.x - x,
        uz = threat.z - z;
      const ud = Math.hypot(ux, uz) || 1;
      if (ud < 6) continue; // not right under the enemy's nose
      let facing = -1;
      for (let k = 0; k < 4; k++) if (bits & (1 << k)) facing = Math.max(facing, (SIDES[k][0] * ux + SIDES[k][1] * uz) / ud);
      if (facing < 0.2) continue;
      if (taken && taken.some((t) => Math.hypot(t.x - x, t.z - z) < 2.5)) continue;
      const gain = toward ? goal0 - Math.hypot(toward.x - x, toward.z - z) : 0;
      if (toward && gain < 3) continue;
      // Rough worth: near us, solid side toward the enemy, and forward or back as asked.
      const fwd = -((x - b.x) * tdx + (z - b.z) * tdz) / tdist; // > 0: further from the threat
      const score = -d * 0.6 + facing * 3 + fwd * away * 0.4 - (ud < 12 ? 3 : 0) + Math.min(gain, 12) * 0.8;
      cand.push({ i, x, z, d, score });
    }
  if (!cand.length) return null;
  cand.sort((a, c) => c.score - a.score);
  let best = null,
    bestScore = -Infinity;
  for (let k = 0; k < Math.min(tries, cand.length); k++) {
    const c = cand[k];
    // Stand a little out from the cell's middle, toward the solid side facing the enemy.
    const y = nav.floorY[c.i];
    let spot = null;
    if (fight) {
      if (hiddenAt(coll, threat, c.x, y, c.z, STANCE.CROUCH) && seesFrom(coll, c.x, y, c.z, STANCE.STAND, threat)) spot = { low: STANCE.CROUCH, high: STANCE.STAND, lean: 0, worth: 8 };
      else if (hiddenAt(coll, threat, c.x, y, c.z, STANCE.PRONE) && seesFrom(coll, c.x, y, c.z, STANCE.CROUCH, threat)) spot = { low: STANCE.PRONE, high: STANCE.CROUCH, lean: 0, worth: 6 };
      else if (hiddenAt(coll, threat, c.x, y, c.z, STANCE.STAND)) {
        // Behind a corner: lean out to one side or the other.
        for (const lean of [0.38, -0.38])
          if (seesFrom(coll, c.x, y, c.z, STANCE.STAND, threat, lean)) {
            spot = { low: STANCE.STAND, high: STANCE.STAND, lean, worth: 7 };
            break;
          }
      }
    } else if (hiddenAt(coll, threat, c.x, y, c.z, STANCE.STAND)) spot = { low: STANCE.STAND, high: STANCE.STAND, lean: 0, worth: 6 };
    else if (hiddenAt(coll, threat, c.x, y, c.z, STANCE.CROUCH)) spot = { low: STANCE.CROUCH, high: STANCE.CROUCH, lean: 0, worth: 4 };
    if (!spot) continue;
    const score = c.score + spot.worth;
    if (score > bestScore) {
      bestScore = score;
      best = { x: c.x, y, z: c.z, low: spot.low, high: spot.high, lean: spot.lean };
    }
  }
  return best;
}

// Does the spot still hide a man crouched (or as low as it was chosen for) from the threat?
export function coverHolds(game, spot, threat) {
  return hiddenAt(game.world.collision, threat, spot.x, spot.y, spot.z, spot.low);
}

// Fireteams of three in each side, by soldier id: a leader and the side the
// team comes at objectives from (left, straight in, right), so a side's
// attack doesn't all pile down one street. Rebuilt when the roster changes.
export function fireteam(game, s) {
  const key = `${s.team}:${game.soldiers.length}`;
  const cache = (game._fireteams ??= {});
  let teams = cache[s.team];
  if (!teams || teams.key !== key) {
    const side = game.soldiers.filter((o) => o.team === s.team).sort((a, c) => a.id - c.id);
    const map = new Map();
    side.forEach((o, k) => map.set(o, Math.floor(k / 3)));
    teams = cache[s.team] = { key, map, members: side };
  }
  const index = teams.map.get(s) ?? 0;
  const mates = teams.members.filter((o) => teams.map.get(o) === index);
  const leader = mates.find((o) => o.alive) || s;
  return { index, side: [0, -1, 1][index % 3], leader, mates };
}

// Seen an enemy: comrades within earshot learn where (they still have to see
// him themselves to shoot, but they turn that way and pick him out sooner).
export function callout(game, s, enemy, range = 60, at = null) {
  // (Where the caller saw him, or thinks he is.)
  const p = at || (enemy.isVehicle ? enemy.body.position : enemy.body);
  for (const o of game.soldiers) {
    const br = o.brain;
    if (o === s || !o.alive || o.team !== s.team || !br?.aware || o.vehicle) continue;
    if (Math.hypot(o.body.x - s.body.x, o.body.z - s.body.z) > range) continue;
    const a = br.aware.get(enemy) || 0;
    if (a < 0.6) br.aware.set(enemy, 0.6);
    if (!br.lastSeen.get(enemy)?.visible) br.lastSeen.set(enemy, { x: p.x, y: p.y, z: p.z, t: game.time, visible: false });
    if (!br.target) br.heard = { x: p.x, z: p.z, t: game.time };
  }
}

// Launch velocity that throws a grenade from e to land at t at a throw speed v
// (the flat arc; the grenade's own drag makes it fall a little short, so aim a
// touch long), and the time it takes to get there; null if too far.
export function grenadeThrow(e, t, v, g = 9.81) {
  const dx = t.x - e.x,
    dz = t.z - e.z;
  const d = Math.hypot(dx, dz) * 1.08;
  if (d < 1) return null;
  const dy = t.y - e.y;
  const k = (g * d * d) / (2 * v * v);
  const disc = d * d - 4 * k * (dy + k);
  if (disc < 0) return null;
  const u = (d - Math.sqrt(disc)) / (2 * k); // tan of the launch angle
  const th = Math.atan(u);
  const h = Math.hypot(dx, dz);
  return { vx: (dx / h) * v * Math.cos(th), vy: v * Math.sin(th), vz: (dz / h) * v * Math.cos(th), t: d / (v * Math.cos(th)) };
}

// A soldier's lob: up at about `angle` (rad) so it drops in steeply (over low
// cover, and it doesn't roll far), as hard as that needs; flatter and as hard as
// he can (vmax) when it's further than that reaches. Null if out of reach.
export function grenadeLob(e, t, vmax, angle = 0.66, g = 9.81) {
  const dx = t.x - e.x,
    dz = t.z - e.z;
  const h = Math.hypot(dx, dz);
  const d = h * (1 + 0.0045 * h); // (drag: further, and faster, loses more)
  if (d < 1) return null;
  const dy = t.y - e.y;
  const c = Math.cos(angle);
  const den = 2 * c * c * (d * Math.tan(angle) - dy);
  const v = den > 0 ? Math.sqrt((g * d * d) / den) : Infinity;
  if (v > vmax) return grenadeThrow(e, t, vmax, g);
  return { vx: (dx / h) * v * c, vy: v * Math.sin(angle), vz: (dz / h) * v * c, t: d / (v * c) };
}
