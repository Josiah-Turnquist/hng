// Soldiers: footsteps on each surface, landing, falling, going prone, breathing,
// heartbeat, pain grunts and bandaging.
//
// A footstep is a heel strike and a toe roll 50-110 ms later; each carries the
// boot's thud and the surface's texture: crushed grass blades, gravel grains,
// the click of a hobnailed heel on stone, the hollow knock of floorboards, the
// suction of mud, splashes and droplets, dry leaves crackling.
// Breath is noise shaped by the vocal tract's formants; grunts add a jittery
// glottal pulse train (low, breathy, never speech-like).
import {
  RATIOS,
  Resonator,
  SVF,
  addMode,
  buffer,
  cloth,
  dcBlock,
  fade,
  fold,
  lowpass1,
  Noise,
  nSamples,
  noiseBurst,
  noiseGrain,
  normalize,
  saturate,
  scatter,
  strike,
  thud,
  tone,
} from '../dsp.js';

function finish(out, sr, level, outFade = 0.03, hp = 30) {
  dcBlock(out, sr, hp);
  fade(out, sr, 0, outFade);
  return normalize(out, level);
}

function bubble(out, sr, at, f, amp, tau, rise = 1.5) {
  tone(out, sr, { at, f, f1: f * rise, glide: tau * 1.2, attack: 0.0006, decay: tau, amp });
}

function gait(rng) {
  return { heel: rng.range(0.004, 0.012), toe: rng.range(0.05, 0.11), toeAmp: rng.range(0.4, 0.7) };
}

// Floorboard creak: stick-slip friction (an irregular pulse train) ringing the
// wood's modes.
function creak(out, rng, sr, at, dur, amp) {
  const i0 = nSamples(at, sr);
  const n = Math.min(out.length - i0, nSamples(dur, sr));
  const res = [
    new Resonator(sr, rng.range(650, 800), 0.01),
    new Resonator(sr, rng.range(1200, 1450), 0.008),
    new Resonator(sr, rng.range(2000, 2300), 0.006),
  ];
  const f0 = rng.range(280, 420);
  const f1 = f0 * rng.range(0.8, 1.25);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    ph += ((f0 + (f1 - f0) * u) * (1 + 0.15 * rng.bi())) / sr;
    let x = 0;
    if (ph >= 1) {
      ph -= 1;
      x = 1;
    }
    const env = Math.sin(Math.PI * u);
    const y = res[0].process(x) + 0.7 * res[1].process(x) + 0.4 * res[2].process(x);
    out[i0 + i] += y * env * amp;
  }
}

