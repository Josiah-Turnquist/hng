// Saved progress (the soldiers, the war) says so here, for whoever keeps a
// copy elsewhere: net/progress.js sends it to the game server.
//
//   saved('roster') / saved('war')       // after each save to the browser
//   const stop = onSaved((what) => ...)
const listeners = new Set();

export function onSaved(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function saved(what) {
  for (const fn of listeners) {
    try {
      fn(what);
    } catch (e) {
      console.warn('saved:', e);
    }
  }
}
