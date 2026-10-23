// German small arms. See kit.js for the coordinate conventions:
// meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at z = 0.
import { GunBuilder } from './kit.js';
import { place, circle, boxMag, guard, trigger, plateXY, lathe, tube, cartridge, swivel, taperZ, path, loft, arcTube } from './parts.js';

const S = GunBuilder.smooth;
const PI = Math.PI;

// Karabiner 98k: Mauser bolt action, 7.92x57, 5-round internal magazine loaded
// with stripper clips. 1110 mm long, 600 mm barrel, tangent rear sight (V notch)
// 100-2000 m, hooded barleycorn front sight, turned-down bolt handle.
export function kar98k(b) {
  // Barrel, stepped as on the real rifle.
  lathe(b, {
    mat: 'steel',
    profile: [
      [0, -0.79],
      [0.0072, -0.79],
      [0.0074, -0.7],
      [0.0082, -0.6],
      [0.0088, -0.52],
      [0.0096, -0.42],
      [0.0108, -0.34],
      [0.0122, -0.29],
      [0.0128, -0.262],
      [0, -0.262],
    ],
  });
  // Front sight base, barleycorn post and protective hood.
  b.cyl({ z0: -0.786, z1: -0.762, r0: 0.0102, mat: 'steel' });
  b.box({ x: 0, y: 0.0125, z: -0.775, w: 0.006, h: 0.008, d: 0.018, mat: 'steel', r: 0.001 });
  b.extrude({ points: [[-0.779, 0.0155], [-0.771, 0.0155], [-0.774, 0.0228], [-0.776, 0.0228]], width: 0.0018, mat: 'steel', bevel: 0.0002 });
  tube(b, { z0: -0.785, z1: -0.766, rIn: 0.0104, rOut: 0.0112, y: 0.0135, mat: 'steel', seg: 18 });
  b.anchor('frontSight', 0, 0.0226, -0.775);
  // Nose cap with bayonet lug, cleaning rod.
  b.span({ z0: -0.742, z1: -0.718, y0: -0.024, y1: 0.012, w: 0.03, mat: 'steel', r: 0.003 });
  b.span({ z0: -0.75, z1: -0.7, y0: -0.032, y1: -0.022, w: 0.011, mat: 'steel', r: 0.002 });
  b.cyl({ z0: -0.792, z1: -0.7, r0: 0.0032, y: -0.017, mat: 'steelBright' });
  b.sphere({ x: 0, y: -0.017, z: -0.792, r: 0.0042, mat: 'steelBright' });
  // Lower band with sling swivel.
  b.span({ z0: -0.535, z1: -0.522, y0: -0.034, y1: 0.018, w: 0.036, mat: 'steel', r: 0.004 });
  b.cylAxis({ axis: 'x', x: -0.02, y: -0.012, z: -0.528, len: 0.008, r: 0.006, mat: 'steel' });

  // Stock (walnut / laminate), one smooth outline with a tapered width.
  const stock = S(
    [
      [-0.722, 0.0],
      [-0.5, 0.002],
      [-0.27, 0.004],
      [-0.06, 0.005],
      [-0.015, 0.002],
      [0.035, -0.008],
      [0.1, -0.024],
      [0.2, -0.032],
      [0.318, -0.04],
      [0.322, -0.07],
      [0.32, -0.12],
      [0.314, -0.165],
      [0.22, -0.137],
      [0.13, -0.102],
      [0.082, -0.084],
      [0.06, -0.074],
      [0.05, -0.05],
      [-0.17, -0.047],
      [-0.22, -0.036],
      [-0.5, -0.03],
      [-0.7, -0.024],
      [-0.722, -0.017],
    ],
    3,
  );
  b.extrude({
    points: stock,
    width: 0.04,
    mat: 'walnut',
    bevel: 0.006,
    taper: (z, y) => {
      if (z < -0.3) return 0.78; // slim fore-end
      if (z < 0.0) return 0.92;
      if (z < 0.1) return 0.82 + (z / 0.1) * 0.0; // wrist
      return 0.82 + Math.min(1, (z - 0.1) / 0.12) * 0.18; // butt widens
    },
    holes: [
      [
        [0.205, -0.075],
        [0.215, -0.075],
        [0.215, -0.065],
        [0.205, -0.065],
      ],
    ],
  });
  // Handguard over the barrel.
  b.extrude({
    points: S([
      [-0.525, 0.006],
      [-0.335, 0.006],
      [-0.338, 0.016],
      [-0.43, 0.019],
      [-0.522, 0.017],
    ]),
    width: 0.026,
    mat: 'walnut',
    bevel: 0.006,
  });
  // Steel butt plate.
  b.extrude({
    points: [
      [0.318, -0.04],
      [0.328, -0.04],
      [0.322, -0.168],
      [0.312, -0.166],
    ],
    width: 0.04,
    mat: 'steel',
    bevel: 0.002,
  });

  // Receiver: front ring, body, rear bridge with stripper clip guide, tang.
  b.cyl({ z0: -0.262, z1: -0.215, r0: 0.0168, mat: 'steel', seg: 24 });
  b.span({ z0: -0.215, z1: -0.09, y0: -0.032, y1: -0.004, w: 0.028, mat: 'steel', r: 0.003 });
  b.span({ z0: -0.215, z1: -0.1, y0: -0.006, y1: 0.006, w: 0.03, x: 0, mat: 'steel', r: 0.002 });
  b.cyl({ z0: -0.105, z1: -0.072, r0: 0.0148, mat: 'steel', seg: 24 });
  b.span({ z0: -0.1, z1: -0.088, y0: 0.01, y1: 0.0175, w: 0.02, mat: 'steel', r: 0.001 });
  b.span({ z0: -0.072, z1: -0.01, y0: -0.008, y1: 0.0, w: 0.012, mat: 'steel', r: 0.002 });
  b.anchor('clipGuide', 0, 0.026, -0.094);
  b.anchor('ejectionPort', 0.012, 0.012, -0.16);
  // Floor plate and trigger guard.
  b.span({ z0: -0.165, z1: -0.04, y0: -0.054, y1: -0.046, w: 0.026, mat: 'steel', r: 0.002 });
  b.extrude({
    points: [
      [-0.04, -0.046],
      [0.058, -0.046],
      [0.062, -0.058],
      [0.05, -0.073],
      [0.0, -0.075],
      [-0.016, -0.069],
      [-0.024, -0.056],
    ],
    holes: [
      [
        [-0.009, -0.05],
        [0.052, -0.05],
        [0.054, -0.058],
        [0.045, -0.068],
        [0.0, -0.07],
        [-0.011, -0.065],
        [-0.015, -0.057],
      ],
    ],
    width: 0.012,
    mat: 'steel',
    bevel: 0.0015,
  });
  b.extrude({
    points: [
      [-0.002, -0.046],
      [0.005, -0.046],
      [0.012, -0.061],
      [0.009, -0.067],
      [0.004, -0.06],
    ],
    width: 0.005,
    mat: 'steel',
    bevel: 0.001,
  });

  // Rear sight: fixed base plus the tangent leaf (animated to set the range).
  b.span({ z0: -0.345, z1: -0.27, y0: 0.008, y1: 0.016, w: 0.024, mat: 'steel', r: 0.002 });
  b.part('rearSight', [0, 0.0175, -0.34]);
  b.span({ z0: -0.34, z1: -0.27, y0: 0.0155, y1: 0.0185, w: 0.02, mat: 'steel', r: 0.0008 });
  // Notch plate with a V notch (two blades leaving a gap at the top center).
  b.extrude({ points: [[-0.274, 0.0165], [-0.27, 0.0165], [-0.27, 0.0242], [-0.274, 0.0242]], width: 0.008, x: -0.0055, mat: 'steel', bevel: 0.0003 });
  b.extrude({ points: [[-0.274, 0.0165], [-0.27, 0.0165], [-0.27, 0.0242], [-0.274, 0.0242]], width: 0.008, x: 0.0055, mat: 'steel', bevel: 0.0003 });
  b.span({ z0: -0.274, z1: -0.27, y0: 0.0165, y1: 0.0215, w: 0.004, mat: 'steel', r: 0.0003 });
  b.anchor('rearSight', 0, 0.0218, -0.272);
  b.body();

  // Bolt: rotates (handle up) around the bore, then slides back.
  b.part('bolt', [0, 0, -0.06]);
  b.cyl({ z0: -0.215, z1: -0.04, r0: 0.0102, mat: 'steelBright', seg: 18 });
  b.cyl({ z0: -0.04, z1: 0.002, r0: 0.0118, r1: 0.0105, mat: 'steel', seg: 18 });
  b.box({ x: 0, y: 0.012, z: -0.012, w: 0.006, h: 0.012, d: 0.012, mat: 'steel', r: 0.001 }); // safety flag
  b.rod({ from: [0.008, 0.0, -0.066], to: [0.04, -0.022, -0.05], r: 0.0042, r1: 0.0036, mat: 'steelBright' });
  b.sphere({ x: 0.045, y: -0.028, z: -0.047, r: 0.0098, mat: 'steelBright' });
  b.anchor('boltHandle', 0.045, -0.028, -0.047);
  b.body();

  b.anchor('muzzle', 0, 0, -0.79);
  b.anchor('gripR', 0.0, -0.045, 0.075);
  b.anchor('trigger', 0.0, -0.058, 0.006);
  b.anchor('gripL', 0.0, -0.032, -0.4);
  b.anchor('shoulder', 0, -0.1, 0.322);
  b.meta.sight = 'notch';
  b.meta.sightKind = 'leaf';
  b.meta.boltThrow = 0.09; // how far the bolt slides back (m)
  b.meta.boltLift = Math.PI / 2; // handle rotation (rad)
}

// 7.92x57 cartridge.
const R792 = { caseLen: 0.0569, oal: 0.0805, rRim: 0.00595, rNeck: 0.0045, rBullet: 0.0041, shoulder: 0.8 };

// Karabiner 98k with the Zeiss ZF 39 4x scope on the high turret mount
// (Turmmontage): turret base on the receiver ring, lever-locked rear base on the
// bridge. The iron sights stay usable under the scope.
export function kar98k_zf39(b) {
  kar98k(b);
  const yc = 0.0525; // scope axis height over the bore
  // Front turret base on the receiver ring, rear base on the bridge with lever.
  b.cylAxis({ axis: 'y', x: 0, y: 0.0215, z: -0.236, len: 0.012, r: 0.0125, mat: 'steel', seg: 20 });
  b.span({ z0: -0.247, z1: -0.225, y0: 0.026, y1: yc - 0.011, w: 0.016, mat: 'steel', r: 0.002 });
  b.span({ z0: -0.104, z1: -0.072, y0: 0.0215, y1: 0.03, w: 0.022, mat: 'steel', r: 0.002 });
  b.span({ z0: -0.098, z1: -0.078, y0: 0.029, y1: yc - 0.011, w: 0.015, mat: 'steel', r: 0.002 });
  b.box({ x: -0.016, y: 0.028, z: -0.084, w: 0.004, h: 0.005, d: 0.03, mat: 'steel', r: 0.0012 }); // locking lever
  for (const z of [-0.236, -0.088]) tube(b, { y: yc, z0: z - 0.0085, z1: z + 0.0085, rIn: 0.0131, rOut: 0.0158, mat: 'steel', seg: 24 });
  // ZF 39 (Zielvier): 26 mm tube, objective and ocular bells, elevation drum.
  lathe(b, {
    mat: 'steel',
    y: yc,
    seg: 24,
    profile: [
      [0, 0.021],
      [0.0172, 0.021],
      [0.0182, 0.016],
      [0.0182, -0.006],
      [0.0135, -0.03],
      [0.013, -0.205],
      [0.0175, -0.226],
      [0.0198, -0.232],
      [0.0198, -0.245],
      [0, -0.245],
    ],
  });
  b.cylAxis({ axis: 'y', x: 0, y: yc + 0.017, z: -0.155, len: 0.012, r: 0.0118, mat: 'steel', seg: 20 });
  b.cylAxis({ axis: 'y', x: 0, y: yc + 0.0145, z: -0.155, len: 0.004, r: 0.0128, mat: 'steelBright', seg: 20 });
  b.cylAxis({ axis: 'z', x: 0, y: yc, z: 0.0212, len: 0.0006, r: 0.0165, mat: 'glass' });
  b.cylAxis({ axis: 'z', x: 0, y: yc, z: -0.2452, len: 0.0006, r: 0.0185, mat: 'glass' });
  b.anchor('scopeEye', 0, yc, 0.0213);
  b.anchor('scopeFront', 0, yc, -0.2453);
  b.meta.sight = 'scope';
  b.meta.scopeMag = 4;
}

