// Soviet vehicles. Conventions (vkit.js): meters, +X right, +Y up, -Z forward; origin on the
// ground at the middle of the wheelbase (wheeled) or of the track contact length (tracked).
import { S, DEG, ribbon, circle, mirrorHalf, latheGeo, prismGeoX, roundRect, slotV } from './vkit.js';
import { jeepWheel, roadWheel, runningGear, boltRing, steeringWheel } from './parts.js';

const side = (s) => (s < 0 ? 'L' : 'R');

// Small helpers for the tank fittings below.
const lerp = (a, c, t) => a.map((v, i) => v + (c[i] - v) * t);
const vadd = (a, c, k = 1) => a.map((v, i) => v + c[i] * k);
const unit = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];

// Curve from a to c that bends toward the corner point k (n steps).
function bend(a, k, c, n = 4) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(a.map((v, j) => v * (1 - t) * (1 - t) + 2 * k[j] * t * (1 - t) + c[j] * t * t));
  }
  return out;
}

// Closed outline with its corners rounded off: each corner is cut back by d along both
// edges and bridged with a curve. Points on a straight run are kept.
function softCorners(pts, d, n = 3) {
  const out = [];
  const N = pts.length;
  for (let i = 0; i < N; i++) {
    const p = pts[i],
      a = pts[(i - 1 + N) % N],
      c = pts[(i + 1) % N];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]),
      lc = Math.hypot(c[0] - p[0], c[1] - p[1]);
    const turn = ((a[0] - p[0]) * (c[1] - p[1]) - (a[1] - p[1]) * (c[0] - p[0])) / (la * lc);
    if (Math.abs(turn) < 0.05) {
      out.push(p);
      continue;
    }
    out.push(...bend(lerp(p, a, Math.min(d, la * 0.45) / la), p, lerp(p, c, Math.min(d, lc * 0.45) / lc), n));
  }
  return out;
}

// Hand rail: a bar between two points on a plate, standing h off it on a post at each end.
// n = the plate's outward direction (unit length).
function handRail(b, a, c, n, h, mat, r = 0.014, seg = 8) {
  const A = vadd(a, n, h),
    B = vadd(c, n, h);
  const e = unit(vadd(B, A, -1)).map((v) => v * r * 0.6);
  b.rod({ from: vadd(A, e, -1), to: vadd(B, e), r, mat, seg });
  b.rod({ from: vadd(a, n, -0.015), to: vadd(A, n, r * 0.6), r, mat, seg });
  b.rod({ from: vadd(c, n, -0.015), to: vadd(B, n, r * 0.6), r, mat, seg });
}

// Tow hook, side view: [along the plate, off the plate]. The mouth opens toward +along.
const HOOK = [
  [-0.075, 0],
  [0.065, 0],
  [0.065, 0.026],
  [0.008, 0.03],
  [0.002, 0.058],
  [0.03, 0.07],
  [0.056, 0.058],
  [0.072, 0.076],
  [0.044, 0.1],
  [-0.014, 0.098],
  [-0.058, 0.07],
  [-0.075, 0.03],
];

// Round hatch on a turret roof, axis up: a raised rim with a slightly domed lid, hinged at
// the front edge, with a grab handle. y = roof height, r = lid radius.
function roofHatch(b, x, y, z, r, mat, P) {
  b.latheDir({
    profile: [
      [0, 0.066],
      [r * 0.5, 0.064],
      [r * 0.85, 0.054],
      [r - 0.008, 0.042],
      [r, 0.032],
      [r + 0.014, 0.03],
      [r + 0.028, 0.02],
      [r + 0.028, 0],
      [0, 0],
    ],
    at: [x, y, z],
    dir: [0, 1, 0],
    mat,
    seg: 20,
  });
  for (const dx of [-0.08, 0.08]) b.box({ x: x + dx, y: y + 0.035, z: z - r - 0.01, w: 0.05, h: 0.04, d: 0.07, r: 0.008, mat: P });
  b.cylAxis({ axis: 'x', x, y: y + 0.045, z: z - r - 0.022, len: 0.24, r: 0.014, mat: P, seg: 8 });
  handRail(b, [x - 0.06, y + 0.055, z + r * 0.55], [x + 0.06, y + 0.055, z + r * 0.55], [0, 1, 0], 0.03, P, 0.008, 6);
}

// Periscope head on a turret roof: a round base, the boxed head with its window to the
// front, and a cover plate. top = height of the top of the cover.
function periscope(b, x, y, z, top, P) {
  const h = top - y;
  b.cylAxis({ axis: 'y', x, y: y + 0.012, z, len: 0.03, r: 0.07, mat: P, seg: 10 });
  b.box({ x, y: y + h / 2, z, w: 0.095, h: h - 0.006, d: 0.11, r: 0.012, mat: P });
  b.box({ x, y: top - 0.005, z: z + 0.005, w: 0.115, h: 0.01, d: 0.135, r: 0, mat: P });
  b.box({ x, y: y + h * 0.6, z: z - 0.056, w: 0.07, h: h * 0.3, d: 0.004, r: 0, mat: 'dark' });
}

// T-34 drive sprocket: two dished discs with six rollers between them (they engage the
// guide horn of every second link), axis X, outer face +X.
function t34Sprocket({ r, gap, mat }) {
  const items = [];
  const disc = (x0, x1, flip) =>
    latheGeo(
      (flip ? (p) => p.map(([rr, x]) => [rr, -x]) : (p) => p)([
        [0, x1 + 0.06],
        [0.12, x1 + 0.06],
        [0.14, x1 + 0.02],
        [0.2, x1],
        [r - 0.03, x1 - 0.005],
        [r, x1 - 0.015],
        [r, x0],
        [0.16, x0],
        [0, x0],
      ]),
      { seg: 28, crease: 0.6 },
    );
  items.push({ mat, geo: disc(gap / 2, gap / 2 + 0.03, false) });
  items.push({ mat, geo: disc(gap / 2, gap / 2 + 0.03, true) });
  const rollers = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rollers.push(circle(0.045, 12, (r - 0.05) * Math.cos(a), (r - 0.05) * Math.sin(a)));
  }
  items.push({ mat: 'track', geo: prismGeoX(rollers, -gap / 2, gap / 2, { bevel: 0.004, bevelSegments: 1 }) });
  items.push({ mat, geo: prismGeoX(circle(0.17, 20), -gap / 2, gap / 2, { bevel: 0 }) });
  items.push({ mat, geo: prismGeoX(boltRing(8, 0.09, 0.014), gap / 2 + 0.085, gap / 2 + 0.1, { bevel: 0 }) });
  return items;
}

