// The person under the uniform: head and face (skull, brow, eye sockets,
// eyes and lids, nose, cheekbones, lips, chin, jaw, ears, hair, stubble), neck,
// hands with jointed fingers and, for rolled sleeves, forearms. Shapes vary by
// a seeded set of person parameters (personParams in soldierKit.js).
//
// Head sizes (US Army 1946 survey, means; est. where not listed): head length
// 196 mm, breadth 153 mm, chin to vertex 232 mm, bizygomatic breadth 140 mm,
// bigonial breadth 110 mm, ear length 63 mm, nose 52 x 35 mm.
import * as THREE from 'three';
import { B, BIND, HEAD_CENTER, HAND_JOINTS, FINGER_NAMES, FINGER_BONES, handPoint } from './soldierRig.js';
import { smooth01, setN, rigid } from './soldierGeo.js';
import { CELL } from './soldierMaterials.js';
import { interpRows, lerp, noise3, chainPoint, armChain } from './soldierBody.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const se = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);
const g2 = (dx, dy, rx, ry) => Math.exp(-(dx * dx) / (rx * rx) - (dy * dy) / (ry * ry));
const sstep = (a, b, x) => smooth01(a, b, x);
const HC = HEAD_CENTER;

// Head rows relative to HEAD_CENTER: [y, halfWidth, zFront (midline, before
// features), zBack].
const HEAD_ROWS = [
  [-0.124, 0.006, -0.06, -0.03],
  [-0.119, 0.03, -0.074, -0.012],
  [-0.11, 0.044, -0.083, 0.008],
  [-0.098, 0.052, -0.087, 0.028],
  [-0.083, 0.058, -0.089, 0.048],
  [-0.065, 0.063, -0.09, 0.066],
  [-0.045, 0.067, -0.09, 0.082],
  [-0.025, 0.071, -0.09, 0.094],
  [-0.005, 0.0735, -0.089, 0.101],
  [0.015, 0.0755, -0.091, 0.105],
  [0.035, 0.0765, -0.088, 0.106],
  [0.058, 0.0745, -0.082, 0.104],
  [0.08, 0.068, -0.071, 0.096],
  [0.1, 0.055, -0.055, 0.081],
  [0.113, 0.035, -0.033, 0.057],
  [0.12, 0.012, -0.01, 0.025],
  [0.1225, 0.001, 0.0, 0.006],
];
export const EYE_Y = 0.001; // eye center height relative to HEAD_CENTER
export const EYE_X = 0.0325;
export const EYE_Z = -0.071;
export const EYE_R = 0.0118;

// Face shape from the person parameters (see personParams).
function faceShape(p) {
  const s = p.shape || {};
  return {
    jaw: s.jaw ?? 1,
    chin: s.chin ?? 1,
    width: s.width ?? 1,
    nose: s.nose ?? 1,
    noseW: s.noseW ?? 1,
    noseBridge: s.noseBridge ?? 1, // height of the bridge (low = flatter, Central Asian)
    noseHook: s.noseHook ?? 0, // aquiline (+) / snub (-)
    brow: s.brow ?? 1,
    cheek: s.cheek ?? 1,
    cheekY: s.cheekY ?? 0,
    lips: s.lips ?? 1,
    eyeSize: s.eyeSize ?? 1,
    eyeSpace: s.eyeSpace ?? 1,
    lid: s.lid ?? 0, // upper lid fold (1 = epicanthic)
    lidOpen: s.lidOpen ?? 1,
    length: s.length ?? 1, // face length
    forehead: s.forehead ?? 1,
    earSize: s.earSize ?? 1,
    earOut: s.earOut ?? 1,
    skull: s.skull ?? 1, // head length
    gaunt: s.gaunt ?? 0, // hollow cheeks
  };
}

