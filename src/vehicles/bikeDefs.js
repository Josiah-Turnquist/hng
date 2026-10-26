// Two-wheelers: the bicycle, and the three armies' motorcycles solo and with a
// sidecar. Merged into VEHICLES (defs.js); physics in bike.js, models in
// models/bikes.js. Units: kg, m, N, N m, rpm, radians.
//
// Geometry is in model space (vkit.js conventions: +X right, +Y up, -Z forward,
// origin on the ground at the middle of the wheelbase, on the motorcycle's own
// wheel line for sidecar outfits). The model builders read these numbers, so the
// physics and the models agree.
//
// Sources:
//  - Harley-Davidson WLA: TM 9-879 (1943): 45 cu in (739 cc) side-valve 45 degree
//    V-twin, 23.5 hp at 4600 rpm, high gear 4.59:1 (31 T engine, 59 T clutch,
//    17 T countershaft, 41 T rear sprocket), 65 mph allowed; 3-speed hand shift,
//    foot clutch; internal gearbox ratios 2.47 / 1.57 / 1.0 (45 cu in 3-speed box,
//    parts data); 57.5 in (1460 mm) wheelbase; 4.00-18 tires; 540 lb (245 kg) dry.
//  - BMW R 75 with sidecar: 745 cc OHV flat twin, 78 x 78 mm, 26 hp at 4000 rpm;
//    road gears 3.22 / 1.83 / 1.21 / 0.90 (reverse 2.41), off-road 4.46 / 2.54 /
//    1.67 (reverse 3.3), rear drive 6.05; driven sidecar wheel through a locking
//    differential; wheelbase 1444 mm, track 1180 mm; 4.50-16 tires on all three
//    wheels; 2400 x 1730 x 1000 mm; about 420 kg empty; 92-95 km/h (BMW Group
//    Classic, Motobins R 75 data sheet, de.wikipedia "BMW R 75 Gespann").
//  - M-72: 746 cc side-valve flat twin, 22 hp at 4600 rpm; gears 3.60 / 2.28 /
//    1.70 / 1.30, spiral bevel final drive 4.62; wheelbase 1430 mm; 3.75-19 tires;
//    225 kg solo, 350 kg with sidecar; solo 2130 x 815 x 960 mm, with sidecar
//    2380 x 1590 x 1000 mm; 135 mm ground clearance; 85-90 km/h with the sidecar
//    (Soviet technical descriptions as summarized on ru.wikipedia and
//    enthusiast references).
//  - Bicycle: a typical French roadster of the 1930s with 28 x 1 1/2 in tires
//    (ISO 40-635), single speed, about 20 kg (military bicycles of the period:
//    19-23 kg). Gear and geometry est. from period roadsters.
// Values marked "est." are estimates.
const DEG = Math.PI / 180;

// Standard rider and passenger positions are listed per seat:
//   hip: midway between the hip joints, on the saddle; grips: handlebar grips
//   (on the steering, at straight ahead); feet: footboards, pegs or pedal axle.
// The models place their anchors at the same points.

