// Close-combat weapons: knives, bayonets, entrenching spades and bats. Same
// conventions as the guns (kit.js), with the hand in place of the trigger:
// meters, the handle along the Z axis, z = 0 where the fist closes round it
// (gripR), the blade, spade or barrel toward -Z, the pommel or knob toward +Z.
// A knife's edge is down (-Y) unless said otherwise, as it lies in a hammer
// grip; a spade's blade lies in the Y-Z plane so that its side edge leads in a
// chop. The tip anchor is also the "muzzle" (the point the game reads for
// where the weapon points).
// Dimensions from docs/research/weapons.md, section 10; shapes and the sizes of
// small parts est. from photos.
import { S } from './parts.js';
import { bar, screw, crisp, sectionLoft, curve, superellipse } from './shapes.js';

const PI = Math.PI;

// curve() through keys given in any order along z.
const along = (keys) => curve([...keys].sort((a, c) => a[0] - c[0]));

// The hold: the handle runs through the fist (grip rake 90 degrees from upright).
function hold(b, { radius, style, tip }) {
  b.anchor('gripR', 0, 0, 0);
  b.anchor('trigger', 0, 0, 0);
  b.anchor('muzzle', 0, tip[1], tip[0]);
  b.anchor('tip', 0, tip[1], tip[0]);
  b.meta.kind = 'melee';
  b.meta.style = style;
  b.meta.gripRake = PI / 2;
  b.meta.gripRadius = radius;
}

// Stations from z0 to z1, closer together toward z1 (a point).
function toward(z0, z1, n, k = 1.6) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(z0 + (z1 - z0) * (1 - (1 - i / n) ** k));
  return out;
}

const smoothstep = (a, c, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (c - a)));
  return t * t * (3 - 2 * t);
};

// A knife or bayonet blade from the guard (z0) to the point (z1 < z0), lofted
// from cross-sections: spine(z) and edge(z) are the heights of its back and
// its edge (the edge below, or above for a blade made to be held edge up),
// thick(z) its thickness at the back. The flats run down to the ridge (a
// fraction of the way from the back to the edge), then the bevel to the edge;
// near the point a false edge (falseEdge(z), 0 .. 1) grinds the back sharp too.
// fuller: { z0, z1, depth }, a groove along each flat.
function blade(b, { z0, z1, spine, edge, thick, ridge = 0.55, falseEdge = () => 0, fuller = null, mat }) {
  const zs = toward(z0, z1, b.lod === 0 ? 30 : b.lod === 1 ? 10 : 4);
  const fl = fuller && b.detail(1);
  const section = (z) => {
    const ys = spine(z),
      ye = edge(z);
    const t = thick(z) / 2;
    const fe = falseEdge(z);
    const at = (s) => ys + (ye - ys) * s;
    const R = [[t * (1 - fe), at(fe * 0.12), true]];
    if (fl) {
      const d = fuller.depth * smoothstep(0, 0.012, Math.min(fuller.z0 - z, z - fuller.z1));
      R.push([t, at(0.14)], [t - Math.min(d, t * 0.6), at(0.27)], [t, at(0.4)]);
    }
    R.push([t, at(ridge), true], [0.0002, at(1), true]);
    const L = R.map(([x, y, c]) => [-x, y, c]).reverse();
    return crisp([...R, ...L]);
  };
  sectionLoft(b, { zs, section, mat });
}

// A turned handle or bat along Z: profile [[r, z], ...] from end to end.
function turned(b, profile, mat, seg = 24) {
  b.lathe({ profile, mat, seg });
}

// A spade's blade: a dished steel sheet in the Y-Z plane from z0 (the socket)
// to z1 (its far end), half as wide as halfW(z) on each side of the handle's
// line, dished by `dish` (m) toward +X at the middle, `thick` thick.
function spadeBlade(b, { z0, z1, halfW, dish = 0.008, thick = 0.002, mat }) {
  const n = b.lod === 0 ? 24 : b.lod === 1 ? 8 : 4;
  const m = b.lod === 0 ? 10 : b.lod === 1 ? 4 : 2;
  const zs = toward(z0, z1, n, 1.3);
  const section = (z) => {
    const w = Math.max(0.0015, halfW(z));
    const front = [],
      back = [];
    for (let i = 0; i <= m; i++) {
      const y = -w + (2 * w * i) / m;
      const x = dish * (1 - (y / Math.max(w, 0.06)) ** 2);
      front.push([x + thick / 2, y]);
      back.push([x - thick / 2, y]);
    }
    return [...front, ...back.reverse()];
  };
  sectionLoft(b, { zs, section, mat });
}