// Feature offsets toward the front (meters, + = forward) at face point (x, y).
function faceRelief(f, x, y) {
  const ax = Math.abs(x);
  let d = 0;
  // Nose: a rounded ridge from the nasion to the tip, then the columella.
  {
    const ny = y / f.length;
    const prof = interpRows(
      [
        [-0.056, 0.0],
        [-0.049, 0.004],
        [-0.045, 0.014],
        [-0.04, 0.022],
        [-0.034, 0.0245],
        [-0.026, 0.0205],
        [-0.016, 0.0155],
        [-0.006, 0.011],
        [0.004, 0.0065],
        [0.012, 0.0035],
        [0.02, 0.0012],
        [0.028, 0.0],
      ],
      Math.max(-0.056, Math.min(0.028, ny)),
    )[1];
    const hook = f.noseHook * 0.003 * Math.exp(-(((ny + 0.016) / 0.012) ** 2));
    const bridge = lerp(0.55, 1, f.noseBridge) * (ny > -0.03 ? 1 : 1) ;
    const depth = (prof * (ny > -0.026 ? bridge : 1) + hook) * f.nose;
    const hw = interpRows(
      [
        [-0.05, 0.013],
        [-0.042, 0.0175],
        [-0.034, 0.0155],
        [-0.02, 0.0115],
        [0.0, 0.0095],
        [0.02, 0.0095],
      ],
      Math.max(-0.05, Math.min(0.02, ny)),
    )[1] * f.noseW;
    const r = ax / hw;
    if (r < 1.6 && ny > -0.058 && ny < 0.03) d += depth * Math.max(0, 1 - r * r * 0.62) ** 1.4;
    // Nostril wings (alae).
    const ay = ny + 0.04;
    d += 0.0085 * f.nose * g2(ax - 0.0145 * f.noseW, ay, 0.008 * f.noseW, 0.007);
    // The groove round the wings.
    d -= 0.002 * Math.exp(-(((Math.hypot((ax - 0.0145 * f.noseW) / 1.1, ay * 1.2) - 0.0095) / 0.0018) ** 2)) * (ay > -0.006 ? 1 : 0.4);
  }
  // Brow ridge and glabella.
  const bY = y - 0.019;
  d += 0.0068 * f.brow * Math.exp(-((bY / 0.0085) ** 2)) * sstep(0.066, 0.036, ax);
  d += 0.0035 * f.brow * g2(x, y - 0.014, 0.013, 0.01);
  // Eye sockets: deep behind the eyeball (its front pokes out through the lids).
  const es = f.eyeSpace;
  const ex = ax - EYE_X * es,
    ey = y - EYE_Y;
  const sock = g2(ex, ey, 0.019 * f.eyeSize, 0.0125 * f.eyeSize);
  d -= 0.0125 * sock;
  // Soft hollow under the brow, above the lid (deeper set eyes with a lower lid fold).
  d -= 0.003 * (1 - f.lid * 0.7) * g2(ex, y - 0.011, 0.016, 0.005);
  // Cheekbones forward and out; hollow cheeks under them.
  d += 0.0085 * f.cheek * g2(ax - 0.052, y + 0.02 + f.cheekY, 0.019, 0.015);
  d -= 0.004 * f.gaunt * g2(ax - 0.045, y + 0.06, 0.016, 0.018);
  // Upper lip, philtrum, lower lip, mouth line.
  const lip = f.lips;
  d += 0.0045 * lip * g2(x, y + 0.059, 0.022, 0.0075) - 0.0013 * g2(x, y + 0.053, 0.0035, 0.006);
  d += 0.0055 * lip * g2(x, y + 0.0755, 0.019, 0.0062);
  d -= 0.0026 * Math.exp(-(((y + 0.0675) / 0.0014) ** 2)) * sstep(0.026, 0.018, ax);
  // Mentolabial groove and chin.
  d -= 0.0025 * g2(x, y + 0.088, 0.02, 0.005);
  d += 0.008 * f.chin * g2(x, y + 0.104, 0.024, 0.014);
  // Nasolabial folds.
  const nl = Math.abs(ax - (0.019 + (-(y + 0.04)) * 0.38));
  if (y < -0.035 && y > -0.075) d -= 0.0014 * Math.exp(-((nl / 0.003) ** 2)) * sstep(-0.035, -0.045, y);
  // Temples.
  d -= 0.003 * g2(ax - 0.062, y - 0.032, 0.012, 0.02);
  return d;
}

// Angle samples around the head: dense across the face.
function headAngles(lod) {
  if (lod === 2) {
    const a = [];
    for (let i = 0; i <= 8; i++) a.push(-PI + (i / 8) * 2 * PI);
    return a;
  }
  if (lod === 1) {
    const a = [];
    for (let i = 0; i <= 14; i++) a.push(-PI + (i / 14) * 2 * PI);
    return a;
  }
  const a = [];
  const add = (t0, t1, n) => {
    for (let i = 0; i < n; i++) a.push(t0 + ((t1 - t0) * i) / n);
  };
  add(-PI, -1.0, 7);
  add(-1.0, -0.32, 9);
  add(-0.32, 0.32, 18);
  add(0.32, 1.0, 9);
  add(1.0, PI, 7);
  a.push(PI);
  return a;
}
// Rows: close together at the lips, nose tip and eyes.
function headRows(lod, cutTop) {
  const ys = [];
  if (lod === 2) {
    for (let i = 0; i <= 5; i++) ys.push(-0.124 + (i / 5) * 0.2465);
    return ys;
  }
  if (lod === 1) {
    for (let i = 0; i <= 9; i++) ys.push(-0.124 + (i / 9) * 0.2465);
    return ys;
  }
  const add = (y0, y1, n) => {
    for (let i = 0; i < n; i++) ys.push(y0 + ((y1 - y0) * i) / n);
  };
  add(-0.124, -0.11, 2);
  add(-0.11, -0.084, 4);
  add(-0.084, -0.05, 10);
  add(-0.05, -0.016, 7);
  add(-0.016, 0.03, 11);
  add(0.03, 0.1225, cutTop ? 4 : 7);
  ys.push(0.1225);
  return ys;
}

// A point of the head surface; th: angle from the front (+ = toward +X).
const _hr = [0, 0, 0, 0];
export function headPoint(f, th, y, out) {
  const rows = HEAD_ROWS;
  const yl = y;
  interpRows(rows, yl, _hr);
  const a0 = _hr[1],
    zf0 = _hr[2],
    zb0 = _hr[3];
  const jaw = yl < -0.045 ? lerp(1, f.jaw, smooth01(-0.045, -0.085, yl)) : 1;
  // Broad cheekbones widen the face around their height.
  const a = a0 * jaw * f.width * (1 + (f.cheek - 1) * 0.3 * Math.exp(-(((yl + 0.018) / 0.022) ** 2)));
  const zf = zf0 * (yl < -0.07 ? lerp(1, f.chin, smooth01(-0.07, -0.1, yl)) : 1);
  const zb = zb0 * f.skull;
  const s = Math.sin(th),
    c = Math.cos(th);
  const front = c > 0;
  const e = front ? 2 / 2.5 : 2 / 2.05;
  const cz = (zf + zb) / 2;
  const depth = front ? cz - zf : zb - cz;
  const x = se(s, e) * a;
  let z = cz - se(c, e) * depth;
  // Facial relief on the front.
  if (front) z -= faceRelief(f, x, yl) * smooth01(0.0, 0.5, c);
  // Forehead slope.
  if (yl > 0.03) z += (f.forehead - 1) * 0.02 * (yl - 0.03) * Math.max(0, c);
  out.set(x, yl, z);
  return out.add(HC);
}

