// The parts the weapon upgrades fit to a gun: barrels, bolts, springs, trigger
// groups, iron and match sights, scopes and the rounds of ammunition, each made
// to the size of the gun it goes on (a pistol's spring is a pistol's). Used for
// the pictures on the customization screen; built to be fitted to the gun models
// later. Not a model registry: nothing here is listed in MODELS. Same
// conventions as kit.js (meters, the part's axis along Z, its front toward -Z).
//
// Each part is built in its own frame, placed where it meets the gun:
//   barrel     breech end at z = 0 on the bore, muzzle at -len (anchors breech, muzzle)
//   bolt       bolt face at z = 0 on the bore, the bolt behind it (anchor face)
//   spring     front end at z = 0 on its axis, the coils behind it (anchors front, back)
//   trigger    trigger pivot at the origin, blade below, group above (anchor trigger)
//   irons      rear sight at the origin on its base, front sight ahead (anchors rearSight, frontSight)
//   scope      eyepiece lens at the origin, mount below (anchors scopeEye, scopeFront, base)
//   cartridge  case head at z = 0, bullet toward -Z (anchor nose)
// meta.view = { dir, fov, focus }: where a picture of the part is best taken
// from (the direction toward the camera, its field of view, and for a long part
// the stretch of z to frame).
//
//   const part = partOf('kar98k', 'u80');   // { model: 'barrel', profile: 'octagon', ... }
//   const { root, anchors } = buildPart(part, mats, { lod: 0 });
//   partKey(part)                           // a name for the part (same part, same key)
import * as THREE from 'three';
import { GunBuilder } from './kit.js';
import { lathe, tube, place, plateXY, trigger as blade, circle, path, arcTube } from './parts.js';
import { screw, knurledKnob, plateXYz, bar, sectionLoft, stations, smoothstep } from './shapes.js';
import * as optics from './optics.js';
import { WEAPONS } from '../defs.js';
import { AMMO } from '../ammo.js';
import { UPGRADES, AMMO_TYPES, GUN_UPGRADES } from '../upgradeData.js';

const TAU = Math.PI * 2;
const q = (v) => Math.round(v * 1e5) / 1e5;

// --- The gun the part goes on -----------------------------------------------------

const KIND = { pistol: 'pistol', revolver: 'revolver', smg: 'smg', lmg: 'lmg', atRifle: 'at' };
const BOLT_ACTION = ['kar98k', 'm1903', 'mosin_9130'];
// Barrel lengths (m), from the guns' published specifications.
const BARREL_LEN = {
  m1_garand: 0.61, m1_carbine: 0.458, m1a1_carbine: 0.458, m2_carbine: 0.458, m1903: 0.61,
  thompson_m1a1: 0.267, m3_greasegun: 0.203, bar_m1918a2: 0.61, m1919a6: 0.61, johnson_lmg: 0.559,
  m1911a1: 0.127, m1917_revolver: 0.14, colt_1903: 0.095, kar98k: 0.6, gewehr43: 0.55, mp40: 0.251,
  mp34: 0.2, stg44: 0.419, mg42: 0.533, mg34: 0.627, fg42: 0.5, p38: 0.125, luger_p08: 0.1, c96: 0.14,
  beretta_1934: 0.094, mosin_9130: 0.73, svt40: 0.625, avs36: 0.615, ppsh41: 0.269, pps43: 0.25,
  ppd40: 0.267, dp28: 0.605, tt33: 0.116, nagant_m1895: 0.114, ptrd41: 1.35, korovin_tk: 0.068,
};
// Barrel length for a gun not in the table, as a share of its length.
const BARREL_SHARE = { pistol: 0.55, revolver: 0.48, smg: 0.31, rifle: 0.55, lmg: 0.5, at: 0.68 };
// Finish of the service parts by army: US parkerized, German blued, Soviet the
// coarser wartime bluing.
const ISSUE = { US: 'parkerized', GE: 'steel', SU: 'steelDark' };

// What the parts need to know about a gun: its kind (pistol, revolver, smg,
// rifle, lmg, at), action (bolt, semi or its kind), bore (m), barrel length,
// army and sight. A gun with upgrades but not yet in defs.js is judged by its
// service round (a pistol's or a rifle's).
export function gunInfo(gun) {
  const w = WEAPONS[gun] || {};
  const stock = CARTRIDGES[AMMO_TYPES[(GUN_UPGRADES[gun] || GUN_UPGRADES[w.base])?.ammo]?.cartridge];
  if (!WEAPONS[gun] && !stock) throw new Error(`No weapon ${gun}`);
  const base = w.base || gun;
  const kind = KIND[w.type] || (w.type || !stock || stock.caseLen > 0.026 ? 'rifle' : 'pistol');
  return {
    gun,
    base,
    kind,
    action: kind === 'rifle' ? (BOLT_ACTION.includes(base) ? 'bolt' : 'semi') : kind,
    cal: AMMO[w.ammo]?.diameter ?? (stock ? stock.bullet * 2 : 0.0079),
    barrel: BARREL_LEN[base] ?? (w.length ?? (kind === 'pistol' ? 0.2 : 1.1)) * BARREL_SHARE[kind],
    army: w.faction,
    sight: WEAPONS[base]?.sight?.kind || w.sight?.kind || 'notch',
  };
}

// --- Which part an upgrade is ---------------------------------------------------

// The part an upgrade (u...) or a round (a...) puts on this gun:
// { model, ...params } (plain data: the same part gives the same key).
export function partOf(gun, id) {
  const g = gunInfo(gun);
  if (AMMO_TYPES[id]) return cartridgePart(g, id);
  const u = UPGRADES[id];
  if (!u) return null;
  const name = u.name;
  if (u.slot === 'barrel') return barrelPart(g, name);
  if (u.slot === 'internal') return /spring/i.test(name) ? springPart(g, name) : boltPart(g, name);
  if (u.slot === 'trigger') return triggerPart(g, name);
  if (u.family) return scopePart(g, u);
  return /match/i.test(name) ? matchPart(g) : ironsPart(g);
}

export function partKey(part) {
  return part ? JSON.stringify(part) : '';
}

// Barrels by name. finish: the outside; bore: the bore's lining; profile:
// round, octagon, scout (lighter and shorter), heavy; brake on the muzzle; gas:
// the gas port's block under the barrel.
const BARRELS = {
  'Stainless Steel Barrel': { finish: 'stainless' },
  'Chrome Lined Barrel': { finish: 'steel', bore: 'chrome' },
  'Chrome Moly 4150': { finish: 'parkerized' },
  Octagon: { finish: 'steel', profile: 'octagon' },
  'Scout II': { finish: 'steelDark', profile: 'scout' },
  'Scout II-s': { finish: 'steelDark', profile: 'scout', gas: true },
  'Könich FJ-S': { finish: 'phosphate', brake: 'fg42', gas: true },
  'URAH-2 Heavy Barrel': { finish: 'steelDark', profile: 'heavy', brake: 'avs' },
};

function barrelPart(g, name) {
  const look = BARRELS[name] || { finish: 'steel' };
  const k = g.kind;
  // Wall at the muzzle, and the chamber's swell over it.
  const wall = { pistol: 0.0024, revolver: 0.0045, smg: 0.0045, rifle: 0.0035, lmg: 0.0065, at: 0.0085 }[k];
  const swell = { pistol: 1.22, revolver: 1.15, smg: 1.35, rifle: 1.85, lmg: 1.55, at: 1.6 }[k];
  let len = g.barrel,
    rM = g.cal / 2 + wall,
    rB = rM * swell;
  if (look.profile === 'scout') {
    len *= 0.86;
    rM *= 0.86;
    rB *= 0.9;
  } else if (look.profile === 'heavy') {
    rM *= 1.35;
    rB *= 1.08;
  }
  return {
    model: 'barrel',
    kind: k,
    len: q(len),
    bore: q(g.cal / 2),
    rMuzzle: q(rM),
    rBreech: q(rB),
    finish: look.finish,
    boreMat: look.bore || 'boreDark',
    profile: look.profile || 'round',
    brake: look.brake || (k === 'at' ? 'ptrd' : k === 'lmg' ? 'cone' : null),
    gas: !!look.gas,
    sight: k !== 'pistol',
  };
}

// Bolts: the gun's own kind of bolt. Heavy: solid, blued; Lightened: fluted and
// drilled, in the white; Special Light: cut away further still.
function boltPart(g, name) {
  const weight = /heavy/i.test(name) ? 'heavy' : /special/i.test(name) ? 'special' : 'light';
  const finish = weight === 'heavy' ? 'steel' : 'steelBright';
  const s = g.cal / 0.0079; // the bolt grows with the bore
  if (g.kind === 'pistol' || g.kind === 'revolver') {
    const style = g.base === 'luger_p08' ? 'toggle' : g.base === 'c96' ? 'block' : 'slide';
    const w = g.cal * 1.6 + 0.0045;
    return { model: 'bolt', kind: style, weight, finish, len: q(g.barrel + 0.058), w: q(w), h: q(w * 1.12), bore: q(g.cal / 2) };
  }
  if (g.kind === 'smg') return { model: 'bolt', kind: 'smg', weight, finish, r: q(0.0105 + g.cal * 0.22), len: q(0.1), bore: q(g.cal / 2) };
  if (g.action === 'bolt' || g.kind === 'at') {
    const handle = g.kind === 'at' ? 'ptrd' : g.base === 'mosin_9130' ? 'straight' : 'bent';
    const r = g.cal * 1.12;
    return { model: 'bolt', kind: 'rifle', weight, finish, r: q(r), len: q(r * 13.5), handle, bore: q(g.cal / 2) };
  }
  return { model: 'bolt', kind: 'carrier', weight, finish, s: q(s), long: g.kind === 'lmg' };
}

