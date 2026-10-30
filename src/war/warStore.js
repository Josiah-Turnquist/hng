// The war kept in the browser, and the player's command points.
//
// Command points, as in the original: a general gets them as his soldiers rise
// (one at rank 12, one at 15, then one a rank from 18 to 22), for ten in all.
// Ours: three to start with, so a new player can field a few teams, and the
// best rank among his soldiers of the army he leads counts.
import { save, load } from './war.js';
import { rankOf } from '../ui/roster.js';
import { saved } from '../core/saved.js';

const KEY = 'hng.war.v1';

export function loadWar() {
  try {
    return load(localStorage.getItem(KEY) || '');
  } catch {
    return null;
  }
}

export function saveWar(war) {
  try {
    localStorage.setItem(KEY, save(war));
  } catch {
    /* no storage: the war lasts as long as the page */
  }
  saved('war');
}

// Who may lead the war. In the original a soldier of rank 18 could be made a
// General, or a General hired outright for about 1.97 million credits (wiki:
// Characters). Here a promoted General keeps fighting. For the beta the
// Generals side is open to everyone (GENERALS_OPEN); once there is
// multiplayer, beta generals are chosen by hand, then earned these ways.
export const GENERALS_OPEN = true;
export const GENERAL_RANK = 18;
export const HIRE_PRICE = 1970000;

export const canPromote = (s) => !s.general && rankOf(s.xp).rank >= GENERAL_RANK;

export function promote(roster, id) {
  const s = roster.soldiers.find((x) => x.id === id);
  if (!s || !canPromote(s)) return false;
  s.general = true;
  return true;
}

export function hireGeneral(roster) {
  if (roster.generalHired || (roster.credits || 0) < HIRE_PRICE) return false;
  roster.credits -= HIRE_PRICE;
  roster.generalHired = true;
  return true;
}

export function mayLead(roster) {
  return GENERALS_OPEN || !!roster.generalHired || roster.soldiers.some((s) => s.general);
}

export function commandPoints(rank) {
  return Math.min(10, 3 + (rank >= 12) + (rank >= 15) + Math.max(0, Math.min(5, rank - 17)));
}

export function generalRank(roster, army) {
  return roster.soldiers.filter((s) => s.faction === army).reduce((r, s) => Math.max(r, rankOf(s.xp).rank), 0);
}