// Skin color painter for the head: lips, brows, hairline, stubble, rosy
// cheeks, painted shadow in the sockets, nostrils, mouth corners, ears.
function headPainter(p, f, helmet) {
  const skin = p.skin.clone();
  const hair = p.hair;
  const lips = p.lips;
  const brows = p.brows;
  const stub = p.stubble;
  const dirt = p.dirt || 0;
  const tmp = new THREE.Color();
  // Stubble shows as a grey-blue shadow of the skin, darker for dark hair.
  const stubC = skin.clone().multiplyScalar(0.62).lerp(new THREE.Color(0.18, 0.19, 0.22), 0.35).lerp(hair, 0.25);
  return (x, y, z, col) => {
    const ly = y - HC.y,
      lz = z - HC.z,
      ax = Math.abs(x);
    col.copy(skin);
    const fr = lz < -0.03;
    // Ruddy cheeks, nose and ears (sun and wind).
    const ck = g2(ax - 0.048, ly + 0.03, 0.022, 0.02) * (fr ? 1 : 0);
    col.lerp(tmp.copy(lips).multiplyScalar(1.05), 0.16 * ck * p.ruddy);
    col.lerp(lips, 0.12 * g2(x, ly + 0.035, 0.012, 0.012) * p.ruddy * (lz < -0.1 ? 1 : 0.5));
    // Stubble: jaw, chin, upper lip, cheeks below the cheekbones.
    if (stub > 0) {
      const beard = sstep(-0.035, -0.055, ly) * (lz < 0.03 ? 1 : 0) * (1 - g2(x, ly + 0.067, 0.022, 0.011));
      const mous = g2(x, ly + 0.052, 0.024, 0.007) * (lz < -0.08 ? 1 : 0);
      col.lerp(stubC, stub * 0.5 * Math.max(beard * sstep(0.074, 0.06, ax + (lz > 0 ? 0.02 : 0)), mous * 0.8));
    }
    // Lips.
    const lipU = g2(x, ly + 0.0605, 0.021, 0.0042),
      lipL = g2(x, ly + 0.0745, 0.019, 0.0052);
    if (lz < -0.075) col.lerp(lips, Math.min(1, 1.4 * Math.max(lipU, lipL)) * 0.85);
    if (lz < -0.075) col.multiplyScalar(1 - 0.45 * g2(x, ly + 0.0675, 0.02, 0.0011));
    // Brows: thicker toward the nose.
    const bx = ax - 0.034 * f.eyeSpace,
      by = ly - 0.0185 - 0.003 * (1 - Math.min(1, ax / 0.04));
    if (lz < -0.06) {
      const bw = Math.exp(-((bx / 0.019) ** 6) - ((by / (0.0042 * (1 - bx * 8))) ** 2));
      col.lerp(brows, 0.88 * bw);
    }
    // Painted occlusion: sockets, lid crease, nostrils, mouth corners.
    if (fr) {
      const es = g2(ax - EYE_X * f.eyeSpace, ly - EYE_Y, 0.02, 0.014);
      col.multiplyScalar(1 - 0.24 * es);
      const ns = g2(ax - 0.0072, ly + 0.0455, 0.0032, 0.0022) * (lz < -0.095 ? 1 : 0);
      col.multiplyScalar(1 - 0.6 * ns);
      const mc = g2(ax - 0.024, ly + 0.068, 0.004, 0.004);
      col.multiplyScalar(1 - 0.3 * mc);
      // Under the nose and the lower lip.
      col.multiplyScalar(1 - 0.05 * g2(x, ly + 0.049, 0.01, 0.0025) - 0.15 * g2(x, ly + 0.084, 0.016, 0.004));
      // Shading that the geometry is too soft to cast: beside the nose, under the
      // cheekbones, the temples.
      col.multiplyScalar(1 - 0.08 * g2(ax - 0.017, ly + 0.012, 0.005, 0.016) - 0.07 * f.gaunt * g2(ax - 0.048, ly + 0.058, 0.018, 0.015));
    }
    // Under the jaw, toward the neck.
    if (ly < -0.09) col.multiplyScalar(1 - 0.35 * sstep(-0.09, -0.12, ly) * (lz > -0.07 ? 1 : 0.5));
    // Hair: short back and sides; the hairline over the forehead and temples.
    const hl = hairMask(x, ly, lz, p);
    if (hl > 0) col.lerp(hair, hl);
    // Under a helmet brim the face is shaded (painted lightly, the shadow map does the rest).
    if (helmet && fr) col.multiplyScalar(1 - 0.12 * sstep(-0.01, 0.04, ly));
    // Field grime.
    if (dirt > 0) {
      // Smudges of dust and sweat, 3-5 cm across.
      const n = noise3(x * 28 + p.tone, y * 28, z * 28);
      col.lerp(tmp.setRGB(0.12, 0.1, 0.075), dirt * 0.32 * smooth01(0.45, 0.9, n) * (fr ? 1 : 0.6));
    }
  };
}
// 0..1 hair coverage on the scalp (ly, lz relative to the head center).
function hairMask(x, ly, lz, p) {
  const ax = Math.abs(x);
  // Hairline: forehead at ~+0.072, temples recede, around the ears, nape at -0.06.
  const front = lz < -0.03;
  let line;
  if (front) line = 0.072 + (p.recede || 0) * 0.02 - 0.03 * sstep(0.03, 0.068, ax) + 0.01 * sstep(0.055, 0.07, ax);
  else line = lz < 0.015 ? 0.022 - 0.02 * sstep(-0.03, 0.01, lz) : -0.058 + 0.02 * sstep(0.03, 0.0, ax);
  // Around the ears (no hair just above and behind them).
  if (!front && ax > 0.06 && lz > -0.02 && lz < 0.035 && ly < 0.025) line = 0.026;
  const sides = p.sides ?? 0.8; // short sides fade toward the skin
  const m = sstep(line - 0.004, line + 0.006, ly);
  const fade = ly < 0.04 && ax > 0.055 ? sides : 1;
  return m * fade * 0.94;
}

