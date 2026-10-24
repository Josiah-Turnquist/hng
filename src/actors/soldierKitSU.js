// Red Army, 1944.
//   Infantry: SSh-40 helmet or pilotka side cap with the red star, M1943
//     gymnastyorka (stand collar, three-button placket, khaki field shoulder
//     boards with red piping; often sun-bleached), sharovary breeches with
//     knee patches, kirza boots or ankle boots with obmotki windings; leather or
//     canvas belt with the star buckle, two Mosin cartridge pouches (SMG men: a
//     drum pouch), grenade pouch, veshmeshok on the back, rolled greatcoat
//     (skatka), canteen, MPL-50 shovel; a medal or the Guards badge on some.
//   Recon (razvedchik): amoeba camouflage oversuit with the hood down.
//   Paratrooper: padded jump helmet or SSh-40, jump coveralls, drum pouches.
//   Tank crew: padded shlemofon, dark coveralls, TT holster.
import * as THREE from 'three';
import { registerOutfits, CELL, CAMO_GREY, PI, torsoWeights, B, legChain, chainPoint, pouch, buckle, rigidAt, torsoTheta } from './soldierKit.js';
import { buildHelmet, buildSideCap, buildTankHelmet, canteenSU, shovelSU, mosinPouch, magPouch, holster, veshmeshok, skatka, knife, binocularCase, torsoFrame, backFrame } from './soldierGear.js';

export const SU = {
  tunic: 0x857b56, // khaki cotton
  tunicFaded: 0xa0966e,
  tunicWool: 0x6e6648,
  trousers: 0x6a6146,
  trousersFaded: 0x7e7556,
  boots: 0x27221d, // kirza
  sole: 0x15110e,
  shoe: 0x3b2c20,
  wrap: 0x6c6448, // obmotki
  leather: 0x4f3826,
  beltCanvas: 0x6e6648,
  buckleBrass: 0x9a7e45,
  buckleSteel: 0x6a6a62,
  pouch: 0x4a3626,
  pouchCloth: 0x6c6448,
  roll: 0x6a6152,
  rollTie: 0x3e3426,
  bag: 0x887d5c,
  canteen: 0x6c684a,
  helmet: 0x48553a, // 4BO green
  helmetIn: 0x2f2a20,
  strap: 0x5b4a33,
  chinstrap: 0x5b4a33,
  pilotka: 0x7d7451,
  board: 0x7a7250,
  red: 0xa02a20,
  tankHelmet: 0x2b2a27,
  coverallBlue: 0x3a3f48,
  coverallBlack: 0x2a2a2c,
  jump: 0x7a755c,
  metal: 0x55534a,
};

function belt(o, { y = 1.08, role = o.role, canvas = false } = {}) {
  const b = o.b;
  const lod = o.lod;
  o.belt(y, 0.045, { color: canvas ? SU.beltCanvas : SU.leather, cell: canvas ? CELL.webbing : CELL.leather, thick: 0.005 });
  const brass = o.chance(0.55);
  buckle(b, o.beltFrame(-PI / 2, y - 0.0225, 0.006), { w: 0.055, h: 0.05, color: brass ? SU.buckleBrass : SU.buckleSteel, frame: !brass, star: brass, lod });
  if (role === 'smg' || role === 'mg') {
    magPouch(b, o.beltFrame(-PI / 2 - 0.85, y - 0.002, 0.006), { kind: 'drum', color: o.shade(SU.pouchCloth, 0.06), lod });
  } else {
    for (const s of [-1, 1]) mosinPouch(b, o.beltFrame(-PI / 2 + s * 0.72, y - 0.002, 0.006), SU, lod);
  }
  // Grenade pouch on the left hip.
  if (lod < 2) pouch(b, o.beltFrame(-PI + 0.35, y - 0.004, 0.006), { w: 0.1, h: 0.13, d: 0.06, flap: 0.4, color: o.shade(SU.pouchCloth, 0.06), cell: CELL.duck, fastener: 'button', lod, r: 0.012 });
  canteenSU(b, o.beltFrame(1.1, y - 0.05, 0.008), SU, lod);
  if (lod < 2) shovelSU(b, o.beltFrame(0.45, y - 0.045, 0.008), SU, lod);
}