const BICYCLE = {
  name: 'Bicycle',
  faction: null,
  neutral: true,
  kind: 'bike',
  pedal: {
    // Single speed, 46 x 20 teeth on 28 in wheels: 5.14 m per crank turn (est.).
    chainring: 46,
    sprocket: 20,
    crank: 0.17,
    bb: [0, 0.27, 0.113], // bottom bracket (crank axle)
    pedalX: 0.15,
    // The rider's legs (est., a fit young soldier): force at the pedal falls
    // linearly with cadence, F = F0 (1 - c / c0): best about 600 W at 95 rpm.
    // Out of the saddle he puts his weight (and a pull on the bars) on each
    // pedal: about 1000 N, which is what gets a single speed up a steep hill.
    F0: 700,
    F0stand: 1000,
    c0: 190,
    cruise: 160, // W: a steady effort on the flat that he can keep up for hours
    cp: 230, // W: critical power (sustainable without tiring); he climbs at it
    climb: 0.06, // grade at which his steady effort has risen to critical power
    wPrime: 14000, // J: work above critical power before he is spent
    efficiency: 0.95, // chain and bearings
  },
  mass: 20,
  dims: [0.6, 1.1, 1.86],
  cg: [0, 0.48, 0.02],
  inertia: [1.1, 2.2, 1.6], // roll, pitch, yaw about the machine's own CG (est.)
  wheelbase: 1.13,
  wheelRadius: 0.355, // 28 x 1 1/2 in: 711 mm over the tire
  wheelRadiusF: 0.355,
  tire: 'bicycle',
  // Steering: head angle 68 degrees, 65 mm fork offset: 74 mm trail.
  steering: { rake: 22 * DEG, offset: 0.065, lock: 0.75, head: [0, 0.79, -0.319] },
  suspension: {
    // No springs: only the tires (about 100 N/mm at 3-4 bar) and the sprung saddle.
    front: { k: 90000, c: 700, droop: 0.01, bump: 0.025 },
    rear: { k: 100000, c: 800, droop: 0.012, bump: 0.025 },
  },
  lean: { clear: 0.6, crash: 0.85, stand: 0 }, // stand: parked upright on its rear stand
  rider: { rollRate: 1.6, barRate: 4, wn: 4, foot: -1, latG: 0.6 },
  brakes: { front: 270, rear: 190 }, // N: stirrup rim brakes
  cda: 0.75, // m2 with an upright rider in uniform, helmet, rifle and pack (est.)
  engine: { name: 'The rider\'s legs', human: true, idle: 0, redline: 140, torque: [[0, 0]], inertia: 0, sound: null },
  gears: [1],
  finalDrive: 1,
  efficiency: 0.95,
  shiftTime: 0,
  seats: [
    {
      name: 'Rider',
      role: 'driver',
      style: 'bicycle',
      anchor: 'riderHip',
      hip: [0, 1.06, 0.4],
      grips: [
        [-0.27, 1.04, -0.13],
        [0.27, 1.04, -0.13],
      ],
      eye: [0, 1.75, 0.18],
    },
  ],
  hp: 80,
  info: 'A French roadster of the 1930s: single speed, 28 inch wheels, about 20 kg. Pedal with W, sprint with Shift (it uses your stamina). Quiet, and faster than walking.',
};

// Seats shared by the motorcycles (positions differ per machine).
const rider = (style, hip, grips, feet, eye) => ({ name: 'Rider', role: 'driver', style, anchor: 'riderHip', hip, grips, feet, eye });
const pillion = (hip, grips, feet) => ({ name: 'Pillion', role: 'passenger', style: 'pillion', anchor: 'pillionHip', hip, grips, feet });
const sidecarSeat = (hip, feet) => ({ name: 'Sidecar gunner', role: 'sidecarMg', style: 'sidecar', anchor: 'sideHip', hip, feet });

// ---------------------------------------------------------------------- Harley-Davidson WLA
const WLA_ENGINE = {
  name: 'Harley-Davidson 45 cu in (739 cc) side-valve V-twin, 23.5 hp at 4600 rpm',
  idle: 850,
  redline: 5100,
  // est. from 23.5 hp at 4600 rpm (36.4 N m there) and the flathead's flat curve.
  torque: [
    [800, 29],
    [1500, 35],
    [2500, 38.5],
    [3200, 38.5],
    [4000, 37.2],
    [4600, 36.4],
    [5200, 31],
  ],
  inertia: 0.09, // heavy flywheels (est.)
  sound: 'engineVTwin',
  cylinders: 2,
};

const WLA_BASE = {
  faction: 'US',
  kind: 'bike',
  wheelbase: 1.46,
  wheelRadius: 0.325, // 4.00-18
  wheelRadiusF: 0.325,
  tire: 'motorcycle',
  // Springer (leading link) fork, about 29 degrees rake; rigid rear frame.
  steering: { rake: 29 * DEG, offset: 0.05, lock: 0.7, head: [0, 0.84, -0.47] },
  engine: WLA_ENGINE,
  gears: [2.47, 1.57, 1.0], // 3-speed hand shift on the tank
  reverse: 0,
  finalDrive: 4.59, // primary 59/31 x final 41/17
  efficiency: 0.88, // two chains and the gearbox
  shiftTime: 0.85, // foot clutch, hand lever on the tank
  startGear: 1,
};

