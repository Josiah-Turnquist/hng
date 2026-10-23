// Weapon sounds: gunshots near and far, outdoor echo tails, and bullets in flight
// (supersonic crack, subsonic whiz, ricochet).
//
// A close gunshot is built from the physics of the report:
//  - the muzzle blast is a Friedlander shock pulse (the sharp front of the report),
//  - the propellant gas jet adds a pitched-down low "boom" and decaying turbulent noise,
//  - a supersonic bullet adds a high-frequency snap as it leaves the muzzle,
//  - the ground reflection arrives a few milliseconds later (a darker copy), and
//    nearby surfaces slap back within ~50 ms,
//  - the overload of ears and microphones is modeled with soft saturation,
//  - self-loading actions add their metallic clank a few tens of ms after the shot,
//  - the outdoors answers with a rolling, darkening rumble (the reverb bus adds more).
// Far away (200-800 m) the air strips the highs and the ground absorbs a band in
// the low mids, so the report arrives as a "pop" or "thud", and the terrain's
// echoes keep rolling for seconds.
import {
  RATIOS,
  SVF,
  TAU,
  blastPulse,
  buffer,
  clamp,
  dcBlock,
  echoes,
  fade,
  filter,
  lowpass1,
  nSamples,
  nWave,
  noiseBurst,
  noiseGrain,
  normalize,
  reflect,
  rumble,
  saturate,
  scatter,
  scrape,
  spring,
  strike,
  tone,
} from '../dsp.js';

export const GUN_TYPES = [
  'rifle',
  'rifleSemi',
  'intermediate',
  'carbine',
  'smg9',
  'smg45',
  'smgTokarev',
  'mg',
  'pistol',
  'revolver',
  'atRifle',
  'rocket',
  'panzerfaust',
  'tankGun',
];

// Near report parameters (shooter's position).
// T: positive phase of the muzzle blast (s); boom: [start Hz, end Hz, decay s, amp];
// jet: gas-jet noise [start cutoff, end cutoff, fast decay, slow decay, amp];
// snap: supersonic high-frequency crack; drive: overload; ground: [delay s, gain];
// slaps: nearby reflections; tail: [amp, decay s]; action: mechanical layer.
const RIFLE = {
  dur: 0.9,
  level: 0.98,
  T: 0.0018,
  boom: [125, 48, 0.055, 0.85],
  jet: [11000, 1300, 0.006, 0.045, 0.75],
  snap: 0.5,
  drive: 2.4,
  ground: [0.0042, 0.55],
  slaps: 3,
  tail: [0.14, 0.22],
  action: null,
};

