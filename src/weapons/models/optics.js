// Telescopic sights and their mounts, for the gun models. scopes.js has the
// scopes' data and the rifles that took them; the scoped rifles are built in
// us.js, german.js and soviet.js, and the scope upgrades in upgradeScopes.js,
// from their rifle and these parts. Not a model registry: nothing here is
// listed in MODELS. Same conventions as kit.js (meters, bore along Z at
// x = y = 0, muzzle toward -Z, trigger at z = 0).
//
// Every scope sets the anchors scopeEye (its eyepiece lens) and scopeFront (its
// objective lens): sighting.js looks along the line between them. Profiles are
// [radius, z] from the eye end forward; z0 is the eyepiece lens. Sizes est.
// from photos where scopes.js gives no length.
//
// A mount is placed for the rifle it fits (the receiver's walls and top as
// each model has them) and puts its scope in its rings; the mounts' sizes are
// est. from photos.
import { lathe, tube, place, path } from './parts.js';
import { knurledKnob, screw, plateXYz } from './shapes.js';
import { GunBuilder } from './kit.js';

// The scope body turned about its axis at (x, y), its two lenses (not seen
// from far away) and anchors.
function body(b, { x = 0, y, z0, profile, mat, eyeR, frontR }) {
  const pts = profile.map(([r, dz]) => [r, z0 - dz]);
  const zf = pts[pts.length - 1][1];
  lathe(b, { mat, x, y, seg: 30, profile: [[0, z0], ...pts, [0, zf]] });
  if (b.detail(1)) {
    b.cylAxis({ axis: 'z', x, y, z: z0 + 0.0001, len: 0.0006, r: eyeR, mat: 'glass' });
    b.cylAxis({ axis: 'z', x, y, z: zf - 0.0001, len: 0.0006, r: frontR, mat: 'glass' });
  }
  b.anchor('scopeEye', x, y, z0 + 0.0001);
  b.anchor('scopeFront', x, y, zf - 0.0001);
  return zf;
}

// Elevation drum on top and windage knob on one side (side = -1 left, 1 right)
// at z, for a tube of radius r.
function knobs(b, { x = 0, y, z, r, knob, side = 1, mat, marks = 0 }) {
  knurledKnob(b, { at: [x, y + r + 0.006, z], axis: 'y', r: knob, len: 0.009, teeth: 28, mat });
  b.cylAxis({ axis: 'y', x, y: y + r + 0.001, z, len: 0.005, r: knob * 0.8, mat, seg: 18 });
  knurledKnob(b, { at: [x + side * (r + 0.006), y, z], axis: 'x', r: knob * 0.85, len: 0.008, teeth: 24, mat });
  b.cylAxis({ axis: 'x', x: x + side * (r + 0.001), y, z, len: 0.005, r: knob * 0.7, mat, seg: 16 });
  if (b.detail(0)) {
    for (let i = 0; i < marks; i++) {
      const a = (i / marks) * Math.PI * 2;
      b.box({ x: x + Math.cos(a) * (knob - 0.0004), y: y + r + 0.0106, z: z + Math.sin(a) * (knob - 0.0004), w: 0.0007, h: 0.0012, d: 0.0007, mat: 'black', r: 0 });
    }
  }
}

// Zeiss range drum on top of a 26 mm tube at z: knurled, on a bright collar,
// with its range marks.
function zeissDrum(b, { x = 0, y, z, mat = 'steel' }) {
  knurledKnob(b, { at: [x, y + 0.0185, z], axis: 'y', r: 0.0118, len: 0.011, teeth: 32, mat });
  b.cylAxis({ axis: 'y', x, y: y + 0.0128, z, len: 0.004, r: 0.0128, mat: 'steelBright', seg: 24 });
  if (b.detail(0)) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box({ x: x + Math.cos(a) * 0.0124, y: y + 0.0158, z: z + Math.sin(a) * 0.0124, w: 0.0008, h: 0.0042, d: 0.0008, mat: 'black', r: 0 }); // range marks
    }
  }
}

// A ring round the scope tube (radius r) at z, w wide.
export function ring(b, { x = 0, y, z, r, w = 0.014, t = 0.0028, mat }) {
  tube(b, { x, y, z0: z - w / 2, z1: z + w / 2, rIn: r, rOut: r + t, mat, seg: 28 });
}

