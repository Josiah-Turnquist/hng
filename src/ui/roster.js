// The player's soldiers, as in the original game's Heroes screen: one infantry
// soldier per army to begin with, more recruited from any army and class, each
// with a name, a rank earned from experience (XP), his ribbons (which open his
// weapons and tanks: game/ribbons.js), a loadout, a uniform, and a record of his
// battles. Kept in the browser (localStorage); without it the
// roster lives for this visit only.
//
//   const r = loadRoster();
//   r.selected                       // the soldier going into battle
//   recruit(r, { faction, cls, name }); select(r, id); dismiss(r, id); saveRoster(r);
//   awardBattle(r, id, { xp, won, kills, deaths, captures, ribbons })  // after a battle
import { DEFAULT_LOADOUT, WEAPONS, weaponsFor } from '../weapons/defs.js';
import { RIBBONS, ribbonLevel, unlocked, tankUnlocked } from '../game/ribbons.js';
import { variantCount } from '../actors/soldierKit.js';
import '../actors/soldierKitUS.js';
import '../actors/soldierKitGE.js';
import '../actors/soldierKitSU.js';

const KEY = 'hng.roster.v1';

// Cumulative XP for ranks 0 to 22, from the original game's final data
// (ExperienceLevels; see docs/research/heroes-and-generals.md 4.3).
export const RANK_XP = [0, 10, 1000, 3000, 6500, 11000, 19500, 30000, 41000, 52500, 64500, 77000, 101000, 160000, 219000, 462000, 1498000, 2534000, 5035000, 9036000, 13037000, 17038000, 29040000];

// Rank titles of each army, low to high. The original game numbered ranks 0 to 22
// (generals from 18); these are the real titles of 1944 laid over those numbers in
// order, ours rather than the game's (its titles are not recorded).
export const RANK_TITLES = {
  US: ['Private', 'Private First Class', 'Technician Fifth Grade', 'Corporal', 'Technician Fourth Grade', 'Sergeant', 'Technician Third Grade', 'Staff Sergeant', 'Technical Sergeant', 'Master Sergeant', 'First Sergeant', 'Warrant Officer', 'Second Lieutenant', 'First Lieutenant', 'Captain', 'Major', 'Lieutenant Colonel', 'Colonel', 'Brigadier General', 'Major General', 'Lieutenant General', 'General', 'General of the Army'],
  GE: ['Schütze', 'Oberschütze', 'Gefreiter', 'Obergefreiter', 'Stabsgefreiter', 'Unteroffizier', 'Unterfeldwebel', 'Feldwebel', 'Oberfeldwebel', 'Stabsfeldwebel', 'Fähnrich', 'Oberfähnrich', 'Leutnant', 'Oberleutnant', 'Hauptmann', 'Major', 'Oberstleutnant', 'Oberst', 'Generalmajor', 'Generalleutnant', 'General der Infanterie', 'Generaloberst', 'Generalfeldmarschall'],
  SU: ['Krasnoarmeyets', 'Krasnoarmeyets', 'Yefreytor', 'Yefreytor', 'Mladshiy serzhant', 'Serzhant', 'Serzhant', 'Starshiy serzhant', 'Starshiy serzhant', 'Starshina', 'Starshina', 'Mladshiy leytenant', 'Leytenant', 'Starshiy leytenant', 'Kapitan', 'Mayor', 'Podpolkovnik', 'Polkovnik', 'General-mayor', 'General-leytenant', 'General-polkovnik', 'General armii', 'Marshal'],
};

export const CLASS_NAMES = { infantry: 'Infantry', recon: 'Recon', paratrooper: 'Paratrooper', tanker: 'Tank crew' };
export const CLASS_NOTES = {
  infantry: 'Rifleman, assault or support gunner. Drives jeeps, rides bikes.',
  recon: 'Scoped rifle and a sidearm; spots and shoots from range.',
  paratrooper: 'Submachine guns and carbines for close fighting.',
  tanker: 'Deploys in a tank: drives it, lays and fires the main gun.',
};

