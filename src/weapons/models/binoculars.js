// Binoculars (weapons/items/binoculars.js): each army's 6x30 Porro prism
// glasses. Same conventions as the guns (kit.js): meters, the line of sight
// along Z through the middle between the two eyepieces (x = y = 0), the
// objectives toward -Z, the eyecups at z = 0. Each half: a rubber or bakelite
// eyecup, the knurled focusing ring of its eyepiece (each eye focused on its
// own, as service glasses were), the prism housing (Porro prisms set the
// objective further out than the eyepiece, which gives these glasses their
// shape), covered in leatherette between its painted ends, and the objective
// in its cell. The two halves turn on a hinge in the middle (the knuckles
// alternate) to fit the eyes. Sizes from the makers' figures where known
// (docs/research/weapons.md, section 10), the rest est. from photos.
//
// Anchors: scopeEye and scopeFront (the middle between the eyepieces and the
// objectives: sighting.js looks along it), gripR and gripL (the middle of each
// half, as the hands hold it: palms on the outer sides, fingers over the top).
import { tube, lathe } from './parts.js';
import { plateXYz, knurledKnob } from './shapes.js';

const PI = Math.PI;

// Front-view outline (x, y) round the eyepiece axis (ex) and the objective axis
// (ox), radii re and ro, grown by g: the two circles and the straight sides
// between them.
function hull(ex, re, ox, ro, g, M) {
  const s = Math.sign(ox - ex) || 1;
  // The straight sides touch both circles where their normal is h from the
  // line between the centers (a bigger objective end tilts them).
  const h = PI / 2 - Math.asin((ro - re) / Math.abs(ox - ex));
  const pts = [];
  // Round the objective end (the far side), then round the eyepiece end.
  for (let i = 0; i <= M; i++) {
    const a = -h + (2 * h * i) / M;
    pts.push([ox + s * Math.cos(a) * (ro + g), Math.sin(a) * (ro + g)]);
  }
  for (let i = 0; i <= M; i++) {
    const a = h + ((2 * PI - 2 * h) * i) / M;
    pts.push([ex + s * Math.cos(a) * (re + g), Math.sin(a) * (re + g)]);
  }
  return pts;
}

