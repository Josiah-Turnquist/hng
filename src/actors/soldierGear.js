// Headgear and equipment of 1944 soldiers, built at real size around the body:
// steel helmets (US M1 / M2, German M40 and Fallschirmjäger M38, Soviet SSh-40)
// with nets, scrim, covers and chin straps; tank crew helmets; side caps and
// field caps; and the kit that hangs on the belt and harness (pouches,
// canteens, entrenching tools, bayonets, bread bags, gas mask cans, packs,
// rolls, bandoliers, holsters, binoculars, knives).
//
// Dimensions are from surviving examples and quartermaster drawings where
// known (sources in comments), otherwise estimated ("est.").
import * as THREE from 'three';
import { B, HEAD_CENTER } from './soldierRig.js';
import { rigid, torsoWeights, weightsAt, smooth01 } from './soldierGeo.js';
import { CELL } from './soldierMaterials.js';
import { torsoPoint, torsoNormal, torsoTheta, garmentOffset, lerp, hash1 } from './soldierBody.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const HC = HEAD_CENTER;
const _q = new THREE.Quaternion();

// ---------------------------------------------------------------------------
// A local frame (position + rotation): X right (as seen facing the surface),
// Y up, Z out of the surface.
export class Frame {
  constructor(p = new THREE.Vector3(), q = new THREE.Quaternion()) {
    this.p = p;
    this.q = q;
  }
  point(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyQuaternion(this.q).add(this.p);
  }
  dir(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyQuaternion(this.q);
  }
  // A child frame offset by (x, y, z) and rotated by euler angles (rx, ry, rz).
  sub(x, y, z, rx = 0, ry = 0, rz = 0) {
    const q = this.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)));
    return new Frame(this.point(x, y, z), q);
  }
  quat(rx = 0, ry = 0, rz = 0) {
    return this.q.clone().multiply(_q.setFromEuler(new THREE.Euler(rx, ry, rz)));
  }
  box(b, x, y, z, w, h, d, { r = 0.004, rot = null, seg = null } = {}) {
    b.box(this.point(x, y, z), [w, h, d], { quat: this.quat(...(rot || [0, 0, 0])), r, seg });
  }
  cyl(b, a, c, r0, r1 = r0, opts = {}) {
    b.cylinder(this.point(...a), this.point(...c), r0, r1, opts);
  }
  ell(b, x, y, z, rx, ry, rz, { nu = 8, nv = 5, rot = null } = {}) {
    b.ellipsoid(this.point(x, y, z), [rx, ry, rz], { nu, nv, quat: this.quat(...(rot || [0, 0, 0])) });
  }
}

// Frame on the torso at (theta, y), `out` meters off the garment surface,
// facing out horizontally (things hang plumb).
export function torsoFrame(g, theta, y, out = 0, { tilt = 0, plumb = true } = {}) {
  const off = g ? garmentOffset(g, theta, y) : 0;
  const p = torsoPoint(theta, y, new THREE.Vector3(), off + out);
  const n = torsoNormal(theta, y, new THREE.Vector3());
  if (plumb) n.y = 0;
  n.normalize();
  const Y = V(0, 1, 0);
  const X = new THREE.Vector3().crossVectors(Y, n).normalize();
  const Yc = new THREE.Vector3().crossVectors(n, X);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Yc, n));
  if (tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), tilt));
  return new Frame(p, q);
}

// A frame on the back for packs and bags hung from the shoulders: centered,
// its top edge at yTop, `gap` behind the fullest point of the garment over the
// w x h area the load covers. X to the wearer's right, Z out of the back.
export function backFrame(g, yTop, w, h, gap = 0.01) {
  let z = 0;
  const p = new THREE.Vector3();
  for (let j = 0; j <= 4; j++) {
    const y = yTop - (h * j) / 4;
    for (let i = 0; i <= 4; i++) {
      const th = torsoTheta((i / 4 - 0.5) * w, y, 1);
      torsoPoint(th, y, p, g ? garmentOffset(g, th, y) : 0);
      z = Math.max(z, p.z);
    }
  }
  return new Frame(V(0, yTop, z + gap), new THREE.Quaternion());
}

// The weights of the torso at a frame's origin, for a rigid item there.
export const rigidAt = (f) => weightsAt(torsoWeights, f.p.x, f.p.y, f.p.z);

// A band around the torso garment between y0 and y1 (belts, waistbands).
export function torsoBand(b, g, y0, y1, thick, { nu = 28, lod = 0, extra = 0 } = {}) {
  const n = [nu, 14, 8][lod];
  const us = [];
  for (let i = 0; i <= n; i++) us.push(i / n);
  const rows = lod ? [y0, y1] : [y0, y0 + 0.002, y1 - 0.002, y1];
  const rowsOut = lod ? [thick, thick] : [0.0005, thick, thick, 0.0005];
  b.bones(torsoWeights);
  b.part();
  b.grid(
    us,
    rows.map((y, i) => i),
    (u, j, out) => {
      const th = -PI / 2 + (u - 0.5) * 2 * PI;
      const y = rows[j];
      const off = (g ? garmentOffset({ ...g, flare: 0, blouse: 0 }, th, y) : 0) + extra;
      torsoPoint(th, y, out, off + rowsOut[j]);
    },
    { center: V(0, (y0 + y1) / 2, 0), wrapU: true },
  );
}

// Path over the torso through control points {x, y, side} (side -1 front, 1
// back) or {t, y}; returns {t, y, p} samples `out` off the garment.
function cpTheta(c) {
  return c.t !== undefined ? c.t : torsoTheta(c.x, c.y, c.side);
}
export function torsoPath(g, cps, out, step = 0.03) {
  const pts = [];
  const at = (t, y) => {
    const off = g ? garmentOffset({ ...g, blouse: 0 }, t, y) : 0;
    return torsoPoint(t, y, new THREE.Vector3(), off + out);
  };
  for (let i = 0; i < cps.length - 1; i++) {
    const t0 = cpTheta(cps[i]);
    let t1 = cpTheta(cps[i + 1]);
    while (t1 - t0 > PI) t1 -= 2 * PI;
    while (t1 - t0 < -PI) t1 += 2 * PI;
    const p0 = at(t0, cps[i].y),
      p1 = at(t1, cps[i + 1].y);
    const n = Math.max(1, Math.ceil(p0.distanceTo(p1) / step));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const t = t0 + (t1 - t0) * f,
        y = cps[i].y + (cps[i + 1].y - cps[i].y) * f;
      pts.push({ t, y, p: at(t, y) });
    }
  }
  const last = cps[cps.length - 1];
  pts.push({ t: cpTheta(last), y: last.y, p: at(cpTheta(last), last.y) });
  return pts;
}

// A strap lying on the garment through control points.
export function torsoStrap(b, g, cps, width, thick, { out = 0.002, lod = 0 } = {}) {
  const path = torsoPath(g, cps, out, lod ? 0.12 : 0.035);
  const normals = path.map((q) => torsoNormal(q.t, q.y, new THREE.Vector3()));
  b.bones(torsoWeights);
  b.part();
  b.strap(
    path.map((q) => q.p),
    width,
    thick,
    (p, k) => normals[k],
  );
  return path;
}