// ---------------------------------------------------------------------------------------
// T-34 hull shared by the T-34/76 and T-34-85: hull, Christie running gear, tracks,
// fenders and mudguards, hatches, stowage, external fuel drums, engine deck, hull armor
// and hull modules. Returns helpers for the turret code.
function t34Hull(b, { spoked = false } = {}) {
  const P = 'sovietGreen',
    C = 'sovietCast';
  // ---- Running gear -------------------------------------------------------------------------
  const T = 0.05,
    RW = 0.415,
    yW = RW + T,
    OX = 1.225;
  const wheels = [-1.92, -0.96, 0, 0.96, 1.92].map((z) => [z, yW]);
  const SPR = { z: 2.55, y: 0.545 },
    IDL = { z: -2.56, y: 0.58 };
  runningGear(b, {
    wheels,
    wheel: roadWheel({ r: RW, width: 0.36, gap: 0.08, tire: 0.06, dish: 0.035, hubR: 0.1, hubLen: 0.06, mat: P, bolts: 8, holes: spoked ? 6 : 0, holeR: 0.075 }),
    wheelR: RW,
    sprocket: { ...SPR, r: 0.33 + T / 2, teeth: 6, items: t34Sprocket({ r: 0.33, gap: 0.13, mat: P }) },
    idler: { ...IDL, r: 0.3 + T / 2, items: roadWheel({ r: 0.3, width: 0.3, gap: 0.1, rubber: false, dish: 0.035, hubR: 0.08, hubLen: 0.05, mat: P, holes: 6 }) },
    track: { width: 0.55, pitch: 0.172, thick: T, offsetX: OX, realLinks: 72, sag: 0.025 },
  });
  // Christie suspension arms on their pivot bosses, idler crank, final drive housing.
  for (const s of [-1, 1]) {
    for (const [z] of wheels) {
      b.rod({ from: [s * 0.96, 0.62, z + 0.24], to: [s * 1.0, yW, z], r: 0.05, mat: P, seg: 8 });
      b.cylAxis({ axis: 'x', x: s * 0.975, y: 0.62, z: z + 0.24, len: 0.08, r: 0.085, mat: P, seg: 10 });
    }
    b.rod({ from: [s * 0.96, 0.72, IDL.z + 0.3], to: [s * 1.02, IDL.y, IDL.z], r: 0.06, mat: P, seg: 8 });
    b.cylAxis({ axis: 'x', x: s * 0.975, y: 0.72, z: IDL.z + 0.3, len: 0.08, r: 0.09, mat: P, seg: 10 });
    b.cylAxis({ axis: 'x', x: s * 0.98, y: SPR.y, z: SPR.z, len: 0.12, r: 0.2, mat: P, seg: 18 });
  }

  // ---- Hull ---------------------------------------------------------------------------------
  const tan60 = Math.tan(60 * DEG),
    tan47 = Math.tan(47 * DEG);
  const gz = (y) => -2.95 + (y - 0.78) * tan60; // upper glacis surface z at height y
  const rz = (y) => 2.97 - (y - 0.88) * tan47; // upper rear plate surface z at height y
  // Lower hull between the tracks (lower glacis 53 deg, lower rear 45 deg). The rounded
  // nose beam joins the two glacis plates.
  b.prismX({
    points: [[-2.45, 0.4], [2.49, 0.4], [2.97, 0.88], [rz(0.98), 0.98], [gz(0.98), 0.98], ...bend([gz(0.83), 0.83], [-2.95, 0.78], [-2.87, 0.7195], 4)],
    x0: -0.95,
    x1: 0.95,
    mat: P,
    bevel: 0.015,
  });
  // Upper hull: glacis, sloped sides (40 deg) over the tracks, roof, upper rear plate.
  const up = [];
  for (const s of [-1, 1]) {
    up.push([s * 1.42, 0.98, gz(0.98)], [s * 0.967, 1.52, gz(1.52)], [s * 0.967, 1.52, rz(1.52)], [s * 1.42, 0.98, rz(0.98)]);
    up.push([s * 0.95, 0.98, gz(0.98)], [s * 0.95, 0.98, rz(0.98)]);
  }
  b.convex({ points: up, mat: P });
  // Frames for fittings on the sloped plates: y points out of the plate. On the glacis z
  // runs up the slope, on the upper rear plate z runs down it.
  const onGlacis = (x, y, build) => b.place({ pos: [x, y, gz(y)], rot: [-30 * DEG, 0, 0] }, build);
  const onRear = (x, y, build) => b.place({ pos: [x, y, rz(y)], rot: [43 * DEG, 0, 0] }, build);

  // Fenders: a narrow shelf along each sponson with a turned-down outer edge. The front
  // mudguards curve down round the idler, short rear ones round the sprocket.
  const sheet = (cz, cy, r0, r1, a1, dir, flat, n = 8) => {
    const at = (r, a) => [cz + dir * r * Math.sin(a), cy + r * Math.cos(a)];
    const out = [];
    for (let i = n; i >= 0; i--) out.push(at(r1, (a1 * i) / n));
    if (flat) out.push([cz - dir * flat, cy + r1], [cz - dir * flat, cy + r0]);
    for (let i = 0; i <= n; i++) out.push(at(r0, (a1 * i) / n));
    return out;
  };
  for (const s of [-1, 1]) {
    b.span({ z0: IDL.z + 0.11, z1: SPR.z - 0.1, y0: 0.972, y1: 0.99, w: 0.13, x: s * 1.455, mat: P, r: 0.004 });
    b.span({ z0: IDL.z + 0.11, z1: SPR.z - 0.1, y0: 0.95, y1: 0.99, w: 0.012, x: s * 1.514, mat: P, r: 0 });
    for (const [cz, cy, r1, a1, dir] of [
      [IDL.z, 0.575, 0.415, 80 * DEG, -1],
      [SPR.z, 0.545, 0.445, 50 * DEG, 1],
    ]) {
      b.prismX({ points: sheet(cz, cy, r1 - 0.015, r1, a1, dir, 0.11), x0: s * 0.955, x1: s * 1.52, mat: P, bevel: 0.003, bevelSegments: 1 });
      b.prismX({ points: sheet(cz, cy, r1 - 0.045, r1, a1, dir, 0), x0: s * 1.508, x1: s * 1.52, mat: P, bevel: 0 });
      b.prismX({ points: sheet(cz, cy, r1 - 0.06, r1, a1, dir, 0), x0: s * 0.955, x1: s * 0.967, mat: P, bevel: 0 });
    }
  }
  // Driver's hatch (left of the glacis): a thick plate hinged at the top, with the two
  // periscope housings under their covers.
  onGlacis(-0.33, 1.23, () => {
    b.prismY({ points: roundRect(0, 0, 0.27, 0.34, 0.07, 3), y0: -0.005, y1: 0.045, mat: P, bevel: 0.012, bevelSegments: 1 });
    b.cylAxis({ axis: 'x', x: 0, y: 0.03, z: 0.365, len: 0.4, r: 0.02, mat: P, seg: 8 });
    for (const dx of [-0.15, 0.15]) b.box({ x: dx, y: 0.025, z: 0.35, w: 0.07, h: 0.055, d: 0.08, r: 0.008, mat: P });
    for (const dx of [-0.135, 0.135]) {
      b.box({ x: dx, y: 0.07, z: 0.225, w: 0.12, h: 0.06, d: 0.12, r: 0.012, mat: P });
      b.box({ x: dx, y: 0.104, z: 0.22, w: 0.126, h: 0.01, d: 0.145, r: 0, mat: P });
      b.box({ x: dx, y: 0.074, z: 0.164, w: 0.085, h: 0.022, d: 0.004, r: 0, mat: 'dark' });
    }
  });
  b.anchor('driverEye', -0.33, 1.36, gz(1.36) - 0.1); // between the hatch periscopes
  // Ball-mounted DT machine gun (right of the glacis) in its armored hood.
  {
    const bx = 0.45,
      by = 1.22,
      bz = gz(by);
    onGlacis(bx, by, () => b.cylAxis({ axis: 'y', y: 0.012, len: 0.03, r: 0.185, r1: 0.17, mat: C, seg: 14 }));
    b.sphere({ x: bx, y: by - 0.026, z: bz + 0.015, r: 0.15, mat: C, seg: 16 });
    b.latheDir({
      profile: [
        [0, 0.03],
        [0.09, 0.03],
        [0.08, 0.13],
        [0.055, 0.19],
        [0.05, 0.21],
        [0, 0.21],
      ],
      at: [bx, by, bz + 0.015],
      dir: [0, 0, -1],
      mat: C,
      seg: 10,
    });
    b.cyl({ z0: bz - 0.18, z1: bz - 0.26, r0: 0.02, x: bx, y: by, mat: 'blued', seg: 8 });
    b.anchor('bowMgMuzzle', bx, by, bz - 0.26);
  }
  // Two tow hooks low on the glacis (kept low: they lie ahead of the driver's eye), a row of
  // spare track links between them under a bar.
  for (const s of [-1, 1]) onGlacis(s * 0.62, 0.9, () => b.prismX({ points: HOOK.map(([u, v]) => [u * 1.1, v * 0.55]), x0: -0.035, x1: 0.035, mat: P, bevel: 0.008, bevelSegments: 1 }));
  onGlacis(0.0, 0.94, () => {
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.173;
      b.box({ x, y: 0.016, z: 0, w: 0.162, h: 0.026, d: 0.46, r: 0.005, mat: 'track' });
      for (const dz of [-0.2, 0.2]) b.box({ x, y: 0.03, z: dz, w: 0.172, h: 0.012, d: 0.035, r: 0, mat: 'track' });
      if (i % 2 === 0) b.box({ x, y: 0.036, z: 0, w: 0.05, h: 0.026, d: 0.07, r: 0, mat: 'track' });
    }
    b.box({ x: 0, y: 0.036, z: 0.1, w: 0.8, h: 0.012, d: 0.04, r: 0, mat: P });
    for (const s of [-1, 1]) b.cylAxis({ axis: 'y', x: s * 0.375, y: 0.024, z: 0.1, len: 0.05, r: 0.015, mat: P, seg: 6 });
  });
  // Headlight in its fork on the left of the glacis, horn on the right.
  {
    const hx = -0.78,
      hy = 1.16,
      hz = gz(1.12) - 0.02;
    b.latheDir({
      profile: [
        [0, 0],
        [0.045, 0.006],
        [0.075, 0.04],
        [0.086, 0.085],
        [0.086, 0.126],
        [0.076, 0.13],
        [0.076, 0.118],
        [0, 0.118],
      ],
      at: [hx, hy, hz],
      dir: [0, 0, -1],
      mat: P,
      seg: 14,
    });
    b.cyl({ z0: hz - 0.126, z1: hz - 0.118, r0: 0.074, x: hx, y: hy, mat: 'lamp', seg: 14 });
    for (const s of [-1, 1]) b.box({ x: hx + s * 0.096, y: hy - 0.05, z: hz - 0.06, w: 0.014, h: 0.15, d: 0.035, r: 0, mat: P });
    b.cylAxis({ axis: 'x', x: hx, y: hy, z: hz - 0.06, len: 0.23, r: 0.012, mat: P, seg: 6 });
    b.anchor('headlightL', hx, hy, hz - 0.13);
    b.latheDir({
      profile: [
        [0, 0],
        [0.035, 0],
        [0.04, 0.05],
        [0.06, 0.07],
        [0.06, 0.09],
        [0.05, 0.085],
        [0, 0.07],
      ],
      at: [0.85, 1.12, gz(1.12)],
      dir: [0, 0, -1],
      mat: P,
      seg: 10,
    });
  }
  // Hand rails for riding infantry along the sloped sides.
  const sideN = [Math.cos(40 * DEG), Math.sin(40 * DEG)]; // outward normal of the right side plate
  const onSide = (s, t, off) => [s * (1.42 - 0.453 * t + sideN[0] * off), 0.98 + 0.54 * t + sideN[1] * off];
  for (const s of [-1, 1]) {
    const [qx, qy] = onSide(s, 0.74, 0);
    for (const z of s < 0 ? [-1.55, -0.72, 0.11, 0.94] : [-1.55, -0.72, 0.11]) handRail(b, [qx, qy, z - 0.3], [qx, qy, z + 0.3], [s * sideN[0], sideN[1], 0], 0.07, P);
  }
  // External fuel drums (2 right, 1 left), each strapped onto two saddle brackets.
  const drum = (s, z) => {
    const [dx, dy] = onSide(s, 0.48, 0.2);
    const [fx, fy] = onSide(s, 0.48, 0.05);
    b.latheDir({
      profile: [
        [0, -0.322],
        [0.15, -0.322],
        [0.156, -0.34],
        [0.172, -0.34],
        [0.18, -0.328],
        [0.18, 0.328],
        [0.172, 0.34],
        [0.156, 0.34],
        [0.15, 0.322],
        [0, 0.322],
      ],
      at: [dx, dy, z],
      dir: [0, 0, 1],
      mat: P,
      seg: 18,
    });
    for (const dz of [-0.2, 0.2]) {
      b.cyl({ z0: z + dz - 0.022, z1: z + dz + 0.022, r0: 0.193, x: dx, y: dy, mat: P, seg: 18 });
      b.box({ x: fx, y: fy, z: z + dz, w: 0.3, h: 0.1, d: 0.06, r: 0, rz: -s * 50 * DEG, mat: P });
    }
    b.cylAxis({ axis: 'y', x: dx, y: dy + 0.188, z: z - 0.25, len: 0.04, r: 0.035, mat: P, seg: 8 }); // filler cap
    handRail(b, [dx - 0.05, dy, z - 0.322], [dx + 0.05, dy, z - 0.322], [0, 0, -1], 0.03, P, 0.007, 6); // carrying handle
  };
  drum(1, 0.85);
  drum(1, 1.85);
  drum(-1, 1.85);
  // Stowage boxes standing on the fenders against the sloped sides (left rear, right front).
  const stow = (s, z0, z1, h) => {
    const top = 0.99 + h,
      xi = 1.42 - (top + 0.05 - 0.98) * 0.839;
    b.prismZ({ points: [[s * 1.38, 0.985], [s * 1.5, 0.985], [s * 1.5, top], [s * (xi - 0.02), top + 0.05]], z0, z1, mat: P, bevel: 0.008, bevelSegments: 1 });
    b.prismZ({ points: [[s * 1.512, top - 0.012], [s * 1.512, top + 0.008], [s * (xi - 0.02), top + 0.062], [s * (xi - 0.02), top + 0.04]], z0: z0 - 0.012, z1: z1 + 0.012, mat: P, bevel: 0.003, bevelSegments: 1 });
    for (const z of [z0 + 0.12, z1 - 0.12]) b.box({ x: s * 1.506, y: top - 0.035, z, w: 0.014, h: 0.07, d: 0.035, r: 0, mat: P });
  };
  stow(-1, 0.5, 1.2, 0.2);
  stow(1, -2.15, -1.6, 0.17);
  // Ice cleats strapped on the left front fender, a two-man saw clamped to the left side.
  for (let i = 0; i < 6; i++) b.box({ x: -1.41, y: 1.05, z: -2.28 + i * 0.085, w: 0.2, h: 0.12, d: 0.03, r: 0, rx: 0.25, mat: 'track' });
  b.box({ x: -1.44, y: 1.118, z: -2.07, w: 0.03, h: 0.008, d: 0.52, r: 0, mat: P });
  {
    const [qx, qy] = onSide(-1, 0.33, 0);
    b.place({ pos: [qx, qy, -0.4], rot: [0, 0, 50 * DEG] }, () => {
      b.box({ y: 0.012, w: 0.1, h: 0.005, d: 1.2, r: 0, mat: 'track' });
      for (const dz of [-0.6, 0.6]) b.box({ x: 0.02, y: 0.02, z: dz, w: 0.16, h: 0.028, d: 0.028, r: 0.008, mat: P });
      for (const dz of [-0.3, 0.3]) b.box({ y: 0.012, z: dz, w: 0.14, h: 0.024, d: 0.04, r: 0.004, mat: P });
    });
  }
  // Engine deck: the engine hatch between the two louvred air intakes, then the big
  // raised mesh cover over the radiator outlet at the back.
  b.prismY({ points: roundRect(0, 1.02, 0.34, 0.42, 0.04, 2), y0: 1.515, y1: 1.555, mat: P, bevel: 0.01, bevelSegments: 1 });
  b.cylAxis({ axis: 'y', x: 0, y: 1.565, z: 0.92, len: 0.03, r: 0.13, r1: 0.115, mat: P, seg: 12 });
  for (const dx of [-0.2, 0.2]) b.box({ x: dx, y: 1.55, z: 0.6, w: 0.08, h: 0.035, d: 0.07, r: 0.008, mat: P });
  handRail(b, [-0.08, 1.555, 1.32], [0.08, 1.555, 1.32], [0, 1, 0], 0.035, P, 0.009, 6);
  for (const s of [-1, 1]) {
    b.prismY({ points: roundRect(s * 0.66, 1.02, 0.25, 0.44, 0.03, 2), holes: [roundRect(s * 0.66, 1.02, 0.2, 0.39, 0)], y0: 1.515, y1: 1.568, mat: P, bevel: 0.006, bevelSegments: 1 });
    b.box({ x: s * 0.66, y: 1.524, z: 1.02, w: 0.42, h: 0.01, d: 0.8, r: 0, mat: 'black' });
    for (let i = 0; i < 5; i++) b.box({ x: s * (0.5 + i * 0.08), y: 1.544, z: 1.02, w: 0.055, h: 0.008, d: 0.78, r: 0, rz: s * 0.95, mat: P });
  }
  b.box({ x: 0, y: 1.526, z: 1.915, w: 1.58, h: 0.014, d: 0.66, r: 0, mat: 'black' });
  for (let i = 0; i < 7; i++) b.box({ x: 0, y: 1.553, z: 1.64 + i * 0.092, w: 1.58, h: 0.008, d: 0.085, r: 0, rx: 0.5, mat: P });
  b.prismY({ points: roundRect(0, 1.915, 0.83, 0.365, 0.05, 2), holes: [roundRect(0, 1.915, 0.785, 0.32, 0)], y0: 1.515, y1: 1.6, mat: P, bevel: 0.008, bevelSegments: 1 });
  for (let i = -7; i <= 7; i++) b.box({ x: i * 0.1, y: 1.589, z: 1.915, w: 0.012, h: 0.01, d: 0.65, r: 0, mat: P });
  for (let i = -3; i <= 3; i++) b.box({ x: 0, y: 1.592, z: 1.915 + i * 0.09, w: 1.58, h: 0.01, d: 0.012, r: 0, mat: P });
  // Upper rear plate: round transmission hatch, bolts along the plate's edges, taillight.
  onRear(0, 1.2, () => {
    b.latheDir({
      profile: [
        [0, 0.046],
        [0.2, 0.046],
        [0.27, 0.034],
        [0.29, 0.022],
        [0.36, 0.02],
        [0.36, 0],
        [0, 0],
      ],
      at: [0, 0, 0],
      dir: [0, 1, 0],
      mat: P,
      seg: 24,
    });
    b.prismY({ points: boltRing(8, 0.326, 0.014, Math.PI / 8), y0: 0.015, y1: 0.034, mat: P, bevel: 0 });
    b.box({ x: 0, y: 0.022, z: 0.375, w: 0.14, h: 0.04, d: 0.07, r: 0.008, mat: P });
    b.cylAxis({ axis: 'x', x: 0, y: 0.036, z: 0.4, len: 0.2, r: 0.018, mat: P, seg: 8 });
    handRail(b, [-0.07, 0.046, -0.1], [0.07, 0.046, -0.1], [0, 1, 0], 0.035, P, 0.009, 6);
    const bolts = [];
    for (let i = 0; i < 8; i++) bolts.push(circle(0.016, 6, -0.84 + i * 0.24, -0.43), circle(0.016, 6, -0.84 + i * 0.24, 0.43));
    for (const s of [-1, 1]) for (const y of [1.08, 1.24, 1.4]) bolts.push(circle(0.016, 6, s * (1.37 - (y - 0.98) * 0.839), (1.2 - y) / Math.sin(43 * DEG)));
    b.prismY({ points: bolts, y0: -0.004, y1: 0.012, mat: P, bevel: 0 });
    b.box({ x: -0.82, y: 0.026, z: -0.19, w: 0.08, h: 0.052, d: 0.07, r: 0.01, mat: P });
    b.box({ x: -0.82, y: 0.054, z: -0.19, w: 0.05, h: 0.006, d: 0.04, r: 0, mat: 'redLamp' });
  });
  // Exhaust pipes in their armored collars, hinge lugs along the plate's lower edge.
  {
    const n = [0, Math.sin(47 * DEG), Math.cos(47 * DEG)];
    for (const s of [-1, 1]) {
      const y = 1.0;
      b.latheDir({
        profile: [
          [0, 0.085],
          [0.07, 0.085],
          [0.105, 0.06],
          [0.125, 0.022],
          [0.14, 0.014],
          [0.14, 0],
          [0, 0],
        ],
        at: [s * 0.62, y, rz(y)],
        dir: n,
        mat: C,
        seg: 14,
      });
      b.cyl({ z0: rz(y) + 0.02, z1: rz(y) + 0.16, r0: 0.055, x: s * 0.62, y: y - 0.04, mat: 'black', seg: 12 });
      b.cyl({ z0: rz(y) + 0.15, z1: rz(y) + 0.1605, r0: 0.043, x: s * 0.62, y: y - 0.04, mat: 'dark', seg: 10 });
      b.anchor(`exhaust${side(s)}`, s * 0.62, y - 0.04, rz(y) + 0.17);
      b.cylAxis({ axis: 'x', x: s * 0.3, y: 0.895, z: 2.95, len: 0.18, r: 0.035, mat: P, seg: 8 });
      // Tow hook on the lower rear plate.
      b.place({ pos: [s * 0.6, 0.72, 2.81], rot: [135 * DEG, 0, 0] }, () => b.prismX({ points: HOOK.map(([u, v]) => [-u, v]), x0: -0.03, x1: 0.03, mat: P, bevel: 0.008, bevelSegments: 1 }));
    }
  }

  // ---- Hull armor and modules (vehicle space) --------------------------------------------
  // Upper glacis: hexagonal (nose corners, sponson front corners, roof edge).
  b.armorPoly('upperGlacis', 'body', 45, [
    [-0.95, 0.78, -2.95],
    [0.95, 0.78, -2.95],
    [1.42, 0.98, gz(0.98)],
    [0.967, 1.52, gz(1.52)],
    [-0.967, 1.52, gz(1.52)],
    [-1.42, 0.98, gz(0.98)],
  ], [0, 0.5, -1], 5, [1, 0, 0]);
  b.armorZY('lowerGlacis', 'body', 45, [-2.45, 0.4], [-2.95, 0.78], -0.95, 0.95, [0, -0.5, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorPoly(`upperSide${L}`, 'body', 45, [
      [s * 1.42, 0.98, gz(0.98)],
      [s * 1.42, 0.98, rz(0.98)],
      [s * 0.967, 1.52, rz(1.52)],
      [s * 0.967, 1.52, gz(1.52)],
    ], [s, 0.5, 0], 6, [0, 0, 1]);
    b.armorXY(`lowerSide${L}`, 'body', 45, [s * 0.95, 0.4], [s * 0.95, 0.98], -2.5, 2.8, [s, 0, 0]);
    b.armorZY(`sponsonFloor${L}`, 'body', 15, [gz(0.98), 0.98], [rz(0.98), 0.98], s * 0.95, s * 1.42, [0, -1, 0]);
  }
  b.armorZY('roof', 'body', 20, [gz(1.52), 1.52], [rz(1.52), 1.52], -0.967, 0.967, [0, 1, 0]);
  b.armorPoly('rearUpper', 'body', 40, [
    [-0.95, 0.88, 2.97],
    [0.95, 0.88, 2.97],
    [1.42, 0.98, rz(0.98)],
    [0.967, 1.52, rz(1.52)],
    [-0.967, 1.52, rz(1.52)],
    [-1.42, 0.98, rz(0.98)],
  ], [0, 0.5, 1], 5, [1, 0, 0]);
  b.armorZY('rearLower', 'body', 40, [2.97, 0.88], [2.49, 0.4], -0.95, 0.95, [0, -0.5, 1]);
  b.armorZY('bellyFront', 'body', 16, [-2.45, 0.4], [-0.5, 0.4], -0.95, 0.95, [0, -1, 0]);
  b.armorZY('bellyRear', 'body', 13, [-0.5, 0.4], [2.49, 0.4], -0.95, 0.95, [0, -1, 0]);
  b.module('engine', 'body', [0, 1.02, 1.5], [0.45, 0.4, 0.62]);
  b.module('transmission', 'body', [0, 0.82, 2.5], [0.62, 0.3, 0.3]);
  for (const s of [-1, 1]) {
    b.module('fuel', 'body', [s * 1.02, 1.15, -0.55], [0.24, 0.18, 0.75]);
    b.module('fuel', 'body', [s * 1.02, 1.12, 1.4], [0.24, 0.16, 0.45]);
  }
  for (const [s, z] of [
    [1, 0.85],
    [1, 1.85],
    [-1, 1.85],
  ]) {
    const [dx, dy] = onSide(s, 0.48, 0.2);
    b.module('fuel', 'body', [dx, dy, z], [0.18, 0.18, 0.34]); // external drums
  }
  b.module('ammo', 'body', [0, 0.56, -0.55], [0.72, 0.12, 0.55]);
  for (const s of [-1, 1]) b.module('ammo', 'body', [s * 0.8, 1.2, -1.05], [0.14, 0.24, 0.3]);
  b.module('driver', 'body', [-0.42, 1.02, -2.05], [0.25, 0.4, 0.35]);
  b.module('radio', 'body', [0.45, 1.02, -2.0], [0.25, 0.4, 0.35]); // radio operator / bow gunner
  return { P, C, gz, rz, onSide };
}

