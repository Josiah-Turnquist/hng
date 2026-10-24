// Procedural geometry for trees, bushes, hedge sections and far impostor cards. Each
// shape is built once at load (a few milliseconds) and then drawn with instancing.
//
// Every mesh uses the vegetation atlas (bark and foliage side by side, see species.js),
// so a whole tree - trunk, limbs and leaves - is a single draw call. Attributes:
//   position, normal, uv (atlas), color (ambient occlusion and tint),
//   vegWind: x bend weight (0 at the base, ~1 at the top of a 20 m tree),
//            y flutter weight (leaf tips), z phase (per branch / leaf cluster).
// Foliage normals point out of the crown (not along the card), so a crown of flat
// cards shades like a soft, round volume.
import * as THREE from 'three';
import { RNG, clamp, lerp, smoothstep } from '../../core/math.js';
import { SPECIES, CELL, ATLAS_COLS, ATLAS_ROWS, BARK_WORLD, VARIANTS } from './species.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// --- vectors as small arrays -----------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const madd = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const UP = [0, 1, 0];

function randUnit(r) {
  const z = r.range(-1, 1),
    a = r.next() * TAU,
    s = Math.sqrt(1 - z * z);
  return [s * Math.cos(a), z, s * Math.sin(a)];
}

// Atlas rectangle [u0, v0, u1, v1] of a cell, inset so mipmaps don't bleed in from
// the neighbors.
export function cellRect(cell, inset = 0.012) {
  const c = cell % ATLAS_COLS,
    r = Math.floor(cell / ATLAS_COLS);
  const du = 1 / ATLAS_COLS,
    dv = 1 / ATLAS_ROWS;
  const u0 = c * du,
    v1 = 1 - r * dv;
  return [u0 + du * inset, v1 - dv + dv * inset, u0 + du * (1 - inset), v1 - dv * inset];
}

export class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.wind = [];
    this.idx = [];
    this.n = 0;
  }

  v(p, n, u, v, c, bend, flutter, phase) {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2]);
    this.wind.push(bend, flutter, phase);
    return this.n++;
  }

  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  get triangles() {
    return this.idx.length / 3;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('vegWind', new THREE.Float32BufferAttribute(this.wind, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------------------------------
// Bark tubes and foliage cards.

// Rotation-minimizing frames along a polyline.
function frames(pts) {
  const n = pts.length;
  const T = [],
    N = [],
    B = [];
  for (let i = 0; i < n; i++) T.push(norm(sub(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)])));
  const a = Math.abs(T[0][1]) < 0.9 ? UP : [1, 0, 0];
  N.push(norm(cross(T[0], a)));
  B.push(cross(T[0], N[0]));
  for (let i = 1; i < n; i++) {
    const p = N[i - 1];
    const q = norm(sub(p, scl(T[i], dot(p, T[i]))));
    N.push(q);
    B.push(cross(T[i], q));
  }
  return { T, N, B };
}

// A tapered bark tube along a polyline. The bark texture repeats every BARK_WORLD
// meters along the tube: the tube is cut at each repeat so atlas UVs stay in the cell.
// o: { sides, cell, tint, ao(p) -> number, bend(p) -> number, phase }
function tube(G, pts, radii, o) {
  const sides = o.sides;
  const [u0, v0, u1, v1] = cellRect(o.cell, 0.035);
  const { T, N, B } = frames(pts);
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + length(sub(pts[i], pts[i - 1])));
  let rAvg = 0;
  for (const r of radii) rAvg += r / radii.length;
  const uSpan = clamp((TAU * rAvg) / BARK_WORLD, 0.2, 1);
  // Bark repeats every BARK_WORLD * stretch meters along the tube ('fit': once).
  const vWorld = o.stretch === 'fit' ? Math.max(acc[acc.length - 1], 1e-3) * 1.0001 : BARK_WORLD * (o.stretch ?? 2);
  const tint = o.tint || [1, 1, 1];
  const ring = (p, t, nn, bb, r, dr, vLocal) => {
    const base = G.n;
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * TAU;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const d = [nn[0] * ca + bb[0] * sa, nn[1] * ca + bb[1] * sa, nn[2] * ca + bb[2] * sa];
      const P = madd(p, d, r);
      const nrm = norm(madd(d, t, dr));
      const ao = o.ao ? o.ao(P) : 1;
      G.v(P, nrm, u0 + (u1 - u0) * (j / sides) * uSpan, v0 + (v1 - v0) * vLocal, [tint[0] * ao, tint[1] * ao, tint[2] * ao], o.bend ? o.bend(P) : 0, 0, o.phase ?? 0);
    }
    return base;
  };
  const connect = (a, b) => {
    for (let j = 0; j < sides; j++) {
      G.tri(a + j, a + j + 1, b + j);
      G.tri(a + j + 1, b + j + 1, b + j);
    }
  };
  for (let k = 0; k < pts.length - 1; k++) {
    const segLen = acc[k + 1] - acc[k];
    if (segLen < 1e-5) continue;
    const dr = (radii[k] - radii[k + 1]) / segLen;
    const at = (f) => {
      const t = norm(mix3(T[k], T[k + 1], f));
      let nn = mix3(N[k], N[k + 1], f);
      nn = norm(sub(nn, scl(t, dot(nn, t))));
      return { p: mix3(pts[k], pts[k + 1], f), t, n: nn, b: cross(t, nn), r: lerp(radii[k], radii[k + 1], f) };
    };
    const vA = acc[k] / vWorld,
      vB = acc[k + 1] / vWorld;
    let tile = Math.floor(vA + 1e-6);
    let s = at(0);
    let start = ring(s.p, s.t, s.n, s.b, s.r, dr, vA - tile);
    for (let guard = 0; guard < 64; guard++) {
      if (vB - tile <= 1 + 1e-6) {
        const e = at(1);
        connect(start, ring(e.p, e.t, e.n, e.b, e.r, dr, vB - tile));
        break;
      }
      const f = (tile + 1 - vA) / (vB - vA);
      const m = at(f);
      connect(start, ring(m.p, m.t, m.n, m.b, m.r, dr, 1));
      tile++;
      start = ring(m.p, m.t, m.n, m.b, m.r, dr, 0);
    }
  }
}

