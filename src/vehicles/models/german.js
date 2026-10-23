// German vehicles. Conventions (vkit.js): meters, +X right, +Y up, -Z forward; origin on the
// ground at the middle of the wheelbase (wheeled) or of the track contact length (tracked).
import { S, DEG, ribbon, circle, roundRect, arc, torusProfile, section, layer, mirrorHalf, gear } from './vkit.js';
import { jeepWheel, roadWheel, sprocket, runningGear, boltRing, steeringWheel } from './parts.js';
import { prismGeoX, latheGeo, eulerFromTo, slotV } from './vkit.js';

const side = (s) => (s < 0 ? 'L' : 'R');

// ---------------------------------------------------------------------------------------
// Panzerkampfwagen IV Ausf. H (1943): 7.5 cm KwK 40 L/48 with a double-baffle muzzle brake,
// 8 road wheels a side on 4 leaf-spring bogies, 4 return rollers, front drive sprocket
// (20 teeth), rear idler, Kgs 61/400/120 track (99 links). Schürzen (5 mm) on the hull and
// 8 mm skirts around the turret, commander's cupola. 7.02 m long with the gun (hull 5.89),
// 2.88 m wide (3.33 with skirts), 2.68 m high; 25 t. Turret offset 66 mm to the left.
// Armor: nose and superstructure front 80 mm (14 / 9 deg), glacis 25 mm at 72 deg, sides
// 30 mm, rear 20 mm, roof 16 / 10 mm, belly 10 mm; turret front 50 mm, mantlet 50 mm,
// sides 30 mm at 25 deg, rear 30 mm, roof 16 / 10 mm, cupola 50 mm.
export function panzer4_h(b) {
  const P = 'dunkelgelb',
    Cst = 'castGerman';
  // ---- Running gear -------------------------------------------------------------------------
  const T = 0.04,
    RW = 0.235,
    yW = RW + T,
    OX = 1.2;
  const bogies = [-1.545, -0.515, 0.515, 1.545];
  const wheels = [];
  for (const zc of bogies) wheels.push([zc - 0.25, yW], [zc + 0.25, yW]);
  const rollers = [-1.36, -0.45, 0.45, 1.36].map((z) => [z, 0.81]);
  const SPR = { z: -2.5, y: 0.555 },
    IDL = { z: 2.36, y: 0.6 };
  runningGear(b, {
    wheels,
    wheel: roadWheel({ r: RW, width: 0.24, gap: 0.07, tire: 0.04, dish: 0.025, hubR: 0.065, hubLen: 0.05, mat: P, bolts: 8 }),
    wheelR: RW,
    rollers,
    roller: roadWheel({ r: 0.11, width: 0.15, gap: 0.04, tire: 0.025, dish: 0.012, hubR: 0.045, hubLen: 0.035, mat: P }),
    rollerR: 0.11,
    sprocket: { ...SPR, r: 0.3835, teeth: 20, items: sprocket({ n: 20, r0: 0.355, r1: 0.418, ringGap: 0.2, t: 0.035, drumR: 0.3, hubR: 0.14, hubLen: 0.1, mat: P, bolts: 10, tooth: 0.5, tip: 0.18 }) },
    idler: { ...IDL, r: 0.27 + T / 2, items: roadWheel({ r: 0.27, width: 0.2, gap: 0.06, rubber: false, dish: 0.03, hubR: 0.075, hubLen: 0.05, mat: P, holes: 6 }) },
    track: { width: 0.4, pitch: 0.12, thick: T, offsetX: OX, realLinks: 99 },
  });
  for (const s of [-1, 1]) {
    // Leaf-spring bogies: bracket on the hull side, two swing arms, quarter-elliptic spring.
    for (const zc of bogies) {
      b.box({ x: s * 0.93, y: 0.42, z: zc, w: 0.18, h: 0.2, d: 0.26, r: 0.02, mat: P });
      for (const d of [-1, 1]) b.rod({ from: [s * 1.02, 0.37, zc + d * 0.06], to: [s * 1.06, yW, zc + d * 0.25], r: 0.035, mat: P });
      const line = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        line.push([zc - 0.26 + 0.52 * t, 0.555 - 0.05 * (2 * t - 1) ** 2]);
      }
      b.prismX({ points: ribbon(line, 0.045), x0: s * 0.99, x1: s * 1.07, mat: 'black', bevel: 0.005 });
      b.box({ x: s * 1.0, y: 0.5, z: zc, w: 0.12, h: 0.1, d: 0.1, r: 0.015, mat: P });
    }
    // Return roller brackets, final drive housing, idler crank.
    for (const [z, y] of rollers) b.cylAxis({ axis: 'x', x: s * 0.97, y, z, len: 0.26, r: 0.035, mat: P, seg: 10 });
    b.cylAxis({ axis: 'x', x: s * 0.93, y: SPR.y, z: SPR.z, len: 0.16, r: 0.2, mat: Cst, seg: 20 });
    b.convex({
      points: [
        [s * 0.84, 0.48, IDL.z + 0.08],
        [s * 0.84, 0.82, IDL.z + 0.12],
        [s * 0.84, 0.62, IDL.z - 0.28],
        [s * 1.06, 0.66, IDL.z],
        [s * 1.06, 0.54, IDL.z],
        [s * 1.06, 0.6, IDL.z - 0.07],
      ],
      mat: P,
    });
  }

  // ---- Hull ---------------------------------------------------------------------------------
  // Lower hull between the tracks: lower nose plate, 80 mm nose plate, glacis.
  b.prismX({
    points: [
      [-2.45, 0.4],
      [2.42, 0.4],
      [2.65, 0.8],
      [2.65, 1.01],
      [-2.4, 1.01],
      [-2.4, 1.14],
      [-2.84, 1.0],
      [-2.92, 0.67],
    ],
    x0: -0.84,
    x1: 0.84,
    mat: P,
    bevel: 0.012,
  });
  // Superstructure over the tracks with the 80 mm front plate; engine deck a step lower.
  b.prismX({
    points: [
      [-2.42, 1.0],
      [2.65, 1.0],
      [2.65, 1.55],
      [2.52, 1.72],
      [0.8, 1.72],
      [0.74, 1.8],
      [-2.295, 1.8],
    ],
    x0: -1.15,
    x1: 1.15,
    mat: P,
    bevel: 0.012,
  });
  // Fenders.
  for (const s of [-1, 1]) {
    b.span({ z0: -2.98, z1: 2.68, y0: 0.99, y1: 1.0, w: 0.33, x: s * 1.285, mat: P, r: 0.003 });
    b.span({ z0: -2.98, z1: -2.4, y0: 0.99, y1: 1.0, w: 0.32, x: s * 0.98, mat: P, r: 0.003 });
    b.span({ z0: -2.99, z1: -2.97, y0: 0.9, y1: 1.0, w: 0.6, x: s * 1.14, mat: P, r: 0.003 });
  }
  // Brake access hatches with air intake cowls on the glacis, spare track links on the nose.
  for (const s of [-1, 1]) {
    b.quad({
      p: [
        [s * 0.12, 1.015, -2.79],
        [s * 0.7, 1.015, -2.79],
        [s * 0.7, 1.15, -2.42],
        [s * 0.12, 1.15, -2.42],
      ],
      t: 0.025,
      mat: P,
      out: [0, 1, 0],
    });
    b.box({ x: s * 0.41, y: 1.14, z: -2.6, w: 0.3, h: 0.06, d: 0.16, r: 0.015, mat: P });
  }
  for (let i = 0; i < 5; i++) {
    const x = -0.6 + i * 0.3;
    b.quad({
      p: [
        [x - 0.135, 0.72, -2.935],
        [x + 0.135, 0.72, -2.935],
        [x + 0.135, 0.95, -2.88],
        [x - 0.135, 0.95, -2.88],
      ],
      t: 0.035,
      mat: 'track',
      out: [0, 0, -1],
    });
  }
  for (const s of [-1, 1]) b.latheDir({ profile: torusProfile(0.05, 0.016, 8), at: [s * 0.62, 0.62, -2.96], dir: [1, 0, 0], mat: P, seg: 12 }); // tow shackles
  // Driver's visor (left) and ball-mounted MG 34 (right) in the superstructure front plate.
  const fz = (y) => -2.4 + ((y - 1.14) / 0.66) * 0.105; // front plate surface z at height y
  {
    const y = 1.5;
    b.box({ x: -0.5, y, z: fz(y) - 0.03, w: 0.36, h: 0.16, d: 0.07, r: 0.02, mat: P });
    b.box({ x: -0.5, y: y + 0.01, z: fz(y) - 0.066, w: 0.2, h: 0.022, d: 0.006, r: 0.002, mat: 'dark' });
    b.anchor('driverEye', -0.5, y + 0.01, fz(y) + 0.12);
    b.sphere({ x: 0.5, y: y - 0.02, z: fz(y) - 0.01, r: 0.14, sz: 0.55, mat: Cst, seg: 18 });
    b.cyl({ z0: fz(y) - 0.08, z1: fz(y) - 0.22, r0: 0.026, x: 0.5, y: y - 0.02, mat: 'blued', seg: 10 });
    b.cyl({ z0: fz(y) - 0.22, z1: fz(y) - 0.26, r0: 0.013, x: 0.5, y: y - 0.02, mat: 'blued', seg: 8 });
    b.anchor('bowMgMuzzle', 0.5, y - 0.02, fz(y) - 0.26);
  }
  // Hull roof hatches for driver and radio operator, headlight, horn.
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.55, y: 1.815, z: -1.85, w: 0.5, h: 0.03, d: 0.5, r: 0.01, mat: P });
    b.box({ x: s * 0.55, y: 1.835, z: -1.85, w: 0.14, h: 0.02, d: 0.04, r: 0.005, mat: P });
  }
  b.cylAxis({ axis: 'y', x: -1.12, y: 1.06, z: -2.72, len: 0.12, r: 0.02, mat: P, seg: 8 });
  b.cyl({ z0: -2.84, z1: -2.7, r0: 0.085, r1: 0.075, x: -1.12, y: 1.15, mat: P, seg: 16 });
  b.cyl({ z0: -2.846, z1: -2.838, r0: 0.07, x: -1.12, y: 1.15, mat: 'lamp', seg: 16 });
  b.anchor('headlightL', -1.12, 1.15, -2.85);
  // Engine deck: hatches, intake grilles; tools, tow cables on the superstructure sides.
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.45, y: 1.735, z: 1.75, w: 0.7, h: 0.03, d: 1.1, r: 0.01, mat: P });
    b.box({ x: s * 0.98, y: 1.735, z: 1.75, w: 0.25, h: 0.03, d: 1.2, r: 0.01, mat: 'black' });
    for (let i = 0; i < 6; i++) b.box({ x: s * 0.98, y: 1.755, z: 1.25 + i * 0.2, w: 0.26, h: 0.015, d: 0.05, r: 0.004, mat: P });
    b.rod({ from: [s * 1.165, 1.4, -1.9], to: [s * 1.165, 1.4, 1.9], r: 0.016, mat: 'steel' }); // tow cable
    b.box({ x: s * 1.17, y: 1.55, z: 0.2, w: 0.04, h: 0.08, d: 1.2, r: 0.01, mat: 'wood' });
  }
  // Rear: main muffler (left), auxiliary mufflers (right), tow bracket.
  b.cylAxis({ axis: 'x', x: -0.3, y: 1.3, z: 2.82, len: 1.1, r: 0.15, mat: 'black', seg: 18 });
  b.cylAxis({ axis: 'x', x: -0.86, y: 1.3, z: 2.82, len: 0.06, r: 0.05, mat: 'black', seg: 10 });
  for (const s of [-1, 1]) b.box({ x: -0.3 + s * 0.4, y: 1.3, z: 2.7, w: 0.05, h: 0.08, d: 0.14, r: 0.01, mat: 'black' });
  for (const x of [0.55, 0.78]) b.cylAxis({ axis: 'y', x, y: 1.28, z: 2.74, len: 0.3, r: 0.06, mat: 'black', seg: 12 });
  b.box({ x: 0, y: 0.75, z: 2.65, w: 0.3, h: 0.16, d: 0.12, r: 0.02, mat: P });
  b.anchor('exhaustL', -0.89, 1.3, 2.82);
  b.anchor('exhaustR', 0.66, 1.45, 2.74);
  // Schürzen: 5 mm plates hung from rails (separate parts so they can be knocked off).
  for (const s of [-1, 1]) {
    const L = side(s);
    b.part(`skirt${L}`, [s * 1.64, 1.62, 0]);
    for (let i = 0; i < 5; i++) {
      const z0 = -2.36 + i * 0.96;
      b.span({ z0, z1: z0 + 0.94, y0: 0.6, y1: 1.6, w: 0.006, x: s * 1.645, mat: P, r: 0.002 });
    }
    b.span({ z0: -2.38, z1: 2.44, y0: 1.58, y1: 1.63, w: 0.03, x: s * 1.625, mat: P, r: 0.004 });
    for (let i = 0; i < 6; i++) b.span({ z0: -2.38 + i * 0.96, z1: -2.34 + i * 0.96, y0: 1.56, y1: 1.6, w: 0.48, x: s * 1.39, mat: P, r: 0.004 });
    b.body();
  }

  // ---- Turret (offset 66 mm to the left) --------------------------------------------------
  const xT = -0.066,
    zT = -0.3,
    yR = 1.8;
  b.part('turret', [xT, yR, zT]);
  const base = mirrorHalf([
    [0, -0.95],
    [0.6, -0.95],
    [0.86, -0.4],
    [0.86, 0.45],
    [0.7, 0.88],
    [0, 0.9],
  ]);
  const top = mirrorHalf([
    [0, -0.84],
    [0.5, -0.84],
    [0.6, -0.4],
    [0.6, 0.4],
    [0.5, 0.7],
    [0, 0.72],
  ]);
  const P3 = (o, y) => o.map(([x, dz]) => [xT + x, y, zT + dz]);
  b.convex({ points: [...P3(base, 1.82), ...P3(top, 2.42)], mat: P });
  // Side hatches (two-piece doors with vision ports), roof fittings.
  for (const s of [-1, 1]) {
    const pts = (k) => [
      [xT + s * (0.84 - 0.29 * k), 1.86 + 0.5 * k, zT - 0.32],
      [xT + s * (0.84 - 0.29 * k), 1.86 + 0.5 * k, zT + 0.18],
    ];
    const [a0, a1] = pts(0),
      [c0, c1] = pts(0.9);
    b.quad({ p: [a0, a1, c1, c0], t: 0.03, mat: P, out: [s, 0.4, 0] });
    b.box({ x: xT + s * 0.82, y: 2.05, z: zT - 0.07, w: 0.03, h: 0.05, d: 0.08, r: 0.008, mat: 'dark' });
  }
  b.box({ x: xT + 0.32, y: 2.44, z: zT - 0.5, w: 0.2, h: 0.04, d: 0.2, r: 0.02, mat: P }); // ventilator
  b.box({ x: xT - 0.3, y: 2.44, z: zT - 0.55, w: 0.12, h: 0.04, d: 0.12, r: 0.01, mat: P }); // signal port
  // Commander's cupola with vision blocks and the hatch.
  const cz = zT + 0.42;
  b.latheDir({
    profile: [
      [0, 2.41],
      [0.36, 2.41],
      [0.36, 2.47],
      [0.33, 2.49],
      [0.33, 2.6],
      [0.29, 2.63],
      [0.29, 2.66],
      [0, 2.66],
    ].map(([r, y]) => [r, y - 2.41]),
    at: [xT, 2.41, cz],
    dir: [0, 1, 0],
    mat: P,
    seg: 28,
  });
  for (let i = 0; i < 7; i++) {
    const a = Math.PI / 2 + (i / 7) * Math.PI * 2;
    b.box({ x: xT + Math.cos(a) * 0.332, y: 2.55, z: cz - Math.sin(a) * 0.332, w: 0.012, h: 0.04, d: 0.1, ry: a, r: 0.003, mat: 'dark' });
  }
  b.cylAxis({ axis: 'y', x: xT, y: 2.675, z: cz, len: 0.03, r: 0.25, mat: P, seg: 24 });
  b.anchor('commanderEye', xT, 2.88, cz);
  b.meta.anchorParts.commanderEye = 'turret';
  b.latheDir({ profile: torusProfile(0.3, 0.012, 8), at: [xT, 2.68, cz], dir: [0, 1, 0], mat: 'steel', seg: 28 }); // MG ring
  // Turret skirts (8 mm) on brackets, with doors at the sides.
  const skirt = [
    [-1.06, -0.62],
    [-1.12, -0.5],
    [-1.12, 0.75],
    [-0.95, 1.12],
    [0.95, 1.12],
    [1.12, 0.75],
    [1.12, -0.5],
    [1.06, -0.62],
  ];
  for (let i = 0; i < skirt.length - 1; i++) {
    const [x0, d0] = skirt[i],
      [x1, d1] = skirt[i + 1];
    b.quad({
      p: [
        [xT + x0, 1.86, zT + d0],
        [xT + x1, 1.86, zT + d1],
        [xT + x1, 2.4, zT + d1],
        [xT + x0, 2.4, zT + d0],
      ],
      t: 0.01,
      mat: P,
    });
  }
  for (const s of [-1, 1]) for (const dz of [-0.35, 0.55]) b.rod({ from: [xT + s * 0.66, 2.2, zT + dz], to: [xT + s * 1.11, 2.2, zT + dz], r: 0.018, mat: P });
  b.rod({ from: [xT, 2.2, zT + 0.72], to: [xT, 2.2, zT + 1.11], r: 0.018, mat: P });
  // MG 34 on the cupola ring (anti-aircraft mount).
  const mg = [xT - 0.22, 2.74, cz - 0.2];
  b.part('pintleMg', mg);
  b.box({ x: mg[0], y: mg[1] + 0.04, z: mg[2] + 0.12, w: 0.06, h: 0.09, d: 0.36, r: 0.01, mat: 'blued' });
  b.cyl({ z0: mg[2] - 0.06, z1: mg[2] - 0.6, r0: 0.024, x: mg[0], y: mg[1] + 0.05, mat: 'blued', seg: 10 });
  b.cyl({ z0: mg[2] - 0.6, z1: mg[2] - 0.66, r0: 0.014, x: mg[0], y: mg[1] + 0.05, mat: 'blued', seg: 8 });
  b.box({ x: mg[0], y: mg[1] + 0.02, z: mg[2] + 0.42, w: 0.05, h: 0.12, d: 0.2, r: 0.01, mat: 'blued' });
  b.cylAxis({ axis: 'x', x: mg[0] - 0.08, y: mg[1] + 0.02, z: mg[2] + 0.12, len: 0.1, r: 0.07, mat: 'blued', seg: 14 });
  b.cylAxis({ axis: 'y', x: mg[0], y: mg[1] - 0.05, z: mg[2], len: 0.1, r: 0.015, mat: 'steel', seg: 8 });
  b.at('pintleMg', 'mgMount', mg[0], mg[1], mg[2]);
  b.at('pintleMg', 'mgMuzzle', mg[0], mg[1] + 0.05, mg[2] - 0.66);
  b.body();

  // ---- Gun: 7.5 cm KwK 40 L/48 ---------------------------------------------------------------
  const yG = 2.03,
    zG = zT - 0.8,
    zM = zT - 0.95; // turret front plate
  b.part('gun', [xT, yG, zG]);
  b.box({ x: xT, y: yG, z: zM - 0.1, w: 0.64, h: 0.36, d: 0.2, r: 0.07, mat: Cst }); // mantlet
  b.cyl({ z0: zM - 0.2, z1: zM - 0.5, r0: 0.105, r1: 0.1, x: xT, y: yG, mat: Cst, seg: 20 }); // recoil sleeve
  const zB = zM - 0.5;
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.078, -0.02],
      [0.072, 0.1],
      [0.064, 1.1],
      [0.057, 2.04],
      [0.06, 2.06],
      [0, 2.06],
    ],
    at: [xT, yG, zB],
    dir: [0, 0, -1],
    mat: P,
    seg: 18,
  });
  // Double-baffle muzzle brake.
  const zMB = zB - 2.06;
  b.latheDir({
    profile: [
      [0, -0.01],
      [0.07, -0.01],
      [0.085, 0.02],
      [0.085, 0.05],
      [0.07, 0.06],
      [0.07, 0.11],
      [0.085, 0.12],
      [0.085, 0.16],
      [0.07, 0.17],
      [0.07, 0.2],
      [0.085, 0.21],
      [0.085, 0.235],
      [0.045, 0.245],
      [0.04, 0.2],
      [0, 0.2],
    ],
    at: [xT, yG, zMB],
    dir: [0, 0, -1],
    mat: P,
    seg: 18,
  });
  for (const s of [-1, 1]) for (const dz of [0.035, 0.14]) b.box({ x: xT + s * 0.072, y: yG, z: zMB - dz, w: 0.03, h: 0.1, d: 0.06, r: 0.005, mat: 'dark' });
  b.cyl({ z0: zM - 0.2, z1: zM - 0.21, r0: 0.022, x: xT + 0.2, y: yG, mat: 'dark', seg: 10 }); // coax MG port
  b.cyl({ z0: zM - 0.2, z1: zM - 0.26, r0: 0.014, x: xT + 0.2, y: yG, mat: 'blued', seg: 8 });
  b.cyl({ z0: zM - 0.19, z1: zM - 0.205, r0: 0.024, x: xT - 0.2, y: yG + 0.03, mat: 'dark', seg: 10 }); // TZF port
  b.at('gun', 'muzzle', xT, yG, zMB - 0.245);
  b.at('gun', 'coaxMuzzle', xT + 0.2, yG, zM - 0.26);
  b.at('gun', 'gunnerEye', xT - 0.2, yG + 0.03, zM - 0.205);
  b.body();
  b.meta.partParents = { gun: 'turret', pintleMg: 'turret' };

  // ---- Meta, armor, modules -----------------------------------------------------------------
  Object.assign(b.meta, {
    name: 'Panzer IV Ausf. H',
    faction: 'de',
    type: 'tracked',
    crew: 5,
    gun: { name: '7.5 cm KwK 40 L/48', caliber: 75 },
    gunElevation: [-8, 20],
    turretTraverse: 14,
    groundClearance: 0.4,
    turretRing: { center: [xT, yR, zT], radius: 0.84 },
    specs: { mass: 25000, maxSpeed: 38, power: 300, engine: 'Maybach HL 120 TRM', fuel: 470 },
  });
  b.armorZY('nosePlate', 'body', 80, [-2.92, 0.67], [-2.84, 1.0], -0.84, 0.84, [0, 0, -1]);
  b.armorZY('lowerNose', 'body', 20, [-2.45, 0.4], [-2.92, 0.67], -0.84, 0.84, [0, -0.5, -1]);
  b.armorZY('glacis', 'body', 25, [-2.84, 1.0], [-2.4, 1.14], -0.84, 0.84, [0, 1, -0.3]);
  b.armorZY('superFront', 'body', 80, [-2.42, 1.0], [-2.295, 1.8], -1.15, 1.15, [0, 0, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorXY(`sideLower${L}`, 'body', 30, [s * 0.84, 0.4], [s * 0.84, 1.0], -2.45, 2.5, [s, 0, 0]);
    b.armorXY(`sideUpper${L}`, 'body', 30, [s * 1.15, 1.0], [s * 1.15, 1.8], -2.4, 2.65, [s, 0, 0]);
    b.armorZY(`sponsonFloor${L}`, 'body', 10, [-2.4, 1.0], [2.65, 1.0], s * 0.84, s * 1.15, [0, -1, 0]);
    b.armorXY(`schurzen${L}`, 'body', 5, [s * 1.648, 0.6], [s * 1.648, 1.6], -2.36, 2.44, [s, 0, 0]);
  }
  b.armorZY('roof', 'body', 16, [-2.295, 1.8], [0.74, 1.8], -1.15, 1.15, [0, 1, 0]);
  b.armorZY('engineDeck', 'body', 10, [0.8, 1.72], [2.52, 1.72], -1.15, 1.15, [0, 1, 0]);
  b.armorZY('rearUpper', 'body', 20, [2.65, 1.55], [2.52, 1.72], -1.15, 1.15, [0, 0.5, 1]);
  b.armorZY('rear', 'body', 20, [2.65, 0.8], [2.65, 1.55], -1.15, 1.15, [0, 0, 1]);
  b.armorZY('rearLower', 'body', 20, [2.42, 0.4], [2.65, 0.8], -0.84, 0.84, [0, -0.5, 1]);
  b.armorZY('belly', 'body', 10, [-2.45, 0.4], [2.42, 0.4], -0.84, 0.84, [0, -1, 0]);
  // Turret faces (vehicle space at rest).
  const tp = (x, dz, y) => [xT + x, y, zT + dz];
  b.armorQuad('turretFront', 'turret', 50, [tp(-0.6, -0.95, 1.82), tp(0.6, -0.95, 1.82), tp(0.5, -0.84, 2.42), tp(-0.5, -0.84, 2.42)], [0, 0, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorQuad(`turretFrontSide${L}`, 'turret', 30, [tp(s * 0.6, -0.95, 1.82), tp(s * 0.86, -0.4, 1.82), tp(s * 0.6, -0.4, 2.42), tp(s * 0.5, -0.84, 2.42)], [s, 0, -0.5]);
    b.armorQuad(`turretSide${L}`, 'turret', 30, [tp(s * 0.86, -0.4, 1.82), tp(s * 0.86, 0.45, 1.82), tp(s * 0.6, 0.4, 2.42), tp(s * 0.6, -0.4, 2.42)], [s, 0.3, 0]);
    b.armorQuad(`turretRearSide${L}`, 'turret', 30, [tp(s * 0.86, 0.45, 1.82), tp(s * 0.7, 0.88, 1.82), tp(s * 0.5, 0.7, 2.42), tp(s * 0.6, 0.4, 2.42)], [s, 0, 0.5]);
    b.armorXZ(`turretSkirt${L}`, 'turret', 8, [xT + s * 1.12, zT - 0.5], [xT + s * 1.12, zT + 0.75], 1.86, 2.4, [s, 0, 0]);
  }
  b.armorQuad('turretRear', 'turret', 30, [tp(-0.7, 0.88, 1.82), tp(0.7, 0.88, 1.82), tp(0.5, 0.72, 2.42), tp(-0.5, 0.72, 2.42)], [0, 0, 1]);
  b.armorXZ('turretSkirtRear', 'turret', 8, [xT - 0.95, zT + 1.12], [xT + 0.95, zT + 1.12], 1.86, 2.4, [0, 0, 1]);
  b.armorZY('turretRoofFront', 'turret', 16, [zT - 0.84, 2.42], [zT, 2.42], xT - 0.6, xT + 0.6, [0, 1, 0]);
  b.armorZY('turretRoofRear', 'turret', 10, [zT, 2.42], [zT + 0.72, 2.42], xT - 0.6, xT + 0.6, [0, 1, 0]);
  b.armor('cupola', 'turret', 50, [xT, 2.54, cz - 0.33], [0.66, 0, 0], [0, 0.24, 0], [0, 0, -1]);
  b.armor('mantlet', 'gun', 50, [xT, yG, zM - 0.2], [0.64, 0, 0], [0, 0.36, 0], [0, 0, -1]);
  b.armor('recoilSleeve', 'gun', 50, [xT, yG, zM - 0.5], [0.21, 0, 0], [0, 0.21, 0], [0, 0, -1]);
  // Internal modules.
  b.module('engine', 'body', [0.1, 1.2, 1.7], [0.5, 0.42, 0.6]);
  b.module('transmission', 'body', [0, 0.75, -2.45], [0.55, 0.28, 0.3]);
  b.module('fuel', 'body', [0, 0.55, 0.4], [0.6, 0.12, 0.4]);
  b.module('fuel', 'body', [-0.6, 1.2, 1.05], [0.25, 0.3, 0.2]);
  for (const s of [-1, 1]) b.module('ammo', 'body', [s * 0.86, 1.3, -0.6], [0.24, 0.3, 0.45]);
  b.module('ammo', 'body', [0.55, 0.65, -0.95], [0.25, 0.2, 0.3]);
  b.module('driver', 'body', [-0.5, 1.25, -1.95], [0.25, 0.45, 0.3]);
  b.module('radio', 'body', [0.5, 1.25, -1.95], [0.25, 0.45, 0.3]); // radio operator / bow gunner
  b.module('gunner', 'turret', [xT - 0.35, 1.85, zT - 0.5], [0.2, 0.45, 0.25]);
  b.module('commander', 'turret', [xT, 2.05, cz], [0.22, 0.5, 0.25]);
  b.module('loader', 'turret', [xT + 0.4, 1.75, zT - 0.1], [0.22, 0.5, 0.25]);
}

// ---------------------------------------------------------------------------------------
// Volkswagen Typ 82 Kübelwagen (1940-45): angular pressed-steel body with four doors, rear
// air-cooled flat four, spare wheel on the sloping front lid, fold-down windshield, top
// folded on the rear deck. 3.74 m long, 1.60 m wide, 1.35 m to the windshield top, 2.40 m
// wheelbase, 1.356 m track, 5.25-16 tires (0.34 m radius), 290 mm ground clearance. Driver
// on the left, 4 seats. Doors are parts hinged at their front edge.
export function kubelwagen(b) {
  const WB = 2.4,
    TRK = 1.356,
    R = 0.34,
    TW = 0.14;
  const zF = -WB / 2,
    zR = WB / 2,
    xw = TRK / 2;
  const P = 'germanGrey';
  // ---- Wheels -------------------------------------------------------------------------------
  const wheel = jeepWheel({ r: R, width: TW, rimR: 0.205, lugs: 16, lugH: 0.011, rimMat: P, splitBolts: 0 });
  for (const [name, x, z] of [
    ['wheelFL', -xw, zF],
    ['wheelFR', xw, zF],
    ['wheelRL', -xw, zR],
    ['wheelRR', xw, zR],
  ]) {
    b.part(name, [x, R, z]).addAll(wheel, { x, y: R, z, ry: x < 0 ? Math.PI : 0 });
  }
  b.body();

  // ---- Chassis: platform floor pan, front beam axle, rear swing axles with portal hubs ----
  b.span({ z0: -1.7, z1: 1.84, y0: 0.4, y1: 0.445, w: 1.3, mat: P, r: 0.01 });
  b.span({ z0: -0.25, z1: 1.2, y0: 0.36, y1: 0.45, w: 0.2, mat: P, r: 0.02 }); // backbone tunnel
  for (const dz of [-0.07, 0.07]) b.cylAxis({ axis: 'x', x: 0, y: 0.44, z: zF + dz, len: 1.12, r: 0.035, mat: P });
  for (const s of [-1, 1]) {
    b.rod({ from: [s * 0.5, 0.44, zF + 0.07], to: [s * 0.6, R, zF], r: 0.03, mat: P });
    b.rod({ from: [s * 0.12, 0.45, zR], to: [s * 0.56, 0.42, zR], r: 0.04, mat: P });
    b.box({ x: s * 0.575, y: 0.38, z: zR, w: 0.07, h: 0.2, d: 0.17, r: 0.02, mat: P }); // portal gear case
  }
  b.box({ x: 0, y: 0.5, z: zR, w: 0.34, h: 0.2, d: 0.3, r: 0.03, mat: P }); // transaxle

  // ---- Body ---------------------------------------------------------------------------------
  const sideOutline = [
    [-1.72, 0.47],
    ...arc(zF, 0.4, 0.41, Math.PI - 0.17, 0.17, 12),
    ...arc(zR, 0.4, 0.41, Math.PI - 0.17, 0.17, 12),
    [1.86, 0.47],
    [1.88, 0.72],
    [1.42, 0.97],
    [-0.6, 0.97],
    [-0.62, 0.96],
    [-1.8, 0.66],
  ];
  const doorF = roundRect(-0.24, 0.73, 0.32, 0.225, 0.04),
    doorR = roundRect(0.45, 0.73, 0.3, 0.225, 0.04);
  for (const s of [-1, 1]) {
    b.prismX({ points: sideOutline, holes: [doorF, doorR], x0: s * 0.71, x1: s * 0.74, mat: P, bevel: 0.006 });
    // Pressed ribs on the front and rear quarters.
    for (const [z0, z1] of [
      [-1.62, -0.6],
      [0.8, 1.7],
    ])
      b.span({ z0, z1, y0: 0.815, y1: 0.835, w: 0.016, x: s * 0.745, mat: P, r: 0.004 });
    // Flat fender shelves over the wheels.
    for (const zc of [zF, zR]) {
      const line = [
        [zc - 0.52, 0.5],
        [zc - 0.4, 0.84],
        [zc + 0.4, 0.84],
        [zc + 0.5, 0.62],
      ];
      b.prismX({ points: ribbon(line, 0.014), x0: s * 0.7, x1: s * 0.8, mat: P, bevel: 0.004 });
    }
  }
  // Doors (parts hinged at the front edge, vertical axis).
  for (const s of [-1, 1]) {
    for (const [name, o, z0] of [
      [`doorF${side(s)}`, doorF, -0.56],
      [`doorR${side(s)}`, doorR, 0.15],
    ]) {
      b.part(name, [s * 0.745, 0.73, z0]);
      const inset = o.map(([z, y]) => [z + (z < z0 + 0.3 ? 0.004 : -0.004) * 1, y + (y > 0.73 ? -0.004 : 0.004)]);
      b.prismX({ points: inset, x0: s * 0.712, x1: s * 0.745, mat: P, bevel: 0.005 });
      b.span({ z0: z0 + 0.04, z1: z0 + 0.6, y0: 0.815, y1: 0.835, w: 0.016, x: s * 0.75, mat: P, r: 0.004 });
      b.box({ x: s * 0.755, y: 0.88, z: z0 + 0.5, w: 0.02, h: 0.02, d: 0.1, r: 0.006, mat: 'steel' }); // handle
      b.meta.hinges[name] = { axis: [0, 1, 0], open: s * 1.2 };
    }
  }
  b.body();
  // Front luggage compartment (fuel tank inside), sloping lid, nose panel.
  b.prismX({
    points: [
      [-1.72, 0.47],
      [-0.62, 0.47],
      [-0.62, 0.96],
      [-1.8, 0.66],
    ],
    x0: -0.52,
    x1: 0.52,
    mat: P,
    bevel: 0.01,
  });
  b.quad({
    p: [
      [-0.735, 0.66, -1.8],
      [0.735, 0.66, -1.8],
      [0.735, 0.96, -0.62],
      [-0.735, 0.96, -0.62],
    ],
    t: 0.02,
    mat: P,
    out: [0, 1, 0],
  });
  b.quad({
    p: [
      [-0.735, 0.47, -1.72],
      [0.735, 0.47, -1.72],
      [0.735, 0.66, -1.8],
      [-0.735, 0.66, -1.8],
    ],
    t: 0.02,
    mat: P,
    out: [0, 0, -1],
  });
  for (const x of [-0.2, 0.2]) b.span({ z0: -1.86, z1: -1.78, y0: 0.5, y1: 0.58, w: 0.06, x, mat: P, r: 0.01 }); // bumper horns
  b.span({ z0: -1.87, z1: -1.83, y0: 0.5, y1: 0.58, w: 1.2, mat: P, r: 0.01 });
  // Spare wheel lying on the front lid.
  {
    const ang = Math.atan2(0.3, 1.18);
    const n = [0, Math.cos(ang), -Math.sin(ang)];
    const zc = -1.2,
      yh = 0.66 + ((1.8 + zc) / 1.18) * 0.3;
    const c = [0, yh + n[1] * (TW / 2 + 0.012), zc + n[2] * (TW / 2 + 0.012)];
    b.addAll(wheel, { x: c[0], y: c[1], z: c[2], ...eulerFromTo([1, 0, 0], n) });
  }
  // Cowl, dash, floor, engine compartment and rear deck with cooling louvers.
  b.span({ z0: -0.64, z1: -0.58, y0: 0.6, y1: 0.965, w: 1.44, mat: P, r: 0.01 });
  b.cyl({ z0: -0.58, z1: -0.574, r0: 0.05, x: 0.0, y: 0.84, mat: 'dark', seg: 16 });
  b.span({ z0: -0.6, z1: 1.05, y0: 0.44, y1: 0.47, w: 1.44, mat: P, r: 0.004 });
  b.prismX({
    points: [
      [1.0, 0.47],
      [1.86, 0.47],
      [1.88, 0.72],
      [1.42, 0.97],
      [1.0, 0.97],
    ],
    x0: -0.56,
    x1: 0.56,
    mat: P,
    bevel: 0.01,
  });
  b.span({ z0: 1.0, z1: 1.43, y0: 0.95, y1: 0.97, w: 1.47, mat: P, r: 0.004 });
  b.quad({
    p: [
      [-0.735, 0.97, 1.42],
      [0.735, 0.97, 1.42],
      [0.735, 0.72, 1.88],
      [-0.735, 0.72, 1.88],
    ],
    t: 0.02,
    mat: P,
    out: [0, 1, 0],
  });
  for (let i = 0; i < 7; i++) {
    const t = 0.18 + i * 0.1;
    const y = 0.97 - 0.25 * t,
      z = 1.42 + 0.46 * t;
    b.box({ x: 0, y: y + 0.004, z, w: 0.9, h: 0.012, d: 0.025, rx: Math.atan2(0.25, 0.46), r: 0.003, mat: 'dark' });
  }
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.6, y: 0.8, z: 1.84, w: 0.07, h: 0.05, d: 0.04, r: 0.008, mat: 'redLamp' });
    b.cyl({ z0: 1.82, z1: 1.94, r0: 0.022, x: s * 0.1, y: 0.43, mat: 'black', seg: 10 });
    b.anchor(`exhaust${side(s)}`, s * 0.1, 0.43, 1.94);
  }
  b.cylAxis({ axis: 'x', x: 0, y: 0.44, z: 1.8, len: 0.4, r: 0.08, mat: 'black' }); // muffler
  // Headlights on the fenders, Notek blackout lamp.
  for (const s of [-1, 1]) {
    b.cylAxis({ axis: 'y', x: s * 0.6, y: 0.87, z: -1.42, len: 0.06, r: 0.015, mat: P, seg: 8 });
    b.cyl({ z0: -1.52, z1: -1.38, r0: 0.075, r1: 0.06, x: s * 0.6, y: 0.93, mat: P, seg: 16 });
    b.cyl({ z0: -1.526, z1: -1.518, r0: 0.066, x: s * 0.6, y: 0.93, mat: 'lamp', seg: 16 });
    b.anchor(`headlight${side(s)}`, s * 0.6, 0.93, -1.53);
  }
  b.box({ x: -0.62, y: 0.87, z: -1.66, w: 0.1, h: 0.05, d: 0.06, r: 0.01, mat: P });
  // Windshield (folds forward onto the lid).
  const hz = -0.6,
    hy = 0.965;
  b.part('windshield', [0, hy, hz]);
  const bar = (x0, x1, y0, y1) => b.span({ z0: hz - 0.016, z1: hz + 0.016, y0, y1, w: x1 - x0, x: (x0 + x1) / 2, mat: P, r: 0.008 });
  bar(-0.7, 0.7, hy, hy + 0.035);
  bar(-0.7, 0.7, 1.31, 1.345);
  bar(-0.7, -0.665, hy, 1.345);
  bar(0.665, 0.7, hy, 1.345);
  b.span({ z0: hz - 0.003, z1: hz + 0.003, y0: hy + 0.035, y1: 1.31, w: 1.33, mat: 'glass' });
  b.body();
  b.meta.hinges.windshield = { axis: [1, 0, 0], open: -1.35 };
  // Steering wheel, seats, folded top.
  steeringWheel(b, { hub: [-0.33, 1.0, -0.33], col: [0, 0.55, 0.835], r: 0.2, spokes: [-Math.PI / 2 + 0.5, -Math.PI / 2 - 0.5, Math.PI / 2 + Math.PI], columnLen: 0.75 });
  const seat = (x, z, w) => {
    b.box({ x, y: 0.635, z, w, h: 0.09, d: 0.42, r: 0.035, mat: 'canvasGerman' });
    b.box({ x, y: 0.93, z: z + 0.24, w, h: 0.42, d: 0.07, r: 0.03, rx: 0.15, mat: 'canvasGerman' });
    b.box({ x, y: 0.53, z, w: w - 0.04, h: 0.12, d: 0.38, r: 0.01, mat: P });
  };
  seat(-0.33, 0.06, 0.44);
  seat(0.33, 0.06, 0.44);
  b.box({ x: 0, y: 0.6, z: 0.76, w: 1.2, h: 0.24, d: 0.38, r: 0.01, mat: P });
  b.box({ x: 0, y: 0.755, z: 0.76, w: 1.22, h: 0.08, d: 0.42, r: 0.035, mat: 'canvasGerman' });
  b.box({ x: 0, y: 0.95, z: 0.99, w: 1.22, h: 0.36, d: 0.06, r: 0.03, rx: 0.12, mat: 'canvasGerman' });
  b.box({ x: 0, y: 1.035, z: 1.24, w: 1.34, h: 0.13, d: 0.26, r: 0.06, mat: 'canvasGerman' });
  for (const s of [-1, 1]) b.rod({ from: [s * 0.75, 0.95, 0.95], to: [s * 0.75, 1.05, 1.4], r: 0.011, mat: P });

  // ---- Anchors, meta ---------------------------------------------------------------------------
  b.anchor('driverSeat', -0.33, 0.76, 0.1);
  b.anchor('driverEye', -0.33, 1.44, 0.03);
  b.anchor('seat1', 0.33, 0.76, 0.1);
  b.anchor('seat2', -0.3, 0.86, 0.8);
  b.anchor('seat3', 0.3, 0.86, 0.8);
  Object.assign(b.meta, {
    name: 'Kübelwagen Typ 82',
    faction: 'de',
    type: 'wheeled',
    crew: 1,
    seats: 4,
    wheelRadius: R,
    wheelWidth: TW,
    wheelbase: WB,
    trackWidth: TRK,
    groundClearance: 0.29,
    maxSteer: 0.55,
    wheels: { wheelFL: [-xw, R, zF], wheelFR: [xw, R, zF], wheelRL: [-xw, R, zR], wheelRR: [xw, R, zR] },
    specs: { mass: 725, maxSpeed: 80, power: 25, fuel: 40, range: 450, drive: '4x2, rear engine' },
  });
  b.armorZY('front', 'body', 0, [-1.72, 0.47], [-1.8, 0.66], -0.735, 0.735, [0, 0, -1]);
  b.armorZY('hood', 'body', 0, [-1.8, 0.66], [-0.62, 0.96], -0.735, 0.735, [0, 1, 0]);
  for (const s of [-1, 1]) b.armorXY(`side${side(s)}`, 'body', 0, [s * 0.74, 0.46], [s * 0.74, 0.97], -1.75, 1.87, [s, 0, 0]);
  b.armorZY('rear', 'body', 0, [1.86, 0.47], [1.88, 0.72], -0.735, 0.735, [0, 0, 1]);
  b.armorZY('engineLid', 'body', 0, [1.42, 0.97], [1.88, 0.72], -0.735, 0.735, [0, 1, 1]);
  b.armorZY('floor', 'body', 0, [-1.7, 0.4], [1.84, 0.4], -0.65, 0.65, [0, -1, 0]);
  b.armorZY('windshield', 'body', 0, [hz, hy], [hz, 1.345], -0.7, 0.7, [0, 0, -1]);
  b.module('engine', 'body', [0, 0.66, 1.48], [0.42, 0.2, 0.34]);
  b.module('fuel', 'body', [0, 0.62, -1.15], [0.35, 0.1, 0.25]);
  b.module('driver', 'body', [-0.33, 1.0, 0.05], [0.22, 0.42, 0.25]);
}
