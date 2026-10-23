// Explosions, vehicles, ambience, UI cues and the reverb impulse responses.
//
// Loops are made seamless in two ways: event layers (engine firing pulses, track
// links, crackles, birdsong) are rendered past the loop end and folded back onto
// the start, and continuous filtered-noise beds are rendered a little longer and
// crossfaded into their own start. Slow modulations (gusts, flicker) use only
// frequencies that complete whole cycles in the loop.
import {
  RATIOS,
  SVF,
  TAU,
  addMode,
  blastPulse,
  buffer,
  clamp,
  dcBlock,
  echoes,
  fade,
  filter,
  fold,
  loopFreq,
  loopify,
  lowpass1,
  Noise,
  nSamples,
  noiseBurst,
  noiseGrain,
  normalize,
  normalizeRms,
  randomCurve,
  reflect,
  rumble,
  saturate,
  scatter,
  scrape,
  strike,
  thud,
  tone,
} from '../dsp.js';

function bubble(out, sr, at, f, amp, tau, rise = 1.5) {
  tone(out, sr, { at, f, f1: f * rise, glide: tau * 1.2, attack: 0.0006, decay: tau, amp });
}

function finish(out, sr, level, outFade = 0.1, hp = 18) {
  dcBlock(out, sr, hp);
  fade(out, sr, 0, outFade);
  return normalize(out, level);
}

// ---------------------------------------------------------------------------
// Explosions

// Hand grenade at 10-40 m: a hard crack, a deep boom, fragments and soil
// spraying, then the landscape rumbling back.
function grenadeExplosion(rng, sr) {
  const out = buffer(2.6, sr);
  const at = 0.001;
  blastPulse(out, sr, { at, T: rng.vary(0.0035, 0.15), amp: 1, b: 1.15, rise: 1 / sr });
  tone(out, sr, { at, f: rng.vary(70, 0.08), f1: 30, glide: 0.1, attack: 0.001, decay: 0.12, amp: 1.0, h2: 0.25 });
  noiseBurst(out, rng, sr, { at, attack: 0.0003, decay: 0.025, amp: 0.7, filter: 'lp', f: 9000, f1: 400, glide: 0.06, q: 0.6 });
  noiseBurst(out, rng, sr, { at, attack: 0.004, decay: 0.2, amp: 0.45, filter: 'lp', f: 2500, f1: 250, glide: 0.2, q: 0.7, color: 'pink' });
  scatter(rng, at + 0.003, at + 0.12, 600, (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(3, 12), rng.pareto(1.3, 0.1) * 0.4 * (1 - u)));
  reflect(out, sr, 0.005, 0.55, 4000, 0.3);
  saturate(out, 3.0, 0, nSamples(0.5, sr));
  rumble(out, rng, sr, { at: at + 0.03, attack: 0.05, decay: 0.6, amp: 0.3, f: 1200, f1: 150, glide: 0.5, roll: 4, rollDepth: 0.55, color: 'brown' });
  echoes(out, rng, sr, { at, count: 6, first: 0.2, last: 1.6, amp: 0.25, fc: 900, smear: 0.05, thump: 50 });
  noiseBurst(out, rng, sr, { at: at + 0.02, attack: 0.03, decay: 0.25, amp: 0.12, filter: 'bp', f: 2500, q: 0.5 });
  return finish(out, sr, 1.0, 0.3);
}

// Any explosion heard from far away: a dull thud and a long rolling rumble.
function explosionFar(rng, sr) {
  const out = buffer(3.5, sr);
  const at = 0.003;
  blastPulse(out, sr, { at, T: rng.vary(0.01, 0.15), amp: 0.8, b: 1.1, rise: 2 / sr });
  tone(out, sr, { at, f: rng.vary(50, 0.1), f1: 25, glide: 0.15, attack: 0.006, decay: 0.16, amp: 1.0 });
  noiseBurst(out, rng, sr, { at, attack: 0.004, decay: 0.12, amp: 0.5, filter: 'lp', f: 900, f1: 200, glide: 0.1, q: 0.7, color: 'pink' });
  filter(out, sr, 'lowpass', 900, 0.7, 0, 0, nSamples(0.4, sr));
  rumble(out, rng, sr, { at: at + 0.03, attack: 0.08, decay: 1.0, amp: 0.4, f: 600, f1: 110, glide: 1.0, roll: 2.2, rollDepth: 0.65, color: 'brown' });
  echoes(out, rng, sr, { at, count: 9, first: 0.25, last: 3.0, amp: 0.35, fc: 500, smear: 0.07, thump: 40 });
  return finish(out, sr, 0.85, 0.4);
}

// Dirt clods, pebbles and rubble raining down after a blast, with settling dust.
function debrisLayer(out, rng, sr, t0, t1, peakRate, amp) {
  const span = t1 - t0;
  scatter(
    rng,
    t0,
    t1,
    (t) => {
      const u = (t - t0) / span;
      return peakRate * (u < 0.08 ? u / 0.08 : Math.exp(-(u - 0.08) / 0.3)) + 2;
    },
    (t, u) => {
      const a = rng.pareto(1.4, 0.08) * amp * (1 - u * 0.7);
      if (rng.chance(0.55)) {
        thud(out, rng, sr, { at: t, amp: a, f: rng.range(120, 300), tau: rng.range(0.006, 0.02), fc: rng.range(500, 1200) });
      } else {
        addMode(out, nSamples(t, sr), rng.range(1500, 5000), a * 0.5, rng.range(0.002, 0.005), sr, Math.PI / 2);
        noiseGrain(out, rng, nSamples(t, sr), rng.int(4, 16), a * 0.3);
      }
    },
  );
}

function debrisRain(rng, sr) {
  const out = buffer(2.5, sr);
  debrisLayer(out, rng, sr, 0, 2.4, 70, 0.5);
  noiseBurst(out, rng, sr, { at: 0, attack: 0.15, decay: 0.9, amp: 0.08, filter: 'lp', f: 3000, color: 'pink' });
  const chunks = rng.int(3, 5);
  for (let k = 0; k < chunks; k++) strike(out, rng, sr, rng.range(0.05, 1.2), { amp: rng.range(0.15, 0.35), f: rng.range(700, 1600), tau: 0.01, modes: 3, ratios: RATIOS.wood, thump: 0.4 });
  return finish(out, sr, 0.45, 0.2, 25);
}

