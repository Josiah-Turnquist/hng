// A signed-in player's progress kept on the game server (docs/MULTIPLAYER.md,
// Phase 2): his soldiers (src/ui/roster.js) and his war (src/war/warStore.js).
// The game still reads and writes them in the browser as before; this copies
// them to and from the server (src/server/progress.js).
//
// - Signing in: the server's copy is loaded into the browser. A new account
//   takes the progress already in this browser, if no other account has
//   claimed it; otherwise it starts fresh.
// - After each save: sent to the server a moment later (several saves in a
//   row go as one), and at once when the page is closed.
// - Saved meanwhile from another computer: that copy wins, and the page
//   reloads to show it. The same when the server corrected a save (earnings
//   only grow on the server: src/server/progress.js).
// - An online battle's rewards come from the server with the roster as kept
//   there (takeServerCopy).
//
//   await syncProgress(account)       // before the menus open; false if it could not
//   await saveNow({ all })            // what is waiting goes now (all: everything kept
//                                     // here, changed or not); true once the server has it
//   takeServerCopy({ roster, rev })   // the server's newer copy
import { token } from './auth.js';
import { onSaved } from '../core/saved.js';

const KEYS = { roster: 'hng.roster.v1', war: 'hng.war.v1' };
const OWNER = 'hng.progress.owner'; // whose progress this browser holds
const DELAY = 2000; // ms after a save before it goes
const RETRY = 15000; // ms before trying again after a failure

const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* no storage */
    }
  },
};

let sync = null;

export async function syncProgress(account) {
  sync?.stop();
  const s = { account, rev: 0, dirty: new Set(), timer: null, busy: false, jwt: null, leaving: false, stop: null };
  const first = await call(s, 'GET').catch(() => null);
  if (!first?.ok) return false;
  const data = first.body;
  const me = account.user.id;
  if (data.roster || data.war) {
    // The server's copy is the one.
    adopt(data);
  } else if (store.get(OWNER) && store.get(OWNER) !== me) {
    // Another account's progress in this browser: not his. A fresh start.
    store.set(KEYS.roster, null);
    store.set(KEYS.war, null);
  } else {
    // His first time saving: what he has played in this browser goes up.
    for (const what of Object.keys(KEYS)) if (store.get(KEYS[what])) s.dirty.add(what);
  }
  s.rev = data.rev;
  store.set(OWNER, me);
  sync = s;
  const off = onSaved((what) => {
    if (!KEYS[what]) return;
    s.dirty.add(what);
    if (s.leaving) flush(s, true);
    else schedule(s, DELAY);
  });
  const leave = () => {
    s.leaving = true;
    flush(s, true);
  };
  const hidden = () => document.visibilityState === 'hidden' && flush(s, true);
  window.addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', hidden);
  s.stop = () => {
    off();
    clearTimeout(s.timer);
    window.removeEventListener('pagehide', leave);
    document.removeEventListener('visibilitychange', hidden);
  };
  if (s.dirty.size) await flush(s);
  return true;
}

export async function saveNow({ all = false } = {}) {
  const s = sync;
  if (!s) return false;
  for (let i = 0; i < 20 && s.busy; i++) await new Promise((r) => setTimeout(r, 100));
  if (all) for (const what of Object.keys(KEYS)) if (store.get(KEYS[what])) s.dirty.add(what);
  await flush(s);
  return !s.dirty.size;
}

export function takeServerCopy({ roster, rev }) {
  if (!sync || !roster) return;
  sync.rev = rev;
  sync.dirty.delete('roster');
  adopt({ roster });
}

function adopt({ roster, war }) {
  if (roster) store.set(KEYS.roster, JSON.stringify(roster));
  if (war) store.set(KEYS.war, JSON.stringify(war));
}

function schedule(s, ms) {
  clearTimeout(s.timer);
  s.timer = setTimeout(() => flush(s), ms);
}

// Send what changed. keepalive: the page is closing (the request outlives it,
// with the last token: there is no time to fetch a new one).
async function flush(s, keepalive = false) {
  if (!s.dirty.size || (s.busy && !keepalive)) return;
  clearTimeout(s.timer);
  const sending = [...s.dirty];
  const body = { rev: s.rev };
  for (const what of sending) {
    try {
      body[what] = JSON.parse(store.get(KEYS[what]) || 'null');
    } catch {
      body[what] = null;
    }
  }
  s.dirty.clear();
  s.busy = true;
  let failed = false;
  try {
    const r = await call(s, 'PUT', body, keepalive);
    if (r.ok) {
      s.rev = r.body.rev;
      // Corrected on the server: its copy, shown.
      if (r.body.roster) {
        adopt({ roster: r.body.roster });
        reloadSoon();
      }
    } else if (r.status === 409) {
      // Saved from another computer meanwhile: that copy wins.
      s.rev = r.body.rev;
      adopt(r.body);
      reloadSoon();
    } else throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    failed = true;
    console.warn('Progress not saved on the server yet:', e.message);
    for (const what of sending) s.dirty.add(what);
    if (!keepalive) schedule(s, RETRY);
  } finally {
    s.busy = false;
  }
  // (Saved again while this went: that goes next.)
  if (s.dirty.size && !failed && !keepalive) schedule(s, DELAY);
}

async function call(s, method, body = null, keepalive = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (s.account.dev) headers['X-Dev-Name'] = s.account.dev;
  else {
    if (!keepalive || !s.jwt) s.jwt = await token();
    if (!s.jwt) throw new Error('not signed in');
    headers.Authorization = `Bearer ${s.jwt}`;
  }
  const r = await fetch('/api/progress', { method, headers, body: body ? JSON.stringify(body) : undefined, keepalive, credentials: 'same-origin', cache: 'no-store' });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

// Newer progress from another computer: shown by reloading, once out of battle
// (a battle in progress saves when it ends, and then reloads anyway).
function reloadSoon() {
  const app = window.__app;
  if (app?.game) return;
  setTimeout(() => location.reload(), 300);
}