const NEAR = {
  rifle: RIFLE,
  rifleSemi: { ...RIFLE, level: 0.96, action: 'semi' },
  intermediate: {
    dur: 0.75,
    level: 0.95,
    T: 0.0014,
    boom: [140, 58, 0.04, 0.7],
    jet: [10500, 1500, 0.005, 0.035, 0.7],
    snap: 0.55,
    drive: 2.2,
    ground: [0.004, 0.5],
    slaps: 3,
    tail: [0.12, 0.18],
    action: 'assault',
  },
  carbine: {
    dur: 0.7,
    level: 0.9,
    T: 0.0012,
    boom: [160, 72, 0.032, 0.55],
    jet: [10000, 1600, 0.0045, 0.03, 0.65],
    snap: 0.5,
    drive: 2.0,
    ground: [0.004, 0.5],
    slaps: 3,
    tail: [0.11, 0.16],
    action: 'carbine',
  },
  smg9: {
    dur: 0.5,
    level: 0.86,
    T: 0.001,
    boom: [185, 90, 0.024, 0.5],
    jet: [8000, 1300, 0.004, 0.022, 0.6],
    snap: 0.3,
    drive: 1.9,
    ground: [0.004, 0.45],
    slaps: 2,
    tail: [0.09, 0.12],
    action: 'openBolt',
  },
  smg45: {
    dur: 0.5,
    level: 0.86,
    T: 0.0012,
    boom: [145, 66, 0.03, 0.68],
    jet: [5200, 850, 0.005, 0.026, 0.55],
    snap: 0.12,
    drive: 1.8,
    ground: [0.004, 0.45],
    slaps: 2,
    tail: [0.09, 0.12],
    action: 'openBoltHeavy',
  },
  smgTokarev: {
    dur: 0.45,
    level: 0.9,
    T: 0.0007,
    boom: [230, 120, 0.016, 0.38],
    jet: [13500, 2600, 0.0035, 0.016, 0.72],
    snap: 0.8,
    drive: 2.0,
    ground: [0.004, 0.45],
    slaps: 2,
    tail: [0.09, 0.1],
    action: 'openBoltLight',
  },
  mg: {
    dur: 0.32,
    level: 0.98,
    T: 0.0017,
    boom: [125, 55, 0.03, 0.8],
    jet: [11000, 1600, 0.005, 0.024, 0.75],
    snap: 0.5,
    drive: 2.4,
    ground: [0.0042, 0.5],
    slaps: 1,
    tail: [0.07, 0.06],
    action: 'mg',
  },
  pistol: {
    dur: 0.6,
    level: 0.86,
    T: 0.0008,
    boom: [210, 110, 0.018, 0.4],
    jet: [9000, 1800, 0.003, 0.016, 0.65],
    snap: 0.45,
    drive: 1.9,
    ground: [0.0035, 0.45],
    slaps: 3,
    tail: [0.1, 0.14],
    action: 'slide',
  },
  revolver: {
    dur: 0.65,
    level: 0.88,
    T: 0.001,
    boom: [180, 85, 0.024, 0.5],
    jet: [8500, 1500, 0.004, 0.022, 0.7],
    snap: 0.5,
    drive: 2.0,
    ground: [0.0035, 0.45],
    slaps: 3,
    tail: [0.1, 0.15],
    action: 'revolver',
  },
  atRifle: {
    dur: 1.6,
    level: 0.98,
    T: 0.0032,
    boom: [92, 32, 0.09, 1.0],
    jet: [12000, 1000, 0.01, 0.08, 0.9],
    snap: 0.7,
    drive: 3.0,
    ground: [0.0045, 0.6],
    slaps: 4,
    tail: [0.22, 0.32],
    action: 'ptrd',
    brake: true,
  },
};

// Mechanical action layers, relative to the (saturated) blast at full scale.
const ACTIONS = {
  // Gas-operated self-loaders (M1 Garand, G 43, SVT-40): the operating rod or bolt
  // carrier slams back, the case flies out, and the bolt runs home again.
  semi(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.016, 0.022), { amp: 0.09, f: 2100, tau: 0.012, thump: 0.25, thumpF: 260 });
    strike(out, rng, sr, at + rng.range(0.026, 0.032), { amp: 0.04, f: 5200, tau: 0.035, ratios: RATIOS.brass, click: 0.2, modes: 4 });
    scrape(out, rng, sr, { at: at + 0.03, dur: 0.022, amp: 0.02, f: 2600, grains: 0 });
    strike(out, rng, sr, at + rng.range(0.05, 0.06), { amp: 0.12, f: 1850, tau: 0.014, thump: 0.3, thumpF: 240 });
  },
  // StG 44: bolt carrier plus the long recoil spring in the stock, which rings.
  assault(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.02, 0.026), { amp: 0.08, f: 2300, tau: 0.01, thump: 0.2 });
    spring(out, rng, sr, at + 0.024, { f: rng.range(1300, 1700), amp: 0.035, tau: 0.09 });
    strike(out, rng, sr, at + rng.range(0.055, 0.065), { amp: 0.1, f: 2000, tau: 0.012, thump: 0.25 });
  },
  carbine(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.013, 0.017), { amp: 0.06, f: 2800, tau: 0.008 });
    strike(out, rng, sr, at + rng.range(0.034, 0.04), { amp: 0.08, f: 2500, tau: 0.009, thump: 0.15 });
  },
  // MP 40: open bolt; the heavy bolt hits its buffer at the rear of the receiver.
  openBolt(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.03, 0.036), { amp: 0.13, f: 1500, tau: 0.01, thump: 0.45, thumpF: 200, modes: 4 });
    spring(out, rng, sr, at + 0.03, { f: 900, amp: 0.015, tau: 0.04 });
  },
  // Thompson / M3: heavier, slower bolt, the "chug" of .45 SMGs.
  openBoltHeavy(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.034, 0.042), { amp: 0.17, f: 1100, tau: 0.012, thump: 0.6, thumpF: 160, modes: 4 });
  },
  // PPSh-41: light, fast bolt in a stamped receiver: tinny.
  openBoltLight(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.022, 0.028), { amp: 0.11, f: 2600, tau: 0.007, thump: 0.25, thumpF: 260 });
  },
  // Machine guns: bolt and belt feed pawl, kept very short for 900-1200 rpm.
  mg(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.016, 0.02), { amp: 0.07, f: 2000, tau: 0.006, thump: 0.2, modes: 4 });
    strike(out, rng, sr, at + 0.026, { amp: 0.04, f: 4200, tau: 0.004, click: 0.4, modes: 3 });
  },
  slide(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.01, 0.014), { amp: 0.1, f: 2700, tau: 0.008 });
    strike(out, rng, sr, at + rng.range(0.03, 0.036), { amp: 0.13, f: 2300, tau: 0.01, thump: 0.15 });
  },
  // Nothing cycles in a revolver; the frame rings a little.
  revolver(out, rng, sr, at) {
    strike(out, rng, sr, at + 0.002, { amp: 0.04, f: 3100, tau: 0.02, click: 0 });
  },
  // PTRD: the recoiling barrel cams the bolt open and throws out the huge 14.5 mm case.
  ptrd(out, rng, sr, at) {
    strike(out, rng, sr, at + rng.range(0.09, 0.11), { amp: 0.16, f: 1200, tau: 0.018, thump: 0.5, thumpF: 150 });
    strike(out, rng, sr, at + rng.range(0.12, 0.13), { amp: 0.07, f: 1700, tau: 0.12, ratios: RATIOS.brass, click: 0.2, modes: 5 });
  },
};

