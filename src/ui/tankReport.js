// What a tank's crew is told about their own tank: the state of each part on
// the tank's picture (ui/hud.js _updateTank), and what is said, by name, in the
// middle of the screen as a part is damaged or put out of action.
export const TANK_PARTS = ['trackL', 'trackR', 'engine', 'transmission', 'turret', 'gun'];

// On the list beside the picture: [damaged, out of action].
export const TANK_STATE = {
  trackL: ['Left track damaged', 'Left track broken'],
  trackR: ['Right track damaged', 'Right track broken'],
  engine: ['Engine damaged', 'Engine destroyed'],
  transmission: ['Gearbox damaged', 'Gearbox destroyed'],
  turret: ['Turret damaged', 'Turret jammed'],
  gun: ['Gun damaged', 'Gun out of action'],
};

// Said as it happens, with what it means for the crew.
export const TANK_SAID = {
  trackL: ['Left track damaged', 'Left track broken! We can only swing left'],
  trackR: ['Right track damaged', 'Right track broken! We can only swing right'],
  engine: ['Engine damaged: we have lost power', 'Engine destroyed! We cannot move'],
  transmission: ['Gearbox damaged', 'Gearbox destroyed! We cannot move'],
  turret: ['Turret damaged', 'Turret jammed! It will not turn'],
  gun: ['Gun damaged: it loads slower', 'Gun out of action!'],
};

// 0 sound, 1 damaged, 2 out of action.
export function partLevel(modules, part) {
  const m = modules[part];
  return m <= 0 ? 2 : m < 1 ? 1 : 0;
}

// The parts' levels now, and what to say of those that got worse since `before`
// (the levels as last told; none given: climbing in, nothing is said).
export function tankNews(modules, before = null) {
  const levels = {};
  const worse = [];
  for (const part of TANK_PARTS) {
    const l = (levels[part] = partLevel(modules, part));
    if (before && l > (before[part] || 0)) worse.push({ part, level: l, said: TANK_SAID[part][l - 1] });
  }
  return { levels, worse };
}