// Lyman Alaskan 2.5x as the M81 and M82: 22 mm tube, wide eyepiece with a
// rubber eyeshield, internal adjustments under two knobs, sliding sunshade over
// the objective. 267 mm (10.5 in) from lens to lens.
export function alaskan(b, { x = 0, y, zEye }) {
  const zf = body(b, {
    x,
    y,
    z0: zEye,
    mat: 'steel',
    eyeR: 0.0145,
    frontR: 0.0098,
    profile: [
      [0.0156, 0],
      [0.0165, 0.004],
      [0.0165, 0.048],
      [0.0118, 0.07],
      [0.011, 0.076],
      [0.011, 0.242],
      [0.0121, 0.25],
      [0.0121, 0.267],
    ],
  });
  tube(b, { x, y, z0: zEye, z1: zEye + 0.022, rIn: 0.0148, rOut: 0.0185, rOut1: 0.0195, mat: 'bakeliteBlack', seg: 28 }); // eyeshield
  tube(b, { x, y, z0: zf - 0.036, z1: zf + 0.018, rIn: 0.0122, rOut: 0.0134, mat: 'steel', seg: 28 }); // sunshade
  knobs(b, { x, y, z: zEye - 0.115, r: 0.011, knob: 0.0078, side: x < 0 ? -1 : 1, mat: 'steel' });
  return zf;
}

// M84 2.2x, the Alaskan's successor from 1945: the same 7/8 in tube and
// outline, a longer rubber eyeguard, and both adjustments under screw caps on
// a square turret. About 275 mm long.
export function m84(b, { x = 0, y, zEye }) {
  const zf = body(b, {
    x,
    y,
    z0: zEye,
    mat: 'steel',
    eyeR: 0.0142,
    frontR: 0.0105,
    profile: [
      [0.0158, 0],
      [0.0166, 0.004],
      [0.0166, 0.05],
      [0.0118, 0.07],
      [0.011, 0.078],
      [0.011, 0.248],
      [0.0124, 0.256],
      [0.0124, 0.274],
    ],
  });
  tube(b, { x, y, z0: zEye, z1: zEye + 0.03, rIn: 0.0148, rOut: 0.0182, rOut1: 0.0198, mat: 'bakeliteBlack', seg: 28 }); // eyeguard
  const zt = zEye - 0.115;
  const side = x < 0 ? -1 : 1;
  b.box({ x, y: y + 0.002, z: zt, w: 0.0255, h: 0.026, d: 0.024, mat: 'steel', r: 0.003 }); // turret
  b.cylAxis({ axis: 'y', x, y: y + 0.0175, z: zt, len: 0.007, r: 0.0085, mat: 'steel', seg: 20 }); // elevation cap
  b.cylAxis({ axis: 'x', x: x + side * 0.0158, y, z: zt, len: 0.007, r: 0.0085, mat: 'steel', seg: 20 }); // windage cap
  return zf;
}

// Weaver 330C 2.75x as the M73B1: 3/4 in tube, short eyepiece bell, plain
// objective end, elevation knob on top and windage on the right.
export function weaver330(b, { x = 0, y, zEye }) {
  const zf = body(b, {
    x,
    y,
    z0: zEye,
    mat: 'steel',
    eyeR: 0.0105,
    frontR: 0.0094,
    profile: [
      [0.0118, 0],
      [0.0126, 0.004],
      [0.0126, 0.038],
      [0.0098, 0.052],
      [0.0096, 0.262],
      [0.0108, 0.27],
      [0.0108, 0.284],
    ],
  });
  knurledKnob(b, { at: [x, y + 0.0125, zEye - 0.145], axis: 'y', r: 0.0072, len: 0.01, teeth: 20, mat: 'steel' }); // elevation
  knurledKnob(b, { at: [x + 0.0125, y, zEye - 0.145], axis: 'x', r: 0.0072, len: 0.01, teeth: 20, mat: 'steel' }); // windage
  return zf;
}

// Unertl 8x target scope (the Marine Corps': no return spring): 3/4 in tube,
// eyepiece, objective bell of about 1.5 in. Length est.
export function unertl(b, { y, zEye }) {
  return body(b, {
    y,
    z0: zEye,
    mat: 'steel',
    eyeR: 0.0118,
    frontR: 0.0195,
    profile: [
      [0.0128, 0],
      [0.0135, 0.004],
      [0.0135, 0.052],
      [0.0098, 0.064],
      [0.0095, 0.07],
      [0.0095, 0.46],
      [0.0102, 0.468],
      [0.021, 0.51],
      [0.0222, 0.518],
      [0.0222, 0.56],
    ],
  });
}

