// German small arms. See kit.js for the coordinate conventions:
// meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at z = 0.
import { GunBuilder } from './kit.js';
import { place, circle, slot, boxMag, guard, trigger, plateXY, lathe, tube, cartridge, swivel, taperZ, path, loft, arcTube } from './parts.js';
import { stock, band, plateXYz, bar, screw, buttPlate, arch, stockSection, sectionLoft, crisp, stations, superellipse, knurledKnob, sweepGrip, serrations, perfTube, sling, stamp, ribbon, latheY, ringLoft, smoothstep } from './shapes.js';
import { zf41, zf4, ring } from './optics.js';

const S = GunBuilder.smooth;
const PI = Math.PI;

// Upright stadium outline ([z, y]) centered on z from y0 to y1, half-width r:
// pressed ribs on magazine housings and receivers.
function vslot(z, y0, y1, r, n = 5) {
  return slot(y0, y1, z, r, n).map(([y, zz]) => [zz, y]);
}

// Karabiner 98k: Mauser bolt action, 7.92x57, 5-round internal magazine loaded
// from stripper clips. 1110 mm long, 600 mm barrel, 500 mm sight radius
// (Wikipedia). Tangent rear sight with a V notch, 100-2000 m; barleycorn front
// sight under a sheet-steel hood (from 1939); turned-down bolt handle; laminated
// beech stock (from about 1940) with the sling on the left (lower band swivel, slot
// through the butt) and the bolt disassembly disc on the right. Positions along
// the rifle are est. from side views: muzzle 780 mm ahead of the trigger.
export function kar98k(b) {
  const P = 'steel';
  const W = 'laminate';
  const MZ = -0.78; // muzzle
  const FS = 0.0236; // front sight tip above the bore
  const FZ = -0.765; // front sight post
  const RZ = -0.268; // rear notch (500 mm sight radius)

  // --- Barrel: stepped (est.), 28 mm over the chamber, 14.8 mm at the muzzle; the
  // crowned muzzle shows the 7.92 mm bore.
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.00396, MZ + 0.012],
      [0.00396, MZ + 0.0004],
      [0.0048, MZ],
      [0.0069, MZ],
      [0.0074, MZ + 0.0007],
      [0.0075, -0.7],
      [0.0078, -0.69],
      [0.0083, -0.61],
      [0.0085, -0.6],
      [0.009, -0.52],
      [0.0093, -0.51],
      [0.0099, -0.43],
      [0.0103, -0.42],
      [0.0109, -0.36],
      [0.0118, -0.35],
      [0.0122, -0.27],
      [0.0136, -0.262],
      [0.014, -0.24],
      [0.014, -0.222],
      [0, -0.222],
    ],
  });
  b.cyl({ z0: MZ + 0.0125, z1: MZ + 0.0115, r0: 0.0041, mat: 'black', seg: 12 });

  // --- Front sight: sleeve on the barrel, dovetailed barleycorn, sheet hood.
  lathe(b, { mat: P, seg: 24, profile: [[0.0074, MZ + 0.0035], [0.0092, MZ + 0.0035], [0.0094, MZ + 0.005], [0.0094, MZ + 0.029], [0.0088, MZ + 0.031], [0.0074, MZ + 0.031]] });
  b.span({ z0: MZ + 0.006, z1: MZ + 0.028, y0: 0.006, y1: 0.0118, w: 0.0098, mat: P, r: 0.0012 });
  // Dovetail slide and the roof-shaped post.
  b.span({ z0: FZ - 0.0045, z1: FZ + 0.0045, y0: 0.0112, y1: 0.0142, w: 0.0072, mat: P, r: 0.0005 });
  plateXYz(b, {
    outline: [[-0.0015, 0.014], [0.0015, 0.014], [0.0013, 0.0175], [0.0003, FS], [-0.0003, FS], [-0.0013, 0.0175]],
    z0: FZ - 0.0028,
    z1: FZ + 0.0028,
    mat: P,
    bevel: 0.0002,
  });
  b.anchor('frontSight', 0, FS, FZ);
  // Hood: an arch of 0.8 mm sheet clipped over the base, open at the bottom.
  plateXYz(b, { outline: arch(0, 0.0178, 0.0084, 0.0093, -0.32, PI + 0.32, 0.0062, b.detail(1) ? 24 : 8), z0: MZ + 0.0045, z1: MZ + 0.0265, mat: P, bevel: 0.0003 });

  // --- Nose cap with the bayonet lug underneath; cleaning rod head ahead of it.
  const NC0 = -0.715,
    NC1 = -0.68;
  plateXYz(b, {
    outline: stockSection({ y0: -0.0295, y1: 0.0107, w: 0.0305, n: 2.3, wTop: 0.7, wBot: 0.86, belly: 0.35 }, b.detail(1) ? 40 : 12),
    holes: [circle(0, 0, 0.0077, b.detail(1) ? 20 : 8), circle(0, -0.0172, 0.0034, b.detail(1) ? 12 : 6)],
    z0: NC0,
    z1: NC1,
    mat: P,
    bevel: 0.0008,
  });
  plateXYz(b, { outline: [[-0.0031, -0.0285], [0.0031, -0.0285], [0.0031, -0.0335], [0.0056, -0.0335], [0.0056, -0.0385], [-0.0056, -0.0385], [-0.0056, -0.0335], [-0.0031, -0.0335]], z0: NC0 - 0.002, z1: NC0 + 0.03, mat: P, bevel: 0.0004 });
  screw(b, { at: [-0.0153, -0.012, NC1 - 0.011], axis: '-x', r: 0.0026, mat: P });
  b.cyl({ z0: -0.733, z1: NC0 + 0.01, r0: 0.0031, y: -0.0172, mat: 'steelBright', seg: 12 });
  lathe(b, { mat: 'steelBright', y: -0.0172, seg: 14, profile: [[0, -0.737], [0.0028, -0.737], [0.0044, -0.7355], [0.0046, -0.731], [0.0041, -0.7265], [0.0031, -0.725]] });

  // --- Stock: laminated beech, straight wrist, the butt's comb sloping to the heel.
  const stk = stock(b, {
    mat: W,
    z0: -0.712,
    z1: 0.3185,
    top: [
      [-0.712, 0.0],
      [-0.36, 0.0],
      [-0.33, 0.0015],
      [-0.23, 0.002],
      [-0.19, -0.002],
      [-0.1, -0.004],
      [-0.06, -0.006],
      [0.0, -0.008],
      [0.035, -0.01],
      [0.065, -0.0135],
      [0.15, -0.0235],
      [0.25, -0.035],
      [0.3185, -0.0435],
    ],
    bottom: [
      [-0.712, -0.0262],
      [-0.6, -0.0298],
      [-0.45, -0.0338],
      [-0.3, -0.038],
      [-0.235, -0.0418],
      [-0.19, -0.0498],
      [-0.06, -0.0512],
      [0.04, -0.0545],
      [0.07, -0.063],
      [0.11, -0.082],
      [0.2, -0.124],
      [0.3185, -0.1715],
    ],
    width: [
      [-0.712, 0.0296],
      [-0.45, 0.0328],
      [-0.3, 0.0356],
      [-0.23, 0.0402],
      [-0.1, 0.0412],
      [-0.045, 0.0385],
      [0.03, 0.0338],
      [0.08, 0.032],
      [0.15, 0.0362],
      [0.25, 0.0408],
      [0.3185, 0.042],
    ],
    n: [
      [-0.5, 2.3],
      [-0.26, 2.6],
      [-0.08, 3.0],
      [0.04, 2.3],
      [0.09, 2.1],
      [0.18, 2.8],
      [0.3, 3.3],
    ],
    wTop: [
      [-0.5, 0.95],
      [-0.08, 0.96],
      [0.05, 0.86],
      [0.12, 0.76],
      [0.3, 0.7],
    ],
    wBot: [
      [-0.5, 0.74],
      [-0.08, 0.86],
      [0.06, 0.82],
      [0.2, 0.8],
      [0.3, 0.78],
    ],
    belly: [
      [-0.5, 0.58],
      [-0.1, 0.55],
      [0.1, 0.5],
      [0.3, 0.44],
    ],
    // Barrel channel ahead of the upper band, inletting for the barrel shank and
    // the receiver (their lower halves sit in the wood).
    chDepth: [
      [-0.69, 0.0084],
      [-0.66, 0.0084],
      [-0.645, 0.0],
      [-0.36, 0.0],
      [-0.345, 0.0165],
      [-0.23, 0.0175],
      [-0.215, 0.021],
      [-0.075, 0.021],
      [-0.066, 0.0],
    ],
    chHalf: [
      [-0.69, 0.0083],
      [-0.645, 0.0086],
      [-0.36, 0.0126],
      [-0.345, 0.0142],
      [-0.235, 0.0142],
      [-0.215, 0.0182],
      [-0.075, 0.0182],
      [-0.066, 0.014],
    ],
  });
  // Steel butt plate, cupped over the end of the stock.
  buttPlate(b, stk, { z0: 0.3155, z1: 0.3295, mat: P, screws: [-0.062, -0.152] });
  // Handguard from the rear sight to the upper band.
  stock(b, {
    mat: W,
    z0: -0.656,
    z1: -0.3525,
    top: [
      [-0.656, 0.0172],
      [-0.5, 0.0182],
      [-0.3525, 0.0194],
    ],
    bottom: [
      [-0.656, 0.0004],
      [-0.3525, 0.0004],
    ],
    width: [
      [-0.656, 0.0258],
      [-0.3525, 0.0272],
    ],
    n: 2.3,
    wTop: 0.42,
    wBot: 1.0,
    belly: 0.12,
    rings: 28,
    roundEnd: 0.006,
    roundAnchor: 'bottom',
  });
  // Upper band (held by its spring) and lower band with the sling swivel on the left.
  band(b, { z0: -0.662, z1: -0.646, y0: -0.0306, y1: 0.0182, w: 0.0312, n: 2.5, thick: 0.0016, mat: P });
  band(b, { z0: -0.456, z1: -0.441, y0: -0.0345, y1: 0.0194, w: 0.0336, n: 2.6, thick: 0.0016, mat: P });
  if (b.detail(0)) {
    for (const [z, y] of [
      [-0.636, -0.011],
      [-0.432, -0.014],
    ])
      b.box({ x: 0.0159, y, z, w: 0.0012, h: 0.0045, d: 0.016, mat: P, r: 0.0004 }); // band springs
  }
  b.box({ x: -0.0186, y: -0.006, z: -0.4485, w: 0.004, h: 0.008, d: 0.01, mat: P, r: 0.001 });
  bar(b, { pts: [[-0.0205, -0.006, -0.4485], [-0.0215, -0.016, -0.444], [-0.0215, -0.026, -0.4485], [-0.0215, -0.016, -0.453]], closed: true, r: 0.0019, mat: P, seg: 8 });
  // Cross bolts through the stock (under the ring and behind the magazine).
  for (const z of [-0.205, -0.055]) {
    const hw = stk.halfWidth(z, -0.034);
    for (const s of [-1, 1]) b.cylAxis({ axis: 'x', x: s * (hw + 0.0002), y: -0.034, z, len: 0.0012, r: 0.0042, mat: P, seg: 16 });
  }
  // Butt: bolt disassembly disc on the right, sling slot through the butt.
  {
    const hw = stk.halfWidth(0.255, -0.093);
    b.extrude({ points: circle(0.255, -0.093, 0.0134, 28), holes: [circle(0.255, -0.093, 0.0052, 14)], width: 0.0015, x: hw + 0.0001, mat: P, bevel: 0.0004 });
    b.cylAxis({ axis: 'x', x: hw - 0.002, y: -0.093, z: 0.255, len: 0.002, r: 0.0053, mat: 'black', seg: 14 });
    const zS = 0.188,
      yS = -0.086;
    const hs = stk.halfWidth(zS, yS);
    b.extrude({ points: slot(zS - 0.016, zS + 0.016, yS, 0.0052), width: 2 * hs + 0.0006, mat: 'black', bevel: 0.0002 });
    for (const s of [-1, 1])
      b.extrude({ points: slot(zS - 0.0185, zS + 0.0185, yS, 0.0075), holes: [slot(zS - 0.016, zS + 0.016, yS, 0.0052)], width: 0.0012, x: s * (hs + 0.0003), mat: P, bevel: 0.0003 });
  }

  // --- Rear sight: base sleeve with the leaf bed and side ramps; the leaf (hinged
  // at its front) carries the slider and the V notch.
  lathe(b, { mat: P, seg: 28, profile: [[0.0122, -0.352], [0.0141, -0.352], [0.0147, -0.349], [0.0147, -0.265], [0.0141, -0.262], [0.0136, -0.262]] });
  b.span({ z0: -0.35, z1: -0.264, y0: 0.008, y1: 0.0158, w: 0.0168, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) {
    b.extrude({ points: S([[-0.349, 0.012], [-0.3, 0.012], [-0.282, 0.0148], [-0.3, 0.0171], [-0.33, 0.0164], [-0.349, 0.016]], 3), width: 0.0016, x: s * 0.0091, mat: P, bevel: 0.0003 });
  }
  b.cylAxis({ axis: 'x', x: 0, y: 0.0172, z: -0.3435, len: 0.0176, r: 0.0016, mat: P, seg: 10 }); // hinge pin
  const LZ0 = -0.3465;
  b.part('rearSight', [0, 0.0172, -0.3435]);
  b.span({ z0: LZ0, z1: -0.2705, y0: 0.0158, y1: 0.0184, w: 0.0128, mat: P, r: 0.0006 });
  // V-notch plate at the rear end.
  plateXYz(b, {
    outline: [[-0.0064, 0.0178], [0.0064, 0.0178], [0.0064, 0.0258], [0.0019, 0.0258], [0.0, 0.0236], [-0.0019, 0.0258], [-0.0064, 0.0258]],
    z0: -0.2712,
    z1: -0.2668,
    mat: P,
    bevel: 0.0003,
  });
  // Slider with its spring-loaded catches (set at the bottom of the scale).
  b.span({ z0: -0.336, z1: -0.322, y0: 0.0151, y1: 0.0201, w: 0.0168, mat: P, r: 0.0009 });
  for (const s of [-1, 1]) b.box({ x: s * 0.0091, y: 0.0177, z: -0.329, w: 0.0026, h: 0.0042, d: 0.0085, mat: P, r: 0.0006 });
  if (b.detail(0)) {
    // Range graduations across the leaf, longer every 500 m.
    for (let i = 2; i <= 20; i++) {
      const z = -0.322 + (i - 2) * 0.0026;
      const long = i % 5 === 0;
      b.box({ x: long ? 0 : 0.0025, y: 0.01842, z, w: long ? 0.0096 : 0.0048, h: 0.0002, d: 0.00045, mat: 'black', r: 0 });
    }
  }
  b.anchor('rearSight', 0, 0.0236, RZ);
  b.body();

  // --- Receiver: front ring, side walls around the loading port (thumb cut on the
  // left, lower wall on the right), rear bridge with the stripper clip guide, tang.
  lathe(b, { mat: P, seg: 32, profile: [[0.014, -0.2225], [0.0172, -0.2225], [0.0179, -0.2215], [0.0179, -0.1872], [0.0172, -0.186], [0.0105, -0.186]] });
  if (b.detail(0)) b.cylAxis({ axis: 'x', x: 0.0176, y: 0.0, z: -0.198, len: 0.0012, r: 0.0017, mat: 'black', seg: 10 }); // gas vent
  if (b.detail(1)) {
    // Walls: flat outside, the bolt raceway inside, open below for the magazine.
    const RW = 0.0163,
      RR = 0.0093,
      MW = 0.0071,
      YB = -0.019;
    const K = b.detail(0) ? 6 : 3;
    const wall = (s, yTop) => {
      const rr = 0.0016;
      const pts = [[s * RW, YB, 1]];
      for (let k = 0; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([s * (RW - rr + Math.cos(a) * rr), yTop - rr + Math.sin(a) * rr, k === K]);
      }
      const t0 = Math.atan2(yTop, Math.sqrt(Math.max(0, RR * RR - yTop * yTop))),
        t1 = -Math.acos(MW / RR);
      for (let k = 0; k <= K + 2; k++) {
        const a = t0 + ((t1 - t0) * k) / (K + 2);
        pts.push([s * RR * Math.cos(a), RR * Math.sin(a), k === 0 || k === K + 2]);
      }
      pts.push([s * MW, YB, 1]);
      return crisp(pts);
    };
    const zs = stations(-0.1875, -0.1025, b.detail(0) ? 0.003 : 0.01);
    // Thumb cut: a round scallop in the left wall over the magazine.
    const thumb = (z) => {
      const u = (z + 0.155) / 0.0165;
      return Math.abs(u) < 1 ? 0.0072 * Math.sqrt(1 - u * u) : 0;
    };
    sectionLoft(b, { zs, section: (z) => wall(-1, 0.0108 - thumb(z)), mat: P, capStart: false, capEnd: false });
    sectionLoft(b, { zs: [-0.1875, -0.1025], section: () => wall(1, 0.0026), mat: P, capStart: false, capEnd: false });
    b.span({ z0: -0.1875, z1: -0.1025, y0: -0.0215, y1: -0.0185, w: 0.034, mat: P, r: 0.0008 });
  } else {
    b.span({ z0: -0.1875, z1: -0.1025, y0: -0.019, y1: 0.006, w: 0.033, mat: P });
  }
  // Magazine: the top round on the follower shows when the bolt is back.
  if (b.detail(0)) {
    b.span({ z0: -0.186, z1: -0.104, y0: -0.0215, y1: -0.0195, w: 0.0142, mat: 'black', r: 0 });
    cartridge(b, { ...R792, x: -0.0034, y: -0.0143, zBase: -0.1045, seg: 12 });
    b.span({ z0: -0.17, z1: -0.11, y0: -0.0215, y1: -0.0158, w: 0.0094, x: 0.0035, mat: P, r: 0.0008 }); // follower
  }
  // Bridge, with the bolt stop on its left rear.
  lathe(b, { mat: P, seg: 32, profile: [[0.0095, -0.1025], [0.0162, -0.1025], [0.0168, -0.1015], [0.0168, -0.0728], [0.0161, -0.0715], [0.0095, -0.0715]] });
  b.extrude({ points: S([[-0.0985, -0.0015], [-0.074, -0.001], [-0.068, 0.0035], [-0.0725, 0.0088], [-0.0985, 0.0085]], 3), width: 0.0046, x: -0.0178, mat: P, bevel: 0.0008 });
  screw(b, { at: [-0.0201, 0.0035, -0.0755], axis: '-x', r: 0.0021, mat: P, slot: 1.2 });
  // Stripper clip guide: two ears on the front of the bridge, grooved inside.
  for (const s of [-1, 1]) {
    plateXYz(b, {
      outline: [[s * 0.0049, 0.0118], [s * 0.0098, 0.0118], [s * 0.0097, 0.0195], [s * 0.0089, 0.0234], [s * 0.0062, 0.0238], [s * 0.0058, 0.0226], [s * 0.0049, 0.0226]],
      z0: -0.1025,
      z1: -0.0912,
      mat: P,
      bevel: 0.0005,
    });
    if (b.detail(0)) b.box({ x: s * 0.0053, y: 0.0196, z: -0.097, w: 0.0012, h: 0.0016, d: 0.0114, mat: 'black', r: 0 });
  }
  b.anchor('clipGuide', 0, 0.026, -0.097);
  b.anchor('ejectionPort', 0.012, 0.01, -0.145);
  // Tang, inletted flush with the top of the wrist, rounded at its end.
  if (b.detail(1)) {
    const zt0 = -0.0715,
      zt1 = 0.052;
    const zs = stations(zt0, zt1, b.detail(0) ? 0.004 : 0.02, [zt1 - 0.002, zt1 - 0.0045]);
    sectionLoft(b, {
      zs,
      mat: P,
      section: (z) => {
        const end = (z - (zt1 - 0.007)) / 0.007;
        const w = (0.0132 - Math.max(0, z + 0.03) * 0.02) * (end > 0 ? Math.sqrt(Math.max(0.02, 1 - end * end)) : 1);
        const yt = stk.top(z) + 0.0006;
        return superellipse(0, yt - 0.0016, w, 0.0032, 4, b.detail(0) ? 16 : 8);
      },
    });
  }

  // --- Bottom metal: floor plate, trigger guard bow and its rear tang, trigger.
  b.extrude({ points: path([[-0.1795, -0.0505], [-0.172, -0.0545], [-0.06, -0.0545, 1], [-0.054, -0.0505, 1]]), width: 0.0262, mat: P, bevel: 0.0012 });
  screw(b, { at: [0, -0.0545, -0.1705], axis: '-y', r: 0.0034, h: 0.001, mat: P, slot: 0 });
  guard(b, { zf: -0.0505, zr: 0.046, yTop: -0.053, yBot: -0.0795, t: 0.0047, w: 0.0108, mat: P, rake: 0.004 });
  b.extrude({ points: path([[0.04, -0.0525, 1], [0.072, -0.058], [0.08, -0.0615, 1], [0.066, -0.0598], [0.04, -0.0568, 1]]), width: 0.0118, mat: P, bevel: 0.001 });
  screw(b, { at: [0, -0.06, 0.066], axis: '-y', r: 0.0032, h: 0.001, mat: P, slot: 0 });
  b.box({ x: 0, y: -0.0565, z: -0.046, w: 0.0045, h: 0.004, d: 0.006, mat: P, r: 0.0008 }); // floor plate catch
  trigger(b, { z: 0.0, yTop: -0.052, len: 0.0225, curve: 0.0065, thick: 0.0055, w: 0.0052, mat: P });

  // --- Bolt: body in the white with the long claw extractor, handle turned down to
  // a round knob; shroud with the three-position safety (wing at "fire", lying to
  // the left) and the cocking piece. Turns up and slides back as one part.
  b.part('bolt', [0, 0, -0.07]);
  const BR = 0.0089;
  b.cyl({ z0: -0.1885, z1: -0.069, r0: BR, mat: 'steelBright', seg: 28 });
  b.cyl({ z0: -0.153, z1: -0.146, r0: 0.0097, mat: 'steelBright', seg: 28 }); // extractor collar
  b.extrude({ points: path([[-0.1885, 0.0035, 1], [-0.1885, -0.0045, 1], [-0.11, -0.0045], [-0.104, -0.003, 1], [-0.104, 0.0025, 1]]), width: 0.0026, x: 0.0094, mat: 'steelBright', bevel: 0.0005 });
  b.cyl({ z0: -0.0755, z1: -0.0655, r0: 0.0103, mat: 'steelBright', seg: 28 }); // handle root
  bar(b, { pts: [[0.008, -0.0005, -0.0705], [0.022, -0.0035, -0.0695], [0.0345, -0.0145, -0.0655], [0.0425, -0.0255, -0.0625]], r: [[0, 0.005], [0.6, 0.0043], [1, 0.004]], mat: 'steelBright', seg: 14 });
  b.sphere({ x: 0.0462, y: -0.0322, z: -0.0608, r: 0.0097, mat: 'steelBright', seg: 22, sy: 0.96 });
  b.anchor('boltHandle', 0.0462, -0.0322, -0.0608);
  // Shroud (bolt sleeve).
  lathe(b, { mat: P, seg: 28, profile: [[0, -0.0655], [0.0102, -0.0655], [0.0109, -0.064], [0.0109, -0.044], [0.0103, -0.035], [0.0094, -0.0322], [0, -0.0322]] });
  b.box({ x: 0, y: -0.009, z: -0.049, w: 0.009, h: 0.006, d: 0.03, mat: P, r: 0.0015 }); // guide under the sleeve
  // Safety: barrel of the lever on top of the sleeve, wing turned to the left.
  b.cyl({ z0: -0.047, z1: -0.0335, r0: 0.0042, y: 0.0104, mat: P, seg: 18 });
  b.extrude({ points: S([[-0.0462, 0.0], [-0.034, 0.0], [-0.0325, 0.0055], [-0.0362, 0.0112], [-0.0438, 0.0112], [-0.0475, 0.0055]], 3), width: 0.0026, x: -0.0062, mat: P, bevel: 0.0006 });
  place(b, { pos: [0, 0.0104, 0], rot: [0, 0, 0.0] }, () => b.box({ x: -0.006, y: 0.0, z: -0.0402, w: 0.008, h: 0.0028, d: 0.006, mat: P, r: 0.0008 }));
  // Cocking piece: knob with the firing-pin nut, its lug riding in the tang groove.
  lathe(b, { mat: P, seg: 24, profile: [[0, -0.0325], [0.0068, -0.0325], [0.0074, -0.0295], [0.0074, -0.0145], [0.0067, -0.0098], [0.0048, -0.0082], [0, -0.0082]] });
  b.box({ x: 0, y: -0.0074, z: -0.022, w: 0.0062, h: 0.0062, d: 0.022, mat: P, r: 0.0012 });
  if (b.detail(0)) b.cylAxis({ axis: 'z', x: 0, y: 0, z: -0.0081, len: 0.0006, r: 0.0026, mat: 'black', seg: 12 });
  b.body();

  // Markings: maker code and year on the ring, model on the left wall.
  stamp(b, { name: 'k98kRing', at: [0, 0.0179, -0.2045], r: 0.0179, w: 0.0108, h: 0.0145 });
  stamp(b, { name: 'k98kSide', at: [-0.0163, -0.0045, -0.146], axis: '-x', w: 0.032, h: 0.0065 });

  // Black leather sling on the left: lower band swivel to the slot in the butt.
  sling(b, { from: [-0.0236, -0.022, -0.4485], to: [-0.0245, -0.086, 0.176], sag: 0.055, width: 0.0255, mat: 'leatherBlack' });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0.0, -0.046, 0.075);
  b.anchor('trigger', 0.0, -0.06, 0.006);
  b.anchor('gripL', 0.0, -0.031, -0.4);
  b.anchor('shoulder', 0, -0.105, 0.33);
  b.meta.sight = 'notch';
  b.meta.sightKind = 'leaf';
  b.meta.boltThrow = 0.094; // the bolt clears an 82 mm round (m)
  b.meta.boltLift = PI / 2; // handle rotation (rad)
}

