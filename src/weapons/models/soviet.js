// Soviet small arms. See kit.js for the coordinate conventions:
// meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at z = 0.
import { S, place, slot, boxMag, guard, trigger, lathe, tube, swivel, taperZ, path, loft } from './parts.js';

const PI = Math.PI;

// Mosin-Nagant 1891/30 family: 7.62x54R bolt action, 1232 mm, 730 mm barrel,
// hooded front post, tangent rear sight graduated in meters, straight wrist,
// birch stock with sling slots. v.pu = sniper with the PU 3.5x scope on a side
// mount and the long turned-down bolt handle.
function mosin(b, v = {}) {
  const P = 'steel';
  lathe(b, {
    mat: P,
    profile: [
      [0, -0.215],
      [0.0146, -0.215],
      [0.0146, -0.3],
      [0.0128, -0.32],
      [0.0118, -0.45],
      [0.0106, -0.6],
      [0.0096, -0.75],
      [0.009, -0.902],
      [0, -0.902],
    ],
  });
  // Front sight: base ring, post, round hood.
  b.cyl({ z0: -0.902, z1: -0.884, r0: 0.0118, mat: P, seg: 18 });
  b.span({ z0: -0.9, z1: -0.886, y0: 0.008, y1: 0.0135, w: 0.008, mat: P, r: 0.0012 });
  b.extrude({ points: [[-0.896, 0.013], [-0.89, 0.013], [-0.8908, 0.0236], [-0.8952, 0.0236]], width: 0.0018, mat: P, bevel: 0.0002 });
  tube(b, { z0: -0.9, z1: -0.885, rIn: 0.0104, rOut: 0.0114, y: 0.0162, mat: P, seg: 18 });
  b.anchor('frontSight', 0, 0.0236, -0.893);
  // Bands with springs, cleaning rod head under the nose.
  b.span({ z0: -0.822, z1: -0.808, y0: -0.03, y1: 0.0145, w: 0.032, mat: P, r: 0.004 });
  b.span({ z0: -0.632, z1: -0.618, y0: -0.034, y1: 0.0195, w: 0.035, mat: P, r: 0.004 });
  b.cyl({ z0: -0.842, z1: -0.82, r0: 0.0035, y: -0.017, mat: 'steelBright', seg: 10 });
  b.sphere({ x: 0, y: -0.017, z: -0.843, r: 0.0045, mat: 'steelBright' });
  // Handguard from the rear sight to the lower band.
  b.extrude({ points: S([[-0.626, -0.001], [-0.318, -0.001], [-0.32, 0.0155], [-0.47, 0.019], [-0.624, 0.0165]]), width: 0.028, mat: 'beech', bevel: 0.0085 });
  // Stock.
  const stock = path(
    [
      [-0.824, -0.004, 1],
      [-0.6, -0.003],
      [-0.4, -0.004],
      [-0.22, -0.008],
      [-0.06, -0.01],
      [0.0, -0.006],
      [0.03, -0.002],
      [0.14, -0.018],
      [0.322, -0.042, 1],
      [0.322, -0.162, 1],
      [0.21, -0.126],
      [0.12, -0.092],
      [0.08, -0.074],
      [0.055, -0.062],
      [-0.07, -0.052],
      [-0.17, -0.05],
      [-0.21, -0.04],
      [-0.4, -0.034],
      [-0.6, -0.031],
      [-0.822, -0.025, 1],
    ],
    3,
  );
  const tp = taperZ([[-0.3, 0.74], [-0.21, 0.86], [0.0, 0.86], [0.08, 0.76], [0.16, 0.82], [0.28, 1.0]]);
  loft(b, { points: stock, width: 0.044, mat: 'beech', r: 0.009, taper: tp });
  b.extrude({ points: [[0.32, -0.0415], [0.33, -0.0415], [0.33, -0.1625], [0.32, -0.1625]], width: 0.044, mat: P, bevel: 0.002 });
  // Sling slots (butt, fore-end) instead of swivels.
  b.extrude({ points: slot(0.17, 0.212, -0.088, 0.006), width: 0.044 * tp(0.19) + 0.0006, mat: 'black', bevel: 0.0004 });
  b.extrude({ points: slot(-0.6, -0.565, -0.02, 0.0045), width: 0.044 * tp(-0.58) + 0.0006, mat: 'black', bevel: 0.0004 });

  // Receiver: round ring, magazine body, bridge with stripper guide, tang.
  b.cyl({ z0: -0.215, z1: -0.168, r0: 0.0168, mat: P, seg: 24 });
  b.span({ z0: -0.172, z1: -0.086, y0: -0.03, y1: -0.002, w: 0.03, mat: P, r: 0.003 });
  for (const sx of [-1, 1]) b.span({ z0: -0.172, z1: -0.086, y0: -0.006, y1: 0.009, w: 0.004, x: sx * 0.0118, mat: P, r: 0.0012 });
  b.cyl({ z0: -0.092, z1: -0.062, r0: 0.0155, mat: P, seg: 24 });
  b.span({ z0: -0.09, z1: -0.08, y0: 0.012, y1: 0.021, w: 0.02, mat: P, r: 0.001 });
  b.span({ z0: -0.062, z1: 0.024, y0: -0.009, y1: -0.001, w: 0.013, mat: P, r: 0.002 });
  b.anchor('clipGuide', 0, 0.022, -0.085);
  b.anchor('ejectionPort', 0.012, 0.012, -0.13);
  // Protruding magazine box with floor plate, trigger guard, long trigger.
  b.span({ z0: -0.168, z1: -0.072, y0: -0.068, y1: -0.04, w: 0.031, mat: P, r: 0.003 });
  b.span({ z0: -0.16, z1: -0.08, y0: -0.071, y1: -0.066, w: 0.026, mat: P, r: 0.0015 });
  guard(b, { zf: -0.072, zr: 0.05, yTop: -0.05, yBot: -0.08, t: 0.0045, w: 0.012, mat: P, rake: 0.008 });
  trigger(b, { z: 0, yTop: -0.05, len: 0.026, curve: 0.008, mat: P });

  // Tangent rear sight on the barrel: base, leaf hinged at the front.
  b.cyl({ z0: -0.318, z1: -0.268, r0: 0.0158, mat: P, seg: 20 });
  b.span({ z0: -0.318, z1: -0.222, y0: 0.009, y1: 0.0185, w: 0.024, mat: P, r: 0.002 });
  b.part('rearSight', [0, 0.0192, -0.313]);
  b.span({ z0: -0.315, z1: -0.222, y0: 0.0178, y1: 0.0206, w: 0.016, mat: P, r: 0.0007 });
  b.span({ z0: -0.262, z1: -0.25, y0: 0.0195, y1: 0.0225, w: 0.019, mat: P, r: 0.0008 }); // slider
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.226, 0.019], [-0.222, 0.019], [-0.222, 0.0262], [-0.226, 0.0262]], width: 0.006, x: sx * 0.0042, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.226, z1: -0.222, y0: 0.019, y1: 0.0236, w: 0.0026, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0236, -0.224);
  b.body();
  b.meta.sightKind = 'leaf';

  // Bolt with the cocking knob; straight handle, or long bent one for the PU.
  b.part('bolt', [0, 0, 0.01]);
  b.cyl({ z0: -0.172, z1: -0.04, r0: 0.0095, mat: 'steelBright', seg: 18 });
  b.cyl({ z0: -0.04, z1: -0.004, r0: 0.0108, mat: P, seg: 18 });
  b.cyl({ z0: -0.004, z1: 0.01, r0: 0.0125, mat: P, seg: 20 });
  if (v.pu) {
    b.rod({ from: [0.008, 0.0, -0.05], to: [0.036, -0.008, -0.048], r: 0.0042, mat: 'steelBright' });
    b.rod({ from: [0.036, -0.008, -0.048], to: [0.05, -0.036, -0.044], r: 0.0038, mat: 'steelBright' });
    b.sphere({ x: 0.051, y: -0.041, z: -0.043, r: 0.0088, mat: 'steelBright' });
    b.anchor('boltHandle', 0.051, -0.041, -0.043);
  } else {
    b.rod({ from: [0.008, 0.0, -0.05], to: [0.052, -0.004, -0.047], r: 0.0042, r1: 0.0036, mat: 'steelBright' });
    b.sphere({ x: 0.058, y: -0.005, z: -0.046, r: 0.0088, mat: 'steelBright' });
    b.anchor('boltHandle', 0.058, -0.005, -0.046);
  }
  b.body();

  if (v.pu) {
    // PU 3.5x scope on the side mount (base on the left of the receiver).
    const yc = 0.047;
    b.span({ z0: -0.205, z1: -0.075, y0: -0.012, y1: 0.012, w: 0.008, x: -0.0195, mat: P, r: 0.002 });
    for (const z of [-0.18, -0.09]) {
      b.span({ z0: z - 0.008, z1: z + 0.008, y0: 0.006, y1: yc - 0.004, w: 0.008, x: -0.016, mat: P, r: 0.0015 });
      tube(b, { y: yc, z0: z - 0.008, z1: z + 0.008, rIn: 0.0115, rOut: 0.0142, mat: P, seg: 22 });
    }
    lathe(b, {
      mat: P,
      y: yc,
      seg: 22,
      profile: [
        [0, -0.036],
        [0.0148, -0.036],
        [0.0155, -0.04],
        [0.0155, -0.066],
        [0.0115, -0.074],
        [0.0115, -0.19],
        [0.0125, -0.195],
        [0.0125, -0.205],
        [0, -0.205],
      ],
    });
    b.cylAxis({ axis: 'y', x: 0, y: yc + 0.014, z: -0.135, len: 0.009, r: 0.0085, mat: P });
    b.cylAxis({ axis: 'x', x: -0.014, y: yc, z: -0.135, len: 0.009, r: 0.0085, mat: P });
    b.cylAxis({ axis: 'z', x: 0, y: yc, z: -0.0357, len: 0.0006, r: 0.0135, mat: 'glass' });
    b.cylAxis({ axis: 'z', x: 0, y: yc, z: -0.2053, len: 0.0006, r: 0.011, mat: 'glass' });
    b.anchor('scopeEye', 0, yc, -0.0356);
    b.anchor('scopeFront', 0, yc, -0.2054);
    b.meta.sight = 'scope';
    b.meta.scopeMag = 3.5;
  } else {
    b.meta.sight = 'notch';
  }

  b.anchor('muzzle', 0, 0, -0.902);
  b.anchor('gripR', 0, -0.055, 0.08);
  b.anchor('trigger', 0, -0.064, 0.002);
  b.anchor('gripL', 0, -0.03, -0.42);
  b.anchor('shoulder', 0, -0.1, 0.33);
  b.meta.boltThrow = 0.1;
  b.meta.boltLift = PI / 2;
}

