// Body and garment shapes for the procedural soldier, built in the bind pose at
// real scale: the tunic or jacket (with folds gathered at the belt, under the
// arms and in the skirt), the trousers' seat and legs (knee folds, blousing
// over leggings and boots), sleeves (elbow folds, cuffs or rolled up), boots,
// shoes, leggings, puttees and gaiters. The outfits (soldierKit*.js) choose
// the cut, cloth and colors and add the equipment on top.
//
// Sizes: a 1.78 m man (US Army 1946 survey mean stature 1.74 m; chest girth
// ~0.95 m, waist ~0.80 m; est.) in a wool uniform.
import * as THREE from 'three';
import { B, BIND } from './soldierRig.js';
import { torsoWeights, legWeights, armWeights, footWeights, smooth01 } from './soldierGeo.js';
import { CELL } from './soldierMaterials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const se = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);
export const lerp = (a, b, t) => a + (b - a) * t;
const bump = (x, c, w) => {
  const d = (x - c) / w;
  return Math.abs(d) >= 1 ? 0 : (1 - d * d) * (1 - d * d);
};

// Small deterministic noise for fold phases and irregularity.
export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise1(x, seed = 0) {
  const i = Math.floor(x),
    f = x - i;
  const a = hash1(i + seed * 57.3),
    b = hash1(i + 1 + seed * 57.3);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
// Smooth 3D value noise 0..1 (trilinear between hashed lattice values), for
// painting grime and wear without blocky cells.
export function noise3(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy),
    uz = fz * fz * (3 - 2 * fz);
  const h = (i, j, k) => hash1(i * 0.1031 + j * 11.17 + k * 97.37);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h(ix, iy, iz), h(ix + 1, iy, iz), ux), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), ux), uy),
    l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), ux), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), ux), uy),
    uz,
  );
}

// Sharp-crested fold profile 0..1 (crests narrower than troughs, like cloth).
export const foldWave = (x) => {
  const s = 0.5 + 0.5 * Math.sin(x);
  return s * s * (1.5 - 0.5 * s);
};