const NAMES = {
  US: {
    first: ['John', 'James', 'Robert', 'William', 'Charles', 'George', 'Joseph', 'Frank', 'Edward', 'Thomas', 'Walter', 'Harold', 'Paul', 'Raymond', 'Jack', 'Donald', 'Richard', 'Henry', 'Albert', 'Arthur', 'Ralph', 'Eugene', 'Carl', 'Howard', 'Fred', 'Earl', 'Louis', 'Roy', 'Kenneth', 'Leonard'],
    last: ['Miller', 'Smith', 'Johnson', 'Brown', 'Williams', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Baker', 'Adams', 'Nelson', 'Kowalski', 'Russo', "O'Brien", 'Schultz', 'Novak', 'Garcia', 'Murphy'],
  },
  GE: {
    first: ['Hans', 'Karl', 'Heinz', 'Walter', 'Werner', 'Kurt', 'Günter', 'Helmut', 'Fritz', 'Otto', 'Ernst', 'Herbert', 'Wilhelm', 'Paul', 'Willi', 'Rudolf', 'Erich', 'Gerhard', 'Hermann', 'Josef', 'Franz', 'Horst', 'Alfred', 'Georg', 'Heinrich'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hartmann', 'Lange', 'Krause', 'Lehmann', 'Köhler', 'Maier'],
  },
  SU: {
    first: ['Ivan', 'Aleksandr', 'Nikolai', 'Mikhail', 'Vasily', 'Pyotr', 'Sergei', 'Dmitri', 'Fyodor', 'Grigori', 'Aleksei', 'Andrei', 'Viktor', 'Yuri', 'Boris', 'Pavel', 'Semyon', 'Stepan', 'Konstantin', 'Leonid', 'Anatoli', 'Vladimir', 'Yakov', 'Timofei'],
    last: ['Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Vasiliev', 'Petrov', 'Sokolov', 'Mikhailov', 'Novikov', 'Fyodorov', 'Morozov', 'Volkov', 'Alekseev', 'Lebedev', 'Semyonov', 'Yegorov', 'Pavlov', 'Kozlov', 'Stepanov', 'Nikolaev', 'Orlov', 'Andreev', 'Makarov', 'Zaitsev', 'Belov', 'Tkachenko'],
  },
};

const pick = (a, rng) => a[Math.floor(rng() * a.length)];

export function randomName(faction, rng = Math.random) {
  const n = NAMES[faction] || NAMES.US;
  return `${pick(n.first, rng)} ${pick(n.last, rng)}`;
}

// Rank (0 to 22) for an amount of XP, and how far it is to the next.
export function rankOf(xp) {
  let r = 0;
  while (r < RANK_XP.length - 1 && xp >= RANK_XP[r + 1]) r++;
  const lo = RANK_XP[r],
    hi = RANK_XP[r + 1];
  return { rank: r, next: hi ?? null, progress: hi === undefined ? 1 : (xp - lo) / (hi - lo) };
}

export function rankTitle(faction, rank) {
  const t = RANK_TITLES[faction] || RANK_TITLES.US;
  return t[Math.min(rank, t.length - 1)];
}

// The player's level (shown in the top bar) rises with the experience of all his
// soldiers together: level n needs 1,000 x n(n+1)/2 XP in all (ours; the
// original's player levels came from its own progression system).
export function playerLevel(roster) {
  const xp = roster.soldiers.reduce((s, x) => s + (x.xp || 0), 0);
  let n = 0;
  while (1000 * ((n + 1) * (n + 2)) / 2 <= xp) n++;
  const lo = (1000 * n * (n + 1)) / 2,
    hi = (1000 * (n + 1) * (n + 2)) / 2;
  return { level: n + 1, xp, progress: (xp - lo) / (hi - lo) };
}

let nextId = 1;
function makeSoldier(faction, cls, name, rng = Math.random) {
  return {
    id: `s${Date.now().toString(36)}${(nextId++).toString(36)}`,
    faction,
    cls,
    name: name || randomName(faction, rng),
    xp: 0,
    seed: 1 + Math.floor(rng() * 99999),
    variant: Math.floor(rng() * variantCount(faction, cls)),
    loadout: [...DEFAULT_LOADOUT[faction][cls]],
    tank: null,
    ribbons: {},
    stats: { battles: 0, wins: 0, kills: 0, deaths: 0, captures: 0 },
  };
}

// Make a saved soldier whole again: known army and class, weapons he may carry.
function check(s) {
  if (!DEFAULT_LOADOUT[s.faction]?.[s.cls]) return null;
  const def = DEFAULT_LOADOUT[s.faction][s.cls];
  // Saved before ribbons: his past kills count toward his class's main ribbon
  // (about what a rifle kill earns).
  if (!s.ribbons || typeof s.ribbons !== 'object') {
    const kills = Math.max(0, Number(s.stats?.kills) || 0);
    s.ribbons = kills ? { [s.cls === 'tanker' ? 'armorAssault' : 'infantryAssault']: kills * 85 } : {};
  }
  for (const k of Object.keys(s.ribbons)) if (!RIBBONS[k] || !(s.ribbons[k] >= 0)) delete s.ribbons[k];
  const slots = ['primary', 'sidearm', 'equipment'];
  s.loadout = slots.map((slot, i) => {
    const id = s.loadout?.[i];
    return weaponsFor(s.faction, s.cls, slot).some((w) => w.id === id) && unlocked(s, id) ? id : def[i];
  });
  if (s.tank && !tankUnlocked(s, s.tank)) s.tank = null;
  s.xp = Math.max(0, Number(s.xp) || 0);
  s.variant = Math.max(0, Math.floor(Number(s.variant) || 0)) % variantCount(s.faction, s.cls);
  s.seed = Number(s.seed) || 1;
  s.stats = { battles: 0, wins: 0, kills: 0, deaths: 0, captures: 0, ...(s.stats || {}) };
  s.name = String(s.name || randomName(s.faction)).slice(0, 40);
  return s;
}

// Soldiers on each side of a battle unless the Generals screen says otherwise.
export const BATTLE_SIZE = 24;

// The starting roster: an infantry soldier of each army.
export function newRoster(rng = Math.random) {
  const soldiers = ['US', 'GE', 'SU'].map((f) => makeSoldier(f, 'infantry', null, rng));
  return { soldiers, selectedId: soldiers[0].id, mission: { map: 'town', side: 'attack', enemy: null, bots: BATTLE_SIZE, minutes: 20, size: 2 } };
}

export function loadRoster() {
  let r = null;
  try {
    r = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    r = null;
  }
  if (!r || !Array.isArray(r.soldiers)) return newRoster();
  r.soldiers = r.soldiers.map(check).filter(Boolean);
  if (!r.soldiers.length) return newRoster();
  if (!r.soldiers.some((s) => s.id === r.selectedId)) r.selectedId = r.soldiers[0].id;
  r.mission = { map: 'town', side: 'attack', enemy: null, bots: BATTLE_SIZE, minutes: 20, ...(r.mission || {}) };
  // Saved before battles grew: the old default of 10 a side becomes the new one.
  if (!r.mission.size) {
    if (r.mission.bots <= 10) r.mission.bots = BATTLE_SIZE;
    r.mission.size = 2;
  }
  return r;
}

export function saveRoster(r) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage unavailable: the roster lasts for this visit */
  }
}

