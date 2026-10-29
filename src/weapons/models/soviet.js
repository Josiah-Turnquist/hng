// Soviet small arms. See kit.js for the coordinate conventions:
// meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at z = 0.
import * as THREE from 'three';
import { S, place, slot, circle, boxMag, guard, trigger, lathe, tube, swivel, taperZ, path, loft, cartridge } from './parts.js';
import { stock, band, plateXYz, bar, screw, buttPlate, arch, stockSection, sectionLoft, crisp, stations, superellipse, knurledKnob, sweepGrip, serrations, perfTube, sling, stamp, ribbon, latheY, ringLoft, smoothstep } from './shapes.js';
import { puMount, pemMount, svtBracket } from './optics.js';

const PI = Math.PI;

// 7.62x54R rimmed cartridge.
const R762R = { caseLen: 0.0536, oal: 0.0772, rRim: 0.00715, rNeck: 0.0042, rBullet: 0.0039, shoulder: 0.82 };

// Mosin-Nagant 1891/30 family: 7.62x54R bolt action, 1232 mm long, 730 mm barrel.
// Round receiver (from 1936) with the stripper clip guide, protruding magazine
// box with its hinged floor plate, long thin trigger, straight bolt handle and the
// big round cocking knob; hooded front post; tangent rear sight in meters (1-20);
// two barrel bands held by flat springs; birch stock with steel-lined sling slots
// through the fore-end and the butt. v.bent = the sniper's long turned-down bolt
// handle, to clear a scope over the action (the scope and its side mount are put
// on by mosin_pu, mosin_pem and upgradeScopes.js). Dimensions est. from side
// views.
function mosin(b, v = {}) {
  const P = 'steelDark';
  const W = 'birch';
  const MZ = -0.902;
  const FS = 0.0236,
    FZ = -0.893;
  // --- Barrel: 730 mm, crowned muzzle.
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.00381, MZ + 0.012],
      [0.00381, MZ + 0.0004],
      [0.0046, MZ],
      [0.0082, MZ],
      [0.0088, MZ + 0.001],
      [0.009, -0.84],
      [0.0096, -0.75],
      [0.0106, -0.6],
      [0.0118, -0.45],
      [0.0122, -0.33],
      [0.0136, -0.318],
      [0.0145, -0.26],
      [0.0148, -0.215],
      [0, -0.215],
    ],
  });
  b.cyl({ z0: MZ + 0.0125, z1: MZ + 0.0115, r0: 0.0039, mat: 'black', seg: 12 });
  // --- Front sight: base ring (it also takes the socket bayonet), post, round hood.
  lathe(b, { mat: P, seg: 24, profile: [[0.0088, MZ + 0.001], [0.0108, MZ + 0.001], [0.0115, MZ + 0.003], [0.0115, MZ + 0.0205], [0.0108, MZ + 0.0225], [0.0088, MZ + 0.0225]] });
  b.span({ z0: -0.8995, z1: -0.8865, y0: 0.0098, y1: 0.0142, w: 0.0082, mat: P, r: 0.001 });
  plateXYz(b, { outline: [[-0.001, 0.0138], [0.001, 0.0138], [0.0009, 0.0215], [0.0004, FS], [-0.0004, FS], [-0.0009, 0.0215]], z0: FZ - 0.0022, z1: FZ + 0.0022, mat: P, bevel: 0.0002 });
  tube(b, { z0: -0.9005, z1: -0.8855, rIn: 0.0096, rOut: 0.0106, y: 0.0172, mat: P, seg: b.detail(1) ? 28 : 8 });
  b.anchor('frontSight', 0, FS, FZ);
  // --- Cleaning rod in the fore-end, its head ahead of the stock tip.
  b.cyl({ z0: -0.842, z1: -0.81, r0: 0.0032, y: -0.0172, mat: 'steelBright', seg: 12 });
  lathe(b, { mat: 'steelBright', y: -0.0172, seg: 14, profile: [[0, -0.851], [0.0032, -0.851], [0.0046, -0.848], [0.0046, -0.8435], [0.0035, -0.8415], [0.0032, -0.84]] });

  // --- Stock (birch): long fore-end, straight wrist, butt; handguard on top.
  const stk = stock(b, {
    mat: W,
    z0: -0.828,
    z1: 0.3195,
    top: [
      [-0.828, -0.0005],
      [-0.33, -0.0005],
      [-0.3, 0.0012],
      [-0.215, 0.0015],
      [-0.17, -0.003],
      [-0.06, -0.004],
      [0.0, -0.006],
      [0.03, -0.0085],
      [0.07, -0.0125],
      [0.18, -0.025],
      [0.3195, -0.0405],
    ],
    bottom: [
      [-0.828, -0.0268],
      [-0.62, -0.0305],
      [-0.42, -0.0335],
      [-0.25, -0.0368],
      [-0.2, -0.041],
      [-0.168, -0.047],
      [-0.075, -0.047],
      [-0.05, -0.0505],
      [0.045, -0.0525],
      [0.08, -0.064],
      [0.13, -0.088],
      [0.22, -0.124],
      [0.3195, -0.1615],
    ],
    width: [
      [-0.828, 0.0302],
      [-0.6, 0.0322],
      [-0.4, 0.0342],
      [-0.25, 0.0366],
      [-0.2, 0.0405],
      [-0.06, 0.0405],
      [0.0, 0.0372],
      [0.07, 0.0328],
      [0.15, 0.0366],
      [0.3195, 0.0428],
    ],
    n: [
      [-0.6, 2.4],
      [-0.26, 2.7],
      [-0.08, 3.0],
      [0.04, 2.3],
      [0.09, 2.15],
      [0.19, 2.8],
      [0.3, 3.3],
    ],
    wTop: [
      [-0.6, 0.94],
      [-0.08, 0.95],
      [0.05, 0.86],
      [0.13, 0.76],
      [0.3, 0.7],
    ],
    wBot: [
      [-0.6, 0.76],
      [-0.08, 0.86],
      [0.07, 0.82],
      [0.3, 0.8],
    ],
    belly: [
      [-0.6, 0.58],
      [0.0, 0.54],
      [0.3, 0.45],
    ],
    chDepth: [
      [-0.828, 0.0088],
      [-0.815, 0.0088],
      [-0.8, 0.0],
      [-0.33, 0.0],
      [-0.318, 0.0165],
      [-0.215, 0.0172],
      [-0.2, 0.0195],
      [-0.068, 0.0195],
      [-0.058, 0.0],
    ],
    chHalf: [
      [-0.828, 0.0089],
      [-0.8, 0.009],
      [-0.33, 0.0132],
      [-0.318, 0.0148],
      [-0.215, 0.0148],
      [-0.2, 0.0169],
      [-0.068, 0.0169],
      [-0.058, 0.013],
    ],
    roundStart: 0.003,
  });
  buttPlate(b, stk, { z0: 0.3165, z1: 0.3305, mat: P, screws: [-0.058, -0.146] });
  stock(b, {
    mat: W,
    z0: -0.628,
    z1: -0.322,
    top: [
      [-0.628, 0.0158],
      [-0.47, 0.0178],
      [-0.322, 0.0192],
    ],
    bottom: [
      [-0.628, -0.0004],
      [-0.322, -0.0004],
    ],
    width: [
      [-0.628, 0.0262],
      [-0.322, 0.0278],
    ],
    n: 2.3,
    wTop: 0.44,
    wBot: 1.0,
    belly: 0.12,
    rings: 28,
    roundEnd: 0.005,
    roundAnchor: 'bottom',
  });
  // Bands and their springs (right side, in front of each band).
  band(b, { z0: -0.823, z1: -0.809, y0: -0.0285, y1: 0.0108, w: 0.0312, n: 2.4, thick: 0.0016, mat: P });
  band(b, { z0: -0.634, z1: -0.619, y0: -0.0325, y1: 0.0178, w: 0.0334, n: 2.5, thick: 0.0018, mat: P });
  if (b.detail(0)) {
    for (const [z, y] of [
      [-0.798, -0.012],
      [-0.607, -0.013],
    ])
      b.box({ x: 0.016, y, z, w: 0.0012, h: 0.0042, d: 0.018, mat: P, r: 0.0004 });
  }
  // Sling slots with steel escutcheons through the fore-end and the butt.
  for (const [zS, yS] of [
    [-0.56, -0.0215],
    [0.19, -0.0885],
  ]) {
    const hs = stk.halfWidth(zS, yS);
    b.extrude({ points: slot(zS - 0.017, zS + 0.017, yS, 0.0045), width: 2 * hs + 0.0006, mat: 'black', bevel: 0.0002 });
    for (const s of [-1, 1]) b.extrude({ points: slot(zS - 0.0195, zS + 0.0195, yS, 0.0068), holes: [slot(zS - 0.017, zS + 0.017, yS, 0.0045)], width: 0.0012, x: s * (hs + 0.0003), mat: P, bevel: 0.0003 });
  }

  // --- Rear sight: base sleeve with curved ramps, leaf hinged at the front with
  // the slider (spring catches) and the notch at its rear end.
  lathe(b, { mat: P, seg: 28, profile: [[0.0122, -0.3205], [0.0145, -0.3205], [0.015, -0.318], [0.015, -0.27], [0.0145, -0.2675], [0.0136, -0.2675]] });
  b.span({ z0: -0.319, z1: -0.27, y0: 0.0085, y1: 0.016, w: 0.0172, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.3185, 0.0118], [-0.272, 0.0118], [-0.268, 0.0158], [-0.282, 0.0192], [-0.305, 0.0172], [-0.3185, 0.016]], 3), width: 0.0016, x: s * 0.0094, mat: P, bevel: 0.0003 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.0172, z: -0.3135, len: 0.0182, r: 0.0016, mat: P, seg: 10 });
  b.part('rearSight', [0, 0.0172, -0.3135]);
  b.span({ z0: -0.317, z1: -0.2265, y0: 0.0158, y1: 0.0183, w: 0.0138, mat: P, r: 0.0006 });
  plateXYz(b, { outline: [[-0.0068, 0.0176], [0.0068, 0.0176], [0.0068, 0.0258], [0.0016, 0.0258], [0.0, 0.0236], [-0.0016, 0.0258], [-0.0068, 0.0258]], z0: -0.2275, z1: -0.2235, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.306, z1: -0.293, y0: 0.0151, y1: 0.0204, w: 0.0178, mat: P, r: 0.0009 });
  for (const s of [-1, 1]) b.box({ x: s * 0.0096, y: 0.0178, z: -0.2995, w: 0.0026, h: 0.0045, d: 0.0085, mat: P, r: 0.0006 });
  if (b.detail(0)) {
    for (let i = 2; i <= 20; i++) {
      const z = -0.293 + (i - 2) * 0.0034;
      b.box({ x: i % 2 ? 0.0028 : 0, y: 0.01842, z, w: i % 2 ? 0.0052 : 0.0098, h: 0.0002, d: 0.00045, mat: 'black', r: 0 });
    }
  }
  b.anchor('rearSight', 0, 0.0236, -0.2255);
  b.body();
  b.meta.sightKind = 'leaf';

  // --- Receiver: round ring, walls round the loading port, bridge with the clip
  // guide, tang; interrupter screw on the left; magazine box with its floor plate.
  lathe(b, { mat: P, seg: 32, profile: [[0.0148, -0.2155], [0.016, -0.2155], [0.0168, -0.214], [0.0168, -0.1705], [0.016, -0.169], [0.01, -0.169]] });
  if (b.detail(1)) {
    const RW = 0.0158,
      RR = 0.0093,
      MW = 0.0068,
      YB = -0.02;
    const wall = (s, yTop) => {
      const rr = 0.0015;
      const pts = [[s * RW, YB, 1]];
      for (let k = 0; k <= 4; k++) {
        const a = (k / 4) * (PI / 2);
        pts.push([s * (RW - rr + Math.cos(a) * rr), yTop - rr + Math.sin(a) * rr, k === 4]);
      }
      const t0 = Math.atan2(yTop, Math.sqrt(Math.max(0, RR * RR - yTop * yTop))),
        t1 = -Math.acos(MW / RR);
      for (let k = 0; k <= 6; k++) {
        const a = t0 + ((t1 - t0) * k) / 6;
        pts.push([s * RR * Math.cos(a), RR * Math.sin(a), k === 0 || k === 6]);
      }
      pts.push([s * MW, YB, 1]);
      return crisp(pts);
    };
    sectionLoft(b, { zs: [-0.1705, -0.0905], section: () => wall(-1, 0.0062), mat: P, capStart: false, capEnd: false });
    sectionLoft(b, { zs: [-0.1705, -0.0905], section: () => wall(1, 0.0032), mat: P, capStart: false, capEnd: false });
  } else {
    b.span({ z0: -0.1705, z1: -0.0905, y0: -0.02, y1: 0.005, w: 0.0316, mat: P });
  }
  if (b.detail(0)) {
    b.span({ z0: -0.17, z1: -0.091, y0: -0.0215, y1: -0.0195, w: 0.0136, mat: 'black', r: 0 });
    cartridge(b, { ...R762R, x: -0.0035, y: -0.0145, zBase: -0.092, seg: 12 });
  }
  lathe(b, { mat: P, seg: 32, profile: [[0.0095, -0.0915], [0.0148, -0.0915], [0.0156, -0.0903], [0.0156, -0.0638], [0.0148, -0.0625], [0.0095, -0.0625]] });
  for (const s of [-1, 1]) {
    plateXYz(b, { outline: [[s * 0.0052, 0.0118], [s * 0.0096, 0.0118], [s * 0.0093, 0.0218], [s * 0.0061, 0.0222], [s * 0.0057, 0.0208], [s * 0.0052, 0.0208]], z0: -0.0915, z1: -0.0812, mat: P, bevel: 0.0004 });
    if (b.detail(0)) b.box({ x: s * 0.0056, y: 0.0182, z: -0.0863, w: 0.0012, h: 0.0015, d: 0.0104, mat: 'black', r: 0 });
  }
  b.anchor('clipGuide', 0, 0.024, -0.086);
  b.anchor('ejectionPort', 0.012, 0.012, -0.13);
  screw(b, { at: [-0.0158, 0.0, -0.135], axis: '-x', r: 0.0031, mat: P, slot: 1.4 }); // interrupter-ejector screw
  // Tang with its screw.
  if (b.detail(1)) {
    const zt0 = -0.0625,
      zt1 = 0.036;
    sectionLoft(b, {
      zs: stations(zt0, zt1, b.detail(0) ? 0.004 : 0.02, [zt1 - 0.002, zt1 - 0.0045]),
      mat: P,
      section: (z) => {
        const end = (z - (zt1 - 0.007)) / 0.007;
        const w = 0.0132 * (end > 0 ? Math.sqrt(Math.max(0.02, 1 - end * end)) : 1);
        return superellipse(0, stk.top(z) + 0.0006 - 0.0016, w, 0.0032, 4, b.detail(0) ? 16 : 8);
      },
    });
    screw(b, { at: [0, stk.top(0.022) + 0.0006, 0.022], axis: 'y', r: 0.0036, mat: P, slot: 0 });
  }
  // Magazine box and the hinged floor plate with its rear latch; guard and trigger.
  b.extrude({ points: path([[-0.169, -0.045, 1], [-0.0705, -0.045, 1], [-0.0705, -0.068, 1], [-0.163, -0.068, 1]]), width: 0.0312, mat: P, bevel: 0.0018 });
  b.extrude({ points: path([[-0.1665, -0.0665, 1], [-0.07, -0.0665, 1], [-0.0725, -0.0712, 1], [-0.161, -0.0712, 1]]), width: 0.0282, mat: P, bevel: 0.0012 });
  b.box({ x: 0, y: -0.0592, z: -0.0675, w: 0.0102, h: 0.009, d: 0.0075, mat: P, r: 0.0012 }); // floor plate latch
  guard(b, { zf: -0.071, zr: 0.052, yTop: -0.0495, yBot: -0.0805, t: 0.0046, w: 0.0118, mat: P, rake: 0.008 });
  trigger(b, { z: 0, yTop: -0.0505, len: 0.027, curve: 0.0085, thick: 0.0048, w: 0.0045, mat: P });
  if (b.detail(0)) {
    screw(b, { at: [0, -0.0712, -0.115], axis: '-y', r: 0.0034, h: 0.001, mat: P, slot: 0 });
    screw(b, { at: [0, -0.0545, 0.064], axis: '-y', r: 0.0032, h: 0.001, mat: P, slot: 0 });
  }

  // --- Bolt: body in the white, handle (straight, or turned down for the PU), the
  // big round cocking knob at the rear.
  b.part('bolt', [0, 0, 0.01]);
  b.cyl({ z0: -0.1735, z1: -0.042, r0: 0.0092, mat: 'steelBright', seg: 28 });
  b.cyl({ z0: -0.0605, z1: -0.044, r0: 0.0102, mat: 'steelBright', seg: 28 }); // handle root collar
  b.cyl({ z0: -0.044, z1: -0.0055, r0: 0.0098, r1: 0.0094, mat: P, seg: 28 });
  lathe(b, {
    mat: P,
    seg: 32,
    profile: [
      [0.0, -0.0055],
      [0.0085, -0.0055],
      [0.0118, -0.0042],
      [0.0128, -0.0015],
      [0.0128, 0.0068],
      [0.0118, 0.0098],
      [0.0068, 0.0112],
      [0, 0.0112],
    ],
  }); // cocking knob
  if (b.detail(0)) for (let i = 0; i < 18; i++) {
    const a = (i / 18) * PI * 2;
    b.box({ x: Math.cos(a) * 0.0127, y: Math.sin(a) * 0.0127, z: 0.0025, w: 0.0008, h: 0.0008, d: 0.0075, mat: P, r: 0, rz: a });
  }
  if (v.bent) {
    bar(b, { pts: [[0.008, -0.0005, -0.052], [0.026, -0.004, -0.0505], [0.038, -0.016, -0.0475], [0.046, -0.034, -0.0445]], r: [[0, 0.0048], [1, 0.0039]], mat: 'steelBright', seg: 14 });
    b.sphere({ x: 0.0482, y: -0.0405, z: -0.0435, r: 0.0088, mat: 'steelBright', seg: 20 });
    b.anchor('boltHandle', 0.0482, -0.0405, -0.0435);
  } else {
    bar(b, { pts: [[0.008, -0.0005, -0.052], [0.03, -0.0025, -0.051], [0.05, -0.0045, -0.0485]], r: [[0, 0.0048], [1, 0.0039]], mat: 'steelBright', seg: 14 });
    b.sphere({ x: 0.0575, y: -0.005, z: -0.047, r: 0.0088, mat: 'steelBright', seg: 20 });
    b.anchor('boltHandle', 0.0575, -0.005, -0.047);
  }
  b.body();

  b.meta.sight = 'notch';

  // Canvas sling on the left, through the slots on leather dog collars.
  sling(b, { from: [-0.0228, -0.0215, -0.56], to: [-0.0245, -0.0885, 0.19], sag: 0.06, width: 0.035, mat: 'canvas', hardware: 'leather' });

  stamp(b, { name: 'mosinRing', at: [0, 0.0168, -0.193], r: 0.0168, w: 0.0095, h: 0.0152 });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.05, 0.075);
  b.anchor('trigger', 0, -0.064, 0.002);
  b.anchor('gripL', 0, -0.03, -0.42);
  b.anchor('shoulder', 0, -0.1, 0.33);
  b.meta.boltThrow = 0.1;
  b.meta.boltLift = PI / 2;
}