// ---------------------------------------------------------------------------------------
// T-34/76 model 1942 (STZ/UVZ): hexagonal cast turret ("gaika") with two round roof hatches,
// 76.2 mm F-34 gun, Christie suspension with 5 large road wheels a side, no return rollers,
// rear drive sprocket, front idler, 550 mm waffle tracks (172 mm pitch, 72 links), external
// fuel drums. 6.68 m long with the gun (hull 5.92), 3.0 m wide, 2.45 m high; 28.5 t.
// Armor: upper glacis 45 mm at 60 deg, lower glacis 45 mm at 53 deg, upper sides 45 mm at
// 40 deg, lower sides 45 mm, rear 40 mm at 47 / 45 deg, roof 20 mm, belly 16 / 13 mm;
// turret front 52 mm, sides 52 / 45 mm, rear 45 mm, roof 20 mm, mantlet 45 mm.
export function t34_76(b) {
  const { P, C } = t34Hull(b);
  // ---- Turret: 1942 hexagonal cast turret ------------------------------------------------
  const zT = -0.95,
    yR = 1.52;
  b.part('turret', [0, yR, zT]);
  const base = mirrorHalf([
    [0, -0.82],
    [0.55, -0.82],
    [0.93, -0.22],
    [0.64, 0.95],
    [0, 0.95],
  ]);
  const mid = mirrorHalf([
    [0, -0.78],
    [0.53, -0.78],
    [0.9, -0.21],
    [0.62, 0.92],
    [0, 0.92],
  ]);
  const top = mirrorHalf([
    [0, -0.64],
    [0.44, -0.64],
    [0.72, -0.17],
    [0.5, 0.78],
    [0, 0.78],
  ]);
  const roof = mirrorHalf([
    [0, -0.58],
    [0.4, -0.58],
    [0.66, -0.15],
    [0.45, 0.72],
    [0, 0.72],
  ]);
  // The six walls keep their flat faces; the corners between them and the shoulder under
  // the roof are rounded like the casting.
  const mix = (o, p, t) => o.map((q, i) => lerp(q, p[i], t));
  const L3 = (o, y, d) => softCorners(o, d).map(([x, dz]) => [x, y, zT + dz]);
  b.convex({
    points: [...L3(base, 1.54, 0.1), ...L3(mid, 1.63, 0.1), ...L3(mix(mid, top, 0.9), 2.188, 0.085), ...L3(mix(top, roof, 0.25), 2.25, 0.08), ...L3(mix(top, roof, 0.75), 2.285, 0.075), ...L3(roof, 2.295, 0.07)],
    mat: C,
    crease: 0.55,
  });
  b.cylAxis({ axis: 'y', x: 0, y: 1.532, z: zT, len: 0.03, r: 0.72, mat: P, seg: 24 }); // turret ring
  // Point on a turret wall: wall i runs from corner i to corner i + 1 of the outlines above,
  // f along it and k up it (0 at the lower edge); wallN is its outward direction.
  const wallAt = (s, i, f, k) => {
    const q = lerp(lerp(mid[i], top[i], k), lerp(mid[i + 1], top[i + 1], k), f);
    return [s * q[0], 1.63 + 0.62 * k, zT + q[1]];
  };
  const wallN = (s, i) => {
    const p = wallAt(s, i, 0.5, 0.5);
    const n = unit(cross(vadd(wallAt(s, i, 0.6, 0.5), p, -1), vadd(wallAt(s, i, 0.5, 0.6), p, -1)));
    return n[0] * p[0] + n[2] * (p[2] - zT) < 0 ? n.map((v) => -v) : n;
  };
  for (const s of [-1, 1]) {
    // Two round roof hatches side by side.
    roofHatch(b, s * 0.285, 2.29, zT + 0.2, 0.225, C, P);
    // Hand rails on the cheek and the side, pistol port, lifting loops at the top corners.
    handRail(b, wallAt(s, 1, 0.25, 0.58), wallAt(s, 1, 0.8, 0.58), wallN(s, 1), 0.06, P);
    handRail(b, wallAt(s, 2, 0.57, 0.6), wallAt(s, 2, 0.9, 0.6), wallN(s, 2), 0.06, P);
    b.latheDir({
      profile: [
        [0, 0.032],
        [0.03, 0.032],
        [0.048, 0.014],
        [0.056, 0],
        [0, 0],
      ],
      at: wallAt(s, 2, 0.5, 0.3),
      dir: wallN(s, 2),
      mat: C,
      seg: 10,
    });
    for (const f of [0.07, 0.94]) handRail(b, wallAt(s, 2, f, 0.8), wallAt(s, 2, f, 0.93), wallN(s, 2), 0.04, P, 0.012, 6);
  }
  // PT-4-7 sight (left), the loader's periscope (right), ventilator dome between them.
  periscope(b, -0.32, 2.295, zT - 0.34, 2.41, P);
  periscope(b, 0.36, 2.295, zT - 0.25, 2.41, P);
  b.latheDir({
    profile: [
      [0, 0.05],
      [0.05, 0.047],
      [0.1, 0.032],
      [0.12, 0.014],
      [0.135, 0.012],
      [0.135, 0],
      [0, 0],
    ],
    at: [0, 2.292, zT - 0.36],
    dir: [0, 1, 0],
    mat: C,
    seg: 14,
  });
  // Rear wall: the bolted plate the gun is taken out through, a hand rail above it.
  b.place({ pos: [0, 1.816, zT + 0.878], rot: [77.3 * DEG, 0, 0] }, () => {
    b.prismY({ points: roundRect(0, 0, 0.3, 0.11, 0.02, 1), y0: -0.01, y1: 0.016, mat: P, bevel: 0.005, bevelSegments: 1 });
    const bolts = [];
    for (const x of [-0.25, 0, 0.25]) for (const z of [-0.075, 0.075]) bolts.push(circle(0.016, 6, x, z));
    b.prismY({ points: bolts, y0: 0.01, y1: 0.028, mat: P, bevel: 0 });
  });
  handRail(b, [-0.3, 2.076, zT + 0.819], [0.3, 2.076, zT + 0.819], [0, 0.22, 0.975], 0.06, P);
  b.anchor('commanderEye', -0.3, 2.55, zT + 0.18);
  b.meta.anchorParts.commanderEye = 'turret';
  b.body();

  // ---- Gun: 76.2 mm F-34 ---------------------------------------------------------------------
  const yG = 1.9,
    zG = zT - 0.66,
    zM = zT - 0.8;
  b.part('gun', [0, yG, zG]);
  // Cast shield curved round the trunnions, its ends rounded off.
  const shield = [];
  for (let i = 0; i <= 10; i++) {
    const a = -0.95 + (1.9 * i) / 10;
    for (const [x, R] of [
      [0.3, 0.22],
      [0.29, 0.27],
      [0.255, 0.3],
      [0.2, 0.31],
    ])
      shield.push([x, yG + R * Math.sin(a), zG - R * Math.cos(a)], [-x, yG + R * Math.sin(a), zG - R * Math.cos(a)]);
  }
  for (const s of [-1, 1]) shield.push([s * 0.3, yG - 0.24, zG], [s * 0.3, yG + 0.24, zG]);
  b.convex({ points: shield, mat: C, crease: 0.5 });
  // Long recoil housing round the barrel base, stepped like the casting. (No wider than
  // it was: the gunner's sight looks along its side.)
  b.latheDir({
    profile: [
      [0, 0],
      [0.109, 0],
      [0.108, 0.09],
      [0.1, 0.1],
      [0.092, 0.36],
      [0.099, 0.37],
      [0.099, 0.4],
      [0.08, 0.41],
      [0.076, 0.44],
      [0, 0.44],
    ],
    at: [0, yG - 0.01, zM - 0.1],
    dir: [0, 0, -1],
    mat: C,
    seg: 18,
  });
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.07, -0.02],
      [0.066, 0.1],
      [0.055, 0.95],
      [0.05, 1.4],
      [0.054, 1.42],
      [0.054, 1.46],
      [0.0381, 1.46],
      [0.0381, 1.42],
      [0, 1.42],
    ],
    at: [0, yG, zM - 0.5],
    dir: [0, 0, -1],
    mat: P,
    seg: 18,
  });
  const zMu = zM - 0.5 - 1.46;
  b.cyl({ z0: zMu + 0.042, z1: zMu + 0.038, r0: 0.037, y: yG, mat: 'dark', seg: 14 });
  b.cyl({ z0: zM - 0.13, z1: zM - 0.2, r0: 0.016, x: 0.19, y: yG + 0.01, mat: 'blued', seg: 8 }); // coax DT
  b.cyl({ z0: zM - 0.158, z1: zM - 0.168, r0: 0.024, x: -0.18, y: yG + 0.05, mat: 'dark', seg: 10 }); // TMFD sight
  b.at('gun', 'muzzle', 0, yG, zMu);
  b.at('gun', 'coaxMuzzle', 0.19, yG + 0.01, zM - 0.2);
  b.at('gun', 'gunnerEye', -0.18, yG + 0.05, zM - 0.165);
  b.body();
  b.meta.partParents = { gun: 'turret' };

  // ---- Meta, armor, modules -----------------------------------------------------------------
  Object.assign(b.meta, {
    name: 'T-34/76 (1942)',
    faction: 'su',
    type: 'tracked',
    crew: 4,
    gun: { name: '76.2 mm F-34', caliber: 76.2 },
    gunElevation: [-5, 26],
    turretTraverse: 24,
    groundClearance: 0.4,
    turretRing: { center: [0, yR, zT], radius: 0.71 },
    specs: { mass: 28500, maxSpeed: 53, power: 500, engine: 'V-2-34 diesel', fuel: 480, fuelExternal: 270 },
  });
  const tp = (x, dz, y) => [x, y, zT + dz];
  b.armorPoly('turretFront', 'turret', 52, [tp(-0.55, -0.82, 1.54), tp(0.55, -0.82, 1.54), tp(0.44, -0.64, 2.25), tp(-0.44, -0.64, 2.25)], [0, 0, -1], 3, [1, 0, 0]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorPoly(`turretFrontSide${L}`, 'turret', 52, [tp(s * 0.55, -0.82, 1.54), tp(s * 0.93, -0.22, 1.54), tp(s * 0.72, -0.17, 2.25), tp(s * 0.44, -0.64, 2.25)], [s, 0, -1], 3);
    b.armorPoly(`turretSide${L}`, 'turret', 45, [tp(s * 0.93, -0.22, 1.54), tp(s * 0.64, 0.95, 1.54), tp(s * 0.5, 0.78, 2.25), tp(s * 0.72, -0.17, 2.25)], [s, 0, 0.2], 4);
  }
  b.armorPoly('turretRear', 'turret', 45, [tp(-0.64, 0.95, 1.54), tp(0.64, 0.95, 1.54), tp(0.5, 0.78, 2.25), tp(-0.5, 0.78, 2.25)], [0, 0, 1], 3, [1, 0, 0]);
  b.armorPoly('turretRoof', 'turret', 20, roof.map(([x, dz]) => [x, 2.295, zT + dz]), [0, 1, 0], 4, [0, 0, 1]);
  b.armor('mantlet', 'gun', 45, [0, yG, zM - 0.17], [0.56, 0, 0], [0, 0.36, 0], [0, 0, -1]);
  b.armor('gunSleeve', 'gun', 45, [0, yG, zM - 0.5], [0.22, 0, 0], [0, 0.22, 0], [0, 0, -1]);
  b.module('gunner', 'turret', [-0.35, 1.75, zT - 0.15], [0.22, 0.5, 0.28]); // the commander aims the gun
  b.module('commander', 'turret', [-0.35, 1.75, zT - 0.15], [0.22, 0.5, 0.28]);
  b.module('loader', 'turret', [0.38, 1.65, zT + 0.05], [0.22, 0.5, 0.28]);
}