// 75-88 mm HE shell: bigger and deeper than a grenade, throws up a column of earth.
function shellExplosion(rng, sr) {
  const out = buffer(3.2, sr);
  const at = 0.001;
  blastPulse(out, sr, { at, T: rng.vary(0.006, 0.15), amp: 1, b: 1.1, rise: 1 / sr });
  tone(out, sr, { at, f: rng.vary(58, 0.08), f1: 22, glide: 0.15, attack: 0.001, decay: 0.18, amp: 1.0, h2: 0.25 });
  tone(out, sr, { at, f: 30, f1: 20, glide: 0.4, attack: 0.02, decay: 0.5, amp: 0.5 });
  noiseBurst(out, rng, sr, { at, attack: 0.0003, decay: 0.035, amp: 0.75, filter: 'lp', f: 10000, f1: 400, glide: 0.08, q: 0.6 });
  noiseBurst(out, rng, sr, { at, attack: 0.005, decay: 0.28, amp: 0.5, filter: 'lp', f: 3000, f1: 200, glide: 0.25, q: 0.7, color: 'pink' });
  scatter(rng, at + 0.003, at + 0.2, 500, (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(3, 14), rng.pareto(1.3, 0.1) * 0.4 * (1 - u)));
  reflect(out, sr, 0.006, 0.55, 3500, 0.4);
  saturate(out, 3.2, 0, nSamples(0.6, sr));
  rumble(out, rng, sr, { at: at + 0.03, attack: 0.05, decay: 0.8, amp: 0.32, f: 1100, f1: 120, glide: 0.7, roll: 3, rollDepth: 0.6, color: 'brown' });
  echoes(out, rng, sr, { at, count: 8, first: 0.25, last: 2.5, amp: 0.28, fc: 800, smear: 0.06, thump: 45 });
  noiseBurst(out, rng, sr, { at: at + 0.04, attack: 0.04, decay: 0.4, amp: 0.2, filter: 'bp', f: 1800, q: 0.5 });
  debrisLayer(out, rng, sr, 0.25, 2.4, 60, 0.15);
  return finish(out, sr, 1.0, 0.3);
}

// Tank destroyed, ammunition cooking off: the main blast, the hull ringing,
// secondary bangs and crackling small-arms rounds, metal pieces landing, and the
// roar of the fire taking hold.
function tankExplosion(rng, sr) {
  const out = buffer(5.0, sr);
  const at = 0.001;
  blastPulse(out, sr, { at, T: 0.008, amp: 1, b: 1.1, rise: 1 / sr });
  tone(out, sr, { at, f: 45, f1: 18, glide: 0.25, attack: 0.002, decay: 0.3, amp: 1.0, h2: 0.3 });
  tone(out, sr, { at, f: 28, f1: 18, glide: 0.5, attack: 0.03, decay: 0.9, amp: 0.5 });
  noiseBurst(out, rng, sr, { at, attack: 0.0003, decay: 0.05, amp: 0.8, filter: 'lp', f: 8000, f1: 300, glide: 0.1, q: 0.6 });
  noiseBurst(out, rng, sr, { at, attack: 0.006, decay: 0.4, amp: 0.55, filter: 'lp', f: 2500, f1: 150, glide: 0.3, q: 0.7, color: 'pink' });
  strike(out, rng, sr, at, { amp: 0.35, f: rng.range(85, 120), ratios: RATIOS.steel, tau: 0.5, modes: 8, click: 0, damp: 0.4 });
  reflect(out, sr, 0.007, 0.5, 3000, 0.5);
  saturate(out, 3.5, 0, nSamples(0.8, sr));
  rumble(out, rng, sr, { at: at + 0.04, attack: 0.08, decay: 1.2, amp: 0.35, f: 900, f1: 100, glide: 1.0, roll: 2.5, rollDepth: 0.6, color: 'brown' });
  echoes(out, rng, sr, { at, count: 10, first: 0.3, last: 3.8, amp: 0.3, fc: 700, smear: 0.07, thump: 40 });
  rumble(out, rng, sr, { at: 0.5, attack: 0.6, decay: 2.0, amp: 0.15, f: 600, f1: 300, glide: 2, roll: 7, rollDepth: 0.6, color: 'brown', dur: 4.4 });
  const bangs = rng.int(6, 11);
  for (let k = 0; k < bangs; k++) {
    const t = 0.4 + 4.0 * Math.pow(rng.next(), 1.3);
    const a = rng.range(0.15, 0.45);
    blastPulse(out, sr, { at: t, T: rng.range(0.001, 0.003), amp: a, b: 1.2, rise: 1 / sr });
    noiseBurst(out, rng, sr, { at: t, attack: 0.0003, decay: 0.02, amp: a * 0.8, filter: 'lp', f: 5000, f1: 600, glide: 0.02 });
    tone(out, sr, { at: t, f: 90, f1: 50, glide: 0.03, attack: 0.001, decay: 0.03, amp: a * 0.6 });
    if (rng.chance(0.5)) scatter(rng, t, t + rng.range(0.05, 0.25), 120, (tt) => noiseGrain(out, rng, nSamples(tt, sr), rng.int(2, 6), rng.pareto(1.3, 0.1) * 0.3));
  }
  for (let k = 0; k < 3; k++) strike(out, rng, sr, rng.range(0.3, 1.5), { amp: rng.range(0.1, 0.2), f: rng.range(300, 700), ratios: RATIOS.can, tau: 0.08, modes: 5, click: 0.5, thump: 0.3 });
  return finish(out, sr, 1.0, 0.5);
}

export const EXPLOSIONS = {
  grenadeExplosion: { dur: 2.6, make: grenadeExplosion },
  explosionFar: { dur: 3.5, make: explosionFar },
  shellExplosion: { dur: 3.2, make: shellExplosion },
  debrisRain: { dur: 2.5, make: debrisRain },
  tankExplosion: { dur: 5.0, make: tankExplosion },
};

// ---------------------------------------------------------------------------
// Vehicles

// Engine reference speeds: the AudioSystem (or game) plays the loop at
// rate = rpm / refRpm. Firing frequency of a 4-stroke engine = rpm/60 * cyl/2.
export const ENGINE_SPECS = {
  engineJeep: { refRpm: 2000, cylinders: 4, idleRpm: 600, maxRpm: 4000 }, // Willys "Go Devil" I4
  engineTankGas: { refRpm: 1800, cylinders: 12, idleRpm: 600, maxRpm: 3000 }, // Maybach HL 120/230 V12
  engineTankDiesel: { refRpm: 1600, cylinders: 12, idleRpm: 500, maxRpm: 2000 }, // T-34 V-2 diesel V12
};
for (const s of Object.values(ENGINE_SPECS)) s.firingHz = (s.refRpm / 60) * (s.cylinders / 2);

