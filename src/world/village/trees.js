// Plane trees for the square and fruit trees for gardens: a tapered trunk with a few
// limbs and a crown of alpha-tested leaf cards whose normals point out from the crown
// center (so the crown shades like a soft volume instead of flat cards).
import * as THREE from 'three';
import { RNG } from '../../core/math.js';
import { FLAG_BULLET, FLAG_SIGHT, FLAG_DEFAULT } from '../../physics/collision.js';
import { mat4 } from './geom.js';
import { rgb } from './materials.js';

const TAU = Math.PI * 2;
const BARK = rgb(0.74, 0.72, 0.66);

function cylinderBetween(a, b, r0, r1, seg = 7) {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  // Bark UVs in meters / 1.2 m texture.
  const uv = g.attributes.uv;
  const circ = (TAU * (r0 + r1)) / 2;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / 1.2, (uv.getY(i) * len) / 1.2);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

// A crown made of leaf clumps; returns a merged-ready BufferGeometry with colors.
function crown(r, center, radii, clumps, cardSize, tint) {
  const pos = [],
    nor = [],
    uv = [],
    col = [],
    idx = [];
  const tmp = new THREE.Vector3();
  const e = new THREE.Euler();
  const m = new THREE.Matrix4();
  let n = 0;
  for (let k = 0; k < clumps.length; k++) {
    const c = clumps[k];
    const shade = r.range(0.8, 1.12);
    const yellow = r.chance(0.15) ? 0.12 : 0;
    const cc = [tint[0] * shade + yellow, tint[1] * shade + yellow * 0.6, tint[2] * shade];
    for (let q = 0; q < 3; q++) {
      e.set(r.range(-1.2, 1.2), r.next() * TAU, r.range(-1.2, 1.2));
      m.makeRotationFromEuler(e);
      const sz = cardSize * r.range(0.8, 1.2);
      const corners = [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ];
      const base = n;
      for (const [u, v] of corners) {
        tmp.set(u * sz, v * sz, 0).applyMatrix4(m);
        const px = c[0] + tmp.x,
          py = c[1] + tmp.y,
          pz = c[2] + tmp.z;
        pos.push(px, py, pz);
        // Normal: mostly away from the crown center.
        let nx = (px - center[0]) / radii[0],
          ny = (py - center[1]) / radii[1] + 0.35,
          nz = (pz - center[2]) / radii[2];
        const l = Math.hypot(nx, ny, nz) || 1;
        nor.push(nx / l, ny / l, nz / l);
        uv.push(u + 0.5, v + 0.5);
        col.push(cc[0], cc[1], cc[2]);
        n++;
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function buildTrees(B, plan, ctx) {
  for (const t of plan.trees) {
    const r = new RNG(t.seed ?? 1);
    const y = ctx.hf.getHeight(t.x, t.z) - 0.05;
    const f = B.frame(t.x, y, t.z, r.next() * TAU, { tag: 'tree' });
    if (t.kind === 'plane') planeTree(f, r, t.size ?? 1);
    else fruitTree(f, r, t.size ?? 1);
  }
}

function planeTree(f, r, s) {
  const H = 4.4 * s;
  const r0 = 0.34 * s,
    r1 = 0.24 * s;
  const lean = [r.range(-0.25, 0.25), H, r.range(-0.25, 0.25)];
  f.geometry('bark', cylinderBetween([0, -0.2, 0], lean, r0, r1, 9), null, { uv: 'keep', color: BARK });
  const crownC = [lean[0], H + 3.4 * s, lean[2]];
  const radii = [4.4 * s, 3.3 * s, 4.4 * s];
  const clumps = [];
  const limbs = r.int(4, 5);
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * TAU + r.range(-0.3, 0.3);
    const L = r.range(2.6, 3.6) * s;
    const end = [lean[0] + Math.cos(a) * L * 0.8, H + r.range(2.4, 3.6) * s, lean[2] + Math.sin(a) * L * 0.8];
    f.geometry('bark', cylinderBetween(lean, end, 0.17 * s, 0.08 * s, 6), null, { uv: 'keep', color: BARK });
    // Twig fork.
    const end2 = [end[0] + Math.cos(a + 0.6) * 1.2 * s, end[1] + 1.0 * s, end[2] + Math.sin(a + 0.6) * 1.2 * s];
    f.geometry('bark', cylinderBetween(end, end2, 0.08 * s, 0.04 * s, 5), null, { uv: 'keep', color: BARK });
    clumps.push(end, end2);
  }
  for (let k = 0; k < 30; k++) {
    // Points inside the crown ellipsoid, biased to the surface.
    const u = r.next() * TAU,
      v = Math.acos(r.range(-0.55, 1)),
      rr = Math.pow(r.next(), 0.35);
    clumps.push([crownC[0] + Math.sin(v) * Math.cos(u) * radii[0] * rr, crownC[1] + Math.cos(v) * radii[1] * rr, crownC[2] + Math.sin(v) * Math.sin(u) * radii[2] * rr]);
  }
  f.geometry('leaves', crown(r, crownC, radii, clumps, 2.7 * s, rgb(0.95, 1.0, 0.92)), null, { uv: 'keep', vertexColors: true });
  f.collider(lean[0] / 2, H / 2, lean[2] / 2, r0 * 0.8, H / 2 + 0.2, r0 * 0.8, null, 'wood', FLAG_DEFAULT, true);
  f.collider(crownC[0], crownC[1], crownC[2], radii[0] * 0.75, radii[1] * 0.75, radii[2] * 0.75, null, 'foliage', FLAG_BULLET | FLAG_SIGHT, false);
  f.cover(0.85, 0, 0, -1, 0, 'high');
  f.cover(-0.85, 0, 0, 1, 0, 'high');
}

function fruitTree(f, r, s) {
  const H = 1.5 * s;
  const mid = [r.range(-0.2, 0.2), H, r.range(-0.2, 0.2)];
  f.geometry('bark', cylinderBetween([0, -0.1, 0], mid, 0.13 * s, 0.1 * s, 7), null, { uv: 'keep', color: rgb(0.62, 0.55, 0.5) });
  const crownC = [mid[0], H + 1.6 * s, mid[2]];
  const radii = [2.2 * s, 1.6 * s, 2.2 * s];
  const clumps = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + r.range(-0.4, 0.4);
    const end = [mid[0] + Math.cos(a) * 1.5 * s, H + r.range(1.0, 1.8) * s, mid[2] + Math.sin(a) * 1.5 * s];
    f.geometry('bark', cylinderBetween(mid, end, 0.07 * s, 0.04 * s, 5), null, { uv: 'keep', color: rgb(0.62, 0.55, 0.5) });
    clumps.push(end);
  }
  for (let k = 0; k < 14; k++) {
    const u = r.next() * TAU,
      v = Math.acos(r.range(-0.5, 1)),
      rr = Math.pow(r.next(), 0.4);
    clumps.push([crownC[0] + Math.sin(v) * Math.cos(u) * radii[0] * rr, crownC[1] + Math.cos(v) * radii[1] * rr, crownC[2] + Math.sin(v) * Math.sin(u) * radii[2] * rr]);
  }
  f.geometry('leaves', crown(r, crownC, radii, clumps, 1.7 * s, rgb(0.82, 0.9, 0.72)), null, { uv: 'keep', vertexColors: true });
  f.collider(0, H / 2, 0, 0.12, H / 2 + 0.1, 0.12, null, 'wood', FLAG_DEFAULT, true);
  f.collider(crownC[0], crownC[1], crownC[2], radii[0] * 0.75, radii[1] * 0.75, radii[2] * 0.75, null, 'foliage', FLAG_BULLET | FLAG_SIGHT, false);
}

// Exported for other modules (e.g. a churchyard cypress).
export function cypress(f, x, z, h) {
  const g = new THREE.ConeGeometry(0.9, h, 8, 3);
  f.geometry('leaves', g, mat4(x, h / 2 + 0.6, z), { color: rgb(0.45, 0.55, 0.42) });
}
