// Bicycles and motorcycles, solo and with a sidecar. Conventions as in vkit.js:
// meters, +X right, +Y up, -Z forward; origin on the ground at the middle of the
// wheelbase (on the motorcycle's own wheel line for sidecar outfits). Wheelbase,
// wheel sizes, the steering head, seats and the sidecar's place come from
// bikeDefs.js, so the models and the physics agree.
//
// Parts (moved by bike.js):
//   steer   fork, handlebars, lamp: turns about the steering axis through the head
//   wheelF, wheelR, wheelS (sidecar)   spin about their axles
//   crank, pedalL, pedalR (bicycle)    crank turns about the bottom bracket
//   mg      the sidecar gun: traverses and elevates about its pivot
//   far     the whole machine in a few shapes, shown at a distance instead
// Anchors: riderHip, gripL/gripR (steer), footL/footR, pillionHip, pillionGripL/R,
// pillionFootL/R, sideHip, sideFootL/R, mgGripL/mgGripR/mgMuzzle (mg),
// exhaustL/exhaustR. Armor: thin sheet and tubes (a bullet goes through), the
// tires as kind 'tire' (a hit lets the air out). Modules: engine, fuel.
import * as THREE from 'three';
import { BIKES } from '../bikeDefs.js';
import { latheGeo, prismGeoX, gear, circle, arc, ribbon, convexGeo, roundRect, trackPath, TAU, DEG } from './vkit.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ---------------------------------------------------------------------------------------
// Small geometry helpers (geometries in model space unless noted).

// Cylinder between two points (a spoke, a stay); returns the geometry.
function rodGeo(from, to, r, seg = 6, r1 = r) {
  const a = V(from),
    c = V(to);
  const geo = new THREE.CylinderGeometry(r1, r, a.distanceTo(c), seg, 1, false);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize()));
  const m = a.add(c).multiplyScalar(0.5);
  geo.translate(m.x, m.y, m.z);
  return geo;
}

// Smooth bent tube through points (frames, handlebars, exhaust pipes).
function tube(b, pts, r, mat, { seg = 8, samples = 0, closed = false, tension = 0.5 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(V), closed, 'catmullrom', tension);
  const n = samples || Math.max(6, Math.round(curve.getLength() / 0.03));
  return b.add(new THREE.TubeGeometry(curve, n, r, seg, closed), mat);
}

// Coil spring along `axis` (unit) from `at`: wire radius w, coil radius r.
function coil(b, { at, axis = [0, 1, 0], len, r, w, turns, mat }) {
  const A = V(axis).normalize();
  const U = Math.abs(A.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(A).normalize() : new THREE.Vector3(1, 0, 0).cross(A).normalize();
  const W = A.clone().cross(U);
  const pts = [];
  const n = Math.round(turns * 10);
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      a = t * turns * TAU;
    const p = V(at).addScaledVector(A, t * len).addScaledVector(U, r * Math.cos(a)).addScaledVector(W, r * Math.sin(a));
    pts.push(p.toArray());
  }
  return tube(b, pts, w, mat, { seg: 5, samples: n * 2, tension: 0.3 });
}

// Plain cylinder along an axis direction through a center (lamps, drums, mufflers).
function cylDir(b, { at, dir, len, r, r1 = r, mat, seg = 16 }) {
  const D = V(dir).normalize();
  const a = V(at).addScaledVector(D, -len / 2),
    c = V(at).addScaledVector(D, len / 2);
  return b.add(rodGeo(a.toArray(), c.toArray(), r, seg, r1), mat);
}

// Fender (mudguard): a curved channel around a wheel, in the side view an arc of
// radius r about (cz, cy) from angle a0 to a1 (radians, 0 = toward +Z/back, PI/2 =
// up), width w across X centered at x, with side valances of depth `skirt`.
function fender(b, { cz, cy, r, a0, a1, w, x = 0, mat, skirt = 0, t = 0.004 }) {
  const n = Math.max(6, Math.round(Math.abs(a1 - a0) / 0.12));
  const line = arc(cz, cy, r, a0, a1, n);
  b.prismX({ points: ribbon(line, t), x0: x - w / 2, x1: x + w / 2, mat, bevel: 0.0015 });
  if (skirt > 0)
    for (const s of [-1, 1]) {
      const outer = arc(cz, cy, r + 0.002, a0, a1, n);
      const inner = arc(cz, cy, r - skirt, a1, a0, n);
      b.prismX({ points: [...outer, ...inner], x0: x + s * (w / 2) - (s > 0 ? t : 0), x1: x + s * (w / 2) + (s < 0 ? t : 0), mat, bevel: 0 });
    }
}

// Lamp facing `dir`: a bowl, a rim and the lens.
function lamp(b, { at, dir = [0, 0, -1], r, depth = r * 0.9, mat, rim = 'chrome', lens = 'lamp' }) {
  const D = V(dir).normalize();
  const c = V(at);
  b.latheDir({
    profile: [
      [0, -depth],
      [r * 0.5, -depth * 0.92],
      [r * 0.85, -depth * 0.6],
      [r, -depth * 0.2],
      [r, 0],
      [0, 0],
    ],
    at: c.toArray(),
    dir: D.toArray(),
    mat,
    seg: 18,
  });
  b.latheDir({ profile: [[r * 0.98, -0.004], [r * 1.04, 0.002], [r * 0.96, 0.008], [r * 0.9, 0.004]], at: c.toArray(), dir: D.toArray(), mat: rim, seg: 18 });
  b.latheDir({ profile: [[0, 0.006], [r * 0.6, 0.005], [r * 0.92, 0.001], [0, 0]], at: c.toArray(), dir: D.toArray(), mat: lens, seg: 18 });
}

// Wire-spoked wheel in a LOCAL frame (axle along X, centered at the origin) as an
// item list for b.addAll: tire (with block tread for motorcycles), rim, spokes
// laced tangentially from two hub flanges, hub, and a brake drum.
function spokedWheel({ R, tire, rimR, spokes = 36, flangeR = 0.025, hubW = 0.07, hubR = 0.018, drumR = 0, drumW = 0, tread = false, rimMat = 'chrome', spokeMat = 'chrome', hubMat = 'chrome', spokeR = 0.0012, rimW = tire * 0.75, seg = 32 }) {
  const items = [];
  const t = tire / 2;
  const rc = R - t * 1.05;
  // Tire: a rounded section seated in the rim (outline [radius, x] around the
  // tread from one bead to the other, closed along the rim).
  const n = 12;
  const tireProf = [[rimR + 0.004, -rimW * 0.42]];
  for (let i = 0; i <= n; i++) {
    const a = (-0.68 + (1.36 * i) / n) * Math.PI;
    tireProf.push([rc + t * 1.05 * Math.cos(a), t * Math.sin(a)]);
  }
  tireProf.push([rimR + 0.004, rimW * 0.42], [rimR + 0.004, -rimW * 0.42]);
  items.push({ mat: 'rubber', geo: latheGeo(tireProf, { seg, crease: 0.9 }) });
  if (tread) {
    // Block tread: two staggered rows of bars across the crown.
    const lugs = Math.round((TAU * R) / 0.045);
    const row = (x0, x1, phase) => prismGeoX(gear(lugs, R - 0.006, R + 0.005, { tooth: 0.45, tip: 0.38, phase, rootSeg: 2 }), x0, x1, { bevel: 0 });
    items.push({ mat: 'rubber', geo: row(-t * 0.82, -t * 0.08, 0) });
    items.push({ mat: 'rubber', geo: row(t * 0.08, t * 0.82, Math.PI / lugs) });
  }
  // Rim: a channel the bead sits in.
  const w = rimW / 2;
  items.push({
    mat: rimMat,
    geo: latheGeo(
      [
        [rimR + 0.006, -w],
        [rimR + 0.01, -w * 0.9],
        [rimR + 0.004, -w * 0.6],
        [rimR - 0.004, -w * 0.3],
        [rimR - 0.006, 0],
        [rimR - 0.004, w * 0.3],
        [rimR + 0.004, w * 0.6],
        [rimR + 0.01, w * 0.9],
        [rimR + 0.006, w],
        [rimR - 0.008, w * 0.7],
        [rimR - 0.012, 0],
        [rimR - 0.008, -w * 0.7],
        [rimR + 0.006, -w],
      ],
      { seg, crease: 0.5 },
    ),
  });
  // Spokes: alternate flanges, each leaving the hub at a tangent.
  const step = TAU / spokes;
  for (let i = 0; i < spokes; i++) {
    const side = i % 2 ? 1 : -1;
    const a = i * step;
    const lead = (i >> 1) % 2 ? 1 : -1;
    const ar = a + lead * step * (spokes >= 36 ? 3 : 2) * 2 * 0.5;
    const rimIn = rimR - 0.01;
    const from = [side * hubW * 0.45, flangeR * Math.cos(a), flangeR * Math.sin(a)];
    const to = [side * 0.003, rimIn * Math.cos(ar), rimIn * Math.sin(ar)];
    items.push({ mat: spokeMat, geo: rodGeo(from, to, spokeR, 3) });
  }
  // Hub barrel and flanges.
  items.push({
    mat: hubMat,
    geo: latheGeo(
      [
        [0.006, -hubW * 0.62],
        [hubR * 0.8, -hubW * 0.6],
        [flangeR * 1.15, -hubW * 0.52],
        [flangeR * 1.15, -hubW * 0.4],
        [hubR, -hubW * 0.36],
        [hubR * 0.85, 0],
        [hubR, hubW * 0.36],
        [flangeR * 1.15, hubW * 0.4],
        [flangeR * 1.15, hubW * 0.52],
        [hubR * 0.8, hubW * 0.6],
        [0.006, hubW * 0.62],
      ],
      { seg: 16, crease: 0.6 },
    ),
  });
  if (drumR > 0) {
    // Brake drum on the left of the hub, with cooling ribs.
    const x0 = -hubW * 0.5,
      x1 = x0 - drumW;
    const p = [[0.01, x1 - 0.004]];
    p.push([drumR * 0.96, x1 - 0.004], [drumR, x1 + 0.004]);
    for (let k = 0; k < 4; k++) {
      const xa = x1 + 0.008 + (k * (drumW - 0.012)) / 4;
      p.push([drumR, xa], [drumR + 0.006, xa + 0.002], [drumR + 0.006, xa + 0.006], [drumR, xa + 0.008]);
    }
    p.push([drumR, x0], [hubR, x0 + 0.004], [0.01, x0 + 0.004]);
    items.push({ mat: hubMat, geo: latheGeo(p, { seg: 24, crease: 0.6 }) });
  }
  return items;
}