// Mosin-Nagant 1891/30 rifle.
export function mosin_9130(b) {
  mosin(b);
}

// Mosin-Nagant 1891/30 sniper with the PU 3.5x scope.
export function mosin_pu(b) {
  mosin(b, { pu: true });
}

// Shared self-loading rifle builder for the SVT-40 and AVS-36.
// SVT-40: 7.62x54R, 1226 mm, 625 mm barrel, six-baffle muzzle brake, hooded
// front post on the gas block, vented steel handguard over the gas cylinder,
// cleaning rod on the right of the stock, 10-round magazine.
export function svt40(b) {
  const P = 'steel';
  lathe(b, { mat: P, profile: [[0, -0.245], [0.0135, -0.245], [0.0128, -0.31], [0.0114, -0.45], [0.0102, -0.62], [0.0094, -0.826], [0, -0.826]] });
  // Muzzle brake with six slots a side.
  lathe(b, { mat: P, profile: [[0.006, -0.896], [0.0105, -0.896], [0.0118, -0.892], [0.0118, -0.83], [0.0108, -0.826], [0.006, -0.826]] });
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) b.box({ x: sx * 0.0113, y: 0, z: -0.889 + i * 0.0105, w: 0.002, h: 0.0125, d: 0.0045, mat: 'black', r: 0.0006 });
  // Gas block with the front sight post and hood.
  b.span({ z0: -0.826, z1: -0.798, y0: -0.012, y1: 0.024, w: 0.021, mat: P, r: 0.003 });
  b.extrude({ points: [[-0.816, 0.022], [-0.808, 0.022], [-0.8092, 0.032], [-0.8148, 0.032]], width: 0.0018, mat: P, bevel: 0.0002 });
  tube(b, { z0: -0.82, z1: -0.804, rIn: 0.0092, rOut: 0.0102, y: 0.027, mat: P, seg: 18 });
  b.anchor('frontSight', 0, 0.032, -0.812);
  // Gas cylinder under the vented cover, barrel band, wooden handguard.
  b.cyl({ z0: -0.8, z1: -0.62, r0: 0.0075, y: 0.017, mat: P, seg: 14 });
  b.span({ z0: -0.645, z1: -0.468, y0: -0.004, y1: 0.0275, w: 0.03, mat: P, r: 0.006 });
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) b.cylAxis({ axis: 'x', x: sx * 0.0148, y: 0.013, z: -0.625 + i * 0.04, len: 0.0012, r: 0.0055, mat: 'black', seg: 12 });
  b.span({ z0: -0.664, z1: -0.646, y0: -0.031, y1: 0.0295, w: 0.034, mat: P, r: 0.004 });
  swivel(b, { x: -0.019, y: -0.012, z: -0.655, r: 0.007, w: 0.003 });
  b.extrude({ points: S([[-0.47, -0.002], [-0.31, -0.002], [-0.312, 0.022], [-0.4, 0.0265], [-0.468, 0.0255]]), width: 0.03, mat: 'beech', bevel: 0.008 });
  // Stock with semi-pistol grip; cleaning rod in a groove on the right.
  const stock = path(
    [
      [-0.664, -0.004, 1],
      [-0.45, -0.004],
      [-0.3, -0.007],
      [-0.25, -0.013],
      [-0.06, -0.013],
      [-0.012, -0.008],
      [0.008, 0.0],
      [0.06, -0.004],
      [0.2, -0.024],
      [0.324, -0.042, 1],
      [0.322, -0.164, 1],
      [0.21, -0.132],
      [0.13, -0.098],
      [0.108, -0.096],
      [0.088, -0.1],
      [0.068, -0.094],
      [0.055, -0.076],
      [0.05, -0.058],
      [-0.08, -0.058],
      [-0.24, -0.055],
      [-0.28, -0.04],
      [-0.45, -0.034],
      [-0.662, -0.03, 1],
    ],
    3,
  );
  loft(b, { points: stock, width: 0.042, mat: 'beech', r: 0.009, taper: taperZ([[-0.33, 0.78], [-0.25, 0.88], [0.0, 0.88], [0.07, 0.8], [0.13, 0.82], [0.26, 1.0]]) });
  b.extrude({ points: [[0.322, -0.0415], [0.331, -0.0415], [0.329, -0.1645], [0.32, -0.1645]], width: 0.042, mat: P, bevel: 0.002 });
  b.cyl({ z0: -0.66, z1: -0.33, r0: 0.0028, x: 0.0165, y: -0.018, mat: 'steelBright', seg: 8 });
  swivel(b, { x: -0.021, y: -0.12, z: 0.21, r: 0.008, w: 0.003 });
  // Tangent rear sight on the barrel.
  b.span({ z0: -0.312, z1: -0.244, y0: 0.01, y1: 0.0235, w: 0.024, mat: P, r: 0.0022 });
  b.part('rearSight', [0, 0.0245, -0.308]);
  b.span({ z0: -0.309, z1: -0.246, y0: 0.023, y1: 0.026, w: 0.017, mat: P, r: 0.0007 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.25, 0.0245], [-0.246, 0.0245], [-0.246, 0.0345], [-0.25, 0.0345]], width: 0.0062, x: sx * 0.0044, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.25, z1: -0.246, y0: 0.0245, y1: 0.0318, w: 0.0026, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.032, -0.248);
  b.body();
  b.meta.sightKind = 'leaf';
  // Receiver, trigger guard, magazine catch.
  b.span({ z0: -0.245, z1: 0.02, y0: -0.032, y1: 0.01, w: 0.03, mat: P, r: 0.004 });
  b.span({ z0: -0.21, z1: -0.13, y0: 0.004, y1: 0.0115, w: 0.002, x: 0.0148, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.016, 0.008, -0.17);
  guard(b, { zf: -0.055, zr: 0.05, yTop: -0.056, yBot: -0.086, t: 0.0045, w: 0.011, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.058, len: 0.02, curve: 0.006, mat: P });
  b.span({ z0: -0.146, z1: -0.136, y0: -0.074, y1: -0.056, w: 0.008, mat: P, r: 0.0012 });
  // Bolt carrier with the charging handle on the right.
  b.part('bolt', [0, 0, -0.08]);
  b.span({ z0: -0.235, z1: -0.08, y0: 0.004, y1: 0.0185, w: 0.02, mat: 'steelBright', r: 0.003 });
  b.cylAxis({ axis: 'x', x: 0.02, y: 0.01, z: -0.165, len: 0.012, r: 0.0038, mat: P });
  b.sphere({ x: 0.027, y: 0.01, z: -0.165, r: 0.0058, mat: P });
  b.anchor('chargingHandle', 0.032, 0.01, -0.165);
  b.body();
  // 10-round magazine.
  const top = [-0.198, -0.024];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.1, depth: 0.09, width: 0.026, angle: 0.03, k: 0.4, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.896);
  b.anchor('gripR', 0, -0.075, 0.078);
  b.anchor('trigger', 0, -0.068, 0.0);
  b.anchor('gripL', 0, -0.035, -0.42);
  b.anchor('shoulder', 0, -0.1, 0.331);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.085;
}

