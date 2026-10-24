// US Army, Normandy, summer 1944.
//   Infantry: M1 helmet (net, band, scrim; chin straps up, loose or buckled),
//     M1941 field jacket over the OD wool shirt (or the M1943 jacket, or the
//     wool shirt alone with the sleeves rolled), OD wool trousers, M1938 canvas
//     leggings over russet rough-out service shoes, M1923 cartridge belt (BAR
//     men: M1937 BAR belt; SMG men: pistol belt and magazine pouches), M1936
//     suspenders, M1928 haversack, M1910 canteen, first aid pouch, M1943
//     entrenching tool, M1 bayonet, bandolier.
//   Recon: as infantry, helmet net with burlap scrim, M17 binocular case.
//   Paratrooper: M2 helmet with A-yoke and chin cup under net and scrim,
//     M1942 jump jacket and trousers (cargo pockets, field-reinforced elbows and
//     knees), Corcoran jump boots, pistol belt, M3 knife on the leg, flag on the
//     right shoulder, Screaming Eagle on the left.
//   Tank crew: M1938 tanker helmet with M1944 goggles, winter combat jacket or
//     HBT coveralls, M1916 or M3 shoulder holster.
// Colors: OD shade 3 (cotton), OD 33 (wool), OD 7 (1943 items), khaki webbing.
import * as THREE from 'three';
import { registerOutfits, CELL, PI, V, torsoWeights, B, legChain, chainPoint, pouch, buckle, rigidAt } from './soldierKit.js';
import { buildHelmet, buildTankHelmet, canteenUS, firstAidUS, shovelUS, bayonet, backpack, backFrame, bandolier, holster, binocularCase, knife, magPouch } from './soldierGear.js';

export const US = {
  jacketM41: 0x8c805c, // OD shade 3 cotton poplin
  jacketM43: 0x5b5640, // OD 7 sateen
  shirt: 0x6e5d42, // OD 33 wool flannel
  trousers: 0x68583f, // OD 33 wool serge
  jump: 0x9a8e6a, // M1942 jump suit, light khaki
  reinforce: 0x5d5a43, // OD 7 canvas reinforcements
  hbt: 0x5e5d45, // OD 7 herringbone twill
  tankJacket: 0x7c6e4e,
  knit: 0x3e3b2e,
  leggings: 0x9a8b66,
  shoes: 0x4a3222, // rough-out with dubbing
  jumpBoots: 0x5a3922,
  sole: 0x231a13,
  web: 0x8c7d58, // khaki webbing
  web7: 0x5f5940,
  helmet: 0x4a4c35, // OD flat with sand finish
  helmetIn: 0x3d3a2b,
  net: 0x46402c,
  chinstrap: 0x7a6e4e,
  strap: 0x7a6e4e,
  canteen: 0x857a58,
  tankHelmet: 0x3e2c1e,
  leather: 0x4a2f1c,
  metal: 0x48463e,
};

function weaponKit(o, belt, role) {
  // Ammunition on the belt for the primary weapon.
  const b = o.b;
  const lod = o.lod;
  const y = belt.y;
  if (belt.kind === 'cartridge' || belt.kind === 'BAR') {
    // M1923: five two-clip pockets each side of the buckle; M1937 BAR belt: three
    // larger two-magazine pockets each side.
    const n = belt.kind === 'BAR' ? 3 : 5;
    const pw = belt.kind === 'BAR' ? 0.075 : 0.056;
    const ph = belt.kind === 'BAR' ? 0.105 : 0.082;
    for (const s of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        if (lod === 2 && i % 2) continue;
        const d = 0.062 + (pw + 0.009) * i;
        const th = -PI / 2 + (s * d) / 0.15;
        const f = o.beltFrame(th, y - 0.006, 0.005);
        pouch(b, f, { w: lod === 2 ? pw * 2 : pw, h: ph, d: 0.032, flap: 0.42, color: US.web, lod, r: 0.007, metal: US.metal });
      }
    }
  } else {
    // Pistol belt: magazine pouches by the buckle.
    const kind = role === 'smg' ? 'thompson' : 'carbine';
    for (const s of [-1, 1]) {
      const f = o.beltFrame(-PI / 2 + s * 0.62, y - 0.004, 0.005);
      if (kind === 'thompson') magPouch(b, f, { kind: 'thompson', color: US.web, lod, metal: US.metal });
      else pouch(b, f, { w: 0.07, h: 0.11, d: 0.035, flap: 0.4, color: US.web, lod, metal: US.metal });
    }
  }
}

