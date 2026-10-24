// Smooth shapes for gun models: stocks lofted from real cross-sections, pistol grips
// swept along a raked axis, bent round bars (bolt handles, guards, wire stocks,
// swivels), slotted screws and slings. Same conventions as kit.js (meters, bore
// along Z at x = y = 0, muzzle toward -Z, trigger at z = 0). Every function adapts
// its resolution to the builder's LOD (b.lod).
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { simplifyClosed, simplifyOpen } from './kit.js';
import { stampRect } from './materials.js';

const TAU = Math.PI * 2;

// Monotone cubic interpolation through [[x, y], ...] (x increasing): no overshoot
// between keys, flat beyond the ends. Returns f(x).
export function curve(keys) {
  const n = keys.length;
  if (n === 1) return () => keys[0][1];
  const xs = keys.map((k) => k[0]),
    ys = keys.map((k) => k[1]);
  const d = [],
    m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i],
      b = m[i + 1] / d[i],
      s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i],
      t = (x - xs[i]) / h,
      t2 = t * t,
      t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Mesh through rings of 3D points (every ring the same count, in the same rotational
// order). us[i] = texture u of ring i (meters, usually its z); v runs around the
// ring by arc length, so wood grain follows the part. Smooth normals around and
// along; flat caps on the open ends. The winding is fixed up so faces point out.
// openRing: the rings are open arcs (sheet panels): no face joins the last point
// back to the first, and no caps.
export function ringLoft(b, { rings, us = null, mat, capStart = true, capEnd = true, openRing = false }) {
  const R = rings.length,
    M = rings[0].length;
  if (openRing) capStart = capEnd = false;
  const J = openRing ? M - 1 : M; // quads around each ring
  // Orientation: faces point outward when the rings turn clockwise about the
  // direction of the loft (signed area of the first ring about that direction).
  const c0 = centroid(rings[0]);
  const dir = sub(centroid(rings[1]), c0);
  let area = 0;
  for (let j = 0; j < M; j++) area += dot(cross(sub(rings[0][j], c0), sub(rings[0][(j + 1) % M], c0)), dir);
  if (area > 0 && !openRing) rings = rings.map((r) => [...r].reverse());
  // Smooth normals from the closed (wrapped) mesh.
  const posW = new Float32Array(R * M * 3);
  rings.forEach((rg, i) => rg.forEach((p, j) => posW.set(p, (i * M + j) * 3)));
  const idxW = [];
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < J; j++) {
      const a = i * M + j,
        bb = i * M + ((j + 1) % M),
        c = (i + 1) * M + ((j + 1) % M),
        dd = (i + 1) * M + j;
      idxW.push(a, dd, c, a, c, bb);
    }
  }
  const gW = new THREE.BufferGeometry();
  gW.setAttribute('position', new THREE.BufferAttribute(posW, 3));
  gW.setIndex(idxW);
  gW.computeVertexNormals();
  const nW = gW.attributes.normal;
  // Open mesh with the seam duplicated for the UVs.
  const material = typeof mat === 'string' ? b.mats[mat] : mat;
  const sUV = 1 / ((material && material.userData.texWorld) || 0.3);
  const pos = new Float32Array(R * (M + 1) * 3),
    nor = new Float32Array(R * (M + 1) * 3),
    uv = new Float32Array(R * (M + 1) * 2);
  rings.forEach((rg, i) => {
    let arc = 0;
    const u = (us ? us[i] : rg[0][2]) * sUV;
    for (let j = 0; j <= M; j++) {
      const p = rg[j % M];
      if (j > 0) {
        const q = rg[j - 1];
        arc += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      }
      const k = i * (M + 1) + j;
      pos.set(p, k * 3);
      const n = i * M + (j % M);
      nor[k * 3] = nW.getX(n);
      nor[k * 3 + 1] = nW.getY(n);
      nor[k * 3 + 2] = nW.getZ(n);
      uv[k * 2] = u;
      uv[k * 2 + 1] = arc * sUV;
    }
  });
  const idx = [];
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < J; j++) {
      const a = i * (M + 1) + j,
        bb = a + 1,
        c = (i + 1) * (M + 1) + j + 1,
        dd = (i + 1) * (M + 1) + j;
      idx.push(a, dd, c, a, c, bb);
    }
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  side.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  side.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  side.setIndex(idx);
  side.userData.ownUV = true;
  b._add(side, mat);
  // Caps: fans from the ring centers, facing away from the neighboring ring.
  const caps = [];
  if (capStart) caps.push([rings[0], rings[1]]);
  if (capEnd) caps.push([rings[R - 1], rings[R - 2]]);
  for (const [rg, nb] of caps) {
    const c = centroid(rg);
    const away = sub(c, centroid(nb));
    const cp = [];
    for (let j = 0; j < M; j++) {
      const p0 = rg[j],
        p1 = rg[(j + 1) % M];
      const f = cross(sub(p0, c), sub(p1, c));
      if (dot(f, away) >= 0) cp.push(...c, ...p0, ...p1);
      else cp.push(...c, ...p1, ...p0);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cap.computeVertexNormals();
    b._add(cap, mat);
  }
  return side;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function centroid(r) {
  const c = [0, 0, 0];
  for (const p of r) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  return [c[0] / r.length, c[1] / r.length, c[2] / r.length];
}

// Keep only the rings needed to stay within tol of the full set (1D Douglas-Peucker
// over whole rings, linear interpolation between kept ones). Returns kept indices.
function decimateRings(rings, ts, tol) {
  const keep = new Set([0, rings.length - 1]);
  const rec = (a, b) => {
    if (b - a < 2) return;
    let worst = -1,
      wi = -1;
    for (let i = a + 1; i < b; i++) {
      const t = (ts[i] - ts[a]) / (ts[b] - ts[a]);
      let e = 0;
      for (let j = 0; j < rings[i].length; j++) {
        const p = rings[i][j],
          pa = rings[a][j],
          pb = rings[b][j];
        const dx = p[0] - (pa[0] + (pb[0] - pa[0]) * t),
          dy = p[1] - (pa[1] + (pb[1] - pa[1]) * t),
          dz = p[2] - (pa[2] + (pb[2] - pa[2]) * t);
        e = Math.max(e, dx * dx + dy * dy + dz * dz);
      }
      if (e > worst) {
        worst = e;
        wi = i;
      }
    }
    if (worst > tol * tol) {
      keep.add(wi);
      rec(a, wi);
      rec(wi, b);
    }
  };
  rec(0, rings.length - 1);
  return [...keep].sort((x, y) => x - y);
}

// Cross-section of a stock or grip: a superellipse (exponent n: 2 = oval, 4 = boxy)
// between y0 (bottom) and y1 (top), widest (w) at height fraction `belly`, narrowing
// to wTop / wBot fractions of w at the top and bottom. Optional channel: a round
// groove cut down into the top (barrel channel / receiver inletting), depth below
// the top and half-width. Returns M points starting at the bottom center, going
// toward +x first. x0 shifts the section sideways.
export function stockSection({ y0, y1, w, n = 2.6, wTop = 0.8, wBot = 0.8, belly = 0.5, chDepth = 0, chHalf = 0, x0 = 0 }, M) {
  const cy = (y0 + y1) / 2,
    hh = (y1 - y0) / 2;
  const pts = [];
  for (let j = 0; j < M; j++) {
    const th = -Math.PI / 2 + (j / M) * TAU;
    const c = Math.cos(th),
      s = Math.sin(th);
    let x = (w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n);
    let y = cy + hh * Math.sign(s) * Math.abs(s) ** (2 / n);
    const t = (y - y0) / (y1 - y0); // 0 bottom .. 1 top
    belly = Math.min(0.95, Math.max(0.05, belly));
    const k = t < belly ? wBot + (1 - wBot) * smooth01(t / belly) : 1 + (wTop - 1) * smooth01((t - belly) / (1 - belly));
    x *= k;
    if (chDepth > 0 && chHalf > 0 && Math.abs(x) < chHalf && t > 0.5) {
      const u = x / chHalf;
      y = Math.min(y, y1 - chDepth * Math.sqrt(1 - u * u));
    }
    pts.push([x0 + x, y]);
  }
  return pts;
}

const smooth01 = (t) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
};

