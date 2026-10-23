// US small arms. See kit.js for the coordinate conventions:
// meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at z = 0.
import { S, place, circle, slot, boxMag, guard, trigger, plateXY, lathe, tube, cartridge, swivel, taperZ, path, loft } from './parts.js';

const PI = Math.PI;

// .30-06 Springfield cartridge.
const R3006 = { caseLen: 0.0634, oal: 0.0846, rRim: 0.006, rNeck: 0.0044, rBullet: 0.0039, shoulder: 0.82 };

// M1 Garand: .30-06 gas-operated semi-automatic, 8-round en-bloc clip.
// 1103 mm long, 610 mm barrel, aperture rear sight (windage/elevation knobs),
// protected blade front sight on the gas cylinder at the muzzle.
export function m1_garand(b) {
  // Barrel (visible between the handguards).
  lathe(b, {
    mat: 'parkerized',
    profile: [
      [0, -0.215],
      [0.0142, -0.215],
      [0.0136, -0.3],
      [0.0118, -0.4],
      [0.0104, -0.5],
      [0.0094, -0.6],
      [0.0086, -0.69],
      [0.0082, -0.773],
      [0, -0.773],
    ],
  });
  // Gas cylinder: ring around the barrel, cylinder below it, lock screw at the muzzle.
  tube(b, { z0: -0.769, z1: -0.664, rIn: 0.0075, rOut: 0.0112, mat: 'parkerized' });
  b.cyl({ z0: -0.769, z1: -0.664, r0: 0.0092, y: -0.0165, mat: 'parkerized' });
  b.span({ z0: -0.769, z1: -0.664, y0: -0.018, y1: -0.004, w: 0.017, mat: 'parkerized', r: 0.003 });
  lathe(b, { mat: 'parkerized', profile: [[0, -0.7755], [0.0095, -0.7755], [0.0108, -0.773], [0.0108, -0.7685], [0, -0.7685]] });
  b.cyl({ z0: -0.7745, z1: -0.768, r0: 0.0075, y: -0.0165, mat: 'parkerized' }); // gas cylinder plug
  b.span({ z0: -0.766, z1: -0.744, y0: -0.032, y1: -0.024, w: 0.009, mat: 'parkerized', r: 0.0015 }); // bayonet lug
  // Front sight: base, protective ears and blade.
  b.span({ z0: -0.7705, z1: -0.7565, y0: 0.008, y1: 0.0155, w: 0.016, mat: 'parkerized', r: 0.002 });
  for (const sx of [-1, 1])
    b.extrude({ points: [[-0.77, 0.014], [-0.757, 0.014], [-0.759, 0.0305], [-0.768, 0.0305]], width: 0.0022, x: sx * 0.0062, mat: 'parkerized', bevel: 0.0004 });
  b.extrude({ points: [[-0.7665, 0.015], [-0.7595, 0.015], [-0.761, 0.0285], [-0.765, 0.0285]], width: 0.0021, mat: 'parkerized', bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0285, -0.763);

  // Front handguard (under the barrel), lower band, stock ferrule with swivel.
  b.extrude({ points: S([[-0.66, -0.004], [-0.58, -0.004], [-0.578, -0.031], [-0.62, -0.033], [-0.66, -0.029]]), width: 0.03, mat: 'walnut', bevel: 0.007 });
  b.span({ z0: -0.582, z1: -0.566, y0: -0.035, y1: 0.0145, w: 0.034, mat: 'parkerized', r: 0.004 });
  b.span({ z0: -0.566, z1: -0.548, y0: -0.036, y1: -0.006, w: 0.034, mat: 'parkerized', r: 0.004 });
  swivel(b, { y: -0.044, z: -0.556, r: 0.008, w: 0.004 });

  // Stock: fore-end, receiver inletting, semi-pistol grip, straight comb.
  const stock = path(
    [
      [-0.55, -0.007, 1],
      [-0.4, -0.007],
      [-0.25, -0.008],
      [-0.2, -0.013],
      [-0.06, -0.013],
      [-0.016, -0.009],
      [0.0, 0.002],
      [0.05, -0.001],
      [0.18, -0.017],
      [0.316, -0.033, 1],
      [0.312, -0.169, 1],
      [0.22, -0.136],
      [0.13, -0.098],
      [0.108, -0.096],
      [0.088, -0.103],
      [0.07, -0.098],
      [0.056, -0.08],
      [0.05, -0.062],
      [-0.07, -0.064],
      [-0.19, -0.064],
      [-0.215, -0.05],
      [-0.25, -0.036],
      [-0.42, -0.034],
      [-0.548, -0.032, 1],
    ],
    3,
  );
  loft(b, {
    points: stock,
    width: 0.043,
    mat: 'walnut',
    r: 0.009,
    taper: taperZ([
      [-0.3, 0.8],
      [-0.2, 0.88],
      [0.0, 0.88],
      [0.07, 0.8],
      [0.12, 0.82],
      [0.25, 1.0],
    ]),
  });
  // Rear handguard over the barrel, with its rear band.
  b.extrude({ points: S([[-0.548, -0.003], [-0.226, -0.003], [-0.228, 0.017], [-0.4, 0.0205], [-0.546, 0.018]]), width: 0.031, mat: 'walnut', bevel: 0.009 });
  b.span({ z0: -0.236, z1: -0.224, y0: -0.006, y1: 0.0215, w: 0.031, mat: 'parkerized', r: 0.004 });
  // Butt plate and rear swivel.
  b.extrude({ points: [[0.315, -0.033], [0.3255, -0.033], [0.3215, -0.17], [0.311, -0.169]], width: 0.043, mat: 'parkerized', bevel: 0.002 });
  swivel(b, { y: -0.155, z: 0.205, r: 0.009, w: 0.004 });

  // Receiver: ring, side walls around the open top, heel with the rear sight.
  b.cyl({ z0: -0.215, z1: -0.172, r0: 0.0168, mat: 'parkerized', seg: 24 });
  for (const sx of [-1, 1]) b.span({ z0: -0.176, z1: -0.068, y0: -0.026, y1: 0.004, w: 0.004, x: sx * 0.0125, mat: 'parkerized', r: 0.0012 });
  b.span({ z0: -0.176, z1: -0.068, y0: -0.05, y1: -0.024, w: 0.029, mat: 'parkerized', r: 0.003 });
  b.extrude({ points: [[-0.072, -0.03], [-0.072, 0.0125], [-0.016, 0.0125], [-0.004, 0.005], [0.0, -0.03]], width: 0.029, mat: 'parkerized', bevel: 0.003 });
  b.anchor('ejectionPort', 0.0, 0.016, -0.12);
  b.anchor('clipGuide', 0, 0.016, -0.12);

  // Trigger guard (with the safety at its front) and trigger.
  guard(b, { zf: -0.066, zr: 0.05, yTop: -0.058, yBot: -0.09, t: 0.005, w: 0.011, mat: 'parkerized', rake: 0.006 });
  b.span({ z0: -0.072, z1: 0.054, y0: -0.068, y1: -0.058, w: 0.017, mat: 'parkerized', r: 0.002 });
  b.span({ z0: -0.061, z1: -0.052, y0: -0.078, y1: -0.064, w: 0.007, mat: 'parkerized', r: 0.0012 }); // safety
  trigger(b, { z: 0, yTop: -0.064, len: 0.021, curve: 0.006, mat: 'parkerized' });

  // Rear sight: base with windage (left) and elevation (right) knobs, cover,
  // and the aperture slide (animated straight up for range).
  b.span({ z0: -0.064, z1: -0.026, y0: 0.011, y1: 0.0215, w: 0.022, mat: 'parkerized', r: 0.002 });
  for (const sx of [-1, 1]) {
    b.cylAxis({ axis: 'x', x: sx * 0.0155, y: 0.0175, z: -0.048, len: 0.0065, r: 0.0085, mat: 'parkerized', seg: 18 });
    b.cylAxis({ axis: 'x', x: sx * 0.0195, y: 0.0175, z: -0.048, len: 0.002, r: 0.0078, mat: 'steel', seg: 18 });
    b.extrude({ points: [[-0.047, 0.019], [-0.033, 0.019], [-0.034, 0.0335], [-0.042, 0.036]], width: 0.0022, x: sx * 0.0079, mat: 'parkerized', bevel: 0.0005 });
  }
  b.part('rearSight', [0, 0.029, -0.039]);
  plateXY(b, { outline: [[-0.0065, 0.019], [0.0065, 0.019], [0.0065, 0.033], [0.004, 0.0365], [-0.004, 0.0365], [-0.0065, 0.033]], holes: [circle(0, 0.029, 0.0014, 14)], z: -0.039, thick: 0.003, mat: 'parkerized' });
  b.anchor('rearSight', 0, 0.029, -0.039);
  b.body();

  // Bolt and operating rod with its handle (the part that cycles).
  b.part('bolt', [0, 0, -0.068]);
  b.cyl({ z0: -0.165, z1: -0.068, r0: 0.0092, mat: 'steelBright', seg: 18 });
  b.box({ x: 0.0085, y: 0.004, z: -0.105, w: 0.006, h: 0.007, d: 0.018, mat: 'steelBright', r: 0.0012 });
  b.cylAxis({ axis: 'x', x: 0.0125, y: 0.004, z: -0.105, len: 0.004, r: 0.003, mat: 'steelBright' });
  b.rod({ from: [0.004, -0.02, -0.664], to: [0.011, -0.014, -0.5], r: 0.0045, mat: 'parkerized' });
  b.rod({ from: [0.011, -0.014, -0.5], to: [0.0165, -0.005, -0.24], r: 0.0045, mat: 'parkerized' });
  b.rod({ from: [0.0165, -0.005, -0.24], to: [0.0175, -0.001, -0.165], r: 0.0042, mat: 'parkerized' });
  b.extrude({ points: [[-0.178, -0.004], [-0.147, -0.004], [-0.141, 0.003], [-0.143, 0.013], [-0.15, 0.013], [-0.152, 0.004], [-0.178, 0.004]], width: 0.006, x: 0.0195, mat: 'parkerized', bevel: 0.001 });
  b.cylAxis({ axis: 'x', x: 0.025, y: 0.008, z: -0.1465, len: 0.006, r: 0.0035, mat: 'parkerized' });
  b.anchor('chargingHandle', 0.028, 0.008, -0.1465);
  b.body();

  // En-bloc clip with 8 rounds, seated in the magazine.
  b.part('clip', [0, -0.03, -0.1]);
  for (let i = 0; i < 8; i++) {
    const cx = (i % 2 ? -1 : 1) * 0.0052;
    cartridge(b, { ...R3006, x: cx, y: -0.0075 - i * 0.0066, zBase: -0.078 });
  }
  for (const sx of [-1, 1]) b.span({ z0: -0.114, z1: -0.078, y0: -0.062, y1: -0.006, w: 0.0012, x: sx * 0.0118, mat: 'steelBright', r: 0.0004 });
  b.span({ z0: -0.08, z1: -0.077, y0: -0.062, y1: -0.006, w: 0.024, mat: 'steelBright', r: 0.0004 });
  b.body();

  b.anchor('muzzle', 0, 0, -0.7755);
  b.anchor('gripR', 0, -0.075, 0.076);
  b.anchor('trigger', 0, -0.072, 0.0);
  b.anchor('gripL', 0, -0.03, -0.36);
  b.anchor('shoulder', 0, -0.1, 0.324);
  b.meta.sight = 'aperture';
  b.meta.sightKind = 'slide';
  b.meta.boltThrow = 0.092;
}

// .30 Carbine family (M1, M1A1, M2): 904 mm long, 458 mm barrel, short-stroke
// gas piston with the operating slide on the right, round-topped receiver.
// v: { stock: 'wood' | 'folding', mag: 15 | 30, sight: 'flip' | 'adjustable', lugBand }
function carbine(b, v) {
  const P = 'parkerized';
  // Barrel.
  lathe(b, {
    mat: P,
    profile: [
      [0, -0.135],
      [0.0118, -0.135],
      [0.0112, -0.2],
      [0.0098, -0.3],
      [0.0088, -0.42],
      [0.0082, -0.5],
      [0.0078, -0.574],
      [0, -0.574],
    ],
  });
  // Front sight: base, protective wings and blade.
  b.cyl({ z0: -0.574, z1: -0.553, r0: 0.0095, mat: P });
  b.span({ z0: -0.573, z1: -0.555, y0: 0.006, y1: 0.0135, w: 0.014, mat: P, r: 0.002 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.572, 0.011], [-0.556, 0.011], [-0.559, 0.0245], [-0.569, 0.0245]], width: 0.0018, x: sx * 0.0055, mat: P, bevel: 0.0004 });
  b.extrude({ points: [[-0.5685, 0.012], [-0.5595, 0.012], [-0.562, 0.0235], [-0.566, 0.0235]], width: 0.002, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0235, -0.564);

  // Barrel band with sling swivel (left); the M2 band carries the bayonet lug.
  b.span({ z0: -0.383, z1: -0.365, y0: -0.03, y1: 0.0185, w: 0.03, mat: P, r: 0.004 });
  swivel(b, { x: -0.017, y: -0.006, z: -0.374, r: 0.007, w: 0.003 });
  if (v.lugBand) {
    b.span({ z0: -0.392, z1: -0.357, y0: -0.024, y1: 0.014, w: 0.032, mat: P, r: 0.004 });
    b.span({ z0: -0.43, z1: -0.385, y0: -0.024, y1: -0.012, w: 0.013, mat: P, r: 0.002 });
    b.span({ z0: -0.445, z1: -0.425, y0: -0.024, y1: -0.008, w: 0.01, mat: P, r: 0.002 });
  }
  // Handguard over the barrel.
  b.extrude({ points: S([[-0.381, -0.002], [-0.14, -0.002], [-0.142, 0.014], [-0.26, 0.0165], [-0.379, 0.0145]]), width: 0.027, mat: 'walnut', bevel: 0.008 });

  // Receiver: round top, rear sight base, lower body set in the stock.
  b.cyl({ z0: -0.14, z1: 0.016, r0: 0.0128, mat: P, seg: 24 });
  b.span({ z0: -0.14, z1: 0.016, y0: -0.03, y1: -0.002, w: 0.0256, mat: P, r: 0.003 });
  b.span({ z0: -0.128, z1: -0.058, y0: 0.002, y1: 0.0105, w: 0.006, x: 0.011, mat: 'steel', r: 0.001 }); // ejection port opening
  b.anchor('ejectionPort', 0.012, 0.01, -0.095);
  if (v.selector) b.cylAxis({ axis: 'x', x: -0.014, y: -0.001, z: -0.02, len: 0.004, r: 0.0045, mat: P });

  // Trigger housing with the guard, magazine catch and safety, trigger.
  b.span({ z0: -0.06, z1: 0.048, y0: -0.054, y1: -0.03, w: 0.018, mat: P, r: 0.002 });
  guard(b, { zf: -0.035, zr: 0.046, yTop: -0.052, yBot: -0.077, t: 0.0042, w: 0.01, mat: P, rake: 0.004 });
  b.cylAxis({ axis: 'x', x: 0.0095, y: -0.044, z: -0.05, len: 0.004, r: 0.0035, mat: P });
  b.cylAxis({ axis: 'x', x: -0.0095, y: -0.044, z: -0.038, len: 0.004, r: 0.003, mat: P });
  trigger(b, { z: 0, yTop: -0.053, len: 0.018, curve: 0.005, mat: P });

  // Rear sight.
  if (v.sight === 'adjustable') {
    // Late ramp sight: base with protective ears, aperture slide with windage knob.
    b.span({ z0: -0.03, z1: 0.016, y0: 0.0105, y1: 0.0155, w: 0.018, mat: P, r: 0.0015 });
    for (const sx of [-1, 1]) b.extrude({ points: [[-0.012, 0.014], [0.012, 0.014], [0.012, 0.0285], [0.004, 0.0295]], width: 0.002, x: sx * 0.0078, mat: P, bevel: 0.0004 });
    b.cylAxis({ axis: 'x', x: 0.0105, y: 0.0175, z: -0.004, len: 0.004, r: 0.005, mat: P });
    b.part('rearSight', [0, 0.024, 0.0]);
    plateXY(b, { outline: [[-0.005, 0.015], [0.005, 0.015], [0.005, 0.0285], [-0.005, 0.0285]], holes: [circle(0, 0.024, 0.0012, 14)], z: 0.0, thick: 0.0028, mat: P });
    b.span({ z0: -0.003, z1: 0.012, y0: 0.0145, y1: 0.0175, w: 0.012, mat: P, r: 0.0008 });
    b.anchor('rearSight', 0, 0.024, 0.0);
    b.body();
    b.meta.sightKind = 'slide';
  } else {
    // Early L-type flip sight (150 / 300 yd apertures): the game raises the
    // aperture straight up between the two settings.
    b.span({ z0: -0.022, z1: 0.014, y0: 0.0105, y1: 0.0155, w: 0.016, mat: P, r: 0.0015 });
    b.span({ z0: 0.0, z1: 0.012, y0: 0.0145, y1: 0.0175, w: 0.012, mat: P, r: 0.001 });
    b.part('rearSight', [0, 0.024, 0.0]);
    plateXY(b, { outline: [[-0.006, 0.0145], [0.006, 0.0145], [0.006, 0.0275], [0.003, 0.03], [-0.003, 0.03], [-0.006, 0.0275]], holes: [circle(0, 0.024, 0.0013, 14)], z: 0.0, thick: 0.0026, mat: P });
    b.anchor('rearSight', 0, 0.024, 0.0);
    b.body();
    b.meta.sightKind = 'slide';
  }

  if (v.stock === 'wood') {
    // One-piece stock with semi-pistol grip and the sling slot / oiler in the butt.
    const stock = path(
      [
        [-0.386, -0.004, 1],
        [-0.25, -0.004],
        [-0.14, -0.006],
        [-0.03, -0.007],
        [0.012, -0.004],
        [0.024, 0.006],
        [0.07, 0.003],
        [0.2, -0.014],
        [0.321, -0.03, 1],
        [0.3215, -0.148, 1],
        [0.22, -0.116],
        [0.13, -0.086],
        [0.108, -0.085],
        [0.088, -0.092],
        [0.068, -0.086],
        [0.054, -0.07],
        [0.05, -0.05],
        [-0.06, -0.05],
        [-0.13, -0.048],
        [-0.16, -0.033],
        [-0.25, -0.027],
        [-0.384, -0.025, 1],
      ],
      3,
    );
    const tp = taperZ([
      [-0.2, 0.74],
      [-0.12, 0.84],
      [0.0, 0.84],
      [0.07, 0.78],
      [0.13, 0.82],
      [0.26, 1.0],
    ]);
    loft(b, { points: stock, width: 0.038, mat: 'walnut', r: 0.008, taper: tp });
    // Sling slot through the butt with the oiler at its rear end.
    b.extrude({ points: slot(0.172, 0.218, -0.074, 0.0068), width: 0.038 * tp(0.195) + 0.0006, mat: 'black', bevel: 0.0004 });
    b.cylAxis({ axis: 'x', x: 0, y: -0.074, z: 0.2115, len: 0.038 * tp(0.21) + 0.002, r: 0.0058, mat: P }); // oiler
    b.extrude({ points: [[0.3205, -0.0295], [0.33, -0.0295], [0.326, -0.1485], [0.3205, -0.1485]], width: 0.038, mat: P, bevel: 0.002 });
    b.anchor('shoulder', 0, -0.088, 0.328);
  } else {
    // M1A1: wooden fore-end and pistol grip, folding wire stock (folds left).
    const fore = S(
      [
        [-0.386, -0.004],
        [-0.25, -0.004],
        [-0.14, -0.006],
        [-0.03, -0.007],
        [0.03, -0.006],
        [0.05, -0.01],
        [0.05, -0.05],
        [-0.06, -0.05],
        [-0.13, -0.048],
        [-0.16, -0.033],
        [-0.25, -0.027],
        [-0.384, -0.025],
      ],
      3,
    );
    b.extrude({ points: fore, width: 0.034, mat: 'walnut', bevel: 0.006, taper: taperZ([[-0.2, 0.82], [-0.12, 0.94]]) });
    b.extrude({
      points: S([
        [0.03, -0.012],
        [0.07, -0.014],
        [0.094, -0.03],
        [0.118, -0.104],
        [0.106, -0.122],
        [0.088, -0.119],
        [0.07, -0.088],
        [0.055, -0.052],
        [0.036, -0.03],
      ]),
      width: 0.03,
      mat: 'walnut',
      bevel: 0.0065,
    });
    b.cylAxis({ axis: 'x', x: 0, y: -0.022, z: 0.09, len: 0.036, r: 0.006, mat: P }); // hinge
    b.part('stock', [0, -0.022, 0.09]);
    b.rod({ from: [0, -0.015, 0.09], to: [0, -0.03, 0.323], r: 0.0055, mat: P });
    b.rod({ from: [0, -0.03, 0.098], to: [0, -0.125, 0.318], r: 0.0055, mat: P });
    b.extrude({ points: S([[0.15, -0.012], [0.27, -0.019], [0.27, -0.042], [0.15, -0.032]]), width: 0.03, mat: 'leather', bevel: 0.006 }); // cheek pad
    b.extrude({ points: S([[0.312, -0.022], [0.326, -0.024], [0.328, -0.08], [0.324, -0.138], [0.31, -0.136], [0.316, -0.08]]), width: 0.036, mat: P, bevel: 0.003 });
    b.body();
    b.anchor('shoulder', 0, -0.08, 0.328);
    b.meta.stockFold = { axis: 'y', angle: -PI }; // swings to the left side
  }

  // Operating slide with the charging handle, and the bolt (cycles together).
  b.part('bolt', [0, 0, -0.06]);
  b.cyl({ z0: -0.118, z1: -0.06, r0: 0.0068, x: 0.0045, y: 0.006, mat: 'steelBright', seg: 14 });
  b.rod({ from: [0.009, -0.012, -0.27], to: [0.0135, -0.004, -0.14], r: 0.0033, mat: P });
  b.span({ z0: -0.14, z1: -0.064, y0: -0.008, y1: 0.002, w: 0.005, x: 0.0145, mat: P, r: 0.0012 });
  b.extrude({ points: [[-0.078, -0.006], [-0.06, -0.006], [-0.058, 0.004], [-0.078, 0.004]], width: 0.008, x: 0.019, mat: P, bevel: 0.001 });
  b.cylAxis({ axis: 'x', x: 0.0255, y: -0.001, z: -0.068, len: 0.009, r: 0.0042, mat: P });
  b.anchor('chargingHandle', 0.029, -0.001, -0.068);
  b.body();

  // Magazine: 15-round straight or 30-round curved.
  const top = [-0.0915, -0.01];
  b.part('mag', [0, top[1], top[0]]);
  if (v.mag === 30) boxMag(b, { top, len: 0.17, depth: 0.046, width: 0.0158, angle: 0.02, k: 1.9, mat: P, plate: 0.005 });
  else boxMag(b, { top, len: 0.095, depth: 0.046, width: 0.0158, angle: 0.02, mat: P, plate: 0.005 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.574);
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

// Springfield M1903 family: Mauser-type bolt action, .30-06, 1097 mm long,
// 610 mm barrel. v.scope = M1903A4 (no iron sights, Weaver 330C / M73B1 on a
// Redfield Junior mount, bent bolt handle, C-type pistol grip stock).
function springfield(b, v) {
  const P = 'parkerized';
  const A4 = !!v.scope;
  // Barrel.
  lathe(b, {
    mat: P,
    profile: [
      [0, -0.205],
      [0.0145, -0.205],
      [0.0138, -0.3],
      [0.0118, -0.4],
      [0.0104, -0.52],
      [0.0094, -0.65],
      [0.0088, -0.777],
      [0, -0.777],
    ],
  });
  if (!A4) {
    // Front sight: fixed stud on the barrel, movable stud with the blade.
    b.span({ z0: -0.776, z1: -0.752, y0: 0.004, y1: 0.0125, w: 0.012, mat: P, r: 0.002 });
    b.span({ z0: -0.771, z1: -0.757, y0: 0.0115, y1: 0.0145, w: 0.009, mat: P, r: 0.001 });
    b.extrude({ points: [[-0.768, 0.014], [-0.76, 0.014], [-0.761, 0.0215], [-0.7665, 0.0215]], width: 0.0019, mat: P, bevel: 0.0003 });
    b.anchor('frontSight', 0, 0.0215, -0.764);
  }
  // Upper band with bayonet lug and stacking swivel, lower band with sling swivel.
  b.span({ z0: -0.692, z1: -0.656, y0: -0.03, y1: 0.0165, w: 0.032, mat: P, r: 0.004 });
  b.span({ z0: -0.71, z1: -0.688, y0: -0.03, y1: -0.019, w: 0.01, mat: P, r: 0.0015 });
  swivel(b, { x: 0, y: -0.04, z: -0.68, r: 0.0075, w: 0.0035 });
  b.span({ z0: -0.53, z1: -0.518, y0: -0.034, y1: 0.0175, w: 0.034, mat: P, r: 0.004 });
  swivel(b, { x: 0, y: -0.045, z: -0.524, r: 0.009, w: 0.004 });

  // Stock: straight grip (S-type) for the M1903, C-type pistol grip for the A4.
  const grip = A4
    ? [
        [0.13, -0.094],
        [0.108, -0.093],
        [0.088, -0.103],
        [0.07, -0.096],
        [0.058, -0.077],
        [0.05, -0.056],
      ]
    : [
        [0.15, -0.098],
        [0.1, -0.078],
        [0.07, -0.068],
        [0.052, -0.056],
      ];
  const stock = path(
    [
      [-0.692, -0.004, 1],
      [-0.5, -0.003],
      [-0.3, -0.004],
      [-0.2, -0.009],
      [-0.05, -0.009],
      [0.008, -0.006],
      [0.03, 0.0],
      [0.1, -0.008],
      [0.316, -0.044, 1],
      [0.309, -0.168, 1],
      [0.22, -0.132],
      ...grip,
      [-0.06, -0.052],
      [-0.16, -0.05],
      [-0.2, -0.04],
      [-0.27, -0.034],
      [-0.5, -0.031],
      [-0.69, -0.025, 1],
    ],
    3,
  );
  loft(b, {
    points: stock,
    width: 0.042,
    mat: 'walnut',
    r: 0.009,
    taper: taperZ([
      [-0.3, 0.76],
      [-0.2, 0.86],
      [-0.02, 0.86],
      [0.07, 0.78],
      [0.14, 0.8],
      [0.27, 1.0],
    ]),
  });
  // Handguard from the rear sight to the upper band.
  b.extrude({ points: S([[-0.66, -0.002], [-0.296, -0.002], [-0.3, 0.0155], [-0.48, 0.0185], [-0.658, 0.015]]), width: 0.028, mat: 'walnut', bevel: 0.0085 });
  b.extrude({ points: [[0.311, -0.0435], [0.3215, -0.0435], [0.3145, -0.1695], [0.304, -0.169]], width: 0.042, mat: P, bevel: 0.002 });
  swivel(b, { y: -0.157, z: 0.21, r: 0.009, w: 0.004 });

  // Receiver: ring, magazine body, bridge, tang; cutoff on the left.
  b.cyl({ z0: -0.205, z1: -0.159, r0: 0.0168, mat: P, seg: 24 });
  b.span({ z0: -0.162, z1: -0.084, y0: -0.032, y1: -0.003, w: 0.029, mat: P, r: 0.003 });
  for (const sx of [-1, 1]) b.span({ z0: -0.162, z1: -0.084, y0: -0.006, y1: 0.0085, w: 0.004, x: sx * 0.0115, mat: P, r: 0.0012 });
  b.cyl({ z0: -0.088, z1: -0.058, r0: 0.0152, mat: P, seg: 24 });
  b.span({ z0: -0.06, z1: 0.024, y0: -0.009, y1: -0.001, w: 0.013, mat: P, r: 0.002 });
  b.box({ x: -0.016, y: -0.003, z: -0.105, w: 0.004, h: 0.007, d: 0.022, mat: P, r: 0.001 });
  b.anchor('clipGuide', 0, 0.02, -0.075);
  b.anchor('ejectionPort', 0.012, 0.012, -0.125);
  // Floor plate, trigger guard, trigger.
  b.span({ z0: -0.158, z1: -0.06, y0: -0.058, y1: -0.049, w: 0.026, mat: P, r: 0.002 });
  guard(b, { zf: -0.062, zr: 0.052, yTop: -0.05, yBot: -0.078, t: 0.0045, w: 0.012, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.05, len: 0.022, curve: 0.007, mat: P });

  if (!A4) {
    // M1905 rear sight: base ring on the barrel, leaf hinged at the front
    // lying back along the base (battle sight notch at its rear end).
    b.cyl({ z0: -0.302, z1: -0.258, r0: 0.0165, mat: P, seg: 20 });
    b.span({ z0: -0.302, z1: -0.214, y0: 0.008, y1: 0.0158, w: 0.022, mat: P, r: 0.002 });
    b.cylAxis({ axis: 'x', x: 0.0125, y: 0.012, z: -0.244, len: 0.004, r: 0.0042, mat: P }); // windage knob
    b.part('rearSight', [0, 0.017, -0.296]);
    b.span({ z0: -0.298, z1: -0.214, y0: 0.0155, y1: 0.0185, w: 0.013, mat: P, r: 0.0008 });
    b.span({ z0: -0.236, z1: -0.224, y0: 0.0175, y1: 0.0205, w: 0.016, mat: P, r: 0.0008 }); // slide
    for (const sx of [-1, 1]) b.extrude({ points: [[-0.2185, 0.017], [-0.2145, 0.017], [-0.2145, 0.0245], [-0.2185, 0.0245]], width: 0.0045, x: sx * 0.0035, mat: P, bevel: 0.0003 });
    b.span({ z0: -0.2185, z1: -0.2145, y0: 0.017, y1: 0.0213, w: 0.0028, mat: P, r: 0.0003 });
    b.anchor('rearSight', 0, 0.0215, -0.2165);
    b.body();
    b.meta.sight = 'notch';
    b.meta.sightKind = 'leaf';
  } else {
    // Redfield Junior base and rings, Weaver 330C (M73B1) 2.5x scope.
    const yc = 0.0375;
    b.span({ z0: -0.198, z1: -0.068, y0: 0.0155, y1: 0.0235, w: 0.017, mat: 'steel', r: 0.002 });
    for (const [z, wide] of [[-0.183, 0], [-0.083, 1]]) {
      tube(b, { y: yc, z0: z - 0.009, z1: z + 0.009, rIn: 0.0096, rOut: 0.0128, mat: 'steel', seg: 22 });
      b.span({ z0: z - 0.009, z1: z + 0.009, y0: 0.022, y1: yc - 0.008, w: 0.013, mat: 'steel', r: 0.002 });
      if (wide) for (const sx of [-1, 1]) b.cylAxis({ axis: 'x', x: sx * 0.0125, y: 0.0245, z, len: 0.008, r: 0.0032, mat: 'steel' }); // windage screws
    }
    lathe(b, {
      mat: 'steel',
      y: yc,
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
    b.cylAxis({ axis: 'y', x: 0, y: yc + 0.0125, z: -0.133, len: 0.01, r: 0.0072, mat: 'steel' }); // elevation
    b.cylAxis({ axis: 'x', x: 0.0125, y: yc, z: -0.133, len: 0.01, r: 0.0072, mat: 'steel' }); // windage
    b.cylAxis({ axis: 'z', x: 0, y: yc, z: 0.0121, len: 0.0006, r: 0.0105, mat: 'glass' });
    b.cylAxis({ axis: 'z', x: 0, y: yc, z: -0.2722, len: 0.0006, r: 0.0094, mat: 'glass' });
    b.anchor('scopeEye', 0, yc, 0.0122);
    b.anchor('scopeFront', 0, yc, -0.2722);
    b.meta.sight = 'scope';
    b.meta.scopeMag = 2.5;
  }

  // Bolt with the cocking piece and safety; straight handle, or bent for the A4.
  b.part('bolt', [0, 0, 0.016]);
  b.cyl({ z0: -0.167, z1: -0.056, r0: 0.0094, mat: 'steelBright', seg: 18 });
  b.cyl({ z0: -0.058, z1: 0.0, r0: 0.0118, r1: 0.0108, mat: P, seg: 18 });
  b.cyl({ z0: 0.0, z1: 0.016, r0: 0.0085, r1: 0.007, mat: P, seg: 14 });
  b.box({ x: 0.0, y: 0.0115, z: -0.012, w: 0.005, h: 0.009, d: 0.014, mat: P, r: 0.001 }); // safety wing
  if (A4) {
    b.rod({ from: [0.008, 0.0, -0.06], to: [0.028, -0.012, -0.056], r: 0.0042, mat: 'steelBright' });
    b.rod({ from: [0.028, -0.012, -0.056], to: [0.036, -0.032, -0.046], r: 0.0038, mat: 'steelBright' });
    b.sphere({ x: 0.037, y: -0.037, z: -0.044, r: 0.0085, mat: 'steelBright' });
    b.anchor('boltHandle', 0.037, -0.037, -0.044);
  } else {
    b.rod({ from: [0.008, 0.0, -0.06], to: [0.045, -0.014, -0.054], r: 0.0042, r1: 0.0036, mat: 'steelBright' });
    b.sphere({ x: 0.05, y: -0.017, z: -0.052, r: 0.0088, mat: 'steelBright' });
    b.anchor('boltHandle', 0.05, -0.017, -0.052);
  }
  b.body();

  b.anchor('muzzle', 0, 0, -0.777);
  b.anchor('gripR', 0, -0.06, 0.08);
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

// M1903A4 sniper: Weaver 330C (M73B1) 2.5x scope, Redfield Junior mount, no iron sights.
export function m1903a4(b) {
  springfield(b, { scope: true });
}

// Thompson M1A1: .45 ACP blowback SMG, 813 mm long, 267 mm plain barrel, side
// cocking knob, horizontal fore-end, fixed protected aperture rear sight,
// 30-round stick magazine.
export function thompson_m1a1(b) {
  const P = 'parkerized';
  // Barrel and front sight blade.
  lathe(b, { mat: P, profile: [[0, -0.205], [0.0118, -0.205], [0.0108, -0.3], [0.0098, -0.465], [0, -0.465]] });
  b.cyl({ z0: -0.462, z1: -0.446, r0: 0.0118, mat: P });
  b.extrude({ points: [[-0.46, 0.008], [-0.448, 0.008], [-0.451, 0.034], [-0.457, 0.034]], width: 0.0024, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.034, -0.454);
  // Receiver: rounded block with ejection port (right) and cocking slot.
  b.box({ x: 0, y: 0.0025, z: -0.0725, w: 0.032, h: 0.041, d: 0.265, mat: P, r: 0.006 });
  b.cyl({ z0: -0.215, z1: -0.2, r0: 0.0135, mat: P });
  b.span({ z0: -0.13, z1: -0.075, y0: -0.002, y1: 0.0145, w: 0.002, x: 0.0158, mat: 'black', r: 0.0006 });
  b.span({ z0: -0.135, z1: 0.03, y0: 0.0025, y1: 0.0065, w: 0.002, x: 0.0158, mat: 'black', r: 0.0006 });
  b.anchor('ejectionPort', 0.017, 0.006, -0.1);
  // Frame (lower receiver): magazine well, trigger guard, safety and selector.
  b.span({ z0: -0.165, z1: 0.064, y0: -0.044, y1: -0.016, w: 0.03, mat: P, r: 0.003 });
  b.span({ z0: -0.162, z1: -0.108, y0: -0.054, y1: -0.04, w: 0.032, mat: P, r: 0.003 });
  guard(b, { zf: -0.036, zr: 0.03, yTop: -0.042, yBot: -0.072, t: 0.0045, w: 0.011, mat: P, rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.043, len: 0.019, curve: 0.005, mat: P });
  for (const [z, l] of [[-0.022, 0.016], [0.018, 0.014]]) b.box({ x: -0.0162, y: -0.03, z, w: 0.003, h: 0.006, d: l, mat: P, r: 0.001 });
  // Horizontal fore-end.
  loft(b, { points: path([[-0.372, -0.008, 1], [-0.207, -0.008, 1], [-0.207, -0.046, 1], [-0.25, -0.047], [-0.33, -0.045], [-0.372, -0.04, 1]]), width: 0.034, mat: 'walnut', r: 0.009, rTop: 0.004 });
  b.span({ z0: -0.34, z1: -0.235, y0: -0.032, y1: -0.026, w: 0.0352, mat: 'walnut', r: 0.002 }); // finger groove ridge
  // Pistol grip.
  b.extrude({
    points: S([
      [0.026, -0.042],
      [0.066, -0.042],
      [0.082, -0.07],
      [0.112, -0.128],
      [0.106, -0.142],
      [0.078, -0.138],
      [0.062, -0.104],
      [0.046, -0.07],
      [0.03, -0.054],
    ]),
    width: 0.03,
    mat: 'walnut',
    bevel: 0.007,
  });
  // Butt stock with butt plate and swivel.
  loft(b, {
    points: path([
      [0.066, 0.016, 1],
      [0.1, 0.012],
      [0.2, -0.008],
      [0.342, -0.03, 1],
      [0.342, -0.155, 1],
      [0.22, -0.118],
      [0.12, -0.072],
      [0.066, -0.044, 1],
    ]),
    width: 0.036,
    taper: taperZ([[0.08, 0.84], [0.3, 1.0]]),
    mat: 'walnut',
    r: 0.008,
  });
  b.span({ z0: 0.06, z1: 0.07, y0: -0.044, y1: 0.017, w: 0.033, mat: P, r: 0.002 });
  b.extrude({ points: [[0.341, -0.0295], [0.348, -0.0295], [0.348, -0.1555], [0.341, -0.1555]], width: 0.037, mat: P, bevel: 0.002 });
  swivel(b, { y: -0.141, z: 0.27, r: 0.008, w: 0.004 });
  swivel(b, { x: -0.019, y: -0.025, z: -0.3, r: 0.008, w: 0.003 });
  // Fixed rear sight: aperture with protective ears.
  b.span({ z0: 0.03, z1: 0.06, y0: 0.022, y1: 0.0275, w: 0.016, mat: P, r: 0.0012 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.034, 0.026], [0.058, 0.026], [0.058, 0.035], [0.05, 0.044], [0.044, 0.044]], width: 0.002, x: sx * 0.0072, mat: P, bevel: 0.0004 });
  plateXY(b, { outline: [[-0.006, 0.026], [0.006, 0.026], [0.006, 0.041], [-0.006, 0.041]], holes: [circle(0, 0.0375, 0.0014, 14)], z: 0.05, thick: 0.0025, mat: P });
  b.anchor('rearSight', 0, 0.0375, 0.05);
  // Cocking knob (forward, bolt closed).
  b.part('bolt', [0, 0, -0.12]);
  b.span({ z0: -0.13, z1: -0.11, y0: 0.001, y1: 0.008, w: 0.004, x: 0.0165, mat: P, r: 0.001 });
  b.cylAxis({ axis: 'x', x: 0.022, y: 0.0045, z: -0.12, len: 0.008, r: 0.0055, mat: P, seg: 16 });
  b.anchor('chargingHandle', 0.026, 0.0045, -0.12);
  b.body();
  // 30-round stick magazine.
  const top = [-0.135, -0.02];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.245, depth: 0.038, width: 0.024, mat: P, plate: 0.005 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.465);
  b.anchor('gripR', 0, -0.075, 0.075);
  b.anchor('trigger', 0, -0.054, 0.0);
  b.anchor('gripL', 0, -0.045, -0.29);
  b.anchor('shoulder', 0, -0.09, 0.348);
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.115;
  b.meta.openBolt = true;
}

// M3 "Grease Gun": .45 ACP stamped-steel SMG, 757 mm (stock out), 203 mm barrel,
// tubular receiver, fixed aperture sight, crank cocking handle, sliding wire
// stock, 30-round magazine. Shown ready to fire: ejection port cover open.
export function m3_greasegun(b) {
  const P = 'parkerized';
  const R = 0.026;
  // Barrel with the knurled retaining collar.
  lathe(b, { mat: P, profile: [[0, -0.3], [0.011, -0.3], [0.0105, -0.36], [0.0098, -0.427], [0, -0.427]] });
  b.cyl({ z0: -0.322, z1: -0.296, r0: 0.0165, mat: 'steel', seg: 16 });
  // Receiver tube with front and rear caps.
  b.cyl({ z0: -0.3, z1: 0.098, r0: R, mat: P, seg: 28 });
  lathe(b, { mat: P, profile: [[0, 0.096], [R - 0.001, 0.096], [R - 0.003, 0.104], [0, 0.106]] });
  // Front sight (on the receiver) and fixed rear aperture with guards.
  b.extrude({ points: [[-0.298, 0.02], [-0.282, 0.02], [-0.286, 0.0387], [-0.293, 0.0387]], width: 0.0025, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.0387, -0.2895);
  b.span({ z0: 0.068, z1: 0.096, y0: 0.022, y1: 0.03, w: 0.016, mat: P, r: 0.0015 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.07, 0.028], [0.094, 0.028], [0.094, 0.047], [0.084, 0.047]], width: 0.002, x: sx * 0.0075, mat: P, bevel: 0.0004 });
  plateXY(b, { outline: [[-0.006, 0.028], [0.006, 0.028], [0.006, 0.045], [-0.006, 0.045]], holes: [circle(0, 0.0415, 0.0015, 14)], z: 0.088, thick: 0.0025, mat: P });
  b.anchor('rearSight', 0, 0.0415, 0.088);
  // Ejection port with its cover swung open (down) on the right.
  b.span({ z0: -0.27, z1: -0.175, y0: -0.006, y1: 0.012, w: 0.002, x: 0.0245, mat: 'black', r: 0.0006 });
  b.box({ x: 0.032, y: -0.02, z: -0.2225, w: 0.0018, h: 0.026, d: 0.1, mat: P, r: 0.0006, rz: 0.5 });
  b.anchor('ejectionPort', 0.026, 0.004, -0.222);
  // Magazine housing and magazine catch.
  b.span({ z0: -0.232, z1: -0.178, y0: -0.078, y1: -0.012, w: 0.03, mat: P, r: 0.003 });
  b.span({ z0: -0.178, z1: -0.168, y0: -0.05, y1: -0.03, w: 0.008, mat: P, r: 0.0012 });
  // Trigger housing, guard, grip (stamped), crank cocking handle.
  b.span({ z0: -0.055, z1: 0.085, y0: -0.04, y1: -0.012, w: 0.03, mat: P, r: 0.003 });
  guard(b, { zf: -0.042, zr: 0.028, yTop: -0.038, yBot: -0.07, t: 0.004, w: 0.012, mat: P, rake: 0.008 });
  trigger(b, { z: 0, yTop: -0.04, len: 0.018, curve: 0.005, mat: P });
  b.extrude({
    points: S([
      [0.02, -0.038],
      [0.072, -0.038],
      [0.088, -0.07],
      [0.108, -0.128],
      [0.1, -0.138],
      [0.074, -0.136],
      [0.058, -0.098],
      [0.042, -0.064],
      [0.024, -0.05],
    ]),
    width: 0.028,
    mat: P,
    bevel: 0.006,
  });
  b.cylAxis({ axis: 'x', x: 0.017, y: -0.026, z: -0.05, len: 0.006, r: 0.006, mat: P });
  b.rod({ from: [0.021, -0.026, -0.05], to: [0.023, -0.036, -0.012], r: 0.0028, mat: P });
  b.cylAxis({ axis: 'x', x: 0.027, y: -0.037, z: -0.01, len: 0.008, r: 0.0035, mat: P });
  b.anchor('chargingHandle', 0.031, -0.037, -0.01);
  // Wire stock: guide tubes beside the grip, U-shaped wire, extended.
  for (const sx of [-1, 1]) {
    b.cyl({ z0: -0.045, z1: 0.1, r0: 0.0055, x: sx * 0.021, y: -0.03, mat: P, seg: 12 });
    b.rod({ from: [sx * 0.021, -0.03, 0.1], to: [sx * 0.017, -0.038, 0.318], r: 0.0042, mat: P });
    b.rod({ from: [sx * 0.017, -0.038, 0.318], to: [sx * 0.017, -0.11, 0.33], r: 0.0042, mat: P });
    b.sphere({ x: sx * 0.017, y: -0.038, z: 0.318, r: 0.0042, mat: P });
  }
  b.rod({ from: [-0.017, -0.11, 0.33], to: [0.017, -0.11, 0.33], r: 0.0042, mat: P });
  b.span({ z0: 0.322, z1: 0.333, y0: -0.106, y1: -0.084, w: 0.03, mat: P, r: 0.002 });
  // Bolt, visible through the open ejection port.
  b.part('bolt', [0, 0, -0.18]);
  b.cyl({ z0: -0.225, z1: -0.17, r0: 0.0235, mat: 'steelBright', seg: 20 });
  b.body();
  // 30-round magazine.
  const top = [-0.205, -0.016];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.228, depth: 0.037, width: 0.024, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.427);
  b.anchor('gripR', 0, -0.075, 0.075);
  b.anchor('trigger', 0, -0.05, 0.0);
  b.anchor('gripL', 0, -0.06, -0.205);
  b.anchor('shoulder', 0, -0.08, 0.334);
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.09;
  b.meta.openBolt = true;
  b.meta.stockSlide = 0.178; // wire stock collapses forward by this much
}

// Browning Automatic Rifle M1918A2: .30-06, 1214 mm, 610 mm barrel, flash hider
// with the bipod at the muzzle, gas cylinder under the barrel, leaf aperture
// rear sight, 20-round magazine, pistol-grip butt stock.
export function bar_m1918a2(b) {
  const P = 'parkerized';
  // Barrel and flash hider.
  lathe(b, { mat: P, profile: [[0, -0.3], [0.0148, -0.3], [0.0135, -0.45], [0.0118, -0.62], [0.0108, -0.805], [0, -0.805]] });
  lathe(b, { mat: P, profile: [[0.009, -0.869], [0.0135, -0.869], [0.0128, -0.82], [0.0122, -0.806], [0.0108, -0.8], [0.0085, -0.8]] });
  // Front sight with protective ears.
  b.cyl({ z0: -0.792, z1: -0.766, r0: 0.0128, mat: P });
  b.span({ z0: -0.79, z1: -0.768, y0: 0.008, y1: 0.022, w: 0.016, mat: P, r: 0.002 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.789, 0.018], [-0.769, 0.018], [-0.772, 0.0505], [-0.786, 0.0505]], width: 0.0022, x: sx * 0.0068, mat: P, bevel: 0.0004 });
  b.extrude({ points: [[-0.784, 0.02], [-0.774, 0.02], [-0.7765, 0.0465], [-0.7815, 0.0465]], width: 0.0022, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0465, -0.779);
  // Gas block, gas cylinder with regulator, fore-end.
  b.span({ z0: -0.715, z1: -0.682, y0: -0.036, y1: 0.012, w: 0.026, mat: P, r: 0.004 });
  b.cyl({ z0: -0.73, z1: -0.3, r0: 0.0118, y: -0.025, mat: P });
  b.cyl({ z0: -0.745, z1: -0.73, r0: 0.0095, y: -0.025, mat: P });
  loft(b, { points: path([[-0.628, 0.006, 1], [-0.31, 0.006, 1], [-0.31, -0.054, 1], [-0.4, -0.056], [-0.6, -0.054], [-0.628, -0.046, 1]]), width: 0.044, mat: 'walnut', r: 0.012, rTop: 0.006 });
  swivel(b, { y: -0.044, z: -0.698, r: 0.008, w: 0.004 });

  // Receiver: tall box; ejection port cover (right), cocking slot (left).
  b.span({ z0: -0.3, z1: 0.052, y0: -0.046, y1: 0.022, w: 0.036, mat: P, r: 0.004 });
  b.span({ z0: -0.3, z1: -0.27, y0: -0.04, y1: 0.017, w: 0.04, mat: P, r: 0.004 });
  b.span({ z0: -0.16, z1: -0.06, y0: -0.004, y1: 0.016, w: 0.002, x: 0.0182, mat: P, r: 0.0006 });
  b.span({ z0: -0.27, z1: -0.02, y0: -0.012, y1: -0.006, w: 0.002, x: -0.0182, mat: 'black', r: 0.0006 });
  b.anchor('ejectionPort', 0.019, 0.006, -0.11);
  // Magazine guard, trigger guard, selector.
  b.span({ z0: -0.212, z1: -0.108, y0: -0.054, y1: -0.044, w: 0.034, mat: P, r: 0.002 });
  b.span({ z0: -0.1, z1: -0.088, y0: -0.054, y1: -0.042, w: 0.012, mat: P, r: 0.0015 }); // magazine release
  guard(b, { zf: -0.04, zr: 0.045, yTop: -0.044, yBot: -0.078, t: 0.0045, w: 0.012, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.045, len: 0.021, curve: 0.006, mat: P });
  b.cylAxis({ axis: 'x', x: -0.019, y: -0.03, z: -0.012, len: 0.004, r: 0.0065, mat: P });
  b.box({ x: -0.022, y: -0.024, z: -0.012, w: 0.003, h: 0.014, d: 0.004, mat: P, r: 0.001 });

  // Rear sight: base with ears; the leaf carries the aperture (raised by range).
  b.span({ z0: 0.005, z1: 0.05, y0: 0.02, y1: 0.0275, w: 0.022, mat: P, r: 0.0015 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.012, 0.026], [0.048, 0.026], [0.048, 0.042], [0.03, 0.049], [0.02, 0.048]], width: 0.0025, x: sx * 0.0095, mat: P, bevel: 0.0004 });
  // Aperture slide on the raised leaf: moves straight up with the range.
  for (const sx of [-1, 1]) b.extrude({ points: [[0.037, 0.026], [0.043, 0.026], [0.043, 0.072], [0.037, 0.072]], width: 0.0032, x: sx * 0.0058, mat: P, bevel: 0.0006 }); // leaf rails
  b.span({ z0: 0.037, z1: 0.043, y0: 0.069, y1: 0.073, w: 0.0148, mat: P, r: 0.0008 });
  b.part('rearSight', [0, 0.0465, 0.0345]);
  plateXY(b, { outline: [[-0.0068, 0.04], [0.0068, 0.04], [0.0068, 0.053], [-0.0068, 0.053]], holes: [circle(0, 0.0465, 0.0013, 14)], z: 0.0345, thick: 0.0025, mat: P });
  b.anchor('rearSight', 0, 0.0465, 0.0345);
  b.body();
  b.meta.sightKind = 'slide';

  // Butt stock with pistol grip; butt plate with folded shoulder support.
  loft(b, {
    points: path([
      [0.05, 0.02, 1],
      [0.1, 0.016],
      [0.2, 0.0],
      [0.338, -0.022, 1],
      [0.338, -0.165, 1],
      [0.24, -0.135],
      [0.15, -0.1],
      [0.13, -0.098],
      [0.108, -0.122],
      [0.084, -0.122],
      [0.066, -0.09],
      [0.05, -0.05, 1],
    ]),
    width: 0.04,
    taper: taperZ([[0.06, 0.82], [0.1, 0.8], [0.16, 0.86], [0.3, 1.0]]),
    mat: 'walnut',
    r: 0.009,
  });
  b.extrude({ points: [[0.337, -0.021], [0.346, -0.021], [0.346, -0.166], [0.337, -0.166]], width: 0.041, mat: P, bevel: 0.002 });
  b.extrude({ points: [[0.346, -0.03], [0.352, -0.03], [0.352, -0.08], [0.346, -0.08]], width: 0.03, mat: P, bevel: 0.0015 });
  swivel(b, { y: -0.155, z: 0.28, r: 0.009, w: 0.004 });

  // Bipod clamped behind the flash hider (deployed).
  b.part('bipod', [0, -0.012, -0.81]);
  b.cyl({ z0: -0.818, z1: -0.802, r0: 0.0145, mat: P });
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.01, -0.012, -0.81], to: [sx * 0.105, -0.33, -0.83], r: 0.0058, r1: 0.005, mat: P });
    b.box({ x: sx * 0.106, y: -0.334, z: -0.83, w: 0.014, h: 0.006, d: 0.045, mat: P, r: 0.002 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2; // rotate about X to fold the legs back along the barrel

  // Cocking handle (left side, forward), operating rod.
  b.part('bolt', [0, 0, -0.26]);
  b.span({ z0: -0.27, z1: -0.25, y0: -0.013, y1: -0.005, w: 0.004, x: -0.0195, mat: P, r: 0.001 });
  b.cylAxis({ axis: 'x', x: -0.026, y: -0.009, z: -0.26, len: 0.01, r: 0.0055, mat: P, seg: 16 });
  b.anchor('chargingHandle', -0.031, -0.009, -0.26);
  b.body();
  // 20-round magazine.
  const top = [-0.16, -0.022];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.14, depth: 0.09, width: 0.025, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.869);
  b.anchor('gripR', 0, -0.085, 0.095);
  b.anchor('trigger', 0, -0.056, 0.0);
  b.anchor('gripL', 0, -0.045, -0.47);
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
  b.cyl({ z0: -0.875, z1: -0.33, r0: 0.0225, mat: 'perforated', open: true, seg: 24 });
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
  b.extrude({
    points: S([
      [0.008, -0.034],
      [0.04, -0.034],
      [0.058, -0.07],
      [0.074, -0.122],
      [0.066, -0.134],
      [0.044, -0.13],
      [0.034, -0.096],
      [0.02, -0.06],
    ]),
    width: 0.03,
    mat: 'walnut',
    bevel: 0.006,
  });
  guard(b, { zf: -0.03, zr: 0.022, yTop: -0.033, yBot: -0.062, t: 0.004, w: 0.01, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.034, len: 0.018, curve: 0.005, mat: P });
  // Steel shoulder stock on the backplate.
  loft(b, {
    points: path([
      [0.03, 0.022, 1],
      [0.1, 0.012],
      [0.2, -0.004],
      [0.36, -0.03, 1],
      [0.36, -0.15, 1],
      [0.25, -0.118],
      [0.14, -0.07],
      [0.08, -0.04],
      [0.03, -0.03, 1],
    ]),
    width: 0.034,
    taper: taperZ([[0.04, 0.8], [0.3, 1.0]]),
    mat: P,
    r: 0.008,
  });
  b.extrude({ points: [[0.36, -0.03], [0.366, -0.03], [0.366, -0.151], [0.36, -0.151]], width: 0.035, mat: 'steel', bevel: 0.0015 });
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
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.09;
}