// A whole wheel as one simple disc for the distant version.
function farWheel(b, { x = 0, y, z, R, w }) {
  b.cylAxis({ axis: 'x', x, y, z, len: w, r: R, mat: 'rubber', seg: 14 });
}

// Sprung solo saddle: leather top on a steel frame, two coil springs at the back.
function saddle(b, { at, len = 0.27, w = 0.2, mat = 'leather', springs = true, springH = 0.06, frame = 'black', nose = 0.06 }) {
  const [x, y, z] = at;
  const pts = [];
  // Plan outline: wide at the back, a narrow nose forward.
  const plan = [
    [0, -len / 2],
    [nose / 2, -len / 2 + 0.01],
    [nose * 0.55, -len * 0.2],
    [w * 0.4, len * 0.12],
    [w * 0.5, len * 0.32],
    [w * 0.47, len * 0.47],
    [w * 0.25, len / 2],
  ];
  const full = [...plan, ...plan.slice(1).reverse().map(([px, pz]) => [-px, pz])];
  for (const [px, pz] of full) {
    const sag = 0.012 * (1 - (2 * Math.abs(px)) / w);
    pts.push([x + px, y + 0.018 - sag * 0.4, z + pz]);
    pts.push([x + px * 0.92, y - 0.02, z + pz * 0.97]);
  }
  b.convex({ points: pts, mat, crease: 0.9 });
  if (springs) {
    for (const s of [-1, 1]) coil(b, { at: [x + s * w * 0.3, y - 0.02 - springH, z + len * 0.3], len: springH, r: 0.014, w: 0.0028, turns: 5, mat: frame });
    b.rod({ from: [x - w * 0.3, y - 0.02 - springH, z + len * 0.3], to: [x + w * 0.3, y - 0.02 - springH, z + len * 0.3], r: 0.005, mat: frame });
  }
}

// ---------------------------------------------------------------------------------------
// Machine guns on the sidecar mount, modeled about their own pivot (part 'mg').
// Gun frame: bore along -Z through (pivot + [0, 0.04, 0]).

function mgBrowning(b, p) {
  const [x, y0, z] = p;
  const y = y0 + 0.05;
  const M = 'blued';
  // Receiver, cover, perforated barrel jacket, flash hider, pistol grip.
  b.box({ x, y, z: z + 0.08, w: 0.06, h: 0.105, d: 0.5, r: 0.006, mat: M });
  b.box({ x, y: y + 0.058, z: z + 0.06, w: 0.056, h: 0.014, d: 0.3, r: 0.004, mat: M });
  b.cyl({ z0: z - 0.17, z1: z - 0.6, r0: 0.024, x, y, mat: M, seg: 14 });
  for (let k = 0; k < 7; k++) b.cyl({ z0: z - 0.2 - k * 0.055, z1: z - 0.22 - k * 0.055, r0: 0.0255, x, y, mat: 'dark', seg: 14 });
  b.cyl({ z0: z - 0.6, z1: z - 0.68, r0: 0.0115, x, y, mat: M, seg: 10 });
  b.cyl({ z0: z - 0.68, z1: z - 0.73, r0: 0.016, r1: 0.019, x, y, mat: M, seg: 10 });
  b.box({ x, y: y - 0.085, z: z + 0.3, w: 0.03, h: 0.1, d: 0.04, r: 0.008, mat: 'wood', rx: 0.25 });
  b.box({ x: x - 0.075, y: y - 0.01, z: z + 0.06, w: 0.085, h: 0.13, d: 0.24, r: 0.006, mat: 'od' }); // ammunition box
  b.rod({ from: [x - 0.035, y + 0.03, z + 0.06], to: [x - 0.035, y + 0.04, z + 0.02], r: 0.012, mat: 'brass' }); // belt
  b.cyl({ z0: z + 0.33, z1: z + 0.37, r0: 0.008, x, y, mat: M, seg: 8 }); // back plate buffer
  b.anchor('mgGripR', x, y - 0.06, z + 0.31);
  b.anchor('mgGripL', x - 0.05, y + 0.02, z + 0.2);
  b.anchor('mgMuzzle', x, y, z - 0.73);
}

function mg34(b, p) {
  const [x, y0, z] = p;
  const y = y0 + 0.05;
  const M = 'blued';
  b.cyl({ z0: z - 0.08, z1: z + 0.2, r0: 0.026, x, y, mat: M, seg: 14 }); // receiver
  b.box({ x, y: y + 0.024, z: z + 0.02, w: 0.05, h: 0.03, d: 0.22, r: 0.005, mat: M }); // feed cover
  b.cyl({ z0: z - 0.08, z1: z - 0.5, r0: 0.024, x, y, mat: M, seg: 14 }); // perforated jacket
  for (let k = 0; k < 6; k++) for (let j = 0; j < 2; j++) b.cyl({ z0: z - 0.11 - k * 0.062 - j * 0.026, z1: z - 0.125 - k * 0.062 - j * 0.026, r0: 0.0248, x, y, mat: 'dark', seg: 14 });
  b.cyl({ z0: z - 0.5, z1: z - 0.6, r0: 0.018, r1: 0.022, x, y, mat: M, seg: 12 }); // muzzle booster
  // Butt stock and pistol grip.
  b.extrude({
    points: [
      [0.2, 0.012],
      [0.46, -0.01],
      [0.48, -0.075],
      [0.44, -0.08],
      [0.3, -0.04],
      [0.2, -0.03],
    ].map(([zz, yy]) => [z + zz, y + yy]),
    width: 0.035,
    x,
    mat: 'black',
    bevel: 0.006,
  });
  b.box({ x, y: y - 0.065, z: z + 0.14, w: 0.03, h: 0.09, d: 0.04, r: 0.008, mat: 'black', rx: 0.3 });
  // 50-round belt drum on the left.
  b.cylAxis({ axis: 'x', x: x - 0.05, y: y - 0.03, z: z + 0.0, len: 0.07, r: 0.06, mat: M, seg: 18 });
  b.anchor('mgGripR', x, y - 0.06, z + 0.15);
  b.anchor('mgGripL', x - 0.02, y + 0.03, z - 0.02);
  b.anchor('mgMuzzle', x, y, z - 0.6);
}

function mgDP(b, p) {
  const [x, y0, z] = p;
  const y = y0 + 0.05;
  const M = 'blued';
  b.box({ x, y, z: z + 0.04, w: 0.05, h: 0.07, d: 0.3, r: 0.005, mat: M }); // receiver
  b.cyl({ z0: z - 0.1, z1: z - 0.62, r0: 0.03, x, y, mat: M, seg: 14 }); // ribbed shroud
  for (let k = 0; k < 8; k++) b.cyl({ z0: z - 0.13 - k * 0.06, z1: z - 0.15 - k * 0.06, r0: 0.0305, x, y, mat: 'dark', seg: 14 });
  b.cyl({ z0: z - 0.62, z1: z - 0.72, r0: 0.012, x, y, mat: M, seg: 10 });
  b.cyl({ z0: z - 0.72, z1: z - 0.78, r0: 0.02, r1: 0.024, x, y, mat: M, seg: 10 }); // flash hider
  // The 47-round pan magazine flat on top.
  b.cylAxis({ axis: 'y', x, y: y + 0.06, z: z + 0.02, len: 0.035, r: 0.13, mat: M, seg: 24 });
  b.cylAxis({ axis: 'y', x, y: y + 0.08, z: z + 0.02, len: 0.008, r: 0.03, mat: M, seg: 12 });
  // Wooden butt stock with its grip.
  b.extrude({
    points: [
      [0.17, 0.02],
      [0.5, -0.02],
      [0.52, -0.11],
      [0.46, -0.11],
      [0.26, -0.06],
      [0.17, -0.03],
    ].map(([zz, yy]) => [z + zz, y + yy]),
    width: 0.04,
    x,
    mat: 'wood',
    bevel: 0.006,
  });
  b.anchor('mgGripR', x, y - 0.06, z + 0.24);
  b.anchor('mgGripL', x - 0.03, y + 0.0, z - 0.12);
  b.anchor('mgMuzzle', x, y, z - 0.78);
}

const GUNS = { browning: mgBrowning, mg34, dp: mgDP };

// ---------------------------------------------------------------------------------------
// Bicycle: a French roadster of the 1930s (28 x 1 1/2 in wheels, single speed).