// One pair. v: { e (eyepiece axis from the middle), xo (objective axis), re, ro
// (housing radii round each), zh0, zh1 (housing, z), zo (front of the objective
// cell), objR (objective glass), cupR, cupLen, paint, cover, cup (materials),
// eyepiece (the focusing sleeve's length) }.
function binocular(b, v) {
  const M = b.detail(0) ? 14 : b.detail(1) ? 6 : 3;
  const { e, xo, re, ro, zh0, zh1, zo, objR, cupR, cupLen, paint, cover, cup } = v;
  const zf = zo + 0.008; // back of the objective cell
  for (const s of [1, -1]) {
    const ex = s * e,
      ox = s * xo;
    // Eyecup and eyepiece lens.
    lathe(b, { x: ex, mat: cup, seg: 28, profile: [[0.0088, -0.0035], [0.0096, 0], [cupR - 0.0012, 0], [cupR, -0.0014], [cupR, -cupLen], [0, -cupLen]] });
    b.cylAxis({ axis: 'z', x: ex, y: 0, z: -0.0032, len: 0.0006, r: 0.0088, mat: 'glass', seg: 20 });
    // Focusing sleeve: knurled ring, then the plain sleeve with its diopter scale.
    const z1 = -cupLen,
      z2 = zh0 + 0.001;
    knurledKnob(b, { at: [ex, 0, z1 - 0.005], axis: 'z', r: cupR + 0.0012, len: 0.01, teeth: 36, depth: 0.0006, mat: paint });
    b.cyl({ z0: z1 - 0.0099, z1: z2, r0: cupR - 0.0016, r1: cupR - 0.0024, x: ex, mat: paint, seg: 24 });
    if (b.detail(0))
      for (let i = -3; i <= 3; i++) {
        const a = PI / 2 + i * 0.22;
        b.box({ x: ex + Math.cos(a) * (cupR - 0.0015), y: Math.sin(a) * (cupR - 0.0015), z: z1 - 0.0118, w: 0.0005, h: 0.0005, d: i ? 0.0015 : 0.0026, mat: 'steelBright', r: 0 });
      }
    // Prism housing: painted, with the leatherette round its middle.
    const out = hull(ex, re, ox, ro, 0, M);
    plateXYz(b, { outline: out, z0: zh1, z1: zh0, mat: paint, bevel: 0.0016, curveSegments: 1 });
    plateXYz(b, { outline: hull(ex, re, ox, ro, 0.0009, M), holes: [hull(ex, re, ox, ro, -0.0002, M)], z0: zh1 + 0.004, z1: zh0 - 0.0035, mat: cover, bevel: 0.0004 });
    // The prism cover plates show as a raised band round the housing's back edge.
    if (b.detail(1)) plateXYz(b, { outline: hull(ex, re, ox, ro, 0.0006, M), holes: [hull(ex, re, ox, ro, -0.0003, M)], z0: zh0 - 0.0028, z1: zh0 - 0.0008, mat: paint, bevel: 0.0003 });
    // Objective: a collar from the housing, the covered tube, the cell at the front.
    lathe(b, { x: ox, mat: paint, seg: 28, profile: [[ro, zh1 + 0.0005], [ro - 0.0005, zh1 - 0.0025], [ro - 0.0014, zh1 - 0.005], [0, zh1 - 0.005]] });
    b.cyl({ z0: zh1 - 0.0045, z1: zf, r0: ro - 0.0012, x: ox, mat: cover, seg: 28 });
    tube(b, { x: ox, z0: zo, z1: zf + 0.0005, rIn: objR, rOut: ro - 0.0004, mat: paint, seg: 28 });
    b.cylAxis({ axis: 'z', x: ox, y: 0, z: zo + 0.0035, len: 0.0006, r: objR, mat: 'glass', seg: 24 });
    b.cylAxis({ axis: 'z', x: ox, y: 0, z: zo + 0.0055, len: 0.0006, r: objR, mat: 'black', seg: 16 }); // (the dark inside)
    // Hinge knuckles: the right half's front and back, the left half's between.
    const inner = ex - s * (re - 0.002);
    const kn = s > 0 ? [[zh0 - 0.001, zh0 - 0.012], [zh1 + 0.012, zh1 + 0.001]] : [[zh0 - 0.0125, zh1 + 0.0125]];
    for (const [za, zb] of kn) b.box({ x: inner / 2, y: 0, z: (za + zb) / 2, w: Math.abs(inner), h: 0.013, d: za - zb, mat: paint, r: 0.002 });
    // Strap lug on the outside of the housing.
    b.box({ x: s * (xo + ro + 0.0012), y: 0.008, z: zh0 - 0.008, w: 0.003, h: 0.007, d: 0.009, mat: paint, r: 0.001 });
  }
  // The hinge pin, with the scale for the eyes' spacing on its back end.
  b.cyl({ z0: zh0 + 0.0015, z1: zh1, r0: 0.0072, mat: paint, seg: 20 });
  b.cylAxis({ axis: 'z', x: 0, y: 0, z: zh0 + 0.0025, len: 0.002, r: 0.0082, mat: paint, seg: 20 });
  if (b.detail(0)) {
    b.cylAxis({ axis: 'z', x: 0, y: 0, z: zh0 + 0.0036, len: 0.0004, r: 0.0026, mat: 'steel', seg: 14 });
    for (let i = -2; i <= 2; i++) b.box({ x: i * 0.0024, y: 0.0062, z: zh0 + 0.0036, w: 0.0004, h: 0.0016, d: 0.0003, mat: 'steelBright', r: 0 });
  }

  b.anchor('scopeEye', 0, 0, -0.0032);
  b.anchor('scopeFront', 0, 0, zo + 0.0035);
  b.anchor('muzzle', 0, 0, zo);
  b.anchor('gripR', (e + xo) / 2 + 0.004, 0, (zh0 + zh1) / 2);
  b.anchor('gripL', -(e + xo) / 2 - 0.004, 0, (zh0 + zh1) / 2);
  b.anchor('trigger', 0, -0.03, (zh0 + zh1) / 2);
  // How the hands hold them (soldierArms.js): round each half, its axis along Z.
  const r = (ro + re) / 2 + 0.002;
  Object.assign(b.meta, { sight: 'scope', binoculars: true, gripRake: -PI / 2, gripRadius: r, foregrip: 'vertical', foregripRake: -PI / 2, foregripRadius: r });
}

// US Binocular M3: 6x30, black enamel and leatherette, a mil scale in the left
// telescope (TM 9-575).
export function binoc_us(b) {
  binocular(b, { e: 0.032, xo: 0.0525, re: 0.019, ro: 0.0215, zh0: -0.029, zh1: -0.075, zo: -0.115, objR: 0.0152, cupR: 0.0168, cupLen: 0.011, paint: 'sheet', cover: 'leatherBlack', cup: 'bakeliteBlack' });
}

// German Dienstglas 6x30: the late-war glasses in dark yellow paint with black
// leatherette and bakelite eyecups.
export function binoc_ge(b) {
  binocular(b, { e: 0.032, xo: 0.054, re: 0.0195, ro: 0.022, zh0: -0.027, zh1: -0.072, zo: -0.112, objR: 0.0152, cupR: 0.0172, cupLen: 0.0105, paint: 'germanYellow', cover: 'leatherBlack', cup: 'bakeliteBlack' });
}

// Soviet B-6 (6x30): black paint and covering, wider eyecups.
export function binoc_su(b) {
  binocular(b, { e: 0.032, xo: 0.053, re: 0.0198, ro: 0.0222, zh0: -0.031, zh1: -0.076, zo: -0.115, objR: 0.0152, cupR: 0.0182, cupLen: 0.012, paint: 'sheet', cover: 'leatherBlack', cup: 'black' });
}
