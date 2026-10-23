// Uniforms and equipment of 1944 infantry, built from simple shapes on top of
// the body (soldierBody.js):
//   US: M1 helmet with net and chin strap, M1941 field jacket, OD wool trousers,
//       canvas leggings, russet service shoes, M1923 cartridge belt with
//       suspenders, canteen, first-aid pouch, entrenching tool.
//   GE: M40 Stahlhelm, M40 feldgrau tunic, jackboots, black leather belt with
//       Y-straps and two 3-cell ammo pouches, bread bag, canteen, gas-mask can,
//       entrenching tool with bayonet.
//   SU: SSh-40 helmet, khaki gymnastyorka with belt, sharovary in boots or
//       puttees, ammo pouches, rolled greatcoat (skatka) across the chest,
//       canteen, small shovel.
import * as THREE from 'three';
import { B, HEAD_CENTER } from './soldierRig.js';
import { SkinBuilder, torsoWeights, rigid } from './soldierGeo.js';
import {
  buildTorso,
  buildSleeve,
  buildTrouserLeg,
  buildLegWrap,
  buildBoot,
  buildHead,
  buildNeck,
  buildHand,
  torsoPoint,
  torsoNormal,
  torsoTheta,
} from './soldierBody.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

export const STYLE = {
  US: {
    tunic: 0x8b8263,
    collar: 0x847b5c,
    trousers: 0x5f5541,
    hem: 0.845,
    wrap: 0x9c8f6c, // leggings
    boot: 0x5e3a24,
    sole: 0x241a12,
    web: 0x7b7352,
    helmet: 0x4a4e36,
    helmetIn: 0x3c3a2b,
    net: 0x4f452d,
    strap: 0x6d6448,
    metal: 0x5d5d55,
  },
  GE: {
    tunic: 0x6c705e,
    collar: 0x585d4d,
    trousers: 0x62655a,
    hem: 0.865,
    boot: 0x1d1b19,
    sole: 0x141210,
    leather: 0x201d1a,
    buckle: 0x6e6e66,
    bag: 0x6f6b52,
    felt: 0x5a4632,
    can: 0x50564a,
    helmet: 0x4f544c,
    helmetIn: 0x3a2c20,
    strap: 0x1e1b18,
    metal: 0x3a3c3a,
  },
  SU: {
    tunic: 0x8a7f5a,
    tunicFaded: 0x9e936c,
    collar: 0x83794f,
    trousers: 0x6c6347,
    hem: 0.85,
    boot: 0x2a221c,
    sole: 0x15110e,
    wrap: 0x7d7354, // puttees
    shoe: 0x3b2c20,
    leather: 0x4b3423,
    buckle: 0x9a7f45,
    pouch: 0x5e4c33,
    roll: 0x6a6052,
    canteen: 0x585a46,
    helmet: 0x495639,
    helmetIn: 0x2f2a20,
    strap: 0x5b4a33,
    metal: 0x4a4a42,
  },
};

// ---------------------------------------------------------------------------
// Torso-mounted kit helpers.

// A box sitting on the torso surface: theta/y locate its back face's center.
export function boxOnTorso(b, theta, y, size, { out = 0, tilt = 0, r = 0.004 } = {}) {
  const [w, h, d] = size;
  const p = torsoPoint(theta, y, new THREE.Vector3(), out);
  const n = torsoNormal(theta, y, new THREE.Vector3());
  n.y = 0;
  n.normalize();
  const X = V(n.z, 0, -n.x),
    Y = V(0, 1, 0),
    Z = n.clone();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  if (tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), tilt));
  const c = p.clone().addScaledVector(n, d / 2);
  b.box([c.x, c.y, c.z], [w, h, d], { quat: q, r });
  return { p, n, q, c };
}

// A band around the torso between heights y0 and y1 (belts, collars).
export function band(b, y0, y1, thick, { nu = 22, grow = 0 } = {}) {
  const rows = [
    [y0, grow],
    [y0, grow + thick],
    [y1, grow + thick],
    [y1, grow],
  ];
  b.param(
    nu,
    3,
    (u, v, out) => {
      const [y, g] = rows[Math.round(v * 3)];
      torsoPoint(u * PI * 2 - PI / 2, y, out, g);
    },
    { center: V(0, (y0 + y1) / 2, 0) },
  );
}