const ENGINES = {
  // Four-cylinder gasoline: distinct exhaust pops through a small muffler, valve
  // train ticking, a buzzy intake.
  engineJeep: {
    loop: 2.4,
    pipeF: 160,
    pipeTau: 0.006,
    pipeAmp: 1.0,
    popAmp: 0.5,
    popLen: 0.0015,
    uneven: 0.12,
    jitter: 0.015,
    randAmp: 0.1,
    order: 0.1,
    lp: 1300,
    valve: 0.05,
    knock: 0,
    bed: [0.15, 900, 0.6, 'pink'],
    rumble: 0.1,
    level: 0.7,
  },
  // Big gasoline V12: dense exhaust roar with a deep, uneven rumble from the two
  // banks and the long pipes, and a cooling-fan whine.
  engineTankGas: {
    loop: 2.0,
    pipeF: 95,
    pipeTau: 0.012,
    pipeAmp: 1.0,
    popAmp: 0.3,
    popLen: 0.002,
    uneven: 0.18,
    jitter: 0.02,
    randAmp: 0.12,
    order: 0.3,
    lp: 750,
    valve: 0.02,
    knock: 0,
    bed: [0.3, 400, 0.6, 'brown'],
    rumble: 0.35,
    fan: 0.04,
    level: 0.75,
  },
  // V-2 diesel: hard combustion knock at every firing (the clatter), rougher,
  // less muffled than the gasoline engines.
  engineTankDiesel: {
    loop: 2.1,
    pipeF: 110,
    pipeTau: 0.008,
    pipeAmp: 0.9,
    popAmp: 0.35,
    popLen: 0.0015,
    uneven: 0.25,
    jitter: 0.04,
    randAmp: 0.2,
    order: 0.25,
    lp: 1800,
    valve: 0,
    knock: 0.4,
    bed: [0.22, 500, 0.6, 'brown'],
    rumble: 0.3,
    level: 0.75,
  },
};

function engineLoop(id, rng, sr) {
  const p = ENGINES[id];
  const spec = ENGINE_SPECS[id];
  const cycle = 120 / spec.refRpm; // two crank revolutions
  const nCycles = Math.max(1, Math.round(p.loop / cycle));
  const L = nCycles * cycle;
  const len = nSamples(L, sr);
  const cyl = spec.cylinders;
  const dt = cycle / cyl;
  const long = new Float32Array(len + nSamples(0.3, sr));
  const cylAmp = [];
  const cylDt = [];
  for (let c = 0; c < cyl; c++) {
    cylAmp.push(rng.range(1 - p.uneven, 1 + p.uneven));
    cylDt.push(rng.bi() * 0.04 * dt);
  }
  const orderPh = rng.next() * TAU;
  for (let k = 0; k < nCycles * cyl; k++) {
    const c = k % cyl;
    let t = k * dt + cylDt[c] + rng.bi() * p.jitter * dt;
    t = (t + L) % L;
    // First-order (once per crank revolution) imbalance: the low "lope"/rumble.
    const order = 1 + p.order * Math.cos((TAU * 2 * k) / cyl + orderPh);
    const a = cylAmp[c] * rng.range(1 - p.randAmp, 1 + p.randAmp) * order;
    const i = nSamples(t, sr);
    addMode(long, i, p.pipeF * rng.vary(1, 0.03), a * p.pipeAmp, p.pipeTau, sr, 0);
    noiseGrain(long, rng, i, Math.max(2, nSamples(p.popLen, sr)), a * p.popAmp, false);
    if (p.knock) strike(long, rng, sr, t, { amp: a * p.knock * rng.range(0.6, 1.2), f: rng.range(1600, 2400), tau: 0.003, modes: 4, click: 0.8 });
    if (p.valve) addMode(long, i + nSamples(dt * 0.4, sr), rng.range(3500, 5000), p.valve * a, 0.0015, sr, Math.PI / 2);
  }
  // Exhaust system / muffler and the hull or body: LTI filtering on the long render
  // folds back exactly like the events themselves.
  filter(long, sr, 'lowpass', p.lp, 0.8);
  filter(long, sr, 'peaking', p.pipeF * 0.5, 1.2, 4);
  const out = fold(long, len);
  // Continuous bed (intake roar, mechanical hiss) pulsing with the firing.
  const [bedAmp, bedF, bedQ, bedColor] = p.bed;
  const X = nSamples(0.25, sr);
  const bed = new Float32Array(len + X);
  const svf = new SVF(sr, bedF, bedQ);
  const nz = new Noise(rng);
  const brownBed = bedColor === 'brown';
  const fFire = 1 / dt;
  const fCycle = 1 / cycle;
  // Firing-rate pulsation from rotating phasors (no trig per sample).
  const wF = (TAU * fFire) / sr,
    wC = (TAU * fCycle) / sr;
  const cF = Math.cos(wF),
    sF = Math.sin(wF),
    cC = Math.cos(wC),
    sC = Math.sin(wC);
  let rF = 1,
    iF = 0,
    rC = 1,
    iC = 0;
  for (let i = 0; i < bed.length; i++) {
    const m = 0.6 + 0.4 * rF * (0.7 + 0.3 * rC);
    let t = rF * cF - iF * sF;
    iF = rF * sF + iF * cF;
    rF = t;
    t = rC * cC - iC * sC;
    iC = rC * sC + iC * cC;
    rC = t;
    svf.process(brownBed ? nz.brown() : nz.pink());
    bed[i] = (brownBed ? svf.lp : svf.bpn) * m * bedAmp;
  }
  const bedLoop = loopify(bed, len, true);
  for (let i = 0; i < len; i++) out[i] += bedLoop[i];
  // Low hull/body rumble at the cycle and crank orders (periodic tones).
  if (p.rumble) {
    for (const [mult, a] of [
      [1, 1],
      [2, 0.7],
      [0.5, 0.5],
    ]) {
      const f = loopFreq(fCycle * mult * 2, L);
      addSine(out, f, a * p.rumble * 0.3, rng.next() * TAU, sr);
    }
  }
  if (p.fan) {
    const f = loopFreq(rng.range(1000, 1200), L);
    addSine(out, f, p.fan, 0, sr);
    addSine(out, 2 * f, 0.3 * p.fan, 0, sr);
  }
  return normalize(settleLoop(out, sr, 15), p.level);
}

// Steady sine over a whole buffer (loop-quantized frequencies stay periodic), via
// a rotating phasor renormalized every 1024 samples.
function addSine(out, f, amp, phase, sr) {
  const w = (TAU * f) / sr;
  const c = Math.cos(w),
    s = Math.sin(w);
  let re = Math.cos(phase),
    im = Math.sin(phase);
  for (let i = 0; i < out.length; i++) {
    out[i] += im * amp;
    const t = re * c - im * s;
    im = re * s + im * c;
    re = t;
    if ((i & 1023) === 1023) {
      // Recompute exactly to keep long loops phase-accurate.
      const ph = phase + w * (i + 1);
      re = Math.cos(ph);
      im = Math.sin(ph);
    }
  }
}