// A foliage card: base point B (the middle of its bottom edge), up axis V, across axis
// U, size w x h. o: { normal(p), color(p), bend(p), flutter, phase }
function card(G, B, U, V, w, h, cell, o) {
  const [u0, v0, u1, v1] = cellRect(cell, 0.006);
  const c = [
    madd(B, U, -w / 2),
    madd(B, U, w / 2),
    madd(madd(B, U, w / 2), V, h),
    madd(madd(B, U, -w / 2), V, h),
  ];
  const uv = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  const base = G.n;
  for (let i = 0; i < 4; i++) {
    const p = c[i];
    G.v(p, o.normal(p), uv[i][0], uv[i][1], o.color(p), o.bend(p), i < 2 ? o.flutter * 0.15 : o.flutter, o.phase);
  }
  G.tri(base, base + 1, base + 2);
  G.tri(base, base + 2, base + 3);
}

// Distance from o along unit d to the surface of an ellipsoid (center c, radii r).
function ellipsoidExit(o, d, c, r) {
  const ox = (o[0] - c[0]) / r[0],
    oy = (o[1] - c[1]) / r[1],
    oz = (o[2] - c[2]) / r[2];
  const dx = d[0] / r[0],
    dy = d[1] / r[1],
    dz = d[2] / r[2];
  const A = dx * dx + dy * dy + dz * dz;
  const Bq = 2 * (ox * dx + oy * dy + oz * dz);
  const C = ox * ox + oy * oy + oz * oz - 1;
  const disc = Bq * Bq - 4 * A * C;
  if (disc < 0) return 0;
  return Math.max(0, (-Bq + Math.sqrt(disc)) / (2 * A));
}

// A point on the outer shell of an ellipsoid crown (rn: radial fraction range),
// avoiding the flat underside.
function shellPoint(C, R, r, rn = [0.65, 1.0], minY = -0.7) {
  for (let k = 0; k < 20; k++) {
    const u = randUnit(r);
    if (u[1] < minY) continue;
    const t = r.range(rn[0], rn[1]);
    return [C[0] + u[0] * R[0] * t, C[1] + u[1] * R[1] * t, C[2] + u[2] * R[2] * t];
  }
  return [C[0], C[1] + R[1] * 0.8, C[2]];
}

function bezier(a, b, c, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k0 = (1 - t) * (1 - t),
      k1 = 2 * (1 - t) * t,
      k2 = t * t;
    out.push([a[0] * k0 + b[0] * k1 + c[0] * k2, a[1] * k0 + b[1] * k1 + c[1] * k2, a[2] * k0 + b[2] * k1 + c[2] * k2]);
  }
  return out;
}

// Crown shading helpers for an ellipsoid crown (center C, radii R) on a tree of height H.
function crownStyle(C, R, H, r, flutter) {
  const normal = (p) => {
    const q = [(p[0] - C[0]) / R[0], (p[1] - C[1]) / R[1], (p[2] - C[2]) / R[2]];
    return norm([q[0], q[1] + 0.3, q[2]]);
  };
  const shadeBase = (p) => {
    const q = [(p[0] - C[0]) / R[0], (p[1] - C[1]) / R[1], (p[2] - C[2]) / R[2]];
    const rn = length(q);
    let ao = 0.4 + 0.6 * smoothstep(0.2, 1.05, rn);
    ao *= 0.76 + 0.24 * clamp((q[1] + 1) / 2, 0, 1);
    return ao;
  };
  const bend = (p) => Math.pow(clamp(p[1] / H, 0, 1), 1.5) * (H / 20) * 0.9 + 0.1 * clamp(Math.hypot(p[0], p[2]) / Math.max(R[0], 1), 0, 1);
  return { normal, shadeBase, bend, flutter };
}

// A cluster of foliage cards around point p, spraying outward from the crown.
function cluster(G, p, cell, size, style, r, { cards = 3, face = 0.6, shade = 1, tint = [1, 1, 1], spin = 1.1 } = {}) {
  // Cards face out of the crown (tilted at random), so a crown seen from any side
  // shows the faces of the sprays on that side; the sprays point roughly upward.
  const o = norm(style.normal(p));
  const phase = r.next();
  const s = shade * r.range(0.88, 1.1);
  const warm = r.chance(0.18) ? 0.07 : 0;
  const col = (q) => {
    const ao = style.shadeBase(q) * s;
    return [ao * tint[0] * (1 + warm), ao * tint[1] * (1 + warm * 0.5), ao * tint[2] * (1 - warm)];
  };
  for (let k = 0; k < cards; k++) {
    const n = norm(add(scl(o, face), scl(randUnit(r), 1 - face * 0.6)));
    let V = sub(UP, scl(n, dot(UP, n)));
    if (length(V) < 0.15) V = cross(n, [1, 0, 0]);
    V = norm(V);
    const U0 = norm(cross(V, n));
    const a = r.range(-spin, spin);
    const V2 = norm(add(scl(V, Math.cos(a)), scl(U0, Math.sin(a))));
    const U2 = norm(cross(V2, n));
    const sz = size * r.range(0.85, 1.15);
    const B = madd(madd(p, V2, -sz * 0.45), n, r.range(-0.25, 0.25));
    card(G, B, U2, V2, sz, sz, cell, { normal: style.normal, color: col, bend: style.bend, flutter: style.flutter, phase });
  }
}

// ---------------------------------------------------------------------------------------
// Tree shapes.

