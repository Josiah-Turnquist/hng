// Ribbons: how a soldier earns his weapons and tanks, as in the original game's
// final form. (Besides the ribbons below, every gun has a Specialist ribbon of
// its own, earned with that gun alone: level 9 of it lets a soldier carry the
// gun when it belongs to another army.) Each soldier has his own ribbons (Infantry Assault, SMG Assault,
// LMG Assault and so on); what he does in battle earns ribbon points (a kill
// with a bolt-action rifle 95, a headshot with it 213, each shot fired 7, each
// point of damage to a man 0.57), each ribbon has twelve levels, and his army's
// guns and tanks open at set levels of set ribbons: the US infantryman's M3
// Grease Gun at Infantry Assault 1, the Bazooka at 4, the M1 Carbine at 5. Rank
// still rises with experience (roster.js), but it opens no weapons.
//
// The point values, levels and unlocks are the game's own (the final server
// data, docs/research/heroes-and-generals.md 4.5); where this game has something
// the data doesn't cover, the choice is ours and marked as such.
//
//   const t = new RibbonTally();          // during a battle, for the player
//   t.shot(weapon, owner); t.damage(weapon, owner, hp); t.kill(weapon, owner, head);
//   t.assist(weapon, owner); t.vehicleKill(weapon, owner); t.drive(meters); t.jump();
//   const earned = ribbonPoints(t, cls);  // { infantryAssault: 1234, ... }
//   requirement(weaponId, cls, faction)   // null (free), { ribbon, level }, or false (never)
//   unlocked(soldier, weaponId)           // may he carry it?
//   carriable(soldier, slot)              // the guns of a slot he may choose from, own army first
import { WEAPONS } from '../weapons/defs.js';

// Ribbon points needed for levels 0 to 12 (ribbonlevel).
export const RIBBON_XP = [0, 500, 1500, 3500, 7500, 15500, 19500, 29500, 41500, 73500, 90500, 132500, 184500];

const ALL = ['infantry', 'paratrooper', 'recon', 'tanker'];
// Who earns each ribbon (ribbontemplate's class masks: Infantry Assault is the
// infantryman's, the paratrooper's and the scout's; LMG Assault the infantryman's
// alone; the armor ribbons the tank crew's).
export const RIBBONS = {
  infantryAssault: { name: 'Infantry Assault', classes: ['infantry', 'paratrooper', 'recon'], note: 'Rifles, carbines, submachine guns and machine guns' },
  lmgAssault: { name: 'LMG Assault', classes: ['infantry'], note: 'Light machine guns' },
  smgAssault: { name: 'SMG Assault', classes: ALL, note: 'Submachine guns' },
  handgunAssault: { name: 'Handgun Assault', classes: ALL, note: 'Pistols and revolvers' },
  explosives: { name: 'Explosives', classes: ALL, note: 'Grenades' },
  tankDestruction: { name: 'Tank Destruction', classes: ALL, note: 'Vehicles knocked out with launchers and anti-tank rifles' },
  parachute: { name: 'Parachute', classes: ['paratrooper'], note: 'Jumps into battle' },
  armorAssault: { name: 'Armor Assault', classes: ['tanker'], note: 'Tank guns: shots fired, vehicles knocked out' },
  armorDamage: { name: 'Armor Damage', classes: ['tanker'], note: 'Vehicles knocked out from a tank' },
  tankDriver: { name: 'Tank Driver', classes: ['tanker'], note: 'Distance driven in a tank' },
  closeCombat: { name: 'Close Combat', classes: ALL, note: 'Knives, bayonets, spades and bats' },
  tactical: { name: 'Tactical', classes: ALL, note: 'Points taken and turned neutral, kills while taking one' },
  defense: { name: 'Defense', classes: ALL, note: 'Kills of men taking a point, battles won defending' },
  medic: { name: 'Medic', classes: ALL, note: 'First aid given, to others above all, and vehicles repaired' },
  recon: { name: 'Recon', classes: ['infantry', 'recon'], note: 'Kills and hits from far off, battles without falling' },
  physicalTraining: { name: 'Physical Training', classes: ALL, note: 'Distance run, sprinted and cycled' },
  combatMovement: { name: 'Combat Movement', classes: ALL, note: 'Distance walked and crouched' },
  driver: { name: 'Driver', classes: ['infantry', 'recon'], note: 'Distance driven in jeeps, trucks and on motorcycles' },
  chauffeur: { name: 'Chauffeur', classes: ['infantry', 'recon'], note: 'Distance driven with men aboard' },
};

