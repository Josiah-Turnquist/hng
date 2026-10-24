// Motorcycles and bicycles: the twin-cylinder engines (the Harley's uneven
// V-twin beat, the BMW and M-72 flat twins' even one), kick starting, gear
// changes, crashes, tire blowouts, and the bicycle's freewheel and chain, and
// tires on gravel. Registered in synth.js with the other vehicle sounds.
//
// Loops are seamless the same way as in world.js: events are rendered past the
// loop end and folded back onto the start, noise beds are crossfaded into their
// own start, and tones use whole numbers of cycles per loop.
import {
  RATIOS,
  SVF,
  TAU,
  addMode,
  buffer,
  dcBlock,
  fade,
  filter,
  fold,
  loopFreq,
  loopify,
  Noise,
  noiseBurst,
  noiseGrain,
  normalize,
  nSamples,
  scatter,
  scrape,
  strike,
  thud,
  tone,
} from '../dsp.js';

// Engine reference speeds: the game plays a loop at rate = rpm / refRpm.
// firing: crank angle (degrees of the 720 degree four-stroke cycle) at which
// each cylinder fires.
export const BIKE_ENGINE_SPECS = {
  // Harley-Davidson WLA: 45 degree V-twin with both rods on one crankpin, so the
  // cylinders fire 315 and 405 degrees apart: the uneven "potato-potato" beat.
  engineVTwin: { refRpm: 2000, cylinders: 2, firing: [0, 315], idleRpm: 850, maxRpm: 5100 },
  // BMW R 75: flat twin with a 360 degree crank, one even firing per turn.
  engineBoxer: { refRpm: 2000, cylinders: 2, firing: [0, 360], idleRpm: 700, maxRpm: 4600 },
  // M-72: the same layout with side valves: no rocker clatter, a softer note.
  engineBoxerSV: { refRpm: 2000, cylinders: 2, firing: [0, 360], idleRpm: 700, maxRpm: 5000 },
};

// Bicycle: the freewheel clicks this often per wheel turn (two pawls in an
// 20-notch ratchet, est.), and the chain loop is made at this cadence with the
// bicycle's 46-tooth chainring.
export const FREEWHEEL_SPEC = { refRevPerSec: 2, clicksPerRev: 20 };
export const CHAIN_SPEC = { refCadence: 70, chainring: 46 };

// Per engine: pipe resonance per cylinder (Hz), its decay, exhaust pop, cylinder
// and cycle-to-cycle variation, the silencer's low-pass, valve gear ticks, the
// intake and mechanical bed [level, Hz, Q], and the low frame and flywheel rumble.
const TWINS = {
  // WLA: both cylinders into one pipe and silencer, side valves, heavy flywheels:
  // a deep, soft thump in pairs.
  engineVTwin: {
    loop: 2.4,
    pipeF: [78, 78],
    pipeTau: 0.014,
    h2: 0.35,
    popAmp: 0.5,
    popLen: 0.002,
    uneven: 0.08,
    jitter: 0.012,
    randAmp: 0.12,
    lp: 950,
    valve: 0.03,
    bed: [0.12, 700, 0.7],
    rumble: 0.3,
    level: 0.72,
  },
  // R 75: a pipe per cylinder, overhead valves with their rocker tick.
  engineBoxer: {
    loop: 2.4,
    pipeF: [104, 112],
    pipeTau: 0.01,
    h2: 0.3,
    popAmp: 0.45,
    popLen: 0.0016,
    uneven: 0.06,
    jitter: 0.01,
    randAmp: 0.1,
    lp: 1350,
    valve: 0.08,
    bed: [0.1, 900, 0.7],
    rumble: 0.18,
    level: 0.72,
  },
  // M-72: as the BMW, duller and a little rougher.
  engineBoxerSV: {
    loop: 2.4,
    pipeF: [92, 98],
    pipeTau: 0.012,
    h2: 0.3,
    popAmp: 0.38,
    popLen: 0.0018,
    uneven: 0.1,
    jitter: 0.016,
    randAmp: 0.16,
    lp: 1000,
    valve: 0.025,
    bed: [0.13, 750, 0.7],
    rumble: 0.22,
    level: 0.7,
  },
};

