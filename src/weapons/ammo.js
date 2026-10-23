// Ammunition: real WWII service loads. Units: meters, kilograms, m/s.
// diameter = bullet diameter; mass = bullet (projectile) mass; mv = typical muzzle
// velocity (each weapon can override it for its own barrel length); bc = ballistic
// coefficient (lb/in^2) against the named drag model; powder = propellant mass
// (only used to compute recoil); hardness > 1 for steel-cored AP bullets.
// Values marked "est." are estimates where no published figure was found.
//
// Main sources: US FM 23-5 / TM 9-1990, German s.S. data (Wikipedia: 7.92x57mm
// Mauser), Soviet NSD manuals as summarized by Wikipedia, and common ballistics
// references. See docs/RESEARCH.md for the full table with notes.

const GR = 0.00006479891; // grains to kg

export const AMMO = {
  // --- Rifle and machine-gun cartridges -------------------------------------
  '30-06 M2': {
    name: '.30-06 Ball M2',
    caliber: '.30-06 Springfield',
    diameter: 0.00782,
    mass: 152 * GR,
    mv: 853,
    bc: 0.4, // flat-base 152 gr spitzer, G1 (est. 0.39-0.41)
    drag: 'G1',
    powder: 50 * GR,
    tracerBurn: 900,
  },
  '30-06 M2 AP': {
    name: '.30-06 AP M2',
    caliber: '.30-06 Springfield',
    diameter: 0.00782,
    mass: 166 * GR,
    mv: 844,
    bc: 0.42,
    drag: 'G1',
    powder: 50 * GR,
    hardness: 2.5,
    penRefMM: 10.7, // 0.42 in of armor plate at 100 yd (FM 23-5)
    penRefVel: 800,
  },
  '792 sS': {
    name: '7.92 mm s.S. Patrone',
    caliber: '7.92x57mm Mauser',
    diameter: 0.00822,
    mass: 0.0128,
    mv: 760,
    bc: 0.57, // boat-tail, G1 0.557-0.593 in published sources
    drag: 'G1',
    powder: 0.00285, // est.
    tracerBurn: 1000,
  },
  '762x54R L': {
    name: '7.62 mm Type L light ball',
    caliber: '7.62x54mmR',
    diameter: 0.00792,
    mass: 0.0096,
    mv: 865,
    bc: 0.37, // flat-base spitzer (est.)
    drag: 'G1',
    powder: 0.0031, // est.
    tracerBurn: 1000,
  },
  '792 Kurz': {
    name: '7.92 mm Pistolenpatrone 43',
    caliber: '7.92x33mm Kurz',
    diameter: 0.00822,
    mass: 0.0081,
    mv: 685,
    bc: 0.29, // est.
    drag: 'G1',
    powder: 0.00157,
  },
  '30 Carbine': {
    name: '.30 Carbine Ball M1',
    caliber: '.30 Carbine',
    diameter: 0.00782,
    mass: 110 * GR,
    mv: 607,
    bc: 0.166, // round nose
    drag: 'G1',
    powder: 13.5 * GR,
  },
  // --- Pistol cartridges -----------------------------------------------------
  '9 Para': {
    name: '9 mm Pistolenpatrone 08',
    caliber: '9x19mm Parabellum',
    diameter: 0.00902,
    mass: 0.008,
    mv: 360,
    bc: 0.15,
    drag: 'G1',
    powder: 0.00036,
  },
  '45 ACP': {
    name: '.45 Ball M1911',
    caliber: '.45 ACP',
    diameter: 0.01148,
    mass: 230 * GR,
    mv: 253,
    bc: 0.16,
    drag: 'G1',
    powder: 5 * GR,
  },
  '762x25': {
    name: '7.62 mm Type P',
    caliber: '7.62x25mm Tokarev',
    diameter: 0.00785,
    mass: 0.0055,
    mv: 420,
    bc: 0.15, // est.
    drag: 'G1',
    powder: 0.00052,
  },
  '762x38R': {
    name: '7.62 mm Nagant revolver',
    caliber: '7.62x38mmR',
    diameter: 0.0075,
    mass: 0.007,
    mv: 272,
    bc: 0.12, // est.
    drag: 'G1',
    powder: 0.00025,
  },
  '32 ACP': {
    name: '.32 ACP Ball',
    caliber: '.32 ACP / 7.65 mm Browning',
    diameter: 0.00794,
    mass: 0.0047,
    mv: 285,
    bc: 0.11,
    drag: 'G1',
    powder: 0.00017,
  },
  // --- Anti-tank rifles --------------------------------------------------------
  '145 B32': {
    name: '14.5 mm B-32 API',
    caliber: '14.5x114mm',
    diameter: 0.01488,
    mass: 0.064,
    mv: 1012,
    bc: 0.65, // est.
    drag: 'G1',
    powder: 0.03,
    hardness: 3,
    penRefMM: 40, // about 40 mm at 100 m, 0 degrees
    penRefVel: 980,
  },
  '792x94': {
    name: '7.92 mm Patrone 318 S.m.K.H.',
    caliber: '7.92x94mm',
    diameter: 0.00822,
    mass: 0.0146,
    mv: 1210,
    bc: 0.45, // est.
    drag: 'G1',
    powder: 0.0145,
    hardness: 3,
    penRefMM: 30, // about 30 mm at 100 m, 0 degrees
    penRefVel: 1150,
  },
  // --- Rockets and shaped-charge (HEAT) weapons ---------------------------------
  'M6A1 rocket': {
    name: '2.36 in Rocket M6A1 (HEAT)',
    diameter: 0.06,
    mass: 1.59,
    mv: 82,
    bc: 0.4,
    drag: 'G1',
    heat: true,
    penetrationMM: 90,
    explosive: { blast: 0.23, radius: 4, frag: 6 },
    maxAge: 6,
    tracer: true,
  },
  'RPzBGr 4322': {
    name: '8.8 cm R.Pz.B.Gr. 4322 (HEAT)',
    diameter: 0.088,
    mass: 3.25,
    mv: 110,
    bc: 0.55,
    drag: 'G1',
    heat: true,
    penetrationMM: 160,
    explosive: { blast: 0.66, radius: 5, frag: 7 },
    maxAge: 6,
    tracer: true,
  },
  'PzF 60': {
    name: 'Panzerfaust 60 warhead (HEAT)',
    diameter: 0.149,
    mass: 3.0,
    mv: 45,
    bc: 0.3,
    drag: 'G1',
    heat: true,
    penetrationMM: 200,
    explosive: { blast: 0.8, radius: 5, frag: 5 },
    maxAge: 6,
  },
  // --- Thrown grenades ---------------------------------------------------------
  'Mk II': {
    name: 'Mk II fragmentation grenade',
    diameter: 0.058,
    mass: 0.6,
    bc: 0.02,
    drag: 'G1',
    thrown: true,
    fuseTime: 4.5, // M204 / M6A4C fuze: 4-5 s
    explosive: { blast: 0.057, radius: 6, frag: 15, fragments: 300 },
    maxAge: 30,
  },
  'Stg 24': {
    name: 'Stielhandgranate 24',
    diameter: 0.07,
    mass: 0.595,
    bc: 0.03,
    drag: 'G1',
    thrown: true,
    fuseTime: 4.5,
    explosive: { blast: 0.17, radius: 7, frag: 6, fragments: 60 }, // mostly blast, thin case
    maxAge: 30,
  },
  'RGD-33': {
    name: 'RGD-33 with fragmentation sleeve',
    diameter: 0.055,
    mass: 0.75,
    bc: 0.02,
    drag: 'G1',
    thrown: true,
    fuseTime: 3.6,
    explosive: { blast: 0.085, radius: 6, frag: 15, fragments: 250 },
    maxAge: 30,
  },
};

export function getAmmo(id) {
  const a = AMMO[id];
  if (!a) throw new Error(`Unknown ammunition ${id}`);
  return a;
}

// Tracer variant of a ball round: same flight, glows until burnout.
export function tracerOf(id) {
  const a = getAmmo(id);
  return { ...a, tracer: true };
}
