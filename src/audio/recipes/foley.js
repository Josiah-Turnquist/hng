// Bullet impacts on materials, the close, quiet mechanical sounds of weapons,
// and the swish and blow of close-combat weapons.
// Impacts layer a transient (the strike), the material's response (thump of soil,
// knock of wood modes, ring of steel plates), and what flies off (soil grains,
// splinters, stone chips, glass shards, droplets). Mechanical sounds are built
// from struck steel parts (inharmonic modes), sliding friction with stick-slip
// grains, springs, and the wooden stock's knock under them.
import {
  RATIOS,
  TAU,
  addMode,
  buffer,
  cloth,
  dcBlock,
  fade,
  lowpass1,
  nSamples,
  noiseBurst,
  noiseGrain,
  normalize,
  scatter,
  scrape,
  spring,
  strike,
  thud,
  tone,
} from '../dsp.js';

function finish(out, sr, level, outFade = 0.03, hp = 25) {
  dcBlock(out, sr, hp);
  fade(out, sr, 0, outFade);
  return normalize(out, level);
}

// Air bubble ringing at its Minnaert frequency, rising as it shrinks or surfaces.
function bubble(out, sr, at, f, amp, tau, rise = 1.5) {
  tone(out, sr, { at, f, f1: f * rise, glide: tau * 1.2, attack: 0.0006, decay: tau, amp });
}

// ---------------------------------------------------------------------------
// Bullet impacts (heard from a few meters)

function impactDirt(rng, sr) {
  const out = buffer(0.5, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.0001, decay: 0.0015, amp: 0.5, filter: 'bp', f: rng.range(1200, 2200), q: 0.8 });
  thud(out, rng, sr, { at, amp: 0.9, f: rng.range(80, 110), tau: rng.range(0.02, 0.03), fc: 550, tone: 0.6, noise: 0.8 });
  noiseBurst(out, rng, sr, { at: at + 0.002, attack: 0.004, decay: 0.035, amp: 0.12, filter: 'bp', f: 3000, q: 0.6 });
  // Soil thrown up falls back as grains.
  scatter(
    rng,
    at + 0.01,
    0.42,
    (t) => 500 * Math.exp(-(t - at) / 0.08) + 20,
    (t, u) => {
      const i = nSamples(t, sr);
      const a = rng.pareto(1.4, 0.05) * 0.25 * (1 - u * 0.7);
      if (rng.chance(0.5)) noiseGrain(out, rng, i, rng.int(8, 40), a);
      else addMode(out, i, rng.range(900, 4500), a * 0.8, rng.range(0.001, 0.004), sr, Math.PI / 2);
    },
  );
  return finish(out, sr, 0.75);
}

function impactMud(rng, sr) {
  const out = buffer(0.5, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.0002, decay: 0.002, amp: 0.25, filter: 'bp', f: 1400, q: 0.8 });
  thud(out, rng, sr, { at, amp: 1.0, f: rng.range(62, 80), tau: rng.range(0.03, 0.04), fc: 400, tone: 0.6, noise: 0.9 });
  // Squelch: a resonant band sweeping down as the mud closes over the hole.
  noiseBurst(out, rng, sr, {
    at: at + 0.002,
    attack: 0.004,
    decay: 0.05,
    amp: 0.55,
    filter: 'bp',
    f: rng.range(800, 1000),
    f1: 280,
    glide: 0.03,
    q: 4,
  });
  const n = rng.int(1, 3);
  for (let k = 0; k < n; k++)
    bubble(out, sr, at + rng.range(0.03, 0.3), rng.range(250, 600), rng.range(0.04, 0.1), rng.range(0.01, 0.02), rng.range(1.4, 1.9));
  scatter(rng, at + 0.01, 0.3, 60, (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(20, 60), rng.pareto(1.5, 0.05) * 0.12 * (1 - u), false));
  return finish(out, sr, 0.7);
}

function impactWood(rng, sr) {
  const out = buffer(0.4, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.00005, decay: 0.001, amp: 0.8, filter: 'hp', f: 2500 });
  strike(out, rng, sr, at, {
    amp: 0.8,
    f: rng.range(320, 520),
    ratios: RATIOS.wood,
    tau: rng.range(0.012, 0.018),
    modes: 5,
    damp: 0.9,
    click: 0.4,
    thump: 0.6,
    thumpF: rng.range(110, 150),
  });
  // Splinters.
  scatter(rng, at + 0.001, at + 0.09, 300, (t, u) => {
    const i = nSamples(t, sr);
    noiseGrain(out, rng, i, rng.int(3, 12), rng.pareto(1.3, 0.08) * 0.4 * (1 - u));
    if (rng.chance(0.3)) addMode(out, i, rng.range(1800, 5000), rng.pareto(1.3, 0.08) * 0.2, rng.range(0.002, 0.006), sr, Math.PI / 2);
  });
  return finish(out, sr, 0.75);
}

