// Pocket pistols (weapons/items/pocket.js): the Colt M1903, the Beretta M1934
// and the Korovin TK. Built like the service pistols (the M1911A1 in us.js, the
// P38 in german.js): the frame and grips as side outlines, the slide lofted
// from its cross sections (it is the 'bolt' part, that runs back on firing),
// the magazine in the grip as its own part. See kit.js for the coordinate
// conventions: meters, bore along Z at x = y = 0, muzzle toward -Z, trigger at
// z = 0. Lengths and barrels are the makers' figures (docs/research/weapons.md,
// section 10): each model is as long, from the muzzle to the heel of its grip
// or its hammer, as the real pistol; the outlines est. from side views.
import { S, boxMag, trigger, lathe } from './parts.js';
import { plateXYz, screw, sectionLoft, serrations, bar } from './shapes.js';

const PI = Math.PI;

// The slide, lofted along z from z0 (muzzle end) to z1 (rear): hw half width, yt
// its top, yb(z) its underside, rt the radius of its top corners, serr grasping
// grooves { z0, z1, n }, open [za, zb] where the top is cut away over the barrel
// (the channel's walls then stand to wall, its inside down to floor, ci from the
// middle), and extra stations (where the outline steps). The slide goes in the
// current part.
function slide(b, { z0, z1, hw, yt, yb, rt, serr = null, open = null, wall = 0, floor = 0, ci = 0, extra = [], mat }) {
  const sr = serrations(serr?.z0 ?? 0, serr?.z1 ?? 0, serr && b.detail(0) ? serr.n : 0);
  const zs = [z0, z1, ...extra, ...sr.zs];
  if (b.detail(0)) zs.push(z0 + 0.0012, z1 - 0.0012);
  if (open) zs.push(open[0] - 0.0004, open[0], open[1], open[1] + 0.0004);
  const list = zs.filter((z) => z >= z0 && z <= z1).sort((a, c) => a - c).filter((z, i, a) => i === 0 || z - a[i - 1] > 1e-5);
  const K = b.detail(0) ? 5 : 1;
  const c = ci || hw * 0.6;
  const sec = (z) => {
    const cut = open && z > open[0] - 1e-6 && z < open[1] + 1e-6;
    // (The ends a little smaller: their edges catch the light as rounded.)
    const end = z < z0 + 0.0006 || z > z1 - 0.0006 ? 0.0006 : 0;
    const w = hw - sr.depth(z) * 0.0005 - end;
    const y0 = yb(z) + end,
      y1 = (cut ? wall : yt) - end;
    const r = cut ? Math.min(0.0012, w - c - 1e-4) : rt;
    const pts = [[0, y0], [w, y0]];
    for (let k = 0; k <= K; k++) {
      const a = (k / K) * (PI / 2);
      pts.push([w - r + Math.cos(a) * r, y1 - r + Math.sin(a) * r]);
    }
    // The inside of the channel (where the top is closed, it collapses onto
    // the top, so every section has as many points).
    if (cut) pts.push([c, y1], [c, floor], [0, floor]);
    else {
      const cc = Math.min(c, w - r - 1e-4);
      pts.push([cc, y1], [cc * 0.5, y1], [0, y1]);
    }
    const right = pts.slice(1);
    const left = right
      .slice(0, -1)
      .map(([x, y]) => [-x, y])
      .reverse();
    return [pts[0], ...right, ...left];
  };
  sectionLoft(b, { zs: list, section: sec, mat });
}

