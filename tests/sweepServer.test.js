// What the bug sweep found in the game server: nothing a browser sends may
// stop it, a player whose line went dead can get back in, and what comes from
// a browser is checked before it is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import WebSocket from 'ws';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { PROTOCOL_VERSION, decodeInput } from '../src/net/protocol.js';
import { BattleRoom } from '../src/server/room.js';
import { keepEarned } from '../src/server/progress.js';
import { Telemetry } from '../src/server/telemetry.js';
import { WarService } from '../src/server/warService.js';
import { newWar, buy, upgradeProblem, teamType, TEAMS } from '../src/war/war.js';

const check = signInChecker({ jwksUrl: null, allowDevNames: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 10000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(50)) if (fn()) return true;
  return false;
};
const hello = (name, soldier) => ({ k: 'h', v: PROTOCOL_VERSION, dev: name, soldier: { faction: 'US', cls: 'infantry', ...soldier } });

function connect(port, path = '/play', options = {}) {
  const ws = new WebSocket(`ws://localhost:${port}${path}`, options);
  const inbox = [];
  const waiters = [];
  ws.on('error', () => {});
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    inbox.push(m);
    for (const x of [...waiters]) if (x.test(m)) waiters.splice(waiters.indexOf(x), 1) && x.ok(m);
  });
  const next = (test, ms = 60000) =>
    new Promise((ok, fail) => {
      const i = inbox.findIndex(test);
      if (i >= 0) return ok(inbox.splice(i, 1)[0]);
      waiters.push({ test, ok: (m) => (inbox.splice(inbox.indexOf(m), 1), ok(m)) });
      setTimeout(() => fail(new Error('no such message')), ms).unref?.();
    });
  const send = (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  const closed = new Promise((ok) => ws.on('close', ok));
  return new Promise((ok) => ws.on('open', () => ok({ ws, next, send, closed })));
}

test('nothing sent without signing in stops the server: not "null", not a list, not a message too long', async () => {
  const srv = await startServer({ threads: false, port: 0, battleSize: 4, check, log: () => {} });
  try {
    for (const text of ['null', '5', '[]', '"h"', 'true']) {
      const c = await connect(srv.port);
      c.send(text);
      const x = await c.next((m) => m.k === 'x', 5000);
      assert.equal(x.why, 'Bad message', text);
      await c.closed;
    }
    // Longer than a message may be, on both kinds of connection.
    for (const path of ['/play', '/lobby']) {
      const c = await connect(srv.port, path);
      c.send('x'.repeat(40000));
      await c.closed;
    }
    for (const text of ['null', '5', '[]']) {
      const c = await connect(srv.port, '/lobby');
      c.send(text);
      await wait(100);
      c.ws.close();
    }
    assert.equal(await (await fetch(`http://localhost:${srv.port}/health`)).text(), 'ok');
  } finally {
    await srv.close();
  }
});

test('odd messages from a player in a battle are dropped, and the battle goes on', async () => {
  const srv = await startServer({ threads: false, port: 0, battleSize: 4, check, log: () => {} });
  const a = await connect(srv.port);
  try {
    a.send(hello('Able', { id: 's1' }));
    const w = await a.next((m) => m.k === 'w');
    await a.next((m) => m.k === 's');
    for (const text of ['null', '[]', '7', '{"k":"i"}', '{"k":"i","h":[],"p":[],"l":[1e400,1e400],"q":1e400}', '{"k":"t","text":{"a":1}}', '{"k":"i","h":"x","p":5,"l":null}']) a.send(text);
    await wait(600);
    const room = srv.room();
    const me = room.g.soldiers.find((s) => s.id === w.you);
    assert.ok(me && Number.isFinite(me.body.x) && Number.isFinite(me.yaw), 'his soldier is still somewhere real');
    assert.equal(await (await fetch(`http://localhost:${srv.port}/health`)).text(), 'ok');
  } finally {
    a.ws.terminate();
    await srv.close();
  }
});