// Springs: the gun's recoil spring (a bolt-action rifle's mainspring on its
// firing pin). Heavy: thick wire, close coils, blued; Lightened: thin wire, open
// coils, bright.
function springPart(g, name) {
  const heavy = /heavy/i.test(name);
  const k = g.kind;
  // Coil radius (to the wire's middle), wire radius, length, what it rides on.
  let [R, wire, len, rod] = {
    pistol: [g.cal * 0.42, g.cal * 0.075, Math.max(0.07, g.barrel * 0.85), 'plug'],
    revolver: [g.cal * 0.22, g.cal * 0.045, 0.045, 'strut'],
    smg: [0.0062, 0.00065, 0.19, 'guide'],
    rifle: g.action === 'bolt' ? [0.0045, 0.00052, 0.095, 'pin'] : [0.0056, 0.00058, 0.21, 'follower'],
    lmg: [0.0078, 0.00085, 0.23, 'guide'],
    at: [0.0115, 0.0013, 0.2, 'guide'],
  }[k];
  if (k === 'pistol') wire = Math.max(wire, 0.0004);
  wire *= heavy ? 1.3 : 0.78;
  const pitch = wire * (heavy ? 3.3 : 6.5);
  return { model: 'spring', R: q(R), wire: q(wire), len: q(len), pitch: q(pitch), mat: heavy ? 'springDark' : 'springBright', rod, heavy };
}

// Trigger groups. Each kind has its own blade and finish (see trigger()).
const TRIGGERS = {
  'Field Trigger Job': 'field',
  'Field Adjusted Trigger': 'adjusted',
  'Hair Trigger': 'hair',
  'Fine Hair Trigger': 'set',
  'Marksman Trigger Job': 'marksman',
  'Match Trigger': 'match',
  'Fast Trigger': 'fast',
};

function triggerPart(g, name) {
  const kind = TRIGGERS[name] || 'field';
  const s = { pistol: 0.72, revolver: 0.8, at: 1.15 }[g.kind] || 1;
  const hammer = ['pistol', 'revolver', 'semi'].includes(g.action);
  return { model: 'trigger', kind, s, issue: ISSUE[g.army] || 'steel', hammer };
}

// Iron sights in the gun's own style: US apertures, notches on a tangent leaf
// (most rifles, SMGs and MGs), a pistol's notch and blade.
function ironsPart(g) {
  const pistol = g.kind === 'pistol' || g.kind === 'revolver';
  const style = pistol ? 'pistol' : g.sight === 'aperture' ? 'aperture' : 'tangent';
  return { model: 'irons', style, s: pistol ? 0.8 : 1, finish: ISSUE[g.army] || 'steel' };
}

// Match sights: a target aperture with micrometer knobs (as the Lyman 48) and a
// globe front sight; on a pistol, an adjustable target rear and a Patridge blade.
function matchPart(g) {
  const pistol = g.kind === 'pistol' || g.kind === 'revolver';
  return { model: 'matchSights', style: pistol ? 'pistol' : 'receiver', finish: 'steel' };
}

function scopePart(g, u) {
  return { model: 'scope', family: u.family, mount: ISSUE[g.army] || 'steel' };
}

// Cartridges by name: case length and overall length; radii of rim, case head,
// shoulder ([start, end] from the head and the radius there) and mouth; the
// bullet's radius; head: rimless (extractor groove), rimmed or semi (semi-rimmed);
// the service bullet's nose. From the cartridges' drawings (C.I.P./SAAMI).
const CARTRIDGES = {
  '.45 APC': { caseLen: 0.0228, oal: 0.0324, rim: 0.0061, base: 0.00605, mouth: 0.006, bullet: 0.00574, head: 'rimless', nose: 'round' },
  '9mm Parabellum': { caseLen: 0.01915, oal: 0.0297, rim: 0.00498, base: 0.00496, mouth: 0.00483, bullet: 0.00451, head: 'rimless', nose: 'ogive' },
  '.32 ACP': { caseLen: 0.0173, oal: 0.025, rim: 0.0045, base: 0.0043, mouth: 0.0042, bullet: 0.00397, head: 'semi', nose: 'round' },
  '7.65x17mm SR': { caseLen: 0.0173, oal: 0.025, rim: 0.0045, base: 0.0043, mouth: 0.0042, bullet: 0.00397, head: 'semi', nose: 'round' },
  '6.35x15.5mm SR': { caseLen: 0.0156, oal: 0.0231, rim: 0.0038, base: 0.0035, mouth: 0.00352, bullet: 0.00319, head: 'semi', nose: 'round' },
  '7.62x25mm Tokarev': { caseLen: 0.0251, oal: 0.0349, rim: 0.00498, base: 0.00493, shoulder: [0.0175, 0.0193, 0.00478], mouth: 0.00424, bullet: 0.00393, head: 'rimless', nose: 'round' },
  '.30 Carbine': { caseLen: 0.0328, oal: 0.042, rim: 0.00457, base: 0.00452, mouth: 0.00419, bullet: 0.00391, head: 'rimless', nose: 'round' },
  '7.62x38mmR': { caseLen: 0.0388, oal: 0.0388, rim: 0.0049, base: 0.0042, mouth: 0.00385, bullet: 0.00375, head: 'rimmed', nose: 'nagant' },
  '.30-06 Springfield': { caseLen: 0.0633, oal: 0.0848, rim: 0.006, base: 0.00598, shoulder: [0.0495, 0.0532, 0.0056], mouth: 0.00432, bullet: 0.00391, head: 'rimless', nose: 'spitzer' },
  '7.92x57mm Mauser': { caseLen: 0.0569, oal: 0.0805, rim: 0.00598, base: 0.00598, shoulder: [0.0455, 0.0482, 0.00548], mouth: 0.00454, bullet: 0.00411, head: 'rimless', nose: 'spitzer' },
  '7.62x54mmR': { caseLen: 0.0537, oal: 0.0772, rim: 0.0072, base: 0.00619, shoulder: [0.0383, 0.0423, 0.00581], mouth: 0.00427, bullet: 0.00396, head: 'rimmed', nose: 'spitzer' },
  '7.92×33mm Kurz': { caseLen: 0.033, oal: 0.0478, rim: 0.00595, base: 0.00595, shoulder: [0.0245, 0.0268, 0.00555], mouth: 0.00445, bullet: 0.00411, head: 'rimless', nose: 'spitzer' },
  '14.5x114mm': { caseLen: 0.114, oal: 0.1558, rim: 0.0135, base: 0.0135, shoulder: [0.084, 0.092, 0.0128], mouth: 0.0083, bullet: 0.00744, head: 'rimless', nose: 'spitzer' },
};

// How each round looks: nose (round, ogive, spitzer, long, flat, hollow, soft,
// swc, wadcutter), jacket (gilding metal unless named), paint on the tip and a
// band below it, the primer's annulus, the case (brass unless named) and the
// seal at a revolver case's mouth. Real markings where the round is real (the
// black tips of AP, the Soviet heavy ball's yellow tip, P-41's black and red,
// the German s.S. green annulus); the makers' rounds are the original's
// inventions, so their colors are ours, the same for a maker in every caliber.
const ROUNDS = {
  a4: { nose: 'hollow', annulus: 'blue' }, // Akicita AMF
  a154: { nose: 'hollow', annulus: 'blue' },
  a8: { nose: 'flat', jacket: 'copper', annulus: 'red' }, // Akicita Kinetic
  a153: { nose: 'flat', jacket: 'copper', annulus: 'red' },
  a9: { jacket: 'cupronickel', annulus: 'violet' }, // United Defence Ranger
  a155: { jacket: 'cupronickel', annulus: 'violet' },
  a52: { nose: 'swc', case: 'nickel', annulus: 'red' }, // United Defence Super +P
  a159: { jacket: 'cupronickel', case: 'nickel' }, // United Defence .25ACP
  a40: { nose: 'soft', case: 'nickel' }, // United Defence 'Jackal'
  a12: { nose: 'flat', jacket: 'paint_black', case: 'steelCase', annulus: 'red' }, // Wulff Faust
  a150: { nose: 'flat', jacket: 'paint_black', case: 'steelCase', annulus: 'red' },
  a13: { jacket: 'cupronickel', tip: 'white', annulus: 'green' }, // Wulff Engel
  a103: { jacket: 'cupronickel', tip: 'white', annulus: 'green' },
  a17: { tip: 'orange', annulus: 'black' }, // DMW Fuchs
  a152: { tip: 'orange', annulus: 'black' },
  a18: { nose: 'flat', jacket: 'clad', tip: 'red', case: 'steelCase' }, // Leonov Devil
  a21: { jacket: 'clad', tip: 'green', case: 'steelCase' }, // Leonov Misha
  a22: { jacket: 'clad', tip: 'black', band: 'red', case: 'steelCase' }, // P-41, armor-piercing incendiary
  a157: { jacket: 'clad', tip: 'yellow', case: 'steelCase' }, // Leonov Mochshny
  a158: { jacket: 'clad', case: 'steelCase', annulus: 'red' }, // 6.3mm Tula
  a58: { nose: 'wadcutter', mouth: 'green' }, // CCCP Target
  a65: { case: 'copperSteel', mouth: 'violet' }, // Cartridge, Type R
  a66: { case: 'steelCase', mouth: 'red' }, // Leonov Medved
  a48: { jacket: 'clad', tip: 'black', band: 'red', case: 'steelCase' }, // Leonov Bronya MAX, as the B-32 API
  a49: { jacket: 'clad', tip: 'violet', band: 'red', case: 'steelCase' }, // Leonov Monstr, as the BZT tracer
  a24: { jacket: 'clad', case: 'steelCase', annulus: 'green' }, // s.S. Patrone
  a26: { nose: 'long', jacket: 'cupronickel', annulus: 'black' }, // Anschusspatrone s.S., selected for zeroing
  a51: { tip: 'black', annulus: 'red' }, // S.m.K. Hart, hard-cored
  a27: { nose: 'soft' }, // Bertie Clay Mk III (h): the soft nose of the Dum Dum arsenal's bullets
  a28: { tip: 'black' }, // Black Hornet, armor-piercing
  a29: { nose: 'long' }, // Match, M72
  a30: { tip: 'yellow', annulus: 'red' }, // Type D heavy ball
  a38: { jacket: 'clad', tip: 'white', case: 'steelCase', annulus: 'red' }, // Type L-41 JPH
  a39: { nose: 'long', jacket: 'clad', case: 'steelCase', annulus: 'red' }, // 7N1 Sniper
  a53: { nose: 'soft' }, // Jägerpatrone Kurz, hunting soft point
};