// ---------------------------------------------------------------------------
// Steel helmets. u = azimuth (0 front), v = 0 crown .. 1 rim. Shape terms fit
// f(phi) = A + B cos(phi) + C cos(2 phi) through front / side / back values.
const fit = (front, side, back) => {
  const A = (front + back + 2 * side) / 4;
  const C = A - side;
  const Bc = (front - back) / 2;
  return (phi) => A + Bc * Math.cos(phi) + C * Math.cos(2 * phi);
};
// rx, rz: shell half width / length at the base of the dome; top: crown above
// the head center; base: dome base height (front/side/back); out: skirt flare;
// drop: skirt depth below the dome base; vDome: share of v on the dome.
// US M1: 24 x 29 cm, crown ~2.5 cm over the head (liner suspension).
// German M40 (size 64 shell): 26 x 31 cm, flared skirt and visor.
// FJ M38: rimless, lower. SSh-40: tall dome, small brim, six liner rivets.
export const HELMETS = {
  US: { rx: 0.112, rz: 0.133, cz: 0.006, top: 0.156, base: fit(0.042, 0.004, -0.012), out: fit(0.008, 0.008, 0.009), drop: fit(0.004, 0.006, 0.006), vDome: 0.86, ne: 2.3, skirtPow: 2 },
  GE: { rx: 0.105, rz: 0.129, cz: 0.008, top: 0.151, base: fit(0.054, 0.036, 0.028), out: fit(0.03, 0.03, 0.037), drop: fit(0.014, 0.072, 0.086), vDome: 0.7, ne: 2.15, skirtPow: 1.7 },
  FJ: { rx: 0.106, rz: 0.127, cz: 0.006, top: 0.146, base: fit(0.036, 0.004, -0.018), out: fit(0.003, 0.003, 0.003), drop: fit(0.002, 0.008, 0.008), vDome: 0.9, ne: 2.05, skirtPow: 1.5 },
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
  return out.add(HC);
}
function helmetNormalOut(spec, u, v, inset = 0) {
  const p = helmetPoint(spec, u, v, new THREE.Vector3(), inset);
  return p.sub(HC.clone().add(V(0, 0.02, spec.cz))).normalize();
}

// kind: 'US' | 'M2' | 'GE' | 'M42' | 'FJ' | 'SU'. opts: net, scrim (burlap
// strips), cover ('splinter' | null), band (rubber band over a net), chin
// ('chin' | 'back' | 'loose' | 'none'), linerStrap (US liner strap over the brim),
// paint (color), seed.
export function buildHelmet(b, kind, st, { lod = 0, net = false, scrim = false, cover = null, band = false, chin = 'chin', linerStrap = false, seed = 1, paint = null, decal = null } = {}) {
  const fam = kind === 'M2' ? 'US' : kind === 'M42' ? 'GE' : kind;
  const spec = HELMETS[fam];
  const nu = [24, 14, 9][lod],
    nv = [10, 6, 4][lod];
  b.bones(rigid(B.head));
  const hc = HC.clone().add(V(0, 0.02, spec.cz));
  const us = [],
    vs = [];
  for (let i = 0; i <= nu; i++) us.push(i / nu);
  for (let j = 0; j <= nv; j++) vs.push(j / nv);
  const shellColor = paint ?? st.helmet;
  // Shell (or its cloth cover).
  if (cover) {
    b.material(cover === 'splinter' ? CELL.splinter : CELL.cotton);
    b.paint(cover === 'splinter' ? 0xbcbcbc : st.cover ?? 0x7a7458);
  } else {
    b.material(CELL.paint);
    b.paint(shellColor);
  }
  b.part();
  const coverPuff = cover ? 0.004 : 0;
  b.grid(us, vs, (u, v, o) => {
    helmetPoint(spec, u, v, o);
    if (coverPuff) o.addScaledVector(helmetNormalOut(spec, u, v), coverPuff * (1 + 0.5 * Math.sin(u * 40 + v * 9)));
  }, { center: hc, wrapU: true });
  if (lod === 2) return;
  // Inside: the liner seen from below.
  b.material(fam === 'US' ? CELL.paint : CELL.leather);
  b.paint(st.helmetIn);
  b.part();
  const vin = [];
  for (let j = 0; j <= (lod ? 2 : 3); j++) vin.push(0.4 + (j / (lod ? 2 : 3)) * 0.6);
  b.grid(us, vin, (u, v, o) => helmetPoint(spec, u, v, o, fam === 'US' ? 0.006 : 0.0045), { center: hc, wrapU: true, flip: true });
  if (lod) return;
  // Rolled rim (M1: stainless rim with the seam at the back; M40: rolled edge;
  // M42 and FJ: plain cut edge).
  b.material(CELL.paint);
  b.paint(cover ? st.helmetIn : shellColor);
  b.part();
  const rimR = kind === 'M42' || kind === 'FJ' ? 0.0016 : 0.0033;
  const rim = [];
  for (let i = 0; i <= nu; i++) rim.push({ c: helmetPoint(spec, (i % nu) / nu, 1, new THREE.Vector3(), rimR * 0.6), rx: rimR, rz: rimR });
  b.tube(rim, { seg: 4, side: [0, 1, 0] });
  if (fam === 'GE') {
    // Ventilation lugs on both sides.
    for (const s of [-1, 1]) {
      const u = s > 0 ? 0.24 : 0.76;
      const p = helmetPoint(spec, u, spec.vDome * 0.74, new THREE.Vector3());
      const n = helmetNormalOut(spec, u, spec.vDome * 0.74);
      b.cylinder(p.clone().addScaledVector(n, -0.002), p.clone().addScaledVector(n, 0.0035), 0.0058, 0.0048, { seg: 10 });
      b.paint(0x111110);
      b.cylinder(p.clone().addScaledVector(n, 0.0034), p.clone().addScaledVector(n, 0.0038), 0.0022, 0.0022, { seg: 8 });
      b.paint(cover ? st.helmetIn : shellColor);
    }
    // Liner rivets: three around the skirt.
    for (const u of [0.0, 0.33, 0.67]) {
      const p = helmetPoint(spec, u + 0.5 / nu, spec.vDome + 0.08, new THREE.Vector3());
      b.ellipsoid(p, [0.0035, 0.0035, 0.0035], { nu: 5, nv: 3 });
    }
  }
  if (fam === 'SU') {
    // Six liner rivets around the dome.
    for (let i = 0; i < 6; i++) {
      const p = helmetPoint(spec, (i + 0.5) / 6, spec.vDome * 0.64, new THREE.Vector3());
      b.ellipsoid(p, [0.004, 0.004, 0.004], { nu: 5, nv: 3 });
    }
  }
  if (fam === 'US') {
    // Chin strap bails (M1: swivel loops; M2: fixed D bails).
    b.material(CELL.metal);
    b.paint(st.helmetIn);
    for (const s of [-1, 1]) {
      const u = s > 0 ? 0.25 : 0.75;
      const p = helmetPoint(spec, u, 0.98, new THREE.Vector3());
      const n = helmetNormalOut(spec, u, 0.98);
      b.box(p.clone().addScaledVector(n, 0.0015), [0.004, 0.018, 0.012], { quat: new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), V(s, 0, 0)), r: 0.0015 });
    }
  }
  // Chin straps.
  buildChinStrap(b, fam, kind, st, chin, spec);
  if (linerStrap && fam === 'US') {
    // The liner's brown leather strap worn up over the front brim.
    b.material(CELL.leather);
    b.paint(0x4a2f1c);
    b.part();
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const u = 0.75 + (i / 14) * 0.5;
      pts.push(helmetPoint(spec, u % 1, 0.9, new THREE.Vector3()).addScaledVector(helmetNormalOut(spec, u % 1, 0.9), 0.0018));
    }
    b.strap(pts, 0.011, 0.0016, (p) => p.clone().sub(hc).normalize());
  }
  if (decal) {
    // Small painted insignia (e.g. a red star on a Soviet helmet).
    b.material(CELL.paint);
    b.paint(decal.color);
    b.part(false);
    const p = helmetPoint(spec, 0, spec.vDome * 0.45, new THREE.Vector3());
    const n = helmetNormalOut(spec, 0, spec.vDome * 0.45);
    starDecal(b, p.addScaledVector(n, 0.0009), n, decal.size ?? 0.022);
  }
  if (net) buildHelmetNet(b, spec, hc, st, { seed, band, scrim });
  else if (scrim) buildHelmetNet(b, spec, hc, st, { seed, band: false, scrim, netless: true });
}

