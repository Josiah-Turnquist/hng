// Progress kept on the game server (Phase 2): /api/progress saves a signed-in
// player's soldiers and war, refuses strangers and stale saves, and the
// browser's copy follows it (src/net/progress.js). With TEST_DATABASE_URL set
// (a Postgres to scribble in), the real database store is checked too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { checkProgress } from '../src/server/progress.js';
import { openProgressStore } from '../src/server/progressStore.js';
import { keepEarned, awardStored } from '../src/server/progress.js';
import { saved } from '../src/core/saved.js';

// The database's behaviour, in memory.
function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async get(id) {
      return rows.get(id) ?? null;
    },
    async put(id, name, { roster, war }, rev) {
      const r = rows.get(id);
      if (r && r.rev !== rev) return { conflict: r };
      const next = { roster: roster ?? r?.roster ?? null, war: war ?? r?.war ?? null, rev: (r?.rev ?? 0) + 1 };
      rows.set(id, next);
      return { rev: next.rev };
    },
    async close() {},
  };
}

const serve = (store) => startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), store, log: () => {} });
const roster = (xp, name = 'Hale') => ({ soldiers: [{ id: 's1', name, faction: 'US', cls: 'infantry', xp }], selectedId: 's1', credits: xp });

test('a save must look like progress', () => {
  assert.equal(checkProgress({ rev: 0, roster: roster(5) }), null);
  assert.equal(checkProgress({ rev: 0, war: { v: 1 } }), null);
  assert.ok(checkProgress({ roster: roster(5) }), 'needs the revision it was based on');
  assert.ok(checkProgress({ rev: 0 }), 'needs something to save');
  assert.ok(checkProgress({ rev: 0, roster: { soldiers: 'no' } }));
  assert.ok(checkProgress({ rev: 0, war: [1, 2] }));
  assert.ok(checkProgress({ rev: 0, roster: { soldiers: new Array(500).fill({}) } }));
});

