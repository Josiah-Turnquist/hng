// German vehicles. Conventions (vkit.js): meters, +X right, +Y up, -Z forward; origin on the
// ground at the middle of the wheelbase (wheeled) or of the track contact length (tracked).
import { DEG, ribbon, roundRect, arc, torusProfile, section, mirrorHalf, eulerFromTo, slotV } from './vkit.js';
import { jeepWheel, roadWheel, sprocket, runningGear, steeringWheel } from './parts.js';

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
    b.anchor('driverEye', -0.5, y + 0.01, fz(y) - 0.075); // at the visor slit
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
  b.armorPoly('turretFront', 'turret', 50, [tp(-0.6, -0.95, 1.82), tp(0.6, -0.95, 1.82), tp(0.5, -0.84, 2.42), tp(-0.5, -0.84, 2.42)], [0, 0, -1], 3, [1, 0, 0]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorPoly(`turretFrontSide${L}`, 'turret', 30, [tp(s * 0.6, -0.95, 1.82), tp(s * 0.86, -0.4, 1.82), tp(s * 0.6, -0.4, 2.42), tp(s * 0.5, -0.84, 2.42)], [s, 0, -0.5], 3);
    b.armorPoly(`turretSide${L}`, 'turret', 30, [tp(s * 0.86, -0.4, 1.82), tp(s * 0.86, 0.45, 1.82), tp(s * 0.6, 0.4, 2.42), tp(s * 0.6, -0.4, 2.42)], [s, 0.3, 0], 3, [0, 0, 1]);
    b.armorPoly(`turretRearSide${L}`, 'turret', 30, [tp(s * 0.86, 0.45, 1.82), tp(s * 0.7, 0.88, 1.82), tp(s * 0.5, 0.7, 2.42), tp(s * 0.6, 0.4, 2.42)], [s, 0, 0.5], 2);
    b.armorXZ(`turretSkirt${L}`, 'turret', 8, [xT + s * 1.12, zT - 0.5], [xT + s * 1.12, zT + 0.75], 1.86, 2.4, [s, 0, 0]);
  }
  b.armorPoly('turretRear', 'turret', 30, [tp(-0.7, 0.88, 1.82), tp(0.7, 0.88, 1.82), tp(0.5, 0.72, 2.42), tp(-0.5, 0.72, 2.42)], [0, 0, 1], 3, [1, 0, 0]);
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
// Panzerkampfwagen VI Tiger Ausf. E (mid 1943): box hull with the superstructure over the
// tracks, horseshoe turret with the cast cupola, 8.8 cm KwK 36 L/56 with the double-baffle
// muzzle brake, interleaved 800 mm road wheels on 8 torsion-bar stations a side (outer and
// inner wheels on even stations, a double middle wheel on odd ones), front sprocket (18
// teeth), rear idler, Kgs 63/725/130 combat track (96 links). 8.45 m long with the gun
// (hull 6.32), 3.56 m wide, 3.0 m high; 54 t.
// Armor: nose and front plate 100 mm (24 / 10 deg), glacis 60 mm at 80 deg, superstructure
// sides 80 mm, lower sides 60 mm, rear 80 mm, roof and belly 25 mm; turret front 100 mm,
// mantlet 120 mm, sides and rear 80 mm, roof 25 mm, cupola 110 mm.
export function tiger1(b) {
  const P = 'dunkelgelb',
    Cst = 'castGerman';
  // ---- Running gear -------------------------------------------------------------------------
  const T = 0.055,
    RW = 0.4,
    yW = RW + T,
    OX = 1.41;
  const wheels = [];
  for (let i = 0; i < 8; i++) wheels.push([-1.8 + (3.6 * i) / 7, yW]);
  const single = roadWheel({ r: RW, width: 0.1, tire: 0.06, dish: 0.03, hubR: 0.1, hubLen: 0.04, mat: P, bolts: 8 });
  const outerInner = [...single.map((it) => ({ mat: it.mat, geo: it.geo.clone().translate(0.235, 0, 0) })), ...single.map((it) => ({ mat: it.mat, geo: it.geo.clone().translate(-0.235, 0, 0) }))];
  const middle = roadWheel({ r: RW, width: 0.24, gap: 0.06, tire: 0.06, dish: 0.03, hubR: 0.1, hubLen: 0.04, mat: P, bolts: 8 });
  const SPR = { z: -2.6, y: 0.53 },
    IDL = { z: 2.53, y: 0.555 };
  runningGear(b, {
    wheels,
    wheel: (i) => (i % 2 === 0 ? outerInner : middle),
    wheelR: RW,
    sprocket: { ...SPR, r: 0.3743, teeth: 18, items: sprocket({ n: 18, r0: 0.345, r1: 0.405, ringGap: 0.26, t: 0.04, drumR: 0.29, hubR: 0.16, hubLen: 0.11, mat: P, bolts: 12, tooth: 0.5, tip: 0.2 }) },
    idler: { ...IDL, r: 0.3 + T / 2, items: roadWheel({ r: 0.3, width: 0.3, gap: 0.08, rubber: false, dish: 0.035, hubR: 0.09, hubLen: 0.05, mat: P, holes: 8, holeR: 0.045 }) },
    track: { width: 0.725, pitch: 0.13, thick: T, offsetX: OX, realLinks: 96, sag: 0.015 },
  });
  for (const s of [-1, 1]) {
    for (const [z] of wheels) b.rod({ from: [s * 1.0, 0.56, z + 0.3], to: [s * 1.1, yW, z], r: 0.045, mat: P }); // torsion arms
    b.cylAxis({ axis: 'x', x: s * 1.07, y: SPR.y, z: SPR.z, len: 0.16, r: 0.22, mat: Cst, seg: 20 });
    b.rod({ from: [s * 1.0, 0.75, IDL.z - 0.3], to: [s * 1.15, IDL.y, IDL.z], r: 0.06, mat: P });
  }

  // ---- Hull ---------------------------------------------------------------------------------
  const fz = (y) => -2.42 + ((1.3 - y) / 0.56) * 0.1; // front plate surface z at height y (10 deg)
  // Lower hull: lower nose, nose plate (24 deg), glacis (80 deg), lower rear.
  b.prismX({
    points: [
      [-2.75, 0.47],
      [2.75, 0.47],
      [3.06, 0.62],
      [3.12, 0.96],
      [-2.42, 0.96],
      [-2.42, 1.3],
      [-2.89, 1.22],
      [-3.12, 0.7],
    ],
    x0: -1.0,
    x1: 1.0,
    mat: P,
    bevel: 0.015,
  });
  // Superstructure over the tracks: front plate (10 deg), roof, rear plate.
  b.prismX({
    points: [
      [fz(0.95), 0.95],
      [3.12, 0.95],
      [3.04, 1.86],
      [fz(1.86), 1.86],
    ],
    x0: -1.79,
    x1: 1.79,
    mat: P,
    bevel: 0.015,
  });
  // Front and rear mudguards, side fender strips.
  for (const s of [-1, 1]) {
    b.span({ z0: -3.17, z1: fz(1.1), y0: 1.1, y1: 1.112, w: 0.76, x: s * 1.41, mat: P, r: 0.004 });
    b.span({ z0: -3.18, z1: -3.16, y0: 0.98, y1: 1.112, w: 0.76, x: s * 1.41, mat: P, r: 0.004 });
    b.span({ z0: 3.08, z1: 3.24, y0: 0.94, y1: 0.952, w: 0.76, x: s * 1.41, mat: P, r: 0.004 });
  }
  // Driver's visor (left), ball-mounted MG 34 (right), roof hatches, headlights.
  {
    const y = 1.6;
    b.box({ x: -0.55, y, z: fz(y) - 0.04, w: 0.42, h: 0.18, d: 0.09, r: 0.025, mat: P });
    b.box({ x: -0.55, y: y + 0.01, z: fz(y) - 0.087, w: 0.22, h: 0.022, d: 0.006, r: 0.002, mat: 'dark' });
    b.anchor('driverEye', -0.55, y + 0.01, fz(y) - 0.095); // at the visor slit
    b.sphere({ x: 0.55, y: y - 0.04, z: fz(y) - 0.01, r: 0.16, sz: 0.55, mat: Cst, seg: 18 });
    b.cyl({ z0: fz(y) - 0.08, z1: fz(y) - 0.24, r0: 0.026, x: 0.55, y: y - 0.04, mat: 'blued', seg: 10 });
    b.cyl({ z0: fz(y) - 0.24, z1: fz(y) - 0.28, r0: 0.013, x: 0.55, y: y - 0.04, mat: 'blued', seg: 8 });
    b.anchor('bowMgMuzzle', 0.55, y - 0.04, fz(y) - 0.28);
  }
  for (const s of [-1, 1]) {
    b.latheDir({
      profile: [
        [0, 0.04],
        [0.24, 0.035],
        [0.27, 0.015],
        [0.27, 0],
        [0, 0],
      ],
      at: [s * 0.62, 1.86, -1.85],
      dir: [0, 1, 0],
      mat: P,
      seg: 22,
    });
    b.cyl({ z0: fz(1.86) - 0.02, z1: fz(1.86) + 0.12, r0: 0.08, r1: 0.075, x: s * 0.82, y: 1.95, mat: P, seg: 16 });
    b.cyl({ z0: fz(1.86) - 0.026, z1: fz(1.86) - 0.018, r0: 0.068, x: s * 0.82, y: 1.95, mat: 'lamp', seg: 16 });
    b.cylAxis({ axis: 'y', x: s * 0.82, y: 1.88, z: fz(1.86) + 0.05, len: 0.05, r: 0.02, mat: P, seg: 8 });
    b.anchor(`headlight${side(s)}`, s * 0.82, 1.95, fz(1.86) - 0.03);
    b.rod({ from: [s * 1.8, 1.45, -2.2], to: [s * 1.8, 1.45, 2.4], r: 0.018, mat: 'steel' }); // tow cables
    b.rod({ from: [s * 1.8, 1.3, -2.2], to: [s * 1.8, 1.3, 2.4], r: 0.018, mat: 'steel' });
  }
  // Engine deck: radiator grilles, fan covers, engine hatch; rear exhausts with guards.
  for (const s of [-1, 1]) {
    b.box({ x: s * 1.3, y: 1.87, z: 1.75, w: 0.8, h: 0.03, d: 1.9, r: 0.01, mat: 'black' });
    for (let i = 0; i < 9; i++) b.box({ x: s * 1.3, y: 1.89, z: 0.95 + i * 0.2, w: 0.82, h: 0.02, d: 0.04, r: 0.005, mat: P });
    b.cylAxis({ axis: 'y', x: s * 0.62, y: 1.875, z: 2.55, len: 0.04, r: 0.24, mat: 'black', seg: 22 });
    b.cylAxis({ axis: 'y', x: s * 0.62, y: 1.9, z: 2.55, len: 0.02, r: 0.06, mat: P, seg: 12 });
    const ex = s * 0.55;
    b.cylAxis({ axis: 'y', x: ex, y: 1.62, z: 3.16, len: 0.7, r: 0.12, mat: P, seg: 16 });
    b.cyl({ z0: 3.1, z1: 3.16, r0: 0.05, x: ex, y: 2.0, mat: 'black', seg: 10 });
    b.cylAxis({ axis: 'y', x: ex, y: 2.0, z: 3.16, len: 0.08, r: 0.05, mat: 'black', seg: 10 });
    b.anchor(`exhaust${side(s)}`, ex, 2.04, 3.16);
  }
  b.box({ x: 0, y: 1.875, z: 1.75, w: 1.1, h: 0.03, d: 1.0, r: 0.01, mat: P });
  b.box({ x: 0, y: 0.8, z: 3.14, w: 0.9, h: 0.12, d: 0.1, r: 0.02, mat: 'steel' }); // jack

  // ---- Turret ----------------------------------------------------------------------------------
  const zT = -0.15,
    yR = 1.86;
  b.part('turret', [0, yR, zT]);
  const plan = mirrorHalf([
    [0, -0.98],
    [0.92, -0.98],
    [1.02, -0.86],
    [1.06, -0.5],
    [1.06, 0.2],
    [1.02, 0.6],
    [0.9, 0.95],
    [0.68, 1.22],
    [0.36, 1.38],
    [0, 1.42],
  ]);
  const L3 = (y, sc) => plan.map(([x, dz]) => [x * sc, y, zT + dz * sc]);
  b.convex({ points: [...L3(1.88, 1), ...L3(2.74, 1), ...L3(2.78, 0.985)], mat: P, crease: 0.35 });
  // Cast cupola (left rear), loader's hatch, smoke dischargers, stowage bin, pistol port.
  const cx = -0.48,
    cz = zT + 0.55;
  b.latheDir({
    profile: [
      [0, 0],
      [0.4, 0],
      [0.4, 0.05],
      [0.36, 0.08],
      [0.35, 0.19],
      [0.3, 0.22],
      [0, 0.22],
    ],
    at: [cx, 2.77, cz],
    dir: [0, 1, 0],
    mat: Cst,
    seg: 28,
  });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.box({ x: cx + Math.cos(a) * 0.355, y: 2.91, z: cz + Math.sin(a) * 0.355, w: 0.012, h: 0.04, d: 0.11, ry: -a + Math.PI / 2, r: 0.003, mat: 'dark' });
  }
  b.cylAxis({ axis: 'y', x: cx, y: 3.0, z: cz, len: 0.03, r: 0.3, mat: P, seg: 24 });
  b.latheDir({ profile: torusProfile(0.37, 0.012, 8), at: [cx, 3.0, cz], dir: [0, 1, 0], mat: 'steel', seg: 28 });
  b.latheDir({
    profile: [
      [0, 0.04],
      [0.26, 0.035],
      [0.28, 0.0],
      [0, 0.0],
    ],
    at: [0.48, 2.78, zT + 0.2],
    dir: [0, 1, 0],
    mat: P,
    seg: 24,
  });
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const x = s * (0.98 - k * 0.03),
        z = zT - 0.55 + k * 0.13;
      b.rod({ from: [x, 2.45, z], to: [x + s * 0.06, 2.62, z - 0.04], r: 0.045, mat: P });
    }
  }
  b.box({ x: 0, y: 2.3, z: zT + 1.5, w: 1.2, h: 0.5, d: 0.36, r: 0.02, mat: P }); // stowage bin
  b.cylAxis({ axis: 'x', x: -1.05, y: 2.25, z: zT + 0.5, len: 0.05, r: 0.08, mat: P, seg: 14 });
  b.cylAxis({ axis: 'x', x: 1.03, y: 2.3, z: zT + 0.75, len: 0.05, r: 0.24, mat: P, seg: 20 }); // escape hatch
  b.at('turret', 'commanderEye', cx, 3.22, cz);
  // MG 34 on the cupola ring.
  const mg = [cx + 0.25, 3.08, cz - 0.22];
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

  // ---- Gun: 8.8 cm KwK 36 L/56 ----------------------------------------------------------------
  const yG = 2.3,
    zG = zT - 0.78;
  b.part('gun', [0, yG, zG]);
  const mant = [];
  for (let i = 0; i <= 12; i++) {
    const a = -0.95 + (1.9 * i) / 12;
    for (const x of [-0.7, 0.7]) mant.push([x, yG + 0.42 * Math.sin(a), zG - 0.42 * Math.cos(a)]);
  }
  b.convex({ points: mant, mat: Cst, crease: 0.45 });
  const zF = zG - 0.42;
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.17, -0.02],
      [0.17, 0.06],
      [0.155, 0.12],
      [0.145, 0.4],
      [0, 0.4],
    ],
    at: [0, yG, zF],
    dir: [0, 0, -1],
    mat: Cst,
    seg: 22,
  });
  const zB = zF - 0.4;
  b.latheDir({
    profile: [
      [0, 0],
      [0.1, 0],
      [0.092, 0.2],
      [0.082, 1.6],
      [0.072, 3.1],
      [0.075, 3.12],
      [0, 3.12],
    ],
    at: [0, yG, zB],
    dir: [0, 0, -1],
    mat: P,
    seg: 18,
  });
  const zMB = zB - 3.12;
  b.latheDir({
    profile: [
      [0, -0.01],
      [0.09, -0.01],
      [0.13, 0.03],
      [0.13, 0.11],
      [0.1, 0.13],
      [0.1, 0.2],
      [0.13, 0.22],
      [0.13, 0.3],
      [0.1, 0.32],
      [0.1, 0.36],
      [0.13, 0.38],
      [0.13, 0.41],
      [0.06, 0.43],
      [0.05, 0.36],
      [0, 0.36],
    ],
    at: [0, yG, zMB],
    dir: [0, 0, -1],
    mat: P,
    seg: 20,
  });
  for (const s of [-1, 1]) for (const dz of [0.07, 0.26]) b.box({ x: s * 0.118, y: yG, z: zMB - dz, w: 0.04, h: 0.16, d: 0.1, r: 0.006, mat: 'dark' });
  b.cyl({ z0: zF + 0.03, z1: zF - 0.06, r0: 0.03, x: 0.32, y: yG + 0.04, mat: 'dark', seg: 10 }); // coax MG port
  b.cyl({ z0: zF - 0.02, z1: zF - 0.08, r0: 0.014, x: 0.32, y: yG + 0.04, mat: 'blued', seg: 8 });
  for (const dx of [-0.28, -0.4]) b.cyl({ z0: zF + 0.03, z1: zF - 0.012, r0: 0.022, x: dx, y: yG + 0.08, mat: 'dark', seg: 10 }); // TZF 9b binocular ports
  b.at('gun', 'muzzle', 0, yG, zMB - 0.43);
  b.at('gun', 'coaxMuzzle', 0.32, yG + 0.04, zF - 0.08);
  b.at('gun', 'gunnerEye', -0.34, yG + 0.08, zF - 0.012);
  b.body();
  b.meta.partParents = { gun: 'turret', pintleMg: 'turret' };

  // ---- Meta, armor, modules -----------------------------------------------------------------
  Object.assign(b.meta, {
    name: 'Tiger I Ausf. E',
    faction: 'de',
    type: 'tracked',
    crew: 5,
    gun: { name: '8.8 cm KwK 36 L/56', caliber: 88 },
    gunElevation: [-9, 10],
    turretTraverse: 6,
    groundClearance: 0.47,
    turretRing: { center: [0, yR, zT], radius: 0.9 },
    specs: { mass: 54000, maxSpeed: 38, power: 690, engine: 'Maybach HL 230 P45', fuel: 540 },
  });
  b.armorZY('nosePlate', 'body', 100, [-3.12, 0.7], [-2.89, 1.22], -1.0, 1.0, [0, 0, -1]);
  b.armorZY('lowerNose', 'body', 60, [-2.75, 0.47], [-3.12, 0.7], -1.0, 1.0, [0, -0.5, -1]);
  b.armorZY('glacis', 'body', 60, [-2.89, 1.22], [-2.42, 1.3], -1.0, 1.0, [0, 1, -0.2]);
  b.armorZY('superFront', 'body', 100, [fz(0.95), 0.95], [fz(1.86), 1.86], -1.79, 1.79, [0, 0, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorXY(`superSide${L}`, 'body', 80, [s * 1.79, 0.95], [s * 1.79, 1.86], fz(1.2), 3.08, [s, 0, 0]);
    b.armorXY(`lowerSide${L}`, 'body', 60, [s * 1.0, 0.47], [s * 1.0, 0.96], -2.75, 3.05, [s, 0, 0]);
    b.armorZY(`sponsonFloor${L}`, 'body', 25, [fz(0.95), 0.95], [3.12, 0.95], s * 1.0, s * 1.79, [0, -1, 0]);
  }
  b.armorZY('rear', 'body', 80, [3.12, 0.95], [3.04, 1.86], -1.79, 1.79, [0, 0, 1]);
  b.armorZY('rearLower', 'body', 60, [2.75, 0.47], [3.12, 0.96], -1.0, 1.0, [0, -0.3, 1]);
  b.armorZY('roof', 'body', 25, [fz(1.86), 1.86], [3.04, 1.86], -1.79, 1.79, [0, 1, 0]);
  b.armorZY('belly', 'body', 25, [-2.75, 0.47], [2.75, 0.47], -1.0, 1.0, [0, -1, 0]);
  b.armorShell('turret', 'turret', plan.map(([x, dz]) => [x, zT + dz]), [1.88, 1], [2.76, 1], [0, zT], (deg) => (deg < 30 ? 100 : 80));
  b.armorPoly('turretRoof', 'turret', 25, L3(2.78, 0.985), [0, 1, 0], 4, [0, 0, 1]);
  b.armor('cupola', 'turret', 110, [cx, 2.89, cz - 0.38], [0.76, 0, 0], [0, 0.24, 0], [0, 0, -1]);
  b.armor('mantlet', 'gun', 120, [0, yG, zF], [1.4, 0, 0], [0, 0.66, 0], [0, 0, -1]);
  b.armor('gunCollar', 'gun', 100, [0, yG, zB], [0.32, 0, 0], [0, 0.32, 0], [0, 0, -1]);
  b.module('engine', 'body', [0, 1.3, 2.2], [0.55, 0.45, 0.65]);
  b.module('transmission', 'body', [0, 0.85, -2.55], [0.65, 0.3, 0.35]);
  for (const s of [-1, 1]) {
    b.module('fuel', 'body', [s * 0.95, 1.35, 1.8], [0.3, 0.4, 0.65]);
    b.module('ammo', 'body', [s * 1.4, 1.35, -0.4], [0.33, 0.35, 1.0]);
  }
  b.module('ammo', 'body', [0, 0.68, -0.3], [0.6, 0.15, 0.4]);
  b.module('driver', 'body', [-0.55, 1.35, -1.95], [0.25, 0.45, 0.3]);
  b.module('radio', 'body', [0.55, 1.35, -1.95], [0.25, 0.45, 0.3]); // radio operator / bow gunner
  b.module('gunner', 'turret', [-0.42, 2.0, zT - 0.45], [0.22, 0.5, 0.28]);
  b.module('commander', 'turret', [cx, 2.3, cz], [0.22, 0.55, 0.28]);
  b.module('loader', 'turret', [0.45, 1.95, zT + 0.1], [0.22, 0.55, 0.28]);
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

// ---------------------------------------------------------------------------------------
// Opel Blitz 3.6-36S (3-ton 4x2 truck): long hood, steel cab with two doors (front-hinged
// parts), crowned front fenders with the headlamps, dual rear wheels, open cargo bed with
// drop sides and troop benches. 6.02 m long, 2.265 m wide, 2.18 m high (cab), 3.60 m
// wheelbase, 1.64 m front track, 7.50-20 tires (0.445 m radius). wheelRL/RR carry both
// tires of the dual pair. Seats: driver + cab passenger (seat1) + 12 on the benches.
export function opel_blitz(b) {
  const WB = 3.6,
    TRK = 1.64,
    R = 0.445,
    TW = 0.19;
  const zF = -WB / 2,
    zR = WB / 2,
    xw = TRK / 2;
  const P = 'germanGrey';
  // ---- Wheels -------------------------------------------------------------------------------
  const wheel = jeepWheel({ r: R, width: TW, rimR: 0.254, lugs: 22, lugH: 0.014, rimMat: P, splitBolts: 0, nuts: 8 });
  const dual = [...wheel.map((it) => ({ mat: it.mat, geo: it.geo.clone().translate(0.105, 0, 0) })), ...wheel.map((it) => ({ mat: it.mat, geo: it.geo.clone().rotateY(Math.PI).translate(-0.105, 0, 0) }))];
  for (const [name, x, z, items] of [
    ['wheelFL', -xw, zF, wheel],
    ['wheelFR', xw, zF, wheel],
    ['wheelRL', -0.8, zR, dual],
    ['wheelRR', 0.8, zR, dual],
  ]) {
    b.part(name, [x, R, z]).addAll(items, { x, y: R, z, ry: x < 0 ? Math.PI : 0 });
  }
  b.body();

  // ---- Chassis ----------------------------------------------------------------------------------
  for (const s of [-1, 1]) b.span({ z0: -2.72, z1: 3.22, y0: 0.7, y1: 0.88, w: 0.07, x: s * 0.45, mat: 'black', r: 0.01 });
  b.span({ z0: -2.82, z1: -2.72, y0: 0.6, y1: 0.75, w: 2.0, mat: 'black', r: 0.012 }); // bumper
  b.cylAxis({ axis: 'x', x: 0, y: R + 0.02, z: zF, len: TRK - 0.2, r: 0.05, mat: 'black' });
  b.cylAxis({ axis: 'x', x: 0, y: R, z: zR, len: 1.3, r: 0.065, mat: 'black' });
  b.sphere({ x: 0, y: R, z: zR, r: 0.18, sz: 1.1, mat: 'black' });
  for (const s of [-1, 1])
    for (const [z, L] of [
      [zF, 1.2],
      [zR, 1.4],
    ]) {
      const line = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        line.push([z - L / 2 + L * t, R + 0.16 + 0.08 * (2 * t - 1) ** 2]);
      }
      b.prismX({ points: ribbon(line, 0.06), x0: s * 0.45 - 0.035, x1: s * 0.45 + 0.035, mat: 'black', bevel: 0.005 });
    }
  b.rod({ from: [0, 0.75, -1.0], to: [0, R + 0.05, zR - 0.15], r: 0.04, mat: 'black' }); // drive shaft
  b.cyl({ z0: 0.05, z1: 0.75, r0: 0.2, x: 0.75, y: 0.86, mat: P }); // fuel tank
  b.cyl({ z0: -0.6, z1: 0.6, r0: 0.03, x: 0.6, y: 0.62, mat: 'black' });
  b.anchor('exhaustR', 0.6, 0.62, 0.62);
  b.box({ x: 0, y: 0.95, z: -1.95, w: 0.6, h: 0.5, d: 0.95, r: 0.05, mat: 'black' }); // engine

  // ---- Hood, grille, fenders, lamps -------------------------------------------------------
  b.convex({ points: [...section(-2.62, 0.4, 0.95, 1.5, 0.12, 0.02), ...section(-1.04, 0.43, 0.95, 1.58, 0.14, 0.02)], mat: P, crease: 0.5 });
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) b.box({ x: s * 0.428, y: 1.28, z: -1.95 + i * 0.09, w: 0.008, h: 0.18, d: 0.035, r: 0.002, mat: 'dark' }); // louvers
  const grilleO = [[-0.38, 0.92], [0.38, 0.92], [0.38, 1.4], ...arc(0, 1.4, 0.38, 0, Math.PI, 12).slice(1, -1), [-0.38, 1.4]];
  const bars = [];
  for (let i = -6; i <= 6; i++) bars.push(slotV(i * 0.05, 1.2, 0.015, 0.24));
  b.prismZ({ points: grilleO, holes: bars, z0: -2.68, z1: -2.63, mat: P, bevel: 0.006 });
  b.span({ z0: -2.63, z1: -2.55, y0: 0.95, y1: 1.6, w: 0.7, mat: 'dark' });
  for (const s of [-1, 1]) {
    const fl = [...arc(zF, 0.5, 0.6, Math.PI - 0.32, 0.6, 14), [-1.12, 0.9], [-0.04, 0.9]];
    b.prismX({ points: ribbon(fl, 0.022), x0: s * 0.58, x1: s * 1.05, mat: P, bevel: 0.008 });
    b.cylAxis({ axis: 'y', x: s * 0.72, y: 1.12, z: -2.3, len: 0.1, r: 0.02, mat: P, seg: 8 });
    b.cyl({ z0: -2.42, z1: -2.24, r0: 0.11, r1: 0.085, x: s * 0.72, y: 1.25, mat: P, seg: 18 });
    b.cyl({ z0: -2.428, z1: -2.418, r0: 0.098, x: s * 0.72, y: 1.25, mat: 'lamp', seg: 18 });
    b.anchor(`headlight${side(s)}`, s * 0.72, 1.25, -2.43);
  }

  // ---- Cab ----------------------------------------------------------------------------------
  b.convex({
    points: [
      ...section(-1.04, 0.95, 0.95, 1.58, 0.05, 0.02),
      ...section(-0.97, 0.96, 0.95, 2.06, 0.12, 0.02),
      ...section(-0.86, 0.96, 0.95, 2.17, 0.16, 0.02),
      ...section(-0.1, 0.96, 0.95, 2.18, 0.16, 0.02),
      ...section(-0.04, 0.95, 0.95, 2.15, 0.12, 0.02),
    ],
    mat: P,
    crease: 0.45,
  });
  const wsN = [0, Math.sin(9 * DEG), -Math.cos(9 * DEG)];
  for (const s of [-1, 1])
    b.quad({
      p: [
        [s * 0.05, 1.62, -1.02],
        [s * 0.86, 1.62, -1.02],
        [s * 0.86, 2.0, -0.96],
        [s * 0.05, 2.0, -0.96],
      ].map((p) => [p[0] + wsN[0] * 0.004, p[1] + wsN[1] * 0.004, p[2] + wsN[2] * 0.004]),
      t: 0.006,
      mat: 'glass',
    });
  b.span({ z0: -0.04, z1: -0.03, y0: 1.72, y1: 1.98, w: 0.9, mat: 'glass' }); // rear window
  // Doors (front-hinged) with windows.
  for (const s of [-1, 1]) {
    const name = `doorF${side(s)}`;
    b.part(name, [s * 0.975, 1.5, -0.92]);
    b.prismX({
      points: [
        [-0.92, 0.98],
        [-0.22, 0.98],
        [-0.22, 2.05],
        [-0.88, 2.05],
        [-0.92, 1.6],
      ],
      holes: [roundRect(-0.56, 1.82, 0.28, 0.17, 0.03)],
      x0: s * 0.955,
      x1: s * 0.975,
      mat: P,
      bevel: 0.005,
    });
    b.span({ z0: -0.84, z1: -0.28, y0: 1.65, y1: 1.99, w: 0.006, x: s * 0.963, mat: 'glass' });
    b.box({ x: s * 0.985, y: 1.5, z: -0.3, w: 0.02, h: 0.03, d: 0.1, r: 0.006, mat: 'steel' });
    b.meta.hinges[name] = { axis: [0, 1, 0], open: s * 1.2 };
  }
  b.body();
  for (const s of [-1, 1]) b.cylAxis({ axis: 'x', x: s * 1.05, y: 1.95, z: -0.98, len: 0.16, r: 0.012, mat: 'black', seg: 8 }); // mirror arms
  steeringWheel(b, { hub: [-0.45, 1.72, -0.78], col: [0, 0.8, 0.6], r: 0.23, spokes: [0, Math.PI, -Math.PI / 2], columnLen: 0.9 });
  b.box({ x: 0, y: 1.25, z: -0.32, w: 1.7, h: 0.1, d: 0.45, r: 0.03, mat: 'leather' }); // bench seat
  b.box({ x: 0, y: 1.55, z: -0.12, w: 1.7, h: 0.5, d: 0.08, r: 0.03, mat: 'leather' });

  // ---- Cargo bed: floor, headboard, drop sides, tailgate, benches, mudguards ------------------
  const bz0 = 0.02,
    bz1 = 3.24,
    bw = 1.1,
    fy = 1.17;
  b.span({ z0: bz0, z1: bz1, y0: 1.1, y1: fy, w: 2 * bw, mat: P, r: 0.008 });
  for (let i = 0; i < 6; i++) b.span({ z0: 0.2 + i * 0.6, z1: 0.28 + i * 0.6, y0: 0.88, y1: 1.1, w: 2.1, mat: 'black', r: 0.01 });
  const planks = (fn) => {
    for (let k = 0; k < 3; k++) fn(fy + 0.01 + k * 0.155, fy + 0.155 + k * 0.155);
  };
  planks((y0, y1) => b.span({ z0: bz0, z1: bz0 + 0.05, y0, y1: y1 + (y1 > 1.6 ? 0.25 : 0), w: 2 * bw, mat: P, r: 0.006 }));
  for (const s of [-1, 1]) planks((y0, y1) => b.span({ z0: bz0, z1: bz1, y0, y1, w: 0.04, x: s * (bw - 0.02), mat: P, r: 0.006 }));
  planks((y0, y1) => b.span({ z0: bz1 - 0.04, z1: bz1, y0, y1, w: 2 * bw, mat: P, r: 0.006 }));
  for (const s of [-1, 1]) {
    for (const z of [0.6, 1.6, 2.6]) b.span({ z0: z - 0.03, z1: z + 0.03, y0: fy, y1: fy + 0.47, w: 0.05, x: s * (bw + 0.005), mat: 'black', r: 0.006 }); // stakes
    b.span({ z0: 0.3, z1: 3.05, y0: fy + 0.38, y1: fy + 0.43, w: 0.32, x: s * 0.86, mat: 'wood', r: 0.01 }); // bench
    for (const z of [0.35, 1.7, 3.0]) b.span({ z0: z - 0.03, z1: z + 0.03, y0: fy, y1: fy + 0.38, w: 0.05, x: s * 0.86, mat: 'black' });
    b.span({ z0: zR - 0.6, z1: zR + 0.62, y0: 1.04, y1: 1.06, w: 0.5, x: s * 0.8, mat: 'black', r: 0.004 }); // rear mudguards
    b.box({ x: s * 0.95, y: 0.98, z: 3.2, w: 0.08, h: 0.06, d: 0.04, r: 0.008, mat: 'redLamp' });
  }

  // ---- Anchors, meta ---------------------------------------------------------------------------
  b.anchor('driverSeat', -0.45, 1.36, -0.34);
  b.anchor('driverEye', -0.45, 2.0, -0.42);
  b.anchor('seat1', 0.45, 1.36, -0.34);
  let n = 2;
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.anchor(`seat${n++}`, s * 0.86, fy + 0.5, 0.45 + i * 0.47);
  Object.assign(b.meta, {
    name: 'Opel Blitz 3.6-36S',
    faction: 'de',
    type: 'wheeled',
    crew: 1,
    seats: 14,
    wheelRadius: R,
    wheelWidth: TW,
    wheelbase: WB,
    trackWidth: TRK,
    rearTrackWidth: 1.6,
    dualRear: true,
    groundClearance: 0.26,
    maxSteer: 0.6,
    wheels: { wheelFL: [-xw, R, zF], wheelFR: [xw, R, zF], wheelRL: [-0.8, R, zR], wheelRR: [0.8, R, zR] },
    specs: { mass: 3290, payload: 3300, maxSpeed: 85, power: 75, fuel: 82, range: 410, drive: '4x2' },
  });
  b.armorZY('grille', 'body', 0, [-2.68, 0.92], [-2.68, 1.6], -0.4, 0.4, [0, 0, -1]);
  b.armorZY('hood', 'body', 0, [-2.62, 1.52], [-1.04, 1.58], -0.43, 0.43, [0, 1, 0]);
  b.armorZY('cabFront', 'body', 0, [-1.04, 0.95], [-0.96, 2.06], -0.96, 0.96, [0, 0, -1]);
  for (const s of [-1, 1]) b.armorXY(`cabSide${side(s)}`, 'body', 0, [s * 0.96, 0.95], [s * 0.96, 2.18], -1.04, -0.04, [s, 0, 0]);
  b.armorZY('cabRoof', 'body', 0, [-0.9, 2.18], [-0.04, 2.18], -0.96, 0.96, [0, 1, 0]);
  b.armorZY('cabRear', 'body', 0, [-0.04, 0.95], [-0.04, 2.15], -0.96, 0.96, [0, 0, 1]);
  for (const s of [-1, 1]) b.armorXY(`bedSide${side(s)}`, 'body', 0, [s * bw, fy], [s * bw, fy + 0.47], bz0, bz1, [s, 0, 0]);
  b.armorZY('bedFloor', 'body', 0, [bz0, 1.1], [bz1, 1.1], -bw, bw, [0, -1, 0]);
  b.armorZY('tailgate', 'body', 0, [bz1, fy], [bz1, fy + 0.47], -bw, bw, [0, 0, 1]);
  b.module('engine', 'body', [0, 1.05, -1.95], [0.32, 0.3, 0.5]);
  b.module('fuel', 'body', [0.75, 0.86, 0.4], [0.2, 0.2, 0.35]);
  b.module('driver', 'body', [-0.45, 1.7, -0.4], [0.24, 0.45, 0.28]);
}