// ZF 39 (Zeiss Zielvier 4x): 26 mm tube, ocular and objective bells, the range
// drum on top. 266 mm long.
export function zf39(b, { x = 0, y, zEye }) {
  const zf = body(b, {
    x,
    y,
    z0: zEye,
    mat: 'steel',
    eyeR: 0.0165,
    frontR: 0.0185,
    profile: [
      [0.0172, 0],
      [0.0182, 0.005],
      [0.0182, 0.027],
      [0.0135, 0.051],
      [0.013, 0.226],
      [0.0175, 0.247],
      [0.0198, 0.253],
      [0.0198, 0.266],
    ],
  });
  zeissDrum(b, { x, y, z: zEye - 0.163 });
  return zf;
}

// Zeiss Zielacht 8x: a hunting scope, 300 mm long, with a long eyepiece, a
// 26 mm tube and a big objective bell (about 49 mm across), and the Zielvier's
// range drum.
export function zielacht(b, { x = 0, y, zEye }) {
  const zf = body(b, {
    x,
    y,
    z0: zEye,
    mat: 'steel',
    eyeR: 0.0162,
    frontR: 0.0228,
    profile: [
      [0.0175, 0],
      [0.0188, 0.005],
      [0.0188, 0.042],
      [0.0145, 0.068],
      [0.0136, 0.08],
      [0.0136, 0.1],
      [0.013, 0.108],
      [0.013, 0.25],
      [0.0215, 0.276],
      [0.0245, 0.286],
      [0.0245, 0.3],
    ],
  });
  zeissDrum(b, { x, y, z: zEye - 0.17 });
  return zf;
}

// ZF 41: a slim 1.5x scope, 130 mm long, with its range drum on top.
export function zf41(b, { x = 0, y, zEye }) {
  const zf = body(b, {
    x,
    y,
    z0: zEye,
    mat: 'steel',
    eyeR: 0.0105,
    frontR: 0.0092,
    profile: [
      [0.0118, 0],
      [0.0124, 0.003],
      [0.0124, 0.028],
      [0.0098, 0.036],
      [0.0098, 0.112],
      [0.0108, 0.118],
      [0.0108, 0.13],
    ],
  });
  knurledKnob(b, { at: [x, y + 0.0098 + 0.005, zEye - 0.072], axis: 'y', r: 0.0085, len: 0.008, teeth: 24, mat: 'steel' });
  b.cylAxis({ axis: 'y', x, y: y + 0.0098, z: zEye - 0.072, len: 0.004, r: 0.0068, mat: 'steel', seg: 16 });
  return zf;
}

// ZF 4 (and the FG 42's scope, est. the same outline): 4x, 26 mm tube,
// eyepiece and objective bells, range drum on top, windage on the right.
export function zf4(b, { y, zEye }) {
  const zf = body(b, {
    y,
    z0: zEye,
    mat: 'steel',
    eyeR: 0.0158,
    frontR: 0.0178,
    profile: [
      [0.0172, 0],
      [0.0182, 0.004],
      [0.0182, 0.04],
      [0.0135, 0.062],
      [0.013, 0.068],
      [0.013, 0.205],
      [0.0175, 0.226],
      [0.0196, 0.236],
      [0.0196, 0.265],
    ],
  });
  knobs(b, { y, z: zEye - 0.13, r: 0.013, knob: 0.0112, side: 1, mat: 'steel', marks: 8 });
  return zf;
}

// PU 3.5x: short and light, 169 mm long, drums on top and on the left.
export function pu(b, { x = 0, y, zEye, mat = 'steelDark' }) {
  const zf = body(b, {
    x,
    y,
    z0: zEye,
    mat,
    eyeR: 0.0135,
    frontR: 0.011,
    profile: [
      [0.0148, 0],
      [0.0155, 0.004],
      [0.0155, 0.03],
      [0.0115, 0.038],
      [0.0115, 0.154],
      [0.0125, 0.159],
      [0.0125, 0.169],
    ],
  });
  knobs(b, { x, y, z: zEye - 0.099, r: 0.0115, knob: 0.0085, side: -1, mat });
  return zf;
}

// PEM 4x: longer and heavier than the PU, with a big objective bell and drums
// on top and on the left.
export function pem(b, { y, zEye, mat = 'steelDark' }) {
  const zf = body(b, {
    y,
    z0: zEye,
    mat,
    eyeR: 0.0145,
    frontR: 0.019,
    profile: [
      [0.0158, 0],
      [0.0165, 0.004],
      [0.0165, 0.045],
      [0.012, 0.06],
      [0.0115, 0.066],
      [0.0115, 0.2],
      [0.0185, 0.232],
      [0.0208, 0.242],
      [0.0208, 0.28],
    ],
  });
  knobs(b, { y, z: zEye - 0.125, r: 0.0115, knob: 0.0115, side: -1, mat, marks: 14 });
  return zf;
}

