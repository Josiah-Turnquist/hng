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
import { handMesh } from './handMesh.js';
import { headMesh, headShape, skinOf } from './headMesh.js';

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
        // (The underside is a short step, not a long shelf: lit from above, a
        // long one was a dark patch over the lip, like a small moustache.)
        [-0.056, 0.003],
        [-0.05, 0.0075],
        [-0.045, 0.0145],
        [-0.04, 0.0195],
        [-0.034, 0.021],
        [-0.026, 0.0188],
        [-0.016, 0.0152],
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
        [-0.05, 0.0105],
        [-0.042, 0.0158],
        [-0.034, 0.0148],
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
  d -= 0.0098 * sock;
  // Soft hollow under the brow, above the lid (deeper set eyes with a lower lid fold).
  d -= 0.003 * (1 - f.lid * 0.7) * g2(ex, y - 0.011, 0.016, 0.005);
  // Cheekbones forward and out; hollow cheeks under them.
  d += 0.0085 * f.cheek * g2(ax - 0.052, y + 0.02 + f.cheekY, 0.019, 0.015);
  // (Every soldier a little lean in the cheek; `gaunt` more so.)
  d -= 0.004 * (0.35 + f.gaunt) * g2(ax - 0.045, y + 0.06, 0.016, 0.018);
  // Upper lip, philtrum, lower lip, mouth line.
  const lip = f.lips;
  d += 0.0045 * lip * g2(x, y + 0.059, 0.022, 0.0075) - 0.0013 * g2(x, y + 0.053, 0.0035, 0.006);
  // The upper lip stands forward under the nose (the teeth behind it).
  d += 0.0028 * g2(x, y + 0.051, 0.017, 0.0065);
  d += 0.0055 * lip * g2(x, y + 0.0755, 0.019, 0.0062);
  d -= 0.0026 * Math.exp(-(((y + 0.0675) / 0.0014) ** 2)) * sstep(0.026, 0.018, ax);
  // Mentolabial groove and chin.
  d -= 0.0025 * g2(x, y + 0.088, 0.02, 0.005);
  d += 0.008 * f.chin * g2(x, y + 0.104, 0.024, 0.014);
  // Nasolabial folds.
  const nl = Math.abs(ax - (0.019 + (-(y + 0.04)) * 0.38));
  if (y < -0.035 && y > -0.075) d -= 0.0021 * Math.exp(-((nl / 0.0032) ** 2)) * sstep(-0.035, -0.045, y);
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
    // (Closer across the face, so its painted brows, eyes and mouth show at 20 to 50 m.)
    const a = [];
    const add = (t0, t1, n) => {
      for (let i = 0; i < n; i++) a.push(t0 + ((t1 - t0) * i) / n);
    };
    add(-PI, -0.9, 5);
    add(-0.9, 0.9, 12);
    add(0.9, PI, 5);
    a.push(PI);
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
    for (const y of [-0.124, -0.105, -0.085, -0.072, -0.06, -0.045, -0.025, -0.008, 0.006, 0.02, 0.04, 0.07, 0.1, 0.1225]) ys.push(y);
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
    // Skin is not one flat color: faint blotches a few centimeters across.
    col.multiplyScalar(0.965 + 0.07 * noise3(x * 55 + p.tone * 3, y * 55, z * 55));
    // Ruddy cheeks, nose and ears (sun and wind).
    const ck = g2(ax - 0.048, ly + 0.03, 0.022, 0.02) * (fr ? 1 : 0);
    col.lerp(tmp.copy(lips).multiplyScalar(1.05), 0.16 * ck * p.ruddy);
    col.lerp(lips, 0.12 * g2(x, ly + 0.035, 0.012, 0.012) * p.ruddy * (lz < -0.1 ? 1 : 0.5));
    // Stubble: jaw, chin, upper lip, cheeks below the cheekbones.
    if (stub > 0) {
      const beard = sstep(-0.035, -0.055, ly) * (lz < 0.03 ? 1 : 0) * (1 - g2(x, ly + 0.067, 0.022, 0.011));
      const mous = g2(x, ly + 0.052, 0.024, 0.007) * (lz < -0.08 ? 1 : 0);
      col.lerp(stubC, stub * 0.5 * Math.max(beard * sstep(0.074, 0.06, ax + (lz > 0 ? 0.02 : 0)), mous * 0.35));
    }
    // Lips.
    const lipU = g2(x, ly + 0.0605, 0.021, 0.0042),
      lipL = g2(x, ly + 0.0745, 0.019, 0.0052);
    if (lz < -0.075) col.lerp(lips, Math.min(1, 1.6 * Math.max(lipU, lipL)));
    if (lz < -0.075) col.multiplyScalar(1 - 0.6 * g2(x, ly + 0.0675, 0.021, 0.0012));
    // Brows: thicker toward the nose.
    const bx = ax - 0.034 * f.eyeSpace,
      by = ly - 0.0185 - 0.003 * (1 - Math.min(1, ax / 0.04));
    if (lz < -0.06) {
      const bw = Math.exp(-((bx / 0.019) ** 6) - ((by / (0.0042 * (1 - bx * 8))) ** 2));
      col.lerp(brows, 0.88 * bw);
    }
    // Painted occlusion: sockets, lid crease, nostrils, mouth corners.
    if (fr) {
      const es = g2(ax - EYE_X * f.eyeSpace, ly - EYE_Y, 0.021, 0.015);
      col.multiplyScalar(1 - 0.26 * es);
      const ns = g2(ax - 0.0072, ly + 0.0455, 0.0032, 0.0022) * (lz < -0.095 ? 1 : 0);
      col.multiplyScalar(1 - 0.34 * ns);
      // Under the nose the skin is lit from the lip below it (painted: the
      // light here has no bounce), so its underside is not a black patch.
      if (lz < -0.085) col.multiplyScalar(1 + 0.32 * g2(x, ly + 0.0475, 0.013, 0.0055) * (1 - ns));
      // Tired under the eyes.
      col.multiplyScalar(1 - 0.07 * g2(ax - EYE_X * f.eyeSpace, ly + 0.012, 0.014, 0.005));
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
  // Near and at the middle distance: the sculpted head (with its neck).
  if (lod < 2) return buildSculptedHead(b, p, { lod, helmet, cap });
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
      b.ellipsoid([HC.x + s * EYE_X * f.eyeSpace, HC.y + EYE_Y, HC.z + EYE_Z - 0.006], [0.0115, 0.0055, 0.006], { nu: 5, nv: 3 });
    }
    return;
  }
  for (const s of [-1, 1]) buildEye(b, s, f, p);
}