// Gewehr 43: 7.92x57 gas-operated semi-automatic (gas piston above the barrel),
// 1130 mm long, 546 mm barrel, 10-round detachable magazine, hooded front sight,
// tangent rear sight, cocking handle on the left, scope rail on the right.
export function gewehr43(b) {
  const P = 'steel';
  lathe(b, {
    mat: P,
    profile: [
      [0, -0.262],
      [0.0135, -0.262],
      [0.0128, -0.32],
      [0.0112, -0.42],
      [0.0098, -0.55],
      [0.009, -0.68],
      [0.0085, -0.8],
      [0, -0.8],
    ],
  });
  // Gas block with the front sight base, post and hood; gas cylinder above.
  b.span({ z0: -0.792, z1: -0.756, y0: -0.007, y1: 0.031, w: 0.019, mat: P, r: 0.003 });
  b.extrude({ points: [[-0.778, 0.029], [-0.77, 0.029], [-0.7725, 0.0385], [-0.7755, 0.0385]], width: 0.0018, mat: P, bevel: 0.0002 });
  tube(b, { z0: -0.784, z1: -0.764, rIn: 0.0094, rOut: 0.0104, y: 0.034, mat: P, seg: 18 });
  b.cyl({ z0: -0.756, z1: -0.33, r0: 0.0088, y: 0.0185, mat: P, seg: 16 });
  b.anchor('frontSight', 0, 0.0385, -0.774);
  // Nose cap band, upper handguard over the gas cylinder.
  b.span({ z0: -0.612, z1: -0.592, y0: -0.03, y1: 0.031, w: 0.033, mat: P, r: 0.004 });
  swivel(b, { x: -0.019, y: -0.012, z: -0.602, r: 0.007, w: 0.003 });
  b.extrude({ points: S([[-0.594, 0.003], [-0.34, 0.003], [-0.343, 0.026], [-0.46, 0.0305], [-0.592, 0.029]]), width: 0.03, mat: 'walnut', bevel: 0.008 });
  // Stock with semi-pistol grip.
  const stock = path(
    [
      [-0.612, -0.004, 1],
      [-0.45, -0.004],
      [-0.3, -0.008],
      [-0.25, -0.014],
      [-0.05, -0.014],
      [-0.012, -0.008],
      [0.005, 0.0],
      [0.06, -0.004],
      [0.2, -0.022],
      [0.322, -0.04, 1],
      [0.318, -0.165, 1],
      [0.22, -0.135],
      [0.13, -0.1],
      [0.105, -0.099],
      [0.085, -0.105],
      [0.066, -0.098],
      [0.054, -0.078],
      [0.048, -0.058],
      [-0.08, -0.06],
      [-0.25, -0.058],
      [-0.29, -0.042],
      [-0.4, -0.036],
      [-0.61, -0.03, 1],
    ],
    3,
  );
  loft(b, { points: stock, width: 0.042, mat: 'walnut', r: 0.009, taper: taperZ([[-0.35, 0.78], [-0.26, 0.88], [0.0, 0.88], [0.07, 0.8], [0.13, 0.82], [0.26, 1.0]]) });
  b.extrude({ points: [[0.317, -0.039], [0.327, -0.039], [0.323, -0.166], [0.313, -0.166]], width: 0.042, mat: P, bevel: 0.002 });
  swivel(b, { x: -0.021, y: -0.12, z: 0.2, r: 0.008, w: 0.003 });
  // Rear sight: tangent base on the barrel, leaf hinged at the front.
  b.span({ z0: -0.345, z1: -0.27, y0: 0.012, y1: 0.0285, w: 0.024, mat: P, r: 0.0025 });
  b.part('rearSight', [0, 0.03, -0.34]);
  b.span({ z0: -0.34, z1: -0.272, y0: 0.0285, y1: 0.0315, w: 0.019, mat: P, r: 0.0008 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.276, 0.03], [-0.272, 0.03], [-0.272, 0.04], [-0.276, 0.04]], width: 0.0075, x: sx * 0.0052, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.276, z1: -0.272, y0: 0.03, y1: 0.0352, w: 0.003, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0385, -0.274);
  b.body();
  b.meta.sightKind = 'leaf';
  // Receiver with the bolt carrier on top, scope rail (right), ejection port.
  b.span({ z0: -0.272, z1: 0.016, y0: -0.032, y1: 0.012, w: 0.031, mat: P, r: 0.004 });
  b.span({ z0: -0.24, z1: -0.12, y0: -0.006, y1: 0.012, w: 0.006, x: 0.0175, mat: P, r: 0.001 }); // scope rail
  b.span({ z0: -0.2, z1: -0.135, y0: 0.006, y1: 0.0128, w: 0.002, x: 0.0148, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.016, 0.01, -0.17);
  // Trigger guard and trigger, magazine catch.
  guard(b, { zf: -0.055, zr: 0.05, yTop: -0.056, yBot: -0.085, t: 0.0045, w: 0.011, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.058, len: 0.02, curve: 0.006, mat: P });
  b.span({ z0: -0.152, z1: -0.142, y0: -0.074, y1: -0.056, w: 0.008, mat: P, r: 0.0012 });
  // Bolt carrier with the cocking knob on the left.
  b.part('bolt', [0, 0, -0.1]);
  b.span({ z0: -0.235, z1: -0.1, y0: 0.008, y1: 0.0205, w: 0.02, mat: 'steelBright', r: 0.003 });
  b.cylAxis({ axis: 'x', x: -0.021, y: 0.011, z: -0.205, len: 0.014, r: 0.0042, mat: P });
  b.sphere({ x: -0.029, y: 0.011, z: -0.205, r: 0.0068, mat: P });
  b.anchor('chargingHandle', -0.034, 0.011, -0.205);
  b.body();
  // 10-round magazine.
  const top = [-0.21, -0.022];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.088, depth: 0.088, width: 0.027, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.8);
  b.anchor('gripR', 0, -0.075, 0.078);
  b.anchor('trigger', 0, -0.068, 0.0);
  b.anchor('gripL', 0, -0.035, -0.42);
  b.anchor('shoulder', 0, -0.1, 0.327);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.09;
}

// MP 40: 9 mm open-bolt SMG, 833 mm (stock unfolded) / 630 mm folded, 251 mm
// barrel with the resting bar underneath, tubular receiver, bakelite lower frame
// and grip, folding steel stock, hooded front post, flip rear sight (100/200 m),
// 32-round magazine, cocking handle on the left.
export function mp40(b) {
  const P = 'steel';
  const R = 0.0195;
  // Barrel, barrel nut, resting bar.
  lathe(b, { mat: P, profile: [[0, -0.27], [0.0112, -0.27], [0.0108, -0.33], [0.0098, -0.44], [0.0096, -0.49], [0, -0.49]] });
  b.cyl({ z0: -0.29, z1: -0.268, r0: 0.0162, mat: P, seg: 18 });
  b.span({ z0: -0.385, z1: -0.27, y0: -0.024, y1: -0.011, w: 0.012, mat: P, r: 0.002 });
  b.extrude({ points: [[-0.392, -0.012], [-0.38, -0.012], [-0.38, -0.034], [-0.392, -0.03]], width: 0.012, mat: P, bevel: 0.0015 });
  // Front sight: base, post and hood at the muzzle.
  b.span({ z0: -0.488, z1: -0.466, y0: 0.004, y1: 0.0205, w: 0.012, mat: P, r: 0.0015 });
  b.extrude({ points: [[-0.48, 0.02], [-0.473, 0.02], [-0.4745, 0.0305], [-0.4785, 0.0305]], width: 0.002, mat: P, bevel: 0.0003 });
  tube(b, { z0: -0.487, z1: -0.467, rIn: 0.0098, rOut: 0.0108, y: 0.023, mat: P, seg: 18 });
  b.anchor('frontSight', 0, 0.0305, -0.4765);
  // Receiver tube with end cap; ejection port on the right.
  b.cyl({ z0: -0.27, z1: 0.135, r0: R, mat: P, seg: 26 });
  lathe(b, { mat: P, profile: [[0, 0.133], [R, 0.133], [R - 0.001, 0.142], [0.012, 0.146], [0, 0.146]] });
  b.span({ z0: -0.255, z1: -0.205, y0: -0.004, y1: 0.012, w: 0.002, x: 0.0185, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.02, 0.004, -0.23);
  // Cocking slot along the left side (handle at its front end when closed).
  b.span({ z0: -0.215, z1: 0.07, y0: 0.0, y1: 0.006, w: 0.002, x: -0.0185, mat: 'black', r: 0.0005 });
  b.span({ z0: 0.07, z1: 0.082, y0: 0.0, y1: 0.012, w: 0.002, x: -0.0185, mat: 'black', r: 0.0005 }); // safety notch
  // Rear sight: base with protective ears; flip leaf (100 m standing, raised for 200 m).
  b.span({ z0: -0.07, z1: -0.032, y0: 0.017, y1: 0.0245, w: 0.022, mat: P, r: 0.002 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.065, 0.022], [-0.035, 0.022], [-0.038, 0.032], [-0.06, 0.031]], width: 0.0022, x: sx * 0.0098, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.025, -0.064]);
  b.span({ z0: -0.064, z1: -0.04, y0: 0.0235, y1: 0.0262, w: 0.014, mat: P, r: 0.0006 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.044, 0.025], [-0.04, 0.025], [-0.04, 0.0335], [-0.044, 0.0335]], width: 0.0058, x: sx * 0.0043, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.044, z1: -0.04, y0: 0.025, y1: 0.0302, w: 0.0028, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0305, -0.042);
  b.body();
  b.meta.sightKind = 'leaf';
  // Magazine housing (with release button on the left).
  b.span({ z0: -0.25, z1: -0.194, y0: -0.088, y1: -0.012, w: 0.03, mat: P, r: 0.003 });
  b.span({ z0: -0.25, z1: -0.194, y0: -0.092, y1: -0.084, w: 0.032, mat: P, r: 0.002 });
  b.cylAxis({ axis: 'x', x: -0.016, y: -0.03, z: -0.222, len: 0.006, r: 0.004, mat: P });
  // Bakelite lower frame with trigger guard and pistol grip.
  b.extrude({
    points: S([
      [-0.13, -0.011],
      [0.14, -0.011],
      [0.142, -0.03],
      [0.11, -0.033],
      [0.085, -0.04],
      [0.06, -0.044],
      [-0.05, -0.044],
      [-0.12, -0.032],
    ]),
    width: 0.026,
    mat: 'bakelite',
    bevel: 0.0045,
  });
  b.extrude({
    points: S([
      [0.025, -0.04],
      [0.075, -0.04],
      [0.088, -0.065],
      [0.112, -0.13],
      [0.104, -0.144],
      [0.08, -0.142],
      [0.066, -0.104],
      [0.046, -0.064],
    ]),
    width: 0.032,
    mat: 'bakelite',
    bevel: 0.007,
  });
  guard(b, { zf: -0.036, zr: 0.03, yTop: -0.042, yBot: -0.071, t: 0.004, w: 0.011, mat: P, rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.043, len: 0.019, curve: 0.005, mat: P });
  // Folding stock (unfolded): hinge under the receiver end, two arms, butt plate.
  b.cylAxis({ axis: 'x', x: 0, y: -0.032, z: 0.128, len: 0.04, r: 0.0055, mat: P });
  b.part('stock', [0, -0.032, 0.128]);
  for (const sx of [-1, 1]) b.rod({ from: [sx * 0.0175, -0.032, 0.128], to: [sx * 0.0175, -0.044, 0.334], r: 0.0045, mat: P });
  b.rod({ from: [-0.0175, -0.044, 0.3], to: [0.0175, -0.044, 0.3], r: 0.003, mat: P });
  b.extrude({ points: S([[0.328, -0.022], [0.338, -0.024], [0.343, -0.06], [0.338, -0.118], [0.326, -0.122], [0.33, -0.06]]), width: 0.042, mat: P, bevel: 0.003 });
  b.body();
  b.meta.stockFold = { axis: 'x', angle: -2.95 }; // folds down and forward under the gun
  // Cocking handle (bolt forward).
  b.part('bolt', [0, 0, -0.2]);
  b.cylAxis({ axis: 'x', x: -0.024, y: 0.003, z: -0.205, len: 0.012, r: 0.0032, mat: P });
  b.sphere({ x: -0.032, y: 0.003, z: -0.205, r: 0.0062, mat: P, sx: 0.8 });
  b.anchor('chargingHandle', -0.036, 0.003, -0.205);
  b.body();
  // 32-round magazine.
  const top = [-0.222, -0.012];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.248, depth: 0.0345, width: 0.0225, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  b.anchor('muzzle', 0, 0, -0.49);
  b.anchor('gripR', 0, -0.08, 0.075);
  b.anchor('trigger', 0, -0.054, 0.0);
  b.anchor('gripL', 0, -0.06, -0.222);
  b.anchor('shoulder', 0, -0.07, 0.343);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// MP 34 (Steyr-Solothurn S1-100): 9 mm SMG with a wooden rifle-type stock,