// High-pass a loop circularly (run the filter over the loop twice and keep the
// second pass), so the filter's start-up does not leave a seam.
function settleLoop(buf, sr, f) {
  const n = buf.length;
  const a = Math.exp((-TAU * f) / sr);
  let x1 = 0,
    y1 = 0;
  const out = new Float32Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const x = buf[i];
      y1 = a * (y1 + x - x1);
      x1 = x;
      if (pass === 1) out[i] = y1;
    }
  }
  return out;
}

// Track link clatter at a reference link rate of 12 links/s (about 2 m/s for
// 170 mm links): sprocket and road-wheel clanks on both tracks, loose rattles,
// guide horns squealing on the wheels, and grinding underneath.
export const TRACK_SPEC = { refLinksPerSecond: 12, refSpeed: 2.0 };

function tracksClank(rng, sr) {
  const L = 3.0;
  const len = nSamples(L, sr);
  const long = new Float32Array(len + nSamples(0.4, sr));
  const rate = TRACK_SPEC.refLinksPerSecond;
  const n = Math.round(L * rate);
  const period = L / n;
  for (let side = 0; side < 2; side++) {
    const off = side * period * rng.range(0.3, 0.7);
    for (let k = 0; k < n; k++) {
      const t = (k * period + off + rng.bi() * 0.06 * period + L) % L;
      const a = rng.range(0.5, 1);
      strike(long, rng, sr, t, { amp: a, f: rng.range(180, 320), ratios: RATIOS.steel, tau: 0.04, modes: 6, click: 0.7, thump: 0.5, thumpF: 70, damp: 0.5 });
      strike(long, rng, sr, t + 0.002, { amp: a * 0.3, f: rng.range(1200, 2200), tau: 0.012, modes: 4, click: 0.3 });
      const t2 = (t + period * rng.range(0.4, 0.6)) % L;
      strike(long, rng, sr, t2, { amp: a * rng.range(0.25, 0.45), f: rng.range(150, 260), ratios: RATIOS.steel, tau: 0.03, modes: 5, click: 0.4, thump: 0.4, thumpF: 60 });
    }
  }
  scatter(rng, 0, L, 40, (t) => strike(long, rng, sr, t, { amp: rng.range(0.06, 0.15), f: rng.range(800, 3000), tau: 0.008, modes: 3, click: 0.4 }));
  const squeals = rng.int(1, 3);
  for (let k = 0; k < squeals; k++) {
    const t = rng.range(0, L);
    const f = rng.range(700, 1300);
    tone(long, sr, { at: t, f, f1: f * rng.range(0.9, 1.1), glide: 0.2, attack: 0.03, hold: rng.range(0.1, 0.25), decay: 0.05, amp: 0.1, h2: 0.3, h3: 0.1 });
  }
  const out = fold(long, len);
  const X = nSamples(0.3, sr);
  const bed = new Float32Array(len + X);
  const nz = new Noise(rng);
  const mid = new SVF(sr, 1200, 0.8);
  const lp = new SVF(sr, 300, 0.7);
  for (let i = 0; i < bed.length; i++) {
    lp.process(nz.brown());
    mid.process(nz.white());
    bed[i] = lp.lp * 0.3 + mid.bpn * 0.05;
  }
  const bedLoop = loopify(bed, len, true);
  for (let i = 0; i < len; i++) out[i] += bedLoop[i];
  return normalize(settleLoop(out, sr, 25), 0.8);
}

function gearShift(rng, sr) {
  const out = buffer(0.6, sr);
  thud(out, rng, sr, { at: 0.01, amp: 0.6, f: 90, tau: 0.03, fc: 400 });
  strike(out, rng, sr, 0.05, { amp: 0.5, f: 900, ratios: RATIOS.steel, tau: 0.02, thump: 0.3, modes: 5 });
  scrape(out, rng, sr, { at: 0.08, dur: 0.12, amp: 0.2, f: 1200, f1: 1600, grains: 60 });
  scrape(out, rng, sr, { at: 0.22, dur: 0.06, amp: 0.3, f: 1800, q: 3, rough: 0.9, roughRate: 600, grains: 400, res: [[1500, 0.01], [2600, 0.008]] });
  strike(out, rng, sr, 0.29, { amp: 1.0, f: rng.range(600, 800), ratios: RATIOS.steel, tau: 0.03, modes: 6, thump: 0.6, thumpF: 120 });
  return finish(out, sr, 0.45, 0.05, 30);
}

// Electric/hydraulic traverse motor: motor hum and harmonics, gear-train whine
// with a slight periodic wobble, stator slot whine, brush noise.
function turretMotor(rng, sr) {
  const L = 2.0;
  const len = nSamples(L, sr);
  const out = new Float32Array(len);
  const fm = loopFreq(rng.range(140, 160), L);
  const fg = loopFreq(rng.range(620, 720), L);
  const fs = loopFreq(rng.range(1400, 1700), L);
  const fh = loopFreq(100, L);
  const wob = 3 / L;
  const wobDepth = 0.004;
  const harm = [0.3, 0.2, 0.15, 0.1, 0.07, 0.05];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    const pm = TAU * fm * t;
    for (let k = 0; k < harm.length; k++) s += harm[k] * Math.sin((k + 1) * pm);
    // Gear whine with a periodic frequency wobble (phase stays periodic in L).
    const pg = TAU * fg * t - ((fg * wobDepth) / wob) * Math.cos(TAU * wob * t);
    s += 0.35 * Math.sin(pg) + 0.15 * Math.sin(2 * pg);
    s += 0.12 * Math.sin(TAU * fs * t);
    s += 0.15 * Math.sin(TAU * fh * t);
    out[i] = s;
  }
  const X = nSamples(0.2, sr);
  const brush = new Float32Array(len + X);
  const bp = new SVF(sr, 3500, 0.8);
  const fc = loopFreq(300, L);
  for (let i = 0; i < brush.length; i++) {
    bp.process(rng.next() * 2 - 1);
    brush[i] = bp.bpn * (0.4 + 0.6 * Math.abs(Math.sin((Math.PI * fc * i) / sr))) * 0.12;
  }
  const brushLoop = loopify(brush, len, true);
  for (let i = 0; i < len; i++) out[i] += brushLoop[i];
  return normalize(out, 0.5);
}

function brakeSqueal(rng, sr) {
  const out = buffer(1.2, sr);
  const f0 = rng.range(1800, 3200);
  const n = out.length;
  const rough = randomCurve(rng, n, sr, 25);
  const drift = randomCurve(rng, n, sr, 6);
  const rub = new SVF(sr, 1500, 0.8);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.06) * Math.min(1, (1.15 - t) / 0.25) * (0.5 + 0.5 * rough[i]);
    const f = f0 * (1 + 0.012 * (drift[i] - 0.5) - 0.03 * t);
    ph += (TAU * f) / sr;
    rub.process(rng.next() * 2 - 1);
    out[i] = (Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph)) * env * 0.6 + rub.bpn * 0.1 * Math.max(0, env);
  }
  return finish(out, sr, 0.35, 0.05, 40);
}

