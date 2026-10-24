// Geometry toolkit for the procedural soldier: accumulates skinned vertices
// (position, normal, uv, color, skin index/weight, material cell) from shapes
// built in the bind pose, bakes contact shadows between parts into the vertex
// colors, and turns the result into a BufferGeometry.
//
// UVs are in meters of surface (the material scales each texture cell by its
// own size), so every part tiles its fabric or leather at the real scale.
import * as THREE from 'three';
import { B, BIND } from './soldierRig.js';

const _v = new THREE.Vector3(),
  _w = new THREE.Vector3(),
  _n = new THREE.Vector3(),
  _t = new THREE.Vector3(),
  _s = new THREE.Vector3(),
  _f = new THREE.Vector3(),
  _m = new THREE.Matrix4(),
  _nm = new THREE.Matrix3(),
  _col = new THREE.Color();
const WS = new Float32Array(8); // scratch weights: indices 0..3, weights 4..7

export const smooth01 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Skin weight functions: (x, y, z, out) -> fills out[0..3] bone indices, out[4..7] weights.
export function rigid(bone) {
  return (x, y, z, o) => {
    o[0] = bone;
    o[1] = o[2] = o[3] = 0;
    o[4] = 1;
    o[5] = o[6] = o[7] = 0;
  };
}
function set2(o, b0, b1, t) {
  // weight t on b1, (1 - t) on b0
  o[0] = b0;
  o[1] = b1;
  o[2] = o[3] = 0;
  o[4] = 1 - t;
  o[5] = t;
  o[6] = o[7] = 0;
}
// Up to four weighted bones; normalizes and keeps the four largest (without
// allocating: this runs for every vertex).
const _wb = new Int32Array(4),
  _ww = new Float64Array(4);
export function setN(o, list) {
  let n = 0;
  for (let i = 0; i < list.length; i += 2) {
    const w = list[i + 1];
    if (!(w > 1e-4)) continue;
    // Insert in descending order of weight, dropping the smallest past four.
    let k = Math.min(n, 3);
    if (n === 4 && w <= _ww[3]) continue;
    while (k > 0 && _ww[k - 1] < w) {
      _ww[k] = _ww[k - 1];
      _wb[k] = _wb[k - 1];
      k--;
    }
    _ww[k] = w;
    _wb[k] = list[i];
    if (n < 4) n++;
  }
  let s = 0;
  for (let k = 0; k < n; k++) s += _ww[k];
  if (s <= 0) {
    n = 1;
    _wb[0] = list[0];
    _ww[0] = s = 1;
  }
  for (let k = 0; k < 4; k++) {
    o[k] = k < n ? _wb[k] : 0;
    o[4 + k] = k < n ? _ww[k] / s : 0;
  }
}
// The weights of `fn` at one point, used for every vertex: rigid objects (a
// canteen, a buckle) move with the body there without bending.
export function weightsAt(fn, x, y, z) {
  const o = new Float32Array(8);
  fn(x, y, z, o);
  return (px, py, pz, out) => out.set(o);
}

// Torso: pelvis -> lumbar -> chest by height; the shoulder tops follow the
// clavicles, the collar the neck, the sides by the armpits partly the upper
// arms; a tunic skirt partly follows the thighs.
export function torsoWeights(x, y, z, o) {
  const ax = Math.abs(x);
  const side = x < 0 ? -1 : 1;
  if (y < 1.0) {
    const sp = smooth01(0.93, 1.1, y) * 0.5;
    // Skirt and seat over the thighs.
    const th = (1 - smooth01(0.78, 0.95, y)) * smooth01(0.02, 0.08, ax) * (z < 0 ? 0.42 : 0.3);
    if (th > 0.001) return setN(o, [B.hips, (1 - sp) * (1 - th), B.spine, sp * (1 - th), side < 0 ? B.thighL : B.thighR, th]);
    return set2(o, B.hips, B.spine, sp);
  }
  if (y < 1.16) return set2(o, B.hips, B.spine, 0.5 + smooth01(1.0, 1.12, y) * 0.5);
  const sh = smooth01(0.07, 0.17, ax) * smooth01(1.32, 1.44, y) * 0.75;
  const nk = smooth01(1.47, 1.53, y) * (1 - smooth01(0.06, 0.1, ax));
  // Below and around the armpit the side of the chest stretches with the arm.
  const ua = smooth01(0.11, 0.17, ax) * smooth01(1.2, 1.34, y) * (1 - smooth01(1.38, 1.46, y)) * 0.3;
  if (y < 1.3) {
    const c = smooth01(1.13, 1.28, y);
    return setN(o, [B.spine, (1 - c) * (1 - ua), B.chest, c * (1 - ua), side < 0 ? B.upperArmL : B.upperArmR, ua]);
  }
  const rest = Math.max(0.0001, 1 - sh - nk - ua);
  setN(o, [B.chest, rest, side < 0 ? B.shoulderL : B.shoulderR, sh, B.neck, nk, side < 0 ? B.upperArmL : B.upperArmR, ua]);
}