// perforated barrel jacket, tangent rear sight, 32-round magazine inserted from
// the LEFT (with a stripper-clip loading guide), cocking handle on the right.
export function mp34(b) {
  const P = 'steel';
  // Barrel inside a perforated jacket with front cap and front sight.
  b.cyl({ z0: -0.512, z1: -0.205, r0: 0.0092, mat: P, seg: 14 });
  b.cyl({ z0: -0.505, z1: -0.215, r0: 0.0168, mat: 'perforated', open: true, seg: 22 });
  lathe(b, { mat: P, profile: [[0.0062, -0.52], [0.012, -0.52], [0.0178, -0.512], [0.0178, -0.5], [0.0062, -0.5]] });
  tube(b, { z0: -0.225, z1: -0.205, rIn: 0.009, rOut: 0.0182, mat: P });
  b.span({ z0: -0.518, z1: -0.502, y0: 0.012, y1: 0.022, w: 0.01, mat: P, r: 0.0015 });
  b.extrude({ points: [[-0.514, 0.02], [-0.506, 0.02], [-0.5075, 0.0315], [-0.5125, 0.0315]], width: 0.0022, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0315, -0.51);
  // Receiver body with hinged top cover.
  b.span({ z0: -0.21, z1: 0.05, y0: -0.022, y1: 0.017, w: 0.032, mat: P, r: 0.004 });
  b.span({ z0: -0.12, z1: 0.045, y0: 0.012, y1: 0.021, w: 0.028, mat: P, r: 0.003 });
  b.span({ z0: -0.105, z1: -0.055, y0: -0.004, y1: 0.01, w: 0.002, x: 0.016, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.017, 0.003, -0.08);
  // Tangent rear sight on the receiver front.
  b.span({ z0: -0.205, z1: -0.15, y0: 0.014, y1: 0.0225, w: 0.022, mat: P, r: 0.002 });
  b.part('rearSight', [0, 0.023, -0.2]);
  b.span({ z0: -0.2, z1: -0.152, y0: 0.0215, y1: 0.0245, w: 0.016, mat: P, r: 0.0007 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.156, 0.023], [-0.152, 0.023], [-0.152, 0.033], [-0.156, 0.033]], width: 0.006, x: sx * 0.0045, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.156, z1: -0.152, y0: 0.023, y1: 0.028, w: 0.003, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0315, -0.154);
  b.body();
  b.meta.sightKind = 'leaf';
  // Magazine housing on the left with the stripper-clip loading guide.
  b.span({ z0: -0.172, z1: -0.118, y0: -0.019, y1: 0.016, w: 0.03, x: -0.028, mat: P, r: 0.003 });
  b.span({ z0: -0.165, z1: -0.125, y0: 0.016, y1: 0.022, w: 0.02, x: -0.03, mat: P, r: 0.0015 });
  // Wooden stock: fore-end under the receiver, semi-pistol grip, butt.
  const stock = path(
    [
      [-0.235, -0.012, 1],
      [-0.12, -0.012],
      [0.05, -0.012],
      [0.07, 0.006],
      [0.12, 0.002],
      [0.25, -0.018],
      [0.33, -0.03, 1],
      [0.326, -0.15, 1],
      [0.23, -0.12],
      [0.13, -0.09],
      [0.11, -0.089],
      [0.088, -0.094],
      [0.07, -0.088],
      [0.056, -0.07],
      [0.05, -0.048],
      [-0.04, -0.048],
      [-0.2, -0.045],
      [-0.235, -0.038, 1],
    ],
    3,
  );
  loft(b, { points: stock, width: 0.04, mat: 'walnut', r: 0.009, taper: taperZ([[-0.1, 0.92], [0.0, 0.92], [0.08, 0.8], [0.13, 0.84], [0.27, 1.0]]) });
  b.extrude({ points: [[0.325, -0.0295], [0.334, -0.0295], [0.33, -0.151], [0.321, -0.151]], width: 0.04, mat: P, bevel: 0.002 });
  swivel(b, { x: -0.021, y: -0.11, z: 0.2, r: 0.008, w: 0.003 });
  guard(b, { zf: -0.045, zr: 0.048, yTop: -0.046, yBot: -0.075, t: 0.0045, w: 0.011, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.047, len: 0.02, curve: 0.006, mat: P });
  b.box({ x: -0.0205, y: -0.03, z: -0.03, w: 0.003, h: 0.007, d: 0.016, mat: P, r: 0.001 }); // fire selector
  // Cocking handle on the right (bolt forward).
  b.part('bolt', [0, 0, -0.06]);
  b.span({ z0: -0.07, z1: -0.05, y0: -0.004, y1: 0.004, w: 0.004, x: 0.0175, mat: P, r: 0.001 });
  b.cylAxis({ axis: 'x', x: 0.024, y: 0.0, z: -0.06, len: 0.01, r: 0.0055, mat: P, seg: 16 });
  b.anchor('chargingHandle', 0.029, 0.0, -0.06);
  b.body();
  // 32-round magazine sticking out to the left (built hanging, turned left).
  b.part('mag', [-0.03, 0.0, -0.145]);
  place(b, { pos: [-0.03, 0, 0], rot: [0, 0, -PI / 2] }, () => {
    boxMag(b, { top: [-0.145, 0.0], len: 0.2, depth: 0.035, width: 0.0235, mat: P, plate: 0.006 });
  });
  b.body();
  b.anchor('magWell', -0.03, 0.0, -0.145);
  b.meta.magAxis = [-1, 0, 0];

  b.anchor('muzzle', 0, 0, -0.52);
  b.anchor('gripR', 0, -0.07, 0.08);
  b.anchor('trigger', 0, -0.058, 0.0);
  b.anchor('gripL', 0, -0.04, -0.17);
  b.anchor('shoulder', 0, -0.09, 0.334);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.09;
  b.meta.openBolt = true;
}

// StG 44 (MP 43/44): 7.92x33 Kurz assault rifle, 940 mm, 419 mm barrel, gas
// piston above the barrel, stamped receiver and trigger housing, wooden butt,
// hooded front sight on the gas block, tangent rear sight, 30-round curved mag.
export function stg44(b) {
  const P = 'steel';
  // Barrel with muzzle thread protector.
  lathe(b, { mat: P, profile: [[0, -0.2], [0.0118, -0.2], [0.011, -0.3], [0.0095, -0.45], [0.0088, -0.56], [0, -0.56]] });
  lathe(b, { mat: P, profile: [[0, -0.578], [0.0088, -0.578], [0.0102, -0.574], [0.0102, -0.558], [0, -0.558]] });
  // Gas block with the front sight base, post and hood.
  b.span({ z0: -0.548, z1: -0.515, y0: -0.011, y1: 0.031, w: 0.02, mat: P, r: 0.003 });
  b.span({ z0: -0.546, z1: -0.523, y0: 0.029, y1: 0.036, w: 0.012, mat: P, r: 0.0015 });
  b.extrude({ points: [[-0.539, 0.035], [-0.531, 0.035], [-0.5325, 0.0455], [-0.5375, 0.0455]], width: 0.002, mat: P, bevel: 0.0003 });
  tube(b, { z0: -0.545, z1: -0.525, rIn: 0.0092, rOut: 0.0102, y: 0.039, mat: P, seg: 18 });
  b.anchor('frontSight', 0, 0.0455, -0.535);
  swivel(b, { x: -0.012, y: 0.004, z: -0.53, r: 0.007, w: 0.003 });
  // Gas cylinder above the barrel.
  b.cyl({ z0: -0.518, z1: -0.205, r0: 0.0118, y: 0.0185, mat: P, seg: 18 });
  for (const z of [-0.5, -0.47, -0.44]) b.cylAxis({ axis: 'x', x: 0, y: 0.0185, z, len: 0.0238, r: 0.0022, mat: 'black', seg: 8 }); // vent holes
  // Rear sight: tangent base on the gas cylinder's rear, leaf hinged at the front.
  b.span({ z0: -0.23, z1: -0.168, y0: 0.022, y1: 0.0345, w: 0.024, mat: P, r: 0.0025 });
  b.part('rearSight', [0, 0.035, -0.226]);
  b.span({ z0: -0.226, z1: -0.17, y0: 0.0335, y1: 0.0365, w: 0.018, mat: P, r: 0.0007 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.174, 0.035], [-0.17, 0.035], [-0.17, 0.0455], [-0.174, 0.0455]], width: 0.0068, x: sx * 0.0048, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.174, z1: -0.17, y0: 0.035, y1: 0.0405, w: 0.0028, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0455, -0.172);
  b.body();
  b.meta.sightKind = 'leaf';
  // Stamped receiver (tall: bolt carrier and piston above the bolt).
  b.span({ z0: -0.205, z1: 0.098, y0: -0.02, y1: 0.03, w: 0.031, mat: P, r: 0.004 });
  b.span({ z0: -0.15, z1: -0.09, y0: -0.004, y1: 0.012, w: 0.002, x: 0.0158, mat: P, r: 0.0005 }); // dust cover
  b.anchor('ejectionPort', 0.017, 0.004, -0.12);
  // Trigger housing: magazine well, guard, grip with wooden panels.
  b.span({ z0: -0.13, z1: 0.07, y0: -0.034, y1: -0.018, w: 0.03, mat: P, r: 0.003 });
  b.span({ z0: -0.128, z1: -0.072, y0: -0.064, y1: -0.03, w: 0.034, mat: P, r: 0.003 });
  guard(b, { zf: -0.042, zr: 0.03, yTop: -0.032, yBot: -0.064, t: 0.004, w: 0.011, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.033, len: 0.019, curve: 0.005, mat: P });
  b.extrude({ points: S([[0.026, -0.03], [0.07, -0.03], [0.082, -0.06], [0.104, -0.122], [0.096, -0.136], [0.072, -0.134], [0.058, -0.1], [0.042, -0.06]]), width: 0.026, mat: P, bevel: 0.004 });
  b.extrude({ points: S([[0.04, -0.04], [0.072, -0.038], [0.096, -0.118], [0.09, -0.128], [0.074, -0.126], [0.052, -0.07]]), width: 0.031, mat: 'walnut', bevel: 0.006 });
  b.box({ x: -0.0165, y: -0.024, z: -0.02, w: 0.003, h: 0.008, d: 0.018, mat: P, r: 0.001 }); // safety
  // Wooden butt stock with steel cap at the receiver and butt plate.
  loft(b, {
    points: path([
      [0.098, 0.03, 1],
      [0.2, 0.022],
      [0.358, 0.006, 1],
      [0.358, -0.132, 1],
      [0.25, -0.1],
      [0.15, -0.062],
      [0.098, -0.034, 1],
    ]),
    width: 0.036,
    taper: taperZ([[0.1, 0.86], [0.3, 1.0]]),
    mat: 'walnut',
    r: 0.008,
  });
  b.span({ z0: 0.092, z1: 0.114, y0: -0.035, y1: 0.031, w: 0.034, mat: P, r: 0.003 });
  b.extrude({ points: [[0.357, 0.007], [0.364, 0.007], [0.364, -0.133], [0.357, -0.133]], width: 0.037, mat: P, bevel: 0.0018 });
  swivel(b, { x: -0.019, y: -0.09, z: 0.25, r: 0.008, w: 0.003 });
  // Cocking handle on the left (piston / bolt carrier forward).
  b.part('bolt', [0, 0.02, -0.175]);
  b.cylAxis({ axis: 'x', x: -0.021, y: 0.02, z: -0.175, len: 0.012, r: 0.0035, mat: P });
  b.sphere({ x: -0.029, y: 0.02, z: -0.175, r: 0.0058, mat: P });
  b.anchor('chargingHandle', -0.033, 0.02, -0.175);
  b.body();
  // 30-round curved magazine.
  const top = [-0.1, -0.022];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.245, depth: 0.05, width: 0.0262, angle: 0.06, k: 1.55, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.998, -0.06];

  b.anchor('muzzle', 0, 0, -0.578);
  b.anchor('gripR', 0, -0.075, 0.07);
  b.anchor('trigger', 0, -0.044, 0.0);
  b.anchor('gripL', 0, -0.075, -0.105);
  b.anchor('shoulder', 0, -0.06, 0.364);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.085;
}

