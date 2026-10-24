// German Wehrmacht (Heer and Luftwaffe paratroopers), Normandy, summer 1944.
//   Infantry: M40 or M42 Stahlhelm (bare, net, or splinter cover; field cap on
//     some), M40 (pleated pockets, scalloped flaps) or M43 Feldbluse in field
//     grey with collar tabs, shoulder straps with white infantry piping and the
//     breast eagle; M40 trousers in marching boots, or Keilhose with canvas
//     gaiters and ankle boots; black leather belt and Y-straps, K98 cartridge
//     pouches (MP40 pouches for SMG men, P38 holster for MG gunners), bread bag
//     with canteen and cup, mess tin, gas mask can with gas cape bag, short
//     spade with the bayonet, stick grenade.
//   Recon: splinter-pattern smock over the tunic, covered helmet, binoculars.
//   Paratrooper: rimless M38 helmet (cover or net), Knochensack smock in
//     splinter or water pattern, bloused trousers over side-laced jump boots,
//     12-pocket bandolier.
//   Tank crew: black wrap jacket with pink piping and skull collar patches,
//     black trousers, black field cap, P38 holster.
import { registerOutfits, CELL, CAMO_GREY, PI, torsoWeights, pouch, buckle, rigidAt, torsoTheta } from './soldierKit.js';
import { buildHelmet, buildSideCap, buildFieldCap, canteenGE, breadBag, gasMaskCan, messTin, spadeGE, bayonet, k98Pouches, magPouch, holster, binocularCase, bandolier, stickGrenade, torsoFrame } from './soldierGear.js';

export const GE = {
  tunicM40: 0x5e6450, // feldgrau, greenish
  tunicM43: 0x66654f, // later feldgrau, browner
  trousers: 0x5f6155, // feldgrau / steingrau
  collarDark: 0x2f3a30, // bottle green (M36 collars, still seen)
  boots: 0x1c1a17,
  sole: 0x141210,
  leather: 0x1d1a17,
  buckle: 0x5f6258,
  bag: 0x6a6850,
  bagTan: 0x7e7558,
  felt: 0x5e4632,
  can: 0x50564a,
  messTin: 0x4c5046,
  helmet: 0x4c5048,
  helmetIn: 0x3a2c20,
  strap: 0x1e1b18,
  chinstrap: 0x1e1b18,
  gaiters: 0x6c6850,
  canvas: 0x7a7050, // MP40 pouches
  black: 0x1c1c1e,
  pink: 0xc47a88,
  piping: 0xdcdcd2, // white: infantry
  pipingRecon: 0xb8862e, // golden yellow: reconnaissance
  litzen: 0x8a8c80,
  eagle: 0x8e9084,
  fjTrousers: 0x5c6052,
  fjHelmet: 0x4a4e45,
  cover: 0x7a7458,
  metal: 0x4c4c46,
};