function tireSkid(rng, sr) {
  const L = 2.0;
  const len = nSamples(L, sr);
  const X = nSamples(0.25, sr);
  const all = new Float32Array(len + X);
  const fq = loopFreq(rng.range(850, 1150), L);
  const m1 = 3 / L,
    m2 = 7 / L;
  const d1 = 0.02 * fq,
    d2 = 0.01 * fq;
  const p1 = rng.next() * TAU,
    p2 = rng.next() * TAU;
  const bp = new SVF(sr, 1200, 0.7);
  const nz = new Noise(rng);
  for (let i = 0; i < all.length; i++) {
    const t = i / sr;
    const ph = TAU * fq * t - (d1 / m1) * Math.cos(TAU * m1 * t + p1) - (d2 / m2) * Math.cos(TAU * m2 * t + p2);
    const am = 0.6 + 0.25 * Math.sin(TAU * (5 / L) * t + p2) + 0.15 * Math.sin(TAU * (11 / L) * t + p1);
    bp.process(nz.pink());
    all[i] = (Math.sin(ph) + 0.3 * Math.sin(2 * ph)) * am * 0.35 + bp.bpn * 0.5;
  }
  const out = loopify(all, len, true);
  const grit = new Float32Array(len + nSamples(0.05, sr));
  scatter(rng, 0, L, 120, (t) => noiseGrain(grit, rng, nSamples(t, sr), rng.int(3, 12), rng.pareto(1.4, 0.05) * 0.3));
  const g = fold(grit, len);
  for (let i = 0; i < len; i++) out[i] += g[i];
  return normalize(settleLoop(out, sr, 40), 0.6);
}

function vehicleImpact(rng, sr) {
  const out = buffer(1.5, sr);
  const at = 0.001;
  thud(out, rng, sr, { at, amp: 1.0, f: 55, tau: 0.08, fc: 250 });
  noiseBurst(out, rng, sr, { at, attack: 0.001, decay: 0.05, amp: 0.6, filter: 'lp', f: 3000, f1: 300, glide: 0.05 });
  strike(out, rng, sr, at, { amp: 0.6, f: rng.range(110, 180), ratios: RATIOS.steel, tau: 0.25, modes: 8, click: 0.6, damp: 0.5 });
  scatter(rng, at, at + 0.3, 300, (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(5, 30), rng.pareto(1.3, 0.1) * 0.4 * (1 - u)));
  scatter(
    rng,
    0.15,
    1.2,
    (t) => 25 * Math.exp(-(t - 0.15) / 0.4) + 1,
    (t, u) => strike(out, rng, sr, t, { amp: 0.15 * (1 - u), f: rng.range(1500, 4000), tau: 0.01, modes: 3 }),
  );
  scatter(rng, 0.05, 0.5, 30, (t) => addMode(out, nSamples(t, sr), rng.logRange(3000, 9000), 0.08, rng.range(0.008, 0.03), sr, 0));
  saturate(out, 1.8, 0, nSamples(0.3, sr));
  return finish(out, sr, 0.9, 0.2);
}

export const VEHICLES = {
  engineJeep: { dur: null, make: (rng, sr) => engineLoop('engineJeep', rng, sr), loop: true },
  engineTankGas: { dur: null, make: (rng, sr) => engineLoop('engineTankGas', rng, sr), loop: true },
  engineTankDiesel: { dur: null, make: (rng, sr) => engineLoop('engineTankDiesel', rng, sr), loop: true },
  tracksClank: { dur: 3.0, make: tracksClank, loop: true },
  gearShift: { dur: 0.6, make: gearShift },
  turretMotor: { dur: 2.0, make: turretMotor, loop: true },
  brakeSqueal: { dur: 1.2, make: brakeSqueal },
  tireSkid: { dur: 2.0, make: tireSkid, loop: true },
  vehicleImpact: { dur: 1.5, make: vehicleImpact },
};
for (const id of Object.keys(ENGINES)) {
  const cycle = 120 / ENGINE_SPECS[id].refRpm;
  VEHICLES[id].dur = Math.max(1, Math.round(ENGINES[id].loop / cycle)) * cycle;
}

// ---------------------------------------------------------------------------
// Ambience (seamless loops)

// Gust strength in [0.08, 1]: a sum of slow sines with whole cycles per loop.
function gustCurve(rng, L, parts = [1, 3, 7, 13], depth = [0.22, 0.14, 0.08, 0.05]) {
  const ph = parts.map(() => rng.next() * TAU);
  return (t) => {
    let g = 0.55;
    for (let k = 0; k < parts.length; k++) g += depth[k] * Math.sin((TAU * parts[k] * t) / L + ph[k]);
    return clamp(g, 0.08, 1);
  };
}

function windBed(rng, sr, L, gust, { amp = 1, whistle = 1, cutoff = 900 } = {}) {
  const len = nSamples(L, sr);
  const all = new Float32Array(len + nSamples(1.0, sr));
  const nz = new Noise(rng);
  const lp = new SVF(sr, 300, 0.6);
  const bp = new SVF(sr, 1500, 0.5);
  const w1 = new SVF(sr, 500, 18);
  const w2 = new SVF(sr, 800, 22);
  let gLow = 0,
    gMid = 0,
    gWh = 0;
  for (let i = 0; i < all.length; i++) {
    if ((i & 31) === 0) {
      // Gusts move over seconds: update gains and filters every 32 samples.
      const g = gust((i % len) / sr);
      lp.set(180 + cutoff * g, 0.6);
      bp.set(1200 + 1500 * g, 0.5);
      w1.set(380 + 520 * g, 18);
      w2.set((380 + 520 * g) * 1.65, 22);
      gLow = Math.pow(g, 1.5) * 0.8 * amp;
      gMid = g * g * 0.15 * amp;
      gWh = (g > 0.45 ? (g - 0.45) * (g - 0.45) * 2.5 * whistle : 0) * amp;
    }
    lp.process(nz.brown());
    const p = nz.pink();
    bp.process(p);
    w1.process(p);
    w2.process(p);
    all[i] = lp.lp * gLow + bp.bpn * gMid + (w1.bpn + 0.5 * w2.bpn) * gWh;
  }
  return loopify(all, len, true);
}

function wind(rng, sr) {
  const L = 8;
  const out = windBed(rng, sr, L, gustCurve(rng, L));
  return normalizeRms(settleLoop(out, sr, 20), 0.08);
}