function buildChinStrap(b, fam, kind, st, chin, spec) {
  if (chin === 'none') return;
  const isUS = fam === 'US';
  b.material(isUS ? CELL.webbing : CELL.leather);
  b.paint(st.chinstrap ?? st.strap ?? 0x1e1b18);
  b.part();
  const w = isUS ? 0.019 : 0.014;
  const hcx = HC;
  for (const s of [-1, 1]) {
    let pts;
    const a = helmetPoint(spec, s > 0 ? 0.25 : 0.75, 0.98, new THREE.Vector3());
    const base = a.clone().sub(hcx);
    if (chin === 'chin') {
      pts = [V(base.x, base.y, base.z), V(s * 0.079, -0.03, -0.006), V(s * 0.069, -0.07, -0.03), V(s * 0.05, -0.1, -0.048), V(s * 0.022, -0.12, -0.052), V(0, -0.125, -0.05)];
    } else if (chin === 'back') {
      // Up over the back of the brim.
      pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = (s > 0 ? 0.25 : 0.75) + s * (i / 8) * 0.25;
        pts.push(helmetPoint(spec, ((u % 1) + 1) % 1, 0.93, new THREE.Vector3()).addScaledVector(helmetNormalOut(spec, ((u % 1) + 1) % 1, 0.93), 0.002).sub(hcx));
      }
    } else {
      // Loose: hanging down beside the face, swinging a little forward.
      pts = [V(base.x, base.y, base.z), V(s * 0.082, -0.035, base.z - 0.004), V(s * 0.08, -0.085, base.z - 0.012), V(s * 0.077, -0.12, base.z - 0.016)];
      if (isUS) pts.push(V(s * 0.076, -0.13, base.z - 0.017));
    }
    const P = pts.map((p) => p.clone().add(hcx));
    b.strap(P, w, 0.0022, (p) => p.clone().sub(hcx).normalize());
    if (chin === 'loose' && isUS) {
      // Buckle / ball hook at the end.
      b.material(CELL.metal);
      b.paint(0x55524a);
      const e = P[P.length - 1];
      b.box(e, [0.004, 0.02, 0.018], { r: 0.002 });
      b.material(CELL.webbing);
      b.paint(st.chinstrap ?? st.strap);
    }
  }
  if (chin === 'chin' && !isUS) {
    b.material(CELL.metal);
    b.paint(0x6a6a62);
    b.box(V(hcx.x + 0.03, hcx.y - 0.118, hcx.z - 0.052), [0.016, 0.012, 0.004], { r: 0.0015 });
  }
}

// A five-pointed star lying on a surface (normal n), size = tip to tip.
export function starDecal(b, c, n, size) {
  const up = Math.abs(n.y) > 0.9 ? V(0, 0, -1) : V(0, 1, 0);
  const X = new THREE.Vector3().crossVectors(up, n).normalize();
  const Y = new THREE.Vector3().crossVectors(n, X).normalize();
  const R = size / 2,
    r = R * 0.38;
  const base = b.count;
  b.vertex(c.x, c.y, c.z, n.x, n.y, n.z, 0, 0);
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * 2 * PI;
    const rr = i % 2 === 0 ? R : r;
    const p = c.clone().addScaledVector(X, Math.sin(a) * rr).addScaledVector(Y, Math.cos(a) * rr);
    b.vertex(p.x, p.y, p.z, n.x, n.y, n.z, 0, 0);
  }
  for (let i = 1; i <= 10; i++) b.idx.push(base, base + i + 1, base + i);
  // Wind toward the normal.
  const P = b.pos,
    k = b.idx.length - 30;
  for (let t = k; t < b.idx.length; t += 3) {
    const [i, j, m] = [b.idx[t], b.idx[t + 1], b.idx[t + 2]];
    const ax = P[j * 3] - P[i * 3],
      ay = P[j * 3 + 1] - P[i * 3 + 1],
      az = P[j * 3 + 2] - P[i * 3 + 2];
    const bx = P[m * 3] - P[i * 3],
      by = P[m * 3 + 1] - P[i * 3 + 1],
      bz = P[m * 3 + 2] - P[i * 3 + 2];
    const cx = ay * bz - az * by,
      cy = az * bx - ax * bz,
      cz = ax * by - ay * bx;
    if (cx * n.x + cy * n.y + cz * n.z < 0) {
      b.idx[t + 1] = m;
      b.idx[t + 2] = j;
    }
  }
}

// Helmet net: a lattice of cords over the dome, its edge tucked under the rim,
// with an optional band and burlap scrim strips tied in.
function buildHelmetNet(b, spec, hc, st, { seed = 1, band = false, scrim = false, netless = false }) {
  const cord = 0.0022,
    lift = 0.0032;
  b.material(CELL.duck);
  b.paint(st.net ?? 0x4f452d);
  if (!netless) {
    b.part(false);
    // Diagonal lattice (nets were knotted in diamonds of ~3-4 cm); each cord a
    // thin flat strip lying on the dome.
    const nMer = 12;
    for (let k = 0; k < nMer; k++) {
      for (const dir of [-1, 1]) {
        const pts = [];
        for (let j = 0; j <= 6; j++) {
          const v = 0.06 + (j / 6) * 0.92;
          const u = (k + 0.25) / nMer + dir * v * 0.13;
          pts.push(netPoint(spec, ((u % 1) + 1) % 1, v, hc, lift + 0.0006 * Math.sin(j * 1.7 + k)));
        }
        b.strap(pts, cord * 1.6, cord, (p) => p.clone().sub(hc).normalize(), { flat: true });
      }
    }
  }
  if (band) {
    // Rubber band (cut from an inner tube) around the dome.
    b.material(CELL.leather);
    b.paint(0x1a1918);
    b.part();
    const ring = [];
    for (let i = 0; i <= 32; i++) ring.push({ c: netPoint(spec, (i % 32) / 32, 0.72, hc, lift + 0.003), rx: 0.004, rz: 0.0016 });
    b.tube(ring, { seg: 4, side: [0, 1, 0] });
  }
  if (scrim) {
    // Burlap strips tied into the net: short tufts lying on the dome.
    b.material(CELL.burlap);
    b.paint(0xbcbcbc);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const u = hash1(seed * 7 + i * 3.1),
        v = 0.15 + 0.75 * hash1(seed * 13 + i * 5.7);
      const dirU = (hash1(i * 9.3 + seed) - 0.5) * 0.12;
      const len = 0.04 + 0.04 * hash1(i * 2.2 + seed);
      const pts = [];
      for (let k = 0; k <= 3; k++) {
        const vv = Math.min(1.05, v + (k / 3) * len * 3);
        pts.push(netPoint(spec, (((u + dirU * k) % 1) + 1) % 1, vv, hc, lift + 0.004 + 0.002 * k));
      }
      // Ends hang off the rim a little.
      if (v + len * 3 > 1) pts[3].y -= 0.01;
      b.part(false);
      b.strap(pts, 0.012 + 0.008 * hash1(i * 4.4), 0.0014, (p) => p.clone().sub(hc).normalize(), { flat: true });
    }
  }
}
function netPoint(spec, u, v, hc, lift) {
  const p = helmetPoint(spec, u, Math.min(1, v), new THREE.Vector3());
  const n = p.clone().sub(hc).normalize();
  return p.addScaledVector(n, lift);
}