// Mosin-Nagant 1891/30 rifle. v: as mosin() takes (upgradeScopes.js bends the
// handle for a scope).
export function mosin_9130(b, v = {}) {
  mosin(b, v);
}

// Mosin-Nagant 1891/30 sniper with the PU 3.5x scope on its side mount.
export function mosin_pu(b) {
  mosin(b, { bent: true });
  puMount(b);
  b.meta.sight = 'scope';
  b.meta.scopeMag = 3.5;
}

// Mosin-Nagant 1891/30 sniper with the PEM 4x scope (made until 1940) on its
// taller side mount.
export function mosin_pem(b) {
  mosin(b, { bent: true });
  pemMount(b);
  b.meta.sight = 'scope';
  b.meta.scopeMag = 4;
}

// Self-loading rifle parts shared by the SVT-40 and AVS-36: a slotted muzzle
// brake (n slots a side) as a lathe with the ports cut in as dark recesses.
function slottedBrake(b, { z0, z1, r, slots, mat, slotH = 0.0125 }) {
  lathe(b, { mat, seg: 28, profile: [[0.0058, z0], [r - 0.0012, z0], [r, z0 + 0.0012], [r, z1 - 0.002], [r - 0.0018, z1], [0.0058, z1]] });
  if (b.detail(1)) {
    const pitch = (z1 - z0 - 0.008) / slots;
    for (let i = 0; i < slots; i++) for (const s of [-1, 1]) b.box({ x: s * (r - 0.0006), y: 0, z: z0 + 0.004 + pitch * (i + 0.5), w: 0.0022, h: slotH, d: pitch * 0.45, mat: 'black', r: 0.0006 });
  }
  if (b.detail(1)) b.cyl({ z0: z0 - 0.0002, z1: z0 + 0.01, r0: 0.0052, mat: 'black', seg: 14 });
}

// SVT-40: 7.62x54R gas-operated self-loading rifle, 1226 mm long, 625 mm barrel.
// Six-slot muzzle brake, hooded front post on the gas block, short-stroke piston
// above the barrel under a vented steel cover, wooden upper handguard, one band
// with the swivel, cleaning rod along the right of the stock, tangent rear sight
// 100-1500 m, cocking handle on the right, 10-round magazine. Birch stock with a
// semi-pistol grip. Blued. Dimensions est. from photos.
export function svt40(b) {
  const P = 'steelDark';
  const W = 'birch';
  const MZ = -0.896;
  const FS = 0.032,
    FZ = -0.812;
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0, -0.826],
      [0.0094, -0.826],
      [0.0102, -0.62],
      [0.0114, -0.45],
      [0.0128, -0.31],
      [0.0135, -0.245],
      [0, -0.245],
    ],
  });
  slottedBrake(b, { z0: MZ, z1: -0.826, r: 0.0118, slots: 6, mat: P });
  // Gas block with the front post and hood; gas cylinder.
  b.extrude({ points: path([[-0.826, -0.0118, 1], [-0.826, 0.024, 1], [-0.798, 0.024, 1], [-0.798, -0.0118, 1]]), width: 0.0212, mat: P, bevel: 0.0022 });
  plateXYz(b, { outline: [[-0.001, 0.0228], [0.001, 0.0228], [0.0009, 0.0292], [0.0003, FS], [-0.0003, FS], [-0.0009, 0.0292]], z0: FZ - 0.0022, z1: FZ + 0.0022, mat: P, bevel: 0.0002 });
  plateXYz(b, { outline: arch(0, 0.0275, 0.0082, 0.0091, -0.42, PI + 0.42, 0.021, b.detail(1) ? 20 : 8), z0: -0.82, z1: -0.804, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, FS, FZ);
  lathe(b, { mat: P, y: 0.017, seg: 18, profile: [[0, -0.8], [0.0068, -0.8], [0.0075, -0.798], [0.0075, -0.62], [0, -0.62]] });
  // Vented steel cover over the gas cylinder, band with the swivel.
  b.extrude({ points: path([[-0.645, -0.004, 1], [-0.645, 0.0262], [-0.62, 0.0278], [-0.47, 0.0278], [-0.468, -0.004, 1]]), width: 0.0302, mat: P, bevel: 0.004 });
  if (b.detail(1)) for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.cylAxis({ axis: 'x', x: s * 0.0148, y: 0.013, z: -0.625 + i * 0.04, len: 0.0012, r: 0.0055, mat: 'black', seg: 14 });
  band(b, { z0: -0.664, z1: -0.646, y0: -0.0312, y1: 0.0285, w: 0.0322, n: 2.7, thick: 0.0018, mat: P });
  b.box({ x: -0.0178, y: -0.008, z: -0.655, w: 0.004, h: 0.01, d: 0.012, mat: P, r: 0.001 });
  bar(b, { pts: [[-0.0192, -0.003, -0.664], [-0.0208, -0.012, -0.667], [-0.0214, -0.019, -0.655], [-0.0208, -0.012, -0.643], [-0.0192, -0.003, -0.646]], closed: true, r: 0.0019, mat: P, seg: 8 });
  // Upper handguard (wood) behind the cover.
  stock(b, {
    mat: W,
    z0: -0.47,
    z1: -0.312,
    top: [
      [-0.47, 0.0258],
      [-0.4, 0.0268],
      [-0.312, 0.0232],
    ],
    bottom: [
      [-0.47, -0.002],
      [-0.312, -0.002],
    ],
    width: [
      [-0.47, 0.0292],
      [-0.312, 0.0292],
    ],
    n: 2.4,
    wTop: 0.6,
    wBot: 1.0,
    belly: 0.2,
    rings: 28,
    roundEnd: 0.004,
    roundAnchor: 'bottom',
  });
  // --- Stock with the semi-pistol grip; cleaning rod in a groove on the right.
  const stk = stock(b, {
    mat: W,
    z0: -0.664,
    z1: 0.3225,
    top: [
      [-0.664, -0.004],
      [-0.312, -0.004],
      [-0.25, -0.006],
      [-0.06, -0.008],
      [-0.012, -0.006],
      [0.008, 0.0],
      [0.06, -0.004],
      [0.2, -0.024],
      [0.3225, -0.0418],
    ],
    bottom: [
      [-0.664, -0.03],
      [-0.45, -0.034],
      [-0.28, -0.04],
      [-0.25, -0.0555],
      [-0.08, -0.058],
      [0.05, -0.058],
      [0.058, -0.076],
      [0.07, -0.094],
      [0.088, -0.1],
      [0.108, -0.096],
      [0.13, -0.098],
      [0.21, -0.132],
      [0.3225, -0.1635],
    ],
    width: [
      [-0.664, 0.0312],
      [-0.45, 0.0335],
      [-0.25, 0.0378],
      [-0.06, 0.0405],
      [0.02, 0.0365],
      [0.08, 0.0335],
      [0.16, 0.0372],
      [0.3225, 0.0422],
    ],
    n: [
      [-0.5, 2.5],
      [-0.25, 3.0],
      [0.0, 2.8],
      [0.09, 2.2],
      [0.2, 2.9],
      [0.31, 3.3],
    ],
    wTop: [
      [-0.5, 0.9],
      [-0.06, 0.95],
      [0.04, 0.84],
      [0.13, 0.75],
      [0.31, 0.7],
    ],
    wBot: [
      [-0.5, 0.8],
      [0.07, 0.84],
      [0.31, 0.8],
    ],
    belly: 0.52,
    chDepth: [
      [-0.312, 0.0],
      [-0.3, 0.017],
      [0.012, 0.017],
      [0.022, 0.0],
    ],
    chHalf: [
      [-0.312, 0.0135],
      [-0.25, 0.0152],
      [0.012, 0.0152],
      [0.022, 0.012],
    ],
    roundStart: 0.003,
  });
  buttPlate(b, stk, { z0: 0.3195, z1: 0.3305, mat: P, screws: [-0.054, -0.152] });
  b.cyl({ z0: -0.672, z1: -0.33, r0: 0.0028, x: 0.0158, y: -0.0185, mat: 'steelBright', seg: 8 });
  b.cylAxis({ axis: 'z', x: 0.0158, y: -0.0185, z: -0.675, len: 0.006, r: 0.0042, mat: 'steelBright', seg: 10 });
  {
    const zs = 0.21,
      ys = -0.09;
    const hw = stk.halfWidth(zs, ys);
    b.box({ x: -hw - 0.001, y: ys, z: zs, w: 0.003, h: 0.01, d: 0.022, mat: P, r: 0.001 });
    bar(b, { pts: [[-hw - 0.002, ys + 0.003, zs - 0.011], [-hw - 0.004, ys - 0.004, zs - 0.015], [-hw - 0.005, ys - 0.011, zs], [-hw - 0.004, ys - 0.004, zs + 0.015], [-hw - 0.002, ys + 0.003, zs + 0.011]], closed: true, r: 0.0019, mat: P, seg: 8 });
  }
  // --- Tangent rear sight on the barrel.
  b.span({ z0: -0.312, z1: -0.244, y0: 0.01, y1: 0.0235, w: 0.0242, mat: P, r: 0.0022 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.31, 0.0205], [-0.262, 0.0205], [-0.247, 0.0245], [-0.262, 0.0268], [-0.31, 0.0248]], 3), width: 0.0016, x: s * 0.0098, mat: P, bevel: 0.0003 });
  b.part('rearSight', [0, 0.0245, -0.308]);
  b.span({ z0: -0.309, z1: -0.246, y0: 0.023, y1: 0.026, w: 0.0172, mat: P, r: 0.0007 });
  plateXYz(b, { outline: [[-0.0062, 0.0245], [0.0062, 0.0245], [0.0062, 0.0342], [0.0015, 0.0342], [0, 0.0318], [-0.0015, 0.0342], [-0.0062, 0.0342]], z0: -0.25, z1: -0.246, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.302, z1: -0.291, y0: 0.0222, y1: 0.0275, w: 0.0198, mat: P, r: 0.0008 });
  if (b.detail(0)) for (let i = 1; i <= 15; i++) b.box({ x: i % 2 ? 0.0026 : 0, y: 0.02612, z: -0.291 + i * 0.0027, w: i % 2 ? 0.005 : 0.0098, h: 0.0002, d: 0.00045, mat: 'black', r: 0 });
  b.anchor('rearSight', 0, 0.0318, -0.248);
  b.body();
  b.meta.sightKind = 'leaf';
  // --- Receiver, ejection port, trigger guard, magazine catch.
  if (b.detail(1)) {
    const recv = () => {
      const K = b.detail(0) ? 5 : 2;
      const hw = 0.015,
        yb = -0.032,
        yt = 0.0102,
        rt = 0.006;
      const pts = [[0, yb], [hw - 0.002, yb], [hw, yb + 0.002]];
      for (let k = 0; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([hw - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]);
      }
      const left = pts.slice(1).map(([x, y]) => [-x, y]).reverse();
      return [...pts, ...left];
    };
    sectionLoft(b, { zs: [-0.245, 0.02], section: recv, mat: P });
  } else b.span({ z0: -0.245, z1: 0.02, y0: -0.032, y1: 0.0102, w: 0.03, mat: P });
  if (b.detail(0)) b.box({ x: 0.0145, y: 0.0062, z: -0.17, w: 0.0016, h: 0.0075, d: 0.08, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.016, 0.008, -0.17);
  guard(b, { zf: -0.055, zr: 0.05, yTop: -0.056, yBot: -0.086, t: 0.0045, w: 0.0112, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.058, len: 0.02, curve: 0.006, mat: P });
  b.span({ z0: -0.146, z1: -0.136, y0: -0.074, y1: -0.056, w: 0.0082, mat: P, r: 0.0012 });
  // --- Bolt carrier with the charging handle on the right.
  b.part('bolt', [0, 0, -0.08]);
  b.span({ z0: -0.235, z1: -0.08, y0: 0.0035, y1: 0.0185, w: 0.0202, mat: 'steelBright', r: 0.003 });
  b.cylAxis({ axis: 'x', x: 0.0198, y: 0.01, z: -0.165, len: 0.0122, r: 0.0038, mat: P, seg: 12 });
  b.sphere({ x: 0.027, y: 0.01, z: -0.165, r: 0.0058, mat: P, seg: 14 });
  b.anchor('chargingHandle', 0.032, 0.01, -0.165);
  b.body();
  // --- 10-round magazine.
  const top = [-0.198, -0.024];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.1, depth: 0.09, width: 0.0262, angle: 0.03, k: 0.4, mat: P, plate: 0.0062 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  sling(b, { from: [-0.0232, -0.019, -0.655], to: [-0.0245, -0.101, 0.21], sag: 0.06, width: 0.035, mat: 'canvas', hardware: 'leather' });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.075, 0.078);
  b.anchor('trigger', 0, -0.068, 0.0);
  b.anchor('gripL', 0, -0.035, -0.42);
  b.anchor('shoulder', 0, -0.1, 0.331);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.085;
}

