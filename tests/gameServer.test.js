// The game server: players sign in over a WebSocket, join the battle, are sent
// snapshots, move by their inputs, and are handed to a bot when they leave.
// Sign-in tokens are checked against the sign-in service's public keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import WebSocket from 'ws';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { startServer } from '../server/main.mjs';
import { signInChecker, cleanName } from '../src/server/auth.js';
import { checkLoadout } from '../src/server/room.js';
import { encodeInput, readSnapshot, PROTOCOL_VERSION } from '../src/net/protocol.js';
import { DEFAULT_LOADOUT } from '../src/weapons/defs.js';

function connect(port) {
  const ws = new WebSocket(`ws://localhost:${port}/play`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    inbox.push(m);
    for (const w of [...waiters]) if (w.test(m)) waiters.splice(waiters.indexOf(w), 1) && w.ok(m);
  });
  const next = (test, ms = 20000) =>
    new Promise((ok, fail) => {
      const hit = inbox.find(test);
      if (hit) return ok(hit);
      waiters.push({ test, ok });
      setTimeout(() => fail(new Error('no such message')), ms);
    });
  return new Promise((ok) => ws.on('open', () => ok({ ws, inbox, next })));
}

test('players join a battle over the network, move, see each other, and leave to a bot', async () => {
  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), log: () => {} });
  try {
    const a = await connect(srv.port);
    a.ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, dev: 'Able', soldier: { faction: 'US', cls: 'infantry' } }));
    const wa = await a.next((m) => m.k === 'w');
    assert.equal(wa.side, 1, 'the US attacks (side 1, as in the game)');
    const b = await connect(srv.port);
    b.ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, dev: 'Baker', soldier: { faction: 'GE', cls: 'recon' } }));
    const wb = await b.next((m) => m.k === 'w');
    assert.equal(wb.side, 0);
    // Both are in the roster, by name.
    const r = await a.next((m) => m.k === 'r' && m.s.some((x) => x[2] === 'Baker'));
    assert.ok(r.s.some((x) => x[0] === wa.you && x[2] === 'Able'));
    // Snapshots come about 20 a second.
    const s1 = readSnapshot(await a.next((m) => m.k === 's'));
    const me = () => readSnapshot(a.inbox.filter((m) => m.k === 's').pop()).soldiers.find((x) => x.id === wa.you);
    const start = s1.soldiers.find((x) => x.id === wa.you);
    let seq = 0;
    const timer = setInterval(() => a.ws.send(JSON.stringify(encodeInput({ seq: ++seq, held: ['forward'], look: [start.yaw, 0] }))), 33);
    await new Promise((r) => setTimeout(r, 2500));
    clearInterval(timer);
    const now = me();
    assert.ok(Math.hypot(now.x - start.x, now.z - start.z) > 3, 'walked forward from his inputs');
    const snaps = a.inbox.filter((m) => m.k === 's');
    assert.ok(snaps.length > 30, `${snaps.length} snapshots`);
    assert.ok(snaps.at(-1).a > 0, 'the server says which input it has used');
    // A second hello from the same user is refused.
    const c = await connect(srv.port);
    c.ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, dev: 'Able', soldier: { faction: 'US' } }));
    assert.match((await c.next((m) => m.k === 'x')).why, /already/);
    // A wrong army is refused; so is an old page.
    const d = await connect(srv.port);
    d.ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, dev: 'Dog', soldier: { faction: 'SU' } }));
    assert.match((await d.next((m) => m.k === 'x')).why, /US against GE/);
    const e = await connect(srv.port);
    e.ws.send(JSON.stringify({ k: 'h', v: 0, dev: 'Easy' }));
    assert.match((await e.next((m) => m.k === 'x')).why, /reload/);
    // Baker leaves: a bot takes his soldier.
    b.ws.close();
    const r2 = await a.next((m) => m.k === 'r' && m.s.some((x) => x[0] === wb.you && /\(bot\)/.test(x[2])));
    assert.ok(r2);
    assert.equal(srv.room().g.soldiers.find((s) => s.id === wb.you).remote, false);
    a.ws.close();
  } finally {
    await srv.close();
  }
});