// Control point on the torso: {x, y, side} (side -1 front, 1 back) or {t, y}.
function cpTheta(c) {
  return c.t !== undefined ? c.t : torsoTheta(c.x, c.y, c.side);
}
// Dense path over the torso surface through control points.
export function torsoPath(cps, grow, step = 0.03) {
  const pts = [];
  for (let i = 0; i < cps.length - 1; i++) {
    const t0 = cpTheta(cps[i]);
    let t1 = cpTheta(cps[i + 1]);
    // Go the short way around.
    while (t1 - t0 > PI) t1 -= 2 * PI;
    while (t1 - t0 < -PI) t1 += 2 * PI;
    const p0 = torsoPoint(t0, cps[i].y),
      p1 = torsoPoint(t1, cps[i + 1].y);
    const n = Math.max(1, Math.ceil(p0.distanceTo(p1) / step));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const t = t0 + (t1 - t0) * f,
        y = cps[i].y + (cps[i + 1].y - cps[i].y) * f;
      pts.push({ t, y, p: torsoPoint(t, y, new THREE.Vector3(), grow) });
    }
  }
  const last = cps[cps.length - 1];
  pts.push({ t: cpTheta(last), y: last.y, p: torsoPoint(cpTheta(last), last.y, new THREE.Vector3(), grow) });
  return pts;
}

export function strapOnTorso(b, cps, width, thick, grow = 0.003) {
  const path = torsoPath(cps, grow, 0.06);
  const normals = new Map();
  for (const q of path) normals.set(q.p, torsoNormal(q.t, q.y, new THREE.Vector3()));
  b.strap(
    path.map((q) => q.p),
    width,
    thick,
    (p) => normals.get(p),
  );
}

// ---------------------------------------------------------------------------
// Helmets: u = azimuth (0 front), v = 0 top .. 1 rim. Coefficients fit
// f(phi) = A + B cos(phi) + C cos(2 phi) through front / side / back values.
const fit = (front, side, back) => {
  const A = (front + back + 2 * side) / 4;
  const C = A - side;
  const Bc = (front - back) / 2;
  return (phi) => A + Bc * Math.cos(phi) + C * Math.cos(2 * phi);
};

export const HELMETS = {
  US: { rx: 0.112, rz: 0.133, cz: 0.006, top: 0.155, base: fit(0.042, 0.006, -0.01), out: fit(0.007, 0.007, 0.008), drop: fit(0.004, 0.004, 0.005), vDome: 0.86, ne: 2.25, skirtPow: 2 },
  GE: { rx: 0.106, rz: 0.13, cz: 0.008, top: 0.15, base: fit(0.052, 0.034, 0.027), out: fit(0.032, 0.03, 0.036), drop: fit(0.014, 0.074, 0.086), vDome: 0.7, ne: 2.15, skirtPow: 1.7 },
  SU: { rx: 0.112, rz: 0.134, cz: 0.004, top: 0.166, base: fit(0.046, 0.012, -0.004), out: fit(0.015, 0.01, 0.017), drop: fit(0.008, 0.01, 0.014), vDome: 0.83, ne: 2.05, skirtPow: 1.5 },
};

export function helmetPoint(spec, u, v, out, inset = 0) {
  const phi = u * PI * 2;
  const sp = Math.sin(phi),
    cp = Math.cos(phi);
  const base = spec.base(phi);
  let h, y, ext;
  if (v <= spec.vDome) {
    const a = (v / spec.vDome) * (PI / 2);
    const e = 2 / spec.ne;
    h = Math.pow(Math.sin(a), e);
    y = base + (spec.top - base) * Math.pow(Math.cos(a), e);
    ext = 0;
  } else {
    const w = (v - spec.vDome) / (1 - spec.vDome);
    h = 1;
    y = base - spec.drop(phi) * w;
    ext = spec.out(phi) * Math.pow(w, spec.skirtPow);
  }
  const rx = spec.rx * h + ext - inset,
    rz = spec.rz * h + ext - inset;
  out.set(sp * Math.max(0, rx), y - inset * 0.6, spec.cz - cp * Math.max(0, rz));
  return out.add(HEAD_CENTER);
}