// SVT-40 sniper with the PU 3.5x on its bracket over the receiver, high and
// open underneath, so the eye still finds the iron sights beneath (optics.js).
export function svt40_pu(b) {
  svt40(b);
  svtBracket(b);
  b.meta.sight = 'scope';
  b.meta.scopeMag = 3.5;
}

// AVS-36 (Simonov): 7.62x54R select-fire rifle, 1236 mm long, 615 mm barrel. Big
// two-port muzzle brake, hooded front post, bayonet lug, gas tube above the barrel
// under a perforated cover ahead of the wooden handguard, big charging handle on
// the right, fire selector, 15-round magazine, straight-wrist birch stock. Blued.
// Dimensions est. from photos.
export function avs36(b) {
  const P = 'steelDark';
  const W = 'birch';
  const MZ = -0.92;
  const FS = 0.0292,
    FZ = -0.839;
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0, -0.85],
      [0.0098, -0.85],
      [0.0104, -0.66],
      [0.0116, -0.48],
      [0.013, -0.33],
      [0.0138, -0.265],
      [0, -0.265],
    ],
  });
  slottedBrake(b, { z0: MZ, z1: -0.85, r: 0.0158, slots: 2, mat: P, slotH: 0.018 });
  // Front post on its base ring with the hood, bayonet lug.
  lathe(b, { mat: P, seg: 24, profile: [[0.0098, -0.85], [0.0112, -0.85], [0.0117, -0.848], [0.0117, -0.83], [0.0112, -0.828], [0.0098, -0.828]] });
  b.span({ z0: -0.848, z1: -0.83, y0: 0.006, y1: 0.0195, w: 0.0122, mat: P, r: 0.002 });
  plateXYz(b, { outline: [[-0.001, 0.019], [0.001, 0.019], [0.0009, 0.0262], [0.0003, FS], [-0.0003, FS], [-0.0009, 0.0262]], z0: FZ - 0.0022, z1: FZ + 0.0022, mat: P, bevel: 0.0002 });
  plateXYz(b, { outline: arch(0, 0.0245, 0.0082, 0.0091, -0.42, PI + 0.42, 0.0172, b.detail(1) ? 20 : 8), z0: -0.847, z1: -0.831, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, FS, FZ);
  b.span({ z0: -0.845, z1: -0.82, y0: -0.0245, y1: -0.0122, w: 0.0082, mat: P, r: 0.0015 }); // bayonet lug
  // Gas tube, perforated cover, band, handguard, cleaning rod.
  b.cyl({ z0: -0.69, z1: -0.33, r0: 0.0072, y: 0.016, mat: P, seg: 14 });
  perfTube(b, { z0: -0.69, z1: -0.53, r: 0.0155, y: 0.008, mat: 'perforatedDark', seg: 24 });
  tube(b, { z0: -0.692, z1: -0.684, rIn: 0.0125, rOut: 0.0162, y: 0.008, mat: P, seg: 24 });
  band(b, { z0: -0.712, z1: -0.692, y0: -0.032, y1: 0.0262, w: 0.0322, n: 2.7, thick: 0.0018, mat: P });
  b.box({ x: -0.0178, y: -0.008, z: -0.702, w: 0.004, h: 0.01, d: 0.012, mat: P, r: 0.001 });
  bar(b, { pts: [[-0.0192, -0.003, -0.711], [-0.0208, -0.012, -0.714], [-0.0214, -0.019, -0.702], [-0.0208, -0.012, -0.69], [-0.0192, -0.003, -0.693]], closed: true, r: 0.0019, mat: P, seg: 8 });
  stock(b, {
    mat: W,
    z0: -0.532,
    z1: -0.332,
    top: [
      [-0.532, 0.023],
      [-0.44, 0.0242],
      [-0.332, 0.0208],
    ],
    bottom: [
      [-0.532, -0.002],
      [-0.332, -0.002],
    ],
    width: [
      [-0.532, 0.0292],
      [-0.332, 0.0298],
    ],
    n: 2.4,
    wTop: 0.6,
    wBot: 1.0,
    belly: 0.2,
    rings: 28,
    roundStart: 0.004,
    roundEnd: 0.004,
    roundAnchor: 'bottom',
  });
  b.cyl({ z0: -0.86, z1: -0.7, r0: 0.0028, y: -0.017, mat: 'steelBright', seg: 8 });
  // --- Straight-wrist stock.
  const stk = stock(b, {
    mat: W,
    z0: -0.712,
    z1: 0.3085,
    top: [
      [-0.712, -0.004],
      [-0.332, -0.004],
      [-0.27, -0.007],
      [-0.06, -0.009],
      [-0.01, -0.0065],
      [0.02, -0.002],
      [0.14, -0.018],
      [0.3085, -0.0398],
    ],
    bottom: [
      [-0.712, -0.03],
      [-0.5, -0.034],
      [-0.3, -0.04],
      [-0.265, -0.055],
      [-0.08, -0.058],
      [0.05, -0.06],
      [0.07, -0.072],
      [0.11, -0.088],
      [0.2, -0.124],
      [0.3085, -0.1595],
    ],
    width: [
      [-0.712, 0.0312],
      [-0.5, 0.0335],
      [-0.28, 0.0378],
      [-0.06, 0.0405],
      [0.02, 0.0365],
      [0.08, 0.0322],
      [0.16, 0.0362],
      [0.3085, 0.042],
    ],
    n: [
      [-0.5, 2.5],
      [-0.26, 3.0],
      [0.0, 2.8],
      [0.08, 2.2],
      [0.2, 2.9],
      [0.3, 3.3],
    ],
    wTop: [
      [-0.5, 0.9],
      [-0.06, 0.95],
      [0.05, 0.86],
      [0.13, 0.76],
      [0.3, 0.7],
    ],
    wBot: [
      [-0.5, 0.8],
      [0.07, 0.84],
      [0.3, 0.8],
    ],
    belly: 0.54,
    chDepth: [
      [-0.332, 0.0],
      [-0.32, 0.0175],
      [0.014, 0.0175],
      [0.024, 0.0],
    ],
    chHalf: [
      [-0.332, 0.0138],
      [-0.27, 0.0158],
      [0.014, 0.0158],
      [0.024, 0.012],
    ],
    roundStart: 0.003,
  });
  buttPlate(b, stk, { z0: 0.3055, z1: 0.3165, mat: P, screws: [-0.052, -0.148] });
  {
    const zs = 0.2,
      ys = -0.088;
    const hw = stk.halfWidth(zs, ys);
    b.box({ x: -hw - 0.001, y: ys, z: zs, w: 0.003, h: 0.01, d: 0.022, mat: P, r: 0.001 });
    bar(b, { pts: [[-hw - 0.002, ys + 0.003, zs - 0.011], [-hw - 0.004, ys - 0.004, zs - 0.015], [-hw - 0.005, ys - 0.011, zs], [-hw - 0.004, ys - 0.004, zs + 0.015], [-hw - 0.002, ys + 0.003, zs + 0.011]], closed: true, r: 0.0019, mat: P, seg: 8 });
  }
  // --- Tangent rear sight.
  b.span({ z0: -0.333, z1: -0.264, y0: 0.01, y1: 0.0215, w: 0.0242, mat: P, r: 0.0022 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.331, 0.0185], [-0.282, 0.0185], [-0.267, 0.0225], [-0.282, 0.0248], [-0.331, 0.0228]], 3), width: 0.0016, x: s * 0.0098, mat: P, bevel: 0.0003 });
  b.part('rearSight', [0, 0.0225, -0.329]);
  b.span({ z0: -0.33, z1: -0.266, y0: 0.021, y1: 0.024, w: 0.0172, mat: P, r: 0.0007 });
  plateXYz(b, { outline: [[-0.0062, 0.0225], [0.0062, 0.0225], [0.0062, 0.0315], [0.0015, 0.0315], [0, 0.0292], [-0.0015, 0.0315], [-0.0062, 0.0315]], z0: -0.27, z1: -0.266, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.323, z1: -0.312, y0: 0.0202, y1: 0.0255, w: 0.0198, mat: P, r: 0.0008 });
  b.anchor('rearSight', 0, 0.0292, -0.268);
  b.body();
  b.meta.sightKind = 'leaf';
  // --- Receiver, selector, trigger guard.
  if (b.detail(1)) {
    const recv = () => {
      const K = b.detail(0) ? 5 : 2;
      const hw = 0.016,
        yb = -0.034,
        yt = 0.011,
        rt = 0.006;
      const pts = [[0, yb], [hw - 0.002, yb], [hw, yb + 0.002]];
      for (let k = 0; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([hw - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]);
      }
      const left = pts.slice(1).map(([x, y]) => [-x, y]).reverse();
      return [...pts, ...left];
    };
    sectionLoft(b, { zs: [-0.265, 0.02], section: recv, mat: P });
  } else b.span({ z0: -0.265, z1: 0.02, y0: -0.034, y1: 0.011, w: 0.032, mat: P });
  if (b.detail(0)) b.box({ x: 0.0155, y: 0.0082, z: -0.175, w: 0.0016, h: 0.0085, d: 0.08, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.017, 0.008, -0.175);
  knurledKnob(b, { at: [-0.0172, -0.02, -0.035], axis: 'x', r: 0.0055, len: 0.004, teeth: 4, depth: 0.0018, mat: P }); // selector
  guard(b, { zf: -0.055, zr: 0.05, yTop: -0.056, yBot: -0.086, t: 0.0045, w: 0.0112, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.058, len: 0.02, curve: 0.006, mat: P });
  // --- Bolt carrier with the big charging handle on the right.
  b.part('bolt', [0, 0, -0.09]);
  b.span({ z0: -0.25, z1: -0.09, y0: 0.004, y1: 0.0185, w: 0.0202, mat: 'steelBright', r: 0.003 });
  b.span({ z0: -0.19, z1: -0.15, y0: -0.004, y1: 0.012, w: 0.008, x: 0.02, mat: P, r: 0.002 });
  b.cylAxis({ axis: 'x', x: 0.03, y: 0.004, z: -0.17, len: 0.014, r: 0.0065, mat: P, seg: 16 });
  b.anchor('chargingHandle', 0.037, 0.004, -0.17);
  b.body();
  // --- 15-round magazine.
  const top = [-0.215, -0.024];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.142, depth: 0.09, width: 0.0272, angle: 0.03, k: 0.6, mat: P, plate: 0.0062 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  sling(b, { from: [-0.0232, -0.019, -0.702], to: [-0.0245, -0.099, 0.2], sag: 0.06, width: 0.035, mat: 'canvas', hardware: 'leather' });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.06, 0.08);
  b.anchor('trigger', 0, -0.068, 0.0);
  b.anchor('gripL', 0, -0.035, -0.44);
  b.anchor('shoulder', 0, -0.1, 0.317);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.09;
}

