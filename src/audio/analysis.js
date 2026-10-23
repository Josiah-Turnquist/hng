// Signal analysis helpers for checking synthesized sounds without listening:
// FFT, spectrogram, band energies, spectral centroid, loudness envelopes and loop
// seam checks. Used by tests/audio.test.js and debug/audio.html. Plain JS (Node too).

// In-place radix-2 complex FFT (re, im: Float64Array of power-of-two length).
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang),
      wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k,
          b = a + half;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

const nextPow2 = (n) => 1 << Math.ceil(Math.log2(Math.max(2, n)));

// Power spectrum averaged over Hann-windowed frames (Welch). Returns
// { power: Float64Array(size/2), binHz }.
export function powerSpectrum(x, sr, size = 4096, start = 0, end = x.length) {
  const n = Math.min(size, nextPow2(end - start));
  const hop = n >> 1;
  const power = new Float64Array(n >> 1);
  const re = new Float64Array(n),
    im = new Float64Array(n);
  const win = new Float64Array(n);
  for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  let frames = 0;
  for (let s = start; s + n <= end || frames === 0; s += hop) {
    for (let i = 0; i < n; i++) {
      const v = s + i < end ? x[s + i] : 0;
      re[i] = v * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < n >> 1; k++) power[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
    if (s + n >= end) break;
  }
  for (let k = 0; k < power.length; k++) power[k] /= frames;
  return { power, binHz: sr / n };
}

// Fraction of the signal's energy between f0 and f1 Hz.
export function bandEnergy(x, sr, f0, f1, opts = {}) {
  const { power, binHz } = powerSpectrum(x, sr, opts.size ?? 4096, opts.start ?? 0, opts.end ?? x.length);
  let inBand = 0,
    total = 0;
  for (let k = 1; k < power.length; k++) {
    const f = k * binHz;
    total += power[k];
    if (f >= f0 && f < f1) inBand += power[k];
  }
  return total > 0 ? inBand / total : 0;
}

export function spectralCentroid(x, sr, opts = {}) {
  const { power, binHz } = powerSpectrum(x, sr, opts.size ?? 4096, opts.start ?? 0, opts.end ?? x.length);
  let num = 0,
    den = 0;
  for (let k = 1; k < power.length; k++) {
    num += k * binHz * power[k];
    den += power[k];
  }
  return den > 0 ? num / den : 0;
}

// Frequency of the strongest spectral peak between f0 and f1 Hz.
export function peakFrequency(x, sr, f0, f1, size = 16384) {
  const { power, binHz } = powerSpectrum(x, sr, size);
  let best = -1,
    bestK = 0;
  for (let k = Math.max(1, Math.floor(f0 / binHz)); k <= Math.min(power.length - 1, Math.ceil(f1 / binHz)); k++) {
    if (power[k] > best) {
      best = power[k];
      bestK = k;
    }
  }
  return bestK * binHz;
}

export function peak(x) {
  let m = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > m) m = a;
  }
  return m;
}

export function rms(x, start = 0, end = x.length) {
  let s = 0;
  for (let i = start; i < end; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, end - start));
}

// RMS in consecutive windows (seconds) -> Float64Array.
export function envelope(x, sr, win = 0.01) {
  const w = Math.max(1, Math.round(win * sr));
  const n = Math.ceil(x.length / w);
  const out = new Float64Array(n);
  for (let j = 0; j < n; j++) out[j] = rms(x, j * w, Math.min(x.length, (j + 1) * w));
  return out;
}

// Loudest short-term RMS (window in seconds, half-window hop).
export function maxShortRms(x, sr, win = 0.05) {
  const w = Math.max(1, Math.round(win * sr));
  let m = 0;
  for (let s = 0; s < Math.max(1, x.length - w + 1); s += Math.max(1, w >> 1)) m = Math.max(m, rms(x, s, Math.min(x.length, s + w)));
  return m;
}

export const toDb = (v) => 20 * Math.log10(Math.max(1e-12, v));

// Step x[c-1] -> x[c] (indices wrap around) relative to the RMS of the
// neighbouring sample-to-sample steps within w samples on either side: a click
// is a step far larger than its neighbours.
export function stepRatioAt(x, c, w) {
  const n = x.length;
  const at = (i) => x[((i % n) + n) % n];
  const jump = Math.abs(at(c) - at(c - 1));
  let s2 = 0;
  for (let k = 1; k <= w; k++) {
    const a = at(c - k) - at(c - k - 1);
    const b = at(c + k) - at(c + k - 1);
    s2 += a * a + b * b;
  }
  const localStep = Math.sqrt(s2 / (2 * w));
  return { jump, localStep, ratio: jump / (localStep + 1e-6) };
}

// How seamless a loop's wrap point is: the step from the last sample to the
// first compared with the steps right around the seam, plus the level on either
// side. Returns { jump, localStep, jumpRatio, typicalStep, levelRatio, dcJump }.
export function loopSeam(x, sr) {
  const n = x.length;
  const w = Math.max(4, Math.round(0.002 * sr));
  const { jump, localStep } = stepRatioAt(x, 0, w);
  let sumSq = 0;
  for (let i = 1; i < n; i++) {
    const d = x[i] - x[i - 1];
    sumSq += d * d;
  }
  const typicalStep = Math.sqrt(sumSq / (n - 1));
  const span = Math.round(0.05 * sr);
  const levelRatio = (rms(x, n - span, n) + 1e-9) / (rms(x, 0, span) + 1e-9);
  // Mean (DC) on either side of the seam, relative to the overall RMS.
  const m = Math.round(0.01 * sr);
  let a0 = 0,
    a1 = 0;
  for (let i = 0; i < m; i++) {
    a0 += x[n - 1 - i];
    a1 += x[i];
  }
  const dcJump = Math.abs(a1 - a0) / m / (rms(x) + 1e-9);
  return { jump, localStep, jumpRatio: jump / (localStep + 1e-6), typicalStep, levelRatio, dcJump };
}

// Magnitude spectrogram in dB for drawing: `cols` frames spread over the signal,
// each an FFT of `size` samples; returns { cols, bins, data: Float32Array(cols*bins), binHz }.
export function spectrogram(x, sr, cols = 256, size = 512) {
  const bins = size >> 1;
  const data = new Float32Array(cols * bins);
  const re = new Float64Array(size),
    im = new Float64Array(size);
  const win = new Float64Array(size);
  for (let i = 0; i < size; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  const norm = 4 / size;
  for (let c = 0; c < cols; c++) {
    const center = Math.floor(((c + 0.5) / cols) * x.length);
    const s = center - (size >> 1);
    for (let i = 0; i < size; i++) {
      const j = s + i;
      re[i] = j >= 0 && j < x.length ? x[j] * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) data[c * bins + k] = toDb(Math.hypot(re[k], im[k]) * norm);
  }
  return { cols, bins, data, binHz: sr / size };
}