// Belt drum (Gurttrommel 34, 50 rounds) hooked on the left of the feed tray:
// a can whose axis runs along the bore, belt stub entering the feed tray.
// (x, y, z) = drum center; built into the current part.
function beltDrum(b, { x, y, z, r = 0.066, len = 0.104, feedY = 0.03 }) {
  const G = 'germanGrey';
  b.cyl({ z0: z - len / 2, z1: z + len / 2, r0: r, x, y, mat: G, seg: 28 });
  for (const e of [-1, 1]) tube(b, { x, y, z0: z + e * (len / 2 - 0.004), z1: z + e * (len / 2 + 0.001), rIn: r - 0.012, rOut: r + 0.0015, mat: G, seg: 28 });
  b.cyl({ z0: z - len / 2 - 0.003, z1: z - len / 2 + 0.002, r0: 0.024, x, y, mat: 'steel', seg: 16 }); // lid catch
  // Carrying handle on top, mouth toward the feed tray.
  b.rod({ from: [x - 0.03, y + r, z - 0.03], to: [x - 0.03, y + r + 0.018, z - 0.03], r: 0.002, mat: 'steel' });
  b.rod({ from: [x - 0.03, y + r, z + 0.03], to: [x - 0.03, y + r + 0.018, z + 0.03], r: 0.002, mat: 'steel' });
  b.rod({ from: [x - 0.03, y + r + 0.018, z - 0.03], to: [x - 0.03, y + r + 0.018, z + 0.03], r: 0.0022, mat: 'steel' });
  b.span({ z0: z - 0.045, z1: z + 0.045, y0: feedY - 0.012, y1: feedY + 0.004, w: 0.03, x: x + r * 0.62, mat: G, r: 0.002 });
  // A few rounds of belt from the mouth into the feed tray.
  for (let i = 0; i < 4; i++) {
    const cx = x + r * 0.55 + 0.012 + i * 0.011;
    cartridge(b, { ...R792, x: cx, y: feedY + 0.002, zBase: z + 0.038, seg: 8 });
    b.span({ z0: z - 0.014, z1: z + 0.006, y0: feedY - 0.005, y1: feedY + 0.009, w: 0.009, x: cx, mat: 'steel', r: 0.001 });
  }
}