function cartridgePart(g, id) {
  const a = AMMO_TYPES[id];
  const c = CARTRIDGES[a.cartridge] || genericCartridge(g.cal);
  const look = ROUNDS[id] || {};
  return {
    model: 'cartridge',
    ...c,
    nose: c.nose === 'nagant' ? 'nagant' : look.nose || c.nose,
    jacket: look.jacket || 'gilding',
    tip: look.tip || null,
    band: look.band || null,
    annulus: look.annulus || null,
    case: look.case || 'brass',
    mouthSeal: look.mouth || null,
    flush: look.nose === 'wadcutter',
  };
}

// A cartridge for a bore not in the table: a bottlenecked rifle round or a
// straight pistol round of about the right size.
function genericCartridge(cal) {
  const r = cal / 2;
  return { caseLen: q(cal * 7), oal: q(cal * 10), rim: q(r * 1.5), base: q(r * 1.5), shoulder: [q(cal * 5.5), q(cal * 5.9), q(r * 1.4)], mouth: q(r * 1.1), bullet: q(r), head: 'rimless', nose: 'spitzer' };
}

// --- Materials --------------------------------------------------------------------

// The parts' own materials on top of the gun materials (chrome, stainless,
// the bullet and case metals, paints): built once per material set.
const extraMats = new WeakMap();
const PAINT = { red: 0x9a2a1d, black: 0x161514, green: 0x3e6a34, yellow: 0xc9a227, blue: 0x2c4f8f, violet: 0x6b3f8a, white: 0xdcd6c8, orange: 0xcc6a2c };

export function partMaterials(mats) {
  let m = extraMats.get(mats);
  if (m) return m;
  const metal = (rgb, roughness, metalness = 1) => new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...rgb), roughness, metalness });
  const extra = {
    chrome: metal([0.86, 0.87, 0.9], 0.07),
    stainless: metal([0.6, 0.6, 0.6], 0.3),
    boreDark: metal([0.04, 0.04, 0.045], 0.35),
    springDark: metal([0.08, 0.085, 0.1], 0.32),
    springBright: metal([0.5, 0.48, 0.44], 0.3),
    gilding: metal([0.7, 0.33, 0.17], 0.28),
    copper: metal([0.68, 0.24, 0.11], 0.32),
    clad: metal([0.5, 0.25, 0.13], 0.4),
    cupronickel: metal([0.62, 0.6, 0.56], 0.25),
    lead: metal([0.2, 0.2, 0.22], 0.6, 0.5),
    nickel: metal([0.72, 0.71, 0.68], 0.2),
    steelCase: metal([0.2, 0.2, 0.13], 0.45, 0.55),
    copperSteel: metal([0.46, 0.2, 0.1], 0.42),
    primer: metal([0.62, 0.36, 0.2], 0.35),
  };
  for (const [k, hex] of Object.entries(PAINT)) extra[`paint_${k}`] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.05 });
  m = Object.create(mats);
  for (const [k, mat] of Object.entries(extra)) {
    mat.name = `part:${k}`;
    mat.userData.texWorld = 0.3;
    const c = mat.color;
    mat.userData.lowColor = [c.r * 0.5, c.g * 0.5, c.b * 0.5];
    m[k] = mat;
  }
  extraMats.set(mats, m);
  return m;
}

// --- Building ----------------------------------------------------------------------

// Build a part: { root, parts, anchors, meta }. opts.lod as for buildGun.
export function buildPart(part, mats, { lod = 0 } = {}) {
  const fn = PARTS[part.model];
  if (!fn) throw new Error(`No part model ${part.model}`);
  const b = new GunBuilder(partMaterials(mats), { lod });
  fn(b, part);
  return b.build(part.model);
}

// A coil spring along -Z from z0: coil radius R (to the wire's middle), wire
// radius, length, pitch (from coil to coil); the end coils are closed.
export function coil(b, { R, wire, len, pitch, mat, x = 0, y = 0, z0 = 0 }) {
  const pe = wire * 2.05; // closed end coils, touching
  const turns = Math.max(2.5, (len - 2 * pe) / pitch + 2);
  const p = (len - 2 * pe) / (turns - 2);
  const zAt = (s) => (s <= 1 ? s * pe : s >= turns - 1 ? len - (turns - s) * pe : pe + (s - 1) * p);
  const helix = new THREE.Curve();
  helix.getPoint = (t, out = new THREE.Vector3()) => {
    const s = t * turns,
      a = s * TAU;
    return out.set(x + Math.cos(a) * R, y + Math.sin(a) * R, z0 - zAt(s));
  };
  const per = b.lod === 0 ? 20 : b.lod === 1 ? 8 : 4;
  const geo = new THREE.TubeGeometry(helix, Math.ceil(turns * per), wire, b.seg(8), false);
  return b._add(geo, mat);
}

// A round bar along Z with flutes (lengthwise grooves) milled into it between
// f0 and f1: n flutes, depth deep.
function fluted(b, { z0, z1, r, n = 6, depth, f0, f1, mat, phase = 0 }) {
  const M = b.detail(0) ? n * 8 : b.detail(1) ? n * 3 : 8;
  const ramp = Math.min(0.006, (f1 - f0) / 4);
  const env = (z) => smoothstep(f0, f0 + ramp, z) * (1 - smoothstep(f1 - ramp, f1, z));
  const zs = stations(z0, z1, b.detail(0) ? 0.003 : 0.02, [f0, f0 + ramp / 2, f0 + ramp, f1 - ramp, f1 - ramp / 2, f1]);
  sectionLoft(b, {
    zs,
    mat,
    section: (z) => {
      const e = env(z);
      const pts = [];
      for (let j = 0; j < M; j++) {
        const a = (j / M) * TAU;
        const g = Math.max(0, (Math.cos(n * (a - phase)) - 0.35) / 0.65) ** 0.6;
        const rr = r - depth * e * g;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      return pts;
    },
  });
}

// An octagonal bar along Z from z0 to z1 (z0 < z1), flats on top and sides,
// rf across the flats (half), a round hole down the middle.
function octagon(b, { z0, z1, rf, hole, mat }) {
  const rc = rf / Math.cos(Math.PI / 8);
  const outline = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i / 8) * TAU;
    outline.push([Math.cos(a) * rc, Math.sin(a) * rc]);
  }
  return plateXYz(b, { outline, holes: hole ? [circle(0, 0, hole, 20)] : [], z0, z1, mat, bevel: 0.0004 });
}

// --- Barrels ------------------------------------------------------------------------