// Colt Model 1903 Pocket Hammerless, as issued in the war (the "U.S. Property"
// guns, Parkerized with brown plastic grips): .32 ACP, 171 mm long, 95 mm (3.75
// in) barrel, 8-round magazine. A slim slide that runs the whole length, its
// front deep enough to hold the barrel and the recoil spring under it; fine
// grasping grooves at the rear; a small blade and a notch for sights. The
// hammer is inside the frame (hence "hammerless"): a smooth round back, the
// grip safety in the backstrap, the thumb safety on the left, the magazine
// catch at the heel of the grip.
export function colt_1903(b) {
  const P = 'parkerized';
  const MZ = -0.1;
  // --- Frame: rails under the slide, round trigger guard, the grip raked
  // back about 12 degrees.
  b.extrude({
    points: [
      [-0.034, -0.0095],
      [0.06, -0.0095],
      [0.0645, -0.0112],
      [0.0655, -0.016],
      [0.0665, -0.03],
      [0.0695, -0.07],
      [0.0718, -0.0985],
      [0.0708, -0.1035],
      [0.0335, -0.1035],
      [0.0305, -0.098],
      [0.0225, -0.05],
      [0.0195, -0.0405],
      [0.0135, -0.041],
      [-0.006, -0.0412],
      [-0.019, -0.0402],
      [-0.0275, -0.032],
      [-0.034, -0.021],
    ],
    holes: [S([[-0.0235, -0.0125], [0.0085, -0.0125], [0.0125, -0.022], [0.0095, -0.0345], [-0.015, -0.0355], [-0.023, -0.027]], 3)],
    width: 0.0185,
    mat: P,
    bevel: 0.0011,
  });
  // Grip safety in the backstrap, standing proud of it until squeezed.
  b.extrude({ points: S([[0.0628, -0.0135], [0.0672, -0.0145], [0.0695, -0.03], [0.0718, -0.05], [0.0682, -0.052], [0.0662, -0.032], [0.0628, -0.018]], 2), width: 0.013, mat: P, bevel: 0.0009 });
  // Checkered brown plastic grips, a screw through each in its round boss.
  b.extrude({ points: S([[0.0215, -0.0175], [0.0598, -0.0165], [0.0648, -0.03], [0.0678, -0.072], [0.0695, -0.0975], [0.0362, -0.0995], [0.0322, -0.091], [0.0252, -0.048], [0.0205, -0.03]], 3), width: 0.0242, mat: 'checkerPlastic', bevel: 0.0026 });
  for (const s of [-1, 1]) {
    b.cylAxis({ axis: 'x', x: s * 0.0117, y: -0.058, z: 0.047, len: 0.0012, r: 0.0082, mat: 'checkerPlastic', seg: 20 });
    screw(b, { at: [s * 0.0124, -0.058, 0.047], axis: s > 0 ? 'x' : '-x', r: 0.0026, h: 0.0008, mat: P, slot: 0.9 });
  }
  // Thumb safety on the left, behind the grip's top; magazine catch at the heel.
  b.extrude({ points: S([[0.038, -0.0105], [0.055, -0.0108], [0.0595, -0.0124], [0.0555, -0.0162], [0.0445, -0.0158], [0.0388, -0.0142]], 2), width: 0.0018, x: -0.0101, mat: P, bevel: 0.0005 });
  b.span({ z0: 0.0632, z1: 0.0712, y0: -0.1055, y1: -0.1015, w: 0.008, mat: P, r: 0.0012 });
  trigger(b, { z: 0.001, yTop: -0.0115, len: 0.019, curve: 0.005, w: 0.0058, mat: P });
  // Barrel: its muzzle in the front of the slide.
  b.cyl({ z0: MZ - 0.0003, z1: MZ + 0.012, r0: 0.0058, mat: 'steelBright', seg: 18 });
  b.cyl({ z0: MZ - 0.0005, z1: MZ + 0.01, r0: 0.004, mat: 'black', seg: 12 });
  b.anchor('ejectionPort', 0.01, 0.004, -0.012);

  // --- Slide.
  b.part('bolt', [0, 0, 0.06]);
  slide(b, { z0: MZ, z1: 0.0615, hw: 0.0095, yt: 0.0105, yb: (z) => (z < -0.034 ? -0.0215 : -0.0095), rt: 0.0058, serr: { z0: 0.034, z1: 0.0585, n: 14 }, extra: [-0.0344, -0.034], mat: P });
  if (b.detail(0)) {
    b.box({ x: 0.0094, y: 0.0045, z: -0.0115, w: 0.0014, h: 0.0072, d: 0.022, mat: 'black', r: 0.0004 }); // ejection port
    b.cyl({ z0: MZ - 0.0006, z1: MZ + 0.003, r0: 0.0024, y: -0.0145, mat: 'black', seg: 10 }); // recoil spring tunnel
  }
  // Sights: a low blade at the front, a notch at the rear.
  b.extrude({ points: [[-0.096, 0.0102], [-0.09, 0.0102], [-0.0908, 0.0128], [-0.0952, 0.0128]], width: 0.0022, mat: P, bevel: 0.0003 });
  plateXYz(b, { outline: [[-0.0045, 0.0098], [0.0045, 0.0098], [0.004, 0.0128], [0.0011, 0.0128], [0.0011, 0.0114], [-0.0011, 0.0114], [-0.0011, 0.0128], [-0.004, 0.0128]], z0: 0.049, z1: 0.055, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0128, -0.093);
  b.anchor('rearSight', 0, 0.0114, 0.052);
  b.body();

  // --- Magazine in the grip (its floor plate shows), out along the grip.
  const top = [0.03, -0.012];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.0905, depth: 0.0245, width: 0.0112, angle: -0.2, mat: 'steel', plate: 0.004, lip: 0.001, rib: false });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.98, 0.199];

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.064, 0.046);
  b.anchor('trigger', 0, -0.021, 0.0);
  b.anchor('gripL', -0.022, -0.079, 0.042);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.03;
}