// The weapon categories of the game data: 11 semi-automatic rifles and
// carbines, 12 bolt-action rifles (anti-tank rifles too), 13 assault rifles,
// 14 machine guns, 16 submachine guns, 17 handguns, 8 launchers, 9 grenades;
// tank guns 27 (light), 28 (medium), 20 (heavy), and the tanks' machine guns.
const TYPE_CAT = { semi: 11, carbine: 11, rifle: 12, sniper: 12, atRifle: 12, assault: 13, lmg: 14, smg: 16, pistol: 17, revolver: 17, launcher: 8, grenade: 9, melee: 10 };
const TANK_GUN_CAT = { m5a1_stuart: 27, m4a1_sherman: 28, panzer4_h: 28, t34_76: 28, tiger1: 20, t34_85: 20 };

export function categoryOf(weapon, owner) {
  if (!weapon) return null;
  if (weapon.vehicle) {
    if (weapon.id) return TANK_GUN_CAT[weapon.id] ?? null;
    // (A machine gun in a tank; one on a jeep or a sidecar earns nothing.)
    return owner?.vehicle?.def?.kind === 'tracked' ? 'tankMG' : null;
  }
  const def = WEAPONS[weapon.id] || weapon;
  return TYPE_CAT[def.type] ?? null;
}

// Points per shot fired, per point of damage to a man, per kill, per headshot
// kill, and per vehicle knocked out (statRequirement). Assault rifles (13)
// score as the data scores the StG 44, the only one it lists (ours: the M2
// Carbine and AVS-36 likewise).
const P = (shot, dmg, kill, head = 0, vkill = 0) => ({ shot, dmg, kill, head, vkill });
const EARN = {
  infantryAssault: { 11: P(0.746, 0.15, 70.382, 119.694), 12: P(7.398, 0.571, 94.709, 212.654), 13: P(1.66, 0.382, 59.232, 125.737), 14: P(0.559, 0.113, 52.786, 89.77), 16: P(0.373, 0.075, 35.191, 59.847) },
  lmgAssault: { 14: P(2.161, 0.792, 100.065, 230.383) },
  smgAssault: { 16: P(2.231, 0.514, 79.629, 169.037) },
  handgunAssault: { 17: P(13.792, 1.295, 225.796, 485.461) },
  explosives: { 9: P(14.029, 1.605, 770.699) },
  // (Anti-tank rifles: the data's PTRD and PzB 39, kept apart from category 12.)
  tankDestruction: { 8: P(0, 0, 0, 0, 253.925), atRifle: P(0, 0, 0, 0, 257.053) },
  armorAssault: { 27: P(1.624, 0, 0, 0, 61.508), 28: P(4.475, 0, 0, 0, 152.552), 20: P(5.572, 0, 0, 0, 177.316), tankMG: P(0.032, 0.256, 101.484) },
  armorDamage: { 27: P(0, 0, 0, 0, 40.681), 28: P(0, 0, 0, 0, 34.924), 20: P(0, 0, 0, 0, 31.64) },
  closeCombat: { 10: P(1.833, 2.083, 305.45) },
};
// The other ribbons (statRequirement), per meter, per event or per second:
const MOVE = { run: 0.148, sprint: 0.308, walk: 1.62, crouch: 14.494 }; // Physical Training, Combat Movement
const RIDE = { bicycle: 0.173, motorcycle: 0.334, car: 0.338, truck: 0.298 }; // Physical Training (bicycle), Driver
const CHAUFFEUR_PER_M = 1.0; // driving with men aboard (0.88 to 1.1 by vehicle)
const TACTICAL = { capture: 164.788, neutralize: 40, killWhileCapturing: 164.788 };
const DEFENSE = { killCapturing: 194.311, wonPerSecond: 2.46 }; // (the unit of the defender's win is unconfirmed: here per second of the battle)
const MEDIC = { self: 2, other: 25, repair: 30 };
// Recon: long-range kills and hits with rifles (categories 11 and 12; "long
// range" taken here as 150 m or more), headshots, a battle without falling.
const RECON = { kill: 28.099, dmg: 0.225, head: 104.07, survived: 224.792 };
export const LONG_RANGE = 150;
const DRIVE_PER_M = 0.196; // Tank Driver
// Parachute: 73 a jump and 8.4 a second under the canopy. This game has no
// jumps; each time a paratrooper goes into battle counts as one, of about 12 s
// (ours).
const JUMP = 73.167 + 8.406 * 12;