function barrel(b, p) {
  const { len, bore, rMuzzle: rM, rBreech: rB, finish: F } = p;
  const zm = -len;
  const k = p.kind;
  // The threaded tenon behind the breech (none on a pistol's barrel).
  const ten = k === 'pistol' ? 0 : Math.min(0.022, len * 0.07);
  const rT = rB * 0.82;
  if (ten && b.detail(0)) {
    const thr = [];
    const pitch = Math.max(0.0012, rT * 0.12);
    for (let z = -0.0015; z > -ten + pitch; z -= pitch) thr.push([rT, z], [rT * 0.95, z - pitch / 2]);
    lathe(b, { mat: F, seg: 28, profile: [[0, 0], [rT * 0.9, 0], [rT * 0.95, -0.0006], ...thr, [rT, -ten]] });
  } else if (ten) b.cyl({ z0: 0, z1: -ten, r0: rT, mat: F, seg: 28 });
  // The bore and the crown's chamfer round it: lined (the lining shows as a
  // bright ring at the muzzle) or plain, dark deep inside.
  const depth = Math.min(0.05, len * 0.25);
  const rc = bore + Math.min(0.0025, (rM - bore) * 0.4);
  lathe(b, { mat: p.boreMat, seg: 28, profile: [[bore, zm + depth], [bore, zm + 0.001], [rc, zm]] });
  b.cyl({ z0: zm + depth, z1: zm + depth + 0.001, r0: bore + 0.0002, mat: 'black', seg: 16 });
  const zr = -ten - len * 0.14; // end of the chamber's reinforce
  if (p.profile === 'octagon') {
    lathe(b, { mat: F, seg: 28, profile: [[rB * 0.9, zr - 0.004], [rB, zr], [rB, -ten + 0.001], [rB * 0.9, -ten], [0, -ten]] });
    octagon(b, { z0: zm, z1: zr - 0.004, rf: (rM + rB * 0.8) / 2, hole: rc, mat: F });
  } else {
    // Muzzle crown, a straight run at the muzzle, the taper, a step to the reinforce.
    const prof = [[rc, zm], [rM - 0.0007, zm], [rM, zm + 0.0008]];
    if (k === 'pistol') prof.push([rM, -len * 0.3], [rB, -len * 0.3 + 0.001], [rB, -0.001], [rB - 0.001, 0], [0, 0]);
    else {
      const taper = p.profile === 'heavy' ? rM * 1.04 : p.profile === 'scout' ? rB * 0.62 : rB * 0.74;
      prof.push([rM, zm + len * 0.08], [taper, zr - len * 0.05], [taper * 1.05, zr - 0.006], [rB * 0.97, zr - 0.002], [rB, zr], [rB, -ten - 0.001], [rB * 0.9, -ten], [0, -ten]);
    }
    lathe(b, { mat: F, seg: 32, profile: prof });
  }
  // Pistol barrels: the hood over the chamber, locking lugs on top, the link below.
  if (k === 'pistol') {
    b.span({ z0: -len * 0.24, z1: 0, y0: 0, y1: rB + 0.0024, w: rB * 1.7, mat: F, r: 0.0012 });
    for (const f of [0.31, 0.39]) tube(b, { z0: -len * f - 0.0035, z1: -len * f, rIn: rM * 0.95, rOut: rM + 0.0018, mat: F, seg: 24 });
    b.extrude({ points: path([[-len * 0.25, -rB + 0.001, 1], [-len * 0.08, -rB + 0.001, 1], [-len * 0.11, -rB - 0.0075], [-len * 0.21, -rB - 0.0075]]), width: rB * 0.9, mat: F, bevel: 0.0008 });
    b.cylAxis({ axis: 'x', y: -rB - 0.0045, z: -len * 0.16, len: rB * 1.1, r: 0.0013, mat: 'steelBright', seg: 10 });
  }
  // A collar to hold an SMG's barrel in its receiver.
  if (k === 'smg') knurledKnob(b, { at: [0, 0, -ten - 0.008], axis: 'z', r: rB * 1.28, len: 0.012, teeth: 30, mat: F });
  // Front sight: a revolver's blade on the barrel, a band with a post on the rest.
  const zs = zm + Math.min(0.03, len * 0.07);
  if (p.sight && k === 'revolver') {
    b.extrude({ points: path([[zm + 0.003, rM - 0.0005, 1], [zm + 0.016, rM - 0.0005, 1], [zm + 0.011, rM + 0.0055], [zm + 0.005, rM + 0.006]]), width: 0.0028, mat: F, bevel: 0.0005 });
  } else if (p.sight && !p.brake) {
    tube(b, { z0: zs - 0.006, z1: zs + 0.006, rIn: rM, rOut: rM + 0.0028, mat: F, seg: 28 });
    b.extrude({ points: path([[zs - 0.004, rM + 0.002, 1], [zs + 0.005, rM + 0.002, 1], [zs + 0.0025, rM + 0.011], [zs - 0.002, rM + 0.011]]), width: 0.0024, mat: F, bevel: 0.0005 });
  }
  if (p.gas) {
    // The gas port's block under the barrel and a stub of the gas cylinder.
    const zg = zm + len * 0.2;
    b.span({ z0: zg - 0.011, z1: zg + 0.011, y0: -rM - 0.012, y1: -rM * 0.5, w: rM * 1.8, mat: F, r: 0.0015 });
    b.cyl({ y: -rM - 0.0075, z0: zg + 0.011, z1: zg + 0.05, r0: 0.0055, mat: F, seg: 20 });
  }
  if (p.brake === 'cone') {
    // Flash hider: a cone opening forward.
    tube(b, { z0: zm - 0.045, z1: zm + 0.012, rIn: rM * 1.12, rIn1: bore + 0.0012, rOut: rM * 1.32, rOut1: rM * 1.08, mat: F, seg: 32 });
  } else if (p.brake === 'fg42') {
    // The FG 42's muzzle brake: rings round a slotted core, its bayonet lug below.
    const L = 0.068;
    tube(b, { z0: zm - L, z1: zm + 0.004, rIn: bore + 0.0012, rOut: rM * 1.05, mat: 'black', seg: 24 });
    const n = 6;
    for (let i = 0; i < n; i++) {
      const z0 = zm - L + (i * L) / n;
      tube(b, { z0, z1: z0 + (L / n) * 0.55, rIn: rM, rOut: rM * 1.6, mat: F, seg: 28 });
    }
    tube(b, { z0: zm - 0.001, z1: zm + 0.016, rIn: rM * 0.98, rOut: rM * 1.62, rOut1: rM * 1.25, mat: F, seg: 28 });
    b.span({ z0: zm + 0.004, z1: zm + 0.03, y0: -rM * 1.6 - 0.004, y1: -rM * 0.6, w: 0.006, mat: F, r: 0.001 });
  } else if (p.brake === 'avs') {
    // The AVS-36's muzzle brake: a drum with ports cut through its sides.
    const L = 0.075,
      rb = rM * 1.55;
    lathe(b, { mat: F, seg: 30, profile: [[bore + 0.0012, zm - L], [rb * 0.92, zm - L], [rb, zm - L + 0.003], [rb, zm - 0.004], [rM, zm + 0.004], [rM * 0.9, zm + 0.004]] });
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.box({ x: sx * (rb - 0.0012), z: zm - L + 0.012 + i * 0.016, w: 0.003, h: rb * 1.05, d: 0.0085, mat: 'black', r: 0 });
  } else if (p.brake === 'ptrd') {
    // The PTRD's box brake: windows either side to throw the gas back.
    const L = 0.12,
      rb = rM * 1.3;
    b.cyl({ z0: zm + 0.01, z1: zm - L, r0: rb, mat: F, seg: 30 });
    b.span({ z0: zm - L, z1: zm - 0.02, y0: -rb * 1.2, y1: rb * 1.2, w: rb * 3.3, mat: F, r: 0.003 });
    for (const sx of [-1, 1]) for (const zz of [zm - 0.045, zm - 0.085]) b.box({ x: sx * rb * 1.62, z: zz, w: 0.004, h: rb * 1.8, d: 0.028, mat: 'black', r: 0.002 });
  }
  b.anchor('breech', 0, 0, 0);
  b.anchor('muzzle', 0, 0, zm);
  // Seen from ahead of the muzzle, so the bore, the crown and the profile show; a
  // long barrel framed on its front end (focus), the rest running out of the
  // picture.
  b.meta.view = len > 0.3 ? { dir: [0.62, 0.3, -0.72], fov: 18, focus: [zm - 0.13, zm + 0.3] } : { dir: [0.5, 0.32, -0.8], fov: 30 };
}

// --- Bolts ----------------------------------------------------------------------------

function bolt(b, p) {
  ({ rifle: rifleBolt, smg: smgBolt, carrier, slide, toggle, block })[p.kind](b, p);
  b.anchor('face', 0, 0, 0);
  b.meta.view = { dir: [0.7, 0.5, -0.45], fov: 20 };
}

// A turnbolt (Mauser, Springfield, Mosin; the PTRD's is the same, bigger): body,
// two locking lugs, the claw extractor, handle, the sleeve and cocking piece.
function rifleBolt(b, { r, len, handle, weight, finish: F }) {
  const light = weight !== 'heavy';
  if (light) fluted(b, { z0: 0, z1: len, r, n: 5, depth: r * 0.18, f0: len * 0.42, f1: len * 0.78, mat: F, phase: 0.3 });
  else b.cyl({ z0: 0, z1: len, r0: r, mat: F, seg: 30 });
  b.cylAxis({ axis: 'z', z: -0.0002, len: 0.0005, r: r * 0.2, mat: 'black', seg: 12 }); // firing pin hole
  for (const sy of [1, -1]) b.box({ y: sy * r * 1.12, z: r * 0.65, w: r * 0.9, h: r * 0.5, d: r * 1.25, mat: F, r: 0.0007 });
  b.cyl({ z0: len * 0.3, z1: len * 0.36, r0: r * 1.08, mat: F, seg: 28 }); // extractor collar
  b.extrude({ points: path([[-0.0006, r * 0.3, 1], [-0.0006, -r * 0.42, 1], [len * 0.62, -r * 0.42], [len * 0.68, -r * 0.28, 1], [len * 0.68, r * 0.24, 1]]), width: r * 0.3, x: r * 1.04, mat: F, bevel: 0.0005 });
  // Handle at the rear of the body.
  const zh = len * 0.9;
  b.cyl({ z0: zh - r * 0.6, z1: zh + r * 0.55, r0: r * 1.16, mat: F, seg: 28 });
  const kr = r * (weight === 'heavy' ? 1.25 : 1.05);
  let knob;
  if (handle === 'straight') {
    bar(b, { pts: [[r, 0, zh], [r * 3, 0, zh + r * 0.1], [r * 4.6, -r * 0.2, zh + r * 0.3]], r: r * 0.42, mat: F, seg: 14 });
    knob = [r * 5.2, -r * 0.25, zh + r * 0.35];
  } else if (handle === 'ptrd') {
    bar(b, { pts: [[r, 0, zh], [r * 2.4, -r * 0.4, zh], [r * 3.6, -r * 1.4, zh + r * 0.4]], r: r * 0.36, mat: F, seg: 14 });
    knob = [r * 4.1, -r * 2, zh + r * 0.6];
  } else {
    bar(b, { pts: [[r * 0.9, 0, zh], [r * 2.5, -r * 0.4, zh + r * 0.1], [r * 3.9, -r * 1.6, zh + r * 0.6], [r * 4.8, -r * 2.85, zh + r * 0.9]], r: [[0, r * 0.56], [0.6, r * 0.48], [1, r * 0.45]], mat: F, seg: 14 });
    knob = [r * 5.2, -r * 3.6, zh + r * 1.05];
  }
  b.sphere({ x: knob[0], y: knob[1], z: knob[2], r: kr, mat: F, seg: 22 });
  if (light) {
    // The knob drilled hollow, and holes through the body between the flutes.
    b.sphere({ x: knob[0], y: knob[1] - kr * 0.72, z: knob[2], r: kr * 0.42, sy: 0.4, mat: 'black', seg: 14 });
    for (const f of [0.2, 0.26]) b.cylAxis({ axis: 'y', y: r * 0.99, z: len * f, len: 0.0005, r: r * 0.22, mat: 'black', seg: 12 });
  }
  b.anchor('handle', ...knob);
  // Sleeve and cocking piece behind the body.
  const z1 = len,
    s = r / 0.0089;
  lathe(b, { mat: 'steel', seg: 28, profile: [[0, z1], [r * 1.15, z1], [r * 1.22, z1 + 0.0015 * s], [r * 1.22, z1 + 0.021 * s], [r * 1.05, z1 + 0.033 * s], [0, z1 + 0.033 * s]] });
  lathe(b, { mat: 'steel', seg: 24, profile: [[0, z1 + 0.033 * s], [r * 0.76, z1 + 0.033 * s], [r * 0.83, z1 + 0.036 * s], [r * 0.83, z1 + 0.05 * s], [r * 0.55, z1 + 0.056 * s], [0, z1 + 0.056 * s]] });
  b.box({ y: -r * 0.85, z: z1 + 0.042 * s, w: r * 0.7, h: r * 0.7, d: 0.022 * s, mat: 'steel', r: 0.001 });
  if (handle === 'bent') {
    // The Mauser's wing safety on the sleeve.
    b.cyl({ y: r * 1.17, z0: z1 + 0.004 * s, z1: z1 + 0.019 * s, r0: r * 0.47, mat: 'steel', seg: 16 });
    b.box({ x: -r * 0.6, y: r * 1.17, z: z1 + 0.012 * s, w: r * 0.95, h: r * 0.3, d: 0.0065 * s, mat: 'steel', r: 0.0007 });
  }
}

