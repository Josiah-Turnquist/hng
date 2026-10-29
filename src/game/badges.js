// Combat badges, as in the original game: a soldier wears two, and their tiers
// open at set levels of his ribbons (combatbadgetemplate, combatbadgetype and
// progressionUnlock item type 7). The data gives each tier's value but not what
// it changes; what each badge does here is read from its name and values, and
// marked "ours" in the research notes (docs/research/heroes-and-generals.md
// 4.6). Badges for things this game doesn't have (aircraft, parachute jumps,
// stealing vehicles, squad leadership) are left out.
//
//   BADGE_SLOTS                           // how many he wears: 2
//   wornIds(soldier)                      // the ids he has chosen, one per slot (null for empty)
//   badgeOf(soldier, slot)                // { id, tier, value } he wears there, or null
//   badgesOf(soldier)                     // all he wears: [{ id, tier, value }]
//   badgeValue(soldier, id, dflt)         // a worn badge's value, else dflt
//   badgeTiers(soldier, id)               // tiers open to him: [{ tier, value, open, ribbon, level }]
//   wearable(soldier)                     // the badges he may choose (some tier open)
import { ribbonLevel } from './ribbons.js';

const T = (ribbon, levels, values) => levels.map((level, i) => ({ ribbon, level, value: values[i] }));

export const BADGES = {
  quickdraw: { name: 'Quickdraw', does: 'Switches weapons faster', show: (v) => `${Math.round((1 - v) * 100)}% quicker`, tiers: T('combatMovement', [4, 8, 12], [0.75, 0.62, 0.5]) },
  marathonMan: { name: 'Marathon Man', does: 'Gets his breath back faster after sprinting', show: (v) => `${v}x as fast`, tiers: T('physicalTraining', [2, 6, 10], [2, 2.5, 3]) },
  heavySet: { name: 'Heavy Set', does: 'Takes less harm from falls and blasts', show: (v) => `${Math.round((1 - v) * 100)}% less`, tiers: T('physicalTraining', [4, 8, 12], [0.92, 0.89, 0.85]) },
  fastReload: { name: 'Fast Reload', does: 'Reloads faster', show: (v) => `${Math.round((1 - v) * 100)}% quicker`, tiers: T('smgAssault', [4, 8, 12], [0.85, 0.77, 0.7]) },
  pointShooter: { name: 'Point Shooter', does: 'Shoots straighter from the hip', show: (v) => `${Math.round((1 - v) * 100)}% tighter`, tiers: T('handgunAssault', [3, 7, 11], [0.75, 0.62, 0.5]) },
  tightGrip: { name: 'Tight Grip', does: 'Holds the gun down: less climb in bursts', show: (v) => `${Math.round((1 - v) * 100)}% less`, tiers: T('lmgAssault', [3, 7, 11], [0.75, 0.62, 0.5]) },
  deadEye: { name: 'Dead-eye', does: 'Holds his breath longer when aiming', show: (v) => `${v}x as long`, tiers: T('recon', [3, 7, 11], [1.25, 1.38, 1.5]) },
  ghillie: { name: 'Ghillie', does: 'Harder for the enemy to make out while he holds his fire', show: (v) => `${Math.round((1 - v) * 100)}% slower to be seen`, tiers: T('recon', [2, 6, 10], [0.75, 0.5, 0.1]) },
  grenadier: { name: 'Grenadier', does: 'Throws grenades further', show: (v) => `${Math.round((v - 1) * 100)}% further`, tiers: T('explosives', [1, 6, 10], [1.08, 1.11, 1.15]) },
  dynamiteLover: { name: 'Dynamite Lover', does: 'Carries more grenades', show: (v) => `+${v}`, tiers: T('explosives', [4, 8, 12], [1, 2, 3]) },
  hoarder: { name: 'Hoarder', does: 'Carries spare magazines for his main weapon', show: (v) => `+${v}`, tiers: T('defense', [3, 7, 11], [1, 2, 3]) },
  scavenger: { name: 'Scavenger', does: "Takes ammunition from fallen men's guns as he passes", show: (v) => `${Math.round(v * 100)}% of a magazine`, tiers: T('defense', [1, 5, 9], [0.5, 0.75, 1]) },
  firstAid: { name: 'First Aid', does: 'Bandages and gives first aid faster', show: (v) => `${Math.round((1 - v) * 100)}% quicker`, tiers: T('medic', [4, 8, 12], [0.72, 0.625, 0.56]) },
  combatMedic: { name: 'Combat Medic', does: 'More uses of his first-aid kit or medic pouch', show: (v) => `+${v}`, tiers: T('medic', [3, 7, 11], [1, 2, 3]) },
  handOfGod: { name: 'Hand of God', does: 'His first aid heals more', show: (v) => `${v}x`, tiers: T('medic', [1, 5, 9], [1.4, 1.6, 1.8]) },
  mechanic: { name: 'Mechanic', does: 'Repairs vehicles faster with the wrench', show: (v) => `${Math.round((1 - v) * 100)}% quicker`, tiers: [...T('driver', [3, 7, 11], [0.71, 0.63, 0.56]), ...T('tankDriver', [3, 7, 12], [0.71, 0.63, 0.56])] },
  driver: { name: 'Driver', does: 'Hurt less when his vehicle crashes', show: (v) => `${Math.round((1 - v) * 100)}% less`, tiers: T('chauffeur', [2, 6, 10], [0.75, 0.62, 0.5]) },
  gunner: { name: 'Gunner', does: "Loads his tank's main gun faster", show: (v) => `${Math.round((1 - v) * 100)}% quicker`, tiers: T('armorDamage', [4, 8, 12], [0.9, 0.85, 0.8]) },
};

// The tiers of a badge and which are open to this soldier (a tier opens at
// its ribbon level; the Mechanic's open by either of two ribbons).
export function badgeTiers(s, id) {
  const b = BADGES[id];
  if (!b) return [];
  const lv = (r) => ribbonLevel(s.ribbons?.[r]).level;
  const n = Math.max(...b.tiers.map((t, i) => i % 3)) + 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const alts = b.tiers.filter((t, j) => j % 3 === i);
    const open = alts.some((t) => lv(t.ribbon) >= t.level);
    out.push({ tier: i + 1, value: alts[0].value, open, ribbon: alts[0].ribbon, level: alts[0].level, alts });
  }
  return out;
}

export function wearable(s) {
  return Object.keys(BADGES).filter((id) => badgeTiers(s, id).some((t) => t.open));
}

export const BADGE_SLOTS = 2;

// The ids he has chosen, one per slot. Older saves kept one in s.badge.
export function wornIds(s) {
  const ids = Array.isArray(s?.badges) ? s.badges : [s?.badge?.id ?? s?.badge];
  return Array.from({ length: BADGE_SLOTS }, (_, i) => ids[i] || null);
}

// The badge he wears in a slot at its highest open tier, or null.
export function badgeOf(s, slot = 0) {
  const id = wornIds(s)[slot];
  if (!id || !BADGES[id]) return null;
  const open = badgeTiers(s, id).filter((t) => t.open);
  if (!open.length) return null;
  const t = open[open.length - 1];
  return { id, tier: t.tier, value: t.value };
}

export function badgesOf(s) {
  return wornIds(s)
    .map((_, i) => badgeOf(s, i))
    .filter(Boolean);
}

// A soldier in battle carries what he wears as s.badges: [{ id, value }].
export function badgeValue(s, id, dflt = 1) {
  const b = (s?.badges ?? [s?.badge]).find((x) => x?.id === id);
  return b && b.value !== undefined ? b.value : dflt;
}
