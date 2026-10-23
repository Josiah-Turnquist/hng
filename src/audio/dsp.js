// Low-level DSP building blocks for the procedural sound synthesizer (synth.js).
// Everything works on plain Float32Arrays at any sample rate and uses no Web Audio,
// so it runs in the browser and in Node alike. Units: seconds, hertz; amplitudes
// are linear (1 = full scale). Hot loops avoid Math.exp/Math.sin per sample where
// a recursion does the same job (exponential envelopes, rotating phasors).

export const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Random numbers (mulberry32): deterministic, so every variant of a sound is the
// same on every run and in every browser.
export class Rng {
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  bi() {
    return this.next() * 2 - 1;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  logRange(a, b) {
    return a * Math.pow(b / a, this.next());
  }
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  // v scaled by a random factor in [1 - frac, 1 + frac].
  vary(v, frac) {
    return v * (1 + frac * (this.next() * 2 - 1));
  }
  // Exponentially distributed interval (Poisson process) with the given mean.
  exp(mean) {
    return -Math.log(1 - this.next()) * mean;
  }
  // Heavy-tailed amplitude in (min, 1]: most grains are small and a few are loud,
  // like real crackle, gravel crunch or debris.
  pareto(alpha = 1.5, min = 0.05) {
    return Math.min(1, min * Math.pow(1 - this.next(), -1 / alpha));
  }
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Fast noise source: xorshift32 white noise, pink (Paul Kellet's filter) and
// brown (leaky integrator). Seeded from an Rng, so takes stay deterministic.
// All three have roughly the same loudness (RMS about 0.3-0.6).
export const WHITE = 0;
export const PINK = 1;
export const BROWN = 2;
export const colorCode = (c) => (c === 'pink' ? PINK : c === 'brown' ? BROWN : WHITE);

export class Noise {
  constructor(rng) {
    this.s = (rng.next() * 4294967295) | 0 || 0x2545f491;
    this.b0 = this.b1 = this.b2 = this.b3 = this.b4 = this.b5 = this.b6 = 0;
    this.br = 0;
  }
  white() {
    let s = this.s;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.s = s;
    return s * 4.656612873077393e-10;
  }
  pink() {
    const w = this.white();
    this.b0 = 0.99886 * this.b0 + w * 0.0555179;
    this.b1 = 0.99332 * this.b1 + w * 0.0750759;
    this.b2 = 0.969 * this.b2 + w * 0.153852;
    this.b3 = 0.8665 * this.b3 + w * 0.3104856;
    this.b4 = 0.55 * this.b4 + w * 0.5329522;
    this.b5 = -0.7616 * this.b5 - w * 0.016898;
    const y = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + w * 0.5362;
    this.b6 = w * 0.115926;
    return y * 0.2;
  }
  brown() {
    this.br = (this.br + 0.04 * this.white()) * 0.985;
    return this.br * 2.2;
  }
  get(code) {
    return code === WHITE ? this.white() : code === PINK ? this.pink() : this.brown();
  }
}

// Closure form (convenient outside hot loops).
export function makeNoise(rng, color = 'white') {
  const n = new Noise(rng);
  const code = colorCode(color);
  return code === WHITE ? () => n.white() : code === PINK ? () => n.pink() : () => n.brown();
}

// Smoothly interpolated random value in [0, 1] with a new target `rate` times per
// second (smoothstep between targets): gusts, roughness, flicker, "rolling".
export class RandomCurve {
  constructor(rng, sr, rate) {
    this.rng = rng;
    this.step = Math.max(2, Math.round(sr / rate));
    this.inv = 1 / this.step;
    this.k = 0;
    this.a = rng.next();
    this.b = rng.next();
  }
  next() {
    if (this.k === this.step) {
      this.k = 0;
      this.a = this.b;
      this.b = this.rng.next();
    }
    const u = this.k++ * this.inv;
    return this.a + (this.b - this.a) * (u * u * (3 - 2 * u));
  }
}

// ---------------------------------------------------------------------------
// Buffers and small utilities

export const nSamples = (sec, sr) => Math.max(1, Math.round(sec * sr));
export const buffer = (sec, sr) => new Float32Array(nSamples(sec, sr));
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dbToGain = (db) => Math.pow(10, db / 20);

export function peakOf(buf, start = 0, end = buf.length) {
  let m = 0;
  for (let i = start; i < end; i++) {
    const a = buf[i] < 0 ? -buf[i] : buf[i];
    if (a > m) m = a;
  }
  return m;
}

export function rmsOf(buf, start = 0, end = buf.length) {
  let s = 0;
  for (let i = start; i < end; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, end - start));
}

// Scale so the largest sample is `peak`.
export function normalize(buf, peak = 1) {
  const m = peakOf(buf);
  if (m > 0) {
    const g = peak / m;
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
  }
  return buf;
}

// Scale to an RMS level, but never past `maxPeak`.
export function normalizeRms(buf, rms, maxPeak = 0.98) {
  const r = rmsOf(buf);
  if (r > 0) {
    let g = rms / r;
    const p = peakOf(buf) * g;
    if (p > maxPeak) g *= maxPeak / p;
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
  }
  return buf;
}

export function scale(buf, g, start = 0, end = buf.length) {
  for (let i = start; i < end; i++) buf[i] *= g;
  return buf;
}

// Short raised-cosine fades so one-shots never start or stop with a click.
export function fade(buf, sr, inSec = 0, outSec = 0.01) {
  const ni = Math.min(buf.length, Math.round(inSec * sr));
  for (let i = 0; i < ni; i++) buf[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / ni);
  const no = Math.min(buf.length, Math.round(outSec * sr));
  const n = buf.length;
  for (let i = 0; i < no; i++) buf[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / no);
  return buf;
}

// Remove DC and sub-audio drift (one-pole high-pass).
export function dcBlock(buf, sr, f = 20) {
  const a = Math.exp((-TAU * f) / sr);
  let x1 = 0,
    y1 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    y1 = a * (y1 + x - x1);
    x1 = x;
    buf[i] = y1;
  }
  return buf;
}

// One-pole low-pass over a range, in place.
export function lowpass1(buf, sr, f, start = 0, end = buf.length) {
  const a = 1 - Math.exp((-TAU * Math.min(f, sr * 0.49)) / sr);
  let y = 0;
  for (let i = start; i < end; i++) buf[i] = y += a * (buf[i] - y);
  return buf;
}

// One-pole high-pass over a range, in place.
export function highpass1(buf, sr, f, start = 0, end = buf.length) {
  const a = Math.exp((-TAU * Math.min(f, sr * 0.49)) / sr);
  let x1 = 0,
    y1 = 0;
  for (let i = start; i < end; i++) {
    const x = buf[i];
    y1 = a * (y1 + x - x1);
    x1 = x;
    buf[i] = y1;
  }
  return buf;
}

// Smooth saturation (tanh), normalized so full scale stays full scale. Models the
// overload of ears and microphones that gives close gunfire its dense, "fat" sound.
export function saturate(buf, drive, start = 0, end = buf.length) {
  const k = 1 / Math.tanh(drive);
  for (let i = start; i < end; i++) buf[i] = Math.tanh(buf[i] * drive) * k;
  return buf;
}

// Mix src into out at sample offset i0.
export function mixInto(out, src, i0 = 0, gain = 1) {
  const n = Math.min(src.length, out.length - i0);
  for (let i = Math.max(0, -i0); i < n; i++) out[i0 + i] += src[i] * gain;
  return out;
}

// Add a delayed, darker copy of the first `span` seconds of buf onto itself
// (ground reflection or a nearby wall). Uses a snapshot so copies don't feed back.
export function reflect(buf, sr, delay, gain, fc = 5000, span = 0.15) {
  const d = Math.max(1, Math.round(delay * sr));
  const n = Math.min(buf.length - d, Math.round(span * sr));
  if (n <= 0) return buf;
  const snap = buf.slice(0, n);
  const a = 1 - Math.exp((-TAU * Math.min(fc, sr * 0.49)) / sr);
  let y = 0;
  for (let i = 0; i < n; i++) {
    y += a * (snap[i] - y);
    buf[i + d] += y * gain;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Filters

// Topology-preserving state-variable filter (Andrew Simper). Stable when the
// cutoff moves every few samples, which most sweeps here do. After process(),
// read .lp, .bp (unity peak gain: bpn) and .hp.
export class SVF {
  constructor(sr, f = 1000, q = Math.SQRT1_2) {
    this.sr = sr;
    this.ic1 = 0;
    this.ic2 = 0;
    this.lp = this.bp = this.hp = this.bpn = 0;
    this.set(f, q);
  }
  set(f, q = this.q) {
    const fc = f < 5 ? 5 : f > this.sr * 0.47 ? this.sr * 0.47 : f;
    const g = Math.tan((Math.PI * fc) / this.sr);
    this.q = q;
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
    return this;
  }
  process(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.bpn = v1 * this.k;
    this.hp = v0 - this.k * v1 - v2;
    return v2;
  }
}

// RBJ-cookbook biquad (fixed coefficients).
export class Biquad {
  constructor(sr, type = 'lowpass', f = 1000, q = Math.SQRT1_2, gainDb = 0) {
    this.sr = sr;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(type, f, q, gainDb);
  }
  set(type, f, q = Math.SQRT1_2, gainDb = 0) {
    f = clamp(f, 5, this.sr * 0.47);
    const w = (TAU * f) / this.sr;
    const cw = Math.cos(w),
      sw = Math.sin(w),
      al = sw / (2 * q),
      A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'highpass') {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'bandpass') {
      b0 = al;
      b1 = 0;
      b2 = -al;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'peaking') {
      b0 = 1 + al * A;
      b1 = -2 * cw;
      b2 = 1 - al * A;
      a0 = 1 + al / A;
      a1 = -2 * cw;
      a2 = 1 - al / A;
    } else if (type === 'lowshelf' || type === 'highshelf') {
      const s = type === 'lowshelf' ? 1 : -1;
      const sq = 2 * Math.sqrt(A) * al;
      b0 = A * (A + 1 - s * (A - 1) * cw + sq);
      b1 = 2 * s * A * (A - 1 - s * (A + 1) * cw);
      b2 = A * (A + 1 - s * (A - 1) * cw - sq);
      a0 = A + 1 + s * (A - 1) * cw + sq;
      a1 = -2 * s * (A - 1 + s * (A + 1) * cw);
      a2 = A + 1 + s * (A - 1) * cw - sq;
    } else throw new Error(`Unknown filter ${type}`);
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    return this;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
  run(buf, start = 0, end = buf.length) {
    for (let i = start; i < end; i++) buf[i] = this.process(buf[i]);
    return buf;
  }
}

export function filter(buf, sr, type, f, q = Math.SQRT1_2, gainDb = 0, start = 0, end = buf.length) {
  return new Biquad(sr, type, f, q, gainDb).run(buf, start, end);
}

// Driven two-pole resonator with decay time tau (the time to fall by 1/e) and
// roughly unity gain at its resonance. Used for metal and wood body modes that
// are excited by noise (scrapes, rattles) rather than a single strike.
export class Resonator {
  constructor(sr, f, tau) {
    this.sr = sr;
    this.y1 = this.y2 = 0;
    this.set(f, tau);
  }
  set(f, tau) {
    const w = (TAU * Math.min(f, this.sr * 0.47)) / this.sr;
    const r = Math.exp(-1 / (tau * this.sr));
    this.c1 = 2 * r * Math.cos(w);
    this.c2 = -r * r;
    this.g = (1 - r) * 2 * Math.max(0.05, Math.sin(w));
    return this;
  }
  process(x) {
    const y = x * this.g + this.c1 * this.y1 + this.c2 * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// ---------------------------------------------------------------------------
// Sound primitives. Each adds into `out` (so layers stack) and returns nothing.

// One exponentially decaying sinusoid (a resonant mode), via a rotating phasor.
// phase 0 starts at zero (smooth); phase PI/2 starts at full amplitude (a click).
export function addMode(out, i0, f, amp, tau, sr, phase = 0) {
  if (f <= 0 || f >= sr * 0.48 || amp === 0 || i0 >= out.length) return;
  const start = i0 < 0 ? 0 : i0;
  const end = Math.min(out.length, start + Math.ceil(tau * sr * 7));
  const w = (TAU * f) / sr;
  const r = Math.exp(-1 / (tau * sr));
  const c = Math.cos(w) * r,
    s = Math.sin(w) * r;
  let re = Math.cos(phase) * amp,
    im = Math.sin(phase) * amp;
  for (let i = start; i < end; i++) {
    out[i] += im;
    const nr = re * c - im * s;
    im = re * s + im * c;
    re = nr;
  }
}

// Friedlander blast wave p(t) = (1 - t/T) exp(-b t/T): the sudden pressure jump
// of a muzzle blast or explosion followed by its longer negative phase.
export function blastPulse(out, sr, { at = 0, T = 0.002, amp = 1, b = 1.3, rise = 0.00004, dur }) {
  const i0 = Math.round(at * sr);
  const nr = Math.max(1, Math.round(rise * sr));
  const n = Math.min(out.length - i0, Math.round((dur ?? T * 7) * sr));
  const k = Math.exp(-b / (T * sr));
  let e = 1;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ramp = i < nr ? (i + 1) / nr : 1;
    out[i0 + i] += amp * ramp * (1 - t / T) * e;
    e *= k;
  }
}

// N-wave: the shock wave of a supersonic bullet. Rises in `rise`, falls linearly
// to the negative peak over T, then snaps back to zero.
export function nWave(out, sr, { at = 0, T = 0.0008, amp = 1, rise = 0.00003 }) {
  const i0 = Math.round(at * sr);
  const nr = Math.max(1, Math.round(rise * sr));
  const nT = Math.max(2, Math.round(T * sr));
  const put = (i, v) => {
    if (i >= 0 && i < out.length) out[i] += v;
  };
  for (let i = 0; i < nr; i++) put(i0 + i, (amp * (i + 1)) / nr);
  for (let i = 1; i < nT; i++) put(i0 + nr - 1 + i, amp * (1 - (2 * i) / (nT - 1)));
  for (let i = 1; i <= nr; i++) put(i0 + nr - 1 + nT - 1 + i, -amp * (1 - i / nr));
}

// Filtered noise burst with attack/hold/exponential-decay envelope and an optional
// exponential cutoff glide from f to f1 (time constant `glide`).
// filter: 'lp' | 'bp' | 'hp' | 'none'.
export function noiseBurst(out, rng, sr, o) {
  const at = o.at || 0;
  const attack = o.attack ?? 0.001;
  const hold = o.hold || 0;
  const decay = o.decay ?? 0.05;
  const amp = o.amp ?? 1;
  const mode = o.filter || 'lp';
  const q = o.q ?? Math.SQRT1_2;
  const f0 = o.f ?? 2000;
  const f1 = o.f1 ?? f0;
  const glide = o.glide ?? decay;
  const i0 = Math.round(at * sr);
  if (i0 >= out.length) return;
  const len = Math.min(out.length - i0, Math.round((o.dur ?? attack + hold + decay * 6.5) * sr));
  const col = colorCode(o.color);
  const filt = mode === 'none' ? -1 : mode === 'lp' ? 0 : mode === 'bp' ? 1 : 2;
  const nA = Math.max(1, Math.round(attack * sr));
  const nH = nA + Math.round(hold * sr);
  const dk = Math.exp(-1 / (decay * sr));
  const sweeping = f1 !== f0 && filt >= 0;
  const gk16 = Math.exp(-16 / (glide * sr));
  const invA = amp / nA;
  const fMax = sr * 0.47;
  const k = 1 / q;
  // Everything lives in locals (much faster than object fields in V8).
  let sd = (rng.next() * 4294967295) | 0 || 0x2545f491;
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0,
    br = 0;
  let ic1 = 0,
    ic2 = 0,
    a1 = 0,
    a2 = 0,
    a3 = 0,
    gl = 1,
    env = amp;
  for (let i = 0; i < len; i++) {
    if (i === 0 || (sweeping && (i & 15) === 0)) {
      let fc = f1 + (f0 - f1) * gl;
      gl *= gk16;
      fc = fc < 5 ? 5 : fc > fMax ? fMax : fc;
      const g = Math.tan((Math.PI * fc) / sr);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    }
    let e;
    if (i >= nH) {
      e = env;
      env *= dk;
    } else e = i < nA ? (i + 1) * invA : amp;
    sd ^= sd << 13;
    sd ^= sd >>> 17;
    sd ^= sd << 5;
    let x = sd * 4.656612873077393e-10;
    if (col === PINK) {
      b0 = 0.99886 * b0 + x * 0.0555179;
      b1 = 0.99332 * b1 + x * 0.0750759;
      b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856;
      b4 = 0.55 * b4 + x * 0.5329522;
      b5 = -0.7616 * b5 - x * 0.016898;
      const y = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.2;
      b6 = x * 0.115926;
      x = y;
    } else if (col === BROWN) {
      br = (br + 0.04 * x) * 0.985;
      x = br * 2.2;
    }
    if (filt >= 0) {
      const v3 = x - ic2;
      const v1 = a1 * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1;
      ic2 = 2 * v2 - ic2;
      x = filt === 0 ? v2 : filt === 1 ? v1 * k : x - k * v1 - v2;
    }
    out[i0 + i] += x * e;
  }
}

// Sine with an exponential pitch glide and attack/decay envelope. h2/h3 add
// second/third harmonics (for thumps that should not be pure sines).
export function tone(out, sr, o) {
  const at = o.at || 0;
  const f0 = o.f;
  const f1 = o.f1 ?? f0;
  const glide = o.glide ?? 0.05;
  const attack = o.attack ?? 0.002;
  const hold = o.hold || 0;
  const decay = o.decay ?? 0.05;
  const amp = o.amp ?? 1;
  const h2 = o.h2 || 0,
    h3 = o.h3 || 0;
  const i0 = Math.round(at * sr);
  if (i0 >= out.length) return;
  const len = Math.min(out.length - i0, Math.round((o.dur ?? attack + hold + decay * 7) * sr));
  const nA = Math.max(1, Math.round(attack * sr));
  const nH = nA + Math.round(hold * sr);
  const dk = Math.exp(-1 / (decay * sr));
  const gk16 = Math.exp(-16 / (glide * sr));
  const nyq = sr * 0.45;
  const ph = o.phase || 0;
  // Rotating phasor (re, im) = (cos, sin) of the phase. The rotation step is
  // recomputed every 16 samples as the pitch glides (and the phasor renormalized).
  let re = Math.cos(ph),
    im = Math.sin(ph),
    gl = 1,
    env = amp;
  let i = 0;
  while (i < len) {
    const f = f1 + (f0 - f1) * gl;
    gl *= gk16;
    const w = (TAU * f) / sr;
    const c = Math.cos(w),
      s = Math.sin(w);
    const m = 1 / Math.sqrt(re * re + im * im);
    re *= m;
    im *= m;
    // sin(2p) = 2 sin p cos p; sin(3p) = sin p (3 - 4 sin^2 p).
    const k2 = f * 2 < nyq ? 2 * h2 : 0;
    const k3 = f * 3 < nyq ? h3 : 0;
    const end = Math.min(len, i + 16);
    if (i >= nH) {
      for (; i < end; i++) {
        const nr = re * c - im * s;
        im = re * s + im * c;
        re = nr;
        out[i0 + i] += (im + k2 * im * re + k3 * im * (3 - 4 * im * im)) * env;
        env *= dk;
      }
    } else {
      for (; i < end; i++) {
        const nr = re * c - im * s;
        im = re * s + im * c;
        re = nr;
        let e;
        if (i >= nH) {
          e = env;
          env *= dk;
        } else e = i < nA ? amp * (0.5 - 0.5 * Math.cos((Math.PI * (i + 1)) / nA)) : amp;
        out[i0 + i] += (im + k2 * im * re + k3 * im * (3 - 4 * im * im)) * e;
      }
    }
  }
}

// Low thud: a pitched-down sine plus low-passed noise (a body, boot or clod hitting
// the ground, the "thump" in an impact).
export function thud(out, rng, sr, o) {
  const at = o.at || 0;
  const amp = o.amp ?? 1;
  tone(out, sr, {
    at,
    f: o.f ?? 90,
    f1: o.f1 ?? (o.f ?? 90) * 0.7,
    glide: o.tau ?? 0.02,
    attack: o.attack ?? 0.002,
    decay: o.tau ?? 0.02,
    amp: amp * (o.tone ?? 0.7),
    h2: 0.15,
  });
  noiseBurst(out, rng, sr, {
    at,
    attack: o.attack ?? 0.001,
    decay: (o.tau ?? 0.02) * 0.6,
    amp: amp * (o.noise ?? 0.6),
    filter: 'lp',
    f: o.fc ?? 500,
    q: 0.6,
  });
}

// Inharmonic mode ratios for struck objects.
export const RATIOS = {
  steel: [1, 1.58, 2.11, 2.72, 3.34, 4.05, 4.71, 5.6], // small steel parts and plates
  bar: [1, 2.756, 5.404, 8.933], // free bar (clip, link, spring steel strip)
  brass: [1, 1.37, 2.04, 2.67, 3.43, 4.2], // thin-walled cylinder (cartridge case)
  wood: [1, 1.85, 2.66, 3.9, 5.3],
  can: [1, 1.41, 1.93, 2.48, 3.1, 3.82], // sheet-metal box/drum (hollow, dense modes)
  glass: [1, 2.32, 4.25, 6.63],
};

// A struck metal (or wood) part: a short broadband click plus a few ringing modes.
// f: lowest mode; tau: its decay (higher modes die faster); click: transient level;
// thump: low body knock (e.g. the wooden stock); spread: random detuning of ratios.
export function strike(out, rng, sr, at, o = {}) {
  const amp = o.amp ?? 1;
  const f = o.f ?? 3000;
  const ratios = o.ratios || RATIOS.steel;
  const n = Math.min(o.modes ?? 5, ratios.length);
  const tau = o.tau ?? 0.015;
  const spread = o.spread ?? 0.06;
  const i0 = Math.round(at * sr);
  if (i0 >= out.length) return;
  // Transient: a few samples of differentiated noise (a sharp broadband tick).
  const click = o.click ?? 0.6;
  if (click > 0) {
    const nc = Math.max(2, Math.round((o.clickLen ?? 0.0005) * sr));
    let prev = 0;
    for (let i = 0; i < nc && i0 + i < out.length; i++) {
      const w = rng.bi();
      const e = 1 - i / nc;
      out[i0 + i] += (w - prev) * 0.5 * e * e * click * amp;
      prev = w;
    }
  }
  for (let k = 0; k < n; k++) {
    const fk = f * ratios[k] * (1 + spread * rng.bi());
    if (fk >= sr * 0.46) break;
    const tk = tau * Math.pow(f / fk, o.damp ?? 0.6) * rng.range(0.7, 1.3);
    const ak = (amp * rng.range(0.45, 1)) / Math.pow(k + 1, o.tilt ?? 0.5);
    addMode(out, i0, fk, ak, tk, sr, rng.next() * TAU);
  }
  if (o.thump) thud(out, rng, sr, { at, amp: amp * o.thump, f: o.thumpF ?? 220, tau: o.thumpTau ?? 0.012, fc: 900 });
}

// Sliding friction (metal on metal, brass on steel): band-passed noise shaped by
// the motion with a fast random roughness and stick-slip micro clicks. `res`
// optionally lists body modes ([f, tau]) that the scraping excites.
export function scrape(out, rng, sr, o) {
  const at = o.at || 0;
  const dur = o.dur ?? 0.1;
  const amp = o.amp ?? 0.3;
  const f0 = o.f ?? 2500;
  const f1 = o.f1 ?? f0;
  const q = o.q ?? 1.4;
  const rough = o.rough ?? 0.6;
  const shape = o.shape || 'bump';
  const i0 = Math.round(at * sr);
  if (i0 >= out.length) return;
  const len = Math.min(out.length - i0, Math.round(dur * sr));
  const svf = new SVF(sr, f0, q);
  const res = (o.res || []).map(([f, t]) => new Resonator(sr, f, t));
  const resMix = o.resMix ?? 0.5;
  // Roughness: random targets every ~2-6 ms, smoothly interpolated.
  const rc = new RandomCurve(rng, sr, o.roughRate ?? 300);
  const nz = new Noise(rng);
  const nres = res.length;
  let env = 0;
  for (let i = 0; i < len; i++) {
    if ((i & 15) === 0) {
      // The motion envelope and the band move slowly: update every 16 samples.
      const t = i / len;
      svf.set(f0 + (f1 - f0) * t, q);
      if (shape === 'rise') env = Math.pow(t, 1.5) * (t > 0.92 ? (1 - t) / 0.08 : 1);
      else if (shape === 'fall') env = Math.pow(1 - t, 1.5) * Math.min(1, t * 25);
      else if (shape === 'flat') env = Math.min(1, t * 20, (1 - t) * 20);
      else env = Math.sin(Math.PI * t);
      env *= amp;
    }
    const r = rc.next();
    svf.process(nz.white());
    let x = svf.bpn;
    if (nres) {
      let y = 0;
      for (let k = 0; k < nres; k++) y += res[k].process(x);
      x = x * (1 - resMix) + y * resMix * 3;
    }
    out[i0 + i] += x * env * (1 - rough + rough * r * r * 2);
  }
  // Stick-slip micro clicks.
  const grains = o.grains ?? 60;
  if (grains > 0) {
    let t = rng.exp(1 / grains);
    while (t < dur) {
      const u = t / dur;
      const env = shape === 'rise' ? u : shape === 'fall' ? 1 - u : Math.sin(Math.PI * u);
      addMode(out, i0 + Math.round(t * sr), f0 * rng.range(1.1, 2.4), amp * 0.5 * env * rng.pareto(1.3, 0.1), rng.range(0.0005, 0.002), sr, Math.PI / 2);
      t += rng.exp(1 / grains);
    }
  }
}

// Coil spring "sproing": a few slowly decaying inharmonic modes with a slight
// downward pitch drift (the StG 44 recoil spring, magazine springs).
export function spring(out, rng, sr, at, { f = 1500, amp = 0.2, tau = 0.1 } = {}) {
  const i0 = Math.round(at * sr);
  const ratios = [1, 1.07, 2.03, 2.9, 3.9];
  for (let k = 0; k < ratios.length; k++) {
    addMode(out, i0, f * ratios[k] * rng.vary(1, 0.01), (amp * rng.range(0.4, 1)) / (k + 1), tau / Math.sqrt(k + 1), sr, rng.next() * TAU);
  }
}

// Cloth rustle: band-passed noise with slow motion swells and crinkles.
export function cloth(out, rng, sr, o) {
  const at = o.at || 0;
  const dur = o.dur ?? 0.3;
  const amp = o.amp ?? 0.2;
  const f = o.f ?? 2200;
  const i0 = Math.round(at * sr);
  if (i0 >= out.length) return;
  const len = Math.min(out.length - i0, Math.round(dur * sr));
  const svf = new SVF(sr, f, o.q ?? 0.7);
  const hp2 = new SVF(sr, 600, 0.7);
  const nz = new Noise(rng);
  // Fabric moves in uneven swells (folds catching and releasing).
  const swell = new RandomCurve(rng, sr, o.motion ?? 18);
  const skew = o.skew ?? 0.8;
  let env = 0;
  for (let i = 0; i < len; i++) {
    if ((i & 15) === 0) env = Math.sin(Math.PI * Math.pow(i / len, skew)) * amp;
    const m = swell.next();
    svf.process(nz.white());
    hp2.process(svf.bpn);
    out[i0 + i] += hp2.hp * env * (0.15 + 1.6 * m * m);
  }
  const crinkle = o.crinkle ?? 40;
  let t = rng.exp(1 / crinkle);
  while (t < dur) {
    const u = t / dur;
    addMode(out, i0 + Math.round(t * sr), rng.range(2500, 7000), amp * 0.35 * Math.sin(Math.PI * u) * rng.pareto(1.4, 0.15), rng.range(0.0004, 0.0015), sr, Math.PI / 2);
    t += rng.exp(1 / crinkle);
  }
}

// Poisson-distributed events between t0 and t1 (seconds). rate(t) is events per
// second (number or function); fn(t, u) is called for each, u = (t - t0)/(t1 - t0).
export function scatter(rng, t0, t1, rate, fn) {
  const rf = typeof rate === 'function' ? rate : () => rate;
  let t = t0;
  for (let guard = 0; guard < 100000; guard++) {
    const r = Math.max(1e-3, rf(t));
    t += rng.exp(1 / r);
    if (t >= t1) break;
    fn(t, (t - t0) / (t1 - t0));
  }
}

// Short grain of noise (crackle, grit, splinter, droplet spray).
// filter: 'hp' (first difference) or 'raw'. Decays linearly over len.
export function noiseGrain(out, rng, i0, len, amp, hp = true) {
  let prev = 0;
  const n = Math.min(len, out.length - i0);
  let s = (rng.next() * 4294967295) | 0 || 1;
  const k = amp / len;
  for (let i = Math.max(0, -i0); i < n; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const w = s * 4.656612873077393e-10;
    out[i0 + i] += (hp ? (w - prev) * 0.6 : w) * (len - i) * k;
    prev = w;
  }
}

// Smoothly interpolated random value in [0, 1] with new targets `rate` times per
// second: used for gusts, roughness, flicker and "rolling" amplitude.
export function randomCurve(rng, len, sr, rate) {
  const out = new Float32Array(len);
  const step = Math.max(2, Math.round(sr / rate));
  let a = rng.next(),
    b = rng.next();
  for (let i = 0; i < len; i++) {
    const k = i % step;
    if (k === 0 && i > 0) {
      a = b;
      b = rng.next();
    }
    const u = k / step;
    out[i] = a + (b - a) * (u * u * (3 - 2 * u));
  }
  return out;
}

// Rolling low rumble: colored noise through a low-pass whose cutoff sinks from f
// to f1, with an exponential decay and slow random "rolls" (the reverberant tail
// of gunfire and explosions outdoors: terrain, trees and buildings answering).
export function rumble(out, rng, sr, o) {
  const at = o.at || 0;
  const attack = o.attack ?? 0.02;
  const decay = o.decay ?? 0.4;
  const amp = o.amp ?? 0.3;
  const f0 = o.f ?? 2000;
  const f1 = o.f1 ?? 300;
  const glide = o.glide ?? 0.3;
  const depth = o.rollDepth ?? 0.5;
  const q = o.q ?? 0.6;
  const i0 = Math.round(at * sr);
  if (i0 >= out.length) return;
  const len = Math.min(out.length - i0, Math.round((o.dur ?? attack + decay * 7) * sr));
  const col = colorCode(o.color || 'pink');
  const nA = Math.max(1, Math.round(attack * sr));
  const dk = Math.exp(-1 / (decay * sr));
  const gk16 = Math.exp(-16 / (glide * sr));
  const k = 1 / q;
  const fMax = sr * 0.47;
  const d0 = 1 - depth,
    d2 = depth * 2;
  // Roll: smoothstep between random targets (RandomCurve, inlined).
  const step = Math.max(2, Math.round(sr / (o.roll ?? 4)));
  const invStep = 1 / step;
  let ra = rng.next(),
    rb = rng.next(),
    rk = 0;
  let sd = (rng.next() * 4294967295) | 0 || 0x2545f491;
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0,
    br = 0;
  let ic1 = 0,
    ic2 = 0,
    a1 = 0,
    a2 = 0,
    a3 = 0,
    gl = 1,
    env = amp;
  for (let i = 0; i < len; i++) {
    if ((i & 15) === 0) {
      let fc = f1 + (f0 - f1) * gl;
      gl *= gk16;
      fc = fc < 5 ? 5 : fc > fMax ? fMax : fc;
      const g = Math.tan((Math.PI * fc) / sr);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    }
    let e;
    if (i < nA) e = ((i + 1) / nA) * amp;
    else {
      e = env;
      env *= dk;
    }
    sd ^= sd << 13;
    sd ^= sd >>> 17;
    sd ^= sd << 5;
    let x = sd * 4.656612873077393e-10;
    if (col === PINK) {
      b0 = 0.99886 * b0 + x * 0.0555179;
      b1 = 0.99332 * b1 + x * 0.0750759;
      b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856;
      b4 = 0.55 * b4 + x * 0.5329522;
      b5 = -0.7616 * b5 - x * 0.016898;
      const y = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.2;
      b6 = x * 0.115926;
      x = y;
    } else if (col === BROWN) {
      br = (br + 0.04 * x) * 0.985;
      x = br * 2.2;
    }
    const v3 = x - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    if (rk === step) {
      rk = 0;
      ra = rb;
      rb = rng.next();
    }
    const u = rk++ * invStep;
    const r = ra + (rb - ra) * (u * u * (3 - 2 * u));
    out[i0 + i] += v2 * e * (d0 + d2 * r * r);
  }
}

// Train of discrete, smeared echoes (reflections from tree lines, buildings and
// hills): each is a short dark noise burst with a little low thump.
export function echoes(out, rng, sr, o) {
  const at = o.at || 0;
  const count = o.count ?? 6;
  const first = o.first ?? 0.1;
  const last = o.last ?? 1.5;
  const amp = o.amp ?? 0.3;
  const fc = o.fc ?? 1500;
  const smear = o.smear ?? 0.03;
  const times = [];
  for (let k = 0; k < count; k++) times.push(first + (last - first) * Math.pow(rng.next(), 1.6));
  times.sort((a, b) => a - b);
  for (const t of times) {
    const a = amp * Math.exp(-(t - first) / (o.decay ?? (last - first) / 2)) * rng.range(0.35, 1);
    noiseBurst(out, rng, sr, {
      at: at + t,
      attack: smear * 0.15,
      decay: smear * rng.range(0.6, 1.4),
      amp: a,
      filter: 'lp',
      f: fc * rng.range(0.7, 1.3),
      q: 0.7,
      color: 'pink',
    });
    if (o.thump) tone(out, sr, { at: at + t, f: o.thump * rng.range(0.85, 1.15), f1: o.thump * 0.7, glide: 0.05, attack: smear * 0.3, decay: smear * 1.5, amp: a * 0.6 });
  }
}

// ---------------------------------------------------------------------------
// Loops

// Turns a render of len + X samples into a seamless loop of len samples: the
// extra X samples are crossfaded into the start, so the last sample runs straight
// into the first. Equal-power for uncorrelated content (noise beds).
export function loopify(src, len, equalPower = true) {
  const x = src.length - len;
  const out = src.slice(0, len);
  if (x <= 0) return out;
  for (let i = 0; i < x; i++) {
    const u = (i + 0.5) / x;
    const wIn = equalPower ? Math.sin((u * Math.PI) / 2) : u;
    const wOut = equalPower ? Math.cos((u * Math.PI) / 2) : 1 - u;
    out[i] = src[i] * wIn + src[len + i] * wOut;
  }
  return out;
}

// Folds a render that runs past the loop length back onto the start (adds
// src[i + k*len] into out[i]). Events placed anywhere in [0, len) then wrap
// around seamlessly, tails and all.
export function fold(src, len) {
  const out = new Float32Array(len);
  for (let i = 0; i < src.length; i++) out[i % len] += src[i];
  return out;
}

// Quantize a frequency so a whole number of cycles fits in `loopSec` (tones in
// loops then wrap without a phase jump).
export const loopFreq = (f, loopSec) => Math.max(1, Math.round(f * loopSec)) / loopSec;