// --- Mounts ---------------------------------------------------------------------
//
// Each puts its scope (one of the bodies above, called with { x, y, zEye }) in
// its rings and returns the objective's z.

// Kar 98k high turret mount (Turmmontage): turret base on the receiver ring,
// lever-locked rear base on the bridge (behind the clip guide), 26 mm rings
// with the scope's axis 52.5 mm over the bore. Both bases are open below (a
// tunnel 10 mm wide over the receiver) so the eye sees the rear notch and the
// front sight through them.
export function turretMount(b, { scope = zf39, zEye = 0.021, mat = 'steel' } = {}) {
  const yc = 0.0525;
  const T = 0.0052, // the tunnel's half width and its top
    TY = 0.0345;
  // Two cheeks each, a bridge over the tunnel.
  for (const s of [-1, 1]) {
    b.span({ z0: -0.2125, z1: -0.1955, y0: 0.0158, y1: TY + 0.001, w: 0.0128 - T, x: (s * (T + 0.0128)) / 2, mat, r: 0.0015 });
    b.span({ z0: -0.091, z1: -0.0715, y0: 0.0158, y1: TY + 0.001, w: 0.0116 - T, x: (s * (T + 0.0116)) / 2, mat, r: 0.0015 });
  }
  b.extrude({ points: path([[-0.2155, TY, 1], [-0.1925, TY, 1], [-0.196, yc - 0.0105, 1], [-0.212, yc - 0.0105, 1]]), width: 0.0158, mat, bevel: 0.0015 });
  b.extrude({ points: path([[-0.0895, TY, 1], [-0.0735, TY, 1], [-0.0745, yc - 0.0105, 1], [-0.0885, yc - 0.0105, 1]]), width: 0.0152, mat, bevel: 0.0015 });
  b.box({ x: 0.0145, y: 0.0262, z: -0.0805, w: 0.004, h: 0.005, d: 0.028, mat, r: 0.0012 }); // locking lever
  if (b.detail(0)) for (const z of [-0.087, -0.076]) screw(b, { at: [-0.0118, 0.021, z], axis: '-x', r: 0.0018, mat, slot: 0.3 });
  for (const z of [-0.204, -0.081]) tube(b, { y: yc, z0: z - 0.0085, z1: z + 0.0085, rIn: 0.0131, rOut: 0.0158, mat, seg: 28 });
  return scope(b, { y: yc, zEye });
}

// A clamp mount on a dovetail rail along one side of the receiver (side 1 the
// right, as on the Gewehr 43; -1 the left): the clamp on the rail with its
// locking lever, at each ring a saddle reaching up and over the receiver, a
// bar between the saddles. face: the rail's outer face (|x|); clamp: its z0,
// z1; rings: their z; yc, r: the scope's axis height and tube radius (t, w:
// the rings' wall and width). base: on a rifle with no rail, the receiver
// wall (|x|) a base plate is screwed to, its outer face carrying the rail.
export function railMount(b, { side = 1, face, base = 0, clamp, rings, yc, r, t = 0.0032, w = 0.016, scope, zEye, mat = 'steel' }) {
  const s = side;
  const [z0, z1] = clamp;
  if (base) b.span({ z0, z1, y0: -0.0055, y1: 0.0145, w: face - base, x: (s * (face + base)) / 2, mat, r: 0.0008 });
  b.span({ z0, z1, y0: -0.0065, y1: 0.0165, w: 0.0062, x: s * (face + 0.0031), mat, r: 0.0012 }); // clamp on the rail
  b.box({ x: s * (face + 0.0074), y: 0.004, z: (z0 + z1) / 2, w: 0.0035, h: 0.007, d: 0.034, mat, r: 0.0012 }); // locking lever
  const top = yc - r - 0.0013;
  const xo = face + 0.0062;
  const saddle = [
    [xo, 0.0105],
    [xo, top - 0.013],
    [xo - 0.0135, top],
    [-0.0105, top],
    [-0.0105, top - 0.007],
    [face, top - 0.018],
    [face, 0.0105],
  ].map(([x, y]) => [s * x, y]);
  for (const z of rings) {
    plateXYz(b, { outline: saddle, z0: z - 0.009, z1: z + 0.009, mat, bevel: 0.0008 });
    ring(b, { y: yc, z, r, w, t, mat });
  }
  b.span({ z0: Math.min(...rings) + 0.008, z1: Math.max(...rings) - 0.008, y0: top - 0.007, y1: top, w: 0.012, x: s * 0.004, mat, r: 0.0015 });
  return scope(b, { y: yc, zEye });
}