const STEPS = {
  grass(out, rng, sr) {
    const { heel, toe, toeAmp } = gait(rng);
    thud(out, rng, sr, { at: heel, amp: 0.5, f: rng.range(70, 95), tau: 0.02, fc: 350 });
    thud(out, rng, sr, { at: heel + toe, amp: 0.25 * toeAmp, f: 100, tau: 0.015, fc: 400 });
    noiseBurst(out, rng, sr, { at: heel, attack: 0.008, decay: 0.05, amp: 0.3, filter: 'bp', f: rng.range(3000, 4500), q: 0.6 });
    noiseBurst(out, rng, sr, { at: heel + toe, attack: 0.01, decay: 0.06, amp: 0.25 * toeAmp, filter: 'bp', f: rng.range(3500, 5000), q: 0.6 });
    scatter(rng, heel, heel + toe + 0.12, 250, (t) => noiseGrain(out, rng, nSamples(t, sr), rng.int(3, 10), rng.pareto(1.5, 0.05) * 0.18));
    return 0.12;
  },
  dirt(out, rng, sr) {
    const { heel, toe, toeAmp } = gait(rng);
    thud(out, rng, sr, { at: heel, amp: 0.9, f: rng.range(75, 95), tau: 0.022, fc: 300 });
    thud(out, rng, sr, { at: heel + toe, amp: 0.45 * toeAmp, f: 95, tau: 0.016, fc: 350 });
    noiseBurst(out, rng, sr, { at: heel, attack: 0.003, decay: 0.03, amp: 0.3, filter: 'bp', f: rng.range(1200, 1800), q: 0.7 });
    noiseBurst(out, rng, sr, { at: heel + toe, attack: 0.004, decay: 0.035, amp: 0.2 * toeAmp, filter: 'bp', f: rng.range(1500, 2200), q: 0.7 });
    scatter(rng, heel, heel + toe + 0.1, 150, (t) => noiseGrain(out, rng, nSamples(t, sr), rng.int(5, 20), rng.pareto(1.4, 0.05) * 0.15));
    return 0.15;
  },
  gravel(out, rng, sr) {
    const { heel, toe, toeAmp } = gait(rng);
    thud(out, rng, sr, { at: heel, amp: 0.55, f: 90, tau: 0.018, fc: 400 });
    const crunch = (t0, len, rate, amp) =>
      scatter(rng, t0, t0 + len, rate, (t, u) => {
        const a = rng.pareto(1.2, 0.05) * amp * Math.pow(1 - u, 1.5);
        addMode(out, nSamples(t, sr), rng.range(1500, 7000), a, rng.range(0.0008, 0.003), sr, Math.PI / 2);
        if (rng.chance(0.3)) noiseGrain(out, rng, nSamples(t, sr), rng.int(2, 8), a * 0.5);
      });
    crunch(heel, rng.range(0.07, 0.1), 900, 0.5);
    crunch(heel + toe, rng.range(0.08, 0.12), 700, 0.4 * toeAmp);
    const knocks = rng.int(2, 4);
    for (let k = 0; k < knocks; k++)
      strike(out, rng, sr, heel + rng.range(0, toe + 0.08), { amp: rng.range(0.1, 0.25), f: rng.range(800, 1600), tau: 0.006, modes: 2, click: 0.3 });
    return 0.18;
  },
  stone(out, rng, sr) {
    const { heel, toe, toeAmp } = gait(rng);
    noiseBurst(out, rng, sr, { at: heel, attack: 0.00005, decay: 0.0015, amp: 1.0, filter: 'bp', f: rng.range(2200, 3200), q: 0.9 });
    strike(out, rng, sr, heel, { amp: 0.4, f: rng.range(900, 1600), ratios: RATIOS.wood, tau: 0.006, modes: 3, click: 0.5 });
    addMode(out, nSamples(heel, sr), rng.range(5000, 7000), 0.25, 0.006, sr, 0); // hobnails
    thud(out, rng, sr, { at: heel, amp: 0.3, f: 100, tau: 0.01, fc: 500 });
    noiseBurst(out, rng, sr, { at: heel + toe - 0.01, attack: 0.004, decay: 0.02, amp: 0.25, filter: 'bp', f: 3000, q: 0.6 });
    noiseBurst(out, rng, sr, { at: heel + toe, attack: 0.00005, decay: 0.001, amp: 0.5 * toeAmp, filter: 'bp', f: 2500, q: 0.9 });
    strike(out, rng, sr, heel + toe, { amp: 0.2 * toeAmp, f: rng.range(1000, 1700), ratios: RATIOS.wood, tau: 0.005, modes: 3, click: 0.3 });
    return 0.18;
  },
  wood(out, rng, sr) {
    const { heel, toe, toeAmp } = gait(rng);
    noiseBurst(out, rng, sr, { at: heel, attack: 0.00005, decay: 0.0015, amp: 0.8, filter: 'bp', f: 1500, q: 0.8 });
    strike(out, rng, sr, heel, {
      amp: 0.7,
      f: rng.range(240, 380),
      ratios: RATIOS.wood,
      tau: 0.035,
      modes: 5,
      click: 0.2,
      damp: 0.7,
      thump: 0.6,
      thumpF: rng.range(95, 130),
    });
    addMode(out, nSamples(heel, sr), rng.range(110, 150), 0.3, 0.04, sr, 0);
    strike(out, rng, sr, heel + toe, {
      amp: 0.4 * toeAmp,
      f: rng.range(260, 400),
      ratios: RATIOS.wood,
      tau: 0.03,
      modes: 4,
      click: 0.2,
      damp: 0.7,
      thump: 0.3,
    });
    if (rng.chance(0.4)) creak(out, rng, sr, heel + rng.range(0.05, 0.12), rng.range(0.08, 0.18), 0.12);
    return 0.17;
  },
  mud(out, rng, sr) {
    const { heel, toe } = gait(rng);
    thud(out, rng, sr, { at: heel, amp: 0.8, f: 70, tau: 0.03, fc: 260 });
    noiseBurst(out, rng, sr, { at: heel, attack: 0.004, decay: 0.06, amp: 0.5, filter: 'bp', f: rng.range(550, 700), f1: 250, glide: 0.05, q: 5 });
    scatter(rng, heel, heel + 0.1, 120, (t) => noiseGrain(out, rng, nSamples(t, sr), rng.int(20, 60), rng.pareto(1.5, 0.05) * 0.1, false));
    const lift = heel + toe + rng.range(0.1, 0.16);
    noiseBurst(out, rng, sr, { at: lift, attack: 0.01, decay: 0.04, amp: 0.35, filter: 'bp', f: 300, f1: 900, glide: 0.04, q: 4 });
    bubble(out, sr, lift + 0.01, rng.range(150, 220), 0.35, 0.025, 2.2);
    return 0.13;
  },
  water(out, rng, sr) {
    const { heel, toe } = gait(rng);
    noiseBurst(out, rng, sr, { at: heel, attack: 0.005, decay: 0.06, amp: 0.6, filter: 'bp', f: rng.range(1700, 2400), q: 0.5 });
    noiseBurst(out, rng, sr, { at: heel, attack: 0.006, decay: 0.08, amp: 0.5, filter: 'lp', f: 500 });
    scatter(
      rng,
      heel + 0.02,
      0.45,
      (t) => 60 * Math.exp(-(t - heel) / 0.15) + 5,
      (t) => bubble(out, sr, t, rng.range(800, 2500), 0.15 * rng.range(0.3, 1), rng.range(0.006, 0.014), rng.range(1.3, 1.8)),
    );
    const lift = heel + toe + 0.08;
    noiseBurst(out, rng, sr, { at: lift, attack: 0.01, decay: 0.05, amp: 0.35, filter: 'bp', f: 2500, q: 0.5 });
    for (let k = 0; k < 4; k++) bubble(out, sr, lift + rng.range(0, 0.1), rng.range(700, 2000), 0.12, 0.01, 1.5);
    return 0.17;
  },
  leaves(out, rng, sr) {
    const { heel, toe, toeAmp } = gait(rng);
    thud(out, rng, sr, { at: heel, amp: 0.3, f: 80, tau: 0.02, fc: 300 });
    const crackle = (t0, len, rate, amp) =>
      scatter(rng, t0, t0 + len, rate, (t, u) => {
        const a = rng.pareto(1.3, 0.05) * amp * (1 - u * 0.7);
        noiseGrain(out, rng, nSamples(t, sr), rng.int(2, 10), a);
        if (rng.chance(0.25)) addMode(out, nSamples(t, sr), rng.range(2000, 8000), a * 0.5, rng.range(0.0008, 0.002), sr, Math.PI / 2);
      });
    crackle(heel, 0.16, 700, 0.4);
    crackle(heel + toe, 0.16, 500, 0.3 * toeAmp);
    noiseBurst(out, rng, sr, { at: heel, attack: 0.01, decay: 0.08, amp: 0.15, filter: 'bp', f: 4500, q: 0.4 });
    noiseBurst(out, rng, sr, { at: heel + toe, attack: 0.01, decay: 0.07, amp: 0.1, filter: 'bp', f: 5000, q: 0.4 });
    return 0.15;
  },
  sand(out, rng, sr) {
    const { heel, toe, toeAmp } = gait(rng);
    thud(out, rng, sr, { at: heel, amp: 0.5, f: 80, tau: 0.02, fc: 250 });
    noiseBurst(out, rng, sr, { at: heel, attack: 0.015, decay: 0.07, amp: 0.35, filter: 'bp', f: rng.range(2500, 3500), q: 0.5 });
    noiseBurst(out, rng, sr, { at: heel + toe, attack: 0.015, decay: 0.06, amp: 0.2 * toeAmp, filter: 'bp', f: rng.range(3000, 4000), q: 0.5 });
    scatter(
      rng,
      heel,
      heel + toe + 0.15,
      (t) => 1500 * Math.exp(-(t - heel) / 0.12) + 50,
      (t) => noiseGrain(out, rng, nSamples(t, sr), rng.int(2, 6), rng.pareto(1.5, 0.05) * 0.1),
    );
    return 0.12;
  },
};