// A stock (or any long smooth part) lofted along Z from cross-sections.
//   top, bottom: [[z, y], ...] outlines of the side view (interpolated smoothly).
//   width: [[z, w], ...] full width at the widest point.
//   n, wTop, wBot, belly, chDepth, chHalf, x0: [[z, value], ...] or a number, the
//   section shape along the stock (see stockSection).
//   z0, z1: extent (defaults to the outline's).
//   roundStart, roundEnd: length (m) over which the ends are rounded off, shrinking
//   toward the section's center (roundAnchor 'center') or its bottom ('bottom').
export function stock(b, { top, bottom, width, n = 2.6, wTop = 0.82, wBot = 0.82, belly = 0.5, chDepth = 0, chHalf = 0, x0 = 0, z0, z1, mat, capStart = true, capEnd = true, rings: M0, roundStart = 0, roundEnd = 0, roundAnchor = 'center' }) {
  const fTop = curve(top),
    fBot = curve(bottom),
    fW = curve(width);
  const f = (v) => (typeof v === 'number' ? () => v : curve(v));
  const fN = f(n),
    fWT = f(wTop),
    fWB = f(wBot),
    fBel = f(belly),
    fChD = f(chDepth),
    fChH = f(chHalf),
    fX0 = f(x0);
  const za = z0 ?? Math.max(top[0][0], bottom[0][0]);
  const zb = z1 ?? Math.min(top[top.length - 1][0], bottom[bottom.length - 1][0]);
  const lod = b.lod;
  const M = M0 ? (lod === 0 ? M0 : lod === 1 ? Math.max(10, M0 >> 1) : 6) : lod === 0 ? 40 : lod === 1 ? 16 : 6;
  // Sample finely, then keep the rings needed for the LOD's tolerance.
  const N = Math.ceil((zb - za) / (lod === 0 ? 0.0025 : lod === 1 ? 0.006 : 0.015));
  const rings = [],
    ts = [];
  // Rounded ends: quarter-ellipse shrink, sampled more finely near the tip.
  const zsamp = [];
  for (let i = 0; i <= N; i++) zsamp.push(za + ((zb - za) * i) / N);
  const fine = lod === 0 ? 10 : lod === 1 ? 4 : 2;
  for (let k = 1; k < fine; k++) {
    const u = 1 - Math.cos(((k / fine) * Math.PI) / 2);
    if (roundStart > 0) zsamp.push(za + roundStart * u);
    if (roundEnd > 0) zsamp.push(zb - roundEnd * u);
  }
  zsamp.sort((a, c) => a - c);
  for (const z of zsamp) {
    let sec = stockSection(
      { y0: fBot(z), y1: fTop(z), w: fW(z), n: fN(z), wTop: fWT(z), wBot: fWB(z), belly: fBel(z), chDepth: fChD(z), chHalf: fChH(z), x0: fX0(z) },
      M,
    );
    let e = 0;
    if (roundStart > 0 && z < za + roundStart) e = 1 - (z - za) / roundStart;
    if (roundEnd > 0 && z > zb - roundEnd) e = Math.max(e, 1 - (zb - z) / roundEnd);
    if (e > 0) {
      const k = 0.25 + 0.75 * Math.sqrt(Math.max(0, 1 - e * e));
      const cx = fX0(z),
        cy = roundAnchor === 'bottom' ? fBot(z) : (fBot(z) + fTop(z)) / 2;
      sec = sec.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
    }
    rings.push(sec.map(([x, y]) => [x, y, z]));
    ts.push(z);
  }
  const tol = lod === 0 ? 0.00012 : lod === 1 ? 0.0008 : 0.004;
  const kept = decimateRings(rings, ts, tol);
  ringLoft(b, { rings: kept.map((i) => rings[i]), us: kept.map((i) => ts[i]), mat, capStart, capEnd });
  // Queries for fitting hardware to the wood.
  const params = (z) => ({ y0: fBot(z), y1: fTop(z), w: fW(z), n: fN(z), wTop: fWT(z), wBot: fWB(z), belly: fBel(z), chDepth: fChD(z), chHalf: fChH(z), x0: fX0(z) });
  return {
    top: fTop,
    bottom: fBot,
    width: fW,
    params,
    sectionAt: (z, m = 48) => stockSection(params(z), m),
    // Half-width of the wood at height y (outside face, for discs and grommets).
    halfWidth(z, y) {
      const p = stockSection({ ...params(z), chDepth: 0 }, 96);
      let best = 0;
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          c = p[(i + 1) % p.length];
        if ((a[1] - y) * (c[1] - y) <= 0 && a[1] !== c[1]) {
          const x = a[0] + ((c[0] - a[0]) * (y - a[1])) / (c[1] - a[1]);
          best = Math.max(best, Math.abs(x - (params(z).x0 || 0)));
        }
      }
      return best;
    },
  };
}