// M1943 gymnastyorka: stand collar, placket with three buttons, worn outside the
// breeches under the belt.
function gymnastyorka(o, { color, pockets = false, board = SU.board, piping = SU.red, cell = CELL.cotton }) {
  o.torso({ hem: 0.78, belt: 1.055, cinch: 0.013, blouse: 0.014, flare: 0.013, grow: 0.009, placket: true, placketBottom: 1.3, placketTop: 1.47, folds: 1.25 }, { color, cell });
  o.collar('stand', color, { cell, h: 0.036 });
  o.sleeves({ color, cell, cuff: 'band', bulk: 0.004 });
  o.buttons([[0.0, 1.335], [0.0, 1.385], [0.0, 1.435], [0.0, 1.475]], { color: 0x4a4836, r: 0.0058 });
  if (pockets) for (const s of [-1, 1]) o.pocket(s * 0.088, 1.405, 0.1, 0.12, { color, flapH: 0.04, flapShape: 'point', button: 0x4a4836 });
  o.shoulderStraps({ color: board, piping, w: 0.05, len: 0.13, thick: 0.004, button: 0x4a4836, board: true });
}

function headgear(o, { capChance = 0.4 } = {}) {
  const b = o.b;
  if (o.chance(capChance)) {
    o.info.headgear = 'cap';
    buildSideCap(b, SU, { lod: o.lod, color: o.shade(SU.pilotka, 0.06, o.r() * 0.2), badge: 'star', tilt: 0.1 + o.r() * 0.12 });
    return;
  }
  buildHelmet(b, 'SU', SU, {
    lod: o.lod,
    chin: o.pick(['chin', 'chin', 'loose', 'back']),
    net: o.chance(0.08),
    seed: o.variant + 40,
    paint: o.shade(SU.helmet, 0.06),
    decal: o.chance(0.12) ? { color: SU.red, size: 0.03 } : null,
  });
}

function medals(o) {
  if (o.lod > 0) return;
  const b = o.b;
  // "For Courage" medal on the left breast; the Guards badge on the right.
  if (o.chance(0.3)) {
    const f = torsoFrame(o.g, torsoTheta(-0.085, 1.37, -1), 1.37, 0.006, { plumb: false });
    b.bones(torsoWeights);
    b.material(CELL.cotton);
    b.paint(0x8a8c90);
    b.part(false);
    f.box(b, 0, 0.02, 0.001, 0.024, 0.022, 0.003, { r: 0.002 });
    b.material(CELL.metal);
    b.paint(0xb8b8b0);
    f.ell(b, 0, -0.006, 0.003, 0.0125, 0.0125, 0.0018, { nu: 12, nv: 3 });
  }
  if (o.chance(0.3)) {
    const f = torsoFrame(o.g, torsoTheta(0.085, 1.37, -1), 1.37, 0.006, { plumb: false });
    b.bones(torsoWeights);
    b.material(CELL.metal);
    b.paint(SU.red);
    b.part(false);
    f.box(b, 0, 0.0, 0.002, 0.03, 0.026, 0.003, { r: 0.006 });
    b.paint(0xc8a040);
    f.box(b, 0, -0.016, 0.003, 0.034, 0.008, 0.002, { r: 0.002 });
  }
}