function windTrees(rng, sr) {
  const L = 6;
  const len = nSamples(L, sr);
  const gust = gustCurve(rng, L, [1, 2, 5, 11], [0.25, 0.12, 0.1, 0.05]);
  const out = windBed(rng, sr, L, gust, { amp: 0.4, whistle: 0.3, cutoff: 600 });
  // Leaves: countless tiny rustles, denser and louder in the gusts.
  const leaves = new Float32Array(len + nSamples(0.1, sr));
  scatter(
    rng,
    0,
    L,
    (t) => 30 + 500 * gust(t) * gust(t),
    (t) => {
      const g = gust(t);
      const i = nSamples(t, sr);
      noiseGrain(leaves, rng, i, rng.int(nSamples(0.002, sr), nSamples(0.012, sr)), rng.pareto(1.6, 0.1) * 0.25 * g);
    },
  );
  const l = fold(leaves, len);
  filter(l, sr, 'highpass', 1500, 0.7);
  for (let i = 0; i < len; i++) out[i] += l[i];
  return normalizeRms(settleLoop(out, sr, 30), 0.06);
}

function riverWater(rng, sr) {
  const L = 5;
  const len = nSamples(L, sr);
  const all = new Float32Array(len + nSamples(0.5, sr));
  const nz = new Noise(rng);
  const bp = new SVF(sr, 700, 0.5);
  const lp = new SVF(sr, 300, 0.6);
  const ph1 = rng.next() * TAU,
    ph2 = rng.next() * TAU;
  let am = 1;
  for (let i = 0; i < all.length; i++) {
    if ((i & 31) === 0) {
      const t = (i % len) / sr;
      am = 1 + 0.12 * Math.sin((TAU * 2 * t) / L + ph1) + 0.08 * Math.sin((TAU * 5 * t) / L + ph2);
    }
    bp.process(nz.pink());
    lp.process(nz.brown());
    all[i] = (bp.bpn * 0.3 + lp.lp * 0.2) * am;
  }
  const out = loopify(all, len, true);
  const ev = new Float32Array(len + nSamples(0.3, sr));
  // Babble: bubbles ringing at their Minnaert frequency, rising as they shrink.
  scatter(rng, 0, L, 160, (t) => bubble(ev, sr, t, rng.logRange(350, 2200), rng.pareto(1.6, 0.05) * 0.5, rng.range(0.004, 0.014), rng.range(1.2, 1.8)));
  scatter(rng, 0, L, 6, (t) => bubble(ev, sr, t, rng.range(120, 300), 0.3, rng.range(0.03, 0.06), rng.range(1.2, 1.6)));
  const e = fold(ev, len);
  for (let i = 0; i < len; i++) out[i] += e[i];
  return normalizeRms(settleLoop(out, sr, 40), 0.08);
}

// Far-off fighting: scattered rifle reports, machine-gun bursts and artillery
// thumps, all low-passed by kilometers of air, over a rolling rumble whose
// level follows the activity.
function distantBattle(rng, sr) {
  const L = 10;
  const len = nSamples(L, sr);
  const long = new Float32Array(len + nSamples(3.5, sr));
  const activity = new Float32Array(len + nSamples(3.5, sr));
  const addActivity = (t, a, tau) => {
    const i0 = nSamples(t, sr);
    const n = Math.min(activity.length - i0, nSamples(tau * 6, sr));
    const k = Math.exp(-1 / (tau * sr));
    let e = a;
    for (let i = 0; i < n; i++) {
      activity[i0 + i] += e * Math.min(1, i / (0.03 * sr));
      e *= k;
    }
  };
  const pop = (t, a, fc) => {
    blastPulse(long, sr, { at: t, T: rng.range(0.003, 0.006), amp: a, b: 1.1, rise: 2 / sr });
    noiseBurst(long, rng, sr, { at: t, attack: 0.001, decay: 0.01, amp: a * 0.4, filter: 'lp', f: fc });
    for (let k = 0; k < 3; k++) noiseBurst(long, rng, sr, { at: t + rng.range(0.15, 1.2), attack: 0.005, decay: 0.04, amp: a * rng.range(0.1, 0.25), filter: 'lp', f: fc * 0.6 });
  };
  const shots = rng.int(5, 9);
  for (let k = 0; k < shots; k++) {
    const t = rng.range(0, L);
    const a = rng.range(0.15, 0.5);
    pop(t, a, rng.range(1200, 2500));
    addActivity(t, a * 0.6, 0.6);
  }
  const bursts = rng.int(1, 2);
  for (let k = 0; k < bursts; k++) {
    const t0 = rng.range(0, L);
    const gap = rng.chance(0.5) ? 0.05 : rng.range(0.09, 0.12); // MG 42 or a slower gun
    const n = rng.int(6, 15);
    const a = rng.range(0.15, 0.3);
    for (let j = 0; j < n; j++) pop((t0 + j * gap) % L, a * rng.range(0.8, 1.1), 1500);
    addActivity(t0, a * 1.2, 0.8);
  }
  const thumps = rng.int(1, 2);
  for (let k = 0; k < thumps; k++) {
    const t = rng.range(0, L);
    const a = rng.range(0.6, 1);
    tone(long, sr, { at: t, f: rng.range(38, 48), f1: 24, glide: 0.2, attack: 0.008, decay: 0.25, amp: a });
    noiseBurst(long, rng, sr, { at: t, attack: 0.01, decay: 0.2, amp: a * 0.4, filter: 'lp', f: 400, color: 'pink' });
    addActivity(t, a, 1.4);
  }
  const ev = fold(long, len);
  filter(ev, sr, 'lowpass', 2500, 0.7);
  const act = fold(activity, len);
  const X = nSamples(0.5, sr);
  const bed = new Float32Array(len + X);
  const nz = new Noise(rng);
  const lp = new SVF(sr, 350, 0.6);
  for (let i = 0; i < bed.length; i++) {
    lp.process(nz.brown());
    bed[i] = lp.lp * (0.08 + act[i % len]) * 0.5;
  }
  const out = loopify(bed, len, true);
  for (let i = 0; i < len; i++) out[i] += ev[i];
  return normalize(settleLoop(out, sr, 20), 0.5);
}

