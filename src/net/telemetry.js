// What a signed-in player's browser tells the game server, for the admin
// page's stats (src/server/telemetry.js): how smoothly battles run, how long
// a battle takes to load, and errors on this screen. Nothing else: no
// addresses, names typed or chat. Sent a minute at a time, and as the page
// closes. Off unless signed in on the game server (the offline copy sends
// nothing).
//
//   startTelemetry(account)                    // after signing in
//   report('load', { ms })                     // kept for the next send
//   reportError(err)                           // an error on this screen (once each)
//   watchBattle(game, { quality, online })     // frame rate every minute of a battle
import { token } from './auth.js';
import { PROTOCOL_VERSION } from './protocol.js';

const EVERY = 60000; // ms between sends
let account = null;
let queue = [];
let timer = null;
const seen = new Set(); // errors already sent

export function startTelemetry(acc) {
  account = acc;
  if (timer) return;
  timer = setInterval(() => send(false), EVERY);
  window.addEventListener('pagehide', () => send(true));
  window.addEventListener('error', (e) => reportError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}

export function report(kind, data) {
  if (!account || queue.length > 50) return;
  queue.push({ kind, data });
}

// An error: its message and where in the game's code it happened (no more).
export function reportError(err) {
  const message = String(err?.message || err || 'unknown').slice(0, 300);
  if (seen.has(message) || seen.size > 20) return;
  seen.add(message);
  const where = String(err?.stack || '')
    .split('\n')
    .map((l) => l.match(/\/src\/[^\s)]+/)?.[0])
    .find(Boolean);
  report('error', { message, where: where || '', version: PROTOCOL_VERSION });
}

// The frame rate in a battle: each minute, its average and its worst tenth.
export function watchBattle(game, { quality = '', online = false } = {}) {
  const samples = [];
  const tick = setInterval(() => {
    if (!game.loop) return;
    if (document.visibilityState === 'visible' && game.loop.fps > 0) samples.push(game.loop.fps);
    if (samples.length >= 60) {
      const sorted = [...samples].sort((a, b) => a - b);
      const fps = samples.reduce((a, b) => a + b, 0) / samples.length;
      report('perf', { fps, low: sorted[Math.floor(sorted.length * 0.1)], quality, online, w: innerWidth, h: innerHeight, ratio: devicePixelRatio || 1 });
      samples.length = 0;
    }
  }, 1000);
  return () => clearInterval(tick);
}

async function send(leaving) {
  if (!account || !queue.length) return;
  const events = queue.splice(0, 20);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (account.dev) headers['X-Dev-Name'] = account.dev;
    else {
      const t = leaving ? account._lastToken : await token();
      if (!t) return;
      account._lastToken = t;
      headers.Authorization = `Bearer ${t}`;
    }
    await fetch('/api/telemetry', { method: 'POST', headers, body: JSON.stringify({ events }), keepalive: leaving });
  } catch {
    /* lost: it was only telemetry */
  }
}
