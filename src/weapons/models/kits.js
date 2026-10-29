// Medical kits and the adjustable wrench (weapons/items/kits.js), in the gun
// models' toolkit (kit.js: meters, +X right, +Y up, -Z ahead).
//
// These are carried in the right hand, not shouldered, so they are drawn the
// way the hand holds them: a pouch or tin by its right-hand edge (the grip
// anchor, 12 mm in from that edge), its face with the flap, marks and
// fastener toward the man holding it (+Z), its back toward -Z; the wrench by
// its handle, upright like a hammer (the handle running down through the fist,
// the jaws above it opening ahead). meta.picture turns them for the side-view
// pictures of the loadout cards (soldierPreview.js), which look at the gun's
// right side.
//
// Sizes: docs/research/weapons.md, section 10 (mostly estimated from photos
// against the dressings they held: est.).
import { place } from './parts.js';
import { bar, stamp } from './shapes.js';

const PI = Math.PI;

// The anchors and meta every kit shares. work: where the other hand works
// during a treatment (the opened top, a dressing drawn out of it); support:
// under the kit, where it rests on the other hand.
function kitAnchors(b, { W, H, D, cy = 0 }) {
  b.anchor('gripR', 0, cy, 0);
  b.anchor('muzzle', 0.012 - W / 2, cy, -D / 2);
  b.anchor('work', 0.012 - W * 0.55, cy + H / 2 + 0.012, D * 0.15);
  b.anchor('support', 0.012 - W * 0.55, cy - H / 2 - 0.012, 0);
  b.meta.kind = 'kit';
  b.meta.handheld = true;
  b.meta.gripRake = 0;
  b.meta.gripRadius = Math.min(0.02, D / 2);
  b.meta.picture = [0, PI / 2, 0]; // face toward the picture's camera
}

// A sewn canvas or leather pouch: a soft body (rounded box) and a flap over the
// top and down the face, square or rounded at its lower corners. Returns the
// flap's lower edge (y) and the face (z).
function pouch(b, { W, H, D, cy = 0, mat, flapDown = 0.55, flapR = 0.008, bulge = 1.06, tongue = 0 }) {
  const xR = 0.012; // the right-hand edge
  const cx = xR - W / 2;
  const t = Math.max(0.0025, D * 0.06); // flap thickness
  // The body, a little fuller in the middle (stuffed with dressings).
  b.box({ x: cx, y: cy - t / 2, z: 0, w: W, h: H - t, d: D, mat, r: Math.min(0.009, D * 0.3) });
  if (b.detail(1)) b.box({ x: cx, y: cy - t / 2, z: 0, w: W * 0.94, h: (H - t) * 0.9, d: D * bulge, mat, r: Math.min(0.012, D * 0.4) });
  // The flap: over the top and down the face.
  const top = cy + H / 2;
  const fW = W + 0.003;
  b.box({ x: cx, y: top - t / 2, z: 0.0005, w: fW, h: t, d: D + 0.004, mat, r: t * 0.45 });
  const yB = top - (H * flapDown);
  const r = Math.min(flapR, fW / 3, (top - yB) / 3);
  const out = [];
  const corner = (x0, y0, a0) => {
    for (let k = 0; k <= 5; k++) {
      const a = a0 + (k / 5) * (PI / 2);
      out.push([x0 + Math.cos(a) * r, y0 + Math.sin(a) * r]);
    }
  };
  const xl = cx - fW / 2,
    xr = cx + fW / 2;
  out.push([xr, top]);
  out.push([xl, top]);
  corner(xl + r, yB + r, PI);
  if (tongue) {
    // A pointed tongue in the middle of the lower edge (the fastener sits in it).
    out.push([cx - tongue, yB]);
    out.push([cx, yB - tongue * 0.6]);
    out.push([cx + tongue, yB]);
  }
  corner(xr - r, yB + r, PI * 1.5);
  const face = D / 2 + t / 2 + 0.0005;
  place(b, { pos: [0, 0, face], rot: [0, -PI / 2, 0] }, () => {
    b.extrude({ points: out.map(([x, y]) => [-x, y]), width: t, mat, bevel: Math.min(0.0012, t * 0.4) });
  });
  return { cx, yB: yB - (tongue ? tongue * 0.6 : 0), top, face: face + t / 2, t };
}

// A lift-the-dot fastener: the stud on the body under the flap's ringed eyelet.
function liftTheDot(b, { x, y, z }) {
  b.cylAxis({ axis: 'z', x, y, z: z + 0.0006, len: 0.0014, r: 0.0068, mat: 'steelDark', seg: 18 });
  b.cylAxis({ axis: 'z', x, y, z: z + 0.0018, len: 0.0026, r: 0.0042, mat: 'steelDark', seg: 16 });
  b.sphere({ x, y, z: z + 0.003, r: 0.0042, sz: 0.35, mat: 'steelDark', seg: 14 });
}