// The head: surface, eyes and lids, ears, hair. opts: helmet (headgear covers
// the top: the hair cap stays flat), lod.
export function buildHead(b, p, { lod = 0, helmet = false, cap = false } = {}) {
  const f = faceShape(p);
  b.bones(B.head);
  b.material(CELL.skin);
  b.paint(p.skin);
  const ths = headAngles(lod);
  const ys = headRows(lod, helmet);
  const paint = headPainter(p, f, helmet);
  b.colorFn = paint;
  b.part();
  b.grid(ths, ys, (th, y, out) => headPoint(f, th, y, out), { center: HC.clone().add(V(0, 0, 0.01)), wrapU: true });
  b.colorFn = null;
  // Ears.
  for (const s of [-1, 1]) buildEar(b, s, f, p, lod);
  if (lod === 2) return;
  // Hair cap: a thin shell over the hair (thicker on top without headgear).
  buildHairCap(b, p, f, lod, helmet || cap);
  if (lod > 0) {
    // Eyes as dark spots for the middle distance.
    b.material(CELL.skin);
    for (const s of [-1, 1]) {
      b.paint(new THREE.Color(0.05, 0.04, 0.035));
      b.part();
      b.ellipsoid([HC.x + s * EYE_X * f.eyeSpace, HC.y + EYE_Y, HC.z + EYE_Z - 0.006], [0.009, 0.004, 0.006], { nu: 5, nv: 3 });
    }
    return;
  }
  for (const s of [-1, 1]) buildEye(b, s, f, p);
}

function buildEye(b, s, f, p) {
  const ec = V(HC.x + s * EYE_X * f.eyeSpace, HC.y + EYE_Y, HC.z + EYE_Z);
  const r = EYE_R * Math.sqrt(f.eyeSize);
  // Eyeball: sclera, iris, pupil; glossy.
  const iris = p.eyeColor;
  const sclera = new THREE.Color().setRGB(0.4, 0.375, 0.345);
  const pink = new THREE.Color().setRGB(0.45, 0.28, 0.24);
  b.material(CELL.skin, 1);
  b.part();
  b.colorFn = (x, y, z, col) => {
    const dz = (z - ec.z) / r; // -1 at the front
    const dx = (x - ec.x) / r;
    const ang = Math.sqrt(dx * dx + ((y - ec.y) / r) ** 2);
    if (dz < 0 && ang < 0.25) col.setRGB(0.01, 0.009, 0.008);
    else if (dz < 0 && ang < 0.55) col.copy(iris).multiplyScalar(0.5 + 0.5 * (ang - 0.25) * 3.3);
    else if (dz < 0 && ang < 0.62) col.copy(iris).multiplyScalar(0.25);
    else col.copy(sclera).lerp(pink, sstep(0.65, 1.0, Math.abs(dx)) * 0.5);
    // The upper lid shades the top of the eye.
    col.multiplyScalar(1 - 0.45 * sstep(-0.2, 0.45, (y - ec.y) / r));
  };
  b.ellipsoid([ec.x, ec.y, ec.z], [r, r, r], { nu: 10, nv: 7 });
  b.colorFn = null;
  // Lids: shells just over the eyeball, from the lid margin back into the socket.
  b.material(CELL.skin, 0);
  const lr = r + 0.0017;
  const open = f.lidOpen;
  const azMax = 1.05;
  // Lid margins (radians of elevation) across the eye; the outer corner sits a
  // little higher than the inner one (canthal tilt), a lid fold lowers the upper lid.
  const marginUp = (az) => {
    const t = az / azMax; // -1 .. 1, + toward +X
    return 0.21 * open - 0.29 * t * t - 0.07 * f.lid + 0.035 * t * s;
  };
  const marginDn = (az) => {
    const t = az / azMax;
    return -0.3 * open + 0.23 * t * t + 0.035 * t * s - 0.07 * f.lid * t * t;
  };
  const shell = (e0fn, e1, up) => {
    const azs = [],
      es = [];
    for (let i = 0; i <= 10; i++) azs.push(-azMax + (2 * azMax * i) / 10);
    for (let j = 0; j <= 3; j++) es.push(j / 3);
    b.part();
    // Lit at the margin, shading off into the socket's painted shadow.
    const lidC = p.skin.clone();
    b.colorFn = (x, y, z, col) => {
      const d = Math.hypot(x - ec.x, (y - ec.y) * 1.4) / 0.016;
      col.copy(lidC).multiplyScalar(up ? 0.93 - 0.2 * Math.min(1, d) : 0.88 - 0.12 * Math.min(1, d));
    };
    b.grid(
      azs,
      es,
      (az, t, out) => {
        const e0 = e0fn(az);
        const el = lerp(e0, e1, t * t);
        // Thicker at the margin (the lid edge has a rim).
        const rr = lr + (t < 0.15 ? 0.0006 * (1 - t / 0.15) : 0) - 0.0012 * t;
        const ca = Math.cos(el);
        // Azimuth around the vertical axis: 0 = forward (-Z); + toward +X.
        out.set(ec.x + Math.sin(az) * ca * rr, ec.y + Math.sin(el) * rr, ec.z - Math.cos(az) * ca * rr);
        if (!up) out.y -= 0.0003;
      },
      { center: ec },
    );
    b.colorFn = null;
  };
  shell(marginUp, 1.15, true);
  shell(marginDn, -1.05, false);
}