// ---------------------------------------------------------------------------------------
// T-34-85 (1944, factory 183): the T-34 hull with the large three-man cast turret (1.60 m
// ring), commander's cupola at the left rear, 85 mm ZiS-S-53 L/54.6, "starfish" spoked
// road wheels. 8.15 m long with the gun, 3.0 m wide, 2.72 m high; 32 t; crew 5.
// Armor: hull as the T-34/76; turret front and mantlet 90 mm, sides 75 mm at 20 deg, rear
// 52 mm, roof 20 mm, cupola 90 mm.
export function t34_85(b) {
  const { P, C } = t34Hull(b, { spoked: true });
  const zT = -0.8,
    yR = 1.52;
  b.part('turret', [0, yR, zT]);
  const plan = mirrorHalf([
    [0, -1.02],
    [0.45, -1.0],
    [0.72, -0.86],
    [0.88, -0.55],
    [0.94, -0.15],
    [0.94, 0.35],
    [0.88, 0.75],
    [0.74, 1.05],
    [0.45, 1.25],
    [0, 1.3],
  ]);
  const L3 = (y, sc) => plan.map(([x, dz]) => [x * sc, y, zT + dz * sc]);
  // Rounded casting: the plan outline smoothed, the walls leaning in to a round shoulder
  // under the roof. It was cast in two halves: the lower one stands a little proud of the
  // upper one, which leaves the seam round the turret. Rings = [height, scale of the plan].
  const cast = S(plan, 2);
  const lower = [
    [1.54, 0.99],
    [1.58, 1.0],
    [1.66, 1.0],
    [1.9, 0.982],
  ];
  const upper = [
    [1.86, 0.975],
    [2.18, 0.935],
    [2.29, 0.905],
    [2.36, 0.865],
    [2.42, 0.79],
  ];
  for (const half of [lower, upper]) b.convex({ points: half.flatMap(([y, sc]) => cast.map(([x, dz]) => [x * sc, y, zT + dz * sc])), mat: C, crease: 0.5 });
  const rings = [...lower.slice(0, 3), ...upper];
  b.cylAxis({ axis: 'y', x: 0, y: 1.532, z: zT, len: 0.03, r: 0.84, mat: P, seg: 24 }); // turret ring
  // Point on the turret wall at height y, dz behind the turret center, on side s, and the
  // wall's outward direction there.
  const scAt = (y) => {
    let i = 1;
    while (i < rings.length - 1 && rings[i][0] < y) i++;
    const [y0, s0] = rings[i - 1],
      [y1, s1] = rings[i];
    return s0 + ((s1 - s0) * (y - y0)) / (y1 - y0);
  };
  const wall = (s, dz, y) => {
    const sc = scAt(y),
      q = dz / sc;
    let i = 1;
    while (i < 9 && plan[i][1] < q) i++;
    const [x0, z0] = plan[i - 1],
      [x1, z1] = plan[i];
    const l = Math.hypot(x1 - x0, z1 - z0);
    return { p: [s * (x0 + ((x1 - x0) * (q - z0)) / (z1 - z0)) * sc, y, zT + dz], n: [(s * (z1 - z0)) / l, 0, -(x1 - x0) / l] };
  };
  // Commander's cupola (left rear): vision blocks all round, split hatch on top.
  const cx = -0.42,
    cz = zT + 0.42;
  b.latheDir({
    profile: [
      [0, 0],
      [0.34, 0],
      [0.34, 0.05],
      [0.316, 0.075],
      [0.31, 0.19],
      [0.285, 0.22],
      [0, 0.22],
    ],
    at: [cx, 2.39, cz],
    dir: [0, 1, 0],
    mat: C,
    seg: 28,
  });
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + ((i - 2) / 5) * Math.PI * 1.6;
    b.box({ x: cx + Math.cos(a) * 0.316, y: 2.535, z: cz + Math.sin(a) * 0.316, w: 0.04, h: 0.058, d: 0.15, ry: -a, r: 0.008, mat: C });
    b.box({ x: cx + Math.cos(a) * 0.335, y: 2.537, z: cz + Math.sin(a) * 0.335, w: 0.006, h: 0.016, d: 0.11, ry: -a, r: 0, mat: 'dark' });
  }
  for (const sx of [-1, 1]) {
    b.prismY({ points: [...circle(0.25, 20, cx, cz).filter(([x]) => sx * (x - cx) >= -1e-6), [cx + sx * 0.003, cz + sx * 0.25]], y0: 2.61, y1: 2.635, mat: P, bevel: 0.005 });
    b.box({ x: cx + sx * 0.262, y: 2.612, z: cz, w: 0.05, h: 0.036, d: 0.13, r: 0.006, mat: P }); // hinge
  }
  // Loader's hatch (right), periscopes, twin ventilator domes at the back of the roof.
  roofHatch(b, 0.4, 2.41, zT + 0.3, 0.232, C, P);
  periscope(b, -0.36, 2.42, zT - 0.32, 2.54, P);
  periscope(b, 0.4, 2.42, zT - 0.12, 2.54, P);
  for (const s of [-1, 1]) {
    b.latheDir({
      profile: [
        [0, 0.076],
        [0.05, 0.072],
        [0.095, 0.048],
        [0.115, 0.016],
        [0.13, 0.014],
        [0.13, 0],
        [0, 0],
      ],
      at: [s * 0.15, 2.414, zT + 0.82],
      dir: [0, 1, 0],
      mat: C,
      seg: 14,
    });
    // Hand rails along the sides, pistol port, lifting loops on the shoulder.
    for (const [z0, z1] of [
      [-0.72, -0.3],
      [0.52, 0.98],
    ]) {
      const a = wall(s, z0, 2.0),
        c = wall(s, z1, 2.0);
      handRail(b, a.p, c.p, unit(vadd(a.n, c.n)), 0.075, P);
    }
    const port = wall(s, 0.62, 1.78);
    b.latheDir({
      profile: [
        [0, 0.034],
        [0.03, 0.034],
        [0.048, 0.016],
        [0.056, 0],
        [0, 0],
      ],
      at: port.p,
      dir: port.n,
      mat: C,
      seg: 10,
    });
    for (const [dz, y, lean] of [
      [-0.55, 2.2, 0.3],
      [0.8, 2.3, 0.8],
    ]) {
      const { p, n } = wall(s, dz, y);
      const along = [-n[2] * 0.045, 0, n[0] * 0.045];
      handRail(b, vadd(p, along, -1), vadd(p, along), unit([n[0], lean, n[2]]), 0.045, P, 0.012, 6);
    }
  }
  handRail(b, [-0.3, 2.0, zT + 1.232], [0.3, 2.0, zT + 1.232], [0, 0.1, 0.995], 0.075, P);
  b.at('turret', 'commanderEye', cx, 2.89, cz);
  b.body();

  // ---- Gun: 85 mm ZiS-S-53 in a curved cast mantlet -----------------------------------------
  const yG = 1.96,
    zG = zT - 0.8;
  b.part('gun', [0, yG, zG]);
  const mask = [];
  for (let i = 0; i <= 10; i++) {
    const a = -0.85 + (1.7 * i) / 10;
    for (const [x, R] of [
      [0.47, 0.295],
      [0.435, 0.33],
    ])
      mask.push([x, yG + R * Math.sin(a), zG - R * Math.cos(a)], [-x, yG + R * Math.sin(a), zG - R * Math.cos(a)]);
  }
  b.convex({ points: mask, mat: C, crease: 0.45 });
  const zF = zG - 0.33;
  // Bolted collar round the barrel base.
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.18, -0.02],
      [0.18, 0.02],
      [0.15, 0.022],
      [0.15, 0.05],
      [0.13, 0.12],
      [0.12, 0.34],
      [0, 0.34],
    ],
    at: [0, yG, zF],
    dir: [0, 0, -1],
    mat: C,
    seg: 22,
  });
  b.prismZ({ points: boltRing(8, 0.165, 0.011, Math.PI / 8).map((o) => o.map(([x, y]) => [x, yG + y])), z0: zF - 0.032, z1: zF - 0.018, mat: C, bevel: 0 });
  b.latheDir({
    profile: [
      [0, 0],
      [0.082, 0],
      [0.074, 0.15],
      [0.066, 1.6],
      [0.06, 2.84],
      [0.066, 2.87],
      [0.066, 2.92],
      [0.0425, 2.92],
      [0.0425, 2.88],
      [0, 2.88],
    ],
    at: [0, yG, zF - 0.34],
    dir: [0, 0, -1],
    mat: P,
    seg: 18,
  });
  const zMu = zF - 0.34 - 2.92;
  b.cyl({ z0: zMu + 0.042, z1: zMu + 0.038, r0: 0.041, y: yG, mat: 'dark', seg: 14 });
  b.cyl({ z0: zF - 0.01, z1: zF - 0.09, r0: 0.016, x: 0.24, y: yG - 0.02, mat: 'blued', seg: 8 }); // coax DT
  b.cyl({ z0: zF + 0.005, z1: zF - 0.005, r0: 0.026, x: -0.24, y: yG + 0.05, mat: 'dark', seg: 10 }); // TSh-16 sight
  b.at('gun', 'muzzle', 0, yG, zMu);
  b.at('gun', 'coaxMuzzle', 0.24, yG - 0.02, zF - 0.09);
  b.at('gun', 'gunnerEye', -0.24, yG + 0.05, zF - 0.005);
  b.body();
  b.meta.partParents = { gun: 'turret' };

  Object.assign(b.meta, {
    name: 'T-34-85 (1944)',
    faction: 'su',
    type: 'tracked',
    crew: 5,
    gun: { name: '85 mm ZiS-S-53', caliber: 85 },
    gunElevation: [-5, 22],
    turretTraverse: 26,
    groundClearance: 0.4,
    turretRing: { center: [0, yR, zT], radius: 0.8 },
    specs: { mass: 32000, maxSpeed: 55, power: 500, engine: 'V-2-34 diesel', fuel: 545, fuelExternal: 270 },
  });
  b.armorShell('turret', 'turret', plan.map(([x, dz]) => [x, zT + dz]), [1.54, 1.0], [2.33, 0.88], [0, zT], (deg) => (deg < 50 ? 90 : deg < 140 ? 75 : 52));
  b.armorPoly('turretRoof', 'turret', 20, L3(2.42, 0.79), [0, 1, 0], 4, [0, 0, 1]);
  b.armor('cupola', 'turret', 90, [cx, 2.51, cz - 0.33], [0.66, 0, 0], [0, 0.24, 0], [0, 0, -1]);
  b.armor('mantlet', 'gun', 90, [0, yG, zF], [0.94, 0, 0], [0, 0.5, 0], [0, 0, -1]);
  b.armor('gunCollar', 'gun', 90, [0, yG, zF - 0.34], [0.26, 0, 0], [0, 0.26, 0], [0, 0, -1]);
  b.module('gunner', 'turret', [-0.4, 1.84, zT - 0.3], [0.22, 0.5, 0.28]);
  b.module('commander', 'turret', [cx, 2.05, cz], [0.22, 0.55, 0.28]);
  b.module('loader', 'turret', [0.4, 1.8, zT + 0.05], [0.22, 0.52, 0.28]);
  b.module('ammo', 'turret', [0, 2.0, zT + 1.05], [0.5, 0.15, 0.15]); // bustle ready rack
}