function infantry(o) {
  const b = o.b;
  const lod = o.lod;
  o.dirt = 0.35 + 0.5 * o.r();
  const faded = o.r() * 0.9;
  const tc = o.shade(SU.tunic, 0.05).lerp(new THREE.Color(SU.tunicFaded), faded);
  const kirza = o.chance(0.6);
  const trc = o.shade(SU.trousers, 0.05).lerp(new THREE.Color(SU.trousersFaded), faded * 0.6);
  o.trousers({ color: trc, cell: CELL.cotton, style: 'breeches', end: kirza ? 0.5 : 0.56, blouse: kirza ? 0.004 : 0.002, bulk: 0.004 });
  if (lod === 0 && o.chance(0.6)) {
    // Oval knee reinforcement patches.
    for (const s of [-1, 1]) {
      const P = legChain(s);
      const k = chainPoint(P, 0.43, new THREE.Vector3());
      b.bones((x, y, z, out) => out.set([s < 0 ? B.shinL : B.shinR, s < 0 ? B.thighL : B.thighR, 0, 0, 0.5, 0.5, 0, 0]));
      b.material(CELL.cotton);
      b.paint(trc.clone().multiplyScalar(0.92));
      b.part();
      b.ellipsoid([k.x, k.y + 0.01, k.z - 0.058], [0.05, 0.065, 0.012], { nu: 10, nv: 5 });
    }
  }
  gymnastyorka(o, { color: tc, pockets: o.chance(0.25) });
  if (kirza) o.tallBoots({ color: SU.boots, sole: SU.sole, s0: 0.47, gloss: 0.15, folds: 1.4 });
  else {
    o.puttees({ color: o.shade(SU.wrap, 0.06) });
    o.shoes({ color: SU.shoe, sole: SU.sole, high: 0.13 });
  }
  belt(o, { canvas: o.chance(0.35) });
  medals(o);
  // Veshmeshok on the back; the rolled greatcoat over the left shoulder.
  const roll = o.chance(0.5);
  if (o.chance(0.6) || !roll) veshmeshok(b, backFrame(o.g, 1.36, 0.28, 0.35, 0.012), SU, lod);
  if (roll) skatka(b, o.g, SU, lod);
  headgear(o);
  o.weather(o.dirt);
}

function recon(o) {
  const b = o.b;
  const lod = o.lod;
  o.dirt = 0.4 + 0.4 * o.r();
  // Amoeba oversuit: loose hooded smock and trousers over the uniform.
  o.trousers({ color: CAMO_GREY, cell: CELL.amoeba, style: 'straight', end: 0.5, blouse: 0.008, bulk: 0.01 });
  o.torso({ hem: 0.74, belt: 1.055, cinch: 0.014, blouse: 0.016, flare: 0.02, grow: 0.016, placket: true, placketBottom: 1.3, folds: 1.3 }, { color: CAMO_GREY, cell: CELL.amoeba });
  o.collar('fold', CAMO_GREY, { cell: CELL.amoeba });
  o.sleeves({ color: CAMO_GREY, cell: CELL.amoeba, cuff: 'band', bulk: 0.008, wide: 0.004 });
  if (lod < 2) {
    // The hood, down behind the neck.
    const f = torsoFrame(o.g, PI / 2, 1.44, 0.01);
    b.bones((x, y, z, out) => out.set([B.chest, B.neck, 0, 0, 0.6, 0.4, 0, 0]));
    b.material(CELL.amoeba);
    b.paint(CAMO_GREY);
    b.part();
    f.ell(b, 0, 0.01, 0.02, 0.1, 0.05, 0.04, { nu: lod ? 6 : 12, nv: lod ? 4 : 7 });
  }
  o.tallBoots({ color: SU.boots, sole: SU.sole, s0: 0.47, gloss: 0.15, folds: 1.4 });
  belt(o, { canvas: o.chance(0.5) });
  if (lod < 2) {
    // NR-40 knife on the belt.
    const f = o.beltFrame(0.25, 1.06, 0.008);
    knife(b, rigidAt(f), f.point(0, 0, 0.01).toArray(), f.point(0.02, -0.2, 0.012).toArray(), { color: 0x2a2018, lod });
  }
  if (o.chance(0.4)) binocularCase(b, torsoFrame(o.g, -PI / 2 + 0.35, 1.26, 0.012), { color: 0x3a2a1c, lod });
  headgear(o, { capChance: 0.6 });
  o.weather(o.dirt);
}