// =============================================================================
// Knives and bayonets

// US M3 trench knife: 298 mm long, a 171 mm spear-point blade with a false edge
// along half its back, parkerized; a grip of stacked leather washers with
// grooves; a steel crossguard whose upper arm is bent forward (to rest the
// thumb on); a steel pommel cap. (Blade 2.2 cm deep, 5 mm thick, est.)
export function knife_m3(b) {
  const P = 'parkerized';
  const G = -0.062; // the guard's front face
  const TIP = G - 0.171;
  const top = curve([[TIP, 0.0005], [TIP + 0.06, 0.0085], [TIP + 0.09, 0.0105], [G, 0.0105]].map(([z, y]) => [z, y]));
  const bot = curve([[TIP, 0.0], [TIP + 0.025, -0.008], [TIP + 0.06, -0.0115], [G, -0.012]]);
  blade(b, {
    z0: G,
    z1: TIP,
    spine: (z) => top(z),
    edge: (z) => bot(z),
    thick: (z) => 0.0005 + 0.0045 * smoothstep(TIP, TIP + 0.07, z),
    falseEdge: (z) => 1 - smoothstep(TIP + 0.06, TIP + 0.09, z),
    ridge: 0.5,
    mat: P,
  });
  // Ricasso: the thick unsharpened root of the blade at the guard.
  b.span({ z0: G - 0.012, z1: G, y0: -0.012, y1: 0.0105, w: 0.005, mat: P, r: 0.0006 });
  // Crossguard: below, a short straight arm; above, bent forward.
  b.box({ x: 0, y: -0.003, z: G + 0.003, w: 0.011, h: 0.044, d: 0.006, mat: P, r: 0.0015 });
  bar(b, { pts: [[0, 0.018, G + 0.003], [0, 0.024, G + 0.0], [0, 0.028, G - 0.008]], r: 0.0035, mat: P, seg: 10 });
  // Stacked leather washers, grooved, a little fuller in the middle.
  const g0 = G + 0.006,
    g1 = g0 + 0.104;
  const prof = [[0, g0], [0.0118, g0]];
  const nG = b.detail(1) ? 7 : 0;
  for (let k = 0; k <= 40; k++) {
    const z = g0 + ((g1 - g0) * k) / 40;
    const u = (z - g0) / (g1 - g0);
    let r = 0.0118 + 0.0022 * Math.sin(PI * u);
    if (nG) {
      const f = (u * (nG + 1)) % 1;
      if (u > 0.04 && u < 0.96) r -= 0.0009 * Math.exp(-(((f - 0.5) / 0.08) ** 2));
    }
    prof.push([r, z]);
  }
  prof.push([0.0118, g1], [0, g1]);
  turned(b, prof, 'leather', 22);
  // Steel spacer at each end and the pommel cap.
  turned(b, [[0, g0 - 0.003], [0.0122, g0 - 0.003], [0.0124, g0 + 0.001], [0, g0 + 0.001]], P, 18);
  turned(b, [[0, g1 - 0.001], [0.0124, g1 - 0.001], [0.013, g1 + 0.006], [0.012, g1 + 0.013], [0.0075, g1 + 0.018], [0, g1 + 0.019]], P, 20);
  if (b.detail(0)) screw(b, { at: [0, 0, g1 + 0.019], axis: 'z', r: 0.003, h: 0.0006, mat: P, slot: 0.3 });
  hold(b, { radius: 0.0135, style: 'stab', tip: [TIP, 0.0] });
}