// 7.92x57 cartridge.
const R792 = { caseLen: 0.0569, oal: 0.0805, rRim: 0.00595, rNeck: 0.0045, rBullet: 0.0041, shoulder: 0.8 };

// Karabiner 98k with the Zeiss ZF 39 4x scope on the high turret mount
// (Turmmontage): turret base on the receiver ring, lever-locked rear base on the
// bridge. The iron sights stay usable under the scope: both bases are open
// below (a tunnel 10 mm wide over the receiver) so the eye sees the rear notch
// and the front sight through them.
export function kar98k_zf39(b) {
  kar98k(b);
  const P = 'steel';
  const yc = 0.0525; // scope axis height over the bore
  const T = 0.0052, // the tunnel's half width and its top
    TY = 0.0345;
  // Front turret base on the receiver ring, rear base on the bridge (behind the
  // clip guide) with its locking lever: two cheeks each, a bridge over the tunnel.
  for (const s of [-1, 1]) {
    b.span({ z0: -0.2125, z1: -0.1955, y0: 0.0158, y1: TY + 0.001, w: 0.0128 - T, x: s * (T + 0.0128) / 2, mat: P, r: 0.0015 });
    b.span({ z0: -0.091, z1: -0.0715, y0: 0.0158, y1: TY + 0.001, w: 0.0116 - T, x: s * (T + 0.0116) / 2, mat: P, r: 0.0015 });
  }
  b.extrude({ points: path([[-0.2155, TY, 1], [-0.1925, TY, 1], [-0.196, yc - 0.0105, 1], [-0.212, yc - 0.0105, 1]]), width: 0.0158, mat: P, bevel: 0.0015 });
  b.extrude({ points: path([[-0.0895, TY, 1], [-0.0735, TY, 1], [-0.0745, yc - 0.0105, 1], [-0.0885, yc - 0.0105, 1]]), width: 0.0152, mat: P, bevel: 0.0015 });
  b.box({ x: 0.0145, y: 0.0262, z: -0.0805, w: 0.004, h: 0.005, d: 0.028, mat: P, r: 0.0012 }); // locking lever
  if (b.detail(0)) for (const z of [-0.087, -0.076]) screw(b, { at: [-0.0118, 0.021, z], axis: '-x', r: 0.0018, mat: P, slot: 0.3 });
  for (const z of [-0.204, -0.081]) tube(b, { y: yc, z0: z - 0.0085, z1: z + 0.0085, rIn: 0.0131, rOut: 0.0158, mat: P, seg: 28 });
  // ZF 39 (Zielvier): 26 mm tube, objective and ocular bells, elevation drum.
  lathe(b, {
    mat: P,
    y: yc,
    seg: 32,
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
  knurledKnob(b, { at: [0, yc + 0.0185, -0.142], axis: 'y', r: 0.0118, len: 0.011, teeth: 32, mat: P });
  b.cylAxis({ axis: 'y', x: 0, y: yc + 0.0128, z: -0.142, len: 0.004, r: 0.0128, mat: 'steelBright', seg: 24 });
  if (b.detail(0)) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    b.box({ x: Math.cos(a) * 0.0124, y: yc + 0.0158, z: -0.142 + Math.sin(a) * 0.0124, w: 0.0008, h: 0.0042, d: 0.0008, mat: 'black', r: 0 }); // range marks
  }
  b.cylAxis({ axis: 'z', x: 0, y: yc, z: 0.0212, len: 0.0006, r: 0.0165, mat: 'glass' });
  b.cylAxis({ axis: 'z', x: 0, y: yc, z: -0.2452, len: 0.0006, r: 0.0185, mat: 'glass' });
  b.anchor('scopeEye', 0, yc, 0.0213);
  b.anchor('scopeFront', 0, yc, -0.2453);
  b.meta.sight = 'scope';
  b.meta.scopeMag = 4;
}

// Karabiner 98k with the ZF 41 1.5x: a dovetail rail on the left of the rear
// sight base, a clamp mount reaching up and over to the scope above the rear
// sight, well ahead of the action, so stripper clips still go in and the eye
// (about 30 cm back) still sees the rear notch under it. Mount sizes est.
export function kar98k_zf41(b) {
  kar98k(b);
  const P = 'steel';
  const yc = 0.0412;
  const r = 0.0098;
  b.span({ z0: -0.345, z1: -0.272, y0: -0.0045, y1: 0.0115, w: 0.0062, x: -0.0172, mat: P, r: 0.0008 }); // rail
  b.span({ z0: -0.343, z1: -0.274, y0: -0.0065, y1: 0.0135, w: 0.0052, x: -0.0228, mat: P, r: 0.0012 }); // clamp
  b.box({ x: -0.0262, y: 0.003, z: -0.3, w: 0.0035, h: 0.006, d: 0.024, mat: P, r: 0.001 }); // clamp lever
  const arm = [[-0.0254, 0.0105], [-0.0146, 0.0105], [-0.0146, 0.0262], [-0.0062, yc - r - 0.0016], [-0.0062, yc - r + 0.001], [-0.0254, yc - r + 0.001]];
  for (const z of [-0.32, -0.279]) {
    plateXYz(b, { outline: arm, z0: z - 0.0065, z1: z + 0.0065, mat: P, bevel: 0.0006 });
    ring(b, { y: yc, z, r, w: 0.013, t: 0.0026, mat: P });
  }
  zf41(b, { y: yc, zEye: -0.215 });
}

// Gewehr 43: 7.92x57 gas-operated semi-automatic (Walther gas system: piston above
// the barrel), 1130 mm long, 546 mm barrel, 10-round detachable magazine. Hooded
// front post on the gas block at the muzzle, nose band with the sling swivel, wooden
// upper handguard over the gas cylinder, tangent rear sight 100-1200 m, milled
// receiver with the cocking handle on the left and the ZF 4 dovetail rail on the
// right, laminated stock with a semi-pistol grip, Kar98k-style sling slot and
// butt plate. Phosphated and blued. Dimensions est. from photos.
export function gewehr43(b) {
  const P = 'steel';
  const W = 'laminate';
  const MZ = -0.8;
  const FS = 0.0385,
    FZ = -0.774;
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.00396, MZ + 0.012],
      [0.00396, MZ + 0.0004],
      [0.0048, MZ],
      [0.0078, MZ],
      [0.0085, MZ + 0.001],
      [0.009, -0.68],
      [0.0098, -0.55],
      [0.0112, -0.42],
      [0.0128, -0.32],
      [0.0135, -0.262],
      [0, -0.262],
    ],
  });
  b.cyl({ z0: MZ + 0.0125, z1: MZ + 0.0115, r0: 0.0041, mat: 'black', seg: 12 });
  // --- Gas block with the front sight base, post and hood; gas cylinder above.
  b.extrude({ points: path([[-0.7925, -0.0075, 1], [-0.7925, 0.0302, 1], [-0.7565, 0.0302, 1], [-0.7565, -0.0075, 1]]), width: 0.0192, mat: P, bevel: 0.0022 });
  plateXYz(b, { outline: [[-0.0012, 0.029], [0.0012, 0.029], [0.001, 0.0352], [0.0003, FS], [-0.0003, FS], [-0.001, 0.0352]], z0: FZ - 0.0025, z1: FZ + 0.0025, mat: P, bevel: 0.0002 });
  plateXYz(b, { outline: arch(0, 0.0362, 0.0078, 0.0087, -0.4, PI + 0.4, 0.0285, b.detail(1) ? 20 : 8), z0: -0.784, z1: -0.764, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, FS, FZ);
  lathe(b, { mat: P, y: 0.0185, seg: 20, profile: [[0, -0.757], [0.0072, -0.757], [0.0088, -0.755], [0.0088, -0.33], [0, -0.33]] });
  // --- Nose band with the sling swivel (left), upper handguard over the cylinder.
  band(b, { z0: -0.612, z1: -0.592, y0: -0.0298, y1: 0.0305, w: 0.0322, n: 2.7, thick: 0.0018, mat: P });
  b.box({ x: -0.0178, y: -0.006, z: -0.602, w: 0.004, h: 0.01, d: 0.012, mat: P, r: 0.001 });
  bar(b, { pts: [[-0.0192, -0.001, -0.611], [-0.0208, -0.01, -0.614], [-0.0214, -0.017, -0.602], [-0.0208, -0.01, -0.59], [-0.0192, -0.001, -0.593]], closed: true, r: 0.0019, mat: P, seg: 8 });
  stock(b, {
    mat: W,
    z0: -0.593,
    z1: -0.345,
    top: [
      [-0.593, 0.0278],
      [-0.46, 0.0302],
      [-0.345, 0.0302],
    ],
    bottom: [
      [-0.593, 0.0028],
      [-0.345, 0.0028],
    ],
    width: [
      [-0.593, 0.0282],
      [-0.345, 0.0296],
    ],
    n: 2.4,
    wTop: 0.62,
    wBot: 1.0,
    belly: 0.22,
    rings: 28,
    roundEnd: 0.004,
    roundAnchor: 'bottom',
  });
  // --- Stock: laminated, semi-pistol grip.
  const stk = stock(b, {
    mat: W,
    z0: -0.612,
    z1: 0.3195,
    top: [
      [-0.612, 0.0025],
      [-0.345, 0.0025],
      [-0.27, 0.0],
      [-0.05, -0.006],
      [-0.012, -0.004],
      [0.008, 0.0015],
      [0.06, -0.003],
      [0.2, -0.0215],
      [0.3195, -0.0385],
    ],
    bottom: [
      [-0.612, -0.0285],
      [-0.4, -0.0352],
      [-0.3, -0.04],
      [-0.255, -0.054],
      [-0.08, -0.058],
      [0.048, -0.058],
      [0.056, -0.076],
      [0.068, -0.095],
      [0.088, -0.103],
      [0.106, -0.098],
      [0.13, -0.1005],
      [0.22, -0.1345],
      [0.3195, -0.1645],
    ],
    width: [
      [-0.612, 0.0302],
      [-0.4, 0.0335],
      [-0.27, 0.0378],
      [-0.06, 0.0405],
      [0.02, 0.0362],
      [0.08, 0.0335],
      [0.16, 0.0372],
      [0.3195, 0.0422],
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
      [-0.612, 0.0105],
      [-0.6, 0.0105],
      [-0.59, 0.0],
      [-0.345, 0.0],
      [-0.33, 0.0168],
      [-0.27, 0.0175],
      [0.012, 0.0175],
      [0.022, 0.0],
    ],
    chHalf: [
      [-0.612, 0.0095],
      [-0.59, 0.0095],
      [-0.345, 0.0138],
      [-0.27, 0.0158],
      [0.012, 0.0158],
      [0.022, 0.012],
    ],
    roundStart: 0.003,
  });
  buttPlate(b, stk, { z0: 0.3165, z1: 0.3275, mat: P, screws: [-0.052, -0.155] });
  {
    const zS = 0.19,
      yS = -0.087;
    const hs = stk.halfWidth(zS, yS);
    b.extrude({ points: slot(zS - 0.016, zS + 0.016, yS, 0.0052), width: 2 * hs + 0.0006, mat: 'black', bevel: 0.0002 });
    for (const s of [-1, 1]) b.extrude({ points: slot(zS - 0.0185, zS + 0.0185, yS, 0.0075), holes: [slot(zS - 0.016, zS + 0.016, yS, 0.0052)], width: 0.0012, x: s * (hs + 0.0003), mat: P, bevel: 0.0003 });
  }
  // --- Rear sight: tangent base at the receiver front, leaf hinged at its front.
  b.span({ z0: -0.345, z1: -0.27, y0: 0.012, y1: 0.0285, w: 0.0242, mat: P, r: 0.0025 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.343, 0.0258], [-0.29, 0.0258], [-0.2725, 0.0292], [-0.29, 0.0318], [-0.343, 0.0295]], 3), width: 0.0016, x: s * 0.0098, mat: P, bevel: 0.0003 });
  b.part('rearSight', [0, 0.03, -0.34]);
  b.span({ z0: -0.342, z1: -0.272, y0: 0.0285, y1: 0.0312, w: 0.0172, mat: P, r: 0.0006 });
  plateXYz(b, { outline: [[-0.0065, 0.0298], [0.0065, 0.0298], [0.0065, 0.0408], [0.0016, 0.0408], [0.0, 0.0385], [-0.0016, 0.0408], [-0.0065, 0.0408]], z0: -0.276, z1: -0.272, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.334, z1: -0.322, y0: 0.0278, y1: 0.0332, w: 0.0198, mat: P, r: 0.0008 }); // slider
  if (b.detail(0)) for (let i = 1; i <= 12; i++) b.box({ x: i % 2 ? 0.0026 : 0, y: 0.03132, z: -0.322 + i * 0.0036, w: i % 2 ? 0.005 : 0.0098, h: 0.0002, d: 0.00045, mat: 'black', r: 0 });
  b.anchor('rearSight', 0, 0.0385, -0.274);
  b.body();
  b.meta.sightKind = 'leaf';
  // --- Receiver with the bolt carrier slot; scope rail (right), ejection port.
  if (b.detail(1)) {
    const recv = () => {
      const K = b.detail(0) ? 5 : 2;
      const hw = 0.0156,
        yb = -0.033,
        yt = 0.0128,
        rt = 0.0062;
      const pts = [[0, yb], [hw - 0.002, yb], [hw, yb + 0.002]];
      for (let k = 0; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([hw - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]);
      }
      const left = pts.slice(1).map(([x, y]) => [-x, y]).reverse();
      return [...pts, ...left];
    };
    sectionLoft(b, { zs: [-0.272, 0.016], section: recv, mat: P });
  } else b.span({ z0: -0.272, z1: 0.016, y0: -0.033, y1: 0.0128, w: 0.0312, mat: P });
  b.extrude({ points: path([[-0.24, -0.0035, 1], [-0.12, -0.0035, 1], [-0.12, 0.0115, 1], [-0.24, 0.0115, 1]]), width: 0.0052, x: 0.0178, mat: P, bevel: 0.0008 }); // ZF 4 rail
  if (b.detail(0)) {
    b.span({ z0: -0.236, z1: -0.124, y0: 0.0108, y1: 0.0122, w: 0.0062, x: 0.0178, mat: 'black', r: 0 });
    b.box({ x: 0.0148, y: 0.0085, z: -0.165, w: 0.0016, h: 0.0075, d: 0.065, mat: 'black', r: 0.0005 }); // ejection port
  }
  b.anchor('ejectionPort', 0.016, 0.01, -0.165);
  // --- Trigger guard, trigger, magazine catch.
  guard(b, { zf: -0.055, zr: 0.05, yTop: -0.056, yBot: -0.085, t: 0.0045, w: 0.0112, mat: P, rake: 0.006 });
  trigger(b, { z: 0, yTop: -0.058, len: 0.02, curve: 0.006, mat: P });
  b.span({ z0: -0.152, z1: -0.142, y0: -0.074, y1: -0.056, w: 0.0082, mat: P, r: 0.0012 });
  // --- Bolt carrier with the cocking knob on the left.
  b.part('bolt', [0, 0, -0.1]);
  b.span({ z0: -0.235, z1: -0.1, y0: 0.0075, y1: 0.0205, w: 0.0202, mat: 'steelBright', r: 0.003 });
  b.cylAxis({ axis: 'x', x: -0.0205, y: 0.011, z: -0.205, len: 0.0125, r: 0.0042, mat: P, seg: 12 });
  knurledKnob(b, { at: [-0.0298, 0.011, -0.205], axis: 'x', r: 0.0068, len: 0.008, teeth: 18, mat: P });
  b.anchor('chargingHandle', -0.034, 0.011, -0.205);
  b.body();
  // --- 10-round magazine.
  const top = [-0.21, -0.022];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.088, depth: 0.088, width: 0.0272, mat: P, plate: 0.0062 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  sling(b, { from: [-0.0228, -0.016, -0.602], to: [-0.0245, -0.087, 0.176], sag: 0.06, width: 0.0255, mat: 'leatherBlack' });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.075, 0.078);
  b.anchor('trigger', 0, -0.068, 0.0);
  b.anchor('gripL', 0, -0.035, -0.42);
  b.anchor('shoulder', 0, -0.1, 0.327);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.09;
}