export function buildHelmet(b, faction, st, { lod = 0, net = false, chinstrap = true } = {}) {
  const spec = HELMETS[faction];
  const nu = lod ? 10 : 20,
    nv = lod ? 5 : 10;
  b.bones(rigid(B.head));
  b.paint(st.helmet);
  const hc = HEAD_CENTER.clone().add(V(0, 0.02, spec.cz));
  b.param(nu, nv, (u, v, o) => helmetPoint(spec, u, v, o), { center: hc });
  if (lod) {
    // Close the underside so it doesn't look hollow from below.
    b.paint(st.helmetIn);
    b.param(nu, 2, (u, v, o) => helmetPoint(spec, u, 1 - v * 0.15, o, 0.004), { center: hc, flip: true });
    return;
  }
  // Inside of the shell (liner), seen from below.
  b.paint(st.helmetIn);
  b.param(nu, 3, (u, v, o) => helmetPoint(spec, u, 0.45 + v * 0.55, o, 0.0045), { center: hc, flip: true });
  // Rolled rim.
  b.paint(st.helmet);
  const rim = [];
  for (let i = 0; i <= nu; i++) rim.push({ c: helmetPoint(spec, (i % nu) / nu, 1, new THREE.Vector3(), 0.002), rx: 0.0032, rz: 0.0032 });
  b.tube(rim, { seg: 3, side: [0, 1, 0] });
  if (faction === 'GE') {
    // Ventilation lugs on the sides.
    for (const s of [-1, 1]) {
      const p = helmetPoint(spec, s > 0 ? 0.23 : 0.77, spec.vDome * 0.72, new THREE.Vector3());
      const n = p.clone().sub(hc).normalize();
      b.cylinder([p.x - n.x * 0.002, p.y - n.y * 0.002, p.z - n.z * 0.002], [p.x + n.x * 0.004, p.y + n.y * 0.004, p.z + n.z * 0.004], 0.0055, 0.0045, { seg: 8 });
    }
  }
  if (faction === 'SU') {
    // Liner rivets around the dome.
    for (let i = 0; i < 6; i++) {
      const p = helmetPoint(spec, (i + 0.5) / 6, spec.vDome * 0.62, new THREE.Vector3());
      b.ellipsoid([p.x, p.y, p.z], [0.004, 0.004, 0.004], { nu: 5, nv: 3 });
    }
  }
  if (chinstrap) {
    b.paint(st.strap);
    const hcx = HEAD_CENTER;
    for (const s of [-1, 1]) {
      const pts = [V(s * 0.08, 0.012, 0.016), V(s * 0.078, -0.03, -0.004), V(s * 0.068, -0.07, -0.03), V(s * 0.048, -0.1, -0.048), V(s * 0.02, -0.119, -0.05), V(0, -0.123, -0.048)].map((p) => p.add(hcx));
      b.strap(pts, faction === 'US' ? 0.016 : 0.011, 0.0022, (p) => p.clone().sub(hcx).normalize());
    }
  }
  if (net) {
    // Helmet net: a coarse lattice of cords over the dome.
    b.paint(st.net);
    const cord = 0.0024,
      lift = 0.0035;
    const nMer = 10;
    for (let k = 0; k < nMer; k++) {
      const u = (k + 0.25) / nMer;
      const ring = [];
      for (let j = 1; j <= 7; j++) ring.push({ c: netPoint(spec, u, (j / 7) * 0.97, hc, lift), rx: cord, rz: cord });
      b.tube(ring, { seg: 3, side: [0, 1, 0] });
    }
    for (const v of [0.36, 0.62, 0.86]) {
      const ring = [];
      const n = 18;
      for (let i = 0; i <= n; i++) ring.push({ c: netPoint(spec, (i % n) / n, v, hc, lift), rx: cord, rz: cord });
      b.tube(ring, { seg: 3, side: [0, 1, 0] });
    }
  }
}
function netPoint(spec, u, v, hc, lift) {
  const p = helmetPoint(spec, u, v, new THREE.Vector3());
  const n = p.clone().sub(hc).normalize();
  return p.addScaledVector(n, lift);
}