function nearReport(p, rng, sr) {
  const out = buffer(p.dur, sr);
  const at = 0.0008;
  const v = (x, f = 0.07) => rng.vary(x, f);
  blastPulse(out, sr, { at, T: v(p.T), amp: 1, b: 1.25, rise: 1 / sr });
  const [bf0, bf1, bt, ba] = p.boom;
  tone(out, sr, { at, f: v(bf0), f1: v(bf1), glide: bt * 0.7, attack: 0.0008, decay: v(bt, 0.1), amp: ba, h2: 0.2 });
  const [jf0, jf1, jt1, jt2, ja] = p.jet;
  noiseBurst(out, rng, sr, { at, attack: 0.0002, decay: v(jt1), amp: ja * 0.75, filter: 'lp', f: jf0, f1: jf1, glide: jt2 * 0.4, q: 0.6 });
  noiseBurst(out, rng, sr, {
    at: at + 0.0005,
    attack: 0.002,
    decay: v(jt2),
    amp: ja * 0.4,
    filter: 'lp',
    f: jf0 * 0.5,
    f1: jf1 * 0.6,
    glide: jt2,
    q: 0.8,
    color: 'pink',
  });
  if (p.snap) noiseBurst(out, rng, sr, { at, attack: 0.00004, decay: 0.0009, amp: p.snap, filter: 'hp', f: 3000 });
  // A muzzle brake throws the gas sideways, toward the shooter: harsher and louder.
  if (p.brake) noiseBurst(out, rng, sr, { at: at + 0.0004, attack: 0.0005, decay: 0.012, amp: 0.6, filter: 'bp', f: 2500, f1: 1200, glide: 0.01, q: 0.7 });
  reflect(out, sr, v(p.ground[0], 0.25), p.ground[1], 6000, 0.12);
  for (let k = 0; k < p.slaps; k++) reflect(out, sr, rng.range(0.007, 0.05), rng.range(0.07, 0.18), 2800, 0.1);
  saturate(out, p.drive, 0, Math.min(out.length, nSamples(0.25, sr)));
  if (p.action) ACTIONS[p.action](out, rng, sr, at);
  rumble(out, rng, sr, {
    at: at + 0.004,
    attack: 0.015,
    decay: v(p.tail[1]),
    amp: p.tail[0],
    f: 3200,
    f1: 420,
    glide: p.tail[1] * 0.8,
    roll: 9,
    rollDepth: 0.55,
  });
  dcBlock(out, sr, 16);
  fade(out, sr, 0, Math.min(0.08, p.dur * 0.15));
  return normalize(out, p.level);
}