// 71-round drum for the PPD-40 and PPSh-41: a stamped can seen side-on, its axis
// across the gun, the cover with its stiffening ring and the winding key toward
// the right, the feed tower up into the magazine well. (z, y) = drum center.
function drum71(b, { z, y, r = 0.0975, t = 0.058, tower = 0.05, mat = 'steel' }) {
  const seg = 48;
  place(b, { pos: [0, y, z], rot: [0, PI / 2, 0] }, () => {
    // Body (shell) and its rolled rims; cover on the right (+x after turning).
    lathe(b, {
      mat,
      seg,
      profile: [
        [0, -t / 2 - 0.002],
        [r - 0.012, -t / 2 - 0.002],
        [r - 0.004, -t / 2],
        [r, -t / 2 + 0.004],
        [r + 0.0018, -t / 2 + 0.009],
        [r, -t / 2 + 0.013],
        [r, t / 2 - 0.011],
        [r + 0.0022, t / 2 - 0.007],
        [r + 0.0022, t / 2 - 0.002],
        [r - 0.004, t / 2 + 0.0015],
        [0.075, t / 2 + 0.0035],
        [0.07, t / 2 + 0.0075],
        [0.06, t / 2 + 0.0085],
        [0.03, t / 2 + 0.0055],
        [0, t / 2 + 0.0055],
      ],
    });
    // Winding key and its hub in the middle of the cover.
    lathe(b, { mat, seg: 24, profile: [[0, t / 2 + 0.005], [0.016, t / 2 + 0.005], [0.016, t / 2 + 0.0095], [0.012, t / 2 + 0.012], [0, t / 2 + 0.012]] });
    b.box({ x: 0, y: 0.018, z: t / 2 + 0.0125, w: 0.009, h: 0.042, d: 0.004, mat, r: 0.0015 });
    b.box({ x: 0, y: 0.04, z: t / 2 + 0.016, w: 0.012, h: 0.008, d: 0.01, mat, r: 0.0015 });
    // Cover latch.
    b.box({ x: 0, y: -(r - 0.006), z: t / 2 + 0.002, w: 0.016, h: 0.01, d: 0.006, mat, r: 0.0015 });
  });
  // Feed tower up into the magazine well.
  b.span({ z0: z - 0.004, z1: z + 0.034, y0: y + r - 0.014, y1: y + r + tower, w: 0.024, mat, r: 0.003 });
}

// PPSh-41: 7.62x25 open-bolt SMG, 843 mm long, 269 mm barrel. Perforated stamped
// jacket ending in the slanted compensator, hooded front post, flip rear sight
// (100 / 200 m) on the receiver cover, hinged stamped receiver with the latch at
// its rear, cocking handle (with its safety slide) on the right, fire selector in
// front of the trigger, birch stock, 71-round drum. Dimensions est. from photos.
export function ppsh41(b) {
  const P = 'steelDark';
  const W = 'birch';
  const JR = 0.0198; // jacket radius
  const FS = 0.0322,
    FZ = -0.459;
  // --- Barrel inside the perforated jacket.
  lathe(b, { mat: 'steel', seg: 18, profile: [[0.0040, -0.468], [0.0078, -0.468], [0.0085, -0.4], [0.0098, -0.21], [0, -0.21]] });
  b.cyl({ z0: -0.462, z1: -0.214, r0: JR, mat: 'perforatedDark', open: true, seg: 32 });
  tube(b, { z0: -0.214, z1: -0.2025, rIn: 0.0098, rOut: JR + 0.0012, mat: P, seg: 32 });
  // Slanted compensator: the jacket's front cut at an angle, with the end plate
  // (bullet hole) facing up and forward and two side vents.
  const CZ0 = -0.462,
    CZ1 = -0.497; // top / bottom edge of the slanted front
  sectionLoft(b, {
    zs: stations(CZ1, CZ0, b.detail(0) ? 0.003 : 0.012),
    mat: P,
    capStart: false,
    capEnd: false,
    section: (z) => {
      // Shell of the jacket below the slanted cut, open where the cut passes.
      const u = (z - CZ1) / (CZ0 - CZ1); // 0 at the bottom tip .. 1 at the top
      const M = b.detail(1) ? 24 : 8;
      const a0 = -PI / 2 - PI * Math.min(1, u * 1.02),
        a1 = -PI / 2 + PI * Math.min(1, u * 1.02);
      const pts = [];
      for (let j = 0; j <= M; j++) {
        const a = a0 + ((a1 - a0) * j) / M;
        pts.push([Math.cos(a) * (JR + 0.0006), Math.sin(a) * (JR + 0.0006)]);
      }
      for (let j = M; j >= 0; j--) {
        const a = a0 + ((a1 - a0) * j) / M;
        pts.push([Math.cos(a) * (JR - 0.0006), Math.sin(a) * (JR - 0.0006)]);
      }
      return pts;
    },
  });
  place(b, { pos: [0, 0, (CZ0 + CZ1) / 2], rot: [-0.95, 0, 0] }, () => {
    plateXYz(b, { outline: superellipse(0, 0, 0.04, 0.0598, 2, b.detail(1) ? 36 : 10), holes: [circle(0, -0.002, 0.0062, b.detail(1) ? 16 : 6)], z0: -0.0008, z1: 0.0008, mat: P, bevel: 0.0003 });
  });
  for (const s of [-1, 1]) b.box({ x: s * (JR - 0.0001), y: -0.006, z: -0.479, w: 0.0018, h: 0.009, d: 0.012, mat: 'black', r: 0.002 });
  b.anchor('muzzle', 0, 0, -0.481);
  // Front post with its hood on top of the jacket front.
  b.span({ z0: -0.468, z1: -0.451, y0: 0.0165, y1: 0.0232, w: 0.0122, mat: P, r: 0.0015 });
  plateXYz(b, { outline: [[-0.0012, 0.0228], [0.0012, 0.0228], [0.0010, 0.0298], [0.0003, FS], [-0.0003, FS], [-0.0010, 0.0298]], z0: FZ - 0.0025, z1: FZ + 0.0025, mat: P, bevel: 0.0002 });
  plateXYz(b, { outline: arch(0, 0.0292, 0.0074, 0.0083, -0.35, PI + 0.35, 0.0215, b.detail(1) ? 20 : 8), z0: -0.467, z1: -0.452, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, FS, FZ);

  // --- Receiver: stamped upper (hinged at the front, latch at the rear) over the
  // lower; ejection port and cocking slot on the right.
  const recvUp = (z) => {
    const K = b.detail(0) ? 6 : 2;
    const pts = [[0.0182, -0.006]];
    for (let k = 0; k <= K; k++) {
      const a = (k / K) * (PI / 2);
      pts.push([0.0182 - 0.0095 + Math.cos(a) * 0.0095, 0.0225 - 0.0095 + Math.sin(a) * 0.0095]);
    }
    const right = pts;
    const left = right.map(([x, y]) => [-x, y]).reverse();
    return [...right, ...left];
  };
  sectionLoft(b, { zs: [-0.2035, 0.052], section: recvUp, mat: P });
  b.extrude({ points: path([[-0.2035, -0.006, 1], [0.052, -0.006, 1], [0.052, -0.0205, 1], [-0.17, -0.0205, 1], [-0.2035, -0.016, 1]]), width: 0.0352, mat: P, bevel: 0.0012 });
  lathe(b, { mat: P, seg: 24, profile: [[0.0, 0.051], [0.0175, 0.051], [0.0175, 0.0565], [0.012, 0.061], [0, 0.061]] }); // rear cap
  b.box({ x: 0, y: 0.022, z: 0.044, w: 0.012, h: 0.006, d: 0.016, mat: P, r: 0.0015 }); // receiver latch
  b.cylAxis({ axis: 'x', x: 0, y: -0.012, z: -0.196, len: 0.038, r: 0.0042, mat: P, seg: 14 }); // hinge
  if (b.detail(0)) {
    b.box({ x: 0.0179, y: 0.0042, z: -0.111, w: 0.0016, h: 0.0152, d: 0.06, mat: 'black', r: 0.0005 }); // ejection port
    b.box({ x: 0.0179, y: -0.0005, z: -0.04, w: 0.0016, h: 0.0048, d: 0.16, mat: 'black', r: 0.0004 }); // cocking slot
    for (const s of [-1, 1]) for (const z of [-0.16, 0.0]) b.cylAxis({ axis: 'x', x: s * 0.0181, y: -0.013, z, len: 0.0012, r: 0.0022, mat: P, seg: 10 }); // rivets
  }
  b.anchor('ejectionPort', 0.019, 0.004, -0.111);
  // Flip rear sight (L) between protecting ears.
  b.span({ z0: -0.2, z1: -0.168, y0: 0.0205, y1: 0.0262, w: 0.0222, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.198, 0.024], [-0.171, 0.024], [-0.1735, 0.035], [-0.194, 0.0348]], 2), width: 0.0019, x: s * 0.0094, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0262, -0.198]);
  b.span({ z0: -0.198, z1: -0.1805, y0: 0.0252, y1: 0.0276, w: 0.0122, mat: P, r: 0.0006 });
  plateXYz(b, { outline: [[-0.0055, 0.026], [0.0055, 0.026], [0.0055, 0.0338], [0.0013, 0.0338], [0, 0.0315], [-0.0013, 0.0338], [-0.0055, 0.0338]], z0: -0.1835, z1: -0.1805, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, 0.0315, -0.182);
  b.body();
  b.meta.sightKind = 'leaf';

  // --- Trigger guard (stamped, with the fire selector inside), trigger.
  b.span({ z0: -0.075, z1: 0.045, y0: -0.0315, y1: -0.0195, w: 0.0128, mat: P, r: 0.0015 });
  guard(b, { zf: -0.042, zr: 0.042, yTop: -0.03, yBot: -0.0635, t: 0.0042, w: 0.0122, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.032, len: 0.019, curve: 0.0055, mat: P });
  b.box({ x: 0, y: -0.0345, z: -0.026, w: 0.0045, h: 0.0062, d: 0.0095, mat: P, r: 0.001 }); // selector
  // --- Birch stock: short fore-end round the magazine well, wrist and butt.
  const stk = stock(b, {
    mat: W,
    z0: -0.228,
    z1: 0.3435,
    top: [
      [-0.228, -0.0125],
      [-0.205, -0.0125],
      [0.05, -0.0125],
      [0.064, 0.0045],
      [0.1, 0.0025],
      [0.22, -0.0165],
      [0.3435, -0.0325],
    ],
    bottom: [
      [-0.228, -0.0435],
      [-0.08, -0.0442],
      [0.02, -0.0442],
      [0.045, -0.052],
      [0.075, -0.0705],
      [0.13, -0.0935],
      [0.24, -0.1255],
      [0.3435, -0.1575],
    ],
    width: [
      [-0.228, 0.0402],
      [0.03, 0.0402],
      [0.08, 0.034],
      [0.16, 0.0372],
      [0.3435, 0.0408],
    ],
    n: [
      [-0.2, 3.4],
      [0.04, 3.0],
      [0.09, 2.3],
      [0.18, 2.9],
      [0.33, 3.3],
    ],
    wTop: [
      [-0.2, 0.96],
      [0.04, 0.95],
      [0.1, 0.82],
      [0.3, 0.72],
    ],
    wBot: [
      [-0.2, 0.88],
      [0.1, 0.84],
      [0.3, 0.8],
    ],
    belly: 0.5,
    chDepth: [
      [-0.228, 0.0],
      [0.05, 0.0],
    ],
    roundStart: 0.004,
  });
  // Magazine well opening in the fore-end.
  b.extrude({ points: path([[-0.141, -0.044, 1], [-0.0845, -0.044, 1], [-0.0845, -0.0465, 1], [-0.141, -0.0465, 1]]), width: 0.0412, mat: P, bevel: 0.0008 });
  buttPlate(b, stk, { z0: 0.3405, z1: 0.351, mat: P, screws: [-0.045, -0.142] });
  for (const [zs, ys] of [
    [-0.2, -0.03],
    [0.24, -0.09],
  ]) {
    const hw = stk.halfWidth(zs, ys);
    b.box({ x: -hw - 0.001, y: ys, z: zs, w: 0.003, h: 0.01, d: 0.022, mat: P, r: 0.001 });
    bar(b, { pts: [[-hw - 0.002, ys + 0.003, zs - 0.011], [-hw - 0.004, ys - 0.004, zs - 0.015], [-hw - 0.005, ys - 0.011, zs], [-hw - 0.004, ys - 0.004, zs + 0.015], [-hw - 0.002, ys + 0.003, zs + 0.011]], closed: true, r: 0.0019, mat: P, seg: 8 });
  }
  // --- Cocking handle on the right (bolt forward), with its safety slide.
  b.part('bolt', [0, 0, -0.12]);
  b.span({ z0: -0.13, z1: -0.11, y0: -0.0035, y1: 0.0035, w: 0.0042, x: 0.0185, mat: P, r: 0.0008 });
  b.cylAxis({ axis: 'x', x: 0.0242, y: 0.0, z: -0.12, len: 0.0105, r: 0.0058, mat: P, seg: 16 });
  b.box({ x: 0.0255, y: 0.0062, z: -0.12, w: 0.0045, h: 0.0035, d: 0.009, mat: P, r: 0.0008 }); // safety slide
  b.anchor('chargingHandle', 0.03, 0.0, -0.12);
  b.body();
  // --- 71-round drum.
  b.part('mag', [0, -0.046, -0.113]);
  drum71(b, { z: -0.128, y: -0.156, tower: 0.012, mat: P });
  b.body();
  b.anchor('magWell', 0, -0.046, -0.113);
  b.meta.magAxis = [0, -1, 0];

  sling(b, { from: [-0.0245, -0.041, -0.2], to: [-0.0255, -0.101, 0.24], sag: 0.07, width: 0.03, mat: 'canvas', hardware: 'leather' });

  b.anchor('gripR', 0, -0.062, 0.072);
  b.anchor('trigger', 0, -0.043, 0.0);
  b.anchor('gripL', 0, -0.06, -0.135); // on the drum / fore-end
  b.anchor('shoulder', 0, -0.095, 0.351);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.11;
  b.meta.openBolt = true;
}