// AVS-36 (Simonov): 7.62x54R select-fire rifle, 1236 mm, 615 mm barrel, large
// two-port muzzle brake, bayonet lug, vented steel cover over the gas tube in
// front of the wooden handguard, big charging handle on the right, 15-round
// magazine, straight-wrist stock.
export function avs36(b) {
  const P = 'steel';
  lathe(b, { mat: P, profile: [[0, -0.265], [0.0138, -0.265], [0.013, -0.33], [0.0116, -0.48], [0.0104, -0.66], [0.0098, -0.85], [0, -0.85]] });
  // Muzzle brake: big cylinder with two large ports a side.
  lathe(b, { mat: P, profile: [[0.006, -0.92], [0.0138, -0.92], [0.0158, -0.914], [0.0158, -0.856], [0.013, -0.85], [0.006, -0.85]] });
  for (const z of [-0.904, -0.876]) for (const sx of [-1, 1]) b.box({ x: sx * 0.0152, y: 0, z, w: 0.002, h: 0.018, d: 0.016, mat: 'black', r: 0.002 });
  // Front sight post with hood on its base, bayonet lug.
  b.cyl({ z0: -0.85, z1: -0.828, r0: 0.0115, mat: P, seg: 18 });
  b.span({ z0: -0.848, z1: -0.83, y0: 0.006, y1: 0.0195, w: 0.012, mat: P, r: 0.002 });
  b.extrude({ points: [[-0.843, 0.019], [-0.835, 0.019], [-0.8362, 0.0292], [-0.8418, 0.0292]], width: 0.0018, mat: P, bevel: 0.0002 });
  tube(b, { z0: -0.847, z1: -0.831, rIn: 0.0092, rOut: 0.0102, y: 0.0222, mat: P, seg: 18 });
  b.anchor('frontSight', 0, 0.0292, -0.839);
  b.span({ z0: -0.845, z1: -0.82, y0: -0.024, y1: -0.012, w: 0.008, mat: P, r: 0.0015 });
  // Gas tube, vented cover, band, handguard, cleaning rod.
  b.cyl({ z0: -0.69, z1: -0.33, r0: 0.0072, y: 0.016, mat: P, seg: 14 });
  b.cyl({ z0: -0.69, z1: -0.53, r0: 0.0155, y: 0.008, mat: 'perforated', open: true, seg: 20 });
  b.span({ z0: -0.712, z1: -0.692, y0: -0.032, y1: 0.0255, w: 0.034, mat: P, r: 0.004 });
  swivel(b, { x: -0.019, y: -0.012, z: -0.702, r: 0.007, w: 0.003 });
  b.extrude({ points: S([[-0.532, -0.002], [-0.33, -0.002], [-0.332, 0.0205], [-0.44, 0.0238], [-0.53, 0.023]]), width: 0.03, mat: 'beech', bevel: 0.008 });
  b.cyl({ z0: -0.86, z1: -0.7, r0: 0.0028, y: -0.017, mat: 'steelBright', seg: 8 });
  // Straight-wrist stock.
  const stock = path(
    [
      [-0.712, -0.004, 1],
      [-0.5, -0.004],
      [-0.33, -0.007],
      [-0.27, -0.013],
      [-0.06, -0.013],
      [-0.01, -0.008],
      [0.02, -0.002],
      [0.14, -0.018],
      [0.31, -0.04, 1],
      [0.308, -0.16, 1],
      [0.2, -0.124],
      [0.11, -0.088],
      [0.07, -0.072],
      [0.05, -0.06],
      [-0.08, -0.058],
      [-0.26, -0.055],
      [-0.3, -0.04],
      [-0.5, -0.034],
      [-0.71, -0.03, 1],
    ],
    3,
  );
  loft(b, { points: stock, width: 0.042, mat: 'beech', r: 0.009, taper: taperZ([[-0.36, 0.78], [-0.28, 0.88], [0.0, 0.88], [0.08, 0.78], [0.16, 0.84], [0.27, 1.0]]) });
  b.extrude({ points: [[0.308, -0.0395], [0.317, -0.0395], [0.315, -0.1605], [0.306, -0.1605]], width: 0.042, mat: P, bevel: 0.002 });
  swivel(b, { x: -0.021, y: -0.115, z: 0.2, r: 0.008, w: 0.003 });
  // Tangent rear sight.
  b.span({ z0: -0.333, z1: -0.264, y0: 0.01, y1: 0.0215, w: 0.024, mat: P, r: 0.0022 });
  b.part('rearSight', [0, 0.0225, -0.329]);
  b.span({ z0: -0.33, z1: -0.266, y0: 0.021, y1: 0.024, w: 0.017, mat: P, r: 0.0007 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.27, 0.0225], [-0.266, 0.0225], [-0.266, 0.0318], [-0.27, 0.0318]], width: 0.0062, x: sx * 0.0044, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.27, z1: -0.266, y0: 0.0225, y1: 0.0292, w: 0.0026, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0292, -0.268);
  b.body();
  b.meta.sightKind = 'leaf';
  // Receiver, selector, trigger guard.
  b.span({ z0: -0.265, z1: 0.02, y0: -0.034, y1: 0.011, w: 0.032, mat: P, r: 0.004 });
  b.span({ z0: -0.215, z1: -0.135, y0: 0.004, y1: 0.0125, w: 0.002, x: 0.0158, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.017, 0.008, -0.175);
  b.cylAxis({ axis: 'x', x: -0.017, y: -0.02, z: -0.035, len: 0.004, r: 0.0055, mat: P });
  guard(b, { zf: -0.055, zr: 0.05, yTop: -0.056, yBot: -0.086, t: 0.0045, w: 0.011, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.058, len: 0.02, curve: 0.006, mat: P });
  // Bolt carrier with the big charging handle on the right.
  b.part('bolt', [0, 0, -0.09]);
  b.span({ z0: -0.25, z1: -0.09, y0: 0.004, y1: 0.0185, w: 0.02, mat: 'steelBright', r: 0.003 });
  b.span({ z0: -0.19, z1: -0.15, y0: -0.004, y1: 0.012, w: 0.008, x: 0.02, mat: P, r: 0.002 });
  b.cylAxis({ axis: 'x', x: 0.03, y: 0.004, z: -0.17, len: 0.014, r: 0.0065, mat: P, seg: 16 });
  b.anchor('chargingHandle', 0.037, 0.004, -0.17);
  b.body();
  // 15-round magazine.
  const top = [-0.215, -0.024];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.142, depth: 0.09, width: 0.027, angle: 0.03, k: 0.6, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.92);
  b.anchor('gripR', 0, -0.06, 0.08);
  b.anchor('trigger', 0, -0.068, 0.0);
  b.anchor('gripL', 0, -0.035, -0.44);
  b.anchor('shoulder', 0, -0.1, 0.317);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.09;
}

// 71-round drum (PPD-40 / PPSh-41): a disc seen from the side, with the feed
// tower on top. Built around the Z axis, turned so its axis runs along X.
// (z, y) = drum center; tower = height of the neck up to the magazine well.
function drum71(b, { z, y, r = 0.095, t = 0.056, tower = 0.05, mat = 'steel' }) {
  place(b, { pos: [0, y, z], rot: [0, PI / 2, 0] }, () => {
    lathe(b, {
      mat,
      seg: 36,
      profile: [
        [0, -t / 2 - 0.006],
        [0.032, -t / 2 - 0.006],
        [0.036, -t / 2 - 0.002],
        [r - 0.006, -t / 2],
        [r, -t / 2 + 0.006],
        [r + 0.0015, -t / 2 + 0.012],
        [r, t / 2 - 0.006],
        [r - 0.006, t / 2],
        [0.04, t / 2 + 0.002],
        [0.022, t / 2 + 0.008],
        [0, t / 2 + 0.008],
      ],
    });
    for (const e of [-1, 1]) tube(b, { z0: e * (t / 2 - 0.016), z1: e * (t / 2 - 0.01), rIn: r - 0.002, rOut: r + 0.0025, mat, seg: 36 });
  });
  // Feed tower up into the magazine well.
  b.span({ z0: z + 0.004, z1: z + 0.046, y0: y + r - 0.012, y1: y + r + tower, w: 0.026, mat, r: 0.003 });
}