// Belt, harness and the kit hanging on it.
function beltKit(o, { y = 1.07, role = o.role, bread = true, can = true, spade = true, harness = true, bandolierFJ = false } = {}) {
  const b = o.b;
  const lod = o.lod;
  o.belt(y, 0.045, { color: GE.leather, cell: CELL.leather, thick: 0.005 });
  buckle(b, o.beltFrame(-PI / 2, y - 0.0225, 0.006), { w: 0.062, h: 0.05, color: GE.buckle, lod });
  if (lod === 0) {
    // The buckle's eagle roundel.
    const f = o.beltFrame(-PI / 2, y - 0.0225, 0.0118);
    b.bones(rigidAt(f));
    b.paint(0x6a6e64);
    f.ell(b, 0, 0, 0, 0.017, 0.017, 0.0015, { nu: 12, nv: 3 });
  }
  // Ammunition.
  if (role === 'smg') {
    for (const s of [-1, 1]) magPouch(b, o.beltFrame(-PI / 2 + s * 0.85, y - 0.004, 0.006), { kind: 'MP40', color: o.shade(GE.canvas, 0.06), lod, metal: GE.metal });
  } else if (role === 'mg') {
    holster(b, o.beltFrame(-PI / 2 - 0.9, y - 0.03, 0.008), { color: GE.leather, lod, kind: 'GE' });
    pouch(b, o.beltFrame(-PI / 2 + 0.8, y - 0.004, 0.006), { w: 0.11, h: 0.12, d: 0.04, color: GE.leather, cell: CELL.leather, lod, fastener: 'strap' });
  } else if (!bandolierFJ) {
    for (const s of [-1, 1]) k98Pouches(b, o.beltFrame(-PI / 2 + s * 0.78, y - 0.002, 0.006), GE, lod);
  }
  // Y-straps: from the front pouches over the shoulders to a ring at the back,
  // one strap down to the belt.
  if (harness && lod < 2) {
    for (const s of [-1, 1]) {
      o.strap(
        [
          { x: s * 0.092, y: y + 0.005, side: -1 },
          { x: s * 0.098, y: 1.3, side: -1 },
          { x: s * 0.108, y: 1.43, side: -1 },
          { t: s < 0 ? PI : 0, y: 1.474 },
          { x: s * 0.1, y: 1.42, side: 1 },
          { x: s * 0.03, y: 1.3, side: 1 },
          { x: 0, y: 1.26, side: 1 },
        ],
        0.026,
        0.004,
        { color: GE.leather, cell: CELL.leather, out: 0.004 },
      );
    }
    o.strap([{ x: 0, y: 1.27, side: 1 }, { x: 0, y: y - 0.01, side: 1 }], 0.03, 0.004, { color: GE.leather, cell: CELL.leather, out: 0.004 });
    // Ring where the straps meet.
    const f = torsoFrame(o.g, PI / 2, 1.265, 0.01);
    b.bones(rigidAt(f));
    b.material(CELL.metal);
    b.paint(GE.metal);
    b.part();
    f.box(b, 0, 0, 0, 0.03, 0.03, 0.005, { r: 0.008 });
  }
  if (bread) {
    const f = o.beltFrame(0.95, y - 0.045, 0.008);
    breadBag(b, f, { ...GE, bag: o.shade(o.chance(0.5) ? GE.bag : GE.bagTan, 0.05) }, lod);
    if (lod < 2) canteenGE(b, f.sub(0.06, -0.03, 0.082), GE, lod);
    if (lod === 0 && o.chance(0.5)) messTin(b, f.sub(-0.08, -0.02, 0.082), GE, lod);
  }
  if (can) gasMaskCan(b, o.beltFrame(2.05, y + 0.08, 0.02), GE, lod, { cape: o.chance(0.7) });
  if (spade && lod < 2) {
    const f = o.beltFrame(2.75, y - 0.045, 0.006);
    spadeGE(b, f, GE, lod);
    bayonet(b, f.sub(0.0, 0.02, 0.032), { len: 0.3, color: 0x1e1e1c, grip: 0x3a2618, lod, frog: GE.leather });
  }
}

