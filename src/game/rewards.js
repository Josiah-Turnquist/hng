// What an Assault earns a soldier: experience for taking part, for every enemy
// put out of the fight, for every point taken, and more for a win; and the
// ribbon points of what he did (his ribbon tally, game/ribbons.js). Worked out
// the same way by the browser (a battle on this computer) and by the game
// server (an online battle, where the server keeps the soldiers).
//
//   battleReward(s, { won, defending, seconds, cls })
//     -> { xp, won, kills, deaths, captures, ribbons }, or null (left at once)
//   then roster.js awardBattle(roster, id, reward) adds it to his record.
import { ribbonPoints } from './ribbons.js';

// Nothing for leaving straight away without putting anyone down.
export const MIN_SECONDS = 60;

export function battleXp({ kills = 0, captures = 0, won = false }) {
  return 100 + kills * 100 + captures * 150 + (won ? 400 : 0);
}

// s: his soldier in the battle (kills, deaths, captures, tally); seconds: how
// long he was in it; cls: his class (which ribbons he can earn).
export function battleReward(s, { won = false, defending = false, seconds = 0, cls = s.cls } = {}) {
  const kills = s.kills || 0;
  if (seconds < MIN_SECONDS && !kills) return null;
  const captures = s.captures || 0;
  const deaths = s.deaths || 0;
  s.tally?.end({ won, defending, seconds, deaths });
  const ribbons = s.tally ? ribbonPoints(s.tally, cls) : {};
  return { xp: battleXp({ kills, captures, won }), won, kills, deaths, captures, ribbons };
}