function buildEar(b, s, f, p, lod) {
  const sz = f.earSize;
  const c = V(HC.x + s * 0.0735 * f.width, HC.y - 0.012, HC.z + 0.012);
  // Ear plane: up (a), back (bb), outward normal n; the back edge stands out, so
  // the outer face looks a little forward.
  const out = 0.32 * f.earOut;
  const n = V(s * Math.cos(out), 0, -Math.sin(out)).normalize();
  const a = V(0, 1, 0.12).normalize();
  const bb = new THREE.Vector3().crossVectors(n, a).multiplyScalar(s).normalize(); // backward
  if (bb.z < 0) bb.negate();
  const H = 0.031 * sz,
    W = 0.017 * sz;
  b.bones(B.head);
  b.material(CELL.skin);
  b.paint(p.skin.clone().lerp(p.lips, 0.12 * (p.ruddy || 1)));
  b.part();
  if (lod === 2) {
    b.ellipsoid([c.x + n.x * 0.004, c.y, c.z + 0.004], [0.006, H, W], {
      nu: 4,
      nv: 3,
    });
    return;
  }
  const nphi = lod ? 8 : 12;
  // Contour: a C-shape, wider at the top, the lobe at the bottom.
  const contour = (phi, o) => {
    // phi 0 = top, increasing toward the back and down.
    const ca = Math.cos(phi),
      sa = Math.sin(phi);
    const top = ca > 0;
    const w = W * (top ? 1.0 : 0.82) * (1 + 0.15 * Math.max(0, sa));
    const h = H * (top ? 1.0 : 1.05);
    o.set(sa * w + 0.003, ca * h, 0);
    return o;
  };
  const phis = [],
    rs = [];
  for (let i = 0; i <= nphi; i++) phis.push((i / nphi) * 2 * PI);
  // r: 0 = concha center .. 1 = rim, then over the rim to the back side (1..1.6).
  const rList = lod ? [0, 0.5, 1, 1.3, 1.6] : [0, 0.35, 0.58, 0.75, 0.9, 1.0, 1.12, 1.35, 1.6];
  for (const r of rList) rs.push(r);
  const tmp = new THREE.Vector3();
  b.grid(
    phis,
    rs,
    (phi, r, o) => {
      contour(phi, tmp);
      const front = Math.sin(phi) < -0.3 ? 1 : 0; // toward the face: the tragus side, flatter
      let rr, h;
      if (r <= 1) {
        rr = r;
        // Height off the ear plane: concha deep, antihelix ridge, scapha groove, helix rim.
        h = -0.006 * (1 - smooth01(0.25, 0.5, r)) + 0.0035 * Math.exp(-(((r - 0.66) / 0.1) ** 2)) * (1 - front * 0.6) - 0.001 * Math.exp(-(((r - 0.84) / 0.06) ** 2)) + 0.004 * smooth01(0.88, 1.0, r);
      } else {
        // Back of the ear, curving into the head.
        const t = (r - 1) / 0.6;
        rr = 1 - 0.35 * t;
        h = 0.004 - 0.011 * t - 0.004 * t * t;
      }
      // The lobe is thicker and has no rim fold.
      const lobe = Math.cos(phi) < -0.6 ? 1 : 0;
      if (lobe && r <= 1) h = h * 0.4 + 0.002;
      o.copy(c)
        .addScaledVector(a, tmp.y * rr)
        .addScaledVector(bb, tmp.x * rr)
        .addScaledVector(n, h + 0.002);
    },
    { center: c.clone().addScaledVector(n, -0.01), wrapU: true },
  );
}

// Hair cap: a shell over the hair region. flat: under headgear (thin).
function buildHairCap(b, p, f, lod, flat) {
  // The cap starts at the hairline (forehead, above the ears, the nape) and
  // runs over the crown; it never crosses the face.
  const ths = [],
    vs = [];
  const nu = lod ? 12 : 24;
  for (let i = 0; i <= nu; i++) ths.push(-PI + (i / nu) * 2 * PI);
  const n = lod ? 3 : 6;
  for (let j = 0; j <= n; j++) vs.push(j / n);
  const hl = (th) => {
    const a = Math.abs(th);
    const front = 0.068 + (p.recede || 0) * 0.02 - 0.012 * smooth01(0.25, 0.7, a);
    const side = 0.024;
    const back = -0.058;
    if (a < 1.0) return lerp(front, side, smooth01(0.7, 1.0, a));
    if (a < 2.0) return side;
    return lerp(side, back, smooth01(2.0, 2.5, a));
  };
  const top = flat ? 0.0015 : p.hairTop ?? 0.012;
  b.material(CELL.hair);
  b.paint(p.hair);
  b.part();
  const tmp = new THREE.Vector3();
  b.colorFn = (x, y, z, col) => {
    const ly = y - HC.y;
    col.copy(p.hair).multiplyScalar(0.85 + 0.25 * smooth01(0.0, 0.1, ly));
  };
  b.grid(
    ths,
    vs,
    (th, v, o) => {
      const y0 = hl(th);
      const y = lerp(y0, 0.1225, Math.pow(v, 0.85));
      headPoint(f, th, y, o);
      // Thickness: clipped short at the sides, fuller on top, thin at the edge.
      const edge = smooth01(0, 0.3, v);
      const sides = Math.abs(th) > 0.9 && y < 0.05 ? p.sides ?? 0.8 : 1;
      const thick = lerp(0.0012, top, smooth01(0.03, 0.09, y)) * edge * sides + 0.0004;
      tmp.copy(o).sub(HC);
      tmp.y *= 0.6;
      tmp.normalize();
      o.addScaledVector(tmp, thick);
    },
    { center: HC, wrapU: true },
  );
  b.colorFn = null;
}