// ---------------------------------------------------------------------------
// Small parts.
function buttonsDown(b, ys, x = 0, color = 0x3c3a30, r = 0.0065) {
  b.paint(color);
  for (const y of ys) {
    const t = torsoTheta(x, y, -1);
    const p = torsoPoint(t, y, new THREE.Vector3(), 0.002);
    b.ellipsoid([p.x, p.y, p.z], [r, r, r * 0.5], { nu: 5, nv: 2 });
  }
}

function pocket(b, x, yTop, w, h, flapColor, { lod = 0, flap = 0.045, side = -1 } = {}) {
  if (lod) return;
  const t = torsoTheta(x, yTop - h / 2, side);
  b.paint(flapColor);
  boxOnTorso(b, t, yTop - h / 2, [w, h, 0.008], { out: -0.003, r: 0.003 });
  b.paint(flapColor);
  const tf = torsoTheta(x, yTop - flap / 2, side);
  boxOnTorso(b, tf, yTop - flap / 2, [w + 0.006, flap, 0.012], { out: -0.002, r: 0.003 });
}

function shoulderStraps(b, color, lod) {
  if (lod) return;
  b.paint(color);
  for (const s of [-1, 1]) {
    const p = V(s * 0.125, 1.462, 0.004);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * -0.42));
    b.box([p.x, p.y, p.z], [0.11, 0.008, 0.05], { quat: q, r: 0.003 });
  }
}

function collar(b, color, { lod = 0, kind = 'stand' } = {}) {
  b.paint(color);
  b.bones(torsoWeights);
  const rows =
    kind === 'fold'
      ? [
          { c: V(0, 1.455, 0.018), rx: 0.092, rz: 0.084 },
          { c: V(0, 1.49, 0.02), rx: 0.078, rz: 0.072 },
          { c: V(0, 1.515, 0.022), rx: 0.068, rz: 0.064 },
        ]
      : [
          { c: V(0, 1.462, 0.02), rx: 0.078, rz: 0.074 },
          { c: V(0, 1.5, 0.021), rx: 0.07, rz: 0.066 },
          { c: V(0, 1.528, 0.022), rx: 0.066, rz: 0.063 },
        ];
  b.tube(rows, { seg: lod ? 8 : 16, capStart: 0, capEnd: 0, side: [1, 0, 0] });
}

// ---------------------------------------------------------------------------
// Outfits. Returns { cloth, gear } builders (cloth: textiles, gear: leather /
// steel). variant: small integer for per-faction variations.
export function buildOutfit(faction, variant = 0, lod = 0) {
  const st = STYLE[faction];
  const cloth = new SkinBuilder(0.5);
  const gear = new SkinBuilder(0.35);
  cloth.lowPoly = gear.lowPoly = !!lod;
  if (faction === 'US') buildUS(cloth, gear, st, variant, lod);
  else if (faction === 'GE') buildGE(cloth, gear, st, variant, lod);
  else buildSU(cloth, gear, st, variant, lod);
  return { cloth, gear };
}

function baseUniform(cloth, st, { tunic, hem, lod, sleeveBulk = 0, trouserEnd = 0.84, thighBulk = 0, flare = 0.012 }) {
  cloth.paint(tunic);
  const trousers = new THREE.Color(st.trousers);
  cloth.colorFn = (x, y, z, c) => {
    if (y < hem) c.copy(trousers);
  };
  cloth.bones(torsoWeights);
  buildTorso(cloth, { hem, lod, flare });
  cloth.colorFn = null;
  cloth.paint(tunic);
  for (const s of [-1, 1]) buildSleeve(cloth, s, { lod, bulk: sleeveBulk });
  cloth.paint(st.trousers);
  for (const s of [-1, 1]) buildTrouserLeg(cloth, s, { lod, end: trouserEnd, thighBulk });
}

