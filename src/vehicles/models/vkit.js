// Vehicle modeling kit: the gun kit (GunBuilder, src/weapons/models/kit.js) plus helpers
// for wheels, sprockets, cast hulls (convex hulls), armor/module boxes and track paths.
//
// Conventions (the physics/gameplay code depends on these exactly):
//   * Meters. +X = vehicle's right, +Y = up, -Z = FORWARD.
//   * Origin on the ground plane (y = 0 where the tires/tracks touch the ground at normal
//     ride height), centered left/right, at the middle of the wheelbase (wheeled) or of the
//     track ground-contact length (tracked).
//   * Parts are modeled in vehicle space around their pivot (GunBuilder.part(name, pivot)).
//     Anchors, armor boxes, module boxes and pivots are all given in VEHICLE space at rest
//     (turret forward, gun at zero elevation, wheels straight). meta.anchorParts says which
//     part each anchor moves with; meta.partParents lists parts that belong under another
//     part (gun -> turret, turret hatches -> turret...).
//   * 2D outlines: side view [z, y], front view [x, y], top view [x, z].
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { GunBuilder } from '../../weapons/models/kit.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const S = GunBuilder.smooth;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
export const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ---------------------------------------------------------------------------------------
// 2D outlines

// Regular polygon (closed outline, first point not repeated).
export function circle(r, n = 24, cx = 0, cy = 0, a0 = 0, ry = r) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    out.push([cx + r * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

// Points on an arc from angle a0 to a1 (inclusive), n segments.
export function arc(cx, cy, r, a0, a1, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// Rectangle with rounded corners centered at (cx, cy), half sizes hw x hh, radius r.
export function roundRect(cx, cy, hw, hh, r = 0, n = 3) {
  r = Math.min(r, hw - 1e-5, hh - 1e-5);
  if (r <= 0) return [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh]];
  return [
    ...arc(cx + hw - r, cy - hh + r, r, -Math.PI / 2, 0, n),
    ...arc(cx + hw - r, cy + hh - r, r, 0, Math.PI / 2, n),
    ...arc(cx - hw + r, cy + hh - r, r, Math.PI / 2, Math.PI, n),
    ...arc(cx - hw + r, cy - hh + r, r, Math.PI, Math.PI * 1.5, n),
  ];
}

// Lathe profile ([r, x]) of a torus: ring radius R, tube radius t (steering wheels, rings).
export function torusProfile(R, t, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    out.push([R + t * Math.cos(a), t * Math.sin(a)]);
  }
  return out;
}

// Stadium slot centered at (cx, cy), long axis along the second coordinate.
export function slotV(cx, cy, hw, hh, n = 5) {
  return roundRect(cx, cy, hw, hh, hw * 0.999, n);
}

// Outline of a toothed ring (sprocket) in the side view: n teeth between root radius r0
// and tip radius r1. tooth = fraction of the pitch taken by a tooth at its base, tip =
// fraction at its tip. phase rotates the teeth (radians).
export function gear(n, r0, r1, { cx = 0, cy = 0, tooth = 0.5, tip = 0.22, phase = 0, rootSeg = 3 } = {}) {
  const pts = [];
  const w = TAU / n;
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  for (let i = 0; i < n; i++) {
    const a = phase + i * w;
    const rm = r0 + (r1 - r0) * 0.55;
    pts.push(p(r0, a));
    pts.push(p(rm, a + (w * (tooth - tip)) * 0.3));
    pts.push(p(r1, a + (w * (tooth - tip)) / 2));
    pts.push(p(r1, a + (w * (tooth + tip)) / 2));
    pts.push(p(rm, a + w * tooth - (w * (tooth - tip)) * 0.3));
    pts.push(p(r0, a + w * tooth));
    for (let k = 1; k < rootSeg; k++) pts.push(p(r0, a + w * tooth + (w * (1 - tooth) * k) / rootSeg));
  }
  return pts;
}

// A thick polyline: offset the open polyline `line` by thickness t to its right side
// (mitered) and return the closed outline. Works in any 2D plane.
export function ribbon(line, t) {
  const n = line.length;
  const nor = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = line[i + 1][0] - line[i][0],
      dy = line[i + 1][1] - line[i][1];
    const l = Math.hypot(dx, dy) || 1;
    nor.push([dy / l, -dx / l]);
  }
  const off = [];
  for (let i = 0; i < n; i++) {
    const a = nor[Math.max(0, i - 1)],
      b = nor[Math.min(n - 2, i)];
    let mx = a[0] + b[0],
      my = a[1] + b[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const c = Math.max(0.3, mx * b[0] + my * b[1]);
    off.push([line[i][0] + (mx * t) / c, line[i][1] + (my * t) / c]);
  }
  return [...line, ...off.reverse()];
}

// 3D points of a rounded-rectangle cross-section (x-y plane) at station z, for convex
// hulls: half width hw, bottom y0, top y1, top and bottom corner radii.
export function section(z, hw, y0, y1, rt = 0, rb = 0, n = 4) {
  const pts = [];
  const corner = (cx, cy, r, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
    }
  };
  if (rt > 0) {
    corner(hw - rt, y1 - rt, rt, 0);
    corner(-hw + rt, y1 - rt, rt, Math.PI / 2);
  } else pts.push([hw, y1, z], [-hw, y1, z]);
  if (rb > 0) {
    corner(-hw + rb, y0 + rb, rb, Math.PI);
    corner(hw - rb, y0 + rb, rb, Math.PI * 1.5);
  } else pts.push([-hw, y0, z], [hw, y0, z]);
  return pts;
}