// Steel butt plate cupped over the end of a stock made with stock(): the end
// section grown by `lip`, from z0 to z1, with slotted screws at heights `screws`.
export function buttPlate(b, stk, { z0, z1, lip = 0.0011, mat = 'steel', screws = [] }) {
  const M = b.lod === 0 ? 48 : b.lod === 1 ? 16 : 6;
  const grow = (pts) => {
    let cx = 0,
      cy = 0;
    for (const p of pts) {
      cx += p[0];
      cy += p[1];
    }
    cx /= pts.length;
    cy /= pts.length;
    return pts.map(([x, y]) => {
      const dx = x - cx,
        dy = y - cy,
        l = Math.hypot(dx, dy) || 1;
      return [x + (dx / l) * lip, y + (dy / l) * lip];
    });
  };
  const zs = [z0, z0 + (z1 - z0) * 0.35, z1 - 0.0012, z1];
  const rings = zs.map((z) => grow(stk.sectionAt(z, M)).map(([x, y]) => [x, y, z]));
  // Round over the back edge slightly.
  const c = centroid(rings[3]);
  rings[3] = rings[3].map(([x, y, z]) => [c[0] + (x - c[0]) * 0.97, c[1] + (y - c[1]) * 0.985, z]);
  ringLoft(b, { rings, us: zs, mat });
  for (const y of screws) screw(b, { at: [0, y, z1], axis: 'z', r: 0.0036, h: 0.0012, mat, slot: 0 });
}