// Soviet NR-40 scout's knife: 267 mm long, a 152 mm clip-point blade, blued;
// held edge up in the hammer grip (the curve of the S guard says so: its upper
// arm sweeps back toward the hand, the lower forward); a barrel-shaped black
// wooden grip and a steel pommel. (Blade 2.4 cm deep, 4 mm thick.)
export function knife_nr40(b) {
  const M = 'steelDark';
  const G = -0.058;
  const TIP = G - 0.152;
  // Edge up: the "spine" is the lower line here.
  const back = curve([[TIP, 0.0035], [TIP + 0.03, -0.004], [TIP + 0.05, -0.008], [TIP + 0.06, -0.0095], [G, -0.0105]]);
  const edge = curve([[TIP, 0.0035], [TIP + 0.025, 0.0095], [TIP + 0.06, 0.0125], [G, 0.0135]]);
  blade(b, {
    z0: G,
    z1: TIP,
    spine: back,
    edge,
    thick: (z) => 0.0005 + 0.0035 * smoothstep(TIP, TIP + 0.06, z),
    falseEdge: (z) => 0.6 * (1 - smoothstep(TIP + 0.035, TIP + 0.06, z)),
    ridge: 0.45,
    mat: M,
  });
  // S-shaped guard: a flat steel bar across the blade's root, the upper end
  // curving back toward the hand, the lower end forward.
  const S2 = [
    [0, -0.034, G - 0.01],
    [0, -0.026, G - 0.002],
    [0, -0.014, G + 0.002],
    [0, 0.0, G + 0.002],
    [0, 0.016, G + 0.002],
    [0, 0.028, G + 0.008],
    [0, 0.034, G + 0.018],
  ];
  bar(b, { pts: S2, r: 0.0028, ry: 1.6, mat: M, seg: 10 });
  // Barrel-shaped grip, oval in section (lathed round here), and the pommel.
  const g0 = G + 0.004,
    g1 = g0 + 0.099;
  const prof = [[0, g0], [0.0105, g0]];
  for (let k = 0; k <= 16; k++) {
    const u = k / 16;
    prof.push([0.0105 + 0.0035 * Math.sin(PI * u) ** 0.8, g0 + (g1 - g0) * u]);
  }
  prof.push([0, g1]);
  turned(b, prof, 'bakeliteBlack', 22);
  turned(b, [[0, g0 - 0.003], [0.0108, g0 - 0.003], [0.0108, g0 + 0.001], [0, g0 + 0.001]], M, 18);
  turned(b, [[0, g1 - 0.001], [0.0112, g1 - 0.001], [0.0118, g1 + 0.005], [0.0095, g1 + 0.011], [0, g1 + 0.012]], M, 18);
  hold(b, { radius: 0.0125, style: 'stab', tip: [TIP, 0.0035] });
}

// A bayonet's hilt: a steel frame with grip slabs on each side (screwed
// through), a crossguard and a pommel. Side outline of the grip from g0 (at
// the guard) to g1, height h (centered on the handle's line), slab thickness
// w; ring: a muzzle ring on top of the guard (bore height above the line).
function bayonetHilt(b, { G, len, h, w, grips, steel, ring = null, screws = [] }) {
  const g0 = G,
    g1 = G + len;
  const out = S([[g0, h / 2], [g1 - 0.012, h / 2 + 0.001], [g1, h / 2 - 0.002], [g1, -h / 2 + 0.002], [g1 - 0.012, -h / 2 - 0.002], [g0, -h / 2]], 3);
  // Steel frame (the back strap and front strap show above and below the slabs).
  b.extrude({ points: out, width: w * 0.55, mat: steel, bevel: 0.0012 });
  // Grip slabs, a little inside the frame's outline.
  const slab = S([[g0 + 0.004, h / 2 - 0.002], [g1 - 0.014, h / 2 - 0.001], [g1 - 0.012, -h / 2 + 0.0], [g0 + 0.004, -h / 2 + 0.002]], 3);
  b.extrude({ points: slab, width: w, mat: grips, bevel: 0.0025 });
  if (b.detail(0)) for (const z of screws) for (const sx of [-1, 1]) screw(b, { at: [(sx * w) / 2, 0, z], axis: sx > 0 ? 'x' : '-x', r: 0.0035, h: 0.0008, mat: steel, slot: 0.6 });
  // Pommel: the steel head with the slot for the bayonet lug, its catch button.
  b.extrude({ points: S([[g1 - 0.002, h / 2 + 0.002], [g1 + 0.016, h / 2 + 0.003], [g1 + 0.02, h / 2 - 0.004], [g1 + 0.02, -h / 2 + 0.002], [g1 + 0.01, -h / 2 - 0.001], [g1 - 0.002, -h / 2]], 3), width: w * 0.85, mat: steel, bevel: 0.0015 });
  if (b.detail(1)) b.cylAxis({ axis: 'x', x: (w * 0.85) / 2, y: 0.0, z: g1 + 0.009, len: 0.003, r: 0.0035, mat: steel, seg: 12 });
  // Crossguard, with the muzzle ring above it.
  b.box({ x: 0, y: ring ? 0.006 : 0, z: G - 0.003, w: w * 0.7, h: h + (ring ? 0.024 : 0.012), d: 0.007, mat: steel, r: 0.0015 });
  if (ring) {
    const ry = h / 2 + ring;
    const pts = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * 2 * PI;
      pts.push([Math.cos(a) * 0.0088, ry + Math.sin(a) * 0.0088, G - 0.003]);
    }
    bar(b, { pts, r: 0.0025, closed: true, mat: steel, seg: 8 });
  }
  return { g1 };
}