// Neck: from inside the collar up into the head, with the larynx.
export function buildNeck(b, { lod = 0, skin, low = 1.43 } = {}) {
  b.bones((x, y, z, o) => {
    if (y < 1.5) setN(o, [B.chest, 1 - smooth01(1.44, 1.5, y), B.neck, smooth01(1.44, 1.5, y)]);
    else setN(o, [B.neck, 1 - smooth01(1.55, 1.6, y), B.head, smooth01(1.55, 1.6, y)]);
  });
  b.material(CELL.skin);
  if (skin) b.paint(skin);
  b.part();
  const nr = [12, 7, 5][lod];
  const ys = lod ? [low, 1.5, 1.56, 1.6] : [low, 1.46, 1.49, 1.515, 1.54, 1.56, 1.58, 1.6, 1.615];
  const ths = [];
  for (let i = 0; i <= nr; i++) ths.push(-PI + (i / nr) * 2 * PI);
  const sk = skin ? skin.clone() : null;
  b.colorFn = sk
    ? (x, y, z, col) => {
        col.copy(sk).multiplyScalar(0.9 + 0.1 * smooth01(1.45, 1.55, y));
      }
    : null;
  b.grid(
    ths,
    ys,
    (th, y, o) => {
      const t = smooth01(1.43, 1.6, y);
      const rx = lerp(0.065, 0.055, t),
        rz = lerp(0.066, 0.059, t);
      const cz = lerp(0.025, 0.014, t);
      const s = Math.sin(th),
        c = Math.cos(th);
      let r = 1;
      // Larynx (Adam's apple) and the sternocleidomastoid cords.
      r += 0.09 * Math.exp(-((th / 0.25) ** 2)) * Math.exp(-(((y - 1.535) / 0.018) ** 2)) * (lod ? 0 : 1);
      r += 0.03 * Math.exp(-(((Math.abs(th) - 0.7) / 0.25) ** 2)) * (lod ? 0 : 1);
      o.set(s * rx * r, y, cz - c * rz * r);
    },
    { center: V(0, 1.52, 0.02), wrapU: true },
  );
  b.colorFn = null;
}

// ---------------------------------------------------------------------------
// Hands. Built straight (fingers down, palm toward the body, thumb forward) and
// skinned to the finger bones, which close them around a grip.
function fingerWeights(side, name) {
  const [b1, b2] = FINGER_BONES[side][name];
  const hand = side < 0 ? B.handL : B.handR;
  const J = HAND_JOINTS[name].map((p) => handPoint(side, p));
  const d1 = J[1].clone().sub(J[0]);
  const l1 = d1.length();
  d1.divideScalar(l1);
  const _q = new THREE.Vector3();
  return (x, y, z, o) => {
    const s = _q.set(x, y, z).sub(J[0]).dot(d1); // along the finger from the base knuckle
    if (s < l1 - 0.006) {
      const t = smooth01(-0.008, 0.006, s);
      return setN(o, [hand, 1 - t, b1, t]);
    }
    const t = smooth01(l1 - 0.006, l1 + 0.005, s);
    setN(o, [b1, 1 - t, b2, t]);
  };
}

