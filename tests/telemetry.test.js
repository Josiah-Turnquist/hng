// Telemetry (src/server/telemetry.js): what the server keeps for the admin
// page's stats, and what a signed-in browser may add; with TEST_DATABASE_URL,
// the database's events and stats too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { Telemetry } from '../src/server/telemetry.js';
import { openProgressStore } from '../src/server/progressStore.js';
import WebSocket from 'ws';

test('the server keeps tidy events in batches; a browser may add only its own few kinds', async () => {
  const kept = [];
  const store = { logEvents: async (rows) => kept.push(...rows), get: async () => null, put: async () => ({ rev: 1 }), close: async () => {} };
  const t = new Telemetry({ store, log: () => {} });
  t.record('dev:Able', 'battle', { army: 'US', kills: 3, nested: { no: 1 }, long: 'x'.repeat(900) });
  await t.flush();
  assert.equal(kept.length, 1);
  assert.deepEqual(Object.keys(kept[0].data).sort(), ['army', 'kills', 'long']);
  assert.equal(kept[0].data.long.length, 300);
  t.stop();

  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), store, log: () => {} });
  try {
    const post = (body, name = 'Able') => fetch(`http://localhost:${srv.port}/api/telemetry`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(name ? { 'X-Dev-Name': name } : {}) }, body: JSON.stringify(body) });
    assert.equal((await post({ events: [{ kind: 'perf', data: { fps: 60 } }] }, null)).status, 401, 'signed-in players only');
    assert.equal((await post({ events: [{ kind: 'perf', data: { fps: 58, quality: 'high' } }, { kind: 'battle', data: { kills: 99 } }, { kind: 'error', data: { message: 'boom' } }] })).status, 204);
    await srv.finish();
    const mine = kept.filter((e) => e.user_id === 'dev:Able' && e.kind !== 'battle');
    assert.deepEqual(mine.map((e) => e.kind).sort(), ['error', 'perf'], "a browser can't claim battles");
  } finally {
    await srv.close();
  }
});

test('recent players for the admin page: who is in the game now, then who left last, with how long and where from', async () => {
  const kept = [];
  const long = new Date(Date.now() - 3 * 3600000).toISOString();
  const store = {
    logEvents: async (rows) => kept.push(...rows),
    get: async (id) => (id === 'dev:Able' ? { name: 'Able', roster: { credits: 700, soldiers: [] }, rev: 1 } : null),
    put: async () => ({ rev: 1 }),
    close: async () => {},
    // (As the database gives them: the latest first.)
    recent: async () => [
      { user_id: 'dev:Baker', name: 'Baker', at: long, minutes: 31, tz: 'Europe/Berlin', total: 95, sessions: 3 },
      { user_id: 'dev:Able', name: 'Able', at: new Date(Date.now() - 86400000).toISOString(), minutes: 12, tz: null, total: 12, sessions: 1 },
    ],
  };
  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), store, admins: ['dev:Boss'], log: () => {} });
  try {
    const admin = async (path, name = 'Boss') => {
      const r = await fetch(`http://localhost:${srv.port}/api/admin/${path}`, { headers: { 'X-Dev-Name': name } });
      return { status: r.status, body: await r.json() };
    };
    assert.equal((await admin('recent', 'Able')).status, 403, 'admins only');
    // Nobody in the game: the two who left, the latest first.
    let list = (await admin('recent')).body.players;
    assert.deepEqual(list.map((p) => [p.name, p.now, p.minutes, p.tz]), [['Baker', false, 31, 'Europe/Berlin'], ['Able', false, 12, null]]);
    // Able opens the game: his browser says its time zone (and tries to say more).
    const ws = new WebSocket(`ws://localhost:${srv.port}/lobby`);
    await new Promise((ok) => ws.on('open', ok));
    ws.send(JSON.stringify({ k: 'h', v: 1, dev: 'Able', tz: 'America/Chicago' }));
    await new Promise((ok) => setTimeout(ok, 150));
    list = (await admin('recent')).body.players;
    assert.deepEqual(list.map((p) => p.name), ['Able', 'Baker'], 'in the game now comes first');
    assert.equal(list[0].now, true);
    assert.equal(list[0].tz, 'America/Chicago');
    assert.equal(list[0].sessions, 2, 'this visit and the one before');
    assert.ok(list[0].minutes < 1);
    // One player by id (what a row opens); nobody saved: 404.
    assert.equal((await admin('player?id=dev:Able')).body.player.credits, 700);
    assert.equal((await admin('player?id=dev:Nobody')).status, 404);
    // He leaves: the visit is kept with how long it was and the time zone, nothing else of where he is.
    ws.close();
    await new Promise((ok) => setTimeout(ok, 150));
    await srv.finish();
    const visit = kept.find((e) => e.kind === 'session' && e.user_id === 'dev:Able');
    assert.deepEqual(Object.keys(visit.data).sort(), ['minutes', 'tz']);
    assert.equal(visit.data.tz, 'America/Chicago');
    assert.equal((await admin('recent')).body.players.find((p) => p.name === 'Able').now, false);
    // A browser that sends something else for its zone: not kept.
    const odd = new WebSocket(`ws://localhost:${srv.port}/lobby`);
    await new Promise((ok) => odd.on('open', ok));
    odd.send(JSON.stringify({ k: 'h', v: 1, dev: 'Charlie', tz: '203.0.113.7' }));
    await new Promise((ok) => setTimeout(ok, 150));
    odd.close();
    await new Promise((ok) => setTimeout(ok, 150));
    await srv.finish();
    assert.deepEqual(Object.keys(kept.find((e) => e.kind === 'session' && e.user_id === 'dev:Charlie').data), ['minutes']);
  } finally {
    await srv.close();
  }
});