const WLA = {
  ...WLA_BASE,
  name: 'Harley-Davidson WLA',
  mass: 245,
  dims: [0.97, 1.04, 2.24],
  cg: [0, 0.5, 0.02],
  inertia: [16, 42, 36],
  suspension: {
    front: { k: 17000, c: 1500, droop: 0.04, bump: 0.05 },
    rear: { k: 170000, c: 3000, droop: 0.02, bump: 0.025 }, // rigid frame: the tire (and the sprung saddle)
  },
  lean: { clear: 0.55, crash: 0.78, stand: 0 }, // footboards scrape at about 31 degrees
  rider: { rollRate: 1.0, barRate: 2.5, wn: 3.2, foot: 1, latG: 0.6 }, // left foot works the clutch
  brakes: { front: 900, rear: 1150 },
  cda: 0.72,
  seats: [rider('motorcycle', [0, 0.86, 0.23], [[-0.4, 0.99, -0.4], [0.4, 0.99, -0.4]], [[-0.28, 0.33, -0.2], [0.28, 0.33, -0.2]], [0, 1.6, 0.12])],
  hp: 150,
  info: '45 cubic inch flathead V-twin, three speeds by hand on the tank and a foot clutch. Rugged and easy to ride, about 105 km/h flat out. The scabbard holds a Thompson.',
};

const WLA_SIDECAR = {
  ...WLA_BASE,
  name: 'Harley-Davidson WLA with sidecar',
  mass: 355, // + about 110 kg of sidecar (est.)
  dims: [1.9, 1.1, 2.4],
  cg: [0.29, 0.48, 0.02],
  inertia: [70, 75, 120],
  finalDrive: 5.27, // sidecar gearing: 27 T engine sprocket (est.)
  sidecar: { track: 1.12, z: 0.33, wheelRadius: 0.325, driven: 0, brake: 0, bodyX: 0.98, nose: -1.05, tail: 0.86 }, // est.
  suspension: {
    front: { k: 19000, c: 1700, droop: 0.04, bump: 0.05 },
    rear: { k: 170000, c: 3000, droop: 0.02, bump: 0.025 },
    side: { k: 26000, c: 1800, droop: 0.05, bump: 0.05 }, // leaf spring (est.)
  },
  lean: { tip: 0.5 },
  rider: { barRate: 2, latG: 0.55 },
  brakes: { front: 950, rear: 1250 },
  cda: 1.05,
  seats: [
    rider('motorcycle', [0, 0.86, 0.23], [[-0.4, 0.99, -0.4], [0.4, 0.99, -0.4]], [[-0.28, 0.33, -0.2], [0.28, 0.33, -0.2]], [0, 1.6, 0.12]),
    sidecarSeat([0.98, 0.5, 0.28], [[0.88, 0.22, -0.55], [1.08, 0.22, -0.55]]),
  ],
  // Motorcycle-mounted M1919A4 on a pedestal at the front of the sidecar (as in
  // the original game).
  sidecarMg: { name: 'M1919A4 Browning', ammo: '30-06 M2', rpm: 450, belt: 250, belts: 3, tracerEvery: 5, sound: 'mg', pivot: [0.98, 0.93, -0.36], traverse: 70, elev: [-12, 45] },
  hp: 220,
  info: 'The WLA with a sidecar and a .30 caliber Browning on a pedestal. Heavier, slower to accelerate, and it pulls toward the sidecar under power.',
};

// ---------------------------------------------------------------------- BMW R 75
const R75_ENGINE = {
  name: 'BMW 745 cc OHV flat twin, 26 hp at 4000 rpm',
  idle: 700,
  redline: 4600,
  // est. from 26 hp at 4000 rpm (45.6 N m there).
  torque: [
    [700, 34],
    [1500, 44],
    [2500, 49],
    [3200, 48.5],
    [4000, 45.6],
    [4500, 42],
    [4800, 37],
  ],
  inertia: 0.07,
  sound: 'engineBoxer',
  cylinders: 2,
};

const R75_BASE = {
  faction: 'GE',
  kind: 'bike',
  wheelbase: 1.444,
  wheelRadius: 0.31, // 4.50-16
  wheelRadiusF: 0.31,
  tire: 'motorcycle',
  steering: { rake: 27 * DEG, offset: 0.04, lock: 0.62, head: [0, 0.86, -0.46] }, // telescopic fork
  engine: R75_ENGINE,
  gears: [3.22, 1.83, 1.21, 0.9],
  offroadGears: [4.46, 2.54, 1.67],
  reverse: 2.41,
  offroadReverse: 3.3,
  finalDrive: 6.05,
  efficiency: 0.88, // shaft drive
  shiftTime: 0.45, // foot shift
  startGear: 1,
};