export const SURFACES = Object.keys(STEPS);
export const STEP_DUR = { grass: 0.35, dirt: 0.32, gravel: 0.4, stone: 0.3, wood: 0.4, mud: 0.5, water: 0.5, leaves: 0.4, sand: 0.4 };

export function footstep(surface, rng, sr) {
  const fn = STEPS[surface];
  if (!fn) throw new Error(`Unknown surface ${surface}`);
  const out = buffer(STEP_DUR[surface], sr);
  const level = fn(out, rng, sr);
  return finish(out, sr, level);
}

// ---------------------------------------------------------------------------
// Breath and voice

// One breath: noise through the vocal tract's formants (parallel band-passes)
// plus a little hiss; `voiced` adds a faint glottal buzz ("huh").
function breath(out, rng, sr, at, dur, amp, formants, { hiss = 0.3, voiced = 0, f0 = 120, peak = 0.35 } = {}) {
  const i0 = nSamples(at, sr);
  const n = Math.min(out.length - i0, nSamples(dur, sr));
  const bands = formants.map(([f, q]) => new SVF(sr, f, q));
  const weights = formants.map((_, k) => 1 / (k + 1));
  const hp = new SVF(sr, 3000, 0.7);
  const glottal = new SVF(sr, 400, 0.7);
  const nz = new Noise(rng);
  let ph = 0,
    env = 0;
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) {
      const u = i / n;
      env = u < peak ? Math.sin((Math.PI / 2) * (u / peak)) : Math.cos((Math.PI / 2) * ((u - peak) / (1 - peak)));
    }
    const w = nz.white();
    let x = 0;
    let src = w;
    if (voiced) {
      ph += (f0 * (1 + 0.02 * rng.bi())) / sr;
      let pulse = 0;
      if (ph >= 1) {
        ph -= 1;
        pulse = 6;
      }
      glottal.process(pulse);
      src = w + voiced * glottal.lp * 4;
    }
    for (let k = 0; k < bands.length; k++) {
      bands[k].process(src);
      x += bands[k].bpn * weights[k];
    }
    hp.process(w);
    out[i0 + i] += (x + hiss * hp.hp) * env * env * amp;
  }
}