// German Seitengewehr 84/98 (third pattern), the Kar 98k's bayonet: 385 mm
// long, a 252 mm single-edged blade with a fuller along each side, blued; the
// hilt with brown bakelite grips held by two screws, a short crossguard and the
// pommel with the slot for the bayonet lug. The hand closes on the grip.
export function bayonet_s84_98(b) {
  const M = 'steel';
  const G = -0.05;
  const TIP = G - 0.252;
  const top = curve([[TIP, 0.0], [TIP + 0.03, 0.0075], [TIP + 0.06, 0.0095], [G, 0.0105]]);
  const bot = curve([[TIP, 0.0], [TIP + 0.02, -0.0075], [TIP + 0.06, -0.0115], [G, -0.0125]]);
  blade(b, {
    z0: G,
    z1: TIP,
    spine: top,
    edge: bot,
    thick: (z) => 0.0005 + 0.0055 * smoothstep(TIP, TIP + 0.08, z),
    falseEdge: (z) => 0.5 * (1 - smoothstep(TIP + 0.02, TIP + 0.05, z)),
    fuller: { z0: G - 0.01, z1: G - 0.2, depth: 0.0013 },
    ridge: 0.6,
    mat: M,
  });
  bayonetHilt(b, { G, len: 0.112, h: 0.03, w: 0.022, grips: 'bakelite', steel: M, screws: [G + 0.03, G + 0.075] });
  hold(b, { radius: 0.0135, style: 'stab', tip: [TIP, 0.0] });
}

// Soviet AVS-36 knife bayonet: 450 mm long, a 335 mm blade with a fuller,
// blued; wooden grips on a steel hilt held by two screws; the crossguard
// carries the muzzle ring; the pommel the slot for the rifle's lug.
export function bayonet_avs36(b) {
  const M = 'steelDark';
  const G = -0.05;
  const TIP = G - 0.335;
  const top = curve([[TIP, 0.0], [TIP + 0.035, 0.0075], [TIP + 0.08, 0.0095], [G, 0.01]]);
  const bot = curve([[TIP, 0.0], [TIP + 0.02, -0.007], [TIP + 0.07, -0.0105], [G, -0.0115]]);
  blade(b, {
    z0: G,
    z1: TIP,
    spine: top,
    edge: bot,
    thick: (z) => 0.0005 + 0.005 * smoothstep(TIP, TIP + 0.1, z),
    falseEdge: (z) => 0.5 * (1 - smoothstep(TIP + 0.025, TIP + 0.06, z)),
    fuller: { z0: G - 0.012, z1: G - 0.25, depth: 0.0012 },
    ridge: 0.6,
    mat: M,
  });
  bayonetHilt(b, { G, len: 0.096, h: 0.029, w: 0.022, grips: 'birch', steel: M, ring: 0.004, screws: [G + 0.026, G + 0.066] });
  hold(b, { radius: 0.0135, style: 'stab', tip: [TIP, 0.0] });
}

// =============================================================================
// Entrenching spades

// A spade's straight wooden handle: profile radii along it from zEnd (its end
// behind the hand) to zSocket (where it goes into the blade's socket).
function spadeHandle(b, { zEnd, zSocket, r, rEnd = r, mat }) {
  const prof = [[0, zEnd], [rEnd * 0.75, zEnd], [rEnd, zEnd - 0.006]];
  for (let k = 1; k <= 6; k++) {
    const z = zEnd - 0.006 + ((zSocket - zEnd + 0.006) * k) / 6;
    prof.push([rEnd + (r - rEnd) * (k / 6), z]);
  }
  prof.push([0, zSocket]);
  turned(b, prof, mat, 18);
}

