// Body shapes for the procedural soldier, built in the bind pose at real scale:
// the clothed torso, sleeves, trouser legs, boots, head, neck and hands. The
// outfits (soldierKit.js) choose colors and add the equipment on top.
import * as THREE from 'three';
import { B, BIND, HEAD_CENTER } from './soldierRig.js';
import { torsoWeights, legWeights, armWeights, rigid, smooth01 } from './soldierGeo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const se = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);

// Catmull-Rom through profile rows [[key, ...values]] sorted by key.
export function interpRows(rows, y) {
  let i = 0;
  while (i < rows.length - 2 && rows[i + 1][0] < y) i++;
  const r1 = rows[i],
    r2 = rows[i + 1];
  const r0 = rows[Math.max(0, i - 1)],
    r3 = rows[Math.min(rows.length - 1, i + 2)];
  const t = Math.min(1, Math.max(0, (y - r1[0]) / (r2[0] - r1[0])));
  const t2 = t * t,
    t3 = t2 * t;
  const out = [y];
  for (let k = 1; k < r1.length; k++) {
    const a = r0[k],
      b = r1[k],
      c = r2[k],
      d = r3[k];
    out.push(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Torso (tunic over the trousers' seat). Rows: [y, halfWidth, zFront, zBack].
export const TORSO_ROWS = [
  [0.785, 0.008, -0.025, 0.035],
  [0.8, 0.065, -0.058, 0.064],
  [0.83, 0.12, -0.088, 0.095],
  [0.87, 0.158, -0.103, 0.116],
  [0.92, 0.17, -0.108, 0.124],
  [0.98, 0.166, -0.106, 0.114],
  [1.04, 0.157, -0.104, 0.1],
  [1.1, 0.155, -0.106, 0.098],
  [1.17, 0.161, -0.114, 0.1],
  [1.24, 0.168, -0.122, 0.105],
  [1.31, 0.172, -0.125, 0.108],
  [1.37, 0.173, -0.118, 0.11],
  [1.415, 0.169, -0.104, 0.104],
  [1.445, 0.153, -0.084, 0.092],
  [1.47, 0.116, -0.066, 0.078],
  [1.49, 0.068, -0.048, 0.064],
];
const TORSO_EXP = 2 / 2.3;

// Point on the torso surface: theta 0 = right side (+X), -PI/2 = front, +PI/2 = back.
export function torsoPoint(theta, y, out = new THREE.Vector3(), grow = 0, rows = TORSO_ROWS) {
  const [, a, zf, zb] = interpRows(rows, y);
  const c = Math.cos(theta),
    s = Math.sin(theta);
  const cz = (zf + zb) / 2,
    d = (zb - zf) / 2;
  out.set(se(c, TORSO_EXP) * (a + grow), y, cz + se(s, TORSO_EXP) * (d + grow));
  return out;
}
const _p0 = new THREE.Vector3(),
  _p1 = new THREE.Vector3(),
  _p2 = new THREE.Vector3(),
  _p3 = new THREE.Vector3();
export function torsoNormal(theta, y, out = new THREE.Vector3()) {
  torsoPoint(theta + 0.01, y, _p0);
  torsoPoint(theta - 0.01, y, _p1);
  torsoPoint(theta, y + 0.01, _p2);
  torsoPoint(theta, y - 0.01, _p3);
  _p0.sub(_p1);
  _p2.sub(_p3);
  out.crossVectors(_p2, _p0).normalize();
  // outward
  torsoPoint(theta, y, _p1);
  if (out.x * _p1.x + out.z * (_p1.z - 0.0) < 0) out.negate();
  return out;
}
// Angle on the torso at height y where the surface reaches x (front: side < 0).
export function torsoTheta(x, y, side) {
  const [, a] = interpRows(TORSO_ROWS, y);
  const r = Math.min(0.999, Math.abs(x) / a);
  let c = Math.pow(r, 2.3 / 2);
  c = Math.min(1, c) * Math.sign(x || 1);
  const t = Math.acos(c);
  return side < 0 ? -t : t;
}

// Build the torso loft. colorAt(x, y, z, color) may repaint vertices.
export function buildTorso(b, { hem = 0.86, flare = 0.012, lod = 0, extraRows = [] } = {}) {
  const nu = lod ? 9 : 18;
  const ys = [];
  for (let y = 0.785; y < 1.49; y += lod ? 0.085 : 0.036) ys.push(y);
  ys.push(1.49, hem - 0.004, hem + 0.001, hem + 0.025, ...extraRows);
  ys.sort((p, q) => p - q);
  const rows = ys.filter((y, i) => i === 0 || y - ys[i - 1] > 0.002);
  const grow = (y) => {
    // The tunic skirt flares a little over the trousers; the step is the hem.
    if (y < hem - 0.002) return -0.004;
    return flare * (1 - smooth01(hem + 0.02, hem + 0.16, y));
  };
  b.bones(torsoWeights);
  b.param(
    nu,
    rows.length - 1,
    (u, v, out) => {
      const y = rows[Math.round(v * (rows.length - 1))];
      torsoPoint(u * Math.PI * 2 - Math.PI / 2, y, out, grow(y));
    },
    { center: V(0, 1.1, 0.0), flip: false },
  );
}

// ---------------------------------------------------------------------------
// Limbs: rings along a joint chain. profile rows: [s, rx, rz, dz] where s is the
// distance along the chain from the first joint (negative = above it).
function chainPoint(points, s, out) {
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const len = a.distanceTo(b);
    if (s <= acc + len || i === points.length - 2) {
      const t = (s - acc) / len;
      return out.copy(a).lerp(b, t);
    }
    acc += len;
  }
  return out.copy(points[points.length - 1]);
}

export function limbTube(b, points, profile, { seg = 10, capStart = 0.6, capEnd = 0.6, side = [1, 0, 0] } = {}) {
  const rings = profile.map(([s, rx, rz, dz = 0, dx = 0]) => {
    const c = chainPoint(points, s, new THREE.Vector3());
    c.z += dz;
    c.x += dx;
    return { c, rx, rz };
  });
  b.tube(rings, { seg, capStart, capEnd, side });
}

export const armChain = (side) => {
  const s = side < 0;
  return [BIND[s ? B.upperArmL : B.upperArmR], BIND[s ? B.forearmL : B.forearmR], BIND[s ? B.handL : B.handR]];
};
export const legChain = (side) => {
  const s = side < 0;
  return [BIND[s ? B.thighL : B.thighR], BIND[s ? B.shinL : B.shinR], BIND[s ? B.footL : B.footR]];
};

// Sleeve from the shoulder to the wrist cuff.
export function buildSleeve(b, side, { lod = 0, bulk = 0, cuff = 0.004 } = {}) {
  const k = bulk;
  const prof = [
    [-0.03, 0.044 + k, 0.048 + k],
    [0.01, 0.051 + k, 0.055 + k],
    [0.1, 0.05 + k, 0.053 + k],
    [0.21, 0.048 + k, 0.05 + k],
    [0.29, 0.045 + k, 0.047 + k],
    [0.33, 0.046 + k, 0.046 + k],
    [0.43, 0.044 + k, 0.042 + k],
    [0.53, 0.04 + k + cuff, 0.038 + k + cuff],
    [0.565, 0.04 + k + cuff, 0.038 + k + cuff],
  ];
  b.bones(armWeights(side));
  limbTube(b, armChain(side), lod ? prof.filter((_, i) => i % 2 === 0 || i === prof.length - 1) : prof, {
    seg: lod ? 5 : 10,
    capStart: 0.9,
    capEnd: 0.3,
  });
}

// Trouser leg from inside the pelvis down to `end` (distance along the leg).
export function buildTrouserLeg(b, side, { lod = 0, bulk = 0.006, end = 0.84, thighBulk = 0 } = {}) {
  const k = bulk,
    t = thighBulk;
  const prof = [
    [-0.08, 0.07, 0.074],
    [-0.02, 0.087 + k + t, 0.091 + k + t],
    [0.08, 0.087 + k + t, 0.092 + k + t, 0.002],
    [0.2, 0.078 + k + t * 0.7, 0.082 + k + t * 0.7, 0.003],
    [0.32, 0.067 + k, 0.07 + k],
    [0.425, 0.059 + k, 0.063 + k, -0.004],
    [0.5, 0.058 + k, 0.065 + k, 0.009],
    [0.6, 0.055 + k, 0.062 + k, 0.011],
    [0.72, 0.046 + k, 0.05 + k, 0.006],
    [0.84, 0.043 + k, 0.047 + k, 0.004],
  ].filter((r) => r[0] <= end + 1e-6);
  if (prof[prof.length - 1][0] < end - 0.005) {
    const last = prof[prof.length - 1];
    prof.push([end, last[1], last[2], last[3] || 0]);
  }
  b.bones(legWeights(side));
  limbTube(b, legChain(side), lod ? prof.filter((_, i) => i % 2 === 0 || i === prof.length - 1) : prof, {
    seg: lod ? 5 : 10,
    capStart: 0.8,
    capEnd: 0.5,
  });
}

// A boot shaft / legging / puttee wrap: a tube around the lower leg from s0 to s1.
export function buildLegWrap(b, side, s0, s1, r0, r1, { lod = 0, flareTop = 0.004 } = {}) {
  const prof = [];
  const n = lod ? 1 : 4;
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const t = i / n;
    // Calf bulge follows the trouser profile shape loosely.
    const calf = Math.max(0, 1 - Math.abs(s - 0.56) / 0.18) * 0.008;
    const rx = r0[0] + (r1[0] - r0[0]) * t + calf * 0.6 + (i === 0 ? flareTop : 0);
    const rz = r0[1] + (r1[1] - r0[1]) * t + calf + (i === 0 ? flareTop : 0);
    prof.push([s, rx, rz, 0.004 + calf * 0.8]);
  }
  b.bones(legWeights(side));
  limbTube(b, legChain(side), prof, { seg: lod ? 5 : 10, capStart: 0, capEnd: 0 });
}

// Foot weights: the foot bone, blending into the shin above the ankle.
export function footWeights(side) {
  const s = side < 0;
  const ft = s ? B.footL : B.footR,
    sh = s ? B.shinL : B.shinR;
  return (x, y, z, o) => {
    const t = smooth01(0.1, 0.17, y);
    o[0] = ft;
    o[1] = sh;
    o[2] = o[3] = 0;
    o[4] = 1 - t;
    o[5] = t;
    o[6] = o[7] = 0;
  };
}

// Laced ankle boot / shoe: upper, toe cap, sole and heel. high = shaft top (m).
export function buildBoot(b, side, { lod = 0, upper = 0x3a2a1e, sole = 0x1a1612, high = 0.15, width = 1 } = {}) {
  const ax = BIND[side < 0 ? B.footL : B.footR].x;
  b.bones(footWeights(side));
  b.paint(upper);
  const w = width;
  const rings = [
    [0.078, 0.03, 0.045, 0.06],
    [0.06, 0.04 * w, 0.058, 0.068],
    [0.02, 0.044 * w, 0.064, 0.074],
    [-0.03, 0.046 * w, 0.054, 0.06],
    [-0.08, 0.049 * w, 0.044, 0.048],
    [-0.13, 0.048 * w, 0.035, 0.039],
    [-0.17, 0.042 * w, 0.028, 0.033],
    [-0.195, 0.034 * w, 0.022, 0.03],
  ].map(([z, rx, rz, yc]) => ({ c: V(ax + side * 0.004 * (z < -0.05 ? 1 : 0), yc, z), rx, rz }));
  b.tube(lod ? rings.filter((_, i) => i % 2 === 0 || i === rings.length - 1) : rings, { seg: lod ? 5 : 10, capStart: 0.5, capEnd: 0.9, side: [1, 0, 0] });
  // Ankle collar / shaft.
  b.tube(
    [
      { c: V(ax, 0.06, 0.02), rx: 0.044, rz: 0.05 },
      { c: V(ax, high * 0.6 + 0.04, 0.02), rx: 0.045, rz: 0.05 },
      { c: V(ax, high, 0.018), rx: 0.047, rz: 0.052 },
    ],
    { seg: lod ? 5 : 10, capStart: 0, capEnd: 0 },
  );
  // Sole and heel.
  b.paint(sole);
  b.box([ax + side * 0.002, 0.009, -0.06], [0.1 * w, 0.018, 0.27], { r: 0.008 });
  b.box([ax, 0.02, 0.05], [0.078 * w, 0.03, 0.07], { r: 0.006 });
}

// ---------------------------------------------------------------------------
// Head and face. Rows relative to HEAD_CENTER: [y, halfWidth, zFront, zBack].
const HEAD_ROWS = [
  [-0.119, 0.002, -0.052, -0.02],
  [-0.115, 0.018, -0.063, -0.004],
  [-0.108, 0.029, -0.07, 0.008],
  [-0.098, 0.041, -0.078, 0.025],
  [-0.083, 0.052, -0.084, 0.05],
  [-0.065, 0.062, -0.089, 0.072],
  [-0.045, 0.07, -0.092, 0.088],
  [-0.025, 0.074, -0.093, 0.097],
  [-0.005, 0.0755, -0.091, 0.102],
  [0.012, 0.077, -0.097, 0.105],
  [0.03, 0.077, -0.095, 0.106],
  [0.055, 0.074, -0.09, 0.104],
  [0.08, 0.066, -0.08, 0.096],
  [0.1, 0.052, -0.06, 0.08],
  [0.113, 0.03, -0.035, 0.055],
  [0.119, 0.002, -0.004, 0.018],
];

export function headSurface(u, y, out, shape) {
  const [, a0, zf0, zb] = interpRows(HEAD_ROWS, y);
  const t = u * Math.PI * 2; // 0 = front
  const s = Math.sin(t),
    c = Math.cos(t);
  const a = a0 * (y < -0.05 ? shape.jaw : 1) * shape.width;
  const zf = zf0 * (y < -0.06 ? shape.chin : 1);
  const front = c > 0;
  const e = front ? 2 / 2.3 : 2 / 2.05;
  const cz = (zf + zb) / 2;
  const depth = front ? cz - zf : zb - cz;
  out.set(se(s, e) * a, y, cz - se(c, e) * depth);
  // Eye sockets and brow: push in under the brow, beside the nose.
  if (front) {
    const ex = Math.abs(out.x) - 0.033,
      ey = y + 0.002;
    out.z += 0.0065 * Math.exp(-(ex * ex) / (0.017 * 0.017) - (ey * ey) / (0.013 * 0.013));
    // Cheekbones forward a touch.
    const cx = Math.abs(out.x) - 0.045,
      cy = y + 0.03;
    out.z -= 0.004 * Math.exp(-(cx * cx) / 0.0004 - (cy * cy) / 0.0004);
  }
  out.add(HEAD_CENTER);
  return out;
}

// skin colors (linear THREE.Color). shape: {jaw, chin, width, nose}.
export function buildHead(b, { skin, hair, lips, brows, stubble = 0, shape, lod = 0, eyeColor }) {
  b.bones(B.head);
  const nu = lod ? 8 : 20;
  const ys = [];
  const n = lod ? 7 : 17;
  for (let i = 0; i <= n; i++) ys.push(-0.119 + (0.238 * i) / n);
  const skinC = skin.clone();
  b.colorFn = (x, y, z, col) => {
    const ly = y - HEAD_CENTER.y,
      lz = z - HEAD_CENTER.z,
      ax = Math.abs(x);
    col.copy(skinC);
    // Hair: back and sides above the nape, under the helmet.
    const back = lz > -0.02 + (ly > 0.02 ? -0.03 : 0) ? 1 : 0;
    const hairMask = back * smooth01(-0.075, -0.045, ly) * (ax > 0.05 || lz > 0.03 ? 1 : 0);
    const sideburn = ax > 0.068 && lz > -0.03 && lz < 0.02 && ly > -0.035 ? 1 : 0;
    const h = Math.max(hairMask, sideburn);
    if (h > 0) col.lerp(hair, h * 0.92);
    // Lips.
    const lipD = ((ly + 0.068) / 0.0085) ** 2 + (x / 0.024) ** 2;
    if (lz < -0.06 && lipD < 1) col.lerp(lips, 0.75 * Math.min(1, 2 * (1 - lipD)));
    // Eyebrows.
    const bx = (ax - 0.034) / 0.02,
      by = (ly - 0.02) / 0.0055;
    if (lz < -0.06 && bx * bx + by * by < 1) col.lerp(brows, 0.85);
    // Stubble / jaw shadow.
    if (stubble > 0 && ly < -0.05 && lz < 0.02 && !(lipD < 1.2)) col.lerp(hair, stubble * smooth01(-0.05, -0.08, ly) * 0.35);
    // Soft redness on cheeks and nose.
    const ck = ((ax - 0.05) / 0.025) ** 2 + ((ly + 0.03) / 0.025) ** 2;
    if (lz < -0.04 && ck < 1) col.lerp(lips, 0.1 * (1 - ck));
    // Painted-in occlusion: eye sockets, mouth corners, under the jaw.
    if (lz < -0.05) {
      const es = ((ax - 0.033) / 0.024) ** 2 + ((ly + 0.002) / 0.016) ** 2;
      if (es < 1) col.multiplyScalar(1 - 0.28 * (1 - es));
      const ml = Math.abs(ly + 0.0685) / 0.0025;
      if (ml < 1 && ax < 0.022) col.multiplyScalar(1 - 0.35 * (1 - ml));
    }
    if (ly < -0.1) col.multiplyScalar(1 - 0.3 * smooth01(-0.1, -0.118, ly));
    if (lz > 0.0 && ly < -0.06) col.multiplyScalar(1 - 0.2 * smooth01(-0.06, -0.1, ly));
  };
  b.param(nu, ys.length - 1, (u, v, out) => headSurface(u, ys[Math.round(v * (ys.length - 1))], out, shape), { center: HEAD_CENTER.clone() });
  b.colorFn = null;
  b.paint(skinC);
  const hc = HEAD_CENTER;
  // Ears.
  for (const s of [-1, 1]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * -0.35, s * 0.08));
    b.ellipsoid([hc.x + s * 0.076, hc.y - 0.012, hc.z + 0.012], [0.011, 0.03, 0.02], { nu: lod ? 4 : 7, nv: lod ? 2 : 4, quat: q });
  }
  if (lod) return;
  // Nose: bridge, tip and nostril wings.
  const ns = shape.nose;
  const nose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0, 0));
  b.ellipsoid([hc.x, hc.y - 0.018, hc.z - 0.09], [0.0082 * ns, 0.021 * ns, 0.0095 * ns], { nu: 7, nv: 5, quat: nose });
  b.ellipsoid([hc.x, hc.y - 0.037, hc.z - 0.0965], [0.0092 * ns, 0.0078, 0.0088 * ns], { nu: 7, nv: 4 });
  b.colorFn = (x, y, z, col) => {
    if (y < hc.y - 0.042) col.multiplyScalar(0.7);
  };
  for (const s of [-1, 1]) b.ellipsoid([hc.x + s * 0.0098 * ns, hc.y - 0.0395, hc.z - 0.0915], [0.0062, 0.0055, 0.0068], { nu: 5, nv: 3 });
  b.colorFn = null;
  // Lips.
  b.paint(lips);
  b.colorFn = (x, y, z, col) => {
    if (Math.abs(y - (hc.y - 0.0685)) < 0.0018) col.multiplyScalar(0.45);
  };
  b.ellipsoid([hc.x, hc.y - 0.0645, hc.z - 0.0855], [0.019, 0.0045, 0.0058], { nu: 8, nv: 4 });
  b.ellipsoid([hc.x, hc.y - 0.0725, hc.z - 0.0835], [0.016, 0.005, 0.0062], { nu: 8, nv: 4 });
  b.colorFn = null;
  b.paint(skinC);
  // Brow ridge (casts the shadow over the eyes).
  for (const s of [-1, 1]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.3, s * 0.06));
    b.colorFn = (x, y, z, col) => {
      if (y > hc.y + 0.015 && z < hc.z - 0.088) col.lerp(brows, 0.75);
    };
    b.ellipsoid([hc.x + s * 0.034, hc.y + 0.016, hc.z - 0.089], [0.019, 0.0062, 0.009], { nu: 7, nv: 4, quat: q });
    b.colorFn = null;
  }
  // Eyes: a dark iris on an off-white ball, half hidden by the upper lid.
  for (const s of [-1, 1]) {
    const ec = V(hc.x + s * 0.0325, hc.y + 0.001, hc.z - 0.08);
    b.colorFn = (x, y, z, col) => {
      const d = (z - ec.z) / 0.0105; // -1 at the front
      if (d < -0.93) col.setRGB(0.02, 0.018, 0.016);
      else if (d < -0.62) col.copy(eyeColor);
      else col.setRGB(0.3, 0.27, 0.24);
    };
    b.ellipsoid([ec.x, ec.y, ec.z], [0.0108, 0.0098, 0.0105], { nu: 8, nv: 5 });
    b.colorFn = null;
    // Upper lid.
    b.paint(skinC);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, 0));
    b.ellipsoid([ec.x, ec.y + 0.0062, ec.z - 0.0002], [0.0124, 0.0062, 0.0111], { nu: 8, nv: 4, quat: q });
  }
}