// (center, radius: where the sculpted head has its eye; lids: false when the
// head has lids of its own.)
function buildEye(b, s, f, p, { center = null, radius = null, lids = true } = {}) {
  const ec = center || V(HC.x + s * EYE_X * f.eyeSpace, HC.y + EYE_Y, HC.z + EYE_Z);
  const r = radius || EYE_R * Math.sqrt(f.eyeSize);
  // Eyeball: sclera, iris, pupil; glossy.
  const iris = p.eyeColor;
  // (Well under white: in daylight the lids and lashes shade it, and a bright
  // white round the iris read as a stare.)
  const sclera = new THREE.Color().setRGB(0.27, 0.25, 0.235);
  const pink = new THREE.Color().setRGB(0.45, 0.28, 0.24);
  // (Wet, but not a mirror: at full gloss the whole eye lit up white with the
  // sky, and showed as a stare from a few meters.)
  b.material(CELL.skin, 0.35);
  b.part();
  b.colorFn = (x, y, z, col) => {
    const dz = (z - ec.z) / r; // -1 at the front
    const dx = (x - ec.x) / r;
    const ang = Math.sqrt(dx * dx + ((y - ec.y) / r) ** 2);
    // (Iris about 11 mm across, pupil 3 to 4 mm, a darker ring at the iris edge.
    // Kept dark: a pale iris ran into the white of the eye at a few meters and
    // left only the pupil, a wide-eyed stare.)
    if (dz < 0 && ang < 0.16) col.setRGB(0.01, 0.009, 0.008);
    else if (dz < 0 && ang < 0.4) col.copy(iris).multiplyScalar(0.95 - 0.5 * (ang - 0.16) * 4.2);
    else if (dz < 0 && ang < 0.48) col.copy(iris).multiplyScalar(0.28);
    else col.copy(sclera).lerp(pink, sstep(0.65, 1.0, Math.abs(dx)) * 0.5);
    // The upper lid shades the top of the eye.
    col.multiplyScalar(1 - 0.45 * sstep(-0.15, 0.5, (y - ec.y) / r));
  };
  // (Built round the line of sight, with rings at the pupil and iris edges, so
  // the colors, set at the corners of the mesh, come out as sharp circles.)
  const azs = [];
  for (let i = 0; i <= 16; i++) azs.push((i / 16) * 2 * PI);
  const pols = [0, 0.08, 0.15, 0.175, 0.26, 0.35, 0.395, 0.425, 0.49, 0.52, 0.65, 0.85, 1.1, 1.4, 1.8, 2.4, PI];
  b.grid(azs, pols, (az, pol, out) => out.set(ec.x + Math.sin(pol) * Math.cos(az) * r, ec.y + Math.sin(pol) * Math.sin(az) * r, ec.z - Math.cos(pol) * r), { center: ec, wrapU: true });
  b.colorFn = null;
  if (!lids) return b.material(CELL.skin, 0);
  // Lids: shells just over the eyeball, from the lid margin back into the socket.
  b.material(CELL.skin, 0);
  const lr = r + 0.0011;
  const open = f.lidOpen;
  const azMax = 1.18;
  // Lid margins (radians of elevation) across the eye; the outer corner sits a
  // little higher than the inner one (canthal tilt), a lid fold lowers the upper lid.
  const marginUp = (az) => {
    const t = az / azMax; // -1 .. 1, + toward +X
    return 0.15 * open - 0.27 * t * t - 0.07 * f.lid + 0.035 * t * s;
  };
  const marginDn = (az) => {
    const t = az / azMax;
    return -0.27 * open + 0.23 * t * t + 0.035 * t * s - 0.07 * f.lid * t * t;
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
      // (Darker than the cheeks: lids paler than the face round them read as
      // the whites of wide-open eyes from a few meters.)
      col.copy(lidC).multiplyScalar(up ? 0.66 - 0.12 * Math.min(1, d) : 0.7 - 0.08 * Math.min(1, d));
      // The lash line: a dark edge along the upper lid's margin (lighter on the lower).
      const el = Math.asin(Math.max(-1, Math.min(1, (y - ec.y) / lr)));
      const az = Math.atan2(x - ec.x, -(z - ec.z));
      const m = up ? marginUp(az) : marginDn(az);
      const near = Math.exp(-(((el - m) / 0.07) ** 2));
      col.multiplyScalar(1 - (up ? 0.72 : 0.3) * near);
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

// The sculpted head and neck (headMesh.js: MakeHuman's, shaped for this man),
// painted: his skin tone under the variation of a real skin (lips, lids, ears,
// the shade of the sockets), his brows, his hair cropped on the scalp and as a
// thin cap over it, stubble on the jaw, grime. Its eyes are the game's own.
function buildSculptedHead(b, p, { lod = 0, helmet = false, cap = false } = {}) {
  const M = headMesh(headShape(p), { coarse: lod > 0 });
  const rel = M.colors[skinOf(p)];
  const skin = p.skin.clone();
  // (Tanned and weathered like the backs of his hands: a summer outdoors.)
  const tan = skin
    .clone()
    .multiplyScalar(0.86)
    .lerp(new THREE.Color(0.3, 0.15, 0.085), 0.12);
  const hairC = p.hair,
    browC = p.brows;
  const stub = p.stubble || 0;
  const stubC = skin
    .clone()
    .multiplyScalar(0.62)
    .lerp(new THREE.Color(0.18, 0.19, 0.22), 0.35)
    .lerp(hairC, 0.25);
  const dirt = p.dirt || 0;
  const grime = new THREE.Color(0.12, 0.1, 0.075);
  const col = new THREE.Color();
  const cur = [];
  b.bones((x, y, z, o) => setN(o, cur));
  b.material(CELL.skin);
  b.part();
  const base = b.count;
  const s = 1 / b.texWorld;
  const P = M.positions,
    N = M.normals;
  const under = new Float32Array(M.count * 3); // each vertex's painted color (the hair cap's edge fades into it)
  // How much hair a vertex has: the scalp MakeHuman's short hair covers, above
  // this man's hairline and thinner at the sides.
  const hairAt = (i) => {
    const ly = P[i * 3 + 1] - HC.y,
      lz = P[i * 3 + 2] - HC.z,
      ax = Math.abs(P[i * 3]);
    if (!M.hair[i]) return 0;
    // (The forehead's hairline, further back at the temples and with age.)
    const front = lz < -0.02 ? smooth01(0.058 + (p.recede || 0) * 0.016 + 0.014 * smooth01(0.035, 0.065, ax) * (lz < -0.05 ? 1 : 0), 0.07 + (p.recede || 0) * 0.016 + 0.014 * smooth01(0.035, 0.065, ax), ly) : 1;
    // Cropped at the sides and the nape: fading out toward the ears and neck.
    const side = lz >= -0.02 || ax > 0.05 ? lerp(0.25, 1, smooth01(-0.01, 0.055, ly)) * (ly < 0.04 ? (p.sides ?? 0.8) : 1) : 1;
    return M.hair[i] * front * side;
  };
  for (let i = 0; i < M.count; i++) {
    const x = P[i * 3],
      y = P[i * 3 + 1],
      z = P[i * 3 + 2];
    const nx = N[i * 3],
      ny = N[i * 3 + 1],
      nz = N[i * 3 + 2];
    const h = M.head[i];
    const chest = (1 - h) * smooth01(1.5, 1.44, y);
    cur.length = 0;
    cur.push(B.head, h, B.neck, 1 - h - chest, B.chest, chest);
    // His tone under the skin's own variation (kept within bounds: the
    // inside of the mouth and the rims of the eyes are far off the middle).
    const r = Math.min(1.6, Math.max(0.4, rel[i * 3])),
      g = Math.min(1.6, Math.max(0.35, rel[i * 3 + 1])),
      bl = Math.min(1.6, Math.max(0.35, rel[i * 3 + 2]));
    col.setRGB(tan.r * r, tan.g * g, tan.b * bl);
    const ly = y - HC.y,
      lz = z - HC.z;
    const front = lz < -0.03;
    // Stubble: the jaw and chin and under them, not the lips (redder than the skin round them).
    const lip = smooth01(1.12, 1.3, r / Math.max(0.01, g));
    if (stub > 0) col.lerp(stubC, stub * 0.5 * smooth01(0.15, 0.7, M.jaw[i]) * (1 - lip) * (front || ly < -0.07 ? 1 : 0.5));
    // Brows.
    if (M.brow[i] > 0) col.lerp(browC, 0.8 * M.brow[i] ** 1.25);
    // Hair on the scalp.
    const ha = hairAt(i);
    if (ha > 0) col.lerp(hairC, 0.92 * ha);
    // Under a helmet's brim the face is shaded (lightly: its cast shadow does the rest).
    if (helmet && front) col.multiplyScalar(1 - 0.1 * smooth01(-0.01, 0.04, ly));
    // Field grime: smudges of dust and sweat a few centimetres across.
    if (dirt > 0) col.lerp(grime, dirt * 0.3 * smooth01(0.45, 0.9, noise3(x * 28 + p.tone, y * 28, z * 28)) * (front ? 1 : 0.6));
    b.paint(col);
    under[i * 3] = col.r;
    under[i * 3 + 1] = col.g;
    under[i * 3 + 2] = col.b;
    const ax = Math.abs(nx),
      ay = Math.abs(ny),
      az = Math.abs(nz);
    const u = ax >= ay && ax >= az ? z : x,
      v = ay > ax && ay >= az ? z : y;
    b.vertex(x, y, z, nx, ny, nz, u * s, v * s);
  }
  for (let t = 0; t < M.index.length; t++) b.idx.push(base + M.index[t]);
  // The hair itself: a thin cap over the scalp, flat under headgear, fuller
  // on top without, clipped short at the sides.
  {
    const covered = helmet || cap;
    const top = covered ? 0.0015 : (p.hairTop ?? 0.012);
    const _hc = new THREE.Color();
    b.material(CELL.hair);
    b.bones(B.head);
    b.part();
    const slot = new Map();
    const at = (i) => {
      let k = slot.get(i);
      if (k !== undefined) return k;
      const ly = P[i * 3 + 1] - HC.y;
      const ha = hairAt(i);
      const thick = (lerp(0.0008, top, smooth01(0.035, 0.09, ly)) * smooth01(0.45, 1, ha) + 0.0003) * (ha > 0.45 ? 1 : 0);
      // (Its edge lies on the skin in the skin's color: no saw-toothed hairline.)
      col.setRGB(under[i * 3], under[i * 3 + 1], under[i * 3 + 2]).lerp(_hc.copy(hairC).multiplyScalar(0.85 + 0.25 * smooth01(0, 0.1, ly)), smooth01(0.2, 0.6, ha));
      b.paint(col);
      k = b.vertex(P[i * 3] + N[i * 3] * thick, P[i * 3 + 1] + N[i * 3 + 1] * thick, P[i * 3 + 2] + N[i * 3 + 2] * thick, N[i * 3], N[i * 3 + 1], N[i * 3 + 2], P[i * 3] * s, P[i * 3 + 2] * s);
      slot.set(i, k);
      return k;
    };
    for (let t = 0; t < M.index.length; t += 3) {
      const i0 = M.index[t],
        i1 = M.index[t + 1],
        i2 = M.index[t + 2];
      // (Where there is hair at any corner: the cap's edge lies on the skin.)
      if (Math.max(hairAt(i0), hairAt(i1), hairAt(i2)) < 0.45) continue;
      // (None under headgear: the scalp there is hair-colored and out of sight.)
      if (covered && Math.min(P[i0 * 3 + 1], P[i1 * 3 + 1], P[i2 * 3 + 1]) - HC.y > 0.07) continue;
      b.idx.push(at(i0), at(i1), at(i2));
    }
  }
  b.material(CELL.skin);
  b.bones(B.head);
  const f = faceShape(p);
  for (const sd of [-1, 1]) {
    const c = sd < 0 ? M.eyes.L : M.eyes.R;
    if (lod > 0) {
      // Eyes as dark spots for the middle distance.
      b.paint(new THREE.Color(0.05, 0.04, 0.035));
      b.part();
      b.ellipsoid([c.x, c.y, c.z - M.eyes.r * 0.45], [0.0115, 0.0055, 0.006], { nu: 5, nv: 3 });
    } else buildEye(b, sd, f, p, { center: c.clone(), radius: M.eyes.r, lids: false });
  }
}

// Neck: from inside the collar up into the head, with the larynx.
export function buildNeck(b, { lod = 0, skin, low = 1.43 } = {}) {
  if (lod < 2) return; // (the sculpted head has its own)
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
      // (A soldier's neck: about 40 cm round, and wider into the shoulders.)
      const rx = lerp(0.08, 0.0635, Math.sqrt(t)),
        rz = lerp(0.071, 0.064, t);
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
// Hands. They stand straight in the bind pose (fingers down, palm toward the
// body, thumb forward) and are skinned to the finger bones, which close them
// around a grip. In full detail a sculpted hand (handMesh.js); further off a
// mitten of two blocks and a thumb, then one block.
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

export function buildHand(b, side, { lod = 0, skin, nails, glove = null, dirt = 0 } = {}) {
  const hand = side < 0 ? B.handL : B.handR;
  const H = (x, y, z) => handPoint(side, [x, y, z]);
  b.material(glove ? glove.cell : CELL.skin);
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
  // Full detail: a sculpted hand (handMesh.js: the hand of the MakeHuman base
  // mesh, fitted to this hand's joints and finger bones), bare or gloved.
  const M = handMesh();
  const fore = side < 0 ? B.forearmL : B.forearmR;
  const boneOf = { fore, hand };
  for (const f of FINGER_NAMES) {
    const [b1, b2] = FINGER_BONES[side][f];
    boneOf[f + 1] = b1;
    boneOf[f + 2] = b2;
  }
  // A glove is the hand a little thicker (leather or wool, ~1.5 mm).
  const thick = glove ? 0.0015 : 0;
  // Bare skin: the back tanned and weathered by a summer outdoors, the palm
  // paler and pinker, knuckles ruddy, the nails paler with a sheen, grime
  // worked in (blotchy, not uniform).
  const sk = !glove && skin ? skin.clone() : null;
  const tan = sk ? sk.clone().multiplyScalar(0.82).lerp(new THREE.Color(0.3, 0.15, 0.085), 0.16) : null;
  const palmC = sk ? sk.clone().multiplyScalar(0.95).lerp(new THREE.Color(0.7, 0.42, 0.34), 0.16) : null;
  const ruddy = new THREE.Color(0.5, 0.24, 0.17);
  const grime = new THREE.Color(0.12, 0.09, 0.07);
  const NAIL_EDGE = new THREE.Color(0.6, 0.52, 0.46);
  const nailC =
    nails ||
    (sk
      ? sk
          .clone()
          .multiplyScalar(0.9)
          .lerp(new THREE.Color(0.7, 0.5, 0.45), 0.35)
      : null);
  const J = Object.fromEntries(FINGER_NAMES.map((f) => [f, HAND_JOINTS[f].map((q) => new THREE.Vector3(...q))]));
  const q = new THREE.Vector3(),
    d = new THREE.Vector3(),
    col = new THREE.Color();
  const cur = [];
  b.bones((x, y, z, o) => setN(o, cur));
  b.material(glove ? glove.cell : CELL.skin);
  const base = b.count;
  const prim0 = b.primId + 1;
  const s = 1 / b.texWorld;
  for (let i = 0; i < M.count; i++) {
    const px = M.positions[i * 3],
      py = M.positions[i * 3 + 1],
      pz = M.positions[i * 3 + 2];
    const nx = M.normals[i * 3],
      ny = M.normals[i * 3 + 1],
      nz = M.normals[i * 3 + 2];
    cur.length = 0;
    for (const [name, w] of M.bones[i].slice(0, 4)) cur.push(boneOf[name], w);
    let gloss = 0;
    if (glove) col.set(glove.color);
    else if (sk) {
      // (nx > 0: the back of the hand, in the hand's own frame.)
      const back = smooth01(-0.25, 0.35, nx);
      col.copy(palmC).lerp(tan, back);
      // Each finger's knuckles on the back; its nail over the last joint.
      for (let fi = 0; fi < 5; fi++) {
        const f = FINGER_NAMES[fi];
        const P = J[f];
        const mine = M.part[i] === fi + 1;
        if (!mine && M.part[i] !== 0) continue;
        q.set(px, py, pz);
        for (const k of fi === 0 ? [1, 2] : [0, 1, 2]) col.lerp(ruddy, 0.2 * back * Math.exp(-((q.distanceTo(P[k]) / 0.0085) ** 2)));
        if (!mine) continue;
        // Along the last bone (0 at the joint, 1 at the tip) and off its line.
        d.copy(P[3]).sub(P[2]);
        const L = d.length();
        d.divideScalar(L);
        const t = q.sub(P[2]).dot(d) / L;
        const off = q.addScaledVector(d, -t * L).length();
        // The nail faces out of the back of that finger (the thumb's faces forward and out).
        const facing = f === 'thumb' ? nx * 0.5 - nz * 0.85 : nx;
        const nail = smooth01(0.3, 0.42, t) * smooth01(1.06, 0.96, t) * smooth01(0.5, 0.75, facing) * smooth01(0.0085, 0.0065, off);
        if (nail > 0 && nailC) {
          col.lerp(nailC, nail);
          // The pale edge of the nail, and dirt under it.
          col.lerp(NAIL_EDGE, 0.18 * nail * smooth01(0.88, 0.97, t));
          if (dirt) col.lerp(grime, dirt * 0.5 * nail * smooth01(0.84, 0.94, t));
          gloss = 0.55 * nail;
        }
        // Fingertips pinker on the palm side.
        col.lerp(ruddy, 0.1 * (1 - back) * smooth01(0.3, 0.9, t));
      }
      // Tone variation and grime.
      col.multiplyScalar(0.93 + 0.14 * noise3(px * 90 + side, py * 90, pz * 90));
      if (dirt) col.lerp(grime, dirt * 0.2 * smooth01(0.45, 0.85, noise3(px * 140, py * 140 + 3, pz * 140)));
    } else col.copy(b.color);
    b.paint(col);
    b.gloss = glove ? 0 : gloss;
    // (Each finger its own part, so the baked contact shade falls between them.)
    b.primId = prim0 + M.part[i];
    const w = handPoint(side, [px + nx * thick, py + ny * thick, pz + nz * thick]);
    // Texture placed by the side the skin faces (it has no layout of its own).
    const ax = Math.abs(nx),
      ay = Math.abs(ny),
      az = Math.abs(nz);
    const u = ax >= ay && ax >= az ? pz : px,
      v = ay > ax && ay >= az ? pz : py;
    b.vertex(w.x, w.y, w.z, side < 0 ? -nx : nx, ny, nz, u * s, v * s);
  }
  b.primId = prim0 + 5;
  b.gloss = 0;
  for (let t = 0; t < M.index.length; t += 3) {
    // (A left hand is the right one mirrored: its triangles wind the other way.)
    if (side < 0) b.idx.push(base + M.index[t], base + M.index[t + 2], base + M.index[t + 1]);
    else b.idx.push(base + M.index[t], base + M.index[t + 1], base + M.index[t + 2]);
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
    // (The wrist is flat the way the hand is: the arm hangs palm to the body,
    // so the wrist is wide front to back and thin across. Built the other way
    // round it stood out over the hand like a paper cuff.)
    const rx = t < 0 ? 0.041 : lerp(0.041, 0.0205, Math.min(1, t) ** 0.85) + 0.005 * Math.exp(-(((t - 0.2) / 0.25) ** 2));
    const rz = t < 0 ? 0.041 : lerp(0.041, 0.0285, Math.min(1, t)) + 0.006 * Math.exp(-(((t - 0.2) / 0.25) ** 2));
    const c = chainPoint(P, s, new THREE.Vector3());
    rows.push({ c, rx, rz, t });
  }
  // The forearm is not round: the muscle that turns the wrist stands out on
  // the thumb side below the elbow (the arm hangs thumb forward), the
  // flexors fill the inside, the elbow's point is at the back and the end of
  // the ulna shows at the back of the wrist; toward the wrist it is flat,
  // tendons front and back. (a: 0 = +X, PI/2 = back, -PI/2 = front.)
  const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  const disp = lod
    ? null
    : (k, a, ring) => {
        const t = ring.t;
        if (t === undefined) return 0;
        const front = Math.max(0, -Math.sin(a)),
          back = Math.max(0, Math.sin(a)),
          inner = Math.max(0, -Math.cos(a) * side),
          outer = Math.max(0, Math.cos(a) * side);
        let d = 0;
        d += 0.0065 * front ** 1.5 * bell(t, 0.16, 0.2);
        d += 0.0045 * inner ** 2 * bell(t, 0.24, 0.2);
        d += 0.003 * outer ** 2 * bell(t, 0.2, 0.2);
        d += 0.0045 * back ** 3 * bell(t, -0.02, 0.07);
        d += 0.003 * (back * outer * 2) ** 2 * bell(t, 0.95, 0.05);
        // The hollow between the two muscle groups, down the outside.
        d -= 0.0015 * (outer * front * 2) ** 2 * bell(t, 0.35, 0.25);
        return d;
      };
  b.tube(rows, { seg: lod ? 6 : 16, capStart: 0, capEnd: 0, disp });
  b.colorFn = null;
}