// ZF 41 mount: a dovetail rail on the left of the rear sight base, a clamp
// mount reaching up and over to the scope above the rear sight, well ahead of
// the action, so stripper clips still go in and the eye (about 30 cm back)
// still sees the rear notch under it. face: the sight base's left face (|x|);
// y: the rail's height over the Kar 98k's; rail: its z0, z1; rings: the two
// arms' z, either side of the range drum.
export function zf41Mount(b, { face = 0.0141, y = 0, rail = [-0.345, -0.272], rings = [-0.32, -0.279], yc = 0.0412, zEye = -0.2275, mat = 'steel' } = {}) {
  const r = 0.0098;
  const f = -face;
  const [z0, z1] = rail;
  b.span({ z0, z1, y0: y - 0.0045, y1: y + 0.0115, w: 0.0062, x: f - 0.0031, mat, r: 0.0008 }); // rail
  b.span({ z0: z0 + 0.002, z1: z1 - 0.002, y0: y - 0.0065, y1: y + 0.0135, w: 0.0052, x: f - 0.0087, mat, r: 0.0012 }); // clamp
  b.box({ x: f - 0.0121, y: y + 0.003, z: (z0 + z1) / 2, w: 0.0035, h: 0.006, d: 0.024, mat, r: 0.001 }); // clamp lever
  const arm = [[f - 0.0113, y + 0.0105], [f - 0.0005, y + 0.0105], [f - 0.0005, y + 0.0262], [-0.0062, yc - r - 0.0016], [-0.0062, yc - r + 0.001], [f - 0.0113, yc - r + 0.001]];
  for (const z of rings) {
    plateXYz(b, { outline: arm, z0: z - 0.0065, z1: z + 0.0065, mat, bevel: 0.0006 });
    ring(b, { y: yc, z, r, w: 0.013, t: 0.0026, mat });
  }
  return zf41(b, { y: yc, zEye });
}

// Two rings on see-through bases on a flat receiver top (at yBase): each ring
// stands on a post either side of a tunnel 2 * gap wide, so the eye still
// finds the iron sights under the scope. zs: the rings' z.
export function tunnelRings(b, { zs, yBase, yc, r, t = 0.0026, w = 0.013, gap = 0.0052, scope, zEye, mat = 'steel' }) {
  for (const z of zs) {
    b.span({ z0: z - 0.009, z1: z + 0.009, y0: yBase - 0.001, y1: yBase + 0.0025, w: 0.0168, mat, r: 0.001 }); // base
    for (const s of [-1, 1]) b.span({ z0: z - w / 2, z1: z + w / 2, y0: yBase + 0.002, y1: yc - r, w: 0.0058, x: s * (gap + 0.0029), mat, r: 0.0012 });
    ring(b, { y: yc, z, r, w, t, mat });
    if (b.detail(0)) for (const zz of [z - 0.0055, z + 0.0055]) screw(b, { at: [0, yBase + 0.0025, zz], axis: 'y', r: 0.0016, mat, slot: 0.3 });
  }
  return scope(b, { y: yc, zEye });
}

// Redfield Junior one-piece base over the M1903's receiver and two rings, the
// rear one with the windage screws either side, the scope high enough for the
// bent bolt handle to lift under its eyepiece. r: the scope's tube.
export function redfieldMount(b, { scope = weaver330, r = 0.0096, yc = 0.0415, zEye = 0.012, mat = 'steel' } = {}) {
  b.span({ z0: -0.198, z1: -0.066, y0: 0.0158, y1: 0.0235, w: 0.0172, mat, r: 0.002 });
  for (const [z, wide] of [
    [-0.183, 0],
    [-0.081, 1],
  ]) {
    tube(b, { y: yc, z0: z - 0.009, z1: z + 0.009, rIn: r, rOut: r + 0.0032, mat, seg: 24 });
    b.span({ z0: z - 0.009, z1: z + 0.009, y0: 0.022, y1: yc - r + 0.0016, w: 0.0132, mat, r: 0.002 });
    if (wide) for (const s of [-1, 1]) knurledKnob(b, { at: [s * 0.0128, 0.0245, z], axis: 'x', r: 0.0034, len: 0.008, teeth: 12, mat }); // windage screws
  }
  return scope(b, { y: yc, zEye });
}

