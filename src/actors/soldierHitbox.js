// Hit zones of the soldier as capsules that follow the bones, sized to the
// visible (clothed) body, and a ray test that reports entry and exit distances
// so bullets can pass through limbs into the torso.
import * as THREE from 'three';
import { B, BIND, HEAD_CENTER } from './soldierRig.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const hc = HEAD_CENTER;
// part, bone, a, b (bind-pose model coordinates), radius
export const HITBOX_DEFS = [
  ['head', B.head, V(hc.x, hc.y - 0.035, hc.z - 0.005), V(hc.x, hc.y + 0.055, hc.z + 0.006), 0.105],
  ['neck', B.neck, V(0, 1.47, 0.018), V(0, 1.555, 0.01), 0.056],
  ['chest', B.chest, V(-0.07, 1.33, -0.004), V(0.07, 1.33, -0.004), 0.123],
  ['abdomen', B.spine, V(-0.058, 1.12, -0.003), V(0.058, 1.12, -0.003), 0.11],
  ['pelvis', B.hips, V(-0.07, 0.925, 0.006), V(0.07, 0.925, 0.006), 0.115],
  ['upperArmL', B.upperArmL, BIND[B.upperArmL], BIND[B.forearmL], 0.052],
  ['upperArmR', B.upperArmR, BIND[B.upperArmR], BIND[B.forearmR], 0.052],
  ['forearmL', B.forearmL, BIND[B.forearmL], BIND[B.handL], 0.044],
  ['forearmR', B.forearmR, BIND[B.forearmR], BIND[B.handR], 0.044],
  ['handL', B.handL, BIND[B.handL].clone().add(V(0, -0.025, 0)), BIND[B.handL].clone().add(V(0, -0.1, 0)), 0.042],
  ['handR', B.handR, BIND[B.handR].clone().add(V(0, -0.025, 0)), BIND[B.handR].clone().add(V(0, -0.1, 0)), 0.042],
  ['thighL', B.thighL, BIND[B.thighL], BIND[B.shinL], 0.082],
  ['thighR', B.thighR, BIND[B.thighR], BIND[B.shinR], 0.082],
  ['shinL', B.shinL, BIND[B.shinL], BIND[B.footL], 0.06],
  ['shinR', B.shinR, BIND[B.shinR], BIND[B.footR], 0.06],
  ['footL', B.footL, V(-0.1, 0.055, 0.045), V(-0.104, 0.04, -0.165), 0.05],
  ['footR', B.footR, V(0.1, 0.055, 0.045), V(0.104, 0.04, -0.165), 0.05],
];

const _a = new THREE.Vector3(),
  _b = new THREE.Vector3();

// Fill `out` with world-space capsules for a model pose (ModelPose) and the
// root's world matrix. Reuses the objects already in `out`.
export function fillHitboxes(mp, rootMatrix, out) {
  out.length = HITBOX_DEFS.length;
  for (let i = 0; i < HITBOX_DEFS.length; i++) {
    const [part, bone, a, b, r] = HITBOX_DEFS[i];
    mp.point(bone, a, _a).applyMatrix4(rootMatrix);
    mp.point(bone, b, _b).applyMatrix4(rootMatrix);
    let h = out[i];
    if (!h || typeof h !== 'object') h = out[i] = { part, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r };
    h.part = part;
    h.ax = _a.x;
    h.ay = _a.y;
    h.az = _a.z;
    h.bx = _b.x;
    h.by = _b.y;
    h.bz = _b.z;
    h.r = r;
  }
  return out;
}

