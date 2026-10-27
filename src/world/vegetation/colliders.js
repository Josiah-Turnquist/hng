// Collision for the vegetation (inside the battlefield only):
//   trunks       solid, stop bullets ('wood'), block sight (FLAG_DEFAULT)
//   big crowns   of trees standing in the open (field, hedge, roadside, orchard,
//                riverbank and forest-edge trees) hide what's behind them partly and
//                slow bullets a little ('foliage'); crowns inside the woods are
//                skipped (the trunks and the undergrowth are cover enough there, and
//                it keeps the box count down)
//   bushes       bullets pass through slowly ('foliage'), not solid; low bushes
//                and the undergrowth in the woods too (they hide a man crouching)
//   hedges       an earth bank ('soil': stops bullets and sight, solid) under a
//                dense hedge ('foliage': solid, bullets get through)
// Leaves are never a wall in the collision world: it turns their FLAG_SIGHT into
// FLAG_FOLIAGE, and the bots measure how much foliage is in the way
// (CollisionWorld.foliageAlong). Bushes and hedges are drawn so thick that nobody
// can see through them (box.dense): beyond a few meters they hide a man from the
// bots as from the player. Tree crowns are thinner: they only slow spotting.
import { Box, FLAG_DEFAULT, FLAG_SOLID, FLAG_BULLET, FLAG_SIGHT } from '../../physics/collision.js';
import { ROLE, isBush } from './placement.js';
import { HEDGE } from './treeGeometry.js';

// Trees standing in the open get crown boxes.
const OPEN = new Set([ROLE.field, ROLE.hedge, ROLE.roadside, ROLE.orchard, ROLE.river, ROLE.village]);

export function addVegetationColliders(collision, { plants, info, pieces, def }) {
  const stats = { trunks: 0, crowns: 0, bushes: 0, hedgeBanks: 0, hedgeTops: 0, total: 0 };
  if (!collision) return stats;
  const R = (def.playRadius ?? 760) + 25;
  const inPlay = (x, z) => x * x + z * z < R * R;
  const P = plants;
  for (let i = 0; i < P.n; i++) {
    const x = P.x[i],
      z = P.z[i];
    if (!inPlay(x, z)) continue;
    const v = P.variant[i];
    const vi = info[v];
    const s = P.s[i],
      sw = P.sw[i],
      sy = P.sy[i];
    const y = P.y[i];
    const yaw = P.yaw[i];
    const c = Math.cos(yaw),
      sn = Math.sin(yaw);
    if (isBush(v)) {
      // (Shrubs from knee height up: they hide a man lying or crouching behind
      // them. Ankle-high ones hide nothing worth a box.)
      const h = vi.top * s * sy;
      if (h < 0.4) continue;
      const hw = vi.R[0] * 0.8 * s * sw;
      const box = collision.add(new Box(x, y + h * 0.5, z, hw, h * 0.5, hw, yaw, 'foliage', FLAG_SIGHT | FLAG_BULLET));
      box.dense = true;
      stats.bushes++;
      continue;
    }
    // Trunk, from below the ground to where the crown starts: a stack of upright
    // boxes along the trunk as drawn, following its bend and its taper, each a
    // little inside the bark (a square round a round trunk would stand out at the
    // corners). Each knows its piece of trunk, so bullet holes go on the bark.
    const rt = vi.trunkR * s * sw * 0.9;
    if (rt >= 0.05) {
      const top = Math.min(Math.max(vi.crownBase, 2.5), vi.H * 0.7) * s * sy;
      const line = vi.trunk;
      if (line?.length > 1) {
        const hs = s * sw,
          vs = s * sy;
        for (let k = 0; k + 1 < line.length; k++) {
          const A = line[k],
            B = line[k + 1];
          const ya = A[1] * vs;
          if (ya >= top) break;
          // Cut the piece off where the crown starts.
          const f = Math.min(1, (top / vs - A[1]) / Math.max(1e-6, B[1] - A[1]));
          const yb = (A[1] + (B[1] - A[1]) * f) * vs;
          if (yb - ya < 0.05) continue;
          const mx = (A[0] + (B[0] - A[0]) * f * 0.5) * hs,
            mz = (A[2] + (B[2] - A[2]) * f * 0.5) * hs,
            my = (ya + yb) / 2;
          const wx = x + c * mx + sn * mz + P.lx[i] * my,
            wz = z - sn * mx + c * mz + P.lz[i] * my;
          const r = (A[3] + (B[3] - A[3]) * f * 0.5) * hs;
          const box = new Box(wx, y + my, wz, r * 0.82, (yb - ya) / 2, r * 0.82, yaw, 'wood', FLAG_DEFAULT);
          box.trunk = { x: wx, z: wz, r };
          collision.add(box);
          stats.trunks++;
        }
      } else {
        const lean = 0.5 * top;
        collision.add(new Box(x + P.lx[i] * lean, y + (top - 0.5) / 2, z + P.lz[i] * lean, rt, (top + 0.5) / 2, rt, yaw, 'wood', FLAG_DEFAULT));
        stats.trunks++;
      }
    }
    const role = P.role[i];
    const crownR = vi.R[0] * s * sw;
    if (OPEN.has(role) && crownR > 3) {
      // Crown center, rotated with the tree.
      const ox = vi.C[0] * s * sw,
        oz = vi.C[2] * s * sw;
      const cx = x + c * ox + sn * oz,
        cz = z - sn * ox + c * oz;
      collision.add(new Box(cx, y + vi.C[1] * s * sy, cz, crownR * 0.68, vi.R[1] * s * sy * 0.68, vi.R[2] * s * sw * 0.68, yaw, 'foliage', FLAG_SIGHT | FLAG_BULLET));
      stats.crowns++;
    }
  }
  // Hedges: earth bank and the hedge on top.
  // Each piece's ground is a line (tilted with roll) within lo..hi of it.
  for (const p of pieces) {
    if (!inPlay(p.cx, p.cz)) continue;
    const hx = p.len / 2 + 0.3;
    const bankTop = p.hi + HEDGE.bankH * p.hs;
    const bankBot = p.lo - 0.4;
    collision.add(new Box(p.cx, p.cy + (bankTop + bankBot) / 2, p.cz, hx, (bankTop - bankBot) / 2, 0.95 * p.ws, p.yaw, 'soil', FLAG_SOLID | FLAG_BULLET | FLAG_SIGHT, 0, p.roll));
    stats.hedgeBanks++;
    const top = (HEDGE.coreBottom + HEDGE.coreH + 0.15) * p.hs + (p.lo + p.hi) / 2;
    const bot = bankTop - 0.05;
    if (top > bot + 0.3) {
      const box = collision.add(new Box(p.cx, p.cy + (top + bot) / 2, p.cz, hx, (top - bot) / 2, 0.68 * p.ws, p.yaw, 'foliage', FLAG_SOLID | FLAG_SIGHT | FLAG_BULLET, 0, p.roll));
      box.dense = true;
      stats.hedgeTops++;
    }
  }
  stats.total = stats.trunks + stats.crowns + stats.bushes + stats.hedgeBanks + stats.hedgeTops;
  return stats;
}