// Catmull-Rom through profile rows [[key, ...values]] sorted by key. out: an
// optional array to fill (hot paths pass a scratch one).
export function interpRows(rows, y, out = null) {
  let i = 0;
  while (i < rows.length - 2 && rows[i + 1][0] < y) i++;
  const r1 = rows[i],
    r2 = rows[i + 1];
  const r0 = rows[Math.max(0, i - 1)],
    r3 = rows[Math.min(rows.length - 1, i + 2)];
  const t = Math.min(1, Math.max(0, (y - r1[0]) / (r2[0] - r1[0])));
  const t2 = t * t,
    t3 = t2 * t;
  if (!out) out = new Array(r1.length);
  out[0] = y;
  for (let k = 1; k < r1.length; k++) {
    const a = r0[k],
      b = r1[k],
      c = r2[k],
      d = r3[k];
    out[k] = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Torso at shirt level. Rows: [y, halfWidth, zFront, zBack].
export const TORSO_ROWS = [
  [0.785, 0.008, -0.025, 0.035],
  [0.8, 0.065, -0.058, 0.066],
  [0.83, 0.12, -0.088, 0.097],
  [0.87, 0.157, -0.102, 0.118],
  [0.92, 0.168, -0.106, 0.125],
  [0.98, 0.163, -0.104, 0.114],
  [1.04, 0.153, -0.101, 0.099],
  [1.1, 0.151, -0.104, 0.096],
  [1.17, 0.158, -0.113, 0.099],
  [1.24, 0.166, -0.121, 0.104],
  [1.31, 0.17, -0.124, 0.107],
  [1.37, 0.171, -0.117, 0.109],
  [1.415, 0.167, -0.104, 0.104],
  [1.445, 0.154, -0.086, 0.094],
  [1.47, 0.128, -0.07, 0.081],
  [1.49, 0.096, -0.057, 0.072],
  [1.505, 0.068, -0.048, 0.066],
];
const TORSO_EXP = 2 / 2.3;

// Point on the torso surface: theta 0 = right side (+X), -PI/2 = front, +PI/2 = back.
const _tr = [0, 0, 0, 0];
export function torsoPoint(theta, y, out = new THREE.Vector3(), grow = 0, rows = TORSO_ROWS) {
  interpRows(rows, y, _tr);
  const a = _tr[1],
    zf = _tr[2],
    zb = _tr[3];
  const c = Math.cos(theta),
    s = Math.sin(theta);
  const cz = (zf + zb) / 2,
    d = (zb - zf) / 2;
  out.set(se(c, TORSO_EXP) * (a + grow), y, cz + se(s, TORSO_EXP) * (d + grow));
  return out;
}
const _p0 = new THREE.Vector3(),
  _p1 = new THREE.Vector3(),
  _p2 = new THREE.Vector3(),
  _p3 = new THREE.Vector3();
export function torsoNormal(theta, y, out = new THREE.Vector3()) {
  torsoPoint(theta + 0.01, y, _p0);
  torsoPoint(theta - 0.01, y, _p1);
  torsoPoint(theta, y + 0.01, _p2);
  torsoPoint(theta, y - 0.01, _p3);
  _p0.sub(_p1);
  _p2.sub(_p3);
  out.crossVectors(_p2, _p0).normalize();
  torsoPoint(theta, y, _p1);
  if (out.x * _p1.x + out.z * (_p1.z - 0.0) < 0) out.negate();
  return out;
}
// Angle on the torso at height y where the surface reaches x (front: side < 0).
export function torsoTheta(x, y, side) {
  const [, a] = interpRows(TORSO_ROWS, y);
  const r = Math.min(0.999, Math.abs(x) / a);
  let c = Math.pow(r, 2.3 / 2);
  c = Math.min(1, c) * Math.sign(x || 1);
  const t = Math.acos(c);
  return side < 0 ? -t : t;
}
// Front / back of the torso as a 0..1 weight from theta.
export const frontness = (theta) => Math.max(0, -Math.sin(theta));
export const backness = (theta) => Math.max(0, Math.sin(theta));

// ---------------------------------------------------------------------------
// Garment cut of the torso piece.
//   hem: bottom edge height; flare: how far the skirt stands off the trousers;
//   grow: cloth thickness over the shirt level; belt: belt height (cloth gathers
//   above and below), cinch: how much the belt pulls it in; blouse: extra
//   fullness puffing over the belt; folds: 0..1 fold strength; seed: fold
//   variation; open: front opening (V of a collarless neck or open collar).
export function garmentOffset(g, theta, y) {
  const fr = frontness(theta),
    bk = backness(theta);
  let o = g.grow ?? 0.008;
  // Skirt stands off the hips and seat below the waist.
  if (g.flare) o += g.flare * smooth01(g.belt ?? 1.04, (g.belt ?? 1.04) - 0.14, y) * (0.7 + 0.3 * bk);
  // Belt pull and blousing over it.
  if (g.belt) {
    const b = g.belt;
    o -= (g.cinch ?? 0.004) * bump(y, b, 0.035);
    o += (g.blouse ?? 0) * bump(y, b + 0.05, 0.07) * (0.6 + 0.4 * fr + 0.3 * bk);
  }
  // Back fullness (a little slack across the shoulder blades).
  o += 0.003 * bk * bump(y, 1.28, 0.12);
  return o;
}
export function garmentFolds(g, theta, y) {
  const k = g.folds ?? 1;
  if (!k) return 0;
  const seed = g.seed ?? 1;
  const fr = frontness(theta),
    bk = backness(theta);
  let d = 0;
  if (g.belt) {
    const b = g.belt;
    // Vertical folds radiating from the belt, above and below it.
    // (About ten around the body: the grid has three vertices per fold.)
    const ph = noise1(theta * 2 + seed, seed) * 3;
    const n = 9 + Math.floor(hash1(seed) * 3);
    const up = bump(y, b + 0.06, 0.08),
      dn = bump(y, b - 0.06, 0.07);
    d += (up * 0.005 + dn * 0.004) * foldWave(theta * n + ph + (y - b) * 5);
  }
  // Diagonal folds from the armpits toward the chest and shoulder blades.
  for (const s of [-1, 1]) {
    const side = Math.cos(theta) * s; // 1 on this side
    if (side < 0.2) continue;
    const w = bump(y, 1.27, 0.1) * smooth01(0.3, 0.8, side);
    const along = (y - 1.27) * 14 + (s * Math.cos(theta) - 0.75) * 4 * (fr > 0 ? 1 : -1);
    d += w * 0.003 * foldWave(along * 2.0 + seed * 3 + s);
  }
  // Horizontal slack folds across the small of the back.
  d += bk * bump(y, (g.belt ?? 1.04) + 0.12, 0.08) * 0.0025 * foldWave(y * 70 + noise1(theta * 3, seed) * 3);
  // Skirt: soft vertical folds.
  if (g.flare && g.hem < 1.0) {
    const n = 8;
    d += smooth01((g.belt ?? 1.04) - 0.05, g.hem + 0.05, y) * 0.005 * foldWave(theta * n + noise1(theta * 2, seed + 2) * 3);
  }
  return d * k;
}

// The torso garment surface (outer side). Returns the point.
// Below the hips a skirt hangs nearly straight instead of following the seat
// and the crotch.
export const SKIRT_Y = 0.91;
export function garmentPoint(g, theta, y, out, extra = 0) {
  const off = garmentOffset(g, theta, y) + extra;
  if (y >= SKIRT_Y) return torsoPoint(theta, y, out, off);
  torsoPoint(theta, SKIRT_Y, out, off);
  const [, , zf, zb] = interpRows(TORSO_ROWS, SKIRT_Y);
  const cz = (zf + zb) / 2;
  const k = 1 - 0.18 * (SKIRT_Y - y);
  out.x *= k;
  out.z = cz + (out.z - cz) * k;
  out.y = y;
  return out;
}

// Build the torso piece (tunic, jacket, shirt, smock): its outside from the hem
// up to the collar line, the hem turned under, and an optional front placket.
// lod 0/1/2. colorFn(x, y, z, color, theta) may repaint (camouflage, wear).
export function buildTorsoGarment(b, g, lod = 0) {
  const nu = [30, 16, 9][lod];
  const top = g.top ?? 1.505;
  const hem = g.hem;
  // Rows: denser around the belt and the shoulders.
  const ys = [];
  const step = [0.028, 0.06, 0.12][lod];
  for (let y = hem; y < top - 1e-6; y += step) ys.push(y);
  ys.push(top);
  if (g.belt && lod === 0) for (const dy of [-0.045, -0.02, 0, 0.02, 0.045, 0.07]) ys.push(g.belt + dy);
  if (lod === 0) ys.push(1.44, 1.465, 1.48, 1.493);
  ys.sort((p, q) => p - q);
  const rows = ys.filter((y, i) => y >= hem && y <= top && (i === 0 || y - ys[i - 1] > 0.004));
  const us = [];
  for (let i = 0; i <= nu; i++) us.push(i / nu);
  const thetaOf = (u) => -PI / 2 + (u - 0.5) * 2 * PI; // front center at u = 0.5, seam at the back
  b.bones(torsoWeights);
  const folds = lod === 0 ? 1 : 0;
  const col = b.colorFn;
  if (g.colorFn) b.colorFn = (x, y, z, c) => g.colorFn(x, y, z, c);
  b.part();
  b.grid(
    us,
    rows,
    (u, y, out) => {
      const th = thetaOf(u);
      let e = folds ? garmentFolds(g, th, y) : 0;
      // The hem rolls in a little.
      e -= 0.003 * smooth01(hem + 0.012, hem, y);
      // Front placket: a raised strip over the buttons.
      if (g.placket && lod === 0) {
        const x = Math.cos(th);
        e += 0.0025 * smooth01(0.11, 0.05, Math.abs(x + (g.placketX ?? 0))) * frontness(th) * smooth01(g.placketBottom ?? hem, (g.placketBottom ?? hem) + 0.02, y) * (y < (g.placketTop ?? top) ? 1 : 0);
      }
      garmentPoint(g, th, y, out, e);
    },
    { center: V(0, 1.1, 0), wrapU: true },
  );
  // Inside of the hem (the turned-under edge) so the bottom has thickness.
  if (lod < 2) {
    const ring = [hem, hem + 0.02];
    b.grid(
      us,
      ring,
      (u, y, out) => {
        const th = thetaOf(u);
        garmentPoint(g, th, y, out, -0.006 - 0.003);
      },
      { center: V(0, 1.1, 0), wrapU: true, flip: true },
    );
  }
  b.colorFn = col;
}

// Trousers seat: the pelvis from the crotch up to the waistband (mostly under
// the tunic skirt).
export function buildSeat(b, { top = 1.06, grow = 0.004, lod = 0, waistband = false } = {}) {
  const nu = [22, 12, 8][lod];
  const ys = [];
  const step = [0.03, 0.06, 0.1][lod];
  for (let y = 0.785; y < top; y += step) ys.push(y);
  ys.push(top);
  const us = [];
  for (let i = 0; i <= nu; i++) us.push(i / nu);
  b.bones(torsoWeights);
  b.part();
  b.grid(us, ys, (u, y, out) => torsoPoint(-PI / 2 + (u - 0.5) * 2 * PI, y, out, grow - 0.004 * smooth01(0.84, 0.8, y)), { center: V(0, 0.95, 0), wrapU: true });
  if (waistband && lod < 2) {
    // A 4 cm waistband with belt loops.
    b.part();
    b.grid(us, [top - 0.04, top - 0.035, top - 0.005, top], (u, y, out) => torsoPoint(-PI / 2 + (u - 0.5) * 2 * PI, y, out, grow + 0.003 * (y > top - 0.038 && y < top - 0.002 ? 1 : 0)), { center: V(0, 0.95, 0), wrapU: true });
  }
}

// ---------------------------------------------------------------------------
// Limbs: rings along a joint chain.
export const armChain = (side) => {
  const s = side < 0;
  return [BIND[s ? B.upperArmL : B.upperArmR], BIND[s ? B.forearmL : B.forearmR], BIND[s ? B.handL : B.handR]];
};
export const legChain = (side) => {
  const s = side < 0;
  return [BIND[s ? B.thighL : B.thighR], BIND[s ? B.shinL : B.shinR], BIND[s ? B.footL : B.footR]];
};
export function chainPoint(points, s, out) {
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const len = a.distanceTo(b);
    if (s <= acc + len || i === points.length - 2) {
      const t = (s - acc) / len;
      return out.copy(a).lerp(b, t);
    }
    acc += len;
  }
  return out.copy(points[points.length - 1]);
}
export const chainLength = (points) => points[0].distanceTo(points[1]) + points[1].distanceTo(points[2]);

// A tube along a chain: profile rows [s, rx, rz, dz, dx]; s along the chain.
// disp(s, a) adds a radial offset at angle a (0 = +X side, PI/2 = front).
export function limbTube(b, points, profile, { seg = 10, capStart = 0.6, capEnd = 0.6, side = [1, 0, 0], disp = null } = {}) {
  const rings = profile.map(([s, rx, rz, dz = 0, dx = 0]) => {
    const c = chainPoint(points, s, new THREE.Vector3());
    c.z += dz;
    c.x += dx;
    return { c, rx, rz, s };
  });
  b.tube(rings, { seg, capStart, capEnd, side, disp: disp ? (k, a, ring) => (ring.s === undefined ? 0 : disp(ring.s, a)) : null });
}
// Angle on a limb tube built with side [1,0,0] and a downward chain: the frame
// is S = +X, F = T x S. For a chain going down (T ~ -Y), F = (0,0,1)... so
// a = 0 is +X (outside of the right limb), a = PI/2 is +Z (back), -PI/2 front.
export const limbFront = (a) => Math.max(0, -Math.sin(a));
export const limbBack = (a) => Math.max(0, Math.sin(a));

// Resample a profile into dense rings between s0 and s1 (step ds), keeping the
// listed rows' values interpolated.
export function denseProfile(rows, s0, s1, ds) {
  // Pad every row to [s, rx, rz, dz, dx] so they interpolate column by column.
  rows = rows.map((r) => [r[0], r[1], r[2], r[3] ?? 0, r[4] ?? 0]);
  const out = [];
  const n = Math.max(1, Math.round((s1 - s0) / ds));
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const r = interpRows(rows, s);
    out.push([s, ...r.slice(1)]);
  }
  return out;
}