test('the server keeps each player\'s progress, for him alone, and refuses a stale save', async () => {
  const store = memoryStore();
  const srv = await serve(store);
  const url = `http://localhost:${srv.port}/api/progress`;
  const as = (name, method = 'GET', body) => fetch(url, { method, headers: { 'X-Dev-Name': name, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  try {
    assert.equal((await fetch(url)).status, 401, 'signed-in players only');
    assert.deepEqual((await as('Able')).body, { roster: null, war: null, rev: 0 }, 'a new player has nothing yet');
    const first = await as('Able', 'PUT', { rev: 0, roster: roster(10), war: { v: 1, t: 5 } });
    assert.equal(first.status, 200);
    assert.equal(first.body.rev, 1);
    // Only the roster changes: the war stays.
    assert.equal((await as('Able', 'PUT', { rev: 1, roster: roster(10, 'Joe') })).body.rev, 2);
    const back = (await as('Able')).body;
    assert.equal(back.roster.soldiers[0].name, 'Joe');
    assert.deepEqual(back.war, { v: 1, t: 5 });
    assert.equal(back.rev, 2);
    // Another player sees none of it.
    assert.equal((await as('Baker')).body.roster, null);
    // A save from a computer that missed the last one: refused, with what is there now.
    const stale = await as('Able', 'PUT', { rev: 1, roster: roster(99) });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.rev, 2);
    assert.equal(stale.body.roster.soldiers[0].name, 'Joe');
    // Experience and credits are earned on the server only: a save that raises
    // them is put right, and the browser is sent the roster as kept.
    const cheat = await as('Able', 'PUT', { rev: 2, roster: roster(99, 'Joe') });
    assert.equal(cheat.status, 200);
    assert.equal(cheat.body.roster.soldiers[0].xp, 10);
    assert.equal(cheat.body.roster.credits, 10);
    assert.equal(store.rows.get('dev:Able').roster.soldiers[0].xp, 10);
    assert.equal((await as('Able', 'PUT', { rev: 3 })).status, 400, 'nothing to save');
    const config = await (await fetch(`http://localhost:${srv.port}/api/config`)).json();
    assert.equal(config.progress, true);
  } finally {
    await srv.close();
  }
});

test('without a database the server says so, and the page keeps progress itself', async () => {
  const srv = await serve(null);
  try {
    const r = await fetch(`http://localhost:${srv.port}/api/progress`, { headers: { 'X-Dev-Name': 'Able' } });
    assert.equal(r.status, 503);
    assert.equal((await (await fetch(`http://localhost:${srv.port}/api/config`)).json()).progress, false);
  } finally {
    await srv.close();
  }
});

// A browser, enough for src/net/progress.js: storage, page events, fetch to the test server.
function fakeBrowser(port) {
  const data = new Map();
  const on = new Map();
  globalThis.localStorage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
  globalThis.window = { addEventListener: (e, f) => on.set(e, f), removeEventListener: () => {}, __app: null };
  globalThis.document = { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} };
  globalThis.location = { reloaded: 0, reload() { this.reloaded++; } };
  const real = globalThis.__realFetch ?? (globalThis.__realFetch = globalThis.fetch);
  globalThis.fetch = (u, o) => real(String(u).startsWith('/') ? `http://localhost:${port}${u}` : u, o);
  return { data, close: () => on.get('pagehide')?.() };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const account = (name) => ({ user: { id: `dev:${name}`, name, email: '' }, dev: name });

test('the browser loads the server\'s copy, sends each save, and hands this browser\'s old progress to its first account only', async () => {
  const store = memoryStore();
  const srv = await serve(store);
  const { syncProgress } = await import('../src/net/progress.js');
  try {
    // Played in this browser before signing in: the first account takes it.
    const b = fakeBrowser(srv.port);
    b.data.set('hng.roster.v1', JSON.stringify(roster(7)));
    assert.equal(await syncProgress(account('Able')), true);
    assert.equal(store.rows.get('dev:Able').roster.soldiers[0].xp, 7, 'uploaded on first sign-in');
    // A save goes up a moment later.
    b.data.set('hng.roster.v1', JSON.stringify(roster(7, 'Joe')));
    saved('roster');
    await wait(2600);
    assert.equal(store.rows.get('dev:Able').roster.soldiers[0].name, 'Joe');
    // And at once when the page closes.
    b.data.set('hng.war.v1', JSON.stringify({ v: 1, t: 9 }));
    b.close();
    saved('war');
    await wait(400);
    assert.deepEqual(store.rows.get('dev:Able').war, { v: 1, t: 9 });

    // Another account in this browser does not get Able's soldiers.
    const b2 = fakeBrowser(srv.port);
    b2.data.set('hng.roster.v1', JSON.stringify(roster(30)));
    b2.data.set('hng.progress.owner', 'dev:Able');
    assert.equal(await syncProgress(account('Baker')), true);
    assert.equal(b2.data.has('hng.roster.v1'), false, 'a fresh start for Baker');
    assert.equal(store.rows.has('dev:Baker'), false);

    // Able on a new computer: his soldiers come down from the server.
    const b3 = fakeBrowser(srv.port);
    assert.equal(await syncProgress(account('Able')), true);
    assert.equal(JSON.parse(b3.data.get('hng.roster.v1')).soldiers[0].name, 'Joe');
    assert.deepEqual(JSON.parse(b3.data.get('hng.war.v1')), { v: 1, t: 9 });

    // Meanwhile saved from elsewhere: this computer's save is refused, the newer copy taken and shown.
    await store.put('dev:Able', 'Able', { roster: roster(55) }, store.rows.get('dev:Able').rev);
    b3.data.set('hng.roster.v1', JSON.stringify(roster(31)));
    saved('roster');
    await wait(3000);
    assert.equal(JSON.parse(b3.data.get('hng.roster.v1')).soldiers[0].xp, 55);
    assert.equal(store.rows.get('dev:Able').roster.soldiers[0].xp, 55);
    assert.equal(location.reloaded, 1);
  } finally {
    await srv.close();
  }
});

// A soldier as the browser keeps him (roster.js), for the earnings checks.
const full = (o = {}) => ({ id: 's1', name: 'Hale', faction: 'US', cls: 'infantry', xp: 5000, ribbons: { infantryAssault: 600 }, stats: { battles: 3, wins: 1, kills: 9, deaths: 4, captures: 1 }, general: false, armory: {}, badges: [null, null], loadout: ['m1_garand', null, null, null, null, null, null], ...o });

test('a save can change choices and spend credits, never raise what is earned', () => {
  const kept = { soldiers: [full()], selectedId: 's1', credits: 60000 };
  // Nothing changed: nothing to put right.
  assert.equal(keepEarned(kept, structuredClone(kept)).fixed, false);
  // His own choices: kept as sent.
  const named = keepEarned(kept, { ...structuredClone(kept), soldiers: [full({ name: 'Joe' })] });
  assert.equal(named.fixed, false);
  assert.equal(named.roster.soldiers[0].name, 'Joe');
  // Experience, ribbon points, records and credits raised: back as kept.
  const cheat = keepEarned(kept, { soldiers: [full({ xp: 9e6, ribbons: { infantryAssault: 1e6 }, stats: { battles: 99, wins: 99, kills: 999, deaths: 0, captures: 9 }, general: true })], selectedId: 's1', credits: 1e9 });
  assert.equal(cheat.fixed, true);
  const s = cheat.roster.soldiers[0];
  assert.deepEqual([s.xp, s.ribbons.infantryAssault, s.stats.kills, s.general, cheat.roster.credits], [5000, 600, 9, false, 60000]);
  // A new recruit starts from nothing.
  const recruit = keepEarned(kept, { ...structuredClone(kept), soldiers: [full(), full({ id: 's2', xp: 1e6, ribbons: { smgAssault: 9e5 } })] });
  assert.deepEqual([recruit.roster.soldiers[1].xp, recruit.roster.soldiers[1].ribbons], [0, {}]);
  // Buying the M3 (opened at Infantry Assault 1; he has 600 points) costs its 50,000 credits.
  const bought = keepEarned(kept, { ...structuredClone(kept), soldiers: [full({ armory: { m3_greasegun: { bought: [], picks: {} } } })], credits: 10000 });
  assert.equal(bought.fixed, false);
  assert.ok(bought.roster.soldiers[0].armory.m3_greasegun);
  // ...and not for free.
  const free = keepEarned(kept, { ...structuredClone(kept), soldiers: [full({ armory: { m3_greasegun: { bought: [], picks: {} } } })], credits: 60000 });
  assert.equal(free.roster.credits, 10000);
  // More than he has: undone.
  const poor = keepEarned({ ...kept, credits: 100 }, { ...structuredClone(kept), soldiers: [full({ armory: { m3_greasegun: { bought: [], picks: {} } } })], credits: 0 });
  assert.equal(poor.fixed, true);
  assert.deepEqual([poor.roster.soldiers[0].armory, poor.roster.credits], [{}, 100]);
  // A gun not opened to him: dropped.
  const locked = keepEarned(kept, { ...structuredClone(kept), soldiers: [full({ armory: { bazooka_m1a1: { bought: [], picks: {} } } })] });
  assert.equal(locked.fixed, true);
  assert.equal(locked.roster.soldiers[0].armory.bazooka_m1a1, undefined);
});

test("an online battle's rewards are added to the soldier kept on the server", async () => {
  const store = memoryStore();
  await store.put('dev:Able', 'Able', { roster: { soldiers: [full()], selectedId: 's1', credits: 100 } }, 0);
  const out = await awardStored(store, 'dev:Able', 'Able', 's1', { xp: 600, won: true, kills: 3, deaths: 1, captures: 1, ribbons: { infantryAssault: 400 } });
  assert.equal(out.rev, 2);
  assert.equal(out.result.xp, 600);
  assert.ok(out.result.credits > 0);
  const kept = store.rows.get('dev:Able').roster;
  assert.equal(kept.soldiers[0].xp, 5600);
  assert.equal(kept.soldiers[0].ribbons.infantryAssault, 1000);
  assert.equal(kept.soldiers[0].stats.kills, 12);
  assert.equal(kept.credits, 100 + out.result.credits);
  assert.equal(await awardStored(store, 'dev:Able', 'Able', 'nobody', { xp: 100 }), null, 'no such soldier');
});

test('the database store saves, keeps the part left out, and refuses a stale save', { skip: !process.env.TEST_DATABASE_URL && 'set TEST_DATABASE_URL to a Postgres to test against' }, async () => {
  const store = openProgressStore(process.env.TEST_DATABASE_URL, { log: () => {} });
  const id = `test:${Date.now()}:${Math.random()}`;
  try {
    assert.equal(await store.get(id), null);
    assert.deepEqual(await store.put(id, 'Able', { roster: roster(1), war: { v: 1 } }, 0), { rev: 1 });
    assert.deepEqual(await store.put(id, 'Able', { roster: roster(2) }, 1), { rev: 2 });
    const row = await store.get(id);
    assert.equal(row.roster.soldiers[0].xp, 2);
    assert.deepEqual(row.war, { v: 1 });
    const stale = await store.put(id, 'Able', { roster: roster(3) }, 1);
    assert.equal(stale.conflict.rev, 2);
    assert.equal((await store.get(id)).roster.soldiers[0].xp, 2);
  } finally {
    await store.close();
  }
});