function buildUS(cloth, gear, st, variant, lod) {
  baseUniform(cloth, st, { tunic: st.tunic, hem: st.hem, lod, sleeveBulk: 0.003, trouserEnd: 0.6 });
  collar(cloth, st.collar, { lod, kind: 'fold' });
  shoulderStraps(cloth, st.tunic, lod);
  if (!lod) {
    // Slanted hand-warmer pocket flaps.
    cloth.paint(0x7a7254);
    for (const s of [-1, 1]) boxOnTorso(cloth, torsoTheta(s * 0.1, 0.97, -1), 0.97, [0.12, 0.012, 0.006], { out: 0.0, tilt: 0, r: 0.002 });
    buttonsDown(cloth, [1.12, 1.21, 1.3, 1.39], 0.012, 0x4a4434, 0.006);
  }
  // Canvas leggings over the shoes.
  cloth.paint(st.wrap);
  for (const s of [-1, 1]) buildLegWrap(cloth, s, 0.56, 0.8, [0.057, 0.063], [0.05, 0.056], { lod, flareTop: 0.003 });
  if (!lod) {
    // Lace hooks down the outside of the leggings.
    cloth.paint(0x3a3528);
    for (const s of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const y = 0.3 - i * 0.045;
        cloth.bones(s < 0 ? B.shinL : B.shinR);
        cloth.ellipsoid([s * 0.155 - s * i * 0.0006, y, 0.005], [0.004, 0.004, 0.004], { nu: 4, nv: 2 });
      }
  }
  // Russet service shoes.
  for (const s of [-1, 1]) buildBoot(gear, s, { lod, upper: st.boot, sole: st.sole, high: 0.13 });
  // M1923 cartridge belt with ten pockets, M1936 suspenders.
  cloth.paint(st.web);
  cloth.bones(torsoWeights);
  band(cloth, 1.0, 1.062, 0.006, { nu: lod ? 10 : 24, grow: 0.002 });
  if (!lod) {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = s * (0.045 + i * 0.026);
        const y = 1.025;
        boxOnTorso(cloth, torsoTheta(x, y, -1) + s * i * 0.12, y, [0.05, 0.085, 0.032], { out: 0.006, r: 0.006 });
      }
    }
    cloth.paint(0x6f6849);
    for (const s of [-1, 1])
      strapOnTorso(
        cloth,
        [
          { x: s * 0.09, y: 1.06, side: -1 },
          { x: s * 0.1, y: 1.3, side: -1 },
          { x: s * 0.11, y: 1.43, side: -1 },
          { t: s < 0 ? PI : 0, y: 1.472 },
          { x: s * 0.11, y: 1.43, side: 1 },
          { x: s * 0.08, y: 1.25, side: 1 },
          { x: s * 0.07, y: 1.06, side: 1 },
        ],
        0.03,
        0.004,
        0.004,
      );
  } else {
    for (const s of [-1, 1]) boxOnTorso(cloth, torsoTheta(s * 0.1, 1.025, -1), 1.025, [0.14, 0.08, 0.03], { out: 0.006, r: 0.006 });
  }
  // Canteen in its cover on the right hip, first aid pouch front left, shovel left rear.
  boxOnTorso(cloth, 1.05, 0.93, [0.12, 0.17, 0.075], { out: 0.008, r: 0.03 });
  if (!lod) {
    cloth.paint(st.web);
    boxOnTorso(cloth, -2.2, 1.0, [0.07, 0.07, 0.035], { out: 0.008, r: 0.008 });
    boxOnTorso(cloth, 2.35, 0.92, [0.15, 0.2, 0.035], { out: 0.008, r: 0.015 });
    gear.paint(st.metal);
    gear.bones(torsoWeights);
    boxOnTorso(gear, -PI / 2, 1.031, [0.05, 0.045, 0.012], { out: 0.008, r: 0.003 }); // buckle
  }
  buildHelmet(gear, 'US', st, { lod, net: variant !== 1, chinstrap: true });
}