// Sleeve from the shoulder to the cuff. opts: bulk (extra fullness), cuff
// ('band' | 'knit' | 'tab' | null), cuffLen, end (where the sleeve stops: 0.56 at
// the wrist, ~0.22 rolled above the elbow), roll (rolled-up sleeve thickness),
// folds.
const sleeveRows = (k, wide) => [
  [-0.012, 0.047 + k, 0.051 + k],
  [0.0, 0.052 + k, 0.056 + k],
  [0.06, 0.054 + k + wide * 0.4, 0.056 + k + wide * 0.4],
  [0.14, 0.051 + k + wide * 0.6, 0.053 + k + wide * 0.6],
  [0.22, 0.049 + k + wide, 0.05 + k + wide],
  [0.29, 0.047 + k + wide, 0.048 + k + wide],
  [0.33, 0.047 + k + wide, 0.047 + k + wide],
  [0.4, 0.046 + k + wide * 0.8, 0.045 + k + wide * 0.8],
  [0.47, 0.043 + k + wide * 0.6, 0.041 + k + wide * 0.6],
  [0.53, 0.04 + k, 0.038 + k],
  [0.56, 0.04 + k, 0.038 + k],
];
export function buildSleeve(b, side, { lod = 0, bulk = 0, cuff = 'band', end = 0.555, roll = 0, folds = 1, seed = 1, cuffColor = null, wide = 0 } = {}) {
  const rows = sleeveRows(bulk, wide);
  const sE = BIND[B.upperArmR].distanceTo(BIND[B.forearmR]);
  const ds = [0.024, 0.05, 0.1][lod];
  const prof = denseProfile(rows, -0.012, end, ds);
  b.bones(armWeights(side));
  b.part();
  const disp =
    lod === 0 && folds
      ? (s, a) => {
          // Inner elbow: rings bunched where the arm bends; forearm: a couple of twisting folds.
          const inner = limbFront(a) * 0.8 + 0.2;
          const e = bump(s, sE + 0.01, 0.07);
          let d = e * inner * 0.0045 * foldWave(s * 190 + seed + Math.sin(a * 2) * 0.8);
          d += bump(s, sE + 0.12, 0.08) * 0.003 * foldWave(s * 120 + a * 2 + seed * 2);
          d += bump(s, 0.12, 0.08) * 0.0022 * foldWave(a * 5 + s * 40 + seed);
          // Cuff gathers.
          if (cuff && !roll) d += bump(s, end - 0.06, 0.04) * 0.002 * foldWave(a * 9 + seed);
          return d * folds;
        }
      : null;
  limbTube(b, armChain(side), prof, { seg: [12, 8, 5][lod], capStart: 0.75, capEnd: 0, disp });
  // The end: a cuff band, a knit cuff or the rolled-up sleeve.
  const P = armChain(side);
  const ringAt = (s, rx, rz) => {
    const r = interpRows(rows, Math.min(0.56, s));
    return { c: chainPoint(P, s, new THREE.Vector3()), rx: r[1] + rx, rz: r[2] + rz };
  };
  if (lod === 2) {
    b.tube([ringAt(end - 0.005, 0, 0), ringAt(end, -0.015, -0.015)], { seg: 5 });
    return;
  }
  if (roll) {
    b.part();
    b.tube([ringAt(end - 0.035, -0.002, -0.002), ringAt(end - 0.03, roll, roll), ringAt(end, roll + 0.002, roll + 0.002), ringAt(end + 0.012, roll * 0.6, roll * 0.6), ringAt(end + 0.016, -0.008, -0.008)], { seg: [12, 8][lod] });
    return;
  }
  const col = b.color.clone();
  if (cuffColor) b.paint(cuffColor);
  b.part();
  if (cuff === 'knit') {
    const kc = b.cell;
    b.material(CELL.knit);
    b.tube([ringAt(end - 0.075, -0.002, -0.002), ringAt(end - 0.07, -0.008, -0.008), ringAt(end - 0.005, -0.009, -0.009), ringAt(end, -0.014, -0.014)], { seg: [12, 8][lod] });
    b.material(kc);
  } else {
    // Cuff band with a turned edge; the opening inside.
    b.tube([ringAt(end - 0.06, 0.001, 0.001), ringAt(end - 0.055, 0.003, 0.003), ringAt(end - 0.004, 0.003, 0.003), ringAt(end, 0.0, 0.0), ringAt(end, -0.006, -0.006), ringAt(end - 0.02, -0.008, -0.008)], { seg: [12, 8][lod] });
  }
  b.paint(col);
}