// Field blouse: M40 or M43.
function feldbluse(o, model, { color, piping = GE.piping } = {}) {
  const b = o.b;
  const c = color;
  o.torso({ hem: 0.79, belt: 1.045, cinch: 0.011, blouse: 0.012, flare: 0.014, grow: 0.011, placket: true, folds: 1.1 }, { color: c, cell: CELL.wool });
  const collarC = model === 'M40' && o.chance(0.25) ? GE.collarDark : c;
  o.collar('standFall', collarC, { cell: CELL.wool, h: 0.038 });
  o.sleeves({ color: c, cell: CELL.wool, cuff: 'band', bulk: 0.003 });
  b.material(CELL.wool);
  const pleat = model === 'M40';
  const flapShape = model === 'M40' ? 'scallop' : 'straight';
  for (const s of [-1, 1]) {
    o.pocket(s * 0.088, 1.41, 0.105, 0.125, { color: c, flapH: 0.045, flapShape, button: 0x55574c, pleat });
    o.pocket(s * 0.1, 1.0, 0.135, 0.15, { color: c, flapH: 0.055, flapShape, button: 0x55574c, pleat });
  }
  o.buttons([[0.0, 1.08], [0.0, 1.17], [0.0, 1.26], [0.0, 1.35], [0.0, 1.43]], { color: 0x55574c, r: 0.0075 });
  o.shoulderStraps({ color: c, piping, w: 0.042, len: 0.115, thick: 0.006, button: 0x55574c });
  if (o.lod === 0) {
    // Collar tabs (Litzen) and the breast eagle over the right pocket.
    for (const s of [-1, 1]) {
      // On the collar's fall, either side of the front.
      const f = o.collarFrame(s * 0.68, 1.493, 0.0065);
      b.bones(torsoWeights);
      b.material(CELL.wool);
      b.paint(GE.collarDark);
      b.part(false);
      f.box(b, 0, 0, 0.0, 0.042, 0.02, 0.002, { r: 0.0008, rot: [0, 0, s * -0.12] });
      b.paint(GE.litzen);
      for (const dy of [-0.0045, 0.0045]) f.box(b, 0, dy, 0.0012, 0.038, 0.0032, 0.0015, { r: 0.0006, rot: [0, 0, s * -0.12] });
    }
    const th = torsoTheta(0.088, 1.44, -1);
    const f = torsoFrame(o.g, th, 1.445, 0.006, { plumb: false });
    b.bones(torsoWeights);
    b.paint(GE.eagle);
    b.part(false);
    for (const d of [-1, 1]) f.box(b, d * 0.022, 0.004, 0, 0.042, 0.012, 0.0015, { r: 0.002, rot: [0, 0, d * -0.22] });
    f.box(b, 0, -0.006, 0, 0.012, 0.014, 0.0015, { r: 0.003 });
  }
}

function headgear(o, st, { allowCap = true, cover = 0.15, net = 0.2 } = {}) {
  const b = o.b;
  const lod = o.lod;
  if (allowCap && o.chance(0.12)) {
    o.info.headgear = 'cap';
    buildFieldCap(b, st, { lod, color: o.shade(GE.tunicM43, 0.05) });
    return;
  }
  const r = o.r();
  const kind = o.chance(0.45) ? 'M42' : 'GE';
  buildHelmet(b, kind, GE, {
    lod,
    cover: r < cover ? 'splinter' : null,
    net: r >= cover && r < cover + net,
    band: o.chance(0.3),
    chin: o.pick(['chin', 'chin', 'back', 'loose']),
    seed: o.variant + 20,
    paint: o.shade(GE.helmet, 0.05),
  });
}

function infantry(o) {
  const b = o.b;
  const lod = o.lod;
  o.dirt = 0.3 + 0.5 * o.r();
  const boots = o.chance(0.6);
  const model = o.chance(0.5) ? 'M40' : 'M43';
  const tc = o.shade(model === 'M40' ? GE.tunicM40 : GE.tunicM43, 0.05, o.r() * 0.15);
  if (boots) o.trousers({ color: o.shade(GE.trousers, 0.05), style: 'straight', end: 0.49, blouse: 0.004 });
  else o.trousers({ color: o.shade(GE.trousers, 0.05), style: 'straight', end: 0.72, blouse: 0.006 });
  feldbluse(o, model, { color: tc });
  if (boots) o.tallBoots({ color: GE.boots, sole: GE.sole, s0: 0.46, gloss: 0.3, folds: 1 });
  else {
    o.gaiters({ color: o.shade(GE.gaiters, 0.06), strap: GE.leather });
    o.shoes({ color: GE.boots, sole: GE.sole, high: 0.14, gloss: 0.2 });
  }
  beltKit(o, {});
  if (lod === 0 && o.chance(0.35)) stickGrenade(b, o.beltFrame(-PI / 2 - 0.35, 1.06, 0.012), lod);
  // A Zeltbahn rolled on the back of the belt.
  if (lod < 2 && o.chance(0.3)) {
    const f = o.beltFrame(PI / 2, 1.0, 0.03);
    b.bones(rigidAt(f));
    b.material(CELL.splinter);
    b.paint(CAMO_GREY);
    b.part();
    f.cyl(b, [-0.15, 0, 0.0], [0.15, 0, 0.0], 0.04, 0.04, { seg: lod ? 6 : 12 });
  }
  headgear(o, GE);
  o.weather(o.dirt);
}