// The tapered steel socket round the handle's end, flaring into the blade.
function socket(b, { z0, z1, r0, r1, mat }) {
  turned(b, [[0, z0], [r0 * 0.96, z0], [r0, z0 - 0.002], [r1, z1 + 0.004], [r1 * 0.7, z1], [0, z1]], mat, 18);
}

// US M-1910 entrenching tool, the "T-handle" shovel: 56 cm long; a pointed
// pressed-steel blade 17 cm wide, painted olive drab, on a tapered socket; a
// straight wooden handle with a wooden T crossbar at its end. The hand holds the
// handle just in front of the T.
export function spade_m1910(b) {
  const Z0 = -0.27; // the blade's root
  const L = 0.2;
  const half = along([[Z0, 0.03], [Z0 - 0.015, 0.072], [Z0 - 0.04, 0.083], [Z0 - 0.11, 0.084], [Z0 - 0.16, 0.06], [Z0 - 0.19, 0.022], [Z0 - L, 0.0]]);
  spadeBlade(b, { z0: Z0, z1: Z0 - L, halfW: half, dish: 0.009, mat: 'olive' });
  socket(b, { z0: -0.2, z1: Z0 - 0.02, r0: 0.0165, r1: 0.024, mat: 'olive' });
  // A stiffening rib pressed down the blade's middle.
  b.box({ x: 0.0095, y: 0, z: Z0 - 0.05, w: 0.004, h: 0.012, d: 0.08, mat: 'olive', r: 0.002 });
  spadeHandle(b, { zEnd: 0.05, zSocket: -0.205, r: 0.0155, rEnd: 0.0145, mat: 'ash' });
  // T crossbar, pinned through the handle's end.
  b.cylAxis({ axis: 'y', x: 0, y: 0, z: 0.064, len: 0.1, r: 0.0135, mat: 'ash', seg: 16 });
  b.cylAxis({ axis: 'z', x: 0, y: 0, z: 0.054, len: 0.012, r: 0.0165, mat: 'olive', seg: 16 }); // ferrule
  if (b.detail(0)) for (const z of [-0.18, -0.235]) screw(b, { at: [0.019, 0, z], axis: 'x', r: 0.003, h: 0.0008, mat: 'olive', dome: true, slot: 0 });
  hold(b, { radius: 0.016, style: 'swing', tip: [Z0 - L, 0] });
}

// German small entrenching tool (kleines Schanzzeug): 53.5 cm long; a square
// pressed-steel blade 18.5 cm long and 14.5 cm wide with rounded corners,
// painted field grey; its collar round the handle's end held by a screw; a
// straight beech handle a little thicker at its end.
export function spade_ge(b) {
  const Z0 = -0.3;
  const L = 0.185;
  const half = along([[Z0, 0.028], [Z0 - 0.012, 0.064], [Z0 - 0.028, 0.0725], [Z0 - L + 0.012, 0.0725], [Z0 - L + 0.002, 0.066], [Z0 - L, 0.06]]);
  spadeBlade(b, { z0: Z0, z1: Z0 - L, halfW: half, dish: 0.007, mat: 'germanGrey' });
  socket(b, { z0: -0.235, z1: Z0 - 0.015, r0: 0.0175, r1: 0.024, mat: 'germanGrey' });
  b.box({ x: 0.009, y: 0, z: Z0 - 0.045, w: 0.004, h: 0.01, d: 0.07, mat: 'germanGrey', r: 0.002 });
  spadeHandle(b, { zEnd: 0.05, zSocket: -0.24, r: 0.016, rEnd: 0.0175, mat: 'beech' });
  if (b.detail(0)) screw(b, { at: [0.02, 0, -0.25], axis: 'x', r: 0.0045, h: 0.0012, mat: 'germanGrey', slot: 0.2 });
  hold(b, { radius: 0.0165, style: 'swing', tip: [Z0 - L, 0.03] });
}