// Johnson M1941 light machine gun: .30-06, 1067 mm, 559 mm barrel, ventilated
// barrel sleeve, bipod, in-line butt stock, separate pistol grip, high sights,
// 20-round single-column magazine sticking out on the LEFT.
export function johnson_lmg(b) {
  const P = 'parkerized';
  lathe(b, { mat: P, profile: [[0, -0.2], [0.0125, -0.2], [0.0112, -0.48], [0.0098, -0.6], [0.0092, -0.71], [0, -0.71]] });
  b.cyl({ z0: -0.468, z1: -0.2, r0: 0.0195, mat: 'perforated', open: true, seg: 22 });
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
  plateXY(b, { outline: [[-0.0055, 0.032], [0.0055, 0.032], [0.0055, 0.063], [-0.0055, 0.063]], holes: [circle(0, 0.0595, 0.0014, 14)], z: 0.048, thick: 0.0025, mat: P });
  b.anchor('rearSight', 0, 0.0595, 0.048);
  b.body();
  b.meta.sightKind = 'slide';
  // Pistol grip, trigger guard, trigger.
  b.span({ z0: -0.045, z1: 0.05, y0: -0.04, y1: -0.024, w: 0.026, mat: P, r: 0.003 });
  guard(b, { zf: -0.036, zr: 0.026, yTop: -0.038, yBot: -0.066, t: 0.004, w: 0.01, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.039, len: 0.018, curve: 0.005, mat: P });
  b.extrude({
    points: S([
      [0.024, -0.038],
      [0.06, -0.038],
      [0.078, -0.07],
      [0.1, -0.125],
      [0.092, -0.137],
      [0.068, -0.134],
      [0.054, -0.098],
      [0.038, -0.062],
    ]),
    width: 0.03,
    mat: 'walnut',
    bevel: 0.0065,
  });
  // In-line butt stock with butt plate.
  loft(b, {
    points: path([
      [0.064, 0.02, 1],
      [0.15, 0.016],
      [0.35, 0.006, 1],
      [0.35, -0.116, 1],
      [0.24, -0.088],
      [0.13, -0.046],
      [0.064, -0.03, 1],
    ]),
    width: 0.036,
    taper: taperZ([[0.07, 0.82], [0.28, 1.0]]),
    mat: 'walnut',
    r: 0.009,
  });
  b.span({ z0: 0.058, z1: 0.068, y0: -0.032, y1: 0.022, w: 0.034, mat: P, r: 0.002 });
  b.extrude({ points: [[0.349, 0.007], [0.357, 0.007], [0.357, -0.117], [0.349, -0.117]], width: 0.037, mat: P, bevel: 0.002 });
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
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.09;
}