// A red cross on a white disc (or square), painted on a face at z.
function redCross(b, { x, y, z, r, square = false }) {
  if (square) b.box({ x, y, z: z + 0.0003, w: r * 2, h: r * 2, d: 0.0006, mat: 'whitePaint', r: 0.0002 });
  else b.cylAxis({ axis: 'z', x, y, z: z + 0.0003, len: 0.0006, r, mat: 'whitePaint', seg: 28 });
  const a = r * 1.3,
    w = r * 0.42;
  b.box({ x, y, z: z + 0.0008, w: a, h: w, d: 0.0006, mat: 'redPaint', r: 0.0001 });
  b.box({ x, y, z: z + 0.0008, w, h: a, d: 0.0006, mat: 'redPaint', r: 0.0001 });
}

// "U.S." inked on a face at z.
function usInk(b, { x, y, z, w }) {
  const h = w * 0.5;
  stamp(b, { name: 'usInk', at: [x, y, z], w, h, surf: (s, t) => [x + s * w, y + t * h, z + 0.0004], n: 1 });
}

// M-1924 first aid pouch: khaki canvas, the flap down most of the face and
// closed by a lift-the-dot fastener, "U.S." on it, a wire hook on the back for
// the cartridge belt's eyelets. It held the Carlisle dressing in its tin.
// About 12 x 7.5 x 3.5 cm (est.).
export function firstaid_us(b) {
  const W = 0.075,
    H = 0.12,
    D = 0.035;
  const p = pouch(b, { W, H, D, mat: 'webbing', flapDown: 0.62, flapR: 0.012 });
  liftTheDot(b, { x: p.cx, y: p.yB + 0.013, z: p.face });
  if (b.detail(0)) usInk(b, { x: p.cx, y: p.top - 0.025, z: p.face, w: 0.032 });
  // M-1910 wire hanger on the back.
  if (b.detail(1)) {
    for (const s of [-1, 1]) {
      const x = p.cx + s * 0.012;
      bar(b, { pts: [[x, p.top - 0.01, -D / 2 - 0.001], [x, p.top + 0.012, -D / 2 - 0.004], [x, p.top + 0.004, -D / 2 - 0.009], [x, p.top - 0.03, -D / 2 - 0.008]], r: 0.0012, mat: 'steelDark', seg: 6 });
    }
  }
  kitAnchors(b, { W, H, D });
}

// Verbandpäckchen tin: a flat tinplate box in field grey with a hinged lid, a
// red cross on a white disc. About 12 x 8 x 3.2 cm (est., from the packet
// itself, 11.5 x 5 x 3 cm).
export function firstaid_ge(b) {
  const W = 0.12,
    H = 0.08,
    D = 0.032;
  const cx = 0.012 - W / 2;
  // The box and its lid, the lid's rolled edge standing proud of the box.
  b.box({ x: cx, y: 0, z: -0.004, w: W - 0.002, h: H - 0.002, d: D - 0.008, mat: 'feldgrau', r: 0.004 });
  b.box({ x: cx, y: 0, z: D / 2 - 0.0055, w: W, h: H, d: 0.011, mat: 'feldgrau', r: 0.0045 });
  // The lid's pressed panel.
  b.box({ x: cx, y: 0, z: D / 2 - 0.0005, w: W - 0.014, h: H - 0.014, d: 0.0012, mat: 'feldgrau', r: 0.004 });
  // Hinge along the top, latch tab at the bottom.
  if (b.detail(1)) {
    b.cylAxis({ axis: 'x', x: cx, y: H / 2 - 0.0005, z: D / 2 - 0.009, len: W * 0.8, r: 0.0022, mat: 'feldgrau', seg: 10 });
    b.box({ x: cx, y: -H / 2 - 0.002, z: D / 2 - 0.004, w: 0.016, h: 0.007, d: 0.0018, mat: 'feldgrau', r: 0.0008 });
  }
  redCross(b, { x: cx, y: 0.004, z: D / 2, r: 0.017 });
  kitAnchors(b, { W, H, D });
}

// Soviet first aid sumka: a small khaki canvas pouch, the flap closed by a
// strap and a button, a red cross on a white disc on it. About 13 x 10 x 4 cm
// (est.).
export function firstaid_su(b) {
  const W = 0.1,
    H = 0.13,
    D = 0.04;
  const p = pouch(b, { W, H, D, mat: 'canvasSoviet', flapDown: 0.5, flapR: 0.004 });
  // Strap from the flap down the face to a button on the body.
  b.box({ x: p.cx, y: p.yB - 0.006, z: p.face - 0.0006, w: 0.016, h: 0.03, d: 0.0025, mat: 'canvasSoviet', r: 0.001 });
  b.cylAxis({ axis: 'z', x: p.cx, y: p.yB - 0.016, z: D / 2 + 0.003, len: 0.004, r: 0.0055, mat: 'bakeliteBlack', seg: 14 });
  redCross(b, { x: p.cx, y: p.top - 0.03, z: p.face, r: 0.016 });
  kitAnchors(b, { W, H, D });
}