// PPS-43: 7.62x25 stamped SMG, 820 mm with the stock out (615 mm folded), 250 mm
// barrel. One stamped shroud over the barrel with big oval vent slots and the
// baffle compensator at the muzzle, post front sight between ears, flip rear sight
// (100 / 200 m), stamped receiver and magazine housing with its release paddle,
// grip with wooden panels, safety in front of the guard, cocking handle on the
// right, steel stock folding up over the receiver, 35-round curved magazine.
// Blued. Dimensions est. from photos.
export function pps43(b) {
  const P = 'steelDark';
  const FS = 0.0305,
    FZ = -0.463;
  b.cyl({ z0: -0.48, z1: -0.2, r0: 0.0085, mat: 'steel', seg: 16 });
  // --- Shroud: stamped box with rounded corners, oval vent slots on the sides and
  // the top, front baffle (compensator) with its side ears.
  const shroud = (z) => {
    const K = b.detail(0) ? 4 : 1;
    const hw = 0.0152,
      yb = -0.0165,
      yt = 0.0178,
      r = 0.005;
    const pts = [[0, yb]];
    for (const [cx, cy, a0] of [
      [hw - r, yb + r, -PI / 2],
      [hw - r, yt - r, 0],
    ])
      for (let k = 0; k <= K; k++) {
        const a = a0 + (k / K) * (PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    const left = pts.slice(1).map(([x, y]) => [-x, y]).reverse();
    return [...pts, ...left];
  };
  sectionLoft(b, { zs: [-0.48, -0.198], section: shroud, mat: P });
  if (b.detail(1))
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) b.extrude({ points: slot(-0.455 + i * 0.062, -0.413 + i * 0.062, 0.001, 0.0062), width: 0.0006, x: s * 0.0153, mat: 'black', bevel: 0 });
      place(b, { pos: [0, 0.0179, 0], rot: [0, 0, PI / 2] }, () => b.extrude({ points: slot(-0.45 + i * 0.062, -0.418 + i * 0.062, 0, 0.0052), width: 0.0006, mat: 'black', bevel: 0 }));
    }
  plateXYz(b, { outline: shroud(0).map(([x, y]) => [x * 1.04, y * 1.04]), holes: [circle(0, 0, 0.0062, b.detail(1) ? 14 : 6)], z0: -0.486, z1: -0.48, mat: P, bevel: 0.0005 });
  for (const s of [-1, 1]) b.span({ z0: -0.502, z1: -0.48, y0: -0.0175, y1: 0.012, w: 0.003, x: s * 0.0138, mat: P, r: 0.0008 });
  plateXYz(b, { outline: shroud(0).map(([x, y]) => [x * 1.02, y * 0.86]), holes: [circle(0, 0, 0.0062, b.detail(1) ? 14 : 6)], z0: -0.504, z1: -0.498, mat: P, bevel: 0.0005 });
  // Front post with protecting ears.
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.47, 0.016], [-0.456, 0.016], [-0.458, 0.0335], [-0.468, 0.0335]], 2), width: 0.002, x: s * 0.0062, mat: P, bevel: 0.0004 });
  b.span({ z0: -0.47, z1: -0.456, y0: 0.0165, y1: 0.0212, w: 0.0142, mat: P, r: 0.0012 });
  plateXYz(b, { outline: [[-0.0009, 0.0205], [0.0009, 0.0205], [0.0009, FS], [-0.0009, FS]], z0: FZ - 0.002, z1: FZ + 0.002, mat: P, bevel: 0.0002 });
  b.anchor('frontSight', 0, FS, FZ);
  b.anchor('muzzle', 0, 0, -0.504);
  // --- Receiver, magazine housing with its release paddle, grip and guard.
  b.span({ z0: -0.2, z1: 0.105, y0: -0.024, y1: 0.0205, w: 0.0312, mat: P, r: 0.004 });
  b.span({ z0: -0.15, z1: -0.088, y0: -0.05, y1: -0.02, w: 0.0342, mat: P, r: 0.003 });
  b.span({ z0: -0.088, z1: -0.078, y0: -0.05, y1: -0.03, w: 0.0142, mat: P, r: 0.0015 });
  if (b.detail(0)) {
    b.box({ x: 0.0155, y: 0.0045, z: -0.095, w: 0.0016, h: 0.013, d: 0.05, mat: 'black', r: 0.0005 }); // ejection port
    for (const s of [-1, 1]) for (const z of [-0.18, -0.02, 0.09]) b.cylAxis({ axis: 'x', x: s * 0.0157, y: -0.018, z, len: 0.0012, r: 0.0018, mat: P, seg: 10 }); // rivets
  }
  b.anchor('ejectionPort', 0.016, 0.005, -0.095);
  guard(b, { zf: -0.036, zr: 0.03, yTop: -0.022, yBot: -0.054, t: 0.004, w: 0.0112, mat: P, rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.024, len: 0.018, curve: 0.005, mat: P });
  b.box({ x: 0, y: -0.027, z: -0.04, w: 0.009, h: 0.006, d: 0.008, mat: P, r: 0.0012 }); // safety
  b.extrude({ points: S([[0.026, -0.022], [0.07, -0.022], [0.082, -0.05], [0.102, -0.112], [0.094, -0.126], [0.07, -0.123], [0.056, -0.088], [0.04, -0.05]], 3), width: 0.0262, mat: P, bevel: 0.004 });
  b.extrude({ points: S([[0.04, -0.03], [0.07, -0.028], [0.094, -0.108], [0.088, -0.118], [0.072, -0.116], [0.05, -0.06]], 3), width: 0.0302, mat: 'beech', bevel: 0.006 });
  // --- Flip rear sight between ears.
  b.span({ z0: -0.185, z1: -0.155, y0: 0.018, y1: 0.0235, w: 0.0202, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.183, 0.021], [-0.157, 0.021], [-0.159, 0.0325], [-0.18, 0.032]], 2), width: 0.002, x: s * 0.0088, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0235, -0.182]);
  b.span({ z0: -0.183, z1: -0.162, y0: 0.0225, y1: 0.025, w: 0.0122, mat: P, r: 0.0006 });
  plateXYz(b, { outline: [[-0.0055, 0.024], [0.0055, 0.024], [0.0055, 0.0328], [0.0013, 0.0328], [0, 0.0305], [-0.0013, 0.0328], [-0.0055, 0.0328]], z0: -0.166, z1: -0.162, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, 0.0305, -0.164);
  b.body();
  b.meta.sightKind = 'leaf';
  // --- Folding stock (extended): top bar and lower strut, curved butt plate.
  b.cylAxis({ axis: 'x', x: 0, y: 0.012, z: 0.104, len: 0.034, r: 0.0045, mat: P, seg: 14 });
  b.part('stock', [0, 0.012, 0.104]);
  b.extrude({ points: path([[0.104, 0.006, 1], [0.31, 0.006, 1], [0.31, 0.016, 1], [0.104, 0.016, 1]]), width: 0.0162, mat: P, bevel: 0.0022 });
  bar(b, { pts: [[0, -0.02, 0.104], [0, -0.06, 0.2], [0, -0.1, 0.308]], r: 0.0045, mat: P, seg: 10 });
  b.extrude({ points: S([[0.304, 0.016], [0.316, 0.014], [0.32, -0.04], [0.316, -0.108], [0.304, -0.11], [0.308, -0.04]]), width: 0.0342, mat: P, bevel: 0.003 });
  b.body();
  b.meta.stockFold = { axis: 'x', angle: PI }; // swings up and forward over the receiver
  // --- Cocking handle on the right.
  b.part('bolt', [0, 0, -0.11]);
  b.cylAxis({ axis: 'x', x: 0.02, y: 0.002, z: -0.11, len: 0.01, r: 0.003, mat: P, seg: 10 });
  b.sphere({ x: 0.026, y: 0.002, z: -0.11, r: 0.0055, mat: P, seg: 14 });
  b.anchor('chargingHandle', 0.03, 0.002, -0.11);
  b.body();
  // --- 35-round curved magazine.
  const top = [-0.12, -0.024];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.245, depth: 0.042, width: 0.028, angle: 0.05, k: 1.7, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.999, -0.05];

  b.anchor('gripR', 0, -0.065, 0.07);
  b.anchor('trigger', 0, -0.033, 0.0);
  b.anchor('gripL', 0, -0.07, -0.12);
  b.anchor('shoulder', 0, -0.05, 0.318);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// PPD-40: 7.62x25 SMG, 788 mm long, 267 mm barrel. Round perforated jacket, hooded