// Beretta M1934: 9 mm Corto (.380 ACP), 152 mm long, 94 mm barrel, 7-round
// magazine. The Beretta's open-topped slide: the barrel shows from the front
// sight's bridge back to the breech; the slide's front half runs down round the
// recoil spring under the barrel. Rear grasping grooves, a rounded spur hammer
// standing out behind the slide, the safety lever on the left of the frame,
// brown plastic grips on an upright grip, and the magazine's floor plate with
// the finger rest curling forward under it. Blued.
export function beretta_1934(b) {
  const P = 'steel';
  const MZ = -0.092;
  // Barrel, bare in the slide's open top.
  lathe(b, { mat: P, seg: 24, profile: [[0.0043, MZ], [0.0062, MZ], [0.0069, MZ + 0.001], [0.0071, -0.03], [0.0076, -0.012], [0.0076, 0.004], [0, 0.004]] });
  b.cyl({ z0: MZ - 0.0003, z1: MZ + 0.012, r0: 0.0044, mat: 'black', seg: 12 });
  // --- Frame.
  b.extrude({
    points: [
      [-0.034, -0.0095],
      [0.046, -0.0095],
      [0.051, -0.0085],
      [0.0535, -0.0125],
      [0.0545, -0.03],
      [0.0575, -0.075],
      [0.0605, -0.1005],
      [0.0595, -0.1055],
      [0.0265, -0.1055],
      [0.0235, -0.1],
      [0.0185, -0.05],
      [0.0158, -0.0405],
      [0.0105, -0.0425],
      [-0.008, -0.0412],
      [-0.022, -0.0392],
      [-0.0325, -0.03],
      [-0.034, -0.021],
    ],
    holes: [S([[-0.0235, -0.0125], [0.007, -0.0125], [0.0112, -0.022], [0.0082, -0.034], [-0.016, -0.035], [-0.023, -0.027]], 3)],
    width: 0.0195,
    mat: P,
    bevel: 0.0011,
  });
  // Brown plastic grips.
  b.extrude({ points: S([[0.0172, -0.0195], [0.0478, -0.019], [0.052, -0.032], [0.0555, -0.074], [0.0585, -0.0995], [0.0288, -0.1015], [0.0255, -0.094], [0.0198, -0.048], [0.0165, -0.032]], 3), width: 0.0265, mat: 'bakelite', bevel: 0.0028 });
  for (const s of [-1, 1]) screw(b, { at: [s * 0.0132, -0.062, 0.04], axis: s > 0 ? 'x' : '-x', r: 0.0025, h: 0.0008, mat: P, slot: 0.3 });
  // Safety lever on the left above the grip: a disc and a short arm pointing
  // forward (turned up, "F": safe).
  b.cylAxis({ axis: 'x', x: -0.0107, y: -0.0142, z: 0.036, len: 0.0022, r: 0.0042, mat: P, seg: 16 });
  b.extrude({ points: S([[0.019, -0.0128], [0.035, -0.011], [0.039, -0.0142], [0.035, -0.0176], [0.021, -0.016]], 2), width: 0.0018, x: -0.0118, mat: P, bevel: 0.0005 });
  // Lanyard ring at the bottom of the backstrap, on the left.
  bar(b, { pts: [[-0.0108, -0.098, 0.0525], [-0.0122, -0.1035, 0.0505], [-0.0128, -0.1075, 0.0555], [-0.0122, -0.1035, 0.0605], [-0.0108, -0.098, 0.0585]], closed: true, r: 0.0009, mat: P, seg: 8 });
  trigger(b, { z: 0.0, yTop: -0.0115, len: 0.0195, curve: 0.0055, w: 0.006, mat: P });
  b.anchor('ejectionPort', 0.01, 0.006, -0.008);

  // --- Slide: closed round the muzzle (the front sight's bridge), open over
  // the barrel back to the breech face.
  b.part('bolt', [0, 0, 0.046]);
  slide(b, {
    z0: MZ - 0.0005,
    z1: 0.046,
    hw: 0.0094,
    yt: 0.0105,
    yb: (z) => (z < -0.033 ? -0.0205 : -0.0095),
    rt: 0.0045,
    serr: { z0: 0.022, z1: 0.0435, n: 9 },
    open: [-0.081, -0.006],
    wall: 0.0032,
    floor: -0.0055,
    ci: 0.0074,
    extra: [-0.0334, -0.033],
    mat: P,
  });
  if (b.detail(0)) b.cyl({ z0: MZ - 0.0012, z1: MZ + 0.003, r0: 0.0024, y: -0.0138, mat: 'black', seg: 10 }); // recoil spring
  b.extrude({ points: [[-0.0895, 0.0102], [-0.0835, 0.0102], [-0.0845, 0.0138], [-0.0885, 0.0138]], width: 0.0024, mat: P, bevel: 0.0003 });
  plateXYz(b, { outline: [[-0.0048, 0.0098], [0.0048, 0.0098], [0.0042, 0.0132], [0.0011, 0.0132], [0.0011, 0.0117], [-0.0011, 0.0117], [-0.0011, 0.0132], [-0.0042, 0.0132]], z0: 0.036, z1: 0.0425, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0138, -0.0865);
  b.anchor('rearSight', 0, 0.0117, 0.0392);
  b.body();

  // --- Hammer (cocked back, the spur standing up behind the slide).
  b.part('hammer', [0, -0.006, 0.046]);
  b.extrude({ points: S([[0.043, -0.012], [0.05, -0.013], [0.0545, -0.007], [0.058, 0.0005], [0.0606, 0.006], [0.0596, 0.0095], [0.0556, 0.0098], [0.0526, 0.006], [0.049, -0.0005], [0.044, -0.0045]]), width: 0.0072, mat: P, bevel: 0.0008 });
  if (b.detail(0)) for (let i = 0; i < 4; i++) b.box({ x: 0, y: 0.0078 - i * 0.0016, z: 0.0602 - i * 0.0007, w: 0.0074, h: 0.0006, d: 0.0007, mat: 'black', r: 0, rx: -0.4 });
  b.body();

  // --- Magazine, with the finger rest on its floor plate.
  const top = [0.031, -0.011];
  b.part('mag', [0, top[1], top[0]]);
  const { bottom } = boxMag(b, { top, len: 0.0925, depth: 0.0255, width: 0.0118, angle: -0.1, mat: P, plate: 0.0042, lip: 0.001, rib: false });
  {
    const [zb, yb] = bottom;
    b.extrude({ points: S([[zb + 0.012, yb - 0.0008], [zb - 0.006, yb - 0.0008], [zb - 0.016, yb - 0.0025], [zb - 0.0205, yb - 0.0068], [zb - 0.0185, yb - 0.0098], [zb - 0.014, yb - 0.0058], [zb - 0.004, yb - 0.0048], [zb + 0.012, yb - 0.005]], 3), width: 0.0125, mat: P, bevel: 0.0012 });
  }
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.995, 0.0998];

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.064, 0.039);
  b.anchor('trigger', 0, -0.021, 0.0);
  b.anchor('gripL', -0.022, -0.079, 0.035);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.032;
}