// MG 42: 7.92x57 belt-fed GPMG, 1220 mm, 533 mm barrel, stamped receiver,
// perforated jacket with the barrel-change opening on the right, recoil
// booster, bipod at the front, folding front post, tangent rear sight, feed
// cover hinged at the front, bakelite butt and grip, 50-round belt drum.
export function mg42(b) {
  const P = 'steel';
  // Barrel inside the jacket; jacket with the barrel-change opening (right).
  b.cyl({ z0: -0.74, z1: -0.2, r0: 0.0118, r1: 0.0135, mat: P, seg: 16 });
  b.cyl({ z0: -0.725, z1: -0.58, r0: 0.0265, mat: 'perforated', open: true, seg: 26 });
  arcTube(b, { z0: -0.58, z1: -0.205, r: 0.0265, gapCenter: -0.1, gap: 1.1 });
  for (const a of [-0.65, 0.45]) b.box({ x: Math.cos(a) * 0.0262, y: Math.sin(a) * 0.0262, z: -0.392, w: 0.003, h: 0.003, d: 0.375, mat: P, r: 0.0008 });
  tube(b, { z0: -0.212, z1: -0.198, rIn: 0.012, rOut: 0.0278, mat: P, seg: 26 });
  // Jacket front and recoil booster.
  tube(b, { z0: -0.74, z1: -0.72, rIn: 0.012, rOut: 0.0278, mat: P, seg: 26 });
  lathe(b, { mat: P, profile: [[0.0085, -0.86], [0.0125, -0.86], [0.0158, -0.85], [0.0175, -0.8], [0.0235, -0.775], [0.0235, -0.74], [0.0085, -0.74]] });
  // Folding front post on the jacket front.
  b.span({ z0: -0.734, z1: -0.718, y0: 0.024, y1: 0.034, w: 0.014, mat: P, r: 0.002 });
  b.extrude({ points: [[-0.73, 0.032], [-0.722, 0.032], [-0.724, 0.0675], [-0.728, 0.0675]], width: 0.0028, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.0675, -0.726);
  // Stamped receiver: tall feed section under the cover, lower rear section,
  // pressed side ribs, cocking slot on the right.
  b.extrude({ points: [[-0.205, -0.044], [-0.205, 0.033], [0.028, 0.033], [0.05, 0.025], [0.112, 0.025], [0.112, -0.044]], width: 0.05, mat: P, bevel: 0.0035 });
  for (const sx of [-1, 1]) {
    b.span({ z0: -0.195, z1: 0.105, y0: -0.032, y1: -0.027, w: 0.0016, x: sx * 0.0252, mat: P, r: 0.0006 });
    b.span({ z0: 0.03, z1: 0.105, y0: 0.008, y1: 0.013, w: 0.0016, x: sx * 0.0252, mat: P, r: 0.0006 });
  }
  b.span({ z0: -0.15, z1: -0.03, y0: -0.01, y1: -0.002, w: 0.002, x: 0.025, mat: 'black', r: 0.0006 });
  b.span({ z0: -0.12, z1: -0.04, y0: 0.026, y1: 0.034, w: 0.03, x: -0.035, mat: P, r: 0.002 }); // feed tray (left)
  b.anchor('ejectionPort', 0, -0.046, -0.08); // empties drop out underneath
  // Rear sight: raised base on the receiver front, long tangent leaf hinged at
  // its front end, notch plate at its rear end.
  b.extrude({ points: [[-0.222, 0.031], [-0.16, 0.031], [-0.164, 0.052], [-0.208, 0.06], [-0.222, 0.06]], width: 0.026, mat: P, bevel: 0.002 });
  b.part('rearSight', [0, 0.0615, -0.216]);
  b.span({ z0: -0.218, z1: -0.162, y0: 0.06, y1: 0.063, w: 0.016, mat: P, r: 0.0007 });
  b.span({ z0: -0.192, z1: -0.18, y0: 0.062, y1: 0.0655, w: 0.019, mat: P, r: 0.0007 }); // slider
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.166, 0.062], [-0.162, 0.062], [-0.162, 0.0705], [-0.166, 0.0705]], width: 0.006, x: sx * 0.0045, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.166, z1: -0.162, y0: 0.062, y1: 0.0655, w: 0.003, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0675, -0.164);
  b.body();
  b.meta.sightKind = 'leaf';
  // Feed cover, hinged at its front end behind the rear sight.
  b.part('cover', [0, 0.04, -0.162]);
  b.extrude({ points: S([[-0.165, 0.032], [-0.16, 0.048], [-0.12, 0.054], [-0.03, 0.054], [0.012, 0.05], [0.018, 0.032]], 4), width: 0.05, mat: P, bevel: 0.004 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.04, z: -0.162, len: 0.054, r: 0.004, mat: P });
  b.span({ z0: 0.005, z1: 0.02, y0: 0.044, y1: 0.054, w: 0.02, mat: P, r: 0.002 }); // cover latch
  b.body();
  b.anchor('coverHinge', 0, 0.04, -0.162);
  // Trigger housing, guard, bakelite pistol grip.
  b.span({ z0: -0.05, z1: 0.085, y0: -0.056, y1: -0.04, w: 0.032, mat: P, r: 0.003 });
  guard(b, { zf: -0.038, zr: 0.03, yTop: -0.052, yBot: -0.082, t: 0.0045, w: 0.012, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.053, len: 0.02, curve: 0.006, mat: P });
  b.extrude({ points: S([[0.026, -0.052], [0.076, -0.052], [0.09, -0.08], [0.112, -0.142], [0.104, -0.155], [0.08, -0.152], [0.066, -0.115], [0.046, -0.076]]), width: 0.032, mat: 'bakelite', bevel: 0.007 });
  // Bakelite butt stock.
  loft(b, {
    points: path([
      [0.11, 0.03, 1],
      [0.25, 0.024],
      [0.362, 0.018, 1],
      [0.362, -0.118, 1],
      [0.31, -0.108],
      [0.27, -0.078],
      [0.2, -0.07],
      [0.15, -0.062],
      [0.11, -0.044, 1],
    ]),
    width: 0.04,
    taper: taperZ([[0.12, 0.82], [0.32, 1.0]]),
    mat: 'bakelite',
    r: 0.008,
  });
  b.extrude({ points: [[0.358, 0.019], [0.366, 0.019], [0.366, -0.119], [0.358, -0.119]], width: 0.041, mat: P, bevel: 0.002 });
  // Bipod at the front of the jacket (deployed).
  b.part('bipod', [0, -0.024, -0.692]);
  tube(b, { z0: -0.702, z1: -0.682, rIn: 0.0265, rOut: 0.031, mat: P, seg: 24 });
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.012, -0.028, -0.692], to: [sx * 0.12, -0.31, -0.72], r: 0.0055, r1: 0.0048, mat: P });
    b.box({ x: sx * 0.122, y: -0.315, z: -0.72, w: 0.018, h: 0.006, d: 0.03, mat: P, r: 0.002 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2; // legs fold back along the jacket
  // Cocking handle on the right (forward).
  b.part('bolt', [0, 0, -0.11]);
  b.span({ z0: -0.122, z1: -0.098, y0: -0.012, y1: 0.0, w: 0.006, x: 0.028, mat: P, r: 0.0015 });
  b.cylAxis({ axis: 'x', x: 0.036, y: -0.006, z: -0.11, len: 0.012, r: 0.0055, mat: P });
  b.anchor('chargingHandle', 0.042, -0.006, -0.11);
  b.body();
  // 50-round belt drum on the left.
  b.part('mag', [-0.1, -0.034, -0.085]);
  beltDrum(b, { x: -0.1, y: -0.034, z: -0.085, feedY: 0.031 });
  b.body();
  b.anchor('magWell', -0.03, 0.031, -0.085);
  b.meta.magAxis = [-1, 0, 0];
  b.meta.belt = true;

  b.anchor('muzzle', 0, 0, -0.86);
  b.anchor('gripR', 0, -0.095, 0.082);
  b.anchor('trigger', 0, -0.064, 0.0);
  b.anchor('gripL', 0, -0.05, 0.25); // under the butt (bipod fire)
  b.anchor('shoulder', 0, -0.05, 0.366);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// MG 34: 7.92x57 GPMG, 1219 mm, 627 mm barrel, round receiver, round perforated
// jacket, conical muzzle device, bipod, saddle-shaped feed cover hinged at the
// front, double-crescent trigger (top semi, bottom auto), 50-round belt drum.
export function mg34(b) {
  const P = 'steel';
  b.cyl({ z0: -0.74, z1: -0.2, r0: 0.0112, r1: 0.013, mat: P, seg: 16 });
  b.cyl({ z0: -0.72, z1: -0.21, r0: 0.0245, mat: 'perforated', open: true, seg: 26 });
  tube(b, { z0: -0.732, z1: -0.712, rIn: 0.011, rOut: 0.0255, mat: P, seg: 26 });
  tube(b, { z0: -0.222, z1: -0.2, rIn: 0.012, rOut: 0.0258, mat: P, seg: 26 });
  lathe(b, { mat: P, profile: [[0.0075, -0.84], [0.0122, -0.84], [0.0158, -0.833], [0.0148, -0.81], [0.0175, -0.775], [0.021, -0.745], [0.021, -0.732], [0.0075, -0.732]] });
  // Folding front post.
  b.span({ z0: -0.73, z1: -0.714, y0: 0.022, y1: 0.031, w: 0.013, mat: P, r: 0.002 });
  b.extrude({ points: [[-0.726, 0.03], [-0.718, 0.03], [-0.72, 0.0615], [-0.724, 0.0615]], width: 0.0028, mat: P, bevel: 0.0004 });
  b.anchor('frontSight', 0, 0.0615, -0.722);
  // Round receiver with the trigger housing below; buffer cap at the rear.
  b.cyl({ z0: -0.21, z1: 0.09, r0: 0.0255, mat: P, seg: 28 });
  lathe(b, { mat: P, profile: [[0, 0.088], [0.0255, 0.088], [0.0235, 0.1], [0.016, 0.104], [0, 0.104]] });
  b.span({ z0: -0.12, z1: -0.04, y0: 0.022, y1: 0.03, w: 0.03, x: -0.034, mat: P, r: 0.002 }); // feed tray (left)
  b.anchor('ejectionPort', 0, -0.026, -0.08);
  // Tangent rear sight on a raised base at the receiver front: long leaf hinged
  // at its front end, notch plate at its rear end.
  b.extrude({ points: [[-0.224, 0.02], [-0.162, 0.02], [-0.166, 0.046], [-0.21, 0.054], [-0.224, 0.054]], width: 0.024, mat: P, bevel: 0.002 });
  b.part('rearSight', [0, 0.0555, -0.218]);
  b.span({ z0: -0.22, z1: -0.164, y0: 0.054, y1: 0.057, w: 0.015, mat: P, r: 0.0007 });
  b.span({ z0: -0.194, z1: -0.182, y0: 0.056, y1: 0.0595, w: 0.018, mat: P, r: 0.0007 }); // slider
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.168, 0.056], [-0.164, 0.056], [-0.164, 0.0645], [-0.168, 0.0645]], width: 0.006, x: sx * 0.0045, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.168, z1: -0.164, y0: 0.056, y1: 0.0595, w: 0.003, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0615, -0.166);
  b.body();
  b.meta.sightKind = 'leaf';
  // Saddle-shaped feed cover (hump over the feed arm, dip, raised latch end).
  b.part('cover', [0, 0.032, -0.163]);
  b.extrude({ points: S([[-0.166, 0.022], [-0.158, 0.042], [-0.128, 0.0545], [-0.095, 0.052], [-0.062, 0.043], [-0.03, 0.044], [-0.006, 0.05], [0.006, 0.042], [0.008, 0.022]], 4), width: 0.048, mat: P, bevel: 0.0045 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.032, z: -0.163, len: 0.052, r: 0.004, mat: P });
  b.cylAxis({ axis: 'x', x: 0, y: 0.046, z: 0.0, len: 0.03, r: 0.0035, mat: P }); // cover catch
  b.body();
  b.anchor('coverHinge', 0, 0.032, -0.163);
  // Trigger housing with the double-crescent trigger, pistol grip.
  b.span({ z0: -0.05, z1: 0.075, y0: -0.044, y1: -0.018, w: 0.03, mat: P, r: 0.003 });
  guard(b, { zf: -0.04, zr: 0.03, yTop: -0.04, yBot: -0.077, t: 0.0045, w: 0.012, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.041, len: 0.012, curve: 0.002, mat: P });
  trigger(b, { z: 0.002, yTop: -0.054, len: 0.013, curve: 0.004, mat: P });
  b.extrude({ points: S([[0.026, -0.04], [0.07, -0.04], [0.084, -0.066], [0.104, -0.128], [0.096, -0.141], [0.072, -0.138], [0.058, -0.1], [0.042, -0.064]]), width: 0.032, mat: 'bakelite', bevel: 0.007 });
  // Butt stock.
  loft(b, {
    points: path([
      [0.1, 0.02, 1],
      [0.25, 0.012],
      [0.37, 0.004, 1],
      [0.37, -0.118, 1],
      [0.3, -0.1],
      [0.2, -0.07],
      [0.13, -0.046],
      [0.1, -0.026, 1],
    ]),
    width: 0.04,
    taper: taperZ([[0.11, 0.78], [0.33, 1.0]]),
    mat: 'bakelite',
    r: 0.009,
  });
  b.extrude({ points: [[0.366, 0.005], [0.374, 0.005], [0.374, -0.119], [0.366, -0.119]], width: 0.041, mat: P, bevel: 0.002 });
  // Bipod near the front of the jacket.
  b.part('bipod', [0, -0.024, -0.69]);
  tube(b, { z0: -0.7, z1: -0.68, rIn: 0.0245, rOut: 0.029, mat: P, seg: 24 });
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.012, -0.027, -0.69], to: [sx * 0.115, -0.3, -0.71], r: 0.0055, r1: 0.0048, mat: P });
    b.box({ x: sx * 0.117, y: -0.305, z: -0.71, w: 0.016, h: 0.006, d: 0.028, mat: P, r: 0.002 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2;
  // Cocking handle on the right (forward).
  b.part('bolt', [0, 0, -0.11]);
  b.cylAxis({ axis: 'x', x: 0.031, y: 0.0, z: -0.11, len: 0.012, r: 0.003, mat: P });
  b.cylAxis({ axis: 'z', x: 0.038, y: 0.0, z: -0.11, len: 0.022, r: 0.004, mat: P });
  b.anchor('chargingHandle', 0.042, 0.0, -0.11);
  b.body();
  // 50-round belt drum on the left.
  b.part('mag', [-0.096, -0.036, -0.08]);
  beltDrum(b, { x: -0.096, y: -0.036, z: -0.08, feedY: 0.027 });
  b.body();
  b.anchor('magWell', -0.03, 0.027, -0.08);
  b.meta.magAxis = [-1, 0, 0];
  b.meta.belt = true;

  b.anchor('muzzle', 0, 0, -0.84);
  b.anchor('gripR', 0, -0.085, 0.074);
  b.anchor('trigger', 0, -0.05, 0.0);
  b.anchor('gripL', 0, -0.05, 0.25);
  b.anchor('shoulder', 0, -0.055, 0.374);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// FG 42 (first model): 7.92x57 paratrooper automatic rifle, 975 mm, 500 mm
// barrel, muzzle brake, folding front post and diopter rear sight high above
// the straight-line stock, sharply raked pistol grip, pressed-steel butt,
// bipod at the gas block, spike bayonet, 20-round magazine on the LEFT.
export function fg42(b) {
  const P = 'steel';
  lathe(b, { mat: P, profile: [[0, -0.2], [0.0118, -0.2], [0.011, -0.3], [0.0098, -0.45], [0.0092, -0.585], [0, -0.585]] });
  // Muzzle brake with slots.
  lathe(b, { mat: P, profile: [[0.006, -0.635], [0.0115, -0.635], [0.0128, -0.63], [0.0128, -0.59], [0.0105, -0.585], [0.006, -0.585]] });
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) b.box({ x: sx * 0.0122, y: 0, z: -0.627 + i * 0.0105, w: 0.002, h: 0.012, d: 0.005, mat: 'black', r: 0.0006 });
  // Folding front post on a tall base behind the brake.
  b.span({ z0: -0.582, z1: -0.566, y0: 0.006, y1: 0.03, w: 0.014, mat: P, r: 0.002 });
  b.extrude({ points: [[-0.578, 0.028], [-0.57, 0.028], [-0.5715, 0.0585], [-0.5765, 0.0585]], width: 0.0028, mat: P, bevel: 0.0004 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.58, 0.028], [-0.568, 0.028], [-0.57, 0.06], [-0.578, 0.06]], width: 0.0018, x: sx * 0.0058, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0585, -0.574);
  // Gas block and cylinder under the barrel, stowed spike bayonet.
  b.span({ z0: -0.472, z1: -0.452, y0: -0.032, y1: 0.012, w: 0.022, mat: P, r: 0.003 });
  b.cyl({ z0: -0.46, z1: -0.2, r0: 0.0092, y: -0.021, mat: P, seg: 14 });
  b.rod({ from: [0, -0.037, -0.46], to: [0, -0.037, -0.3], r: 0.003, r1: 0.0035, mat: 'steelBright' });
  // Stamped handguard with vent slots.
  b.span({ z0: -0.335, z1: -0.198, y0: -0.039, y1: 0.013, w: 0.036, mat: P, r: 0.005 });
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) b.box({ x: sx * 0.0181, y: -0.012, z: -0.31 + i * 0.04, w: 0.002, h: 0.022, d: 0.026, mat: 'black', r: 0.002 });
  // Receiver, magazine housing (left), ejection port (right).
  b.span({ z0: -0.2, z1: 0.13, y0: -0.032, y1: 0.024, w: 0.031, mat: P, r: 0.004 });
  b.span({ z0: -0.172, z1: -0.078, y0: -0.018, y1: 0.016, w: 0.026, x: -0.026, mat: P, r: 0.003 });
  b.span({ z0: -0.15, z1: -0.09, y0: -0.004, y1: 0.012, w: 0.002, x: 0.0158, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.017, 0.004, -0.12);
  // Diopter rear sight on a raised base with protective wings.
  b.span({ z0: 0.06, z1: 0.112, y0: 0.022, y1: 0.036, w: 0.02, mat: P, r: 0.002 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.07, 0.034], [0.108, 0.034], [0.108, 0.062], [0.096, 0.066], [0.084, 0.066]], width: 0.0025, x: sx * 0.0092, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0585, 0.09]);
  plateXY(b, { outline: [[-0.0065, 0.034], [0.0065, 0.034], [0.0065, 0.064], [-0.0065, 0.064]], holes: [circle(0, 0.0585, 0.0014, 14)], z: 0.09, thick: 0.003, mat: P });
  b.anchor('rearSight', 0, 0.0585, 0.09);
  b.body();
  b.meta.sightKind = 'slide';
  // Sharply raked pistol grip, trigger guard, trigger.
  b.span({ z0: -0.045, z1: 0.07, y0: -0.044, y1: -0.03, w: 0.026, mat: P, r: 0.003 });
  guard(b, { zf: -0.036, zr: 0.026, yTop: -0.042, yBot: -0.072, t: 0.0042, w: 0.011, mat: P, rake: 0.008 });
  trigger(b, { z: 0, yTop: -0.043, len: 0.019, curve: 0.006, mat: P });
  b.extrude({ points: S([[0.024, -0.042], [0.066, -0.042], [0.092, -0.07], [0.142, -0.118], [0.136, -0.13], [0.112, -0.128], [0.078, -0.096], [0.042, -0.064]]), width: 0.03, mat: 'bakelite', bevel: 0.007 });
  // Pressed-steel butt in line with the bore.
  loft(b, {
    points: path([
      [0.13, 0.022, 1],
      [0.336, 0.016, 1],
      [0.336, -0.112, 1],
      [0.25, -0.076],
      [0.13, -0.03, 1],
    ]),
    width: 0.03,
    taper: taperZ([[0.14, 0.75], [0.32, 1.0]]),
    mat: 'steel',
    r: 0.006,
  });
  b.extrude({ points: S([[0.334, 0.018], [0.342, 0.016], [0.344, -0.05], [0.342, -0.114], [0.334, -0.114]]), width: 0.034, mat: P, bevel: 0.002 });
  // Bipod at the gas block (deployed).
  b.part('bipod', [0, -0.03, -0.462]);
  for (const sx of [-1, 1]) {
    b.rod({ from: [sx * 0.008, -0.03, -0.462], to: [sx * 0.105, -0.27, -0.49], r: 0.0045, mat: P });
    b.box({ x: sx * 0.107, y: -0.274, z: -0.49, w: 0.014, h: 0.005, d: 0.024, mat: P, r: 0.0015 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2;
  // Cocking handle on the right (forward).
  b.part('bolt', [0, 0, -0.16]);
  b.cylAxis({ axis: 'x', x: 0.022, y: 0.002, z: -0.16, len: 0.014, r: 0.0035, mat: P });
  b.sphere({ x: 0.03, y: 0.002, z: -0.16, r: 0.006, mat: P });
  b.anchor('chargingHandle', 0.034, 0.002, -0.16);
  b.body();
  // 20-round magazine on the left (built hanging, turned to the left).
  b.part('mag', [-0.035, 0.0, -0.125]);
  place(b, { pos: [-0.035, 0, 0], rot: [0, 0, -PI / 2] }, () => {
    boxMag(b, { top: [-0.125, 0.0], len: 0.15, depth: 0.088, width: 0.0265, mat: P, plate: 0.006 });
  });
  b.body();
  b.anchor('magWell', -0.035, 0.0, -0.125);
  b.meta.magAxis = [-1, 0, 0];

  b.anchor('muzzle', 0, 0, -0.635);
  b.anchor('gripR', 0, -0.08, 0.1);
  b.anchor('trigger', 0, -0.052, 0.0);
  b.anchor('gripL', 0, -0.03, -0.27);
  b.anchor('shoulder', 0, -0.045, 0.344);
  b.meta.sight = 'aperture';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// Walther P38: 9 mm double-action pistol, 216 mm, 125 mm barrel exposed by the
// open-top slide, external hammer, bakelite grips, heel magazine catch.
export function p38(b) {
  const P = 'steel';
  // Barrel (exposed on top), stays with the frame.
  b.cyl({ z0: -0.123, z1: -0.01, r0: 0.0076, mat: P, seg: 16 });
  // Frame: rails, trigger guard, 20 deg grip.
  b.extrude({
    points: [
      [-0.098, -0.0085],
      [0.066, -0.0085],
      [0.08, -0.008],
      [0.083, -0.016],
      [0.078, -0.03],
      [0.09, -0.08],
      [0.098, -0.118],
      [0.095, -0.124],
      [0.048, -0.124],
      [0.045, -0.118],
      [0.022, -0.046],
      [0.012, -0.05],
      [-0.03, -0.05],
      [-0.045, -0.044],
      [-0.052, -0.03],
      [-0.06, -0.02],
      [-0.098, -0.019],
    ],
    holes: [S([[-0.04, -0.021], [0.012, -0.021], [0.017, -0.031], [0.012, -0.042], [-0.03, -0.043], [-0.04, -0.036]], 3)],
    width: 0.022,
    mat: P,
    bevel: 0.0012,
  });
  // Grooved bakelite grips, lanyard loop, heel magazine catch.
  b.extrude({ points: S([[0.025, -0.036], [0.077, -0.032], [0.085, -0.07], [0.094, -0.112], [0.056, -0.116], [0.047, -0.1], [0.029, -0.05]]), width: 0.029, mat: 'bakelite', bevel: 0.0025 });
  for (let i = 0; i < 6; i++) b.box({ x: 0, y: -0.048 - i * 0.011, z: 0.059 + i * 0.0038, w: 0.0296, h: 0.0012, d: 0.034, mat: 'black', r: 0.0003 });
  swivel(b, { x: -0.012, y: -0.118, z: 0.09, r: 0.004, t: 0.0012, w: 0.0018 });
  b.box({ x: 0, y: -0.122, z: 0.093, w: 0.006, h: 0.004, d: 0.008, mat: P, r: 0.001 });
  trigger(b, { z: 0, yTop: -0.022, len: 0.02, curve: 0.006, w: 0.006, mat: P });
  b.box({ x: -0.0118, y: -0.012, z: -0.03, w: 0.002, h: 0.005, d: 0.02, mat: P, r: 0.0008 }); // slide catch
  b.anchor('ejectionPort', 0.0, 0.012, -0.015);
  // Slide: closed rear part, open top over the barrel, nose with front sight.
  b.part('bolt', [0, 0, 0.07]);
  b.extrude({
    points: [
      [-0.114, -0.0085],
      [-0.114, 0.0085],
      [-0.1, 0.0095],
      [-0.096, 0.0035],
      [-0.03, 0.0035],
      [-0.026, 0.0118],
      [0.068, 0.0118],
      [0.071, 0.006],
      [0.07, -0.0085],
    ],
    width: 0.0235,
    mat: P,
    bevel: 0.0018,
  });
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) b.box({ x: sx * 0.0117, y: 0.0005, z: 0.036 + i * 0.0042, w: 0.0008, h: 0.012, d: 0.0012, mat: 'black', r: 0.0002 });
  b.extrude({ points: [[-0.111, 0.009], [-0.104, 0.009], [-0.105, 0.01423], [-0.11, 0.01423]], width: 0.0026, mat: P, bevel: 0.0004 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.056, 0.011], [0.063, 0.011], [0.063, 0.0168], [0.057, 0.0168]], width: 0.0042, x: sx * 0.0034, mat: P, bevel: 0.0004 });
  b.span({ z0: 0.056, z1: 0.063, y0: 0.011, y1: 0.0145, w: 0.0026, mat: P, r: 0.0003 });
  b.cylAxis({ axis: 'x', x: -0.0128, y: 0.0045, z: 0.05, len: 0.003, r: 0.0042, mat: P, seg: 12 }); // safety / decocker
  b.box({ x: -0.0135, y: 0.0045, z: 0.056, w: 0.002, h: 0.004, d: 0.012, mat: P, r: 0.0008 });
  b.body();
  b.anchor('frontSight', 0, 0.01423, -0.1075);
  b.anchor('rearSight', 0, 0.0145, 0.0595);
  // Hammer (down, double action).
  b.part('hammer', [0, -0.005, 0.071]);
  b.extrude({ points: S([[0.066, -0.012], [0.074, -0.011], [0.078, -0.002], [0.08, 0.008], [0.086, 0.011], [0.088, 0.006], [0.084, -0.006], [0.079, -0.016], [0.068, -0.017]]), width: 0.008, mat: P, bevel: 0.0008 });
  b.body();
  // Magazine.
  const top = [0.027, -0.012];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.116, depth: 0.031, width: 0.014, angle: -0.35, mat: P, plate: 0.0045, lip: 0.0012, rib: false });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.94, 0.343];

  b.anchor('muzzle', 0, 0, -0.123);
  b.anchor('gripR', 0, -0.07, 0.06);
  b.anchor('trigger', 0, -0.032, 0.0);
  b.anchor('gripL', -0.022, -0.085, 0.055);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.035;
}

