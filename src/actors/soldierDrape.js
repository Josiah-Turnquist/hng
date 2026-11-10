// How cloth lies on an arm or a leg: the folds of a sleeve and of a trouser leg.
//
// A limb in a garment is not a pipe. The cloth is longer and wider than the
// limb, so it gathers where the limb bends (a few deep folds across the inside
// of the elbow and the back of the knee, fanning toward the point of the
// joint), hangs in long slanting folds between the joints (from the shoulder
// to the inside of the elbow, from the crotch across the thigh to the knee),
// bags over the kneecap, sags behind the upper arm, and stacks up where it is
// stopped by a cuff or a boot. Each fold here is one ridge with a place, a
// direction, a length, a height and a width: a handful a limb, a little
// different on every man.
//
// Places are given round the limb by an angle phi and along it by s (metres
// from the shoulder or hip joint). phi: 0 = front, PI/2 = the outside,
// PI = back, -PI/2 = the side toward the body. The arm bends forward (the
// inside of the elbow is at phi 0), the knee backward (phi PI).
//
//   const d = sleeveDrape({ side, seed, elbow, end, cuff, roll });
//   d.at(s, a)     radial offset in metres at s and the tube's own angle a
//   d.shade(s, a)  how much light the hollows beside the folds keep (1 = all)
import { hash1 } from './soldierBody.js';
import { smooth01 } from './soldierGeo.js';

const PI = Math.PI;
const wrap = (a) => a - 2 * PI * Math.round(a / (2 * PI));
const bump = (x, c, w) => {
  const d = (x - c) / w;
  return Math.abs(d) >= 1 ? 0 : (1 - d * d) * (1 - d * d);
};

// How bold the folds are, all together: the heights and widths below are
// those of light cloth; a soldier's wool and heavy cotton fold deeper and
// broader (a fold at the elbow of a wool tunic stands ~2 cm).
const HIGH = 1.7,
  WIDE = 1.3;

// One fold: a ridge from (p1, s1) to (p2, s2), h high, w wide (to ~0.37 of its
// height), on a limb of radius r. curve bows it (toward +s for a fold lying
// across the limb: its ends then point down the limb). lean > 1 makes the side
// toward +s (or, for a fold along the limb, toward +phi) the longer slope.
function fold(r, p1, s1, p2, s2, h, w, { curve = 0, lean = 1 } = {}) {
  const dx = wrap(p2 - p1) * r,
    dy = s2 - s1;
  const L = Math.hypot(dx, dy) / 2;
  return { pc: p1 + wrap(p2 - p1) / 2, sc: (s1 + s2) / 2, ux: dx / (2 * L), uy: dy / (2 * L), L, h: h * HIGH, w: w * WIDE, curve, lean, r };
}
// A fold lying round the limb, centred on (p, s), reaching `half` metres either way.
const across = (r, p, s, half, h, w, opts) => fold(r, p - half / r, s, p + half / r, s, h, w, opts);

// The height of the folds at (phi, s), and (in _occ) how deep in a hollow
// beside one the point lies.
let _occ = 0;
function sum(folds, phi, s) {
  let d = 0;
  _occ = 0;
  for (let i = 0; i < folds.length; i++) {
    const f = folds[i];
    const y = s - f.sc;
    if (y > f.L + 0.06 || y < -f.L - 0.06) continue;
    const x = wrap(phi - f.pc) * f.r;
    const al = x * f.ux + y * f.uy;
    const t = al / f.L;
    if (t >= 1 || t <= -1) continue;
    let q = (-x * f.uy + y * f.ux + f.curve * al * al) / f.w;
    if (f.lean !== 1) q = q > 0 ? q / f.lean : q * f.lean;
    if (q > 3.2 || q < -3.2) continue;
    const taper = (1 - t * t) * (1 - t * t);
    const ridge = Math.exp(-q * q);
    d += f.h * taper * ridge;
    // (The hollow lies beside the ridge: a wider hump with the ridge taken out.)
    _occ += f.h * taper * (Math.exp(-q * q * 0.28) - ridge);
  }
  return d;
}

// The folds of each man differ a little: jit(i) is -1..1, steady for a seed.
const jitter = (seed) => (i) => hash1(seed * 31.7 + i * 7.3) * 2 - 1;

function limb(folds, toPhi, extra, gain) {
  const at = (s, a) => {
    const phi = toPhi(a);
    return (sum(folds, phi, s) + (extra ? extra(phi, s) * HIGH : 0)) * gain(s);
  };
  return {
    at,
    shade: (s, a) => {
      sum(folds, toPhi(a), s);
      return 1 - Math.min(0.42, _occ * gain(s) * 30);
    },
  };
}