function broadleaf(G, sp, r) {
  const H = r.range(sp.H[0], sp.H[1]);
  const trunkH = H * r.range(sp.trunk[0], sp.trunk[1]);
  const C = [r.range(-0.04, 0.04) * H, sp.crown.y * H * r.range(0.96, 1.04), r.range(-0.04, 0.04) * H];
  const rx = r.range(sp.crown.rx[0], sp.crown.rx[1]) * H;
  const R = [rx, r.range(sp.crown.ry[0], sp.crown.ry[1]) * H, rx * r.range(0.85, 1.1)];
  const r0 = sp.r0 * H;
  const style = { ...crownStyle(C, R, H, r, sp.flutter), center: C };
  const barkStyle = { sides: 8, cell: CELL[sp.bark], tint: sp.barkTint, ao: (p) => 0.62 + 0.38 * smoothstep(0, 2.5, p[1]) * (p[1] > C[1] - R[1] ? 0.85 : 1), bend: style.bend, phase: r.next() };
  // Trunk, leaning gently toward the crown center.
  const topY = sp.leader ? C[1] + R[1] * 0.72 : Math.max(trunkH + H * 0.1, C[1] - R[1] * 0.2);
  const ph1 = r.next() * TAU,
    ph2 = r.next() * TAU;
  const trunkAt = (y) => {
    const f = clamp(y / topY, 0, 1);
    return [C[0] * f + Math.sin(f * 4 + ph1) * 0.012 * H * f, y, C[2] * f + Math.cos(f * 3.3 + ph2) * 0.012 * H * f];
  };
  const trunkR = (y) => r0 * (1 - 0.62 * clamp(y / topY, 0, 1)) + r0 * 0.38 * Math.exp(-Math.max(0, y) * 2.2);
  const tp = [],
    tr = [];
  const nT = 6;
  for (let i = 0; i <= nT; i++) {
    const y = -0.4 + ((topY + 0.4) * i) / nT;
    tp.push(trunkAt(y));
    tr.push(i === nT ? trunkR(y) * 0.8 : trunkR(y));
  }
  tube(G, tp, tr, barkStyle);
  // Main limbs.
  const tips = [];
  const nL = r.int(sp.limbs[0], sp.limbs[1]);
  const az0 = r.next() * TAU;
  const yLo = trunkH,
    yHi = sp.leader ? topY * 0.92 : topY;
  for (let i = 0; i < nL; i++) {
    const t = nL > 1 ? i / (nL - 1) : 0.5;
    const ya = lerp(yLo, yHi, Math.pow(t, 0.85)) + r.range(-0.3, 0.3);
    const A = trunkAt(ya);
    const az = az0 + i * 2.39996 + r.range(-0.35, 0.35);
    const ang = lerp(sp.limbAngle[1], sp.limbAngle[0], t) * DEG + r.range(-6, 6) * DEG;
    const d = [Math.sin(ang) * Math.cos(az), Math.cos(ang), Math.sin(ang) * Math.sin(az)];
    const L = ellipsoidExit(A, d, C, R) * r.range(0.72, 0.9);
    if (L < 0.8) continue;
    const side = norm(cross(d, UP));
    const ctrl = add(madd(madd(A, d, L * 0.5), UP, L * sp.bend), scl(side, L * sp.wiggle * r.range(-1, 1)));
    const E = madd(madd(A, d, L), UP, L * sp.bend * 0.6);
    const pts = bezier(A, ctrl, E, 3);
    const rA = trunkR(ya) * r.range(0.5, 0.62);
    const rad = pts.map((_, k) => lerp(rA, 0.035, Math.pow(k / 3, 0.8)));
    tube(G, pts, rad, { ...barkStyle, sides: 5, stretch: 3, phase: r.next() });
    tips.push(E);
    // Branches off the limb.
    const nb = r.int(2, 3);
    for (let b = 0; b < nb; b++) {
      const tb = r.range(0.35, 0.8);
      const k = Math.min(2, Math.floor(tb * 3));
      const P = mix3(pts[k], pts[k + 1], tb * 3 - k);
      const tan = norm(sub(pts[k + 1], pts[k]));
      const db = norm(add(add(tan, scl(norm(cross(tan, randUnit(r))), 0.9)), [0, 0.35, 0]));
      const Lb = ellipsoidExit(P, db, C, R) * r.range(0.62, 0.86);
      if (Lb < 0.6) continue;
      const Eb = madd(madd(P, db, Lb), UP, Lb * 0.12);
      const rb = lerp(rA, 0.035, tb) * 0.55;
      tube(G, [P, Eb], [rb, 0.02], { ...barkStyle, sides: 3, stretch: 'fit', phase: r.next() });
      tips.push(Eb);
    }
  }
  if (sp.leader) tips.push(trunkAt(topY));
  // Leaf clusters: at every branch tip, then more on the crown shell near the tips,
  // and a few dark ones inside so you can't see through the middle.
  const cl = tips.slice();
  let guard = 0;
  while (cl.length < sp.clusters && guard++ < 500) {
    if (r.chance(0.5)) {
      cl.push(shellPoint(C, R, r, [0.62, 1.0], -0.65));
      continue;
    }
    const t = tips[r.int(0, tips.length - 1)];
    const p = madd(t, randUnit(r), r.range(0.6, 2.6));
    const q = [(p[0] - C[0]) / R[0], (p[1] - C[1]) / R[1], (p[2] - C[2]) / R[2]];
    const rn = length(q) || 1;
    const rt = clamp(rn, 0.6, 1.0) / rn;
    cl.push([C[0] + q[0] * rt * R[0], C[1] + q[1] * rt * R[1], C[2] + q[2] * rt * R[2]]);
  }
  const cellLeaf = CELL[sp.leaf];
  const sizeOf = (p) => r.range(sp.card[0], sp.card[1]) * (1 - 0.15 * clamp((p[1] - C[1]) / R[1], 0, 1));
  for (const p of cl) cluster(G, p, cellLeaf, sizeOf(p), style, r, { cards: 3 });
  const inner = Math.round(sp.clusters * 0.12);
  for (let k = 0; k < inner; k++) {
    const u = randUnit(r);
    const p = [C[0] + u[0] * R[0] * 0.5, C[1] + u[1] * R[1] * 0.45, C[2] + u[2] * R[2] * 0.5];
    cluster(G, p, cellLeaf, sp.card[1], style, r, { cards: 2, shade: 0.85 });
  }
  return { H, C, R, trunkR: r0, crownBase: C[1] - R[1] };
}