function recon(o) {
  const b = o.b;
  const lod = o.lod;
  o.dirt = 0.35 + 0.4 * o.r();
  o.trousers({ color: o.shade(GE.trousers, 0.05), style: 'straight', end: 0.49, blouse: 0.004 });
  // Splinter smock (pullover) over the tunic: loose, thigh length, laced neck.
  o.torso({ hem: 0.74, belt: 1.045, cinch: 0.012, blouse: 0.016, flare: 0.02, grow: 0.016, folds: 1.3 }, { color: CAMO_GREY, cell: CELL.splinter });
  o.collar('fold', CAMO_GREY, { cell: CELL.splinter });
  o.sleeves({ color: CAMO_GREY, cell: CELL.splinter, cuff: 'band', bulk: 0.008, wide: 0.003 });
  for (const s of [-1, 1]) o.patch(s * 0.1, 1.33, 0.13, 0.03, { color: CAMO_GREY, cell: CELL.splinter, thick: 0.006, bulge: 0.002 });
  o.tallBoots({ color: GE.boots, sole: GE.sole, s0: 0.46, gloss: 0.3, folds: 1 });
  beltKit(o, { bread: true, can: o.chance(0.5), spade: o.chance(0.5) });
  binocularCase(b, torsoFrame(o.g, -PI / 2 + 0.35, 1.25, 0.012), { color: 0x1c1a17, lod });
  headgear(o, GE, { allowCap: true, cover: 0.6, net: 0.2 });
  o.weather(o.dirt);
}

function paratrooper(o) {
  const b = o.b;
  const lod = o.lod;
  o.dirt = 0.35 + 0.45 * o.r();
  const water = o.chance(0.35);
  const cell = water ? CELL.waterCamo : CELL.splinter;
  o.trousers({ color: o.shade(GE.fjTrousers, 0.05), style: 'jump', end: 0.795, blouse: 0.012, bulk: 0.007 });
  // Knochensack: loose, thigh length, legs closed by press studs.
  o.torso({ hem: 0.67, belt: 1.05, cinch: 0.012, blouse: 0.016, flare: 0.022, grow: 0.016, placket: true, folds: 1.3 }, { color: CAMO_GREY, cell });
  o.collar('fold', CAMO_GREY, { cell });
  o.sleeves({ color: CAMO_GREY, cell, cuff: 'band', bulk: 0.008, wide: 0.004 });
  for (const s of [-1, 1]) {
    o.pocket(s * 0.09, 1.38, 0.13, 0.03, { color: CAMO_GREY, flapH: 0.03 });
    o.pocket(s * 0.1, 0.93, 0.15, 0.15, { color: CAMO_GREY, flapH: 0.045, button: 0x4a4a44 });
  }
  if (lod === 0) {
    // Luftwaffe eagle on the right breast.
    const f = torsoFrame(o.g, torsoTheta(0.09, 1.43, -1), 1.43, 0.006, { plumb: false });
    b.bones(torsoWeights);
    b.material(CELL.cotton);
    b.paint(0x9a9a92);
    b.part(false);
    for (const d of [-1, 1]) f.box(b, d * 0.02, 0, 0, 0.04, 0.011, 0.0015, { r: 0.002, rot: [0, 0, d * 0.12] });
  }
  // Side-laced jump boots.
  o.shoes({ color: GE.boots, sole: GE.sole, high: 0.17, gloss: 0.2 });
  const smg = o.role === 'smg';
  beltKit(o, { bread: true, can: false, spade: o.chance(0.6), harness: true, bandolierFJ: !smg });
  if (!smg) bandolier(b, o.g, GE, { lod, kind: 'FJ', color: water ? 0x7c7860 : 0x6a6c5a });
  // FJ gas mask in its cloth bag on the left.
  if (lod < 2) pouch(b, o.beltFrame(2.2, 1.0, 0.012), { w: 0.13, h: 0.24, d: 0.07, color: o.shade(GE.fjTrousers, 0.04), cell: CELL.duck, lod, fastener: 'button', r: 0.03 });
  buildHelmet(b, 'FJ', GE, {
    lod,
    cover: o.chance(0.45) ? 'splinter' : null,
    net: o.chance(0.3),
    band: o.chance(0.3),
    chin: 'chin',
    seed: o.variant + 30,
    paint: o.shade(GE.fjHelmet, 0.05),
  });
  o.weather(o.dirt);
}