// Front-view (x-y) outline of a sheet-metal arch: arc between radii rIn and rOut
// around (cx, cy) from angle a0 to a1 (rad, counterclockwise from +x), with
// straight legs down to legY at both ends. M points per arc.
export function arch(cx, cy, rIn, rOut, a0, a1, legY, M = 24) {
  const out = [];
  const pt = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const e0 = pt(rOut, a0),
    e1 = pt(rOut, a1),
    i0 = pt(rIn, a0),
    i1 = pt(rIn, a1);
  out.push([e0[0], legY]);
  for (let k = 0; k <= M; k++) out.push(pt(rOut, a0 + ((a1 - a0) * k) / M));
  out.push([e1[0], legY], [i1[0], legY]);
  for (let k = M; k >= 0; k--) out.push(pt(rIn, a0 + ((a1 - a0) * k) / M));
  out.push([i0[0], legY]);
  return out;
}

// A part swept along a centerline in the side (z-y) plane: pistol grips, raked
// handles, curved magazines. path: [[z, y], ...] from the top down; sections(t)
// gives { w (width across x), f (half-depth toward the front, -z side), r (half-depth
// toward the rear), n (superellipse exponent) } for t = 0 (top) .. 1 (bottom).
// Rounded bottom: dome = how far the last sections shrink to close the end.
export function sweepGrip(b, { path, sections, mat, x0 = 0, dome = 0, capStart = true, capEnd = true, steps }) {
  const lod = b.lod;
  const M = lod === 0 ? 32 : lod === 1 ? 12 : 6;
  const S = steps ?? (lod === 0 ? 40 : lod === 1 ? 12 : 4);
  const fz = curve(path.map((p, i) => [i / (path.length - 1), p[0]]));
  const fy = curve(path.map((p, i) => [i / (path.length - 1), p[1]]));
  const rings = [],
    us = [];
  let len = 0,
    prev = null;
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const z = fz(t),
      y = fy(t);
    // Tangent down the grip, normal toward the front (-z side).
    const e = 1e-3;
    let tz = fz(Math.min(1, t + e)) - fz(Math.max(0, t - e)),
      ty = fy(Math.min(1, t + e)) - fy(Math.max(0, t - e));
    const tl = Math.hypot(tz, ty) || 1;
    tz /= tl;
    ty /= tl;
    // Front normal: rotate the downward tangent so it points to -z.
    let nz = -ty,
      ny = tz;
    if (nz > 0) {
      nz = -nz;
      ny = -ny;
    }
    let { w, f, r, n = 2.4 } = sections(t);
    if (dome > 0 && t > 1 - dome) {
      const k = Math.sqrt(Math.max(0, 1 - ((t - (1 - dome)) / dome) ** 2));
      w *= 0.35 + 0.65 * k;
      f *= 0.35 + 0.65 * k;
      r *= 0.35 + 0.65 * k;
    }
    const ring = [];
    for (let j = 0; j < M; j++) {
      const th = (j / M) * TAU;
      const c = Math.cos(th),
        s = Math.sin(th);
      const lx = (w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n);
      const d = (s >= 0 ? f : r) * Math.sign(s) * Math.abs(s) ** (2 / n);
      ring.push([x0 + lx, y + ny * d, z + nz * d]);
    }
    if (prev) len += Math.hypot(z - prev[0], y - prev[1]);
    prev = [z, y];
    rings.push(ring);
    us.push(len);
  }
  return ringLoft(b, { rings, us, mat, capStart, capEnd });
}

