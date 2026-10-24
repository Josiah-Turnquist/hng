// Shared building blocks for the gun models (magazines, trigger guards, sights,
// cartridges, lofted stocks...). Not a model registry: nothing here is listed in
// MODELS. Same conventions as kit.js: meters, bore along Z at x = y = 0, muzzle
// toward -Z, trigger at z = 0, side-view outlines as [z, y] pairs.
// loft() and arcTube() build their own geometry and hand it to GunBuilder._add()
// (the same path kit.js uses), so materials, UVs and parts work as usual.
import * as THREE from 'three';
import { GunBuilder } from './kit.js';

export const S = GunBuilder.smooth;

const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);

// Build a sub-assembly in its own local frame, then move it into place:
// everything added by build() (in any part) is transformed by T(pos) * R(rot).
// rot = [rx, ry, rz] Euler angles applied in `order`. Returns the matrix, so
// anchors can be placed with at(m, [x, y, z]).
export function place(b, { pos = [0, 0, 0], rot = [0, 0, 0], order = 'XYZ' }, build) {
  const counts = {};
  for (const [k, p] of Object.entries(b.parts)) counts[k] = p.items.length;
  const cur = b.current;
  build();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], order)), _one);
  for (const [k, p] of Object.entries(b.parts)) {
    for (let i = counts[k] || 0; i < p.items.length; i++) p.items[i].geo.applyMatrix4(m);
  }
  b.current = cur;
  return m;
}

// Transform a local point by a matrix returned from place().
export function at(m, p) {
  _v.set(p[0], p[1], p[2]).applyMatrix4(m);
  return [_v.x, _v.y, _v.z];
}

// Regular polygon approximating a circle (for holes and round outlines).
export function circle(cz, cy, r, n = 16, ry = r) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cz + Math.cos(a) * r, cy + Math.sin(a) * ry]);
  }
  return out;
}