function spruce(G, sp, r) {
  const H = r.range(sp.H[0], sp.H[1]);
  const base = H * r.range(sp.trunk[0], sp.trunk[1]);
  const Rb = r.range(sp.crown.rx[0], sp.crown.rx[1]) * H;
  const r0 = sp.r0 * H;
  const leanX = r.range(-0.15, 0.15),
    leanZ = r.range(-0.15, 0.15);
  const at = (y) => [(leanX * y) / H, y, (leanZ * y) / H];
  const C = [0, (base + H) / 2, 0];
  const Rc = [Rb, (H - base) / 2, Rb];
  const radiusAt = (y) => Rb * Math.pow(clamp(1 - (y - base) / (H - base), 0, 1), 0.95) + 0.3;
  const bend = (p) => Math.pow(clamp(p[1] / H, 0, 1), 1.5) * (H / 20) * 0.8 + 0.12 * clamp(Math.hypot(p[0], p[2]) / Rb, 0, 1);
  const normal = (p) => {
    const hd = Math.hypot(p[0], p[2]) || 1e-3;
    return norm([p[0] / hd, 0.55 + 0.3 * (hd / Math.max(radiusAt(p[1]), 0.5)), p[2] / hd]);
  };
  const color = (p) => {
    const hd = Math.hypot(p[0], p[2]);
    const t = clamp((p[1] - base) / (H - base), 0, 1);
    const ao = (0.42 + 0.58 * smoothstep(0, 1, hd / Math.max(radiusAt(p[1]), 0.5))) * (0.82 + 0.18 * t);
    return [ao, ao, ao];
  };
  const barkStyle = { sides: 8, cell: CELL.barkGrey, tint: sp.barkTint, ao: (p) => 0.6 + 0.4 * smoothstep(0, 2, p[1]), bend, phase: r.next() };
  const tp = [],
    tr = [];
  for (let i = 0; i <= 8; i++) {
    const y = -0.4 + ((H - 0.2 + 0.4) * i) / 8;
    tp.push(at(y));
    tr.push(r0 * (1 - 0.92 * clamp(y / H, 0, 1)) + r0 * 0.35 * Math.exp(-Math.max(0, y) * 2.5) + 0.02);
  }
  tube(G, tp, tr, barkStyle);
  // Dead stubs below the green crown.
  for (let k = 0; k < 6; k++) {
    const y = r.range(1.8, Math.max(2, base - 0.5));
    if (y > base) break;
    const az = r.next() * TAU;
    const d = norm([Math.cos(az), r.range(-0.35, 0), Math.sin(az)]);
    const P = at(y);
    tube(G, [P, madd(P, d, r.range(0.5, 1.4))], [0.035, 0.012], { ...barkStyle, sides: 3, stretch: 'fit', tint: [0.5, 0.45, 0.4] });
  }
  // Whorls of drooping branches, each a spray card (two crossed low down).
  let y = base;
  let az0 = r.next() * TAU;
  const dyBase = r.range(1.2, 1.45);
  while (y < H - 1.4) {
    const t = (y - base) / (H - base);
    const Rr = radiusAt(y);
    const nb = t < 0.7 ? 5 : 4;
    for (let k = 0; k < nb; k++) {
      const az = az0 + (k * TAU) / nb + r.range(-0.3, 0.3);
      const droop = lerp(-0.4, 0.12, t) + r.range(-0.08, 0.08);
      const d = norm([Math.cos(az), droop, Math.sin(az)]);
      const L = Rr * r.range(0.9, 1.12);
      const P = madd(at(y), d, 0.1);
      const lat = norm(cross(d, UP));
      const roll = (r.chance(0.5) ? 1 : -1) * r.range(0.35, 0.8);
      const U = norm(add(scl(lat, Math.cos(roll)), scl(cross(d, lat), Math.sin(roll))));
      const w = Math.max(1.2, L * 0.95);
      const o = { normal, color, bend, flutter: sp.flutter, phase: r.next() };
      card(G, P, U, d, w, L * 1.06, CELL.spruce, o);
      if (t < 0.8 && r.chance(0.8)) {
        const U2 = norm(add(scl(lat, Math.cos(roll + 1.45)), scl(cross(d, lat), Math.sin(roll + 1.45))));
        card(G, P, U2, d, w * 0.85, L, CELL.spruce, o);
      }
      if (t < 0.35 && r.chance(0.5)) tube(G, [P, madd(P, d, L * 0.6)], [0.05, 0.015], { ...barkStyle, sides: 3, stretch: 'fit' });
    }
    az0 += 0.7;
    y += dyBase * (t > 0.7 ? 0.75 : 1) * r.range(0.9, 1.1);
  }
  // Leader at the top.
  const top = at(H - 1.9);
  const o = { normal, color, bend, flutter: sp.flutter, phase: r.next() };
  const ua = r.next() * Math.PI;
  card(G, top, [Math.cos(ua), 0, Math.sin(ua)], UP, 1.1, 2.1, CELL.spruce, o);
  card(G, top, [-Math.sin(ua), 0, Math.cos(ua)], UP, 1.1, 2.1, CELL.spruce, o);
  return { H, C, R: Rc, trunkR: r0, crownBase: base };
}