export function selected(r) {
  return r.soldiers.find((s) => s.id === r.selectedId) || r.soldiers[0];
}

export function select(r, id) {
  if (r.soldiers.some((s) => s.id === id)) r.selectedId = id;
}

export const MAX_SOLDIERS = 12;

export function recruit(r, { faction, cls, name }) {
  if (r.soldiers.length >= MAX_SOLDIERS) return null;
  const s = makeSoldier(faction, cls, name);
  r.soldiers.push(s);
  r.selectedId = s.id;
  return s;
}

// Send a soldier home (the last one stays).
export function dismiss(r, id) {
  if (r.soldiers.length <= 1) return false;
  r.soldiers = r.soldiers.filter((s) => s.id !== id);
  if (r.selectedId === id) r.selectedId = r.soldiers[0].id;
  return true;
}

// After a battle: experience, ribbon points and the record. Returns { before,
// after } ranks, the ribbons that went up a level ({ key, from, to, points }),
// and what that opened (weapons and tanks, by name).
export function awardBattle(r, id, { xp = 0, won = false, kills = 0, deaths = 0, captures = 0, ribbons = {} } = {}) {
  const s = r.soldiers.find((x) => x.id === id);
  if (!s) return null;
  const before = rankOf(s.xp).rank;
  s.ribbons ||= {};
  const had = openedFor(s);
  const ribbonUps = [];
  const gained = {};
  for (const [k, pts] of Object.entries(ribbons)) {
    if (!RIBBONS[k] || !(pts > 0)) continue;
    const from = ribbonLevel(s.ribbons[k]).level;
    s.ribbons[k] = Math.round((s.ribbons[k] || 0) + pts);
    gained[k] = Math.round(pts);
    const to = ribbonLevel(s.ribbons[k]).level;
    if (to > from) ribbonUps.push({ key: k, from, to });
  }
  const unlocks = openedFor(s).filter((n) => !had.includes(n));
  s.xp += Math.max(0, Math.round(xp));
  s.stats.battles++;
  if (won) s.stats.wins++;
  s.stats.kills += kills;
  s.stats.deaths += deaths;
  s.stats.captures += captures;
  return { before, after: rankOf(s.xp).rank, ribbonUps, gained, unlocks };
}

// The names of the weapons and tanks a soldier may take into battle.
const TANK_NAMES = { US: { m5a1_stuart: 'M5A1 Stuart', m4a1_sherman: 'M4A1 Sherman' }, GE: { panzer4_h: 'Panzer IV Ausf. H', tiger1: 'Tiger I' }, SU: { t34_76: 'T-34/76', t34_85: 'T-34-85' } };
function openedFor(s) {
  const out = [];
  for (const slot of ['primary', 'sidearm', 'equipment']) for (const w of weaponsFor(s.faction, s.cls, slot)) if (unlocked(s, w.id)) out.push(WEAPONS[w.id].name);
  if (s.cls === 'tanker') for (const [id, name] of Object.entries(TANK_NAMES[s.faction] || {})) if (tankUnlocked(s, id)) out.push(name);
  return out;
}