// A chain of joints (points) with a bone per segment. Vertices blend across
// each joint over +-radius (meters along the chain). parentBone takes over
// above the first joint.
export function chainWeights(points, bones, radii, parentBone = -1, parentRadius = 0.04) {
  const P = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p)));
  const segs = [];
  let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const d = P[i + 1].clone().sub(P[i]);
    const len = d.length();
    segs.push({ a: P[i], d, len, s0: acc });
    acc += len;
  }
  return (x, y, z, o) => {
    const s = chainS(segs, x, y, z);
    // Blend near the joints.
    for (let j = 1; j < segs.length; j++) {
      const sj = segs[j].s0,
        r = radii[j - 1] ?? 0.04;
      if (Math.abs(s - sj) < r) return set2(o, bones[j - 1], bones[j], smooth01(sj - r, sj + r, s));
    }
    if (parentBone >= 0 && s < parentRadius) return set2(o, parentBone, bones[0], smooth01(-parentRadius, parentRadius, s));
    let k = 0;
    while (k < segs.length - 1 && s > segs[k + 1].s0) k++;
    return set2(o, bones[k], bones[k], 0);
  };
}
// Distance along a chain of segments of the point's projection.
function chainS(segs, x, y, z) {
  _v.set(x, y, z);
  let bestD = Infinity,
    bestS = 0;
  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i];
    const t = _w.copy(_v).sub(sg.a).dot(sg.d) / (sg.len * sg.len);
    const tc = i === 0 ? Math.min(1, t) : i === segs.length - 1 ? Math.max(0, t) : Math.min(1, Math.max(0, t));
    const tt = Math.min(1, Math.max(0, tc));
    const d = _w.copy(sg.a).addScaledVector(sg.d, tt).distanceTo(_v);
    if (d < bestD - 1e-6) {
      bestD = d;
      bestS = sg.s0 + tc * sg.len;
    }
  }
  return bestS;
}

export function legWeights(side) {
  const s = side < 0;
  const th = s ? B.thighL : B.thighR,
    sh = s ? B.shinL : B.shinR,
    ft = s ? B.footL : B.footR;
  return chainWeights([BIND[th], BIND[sh], BIND[ft], BIND[ft].clone().add(new THREE.Vector3(0, -0.1, 0))], [th, sh, ft], [0.06, 0.035], B.hips, 0.08);
}