// A patch sewn over the back of the elbow (field reinforcement): a panel
// following the sleeve (same bulk and wide), raised in the middle and flat at
// the seams. half: half its width as an angle round the arm.
export function buildElbowPatch(b, side, { bulk = 0, wide = 0, s0 = 0.245, s1 = 0.375, half = 0.95 } = {}) {
  const rows = sleeveRows(bulk, wide);
  const P = armChain(side);
  const c = new THREE.Vector3();
  const us = [],
    vs = [];
  for (let i = 0; i <= 6; i++) us.push(PI / 2 - half + (2 * half * i) / 6);
  for (let j = 0; j <= 4; j++) vs.push(s0 + ((s1 - s0) * j) / 4);
  b.bones(armWeights(side));
  b.part();
  b.grid(
    us,
    vs,
    (a, s, o) => {
      const r = interpRows(rows, s);
      const e = Math.sin((PI * (a - us[0])) / (2 * half)) * Math.sin((PI * (s - s0)) / (s1 - s0));
      // Clear of the sleeve's own folds there (up to ~2 mm).
      const lift = 0.0025 + 0.0012 * e;
      chainPoint(P, s, c);
      o.set(c.x + Math.cos(a) * (r[1] + lift), c.y, c.z + Math.sin(a) * (r[2] + lift));
    },
    { center: chainPoint(P, (s0 + s1) / 2, new THREE.Vector3()) },
  );
}

