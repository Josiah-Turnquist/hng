// US small arms. See kit.js for the coordinate conventions:
// meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at z = 0.
import { S, place, circle, slot, boxMag, guard, trigger, plateXY, lathe, tube, cartridge, swivel, taperZ, path, loft } from './parts.js';
import { stock, band, plateXYz, bar, screw, buttPlate, arch, stockSection, sectionLoft, crisp, stations, superellipse, knurledKnob, sweepGrip, serrations, perfTube, sling, stamp, ribbon, latheY, ringLoft, smoothstep } from './shapes.js';
import { m1cMount, unertl, ring } from './optics.js';

const PI = Math.PI;

// .30-06 Springfield cartridge.
const R3006 = { caseLen: 0.0634, oal: 0.0846, rRim: 0.006, rNeck: 0.0044, rBullet: 0.0039, shoulder: 0.82 };

// M1 Garand: .30-06 gas-operated semi-automatic fed by an 8-round en-bloc clip.
// 1107 mm (43.6 in) long, 610 mm (24 in) barrel, 709 mm (27.9 in) sight radius at
// the 100 yd setting (FM 23-5), 332 mm (13.1 in) from the trigger to the butt
// plate (as issue rifles measure, 13 to 13.25 in).
// Aperture rear sight on the receiver heel (elevation knob left, windage knob
// right), protected blade front sight on the gas cylinder at the muzzle, bayonet
// lug under it, operating rod along the right side, walnut stock with a
// semi-pistol grip and a trap door in the steel butt plate. Parkerized. Positions
// along the rifle est. from side views.
export function m1_garand(b) {
  const P = 'parkerized';
  const W = 'walnut';
  const MZ = -0.775;
  const FS = 0.0285,
    FZ = -0.763; // front sight blade top
  const RS = 0.029,
    RZ = -0.054; // rear aperture
  const BUTT = 0.3198; // where the wood ends (the butt plate's steel to 11 mm behind)

  // --- Barrel: 29 mm over the chamber tapering to 15.7 mm at the gas cylinder (est.).
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0039, MZ + 0.012],
      [0.0039, MZ + 0.0004],
      [0.0047, MZ],
      [0.0074, MZ],
      [0.0079, MZ + 0.001],
      [0.0079, -0.664],
      [0.0088, -0.645],
      [0.0093, -0.58],
      [0.0103, -0.48],
      [0.0113, -0.38],
      [0.0123, -0.3],
      [0.0135, -0.245],
      [0.0145, -0.222],
      [0.0145, -0.204],
      [0, -0.204],
    ],
  });
  b.cyl({ z0: MZ + 0.0125, z1: MZ + 0.0115, r0: 0.004, mat: 'black', seg: 12 });

  // --- Gas cylinder: a ring around the barrel over the cylinder proper, front
  // sight on top, lock and lock screw at the muzzle, bayonet lug underneath.
  const GZ0 = -0.7695,
    GZ1 = -0.668;
  const gasOutline = stockSection({ y0: -0.0275, y1: 0.0113, w: 0.0226, n: 2.2, wTop: 1.0, wBot: 0.86, belly: 0.72 }, b.detail(1) ? 36 : 10);
  plateXYz(b, { outline: gasOutline, holes: [circle(0, 0, 0.0079, b.detail(1) ? 20 : 8)], z0: GZ0, z1: GZ1, mat: P, bevel: 0.001 });
  lathe(b, { mat: P, seg: 28, profile: [[0.0079, MZ + 0.0002], [0.0092, MZ + 0.0002], [0.0101, MZ + 0.0012], [0.0101, GZ0 + 0.0002], [0.0079, GZ0 + 0.0002]] }); // gas cylinder lock
  lathe(b, { mat: P, y: -0.0172, seg: 20, profile: [[0, MZ - 0.0012], [0.0058, MZ - 0.0012], [0.0072, MZ + 0.0002], [0.0072, GZ0 + 0.001], [0.0, GZ0 + 0.001]] }); // lock screw
  if (b.detail(0)) b.box({ x: 0, y: -0.0172, z: MZ - 0.0006, w: 0.011, h: 0.0016, d: 0.0018, mat: 'black', r: 0 });
  b.span({ z0: -0.768, z1: -0.746, y0: -0.0325, y1: -0.025, w: 0.009, mat: P, r: 0.0012 }); // bayonet lug
  // Front sight: seat on the gas cylinder, two protecting ears, flat-topped blade
  // 0.077 in (1.96 mm) wide.
  b.span({ z0: -0.7705, z1: -0.7555, y0: 0.0085, y1: 0.0152, w: 0.0168, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.7702, 0.014], [-0.7558, 0.014], [-0.7575, 0.0302], [-0.7685, 0.0306]], 2), width: 0.0021, x: s * 0.0068, mat: P, bevel: 0.0004 });
  plateXYz(b, { outline: [[-0.00098, 0.0148], [0.00098, 0.0148], [0.00098, FS], [-0.00098, FS]], z0: FZ - 0.003, z1: FZ + 0.003, mat: P, bevel: 0.0002 });
  if (b.detail(0)) screw(b, { at: [0.0084, 0.0118, -0.763], axis: 'x', r: 0.0018, mat: P, slot: 1.57 }); // front sight screw
  b.anchor('frontSight', 0, FS, FZ);

  // --- Front handguard under the barrel, lower band, stock ferrule with swivel.
  stock(b, {
    mat: W,
    z0: -0.666,
    z1: -0.588,
    top: [[-0.666, -0.003], [-0.588, -0.003]],
    bottom: [[-0.666, -0.0295], [-0.6, -0.031], [-0.588, -0.031]],
    width: [[-0.666, 0.0282], [-0.588, 0.03]],
    n: 2.4,
    wTop: 0.95,
    wBot: 0.82,
    belly: 0.62,
    chDepth: 0.0058,
    chHalf: 0.0092,
    rings: 32,
    roundStart: 0.004,
  });
  band(b, { z0: -0.594, z1: -0.577, y0: -0.0332, y1: 0.0118, w: 0.033, n: 2.5, thick: 0.0018, mat: P });
  // --- Stock: walnut, semi-pistol grip, straight comb.
  const stk = stock(b, {
    mat: W,
    z0: -0.574,
    z1: BUTT,
    top: [
      [-0.574, -0.0035],
      [-0.25, -0.0035],
      [-0.205, -0.004],
      [-0.1, -0.0045],
      [-0.03, -0.004],
      [-0.012, 0.0005],
      [0.012, 0.0035],
      [0.06, 0.0005],
      [0.18, -0.016],
      [BUTT, -0.0325],
    ],
    bottom: [
      [-0.574, -0.0312],
      [-0.42, -0.0335],
      [-0.25, -0.036],
      [-0.215, -0.046],
      [-0.19, -0.062],
      [-0.07, -0.0645],
      [0.045, -0.064],
      [0.058, -0.08],
      [0.072, -0.0975],
      [0.09, -0.1035],
      [0.108, -0.0975],
      [0.13, -0.0985],
      [0.22, -0.1355],
      [BUTT, -0.169],
    ],
    width: [
      [-0.574, 0.0322],
      [-0.4, 0.035],
      [-0.25, 0.0372],
      [-0.2, 0.0425],
      [-0.05, 0.0425],
      [0.02, 0.0385],
      [0.07, 0.0355],
      [0.14, 0.0385],
      [0.25, 0.0432],
      [BUTT, 0.0438],
    ],
    n: [
      [-0.5, 2.6],
      [-0.22, 3.0],
      [-0.06, 3.2],
      [0.02, 2.5],
      [0.08, 2.2],
      [0.16, 2.8],
      [0.3, 3.4],
    ],
    wTop: [
      [-0.5, 0.92],
      [-0.06, 0.95],
      [0.04, 0.82],
      [0.12, 0.74],
      [0.3, 0.7],
    ],
    wBot: [
      [-0.5, 0.8],
      [-0.06, 0.9],
      [0.07, 0.86],
      [0.2, 0.8],
      [0.3, 0.8],
    ],
    belly: [
      [-0.5, 0.6],
      [0.0, 0.55],
      [0.1, 0.48],
      [0.3, 0.44],
    ],
    // Channel for the barrel and the operating rod, inletting for the receiver.
    chDepth: [
      [-0.574, 0.0],
      [-0.5, 0.0],
      [-0.235, 0.0],
      [-0.222, 0.0175],
      [-0.03, 0.0175],
      [-0.016, 0.0],
    ],
    chHalf: [
      [-0.235, 0.0148],
      [-0.205, 0.0158],
      [-0.03, 0.0158],
      [-0.016, 0.012],
    ],
  });
  buttPlate(b, stk, { z0: BUTT - 0.003, z1: BUTT + 0.011, mat: P, screws: [-0.045, -0.156] });
  if (b.detail(0)) {
    // Trap door in the butt plate: outline groove and hinge pin.
    const zb = BUTT + 0.0113;
    for (const [y0, y1, w] of [
      [-0.122, -0.06, 0.0012],
      [-0.122, -0.06, 0.0012],
    ])
      for (const s of [-1, 1]) b.box({ x: s * 0.0118, y: (y0 + y1) / 2, z: zb, w, h: y1 - y0, d: 0.0008, mat: 'black', r: 0 });
    for (const y of [-0.122, -0.06]) b.box({ x: 0, y, z: zb, w: 0.0248, h: 0.0012, d: 0.0008, mat: 'black', r: 0 });
    b.cylAxis({ axis: 'x', x: 0, y: -0.058, z: zb + 0.0004, len: 0.022, r: 0.0016, mat: P, seg: 10 });
  }
  // Stock ferrule and front swivel, rear swivel under the butt.
  band(b, { z0: -0.576, z1: -0.562, y0: -0.0335, y1: -0.0012, w: 0.0334, n: 2.8, thick: 0.0014, mat: P });
  b.box({ x: 0, y: -0.0365, z: -0.569, w: 0.006, h: 0.004, d: 0.01, mat: P, r: 0.001 });
  bar(b, { pts: [[0, -0.037, -0.575], [0, -0.0475, -0.569], [0, -0.0525, -0.556], [0, -0.0455, -0.551], [0, -0.038, -0.562]], closed: true, r: 0.0021, mat: P, seg: 8 });
  {
    const zs = 0.205,
      ys = stk.bottom(zs);
    b.box({ x: 0, y: ys - 0.001, z: zs, w: 0.014, h: 0.003, d: 0.03, mat: P, r: 0.001 });
    bar(b, { pts: [[0, ys - 0.002, zs - 0.012], [0, ys - 0.014, zs - 0.006], [0, ys - 0.016, zs + 0.008], [0, ys - 0.006, zs + 0.012]], closed: true, r: 0.0022, mat: P, seg: 8 });
  }

  // --- Rear handguard over the barrel, with its front clip and rear band.
  stock(b, {
    mat: W,
    z0: -0.556,
    z1: -0.236,
    top: [
      [-0.556, 0.0158],
      [-0.4, 0.0185],
      [-0.236, 0.0198],
    ],
    bottom: [
      [-0.556, -0.0028],
      [-0.236, -0.0028],
    ],
    width: [
      [-0.556, 0.0298],
      [-0.236, 0.0316],
    ],
    n: 2.4,
    wTop: 0.45,
    wBot: 1.0,
    belly: 0.18,
    rings: 28,
    roundStart: 0.004,
  });
  band(b, { z0: -0.566, z1: -0.552, y0: -0.0025, y1: 0.0168, w: 0.0302, n: 2.4, thick: 0.0012, mat: P }); // handguard clip
  band(b, { z0: -0.24, z1: -0.228, y0: -0.0035, y1: 0.0205, w: 0.0322, n: 2.5, thick: 0.0014, mat: P }); // rear handguard band

  // --- Receiver: front ring, side rails around the clip well (operating rod rides
  // along the right), heel with the rear sight; clip latch on the left.
  lathe(b, { mat: P, seg: 32, profile: [[0.0145, -0.2045], [0.0152, -0.2045], [0.0159, -0.2035], [0.0159, -0.1765], [0.0152, -0.1755], [0.0095, -0.1755]] });
  if (b.detail(1)) {
    const wallSec = (s, yTop, xo, xi) => {
      const rr = 0.0014;
      const pts = [[s * xo, -0.024, 1]];
      for (let k = 0; k <= 4; k++) {
        const a = (k / 4) * (PI / 2);
        pts.push([s * (xo - rr + Math.cos(a) * rr), yTop - rr + Math.sin(a) * rr, k === 4]);
      }
      pts.push([s * xi, yTop, 1], [s * xi, -0.024, 1]);
      return crisp(pts);
    };
    sectionLoft(b, { zs: [-0.1765, -0.073], section: () => wallSec(-1, 0.0062, 0.0156, 0.0098), mat: P, capStart: false, capEnd: false });
    sectionLoft(b, { zs: [-0.1765, -0.073], section: () => wallSec(1, -0.0028, 0.0156, 0.0098), mat: P, capStart: false, capEnd: false });
  } else {
    b.span({ z0: -0.1765, z1: -0.073, y0: -0.024, y1: 0.002, w: 0.031, mat: P });
  }
  // Heel: rounded block with the sight base, the ears and both knobs.
  b.extrude({ points: path([[-0.0745, -0.026, 1], [-0.0745, 0.0105], [-0.064, 0.0128], [-0.0085, 0.0128], [0.0015, 0.0102], [0.0068, 0.0042], [0.0075, -0.026, 1]]), width: 0.0306, mat: P, bevel: 0.0024 });
  stamp(b, { name: 'garandHeel', at: [0, 0.0128, -0.0205], w: 0.0215, h: 0.0215 });
  // Elevation knob (left) and windage knob (right), knurled, on the sight base.
  knurledKnob(b, { at: [-0.0182, 0.0175, -0.048], axis: 'x', r: 0.0089, len: 0.0062, teeth: 30, depth: 0.0006, mat: P });
  knurledKnob(b, { at: [0.0182, 0.0175, -0.048], axis: 'x', r: 0.0089, len: 0.0062, teeth: 30, depth: 0.0006, mat: P });
  for (const s of [-1, 1]) b.cylAxis({ axis: 'x', x: s * 0.0219, y: 0.0175, z: -0.048, len: 0.0014, r: 0.0042, mat: P, seg: 16 });
  b.span({ z0: -0.064, z1: -0.032, y0: 0.0118, y1: 0.0175, w: 0.0255, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.0475, 0.0168], [-0.0335, 0.0168], [-0.0338, 0.0328], [-0.042, 0.0352], [-0.0472, 0.032]], 2), width: 0.0024, x: s * 0.0081, mat: P, bevel: 0.0005 });
  b.part('rearSight', [0, RS, RZ]);
  plateXYz(b, { outline: superellipse(0, RS - 0.0005, 0.0128, 0.0175, 3.2, b.detail(1) ? 24 : 8), holes: [circle(0, RS, 0.003, b.detail(1) ? 16 : 6)], z0: RZ - 0.0016, z1: RZ + 0.0016, mat: P, bevel: 0.0003 });
  b.span({ z0: RZ - 0.0016, z1: RZ + 0.009, y0: RS - 0.0105, y1: RS - 0.0078, w: 0.0122, mat: P, r: 0.0006 }); // aperture slide
  b.anchor('rearSight', 0, RS, RZ);
  b.body();
  b.meta.sight = 'aperture';
  b.meta.sightKind = 'slide';
  // Clip latch (left) and the bullet guide inside the well.
  b.box({ x: -0.0162, y: -0.004, z: -0.104, w: 0.0026, h: 0.009, d: 0.011, mat: P, r: 0.0012 });
  if (b.detail(0)) b.span({ z0: -0.17, z1: -0.08, y0: -0.024, y1: -0.021, w: 0.0196, mat: 'black', r: 0 });
  b.anchor('ejectionPort', 0.0, 0.016, -0.12);
  b.anchor('clipGuide', 0, 0.016, -0.12);

  // --- Trigger guard with the safety in its front, trigger housing, trigger.
  b.span({ z0: -0.073, z1: 0.056, y0: -0.0695, y1: -0.0605, w: 0.0172, mat: P, r: 0.002 });
  guard(b, { zf: -0.0665, zr: 0.051, yTop: -0.061, yBot: -0.0915, t: 0.0052, w: 0.0112, mat: P, rake: 0.006 });
  b.extrude({ points: S([[-0.0625, -0.0645], [-0.052, -0.0655], [-0.0505, -0.0705], [-0.0535, -0.0778], [-0.0615, -0.0768]], 2), width: 0.0068, mat: P, bevel: 0.0008 }); // safety
  trigger(b, { z: 0, yTop: -0.0655, len: 0.0215, curve: 0.006, mat: P });
  if (b.detail(0)) b.cylAxis({ axis: 'x', x: 0, y: -0.0655, z: 0.004, len: 0.0185, r: 0.0016, mat: P, seg: 10 }); // trigger pin

  // --- Bolt and operating rod (they cycle together). The rod runs from the piston
  // in the gas cylinder back along the right of the barrel to its handle.
  b.part('bolt', [0, 0, -0.072]);
  b.cyl({ z0: -0.176, z1: -0.073, r0: 0.0093, mat: P, seg: 24 }); // parkerized like the rest
  b.box({ x: 0.0078, y: 0.0042, z: -0.108, w: 0.0062, h: 0.0072, d: 0.019, mat: P, r: 0.0012 }); // right lug
  b.cylAxis({ axis: 'x', x: 0.0118, y: 0.0042, z: -0.108, len: 0.0042, r: 0.0031, mat: 'steelBright', seg: 12 }); // roller
  lathe(b, { mat: 'steelBright', seg: 18, profile: [[0, -0.075], [0.0072, -0.075], [0.0074, -0.068], [0.0052, -0.062], [0.0028, -0.06], [0, -0.06]] }); // firing pin tail
  bar(b, {
    pts: [
      [0.0, -0.0172, -0.667],
      [0.003, -0.016, -0.6],
      [0.0105, -0.0125, -0.48],
      [0.0148, -0.0085, -0.32],
      [0.0164, -0.0042, -0.2],
      [0.0168, -0.0025, -0.165],
    ],
    r: 0.0043,
    mat: P,
    seg: 12,
  });
  // Operating rod handle: a plate along the receiver's right with the hump.
  b.extrude({ points: S([[-0.188, -0.0085], [-0.142, -0.0085], [-0.1355, -0.002], [-0.136, 0.0092], [-0.142, 0.0135], [-0.149, 0.0125], [-0.153, 0.003], [-0.188, 0.0015]], 3), width: 0.0062, x: 0.0189, mat: P, bevel: 0.0011 });
  b.cylAxis({ axis: 'x', x: 0.0232, y: 0.0062, z: -0.1435, len: 0.0058, r: 0.0042, mat: P, seg: 14 });
  b.anchor('chargingHandle', 0.026, 0.0062, -0.1435);
  b.body();

  // --- En-bloc clip with 8 rounds, seated in the magazine.
  b.part('clip', [0, -0.03, -0.1]);
  const nRounds = b.detail(0) ? 8 : b.detail(1) ? 2 : 0;
  for (let i = 0; i < nRounds; i++) {
    const cx = (i % 2 ? -1 : 1) * 0.0052;
    cartridge(b, { ...R3006, x: cx, y: -0.0095 - i * 0.0066, zBase: -0.078, seg: 12 });
  }
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.1135, -0.006], [-0.079, -0.006], [-0.079, -0.062], [-0.1135, -0.062]], 1), width: 0.0011, x: s * 0.0119, mat: 'steelBright', bevel: 0.0003 });
  b.span({ z0: -0.08, z1: -0.077, y0: -0.062, y1: -0.006, w: 0.0245, mat: 'steelBright', r: 0.0004 });
  b.body();

  // M1907 leather sling between the swivels under the stock.
  sling(b, { from: [0, -0.052, -0.5615], to: [0, stk.bottom(0.205) - 0.016, 0.205], sag: 0.045, width: 0.031, mat: 'leather', hardware: 'brass' });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.075, 0.076);
  b.anchor('trigger', 0, -0.072, 0.0);
  b.anchor('gripL', 0, -0.031, -0.36);
  b.anchor('shoulder', 0, -0.1, BUTT + 0.0085);
  b.meta.boltThrow = 0.092;
}