// Bazooka / Panzerschreck: ignition pop, the rocket motor's ripping roar while it
// burns (it burns out within the first meters), the back-blast "whump", and the
// rocket hissing away with falling (Doppler) pitch.
function rocketLaunch(rng, sr) {
  const out = buffer(1.6, sr);
  const at = 0.001;
  blastPulse(out, sr, { at, T: 0.0015, amp: 0.5, b: 1.3, rise: 1 / sr });
  const burn = rng.range(0.1, 0.14);
  noiseBurst(out, rng, sr, { at, attack: 0.004, hold: burn, decay: 0.05, amp: 0.9, filter: 'bp', f: 2600, f1: 1100, glide: burn, q: 0.8 });
  noiseBurst(out, rng, sr, { at, attack: 0.002, hold: burn * 0.8, decay: 0.06, amp: 0.7, filter: 'lp', f: 900, q: 0.7, color: 'pink' });
  scatter(rng, at, at + burn, 900, (t) => noiseGrain(out, rng, nSamples(t, sr), rng.int(4, 20), rng.pareto(1.3, 0.1) * 0.8));
  tone(out, sr, { at, f: 95, f1: 42, glide: 0.06, attack: 0.002, decay: 0.07, amp: 0.8, h2: 0.2 });
  saturate(out, 1.8, 0, nSamples(0.3, sr));
  noiseBurst(out, rng, sr, { at: at + burn * 0.8, attack: 0.03, decay: 0.32, amp: 0.3, filter: 'bp', f: 2200, f1: 700, glide: 0.35, q: 1.2 });
  strike(out, rng, sr, at + 0.002, { amp: 0.06, f: rng.range(420, 520), tau: 0.12, modes: 4, ratios: RATIOS.can, click: 0 });
  rumble(out, rng, sr, { at: at + 0.02, attack: 0.03, decay: 0.32, amp: 0.13, f: 2200, f1: 350, glide: 0.3, roll: 6, rollDepth: 0.5 });
  dcBlock(out, sr, 16);
  fade(out, sr, 0, 0.1);
  return normalize(out, 0.9);
}

// Panzerfaust: a recoilless gun. The propellant charge in the tube goes off with a
// heavy boom and a roaring back-blast, then the slow warhead whooshes away.
function panzerfaustLaunch(rng, sr) {
  const out = buffer(1.5, sr);
  const at = 0.001;
  blastPulse(out, sr, { at, T: rng.vary(0.004, 0.1), amp: 1, b: 1.2, rise: 1 / sr });
  tone(out, sr, { at, f: rng.vary(95, 0.06), f1: 38, glide: 0.08, attack: 0.001, decay: 0.11, amp: 1.0, h2: 0.25 });
  noiseBurst(out, rng, sr, { at, attack: 0.0002, decay: 0.012, amp: 0.7, filter: 'lp', f: 9000, f1: 900, glide: 0.03, q: 0.6 });
  noiseBurst(out, rng, sr, { at, attack: 0.003, decay: 0.09, amp: 0.5, filter: 'lp', f: 3000, f1: 500, glide: 0.08, q: 0.7, color: 'pink' });
  noiseBurst(out, rng, sr, { at: at + 0.002, attack: 0.005, decay: 0.16, amp: 0.4, filter: 'bp', f: 1500, f1: 600, glide: 0.15, q: 0.8 });
  scatter(rng, at, at + 0.15, 500, (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(4, 16), rng.pareto(1.3, 0.1) * 0.6 * (1 - u)));
  reflect(out, sr, 0.0045, 0.55, 5000, 0.15);
  saturate(out, 2.6, 0, nSamples(0.3, sr));
  strike(out, rng, sr, at + 0.003, { amp: 0.05, f: 380, tau: 0.08, ratios: RATIOS.can, click: 0, modes: 4 });
  rumble(out, rng, sr, { at: at + 0.006, attack: 0.02, decay: 0.35, amp: 0.2, f: 2500, f1: 300, glide: 0.3, roll: 5, rollDepth: 0.55 });
  noiseBurst(out, rng, sr, { at: at + 0.2, attack: 0.08, decay: 0.3, amp: 0.06, filter: 'bp', f: 1200, f1: 500, glide: 0.4, q: 1.2 });
  dcBlock(out, sr, 16);
  fade(out, sr, 0, 0.1);
  return normalize(out, 0.98);
}