test('the database keeps events and sums them up for the admin page', { skip: !process.env.TEST_DATABASE_URL && 'set TEST_DATABASE_URL to a Postgres to test against' }, async () => {
  const store = openProgressStore(process.env.TEST_DATABASE_URL, { log: () => {} });
  const who = `test:${Date.now()}`;
  try {
    const at = new Date().toISOString();
    await store.logEvents([
      { at, user_id: who, kind: 'battle', data: { army: 'US', cls: 'infantry', seconds: 600, kills: 4, deaths: 2, won: true, early: false } },
      { at, user_id: who, kind: 'perf', data: { fps: 55, low: 40, quality: 'test-preset' } },
      { at, user_id: who, kind: 'error', data: { message: `test error ${who}`, where: '/src/x.js:1:2' } },
      { at, user_id: who, kind: 'session', data: { minutes: 12 } },
      { at, user_id: null, kind: 'server', data: { perSide: 30, players: 1, step: 5.2, worstStep: 40, worstLag: 380, lost: 0 } },
    ]);
    const st = await store.stats(1);
    assert.ok(Number(st.battles.battles) >= 1);
    assert.ok(st.perf.some((p) => p.quality === 'test-preset' && Number(p.fps) === 55));
    assert.ok(st.errors.some((e) => e.message === `test error ${who}`));
    assert.ok(st.daily.length >= 1);
    // How the server kept up, by day.
    assert.ok(st.server.length >= 1 && Number(st.server.at(-1).minutes) >= 1 && Number(st.server.at(-1).worst_lag) >= 380);
    // Recent players: his last visit, how long, his time zone (from the visit that told it), and his visits summed.
    await store.logEvents([
      { at: new Date(Date.now() - 7200000).toISOString(), user_id: who, kind: 'session', data: { minutes: 30, tz: 'Europe/Berlin' } },
      { at: new Date(Date.now() + 1000).toISOString(), user_id: who, kind: 'session', data: { minutes: 5.26 } },
    ]);
    const mine = (await store.recent(200)).find((r) => r.user_id === who);
    assert.equal(mine.minutes, 5.3);
    assert.equal(mine.tz, 'Europe/Berlin');
    assert.equal(mine.sessions, 3);
    assert.equal(mine.total, 47);
    assert.equal((await store.recent(200))[0].user_id, who, 'the latest first');
  } finally {
    await store.close();
  }
});