// M1C: the sniper Garand of 1944, an M1 with the Griffin & Howe side mount on
// the left of the receiver and a 2.5x Lyman Alaskan (M81 crosshair or M82
// post), offset left so clips still go in from the top and the iron sights stay
// clear; leather cheek pad on the butt (optics.js).
export function m1c_m81(b) {
  m1_garand(b);
  m1cMount(b);
}

export function m1c_m82(b) {
  m1_garand(b);
  m1cMount(b);
}

// .30 Carbine family (M1, M1A1, M2): 904 mm long, 458 mm barrel, short-stroke gas
// piston under the barrel driving the operating slide on the right (charging
// handle at its rear), round-topped receiver with the rotating bolt, cross-bolt
// safety and magazine catch buttons ahead of the guard, front blade between wings,
// barrel band with the sling swivel on the left, walnut stock with the sling slot
// and oiler through the butt. Parkerized. Dimensions est. from photos.
// v: { stock: 'wood' | 'folding', mag: 15 | 30, sight: 'flip' | 'adjustable', lugBand, selector }
function carbine(b, v) {
  const P = 'parkerized';
  const W = 'walnut';
  const MZ = -0.574;
  const FS = 0.0235,
    FZ = -0.5645;
  // --- Barrel.
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0039, MZ + 0.012],
      [0.0039, MZ + 0.0004],
      [0.0046, MZ],
      [0.0072, MZ],
      [0.0078, MZ + 0.001],
      [0.0082, -0.5],
      [0.0088, -0.42],
      [0.0098, -0.3],
      [0.0112, -0.2],
      [0.0118, -0.14],
      [0, -0.14],
    ],
  });
  b.cyl({ z0: MZ + 0.0125, z1: MZ + 0.0115, r0: 0.004, mat: 'black', seg: 12 });
  // --- Front sight: base ring, protecting wings, blade.
  lathe(b, { mat: P, seg: 24, profile: [[0.0078, MZ + 0.0005], [0.0092, MZ + 0.0005], [0.0097, MZ + 0.0025], [0.0097, -0.5545], [0.0092, -0.5525], [0.0078, -0.5525]] });
  b.span({ z0: -0.573, z1: -0.555, y0: 0.0062, y1: 0.0128, w: 0.0142, mat: P, r: 0.0018 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.5725, 0.011], [-0.5555, 0.011], [-0.5585, 0.0262], [-0.5695, 0.0265]], 2), width: 0.0019, x: s * 0.0058, mat: P, bevel: 0.0004 });
  plateXYz(b, { outline: [[-0.001, 0.012], [0.001, 0.012], [0.001, FS], [-0.001, FS]], z0: FZ - 0.0028, z1: FZ + 0.0028, mat: P, bevel: 0.0002 });
  b.anchor('frontSight', 0, FS, FZ);
  // --- Gas cylinder and piston housing under the barrel (ahead of the band).
  b.extrude({ points: path([[-0.405, -0.004, 1], [-0.39, -0.004, 1], [-0.388, -0.0205], [-0.396, -0.0228], [-0.405, -0.02, 1]]), width: 0.0172, mat: P, bevel: 0.0012 });
  // --- Barrel band (left swivel); the M2 band carries the bayonet lug.
  band(b, { z0: -0.384, z1: -0.365, y0: -0.0305, y1: 0.0172, w: 0.0282, n: 2.6, thick: 0.0018, mat: P });
  b.box({ x: -0.0162, y: -0.008, z: -0.3745, w: 0.004, h: 0.009, d: 0.01, mat: P, r: 0.001 });
  bar(b, { pts: [[-0.0178, -0.004, -0.384], [-0.0192, -0.012, -0.387], [-0.0198, -0.019, -0.3745], [-0.0192, -0.012, -0.362], [-0.0178, -0.004, -0.365]], closed: true, r: 0.0019, mat: P, seg: 8 });
  if (v.lugBand) {
    b.span({ z0: -0.392, z1: -0.357, y0: -0.0245, y1: 0.014, w: 0.0322, mat: P, r: 0.004 });
    b.span({ z0: -0.43, z1: -0.385, y0: -0.0245, y1: -0.0125, w: 0.0132, mat: P, r: 0.002 });
    b.span({ z0: -0.445, z1: -0.425, y0: -0.0245, y1: -0.008, w: 0.0102, mat: P, r: 0.002 });
  }
  // --- Handguard over the barrel.
  stock(b, {
    mat: W,
    z0: -0.3815,
    z1: -0.141,
    top: [
      [-0.3815, 0.0138],
      [-0.26, 0.0158],
      [-0.141, 0.0148],
    ],
    bottom: [
      [-0.3815, -0.002],
      [-0.141, -0.002],
    ],
    width: [
      [-0.3815, 0.0252],
      [-0.141, 0.0272],
    ],
    n: 2.3,
    wTop: 0.48,
    wBot: 1.0,
    belly: 0.15,
    rings: 28,
    roundEnd: 0.004,
    roundAnchor: 'bottom',
  });

  // --- Receiver: round top, lower body in the stock; ejection port on the right.
  lathe(b, { mat: P, seg: 32, profile: [[0.0118, -0.1405], [0.0122, -0.1405], [0.0129, -0.1395], [0.0129, 0.0145], [0.0122, 0.016], [0.0, 0.016]] });
  b.span({ z0: -0.14, z1: 0.016, y0: -0.03, y1: -0.002, w: 0.0256, mat: P, r: 0.003 });
  if (b.detail(0)) b.span({ z0: -0.128, z1: -0.062, y0: 0.0018, y1: 0.0102, w: 0.0035, x: 0.0115, mat: 'black', r: 0.0006 }); // ejection port
  b.anchor('ejectionPort', 0.012, 0.01, -0.095);
  if (v.selector) b.cylAxis({ axis: 'x', x: -0.0142, y: -0.001, z: -0.02, len: 0.004, r: 0.0045, mat: P, seg: 14 });
  // --- Trigger housing: guard, magazine catch and cross-bolt safety, trigger.
  b.span({ z0: -0.06, z1: 0.048, y0: -0.0545, y1: -0.03, w: 0.0182, mat: P, r: 0.002 });
  guard(b, { zf: -0.035, zr: 0.046, yTop: -0.052, yBot: -0.0775, t: 0.0042, w: 0.0102, mat: P, rake: 0.004 });
  b.cylAxis({ axis: 'x', x: 0.0098, y: -0.0445, z: -0.0505, len: 0.0045, r: 0.0036, mat: P, seg: 12 }); // magazine catch
  b.cylAxis({ axis: 'x', x: -0.0098, y: -0.0445, z: -0.0385, len: 0.0045, r: 0.0031, mat: P, seg: 12 }); // safety
  trigger(b, { z: 0, yTop: -0.053, len: 0.0185, curve: 0.005, mat: P });

  // --- Rear sight on the receiver's rear.
  if (v.sight === 'adjustable') {
    // Late ramp sight: base with protective ears, aperture slide with windage knob.
    b.span({ z0: -0.03, z1: 0.016, y0: 0.0105, y1: 0.0155, w: 0.0182, mat: P, r: 0.0015 });
    for (const s of [-1, 1]) b.extrude({ points: S([[-0.012, 0.014], [0.012, 0.014], [0.012, 0.0285], [0.004, 0.0298]], 2), width: 0.0021, x: s * 0.0079, mat: P, bevel: 0.0004 });
    knurledKnob(b, { at: [0.0112, 0.0175, -0.004], axis: 'x', r: 0.0052, len: 0.0045, teeth: 16, mat: P });
    b.part('rearSight', [0, 0.024, 0.0]);
    plateXYz(b, { outline: superellipse(0, 0.0215, 0.0102, 0.0145, 4, b.detail(1) ? 20 : 8), holes: [circle(0, 0.024, 0.0025, b.detail(1) ? 14 : 6)], z0: -0.0014, z1: 0.0014, mat: P, bevel: 0.0003 });
    b.span({ z0: -0.003, z1: 0.012, y0: 0.0145, y1: 0.0175, w: 0.0122, mat: P, r: 0.0008 });
    b.anchor('rearSight', 0, 0.024, 0.0);
    b.body();
  } else {
    // Early L-type flip sight (150 / 300 yd apertures): the game raises the
    // aperture straight up between the two settings.
    b.span({ z0: -0.022, z1: 0.014, y0: 0.0105, y1: 0.0155, w: 0.0162, mat: P, r: 0.0015 });
    b.span({ z0: 0.0, z1: 0.012, y0: 0.0145, y1: 0.0175, w: 0.0122, mat: P, r: 0.001 });
    b.part('rearSight', [0, 0.024, 0.0]);
    plateXYz(b, { outline: [[-0.006, 0.0145], [0.006, 0.0145], [0.006, 0.0275], [0.003, 0.0302], [-0.003, 0.0302], [-0.006, 0.0275]], holes: [circle(0, 0.024, 0.0025, b.detail(1) ? 14 : 6)], z0: -0.0013, z1: 0.0013, mat: P, bevel: 0.0003 });
    b.anchor('rearSight', 0, 0.024, 0.0);
    b.body();
  }
  b.meta.sightKind = 'slide';

  // --- Stock.
  if (v.stock === 'wood') {
    // One-piece stock with the semi-pistol grip; sling slot and oiler in the butt.
    const stk = stock(b, {
      mat: W,
      z0: -0.3865,
      z1: 0.3215,
      top: [
        [-0.3865, -0.0035],
        [-0.15, -0.0045],
        [-0.03, -0.0062],
        [0.012, -0.0035],
        [0.026, 0.0062],
        [0.07, 0.0035],
        [0.2, -0.0135],
        [0.3215, -0.0298],
      ],
      bottom: [
        [-0.3865, -0.0248],
        [-0.25, -0.0272],
        [-0.165, -0.0305],
        [-0.13, -0.046],
        [-0.06, -0.0505],
        [0.045, -0.0505],
        [0.056, -0.067],
        [0.07, -0.0835],
        [0.088, -0.0915],
        [0.108, -0.0848],
        [0.132, -0.0865],
        [0.22, -0.1162],
        [0.3215, -0.148],
      ],
      width: [
        [-0.3865, 0.0262],
        [-0.2, 0.0292],
        [-0.12, 0.0322],
        [0.0, 0.0322],
        [0.07, 0.0292],
        [0.14, 0.0312],
        [0.3215, 0.0382],
      ],
      n: [
        [-0.3, 2.5],
        [-0.12, 2.9],
        [0.02, 2.6],
        [0.08, 2.2],
        [0.18, 2.8],
        [0.31, 3.3],
      ],
      wTop: [
        [-0.3, 0.92],
        [0.0, 0.9],
        [0.12, 0.76],
        [0.31, 0.72],
      ],
      wBot: [
        [-0.3, 0.8],
        [0.07, 0.84],
        [0.31, 0.8],
      ],
      belly: 0.52,
      chDepth: [
        [-0.155, 0.0],
        [-0.14, 0.014],
        [0.014, 0.014],
        [0.022, 0.0],
      ],
      chHalf: 0.0128,
      roundStart: 0.003,
    });
    // Sling slot through the butt with the oiler at its rear end.
    const zS = 0.195,
      yS = -0.074;
    const hs = stk.halfWidth(zS, yS);
    b.extrude({ points: slot(zS - 0.023, zS + 0.023, yS, 0.0068), width: 2 * hs + 0.0006, mat: 'black', bevel: 0.0002 });
    b.cylAxis({ axis: 'x', x: 0, y: yS, z: zS + 0.0165, len: 2 * hs + 0.0016, r: 0.0058, mat: P, seg: 16 }); // oiler
    buttPlate(b, stk, { z0: 0.3185, z1: 0.329, mat: P, screws: [-0.036, -0.139] });
    // M1 web sling from the band swivel (left) through the butt slot.
    sling(b, { from: [-0.0215, -0.019, -0.3745], to: [-0.0232, yS, zS], sag: 0.05, width: 0.025, mat: 'webbing' });
    if (b.detail(0)) for (let i = 0; i < 12; i++) b.box({ x: 0, y: -0.04 - i * 0.0085, z: 0.3293, w: 0.026, h: 0.0012, d: 0.0006, mat: 'black', r: 0 }); // grooved butt plate
    b.anchor('shoulder', 0, -0.088, 0.328);
  } else {
    // M1A1: wooden fore-end and pistol grip, folding wire stock (folds left).
    stock(b, {
      mat: W,
      z0: -0.3865,
      z1: 0.05,
      top: [
        [-0.3865, -0.0035],
        [-0.03, -0.0062],
        [0.03, -0.006],
        [0.05, -0.008],
      ],
      bottom: [
        [-0.3865, -0.0248],
        [-0.165, -0.0305],
        [-0.13, -0.046],
        [-0.06, -0.0505],
        [0.05, -0.0505],
      ],
      width: [
        [-0.3865, 0.0262],
        [-0.12, 0.0322],
        [0.05, 0.0322],
      ],
      n: 2.7,
      wTop: 0.92,
      wBot: 0.82,
      belly: 0.52,
      chDepth: [
        [-0.155, 0.0],
        [-0.14, 0.014],
        [0.014, 0.014],
        [0.022, 0.0],
      ],
      chHalf: 0.0128,
      roundStart: 0.003,
      roundEnd: 0.004,
    });
    sweepGrip(b, {
      path: [
        [0.052, -0.04],
        [0.068, -0.07],
        [0.088, -0.108],
        [0.096, -0.122],
      ],
      sections: (t) => ({ w: 0.0292 + 0.002 * Math.sin(PI * t), f: 0.0145 + 0.002 * Math.sin(PI * t), r: 0.0165 + 0.0015 * t, n: 2.5 }),
      mat: W,
      dome: 0.1,
    });
    b.cylAxis({ axis: 'x', x: 0, y: -0.022, z: 0.09, len: 0.036, r: 0.006, mat: P, seg: 16 }); // hinge
    b.part('stock', [0, -0.022, 0.09]);
    bar(b, { pts: [[0, -0.015, 0.09], [0, -0.022, 0.2], [0, -0.03, 0.323]], r: 0.0055, mat: P, seg: 12 });
    bar(b, { pts: [[0, -0.03, 0.098], [0, -0.075, 0.2], [0, -0.125, 0.318]], r: 0.0055, mat: P, seg: 12 });
    b.extrude({ points: S([[0.15, -0.012], [0.27, -0.019], [0.27, -0.042], [0.15, -0.032]]), width: 0.03, mat: 'leather', bevel: 0.006 }); // cheek pad
    b.extrude({ points: S([[0.312, -0.022], [0.326, -0.024], [0.328, -0.08], [0.324, -0.138], [0.31, -0.136], [0.316, -0.08]]), width: 0.036, mat: P, bevel: 0.003 });
    b.body();
    b.anchor('shoulder', 0, -0.08, 0.328);
    b.meta.stockFold = { axis: 'y', angle: -PI }; // swings to the left side
    b.meta.gripRake = 0.49; // grip axis from vertical (rad)
  }

  // --- Operating slide with the charging handle, and the bolt (cycle together).
  b.part('bolt', [0, 0, -0.06]);
  b.cyl({ z0: -0.118, z1: -0.06, r0: 0.0068, x: 0.0045, y: 0.006, mat: P, seg: 18 });
  b.box({ x: 0.0095, y: 0.0068, z: -0.088, w: 0.0045, h: 0.0062, d: 0.012, mat: P, r: 0.0008 }); // bolt lug
  bar(b, { pts: [[0.0062, -0.0135, -0.29], [0.011, -0.009, -0.2], [0.0135, -0.0045, -0.14]], r: 0.0033, mat: P, seg: 10 });
  b.span({ z0: -0.14, z1: -0.064, y0: -0.008, y1: 0.002, w: 0.005, x: 0.0145, mat: P, r: 0.0012 });
  b.extrude({ points: S([[-0.078, -0.006], [-0.06, -0.006], [-0.057, 0.0], [-0.06, 0.004], [-0.078, 0.004]], 2), width: 0.008, x: 0.019, mat: P, bevel: 0.001 });
  knurledKnob(b, { at: [0.0255, -0.001, -0.068], axis: 'x', r: 0.0045, len: 0.009, teeth: 16, mat: P });
  b.anchor('chargingHandle', 0.029, -0.001, -0.068);
  b.body();

  // --- Magazine: 15-round straight or 30-round curved.
  const top = [-0.0915, -0.01];
  b.part('mag', [0, top[1], top[0]]);
  if (v.mag === 30) boxMag(b, { top, len: 0.17, depth: 0.046, width: 0.0158, angle: 0.02, k: 1.9, mat: P, plate: 0.005 });
  else boxMag(b, { top, len: 0.095, depth: 0.046, width: 0.0158, angle: 0.02, mat: P, plate: 0.005 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.066, 0.075);
  b.anchor('trigger', 0, -0.061, 0.0);
  b.anchor('gripL', 0, -0.03, -0.26);
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.056;
}