function breathingHeavy(rng, sr) {
  const L = 4.8;
  const long = buffer(L + 1.5, sr);
  for (let k = 0; k < 4; k++) {
    const t0 = k * 1.2 + rng.range(0, 0.05);
    breath(
      long,
      rng,
      sr,
      t0,
      rng.range(0.38, 0.45),
      rng.range(0.5, 0.6),
      [
        [rng.range(1700, 2100), 2],
        [2700, 3],
        [800, 2],
      ],
      { hiss: 0.4, peak: 0.55 },
    );
    breath(
      long,
      rng,
      sr,
      t0 + rng.range(0.47, 0.52),
      rng.range(0.5, 0.6),
      rng.range(0.8, 1),
      [
        [rng.range(550, 700), 2.5],
        [1300, 3],
        [2500, 4],
      ],
      {
        hiss: 0.25,
        voiced: rng.range(0.08, 0.18),
        f0: rng.range(110, 130),
        peak: 0.25,
      },
    );
  }
  // Filter before folding: LTI filtering then folding is circular (seamless).
  dcBlock(long, sr, 60);
  return normalize(fold(long, nSamples(L, sr)), 0.35);
}

function breathingCalm(rng, sr) {
  const L = 6;
  const long = buffer(L + 2, sr);
  for (let k = 0; k < 2; k++) {
    const t0 = k * 3 + rng.range(0, 0.1);
    breath(
      long,
      rng,
      sr,
      t0,
      rng.range(1.0, 1.2),
      0.4,
      [
        [rng.range(1000, 1200), 3],
        [2600, 4],
      ],
      { hiss: 0.15, peak: 0.5 },
    );
    breath(
      long,
      rng,
      sr,
      t0 + 1.3,
      rng.range(1.3, 1.5),
      0.5,
      [
        [rng.range(550, 650), 2],
        [1400, 3],
      ],
      { hiss: 0.1, peak: 0.3 },
    );
  }
  dcBlock(long, sr, 60);
  return normalize(fold(long, nSamples(L, sr)), 0.2);
}

// Heartbeat at 100 bpm (raised by stress), heard from inside: "lub" (the AV
// valves closing) and a lighter "dub" 0.27 s later, all below ~150 Hz.
function heartbeat(rng, sr) {
  const L = 2.4;
  const long = buffer(L + 0.6, sr);
  for (let k = 0; k < 4; k++) {
    const t0 = k * 0.6 + rng.range(0, 0.01);
    const a = rng.range(0.85, 1);
    tone(long, sr, { at: t0, f: rng.range(48, 55), f1: 40, glide: 0.04, attack: 0.012, decay: 0.045, amp: a, h2: 0.3 });
    tone(long, sr, { at: t0 + 0.005, f: 30, f1: 26, glide: 0.05, attack: 0.015, decay: 0.05, amp: a * 0.5 });
    tone(long, sr, { at: t0 + 0.27, f: rng.range(62, 70), f1: 52, glide: 0.03, attack: 0.01, decay: 0.03, amp: a * 0.65, h2: 0.25 });
  }
  lowpass1(long, sr, 160);
  lowpass1(long, sr, 200);
  dcBlock(long, sr, 15);
  return normalize(fold(long, nSamples(L, sr)), 0.45);
}

