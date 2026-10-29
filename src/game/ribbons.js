// Ribbons: how a soldier earns his weapons and tanks, as in the original game's
// final form. Each soldier has his own ribbons (Infantry Assault, SMG Assault,
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
//   t.vehicleKill(weapon, owner); t.drive(meters); t.jump();
//   const earned = ribbonPoints(t, cls);  // { infantryAssault: 1234, ... }
//   requirement(weaponId, cls)            // null (free) or { ribbon, level }
//   unlocked(soldier, weaponId)           // may he carry it?
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
};

// The weapon categories of the game data: 11 semi-automatic rifles and
// carbines, 12 bolt-action rifles (anti-tank rifles too), 13 assault rifles,
// 14 machine guns, 16 submachine guns, 17 handguns, 8 launchers, 9 grenades;
// tank guns 27 (light), 28 (medium), 20 (heavy), and the tanks' machine guns.
const TYPE_CAT = { semi: 11, carbine: 11, rifle: 12, sniper: 12, atRifle: 12, assault: 13, lmg: 14, smg: 16, pistol: 17, revolver: 17, launcher: 8, grenade: 9 };
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
};
const DRIVE_PER_M = 0.196; // Tank Driver
// Parachute: 73 a jump and 8.4 a second under the canopy. This game has no
// jumps; each time a paratrooper goes into battle counts as one, of about 12 s
// (ours).
const JUMP = 73.167 + 8.406 * 12;

// What the player does in a battle, by weapon category.
export class RibbonTally {
  constructor() {
    this.by = {};
    this.driven = 0;
    this.jumps = 0;
  }

  _c(weapon, owner) {
    let c = categoryOf(weapon, owner);
    if (c === 12 && (WEAPONS[weapon?.id]?.type ?? weapon?.type) === 'atRifle') c = 'atRifle';
    if (c === null) return null;
    return (this.by[c] ||= { shot: 0, dmg: 0, kill: 0, head: 0, vkill: 0 });
  }

  shot(weapon, owner) {
    const t = this._c(weapon, owner);
    if (t) t.shot++;
  }

  damage(weapon, owner, hp) {
    const t = this._c(weapon, owner);
    if (t && hp > 0) t.dmg += Math.min(hp, 100);
  }

  kill(weapon, owner, headshot = false) {
    const t = this._c(weapon, owner);
    if (!t) return;
    t.kill++;
    if (headshot) t.head++;
  }

  vehicleKill(weapon, owner) {
    const t = this._c(weapon, owner);
    if (t) t.vkill++;
  }

  drive(m) {
    if (m > 0) this.driven += m;
  }

  jump() {
    this.jumps++;
  }
}

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
        pts += s.shot * e.shot + s.dmg * e.dmg + (s.kill - s.head) * e.kill + s.head * (e.head || e.kill) + s.vkill * e.vkill;
      }
    }
    if (pts > 0) out[key] = pts;
  }
  if (RIBBONS.tankDriver.classes.includes(cls) && tally.driven > 0) out.tankDriver = tally.driven * DRIVE_PER_M;
  if (RIBBONS.parachute.classes.includes(cls) && tally.jumps > 0) out.parachute = tally.jumps * JUMP;
  return out;
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

// The ribbon and level a soldier of this class needs for a weapon, or null if
// it is his from the start. A scoped rifle opens with the plain rifle (the game
// data's scope unlocks could not be read with confidence).
export function requirement(weaponId, cls) {
  const def = WEAPONS[weaponId];
  if (!def) return null;
  const id = def.base || weaponId;
  if (START_KIT.has(id)) return null;
  const u = UNLOCKS[id];
  if (!u) return null;
  return u[cls] || u.all;
}

export function unlocked(soldier, weaponId) {
  const r = requirement(weaponId, soldier.cls);
  if (!r) return true;
  return ribbonLevel(soldier.ribbons?.[r.ribbon]).level >= r.level;
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
  return r ? `${RIBBONS[r.ribbon].name} ${r.level}` : '';
}