// Sleeve and arm: the shoulder cap blends from the clavicle (and on the inner
// side the chest) into the upper arm; the elbow and wrist blend over a few cm.
export function armWeights(side) {
  const s = side < 0;
  const cl = s ? B.shoulderL : B.shoulderR,
    ua = s ? B.upperArmL : B.upperArmR,
    fa = s ? B.forearmL : B.forearmR,
    hd = s ? B.handL : B.handR;
  const P = [BIND[ua], BIND[fa], BIND[hd], BIND[hd].clone().add(new THREE.Vector3(0, -0.1, 0))];
  const segs = [];
  let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const d = P[i + 1].clone().sub(P[i]);
    const len = d.length();
    segs.push({ a: P[i], d, len, s0: acc });
    acc += len;
  }
  const sE = segs[1].s0,
    sW = segs[2].s0;
  const J = BIND[ua];
  return (x, y, z, o) => {
    const st = chainS(segs, x, y, z);
    if (st < 0.09) {
      // Shoulder cap: inner side (toward the body) keeps more of the chest.
      const inner = smooth01(0.0, -0.05, (x - J.x) * (s ? -1 : 1));
      const u = smooth01(-0.06, 0.09, st);
      return setN(o, [ua, u, cl, (1 - u) * (1 - 0.45 * inner), B.chest, (1 - u) * 0.45 * inner]);
    }
    if (Math.abs(st - sE) < 0.05) return set2(o, ua, fa, smooth01(sE - 0.05, sE + 0.05, st));
    if (st < sE) return set2(o, ua, ua, 0);
    if (Math.abs(st - sW) < 0.025) return set2(o, fa, hd, smooth01(sW - 0.025, sW + 0.025, st));
    return st < sW ? set2(o, fa, fa, 0) : set2(o, hd, hd, 0);
  };
}

// Foot weights: the foot bone, blending into the shin above the ankle.
export function footWeights(side, y0 = 0.1, y1 = 0.17) {
  const s = side < 0;
  const ft = s ? B.footL : B.footR,
    sh = s ? B.shinL : B.shinR;
  return (x, y, z, o) => set2(o, ft, sh, smooth01(y0, y1, y));
}

// ---------------------------------------------------------------------------
export class SkinBuilder {
  constructor(texWorld = 1) {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.si = [];
    this.sw = [];
    this.mat = []; // material cell, gloss
    this.prim = []; // primitive id per vertex (contact shadows)
    this.idx = [];
    this.texWorld = texWorld;
    this.color = new THREE.Color(1, 1, 1);
    this.weights = rigid(B.hips);
    this.colorFn = null; // optional per-vertex tint: (x, y, z, color, nx, ny, nz) => void
    this.lowPoly = false; // distant LOD: plain boxes
    this.lod = 0;
    this.cell = 0;
    this.gloss = 0;
    this.primId = 0;
    this.shadowless = false; // parts that cast no contact shadow (thin cords)
    this.noShadow = new Set();
  }

  get count() {
    return this.pos.length / 3;
  }
  get triangles() {
    return this.idx.length / 3;
  }

  // Color in sRGB hex (or a THREE.Color in linear).
  paint(c) {
    if (c.isColor) this.color.copy(c);
    else this.color.set(c);
    return this;
  }
  // Material cell (see soldierMaterials.js CELL) and gloss (0 = the texture's
  // roughness, 1 = wet / polished).
  material(cell, gloss = 0) {
    this.cell = cell;
    this.gloss = gloss;
    return this;
  }
  bones(fn) {
    this.weights = typeof fn === 'number' ? rigid(fn) : fn;
    return this;
  }
  // Start a new part: contact shadows are only cast between different parts.
  part(castsShadow = true) {
    this.primId++;
    if (!castsShadow) this.noShadow.add(this.primId);
    return this;
  }