// An SMG's open bolt: a heavy round slug with its fixed firing pin, extractor and
// cocking handle.
function smgBolt(b, { r, len, weight, finish: F, bore }) {
  const L = weight === 'heavy' ? len * 1.08 : len;
  if (weight === 'heavy') {
    b.cyl({ z0: 0, z1: L, r0: r, mat: F, seg: 30 });
    b.cyl({ z0: L * 0.55, z1: L * 0.6, r0: r * 1.01, mat: 'steelBright', seg: 30 }); // a ring turned bright
  } else {
    const special = weight === 'special';
    fluted(b, { z0: 0, z1: L, r, n: special ? 6 : 4, depth: r * (special ? 0.28 : 0.17), f0: L * 0.15, f1: L * 0.9, mat: F, phase: 0.2 });
    // Holes drilled across to lighten it.
    const holes = special ? [0.3, 0.48, 0.66, 0.84] : [0.4, 0.7];
    for (const f of holes) b.cylAxis({ axis: 'x', x: 0, z: L * f, len: r * 2.02, r: r * 0.24, mat: 'black', seg: 14 });
    if (special) b.cyl({ z0: L, z1: L + 0.0002, r0: r * 0.55, mat: 'black', seg: 18 }); // bored out from behind
  }
  b.cylAxis({ axis: 'z', z: -0.0006, len: 0.0022, r: bore * 0.32, mat: 'steelBright', seg: 10 }); // fixed firing pin
  b.cylAxis({ axis: 'z', z: -0.0001, len: 0.0004, r: bore * 1.25, mat: 'black', seg: 18 }); // the cartridge's seat
  b.extrude({ points: path([[-0.0012, r * 0.35, 1], [-0.0012, -r * 0.25, 1], [L * 0.28, -r * 0.25, 1], [L * 0.28, r * 0.35, 1]]), width: r * 0.25, x: r * 0.95, mat: 'steelBright', bevel: 0.0004 }); // extractor
  // Cocking handle out to the right.
  const zc = L * 0.35;
  b.cylAxis({ axis: 'x', x: r + 0.006, z: zc, len: 0.012, r: 0.0028, mat: F, seg: 12 });
  b.cylAxis({ axis: 'x', x: r + 0.0135, z: zc, len: 0.007, r: 0.0058, mat: F, seg: 18 });
}

// A gas-operated gun's bolt and carrier: the bolt riding on the carrier, the
// piston rod out in front, the cocking handle on the side.
function carrier(b, { s, weight, finish: F, long }) {
  const k = s * (long ? 1 : 0.8);
  const heavy = weight === 'heavy';
  b.span({ z0: 0, z1: 0.075 * k, y0: -0.0095 * k, y1: 0.0095 * k, w: 0.018 * k, mat: F, r: 0.003 * k });
  for (const sx of [1, -1]) b.box({ x: sx * 0.0105 * k, z: 0.012 * k, w: 0.004 * k, h: 0.008 * k, d: 0.012 * k, mat: F, r: 0.001 }); // locking lugs
  b.cylAxis({ axis: 'z', z: -0.0002, len: 0.0005, r: 0.0016 * k, mat: 'black', seg: 12 });
  b.span({ z0: -0.025 * k, z1: 0.19 * k, y0: -0.032 * k, y1: -0.0095 * k, w: 0.021 * k, mat: F, r: 0.003 * k });
  if (heavy) b.span({ z0: 0.12 * k, z1: 0.19 * k, y0: -0.037 * k, y1: -0.03 * k, w: 0.023 * k, mat: F, r: 0.002 * k }); // the added weight
  else for (const f of [0.03, 0.07, 0.11, 0.15]) b.box({ x: 0.0106 * k, y: -0.021 * k, z: f * k, w: 0.0008, h: 0.012 * k, d: 0.022 * k, mat: 'black', r: 0.001 }); // lightening pockets
  b.box({ x: -0.015 * k, y: -0.02 * k, z: 0.06 * k, w: 0.012 * k, h: 0.008 * k, d: 0.01 * k, mat: F, r: 0.0015 }); // cocking handle
  // Piston rod (shortened) and its head.
  const zp = -0.09 * k;
  b.cyl({ y: -0.022 * k, z0: -0.025 * k, z1: zp, r0: 0.0055 * k, mat: F, seg: 20 });
  lathe(b, { y: -0.022 * k, mat: F, seg: 24, profile: [[0.0055 * k, zp], [0.0085 * k, zp - 0.001 * k], [0.0085 * k, zp - 0.025 * k], [0.007 * k, zp - 0.028 * k], [0, zp - 0.028 * k]] });
  if (b.detail(0)) for (const z of [0.006, 0.012, 0.018]) b.cyl({ y: -0.022 * k, z0: zp - z * k, z1: zp - z * k - 0.0012, r0: 0.0086 * k, mat: 'black', seg: 24 });
}

// A pistol's slide: serrations at the back, the ejection port, the sights;
// lightened with windows cut through its sides.
function slide(b, { len, w, h, bore, weight, finish: F }) {
  const y0 = -h * 0.36,
    y1 = h * 0.64;
  b.extrude({ points: path([[-len, y0, 1], [0.004, y0, 1], [0.004, y1 - 0.003], [0.001, y1], [-len + 0.003, y1], [-len, y1 - 0.004]]), width: w, mat: F, bevel: 0.0018 });
  b.cylAxis({ axis: 'z', y: 0, z: -len - 0.0001, len: 0.0005, r: bore + 0.0016, mat: 'black', seg: 18 });
  tube(b, { z0: -len - 0.0012, z1: -len + 0.002, rIn: bore + 0.0016, rOut: bore + 0.0038, mat: 'steelBright', seg: 20 }); // bushing
  if (b.detail(0)) {
    // Grip serrations, both sides.
    for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) b.box({ x: sx * (w / 2 + 0.00005), y: (y0 + y1) / 2 + 0.001, z: -0.004 - i * 0.0022, w: 0.0004, h: (y1 - y0) * 0.72, d: 0.0009, mat: 'black', r: 0 });
  }
  // Ejection port on the right.
  b.box({ x: w / 2 + 0.0001, y: h * 0.32, z: -len * 0.32, w: 0.0006, h: h * 0.42, d: len * 0.2, mat: 'black', r: 0.0006 });
  if (weight !== 'heavy') {
    // Windows cut through both sides ahead of the port.
    for (const sx of [-1, 1]) for (const f of [0.58, 0.76]) b.box({ x: sx * (w / 2 + 0.0001), y: h * 0.22, z: -len * f, w: 0.0006, h: h * 0.38, d: len * 0.13, mat: 'black', r: 0.0015 });
  }
  b.box({ y: y1 + 0.0018, z: -len + 0.008, w: 0.0026, h: 0.0036, d: 0.008, mat: F, r: 0.0006 }); // front sight
  for (const sx of [-1, 1]) b.box({ x: sx * 0.0032, y: y1 + 0.0018, z: -0.007, w: 0.0036, h: 0.0036, d: 0.006, mat: F, r: 0.0005 }); // rear notch
}

// The P 08's toggle: the breechblock and its two links with their grips.
function toggle(b, { len, w, weight, finish: F }) {
  const h = w * 0.7;
  b.span({ z0: 0, z1: 0.032, y0: -h / 2, y1: h / 2, w, mat: F, r: 0.002 }); // breechblock
  b.span({ z0: 0.032, z1: 0.062, y0: -h / 2 + 0.001, y1: h / 2, w: w * 0.85, mat: F, r: 0.002 });
  b.span({ z0: 0.062, z1: 0.082, y0: -h / 2 + 0.001, y1: h / 2 - 0.001, w: w * 0.85, mat: F, r: 0.002 });
  for (const sx of [-1, 1]) knurledKnob(b, { at: [sx * (w / 2 + 0.0035), h / 2 - 0.002, 0.062], axis: 'x', r: 0.0068, len: 0.007, teeth: 22, mat: F });
  for (const z of [0.032, 0.062]) b.cylAxis({ axis: 'x', y: 0, z, len: w + 0.001, r: 0.0022, mat: 'steelBright', seg: 12 });
  if (weight !== 'heavy') for (const z of [0.016, 0.047]) b.cylAxis({ axis: 'y', z, y: 0, len: h + 0.0004, r: 0.0026, mat: 'black', seg: 12 });
  b.anchor('end', 0, 0, len);
}

// The C96's square bolt with its cocking ears at the back.
function block(b, { w, weight, finish: F }) {
  const h = w * 0.62,
    L = 0.078;
  b.span({ z0: 0, z1: L, y0: -h / 2, y1: h / 2, w: w * 0.6, mat: F, r: 0.0015 });
  for (const sx of [-1, 1]) b.box({ x: sx * w * 0.42, y: h * 0.1, z: L - 0.006, w: w * 0.3, h: h * 1.1, d: 0.01, mat: F, r: 0.0012 });
  if (b.detail(0)) for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) b.box({ x: sx * w * 0.575, y: h * 0.1, z: L - 0.0095 + i * 0.0023, w: 0.0004, h: h, d: 0.0009, mat: 'black', r: 0 });
  b.cylAxis({ axis: 'z', z: -0.0002, len: 0.0005, r: 0.0011, mat: 'black', seg: 10 });
  if (weight !== 'heavy') for (const f of [0.25, 0.5]) b.box({ x: w * 0.301, z: L * f, w: 0.0006, h: h * 0.55, d: L * 0.17, mat: 'black', r: 0.001 });
}

// --- Springs --------------------------------------------------------------------------