// 75-88 mm tank gun from the crew's position: enormous blast, ground and hull
// shake, a long rolling rumble with echoes, then the semi-automatic breech flies
// open and throws out the hot case with a clang.
function tankGunNear(rng, sr) {
  const out = buffer(3.4, sr);
  const at = 0.001;
  blastPulse(out, sr, { at, T: rng.vary(0.006, 0.1), amp: 1, b: 1.15, rise: 1 / sr });
  tone(out, sr, { at, f: rng.vary(75, 0.06), f1: 26, glide: 0.15, attack: 0.001, decay: 0.2, amp: 1.0, h2: 0.25 });
  tone(out, sr, { at, f: 32, f1: 21, glide: 0.4, attack: 0.02, decay: 0.6, amp: 0.55 });
  noiseBurst(out, rng, sr, { at, attack: 0.0002, decay: 0.02, amp: 0.8, filter: 'lp', f: 12000, f1: 700, glide: 0.05, q: 0.6 });
  noiseBurst(out, rng, sr, { at, attack: 0.004, decay: 0.15, amp: 0.55, filter: 'lp', f: 4000, f1: 300, glide: 0.15, q: 0.7, color: 'pink' });
  noiseBurst(out, rng, sr, { at, attack: 0.00004, decay: 0.003, amp: 0.6, filter: 'hp', f: 3000 });
  reflect(out, sr, 0.006, 0.6, 5000, 0.3);
  for (let k = 0; k < 4; k++) reflect(out, sr, rng.range(0.012, 0.08), rng.range(0.1, 0.22), 2000, 0.25);
  saturate(out, 3.2, 0, nSamples(0.6, sr));
  rumble(out, rng, sr, { at: at + 0.02, attack: 0.04, decay: 0.9, amp: 0.3, f: 1500, f1: 120, glide: 0.8, roll: 2.5, rollDepth: 0.6, color: 'brown' });
  echoes(out, rng, sr, { at, count: 8, first: 0.25, last: 2.8, amp: 0.3, fc: 900, smear: 0.05, thump: 45 });
  const tb = rng.range(0.4, 0.5);
  strike(out, rng, sr, at + tb, { amp: 0.18, f: 380, tau: 0.08, thump: 0.6, thumpF: 110, modes: 6 });
  strike(out, rng, sr, at + tb + 0.08, { amp: 0.12, f: 900, tau: 0.25, ratios: RATIOS.brass, click: 0.3, modes: 5 });
  strike(out, rng, sr, at + tb + 0.45, { amp: 0.1, f: 760, tau: 0.2, ratios: RATIOS.brass, click: 0.5, modes: 5, thump: 0.3 });
  dcBlock(out, sr, 14);
  fade(out, sr, 0, 0.3);
  return normalize(out, 0.98);
}

// Far report parameters: T: blast pulse length (stretched by distance);
// fc: what the air leaves of the highs; boom: [start, end Hz, decay, amp];
// tail: rolling rumble [amp, decay]; echoes: count; echoFc: echo darkness.
const FAR = {
  rifle: { dur: 2.6, level: 0.9, T: 0.0035, fc: 3400, boom: [88, 48, 0.07, 0.5], tail: [0.3, 0.75], echoes: 10, echoFc: 1300 },
  intermediate: { dur: 2.4, level: 0.85, T: 0.003, fc: 3600, boom: [95, 52, 0.06, 0.42], tail: [0.27, 0.65], echoes: 9, echoFc: 1400 },
  carbine: { dur: 2.2, level: 0.8, T: 0.0026, fc: 3700, boom: [100, 58, 0.05, 0.38], tail: [0.24, 0.6], echoes: 8, echoFc: 1500 },
  smg9: { dur: 2.0, level: 0.75, T: 0.0022, fc: 2900, boom: [110, 62, 0.045, 0.42], tail: [0.2, 0.5], echoes: 7, echoFc: 1300 },
  smg45: { dur: 2.0, level: 0.75, T: 0.0028, fc: 2300, boom: [95, 52, 0.05, 0.5], tail: [0.2, 0.5], echoes: 7, echoFc: 1100 },
  smgTokarev: { dur: 2.0, level: 0.78, T: 0.0018, fc: 4300, boom: [120, 68, 0.038, 0.32], tail: [0.2, 0.5], echoes: 7, echoFc: 1600 },
  pistol: { dur: 1.8, level: 0.72, T: 0.002, fc: 3200, boom: [115, 62, 0.04, 0.36], tail: [0.18, 0.45], echoes: 6, echoFc: 1400 },
  atRifle: { dur: 3.2, level: 0.95, T: 0.006, fc: 2800, boom: [70, 34, 0.1, 0.75], tail: [0.38, 1.0], echoes: 12, echoFc: 1000 },
  panzerfaust: { dur: 2.8, level: 0.9, T: 0.0065, fc: 2000, boom: [72, 36, 0.11, 0.8], tail: [0.36, 0.9], echoes: 10, echoFc: 900 },
  tankGun: { dur: 4.5, level: 0.98, T: 0.012, fc: 1300, boom: [55, 26, 0.16, 1.0], tail: [0.45, 1.3], echoes: 12, echoFc: 650, sub: true },
};