// Base knuckles of the four fingers on the back of the hand: [y, z] (hand space).
const KNUCKLES = ['index', 'middle', 'ring', 'pinky'].map((n) => [HAND_JOINTS[n][0][1] - 0.002, HAND_JOINTS[n][0][2]]);
export function buildHand(b, side, { lod = 0, skin, nails, glove = null, dirt = 0 } = {}) {
  const hand = side < 0 ? B.handL : B.handR;
  const H = (x, y, z) => handPoint(side, [x, y, z]);
  // Bare hands in full detail are painted in the hand layout (creases, nails,
  // veins: the soldierHand texture), so their UVs are set below.
  const layout = lod === 0 && !glove;
  b.material(glove ? glove.cell : layout ? CELL.hand : CELL.skin);
  if (skin) b.paint(glove ? glove.color : skin);
  b.part();
  if (lod === 2) {
    b.bones(rigid(hand));
    const c = H(-0.004, -0.07, -0.002);
    b.box([c.x, c.y, c.z], [0.03, 0.1, 0.075], { r: 0.012 });
    return;
  }
  if (lod === 1) {
    // Mitten: palm and a finger block that curls with the middle finger.
    b.bones(rigid(hand));
    const c = H(-0.004, -0.05, -0.004);
    b.box([c.x, c.y, c.z], [0.03, 0.085, 0.08], { r: 0.012 });
    b.bones(fingerWeights(side, 'middle'));
    const f = H(-0.004, -0.13, 0.0);
    b.box([f.x, f.y, f.z], [0.022, 0.09, 0.074], { r: 0.01 });
    b.bones(fingerWeights(side, 'thumb'));
    b.cylinder(H(-0.012, -0.03, -0.026).toArray(), H(-0.026, -0.1, -0.046).toArray(), 0.011, 0.009, { seg: 5 });
    return;
  }
  // Palm: rows down from the wrist to the knuckles, a rounded slab with the
  // thumb pad (thenar) on the palm side.
  const fore = side < 0 ? B.forearmL : B.forearmR;
  b.bones((x, y, z, o) => {
    // The thenar flesh moves partly with the thumb's base.
    const [t1] = FINGER_BONES[side].thumb;
    const lx = (x - BIND[hand].x) * (side < 0 ? -1 : 1),
      ly = y - BIND[hand].y,
      lz = z - BIND[hand].z;
    // (Not much: the thumb turns far round a fore-end, and the flesh it pulls
    // with it would fold out of the palm.)
    const w = Math.exp(-(((lz + 0.026) / 0.016) ** 2) - (((ly + 0.045) / 0.022) ** 2)) * (lx < 0.002 ? 0.3 : 0.15);
    // Above the wrist the skin goes with the forearm, into the sleeve.
    const fw = smooth01(0.002, 0.022, ly);
    setN(o, [hand, (1 - w) * (1 - fw), t1, w * (1 - fw), fore, fw]);
  });
  const rows = [
    // [y, half width (z), back x, palm x, z center]: wrist 5.6 x 3.6 cm,
    // palm 8.4 x 3 cm, knuckles 8.2 x 2.4 cm (est.). The first row is the end
    // of the forearm, inside the cuff, so no gap shows when the wrist bends.
    [0.035, 0.025, 0.016, -0.016, 0.002],
    [0.006, 0.027, 0.015, -0.017, 0.002],
    [-0.012, 0.031, 0.014, -0.018, 0.0],
    [-0.032, 0.037, 0.013, -0.019, -0.001],
    [-0.054, 0.041, 0.012, -0.018, 0.0],
    [-0.072, 0.042, 0.0105, -0.0155, 0.001],
    [-0.086, 0.041, 0.009, -0.013, 0.001],
    [-0.096, 0.037, 0.007, -0.011, 0.001],
  ];
  // Round the hand from the little-finger edge (the seam of the layout).
  const nu = 20;
  const us = [];
  for (let i = 0; i <= nu; i++) us.push(PI / 2 + (i / nu) * 2 * PI);
  // Rows: those of the profile, closer over the knuckles.
  const ys = [0.035, 0.006, -0.012, -0.032, -0.054, -0.068, -0.078, -0.086, -0.091, -0.096];
  // Backs tanned and weathered by a summer outdoors, palms paler and pinker,
  // knuckles ruddy, grime worked into the skin (blotchy, not uniform).
  const sk = skin ? skin.clone() : null;
  const tan = sk ? sk.clone().multiplyScalar(0.8).lerp(new THREE.Color(0.3, 0.15, 0.085), 0.18) : null;
  const palmC = sk ? sk.clone().multiplyScalar(0.92).lerp(new THREE.Color(0.7, 0.42, 0.34), 0.14) : null;
  const ruddy = new THREE.Color(0.5, 0.24, 0.17);
  const grime = new THREE.Color(0.12, 0.09, 0.07);
  const hb = BIND[hand];
  b.colorFn = sk
    ? (x, y, z, col, nx) => {
        const back = nx * side;
        col.copy(back > 0 ? tan : palmC);
        // Knuckles ruddier; a darker web between the fingers' roots.
        const ky = y - hb.y;
        if (back > 0.2) col.lerp(ruddy, 0.22 * Math.exp(-(((ky + 0.092) / 0.009) ** 2)));
        else col.multiplyScalar(1 - 0.12 * Math.exp(-(((ky + 0.075) / 0.008) ** 2)));
        // Tone variation and grime.
        const g = noise3(x * 90 + side * 7, y * 90, z * 90);
        col.multiplyScalar(0.93 + 0.14 * g);
        if (dirt) col.lerp(grime, dirt * 0.22 * smooth01(0.45, 0.85, noise3(x * 140, y * 140 + 3, z * 140)));
      }
    : null;
  const g0 = b.count;
  b.grid(
    us,
    ys,
    (a, y, o) => {
      const [, hw, bx, px, zc] = interpRows(rows, y);
      const c = Math.cos(a),
        sn = Math.sin(a);
      // x: back (+) / palm (-); z: across.
      const cx = (bx + px) / 2,
        hx = (bx - px) / 2;
      let x = cx + se(c, 0.9) * hx;
      let z = zc + se(sn, 0.75) * hw;
      // Thenar bulge (thumb side, palm) and hypothenar.
      if (c < 0) {
        x -= 0.006 * Math.exp(-(((z + 0.022) / 0.014) ** 2) - (((y + 0.045) / 0.024) ** 2)) * -c;
        x -= 0.003 * Math.exp(-(((z - 0.025) / 0.012) ** 2) - (((y + 0.05) / 0.025) ** 2)) * -c;
      } else {
        // The back rounds over; the four knuckles stand up at the finger roots
        // (~4 mm, est.) and the extensor tendons run from them toward the wrist.
        x += 0.002 * c * c;
        for (const k of KNUCKLES) {
          x += 0.0038 * Math.exp(-(((z - k[1]) / 0.0068) ** 2) - (((y - k[0]) / 0.0095) ** 2)) * c;
          x += 0.0011 * Math.exp(-(((z - k[1] * 0.75) / 0.0035) ** 2)) * smooth01(0.0, -0.03, y) * smooth01(k[0] - 0.002, k[0] + 0.03, y) * c;
        }
      }
      o.copy(H(x, y, z));
    },
    { center: H(-0.002, -0.05, 0.0), wrapU: true },
  );
  if (layout) {
    // Layout: u 0.01-0.49 round the hand, v from the wrist to the knuckles.
    for (let j = 0; j < ys.length; j++)
      for (let i = 0; i <= nu; i++) {
        const q = (g0 + j * (nu + 1) + i) * 2;
        b.uv[q] = 0.01 + 0.48 * (i / nu);
        b.uv[q + 1] = 0.005 + 0.99 * Math.max(0, (ys[1] - ys[j]) / (ys[1] - ys[ys.length - 1]));
      }
  }
  // Fingers.
  const nailC = layout ? null : nails || (skin ? skin.clone().lerp(new THREE.Color(0.75, 0.6, 0.55), 0.35) : null);
  const radii = { thumb: [0.0108, 0.0095, 0.0085], index: [0.0092, 0.0084, 0.0076], middle: [0.0095, 0.0087, 0.0078], ring: [0.009, 0.0082, 0.0074], pinky: [0.0081, 0.0074, 0.0067] };
  for (const name of FINGER_NAMES) {
    const J = HAND_JOINTS[name];
    b.bones(fingerWeights(side, name));
    b.part();
    const r = radii[name];
    const pts = J.map((p) => H(p[0], p[1], p[2]));
    // Start inside the palm.
    const start = pts[0].clone().addScaledVector(pts[0].clone().sub(pts[1]).normalize(), name === 'thumb' ? 0.022 : 0.012);
    const rings = [];
    const seg = [start, ...pts];
    const L = [];
    let acc = 0;
    for (let i = 0; i < seg.length - 1; i++) {
      L.push(acc);
      acc += seg[i].distanceTo(seg[i + 1]);
    }
    L.push(acc);
    const n = name === 'thumb' ? 7 : 8;
    const rAt = (t) => {
      // t along the finger 0..acc: radius tapers through the joints.
      const k = Math.min(2, Math.floor(((t - L[1]) / (acc - L[1])) * 3));
      const base = r[Math.max(0, k)];
      // Joints a touch thicker.
      let jb = 0;
      for (const jj of [2, 3]) jb += 0.0009 * Math.exp(-(((t - L[jj]) / 0.004) ** 2));
      return base + jb;
    };
    const at = (t, o) => {
      let i = 0;
      while (i < seg.length - 2 && t > L[i + 1]) i++;
      const u = (t - L[i]) / (L[i + 1] - L[i]);
      return o.copy(seg[i]).lerp(seg[i + 1], Math.min(1, Math.max(0, u)));
    };
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * acc;
      const c = at(t, new THREE.Vector3());
      const rr = rAt(t);
      // Flatter on the palm side (pads), and the tip rounds off.
      rings.push({ c, rx: rr * (name === 'thumb' ? 1.0 : 0.92), rz: rr, t });
    }
    // The ring's first vertex faces the pad (for the layout: the nail side is
    // half way round). The thumb's pad faces the fingers and a little the palm.
    const side3 = name === 'thumb' ? V(-side * 0.5, 0, 0.87) : V(-side, 0, 0);
    const col = b.color.clone();
    const pv = new THREE.Vector3();
    b.colorFn = sk
      ? (x, y, z, cc, nx) => {
          const back = nx * side;
          cc.copy(back > 0 ? tan : palmC);
          // Nail (without the layout texture): on the back of the last phalanx.
          pv.set(x, y, z);
          if (nailC && back > 0.35 && pv.distanceTo(pts[3]) < 0.014 && pv.distanceTo(pts[2]) > 0.006) cc.lerp(nailC, 0.75);
          // Knuckles: ruddier over the joints, the creases across them darker.
          for (const jj of [0, 1, 2]) {
            const d = pv.distanceTo(pts[jj]);
            if (d < 0.011) cc.lerp(ruddy, (back > 0 ? 0.2 : 0.08) * (1 - d / 0.011));
            if (d < 0.005) cc.multiplyScalar(0.84 + 0.12 * (d / 0.005));
          }
          // Dirt under and round the nails, in the joints.
          if (dirt) cc.lerp(grime, dirt * (0.12 + 0.2 * smooth01(0.5, 0.9, noise3(x * 160, y * 160, z * 160 + side))));
        }
      : null;
    const f0 = b.count;
    b.tube(rings, { seg: 6, side: [side3.x, side3.y, side3.z], capStart: 0, capEnd: 0.9 });
    b.colorFn = null;
    b.paint(col);
    if (layout) {
      // Layout: the finger's strip, round from the pad (u) by along (v): the
      // root, knuckle, joints and tip at fixed v (0, 0.19, 0.52, 0.76, 0.94),
      // the rounded tip beyond.
      const K = [0, 0.19, 0.52, 0.76, 0.94];
      const vOf = (t) => {
        let i = 0;
        while (i < 3 && t > L[i + 1]) i++;
        return K[i] + (K[i + 1] - K[i]) * Math.min(1, Math.max(0, (t - L[i]) / (L[i + 1] - L[i])));
      };
      const fi = FINGER_NAMES.indexOf(name);
      const nr = (b.count - f0) / 7;
      for (let k = 0; k < nr; k++) {
        const vf = k < rings.length ? vOf(rings[k].t) : k === rings.length ? 0.975 : 1;
        for (let i = 0; i <= 6; i++) {
          const q = (f0 + k * 7 + i) * 2;
          b.uv[q] = 0.5 + 0.1 * fi + 0.1 * (0.01 + 0.98 * (i / 6));
          b.uv[q + 1] = 0.005 + 0.99 * vf;
        }
      }
    }
  }
}