// What the player does in a battle, by weapon category.
export class RibbonTally {
  constructor() {
    this.by = {}; // by weapon category
    this.gun = {}; // by gun, for the Specialist ribbons
    this.driven = 0;
    this.jumps = 0;
  }

  // The tallies a weapon's use goes to: its category's and its own gun's.
  _c(weapon, owner) {
    const out = [];
    let c = categoryOf(weapon, owner);
    if (c === 12 && (WEAPONS[weapon?.id]?.type ?? weapon?.type) === 'atRifle') c = 'atRifle';
    const blank = () => ({ shot: 0, dmg: 0, kill: 0, head: 0, assist: 0, vkill: 0 });
    if (c !== null) out.push((this.by[c] ||= blank()));
    const id = specialistOf(weapon);
    if (id) out.push((this.gun[id] ||= blank()));
    return out;
  }

  shot(weapon, owner) {
    for (const t of this._c(weapon, owner)) t.shot++;
  }

  damage(weapon, owner, hp) {
    if (hp > 0) for (const t of this._c(weapon, owner)) t.dmg += Math.min(hp, 100);
  }

  kill(weapon, owner, headshot = false) {
    for (const t of this._c(weapon, owner)) {
      t.kill++;
      if (headshot) t.head++;
    }
  }

  // He hurt a man someone else then killed: scores as a kill (the game data
  // gives kill assists the kill's value).
  assist(weapon, owner) {
    for (const t of this._c(weapon, owner)) t.assist++;
  }

  vehicleKill(weapon, owner) {
    for (const t of this._c(weapon, owner)) t.vkill++;
  }

  drive(m) {
    if (m > 0) this.driven += m;
  }

  jump() {
    this.jumps++;
  }

  // Distance on foot by gait ('walk', 'run', 'sprint', 'crouch'), and driven
  // or ridden ('bicycle', 'motorcycle', 'car', 'truck'; withMen: men aboard).
  move(gait, m) {
    if (m > 0) (this.moved ||= {})[gait] = (this.moved[gait] || 0) + m;
  }

  ride(kind, m, withMen = false) {
    if (!(m > 0)) return;
    (this.rode ||= {})[kind] = (this.rode[kind] || 0) + m;
    if (withMen) this.chauffeured = (this.chauffeured || 0) + m;
  }

  // Points: 'capture', 'neutralize', 'killWhileCapturing', 'killCapturing'.
  event(kind) {
    (this.events ||= {})[kind] = (this.events[kind] || 0) + 1;
  }

  // A rifle hit or kill from long range (Recon): 'kill', 'head' (a headshot
  // kill) or 'dmg' (n: the damage).
  far(kind, n = 1) {
    (this.farOff ||= { kill: 0, dmg: 0, head: 0 })[kind] += n;
  }