// PPSh-41: 7.62x25 open-bolt SMG, 843 mm, 269 mm barrel, perforated jacket
// ending in the slanted muzzle compensator, hooded front post, flip rear sight
// (100/200 m), stamped hinged receiver, birch stock, 71-round drum.
export function ppsh41(b) {
  const P = 'steel';
  // Barrel inside the perforated jacket; slanted compensator at the front.
  b.cyl({ z0: -0.468, z1: -0.205, r0: 0.0085, mat: P, seg: 14 });
  b.cyl({ z0: -0.466, z1: -0.21, r0: 0.0198, mat: 'perforated', open: true, seg: 24 });
  tube(b, { z0: -0.474, z1: -0.462, rIn: 0.0092, rOut: 0.0205, mat: P, seg: 24 });
  place(b, { pos: [0, 0, -0.483], rot: [0.62, 0, 0] }, () => {
    b.cylAxis({ axis: 'z', len: 0.0032, r: 0.0205, mat: P, seg: 24 });
  });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.474, -0.02], [-0.497, -0.02], [-0.47, 0.017], [-0.466, 0.012]], width: 0.0025, x: sx * 0.0185, mat: P, bevel: 0.0004 });
  b.extrude({ points: [[-0.497, -0.022], [-0.474, -0.022], [-0.474, -0.016], [-0.495, -0.016]], width: 0.038, mat: P, bevel: 0.002 });
  // Front sight post with hood on the jacket front.
  b.span({ z0: -0.47, z1: -0.452, y0: 0.017, y1: 0.0245, w: 0.012, mat: P, r: 0.0015 });
  b.extrude({ points: [[-0.464, 0.024], [-0.457, 0.024], [-0.4582, 0.0315], [-0.4628, 0.0315]], width: 0.0018, mat: P, bevel: 0.0002 });
  tube(b, { z0: -0.468, z1: -0.453, rIn: 0.0074, rOut: 0.0084, y: 0.0285, mat: P, seg: 16 });
  b.anchor('frontSight', 0, 0.0315, -0.4605);
  b.anchor('muzzle', 0, 0, -0.495);
  // Receiver: hinged upper with the rear sight, lower with the magazine well.
  b.span({ z0: -0.212, z1: 0.055, y0: -0.016, y1: 0.0215, w: 0.036, mat: P, r: 0.005 });
  b.span({ z0: -0.17, z1: 0.04, y0: -0.034, y1: -0.012, w: 0.034, mat: P, r: 0.003 });
  b.span({ z0: -0.14, z1: -0.086, y0: -0.05, y1: -0.03, w: 0.038, mat: P, r: 0.003 }); // magazine well
  b.span({ z0: -0.14, z1: -0.08, y0: -0.004, y1: 0.012, w: 0.002, x: 0.0178, mat: 'black', r: 0.0005 }); // ejection port
  b.anchor('ejectionPort', 0.019, 0.004, -0.11);
  b.span({ z0: -0.14, z1: 0.03, y0: -0.003, y1: 0.003, w: 0.002, x: 0.0178, mat: 'black', r: 0.0005 }); // cocking slot
  // Flip rear sight (L) with protective ears.
  b.span({ z0: -0.206, z1: -0.172, y0: 0.019, y1: 0.0245, w: 0.022, mat: P, r: 0.0015 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.204, 0.022], [-0.176, 0.022], [-0.178, 0.0335], [-0.2, 0.033]], width: 0.002, x: sx * 0.0092, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0245, -0.202]);
  b.span({ z0: -0.203, z1: -0.18, y0: 0.0235, y1: 0.026, w: 0.012, mat: P, r: 0.0006 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.184, 0.025], [-0.18, 0.025], [-0.18, 0.0335], [-0.184, 0.0335]], width: 0.0045, x: sx * 0.0034, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.184, z1: -0.18, y0: 0.025, y1: 0.0315, w: 0.0024, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0315, -0.182);
  b.body();
  b.meta.sightKind = 'leaf';
  // Trigger guard (with the selector inside), trigger.
  guard(b, { zf: -0.038, zr: 0.04, yTop: -0.032, yBot: -0.064, t: 0.0045, w: 0.012, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.034, len: 0.018, curve: 0.005, mat: P });
  b.box({ x: 0, y: -0.036, z: -0.026, w: 0.004, h: 0.005, d: 0.008, mat: P, r: 0.001 }); // selector
  // Birch stock: short fore-end around the magazine well, wrist and butt.
  const stock = path(
    [
      [-0.226, -0.014, 1],
      [-0.12, -0.014],
      [0.04, -0.014],
      [0.058, 0.004],
      [0.1, 0.002],
      [0.24, -0.018],
      [0.346, -0.034, 1],
      [0.346, -0.158, 1],
      [0.24, -0.126],
      [0.13, -0.094],
      [0.08, -0.074],
      [0.05, -0.056],
      [0.032, -0.044],
      [-0.07, -0.044],
      [-0.2, -0.044],
      [-0.226, -0.038, 1],
    ],
    3,
  );
  loft(b, { points: stock, width: 0.042, mat: 'beech', r: 0.009, taper: taperZ([[-0.15, 0.96], [0.0, 0.96], [0.08, 0.84], [0.16, 0.88], [0.3, 1.0]]) });
  b.extrude({ points: [[0.345, -0.0335], [0.353, -0.0335], [0.353, -0.1585], [0.345, -0.1585]], width: 0.042, mat: P, bevel: 0.002 });
  swivel(b, { x: -0.022, y: -0.02, z: -0.2, r: 0.007, w: 0.003 });
  swivel(b, { x: -0.022, y: -0.11, z: 0.24, r: 0.008, w: 0.003 });
  // Cocking handle on the right (bolt forward), with its safety slide.
  b.part('bolt', [0, 0, -0.12]);
  b.span({ z0: -0.13, z1: -0.11, y0: -0.004, y1: 0.004, w: 0.004, x: 0.0185, mat: P, r: 0.001 });
  b.cylAxis({ axis: 'x', x: 0.024, y: 0.0, z: -0.12, len: 0.01, r: 0.0055, mat: P, seg: 16 });
  b.anchor('chargingHandle', 0.029, 0.0, -0.12);
  b.body();
  // 71-round drum.
  b.part('mag', [0, -0.046, -0.113]);
  drum71(b, { z: -0.135, y: -0.155, tower: 0.012 });
  b.body();
  b.anchor('magWell', 0, -0.046, -0.113);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('gripR', 0, -0.06, 0.07);
  b.anchor('trigger', 0, -0.043, 0.0);
  b.anchor('gripL', 0, -0.06, -0.135); // on the drum / fore-end
  b.anchor('shoulder', 0, -0.095, 0.353);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.11;
  b.meta.openBolt = true;
}