// A sleeve. side: -1 left, 1 right. elbow: s of the elbow. end: where the
// sleeve stops. cuff: it ends in a cuff the cloth stacks up on. roll: it is
// rolled up instead. k: fold strength (1 = a wool tunic).
export function sleeveDrape({ side = 1, seed = 1, elbow = 0.306, end = 0.555, cuff = true, roll = 0, k = 1 } = {}) {
  const j = jitter(seed);
  const r = 0.048;
  const E = elbow;
  const F = [];
  // Inside the elbow: three deep folds across, the outer two bowed toward it.
  F.push(across(r, 0.1 + 0.25 * j(1), E - 0.04 + 0.006 * j(2), 0.058, 0.0105 * (1 + 0.2 * j(3)), 0.0078, { curve: -6, lean: 1.3 }));
  F.push(across(r, -0.05 + 0.2 * j(4), E + 0.002 + 0.004 * j(5), 0.07, 0.0135 * (1 + 0.15 * j(6)), 0.0085));
  F.push(across(r, 0.15 + 0.25 * j(7), E + 0.044 + 0.006 * j(8), 0.058, 0.0105 * (1 + 0.2 * j(9)), 0.0078, { curve: 6, lean: 0.77 }));
  // The upper arm: a fold slanting from the front of the shoulder down to the
  // inside of the elbow, and one hanging behind the arm.
  F.push(fold(r, 0.72 + 0.1 * j(10), 0.055, -0.05 + 0.2 * j(11), 0.25, 0.0062, 0.0105));
  F.push(fold(r, -2.6 + 0.2 * j(12), 0.05, -1.25 + 0.2 * j(13), 0.245, 0.0072, 0.0115));
  // From the armhole, front and back.
  F.push(fold(r, 0.25, 0.0, 0.55 + 0.1 * j(14), 0.075, 0.0042, 0.008));
  F.push(fold(r, -2.95, 0.0, -2.55 + 0.1 * j(15), 0.085, 0.0045, 0.008));
  // The forearm: folds winding round it down toward the cuff.
  F.push(fold(r, 0.4 + 0.2 * j(16), E + 0.07, 1.9 + 0.2 * j(17), E + 0.185, 0.0065, 0.009));
  F.push(fold(r, -1.4 + 0.2 * j(18), E + 0.08, -0.1 + 0.2 * j(19), E + 0.2, 0.006, 0.009));
  F.push(fold(r, 2.6 + 0.2 * j(20), E + 0.115, 3.9 + 0.2 * j(21), E + 0.215, 0.005, 0.0085));
  // Stacked on the cuff: two uneven rings of slack.
  const stack = cuff && !roll && end > 0.45;
  const ph = j(22) * 3;
  const extra = (phi, s) => {
    let d = 0;
    // Slack hanging behind and under the upper arm.
    d += 0.006 * bump(s, 0.11, 0.11) * Math.max(0, Math.cos(phi + 2.3)) ** 2;
    // The hollow of the bent elbow between its folds.
    d -= 0.003 * bump(s, E, 0.075) * Math.max(0, Math.cos(phi)) ** 2;
    if (stack) {
      for (let n = 0; n < 2; n++) {
        // (Each a crumple part of the way round, slanting: not a ring.)
        const sc = end - 0.084 - n * 0.03 + 0.013 * Math.sin(phi * (1 + n) + ph + n * 2);
        const q = (s - sc) / (0.0068 * WIDE);
        if (q < 3 && q > -3) d += (0.0065 - n * 0.001) * Math.max(0, 0.25 + 0.75 * Math.sin(phi * (1.5 - 0.5 * n) + ph * 1.7 + n * 2.6)) * Math.exp(-q * q);
      }
    }
    return d;
  };
  // Nothing at the shoulder's head (inside the garment) nor where the cuff or
  // the roll begins; quiet on the outside of the upper arm (insignia are sewn
  // there) and over the point of the elbow (taut, and patched on some).
  const stop = roll ? end - 0.04 : end - 0.066;
  const ends = (s) => k * smooth01(-0.015, 0.03, s) * smooth01(stop, stop - 0.035, s);
  const toPhi = (a) => wrap((a + PI / 2) * side);
  const quiet = (phi, s) => {
    const ap = Math.abs(phi);
    const back = smooth01(1.7, 2.15, ap) * bump(s, E + 0.005, 0.1);
    const badge = bump(s, 0.11, 0.1) * smooth01(0.75, 1.0, phi) * smooth01(2.4, 2.15, phi);
    return 1 - Math.max(back, badge);
  };
  const base = limb(F, toPhi, extra, ends);
  return {
    at: (s, a) => base.at(s, a) * quiet(toPhi(a), s),
    shade: (s, a) => 1 - (1 - base.shade(s, a)) * quiet(toPhi(a), s),
  };
}