  // The battle is over: did his side win, was he defending, how long it went,
  // did he fall.
  end({ won, defending, seconds, deaths }) {
    this.result = { won, defending, seconds, deaths };
  }

  // First aid given ('self' or 'other'), a vehicle repaired (the Medic ribbon).
  heal(who) {
    if (who === 'other') this.healOther = (this.healOther || 0) + 1;
    else this.healSelf = (this.healSelf || 0) + 1;
  }

  repair() {
    this.repairs = (this.repairs || 0) + 1;
  }
}

const score = (s, e) => s.shot * e.shot + s.dmg * e.dmg + (s.kill - s.head + (s.assist || 0)) * e.kill + s.head * (e.head || e.kill) + s.vkill * e.vkill;

// Ribbon points a battle earned a soldier of this class. (A headshot kill
// scores the headshot value in place of the plain kill, as one of them.)
export function ribbonPoints(tally, cls) {
  const out = {};
  for (const [key, table] of Object.entries(EARN)) {
    if (!RIBBONS[key].classes.includes(cls)) continue;
    let pts = 0;
    for (const [cat, e] of Object.entries(table)) {
      // (Anti-tank rifles are tallied apart, for Tank Destruction, but count as
      // the bolt-action rifles they are for men.)
      const sources = cat === '12' ? [tally.by[12], tally.by.atRifle] : [tally.by[cat]];
      for (const s of sources) {
        if (!s) continue;
        pts += score(s, e);
      }
    }
    if (pts > 0) out[key] = pts;
  }
  for (const [id, t] of Object.entries(tally.gun)) {
    const pts = score(t, SPECIALIST[id]);
    if (pts > 0) out[`spec:${id}`] = pts;
  }
  if (RIBBONS.tankDriver.classes.includes(cls) && tally.driven > 0) out.tankDriver = tally.driven * DRIVE_PER_M;
  if (RIBBONS.parachute.classes.includes(cls) && tally.jumps > 0) out.parachute = tally.jumps * JUMP;
  const add = (k, pts) => {
    if (pts > 0 && RIBBONS[k].classes.includes(cls)) out[k] = (out[k] || 0) + pts;
  };
  const mv = tally.moved || {},
    rd = tally.rode || {},
    ev = tally.events || {};
  add('physicalTraining', (mv.run || 0) * MOVE.run + (mv.sprint || 0) * MOVE.sprint + (rd.bicycle || 0) * RIDE.bicycle);
  add('combatMovement', (mv.walk || 0) * MOVE.walk + (mv.crouch || 0) * MOVE.crouch);
  add('driver', (rd.motorcycle || 0) * RIDE.motorcycle + (rd.car || 0) * RIDE.car + (rd.truck || 0) * RIDE.truck);
  add('chauffeur', (tally.chauffeured || 0) * CHAUFFEUR_PER_M);
  add('tactical', (ev.capture || 0) * TACTICAL.capture + (ev.neutralize || 0) * TACTICAL.neutralize + (ev.killWhileCapturing || 0) * TACTICAL.killWhileCapturing);
  const r = tally.result;
  add('defense', (ev.killCapturing || 0) * DEFENSE.killCapturing + (r?.won && r.defending ? r.seconds * DEFENSE.wonPerSecond : 0));
  add('medic', (tally.healSelf || 0) * MEDIC.self + (tally.healOther || 0) * MEDIC.other + (tally.repairs || 0) * MEDIC.repair);
  const f = tally.farOff;
  add('recon', (f ? f.kill * RECON.kill + f.dmg * RECON.dmg + f.head * RECON.head : 0) + (r && !r.deaths && r.seconds >= 120 ? RECON.survived : 0));
  return out;
}