// front post, tangent rear sight 50-500 m, round receiver with its end cap, one-piece
// birch stock whose fore-end runs past the 71-round drum, cocking handle (with its
// safety) on the right. Blued. Dimensions est. from photos.
export function ppd40(b) {
  const P = 'steelDark';
  const W = 'birch';
  const FS = 0.0305,
    FZ = -0.441;
  b.cyl({ z0: -0.448, z1: -0.2, r0: 0.0085, mat: 'steel', seg: 16 });
  perfTube(b, { z0: -0.44, z1: -0.205, r: 0.0185, mat: 'perforatedDark', seg: 30 });
  tube(b, { z0: -0.45, z1: -0.438, rIn: 0.0062, rOut: 0.0195, mat: P, seg: 30 });
  tube(b, { z0: -0.21, z1: -0.198, rIn: 0.009, rOut: 0.0195, mat: P, seg: 30 });
  // Hooded front post on the jacket front.
  b.span({ z0: -0.449, z1: -0.433, y0: 0.016, y1: 0.0235, w: 0.0112, mat: P, r: 0.0015 });
  plateXYz(b, { outline: [[-0.001, 0.0228], [0.001, 0.0228], [0.0009, 0.0285], [0.0003, FS], [-0.0003, FS], [-0.0009, 0.0285]], z0: FZ - 0.0022, z1: FZ + 0.0022, mat: P, bevel: 0.0002 });
  plateXYz(b, { outline: arch(0, 0.0275, 0.0072, 0.0081, -0.4, PI + 0.4, 0.0212, b.detail(1) ? 20 : 8), z0: -0.447, z1: -0.434, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, FS, FZ);
  b.anchor('muzzle', 0, 0, -0.45);
  // --- Round receiver with the end cap; magazine well below; ejection port right.
  lathe(b, { mat: P, seg: 32, profile: [[0.009, -0.2], [0.0188, -0.2], [0.0195, -0.198], [0.0195, 0.043], [0.0186, 0.045], [0.0, 0.045]] });
  lathe(b, { mat: P, seg: 28, profile: [[0, 0.043], [0.0198, 0.043], [0.0198, 0.047], [0.017, 0.053], [0.01, 0.0555], [0, 0.0555]] });
  b.span({ z0: -0.14, z1: -0.088, y0: -0.046, y1: -0.012, w: 0.0362, mat: P, r: 0.003 });
  if (b.detail(0)) b.box({ x: 0.0186, y: 0.005, z: -0.12, w: 0.0016, h: 0.014, d: 0.06, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.019, 0.005, -0.12);
  // --- Tangent rear sight on the receiver front.
  b.span({ z0: -0.198, z1: -0.15, y0: 0.016, y1: 0.0235, w: 0.0202, mat: P, r: 0.0015 });
  b.part('rearSight', [0, 0.024, -0.194]);
  b.span({ z0: -0.195, z1: -0.152, y0: 0.0228, y1: 0.0252, w: 0.0132, mat: P, r: 0.0006 });
  plateXYz(b, { outline: [[-0.0055, 0.024], [0.0055, 0.024], [0.0055, 0.0328], [0.0013, 0.0328], [0, 0.0305], [-0.0013, 0.0328], [-0.0055, 0.0328]], z0: -0.156, z1: -0.152, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.188, z1: -0.18, y0: 0.0218, y1: 0.0262, w: 0.0158, mat: P, r: 0.0008 });
  b.anchor('rearSight', 0, 0.0305, -0.154);
  b.body();
  b.meta.sightKind = 'leaf';
  // --- Trigger guard and trigger.
  guard(b, { zf: -0.04, zr: 0.042, yTop: -0.03, yBot: -0.062, t: 0.0045, w: 0.0122, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.032, len: 0.018, curve: 0.005, mat: P });
  // --- One-piece stock: fore-end in front of the drum, wrist, butt.
  const stk = stock(b, {
    mat: W,
    z0: -0.33,
    z1: 0.3335,
    top: [
      [-0.33, -0.0122],
      [-0.2, -0.014],
      [0.04, -0.014],
      [0.06, 0.004],
      [0.1, 0.002],
      [0.24, -0.018],
      [0.3335, -0.032],
    ],
    bottom: [
      [-0.33, -0.0285],
      [-0.31, -0.034],
      [-0.18, -0.03],
      [-0.16, -0.042],
      [-0.08, -0.042],
      [0.036, -0.042],
      [0.05, -0.054],
      [0.08, -0.072],
      [0.13, -0.09],
      [0.24, -0.122],
      [0.3335, -0.152],
    ],
    width: [
      [-0.33, 0.0362],
      [-0.15, 0.0402],
      [0.0, 0.0402],
      [0.08, 0.0342],
      [0.16, 0.0372],
      [0.3335, 0.0408],
    ],
    n: [
      [-0.25, 2.8],
      [0.0, 3.2],
      [0.09, 2.3],
      [0.18, 2.9],
      [0.32, 3.3],
    ],
    wTop: [
      [-0.25, 0.9],
      [0.0, 0.95],
      [0.1, 0.82],
      [0.3, 0.72],
    ],
    wBot: 0.84,
    belly: 0.5,
    roundStart: 0.005,
  });
  buttPlate(b, stk, { z0: 0.3305, z1: 0.341, mat: P, screws: [-0.044, -0.138] });
  for (const [zs, ys] of [
    [-0.29, -0.022],
    [0.24, -0.09],
  ]) {
    const hw = stk.halfWidth(zs, ys);
    b.box({ x: -hw - 0.001, y: ys, z: zs, w: 0.003, h: 0.01, d: 0.022, mat: P, r: 0.001 });
    bar(b, { pts: [[-hw - 0.002, ys + 0.003, zs - 0.011], [-hw - 0.004, ys - 0.004, zs - 0.015], [-hw - 0.005, ys - 0.011, zs], [-hw - 0.004, ys - 0.004, zs + 0.015], [-hw - 0.002, ys + 0.003, zs + 0.011]], closed: true, r: 0.0019, mat: P, seg: 8 });
  }
  // --- Cocking handle on the right (bolt forward).
  b.part('bolt', [0, 0, -0.12]);
  b.cylAxis({ axis: 'x', x: 0.022, y: 0.004, z: -0.12, len: 0.01, r: 0.0032, mat: P, seg: 10 });
  b.sphere({ x: 0.028, y: 0.004, z: -0.12, r: 0.0058, mat: P, seg: 14 });
  b.anchor('chargingHandle', 0.032, 0.004, -0.12);
  b.body();
  // --- 71-round drum.
  b.part('mag', [0, -0.042, -0.114]);
  drum71(b, { z: -0.128, y: -0.15, tower: 0.012, mat: P });
  b.body();
  b.anchor('magWell', 0, -0.042, -0.114);
  b.meta.magAxis = [0, -1, 0];

  sling(b, { from: [-0.0245, -0.033, -0.29], to: [-0.0255, -0.101, 0.24], sag: 0.07, width: 0.03, mat: 'canvas', hardware: 'leather' });

  b.anchor('gripR', 0, -0.06, 0.072);
  b.anchor('trigger', 0, -0.041, 0.0);
  b.anchor('gripL', 0, -0.045, -0.27);
  b.anchor('shoulder', 0, -0.09, 0.341);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// DP-28 (Degtyaryov): 7.62x54R LMG, 1270 mm long, 605 mm barrel, 47-round pan on top
// ('mag', lifts off upward). Perforated barrel shroud with the conical flash hider,
// tall front post between ears on the shroud front, bipod at the shroud front,
// gas cylinder under the barrel, tangent rear sight on a high base ahead of the pan
// (the line of sight passes over it), cocking handle on the right, wooden butt
// with the half pistol grip; empties drop out underneath. Blued; the pan is
// painted. Dimensions est. from photos.
export function dp28(b) {
  const P = 'steelDark';
  b.cyl({ z0: -0.86, z1: -0.28, r0: 0.0115, r1: 0.0135, mat: 'steel', seg: 18 });
  b.cyl({ z0: -0.84, z1: -0.29, r0: 0.0078, y: -0.019, mat: P, seg: 14 }); // gas cylinder
  perfTube(b, { z0: -0.838, z1: -0.3, r: 0.0285, mat: 'perforatedDark', seg: 36 });
  tube(b, { z0: -0.86, z1: -0.836, rIn: 0.012, rOut: 0.0302, mat: P, seg: 32 });
  tube(b, { z0: -0.31, z1: -0.285, rIn: 0.012, rOut: 0.0298, mat: P, seg: 32 });
  // Conical flash hider.
  lathe(b, { mat: P, seg: 28, profile: [[0.0085, -0.86], [0.0125, -0.86], [0.0135, -0.866], [0.0225, -0.94], [0.0195, -0.94], [0.0098, -0.87], [0.0085, -0.87]] });
  // Tall front post with protecting ears on the shroud front.
  b.extrude({ points: path([[-0.858, 0.028, 1], [-0.838, 0.028, 1], [-0.842, 0.064], [-0.854, 0.064]]), width: 0.0102, mat: P, bevel: 0.0012 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.857, 0.058], [-0.839, 0.058], [-0.841, 0.094], [-0.855, 0.094]], 2), width: 0.0025, x: s * 0.0075, mat: P, bevel: 0.0004 });
  plateXYz(b, { outline: [[-0.001, 0.062], [0.001, 0.062], [0.0009, 0.086], [0.0003, 0.0885], [-0.0003, 0.0885], [-0.0009, 0.086]], z0: -0.8505, z1: -0.8455, mat: P, bevel: 0.0002 });
  b.anchor('frontSight', 0, 0.0885, -0.848);
  // --- Receiver with the pan seat.
  lathe(b, { mat: P, seg: 32, profile: [[0.0, -0.29], [0.0255, -0.29], [0.0272, -0.288], [0.0272, 0.062], [0.026, 0.065], [0, 0.065]] });
  b.span({ z0: -0.29, z1: 0.065, y0: -0.034, y1: 0.0, w: 0.0442, mat: P, r: 0.006 });
  b.span({ z0: -0.24, z1: -0.02, y0: 0.024, y1: 0.031, w: 0.0302, mat: P, r: 0.002 }); // magazine seat
  if (b.detail(0)) for (const s of [-1, 1]) for (const z of [-0.25, -0.1, 0.04]) screw(b, { at: [s * 0.0222, -0.018, z], axis: s > 0 ? 'x' : '-x', r: 0.0026, mat: P, slot: 0.7 });
  b.anchor('ejectionPort', 0, -0.036, -0.12);
  // Rear sight ahead of the pan: high base with ears, leaf hinged at its front.
  b.extrude({ points: path([[-0.33, 0.026, 1], [-0.262, 0.026, 1], [-0.266, 0.07], [-0.32, 0.078], [-0.33, 0.078, 1]]), width: 0.0242, mat: P, bevel: 0.002 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.33, 0.07], [-0.27, 0.07], [-0.272, 0.094], [-0.3, 0.096], [-0.328, 0.09]], 3), width: 0.0025, x: s * 0.0115, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0795, -0.325]);
  b.span({ z0: -0.327, z1: -0.268, y0: 0.0785, y1: 0.0812, w: 0.0162, mat: P, r: 0.0007 });
  b.span({ z0: -0.316, z1: -0.306, y0: 0.0775, y1: 0.0825, w: 0.0192, mat: P, r: 0.0008 }); // slider
  plateXYz(b, { outline: [[-0.0062, 0.08], [0.0062, 0.08], [0.0062, 0.0912], [0.0015, 0.0912], [0, 0.0885], [-0.0015, 0.0912], [-0.0062, 0.0912]], z0: -0.272, z1: -0.268, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, 0.0885, -0.27);
  b.body();
  b.meta.sightKind = 'leaf';
  // --- Trigger guard and trigger.
  guard(b, { zf: -0.045, zr: 0.04, yTop: -0.032, yBot: -0.066, t: 0.0048, w: 0.0122, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.034, len: 0.02, curve: 0.006, mat: P });
  // --- Wooden stock with the half pistol grip.
  const stk = stock(b, {
    mat: 'birch',
    z0: 0.06,
    z1: 0.3305,
    top: [
      [0.06, 0.022],
      [0.1, 0.018],
      [0.2, 0.004],
      [0.3305, -0.016],
    ],
    bottom: [
      [0.06, -0.034],
      [0.068, -0.075],
      [0.08, -0.1],
      [0.098, -0.105],
      [0.12, -0.09],
      [0.15, -0.09],
      [0.24, -0.118],
      [0.3305, -0.142],
    ],
    width: [
      [0.06, 0.0402],
      [0.1, 0.0352],
      [0.16, 0.0382],
      [0.3305, 0.0412],
    ],
    n: [
      [0.06, 3.0],
      [0.1, 2.4],
      [0.2, 2.9],
      [0.32, 3.3],
    ],
    wTop: 0.8,
    wBot: 0.82,
    belly: 0.48,
    roundStart: 0.003,
  });
  buttPlate(b, stk, { z0: 0.3275, z1: 0.3375, mat: P, screws: [-0.03, -0.128] });
  // --- Cocking handle on the right (operating rod, forward).
  b.part('bolt', [0, -0.018, -0.2]);
  b.cylAxis({ axis: 'x', x: 0.028, y: -0.018, z: -0.2, len: 0.014, r: 0.0042, mat: P, seg: 12 });
  b.sphere({ x: 0.036, y: -0.018, z: -0.2, r: 0.0068, mat: P, seg: 16 });
  b.anchor('chargingHandle', 0.041, -0.018, -0.2);
  b.body();
  // --- Bipod at the shroud front (deployed).
  b.part('bipod', [0, -0.026, -0.82]);
  tube(b, { z0: -0.83, z1: -0.81, rIn: 0.0285, rOut: 0.0322, mat: P, seg: 28 });
  for (const s of [-1, 1]) {
    b.rod({ from: [s * 0.012, -0.03, -0.82], to: [s * 0.13, -0.32, -0.8], r: 0.0055, r1: 0.0048, mat: P });
    b.box({ x: s * 0.132, y: -0.325, z: -0.8, w: 0.012, h: 0.006, d: 0.035, mat: P, r: 0.002 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2;
  // --- 47-round pan on top (axis vertical), lifts straight up: two stamped halves
  // with stiffening rings and the center hub.
  const pc = [0, 0.031, -0.13];
  b.part('mag', pc);
  place(b, { pos: pc, rot: [-PI / 2, 0, 0] }, () => {
    lathe(b, {
      mat: 'sovietGreen',
      seg: 56,
      profile: [
        [0, 0.0],
        [0.128, 0.0],
        [0.1325, 0.004],
        [0.1325, 0.03],
        [0.126, 0.034],
        [0.09, 0.039],
        [0.05, 0.046],
        [0.032, 0.049],
        [0.03, 0.054],
        [0, 0.054],
      ],
    });
    for (const rr of [0.065, 0.1]) tube(b, { z0: 0.0355 + (0.1 - rr) * 0.15, z1: 0.0405 + (0.1 - rr) * 0.15, rIn: rr - 0.003, rOut: rr, mat: 'sovietGreen', seg: 48 });
    tube(b, { z0: 0.0142, z1: 0.0172, rIn: 0.1315, rOut: 0.1345, mat: 'sovietGreen', seg: 56 }); // seam
  });
  b.body();
  b.anchor('magWell', 0, 0.031, -0.13);
  b.meta.magAxis = [0, 1, 0];

  b.anchor('muzzle', 0, 0, -0.94);
  b.anchor('gripR', 0, -0.075, 0.09);
  b.anchor('trigger', 0, -0.045, 0.0);
  b.anchor('gripL', 0, -0.05, 0.2); // under the stock (bipod fire)
  b.anchor('shoulder', 0, -0.08, 0.3375);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.12;
  b.meta.openBolt = true;
}

// Tokarev TT-33: 7.62x25 pistol, 196 mm long, 116 mm barrel. Flat-sided slide with
// the rounded top and alternating wide and narrow grasping grooves, blade front
// and notch rear sight, barrel bushing; frame with the slide stop, magazine catch
// behind the guard, black bakelite grips with vertical ribs and the star in a
// ring, lanyard loop; spur hammer, cocked. Blued. Dimensions est. from photos.
export function tt33(b) {
  const P = 'steelDark';
  const MZ = -0.116;
  // --- Frame with the trigger guard and grip.
  b.extrude({
    points: [
      [-0.078, -0.01],
      [0.056, -0.01],
      [0.066, -0.012],
      [0.065, -0.022],
      [0.061, -0.03],
      [0.066, -0.06],
      [0.073, -0.098],
      [0.078, -0.114],
      [0.074, -0.12],
      [0.036, -0.12],
      [0.034, -0.114],
      [0.016, -0.044],
      [0.01, -0.047],
      [-0.03, -0.047],
      [-0.04, -0.042],
      [-0.044, -0.03],
      [-0.046, -0.02],
      [-0.078, -0.019],
    ],
    holes: [S([[-0.035, -0.021], [0.008, -0.021], [0.0125, -0.03], [0.008, -0.041], [-0.027, -0.042], [-0.035, -0.035]], 3)],
    width: 0.0202,
    mat: P,
    bevel: 0.0012,
  });
  // Ribbed bakelite grips with the star medallion.
  b.extrude({ points: S([[0.018, -0.033], [0.058, -0.03], [0.062, -0.05], [0.072, -0.102], [0.073, -0.112], [0.04, -0.114], [0.034, -0.1], [0.02, -0.044]], 3), width: 0.0268, mat: 'ribbed', bevel: 0.0022 });
  for (const s of [-1, 1]) {
    b.cylAxis({ axis: 'x', x: s * 0.0135, y: -0.06, z: 0.047, len: 0.0008, r: 0.0085, mat: 'bakeliteBlack', seg: 20 });
    if (b.detail(0)) {
      // Five-pointed star in relief.
      const star = [];
      for (let i = 0; i < 10; i++) {
        const a = PI / 2 + (i * PI) / 5;
        const r = i % 2 ? 0.0028 : 0.0068;
        star.push([0.047 + Math.cos(a) * r, -0.06 + Math.sin(a) * r]);
      }
      b.extrude({ points: star, width: 0.0006, x: s * 0.0141, mat: 'bakeliteBlack', bevel: 0.0001 });
    }
  }
  bar(b, { pts: [[0, -0.1205, 0.068], [0, -0.1255, 0.0705], [0, -0.1275, 0.076], [0, -0.1235, 0.0795], [0, -0.1205, 0.077]], closed: true, r: 0.001, mat: P, seg: 8 }); // lanyard loop
  trigger(b, { z: 0, yTop: -0.022, len: 0.019, curve: 0.004, w: 0.0055, mat: P });
  b.extrude({ points: S([[-0.04, -0.0115], [-0.018, -0.0118], [-0.015, -0.0148], [-0.019, -0.0172], [-0.036, -0.0175]], 2), width: 0.002, x: -0.0108, mat: P, bevel: 0.0005 }); // slide stop
  b.cylAxis({ axis: 'x', x: -0.0112, y: -0.0285, z: 0.0168, len: 0.0026, r: 0.0034, mat: P, seg: 12 }); // magazine catch
  b.cyl({ z0: MZ, z1: -0.02, r0: 0.0068, mat: 'steelBright', seg: 18 });
  b.cyl({ z0: MZ - 0.0002, z1: MZ + 0.008, r0: 0.0052, mat: 'black', seg: 12 });
  b.anchor('ejectionPort', 0.011, 0.004, -0.018);
  // --- Slide: flat sides, rounded top, alternating wide/narrow grooves at the rear.
  b.part('bolt', [0, 0, 0.06]);
  {
    const n = b.detail(0) ? 10 : 0;
    const z0 = 0.029,
      z1 = 0.0585;
    const serr = serrations(z0, z1, n);
    const zs = (b.detail(0) ? [MZ, MZ + 0.0015, -0.087, -0.0862, ...serr.zs, 0.0595, 0.0605] : [MZ, -0.087, -0.0862, 0.0605]).sort((a, c) => a - c).filter((z, i, a) => i === 0 || z - a[i - 1] > 1e-5);
    const K = b.detail(0) ? 6 : 2;
    const sec = (z) => {
      // Every other groove is shorter (stops lower), as on the TT.
      const gi = Math.floor(((z - z0) / (z1 - z0)) * Math.max(1, n));
      const d = serr.depth(z) * 0.0005;
      const hw = 0.011;
      const yb = z < -0.0866 ? -0.019 : -0.01;
      const rt = 0.0058;
      const end = z < MZ + 0.001 || z > 0.0602 ? 0.0006 : 0;
      const yTopGroove = gi % 2 ? 0.0 : 0.0055;
      const pts = [[0, yb + end], [hw - end - d, yb + end], [hw - end - d, yTopGroove], [hw - end, yTopGroove + 0.0012], [hw - end, 0.0105 - rt]];
      for (let k = 1; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([hw - end - rt + Math.cos(a) * rt, 0.0105 - end - rt + Math.sin(a) * rt]);
      }
      const left = pts.slice(1).map(([x, y]) => [-x, y]).reverse();
      return [...pts, ...left];
    };
    sectionLoft(b, { zs, section: sec, mat: P });
  }
  if (b.detail(0)) b.box({ x: 0.0105, y: 0.0042, z: -0.017, w: 0.0016, h: 0.0092, d: 0.026, mat: 'black', r: 0.0004 }); // ejection port
  tube(b, { z0: MZ - 0.0008, z1: MZ + 0.004, rIn: 0.0068, rOut: 0.0086, mat: P, seg: 18 });
  b.extrude({ points: [[-0.112, 0.0098], [-0.105, 0.0098], [-0.106, 0.01379], [-0.111, 0.01379]], width: 0.0026, mat: P, bevel: 0.0004 });
  plateXYz(b, { outline: [[-0.0052, 0.0098], [0.0052, 0.0098], [0.0048, 0.0158], [0.0013, 0.0158], [0.0013, 0.014], [-0.0013, 0.014], [-0.0013, 0.0158], [-0.0048, 0.0158]], z0: 0.046, z1: 0.053, mat: P, bevel: 0.0004 });
  b.body();
  b.anchor('frontSight', 0, 0.01379, -0.1085);
  b.anchor('rearSight', 0, 0.014, 0.0495);
  // --- Hammer (cocked) with the checkered spur.
  b.part('hammer', [0, -0.006, 0.06]);
  b.extrude({ points: S([[0.054, -0.012], [0.063, -0.013], [0.069, -0.004], [0.075, 0.006], [0.08, 0.0065], [0.079, 0.0005], [0.073, -0.007], [0.064, -0.016], [0.056, -0.017]]), width: 0.0082, mat: P, bevel: 0.0008 });
  if (b.detail(0)) for (let i = 0; i < 4; i++) b.box({ x: 0, y: 0.0055 - i * 0.0004, z: 0.0738 + i * 0.0016, w: 0.0084, h: 0.0007, d: 0.0006, mat: 'black', r: 0, rx: -0.3 });
  b.body();
  // --- Magazine.
  const top = [0.021, -0.012];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.112, depth: 0.0365, width: 0.0135, angle: -0.28, mat: P, plate: 0.0045, lip: 0.0012, rib: false });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.961, 0.276];

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.068, 0.047);
  b.anchor('trigger', 0, -0.031, 0.0);
  b.anchor('gripL', -0.022, -0.082, 0.043);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.036;
}