function impactStone(rng, sr) {
  const out = buffer(0.6, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.00004, decay: 0.0008, amp: 0.7, filter: 'hp', f: 2000 });
  noiseBurst(out, rng, sr, { at, attack: 0.0002, decay: 0.006, amp: 0.7, filter: 'bp', f: rng.range(3200, 4800), q: 0.9 });
  noiseBurst(out, rng, sr, { at, attack: 0.0003, decay: 0.012, amp: 0.6, filter: 'bp', f: rng.range(1500, 2200), q: 0.8 });
  strike(out, rng, sr, at, { amp: 0.35, f: rng.range(2800, 4200), tau: 0.008, modes: 4, click: 0 });
  thud(out, rng, sr, { at, amp: 0.35, f: 150, tau: 0.008, fc: 900 });
  // Chips and dust: pebbles ticking down, then fine dust.
  scatter(
    rng,
    at + 0.004,
    0.55,
    (t) => 300 * Math.exp(-(t - at) / 0.1) + 15,
    (t, u) => {
      const i = nSamples(t, sr);
      const a = rng.pareto(1.4, 0.05) * 0.3 * (1 - u * 0.6);
      addMode(out, i, rng.range(1500, 6500), a, rng.range(0.001, 0.003), sr, Math.PI / 2);
      if (rng.chance(0.4)) noiseGrain(out, rng, i, rng.int(4, 16), a * 0.6);
    },
  );
  noiseBurst(out, rng, sr, { at: at + 0.006, attack: 0.01, decay: 0.1, amp: 0.12, filter: 'bp', f: 3500, q: 0.5 });
  return finish(out, sr, 0.8);
}

// Plate-like inharmonic mode ratios (thin steel: vehicle bodies, helmets, barrels).
const PLATE = [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.5, 4.1, 4.6, 5.4];

function plateModes(out, rng, sr, at, f0, amp, tau0, count, split = true) {
  const i0 = nSamples(at, sr);
  for (let k = 0; k < count; k++) {
    const f = f0 * PLATE[k] * rng.vary(1, 0.03);
    if (f > sr * 0.45) break;
    const tau = tau0 * Math.pow(f0 / f, 0.6) * rng.range(0.7, 1.2);
    const a = (amp * rng.range(0.35, 1)) / Math.sqrt(k + 1);
    addMode(out, i0, f, a, tau, sr, rng.next() * TAU);
    // Nearly degenerate mode pairs beat slowly: the shimmer of a struck plate.
    if (split) addMode(out, i0, f * (1 + rng.range(0.003, 0.01)), a * 0.5, tau * 0.9, sr, rng.next() * TAU);
  }
}

function impactMetal(rng, sr) {
  const out = buffer(1.1, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.00004, decay: 0.0006, amp: 0.9, filter: 'hp', f: 3000 });
  plateModes(out, rng, sr, at, rng.range(480, 950), 0.7, 0.3, 10);
  addMode(out, nSamples(at, sr), rng.range(4000, 6000), 0.4, 0.03, sr, 0);
  return finish(out, sr, 0.75, 0.08);
}

// Thick armor plate hit by a rifle bullet: a sharp "ptang" with sparks and a
// short, dull clank (too massive to ring for long).
function impactArmor(rng, sr) {
  const out = buffer(0.8, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.00004, decay: 0.0012, amp: 1.0, filter: 'hp', f: 2500 });
  scatter(rng, at, at + 0.06, 900, (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(2, 6), rng.pareto(1.3, 0.1) * 0.35 * (1 - u)));
  plateModes(out, rng, sr, at, rng.range(180, 300), 0.6, 0.12, 8, false);
  const i0 = nSamples(at, sr);
  const fp = rng.range(3000, 4500);
  addMode(out, i0, fp, 0.35, 0.04, sr, 0);
  addMode(out, i0, fp * 1.81, 0.2, 0.02, sr, 0);
  thud(out, rng, sr, { at, amp: 0.4, f: 120, tau: 0.015, fc: 700 });
  return finish(out, sr, 0.8, 0.06);
}

function tinkle(out, rng, sr, at, amp) {
  const i0 = nSamples(at, sr);
  const f = rng.logRange(2800, 11000);
  const n = rng.int(1, 3);
  for (let k = 0; k < n; k++)
    addMode(out, i0, f * RATIOS.glass[k] * rng.vary(1, 0.02), amp / (k + 1), rng.range(0.006, 0.04) / (k + 1), sr, rng.next() * TAU);
}

function impactGlass(rng, sr) {
  const out = buffer(1.0, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.0001, decay: 0.0015, amp: 0.9, filter: 'bp', f: 3000, q: 0.7 });
  noiseBurst(out, rng, sr, { at, attack: 0.0005, decay: 0.015, amp: 0.4, filter: 'hp', f: 2000 });
  scatter(rng, at, at + 0.06, 700, (t) => tinkle(out, rng, sr, t, rng.pareto(1.3, 0.1) * 0.4));
  scatter(
    rng,
    0.12,
    0.95,
    (t) => 90 * Math.exp(-(t - 0.12) / 0.3) + 3,
    (t, u) => {
      tinkle(out, rng, sr, t, rng.pareto(1.3, 0.1) * 0.25 * (1 - u * 0.7));
      if (rng.chance(0.3)) noiseGrain(out, rng, nSamples(t, sr), rng.int(3, 10), 0.08 * (1 - u));
    },
  );
  return finish(out, sr, 0.7, 0.06);
}