// Which far report and echo tail each weapon type uses (similar weapons share).
export const FAR_OF = {
  rifle: 'rifle',
  rifleSemi: 'rifle',
  mg: 'rifle',
  intermediate: 'intermediate',
  carbine: 'carbine',
  smg9: 'smg9',
  smg45: 'smg45',
  smgTokarev: 'smgTokarev',
  pistol: 'pistol',
  revolver: 'pistol',
  atRifle: 'atRifle',
  rocket: 'rocket',
  panzerfaust: 'panzerfaust',
  tankGun: 'tankGun',
};

export const ECHO_OF = {
  rifle: 'medium',
  rifleSemi: 'medium',
  mg: 'medium',
  intermediate: 'medium',
  carbine: 'medium',
  smg9: 'light',
  smg45: 'light',
  smgTokarev: 'light',
  pistol: 'light',
  revolver: 'light',
  atRifle: 'heavy',
  rocket: 'heavy',
  panzerfaust: 'heavy',
  tankGun: 'heavy',
};

function farReport(p, rng, sr) {
  const out = buffer(p.dur, sr);
  const at = 0.003;
  const head = Math.min(out.length, nSamples(0.3, sr));
  blastPulse(out, sr, { at, T: rng.vary(p.T, 0.1), amp: 1, b: 1.15, rise: 2 / sr });
  noiseBurst(out, rng, sr, { at, attack: 0.0004, decay: 0.005, amp: 0.45, filter: 'lp', f: p.fc * 1.3, q: 0.7 });
  const [b0, b1, bt, ba] = p.boom;
  tone(out, sr, { at, f: rng.vary(b0, 0.08), f1: b1, glide: bt, attack: 0.003, decay: rng.vary(bt, 0.1), amp: ba });
  // Air absorption (highs) and ground absorption (a dip in the low mids).
  filter(out, sr, 'lowpass', rng.vary(p.fc, 0.1), 0.65, 0, 0, head);
  filter(out, sr, 'peaking', rng.range(380, 650), 0.9, -6, 0, head);
  rumble(out, rng, sr, {
    at: at + 0.012,
    attack: 0.06,
    decay: rng.vary(p.tail[1], 0.12),
    amp: p.tail[0],
    f: 1300,
    f1: 220,
    glide: p.tail[1],
    roll: 3.2,
    rollDepth: 0.65,
    color: 'brown',
  });
  echoes(out, rng, sr, {
    at,
    count: p.echoes,
    first: 0.1,
    last: p.dur * 0.75,
    amp: p.tail[0] * 1.4,
    decay: p.dur * 0.35,
    fc: p.echoFc,
    smear: 0.035,
    thump: b1 * 1.4,
  });
  if (p.sub) tone(out, sr, { at, f: 30, f1: 22, glide: 0.3, attack: 0.03, decay: 0.7, amp: 0.4 });
  dcBlock(out, sr, 18);
  fade(out, sr, 0, 0.3);
  return normalize(out, p.level);
}