// Gewehr 43 with the ZF 4: the mount clamps the dovetail rail on the right of
// the receiver and its saddle reaches over the receiver (clear of the bolt
// carrier) to two rings, the scope centered above the action and over the
// line of the iron sights. Mount sizes est.
export function gewehr43_zf4(b) {
  gewehr43(b);
  const P = 'steel';
  const yc = 0.0625;
  b.span({ z0: -0.236, z1: -0.124, y0: -0.0065, y1: 0.0165, w: 0.0062, x: 0.0232, mat: P, r: 0.0012 }); // clamp on the rail
  b.box({ x: 0.0275, y: 0.004, z: -0.18, w: 0.0035, h: 0.007, d: 0.034, mat: P, r: 0.0012 }); // locking lever
  const saddle = [[0.0263, 0.0105], [0.0263, 0.0352], [0.0128, 0.0482], [-0.0105, 0.0482], [-0.0105, 0.0412], [0.0201, 0.0302], [0.0201, 0.0105]];
  for (const z of [-0.19, -0.13]) {
    plateXYz(b, { outline: saddle, z0: z - 0.009, z1: z + 0.009, mat: P, bevel: 0.0008 });
    ring(b, { y: yc, z, r: 0.013, w: 0.016, t: 0.0032, mat: P });
  }
  b.span({ z0: -0.182, z1: -0.138, y0: 0.0412, y1: 0.0482, w: 0.012, x: 0.004, mat: P, r: 0.0015 });
  zf4(b, { y: yc, zEye: 0.0 });
}