// Stadium-shaped slot from z0 to z1 at height y, half-height r.
export function slot(z0, z1, y, r, n = 6) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI;
    out.push([z0 + r + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    out.push([z1 - r + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return out;
}

// Offset a closed polygon by d (positive = outward), mitered.
export function offset(points, d) {
  const n = points.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i],
      [x1, y1] = points[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  const sgn = area > 0 ? 1 : -1; // CCW: outward normal of edge (dx, dy) is (dy, -dx)
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n],
      p1 = points[i],
      p2 = points[(i + 1) % n];
    const n0 = norm([(p1[1] - p0[1]) * sgn, -(p1[0] - p0[0]) * sgn]);
    const n1 = norm([(p2[1] - p1[1]) * sgn, -(p2[0] - p1[0]) * sgn]);
    let m = norm([n0[0] + n1[0], n0[1] + n1[1]]);
    const cosh = Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
    out.push([p1[0] + (m[0] * d) / cosh, p1[1] + (m[1] * d) / cosh]);
  }
  return out;
}

function norm([x, y]) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

// Points along a bent centerline: starts at `top` heading down, tilted `angle`
// (rad, + = bottom forward toward -Z), curving forward with curvature k (1/m).
// Returns [{ c: [z, y], n: [nz, ny] (forward normal), t: [tz, ty] (down tangent) }].
export function bentLine(top, len, angle = 0, k = 0, steps = 10) {
  const out = [];
  let [z, y] = top;
  const ds = len / steps;
  for (let i = 0; i <= steps; i++) {
    const th = angle + k * i * ds;
    const t = [-Math.sin(th), -Math.cos(th)];
    out.push({ c: [z, y], t, n: [-Math.cos(th), Math.sin(th)] });
    const thm = angle + k * (i + 0.5) * ds;
    z += -Math.sin(thm) * ds;
    y += -Math.cos(thm) * ds;
  }
  return out;
}

// Box magazine, straight or curved, seen from the side and extruded across.
// top = [z, y] center of its top (the mag well), len along the body, depth =
// front-to-back size, width = thickness across (x). angle/k as in bentLine.
// depthBottom: depth at the bottom end if it differs from the top.
// Adds a floor plate and a pressed rib on the sides. Returns { bottom, line }.
export function boxMag(b, { top, len, depth, width, angle = 0, k = 0, mat = 'steel', x = 0, depthBottom = depth, plate = 0.006, lip = 0.0015, rib = true, ribMat = null, bevel = 0.0012 }) {
  const line = bentLine(top, len, angle, k, 12);
  const N = line.length - 1;
  const half = (i) => (depth + (depthBottom - depth) * (i / N)) / 2;
  const front = line.map(({ c, n }, i) => [c[0] + n[0] * half(i), c[1] + n[1] * half(i)]);
  const back = line.map(({ c, n }, i) => [c[0] - n[0] * half(i), c[1] - n[1] * half(i)]);
  b.extrude({ points: [...front, ...back.reverse()], width, x, mat, bevel });
  const last = line[N];
  if (plate > 0) {
    // Floor plate: a short wider block at the bottom end.
    const hb = half(N) + lip;
    const { c, n, t } = last;
    const p = (s, f) => [c[0] + n[0] * f + t[0] * s, c[1] + n[1] * f + t[1] * s];
    b.extrude({ points: [p(-plate, hb), p(0.0015, hb - 0.0005), p(0.0015, -hb + 0.0005), p(-plate, -hb)], width: width + 2 * lip, x, mat, bevel: 0.001 });
  }
  if (rib) {
    // Raised pressed panel along the middle of each side.
    const i0 = 2,
      i1 = N - 2;
    const pts = [];
    for (let i = i0; i <= i1; i++) {
      const { c, n } = line[i];
      const h = half(i) * 0.35;
      pts.push([c[0] + n[0] * h, c[1] + n[1] * h]);
    }
    for (let i = i1; i >= i0; i--) {
      const { c, n } = line[i];
      const h = half(i) * 0.35;
      pts.push([c[0] - n[0] * h, c[1] - n[1] * h]);
    }
    b.extrude({ points: pts, width: width + 0.0016, x, mat: ribMat || mat, bevel: 0.0007 });
  }
  return { bottom: last.c, line };
}

// Trigger guard loop (side profile with the finger hole), top edge at yTop
// (usually tucked into the stock), from zf (front) to zr (rear).
export function guard(b, { zf, zr, yTop, yBot, t = 0.0035, w = 0.009, mat = 'steel', rake = 0, frontRake = 0, x = 0 }) {
  const L = zr - zf,
    h = yTop - yBot;
  const outer = S(
    [
      [zf + frontRake, yTop],
      [zf - 0.002 + frontRake * 0.5, yTop - 0.45 * h],
      [zf + 0.22 * L, yBot],
      [zr - 0.25 * L, yBot - 0.001],
      [zr + rake * 0.4, yBot + 0.4 * h],
      [zr + rake, yTop],
      [(zf + zr) / 2, yTop + 0.003],
    ],
    5,
  );
  b.extrude({ points: outer, holes: [offset(outer, -t)], width: w, x, mat, bevel: Math.min(0.0012, t * 0.3) });
}

// Curved trigger blade. (z, yTop) = top of the face; hangs down `len`, curving
// back by `curve`. Face toward -Z.
export function trigger(b, { z = 0, yTop, len = 0.022, curve = 0.006, thick = 0.0055, w = 0.0055, mat = 'steel', x = 0 }) {
  const face = S(
    [
      [z, yTop],
      [z - 0.0015, yTop - len * 0.45],
      [z + curve * 0.45, yTop - len * 0.85],
      [z + curve, yTop - len],
    ],
    4,
    false,
  );
  const backEdge = S(
    [
      [z + curve + 0.0022, yTop - len + 0.0008],
      [z + curve * 0.5 + thick * 0.55, yTop - len * 0.8],
      [z + thick * 0.75, yTop - len * 0.4],
      [z + thick, yTop],
    ],
    4,
    false,
  );
  b.extrude({ points: [...face, ...backEdge], width: w, x, mat, bevel: 0.0008 });
}

// Flat plate in the X-Y plane (facing along Z) with an optional round hole:
// rear sight apertures, notch plates, blast shields. outline = [[x, y], ...]
// in gun X/Y; z = plate center; thick along Z.
export function plateXY(b, { outline, holes = [], z, thick, mat = 'steel', bevel = 0.0004 }) {
  // Draw in the extrude's [z, y] plane with z standing in for -x, then turn
  // 90 deg about Y so the extrusion axis becomes Z.
  return place(b, { pos: [0, 0, z], rot: [0, -Math.PI / 2, 0] }, () => {
    b.extrude({ points: outline.map(([px, py]) => [-px, py]), holes: holes.map((h) => h.map(([px, py]) => [-px, py])), width: thick, mat, bevel });
  });
}

// kit.lathe() faces outward only when the profile runs from the breech toward
// the muzzle (decreasing z). This wrapper orients any profile correctly.
export function lathe(b, opts) {
  const q = opts.profile;
  // Close the outline down to the axis at both ends to get its winding.
  const p = [...q, [0, q[q.length - 1][1]], [0, q[0][1]]];
  let area = 0;
  for (let i = 0; i < p.length; i++) {
    const [r0, z0] = p[i],
      [r1, z1] = p[(i + 1) % p.length];
    area += z0 * r1 - z1 * r0;
  }
  return b.lathe({ ...opts, profile: area < 0 ? [...q].reverse() : q });
}

// Thick-walled tube along Z (front sight hoods, jackets, rings).
export function tube(b, { x = 0, y = 0, z0, z1, rIn, rOut, rOut1 = rOut, rIn1 = rIn, mat = 'steel', seg = 20 }) {
  return lathe(b, {
    x,
    y,
    mat,
    seg,
    profile: [
      [rIn, z0],
      [rOut, z0],
      [rOut1, z1],
      [rIn1, z1],
      [rIn, z0],
    ],
  });
}

// A cartridge lying parallel to the bore, nose toward -Z. (x, y) = axis,
// zBase = case head. Dimensions in meters (rim radius, case length...).
export function cartridge(b, { x = 0, y = 0, zBase, caseLen, oal, rRim, rNeck = null, rBullet, shoulder = 0.8, caseMat = 'brass', bulletMat = 'brass', seg = 10 }) {
  const rn = rNeck ?? rBullet + 0.0004;
  const zs = zBase - caseLen * shoulder;
  const zn = zBase - caseLen;
  lathe(b, {
    x,
    y,
    seg,
    mat: caseMat,
    profile: [
      [0, zBase],
      [rRim, zBase],
      [rRim, zBase - 0.0012],
      [rRim * 0.85, zBase - 0.0016],
      [rRim * 0.85, zBase - 0.0024],
      [rRim * 0.98, zBase - 0.0032],
      [rRim * 0.94, zs],
      [rn, zs - Math.min(0.004, caseLen * 0.06)],
      [rn, zn],
      [rBullet, zn],
    ],
  });
  const bl = oal - caseLen;
  lathe(b, {
    x,
    y,
    seg,
    mat: bulletMat,
    profile: [
      [rBullet, zn + 0.0005],
      [rBullet, zn - bl * 0.35],
      [rBullet * 0.78, zn - bl * 0.7],
      [rBullet * 0.35, zn - bl * 0.95],
      [0, zBase - oal],
    ],
  });
}

// Sling swivel: small loop in the Z-Y plane.
export function swivel(b, { x = 0, y, z, r = 0.009, t = 0.0022, w = 0.003, mat = 'steel', sy = 1 }) {
  const outer = circle(z, y, r, 14, r * sy);
  b.extrude({ points: outer, holes: [circle(z, y, r - t, 14, (r - t) * sy)], width: w, x, mat, bevel: 0.0006 });
}

// Smooth width profile along Z for extrude({ taper }): keys = [[z, factor], ...]
// in increasing z; eased (cosine) between keys, flat beyond the ends.
export function taperZ(keys) {
  return (z) => {
    if (z <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (z <= keys[i][0]) {
        const [z0, f0] = keys[i - 1],
          [z1, f1] = keys[i];
        const t = (z - z0) / (z1 - z0);
        return f0 + (f1 - f0) * (0.5 - 0.5 * Math.cos(Math.PI * t));
      }
    }
    return keys[keys.length - 1][1];
  };
}

// Closed outline through control points: [z, y] = smooth, [z, y, 1] = sharp
// corner (no overshoot, e.g. butt plate corners). Runs between corners are
// open Catmull-Rom splines.
export function path(pts, perSeg = 4) {
  const n = pts.length;
  const corners = [];
  pts.forEach((p, i) => p[2] && corners.push(i));
  if (!corners.length) return S(pts.map((p) => [p[0], p[1]]), perSeg);
  const out = [];
  for (let c = 0; c < corners.length; c++) {
    const i0 = corners[c],
      i1 = corners[(c + 1) % corners.length];
    const run = [[pts[i0][0], pts[i0][1]]];
    for (let i = (i0 + 1) % n; ; i = (i + 1) % n) {
      run.push([pts[i][0], pts[i][1]]);
      if (i === i1) break;
    }
    const seg = run.length === 2 ? run : S(run, perSeg, false);
    out.push(...seg.slice(0, -1));
  }
  return out;
}

// Lofted solid for wooden stocks: the side outline (closed [z, y] polygon, as
// for extrude) is sliced along Z; each slice becomes a rounded rectangle of
// width width * taper(z) with corner radii rTop / rBot (numbers or z => r).
// Gives smooth, evenly shaded stocks with truly rounded edges (no long
// triangles bent by a taper). Ends are closed with flat caps.
export function loft(b, { points, width, taper = null, r = 0.007, rTop = r, rBot = r, mat, x = 0, step = 0.005, seg = 4 }) {
  // Coarser slices and corners at the soldier LODs.
  if (b.lod === 1) {
    step = Math.max(step, 0.015);
    seg = Math.min(seg, 2);
  } else if (b.lod === 2) {
    step = Math.max(step, 0.06);
    seg = 1;
  }
  const n = points.length;
  let zmin = Infinity,
    zmax = -Infinity;
  for (const [z] of points) {
    if (z < zmin) zmin = z;
    if (z > zmax) zmax = z;
  }
  const N = Math.ceil((zmax - zmin) / step);
  let zs = [];
  for (let i = 0; i <= N; i++) zs.push(zmin + ((zmax - zmin) * i) / N);
  for (const [z] of points) zs.push(z);
  zs.sort((a, c) => a - c);
  zs = zs.filter((z, i) => i === 0 || z - zs[i - 1] > 3e-4);
  zs[0] = zmin + 2e-5;
  zs[zs.length - 1] = zmax - 2e-5;
  const slices = [];
  for (const z of zs) {
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const [z0, y0] = points[i],
        [z1, y1] = points[(i + 1) % n];
      if ((z - z0) * (z - z1) > 0) continue;
      if (Math.abs(z1 - z0) < 1e-9) {
        lo = Math.min(lo, y0, y1);
        hi = Math.max(hi, y0, y1);
        continue;
      }
      const y = y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    if (hi - lo > 2e-4) slices.push({ z, lo, hi });
  }
  const fr = (v, z) => (typeof v === 'function' ? v(z) : v);
  // Ring of points around a rounded-rectangle section, starting at the bottom
  // center (where the UV seam goes).
  const ring = ({ z, lo, hi }) => {
    const W = width * (taper ? taper(z, (lo + hi) / 2) : 1);
    const H = hi - lo;
    const rt = Math.max(0, Math.min(fr(rTop, z), W / 2 - 1e-5, H / 2 - 1e-5));
    const rb = Math.max(0, Math.min(fr(rBot, z), W / 2 - 1e-5, H / 2 - 1e-5));
    const pts = [[x, lo, z]];
    const corner = (cx, cy, rr, a0) => {
      for (let k = 0; k <= seg; k++) {
        const a = a0 + (k / seg) * (Math.PI / 2);
        pts.push([x + cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z]);
      }
    };
    corner(W / 2 - rb, lo + rb, rb, -Math.PI / 2);
    corner(W / 2 - rt, hi - rt, rt, 0);
    corner(-W / 2 + rt, hi - rt, rt, Math.PI / 2);
    corner(-W / 2 + rb, lo + rb, rb, Math.PI);
    return pts;
  };
  const rings = slices.map(ring);
  const M = rings[0].length;
  // Smooth normals from a closed (wrapped) mesh...
  const posW = [];
  for (const rg of rings) for (const p of rg) posW.push(...p);
  const idxW = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j,
        bb = i * M + ((j + 1) % M),
        c = (i + 1) * M + ((j + 1) % M),
        d = (i + 1) * M + j;
      idxW.push(a, bb, c, a, c, d);
    }
  }
  const gW = new THREE.BufferGeometry();
  gW.setAttribute('position', new THREE.Float32BufferAttribute(posW, 3));
  gW.setIndex(idxW);
  gW.computeVertexNormals();
  const nW = gW.attributes.normal;
  // ...then an open mesh with the seam column duplicated, so the wood grain
  // can run along Z with v = arc length around the section.
  const material = typeof mat === 'string' ? b.mats[mat] : mat;
  const sUV = 1 / ((material && material.userData.texWorld) || 0.3);
  const pos = [],
    nor = [],
    uv = [];
  rings.forEach((rg, i) => {
    let arc = 0;
    for (let j = 0; j <= M; j++) {
      const p = rg[j % M];
      if (j > 0) arc += Math.hypot(p[0] - rg[j - 1][0], p[1] - rg[j - 1][1]);
      pos.push(...p);
      const n = i * M + (j % M);
      nor.push(nW.getX(n), nW.getY(n), nW.getZ(n));
      uv.push(p[2] * sUV, arc * sUV);
    }
  });
  const idx = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j,
        bb = a + 1,
        c = (i + 1) * (M + 1) + j + 1,
        d = (i + 1) * (M + 1) + j;
      idx.push(a, bb, c, a, c, d);
    }
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  side.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  side.setIndex(idx);
  b._add(side, mat);
  side.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); // replace the planar UVs
  // Flat end caps.
  for (const [rg, s, front] of [
    [rings[0], slices[0], true],
    [rings[rings.length - 1], slices[slices.length - 1], false],
  ]) {
    const cp = [];
    const c = [x, (s.lo + s.hi) / 2, s.z];
    for (let j = 0; j < M; j++) {
      const p0 = rg[j],
        p1 = rg[(j + 1) % M];
      if (front) cp.push(...c, ...p1, ...p0);
      else cp.push(...c, ...p0, ...p1);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cap.computeVertexNormals();
    b._add(cap, mat);
  }
}

// Open tube along Z covering only part of the circumference (e.g. the MG 42
// jacket with its barrel-change opening). Angles in radians, measured in the
// X-Y plane from +X toward +Y; gap = the uncovered sector.
export function arcTube(b, { x = 0, y = 0, z0, z1, r, gapCenter = 0, gap = 0.8, mat = 'perforated', seg = 26 }) {
  const len = Math.abs(z1 - z0);
  const geo = new THREE.CylinderGeometry(r, r, len, seg, 1, true, 0, Math.PI * 2 - gap);
  // CylinderGeometry: theta measured from +Z toward +X around Y. Turn Y -> Z.
  geo.rotateX(Math.PI / 2);
  // After that, theta = 0 sits at -Y and the uncovered sector spans
  // [3pi/2 - gap, 3pi/2]; rotate it so it is centered on gapCenter.
  geo.rotateZ(gapCenter + gap / 2 - (3 * Math.PI) / 2);
  return b._add(geo, mat, { x, y, z: (z0 + z1) / 2 });
}
