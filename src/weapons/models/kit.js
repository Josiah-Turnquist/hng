// A small toolkit for modeling guns out of simple shapes, at real-world scale.
//
// Conventions (every gun model follows these):
//   * Units are meters. +X is the gun's right side, +Y is up, -Z points out of the muzzle.
//   * The bore (barrel axis) runs along the Z axis at x = 0, y = 0.
//   * z = 0 is at the trigger. The butt is at positive z, the muzzle at negative z.
//   * Side-view outlines are written as [z, y] pairs.
//
// Parts: everything goes into the "body" part unless a named part is started with
// b.part('bolt') etc. Named parts become separate groups so they can be animated
// (bolt, magazine, clip, charging handle, rear sight leaf, bipod...). Each named
// part has a pivot (its group origin) set with b.part(name, [x, y, z]); geometry
// added to the part is still given in gun coordinates.
//
// Anchors are named points used by the game: where the eye lines up the sights,
// where the bullet leaves, where the hands grip, where the magazine goes.
//
// Levels of detail: new GunBuilder(mats, { lod }) with lod 0 (first person, every
// screw and graduation), 1 (soldiers nearby: fewer segments, parts under 5 mm
// dropped) or 2 (far away: a few hundred triangles, parts under 3 cm dropped, one
// flat vertex-colored material). Models can test b.detail(n) (true when the LOD is
// at most n) to skip fine work, and b.seg(n) gives a segment count for the LOD.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export { makeGunMaterials } from './materials.js';

// Planar UVs from the dominant normal axis, in meters / texture size, so the
// texture scale is the same on every part. Wood grain runs along Z on the sides.
export function projectUVs(geo, texWorld) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const s = 1 / texWorld;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)),
      ny = Math.abs(nor.getY(i)),
      nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    let u, v;
    if (nx >= ny && nx >= nz) {
      u = z;
      v = y;
    } else if (ny >= nz) {
      u = z;
      v = x;
    } else {
      u = x;
      v = y;
    }
    uv[i * 2] = u * s;
    uv[i * 2 + 1] = v * s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Douglas-Peucker simplification of a closed outline ([[z, y], ...]) to within tol.
export function simplifyClosed(points, tol) {
  const n = points.length;
  if (n <= 4 || tol <= 0) return points;
  // Split at the two points farthest apart, simplify both halves.
  let a = 0,
    b = 0,
    best = -1;
  for (let i = 0; i < n; i++) {
    const d = (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2;
    if (d > best) {
      best = d;
      b = i;
    }
  }
  best = -1;
  for (let i = 0; i < n; i++) {
    const d = (points[i][0] - points[b][0]) ** 2 + (points[i][1] - points[b][1]) ** 2;
    if (d > best) {
      best = d;
      a = i;
    }
  }
  if (a > b) [a, b] = [b, a];
  const chainA = points.slice(a, b + 1);
  const chainB = [...points.slice(b), ...points.slice(0, a + 1)];
  const out = [...dp(chainA, tol).slice(0, -1), ...dp(chainB, tol).slice(0, -1)];
  return out.length >= 3 ? out : points;
}

// Douglas-Peucker simplification of an open polyline (keeps both ends).
export function simplifyOpen(points, tol) {
  if (!(points.length > 2 && tol > 0)) return points;
  const [x0, y0] = points[0],
    [x1, y1] = points[points.length - 1];
  if (Math.hypot(x1 - x0, y1 - y0) < 1e-9) {
    // A profile that ends where it starts (tube() walls): with a zero-length
    // baseline every point would be dropped, so split it at the point farthest
    // from the start and simplify the two halves.
    let k = 1,
      far = -1;
    for (let i = 1; i < points.length - 1; i++) {
      const d = Math.hypot(points[i][0] - x0, points[i][1] - y0);
      if (d > far) [far, k] = [d, i];
    }
    return [...dp(points.slice(0, k + 1), tol).slice(0, -1), ...dp(points.slice(k), tol)];
  }
  return dp(points, tol);
}

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const [x0, y0] = pts[0],
    [x1, y1] = pts[pts.length - 1];
  const dx = x1 - x0,
    dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1e-12;
  let idx = -1,
    dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - x0) * dy - (pts[i][1] - y0) * dx) / len;
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax <= tol) return [pts[0], pts[pts.length - 1]];
  const l = dp(pts.slice(0, idx + 1), tol);
  const r = dp(pts.slice(idx), tol);
  return [...l.slice(0, -1), ...r];
}

function polyArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i],
      [x1, y1] = points[(i + 1) % points.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _box = new THREE.Box3();
const _size = new THREE.Vector3();

// Smallest parts kept at each LOD: [largest dimension, middle dimension] (m).
const CULL = [null, [0.005, 0], [0.03, 0.004]];

export class GunBuilder {
  // mats: { name: THREE.Material } - see makeGunMaterials() for the standard set.
  constructor(mats, { lod = 0 } = {}) {
    this.mats = mats;
    this.lod = lod;
    this.parts = {}; // name -> { pivot: Vector3, items: [{geo, mat}] }
    this.anchors = {};
    this.current = this._part('body', [0, 0, 0]);
    this.meta = {};
  }

  // True when building at this level of detail or finer (detail(0): first person only).
  detail(maxLod = 0) {
    return this.lod <= maxLod;
  }

  // Segment count for round shapes at the current LOD.
  seg(n) {
    if (this.lod === 0) return n;
    if (this.lod === 1) return Math.max(6, Math.round(n * 0.45));
    return Math.max(4, Math.round(n * 0.22));
  }

  _part(name, pivot) {
    if (!this.parts[name]) this.parts[name] = { pivot: new THREE.Vector3(...pivot), items: [] };
    return this.parts[name];
  }

  // Switch to a named, separately animated part. pivot = [x, y, z] in gun space.
  part(name, pivot = [0, 0, 0]) {
    this.current = this._part(name, pivot);
    return this;
  }

  // Back to the static body.
  body() {
    this.current = this.parts.body;
    return this;
  }

  anchor(name, x, y, z) {
    this.anchors[name] = new THREE.Vector3(x, y, z);
    return this;
  }

  _add(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    _e.set(rx, ry, rz, 'XYZ');
    _q.setFromEuler(_e);
    _s.set(sx, sy, sz);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    geo.applyMatrix4(_m);
    const material = typeof mat === 'string' ? this.mats[mat] : mat;
    if (!material) throw new Error(`gun material missing: ${mat}`);
    const cull = CULL[this.lod];
    if (cull) {
      // Drop parts too small to see at this distance.
      _box.setFromBufferAttribute(geo.attributes.position);
      const d = _box.getSize(_size).toArray().sort((a, b) => a - b);
      if (d[2] < cull[0] || d[1] < cull[1]) return geo;
    }
    if (this.lod === 2 && this.mats.low) {
      // Far LOD: everything in one flat material, colored per vertex.
      const c = material.userData.lowColor || [0.05, 0.05, 0.05];
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set(c, i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.current.items.push({ geo, mat: this.mats.low });
      return geo;
    }
    if (!geo.userData.ownUV) projectUVs(geo, material.userData.texWorld || 0.3);
    this.current.items.push({ geo, mat: material });
    return geo;
  }

  // Box with rounded edges. w = width (x), h = height (y), d = depth/length (z).
  box({ x = 0, y = 0, z = 0, w, h, d, mat, r = 0.0015, rx = 0, ry = 0, rz = 0 }) {
    const rad = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5);
    const round = this.lod === 0 ? rad > 0.0002 : this.lod === 1 && rad > 0.0025;
    const geo = round ? new RoundedBoxGeometry(w, h, d, this.lod === 0 ? 2 : 1, rad) : new THREE.BoxGeometry(w, h, d);
    return this._add(geo, mat, { x, y, z, rx, ry, rz });
  }

  // Box spanning z0..z1 (z0 < z1), y0..y1, centered on x with width w.
  span({ z0, z1, y0, y1, w, x = 0, mat, r }) {
    return this.box({ x, y: (y0 + y1) / 2, z: (z0 + z1) / 2, w, h: y1 - y0, d: z1 - z0, mat, r });
  }

  // Cylinder along Z from z0 to z1 (any order), radius r0 at z0 and r1 at z1.
  cyl({ z0, z1, r0, r1 = r0, x = 0, y = 0, mat, seg = 20, open = false }) {
    const len = Math.abs(z1 - z0);
    const geo = new THREE.CylinderGeometry(r1, r0, len, this.seg(seg), 1, open);
    // Cylinder is along Y with +Y = top (r1). Rotate so +Y maps to the z1 direction.
    const dir = z1 > z0 ? 1 : -1;
    geo.rotateX(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    return this._add(geo, mat, { x, y, z: (z0 + z1) / 2 });
  }

  // Cylinder along X (pins, bolt handle stems, sling swivels) or Y.
  cylAxis({ axis = 'x', x = 0, y = 0, z = 0, len, r, r1 = r, mat, seg = 14 }) {
    const geo = new THREE.CylinderGeometry(r1, r, len, this.seg(seg));
    if (axis === 'x') geo.rotateZ(-Math.PI / 2);
    else if (axis === 'z') geo.rotateX(Math.PI / 2);
    return this._add(geo, mat, { x, y, z });
  }

  // Cylinder between two points (struts, bolt handle, bipod legs).
  rod({ from, to, r, r1 = r, mat, seg = 12 }) {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to);
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(r1, r, len, this.seg(seg));
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    geo.applyQuaternion(q);
    return this._add(geo, mat, { x: mid.x, y: mid.y, z: mid.z });
  }

  sphere({ x = 0, y = 0, z = 0, r, mat, seg = 12, sx = 1, sy = 1, sz = 1 }) {
    const s = this.seg(seg);
    return this._add(new THREE.SphereGeometry(r, s, Math.max(4, s >> 1)), mat, { x, y, z, sx, sy, sz });
  }

  // Turned (lathe) profile around the bore axis. profile = [[r, z], ...] in order
  // along the outline; x/y offset the axis (e.g. for a gas tube under the barrel).
  lathe({ profile, x = 0, y = 0, mat, seg = 24 }) {
    if (this.lod > 0) profile = simplifyOpen(profile, this.lod === 1 ? 0.0002 : 0.0015);
    const pts = profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 0), -z));
    const geo = new THREE.LatheGeometry(pts, this.seg(seg));
    geo.rotateX(-Math.PI / 2);
    return this._add(geo, mat, { x, y });
  }

  // Side-view outline extruded sideways (stocks, receivers, magazines, grips).
  // points = [[z, y], ...] (any winding), width along X, centered at x.
  // holes = array of point lists. bevel rounds the edges (meters).
  // taper(z, y) optionally scales the width along the part (e.g. a stock that is
  // thinner at the wrist than at the butt): returns a factor around 1.
  extrude({ points, width, x = 0, mat, bevel = 0.002, holes = [], curveSegments = 6, taper = null, bevelSegments = 2 }) {
    const lod = this.lod;
    if (lod > 0) {
      // Coarser outlines; holes too small to see are filled in.
      const tol = lod === 1 ? 0.0004 : 0.0025;
      points = simplifyClosed(points, tol);
      holes = holes.map((h) => simplifyClosed(h, tol)).filter((h) => h.length >= 3 && polyArea(h) > (lod === 1 ? 4e-6 : 1.5e-4));
    }
    const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
    const bev = lod > 0 ? 0 : Math.min(bevel, width / 2 - 0.0005);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.0005, width - 2 * bev),
      bevelEnabled: bev > 0,
      bevelThickness: bev,
      bevelSize: bev,
      bevelOffset: -bev, // keep the outer edge on the drawn outline
      bevelSegments: lod === 0 ? bevelSegments : 1,
      curveSegments: lod === 0 ? curveSegments : 1,
    });
    // Shape X -> gun Z, shape Y -> gun Y, extrusion -> gun X (centered).
    const half = width / 2 - bev;
    _m.set(0, 0, -1, half, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
    geo.applyMatrix4(_m);
    if (taper) {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * taper(pos.getZ(i), pos.getY(i)));
    }
    // Smooth shading on curves, crisp edges where the outline turns sharply.
    return this._add(lod > 0 ? geo : toCreasedNormals(geo, 0.6), mat, { x });
  }

  // Smooth outline through control points (Catmull-Rom), for curved stocks/grips.
  static smooth(points, perSeg = 4, closed = true) {
    const out = [];
    const n = points.length;
    const P = (i) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1),
        p1 = P(i),
        p2 = P(i + 1),
        p3 = P(i + 2);
      for (let k = 0; k < perSeg; k++) {
        const t = k / perSeg,
          t2 = t * t,
          t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    if (!closed) out.push(points[n - 1]);
    return out;
  }

  // A ring of holes on a tube is done with an alpha-tested material ('perforated').
  // Use mat: 'perforated' with cyl({..., open: true}).

  // Build THREE objects: one group per part with geometry merged per material.
  build(name = 'gun') {
    const root = new THREE.Group();
    root.name = name;
    const groups = {};
    for (const [pname, part] of Object.entries(this.parts)) {
      const g = new THREE.Group();
      g.name = pname;
      g.position.copy(part.pivot);
      const byMat = new Map();
      for (const it of part.items) {
        if (!byMat.has(it.mat)) byMat.set(it.mat, []);
        byMat.get(it.mat).push(it.geo);
      }
      for (const [mat, geos] of byMat) {
        // All geometries must share attributes to merge.
        const keep = ['position', 'normal'];
        if (geos.every((gg) => gg.attributes.uv)) keep.push('uv');
        if (geos.every((gg) => gg.attributes.color)) keep.push('color');
        const clean = geos.map((gg) => {
          const ng = gg.index ? gg.toNonIndexed() : gg;
          for (const k of Object.keys(ng.attributes)) if (!keep.includes(k)) ng.deleteAttribute(k);
          return ng;
        });
        const merged = mergeGeometries(clean, false);
        merged.translate(-part.pivot.x, -part.pivot.y, -part.pivot.z);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
      }
      root.add(g);
      groups[pname] = g;
    }
    root.userData.anchors = this.anchors;
    root.userData.parts = groups;
    root.userData.meta = this.meta;
    return { root, parts: groups, anchors: this.anchors, meta: this.meta };
  }
}