// ---------------------------------------------------------------------------------------
// GAZ-67B (1944): Soviet 4x4 light car. Very wide track (1.446 m) for its 1.85 m wheelbase,
// narrow hood between big flat fenders, separate rear fenders outside the narrow tub, no
// doors, canvas top with canvas side curtains over the rear seats, spare wheel at the rear.
// 3.345 m long, 1.685 m wide, 1.70 m high (top up), 6.50-16 tires (0.37 m radius), 223 mm
// ground clearance. Driver on the left, 4 seats.
export function gaz67(b) {
  const WB = 1.85,
    TRK = 1.446,
    R = 0.37,
    TW = 0.17;
  const zF = -WB / 2,
    zR = WB / 2,
    xw = TRK / 2;
  const P = 'sovietGreen';
  // ---- Wheels -------------------------------------------------------------------------------
  const wheel = jeepWheel({ r: R, width: TW, rimR: 0.205, lugs: 18, lugH: 0.013, rimMat: P, splitBolts: 0, nuts: 6 });
  for (const [name, x, z] of [
    ['wheelFL', -xw, zF],
    ['wheelFR', xw, zF],
    ['wheelRL', -xw, zR],
    ['wheelRR', xw, zR],
  ]) {
    b.part(name, [x, R, z]).addAll(wheel, { x, y: R, z, ry: x < 0 ? Math.PI : 0 });
  }
  b.body();

  // ---- Chassis --------------------------------------------------------------------------------
  for (const s of [-1, 1]) b.span({ z0: -1.62, z1: 1.42, y0: 0.42, y1: 0.54, w: 0.06, x: s * 0.4, mat: P, r: 0.008 });
  b.span({ z0: -1.69, z1: -1.61, y0: 0.44, y1: 0.58, w: 1.6, mat: P, r: 0.012 }); // bumper
  for (const z of [zF, zR]) {
    b.cylAxis({ axis: 'x', x: 0, y: R, z, len: TRK - 0.16, r: 0.045, mat: P });
    b.sphere({ x: 0.1, y: R, z, r: 0.11, sx: 0.85, mat: P });
  }
  for (const s of [-1, 1]) b.sphere({ x: s * 0.58, y: R, z: zF, r: 0.075, mat: P });
  for (const s of [-1, 1])
    for (const z of [zF, zR]) {
      const line = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        line.push([z - 0.42 + 0.84 * t, R + 0.09 + 0.06 * (2 * t - 1) ** 2]);
      }
      b.prismX({ points: ribbon(line, 0.035), x0: s * 0.4 - 0.025, x1: s * 0.4 + 0.025, mat: 'black', bevel: 0.004 });
    }
  b.box({ x: 0, y: 0.68, z: -1.0, w: 0.46, h: 0.34, d: 0.75, r: 0.04, mat: 'black' }); // engine
  b.box({ x: 0.04, y: 0.48, z: -0.2, w: 0.26, h: 0.18, d: 0.5, r: 0.03, mat: P });
  for (const z of [zF + 0.1, zR - 0.1]) b.rod({ from: [0.08, 0.45, -0.2 + Math.sign(z) * 0.25], to: [0.1, R, z], r: 0.025, mat: P });
  b.cyl({ z0: 0.0, z1: 0.6, r0: 0.06, x: 0.46, y: 0.44, mat: 'black' });
  b.cyl({ z0: 0.6, z1: 1.44, r0: 0.022, x: 0.48, y: 0.42, mat: 'black' });
  b.anchor('exhaustR', 0.48, 0.42, 1.45);

  // ---- Hood, grille, fenders, lamps ---------------------------------------------------------
  b.box({ x: 0, y: 0.83, z: -1.03, w: 0.72, h: 0.46, d: 0.96, r: 0.03, mat: P }); // hood (top 1.06)
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.box({ x: s * 0.362, y: 0.88, z: -1.3 + i * 0.09, w: 0.006, h: 0.18, d: 0.03, r: 0.002, mat: 'dark' }); // louvers
  const grille = roundRect(0, 0.81, 0.35, 0.255, 0.03);
  const slots = [];
  for (let i = -6; i <= 6; i++) slots.push(slotV(i * 0.048, 0.81, 0.013, 0.2));
  b.prismZ({ points: grille, holes: slots, z0: -1.53, z1: -1.51, mat: P, bevel: 0.004 });
  b.span({ z0: -1.5, z1: -1.42, y0: 0.6, y1: 1.02, w: 0.62, mat: 'dark' }); // radiator
  // Big flat front fenders reaching out over the wide-track wheels.
  const fl = [
    [-1.6, 0.74],
    [-1.56, 0.84],
    [-1.46, 0.875],
    [-0.62, 0.875],
    [-0.42, 0.62],
    [-0.4, 0.58],
  ];
  for (const s of [-1, 1]) {
    b.prismX({ points: ribbon(fl, 0.016), x0: s * 0.36, x1: s * 0.85, mat: P, bevel: 0.006 });
    b.prismX({ points: [[-1.6, 0.74], [-1.46, 0.86], [-0.62, 0.86], [-0.62, 0.7], [-1.4, 0.7]], x0: s * 0.835, x1: s * 0.85, mat: P, bevel: 0.003 }); // outer valance
    // Headlamp on a stalk on the fender, blackout lamp.
    b.cylAxis({ axis: 'y', x: s * 0.52, y: 0.92, z: -1.38, len: 0.1, r: 0.016, mat: P, seg: 8 });
    b.cyl({ z0: -1.5, z1: -1.36, r0: 0.085, r1: 0.07, x: s * 0.52, y: 1.0, mat: P, seg: 16 });
    b.cyl({ z0: -1.506, z1: -1.498, r0: 0.074, x: s * 0.52, y: 1.0, mat: 'lamp', seg: 16 });
    b.anchor(`headlight${side(s)}`, s * 0.52, 1.0, -1.51);
  }

  // ---- Tub, cowl, rear fenders --------------------------------------------------------------
  const tub = [
    [-0.56, 0.5],
    [1.42, 0.5],
    [1.44, 0.96],
    [0.38, 0.96],
    ...S(
      [
        [0.3, 0.92],
        [0.18, 0.78],
        [0.0, 0.73],
        [-0.2, 0.76],
        [-0.34, 0.88],
      ],
      3,
      false,
    ),
    [-0.42, 1.04],
    [-0.56, 1.06],
  ];
  for (const s of [-1, 1]) b.prismX({ points: tub, x0: s * 0.58, x1: s * 0.61, mat: P, bevel: 0.006 });
  b.span({ z0: -0.56, z1: 1.44, y0: 0.48, y1: 0.51, w: 1.2, mat: P, r: 0.004 }); // floor
  b.span({ z0: 1.41, z1: 1.44, y0: 0.5, y1: 0.96, w: 1.22, mat: P, r: 0.008 }); // rear panel
  b.box({ x: 0, y: 1.02, z: -0.48, w: 1.22, h: 0.09, d: 0.18, r: 0.02, mat: P }); // cowl
  b.span({ z0: -0.58, z1: -0.55, y0: 0.5, y1: 1.02, w: 1.2, mat: P }); // firewall / fuel tank behind it
  b.span({ z0: -0.42, z1: -0.39, y0: 0.72, y1: 1.02, w: 1.16, mat: P }); // dash
  b.cyl({ z0: -0.39, z1: -0.383, r0: 0.045, x: -0.1, y: 0.88, mat: 'dark', seg: 16 });
  for (const s of [-1, 1]) {
    const rl = [
      [zR - 0.5, 0.6],
      [zR - 0.4, 0.87],
      [zR + 0.38, 0.87],
      [zR + 0.46, 0.66],
    ];
    b.prismX({ points: ribbon(rl, 0.016), x0: s * 0.6, x1: s * 0.85, mat: P, bevel: 0.005 });
    b.box({ x: s * 0.72, y: 0.9, z: zR + 0.3, w: 0.06, h: 0.05, d: 0.04, r: 0.008, mat: 'redLamp' });
  }

  // ---- Windshield, canvas top with side curtains ---------------------------------------------
  const hz = -0.55,
    hy = 1.065;
  b.part('windshield', [0, hy, hz]);
  const bar = (x0, x1, y0, y1) => b.span({ z0: hz - 0.016, z1: hz + 0.016, y0, y1, w: x1 - x0, x: (x0 + x1) / 2, mat: P, r: 0.008 });
  bar(-0.62, 0.62, hy, hy + 0.035);
  bar(-0.62, 0.62, 1.41, 1.445);
  bar(-0.62, -0.585, hy, 1.445);
  bar(0.585, 0.62, hy, 1.445);
  bar(-0.015, 0.015, hy, 1.445);
  for (const s of [-1, 1]) b.span({ z0: hz - 0.003, z1: hz + 0.003, y0: hy + 0.035, y1: 1.41, w: 0.57, x: s * 0.3, mat: 'glass' });
  b.body();
  // Canvas top: roof from the windshield header to the rear, rear wall, side curtains over
  // the rear seats (the front openings stay open).
  const roofY = 1.69;
  b.convex({
    points: [
      ...[-1, 1].flatMap((s) => [
        [s * 0.63, 1.445, hz + 0.02],
        [s * 0.65, roofY - 0.04, hz + 0.12],
        [s * 0.6, roofY, hz + 0.2],
        [s * 0.6, roofY, 1.32],
        [s * 0.65, roofY - 0.04, 1.42],
        [s * 0.64, 0.97, 1.46],
        [s * 0.64, 1.42, hz + 0.05],
      ]),
    ],
    mat: 'canvasSoviet',
    crease: 0.4,
  });
  for (const s of [-1, 1]) {
    b.prismX({
      points: [
        [0.33, 0.96],
        [1.44, 0.96],
        [1.44, roofY - 0.05],
        [0.33, roofY - 0.05],
      ],
      holes: [roundRect(0.88, 1.3, 0.28, 0.12, 0.03)],
      x0: s * 0.64,
      x1: s * 0.655,
      mat: 'canvasSoviet',
      bevel: 0.004,
    });
    b.span({ z0: 0.6, z1: 1.1, y0: 1.18, y1: 1.42, w: 0.004, x: s * 0.647, mat: 'glass' });
  }
  // The roof interior shell would hide the cabin from above, so the canvas is a convex
  // shell only above the windshield header; hollow it visually with a dark lining.
  b.span({ z0: hz + 0.1, z1: 1.38, y0: 1.62, y1: 1.64, w: 1.2, mat: 'dark' });

  // ---- Steering, seats, spare wheel ------------------------------------------------------
  steeringWheel(b, { hub: [-0.3, 1.06, -0.24], col: [0, 0.58, 0.815], r: 0.2, spokes: [0, Math.PI, -Math.PI / 2], columnLen: 0.8 });
  const seat = (x, z, w) => {
    b.box({ x, y: 0.62, z, w, h: 0.09, d: 0.38, r: 0.035, mat: 'canvasSoviet' });
    b.box({ x, y: 0.88, z: z + 0.22, w, h: 0.38, d: 0.07, r: 0.03, rx: 0.14, mat: 'canvasSoviet' });
    b.box({ x, y: 0.54, z, w: w - 0.04, h: 0.08, d: 0.34, r: 0.01, mat: P });
  };
  seat(-0.3, 0.13, 0.42);
  seat(0.3, 0.13, 0.42);
  b.box({ x: 0, y: 0.6, z: 0.92, w: 1.1, h: 0.2, d: 0.36, r: 0.01, mat: P });
  b.box({ x: 0, y: 0.745, z: 0.92, w: 1.12, h: 0.08, d: 0.4, r: 0.035, mat: 'canvasSoviet' });
  b.box({ x: 0, y: 0.95, z: 1.25, w: 1.12, h: 0.36, d: 0.06, r: 0.03, rx: 0.1, mat: 'canvasSoviet' });
  b.addAll(wheel, { x: -0.1, y: 0.74, z: 1.44 + 0.025 + TW / 2, ry: -Math.PI / 2 });
  b.box({ x: -0.1, y: 0.74, z: 1.455, w: 0.16, h: 0.16, d: 0.03, r: 0.01, mat: P });

  // ---- Anchors, meta ---------------------------------------------------------------------------
  b.anchor('driverSeat', -0.3, 0.74, 0.15);
  b.anchor('driverEye', -0.3, 1.43, 0.08);
  b.anchor('seat1', 0.3, 0.74, 0.15);
  b.anchor('seat2', -0.28, 0.84, 0.94);
  b.anchor('seat3', 0.28, 0.84, 0.94);
  Object.assign(b.meta, {
    name: 'GAZ-67B',
    faction: 'su',
    type: 'wheeled',
    crew: 1,
    seats: 4,
    wheelRadius: R,
    wheelWidth: TW,
    wheelbase: WB,
    trackWidth: TRK,
    groundClearance: 0.223,
    maxSteer: 0.55,
    wheels: { wheelFL: [-xw, R, zF], wheelFR: [xw, R, zF], wheelRL: [-xw, R, zR], wheelRR: [xw, R, zR] },
    specs: { mass: 1320, maxSpeed: 90, power: 54, fuel: 60, range: 450, drive: '4x4' },
  });
  b.armorZY('front', 'body', 0, [-1.53, 0.55], [-1.53, 1.06], -0.36, 0.36, [0, 0, -1]);
  b.armorZY('hood', 'body', 0, [-1.51, 1.06], [-0.56, 1.06], -0.36, 0.36, [0, 1, 0]);
  for (const s of [-1, 1]) b.armorXY(`side${side(s)}`, 'body', 0, [s * 0.61, 0.5], [s * 0.61, 0.96], -0.56, 1.44, [s, 0, 0]);
  b.armorZY('rear', 'body', 0, [1.44, 0.5], [1.44, 0.96], -0.61, 0.61, [0, 0, 1]);
  b.armorZY('floor', 'body', 0, [-0.56, 0.48], [1.44, 0.48], -0.6, 0.6, [0, -1, 0]);
  b.armorZY('windshield', 'body', 0, [hz, hy], [hz, 1.445], -0.62, 0.62, [0, 0, -1]);
  b.module('engine', 'body', [0, 0.72, -1.02], [0.24, 0.2, 0.38]);
  b.module('fuel', 'body', [0, 0.92, -0.62], [0.3, 0.1, 0.1]);
  b.module('driver', 'body', [-0.3, 1.0, 0.1], [0.22, 0.42, 0.25]);
}