function impactWater(rng, sr) {
  const out = buffer(0.6, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.00005, decay: 0.0008, amp: 0.5, filter: 'hp', f: 2500 });
  // The cavity behind the bullet collapses: a rising "bloop".
  bubble(out, sr, at + 0.004, rng.range(220, 320), 0.7, 0.03, rng.range(2.2, 3));
  noiseBurst(out, rng, sr, { at, attack: 0.006, decay: 0.07, amp: 0.5, filter: 'bp', f: 2500, q: 0.6 });
  noiseBurst(out, rng, sr, { at, attack: 0.004, decay: 0.06, amp: 0.4, filter: 'lp', f: 600 });
  scatter(
    rng,
    0.04,
    0.5,
    (t) => 60 * Math.exp(-(t - 0.04) / 0.15) + 2,
    (t, u) => bubble(out, sr, t, rng.range(900, 2600), 0.2 * (1 - u) * rng.range(0.3, 1), rng.range(0.006, 0.014), rng.range(1.3, 1.7)),
  );
  return finish(out, sr, 0.7, 0.05);
}

function impactFlesh(rng, sr) {
  const out = buffer(0.25, sr);
  const at = 0.0008;
  noiseBurst(out, rng, sr, { at, attack: 0.0003, decay: 0.008, amp: 0.8, filter: 'lp', f: 900, q: 0.7 });
  thud(out, rng, sr, { at, amp: 0.7, f: rng.range(95, 125), tau: 0.018, fc: 500 });
  noiseBurst(out, rng, sr, { at: at + 0.001, attack: 0.001, decay: 0.01, amp: 0.15, filter: 'bp', f: 1800, q: 2 });
  return finish(out, sr, 0.5);
}

function impactSand(rng, sr) {
  const out = buffer(0.55, sr);
  const at = 0.0008;
  thud(out, rng, sr, { at, amp: 0.6, f: 90, tau: 0.015, fc: 400 });
  noiseBurst(out, rng, sr, { at, attack: 0.003, decay: 0.06, amp: 0.45, filter: 'bp', f: 2500, f1: 1800, glide: 0.05, q: 0.6 });
  scatter(
    rng,
    at + 0.002,
    0.45,
    (t) => 2500 * Math.exp(-t / 0.08) + 40,
    (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(3, 10), rng.pareto(1.5, 0.05) * 0.15 * (1 - u)),
  );
  noiseBurst(out, rng, sr, { at: 0.05, attack: 0.05, decay: 0.12, amp: 0.05, filter: 'bp', f: 4000, q: 0.7 });
  return finish(out, sr, 0.65);
}

// Leaves and twigs: a burst of crackles, a rustle and a small snap.
function impactFoliage(rng, sr) {
  const out = buffer(0.4, sr);
  const at = 0.0008;
  scatter(
    rng,
    at,
    0.3,
    (t) => 900 * Math.exp(-t / 0.04) + 10,
    (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(2, 8), rng.pareto(1.3, 0.1) * 0.35 * (1 - u)),
  );
  noiseBurst(out, rng, sr, { at, attack: 0.002, decay: 0.06, amp: 0.4, filter: 'bp', f: 3500, q: 0.5 });
  strike(out, rng, sr, at + 0.002, { amp: 0.4, f: rng.range(1800, 2600), ratios: RATIOS.wood, tau: 0.004, modes: 3, click: 0.8 });
  return finish(out, sr, 0.5);
}

export const IMPACTS = {
  impactDirt: { dur: 0.5, make: impactDirt },
  impactMud: { dur: 0.5, make: impactMud },
  impactWood: { dur: 0.4, make: impactWood },
  impactStone: { dur: 0.6, make: impactStone },
  impactMetal: { dur: 1.1, make: impactMetal },
  impactArmor: { dur: 0.8, make: impactArmor },
  impactGlass: { dur: 1.0, make: impactGlass },
  impactWater: { dur: 0.6, make: impactWater },
  impactFlesh: { dur: 0.25, make: impactFlesh },
  impactSand: { dur: 0.55, make: impactSand },
  impactFoliage: { dur: 0.4, make: impactFoliage },
};

// ---------------------------------------------------------------------------
// Weapon mechanics (heard from the shooter's position)

const RECEIVER = [
  [2300, 0.012],
  [3900, 0.008],
];