function pine(G, sp, r) {
  const H = r.range(sp.H[0], sp.H[1]);
  const clear = H * r.range(sp.trunk[0], sp.trunk[1]);
  const C = [r.range(-0.6, 0.6), sp.crown.y * H, r.range(-0.6, 0.6)];
  const rx = r.range(sp.crown.rx[0], sp.crown.rx[1]) * H;
  const R = [rx, r.range(sp.crown.ry[0], sp.crown.ry[1]) * H, rx * r.range(0.8, 1.1)];
  const r0 = sp.r0 * H;
  const style = { ...crownStyle(C, R, H, r, sp.flutter), center: C };
  const topY = C[1] + R[1] * 0.5;
  const ph = r.next() * TAU;
  const at = (y) => {
    const f = clamp(y / topY, 0, 1);
    return [C[0] * f * f + Math.sin(f * 5 + ph) * 0.25 * f, y, C[2] * f * f + Math.cos(f * 4 + ph) * 0.25 * f];
  };
  const rAt = (y) => r0 * (1 - 0.7 * clamp(y / topY, 0, 1)) + r0 * 0.3 * Math.exp(-Math.max(0, y) * 2.5);
  // Grey-brown plated bark low down, thin orange bark higher up.
  const split = H * 0.42;
  const lo = [],
    lr = [],
    hi = [],
    hr = [];
  for (let i = 0; i <= 4; i++) {
    const y = -0.4 + ((split + 0.4) * i) / 4;
    lo.push(at(y));
    lr.push(rAt(y));
  }
  for (let i = 0; i <= 5; i++) {
    const y = split + ((topY - split) * i) / 5;
    hi.push(at(y));
    hr.push(rAt(y) * (i === 5 ? 0.7 : 1));
  }
  const barkLow = { sides: 9, cell: CELL.barkGrey, tint: [0.62, 0.52, 0.46], ao: (p) => 0.62 + 0.38 * smoothstep(0, 2.5, p[1]), bend: style.bend, phase: r.next() };
  tube(G, lo, lr, barkLow);
  tube(G, hi, hr, { ...barkLow, cell: CELL.barkPine, tint: [1, 1, 1], ao: null, sides: 8 });
  const tips = [];
  const nL = r.int(sp.limbs[0], sp.limbs[1]);
  const az0 = r.next() * TAU;
  for (let i = 0; i < nL; i++) {
    const t = nL > 1 ? i / (nL - 1) : 0.5;
    const ya = lerp(clear, topY * 0.97, t) + r.range(-0.4, 0.4);
    const A = at(ya);
    const az = az0 + i * 2.39996 + r.range(-0.4, 0.4);
    const ang = lerp(sp.limbAngle[1], sp.limbAngle[0], t) * DEG;
    const d = [Math.sin(ang) * Math.cos(az), Math.cos(ang), Math.sin(ang) * Math.sin(az)];
    const L = Math.max(1.2, ellipsoidExit(A, d, C, R) * r.range(0.75, 0.95));
    const side = norm(cross(d, UP));
    const ctrl = add(madd(A, d, L * 0.55), scl(side, L * sp.wiggle * r.range(-1, 1)));
    const E = madd(madd(A, d, L), UP, L * sp.bend);
    const pts = bezier(A, ctrl, E, 4);
    const rA = rAt(ya) * r.range(0.45, 0.6);
    tube(G, pts, pts.map((_, k) => lerp(rA, 0.03, k / 4)), { ...barkLow, cell: CELL.barkPine, tint: [0.9, 0.85, 0.8], ao: null, sides: 5, stretch: 3 });
    tips.push(E);
    for (let b = 0; b < 2; b++) {
      const tb = r.range(0.45, 0.85);
      const k = Math.min(3, Math.floor(tb * 4));
      const P = mix3(pts[k], pts[k + 1], tb * 4 - k);
      const tan = norm(sub(pts[k + 1], pts[k]));
      const db = norm(add(add(tan, scl(norm(cross(tan, randUnit(r))), 0.8)), [0, 0.4, 0]));
      const Lb = r.range(1.0, 2.2);
      const Eb = madd(P, db, Lb);
      tube(G, [P, Eb], [0.04, 0.015], { ...barkLow, cell: CELL.barkPine, tint: [0.9, 0.85, 0.8], ao: null, sides: 3, stretch: 'fit' });
      tips.push(Eb);
    }
  }
  tips.push(at(topY));
  const cl = tips.slice();
  let guard = 0;
  while (cl.length < sp.clusters && guard++ < 300) cl.push(r.chance(0.45) ? shellPoint(C, R, r, [0.55, 1.0], -0.5) : madd(tips[r.int(0, tips.length - 1)], randUnit(r), r.range(0.5, 1.6)));
  for (const p of cl) cluster(G, p, CELL.pine, r.range(sp.card[0], sp.card[1]), { ...style, normal: (q) => norm(add(style.normal(q), [0, 0.8, 0])) }, r, { cards: 3, face: 0.7 });
  return { H, C, R, trunkR: r0, crownBase: clear };
}

function poplar(G, sp, r) {
  const H = r.range(sp.H[0], sp.H[1]);
  const C = [r.range(-0.1, 0.1), sp.crown.y * H, r.range(-0.1, 0.1)];
  const rx = r.range(sp.crown.rx[0], sp.crown.rx[1]) * H;
  const R = [rx, r.range(sp.crown.ry[0], sp.crown.ry[1]) * H, rx * r.range(0.9, 1.1)];
  const r0 = sp.r0 * H;
  const style = { ...crownStyle(C, R, H, r, sp.flutter), center: C };
  const topY = H * 0.97;
  const at = (y) => [(C[0] * y) / topY, y, (C[2] * y) / topY];
  const rAt = (y) => r0 * (1 - 0.85 * clamp(y / topY, 0, 1)) + r0 * 0.4 * Math.exp(-Math.max(0, y) * 2) + 0.015;
  const tp = [],
    tr = [];
  for (let i = 0; i <= 5; i++) {
    const y = -0.4 + ((topY + 0.4) * i) / 5;
    tp.push(at(y));
    tr.push(rAt(y));
  }
  const barkStyle = { sides: 8, cell: CELL.barkGrey, tint: sp.barkTint, ao: (p) => 0.62 + 0.38 * smoothstep(0, 2.5, p[1]), bend: style.bend, phase: r.next() };
  tube(G, tp, tr, barkStyle);
  const tips = [];
  const nB = r.int(sp.limbs[0], sp.limbs[1]);
  const az0 = r.next() * TAU;
  for (let i = 0; i < nB; i++) {
    const t = i / (nB - 1);
    const ya = lerp(H * 0.07, H * 0.9, t) + r.range(-0.4, 0.4);
    const A = at(ya);
    const az = az0 + i * 2.39996 + r.range(-0.3, 0.3);
    const ang = r.range(sp.limbAngle[0], sp.limbAngle[1]) * DEG;
    const d = [Math.sin(ang) * Math.cos(az), Math.cos(ang), Math.sin(ang) * Math.sin(az)];
    const L = ellipsoidExit(A, d, C, R) * r.range(0.75, 0.95);
    if (L < 0.8) continue;
    const E = madd(A, d, L);
    tube(G, [A, E], [Math.max(0.03, rAt(ya) * 0.35), 0.015], { ...barkStyle, sides: 3, stretch: 'fit', phase: r.next() });
    tips.push(E);
  }
  tips.push(at(topY));
  const cl = tips.slice();
  let guard = 0;
  while (cl.length < sp.clusters && guard++ < 400) {
    if (r.chance(0.6)) {
      cl.push(shellPoint(C, R, r, [0.5, 1.0], -0.95));
      continue;
    }
    const t = tips[r.int(0, tips.length - 1)];
    const p = madd(t, randUnit(r), r.range(0.4, 1.8));
    const q = [(p[0] - C[0]) / R[0], (p[1] - C[1]) / R[1], (p[2] - C[2]) / R[2]];
    const rn = length(q) || 1;
    const rt = clamp(rn, 0.55, 0.98) / rn;
    cl.push([C[0] + q[0] * rt * R[0], C[1] + q[1] * rt * R[1], C[2] + q[2] * rt * R[2]]);
  }
  for (const p of cl) cluster(G, p, CELL.poplar, r.range(sp.card[0], sp.card[1]), style, r, { cards: 3, face: 0.78, spin: 0.5 });
  return { H, C, R, trunkR: r0, crownBase: H * 0.07 };
}

