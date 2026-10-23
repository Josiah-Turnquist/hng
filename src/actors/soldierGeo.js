// Geometry toolkit for the procedural soldier: accumulates skinned vertices
// (position, normal, uv, color, skin index/weight) from simple shapes built in
// the bind pose, then turns them into one BufferGeometry per material.
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
function set3(o, b0, b1, b2, w0, w1, w2) {
  const s = w0 + w1 + w2;
  o[0] = b0;
  o[1] = b1;
  o[2] = b2;
  o[3] = 0;
  o[4] = w0 / s;
  o[5] = w1 / s;
  o[6] = w2 / s;
  o[7] = 0;
}

// Torso: pelvis -> lumbar -> chest by height, the shoulder tops follow the
// clavicles, the collar follows the neck.
export function torsoWeights(x, y, z, o) {
  if (y < 1.0) return set2(o, B.hips, B.spine, smooth01(0.93, 1.1, y) * 0.5);
  if (y < 1.16) return set2(o, B.hips, B.spine, 0.5 + smooth01(1.0, 1.12, y) * 0.5);
  if (y < 1.3) return set2(o, B.spine, B.chest, smooth01(1.13, 1.28, y));
  const ax = Math.abs(x);
  const sh = smooth01(0.08, 0.17, ax) * smooth01(1.33, 1.43, y) * 0.7;
  const nk = smooth01(1.47, 1.53, y) * (1 - smooth01(0.06, 0.1, ax));
  set3(o, B.chest, x < 0 ? B.shoulderL : B.shoulderR, B.neck, Math.max(0.0001, 1 - sh - nk), sh, nk);
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
    _v.set(x, y, z);
    let best = 0,
      bestD = Infinity,
      bestS = 0;
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i];
      let t = _w.copy(_v).sub(sg.a).dot(sg.d) / (sg.len * sg.len);
      const tc = i === 0 ? Math.min(1, t) : i === segs.length - 1 ? Math.max(0, t) : Math.min(1, Math.max(0, t));
      const tt = Math.min(1, Math.max(0, tc));
      const d = _w.copy(sg.a).addScaledVector(sg.d, tt).distanceTo(_v);
      if (d < bestD - 1e-6) {
        bestD = d;
        best = i;
        bestS = sg.s0 + tc * sg.len;
      }
    }
    // Blend near the joints.
    for (let j = 1; j < segs.length; j++) {
      const sj = segs[j].s0,
        r = radii[j - 1] ?? 0.04;
      if (Math.abs(bestS - sj) < r) return set2(o, bones[j - 1], bones[j], smooth01(sj - r, sj + r, bestS));
    }
    if (parentBone >= 0 && bestS < parentRadius) return set2(o, parentBone, bones[0], smooth01(-parentRadius, parentRadius, bestS));
    return set2(o, bones[best], bones[best], 0);
  };
}

export function legWeights(side) {
  const s = side < 0;
  const th = s ? B.thighL : B.thighR,
    sh = s ? B.shinL : B.shinR,
    ft = s ? B.footL : B.footR;
  const hipW = chainWeights([BIND[th], BIND[sh], BIND[ft], BIND[ft].clone().add(new THREE.Vector3(0, -0.1, 0))], [th, sh, ft], [0.05, 0.03], B.hips, 0.07);
  return hipW;
}

export function armWeights(side) {
  const s = side < 0;
  const sh = s ? B.shoulderL : B.shoulderR,
    ua = s ? B.upperArmL : B.upperArmR,
    fa = s ? B.forearmL : B.forearmR,
    hd = s ? B.handL : B.handR;
  return chainWeights([BIND[ua], BIND[fa], BIND[hd], BIND[hd].clone().add(new THREE.Vector3(0, -0.1, 0))], [ua, fa, hd], [0.045, 0.02], sh, 0.05);
}