// Nagant M1895: 7.62x38R gas-seal revolver, 235 mm long, 114 mm barrel. Slim
// barrel with the forged front sight blade; the ejector rod sits in a tube on a
// swivel collar under the barrel with its knob at the front; solid frame with the
// long unfluted 7-shot cylinder (the rounds sit wholly inside their cases, so the
// case mouths show in front; the cylinder moves forward to seal the gap when
// cocked), the loading gate on the right behind it, the side plate on the left,
// the rear sight groove in the top strap; spur hammer (down); checkered walnut
// stocks and the lanyard ring under the butt. Blued. Dimensions est. from side
// views.
export function nagant_m1895(b) {
  const P = 'steelDark';
  const cy = -0.0118;
  const MZ = -0.172;
  // --- Barrel, front sight, ejector rod tube and collar under it.
  lathe(b, { mat: P, seg: 26, profile: [[0.0046, MZ], [0.0068, MZ], [0.0072, MZ + 0.001], [0.0073, -0.14], [0.0077, -0.09], [0.0082, -0.066], [0.0088, -0.0632], [0.0088, -0.056], [0, -0.056]] });
  b.cyl({ z0: MZ - 0.0002, z1: MZ + 0.01, r0: 0.0047, mat: 'black', seg: 12 });
  b.extrude({ points: path([[-0.1612, 0.0066, 1], [-0.1612, 0.01367, 1], [-0.1636, 0.0135], [-0.1662, 0.0122], [-0.1684, 0.0098], [-0.1694, 0.0066, 1]], 3), width: 0.0026, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.01367, -0.1614);
  b.cyl({ z0: -0.149, z1: -0.0565, r0: 0.0034, y: cy, mat: P, seg: 12 }); // rod tube
  lathe(b, { mat: P, seg: 16, y: cy + 0.001, profile: [[0.0058, -0.138], [0.0062, -0.1372], [0.0062, -0.1268], [0.0058, -0.126]] }); // swivel collar
  b.extrude({ points: path([[-0.1395, -0.0075, 1], [-0.125, -0.0075, 1], [-0.1262, -0.004], [-0.1382, -0.004]], 2), width: 0.0052, mat: P, bevel: 0.0005 });
  if (b.detail(1)) knurledKnob(b, { at: [0, cy, -0.1528], axis: 'z', r: 0.0044, len: 0.0072, teeth: 16, depth: 0.0003, mat: P });

  // --- Solid frame: front, top strap, recoil shield, guard, grip frame.
  const g0 = [0.0322, -0.0302],
    g1 = [0.0468, -0.1012];
  const gl = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]);
  const GT = [(g1[0] - g0[0]) / gl, (g1[1] - g0[1]) / gl];
  const GN = [GT[1], -GT[0]]; // toward the front
  const gripF = (t) => 0.0142 + 0.0042 * t,
    gripB = (t) => 0.0148 + 0.0038 * t;
  const gp = (t, d) => [g0[0] + GT[0] * gl * t + GN[0] * d, g0[1] + GT[1] * gl * t + GN[1] * d];
  const strapF = [1, 0.85, 0.55, 0.28].map((t) => gp(t, gripF(t) + 0.0012));
  const strapB = [0.08, 0.38, 0.7, 1].map((t) => gp(t, -gripB(t) - 0.0012));
  const frame = path(
    [
      [-0.0595, -0.0262, 1],
      [-0.0595, 0.0108],
      [-0.0548, 0.0149, 1],
      [0.004, 0.0149, 1],
      [0.0085, 0.0124],
      [0.0118, 0.007],
      [0.026, 0.0016],
      [0.0352, -0.0035],
      [0.0418, -0.0118],
      ...strapB,
      [...gp(1.06, -gripB(1) - 0.0006), 1],
      [...gp(1.06, gripF(1) + 0.0006), 1],
      ...strapF,
      [0.0142, -0.0398],
      [0.0098, -0.0492],
      [0.0018, -0.0568],
      [-0.0082, -0.0588],
      [-0.0168, -0.0548],
      [-0.0212, -0.0448],
      [-0.0222, -0.0352, 1],
      [-0.0462, -0.0342, 1],
    ],
    3,
  );
  const windowHole = [[-0.0505, -0.0318], [-0.0068, -0.0318], [-0.0068, 0.0088], [-0.0505, 0.0088]];
  const guardHole = S([[-0.0162, -0.0368], [0.0082, -0.0368], [0.0108, -0.0418], [0.0058, -0.0502], [-0.0062, -0.0538], [-0.0138, -0.0512], [-0.0172, -0.0448]], 4);
  b.extrude({ points: frame, holes: [windowHole, guardHole], width: 0.0172, mat: P, bevel: 0.001 });
  // Side plate (left), its screw; loading gate (right) behind the cylinder.
  if (b.detail(1)) b.extrude({ points: path([[-0.002, -0.004, 1], [0.03, -0.004], [0.036, -0.016], [0.028, -0.034], [0.012, -0.036], [-0.002, -0.026, 1]], 3), width: 0.0008, x: -0.0089, mat: P, bevel: 0.0002 });
  if (b.detail(0)) screw(b, { at: [-0.0093, -0.018, 0.016], axis: '-x', r: 0.0026, h: 0.0008, mat: P, slot: 0.9 });
  b.extrude({ points: path([[-0.0062, -0.0262, 1], [0.0062, -0.0262, 1], [0.0068, 0.0048], [0.004, 0.0072], [-0.0062, 0.0072, 1]], 2), width: 0.0026, x: 0.0094, mat: P, bevel: 0.0005 });
  b.cylAxis({ axis: 'x', x: 0.0108, y: -0.0255, z: 0.0, len: 0.0012, r: 0.0022, mat: P, seg: 10 });
  b.anchor('ejectionPort', 0.012, cy, -0.006); // loading gate
  // Rear sight groove along the top strap.
  if (b.detail(0)) b.span({ z0: -0.03, z1: 0.0036, y0: 0.0141, y1: 0.01495, w: 0.0028, mat: 'black', r: 0 });
  b.anchor('rearSight', 0, 0.0141, 0.003);
  trigger(b, { z: 0, yTop: -0.0352, len: 0.02, curve: 0.006, w: 0.0056, mat: P });
  // Checkered walnut stocks with a smooth border, lanyard ring.
  sweepGrip(b, { path: [g0, gp(0.5, 0), g1], sections: (t) => ({ w: 0.0298 - 0.001 * t, f: gripF(t), r: gripB(t), n: 3 }), mat: 'walnut' });
  sweepGrip(b, { path: [gp(0.1, 0), gp(0.5, 0), gp(0.92, 0)], sections: (t) => ({ w: 0.0306 - 0.001 * t, f: gripF(0.1 + 0.82 * t) - 0.003, r: gripB(0.1 + 0.82 * t) - 0.003, n: 3 }), mat: 'checkerWalnut', capStart: false, capEnd: false });
  if (b.detail(0)) for (const s of [-1, 1]) screw(b, { at: [s * 0.0154, -0.066, 0.04], axis: s > 0 ? 'x' : '-x', r: 0.0027, h: 0.0008, mat: P, slot: 0.5 });
  const ring = gp(1.08, -0.002);
  bar(b, { pts: [[0, ring[1], ring[0] - 0.0058], [0, ring[1] - 0.0052, ring[0] - 0.0038], [0, ring[1] - 0.0074, ring[0] + 0.0012], [0, ring[1] - 0.0052, ring[0] + 0.0062], [0, ring[1], ring[0] + 0.0076]], closed: true, r: 0.0011, mat: P, seg: 8 });

  // --- Seven-shot cylinder: unfluted, the case mouths in front.
  b.part('cylinder', [0, cy, -0.0285]);
  lathe(b, { mat: P, y: cy, seg: 40, profile: [[0, -0.0492], [0.0172, -0.0492], [0.0186, -0.0482], [0.0195, -0.0458], [0.0195, -0.0118], [0.0189, -0.0082], [0, -0.0082]] });
  for (let k = 0; k < 7; k++) {
    const a = PI / 2 + (k * 2 * PI) / 7;
    const x = Math.cos(a) * 0.0118,
      y = cy + Math.sin(a) * 0.0118;
    b.cyl({ z0: -0.0496, z1: -0.0488, r0: 0.0043, x, y, mat: 'brass', seg: 12 });
    if (b.detail(0)) {
      b.cyl({ z0: -0.0498, z1: -0.049, r0: 0.0026, x, y, mat: 'black', seg: 10 }); // the case mouth's crimp
      const s = a + PI / 7; // stop notches between the chambers
      b.box({ x: Math.cos(s) * 0.0193, y: cy + Math.sin(s) * 0.0193, z: -0.0142, w: 0.0024, h: 0.0024, d: 0.005, rz: s, mat: 'black', r: 0.0003 });
    }
  }
  b.body();
  // --- Spur hammer (down), checkered spur.
  b.part('hammer', [0, 0.002, 0.03]);
  b.extrude({ points: path([[0.0088, 0.0042, 1], [0.0092, 0.0112, 1], [0.0152, 0.0132], [0.0262, 0.0155], [0.0378, 0.0186], [0.0472, 0.0205], [0.0526, 0.0196], [0.0532, 0.0164], [0.0468, 0.0142], [0.0392, 0.0108], [0.0338, 0.0042], [0.0302, -0.0048, 1], [0.0212, -0.0068, 1], [0.0128, -0.0012]], 3), width: 0.0072, mat: P, bevel: 0.0008 });
  if (b.detail(0)) for (let i = 0; i < 5; i++) b.box({ x: 0, y: 0.0186 + i * 0.0005, z: 0.0398 + i * 0.0024, w: 0.0074, h: 0.0005, d: 0.0007, rx: -0.25, mat: 'black', r: 0 });
  b.body();

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.065, 0.04);
  b.anchor('trigger', 0, -0.045, 0.0);
  b.anchor('gripL', -0.022, -0.075, 0.04);
  b.meta.sight = 'notch';
  b.meta.cylinderRounds = 7;
  b.meta.cylinderSeal = 0.002; // forward travel when cocking
  b.meta.gripRake = 0.2;
  b.meta.gripRadius = 0.016;
}