// Round bar bent along a 3D path (bolt handles, trigger guards, wire stocks, sling
// loops). pts: [[x, y, z], ...] (a smooth curve is fitted through them); r: radius,
// or [[t, r], ...] along the bar (t = 0..1). closed: a ring (swivel loops).
export function bar(b, { pts, r, mat, seg = 12, closed = false, steps, ry = null }) {
  const lod = b.lod;
  const M = b.seg(seg);
  const P = smoothPath3(pts, closed, steps ?? (lod === 0 ? 8 : lod === 1 ? 3 : 1));
  const fr = typeof r === 'number' ? () => r : curve(r);
  // Parallel-transport frames along the path.
  const T = P.map((p, i) => {
    const a = P[closed ? (i - 1 + P.length) % P.length : Math.max(0, i - 1)],
      c = P[closed ? (i + 1) % P.length : Math.min(P.length - 1, i + 1)];
    return norm(sub(c, a));
  });
  let N = perp(T[0]);
  const rings = [],
    us = [];
  let len = 0;
  for (let i = 0; i < P.length; i++) {
    if (i > 0) {
      const ax = cross(T[i - 1], T[i]);
      const s = Math.hypot(...ax);
      if (s > 1e-9) {
        const ang = Math.atan2(s, dot(T[i - 1], T[i]));
        N = rotate(N, norm(ax), ang);
      }
      len += Math.hypot(...sub(P[i], P[i - 1]));
    }
    const B = cross(T[i], N);
    const t = closed ? i / P.length : i / (P.length - 1);
    const rad = fr(t);
    const rr = ry ? ry : 1;
    const ring = [];
    for (let j = 0; j < M; j++) {
      const a = (j / M) * TAU;
      const c = Math.cos(a) * rad,
        s = Math.sin(a) * rad * rr;
      ring.push([P[i][0] + N[0] * c + B[0] * s, P[i][1] + N[1] * c + B[1] * s, P[i][2] + N[2] * c + B[2] * s]);
    }
    rings.push(ring);
    us.push(len);
  }
  if (closed) {
    rings.push(rings[0]);
    us.push(len + Math.hypot(...sub(P[0], P[P.length - 1])));
  }
  return ringLoft(b, { rings, us, mat, capStart: !closed, capEnd: !closed });
}

function smoothPath3(pts, closed, perSeg) {
  if (perSeg <= 1 || pts.length < 3) return pts.map((p) => [...p]);
  const curve3 = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(...p)),
    closed,
    'centripetal',
  );
  const n = (pts.length - (closed ? 0 : 1)) * perSeg;
  const out = [];
  for (let i = 0; i <= n; i++) {
    if (closed && i === n) break;
    const v = curve3.getPoint(i / n);
    out.push([v.x, v.y, v.z]);
  }
  return out;
}

const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function perp(t) {
  const a = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return norm(cross(cross(t, a), t));
}
function rotate(v, k, a) {
  // Rodrigues' rotation of v about unit axis k by angle a.
  const c = Math.cos(a),
    s = Math.sin(a);
  const kv = cross(k, v),
    kd = dot(k, v);
  return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)];
}

// Slotted screw head sitting on a surface: at = center of the head's base, axis =
// 'x' | '-x' | 'y' | '-y' | 'z' | '-z' (the way the head faces), r = head radius,
// h = head height (domed), slot = angle of the slot (rad, around the axis).
// First-person detail only.
export function screw(b, { at, axis = 'x', r = 0.003, h = 0.0012, slot = 0.4, mat = 'steel', dome = true }) {
  if (!b.detail(0)) return;
  const sgn = axis[0] === '-' ? -1 : 1;
  const ax = axis.replace('-', '');
  const seg = 14;
  // Head as a lathe along +Y, then turned to the axis.
  const prof = dome
    ? [
        [0, h],
        [r * 0.55, h * 0.92],
        [r * 0.85, h * 0.62],
        [r, h * 0.2],
        [r, 0],
        [0, 0],
      ]
    : [
        [0, h],
        [r * 0.92, h],
        [r, h * 0.7],
        [r, 0],
        [0, 0],
      ];
  const geo = new THREE.LatheGeometry(
    prof.map(([x, y]) => new THREE.Vector2(x, y)).reverse(),
    seg,
  );
  // Slot: a thin dark box across the head.
  const slotGeo = new THREE.BoxGeometry(r * 2.05, h * 0.9, r * 0.32);
  slotGeo.translate(0, h * 0.75, 0);
  slotGeo.rotateY(slot);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ax === 'x' ? sgn : 0, ax === 'y' ? sgn : 0, ax === 'z' ? sgn : 0));
  for (const [g, m] of [
    [geo, mat],
    [slotGeo, 'black'],
  ]) {
    g.applyQuaternion(q);
    g.translate(at[0], at[1], at[2]);
    b._add(g, m);
  }
}

// Flush pin or rivet head: a short cylinder through a part along an axis, showing
// as a slightly raised disc on each face. at = center, len = through length.
export function pin(b, { at, axis = 'x', r = 0.0015, len = 0.02, mat = 'steel', head = 0.0003 }) {
  if (!b.detail(0)) return;
  b.cylAxis({ axis, x: at[0], y: at[1], z: at[2], len: len + head * 2, r, mat, seg: 10 });
}