// M1 Carbine: 15-round magazine, L-type flip rear sight, early barrel band.
export function m1_carbine(b) {
  carbine(b, { stock: 'wood', mag: 15, sight: 'flip' });
}

// M1A1 Carbine (paratrooper): folding wire stock with leather cheek pad.
export function m1a1_carbine(b) {
  carbine(b, { stock: 'folding', mag: 15, sight: 'flip' });
}

// M2 Carbine: select fire, 30-round curved magazine, adjustable rear sight,
// barrel band with bayonet lug.
export function m2_carbine(b) {
  carbine(b, { stock: 'wood', mag: 30, sight: 'adjustable', lugBand: true, selector: true });
}

// Springfield M1903 family: Mauser-type bolt action, .30-06, 1097 mm long, 610 mm
// barrel. M1905 leaf rear sight on the barrel (battle sight notch with the leaf
// down), blade front sight on a movable stud, upper band with the bayonet lug and
// stacking swivel, lower band with the sling swivel, magazine cutoff on the left of
// the receiver, flag safety on the bolt sleeve, knurled cocking piece, checkered
// butt plate. v.scope = M1903A4: no iron sights, Weaver 330C (M73B1) 2.75x scope on
// a Redfield Junior mount, bent bolt handle, C-type pistol grip stock. v.cStock =
// M1903A1: the C-type pistol grip stock with the iron sights and straight handle.
// Parkerized (wartime). Dimensions est. from photos.
function springfield(b, v) {
  const P = 'parkerized';
  const W = 'walnut';
  const A4 = !!v.scope;
  const cStock = A4 || !!v.cStock;
  const MZ = -0.777;
  // --- Barrel.
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0039, MZ + 0.012],
      [0.0039, MZ + 0.0004],
      [0.0047, MZ],
      [0.0082, MZ],
      [0.0088, MZ + 0.001],
      [0.0094, -0.65],
      [0.0104, -0.52],
      [0.0118, -0.4],
      [0.0132, -0.31],
      [0.0145, -0.215],
      [0.0145, -0.205],
      [0, -0.205],
    ],
  });
  b.cyl({ z0: MZ + 0.0125, z1: MZ + 0.0115, r0: 0.004, mat: 'black', seg: 12 });
  if (!A4) {
    // Front sight: fixed stud on the barrel, movable stud with the blade.
    lathe(b, { mat: P, seg: 24, profile: [[0.0088, -0.7765], [0.0104, -0.7765], [0.0108, -0.775], [0.0108, -0.7535], [0.0104, -0.752], [0.0088, -0.752]] });
    b.span({ z0: -0.776, z1: -0.752, y0: 0.006, y1: 0.0125, w: 0.0122, mat: P, r: 0.0018 });
    b.span({ z0: -0.771, z1: -0.757, y0: 0.0115, y1: 0.0145, w: 0.0092, mat: P, r: 0.001 });
    plateXYz(b, { outline: [[-0.001, 0.014], [0.001, 0.014], [0.001, 0.0215], [-0.001, 0.0215]], z0: -0.768, z1: -0.76, mat: P, bevel: 0.0002 });
    b.anchor('frontSight', 0, 0.0215, -0.764);
  }
  // --- Upper band with the bayonet lug and the stacking swivel (left), lower band
  // with the sling swivel.
  band(b, { z0: -0.692, z1: -0.656, y0: -0.0295, y1: 0.0158, w: 0.0302, n: 2.6, thick: 0.0018, mat: P });
  b.span({ z0: -0.712, z1: -0.688, y0: -0.0305, y1: -0.0195, w: 0.0102, mat: P, r: 0.0015 });
  b.box({ x: -0.0172, y: -0.006, z: -0.68, w: 0.0042, h: 0.01, d: 0.012, mat: P, r: 0.001 });
  bar(b, { pts: [[-0.0185, 0.0, -0.687], [-0.0205, 0.009, -0.684], [-0.021, 0.014, -0.676], [-0.0205, 0.009, -0.668], [-0.0185, 0.0, -0.673]], closed: true, r: 0.0019, mat: P, seg: 8 });
  band(b, { z0: -0.531, z1: -0.517, y0: -0.0332, y1: 0.0172, w: 0.0322, n: 2.6, thick: 0.0016, mat: P });
  b.box({ x: 0, y: -0.0365, z: -0.524, w: 0.006, h: 0.004, d: 0.01, mat: P, r: 0.001 });
  bar(b, { pts: [[0, -0.037, -0.531], [0, -0.0475, -0.526], [0, -0.0525, -0.513], [0, -0.0455, -0.508], [0, -0.038, -0.518]], closed: true, r: 0.0021, mat: P, seg: 8 });

  // --- Stock: straight grip (M1903) or C-type pistol grip (A1, A4).
  const grip = cStock
    ? [
        [0.045, -0.054],
        [0.058, -0.074],
        [0.072, -0.0935],
        [0.09, -0.1015],
        [0.11, -0.0955],
        [0.13, -0.0975],
      ]
    : [
        [0.045, -0.054],
        [0.07, -0.066],
        [0.1, -0.077],
        [0.15, -0.098],
      ];
  const stk = stock(b, {
    mat: W,
    z0: -0.6915,
    z1: 0.3135,
    top: [
      [-0.6915, -0.0035],
      [-0.33, -0.0035],
      [-0.3, 0.0012],
      [-0.205, 0.0015],
      [-0.16, -0.003],
      [-0.06, -0.0045],
      [0.008, -0.0055],
      [0.03, -0.001],
      [0.1, -0.0085],
      [0.3135, -0.0435],
    ],
    bottom: [
      [-0.6915, -0.0262],
      [-0.5, -0.0302],
      [-0.33, -0.0338],
      [-0.27, -0.0352],
      [-0.2, -0.04],
      [-0.165, -0.0505],
      [-0.06, -0.0515],
      ...grip,
      [0.22, -0.1318],
      [0.3135, -0.1675],
    ],
    width: [
      [-0.6915, 0.0292],
      [-0.4, 0.0322],
      [-0.25, 0.0352],
      [-0.2, 0.0402],
      [-0.06, 0.0402],
      [0.02, 0.0362],
      [0.08, 0.0322],
      [0.16, 0.0362],
      [0.3135, 0.0422],
    ],
    n: [
      [-0.5, 2.4],
      [-0.25, 2.7],
      [-0.08, 3.0],
      [0.04, 2.4],
      [0.09, 2.15],
      [0.18, 2.8],
      [0.3, 3.3],
    ],
    wTop: [
      [-0.5, 0.94],
      [-0.08, 0.95],
      [0.05, 0.86],
      [0.13, 0.76],
      [0.3, 0.7],
    ],
    wBot: [
      [-0.5, 0.76],
      [-0.08, 0.86],
      [0.07, 0.82],
      [0.3, 0.8],
    ],
    belly: [
      [-0.5, 0.58],
      [0.0, 0.54],
      [0.3, 0.45],
    ],
    chDepth: [
      [-0.33, 0.0],
      [-0.318, 0.0165],
      [-0.205, 0.0175],
      [-0.19, 0.0195],
      [-0.06, 0.0195],
      [-0.05, 0.0],
    ],
    chHalf: [
      [-0.33, 0.0135],
      [-0.31, 0.0148],
      [-0.205, 0.0148],
      [-0.19, 0.0172],
      [-0.06, 0.0172],
      [-0.05, 0.013],
    ],
    roundStart: 0.003,
  });
  buttPlate(b, stk, { z0: 0.3105, z1: 0.3215, mat: P, screws: [-0.058, -0.152] });
  if (b.detail(0)) {
    // Checkering on the butt plate: a grid of fine grooves.
    for (let i = 0; i < 9; i++) b.box({ x: 0, y: -0.07 - i * 0.008, z: 0.3218, w: 0.03, h: 0.0009, d: 0.0006, mat: 'black', r: 0 });
    for (let i = -3; i <= 3; i++) b.box({ x: i * 0.0042, y: -0.102, z: 0.3218, w: 0.0009, h: 0.066, d: 0.0006, mat: 'black', r: 0 });
  }
  {
    const zs = 0.21,
      ys = stk.bottom(0.21);
    b.box({ x: 0, y: ys - 0.001, z: zs, w: 0.014, h: 0.003, d: 0.03, mat: P, r: 0.001 });
    bar(b, { pts: [[0, ys - 0.002, zs - 0.012], [0, ys - 0.014, zs - 0.006], [0, ys - 0.016, zs + 0.008], [0, ys - 0.006, zs + 0.012]], closed: true, r: 0.0022, mat: P, seg: 8 });
  }
  // Handguard from the rear sight to the upper band.
  stock(b, {
    mat: W,
    z0: -0.658,
    z1: -0.308,
    top: [
      [-0.658, 0.0148],
      [-0.48, 0.0178],
      [-0.308, 0.0192],
    ],
    bottom: [
      [-0.658, -0.003],
      [-0.308, -0.003],
    ],
    width: [
      [-0.658, 0.0262],
      [-0.308, 0.0288],
    ],
    n: 2.3,
    wTop: 0.44,
    wBot: 1.0,
    belly: 0.14,
    rings: 28,
    roundEnd: 0.005,
    roundAnchor: 'bottom',
  });

  // --- Receiver: ring, walls (thumb cut on the left), bridge with the clip guide,
  // tang, magazine cutoff on the left.
  lathe(b, { mat: P, seg: 32, profile: [[0.0145, -0.2055], [0.016, -0.2055], [0.0168, -0.2045], [0.0168, -0.1605], [0.016, -0.159], [0.0098, -0.159]] });
  if (b.detail(1)) {
    const RW = 0.0155,
      RR = 0.0092,
      MW = 0.007,
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
    const thumb = (z) => {
      const u = (z + 0.13) / 0.015;
      return Math.abs(u) < 1 ? 0.0064 * Math.sqrt(1 - u * u) : 0;
    };
    sectionLoft(b, { zs: stations(-0.1605, -0.0885, b.detail(0) ? 0.003 : 0.01), section: (z) => wall(-1, 0.0098 - thumb(z)), mat: P, capStart: false, capEnd: false });
    sectionLoft(b, { zs: [-0.1605, -0.0885], section: () => wall(1, 0.0028), mat: P, capStart: false, capEnd: false });
  } else b.span({ z0: -0.1605, z1: -0.0885, y0: -0.02, y1: 0.005, w: 0.031, mat: P });
  if (b.detail(0)) {
    b.span({ z0: -0.159, z1: -0.09, y0: -0.0215, y1: -0.0195, w: 0.014, mat: 'black', r: 0 });
    cartridge(b, { ...R3006, x: -0.0035, y: -0.0142, zBase: -0.09, seg: 12 });
  }
  lathe(b, { mat: P, seg: 32, profile: [[0.0095, -0.0895], [0.0152, -0.0895], [0.016, -0.0883], [0.016, -0.0602], [0.0152, -0.059], [0.0095, -0.059]] });
  for (const s of [-1, 1]) {
    plateXYz(b, { outline: [[s * 0.0049, 0.0118], [s * 0.0096, 0.0118], [s * 0.0094, 0.0222], [s * 0.006, 0.0226], [s * 0.0056, 0.0212], [s * 0.0049, 0.0212]], z0: -0.0895, z1: -0.0795, mat: P, bevel: 0.0004 });
  }
  b.anchor('clipGuide', 0, 0.024, -0.084);
  b.anchor('ejectionPort', 0.012, 0.012, -0.125);
  // Magazine cutoff lever on the left of the receiver ("ON / OFF").
  b.extrude({ points: S([[-0.112, -0.004], [-0.094, -0.0045], [-0.09, -0.0015], [-0.094, 0.002], [-0.112, 0.0018]], 2), width: 0.0028, x: -0.0168, mat: P, bevel: 0.0006 });
  b.box({ x: -0.0178, y: 0.0035, z: -0.1105, w: 0.0035, h: 0.006, d: 0.008, mat: P, r: 0.0012 });
  // Tang inletted in the wrist.
  if (b.detail(1)) {
    const zt0 = -0.059,
      zt1 = 0.034;
    sectionLoft(b, {
      zs: stations(zt0, zt1, b.detail(0) ? 0.004 : 0.02, [zt1 - 0.002, zt1 - 0.0045]),
      mat: P,
      section: (z) => {
        const end = (z - (zt1 - 0.007)) / 0.007;
        const w = 0.0132 * (end > 0 ? Math.sqrt(Math.max(0.02, 1 - end * end)) : 1);
        return superellipse(0, stk.top(z) + 0.0006 - 0.0016, w, 0.0032, 4, b.detail(0) ? 16 : 8);
      },
    });
  }
  // Floor plate, trigger guard, trigger.
  b.extrude({ points: path([[-0.161, -0.0495], [-0.155, -0.0545], [-0.062, -0.0545, 1], [-0.056, -0.0495, 1]]), width: 0.0262, mat: P, bevel: 0.0012 });
  screw(b, { at: [0, -0.0545, -0.152], axis: '-y', r: 0.0034, h: 0.001, mat: P, slot: 0 });
  guard(b, { zf: -0.0545, zr: 0.052, yTop: -0.0505, yBot: -0.0785, t: 0.0047, w: 0.0118, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.0505, len: 0.022, curve: 0.007, mat: P });

  if (!A4) {
    // M1905 rear sight: base ring on the barrel, leaf hinged at the front lying back
    // along the base (battle sight notch at its rear end), windage knob.
    lathe(b, { mat: P, seg: 28, profile: [[0.0132, -0.3035], [0.0158, -0.3035], [0.0165, -0.301], [0.0165, -0.259], [0.0158, -0.2565], [0.0138, -0.2565]] });
    b.span({ z0: -0.302, z1: -0.214, y0: 0.008, y1: 0.0158, w: 0.0222, mat: P, r: 0.002 });
    knurledKnob(b, { at: [0.0128, 0.012, -0.244], axis: 'x', r: 0.0045, len: 0.0042, teeth: 14, mat: P });
    b.cylAxis({ axis: 'x', x: 0, y: 0.017, z: -0.296, len: 0.016, r: 0.0016, mat: P, seg: 10 });
    b.part('rearSight', [0, 0.017, -0.296]);
    b.span({ z0: -0.298, z1: -0.214, y0: 0.0155, y1: 0.0185, w: 0.0132, mat: P, r: 0.0008 });
    b.span({ z0: -0.236, z1: -0.224, y0: 0.0175, y1: 0.0205, w: 0.0162, mat: P, r: 0.0008 }); // slide
    plateXYz(b, { outline: [[-0.0062, 0.017], [0.0062, 0.017], [0.0062, 0.0245], [0.0014, 0.0245], [0.0014, 0.0213], [-0.0014, 0.0213], [-0.0014, 0.0245], [-0.0062, 0.0245]], z0: -0.2185, z1: -0.2145, mat: P, bevel: 0.0003 });
    if (b.detail(0)) for (let i = 0; i < 16; i++) b.box({ x: i % 2 ? 0.003 : 0, y: 0.01855, z: -0.29 + i * 0.0042, w: i % 2 ? 0.006 : 0.01, h: 0.0002, d: 0.00045, mat: 'black', r: 0 });
    b.anchor('rearSight', 0, 0.0215, -0.2165);
    b.body();
    b.meta.sight = 'notch';
    b.meta.sightKind = 'leaf';
  } else {
    // Redfield Junior base and rings, Weaver 330C (M73B1) 2.75x scope.
    const yc = 0.0375;
    b.span({ z0: -0.198, z1: -0.066, y0: 0.0158, y1: 0.0235, w: 0.0172, mat: 'steel', r: 0.002 });
    for (const [z, wide] of [
      [-0.183, 0],
      [-0.081, 1],
    ]) {
      tube(b, { y: yc, z0: z - 0.009, z1: z + 0.009, rIn: 0.0096, rOut: 0.0128, mat: 'steel', seg: 24 });
      b.span({ z0: z - 0.009, z1: z + 0.009, y0: 0.022, y1: yc - 0.008, w: 0.0132, mat: 'steel', r: 0.002 });
      if (wide) for (const s of [-1, 1]) knurledKnob(b, { at: [s * 0.0128, 0.0245, z], axis: 'x', r: 0.0034, len: 0.008, teeth: 12, mat: 'steel' }); // windage screws
    }
    lathe(b, {
      mat: 'steel',
      y: yc,
      seg: 28,
      profile: [
        [0, 0.012],
        [0.0118, 0.012],
        [0.0126, 0.008],
        [0.0126, -0.026],
        [0.0098, -0.04],
        [0.0096, -0.25],
        [0.0108, -0.258],
        [0.0108, -0.272],
        [0, -0.272],
      ],
    });
    knurledKnob(b, { at: [0, yc + 0.0125, -0.133], axis: 'y', r: 0.0072, len: 0.01, teeth: 20, mat: 'steel' }); // elevation
    knurledKnob(b, { at: [0.0125, yc, -0.133], axis: 'x', r: 0.0072, len: 0.01, teeth: 20, mat: 'steel' }); // windage
    b.cylAxis({ axis: 'z', x: 0, y: yc, z: 0.0121, len: 0.0006, r: 0.0105, mat: 'glass' });
    b.cylAxis({ axis: 'z', x: 0, y: yc, z: -0.2722, len: 0.0006, r: 0.0094, mat: 'glass' });
    b.anchor('scopeEye', 0, yc, 0.0122);
    b.anchor('scopeFront', 0, yc, -0.2722);
    b.meta.sight = 'scope';
    b.meta.scopeMag = 2.75;
  }

  // --- Bolt with the shroud, flag safety and knurled cocking piece; straight
  // handle, or bent for the A4.
  b.part('bolt', [0, 0, 0.016]);
  b.cyl({ z0: -0.167, z1: -0.056, r0: 0.0094, mat: 'steelBright', seg: 28 });
  b.cyl({ z0: -0.064, z1: -0.054, r0: 0.0104, mat: 'steelBright', seg: 28 }); // handle root
  lathe(b, { mat: P, seg: 28, profile: [[0, -0.056], [0.0108, -0.056], [0.0116, -0.0535], [0.0116, -0.012], [0.0108, -0.0065], [0.0078, -0.0045], [0, -0.0045]] });
  b.cylAxis({ axis: 'y', x: 0, y: 0.0118, z: -0.03, len: 0.0035, r: 0.0042, mat: P, seg: 14 });
  b.extrude({ points: S([[-0.0365, 0.0], [-0.0245, 0.0], [-0.023, 0.0055], [-0.0265, 0.0108], [-0.0345, 0.0108], [-0.038, 0.0055]], 3), width: 0.0024, x: 0.0068, mat: P, bevel: 0.0005 }); // safety wing
  knurledKnob(b, { at: [0, 0, 0.0015], axis: 'z', r: 0.0088, len: 0.011, teeth: 24, mat: P }); // cocking piece knob
  if (A4) {
    bar(b, { pts: [[0.008, -0.0005, -0.06], [0.026, -0.0085, -0.058], [0.034, -0.025, -0.051], [0.0355, -0.033, -0.047]], r: [[0, 0.0048], [1, 0.0039]], mat: 'steelBright', seg: 14 });
    b.sphere({ x: 0.037, y: -0.037, z: -0.044, r: 0.0085, mat: 'steelBright', seg: 20 });
    b.anchor('boltHandle', 0.037, -0.037, -0.044);
  } else {
    bar(b, { pts: [[0.008, -0.0005, -0.06], [0.026, -0.0055, -0.0585], [0.042, -0.0135, -0.0545]], r: [[0, 0.0048], [1, 0.0038]], mat: 'steelBright', seg: 14 });
    b.sphere({ x: 0.05, y: -0.017, z: -0.052, r: 0.0088, mat: 'steelBright', seg: 20 });
    b.anchor('boltHandle', 0.05, -0.017, -0.052);
  }
  b.body();

  sling(b, { from: [0, -0.0525, -0.5185], to: [0, stk.bottom(0.21) - 0.016, 0.21], sag: 0.045, width: 0.031, mat: 'leather', hardware: 'brass' });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.058, 0.08);
  b.anchor('trigger', 0, -0.06, 0.0);
  b.anchor('gripL', 0, -0.03, -0.38);
  b.anchor('shoulder', 0, -0.105, 0.318);
  b.meta.boltThrow = 0.09;
  b.meta.boltLift = PI / 2;
}