// Birdsong: nearly pure tones with fast frequency sweeps. Notes are grouped into
// a few song types (chirps, a descending chaffinch-like trill, a fluty warble,
// a distant cuckoo), sparse and quiet.
function birdNote(out, sr, at, dur, f0, f1, shape, amp, vib = 0) {
  const i0 = nSamples(at, sr);
  const n = Math.min(out.length - i0, nSamples(dur, sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const c = shape === 'arch' ? Math.sin(Math.PI * u) : shape === 'up' ? u * u : 1 - (1 - u) * (1 - u);
    const f = (f0 + (f1 - f0) * c) * (1 + vib * Math.sin(TAU * 30 * (i / sr)));
    ph += (TAU * f) / sr;
    const e = Math.pow(Math.sin(Math.PI * u), 1.2);
    out[i0 + i] += (Math.sin(ph) + 0.08 * Math.sin(2 * ph)) * e * amp;
  }
}

function birds(rng, sr) {
  const L = 8;
  const len = nSamples(L, sr);
  const long = new Float32Array(len + nSamples(2.5, sr));
  const songs = rng.int(3, 5);
  for (let s = 0; s < songs; s++) {
    let t = rng.range(0, L);
    const a = rng.range(0.3, 1);
    const type = rng.pick(['chirps', 'trill', 'warble', 'chirps', rng.chance(0.4) ? 'cuckoo' : 'warble']);
    if (type === 'chirps') {
      const n = rng.int(2, 5);
      const f = rng.range(3500, 5200);
      for (let k = 0; k < n; k++) {
        birdNote(long, sr, t, rng.range(0.05, 0.09), f, f * 0.75, 'down', a * 0.8);
        t += rng.range(0.11, 0.2);
      }
    } else if (type === 'trill') {
      const n = rng.int(8, 18);
      const r = rng.range(14, 22);
      const fa = rng.range(4500, 5500),
        fb = fa * rng.range(0.6, 0.72);
      for (let k = 0; k < n; k++) {
        const f = fa + ((fb - fa) * k) / n;
        birdNote(long, sr, t, 0.03, f * 1.08, f * 0.92, 'down', a * 0.6);
        t += 1 / r;
      }
      birdNote(long, sr, t + 0.03, 0.12, fb * 1.1, fb * 0.7, 'arch', a * 0.7);
    } else if (type === 'warble') {
      const n = rng.int(4, 8);
      for (let k = 0; k < n; k++) {
        const f = rng.range(1500, 3200);
        const d = rng.range(0.08, 0.2);
        birdNote(long, sr, t, d, f, f * rng.range(0.8, 1.3), rng.pick(['arch', 'up', 'down']), a * 0.7, 0.02);
        t += d + rng.range(0.03, 0.1);
      }
    } else {
      for (let k = 0; k < 2; k++) {
        birdNote(long, sr, t, 0.18, 700, 680, 'down', a * 0.35);
        birdNote(long, sr, t + 0.26, 0.28, 575, 555, 'down', a * 0.3);
        t += 0.95;
      }
    }
  }
  reflect(long, sr, 0.12, 0.2, 3000, long.length / sr);
  const out = fold(long, len);
  lowpass1(out, sr, 7000);
  return normalize(settleLoop(out, sr, 200), 0.25);
}

// Burning vehicle: a low, flickering roar, hiss, and crackling (sharp clicks in
// clusters, the odd louder pop).
function fire(rng, sr) {
  const L = 4;
  const len = nSamples(L, sr);
  const all = new Float32Array(len + nSamples(0.5, sr));
  const nz = new Noise(rng);
  const lp = new SVF(sr, 300, 0.7);
  const hp = new SVF(sr, 2500, 0.7);
  const parts = [3, 5, 9, 14, 23];
  const ph = parts.map(() => rng.next() * TAU);
  let m = 0.8;
  for (let i = 0; i < all.length; i++) {
    if ((i & 15) === 0) {
      // Flicker: whole cycles per loop, so it wraps.
      const t = (i % len) / sr;
      m = 0.8;
      for (let k = 0; k < parts.length; k++) m += (0.25 / (k + 1)) * Math.sin((TAU * parts[k] * t) / L + ph[k]);
    }
    lp.process(nz.brown());
    hp.process(nz.pink());
    all[i] = lp.lp * m * 0.5 + hp.hp * 0.05;
  }
  const out = loopify(all, len, true);
  const ev = new Float32Array(len + nSamples(0.2, sr));
  scatter(rng, 0, L, 30, (t) => {
    noiseGrain(ev, rng, nSamples(t, sr), rng.int(2, 12), rng.pareto(1.2, 0.05) * 0.8);
    if (rng.chance(0.2)) addMode(ev, nSamples(t, sr), rng.range(1500, 5000), rng.pareto(1.2, 0.05) * 0.3, rng.range(0.001, 0.004), sr, Math.PI / 2);
  });
  scatter(rng, 0, L, 4, (t0) => scatter(rng, t0, t0 + 0.03, 200, (t) => noiseGrain(ev, rng, nSamples(t, sr), rng.int(2, 6), rng.pareto(1.3, 0.05) * 0.4)));
  scatter(rng, 0, L, 1.5, (t) => {
    noiseBurst(ev, rng, sr, { at: t, attack: 0.0003, decay: 0.004, amp: 0.5, filter: 'bp', f: 1200 });
    thud(ev, rng, sr, { at: t, amp: 0.2, f: 150, tau: 0.008, fc: 800 });
  });
  const e = fold(ev, len);
  for (let i = 0; i < len; i++) out[i] += e[i];
  return normalize(settleLoop(out, sr, 25), 0.6);
}

export const AMBIENCE = {
  wind: { dur: 8, make: wind, loop: true },
  windTrees: { dur: 6, make: windTrees, loop: true },
  riverWater: { dur: 5, make: riverWater, loop: true },
  distantBattle: { dur: 10, make: distantBattle, loop: true },
  birds: { dur: 8, make: birds, loop: true },
  fire: { dur: 4, make: fire, loop: true },
};

// ---------------------------------------------------------------------------
// UI

// Natural-trumpet tone: harmonics computed with the Chebyshev recurrence
// (sin k*phi), brighter when louder, a lip "scoop" into the note and a slow
// vibrato on held notes.
function bugleNote(out, sr, at, f, dur, amp, bright) {
  const i0 = nSamples(at, sr);
  const n = Math.min(out.length - i0, nSamples(dur + 0.09, sr));
  const K = Math.max(1, Math.min(14, Math.floor((sr * 0.45) / f)));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const att = Math.min(1, t / 0.03);
    const rel = t > dur ? Math.max(0, 1 - (t - dur) / 0.09) : 1;
    const env = att * rel * (1 + 0.2 * Math.exp(-t / 0.05));
    const vib = t > 0.15 ? 0.004 * Math.sin(TAU * 5.2 * t) * Math.min(1, (t - 0.15) / 0.2) : 0;
    const scoop = -0.03 * Math.exp(-t / 0.025);
    ph += (TAU * f * (1 + vib + scoop)) / sr;
    const b = bright * Math.min(1, env);
    const s1 = Math.sin(ph);
    const c2 = 2 * Math.cos(ph);
    const r = Math.exp(-(1.25 - 0.85 * b));
    let sPrev = 0,
      sCur = s1,
      sum = 0,
      wgt = 1;
    for (let k = 1; k <= K; k++) {
      sum += (sCur / k) * wgt;
      wgt *= r;
      const sNext = c2 * sCur - sPrev;
      sPrev = sCur;
      sCur = sNext;
    }
    out[i0 + i] += sum * env * amp;
  }
}