// Colt M1911A1: .45 ACP, 216 mm long, 127 mm barrel, 7-round magazine, slide
// with rear serrations, spur hammer (cocked), arched mainspring housing.
export function m1911a1(b) {
  const P = 'parkerized';
  // Frame with the trigger guard and the 18 deg grip.
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
  // Brown plastic grips with screws, lanyard loop.
  b.extrude({ points: S([[0.021, -0.037], [0.068, -0.032], [0.07, -0.05], [0.083, -0.104], [0.085, -0.116], [0.05, -0.118], [0.044, -0.106], [0.023, -0.046]]), width: 0.0285, mat: 'bakelite', bevel: 0.0022 });
  for (const sx of [-1, 1]) for (const [z, y] of [[0.043, -0.042], [0.064, -0.108]]) b.cylAxis({ axis: 'x', x: sx * 0.0145, y, z, len: 0.0012, r: 0.0028, mat: 'steel', seg: 10 });
  swivel(b, { y: -0.1265, z: 0.084, r: 0.004, t: 0.0012, w: 0.002 });
  // Controls on the left: thumb safety, slide stop, magazine release.
  b.box({ x: -0.0118, y: -0.0125, z: 0.052, w: 0.002, h: 0.006, d: 0.02, mat: P, r: 0.0008 });
  b.box({ x: -0.0118, y: -0.0145, z: -0.028, w: 0.002, h: 0.006, d: 0.028, mat: P, r: 0.0008 });
  b.cylAxis({ axis: 'x', x: -0.0115, y: -0.0145, z: -0.04, len: 0.003, r: 0.0028, mat: P, seg: 10 });
  b.cylAxis({ axis: 'x', x: -0.011, y: -0.03, z: 0.0165, len: 0.003, r: 0.0034, mat: P, seg: 10 });
  // Trigger (sliding, short).
  b.box({ x: 0, y: -0.0305, z: 0.0025, w: 0.006, h: 0.015, d: 0.005, mat: P, r: 0.0012 });
  // Barrel (stays in the frame when the slide recoils).
  b.cyl({ z0: -0.1255, z1: -0.025, r0: 0.0071, mat: 'steelBright', seg: 16 });
  b.anchor('ejectionPort', 0.012, 0.004, -0.02);

  // Slide with sights, serrations, barrel bushing and recoil spring plug.
  b.part('bolt', [0, 0, 0.06]);
  b.extrude({
    points: [
      [-0.1255, -0.021],
      [-0.1255, 0.007],
      [-0.123, 0.0105],
      [0.06, 0.0105],
      [0.0615, 0.006],
      [0.06, -0.0105],
      [-0.091, -0.0105],
      [-0.095, -0.021],
    ],
    width: 0.0235,
    mat: P,
    bevel: 0.002,
  });
  b.span({ z0: -0.032, z1: -0.004, y0: -0.001, y1: 0.0085, w: 0.002, x: 0.0113, mat: 'black', r: 0.0005 });
  for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) b.box({ x: sx * 0.0117, y: -0.0005, z: 0.031 + i * 0.0035, w: 0.0008, h: 0.015, d: 0.0011, mat: 'black', r: 0.0002 });
  tube(b, { z0: -0.1265, z1: -0.118, rIn: 0.0065, rOut: 0.0088, mat: P, seg: 16 });
  b.cyl({ z0: -0.1265, z1: -0.12, r0: 0.0052, y: -0.015, mat: P, seg: 14 });
  b.extrude({ points: [[-0.1205, 0.009], [-0.1125, 0.009], [-0.1135, 0.0144], [-0.1195, 0.0144]], width: 0.0028, mat: P, bevel: 0.0004 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.044, 0.009], [0.052, 0.009], [0.052, 0.0168], [0.045, 0.0168]], width: 0.0042, x: sx * 0.0035, mat: P, bevel: 0.0004 });
  b.span({ z0: 0.044, z1: 0.052, y0: 0.009, y1: 0.0148, w: 0.0028, mat: P, r: 0.0003 });
  b.body();
  b.anchor('frontSight', 0, 0.0144, -0.1165);
  b.anchor('rearSight', 0, 0.0148, 0.048);

  // Hammer (cocked), pivoting on its pin.
  b.part('hammer', [0, -0.006, 0.063]);
  b.extrude({ points: S([[0.057, -0.012], [0.067, -0.013], [0.074, -0.004], [0.083, 0.007], [0.09, 0.0075], [0.089, 0.0015], [0.08, -0.006], [0.07, -0.016], [0.059, -0.017]]), width: 0.0085, mat: P, bevel: 0.0008 });
  b.body();

  // Magazine in the grip (base plate visible), slides out along the grip axis.
  const ax = [0.309, -0.951];
  const top = [0.0255, -0.013];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.1167, depth: 0.033, width: 0.0145, angle: -0.314, mat: 'steel', plate: 0.0045, lip: 0.0012, rib: false });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, ax[1], ax[0]];

  b.anchor('muzzle', 0, 0, -0.1255);
  b.anchor('gripR', 0, -0.07, 0.056);
  b.anchor('trigger', 0, -0.031, 0.0);
  b.anchor('gripL', -0.022, -0.085, 0.052);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.038;
}