// PPS-43: 7.62x25 stamped SMG, 820 mm (stock out), 250 mm barrel, slotted
// barrel shroud with the front baffle compensator, post front sight with
// ears, flip rear sight (100/200 m), stock folding up over the receiver,
// 35-round curved magazine.
export function pps43(b) {
  const P = 'steel';
  b.cyl({ z0: -0.48, z1: -0.2, r0: 0.0085, mat: P, seg: 14 });
  // Shroud: stamped box with large oval vent slots, front baffle.
  b.span({ z0: -0.48, z1: -0.198, y0: -0.0165, y1: 0.0175, w: 0.03, mat: P, r: 0.006 });
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) b.extrude({ points: slot(-0.455 + i * 0.062, -0.413 + i * 0.062, 0.001, 0.0065), width: 0.0004, x: sx * 0.0151, mat: 'black', bevel: 0 });
    b.extrude({ points: slot(-0.45 + i * 0.062, -0.418 + i * 0.062, 0, 0.0055), width: 0.0004, x: 0, mat: 'black', bevel: 0 });
  }
  b.span({ z0: -0.486, z1: -0.48, y0: -0.0175, y1: 0.0185, w: 0.031, mat: P, r: 0.0015 });
  for (const sx of [-1, 1]) b.span({ z0: -0.502, z1: -0.48, y0: -0.0175, y1: 0.012, w: 0.003, x: sx * 0.0135, mat: P, r: 0.0008 });
  b.span({ z0: -0.504, z1: -0.498, y0: -0.0175, y1: 0.012, w: 0.03, mat: P, r: 0.0015 });
  // Front post with protective ears.
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.47, 0.016], [-0.456, 0.016], [-0.458, 0.0335], [-0.468, 0.0335]], width: 0.002, x: sx * 0.0062, mat: P, bevel: 0.0004 });
  b.span({ z0: -0.47, z1: -0.456, y0: 0.016, y1: 0.021, w: 0.014, mat: P, r: 0.0012 });
  b.extrude({ points: [[-0.466, 0.02], [-0.46, 0.02], [-0.461, 0.0305], [-0.465, 0.0305]], width: 0.0018, mat: P, bevel: 0.0002 });
  b.anchor('frontSight', 0, 0.0305, -0.463);
  b.anchor('muzzle', 0, 0, -0.504);
  // Receiver, magazine housing with release paddle, grip and guard.
  b.span({ z0: -0.2, z1: 0.105, y0: -0.024, y1: 0.0205, w: 0.031, mat: P, r: 0.004 });
  b.span({ z0: -0.15, z1: -0.088, y0: -0.05, y1: -0.02, w: 0.034, mat: P, r: 0.003 });
  b.span({ z0: -0.088, z1: -0.078, y0: -0.05, y1: -0.03, w: 0.014, mat: P, r: 0.0015 });
  b.span({ z0: -0.12, z1: -0.07, y0: -0.002, y1: 0.011, w: 0.002, x: 0.0155, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.016, 0.005, -0.095);
  guard(b, { zf: -0.036, zr: 0.03, yTop: -0.022, yBot: -0.054, t: 0.004, w: 0.011, mat: P, rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.024, len: 0.018, curve: 0.005, mat: P });
  b.extrude({ points: S([[0.026, -0.022], [0.07, -0.022], [0.082, -0.05], [0.102, -0.112], [0.094, -0.126], [0.07, -0.123], [0.056, -0.088], [0.04, -0.05]]), width: 0.026, mat: P, bevel: 0.004 });
  b.extrude({ points: S([[0.04, -0.03], [0.07, -0.028], [0.094, -0.108], [0.088, -0.118], [0.072, -0.116], [0.05, -0.06]]), width: 0.03, mat: 'beech', bevel: 0.006 });
  // Flip rear sight.
  b.span({ z0: -0.185, z1: -0.155, y0: 0.018, y1: 0.0235, w: 0.02, mat: P, r: 0.0015 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.183, 0.021], [-0.157, 0.021], [-0.159, 0.0325], [-0.18, 0.032]], width: 0.002, x: sx * 0.0088, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0235, -0.182]);
  b.span({ z0: -0.183, z1: -0.162, y0: 0.0225, y1: 0.025, w: 0.012, mat: P, r: 0.0006 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.166, 0.024], [-0.162, 0.024], [-0.162, 0.0325], [-0.166, 0.0325]], width: 0.0045, x: sx * 0.0034, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.166, z1: -0.162, y0: 0.024, y1: 0.0305, w: 0.0024, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0305, -0.164);
  b.body();
  b.meta.sightKind = 'leaf';
  // Folding stock (shown extended): upper and lower arms, curved butt plate.
  b.cylAxis({ axis: 'x', x: 0, y: 0.012, z: 0.104, len: 0.034, r: 0.0045, mat: P });
  b.part('stock', [0, 0.012, 0.104]);
  b.span({ z0: 0.104, z1: 0.31, y0: 0.006, y1: 0.016, w: 0.016, mat: P, r: 0.003 });
  b.rod({ from: [0, -0.02, 0.104], to: [0, -0.1, 0.308], r: 0.0045, mat: P });
  b.extrude({ points: S([[0.304, 0.016], [0.316, 0.014], [0.32, -0.04], [0.316, -0.108], [0.304, -0.11], [0.308, -0.04]]), width: 0.034, mat: P, bevel: 0.003 });
  b.body();
  b.meta.stockFold = { axis: 'x', angle: PI }; // swings up and forward over the receiver
  // Cocking handle on the right.
  b.part('bolt', [0, 0, -0.11]);
  b.cylAxis({ axis: 'x', x: 0.02, y: 0.002, z: -0.11, len: 0.01, r: 0.003, mat: P });
  b.sphere({ x: 0.026, y: 0.002, z: -0.11, r: 0.0055, mat: P });
  b.anchor('chargingHandle', 0.03, 0.002, -0.11);
  b.body();
  // 35-round curved magazine.
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