// Neck: from inside the collar up into the head.
export function buildNeck(b, { lod = 0 } = {}) {
  b.bones((x, y, z, o) => {
    if (y < 1.5) {
      const t = smooth01(1.44, 1.5, y);
      o[0] = B.chest;
      o[1] = B.neck;
      o[4] = 1 - t;
      o[5] = t;
    } else {
      const t = smooth01(1.55, 1.6, y);
      o[0] = B.neck;
      o[1] = B.head;
      o[4] = 1 - t;
      o[5] = t;
    }
    o[2] = o[3] = 0;
    o[6] = o[7] = 0;
  });
  b.tube(
    [
      { c: V(0, 1.43, 0.025), rx: 0.058, rz: 0.06 },
      { c: V(0, 1.5, 0.02), rx: 0.055, rz: 0.057 },
      { c: V(0, 1.56, 0.012), rx: 0.054, rz: 0.056 },
      { c: V(0, 1.6, 0.012), rx: 0.05, rz: 0.06 },
    ],
    { seg: lod ? 5 : 10, capStart: 0, capEnd: 0.5, side: [1, 0, 0] },
  );
}

// ---------------------------------------------------------------------------
// Hands: built in the hand bone's bind frame (fingers -Y, thumb -Z, palm toward
// the body), curled into a loose grip around GRIP_CENTER.
export function buildHand(b, side, { lod = 0 } = {}) {
  const w = BIND[side < 0 ? B.handL : B.handR];
  const bone = side < 0 ? B.handL : B.handR;
  b.bones(rigid(bone));
  const P = (x, y, z) => [w.x + side * x, w.y + y, w.z + z];
  const rz = (a) => [0, 0, side * a];
  if (lod) {
    b.box(P(-0.006, -0.06, 0.002), [0.034, 0.1, 0.078], { r: 0.012 });
    return;
  }
  // Palm and back of the hand.
  b.box(P(-0.004, -0.05, 0.002), [0.031, 0.088, 0.08], { r: 0.012, rot: rz(0.05) });
  // Fingers curl toward the palm and wrap under and around the grip.
  b.box(P(-0.013, -0.103, 0.003), [0.027, 0.048, 0.077], { r: 0.012, rot: rz(-0.42) });
  b.box(P(-0.034, -0.123, 0.003), [0.036, 0.025, 0.07], { r: 0.011, rot: rz(0.22) });
  // Thumb.
  b.cylinder(P(-0.012, -0.03, -0.033), P(-0.036, -0.07, -0.044), 0.0115, 0.0095, { seg: 6 });
}
