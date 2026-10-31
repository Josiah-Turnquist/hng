// Telemetry (src/server/telemetry.js): what the server keeps for the admin
// page's stats, and what a signed-in browser may add; with TEST_DATABASE_URL,
// the database's events and stats too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { Telemetry } from '../src/server/telemetry.js';
import { openProgressStore } from '../src/server/progressStore.js';

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
    ]);
    const st = await store.stats(1);
    assert.ok(Number(st.battles.battles) >= 1);
    assert.ok(st.perf.some((p) => p.quality === 'test-preset' && Number(p.fps) === 55));
    assert.ok(st.errors.some((e) => e.message === `test error ${who}`));
    assert.ok(st.daily.length >= 1);
  } finally {
    await store.close();
  }
});