// 3D points of a plan outline [[x, z], ...] at height y, scaled by s about (cx, cz).
export function layer(outline, y, s = 1, cx = 0, cz = 0) {
  return outline.map(([x, z]) => [cx + (x - cx) * s, y, cz + (z - cz) * s]);
}

// Mirror a half outline given for x >= 0 (top or front view, [x, *]) into a full closed
// outline: the given points run from the centerline (x = 0) around to the centerline.
export function mirrorHalf(half) {
  const back = half
    .slice()
    .reverse()
    .filter(([x]) => Math.abs(x) > 1e-6)
    .map(([x, y]) => [-x, y]);
  return [...half, ...back];
}

function area2(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ---------------------------------------------------------------------------------------
// Local geometry factories (return BufferGeometry; add them with b.add(geo, mat, tf)).

// Solid of revolution about the X axis. profile = [[r, x], ...]: radius and position
// along the axis. Close the outline (repeat the first point) for solids that don't touch
// the axis. Winding is fixed automatically so the faces point outward.
export function latheGeo(profile, { seg = 24, crease = 0.7 } = {}) {
  let pts = profile.map(([r, x]) => [Math.max(0, r), x]);
  if (area2(pts) < 0) pts = pts.slice().reverse();
  const geo = new THREE.LatheGeometry(
    pts.map(([r, x]) => new THREE.Vector2(r, x)),
    seg,
  );
  geo.rotateZ(-Math.PI / 2); // lathe axis +Y -> +X
  return toCreasedNormals(geo, crease);
}

const isMulti = (pts) => Array.isArray(pts[0][0]);

function makeShapes(outlines, holes) {
  const list = isMulti(outlines) ? outlines : [outlines];
  const shapes = list.map((o) => new THREE.Shape(o.map(([a, b]) => new THREE.Vector2(a, b))));
  for (const h of holes) {
    const target = list.findIndex((o) => inside(h[0], o));
    const s = shapes[target >= 0 ? target : 0];
    s.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
  }
  return shapes;
}

// Extrude outlines in the XY plane along +Z, spanning z = 0..depth.
function extrudeRaw(outlines, holes, depth, bevel, curveSegments, bevelSegments = 2) {
  const bev = Math.max(0, Math.min(bevel, depth / 2 - 0.0005));
  const geo = new THREE.ExtrudeGeometry(makeShapes(outlines, holes), {
    depth: Math.max(0.0005, depth - 2 * bev),
    bevelEnabled: bev > 0,
    bevelThickness: bev,
    bevelSize: bev,
    bevelOffset: -bev, // keep the outer edge on the drawn outline
    bevelSegments,
    curveSegments,
  });
  geo.translate(0, 0, bev);
  return geo;
}

const _mx = new THREE.Matrix4();

// Side-view outline(s) [[z, y]] extruded across X from x0 to x1.
export function prismGeoX(points, x0, x1, { holes = [], bevel = 0.004, crease = 0.6, curveSegments = 6, bevelSegments = 2 } = {}) {
  const lo = Math.min(x0, x1),
    hi = Math.max(x0, x1);
  const geo = extrudeRaw(points, holes, hi - lo, bevel, curveSegments, bevelSegments);
  // shape (z, y), depth d -> world (hi - d, y, z)
  _mx.set(0, 0, -1, hi, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
  geo.applyMatrix4(_mx);
  return toCreasedNormals(geo, crease);
}

// Top-view outline(s) [[x, z]] extruded up along Y from y0 to y1.
export function prismGeoY(points, y0, y1, { holes = [], bevel = 0.004, crease = 0.6, curveSegments = 6, bevelSegments = 2 } = {}) {
  const lo = Math.min(y0, y1),
    hi = Math.max(y0, y1);
  const flip = (o) => o.map(([x, z]) => [x, -z]);
  const geo = extrudeRaw(isMulti(points) ? points.map(flip) : flip(points), holes.map(flip), hi - lo, bevel, curveSegments, bevelSegments);
  // shape (x, -z), depth d -> world (x, lo + d, z)
  _mx.set(1, 0, 0, 0, 0, 0, 1, lo, 0, -1, 0, 0, 0, 0, 0, 1);
  geo.applyMatrix4(_mx);
  return toCreasedNormals(geo, crease);
}

// Front-view outline(s) [[x, y]] extruded along Z from z0 to z1.
export function prismGeoZ(points, z0, z1, { holes = [], bevel = 0.004, crease = 0.6, curveSegments = 6, bevelSegments = 2 } = {}) {
  const lo = Math.min(z0, z1),
    hi = Math.max(z0, z1);
  const geo = extrudeRaw(points, holes, hi - lo, bevel, curveSegments, bevelSegments);
  geo.translate(0, 0, lo);
  return toCreasedNormals(geo, crease);
}

// Convex hull of 3D points. crease > 0 smooths the normals between faces closer than
// that angle (radians): cast hulls and turrets.
export function convexGeo(points, crease = 0) {
  const geo = new ConvexGeometry(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return crease > 0 ? toCreasedNormals(geo, crease) : geo;
}

export function boxGeo(w, h, d, r = 0.004) {
  const rad = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5);
  return rad > 0.0002 ? new RoundedBoxGeometry(w, h, d, 2, rad) : new THREE.BoxGeometry(w, h, d);
}

// Euler (XYZ) that rotates the unit vector `from` onto `to`.
export function eulerFromTo(from, to) {
  const q = new THREE.Quaternion().setFromUnitVectors(v3(from).normalize(), v3(to).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return { rx: e.x, ry: e.y, rz: e.z };
}

// ---------------------------------------------------------------------------------------
// Track path

// Outer tangent between guide circles A -> B for a loop that runs counterclockwise in the
// (z, y) plane with the circles on its inside (left of the direction of travel).
function tangent(A, B) {
  const cz = B.z - A.z,
    cy = B.y - A.y;
  const L = Math.hypot(cz, cy) || 1e-9;
  const s = Math.max(-1, Math.min(1, (A.r - B.r) / L));
  const al = Math.atan2(cy, cz) + Math.asin(s);
  const nz = Math.sin(al),
    ny = -Math.cos(al);
  return [
    [A.z + A.r * nz, A.y + A.r * ny],
    [B.z + B.r * nz, B.y + B.r * ny],
  ];
}

// Closed track loop in the side view: [[z, y], ...] (the last point joins the first).
// guides = [{ z, y, r, ...}] circles the track wraps, listed in the order the links pass
// them when the vehicle drives FORWARD: along the top run toward -Z (rear idler/sprocket ->
// return rollers -> front), down around the front, back under the road wheels toward +Z.
// That is counterclockwise in the (z, y) plane (positive shoelace area). r is the radius
// of the link CENTERLINE around the guide: wheel radius + linkThickness / 2 for wheels,
// rollers and idlers, the pitch radius for a sprocket. Guides the taut track would not
// touch are skipped. sag (meters per meter of span) lets long top runs droop between
// supports (tanks without return rollers). The game can call this again with moved road
// wheels to re-shape the track.
export function trackPath(guides, { step = 0.03, sag = 0 } = {}) {
  let g = guides.map((q) => ({ ...q }));
  for (let pass = 0; pass < 64 && g.length > 3; pass++) {
    let removed = false;
    for (let i = 0; i < g.length; i++) {
      const A = g[(i - 1 + g.length) % g.length],
        B = g[i],
        C = g[(i + 1) % g.length];
      const [p, q] = tangent(A, C);
      const dz = q[0] - p[0],
        dy = q[1] - p[1];
      const L = Math.hypot(dz, dy) || 1e-9;
      const left = (dz * (B.y - p[1]) - dy * (B.z - p[0])) / L;
      if (left > B.r + 1e-4) {
        g.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }
  const n = g.length;
  const segs = g.map((A, i) => tangent(A, g[(i + 1) % n]));
  const pts = [];
  const push = (z, y) => {
    const l = pts[pts.length - 1];
    if (!l || Math.hypot(l[0] - z, l[1] - y) > 1e-5) pts.push([z, y]);
  };
  for (let i = 0; i < n; i++) {
    const G = g[i];
    const pin = segs[(i - 1 + n) % n][1],
      pout = segs[i][0];
    const a0 = Math.atan2(pin[1] - G.y, pin[0] - G.z);
    const a1 = Math.atan2(pout[1] - G.y, pout[0] - G.z);
    let da = a1 - a0;
    while (da < 0) da += TAU;
    while (da >= TAU) da -= TAU;
    if (da > TAU - 1e-3) da = 0;
    const k = Math.max(1, Math.ceil((da * G.r) / step));
    for (let j = 0; j <= k; j++) {
      const a = a0 + (da * j) / k;
      push(G.z + G.r * Math.cos(a), G.y + G.r * Math.sin(a));
    }
    // Straight run to the next guide (with an optional droop on the top run).
    const [P, Q] = segs[i];
    const dz = Q[0] - P[0],
      dy = Q[1] - P[1];
    const L = Math.hypot(dz, dy);
    if (sag > 0 && dz < 0 && Math.abs(dy) < 0.35 * L && L > 0.2) {
      const m = Math.max(2, Math.ceil(L / step));
      for (let j = 1; j < m; j++) {
        const t = j / m;
        push(P[0] + dz * t, P[1] + dy * t - sag * L * 4 * t * (1 - t));
      }
    }
  }
  const first = pts[0],
    last = pts[pts.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-5) pts.pop();
  return pts.map(([z, y]) => [r4(z), r4(y)]);
}

export function pathLength(path) {
  let L = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i],
      b = path[(i + 1) % path.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}

// ---------------------------------------------------------------------------------------
// Armor boxes

// Box covering an armor plate, from its OUTER face: c = center of the outer face, u and v =
// edge vectors spanning the face (full lengths), out = a vector pointing outward. The box
// extends inward by the plate thickness (mm). Returns { name, part, center, half, rot, mm }
// with rot as XYZ Euler angles (radians) chosen close to identity.
export function armorBox(name, part, mm, c, u, v, out) {
  const U = v3(u);
  const Uh = U.clone().normalize();
  const V = v3(v);
  V.addScaledVector(Uh, -V.dot(Uh)); // orthogonalize
  const n = new THREE.Vector3().crossVectors(U, V).normalize();
  if (out && n.dot(v3(out)) < 0) n.negate();
  const t = mm > 0 ? mm / 1000 : 0.004;
  const center = v3(c).addScaledVector(n, -t / 2);
  const ax = [
    { d: Uh, h: U.length() / 2 },
    { d: V.clone().normalize(), h: V.length() / 2 },
    { d: n.clone(), h: t / 2 },
  ];
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  let best = perms[0],
    bestScore = -1;
  for (const p of perms) {
    const s = Math.abs(ax[p[0]].d.x) + Math.abs(ax[p[1]].d.y) + Math.abs(ax[p[2]].d.z);
    if (s > bestScore + 1e-9) {
      bestScore = s;
      best = p;
    }
  }
  const cols = best.map((i, k) => {
    const d = ax[i].d.clone();
    if (d.getComponent(k) < 0) d.negate();
    return { d, h: ax[i].h };
  });
  const m = new THREE.Matrix4().makeBasis(cols[0].d, cols[1].d, cols[2].d);
  if (m.determinant() < 0) {
    let k = 0,
      mn = 2;
    for (let i = 0; i < 3; i++) {
      const a = Math.abs(cols[i].d.getComponent(i));
      if (a < mn) {
        mn = a;
        k = i;
      }
    }
    cols[k].d.negate();
    m.makeBasis(cols[0].d, cols[1].d, cols[2].d);
  }
  const e = new THREE.Euler().setFromRotationMatrix(m, 'XYZ');
  return {
    name,
    part,
    center: [r4(center.x), r4(center.y), r4(center.z)],
    half: cols.map((q) => r4(q.h)),
    rot: [r4(e.x), r4(e.y), r4(e.z)],
    mm,
  };
}

// ---------------------------------------------------------------------------------------
// Builder

export class VehicleBuilder extends GunBuilder {
  constructor(mats) {
    super(mats);
    this.primitives = 0;
    Object.assign(this.meta, { armor: [], modules: [], anchorParts: {}, partParents: {}, hinges: {} });
  }

  _add(geo, mat, t) {
    this.primitives++;
    return super._add(geo, mat, t);
  }

  // Box with chamfered/rounded edges (seg 1 = a single chamfer: cheap and reads well at
  // vehicle scale; seg 2 = rounded).
  box({ x = 0, y = 0, z = 0, w, h, d, mat, r = 0.004, rx = 0, ry = 0, rz = 0, seg = 1 }) {
    const rad = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5);
    const geo = rad > 0.0002 ? new RoundedBoxGeometry(w, h, d, seg, rad) : new THREE.BoxGeometry(w, h, d);
    return this._add(geo, mat, { x, y, z, rx, ry, rz });
  }

  // Add a prepared geometry (local coordinates) with a transform {x, y, z, rx, ry, rz}.
  add(geo, mat, t = {}) {
    return this._add(geo, mat, t);
  }

  // Add a list of { geo, mat } (e.g. a wheel built once) with a transform. Geometries are
  // cloned so the same list can be placed several times.
  addAll(items, t = {}) {
    for (const it of items) this._add(it.geo.clone(), it.mat, t);
    return this;
  }

  // Build a sub-assembly in its own frame, then move everything it added into place with
  // T(pos) * R(rot) (rot = XYZ Euler). Returns the matrix (use at(m, p) for anchors).
  place({ pos = [0, 0, 0], rot = [0, 0, 0] }, build) {
    const counts = {};
    for (const [k, p] of Object.entries(this.parts)) counts[k] = p.items.length;
    const cur = this.current;
    build();
    const m = new THREE.Matrix4().compose(v3(pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ')), new THREE.Vector3(1, 1, 1));
    for (const [k, p] of Object.entries(this.parts)) {
      for (let i = counts[k] || 0; i < p.items.length; i++) {
        p.items[i].geo.applyMatrix4(m);
        p.items[i].replaced = true;
      }
    }
    this.current = cur;
    return m;
  }

  // Anchor that moves with a part.
  at(part, name, x, y, z) {
    this.anchor(name, x, y, z);
    this.meta.anchorParts[name] = part;
    return this;
  }

  latheX({ profile, x = 0, y = 0, z = 0, mat, seg = 24, crease = 0.7, flip = false }) {
    return this._add(latheGeo(profile, { seg, crease }), mat, { x, y, z, ry: flip ? Math.PI : 0 });
  }

  // Lathe around an arbitrary axis direction `dir` through point `at`.
  latheDir({ profile, at, dir, mat, seg = 24, crease = 0.7 }) {
    const e = eulerFromTo([1, 0, 0], dir);
    return this._add(latheGeo(profile, { seg, crease }), mat, { x: at[0], y: at[1], z: at[2], ...e });
  }

  convex({ points, mat, crease = 0 }) {
    return this._add(convexGeo(points, crease), mat, {});
  }

  prismX({ points, x0, x1, mat, holes, bevel, crease, curveSegments, bevelSegments }) {
    return this._add(prismGeoX(points, x0, x1, { holes, bevel, crease, curveSegments, bevelSegments }), mat, {});
  }

  prismY({ points, y0, y1, mat, holes, bevel, crease, curveSegments, bevelSegments }) {
    return this._add(prismGeoY(points, y0, y1, { holes, bevel, crease, curveSegments, bevelSegments }), mat, {});
  }

  prismZ({ points, z0, z1, mat, holes, bevel, crease, curveSegments, bevelSegments }) {
    return this._add(prismGeoZ(points, z0, z1, { holes, bevel, crease, curveSegments, bevelSegments }), mat, {});
  }

  // Thin plate between 4 corner points (any orientation), thickness t along its normal
  // (toward `out` from the given corners when out is set, else centered).
  quad({ p, t = 0.01, mat, out = null }) {
    const P = p.map(v3);
    const n = new THREE.Vector3().subVectors(P[2], P[0]).cross(new THREE.Vector3().subVectors(P[3], P[1])).normalize();
    let a = -t / 2,
      b = t / 2;
    if (out) {
      if (n.dot(v3(out)) < 0) n.negate();
      a = -t;
      b = 0;
    }
    const pts = [];
    for (const q of P) {
      pts.push(q.clone().addScaledVector(n, a).toArray());
      pts.push(q.clone().addScaledVector(n, b).toArray());
    }
    return this.convex({ points: pts, mat });
  }

  // ---- damage model -------------------------------------------------------------------

  armor(name, part, mm, c, u, v, out) {
    this.meta.armor.push(armorBox(name, part, mm, c, u, v, out));
    return this;
  }

  // Plate whose outer face spans the side-view segment p0 -> p1 ([z, y]) and x0..x1.
  armorZY(name, part, mm, p0, p1, x0, x1, out) {
    const c = [(x0 + x1) / 2, (p0[1] + p1[1]) / 2, (p0[0] + p1[0]) / 2];
    return this.armor(name, part, mm, c, [0, p1[1] - p0[1], p1[0] - p0[0]], [x1 - x0, 0, 0], out);
  }

  // Plate whose outer face spans the front-view segment p0 -> p1 ([x, y]) and z0..z1.
  armorXY(name, part, mm, p0, p1, z0, z1, out) {
    const c = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (z0 + z1) / 2];
    return this.armor(name, part, mm, c, [p1[0] - p0[0], p1[1] - p0[1], 0], [0, 0, z1 - z0], out);
  }

  // Plate whose outer face spans the top-view segment p0 -> p1 ([x, z]) and y0..y1
  // (vertical faces at any angle in plan view).
  armorXZ(name, part, mm, p0, p1, y0, y1, out) {
    const c = [(p0[0] + p1[0]) / 2, (y0 + y1) / 2, (p0[1] + p1[1]) / 2];
    return this.armor(name, part, mm, c, [p1[0] - p0[0], 0, p1[1] - p0[1]], [0, y1 - y0, 0], out);
  }

  // Plate from 4 corners of its outer face (in order around the face).
  armorQuad(name, part, mm, p, out) {
    const P = p.map(v3);
    const c = P[0].clone().add(P[1]).add(P[2]).add(P[3]).multiplyScalar(0.25);
    const u = P[1].clone().sub(P[0]).add(P[2].clone().sub(P[3])).multiplyScalar(0.5);
    const v = P[3].clone().sub(P[0]).add(P[2].clone().sub(P[1])).multiplyScalar(0.5);
    return this.armor(name, part, mm, c.toArray(), u.toArray(), v.toArray(), out);
  }

  // Non-rectangular plate (trapezoids, hexagonal glacis, sloped turret faces): the outer
  // face is a planar convex polygon `pts` (3D, in order). It is cut into `strips` slices
  // along the in-plane direction `along` (default: the longest edge), each covered by one
  // box sized to the polygon at the middle of its slice, so boxes neither leave big gaps nor
  // stick out into empty space at the slanted ends.
  armorPoly(name, part, mm, pts, out, strips = 4, along = null) {
    const P = pts.map(v3);
    const c = P.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / P.length);
    let n = new THREE.Vector3();
    for (let i = 0; i < P.length; i++) n.add(new THREE.Vector3().crossVectors(P[i].clone().sub(c), P[(i + 1) % P.length].clone().sub(c)));
    n.normalize();
    if (out && n.dot(v3(out)) < 0) n.negate();
    let u;
    if (along) u = v3(along);
    else {
      let best = 0;
      for (let i = 0; i < P.length; i++) {
        const e = P[(i + 1) % P.length].clone().sub(P[i]);
        if (e.length() > best) {
          best = e.length();
          u = e;
        }
      }
    }
    u = u.clone().addScaledVector(n, -u.dot(n)).normalize();
    const w = new THREE.Vector3().crossVectors(n, u).normalize();
    const q = P.map((p) => [p.clone().sub(c).dot(u), p.clone().sub(c).dot(w)]);
    const umin = Math.min(...q.map((a) => a[0])),
      umax = Math.max(...q.map((a) => a[0]));
    for (let k = 0; k < strips; k++) {
      const u0 = umin + ((umax - umin) * k) / strips,
        u1 = umin + ((umax - umin) * (k + 1)) / strips,
        um = (u0 + u1) / 2;
      let lo = Infinity,
        hi = -Infinity;
      for (let i = 0; i < q.length; i++) {
        const [a0, b0] = q[i],
          [a1, b1] = q[(i + 1) % q.length];
        if ((a0 - um) * (a1 - um) > 0 || a0 === a1) continue;
        const t = (um - a0) / (a1 - a0);
        const vv = b0 + (b1 - b0) * t;
        lo = Math.min(lo, vv);
        hi = Math.max(hi, vv);
      }
      if (!(hi > lo)) continue;
      const cc = c.clone().addScaledVector(u, um).addScaledVector(w, (lo + hi) / 2);
      this.armor(name, part, mm, cc.toArray(), u.clone().multiplyScalar(u1 - u0).toArray(), w.clone().multiplyScalar(hi - lo).toArray(), n.toArray());
    }
    return this;
  }

  // Armor for a turret/casemate shell given as a plan outline (closed [x, z] list, any
  // winding) between a lower and an upper layer: one plate per outline edge from
  // [y0, scale0] to [y1, scale1] (scaled about center [cx, cz] like layer()). mmFor(deg)
  // returns the thickness for a face whose outward normal points `deg` degrees away from
  // straight ahead (0 = front, 90 = side, 180 = rear); faces are named `${name}Front`,
  // `${name}Side{L,R}` or `${name}Rear` by the same angle (front < 45 < side < 135 < rear).
  armorShell(name, part, outline, [y0, s0], [y1, s1], [cx, cz], mmFor) {
    const n = outline.length;
    const ccw = area2(outline) > 0;
    for (let i = 0; i < n; i++) {
      const a = outline[i],
        c = outline[(i + 1) % n];
      const ex = c[0] - a[0],
        ez = c[1] - a[1];
      if (Math.hypot(ex, ez) < 0.02) continue;
      // Outward normal in plan (x, z): for counterclockwise (x right, z up) it is (ez, -ex).
      let nx = ccw ? ez : -ez,
        nz = ccw ? -ex : ex;
      const l = Math.hypot(nx, nz);
      nx /= l;
      nz /= l;
      const deg = (Math.acos(Math.max(-1, Math.min(1, -nz))) * 180) / Math.PI;
      const sec = deg < 45 ? 'Front' : deg > 135 ? 'Rear' : nx < 0 ? 'SideL' : 'SideR';
      const L = (p, y, sc) => [cx + (p[0] - cx) * sc, y, cz + (p[1] - cz) * sc];
      this.armorPoly(`${name}${sec}`, part, mmFor(deg), [L(a, y0, s0), L(c, y0, s0), L(c, y1, s1), L(a, y1, s1)], [nx, 0, nz], 1);
    }
    return this;
  }

  // Internal component box (axis-aligned).
  module(name, part, center, half) {
    this.meta.modules.push({ name, part, center: center.map(r4), half: half.map(r4) });
    return this;
  }
}