// Mauser bolt opening: the handle lifts and cams the striker back (rising
// friction, a click at the top), the bolt slides back, the extractor drags the
// case out, and the bolt stop clacks as the case springs free.
function boltOpenAt(out, rng, sr, t0) {
  strike(out, rng, sr, t0 + 0.004, { amp: 0.45, f: rng.range(2400, 2900), tau: 0.008, thump: 0.3, thumpF: 240, modes: 4 });
  scrape(out, rng, sr, {
    at: t0 + 0.008,
    dur: 0.075,
    amp: 0.22,
    f: 2600,
    f1: 3400,
    shape: 'rise',
    grains: 120,
    res: [
      [3100, 0.01],
      [4700, 0.008],
    ],
  });
  strike(out, rng, sr, t0 + 0.088, { amp: 0.7, f: rng.range(2900, 3400), tau: 0.01, modes: 5 });
  scrape(out, rng, sr, { at: t0 + 0.12, dur: 0.15, amp: 0.3, f: 1900, f1: 2700, grains: 80, res: RECEIVER });
  strike(out, rng, sr, t0 + 0.24, { amp: 0.25, f: 4500, tau: 0.006, modes: 3 });
  strike(out, rng, sr, t0 + 0.283, { amp: 1.0, f: rng.range(2000, 2400), tau: 0.016, thump: 0.4, thumpF: 220, modes: 6 });
  strike(out, rng, sr, t0 + 0.292, { amp: 0.3, f: rng.range(5000, 6200), tau: 0.035, ratios: RATIOS.brass, click: 0.1, modes: 4 });
}

// Mauser bolt closing: forward stroke, the next round stripped off the magazine,
// the bolt face seating it, then the handle turned down into the locking clack.
function boltCloseAt(out, rng, sr, t0) {
  strike(out, rng, sr, t0 + 0.004, { amp: 0.25, f: 2600, tau: 0.006, modes: 3 });
  scrape(out, rng, sr, { at: t0 + 0.01, dur: 0.14, amp: 0.3, f: 2600, f1: 1900, grains: 80, res: RECEIVER });
  strike(out, rng, sr, t0 + 0.075, { amp: 0.35, f: rng.range(3300, 3900), tau: 0.01, ratios: RATIOS.brass, modes: 4 });
  scrape(out, rng, sr, { at: t0 + 0.08, dur: 0.05, amp: 0.14, f: 4200, grains: 60 });
  strike(out, rng, sr, t0 + 0.155, { amp: 0.85, f: rng.range(2200, 2600), tau: 0.012, thump: 0.35, thumpF: 200, modes: 5 });
  scrape(out, rng, sr, { at: t0 + 0.2, dur: 0.06, amp: 0.15, f: 3000, f1: 2500, shape: 'fall', grains: 60 });
  strike(out, rng, sr, t0 + 0.265, { amp: 1.0, f: rng.range(1900, 2300), tau: 0.014, thump: 0.55, thumpF: 260, modes: 6 });
}

function rattle(out, rng, sr, t0, t1, rate, amp, fLo = 3500, fHi = 5200) {
  scatter(rng, t0, t1, rate, (t, u) =>
    strike(out, rng, sr, t, {
      amp: amp * (1 - u * 0.6) * rng.range(0.4, 1),
      f: rng.range(fLo, fHi),
      ratios: RATIOS.brass,
      tau: 0.006,
      modes: 3,
      click: 0.3,
    }),
  );
}