// Specialist ribbons: each gun's own, earned with that gun (statRequirement):
// points per shot fired, point of damage to a man, kill (and kill assist),
// headshot kill, vehicle knocked out. A scoped rifle's go to the rifle's.
const SPECIALIST = {
  m1_garand: P(9.844, 1.986, 929.162, 1580.168),
  m1_carbine: P(2.355, 0.475, 222.269, 378.0),
  m1a1_carbine: P(2.355, 0.475, 222.269, 378.0),
  m2_carbine: P(3.2, 0.7, 115, 224),
  m1903: P(19.905, 1.536, 254.825, 572.168),
  thompson_m1a1: P(3.805, 0.876, 135.794, 288.264),
  m3_greasegun: P(13.058, 3.007, 466.044, 989.319),
  bar_m1918a2: P(5.593, 2.051, 258.992, 596.284),
  m1919a6: P(3.2, 0.7, 115, 244),
  johnson_lmg: P(3.2, 0.7, 115, 244),
  m1911a1: P(29.214, 2.742, 478.296, 1028.336),
  m1917_revolver: P(31.029, 2.913, 508.012, 1092.226),
  kar98k: P(17.51, 1.351, 224.161, 503.318),
  gewehr43: P(9.872, 1.991, 931.826, 1584.699),
  mp40: P(3.805, 0.876, 135.805, 288.287),
  mp34: P(11.308, 2.604, 403.596, 856.755),
  stg44: P(3.2, 0.7, 115, 244),
  mg42: P(3.497, 1.282, 161.922, 372.798),
  mg34: P(4.954, 1.817, 229.405, 528.165),
  fg42: P(2.127, 0.78, 98.474, 226.718),
  p38: P(24.197, 2.271, 396.163, 851.749),
  luger_p08: P(24.435, 2.294, 400.057, 860.121),
  c96: P(28.156, 2.643, 460.978, 991.101),
  mosin_9130: P(18.216, 1.405, 233.202, 523.617),
  svt40: P(8.828, 1.781, 833.263, 1417.077),
  avs36: P(3.445, 0.695, 115, 244),
  ppsh41: P(3.223, 0.742, 115.037, 244.2),
  pps43: P(3.223, 0.742, 115.037, 244.2),
  ppd40: P(10.042, 2.313, 358.425, 760.865),
  dp28: P(4.313, 1.582, 199.727, 459.836),
  tt33: P(25.719, 2.414, 421.082, 905.325),
  nagant_m1895: P(28.961, 2.718, 474.145, 1019.411),
  ptrd41: P(20.531, 1.584, 262.844, 590.175, 706.513),
};

// The gun whose Specialist ribbon a weapon's use goes to (null: none).
function specialistOf(weapon) {
  if (!weapon || weapon.vehicle) return null;
  const def = WEAPONS[weapon.id];
  const id = def?.base || weapon.id;
  return SPECIALIST[id] ? id : null;
}

// A ribbon's name and what earns it, for any ribbon key (a Specialist
// ribbon's is 'spec:' and the gun).
export function ribbonInfo(key) {
  if (RIBBONS[key]) return RIBBONS[key];
  const id = key.startsWith('spec:') ? key.slice(5) : null;
  if (!id || !SPECIALIST[id]) return null;
  return { name: `${WEAPONS[id].name} Specialist`, classes: ALL, note: `The ${WEAPONS[id].name} alone`, gun: id };
}

// Level (0 to 12) for an amount of ribbon points, and how far to the next.
export function ribbonLevel(pts = 0) {
  let l = 0;
  while (l < RIBBON_XP.length - 1 && pts >= RIBBON_XP[l + 1]) l++;
  const lo = RIBBON_XP[l],
    hi = RIBBON_XP[l + 1];
  return { level: l, next: hi ?? null, progress: hi === undefined ? 1 : (pts - lo) / (hi - lo) };
}