// Springfield M1903: straight-grip stock, M1905 leaf rear sight on the barrel.
export function m1903(b) {
  springfield(b, {});
}

// M1903A4 sniper: Weaver 330C (M73B1) 2.75x scope, Redfield Junior mount, no iron sights.
export function m1903a4(b) {
  springfield(b, { scope: true });
}

// M1903A1 with the Marine Corps' Unertl 8x target scope: the blocks are
// dovetailed onto the receiver ring and the barrel 7.2 in (183 mm) apart, the
// rear mount carries the micrometer knobs (elevation on top, windage on the
// right), and the scope slides in both rings, pulled back by hand after each
// shot. Mounted high enough for the straight bolt handle. Heights est.
export function m1903a1_unertl(b) {
  springfield(b, { cStock: true });
  const P = 'parkerized';
  const yc = 0.054;
  const r = 0.0095;
  const zR = -0.182,
    zF = zR - 0.183;
  for (const [z, y0] of [
    [zR, 0.0152],
    [zF, 0.0158],
  ]) {
    b.span({ z0: z - 0.0105, z1: z + 0.0105, y0, y1: 0.0232, w: 0.0142, mat: P, r: 0.0012 }); // block
    b.span({ z0: z - 0.0085, z1: z + 0.0085, y0: 0.0232, y1: 0.0268, w: 0.0172, mat: P, r: 0.0008 }); // dovetail foot
    b.span({ z0: z - 0.0055, z1: z + 0.0055, y0: 0.0262, y1: yc - r, w: 0.0092, mat: P, r: 0.0015 }); // upright
    ring(b, { y: yc, z, r, w: 0.012, t: 0.0035, mat: P });
  }
  // Micrometer knobs on the rear mount.
  knurledKnob(b, { at: [0, yc + r + 0.0095, zR], axis: 'y', r: 0.0078, len: 0.009, teeth: 32, mat: P });
  b.cylAxis({ axis: 'y', x: 0, y: yc + r + 0.003, z: zR, len: 0.006, r: 0.0042, mat: P, seg: 14 });
  knurledKnob(b, { at: [0.0175, yc - 0.004, zR], axis: 'x', r: 0.0072, len: 0.008, teeth: 30, mat: P });
  b.cylAxis({ axis: 'x', x: 0.011, y: yc - 0.004, z: zR, len: 0.006, r: 0.004, mat: P, seg: 14 });
  unertl(b, { y: yc, zEye: -0.004 });
}

// Thompson M1A1: .45 ACP blowback SMG, 813 mm long, 267 mm plain barrel (no
// compensator or fins on the M1A1), milled receiver with the cocking knob and
// ejection port on the right, fixed protected peep rear sight (100 yd), fire
// selector and safety rockers on the left of the frame, horizontal walnut fore-end,
// walnut grip and butt with a trap door in the butt plate, sling swivels on the
// left, 30-round stick magazine. Parkerized. Dimensions est. from side views.
export function thompson_m1a1(b) {
  const P = 'parkerized';
  const W = 'walnut';
  const MZ = -0.465;
  const FS = 0.0352,
    FZ = -0.4535; // front blade top
  const RS = 0.0352,
    RZ = 0.052; // rear peep

  // --- Barrel (plain) and the front sight with protecting ears.
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0058, MZ + 0.01],
      [0.0058, MZ + 0.0004],
      [0.0066, MZ],
      [0.0088, MZ],
      [0.0093, MZ + 0.001],
      [0.0095, -0.36],
      [0.0103, -0.25],
      [0.0108, -0.212],
      [0.0122, -0.208],
      [0.0122, -0.2],
      [0, -0.2],
    ],
  });
  b.cyl({ z0: MZ + 0.0105, z1: MZ + 0.0095, r0: 0.0059, mat: 'black', seg: 12 });
  lathe(b, { mat: P, seg: 24, profile: [[0.0093, -0.463], [0.0108, -0.463], [0.0112, -0.461], [0.0112, -0.445], [0.0108, -0.443], [0.0093, -0.443]] });
  b.span({ z0: -0.462, z1: -0.444, y0: 0.0085, y1: 0.0145, w: 0.0092, mat: P, r: 0.0012 });
  plateXYz(b, { outline: [[-0.0012, 0.0138], [0.0012, 0.0138], [0.0012, FS - 0.0004], [0.0008, FS], [-0.0008, FS], [-0.0012, FS - 0.0004]], z0: FZ - 0.004, z1: FZ + 0.004, mat: P, bevel: 0.0002 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.4615, 0.0125], [-0.4455, 0.0125], [-0.4475, 0.0368], [-0.4598, 0.0372]], 2), width: 0.0018, x: s * 0.0062, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, FS, FZ);

  // --- Receiver: milled block with a rounded top; ejection port and cocking slot
  // on the right; rear sight on top at the back.
  const RX0 = -0.2055,
    RX1 = 0.071;
  if (b.detail(1)) {
    const recv = (z) => {
      const pts = [];
      const hw = 0.0162,
        yb = -0.0195,
        yt = 0.0238,
        rt = 0.0092,
        rb = 0.002;
      const K = b.detail(0) ? 7 : 3;
      pts.push([0, yb]);
      for (let k = 0; k <= K; k++) {
        const a = -PI / 2 + (k / K) * (PI / 2);
        pts.push([hw - rb + Math.cos(a) * rb, yb + rb + Math.sin(a) * rb]);
      }
      for (let k = 0; k <= K * 2; k++) {
        const a = (k / (K * 2)) * (PI / 2);
        pts.push([hw - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]);
      }
      const half = pts.slice(1);
      const left = half.map(([x, y]) => [-x, y]).reverse();
      return [...pts, ...left];
    };
    sectionLoft(b, { zs: [RX0, RX0 + 0.0015, RX1 - 0.0015, RX1], section: (z) => (z === RX0 || z === RX1 ? recv(z).map(([x, y]) => [x * 0.94, y * 0.96 + 0.0002]) : recv(z)), mat: P });
  } else {
    b.span({ z0: RX0, z1: RX1, y0: -0.0195, y1: 0.0238, w: 0.0324, mat: P });
  }
  if (b.detail(0)) {
    // Ejection port (with the bolt face showing through) and the cocking slot.
    b.box({ x: 0.0159, y: 0.0062, z: -0.098, w: 0.0016, h: 0.0185, d: 0.052, mat: 'black', r: 0.0006 });
    b.box({ x: 0.0164, y: 0.0062, z: -0.098, w: 0.0008, h: 0.0145, d: 0.046, mat: 'steelBright', r: 0.0003 });
    b.box({ x: 0.016, y: 0.0035, z: -0.03, w: 0.0014, h: 0.0042, d: 0.17, mat: 'black', r: 0.0004 });
    for (const z of [-0.18, 0.045]) screw(b, { at: [-0.0162, 0.0, z], axis: '-x', r: 0.0025, mat: P, slot: 0.6 });
  }
  b.anchor('ejectionPort', 0.017, 0.006, -0.098);
  // Rear sight: fixed peep between protecting ears (100 yd).
  b.span({ z0: 0.028, z1: 0.066, y0: 0.0215, y1: 0.0262, w: 0.0172, mat: P, r: 0.0012 });
  for (const s of [-1, 1]) b.extrude({ points: S([[0.031, 0.0245], [0.064, 0.0245], [0.064, 0.0352], [0.056, 0.0438], [0.047, 0.0442], [0.04, 0.0362]], 3), width: 0.0019, x: s * 0.0076, mat: P, bevel: 0.0004 });
  plateXYz(b, { outline: superellipse(0, 0.0345, 0.012, 0.0185, 3.5, b.detail(1) ? 24 : 8), holes: [circle(0, RS, 0.0025, b.detail(1) ? 16 : 6)], z0: RZ - 0.0012, z1: RZ + 0.0012, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, RS, RZ);

  // --- Frame: magazine well, trigger guard, selector and safety rockers (left).
  b.extrude({
    points: path([
      [-0.1685, -0.0195, 1],
      [0.068, -0.0195, 1],
      [0.068, -0.034, 1],
      [0.03, -0.044],
      [-0.035, -0.044, 1],
      [-0.104, -0.044, 1],
      [-0.104, -0.0565, 1],
      [-0.1685, -0.0565, 1],
    ]),
    width: 0.0302,
    mat: P,
    bevel: 0.0018,
  });
  b.span({ z0: -0.17, z1: -0.103, y0: -0.0585, y1: -0.0545, w: 0.0322, mat: P, r: 0.0012 }); // well lip
  b.box({ x: 0, y: -0.051, z: -0.0985, w: 0.0115, h: 0.012, d: 0.009, mat: P, r: 0.0015 }); // magazine catch
  guard(b, { zf: -0.037, zr: 0.03, yTop: -0.0425, yBot: -0.0725, t: 0.0048, w: 0.0112, mat: P, rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.0435, len: 0.0195, curve: 0.0055, mat: P });
  for (const [z, len, ang] of [
    [-0.022, 0.017, 0.25],
    [0.019, 0.015, -0.25],
  ]) {
    b.box({ x: -0.0162, y: -0.03, z, w: 0.0028, h: 0.0062, d: len, mat: P, r: 0.0012, rx: ang });
    b.cylAxis({ axis: 'x', x: -0.0158, y: -0.03, z, len: 0.002, r: 0.0026, mat: P, seg: 12 });
  }
  // --- Pistol grip (walnut) and the butt stock with its plate and swivel.
  sweepGrip(b, {
    path: [
      [0.052, -0.038],
      [0.06, -0.07],
      [0.07, -0.11],
      [0.075, -0.138],
    ],
    sections: (t) => ({ w: 0.0298 + 0.0035 * Math.sin(PI * t), f: 0.0195 + 0.0035 * Math.sin(PI * t * 0.9), r: 0.0215 + 0.002 * t, n: 2.5 }),
    mat: W,
    dome: 0.1,
  });
  b.extrude({ points: S([[0.066, -0.0195], [0.088, -0.0195], [0.088, -0.0425], [0.066, -0.0425]], 1), width: 0.0285, mat: P, bevel: 0.0012 }); // stock tang
  const stk = stock(b, {
    mat: W,
    z0: 0.0705,
    z1: 0.3415,
    top: [
      [0.0705, 0.0215],
      [0.12, 0.012],
      [0.22, -0.006],
      [0.3415, -0.0285],
    ],
    bottom: [
      [0.0705, -0.045],
      [0.1, -0.058],
      [0.16, -0.086],
      [0.25, -0.12],
      [0.3415, -0.1555],
    ],
    width: [
      [0.0705, 0.0315],
      [0.12, 0.0335],
      [0.25, 0.0372],
      [0.3415, 0.038],
    ],
    n: [
      [0.07, 3.0],
      [0.15, 2.8],
      [0.33, 3.4],
    ],
    wTop: [
      [0.07, 0.85],
      [0.2, 0.74],
      [0.33, 0.72],
    ],
    wBot: 0.82,
    belly: 0.46,
    roundStart: 0.002,
  });
  buttPlate(b, stk, { z0: 0.338, z1: 0.3485, mat: P, screws: [-0.04, -0.142] });
  if (b.detail(0)) {
    for (const y of [-0.115, -0.068]) b.box({ x: 0, y, z: 0.3488, w: 0.022, h: 0.0011, d: 0.0008, mat: 'black', r: 0 });
    for (const s of [-1, 1]) b.box({ x: s * 0.0105, y: -0.0915, z: 0.3488, w: 0.0011, h: 0.047, d: 0.0008, mat: 'black', r: 0 });
  }
  // Sling swivels on the left: butt and fore-end.
  {
    const zs = 0.255,
      ys = -0.07;
    const hw = stk.halfWidth(zs, ys);
    b.box({ x: -hw - 0.001, y: ys, z: zs, w: 0.003, h: 0.012, d: 0.024, mat: P, r: 0.001 });
    bar(b, { pts: [[-hw - 0.002, ys + 0.004, zs - 0.012], [-hw - 0.004, ys - 0.004, zs - 0.016], [-hw - 0.005, ys - 0.012, zs], [-hw - 0.004, ys - 0.004, zs + 0.016], [-hw - 0.002, ys + 0.004, zs + 0.012]], closed: true, r: 0.0021, mat: P, seg: 8 });
  }

  // --- Horizontal fore-end under the barrel.
  stock(b, {
    mat: W,
    z0: -0.372,
    z1: -0.2065,
    top: [
      [-0.372, -0.0035],
      [-0.2065, -0.0035],
    ],
    bottom: [
      [-0.372, -0.0395],
      [-0.33, -0.0465],
      [-0.25, -0.0475],
      [-0.2065, -0.0465],
    ],
    width: [
      [-0.372, 0.0318],
      [-0.33, 0.0352],
      [-0.24, 0.0356],
      [-0.2065, 0.0332],
    ],
    n: 3.0,
    wTop: 0.86,
    wBot: 0.88,
    belly: 0.5,
    chDepth: 0.0066,
    chHalf: 0.0108,
    roundStart: 0.006,
  });
  b.box({ x: -0.0186, y: -0.024, z: -0.3, w: 0.003, h: 0.01, d: 0.02, mat: P, r: 0.001 });
  bar(b, { pts: [[-0.0198, -0.021, -0.31], [-0.0218, -0.03, -0.313], [-0.0225, -0.038, -0.3], [-0.0218, -0.03, -0.287], [-0.0198, -0.021, -0.29]], closed: true, r: 0.0021, mat: P, seg: 8 });

  // --- Cocking knob on the right (the bolt is forward on an empty chamber; open bolt).
  b.part('bolt', [0, 0, -0.122]);
  b.span({ z0: -0.131, z1: -0.113, y0: 0.0012, y1: 0.0062, w: 0.0045, x: 0.0175, mat: P, r: 0.0008 });
  knurledKnob(b, { at: [0.0222, 0.0037, -0.122], axis: 'x', r: 0.0062, len: 0.0072, teeth: 20, depth: 0.0005, mat: P });
  b.anchor('chargingHandle', 0.026, 0.0037, -0.122);
  b.body();
  // --- 30-round stick magazine.
  const top = [-0.136, -0.024];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.245, depth: 0.0372, width: 0.0238, mat: P, plate: 0.0055 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  sling(b, { from: [-0.0225, -0.038, -0.3], to: [-0.025, -0.082, 0.255], sag: 0.05, width: 0.03, mat: 'webbing' });

  stamp(b, { name: 'thompsonSide', at: [-0.0163, 0.0035, -0.062], axis: '-x', w: 0.072, h: 0.0126 });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.078, 0.062);
  b.anchor('trigger', 0, -0.054, 0.0);
  b.anchor('gripL', 0, -0.045, -0.29);
  b.anchor('shoulder', 0, -0.09, 0.348);
  b.meta.gripRake = 0.23; // grip axis from vertical (rad)
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.115;
  b.meta.openBolt = true;
}

