// Buttons that ask "click again to confirm" (buy, upgrade, sign out): the
// second click only counts as a yes when it is a click of its own, not the
// second half of a quick double-click.
export const CONFIRM_GAP = 400; // milliseconds after the first click

// True when a confirming click came too soon after the first to be meant.
// e: the click; askedAt: when the button started asking (performance.now()).
export function tooSoon(e, askedAt, now = performance.now()) {
  return (e?.detail ?? 1) > 1 || now - askedAt < CONFIRM_GAP;
}