const R75_SIDECAR = {
  ...R75_BASE,
  name: 'BMW R 75 with sidecar',
  mass: 420,
  dims: [1.73, 1.0, 2.4],
  cg: [0.25, 0.47, 0.0],
  inertia: [80, 85, 140],
  sidecar: { track: 1.18, z: 0.5, wheelRadius: 0.31, driven: 0.3, brake: 0.3, bodyX: 0.86, nose: -0.98, tail: 0.88 }, // driven: share of the torque (est.)
  suspension: {
    front: { k: 21000, c: 1900, droop: 0.05, bump: 0.06 },
    rear: { k: 180000, c: 3200, droop: 0.02, bump: 0.025 }, // rigid rear frame (tire and sprung saddle)
    side: { k: 30000, c: 2000, droop: 0.05, bump: 0.05 }, // torsion bar
  },
  lean: { tip: 0.48 },
  rider: { barRate: 2, latG: 0.55 },
  brakes: { front: 1300, rear: 1300, side: 700 }, // rear and sidecar brakes hydraulic, linked
  cda: 1.1,
  seats: [
    rider('motorcycle', [0, 0.88, 0.1], [[-0.37, 1.02, -0.4], [0.37, 1.02, -0.4]], [[-0.27, 0.3, -0.07], [0.27, 0.3, -0.07]], [0, 1.62, 0.0]),
    sidecarSeat([0.86, 0.5, 0.36], [[0.76, 0.22, -0.5], [0.96, 0.22, -0.5]]),
    pillion([0, 0.93, 0.55], [[-0.1, 0.98, 0.33], [0.1, 0.98, 0.33]], [[-0.22, 0.33, 0.38], [0.22, 0.33, 0.38]]),
  ],
  // MG 34 on the sidecar mount (the original game fitted an MG 42).
  sidecarMg: { name: 'MG 34 (sidecar mount)', ammo: '792 sS', rpm: 850, belt: 50, belts: 8, tracerEvery: 4, sound: 'mg', pivot: [0.86, 0.95, -0.34], traverse: 70, elev: [-12, 45] },
  hp: 240,
  info: 'The Wehrmacht\'s heavy sidecar outfit: driven sidecar wheel, four road gears plus an off-road range and reverse, and an MG 34 for the man in the sidecar. Crew of three.',
};

const R75 = {
  ...R75_BASE,
  name: 'BMW R 75',
  mass: 290, // the machine without its sidecar (est.)
  dims: [0.88, 1.0, 2.2],
  cg: [0, 0.5, 0.0],
  inertia: [18, 46, 40],
  suspension: {
    front: { k: 19000, c: 1700, droop: 0.05, bump: 0.06 },
    rear: { k: 180000, c: 3200, droop: 0.02, bump: 0.025 },
  },
  lean: { clear: 0.66, crash: 0.88, stand: 0 }, // the cylinder heads scrape at about 38 degrees
  rider: { rollRate: 1.0, barRate: 2.5, wn: 3.2, foot: -1, latG: 0.6 },
  brakes: { front: 1050, rear: 1050 },
  cda: 0.75,
  seats: [
    rider('motorcycle', [0, 0.88, 0.1], [[-0.37, 1.02, -0.4], [0.37, 1.02, -0.4]], [[-0.27, 0.3, -0.07], [0.27, 0.3, -0.07]], [0, 1.62, 0.0]),
    pillion([0, 0.93, 0.55], [[-0.1, 0.98, 0.33], [0.1, 0.98, 0.33]], [[-0.22, 0.33, 0.38], [0.22, 0.33, 0.38]]),
  ],
  hp: 160,
  info: 'The R 75 ridden without its sidecar, as in the original game: low sidecar gearing, so it pulls hard but tops out near 95 km/h.',
};

// ---------------------------------------------------------------------- M-72
const M72_ENGINE = {
  name: 'M-72 746 cc side-valve flat twin, 22 hp at 4600 rpm',
  idle: 700,
  redline: 5000,
  // est. from 22 hp at 4600 rpm (33.6 N m there).
  torque: [
    [700, 28],
    [1500, 34],
    [2500, 38],
    [3400, 37.5],
    [4000, 35.6],
    [4600, 33.6],
    [5100, 29],
  ],
  inertia: 0.07,
  sound: 'engineBoxerSV',
  cylinders: 2,
};