// PPD-40: 7.62x25 SMG, 788 mm, 267 mm barrel, round perforated jacket, hooded
// front post, tangent rear sight (50-500 m), round receiver, one-piece wooden
// stock whose fore-end runs forward of the 71-round drum.
export function ppd40(b) {
  const P = 'steel';
  b.cyl({ z0: -0.448, z1: -0.2, r0: 0.0085, mat: P, seg: 14 });
  b.cyl({ z0: -0.44, z1: -0.205, r0: 0.0185, mat: 'perforated', open: true, seg: 22 });
  tube(b, { z0: -0.45, z1: -0.438, rIn: 0.0062, rOut: 0.0195, mat: P, seg: 22 });
  tube(b, { z0: -0.21, z1: -0.198, rIn: 0.009, rOut: 0.0195, mat: P, seg: 22 });
  // Hooded front post on the jacket front.
  b.span({ z0: -0.449, z1: -0.433, y0: 0.016, y1: 0.0235, w: 0.011, mat: P, r: 0.0015 });
  b.extrude({ points: [[-0.444, 0.023], [-0.438, 0.023], [-0.439, 0.0305], [-0.443, 0.0305]], width: 0.0018, mat: P, bevel: 0.0002 });
  tube(b, { z0: -0.447, z1: -0.434, rIn: 0.0072, rOut: 0.0082, y: 0.0275, mat: P, seg: 16 });
  b.anchor('frontSight', 0, 0.0305, -0.441);
  b.anchor('muzzle', 0, 0, -0.45);
  // Round receiver with end cap; magazine well below.
  b.cyl({ z0: -0.2, z1: 0.045, r0: 0.0195, mat: P, seg: 24 });
  lathe(b, { mat: P, profile: [[0, 0.043], [0.0195, 0.043], [0.018, 0.052], [0.01, 0.055], [0, 0.055]] });
  b.span({ z0: -0.14, z1: -0.088, y0: -0.046, y1: -0.012, w: 0.036, mat: P, r: 0.003 });
  b.span({ z0: -0.15, z1: -0.09, y0: -0.002, y1: 0.012, w: 0.002, x: 0.0185, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.019, 0.005, -0.12);
  // Tangent rear sight on the receiver front.
  b.span({ z0: -0.198, z1: -0.15, y0: 0.016, y1: 0.0235, w: 0.02, mat: P, r: 0.0015 });
  b.part('rearSight', [0, 0.024, -0.194]);
  b.span({ z0: -0.195, z1: -0.152, y0: 0.0228, y1: 0.0252, w: 0.013, mat: P, r: 0.0006 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.156, 0.024], [-0.152, 0.024], [-0.152, 0.0325], [-0.156, 0.0325]], width: 0.0045, x: sx * 0.0034, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.156, z1: -0.152, y0: 0.024, y1: 0.0305, w: 0.0024, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0305, -0.154);
  b.body();
  b.meta.sightKind = 'leaf';
  // Trigger guard and trigger.
  guard(b, { zf: -0.04, zr: 0.042, yTop: -0.03, yBot: -0.062, t: 0.0045, w: 0.012, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.032, len: 0.018, curve: 0.005, mat: P });
  // One-piece stock: fore-end in front of the drum, wrist, butt.
  const stock = path(
    [
      [-0.33, -0.012, 1],
      [-0.2, -0.014],
      [0.04, -0.014],
      [0.06, 0.004],
      [0.1, 0.002],
      [0.24, -0.018],
      [0.334, -0.032, 1],
      [0.334, -0.152, 1],
      [0.24, -0.122],
      [0.13, -0.09],
      [0.08, -0.072],
      [0.05, -0.054],
      [0.036, -0.042],
      [-0.08, -0.042],
      [-0.16, -0.042],
      [-0.18, -0.03],
      [-0.31, -0.034],
      [-0.33, -0.028, 1],
    ],
    3,
  );
  loft(b, { points: stock, width: 0.042, mat: 'beech', r: 0.009, taper: taperZ([[-0.25, 0.86], [-0.15, 0.96], [0.0, 0.96], [0.08, 0.84], [0.16, 0.88], [0.3, 1.0]]) });
  b.extrude({ points: [[0.333, -0.0315], [0.341, -0.0315], [0.341, -0.1525], [0.333, -0.1525]], width: 0.042, mat: P, bevel: 0.002 });
  swivel(b, { x: -0.022, y: -0.022, z: -0.29, r: 0.007, w: 0.003 });
  swivel(b, { x: -0.022, y: -0.106, z: 0.24, r: 0.008, w: 0.003 });
  // Cocking handle on the right (bolt forward).
  b.part('bolt', [0, 0, -0.12]);
  b.cylAxis({ axis: 'x', x: 0.022, y: 0.004, z: -0.12, len: 0.01, r: 0.0032, mat: P });
  b.sphere({ x: 0.028, y: 0.004, z: -0.12, r: 0.0058, mat: P });
  b.anchor('chargingHandle', 0.032, 0.004, -0.12);
  b.body();
  // 71-round drum.
  b.part('mag', [0, -0.042, -0.114]);
  drum71(b, { z: -0.135, y: -0.15, tower: 0.012 });
  b.body();
  b.anchor('magWell', 0, -0.042, -0.114);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('gripR', 0, -0.06, 0.072);
  b.anchor('trigger', 0, -0.041, 0.0);
  b.anchor('gripL', 0, -0.045, -0.27);
  b.anchor('shoulder', 0, -0.09, 0.341);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// DP-28 (Degtyaryov): 7.62x54R LMG, 1270 mm, 605 mm barrel, 47-round pan on top
// ('mag', lifts off upward), perforated barrel shroud, conical flash hider,
// bipod at the shroud front, tall protected front post and tangent rear sight
// (the line of sight passes over the pan), wooden stock, empties eject down.
export function dp28(b) {
  const P = 'steel';
  b.cyl({ z0: -0.86, z1: -0.28, r0: 0.0115, r1: 0.0135, mat: P, seg: 16 });
  b.cyl({ z0: -0.84, z1: -0.29, r0: 0.0078, y: -0.019, mat: P, seg: 12 }); // gas cylinder
  b.cyl({ z0: -0.838, z1: -0.3, r0: 0.0285, mat: 'perforated', open: true, seg: 26 });
  tube(b, { z0: -0.86, z1: -0.836, rIn: 0.012, rOut: 0.03, mat: P, seg: 26 });
  tube(b, { z0: -0.31, z1: -0.285, rIn: 0.012, rOut: 0.0295, mat: P, seg: 26 });
  // Conical flash hider.
  lathe(b, { mat: P, profile: [[0.0085, -0.86], [0.0125, -0.86], [0.0135, -0.866], [0.0225, -0.94], [0.0195, -0.94], [0.0098, -0.87], [0.0085, -0.87]] });
  // Tall front post with protective ears on the shroud front.
  b.extrude({ points: [[-0.858, 0.028], [-0.838, 0.028], [-0.842, 0.064], [-0.854, 0.064]], width: 0.01, mat: P, bevel: 0.0012 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.857, 0.058], [-0.839, 0.058], [-0.841, 0.094], [-0.855, 0.094]], width: 0.0025, x: sx * 0.0075, mat: P, bevel: 0.0004 });
  b.extrude({ points: [[-0.852, 0.062], [-0.844, 0.062], [-0.8452, 0.0885], [-0.8508, 0.0885]], width: 0.002, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0885, -0.848);
  // Receiver.
  b.span({ z0: -0.29, z1: 0.065, y0: -0.034, y1: 0.028, w: 0.044, mat: P, r: 0.006 });
  b.span({ z0: -0.24, z1: -0.02, y0: 0.024, y1: 0.031, w: 0.03, mat: P, r: 0.002 }); // magazine seat
  b.anchor('ejectionPort', 0, -0.036, -0.12);
  // Rear sight in front of the pan: raised base, tangent leaf hinged at the front.
  b.extrude({ points: [[-0.33, 0.026], [-0.262, 0.026], [-0.266, 0.07], [-0.32, 0.078], [-0.33, 0.078]], width: 0.024, mat: P, bevel: 0.002 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.33, 0.07], [-0.27, 0.07], [-0.272, 0.094], [-0.3, 0.096], [-0.328, 0.09]], width: 0.0025, x: sx * 0.0115, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0795, -0.325]);
  b.span({ z0: -0.327, z1: -0.268, y0: 0.0785, y1: 0.0812, w: 0.016, mat: P, r: 0.0007 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.272, 0.08], [-0.268, 0.08], [-0.268, 0.0915], [-0.272, 0.0915]], width: 0.006, x: sx * 0.0044, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.272, z1: -0.268, y0: 0.08, y1: 0.0885, w: 0.0026, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0885, -0.27);
  b.body();
  b.meta.sightKind = 'leaf';
  // Trigger guard and trigger.
  guard(b, { zf: -0.045, zr: 0.04, yTop: -0.032, yBot: -0.066, t: 0.0048, w: 0.012, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.034, len: 0.02, curve: 0.006, mat: P });
  // Wooden stock with semi-pistol grip.
  const stock = path(
    [
      [0.06, 0.022, 1],
      [0.1, 0.018],
      [0.2, 0.004],
      [0.33, -0.016, 1],
      [0.33, -0.142, 1],
      [0.24, -0.118],
      [0.15, -0.09],
      [0.12, -0.09],
      [0.098, -0.104],
      [0.076, -0.1],
      [0.06, -0.075],
      [0.04, -0.036],
      [0.04, -0.034, 1],
    ],
    3,
  );
  loft(b, { points: stock, width: 0.042, mat: 'beech', r: 0.009, taper: taperZ([[0.05, 0.86], [0.1, 0.8], [0.16, 0.86], [0.3, 1.0]]) });
  b.extrude({ points: [[0.329, -0.0155], [0.337, -0.0155], [0.337, -0.1425], [0.329, -0.1425]], width: 0.042, mat: P, bevel: 0.002 });
  // Cocking handle on the right (operating rod, forward).
  b.part('bolt', [0, -0.018, -0.2]);
  b.cylAxis({ axis: 'x', x: 0.028, y: -0.018, z: -0.2, len: 0.014, r: 0.0042, mat: P });
  b.sphere({ x: 0.036, y: -0.018, z: -0.2, r: 0.0068, mat: P });
  b.anchor('chargingHandle', 0.041, -0.018, -0.2);
  b.body();
  // Bipod at the shroud front (deployed).
  b.part('bipod', [0, -0.026, -0.82]);
  tube(b, { z0: -0.83, z1: -0.81, rIn: 0.0285, rOut: 0.032, mat: P, seg: 24 });
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.012, -0.03, -0.82], to: [sx * 0.13, -0.32, -0.8], r: 0.0055, r1: 0.0048, mat: P });
    b.box({ x: sx * 0.132, y: -0.325, z: -0.8, w: 0.012, h: 0.006, d: 0.035, mat: P, r: 0.002 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2;
  // 47-round pan magazine on top (axis vertical), lifts straight up.
  const pc = [0, 0.031, -0.13];
  b.part('mag', pc);
  place(b, { pos: pc, rot: [-PI / 2, 0, 0] }, () => {
    lathe(b, {
      mat: 'sovietGreen',
      seg: 40,
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
    for (const rr of [0.065, 0.1]) tube(b, { z0: 0.0355 + (0.1 - rr) * 0.15, z1: 0.0405 + (0.1 - rr) * 0.15, rIn: rr - 0.003, rOut: rr, mat: 'sovietGreen', seg: 36 });
  });
  b.body();
  b.anchor('magWell', 0, 0.031, -0.13);
  b.meta.magAxis = [0, 1, 0];

  b.anchor('muzzle', 0, 0, -0.94);
  b.anchor('gripR', 0, -0.075, 0.09);
  b.anchor('trigger', 0, -0.045, 0.0);
  b.anchor('gripL', 0, -0.05, 0.2); // under the stock (bipod fire)
  b.anchor('shoulder', 0, -0.08, 0.337);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.12;
  b.meta.openBolt = true;
}

// Tokarev TT-33: 7.62x25 pistol, 196 mm, 116 mm barrel, exposed hammer,
// alternating wide/narrow slide serrations, bakelite grips with the star.
export function tt33(b) {
  const P = 'steel';
  // Frame with trigger guard and grip.
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
    width: 0.02,
    mat: P,
    bevel: 0.0012,
  });
  b.extrude({ points: S([[0.018, -0.033], [0.058, -0.03], [0.062, -0.05], [0.072, -0.102], [0.073, -0.112], [0.04, -0.114], [0.034, -0.1], [0.02, -0.044]]), width: 0.0265, mat: 'bakelite', bevel: 0.0022 });
  for (const sx of [-1, 1]) {
    b.cylAxis({ axis: 'x', x: sx * 0.0134, y: -0.06, z: 0.047, len: 0.0008, r: 0.0085, mat: 'black', seg: 18 }); // star medallion
    b.cylAxis({ axis: 'x', x: sx * 0.0136, y: -0.06, z: 0.047, len: 0.0008, r: 0.0045, mat: 'bakelite', seg: 5 });
  }
  swivel(b, { y: -0.123, z: 0.074, r: 0.0042, t: 0.0012, w: 0.002 });
  trigger(b, { z: 0, yTop: -0.022, len: 0.019, curve: 0.004, w: 0.0055, mat: P });
  b.box({ x: -0.0108, y: -0.0135, z: -0.024, w: 0.002, h: 0.005, d: 0.024, mat: P, r: 0.0008 }); // slide stop
  b.cyl({ z0: -0.116, z1: -0.02, r0: 0.0068, mat: 'steelBright', seg: 14 });
  b.anchor('ejectionPort', 0.011, 0.004, -0.018);
  // Slide with alternating serrations and sights.
  b.part('bolt', [0, 0, 0.06]);
  b.extrude({ points: [[-0.116, -0.019], [-0.116, 0.007], [-0.113, 0.0105], [0.06, 0.0105], [0.0615, 0.005], [0.06, -0.01], [-0.082, -0.01], [-0.086, -0.019]], width: 0.022, mat: P, bevel: 0.0018 });
  b.span({ z0: -0.03, z1: -0.004, y0: -0.001, y1: 0.0085, w: 0.002, x: 0.0105, mat: 'black', r: 0.0005 });
  for (let i = 0; i < 10; i++) for (const sx of [-1, 1]) b.box({ x: sx * 0.0109, y: -0.0002, z: 0.029 + i * 0.0029, w: 0.0008, h: i % 2 ? 0.008 : 0.016, d: 0.0011, mat: 'black', r: 0.0002 });
  tube(b, { z0: -0.117, z1: -0.11, rIn: 0.0063, rOut: 0.0083, mat: P, seg: 16 });
  b.extrude({ points: [[-0.112, 0.009], [-0.105, 0.009], [-0.106, 0.01379], [-0.111, 0.01379]], width: 0.0026, mat: P, bevel: 0.0004 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.046, 0.009], [0.053, 0.009], [0.053, 0.0158], [0.0465, 0.0158]], width: 0.004, x: sx * 0.0033, mat: P, bevel: 0.0004 });
  b.span({ z0: 0.046, z1: 0.053, y0: 0.009, y1: 0.014, w: 0.0026, mat: P, r: 0.0003 });
  b.body();
  b.anchor('frontSight', 0, 0.01379, -0.1085);
  b.anchor('rearSight', 0, 0.014, 0.0495);
  // Hammer (cocked).
  b.part('hammer', [0, -0.006, 0.06]);
  b.extrude({ points: S([[0.054, -0.012], [0.063, -0.013], [0.069, -0.004], [0.075, 0.006], [0.08, 0.0065], [0.079, 0.0005], [0.073, -0.007], [0.064, -0.016], [0.056, -0.017]]), width: 0.008, mat: P, bevel: 0.0008 });
  b.body();
  // Magazine.
  const top = [0.021, -0.012];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.112, depth: 0.0365, width: 0.0135, angle: -0.28, mat: P, plate: 0.0045, lip: 0.0012, rib: false });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.961, 0.276];

  b.anchor('muzzle', 0, 0, -0.116);
  b.anchor('gripR', 0, -0.068, 0.047);
  b.anchor('trigger', 0, -0.031, 0.0);
  b.anchor('gripL', -0.022, -0.082, 0.043);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.036;
}