export function bicycle(b) {
  const D = BIKES.bicycle;
  const L = D.wheelbase,
    R = D.wheelRadius;
  const zF = -L / 2,
    zR = L / 2;
  const P = 'enamel',
    C = 'chrome';
  const st = D.steering;
  const H = st.head;
  const ax = [0, Math.cos(st.rake), Math.sin(st.rake)];
  const onAxis = (t) => [0, H[1] + ax[1] * t, H[2] + ax[2] * t];
  const pd = D.pedal;
  const bb = pd.bb;

  // ---- Wheels -----------------------------------------------------------------------
  const wheel = spokedWheel({ R, tire: 0.038, rimR: 0.3175, spokes: 36, flangeR: 0.022, hubW: 0.075, hubR: 0.014, rimW: 0.026, spokeR: 0.001 });
  b.part('wheelF', [0, R, zF]).addAll(wheel, { y: R, z: zF });
  b.part('wheelR', [0, R, zR]).addAll(wheel, { y: R, z: zR });
  // Freewheel sprocket (20 T) on the right of the rear hub.
  b.add(prismGeoX(gear(20, 0.0385, 0.043, { tooth: 0.45, tip: 0.25 }), 0.042, 0.046, { bevel: 0 }), 'steel', { y: R, z: zR });
  b.body();

  // ---- Frame ------------------------------------------------------------------------
  const seatTop = [0, 0.815, 0.311];
  const htTop = onAxis(0.085),
    htBot = onAxis(-0.09);
  b.rod({ from: onAxis(-0.1), to: onAxis(0.095), r: 0.0175, mat: P }); // head tube
  for (const t of [-0.1, 0.095]) b.latheDir({ profile: [[0.019, -0.008], [0.021, 0], [0.019, 0.008]], at: onAxis(t), dir: ax, mat: C, seg: 14 }); // headset cups
  b.rod({ from: [0, 0.8, 0.298], to: [0, htTop[1] - 0.025, htTop[2] - 0.01], r: 0.0143, mat: P }); // top tube
  b.rod({ from: [0, htBot[1] + 0.02, htBot[2] + 0.005], to: [0, bb[1] + 0.01, bb[2] - 0.01], r: 0.0143, mat: P }); // down tube
  b.rod({ from: bb, to: [0, seatTop[1] + 0.02, seatTop[2] + 0.007], r: 0.0143, mat: P }); // seat tube
  b.cylAxis({ axis: 'x', x: 0, y: bb[1], z: bb[2], len: 0.07, r: 0.02, mat: P, seg: 14 }); // bottom bracket shell
  for (const s of [-1, 1]) {
    tube(b, [[s * 0.012, 0.795, 0.3], [s * 0.035, 0.6, 0.43], [s * 0.055, R + 0.012, zR - 0.005]], 0.0075, P); // seat stays
    tube(b, [[s * 0.025, bb[1], bb[2] + 0.02], [s * 0.05, 0.31, 0.35], [s * 0.055, R - 0.008, zR - 0.01]], 0.009, P); // chain stays
    b.box({ x: s * 0.056, y: R, z: zR, w: 0.006, h: 0.04, d: 0.035, r: 0.003, mat: P }); // rear dropout
  }
  // Lugs at the joints.
  for (const p of [[0, 0.8, 0.3], [0, htTop[1] - 0.02, htTop[2]], [0, htBot[1] + 0.02, htBot[2]]]) b.sphere({ x: p[0], y: p[1], z: p[2], r: 0.019, mat: P, seg: 10 });
  // Kickstand on the left chain stay (its foot on the ground when parked leaning).
  b.rod({ from: [-0.03, 0.255, 0.2], to: [-0.12, 0.02, 0.26], r: 0.006, mat: P });
  b.box({ x: -0.12, y: 0.012, z: 0.26, w: 0.03, h: 0.006, d: 0.02, r: 0.002, mat: P });
  // Chain guard over the top run (right): a thin strip with a lip over the chain.
  const cgA = [bb[1] + 0.093 + 0.022, bb[2] + 0.02],
    cgB = [R + 0.042 + 0.022, zR - 0.07];
  const cgRx = -Math.atan2(cgB[0] - cgA[0], cgB[1] - cgA[1]);
  const cgLen = Math.hypot(cgB[0] - cgA[0], cgB[1] - cgA[1]);
  const cgY = (cgA[0] + cgB[0]) / 2,
    cgZ = (cgA[1] + cgB[1]) / 2;
  b.box({ x: 0.076, y: cgY - 0.012, z: cgZ, w: 0.003, h: 0.026, d: cgLen, r: 0.0012, mat: P, rx: cgRx });
  b.box({ x: 0.068, y: cgY, z: cgZ, w: 0.018, h: 0.003, d: cgLen, r: 0.0012, mat: P, rx: cgRx });

  // ---- Seat post, saddle, rear carrier and mudguard --------------------------------------
  b.rod({ from: [0, 0.8, 0.306], to: [0, 0.94, 0.36], r: 0.011, mat: C });
  b.box({ x: 0, y: 0.95, z: 0.37, w: 0.05, h: 0.02, d: 0.06, r: 0.004, mat: C }); // clip
  saddle(b, { at: [0, 1.0, 0.37], len: 0.27, w: 0.2, mat: 'leather', springH: 0.05 });
  b.anchor('riderHip', ...D.seats[0].hip);
  fender(b, { cz: zR, cy: R, r: R + 0.025, a0: -0.25, a1: 2.1, w: 0.052, mat: P, t: 0.003 });
  // Rear carrier.
  const rk = 0.73;
  for (const s of [-1, 1]) {
    b.rod({ from: [s * 0.06, rk, 0.37], to: [s * 0.06, rk, 0.82], r: 0.0045, mat: P });
    b.rod({ from: [s * 0.06, rk, 0.78], to: [s * 0.058, R + 0.01, zR + 0.012], r: 0.0045, mat: P });
    b.rod({ from: [s * 0.06, rk, 0.4], to: [s * 0.012, 0.79, 0.31], r: 0.004, mat: P });
  }
  for (const zz of [0.45, 0.55, 0.65, 0.75]) b.rod({ from: [-0.06, rk, zz], to: [0.06, rk, zz], r: 0.003, mat: P });
  lamp(b, { at: [0, 0.62, 0.86], dir: [0, 0, 1], r: 0.018, depth: 0.02, mat: P, lens: 'redLamp' }); // red tail lamp

  // ---- Crankset: chainring (right), cranks; pedals separate ----------------------------
  b.part('crank', bb);
  b.cylAxis({ axis: 'x', x: 0, y: bb[1], z: bb[2], len: 0.135, r: 0.008, mat: C, seg: 10 });
  const ringHoles = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    ringHoles.push(circle(0.026, 10, 0.055 * Math.cos(a), 0.055 * Math.sin(a)));
  }
  b.add(prismGeoX(gear(46, 0.089, 0.094, { tooth: 0.45, tip: 0.25 }), 0.062, 0.066, { holes: ringHoles.map((h) => h.map(([u, v]) => [u, v])), bevel: 0 }), C, { y: bb[1], z: bb[2] });
  // Right crank points down, left up (crank angle 0).
  b.box({ x: 0.075, y: bb[1] - pd.crank / 2, z: bb[2], w: 0.012, h: pd.crank + 0.03, d: 0.022, r: 0.005, mat: C });
  b.box({ x: -0.075, y: bb[1] + pd.crank / 2, z: bb[2], w: 0.012, h: pd.crank + 0.03, d: 0.022, r: 0.005, mat: C });
  for (const s of [-1, 1]) {
    const py = bb[1] - s * pd.crank;
    b.part(s > 0 ? 'pedalR' : 'pedalL', [s * pd.pedalX, py, bb[2]]);
    b.cylAxis({ axis: 'x', x: s * (pd.pedalX - 0.045), y: py, z: bb[2], len: 0.02, r: 0.006, mat: C, seg: 8 });
    b.box({ x: s * pd.pedalX, y: py, z: bb[2], w: 0.09, h: 0.016, d: 0.06, r: 0.004, mat: 'steel' });
    for (const dz of [-0.022, 0.022]) b.box({ x: s * pd.pedalX, y: py, z: bb[2] + dz, w: 0.085, h: 0.022, d: 0.016, r: 0.004, mat: 'rubber' });
  }
  b.body();
  // The chain: a loop around the chainring and the sprocket (right side).
  const chain = trackPath(
    [
      { z: zR, y: R, r: 0.042 },
      { z: bb[2], y: bb[1], r: 0.093 },
    ],
    { step: 0.02 },
  );
  tube(b, chain.map(([zz, yy]) => [0.064, yy, zz]), 0.0035, 'black', { seg: 4, closed: true, samples: chain.length, tension: 0.1 });

  // ---- Fork, bars and lamp (turn with the steering) -------------------------------------
  b.part('steer', H);
  const crown = onAxis(-0.115);
  b.rod({ from: onAxis(-0.13), to: onAxis(0.12), r: 0.011, mat: C }); // steerer
  b.box({ x: 0, y: crown[1], z: crown[2], w: 0.11, h: 0.03, d: 0.04, r: 0.008, mat: P, rx: st.rake });
  for (const s of [-1, 1]) {
    tube(b, [[s * 0.045, crown[1] - 0.01, crown[2]], [s * 0.05, 0.52, -0.475], [s * 0.05, 0.42, -0.53], [s * 0.05, R + 0.005, zF - 0.002]], 0.0105, P);
    b.box({ x: s * 0.05, y: R, z: zF, w: 0.006, h: 0.035, d: 0.03, r: 0.003, mat: P }); // dropout
  }
  // Stem and swept-back roadster bars.
  const stemTop = onAxis(0.18);
  b.rod({ from: onAxis(0.09), to: stemTop, r: 0.011, mat: C });
  b.rod({ from: stemTop, to: [0, stemTop[1] + 0.01, -0.33], r: 0.011, mat: C });
  const gl = D.seats[0].grips;
  tube(b, [gl[0], [-0.25, 1.02, -0.2], [-0.17, 0.99, -0.3], [-0.06, 0.975, -0.33], [0.06, 0.975, -0.33], [0.17, 0.99, -0.3], [0.25, 1.02, -0.2], gl[1]], 0.011, C);
  for (const g of gl) b.rod({ from: [g[0] * 0.99, g[1] - 0.005, g[2] - 0.045], to: [g[0] * 1.01, g[1] + 0.004, g[2] + 0.06], r: 0.016, mat: 'leatherBlack', seg: 10 });
  b.at('steer', 'gripL', ...gl[0]);
  b.at('steer', 'gripR', ...gl[1]);
  // Brake levers, the bell (left) and the front rim brake.
  for (const s of [-1, 1]) b.rod({ from: [s * 0.24, 1.0, -0.21], to: [s * 0.25, 0.985, -0.1], r: 0.005, mat: C });
  b.cylAxis({ axis: 'y', x: -0.1, y: 0.995, z: -0.32, len: 0.016, r: 0.028, mat: C, seg: 16 });
  b.box({ x: 0, y: R + R * 0.9, z: zF + 0.02, w: 0.07, h: 0.02, d: 0.025, r: 0.004, mat: C });
  // Lamp on the fork crown and its dynamo on the right blade.
  lamp(b, { at: [0, crown[1] + 0.02, crown[2] - 0.075], r: 0.042, depth: 0.05, mat: C });
  b.rod({ from: [0, crown[1] + 0.01, crown[2] - 0.025], to: [0, crown[1] + 0.02, crown[2] - 0.03], r: 0.006, mat: C });
  cylDir(b, { at: [0.065, 0.5, -0.47], dir: [0, 0.9, 0.3], len: 0.08, r: 0.018, mat: C, seg: 12 });
  // Front mudguard turns with the fork.
  fender(b, { cz: zF, cy: R, r: R + 0.022, a0: 0.45, a1: 2.85, w: 0.05, mat: P, t: 0.003 });
  for (const s of [-1, 1]) b.rod({ from: [s * 0.03, R - 0.04, zF - R - 0.005], to: [s * 0.05, R, zF], r: 0.0025, mat: C });
  b.body();

  // ---- Distant version --------------------------------------------------------------
  b.part('far', [0, 0, 0]);
  farWheel(b, { y: R, z: zF, R, w: 0.04 });
  farWheel(b, { y: R, z: zR, R, w: 0.04 });
  b.rod({ from: [0, 0.8, 0.3], to: htTop, r: 0.016, mat: P, seg: 5 });
  b.rod({ from: htBot, to: bb, r: 0.016, mat: P, seg: 5 });
  b.rod({ from: bb, to: [0, 0.83, 0.32], r: 0.016, mat: P, seg: 5 });
  b.rod({ from: [0, 0.8, 0.3], to: [0, R, zR], r: 0.012, mat: P, seg: 5 });
  b.rod({ from: bb, to: [0, R, zR], r: 0.012, mat: P, seg: 5 });
  b.rod({ from: htBot, to: [0, R, zF], r: 0.012, mat: P, seg: 5 });
  b.rod({ from: [-0.27, 1.04, -0.15], to: [0.27, 1.04, -0.15], r: 0.012, mat: P, seg: 5 });
  b.rod({ from: htTop, to: [0, 1.0, -0.28], r: 0.012, mat: P, seg: 5 });
  b.box({ x: 0, y: 0.99, z: 0.37, w: 0.16, h: 0.05, d: 0.26, r: 0.01, mat: 'leather' });
  b.body();

  // ---- Damage model -----------------------------------------------------------------
  b.armor('tireF', 'body', 3, [0, R, zF], [0, 0, 2 * R], [0, 2 * R, 0], [1, 0, 0]);
  b.meta.armor[b.meta.armor.length - 1].kind = 'tire';
  b.armor('tireR', 'body', 3, [0, R, zR], [0, 0, 2 * R], [0, 2 * R, 0], [1, 0, 0]);
  b.meta.armor[b.meta.armor.length - 1].kind = 'tire';
  b.armor('frame', 'body', 2, [0.012, 0.56, -0.02], [0, 0, 0.62], [0, 0.42, 0], [1, 0, 0]);
  meta(b, 'bicycle');
}