const M72_BASE = {
  faction: 'SU',
  kind: 'bike',
  wheelbase: 1.43,
  wheelRadius: 0.33, // 3.75-19
  wheelRadiusF: 0.33,
  tire: 'motorcycle',
  steering: { rake: 27 * DEG, offset: 0.04, lock: 0.62, head: [0, 0.86, -0.45] },
  engine: M72_ENGINE,
  gears: [3.6, 2.28, 1.7, 1.3],
  reverse: 0,
  finalDrive: 4.62,
  efficiency: 0.88,
  shiftTime: 0.5,
  startGear: 1,
};

const M72 = {
  ...M72_BASE,
  name: 'M-72',
  mass: 225,
  dims: [0.815, 0.96, 2.13],
  cg: [0, 0.5, 0.02],
  inertia: [15, 40, 34],
  suspension: {
    front: { k: 17000, c: 1500, droop: 0.05, bump: 0.06 },
    rear: { k: 32000, c: 2200, droop: 0.03, bump: 0.035 }, // plunger rear suspension
  },
  lean: { clear: 0.66, crash: 0.88, stand: 0 },
  rider: { rollRate: 1.0, barRate: 2.5, wn: 3.2, foot: -1, latG: 0.6 },
  brakes: { front: 950, rear: 1050 },
  cda: 0.72,
  seats: [
    rider('motorcycle', [0, 0.87, 0.1], [[-0.36, 1.0, -0.4], [0.36, 1.0, -0.4]], [[-0.27, 0.3, -0.07], [0.27, 0.3, -0.07]], [0, 1.61, 0.0]),
    pillion([0, 0.92, 0.55], [[-0.1, 0.97, 0.33], [0.1, 0.97, 0.33]], [[-0.22, 0.33, 0.38], [0.22, 0.33, 0.38]]),
  ],
  hp: 150,
  info: 'The Soviet copy of the BMW R71: 746 cc side-valve flat twin, four speeds, shaft drive, plunger rear suspension.',
};

const M72_SIDECAR = {
  ...M72_BASE,
  name: 'M-72 with sidecar',
  mass: 350,
  dims: [1.59, 1.0, 2.38],
  cg: [0.29, 0.47, 0.0],
  inertia: [68, 72, 118],
  sidecar: { track: 1.1, z: 0.49, wheelRadius: 0.33, driven: 0, brake: 0, bodyX: 0.83, nose: -0.98, tail: 0.86 }, // est.
  suspension: {
    front: { k: 19000, c: 1700, droop: 0.05, bump: 0.06 },
    rear: { k: 34000, c: 2400, droop: 0.03, bump: 0.035 },
    side: { k: 26000, c: 1800, droop: 0.05, bump: 0.05 },
  },
  lean: { tip: 0.5 },
  rider: { barRate: 2, latG: 0.55 },
  brakes: { front: 1050, rear: 1350 },
  cda: 1.2, // (est.: the boxy chair and its upright gunner; with this it tops out at its real 85-90 km/h)
  seats: [
    rider('motorcycle', [0, 0.87, 0.1], [[-0.36, 1.0, -0.4], [0.36, 1.0, -0.4]], [[-0.27, 0.3, -0.07], [0.27, 0.3, -0.07]], [0, 1.61, 0.0]),
    sidecarSeat([0.83, 0.5, 0.35], [[0.73, 0.22, -0.5], [0.93, 0.22, -0.5]]),
    pillion([0, 0.92, 0.55], [[-0.1, 0.97, 0.33], [0.1, 0.97, 0.33]], [[-0.22, 0.33, 0.38], [0.22, 0.33, 0.38]]),
  ],
  sidecarMg: { name: 'DP (sidecar mount)', ammo: '762x54R L', rpm: 550, belt: 47, belts: 6, tracerEvery: 4, sound: 'mg', pivot: [0.83, 0.94, -0.34], traverse: 70, elev: [-12, 45] },
  hp: 220,
  info: 'M-72 with its sidecar and a DP machine gun on the pintle. Crew of three; about 85-90 km/h on the road.',
};

export const BIKES = {
  bicycle: BICYCLE,
  wla: WLA,
  wla_sidecar: WLA_SIDECAR,
  r75: R75,
  r75_sidecar: R75_SIDECAR,
  m72: M72,
  m72_sidecar: M72_SIDECAR,
};

// Which machines each army rides (for placing them on the map).
export const ARMY_BIKES = {
  US: { solo: 'wla', sidecar: 'wla_sidecar' },
  GE: { solo: 'r75', sidecar: 'r75_sidecar' },
  SU: { solo: 'm72', sidecar: 'm72_sidecar' },
};