function paratrooper(o) {
  const b = o.b;
  const lod = o.lod;
  o.dirt = 0.3 + 0.4 * o.r();
  const c = o.shade(SU.jump, 0.06, o.r() * 0.2);
  // Jump coveralls: one piece, chest pockets, belted.
  o.trousers({ color: c, cell: CELL.cotton, style: 'jump', end: 0.5, blouse: 0.006, bulk: 0.008, seatTop: 1.06 });
  o.torso({ hem: 0.785, belt: 1.055, cinch: 0.012, blouse: 0.014, flare: 0.004, grow: 0.012, placket: true, folds: 1.2 }, { color: c, cell: CELL.cotton });
  o.collar('fold', c, { cell: CELL.cotton });
  o.sleeves({ color: c, cell: CELL.cotton, cuff: 'band', bulk: 0.007 });
  for (const s of [-1, 1]) o.pocket(s * 0.088, 1.4, 0.11, 0.13, { color: c, flapH: 0.04, button: 0x3a3a30 });
  o.tallBoots({ color: SU.boots, sole: SU.sole, s0: 0.47, gloss: 0.15, folds: 1.2 });
  belt(o, { role: o.role === 'rifle' ? 'rifle' : 'smg' });
  if (lod < 2) {
    const f = o.beltFrame(0.25, 1.06, 0.008);
    knife(b, rigidAt(f), f.point(0, 0, 0.01).toArray(), f.point(0.02, -0.2, 0.012).toArray(), { color: 0x2a2018, lod });
  }
  veshmeshok(b, backFrame(o.g, 1.36, 0.28, 0.35, 0.012), SU, lod);
  if (o.chance(0.5)) {
    o.info.headgear = 'tank';
    buildTankHelmet(b, 'SU', SU, { lod, color: o.shade(0x4a3424, 0.08) });
  } else headgear(o, { capChance: 0 });
  o.weather(o.dirt);
}

function tanker(o) {
  const b = o.b;
  const lod = o.lod;
  o.dirt = 0.3 + 0.4 * o.r();
  o.info.headgear = 'tank';
  const c = o.shade(o.chance(0.6) ? SU.coverallBlue : SU.coverallBlack, 0.08);
  o.trousers({ color: c, cell: CELL.duck, style: 'straight', end: 0.5, blouse: 0.006, bulk: 0.008 });
  o.torso({ hem: 0.785, belt: 1.055, cinch: 0.012, blouse: 0.013, flare: 0.004, grow: 0.013, placket: true, folds: 1.1 }, { color: c, cell: CELL.duck });
  o.collar('fold', c, { cell: CELL.duck });
  o.sleeves({ color: c, cell: CELL.duck, cuff: 'band', bulk: 0.007 });
  o.patch(-0.085, 1.33, 0.12, 0.13, { color: c, thick: 0.004, bulge: 0.006 });
  o.tallBoots({ color: SU.boots, sole: SU.sole, s0: 0.47, gloss: 0.15, folds: 1.2 });
  o.belt(1.08, 0.045, { color: SU.leather, cell: CELL.leather });
  buckle(b, o.beltFrame(-PI / 2, 1.0575, 0.006), { w: 0.055, h: 0.05, color: SU.buckleSteel, frame: true, lod });
  holster(b, o.beltFrame(-0.2, 1.05, 0.008), { color: SU.leather, lod, kind: 'GE' });
  if (o.role === 'smg') magPouch(b, o.beltFrame(-PI / 2 - 0.85, 1.078, 0.006), { kind: 'drum', color: o.shade(SU.pouchCloth, 0.06), lod });
  buildTankHelmet(b, 'SU', SU, { lod, color: o.shade(SU.tankHelmet, 0.1) });
  o.weather(o.dirt);
}

registerOutfits('SU', {
  infantry: { variants: 8, build: infantry },
  recon: { variants: 4, build: recon },
  paratrooper: { variants: 4, build: paratrooper },
  tanker: { variants: 3, build: tanker },
});