// A trouser leg. knee: s of the knee. style 'straight' | 'breeches' | 'jump'.
// tuck: s where it goes into a boot or legging (0: it does not).
export function trouserDrape({ side = 1, seed = 1, knee = 0.425, end = 0.84, style = 'straight', tuck = 0, k = 1 } = {}) {
  const j = jitter(seed);
  const r = 0.07;
  const K = knee;
  const br = style === 'breeches' ? 1 : 0;
  const F = [];
  // Behind the knee: three deep folds across, the outer two bowed toward it.
  F.push(across(r, PI - 0.1 + 0.2 * j(1), K - 0.042 + 0.006 * j(2), 0.075, 0.011 * (1 + 0.2 * j(3)), 0.009, { curve: -5, lean: 1.3 }));
  F.push(across(r, PI + 0.05 + 0.2 * j(4), K + 0.005 + 0.004 * j(5), 0.085, 0.014 * (1 + 0.15 * j(6)), 0.0095));
  F.push(across(r, PI - 0.05 + 0.2 * j(7), K + 0.052 + 0.006 * j(8), 0.07, 0.0105 * (1 + 0.2 * j(9)), 0.009, { curve: 5, lean: 0.77 }));
  // In front: a break above the knee and one under the bag of the kneecap.
  F.push(across(r, 0.05 + 0.2 * j(10), K - 0.078 + 0.008 * j(11), 0.058, 0.006, 0.0095, { curve: -4 }));
  F.push(across(r, 0.1 + 0.2 * j(12), K + 0.095 + 0.008 * j(13), 0.052, 0.0058, 0.0095, { curve: 4 }));
  // The thigh: folds pulled from the crotch across the front toward the
  // outside of the knee, and short ones in the bend of the hip.
  F.push(fold(r, -1.3 + 0.15 * j(14), 0.085, 0.7 + 0.15 * j(15), 0.3, 0.008, 0.013));
  F.push(fold(r, -1.1 + 0.15 * j(16), 0.16, 0.5 + 0.15 * j(17), 0.36, 0.007, 0.012));
  F.push(fold(r, -0.9 + 0.1 * j(18), 0.035, 0.55 + 0.15 * j(19), 0.075, 0.006, 0.01));
  // Behind: the drop under the seat, and a fold from there to the back of the knee.
  F.push(across(r, PI + 0.1 * j(20), 0.075 + 0.01 * j(21), 0.07, 0.008, 0.011, { lean: 0.7 }));
  F.push(fold(r, 2.3 + 0.2 * j(22), 0.13, PI + 0.3 + 0.2 * j(23), 0.33, 0.0065, 0.012));
  // Breeches stand out at the side of the thigh in a long soft fold.
  if (br) F.push(fold(r, 1.35 + 0.15 * j(24), 0.1, 1.75 + 0.15 * j(25), 0.33, 0.007, 0.016));
  // The lower leg, where it shows: folds slanting round the shin.
  if (!br) {
    F.push(fold(0.06, 0.9 + 0.2 * j(26), K + 0.13, -0.6 + 0.2 * j(27), K + 0.27, 0.006, 0.01));
    F.push(fold(0.06, 2.4 + 0.2 * j(28), K + 0.15, 4.0 + 0.2 * j(29), K + 0.3, 0.0055, 0.01));
  }
  // Stacked over a boot or legging: two uneven rings of slack above the tuck.
  const ph = j(30) * 3;
  const extra = (phi, s) => {
    let d = 0;
    // The bag of the knee, in front and below the kneecap.
    d += 0.007 * bump(s, K + 0.03, 0.075) * Math.max(0, Math.cos(phi)) ** 2;
    // The hollow of the bent knee between its folds.
    d -= 0.003 * bump(s, K + 0.005, 0.08) * Math.max(0, -Math.cos(phi)) ** 2;
    if (tuck) {
      for (let n = 0; n < 2; n++) {
        const sc = tuck - 0.052 - n * 0.034 + 0.013 * Math.sin(phi * (1 + n) + ph + n * 2);
        const q = (s - sc) / (0.0078 * WIDE);
        if (q < 3 && q > -3) d += (0.006 - n * 0.001) * Math.max(0, 0.25 + 0.75 * Math.sin(phi * (1.5 - 0.5 * n) + ph * 1.7 + n * 2.6)) * Math.exp(-q * q);
      }
    }
    return d;
  };
  // Nothing inside the hips or below the tuck; less at the top of the thigh,
  // under a tunic's skirt, which the folds would come through. Breeches are
  // tight from under the knee down.
  const stop = tuck ? tuck - 0.012 : end - 0.02;
  const ends = (s) => k * smooth01(0.0, 0.04, s) * (0.4 + 0.6 * smooth01(0.1, 0.22, s)) * smooth01(stop, stop - 0.03, s) * (br ? 1 - 0.75 * smooth01(K + 0.03, K + 0.09, s) : 1);
  const toPhi = (a) => wrap((a + PI / 2) * side);
  return limb(F, toPhi, extra, ends);
}
