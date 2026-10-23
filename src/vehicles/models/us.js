// US vehicles. Conventions (vkit.js): meters, +X right, +Y up, -Z forward; origin on the
// ground at the middle of the wheelbase (wheeled) or of the track contact length (tracked).
import { S, DEG, ribbon, circle, roundRect, slotV, arc, torusProfile, layer, mirrorHalf } from './vkit.js';
import { jeepWheel, roadWheel, sprocket, runningGear, steeringWheel } from './parts.js';

const side = (s) => (s < 0 ? 'L' : 'R');

// ---------------------------------------------------------------------------------------
// Willys MB 1/4-ton 4x4 truck, 1941-45. 3.33 m long, 1.57 m wide, 1.32 m to the top of the
// windshield, 2.032 m wheelbase, 1.245 m track, 6.00-16 tires (0.357 m radius), 222 mm
// ground clearance. Flat grille with 9 slots, fold-down windshield, top folded at the rear,
// spare wheel (right) and jerrycan (left) on the rear panel. Driver on the left, 4 seats.
export function willys_mb(b) {
  const WB = 2.032,
    TRK = 1.245,
    R = 0.357,
    TW = 0.165;
  const zF = -WB / 2,
    zR = WB / 2,
    xw = TRK / 2;
  const P = 'od';

  // ---- Wheels (parts) -----------------------------------------------------------------
  const wheel = jeepWheel({ r: R, width: TW, rimR: 0.205, lugs: 18, rimMat: P });
  for (const [name, x, z] of [
    ['wheelFL', -xw, zF],
    ['wheelFR', xw, zF],
    ['wheelRL', -xw, zR],
    ['wheelRR', xw, zR],
  ]) {
    b.part(name, [x, R, z]).addAll(wheel, { x, y: R, z, ry: x < 0 ? Math.PI : 0 });
  }
  b.body();

  // ---- Chassis --------------------------------------------------------------------------
  for (const s of [-1, 1]) b.span({ z0: -1.62, z1: 1.41, y0: 0.42, y1: 0.53, w: 0.055, x: s * 0.37, mat: P, r: 0.008 });
  b.span({ z0: -1.685, z1: -1.61, y0: 0.4, y1: 0.535, w: 1.46, mat: P, r: 0.012 }); // front bumper
  for (const s of [-1, 1]) b.latheDir({ profile: torusProfile(0.028, 0.008, 8), at: [s * 0.3, 0.43, -1.69], dir: [1, 0, 0], mat: P, seg: 12 }); // lifting shackles
  // Axles with offset differentials, steering knuckles.
  for (const z of [zF, zR]) {
    b.cylAxis({ axis: 'x', x: 0, y: R, z, len: TRK - 0.14, r: 0.042, mat: P });
    b.sphere({ x: 0.13, y: R, z, r: 0.11, sx: 0.85, sy: 1, sz: 1.05, mat: P });
  }
  for (const s of [-1, 1]) b.sphere({ x: s * 0.49, y: R, z: zF, r: 0.075, mat: P });
  // Semi-elliptic leaf springs (eyes on the frame, center clamped on the axle).
  const spring = (z, L) => {
    const line = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      line.push([z - L / 2 + L * t, R + 0.082 + 0.065 * (2 * t - 1) ** 2]);
    }
    return ribbon(line, 0.034);
  };
  for (const s of [-1, 1])
    for (const [z, L] of [
      [zF, 0.92],
      [zR, 1.07],
    ])
      b.prismX({ points: spring(z, L), x0: s * 0.37 - 0.022, x1: s * 0.37 + 0.022, mat: 'black', bevel: 0.004 });
  // Gearbox + transfer case, drive shafts, engine block (seen under the fenders).
  b.box({ x: 0.05, y: 0.45, z: -0.3, w: 0.26, h: 0.2, d: 0.55, r: 0.03, mat: P });
  b.rod({ from: [0.1, 0.4, -0.05], to: [0.13, R, zR - 0.1], r: 0.026, mat: P });
  b.rod({ from: [0.1, 0.4, -0.55], to: [0.13, R, zF + 0.1], r: 0.026, mat: P });
  b.box({ x: 0, y: 0.63, z: -1.07, w: 0.46, h: 0.34, d: 0.7, r: 0.04, mat: 'black' });
  // Muffler and tail pipe (right side, exits behind the right rear wheel).
  b.cyl({ z0: 0.05, z1: 0.6, r0: 0.065, x: 0.47, y: 0.43, mat: 'black' });
  b.cyl({ z0: 0.6, z1: 1.42, r0: 0.022, x: 0.5, y: 0.4, mat: 'black' });
  b.anchor('exhaustR', 0.5, 0.4, 1.43);

  // ---- Body tub ---------------------------------------------------------------------------
  // Side walls: entrance cutout and rear wheel arch.
  const arch = arc(zR, 0.42, 0.4, Math.PI - 0.1253, 0.1253, 14);
  const sideOutline = [
    [-0.62, 0.47],
    ...arch,
    [1.43, 0.47],
    [1.43, 0.865],
    [1.405, 0.9],
    [0.53, 0.9],
    ...S(
      [
        [0.45, 0.88],
        [0.36, 0.8],
        [0.22, 0.735],
        [0.04, 0.715],
        [-0.12, 0.74],
        [-0.24, 0.82],
        [-0.33, 0.92],
      ],
      3,
      false,
    ),
    [-0.4, 0.968],
    [-0.46, 0.975],
    [-0.62, 0.975],
  ];
  for (const s of [-1, 1]) b.prismX({ points: sideOutline, x0: s * 0.69, x1: s * 0.72, mat: P, bevel: 0.006 });
  b.span({ z0: -0.62, z1: 1.43, y0: 0.47, y1: 0.5, w: 1.4, mat: P, r: 0.004 }); // floor
  b.span({ z0: 1.4, z1: 1.43, y0: 0.47, y1: 0.9, w: 1.44, mat: P, r: 0.01 }); // rear panel
  for (const s of [-1, 1]) b.box({ x: s * 0.6, y: 0.63, z: zR, w: 0.2, h: 0.32, d: 0.8, r: 0.06, mat: P }); // wheel houses
  b.box({ x: 0, y: 0.94, z: -0.52, w: 1.44, h: 0.07, d: 0.2, r: 0.02, mat: P }); // cowl
  b.span({ z0: -0.64, z1: -0.62, y0: 0.47, y1: 0.94, w: 1.3, mat: P }); // firewall
  b.span({ z0: -0.47, z1: -0.44, y0: 0.62, y1: 0.95, w: 1.34, mat: P }); // instrument panel
  for (const [x, r] of [
    [-0.12, 0.045],
    [0.02, 0.035],
    [0.13, 0.035],
  ])
    b.cyl({ z0: -0.44, z1: -0.432, r0: r, x, y: 0.83, mat: 'dark', seg: 16 });
  // Grab handles on the rear quarters.
  for (const s of [-1, 1]) b.rod({ from: [s * 0.735, 0.84, 0.95], to: [s * 0.735, 0.84, 1.22], r: 0.011, mat: P });

  // ---- Hood, grille, fenders, lamps -----------------------------------------------------
  b.box({ x: 0, y: 0.88, z: -1.09, w: 0.84, h: 0.17, d: 0.93, r: 0.03, mat: P }); // hood
  for (const s of [-1, 1]) for (const z of [-1.38, -0.86]) b.box({ x: s * 0.425, y: 0.875, z, w: 0.015, h: 0.05, d: 0.03, r: 0.004, mat: 'black' }); // hood clamps
  const grille = [
    [-0.42, 0.46],
    [0.42, 0.46],
    [0.42, 0.94],
    [0.395, 0.965],
    [-0.395, 0.965],
    [-0.42, 0.94],
  ];
  const holes = [];
  for (let i = -4; i <= 4; i++) holes.push(slotV(i * 0.048, 0.715, 0.016, 0.175));
  for (const s of [-1, 1]) holes.push(circle(0.088, 20, s * 0.325, 0.855));
  b.prismZ({ points: grille, holes, z0: -1.575, z1: -1.555, mat: P, bevel: 0.004 });
  b.span({ z0: -1.54, z1: -1.46, y0: 0.5, y1: 0.93, w: 0.62, mat: 'dark' }); // radiator behind the slots
  for (const s of [-1, 1]) {
    b.cyl({ z0: -1.592, z1: -1.5, r0: 0.084, r1: 0.075, x: s * 0.325, y: 0.855, mat: P, seg: 20 });
    b.cyl({ z0: -1.597, z1: -1.59, r0: 0.072, x: s * 0.325, y: 0.855, mat: 'lamp', seg: 20 });
    b.anchor(`headlight${side(s)}`, s * 0.325, 0.855, -1.6);
  }
  // Flat front fenders: flat top, front lip, ramp down to the body at the rear.
  const fenderLine = [
    [-1.578, 0.75],
    [-1.57, 0.8],
    [-0.74, 0.8],
    [-0.52, 0.575],
    [-0.5, 0.555],
  ];
  for (const s of [-1, 1]) {
    b.prismX({ points: ribbon(fenderLine, 0.016), x0: s * 0.42, x1: s * 0.785, mat: P, bevel: 0.005 });
    // Blackout marker lamps on the fenders.
    b.cylAxis({ axis: 'y', x: s * 0.62, y: 0.83, z: -1.49, len: 0.055, r: 0.03, mat: P, seg: 12 });
    b.cyl({ z0: -1.523, z1: -1.515, r0: 0.018, x: s * 0.62, y: 0.835, mat: 'lamp', seg: 12 });
    // Fender brace to the frame.
    b.rod({ from: [s * 0.7, 0.785, -0.95], to: [s * 0.4, 0.52, -0.95], r: 0.01, mat: P });
  }

  // ---- Windshield (folds forward onto the hood about its bottom hinge) ------------------
  const hz = -0.6,
    hy = 0.975;
  b.part('windshield', [0, hy, hz]);
  const bar = (x0, x1, y0, y1) => b.span({ z0: hz - 0.018, z1: hz + 0.018, y0, y1, w: x1 - x0, x: (x0 + x1) / 2, mat: P, r: 0.008 });
  bar(-0.665, 0.665, hy, hy + 0.04);
  bar(-0.665, 0.665, 1.3, 1.335);
  bar(-0.665, -0.625, hy, 1.335);
  bar(0.625, 0.665, hy, 1.335);
  bar(-0.016, 0.016, hy, 1.335);
  for (const s of [-1, 1]) b.span({ z0: hz - 0.003, z1: hz + 0.003, y0: hy + 0.04, y1: 1.3, w: 0.608, x: s * 0.32, mat: 'glass' });
  b.body();
  for (const s of [-1, 1]) b.box({ x: s * 0.69, y: 0.99, z: hz, w: 0.05, h: 0.05, d: 0.05, r: 0.008, mat: P }); // hinge brackets
  b.meta.hinges.windshield = { axis: [1, 0, 0], open: -1.5 }; // folded flat on the hood

  // ---- Steering ---------------------------------------------------------------------------
  const col = [0, 0.565, 0.825]; // column axis, pointing up/back toward the driver
  const hub = [-0.33, 1.03, -0.25];
  const along = (t) => [hub[0], hub[1] + col[1] * t, hub[2] + col[2] * t];
  b.rod({ from: along(-0.05), to: along(-0.9), r: 0.022, mat: 'black' });
  b.part('steeringWheel', hub);
  b.latheDir({ profile: torusProfile(0.204, 0.0125, 10), at: hub, dir: col, mat: 'black', seg: 36 });
  b.latheDir({
    profile: [
      [0, 0.025],
      [0.032, 0.02],
      [0.04, -0.02],
      [0, -0.03],
    ],
    at: hub,
    dir: col,
    mat: 'black',
    seg: 16,
  });
  const e2 = [0, col[2], -col[1]]; // "up" in the wheel plane
  for (const a of [0, Math.PI, -Math.PI / 2]) {
    const d = [Math.cos(a), Math.sin(a) * e2[1], Math.sin(a) * e2[2]];
    b.rod({ from: [hub[0] + d[0] * 0.03, hub[1] + d[1] * 0.03, hub[2] + d[2] * 0.03], to: [hub[0] + d[0] * 0.196 - col[0] * 0.015, hub[1] + d[1] * 0.196 - col[1] * 0.015, hub[2] + d[2] * 0.196 - col[2] * 0.015], r: 0.007, mat: 'steel' });
  }
  b.body();

  // ---- Seats --------------------------------------------------------------------------------
  const seat = (x, z, w) => {
    b.box({ x, y: 0.645, z, w, h: 0.09, d: 0.4, r: 0.035, mat: 'canvasOD' });
    b.box({ x, y: 0.93, z: z + 0.235, w, h: 0.4, d: 0.07, r: 0.03, rx: 0.12, mat: 'canvasOD' });
  };
  seat(-0.33, 0.22, 0.42);
  seat(0.33, 0.22, 0.42);
  b.box({ x: -0.33, y: 0.55, z: 0.22, w: 0.4, h: 0.1, d: 0.38, r: 0.02, mat: P }); // fuel tank under the driver's seat
  b.box({ x: 0.33, y: 0.55, z: 0.22, w: 0.36, h: 0.1, d: 0.34, r: 0.02, mat: P });
  b.box({ x: 0, y: 0.6, z: 1.0, w: 0.9, h: 0.12, d: 0.36, r: 0.01, mat: P }); // rear seat riser
  b.box({ x: 0, y: 0.7, z: 1.0, w: 0.92, h: 0.08, d: 0.4, r: 0.03, mat: 'canvasOD' });
  b.box({ x: 0, y: 0.95, z: 1.33, w: 0.92, h: 0.34, d: 0.06, r: 0.03, rx: 0.1, mat: 'canvasOD' });

  // ---- Folded top, spare wheel, jerrycan, rear fittings -----------------------------------
  b.box({ x: 0, y: 0.965, z: 1.3, w: 1.26, h: 0.13, d: 0.22, r: 0.06, mat: 'canvasOD' });
  for (const s of [-1, 1]) {
    b.rod({ from: [s * 0.735, 0.88, 0.62], to: [s * 0.735, 1.0, 1.33], r: 0.011, mat: P });
    b.rod({ from: [s * 0.735, 0.88, 0.62], to: [s * 0.735, 0.95, 1.38], r: 0.011, mat: P });
    b.box({ x: s * 0.73, y: 0.86, z: 0.62, w: 0.03, h: 0.06, d: 0.05, r: 0.006, mat: P });
  }
  b.rod({ from: [-0.735, 1.0, 1.33], to: [0.735, 1.0, 1.33], r: 0.011, mat: P });
  // Spare wheel on the right of the rear panel, outer face to the rear.
  const sx = 0.26,
    sy = 0.69,
    sz = 1.43 + 0.03 + TW / 2;
  b.addAll(wheel, { x: sx, y: sy, z: sz, ry: -Math.PI / 2 });
  b.box({ x: sx, y: sy, z: 1.445, w: 0.16, h: 0.16, d: 0.03, r: 0.01, mat: P });
  // Jerrycan in its holder on the left.
  const jx = -0.36,
    jy = 0.705,
    jz = 1.43 + 0.012 + 0.0825;
  b.box({ x: jx, y: jy, z: jz, w: 0.345, h: 0.465, d: 0.165, r: 0.018, mat: P });
  for (const s of [-1, 1]) b.box({ x: jx, y: jy - 0.01, z: jz + 0.083, w: 0.5, h: 0.026, d: 0.008, rz: s * 0.93, r: 0.003, mat: P });
  for (const dx of [-0.07, 0, 0.07]) b.box({ x: jx + dx, y: jy + 0.255, z: jz, w: 0.02, h: 0.045, d: 0.1, r: 0.006, mat: P });
  b.cylAxis({ axis: 'y', x: jx + 0.13, y: jy + 0.25, z: jz, len: 0.04, r: 0.025, mat: P });
  b.span({ z0: 1.43, z1: 1.61, y0: 0.455, y1: 0.47, w: 0.37, x: jx, mat: P });
  b.box({ x: jx, y: jy + 0.1, z: jz + 0.09, w: 0.37, h: 0.035, d: 0.012, r: 0.003, mat: 'canvasOD' });
  // Tail lamps, bumperettes, pintle hook.
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.645, y: 0.82, z: 1.44, w: 0.09, h: 0.08, d: 0.03, r: 0.008, mat: P });
    b.box({ x: s * 0.645, y: 0.82, z: 1.456, w: 0.06, h: 0.05, d: 0.006, r: 0.002, mat: 'redLamp' });
    b.span({ z0: 1.43, z1: 1.48, y0: 0.45, y1: 0.56, w: 0.08, x: s * 0.64, mat: P, r: 0.008 });
  }
  b.box({ x: 0, y: 0.5, z: 1.46, w: 0.08, h: 0.09, d: 0.08, r: 0.01, mat: 'black' });

  // ---- Pioneer tools on the left side ------------------------------------------------------
  b.box({ x: -0.735, y: 0.6, z: 0.02, w: 0.02, h: 0.02, d: 0.62, r: 0.008, mat: 'wood' }); // axe handle
  b.box({ x: -0.738, y: 0.6, z: -0.3, w: 0.025, h: 0.12, d: 0.06, r: 0.006, mat: 'steel' });
  b.box({ x: -0.735, y: 0.54, z: 0.25, w: 0.02, h: 0.02, d: 0.6, r: 0.008, mat: 'wood' }); // shovel
  b.box({ x: -0.738, y: 0.54, z: 0.6, w: 0.015, h: 0.16, d: 0.2, r: 0.01, mat: 'od' });

  // ---- Anchors -------------------------------------------------------------------------------
  b.anchor('driverSeat', -0.33, 0.77, 0.24);
  b.anchor('driverEye', -0.33, 1.45, 0.16);
  b.anchor('seat1', 0.33, 0.77, 0.24);
  b.anchor('seat2', -0.27, 0.82, 1.02);
  b.anchor('seat3', 0.27, 0.82, 1.02);
  b.meta.anchorParts.steeringHub = 'steeringWheel';
  b.anchor('steeringHub', hub[0], hub[1], hub[2]);

  // ---- Meta ------------------------------------------------------------------------------------
  Object.assign(b.meta, {
    name: 'Willys MB',
    faction: 'us',
    type: 'wheeled',
    crew: 1,
    seats: 4,
    wheelRadius: R,
    wheelWidth: TW,
    wheelbase: WB,
    trackWidth: TRK,
    groundClearance: 0.222,
    steeringAxis: col,
    maxSteer: 0.52,
    wheels: { wheelFL: [-xw, R, zF], wheelFR: [xw, R, zF], wheelRL: [-xw, R, zR], wheelRR: [xw, R, zR] },
    specs: { mass: 1113, maxSpeed: 105, power: 60, fuel: 57, range: 450, drive: '4x4' },
  });
  // Unarmored: thin sheet-metal boxes (mm 0).
  b.armorZY('front', 'body', 0, [-1.575, 0.46], [-1.575, 0.965], -0.42, 0.42, [0, 0, -1]);
  b.armorZY('hood', 'body', 0, [-1.555, 0.965], [-0.625, 0.965], -0.42, 0.42, [0, 1, 0]);
  for (const s of [-1, 1]) b.armorXY(`side${side(s)}`, 'body', 0, [s * 0.72, 0.47], [s * 0.72, 0.9], -0.62, 1.43, [s, 0, 0]);
  b.armorZY('rear', 'body', 0, [1.43, 0.47], [1.43, 0.9], -0.72, 0.72, [0, 0, 1]);
  b.armorZY('floor', 'body', 0, [-0.62, 0.47], [1.43, 0.47], -0.7, 0.7, [0, -1, 0]);
  b.armorZY('windshield', 'body', 0, [hz, hy], [hz, 1.335], -0.665, 0.665, [0, 0, -1]);
  b.module('engine', 'body', [0, 0.66, -1.06], [0.26, 0.2, 0.36]);
  b.module('fuel', 'body', [-0.33, 0.55, 0.22], [0.2, 0.05, 0.19]);
  b.module('driver', 'body', [-0.33, 1.0, 0.18], [0.22, 0.42, 0.25]);
}