function bush(G, sp, r) {
  const H = r.range(sp.H[0], sp.H[1]);
  let C, R, stems;
  if (sp.shape === 'hazel') {
    C = [0, H * 0.56, 0];
    R = [H * 0.52, H * 0.44, H * 0.5];
    stems = r.int(6, 8);
  } else if (sp.shape === 'hawthorn') {
    C = [0, H * 0.58, 0];
    R = [H * 0.5, H * 0.42, H * 0.48];
    stems = r.int(4, 5);
  } else {
    C = [0, H * 0.42, 0];
    R = [r.range(1.4, 1.7), H * 0.52, r.range(1.3, 1.6)];
    stems = r.int(4, 5);
  }
  const style = { ...crownStyle(C, R, H, r, sp.flutter), center: C };
  style.bend = (p) => clamp(p[1] / H, 0, 1) * 0.2 + 0.05;
  const barkStyle = { sides: 4, cell: CELL.barkGrey, tint: sp.barkTint, ao: (p) => 0.55 + 0.45 * smoothstep(0, 1.5, p[1]), bend: style.bend, phase: r.next() };
  const tips = [];
  const trunkTop = sp.shape === 'hawthorn' ? [r.range(-0.1, 0.1), r.range(0.5, 0.7), r.range(-0.1, 0.1)] : [0, 0, 0];
  if (sp.shape === 'hawthorn') tube(G, [[0, -0.2, 0], trunkTop], [0.09, 0.07], { ...barkStyle, sides: 5 });
  for (let i = 0; i < stems; i++) {
    const az = (i / stems) * TAU + r.range(-0.4, 0.4);
    const ang = (sp.shape === 'bramble' ? r.range(40, 70) : sp.shape === 'hazel' ? r.range(8, 32) : r.range(25, 50)) * DEG;
    const d = [Math.sin(ang) * Math.cos(az), Math.cos(ang), Math.sin(ang) * Math.sin(az)];
    const A = add(trunkTop, [r.range(-0.15, 0.15), sp.shape === 'hawthorn' ? 0 : -0.15, r.range(-0.15, 0.15)]);
    const L = Math.max(0.6, ellipsoidExit(A, d, C, R) * r.range(0.8, 1.0));
    let E = madd(A, d, L);
    if (sp.shape === 'bramble') E = add(E, [0, -L * 0.35, 0]);
    const mid = madd(madd(A, d, L * 0.55), UP, L * (sp.shape === 'bramble' ? 0.25 : 0.06));
    tube(G, [A, mid, E], [sp.shape === 'hazel' ? 0.045 : 0.035, 0.03, 0.012], { ...barkStyle, stretch: 'fit', phase: r.next() });
    tips.push(E, mid);
  }
  const target = sp.shape === 'bramble' ? 16 : 24;
  const cl = [];
  for (let k = 0; k < target; k++) {
    const t = tips[k % tips.length];
    const p = madd(t, randUnit(r), r.range(0.2, 0.9));
    const q = [(p[0] - C[0]) / R[0], (p[1] - C[1]) / R[1], (p[2] - C[2]) / R[2]];
    const rn = length(q) || 1;
    const rt = clamp(rn, 0.45, 0.95) / rn;
    cl.push([C[0] + q[0] * rt * R[0], Math.max(0.35, C[1] + q[1] * rt * R[1]), C[2] + q[2] * rt * R[2]]);
  }
  const size = sp.shape === 'hazel' ? [1.25, 1.55] : sp.shape === 'hawthorn' ? [1.1, 1.35] : [1.05, 1.3];
  const opts = sp.shape === 'bramble' ? { cards: 2, face: 0.7 } : { cards: 2, face: 0.6 };
  for (const p of cl) cluster(G, p, CELL[sp.leaf], r.range(size[0], size[1]), style, r, opts);
  return { H, C, R, trunkR: 0.05, crownBase: 0.3 };
}

// Build the shape of one variant. Returns { geometry, info } where info has the
// canonical height H, crown center C and radii R, trunk radius, crown base height and
// the bounding half width (for impostors and colliders).
export function buildVariant(variantId) {
  const d = VARIANTS[variantId];
  const sp = SPECIES[d.species];
  const r = new RNG(9001 + variantId * 7919);
  const G = new GeoBuilder();
  let info;
  if (sp.kind === 'spruce') info = spruce(G, sp, r);
  else if (sp.kind === 'pine') info = pine(G, sp, r);
  else if (sp.kind === 'poplar') info = poplar(G, sp, r);
  else if (sp.kind === 'bush') info = bush(G, sp, r);
  else info = broadleaf(G, sp, r);
  const geometry = G.build();
  const bb = geometry.boundingBox;
  info.halfW = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x), Math.abs(bb.min.z), Math.abs(bb.max.z));
  info.top = bb.max.y;
  info.triangles = G.triangles;
  info.species = d.species;
  info.bush = d.bush;
  return { geometry, info };
}