function bugleCall(rng, sr, notes, dur, bright, level) {
  const out = buffer(dur, sr);
  let t = 0.01;
  for (const [f, d, a] of notes) {
    bugleNote(out, sr, t, f, d, a, bright);
    noiseBurst(out, rng, sr, { at: t, attack: 0.005, decay: 0.02, amp: 0.05 * a, filter: 'bp', f: f * 2, q: 2 });
    t += d + 0.04;
  }
  reflect(out, sr, 0.09, 0.22, 3000, dur);
  reflect(out, sr, 0.21, 0.12, 2000, dur);
  return finish(out, sr, level, 0.1, 60);
}

// Bugle in C: natural harmonics C4 G4 C5 E5 G5.
const G4 = 392,
  C5 = 523.25,
  E5 = 659.26,
  G5 = 783.99;

export const UI = {
  uiClick: {
    dur: 0.08,
    make(rng, sr) {
      const out = buffer(0.08, sr);
      strike(out, rng, sr, 0.001, { amp: 1, f: 2200, ratios: [1, 1.78, 2.73], tau: 0.005, modes: 3, click: 0.9 });
      addMode(out, nSamples(0.001, sr), 650, 0.4, 0.006, sr, 0);
      strike(out, rng, sr, 0.019, { amp: 0.4, f: 2600, ratios: [1, 1.78, 2.73], tau: 0.004, modes: 3, click: 0.6 });
      return finish(out, sr, 0.3, 0.01, 80);
    },
  },
  uiHover: {
    dur: 0.05,
    make(rng, sr) {
      const out = buffer(0.05, sr);
      addMode(out, nSamples(0.001, sr), 3000, 1, 0.003, sr, 0);
      noiseGrain(out, rng, nSamples(0.001, sr), nSamples(0.0005, sr), 0.3);
      lowpass1(out, sr, 6000);
      return finish(out, sr, 0.12, 0.005, 200);
    },
  },
  // A telegraph-like beep with the sounder's click.
  captureTick: {
    dur: 0.12,
    make(rng, sr) {
      const out = buffer(0.12, sr);
      tone(out, sr, { at: 0.002, f: 800, attack: 0.004, hold: 0.05, decay: 0.01, amp: 1, h2: 0.15 });
      strike(out, rng, sr, 0.002, { amp: 0.3, f: 2400, tau: 0.004, modes: 3 });
      return finish(out, sr, 0.25, 0.01, 80);
    },
  },
  objectiveCaptured: {
    dur: 1.6,
    make: (rng, sr) =>
      bugleCall(
        rng,
        sr,
        [
          [G4, 0.13, 0.8],
          [C5, 0.13, 0.85],
          [E5, 0.13, 0.9],
          [G5, 0.62, 1],
        ],
        1.6,
        1,
        0.4,
      ),
  },
  objectiveLost: {
    dur: 1.8,
    make: (rng, sr) =>
      bugleCall(
        rng,
        sr,
        [
          [G5, 0.22, 0.75],
          [E5, 0.22, 0.75],
          [C5, 0.28, 0.7],
          [G4, 0.72, 0.65],
        ],
        1.8,
        0.45,
        0.4,
      ),
  },
  hitMarker: {
    dur: 0.08,
    make(rng, sr) {
      const out = buffer(0.08, sr);
      tone(out, sr, { at: 0.001, f: 180, f1: 120, glide: 0.015, attack: 0.001, decay: 0.015, amp: 1 });
      noiseGrain(out, rng, nSamples(0.001, sr), nSamples(0.0005, sr), 0.3);
      return finish(out, sr, 0.3, 0.01, 40);
    },
  },
};

// ---------------------------------------------------------------------------
// Reverb impulse responses (one channel; call twice with different seeds for a
// decorrelated stereo pair). Scaled to unit energy: the send level then sets
// the reverb loudness directly.

export function reverbIR(kind, rng, sr) {
  const outdoor = kind !== 'indoor';
  const dur = outdoor ? 1.6 : 0.9;
  const out = buffer(dur, sr);
  if (outdoor) {
    // Sparse early reflections: buildings and tree lines 2-40 m away.
    const n = rng.int(7, 11);
    for (let k = 0; k < n; k++) {
      const t = rng.range(0.012, 0.25);
      const a = 0.6 * Math.exp(-t / 0.15) * rng.range(0.4, 1) * (rng.chance(0.5) ? 1 : -1);
      noiseGrain(out, rng, nSamples(t, sr), rng.int(nSamples(0.0005, sr), nSamples(0.002, sr)), a, false);
    }
  } else {
    const n = 18;
    for (let k = 0; k < n; k++) {
      const t = rng.range(0.002, 0.035);
      const a = 0.8 * Math.exp(-t / 0.03) * rng.range(0.3, 1) * (rng.chance(0.5) ? 1 : -1);
      noiseGrain(out, rng, nSamples(t, sr), rng.int(2, 6), a, false);
    }
  }
  // Diffuse tail: velvet noise (sparse random +-1 impulses) whose density grows
  // with time, decaying (RT60 1.2 s outdoors, 0.55 s indoors) and darkening.
  const rt60 = outdoor ? 1.2 : 0.55;
  const tau = rt60 / 6.91;
  const t0 = outdoor ? 0.03 : 0.004;
  const svf = new SVF(sr, outdoor ? 7000 : 9000, 0.6);
  const i0 = nSamples(t0, sr);
  const tail = new Float32Array(out.length);
  const k = Math.exp(-1 / (tau * sr));
  let env = 1;
  for (let i = i0; i < out.length; i++) {
    const t = (i - i0) / sr;
    if ((i & 31) === 0) svf.set(outdoor ? 1200 + 5800 * Math.exp(-t / 0.35) : 3000 + 6000 * Math.exp(-t / 0.2), 0.6);
    const density = outdoor ? 400 + 3000 * Math.min(1, t / 0.4) : 2500 + 6000 * Math.min(1, t / 0.05);
    const x = rng.next() < density / sr ? (rng.next() < 0.5 ? -1 : 1) : 0;
    const att = Math.min(1, t / (outdoor ? 0.06 : 0.005));
    tail[i] = svf.process(x) * env * att * (outdoor ? 0.6 : 0.9);
    env *= k;
  }
  for (let i = 0; i < out.length; i++) out[i] += tail[i];
  fade(out, sr, 0, 0.1);
  let e = 0;
  for (let i = 0; i < out.length; i++) e += out[i] * out[i];
  const g = e > 0 ? 1 / Math.sqrt(e) : 1;
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}

export const IR_DUR = { outdoor: 1.6, indoor: 0.9 };