// Forearm skin for rolled-up sleeves: from the elbow to the wrist.
export function buildForearm(b, side, { lod = 0, skin, from = 0.24 } = {}) {
  const P = armChain(side);
  const fa = side < 0 ? B.forearmL : B.forearmR,
    ua = side < 0 ? B.upperArmL : B.upperArmR,
    hd = side < 0 ? B.handL : B.handR;
  const sE = P[0].distanceTo(P[1]),
    sW = sE + P[1].distanceTo(P[2]);
  b.bones((x, y, z, o) => {
    const s = P[0].y - y; // approximately along the hanging arm
    if (s < sE + 0.04) return setN(o, [ua, 1 - smooth01(sE - 0.04, sE + 0.04, s), fa, smooth01(sE - 0.04, sE + 0.04, s)]);
    setN(o, [fa, 1 - smooth01(sW - 0.02, sW + 0.02, s), hd, smooth01(sW - 0.02, sW + 0.02, s)]);
  });
  b.material(CELL.skin);
  if (skin) b.paint(skin);
  b.part();
  // Sunburnt and tanned on the outside of the forearm, paler inside.
  if (skin) {
    const out = skin.clone().multiplyScalar(0.82).lerp(new THREE.Color(0.34, 0.17, 0.1), 0.16);
    const inside = skin.clone().multiplyScalar(0.92);
    const c0 = chainPoint(P, sE, new THREE.Vector3());
    b.colorFn = (x, y, z, col) => {
      const o = smooth01(-0.4, 0.6, ((x - c0.x) * side * 0.8 - (z - c0.z) * 0.6) / 0.04);
      col.copy(inside).lerp(out, o).multiplyScalar(0.93 + 0.14 * noise3(x * 70, y * 70 + side, z * 70));
    };
  }
  const rows = [];
  const n = lod ? 3 : 10;
  for (let i = 0; i <= n; i++) {
    const s = from + ((sW + 0.01 - from) * i) / n;
    const t = (s - sE) / (sW - sE);
    // Forearm flesh: widest below the elbow, flattening to the wrist.
    const rx = t < 0 ? 0.042 : lerp(0.042, 0.03, Math.min(1, t)) + 0.006 * Math.exp(-(((t - 0.2) / 0.25) ** 2));
    const rz = t < 0 ? 0.04 : lerp(0.04, 0.022, Math.min(1, t)) + 0.006 * Math.exp(-(((t - 0.2) / 0.25) ** 2));
    const c = chainPoint(P, s, new THREE.Vector3());
    rows.push({ c, rx, rz });
  }
  b.tube(rows, { seg: lod ? 6 : 14, capStart: 0, capEnd: 0 });
  b.colorFn = null;
}