const MECH = {
  boltOpen: {
    dur: 0.45,
    level: 0.3,
    make(out, rng, sr) {
      boltOpenAt(out, rng, sr, 0);
    },
  },
  boltClose: {
    dur: 0.42,
    level: 0.3,
    make(out, rng, sr) {
      boltCloseAt(out, rng, sr, 0);
    },
  },
  boltCycle: {
    dur: 0.8,
    level: 0.3,
    make(out, rng, sr) {
      boltOpenAt(out, rng, sr, 0);
      boltCloseAt(out, rng, sr, rng.range(0.34, 0.38));
    },
  },
  // Kar98k stripper clip: the clip clinks into the charger guides, then the thumb
  // pushes the five rounds down; each slides with a brassy scrape and snaps past
  // the magazine lips.
  stripperClip: {
    dur: 1.0,
    level: 0.28,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.005, { amp: 0.6, f: rng.range(3400, 4000), tau: 0.02, modes: 5 });
      scrape(out, rng, sr, { at: 0.01, dur: 0.04, amp: 0.18, f: 3500, grains: 50 });
      strike(out, rng, sr, 0.055, { amp: 0.5, f: 2900, tau: 0.012, modes: 4 });
      let t = rng.range(0.16, 0.2);
      for (let k = 0; k < 5; k++) {
        scrape(out, rng, sr, { at: t - 0.05, dur: 0.06, amp: 0.15, f: 3000 + 200 * k, grains: 50, res: [[3600, 0.01]] });
        strike(out, rng, sr, t, { amp: rng.range(0.5, 0.8), f: rng.range(3000, 3800), tau: 0.012, ratios: RATIOS.brass, modes: 4, thump: 0.15 });
        t += rng.range(0.07, 0.11) * (1 - 0.1 * k);
      }
      cloth(out, rng, sr, { at: t, dur: 0.12, amp: 0.08, f: 1800 });
    },
  },
  roundInsert: {
    dur: 0.3,
    level: 0.25,
    make(out, rng, sr) {
      scrape(out, rng, sr, { at: 0.01, dur: 0.07, amp: 0.2, f: 3600, f1: 3000, grains: 60, res: [[4200, 0.01]] });
      strike(out, rng, sr, 0.08, { amp: 0.8, f: rng.range(3000, 3600), tau: 0.012, ratios: RATIOS.brass, modes: 5, thump: 0.2 });
      spring(out, rng, sr, 0.082, { f: 1900, amp: 0.05, tau: 0.03 });
    },
  },
  // M1 Garand en-bloc clip ejected after the last round: the bolt locks open,
  // then the spring-steel clip flies out ringing: a bright inharmonic "ping",
  // partials ~2.4-9 kHz, split mode pairs that shimmer, a tumble flutter.
  garandPing: {
    dur: 0.75,
    level: 0.45,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.003, { amp: 0.25, f: 2100, tau: 0.01, thump: 0.25, modes: 4 });
      const t = 0.012;
      const i0 = nSamples(t, sr);
      noiseBurst(out, rng, sr, { at: t, attack: 0.00005, decay: 0.0008, amp: 0.5, filter: 'hp', f: 4000 });
      const ping = new Float32Array(out.length);
      const f0 = rng.range(2350, 2700);
      const ratios = [1, 1.52, 2.03, 2.71, 3.32];
      const taus = [0.13, 0.1, 0.08, 0.06, 0.045];
      const amps = [1, 0.7, 0.55, 0.35, 0.25];
      for (let k = 0; k < ratios.length; k++) {
        const f = f0 * ratios[k] * rng.vary(1, 0.015);
        const tau = taus[k] * rng.vary(1, 0.12);
        addMode(ping, i0, f, amps[k] * 0.8, tau, sr, rng.next() * TAU);
        addMode(ping, i0, f * (1 + rng.range(0.003, 0.009)), amps[k] * 0.4, tau * 0.9, sr, rng.next() * TAU);
      }
      const tumble = rng.range(14, 24);
      for (let i = i0; i < out.length; i++) out[i] += ping[i] * (0.85 + 0.15 * Math.sin((TAU * tumble * (i - i0)) / sr));
    },
  },
  // Garand clip pushed into the magazine against the follower spring, the latch
  // catches, the thumb gets out of the way, and the bolt slams home.
  garandClipIn: {
    dur: 0.5,
    level: 0.32,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.004, { amp: 0.45, f: 3200, tau: 0.012, ratios: RATIOS.brass, modes: 4 });
      scrape(out, rng, sr, { at: 0.012, dur: 0.1, amp: 0.3, f: 2800, f1: 2200, shape: 'rise', grains: 100, res: [[3100, 0.01]] });
      strike(out, rng, sr, 0.115, { amp: 0.7, f: 2700, tau: 0.01, modes: 5 });
      cloth(out, rng, sr, { at: 0.12, dur: 0.06, amp: 0.06 });
      scrape(out, rng, sr, { at: 0.165, dur: 0.02, amp: 0.25, f: 2400, shape: 'flat', grains: 0 });
      strike(out, rng, sr, 0.188, { amp: 1.0, f: 1850, tau: 0.02, thump: 0.6, thumpF: 220, modes: 6 });
      strike(out, rng, sr, 0.19, { amp: 0.2, f: 1250, tau: 0.06, ratios: RATIOS.can, modes: 4, click: 0 });
    },
  },
  magOut: {
    dur: 0.4,
    level: 0.26,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.005, { amp: 0.45, f: 3000, tau: 0.006, modes: 4 });
      scrape(out, rng, sr, { at: 0.02, dur: 0.15, amp: 0.3, f: 1700, f1: 2400, shape: 'fall', grains: 60, res: [[2100, 0.01]] });
      rattle(out, rng, sr, 0.04, 0.17, 30, 0.18);
      thud(out, rng, sr, { at: 0.2, amp: 0.35, f: 160, tau: 0.01, fc: 700 });
      strike(out, rng, sr, 0.201, { amp: 0.15, f: 2500, tau: 0.008, modes: 3 });
    },
  },
  magIn: {
    dur: 0.42,
    level: 0.3,
    make(out, rng, sr) {
      scrape(out, rng, sr, { at: 0.005, dur: 0.13, amp: 0.28, f: 2000, f1: 2600, shape: 'rise', grains: 60, res: RECEIVER });
      strike(out, rng, sr, 0.14, { amp: 1.0, f: rng.range(2000, 2300), tau: 0.014, thump: 0.5, thumpF: 180, modes: 6 });
      thud(out, rng, sr, { at: 0.142, amp: 0.5, f: 140, tau: 0.015, fc: 800 });
      noiseBurst(out, rng, sr, { at: 0.142, attack: 0.0003, decay: 0.006, amp: 0.25, filter: 'bp', f: 1200, q: 0.8 });
      rattle(out, rng, sr, 0.15, 0.26, 30, 0.1);
    },
  },
  // PPSh-41 drum magazine: a hollow sheet-metal clunk, the latch, and 71 loose
  // rounds settling inside the drum.
  drumIn: {
    dur: 0.55,
    level: 0.32,
    make(out, rng, sr) {
      scrape(out, rng, sr, { at: 0.0, dur: 0.09, amp: 0.25, f: 1800, f1: 2300, shape: 'rise', grains: 50 });
      strike(out, rng, sr, 0.1, {
        amp: 1.0,
        f: rng.range(300, 360),
        ratios: RATIOS.can,
        tau: 0.06,
        modes: 6,
        click: 0.6,
        thump: 0.6,
        thumpF: 140,
        damp: 0.4,
      });
      strike(out, rng, sr, 0.108, { amp: 0.6, f: 2600, tau: 0.01, modes: 4 });
      rattle(out, rng, sr, 0.11, 0.42, 60, 0.12);
      scatter(rng, 0.11, 0.35, 12, (t) =>
        strike(out, rng, sr, t, { amp: 0.1, f: rng.range(450, 560), ratios: RATIOS.can, tau: 0.02, modes: 4, click: 0.2 }),
      );
    },
  },
  chargingHandle: {
    dur: 0.5,
    level: 0.3,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.004, { amp: 0.3, f: 2800, tau: 0.005, modes: 3 });
      scrape(out, rng, sr, {
        at: 0.01,
        dur: 0.19,
        amp: 0.32,
        f: 1500,
        f1: 2600,
        shape: 'rise',
        grains: 90,
        res: [
          [1900, 0.012],
          [3300, 0.008],
        ],
      });
      strike(out, rng, sr, 0.2, { amp: 0.55, f: 2400, tau: 0.01, modes: 4 });
      scrape(out, rng, sr, { at: 0.29, dur: 0.025, amp: 0.3, f: 2500, shape: 'flat', grains: 0 });
      strike(out, rng, sr, 0.317, { amp: 1.0, f: 1800, tau: 0.022, thump: 0.5, modes: 6 });
      spring(out, rng, sr, 0.318, { f: 1300, amp: 0.06, tau: 0.05 });
    },
  },
  // MG 42 / MG 34 feed cover: latch, spring, hinge, and the hollow clank of the
  // stamped cover reaching its open stop.
  beltCoverOpen: {
    dur: 0.4,
    level: 0.32,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.005, { amp: 0.7, f: 2800, tau: 0.01, modes: 4 });
      spring(out, rng, sr, 0.006, { f: 2000, amp: 0.08, tau: 0.03 });
      scrape(out, rng, sr, { at: 0.02, dur: 0.07, amp: 0.12, f: 2000, f1: 1500, grains: 40 });
      strike(out, rng, sr, 0.105, { amp: 0.85, f: rng.range(620, 760), ratios: RATIOS.can, tau: 0.04, modes: 6, click: 0.5, thump: 0.2 });
    },
  },
  beltCoverClose: {
    dur: 0.4,
    level: 0.34,
    make(out, rng, sr) {
      noiseBurst(out, rng, sr, { at: 0, attack: 0.03, decay: 0.02, amp: 0.04, filter: 'bp', f: 800 });
      strike(out, rng, sr, 0.06, { amp: 1.0, f: rng.range(560, 700), ratios: RATIOS.can, tau: 0.05, modes: 6, click: 0.7, thump: 0.35 });
      strike(out, rng, sr, 0.072, { amp: 0.8, f: 2700, tau: 0.01, modes: 4 });
      rattle(out, rng, sr, 0.08, 0.22, 30, 0.08, 3500, 5500);
    },
  },
  dryFire: {
    dur: 0.15,
    level: 0.22,
    make(out, rng, sr) {
      scrape(out, rng, sr, { at: 0, dur: 0.02, amp: 0.05, f: 3000, grains: 0 });
      strike(out, rng, sr, 0.025, { amp: 1.0, f: rng.range(3200, 3800), tau: 0.006, modes: 4, click: 0.8, thump: 0.15 });
      spring(out, rng, sr, 0.026, { f: 2400, amp: 0.05, tau: 0.015 });
    },
  },
  fireModeSwitch: {
    dur: 0.12,
    level: 0.15,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.005, { amp: 0.7, f: 4200, tau: 0.004, modes: 3 });
      strike(out, rng, sr, 0.04, { amp: 0.5, f: 3900, tau: 0.004, modes: 3 });
    },
  },
  // Empty rifle case on hard ground: bounces at shrinking intervals (coefficient of
  // restitution ~0.5-0.65), each exciting the thin brass cylinder's ring, then
  // rolling.
  casingBrass: {
    dur: 0.8,
    level: 0.2,
    make(out, rng, sr) {
      const f0 = rng.range(3300, 4300);
      let t = 0.002,
        gap = rng.range(0.09, 0.13),
        a = 1;
      for (let k = 0; k < 6; k++) {
        strike(out, rng, sr, t, {
          amp: a * rng.range(0.7, 1),
          f: f0 * rng.vary(1, 0.03),
          ratios: RATIOS.brass,
          tau: 0.07 * (0.7 + 0.3 * a),
          modes: 5,
          click: 0.4,
          damp: 0.5,
        });
        noiseBurst(out, rng, sr, { at: t, attack: 0.00005, decay: 0.0006, amp: 0.3 * a, filter: 'hp', f: 3000 });
        t += gap;
        gap *= rng.range(0.5, 0.65);
        a *= rng.range(0.45, 0.65);
      }
      scatter(rng, t, Math.min(0.7, t + rng.range(0.1, 0.2)), 45, (tt, u) =>
        strike(out, rng, sr, tt, { amp: 0.08 * (1 - u), f: f0, ratios: RATIOS.brass, tau: 0.02, modes: 3, click: 0.3 }),
      );
    },
  },
  casingSoft: {
    dur: 0.25,
    level: 0.1,
    make(out, rng, sr) {
      thud(out, rng, sr, { at: 0.002, amp: 0.6, f: 140, tau: 0.01, fc: 1200 });
      strike(out, rng, sr, 0.002, { amp: 0.4, f: 2400, tau: 0.004, ratios: RATIOS.brass, modes: 3, click: 0.3 });
      const t2 = rng.range(0.05, 0.07);
      thud(out, rng, sr, { at: t2, amp: 0.25, f: 150, tau: 0.008, fc: 1000 });
      strike(out, rng, sr, t2, { amp: 0.15, f: 2600, tau: 0.003, ratios: RATIOS.brass, modes: 3, click: 0.3 });
      lowpass1(out, sr, 4000);
    },
  },
  // Disintegrating belt link: a small, light steel strip.
  linkDrop: {
    dur: 0.35,
    level: 0.13,
    make(out, rng, sr) {
      const f0 = rng.range(5200, 6800);
      const times = [0.002, rng.range(0.05, 0.07), rng.range(0.09, 0.12)];
      times.forEach((t, k) =>
        strike(out, rng, sr, t, { amp: [1, 0.5, 0.25][k], f: f0 * rng.vary(1, 0.03), ratios: RATIOS.bar, tau: 0.02, modes: 3, click: 0.5 }),
      );
    },
  },
  // Switching weapons: webbing and wool rustle, sling swivels, the stock knocking.
  weaponHandling: {
    dur: 0.7,
    level: 0.18,
    make(out, rng, sr) {
      cloth(out, rng, sr, { at: 0, dur: 0.5, amp: 0.35, f: 2000, motion: 14 });
      strike(out, rng, sr, rng.range(0.1, 0.14), { amp: 0.25, f: 3400, tau: 0.01, modes: 4 });
      strike(out, rng, sr, rng.range(0.28, 0.33), { amp: 0.2, f: 3000, tau: 0.01, modes: 4 });
      strike(out, rng, sr, 0.42, { amp: 0.5, f: rng.range(260, 340), ratios: RATIOS.wood, tau: 0.025, thump: 0.4, modes: 4 });
      strike(out, rng, sr, 0.44, { amp: 0.3, f: 2500, tau: 0.012, modes: 4 });
      rattle(out, rng, sr, 0.45, 0.55, 30, 0.08);
    },
  },
  // An adjustable wrench at work on a nut: the jaws biting with a knock, the
  // pull (the nut creaks round under the load), and the jaws slipped back for
  // the next bite with a light rattle of the loose jaw.
  wrench: {
    dur: 0.6,
    level: 0.2,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.005, { amp: 0.8, f: rng.range(1700, 2100), tau: 0.012, modes: 4, click: 0.5, thump: 0.25 });
      scrape(out, rng, sr, { at: 0.05, dur: 0.22, amp: 0.12, f: 1300, grains: 40 });
      thud(out, rng, sr, { at: 0.06, amp: 0.25, f: 160, tau: 0.03, fc: 700 });
      strike(out, rng, sr, rng.range(0.36, 0.4), { amp: 0.35, f: rng.range(2600, 3000), tau: 0.008, modes: 3, click: 0.4 });
      rattle(out, rng, sr, 0.4, 0.5, 40, 0.06);
    },
  },
  // Raising a scoped rifle: a short rustle, the cheek meeting the stock, a tick.
  scopeIn: {
    dur: 0.35,
    level: 0.12,
    make(out, rng, sr) {
      cloth(out, rng, sr, { at: 0, dur: 0.22, amp: 0.25, f: 1800 });
      thud(out, rng, sr, { at: 0.15, amp: 0.4, f: 180, tau: 0.012, fc: 600 });
      strike(out, rng, sr, 0.19, { amp: 0.12, f: 3200, tau: 0.006, modes: 3 });
    },
  },

  // --- Close combat (game/melee.js): the swish of the blow and what it meets.
  // A thrust with a knife or bayonet: a short, high rush of air past the blade
  // and the sleeve's rustle.
  swishLight: {
    dur: 0.35,
    level: 0.22,
    make(out, rng, sr) {
      cloth(out, rng, sr, { at: 0, dur: 0.18, amp: 0.25, f: 2200, motion: 20 });
      noiseBurst(out, rng, sr, { at: 0.03, attack: 0.05, decay: 0.035, amp: 0.8, filter: 'bp', f: rng.range(2200, 2800), f1: 1100, glide: 0.08, q: 1.3 });
    },
  },
  // A spade or bat swung from the shoulder: a longer, lower whoosh rising to
  // its fastest just before it lands.
  swishHeavy: {
    dur: 0.6,
    level: 0.26,
    make(out, rng, sr) {
      cloth(out, rng, sr, { at: 0, dur: 0.3, amp: 0.3, f: 1800, motion: 14 });
      noiseBurst(out, rng, sr, { at: 0.12, attack: 0.14, decay: 0.06, amp: 0.9, filter: 'bp', f: rng.range(500, 650), f1: 1100, glide: 0.14, q: 1.6 });
      noiseBurst(out, rng, sr, { at: 0.2, attack: 0.06, decay: 0.04, amp: 0.35, filter: 'bp', f: 2400, q: 1.2 });
    },
  },
  // A blade going in: the blow through the cloth, the thud of the body.
  stabHit: {
    dur: 0.3,
    level: 0.5,
    make(out, rng, sr) {
      noiseBurst(out, rng, sr, { at: 0.001, attack: 0.001, decay: 0.012, amp: 0.45, filter: 'bp', f: rng.range(2600, 3400), q: 1.1 });
      thud(out, rng, sr, { at: 0.004, amp: 0.9, f: rng.range(95, 125), tau: 0.03, fc: 550, noise: 0.8 });
      noiseBurst(out, rng, sr, { at: 0.012, attack: 0.004, decay: 0.03, amp: 0.25, filter: 'lp', f: 700, q: 0.8 });
    },
  },
  // A spade's edge striking a man: a heavy thud and a dull ring of the blade.
  spadeHit: {
    dur: 0.45,
    level: 0.55,
    make(out, rng, sr) {
      thud(out, rng, sr, { at: 0.001, amp: 1, f: rng.range(80, 100), tau: 0.035, fc: 600, noise: 0.9 });
      strike(out, rng, sr, 0.002, { amp: 0.18, f: rng.range(700, 900), tau: 0.06, modes: 5, click: 0.3 });
      noiseBurst(out, rng, sr, { at: 0.002, attack: 0.001, decay: 0.01, amp: 0.3, filter: 'bp', f: 2200, q: 1 });
    },
  },
  // A bat striking a man: the knock of the wood over the thud.
  batHit: {
    dur: 0.4,
    level: 0.55,
    make(out, rng, sr) {
      thud(out, rng, sr, { at: 0.001, amp: 1, f: rng.range(85, 110), tau: 0.03, fc: 650, noise: 0.85 });
      strike(out, rng, sr, 0.001, { amp: 0.4, f: rng.range(420, 520), ratios: RATIOS.wood, tau: 0.025, modes: 4, click: 0.5 });
    },
  },
  // Steel on a wall: the ringing clang of a blade or spade and a scrape.
  bladeWall: {
    dur: 0.6,
    level: 0.4,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.001, { amp: 0.8, f: rng.range(1500, 2100), tau: 0.08, modes: 6, click: 0.9 });
      scrape(out, rng, sr, { at: 0.004, dur: 0.08, amp: 0.15, f: 3200, f1: 2400, q: 1.2 });
      thud(out, rng, sr, { at: 0.001, amp: 0.4, f: 140, tau: 0.012, fc: 900 });
    },
  },
  // Wood on a wall: a hollow knock.
  batWall: {
    dur: 0.4,
    level: 0.4,
    make(out, rng, sr) {
      strike(out, rng, sr, 0.001, { amp: 0.8, f: rng.range(300, 380), ratios: RATIOS.wood, tau: 0.04, modes: 5, click: 0.7, thump: 0.6, thumpF: 160 });
      noiseBurst(out, rng, sr, { at: 0.002, attack: 0.001, decay: 0.015, amp: 0.25, filter: 'bp', f: 2600, q: 1 });
    },
  },
};

export const MECHANICAL = Object.fromEntries(
  Object.entries(MECH).map(([id, m]) => [
    id,
    {
      dur: m.dur,
      make(rng, sr) {
        const out = buffer(m.dur, sr);
        m.make(out, rng, sr);
        return finish(out, sr, m.level, 0.02, 30);
      },
    },
  ]),
);