// Korovin TK ("Tulsky Korovin"): 6.35 mm (.25 ACP), 127 mm long, 67.5 mm
// barrel, 8-round magazine; striker fired, so nothing stands out behind the
// slide. A plain slide with rounded edges over the whole barrel and the
// recoil spring, grooves at its rear, a small blade and a notch; black
// ebonite grips with the round panel of the TK monogram; the safety lever on
// the left above the grip, the magazine catch at the heel. Wartime Soviet
// bluing.
export function korovin_tk(b) {
  const P = 'steelDark';
  const MZ = -0.0685;
  // --- Frame.
  b.extrude({
    points: [
      [-0.0305, -0.0085],
      [0.047, -0.0085],
      [0.0512, -0.01],
      [0.0525, -0.016],
      [0.0545, -0.028],
      [0.0565, -0.062],
      [0.0585, -0.0795],
      [0.0575, -0.0838],
      [0.0285, -0.0838],
      [0.026, -0.0785],
      [0.0195, -0.045],
      [0.016, -0.0365],
      [0.0105, -0.0378],
      [-0.006, -0.0386],
      [-0.0175, -0.0352],
      [-0.0255, -0.027],
      [-0.0305, -0.019],
    ],
    holes: [S([[-0.0198, -0.0112], [0.0068, -0.0112], [0.0106, -0.0195], [0.0078, -0.0305], [-0.0125, -0.0312], [-0.0195, -0.0245]], 3)],
    width: 0.0172,
    mat: P,
    bevel: 0.001,
  });
  // Black ebonite grips with a raised round panel for the monogram.
  b.extrude({ points: S([[0.0175, -0.0155], [0.048, -0.0145], [0.0515, -0.027], [0.0545, -0.06], [0.0565, -0.0795], [0.031, -0.0805], [0.028, -0.073], [0.021, -0.044], [0.0165, -0.027]], 3), width: 0.0225, mat: 'bakeliteBlack', bevel: 0.0024 });
  for (const s of [-1, 1]) {
    b.cylAxis({ axis: 'x', x: s * 0.0108, y: -0.03, z: 0.036, len: 0.0012, r: 0.0062, mat: 'bakeliteBlack', seg: 18 });
    screw(b, { at: [s * 0.0112, -0.058, 0.043], axis: s > 0 ? 'x' : '-x', r: 0.0022, h: 0.0007, mat: P, slot: 1.2 });
  }
  // Safety lever (left, on the frame above the grip), magazine catch at the heel.
  b.extrude({ points: S([[0.013, -0.0094], [0.0285, -0.0093], [0.0315, -0.0112], [0.0285, -0.0136], [0.0145, -0.0128]], 2), width: 0.0017, x: -0.0094, mat: P, bevel: 0.0005 });
  b.cylAxis({ axis: 'x', x: -0.0092, y: -0.0113, z: 0.0275, len: 0.0018, r: 0.0022, mat: P, seg: 12 });
  b.span({ z0: 0.051, z1: 0.058, y0: -0.0855, y1: -0.0815, w: 0.007, mat: P, r: 0.001 });
  trigger(b, { z: 0.0005, yTop: -0.0105, len: 0.0172, curve: 0.0045, w: 0.0055, mat: P });
  b.cyl({ z0: MZ - 0.0003, z1: MZ + 0.01, r0: 0.0047, mat: P, seg: 16 });
  b.cyl({ z0: MZ - 0.0005, z1: MZ + 0.008, r0: 0.0032, mat: 'black', seg: 12 });
  b.anchor('ejectionPort', 0.009, 0.004, -0.01);

  // --- Slide.
  b.part('bolt', [0, 0, 0.047]);
  slide(b, { z0: MZ, z1: 0.0468, hw: 0.0086, yt: 0.0095, yb: (z) => (z < -0.0305 ? -0.0185 : -0.0085), rt: 0.0042, serr: { z0: 0.027, z1: 0.0442, n: 10 }, extra: [-0.0309, -0.0305], mat: P });
  if (b.detail(0)) {
    b.box({ x: 0.0085, y: 0.004, z: -0.009, w: 0.0013, h: 0.0062, d: 0.017, mat: 'black', r: 0.0004 }); // ejection port
    b.cyl({ z0: MZ - 0.0006, z1: MZ + 0.003, r0: 0.0021, y: -0.0125, mat: 'black', seg: 10 }); // recoil spring
    b.cyl({ z0: 0.0462, z1: 0.0474, r0: 0.0028, y: 0.0015, mat: 'black', seg: 12 }); // striker hole
  }
  b.extrude({ points: [[-0.065, 0.0092], [-0.06, 0.0092], [-0.0607, 0.0117], [-0.0643, 0.0117]], width: 0.002, mat: P, bevel: 0.0003 });
  plateXYz(b, { outline: [[-0.004, 0.0088], [0.004, 0.0088], [0.0036, 0.0116], [0.001, 0.0116], [0.001, 0.0104], [-0.001, 0.0104], [-0.001, 0.0116], [-0.0036, 0.0116]], z0: 0.0385, z1: 0.0435, mat: P, bevel: 0.0003 });
  b.anchor('frontSight', 0, 0.0117, -0.0625);
  b.anchor('rearSight', 0, 0.0104, 0.041);
  b.body();

  // --- Magazine.
  const top = [0.031, -0.0105];
  b.part('mag', [0, top[1], top[0]]);
  boxMag(b, { top, len: 0.0715, depth: 0.0212, width: 0.0102, angle: -0.12, mat: P, plate: 0.0035, lip: 0.0009, rib: false });
  b.body();
  b.anchor('magWell', 0, top[1], top[0]);
  b.meta.magAxis = [0, -0.993, 0.12];

  b.anchor('muzzle', 0, 0, MZ);
  b.anchor('gripR', 0, -0.065, 0.04);
  b.anchor('trigger', 0, -0.019, 0.0);
  b.anchor('gripL', -0.022, -0.08, 0.036);
  b.meta.sight = 'notch';
  b.meta.boltThrow = 0.026;
}