// The common infantry base (also recon).
function infantry(o, { recon = false } = {}) {
  const lod = o.lod;
  const b = o.b;
  const jacket = recon ? o.pick(['M41', 'M41', 'M43']) : o.pick(['M41', 'M41', 'M41', 'M41', 'M43', 'shirt', 'shirt']);
  const rolled = jacket === 'shirt' && o.chance(0.6);
  o.dirt = 0.3 + 0.5 * o.r();
  const trouserC = o.shade(US.trousers, 0.06);
  o.trousers({ color: trouserC, style: 'straight', end: 0.56, blouse: 0.003, seatTop: jacket === 'shirt' ? 1.075 : 1.06, waistband: jacket === 'shirt' });
  const beltY = 1.07;
  const shirtC = o.shade(US.shirt, 0.05);
  if (jacket === 'M41') {
    const c = o.shade(US.jacketM41, 0.05, o.r() * 0.25);
    o.torso({ hem: 0.785, belt: beltY - 0.03, cinch: 0.007, blouse: 0.008, flare: 0.012, grow: 0.01, placket: true, placketTop: 1.38 }, { color: c, cell: CELL.cotton });
    o.collar('open', c, { cell: CELL.cotton, open: 0.3, shirt: shirtC });
    o.sleeves({ color: c, cell: CELL.cotton, cuff: 'band', bulk: 0.004 });
    // Slanted hand-warmer pocket flaps and the button flap over the zipper.
    b.material(CELL.cotton);
    for (const s of [-1, 1]) o.patch(s * 0.105, 0.94, 0.15, 0.022, { thick: 0.004, bulge: 0.002, color: c, tilt: s * -0.5 });
    o.buttons([[0.012, 1.19], [0.012, 1.28], [0.012, 1.37]], { color: 0x3c3a30, r: 0.0075 });
    o.shoulderStraps({ color: c, w: 0.04, len: 0.11, thick: 0.004, button: 0x3c3a30 });
  } else if (jacket === 'M43') {
    const c = o.shade(US.jacketM43, 0.06, o.r() * 0.2);
    o.torso({ hem: 0.74, belt: beltY - 0.03, cinch: 0.008, blouse: 0.01, flare: 0.016, grow: 0.011, placket: true, folds: 1.2 }, { color: c, cell: CELL.cotton });
    o.collar('open', c, { cell: CELL.cotton, open: 0.1, shirt: shirtC });
    o.sleeves({ color: c, cell: CELL.cotton, cuff: 'band', bulk: 0.005 });
    b.material(CELL.cotton);
    for (const s of [-1, 1]) {
      o.pocket(s * 0.085, 1.4, 0.11, 0.13, { color: c, flapH: 0.045, button: 0x3a372c });
      o.pocket(s * 0.1, 0.99, 0.15, 0.17, { color: c, flapH: 0.05, button: 0x3a372c });
    }
    o.buttons([[0.01, 1.12], [0.01, 1.22], [0.01, 1.32], [0.01, 1.41]], { color: 0x3a372c });
    o.shoulderStraps({ color: c, w: 0.04, len: 0.11, thick: 0.004, button: 0x3a372c });
  } else {
    // The OD wool shirt tucked into the trousers.
    o.torso({ hem: 0.99, belt: beltY - 0.03, cinch: 0.002, blouse: 0.012, flare: 0, grow: 0.006, placket: true, top: 1.49 }, { color: shirtC, cell: CELL.wool });
    o.collar('fold', shirtC, { cell: CELL.wool });
    o.sleeves({ color: shirtC, cell: CELL.wool, cuff: 'band', rolled });
    b.material(CELL.wool);
    for (const s of [-1, 1]) o.pocket(s * 0.08, 1.4, 0.11, 0.125, { color: shirtC, flapH: 0.04, button: 0x5a4e3a, flapShape: 'point' });
    o.buttons([[0.0, 1.13], [0.0, 1.21], [0.0, 1.29], [0.0, 1.37], [0.0, 1.44]], { color: 0x5a4e3a, r: 0.006 });
  }
  // Division patch on the left shoulder (1st, 4th, 29th, 90th divisions).
  if (o.chance(0.65)) {
    const div = o.pick(['1st', '29th', '4th', '90th']);
    const f = o.sleevePatch(-1, 0.075, 0.05, 0.06, div === '1st' ? 0x5a5a3e : div === '29th' ? 0x2c3a5a : div === '4th' ? 0x4a4a3a : 0x6a6a52);
    if (f) {
      const col = { '1st': 0x9a2a22, '29th': 0x7a7a72, '4th': 0x3a5a2a, '90th': 0x8a3a2a }[div];
      b.paint(col);
      f.box(b, 0.004, 0, 0.0016, div === '1st' ? 0.008 : 0.024, div === '1st' ? 0.04 : 0.028, 0.0012, { r: 0.001 });
    }
  }
  // Sergeant's chevrons on both sleeves.
  if (o.chance(0.15) && lod === 0) {
    for (const s of [-1, 1]) {
      const f = o.sleeveFrame(s, 0.13, 0.053);
      b.bones(torsoWeights);
      b.bones((x, y, z, out) => out.set([s < 0 ? B.upperArmL : B.upperArmR, 0, 0, 0, 1, 0, 0, 0]));
      b.material(CELL.cotton);
      b.paint(0x5a5640);
      for (let k = 0; k < 3; k++) {
        for (const d of [-1, 1]) f.box(b, d * 0.016, -k * 0.012, 0.002, 0.036, 0.008, 0.0015, { r: 0.0008, rot: [0, 0, d * 0.62] });
      }
    }
  }
  // Leggings and service shoes.
  o.leggings({ color: o.shade(US.leggings, 0.06, o.r() * 0.2) });
  o.shoes({ color: o.shade(US.shoes, 0.08), sole: US.sole, suede: true, high: 0.13 });
  // Belt.
  const role = o.role;
  const kind = role === 'mg' ? 'BAR' : role === 'rifle' || role === 'at' ? 'cartridge' : 'pistol';
  const belt = { y: beltY + 0.006, kind };
  o.belt(belt.y, kind === 'pistol' ? 0.057 : 0.07, { color: US.web, cell: CELL.webbing, thick: 0.005 });
  buckle(b, o.beltFrame(-PI / 2, belt.y - 0.035, 0.006), { w: 0.05, h: 0.045, color: US.metal, frame: false, lod });
  weaponKit(o, belt, role);
  // M1936 suspenders, crossed at the back.
  if (lod < 2) {
    for (const s of [-1, 1]) {
      o.strap(
        [
          { x: s * 0.095, y: belt.y - 0.01, side: -1 },
          { x: s * 0.1, y: 1.3, side: -1 },
          { x: s * 0.11, y: 1.43, side: -1 },
          { t: s < 0 ? PI : 0, y: 1.475 },
          { x: s * 0.1, y: 1.42, side: 1 },
          { x: s * 0.0, y: 1.25, side: 1 },
          { x: -s * 0.08, y: belt.y - 0.01, side: 1 },
        ],
        0.031,
        0.0035,
        { color: US.web, cell: CELL.webbing, out: 0.003 },
      );
    }
  }
  // Canteen right rear, first aid pouch front left, entrenching tool left rear, bayonet.
  canteenUS(b, o.beltFrame(0.95, belt.y - 0.065, 0.008), US, lod);
  firstAidUS(b, o.beltFrame(-2.25, belt.y - 0.065, 0.006), US, lod);
  const haversack = !recon && o.chance(0.55);
  if (!haversack && lod < 2) shovelUS(b, o.beltFrame(2.35, belt.y - 0.065, 0.008), US, lod);
  if (o.chance(0.7) && lod < 2) bayonet(b, o.beltFrame(2.85, belt.y - 0.06, 0.006), { len: 0.27, color: 0x3a3a2c, grip: 0x2a2a26, lod });
  if (haversack) {
    const f = backFrame(o.g, 1.455, 0.24, 0.33, 0.012);
    // The rolled M1928 pack with the entrenching tool carrier on its flap.
    backpack(b, f, { w: 0.24, h: 0.33, d: 0.1, color: o.shade(US.web, 0.05), lod, round: 0.035, straps: [-0.06, 0.06], strapColor: US.web });
    if (lod < 2) shovelUS(b, f.sub(0, -0.2, 0.1), US, lod);
  }
  // A cloth bandolier for Garand men; a fragmentation grenade on a suspender.
  if (role === 'rifle' && o.chance(0.3)) bandolier(b, o.g, US, { lod, kind: 'US', color: o.shade(0x8a8060, 0.05) });
  if (lod === 0 && o.chance(0.4)) {
    const f = o.beltFrame(-PI / 2 - 0.62, 1.26, 0.012);
    b.bones(rigidAt(f));
    b.material(CELL.paint);
    b.paint(0x4a4c36);
    f.ell(b, 0, -0.03, 0.026, 0.026, 0.04, 0.026, { nu: 10, nv: 6 });
    b.material(CELL.metal);
    b.paint(0x55524a);
    f.box(b, 0.01, 0.012, 0.03, 0.012, 0.03, 0.012, { r: 0.002 });
  }
  if (recon) binocularCase(b, o.beltFrame(-2.5, belt.y - 0.06, 0.008), { color: 0x4a3a28, lod });
  // Helmet.
  const net = recon || o.chance(0.6);
  buildHelmet(b, 'US', US, {
    lod,
    net,
    band: net && o.chance(0.35),
    scrim: recon || (net && o.chance(0.15)),
    chin: o.pick(['back', 'back', 'loose', 'loose', 'loose', 'chin']),
    linerStrap: o.chance(0.3),
    seed: o.variant,
    paint: o.shade(US.helmet, 0.05),
  });
  o.weather(o.dirt);
}