// A rocket launch heard from afar: a dull "whoomp" and a fading hiss.
function rocketFar(rng, sr) {
  const out = buffer(2.2, sr);
  const at = 0.003;
  blastPulse(out, sr, { at, T: 0.004, amp: 0.6, b: 1.2, rise: 2 / sr });
  tone(out, sr, { at, f: 80, f1: 45, glide: 0.08, attack: 0.004, decay: 0.08, amp: 0.6 });
  noiseBurst(out, rng, sr, { at, attack: 0.01, hold: 0.1, decay: 0.12, amp: 0.45, filter: 'bp', f: 1100, f1: 600, glide: 0.2, q: 0.8 });
  filter(out, sr, 'lowpass', 1600, 0.7, 0, 0, nSamples(0.5, sr));
  rumble(out, rng, sr, { at: at + 0.02, attack: 0.06, decay: 0.5, amp: 0.2, f: 1000, f1: 200, glide: 0.5, roll: 3, rollDepth: 0.6, color: 'brown' });
  echoes(out, rng, sr, { at, count: 6, first: 0.15, last: 1.6, amp: 0.25, fc: 900, smear: 0.04 });
  dcBlock(out, sr, 18);
  fade(out, sr, 0, 0.3);
  return normalize(out, 0.8);
}

// Echo tails played after nearby shots: the tree lines, buildings and hills
// answering, a train of smeared darker echoes over a rolling rumble. Start at 0
// (the AudioSystem delays them).
const ECHO = {
  light: { dur: 1.6, decay: 0.35, count: 6, fc: 1900, thump: 0 },
  medium: { dur: 2.2, decay: 0.5, count: 8, fc: 1500, thump: 80 },
  heavy: { dur: 3.0, decay: 0.8, count: 10, fc: 900, thump: 55 },
};

export const ECHO_SIZES = Object.keys(ECHO);

export function gunEcho(size, rng, sr) {
  const p = ECHO[size];
  if (!p) throw new Error(`Unknown echo size ${size}`);
  const out = buffer(p.dur, sr);
  rumble(out, rng, sr, { at: 0, attack: 0.08, decay: p.decay, amp: 0.35, f: p.fc * 1.4, f1: 250, glide: p.decay * 1.5, roll: 3.5, rollDepth: 0.7 });
  echoes(out, rng, sr, { at: 0, count: p.count, first: 0, last: p.dur * 0.7, amp: 0.55, decay: p.decay * 1.2, fc: p.fc, smear: 0.03, thump: p.thump });
  dcBlock(out, sr, 18);
  fade(out, sr, 0.004, 0.3);
  return normalize(out, 0.6);
}

export function gunshotNear(type, rng, sr) {
  if (type === 'rocket') return rocketLaunch(rng, sr);
  if (type === 'panzerfaust') return panzerfaustLaunch(rng, sr);
  if (type === 'tankGun') return tankGunNear(rng, sr);
  const p = NEAR[type];
  if (!p) throw new Error(`Unknown gun type ${type}`);
  return nearReport(p, rng, sr);
}

export function gunshotFar(type, rng, sr) {
  const key = FAR_OF[type];
  if (!key) throw new Error(`Unknown gun type ${type}`);
  if (key === 'rocket') return rocketFar(rng, sr);
  return farReport(FAR[key], rng, sr);
}

export const NEAR_DUR = { ...Object.fromEntries(Object.entries(NEAR).map(([k, p]) => [k, p.dur])), rocket: 1.6, panzerfaust: 1.5, tankGun: 3.4 };
export const FAR_DUR = { ...Object.fromEntries(Object.entries(FAR).map(([k, p]) => [k, p.dur])), rocket: 2.2 };
export const ECHO_DUR = Object.fromEntries(Object.entries(ECHO).map(([k, p]) => [k, p.dur]));

// ---------------------------------------------------------------------------
// Bullets in flight

// Miss distances (m) of the 'crack' variants, closest first.
export const CRACK_MISS = [0.4, 0.8, 1.5, 3, 6, 12];

// Supersonic bullet passing by: an N-wave (sharp rise, linear fall to the
// negative peak, sharp return) whose length grows and edges soften with the
// miss distance, its ground reflection, the turbulent wake's short "zip" and the
// crack answered by the surroundings.
export function crackSound(rng, sr, miss = 1.5) {
  const out = buffer(0.25, sr);
  const m = clamp(miss, 0.2, 30);
  const T = clamp(0.00048 * Math.pow(m / 0.5, 0.3), 0.00045, 0.0015);
  const rise = clamp(0.00002 * Math.pow(m / 0.5, 0.8), 0.5 / sr, 0.0003);
  const at = 0.001;
  nWave(out, sr, { at, T, rise, amp: 1 });
  const gd = rng.range(0.0012, 0.0045) * (1 + m * 0.15);
  nWave(out, sr, { at: at + gd, T: T * 1.08, rise: rise * 2.5 + 1 / sr, amp: rng.range(0.4, 0.65) });
  noiseBurst(out, rng, sr, {
    at: at + T,
    attack: 0.0015,
    decay: rng.range(0.008, 0.016) * (1 + m * 0.08),
    amp: rng.range(0.1, 0.16),
    filter: 'bp',
    f: rng.range(4000, 6500),
    f1: 1800,
    glide: 0.02,
    q: 1.3,
  });
  rumble(out, rng, sr, { at: at + 0.004, attack: 0.006, decay: rng.range(0.05, 0.08), amp: 0.06, f: 5500, f1: 1400, glide: 0.05, roll: 40, rollDepth: 0.7, color: 'white' });
  if (m > 2) lowpass1(out, sr, 22000 / (1 + (m - 2) * 0.12));
  dcBlock(out, sr, 30);
  fade(out, sr, 0, 0.03);
  return normalize(out, 0.95);
}