// Nagant M1895: 7.62x38R gas-seal revolver, 235 mm, 114 mm barrel, 7-round
// cylinder loaded through a gate on the right, swinging ejector rod under the
// barrel, spur hammer, lanyard ring.
export function nagant_m1895(b) {
  const P = 'steel';
  const cy = -0.0118;
  lathe(b, { mat: P, profile: [[0, -0.058], [0.0088, -0.058], [0.0082, -0.07], [0.0075, -0.12], [0.0072, -0.172], [0, -0.172]] });
  b.extrude({ points: S([[-0.171, 0.005], [-0.157, 0.005], [-0.161, 0.0115], [-0.166, 0.01367], [-0.17, 0.0105]]), width: 0.0026, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.01367, -0.1655);
  // Ejector rod with its swivel collar under the barrel.
  b.cyl({ z0: -0.15, z1: -0.05, r0: 0.0028, y: cy, mat: 'steelBright', seg: 10 });
  b.cyl({ z0: -0.142, z1: -0.128, r0: 0.0055, y: cy + 0.002, mat: P, seg: 14 });
  b.cyl({ z0: -0.156, z1: -0.149, r0: 0.004, y: cy, mat: P, seg: 12 });
  // Solid frame: front, top strap, recoil shield, guard, grip frame.
  b.extrude({
    points: [
      [-0.06, -0.026],
      [-0.06, 0.009],
      [-0.052, 0.0135],
      [0.012, 0.0135],
      [0.03, 0.013],
      [0.042, 0.006],
      [0.046, -0.012],
      [0.05, -0.04],
      [0.06, -0.075],
      [0.064, -0.098],
      [0.03, -0.098],
      [0.018, -0.054],
      [0.008, -0.048],
      [0.004, -0.06],
      [-0.008, -0.062],
      [-0.02, -0.056],
      [-0.024, -0.04],
      [-0.03, -0.035],
      [-0.048, -0.035],
      [-0.054, -0.03],
    ],
    holes: [
      [
        [-0.05, -0.0315],
        [-0.05, 0.0085],
        [-0.007, 0.0085],
        [-0.007, -0.0315],
      ],
      S([[-0.017, -0.039], [0.004, -0.039], [0.008, -0.047], [0.002, -0.057], [-0.007, -0.057], [-0.016, -0.05]], 3),
    ],
    width: 0.017,
    mat: P,
    bevel: 0.0012,
  });
  b.extrude({ points: [[-0.006, -0.026], [0.008, -0.026], [0.008, 0.006], [-0.006, 0.006]], width: 0.003, x: 0.0095, mat: P, bevel: 0.0005 }); // loading gate
  b.anchor('ejectionPort', 0.012, cy, -0.006); // loading gate
  // Rear sight groove in the top strap.
  for (const sx of [-1, 1]) b.span({ z0: 0.006, z1: 0.03, y0: 0.012, y1: 0.0158, w: 0.005, x: sx * 0.0037, mat: P, r: 0.0005 });
  b.anchor('rearSight', 0, 0.0141, 0.026);
  // Grips and lanyard ring, trigger.
  b.extrude({ points: S([[0.02, -0.04], [0.045, -0.024], [0.054, -0.054], [0.066, -0.092], [0.062, -0.104], [0.04, -0.106], [0.03, -0.092], [0.021, -0.066]]), width: 0.031, mat: 'walnut', bevel: 0.0055 });
  swivel(b, { y: -0.111, z: 0.05, r: 0.0055, t: 0.0014, w: 0.002 });
  trigger(b, { z: 0, yTop: -0.037, len: 0.02, curve: 0.006, w: 0.0055, mat: P });
  // Seven-shot cylinder (moves forward to seal the gap when cocked).
  b.part('cylinder', [0, cy, -0.0285]);
  lathe(b, { mat: P, y: cy, seg: 28, profile: [[0, -0.049], [0.0175, -0.049], [0.0195, -0.046], [0.0195, -0.0135], [0.0188, -0.008], [0, -0.008]] });
  for (let k = 0; k < 7; k++) {
    const a = PI / 2 + (k * 2 * PI) / 7;
    b.cyl({ z0: -0.0495, z1: -0.0485, r0: 0.0042, x: Math.cos(a) * 0.0118, y: cy + Math.sin(a) * 0.0118, mat: 'brass', seg: 10 });
  }
  b.body();
  // Spur hammer (at rest).
  b.part('hammer', [0, 0.002, 0.034]);
  b.extrude({ points: S([[0.028, -0.002], [0.035, 0.008], [0.046, 0.0125], [0.056, 0.013], [0.057, 0.008], [0.047, 0.005], [0.041, -0.004], [0.031, -0.007]]), width: 0.0075, mat: P, bevel: 0.0008 });
  b.body();

  b.anchor('muzzle', 0, 0, -0.172);
  b.anchor('gripR', 0, -0.065, 0.044);
  b.anchor('trigger', 0, -0.047, 0.0);
  b.anchor('gripL', -0.022, -0.075, 0.04);
  b.meta.sight = 'notch';
  b.meta.cylinderRounds = 7;
  b.meta.cylinderSeal = 0.002; // forward travel when cocking
}

// PTRD-41: 14.5x114 single-shot anti-tank rifle, 2020 mm, 1350 mm barrel, big
// two-port muzzle brake, bipod and carrying handle on the barrel, sights on
// the left, recoiling barrel/receiver in the tubular stock with a padded butt,
// cheek rest and left-hand grip.
export function ptrd41(b) {
  const P = 'steel';
  lathe(b, { mat: P, profile: [[0, -0.21], [0.0235, -0.21], [0.0228, -0.32], [0.0212, -0.6], [0.0192, -0.95], [0.0175, -1.3], [0.017, -1.565], [0, -1.565]] });
  // Muzzle brake: box-like with two big ports a side.
  b.span({ z0: -1.66, z1: -1.56, y0: -0.026, y1: 0.026, w: 0.05, mat: P, r: 0.008 });
  for (const z of [-1.64, -1.595]) for (const sx of [-1, 1]) b.box({ x: sx * 0.0251, y: 0, z, w: 0.002, h: 0.034, d: 0.028, mat: 'black', r: 0.003 });
  b.cyl({ z0: -1.662, z1: -1.66, r0: 0.0105, mat: 'black', seg: 16 });
  // Carrying handle and bipod clamp on the barrel.
  b.span({ z0: -0.6, z1: -0.56, y0: 0.0, y1: 0.03, w: 0.05, mat: P, r: 0.004 });
  b.cyl({ z0: -0.64, z1: -0.52, r0: 0.007, y: 0.046, mat: 'beech', seg: 12 });
  for (const z of [-0.632, -0.528]) b.span({ z0: z - 0.006, z1: z + 0.006, y0: 0.012, y1: 0.046, w: 0.008, mat: P, r: 0.002 });
  // Sights on the left: front post on a bracket, rear flip notch.
  const SX = -0.042;
  b.span({ z0: -1.012, z1: -0.988, y0: -0.005, y1: 0.02, w: 0.03, x: -0.025, mat: P, r: 0.003 });
  b.extrude({ points: [[-1.006, 0.018], [-0.994, 0.018], [-0.996, 0.0385], [-1.004, 0.0385]], width: 0.003, x: SX, mat: P, bevel: 0.0004 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-1.008, 0.016], [-0.992, 0.016], [-0.994, 0.042], [-1.006, 0.042]], width: 0.002, x: SX + sx * 0.007, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', SX, 0.0385, -1.0);
  b.span({ z0: -0.15, z1: -0.08, y0: -0.004, y1: 0.022, w: 0.016, x: -0.033, mat: P, r: 0.002 });
  b.part('rearSight', [SX, 0.024, -0.145]);
  b.span({ z0: -0.147, z1: -0.088, y0: 0.022, y1: 0.025, w: 0.014, x: SX, mat: P, r: 0.0007 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.092, 0.024], [-0.088, 0.024], [-0.088, 0.041], [-0.092, 0.041]], width: 0.005, x: SX + sx * 0.0037, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.092, z1: -0.088, y0: 0.024, y1: 0.0385, w: 0.0024, x: SX, mat: P, r: 0.0003 });
  b.anchor('rearSight', SX, 0.0385, -0.09);
  b.body();
  b.meta.sightKind = 'leaf';
  // Receiver, trigger housing with grip, guard.
  b.cyl({ z0: -0.26, z1: 0.02, r0: 0.031, mat: P, seg: 26 });
  b.span({ z0: -0.2, z1: -0.08, y0: 0.012, y1: 0.031, w: 0.002, x: 0.0285, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.03, 0.02, -0.14);
  b.span({ z0: -0.05, z1: 0.07, y0: -0.045, y1: -0.025, w: 0.03, mat: P, r: 0.003 });
  guard(b, { zf: -0.04, zr: 0.03, yTop: -0.043, yBot: -0.075, t: 0.0045, w: 0.012, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.044, len: 0.02, curve: 0.006, mat: P });
  b.extrude({ points: S([[0.026, -0.043], [0.068, -0.043], [0.08, -0.07], [0.1, -0.13], [0.092, -0.142], [0.068, -0.139], [0.056, -0.104], [0.04, -0.07]]), width: 0.03, mat: 'beech', bevel: 0.0065 });
  // Tubular stock with the recoil spring, cheek rest, left-hand grip, padded butt.
  b.cyl({ z0: 0.02, z1: 0.33, r0: 0.024, y: -0.006, mat: P, seg: 22 });
  b.span({ z0: 0.1, z1: 0.27, y0: 0.008, y1: 0.03, w: 0.04, x: -0.004, mat: 'beech', r: 0.008 });
  b.extrude({ points: S([[0.12, -0.026], [0.16, -0.026], [0.164, -0.07], [0.158, -0.11], [0.142, -0.118], [0.126, -0.108], [0.122, -0.07]]), width: 0.03, mat: 'beech', bevel: 0.007 });
  b.span({ z0: 0.33, z1: 0.345, y0: -0.12, y1: 0.03, w: 0.05, mat: P, r: 0.004 });
  b.extrude({ points: S([[0.345, 0.032], [0.36, 0.03], [0.364, -0.045], [0.36, -0.122], [0.345, -0.124]]), width: 0.062, mat: 'leather', bevel: 0.012 });
  // Bolt with its handle (right).
  b.part('bolt', [0, 0, 0.02]);
  b.cyl({ z0: -0.21, z1: 0.02, r0: 0.018, mat: 'steelBright', seg: 18 });
  b.rod({ from: [0.016, 0.0, -0.02], to: [0.07, -0.01, -0.02], r: 0.0055, mat: 'steelBright' });
  b.sphere({ x: 0.075, y: -0.011, z: -0.02, r: 0.011, mat: 'steelBright' });
  b.anchor('boltHandle', 0.075, -0.011, -0.02);
  b.body();
  // Bipod on the barrel (deployed).
  b.part('bipod', [0, -0.02, -0.82]);
  tube(b, { z0: -0.835, z1: -0.805, rIn: 0.02, rOut: 0.026, mat: P, seg: 20 });
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.015, -0.024, -0.82], to: [sx * 0.2, -0.33, -0.86], r: 0.008, r1: 0.007, mat: P });
    b.box({ x: sx * 0.203, y: -0.336, z: -0.86, w: 0.04, h: 0.008, d: 0.05, mat: P, r: 0.003 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2;

  b.anchor('muzzle', 0, 0, -1.662);
  b.anchor('gripR', 0, -0.09, 0.07);
  b.anchor('trigger', 0, -0.054, 0.0);
  b.anchor('gripL', 0, -0.085, 0.142);
  b.anchor('shoulder', 0, -0.045, 0.364);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.13;
  b.meta.boltLift = PI / 2;
}

// RGD-33 stick grenade with the diamond-pattern defensive fragmentation sleeve.
// Upright: +Y = head; origin at the grip on the handle.
export function rgd33(b) {
  const G = 'sovietGreen';
  // Handle (sheet metal) with the safety slider, arming collar.
  b.cylAxis({ axis: 'y', y: -0.035, len: 0.1, r: 0.0145, r1: 0.0145, mat: G, seg: 18 });
  b.cylAxis({ axis: 'y', y: -0.087, len: 0.004, r: 0.013, mat: G, seg: 18 });
  b.cylAxis({ axis: 'y', y: 0.018, len: 0.008, r: 0.0165, mat: 'steel', seg: 18 });
  b.box({ x: 0.0148, y: -0.02, z: 0, w: 0.003, h: 0.03, d: 0.007, mat: 'steel', r: 0.001 });
  // Head with domed nose.
  b.cylAxis({ axis: 'y', y: 0.058, len: 0.072, r: 0.0225, mat: G, seg: 24 });
  b.sphere({ y: 0.094, r: 0.0225, sy: 0.35, mat: G, seg: 20 });
  // Fragmentation sleeve: band ends and a diamond lattice of studs.
  for (const y of [0.031, 0.085]) b.cylAxis({ axis: 'y', y, len: 0.004, r: 0.0262, mat: 'steel', seg: 24 });
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 10; k++) {
      const th = ((k + (row % 2) * 0.5) * 2 * PI) / 10;
      const y = 0.041 + row * 0.0118;
      place(b, { pos: [Math.sin(th) * 0.0238, y, Math.cos(th) * 0.0238], rot: [0, th, PI / 4], order: 'YXZ' }, () => {
        b.box({ w: 0.0085, h: 0.0085, d: 0.004, r: 0.0012, mat: 'steel' });
      });
    }
  }
  b.anchor('gripR', 0, -0.04, 0);
  b.anchor('gripL', 0.015, -0.02, 0); // safety slider
  b.anchor('pin', 0.015, -0.02, 0);
  b.meta.kind = 'grenade';
  b.meta.fuse = 3.5;
}