// The Marine Corps' Unertl blocks on the M1903: dovetailed onto the receiver
// ring and the barrel 7.2 in (183 mm) apart, the rear mount carrying the
// micrometer knobs (elevation on top, windage on the right); the scope slides
// in both rings, pulled back by hand after each shot. Mounted high enough for
// the straight bolt handle. Heights est.
export function unertlMount(b, { mat = 'parkerized' } = {}) {
  const yc = 0.054;
  const r = 0.0095;
  const zR = -0.182,
    zF = zR - 0.183;
  for (const [z, y0] of [
    [zR, 0.0152],
    [zF, 0.0158],
  ]) {
    b.span({ z0: z - 0.0105, z1: z + 0.0105, y0, y1: 0.0232, w: 0.0142, mat, r: 0.0012 }); // block
    b.span({ z0: z - 0.0085, z1: z + 0.0085, y0: 0.0232, y1: 0.0268, w: 0.0172, mat, r: 0.0008 }); // dovetail foot
    b.span({ z0: z - 0.0055, z1: z + 0.0055, y0: 0.0262, y1: yc - r, w: 0.0092, mat, r: 0.0015 }); // upright
    ring(b, { y: yc, z, r, w: 0.012, t: 0.0035, mat });
  }
  // Micrometer knobs on the rear mount.
  knurledKnob(b, { at: [0, yc + r + 0.0095, zR], axis: 'y', r: 0.0078, len: 0.009, teeth: 32, mat });
  b.cylAxis({ axis: 'y', x: 0, y: yc + r + 0.003, z: zR, len: 0.006, r: 0.0042, mat, seg: 14 });
  knurledKnob(b, { at: [0.0175, yc - 0.004, zR], axis: 'x', r: 0.0072, len: 0.008, teeth: 30, mat });
  b.cylAxis({ axis: 'x', x: 0.011, y: yc - 0.004, z: zR, len: 0.006, r: 0.004, mat, seg: 14 });
  return unertl(b, { y: yc, zEye: -0.004 });
}

// The Mosin's PU side mount: a base on the left of the receiver, two posts up
// to the rings over the action.
export function puMount(b, { mat = 'steelDark' } = {}) {
  const yc = 0.051;
  b.span({ z0: -0.208, z1: -0.072, y0: -0.012, y1: 0.012, w: 0.0082, x: -0.0198, mat, r: 0.002 });
  if (b.detail(0)) for (const z of [-0.19, -0.09]) screw(b, { at: [-0.024, 0.0, z], axis: '-x', r: 0.0026, mat, slot: 0.4 });
  for (const z of [-0.18, -0.092]) {
    b.span({ z0: z - 0.008, z1: z + 0.008, y0: 0.006, y1: yc - 0.008, w: 0.0082, x: -0.0158, mat, r: 0.0015 });
    tube(b, { y: yc, z0: z - 0.008, z1: z + 0.008, rIn: 0.0115, rOut: 0.0142, mat, seg: 28 });
  }
  return pu(b, { y: yc, zEye: -0.036, mat });
}

// The Mosin's PEM side mount: a taller base on the left of the receiver, an
// arm at each ring reaching over the action. r, t: the scope's tube and the
// rings' wall.
export function pemMount(b, { scope = pem, r = 0.0115, t = 0.003, yc = 0.0525, zEye = -0.04, mat = 'steelDark' } = {}) {
  b.span({ z0: -0.208, z1: -0.072, y0: -0.012, y1: 0.016, w: 0.0088, x: -0.0202, mat, r: 0.002 });
  if (b.detail(0)) for (const z of [-0.19, -0.09]) screw(b, { at: [-0.0246, 0.0, z], axis: '-x', r: 0.0026, mat, slot: 0.4 });
  for (const z of [-0.2, -0.125]) {
    plateXYz(b, { outline: [[-0.0246, 0.012], [-0.0158, 0.012], [-0.0158, 0.024], [-0.0045, yc - r - 0.0013], [-0.0045, yc - r + 0.0007], [-0.0246, yc - r + 0.0007]], z0: z - 0.009, z1: z + 0.009, mat, bevel: 0.0008 });
    ring(b, { y: yc, z, r, w: 0.016, t, mat });
  }
  return scope(b, { y: yc, zEye });
}

