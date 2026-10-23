// Vehicle data: real engines, gearboxes, weights and guns. Units: kg, m, N m, rpm.
// Torque curves are [rpm, N m] points; gear ratios include the gearbox only
// (final drive separate). Sources: US TM manuals (TM 9-803 Willys MB, TM 9-731
// M4A1), German and Soviet technical data as summarized in standard references;
// see docs/RESEARCH.md. Values marked "est." are estimates.

export const VEHICLES = {
  willys_mb: {
    name: 'Willys MB',
    faction: 'US',
    kind: 'wheeled',
    mass: 1110, // 1040 kg curb + fuel
    dims: [1.57, 1.3, 3.33],
    inertiaScale: 0.8,
    cg: [0, 0.62, 0.1], // center of mass relative to the model origin
    wheelbase: 2.03,
    track: 1.24,
    wheelRadius: 0.362, // 6.00-16 tires
    wheelMass: 25,
    suspension: { k: 38000, c: 3000, droop: 0.1, bump: 0.09 }, // per wheel; leaf springs
    steerMax: 0.6, // rad (front wheels)
    engine: {
      name: 'Willys L134 "Go Devil" 2.2 L I4, 60 hp',
      idle: 600,
      redline: 4200,
      torque: [
        [600, 98],
        [1000, 122],
        [2000, 142],
        [3000, 136],
        [3500, 126],
        [4000, 107],
        [4200, 96],
      ],
      inertia: 0.15,
      sound: 'engineJeep',
      cylinders: 4,
    },
    gears: [2.665, 1.564, 1.0], // Warner T-84
    reverse: 3.554,
    transfer: 1.0, // Spicer 18 high range (low = 1.97)
    finalDrive: 4.88,
    driven: 'all',
    efficiency: 0.86,
    brakeForce: 9000, // N total
    dragCoef: 0.75,
    frontalArea: 2.3,
    shiftTime: 0.55,
    seats: [
      { name: 'Driver', anchor: 'driverEye', eye: true, role: 'driver' },
      { name: 'Passenger', anchor: 'seat1' },
      { name: 'Rear left', anchor: 'seat2' },
      { name: 'Rear right', anchor: 'seat3' },
    ],
    hp: 500,
    info: 'The quarter-ton 4x4 that went everywhere. 60 hp, three speeds, four-wheel drive.',
  },
  kubelwagen: {
    name: 'Kübelwagen Typ 82',
    faction: 'GE',
    kind: 'wheeled',
    mass: 790,
    dims: [1.6, 1.35, 3.74],
    inertiaScale: 0.8,
    cg: [0, 0.55, 0.3],
    wheelbase: 2.4,
    track: 1.36,
    wheelRadius: 0.355, // 5.25-16
    wheelMass: 20,
    suspension: { k: 24000, c: 2200, droop: 0.12, bump: 0.1 }, // torsion bars
    steerMax: 0.6,
    engine: {
      name: 'VW 985 cc air-cooled flat four, 25 hp (1943: 1131 cc)',
      idle: 700,
      redline: 3600,
      torque: [
        [700, 50],
        [1500, 62],
        [2000, 67],
        [2800, 63],
        [3300, 54],
        [3600, 46],
      ],
      inertia: 0.1,
      sound: 'engineJeep',
      cylinders: 4,
    },
    gears: [3.6, 2.07, 1.25, 0.8],
    reverse: 6.6,
    transfer: 1.0,
    finalDrive: 4.43 * 1.4, // ring and pinion x portal hub reduction
    driven: 'rear',
    efficiency: 0.85,
    brakeForce: 6000,
    dragCoef: 0.8,
    frontalArea: 2.2,
    shiftTime: 0.5,
    seats: [
      { name: 'Driver', anchor: 'driverEye', eye: true, role: 'driver' },
      { name: 'Passenger', anchor: 'seat1' },
      { name: 'Rear left', anchor: 'seat2' },
      { name: 'Rear right', anchor: 'seat3' },
    ],
    hp: 500,
    info: 'Volkswagen field car: light, rear-wheel drive, limited-slip differential, surprisingly good off-road.',
  },
  gaz67: {
    name: 'GAZ-67',
    faction: 'SU',
    kind: 'wheeled',
    mass: 1320,
    dims: [1.7, 1.7, 3.35],
    inertiaScale: 0.8,
    cg: [0, 0.68, 0.1],
    wheelbase: 2.1,
    track: 1.45,
    wheelRadius: 0.37,
    wheelMass: 28,
    suspension: { k: 40000, c: 3400, droop: 0.1, bump: 0.09 },
    steerMax: 0.58,
    engine: {
      name: 'GAZ-MM 3.3 L I4, 54 hp',
      idle: 500,
      redline: 2900,
      torque: [
        [500, 150],
        [1000, 170],
        [1400, 180],
        [2000, 170],
        [2600, 150],
        [2900, 135],
      ],
      inertia: 0.2,
      sound: 'engineJeep',
      cylinders: 4,
    },
    gears: [6.4, 3.09, 1.69, 1.0],
    reverse: 7.82,
    transfer: 1.0,
    finalDrive: 4.6, // est.: about 88 km/h flat out
    driven: 'all',
    efficiency: 0.85,
    brakeForce: 10000,
    dragCoef: 0.8,
    frontalArea: 2.6,
    shiftTime: 0.6,
    seats: [
      { name: 'Driver', anchor: 'driverEye', eye: true, role: 'driver' },
      { name: 'Passenger', anchor: 'seat1' },
      { name: 'Rear left', anchor: 'seat2' },
      { name: 'Rear right', anchor: 'seat3' },
    ],
    hp: 500,
    info: 'Soviet 4x4 field car with a wide track and a big low-revving engine.',
  },

  // ---------------------------------------------------------------- tanks
  m4a1_sherman: {
    name: 'M4A1 Sherman',
    faction: 'US',
    kind: 'tracked',
    mass: 30300,
    dims: [2.62, 2.2, 5.84],
    inertiaScale: 0.75,
    cg: [0, 1.0, 0.1],
    roadWheelRadius: 0.254,
    trackWidth: 0.42,
    trackCenters: 2.11,
    contactLength: 3.73,
    sprocketRadius: 0.315, // 13 teeth, 6 in pitch
    roadWheels: 6,
    trackMass: 1300, // per side
    turnRadius: 9.45, // controlled differential: 31 ft in every gear
    startGear: 2, // first is a crawler gear for steep slopes
    suspension: { k: 400000, c: 20000, droop: 0.06, bump: 0.07 }, // VVSS volute springs, per road wheel: short travel, hard ride
    engine: {
      name: 'Continental R975-C1 9-cylinder radial, 400 hp gross',
      idle: 800,
      redline: 2400,
      torque: [
        [800, 1000],
        [1200, 1200],
        [1800, 1270],
        [2100, 1220],
        [2400, 1150],
      ],
      inertia: 2.5,
      sound: 'engineTankGas',
      cylinders: 9,
    },
    gears: [7.56, 3.11, 1.78, 1.11, 0.73],
    reverse: 5.65,
    finalDrive: 10.03, // 3.53 differential bevel x 2.84 final drives: 24 mph at 2400 rpm
    efficiency: 0.8,
    steering: 'controlledDiff', // can't pivot in place; fixed turning radius per gear
    steerRatio: 0.33,
    rollCoef: 0.03,
    trackMu: 0.75,
    lateralMu: 0.55,
    brakeForce: 220000,
    shiftTime: 0.9,
    turret: { traverse: 24, traverseAccel: 40, manualTraverse: 4, elevation: [-10, 25], elevRate: 5, stabilizer: true, powered: 'hydraulic' },
    gun: {
      name: '75 mm M3 L/40',
      ammo: ['M61 APC', 'M48 HE'],
      stowed: { 'M61 APC': 60, 'M48 HE': 30 },
      reload: 3.6,
      sight: { name: 'M70F telescope', mag: 3, fieldDeg: 12.3, reticle: 'us', ranges: [0, 3000, 100] },
    },
    seats: [
      { name: 'Driver and gunner', anchor: 'gunnerEye', eye: true, role: 'gunner' },
      { name: 'Bow machine gunner', anchor: 'bowMgMuzzle', eye: true, offset: [0.0, 0.2, 0.75], role: 'bowMg' },
    ],
    coax: { name: 'M1919A4 coaxial MG', ammo: '30-06 M2', rpm: 450, belt: 250, belts: 18, tracerEvery: 5, muzzle: 'coaxMuzzle', sound: 'm1919a6' },
    bowMg: { name: 'M1919A4 bow MG', ammo: '30-06 M2', rpm: 450, belt: 250, belts: 12, tracerEvery: 5, muzzle: 'bowMgMuzzle', traverse: 24, elev: [-12, 20], sound: 'm1919a6' },
    hp: 1700,
    crew: 5,
    info: 'Reliable, fast-firing medium tank with a stabilized 75 mm gun. Its tall hull and 51 mm sloped front armor are vulnerable to German long 75s and 88s.',
  },
  panzer4_h: {
    name: 'Panzer IV Ausf. H',
    faction: 'GE',
    kind: 'tracked',
    mass: 25000,
    dims: [2.88, 2.0, 5.89],
    inertiaScale: 0.75,
    cg: [0, 0.95, 0.15],
    roadWheelRadius: 0.235,
    trackWidth: 0.4,
    trackCenters: 2.45,
    contactLength: 3.52,
    sprocketRadius: 0.37,
    roadWheels: 8,
    trackMass: 1100,
    turnRadius: 5.9, // epicyclic steering units; tighter by braking a track
    suspension: { k: 210000, c: 13000, droop: 0.06, bump: 0.07 }, // 8 wheels a side on leaf-spring bogies
    engine: {
      name: 'Maybach HL 120 TRM V12, 300 hp',
      idle: 700,
      redline: 3000,
      torque: [
        [700, 560],
        [1200, 700],
        [1800, 780],
        [2400, 760],
        [3000, 700],
      ],
      inertia: 1.6,
      sound: 'engineTankGas',
      cylinders: 12,
    },
    gears: [8.43, 5.33, 3.33, 2.12, 1.36, 0.94],
    reverse: 9.0,
    finalDrive: 10.6, // gives 42 km/h at 3000 rpm in 6th
    efficiency: 0.8,
    steering: 'epicyclic', // clutch-brake type: can turn on one locked track
    steerRatio: 0.45,
    rollCoef: 0.032,
    trackMu: 0.75,
    lateralMu: 0.55,
    brakeForce: 190000,
    shiftTime: 1.0,
    turret: { traverse: 14, traverseAccel: 25, manualTraverse: 3, elevation: [-8, 20], elevRate: 4, stabilizer: false, powered: 'electric' },
    gun: {
      name: '7.5 cm KwK 40 L/48',
      ammo: ['PzGr 39', 'SprGr 34'],
      stowed: { 'PzGr 39': 50, 'SprGr 34': 37 },
      reload: 3.3,
      sight: { name: 'TZF 5f', mag: 2.5, fieldDeg: 25, reticle: 'german', ranges: [0, 3000, 100] },
    },
    seats: [
      { name: 'Driver and gunner', anchor: 'gunnerEye', eye: true, role: 'gunner' },
      { name: 'Bow machine gunner', anchor: 'bowMgMuzzle', eye: true, offset: [0.0, 0.2, 0.75], role: 'bowMg' },
    ],
    coax: { name: 'MG 34 coaxial', ammo: '792 sS', rpm: 850, belt: 150, belts: 20, tracerEvery: 3, muzzle: 'coaxMuzzle', sound: 'mg34' },
    bowMg: { name: 'MG 34 bow MG (Kugelblende 50)', ammo: '792 sS', rpm: 850, belt: 150, belts: 14, tracerEvery: 3, muzzle: 'bowMgMuzzle', traverse: 20, elev: [-10, 20], sound: 'mg34', sight: { mag: 1.75, fieldDeg: 18 } },
    hp: 1700,
    crew: 5,
    info: 'The workhorse German medium tank. The long 75 mm gun hits hard and accurately; the thin side armor does not stop much.',
  },
  t34_76: {
    name: 'T-34/76 (1942)',
    faction: 'SU',
    kind: 'tracked',
    mass: 28500,
    dims: [3.0, 1.9, 6.68],
    inertiaScale: 0.75,
    cg: [0, 0.9, 0.2],
    roadWheelRadius: 0.415,
    trackWidth: 0.55,
    trackCenters: 2.45,
    contactLength: 3.84,
    sprocketRadius: 0.33,
    roadWheels: 5,
    trackMass: 1500,
    suspension: { k: 260000, c: 15000, droop: 0.1, bump: 0.13 }, // Christie coil springs, 5 big wheels a side: long travel
    engine: {
      name: 'V-2-34 V12 diesel, 500 hp',
      idle: 600,
      redline: 1800,
      torque: [
        [600, 1700],
        [1000, 2000],
        [1300, 2160],
        [1600, 2100],
        [1800, 1980],
      ],
      inertia: 3.0,
      sound: 'engineTankDiesel',
      cylinders: 12,
    },
    gears: [5.35, 2.84, 1.53, 0.74], // 4-speed (est.)
    reverse: 5.35,
    finalDrive: 5.7, // 53 km/h at 1800 rpm in 4th
    efficiency: 0.78,
    steering: 'clutchBrake',
    steerRatio: 0.55,
    rollCoef: 0.03,
    trackMu: 0.8,
    lateralMu: 0.55,
    brakeForce: 210000,
    shiftTime: 1.2,
    turret: { traverse: 25, traverseAccel: 40, manualTraverse: 3, elevation: [-5, 30], elevRate: 5, stabilizer: false, powered: 'electric' },
    gun: {
      name: '76.2 mm F-34 L/41.5',
      ammo: ['BR-350A', 'OF-350'],
      stowed: { 'BR-350A': 45, 'OF-350': 32 },
      reload: 3.2,
      sight: { name: 'TMFD-7', mag: 2.5, fieldDeg: 15, reticle: 'soviet', ranges: [0, 4000, 100] },
    },
    seats: [
      { name: 'Driver and gunner', anchor: 'gunnerEye', eye: true, role: 'gunner' },
      { name: 'Bow machine gunner', anchor: 'bowMgMuzzle', eye: true, offset: [0.0, 0.2, 0.75], role: 'bowMg' },
    ],
    coax: { name: 'DT coaxial MG', ammo: '762x54R L', rpm: 600, belt: 63, belts: 30, tracerEvery: 4, muzzle: 'coaxMuzzle', sound: 'dp28' },
    bowMg: { name: 'DT bow MG', ammo: '762x54R L', rpm: 600, belt: 63, belts: 20, tracerEvery: 4, muzzle: 'bowMgMuzzle', traverse: 12, elev: [-6, 12], sound: 'dp28' },
    hp: 1700,
    crew: 4,
    info: 'Fast, wide-tracked and well sloped. Superb in mud; cramped inside, with a slow-working two-man turret.',
  },
};