// PTRD-41 anti-tank rifle: 14.5x114 mm single shot, 2000 mm long, 1350 mm barrel
// (Wikipedia). Two-window muzzle brake; carrying handle and bipod clamped to the
// barrel; front and rear sights offset to the left (rear: flip leaf with notches
// for up to 400 m and 400-1000 m); round receiver with the loading port on the
// right and the bolt with its big ball handle (the receiver recoils inside the
// stock and cams the bolt open after each shot); trigger housing with the wooden
// pistol grip; tubular stock holding the recoil spring, wooden cheek rest and left
// hand grip, padded butt. Fittings est. from photos.
export function ptrd41(b) {
  const P = 'steel';
  // --- Barrel and muzzle brake (front plate, middle baffle, rear ring and the
  // curved bridges above and below; big open windows on both sides).
  lathe(b, { mat: P, seg: 28, profile: [[0, -0.21], [0.0235, -0.21], [0.0228, -0.32], [0.0212, -0.6], [0.0192, -0.95], [0.0178, -1.3], [0.0172, -1.565], [0, -1.565]] });
  b.cyl({ z0: -1.663, z1: -1.64, r0: 0.0076, mat: 'black', seg: 14 });
  const BR = 0.0255;
  for (const [z0, z1] of [[-1.662, -1.651], [-1.618, -1.607], [-1.576, -1.558]]) lathe(b, { mat: P, seg: 28, profile: [[0.0076, z0], [BR - 0.0012, z0], [BR, z0 + 0.0012], [BR, z1 - 0.0012], [BR - 0.0012, z1], [0.0076, z1]] });
  for (const mid of [PI / 2, -PI / 2]) {
    const K = b.detail(0) ? 10 : 4;
    const arc = (r) => Array.from({ length: K + 1 }, (_, k) => mid + (k / K - 0.5) * 1.42).map((a) => [Math.cos(a) * r, Math.sin(a) * r]);
    sectionLoft(b, { zs: [-1.656, -1.565], section: () => [...arc(BR), ...arc(BR - 0.006).reverse()], mat: P });
  }
  // --- Carrying handle and its clamps.
  band(b, { z0: -0.6, z1: -0.565, y0: -0.0214, y1: 0.0214, w: 0.0428, n: 2, thick: 0.004, mat: P });
  b.extrude({ points: path([[-0.6, 0.02, 1], [-0.565, 0.02, 1], [-0.57, 0.03], [-0.595, 0.03]], 2), width: 0.034, mat: P, bevel: 0.002 });
  for (const z of [-0.632, -0.528]) b.extrude({ points: path([[z - 0.007, 0.024, 1], [z + 0.007, 0.024, 1], [z + 0.005, 0.05], [z - 0.005, 0.05]], 2), width: 0.008, mat: P, bevel: 0.0012 });
  b.extrude({ points: path([[-0.632, 0.027, 1], [-0.528, 0.027, 1], [-0.528, 0.031, 1], [-0.632, 0.031, 1]], 2), width: 0.006, mat: P, bevel: 0.001 });
  b.cyl({ z0: -0.626, z1: -0.534, r0: 0.0088, y: 0.0465, mat: 'birch', seg: 14 });
  // --- Front sight on its bracket (left), between protecting ears.
  const SX = -0.042;
  b.extrude({ points: path([[-1.013, -0.006, 1], [-0.987, -0.006, 1], [-0.99, 0.018], [-1.01, 0.018]], 2), width: 0.03, x: -0.026, mat: P, bevel: 0.002 });
  b.extrude({ points: path([[-1.0055, 0.017, 1], [-0.9945, 0.017, 1], [-0.9965, 0.0385, 1], [-1.0035, 0.0385, 1]], 2), width: 0.0028, x: SX, mat: P, bevel: 0.0004 });
  for (const sx of [-1, 1]) b.extrude({ points: path([[-1.009, 0.015, 1], [-0.991, 0.015, 1], [-0.993, 0.0425], [-1.007, 0.0425]], 2), width: 0.002, x: SX + sx * 0.0072, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', SX, 0.0385, -1.0);
  // --- Rear sight base on the receiver front (left) and the flip leaf.
  b.extrude({ points: path([[-0.152, -0.004, 1], [-0.078, -0.004, 1], [-0.08, 0.0225], [-0.15, 0.0225]], 2), width: 0.016, x: -0.033, mat: P, bevel: 0.0015 });
  b.part('rearSight', [SX, 0.024, -0.145]);
  b.span({ z0: -0.147, z1: -0.088, y0: 0.022, y1: 0.025, w: 0.014, x: SX, mat: P, r: 0.0007 });
  plateXYz(b, { outline: [[SX - 0.0068, 0.0235], [SX + 0.0068, 0.0235], [SX + 0.0068, 0.041], [SX + 0.0016, 0.041], [SX, 0.0385], [SX - 0.0016, 0.041], [SX - 0.0068, 0.041]], z0: -0.092, z1: -0.088, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', SX, 0.0385, -0.09);
  b.body();
  b.meta.sightKind = 'leaf';
  // --- Receiver with the loading port (right), trigger housing, grip and guard.
  lathe(b, { mat: P, seg: 28, profile: [[0, -0.262], [0.0285, -0.262], [0.031, -0.258], [0.031, 0.016], [0.029, 0.02], [0, 0.02]] });
  b.box({ x: 0.0262, y: 0.016, z: -0.14, w: 0.012, h: 0.022, d: 0.12, mat: 'black', r: 0.002 }); // loading port
  b.anchor('ejectionPort', 0.03, 0.02, -0.14);
  b.extrude({ points: path([[-0.055, -0.024, 1], [0.075, -0.024, 1], [0.075, -0.044, 1], [-0.05, -0.044, 1]], 2), width: 0.032, mat: P, bevel: 0.003 });
  guard(b, { zf: -0.04, zr: 0.03, yTop: -0.043, yBot: -0.075, t: 0.0045, w: 0.012, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.044, len: 0.02, curve: 0.006, mat: P });
  sweepGrip(b, { path: [[0.05, -0.044], [0.062, -0.088], [0.076, -0.134]], sections: (t) => ({ w: 0.03, f: 0.0158 + 0.0014 * t, r: 0.0175 + 0.002 * t, n: 2.6 }), dome: 0.12, mat: 'birch' });
  // --- Stock: the tube the receiver recoils into, cheek rest, left hand grip,
  // padded butt.
  b.cyl({ z0: 0.02, z1: 0.335, r0: 0.0255, y: -0.006, mat: P, seg: 26 });
  lathe(b, { mat: P, seg: 26, y: -0.006, profile: [[0.0255, 0.018], [0.0285, 0.02], [0.0285, 0.05], [0.0255, 0.052]] });
  stock(b, {
    top: [[0.1, 0.022], [0.17, 0.034], [0.27, 0.035]],
    bottom: [[0.1, 0.006], [0.27, 0.008]],
    width: [[0.1, 0.034], [0.27, 0.04]],
    x0: -0.004,
    n: 2.4,
    mat: 'birch',
    roundStart: 0.02,
    roundEnd: 0.01,
  });
  sweepGrip(b, { path: [[0.142, -0.027], [0.144, -0.07], [0.146, -0.112]], sections: (t) => ({ w: 0.03, f: 0.016, r: 0.017, n: 2.4 }), dome: 0.14, mat: 'birch' });
  b.extrude({ points: path([[0.335, 0.026, 1], [0.348, 0.026, 1], [0.348, -0.118, 1], [0.335, -0.118, 1]], 2), width: 0.05, mat: P, bevel: 0.003 });
  b.extrude({ points: path([[0.348, 0.03], [0.362, 0.028], [0.366, -0.045], [0.362, -0.12], [0.348, -0.122]], 3), width: 0.062, mat: 'leather', bevel: 0.012 });
  // --- Bolt with its handle (right).
  b.part('bolt', [0, 0, 0.02]);
  b.cyl({ z0: -0.21, z1: 0.02, r0: 0.018, mat: 'steelBright', seg: 20 });
  bar(b, { pts: [[0.016, 0.0, -0.02], [0.045, -0.004, -0.02], [0.068, -0.009, -0.02]], r: 0.0058, mat: 'steelBright', seg: 10 });
  b.sphere({ x: 0.075, y: -0.011, z: -0.02, r: 0.0115, mat: 'steelBright', seg: 16 });
  b.anchor('boltHandle', 0.075, -0.011, -0.02);
  b.body();
  // --- Bipod on its barrel clamp (deployed): tube legs, spade feet.
  b.part('bipod', [0, -0.02, -0.82]);
  tube(b, { z0: -0.835, z1: -0.805, rIn: 0.0198, rOut: 0.0255, mat: P, seg: 24 });
  b.extrude({ points: path([[-0.832, -0.03, 1], [-0.808, -0.03, 1], [-0.81, -0.022], [-0.83, -0.022]], 2), width: 0.05, mat: P, bevel: 0.002 });
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.018, -0.03, -0.82], to: [sx * 0.2, -0.33, -0.86], r: 0.0085, r1: 0.0075, mat: P });
    b.extrude({ points: path([[-0.888, -0.338, 1], [-0.832, -0.338, 1], [-0.836, -0.328], [-0.884, -0.328]], 2), width: 0.042, x: sx * 0.203, mat: P, bevel: 0.0015 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2;

  b.anchor('muzzle', 0, 0, -1.662);
  b.anchor('gripR', 0, -0.09, 0.064);
  b.anchor('trigger', 0, -0.054, 0.0);
  b.anchor('gripL', 0, -0.07, 0.144);
  b.anchor('shoulder', 0, -0.045, 0.364);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.13;
  b.meta.boltLift = PI / 2;
}

// RGD-33 stick grenade with the defensive fragmentation sleeve: 190 mm long, head
// 45 mm across and 54 mm over the sleeve (Wikipedia). Sheet-steel head with the
// fuze channel shutter on top; the sleeve's diamond pattern of notched steel, its
// rolled rims and spring latch; the arming collar between head and handle; the
// sheet-steel handle with the safety lever. Painted green, the sleeve dark steel.
// Lengths along the grenade est. from photos. Upright: +Y = head; origin at the
// grip on the handle.
export function rgd33(b) {
  const G = 'sovietGreen';
  // Handle: rolled end, joint with the arming collar.
  latheY(b, { mat: G, seg: 28, profile: [[0, -0.0955], [0.0102, -0.0955], [0.0127, -0.0949], [0.0138, -0.0936], [0.0141, -0.0912], [0.0141, -0.0035], [0.0146, -0.003], [0.0146, 0], [0, 0]] });
  latheY(b, { mat: 'steelDark', seg: 32, profile: [[0, -0.0008], [0.0158, -0.0008], [0.0167, 0.0002], [0.0167, 0.0086], [0.0158, 0.0096], [0, 0.0096]] });
  // Safety lever on the handle, pivoting on a rivet.
  b.box({ x: 0.0146, y: -0.0125, z: 0, w: 0.0016, h: 0.026, d: 0.0072, mat: 'steelDark', r: 0.0006 });
  b.cylAxis({ axis: 'x', x: 0.0152, y: -0.0225, z: 0, len: 0.0012, r: 0.0019, mat: 'steelDark', seg: 10 });
  // Head with the domed top and the shutter over the fuze channel.
  latheY(b, { mat: G, seg: 36, profile: [[0, 0.0096], [0.0225, 0.0096], [0.0225, 0.0862], [0.0222, 0.0886], [0.021, 0.0914], [0.0176, 0.0942], [0.0116, 0.096], [0, 0.0965]] });
  b.box({ x: 0, y: 0.0966, z: 0.002, w: 0.0118, h: 0.0014, d: 0.019, mat: 'steelDark', r: 0.0005 });
  b.cylAxis({ axis: 'y', x: 0, y: 0.0978, z: 0.0085, len: 0.0022, r: 0.0016, mat: 'steelDark', seg: 10 });
  // Sleeve: rolled rims and the diamond lattice between them (faceted pyramids:
  // peaks at the diamonds' centers, the notches between them 1.1 mm deep).
  const Rs = 0.027,
    y0 = 0.0128,
    y1 = 0.0838;
  for (const [ya, yb] of [[y0 - 0.0022, y0], [y1, y1 + 0.0022]]) latheY(b, { mat: 'steelDark', seg: 40, profile: [[0.0226, ya], [0.0268, ya], [0.0274, ya + 0.0006], [0.0274, yb - 0.0006], [0.0268, yb], [0.0226, yb]] });
  if (b.detail(1)) {
    const NI = b.detail(0) ? 48 : 16,
      NJ = b.detail(0) ? 20 : 6;
    const depth = b.detail(0) ? 0.0011 : 0.0004;
    const P = (i, j) => {
      const th = (i / NI) * Math.PI * 2;
      const r = (i + j) % 2 ? Rs - depth : Rs;
      return [Math.cos(th) * r, y0 + ((y1 - y0) * j) / NJ, Math.sin(th) * r];
    };
    const sub3 = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
    const cross3 = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
    const pos = [];
    const tri = (a, c, d) => {
      // Faces outward.
      const n = cross3(sub3(c, a), sub3(d, a));
      const m = [(a[0] + c[0] + d[0]) / 3, 0, (a[2] + c[2] + d[2]) / 3];
      if (n[0] * m[0] + n[2] * m[2] < 0) pos.push(...a, ...d, ...c);
      else pos.push(...a, ...c, ...d);
    };
    for (let j = 0; j < NJ; j++) {
      for (let i = 0; i < NI; i++) {
        const p00 = P(i, j),
          p10 = P(i + 1, j),
          p11 = P(i + 1, j + 1),
          p01 = P(i, j + 1);
        if ((i + j) % 2 === 0) {
          tri(p00, p10, p01);
          tri(p10, p11, p01);
        } else {
          tri(p00, p10, p11);
          tri(p00, p11, p01);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    b._add(geo, 'steelDark');
  } else b.cylAxis({ axis: 'y', y: (y0 + y1) / 2, len: y1 - y0, r: Rs, mat: 'steelDark', seg: 10 });
  // Spring latch holding the sleeve on the head.
  const out = (p) => [p[0], 0, p[2]];
  ribbon(b, { pts: [[0.0278, y0 + 0.011, 0], [0.0282, y0 + 0.003, 0], [0.0266, y0 - 0.0025, 0], [0.0236, y0 - 0.004, 0]], width: 0.0075, thick: 0.0009, face: out, mat: 'steelDark' });

  b.anchor('gripR', 0, -0.04, 0);
  b.anchor('gripL', 0.0152, -0.0125, 0); // safety lever
  b.anchor('pin', 0.0152, -0.0125, 0);
  b.meta.kind = 'grenade';
  b.meta.fuse = 3.5;
}