// Luger P08: 9 mm toggle-locked pistol, 222 mm, 102 mm barrel, steeply raked
// grip (55 deg to the bore), rear sight on the toggle. The trigger sits under
// the barrel's breech end. The toggle assembly is the 'bolt' (it moves back and
// the knee rises on firing).
export function luger_p08(b) {
  const P = 'steel';
  // Barrel with front sight base and blade.
  lathe(b, { mat: P, profile: [[0, 0.004], [0.0098, 0.004], [0.0098, -0.006], [0.0086, -0.016], [0.0078, -0.05], [0.0072, -0.092], [0, -0.092]] });
  b.span({ z0: -0.0915, z1: -0.0815, y0: 0.004, y1: 0.0088, w: 0.006, mat: P, r: 0.001 });
  b.extrude({ points: [[-0.09, 0.008], [-0.083, 0.008], [-0.084, 0.01238], [-0.089, 0.01238]], width: 0.0024, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.01238, -0.0865);
  // Receiver (barrel extension) the toggle rides in.
  b.extrude({ points: [[-0.008, -0.012], [-0.008, 0.006], [-0.002, 0.0095], [0.098, 0.0095], [0.098, -0.012]], width: 0.021, mat: P, bevel: 0.0015 });
  // Frame: rails, trigger guard, raked grip, toggle ramps at the rear.
  b.extrude({
    points: [
      [-0.006, -0.012],
      [0.098, -0.012],
      [0.106, -0.006],
      [0.11, -0.014],
      [0.104, -0.024],
      [0.112, -0.042],
      [0.136, -0.088],
      [0.138, -0.098],
      [0.132, -0.103],
      [0.093, -0.103],
      [0.088, -0.097],
      [0.036, -0.03],
      [0.018, -0.045],
      [-0.012, -0.046],
      [-0.024, -0.038],
      [-0.026, -0.022],
      [-0.012, -0.016],
    ],
    holes: [S([[-0.019, -0.021], [0.016, -0.021], [0.021, -0.03], [0.013, -0.04], [-0.012, -0.041], [-0.02, -0.032]], 3)],
    width: 0.02,
    mat: P,
    bevel: 0.0012,
  });
  b.extrude({ points: S([[0.044, -0.03], [0.1, -0.026], [0.108, -0.044], [0.13, -0.088], [0.126, -0.097], [0.096, -0.098], [0.066, -0.06]]), width: 0.0265, mat: 'walnut', bevel: 0.0022 });
  b.box({ x: -0.0108, y: -0.018, z: 0.03, w: 0.0015, h: 0.012, d: 0.05, mat: P, r: 0.0006 }); // side plate
  b.box({ x: -0.011, y: -0.022, z: 0.1, w: 0.002, h: 0.012, d: 0.006, mat: P, r: 0.0008 }); // safety lever
  b.cylAxis({ axis: 'x', x: -0.0105, y: -0.026, z: 0.034, len: 0.003, r: 0.003, mat: P }); // magazine release
  trigger(b, { z: 0, yTop: -0.023, len: 0.016, curve: 0.005, w: 0.0055, mat: P });
  b.anchor('ejectionPort', 0, 0.012, 0.03);
  // Toggle: breechblock, front link, rear link with grip knobs and rear sight.
  b.part('bolt', [0, 0, 0.098]);
  b.span({ z0: 0.008, z1: 0.044, y0: -0.004, y1: 0.0098, w: 0.016, mat: 'steelBright', r: 0.002 });
  b.span({ z0: 0.042, z1: 0.07, y0: -0.003, y1: 0.0102, w: 0.0165, mat: 'steelBright', r: 0.002 });
  b.span({ z0: 0.068, z1: 0.098, y0: -0.004, y1: 0.0102, w: 0.0165, mat: 'steelBright', r: 0.002 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.0045, z: 0.069, len: 0.018, r: 0.0042, mat: 'steelBright' });
  for (const sx of [-1, 1]) b.cylAxis({ axis: 'x', x: sx * 0.0125, y: 0.0045, z: 0.07, len: 0.008, r: 0.0078, mat: 'steelBright', seg: 18 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.084, 0.01], [0.09, 0.01], [0.09, 0.0145], [0.0845, 0.0145]], width: 0.004, x: sx * 0.0032, mat: 'steelBright', bevel: 0.0003 });
  b.span({ z0: 0.084, z1: 0.09, y0: 0.01, y1: 0.0128, w: 0.0024, mat: 'steelBright', r: 0.0003 });
  b.body();
  b.anchor('rearSight', 0, 0.0128, 0.087);
  // Magazine with the wooden bottom knob.
  const top = [0.054, -0.014];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.106, depth: 0.03, width: 0.0135, angle: -0.61, mat: P, plate: 0.0, rib: false });
  place(b, { pos: [0.0, -0.1, 0.115], rot: [-0.61, 0, 0] }, () => {
    b.span({ z0: -0.016, z1: 0.016, y0: -0.007, y1: 0.0, w: 0.014, mat: 'walnut', r: 0.003 });
  });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.819, 0.574];

  b.anchor('muzzle', 0, 0, -0.092);
  b.anchor('gripR', 0, -0.06, 0.09);
  b.anchor('trigger', 0, -0.031, 0.0);
  b.anchor('gripL', -0.021, -0.075, 0.095);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.012;
  b.meta.boltKind = 'toggle'; // knee joint rises as it moves back
}