// A strap hanging between two points (rifle sling): sags by `sag` (m) below the
// straight line, flat section width x thick, the flat side facing `face` (a vector
// roughly perpendicular to the strap).
export function strap(b, { a, b: e, sag = 0.08, width = 0.03, thick = 0.003, mat = 'leather', face = [1, 0, 0], twist = 0 }) {
  const lod = b.lod;
  const S = lod === 0 ? 40 : lod === 1 ? 14 : 4;
  const pts = [];
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const sg = 4 * t * (1 - t) * sag;
    pts.push([a[0] + (e[0] - a[0]) * t, a[1] + (e[1] - a[1]) * t - sg, a[2] + (e[2] - a[2]) * t]);
  }
  const rings = [],
    us = [];
  let len = 0;
  for (let i = 0; i <= S; i++) {
    const p = pts[i];
    const T = norm(sub(pts[Math.min(S, i + 1)], pts[Math.max(0, i - 1)]));
    let F = norm(sub(face, T.map((v) => v * dot(face, T))));
    const ang = twist * (i / S);
    if (ang) F = rotate(F, T, ang);
    const W = cross(T, F); // across the strap
    const hw = width / 2,
      ht = thick / 2;
    // Each corner twice, so the flat faces get their own normals.
    const corners = [
      [-hw, -ht],
      [hw, -ht],
      [hw, -ht],
      [hw, ht],
      [hw, ht],
      [-hw, ht],
      [-hw, ht],
      [-hw, -ht],
    ];
    rings.push(corners.map(([u, v]) => [p[0] + W[0] * u + F[0] * v, p[1] + W[1] * u + F[1] * v, p[2] + W[2] * u + F[2] * v]));
    if (i > 0) len += Math.hypot(...sub(p, pts[i - 1]));
    us.push(len);
  }
  return ringLoft(b, { rings, us, mat });
}

// Superellipse outline (n: 2 = ellipse, 4 = rounded box) centered at (cx, cy),
// width w, height h, as [[x, y], ...] with M points.
export function superellipse(cx, cy, w, h, n = 2.5, M = 32) {
  const pts = [];
  for (let j = 0; j < M; j++) {
    const th = (j / M) * TAU;
    const c = Math.cos(th),
      s = Math.sin(th);
    pts.push([cx + (w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n), cy + (h / 2) * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return pts;
}

// Sheet-steel band around a stock (barrel bands, nose caps): a superellipse ring
// from z0 to z1 that fits around the wood (y0..y1 high, w wide), sheet `thick`.
// holes: extra openings in the band's face as [[x, y], ...] lists (for a nose cap).
export function band(b, { z0, z1, y0, y1, w, n = 2.6, thick = 0.0015, mat = 'steel', holes = null, bevel = 0.0005 }) {
  const M = b.lod === 0 ? 40 : b.lod === 1 ? 16 : 8;
  const cy = (y0 + y1) / 2;
  const outer = superellipse(0, cy, w + 2 * thick, y1 - y0 + 2 * thick, n, M);
  const inner = holes ?? [superellipse(0, cy, w, y1 - y0, n, M)];
  return plateXYz(b, { outline: outer, holes: inner, z0, z1, mat, bevel });
}

// Plate in the X-Y plane extruded along Z from z0 to z1 (z0 < z1): front-view
// outlines of bands, nose caps, sight bases, receiver faces.
export function plateXYz(b, { outline, holes = [], z0, z1, mat, bevel = 0.0004, curveSegments = 1 }) {
  const thick = z1 - z0;
  const lod = b.lod;
  if (lod > 0) {
    const tol = lod === 1 ? 0.0004 : 0.0025;
    outline = simplifyClosed(outline, tol);
    holes = holes.map((h) => simplifyClosed(h, tol)).filter((h) => h.length >= 3);
  }
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const bev = lod > 0 ? 0 : Math.min(bevel, thick / 2 - 0.0001);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0002, thick - 2 * bev),
    bevelEnabled: bev > 0,
    bevelThickness: bev,
    bevelSize: bev,
    bevelOffset: -bev,
    bevelSegments: lod === 0 ? 2 : 1,
    curveSegments,
  });
  // Extruded along +Z from 0: move to z0 (+ bevel).
  geo.translate(0, 0, z0 + bev);
  return b._add(lod > 0 ? geo : toCreasedNormals(geo, 0.7), mat);
}

// Prism-like part lofted along Z from a section function: section(z) returns the
// same number of [x, y] points at every z (repeat a point to keep an edge crisp).
// zs: the stations (sample more where the section changes). caps: close the ends.
export function sectionLoft(b, { zs, section, mat, capStart = true, capEnd = true, openRing = false }) {
  const rings = zs.map((z) => section(z).map(([x, y]) => [x, y, z]));
  return ringLoft(b, { rings, us: zs, mat, capStart, capEnd, openRing });
}

// Repeat every listed corner point so the loft keeps sharp edges there:
// pts = [[x, y, sharp?], ...] -> [[x, y], ...].
export function crisp(pts) {
  const out = [];
  for (const p of pts) {
    out.push([p[0], p[1]]);
    if (p[2]) out.push([p[0], p[1]]);
  }
  return out;
}

