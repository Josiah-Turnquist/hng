// The war kept in the browser, and the player's command points.
//
// Command points, as in the original: a general gets them as his soldiers rise
// (one at rank 12, one at 15, then one a rank from 18 to 22), for ten in all.
// Ours: three to start with, so a new player can field a few teams, and the
// best rank among his soldiers of the army he leads counts.
import { save, load } from './war.js';
import { rankOf } from '../ui/roster.js';

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
}

export function commandPoints(rank) {
  return Math.min(10, 3 + (rank >= 12) + (rank >= 15) + Math.max(0, Math.min(5, rank - 17)));
}

export function generalRank(roster, army) {
  return roster.soldiers.filter((s) => s.faction === army).reduce((r, s) => Math.max(r, rankOf(s.xp).rank), 0);
}
