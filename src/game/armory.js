// Credits and the armory, as in the original game: credits are earned in
// battle and shared by all the player's soldiers; each soldier buys his own
// guns and items once he has opened them with his ribbons, and his own
// upgrades for each gun (weapons/upgrades.js), then fits one upgrade per slot.
// Prices are the original's (upgradeData.js). Unlike the original, nothing
// wears out and ammunition is not bought for each battle: a round is bought
// once, like an upgrade.
//
// Credits per battle: the original paid a soldier's salary plus credits by his
// score. A player put it at about 3.7 credits for each point of experience
// (a Steam forum reply of 2019, unconfirmed); a battle here pays that on its XP.
//
//   priceOf(id)                         // credits for a gun or item
//   owns(s, id), buy(r, s, id)          // r: the roster (it holds the credits)
//   ownsUpgrade(s, gun, up), buyUpgrade(r, s, gun, up)
//   picksOf(s, gun), fit(s, gun, slot, up | null)
//   battleCredits(xp)
import { WEAPONS, DEFAULT_LOADOUT } from '../weapons/defs.js';
import { PRICES } from '../weapons/upgradeData.js';
import { upgradesOf, upgradeOpen, cleanPicks } from '../weapons/upgrades.js';
import { FITTINGS } from '../weapons/scopes.js';
import { requirement, unlocked } from './ribbons.js';

export const CREDITS_PER_XP = 3.7;

export function battleCredits(xp) {
  return Math.max(0, Math.round(xp * CREDITS_PER_XP));
}

// A scoped rifle that the original sold as its own gun costs its price there;
// one the original made by fitting a scope upgrade costs the rifle and the
// cheapest of that scope's upgrades on it.
const SCOPE_FAMILY = { m81: 'm84', m82: 'm84', zf4: 'zf4', pu: 'pu', zfg42: 'zf4' };
export function priceOf(id) {
  if (PRICES[id] !== undefined) return PRICES[id];
  const f = FITTINGS[id];
  if (f) {
    const fam = SCOPE_FAMILY[f.scope];
    const scopes = upgradesOf(f.rifle).filter((u) => u.family === fam);
    return (PRICES[f.rifle] || 0) + (scopes.length ? Math.min(...scopes.map((u) => u.credits)) : 0);
  }
  return 0;
}

// Free: his class's starting kit, what every soldier may carry from the
// start, and anything the original gave away.
export function isFree(s, id) {
  const def = WEAPONS[id];
  if (!def) return false;
  if (DEFAULT_LOADOUT[s.faction]?.[s.cls]?.includes(id)) return true;
  if (priceOf(id) === 0) return true;
  return requirement(id, s.cls, s.faction) === null && (def.faction === s.faction || def.faction === 'ALL' || def.anyArmy);
}

export function owns(s, id) {
  return !!id && (isFree(s, id) || !!s.armory?.[id]);
}

// Can he buy it now? { ok, why }.
export function canBuy(r, s, id) {
  if (owns(s, id)) return { ok: false, why: 'owned' };
  if (!unlocked(s, id)) return { ok: false, why: 'locked' };
  if ((r.credits || 0) < priceOf(id)) return { ok: false, why: 'credits' };
  return { ok: true };
}

export function buy(r, s, id) {
  if (!canBuy(r, s, id).ok) return false;
  r.credits -= priceOf(id);
  s.armory ||= {};
  s.armory[id] = { bought: [], picks: {} };
  return true;
}

// His record of a gun (made when first needed, for a free gun).
function record(s, gun) {
  s.armory ||= {};
  return (s.armory[gun] ||= { bought: [], picks: {} });
}

export function ownsUpgrade(s, gun, up) {
  return !!s.armory?.[gun]?.bought.includes(up);
}

export function canBuyUpgrade(r, s, gun, up) {
  const u = upgradesOf(gun).find((x) => x.id === up);
  if (!u) return { ok: false, why: 'none' };
  if (!owns(s, gun)) return { ok: false, why: 'gun' };
  if (ownsUpgrade(s, gun, up)) return { ok: false, why: 'owned' };
  if (!upgradeOpen(s, gun, up)) return { ok: false, why: 'locked' };
  if ((r.credits || 0) < u.credits) return { ok: false, why: 'credits' };
  return { ok: true };
}

export function buyUpgrade(r, s, gun, up) {
  if (!canBuyUpgrade(r, s, gun, up).ok) return false;
  r.credits -= upgradesOf(gun).find((x) => x.id === up).credits;
  record(s, gun).bought.push(up);
  return true;
}

// The upgrades fitted to his gun: { slot: id }, only ones he has bought.
export function picksOf(s, gun) {
  const a = s.armory?.[gun];
  if (!a) return {};
  const p = cleanPicks(gun, a.picks);
  for (const k of Object.keys(p)) if (!a.bought.includes(p[k])) delete p[k];
  return p;
}

// Fit an upgrade he owns to a slot of his gun (null: the gun's own part).
export function fit(s, gun, slot, up) {
  if (up && !ownsUpgrade(s, gun, up)) return false;
  const a = record(s, gun);
  if (up) a.picks[slot] = up;
  else delete a.picks[slot];
  return true;
}

// The upgrades fitted to every gun in a loadout: { gun: picks }, for the battle.
export function loadoutUpgrades(s, ids) {
  const out = {};
  for (const id of ids || []) {
    const p = id ? picksOf(s, id) : {};
    if (Object.keys(p).length) out[id] = p;
  }
  return out;
}

// Make a saved armory whole: a soldier saved before the shop owns what he
// carries; unknown guns and upgrades are dropped.
export function checkArmory(s) {
  if (!s.armory || typeof s.armory !== 'object') {
    s.armory = {};
    for (const id of s.loadout || []) if (id && WEAPONS[id] && !isFree(s, id)) s.armory[id] = { bought: [], picks: {} };
  }
  for (const [id, a] of Object.entries(s.armory)) {
    if (!WEAPONS[id] || !a || typeof a !== 'object') {
      delete s.armory[id];
      continue;
    }
    const ups = upgradesOf(id).map((u) => u.id);
    a.bought = Array.isArray(a.bought) ? a.bought.filter((u) => ups.includes(u)) : [];
    a.picks = cleanPicks(id, a.picks);
  }
}