// ---------------------------------------------------------------------------------------
// Hedge sections. Local frame: x along the hedge (-L/2..L/2), z across, y up, the
// ground at y = 0. An earth bank (partly buried, so it sits on uneven ground), a dense
// opaque core of foliage on top, and leaf sprays sticking out to break up the outline.

export const HEDGE = { bankH: 1.0, coreBottom: 0.85, coreH: 1.55, coreW: 0.62 };

// L: section length (4 m near, 16 m far). The top of the dense core rises and falls
// along the section (back to the same height at both ends, so sections join), and
// leaf sprays stand out of the top and sides to break up the outline. Near sections
// also get end caps, tall grass and ferns on the bank and brambles at its foot.
export function hedgeGeometry(L, detail, seed = 1) {
  const r = new RNG(seed);
  const G = new GeoBuilder();
  const { bankH, coreBottom, coreH, coreW } = HEDGE;
  const x0 = -L / 2;
  const segs = detail ? 2 : Math.max(1, Math.round(L / 4));
  const seg = L / segs;
  const ridge = [0];
  for (let i = 1; i < segs; i++) ridge.push(r.range(-0.25, 0.4));
  ridge.push(0);
  const ridgeAt = (x) => {
    const f = clamp((x - x0) / seg, 0, segs - 1e-6);
    const i = Math.floor(f);
    return lerp(ridge[i], ridge[i + 1], f - i);
  };
  const bend = (p) => clamp((p[1] - coreBottom) / 2.2, 0, 1) * 0.25;
  const bankCell = cellRect(CELL.bank, 0.02);
  const coreCell = cellRect(CELL.hedgeCore, 0.02);
  // A face across the hedge (profile from (za, ya) to (zb, yb), each end raised by
  // the ridge where asked), split along the hedge into n segments, one texture
  // repeat (4 m) each, or stretched over the whole length when n is 1 and L > 4.
  const face = (za, ya, zb, yb, cellR, n, vr, shade, nrm, ra = 0, rb = 0) => {
    const sl = L / n;
    for (let i = 0; i < n; i++) {
      const base = G.n;
      for (const [xx, uu] of [
        [x0 + i * sl, 0],
        [x0 + (i + 1) * sl, Math.min(1, sl / 4)],
      ]) {
        const rr = ridgeAt(xx);
        for (const [t, z, y] of [
          [0, za, ya + rr * ra],
          [1, zb, yb + rr * rb],
        ]) {
          const p = [xx, y, z];
          G.v(p, nrm, cellR[0] + (cellR[2] - cellR[0]) * uu, cellR[1] + (cellR[3] - cellR[1]) * t * vr, shade(p), bend(p), 0, 0);
        }
      }
      G.tri(base, base + 2, base + 1);
      G.tri(base + 1, base + 2, base + 3);
    }
  };
  const bankShade = (p) => {
    const k = 0.58 + 0.27 * clamp(p[1] / bankH, 0, 1);
    return [k, k, k];
  };
  const coreShade = (p) => {
    const k = 0.6 + 0.4 * clamp((p[1] - coreBottom) / coreH, 0, 1);
    return [k, k, k];
  };
  // Bank: two slopes and a flat top (partly buried, so it sits on uneven ground).
  const prof = [
    [-1.55, -0.6],
    [-0.62, bankH],
    [0.62, bankH],
    [1.55, -0.6],
  ];
  for (let f = 0; f < 3; f++) {
    const [za, ya] = prof[f],
      [zb, yb] = prof[f + 1];
    const nz = yb - ya,
      ny = -(zb - za);
    let nrm = norm([0, ny, nz]);
    if (nrm[1] < 0) nrm = scl(nrm, -1);
    face(za, ya, zb, yb, bankCell, 1, Math.min(1, Math.hypot(zb - za, yb - ya) / 3), bankShade, nrm);
  }
  // Core: two sides and a ridged top.
  const yTop = coreBottom + coreH;
  const zc = coreW;
  face(-zc, coreBottom, -zc * 0.85, yTop, coreCell, segs, 0.4, coreShade, norm([0, 0.25, -0.45]), 0, 1);
  face(-zc * 0.85, yTop, 0, yTop + 0.3, coreCell, segs, 0.2, coreShade, norm([0, 1, -0.3]), 1, 1);
  face(0, yTop + 0.3, zc * 0.85, yTop, coreCell, segs, 0.2, coreShade, norm([0, 1, 0.3]), 1, 1);
  face(zc * 0.85, yTop, zc, coreBottom, coreCell, segs, 0.4, coreShade, norm([0, 0.25, 0.45]), 1, 0);
  // End caps (hidden inside the next section, visible where a hedge ends).
  for (const sx of detail ? [-1, 1] : []) {
    const x = (sx * L) / 2;
    const pts = [
      [x, coreBottom, -zc],
      [x, yTop, -zc * 0.85],
      [x, yTop + 0.3, 0],
      [x, yTop, zc * 0.85],
      [x, coreBottom, zc],
      [x, bankH, 0.62],
      [x, -0.6, 1.55],
      [x, -0.6, -1.55],
      [x, bankH, -0.62],
    ];
    const base = G.n;
    // The core's cross-section takes the leafy texture (with its gaps); the
    // bank's takes the solid earth.
    pts.forEach((p, i) => {
      const c = i < 5 ? coreCell : bankCell;
      G.v(p, [sx, 0.2, 0], c[0] + (c[2] - c[0]) * (0.5 + p[2] / 3.2), c[1] + (c[3] - c[1]) * clamp((p[1] + 0.6) / 4, 0, 1), i < 5 ? coreShade(p) : bankShade(p), bend(p), 0, 0);
    });
    for (const [a, b, c] of [
      [0, 1, 2],
      [0, 2, 3],
      [0, 3, 4],
      [8, 5, 6],
      [8, 6, 7],
    ])
      sx > 0 ? G.tri(base + a, base + b, base + c) : G.tri(base + a, base + c, base + b);
  }
  // Leaf sprays standing out of the top and the sides.
  const cardNormal = (p) => norm([0, 0.55 + (p[1] - yTop) * 0.4, p[2] * 1.1]);
  const cardColor = (p) => {
    const k = 0.58 + 0.42 * clamp((p[1] - coreBottom) / (coreH + 0.8), 0, 1);
    return [k, k, k];
  };
  const spray = (B, V, sz, cell, flutter = 0.7) => {
    let U = norm(cross(V, randUnit(r)));
    if (!Number.isFinite(U[0])) U = [1, 0, 0];
    card(G, B, U, V, sz, sz, cell, { normal: cardNormal, color: cardColor, bend, flutter, phase: r.next() });
  };
  const leaf = () => (r.chance(0.7) ? CELL.hawthorn : r.chance(0.65) ? CELL.hazel : CELL.bramble);
  const nTop = detail ? 8 : Math.round(L * 0.4);
  const nSide = detail ? 16 : Math.round(L * 0.25);
  for (let k = 0; k < nTop; k++) {
    const x = x0 + ((k + r.range(0.1, 0.9)) / nTop) * L;
    const side = r.chance(0.5) ? 1 : -1;
    const B = [x, yTop + ridgeAt(x) - 0.25, side * r.range(0, 0.35)];
    const V = norm([r.range(-0.4, 0.4), 1, side * r.range(0.1, 0.7)]);
    spray(B, V, detail ? r.range(1.3, 1.9) : r.range(2.2, 2.9), leaf());
  }
  for (let k = 0; k < nSide; k++) {
    const x = x0 + ((k + r.range(0.1, 0.9)) / nSide) * L;
    const side = r.chance(0.5) ? 1 : -1;
    const B = [x, r.range(coreBottom + 0.1, yTop - 0.35), side * (zc - 0.3)];
    const V = norm([r.range(-0.4, 0.4), r.range(0.15, 0.8), side]);
    spray(B, V, detail ? r.range(0.8, 1.3) : r.range(1.8, 2.4), leaf());
  }
  if (detail) {
    // Tall grass and ferns on the bank, brambles at its foot.
    const gcard = (B, V, w, h, cell) => {
      let U = norm(cross(V, [0, 0, 1]));
      if (!Number.isFinite(U[0])) U = [1, 0, 0];
      card(G, B, U, V, w, h, cell, { normal: (p) => norm([0, 1, p[2] * 0.4]), color: (p) => [0.72 + 0.1 * clamp(p[1], 0, 1), 0.72 + 0.1 * clamp(p[1], 0, 1), 0.72], bend: () => 0.05, flutter: 0.6, phase: r.next() });
    };
    for (let k = 0; k < 8; k++) {
      const side = r.chance(0.5) ? 1 : -1;
      const t = r.range(0.15, 0.9);
      const z = side * lerp(1.2, 0.65, t),
        y = lerp(0.0, bankH, t) - 0.08;
      const V = norm([r.range(-0.3, 0.3), 1, side * r.range(0.1, 0.5)]);
      gcard([x0 + r.range(0.2, L - 0.2), y, z], V, r.range(0.7, 1.0), r.range(0.6, 0.9), r.chance(0.65) ? CELL.grassTall : CELL.fern);
    }
    for (let k = 0; k < 2; k++) {
      const side = r.chance(0.5) ? 1 : -1;
      const V = norm([r.range(-0.4, 0.4), r.range(0.6, 1), side * r.range(0.3, 0.8)]);
      gcard([x0 + r.range(0, L), -0.05, side * r.range(1.0, 1.25)], V, r.range(0.9, 1.2), r.range(0.8, 1.1), CELL.bramble);
    }
  }
  return G.build();
}