// Pain grunt: a jittery, falling glottal buzz shaped by "uh"-like formants, quite
// breathy, sharp onset, ending in an exhale. The source is a sawtooth (the
// classic -6 dB/octave glottal-plus-radiation spectrum) with jitter and shimmer.
function hurtGrunt(rng, sr) {
  const out = buffer(0.6, sr);
  const f0 = rng.range(115, 160);
  const hold = rng.range(0.08, 0.14);
  const at = 0.005;
  const n = nSamples(hold + 0.3, sr);
  const i0 = nSamples(at, sr);
  const F = [
    [rng.range(550, 700), 6],
    [rng.range(1000, 1250), 8],
    [rng.range(2400, 2650), 10],
  ];
  const bands = F.map(([f, q]) => new SVF(sr, f, q));
  const weights = [1, 0.7, 0.35];
  const low = new SVF(sr, 400, 0.7);
  const breathy = rng.range(0.25, 0.4);
  let ph = 0,
    shim = 1;
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / sr;
    const env = (t < 0.015 ? t / 0.015 : t < 0.015 + hold ? 1 : Math.exp(-(t - 0.015 - hold) / 0.06)) * Math.min(1, (n - i) / (0.02 * sr));
    const f = f0 * (1 - 0.2 * Math.min(1, t / (hold + 0.15))) * (1 + 0.02 * rng.bi());
    ph += f / sr;
    if (ph >= 1) {
      ph -= 1;
      shim = rng.range(0.85, 1.15);
    }
    const src = (1 - 2 * ph) * shim * (1 - breathy) + (rng.next() * 2 - 1) * breathy;
    let x = 0;
    for (let k = 0; k < 3; k++) {
      bands[k].process(src);
      x += bands[k].bpn * weights[k];
    }
    // Keep some of the chest resonance (the fundamental and low harmonics).
    low.process(src);
    out[i0 + i] += (x + low.lp * 0.5 * (1 - breathy)) * env;
  }
  saturate(out, 1.3);
  noiseBurst(out, rng, sr, { at: at + hold + 0.12, attack: 0.04, decay: 0.08, amp: 0.12, filter: 'bp', f: 1200, q: 0.8 });
  return finish(out, sr, 0.45, 0.05, 70);
}

function rattleGear(out, rng, sr, t0, t1, rate, amp) {
  scatter(rng, t0, t1, rate, (t, u) =>
    strike(out, rng, sr, t, { amp: amp * (1 - 0.6 * u) * rng.range(0.4, 1), f: rng.range(1800, 4500), tau: 0.01, modes: 3, click: 0.3 }),
  );
}

// Landing from a jump: both boots, the webbing and the gear on it.
function jumpLand(rng, sr) {
  const out = buffer(0.55, sr);
  thud(out, rng, sr, { at: 0.005, amp: 1.0, f: 70, tau: 0.04, fc: 300 });
  thud(out, rng, sr, { at: 0.005 + rng.range(0.015, 0.03), amp: 0.8, f: 80, tau: 0.035, fc: 320 });
  noiseBurst(out, rng, sr, { at: 0.005, attack: 0.002, decay: 0.03, amp: 0.25, filter: 'bp', f: 1500, q: 0.7 });
  rattleGear(out, rng, sr, 0.02, 0.3, 25, 0.25);
  cloth(out, rng, sr, { at: 0, dur: 0.3, amp: 0.15 });
  strike(out, rng, sr, 0.03, { amp: 0.15, f: rng.range(600, 800), ratios: RATIOS.can, tau: 0.03, modes: 4, click: 0.3 });
  return finish(out, sr, 0.45);
}

