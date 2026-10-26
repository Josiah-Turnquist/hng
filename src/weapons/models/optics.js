// Telescopic sights and the M1C's mount, for the gun models. scopes.js has the
// scopes' data and the rifles that took them; the scoped rifles themselves are
// built in us.js, german.js and soviet.js from their rifle and these parts. Not a
// model registry: nothing here is listed in MODELS. Same conventions as kit.js
// (meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at z = 0).
//
// Every scope sets the anchors scopeEye (its eyepiece lens) and scopeFront (its
// objective lens): sighting.js looks along the line between them. Profiles are
// [radius, z] from the eye end forward; z0 is the eyepiece lens. Sizes est.
// from photos where scopes.js gives no length.
import { lathe, tube } from './parts.js';
import { knurledKnob, screw, plateXYz } from './shapes.js';
import { GunBuilder } from './kit.js';

// The scope body turned about its axis at (x, y), its two lenses and anchors.
function body(b, { x = 0, y, z0, profile, mat, eyeR, frontR }) {
  const pts = profile.map(([r, dz]) => [r, z0 - dz]);
  const zf = pts[pts.length - 1][1];
  lathe(b, { mat, x, y, seg: 30, profile: [[0, z0], ...pts, [0, zf]] });
  b.cylAxis({ axis: 'z', x, y, z: z0 + 0.0001, len: 0.0006, r: eyeR, mat: 'glass' });
  b.cylAxis({ axis: 'z', x, y, z: zf - 0.0001, len: 0.0006, r: frontR, mat: 'glass' });
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
  knobs(b, { x, y, z: zEye - 0.14, r: 0.011, knob: 0.0078, side: x < 0 ? -1 : 1, mat: 'steel' });
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

// --- M1C: the Griffin & Howe side mount on an M1 Garand ---------------------------
//
// The base is screwed and pinned to the left wall of the receiver; the mount's
// two arms reach up and out to the rings, so the scope sits left of the bore,
// clear of the clip going in from the top and of the iron sights. A leather
// cheek pad is laced to the left of the butt. Placed per Garand model (its
// receiver's left wall, and where the receiver is along the rifle):
//   dz   how far the receiver sits behind ours (the rear sight's z minus ours)
//   wall the left wall's outer face (x) and the top of the wall (y)
//   pad  the cheek pad: the stock's left face (x) and its middle (y)
export const M1C_FIT = {
  code: { dz: 0, wall: [-0.0156, 0.0062], pad: [-0.0182, -0.032] },
  download: { dz: 0.052, wall: [-0.013, 0.004], pad: [-0.0182, -0.034] },
};
// The scope's axis: left of the bore and above it (est. from photos).
const M1C_SCOPE = { x: -0.033, y: 0.046, zEye: -0.058 };

export function m1cMount(b, fit = M1C_FIT.code) {
  const P = 'parkerized';
  const { dz } = fit;
  const [wx, wt] = fit.wall;
  const { x: sx, y: sy } = M1C_SCOPE;
  const zEye = M1C_SCOPE.zEye + dz;
  const r = 0.011; // the Alaskan's tube
  // Base on the receiver's left wall, three screws and two taper pins.
  const z0 = -0.166 + dz,
    z1 = -0.082 + dz;
  plateXYz(b, { outline: [[wx - 0.0048, 0.0005], [wx + 0.0002, 0.0005], [wx + 0.0002, wt + 0.0022], [wx - 0.0016, wt + 0.0034], [wx - 0.0048, wt + 0.0022]], z0, z1, mat: P, bevel: 0.0006 });
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
  // Leather cheek pad on the left of the butt.
  const [px, py] = fit.pad;
  b.box({ x: px - 0.0035, y: py, z: 0.16, w: 0.007, h: 0.036, d: 0.15, mat: 'leather', r: 0.003 });
  if (b.detail(0)) for (let i = 0; i < 6; i++) b.box({ x: px - 0.0071, y: py - 0.012, z: 0.105 + i * 0.022, w: 0.0008, h: 0.0035, d: 0.006, mat: 'leatherBlack', r: 0 }); // lacing
  return alaskan(b, { x: sx, y: sy, zEye });
}

// The downloaded Garand (models/downloaded.js) as an M1C: the mount and scope
// built to fit its receiver and added to its body. mats: the gun materials.
export function fitScopeToDownloadedGarand(gun, mats, lod = 0) {
  const b = new GunBuilder(mats, { lod });
  m1cMount(b, M1C_FIT.download);
  const built = b.build('m1cMount');
  for (const m of [...built.parts.body.children]) gun.parts.body.add(m);
  for (const k of ['scopeEye', 'scopeFront']) gun.anchors[k] = built.anchors[k].clone();
  gun.meta.sight = 'scope';
  return gun;
}