// Where each of the army's own weapons opens, by class (progressionUnlock): the
// ribbon and its level. Not listed for a class: as for the others. Level 0 opens
// with the ribbon itself (the army's first rifle).
const R = (ribbon, level) => ({ ribbon, level });
const IA = (l) => R('infantryAssault', l);
const UNLOCKS = {
  // United States
  m1_garand: { all: IA(0) },
  m3_greasegun: { all: IA(1), tanker: R('armorDamage', 0) },
  m1_carbine: { all: IA(5), paratrooper: R('parachute', 4) },
  bazooka_m1a1: { all: IA(4) },
  m1903: { all: IA(6) },
  bar_m1918a2: { all: IA(7) },
  m2_carbine: { all: IA(12) },
  johnson_lmg: { all: R('lmgAssault', 5), paratrooper: R('parachute', 9) },
  m1919a6: { all: R('lmgAssault', 12) },
  m1a1_carbine: { all: R('parachute', 6), tanker: R('armorDamage', 9) },
  thompson_m1a1: { all: R('smgAssault', 9) },
  m1917_revolver: { all: R('handgunAssault', 9) },
  // Germany
  gewehr43: { all: IA(0) },
  mp34: { all: IA(1), tanker: R('armorDamage', 0) },
  kar98k: { all: IA(6) },
  mg34: { all: R('lmgAssault', 5) },
  mg42: { all: R('lmgAssault', 12) },
  stg44: { all: IA(12) },
  mp40: { all: R('smgAssault', 9) },
  fg42: { all: R('parachute', 9) },
  luger_p08: { all: R('handgunAssault', 8) },
  p38: { all: R('handgunAssault', 12) },
  panzerschreck: { all: R('tankDestruction', 11) },
  // (The real game had the Panzerfaust only in crates on the map; here it opens
  // with the first level of Tank Destruction: ours.)
  panzerfaust60: { all: R('tankDestruction', 1) },
  // Pocket pistols, first-aid kits and binoculars by Tactical; the medic pouch
  // by Medic; the wrench by Driver (by Tank Driver for tank crews; not for
  // paratroopers, who had neither ribbon).
  colt_1903: { all: R('tactical', 1) },
  beretta_1934: { all: R('tactical', 1) },
  korovin_tk: { all: R('tactical', 1) },
  firstaid_us: { all: R('tactical', 2) },
  firstaid_ge: { all: R('tactical', 2) },
  firstaid_su: { all: R('tactical', 2) },
  binoc_us: { all: R('tactical', 3) },
  binoc_ge: { all: R('tactical', 3) },
  binoc_su: { all: R('tactical', 3) },
  medic_us: { all: R('medic', 6) },
  medic_ge: { all: R('medic', 6) },
  medic_su: { all: R('medic', 6) },
  wrench: { all: R('driver', 6), tanker: R('tankDriver', 2), paratrooper: false },
  // Soviet Union
  svt40: { all: IA(0) },
  ppd40: { all: IA(1), tanker: R('armorDamage', 0) },
  mosin_9130: { all: IA(6) },
  dp28: { all: IA(7) },
  avs36: { all: IA(12) },
  ppsh41: { all: R('smgAssault', 9) },
  pps43: { all: R('smgAssault', 11) },
  ptrd41: { all: R('tankDestruction', 5) },
  nagant_m1895: { all: R('handgunAssault', 9) },
};
// Every new soldier carries his army's first pistol and grenade (in the real
// game they opened at Handgun Assault 5 and Explosives 3; ours, to keep the
// first battles as they were).
const START_KIT = new Set(['m1911a1', 'mk2_grenade', 'c96', 'stielhandgranate24', 'tt33', 'rgd33']);

// Close-combat weapons by Close Combat level, for each army (progressionUnlock):
// each army starts with its own spade and may earn the others' knives, spades
// and bats.
const MELEE_LADDER = {
  US: { spade_m1910: 0, spade_ge: 2, spade_mpl50: 4, knife_m3: 5, bat_us: 8, knife_nr40: 10, bayonet_s84_98: 11 },
  GE: { spade_ge: 0, spade_mpl50: 2, spade_m1910: 4, bayonet_s84_98: 5, bat_ge: 8, knife_m3: 9, knife_nr40: 10 },
  SU: { spade_mpl50: 0, spade_m1910: 2, spade_ge: 3, knife_nr40: 4, bayonet_avs36: 5, bat_lapta: 8, knife_m3: 9, bayonet_s84_98: 11 },
};
// An item every army has the same of (the repair wrench).
const anyArmy = (def) => def.faction === 'ALL' || def.anyArmy;