// Trouser leg from inside the pelvis down to `end` (distance along the leg).
// style: 'straight' | 'breeches' (sharovary: full thighs, tight calves) |
// 'jump' (full, bloused). blouse: overhang where the leg goes into a boot,
// legging or gaiter (m) whose top edge is at `tuck` (default 3 cm above the
// end): below it the cloth is drawn in, inside. folds 0..1.
export function buildTrouserLeg(b, side, { lod = 0, bulk = 0.004, end = 0.84, style = 'straight', blouse = 0, tuck = end - 0.03, folds = 1, seed = 1 } = {}) {
  const k = bulk;
  const br = style === 'breeches' ? 1 : 0;
  const jp = style === 'jump' ? 1 : 0;
  // Wool service trousers were cut full: ~64 cm round the thigh, ~44 cm at the
  // knee (est. from 1940s patterns), over a 56 / 38 cm leg.
  const rows = [
    [-0.09, 0.072, 0.076],
    [-0.02, 0.093 + k, 0.097 + k],
    [0.06, 0.095 + k + br * 0.018 + jp * 0.008, 0.1 + k + br * 0.022 + jp * 0.008, 0.002],
    [0.16, 0.088 + k + br * 0.024 + jp * 0.012, 0.093 + k + br * 0.028 + jp * 0.012, 0.004],
    [0.26, 0.079 + k + br * 0.016 + jp * 0.012, 0.084 + k + br * 0.018 + jp * 0.012, 0.004],
    [0.34, 0.071 + k + jp * 0.01, 0.076 + k + jp * 0.01, 0.001],
    [0.425, 0.066 + k + jp * 0.008, 0.07 + k + jp * 0.008, -0.004],
    [0.5, 0.064 + k - br * 0.008 + jp * 0.008, 0.07 + k - br * 0.008 + jp * 0.008, 0.008],
    [0.6, 0.06 + k - br * 0.012 + jp * 0.008, 0.067 + k - br * 0.012 + jp * 0.008, 0.011],
    [0.72, 0.052 + k - br * 0.008, 0.056 + k - br * 0.008, 0.006],
    [0.84, 0.049 + k, 0.053 + k, 0.004],
  ];
  const sK = BIND[B.thighR].distanceTo(BIND[B.shinR]);
  const ds = [0.03, 0.06, 0.12][lod];
  let prof;
  if (blouse) {
    // Closer rings round the tuck, so the roll of cloth over the edge reads.
    prof = denseProfile(rows, -0.09, tuck - 0.05, ds);
    const near = [[-0.032, -0.018, -0.008, 0, 0.012], [-0.02, 0.004], []][lod].map((d) => tuck + d);
    const pad = rows.map((r) => [r[0], r[1], r[2], r[3] ?? 0, r[4] ?? 0]);
    for (const s of [...near, end]) if (s > prof[prof.length - 1][0] + 0.002 && s <= end) prof.push([s, ...interpRows(pad, s).slice(1)]);
    // The roll hangs over the top edge; below it the leg is drawn in (est.
    // 8 mm plus the overhang), so it stays inside the boot or wrap.
    for (const r of prof) {
      const s = r[0];
      const over = smooth01(tuck - 0.075, tuck - 0.022, s) * (1 - smooth01(tuck - 0.014, tuck + 0.001, s));
      const pull = smooth01(tuck - 0.008, tuck + 0.01, s) * (0.008 + blouse);
      r[1] += blouse * over - pull;
      r[2] += blouse * over - pull;
    }
  } else prof = denseProfile(rows, -0.09, end, ds);
  b.bones(legWeights(side));
  b.part();
  const disp =
    lod === 0 && folds
      ? (s, a) => {
          let d = 0;
          // Behind the knee: horizontal folds; in front: a soft bag.
          d += bump(s, sK + 0.02, 0.07) * limbBack(a) * 0.004 * foldWave(s * 170 + seed);
          d += bump(s, sK - 0.02, 0.06) * limbFront(a) * 0.0035;
          // Diagonal drape folds from the crotch over the thigh.
          d += bump(s, 0.14, 0.1) * 0.0025 * foldWave(a * 4 + s * 35 + seed * 2);
          // Blousing: a few irregular folds in the roll, none at the edge itself.
          if (blouse) d += bump(s, tuck - 0.03, 0.03) * (0.0015 + blouse * 0.35) * foldWave(a * 5 + noise1(a * 1.3, seed) * 2.5);
          // Shin: a few loose diagonal folds.
          d += bump(s, sK + 0.18, 0.12) * 0.002 * foldWave(a * 3 - s * 30 + seed);
          return d * folds;
        }
      : null;
  limbTube(b, legChain(side), prof, { seg: [14, 8, 5][lod], capStart: 0.8, capEnd: blouse ? 0.25 : 0.5, disp });
}