// ---------------------------------------------------------------------------------------
// Motorcycles: one builder, configured per machine.

const SPECS = {
  wla: {
    paint: 'od',
    engine: 'vtwin',
    fork: 'springer',
    rear: 'rigid',
    tank: 'split',
    feet: 'boards',
    rack: true,
    bags: true,
    scabbard: true,
    crash: true,
    exhaust: 1, // right side
    seatH: 0.77,
    seatZ: 0.24,
    tire: 0.1,
    rimR: 0.2286, // 18 in
    spokes: 40,
    drum: 0.09,
    barW: 0.4,
  },
  r75: {
    paint: 'dunkelgelb',
    engine: 'boxerOHV',
    fork: 'tele',
    rear: 'rigid',
    tank: 'r75',
    feet: 'pegs',
    pillion: true,
    crash: true,
    exhaust: -1, // left muffler
    seatH: 0.8,
    seatZ: 0.11,
    tire: 0.115,
    rimR: 0.2032, // 16 in
    spokes: 40,
    drum: 0.125,
    barW: 0.37,
  },
  m72: {
    paint: 'sovietGreen',
    engine: 'boxerSV',
    fork: 'tele',
    rear: 'plunger',
    tank: 'm72',
    feet: 'pegs',
    pillion: true,
    crash: false,
    exhaust: 0, // a muffler each side
    seatH: 0.79,
    seatZ: 0.11,
    tire: 0.095,
    rimR: 0.2413, // 19 in
    spokes: 40,
    drum: 0.1,
    barW: 0.36,
  },
};
const ARMY_GUN = { wla_sidecar: 'browning', r75_sidecar: 'mg34', m72_sidecar: 'dp' };