// Mauser C96 "Broomhandle": 7.63 mm, 288 mm, 140 mm barrel, fixed 10-round box
// magazine in front of the trigger guard (loaded with stripper clips through the
// open action), tangent rear sight 50-500 m, ring hammer, grooved round grip.
export function c96(b) {
  const P = 'steel';
  lathe(b, { mat: P, profile: [[0, -0.092], [0.0098, -0.092], [0.009, -0.11], [0.0078, -0.16], [0.0074, -0.225], [0, -0.225]] });
  // Front sight blade on a base near the muzzle.
  b.span({ z0: -0.224, z1: -0.208, y0: 0.004, y1: 0.0115, w: 0.006, mat: P, r: 0.001 });
  b.extrude({ points: [[-0.221, 0.011], [-0.212, 0.011], [-0.2135, 0.0205], [-0.2195, 0.0205]], width: 0.0022, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0205, -0.2165);
  // Receiver / barrel extension block.
  b.extrude({ points: [[-0.118, -0.009], [-0.118, 0.0075], [-0.11, 0.0125], [0.052, 0.0125], [0.056, 0.006], [0.056, -0.013], [-0.092, -0.013], [-0.11, -0.009]], width: 0.022, mat: P, bevel: 0.0015 });
  b.anchor('clipGuide', 0, 0.016, -0.066);
  b.anchor('ejectionPort', 0, 0.016, -0.066);
  // Tangent rear sight on the barrel extension, leaf hinged at the front.
  b.span({ z0: -0.118, z1: -0.092, y0: 0.0105, y1: 0.0165, w: 0.016, mat: P, r: 0.0015 });
  b.part('rearSight', [0, 0.017, -0.116]);
  b.span({ z0: -0.117, z1: -0.093, y0: 0.0158, y1: 0.0182, w: 0.012, mat: P, r: 0.0006 });
  for (const sx of [-1, 1]) b.extrude({ points: [[-0.0965, 0.017], [-0.0935, 0.017], [-0.0935, 0.0228], [-0.0965, 0.0228]], width: 0.0042, x: sx * 0.0031, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.0965, z1: -0.0935, y0: 0.017, y1: 0.0205, w: 0.0022, mat: P, r: 0.0003 });
  b.anchor('rearSight', 0, 0.0205, -0.095);
  b.body();
  b.meta.sightKind = 'leaf';
  // Frame: fixed magazine box in front of the guard, trigger guard, grip frame.
  b.extrude({
    points: [
      [-0.094, -0.013],
      [0.06, -0.013],
      [0.062, -0.026],
      [0.05, -0.034],
      [0.014, -0.034],
      [0.008, -0.046],
      [-0.006, -0.05],
      [-0.03, -0.048],
      [-0.04, -0.042],
      [-0.052, -0.042],
      [-0.052, -0.06],
      [-0.094, -0.06],
    ],
    holes: [S([[-0.034, -0.017], [0.002, -0.017], [0.006, -0.026], [-0.002, -0.042], [-0.018, -0.043], [-0.034, -0.034]], 3)],
    width: 0.024,
    mat: P,
    bevel: 0.0015,
  });
  b.span({ z0: -0.096, z1: -0.05, y0: -0.064, y1: -0.058, w: 0.026, mat: P, r: 0.0015 }); // floor plate
  trigger(b, { z: 0, yTop: -0.018, len: 0.02, curve: 0.006, w: 0.0055, mat: P });
  // Broomhandle grip: round, grooved, raked back.
  const gripLen = 0.096;
  place(b, { pos: [0, -0.03, 0.036], rot: [-PI / 2 - 0.3, 0, 0] }, () => {
    const prof = [[0, 0]];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const base = 0.0158 - 0.0012 * Math.cos(PI * t);
      prof.push([i % 2 ? base - 0.001 : base, -t * gripLen]);
    }
    prof.push([0, -gripLen]);
    lathe(b, { mat: 'walnut', seg: 18, profile: prof });
  });
  b.extrude({ points: [[0.022, -0.032], [0.054, -0.032], [0.06, -0.04], [0.04, -0.044], [0.024, -0.044]], width: 0.026, mat: P, bevel: 0.0015 });
  swivel(b, { y: -0.128, z: 0.068, r: 0.0055, t: 0.0014, w: 0.002 });
  b.box({ x: -0.0118, y: -0.003, z: 0.052, w: 0.002, h: 0.006, d: 0.012, mat: P, r: 0.0008 }); // safety
  // Bolt with the ribbed cocking ears at the rear.
  b.part('bolt', [0, 0, 0.056]);
  b.span({ z0: -0.092, z1: 0.04, y0: -0.006, y1: 0.0108, w: 0.012, mat: 'steelBright', r: 0.0015 });
  for (const sx of [-1, 1]) b.extrude({ points: [[0.032, 0.0], [0.052, 0.0], [0.054, 0.018], [0.038, 0.016]], width: 0.004, x: sx * 0.0048, mat: 'steelBright', bevel: 0.0005 });
  b.body();
  // Ring hammer (cocked).
  b.part('hammer', [0, -0.004, 0.056]);
  b.extrude({ points: circle(0.066, 0.006, 0.0075, 16), holes: [circle(0.066, 0.006, 0.0042, 12)], width: 0.007, mat: P, bevel: 0.0007 });
  b.span({ z0: 0.052, z1: 0.06, y0: -0.008, y1: 0.002, w: 0.007, mat: P, r: 0.001 });
  b.body();

  b.anchor('muzzle', 0, 0, -0.225);
  b.anchor('gripR', 0, -0.07, 0.055);
  b.anchor('trigger', 0, -0.028, 0.0);
  b.anchor('gripL', -0.022, -0.06, -0.072); // support hand on the magazine
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.03;
}