// Evenly spaced stations from z0 to z1 with extra ones at the given z values.
export function stations(z0, z1, step, extra = []) {
  const n = Math.max(1, Math.ceil((z1 - z0) / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(z0 + ((z1 - z0) * i) / n);
  for (const z of extra) if (z > z0 && z < z1) out.push(z);
  out.sort((a, c) => a - c);
  return out.filter((z, i) => i === 0 || z - out[i - 1] > 1e-5);
}

// Knurled or toothed knob: a gear-shaped outline (teeth ridges around the edge)
// extruded along an axis ('x', 'y' or 'z'); at = center, len = thickness.
export function knurledKnob(b, { at, axis = 'x', r, len, teeth = 24, depth = 0.0005, mat = 'steel', chamfer = 0.0005 }) {
  const M = b.detail(0) ? teeth * 2 : b.detail(1) ? 12 : 6;
  const pts = [];
  for (let i = 0; i < M; i++) {
    const a = (i / M) * TAU;
    const rr = b.detail(0) ? r - (i % 2 ? depth : 0) : r - depth / 2;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const geo = plateGeo(b, pts, [], len, chamfer);
  geo.translate(0, 0, -len / 2);
  if (axis === 'x') geo.rotateY(Math.PI / 2);
  else if (axis === 'y') geo.rotateX(-Math.PI / 2);
  geo.translate(at[0], at[1], at[2]);
  return b._add(geo, mat);
}

// Extruded front-view plate geometry (not yet added): outline in x-y, along +Z
// from 0 to thick.
function plateGeo(b, outline, holes, thick, bevel) {
  const lod = b.lod;
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const bev = lod > 0 ? 0 : Math.min(bevel, thick / 2 - 0.0001);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0002, thick - 2 * bev),
    bevelEnabled: bev > 0,
    bevelThickness: bev,
    bevelSize: bev,
    bevelOffset: -bev,
    bevelSegments: lod === 0 ? 2 : 1,
    curveSegments: 1,
  });
  geo.translate(0, 0, bev);
  return lod > 0 ? geo : toCreasedNormals(geo, 0.7);
}

// Perforated round tube with proper cylindrical UVs (holes in even rows around).
export function perfTube(b, { z0, z1, r, x = 0, y = 0, mat = 'perforated', seg = 32 }) {
  const M = b.seg(seg);
  const ring = (z) => {
    const pts = [];
    for (let j = 0; j < M; j++) {
      const a = (j / M) * TAU;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, z]);
    }
    return pts;
  };
  return ringLoft(b, { rings: [ring(z0), ring(z1)], us: [z0, z1], mat, capStart: false, capEnd: false });
}

// Serrations (grooves across a slide or a knob): stations along z from z0 to z1
// with n grooves, and depth(z) = 0..1 (1 at the bottom of a groove). Add the
// stations to a sectionLoft and inset the side points by depth(z).
export function serrations(z0, z1, n) {
  if (!n) return { zs: [], depth: () => 0 };
  const pitch = (z1 - z0) / n;
  const zs = [];
  for (let i = 0; i < n; i++) {
    const a = z0 + i * pitch;
    zs.push(a, a + pitch * 0.18, a + pitch * 0.5, a + pitch * 0.82);
  }
  zs.push(z1);
  const depth = (z) => {
    if (z <= z0 || z >= z1) return 0;
    const u = ((z - z0) / pitch) % 1;
    return u < 0.18 ? 0 : u < 0.5 ? (u - 0.18) / 0.32 : u < 0.82 ? 1 - (u - 0.5) / 0.32 : 0;
  };
  return { zs, depth };
}

// Rifle sling between two attachment points (swivels or slots), sagging under the
// gun: a flat strap with its flat side facing `face`, plus a keeper loop and the
// buckle or hook at LOD 0. It goes into its own part, 'sling', so the game can hide
// it (e.g. in first person); the part exists at every LOD but is empty at LOD 2.
export function sling(b, { from, to, sag = 0.06, width = 0.03, thick = 0.003, mat = 'leather', face = [1, 0, 0], hardware = 'steel', keeper = true }) {
  const cur = b.current;
  b.part('sling');
  if (b.detail(1)) {
    strap(b, { a: from, b: to, sag, width, thick, mat, face });
    if (b.detail(0) && keeper) {
      // A keeper (leather loop) a third of the way along, a buckle near the front.
      const at = (t) => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - 4 * t * (1 - t) * sag, from[2] + (to[2] - from[2]) * t];
      const p1 = at(0.36),
        p0 = at(0.33);
      strap(b, { a: p0, b: p1, sag: 0, width: width + 0.002, thick: thick + 0.003, mat, face });
      const q0 = at(0.12),
        q1 = at(0.15);
      strap(b, { a: q0, b: q1, sag: 0, width: width + 0.004, thick: thick + 0.0025, mat: hardware, face });
    }
  }
  b.current = cur;
}