// ---------------------------------------------------------------------------
// Soft headgear.
// Head surface approximated for caps: an ellipsoid around the skull.
function skull(th, y, out, pad = 0) {
  // th: azimuth (0 front), y relative to the head center.
  const rx = 0.0775 + pad,
    rzF = 0.093 + pad,
    rzB = 0.107 + pad,
    top = 0.1225 + pad;
  const t = Math.min(1, Math.max(-1, (y - 0.01) / (top - 0.01)));
  const k = Math.sqrt(Math.max(0, 1 - Math.max(0, t) ** 2));
  const c = Math.cos(th);
  const rz = c > 0 ? rzF : rzB;
  out.set(Math.sin(th) * rx * k, y, -c * rz * k - 0.002);
  return out.add(HC);
}

// Side cap: Soviet pilotka or German M40 Feldmütze (Schiffchen). A boat-shaped
// crown over a folded curtain, worn tilted to the right.
export function buildSideCap(b, st, { lod = 0, color, badge = 'star', tilt = 0.12, german = false } = {}) {
  b.bones(rigid(B.head));
  b.material(CELL.wool);
  b.paint(color);
  b.part();
  const nu = [24, 12, 6][lod];
  const us = [];
  for (let i = 0; i <= nu; i++) us.push(i / nu);
  const rows = [0, 0.3, 0.6, 0.85, 1.0];
  const rot = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -tilt);
  const lean = (p) => p.sub(HC).applyQuaternion(rot).add(HC);
  // Band (curtain) around the head from y = +0.05 (front) .. +0.035 (sides)
  // to the crown ridge 7-8 cm above it, pinched along the top.
  b.grid(
    us,
    rows,
    (u, v, o) => {
      const th = u * 2 * PI;
      const c = Math.cos(th);
      const yb = 0.052 + 0.012 * Math.abs(c) - (german && c > 0.9 ? 0.012 * (c - 0.9) * 10 : 0);
      if (v < 0.5) {
        // Curtain: hugs the head.
        skull(th, yb + v * 0.06, o, 0.004 + 0.002 * v);
      } else {
        // Crown: folded up to a narrow top running front to back (a side cap
        // stands ~8 cm high at its front and back points, est.).
        const w = (v - 0.5) / 0.5;
        const y = yb + 0.03 + w * (0.022 + 0.012 * Math.abs(c));
        skull(th, yb + 0.03, o, 0.006);
        const ridge = 1 - w * 0.62;
        o.x = HC.x + (o.x - HC.x) * ridge;
        o.y = HC.y + y;
        o.z = HC.z + (o.z - HC.z) * (1 - w * 0.05);
      }
      lean(o);
    },
    { center: HC.clone().add(V(0, 0.09, 0)), wrapU: true },
  );
  if (lod) return;
  // Badge: red enamel star (Soviet) or eagle and cockade (German).
  const front = lean(skull(0, 0.075, new THREE.Vector3(), 0.0075));
  const n = front.clone().sub(HC).setY(0).normalize();
  b.part(false);
  if (badge === 'star') {
    b.material(CELL.metal, 0.6);
    b.paint(0xa02a20);
    starDecal(b, front.addScaledVector(n, 0.0012), n, 0.024);
  } else {
    b.material(CELL.metal);
    b.paint(0x8a8a80);
    b.box(front.clone().addScaledVector(n, 0.001).add(V(0, 0.016, 0)), [0.035, 0.01, 0.002], { r: 0.0008, quat: new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), n) });
    b.paint(0x1c1c1c);
    b.ellipsoid(front.clone().addScaledVector(n, 0.001).add(V(0, -0.004, 0)), [0.006, 0.006, 0.002], { nu: 8, nv: 3 });
    b.paint(0xd8d8d0);
    b.ellipsoid(front.clone().addScaledVector(n, 0.0016).add(V(0, -0.004, 0)), [0.0035, 0.0035, 0.0015], { nu: 8, nv: 3 });
    b.paint(0x9e2a22);
    b.ellipsoid(front.clone().addScaledVector(n, 0.0021).add(V(0, -0.004, 0)), [0.0017, 0.0017, 0.001], { nu: 6, nv: 3 });
  }
}

// German M43 Einheitsfeldmütze: crown, short peak, curtain with two buttons.
export function buildFieldCap(b, st, { lod = 0, color }) {
  b.bones(rigid(B.head));
  b.material(CELL.wool);
  b.paint(color);
  b.part();
  const nu = [24, 12, 6][lod];
  const us = [];
  for (let i = 0; i <= nu; i++) us.push(i / nu);
  b.grid(
    us,
    [0, 0.35, 0.7, 0.9, 1.0],
    (u, v, o) => {
      const th = u * 2 * PI;
      const c = Math.cos(th);
      const yb = 0.045 + 0.01 * Math.max(0, -c);
      if (v <= 0.7) skull(th, yb + (v / 0.7) * 0.05, o, 0.005 + 0.004 * (v / 0.7));
      else {
        // Flat-ish top, higher at the front.
        const w = (v - 0.7) / 0.3;
        skull(th, yb + 0.05, o, 0.009);
        o.x = HC.x + (o.x - HC.x) * (1 - w);
        o.z = HC.z + (o.z - HC.z) * (1 - w);
        o.y = HC.y + yb + 0.05 + 0.03 * (1 - w * 0.2) + 0.012 * Math.max(0, c) * (1 - w);
      }
    },
    { center: HC.clone().add(V(0, 0.08, 0)), wrapU: true },
  );
  // Peak.
  b.part();
  const peak = [];
  for (let i = 0; i <= 8; i++) {
    const th = -0.9 + (i / 8) * 1.8;
    peak.push(th);
  }
  b.grid(
    peak,
    [0, 1],
    (th, v, o) => {
      skull(th, 0.047, o, 0.006);
      const n = o.clone().sub(HC).setY(0).normalize();
      o.addScaledVector(n, v * 0.05 * Math.cos(th * 0.8)).add(V(0, -v * 0.012, 0));
    },
    { center: HC.clone().add(V(0, 0.2, 0)) },
  );
  if (lod) return;
  b.material(CELL.metal);
  b.paint(0x7a7a72);
  for (const s of [-1, 1]) b.ellipsoid(skull(s * 0.18, 0.058, new THREE.Vector3(), 0.0095), [0.0055, 0.0055, 0.0055], { nu: 6, nv: 3 });
}