function paratrooper(o) {
  const lod = o.lod;
  const b = o.b;
  o.dirt = 0.4 + 0.5 * o.r();
  const jc = o.shade(US.jump, 0.05, o.r() * 0.2);
  const reinforced = o.chance(0.6);
  // M1942 jump trousers bloused over the boots, with cargo pockets.
  o.trousers({ color: jc, cell: CELL.cotton, style: 'jump', end: 0.64, blouse: 0.013, seatTop: 1.06, bulk: 0.008 });
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const P = legChain(s);
      // Cargo pocket: on the outer front of the thigh.
      const c = chainPoint(P, 0.26, new THREE.Vector3());
      b.bones((x, y, z, out) => out.set([s < 0 ? B.thighL : B.thighR, 0, 0, 0, 1, 0, 0, 0]));
      b.material(CELL.cotton);
      b.paint(jc);
      b.part();
      const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), s * 0.5);
      b.box(V(c.x + s * 0.07, c.y, c.z - 0.045), [0.035, 0.2, 0.16], { quat: q, r: 0.016, seg: lod ? null : [10, 6] });
      if (lod === 0) {
        b.box(V(c.x + s * 0.08, c.y + 0.085, c.z - 0.05), [0.03, 0.05, 0.168], { quat: q, r: 0.006 });
        b.material(CELL.metal);
        b.paint(US.metal);
        for (const dz of [-0.04, 0.03]) b.box(V(c.x + s * 0.097, c.y + 0.07, c.z - 0.05 + dz), [0.004, 0.009, 0.009], { quat: q, r: 0.0015 });
      }
      if (reinforced && lod === 0) {
        // Knee patches of OD 7 canvas.
        const k = chainPoint(P, 0.425, new THREE.Vector3());
        b.material(CELL.duck);
        b.paint(US.reinforce);
        b.bones((x, y, z, out) => out.set([s < 0 ? B.shinL : B.shinR, s < 0 ? B.thighL : B.thighR, 0, 0, 0.5, 0.5, 0, 0]));
        b.part();
        b.box(V(k.x, k.y, k.z - 0.065), [0.1, 0.13, 0.012], { r: 0.005 });
      }
    }
  }
  o.torso({ hem: 0.8, belt: 1.04, cinch: 0.008, blouse: 0.014, flare: 0.016, grow: 0.012, placket: true, folds: 1.3 }, { color: jc, cell: CELL.cotton });
  o.collar('fold', jc, { cell: CELL.cotton });
  o.sleeves({ color: jc, cell: CELL.cotton, cuff: 'band', bulk: 0.006, wide: 0.004 });
  // Slanted chest and hip pockets with snap flaps.
  b.material(CELL.cotton);
  for (const s of [-1, 1]) {
    o.patch(s * 0.09, 1.33, 0.12, 0.15, { color: jc, thick: 0.004, bulge: 0.008, tilt: s * 0.35 });
    o.patch(s * 0.09, 1.405, 0.13, 0.04, { color: jc, thick: 0.008, bulge: 0.003, tilt: s * 0.35 });
    o.patch(s * 0.1, 0.92, 0.15, 0.17, { color: jc, thick: 0.005, bulge: 0.012, tilt: s * 0.2 });
    o.patch(s * 0.1, 1.0, 0.16, 0.045, { color: jc, thick: 0.01, bulge: 0.003, tilt: s * 0.2 });
  }
  if (reinforced) o.elbowPatches({ color: US.reinforce });
  // Flag on the right shoulder, 101st Airborne eagle on the left.
  const flag = o.sleevePatch(1, 0.07, 0.07, 0.045, 0xe8e0d0, { shape: 'rect' });
  if (flag) {
    b.paint(0x22305a);
    flag.box(b, 0.018, 0.011, 0.0012, 0.032, 0.023, 0.0012, { r: 0.0005 });
    b.paint(0xa02a28);
    for (let k = 0; k < 3; k++) flag.box(b, -0.008, -0.004 - k * 0.0075, 0.0012, 0.05, 0.0035, 0.0012, { r: 0.0004 });
  }
  const eagle = o.sleevePatch(-1, 0.075, 0.05, 0.062, 0x1a1a1a);
  if (eagle) {
    b.paint(0xe8e4d8);
    eagle.ell(b, 0, 0.004, 0.0012, 0.014, 0.016, 0.001, { nu: 8, nv: 3 });
  }
  // Jump boots.
  // Corcoran jump boots: 10 in. russet leather, laced up the front, toe cap.
  o.tallBoots({ color: o.shade(US.jumpBoots, 0.06), sole: US.sole, s0: 0.6, gloss: 0.35, folds: 0.4, r0: [0.058, 0.064], laces: 8, laceColor: 0x2a1c12, toeCap: true });
  // Pistol belt, suspenders, pouches, holster, canteen, first aid on the suspenders.
  const beltY = 1.07;
  o.belt(beltY, 0.057, { color: US.web, cell: CELL.webbing });
  buckle(b, o.beltFrame(-PI / 2, beltY - 0.028, 0.006), { w: 0.05, h: 0.04, color: US.metal, frame: false, lod });
  weaponKit(o, { y: beltY, kind: 'pistol' }, o.role === 'rifle' ? 'rifle' : 'smg');
  holster(b, o.beltFrame(0.15, beltY - 0.05, 0.008), { color: US.leather, lod, kind: 'US' });
  canteenUS(b, o.beltFrame(0.9, beltY - 0.06, 0.008), US, lod);
  if (lod < 2) {
    for (const s of [-1, 1]) {
      o.strap(
        [
          { x: s * 0.095, y: beltY - 0.01, side: -1 },
          { x: s * 0.1, y: 1.3, side: -1 },
          { x: s * 0.11, y: 1.43, side: -1 },
          { t: s < 0 ? PI : 0, y: 1.475 },
          { x: s * 0.1, y: 1.42, side: 1 },
          { x: s * 0.0, y: 1.25, side: 1 },
          { x: -s * 0.08, y: beltY - 0.01, side: 1 },
        ],
        0.031,
        0.0035,
        { color: US.web, cell: CELL.webbing },
      );
    }
    firstAidUS(b, o.beltFrame(-PI / 2 - 0.55, 1.33, 0.012), US, lod);
  }
  // Musette bag on the back, the M3 knife on the right leg.
  backpack(b, backFrame(o.g, 1.38, 0.27, 0.27, 0.012), { w: 0.27, h: 0.27, d: 0.09, color: o.shade(US.web, 0.05), lod, round: 0.03, straps: [-0.07, 0.07], strapColor: US.web });
  if (lod < 2) {
    const P = legChain(1);
    const a = chainPoint(P, 0.6, new THREE.Vector3()),
      c = chainPoint(P, 0.78, new THREE.Vector3());
    knife(b, B.shinR, [a.x + 0.06, a.y, a.z - 0.01], [c.x + 0.055, c.y, c.z - 0.006], { color: 0x5a3a24, lod });
  }
  // M2 helmet: net and scrim, chin cup.
  buildHelmet(b, 'M2', US, { lod, net: o.chance(0.85), scrim: o.chance(0.6), band: o.chance(0.3), chin: o.pick(['chin', 'chin', 'loose']), seed: o.variant + 50, paint: o.shade(US.helmet, 0.05) });
  o.weather(o.dirt);
}