// ---------------------------------------------------------------------------------------
// Impostor: three crossed cards (front, side, top) showing views of the real tree that
// are baked into a texture at load. Unit size; the instance gives width and height.
// Attribute vegCard: 0 front (XY plane, seen from +z), 1 side (ZY plane, seen from +x),
// 2 top (XZ plane; its height is set per variant in the shader).
export function impostorGeometry() {
  const pos = [],
    uv = [],
    cardId = [],
    nrm = [],
    idx = [];
  const quad = (pts, uvs, id, n) => {
    const b = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      pos.push(...pts[i]);
      uv.push(...uvs[i]);
      cardId.push(id);
      nrm.push(...n);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const UVQ = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  quad(
    [
      [-0.5, 0, 0],
      [0.5, 0, 0],
      [0.5, 1, 0],
      [-0.5, 1, 0],
    ],
    UVQ,
    0,
    [0, 0, 1],
  );
  quad(
    [
      [0, 0, 0.5],
      [0, 0, -0.5],
      [0, 1, -0.5],
      [0, 1, 0.5],
    ],
    UVQ,
    1,
    [1, 0, 0],
  );
  quad(
    [
      [-0.5, 0, 0.5],
      [0.5, 0, 0.5],
      [0.5, 0, -0.5],
      [-0.5, 0, -0.5],
    ],
    UVQ,
    2,
    [0, 1, 0],
  );
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('vegCard', new THREE.Float32BufferAttribute(cardId, 1));
  g.setIndex(idx);
  return g;
}

// Ground cover clump: three crossed cards with two segments each (so they can bend).
// Unit size: x and z in -0.5..0.5, y 0..1.
export function clumpGeometry() {
  const pos = [],
    uv = [],
    nrm = [],
    idx = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI + 0.3;
    const dx = Math.cos(a) * 0.5,
      dz = Math.sin(a) * 0.5;
    const nx = -Math.sin(a),
      nz = Math.cos(a);
    const b = pos.length / 3;
    for (let j = 0; j <= 2; j++) {
      const y = j / 2;
      pos.push(-dx, y, -dz, dx, y, dz);
      uv.push(0, y, 1, y);
      nrm.push(nx, 0, nz, nx, 0, nz);
    }
    for (let j = 0; j < 2; j++) {
      const a0 = b + j * 2;
      idx.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