// MP 40: 9 mm open-bolt SMG, 833 mm long with the stock unfolded, 630 mm folded,
// 251 mm barrel with the resting bar underneath and a muzzle nut. Tubular receiver
// (blued) with the cocking handle and its safety notch on the left, ribbed
// magazine housing with the release button, phenolic (bakelite) fore-end and grip
// panels on the stamped frame, hooded front post, flip rear sight (100 m fixed
// notch, 200 m leaf) between wings, steel folding stock with a cupped butt plate,
// 32-round magazine. Positions est. from side views.
export function mp40(b) {
  const P = 'steel';
  const R = 0.0196; // receiver tube radius
  const MZ = -0.485;
  const FS = 0.0305,
    FZ = -0.4765;
  // --- Barrel with the muzzle nut, barrel nut and the resting bar.
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0045, MZ + 0.01],
      [0.0045, MZ + 0.0004],
      [0.0052, MZ],
      [0.0082, MZ],
      [0.0088, MZ + 0.001],
      [0.0088, -0.468],
      [0.0096, -0.464],
      [0.0098, -0.44],
      [0.0105, -0.34],
      [0.011, -0.3],
      [0, -0.3],
    ],
  });
  b.cyl({ z0: MZ + 0.0105, z1: MZ + 0.0095, r0: 0.0046, mat: 'black', seg: 12 });
  knurledKnob(b, { at: [0, 0, -0.2785], axis: 'z', r: 0.0168, len: 0.023, teeth: 36, depth: 0.0006, mat: P, chamfer: 0.0012 }); // barrel nut
  b.extrude({ points: path([[-0.392, -0.0105, 1], [-0.268, -0.0105, 1], [-0.268, -0.0235, 1], [-0.378, -0.0235], [-0.3815, -0.0335, 1], [-0.3935, -0.0335, 1], [-0.3935, -0.025]]), width: 0.0122, mat: P, bevel: 0.0012 });
  b.box({ x: 0, y: -0.0165, z: -0.388, w: 0.0128, h: 0.012, d: 0.012, mat: P, r: 0.0015 }); // bar clamp at the barrel
  // Front sight: base, post and tunnel hood at the muzzle.
  b.span({ z0: -0.4865, z1: -0.4665, y0: 0.0055, y1: 0.0172, w: 0.0122, mat: P, r: 0.0015 });
  plateXYz(b, { outline: [[-0.0013, 0.0168], [0.0013, 0.0168], [0.0011, 0.0262], [0.0003, FS], [-0.0003, FS], [-0.0011, 0.0262]], z0: FZ - 0.0028, z1: FZ + 0.0028, mat: P, bevel: 0.0002 });
  plateXYz(b, { outline: arch(0, 0.0242, 0.0082, 0.0092, -0.42, PI + 0.42, 0.0145, b.detail(1) ? 24 : 8), z0: -0.4865, z1: -0.4665, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, FS, FZ);

  // --- Receiver tube with the end cap; ejection port (right), cocking slot with
  // the safety notch (left).
  lathe(b, { mat: P, seg: 36, profile: [[0.0112, -0.267], [R - 0.0008, -0.267], [R, -0.2655], [R, 0.1355], [R - 0.0012, 0.137], [0.0, 0.137]] });
  lathe(b, { mat: P, seg: 32, profile: [[0, 0.1365], [R + 0.0008, 0.1365], [R + 0.0008, 0.1405], [R - 0.001, 0.146], [0.011, 0.1485], [0, 0.1488]] }); // end cap
  if (b.detail(0)) {
    b.box({ x: 0.0186, y: 0.0045, z: -0.229, w: 0.0018, h: 0.0145, d: 0.046, mat: 'black', r: 0.0005 }); // ejection port
    b.box({ x: -0.0188, y: 0.0028, z: -0.07, w: 0.0016, h: 0.0056, d: 0.29, mat: 'black', r: 0.0005 }); // cocking slot
    b.box({ x: -0.0188, y: 0.0078, z: 0.0705, w: 0.0016, h: 0.0102, d: 0.0062, mat: 'black', r: 0.0004 }); // safety notch
  }
  b.anchor('ejectionPort', 0.02, 0.004, -0.229);
  // Rear sight: base with protecting wings; the 100 m notch stands, the 200 m leaf folds.
  b.span({ z0: -0.07, z1: -0.031, y0: 0.0168, y1: 0.0232, w: 0.0198, mat: P, r: 0.0015 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.0665, 0.021], [-0.0335, 0.021], [-0.0362, 0.0345], [-0.059, 0.0335]], 2), width: 0.0021, x: s * 0.0094, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0235, -0.064]);
  b.span({ z0: -0.064, z1: -0.0405, y0: 0.0225, y1: 0.0253, w: 0.0142, mat: P, r: 0.0006 });
  plateXYz(b, { outline: [[-0.0058, 0.0242], [0.0058, 0.0242], [0.0058, 0.0328], [0.0014, 0.0328], [0, 0.0305], [-0.0014, 0.0328], [-0.0058, 0.0328]], z0: -0.0445, z1: -0.0405, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, 0.0305, -0.0425);
  b.body();
  b.meta.sightKind = 'leaf';

  // --- Magazine housing (ribbed) with the release button on the left.
  b.extrude({ points: path([[-0.2515, -0.0115, 1], [-0.1935, -0.0115, 1], [-0.1935, -0.0868, 1], [-0.2515, -0.0868, 1]]), width: 0.0296, mat: P, bevel: 0.0022 });
  b.extrude({ points: path([[-0.2535, -0.0835, 1], [-0.1915, -0.0835, 1], [-0.1915, -0.0918, 1], [-0.2535, -0.0918, 1]]), width: 0.0318, mat: P, bevel: 0.0014 });
  if (b.detail(1)) for (const z of [-0.2385, -0.2225, -0.2065]) b.extrude({ points: vslot(z, -0.078, -0.024, 0.0028), width: 0.0306, mat: P, bevel: 0.0012 });
  b.cylAxis({ axis: 'x', x: -0.0162, y: -0.0312, z: -0.2225, len: 0.0058, r: 0.0042, mat: P, seg: 16 });
  // --- Frame: phenolic fore-end under the tube, steel trigger housing and guard,
  // grip with phenolic panels.
  stock(b, {
    mat: 'bakelite',
    z0: -0.193,
    z1: 0.012,
    top: [
      [-0.193, -0.0128],
      [0.012, -0.0128],
    ],
    bottom: [
      [-0.193, -0.0375],
      [-0.12, -0.0428],
      [-0.03, -0.0442],
      [0.012, -0.0442],
    ],
    width: [
      [-0.193, 0.0262],
      [-0.12, 0.0282],
      [0.012, 0.0272],
    ],
    n: 3.2,
    wTop: 0.98,
    wBot: 0.86,
    belly: 0.55,
    chDepth: 0.004,
    chHalf: 0.0132,
    roundStart: 0.002,
  });
  b.extrude({ points: path([[0.0, -0.0125, 1], [0.142, -0.0125, 1], [0.142, -0.031, 1], [0.112, -0.0335], [0.088, -0.0405], [0.012, -0.0442, 1]]), width: 0.0256, mat: P, bevel: 0.0016 });
  guard(b, { zf: -0.036, zr: 0.03, yTop: -0.0425, yBot: -0.0715, t: 0.0042, w: 0.0108, mat: P, rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.0435, len: 0.0192, curve: 0.0052, mat: P });
  sweepGrip(b, {
    path: [
      [0.06, -0.038],
      [0.072, -0.07],
      [0.088, -0.11],
      [0.096, -0.14],
    ],
    sections: (t) => ({ w: 0.0282 + 0.002 * Math.sin(PI * t), f: 0.0165 + 0.0015 * Math.sin(PI * t), r: 0.0175 + 0.0015 * t, n: 2.7 }),
    mat: 'bakelite',
    dome: 0.08,
  });
  b.extrude({ points: S([[0.0525, -0.04], [0.0815, -0.04], [0.106, -0.104], [0.1185, -0.143], [0.111, -0.149], [0.083, -0.146], [0.064, -0.1], [0.0505, -0.06]], 3), width: 0.0158, mat: P, bevel: 0.001 }); // grip frame
  if (b.detail(0)) for (const s of [-1, 1]) screw(b, { at: [s * 0.0158, -0.092, 0.0815], axis: s > 0 ? 'x' : '-x', r: 0.0028, mat: P, slot: 0.9 });
  // --- Folding stock (extended): hinge under the receiver end, two arms, butt plate.
  b.cylAxis({ axis: 'x', x: 0, y: -0.031, z: 0.126, len: 0.042, r: 0.0058, mat: P, seg: 16 });
  b.box({ x: -0.0215, y: -0.031, z: 0.112, w: 0.004, h: 0.013, d: 0.016, mat: P, r: 0.0015 }); // release button housing
  b.part('stock', [0, -0.031, 0.126]);
  for (const s of [-1, 1]) {
    b.extrude({ points: S([[0.12, -0.026], [0.14, -0.024], [0.33, -0.036], [0.334, -0.05], [0.32, -0.052], [0.14, -0.04], [0.12, -0.038]], 2), width: 0.0062, x: s * 0.0172, mat: P, bevel: 0.0012 });
  }
  b.rod({ from: [-0.0172, -0.044, 0.25], to: [0.0172, -0.044, 0.25], r: 0.0032, mat: P });
  // Butt plate: curved steel shoulder piece.
  stock(b, {
    mat: P,
    z0: 0.327,
    z1: 0.3445,
    top: [
      [0.327, -0.016],
      [0.3445, -0.018],
    ],
    bottom: [
      [0.327, -0.122],
      [0.3445, -0.122],
    ],
    width: [
      [0.327, 0.042],
      [0.3445, 0.042],
    ],
    n: 4,
    wTop: 0.78,
    wBot: 0.78,
    belly: 0.5,
    rings: 24,
  });
  b.body();
  b.meta.stockFold = { axis: 'x', angle: -2.95 }; // folds down and forward under the gun
  // --- Cocking handle (bolt forward).
  b.part('bolt', [0, 0, -0.2]);
  b.cylAxis({ axis: 'x', x: -0.0225, y: 0.0028, z: -0.205, len: 0.0105, r: 0.0034, mat: P, seg: 12 });
  b.sphere({ x: -0.0315, y: 0.0028, z: -0.205, r: 0.0064, mat: P, sx: 0.85, seg: 16 });
  b.anchor('chargingHandle', -0.0355, 0.0028, -0.205);
  b.body();
  // --- 32-round magazine.
  const top = [-0.2225, -0.012];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.248, depth: 0.0345, width: 0.0225, mat: P, plate: 0.006 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -1, 0];

  stamp(b, { name: 'mp40Top', at: [0, R, 0.075], r: R, w: 0.014, h: 0.02 });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.082, 0.078);
  b.anchor('trigger', 0, -0.054, 0.0);
  b.anchor('gripL', 0, -0.062, -0.222);
  b.anchor('shoulder', 0, -0.07, 0.344);
  b.meta.gripRake = 0.34; // grip axis from vertical (rad)
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// MP 34 (Steyr-Solothurn S1-100): 9 mm SMG with a wooden rifle-type stock, 850 mm
// long, 200 mm barrel inside a perforated jacket with the front sight at its nose,
// tangent rear sight 50-500 m, receiver with the hinged top cover, 32-round
// magazine inserted from the LEFT through a housing with the stripper-clip guide,
// fire selector on the left of the stock, cocking handle on the right, sling
// swivels underneath. Finely blued. Dimensions est. from photos.
export function mp34(b) {
  const P = 'steel';
  const W = 'walnut';
  const FS = 0.0315,
    FZ = -0.51;
  b.cyl({ z0: -0.515, z1: -0.205, r0: 0.0092, mat: P, seg: 16 });
  perfTube(b, { z0: -0.505, z1: -0.215, r: 0.0168, mat: 'perforated', seg: 30 });
  lathe(b, { mat: P, seg: 28, profile: [[0.0062, -0.52], [0.012, -0.52], [0.0178, -0.512], [0.0178, -0.5], [0.0062, -0.5]] });
  tube(b, { z0: -0.225, z1: -0.205, rIn: 0.009, rOut: 0.0182, mat: P, seg: 28 });
  b.span({ z0: -0.518, z1: -0.502, y0: 0.012, y1: 0.0222, w: 0.0102, mat: P, r: 0.0015 });
  plateXYz(b, { outline: [[-0.0011, 0.0215], [0.0011, 0.0215], [0.001, 0.0292], [0.0003, FS], [-0.0003, FS], [-0.001, 0.0292]], z0: FZ - 0.0025, z1: FZ + 0.0025, mat: P, bevel: 0.0002 });
  b.anchor('frontSight', 0, FS, FZ);
  // --- Receiver with the hinged top cover; ejection port (right).
  b.span({ z0: -0.21, z1: 0.05, y0: -0.022, y1: 0.017, w: 0.0322, mat: P, r: 0.004 });
  b.span({ z0: -0.12, z1: 0.045, y0: 0.012, y1: 0.0212, w: 0.0282, mat: P, r: 0.003 });
  if (b.detail(0)) {
    b.cylAxis({ axis: 'x', x: 0, y: 0.0168, z: -0.118, len: 0.03, r: 0.0022, mat: P, seg: 10 }); // cover hinge
    b.span({ z0: -0.105, z1: -0.055, y0: -0.004, y1: 0.01, w: 0.0016, x: 0.0161, mat: 'black', r: 0.0005 });
  }
  b.anchor('ejectionPort', 0.017, 0.003, -0.08);
  // --- Tangent rear sight on the receiver front.
  b.span({ z0: -0.205, z1: -0.15, y0: 0.014, y1: 0.0225, w: 0.0222, mat: P, r: 0.002 });
  b.part('rearSight', [0, 0.023, -0.2]);
  b.span({ z0: -0.2, z1: -0.152, y0: 0.0215, y1: 0.0245, w: 0.0162, mat: P, r: 0.0007 });
  plateXYz(b, { outline: [[-0.0058, 0.023], [0.0058, 0.023], [0.0058, 0.0338], [0.0014, 0.0338], [0, 0.0315], [-0.0014, 0.0338], [-0.0058, 0.0338]], z0: -0.156, z1: -0.152, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.194, z1: -0.185, y0: 0.0205, y1: 0.0255, w: 0.0192, mat: P, r: 0.0008 });
  b.anchor('rearSight', 0, 0.0315, -0.154);
  b.body();
  b.meta.sightKind = 'leaf';
  // --- Magazine housing on the left with the stripper-clip loading guide.
  b.span({ z0: -0.172, z1: -0.118, y0: -0.019, y1: 0.016, w: 0.0302, x: -0.028, mat: P, r: 0.003 });
  b.span({ z0: -0.165, z1: -0.125, y0: 0.016, y1: 0.022, w: 0.0202, x: -0.03, mat: P, r: 0.0015 });
  // --- Wooden stock: fore-end under the receiver, semi-pistol grip, butt.
  const stk = stock(b, {
    mat: W,
    z0: -0.235,
    z1: 0.3255,
    top: [
      [-0.235, -0.012],
      [0.05, -0.012],
      [0.07, 0.006],
      [0.12, 0.002],
      [0.25, -0.018],
      [0.3255, -0.03],
    ],
    bottom: [
      [-0.235, -0.038],
      [-0.2, -0.045],
      [-0.04, -0.048],
      [0.05, -0.048],
      [0.056, -0.07],
      [0.07, -0.088],
      [0.09, -0.094],
      [0.11, -0.089],
      [0.13, -0.09],
      [0.23, -0.12],
      [0.3255, -0.15],
    ],
    width: [
      [-0.235, 0.0372],
      [0.0, 0.0372],
      [0.08, 0.0322],
      [0.14, 0.0342],
      [0.3255, 0.0402],
    ],
    n: [
      [-0.2, 3.0],
      [0.03, 2.8],
      [0.09, 2.2],
      [0.2, 2.9],
      [0.32, 3.3],
    ],
    wTop: [
      [-0.2, 0.92],
      [0.1, 0.8],
      [0.32, 0.72],
    ],
    wBot: 0.84,
    belly: 0.52,
    roundStart: 0.004,
  });
  buttPlate(b, stk, { z0: 0.3225, z1: 0.3335, mat: P, screws: [-0.042, -0.14] });
  for (const z of [-0.2, 0.2]) {
    const ys = stk.bottom(z);
    b.box({ x: 0, y: ys - 0.001, z, w: 0.012, h: 0.003, d: 0.024, mat: P, r: 0.001 });
    bar(b, { pts: [[0, ys - 0.002, z - 0.01], [0, ys - 0.012, z - 0.005], [0, ys - 0.014, z + 0.006], [0, ys - 0.005, z + 0.01]], closed: true, r: 0.002, mat: P, seg: 8 });
  }
  guard(b, { zf: -0.045, zr: 0.048, yTop: -0.046, yBot: -0.075, t: 0.0045, w: 0.0112, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.047, len: 0.02, curve: 0.006, mat: P });
  b.box({ x: -0.0195, y: -0.03, z: -0.03, w: 0.003, h: 0.007, d: 0.016, mat: P, r: 0.001 }); // fire selector
  // --- Cocking handle on the right (bolt forward).
  b.part('bolt', [0, 0, -0.06]);
  b.span({ z0: -0.07, z1: -0.05, y0: -0.004, y1: 0.004, w: 0.004, x: 0.0175, mat: P, r: 0.001 });
  knurledKnob(b, { at: [0.024, 0.0, -0.06], axis: 'x', r: 0.0055, len: 0.01, teeth: 16, mat: P });
  b.anchor('chargingHandle', 0.029, 0.0, -0.06);
  b.body();
  // --- 32-round magazine sticking out to the left (built hanging, turned left).
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

// StG 44 (MP 43/44): 7.92x33 Kurz assault rifle, 940 mm long, 419 mm barrel.
// Stamped receiver with the gas piston above the bolt and the cylinder running
// forward to the gas block (front sight post under its hood, sling loop); tangent
// rear sight 100-800 m on the cylinder's rear end; cocking handle on the left,
// ejection port with its spring dust cover on the right; hinged stamped trigger
// housing with the grip, selector button and safety lever; wooden butt with the
// steel cap and butt plate; 30-round curved magazine. Phosphated and lacquered.
// Dimensions est. from side views.
export function stg44(b) {
  const P = 'phosphate';
  const MZ = -0.578;
  const FS = 0.0455,
    FZ = -0.535;
  // --- Barrel with the muzzle thread protector.
  lathe(b, {
    mat: P,
    seg: 28,
    profile: [
      [0.0041, MZ + 0.012],
      [0.0041, MZ + 0.0004],
      [0.005, MZ],
      [0.0093, MZ],
      [0.0102, MZ + 0.001],
      [0.0102, -0.5595],
      [0.0088, -0.5585],
      [0.0088, -0.548],
      [0.0095, -0.45],
      [0.011, -0.3],
      [0.0118, -0.205],
      [0, -0.205],
    ],
  });
  b.cyl({ z0: MZ + 0.0125, z1: MZ + 0.0115, r0: 0.0042, mat: 'black', seg: 12 });
  if (b.detail(0)) for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2;
    b.box({ x: Math.cos(a) * 0.0101, y: Math.sin(a) * 0.0101, z: -0.569, w: 0.0008, h: 0.0008, d: 0.0165, mat: P, r: 0, rz: a });
  }
  // --- Gas block: front sight base with the hooded post, sling loop on the left.
  b.extrude({ points: path([[-0.5485, -0.0115, 1], [-0.5485, 0.0305, 1], [-0.515, 0.0305, 1], [-0.515, -0.0115, 1]]), width: 0.0208, mat: P, bevel: 0.0022 });
  b.span({ z0: -0.5465, z1: -0.5235, y0: 0.029, y1: 0.0368, w: 0.0128, mat: P, r: 0.0015 });
  plateXYz(b, { outline: [[-0.0012, 0.0362], [0.0012, 0.0362], [0.001, 0.0425], [0.0003, FS], [-0.0003, FS], [-0.001, 0.0425]], z0: FZ - 0.0025, z1: FZ + 0.0025, mat: P, bevel: 0.0002 });
  plateXYz(b, { outline: arch(0, 0.0432, 0.0078, 0.0088, -0.4, PI + 0.4, 0.0352, b.detail(1) ? 20 : 8), z0: -0.545, z1: -0.525, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, FS, FZ);
  b.box({ x: -0.0118, y: 0.0035, z: -0.532, w: 0.0035, h: 0.012, d: 0.014, mat: P, r: 0.0012 });
  bar(b, { pts: [[-0.0135, 0.0, -0.541], [-0.0152, -0.0085, -0.544], [-0.0158, -0.0155, -0.532], [-0.0152, -0.0085, -0.52], [-0.0135, 0.0, -0.523]], closed: true, r: 0.002, mat: P, seg: 8 });
  // --- Gas cylinder over the barrel with its front cap and vent holes.
  lathe(b, { mat: P, y: 0.0185, seg: 24, profile: [[0, -0.5195], [0.0098, -0.5195], [0.0118, -0.5175], [0.0118, -0.205], [0.0, -0.205]] });
  if (b.detail(0)) for (const z of [-0.497, -0.467, -0.437]) for (const s of [-1, 1]) b.cylAxis({ axis: 'x', x: s * 0.0115, y: 0.0185, z, len: 0.0012, r: 0.0024, mat: 'black', seg: 10 });
  // --- Rear sight: base on the cylinder's rear end, leaf hinged at its front.
  b.span({ z0: -0.231, z1: -0.168, y0: 0.0225, y1: 0.0345, w: 0.0242, mat: P, r: 0.0025 });
  for (const s of [-1, 1]) b.extrude({ points: S([[-0.2295, 0.031], [-0.18, 0.031], [-0.1715, 0.0355], [-0.185, 0.0378], [-0.2295, 0.0352]], 3), width: 0.0016, x: s * 0.0098, mat: P, bevel: 0.0003 });
  b.part('rearSight', [0, 0.035, -0.226]);
  b.span({ z0: -0.228, z1: -0.1705, y0: 0.0335, y1: 0.0362, w: 0.0168, mat: P, r: 0.0006 });
  plateXYz(b, { outline: [[-0.0065, 0.0352], [0.0065, 0.0352], [0.0065, 0.0478], [0.0016, 0.0478], [0.0, 0.0455], [-0.0016, 0.0478], [-0.0065, 0.0478]], z0: -0.1745, z1: -0.1705, mat: P, bevel: 0.0003 });
  b.span({ z0: -0.215, z1: -0.204, y0: 0.0328, y1: 0.0382, w: 0.0198, mat: P, r: 0.0008 }); // slider
  if (b.detail(0)) for (let i = 1; i <= 8; i++) b.box({ x: 0, y: 0.0363, z: -0.204 + i * 0.0035, w: i % 2 ? 0.006 : 0.011, h: 0.0002, d: 0.00045, mat: 'black', r: 0 });
  b.anchor('rearSight', 0, 0.0455, -0.172);
  b.body();
  b.meta.sightKind = 'leaf';

  // --- Stamped receiver: piston housing above the bolt, ribbed sides, dust cover.
  const recv = (z) => {
    const K = b.detail(0) ? 6 : 2;
    const hw = 0.0156,
      yb = -0.0205,
      yt = 0.031;
    const pts = [[0, yb]];
    for (let k = 0; k <= K; k++) {
      const a = -PI / 2 + (k / K) * (PI / 2);
      pts.push([hw - 0.003 + Math.cos(a) * 0.003, yb + 0.003 + Math.sin(a) * 0.003]);
    }
    pts.push([hw, 0.012]);
    for (let k = 0; k <= K; k++) {
      const a = (k / K) * (PI / 2);
      pts.push([hw - 0.0118 + Math.cos(a) * 0.0118, yt - 0.0118 + Math.sin(a) * 0.0118]);
    }
    const left = pts.slice(1).map(([x, y]) => [-x, y]).reverse();
    return [...pts, ...left];
  };
  sectionLoft(b, { zs: [-0.205, -0.203, 0.0965, 0.0985], section: (z) => (z < -0.204 || z > 0.0975 ? recv(z).map(([x, y]) => [x * 0.93, 0.0052 + (y - 0.0052) * 0.95]) : recv(z)), mat: P });
  if (b.detail(1))
    for (const s of [-1, 1]) {
      b.box({ x: s * 0.0157, y: -0.0128, z: -0.055, w: 0.0016, h: 0.0028, d: 0.27, mat: P, r: 0.0008 }); // pressed rib
      b.box({ x: s * 0.0156, y: 0.0165, z: -0.03, w: 0.0016, h: 0.0024, d: 0.19, mat: P, r: 0.0008 });
    }
  // Dust cover over the ejection port (right), cocking slot (left).
  b.extrude({ points: path([[-0.152, -0.0045, 1], [-0.088, -0.0045, 1], [-0.088, 0.0122, 1], [-0.152, 0.0122, 1]]), width: 0.0012, x: 0.0162, mat: P, bevel: 0.0004 });
  if (b.detail(0)) {
    b.cylAxis({ axis: 'z', x: 0.0168, y: -0.0045, z: -0.12, len: 0.066, r: 0.0011, mat: P, seg: 8 });
    b.box({ x: -0.0156, y: 0.0185, z: -0.08, w: 0.0016, h: 0.005, d: 0.17, mat: 'black', r: 0.0005 });
  }
  b.anchor('ejectionPort', 0.017, 0.004, -0.12);

  // --- Trigger housing: magazine well, guard, grip with plates, controls.
  b.extrude({
    points: path([
      [-0.132, -0.0205, 1],
      [0.072, -0.0205, 1],
      [0.072, -0.0335, 1],
      [0.03, -0.0335],
      [-0.068, -0.0335, 1],
      [-0.068, -0.068, 1],
      [-0.132, -0.068, 1],
    ]),
    width: 0.0302,
    mat: P,
    bevel: 0.0016,
  });
  b.span({ z0: -0.1335, z1: -0.0665, y0: -0.0705, y1: -0.0655, w: 0.0335, mat: P, r: 0.0012 }); // well lip
  b.cylAxis({ axis: 'x', x: 0, y: -0.025, z: -0.126, len: 0.034, r: 0.0032, mat: P, seg: 12 }); // hinge pin
  b.cylAxis({ axis: 'x', x: -0.0162, y: -0.052, z: -0.074, len: 0.0045, r: 0.0042, mat: P, seg: 14 }); // magazine release
  guard(b, { zf: -0.043, zr: 0.03, yTop: -0.032, yBot: -0.064, t: 0.0042, w: 0.0112, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.033, len: 0.019, curve: 0.005, mat: P });
  b.extrude({ points: S([[0.026, -0.03], [0.072, -0.03], [0.084, -0.06], [0.106, -0.124], [0.098, -0.138], [0.072, -0.136], [0.058, -0.1], [0.042, -0.06]], 3), width: 0.0262, mat: P, bevel: 0.004 });
  b.extrude({ points: S([[0.041, -0.041], [0.0725, -0.039], [0.0955, -0.118], [0.0895, -0.128], [0.0735, -0.127], [0.0525, -0.071]], 3), width: 0.0312, mat: 'bakelite', bevel: 0.0055 });
  b.cylAxis({ axis: 'x', x: 0, y: -0.026, z: -0.016, len: 0.0338, r: 0.0033, mat: P, seg: 12 }); // selector button
  b.box({ x: -0.0165, y: -0.026, z: 0.012, w: 0.003, h: 0.008, d: 0.018, mat: P, r: 0.001, rx: 0.3 }); // safety lever
  // --- Butt: steel cap on the receiver's end, wooden stock, butt plate.
  b.extrude({ points: path([[0.092, -0.022, 1], [0.114, -0.024, 1], [0.114, 0.0305, 1], [0.092, 0.0315, 1]]), width: 0.0342, mat: P, bevel: 0.002 });
  const stk = stock(b, {
    mat: 'beech',
    z0: 0.112,
    z1: 0.355,
    top: [
      [0.112, 0.0298],
      [0.2, 0.021],
      [0.355, 0.006],
    ],
    bottom: [
      [0.112, -0.0232],
      [0.15, -0.054],
      [0.25, -0.098],
      [0.355, -0.131],
    ],
    width: [
      [0.112, 0.0312],
      [0.2, 0.0345],
      [0.355, 0.0365],
    ],
    n: [
      [0.112, 3.6],
      [0.2, 3.0],
      [0.35, 3.4],
    ],
    wTop: 0.78,
    wBot: 0.82,
    belly: 0.5,
  });
  buttPlate(b, stk, { z0: 0.352, z1: 0.3635, mat: P, screws: [-0.004, -0.12] });
  {
    const zs = 0.262,
      ys = -0.05;
    const hw = stk.halfWidth(zs, ys);
    b.box({ x: -hw - 0.001, y: ys, z: zs, w: 0.003, h: 0.01, d: 0.022, mat: P, r: 0.001 });
    bar(b, { pts: [[-hw - 0.002, ys + 0.003, zs - 0.011], [-hw - 0.004, ys - 0.004, zs - 0.015], [-hw - 0.005, ys - 0.011, zs], [-hw - 0.004, ys - 0.004, zs + 0.015], [-hw - 0.002, ys + 0.003, zs + 0.011]], closed: true, r: 0.0019, mat: P, seg: 8 });
  }
  // --- Cocking handle on the left (piston and bolt carrier forward).
  b.part('bolt', [0, 0.02, -0.175]);
  b.cylAxis({ axis: 'x', x: -0.0205, y: 0.0185, z: -0.175, len: 0.01, r: 0.0034, mat: P, seg: 12 });
  b.sphere({ x: -0.0285, y: 0.0185, z: -0.175, r: 0.0058, mat: P, seg: 16, sx: 0.85 });
  b.anchor('chargingHandle', -0.0325, 0.0185, -0.175);
  b.body();
  // --- 30-round curved magazine with pressed ribs.
  const top = [-0.1, -0.022];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.245, depth: 0.0505, width: 0.0262, angle: 0.06, k: 1.55, mat: P, plate: 0.0065 });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.998, -0.06];

  sling(b, { from: [-0.017, -0.016, -0.532], to: [-0.0232, -0.062, 0.262], sag: 0.05, width: 0.0245, mat: 'leatherBlack' });

  stamp(b, { name: 'stg44Top', at: [-0.0157, 0.004, 0.05], axis: '-x', w: 0.026, h: 0.0128 });

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.075, 0.07);
  b.anchor('trigger', 0, -0.044, 0.0);
  b.anchor('gripL', 0, -0.075, -0.105);
  b.anchor('shoulder', 0, -0.06, 0.364);
  b.meta.gripRake = 0.38; // grip axis from vertical (rad)
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