function buildGE(cloth, gear, st, variant, lod) {
  baseUniform(cloth, st, { tunic: st.tunic, hem: st.hem, lod, trouserEnd: 0.56, thighBulk: 0.004 });
  collar(cloth, st.collar, { lod, kind: 'stand' });
  shoulderStraps(cloth, st.collar, lod);
  if (!lod) {
    cloth.paint(st.tunic);
    for (const s of [-1, 1]) {
      pocket(cloth, s * 0.088, 1.39, 0.105, 0.125, st.tunic, { lod });
      cloth.paint(st.tunic);
      pocket(cloth, s * 0.1, 1.0, 0.13, 0.15, st.tunic, { lod, flap: 0.055 });
      cloth.paint(st.tunic);
    }
    buttonsDown(cloth, [1.1, 1.18, 1.26, 1.34, 1.42], 0.0, 0x4a4c44, 0.0065);
  }
  // Jackboots.
  for (const s of [-1, 1]) {
    gear.paint(st.boot);
    buildLegWrap(gear, s, 0.47, 0.8, [0.066, 0.072], [0.05, 0.055], { lod, flareTop: 0.005 });
    buildBoot(gear, s, { lod, upper: st.boot, sole: st.sole, high: 0.16 });
  }
  // Black leather belt, buckle, Y-straps, two 3-cell pouches.
  gear.paint(st.leather);
  gear.bones(torsoWeights);
  band(gear, 1.022, 1.068, 0.005, { nu: lod ? 10 : 24, grow: 0.002 });
  gear.paint(st.buckle);
  boxOnTorso(gear, -PI / 2, 1.045, [0.06, 0.05, 0.008], { out: 0.007, r: 0.004 });
  gear.paint(st.leather);
  if (!lod) {
    for (const s of [-1, 1]) {
      strapOnTorso(
        gear,
        [
          { x: s * 0.075, y: 1.07, side: -1 },
          { x: s * 0.095, y: 1.3, side: -1 },
          { x: s * 0.108, y: 1.43, side: -1 },
          { t: s < 0 ? PI : 0, y: 1.474 },
          { x: s * 0.105, y: 1.43, side: 1 },
          { x: s * 0.05, y: 1.3, side: 1 },
          { x: s * 0.0, y: 1.24, side: 1 },
        ],
        0.026,
        0.004,
        0.006,
      );
    }
    strapOnTorso(gear, [{ x: 0, y: 1.25, side: 1 }, { x: 0, y: 1.06, side: 1 }], 0.03, 0.004, 0.006);
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = s * (0.05 + i * 0.047);
      const y = 1.03;
      const th = torsoTheta(x, y, -1);
      if (lod && i !== 1) continue;
      boxOnTorso(gear, th, y, lod ? [0.15, 0.08, 0.04] : [0.046, 0.08, 0.038], { out: 0.007, r: 0.006 });
      if (!lod) boxOnTorso(gear, th, y + 0.03, [0.05, 0.028, 0.044], { out: 0.007, r: 0.004, tilt: 0.12 });
    }
  }
  // Bread bag (right rear hip) with the canteen on it; gas-mask can at the back.
  cloth.paint(st.bag);
  cloth.bones(torsoWeights);
  boxOnTorso(cloth, 0.95, 0.93, [0.24, 0.17, 0.065], { out: 0.008, r: 0.025 });
  if (!lod) {
    cloth.paint(st.felt);
    const cb = boxOnTorso(cloth, 1.45, 0.92, [0.11, 0.16, 0.05], { out: 0.062, r: 0.03 });
    gear.paint(0x1f1f1d);
    gear.bones(torsoWeights);
    const top = cb.c.clone().add(V(0, 0.095, 0));
    gear.cylinder([top.x, top.y - 0.03, top.z], [top.x, top.y + 0.015, top.z], 0.034, 0.03, { seg: 10 });
  }
  gear.paint(st.can);
  gear.bones(torsoWeights);
  {
    const t = 2.05,
      y = 0.98;
    const p = torsoPoint(t, y, new THREE.Vector3(), 0.06);
    const axis = V(-0.32, -0.95, 0.06).normalize();
    const a = p.clone().addScaledVector(axis, -0.13),
      c = p.clone().addScaledVector(axis, 0.13);
    const rings = [];
    const n = lod ? 3 : 10;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const rib = !lod && (i === 3 || i === 5 || i === 7) ? 0.004 : 0;
      rings.push({ c: a.clone().lerp(c, f), rx: 0.053 + rib, rz: 0.053 + rib });
    }
    gear.tube(rings, { seg: lod ? 6 : 14, capStart: 0.15, capEnd: 0.15, side: [1, 0, 0] });
  }
  if (!lod) {
    // Entrenching tool and bayonet on the left hip.
    gear.paint(st.leather);
    boxOnTorso(gear, 2.75, 0.9, [0.14, 0.19, 0.03], { out: 0.006, r: 0.01 });
    boxOnTorso(gear, 2.95, 0.88, [0.03, 0.3, 0.022], { out: 0.04, r: 0.006 });
  }
  buildHelmet(gear, 'GE', st, { lod, net: false, chinstrap: variant === 1 });
}