// Another army's weapons (progressionUnlock): a gun at level 9 of its own
// Specialist ribbon; launchers and anti-tank rifles by these; never grenades
// or the Panzerfaust (map crates only).
const FOREIGN = {
  bazooka_m1a1: { GE: R('tankDestruction', 9), SU: IA(4) }, // (Lend-Lease)
  panzerschreck: { US: R('tankDestruction', 12), SU: R('tankDestruction', 12) },
  ptrd41: { US: R('tankDestruction', 8), GE: R('spec:ptrd41', 9) },
};

// The ribbon and level a soldier of this class and army needs for a weapon,
// null if it is his from the start, or false if he can never carry it. A
// scoped rifle opens with the plain rifle (the game data's scope unlocks could
// not be read with confidence).
export function requirement(weaponId, cls, faction) {
  const def = WEAPONS[weaponId];
  if (!def) return null;
  const id = def.base || weaponId;
  if (def.type === 'melee') {
    const l = MELEE_LADDER[faction || def.faction]?.[id];
    return l === undefined ? false : l === 0 ? null : R('closeCombat', l);
  }
  if (faction && faction !== def.faction && !anyArmy(def)) {
    if (FOREIGN[id]) return FOREIGN[id][faction] || false;
    return SPECIALIST[id] ? R(`spec:${id}`, 9) : false;
  }
  if (START_KIT.has(id)) return null;
  const u = UNLOCKS[id];
  if (!u) return null;
  return cls in u ? u[cls] : u.all;
}

export function unlocked(soldier, weaponId) {
  const r = requirement(weaponId, soldier.cls, soldier.faction);
  if (r === false) return false;
  if (!r) return true;
  return ribbonLevel(soldier.ribbons?.[r.ribbon]).level >= r.level;
}

// The guns of a slot a soldier of this class may choose from (open or not):
// his army's, then any other army's he can ever carry.
export function carriable(soldier, slot) {
  const own = [],
    other = [];
  for (const w of Object.values(WEAPONS)) {
    if (w.slot !== slot || !w.classes.includes(soldier.cls)) continue;
    if (w.faction === soldier.faction || anyArmy(w)) {
      if (requirement(w.id, soldier.cls, soldier.faction) !== false) own.push(w);
    }
    else if (requirement(w.id, soldier.cls, soldier.faction) !== false) other.push(w);
  }
  return [...own, ...other];
}

// Tanks for the tank crew, by Armor Assault level (progressionUnlock): the
// Sherman, Panzer IV and T-34/76 at 7, the Tiger at 9, the T-34-85 at 10. The
// real game started crews in light tanks this game doesn't have (M2A2, Panzer I,
// T-26), so here each army's first tank stands in for them (ours).
const TANK_UNLOCKS = { m5a1_stuart: 0, m4a1_sherman: 7, panzer4_h: 0, tiger1: 9, t34_76: 0, t34_85: 10 };

export function tankRequirement(tankId) {
  const l = TANK_UNLOCKS[tankId];
  return l ? R('armorAssault', l) : null;
}

export function tankUnlocked(soldier, tankId) {
  const r = tankRequirement(tankId);
  return !r || ribbonLevel(soldier.ribbons?.[r.ribbon]).level >= r.level;
}

// The ribbons a soldier of this class earns, in the order to show them.
export function ribbonsFor(cls) {
  return Object.keys(RIBBONS).filter((k) => RIBBONS[k].classes.includes(cls));
}

export function requirementText(r) {
  return r ? `${ribbonInfo(r.ribbon).name} ${r.level}` : '';
}