// MG 42: 7.92x57 belt-fed GPMG, 1220 mm long, 533 mm barrel. Stamped square-section
// barrel jacket with rows of oval cooling holes and the long barrel-change opening
// on the right, recoil booster cone at the muzzle, folding front post on the jacket
// front, bipod at the jacket front; stamped receiver with pressed ribs, feed cover
// hinged at its front, tangent rear sight 200-2000 m on a raised base, cocking
// handle on the right; bakelite grip and butt; 50-round belt drum on the left.
// Phosphated and black lacquered. Dimensions est. from photos.
export function mg42(b) {
  const P = 'phosphate';
  const JH = 0.0262; // jacket half-size (square with round corners)
  // --- Barrel inside the jacket.
  b.cyl({ z0: -0.745, z1: -0.205, r0: 0.0118, r1: 0.0138, mat: 'steel', seg: 18 });
  // Jacket: rounded-square perforated tube, open on the right for the barrel change.
  {
    const M = b.detail(1) ? 40 : 12;
    const sq = (gap) => {
      const pts = [];
      for (let j = 0; j <= M; j++) {
        // Angle around, skipping the barrel-change gap on the right (+x) if gap.
        const a0 = gap ? 0.55 : 0,
          a1 = gap ? PI * 2 - 0.55 : PI * 2;
        const a = a0 + ((a1 - a0) * j) / M;
        const c = Math.cos(a),
          s = Math.sin(a);
        const k = 3.2;
        pts.push([JH * Math.sign(c) * Math.abs(c) ** (2 / k), JH * Math.sign(s) * Math.abs(s) ** (2 / k)]);
      }
      return pts;
    };
    // A single perforated sheet (the material is two-sided); the middle part is
    // open on the right for the barrel change.
    sectionLoft(b, { zs: [-0.722, -0.598], section: () => sq(false).slice(0, M), mat: 'perforatedPhosphate', capStart: false, capEnd: false });
    sectionLoft(b, { zs: [-0.598, -0.218], section: () => sq(true), mat: 'perforatedPhosphate', openRing: true });
    // Solid end rings of the jacket.
    for (const [z0, z1] of [
      [-0.742, -0.722],
      [-0.218, -0.2],
    ])
      plateXYz(b, { outline: superellipse(0, 0, JH * 2 + 0.0012, JH * 2 + 0.0012, 3.2, M), holes: [circle(0, 0, 0.0125, b.detail(1) ? 20 : 8)], z0, z1, mat: P, bevel: 0.001 });
    // Stiffening edges along the barrel-change opening.
    for (const a of [0.55, -0.55]) {
      const c = Math.cos(a),
        s = Math.sin(a);
      b.box({ x: JH * Math.sign(c) * Math.abs(c) ** (2 / 3.2) - 0.0008, y: JH * Math.sign(s) * Math.abs(s) ** (2 / 3.2), z: -0.408, w: 0.0026, h: 0.0035, d: 0.38, mat: P, r: 0.0008 });
    }
  }
  // Recoil booster and flash cone at the muzzle.
  lathe(b, { mat: P, seg: 28, profile: [[0.0085, -0.862], [0.0125, -0.862], [0.0162, -0.852], [0.0178, -0.8], [0.0236, -0.775], [0.0242, -0.742], [0.0085, -0.742]] });
  if (b.detail(1)) b.cyl({ z0: -0.8625, z1: -0.835, r0: 0.0092, r1: 0.0078, mat: 'black', seg: 20, open: true });
  if (b.detail(0)) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + 0.3;
    b.box({ x: Math.cos(a) * 0.0232, y: Math.sin(a) * 0.0232, z: -0.758, w: 0.0012, h: 0.006, d: 0.024, mat: 'black', r: 0, rz: a });
  }
  // Folding front post on the jacket front.
  b.span({ z0: -0.735, z1: -0.717, y0: 0.0245, y1: 0.0345, w: 0.0142, mat: P, r: 0.002 });
  plateXYz(b, { outline: [[-0.0016, 0.032], [0.0016, 0.032], [0.0014, 0.064], [0.0004, 0.0675], [-0.0004, 0.0675], [-0.0014, 0.064]], z0: -0.7285, z1: -0.7235, mat: P, bevel: 0.0003 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.0325, z: -0.726, len: 0.0155, r: 0.0022, mat: P, seg: 10 });
  b.anchor('frontSight', 0, 0.0675, -0.726);

  // --- Receiver: stamped box, tall at the feed, pressed ribs, cocking slot (right).
  b.extrude({ points: path([[-0.205, -0.044, 1], [-0.205, 0.033, 1], [0.028, 0.033], [0.05, 0.0252, 1], [0.112, 0.0252, 1], [0.112, -0.044, 1]]), width: 0.0502, mat: P, bevel: 0.0035 });
  if (b.detail(1))
    for (const s of [-1, 1]) {
      b.span({ z0: -0.195, z1: 0.105, y0: -0.032, y1: -0.0265, w: 0.0016, x: s * 0.0253, mat: P, r: 0.0007 });
      b.span({ z0: 0.035, z1: 0.105, y0: 0.008, y1: 0.0135, w: 0.0016, x: s * 0.0253, mat: P, r: 0.0007 });
      if (b.detail(0)) for (const z of [-0.18, -0.05, 0.09]) for (const y of [-0.036, 0.018]) b.cylAxis({ axis: 'x', x: s * 0.0253, y, z, len: 0.0012, r: 0.0022, mat: P, seg: 10 }); // rivets
    }
  if (b.detail(0)) b.box({ x: 0.0254, y: -0.006, z: -0.09, w: 0.0016, h: 0.0075, d: 0.12, mat: 'black', r: 0.0006 });
  b.span({ z0: -0.12, z1: -0.04, y0: 0.026, y1: 0.034, w: 0.03, x: -0.035, mat: P, r: 0.002 }); // feed tray (left)
  b.anchor('ejectionPort', 0, -0.046, -0.08); // empties drop out underneath
  // Rear sight: raised base, long tangent leaf hinged at its front end.
  b.extrude({ points: path([[-0.222, 0.031, 1], [-0.16, 0.031, 1], [-0.164, 0.052], [-0.208, 0.06], [-0.222, 0.06, 1]]), width: 0.0262, mat: P, bevel: 0.002 });
  b.part('rearSight', [0, 0.0615, -0.216]);
  b.span({ z0: -0.218, z1: -0.162, y0: 0.06, y1: 0.0628, w: 0.0162, mat: P, r: 0.0007 });
  b.span({ z0: -0.192, z1: -0.18, y0: 0.0592, y1: 0.0658, w: 0.0198, mat: P, r: 0.0008 }); // slider
  plateXYz(b, { outline: [[-0.0068, 0.0615], [0.0068, 0.0615], [0.0068, 0.0705], [0.0016, 0.0705], [0, 0.0675], [-0.0016, 0.0705], [-0.0068, 0.0705]], z0: -0.166, z1: -0.162, mat: P, bevel: 0.0003 });
  if (b.detail(0)) for (let i = 0; i < 12; i++) b.box({ x: i % 2 ? 0.0028 : 0, y: 0.0629, z: -0.178 + i * 0.0012, w: i % 2 ? 0.0052 : 0.01, h: 0.0002, d: 0.0004, mat: 'black', r: 0 });
  b.anchor('rearSight', 0, 0.0675, -0.164);
  b.body();
  b.meta.sightKind = 'leaf';
  // Feed cover, hinged at its front end behind the rear sight.
  b.part('cover', [0, 0.04, -0.162]);
  b.extrude({ points: S([[-0.165, 0.032], [-0.16, 0.048], [-0.12, 0.0545], [-0.03, 0.0545], [0.012, 0.0505], [0.018, 0.032]], 4), width: 0.0502, mat: P, bevel: 0.004 });
  if (b.detail(1)) for (const z of [-0.12, -0.08, -0.04]) b.span({ z0: z - 0.004, z1: z + 0.004, y0: 0.0535, y1: 0.0562, w: 0.034, mat: P, r: 0.001 }); // pressed ribs
  b.cylAxis({ axis: 'x', x: 0, y: 0.04, z: -0.162, len: 0.054, r: 0.0042, mat: P, seg: 14 });
  b.span({ z0: 0.005, z1: 0.02, y0: 0.044, y1: 0.055, w: 0.02, mat: P, r: 0.002 }); // cover latch
  b.body();
  b.anchor('coverHinge', 0, 0.04, -0.162);
  // --- Trigger housing, guard, bakelite grip.
  b.span({ z0: -0.05, z1: 0.085, y0: -0.0565, y1: -0.04, w: 0.0322, mat: P, r: 0.003 });
  guard(b, { zf: -0.038, zr: 0.03, yTop: -0.052, yBot: -0.082, t: 0.0045, w: 0.0122, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.053, len: 0.02, curve: 0.006, mat: P });
  sweepGrip(b, {
    path: [
      [0.05, -0.05],
      [0.065, -0.085],
      [0.085, -0.13],
      [0.093, -0.152],
    ],
    sections: (t) => ({ w: 0.0302 + 0.003 * Math.sin(PI * t), f: 0.0175 + 0.002 * Math.sin(PI * t), r: 0.0185 + 0.0015 * t, n: 2.7 }),
    mat: 'bakeliteBlack',
    dome: 0.08,
  });
  // --- Bakelite butt stock with the steel butt plate.
  const stk = stock(b, {
    mat: 'bakeliteBlack',
    z0: 0.11,
    z1: 0.358,
    top: [
      [0.11, 0.0295],
      [0.25, 0.0238],
      [0.358, 0.0182],
    ],
    bottom: [
      [0.11, -0.0438],
      [0.15, -0.0618],
      [0.2, -0.0698],
      [0.27, -0.078],
      [0.31, -0.108],
      [0.358, -0.1182],
    ],
    width: [
      [0.11, 0.0332],
      [0.2, 0.0372],
      [0.358, 0.0402],
    ],
    n: 3.2,
    wTop: 0.82,
    wBot: 0.84,
    belly: 0.5,
    roundStart: 0.002,
  });
  buttPlate(b, stk, { z0: 0.355, z1: 0.3665, mat: P, screws: [] });
  b.span({ z0: 0.096, z1: 0.118, y0: -0.0452, y1: 0.0312, w: 0.0402, mat: P, r: 0.003 }); // buffer housing
  // --- Bipod at the front of the jacket (deployed).
  b.part('bipod', [0, -0.024, -0.692]);
  plateXYz(b, { outline: superellipse(0, 0, JH * 2 + 0.0085, JH * 2 + 0.0085, 3.2, b.detail(1) ? 32 : 10), holes: [superellipse(0, 0, JH * 2 + 0.001, JH * 2 + 0.001, 3.2, b.detail(1) ? 32 : 10)], z0: -0.702, z1: -0.682, mat: P, bevel: 0.0008 });
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.014, y: -0.032, z: -0.692, w: 0.012, h: 0.012, d: 0.018, mat: P, r: 0.002 });
    b.rod({ from: [s * 0.014, -0.034, -0.692], to: [s * 0.12, -0.31, -0.72], r: 0.0058, r1: 0.0048, mat: P });
    b.box({ x: s * 0.122, y: -0.315, z: -0.72, w: 0.02, h: 0.007, d: 0.034, mat: P, r: 0.002 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2; // legs fold back along the jacket
  // --- Cocking handle on the right (forward).
  b.part('bolt', [0, 0, -0.11]);
  b.span({ z0: -0.122, z1: -0.098, y0: -0.012, y1: 0.0, w: 0.0062, x: 0.028, mat: P, r: 0.0015 });
  b.cylAxis({ axis: 'x', x: 0.0365, y: -0.006, z: -0.11, len: 0.012, r: 0.0056, mat: P, seg: 16 });
  b.anchor('chargingHandle', 0.042, -0.006, -0.11);
  b.body();
  // --- 50-round belt drum on the left.
  b.part('mag', [-0.1, -0.034, -0.085]);
  beltDrum(b, { x: -0.1, y: -0.034, z: -0.085, feedY: 0.031 });
  b.body();
  b.anchor('magWell', -0.03, 0.031, -0.085);
  b.meta.magAxis = [-1, 0, 0];
  b.meta.belt = true;

  b.anchor('muzzle', 0, 0, -0.862);
  b.anchor('gripR', 0, -0.098, 0.074);
  b.anchor('trigger', 0, -0.064, 0.0);
  b.anchor('gripL', 0, -0.05, 0.25); // under the butt (bipod fire)
  b.anchor('shoulder', 0, -0.05, 0.366);
  b.meta.gripRake = 0.4; // grip axis from vertical (rad)
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// MG 34: 7.92x57 GPMG, 1219 mm long, 627 mm barrel. Round receiver, round perforated
// jacket with the conical muzzle booster, folding front post, bipod near the jacket
// front, saddle-shaped feed cover hinged at the front, double-crescent trigger (top
// semi, bottom automatic), bakelite grip and butt, 50-round belt drum on the left.
// Blued. Dimensions est. from photos.
export function mg34(b) {
  const P = 'steel';
  b.cyl({ z0: -0.74, z1: -0.2, r0: 0.0112, r1: 0.013, mat: P, seg: 18 });
  perfTube(b, { z0: -0.72, z1: -0.21, r: 0.0245, mat: 'perforated', seg: 36 });
  tube(b, { z0: -0.732, z1: -0.712, rIn: 0.011, rOut: 0.0255, mat: P, seg: 32 });
  tube(b, { z0: -0.222, z1: -0.2, rIn: 0.012, rOut: 0.0258, mat: P, seg: 32 });
  lathe(b, { mat: P, seg: 28, profile: [[0.0075, -0.84], [0.0122, -0.84], [0.0158, -0.833], [0.0148, -0.81], [0.0175, -0.775], [0.021, -0.745], [0.021, -0.732], [0.0075, -0.732]] });
  if (b.detail(1)) b.cyl({ z0: -0.8405, z1: -0.82, r0: 0.0085, r1: 0.0075, mat: 'black', seg: 18, open: true });
  // Folding front post.
  b.span({ z0: -0.73, z1: -0.714, y0: 0.022, y1: 0.031, w: 0.0132, mat: P, r: 0.002 });
  plateXYz(b, { outline: [[-0.0015, 0.0295], [0.0015, 0.0295], [0.0013, 0.058], [0.0004, 0.0615], [-0.0004, 0.0615], [-0.0013, 0.058]], z0: -0.7245, z1: -0.7195, mat: P, bevel: 0.0003 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.03, z: -0.722, len: 0.0145, r: 0.002, mat: P, seg: 10 });
  b.anchor('frontSight', 0, 0.0615, -0.722);
  // --- Round receiver with the buffer cap; feed tray on the left.
  lathe(b, { mat: P, seg: 36, profile: [[0.012, -0.21], [0.0248, -0.21], [0.0255, -0.208], [0.0255, 0.088], [0.0, 0.088]] });
  lathe(b, { mat: P, seg: 32, profile: [[0, 0.088], [0.0262, 0.088], [0.0262, 0.092], [0.0235, 0.1], [0.016, 0.104], [0, 0.104]] });
  b.span({ z0: -0.12, z1: -0.04, y0: 0.022, y1: 0.03, w: 0.0302, x: -0.034, mat: P, r: 0.002 });
  b.anchor('ejectionPort', 0, -0.026, -0.08);
  // Rear sight: raised base at the receiver front, leaf hinged at its front.
  b.extrude({ points: path([[-0.224, 0.02, 1], [-0.162, 0.02, 1], [-0.166, 0.046], [-0.21, 0.054], [-0.224, 0.054, 1]]), width: 0.0242, mat: P, bevel: 0.002 });
  b.part('rearSight', [0, 0.0555, -0.218]);
  b.span({ z0: -0.22, z1: -0.164, y0: 0.054, y1: 0.0568, w: 0.0152, mat: P, r: 0.0007 });
  b.span({ z0: -0.194, z1: -0.182, y0: 0.0532, y1: 0.0598, w: 0.0182, mat: P, r: 0.0007 });
  plateXYz(b, { outline: [[-0.0062, 0.0555], [0.0062, 0.0555], [0.0062, 0.0645], [0.0015, 0.0645], [0, 0.0615], [-0.0015, 0.0645], [-0.0062, 0.0645]], z0: -0.168, z1: -0.164, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, 0.0615, -0.166);
  b.body();
  b.meta.sightKind = 'leaf';
  // Saddle-shaped feed cover (hump over the feed arm, dip, raised latch end).
  b.part('cover', [0, 0.032, -0.163]);
  b.extrude({ points: S([[-0.166, 0.022], [-0.158, 0.042], [-0.128, 0.0545], [-0.095, 0.052], [-0.062, 0.043], [-0.03, 0.044], [-0.006, 0.05], [0.006, 0.042], [0.008, 0.022]], 4), width: 0.048, mat: P, bevel: 0.0045 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.032, z: -0.163, len: 0.052, r: 0.004, mat: P, seg: 14 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.046, z: 0.0, len: 0.03, r: 0.0035, mat: P, seg: 12 }); // cover catch
  b.body();
  b.anchor('coverHinge', 0, 0.032, -0.163);
  // --- Trigger housing with the double-crescent trigger, bakelite grip.
  b.span({ z0: -0.05, z1: 0.075, y0: -0.044, y1: -0.018, w: 0.0302, mat: P, r: 0.003 });
  guard(b, { zf: -0.04, zr: 0.03, yTop: -0.04, yBot: -0.077, t: 0.0045, w: 0.0122, mat: P, rake: 0.005 });
  trigger(b, { z: 0, yTop: -0.041, len: 0.012, curve: 0.002, mat: P });
  trigger(b, { z: 0.002, yTop: -0.054, len: 0.013, curve: 0.004, mat: P });
  sweepGrip(b, {
    path: [
      [0.042, -0.036],
      [0.056, -0.07],
      [0.074, -0.112],
      [0.082, -0.136],
    ],
    sections: (t) => ({ w: 0.0302 + 0.003 * Math.sin(PI * t), f: 0.0168 + 0.002 * Math.sin(PI * t), r: 0.0178 + 0.0015 * t, n: 2.7 }),
    mat: 'bakeliteBlack',
    dome: 0.08,
  });
  // --- Butt stock.
  const stk = stock(b, {
    mat: 'bakeliteBlack',
    z0: 0.1,
    z1: 0.367,
    top: [
      [0.1, 0.02],
      [0.25, 0.012],
      [0.367, 0.004],
    ],
    bottom: [
      [0.1, -0.026],
      [0.13, -0.046],
      [0.2, -0.07],
      [0.3, -0.1],
      [0.367, -0.118],
    ],
    width: [
      [0.1, 0.0312],
      [0.2, 0.0372],
      [0.367, 0.0402],
    ],
    n: 3.2,
    wTop: 0.8,
    wBot: 0.84,
    belly: 0.5,
    roundStart: 0.002,
  });
  buttPlate(b, stk, { z0: 0.364, z1: 0.3745, mat: P, screws: [] });
  // --- Bipod near the front of the jacket.
  b.part('bipod', [0, -0.024, -0.69]);
  tube(b, { z0: -0.7, z1: -0.68, rIn: 0.0245, rOut: 0.029, mat: P, seg: 28 });
  for (const s of [-1, 1]) {
    b.rod({ from: [s * 0.012, -0.027, -0.69], to: [s * 0.115, -0.3, -0.71], r: 0.0055, r1: 0.0048, mat: P });
    b.box({ x: s * 0.117, y: -0.305, z: -0.71, w: 0.016, h: 0.006, d: 0.028, mat: P, r: 0.002 });
  }
  b.body();
  b.meta.bipodFold = -PI / 2;
  // --- Cocking handle on the right (forward).
  b.part('bolt', [0, 0, -0.11]);
  b.cylAxis({ axis: 'x', x: 0.031, y: 0.0, z: -0.11, len: 0.012, r: 0.003, mat: P, seg: 10 });
  b.cylAxis({ axis: 'z', x: 0.038, y: 0.0, z: -0.11, len: 0.022, r: 0.004, mat: P, seg: 12 });
  b.anchor('chargingHandle', 0.042, 0.0, -0.11);
  b.body();
  // --- 50-round belt drum on the left.
  b.part('mag', [-0.096, -0.036, -0.08]);
  beltDrum(b, { x: -0.096, y: -0.036, z: -0.08, feedY: 0.027 });
  b.body();
  b.anchor('magWell', -0.03, 0.027, -0.08);
  b.meta.magAxis = [-1, 0, 0];
  b.meta.belt = true;

  b.anchor('muzzle', 0, 0, -0.84);
  b.anchor('gripR', 0, -0.088, 0.064);
  b.anchor('trigger', 0, -0.05, 0.0);
  b.anchor('gripL', 0, -0.05, 0.25);
  b.anchor('shoulder', 0, -0.055, 0.3745);
  b.meta.gripRake = 0.38; // grip axis from vertical (rad)
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

// FG 42 (first model): 7.92x57 paratrooper automatic rifle, 975 mm long, 500 mm
// barrel. Muzzle brake, folding front post and diopter rear sight high above the
// straight-line stock, sharply raked grip, pressed-steel butt, bipod at the gas
// block, stowed spike bayonet, stamped handguard with vents, 20-round magazine on
// the LEFT. Phosphated. Dimensions est. from photos. v.scope: the ZFG 42 in
// its clamp rings on the rail on top of the receiver, both iron sights folded
// down under it.
function fallschirmjaegergewehr(b, v = {}) {
  const P = 'phosphate';
  lathe(b, { mat: P, seg: 24, profile: [[0, -0.2], [0.0118, -0.2], [0.011, -0.3], [0.0098, -0.45], [0.0092, -0.585], [0, -0.585]] });
  // Muzzle brake with slots.
  lathe(b, { mat: P, seg: 24, profile: [[0.006, -0.635], [0.0115, -0.635], [0.0128, -0.63], [0.0128, -0.59], [0.0105, -0.585], [0.006, -0.585]] });
  if (b.detail(1)) for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) b.box({ x: sx * 0.0122, y: 0, z: -0.627 + i * 0.0105, w: 0.002, h: 0.012, d: 0.005, mat: 'black', r: 0.0006 });
  // Folding front post on a tall base behind the brake (laid back flat under a scope).
  b.span({ z0: -0.582, z1: -0.566, y0: 0.006, y1: 0.03, w: 0.0142, mat: P, r: 0.002 });
  if (v.scope) b.span({ z0: -0.5765, z1: -0.546, y0: 0.0295, y1: 0.0335, w: 0.0026, mat: P, r: 0.0005 });
  else plateXYz(b, { outline: [[-0.0014, 0.028], [0.0014, 0.028], [0.0012, 0.056], [0.0003, 0.0585], [-0.0003, 0.0585], [-0.0012, 0.056]], z0: -0.5765, z1: -0.5715, mat: P, bevel: 0.0003 });
  for (const sx of [-1, 1]) b.extrude({ points: S([[-0.58, 0.028], [-0.568, 0.028], [-0.57, 0.06], [-0.578, 0.06]], 2), width: 0.0018, x: sx * 0.0058, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0585, -0.574);
  // Gas block and cylinder under the barrel, stowed spike bayonet.
  b.span({ z0: -0.472, z1: -0.452, y0: -0.032, y1: 0.012, w: 0.0222, mat: P, r: 0.003 });
  b.cyl({ z0: -0.46, z1: -0.2, r0: 0.0092, y: -0.021, mat: P, seg: 14 });
  b.rod({ from: [0, -0.037, -0.46], to: [0, -0.037, -0.3], r: 0.003, r1: 0.0035, mat: 'steelBright' });
  // Stamped handguard with vent slots.
  b.span({ z0: -0.335, z1: -0.198, y0: -0.039, y1: 0.013, w: 0.0362, mat: P, r: 0.005 });
  if (b.detail(1)) for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) b.box({ x: sx * 0.0181, y: -0.012, z: -0.31 + i * 0.04, w: 0.002, h: 0.022, d: 0.026, mat: 'black', r: 0.002 });
  // Receiver, magazine housing (left), ejection port (right).
  b.span({ z0: -0.2, z1: 0.13, y0: -0.032, y1: 0.024, w: 0.0312, mat: P, r: 0.004 });
  b.span({ z0: -0.172, z1: -0.078, y0: -0.018, y1: 0.016, w: 0.0262, x: -0.026, mat: P, r: 0.003 });
  if (b.detail(0)) b.span({ z0: -0.15, z1: -0.09, y0: -0.004, y1: 0.012, w: 0.0016, x: 0.0158, mat: 'black', r: 0.0005 });
  b.anchor('ejectionPort', 0.017, 0.004, -0.12);
  // Diopter rear sight on a raised base with protective wings.
  b.span({ z0: 0.06, z1: 0.112, y0: 0.022, y1: 0.036, w: 0.0202, mat: P, r: 0.002 });
  for (const sx of [-1, 1]) b.extrude({ points: S([[0.07, 0.034], [0.108, 0.034], [0.108, 0.062], [0.096, 0.066], [0.084, 0.066]], 2), width: 0.0025, x: sx * 0.0092, mat: P, bevel: 0.0004 });
  b.part('rearSight', [0, 0.0585, 0.09]);
  if (v.scope) b.span({ z0: 0.062, z1: 0.093, y0: 0.0362, y1: 0.0392, w: 0.0128, mat: P, r: 0.0008 }); // folded forward
  else plateXYz(b, { outline: superellipse(0, 0.049, 0.013, 0.03, 4, b.detail(1) ? 24 : 8), holes: [circle(0, 0.0585, 0.0014, b.detail(1) ? 14 : 6)], z0: 0.0885, z1: 0.0915, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, 0.0585, 0.09);
  b.body();
  if (v.scope) {
    // Dovetail rail on the receiver, two clamp rings with locking levers, the scope.
    const yc = 0.067;
    b.span({ z0: -0.175, z1: -0.02, y0: 0.0235, y1: 0.0285, w: 0.0142, mat: P, r: 0.0008 });
    for (const z of [-0.155, -0.045]) {
      b.span({ z0: z - 0.009, z1: z + 0.009, y0: 0.027, y1: 0.032, w: 0.022, mat: P, r: 0.0012 });
      b.span({ z0: z - 0.006, z1: z + 0.006, y0: 0.031, y1: yc - 0.014, w: 0.012, mat: P, r: 0.0015 });
      ring(b, { y: yc, z, r: 0.013, w: 0.014, t: 0.0026, mat: P });
      b.box({ x: 0.0135, y: 0.03, z, w: 0.004, h: 0.005, d: 0.022, mat: P, r: 0.001 }); // lever
    }
    zf4(b, { y: yc, zEye: 0.058 });
  }
  b.meta.sightKind = 'slide';
  // Sharply raked grip, trigger guard, trigger.
  b.span({ z0: -0.045, z1: 0.07, y0: -0.044, y1: -0.03, w: 0.0262, mat: P, r: 0.003 });
  guard(b, { zf: -0.036, zr: 0.026, yTop: -0.042, yBot: -0.072, t: 0.0042, w: 0.0112, mat: P, rake: 0.008 });
  trigger(b, { z: 0, yTop: -0.043, len: 0.019, curve: 0.006, mat: P });
  sweepGrip(b, {
    path: [
      [0.04, -0.04],
      [0.072, -0.07],
      [0.112, -0.106],
      [0.135, -0.124],
    ],
    sections: (t) => ({ w: 0.0292 + 0.003 * Math.sin(PI * t), f: 0.0152 + 0.002 * Math.sin(PI * t), r: 0.0162 + 0.0015 * t, n: 2.6 }),
    mat: 'bakeliteBlack',
    dome: 0.1,
  });
  // Pressed-steel butt in line with the bore.
  const stk = stock(b, {
    mat: P,
    z0: 0.13,
    z1: 0.3365,
    top: [
      [0.13, 0.022],
      [0.3365, 0.016],
    ],
    bottom: [
      [0.13, -0.03],
      [0.25, -0.076],
      [0.3365, -0.112],
    ],
    width: [
      [0.13, 0.0232],
      [0.32, 0.0302],
    ],
    n: 3.4,
    wTop: 0.82,
    wBot: 0.84,
    belly: 0.5,
  });
  buttPlate(b, stk, { z0: 0.3335, z1: 0.344, mat: P, screws: [] });
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
  b.cylAxis({ axis: 'x', x: 0.022, y: 0.002, z: -0.16, len: 0.014, r: 0.0035, mat: P, seg: 10 });
  b.sphere({ x: 0.03, y: 0.002, z: -0.16, r: 0.006, mat: P, seg: 14 });
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
  b.anchor('gripR', 0, -0.078, 0.096);
  b.anchor('trigger', 0, -0.052, 0.0);
  b.anchor('gripL', 0, -0.03, -0.27);
  b.anchor('shoulder', 0, -0.045, 0.344);
  b.meta.gripRake = 0.85; // grip axis from vertical (rad)
  b.meta.sight = v.scope ? 'scope' : 'aperture';
  b.meta.boltThrow = 0.1;
  b.meta.openBolt = true;
}

export function fg42(b) {
  fallschirmjaegergewehr(b);
}

export function fg42_zfg42(b) {
  fallschirmjaegergewehr(b, { scope: true });
}

// Walther P38: 9 mm double-action pistol, 216 mm long, 125 mm barrel exposed on top
// by the open slide. Closed slide nose with the front sight, breech end with the
// rear notch, the loaded-chamber pin, rear grasping grooves and the safety /
// decocking lever on the left; frame with the large rounded guard, takedown lever
// and slide stop on the left, grooved brown bakelite grips, magazine catch at the
// heel and the lanyard loop; rounded hammer, down. Ejects to the left. Blued.
// Dimensions est. from photos.
export function p38(b) {
  const P = 'steel';
  // Barrel (stays with the frame), exposed on top through the open slide.
  lathe(b, { mat: P, seg: 24, profile: [[0.0045, -0.1235], [0.0062, -0.1235], [0.0074, -0.1225], [0.0076, -0.1], [0.0079, -0.04], [0.0082, -0.012], [0, -0.012]] });
  b.cyl({ z0: -0.124, z1: -0.114, r0: 0.0046, mat: 'black', seg: 12 });
  // --- Frame: rails, the big trigger guard, grip frame, takedown lever (left).
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
  b.extrude({ points: S([[-0.058, -0.0115], [-0.044, -0.0118], [-0.041, -0.0155], [-0.046, -0.019], [-0.058, -0.0175]], 2), width: 0.0022, x: -0.0118, mat: P, bevel: 0.0006 }); // takedown lever
  b.extrude({ points: S([[-0.018, -0.0102], [0.004, -0.0105], [0.007, -0.0135], [0.002, -0.016], [-0.016, -0.0145]], 2), width: 0.0022, x: -0.0118, mat: P, bevel: 0.0006 }); // slide stop
  // Grooved bakelite grips, magazine catch at the heel, lanyard loop (left).
  b.extrude({ points: S([[0.025, -0.036], [0.077, -0.032], [0.085, -0.07], [0.094, -0.112], [0.056, -0.116], [0.047, -0.1], [0.029, -0.05]], 3), width: 0.0292, mat: 'grooved', bevel: 0.0026 });
  b.box({ x: 0, y: -0.1215, z: 0.094, w: 0.0072, h: 0.0052, d: 0.0095, mat: P, r: 0.0012 });
  b.cylAxis({ axis: 'x', x: -0.0118, y: -0.115, z: 0.088, len: 0.003, r: 0.0026, mat: P, seg: 10 });
  bar(b, { pts: [[-0.0135, -0.115, 0.084], [-0.0142, -0.1215, 0.0815], [-0.0145, -0.1265, 0.088], [-0.0142, -0.1215, 0.0945], [-0.0135, -0.115, 0.092]], closed: true, r: 0.001, mat: P, seg: 8 });
  trigger(b, { z: 0, yTop: -0.022, len: 0.02, curve: 0.006, w: 0.006, mat: P });
  b.anchor('ejectionPort', -0.012, 0.012, -0.015);

  // --- Slide: one loft that is closed at the nose, a U-channel over the barrel
  // in the middle and closed again at the breech.
  b.part('bolt', [0, 0, 0.07]);
  {
    const serr = serrations(0.036, 0.0645, b.detail(0) ? 8 : 0);
    const base = b.detail(0) ? [-0.114, -0.1125, -0.0985, -0.098, -0.032, -0.031, ...serr.zs, 0.0695, 0.0705] : [-0.114, -0.0985, -0.098, -0.032, -0.031, 0.0705];
    const zs = base.sort((a, c) => a - c).filter((z, i, a) => i === 0 || z - a[i - 1] > 1e-5);
    const K = b.detail(0) ? 4 : 1;
    const sec = (z) => {
      const open = z > -0.0983 && z < -0.0315;
      const hw = 0.01175 - serr.depth(z) * 0.0005;
      const end = z < -0.1135 || z > 0.0702 ? 0.0006 : 0;
      const yb = -0.0085 + end,
        yt = (z < -0.098 ? 0.0118 : z > -0.031 ? 0.0118 : 0.0035) - end;
      const rt = open ? 0.0012 : 0.0045;
      const pts = [[0, yb], [hw - end, yb]];
      for (let k = 0; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([hw - end - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]);
      }
      // Inner side of the channel (collapses onto the top when closed).
      const ci = 0.0084;
      if (open) pts.push([ci, yt], [ci, -0.0045], [0, -0.0045]);
      else pts.push([ci, yt], [ci * 0.5, yt], [0, yt]);
      const right = pts.slice(1);
      const left = right
        .slice(0, -1)
        .map(([x, y]) => [-x, y])
        .reverse();
      return [pts[0], ...right, ...left];
    };
    sectionLoft(b, { zs, section: sec, mat: P });
  }
  if (b.detail(0)) b.box({ x: -0.0113, y: 0.0062, z: -0.016, w: 0.0016, h: 0.0085, d: 0.024, mat: 'black', r: 0.0004 }); // ejection port (left)
  plateXYz(b, { outline: [[-0.0014, 0.011], [0.0014, 0.011], [0.0012, 0.0142], [-0.0012, 0.0142]], z0: -0.111, z1: -0.104, mat: P, bevel: 0.0003 });
  plateXYz(b, { outline: [[-0.0055, 0.011], [0.0055, 0.011], [0.0052, 0.0168], [0.0013, 0.0168], [0.0013, 0.0145], [-0.0013, 0.0145], [-0.0013, 0.0168], [-0.0052, 0.0168]], z0: 0.056, z1: 0.063, mat: P, bevel: 0.0004 });
  b.cyl({ z0: 0.066, z1: 0.073, r0: 0.0013, y: 0.0098, mat: 'steelBright', seg: 8 }); // loaded-chamber pin
  // Safety / decocking lever on the left rear.
  b.cylAxis({ axis: 'x', x: -0.0126, y: 0.0042, z: 0.05, len: 0.0032, r: 0.0044, mat: P, seg: 14 });
  b.extrude({ points: S([[0.0465, 0.0025], [0.0625, 0.0032], [0.0665, 0.0068], [0.062, 0.0092], [0.0485, 0.0068]], 2), width: 0.0022, x: -0.0136, mat: P, bevel: 0.0006 });
  b.body();
  stamp(b, { name: 'p38Slide', at: [-0.01176, 0.0042, 0.012], axis: '-x', w: 0.034, h: 0.004 });
  b.anchor('frontSight', 0, 0.0142, -0.1075);
  b.anchor('rearSight', 0, 0.0145, 0.0595);
  // Hammer (down, double action): rounded spur with grooves.
  b.part('hammer', [0, -0.005, 0.071]);
  b.extrude({ points: S([[0.066, -0.012], [0.074, -0.011], [0.078, -0.002], [0.08, 0.008], [0.086, 0.011], [0.088, 0.006], [0.084, -0.006], [0.079, -0.016], [0.068, -0.017]]), width: 0.0082, mat: P, bevel: 0.0008 });
  if (b.detail(0)) for (let i = 0; i < 4; i++) b.box({ x: 0, y: 0.0088 - i * 0.0026, z: 0.0868 - i * 0.0006, w: 0.0084, h: 0.0006, d: 0.0008, mat: 'black', r: 0 });
  b.body();
  // Magazine.
  const top = [0.027, -0.012];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.116, depth: 0.031, width: 0.014, angle: -0.35, mat: P, plate: 0.0045, lip: 0.0012, rib: false });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.94, 0.343];

  b.anchor('muzzle', 0, 0, -0.1235);
  b.anchor('gripR', 0, -0.07, 0.06);
  b.anchor('trigger', 0, -0.032, 0.0);
  b.anchor('gripL', -0.022, -0.085, 0.055);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.035;
}

// Luger P08: 9 mm toggle-locked pistol, 222 mm long, 102 mm barrel, steeply raked
// grip (55 deg to the bore). Tapered barrel with the barleycorn front sight on its
// base; the receiver (barrel extension) holds the toggle: breechblock with the
// extractor, front link, the knee with its knurled grips and the rear link with
// the V notch rear sight, hinged at the back of the frame between the toggle
// ramps. Frame with the takedown lever (left front), the side plate and safety
// lever on the left, checkered walnut grips, magazine release and lanyard loop;
// magazine with the wooden base. The trigger sits under the barrel's breech end.
// The toggle assembly is the 'bolt' (it moves back and the knee rises on firing).
// Blued, toggle train included. Dimensions est. from side views.
export function luger_p08(b) {
  const P = 'steel';
  // --- Barrel with the front sight base and blade.
  lathe(b, { mat: P, seg: 28, profile: [[0.0045, -0.092], [0.0071, -0.092], [0.0074, -0.0912], [0.0075, -0.07], [0.0081, -0.04], [0.0088, -0.018], [0.0094, -0.0105], [0.0112, -0.0098], [0.0112, 0.002], [0, 0.002]] });
  b.cyl({ z0: -0.0922, z1: -0.08, r0: 0.0045, mat: 'black', seg: 12 });
  b.span({ z0: -0.0915, z1: -0.0812, y0: 0.0035, y1: 0.0091, w: 0.0062, mat: P, r: 0.0012 });
  plateXYz(b, { outline: [[-0.0015, 0.0088], [0.0015, 0.0088], [0.0004, 0.01238], [-0.0004, 0.01238]], z0: -0.0888, z1: -0.0842, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.01238, -0.0865);
  // --- Receiver: round where the barrel screws in, then flat sides with the
  // toggle between them (a U channel), the forks at the rear.
  {
    const K = b.detail(0) ? 3 : 1;
    const zs = b.detail(0) ? [0.0, 0.0006, 0.0055, 0.006, 0.0975, 0.098] : [0.0, 0.0055, 0.006, 0.098];
    const sec = (z) => {
      const open = z > 0.0058;
      const end = z < 0.0004 || z > 0.0978 ? 0.0006 : 0;
      const hw = 0.0096 - end,
        yb = -0.0122 + end,
        yt = 0.0096 - end,
        rt = 0.0026;
      const pts = [[0, yb], [hw, yb]];
      for (let k = 0; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([hw - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]);
      }
      const ci = 0.007;
      if (open) pts.push([ci, yt], [ci, -0.0065], [0, -0.0065]);
      else pts.push([ci, yt], [ci * 0.5, yt], [0, yt]);
      const right = pts.slice(1);
      const left = right
        .slice(0, -1)
        .map(([x, y]) => [-x, y])
        .reverse();
      return [pts[0], ...right, ...left];
    };
    sectionLoft(b, { zs, section: sec, mat: P });
  }
  lathe(b, { mat: P, seg: 28, profile: [[0.0112, -0.0098], [0.0118, -0.0092], [0.0118, 0.0005], [0.0105, 0.0012], [0, 0.0012]] }); // barrel shank collar
  // --- Frame: rails under the receiver, trigger guard, raked grip frame, toggle
  // ramps rising at the back.
  const frame = path(
    [
      [-0.004, -0.0122, 1],
      [0.098, -0.0122, 1],
      [0.1005, -0.0075],
      [0.1052, -0.0032],
      [0.1102, -0.0048],
      [0.1128, -0.0108],
      [0.1122, -0.0215],
      [0.1185, -0.0385],
      [0.1335, -0.0832],
      [0.1372, -0.0952, 1],
      [0.1315, -0.1025, 1],
      [0.0935, -0.1028, 1],
      [0.0882, -0.0972],
      [0.0705, -0.0708],
      [0.0505, -0.0438],
      [0.0402, -0.0328],
      [0.0322, -0.0388],
      [0.0225, -0.0446],
      [0.008, -0.0462],
      [-0.0085, -0.0458],
      [-0.0195, -0.0408],
      [-0.0248, -0.0298],
      [-0.0205, -0.0185, 1],
      [-0.0118, -0.0158, 1],
    ],
    3,
  );
  const guardHole = S([[-0.0188, -0.0212], [0.0162, -0.0212], [0.0215, -0.0302], [0.0138, -0.0402], [-0.0118, -0.0412], [-0.0198, -0.0322]], 4);
  b.extrude({ points: frame, holes: [guardHole], width: 0.0196, mat: P, bevel: 0.0011 });
  // Side plate (left) and the takedown lever above the guard's front.
  b.extrude({ points: path([[0.004, -0.0148, 1], [0.052, -0.0148, 1], [0.056, -0.022], [0.05, -0.031], [0.012, -0.0328], [0.004, -0.026]], 3), width: 0.0012, x: -0.0102, mat: P, bevel: 0.0003 });
  b.extrude({ points: path([[-0.0128, -0.0128, 1], [-0.0018, -0.0128], [0.0008, -0.0156], [-0.0016, -0.0198], [-0.0118, -0.0186]], 3), width: 0.0022, x: -0.0108, mat: P, bevel: 0.0005 });
  b.cylAxis({ axis: 'x', x: -0.0109, y: -0.0162, z: -0.0045, len: 0.0026, r: 0.0028, mat: P, seg: 12 });
  // Safety lever (left rear) with its knurled tab, magazine release, lanyard loop.
  b.cylAxis({ axis: 'x', x: -0.0104, y: -0.0222, z: 0.1038, len: 0.0022, r: 0.0034, mat: P, seg: 12 });
  b.extrude({ points: path([[0.0985, -0.0268], [0.1052, -0.0248], [0.1078, -0.0122], [0.1038, -0.0108], [0.1002, -0.0198]], 3), width: 0.0018, x: -0.0112, mat: P, bevel: 0.0004 });
  if (b.detail(0)) for (let i = 0; i < 4; i++) b.box({ x: -0.0122, y: -0.0128 - i * 0.0018, z: 0.1055, w: 0.0004, h: 0.0006, d: 0.004, mat: 'black', r: 0 });
  knurledKnob(b, { at: [-0.0104, -0.0262, 0.0362], axis: 'x', r: 0.0038, len: 0.0026, teeth: 14, depth: 0.0003, mat: P });
  bar(b, { pts: [[-0.0108, -0.0915, 0.1302], [-0.0122, -0.0975, 0.1348], [-0.0124, -0.1018, 0.1312], [-0.0116, -0.0995, 0.1262]], closed: true, r: 0.001, mat: P, seg: 8 });
  // Checkered walnut grips, a smooth border round the checkering, screws.
  const grip = path([[0.0472, -0.0318, 1], [0.1042, -0.0262, 1], [0.1098, -0.0392], [0.1306, -0.0842], [0.1324, -0.0932], [0.1286, -0.0988, 1], [0.0978, -0.0994, 1], [0.0924, -0.0944], [0.0738, -0.0688], [0.0552, -0.0438]], 3);
  b.extrude({ points: grip, width: 0.0262, mat: 'walnut', bevel: 0.0018 });
  const inner = path([[0.0535, -0.0345, 1], [0.0998, -0.0298, 1], [0.1048, -0.0405], [0.1252, -0.0848], [0.1262, -0.0918, 1], [0.1002, -0.0948, 1], [0.0952, -0.0902], [0.0772, -0.0662], [0.0598, -0.0438]], 3);
  b.extrude({ points: inner, width: 0.0272, mat: 'checkerWalnut', bevel: 0.0008 });
  if (b.detail(0)) for (const s of [-1, 1]) screw(b, { at: [s * 0.0136, -0.062, 0.098], axis: s > 0 ? 'x' : '-x', r: 0.0026, h: 0.0008, mat: P, slot: 0.4 });
  trigger(b, { z: 0, yTop: -0.023, len: 0.016, curve: 0.005, w: 0.0055, mat: P });
  b.anchor('ejectionPort', 0, 0.012, 0.03);

  // --- Toggle: breechblock with the extractor, front link, the knee with its
  // knurled grips, rear link with the rear sight, hinged at the frame's back.
  b.part('bolt', [0, 0, 0.098]);
  b.span({ z0: 0.0062, z1: 0.0438, y0: -0.0058, y1: 0.0093, w: 0.0136, mat: 'steel', r: 0.0022 });
  b.span({ z0: 0.0108, z1: 0.0405, y0: 0.0088, y1: 0.0101, w: 0.0042, mat: 'steel', r: 0.0005 }); // extractor
  b.extrude({ points: path([[0.0428, -0.002, 1], [0.0715, -0.002], [0.0742, 0.0045], [0.0708, 0.0104], [0.0462, 0.0101], [0.0428, 0.0078]], 3), width: 0.0142, mat: 'steel', bevel: 0.0012 });
  b.extrude({ points: path([[0.0688, -0.0025], [0.0882, 0.0018], [0.0978, 0.0006, 1], [0.0982, 0.0068], [0.0928, 0.0103], [0.0708, 0.0104], [0.0672, 0.0048]], 3), width: 0.0148, mat: 'steel', bevel: 0.0012 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.0045, z: 0.0705, len: 0.019, r: 0.0042, mat: 'steel', seg: 14 });
  for (const sx of [-1, 1]) knurledKnob(b, { at: [sx * 0.0128, 0.0045, 0.0705], axis: 'x', r: 0.0079, len: 0.0078, teeth: 24, depth: 0.0006, mat: 'steel' });
  plateXYz(b, { outline: [[-0.0042, 0.0098], [0.0042, 0.0098], [0.0042, 0.0142], [0.0013, 0.0142], [0, 0.0128], [-0.0013, 0.0142], [-0.0042, 0.0142]], z0: 0.0842, z1: 0.0898, mat: 'steel', bevel: 0.0003 });
  b.body();
  b.anchor('rearSight', 0, 0.0128, 0.087);
  // --- Magazine with the wooden base.
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
  b.meta.gripRake = 0.61;
}

// Mauser C96 M1916 "Red 9": 9 mm Parabellum, 312 mm long, 140 mm barrel forged in
// one piece with the barrel extension. The square bolt slides in the extension
// (bright, with the ribbed cocking ears at its rear); the fixed 10-round box
// magazine in front of the trigger guard is loaded with stripper clips through the
// open top. Tangent rear sight 50-500 m on the extension, barleycorn front sight,
// small ring hammer, "new safety" lever on the left, milled panels on the frame,
// grooved walnut "broomhandle" grip with the big red 9 burned into both panels,
// stock slot and lanyard ring. Blued. Lengths and heights est. from side views.
export function c96(b) {
  const P = 'steel';
  // --- Barrel, stepped where it joins the extension; front sight.
  lathe(b, { mat: P, seg: 28, profile: [[0.0042, -0.226], [0.0071, -0.226], [0.0075, -0.2252], [0.0076, -0.205], [0.0079, -0.17], [0.0084, -0.14], [0.0089, -0.124], [0.0096, -0.1222], [0.0098, -0.112], [0, -0.112]] });
  b.cyl({ z0: -0.2262, z1: -0.214, r0: 0.0044, mat: 'black', seg: 12 });
  b.span({ z0: -0.2225, z1: -0.2085, y0: 0.0035, y1: 0.0102, w: 0.0074, mat: P, r: 0.0014 });
  plateXYz(b, { outline: [[-0.0017, 0.0098], [0.0017, 0.0098], [0.0004, 0.0205], [-0.0004, 0.0205]], z0: -0.2188, z1: -0.2142, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0205, -0.2165);

  // --- Barrel extension: closed at the front under the sight base, a U channel
  // over the bolt behind it (open on top to the rear end).
  {
    const K = b.detail(0) ? 3 : 1;
    const zs = b.detail(0) ? [-0.118, -0.1172, -0.074, -0.0735, 0.0492, 0.05] : [-0.118, -0.074, -0.0735, 0.05];
    const sec = (z) => {
      const open = z > -0.0738;
      const end = z < -0.1174 || z > 0.0494 ? 0.0006 : 0;
      const hw = 0.0105 - end,
        yb = -0.0125 + end,
        yt = 0.0125 - end,
        rt = 0.002;
      const pts = [[0, yb], [hw, yb]];
      for (let k = 0; k <= K; k++) {
        const a = (k / K) * (PI / 2);
        pts.push([hw - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]);
      }
      const ci = 0.0072;
      if (open) pts.push([ci, yt], [ci, -0.004], [0, -0.004]);
      else pts.push([ci, yt], [ci * 0.5, yt], [0, yt]);
      const right = pts.slice(1);
      const left = right
        .slice(0, -1)
        .map(([x, y]) => [-x, y])
        .reverse();
      return [pts[0], ...right, ...left];
    };
    sectionLoft(b, { zs, section: sec, mat: P });
  }
  b.anchor('clipGuide', 0, 0.016, -0.066);
  b.anchor('ejectionPort', 0, 0.016, -0.05);
  // Rear sight base: two cheeks with the curved ramps the slider rides on.
  for (const sx of [-1, 1]) b.extrude({ points: S([[-0.118, 0.0122], [-0.0795, 0.0122], [-0.0795, 0.0186], [-0.088, 0.0181], [-0.1, 0.0171], [-0.112, 0.016], [-0.118, 0.0152]], 2, true), width: 0.0022, x: sx * 0.0064, mat: P, bevel: 0.0004 });
  b.span({ z0: -0.118, z1: -0.0795, y0: 0.0122, y1: 0.0146, w: 0.0128, mat: P, r: 0.0005 });
  // Leaf (hinged at the front), slider set at the bottom, V notch at the rear.
  b.part('rearSight', [0, 0.0168, -0.116]);
  b.span({ z0: -0.1175, z1: -0.0812, y0: 0.0158, y1: 0.0181, w: 0.0098, mat: P, r: 0.0005 });
  if (b.detail(0)) for (let i = 0; i < 9; i++) b.box({ x: 0, y: 0.0182, z: -0.1105 + i * 0.0032, w: i % 2 ? 0.003 : 0.005, h: 0.0002, d: 0.0004, mat: 'black', r: 0 }); // graduations 50-500 m
  b.span({ z0: -0.1135, z1: -0.1065, y0: 0.0148, y1: 0.0196, w: 0.0104, mat: P, r: 0.0008 }); // slider
  plateXYz(b, { outline: [[-0.0049, 0.0158], [0.0049, 0.0158], [0.0049, 0.0232], [0.0016, 0.0232], [0.0, 0.0205], [-0.0016, 0.0232], [-0.0049, 0.0232]], z0: -0.0838, z1: -0.081, mat: P, bevel: 0.0003 });
  b.anchor('rearSight', 0, 0.0205, -0.082);
  b.body();
  b.meta.sightKind = 'leaf';

  // --- Frame: magazine housing, trigger guard, grip frame, hammer housing. The
  // side panels are milled 0.6 mm deep (raised borders around them).
  const frame = path(
    [
      [-0.1, -0.0125, 1],
      [0.05, -0.0125, 1],
      [0.0515, 0.0015],
      [0.0558, 0.0055, 1],
      [0.0732, 0.0055],
      [0.0778, 0.0008],
      [0.0784, -0.0135],
      [0.0752, -0.0238],
      [0.0668, -0.0322, 1],
      [0.03, -0.0352, 1],
      [0.0158, -0.0338],
      [0.0128, -0.0428],
      [0.0062, -0.0506],
      [-0.006, -0.0538],
      [-0.0185, -0.0532],
      [-0.0285, -0.0482],
      [-0.0342, -0.0405, 1],
      [-0.0362, -0.0598, 1],
      [-0.0978, -0.0598, 1],
      [-0.1, -0.0575, 1],
    ],
    3,
  );
  const guardHole = S([[-0.0292, -0.0172], [0.0052, -0.0172], [0.0082, -0.0262], [0.0052, -0.0405], [-0.0072, -0.0462], [-0.0205, -0.0452], [-0.0292, -0.0372]], 4);
  b.extrude({ points: frame, holes: [guardHole], width: 0.0224, mat: P, bevel: 0.0012 });
  if (b.detail(1)) {
    const panels = [S([[-0.0935, -0.0175], [-0.0425, -0.0175], [-0.0405, -0.0195], [-0.0405, -0.0525], [-0.0425, -0.0545], [-0.0935, -0.0545], [-0.0955, -0.0525], [-0.0955, -0.0195]], 2), S([[0.0215, -0.0168], [0.0655, -0.0168], [0.0672, -0.0185], [0.0672, -0.0262], [0.064, -0.0292], [0.0215, -0.0298], [0.0198, -0.028], [0.0198, -0.0185]], 2)];
    for (const sx of [-1, 1]) b.extrude({ points: frame, holes: [guardHole, ...panels], width: 0.0008, x: sx * 0.0114, mat: P, bevel: 0.0002, curveSegments: 2 });
  }
  b.span({ z0: -0.0985, z1: -0.0355, y0: -0.0636, y1: -0.0592, w: 0.0244, mat: P, r: 0.0013 }); // floor plate
  b.span({ z0: -0.0992, z1: -0.0945, y0: -0.0628, y1: -0.0585, w: 0.0218, mat: P, r: 0.0008 }); // its front lip
  trigger(b, { z: 0, yTop: -0.018, len: 0.021, curve: 0.006, w: 0.0055, mat: P });
  // Safety lever (left), pivoting beside the hammer.
  b.cylAxis({ axis: 'x', x: -0.0118, y: -0.0008, z: 0.0705, len: 0.0022, r: 0.0026, mat: P, seg: 12 });
  b.extrude({ points: S([[0.0675, -0.0026], [0.0735, -0.002], [0.0775, 0.0098], [0.0752, 0.0124], [0.0718, 0.0108], [0.0682, 0.001]], 2), width: 0.0018, x: -0.0128, mat: P, bevel: 0.0004 });
  b.sphere({ x: -0.0128, y: 0.0122, z: 0.0766, r: 0.0024, mat: P, seg: 10 });

  // --- Broomhandle grip: grooved walnut panels, the red 9, steel butt with the
  // stock slot and the lanyard ring.
  const g0 = [0.0445, -0.0318],
    g1 = [0.0695, -0.1205];
  const gripSec = (t) => ({ w: 0.0296 + 0.0036 * t, f: 0.0165 + 0.0012 * t, r: 0.0168 + 0.0022 * t * t, n: 2.3 });
  sweepGrip(b, { path: [g0, [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2], g1], sections: gripSec, mat: 'groovedWalnut' });
  sweepGrip(b, {
    path: [g1, [g1[0] + 0.0012, g1[1] - 0.0036], [g1[0] + 0.0024, g1[1] - 0.0072]],
    sections: (t) => {
      const s = gripSec(1);
      return { w: s.w + 0.0005, f: s.f + 0.0005, r: s.r + 0.0005, n: 2.3 };
    },
    dome: 0.45,
    mat: P,
  });
  if (b.detail(0)) {
    b.box({ x: 0, y: -0.1062, z: 0.0846, w: 0.0062, h: 0.02, d: 0.0024, rx: -0.27, mat: 'black', r: 0.0003 }); // stock slot
    // The 9 on each panel, following the grip's rounded side.
    const len = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]);
    const T = [(g1[0] - g0[0]) / len, (g1[1] - g0[1]) / len]; // down the grip (z, y)
    const N = [-T[1], T[0]]; // toward the front
    if (N[0] > 0) (N[0] = -N[0]), (N[1] = -N[1]);
    for (const side of [1, -1]) {
      stamp(b, {
        name: 'c96Nine',
        mat: 'paintRed',
        n: 6,
        surf: (s, t) => {
          const u = 0.4 - (t * 0.026) / len; // along the grip from the top
          const sec = gripSec(u);
          const d = s * side * 0.0185; // toward the front on the right side
          const f = d > 0 ? sec.f : sec.r;
          const sn = Math.min(1, Math.abs(d) / f) ** (sec.n / 2);
          const x = (sec.w / 2) * Math.sqrt(Math.max(0, 1 - sn * sn)) ** (2 / sec.n) + 0.0001;
          const z = g0[0] + T[0] * u * len + N[0] * d,
            y = g0[1] + T[1] * u * len + N[1] * d;
          return [side * x, y, z];
        },
      });
      screw(b, { at: [side * 0.0162, -0.101, 0.064], axis: side > 0 ? 'x' : '-x', r: 0.0028, h: 0.0009, mat: P });
    }
  }
  bar(b, { pts: [[0, -0.1288, 0.0772], [0, -0.1338, 0.0842], [0, -0.1408, 0.0872], [0, -0.1458, 0.0812], [0, -0.1408, 0.0752], [0, -0.1338, 0.0752]], closed: true, r: 0.0012, mat: P, seg: 8 }); // lanyard ring
  b.cylAxis({ axis: 'x', x: 0, y: -0.1281, z: 0.0772, len: 0.0062, r: 0.0022, mat: P, seg: 10 });

  // --- Bolt: square block, extractor along its top, ribbed ears at the rear.
  b.part('bolt', [0, 0, 0.05]);
  b.span({ z0: -0.073, z1: 0.0488, y0: -0.0042, y1: 0.0117, w: 0.0142, mat: 'steelBright', r: 0.0012 });
  b.span({ z0: -0.07, z1: -0.022, y0: 0.0112, y1: 0.0122, w: 0.0036, mat: 'steelBright', r: 0.0004 }); // extractor
  for (const sx of [-1, 1]) {
    b.extrude({ points: S([[0.0282, 0.0108], [0.0492, 0.0108], [0.0504, 0.0188], [0.0465, 0.0196], [0.0336, 0.0182]], 2), width: 0.0046, x: sx * 0.0047, mat: 'steelBright', bevel: 0.0005 });
    if (b.detail(0)) for (let i = 0; i < 6; i++) b.box({ x: sx * 0.0071, y: 0.0158, z: 0.0335 + i * 0.0026, w: 0.0004, h: 0.006, d: 0.0007, mat: 'black', r: 0 });
  }
  b.body();
  // Small ring hammer, cocked.
  b.part('hammer', [0, -0.004, 0.058]);
  b.extrude({ points: S([[0.0545, -0.006], [0.0625, -0.0045], [0.0675, 0.0055], [0.0638, 0.0075], [0.0575, 0.0015], [0.0535, -0.0015]], 2), width: 0.0066, mat: P, bevel: 0.0006 });
  b.extrude({ points: circle(0.0705, 0.0112, 0.0072, 20), holes: [circle(0.0705, 0.0112, 0.0036, 14)], width: 0.0066, mat: P, bevel: 0.0007 });
  b.body();

  b.anchor('muzzle', 0, 0, -0.226);
  b.anchor('gripR', 0, -0.072, 0.056);
  b.anchor('trigger', 0, -0.028, 0.0);
  b.anchor('gripL', -0.022, -0.062, -0.068); // support hand on the magazine
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.03;
  b.meta.gripRake = 0.27;
  b.meta.gripRadius = 0.017;
}

// Raketenpanzerbüchse 54 "Panzerschreck": 88 mm launch tube 1640 mm long, rolled
// sheet steel with reinforcing bands at both ends and two clamp rings carrying the
// fittings. Blast shield with the glazed aiming window (glass about 73 mm square);
// sights on the left: front frame with posts for 50, 100 and 150 m, rear notch
// behind the shield. Magneto trigger unit under the tube with the cocking lever
// and the wooden trigger grip, wooden front grip, padded shoulder rest, rear wire
// guard, rocket latch and contact box on the rear end with the firing cable along
// the left side. RPzB Gr 4322 rocket loaded from the rear. Painted dark yellow.
// Length and bore from published data; fittings est. from photos.
export function panzerschreck(b) {
  const Y = 'germanYellow';
  const R = 0.0465; // tube radius
  // --- Tube: open both ends, bands at the ends, clamp rings.
  tube(b, { z0: -1.0, z1: 0.64, rIn: 0.0442, rOut: R, mat: Y, seg: 36 });
  if (b.detail(1)) {
    for (const [z0, z1] of [[-1.0, -0.978], [0.616, 0.64]]) lathe(b, { mat: Y, seg: 36, profile: [[R, z0 + 0.0015], [0.0498, z0], [0.0502, z0 + 0.003], [0.0502, z1 - 0.003], [0.0498, z1], [R, z1 - 0.0015]] });
    for (const z of [-0.47, -0.04, 0.3]) lathe(b, { mat: Y, seg: 36, profile: [[R, z - 0.011], [0.0492, z - 0.01], [0.0494, z + 0.01], [R, z + 0.011]] });
  }
  if (b.detail(0)) for (const z of [-0.47, -0.04, 0.3]) b.cylAxis({ axis: 'x', x: 0.054, y: -0.008, z, len: 0.012, r: 0.0035, mat: 'steel', seg: 8 }); // clamp bolts
  // Rear wire guard under the tube end, rocket latch and contact box on top.
  if (b.detail(1)) bar(b, { pts: [[-0.034, -0.033, 0.555], [-0.046, -0.052, 0.62], [-0.03, -0.072, 0.664], [0, -0.078, 0.672], [0.03, -0.072, 0.664], [0.046, -0.052, 0.62], [0.034, -0.033, 0.555]], r: 0.0042, mat: 'steel', seg: 10 });
  b.span({ z0: 0.548, z1: 0.612, y0: 0.042, y1: 0.0565, w: 0.024, mat: Y, r: 0.003 });
  b.extrude({ points: path([[0.556, 0.0562, 1], [0.6, 0.0562], [0.61, 0.0605], [0.604, 0.0632], [0.566, 0.0612]], 3), width: 0.012, mat: 'steel', bevel: 0.0008 }); // latch lever
  // Firing cable from the trigger unit along the left side to the contact box.
  if (b.detail(1)) bar(b, { pts: [[-0.018, -0.044, 0.04], [-0.042, -0.024, 0.08], [-0.0485, -0.004, 0.2], [-0.0485, 0.004, 0.42], [-0.04, 0.03, 0.53], [-0.012, 0.047, 0.556]], r: 0.0032, mat: 'black', seg: 8 });

  // --- Sights on the left (SX): front frame with the range posts, rear notch.
  const SX = -0.085,
    SR = 0.07,
    posts = [0.0605, 0.0516, 0.0423]; // 50, 100, 150 m
  b.extrude({ points: path([[-0.478, -0.004, 1], [-0.442, -0.004, 1], [-0.446, 0.012], [-0.474, 0.012]], 2), width: 0.034, x: -0.062, mat: Y, bevel: 0.0015 }); // bracket off the clamp ring
  plateXY(b, { outline: [[SX - 0.013, 0.004], [SX + 0.013, 0.004], [SX + 0.013, 0.074], [SX - 0.013, 0.074]], holes: [[[SX - 0.0095, 0.0072], [SX + 0.0095, 0.0072], [SX + 0.0095, 0.0708], [SX - 0.0095, 0.0708]]], z: -0.46, thick: 0.0022, mat: 'steel' });
  // A post pointed for 50 m, with bars across it at the 100 and 150 m heights.
  plateXYz(b, { outline: [[SX - 0.0009, 0.0072], [SX + 0.0009, 0.0072], [SX + 0.0009, posts[0] - 0.0026], [SX, posts[0]], [SX - 0.0009, posts[0] - 0.0026]], z0: -0.4613, z1: -0.4587, mat: 'steel', bevel: 0.0002 });
  for (const y of posts.slice(1)) b.span({ z0: -0.4613, z1: -0.4587, y0: y - 0.0012, y1: y, w: 0.0084, x: SX, mat: 'steel', r: 0.0002 });
  b.anchor('frontSight', SX, posts[1], -0.46);
  b.extrude({ points: path([[-0.07, -0.004, 1], [-0.032, -0.004, 1], [-0.036, 0.012], [-0.066, 0.012]], 2), width: 0.034, x: -0.062, mat: Y, bevel: 0.0015 });
  plateXY(b, { outline: [[SX - 0.012, 0.008], [SX + 0.012, 0.008], [SX + 0.012, 0.0765], [SX + 0.0022, 0.0765], [SX, SR], [SX - 0.0022, 0.0765], [SX - 0.012, 0.0765]], z: -0.05, thick: 0.0022, mat: 'steel' });
  b.anchor('rearSight', SX, SR, -0.05);
  // --- Blast shield with folded edges and the glazed window.
  const shield = path(
    [
      [-0.27, -0.13, 1],
      [0.062, -0.13, 1],
      [0.076, -0.116, 1],
      [0.076, 0.284, 1],
      [0.06, 0.3, 1],
      [-0.272, 0.3, 1],
      [-0.29, 0.282, 1],
      [-0.29, -0.112, 1],
    ],
    2,
  );
  const win = [[SX - 0.0335, SR - 0.0375], [SX + 0.0335, SR - 0.0375], [SX + 0.0335, SR + 0.0195], [SX - 0.0335, SR + 0.0195]];
  plateXY(b, { outline: shield, holes: [circle(0, 0, R + 0.0012, 32), win], z: -0.03, thick: 0.0025, mat: Y });
  if (b.detail(1)) {
    // Edges folded back 8 mm.
    const inset = shield.map(([x, y]) => [x + (x < -0.1 ? 0.007 : -0.007), y + (y < 0.1 ? 0.007 : -0.007)]);
    plateXYz(b, { outline: shield, holes: [inset], z0: -0.0287, z1: -0.0207, mat: Y, bevel: 0.0004 });
    // Window frame and glass.
    const wo = [[SX - 0.04, SR - 0.044], [SX + 0.04, SR - 0.044], [SX + 0.04, SR + 0.026], [SX - 0.04, SR + 0.026]];
    plateXYz(b, { outline: wo, holes: [win], z0: -0.0352, z1: -0.0312, mat: 'steel', bevel: 0.0005 });
    if (b.detail(0)) for (const [x, y] of [[-0.036, -0.04], [0.036, -0.04], [-0.036, 0.022], [0.036, 0.022]]) b.cylAxis({ axis: 'z', x: SX + x, y: SR + y, z: -0.0358, len: 0.0014, r: 0.0022, mat: 'steel', seg: 8 });
    plateXYz(b, { outline: win, z0: -0.0306, z1: -0.0294, mat: 'glassClear', bevel: 0 });
  }

  // --- Trigger unit: magneto housing, cocking lever, trigger grip and guard.
  b.extrude({ points: path([[-0.165, -0.044, 1], [0.065, -0.044, 1], [0.062, -0.068], [0.05, -0.072, 1], [-0.15, -0.072, 1], [-0.162, -0.064]], 2), width: 0.036, mat: Y, bevel: 0.0025 });
  b.extrude({ points: path([[-0.138, -0.068, 1], [-0.122, -0.068, 1], [-0.118, -0.098], [-0.124, -0.118], [-0.133, -0.12], [-0.136, -0.098]], 3), width: 0.009, mat: 'steel', bevel: 0.0012 }); // cocking lever
  b.cylAxis({ axis: 'x', x: 0, y: -0.06, z: -0.13, len: 0.04, r: 0.004, mat: 'steel', seg: 10 });
  sweepGrip(b, { path: [[0.026, -0.072], [0.038, -0.11], [0.05, -0.152]], sections: (t) => ({ w: 0.03, f: 0.0158 + 0.0012 * t, r: 0.0172 + 0.0018 * t, n: 2.6 }), dome: 0.12, mat: 'beech' });
  guard(b, { zf: -0.036, zr: 0.022, yTop: -0.07, yBot: -0.1, t: 0.004, w: 0.01, mat: 'steel', rake: 0.004 });
  trigger(b, { z: 0, yTop: -0.071, len: 0.019, curve: 0.005, mat: 'steel' });
  // Front grip on its clamp.
  b.extrude({ points: path([[-0.428, -0.046, 1], [-0.372, -0.046, 1], [-0.376, -0.062], [-0.424, -0.062]], 2), width: 0.032, mat: Y, bevel: 0.002 });
  sweepGrip(b, { path: [[-0.4, -0.06], [-0.398, -0.105], [-0.396, -0.152]], sections: (t) => ({ w: 0.031, f: 0.0162, r: 0.0168, n: 2.4 }), dome: 0.14, mat: 'beech' });
  // Shoulder rest: sheet frame and the padded rest.
  b.extrude({ points: path([[0.1, -0.044, 1], [0.345, -0.044, 1], [0.34, -0.062], [0.29, -0.078], [0.165, -0.078], [0.108, -0.062]], 3), width: 0.03, mat: Y, bevel: 0.002 });
  sweepGrip(b, { path: [[0.16, -0.083], [0.245, -0.087], [0.33, -0.08]], sections: (t) => ({ w: 0.072, f: 0.012, r: 0.012, n: 3 }), mat: 'leather', steps: b.detail(0) ? 16 : 4 });
  swivel(b, { x: -0.05, y: 0.0, z: -0.75, r: 0.009, w: 0.004 });
  swivel(b, { x: -0.05, y: -0.02, z: 0.3, r: 0.009, w: 0.004 });

  // --- RPzB Gr 4322 rocket in the tube (tail ring at the rear end; hidden
  // inside the tube from afar).
  b.part('rocket', [0, 0, 0.3]);
  if (b.detail(1)) {
    lathe(b, { mat: 'germanGrey', seg: 28, profile: [[0, -0.06], [0.012, -0.057], [0.026, -0.044], [0.038, -0.022], [0.0435, 0.0], [0.0435, 0.16], [0.032, 0.196], [0.0175, 0.218], [0, 0.22]] });
    b.cyl({ z0: 0.21, z1: 0.6, r0: 0.0145, mat: 'steel', seg: 16 });
    tube(b, { z0: 0.55, z1: 0.615, rIn: 0.039, rOut: 0.0415, mat: 'steel', seg: 28 });
    for (let k = 0; k < 4; k++) {
      place(b, { rot: [0, 0, (k * PI) / 2 + PI / 4] }, () => {
        b.span({ z0: 0.555, z1: 0.612, y0: 0.0135, y1: 0.0395, w: 0.0015, mat: 'steel', r: 0.0003 });
      });
    }
  }
  b.body();

  b.anchor('muzzle', 0, 0, -1.0);
  b.anchor('gripR', 0, -0.105, 0.036);
  b.anchor('trigger', 0, -0.078, 0.0);
  b.anchor('gripL', 0, -0.108, -0.398);
  b.anchor('shoulder', 0, -0.09, 0.25);
  b.meta.sight = 'post';
  b.meta.sightRanges = { 50: posts[0], 100: posts[1], 150: posts[2] }; // post heights (m)
  b.meta.rocketAxis = [0, 0, 1]; // loaded from the rear
}

// Panzerfaust 60: recoilless disposable launcher, 1045 mm long. Thin steel launch
// tube 50 mm across, 800 mm long, holding the black powder charge; the 149 mm
// shaped-charge warhead ('warhead' part) sits in its mouth on a wooden tail boom
// with spring-steel fins wrapped around it. Folding sight leaf on top with holes
// for 30, 60 and 80 m (the front sight is a pin on the warhead's rim); raising it
// frees the firing lever just behind it. Red "Achtung! Feuerstrahl!" (beware, fire
// jet) on the rear of the tube. Painted dark yellow, the warhead field grey.
// Overall length, tube and warhead diameters from published data; the rest est.
// from photos.
export function panzerfaust60(b) {
  const Y = 'germanYellow';
  const R = 0.025; // tube radius
  // Launch tube with rolled mouth and nozzle rims.
  lathe(b, { mat: Y, seg: 32, profile: [[0.0232, -0.25], [0.0254, -0.25], [0.0258, -0.2488], [0.0258, -0.2445], [R, -0.2425], [R, 0.5395], [0.0256, 0.5415], [0.0256, 0.5488], [0.0252, 0.55], [0.0236, 0.55]] });
  if (b.detail(1)) b.cyl({ z0: 0.535, z1: 0.5502, r0: 0.0234, mat: 'black', seg: 20, open: true }); // inside of the nozzle
  // Warning on both sides of the tube's rear end, along the tube.
  for (const side of [1, -1]) {
    stamp(b, {
      name: 'pzfWarn',
      mat: 'paintRed',
      surf: (s, t) => {
        const a = (t * 0.04) / R;
        return [side * Math.cos(a) * (R + 0.00008), Math.sin(a) * (R + 0.00008), 0.44 - side * s * 0.104];
      },
    });
  }
  // Sight hinge bracket on the tube top; the leaf, raised, with its three holes.
  const holes = { 30: 0.0997, 60: 0.122, 80: 0.1382 };
  b.extrude({ points: path([[-0.0835, 0.0228, 1], [-0.0565, 0.0228, 1], [-0.0585, 0.0292], [-0.066, 0.0315], [-0.074, 0.0315], [-0.0815, 0.0292]], 3), width: 0.026, mat: Y, bevel: 0.0012 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.028, z: -0.07, len: 0.0285, r: 0.0022, mat: 'steel', seg: 10 });
  b.part('rearSight', [0, 0.028, -0.07]);
  const leaf = [[-0.0105, 0.0262], [0.0105, 0.0262], [0.0108, 0.1405], [0.0062, 0.1462], [-0.0062, 0.1462], [-0.0108, 0.1405]];
  plateXY(b, { outline: leaf, holes: Object.values(holes).map((y) => circle(0, y, 0.0022, 14)), z: -0.07, thick: 0.0016, mat: Y });
  // Pressed stiffening ribs along both edges of the leaf.
  for (const sx of [-1, 1]) b.span({ z0: -0.0712, z1: -0.0688, y0: 0.031, y1: 0.136, w: 0.0018, x: sx * 0.0094, mat: Y, r: 0.0006 });
  b.anchor('rearSight', 0, holes[60], -0.07);
  b.body();
  b.meta.sightKind = 'leaf';
  b.meta.sightFold = -PI / 2; // folds forward flat on the tube
  b.meta.sightRanges = holes; // hole heights (m) for 30 / 60 / 80 m
  // Firing mechanism behind the sight: housing, the lever pressed to fire, the
  // safety pin with its spring clip.
  b.extrude({ points: path([[-0.054, 0.023, 1], [0.03, 0.023, 1], [0.028, 0.0282], [0.018, 0.0298], [-0.045, 0.0298], [-0.052, 0.0282]], 3), width: 0.017, mat: Y, bevel: 0.001 });
  b.extrude({ points: path([[-0.042, 0.0296, 1], [0.024, 0.0296], [0.027, 0.0322], [0.022, 0.0352], [-0.03, 0.0338], [-0.04, 0.032]], 3), width: 0.0118, mat: Y, bevel: 0.0008 });
  b.cylAxis({ axis: 'x', x: 0, y: 0.031, z: -0.038, len: 0.022, r: 0.0016, mat: 'steelBright', seg: 8 });
  bar(b, { pts: [[0.0112, 0.031, -0.038], [0.0155, 0.026, -0.036], [0.0162, 0.018, -0.03], [0.0128, 0.016, -0.026]], r: 0.0007, mat: 'steelBright', seg: 6 });

  // --- Warhead on its tail boom.
  b.part('warhead', [0, 0, -0.36]);
  lathe(b, {
    mat: 'germanGrey',
    seg: 40,
    profile: [
      [0, -0.4972],
      [0.0062, -0.4968],
      [0.0098, -0.4948],
      [0.0118, -0.4905],
      [0.0205, -0.483],
      [0.0335, -0.4705],
      [0.0478, -0.452],
      [0.0598, -0.4318],
      [0.0682, -0.4128],
      [0.0732, -0.3955],
      [0.0745, -0.3825],
      [0.0749, -0.3785],
      [0.0752, -0.3765],
      [0.0745, -0.3742],
      [0.0738, -0.365],
      [0.0712, -0.3468],
      [0.0642, -0.3268],
      [0.0532, -0.3082],
      [0.0398, -0.2918],
      [0.0285, -0.2795],
      [0.0236, -0.2715],
      [0.0224, -0.2585],
      [0.0218, -0.252],
      [0, -0.252],
    ],
  });
  b.cylAxis({ axis: 'y', x: 0, y: 0.0752, z: -0.36, len: 0.0052, r: 0.0016, mat: 'steel', seg: 8 }); // front sight pin
  b.cyl({ z0: -0.2525, z1: -0.2, r0: 0.0118, mat: 'handleWood', seg: 12 }); // tail boom
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * PI * 2 + PI / 4;
    b.box({ x: Math.cos(a) * 0.0138, y: Math.sin(a) * 0.0138, z: -0.225, w: 0.0024, h: 0.0024, d: 0.05, mat: 'steel', r: 0.0005 }); // folded fins
  }
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

// Stielhandgranate 24 "potato masher": 360 mm long, head 70 mm across (Wikipedia).
// Sheet-steel head holding the charge, rolled seams at the lid and the base,
// painted field grey with the white stencil "Vor Gebrauch Sprengkapsel einsetzen"
// (insert the detonator before use) and a belt hook; hollow wooden handle with the
// steel ferrule screwed into the head and the screw cap at the end over the pull
// cord's porcelain bead. Head height and handle diameter est. from photos.
// Upright: +Y = head; origin at the throwing grip on the handle.
export function stielhandgranate24(b) {
  const G = 'germanGrey';
  const R = 0.035; // head radius
  // Head: threaded boss under it, rolled seam, can, rolled seam, lid.
  latheY(b, {
    mat: G,
    seg: 44,
    profile: [
      [0, 0.1108],
      [0.0152, 0.1108],
      [0.0158, 0.1114],
      [0.0158, 0.1162],
      [0.0302, 0.1166],
      [0.0334, 0.1171],
      [0.035, 0.1182],
      [0.0356, 0.1197],
      [0.0352, 0.1212],
      [R, 0.1222],
      [R, 0.1878],
      [0.0352, 0.1888],
      [0.0356, 0.1903],
      [0.035, 0.1918],
      [0.0334, 0.1929],
      [0.0306, 0.1932],
      [0.03, 0.1926],
      [0.012, 0.1922],
      [0, 0.1924],
    ],
  });
  stamp(b, {
    name: 'm24Head',
    mat: 'paintWhite',
    surf: (s, t) => {
      const a = (s * 0.046) / R;
      return [Math.sin(a) * (R + 0.00008), 0.1555 + t * 0.019, Math.cos(a) * (R + 0.00008)];
    },
  });
  // Belt hook riveted to the back of the head.
  const out = (p) => [p[0], 0, p[2]];
  ribbon(b, { pts: [[0, 0.1852, -0.0357], [0, 0.17, -0.0361], [0, 0.152, -0.0366], [0, 0.1425, -0.0392]], width: 0.011, thick: 0.0012, face: out, mat: 'steel' });
  for (const y of [0.1838, 0.1772]) b.cylAxis({ axis: 'z', x: 0, y, z: -0.0365, len: 0.0012, r: 0.0016, mat: 'steel', seg: 10 });
  // Steel ferrule on the handle, screwed into the boss.
  latheY(b, { mat: 'phosphate', seg: 32, profile: [[0.0129, 0.0935], [0.0139, 0.0939], [0.0144, 0.0952], [0.0144, 0.1088], [0.0152, 0.1094], [0.0152, 0.1108], [0, 0.1108]] });
  // Wooden handle (hollow for the pull cord), very slightly tapered.
  latheY(b, { mat: 'handleWood', seg: 32, profile: [[0.0124, -0.1462], [0.0126, -0.05], [0.0129, 0.0942]] });
  // Screw cap over the end (unscrewed to reach the bead and cord).
  latheY(b, {
    mat: G,
    seg: 32,
    profile: [
      [0, -0.1676],
      [0.0098, -0.1676],
      [0.0127, -0.1669],
      [0.0139, -0.1656],
      [0.0143, -0.1636],
      [0.0143, -0.1496],
      [0.0147, -0.149],
      [0.0147, -0.1471],
      [0.0136, -0.1463],
      [0.0124, -0.1462],
    ],
  });

  b.anchor('gripR', 0, -0.05, 0);
  b.anchor('gripL', 0, -0.16, 0); // unscrews the cap and pulls the cord
  b.anchor('pin', 0, -0.172, 0);
  b.meta.kind = 'grenade';
  b.meta.fuse = 4.5;
}