function twinLoop(id, rng, sr) {
  const p = TWINS[id];
  const spec = BIKE_ENGINE_SPECS[id];
  const cycle = 120 / spec.refRpm; // two crank turns
  const nCycles = Math.max(1, Math.round(p.loop / cycle));
  const L = nCycles * cycle;
  const len = nSamples(L, sr);
  const long = new Float32Array(len + nSamples(0.3, sr));
  const cylAmp = spec.firing.map(() => rng.range(1 - p.uneven, 1 + p.uneven));
  for (let k = 0; k < nCycles; k++) {
    for (let c = 0; c < spec.firing.length; c++) {
      const t = (k + spec.firing[c] / 720) * cycle + rng.bi() * p.jitter * cycle * 0.25;
      const i = Math.round((((t % L) + L) % L) * sr);
      const a = cylAmp[c] * rng.range(1 - p.randAmp, 1 + p.randAmp);
      const f = p.pipeF[c] * rng.vary(1, 0.02);
      // The exhaust pulse rings the pipe and silencer; the opening valve pops.
      addMode(long, i, f, a, p.pipeTau, sr, 0);
      addMode(long, i, f * 2.7, a * p.h2, p.pipeTau * 0.45, sr, 0);
      noiseGrain(long, rng, i, Math.max(2, Math.round(p.popLen * sr)), a * p.popAmp, false);
      // Valve gear: a tick as each valve seats.
      for (const ph of [0.28, 0.6]) addMode(long, i + Math.round(ph * cycle * sr), rng.range(2800, 4600), p.valve * rng.range(0.6, 1.1), 0.0012, sr, Math.PI / 2);
    }
  }
  filter(long, sr, 'lowpass', p.lp, 0.8);
  filter(long, sr, 'peaking', p.pipeF[0] * 0.5, 1.2, 4);
  const out = fold(long, len);
  // Intake roar and mechanical hiss, pulsing with each firing.
  const [bedAmp, bedF, bedQ] = p.bed;
  const bed = new Float32Array(len + nSamples(0.2, sr));
  const svf = new SVF(sr, bedF, bedQ);
  const nz = new Noise(rng);
  const fireT = spec.firing.map((d) => (d / 720) * cycle);
  const tauB = cycle * 0.12;
  for (let i = 0; i < bed.length; i++) {
    const tc = (i / sr) % cycle;
    let m = 0.35;
    for (const ft of fireT) {
      const dt = tc >= ft ? tc - ft : tc - ft + cycle;
      m += Math.exp(-dt / tauB);
    }
    svf.process(nz.pink());
    bed[i] = svf.bpn * m * bedAmp;
  }
  const bedLoop = loopify(bed, len, true);
  for (let i = 0; i < len; i++) out[i] += bedLoop[i];
  // Flywheels and frame: low tones at the cycle and crank rates.
  for (const [mult, a] of [
    [1, 1],
    [2, 0.6],
  ]) {
    const f = loopFreq(mult / cycle, L);
    const ph = rng.next() * TAU;
    for (let i = 0; i < len; i++) out[i] += Math.sin(ph + (TAU * f * i) / sr) * a * p.rumble * 0.3;
  }
  return normalize(settle(out, sr, 15), p.level);
}