function buildSU(cloth, gear, st, variant, lod) {
  const faded = variant & 1;
  const puttees = variant & 2;
  const tunic = faded ? st.tunicFaded : st.tunic;
  baseUniform(cloth, st, { tunic, hem: st.hem, lod, trouserEnd: puttees ? 0.58 : 0.52, thighBulk: 0.012, flare: 0.016 });
  collar(cloth, faded ? st.tunicFaded : st.collar, { lod, kind: 'stand' });
  shoulderStraps(cloth, tunic, lod);
  if (!lod) {
    buttonsDown(cloth, [1.39, 1.44], 0.0, 0x4d4a38, 0.006);
    if (variant !== 1) for (const s of [-1, 1]) pocket(cloth, s * 0.088, 1.385, 0.1, 0.12, tunic, { lod });
  }
  if (puttees) {
    cloth.paint(st.wrap);
    for (const s of [-1, 1]) buildLegWrap(cloth, s, 0.56, 0.8, [0.055, 0.061], [0.048, 0.053], { lod, flareTop: 0.002 });
    for (const s of [-1, 1]) buildBoot(gear, s, { lod, upper: st.shoe, sole: st.sole, high: 0.12 });
  } else {
    for (const s of [-1, 1]) {
      gear.paint(st.boot);
      buildLegWrap(gear, s, 0.49, 0.8, [0.067, 0.073], [0.05, 0.056], { lod, flareTop: 0.006 });
      buildBoot(gear, s, { lod, upper: st.boot, sole: st.sole, high: 0.16 });
    }
  }
  // Belt and buckle.
  gear.paint(st.leather);
  gear.bones(torsoWeights);
  band(gear, 1.03, 1.072, 0.005, { nu: lod ? 10 : 24, grow: 0.003 });
  gear.paint(st.buckle);
  boxOnTorso(gear, -PI / 2, 1.051, [0.05, 0.048, 0.007], { out: 0.008, r: 0.003 });
  // Ammo pouches.
  gear.paint(st.pouch);
  for (const s of [-1, 1]) {
    for (let i = 0; i < (lod ? 1 : 2); i++) {
      const x = s * (lod ? 0.1 : 0.075 + i * 0.062);
      const y = 1.035;
      const th = torsoTheta(x, y, -1);
      boxOnTorso(gear, th, y, lod ? [0.12, 0.075, 0.035] : [0.058, 0.075, 0.035], { out: 0.008, r: 0.006 });
      if (!lod) boxOnTorso(gear, th, y + 0.028, [0.062, 0.026, 0.04], { out: 0.008, r: 0.004, tilt: 0.1 });
    }
  }
  // Rolled greatcoat over the left shoulder, across the chest to the right hip.
  cloth.paint(st.roll);
  cloth.bones(torsoWeights);
  {
    const R = 0.05;
    const cps = [
      { t: PI, y: 1.478 },
      { x: -0.07, y: 1.4, side: -1 },
      { x: 0.02, y: 1.29, side: -1 },
      { x: 0.1, y: 1.17, side: -1 },
      { t: -0.25, y: 1.09 },
      { t: 0.05, y: 1.07 },
      { t: 0.35, y: 1.09 },
      { x: 0.1, y: 1.17, side: 1 },
      { x: 0.02, y: 1.29, side: 1 },
      { x: -0.07, y: 1.4, side: 1 },
      { t: PI - 0.01, y: 1.478 },
    ];
    const path = torsoPath(cps, R * 0.8 + 0.01, lod ? 0.12 : 0.045);
    const rings = path.map((q) => {
      const n = torsoNormal(q.t, q.y, new THREE.Vector3());
      return { c: q.p, rx: R * 0.8, rz: R, side: [n.x, n.y, n.z] };
    });
    cloth.tube(rings, { seg: lod ? 5 : 10, capStart: 0.6, capEnd: 0.6 });
    if (!lod) {
      // Ties around the roll.
      cloth.paint(0x3e3426);
      for (const k of [0.22, 0.5, 0.78]) {
        const q = path[Math.floor(k * (path.length - 1))];
        const n = torsoNormal(q.t, q.y, new THREE.Vector3());
        const p = q.p;
        const nx = path[Math.floor(k * (path.length - 1)) + 1].p.clone().sub(p).normalize();
        cloth.tube(
          [
            { c: p.clone().addScaledVector(nx, -0.006), rx: R * 0.8 + 0.003, rz: R + 0.003, side: [n.x, n.y, n.z] },
            { c: p.clone().addScaledVector(nx, 0.006), rx: R * 0.8 + 0.003, rz: R + 0.003, side: [n.x, n.y, n.z] },
          ],
          { seg: 10 },
        );
      }
    }
  }
  // Canteen (right rear), small shovel (left rear).
  cloth.paint(st.canteen);
  boxOnTorso(cloth, 1.1, 0.95, [0.11, 0.16, 0.06], { out: 0.008, r: 0.028 });
  if (!lod) {
    gear.paint(st.leather);
    boxOnTorso(gear, 2.5, 0.92, [0.13, 0.17, 0.03], { out: 0.008, r: 0.01 });
  }
  buildHelmet(gear, 'SU', st, { lod, net: false, chinstrap: true });
}