// ---------------------------------------------------------------------------------------
// M4A1 Sherman (75 mm), mid production: cast upper hull, 75 mm M3 gun in the M34A1 mount,
// VVSS suspension (3 bogies a side, 2 road wheels each, trailing return rollers), front
// drive sprocket, rear idler, T48 rubber chevron tracks (16.56 in wide, 6 in pitch, 79
// links). 5.84 m long, 2.62 m wide, 2.74 m high; 30.3 t.
// Armor: glacis 51 mm at 55 deg, cast nose 51 mm, sides and rear 38 mm, roof 19 mm, engine
// deck 13 mm, belly 25/13 mm; turret front 76 mm, gun shield 89 mm, sides/rear 51 mm,
// roof 25 mm.
export function m4a1_sherman(b) {
  const C = 'odCast',
    P = 'od';
  // ---- Running gear -------------------------------------------------------------------------
  const T = 0.06,
    RW = 0.254,
    yW = RW + T,
    OX = 1.055;
  const bogies = [-1.555, 0, 1.555];
  const wheels = [];
  for (const zc of bogies) wheels.push([zc - 0.31, yW], [zc + 0.31, yW]);
  const rollers = bogies.map((zc) => [zc + 0.15, 0.82]);
  const SPR = { z: -2.45, y: 0.622 },
    IDL = { z: 2.5, y: 0.62 };
  runningGear(b, {
    wheels,
    wheel: roadWheel({ r: RW, width: 0.23, gap: 0.05, tire: 0.04, dish: 0.03, hubR: 0.07, hubLen: 0.04, mat: P, bolts: 6 }),
    wheelR: RW,
    rollers,
    roller: roadWheel({ r: 0.09, width: 0.12, tire: 0.022, dish: 0.012, hubR: 0.04, hubLen: 0.03, mat: P }),
    rollerR: 0.09,
    sprocket: { ...SPR, r: 0.318, teeth: 13, items: sprocket({ n: 13, r0: 0.287, r1: 0.36, ringGap: 0.33, t: 0.035, drumR: 0.24, hubR: 0.15, hubLen: 0.085, mat: P, bolts: 12, tooth: 0.46, tip: 0.2 }) },
    idler: { ...IDL, r: 0.27 + T / 2, items: roadWheel({ r: 0.27, width: 0.23, gap: 0.05, rubber: false, dish: 0.035, hubR: 0.08, hubLen: 0.05, mat: P, holes: 6 }) },
    track: { width: 0.421, pitch: 0.1524, thick: T, offsetX: OX, realLinks: 79 },
  });
  // VVSS bogies: bracket bolted to the hull, volute springs, wheel arms, roller arm.
  for (const s of [-1, 1]) {
    for (const zc of bogies) {
      const pts = [];
      for (const x of [0.79, 1.1])
        for (const [dz, y] of [
          [-0.25, 0.6],
          [0.25, 0.6],
          [0.21, 0.72],
          [0.08, 0.775],
          [-0.17, 0.765],
          [-0.24, 0.68],
        ])
          pts.push([s * x, y, zc + dz]);
      b.convex({ points: pts, mat: P, crease: 0.3 });
      b.span({ z0: zc - 0.045, z1: zc + 0.045, y0: 0.36, y1: 0.62, w: 0.22, x: s * 0.95, mat: P, r: 0.015 });
      for (const dz of [-0.075, 0.075]) b.cylAxis({ axis: 'y', x: s * 0.97, y: 0.5, z: zc + dz, len: 0.2, r: 0.058, mat: P, seg: 12 });
      for (const d of [-1, 1]) b.rod({ from: [s * 0.925, 0.45, zc + d * 0.1], to: [s * 0.925, yW, zc + d * 0.31], r: 0.035, mat: P });
      b.rod({ from: [s * 0.9, 0.74, zc + 0.12], to: [s * 0.95, 0.82, zc + 0.15], r: 0.04, mat: P });
      b.cylAxis({ axis: 'x', x: s * 0.94, y: 0.82, z: zc + 0.15, len: 0.12, r: 0.032, mat: P, seg: 10 });
      b.box({ x: s * 1.0, y: 0.785, z: zc - 0.1, w: 0.24, h: 0.03, d: 0.16, r: 0.008, mat: P }); // track skid
    }
    // Idler bracket and final drive housing.
    b.convex({
      points: [
        [s * 0.79, IDL.y - 0.15, IDL.z + 0.16],
        [s * 0.79, IDL.y + 0.23, IDL.z + 0.2],
        [s * 0.79, IDL.y, IDL.z - 0.2],
        [s * 0.93, IDL.y + 0.06, IDL.z],
        [s * 0.93, IDL.y - 0.06, IDL.z],
        [s * 0.93, IDL.y, IDL.z - 0.06],
      ],
      mat: P,
    });
    b.cylAxis({ axis: 'x', x: s * 0.84, y: SPR.y, z: SPR.z, len: 0.1, r: 0.21, mat: C, seg: 20 });
  }

  // ---- Hull ---------------------------------------------------------------------------------
  // Cast upper hull: glacis 55 deg from vertical, sides curving in toward the roof
  // (tumblehome), heavily rounded edges, sponsons over the tracks.
  const gY = (z) => 1.04 + (z + 2.76) * (0.86 / 1.24);
  const yb = 0.98;
  const shoulder = [
    [0, 0.55],
    [0.022, 0.34],
    [0.075, 0.17],
    [0.16, 0.065],
    [0.29, 0.015],
    [0.46, 0],
  ];
  const hsec = (z, hw, yTop) => {
    const f = Math.min(1, (yTop - yb) / 0.92);
    const pts = [];
    for (const s of [-1, 1]) {
      pts.push([s * (hw - 0.025), yb, z], [s * hw, yb + 0.03, z]);
      for (const [dx, dy] of shoulder) pts.push([s * (hw - dx * f), Math.max(yb + 0.03, yTop - dy * f), z]);
    }
    return pts;
  };
  b.convex({
    points: [
      ...hsec(-2.76, 1.0, 1.04),
      ...hsec(-2.66, 1.18, gY(-2.66)),
      ...hsec(-2.52, 1.27, gY(-2.52)),
      ...hsec(-2.34, 1.295, gY(-2.34)),
      ...hsec(-1.75, 1.295, gY(-1.75)),
      ...hsec(-1.62, 1.295, 1.818),
      ...hsec(-1.5, 1.295, 1.874),
      ...hsec(-1.38, 1.295, 1.897),
      ...hsec(-1.25, 1.295, 1.9),
      ...hsec(2.45, 1.295, 1.9),
      ...hsec(2.66, 1.285, 1.87),
      ...hsec(2.8, 1.26, 1.81),
      ...hsec(2.9, 1.2, 1.72),
    ],
    mat: C,
    crease: 0.5,
  });
  // Lower hull between the tracks, sloped lower rear plate.
  b.prismX({
    points: [
      [-2.3, 0.43],
      [2.55, 0.43],
      [2.76, 0.62],
      [2.8, 1.0],
      [-2.3, 1.0],
    ],
    x0: -0.8,
    x1: 0.8,
    mat: P,
    bevel: 0.015,
  });
  // One-piece cast nose (transmission and final drive cover).
  const nose = S(
    [
      [-2.28, 0.43],
      [-2.52, 0.47],
      [-2.7, 0.58],
      [-2.8, 0.72],
      [-2.845, 0.86],
      [-2.83, 0.98],
      [-2.77, 1.05],
      [-2.6, 1.075],
    ],
    3,
    false,
  );
  b.prismX({ points: [...nose, [-2.2, 1.075], [-2.2, 0.43]], x0: -0.88, x1: 0.88, mat: C, bevel: 0.07 });
  for (const s of [-1, 1]) {
    b.latheDir({ profile: torusProfile(0.05, 0.016, 8), at: [s * 0.55, 0.62, -2.79], dir: [1, 0, 0], mat: P, seg: 12 }); // tow clevis rings
    b.box({ x: s * 0.55, y: 0.66, z: -2.75, w: 0.1, h: 0.08, d: 0.1, r: 0.01, mat: C });
  }
  // Front fenders over the sprockets, headlamps with brush guards, siren.
  for (const s of [-1, 1]) {
    b.span({ z0: -2.86, z1: -2.36, y0: 0.99, y1: 1.0, w: 0.46, x: s * 1.065, mat: P, r: 0.004 });
    b.span({ z0: -2.87, z1: -2.85, y0: 0.94, y1: 1.0, w: 0.46, x: s * 1.065, mat: P, r: 0.004 });
    const hx = s * 0.9;
    b.box({ x: hx, y: 1.1, z: -2.64, w: 0.05, h: 0.08, d: 0.08, r: 0.01, mat: P });
    b.cyl({ z0: -2.76, z1: -2.66, r0: 0.075, r1: 0.07, x: hx, y: 1.17, mat: P, seg: 16 });
    b.cyl({ z0: -2.765, z1: -2.758, r0: 0.064, x: hx, y: 1.17, mat: 'lamp', seg: 16 });
    b.rod({ from: [hx - 0.11, 1.08, -2.62], to: [hx - 0.11, 1.27, -2.8], r: 0.011, mat: P });
    b.rod({ from: [hx + 0.11, 1.08, -2.62], to: [hx + 0.11, 1.27, -2.8], r: 0.011, mat: P });
    b.rod({ from: [hx - 0.11, 1.27, -2.8], to: [hx + 0.11, 1.27, -2.8], r: 0.011, mat: P });
    b.anchor(`headlight${side(s)}`, hx, 1.17, -2.77);
    b.latheDir({ profile: torusProfile(0.045, 0.014, 8), at: [s * 1.0, 1.12, -2.5], dir: [1, 0, 0], mat: P, seg: 12 }); // lifting ring
  }
  b.cyl({ z0: -2.68, z1: -2.5, r0: 0.07, x: -1.07, y: 1.07, mat: P, seg: 14 }); // siren on the left fender
  // Bow MG ball mount (right) on the glacis.
  {
    const bx = 0.42,
      by = 1.47,
      bz = -2.76 + (by - 1.04) / (0.86 / 1.24);
    b.sphere({ x: bx, y: by, z: bz - 0.02, r: 0.13, sz: 0.7, mat: C, seg: 18 });
    b.sphere({ x: bx, y: by, z: bz - 0.07, r: 0.075, mat: C, seg: 14 });
    b.cyl({ z0: bz - 0.1, z1: bz - 0.26, r0: 0.022, x: bx, y: by, mat: 'blued', seg: 10 });
    b.cyl({ z0: bz - 0.26, z1: bz - 0.3, r0: 0.012, x: bx, y: by, mat: 'blued', seg: 8 });
    b.anchor('bowMgMuzzle', bx, by, bz - 0.3);
  }
  // Driver's and assistant driver's hatches with periscopes, fixed periscopes, ventilator.
  for (const s of [-1, 1]) {
    const hx = s * 0.52;
    b.box({ x: hx, y: 1.915, z: -1.2, w: 0.52, h: 0.04, d: 0.46, r: 0.015, mat: C });
    b.box({ x: hx, y: 1.97, z: -1.16, w: 0.08, h: 0.08, d: 0.17, r: 0.01, mat: P });
    b.box({ x: hx, y: 1.99, z: -1.25, w: 0.07, h: 0.04, d: 0.01, r: 0.002, mat: 'dark' });
    b.box({ x: hx + s * 0.16, y: 1.93, z: -1.4, w: 0.07, h: 0.07, d: 0.14, r: 0.01, mat: P });
    b.rod({ from: [hx - 0.08, 1.92, -1.47], to: [hx + 0.08, 1.92, -1.47], r: 0.01, mat: P });
  }
  b.sphere({ x: 0, y: 1.9, z: -1.2, r: 0.1, sy: 0.6, mat: C, seg: 14 });
  b.anchor('driverEye', -0.52, 1.99, -1.3);
  // Engine deck: grille doors, fuel fillers, tools.
  b.box({ x: 0, y: 1.91, z: 1.75, w: 1.5, h: 0.03, d: 1.2, r: 0.01, mat: P });
  for (let i = 0; i < 9; i++) b.box({ x: 0, y: 1.93, z: 1.27 + i * 0.12, w: 1.36, h: 0.02, d: 0.035, r: 0.005, mat: 'black' });
  for (const s of [-1, 1]) {
    b.cylAxis({ axis: 'y', x: s * 0.95, y: 1.91, z: 0.75, len: 0.04, r: 0.07, mat: P, seg: 14 });
    b.latheDir({ profile: torusProfile(0.045, 0.014, 8), at: [s * 1.12, 1.92, 2.6], dir: [0, 0, 1], mat: P, seg: 12 });
  }
  b.box({ x: -1.12, y: 1.92, z: 1.2, w: 0.05, h: 0.04, d: 1.5, r: 0.01, mat: 'wood' }); // crowbar/handles
  b.box({ x: 1.12, y: 1.92, z: 1.3, w: 0.06, h: 0.03, d: 0.9, r: 0.01, mat: 'wood' });
  b.box({ x: 1.12, y: 1.93, z: 0.75, w: 0.2, h: 0.03, d: 0.22, r: 0.01, mat: P }); // shovel blade
  // Rear plate: engine doors, exhaust deflector, air cleaners, tow hooks.
  b.box({ x: 0, y: 1.38, z: 2.905, w: 1.5, h: 0.62, d: 0.03, r: 0.01, mat: P });
  b.convex({
    points: [
      [-0.95, 0.98, 2.84],
      [0.95, 0.98, 2.84],
      [-0.95, 1.2, 2.92],
      [0.95, 1.2, 2.92],
      [-0.95, 0.98, 3.02],
      [0.95, 0.98, 3.02],
    ],
    mat: P,
  });
  for (const s of [-1, 1]) {
    b.cylAxis({ axis: 'y', x: s * 1.02, y: 1.4, z: 2.96, len: 0.42, r: 0.09, mat: P, seg: 16 });
    b.box({ x: s * 0.6, y: 0.62, z: 2.83, w: 0.1, h: 0.1, d: 0.12, r: 0.02, mat: P });
    b.anchor(`exhaust${side(s)}`, s * 0.5, 1.0, 3.0);
  }

  // ---- Turret -------------------------------------------------------------------------------
  const zT = -0.15,
    yR = 1.9;
  b.part('turret', [0, yR, zT]);
  const plan = mirrorHalf([
    [0, -0.84],
    [0.48, -0.84],
    [0.66, -0.78],
    [0.8, -0.64],
    [0.9, -0.44],
    [0.955, -0.2],
    [0.965, 0.1],
    [0.94, 0.4],
    [0.86, 0.68],
    [0.74, 0.9],
    [0.56, 1.06],
    [0.3, 1.15],
    [0, 1.18],
  ]).map(([x, dz]) => [x, zT + dz]);
  b.convex({
    points: [...layer(plan, 1.92, 0.985, 0, zT), ...layer(plan, 2.06, 1.0, 0, zT), ...layer(plan, 2.36, 0.99, 0, zT), ...layer(plan, 2.47, 0.955, 0, zT), ...layer(plan, 2.54, 0.89, 0, zT), ...layer(plan, 2.575, 0.79, 0, zT)],
    mat: C,
    crease: 0.55,
  });
  // Commander's split hatch (right rear), periscopes, ventilator, pistol port, lifting rings.
  const ch = [0.36, zT + 0.3];
  b.cylAxis({ axis: 'y', x: ch[0], y: 2.57, z: ch[1], len: 0.04, r: 0.3, mat: C, seg: 24 });
  b.prismY({ points: [...circle(0.28, 24, ch[0], ch[1]).filter(([x]) => x >= ch[0] - 1e-6), [ch[0] + 0.005, ch[1] - 0.28]], y0: 2.59, y1: 2.62, mat: P, bevel: 0.006 });
  b.prismY({ points: [...circle(0.28, 24, ch[0], ch[1]).filter(([x]) => x <= ch[0] + 1e-6), [ch[0] - 0.005, ch[1] + 0.28]], y0: 2.59, y1: 2.62, mat: P, bevel: 0.006 });
  b.box({ x: ch[0] + 0.14, y: 2.66, z: ch[1] - 0.05, w: 0.09, h: 0.08, d: 0.16, r: 0.01, mat: P });
  b.box({ x: 0.33, y: 2.6, z: zT - 0.48, w: 0.1, h: 0.1, d: 0.18, r: 0.01, mat: P }); // gunner's periscope
  b.box({ x: 0.33, y: 2.62, z: zT - 0.575, w: 0.08, h: 0.05, d: 0.01, r: 0.002, mat: 'dark' });
  b.box({ x: -0.38, y: 2.6, z: zT - 0.3, w: 0.1, h: 0.1, d: 0.18, r: 0.01, mat: P }); // loader's periscope
  b.sphere({ x: 0.05, y: 2.56, z: zT - 0.3, r: 0.09, sy: 0.55, mat: C, seg: 12 }); // ventilator
  b.cylAxis({ axis: 'x', x: -0.93, y: 2.17, z: zT + 0.3, len: 0.06, r: 0.08, mat: C, seg: 16 }); // pistol port
  for (const s of [-1, 1]) b.latheDir({ profile: torusProfile(0.045, 0.014, 8), at: [s * 0.82, 2.48, zT + 0.15], dir: [0, 0, 1], mat: P, seg: 12 });
  b.cylAxis({ axis: 'y', x: -0.42, y: 2.56, z: zT + 0.85, len: 0.08, r: 0.04, mat: P, seg: 10 }); // antenna base
  b.anchor('commanderEye', ch[0], 2.8, ch[1]);
  b.meta.anchorParts.commanderEye = 'turret';
  // Pintle for the .50 cal.
  const mg = [0.3, 2.84, zT + 0.66];
  b.cylAxis({ axis: 'y', x: mg[0], y: 2.68, z: mg[2], len: 0.24, r: 0.03, mat: P, seg: 10 });
  // .50 cal M2HB on its cradle (separate part: traverse about Y, elevate about X).
  b.part('pintleMg', mg);
  b.box({ x: mg[0], y: mg[1] + 0.06, z: mg[2] + 0.05, w: 0.14, h: 0.17, d: 0.6, r: 0.012, mat: 'blued' });
  b.cyl({ z0: mg[2] - 0.25, z1: mg[2] - 0.47, r0: 0.032, x: mg[0], y: mg[1] + 0.07, mat: 'blued', seg: 12 });
  b.cyl({ z0: mg[2] - 0.47, z1: mg[2] - 1.13, r0: 0.022, x: mg[0], y: mg[1] + 0.07, mat: 'blued', seg: 12 });
  b.cyl({ z0: mg[2] - 1.13, z1: mg[2] - 1.17, r0: 0.026, x: mg[0], y: mg[1] + 0.07, mat: 'blued', seg: 12 });
  b.box({ x: mg[0] - 0.15, y: mg[1] + 0.03, z: mg[2] - 0.02, w: 0.11, h: 0.17, d: 0.28, r: 0.008, mat: P }); // ammo can
  b.rod({ from: [mg[0] - 0.05, mg[1] + 0.06, mg[2] + 0.35], to: [mg[0] - 0.05, mg[1] - 0.02, mg[2] + 0.4], r: 0.014, mat: 'black' }); // spade grips
  b.rod({ from: [mg[0] + 0.05, mg[1] + 0.06, mg[2] + 0.35], to: [mg[0] + 0.05, mg[1] - 0.02, mg[2] + 0.4], r: 0.014, mat: 'black' });
  b.box({ x: mg[0], y: mg[1] - 0.02, z: mg[2], w: 0.08, h: 0.06, d: 0.12, r: 0.01, mat: P }); // cradle
  b.at('pintleMg', 'mgMount', mg[0], mg[1], mg[2]);
  b.at('pintleMg', 'mgMuzzle', mg[0], mg[1] + 0.07, mg[2] - 1.17);
  b.body();

  // ---- Gun: 75 mm M3 in the M34A1 mount (rotor + gun shield + coax + telescope) ------
  const yG = 2.22,
    zG = zT - 0.7;
  b.part('gun', [0, yG, zG]);
  const rotor = [];
  for (let i = 0; i <= 10; i++) {
    const a = -0.95 + (1.9 * i) / 10;
    for (const x of [-0.42, 0.42]) rotor.push([x, yG + 0.3 * Math.sin(a), zG - 0.3 * Math.cos(a)]);
  }
  b.convex({ points: rotor, mat: C, crease: 0.45 });
  const zS = zG - 0.39; // gun shield front face
  b.box({ x: 0.08, y: yG, z: zS + 0.045, w: 0.74, h: 0.46, d: 0.09, r: 0.035, mat: C });
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.085, -0.02],
      [0.085, 0.07],
      [0.066, 0.1],
      [0.061, 0.5],
      [0.055, 1.66],
      [0.059, 1.68],
      [0.059, 1.76],
      [0.04, 1.76],
      [0.04, 1.71],
      [0, 1.71],
    ],
    at: [0, yG, zS],
    dir: [0, 0, -1],
    mat: P,
    seg: 20,
  });
  b.cyl({ z0: zS - 1.712, z1: zS - 1.716, r0: 0.039, y: yG, mat: 'dark', seg: 16 });
  b.cyl({ z0: zS, z1: zS - 0.12, r0: 0.013, x: 0.19, y: yG - 0.01, mat: 'blued', seg: 10 }); // coax .30 cal
  b.cyl({ z0: zS + 0.01, z1: zS - 0.004, r0: 0.026, x: 0.36, y: yG + 0.07, mat: 'dark', seg: 12 }); // telescope port
  b.at('gun', 'muzzle', 0, yG, zS - 1.76);
  b.at('gun', 'coaxMuzzle', 0.19, yG - 0.01, zS - 0.12);
  b.at('gun', 'gunnerEye', 0.36, yG + 0.07, zS - 0.004);
  b.body();
  b.meta.partParents = { gun: 'turret', pintleMg: 'turret' };

  // ---- Meta, armor, modules -----------------------------------------------------------------
  Object.assign(b.meta, {
    name: 'M4A1 Sherman',
    faction: 'us',
    type: 'tracked',
    crew: 5,
    gun: { name: '75 mm M3', caliber: 75 },
    gunElevation: [-10, 25],
    turretTraverse: 24, // deg/s (hydraulic)
    groundClearance: 0.43,
    turretRing: { center: [0, yR, zT], radius: 0.875 },
    specs: { mass: 30300, maxSpeed: 39, power: 400, engine: 'Continental R975-C1', fuel: 662 },
  });
  // Hull.
  b.armorZY('glacis', 'body', 51, [-2.76, 1.04], [-1.62, gY(-1.62)], -1.2, 1.2, [0, 0.5, -1]);
  b.armorZY('noseUpper', 'body', 51, [-2.845, 0.86], [-2.77, 1.05], -0.86, 0.86, [0, 0, -1]);
  b.armorZY('noseLower', 'body', 51, [-2.52, 0.47], [-2.845, 0.86], -0.86, 0.86, [0, -0.5, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorPoly(`sideUpper${L}`, 'body', 38, [
      [s * 1.295, 1.0, -2.4],
      [s * 1.295, 1.0, 2.86],
      [s * 1.295, 1.86, 2.72],
      [s * 1.295, 1.86, -1.55],
      [s * 1.295, gY(-2.4), -2.4],
    ], [s, 0, 0], 5, [0, 0, 1]);
    b.armorXY(`sideLower${L}`, 'body', 38, [s * 0.8, 0.45], [s * 0.8, 0.99], -2.25, 2.7, [s, 0, 0]);
    b.armorZY(`sponsonFloor${L}`, 'body', 13, [-2.4, yb], [2.88, yb], s * 0.8, s * 1.295, [0, -1, 0]);
  }
  b.armorZY('roof', 'body', 19, [-1.62, 1.9], [0.7, 1.9], -1.25, 1.25, [0, 1, 0]);
  b.armorZY('engineDeck', 'body', 13, [0.7, 1.9], [2.6, 1.9], -1.25, 1.25, [0, 1, 0]);
  b.armorZY('rearUpper', 'body', 38, [2.9, 0.98], [2.84, 1.8], -1.15, 1.15, [0, 0, 1]);
  b.armorZY('rearLower', 'body', 38, [2.55, 0.43], [2.8, 1.0], -0.8, 0.8, [0, -0.3, 1]);
  b.armorZY('bellyFront', 'body', 25, [-2.3, 0.43], [0.0, 0.43], -0.8, 0.8, [0, -1, 0]);
  b.armorZY('bellyRear', 'body', 13, [0.0, 0.43], [2.55, 0.43], -0.8, 0.8, [0, -1, 0]);
  // Turret (vehicle space at rest).
  const tz = (dz) => zT + dz;
  b.armorXZ('turretFront', 'turret', 76, [0.48, tz(-0.84)], [-0.48, tz(-0.84)], 1.95, 2.46, [0, 0, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorXZ(`turretCheek${L}`, 'turret', 76, [s * 0.48, tz(-0.84)], [s * 0.9, tz(-0.44)], 1.94, 2.44, [s, 0, -1]);
    b.armorXZ(`turretSide${L}`, 'turret', 51, [s * 0.9, tz(-0.44)], [s * 0.965, tz(0.4)], 1.93, 2.42, [s, 0, 0]);
    b.armorXZ(`turretRearQuarter${L}`, 'turret', 51, [s * 0.94, tz(0.4)], [s * 0.56, tz(1.06)], 1.93, 2.4, [s, 0, 1]);
  }
  b.armorXZ('turretRear', 'turret', 51, [-0.56, tz(1.12)], [0.56, tz(1.12)], 1.93, 2.38, [0, 0, 1]);
  b.armorZY('turretRoof', 'turret', 25, [tz(-0.62), 2.565], [tz(0.86), 2.565], -0.68, 0.68, [0, 1, 0]);
  b.armor('mantlet', 'gun', 89, [0.08, yG, zS], [0.74, 0, 0], [0, 0.46, 0], [0, 0, -1]);
  b.armor('rotor', 'gun', 76, [0, yG, zG - 0.3], [0.84, 0, 0], [0, 0.5, 0], [0, 0, -1]);
  // Internal modules.
  b.module('engine', 'body', [0, 1.3, 1.85], [0.62, 0.52, 0.62]);
  b.module('transmission', 'body', [0, 0.78, -2.35], [0.62, 0.3, 0.35]);
  for (const s of [-1, 1]) {
    b.module('fuel', 'body', [s * 0.98, 1.42, 1.75], [0.22, 0.38, 0.55]);
    b.module('ammo', 'body', [s * 0.98, 1.42, -0.2], [0.22, 0.28, 0.45]);
  }
  b.module('ammo', 'body', [0, 0.62, 0.3], [0.4, 0.14, 0.35]);
  b.module('driver', 'body', [-0.52, 1.3, -1.45], [0.25, 0.48, 0.3]);
  b.module('radio', 'body', [0.52, 1.3, -1.45], [0.25, 0.48, 0.3]); // assistant driver / bow gunner
  b.module('gunner', 'turret', [0.34, 1.95, tz(-0.45)], [0.22, 0.45, 0.25]);
  b.module('commander', 'turret', [0.38, 2.1, tz(0.3)], [0.22, 0.48, 0.25]);
  b.module('loader', 'turret', [-0.42, 1.85, tz(0.0)], [0.22, 0.52, 0.26]);
}

// ---------------------------------------------------------------------------------------
// M5A1 Stuart light tank (1943): welded hull with the 48 deg glacis carrying both driver
// hatches, twin Cadillac engines at the rear, 37 mm M6 in the M44 mount with coax .30 cal,
// .30 cal AA gun on the turret's right side, bow .30 cal. VVSS: 2 bogies a side (2 road
// wheels each), 3 return rollers, front drive sprocket (14 teeth), large trailing idler on
// the ground at the rear, T16 rubber block track (11.6 in wide, 5.5 in pitch, 66 links).
// 4.84 m long, 2.29 m wide, 2.30 m high; 15.4 t.
// Armor: glacis 29 mm at 48 deg, lower front 44 mm, sides 29 mm, rear 25 mm, top and belly
// 13 mm; turret front 38 mm, mantlet 51 mm, sides and rear 32 mm, roof 13 mm.
export function m5a1_stuart(b) {
  const P = 'od';
  // ---- Running gear -------------------------------------------------------------------------
  const T = 0.05,
    RW = 0.255,
    yW = RW + T,
    OX = 0.933;
  const bogies = [-1.12, 0.28];
  const wheels = [];
  for (const zc of bogies) wheels.push([zc - 0.27, yW], [zc + 0.27, yW]);
  const rollers = [
    [-1.12, 0.74],
    [-0.42, 0.75],
    [0.28, 0.74],
  ];
  const SPR = { z: -2.1, y: 0.56 },
    IDL = { z: 1.48, r: 0.3 };
  IDL.y = IDL.r + T; // trailing idler runs on the ground
  runningGear(b, {
    wheels,
    wheel: roadWheel({ r: RW, width: 0.17, gap: 0.04, tire: 0.04, dish: 0.025, hubR: 0.065, hubLen: 0.035, mat: P, bolts: 6 }),
    wheelR: RW,
    rollers,
    roller: roadWheel({ r: 0.07, width: 0.1, tire: 0.018, dish: 0.01, hubR: 0.03, hubLen: 0.025, mat: P, seg: 16 }),
    rollerR: 0.07,
    sprocket: { ...SPR, r: 0.314, teeth: 14, items: sprocket({ n: 14, r0: 0.285, r1: 0.345, ringGap: 0.2, t: 0.03, drumR: 0.22, hubR: 0.12, hubLen: 0.07, mat: P, bolts: 8, tooth: 0.46, tip: 0.2 }) },
    idler: { z: IDL.z, y: IDL.y, r: IDL.r + T / 2, items: roadWheel({ r: IDL.r, width: 0.17, gap: 0.04, rubber: false, dish: 0.03, hubR: 0.075, hubLen: 0.04, mat: P, holes: 6 }) },
    track: { width: 0.295, pitch: 0.1397, thick: T, offsetX: OX, realLinks: 66 },
  });
  // The trailing idler runs on the ground: the contact length reaches its center.
  b.meta.wheelbase = Math.round((IDL.z - wheels[0][0]) * 1000) / 1000;
  for (const s of [-1, 1]) {
    for (const zc of bogies) {
      const pts = [];
      for (const x of [0.66, 0.92])
        for (const [dz, y] of [
          [-0.2, 0.52],
          [0.2, 0.52],
          [0.16, 0.66],
          [-0.16, 0.68],
        ])
          pts.push([s * x, y, zc + dz]);
      b.convex({ points: pts, mat: P, crease: 0.3 });
      b.span({ z0: zc - 0.04, z1: zc + 0.04, y0: 0.32, y1: 0.55, w: 0.16, x: s * 0.82, mat: P, r: 0.012 });
      for (const d of [-1, 1]) b.rod({ from: [s * 0.8, 0.4, zc + d * 0.08], to: [s * 0.8, yW, zc + d * 0.27], r: 0.03, mat: P });
    }
    for (const [z, y] of rollers) b.cylAxis({ axis: 'x', x: s * 0.78, y, z, len: 0.16, r: 0.025, mat: P, seg: 8 });
    b.rod({ from: [s * 0.7, 0.7, 1.1], to: [s * 0.82, IDL.y, IDL.z], r: 0.05, mat: P }); // idler arm
    b.cylAxis({ axis: 'x', x: s * 0.74, y: SPR.y, z: SPR.z, len: 0.1, r: 0.17, mat: P, seg: 18 });
  }

  // ---- Hull ---------------------------------------------------------------------------------
  const gl = (y) => -2.26 + (y - 0.92) * Math.tan(48 * DEG); // glacis surface z at height y
  b.prismX({
    points: [
      [-1.86, 0.38],
      [1.9, 0.38],
      [2.12, 0.55],
      [2.12, 0.93],
      [-2.26, 0.93],
      [-2.3, 0.72],
      [-2.12, 0.46],
    ],
    x0: -0.7,
    x1: 0.7,
    mat: P,
    bevel: 0.015,
  });
  // Upper hull over the tracks, sides leaning in (tumblehome) up to the roof.
  b.convex({
    points: [-1, 1].flatMap((s) => [
      [s * 1.12, 0.92, -2.26],
      [s * 1.12, 0.92, 2.12],
      [s * 0.99, 1.58, 2.14],
      [s * 0.98, 1.62, 2.08],
      [s * 0.98, 1.62, gl(1.62)],
    ]),
    mat: P,
  });
  // Driver and assistant driver hatches with periscopes on the glacis, bow MG (right),
  // headlights with brush guards, lifting eyes.
  const gn = [0, Math.sin(42 * DEG), -Math.cos(42 * DEG)];
  for (const s of [-1, 1]) {
    const x = s * 0.48,
      y0 = 1.36,
      y1 = 1.6;
    b.quad({
      p: [
        [x - 0.24, y0, gl(y0)],
        [x + 0.24, y0, gl(y0)],
        [x + 0.24, y1, gl(y1)],
        [x - 0.24, y1, gl(y1)],
      ].map((p) => [p[0] + gn[0] * 0.03, p[1] + gn[1] * 0.03, p[2] + gn[2] * 0.03]),
      t: 0.03,
      mat: P,
      out: gn,
    });
    b.box({ x, y: 1.66, z: gl(1.62) + 0.12, w: 0.08, h: 0.08, d: 0.16, r: 0.01, mat: P });
    b.box({ x, y: 1.68, z: gl(1.62) + 0.035, w: 0.06, h: 0.04, d: 0.005, r: 0.002, mat: 'dark' });
    const hx = s * 0.95;
    b.cyl({ z0: gl(1.1) - 0.13, z1: gl(1.1) - 0.03, r0: 0.07, r1: 0.065, x: hx, y: 1.12, mat: P, seg: 14 });
    b.cyl({ z0: gl(1.1) - 0.136, z1: gl(1.1) - 0.128, r0: 0.06, x: hx, y: 1.12, mat: 'lamp', seg: 14 });
    b.anchor(`headlight${side(s)}`, hx, 1.12, gl(1.1) - 0.14);
    b.rod({ from: [hx - 0.09, 1.0, gl(1.0) - 0.02], to: [hx - 0.09, 1.24, gl(1.24) - 0.18], r: 0.009, mat: P });
    b.rod({ from: [hx + 0.09, 1.0, gl(1.0) - 0.02], to: [hx + 0.09, 1.24, gl(1.24) - 0.18], r: 0.009, mat: P });
    b.latheDir({ profile: torusProfile(0.04, 0.012, 6), at: [s * 0.62, 0.8, -2.28], dir: [1, 0, 0], mat: P, seg: 10 });
    // Sand shields along the sponsons.
    b.span({ z0: -1.9, z1: 2.05, y0: 0.84, y1: 0.93, w: 0.01, x: s * 1.125, mat: P, r: 0.003 });
  }
  b.anchor('driverEye', -0.48, 1.68, gl(1.62) + 0.03);
  {
    const bx = 0.3,
      by = 1.2;
    b.sphere({ x: bx, y: by, z: gl(by), r: 0.1, sz: 0.6, mat: P, seg: 14 });
    b.cyl({ z0: gl(by) - 0.05, z1: gl(by) - 0.22, r0: 0.02, x: bx, y: by, mat: 'blued', seg: 10 });
    b.anchor('bowMgMuzzle', bx, by, gl(by) - 0.22);
  }
  // Engine deck with grilles, rear plate with the exhaust deflector, stowage box.
  b.box({ x: 0, y: 1.63, z: 1.4, w: 1.5, h: 0.03, d: 1.2, r: 0.01, mat: 'black' });
  for (let i = 0; i < 7; i++) b.box({ x: 0, y: 1.65, z: 0.9 + i * 0.17, w: 1.5, h: 0.015, d: 0.04, r: 0.004, mat: P });
  b.convex({
    points: [
      [-0.8, 0.95, 2.1],
      [0.8, 0.95, 2.1],
      [-0.8, 1.2, 2.16],
      [0.8, 1.2, 2.16],
      [-0.8, 0.95, 2.26],
      [0.8, 0.95, 2.26],
    ],
    mat: P,
  });
  b.box({ x: 0, y: 1.42, z: 2.24, w: 1.4, h: 0.3, d: 0.22, r: 0.02, mat: P }); // stowage box
  for (const s of [-1, 1]) b.anchor(`exhaust${side(s)}`, s * 0.45, 0.98, 2.25);

  // ---- Turret ---------------------------------------------------------------------------------
  const zT = -0.32,
    yR = 1.62;
  b.part('turret', [0, yR, zT]);
  const plan = mirrorHalf([
    [0, -0.66],
    [0.5, -0.66],
    [0.68, -0.48],
    [0.72, -0.1],
    [0.72, 0.4],
    [0.6, 0.86],
    [0.45, 1.0],
    [0, 1.02],
  ]);
  const L3 = (y, sc) => plan.map(([x, dz]) => [x * sc, y, zT + dz * sc]);
  b.convex({ points: [...L3(1.64, 1), ...L3(2.14, 0.9), ...L3(2.2, 0.86)], mat: P, crease: 0.3 });
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.28, y: 2.21, z: zT + 0.2, w: 0.42, h: 0.03, d: 0.5, r: 0.01, mat: P }); // split hatches
    b.box({ x: s * 0.28, y: 2.27, z: zT - 0.14, w: 0.08, h: 0.08, d: 0.15, r: 0.01, mat: P });
  }
  b.at('turret', 'commanderEye', -0.28, 2.45, zT + 0.2);
  // AA .30 cal on its bracket on the turret's right side.
  b.box({ x: 0.74, y: 1.95, z: zT + 0.35, w: 0.08, h: 0.18, d: 0.12, r: 0.01, mat: P });
  const mg = [0.82, 2.24, zT + 0.35];
  b.cylAxis({ axis: 'y', x: mg[0], y: 2.08, z: mg[2], len: 0.3, r: 0.022, mat: P, seg: 8 });
  b.part('pintleMg', mg);
  b.box({ x: mg[0], y: mg[1] + 0.05, z: mg[2] + 0.05, w: 0.07, h: 0.1, d: 0.4, r: 0.008, mat: 'blued' });
  b.cyl({ z0: mg[2] - 0.15, z1: mg[2] - 0.45, r0: 0.024, x: mg[0], y: mg[1] + 0.05, mat: 'blued', seg: 10 });
  b.cyl({ z0: mg[2] - 0.45, z1: mg[2] - 0.6, r0: 0.01, x: mg[0], y: mg[1] + 0.05, mat: 'blued', seg: 8 });
  b.box({ x: mg[0] - 0.07, y: mg[1] + 0.02, z: mg[2], w: 0.08, h: 0.12, d: 0.2, r: 0.008, mat: P });
  b.at('pintleMg', 'mgMount', mg[0], mg[1], mg[2]);
  b.at('pintleMg', 'mgMuzzle', mg[0], mg[1] + 0.05, mg[2] - 0.6);
  b.body();

  // ---- Gun: 37 mm M6 in the M44 mount -------------------------------------------------------
  const yG = 1.9,
    zG = zT - 0.5;
  b.part('gun', [0, yG, zG]);
  const rot = [];
  for (let i = 0; i <= 8; i++) {
    const a = -0.9 + (1.8 * i) / 8;
    for (const x of [-0.36, 0.36]) rot.push([x, yG + 0.2 * Math.sin(a), zG - 0.2 * Math.cos(a)]);
  }
  b.convex({ points: rot, mat: P, crease: 0.45 });
  const zS = zG - 0.25;
  b.box({ x: 0.04, y: yG, z: zS + 0.026, w: 0.5, h: 0.3, d: 0.052, r: 0.02, mat: P }); // gun shield
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.05, -0.02],
      [0.05, 0.12],
      [0.034, 0.14],
      [0.03, 1.3],
      [0.033, 1.32],
      [0.033, 1.36],
      [0.0185, 1.36],
      [0.0185, 1.33],
      [0, 1.33],
    ],
    at: [0, yG, zS],
    dir: [0, 0, -1],
    mat: P,
    seg: 16,
  });
  b.cyl({ z0: zS - 0.005, z1: zS - 0.09, r0: 0.012, x: 0.15, y: yG, mat: 'blued', seg: 8 }); // coax
  b.cyl({ z0: zS + 0.005, z1: zS - 0.004, r0: 0.02, x: -0.15, y: yG + 0.05, mat: 'dark', seg: 10 }); // telescope port
  b.at('gun', 'muzzle', 0, yG, zS - 1.36);
  b.at('gun', 'coaxMuzzle', 0.15, yG, zS - 0.09);
  b.at('gun', 'gunnerEye', -0.15, yG + 0.05, zS - 0.004);
  b.body();
  b.meta.partParents = { gun: 'turret', pintleMg: 'turret' };

  // ---- Meta, armor, modules -----------------------------------------------------------------
  Object.assign(b.meta, {
    name: 'M5A1 Stuart',
    faction: 'us',
    type: 'tracked',
    crew: 4,
    gun: { name: '37 mm M6', caliber: 37 },
    gunElevation: [-12, 20],
    turretTraverse: 30,
    groundClearance: 0.36,
    turretRing: { center: [0, yR, zT], radius: 0.59 },
    specs: { mass: 15400, maxSpeed: 58, power: 220, engine: '2x Cadillac Series 42 V8', fuel: 340 },
  });
  b.armorZY('glacis', 'body', 29, [-2.26, 0.92], [gl(1.62), 1.62], -1.06, 1.06, [0, 0.5, -1]);
  b.armorZY('lowerFront', 'body', 44, [-2.12, 0.46], [-2.3, 0.72], -0.7, 0.7, [0, -0.3, -1]);
  b.armorZY('lowerFrontUpper', 'body', 44, [-2.3, 0.72], [-2.26, 0.93], -0.7, 0.7, [0, 0, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorPoly(`sideUpper${L}`, 'body', 29, [
      [s * 1.12, 0.92, -2.26],
      [s * 1.12, 0.92, 2.12],
      [s * 0.99, 1.58, 2.14],
      [s * 0.98, 1.62, gl(1.62)],
    ], [s, 0.2, 0], 5, [0, 0, 1]);
    b.armorXY(`sideLower${L}`, 'body', 29, [s * 0.7, 0.38], [s * 0.7, 0.93], -2.1, 2.1, [s, 0, 0]);
    b.armorZY(`sponsonFloor${L}`, 'body', 13, [-2.2, 0.92], [2.12, 0.92], s * 0.7, s * 1.12, [0, -1, 0]);
  }
  b.armorZY('roof', 'body', 13, [gl(1.62), 1.62], [2.08, 1.62], -0.98, 0.98, [0, 1, 0]);
  b.armorPoly('rear', 'body', 25, [
    [-0.7, 0.55, 2.12],
    [0.7, 0.55, 2.12],
    [1.12, 0.92, 2.12],
    [0.99, 1.58, 2.14],
    [-0.99, 1.58, 2.14],
    [-1.12, 0.92, 2.12],
  ], [0, 0, 1], 4, [0, 1, 0]);
  b.armorZY('belly', 'body', 13, [-1.86, 0.38], [1.9, 0.38], -0.7, 0.7, [0, -1, 0]);
  b.armorShell('turret', 'turret', plan.map(([x, dz]) => [x, zT + dz]), [1.64, 1], [2.14, 0.9], [0, zT], (deg) => (deg < 40 ? 38 : 32));
  b.armorPoly('turretRoof', 'turret', 13, L3(2.2, 0.86), [0, 1, 0], 3, [0, 0, 1]);
  b.armor('mantlet', 'gun', 51, [0.04, yG, zS], [0.5, 0, 0], [0, 0.3, 0], [0, 0, -1]);
  b.module('engine', 'body', [0, 1.1, 1.35], [0.62, 0.38, 0.6]);
  b.module('transmission', 'body', [0, 0.72, -1.9], [0.5, 0.25, 0.3]);
  for (const s of [-1, 1]) {
    b.module('fuel', 'body', [s * 0.92, 1.25, 1.2], [0.18, 0.3, 0.55]);
    b.module('ammo', 'body', [s * 0.92, 1.25, -0.35], [0.18, 0.28, 0.45]);
  }
  b.module('driver', 'body', [-0.45, 1.15, -1.45], [0.24, 0.45, 0.3]);
  b.module('radio', 'body', [0.45, 1.15, -1.45], [0.24, 0.45, 0.3]); // assistant driver / bow gunner
  b.module('gunner', 'turret', [-0.32, 1.75, zT - 0.05], [0.2, 0.5, 0.25]); // the commander aims the gun
  b.module('commander', 'turret', [-0.32, 1.75, zT - 0.05], [0.2, 0.5, 0.25]);
  b.module('loader', 'turret', [0.34, 1.7, zT + 0.05], [0.2, 0.5, 0.25]);
}