// A spring on what it rides on: a pistol's on its plug and guide, a bolt-action
// rifle's mainspring on the firing pin, the rest on a guide rod.
function spring(b, p) {
  const { R, wire, len, pitch, mat, rod } = p;
  coil(b, { R, wire, len, pitch, mat, z0: 0 });
  const rr = Math.max(0.0008, (R - wire) * 0.55);
  if (rod === 'plug') {
    // The recoil spring plug in front, the guide behind.
    lathe(b, { mat: 'steel', seg: 22, profile: [[0, 0.007], [R + wire * 1.2, 0.007], [R + wire * 1.4, 0.0055], [R + wire * 1.4, -0.002], [R - wire * 1.4, -0.002]] });
    b.cyl({ z0: -len * 0.25, z1: -len - 0.003, r0: rr, mat: 'steel', seg: 12 });
    b.cyl({ z0: -len, z1: -len - 0.004, r0: R + wire, mat: 'steel', seg: 22 });
  } else if (rod === 'pin') {
    // The firing pin with its striker tip, the cocking piece's collar at the back.
    b.cyl({ z0: 0.012, z1: -len - 0.025, r0: rr, mat: 'steelBright', seg: 14 });
    b.cyl({ z0: 0.012, z1: 0.016, r0: rr * 0.55, r1: rr * 0.4, mat: 'steelBright', seg: 12 });
    b.cyl({ z0: 0.0005, z1: -0.0035, r0: R + wire, mat: 'steelBright', seg: 22 });
    b.cyl({ z0: -len - 0.025, z1: -len - 0.032, r0: rr * 2.2, mat: 'steel', seg: 16 });
  } else if (rod === 'strut') {
    b.cyl({ z0: 0.004, z1: -len - 0.004, r0: rr, mat: 'steel', seg: 12 });
  } else {
    // Guide rod through the spring, a head at the back; the follower in front.
    b.cyl({ z0: -0.004, z1: -len - 0.004, r0: rr, mat: 'steel', seg: 14 });
    lathe(b, { mat: 'steel', seg: 22, profile: [[0, -len - 0.008], [R + wire * 1.3, -len - 0.008], [R + wire * 1.3, -len - 0.001], [rr, -len]] });
    if (rod === 'follower') lathe(b, { mat: 'steel', seg: 22, profile: [[rr, 0], [R + wire, 0.0005], [R + wire, 0.009], [0, 0.009]] });
  }
  b.anchor('front', 0, 0, 0);
  b.anchor('back', 0, 0, -len);
  b.meta.view = { dir: [0.62, 0.5, -0.6], fov: 22 };
}

// --- Trigger groups ------------------------------------------------------------------

// A trigger group: the housing, the blade on its pin, the sear (and the hammer
// on a hammer-fired gun), the trigger spring and the adjusting screws. Kinds:
//   field     the issue blade, the sear stoned smooth
//   adjusted  the issue blade, an over-travel screw behind it
//   hair      a thin, sharply curved blade in the white, two screws
//   set       a double set trigger: the rear blade sets the front (hair) blade
//   marksman  a wide grooved blade in the white, two screws
//   match     a straight blade with a broad shoe, three brass-headed screws
//   fast      a short straight blade, short travel to its stop screw, phosphated
function triggerGroup(b, { kind, s, issue, hammer }) {
  const H = kind === 'fast' ? 'phosphate' : kind === 'field' || kind === 'adjusted' ? issue : 'steel';
  const bright = 'steelBright';
  const zb = kind === 'set' ? 0.052 : 0.036; // housing's rear end
  const w = 0.011 * s;
  // Housing: side plate with its pins.
  b.extrude({ points: path([[-0.015 * s, 0, 1], [zb * s, 0, 1], [(zb + 0.002) * s, 0.011 * s], [zb * s - 0.002, 0.013 * s, 1], [-0.011 * s, 0.013 * s, 1], [-0.017 * s, 0.006 * s]]), width: w, mat: H, bevel: 0.0008 });
  for (const [z, y] of [[0.003, 0.0045], [0.024, 0.005], [-0.009, 0.008]]) b.cylAxis({ axis: 'x', y: y * s, z: z * s, len: w + 0.001, r: 0.0016 * s, mat: bright, seg: 12 });
  // Sear at the top rear, stoned bright.
  b.span({ z0: 0.018 * s, z1: (zb + 0.004) * s, y0: 0.011 * s, y1: 0.0155 * s, w: 0.005 * s, mat: bright, r: 0.0006 });
  if (hammer) {
    b.extrude({ points: S3([[0.016, 0.011], [0.026, 0.012], [0.033, 0.024], [0.035, 0.032], [0.03, 0.033], [0.022, 0.024], [0.014, 0.016]], s), width: 0.006 * s, mat: H, bevel: 0.0007 });
    b.cylAxis({ axis: 'x', y: 0.014 * s, z: 0.02 * s, len: 0.0075 * s, r: 0.0022 * s, mat: bright, seg: 12 });
  }
  // Trigger spring behind the blade.
  place(b, { pos: [0, -0.001 * s, 0.009 * s], rot: [-Math.PI / 2, 0, 0] }, () => coil(b, { R: 0.0018 * s, wire: 0.00028 * s, len: 0.009 * s, pitch: 0.0011 * s, mat: 'springBright' }));
  // Adjusting screws through the housing's right side.
  const scr = (z, y, mat = 'steel') => screw(b, { at: [w / 2, (y + 0.006) * s, z * s], axis: 'x', r: 0.0021 * s, h: 0.0011 * s, mat, slot: 0.5 });
  if (kind === 'field' || kind === 'adjusted') {
    blade(b, { z: 0, yTop: 0, len: 0.024 * s, curve: 0.0065 * s, thick: 0.0055 * s, w: 0.0055 * s, mat: H });
    if (kind === 'adjusted') {
      scr(0.014, 0, 'steelBright');
      b.cylAxis({ axis: 'y', z: 0.014 * s, y: -0.0015 * s, len: 0.003 * s, r: 0.0009 * s, mat: bright, seg: 10 }); // its tip
    }
  } else if (kind === 'hair') {
    blade(b, { z: 0, yTop: 0, len: 0.028 * s, curve: 0.0095 * s, thick: 0.0036 * s, w: 0.0034 * s, mat: bright });
    scr(0.013, 0);
    scr(-0.008, 0);
  } else if (kind === 'set') {
    // Front (hair) blade and the rear set blade, the screw between them.
    blade(b, { z: 0, yTop: 0, len: 0.026 * s, curve: 0.0085 * s, thick: 0.0034 * s, w: 0.0034 * s, mat: bright });
    blade(b, { z: 0.02 * s, yTop: 0, len: 0.027 * s, curve: 0.009 * s, thick: 0.0058 * s, w: 0.0052 * s, mat: H });
    b.cylAxis({ axis: 'x', y: 0.0045 * s, z: 0.023 * s, len: w + 0.001, r: 0.0016 * s, mat: bright, seg: 12 });
    scr(0.013, 0, 'brass');
    b.cylAxis({ axis: 'y', z: 0.013 * s, y: -0.002 * s, len: 0.004 * s, r: 0.0009 * s, mat: bright, seg: 10 });
  } else if (kind === 'marksman') {
    blade(b, { z: 0, yTop: 0, len: 0.024 * s, curve: 0.004 * s, thick: 0.0065 * s, w: 0.0085 * s, mat: bright });
    if (b.detail(0)) {
      // Grooves across the face (where the face runs: back from the top, then
      // forward again toward the tip).
      for (let i = 0; i < 6; i++) {
        const t = 0.4 + i * 0.08;
        const zf = t < 0.45 ? (-0.0015 * t) / 0.45 : -0.0015 + (0.0033 * (t - 0.45)) / 0.4;
        b.box({ y: -0.024 * t * s, z: zf * s + 0.0002, w: 0.0087 * s, h: 0.0005 * s, d: 0.0006, mat: 'black', r: 0 });
      }
    }
    scr(0.013, 0);
    scr(-0.008, 0);
  } else if (kind === 'match') {
    // Straight blade with its broad shoe.
    b.extrude({ points: path([[-0.0012 * s, 0, 1], [0.004 * s, 0, 1], [0.0045 * s, -0.024 * s, 1], [-0.0005 * s, -0.024 * s, 1]]), width: 0.0055 * s, mat: 'stainless', bevel: 0.0006 });
    b.extrude({ points: path([[-0.0035 * s, -0.009 * s], [0.0005 * s, -0.0085 * s, 1], [0.001 * s, -0.024 * s, 1], [-0.003 * s, -0.0245 * s]]), width: 0.0135 * s, mat: 'stainless', bevel: 0.0008 });
    for (const z of [0.011, 0.019, -0.008]) scr(z, 0, 'brass');
  } else {
    // Fast: short and straight, the stop screw right behind it.
    b.extrude({ points: path([[-0.0008 * s, 0, 1], [0.0045 * s, 0, 1], [0.005 * s, -0.017 * s], [0.0025 * s, -0.0185 * s], [-0.001 * s, -0.017 * s]]), width: 0.006 * s, mat: H, bevel: 0.0008 });
    scr(0.009, 0, 'steelBright');
  }
  b.anchor('trigger', 0, -0.012 * s, 0);
  b.meta.view = { dir: [0.85, 0.12, -0.5], fov: 20 };
}

// Smooth outline from points scaled by s.
const S3 = (pts, s) => GunBuilder.smooth(pts.map(([z, y]) => [z * s, y * s]), 4);

// --- Sights ------------------------------------------------------------------------------

// Field adjusted iron sights: the rear sight at the origin, the front sight ahead
// of it (a short way, to keep them together in a picture; rearSight and
// frontSight build each on its own).
function irons(b, p) {
  const gap = p.style === 'pistol' ? 0.032 : p.style === 'tangent' ? 0.058 : 0.045;
  rearSight(b, p);
  place(b, { pos: [0, 0, -gap] }, () => frontSight(b, p));
  b.anchor('frontSight', 0, 0, -gap);
  b.meta.view = { dir: [0.7, 0.45, 0.55], fov: 20 };
}