test('a look or a count that is endless or no number reads as nothing', () => {
  const f = decodeInput(JSON.parse('{"k":"i","h":[],"p":[],"l":[1e400,-1e400],"q":1e400,"w":1e400}'));
  assert.deepEqual(f.look, [0, 0]);
  assert.equal(f.seq, 0);
  assert.ok(Number.isFinite(f.wheel));
  const g = decodeInput({ k: 'i', h: [], p: [], l: ['abc', {}], q: 'x' });
  assert.deepEqual(g.look, [0, 0]);
  assert.equal(g.seq, 0);
});

test("sign-in passed on: Neon's answer cut off half way is a plain \"not reached\", and the server stays up", async () => {
  const upstream = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '1000' });
    res.write('{"half":');
    setTimeout(() => res.socket.destroy(), 30);
  });
  await new Promise((r) => upstream.listen(0, r));
  const srv = await startServer({ threads: false, port: 0, check, authBase: `http://localhost:${upstream.address().port}/neondb/auth`, log: () => {} });
  try {
    const r = await fetch(`http://localhost:${srv.port}/api/auth/get-session`);
    assert.equal(r.status, 502);
    assert.equal((await r.json()).code, 'NETWORK_ERROR');
    assert.equal(await (await fetch(`http://localhost:${srv.port}/health`)).text(), 'ok');
  } finally {
    await srv.close();
    upstream.close();
  }
});

test('the war: a team type that is no team ("constructor", "__proto__") buys nothing and harms nothing', async () => {
  for (const type of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', null, 5, {}]) {
    const war = newWar(1);
    const before = { ...war.funds };
    assert.equal(buy(war, 'US', type), null, String(type));
    assert.deepEqual(war.funds, before, String(type));
    assert.equal(teamType(type), null);
  }
  const real = Object.keys(TEAMS).find((k) => !TEAMS[k].from);
  assert.equal(teamType(real), TEAMS[real]);
  const war = newWar(1);
  const t = buy(war, 'US', real);
  assert.ok(t);
  assert.equal(upgradeProblem(war, t, 'constructor'), 'Not an upgrade of this team');

  // Over the lobby, as a general's order.
  const svc = new WarService({ store: null, log: () => {} });
  await svc.start();
  try {
    svc.generals.set('u1', { army: 'US', name: 'Able', seen: Date.now() });
    const funds = svc.war.funds.US;
    for (const type of ['constructor', '__proto__', 'valueOf']) {
      const r = svc.order('u1', { act: 'buy', type });
      assert.equal(r.ok, false, type);
    }
    assert.equal(svc.war.funds.US, funds);
    assert.ok(Number.isFinite(svc.war.funds.US));
    svc._run();
  } finally {
    await svc.stop();
  }
});

test('joining: a class that is no class is refused, and a refused join costs the side no bot', async () => {
  const room = new BattleRoom({ perSide: 4, send: () => {} });
  await room.ready;
  try {
    const retiring = () => room.g.soldiers.filter((s) => s.retire).length;
    for (const cls of ['constructor', '__proto__', 'toString', 5, null]) {
      assert.throws(() => room.join({}, { userId: 'u1', name: 'Able', faction: room.opts.attackers, cls }), /Unknown class/, String(cls));
    }
    assert.equal(retiring(), 0);
    assert.equal(room.players.size, 0);
    room.join({}, { userId: 'u1', name: 'Able', faction: room.opts.attackers, cls: 'infantry' });
    assert.equal(room.players.size, 1);
    assert.equal(retiring(), 1);
  } finally {
    room.close();
  }
});

test('saved soldiers: a new recruit of no real army or class is left out', () => {
  const kept = { credits: 100000, soldiers: [{ id: 'a', faction: 'US', cls: 'infantry', xp: 10 }] };
  const sent = {
    credits: 100000,
    soldiers: [
      { id: 'a', faction: 'US', cls: 'infantry' },
      { id: 'b', faction: 'US', cls: 'constructor' },
      { id: 'c', faction: '__proto__', cls: 'infantry' },
      { id: 'd', faction: 'GE', cls: 'infantry' },
    ],
  };
  const { roster, fixed } = keepEarned(kept, sent);
  assert.deepEqual(
    roster.soldiers.map((s) => s.id),
    ['a', 'd'],
  );
  assert.equal(fixed, true);
});

