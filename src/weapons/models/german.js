// German small arms. See kit.js for the coordinate conventions:
// meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at z = 0.
import { GunBuilder } from './kit.js';

const S = GunBuilder.smooth;

// Karabiner 98k: Mauser bolt action, 7.92x57, 5-round internal magazine loaded
// with stripper clips. 1110 mm long, 600 mm barrel, tangent rear sight (V notch)
// 100-2000 m, hooded barleycorn front sight, turned-down bolt handle.
export function kar98k(b) {
  // Barrel, stepped as on the real rifle.
  b.lathe({
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
  b.cyl({ z0: -0.785, z1: -0.766, r0: 0.0112, y: 0.0135, mat: 'steel', open: true, seg: 18 });
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
  b.meta.boltThrow = 0.09; // how far the bolt slides back (m)
  b.meta.boltLift = Math.PI / 2; // handle rotation (rad)
}
