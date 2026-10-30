// Small math helpers shared by every system. Units are SI everywhere:
// meters, seconds, kilograms, radians, newtons.

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const G = 9.80665; // standard gravity, m/s^2

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const remap = (v, a0, a1, b0, b1) => b0 + ((v - a0) / (a1 - a0)) * (b1 - b0);
export const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const sign = (v) => (v < 0 ? -1 : 1);
export const sq = (v) => v * v;

// Frame-rate independent exponential smoothing toward a target.
// "rate" is how quickly we close the gap (1/s). damp(x, target, 10, dt).
export const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));

// Move a value toward a target by at most maxDelta.
export const approach = (current, target, maxDelta) => {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
};

// Wrap an angle to the range -PI..PI.
export const wrapAngle = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

// Critically damped spring, used for weapon sway, recoil recovery and camera motion.
// State is {x, v}. Returns nothing; mutates state.
export function springStep(state, target, stiffness, damping, dt) {
  const f = -stiffness * (state.x - target) - damping * state.v;
  state.v += f * dt;
  state.x += state.v * dt;
}

// ---------------------------------------------------------------------------
// Seeded random numbers (mulberry32). Deterministic so maps are the same every run.
export class RNG {
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  // Normally distributed value (Box-Muller).
  gauss(mean = 0, sd = 1) {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

// The battle's own random numbers. Everything that decides what happens in a
// battle (spread, recoil, ricochets, fires, bots' choices) draws from here, so
// a battle seeded the same way plays out the same way: it can be recorded and
// played back, and a server can run several battles side by side, each
// switching to its own stream while it steps (Game.update). Looks and sounds
// (camera shake, smoke, sparks) keep Math.random.
let stream = new RNG(0x2545f491);
export function useStream(rng) {
  stream = rng;
}
export const rand = () => stream.next();

// A normally distributed number from the battle's stream.
export function gaussRandom(mean = 0, sd = 1) {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Simplex noise (Stefan Gustavson's public domain algorithm), seeded.
const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

export class Noise {
  constructor(seed = 1) {
    const rng = new RNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  // 2D simplex noise, output roughly -1..1
  noise2(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const perm = this.perm;
    const pm = this.permMod12;
    let n0 = 0,
      n1 = 0,
      n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi = pm[ii + perm[jj]] * 3;
      t0 *= t0;
      n0 = t0 * t0 * (GRAD3[gi] * x0 + GRAD3[gi + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi = pm[ii + i1 + perm[jj + j1]] * 3;
      t1 *= t1;
      n1 = t1 * t1 * (GRAD3[gi] * x1 + GRAD3[gi + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi = pm[ii + 1 + perm[jj + 1]] * 3;
      t2 *= t2;
      n2 = t2 * t2 * (GRAD3[gi] * x2 + GRAD3[gi + 1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }

  // Fractal sum of octaves. Output roughly -1..1.
  fbm2(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
    let sum = 0,
      amp = 1,
      freq = 1,
      norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise2(x * freq + o * 17.13, y * freq - o * 9.71);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  // Ridged noise: sharp crests, good for hills and rocky ridges. Output 0..1.
  ridged2(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
    let sum = 0,
      amp = 0.5,
      freq = 1,
      prev = 1,
      norm = 0;
    for (let o = 0; o < octaves; o++) {
      let n = 1 - Math.abs(this.noise2(x * freq + o * 31.7, y * freq + o * 11.3));
      n *= n;
      sum += n * amp * prev;
      norm += amp;
      prev = n;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers on plain numbers (no allocations in hot paths).

// Distance from point P to segment AB in 2D (x/z plane). Returns distance and t.
export function distToSegment2(px, pz, ax, az, bx, bz) {
  const abx = bx - ax,
    abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / len2 : 0;
  t = clamp01(t);
  const cx = ax + abx * t,
    cz = az + abz * t;
  const dx = px - cx,
    dz = pz - cz;
  return { d: Math.sqrt(dx * dx + dz * dz), t };
}

// Catmull-Rom spline through 2D points, sampled every `step` meters.
export function sampleSpline2(points, step = 2) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(1, Math.ceil(segLen / step));
    for (let k = 0; k < n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1].slice());
  return out;
}

// Formats a number with fixed decimals, dropping "-0".
export function fmt(v, d = 0) {
  const s = v.toFixed(d);
  return s === '-0' || s === '-0.0' ? s.slice(1) : s;
}
