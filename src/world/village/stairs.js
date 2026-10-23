// Tower stairs. Both kinds are made of ramps (tilted boxes, <= 35 degrees) and flat
// landings, so people walk up them with the normal step/ground probe, and every
// landing keeps at least ~2 m of headroom.
import { WOOD, rgb, scale } from './materials.js';
import { rampCollider } from './parts.js';

const STONE_STEP = rgb(0.92, 0.9, 0.86);

// Square spiral around a solid newel inside the interior [x0,x1] x [z0,z1].
// Corridor width c, `flights` flights of `rise` each starting at y0 from corner
// `start` (0 = +x/+z corner, then +x/-z, -x/-z, -x/+z: flights climb along +x side
// first going toward -z). Returns { top, corner: [x, z] of the final landing }.
export function spiralStair(f, o) {
  const { x0, x1, z0, z1, y0, flights, rise } = o;
  const c = o.c ?? 0.9;
  const mat = o.mat || 'ashlar';
  const color = o.color || STONE_STEP;
  const corners = [
    [x1 - c / 2, z1 - c / 2],
    [x1 - c / 2, z0 + c / 2],
    [x0 + c / 2, z0 + c / 2],
    [x0 + c / 2, z1 - c / 2],
  ];
  const start = o.start ?? 0;
  const top = y0 + flights * rise;
  // Newel (solid core, walkable top).
  f.box(o.newelMat || mat, x0 + c, y0 - 0.3, z0 + c, x1 - c, top, z1 - c, { color: o.newelColor || color, col: o.colMat || 'stone', nav: false });
  for (let k = 0; k < flights; k++) {
    const a = corners[(start + k) % 4],
      b = corners[(start + k + 1) % 4];
    const ya = y0 + k * rise,
      yb = ya + rise;
    const dx = Math.sign(b[0] - a[0]),
      dz = Math.sign(b[1] - a[1]);
    const ax = a[0] + (dx * c) / 2,
      az = a[1] + (dz * c) / 2;
    const bx = b[0] - (dx * c) / 2,
      bz = b[1] - (dz * c) / 2;
    if (k > 0) landing(f, a[0], a[1], c, ya, mat, color);
    rampCollider(f, ax, ya, az, bx, yb, bz, c, 0.12, o.colMat || 'stone');
    // Visible steps.
    const n = Math.max(2, Math.round(rise / 0.19));
    for (let j = 0; j < n; j++) {
      const t0 = j / n,
        t1 = (j + 1) / n;
      const yt = ya + (j + 0.5) * (rise / n);
      const px0 = ax + (bx - ax) * t0,
        pz0 = az + (bz - az) * t0,
        px1 = ax + (bx - ax) * t1,
        pz1 = az + (bz - az) * t1;
      // Box spanning the corridor across, from this tread down to the previous one.
      const hx = dx !== 0 ? Math.abs(px1 - px0) / 2 + 0.01 : c / 2,
        hz = dz !== 0 ? Math.abs(pz1 - pz0) / 2 + 0.01 : c / 2;
      const cx = (px0 + px1) / 2 + (dx === 0 ? 0 : 0),
        cz = (pz0 + pz1) / 2;
      const ccx = dx !== 0 ? cx : a[0],
        ccz = dz !== 0 ? cz : a[1];
      f.box(mat, ccx - hx, yt - Math.min(0.35, rise / n + 0.12), ccz - hz, ccx + hx, yt, ccz + hz, { color });
    }
  }
  const last = corners[(start + flights) % 4];
  landing(f, last[0], last[1], c, top, mat, color);
  // Top floor over the next strip and corner (the flights below them are a full turn
  // down, so headroom is fine): links the last landing with the newel top.
  const nxt = corners[(start + flights + 1) % 4];
  const xa = Math.min(last[0], nxt[0]) - c / 2,
    xb = Math.max(last[0], nxt[0]) + c / 2;
  const za = Math.min(last[1], nxt[1]) - c / 2,
    zb = Math.max(last[1], nxt[1]) + c / 2;
  f.box(mat, xa, top - 0.18, za, xb, top, zb, { color, col: 'stone', nav: false });
  return { top, corner: last };
}

function landing(f, x, z, c, y, mat, color) {
  f.box(mat, x - c / 2, y - 0.18, z - c / 2, x + c / 2, y, z + c / 2, { color, col: 'stone', nav: false });
}

// Switchback stair filling the interior [x0,x1] x [z0,z1]: two lanes split along x
// with a divider, landings across the full width at both ends (depth ld). The
// first flight climbs in the +x lane toward -z. Returns { top, holeLane }.
export function switchbackStair(f, o) {
  const { x0, x1, z0, z1, y0, flights, rise } = o;
  const ld = o.landing ?? 0.93;
  const dv = o.divider ?? 0.2;
  const xm = (x0 + x1) / 2;
  const mat = o.mat || 'wood';
  const color = o.color || WOOD.dark;
  const laneE = [xm + dv / 2, x1],
    laneW = [x0, xm - dv / 2];
  const zS = z1 - ld,
    zN = z0 + ld;
  const top = y0 + flights * rise;
  // Divider wall between the lanes.
  f.box(o.dividerMat || 'plaster', xm - dv / 2, y0 - 0.2, zN, xm + dv / 2, top - 0.02, zS, { color: o.dividerColor, col: o.dividerCol || 'brick', nav: false });
  for (let k = 0; k < flights; k++) {
    const lane = k % 2 === 0 ? laneE : laneW;
    const north = k % 2 === 0;
    const ya = y0 + k * rise,
      yb = ya + rise;
    const xc = (lane[0] + lane[1]) / 2,
      w = lane[1] - lane[0];
    const za = north ? zS : zN,
      zb = north ? zN : zS;
    rampCollider(f, xc, ya, za, xc, yb, zb, w - 0.02, 0.12, 'wood');
    // Treads and stringers.
    const n = Math.max(3, Math.round(rise / 0.19));
    const run = Math.abs(zb - za);
    const dir = north ? -1 : 1;
    for (let j = 0; j < n; j++) {
      const yt = ya + (j + 0.5) * (rise / n);
      const zc = za + dir * (j + 0.5) * (run / n);
      f.box(mat, lane[0] + 0.05, yt - 0.05, zc - run / n / 2 - 0.02, lane[1] - 0.05, yt, zc + run / n / 2 + 0.02, { color });
    }
    for (const sx of [lane[0] + 0.05, lane[1] - 0.05]) f.slab(mat, sx, ya + 0.1, za, sx, yb + 0.1, zb, 0.06, 0.28, { color: scale(color, 0.85) });
    // Landing at the arrival end (full width).
    const lz0 = north ? z0 : zS,
      lz1 = north ? zN : z1;
    f.box(mat, x0, yb - 0.16, lz0, x1, yb, lz1, { color, faces: { ny: mat }, col: 'wood', nav: false });
    // Joists under the landing.
    f.box(mat, x0, yb - 0.32, (lz0 + lz1) / 2 - 0.07, x1, yb - 0.16, (lz0 + lz1) / 2 + 0.07, { color: scale(color, 0.8) });
  }
  return { top, hole: { x0: laneE[0], x1: laneE[1], z0: zN, z1: zS } };
}