// Stamped marking (see STAMPS in materials.js) laid on a surface at LOD 0.
//   Flat on a side: at = center, axis 'x' | '-x' (the face's normal), w along z,
//   h along y; text reads toward -z on the right side, +z on the left (as seen).
//   On top of a round part (receiver ring): axis 'y', r = radius about the bore,
//   w across (around the ring), h along z; text up toward the muzzle.
//   Flat on top: axis 'y' with r = 0.
//   On any curved surface: surf(s, t) -> [x, y, z] for s (across the text) and t
//   (up the text) in -0.5..0.5, already lifted a little off the surface; n x n grid.
// mat: 'stamp' (struck into the steel), 'paintRed' or 'paintWhite' (painted).
export function stamp(b, { name, at, axis = 'y', w, h, r = 0, lift = 0.00005, surf = null, n = 8, mat = 'stamp' }) {
  if (!b.detail(0)) return;
  const [u0, v0, u1, v1] = stampRect(name);
  const N = surf ? n : r > 0 ? 10 : 1;
  const NJ = surf ? n : 1;
  const pos = [],
    uv = [],
    idx = [];
  for (let j = 0; j <= NJ; j++) {
    for (let i = 0; i <= N; i++) {
      const s = i / N - 0.5,
        t = j / NJ - 0.5; // s across the text, t up the text
      let p;
      if (surf) p = surf(s, t);
      else if (axis === 'y') {
        if (r > 0) {
          const a = (s * w) / r;
          p = [at[0] + Math.sin(a) * (r + lift), Math.cos(a) * (r + lift) + (at[1] - r), at[2] - t * h];
        } else p = [at[0] + s * w, at[1] + lift, at[2] - t * h];
      } else {
        const sg = axis === 'x' ? 1 : -1;
        p = [at[0] + sg * lift, at[1] + t * h, at[2] - sg * s * w];
      }
      pos.push(...p);
      uv.push(u0 + (u1 - u0) * (s + 0.5), v0 + (v1 - v0) * (t + 0.5));
    }
  }
  for (let j = 0; j < NJ; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i,
        c = a + N + 1;
      idx.push(a, a + 1, c + 1, a, c + 1, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.userData.ownUV = true;
  return b._add(geo, mat);
}

// Flat strip (springs, levers, clips, straps) along a smooth 3D path: width across,
// thickness `thick` along `face` (a direction, or a function (point, tangent) that
// returns one, e.g. outward from a grenade's axis).
export function ribbon(b, { pts, width, thick, face = [1, 0, 0], mat, steps }) {
  const lod = b.lod;
  const P = smoothPath3(pts, false, steps ?? (lod === 0 ? 6 : lod === 1 ? 2 : 1));
  const rings = [],
    us = [];
  let len = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    const T = norm(sub(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)]));
    const f0 = typeof face === 'function' ? face(p, T) : face;
    const F = norm(sub(f0, T.map((v) => v * dot(f0, T))));
    const W = cross(T, F);
    const hw = width / 2,
      ht = thick / 2;
    const corners = [
      [-hw, -ht],
      [hw, -ht],
      [hw, -ht],
      [hw, ht],
      [hw, ht],
      [-hw, ht],
      [-hw, ht],
      [-hw, -ht],
    ];
    rings.push(corners.map(([u, v]) => [p[0] + W[0] * u + F[0] * v, p[1] + W[1] * u + F[1] * v, p[2] + W[2] * u + F[2] * v]));
    if (i > 0) len += Math.hypot(...sub(p, P[i - 1]));
    us.push(len);
  }
  return ringLoft(b, { rings, us, mat });
}

// Turned part around the Y axis (upright grenades and fuzes): profile = [[r, y], ...]
// from the bottom up; x, z move the axis.
export function latheY(b, { profile, mat, seg = 24, x = 0, z = 0 }) {
  // Faces point outward when the outline, closed along the axis, runs
  // counterclockwise in (r, y): reverse it if not.
  const q = [...profile, [0, profile[profile.length - 1][1]], [0, profile[0][1]]];
  let area = 0;
  for (let i = 0; i < q.length; i++) area += q[i][0] * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * q[i][1];
  if (area < 0) profile = [...profile].reverse();
  if (b.lod > 0) profile = simplifyOpen(profile, b.lod === 1 ? 0.0002 : 0.0015);
  const geo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)),
    b.seg(seg),
  );
  geo.translate(x, 0, z);
  return b._add(geo, mat);
}

// Smooth step from 0 at e0 to 1 at e1.
export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