// A boot shaft / legging / gaiter: a tube around the lower leg from s0 to s1
// with radii r0 (top) and r1 (bottom). opts.folds: accordion folds (kirza and
// jackboots bunch at the ankle); laces: rows of lacing up the front (laced
// boots); capEnd: rounds the bottom in, so a shaft runs into the foot of the
// boot without a step.
export function buildLegWrap(b, side, s0, s1, r0, r1, { lod = 0, flareTop = 0.004, folds = 0, seed = 1, rim = 0.003, laces = 0, laceColor = null, capEnd = 0 } = {}) {
  // Radii and backward offset of the ring at s (the calf bulges behind).
  const at = (s, top = false) => {
    const t = (s - s0) / (s1 - s0);
    const calf = Math.max(0, 1 - Math.abs(s - 0.6) / 0.16) * 0.007;
    return [r0[0] + (r1[0] - r0[0]) * t + calf * 0.6 + (top ? flareTop : 0), r0[1] + (r1[1] - r0[1]) * t + calf + (top ? flareTop : 0), 0.004 + calf * 0.8];
  };
  const prof = [];
  const n = [8, 3, 1][lod];
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    prof.push([s, ...at(s, i === 0)]);
  }
  b.bones(legWeights(side));
  b.part();
  const disp =
    lod === 0 && folds
      ? (s, a) => {
          const w = smooth01(s0 + (s1 - s0) * 0.45, s1 - 0.02, s);
          return w * folds * 0.005 * foldWave(s * 140 + Math.sin(a * 2 + seed) * 1.5 + seed);
        }
      : null;
  limbTube(b, legChain(side), prof, { seg: [14, 8, 5][lod], capStart: 0, capEnd, disp });
  if (laces && lod === 0) {
    // Laces crossing between the eyelets, a few mm proud of the front.
    const P = legChain(side);
    const c = new THREE.Vector3();
    const col = b.color.clone();
    b.paint(laceColor ?? col.clone().multiplyScalar(0.55));
    b.part(false);
    for (let i = 0; i < laces; i++) {
      const s = s0 + 0.025 + ((s1 - s0 - 0.07) * i) / Math.max(1, laces - 1);
      const [, rz, dz] = at(s);
      chainPoint(P, s, c);
      b.box(V(c.x, c.y, c.z + dz - rz - 0.0012), [0.026, 0.0035, 0.004], { rot: [0, 0, (i % 2 ? 1 : -1) * 0.2], r: 0.001, seg: [4, 2] });
    }
    b.paint(col);
  }
  // Top rim (thickness of the leather / canvas), turned in.
  if (lod < 2 && rim) {
    const P = legChain(side);
    const c0 = chainPoint(P, s0, new THREE.Vector3());
    c0.z += 0.004;
    const ft = flareTop + r0[0];
    b.tube(
      [
        { c: c0.clone(), rx: ft, rz: r0[1] + flareTop },
        { c: c0.clone().add(V(0, -0.0005, 0)), rx: ft - rim, rz: r0[1] + flareTop - rim },
        { c: c0.clone().add(V(0, -0.02, 0)), rx: ft - rim, rz: r0[1] + flareTop - rim },
      ],
      { seg: [14, 8][lod] },
    );
  }
}