// Raketenpanzerbüchse 54 "Panzerschreck": 88 mm launch tube, 1640 mm, blast
// shield with sighting window, front sight with range posts (50/100/150 m) and
// rear notch on the left, trigger grip with the magneto cocking lever, front
// grip, padded shoulder rest. RPzB Gr 4322 rocket loaded from the rear.
export function panzerschreck(b) {
  const Y = 'germanYellow';
  tube(b, { z0: -1.0, z1: 0.64, rIn: 0.0445, rOut: 0.0475, mat: Y, seg: 32 });
  tube(b, { z0: -1.0, z1: -0.982, rIn: 0.0445, rOut: 0.0515, mat: Y, seg: 32 });
  tube(b, { z0: 0.622, z1: 0.64, rIn: 0.0445, rOut: 0.0515, mat: Y, seg: 32 });
  for (const z of [-0.6, 0.33]) tube(b, { z0: z - 0.01, z1: z + 0.01, rIn: 0.047, rOut: 0.0505, mat: 'steel', seg: 32 });
  // Rear wire guard and rocket latch / contact box.
  for (const z of [0.6, 0.66]) b.rod({ from: [-0.035, 0.035, 0.6], to: [-0.035 * (z === 0.66 ? 1.2 : 1), 0.035 * (z === 0.66 ? 1.2 : 1), z], r: 0.003, mat: 'steel' });
  b.span({ z0: 0.55, z1: 0.6, y0: 0.045, y1: 0.056, w: 0.02, mat: 'steel', r: 0.002 });
  // Sights on the left: front frame with range posts, rear notch plate.
  const SX = -0.085,
    SR = 0.07,
    posts = [0.0605, 0.0516, 0.0423]; // 50, 100, 150 m
  b.span({ z0: -0.47, z1: -0.45, y0: 0.0, y1: 0.012, w: 0.05, x: -0.06, mat: Y, r: 0.002 });
  plateXY(b, { outline: [[SX - 0.012, 0.004], [SX + 0.012, 0.004], [SX + 0.012, 0.072], [SX - 0.012, 0.072]], holes: [[[SX - 0.009, 0.007], [SX + 0.009, 0.007], [SX + 0.009, 0.069], [SX - 0.009, 0.069]]], z: -0.46, thick: 0.002, mat: 'steel' });
  for (const y of posts) b.span({ z0: -0.461, z1: -0.459, y0: y - 0.007, y1: y, w: 0.0016, x: SX, mat: 'steel', r: 0.0002 });
  b.anchor('frontSight', SX, posts[1], -0.46);
  b.span({ z0: -0.07, z1: -0.04, y0: 0.0, y1: 0.012, w: 0.05, x: -0.06, mat: Y, r: 0.002 });
  for (const sx of [-1, 1]) plateXY(b, { outline: [[SX + sx * 0.0015, 0.008], [SX + sx * 0.011, 0.008], [SX + sx * 0.011, 0.076], [SX + sx * 0.0015, 0.076]], z: -0.05, thick: 0.002, mat: 'steel' });
  plateXY(b, { outline: [[SX - 0.011, 0.008], [SX + 0.011, 0.008], [SX + 0.011, SR], [SX - 0.011, SR]], z: -0.05, thick: 0.002, mat: 'steel' });
  b.anchor('rearSight', SX, SR, -0.05);
  // Blast shield with the sighting window.
  plateXY(b, {
    outline: [[-0.27, -0.13], [0.06, -0.13], [0.075, -0.115], [0.075, 0.28], [0.06, 0.3], [-0.27, 0.3], [-0.29, 0.28], [-0.29, -0.11]],
    holes: [circle(0, 0, 0.0478, 24), [[SX - 0.026, SR - 0.024], [SX + 0.026, SR - 0.024], [SX + 0.026, SR + 0.016], [SX - 0.026, SR + 0.016]]],
    z: -0.03,
    thick: 0.0025,
    mat: Y,
  });
  b.span({ z0: -0.04, z1: -0.02, y0: -0.05, y1: 0.05, w: 0.108, mat: Y, r: 0.004 }); // shield clamp
  // Cocking lever housing, trigger grip with guard and trigger, front grip.
  b.span({ z0: -0.16, z1: 0.06, y0: -0.064, y1: -0.042, w: 0.032, mat: Y, r: 0.003 });
  b.box({ x: 0.0, y: -0.07, z: -0.11, w: 0.012, h: 0.012, d: 0.06, mat: 'steel', r: 0.002 });
  b.extrude({ points: S([[0.012, -0.062], [0.052, -0.062], [0.064, -0.09], [0.084, -0.15], [0.076, -0.162], [0.052, -0.159], [0.04, -0.124], [0.024, -0.086]]), width: 0.03, mat: 'beech', bevel: 0.0065 });
  guard(b, { zf: -0.036, zr: 0.022, yTop: -0.062, yBot: -0.09, t: 0.004, w: 0.01, mat: 'steel', rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.063, len: 0.018, curve: 0.005, mat: 'steel' });
  b.span({ z0: -0.425, z1: -0.375, y0: -0.058, y1: -0.042, w: 0.03, mat: Y, r: 0.003 });
  b.extrude({ points: S([[-0.418, -0.056], [-0.384, -0.056], [-0.38, -0.1], [-0.384, -0.152], [-0.4, -0.16], [-0.416, -0.152], [-0.42, -0.1]]), width: 0.03, mat: 'beech', bevel: 0.007 });
  // Shoulder rest: frame and pad under the tube.
  b.extrude({ points: S([[0.1, -0.042], [0.34, -0.042], [0.33, -0.06], [0.27, -0.078], [0.16, -0.076], [0.105, -0.062]]), width: 0.03, mat: Y, bevel: 0.003 });
  b.extrude({ points: S([[0.16, -0.07], [0.32, -0.06], [0.32, -0.09], [0.24, -0.1], [0.16, -0.094]]), width: 0.07, mat: 'leather', bevel: 0.01 });
  swivel(b, { x: -0.05, y: 0.0, z: -0.75, r: 0.009, w: 0.004 });
  // RPzB Gr 4322 rocket in the tube (tail ring visible at the rear).
  b.part('rocket', [0, 0, 0.3]);
  lathe(b, { mat: 'germanGrey', seg: 24, profile: [[0, -0.06], [0.016, -0.055], [0.034, -0.03], [0.0435, 0.0], [0.0435, 0.16], [0.03, 0.2], [0.017, 0.22], [0, 0.22]] });
  b.cyl({ z0: 0.21, z1: 0.6, r0: 0.0145, mat: 'steel', seg: 16 });
  tube(b, { z0: 0.55, z1: 0.615, rIn: 0.039, rOut: 0.0415, mat: 'steel', seg: 28 });
  for (let k = 0; k < 4; k++) {
    place(b, { rot: [0, 0, (k * PI) / 2 + PI / 4] }, () => {
      b.span({ z0: 0.555, z1: 0.612, y0: 0.0135, y1: 0.0395, w: 0.0015, mat: 'steel', r: 0.0003 });
    });
  }
  b.body();

  b.anchor('muzzle', 0, 0, -1.0);
  b.anchor('gripR', 0, -0.1, 0.045);
  b.anchor('trigger', 0, -0.072, 0.0);
  b.anchor('gripL', 0, -0.11, -0.4);
  b.anchor('shoulder', 0, -0.09, 0.25);
  b.meta.sight = 'post';
  b.meta.sightRanges = { 50: posts[0], 100: posts[1], 150: posts[2] }; // post heights (m)
  b.meta.rocketAxis = [0, 0, 1]; // loaded from the rear
}

// Panzerfaust 60: recoilless disposable launcher, 1045 mm, 50 mm tube with the
// 149 mm HEAT warhead ('warhead' part) on its stabilizer boom, flip-up sight
// leaf with holes for 30, 60 and 80 m (front sight: pin on the warhead rim),
// firing lever on top.
export function panzerfaust60(b) {
  const Y = 'germanYellow';
  tube(b, { z0: -0.25, z1: 0.55, rIn: 0.0236, rOut: 0.025, mat: Y, seg: 26 });
  tube(b, { z0: 0.53, z1: 0.55, rIn: 0.019, rOut: 0.0252, mat: 'steel', seg: 26 }); // nozzle ring
  // Folding sight leaf (raised), hinged on the tube top.
  const holes = { 30: 0.0997, 60: 0.122, 80: 0.1382 };
  b.span({ z0: -0.08, z1: -0.06, y0: 0.022, y1: 0.03, w: 0.026, mat: Y, r: 0.002 });
  b.part('rearSight', [0, 0.028, -0.07]);
  plateXY(b, { outline: [[-0.011, 0.026], [0.011, 0.026], [0.011, 0.142], [0.006, 0.147], [-0.006, 0.147], [-0.011, 0.142]], holes: Object.values(holes).map((y) => circle(0, y, 0.0022, 12)), z: -0.07, thick: 0.0016, mat: Y });
  b.anchor('rearSight', 0, holes[60], -0.07);
  b.body();
  b.meta.sightKind = 'leaf';
  b.meta.sightFold = -PI / 2; // folds forward flat on the tube
  b.meta.sightRanges = holes; // hole heights (m) for 30 / 60 / 80 m
  // Firing lever with its safety pin, just behind the sight.
  b.span({ z0: -0.035, z1: 0.025, y0: 0.023, y1: 0.03, w: 0.016, mat: Y, r: 0.002 });
  b.box({ x: 0, y: 0.032, z: -0.006, w: 0.012, h: 0.005, d: 0.04, mat: 'steel', r: 0.0015 });
  b.cylAxis({ axis: 'x', x: 0.0, y: 0.028, z: -0.03, len: 0.03, r: 0.0018, mat: 'steelBright' });
  // Warhead with its stabilizer boom inside the tube.
  b.part('warhead', [0, 0, -0.36]);
  lathe(b, {
    mat: 'germanGrey',
    seg: 32,
    profile: [
      [0, -0.497],
      [0.014, -0.496],
      [0.036, -0.485],
      [0.056, -0.462],
      [0.068, -0.432],
      [0.0745, -0.398],
      [0.0745, -0.365],
      [0.07, -0.34],
      [0.056, -0.315],
      [0.036, -0.29],
      [0.025, -0.272],
      [0.0225, -0.25],
      [0, -0.25],
    ],
  });
  b.cyl({ z0: -0.25, z1: -0.04, r0: 0.0115, mat: 'beech', seg: 12 }); // stabilizer boom
  b.cylAxis({ axis: 'y', x: 0, y: 0.0757, z: -0.36, len: 0.0045, r: 0.0016, mat: 'steel', seg: 8 }); // sight pin
  b.body();
  b.anchor('frontSight', 0, 0.0778, -0.36);

  b.anchor('muzzle', 0, 0, -0.25);
  b.anchor('gripR', 0, -0.026, 0.02);
  b.anchor('trigger', 0, 0.034, 0.0);
  b.anchor('gripL', 0, -0.026, -0.17);
  b.anchor('shoulder', 0, -0.026, 0.3);
  b.meta.sight = 'post';
  b.meta.warheadAxis = [0, 0, -1];
}

// Stielhandgranate 24 "potato masher": field-grey head with belt clip, wooden
// handle with the screw cap over the pull cord. Upright: +Y = head; origin at
// the throwing grip on the handle.
export function stielhandgranate24(b) {
  b.cylAxis({ axis: 'y', y: 0.157, len: 0.07, r: 0.035, mat: 'germanGrey', seg: 28 });
  b.cylAxis({ axis: 'y', y: 0.194, len: 0.004, r: 0.0335, mat: 'germanGrey', seg: 28 });
  b.cylAxis({ axis: 'y', y: 0.12, len: 0.004, r: 0.0335, mat: 'germanGrey', seg: 28 });
  b.box({ x: 0.0355, y: 0.16, z: 0, w: 0.002, h: 0.05, d: 0.012, mat: 'steel', r: 0.0006 }); // belt clip
  b.cylAxis({ axis: 'y', y: 0.111, len: 0.016, r: 0.0145, mat: 'steel', seg: 18 });
  b.cylAxis({ axis: 'y', y: -0.025, len: 0.258, r: 0.0128, r1: 0.0122, mat: 'beech', seg: 18 });
  b.cylAxis({ axis: 'y', y: -0.165, len: 0.022, r: 0.0142, mat: 'steel', seg: 18 });
  b.cylAxis({ axis: 'y', y: -0.177, len: 0.004, r: 0.0128, mat: 'steel', seg: 18 });
  b.anchor('gripR', 0, -0.05, 0);
  b.anchor('gripL', 0, -0.17, 0); // unscrews the cap and pulls the cord
  b.anchor('pin', 0, -0.178, 0);
  b.meta.kind = 'grenade';
  b.meta.fuse = 4.5;
}