export function rearSight(b, { style, s, finish: F }) {
  b.anchor('rearSight', 0, 0, 0);
  const knob = (at, axis, r) => knurledKnob(b, { at, axis, r, len: 0.0045 * s, teeth: 20, mat: 'steelBright' });
  if (style === 'aperture') {
    // Base, the two ears, the aperture on its slide, knobs both sides.
    b.span({ z0: -0.013, z1: 0.013, y0: 0, y1: 0.008, w: 0.024, mat: F, r: 0.0015 });
    for (const sx of [-1, 1]) b.span({ z0: -0.007, z1: 0.007, y0: 0.006, y1: 0.025, w: 0.003, x: sx * 0.0085, mat: F, r: 0.001 });
    plateXY(b, { outline: [[-0.0068, 0.008], [0.0068, 0.008], [0.0068, 0.026], [-0.0068, 0.026]], holes: [circle(0, 0.021, 0.0011, 16)], z: 0, thick: 0.004, mat: F });
    knob([-0.0145, 0.012, 0], 'x', 0.0068);
    knob([0.0145, 0.012, 0], 'x', 0.0058);
    screw(b, { at: [-0.0168, 0.012, 0], axis: '-x', r: 0.0018, mat: 'steel' });
    screw(b, { at: [0.0168, 0.012, 0], axis: 'x', r: 0.0016, mat: 'steel' });
  } else if (style === 'tangent') {
    // Base, the leaf rising from its hinge with the notch at its front, the
    // slider; windage screws either side of the notch.
    b.extrude({ points: path([[-0.024, 0, 1], [0.022, 0, 1], [0.022, 0.0075, 1], [-0.012, 0.0095], [-0.024, 0.006, 1]]), width: 0.024, mat: F, bevel: 0.0012 });
    place(b, { pos: [0, 0.0095, 0.018], rot: [0.06, 0, 0] }, () => {
      b.span({ z0: -0.05, z1: 0.002, y0: 0, y1: 0.0028, w: 0.017, mat: F, r: 0.0005 });
      if (b.detail(0)) for (let i = 1; i < 8; i++) b.box({ y: 0.0029, z: -0.006 - i * 0.0052, w: i % 2 ? 0.006 : 0.01, h: 0.0002, d: 0.0006, mat: 'paint_white', r: 0 });
      plateXY(b, { outline: [[-0.011, 0], [0.011, 0], [0.011, 0.0065], [0.0016, 0.0065], [0, 0.0035], [-0.0016, 0.0065], [-0.011, 0.0065]], z: -0.0505, thick: 0.0024, mat: F });
      for (const sx of [-1, 1]) screw(b, { at: [sx * 0.011, 0.0032, -0.0505], axis: sx > 0 ? 'x' : '-x', r: 0.0017, mat: 'steelBright', slot: Math.PI / 2 });
      b.span({ z0: -0.026, z1: -0.017, y0: -0.0015, y1: 0.0045, w: 0.021, mat: F, r: 0.001 });
      for (const sx of [-1, 1]) b.cylAxis({ axis: 'x', x: sx * 0.0115, y: 0.0015, z: -0.0215, len: 0.003, r: 0.0022, mat: 'steelBright', seg: 14 });
    });
  } else {
    // Pistol: a notched block in its dovetail, the set screw on top.
    b.extrude({ points: path([[-0.004, 0, 1], [0.005, 0, 1], [0.005, 0.0055, 1], [-0.004, 0.0045, 1]]), width: 0.017 * s, mat: F, bevel: 0.0006 });
    plateXY(b, { outline: [[-0.0085 * s, 0], [0.0085 * s, 0], [0.0085 * s, 0.0068], [0.0014, 0.0068], [0.0014, 0.0038], [-0.0014, 0.0038], [-0.0014, 0.0068], [-0.0085 * s, 0.0068]], z: 0.0045, thick: 0.0018, mat: F });
    screw(b, { at: [0.0045 * s, 0.0052, 0.0005], axis: 'y', r: 0.0014, mat: 'steelBright', slot: 0 });
    screw(b, { at: [-0.0045 * s, 0.0052, 0.0005], axis: 'y', r: 0.0014, mat: 'steelBright', slot: 0 });
  }
}

export function frontSight(b, { style, s, finish: F }) {
  b.anchor('frontSight', 0, 0, 0);
  if (style === 'aperture') {
    // Blade between two protecting ears.
    b.span({ z0: -0.008, z1: 0.008, y0: 0, y1: 0.006, w: 0.014, mat: F, r: 0.0012 });
    b.span({ z0: -0.003, z1: 0.003, y0: 0.005, y1: 0.017, w: 0.0026, mat: F, r: 0.0004 });
    for (const sx of [-1, 1]) b.extrude({ points: path([[-0.007, 0.005, 1], [0.007, 0.005, 1], [0.004, 0.019], [-0.005, 0.019]]), width: 0.0022, x: sx * 0.0058, mat: F, bevel: 0.0005 });
    screw(b, { at: [0.007, 0.003, 0], axis: 'x', r: 0.0016, mat: 'steelBright' });
  } else if (style === 'tangent') {
    // Barleycorn post on its dovetailed base under a hood.
    b.span({ z0: -0.008, z1: 0.008, y0: 0, y1: 0.0055, w: 0.013, mat: F, r: 0.0012 });
    b.extrude({ points: path([[-0.0035, 0.005, 1], [0.0035, 0.005, 1], [0.0006, 0.0155], [-0.0006, 0.0155]]), width: 0.0024, mat: F, bevel: 0.0004 });
    arcTube(b, { y: 0.009, z0: -0.0075, z1: 0.0075, r: 0.0085, gapCenter: -Math.PI / 2, gap: 1.6, mat: F });
    if (b.detail(0)) b.box({ x: 0.0066, y: 0.0028, z: 0, w: 0.0004, h: 0.003, d: 0.0006, mat: 'paint_white', r: 0 }); // the drift mark
  } else {
    // Pistol: a half-moon blade on a short base.
    b.span({ z0: -0.006, z1: 0.006, y0: 0, y1: 0.003, w: 0.007, mat: F, r: 0.001 });
    b.extrude({ points: path([[-0.005, 0.0025, 1], [0.0045, 0.0025, 1], [0.0025, 0.0085], [-0.002, 0.0088]]), width: 0.0028, mat: F, bevel: 0.0005 });
  }
}

// Match sights: a target receiver sight (as the Lyman 48: a plate on the
// receiver's side, an elevation slide, a windage arm out to the aperture disc,
// micrometer knobs on both) and a globe front sight; on a pistol, an adjustable
// target rear sight and a Patridge front blade.
function matchSights(b, { style, finish: F }) {
  const knob = (at, axis, r, len) => knurledKnob(b, { at, axis, r, len, teeth: 30, mat: 'steelBright' });
  if (style === 'pistol') {
    b.span({ z0: -0.01, z1: 0.01, y0: 0, y1: 0.0055, w: 0.018, mat: F, r: 0.001 });
    plateXY(b, { outline: [[-0.009, 0.004], [0.009, 0.004], [0.009, 0.0105], [0.0013, 0.0105], [0.0013, 0.0065], [-0.0013, 0.0065], [-0.0013, 0.0105], [-0.009, 0.0105]], z: 0.008, thick: 0.002, mat: F });
    screw(b, { at: [0.009, 0.0028, 0], axis: 'x', r: 0.0018, mat: 'steelBright', slot: Math.PI / 2 });
    screw(b, { at: [0, 0.0055, -0.004], axis: 'y', r: 0.0019, mat: 'steelBright', slot: 0 });
    place(b, { pos: [0, 0, -0.07] }, () => {
      b.span({ z0: -0.01, z1: 0.01, y0: 0, y1: 0.0035, w: 0.008, mat: F, r: 0.001 });
      b.extrude({ points: path([[-0.009, 0.003, 1], [0.0035, 0.003, 1], [0.0035, 0.0115, 1], [0.001, 0.0115, 1]]), width: 0.0032, mat: F, bevel: 0.0004 });
    });
    b.anchor('rearSight', 0, 0, 0);
    b.anchor('frontSight', 0, 0, -0.07);
    b.meta.view = { dir: [0.7, 0.5, 0.55], fov: 20 };
    return;
  }
  // Receiver sight: plate on the left of the receiver at x = -0.022.
  const xP = -0.022;
  b.span({ z0: -0.03, z1: 0.025, y0: -0.012, y1: 0.012, w: 0.004, x: xP, mat: F, r: 0.0012 });
  for (const z of [-0.02, 0.015]) screw(b, { at: [xP - 0.002, 0, z], axis: '-x', r: 0.0022, mat: 'steel' });
  b.span({ z0: -0.008, z1: 0.008, y0: -0.006, y1: 0.034, w: 0.009, x: xP - 0.0045, mat: F, r: 0.0012 });
  knob([xP - 0.0045, 0.039, 0], 'y', 0.0075, 0.007);
  if (b.detail(0)) for (let i = 0; i < 9; i++) b.box({ x: xP - 0.0091, y: 0.004 + i * 0.0032, z: 0.004, w: 0.0003, h: 0.0004, d: i % 2 ? 0.003 : 0.005, mat: 'paint_white', r: 0 });
  // Windage arm across to the aperture behind the bolt, its knob on the outside.
  b.span({ z0: -0.004, z1: 0.004, y0: 0.022, y1: 0.029, w: 0.026, x: xP + 0.013, mat: F, r: 0.001 });
  knob([xP - 0.0125, 0.0255, 0], 'x', 0.0062, 0.006);
  b.cylAxis({ axis: 'z', x: 0, y: 0.024, z: 0.004, len: 0.004, r: 0.0042, mat: F, seg: 18 });
  plateXY(b, { outline: circle(0, 0.024, 0.0105, 28), holes: [circle(0, 0.024, 0.0008, 12)], z: 0.0075, thick: 0.0028, mat: 'steel' });
  // Globe front sight ahead of it.
  place(b, { pos: [0, 0, -0.085] }, () => {
    b.span({ z0: -0.009, z1: 0.009, y0: 0, y1: 0.006, w: 0.014, mat: F, r: 0.0012 });
    b.span({ z0: -0.004, z1: 0.004, y0: 0.005, y1: 0.012, w: 0.006, mat: F, r: 0.0008 });
    tube(b, { y: 0.019, z0: -0.012, z1: 0.012, rIn: 0.0068, rOut: 0.0079, mat: F, seg: 28 });
    b.span({ z0: -0.001, z1: 0.001, y0: 0.012, y1: 0.0205, w: 0.0018, mat: 'steelBright', r: 0.0002 });
  });
  b.anchor('rearSight', 0, 0.024, 0.0075);
  b.anchor('frontSight', 0, 0.019, -0.085);
  b.meta.view = { dir: [0.75, 0.45, 0.5], fov: 20 };
}