// Tank crew helmets. US M1938 (leather over a fiber shell, ventilation ribs,
// ear flaps with receivers, goggles on the front) and the Soviet shlemofon
// (canvas or leather, padded rolls). kind: 'US' | 'SU'.
export function buildTankHelmet(b, kind, st, { lod = 0, goggles = false, color } = {}) {
  b.bones(rigid(B.head));
  b.material(CELL.leather);
  b.paint(color);
  b.part();
  const nu = [26, 12, 7][lod],
    nv = [10, 5, 3][lod];
  const us = [],
    vs = [];
  for (let i = 0; i <= nu; i++) us.push(i / nu);
  for (let j = 0; j <= nv; j++) vs.push(j / nv);
  const lowSide = kind === 'SU' ? -0.07 : -0.055;
  b.grid(
    us,
    vs,
    (u, v, o) => {
      const th = u * 2 * PI;
      const c = Math.cos(th);
      // Edge: forehead in front, down over the ears at the sides, nape at the back.
      const side = Math.abs(Math.sin(th));
      const edge = c > 0 ? lerp(0.055, lowSide, Math.pow(side, 2.5)) : lerp(-0.035, lowSide, Math.pow(side, 1.5));
      const y = lerp(0.1225, edge, Math.pow(v, 1.2));
      let pad = 0.012;
      // Padded rolls (US: ventilation ribs) running front to back over the top.
      const ribs = kind === 'SU' ? 3 : 5;
      const lat = Math.sin(th);
      pad += (kind === 'SU' ? 0.009 : 0.0045) * Math.pow(Math.abs(Math.cos(lat * ribs * PI * 0.5)), 4) * smooth01(0.04, 0.09, y);
      // Ear flaps bulge over the ears (receivers).
      pad += 0.012 * Math.exp(-(((side - 1) / 0.12) ** 2)) * Math.exp(-(((y + 0.012) / 0.03) ** 2));
      skull(th, y, o, pad);
    },
    { center: HC.clone().add(V(0, 0.03, 0)), wrapU: true },
  );
  if (lod) return;
  // Front roll / brow pad.
  b.part();
  const ring = [];
  for (let i = 0; i <= 16; i++) {
    const th = -1.2 + (i / 16) * 2.4;
    ring.push({ c: skull(th, 0.06, new THREE.Vector3(), 0.016), rx: kind === 'SU' ? 0.011 : 0.007, rz: kind === 'SU' ? 0.011 : 0.007 });
  }
  b.tube(ring, { seg: 8, side: [0, 1, 0], capStart: 0.8, capEnd: 0.8 });
  // Chin strap.
  b.paint(new THREE.Color(color).multiplyScalar(0.8));
  b.part();
  for (const s of [-1, 1]) b.strap([V(s * 0.08, -0.06, 0.0), V(s * 0.065, -0.09, -0.03), V(s * 0.04, -0.115, -0.048), V(0, -0.125, -0.05)].map((p) => p.add(HC)), 0.016, 0.002, (p) => p.clone().sub(HC).normalize());
  if (goggles) {
    // M1944 goggles: rubber frame with a one-piece lens, on the helmet front.
    b.material(CELL.leather);
    b.paint(0x2a2826);
    b.part();
    const gy = 0.085;
    const lens = [];
    for (let i = 0; i <= 14; i++) {
      const th = -0.75 + (i / 14) * 1.5;
      lens.push({ c: skull(th, gy, new THREE.Vector3(), 0.024), rx: 0.016, rz: 0.009 });
    }
    b.tube(lens, { seg: 8, side: [0, 1, 0], capStart: 0.6, capEnd: 0.6 });
    b.material(CELL.metal, 1);
    b.paint(0x2a3436);
    b.part(false);
    const glass = [];
    for (let i = 0; i <= 12; i++) {
      const th = -0.62 + (i / 12) * 1.24;
      glass.push({ c: skull(th, gy, new THREE.Vector3(), 0.031), rx: 0.011, rz: 0.003 });
    }
    b.tube(glass, { seg: 6, side: [0, 1, 0] });
    // Strap around the back.
    b.material(CELL.webbing);
    b.paint(0x5b5440);
    b.part();
    const strap = [];
    for (let i = 0; i <= 16; i++) strap.push(skull(0.75 + (i / 16) * (2 * PI - 1.5), gy - 0.004, new THREE.Vector3(), 0.0205));
    b.strap(strap, 0.02, 0.002, (p) => p.clone().sub(HC).setY(0).normalize());
  }
}

// ---------------------------------------------------------------------------
// Equipment items. Each takes a frame on the body (see torsoFrame) and builds
// the item hanging from it; geometry is rigid with the body weights there.

// Generic pouch: body box, a flap over the top front, and a fastener
// ('snap' lift-the-dot, 'strap' leather tab and buckle, 'button', 'none').
export function pouch(b, f, { w, h, d, flap = 0.5, color, flapColor = null, fastener = 'snap', cell = CELL.webbing, lod = 0, r = 0.006, rounded = 0, metal = 0x56544c } = {}) {
  b.bones(rigidAt(f));
  b.material(cell);
  b.paint(color);
  b.part();
  f.box(b, 0, -h / 2, d / 2, w, h, d, { r: Math.max(r, rounded), seg: [8, 3] });
  if (lod) return;
  // Flap: a slightly wider shell over the top and down the front.
  if (flap) {
    b.paint(flapColor ?? color);
    b.part();
    const fh = h * flap;
    f.box(b, 0, -fh / 2 + 0.002, d / 2 + 0.002, w + 0.004, fh + 0.006, d + 0.005, { r: 0.004, seg: [8, 3] });
    if (fastener === 'snap') {
      b.material(CELL.metal);
      b.paint(metal);
      f.cyl(b, [0, -fh + 0.008, d + 0.004], [0, -fh + 0.008, d + 0.0065], 0.0045, 0.004, { seg: 6 });
    } else if (fastener === 'strap') {
      b.material(CELL.leather);
      b.paint(flapColor ?? color);
      f.box(b, 0, -fh - 0.008, d + 0.004, 0.014, 0.03, 0.003, { r: 0.0015 });
      b.material(CELL.metal);
      b.paint(metal);
      f.box(b, 0, -fh - 0.018, d + 0.006, 0.016, 0.012, 0.002, { r: 0.001 });
    } else if (fastener === 'button') {
      b.material(CELL.metal);
      b.paint(metal);
      f.ell(b, 0, -fh + 0.007, d + 0.0045, 0.006, 0.006, 0.0028, { nu: 8, nv: 3 });
    }
    b.material(cell);
  }
}

// Buckle or plate on a belt (frame on the belt surface).
export function buckle(b, f, { w = 0.05, h = 0.045, color = 0x6e6e66, frame = false, lod = 0, star = false } = {}) {
  b.bones(rigidAt(f));
  b.material(CELL.metal);
  b.paint(color);
  b.part();
  if (frame && !lod) {
    // Open frame buckle with a tongue.
    const t = 0.005;
    f.box(b, 0, h / 2 - t / 2, 0.003, w, t, 0.004, { r: 0.0015 });
    f.box(b, 0, -h / 2 + t / 2, 0.003, w, t, 0.004, { r: 0.0015 });
    f.box(b, -w / 2 + t / 2, 0, 0.003, t, h, 0.004, { r: 0.0015 });
    f.box(b, w / 2 - t / 2, 0, 0.003, t, h, 0.004, { r: 0.0015 });
    f.box(b, 0, 0, 0.0035, 0.004, h - 2 * t, 0.003, { r: 0.001 });
  } else {
    f.box(b, 0, 0, 0.003, w, h, 0.005, { r: 0.002 });
    if (star && !lod) {
      b.paint(new THREE.Color(color).multiplyScalar(0.8));
      starDecal(b, f.point(0, 0, 0.0058), f.dir(0, 0, 1), h * 0.8);
    }
  }
}

// US M1910 canteen in its cover (khaki duck, two lift-the-dot flaps) on the
// M1910 hanger; 0.95 l aluminum canteen with nested cup, 19 x 14 x 8 cm in the cover.
export function canteenUS(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.duck);
  b.paint(st.canteen ?? 0x857a58);
  b.part();
  f.box(b, 0, -0.1, 0.04, 0.14, 0.19, 0.08, { r: 0.03, seg: lod ? null : [12, 6] });
  if (lod) return;
  // Flaps and snaps.
  b.part();
  for (const s of [-1, 1]) {
    f.box(b, s * 0.034, -0.03, 0.0805, 0.062, 0.05, 0.004, { r: 0.004, rot: [0.08, 0, 0] });
    b.material(CELL.metal);
    b.paint(0x4c4a42);
    f.cyl(b, [s * 0.034, -0.048, 0.082], [s * 0.034, -0.048, 0.085], 0.004, 0.0036, { seg: 8 });
    b.material(CELL.duck);
    b.paint(st.canteen ?? 0x857a58);
  }
  // Binding seam down the edges.
  b.paint(new THREE.Color(st.canteen ?? 0x857a58).multiplyScalar(0.8));
  f.box(b, 0, -0.195, 0.04, 0.12, 0.008, 0.074, { r: 0.004 });
  // Hanger.
  b.material(CELL.metal);
  b.paint(0x3e3d38);
  f.box(b, 0, 0.004, 0.012, 0.05, 0.016, 0.004, { r: 0.0015 });
}