function tanker(o) {
  const b = o.b;
  const lod = o.lod;
  o.dirt = 0.2 + 0.35 * o.r();
  o.info.headgear = 'cap';
  const black = o.shade(GE.black, 0.08);
  o.trousers({ color: black, style: 'straight', end: 0.825, blouse: 0.003, waistband: true, seatTop: 1.07 });
  // Short double-breasted wrap jacket with wide lapels.
  o.torso({ hem: 0.93, belt: 0.97, cinch: 0.0, blouse: 0.0, flare: 0.0, grow: 0.012, placket: true, placketX: -0.06, folds: 0.8 }, { color: black, cell: CELL.wool });
  o.collar('open', black, { cell: CELL.wool, open: 0.8, shirt: o.shade(0x6a6a5e, 0.05) });
  o.sleeves({ color: black, cell: CELL.wool, cuff: 'band', bulk: 0.003 });
  o.buttons([[0.07, 1.1], [0.07, 1.22], [0.07, 1.34]], { color: 0x2a2a2a, r: 0.009 });
  o.shoulderStraps({ color: black, piping: GE.pink, w: 0.04, len: 0.11, thick: 0.005, button: 0x2a2a2a });
  if (lod === 0) {
    // Skull collar patches on the lapels, with pink piping.
    for (const s of [-1, 1]) {
      const f = torsoFrame(o.g, -PI / 2 + s * 0.48, 1.42, 0.012, { plumb: false });
      b.bones(torsoWeights);
      b.material(CELL.wool);
      b.paint(GE.pink);
      b.part(false);
      f.box(b, 0, 0, 0, 0.042, 0.032, 0.002, { r: 0.001, rot: [0, 0, s * 0.5] });
      b.paint(0x111112);
      f.box(b, 0, 0, 0.001, 0.038, 0.028, 0.002, { r: 0.001, rot: [0, 0, s * 0.5] });
      b.material(CELL.metal);
      b.paint(0xb8b8b0);
      f.ell(b, 0, 0.002, 0.0025, 0.0055, 0.0065, 0.0015, { nu: 8, nv: 3 });
    }
  }
  o.shoes({ color: GE.boots, sole: GE.sole, high: 0.14, gloss: 0.25 });
  o.belt(1.04, 0.045, { color: GE.leather, cell: CELL.leather });
  buckle(b, o.beltFrame(-PI / 2, 1.0175, 0.006), { w: 0.055, h: 0.045, color: 0x4a4a46, frame: true, lod });
  holster(b, o.beltFrame(-PI / 2 - 0.9, 1.01, 0.008), { color: GE.leather, lod, kind: 'GE' });
  if (o.role === 'smg') magPouch(b, o.beltFrame(-PI / 2 + 0.85, 1.036, 0.006), { kind: 'MP40', color: o.shade(GE.canvas, 0.06), lod });
  if (o.chance(0.5)) buildSideCap(b, GE, { lod, color: black, badge: 'eagle', tilt: 0.1, german: true });
  else buildFieldCap(b, GE, { lod, color: black });
  o.weather(o.dirt);
}

registerOutfits('GE', {
  infantry: { variants: 8, build: infantry },
  recon: { variants: 4, build: recon },
  paratrooper: { variants: 5, build: paratrooper },
  tanker: { variants: 3, build: tanker },
});