// The SVT-40's scope bracket: it clamps the rear of the receiver by its sides
// (jaws at |x| = half), two plates rise either side of the bolt carrier to an
// arm that runs forward under the scope's two rings. The scope sits high and
// the space under it is open, so the eye still finds the iron sights beneath.
export function svtBracket(b, { half = 0.0172, scope = pu, r = 0.0115, yc = 0.0655, zEye = 0.004, mat = 'steelDark' } = {}) {
  for (const s of [-1, 1]) {
    b.span({ z0: -0.035, z1: 0.012, y0: -0.012, y1: 0.0082, w: 0.0042, x: s * half, mat, r: 0.001 }); // clamp jaws
    plateXYz(b, { outline: [[s * (half - 0.0021), 0.004], [s * (half + 0.0021), 0.004], [s * (half + 0.0021), 0.0452], [s * (half - 0.0021), 0.0452]], z0: -0.03, z1: 0.008, mat, bevel: 0.0006 });
  }
  b.span({ z0: -0.03, z1: 0.008, y0: 0.0452, y1: 0.0502, w: 2 * (half + 0.0021), mat, r: 0.0015 }); // bridge over the carrier
  b.span({ z0: -0.122, z1: 0.0, y0: 0.0462, y1: 0.0512, w: 0.0122, mat, r: 0.0015 }); // arm under the scope
  for (const z of [-0.11, -0.046]) {
    b.span({ z0: z - 0.006, z1: z + 0.006, y0: 0.05, y1: yc - r, w: 0.01, mat, r: 0.0012 });
    ring(b, { y: yc, z, r, w: 0.013, t: 0.0028, mat });
  }
  b.box({ x: -(half + 0.0043), y: 0.0, z: -0.012, w: 0.004, h: 0.007, d: 0.026, mat, r: 0.0012 }); // locking lever
  return scope(b, { y: yc, zEye });
}

// --- Griffin & Howe side mount (the M1C's) ----------------------------------------
//
// The base is screwed and pinned to the left wall of the receiver; the mount's
// two arms reach up and out to the rings, so the scope sits left of the bore,
// clear of the clip or the cases going out at the top and of the iron sights.
// On the Garand a leather cheek pad is laced to the left of the butt. Placed per
// rifle model (its receiver's left wall, and where the receiver is along it):
//   dz    how far the receiver sits behind ours (the rear sight's z minus ours)
//   wall  the left wall's outer face (x), the top of the wall (y) and the
//         base's foot (y)
//   base  the base along the wall, z0 to z1 (the arms 16 mm in from its ends)
//   axis  the scope's axis (x, y): left of the bore and above it (est. from
//         photos)
//   pad   the cheek pad, from z0 to z1 under the comb (its top there: top0,
//         top1), h high, against the stock's left face (x at its middle, which
//         leans in toward the comb by tilt). Measured on each model. None on
//         the carbines.
export const SIDE_FIT = {
  garand: {
    dz: 0,
    wall: [-0.0156, 0.0062, 0.0005],
    base: [-0.166, -0.082],
    axis: [-0.033, 0.046],
    pad: { z0: 0.075, z1: 0.255, top0: -0.0075, top1: -0.0305, h: 0.04, x: -0.0168, tilt: -0.2 },
  },
  download: {
    dz: 0.052,
    wall: [-0.013, 0.004, 0.0005],
    base: [-0.166, -0.082],
    axis: [-0.033, 0.046],
    pad: { z0: 0.11, z1: 0.27, top0: -0.039, top1: -0.0415, h: 0.03, x: -0.0158, tilt: -0.1 },
  },
  carbine: { dz: 0, wall: [-0.0127, 0.003, -0.0095], base: [-0.13, -0.035], axis: [-0.032, 0.032], pad: null },
};

// The scopes the mount takes on a Garand: the body, its tube's radius and its
// eyepiece's z (on our Garand: the downloaded one adds its dz), the rings on
// the tube clear of the eyepiece and the turret.
export const M1C_SCOPES = {
  alaskan: { body: alaskan, r: 0.011, zEye: -0.012 },
  m84: { body: m84, r: 0.011, zEye: -0.01 },
  m73b1: { body: weaver330, r: 0.0096, zEye: -0.025 },
};