test('stats from a browser: a word where a number belongs is left out', () => {
  const t = new Telemetry({ store: { logEvents: async () => {} }, log: () => {} });
  try {
    t.record('u1', 'perf', { fps: 'abc', low: 31.456, quality: 'high', won: 'yes', early: true });
    assert.deepEqual(t.waiting[0].data, { low: 31.46, quality: 'high', early: true });
  } finally {
    t.stop();
  }
});

test('in a battle already, over a connection gone dead: the new connection takes his soldier over', async () => {
  const srv = await startServer({ threads: false, port: 0, battleSize: 4, check, log: () => {} });
  const open = [];
  try {
    const a = await connect(srv.port);
    open.push(a);
    a.send(hello('Able', { id: 's1' }));
    const w = await a.next((m) => m.k === 'w');
    const room = srv.room();

    // His browser gets back in by itself while the server still thinks the old line is up.
    const b = await connect(srv.port);
    open.push(b);
    b.send(hello('Able', { id: 's1', rejoin: true }));
    const back = await b.next((m) => m.k === 'w');
    assert.equal(back.you, w.you, 'the same soldier');
    assert.equal(back.back, true);
    const x = await a.next((m) => m.k === 'x');
    assert.equal(x.gone, true, 'the old window is told, and does not come back by itself');
    await a.closed;
    await wait(200);
    assert.equal(room.players.size, 1);
    assert.equal(room.held.size, 0);
    assert.equal(room.g.soldiers.find((s) => s.id === w.you).remote, true, 'still his, not a bot');

    // From the menus with the same soldier: the same again.
    const c = await connect(srv.port);
    open.push(c);
    c.send(hello('Able', { id: 's1' }));
    assert.equal((await c.next((m) => m.k === 'w')).you, w.you);
    await b.closed;

    // From the menus with another soldier: the old place is given up, and he joins anew.
    const d = await connect(srv.port);
    open.push(d);
    d.send(hello('Able', { id: 's2' }));
    const fresh = await d.next((m) => m.k === 'w');
    assert.notEqual(fresh.you, w.you);
    await c.closed;
    await wait(200);
    assert.equal(room.players.size, 1);
    assert.equal(room.held.size, 0);
  } finally {
    for (const c of open) c.ws.terminate();
    await srv.close();
  }
});

test('a battle connection that stops answering is dropped, and his soldier held for him', async () => {
  const srv = await startServer({ threads: false, port: 0, battleSize: 4, check, beatEvery: 2500, log: () => {} });
  // (A connection that never answers the server's pings: a line gone dead.)
  const a = await connect(srv.port, '/play', { autoPong: false });
  try {
    a.send(hello('Able', { id: 's1' }));
    const w = await a.next((m) => m.k === 'w');
    const room = srv.room();
    assert.ok(await until(() => room.held.size === 1, 9000), 'dropped within two beats');
    assert.equal(room.holding('dev:Able'), w.you);
    await a.closed;
  } finally {
    a.ws.terminate();
    await srv.close();
  }
});

test('back into a battle decided while he was away: he is told it is over, and gets what it earned him', async () => {
  const srv = await startServer({ threads: false, port: 0, battleSize: 4, check, log: () => {} });
  const open = [];
  try {
    const a = await connect(srv.port);
    open.push(a);
    a.send(hello('Able', { id: 's1' }));
    const w = await a.next((m) => m.k === 'w');
    const room = srv.room();
    a.ws.terminate();
    assert.ok(await until(() => room.held.size === 1));
    room.g.mode.over = { team: w.side, why: 'test' };
    assert.ok(await until(() => room.overFor > 0, 5000));

    const b = await connect(srv.port);
    open.push(b);
    b.send(hello('Able', { id: 's1', rejoin: true }));
    const back = await b.next((m) => m.k === 'w');
    assert.equal(back.you, w.you);
    const o = await b.next((m) => m.k === 'o', 5000);
    assert.equal(o.team, w.side);
    const g = await b.next((m) => m.k === 'g', 5000);
    assert.equal(g.k, 'g');
  } finally {
    for (const c of open) c.ws.terminate();
    await srv.close();
  }
});