test("online battle rewards are worked out by the server and kept with his soldiers", async () => {
  // The database, in memory: Able has one soldier kept, a US rifleman.
  const rows = new Map();
  const store = {
    get: async (id) => rows.get(id) ?? null,
    put: async (id, name, { roster }, rev) => {
      const r = rows.get(id);
      if (r && r.rev !== rev) return { conflict: r };
      rows.set(id, { roster: roster ?? r?.roster, war: null, rev: (r?.rev ?? 0) + 1 });
      return { rev: rows.get(id).rev };
    },
    close: async () => {},
  };
  const kept = { id: 's1', name: 'Hale', faction: 'US', cls: 'infantry', xp: 0, ribbons: {}, stats: { battles: 0, wins: 0, kills: 0, deaths: 0, captures: 0 }, armory: {}, loadout: DEFAULT_LOADOUT.US.infantry };
  rows.set('dev:Able', { roster: { soldiers: [kept], selectedId: 's1', credits: 0 }, war: null, rev: 1 });
  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), store, log: () => {} });
  try {
    // A soldier not kept on the server can't join.
    const x = await connect(srv.port);
    x.ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, dev: 'Able', soldier: { id: 'nobody', faction: 'US', cls: 'infantry' } }));
    assert.match((await x.next((m) => m.k === 'x')).why, /not saved/);
    // His army and class are the kept soldier's, whatever the browser says.
    const a = await connect(srv.port);
    a.ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, dev: 'Able', soldier: { id: 's1', faction: 'GE', cls: 'tanker', loadout: ['mg42', null, null, null, null, null, null] } }));
    const w = await a.next((m) => m.k === 'w');
    assert.equal(w.side, 1, 'the US side');
    const s = srv.room().g.soldiers.find((q) => q.id === w.you);
    assert.deepEqual([s.faction, s.cls, s.weapons[0].def.id], ['US', 'infantry', 'm1_garand']);
    // Two men down, then he leaves: the server works out his battle and keeps it.
    s.kills = 2;
    a.ws.send(JSON.stringify({ k: 'l' }));
    const g = await a.next((m) => m.k === 'g');
    assert.equal(g.result.xp, 300, '100 for the battle, 100 a kill');
    assert.equal(g.soldier.xp, 300);
    assert.equal(g.rev, 2);
    const row = rows.get('dev:Able');
    assert.equal(row.roster.soldiers[0].xp, 300);
    assert.equal(row.roster.soldiers[0].stats.kills, 2);
    assert.equal(row.roster.credits, g.result.credits);
    // Once only: leaving for good adds nothing more.
    a.ws.close();
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(rows.get('dev:Able').rev, 2);
  } finally {
    await srv.close();
  }
});

test('the game files are handed out, and nothing else', async () => {
  const srv = await startServer({ port: 0, check: signInChecker({ jwksUrl: null }), log: () => {} });
  try {
    const get = (p) => fetch(`http://localhost:${srv.port}${p}`);
    assert.equal((await get('/health')).status, 200);
    const page = await get('/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /importmap/);
    assert.equal((await get('/src/main.js')).status, 200);
    assert.equal((await get('/node_modules/three/build/three.module.js')).status, 200);
    for (const p of ['/package.json', '/docs/MULTIPLAYER.md', '/.env.local', '/server/main.mjs', '/src/../package.json', '/node_modules/ws/index.js']) assert.equal((await get(p)).status, 404, p);
  } finally {
    await srv.close();
  }
});

test("sign-in tokens are checked against the sign-in service's public keys", async () => {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'EdDSA' };
  const keys = createServer((req, res) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ keys: [jwk] })));
  await new Promise((r) => keys.listen(0, r));
  const check = signInChecker({ jwksUrl: `http://localhost:${keys.address().port}/.well-known/jwks.json`, allowDevNames: false });
  const token = (claims, exp = '15m', key = privateKey) => new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA', kid: 'k1' }).setIssuedAt().setExpirationTime(exp).sign(key);
  try {
    assert.deepEqual(await check({ token: await token({ sub: 'u1', name: 'Walt <Kowalski>' }) }), { id: 'u1', name: 'Walt Kowalski' });
    assert.deepEqual(await check({ token: await token({ sub: 'u2', email: 'baker@example.com' }) }), { id: 'u2', name: 'baker' });
    await assert.rejects(check({ token: await token({ sub: 'u1' }, '-1m') }), 'run out');
    const other = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    await assert.rejects(check({ token: await token({ sub: 'u1' }, '15m', other.privateKey) }), 'someone else signed it');
    await assert.rejects(check({ dev: 'Able' }), /sign in/, 'no names without a token: no guests');
  } finally {
    keys.close();
  }
});

test('sign-in keys: Neon not answering at first is tried again, and its trouble is logged', async () => {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'EdDSA' };
  let asked = 0;
  const keys = createServer((req, res) => (++asked <= 2 ? res.writeHead(503).end('waking up') : res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ keys: [jwk] }))));
  await new Promise((r) => keys.listen(0, r));
  const logged = [];
  const check = signInChecker({ jwksUrl: `http://localhost:${keys.address().port}/.well-known/jwks.json`, allowDevNames: false, log: (t) => logged.push(t) });
  const token = await new SignJWT({ sub: 'u1', name: 'Able' }).setProtectedHeader({ alg: 'EdDSA', kid: 'k1' }).setIssuedAt().setExpirationTime('15m').sign(privateKey);
  try {
    assert.deepEqual(await check({ token }), { id: 'u1', name: 'Able' });
    assert.equal(asked, 3);
    assert.match(logged.join('\n'), /HTTP 503/);
    // Kept: no more asking.
    await check({ token });
    assert.equal(asked, 3);
  } finally {
    keys.close();
  }
});

test('a loadout from the browser is checked against the army, class and equipment points', () => {
  assert.deepEqual(checkLoadout('US', 'infantry', null), DEFAULT_LOADOUT.US.infantry);
  assert.deepEqual(checkLoadout('US', 'infantry', ['mg42', null, null, null, null, null, null]), DEFAULT_LOADOUT.US.infantry, 'not his army');
  assert.deepEqual(checkLoadout('US', 'infantry', ['m1_garand', 'm1911a1', 'mk2_grenade', null, null, 'spade_m1910', null]), ['m1_garand', 'm1911a1', 'mk2_grenade', null, null, 'spade_m1910', null]);
  assert.deepEqual(checkLoadout('US', 'tanker', ['m1_garand', null, null, null, null, null, null]), DEFAULT_LOADOUT.US.tanker, 'not his class');
  assert.equal(cleanName('  <b>Joe</b>  Smith  '), 'bJoeb Smith');
});