// M3 "Grease Gun": .45 ACP stamped-steel SMG, 757 mm with the stock out (579 mm in),
// 203 mm barrel. Tubular receiver with the knurled barrel collar, ejection port
// cover hinged on the right (open: ready to fire), crank cocking handle on the
// right, fixed aperture rear sight and blade front sight on the receiver, stamped
// grip and guard, magazine housing with its catch, retractable wire stock in two
// guide tubes, 30-round magazine. Parkerized. Dimensions est. from photos.
export function m3_greasegun(b) {
  const P = 'parkerized';
  const R = 0.0262;
  // --- Barrel with the knurled retaining collar.
  lathe(b, { mat: P, seg: 24, profile: [[0.0058, -0.427], [0.0098, -0.427], [0.0102, -0.36], [0.011, -0.3], [0, -0.3]] });
  b.cyl({ z0: -0.428, z1: -0.418, r0: 0.0059, mat: 'black', seg: 12 });
  knurledKnob(b, { at: [0, 0, -0.309], axis: 'z', r: 0.0168, len: 0.026, teeth: 40, depth: 0.0006, mat: P, chamfer: 0.0012 });
  // --- Receiver tube with its caps.
  lathe(b, { mat: P, seg: 40, profile: [[0.014, -0.3], [R - 0.0012, -0.3], [R, -0.298], [R, 0.096], [R - 0.0012, 0.098], [0.0, 0.098]] });
  lathe(b, { mat: P, seg: 36, profile: [[0, 0.096], [R + 0.0005, 0.096], [R + 0.0005, 0.1], [R - 0.003, 0.105], [0.01, 0.107], [0, 0.107]] });
  if (b.detail(0)) for (const s of [-1, 1]) for (const z of [-0.26, -0.05, 0.07]) b.cylAxis({ axis: 'x', x: s * (R - 0.0004), y: -0.014, z, len: 0.0012, r: 0.0019, mat: P, seg: 10 }); // spot welds / rivets
  // Front blade on the receiver; fixed aperture with guards at the rear.
  b.extrude({ points: S([[-0.298, 0.022], [-0.282, 0.022], [-0.286, 0.0387], [-0.293, 0.0387]], 1), width: 0.0025, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.0387, -0.2895);
  b.span({ z0: 0.068, z1: 0.096, y0: 0.0225, y1: 0.0302, w: 0.0162, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) b.extrude({ points: S([[0.07, 0.028], [0.094, 0.028], [0.094, 0.047], [0.084, 0.047]], 1), width: 0.002, x: s * 0.0075, mat: P, bevel: 0.0004 });
  plateXYz(b, { outline: superellipse(0, 0.0372, 0.0122, 0.0165, 4, b.detail(1) ? 20 : 8), holes: [circle(0, 0.0415, 0.0025, b.detail(1) ? 14 : 6)], z0: 0.0868, z1: 0.0892, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, 0.0415, 0.088);
  // Ejection port with its cover swung open (down) on the right.
  b.span({ z0: -0.27, z1: -0.175, y0: -0.006, y1: 0.012, w: 0.0018, x: 0.0254, mat: 'black', r: 0.0006 });
  b.box({ x: 0.0322, y: -0.02, z: -0.2225, w: 0.0018, h: 0.026, d: 0.1, mat: P, r: 0.0006, rz: 0.5 });
  b.cylAxis({ axis: 'z', x: 0.0262, y: -0.009, z: -0.2225, len: 0.1, r: 0.0016, mat: P, seg: 8 });
  b.anchor('ejectionPort', 0.026, 0.004, -0.222);
  // --- Magazine housing and catch.
  b.span({ z0: -0.232, z1: -0.178, y0: -0.078, y1: -0.012, w: 0.0302, mat: P, r: 0.003 });
  b.span({ z0: -0.178, z1: -0.168, y0: -0.05, y1: -0.03, w: 0.0082, mat: P, r: 0.0012 });
  // --- Trigger housing, guard, stamped grip, crank cocking handle.
  b.span({ z0: -0.055, z1: 0.085, y0: -0.04, y1: -0.012, w: 0.0302, mat: P, r: 0.003 });
  guard(b, { zf: -0.042, zr: 0.028, yTop: -0.038, yBot: -0.07, t: 0.004, w: 0.0122, mat: P, rake: 0.008 });
  trigger(b, { z: 0, yTop: -0.04, len: 0.018, curve: 0.005, mat: P });
  sweepGrip(b, {
    path: [
      [0.044, -0.036],
      [0.058, -0.07],
      [0.077, -0.114],
      [0.083, -0.134],
    ],
    sections: (t) => ({ w: 0.0272, f: 0.0158 + 0.0015 * Math.sin(PI * t), r: 0.0165, n: 3.0 }),
    mat: P,
    dome: 0.06,
  });
  b.cylAxis({ axis: 'x', x: 0.017, y: -0.026, z: -0.05, len: 0.006, r: 0.006, mat: P, seg: 14 });
  b.rod({ from: [0.021, -0.026, -0.05], to: [0.023, -0.036, -0.012], r: 0.0028, mat: P });
  b.cylAxis({ axis: 'x', x: 0.027, y: -0.037, z: -0.01, len: 0.008, r: 0.0035, mat: P, seg: 12 });
  b.anchor('chargingHandle', 0.031, -0.037, -0.01);
  // --- Wire stock: guide tubes beside the grip, U-shaped wire, extended.
  for (const s of [-1, 1]) {
    b.cyl({ z0: -0.045, z1: 0.1, r0: 0.0055, x: s * 0.021, y: -0.03, mat: P, seg: 12 });
    bar(b, { pts: [[s * 0.021, -0.03, 0.1], [s * 0.019, -0.034, 0.2], [s * 0.017, -0.038, 0.312], [s * 0.017, -0.06, 0.326], [s * 0.017, -0.11, 0.33]], r: 0.0042, mat: P, seg: 10 });
  }
  b.rod({ from: [-0.017, -0.11, 0.33], to: [0.017, -0.11, 0.33], r: 0.0042, mat: P });
  b.span({ z0: 0.322, z1: 0.333, y0: -0.106, y1: -0.084, w: 0.0302, mat: P, r: 0.002 });
  // --- Bolt, visible through the open ejection port.
  b.part('bolt', [0, 0, -0.18]);
  b.cyl({ z0: -0.225, z1: -0.17, r0: 0.0235, mat: 'steelBright', seg: 24 });
  b.body();
  // --- 30-round magazine.
  const top = [-0.205, -0.016];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.228, depth: 0.037, width: 0.024, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.427);
  b.anchor('gripR', 0, -0.075, 0.068);
  b.anchor('trigger', 0, -0.05, 0.0);
  b.anchor('gripL', 0, -0.06, -0.205);
  b.anchor('shoulder', 0, -0.08, 0.334);
  b.meta.gripRake = 0.38; // grip axis from vertical (rad)
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.09;
  b.meta.openBolt = true;
  b.meta.stockSlide = 0.178; // wire stock collapses forward by this much
}

// Browning Automatic Rifle M1918A2: .30-06, 1214 mm long, 610 mm barrel. Cone flash
// hider with the bipod clamped behind it (skid feet), front sight with ears, gas
// cylinder under the barrel with the regulator at the gas block, wooden fore-end,
// big milled receiver (ejection port cover on the right, cocking handle on the
// left), rate selector on the left (A - F - S), leaf aperture rear sight on the
// receiver's rear, 20-round magazine, butt with the pistol grip and the hinged
// shoulder rest on the butt plate. Parkerized. Dimensions est. from photos.
export function bar_m1918a2(b) {
  const P = 'parkerized';
  const W = 'walnut';
  const MZ = -0.869;
  const FS = 0.0465,
    FZ = -0.779;
  const RS = 0.0465,
    RZ = 0.0345;
  // --- Barrel and the cone flash hider.
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0, -0.805],
      [0.0098, -0.805],
      [0.0108, -0.79],
      [0.0112, -0.7],
      [0.0118, -0.62],
      [0.0128, -0.5],
      [0.0136, -0.4],
      [0.0148, -0.305],
      [0.0, -0.305],
    ],
  });
  lathe(b, { mat: P, seg: 28, profile: [[0.0062, MZ], [0.0132, MZ], [0.0136, MZ + 0.003], [0.0124, -0.822], [0.0118, -0.808], [0.0106, -0.802], [0.0062, -0.802]] });
  if (b.detail(1)) b.cyl({ z0: MZ - 0.0001, z1: MZ + 0.05, r0: 0.0118, r1: 0.0064, mat: 'black', seg: 20, open: true });
  // Front sight: base ring, ears and blade.
  lathe(b, { mat: P, seg: 24, profile: [[0.0108, -0.7915], [0.0122, -0.7915], [0.0128, -0.7895], [0.0128, -0.7685], [0.0122, -0.7665], [0.0108, -0.7665]] });
  b.span({ z0: -0.79, z1: -0.768, y0: 0.008, y1: 0.0222, w: 0.0162, mat: P, r: 0.002 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.7895, 0.018], [-0.7685, 0.018], [-0.7715, 0.0505], [-0.786, 0.0508]], 2), width: 0.0022, x: s * 0.0069, mat: P, bevel: 0.0004 });
  plateXYz(b, { outline: [[-0.0011, 0.0215], [0.0011, 0.0215], [0.0011, FS], [-0.0011, FS]], z0: FZ - 0.003, z1: FZ + 0.003, mat: P, bevel: 0.0002 });
  b.anchor('frontSight', 0, FS, FZ);
  // --- Gas block with the regulator, gas cylinder, fore-end, swivel band.
  b.extrude({ points: path([[-0.716, -0.039, 1], [-0.716, 0.0128, 1], [-0.682, 0.0128, 1], [-0.682, -0.039, 1]]), width: 0.0262, mat: P, bevel: 0.003 });
  knurledKnob(b, { at: [0, -0.025, -0.73], axis: 'z', r: 0.0108, len: 0.026, teeth: 3, depth: 0.003, mat: P, chamfer: 0.001 }); // regulator
  lathe(b, { mat: P, y: -0.025, seg: 20, profile: [[0, -0.747], [0.0072, -0.747], [0.0095, -0.744], [0.0095, -0.718], [0, -0.718]] });
  b.cyl({ z0: -0.682, z1: -0.305, r0: 0.0118, y: -0.025, mat: P, seg: 24 });
  stock(b, {
    mat: W,
    z0: -0.628,
    z1: -0.312,
    top: [
      [-0.628, 0.006],
      [-0.312, 0.006],
    ],
    bottom: [
      [-0.628, -0.0462],
      [-0.6, -0.0545],
      [-0.4, -0.0565],
      [-0.312, -0.0545],
    ],
    width: [
      [-0.628, 0.0392],
      [-0.58, 0.0438],
      [-0.36, 0.0442],
      [-0.312, 0.0432],
    ],
    n: 3.4,
    wTop: 0.82,
    wBot: 0.86,
    belly: 0.48,
    chDepth: 0.0155,
    chHalf: 0.0125,
    roundStart: 0.006,
    roundEnd: 0.004,
  });
  band(b, { z0: -0.705, z1: -0.692, y0: -0.0385, y1: 0.0128, w: 0.026, n: 2.6, thick: 0.0016, mat: P });
  bar(b, { pts: [[0, -0.041, -0.704], [0, -0.0505, -0.7], [0, -0.0545, -0.688], [0, -0.0485, -0.683], [0, -0.041, -0.692]], closed: true, r: 0.0021, mat: P, seg: 8 });

  // --- Receiver: tall milled box with a rounded top; ejection port cover (right),
  // cocking slot (left), magazine guard below, trigger guard and selector.
  if (b.detail(1)) {
    const recv = () => {
      const K = b.detail(0) ? 5 : 2;
      const hw = 0.0182,
        yb = -0.047,
        yt = 0.0222,
        rt = 0.006;
      const pts = [[0, yb], [hw - 0.002, yb], [hw, yb + 0.002]];
      for (let k = 0; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([hw - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]);
      }
      const left = pts.slice(1).map(([x, y]) => [-x, y]).reverse();
      return [...pts, ...left];
    };
    sectionLoft(b, { zs: [-0.305, 0.052], section: recv, mat: P });
  } else b.span({ z0: -0.305, z1: 0.052, y0: -0.047, y1: 0.0222, w: 0.0364, mat: P });
  b.span({ z0: -0.305, z1: -0.272, y0: -0.042, y1: 0.0172, w: 0.0402, mat: P, r: 0.004 }); // barrel extension collar
  b.extrude({ points: path([[-0.162, -0.0035, 1], [-0.064, -0.0035, 1], [-0.064, 0.0158, 1], [-0.162, 0.0158, 1]]), width: 0.0014, x: 0.0189, mat: P, bevel: 0.0004 }); // port cover
  if (b.detail(0)) {
    b.cylAxis({ axis: 'z', x: 0.0196, y: -0.0035, z: -0.113, len: 0.098, r: 0.0011, mat: P, seg: 8 });
    b.box({ x: -0.0182, y: -0.009, z: -0.145, w: 0.0016, h: 0.0062, d: 0.25, mat: 'black', r: 0.0005 }); // cocking slot
    for (const z of [-0.29, -0.01]) for (const s of [-1, 1]) screw(b, { at: [s * 0.0183, -0.03, z], axis: s > 0 ? 'x' : '-x', r: 0.0026, mat: P, slot: 0.3 });
  }
  b.anchor('ejectionPort', 0.019, 0.006, -0.11);
  b.span({ z0: -0.214, z1: -0.106, y0: -0.0555, y1: -0.0455, w: 0.0352, mat: P, r: 0.002 }); // magazine guard
  b.span({ z0: -0.102, z1: -0.086, y0: -0.0555, y1: -0.0435, w: 0.0126, mat: P, r: 0.0015 }); // magazine release
  guard(b, { zf: -0.04, zr: 0.045, yTop: -0.0455, yBot: -0.0785, t: 0.0046, w: 0.0122, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.0465, len: 0.021, curve: 0.006, mat: P });
  b.cylAxis({ axis: 'x', x: -0.0192, y: -0.031, z: -0.012, len: 0.0035, r: 0.0068, mat: P, seg: 18 }); // selector
  b.box({ x: -0.0215, y: -0.0245, z: -0.012, w: 0.0028, h: 0.0145, d: 0.0045, mat: P, r: 0.001, rx: -0.4 });
  // --- Rear sight: base with ears; leaf with the aperture slide (moves up with range).
  b.span({ z0: 0.005, z1: 0.05, y0: 0.0205, y1: 0.0275, w: 0.0222, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) b.extrude({ points: S([[0.012, 0.026], [0.048, 0.026], [0.048, 0.042], [0.03, 0.0495], [0.02, 0.0482]], 3), width: 0.0025, x: s * 0.0096, mat: P, bevel: 0.0004 });
  for (const s of [-1, 1]) b.extrude({ points: [[0.0368, 0.026], [0.0428, 0.026], [0.0428, 0.0722], [0.0368, 0.0722]], width: 0.0032, x: s * 0.0058, mat: P, bevel: 0.0006 });
  b.span({ z0: 0.0368, z1: 0.0428, y0: 0.0692, y1: 0.0732, w: 0.0148, mat: P, r: 0.0008 });
  if (b.detail(0)) for (let i = 0; i < 14; i++) b.box({ x: 0.0089, y: 0.031 + i * 0.0029, z: 0.0398, w: 0.0004, h: 0.00035, d: i % 5 === 4 ? 0.0055 : 0.003, mat: 'black', r: 0 });
  b.part('rearSight', [0, RS, RZ]);
  plateXYz(b, { outline: superellipse(0, RS, 0.0136, 0.0128, 4, b.detail(1) ? 24 : 8), holes: [circle(0, RS, 0.0025, b.detail(1) ? 16 : 6)], z0: RZ - 0.0013, z1: RZ + 0.0013, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, RS, RZ);
  b.body();
  b.meta.sightKind = 'slide';

  // --- Butt stock with the pistol grip; butt plate with the folded shoulder rest.
  const stk = stock(b, {
    mat: W,
    z0: 0.0515,
    z1: 0.3385,
    top: [
      [0.0515, 0.0198],
      [0.1, 0.0158],
      [0.2, 0.0005],
      [0.3385, -0.0215],
    ],
    bottom: [
      [0.0515, -0.047],
      [0.064, -0.074],
      [0.08, -0.108],
      [0.098, -0.1215],
      [0.118, -0.118],
      [0.14, -0.1015],
      [0.24, -0.1355],
      [0.3385, -0.1645],
    ],
    width: [
      [0.0515, 0.0362],
      [0.1, 0.0352],
      [0.16, 0.0385],
      [0.3385, 0.0412],
    ],
    n: [
      [0.06, 3.0],
      [0.1, 2.4],
      [0.2, 2.9],
      [0.33, 3.3],
    ],
    wTop: [
      [0.06, 0.9],
      [0.2, 0.74],
      [0.33, 0.72],
    ],
    wBot: [
      [0.06, 0.86],
      [0.1, 0.8],
      [0.33, 0.8],
    ],
    belly: 0.48,
    roundStart: 0.002,
  });
  buttPlate(b, stk, { z0: 0.3355, z1: 0.3462, mat: P, screws: [-0.03, -0.155] });
  b.extrude({ points: path([[0.3462, -0.032, 1], [0.3525, -0.032, 1], [0.3525, -0.081, 1], [0.3462, -0.081, 1]]), width: 0.0302, mat: P, bevel: 0.0015 }); // shoulder rest, folded
  b.cylAxis({ axis: 'x', x: 0, y: -0.081, z: 0.349, len: 0.033, r: 0.0022, mat: P, seg: 10 });
  {
    const zs = 0.28,
      ys = stk.bottom(0.28);
    b.box({ x: 0, y: ys - 0.001, z: zs, w: 0.014, h: 0.003, d: 0.03, mat: P, r: 0.001 });
    bar(b, { pts: [[0, ys - 0.002, zs - 0.012], [0, ys - 0.014, zs - 0.006], [0, ys - 0.016, zs + 0.008], [0, ys - 0.006, zs + 0.012]], closed: true, r: 0.0022, mat: P, seg: 8 });
  }

  // --- Bipod clamped behind the flash hider (deployed), skid feet.
  b.part('bipod', [0, -0.012, -0.81]);
  lathe(b, { mat: P, seg: 24, profile: [[0.0106, -0.8185], [0.0152, -0.8185], [0.0158, -0.8165], [0.0158, -0.8035], [0.0152, -0.8015], [0.0106, -0.8015]] });
  b.box({ x: 0, y: -0.019, z: -0.81, w: 0.022, h: 0.012, d: 0.016, mat: P, r: 0.002 });
  for (const s of [-1, 1]) {
    b.rod({ from: [s * 0.009, -0.022, -0.81], to: [s * 0.105, -0.33, -0.83], r: 0.0058, r1: 0.0049, mat: P });
    b.extrude({ points: path([[-0.852, -0.329, 1], [-0.812, -0.329], [-0.806, -0.336, 1], [-0.85, -0.338, 1]]), width: 0.014, x: s * 0.106, mat: P, bevel: 0.001 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2; // rotate about X to fold the legs back along the barrel

  // --- Cocking handle (left side, forward).
  b.part('bolt', [0, 0, -0.26]);
  b.span({ z0: -0.27, z1: -0.25, y0: -0.0125, y1: -0.0055, w: 0.004, x: -0.0198, mat: P, r: 0.001 });
  knurledKnob(b, { at: [-0.0262, -0.009, -0.26], axis: 'x', r: 0.0058, len: 0.0105, teeth: 18, mat: P });
  b.anchor('chargingHandle', -0.0315, -0.009, -0.26);
  b.body();
  // --- 20-round magazine.
  const top = [-0.16, -0.022];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.142, depth: 0.0905, width: 0.0252, mat: P, plate: 0.0062 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  sling(b, { from: [0, -0.0545, -0.688], to: [0, stk.bottom(0.28) - 0.016, 0.28], sag: 0.05, width: 0.031, mat: 'webbing' });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.088, 0.09);
  b.anchor('trigger', 0, -0.056, 0.0);
  b.anchor('gripL', 0, -0.05, -0.385); // rear of the fore-end
  b.anchor('shoulder', 0, -0.09, 0.352);
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.11;
  b.meta.openBolt = true;
}

// A short run of .30-06 link belt (cartridges side by side, going across the
// gun toward -X), starting at x0 and stepping by dx; y/z place the rounds.
function belt3006(b, { x0, y, zBase, n, dx = -0.0127, dy = 0, link = 'steel' }) {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dx,
      yy = y + i * dy;
    cartridge(b, { ...R3006, x, y: yy, zBase, seg: 8 });
    b.span({ z0: zBase - 0.05, z1: zBase - 0.034, y0: yy - 0.0068, y1: yy + 0.0068, w: 0.0105, x, mat: link, r: 0.001 });
  }
}

// Browning M1919A6: .30-06 belt-fed LMG, 1346 mm, 610 mm barrel, perforated
// barrel jacket, conical flash hider, bipod at the front of the jacket,
// carrying handle, shoulder stock, feed cover hinged at the rear, sights on the
// left of the receiver (as on the M1919A4), 100-round belt box on the left.
export function m1919a6(b) {
  const P = 'parkerized';
  // Barrel inside the perforated jacket; front barrel bearing and flash hider.
  b.cyl({ z0: -0.9, z1: -0.32, r0: 0.0105, r1: 0.013, mat: P, seg: 16 });
  perfTube(b, { z0: -0.875, z1: -0.33, r: 0.0225, mat: 'perforatedParkerized', seg: 32 });
  tube(b, { z0: -0.335, z1: -0.322, rIn: 0.02, rOut: 0.0245, mat: P });
  tube(b, { z0: -0.885, z1: -0.862, rIn: 0.009, rOut: 0.0245, mat: P });
  lathe(b, { mat: P, profile: [[0.008, -0.9], [0.0125, -0.9], [0.0135, -0.905], [0.024, -0.985], [0.021, -0.985], [0.011, -0.91], [0.008, -0.91]] });
  // Carrying handle on the jacket.
  for (const z of [-0.6, -0.5]) b.span({ z0: z - 0.006, z1: z + 0.006, y0: 0.018, y1: 0.05, w: 0.008, mat: P, r: 0.002 });
  b.cyl({ z0: -0.614, z1: -0.486, r0: 0.0075, y: 0.054, mat: 'walnut', seg: 12 });
  // Receiver box with trunnion; front sight on the left of the trunnion.
  b.span({ z0: -0.322, z1: 0.016, y0: -0.034, y1: 0.03, w: 0.044, mat: P, r: 0.003 });
  b.span({ z0: -0.33, z1: -0.25, y0: -0.036, y1: 0.031, w: 0.047, mat: P, r: 0.003 });
  for (const sx of [-1, 1]) for (const [z, y] of [[-0.23, -0.024], [-0.15, -0.024], [-0.07, -0.024], [-0.23, 0.02], [-0.03, 0.0]]) b.cylAxis({ axis: 'x', x: sx * 0.0222, y, z, len: 0.0012, r: 0.0028, mat: 'steel', seg: 10 }); // rivets
  b.span({ z0: -0.322, z1: 0.016, y0: -0.0345, y1: -0.031, w: 0.046, mat: P, r: 0.001 }); // bottom plate
  const SX = -0.026; // sight line offset to the left
  b.span({ z0: -0.322, z1: -0.296, y0: 0.028, y1: 0.04, w: 0.012, x: SX + 0.002, mat: P, r: 0.0015 });
  b.extrude({ points: [[-0.316, 0.039], [-0.302, 0.039], [-0.305, 0.0605], [-0.312, 0.0605]], width: 0.0024, x: SX, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', SX, 0.0605, -0.3085);
  // Rear sight on the left rear of the receiver: raised leaf, notched slide
  // that moves up the leaf with the range.
  b.span({ z0: -0.06, z1: -0.015, y0: 0.01, y1: 0.035, w: 0.01, x: SX + 0.002, mat: P, r: 0.0015 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.04, 0.033], [-0.034, 0.033], [-0.034, 0.1], [-0.04, 0.1]], width: 0.003, x: SX + sx * 0.0062, mat: P, bevel: 0.0006 }); // leaf rails
  b.span({ z0: -0.04, z1: -0.034, y0: 0.097, y1: 0.101, w: 0.0154, x: SX, mat: P, r: 0.0008 });
  b.part('rearSight', [SX, 0.0605, -0.0315]);
  for (const sx of [-1, 1]) plateXY(b, { outline: [[SX + sx * 0.0013, 0.055], [SX + sx * 0.0075, 0.055], [SX + sx * 0.0075, 0.0645], [SX + sx * 0.0013, 0.0645]], z: -0.0315, thick: 0.003, mat: P });
  plateXY(b, { outline: [[SX - 0.0075, 0.055], [SX + 0.0075, 0.055], [SX + 0.0075, 0.0605], [SX - 0.0075, 0.0605]], z: -0.0315, thick: 0.003, mat: P });
  b.anchor('rearSight', SX, 0.0605, -0.0315);
  b.body();
  b.meta.sightKind = 'slide';
  // Feedway on the left, belt guide.
  b.span({ z0: -0.29, z1: -0.215, y0: 0.012, y1: 0.03, w: 0.018, x: -0.03, mat: P, r: 0.002 });
  // Backplate, pistol grip and trigger.
  b.span({ z0: 0.012, z1: 0.03, y0: -0.036, y1: 0.03, w: 0.046, mat: P, r: 0.003 });
  sweepGrip(b, {
    path: [
      [0.024, -0.034],
      [0.038, -0.066],
      [0.054, -0.108],
      [0.06, -0.13],
    ],
    sections: (t) => ({ w: 0.0292 + 0.003 * Math.sin(PI * t), f: 0.0148 + 0.002 * Math.sin(PI * t), r: 0.0165 + 0.0015 * t, n: 2.5 }),
    mat: 'walnut',
    dome: 0.08,
  });
  guard(b, { zf: -0.03, zr: 0.022, yTop: -0.033, yBot: -0.062, t: 0.004, w: 0.01, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.034, len: 0.018, curve: 0.005, mat: P });
  // Steel shoulder stock on the backplate.
  const stk = stock(b, {
    mat: P,
    z0: 0.03,
    z1: 0.3605,
    top: [
      [0.03, 0.022],
      [0.1, 0.012],
      [0.2, -0.004],
      [0.3605, -0.03],
    ],
    bottom: [
      [0.03, -0.03],
      [0.08, -0.04],
      [0.14, -0.07],
      [0.25, -0.118],
      [0.3605, -0.15],
    ],
    width: [
      [0.03, 0.0272],
      [0.3, 0.034],
      [0.3605, 0.0345],
    ],
    n: 3.6,
    wTop: 0.82,
    wBot: 0.84,
    belly: 0.5,
  });
  buttPlate(b, stk, { z0: 0.358, z1: 0.3665, mat: 'steel', screws: [-0.05, -0.135] });
  // Bolt handle (right side, forward).
  b.part('bolt', [0, 0, -0.12]);
  b.cylAxis({ axis: 'x', x: 0.028, y: -0.008, z: -0.12, len: 0.014, r: 0.0042, mat: P });
  b.sphere({ x: 0.036, y: -0.008, z: -0.12, r: 0.0065, mat: P });
  b.anchor('chargingHandle', 0.04, -0.008, -0.12);
  b.body();
  b.anchor('ejectionPort', 0, -0.036, -0.2); // empties drop out underneath
  // Feed cover, hinged at the rear of the top.
  b.part('cover', [0, 0.031, -0.075]);
  b.span({ z0: -0.322, z1: -0.072, y0: 0.029, y1: 0.041, w: 0.044, mat: P, r: 0.003 });
  b.span({ z0: -0.322, z1: -0.3, y0: 0.036, y1: 0.046, w: 0.03, mat: P, r: 0.002 }); // latch
  b.cylAxis({ axis: 'x', x: 0, y: 0.034, z: -0.075, len: 0.046, r: 0.0045, mat: P });
  b.body();
  b.anchor('coverHinge', 0, 0.034, -0.075);
  // Bipod at the front of the jacket (deployed).
  b.part('bipod', [0, -0.02, -0.85]);
  b.cyl({ z0: -0.862, z1: -0.838, r0: 0.026, mat: P });
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.012, -0.022, -0.85], to: [sx * 0.13, -0.33, -0.82], r: 0.006, mat: P });
    b.box({ x: sx * 0.132, y: -0.335, z: -0.82, w: 0.03, h: 0.006, d: 0.018, mat: P, r: 0.002 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2;
  // 100-round belt box on the left (with the belt entering the feedway).
  b.part('mag', [-0.075, 0.0, -0.25]);
  b.span({ z0: -0.34, z1: -0.16, y0: -0.13, y1: -0.005, w: 0.075, x: -0.075, mat: 'olive', r: 0.004 });
  b.span({ z0: -0.345, z1: -0.155, y0: -0.007, y1: 0.0, w: 0.079, x: -0.075, mat: 'olive', r: 0.002 });
  b.span({ z0: -0.27, z1: -0.23, y0: 0.0, y1: 0.006, w: 0.012, x: -0.075, mat: 'olive', r: 0.002 });
  belt3006(b, { x0: -0.105, y: 0.004, zBase: -0.21, n: 7, dx: 0.0115, dy: 0.0028 });
  b.body();
  b.anchor('magWell', -0.03, 0.02, -0.25);
  b.meta.magAxis = [0, -1, 0];
  b.meta.belt = true;

  b.anchor('muzzle', 0, 0, -0.985);
  b.anchor('gripR', 0, -0.08, 0.045);
  b.anchor('trigger', 0, -0.045, 0.0);
  b.anchor('gripL', 0, -0.03, 0.17); // left hand on the stock under the cheek (bipod fire)
  b.anchor('shoulder', 0, -0.09, 0.366);
  b.meta.gripRake = 0.36; // grip axis from vertical (rad)
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.09;
}

// Johnson M1941 light machine gun: .30-06, 1067 mm, 559 mm barrel, ventilated
// barrel sleeve, bipod, in-line butt stock, separate pistol grip, high sights,
// 20-round single-column magazine sticking out on the LEFT.
export function johnson_lmg(b) {
  const P = 'parkerized';
  lathe(b, { mat: P, profile: [[0, -0.2], [0.0125, -0.2], [0.0112, -0.48], [0.0098, -0.6], [0.0092, -0.71], [0, -0.71]] });
  perfTube(b, { z0: -0.468, z1: -0.2, r: 0.0195, mat: 'perforatedParkerized', seg: 28 });
  tube(b, { z0: -0.478, z1: -0.462, rIn: 0.009, rOut: 0.021, mat: P });
  tube(b, { z0: -0.212, z1: -0.196, rIn: 0.012, rOut: 0.021, mat: P });
  // Front sight post on a tall bracket at the muzzle.
  b.cyl({ z0: -0.708, z1: -0.684, r0: 0.0118, mat: P });
  b.extrude({ points: [[-0.705, 0.008], [-0.687, 0.008], [-0.69, 0.046], [-0.702, 0.046]], width: 0.008, mat: P, bevel: 0.001 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.704, 0.04], [-0.688, 0.04], [-0.69, 0.064], [-0.701, 0.064]], width: 0.002, x: sx * 0.006, mat: P, bevel: 0.0004 });
  b.extrude({ points: [[-0.7, 0.044], [-0.692, 0.044], [-0.693, 0.0595], [-0.699, 0.0595]], width: 0.0022, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0595, -0.696);
  // Receiver.
  b.box({ x: 0, y: -0.002, z: -0.07, w: 0.034, h: 0.05, d: 0.27, mat: P, r: 0.006 });
  b.span({ z0: -0.15, z1: -0.08, y0: 0.0, y1: 0.014, w: 0.002, x: 0.0168, mat: 'black', r: 0.0006 });
  b.anchor('ejectionPort', 0.018, 0.007, -0.115);
  // Magazine housing on the left.
  b.span({ z0: -0.17, z1: -0.07, y0: -0.016, y1: 0.012, w: 0.016, x: -0.022, mat: P, r: 0.002 });
  // Rear sight: folding aperture on a raised base.
  b.span({ z0: 0.02, z1: 0.06, y0: 0.02, y1: 0.034, w: 0.016, mat: P, r: 0.002 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.03, 0.032], [0.058, 0.032], [0.058, 0.062], [0.046, 0.066]], width: 0.002, x: sx * 0.0075, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.034, 0.05]);
  plateXY(b, { outline: [[-0.0055, 0.032], [0.0055, 0.032], [0.0055, 0.063], [-0.0055, 0.063]], holes: [circle(0, 0.0595, 0.0025, 14)], z: 0.048, thick: 0.0025, mat: P });
  b.anchor('rearSight', 0, 0.0595, 0.048);
  b.body();
  b.meta.sightKind = 'slide';
  // Pistol grip, trigger guard, trigger.
  b.span({ z0: -0.045, z1: 0.05, y0: -0.04, y1: -0.024, w: 0.026, mat: P, r: 0.003 });
  guard(b, { zf: -0.036, zr: 0.026, yTop: -0.038, yBot: -0.066, t: 0.004, w: 0.01, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.039, len: 0.018, curve: 0.005, mat: P });
  sweepGrip(b, {
    path: [
      [0.04, -0.036],
      [0.058, -0.07],
      [0.08, -0.115],
      [0.087, -0.136],
    ],
    sections: (t) => ({ w: 0.0292 + 0.003 * Math.sin(PI * t), f: 0.0158 + 0.002 * Math.sin(PI * t), r: 0.0172 + 0.0015 * t, n: 2.5 }),
    mat: 'walnut',
    dome: 0.08,
  });
  // In-line butt stock with butt plate.
  const stk = stock(b, {
    mat: 'walnut',
    z0: 0.066,
    z1: 0.3465,
    top: [
      [0.066, 0.02],
      [0.15, 0.016],
      [0.3465, 0.006],
    ],
    bottom: [
      [0.066, -0.03],
      [0.13, -0.046],
      [0.24, -0.088],
      [0.3465, -0.116],
    ],
    width: [
      [0.066, 0.0295],
      [0.28, 0.036],
      [0.3465, 0.0365],
    ],
    n: 3.0,
    wTop: 0.78,
    wBot: 0.82,
    belly: 0.48,
  });
  b.span({ z0: 0.058, z1: 0.068, y0: -0.032, y1: 0.022, w: 0.034, mat: P, r: 0.002 });
  buttPlate(b, stk, { z0: 0.3435, z1: 0.3545, mat: P, screws: [-0.01, -0.105] });
  // Bipod under the front of the sleeve (deployed).
  b.part('bipod', [0, -0.02, -0.47]);
  b.span({ z0: -0.48, z1: -0.46, y0: -0.032, y1: -0.016, w: 0.02, mat: P, r: 0.003 });
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.006, -0.026, -0.47], to: [sx * 0.11, -0.3, -0.5], r: 0.0045, mat: P });
    b.sphere({ x: sx * 0.11, y: -0.302, z: -0.5, r: 0.007, mat: P });
  }
  b.body();
  b.meta.bipodFold = PI / 2; // legs fold forward under the barrel
  // Charging handle (right side).
  b.part('bolt', [0, 0, -0.06]);
  b.cylAxis({ axis: 'x', x: 0.023, y: -0.004, z: -0.06, len: 0.012, r: 0.0042, mat: P });
  b.sphere({ x: 0.03, y: -0.004, z: -0.06, r: 0.0062, mat: P });
  b.anchor('chargingHandle', 0.034, -0.004, -0.06);
  b.body();
  // 20-round single-column magazine, horizontal on the left (built hanging down
  // and swung out to the left).
  b.part('mag', [-0.03, 0.0, -0.12]);
  place(b, { pos: [-0.03, 0, 0], rot: [0, 0, -PI / 2] }, () => {
    boxMag(b, { top: [-0.12, 0.0], len: 0.215, depth: 0.09, width: 0.016, k: -0.6, mat: P, plate: 0.006 });
  });
  b.body();
  b.anchor('magWell', -0.03, 0.0, -0.12);
  b.meta.magAxis = [-1, 0, 0];

  b.anchor('muzzle', 0, 0, -0.71);
  b.anchor('gripR', 0, -0.08, 0.07);
  b.anchor('trigger', 0, -0.05, 0.0);
  b.anchor('gripL', 0, -0.022, -0.33);
  b.anchor('shoulder', 0, -0.06, 0.357);
  b.meta.gripRake = 0.44; // grip axis from vertical (rad)
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.09;
}