// German M31 Feldflasche: aluminum bottle in a brown felt cover with a leather
// strap, black-painted cup on top. ~0.8 l, 22 cm with the cup, 12 x 7 cm.
export function canteenGE(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.wool);
  b.paint(st.felt ?? 0x5e4632);
  b.part();
  f.box(b, 0, -0.105, 0.035, 0.115, 0.165, 0.07, { r: 0.03, seg: lod ? null : [12, 6] });
  b.material(CELL.paint);
  b.paint(0x1e1d1b);
  b.part();
  f.box(b, 0, -0.02, 0.036, 0.1, 0.045, 0.07, { r: 0.012 });
  if (lod) return;
  b.material(CELL.leather);
  b.paint(st.leather ?? 0x1e1b18);
  b.part();
  f.box(b, 0, -0.08, 0.0725, 0.018, 0.2, 0.004, { r: 0.0015 });
  b.material(CELL.metal);
  b.paint(0x5a5a54);
  f.box(b, 0, -0.03, 0.0745, 0.022, 0.016, 0.003, { r: 0.001 });
}

// Soviet canteen (glass or aluminum, 0.75 l) in a khaki cloth cover.
export function canteenSU(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.duck);
  b.paint(st.canteen ?? 0x6e6a4c);
  b.part();
  f.box(b, 0, -0.1, 0.04, 0.12, 0.17, 0.07, { r: 0.034, seg: lod ? null : [12, 6] });
  if (lod) return;
  b.material(CELL.metal);
  b.paint(0x5a5850);
  f.cyl(b, [0, -0.012, 0.04], [0, 0.012, 0.04], 0.012, 0.011, { seg: 8 });
}

// US first aid pouch (M1942): 11 x 9 x 4.5 cm with a lift-the-dot flap.
export function firstAidUS(b, f, st, lod) {
  pouch(b, f, { w: 0.09, h: 0.11, d: 0.045, flap: 0.45, color: st.web, lod, r: 0.008 });
}

// Entrenching tools in their carriers.
// US M1943 folding shovel: carrier 25 x 19 x 6 cm, handle up.
export function shovelUS(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.duck);
  b.paint(st.web);
  b.part();
  f.box(b, 0, -0.13, 0.03, 0.17, 0.2, 0.06, { r: 0.012 });
  if (lod) return;
  // Handle sticking up out of the carrier (wood, OD painted).
  b.material(CELL.paint);
  b.paint(0x3c3a2a);
  f.cyl(b, [0, -0.03, 0.03], [0, 0.17, 0.03], 0.016, 0.017, { seg: 8 });
  f.box(b, 0, 0.18, 0.03, 0.04, 0.03, 0.035, { r: 0.012 });
  b.material(CELL.metal);
  b.paint(0x3a3a34);
  f.box(b, 0, -0.035, 0.03, 0.04, 0.02, 0.036, { r: 0.004 });
}
// German short spade in a leather carrier, blade down; ~55 cm overall.
export function spadeGE(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.leather);
  b.paint(st.leather);
  b.part();
  f.box(b, 0, -0.1, 0.022, 0.16, 0.19, 0.03, { r: 0.012 });
  if (lod) return;
  // Wooden handle up to the belt.
  b.material(CELL.paint);
  b.paint(0x5a4630);
  f.cyl(b, [0, -0.0, 0.025], [0, 0.17, 0.03], 0.015, 0.016, { seg: 8 });
  b.material(CELL.leather);
  b.paint(st.leather);
  f.box(b, 0, 0.015, 0.03, 0.03, 0.04, 0.03, { r: 0.006 });
}
// Soviet MPL-50 small infantry shovel in a canvas cover.
export function shovelSU(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.duck);
  b.paint(st.pouchCloth ?? 0x6e6648);
  b.part();
  f.box(b, 0, -0.12, 0.02, 0.15, 0.19, 0.025, { r: 0.012 });
  if (lod) return;
  b.material(CELL.paint);
  b.paint(0x6a5238);
  f.cyl(b, [0, -0.02, 0.02], [0.0, 0.2, 0.03], 0.014, 0.015, { seg: 8 });
}

// Bayonet in its scabbard hanging along the hip (frame: top of the frog).
export function bayonet(b, f, { len = 0.3, color = 0x23231f, grip = 0x3a2a1a, lod = 0, tilt = 0.12, frog = null } = {}) {
  b.bones(rigidAt(f));
  const g = f.sub(0, 0, 0.01, 0, 0, tilt);
  if (frog !== null) {
    b.material(CELL.leather);
    b.paint(frog);
    b.part();
    g.box(b, 0, -0.04, 0.0, 0.035, 0.08, 0.012, { r: 0.004 });
  }
  b.material(CELL.paint);
  b.paint(color);
  b.part();
  g.box(b, 0, -len / 2 - 0.01, 0.012, 0.03, len, 0.016, { r: 0.007, seg: lod ? null : [8, 6] });
  if (lod) return;
  // Hilt sticking out of the top.
  b.material(CELL.leather);
  b.paint(grip);
  g.box(b, 0, 0.055, 0.012, 0.022, 0.1, 0.02, { r: 0.006 });
  b.material(CELL.metal);
  b.paint(0x4a4a44);
  g.box(b, 0, 0.004, 0.012, 0.05, 0.008, 0.016, { r: 0.002 });
  g.ell(b, 0, -len - 0.01, 0.012, 0.016, 0.012, 0.009);
}

// German M31 Brotbeutel: canvas bag 27 x 25 x 8 cm with a large flap and two leather straps.
export function breadBag(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.duck);
  b.paint(st.bag);
  b.part();
  f.box(b, 0, -0.12, 0.04, 0.26, 0.22, 0.075, { r: 0.03, seg: lod ? null : [12, 6] });
  if (lod) return;
  b.part();
  f.box(b, 0, -0.07, 0.0805, 0.262, 0.15, 0.006, { r: 0.006, rot: [0.03, 0, 0] });
  b.material(CELL.leather);
  b.paint(st.leather);
  for (const s of [-1, 1]) {
    f.box(b, s * 0.075, -0.1, 0.085, 0.016, 0.08, 0.003, { r: 0.0012 });
    b.material(CELL.metal);
    b.paint(0x5a5a52);
    f.box(b, s * 0.075, -0.135, 0.087, 0.018, 0.014, 0.002, { r: 0.001 });
    b.material(CELL.leather);
    b.paint(st.leather);
  }
}