// --- Scopes ------------------------------------------------------------------------------

// Each scope family's body in optics.js. Families optics.js has no body for yet
// stand in with the nearest one (the M73B1 for the Alaskan's slim tube, the
// ZF 39 for the ZF 4, the Zielacht for the PEM's big objective).
const SCOPE_BODY = {
  m84: optics.m84,
  m73b1: optics.weaver330,
  unertl: optics.unertl,
  zf39: optics.zf39,
  zf4: optics.zf4,
  zf41: optics.zf41,
  zielacht: optics.zielacht,
  pu: optics.pu,
  pe: optics.pem,
};
// The tube's radius under the rings, per body (7/8 in for the M84, 3/4 in for
// the Weaver and the Unertl, 26 mm for the German hunting and sniper scopes).
const TUBE_R = new Map([[optics.alaskan, 0.011], [optics.m84, 0.0111], [optics.weaver330, 0.0096], [optics.unertl, 0.0095], [optics.zf39, 0.013], [optics.zielacht, 0.013], [optics.zf41, 0.0098], [optics.zf4, 0.013], [optics.pu, 0.0115], [optics.pem, 0.0115]]);

function scope(b, { family, mount: M }) {
  const body = SCOPE_BODY[family];
  const zf = body(b, { x: 0, y: 0, zEye: 0 });
  const L = -zf;
  const r = TUBE_R.get(body) ?? 0.012;
  // Two rings on a base below the tube.
  const z0 = -L * 0.7,
    z1 = -L * 0.33;
  for (const z of [z0, z1]) {
    optics.ring(b, { y: 0, z, r, w: 0.012, t: 0.0026, mat: M });
    b.span({ z0: z - 0.006, z1: z + 0.006, y0: -r - 0.009, y1: -r - 0.001, w: 0.009, mat: M, r: 0.001 });
    screw(b, { at: [0, r + 0.0026, z], axis: 'y', r: 0.002, mat: M, slot: Math.PI / 2 });
  }
  b.span({ z0: z0 - 0.012, z1: z1 + 0.012, y0: -r - 0.015, y1: -r - 0.009, w: 0.016, mat: M, r: 0.0015 });
  b.anchor('base', 0, -r - 0.015, (z0 + z1) / 2);
  b.meta.view = { dir: [0.75, 0.4, 0.5], fov: 18 };
}

// --- Cartridges -------------------------------------------------------------------------

// The bullet's outline from the case mouth forward: [[r, d], ...] with d the
// distance ahead of the mouth, out to the point; L = the bullet's length out of
// the case. Also where its lead shows (soft points) and a hollow point's cavity.
function noseProfile(nose, rb, L) {
  const pts = [[rb, -0.0015]];
  const ogive = (d0, Lo, n = 14, stop = 0) => {
    const R = (rb * rb + Lo * Lo) / (2 * rb);
    for (let i = 1; i <= n; i++) {
      const x = (Lo * i) / n;
      const r = Math.sqrt(Math.max(0, R * R - x * x)) - (R - rb);
      if (r < stop) return d0 + x;
      pts.push([Math.max(r, 0), d0 + x]);
    }
    return d0 + Lo;
  };
  const round = (d0, Lo, n = 12, stop = 0) => {
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const r = rb * Math.sqrt(1 - t * t);
      if (r < stop) return d0 + Lo * t;
      pts.push([r, d0 + Lo * t]);
    }
    return d0 + Lo;
  };
  let lead = null,
    cavity = null;
  if (nose === 'spitzer' || nose === 'long' || nose === 'soft') {
    const Lo = L * (nose === 'long' ? 0.84 : 0.7);
    pts.push([rb, L - Lo]);
    ogive(L - Lo, Lo);
    if (nose === 'soft') lead = L * 0.8;
  } else if (nose === 'ogive') {
    const Lo = L * 0.78;
    pts.push([rb, L - Lo]);
    ogive(L - Lo, Lo);
  } else if (nose === 'round' || nose === 'hollow') {
    const Lo = Math.min(L * 0.8, rb * 1.45);
    pts.push([rb, L - Lo]);
    if (nose === 'hollow') {
      const d = round(L - Lo, Lo, 12, rb * 0.55);
      pts.push([rb * 0.55, d], [rb * 0.4, d]);
      cavity = { r: rb * 0.4, d };
    } else round(L - Lo, Lo);
  } else if (nose === 'flat') {
    pts.push([rb, L * 0.38], [rb * 0.6, L], [0, L]);
  } else if (nose === 'swc') {
    pts.push([rb, L * 0.3], [rb * 0.76, L * 0.3 + 0.0004], [rb * 0.6, L], [0, L]);
  } else pts.push([rb, L], [0, L]);
  return { pts, lead, cavity };
}

// The piece of a [[r, d], ...] outline from d0 to d1 (to its end for d1 = Infinity).
function cut(pts, d0, d1) {
  const at = (d) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [r0, a] = pts[i],
        [r1, c] = pts[i + 1];
      if (a <= d && d <= c && c > a) return r0 + ((r1 - r0) * (d - a)) / (c - a);
    }
    return pts[pts.length - 1][0];
  };
  const out = [[at(d0), d0]];
  for (const p of pts) if (p[1] > d0 && (p[1] < d1 || d1 === Infinity)) out.push(p);
  if (d1 !== Infinity) out.push([at(d1), d1]);
  return out;
}

function cartridgeModel(b, p) {
  const { caseLen, oal, rim, base, mouth, bullet: rb, head, nose } = p;
  const k = rim / 0.006; // head details scale with the case
  // Case: the head (rim, extractor groove), the body, the shoulder, the neck.
  const prof = [[0, 0], [rim, 0]];
  if (head === 'rimmed') prof.push([rim, -0.0016 * k], [base * 1.01, -0.0019 * k]);
  else if (head === 'semi') prof.push([rim, -0.001 * k], [base * 0.93, -0.0013 * k], [base * 0.93, -0.0018 * k], [base, -0.0023 * k]);
  else prof.push([rim, -0.0011 * k], [rim * 0.97, -0.0013 * k], [rim * 0.84, -0.0017 * k], [rim * 0.84, -0.0023 * k], [base, -0.0031 * k]);
  const nagant = nose === 'nagant';
  if (p.shoulder) {
    const [s0, s1, rs] = p.shoulder;
    prof.push([rs, -s0], [mouth, -s1], [mouth, -caseLen]);
  } else if (nagant && !p.flush) prof.push([mouth, -(caseLen - 0.0022)], [rb * 0.66, -caseLen]);
  else prof.push([mouth, -caseLen]);
  const top = prof[prof.length - 1][0];
  prof.push([Math.min(top, rb) - 0.0002, -caseLen + 0.0005]);
  lathe(b, { mat: p.case, seg: 32, profile: prof });
  // Primer and its annulus in the head.
  const pr = base * 0.42;
  b.cyl({ z0: -0.0002, z1: 0.00007, r0: pr, mat: 'primer', seg: 20 });
  if (p.annulus) tube(b, { z0: -0.0002, z1: 0.00005, rIn: pr, rOut: pr * 1.32, mat: `paint_${p.annulus}`, seg: 24 });
  if (nagant) {
    // The bullet sits inside the case: its nose shows in the crimped mouth.
    if (p.flush) b.cyl({ z0: -caseLen + 0.0004, z1: -caseLen - 0.0001, r0: mouth - 0.0004, mat: 'lead', seg: 24 });
    else b.cyl({ z0: -caseLen + 0.0018, z1: -caseLen + 0.0012, r0: rb * 0.68, mat: p.jacket, seg: 20 });
    if (p.mouthSeal) tube(b, { z0: -caseLen - 0.00005, z1: -caseLen + 0.0008, rIn: (p.flush ? mouth - 0.0004 : rb * 0.64), rOut: (p.flush ? mouth + 0.00005 : rb * 0.74), mat: `paint_${p.mouthSeal}`, seg: 24 });
    b.anchor('nose', 0, 0, -caseLen);
  } else {
    const L = oal - caseLen;
    const { pts, lead, cavity } = noseProfile(nose, rb, L);
    // Paint on the tip and the band below it; the lead of a soft point.
    const tipLen = Math.max(0.0025, L * 0.24),
      bandLen = Math.max(0.0014, L * 0.07);
    const pieces = [];
    if (lead) pieces.push([lead, p.jacket], [Infinity, 'lead']);
    else if (p.tip && p.band) pieces.push([L - tipLen - bandLen, p.jacket], [L - tipLen, `paint_${p.band}`], [Infinity, `paint_${p.tip}`]);
    else if (p.tip) pieces.push([L - tipLen, p.jacket], [Infinity, `paint_${p.tip}`]);
    else pieces.push([Infinity, p.jacket]);
    let d0 = -0.0015;
    for (const [d1, mat] of pieces) {
      const seg = cut(pts, d0, d1);
      lathe(b, { mat, seg: 28, profile: seg.map(([r, d]) => [r, -caseLen - d]) });
      d0 = d1;
    }
    if (cavity) lathe(b, { mat: 'black', seg: 20, profile: [[cavity.r, -caseLen - cavity.d + 0.0001], [cavity.r * 0.6, -caseLen - cavity.d + 0.0028], [0, -caseLen - cavity.d + 0.0028]] });
    b.anchor('nose', 0, 0, -oal);
  }
  b.anchor('head', 0, 0, 0);
  // From the side and a little ahead, so the nose (its paint, a hollow point)
  // shows; long rounds more from the side, to fill the picture.
  b.meta.view = oal > rim * 10 ? { dir: [0.9, 0.32, -0.28], fov: 18 } : { dir: [0.78, 0.45, -0.44], fov: 18 };
}

const PARTS = { barrel, bolt, spring, trigger: triggerGroup, irons, matchSights, scope, cartridge: cartridgeModel };
export const PART_MODELS = Object.keys(PARTS);