// Subsonic pistol/SMG bullet passing: a short hiss whose pitch falls as it goes
// by (Doppler); the approach is compressed in time, the departure drawn out.
export function whizSound(rng, sr) {
  const out = buffer(0.3, sr);
  const tp = rng.range(0.06, 0.09);
  const fHi = rng.range(3800, 5200);
  const fLo = fHi * rng.range(0.3, 0.42);
  const svf = new SVF(sr, fHi, 2.2);
  const svf2 = new SVF(sr, fHi * 1.9, 3);
  const wA = rng.range(0.012, 0.02);
  const wR = rng.range(0.04, 0.07);
  const tonal = rng.range(0.05, 0.15);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const d = i / sr - tp;
    const env = d < 0 ? Math.exp(-(d * d) / (2 * wA * wA)) : 1 / (1 + 3 * (d / wR) * (d / wR));
    const s = 0.5 + 0.5 * Math.tanh(d / 0.012);
    const fc = fHi + (fLo - fHi) * s;
    if ((i & 7) === 0) {
      svf.set(fc, 2.2);
      svf2.set(fc * 1.9, 3);
    }
    const w = rng.next() * 2 - 1;
    svf.process(w);
    svf2.process(w);
    ph += (TAU * fc) / sr;
    out[i] = (svf.bpn + 0.35 * svf2.bpn + tonal * Math.sin(ph)) * env;
  }
  dcBlock(out, sr, 40);
  fade(out, sr, 0.002, 0.03);
  return normalize(out, 0.5);
}

// Ricochet: the hit (a crack and a short ping), then the tumbling bullet's whine,
// amplitude-modulated by the tumble and falling in pitch as it slows and leaves.
export function ricochetSound(rng, sr) {
  const out = buffer(0.9, sr);
  const at = 0.001;
  noiseBurst(out, rng, sr, { at, attack: 0.0001, decay: 0.0025, amp: 0.8, filter: 'hp', f: 1800 });
  strike(out, rng, sr, at, { amp: 0.35, f: rng.range(2500, 4000), tau: 0.012, modes: 4 });
  const f0 = rng.range(2300, 4200);
  const f1 = f0 * rng.range(0.4, 0.6);
  const T = rng.range(0.4, 0.7);
  const tumble = rng.range(70, 180);
  const vib = rng.range(4, 9);
  const svf = new SVF(sr, f0, 6);
  const i0 = nSamples(at + 0.004, sr);
  const n = Math.min(out.length - i0, nSamples(T + 0.15, sr));
  let ph = 0,
    phT = rng.next() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const u = Math.min(1, t / T);
    const f = f0 * Math.pow(f1 / f0, u) * (1 + 0.008 * Math.sin(TAU * vib * t));
    ph += (TAU * f) / sr;
    phT += (TAU * tumble) / sr;
    const env = Math.min(1, t / 0.008) * Math.exp(-t / (T * 0.45));
    const am = 0.55 + 0.45 * Math.abs(Math.sin(phT));
    if ((i & 15) === 0) svf.set(f, 6);
    svf.process(rng.next() * 2 - 1);
    const s = Math.sin(ph) + 0.3 * Math.sin(2 * ph + 0.5) + 0.08 * Math.sin(3 * ph);
    out[i0 + i] += (s * 0.5 + svf.bpn * 0.6) * env * am * 0.7;
  }
  dcBlock(out, sr, 40);
  fade(out, sr, 0, 0.05);
  return normalize(out, 0.6);
}