// Soviet MPL-50 small infantry spade: 50 cm long; a pointed steel blade 18 cm
// long and 15 cm wide, its edges ground sharp, on a socket with two straps
// riveted along the wooden handle (the straps reach well up the handle).
export function spade_mpl50(b) {
  const Z0 = -0.275;
  const L = 0.18;
  const half = along([[Z0, 0.03], [Z0 - 0.012, 0.068], [Z0 - 0.03, 0.075], [Z0 - 0.11, 0.075], [Z0 - 0.15, 0.05], [Z0 - L, 0.004]]);
  spadeBlade(b, { z0: Z0, z1: Z0 - L, halfW: half, dish: 0.008, mat: 'steelDark' });
  socket(b, { z0: -0.23, z1: Z0 - 0.015, r0: 0.0165, r1: 0.022, mat: 'steelDark' });
  // The two straps along the handle, above and below, riveted through.
  for (const sy of [-1, 1]) {
    b.box({ x: 0, y: sy * 0.0165, z: -0.17, w: 0.014, h: 0.002, d: 0.12, mat: 'steelDark', r: 0.0008 });
    if (b.detail(0)) for (const z of [-0.12, -0.2]) b.cylAxis({ axis: 'y', x: 0, y: sy * 0.0175, z, len: 0.0015, r: 0.0028, mat: 'steelDark', seg: 10 });
  }
  spadeHandle(b, { zEnd: 0.045, zSocket: -0.235, r: 0.0155, rEnd: 0.0165, mat: 'ash' });
  hold(b, { radius: 0.016, style: 'swing', tip: [Z0 - L, 0.004] });
}

// =============================================================================
// Bats

// A baseball bat of the 1930s: 35 in (889 mm) long, about 36 oz (1.02 kg),
// turned from ash, thick-handled (2.65 in, 67 mm, across the barrel; 25 mm at
// the handle) with a small knob; the hand at the knob.
function baseballBat(b, mat) {
  const K = 0.052; // the knob's end
  const prof = [
    [0, K],
    [0.012, K - 0.0005],
    [0.0185, K - 0.004],
    [0.019, K - 0.009],
    [0.0145, K - 0.015],
    [0.0128, K - 0.024],
    [0.0128, -0.05],
    [0.0135, -0.15],
    [0.0158, -0.26],
    [0.0205, -0.38],
    [0.027, -0.5],
    [0.0318, -0.62],
    [0.0335, -0.72],
    [0.0335, -0.8],
    [0.0322, -0.825],
    [0.0275, -0.834],
    [0.015, -0.8368],
    [0, -0.837],
  ];
  turned(b, prof, mat, 28);
  hold(b, { radius: 0.0135, style: 'swing', tip: [-0.837, 0] });
}

export function bat_us(b) {
  baseballBat(b, 'ash');
}

// The German army's bat, from the baseball game at the Berlin Olympics of 1936:
// the same American bat, darker for its stain.
export function bat_ge(b) {
  baseballBat(b, 'beech');
}

// Lapta bat (Russian bat-and-ball game): 80 cm of birch, a round handle 3 cm
// thick widening into a flattened striking end 5 cm wide (the rules allow 60 to
// 110 cm and at most 5 cm across); the hand at the end of the handle.
export function bat_lapta(b) {
  const z0 = 0.045,
    z1 = -0.755;
  const n = b.lod === 0 ? 30 : b.lod === 1 ? 10 : 5;
  const M = b.lod === 0 ? 24 : b.lod === 1 ? 10 : 6;
  const zs = toward(z0, z1, n, 1.0);
  // Width (across, X) and height (Y) of the section along the bat.
  const wide = curve([[z1, 0.044], [z1 + 0.02, 0.05], [-0.42, 0.05], [-0.22, 0.033], [-0.05, 0.031], [z0 - 0.012, 0.033], [z0, 0.024]]);
  const deep = curve([[z1, 0.024], [z1 + 0.02, 0.032], [-0.42, 0.034], [-0.22, 0.032], [-0.05, 0.031], [z0 - 0.012, 0.033], [z0, 0.024]]);
  const section = (z) => superellipse(0, 0, wide(z), deep(z), 2.3, M);
  sectionLoft(b, { zs, section, mat: 'ash' });
  hold(b, { radius: 0.0155, style: 'swing', tip: [z1, 0] });
}