function motorcycle(b, id) {
  const D = BIKES[id];
  const base = id.replace('_sidecar', '');
  const S = SPECS[base];
  const P = S.paint;
  const L = D.wheelbase,
    R = D.wheelRadius;
  const zF = -L / 2,
    zR = L / 2;
  const st = D.steering;
  const H = st.head;
  const ax = [0, Math.cos(st.rake), Math.sin(st.rake)];
  const onAxis = (t) => [0, H[1] + ax[1] * t, H[2] + ax[2] * t];
  const rider = D.seats[0];

  // ---- Wheels -----------------------------------------------------------------------
  const wheelItems = (drum) => spokedWheel({ R, tire: S.tire, rimR: S.rimR, spokes: S.spokes, flangeR: 0.045, hubW: 0.13, hubR: 0.04, drumR: drum, drumW: 0.045, tread: true, rimMat: base === 'wla' ? 'black' : P, spokeMat: 'steel', hubMat: base === 'wla' ? 'black' : 'alu', spokeR: 0.0022, rimW: 0.07, seg: 32 });
  const wF = wheelItems(S.drum),
    wR = wheelItems(S.drum);
  b.part('wheelF', [0, R, zF]).addAll(wF, { y: R, z: zF });
  b.part('wheelR', [0, R, zR]).addAll(wR, { y: R, z: zR, ry: Math.PI });
  if (S.engine === 'vtwin') {
    // Rear sprocket (41 T) on the left of the rear hub, chain drive.
    b.add(prismGeoX(gear(41, 0.098, 0.105, { tooth: 0.45, tip: 0.25 }), -0.085, -0.079, { bevel: 0 }), 'black', { y: R, z: zR });
  }
  b.body();

  // ---- Frame ------------------------------------------------------------------------
  const F = P;
  const htTop = onAxis(0.09),
    htBot = onAxis(-0.1);
  b.rod({ from: onAxis(-0.12), to: onAxis(0.11), r: 0.028, mat: F }); // steering head
  // Backbone (top tube) from the head to the seat post, down tubes in front of the
  // engine splitting into a cradle under it, and the rear frame to the axle.
  const seatPost = [0, S.seatH - 0.08, S.seatZ - 0.07];
  b.rod({ from: [0, htTop[1] - 0.01, htTop[2] + 0.02], to: [0, seatPost[1] + 0.02, seatPost[2] - 0.04], r: 0.019, mat: F });
  const cradleY = 0.2;
  for (const s of [-1, 1]) {
    tube(b, [[s * 0.012, htBot[1] + 0.02, htBot[2] + 0.02], [s * 0.06, 0.55, -0.42], [s * 0.1, 0.3, -0.36], [s * 0.1, cradleY, -0.24], [s * 0.1, cradleY, 0.18], [s * 0.09, 0.3, 0.42], [s * 0.075, R, zR - 0.02]], 0.0145, F);
    tube(b, [[s * 0.02, seatPost[1], seatPost[2]], [s * 0.06, 0.6, 0.45], [s * 0.075, R + 0.02, zR - 0.02]], 0.012, F); // seat stays
    b.box({ x: s * 0.078, y: R, z: zR, w: 0.012, h: 0.07, d: 0.06, r: 0.004, mat: F }); // axle plates
  }
  b.rod({ from: seatPost, to: [0, cradleY + 0.02, 0.2], r: 0.018, mat: F }); // seat post tube

  // ---- Engine and gearbox ------------------------------------------------------------
  const exh = []; // exhaust ports [x, y, z, dir]
  if (S.engine === 'vtwin') vTwin(b, P, exh);
  else boxer(b, S, P, exh);

  // ---- Fuel tank ----------------------------------------------------------------------
  const tankTop = Math.min(htTop[1] + 0.04, S.seatH + 0.22);
  tank(b, S, P, htTop, seatPost, tankTop);

  // ---- Saddle and rear: fender, rack and bags, pillion -----------------------------------
  saddle(b, { at: [0, S.seatH, S.seatZ], len: 0.3, w: 0.27, mat: base === 'wla' ? 'leather' : 'leatherBlack', springH: 0.07, frame: 'black', nose: 0.08 });
  b.rod({ from: [0, S.seatH - 0.1, S.seatZ + 0.1], to: seatPost, r: 0.014, mat: 'black' });
  b.anchor('riderHip', ...rider.hip);
  fender(b, { cz: zR, cy: R, r: R + 0.035, a0: -0.35, a1: 2.0, w: S.tire + 0.075, mat: P, skirt: base === 'wla' ? 0.05 : 0.035 });
  for (const s of [-1, 1]) b.rod({ from: [s * 0.07, R + 0.24, zR + 0.12], to: [s * 0.075, R, zR], r: 0.008, mat: P }); // fender stays
  lamp(b, { at: [0, R + 0.25, zR + R + 0.03], dir: [0, -0.2, 1], r: 0.03, depth: 0.03, mat: P, lens: 'redLamp' });
  if (S.rack) {
    const ry = 0.74;
    for (const s of [-1, 1]) {
      b.rod({ from: [s * 0.1, ry, 0.3], to: [s * 0.1, ry, 0.9], r: 0.008, mat: P });
      b.rod({ from: [s * 0.1, ry, 0.86], to: [s * 0.08, R + 0.02, zR], r: 0.008, mat: P });
    }
    for (const zz of [0.42, 0.6, 0.78]) b.rod({ from: [-0.1, ry, zz], to: [0.1, ry, zz], r: 0.006, mat: P });
    if (S.bags)
      for (const s of [-1, 1]) {
        b.box({ x: s * 0.2, y: 0.6, z: 0.62, w: 0.12, h: 0.28, d: 0.36, r: 0.03, mat: 'leather' });
        b.box({ x: s * 0.26, y: 0.69, z: 0.62, w: 0.01, h: 0.12, d: 0.3, r: 0.004, mat: 'leather' }); // flap
        for (const dz of [-0.09, 0.09]) b.box({ x: s * 0.265, y: 0.66, z: 0.62 + dz, w: 0.006, h: 0.06, d: 0.02, r: 0.002, mat: 'black' });
      }
  }
  if (S.pillion) {
    const pl = D.seats.find((x) => x.style === 'pillion');
    saddle(b, { at: [0, pl.hip[1] - 0.08, pl.hip[2] + 0.02], len: 0.24, w: 0.24, mat: 'leatherBlack', springH: 0.06, frame: 'black', nose: 0.1 });
    b.rod({ from: [0, pl.hip[1] - 0.16, pl.hip[2] + 0.1], to: [0, R + 0.2, zR - 0.05], r: 0.012, mat: 'black' });
    // Grab handle on the back of the rider's saddle.
    tube(b, [[-0.1, pl.grips[0][1] - 0.04, pl.grips[0][2] + 0.03], [-0.1, pl.grips[0][1], pl.grips[0][2]], [0.1, pl.grips[0][1], pl.grips[0][2]], [0.1, pl.grips[0][1] - 0.04, pl.grips[0][2] + 0.03]], 0.008, 'black', { tension: 0.2 });
    b.anchor('pillionHip', ...pl.hip);
    b.anchor('pillionGripL', ...pl.grips[0]);
    b.anchor('pillionGripR', ...pl.grips[1]);
    for (const [k, f] of pl.feet.entries()) {
      b.cylAxis({ axis: 'x', x: f[0], y: f[1] - 0.02, z: f[2], len: 0.09, r: 0.012, mat: 'rubber', seg: 8 });
      b.anchor(k ? 'pillionFootR' : 'pillionFootL', ...f);
    }
  }

  // ---- Rider's feet: footboards (WLA) or pegs -----------------------------------------------
  for (const [k, f] of rider.feet.entries()) {
    const s = f[0] < 0 ? -1 : 1;
    if (S.feet === 'boards') {
      b.box({ x: f[0], y: f[1] - 0.025, z: f[2] + 0.02, w: 0.14, h: 0.02, d: 0.33, r: 0.008, mat: 'black' });
      for (let i = 0; i < 4; i++) b.box({ x: f[0], y: f[1] - 0.012, z: f[2] - 0.11 + i * 0.075, w: 0.13, h: 0.008, d: 0.03, r: 0.003, mat: 'rubber' });
      b.rod({ from: [f[0] - s * 0.06, f[1] - 0.03, f[2]], to: [s * 0.1, cradleY + 0.02, f[2]], r: 0.012, mat: 'black' });
    } else {
      b.cylAxis({ axis: 'x', x: f[0], y: f[1] - 0.02, z: f[2], len: 0.1, r: 0.014, mat: 'rubber', seg: 8 });
      b.rod({ from: [f[0] - s * 0.05, f[1] - 0.02, f[2]], to: [s * 0.1, cradleY + 0.04, f[2] + 0.04], r: 0.01, mat: 'black' });
    }
    b.anchor(k ? 'footR' : 'footL', ...f);
  }
  // Crash bars ahead of the engine.
  if (S.crash) {
    const wide = S.engine === 'vtwin' ? 0.3 : 0.44;
    tube(b, [[-0.06, 0.62, -0.42], [-wide, 0.42, -0.4], [-wide, 0.24, -0.3], [-0.1, cradleY + 0.01, -0.2]], 0.013, 'black');
    tube(b, [[0.06, 0.62, -0.42], [wide, 0.42, -0.4], [wide, 0.24, -0.3], [0.1, cradleY + 0.01, -0.2]], 0.013, 'black');
  }

  // ---- Exhaust ----------------------------------------------------------------------------
  exhaust(b, S, exh, R, zR);

  // ---- Front: fork, bars, lamp, mudguard (turn with the steering) ---------------------------
  b.part('steer', H);
  b.rod({ from: onAxis(-0.14), to: onAxis(0.13), r: 0.02, mat: 'black' });
  const crownLo = onAxis(-0.12),
    crownHi = onAxis(0.11);
  for (const c of [crownLo, crownHi]) b.box({ x: 0, y: c[1], z: c[2] - 0.02, w: 0.24, h: 0.035, d: 0.07, r: 0.01, mat: P, rx: st.rake });
  if (S.fork === 'springer') {
    // Springer: rigid rear legs to the axle, front legs on the rocker, springs above the crown.
    for (const s of [-1, 1]) {
      b.rod({ from: [s * 0.1, crownLo[1], crownLo[2] - 0.01], to: [s * 0.1, R + 0.05, zF + 0.03], r: 0.014, mat: P });
      b.rod({ from: [s * 0.1, crownHi[1] + 0.05, crownHi[2] - 0.07], to: [s * 0.1, R + 0.06, zF - 0.04], r: 0.012, mat: P });
      coil(b, { at: [s * 0.1, crownLo[1] + 0.02, crownLo[2] - 0.06], axis: ax, len: 0.17, r: 0.019, w: 0.004, turns: 8, mat: 'black' });
      b.box({ x: s * 0.1, y: R + 0.03, z: zF + 0.0, w: 0.02, h: 0.03, d: 0.12, r: 0.008, mat: P, rx: 0.3 }); // rocker
    }
  } else {
    // Telescopic fork: stanchions in sliders, shrouds above.
    for (const s of [-1, 1]) {
      const top = [s * 0.1, crownHi[1], crownHi[2] - 0.02];
      const mid = [s * 0.1, crownLo[1] - 0.04, crownLo[2] - 0.06];
      const bot = [s * 0.1, R + 0.02, zF + 0.01];
      b.rod({ from: top, to: mid, r: 0.024, mat: P });
      b.rod({ from: mid, to: bot, r: 0.02, mat: 'alu' });
      b.rod({ from: [s * 0.1, R + 0.15, zF + 0.06], to: bot, r: 0.026, mat: 'alu' });
    }
  }
  b.rod({ from: [-0.1, R, zF], to: [0.1, R, zF], r: 0.012, mat: 'steel' }); // axle
  // Handlebars with grips, levers and a horn.
  const g = rider.grips;
  const barC = [0, crownHi[1] + 0.06, crownHi[2] - 0.05];
  tube(b, [g[0], [-S.barW * 0.75, g[0][1] - 0.01, g[0][2] - 0.04], [-0.12, barC[1], barC[2] - 0.02], [0, barC[1], barC[2]], [0.12, barC[1], barC[2] - 0.02], [S.barW * 0.75, g[1][1] - 0.01, g[1][2] - 0.04], g[1]], 0.0125, 'black');
  b.rod({ from: crownHi, to: barC, r: 0.016, mat: 'black' });
  for (const gg of g) {
    const s = gg[0] < 0 ? -1 : 1;
    b.rod({ from: [gg[0] - s * 0.055, gg[1], gg[2] - 0.01], to: [gg[0] + s * 0.06, gg[1] + 0.005, gg[2] + 0.02], r: 0.017, mat: 'rubber', seg: 10 });
    b.rod({ from: [gg[0] - s * 0.04, gg[1] + 0.01, gg[2] - 0.03], to: [gg[0] + s * 0.03, gg[1] - 0.005, gg[2] - 0.09], r: 0.006, mat: 'steel' });
  }
  b.at('steer', 'gripL', ...g[0]);
  b.at('steer', 'gripR', ...g[1]);
  // Headlamp (a blackout cover with a slit on the German machine).
  const hl = [0, crownHi[1] - 0.06, crownHi[2] - 0.17];
  lamp(b, { at: hl, r: 0.085, depth: 0.12, mat: P, rim: base === 'r75' ? P : 'black' });
  if (base === 'r75') b.box({ x: 0, y: hl[1] - 0.02, z: hl[2] - 0.005, w: 0.15, h: 0.11, d: 0.012, r: 0.03, mat: P });
  b.rod({ from: [0, hl[1], hl[2] + 0.08], to: crownHi, r: 0.012, mat: P });
  cylDir(b, { at: [-0.08, crownLo[1] - 0.05, crownLo[2] - 0.13], dir: [0, 0, -1], len: 0.05, r: 0.035, r1: 0.04, mat: 'black', seg: 12 }); // horn
  fender(b, { cz: zF, cy: R, r: R + 0.035, a0: 0.25, a1: 2.75, w: S.tire + 0.07, mat: P, skirt: 0.045 });
  for (const s of [-1, 1]) b.rod({ from: [s * 0.08, R + 0.03, zF - R - 0.02], to: [s * 0.1, R, zF], r: 0.007, mat: P });
  if (base === 'wla') {
    // Blackout lamp on the front fender, and the Thompson scabbard on the right fork.
    lamp(b, { at: [0, R + R + 0.05, zF - 0.1], r: 0.03, depth: 0.04, mat: P });
  } else {
    lamp(b, { at: [-0.06, R + R + 0.05, zF - 0.12], r: 0.04, depth: 0.05, mat: P }); // Notek blackout lamp
  }
  b.body();
  if (S.scabbard) {
    // The Thompson in its leather boot along the right fork leg: muzzle down by
    // the axle, the butt stock sticking out at the top, two straps to the fork.
    const lo = [0.205, 0.44, zF + 0.04],
      hi = [0.215, 0.9, zF + 0.25];
    const len = Math.hypot(hi[1] - lo[1], hi[2] - lo[2]);
    const ay = (hi[1] - lo[1]) / len,
      az = (hi[2] - lo[2]) / len;
    b.rod({ from: lo, to: hi, r: 0.026, r1: 0.042, mat: 'leather', seg: 10 });
    b.sphere({ x: lo[0], y: lo[1], z: lo[2], r: 0.026, mat: 'leather', seg: 8 });
    b.rod({ from: hi, to: [hi[0], hi[1] + ay * 0.16, hi[2] + az * 0.16], r: 0.03, r1: 0.022, mat: 'wood', seg: 6 });
    for (const t of [0.3, 0.75]) {
      const y = lo[1] + (hi[1] - lo[1]) * t,
        z = lo[2] + (hi[2] - lo[2]) * t;
      b.rod({ from: [0.13, y, z], to: [0.25, y, z], r: 0.005, mat: 'black', seg: 5 });
    }
  }

  // ---- Distant version --------------------------------------------------------------
  b.part('far', [0, 0, 0]);
  farWheel(b, { y: R, z: zF, R, w: S.tire });
  farWheel(b, { y: R, z: zR, R, w: S.tire });
  b.box({ x: 0, y: 0.4, z: -0.05, w: S.engine === 'vtwin' ? 0.25 : 0.7, h: 0.3, d: 0.45, r: 0.04, mat: 'alu' });
  b.box({ x: 0, y: tankTop - 0.1, z: -0.2, w: 0.28, h: 0.2, d: 0.55, r: 0.06, mat: P });
  b.box({ x: 0, y: S.seatH, z: S.seatZ, w: 0.26, h: 0.06, d: 0.3, r: 0.02, mat: 'leatherBlack' });
  b.box({ x: 0, y: R + 0.12, z: zR, w: S.tire + 0.07, h: 0.25, d: 0.7, r: 0.05, mat: P });
  b.box({ x: 0, y: R + 0.14, z: zF, w: S.tire + 0.07, h: 0.22, d: 0.6, r: 0.05, mat: P });
  b.rod({ from: [-0.38, 1.0, -0.42], to: [0.38, 1.0, -0.42], r: 0.015, mat: 'black', seg: 5 });
  b.rod({ from: [0, 0.98, -0.45], to: [0, R, zF], r: 0.03, mat: P, seg: 5 });
  b.rod({ from: [0, 0.2, 0.15], to: [0, R, zR], r: 0.03, mat: 'black', seg: 5 });
  b.body();

  // ---- Damage model -----------------------------------------------------------------
  const tireArmor = (name, z, x = 0) => {
    b.armor(name, 'body', 4, [x, R, z], [0, 0, 2 * R], [0, 2 * R, 0], [1, 0, 0]);
    const a = b.meta.armor[b.meta.armor.length - 1];
    a.kind = 'tire';
    a.half[0] = S.tire / 2;
  };
  tireArmor('tireF', zF);
  tireArmor('tireR', zR);
  b.armor('tank', 'body', 1, [0, tankTop - 0.1, -0.2], [0, 0, 0.5], [0, 0.18, 0], [1, 0, 0]);
  b.meta.armor[b.meta.armor.length - 1].half[0] = 0.14;
  b.armor('engine', 'body', 6, [0, 0.4, -0.08], [0, 0, 0.4], [0, 0.3, 0], [1, 0, 0]);
  b.meta.armor[b.meta.armor.length - 1].half[0] = S.engine === 'vtwin' ? 0.12 : 0.34;
  b.armor('frame', 'body', 3, [0, 0.55, 0.1], [0, 0, 0.9], [0, 0.4, 0], [1, 0, 0]);
  b.meta.armor[b.meta.armor.length - 1].half[0] = 0.05;
  b.module('engine', 'body', [0, 0.4, -0.08], [S.engine === 'vtwin' ? 0.11 : 0.3, 0.14, 0.18]);
  b.module('fuel', 'body', [0, tankTop - 0.1, -0.2], [0.13, 0.08, 0.24]);
  return { P, R, zF, zR, S };
}

