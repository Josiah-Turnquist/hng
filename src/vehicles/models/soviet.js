// Soviet vehicles. Conventions (vkit.js): meters, +X right, +Y up, -Z forward; origin on the
// ground at the middle of the wheelbase (wheeled) or of the track contact length (tracked).
import { S, DEG, ribbon, circle, torusProfile, mirrorHalf, latheGeo, prismGeoX, roundRect, slotV } from './vkit.js';
import { jeepWheel, roadWheel, runningGear, boltRing, steeringWheel } from './parts.js';

const side = (s) => (s < 0 ? 'L' : 'R');

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
// external fuel drums, hull armor and hull modules. Returns helpers for the turret code.
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
  // Christie suspension cranks, idler crank, final drive housing.
  for (const s of [-1, 1]) {
    for (const [z] of wheels) b.rod({ from: [s * 0.96, 0.62, z + 0.24], to: [s * 1.0, yW, z], r: 0.05, mat: P });
    b.rod({ from: [s * 0.96, 0.72, IDL.z + 0.3], to: [s * 1.02, IDL.y, IDL.z], r: 0.06, mat: P });
    b.cylAxis({ axis: 'x', x: s * 0.98, y: SPR.y, z: SPR.z, len: 0.12, r: 0.2, mat: P, seg: 18 });
  }

  // ---- Hull ---------------------------------------------------------------------------------
  const tan60 = Math.tan(60 * DEG),
    tan47 = Math.tan(47 * DEG);
  const gz = (y) => -2.95 + (y - 0.78) * tan60; // upper glacis surface z at height y
  const rz = (y) => 2.97 - (y - 0.88) * tan47; // upper rear plate surface z at height y
  // Lower hull between the tracks (lower glacis 53 deg, lower rear 45 deg).
  b.prismX({
    points: [
      [-2.45, 0.4],
      [2.49, 0.4],
      [2.97, 0.88],
      [rz(0.98), 0.98],
      [gz(0.98), 0.98],
      [-2.95, 0.78],
    ],
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
  // Fenders along the sponsons, front mudguards.
  for (const s of [-1, 1]) {
    b.span({ z0: -2.95, z1: 2.98, y0: 0.975, y1: 0.985, w: 0.1, x: s * 1.46, mat: P, r: 0.003 });
    b.quad({
      p: [
        [s * 0.98, 0.98, gz(0.98)],
        [s * 1.51, 0.98, gz(0.98)],
        [s * 1.51, 0.86, -2.98],
        [s * 0.98, 0.86, -2.98],
      ],
      t: 0.008,
      mat: P,
    });
  }
  // Driver's hatch with two periscopes (left of the glacis), ball-mounted DT (right).
  {
    const y0 = 1.02,
      y1 = 1.38,
      x = -0.33;
    const n = [0, Math.sin(30 * DEG), -Math.cos(30 * DEG)]; // glacis normal
    const P4 = [
      [x - 0.26, y0, gz(y0)],
      [x + 0.26, y0, gz(y0)],
      [x + 0.26, y1, gz(y1)],
      [x - 0.26, y1, gz(y1)],
    ].map((p) => [p[0] + n[0] * 0.035, p[1] + n[1] * 0.035, p[2] + n[2] * 0.035]);
    b.quad({ p: P4, t: 0.035, mat: P, out: n });
    for (const dx of [-0.12, 0.12]) {
      const y = 1.31;
      b.box({ x: x + dx, y: y + 0.03, z: gz(y) - 0.04, w: 0.1, h: 0.07, d: 0.08, r: 0.01, mat: P });
      b.box({ x: x + dx, y: y + 0.045, z: gz(y) - 0.081, w: 0.08, h: 0.025, d: 0.005, r: 0.002, mat: 'dark' });
    }
    b.anchor('driverEye', x, 1.36, gz(1.36) - 0.1); // at the hatch periscopes
    const bx = 0.45,
      by = 1.22;
    b.sphere({ x: bx, y: by, z: gz(by) + 0.02, r: 0.13, sz: 0.6, mat: C, seg: 16 });
    b.box({ x: bx, y: by + 0.02, z: gz(by) - 0.06, w: 0.2, h: 0.15, d: 0.08, r: 0.04, mat: C });
    b.cyl({ z0: gz(by) - 0.08, z1: gz(by) - 0.26, r0: 0.025, x: bx, y: by, mat: 'blued', seg: 10 });
    b.anchor('bowMgMuzzle', bx, by, gz(by) - 0.26);
  }
  // Tow hooks, spare track links on the glacis, headlight and horn.
  for (const s of [-1, 1]) {
    b.prismX({
      points: [
        [-2.95, 0.68],
        [-3.08, 0.66],
        [-3.1, 0.78],
        [-3.03, 0.8],
        [-3.0, 0.72],
        [-2.92, 0.74],
      ],
      x0: s * 0.62 - 0.03,
      x1: s * 0.62 + 0.03,
      mat: P,
      bevel: 0.008,
    });
  }
  // Two spare track links on the glacis.
  for (const dx of [0.66, 0.02]) {
    const y0 = 0.85,
      y1 = 0.94;
    b.quad({
      p: [
        [dx - 0.25, y0, gz(y0) - 0.025],
        [dx + 0.25, y0, gz(y0) - 0.025],
        [dx + 0.25, y1, gz(y1) - 0.025],
        [dx - 0.25, y1, gz(y1) - 0.025],
      ],
      t: 0.035,
      mat: 'track',
    });
  }
  b.cyl({ z0: gz(1.12) - 0.14, z1: gz(1.12) - 0.02, r0: 0.085, r1: 0.075, x: -0.78, y: 1.16, mat: P, seg: 16 });
  b.cyl({ z0: gz(1.12) - 0.146, z1: gz(1.12) - 0.138, r0: 0.07, x: -0.78, y: 1.16, mat: 'lamp', seg: 16 });
  b.anchor('headlightL', -0.78, 1.16, gz(1.12) - 0.15);
  b.cylAxis({ axis: 'z', x: 0.85, y: 1.12, z: gz(1.12) - 0.06, len: 0.12, r: 0.05, mat: P, seg: 12 });
  // Grab rails along the upper sides, external fuel drums (2 right, 1 left + tool box).
  const sideN = [Math.cos(40 * DEG), Math.sin(40 * DEG)]; // outward normal of the right side plate
  const onSide = (s, t, off) => [s * (1.42 - 0.453 * t + sideN[0] * off), 0.98 + 0.54 * t + sideN[1] * off];
  for (const s of [-1, 1]) {
    const [rx, ry] = onSide(s, 0.72, 0.05);
    for (const z of [-1.6, -0.6, 0.25]) {
      b.rod({ from: [rx, ry, z - 0.3], to: [rx, ry, z + 0.3], r: 0.012, mat: P });
      for (const dz of [-0.3, 0.3]) {
        const [qx, qy] = onSide(s, 0.72, 0);
        b.rod({ from: [qx, qy, z + dz], to: [rx, ry, z + dz], r: 0.012, mat: P });
      }
    }
  }
  const drum = (s, z) => {
    const [dx, dy] = onSide(s, 0.48, 0.2);
    b.cyl({ z0: z - 0.34, z1: z + 0.34, r0: 0.18, x: dx, y: dy, mat: P, seg: 18 });
    for (const dz of [-0.2, 0.2]) b.latheDir({ profile: torusProfile(0.183, 0.01, 6), at: [dx, dy, z + dz], dir: [0, 0, 1], mat: 'black', seg: 18 });
    b.cyl({ z0: z - 0.36, z1: z - 0.34, r0: 0.04, x: dx + s * 0.06, y: dy + 0.08, mat: P, seg: 8 });
    return [dx, dy];
  };
  drum(1, 0.85);
  drum(1, 1.85);
  drum(-1, 1.85);
  {
    const [dx, dy] = onSide(-1, 0.45, 0.13);
    b.box({ x: dx, y: dy, z: 0.85, w: 0.26, h: 0.24, d: 0.7, r: 0.015, mat: P, rz: 40 * DEG });
  }
  // Engine deck: engine access hatch, radiator louvers, transmission hatch and exhausts.
  b.box({ x: 0, y: 1.535, z: 1.0, w: 0.7, h: 0.03, d: 0.75, r: 0.01, mat: P });
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.65, y: 1.53, z: 1.25, w: 0.42, h: 0.025, d: 1.45, r: 0.01, mat: 'black' });
    for (let i = 0; i < 8; i++) b.box({ x: s * 0.65, y: 1.55, z: 0.6 + i * 0.185, w: 0.42, h: 0.015, d: 0.06, r: 0.004, mat: P });
  }
  {
    const n = [0, Math.sin(43 * DEG), Math.cos(43 * DEG)];
    const yc = 1.18;
    b.latheDir({
      profile: [
        [0, 0.04],
        [0.36, 0.04],
        [0.38, 0.0],
        [0, 0.0],
      ],
      at: [0, yc, rz(yc)],
      dir: n,
      mat: P,
      seg: 28,
    });
    for (const s of [-1, 1]) {
      const y = 1.0;
      b.latheDir({
        profile: [
          [0, 0.1],
          [0.1, 0.1],
          [0.11, 0],
          [0, 0],
        ],
        at: [s * 0.62, y, rz(y)],
        dir: n,
        mat: P,
        seg: 14,
      });
      b.cyl({ z0: rz(y) + 0.02, z1: rz(y) + 0.16, r0: 0.055, x: s * 0.62, y: y - 0.04, mat: 'black', seg: 12 });
      b.anchor(`exhaust${side(s)}`, s * 0.62, y - 0.04, rz(y) + 0.17);
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
  const L3 = (o, y) => o.map(([x, dz]) => [x, y, zT + dz]);
  b.convex({ points: [...L3(base, 1.54), ...L3(mid, 1.63), ...L3(top, 2.25), ...L3(roof, 2.295)], mat: C, crease: 0.32 });
  // Two round roof hatches, periscope, ventilator, pistol ports, lifting hooks.
  for (const s of [-1, 1]) {
    b.latheDir({
      profile: [
        [0, 0.055],
        [0.2, 0.05],
        [0.235, 0.03],
        [0.24, 0],
        [0, 0],
      ],
      at: [s * 0.3, 2.285, zT + 0.18],
      dir: [0, 1, 0],
      mat: C,
      seg: 24,
    });
    b.cylAxis({ axis: 'x', x: s * 0.83, y: 1.92, z: zT + 0.1, len: 0.05, r: 0.05, mat: C, seg: 12 });
    b.latheDir({ profile: torusProfile(0.04, 0.012, 6), at: [s * 0.62, 2.2, zT - 0.42], dir: [0, 0, 1], mat: P, seg: 10 });
  }
  b.box({ x: -0.32, y: 2.35, z: zT - 0.3, w: 0.1, h: 0.12, d: 0.14, r: 0.015, mat: P }); // PT-4-7 periscope
  b.box({ x: -0.32, y: 2.37, z: zT - 0.372, w: 0.07, h: 0.04, d: 0.005, r: 0.002, mat: 'dark' });
  b.sphere({ x: 0.2, y: 2.29, z: zT - 0.35, r: 0.09, sy: 0.5, mat: C, seg: 12 }); // ventilator
  b.anchor('commanderEye', -0.3, 2.55, zT + 0.18);
  b.meta.anchorParts.commanderEye = 'turret';
  b.body();

  // ---- Gun: 76.2 mm F-34 ---------------------------------------------------------------------
  const yG = 1.9,
    zG = zT - 0.66,
    zM = zT - 0.8;
  b.part('gun', [0, yG, zG]);
  b.convex({
    points: [
      ...[-1, 1].flatMap((s) => [
        [s * 0.3, yG - 0.2, zM + 0.06],
        [s * 0.3, yG + 0.2, zM + 0.06],
        [s * 0.27, yG - 0.17, zM - 0.1],
        [s * 0.27, yG + 0.17, zM - 0.1],
        [s * 0.22, yG - 0.12, zM - 0.17],
        [s * 0.22, yG + 0.12, zM - 0.17],
      ]),
    ],
    mat: C,
    crease: 0.4,
  });
  b.cyl({ z0: zM - 0.15, z1: zM - 0.5, r0: 0.11, r1: 0.1, x: 0, y: yG - 0.01, mat: C, seg: 18 }); // armored sleeve
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
  b.cyl({ z0: zM - 0.155, z1: zM - 0.165, r0: 0.024, x: -0.18, y: yG + 0.05, mat: 'dark', seg: 10 }); // TMFD sight
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
  b.convex({ points: [...L3(1.54, 1.0), ...L3(1.66, 1.0), ...L3(2.12, 0.96), ...L3(2.33, 0.88), ...L3(2.42, 0.79)], mat: C, crease: 0.5 });
  // Commander's cupola (left rear) with vision slits and split hatch, loader's hatch,
  // periscopes, ventilator domes, pistol ports, lifting hooks.
  const cx = -0.42,
    cz = zT + 0.42;
  b.latheDir({
    profile: [
      [0, 0],
      [0.34, 0],
      [0.34, 0.06],
      [0.31, 0.08],
      [0.31, 0.19],
      [0.27, 0.22],
      [0, 0.22],
    ],
    at: [cx, 2.39, cz],
    dir: [0, 1, 0],
    mat: C,
    seg: 28,
  });
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + ((i - 2) / 5) * Math.PI * 1.6;
    b.box({ x: cx + Math.cos(a) * 0.312, y: 2.53, z: cz + Math.sin(a) * 0.312, w: 0.012, h: 0.035, d: 0.1, ry: -a + Math.PI / 2, r: 0.003, mat: 'dark' });
  }
  for (const sx of [-1, 1]) b.prismY({ points: [...circle(0.25, 20, cx, cz).filter(([x]) => sx * (x - cx) >= -1e-6), [cx + sx * 0.003, cz + sx * 0.25]], y0: 2.61, y1: 2.635, mat: P, bevel: 0.005 });
  b.latheDir({
    profile: [
      [0, 0.045],
      [0.22, 0.04],
      [0.25, 0.02],
      [0.25, 0],
      [0, 0],
    ],
    at: [0.4, 2.4, zT + 0.3],
    dir: [0, 1, 0],
    mat: C,
    seg: 24,
  });
  for (const [x, dz] of [
    [-0.36, -0.32],
    [0.4, -0.12],
  ]) {
    b.box({ x, y: 2.48, z: zT + dz, w: 0.12, h: 0.12, d: 0.16, r: 0.015, mat: P });
    b.box({ x, y: 2.5, z: zT + dz - 0.081, w: 0.08, h: 0.04, d: 0.005, r: 0.002, mat: 'dark' });
  }
  for (const s of [-1, 1]) {
    b.sphere({ x: s * 0.18, y: 2.41, z: zT + 0.88, r: 0.1, sy: 0.5, mat: C, seg: 12 });
    b.cylAxis({ axis: 'x', x: s * 0.9, y: 1.96, z: zT + 0.45, len: 0.05, r: 0.05, mat: C, seg: 12 });
    b.latheDir({ profile: torusProfile(0.04, 0.012, 6), at: [s * 0.78, 2.27, zT - 0.55], dir: [0, 0, 1], mat: P, seg: 10 });
  }
  b.at('turret', 'commanderEye', cx, 2.89, cz);
  b.body();

  // ---- Gun: 85 mm ZiS-S-53 in a curved cast mantlet -----------------------------------------
  const yG = 1.96,
    zG = zT - 0.8;
  b.part('gun', [0, yG, zG]);
  const mask = [];
  for (let i = 0; i <= 10; i++) {
    const a = -0.85 + (1.7 * i) / 10;
    for (const x of [-0.47, 0.47]) mask.push([x, yG + 0.33 * Math.sin(a), zG - 0.33 * Math.cos(a)]);
  }
  b.convex({ points: mask, mat: C, crease: 0.45 });
  const zF = zG - 0.33;
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.15, -0.02],
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