  vertex(x, y, z, nx, ny, nz, u, v) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    _col.copy(this.color);
    if (this.colorFn) this.colorFn(x, y, z, _col, nx, ny, nz);
    this.col.push(_col.r, _col.g, _col.b);
    this.weights(x, y, z, WS);
    this.si.push(WS[0], WS[1], WS[2], WS[3]);
    this.sw.push(WS[4], WS[5], WS[6], WS[7]);
    this.mat.push(this.cell, this.gloss);
    this.prim.push(this.primId);
    return this.pos.length / 3 - 1;
  }

  // Append a BufferGeometry, transformed by matrix (model space). UVs are
  // projected from the dominant normal axis.
  geometry(geo, matrix = null, flip = false) {
    const pos = geo.attributes.position,
      nor = geo.attributes.normal;
    if (matrix) _nm.getNormalMatrix(matrix);
    const base = this.count;
    const s = 1 / this.texWorld;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i);
      _n.fromBufferAttribute(nor, i);
      if (matrix) {
        _v.applyMatrix4(matrix);
        _n.applyMatrix3(_nm).normalize();
      }
      if (flip) _n.negate();
      const ax = Math.abs(_n.x),
        ay = Math.abs(_n.y),
        az = Math.abs(_n.z);
      let u, v;
      if (ax >= ay && ax >= az) {
        u = _v.z;
        v = _v.y;
      } else if (ay >= az) {
        u = _v.x;
        v = _v.z;
      } else {
        u = _v.x;
        v = _v.y;
      }
      this.vertex(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, u * s, v * s);
    }
    if (geo.index) {
      const ix = geo.index.array;
      for (let i = 0; i < ix.length; i += 3) {
        if (flip) this.idx.push(base + ix[i], base + ix[i + 2], base + ix[i + 1]);
        else this.idx.push(base + ix[i], base + ix[i + 1], base + ix[i + 2]);
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        if (flip) this.idx.push(base + i, base + i + 2, base + i + 1);
        else this.idx.push(base + i, base + i + 1, base + i + 2);
      }
    }
    return this;
  }

  // Rounded box: center, size [w, h, d], optional euler rotation [rx, ry, rz]
  // or quaternion. A superellipsoid (flat faces with rounded edges); seg sets
  // the grid (default 8 x 4, 48 triangles). Low-poly builders use a plain box.
  box(c, size, { rot = null, r = 0.004, quat = null, seg = null } = {}) {
    const [w, h, d] = size;
    const q = quat || new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0])));
    const C = c.isVector3 ? c.clone() : new THREE.Vector3(...c);
    if (this.lowPoly) {
      const geo = new THREE.BoxGeometry(w, h, d);
      _m.compose(C, q, _w.set(1, 1, 1));
      this.geometry(geo, _m.clone());
      geo.dispose();
      return this;
    }
    const eps = Math.min(1, Math.max(0.1, (2.4 * r) / Math.min(w, h, d)));
    const pw = (x) => Math.sign(x) * Math.pow(Math.abs(x), eps);
    const [nu, nv] = seg || [8, 3];
    return this.param(
      nu,
      nv,
      (u, v, out) => {
        const az = u * Math.PI * 2 + Math.PI / nu,
          pol = v * Math.PI;
        const rr = Math.pow(Math.sin(pol), eps);
        out.set((pw(Math.cos(az)) * rr * w) / 2, (pw(Math.cos(pol)) * h) / 2, (pw(Math.sin(az)) * rr * d) / 2).applyQuaternion(q).add(C);
      },
      { center: C },
    );
  }

  // Cylinder from a to b with radii r0 (at a) and r1 (at b).
  cylinder(a, b, r0, r1 = r0, { seg = 10, caps = true } = {}) {
    const A = a.isVector3 ? a.clone() : new THREE.Vector3(...a),
      Bv = b.isVector3 ? b.clone() : new THREE.Vector3(...b);
    const len = A.distanceTo(Bv);
    const geo = new THREE.CylinderGeometry(r1, r0, len, seg, 1, !caps);
    const dir = Bv.clone().sub(A).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    _m.compose(A.clone().add(Bv).multiplyScalar(0.5), q, _w.set(1, 1, 1));
    this.geometry(geo, _m.clone());
    geo.dispose();
    return this;
  }

  // Ellipsoid with radii [rx, ry, rz], optional quaternion.
  ellipsoid(c, radii, { nu = 10, nv = 7, quat = null } = {}) {
    const [rx, ry, rz] = radii;
    const C = c.isVector3 ? c.clone() : new THREE.Vector3(...c);
    const q = quat || new THREE.Quaternion();
    return this.param(
      nu,
      nv,
      (u, v, out) => {
        const az = u * Math.PI * 2,
          pol = v * Math.PI;
        out.set(Math.sin(pol) * Math.sin(az) * rx, Math.cos(pol) * ry, -Math.sin(pol) * Math.cos(az) * rz).applyQuaternion(q).add(C);
      },
      { center: C },
    );
  }

  // Parametric surface on a (nu x nv) grid, u wrapping around. fn(u, v, out).
  param(nu, nv, fn, opts = {}) {
    const us = [],
      vs = [];
    for (let i = 0; i <= nu; i++) us.push(i / nu);
    for (let j = 0; j <= nv; j++) vs.push(j / nv);
    return this.grid(us, vs, fn, { wrapU: true, ...opts });
  }

  // Parametric surface sampled at the given u and v values (non-uniform grids
  // put the vertices where the detail is). With wrapU the last u should equal
  // the first one plus a period (the seam is shared). Normals point away from
  // `center` (or follow the surface orientation if null), flip reverses them.
  grid(us, vs, fn, { center = null, wrapU = false, flip = false, uvScale = 1, normal = null } = {}) {
    const base = this.count;
    const nu = us.length - 1,
      nv = vs.length - 1;
    const cols = nu + 1;
    const P = new Array((nv + 1) * cols);
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = new THREE.Vector3();
        fn(us[i], vs[j], p, i, j);
        P[j * cols + i] = p;
      }
    }
    const at = (i, j) => {
      j = Math.min(nv, Math.max(0, j));
      if (wrapU) i = ((i % nu) + nu) % nu;
      else i = Math.min(nu, Math.max(0, i));
      return P[j * cols + i];
    };
    const s = uvScale / this.texWorld;
    // Arc-length UVs: u along each row (from the middle row), v down column 0.
    const mid = nv >> 1;
    const uacc = [0];
    for (let i = 1; i <= nu; i++) uacc.push(uacc[i - 1] + at(i, mid).distanceTo(at(i - 1, mid)));
    const vacc = [0];
    const vcol = Math.min(nu, nu >> 1);
    for (let j = 1; j <= nv; j++) vacc.push(vacc[j - 1] + at(vcol, j).distanceTo(at(vcol, j - 1)));
    // Normals from the grid's own orientation; one sign for the whole surface,
    // chosen so most normals point away from `center` (or along `normal(p)`).
    // Per-vertex flipping would turn concave places (eye sockets) inside out.
    const NS = new Float32Array((nv + 1) * cols * 4);
    let vote = 0;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = P[j * cols + i];
        const ip = wrapU || i < nu ? i + 1 : i,
          im = wrapU || i > 0 ? i - 1 : i;
        const jp = j < nv ? j + 1 : j,
          jm = j > 0 ? j - 1 : j;
        _t.copy(at(ip, j)).sub(at(im, j));
        _s.copy(at(i, jp)).sub(at(i, jm));
        _n.crossVectors(_s, _t);
        let pole = false;
        if (_n.lengthSq() < 1e-14) {
          // Pole: average the ring next to it.
          const jj = j === 0 ? 1 : nv - 1;
          _f.set(0, 0, 0);
          for (let k = 0; k < nu; k++) _f.add(at(k, jj));
          _f.divideScalar(nu);
          _n.copy(p).sub(_f);
          if (_n.lengthSq() < 1e-14) _n.set(0, 1, 0);
          pole = true;
        }
        _n.normalize();
        let ref = 0;
        if (normal) ref = _n.dot(normal(p, _f));
        else if (center) ref = _n.dot(_f.copy(p).sub(center));
        if (pole && ref < 0) _n.negate(); // pole normals are radial: fix them alone
        else vote += Math.sign(ref);
        const q = (j * cols + i) * 4;
        NS[q] = _n.x;
        NS[q + 1] = _n.y;
        NS[q + 2] = _n.z;
        NS[q + 3] = pole ? 1 : 0;
      }
    }
    const sign = (vote < 0 ? -1 : 1) * (flip ? -1 : 1);
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = P[j * cols + i];
        const q = (j * cols + i) * 4;
        const k = NS[q + 3] ? (flip ? -1 : 1) : sign;
        this.vertex(p.x, p.y, p.z, NS[q] * k, NS[q + 1] * k, NS[q + 2] * k, uacc[i] * s, vacc[j] * s);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * cols + i,
          b = a + 1,
          c = a + cols,
          d = c + 1;
        this._quad(a, b, d, c);
      }
    }
    return this;
  }

  // Adds two triangles for quad a-b-c-d, choosing the winding that agrees with
  // the stored vertex normals and the shorter diagonal. Skips degenerate ones.
  _quad(a, b, c, d) {
    const P = this.pos,
      N = this.nor;
    const tri = (i, j, k) => {
      _v.set(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]);
      _w.set(P[k * 3] - P[i * 3], P[k * 3 + 1] - P[i * 3 + 1], P[k * 3 + 2] - P[i * 3 + 2]);
      _n.crossVectors(_v, _w);
      if (_n.lengthSq() < 1e-16) return;
      const nx = N[i * 3] + N[j * 3] + N[k * 3],
        ny = N[i * 3 + 1] + N[j * 3 + 1] + N[k * 3 + 1],
        nz = N[i * 3 + 2] + N[j * 3 + 2] + N[k * 3 + 2];
      if (_n.x * nx + _n.y * ny + _n.z * nz >= 0) this.idx.push(i, j, k);
      else this.idx.push(i, k, j);
    };
    const d2 = (i, j) => (P[i * 3] - P[j * 3]) ** 2 + (P[i * 3 + 1] - P[j * 3 + 1]) ** 2 + (P[i * 3 + 2] - P[j * 3 + 2]) ** 2;
    if (d2(a, c) <= d2(b, d) * 1.02) {
      tri(a, b, c);
      tri(a, c, d);
    } else {
      tri(a, b, d);
      tri(b, c, d);
    }
  }

  // Generalized tube through rings { c: [x,y,z], rx, rz, side? }. The cross-
  // section is a superellipse (exp 2 = ellipse) whose rx axis follows `side`.
  // capStart/capEnd: length of rounded end caps (fraction of the radius).
  // disp(k, a, ring) -> radial offset for ring k at angle a (folds).
  tube(rings, { seg = 12, side = [1, 0, 0], capStart = 0, capEnd = 0, exp = 2, twist = 0, disp = null } = {}) {
    const R = rings.map((r) => ({ ...r, c: r.c.isVector3 ? r.c.clone() : new THREE.Vector3(...r.c), rx: r.rx, rz: r.rz ?? r.rx }));
    const sideV = new THREE.Vector3(...side);
    const tangent = (k) => {
      const a = R[Math.max(0, k - 1)].c,
        b = R[Math.min(R.length - 1, k + 1)].c;
      return new THREE.Vector3().subVectors(b, a).normalize();
    };
    const addCap = (atStart, frac) => {
      if (!frac) return;
      const k = atStart ? 0 : R.length - 1;
      const T = tangent(k).multiplyScalar(atStart ? -1 : 1);
      const r0 = R[k];
      const len = Math.max(r0.rx, r0.rz) * frac;
      const extra = [];
      for (let i = 1; i <= 2; i++) {
        const a = (i / 2) * (Math.PI / 2);
        const sc = i === 2 ? 0.0001 : Math.cos(a);
        extra.push({ c: r0.c.clone().addScaledVector(T, Math.sin(a) * len), rx: r0.rx * sc, rz: r0.rz * sc, side: r0.side, cap: true });
      }
      if (atStart) R.unshift(...extra.reverse());
      else R.push(...extra);
    };
    addCap(true, capStart);
    addCap(false, capEnd);
    const base = this.count;
    const cols = seg + 1;
    const e = 2 / exp;
    const se = (c) => Math.sign(c) * Math.pow(Math.abs(c), e);
    const P = [];
    const frames = [];
    // Parallel transport of the side vector keeps the rings from twisting.
    let prevS = null;
    for (let k = 0; k < R.length; k++) {
      const T = tangent(k);
      let S;
      if (R[k].side) S = R[k].side.isVector3 ? R[k].side.clone() : new THREE.Vector3(...R[k].side);
      else if (prevS) S = prevS.clone();
      else S = sideV.clone();
      S.addScaledVector(T, -T.dot(S));
      if (S.lengthSq() < 1e-8) S.copy(sideV).addScaledVector(T, -T.dot(sideV));
      if (S.lengthSq() < 1e-8) S.set(0, 1, 0).addScaledVector(T, -T.y);
      S.normalize();
      prevS = S;
      const F = new THREE.Vector3().crossVectors(T, S);
      frames.push({ T, S, F });
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2 + twist;
        let x = se(Math.cos(a)) * R[k].rx,
          z = se(Math.sin(a)) * R[k].rz;
        if (disp && !R[k].cap) {
          const d = disp(k, a, R[k]);
          const l = Math.hypot(x, z) || 1;
          x += (x / l) * d;
          z += (z / l) * d;
        }
        P.push(R[k].c.clone().addScaledVector(S, x).addScaledVector(F, z));
      }
    }
    const at = (i, k) => P[Math.min(R.length - 1, Math.max(0, k)) * cols + (((i % seg) + seg) % seg)];
    let acc = 0;
    const s = 1 / this.texWorld;
    for (let k = 0; k < R.length; k++) {
      if (k > 0) acc += R[k].c.distanceTo(R[k - 1].c);
      const circ = Math.PI * (R[k].rx + R[k].rz);
      for (let i = 0; i <= seg; i++) {
        const p = at(i, k);
        _t.copy(at(i + 1, k)).sub(at(i - 1, k));
        _s.copy(at(i, k + 1)).sub(at(i, k - 1));
        _n.crossVectors(_t, _s);
        _f.copy(p).sub(R[k].c);
        if (_n.lengthSq() < 1e-14 || R[k].rx < 0.0002) {
          _n.copy(frames[k].T).multiplyScalar(k < R.length / 2 ? -1 : 1);
        } else if (_n.dot(_f) < 0) _n.negate();
        _n.normalize();
        this.vertex(p.x, p.y, p.z, _n.x, _n.y, _n.z, (i / seg) * circ * s, acc * s);
      }
    }
    for (let k = 0; k < R.length - 1; k++) {
      for (let i = 0; i < seg; i++) {
        const a = base + k * cols + i,
          b = a + 1,
          c = a + cols,
          d = c + 1;
        this._quad(a, b, d, c);
      }
    }
    return this;
  }

  // Flat strap (rectangular cross-section) along a path of points, lying on a
  // surface whose outward normal at each point is given by normalFn(point).
  // Low-poly builders drop the edges (one quad strip on top).
  strap(points, width, thick, normalFn, { flat = false } = {}) {
    const P = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
    const base = this.count;
    const s = 1 / this.texWorld;
    let acc = 0;
    const corners = flat || this.lowPoly ? [[-1, 1], [1, 1]] : [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const nf = corners.length === 2 ? 1 : 4;
    const per = nf * 2;
    for (let k = 0; k < P.length; k++) {
      const a = P[Math.max(0, k - 1)],
        b = P[Math.min(P.length - 1, k + 1)];
      const T = new THREE.Vector3().subVectors(b, a).normalize();
      const N = normalFn(P[k], k).clone();
      N.addScaledVector(T, -T.dot(N)).normalize();
      const S = new THREE.Vector3().crossVectors(T, N).normalize();
      if (k > 0) acc += P[k].distanceTo(P[k - 1]);
      for (let f = 0; f < nf; f++) {
        const c0 = corners[f],
          c1 = corners[(f + 1) % corners.length];
        const fn = nf === 1 ? N.clone() : new THREE.Vector3()
          .addScaledVector(S, (c0[0] + c1[0]) / 2)
          .addScaledVector(N, (c0[1] + c1[1]) / 2)
          .normalize();
        for (const c of [c0, c1]) {
          const p = P[k]
            .clone()
            .addScaledVector(S, (c[0] * width) / 2)
            .addScaledVector(N, ((c[1] + 1) * thick) / 2);
          this.vertex(p.x, p.y, p.z, fn.x, fn.y, fn.z, (c[0] * width * 0.5 + f * width) * s, acc * s);
        }
      }
    }
    for (let k = 0; k < P.length - 1; k++) {
      for (let f = 0; f < nf; f++) {
        const a = base + k * per + f * 2,
          b = a + 1,
          c = a + per,
          d = c + 1;
        this._quad(a, b, d, c);
      }
    }
    return this;
  }

  // Multiply vertex colors from index `from` by fn(x, y, z, nx, ny, nz, color).
  recolor(fn, from = 0) {
    const P = this.pos,
      N = this.nor,
      C = this.col;
    for (let i = from; i < this.count; i++) {
      _col.setRGB(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]);
      fn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], _col, this.mat[i * 2]);
      C[i * 3] = _col.r;
      C[i * 3 + 1] = _col.g;
      C[i * 3 + 2] = _col.b;
    }
    return this;
  }

  // Contact shadows: darken each vertex by the other parts' surfaces close in
  // front of it (a strap on a jacket, a pouch on a belt, the collar on the neck
  // band). radius: reach (m). Cheap stand-in for baked ambient occlusion.
  bakeContact(radius = 0.035, strength = 0.55) {
    const n = this.count;
    const P = this.pos,
      N = this.nor,
      C = this.col,
      prim = this.prim;
    const cell = radius;
    const grid = new Map();
    const key = (x, y, z) => (x + 512) * 1048576 + (y + 512) * 1024 + (z + 512);
    for (let i = 0; i < n; i++) {
      if (this.noShadow.has(prim[i])) continue;
      const k = key(Math.floor(P[i * 3] / cell), Math.floor(P[i * 3 + 1] / cell), Math.floor(P[i * 3 + 2] / cell));
      let l = grid.get(k);
      if (!l) grid.set(k, (l = []));
      l.push(i);
    }
    const occ = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const px = P[i * 3],
        py = P[i * 3 + 1],
        pz = P[i * 3 + 2];
      const nx = N[i * 3],
        ny = N[i * 3 + 1],
        nz = N[i * 3 + 2];
      const gx = Math.floor(px / cell),
        gy = Math.floor(py / cell),
        gz = Math.floor(pz / cell);
      let o = 0;
      const pi = prim[i];
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const l = grid.get(key(gx + dx, gy + dy, gz + dz));
            if (!l) continue;
            for (let q = 0; q < l.length; q++) {
              const j = l[q];
              if (prim[j] === pi) continue;
              const ex = P[j * 3] - px,
                ey = P[j * 3 + 1] - py,
                ez = P[j * 3 + 2] - pz;
              const d2 = ex * ex + ey * ey + ez * ez;
              if (d2 > radius * radius || d2 < 1e-10) continue;
              const d = Math.sqrt(d2);
              const front = (ex * nx + ey * ny + ez * nz) / d; // occluder in front of the surface
              if (front < 0.05) continue;
              // The occluding surface faces back toward us (its underside).
              const facing = -(ex * N[j * 3] + ey * N[j * 3 + 1] + ez * N[j * 3 + 2]) / d;
              o += front * (0.35 + 0.65 * Math.max(0, facing)) * (1 - d / radius);
            }
          }
      occ[i] = o;
    }
    for (let i = 0; i < n; i++) {
      const a = 1 - strength * (1 - Math.exp(-occ[i] * 0.9));
      C[i * 3] *= a;
      C[i * 3 + 1] *= a;
      C[i * 3 + 2] *= a;
    }
    return this;
  }

  // Append another builder's vertices.
  append(o) {
    const base = this.count;
    const cat = (a, b) => {
      for (let i = 0; i < b.length; i++) a.push(b[i]);
    };
    cat(this.pos, o.pos);
    cat(this.nor, o.nor);
    cat(this.uv, o.uv);
    cat(this.col, o.col);
    cat(this.si, o.si);
    cat(this.sw, o.sw);
    cat(this.mat, o.mat);
    const pb = this.primId + 1;
    for (let i = 0; i < o.prim.length; i++) this.prim.push(o.prim[i] + pb);
    this.primId = pb + o.primId + 1;
    for (const i of o.idx) this.idx.push(base + i);
    return this;
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setAttribute('soldierMat', new THREE.Float32BufferAttribute(this.mat, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.2);
    return g;
  }
}