// Harley-Davidson 45 cu in side-valve V-twin: crankcase, two finned cylinders 45
// degrees apart with flat finned heads, the big oil-bath air cleaner on the
// right, the primary chain case on the left and the gearbox behind.
function vTwin(b, P, exh) {
  const cc = [0, 0.37, -0.03];
  b.convex({
    points: [
      ...circle(0.12, 14, 0, 0).map(([u, v]) => [-0.09, cc[1] + v, cc[2] + u]),
      ...circle(0.12, 14, 0, 0).map(([u, v]) => [0.09, cc[1] + v, cc[2] + u]),
    ],
    mat: 'alu',
    crease: 0.6,
  });
  b.cylAxis({ axis: 'x', x: 0.11, y: cc[1] + 0.02, z: cc[2] + 0.03, len: 0.05, r: 0.085, mat: 'alu', seg: 18 }); // timing cover
  // Front cylinder leaning forward, rear cylinder leaning back, 45 degrees apart.
  for (const [sgn, zc] of [
    [-1, -0.075],
    [1, 0.02],
  ]) {
    const a = 22.5 * DEG;
    const dir = [0, Math.cos(a), sgn * Math.sin(a)];
    const base = [0, cc[1] + 0.08, cc[2] + zc];
    // Finned barrel.
    const prof = [[0.04, 0]];
    for (let k = 0; k < 10; k++) prof.push([0.05, 0.016 + k * 0.019], [0.075, 0.02 + k * 0.019], [0.075, 0.026 + k * 0.019], [0.05, 0.03 + k * 0.019]);
    prof.push([0.05, 0.21], [0.04, 0.21], [0, 0.21], [0, 0]);
    b.latheDir({ profile: prof, at: base, dir, mat: 'black', seg: 16, crease: 0.4 });
    // Flat aluminum head with fins.
    const top = [0, base[1] + dir[1] * 0.22, base[2] + dir[2] * 0.22];
    const hp = [[0, 0]];
    for (let k = 0; k < 4; k++) hp.push([0.06, k * 0.016], [0.088, k * 0.016 + 0.003], [0.088, k * 0.016 + 0.009], [0.06, k * 0.016 + 0.012]);
    hp.push([0.06, 0.07], [0, 0.07]);
    b.latheDir({ profile: hp, at: top, dir, mat: 'alu', seg: 16, crease: 0.4 });
    b.sphere({ x: 0.03, y: top[1] + 0.06, z: top[2], r: 0.012, mat: 'brass', seg: 8 }); // spark plug
    exh.push([0.06, base[1] + dir[1] * 0.14, base[2] + dir[2] * 0.14 + sgn * 0.045]);
  }
  // Carburetor and the oil-bath air cleaner on the right.
  b.box({ x: 0.09, y: 0.55, z: -0.03, w: 0.06, h: 0.07, d: 0.06, r: 0.01, mat: 'alu' });
  cylDir(b, { at: [0.2, 0.55, -0.01], dir: [1, 0, 0], len: 0.15, r: 0.1, mat: P, seg: 20 });
  cylDir(b, { at: [0.28, 0.55, -0.01], dir: [1, 0, 0], len: 0.02, r: 0.07, mat: 'black', seg: 16 });
  // Primary chain case (left), gearbox, kick starter (right).
  b.convex({
    points: [
      ...circle(0.09, 12, 0, 0).map(([u, v]) => [-0.1, 0.37 + v, -0.03 + u]),
      ...circle(0.09, 12, 0, 0).map(([u, v]) => [-0.16, 0.37 + v, -0.03 + u]),
      ...circle(0.11, 12, 0, 0).map(([u, v]) => [-0.1, 0.36 + v, 0.27 + u]),
      ...circle(0.11, 12, 0, 0).map(([u, v]) => [-0.16, 0.36 + v, 0.27 + u]),
    ],
    mat: P,
    crease: 0.7,
  });
  b.box({ x: 0, y: 0.4, z: 0.25, w: 0.18, h: 0.17, d: 0.2, r: 0.02, mat: P });
  b.rod({ from: [0.13, 0.4, 0.27], to: [0.15, 0.33, 0.45], r: 0.012, mat: 'steel' });
  b.box({ x: 0.155, y: 0.32, z: 0.47, w: 0.03, h: 0.02, d: 0.08, r: 0.005, mat: 'rubber' });
  // Oil tank under the saddle (right), battery box (left).
  b.cylAxis({ axis: 'z', x: 0.12, y: 0.55, z: 0.25, len: 0.24, r: 0.07, mat: P, seg: 14 });
  b.box({ x: -0.12, y: 0.55, z: 0.25, w: 0.09, h: 0.14, d: 0.18, r: 0.01, mat: P });
}