// Colt M1911A1: .45 ACP, 216 mm long, 127 mm barrel, 7-round magazine. Slide with
// the rounded top, rear grasping grooves, blade front and notch rear sight, barrel
// bushing and recoil spring plug; frame with the short grooved trigger, arched
// mainspring housing, grip safety, thumb safety, slide stop and magazine catch on
// the left, checkered brown plastic grips, lanyard loop; spur hammer, cocked.
// Parkerized. Dimensions est. from photos and the M1911A1 drawings' proportions.
export function m1911a1(b) {
  const P = 'parkerized';
  const MZ = -0.1255;
  // --- Frame: dust cover and rails, trigger guard, 18-degree grip frame.
  b.extrude({
    points: [
      [-0.088, -0.0105],
      [0.06, -0.0105],
      [0.074, -0.009],
      [0.088, -0.0115],
      [0.0905, -0.0155],
      [0.075, -0.019],
      [0.069, -0.028],
      [0.072, -0.05],
      [0.081, -0.09],
      [0.09, -0.118],
      [0.089, -0.124],
      [0.045, -0.124],
      [0.042, -0.118],
      [0.019, -0.046],
      [0.012, -0.047],
      [-0.03, -0.047],
      [-0.04, -0.043],
      [-0.044, -0.03],
      [-0.046, -0.021],
      [-0.088, -0.021],
    ],
    holes: [S([[-0.036, -0.0225], [0.009, -0.0225], [0.0135, -0.031], [0.009, -0.0415], [-0.028, -0.042], [-0.036, -0.036]], 3)],
    width: 0.0215,
    mat: P,
    bevel: 0.0012,
  });
  // Arched mainspring housing at the back of the grip, grip safety at the top.
  b.extrude({ points: S([[0.0785, -0.052], [0.0865, -0.06], [0.0918, -0.09], [0.0925, -0.112], [0.0905, -0.1235], [0.0832, -0.1235], [0.082, -0.095], [0.0765, -0.062]], 3), width: 0.0185, mat: P, bevel: 0.0012 });
  b.extrude({ points: S([[0.07, -0.0125], [0.0825, -0.0128], [0.0935, -0.0175], [0.0975, -0.0215], [0.093, -0.0242], [0.083, -0.0215], [0.077, -0.032], [0.071, -0.048], [0.068, -0.028]], 3), width: 0.0158, mat: P, bevel: 0.001 });
  // Checkered brown plastic grips with screws and their reinforcing rings.
  b.extrude({ points: S([[0.021, -0.037], [0.0665, -0.033], [0.0705, -0.05], [0.083, -0.104], [0.0855, -0.1165], [0.05, -0.1185], [0.044, -0.106], [0.023, -0.046]], 3), width: 0.0292, mat: 'checkerPlastic', bevel: 0.0024 });
  for (const s of [-1, 1])
    for (const [z, y] of [
      [0.0425, -0.044],
      [0.0635, -0.106],
    ]) {
      b.cylAxis({ axis: 'x', x: s * 0.0147, y, z, len: 0.0008, r: 0.0052, mat: 'checkerPlastic', seg: 16 });
      screw(b, { at: [s * 0.0151, y, z], axis: s > 0 ? 'x' : '-x', r: 0.0029, h: 0.0009, mat: P, slot: 0.5 });
    }
  bar(b, { pts: [[0.0, -0.1245, 0.08], [0.0, -0.1305, 0.0835], [0.0, -0.1325, 0.0885], [0.0, -0.1285, 0.0915], [0.0, -0.1245, 0.0895]], closed: true, r: 0.0011, mat: P, seg: 8 }); // lanyard loop
  // Controls: thumb safety and slide stop (left), slide stop pin (right), magazine catch.
  b.extrude({ points: S([[0.042, -0.0118], [0.0605, -0.0122], [0.0655, -0.0098], [0.0645, -0.0158], [0.0565, -0.0182], [0.044, -0.0175]], 2), width: 0.0022, x: -0.0118, mat: P, bevel: 0.0006 });
  b.cylAxis({ axis: 'x', x: -0.0119, y: -0.0145, z: 0.0525, len: 0.0022, r: 0.0042, mat: P, seg: 14 });
  b.extrude({ points: S([[-0.046, -0.0125], [-0.0225, -0.0128], [-0.0185, -0.0158], [-0.0225, -0.0182], [-0.035, -0.0185], [-0.043, -0.021]], 2), width: 0.0022, x: -0.0118, mat: P, bevel: 0.0006 });
  b.cylAxis({ axis: 'x', x: -0.012, y: -0.0165, z: -0.0395, len: 0.0026, r: 0.0042, mat: P, seg: 14 });
  b.cylAxis({ axis: 'x', x: 0.0109, y: -0.0165, z: -0.0395, len: 0.0008, r: 0.0019, mat: P, seg: 10 });
  knurledKnob(b, { at: [-0.0112, -0.03, 0.0172], axis: 'x', r: 0.0036, len: 0.0028, teeth: 14, depth: 0.0003, mat: P });
  // Trigger: short, with grooves across its face; it slides straight back.
  b.box({ x: 0, y: -0.0305, z: 0.0025, w: 0.0062, h: 0.0152, d: 0.0048, mat: P, r: 0.0012 });
  if (b.detail(0)) for (let i = 0; i < 6; i++) b.box({ x: 0, y: -0.025 - i * 0.0021, z: 0.0001, w: 0.0064, h: 0.0006, d: 0.0006, mat: 'black', r: 0 });
  // Barrel: its hood shows in the ejection port; the muzzle in the bushing.
  b.cyl({ z0: MZ, z1: -0.028, r0: 0.0071, mat: 'steelBright', seg: 20 });
  b.cyl({ z0: MZ - 0.0002, z1: MZ + 0.009, r0: 0.0058, mat: 'black', seg: 14 });
  b.span({ z0: -0.031, z1: -0.004, y0: 0.0015, y1: 0.0088, w: 0.0128, mat: 'steelBright', r: 0.0012 });
  b.anchor('ejectionPort', 0.012, 0.004, -0.02);

  // --- Slide: rounded top, flat sides, grasping grooves at the rear.
  b.part('bolt', [0, 0, 0.06]);
  {
    const serr = serrations(0.0305, 0.0585, b.detail(0) ? 10 : 0);
    const zs = (b.detail(0) ? [MZ, MZ + 0.0015, -0.0925, -0.0915, ...serr.zs, 0.0595, 0.06] : [MZ, -0.0925, -0.0915, 0.06]).sort((a, c) => a - c).filter((z, i, a) => i === 0 || z - a[i - 1] > 1e-5);
    const K = b.detail(0) ? 6 : 2;
    const sec = (z) => {
      const hw = 0.01175 - serr.depth(z) * 0.0006;
      const yb = z < -0.092 ? -0.0205 : -0.0105;
      const rt = 0.0062;
      const end = z < MZ + 0.001 || z > 0.0595 ? 0.0006 : 0;
      const pts = [[0, yb + end]];
      pts.push([hw - end, yb + end]);
      pts.push([hw - end, 0.0105 - rt]);
      for (let k = 1; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([0.01175 - end - rt + Math.cos(a) * rt, 0.0105 - end - rt + Math.sin(a) * rt]);
      }
      const left = pts.slice(1).map(([x, y]) => [-x, y]).reverse();
      return [...pts, ...left];
    };
    sectionLoft(b, { zs, section: sec, mat: P });
  }
  if (b.detail(0)) b.box({ x: 0.0113, y: 0.0045, z: -0.0175, w: 0.0016, h: 0.0095, d: 0.028, mat: 'black', r: 0.0004 }); // ejection port
  // Barrel bushing and recoil spring plug at the muzzle end.
  tube(b, { z0: MZ - 0.001, z1: MZ + 0.0035, rIn: 0.0072, rOut: 0.0092, mat: P, seg: 20 });
  b.cyl({ z0: MZ - 0.0012, z1: MZ + 0.004, r0: 0.0054, y: -0.0152, mat: P, seg: 16 });
  // Sights: blade staked at the front, notch block dovetailed at the rear.
  b.extrude({ points: [[-0.1205, 0.0098], [-0.1125, 0.0098], [-0.1135, 0.0144], [-0.1195, 0.0144]], width: 0.0028, mat: P, bevel: 0.0004 });
  plateXYz(b, { outline: [[-0.0058, 0.0098], [0.0058, 0.0098], [0.0052, 0.0165], [0.0014, 0.0165], [0.0014, 0.0148], [-0.0014, 0.0148], [-0.0014, 0.0165], [-0.0052, 0.0165]], z0: 0.044, z1: 0.052, mat: P, bevel: 0.0005 });
  b.anchor('frontSight', 0, 0.0144, -0.1165);
  b.anchor('rearSight', 0, 0.0148, 0.048);
  b.body();

  // --- Hammer (cocked) with its checkered spur.
  b.part('hammer', [0, -0.006, 0.063]);
  b.extrude({ points: S([[0.057, -0.012], [0.067, -0.013], [0.074, -0.004], [0.083, 0.007], [0.09, 0.0075], [0.089, 0.0015], [0.08, -0.006], [0.07, -0.016], [0.059, -0.017]]), width: 0.0085, mat: P, bevel: 0.0008 });
  if (b.detail(0)) for (let i = 0; i < 5; i++) b.box({ x: 0, y: 0.0068 - i * 0.0004, z: 0.0812 + i * 0.0018, w: 0.0088, h: 0.0008, d: 0.0007, mat: 'black', r: 0, rx: -0.3 });
  b.body();

  // --- Magazine in the grip (base plate visible), slides out along the grip axis.
  const ax = [0.309, -0.951];
  const top = [0.0255, -0.013];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.1167, depth: 0.033, width: 0.0145, angle: -0.314, mat: 'steel', plate: 0.0045, lip: 0.0012, rib: false });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, ax[1], ax[0]];

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.07, 0.056);
  b.anchor('trigger', 0, -0.031, 0.0);
  b.anchor('gripL', -0.022, -0.085, 0.052);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.038;
}