// Tank gun ammunition. penRefMM = armor penetration at 0 degrees at penRefVel
// (from 100 m figures); HE shells carry their explosive mass. Checks: M61 gives
// about 81 mm at 500 yd (US data: 3.2 in), BR-350A 73 mm at 500 m (Soviet
// tables), PzGr 39 from the KwK 40 L/48 about 106 mm at 100 m against 30 degrees.
export const SHELLS = {
  'M61 APC': { name: 'M61 APC', diameter: 0.075, mass: 6.79, mv: 619, bc: 2.0, drag: 'G2', penRefMM: 88, penRefVel: 610, capped: true, filler: 0.064, maxAge: 12 },
  'M48 HE': { name: 'M48 HE', diameter: 0.075, mass: 6.66, mv: 463, bc: 1.8, drag: 'G2', explosive: { blast: 0.67, radius: 8, frag: 10, fragments: 60 }, maxAge: 14 },
  'PzGr 39': { name: 'PzGr. 39 APCBC-HE', diameter: 0.075, mass: 6.8, mv: 790, bc: 2.3, drag: 'G2', penRefMM: 128, penRefVel: 780, capped: true, filler: 0.018, maxAge: 12 },
  'SprGr 34': { name: 'SprGr. 34 HE', diameter: 0.075, mass: 5.74, mv: 550, bc: 1.7, drag: 'G2', explosive: { blast: 0.68, radius: 8, frag: 10, fragments: 60 }, maxAge: 14 },
  'BR-350A': { name: 'BR-350A APHE', diameter: 0.0762, mass: 6.3, mv: 662, bc: 1.9, drag: 'G2', penRefMM: 82, penRefVel: 655, capped: false, filler: 0.155, maxAge: 12 },
  'OF-350': { name: 'OF-350 HE-Frag', diameter: 0.0762, mass: 6.2, mv: 680, bc: 1.8, drag: 'G2', explosive: { blast: 0.62, radius: 8, frag: 12, fragments: 60 }, maxAge: 14 },
};
for (const [k, v] of Object.entries(SHELLS)) v.id = k;