// ---------------------------------------------------------------------------------------
// M3A1 half-track personnel carrier (1943): armored body (6.35 mm sides, 12.7 mm front),
// radiator armor with louvers, unditching roller, armored windshield cover, M49 ring mount
// with a .50 cal over the cab, rear door, 10 seats in the back. Steered front wheels
// (8.25-20, 0.464 m radius, 1.64 m tread) and a rear track unit per side: front drive
// sprocket, rear idler, 4 bogie wheels, 1 return roller, 12 in continuous rubber band
// track (meta.track.pitch is the spacing of its guide lugs). 6.18 m long, 2.22 m wide,
// 2.69 m high over the ring mount; 9.3 t.
// Halftrack conventions: type 'halftrack'; origin at the middle of the wheelbase measured
// from the front axle to the center of the track bogie; parts wheelFL/wheelFR (steered and
// spun like a wheeled vehicle) plus the tracked parts road*, roller*, sprocket*, idler*.
export function m3_halftrack(b) {
  const P = 'od';
  const WB = 3.44,
    R = 0.464,
    TW = 0.22,
    TRK = 1.64;
  const zF = -WB / 2,
    zBog = WB / 2,
    xw = TRK / 2;
  // ---- Front wheels -----------------------------------------------------------------------
  const wheel = jeepWheel({ r: R, width: TW, rimR: 0.254, lugs: 20, lugH: 0.015, rimMat: P, splitBolts: 12, nuts: 8 });
  for (const [name, x] of [
    ['wheelFL', -xw],
    ['wheelFR', xw],
  ])
    b.part(name, [x, R, zF]).addAll(wheel, { x, y: R, z: zF, ry: x < 0 ? Math.PI : 0 });
  b.body();
  // ---- Rear track units ---------------------------------------------------------------------
  const T = 0.035,
    RW = 0.125,
    OX = 0.81;
  const wheels = [-0.45, -0.15, 0.15, 0.45].map((d) => [zBog + d, RW + T]);
  runningGear(b, {
    wheels,
    wheel: roadWheel({ r: RW, width: 0.2, gap: 0.05, tire: 0.03, dish: 0.012, hubR: 0.04, hubLen: 0.02, mat: P, seg: 18 }),
    wheelR: RW,
    rollers: [[zBog, 0.665]],
    roller: roadWheel({ r: 0.07, width: 0.12, tire: 0.018, dish: 0.01, hubR: 0.03, hubLen: 0.02, mat: P, seg: 16 }),
    rollerR: 0.07,
    sprocket: { z: zBog - 0.92, y: 0.45, r: 0.29 + T / 2, teeth: 18, items: sprocket({ n: 18, r0: 0.27, r1: 0.31, ringGap: 0.06, t: 0.04, drumR: 0.2, hubR: 0.1, hubLen: 0.06, mat: P, bolts: 8, tooth: 0.35, tip: 0.15 }) },
    idler: { z: zBog + 0.9, y: 0.45, r: 0.29 + T / 2, items: roadWheel({ r: 0.29, width: 0.22, gap: 0.05, rubber: false, dish: 0.03, hubR: 0.07, hubLen: 0.04, mat: P, holes: 6 }) },
    track: { width: 0.305, pitch: 0.118, thick: T, offsetX: OX },
  });
  for (const s of [-1, 1]) {
    // Bogie bracket with volute springs, track frame from the sprocket to the idler.
    b.convex({
      points: [0.7, 0.92].flatMap((x) => [
        [s * x, 0.24, zBog - 0.32],
        [s * x, 0.24, zBog + 0.32],
        [s * x, 0.5, zBog + 0.22],
        [s * x, 0.5, zBog - 0.22],
      ]),
      mat: P,
    });
    b.span({ z0: zBog - 0.92, z1: zBog + 0.9, y0: 0.42, y1: 0.5, w: 0.06, x: s * 0.66, mat: P, r: 0.01 });
    b.cylAxis({ axis: 'x', x: s * 0.66, y: 0.45, z: zBog - 0.92, len: 0.14, r: 0.12, mat: P, seg: 16 });
  }
  // ---- Chassis, front axle, unditching roller -------------------------------------------------
  for (const s of [-1, 1]) b.span({ z0: -3.0, z1: 2.75, y0: 0.62, y1: 0.8, w: 0.07, x: s * 0.42, mat: P, r: 0.01 });
  b.cylAxis({ axis: 'x', x: 0, y: R, z: zF, len: TRK - 0.2, r: 0.055, mat: P });
  b.sphere({ x: 0.1, y: R, z: zF, r: 0.14, mat: P });
  b.cylAxis({ axis: 'x', x: 0, y: 0.62, z: -3.02, len: 1.5, r: 0.16, mat: P, seg: 20 });
  for (const s of [-1, 1]) b.span({ z0: -3.08, z1: -2.75, y0: 0.56, y1: 0.68, w: 0.05, x: s * 0.78, mat: P, r: 0.008 });
  b.box({ x: 0, y: 0.95, z: -2.05, w: 0.62, h: 0.48, d: 0.95, r: 0.05, mat: 'black' }); // engine
  // ---- Hood, radiator armor, fenders, lamps ---------------------------------------------------
  b.span({ z0: -2.72, z1: -1.32, y0: 0.82, y1: 1.4, w: 1.0, mat: P, r: 0.015 });
  b.span({ z0: -2.76, z1: -2.7, y0: 0.72, y1: 1.4, w: 1.04, mat: P, r: 0.01 });
  for (let i = 0; i < 7; i++) b.box({ x: 0, y: 0.8 + i * 0.085, z: -2.77, w: 0.9, h: 0.05, d: 0.012, rx: -0.5, r: 0.002, mat: P }); // louvers
  for (const s of [-1, 1]) {
    const fl = [
      [-2.78, 0.9],
      [-2.7, 1.04],
      [-1.35, 1.04],
      [-1.32, 1.0],
    ];
    b.prismX({ points: ribbon(fl, 0.012), x0: s * 0.5, x1: s * 1.1, mat: P, bevel: 0.004 });
    b.cyl({ z0: -2.66, z1: -2.52, r0: 0.085, r1: 0.075, x: s * 0.68, y: 1.16, mat: P, seg: 16 });
    b.cyl({ z0: -2.666, z1: -2.658, r0: 0.074, x: s * 0.68, y: 1.16, mat: 'lamp', seg: 16 });
    b.rod({ from: [s * 0.58, 1.05, -2.5], to: [s * 0.58, 1.3, -2.72], r: 0.01, mat: P });
    b.rod({ from: [s * 0.78, 1.05, -2.5], to: [s * 0.78, 1.3, -2.72], r: 0.01, mat: P });
    b.anchor(`headlight${side(s)}`, s * 0.68, 1.16, -2.67);
  }
  b.cyl({ z0: -1.0, z1: -0.5, r0: 0.07, x: 0.62, y: 0.6, mat: 'black' });
  b.anchor('exhaustR', 0.7, 0.6, -0.48);

  // ---- Armored body: cab and rear compartment -----------------------------------------------
  const bz0 = -1.32,
    bz1 = 2.78,
    hw = 0.98,
    y0 = 0.8,
    y1 = 1.75;
  b.span({ z0: bz0, z1: bz1, y0, y1: y0 + 0.04, w: 2 * hw, mat: P, r: 0.008 }); // floor
  const cabDoor = roundRect(-0.93, 1.3, 0.3, 0.38, 0.02);
  for (const s of [-1, 1]) {
    b.prismX({
      points: [
        [bz0, y0],
        [bz1, y0],
        [bz1, y1],
        [-0.4, y1],
        [-0.55, 1.62],
        [bz0, 1.62],
      ],
      holes: [cabDoor],
      x0: s * (hw - 0.012),
      x1: s * hw,
      mat: P,
      bevel: 0.003,
    });
    const name = `doorF${side(s)}`;
    b.part(name, [s * hw, 1.3, -1.23]);
    b.prismX({ points: roundRect(-0.93, 1.3, 0.296, 0.376, 0.02), x0: s * (hw - 0.01), x1: s * (hw + 0.004), mat: P, bevel: 0.003 });
    b.meta.hinges[name] = { axis: [0, 1, 0], open: s * 1.3 };
    b.body();
    // Rear fenders over the track units, rails.
    b.span({ z0: 0.75, z1: 2.8, y0: 0.79, y1: 0.8, w: 0.18, x: s * (hw - 0.06), mat: P });
  }
  b.span({ z0: bz1 - 0.012, z1: bz1, y0, y1, w: 2 * hw, mat: P, r: 0.004 }); // rear wall
  b.span({ z0: bz1, z1: bz1 + 0.012, y0: y0 + 0.08, y1: y1 - 0.12, w: 0.6, mat: P, r: 0.004 }); // rear door
  b.span({ z0: bz0, z1: bz0 + 0.03, y0, y1: 1.4, w: 2 * hw, mat: P, r: 0.004 }); // dash
  // Windshield with the armored cover raised, cab seats, steering.
  b.span({ z0: bz0 - 0.004, z1: bz0 + 0.004, y0: 1.4, y1: 1.75, w: 1.86, mat: 'glass' });
  b.span({ z0: bz0 - 0.02, z1: bz0 + 0.02, y0: 1.74, y1: 1.78, w: 1.96, mat: P, r: 0.008 });
  b.span({ z0: bz0 - 0.36, z1: bz0, y0: 1.76, y1: 1.772, w: 1.9, mat: P, r: 0.004 }); // armor cover, raised
  for (const s of [-1, 1]) b.rod({ from: [s * 0.9, 1.6, bz0 - 0.02], to: [s * 0.9, 1.76, bz0 - 0.32], r: 0.01, mat: P });
  steeringWheel(b, { hub: [-0.5, 1.4, -1.0], col: [0, 0.62, 0.785], r: 0.22, spokes: [0, Math.PI, -Math.PI / 2], columnLen: 0.6 });
  for (const x of [-0.5, 0.05, 0.6]) {
    b.box({ x, y: 1.08, z: -0.62, w: 0.46, h: 0.09, d: 0.4, r: 0.03, mat: 'canvasOD' });
    b.box({ x, y: 1.36, z: -0.4, w: 0.46, h: 0.4, d: 0.07, r: 0.03, rx: 0.1, mat: 'canvasOD' });
  }
  // Rear benches (5 a side, facing inward), fuel tanks behind the cab seats, stowage racks.
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.72, y: 1.18, z: 1.2, w: 0.4, h: 0.08, d: 2.6, r: 0.03, mat: 'canvasOD' });
    b.box({ x: s * 0.72, y: 1.0, z: 1.2, w: 0.36, h: 0.3, d: 2.5, r: 0.01, mat: P });
    b.box({ x: s * 0.93, y: 1.45, z: 1.2, w: 0.06, h: 0.32, d: 2.6, r: 0.02, mat: 'canvasOD' });
    b.box({ x: s * 0.68, y: 1.12, z: -0.16, w: 0.5, h: 0.6, d: 0.26, r: 0.02, mat: P }); // fuel tank
  }
  // M49 ring mount over the cab (right) with a .50 cal.
  const rc = [0.32, 2.12, -0.72];
  for (const [dx, dz] of [
    [-0.36, -0.3],
    [0.36, -0.3],
    [0, 0.42],
  ])
    b.rod({ from: [rc[0] + dx, y0 + 0.05, rc[2] + dz], to: [rc[0] + dx * 1.05, rc[1], rc[2] + dz * 1.05], r: 0.03, mat: P });
  b.latheDir({ profile: torusProfile(0.44, 0.025, 8), at: rc, dir: [0, 1, 0], mat: P, seg: 32 });
  const mg = [rc[0], rc[1] + 0.14, rc[2] - 0.44];
  b.part('pintleMg', mg);
  b.box({ x: mg[0], y: mg[1] + 0.06, z: mg[2] + 0.12, w: 0.14, h: 0.17, d: 0.6, r: 0.012, mat: 'blued' });
  b.cyl({ z0: mg[2] - 0.18, z1: mg[2] - 0.4, r0: 0.032, x: mg[0], y: mg[1] + 0.07, mat: 'blued', seg: 12 });
  b.cyl({ z0: mg[2] - 0.4, z1: mg[2] - 1.06, r0: 0.022, x: mg[0], y: mg[1] + 0.07, mat: 'blued', seg: 12 });
  b.cyl({ z0: mg[2] - 1.06, z1: mg[2] - 1.1, r0: 0.026, x: mg[0], y: mg[1] + 0.07, mat: 'blued', seg: 12 });
  b.box({ x: mg[0] - 0.15, y: mg[1] + 0.03, z: mg[2] + 0.06, w: 0.11, h: 0.17, d: 0.28, r: 0.008, mat: P });
  b.box({ x: mg[0], y: mg[1] - 0.06, z: mg[2] + 0.04, w: 0.1, h: 0.08, d: 0.16, r: 0.01, mat: P }); // carriage
  b.at('pintleMg', 'mgMount', mg[0], mg[1], mg[2]);
  b.at('pintleMg', 'mgMuzzle', mg[0], mg[1] + 0.07, mg[2] - 1.1);
  b.body();

  // ---- Anchors, meta ---------------------------------------------------------------------------
  b.anchor('driverSeat', -0.5, 1.2, -0.6);
  b.anchor('driverEye', -0.5, 1.88, -0.68);
  b.anchor('seat1', 0.05, 1.2, -0.6);
  b.anchor('seat2', 0.6, 1.2, -0.6); // under the ring mount (the gunner stands up to man it)
  let n = 3;
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) b.anchor(`seat${n++}`, s * 0.72, 1.3, 0.25 + i * 0.47);
  b.anchor('gunnerEye', mg[0], mg[1] + 0.2, mg[2] + 0.75);
  b.meta.anchorParts.gunnerEye = 'pintleMg';
  Object.assign(b.meta, {
    name: 'M3A1 Half-track',
    faction: 'us',
    type: 'halftrack',
    crew: 2,
    seats: 13,
    wheelRadius: R,
    wheelWidth: TW,
    frontAxleZ: zF,
    trackBogieZ: zBog,
    maxSteer: 0.5,
    groundClearance: 0.28,
    wheels: { wheelFL: [-xw, R, zF], wheelFR: [xw, R, zF] },
    specs: { mass: 9300, maxSpeed: 72, power: 147, engine: 'White 160AX', fuel: 227 },
  });
  // The track contact length (bogie wheels) went into meta.wheelbase from runningGear: the
  // half-track's wheelbase is front axle -> bogie center instead.
  b.meta.trackContactLength = b.meta.wheelbase;
  b.meta.wheelbase = WB;
  b.meta.trackWidth = TRK;
  b.armorZY('radiator', 'body', 12.7, [-2.77, 0.72], [-2.77, 1.4], -0.52, 0.52, [0, 0, -1]);
  b.armorZY('hood', 'body', 6.35, [-2.72, 1.4], [-1.32, 1.4], -0.5, 0.5, [0, 1, 0]);
  for (const s of [-1, 1]) {
    b.armorXY(`hoodSide${side(s)}`, 'body', 6.35, [s * 0.5, 0.82], [s * 0.5, 1.4], -2.72, -1.32, [s, 0, 0]);
    b.armorXY(`side${side(s)}`, 'body', 6.35, [s * hw, y0], [s * hw, y1], bz0, bz1, [s, 0, 0]);
  }
  b.armorZY('windshieldCover', 'body', 12.7, [bz0, 1.4], [bz0, 1.75], -0.98, 0.98, [0, 0, -1]);
  b.armorZY('rear', 'body', 6.35, [bz1, y0], [bz1, y1], -hw, hw, [0, 0, 1]);
  b.armorZY('floor', 'body', 6.35, [bz0, y0], [bz1, y0], -hw, hw, [0, -1, 0]);
  b.module('engine', 'body', [0, 1.05, -2.05], [0.34, 0.3, 0.5]);
  for (const s of [-1, 1]) b.module('fuel', 'body', [s * 0.68, 1.12, -0.16], [0.25, 0.3, 0.13]);
  b.module('driver', 'body', [-0.5, 1.45, -0.7], [0.24, 0.45, 0.28]);
  b.module('gunner', 'body', [0.6, 1.55, -0.7], [0.24, 0.55, 0.28]);
}