// ---------------------------------------------------------------------------
// The person under the uniform: face and hands, varied by a seeded RNG.
const SKIN = [0xe8c4ab, 0xdcae92, 0xcd9e80, 0xbb8a6c, 0xa8765a, 0x8e6047, 0x6e4835, 0x553628];
const SKIN_WEIGHTS = {
  US: [3, 4, 4, 3, 2, 1, 1, 1],
  GE: [3, 4, 4, 2.5, 0.6, 0.15, 0, 0],
  SU: [3, 4, 4, 3, 2, 1.2, 0.3, 0],
};
const HAIR = [0x2a1e16, 0x3a2a1e, 0x16120f, 0x5e4a33, 0x84693f, 0x5e3320];
const EYES = [0x3a2a1e, 0x34404a, 0x46523a, 0x231a14];

function pickWeighted(rng, w) {
  let sum = 0;
  for (const x of w) sum += x;
  let r = rng() * sum;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return w.length - 1;
}

export function personParams(faction, rng) {
  const tone = pickWeighted(rng, SKIN_WEIGHTS[faction] || SKIN_WEIGHTS.US);
  const dark = tone >= 5;
  const hair = dark ? (rng() < 0.7 ? 2 : 0) : Math.floor(rng() * HAIR.length);
  return {
    tone,
    skin: new THREE.Color(SKIN[tone]),
    hair: new THREE.Color(HAIR[hair]),
    brows: new THREE.Color(HAIR[hair]).multiplyScalar(0.8),
    lips: new THREE.Color(SKIN[tone]).lerp(new THREE.Color(0x9a4e44), dark ? 0.25 : 0.45),
    eyeColor: new THREE.Color(dark ? EYES[3] : EYES[Math.floor(rng() * EYES.length)]),
    stubble: rng() < 0.6 ? rng() : 0,
    shape: { jaw: 0.93 + rng() * 0.13, chin: 0.95 + rng() * 0.1, width: 0.96 + rng() * 0.08, nose: 0.9 + rng() * 0.25 },
  };
}

export function buildPerson(params, lod = 0) {
  const skin = new SkinBuilder(0.3);
  skin.lowPoly = !!lod;
  skin.paint(params.skin);
  buildHead(skin, { ...params, lod });
  skin.paint(params.skin);
  buildNeck(skin, { lod });
  for (const s of [-1, 1]) buildHand(skin, s, { lod });
  return skin;
}