// German M38 gas mask can: fluted steel cylinder 27 cm x 11 cm on its strap.
export function gasMaskCan(b, f, st, lod, { cape = true } = {}) {
  b.bones(rigidAt(f));
  b.material(CELL.paint);
  b.paint(st.can);
  b.part();
  const axis = f.dir(-0.25, -0.96, 0.0).normalize();
  const p = f.point(0, -0.13, 0.065);
  const a = p.clone().addScaledVector(axis, -0.135),
    c = p.clone().addScaledVector(axis, 0.135);
  const rings = [];
  const n = lod ? 3 : 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const rib = !lod && i % 2 === 1 && i > 2 && i < n - 1 ? 0.0035 : 0;
    rings.push({ c: a.clone().lerp(c, t), rx: 0.054 + rib, rz: 0.054 + rib });
  }
  b.tube(rings, { seg: lod ? 6 : 12, capStart: 0.12, capEnd: 0.12, side: [1, 0, 0] });
  if (lod) return;
  // Lid band and clasp.
  b.part();
  b.tube([{ c: a.clone().addScaledVector(axis, 0.03), rx: 0.0575, rz: 0.0575 }, { c: a.clone().addScaledVector(axis, 0.045), rx: 0.0575, rz: 0.0575 }], { seg: 12 });
  if (cape) {
    // Gas cape bag strapped to the can (rubberized cloth, darker).
    b.material(CELL.duck);
    b.paint(new THREE.Color(st.can).multiplyScalar(0.8));
    b.part();
    const cp = p.clone().addScaledVector(f.dir(0, 0, 1), 0.058);
    b.box(cp, [0.1, 0.17, 0.035], { quat: f.q.clone().premultiply(new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), axis)), r: 0.012 });
  }
}

// German M31 mess tin (field grey painted aluminum, kidney shaped).
export function messTin(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.paint);
  b.paint(st.messTin ?? 0x4e5246);
  b.part();
  f.box(b, 0, -0.08, 0.055, 0.17, 0.14, 0.1, { r: 0.04, seg: lod ? null : [12, 6] });
  if (lod) return;
  b.material(CELL.leather);
  b.paint(st.leather);
  f.box(b, 0, -0.08, 0.106, 0.016, 0.16, 0.003, { r: 0.001 });
}

// Pack on the back (US M1928 haversack rolled, musette bag, veshmeshok). The
// frame is on the upper back facing backward.
export function backpack(b, f, { w, h, d, color, cell = CELL.duck, lod = 0, round = 0.04, flap = true, straps = null, strapColor = null } = {}) {
  b.bones(rigidAt(f));
  b.material(cell);
  b.paint(color);
  b.part();
  f.box(b, 0, -h / 2, d / 2, w, h, d, { r: round, seg: lod ? null : [12, 8] });
  if (lod) return;
  if (flap) {
    b.part();
    f.box(b, 0, -h * 0.25, d + 0.003, w * 0.96, h * 0.55, 0.006, { r: 0.01, rot: [0.04, 0, 0] });
  }
  if (straps) {
    b.material(CELL.webbing);
    b.paint(strapColor ?? color);
    for (const x of straps) f.box(b, x, -h * 0.5, d + 0.007, 0.022, h * 0.95, 0.004, { r: 0.0015 });
  }
}

// Soviet veshmeshok: a drawstring sack carried on the back with its rope
// loop over the shoulders.
export function veshmeshok(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.duck);
  b.paint(st.bag);
  b.part();
  f.ell(b, 0, -0.2, 0.07, 0.15, 0.15, 0.075, { nu: lod ? 6 : 14, nv: lod ? 4 : 9 });
  if (lod) return;
  // Gathered neck and tie.
  f.ell(b, 0, -0.04, 0.05, 0.05, 0.035, 0.035, { nu: 10, nv: 6 });
  b.paint(new THREE.Color(st.bag).multiplyScalar(0.75));
  f.cyl(b, [0, -0.07, 0.05], [0, -0.06, 0.05], 0.045, 0.045, { seg: 10 });
}

// Soviet skatka: the greatcoat rolled into a horseshoe over the left shoulder,
// ends tied at the right hip. g: garment (to lie on).
export function skatka(b, g, st, lod) {
  const R = 0.048;
  const cps = [
    { t: PI, y: 1.478 },
    { x: -0.07, y: 1.4, side: -1 },
    { x: 0.02, y: 1.29, side: -1 },
    { x: 0.1, y: 1.17, side: -1 },
    { t: -0.25, y: 1.08 },
    { t: 0.05, y: 1.06 },
    { t: 0.35, y: 1.08 },
    { x: 0.1, y: 1.17, side: 1 },
    { x: 0.02, y: 1.29, side: 1 },
    { x: -0.07, y: 1.4, side: 1 },
    { t: PI - 0.01, y: 1.478 },
  ];
  const path = torsoPath(g, cps, R * 0.85 + 0.008, lod ? 0.12 : 0.04);
  b.bones(torsoWeights);
  b.material(CELL.wool);
  b.paint(st.roll);
  b.part();
  const rings = path.map((q) => {
    const n = torsoNormal(q.t, q.y, new THREE.Vector3());
    return { c: q.p, rx: R * 0.85, rz: R, side: [n.x, n.y, n.z] };
  });
  b.tube(rings, {
    seg: [12, 6, 5][lod],
    capStart: 0.6,
    capEnd: 0.6,
    disp: lod
      ? null
      : (k, a) => {
          // The rolled layers show as a slight spiral.
          const ph = k * 0.9 + a / (2 * PI);
          return 0.002 * (ph - Math.floor(ph));
        },
  });
  if (lod) return;
  b.material(CELL.leather);
  b.paint(st.rollTie ?? 0x3e3426);
  for (const k of [0.2, 0.5, 0.8]) {
    const i = Math.floor(k * (path.length - 1));
    const q = path[i];
    const n = torsoNormal(q.t, q.y, new THREE.Vector3());
    const nx = path[i + 1].p.clone().sub(q.p).normalize();
    b.part();
    b.tube(
      [
        { c: q.p.clone().addScaledVector(nx, -0.007), rx: R * 0.85 + 0.003, rz: R + 0.003, side: [n.x, n.y, n.z] },
        { c: q.p.clone().addScaledVector(nx, 0.007), rx: R * 0.85 + 0.003, rz: R + 0.003, side: [n.x, n.y, n.z] },
      ],
      { seg: 12 },
    );
  }
}

// Cloth bandolier over one shoulder (US six-pocket M1 rifle bandolier) or a
// Fallschirmjäger 12-pocket bandolier around the neck (both ends at the front).
export function bandolier(b, g, st, { lod = 0, kind = 'US', color }) {
  const cps =
    kind === 'FJ'
      ? [
          { x: -0.11, y: 1.0, side: -1 },
          { x: -0.09, y: 1.2, side: -1 },
          { x: -0.06, y: 1.42, side: -1 },
          { t: PI * 0.62, y: 1.49 },
          { t: PI * 0.38, y: 1.49 },
          { x: 0.06, y: 1.42, side: -1 },
          { x: 0.09, y: 1.2, side: -1 },
          { x: 0.11, y: 1.0, side: -1 },
        ]
      : [
          { t: PI - 0.1, y: 1.46 },
          { x: -0.08, y: 1.38, side: -1 },
          { x: 0.05, y: 1.22, side: -1 },
          { x: 0.15, y: 1.06, side: -1 },
          { t: 0.4, y: 1.02 },
          { x: 0.05, y: 1.22, side: 1 },
          { x: -0.06, y: 1.4, side: 1 },
          { t: PI - 0.1, y: 1.46 },
        ];
  b.material(CELL.cotton);
  b.paint(color);
  const path = torsoStrap(b, g, cps, 0.05, 0.004, { out: 0.006, lod });
  if (lod) return;
  // Pockets along the front run.
  const front = path.filter((q) => Math.sin(q.t) < -0.2 && q.y < 1.42 && q.y > 1.0);
  const nPk = kind === 'FJ' ? 6 : 3;
  for (let i = 0; i < nPk; i++) {
    const q = front[Math.floor(((i + 0.5) / nPk) * front.length)];
    if (!q) continue;
    const f = torsoFrame(g, q.t, q.y, 0.008, { plumb: false });
    pouch(b, f.sub(0, 0.03, 0), { w: kind === 'FJ' ? 0.045 : 0.06, h: 0.06, d: 0.022, flap: 0.4, color, cell: CELL.cotton, fastener: 'snap', lod, r: 0.005 });
    if (kind === 'FJ') pouch(b, f.sub(0, 0.03, 0), { w: 0.045, h: 0.06, d: 0.022, flap: 0.4, color, cell: CELL.cotton, fastener: 'snap', lod, r: 0.005 });
  }
}