export function sideMount(b, fit, { body: scope, r, zEye }) {
  const P = 'parkerized';
  const { dz } = fit;
  const [wx, wt, foot] = fit.wall;
  const [sx, sy] = fit.axis;
  // Base on the receiver's left wall, three screws and two taper pins.
  const z0 = fit.base[0] + dz,
    z1 = fit.base[1] + dz;
  plateXYz(b, { outline: [[wx - 0.0048, foot], [wx + 0.0002, foot], [wx + 0.0002, wt + 0.0022], [wx - 0.0016, wt + 0.0034], [wx - 0.0048, wt + 0.0022]], z0, z1, mat: P, bevel: 0.0006 });
  if (b.detail(0)) {
    for (const z of [z0 + 0.012, (z0 + z1) / 2, z1 - 0.012]) screw(b, { at: [wx - 0.0048, wt - 0.0018, z], axis: '-x', r: 0.0021, mat: P, slot: 0.3 });
    for (const z of [z0 + 0.026, z1 - 0.026]) b.cylAxis({ axis: 'x', x: wx - 0.0049, y: wt - 0.0048, z, len: 0.0006, r: 0.0012, mat: 'steelBright', seg: 10 });
  }
  // The mount: two arms from the base up and out to the rings, a bar between them.
  const arm = [[wx - 0.0048, wt - 0.0005], [wx - 0.0004, wt + 0.0028], [sx + 0.0068, sy - r - 0.0012], [sx - 0.0078, sy - r - 0.0012], [sx - 0.0078, sy - r - 0.009]];
  for (const zr of [z0 + 0.016, z1 - 0.016]) {
    plateXYz(b, { outline: arm, z0: zr - 0.008, z1: zr + 0.008, mat: P, bevel: 0.0008 });
    ring(b, { x: sx, y: sy, z: zr, r, w: 0.016, t: 0.003, mat: P });
    b.box({ x: sx, y: sy + r + 0.004, z: zr, w: 0.009, h: 0.004, d: 0.012, mat: P, r: 0.0012 }); // cap screw boss
  }
  b.span({ z0: z0 + 0.016, z1: z1 - 0.016, y0: sy - r - 0.009, y1: sy - r - 0.0045, w: 0.0072, x: sx - 0.0035, mat: P, r: 0.0012 });
  // Quick-release lever on the outside of the front arm.
  b.box({ x: sx - 0.011, y: sy - r - 0.006, z: z0 + 0.016, w: 0.0035, h: 0.006, d: 0.026, mat: P, r: 0.0012 });
  // Leather cheek pad on the left of the butt, its top along the comb, laced
  // along its lower edge.
  const pd = fit.pad;
  if (pd) {
    const ym = (pd.top0 + pd.top1) / 2 - pd.h / 2;
    const outline = GunBuilder.smooth(
      [
        [pd.z0, pd.top0 - ym],
        [(pd.z0 + pd.z1) / 2, (pd.top0 + pd.top1) / 2 - ym],
        [pd.z1, pd.top1 - ym],
        [pd.z1 + 0.006, pd.top1 - pd.h * 0.55 - ym],
        [pd.z1 - 0.012, pd.top1 - pd.h - ym],
        [pd.z0 + 0.012, pd.top0 - pd.h - ym],
        [pd.z0 - 0.006, pd.top0 - pd.h * 0.45 - ym],
      ],
      3,
    );
    place(b, { pos: [pd.x - 0.0026, ym, 0], rot: [0, 0, pd.tilt] }, () => {
      b.extrude({ points: outline, width: 0.0052, mat: 'leather', bevel: 0.0018 });
      if (b.detail(0)) {
        for (let i = 0; i < 7; i++) {
          const z = pd.z0 + 0.02 + ((pd.z1 - pd.z0 - 0.04) * i) / 6;
          const top = pd.top0 + ((pd.top1 - pd.top0) * (z - pd.z0)) / (pd.z1 - pd.z0);
          b.box({ x: -0.0027, y: top - pd.h + 0.006 - ym, z, w: 0.0008, h: 0.004, d: 0.005, mat: 'leatherBlack', r: 0 }); // lacing
        }
      }
    });
  }
  return scope(b, { x: sx, y: sy, zEye: zEye + dz });
}

// M1C: the mount on a Garand (ours or the downloaded one), with its cheek pad.
export function m1cMount(b, fit = SIDE_FIT.garand, scope = M1C_SCOPES.alaskan) {
  return sideMount(b, fit, scope);
}

// The downloaded Garand (models/downloaded.js) with the M1C's mount and a scope
// (M1C_SCOPES: the M81 or M82's Alaskan by default) built to fit its receiver
// and added to its body. mats: the gun materials.
export function fitScopeToDownloadedGarand(gun, mats, lod = 0, scope = M1C_SCOPES.alaskan) {
  const b = new GunBuilder(mats, { lod });
  m1cMount(b, SIDE_FIT.download, scope);
  const built = b.build('m1cMount');
  for (const m of [...built.parts.body.children]) gun.parts.body.add(m);
  for (const k of ['scopeEye', 'scopeFront']) gun.anchors[k] = built.anchors[k].clone();
  gun.meta.sight = 'scope';
  return gun;
}