// A US aidman's pouch (one of the pair he wore on his suspenders): olive drab
// canvas, the flap closed by two lift-the-dot fasteners, "U.S." on it. About
// 18 x 20 x 9 cm (est.).
export function medic_us(b) {
  const W = 0.2,
    H = 0.18,
    D = 0.09;
  const p = pouch(b, { W, H, D, mat: 'canvas', flapDown: 0.45, flapR: 0.01, bulge: 1.04 });
  for (const s of [-1, 1]) liftTheDot(b, { x: p.cx + s * 0.05, y: p.yB + 0.014, z: p.face });
  if (b.detail(0)) usInk(b, { x: p.cx, y: p.top - 0.032, z: p.face, w: 0.05 });
  // The snap tabs that hang it on the suspender, at the back.
  if (b.detail(1)) for (const s of [-1, 1]) b.box({ x: p.cx + s * 0.06, y: p.top - 0.02, z: -D / 2 - 0.002, w: 0.025, h: 0.05, d: 0.003, mat: 'canvas', r: 0.001 });
  kitAnchors(b, { W, H, D });
}

// German medic's belt pouch (Sanitätstasche, worn in pairs): russet leather,
// the flap held down by a strap through a steel buckle. About 17 x 14 x 8 cm
// (est.).
export function medic_ge(b) {
  const W = 0.17,
    H = 0.14,
    D = 0.08;
  const p = pouch(b, { W, H, D, mat: 'leather', flapDown: 0.7, flapR: 0.018, bulge: 1.0, tongue: 0.02 });
  // Strap down the face from under the flap's tongue, through a roller buckle.
  b.box({ x: p.cx, y: p.yB - 0.012, z: p.face - 0.0004, w: 0.018, h: 0.05, d: 0.0028, mat: 'leather', r: 0.001 });
  if (b.detail(1)) {
    const y = p.yB + 0.003;
    for (const [w, h, dx, dy] of [
      [0.026, 0.003, 0, 0.011],
      [0.026, 0.003, 0, -0.011],
      [0.003, 0.025, 0.0115, 0],
      [0.003, 0.025, -0.0115, 0],
    ])
      b.box({ x: p.cx + dx, y: y + dy, z: p.face + 0.0015, w, h, d: 0.003, mat: 'steelDark', r: 0.0008 });
    b.box({ x: p.cx, y, z: p.face + 0.002, w: 0.002, h: 0.02, d: 0.0025, mat: 'steelDark', r: 0.0006 }); // tongue of the buckle
  }
  // Belt loops behind.
  if (b.detail(1)) for (const s of [-1, 1]) b.box({ x: p.cx + s * 0.045, y: 0.01, z: -D / 2 - 0.0025, w: 0.03, h: 0.07, d: 0.004, mat: 'leather', r: 0.0015 });
  kitAnchors(b, { W, H, D });
}

// Red Army sanitary bag: a khaki canvas satchel with a big flap, the red cross
// on a white disc, two straps with buckles and rings for the shoulder strap.
// About 28 x 22 x 11 cm (est.; dealers give 30 x 25 x 13).
export function medic_su(b) {
  const W = 0.26,
    H = 0.2,
    D = 0.1;
  const p = pouch(b, { W, H, D, mat: 'canvasSoviet', flapDown: 0.75, flapR: 0.02, bulge: 1.03 });
  redCross(b, { x: p.cx, y: p.top - 0.065, z: p.face, r: 0.032 });
  for (const s of [-1, 1]) {
    const x = p.cx + s * 0.08;
    b.box({ x, y: p.yB - 0.006, z: p.face - 0.0006, w: 0.016, h: 0.06, d: 0.0025, mat: 'canvasSoviet', r: 0.001 });
    if (b.detail(1)) b.box({ x, y: p.yB + 0.012, z: p.face + 0.001, w: 0.021, h: 0.016, d: 0.0025, mat: 'steelDark', r: 0.002 });
    // Shoulder strap rings at the sides.
    if (b.detail(1)) b.cylAxis({ axis: 'z', x: p.cx + s * (W / 2 + 0.004), y: p.top - 0.02, z: 0, len: 0.003, r: 0.009, mat: 'steelDark', seg: 12 });
  }
  kitAnchors(b, { W, H, D });
}