// Flat twins: the BMW R 75 (overhead valves: rocker covers) and the M-72 (side
// valves: flat heads). Cylinders across the frame, shaft drive on the right.
function boxer(b, S, P, exh) {
  const ohv = S.engine === 'boxerOHV';
  const y = 0.41,
    z = -0.22;
  // Crankcase, gearbox behind it, the shaft to the rear wheel.
  b.convex({
    points: [
      ...roundRect(0, 0, 0.13, 0.14, 0.05).map(([u, v]) => [u, y + v - 0.02, z + 0.15]),
      ...roundRect(0, 0, 0.12, 0.13, 0.05).map(([u, v]) => [u, y + v - 0.02, z - 0.12]),
    ],
    mat: 'alu',
    crease: 0.6,
  });
  b.box({ x: 0, y: y + 0.02, z: z + 0.36, w: 0.2, h: 0.2, d: 0.2, r: 0.03, mat: 'alu' });
  b.rod({ from: [0.08, y - 0.05, z + 0.44], to: [0.085, 0.31, 0.7], r: 0.03, mat: P });
  b.sphere({ x: 0.085, y: 0.31, z: 0.72, r: 0.07, mat: 'alu', seg: 14 }); // rear drive
  for (const s of [-1, 1]) {
    // Finned cylinder.
    const prof = [[0.045, 0]];
    for (let k = 0; k < 9; k++) prof.push([0.055, 0.012 + k * 0.016], [0.08, 0.015 + k * 0.016], [0.08, 0.021 + k * 0.016], [0.055, 0.024 + k * 0.016]);
    prof.push([0.055, 0.17], [0, 0.17], [0, 0]);
    b.latheDir({ profile: prof, at: [s * 0.12, y, z], dir: [s, 0, 0], mat: 'black', seg: 16, crease: 0.4 });
    const hx = s * 0.29;
    if (ohv) {
      // Aluminum head with deep fins and the rounded rocker cover.
      const hp = [[0, 0]];
      for (let k = 0; k < 3; k++) hp.push([0.075, k * 0.016], [0.1, k * 0.016 + 0.003], [0.1, k * 0.016 + 0.01], [0.075, k * 0.016 + 0.013]);
      hp.push([0.07, 0.055], [0, 0.055]);
      b.latheDir({ profile: hp, at: [hx, y, z], dir: [s, 0, 0], mat: 'alu', seg: 18, crease: 0.4 });
      b.latheDir({ profile: [[0, 0], [0.075, 0], [0.072, 0.02], [0.055, 0.04], [0, 0.045]], at: [hx + s * 0.055, y + 0.01, z], dir: [s, 0, 0], mat: 'alu', seg: 18 });
    } else {
      // Flat side-valve head: shallow, finned, the valve chest below the barrel.
      const hp = [[0, 0]];
      for (let k = 0; k < 4; k++) hp.push([0.07, k * 0.012], [0.095, k * 0.012 + 0.002], [0.095, k * 0.012 + 0.007], [0.07, k * 0.012 + 0.01]);
      hp.push([0.07, 0.05], [0, 0.05]);
      b.latheDir({ profile: hp, at: [hx, y, z], dir: [s, 0, 0], mat: 'alu', seg: 18, crease: 0.4 });
      b.box({ x: s * 0.2, y: y - 0.07, z: z - 0.02, w: 0.15, h: 0.06, d: 0.09, r: 0.015, mat: 'alu' });
    }
    b.sphere({ x: hx + s * (ohv ? 0.1 : 0.05), y: y + 0.05, z: z + 0.04, r: 0.012, mat: 'brass', seg: 8 });
    // Carburetor behind each cylinder.
    b.box({ x: s * 0.2, y: y + 0.02, z: z + 0.13, w: 0.05, h: 0.07, d: 0.06, r: 0.01, mat: 'alu' });
    exh.push([hx - s * 0.03, ohv ? y - 0.02 : y - 0.08, z - 0.08, s]);
  }
}

// Fuel tanks: the WLA's split "fat bob" tanks with the speedometer between them;
// the R 75's tank with its air filter on top; the M-72's with the tool box.
function tank(b, S, P, htTop, seatPost, top) {
  const z0 = htTop[2] + 0.05,
    z1 = seatPost[2] - 0.08;
  const len = z1 - z0;
  const zc = (z0 + z1) / 2;
  if (S.tank === 'split') {
    for (const s of [-1, 1]) {
      const pts = [];
      for (const [t, w, hgt] of [
        [0, 0.07, 0.12],
        [0.2, 0.13, 0.17],
        [0.6, 0.14, 0.18],
        [1, 0.09, 0.12],
      ]) {
        const zz = z0 + t * len;
        for (const [u, v] of roundRect(0, 0, w / 2, hgt / 2, 0.035)) pts.push([s * (0.075 + u * 0.9), top - 0.1 + v, zz]);
      }
      b.convex({ points: pts, mat: P, crease: 0.7 });
      b.cylAxis({ axis: 'y', x: s * 0.08, y: top + 0.0, z: z0 + len * 0.25, len: 0.02, r: 0.03, mat: 'steel', seg: 12 });
    }
    b.box({ x: 0, y: top - 0.01, z: zc, w: 0.07, h: 0.04, d: len * 0.7, r: 0.015, mat: P }); // instrument panel
    b.cylAxis({ axis: 'y', x: 0, y: top + 0.015, z: zc - 0.04, len: 0.02, r: 0.035, mat: 'chrome', seg: 14 }); // speedometer
    // Hand shift lever and its gate on the left of the tank.
    b.box({ x: -0.16, y: top - 0.08, z: zc + 0.04, w: 0.012, h: 0.03, d: 0.16, r: 0.004, mat: 'chrome' });
    b.rod({ from: [-0.165, top - 0.12, zc + 0.06], to: [-0.18, top + 0.06, zc + 0.02], r: 0.008, mat: 'chrome' });
    b.sphere({ x: -0.18, y: top + 0.07, z: zc + 0.02, r: 0.018, mat: 'black', seg: 10 });
  } else {
    const pts = [];
    for (const [t, w, hgt] of [
      [0, 0.16, 0.13],
      [0.25, 0.28, 0.2],
      [0.65, 0.3, 0.21],
      [1, 0.2, 0.15],
    ]) {
      const zz = z0 + t * len;
      for (const [u, v] of roundRect(0, 0, w / 2, hgt / 2, 0.05)) pts.push([u, top - 0.11 + v, zz]);
    }
    b.convex({ points: pts, mat: P, crease: 0.7 });
    for (const s of [-1, 1]) b.box({ x: s * 0.15, y: top - 0.13, z: zc + 0.08, w: 0.012, h: 0.1, d: 0.14, r: 0.02, mat: 'rubber' }); // knee pads
    if (S.tank === 'r75') {
      // The R 75's air filter housing on top of the tank, and the filler cap.
      b.cylAxis({ axis: 'y', x: 0, y: top + 0.03, z: zc - 0.02, len: 0.07, r: 0.085, mat: P, seg: 20 });
      b.cylAxis({ axis: 'y', x: 0, y: top + 0.07, z: zc - 0.02, len: 0.012, r: 0.09, mat: P, seg: 20 });
      b.cylAxis({ axis: 'y', x: -0.07, y: top - 0.01, z: zc + 0.15, len: 0.02, r: 0.025, mat: 'steel', seg: 12 });
    } else {
      b.cylAxis({ axis: 'y', x: 0, y: top - 0.0, z: zc - 0.05, len: 0.02, r: 0.03, mat: 'steel', seg: 12 });
      b.box({ x: 0, y: top + 0.005, z: zc + 0.12, w: 0.1, h: 0.025, d: 0.12, r: 0.01, mat: P }); // tool box lid
    }
  }
}