// ---------------------------------------------------------------------------
export class SkinBuilder {
  constructor(texWorld = 0.5) {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.si = [];
    this.sw = [];
    this.idx = [];
    this.texWorld = texWorld;
    this.color = new THREE.Color(1, 1, 1);
    this.weights = rigid(B.hips);
    this.colorFn = null; // optional per-vertex tint: (x, y, z, color) => void
    this.lowPoly = false; // distant LOD: plain boxes
  }

  get count() {
    return this.pos.length / 3;
  }

  // Color in sRGB hex (or a THREE.Color in linear).
  paint(c) {
    if (c.isColor) this.color.copy(c);
    else this.color.set(c);
    return this;
  }

  bones(fn) {
    this.weights = typeof fn === 'number' ? rigid(fn) : fn;
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
    return this.pos.length / 3 - 1;
  }

  // Append a BufferGeometry, transformed by matrix (model space). UVs are
  // projected from the dominant normal axis.
  geometry(geo, matrix = null, flip = false) {
    const g = geo.index ? geo : geo;
    const pos = g.attributes.position,
      nor = g.attributes.normal;
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
    if (g.index) {
      const ix = g.index.array;
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
  // or quaternion. A superellipsoid on an 8 x 4 grid (48 triangles): flat faces
  // with rounded edges. Low-poly builders use a plain 12-triangle box.
  box(c, size, { rot = null, r = 0.004, quat = null } = {}) {
    const [w, h, d] = size;
    const q = quat || new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0])));
    const C = new THREE.Vector3(...c);
    if (this.lowPoly) {
      const geo = new THREE.BoxGeometry(w, h, d);
      _m.compose(C, q, _w.set(1, 1, 1));
      this.geometry(geo, _m.clone());
      geo.dispose();
      return this;
    }
    const eps = Math.min(1, Math.max(0.12, (2.4 * r) / Math.min(w, h, d)));
    const pw = (x) => Math.sign(x) * Math.pow(Math.abs(x), eps);
    return this.param(
      8,
      4,
      (u, v, out) => {
        const az = u * Math.PI * 2,
          pol = v * Math.PI;
        const rr = Math.pow(Math.sin(pol), eps);
        out.set((pw(Math.cos(az)) * rr * w) / 2, (pw(Math.cos(pol)) * h) / 2, (pw(Math.sin(az)) * rr * d) / 2).applyQuaternion(q).add(C);
      },
      { center: C },
    );
  }

  // Cylinder from a to b with radii r0 (at a) and r1 (at b).
  cylinder(a, b, r0, r1 = r0, { seg = 10, caps = true } = {}) {
    const A = new THREE.Vector3(...a),
      Bv = new THREE.Vector3(...b);
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
    const C = new THREE.Vector3(...c);
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
  // Normals point away from `center` (or by the surface orientation if null).
  param(nu, nv, fn, { center = null, wrapU = true, flip = false, uvScale = 1 } = {}) {
    const base = this.count;
    const cols = nu + 1;
    const P = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = new THREE.Vector3();
        fn(wrapU ? (i % nu) / nu : i / nu, j / nv, p);
        P.push(p);
      }
    }
    const at = (i, j) => P[Math.min(nv, Math.max(0, j)) * cols + (wrapU ? ((i % nu) + nu) % nu : Math.min(nu, Math.max(0, i)))];
    const s = uvScale / this.texWorld;
    // Approximate size for uv scaling.
    let circ = 0;
    for (let i = 0; i < nu; i++) circ += at(i, nv >> 1).distanceTo(at(i + 1, nv >> 1));
    let vlen = 0;
    const vacc = [0];
    for (let j = 1; j <= nv; j++) {
      vlen += at(0, j).distanceTo(at(0, j - 1));
      vacc.push(vlen);
    }
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = at(i, j);
        _t.copy(at(i + 1, j)).sub(at(i - 1, j));
        _s.copy(at(i, j + 1)).sub(at(i, j - 1));
        _n.crossVectors(_s, _t);
        if (_n.lengthSq() < 1e-14) {
          // Pole: average the ring next to it.
          const jj = j === 0 ? 1 : nv - 1;
          _f.set(0, 0, 0);
          for (let k = 0; k < nu; k++) _f.add(at(k, jj));
          _f.divideScalar(nu);
          _n.copy(p).sub(_f);
        }
        if (center) {
          _f.copy(p).sub(center);
          if (_n.dot(_f) < 0) _n.negate();
        }
        if (flip) _n.negate();
        _n.normalize();
        this.vertex(p.x, p.y, p.z, _n.x, _n.y, _n.z, (i / nu) * circ * s, vacc[j] * s);
      }
    }
    // Triangles, wound to face along the normals.
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
  // the stored vertex normals. Skips degenerate triangles.
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
    tri(a, b, c);
    tri(a, c, d);
  }

  // Generalized tube through rings { c: [x,y,z], rx, rz }. The cross-section
  // is a superellipse (exp 2 = ellipse) whose rx axis follows `side`.
  // cap: length of rounded end caps (fraction of the radius) at start/end.
  tube(rings, { seg = 12, side = [1, 0, 0], capStart = 0, capEnd = 0, exp = 2, twist = 0 } = {}) {
    const R = rings.map((r) => ({ c: r.c.isVector3 ? r.c.clone() : new THREE.Vector3(...r.c), rx: r.rx, rz: r.rz ?? r.rx, side: r.side }));
    const sideV = new THREE.Vector3(...side);
    const tangent = (k) => {
      const a = R[Math.max(0, k - 1)].c,
        b = R[Math.min(R.length - 1, k + 1)].c;
      return new THREE.Vector3().subVectors(b, a).normalize();
    };
    // Caps: extra rings shrinking to a point.
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
        extra.push({ c: r0.c.clone().addScaledVector(T, Math.sin(a) * len), rx: r0.rx * sc, rz: r0.rz * sc, side: r0.side });
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
    // Positions.
    const P = [];
    const frames = [];
    for (let k = 0; k < R.length; k++) {
      const T = tangent(k);
      const S = (R[k].side ? new THREE.Vector3(...R[k].side) : sideV.clone()).addScaledVector(T, -T.dot(R[k].side ? new THREE.Vector3(...R[k].side) : sideV)).normalize();
      const F = new THREE.Vector3().crossVectors(T, S);
      frames.push({ T, S, F });
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2 + twist;
        const x = se(Math.cos(a)) * R[k].rx,
          z = se(Math.sin(a)) * R[k].rz;
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
  strap(points, width, thick, normalFn, { seg = 1 } = {}) {
    const P = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
    const base = this.count;
    const s = 1 / this.texWorld;
    let acc = 0;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (let k = 0; k < P.length; k++) {
      const a = P[Math.max(0, k - 1)],
        b = P[Math.min(P.length - 1, k + 1)];
      const T = new THREE.Vector3().subVectors(b, a).normalize();
      const N = normalFn(P[k]).clone();
      N.addScaledVector(T, -T.dot(N)).normalize();
      const S = new THREE.Vector3().crossVectors(T, N).normalize();
      if (k > 0) acc += P[k].distanceTo(P[k - 1]);
      // 4 faces, each with its own 2 vertices per ring (hard edges).
      for (let f = 0; f < 4; f++) {
        const c0 = corners[f],
          c1 = corners[(f + 1) % 4];
        const fn = new THREE.Vector3()
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
    const per = 8;
    for (let k = 0; k < P.length - 1; k++) {
      for (let f = 0; f < 4; f++) {
        const a = base + k * per + f * 2,
          b = a + 1,
          c = a + per,
          d = c + 1;
        this._quad(a, b, d, c);
      }
    }
    return this;
  }

  // Append another builder's vertices.
  append(o) {
    const base = this.count;
    this.pos.push(...o.pos);
    this.nor.push(...o.nor);
    this.uv.push(...o.uv);
    this.col.push(...o.col);
    this.si.push(...o.si);
    this.sw.push(...o.sw);
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
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.2);
    return g;
  }
}