// Smith & Wesson M1917: .45 ACP six-shot revolver on the large N frame, loaded
// with half-moon clips of three. 274 mm long, 140 mm (5.5 in) barrel (WW2DB).
// Tapered barrel with the forged half-moon front sight and the lug that locks
// the ejector rod's tip; fluted cylinder swinging out to the left on its crane,
// thumb latch behind it; top strap with the rear sight groove; side plate held by
// screws on the right; spur hammer (down); smooth walnut stocks on the square butt
// with the lanyard ring. Blued. Heights and frame outline est. from side views.
export function m1917_revolver(b) {
  const P = 'steel';
  const cy = -0.0135; // cylinder axis, below the bore by the chambers' circle
  const MZ = -0.188;
  // --- Barrel, front sight, ejector rod lug.
  lathe(b, { mat: P, seg: 28, profile: [[0.0058, MZ], [0.0082, MZ], [0.0086, MZ + 0.0012], [0.0087, -0.15], [0.009, -0.1], [0.0093, -0.064], [0.0099, -0.0615], [0.0099, -0.052], [0, -0.052]] });
  b.cyl({ z0: MZ - 0.0002, z1: MZ + 0.012, r0: 0.0059, mat: 'black', seg: 12 });
  b.extrude({ points: path([[-0.1782, 0.0072, 1], [-0.1782, 0.0165, 1], [-0.1812, 0.0161], [-0.1842, 0.0144], [-0.1866, 0.0115], [-0.1876, 0.0072, 1]], 3), width: 0.0028, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.0165, -0.1783);
  b.extrude({ points: S([[-0.1035, -0.0072], [-0.0885, -0.0072], [-0.0885, -0.0172], [-0.0915, -0.0192], [-0.1005, -0.0185], [-0.1035, -0.0155]], 2), width: 0.0068, mat: P, bevel: 0.0007 });
  b.cyl({ z0: -0.0985, z1: -0.0476, r0: 0.0027, y: cy, mat: P, seg: 10 }); // ejector rod
  if (b.detail(1)) knurledKnob(b, { at: [0, cy, -0.0955], axis: 'z', r: 0.0039, len: 0.008, teeth: 16, depth: 0.0003, mat: P });

  // --- Frame: front, top strap, recoil shield, trigger guard and the grip frame
  // (its straps show between the stocks).
  const g0 = [0.0392, -0.0268],
    g1 = [0.0565, -0.1175];
  const gl = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]);
  const GT = [(g1[0] - g0[0]) / gl, (g1[1] - g0[1]) / gl];
  const GN = [GT[1], -GT[0]]; // toward the front (-z)
  const gripF = (t) => 0.0166 + 0.0048 * t,
    gripR = (t) => 0.0176 + 0.0028 * t;
  const gp = (t, d) => [g0[0] + GT[0] * gl * t + GN[0] * d, g0[1] + GT[1] * gl * t + GN[1] * d];
  const strapF = [1, 0.85, 0.55, 0.25].map((t) => gp(t, gripF(t) + 0.0013)); // up the front strap
  const strapB = [0.05, 0.35, 0.7, 1].map((t) => gp(t, -gripR(t) - 0.0013)); // down the back strap
  const frame = path(
    [
      [-0.0545, -0.03, 1],
      [-0.0545, 0.0132],
      [-0.0505, 0.0178, 1],
      [0.004, 0.0178, 1],
      [0.0085, 0.0152],
      [0.0125, 0.0085],
      [0.03, 0.0022],
      [0.0408, -0.0022],
      [0.0488, -0.0085],
      [0.0548, -0.0185],
      ...strapB,
      [...gp(1.05, -gripR(1) - 0.0008), 1],
      [...gp(1.05, gripF(1) + 0.0008), 1],
      ...strapF,
      [0.0178, -0.0415],
      [0.0125, -0.0505],
      [0.004, -0.0585],
      [-0.0075, -0.0612],
      [-0.0172, -0.0572],
      [-0.0222, -0.0472],
      [-0.0238, -0.0382, 1],
      [-0.05, -0.0372, 1],
    ],
    3,
  );
  const windowHole = [[-0.0482, -0.0362], [-0.0056, -0.0362], [-0.0056, 0.0098], [-0.0482, 0.0098]];
  const guardHole = S([[-0.0172, -0.0385], [0.0112, -0.0385], [0.0138, -0.0435], [0.0085, -0.0518], [-0.0045, -0.0558], [-0.0135, -0.0532], [-0.0182, -0.0465]], 4);
  b.extrude({ points: frame, holes: [windowHole, guardHole], width: 0.0188, mat: P, bevel: 0.0011 });
  // Rear sight: groove along the top strap ending in the square notch.
  if (b.detail(0)) b.span({ z0: -0.034, z1: 0.0035, y0: 0.0170, y1: 0.01795, w: 0.0034, mat: 'black', r: 0 });
  b.anchor('rearSight', 0, 0.017, 0.003);
  // Side plate screws (right), thumb latch (left), crane screw.
  if (b.detail(0)) {
    for (const [z, y] of [[0.009, -0.006], [0.034, 0.002], [0.026, -0.03]]) screw(b, { at: [0.0094, y, z], axis: 'x', r: 0.0026, h: 0.0008, mat: P, slot: 0.7 });
    screw(b, { at: [0.0094, -0.031, -0.05], axis: 'x', r: 0.0022, h: 0.0007, mat: P, slot: 0.2 });
  }
  b.extrude({ points: S([[-0.0005, -0.0035], [0.0165, -0.0042], [0.0195, 0.0005], [0.0172, 0.0052], [0.0015, 0.005]], 2), width: 0.0024, x: -0.0104, mat: P, bevel: 0.0006 });
  if (b.detail(0)) for (let i = 0; i < 6; i++) b.box({ x: -0.0117, y: 0.0007, z: 0.0035 + i * 0.0024, w: 0.0004, h: 0.0072, d: 0.0007, mat: 'black', r: 0 });
  trigger(b, { z: 0, yTop: -0.037, len: 0.021, curve: 0.006, w: 0.0066, mat: P });
  // Smooth walnut stocks, lanyard ring under the butt.
  sweepGrip(b, { path: [g0, gp(0.5, 0), g1], sections: (t) => ({ w: 0.0336 - 0.0012 * t, f: gripF(t), r: gripR(t), n: 3.2 }), mat: 'walnut' });
  if (b.detail(0)) for (const s of [-1, 1]) screw(b, { at: [s * 0.0168, -0.078, 0.05], axis: s > 0 ? 'x' : '-x', r: 0.0028, h: 0.0009, mat: P, slot: 0.3 });
  const ring = gp(1.06, -0.004);
  bar(b, { pts: [[0, ring[1], ring[0] - 0.0062], [0, ring[1] - 0.0058, ring[0] - 0.004], [0, ring[1] - 0.0082, ring[0] + 0.0015], [0, ring[1] - 0.0058, ring[0] + 0.0068], [0, ring[1], ring[0] + 0.0082]], closed: true, r: 0.0012, mat: P, seg: 8 });

  // --- Cylinder: six chambers, fluted between them, bands at both ends.
  b.part('cylinder', [0, cy, -0.0268]);
  {
    const R = 0.0218;
    const flower = [];
    const M = b.detail(0) ? 72 : b.detail(1) ? 24 : 12;
    for (let i = 0; i < M; i++) {
      const a = (i / M) * PI * 2;
      // Flutes centered between the chambers (chambers at 90 deg + k * 60 deg).
      const d = Math.abs(((((a - PI / 2 - PI / 6) % (PI / 3)) + PI / 3) % (PI / 3)) - PI / 6);
      const r = R - (d < 0.2 ? 0.0032 * Math.sqrt(1 - (d / 0.2) ** 2) : 0);
      flower.push([Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    plateXYz(b, { outline: flower, z0: -0.0408, z1: -0.0118, mat: P, bevel: 0.0005 });
    lathe(b, { mat: P, seg: 40, y: cy, profile: [[0, -0.0478], [R - 0.0009, -0.0478], [R, -0.0469], [R, -0.0404], [0.017, -0.0404], [0, -0.0404]] });
    lathe(b, { mat: P, seg: 40, y: cy, profile: [[0, -0.0122], [0.017, -0.0122], [R, -0.0122], [R, -0.0062], [R - 0.0008, -0.0054], [0, -0.0054]] });
    for (let k = 0; k < 6; k++) {
      const a = PI / 2 + (k * PI) / 3;
      b.cyl({ z0: -0.048, z1: -0.0474, r0: 0.0061, x: Math.cos(a) * 0.0135, y: cy + Math.sin(a) * 0.0135, mat: 'black', seg: 14 });
      if (b.detail(0)) {
        const s = a + PI / 6; // stop notches, between the chambers
        b.box({ x: Math.cos(s) * (R - 0.0003), y: cy + Math.sin(s) * (R - 0.0003), z: -0.0092, w: 0.0026, h: 0.0026, d: 0.0048, rz: s, mat: 'black', r: 0.0003 });
      }
    }
  }
  b.body();
  // --- Hammer, down: spur with checkering on top.
  b.part('hammer', [0, 0.004, 0.034]);
  b.extrude({ points: path([[0.0095, 0.0055, 1], [0.0098, 0.0128, 1], [0.016, 0.0152], [0.028, 0.0178], [0.04, 0.0212], [0.0505, 0.0238], [0.0566, 0.0232], [0.0574, 0.0198], [0.0508, 0.0172], [0.0428, 0.0132], [0.037, 0.0062], [0.0338, -0.004, 1], [0.024, -0.006, 1], [0.0145, -0.0005]], 3), width: 0.0074, mat: P, bevel: 0.0008 });
  if (b.detail(0)) for (let i = 0; i < 6; i++) b.box({ x: 0, y: 0.0206 + i * 0.0006, z: 0.0418 + i * 0.0024, w: 0.0076, h: 0.0005, d: 0.0007, rx: -0.25, mat: 'black', r: 0 });
  b.body();
  b.anchor('ejectionPort', 0, cy, -0.024);

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.072, 0.048);
  b.anchor('trigger', 0, -0.047, 0.0);
  b.anchor('gripL', -0.024, -0.08, 0.047);
  b.meta.sight = 'notch';
  b.meta.cylinderRounds = 6;
  b.meta.gripRake = 0.19;
  b.meta.gripRadius = 0.017;
}

// 2.36 in Rocket Launcher M1A1 "Bazooka": steel tube 1384 mm long, reinforcing
// bands at the muzzle and the breech; no front grip (dropped from the M1). Front
// sight frame on the left with range bars, peep rear sight on a bracket, trigger
// grip with its sheet-steel guard, wooden shoulder stock around the tube holding
// the two dry batteries behind a steel cover, firing wire to the contact spring
// and the rocket latch at the breech. M6A1 rocket loaded from the rear. Olive drab.
// Length from published data; fittings est. from photos.
export function bazooka_m1a1(b) {
  const O = 'olive';
  const R = 0.0322;
  // --- Tube with its end bands and clamp rings.
  tube(b, { z0: -0.864, z1: 0.52, rIn: 0.0302, rOut: R, mat: O, seg: 32 });
  for (const [z0, z1] of [[-0.864, -0.842], [0.494, 0.52]]) lathe(b, { mat: O, seg: 32, profile: [[R, z0 + 0.0015], [0.035, z0], [0.0354, z0 + 0.0025], [0.0354, z1 - 0.0025], [0.035, z1], [R, z1 - 0.0015]] });
  for (const z of [-0.55, -0.02, 0.4]) lathe(b, { mat: 'steel', seg: 32, profile: [[R, z - 0.009], [0.0346, z - 0.008], [0.0348, z + 0.008], [R, z + 0.009]] });
  // Rocket latch and the contact spring at the breech, the firing wire to them.
  b.span({ z0: 0.44, z1: 0.506, y0: 0.031, y1: 0.0378, w: 0.013, mat: 'steel', r: 0.0015 });
  b.extrude({ points: path([[0.452, 0.0375, 1], [0.498, 0.0375], [0.508, 0.0418], [0.502, 0.0442], [0.462, 0.0412]], 3), width: 0.0085, mat: 'steel', bevel: 0.0006 });
  bar(b, { pts: [[0.031, -0.006, 0.47], [0.034, -0.012, 0.51], [0.031, -0.02, 0.53]], r: 0.0016, mat: 'steelBright', seg: 6 }); // contact spring
  bar(b, { pts: [[0.02, -0.035, 0.32], [0.0325, -0.012, 0.36], [0.0335, -0.006, 0.46]], r: 0.0022, mat: 'black', seg: 8 });
  // --- Sights on the left (SX): front frame with the range bars, rear peep.
  const SX = -0.058,
    SY = 0.07,
    bars = [0.0475, 0.0247, 0.0007]; // 50, 100, 150 m: where the solved elevations put them
  b.extrude({ points: path([[-0.565, -0.012, 1], [-0.535, -0.012, 1], [-0.538, 0.004], [-0.562, 0.004]], 2), width: 0.024, x: -0.038, mat: 'steel', bevel: 0.0012 });
  plateXY(b, { outline: [[SX - 0.0125, -0.0085], [SX + 0.0125, -0.0085], [SX + 0.0125, 0.0565], [SX - 0.0125, 0.0565]], holes: [[[SX - 0.0095, -0.0055], [SX + 0.0095, -0.0055], [SX + 0.0095, 0.0535], [SX - 0.0095, 0.0535]]], z: -0.55, thick: 0.0022, mat: 'steel' });
  for (const y of bars) {
    b.span({ z0: -0.5511, z1: -0.5489, y0: y - 0.0009, y1: y, w: 0.019, x: SX, mat: 'steel', r: 0.0002 });
    if (b.detail(0)) for (const sx of [-1, 1]) b.cylAxis({ axis: 'x', x: SX + sx * 0.0134, y: y - 0.0005, z: -0.55, len: 0.0022, r: 0.0011, mat: 'steel', seg: 8 }); // studs on the frame
  }
  b.anchor('frontSight', SX, bars[1], -0.55);
  b.meta.sightRanges = { 50: bars[0], 100: bars[1], 150: bars[2] };
  b.extrude({ points: path([[0.034, -0.002, 1], [0.066, -0.002, 1], [0.062, 0.012], [0.038, 0.012]], 2), width: 0.026, x: -0.037, mat: 'steel', bevel: 0.0012 });
  b.extrude({ points: path([[0.045, 0.006, 1], [0.055, 0.006, 1], [0.0545, SY - 0.004], [0.0455, SY - 0.004]], 2), width: 0.005, x: SX + 0.0105, mat: 'steel', bevel: 0.0006 });
  plateXY(b, { outline: superellipse(SX, SY, 0.016, 0.016, 3, 24), holes: [circle(SX, SY, 0.0018, 14)], z: 0.05, thick: 0.0025, mat: 'steel' });
  b.anchor('rearSight', SX, SY, 0.05);
  // --- Trigger grip and guard on a band.
  b.extrude({ points: path([[-0.046, -0.03, 1], [0.064, -0.03, 1], [0.06, -0.042], [-0.042, -0.042]], 2), width: 0.026, mat: 'steel', bevel: 0.002 });
  sweepGrip(b, { path: [[0.032, -0.04], [0.042, -0.08], [0.054, -0.124]], sections: (t) => ({ w: 0.029, f: 0.0152 + 0.0012 * t, r: 0.0168 + 0.002 * t, n: 2.6 }), dome: 0.12, mat: 'walnut' });
  guard(b, { zf: -0.036, zr: 0.022, yTop: -0.04, yBot: -0.068, t: 0.004, w: 0.01, mat: 'steel', rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.041, len: 0.018, curve: 0.005, mat: 'steel' });
  // --- Wooden shoulder stock around the tube, battery cover on its left.
  stock(b, {
    top: [[0.066, 0.008], [0.345, 0.008]],
    bottom: [[0.066, -0.036], [0.12, -0.049], [0.2, -0.068], [0.27, -0.083], [0.32, -0.081], [0.345, -0.07]],
    width: [[0.066, 0.07], [0.345, 0.074]],
    n: 3,
    wTop: 0.92,
    wBot: 0.78,
    belly: 0.55,
    chDepth: 0,
    mat: 'walnut',
    roundStart: 0.012,
    roundEnd: 0.008,
  });
  b.box({ x: -0.0366, y: -0.04, z: 0.23, w: 0.0018, h: 0.036, d: 0.11, mat: 'steel', r: 0.0008 }); // battery cover
  if (b.detail(0)) for (const z of [0.184, 0.276]) screw(b, { at: [-0.0375, -0.04, z], axis: '-x', r: 0.0026, h: 0.0008, mat: 'steel' });
  swivel(b, { x: -0.034, y: 0.0, z: -0.7, r: 0.008, w: 0.004 });
  swivel(b, { x: 0, y: -0.083, z: 0.3, r: 0.008, w: 0.004 });
  // --- M6A1 rocket, loaded (tail and fins visible at the rear).
  b.part('rocket', [0, 0, 0.23]);
  lathe(b, { mat: 'olive', seg: 24, profile: [[0, -0.045], [0.012, -0.04], [0.024, -0.02], [0.0292, 0.01], [0.0292, 0.15], [0.02, 0.17], [0.0115, 0.18], [0, 0.18]] });
  b.cyl({ z0: 0.17, z1: 0.5, r0: 0.0105, mat: 'steel', seg: 14 });
  for (let k = 0; k < 4; k++) {
    const a = (k * PI) / 2 + PI / 4;
    place(b, { pos: [0, 0, 0], rot: [0, 0, a], order: 'XYZ' }, () => {
      b.span({ z0: 0.43, z1: 0.5, y0: 0.009, y1: 0.0285, w: 0.0012, mat: 'steel', r: 0.0003 });
    });
  }
  b.body();

  b.anchor('muzzle', 0, 0, -0.864);
  b.anchor('gripR', 0, -0.078, 0.042);
  b.anchor('trigger', 0, -0.048, 0.0);
  b.anchor('gripL', 0, -0.07, -0.3); // left hand under the tube (no front grip on the M1A1)
  b.anchor('shoulder', 0, -0.08, 0.27);
  b.meta.sight = 'post'; // range bars on the front frame, peep at the rear
  b.meta.rocketAxis = [0, 0, 1]; // loaded from the rear
}

// Fragmentation hand grenade Mk 2 "pineapple": cast iron body 89 mm tall and 58 mm
// across, 114 mm with the fuze (Wikipedia), its surface cut into 5 rows of 8 knobs;
// filler plug in the base; olive drab paint with the yellow band of a high-explosive
// filling at the neck. M10A3 fuze: striker housing on the threaded fuze body, the
// safety lever ("spoon") down one side held by the split pin with its pull ring.
// Groove and fuze sizes est. from photos. Upright: +Y = fuze end; origin at the
// body center.
export function mk2_grenade(b) {
  const lod = b.lod;
  // Body outline [r, y] from the base to the neck, smoothed and measured along.
  const keys = [
    [0.0, -0.0445],
    [0.0125, -0.0445],
    [0.0158, -0.0436],
    [0.0198, -0.0408],
    [0.0246, -0.034],
    [0.0277, -0.024],
    [0.029, -0.01],
    [0.029, 0.004],
    [0.0279, 0.018],
    [0.0252, 0.029],
    [0.0212, 0.037],
    [0.0165, 0.042],
    [0.0128, 0.0445],
  ];
  const prof = S(keys, 8, false);
  const sAt = [0];
  for (let i = 1; i < prof.length; i++) sAt.push(sAt[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const L = sAt[sAt.length - 1];
  // Point and outward normal of the outline at arc length s.
  const at = (s) => {
    let i = 1;
    while (i < prof.length - 1 && sAt[i] < s) i++;
    const t = Math.max(0, Math.min(1, (s - sAt[i - 1]) / (sAt[i] - sAt[i - 1] || 1)));
    const p0 = prof[i - 1],
      p1 = prof[i];
    const dr = p1[0] - p0[0],
      dy = p1[1] - p0[1],
      l = Math.hypot(dr, dy) || 1;
    return { r: p0[0] + dr * t, y: p0[1] + dy * t, nr: dy / l, ny: -dr / l };
  };
  const sOfY = (y, from) => {
    for (let s = from; s < L; s += 0.0002) if (at(s).y >= y) return s;
    return L;
  };
  // Knob zone: 5 rows between the base and the shoulder, 8 columns around.
  const sA = sOfY(-0.0385, 0.012),
    sB = sOfY(0.0375, sA);
  const pitch = (sB - sA) / 5;
  const D = 0.0033, // groove depth
    gw = 0.0027, // half-width at the surface
    gb = 0.0008; // half-width of the flat groove bottom
  const groove = (e) => D * (1 - smoothstep(gb, gw, e));
  // Samples across a row or column (fractions of the pitch), finer at the grooves.
  const A = lod === 0 ? [0, 0.045, 0.09, 0.135, 0.2, 0.34, 0.5, 0.66, 0.8, 0.865, 0.91, 0.955] : [0, 0.14, 0.5, 0.86];
  const C = lod === 0 ? [0, 0.03, 0.06, 0.095, 0.15, 0.3, 0.5, 0.7, 0.85, 0.905, 0.94, 0.97] : [0, 0.1, 0.5, 0.9];
  const ss = [0];
  if (lod < 2) {
    for (const f of [0.35, 0.7]) ss.push(sA * f);
    for (let k = 0; k < 5; k++) for (const a of A) ss.push(sA + (k + a) * pitch);
    ss.push(sB);
    for (const f of [0.35, 0.7, 1]) ss.push(sB + (L - sB) * f);
  } else for (let k = 1; k <= 7; k++) ss.push((L * k) / 7);
  const thetas = [];
  if (lod < 2) for (let c = 0; c < 8; c++) for (const f of C) thetas.push(((c + f) / 8) * Math.PI * 2);
  else for (let k = 0; k < 10; k++) thetas.push((k / 10) * Math.PI * 2);
  const rings = ss.map((s) => {
    const p = at(s);
    // Grooves between the rows (also bounding the top and bottom rows) and between
    // the columns (only across the knob zone).
    const kr = Math.round((s - sA) / pitch);
    const eS = Math.abs(s - (sA + Math.max(0, Math.min(5, kr)) * pitch));
    const dS = lod < 2 ? groove(eS) : 0;
    const fade = smoothstep(sA - gw, sA, s) * (1 - smoothstep(sB, sB + gw, s));
    const colPitch = (2 * Math.PI * p.r) / 8;
    return thetas.map((th) => {
      const c = ((th / (Math.PI * 2)) * 8) % 1;
      const dC = lod < 2 ? groove(Math.min(c, 1 - c) * colPitch) * fade : 0;
      const d = Math.max(dS, dC);
      const r = p.r - d * p.nr,
        y = p.y - d * p.ny;
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    });
  });
  ringLoft(b, { rings, us: ss, mat: 'oliveCast', capStart: false });
  // Yellow band around the neck: high-explosive filling.
  if (b.detail(1)) {
    const band = [];
    for (let s = sOfY(0.0392, sB); s <= sOfY(0.0438, sB) + 1e-6; s += 0.0006) {
      const p = at(s);
      band.push([p.r + 0.00012 * p.nr, p.y + 0.00012 * p.ny]);
    }
    latheY(b, { profile: band, mat: 'yellowPaint', seg: 48 });
  }
  screw(b, { at: [0, -0.0445, 0], axis: '-y', r: 0.0058, h: 0.0009, slot: 0.6, mat: 'oliveCast', dome: false }); // filler plug
  // Neck of the casting, threaded fuze body, striker housing.
  latheY(b, { mat: 'oliveCast', seg: 32, profile: [[0.0128, 0.0444], [0.0121, 0.0452], [0.0118, 0.046], [0.0118, 0.0488], [0.0112, 0.0494], [0, 0.0494]] });
  latheY(b, { mat: 'parkerized', seg: 28, profile: [[0.0104, 0.0492], [0.0104, 0.0526], [0.0098, 0.0532], [0, 0.0532]] });
  b.box({ x: -0.0004, y: 0.0588, z: 0, w: 0.0122, h: 0.0118, d: 0.0122, mat: 'parkerized', r: 0.0022 });
  b.cylAxis({ axis: 'z', x: 0.0012, y: 0.0642, z: 0, len: 0.0142, r: 0.0011, mat: 'steelBright', seg: 10 }); // striker hinge pin
  // Spoon: hooked over the striker, down the side over the knobs.
  const spoon = [
    [-0.0056, 0.0646, 0],
    [-0.001, 0.0664, 0],
    [0.0052, 0.0662, 0],
    [0.0092, 0.0634, 0],
    [0.0104, 0.058, 0],
    [0.0112, 0.0525, 0],
    [0.0142, 0.0478, 0],
    [0.0196, 0.0438, 0],
    [0.0246, 0.0372, 0],
    [0.0284, 0.0282, 0],
    [0.0306, 0.0168, 0],
    [0.0313, 0.0062, 0],
  ];
  ribbon(b, { pts: spoon, width: 0.0112, thick: 0.001, face: (p, T) => [-T[1], T[0], 0], mat: 'olive' });
  for (const sz of [-1, 1]) b.box({ x: 0.0086, y: 0.0572, z: sz * 0.0061, w: 0.0052, h: 0.0092, d: 0.001, mat: 'olive', r: 0.0003 }); // spoon side flanges
  // Split pin through the flanges and the fuze, pull ring standing beside the
  // fuze (a part of its own: it comes out when the pin is pulled).
  b.part('pin', [0.0085, 0.0658, -0.0136]);
  b.cylAxis({ axis: 'z', x: 0.0082, y: 0.0556, z: -0.0022, len: 0.0218, r: 0.0008, mat: 'steelBright', seg: 8 });
  const ring = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    ring.push([0.0085 + Math.sin(a) * 0.0102, 0.0658 - Math.cos(a) * 0.0102, -0.0136]);
  }
  bar(b, { pts: ring, r: 0.00095, closed: true, mat: 'steelBright', seg: 8 });
  b.body();

  b.anchor('gripR', 0.012, 0.0, 0.0);
  b.anchor('gripL', 0.0085, 0.0658, -0.0136); // pull ring
  b.anchor('pin', 0.0085, 0.0658, -0.0136);
  b.anchor('spoon', 0.0313, 0.0062, 0.0);
  b.meta.kind = 'grenade';
  b.meta.fuse = 4.5; // s (M10A3 fuze, 4-5 s)
}