// Leather holster on the belt (pistol butt up, flap closed).
export function holster(b, f, { color, lod = 0, kind = 'US' } = {}) {
  b.bones(rigidAt(f));
  b.material(CELL.leather);
  b.paint(color);
  b.part();
  const len = kind === 'US' ? 0.22 : 0.17;
  const g = f.sub(0, 0, 0, 0, 0, kind === 'US' ? 0.15 : 0.05);
  g.box(b, 0, -len / 2, 0.022, 0.065, len, 0.035, { r: 0.012 });
  if (lod) return;
  g.box(b, 0, -0.035, 0.041, 0.07, 0.07, 0.006, { r: 0.006 });
  b.material(CELL.metal);
  b.paint(0x5a5850);
  g.cyl(b, [0, -0.06, 0.044], [0, -0.06, 0.047], 0.005, 0.0045, { seg: 8 });
}

// Binocular case (German 6x30 in black bakelite / leather; US M17 canvas-leather).
export function binocularCase(b, f, { color, lod = 0 } = {}) {
  b.bones(rigidAt(f));
  b.material(CELL.leather);
  b.paint(color);
  b.part();
  f.box(b, 0, -0.07, 0.035, 0.12, 0.13, 0.065, { r: 0.018 });
  if (lod) return;
  f.box(b, 0, -0.012, 0.035, 0.124, 0.025, 0.069, { r: 0.008 });
}

// A slim knife in a scabbard (US M3 trench knife in the M6 leather scabbard,
// Soviet NR-40), strapped to the leg or the belt.
export function knife(b, bone, a, c, { color = 0x4a3020, lod = 0 } = {}) {
  b.bones(typeof bone === 'number' ? rigid(bone) : bone);
  b.material(CELL.leather);
  b.paint(color);
  b.part();
  b.cylinder(a, c, 0.014, 0.008, { seg: lod ? 5 : 8 });
  if (lod) return;
  b.material(CELL.leather);
  b.paint(0x2e2018);
  const d = new THREE.Vector3(...a).sub(new THREE.Vector3(...c)).normalize();
  const top = new THREE.Vector3(...a);
  b.cylinder(top.toArray(), top.clone().addScaledVector(d, 0.11).toArray(), 0.012, 0.011, { seg: 8 });
}

// Magazine pouches: German MP40 three-cell canvas pouch (each cell takes one
// 32-round magazine), US Thompson three-cell 30-round pouch, Soviet PPSh drum pouch.
export function magPouch(b, f, { kind = 'MP40', color, lod = 0, metal = 0x56544c }) {
  if (kind === 'drum') {
    b.bones(rigidAt(f));
    b.material(CELL.duck);
    b.paint(color);
    b.part();
    f.cyl(b, [0, -0.1, 0.0], [0, -0.1, 0.05], 0.11, 0.11, { seg: lod ? 8 : 18 });
    if (!lod) {
      f.box(b, 0, -0.025, 0.05, 0.12, 0.05, 0.006, { r: 0.004 });
      b.material(CELL.metal);
      b.paint(metal);
      f.cyl(b, [0, -0.04, 0.053], [0, -0.04, 0.056], 0.004, 0.004, { seg: 8 });
    }
    return;
  }
  const cells = 3;
  const cw = kind === 'MP40' ? 0.042 : 0.045;
  const h = kind === 'MP40' ? 0.2 : 0.21;
  if (lod) return pouch(b, f, { w: cw * cells, h, d: 0.035, color, lod, cell: CELL.duck });
  for (let i = 0; i < cells; i++) {
    const g = f.sub((i - 1) * cw, 0, 0);
    pouch(b, g, { w: cw - 0.002, h, d: 0.034, flap: 0.22, color, cell: CELL.duck, fastener: kind === 'MP40' ? 'strap' : 'snap', lod, r: 0.006, metal });
  }
}

// German K98 cartridge pouches (M1911): three joined leather pockets, each
// for two 5-round clips; 20 x 10 x 4 cm overall.
export function k98Pouches(b, f, st, lod) {
  if (lod) {
    pouch(b, f, { w: 0.2, h: 0.1, d: 0.042, color: st.leather, cell: CELL.leather, lod });
    return;
  }
  for (let i = 0; i < 3; i++) {
    const g = f.sub((i - 1) * 0.066, 0, 0);
    b.bones(rigidAt(g));
    b.material(CELL.leather);
    b.paint(st.leather);
    b.part();
    g.box(b, 0, -0.05, 0.02, 0.06, 0.09, 0.04, { r: 0.008 });
    // Domed flap over the top, buttoned underneath by a strap.
    b.part();
    g.box(b, 0, -0.004, 0.022, 0.064, 0.012, 0.046, { r: 0.006 });
    g.box(b, 0, -0.03, 0.043, 0.064, 0.05, 0.005, { r: 0.003 });
    g.box(b, 0, -0.07, 0.044, 0.012, 0.045, 0.003, { r: 0.001 });
    b.material(CELL.metal);
    b.paint(0x4a4a44);
    g.ell(b, 0, -0.088, 0.045, 0.004, 0.004, 0.002, { nu: 6, nv: 3 });
  }
  // D-ring for the Y-strap hook.
  b.material(CELL.metal);
  b.paint(0x55554e);
  f.box(b, 0.066, 0.012, 0.03, 0.016, 0.014, 0.003, { r: 0.002 });
}

// Soviet two-cell Mosin cartridge pouch (leather or kirza): 15 x 10 x 4.5 cm.
export function mosinPouch(b, f, st, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.leather);
  b.paint(st.pouch);
  b.part();
  f.box(b, 0, -0.05, 0.022, 0.13, 0.095, 0.044, { r: 0.008 });
  if (lod) return;
  b.part();
  f.box(b, 0, -0.004, 0.024, 0.134, 0.012, 0.05, { r: 0.005 });
  for (const s of [-1, 1]) {
    f.box(b, s * 0.032, -0.03, 0.047, 0.062, 0.05, 0.005, { r: 0.003 });
    b.material(CELL.metal);
    b.paint(0x5a564a);
    f.ell(b, s * 0.032, -0.05, 0.05, 0.004, 0.004, 0.002, { nu: 6, nv: 3 });
    b.material(CELL.leather);
    b.paint(st.pouch);
  }
}

// Grenades: a German M24 stick grenade tucked behind the belt, or a Soviet
// grenade pouch.
export function stickGrenade(b, f, lod) {
  b.bones(rigidAt(f));
  b.material(CELL.paint);
  b.paint(0x4c4f44);
  b.part();
  f.cyl(b, [0, 0.09, 0.03], [0, 0.16, 0.03], 0.03, 0.03, { seg: lod ? 6 : 12 });
  if (lod) return;
  b.material(CELL.leather);
  b.paint(0x7a5a38);
  f.cyl(b, [0, -0.14, 0.022], [0, 0.09, 0.03], 0.013, 0.013, { seg: 8 });
  b.material(CELL.metal);
  b.paint(0x5a5a54);
  f.cyl(b, [0, -0.15, 0.022], [0, -0.13, 0.022], 0.015, 0.015, { seg: 8 });
}