// High-pass a loop circularly (two passes, keep the second) so the filter's
// start-up leaves no seam.
function settle(buf, sr, f) {
  const n = buf.length;
  const a = Math.exp((-TAU * f) / sr);
  const out = new Float32Array(n);
  let x1 = 0,
    y1 = 0;
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

function finish(out, sr, level, outFade = 0.08, hp = 20) {
  dcBlock(out, sr, hp);
  fade(out, sr, 0, outFade);
  return normalize(out, level);
}

// Kick start: the lever's ratchet and two slow compressions, then the engine
// catches, runs up and settles toward idle (the running loop takes over).
function motoStart(rng, sr) {
  const out = buffer(1.8, sr);
  for (let k = 0; k < 5; k++) strike(out, rng, sr, 0.02 + k * 0.035, { amp: 0.25, f: rng.range(2200, 2800), tau: 0.004, modes: 3, click: 0.8 });
  thud(out, rng, sr, { at: 0.12, amp: 0.35, f: 70, tau: 0.05, fc: 300 });
  thud(out, rng, sr, { at: 0.3, amp: 0.3, f: 65, tau: 0.05, fc: 300 });
  noiseBurst(out, rng, sr, { at: 0.05, attack: 0.08, decay: 0.12, amp: 0.12, filter: 'lp', f: 500, color: 'pink' });
  // Firing: rpm rises from 300 to about 1700 and falls back toward idle.
  let t = 0.38;
  let k = 0;
  while (t < 1.75) {
    const rpm = t < 0.7 ? 300 + ((t - 0.38) / 0.32) * 1400 : 900 + 800 * Math.exp(-(t - 0.7) / 0.25);
    const a = (k === 0 ? 1.3 : 1) * rng.range(0.75, 1.15) * Math.min(1, 1.2 - (t - 0.4) * 0.35);
    const i = Math.round(t * sr);
    const f = rng.range(85, 100);
    addMode(out, i, f, a, 0.013, sr, 0);
    addMode(out, i, f * 2.7, a * 0.3, 0.006, sr, 0);
    noiseGrain(out, rng, i, Math.round(0.002 * sr), a * 0.5, false);
    t += 60 / Math.max(300, rpm) + rng.bi() * 0.006;
    k++;
  }
  filter(out, sr, 'lowpass', 1500, 0.8);
  return finish(out, sr, 0.7, 0.45);
}

// Gear change: the clutch, the selector's click and the dogs engaging with a
// clunk (lighter than a truck's gearbox).
function motoShift(rng, sr) {
  const out = buffer(0.5, sr);
  strike(out, rng, sr, 0.01, { amp: 0.35, f: rng.range(2300, 2800), tau: 0.006, modes: 4, click: 0.8 });
  scrape(out, rng, sr, { at: 0.03, dur: 0.06, amp: 0.12, f: 1500, f1: 1900, grains: 80 });
  strike(out, rng, sr, 0.1, { amp: 0.9, f: rng.range(650, 850), ratios: RATIOS.can, tau: 0.028, modes: 5, thump: 0.5, thumpF: 140 });
  return finish(out, sr, 0.42, 0.05, 30);
}

// A motorcycle goes down: the crash, then steel and footboards scraping along
// the road, bits of glass, a last bounce.
function bikeCrash(rng, sr) {
  const out = buffer(2.0, sr);
  thud(out, rng, sr, { at: 0.01, amp: 1, f: 85, tau: 0.06, fc: 600 });
  strike(out, rng, sr, 0.012, { amp: 0.8, f: rng.range(380, 460), ratios: RATIOS.can, tau: 0.09, modes: 6, thump: 0.4 });
  strike(out, rng, sr, 0.03, { amp: 0.45, f: rng.range(1100, 1400), ratios: RATIOS.steel, tau: 0.05, modes: 5 });
  for (let k = 0; k < 4; k++) strike(out, rng, sr, 0.05 + rng.next() * 0.2, { amp: rng.range(0.05, 0.12), f: rng.range(3000, 5000), ratios: RATIOS.glass, tau: 0.03, modes: 4 });
  scrape(out, rng, sr, {
    at: 0.06,
    dur: 1.6,
    amp: 0.32,
    f: 2200,
    f1: 1300,
    q: 1.2,
    rough: 0.7,
    shape: 'fall',
    grains: 120,
    res: [
      [900, 0.05],
      [1700, 0.03],
    ],
  });
  strike(out, rng, sr, 0.42, { amp: 0.3, f: rng.range(500, 600), ratios: RATIOS.can, tau: 0.05, modes: 4, thump: 0.3 });
  return finish(out, sr, 0.85, 0.3);
}

// A tire shot through: the bang of the air letting go and its hiss.
function tireBurst(rng, sr) {
  const out = buffer(1.0, sr);
  noiseBurst(out, rng, sr, { at: 0.002, attack: 0.0003, decay: 0.008, amp: 1, filter: 'lp', f: 6000 });
  tone(out, sr, { at: 0.002, f: 140, f1: 70, glide: 0.02, attack: 0.001, decay: 0.02, amp: 0.6 });
  noiseBurst(out, rng, sr, { at: 0.01, attack: 0.004, decay: 0.22, amp: 0.25, filter: 'hp', f: 2500 });
  return finish(out, sr, 0.8, 0.1);
}

// A motorcycle's petrol tank catching fire: a deep whump and a roar of flame.
function fuelWhoosh(rng, sr) {
  const out = buffer(2.0, sr);
  thud(out, rng, sr, { at: 0.01, amp: 0.8, f: 55, tau: 0.12, fc: 350 });
  noiseBurst(out, rng, sr, { at: 0.005, attack: 0.04, hold: 0.05, decay: 0.35, amp: 0.7, filter: 'lp', f: 1400, f1: 300, glide: 0.3, color: 'pink' });
  scatter(rng, 0.1, 1.5, 40, (t, u) => noiseGrain(out, rng, Math.round(t * sr), Math.max(2, Math.round(rng.range(0.001, 0.004) * sr)), rng.pareto(1.5, 0.05) * 0.5 * (1 - u), true));
  return finish(out, sr, 0.8, 0.4);
}

// Bicycle freewheel ticking while coasting, at FREEWHEEL_SPEC.refRevPerSec.
function freewheel(rng, sr) {
  const L = 2.0;
  const len = nSamples(L, sr);
  const long = new Float32Array(len + nSamples(0.05, sr));
  const per = 1 / (FREEWHEEL_SPEC.refRevPerSec * FREEWHEEL_SPEC.clicksPerRev);
  const n = Math.round(L / per);
  // Each pawl and each notch a little different, so the ticking has a pattern
  // that repeats every wheel turn.
  const pawl = [rng.range(0.85, 1), rng.range(0.55, 0.8)];
  const notch = Array.from({ length: FREEWHEEL_SPEC.clicksPerRev }, () => rng.range(0.75, 1.1));
  for (let k = 0; k < n; k++) {
    const t = (k * per + rng.bi() * per * 0.04 + L) % L;
    const a = pawl[k % 2] * notch[k % notch.length] * rng.range(0.85, 1.15);
    strike(long, rng, sr, t, { amp: a * 0.5, f: rng.range(2400, 2900), tau: 0.004, modes: 4, click: 0.9, clickLen: 0.0003 });
  }
  filter(long, sr, 'highpass', 700, 0.7);
  return normalize(fold(long, len), 0.5);
}

// Bicycle chain at CHAIN_SPEC.refCadence: rollers seating on the teeth (harder on
// each down stroke, when the chain is under load), a faint creak per stroke and
// the chain's whir.
function pedalChain(rng, sr) {
  const turn = 60 / CHAIN_SPEC.refCadence;
  const L = 3 * turn;
  const len = nSamples(L, sr);
  const long = new Float32Array(len + nSamples(0.25, sr));
  const n = 3 * CHAIN_SPEC.chainring;
  const per = L / n;
  for (let k = 0; k < n; k++) {
    const crank = (k / CHAIN_SPEC.chainring) * TAU;
    const load = 0.45 + 0.55 * Math.abs(Math.sin(crank));
    const t = (k * per + rng.bi() * per * 0.1 + L) % L;
    strike(long, rng, sr, t, { amp: 0.2 * load * rng.range(0.6, 1.2), f: rng.range(1700, 2600), tau: 0.003, modes: 3, click: 0.5 });
  }
  for (let s = 0; s < 6; s++) scrape(long, rng, sr, { at: ((s + 0.25) * turn) / 2, dur: 0.12, amp: 0.05, f: 900, f1: 700, q: 3, rough: 0.8, grains: 10 });
  filter(long, sr, 'lowpass', 7000, 0.7);
  const out = fold(long, len);
  const bed = new Float32Array(len + nSamples(0.2, sr));
  const svf = new SVF(sr, 3000, 0.9);
  const nz = new Noise(rng);
  for (let i = 0; i < bed.length; i++) {
    svf.process(nz.white());
    bed[i] = svf.bpn * 0.05;
  }
  const bedLoop = loopify(bed, len, true);
  for (let i = 0; i < len; i++) out[i] += bedLoop[i];
  return normalize(settle(out, sr, 60), 0.35);
}

// Tires rolling on gravel and dirt: small stones crunching and spitting out, over
// a low rolling rumble. Played faster and louder with speed.
function tireGravel(rng, sr) {
  const L = 3.0;
  const len = nSamples(L, sr);
  const long = new Float32Array(len + nSamples(0.05, sr));
  scatter(rng, 0, L, 260, (t) => {
    noiseGrain(long, rng, Math.round(t * sr), Math.max(2, Math.round(rng.range(0.0008, 0.004) * sr)), rng.pareto(1.4, 0.06) * 0.8, true);
  });
  scatter(rng, 0, L, 6, (t) => strike(long, rng, sr, t, { amp: rng.range(0.1, 0.3), f: rng.range(1800, 3200), ratios: RATIOS.wood, tau: 0.006, modes: 3, click: 0.8 }));
  filter(long, sr, 'lowpass', 5000, 0.7);
  const out = fold(long, len);
  const bed = new Float32Array(len + nSamples(0.25, sr));
  const svf = new SVF(sr, 220, 0.7);
  const nz = new Noise(rng);
  for (let i = 0; i < bed.length; i++) bed[i] = svf.process(nz.brown()) * 0.35;
  const bedLoop = loopify(bed, len, true);
  for (let i = 0; i < len; i++) out[i] += bedLoop[i];
  return normalize(settle(out, sr, 25), 0.55);
}

const engineDur = (id) => {
  const cycle = 120 / BIKE_ENGINE_SPECS[id].refRpm;
  return Math.max(1, Math.round(TWINS[id].loop / cycle)) * cycle;
};

export const BIKE_SOUNDS = {
  engineVTwin: { dur: engineDur('engineVTwin'), loop: true, make: (rng, sr) => twinLoop('engineVTwin', rng, sr) },
  engineBoxer: { dur: engineDur('engineBoxer'), loop: true, make: (rng, sr) => twinLoop('engineBoxer', rng, sr) },
  engineBoxerSV: { dur: engineDur('engineBoxerSV'), loop: true, make: (rng, sr) => twinLoop('engineBoxerSV', rng, sr) },
  motoStart: { dur: 1.8, make: motoStart },
  motoShift: { dur: 0.5, make: motoShift },
  bikeCrash: { dur: 2.0, make: bikeCrash },
  tireBurst: { dur: 1.0, make: tireBurst },
  fuelWhoosh: { dur: 2.0, make: fuelWhoosh },
  freewheel: { dur: 2.0, loop: true, make: freewheel },
  pedalChain: { dur: 3 * (60 / CHAIN_SPEC.refCadence), loop: true, make: pedalChain },
  tireGravel: { dur: 3.0, loop: true, make: tireGravel },
};