function tanker(o) {
  const lod = o.lod;
  const b = o.b;
  o.dirt = 0.25 + 0.4 * o.r();
  const coveralls = o.chance(0.4);
  // Canvas leggings over the trousers on some (laced over them, so the legs are bloused).
  const leggings = !coveralls && o.chance(0.5);
  o.info.headgear = 'tank';
  if (coveralls) {
    const c = o.shade(US.hbt, 0.06, o.r() * 0.2);
    o.trousers({ color: c, cell: CELL.hbt, style: 'straight', end: 0.82, seatTop: 1.06, bulk: 0.008 });
    o.torso({ hem: 0.785, belt: 1.04, cinch: 0.008, blouse: 0.012, flare: 0.004, grow: 0.012, placket: true }, { color: c, cell: CELL.hbt });
    o.collar('fold', c, { cell: CELL.hbt });
    o.sleeves({ color: c, cell: CELL.hbt, cuff: 'band', bulk: 0.007 });
    for (const s of [-1, 1]) o.pocket(s * 0.085, 1.4, 0.12, 0.14, { color: c, flapH: 0, flapShape: 'straight' });
    o.buttons([[0, 1.12], [0, 1.22], [0, 1.32], [0, 1.42]], { color: 0x3a3a30, r: 0.007 });
  } else {
    o.trousers({ color: o.shade(US.trousers, 0.06), style: 'straight', end: leggings ? 0.56 : 0.82, blouse: leggings ? 0.003 : 0, seatTop: 1.06, waistband: true });
    const c = o.shade(US.tankJacket, 0.05, o.r() * 0.2);
    // Winter combat jacket: zipped, knit collar, cuffs and waistband.
    o.torso({ hem: 0.93, belt: 1.0, cinch: 0.0, blouse: 0.012, flare: 0, grow: 0.014, placket: true, folds: 1 }, { color: c, cell: CELL.cotton });
    b.material(CELL.knit);
    b.paint(US.knit);
    if (lod < 2) {
      o.b.part();
      // Knit waistband.
      o.belt(0.99, 0.065, { color: US.knit, cell: CELL.knit, thick: 0.004 });
    }
    o.collar('knit', US.knit, { cell: CELL.knit });
    o.sleeves({ color: c, cell: CELL.cotton, cuff: 'knit', bulk: 0.008, cuffColor: US.knit });
    for (const s of [-1, 1]) o.patch(s * 0.11, 1.08, 0.025, 0.15, { color: c, thick: 0.004, bulge: 0.002, tilt: s * 0.35 });
  }
  o.shoes({ color: o.shade(US.shoes, 0.08), sole: US.sole, suede: true, high: 0.13 });
  if (leggings) o.leggings({ color: o.shade(US.leggings, 0.06) });
  // Pistol: M3 shoulder holster under the left arm, or on a pistol belt.
  if (o.chance(0.5) && lod < 2) {
    o.strap(
      [
        { x: 0.1, y: 1.36, side: -1 },
        { t: 0, y: 1.46 },
        { x: 0.09, y: 1.36, side: 1 },
        { t: PI * 0.8, y: 1.2 },
        { t: -PI * 0.8, y: 1.2 },
        { x: 0.1, y: 1.36, side: -1 },
      ],
      0.025,
      0.0035,
      { color: US.leather, cell: CELL.leather },
    );
    holster(b, o.beltFrame(-PI + 0.25, 1.28, 0.012), { color: US.leather, lod, kind: 'US' });
  } else {
    const beltY = 1.07;
    o.belt(beltY, 0.057, { color: US.web, cell: CELL.webbing });
    buckle(b, o.beltFrame(-PI / 2, beltY - 0.028, 0.006), { w: 0.05, h: 0.04, color: US.metal, lod });
    holster(b, o.beltFrame(0.15, beltY - 0.05, 0.008), { color: US.leather, lod, kind: 'US' });
    if (o.role === 'smg') magPouch(b, o.beltFrame(-PI / 2 - 0.6, beltY - 0.004, 0.005), { kind: 'thompson', color: US.web, lod });
  }
  buildTankHelmet(b, 'US', US, { lod, goggles: o.chance(0.75), color: o.shade(US.tankHelmet, 0.08) });
  o.weather(o.dirt);
}

registerOutfits('US', {
  infantry: { variants: 8, build: (o) => infantry(o) },
  recon: { variants: 4, build: (o) => infantry(o, { recon: true }) },
  paratrooper: { variants: 5, build: (o) => paratrooper(o) },
  tanker: { variants: 4, build: (o) => tanker(o) },
});
