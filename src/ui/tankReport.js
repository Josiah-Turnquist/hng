// What a tank's crew is shown about their own tank: the state of each part on
// the tank's picture (ui/hud.js _updateTank).
export const TANK_PARTS = ['trackL', 'trackR', 'engine', 'transmission', 'turret', 'gun'];

// 0 sound, 1 damaged, 2 out of action.
export function partLevel(modules, part) {
  const m = modules[part];
  return m <= 0 ? 2 : m < 1 ? 1 : 0;
}

// The parts' levels now, and which got worse since `before` (the levels as last
// shown; none given: climbing in, nothing is new). A part that got worse blinks.
export function tankNews(modules, before = null) {
  const levels = {};
  const worse = [];
  for (const part of TANK_PARTS) {
    const l = (levels[part] = partLevel(modules, part));
    if (before && l > (before[part] || 0)) worse.push({ part, level: l });
  }
  return { levels, worse };
}