function exhaust(b, S, exh, R, zR) {
  const blk = 'black';
  if (S.engine === 'vtwin') {
    // Both cylinders into one pipe down the right, the muffler along the rear.
    const [f, r] = exh;
    tube(b, [f, [0.12, f[1] - 0.12, f[2] - 0.06], [0.16, 0.25, -0.15], [0.17, 0.24, 0.2], [0.19, 0.27, 0.32]], 0.022, blk);
    tube(b, [r, [0.12, r[1] - 0.1, r[2] + 0.04], [0.16, 0.27, 0.15]], 0.02, blk);
    b.cyl({ z0: 0.3, z1: 0.82, r0: 0.045, x: 0.2, y: 0.28, mat: blk, seg: 14 });
    b.cyl({ z0: 0.82, z1: 0.88, r0: 0.045, r1: 0.02, x: 0.2, y: 0.28, mat: blk, seg: 14 });
    b.anchor('exhaustR', 0.2, 0.28, 0.9);
    return;
  }
  const sides = S.exhaust === 0 ? [-1, 1] : [S.exhaust];
  for (const e of exh) {
    const s = e[3];
    const out = S.exhaust === 0 ? s : S.exhaust;
    tube(b, [[e[0], e[1], e[2]], [e[0] + s * 0.04, e[1] - 0.1, e[2] - 0.06], [s * 0.18, 0.22, -0.2], [out * 0.18, 0.22, 0.1], [out * 0.19, 0.27, 0.32]], 0.02, blk);
  }
  for (const s of sides) {
    b.cyl({ z0: 0.3, z1: 0.8, r0: 0.05, x: s * 0.2, y: 0.28, mat: blk, seg: 14 });
    b.cyl({ z0: 0.8, z1: 0.9, r0: 0.05, r1: 0.025, x: s * 0.2, y: 0.28, mat: blk, seg: 14 });
    b.anchor(s < 0 ? 'exhaustL' : 'exhaustR', s * 0.2, 0.28, 0.92);
  }
}

// Sidecar: chassis tubes to the motorcycle, the sidecar wheel with its mudguard
// (part wheelS), the boat-shaped body with its cockpit and seat, a spare wheel or
// luggage on the tail, and the machine gun on its pedestal (part mg).
function sidecar(b, id, m) {
  const D = BIKES[id];
  const sc = D.sidecar;
  const P = m.P;
  const R = sc.wheelRadius;
  const xs = sc.track,
    zs = sc.z;
  const bx = sc.bodyX;
  // Wheel.
  const items = spokedWheel({ R, tire: m.S.tire, rimR: m.S.rimR, spokes: m.S.spokes, flangeR: 0.045, hubW: 0.13, hubR: 0.04, drumR: D.brakes.side ? m.S.drum : 0, drumW: 0.045, tread: true, rimMat: id.startsWith('wla') ? 'black' : P, spokeMat: 'steel', hubMat: id.startsWith('wla') ? 'black' : 'alu', spokeR: 0.0022, rimW: 0.07 });
  b.part('wheelS', [xs, R, zs]).addAll(items, { x: xs, y: R, z: zs });
  b.body();
  fender(b, { cz: zs, cy: R, r: R + 0.035, a0: -0.2, a1: 2.6, w: m.S.tire + 0.07, x: xs, mat: P, skirt: 0.03 });
  // Chassis: a frame from the motorcycle to the sidecar axle.
  const tubeM = 'black';
  b.rod({ from: [0.1, 0.22, -0.3], to: [xs, R + 0.06, -0.3], r: 0.018, mat: tubeM });
  b.rod({ from: [0.1, 0.24, 0.55], to: [xs, R + 0.06, 0.55], r: 0.018, mat: tubeM });
  b.rod({ from: [xs, R + 0.06, -0.3], to: [xs, R + 0.06, 0.6], r: 0.018, mat: tubeM });
  b.rod({ from: [0.1, 0.66, -0.05], to: [bx - 0.18, 0.55, -0.2], r: 0.015, mat: tubeM }); // upper strut
  b.rod({ from: [0.1, 0.6, 0.45], to: [bx - 0.2, 0.5, 0.45], r: 0.015, mat: tubeM });
  // Body: lofted rounded sections from the nose to the tail.
  const len = sc.tail - sc.nose;
  const secs = [
    [0, 0.06, 0.1, 0.38],
    [0.08, 0.2, 0.2, 0.36],
    [0.25, 0.29, 0.27, 0.32],
    [0.55, 0.31, 0.3, 0.3],
    [0.85, 0.3, 0.28, 0.31],
    [1, 0.22, 0.22, 0.34],
  ];
  const pts = [];
  for (const [t, hw, hh, yc] of secs) {
    const zz = sc.nose + t * len;
    for (const [u, v] of roundRect(0, 0, hw, hh, Math.min(hw, hh) * 0.6, 3)) pts.push([bx + u, yc + v + 0.2, zz]);
  }
  b.convex({ points: pts, mat: P, crease: 0.75 });
  // Cockpit: the opening (dark), its padded rim and the seat back.
  const cz0 = sc.nose + len * 0.42,
    cz1 = sc.nose + len * 0.86;
  const topY = 0.2 + 0.3 + 0.3; // section yc + hh at the widest
  b.box({ x: bx, y: topY - 0.005, z: (cz0 + cz1) / 2, w: 0.42, h: 0.012, d: cz1 - cz0, r: 0.005, mat: 'dark' });
  tube(b, [...roundRect(0, 0, 0.22, (cz1 - cz0) / 2, 0.12, 4).map(([u, v]) => [bx + u, topY + 0.006, (cz0 + cz1) / 2 + v])], 0.014, 'leatherBlack', { closed: true, seg: 6 });
  b.box({ x: bx, y: topY + 0.05, z: cz1 - 0.04, w: 0.36, h: 0.14, d: 0.06, r: 0.03, mat: 'leatherBlack', rx: -0.25 }); // seat back
  const seat = D.seats.find((x) => x.style === 'sidecar');
  b.anchor('sideHip', ...seat.hip);
  b.anchor('sideFootL', ...seat.feet[0]);
  b.anchor('sideFootR', ...seat.feet[1]);
  // Grab rail and a step.
  tube(b, [[bx - 0.25, topY - 0.02, cz1 - 0.1], [bx - 0.27, topY + 0.06, cz1 - 0.2], [bx - 0.27, topY + 0.06, cz1 - 0.35], [bx - 0.25, topY - 0.02, cz1 - 0.45]], 0.008, 'chrome', { tension: 0.3 });
  b.box({ x: bx - 0.3, y: 0.3, z: cz0, w: 0.12, h: 0.015, d: 0.2, r: 0.004, mat: 'rubber' });
  // Tail: a spare wheel (R 75) or a luggage box.
  if (id.startsWith('r75')) {
    const spare = spokedWheel({ R: 0.3, tire: m.S.tire, rimR: m.S.rimR, spokes: 20, flangeR: 0.045, hubW: 0.1, hubR: 0.04, tread: true, rimMat: P, spokeMat: 'steel', hubMat: 'alu', spokeR: 0.003, rimW: 0.07, seg: 24 });
    b.addAll(spare, { x: bx, y: 0.6, z: sc.tail + 0.05, ry: Math.PI / 2 });
  } else {
    b.box({ x: bx, y: 0.62, z: sc.tail - 0.1, w: 0.4, h: 0.16, d: 0.22, r: 0.02, mat: P });
  }
  lamp(b, { at: [xs + 0.08, 0.75, sc.nose + 0.25], r: 0.035, depth: 0.04, mat: P }); // marker lamp
  // Gun pedestal and the gun.
  const g = D.sidecarMg;
  const piv = g.pivot;
  b.rod({ from: [piv[0], topY - 0.04, piv[2] + 0.02], to: [piv[0], piv[1] - 0.04, piv[2]], r: 0.022, mat: 'black' });
  b.box({ x: piv[0], y: piv[1] - 0.03, z: piv[2], w: 0.08, h: 0.04, d: 0.1, r: 0.01, mat: 'black' });
  b.part('mg', piv);
  GUNS[ARMY_GUN[id]](b, piv);
  b.meta.anchorParts.mgGripL = 'mg';
  b.meta.anchorParts.mgGripR = 'mg';
  b.meta.anchorParts.mgMuzzle = 'mg';
  b.body();
  // Distant version.
  b.part('far', [0, 0, 0]);
  farWheel(b, { x: xs, y: R, z: zs, R, w: m.S.tire });
  b.box({ x: bx, y: 0.52, z: (sc.nose + sc.tail) / 2, w: 0.58, h: 0.5, d: len * 0.9, r: 0.12, mat: P });
  b.rod({ from: [0.05, 0.25, 0], to: [xs, R, 0], r: 0.03, mat: 'black', seg: 5 });
  b.body();
  // Damage model: sheet steel body, the tire.
  b.armor('sidecarBody', 'body', 1, [bx, 0.5, (sc.nose + sc.tail) / 2], [0, 0, len * 0.9], [0, 0.5, 0], [1, 0, 0]);
  b.meta.armor[b.meta.armor.length - 1].half[0] = 0.3;
  b.armor('tireS', 'body', 4, [xs, R, zs], [0, 0, 2 * R], [0, 2 * R, 0], [1, 0, 0]);
  const a = b.meta.armor[b.meta.armor.length - 1];
  a.kind = 'tire';
  a.half[0] = m.S.tire / 2;
}

function meta(b, id) {
  const D = BIKES[id];
  Object.assign(b.meta, {
    name: D.name,
    faction: D.faction ? { US: 'us', GE: 'de', SU: 'su' }[D.faction] : 'neutral',
    type: D.sidecar ? 'sidecar' : 'bike',
    crew: D.seats.length,
    seats: D.seats.map((s) => s.name),
    wheelRadius: D.wheelRadius,
    wheelbase: D.wheelbase,
    trackWidth: D.sidecar ? D.sidecar.track : 0,
    specs: { mass: D.mass, power: D.engine.human ? 'rider' : D.engine.name },
  });
}

function machine(id) {
  return (b) => {
    const m = motorcycle(b, id);
    if (BIKES[id].sidecar) sidecar(b, id, m);
    meta(b, id);
  };
}

export const wla = machine('wla');
export const wla_sidecar = machine('wla_sidecar');
export const r75 = machine('r75');
export const r75_sidecar = machine('r75_sidecar');
export const m72 = machine('m72');
export const m72_sidecar = machine('m72_sidecar');