// A soldier collapsing: knees, then the torso, helmet clonk, the rifle clattering.
function bodyFall(rng, sr) {
  const out = buffer(1.0, sr);
  thud(out, rng, sr, { at: 0.01, amp: 0.7, f: 80, tau: 0.03, fc: 300 });
  const torso = rng.range(0.18, 0.25);
  thud(out, rng, sr, { at: torso, amp: 1.0, f: 60, tau: 0.06, fc: 250 });
  noiseBurst(out, rng, sr, { at: torso, attack: 0.002, decay: 0.04, amp: 0.5, filter: 'lp', f: 700 });
  cloth(out, rng, sr, { at: 0, dur: 0.4, amp: 0.2 });
  strike(out, rng, sr, torso + 0.03, { amp: 0.3, f: rng.range(500, 700), ratios: RATIOS.can, tau: 0.05, modes: 5, click: 0.4 });
  const rifle = torso + rng.range(0.08, 0.15);
  strike(out, rng, sr, rifle, { amp: 0.35, f: rng.range(260, 340), ratios: RATIOS.wood, tau: 0.02, modes: 4, thump: 0.3 });
  strike(out, rng, sr, rifle + 0.004, { amp: 0.3, f: 2400, tau: 0.012, modes: 4 });
  strike(out, rng, sr, rifle + rng.range(0.08, 0.12), { amp: 0.2, f: rng.range(280, 360), ratios: RATIOS.wood, tau: 0.015, modes: 3 });
  rattleGear(out, rng, sr, torso, torso + 0.3, 20, 0.15);
  scatter(rng, torso, torso + 0.25, 80, (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(5, 20), rng.pareto(1.4, 0.05) * 0.1 * (1 - u)));
  return finish(out, sr, 0.5, 0.05);
}

function proneDown(rng, sr) {
  const out = buffer(0.9, sr);
  cloth(out, rng, sr, { at: 0, dur: 0.65, amp: 0.35, f: 1800, motion: 10 });
  thud(out, rng, sr, { at: 0.12, amp: 0.5, f: 90, tau: 0.025, fc: 350 });
  thud(out, rng, sr, { at: 0.28, amp: 0.4, f: 110, tau: 0.02, fc: 400 });
  thud(out, rng, sr, { at: 0.38, amp: 0.7, f: 65, tau: 0.05, fc: 260 });
  noiseBurst(out, rng, sr, { at: 0.38, attack: 0.02, decay: 0.06, amp: 0.15, filter: 'bp', f: 1200, q: 0.6 });
  rattleGear(out, rng, sr, 0.15, 0.55, 15, 0.15);
  strike(out, rng, sr, 0.5, { amp: 0.2, f: 320, ratios: RATIOS.wood, tau: 0.015, modes: 3, thump: 0.2 });
  strike(out, rng, sr, 0.503, { amp: 0.12, f: 2500, tau: 0.008, modes: 3 });
  return finish(out, sr, 0.35, 0.05);
}

// Field dressing: the paper/cloth wrapper torn open (an accelerating train of
// fibre snaps over a rough rustle), then three wraps of bandage.
function bandage(rng, sr) {
  const out = buffer(1.6, sr);
  const r0 = 0.02,
    r1 = r0 + rng.range(0.35, 0.45);
  cloth(out, rng, sr, { at: r0, dur: r1 - r0, amp: 0.2, f: 2500, motion: 40, crinkle: 0 });
  scatter(
    rng,
    r0,
    r1,
    (t) => 300 + 900 * ((t - r0) / (r1 - r0)),
    (t, u) => noiseGrain(out, rng, nSamples(t, sr), rng.int(2, 8), rng.pareto(1.3, 0.1) * 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.1))),
  );
  for (const t of [0.6, 0.95, 1.3]) {
    const tt = t + rng.range(-0.03, 0.03);
    cloth(out, rng, sr, { at: tt, dur: 0.28, amp: 0.3, f: 1800, motion: 25 });
    thud(out, rng, sr, { at: tt + 0.26, amp: 0.15, f: 160, tau: 0.01, fc: 600 });
  }
  return finish(out, sr, 0.3, 0.05);
}

export const PEOPLE = {
  jumpLand: { dur: 0.55, make: jumpLand },
  bodyFall: { dur: 1.0, make: bodyFall },
  proneDown: { dur: 0.9, make: proneDown },
  breathingHeavy: { dur: 4.8, make: breathingHeavy, loop: true },
  breathingCalm: { dur: 6.0, make: breathingCalm, loop: true },
  heartbeat: { dur: 2.4, make: heartbeat, loop: true },
  hurtGrunt: { dur: 0.6, make: hurtGrunt },
  bandage: { dur: 1.6, make: bandage },
};