// 12 inch adjustable wrench, as in vehicle and tank tool rolls: a forged
// handle with a hanging hole at its end, and the head, its opening facing out
// past the end of the handle at 15 deg to it like an open-end spanner's: a
// fixed jaw on one side, a jaw sliding across on the other, moved by a knurled
// worm under it. Drawn upright in the hand: the handle along -Y through the
// fist, the opening up and a little ahead; the head 16 mm thick and the
// handle 9 mm (est. from a 12 in Crescent pattern wrench, 305 mm long).
export function wrench(b) {
  const tilt = (15 * PI) / 180;
  // Head frame: h out along the opening, s across it (toward -Z); the head is
  // placed so that its neck (s 0, h -0.056) meets the top of the handle.
  const O = [-Math.sin(tilt), Math.cos(tilt)],
    A = [-Math.cos(tilt), -Math.sin(tilt)];
  const neck = 0.16;
  const C = [0.056 * O[0], neck + 0.056 * O[1]];
  const H = (s, h) => [C[0] + s * A[0] + h * O[0], C[1] + s * A[1] + h * O[1]];
  const headPts = [
    [0.011, -0.004],
    [0.011, 0.043],
    [0.016, 0.05],
    [0.026, 0.049],
    [0.032, 0.041],
    [0.034, 0.012],
    [0.034, -0.018],
    [0.029, -0.036],
    [0.016, -0.049],
    [0.0095, -0.058],
    [-0.0095, -0.058],
    [-0.018, -0.05],
    [-0.031, -0.038],
    [-0.036, -0.02],
    [-0.035, -0.007],
    [-0.012, -0.007],
    [-0.011, -0.004],
  ].map(([s, h]) => H(s, h));
  // The window the worm turns in.
  const win = [
    [-0.027, -0.031],
    [-0.005, -0.031],
    [-0.005, -0.016],
    [-0.027, -0.016],
  ].map(([s, h]) => H(s, h));
  b.extrude({ points: headPts, holes: b.detail(1) ? [win] : [], width: 0.016, mat: 'steel', bevel: 0.0018 });
  // Handle: a little wider toward the end, rounded, with its hanging hole.
  const end = -0.046;
  const handle = [[0.0102, neck + 0.004], [0.0118, end + 0.012]];
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * PI;
    handle.push([Math.cos(a) * 0.0118, end + 0.012 - Math.sin(a) * 0.0118]);
  }
  handle.push([-0.0118, end + 0.012], [-0.0102, neck + 0.004]);
  const hole = [];
  for (let k = 0; k < 12; k++) hole.push([Math.cos((k / 12) * 2 * PI) * 0.004, end + 0.012 + Math.sin((k / 12) * 2 * PI) * 0.004]);
  b.extrude({ points: handle, holes: b.detail(1) ? [hole] : [], width: 0.009, mat: 'steel', bevel: 0.0015 });
  // The sliding jaw (a part of its own), its rack running down into the head.
  b.part('jaw', [0, C[1], C[0]]);
  const jaw = [
    [-0.011, -0.006],
    [-0.011, 0.04],
    [-0.016, 0.046],
    [-0.025, 0.045],
    [-0.031, 0.037],
    [-0.033, 0.012],
    [-0.034, -0.006],
  ].map(([s, h]) => H(s, h));
  b.extrude({ points: jaw, width: 0.0145, mat: 'steelBright', bevel: 0.0012 });
  b.body();
  // The worm across the head, under the sliding jaw.
  if (b.detail(1)) {
    const [wz, wy] = H(-0.016, -0.0235);
    const rot = [PI / 2 - tilt, 0, 0];
    place(b, { pos: [0, wy, wz], rot }, () => b.cylAxis({ axis: 'z', len: 0.02, r: 0.0058, mat: 'steelBright', seg: 18 }));
    if (b.detail(0))
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * 2 * PI;
        place(b, { pos: [0, wy, wz], rot }, () => b.box({ x: Math.cos(a) * 0.0059, y: Math.sin(a) * 0.0059, z: 0, w: 0.0012, h: 0.0012, d: 0.0195, mat: 'steel', r: 0.0002 }));
      }
  }
  const [jz, jy] = H(0, 0.016);
  b.anchor('gripR', 0, 0, 0);
  b.anchor('muzzle', 0, jy, jz);
  b.anchor('jaw', 0, jy, jz); // the nut it turns: the wrench swings about it
  b.anchor('support', 0, -0.07, 0.02);
  b.anchor('work', 0, 0.1, 0.02);
  b.meta.kind = 'wrench';
  b.meta.handheld = true;
  b.meta.gripRake = 0;
  b.meta.gripRadius = 0.012;
  b.meta.picture = [-PI / 2, 0, 0]; // lying along, the jaws to the right
}