// Puttees (Soviet obmotki): a spiral of overlapping wool tape around the leg.
// The grid follows the helix, so each turn is three rows: the tape's lower edge
// steps out over the turn below it.
export function buildPuttee(b, side, s0, s1, { lod = 0, r0 = [0.054, 0.06], r1 = [0.046, 0.052], turns = 9 } = {}) {
  if (lod > 0) return buildLegWrap(b, side, s0, s1, r0, r1, { lod, flareTop: 0.002, rim: 0 });
  const P = legChain(side);
  b.bones(legWeights(side));
  b.part();
  const seg = 12;
  const us = [];
  for (let i = 0; i <= seg; i++) us.push((i / seg) * 2 * PI);
  const vs = [];
  for (let k = 0; k < turns; k++) vs.push(k, k + 0.12, k + 0.9);
  vs.push(turns);
  const c = new THREE.Vector3();
  b.grid(
    us,
    vs,
    (a, t, o) => {
      // Height along the leg of this point of the helix (top turn first).
      const f = Math.min(1, Math.max(0, (t + a / (2 * PI)) / (turns + 1)));
      const s = s0 + (s1 - s0) * f;
      const tt = (s - s0) / (s1 - s0);
      chainPoint(P, s, c);
      const calf = Math.max(0, 1 - Math.abs(s - 0.6) / 0.16) * 0.006;
      const ph = t - Math.floor(t);
      const lift = 0.0026 * (1 - ph) + 0.0005 * Math.sin(ph * PI);
      const rx = lerp(r0[0], r1[0], tt) + calf * 0.6 + lift,
        rz = lerp(r0[1], r1[1], tt) + calf + lift;
      o.set(c.x + Math.cos(a) * rx, c.y, c.z + 0.004 + calf * 0.8 + Math.sin(a) * rz);
    },
    // Not wrapped: the helix closes on itself one turn lower (same positions).
    { wrapU: false, normal: (p) => new THREE.Vector3(p.x - lerp(P[1].x, P[2].x, (P[1].y - p.y) / (P[1].y - P[2].y)), 0, p.z - 0.004 - lerp(P[1].z, P[2].z, (P[1].y - p.y) / (P[1].y - P[2].y))) },
  );
}