// Ray against one capsule: the [entry, exit] interval along the ray (in units
// of |d|), or null. The capsule is the union of a finite cylinder and two end
// spheres; it's convex, so the union of their intervals is the answer.
const SPAN = [0, 0];
export function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r) {
  let t0 = Infinity,
    t1 = -Infinity;
  const dd = dx * dx + dy * dy + dz * dz;
  const sphere = (cx, cy, cz) => {
    const px = ox - cx,
      py = oy - cy,
      pz = oz - cz;
    const b = px * dx + py * dy + pz * dz;
    const c = px * px + py * py + pz * pz - r * r;
    const h = b * b - dd * c;
    if (h < 0) return;
    const sq = Math.sqrt(h);
    const s0 = (-b - sq) / dd,
      s1 = (-b + sq) / dd;
    if (s0 < t0) t0 = s0;
    if (s1 > t1) t1 = s1;
  };
  sphere(ax, ay, az);
  sphere(bx, by, bz);
  const bax = bx - ax,
    bay = by - ay,
    baz = bz - az;
  const baba = bax * bax + bay * bay + baz * baz;
  if (baba > 1e-12) {
    const oax = ox - ax,
      oay = oy - ay,
      oaz = oz - az;
    const bard = bax * dx + bay * dy + baz * dz;
    const baoa = bax * oax + bay * oay + baz * oaz;
    const rdoa = dx * oax + dy * oay + dz * oaz;
    const oaoa = oax * oax + oay * oay + oaz * oaz;
    const A = baba * dd - bard * bard;
    if (A > 1e-12 * baba * dd) {
      const Bh = baba * rdoa - baoa * bard;
      const C = baba * oaoa - baoa * baoa - r * r * baba;
      const h = Bh * Bh - A * C;
      if (h >= 0) {
        const sq = Math.sqrt(h);
        let c0 = (-Bh - sq) / A,
          c1 = (-Bh + sq) / A;
        // Clip to the slab between the end caps.
        if (Math.abs(bard) > 1e-12) {
          let s0 = -baoa / bard,
            s1 = (baba - baoa) / bard;
          if (s0 > s1) {
            const tmp = s0;
            s0 = s1;
            s1 = tmp;
          }
          if (s0 > c0) c0 = s0;
          if (s1 < c1) c1 = s1;
        } else if (baoa < 0 || baoa > baba) c1 = -Infinity;
        if (c0 <= c1) {
          if (c0 < t0) t0 = c0;
          if (c1 > t1) t1 = c1;
        }
      }
    }
  }
  if (t0 > t1) return null;
  SPAN[0] = t0;
  SPAN[1] = t1;
  return SPAN;
}

// Nearest capsule hit along a ray: { t, tExit, part, nx, ny, nz } or null.
// d should be a unit vector (then t is in meters). maxDist limits the entry.
export function raycastHitboxes(hitboxes, ox, oy, oz, dx, dy, dz, maxDist = Infinity) {
  let best = null;
  for (let i = 0; i < hitboxes.length; i++) {
    const h = hitboxes[i];
    const span = rayCapsule(ox, oy, oz, dx, dy, dz, h.ax, h.ay, h.az, h.bx, h.by, h.bz, h.r);
    if (!span) continue;
    const [s0, s1] = span;
    if (s1 < 0) continue;
    const t = Math.max(0, s0);
    if (t > maxDist || (best && t >= best.t)) continue;
    // Surface normal at the entry point.
    const px = ox + dx * t,
      py = oy + dy * t,
      pz = oz + dz * t;
    const bax = h.bx - h.ax,
      bay = h.by - h.ay,
      baz = h.bz - h.az;
    const baba = bax * bax + bay * bay + baz * baz;
    let k = baba > 0 ? ((px - h.ax) * bax + (py - h.ay) * bay + (pz - h.az) * baz) / baba : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    let nx = px - (h.ax + bax * k),
      ny = py - (h.ay + bay * k),
      nz = pz - (h.az + baz * k);
    const nl = Math.hypot(nx, ny, nz);
    if (nl > 1e-9 && s0 >= 0) {
      nx /= nl;
      ny /= nl;
      nz /= nl;
    } else {
      // Started inside: report the normal facing back along the ray.
      const dl = Math.hypot(dx, dy, dz) || 1;
      nx = -dx / dl;
      ny = -dy / dl;
      nz = -dz / dl;
    }
    best = { t, tExit: s1, part: h.part, nx, ny, nz, index: i };
  }
  return best;
}