// Smith & Wesson M1917: .45 ACP six-shot revolver (half-moon clips), 274 mm,
// 140 mm barrel, swing-out fluted cylinder, round-butt walnut grips.
export function m1917_revolver(b) {
  const P = 'steel';
  const cy = -0.0135; // cylinder axis
  // Barrel, half-moon front sight, ejector rod and its locking lug.
  lathe(b, { mat: P, profile: [[0, -0.052], [0.0094, -0.052], [0.0088, -0.12], [0.0083, -0.192], [0, -0.192]] });
  b.extrude({ points: S([[-0.19, 0.006], [-0.176, 0.006], [-0.18, 0.014], [-0.185, 0.0164], [-0.189, 0.0125]]), width: 0.0028, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.0164, -0.1845);
  b.span({ z0: -0.104, z1: -0.088, y0: cy - 0.004, y1: -0.006, w: 0.007, mat: P, r: 0.0015 });
  b.cyl({ z0: -0.098, z1: -0.044, r0: 0.0026, y: cy, mat: P, seg: 10 });
  b.cyl({ z0: -0.098, z1: -0.09, r0: 0.0042, y: cy, mat: P, seg: 12 });
  // Frame: front, top strap, recoil shield, trigger guard, grip frame.
  b.extrude({
    points: [
      [-0.058, -0.024],
      [-0.058, 0.0105],
      [-0.05, 0.016],
      [0.0, 0.016],
      [0.004, 0.0168],
      [0.03, 0.0168],
      [0.04, 0.012],
      [0.048, -0.002],
      [0.052, -0.02],
      [0.066, -0.06],
      [0.072, -0.085],
      [0.034, -0.085],
      [0.016, -0.048],
      [0.01, -0.046],
      [0.006, -0.06],
      [-0.006, -0.063],
      [-0.02, -0.058],
      [-0.026, -0.04],
      [-0.03, -0.037],
      [-0.044, -0.037],
      [-0.05, -0.03],
    ],
    holes: [
      [
        [-0.0455, -0.0355],
        [-0.0455, 0.0095],
        [-0.004, 0.0095],
        [-0.004, -0.0355],
      ],
      S([[-0.016, -0.039], [0.006, -0.039], [0.01, -0.047], [0.003, -0.058], [-0.007, -0.058], [-0.017, -0.05]], 3),
    ],
    width: 0.018,
    mat: P,
    bevel: 0.0012,
  });
  b.anchor('ejectionPort', 0, cy, -0.024);
  // Rear sight: groove along the top strap between two raised edges.
  for (const sx of [-1, 1]) b.span({ z0: 0.004, z1: 0.032, y0: 0.0155, y1: 0.0188, w: 0.0055, x: sx * 0.0042, mat: P, r: 0.0006 });
  b.anchor('rearSight', 0, 0.017, 0.026);
  // Round-butt walnut grips and lanyard ring.
  b.extrude({ points: S([[0.019, -0.042], [0.048, -0.028], [0.062, -0.056], [0.079, -0.094], [0.076, -0.11], [0.056, -0.115], [0.04, -0.103], [0.023, -0.07]]), width: 0.034, mat: 'walnut', bevel: 0.006 });
  swivel(b, { y: -0.1185, z: 0.063, r: 0.0055, t: 0.0014, w: 0.002 });
  // Cylinder latch (left), trigger.
  b.box({ x: -0.0105, y: -0.004, z: 0.006, w: 0.004, h: 0.007, d: 0.014, mat: P, r: 0.001 });
  trigger(b, { z: 0, yTop: -0.037, len: 0.02, curve: 0.006, w: 0.006, mat: P });
  // Fluted cylinder with six loaded chambers.
  b.part('cylinder', [0, cy, -0.0245]);
  const flower = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * PI * 2;
    // Flutes centered between chambers (chambers at 90 deg + k*60 deg).
    const d = Math.abs(((((a - PI / 2 - PI / 6) % (PI / 3)) + PI / 3) % (PI / 3)) - PI / 6);
    const r = 0.0218 - (d < 0.2 ? 0.003 * Math.cos((d / 0.2) * (PI / 2)) : 0);
    flower.push([Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  plateXY(b, { outline: flower, z: -0.0245, thick: 0.03, mat: P, bevel: 0.0006 });
  b.cyl({ z0: -0.044, z1: -0.0395, r0: 0.0214, y: cy, mat: P, seg: 30 });
  b.cyl({ z0: -0.0095, z1: -0.0045, r0: 0.0218, y: cy, mat: P, seg: 30 });
  for (let k = 0; k < 6; k++) {
    const a = PI / 2 + (k * PI) / 3;
    b.cyl({ z0: -0.0446, z1: -0.0436, r0: 0.0055, x: Math.cos(a) * 0.0135, y: cy + Math.sin(a) * 0.0135, mat: 'brass', seg: 12 });
  }
  b.body();
  // Hammer (at rest).
  b.part('hammer', [0, 0.004, 0.034]);
  b.extrude({ points: S([[0.028, 0.002], [0.035, 0.0115], [0.045, 0.015], [0.056, 0.0152], [0.057, 0.0105], [0.047, 0.0075], [0.041, -0.002], [0.031, -0.006]]), width: 0.0075, mat: P, bevel: 0.0008 });
  b.body();

  b.anchor('muzzle', 0, 0, -0.192);
  b.anchor('gripR', 0, -0.07, 0.05);
  b.anchor('trigger', 0, -0.047, 0.0);
  b.anchor('gripL', -0.024, -0.08, 0.047);
  b.meta.sight = 'notch';
  b.meta.cylinderRounds = 6;
}

// 2.36 in Rocket Launcher M1A1 "Bazooka": 1384 mm tube, wooden shoulder stock,
// front grip and trigger grip, frame front sight and peep rear sight on the
// left side, M6A1 rocket loaded from the rear.
export function bazooka_m1a1(b) {
  const O = 'olive';
  tube(b, { z0: -0.864, z1: 0.52, rIn: 0.0302, rOut: 0.032, mat: O, seg: 28 });
  tube(b, { z0: -0.864, z1: -0.84, rIn: 0.0302, rOut: 0.0355, mat: O, seg: 28 });
  tube(b, { z0: 0.495, z1: 0.52, rIn: 0.0302, rOut: 0.0352, mat: O, seg: 28 });
  for (const z of [-0.45, 0.4]) tube(b, { z0: z - 0.008, z1: z + 0.008, rIn: 0.031, rOut: 0.0345, mat: 'steel', seg: 28 });
  // Rocket latch on top at the rear.
  b.span({ z0: 0.44, z1: 0.505, y0: 0.03, y1: 0.037, w: 0.012, mat: 'steel', r: 0.0015 });
  // Sights on the left: front frame with range bars for 50 / 100 / 150 m, rear
  // peep on a bracket (the bars sit where the solved elevations put them).
  const SX = -0.058,
    SY = 0.07,
    bars = [0.0475, 0.0247, 0.0007];
  b.span({ z0: -0.56, z1: -0.54, y0: -0.012, y1: 0.0, w: 0.03, x: -0.038, mat: 'steel', r: 0.002 });
  plateXY(b, { outline: [[SX - 0.012, -0.008], [SX + 0.012, -0.008], [SX + 0.012, 0.056], [SX - 0.012, 0.056]], holes: [[[SX - 0.0095, -0.0055], [SX + 0.0095, -0.0055], [SX + 0.0095, 0.0535], [SX - 0.0095, 0.0535]]], z: -0.55, thick: 0.002, mat: 'steel' });
  for (const y of bars) b.span({ z0: -0.551, z1: -0.549, y0: y - 0.0009, y1: y, w: 0.019, x: SX, mat: 'steel', r: 0.0002 });
  b.anchor('frontSight', SX, bars[1], -0.55);
  b.meta.sightRanges = { 50: bars[0], 100: bars[1], 150: bars[2] };
  b.span({ z0: 0.035, z1: 0.065, y0: 0.0, y1: 0.012, w: 0.03, x: -0.038, mat: 'steel', r: 0.002 });
  b.span({ z0: 0.044, z1: 0.056, y0: 0.008, y1: SY - 0.005, w: 0.006, x: SX - 0.006, mat: 'steel', r: 0.001 });
  plateXY(b, { outline: [[SX - 0.006, SY - 0.008], [SX + 0.006, SY - 0.008], [SX + 0.006, SY + 0.006], [SX - 0.006, SY + 0.006]], holes: [circle(SX, SY, 0.0018, 14)], z: 0.05, thick: 0.0025, mat: 'steel' });
  b.anchor('rearSight', SX, SY, 0.05);
  // Front grip.
  b.extrude({ points: S([[-0.34, -0.028], [-0.31, -0.028], [-0.306, -0.07], [-0.302, -0.12], [-0.316, -0.13], [-0.334, -0.124], [-0.338, -0.07]]), width: 0.032, mat: 'walnut', bevel: 0.007 });
  b.span({ z0: -0.346, z1: -0.3, y0: -0.036, y1: -0.026, w: 0.03, mat: 'steel', r: 0.002 });
  // Trigger grip with guard and trigger.
  b.span({ z0: -0.05, z1: 0.06, y0: -0.04, y1: -0.028, w: 0.026, mat: 'steel', r: 0.002 });
  b.extrude({ points: S([[0.012, -0.038], [0.052, -0.038], [0.064, -0.07], [0.082, -0.125], [0.074, -0.137], [0.05, -0.134], [0.038, -0.098], [0.022, -0.06]]), width: 0.03, mat: 'walnut', bevel: 0.0065 });
  guard(b, { zf: -0.036, zr: 0.022, yTop: -0.038, yBot: -0.066, t: 0.004, w: 0.01, mat: 'steel', rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.039, len: 0.018, curve: 0.005, mat: 'steel' });
  // Wooden shoulder stock around the tube.
  loft(b, { points: path([[0.07, 0.004, 1], [0.34, 0.004, 1], [0.345, -0.03], [0.33, -0.07], [0.27, -0.082], [0.16, -0.066], [0.08, -0.05], [0.07, -0.04, 1]]), width: 0.074, mat: 'walnut', r: 0.012, rTop: 0.004 });
  b.span({ z0: 0.2, z1: 0.3, y0: -0.035, y1: -0.02, w: 0.0752, mat: 'steel', r: 0.002 }); // battery cover
  // M6A1 rocket, loaded (tail and fins visible at the rear).
  b.part('rocket', [0, 0, 0.23]);
  lathe(b, { mat: 'olive', seg: 22, profile: [[0, -0.045], [0.012, -0.04], [0.024, -0.02], [0.0292, 0.01], [0.0292, 0.15], [0.02, 0.17], [0.0115, 0.18], [0, 0.18]] });
  b.cyl({ z0: 0.17, z1: 0.5, r0: 0.0105, mat: 'steel', seg: 14 });
  for (let k = 0; k < 4; k++) {
    const a = (k * PI) / 2 + PI / 4;
    place(b, { pos: [0, 0, 0], rot: [0, 0, a], order: 'XYZ' }, () => {
      b.span({ z0: 0.43, z1: 0.5, y0: 0.009, y1: 0.0285, w: 0.0012, mat: 'steel', r: 0.0003 });
    });
  }
  b.body();

  b.anchor('muzzle', 0, 0, -0.864);
  b.anchor('gripR', 0, -0.075, 0.05);
  b.anchor('trigger', 0, -0.048, 0.0);
  b.anchor('gripL', 0, -0.08, -0.32);
  b.anchor('shoulder', 0, -0.08, 0.27);
  b.meta.sight = 'post'; // range bars on the front frame, peep at the rear
  b.meta.rocketAxis = [0, 0, 1]; // loaded from the rear
}

// Fragmentation hand grenade Mk 2 "pineapple": cast iron body with 5 rows of 8
// segments, M10A3 / M204 fuze with spoon and pull ring. Upright: +Y = fuze end;
// origin at the body center.
export function mk2_grenade(b) {
  const a = 0.0255,
    c = 0.043;
  b.sphere({ r: 1, sx: a, sy: c, sz: a, seg: 20, mat: 'olive' });
  for (let row = 0; row < 5; row++) {
    const phi = ((row - 2) * PI) / 6.6;
    for (let k = 0; k < 8; k++) {
      const th = ((k + 0.5) * PI) / 4;
      const nx = Math.cos(phi) * Math.sin(th),
        ny = Math.sin(phi),
        nz = Math.cos(phi) * Math.cos(th);
      const w = ((2 * PI * a * Math.cos(phi)) / 8) * 0.8;
      const h = ((PI * c) / 6.6) * 0.78;
      place(b, { pos: [a * nx - nx * 0.0012, c * ny - ny * 0.0012, a * nz - nz * 0.0012], rot: [-phi * 0.85, th, 0], order: 'YXZ' }, () => {
        b.box({ w, h, d: 0.0055, r: 0.0018, mat: 'olive' });
      });
    }
  }
  // Fuze: neck, body, striker housing; spoon down the side; pin and ring.
  b.cylAxis({ axis: 'y', y: 0.043, len: 0.008, r: 0.011, mat: 'olive' });
  b.cylAxis({ axis: 'y', y: 0.053, len: 0.014, r: 0.0085, mat: 'steel' });
  b.cylAxis({ axis: 'y', y: 0.0625, len: 0.006, r: 0.0065, mat: 'steel' });
  place(b, { pos: [0, 0.004, 0], rot: [0, PI / 2, 0] }, () => {
    b.extrude({ points: [[-0.003, 0.0625], [0.01, 0.0605], [0.02, 0.05], [0.028, 0.032], [0.031, 0.01], [0.031, -0.008], [0.0285, -0.008], [0.0285, 0.01], [0.0255, 0.031], [0.018, 0.048], [0.009, 0.0585], [-0.003, 0.06]], width: 0.011, mat: 'olive', bevel: 0.0004 });
  });
  b.cylAxis({ axis: 'z', x: -0.004, y: 0.056, z: 0.0, len: 0.024, r: 0.0011, mat: 'steelBright' });
  place(b, { pos: [-0.004, 0.056, -0.02], rot: [0, 0, 0] }, () => {
    b.extrude({ points: circle(0, 0, 0.011, 18), holes: [circle(0, 0, 0.0088, 18)], width: 0.0018, mat: 'steelBright', bevel: 0.0005 });
  });
  b.anchor('gripR', 0.012, 0.0, 0.0);
  b.anchor('gripL', -0.004, 0.056, -0.02); // pull ring
  b.anchor('pin', -0.004, 0.056, -0.02);
  b.anchor('spoon', 0.03, 0.024, 0.0);
  b.meta.kind = 'grenade';
  b.meta.fuse = 4.5; // s (M204 fuze 4-5 s)
}