// ---------------------------------------------------------------------------
// Footwear. kind: 'shoe' (laced ankle boot / service shoe), 'jackboot' (the
// foot of a tall boot; the shaft is a leg wrap), 'jump' (toe cap, tall laced).
// high: top of the ankle part (m).
export function buildBoot(b, side, { lod = 0, upper = 0x3a2a1e, sole = 0x1a1612, high = 0.15, width = 1, cell = CELL.leather, gloss = 0, laces = true, toeCap = false, heel = 0.028, seed = 1, suede = false } = {}) {
  const ax = BIND[side < 0 ? B.footL : B.footR].x;
  b.bones(footWeights(side));
  b.material(suede ? CELL.suede : cell, gloss);
  b.paint(upper);
  b.part();
  const w = width;
  // Foot rings from the heel (z +0.078) to the toe: [z, rx, rz(height half), yc].
  // A broad, round 1940s toe (army lasts were wide): ~30 cm overall for a
  // size 9-10 (est.).
  const rings = [
    [0.078, 0.028, 0.044, 0.062],
    [0.066, 0.039, 0.057, 0.068],
    [0.04, 0.043 * w, 0.063, 0.074],
    [0.0, 0.045 * w, 0.058, 0.066],
    [-0.04, 0.047 * w, 0.051, 0.056],
    [-0.08, 0.049 * w, 0.043, 0.047],
    [-0.12, 0.049 * w, 0.036, 0.04],
    [-0.15, 0.047 * w, 0.031, 0.036],
    [-0.172, 0.043 * w, 0.027, 0.033],
    [-0.19, 0.035 * w, 0.023, 0.031],
  ].map(([z, rx, rz, yc]) => ({ c: V(ax + side * 0.004 * (z < -0.05 ? 1 : 0), yc + heel - 0.028, z), rx, rz }));
  const pick = lod === 0 ? rings : lod === 1 ? rings.filter((_, i) => i % 2 === 0 || i === rings.length - 1) : [rings[1], rings[4], rings[8]];
  b.tube(pick, { seg: [12, 8, 5][lod], capStart: 0.5, capEnd: 0.55, side: [1, 0, 0] });
  // Ankle / shaft.
  b.tube(
    [
      { c: V(ax, 0.06 + heel - 0.028, 0.018), rx: 0.043, rz: 0.049 },
      { c: V(ax, high * 0.6 + 0.04, 0.018), rx: 0.044, rz: 0.049 },
      { c: V(ax, high, 0.016), rx: 0.046, rz: 0.051 },
    ],
    { seg: [12, 8, 5][lod], capStart: 0, capEnd: 0 },
  );
  if (lod < 2) {
    if (toeCap && lod === 0) {
      b.part();
      b.tube(
        rings.slice(6).map((r) => ({ c: r.c.clone().add(V(0, 0.0012, 0)), rx: r.rx + 0.0015, rz: r.rz + 0.0015 })),
        { seg: 12, capStart: 0, capEnd: 0.55 },
      );
    }
    // Lacing: the tongue and the laces up the instep.
    if (laces && lod === 0) {
      b.part();
      b.material(CELL.leather, 0);
      const lc = b.color.clone();
      b.paint(new THREE.Color(upper).multiplyScalar(0.7));
      for (let i = 0; i < 4; i++) {
        const y = 0.085 + i * ((high - 0.1) / 4);
        const z = -0.06 + i * 0.016;
        const c = V(ax, y + heel - 0.028, z - 0.004 - (0.046 - Math.min(0.046, y * 0.15)));
        b.box([c.x, c.y, c.z], [0.03, 0.005, 0.006], { r: 0.002, rot: [0.5 - i * 0.08, 0, 0], seg: [4, 2] });
      }
      b.paint(lc);
    }
  }
  // Sole and heel (rubber or leather, studded for German boots): the outline
  // of the foot with a 3-4 mm welt, flat and square-edged.
  b.material(CELL.leather, 0);
  b.paint(sole);
  b.part();
  if (lod < 2) {
    const soleRings = pick.map((r) => ({ c: V(r.c.x, 0.008 + heel * 0.15, r.c.z), rx: r.rx + 0.0035, rz: 0.008 }));
    b.tube(soleRings, { seg: [12, 8][lod], capStart: 0.35, capEnd: 0.4, exp: 5, side: [1, 0, 0] });
  } else b.box([ax + side * 0.002, 0.008 + heel * 0.15, -0.065], [0.098 * w, 0.016, 0.27], { r: 0.007, seg: [8, 2] });
  b.box([ax, heel * 0.6, 0.048], [0.076 * w, heel, 0.072], { r: 0.006 });
}
