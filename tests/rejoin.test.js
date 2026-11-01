// Back into the battle after a dropped connection (src/server/room.js gone,
// rejoin; server/main.mjs): the server holds his soldier for a minute; he
// comes back to the same soldier, or a bot takes it over when he doesn't.
import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { PROTOCOL_VERSION, RemoteInput } from '../src/net/protocol.js';
import { HOLD } from '../src/server/room.js';

function connect(port) {
  const ws = new WebSocket(`ws://localhost:${port}/play`);
  const inbox = [];
  const waiters = [];
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
  const send = (m) => ws.send(JSON.stringify(m));
  const closed = new Promise((ok) => ws.on('close', ok));
  return new Promise((ok) => ws.on('open', () => ok({ ws, next, send, closed })));
}

const hello = (name, soldier) => ({ k: 'h', v: PROTOCOL_VERSION, dev: name, soldier: { faction: 'US', cls: 'infantry', ...soldier } });
const until = async (fn, ms = 10000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 50))) if (fn()) return true;
  return false;
};

test('a dropped player lets go of every key, and his next connection counts its inputs anew', () => {
  const inp = new RemoteInput();
  inp.apply({ seq: 50, held: new Set(['forward', 'sprint']), pressed: new Set(), look: [0, 0], wheel: 0 });
  inp.drop();
  assert.equal(inp.is('forward'), false);
  assert.equal(inp.up('sprint'), true, 'let go');
  assert.equal(inp.apply({ seq: 1, held: new Set(), pressed: new Set(), look: [0, 0], wheel: 0 }), true, 'input 1 counts again');
});

test('dropped: his soldier waits for him and he comes back to it; not back in time, a bot takes it', async () => {
  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), log: () => {} });
  const open = [];
  try {
    const a = await connect(srv.port);
    open.push(a);
    a.send(hello('Able', { id: 's1' }));
    const w = await a.next((m) => m.k === 'w');
    const room = srv.room();
    const me = () => room.g.soldiers.find((s) => s.id === w.you);
    await a.next((m) => m.k === 's');

    // His connection drops (no "leaving"): held, still his, still counted on his side.
    a.ws.terminate();
    assert.ok(await until(() => room.held.size === 1));
    assert.equal(room.holding('dev:Able'), w.you);
    assert.equal(room.playersOn(w.side), 1, 'his place on the side is kept');
    assert.equal(me().remote, true, 'no bot took him over');
    assert.equal(room.players.get([...room.held.values()][0].client), undefined);

    // Back in by itself: the same soldier, told it is a return.
    const b = await connect(srv.port);
    open.push(b);
    b.send(hello('Able', { id: 's1', rejoin: true }));
    const back = await b.next((m) => m.k === 'w');
    assert.equal(back.you, w.you, 'the same soldier');
    assert.equal(back.back, true);
    assert.equal(room.held.size, 0);
    assert.equal(srv.rooms().length, 1, 'no new battle');
    await b.next((m) => m.k === 's');
    // His inputs count again from 1.
    b.send({ k: 'i', q: 1, h: [], p: [], l: [0, 0], w: 0 });
    assert.ok(await until(() => room.players.get([...room.players.keys()][0])?.pc.input.seq === 1));

    // Dropped again, and away longer than the server waits: a bot has him.
    let rewarded = null;
    const was = room.onReward;
    room.onReward = (x) => ((rewarded = x), was?.(x));
    b.ws.terminate();
    assert.ok(await until(() => room.held.size === 1));
    [...room.held.values()][0].since -= HOLD + 1;
    assert.ok(await until(() => room.held.size === 0, 5000), 'given up');
    assert.match(me().name, /\(bot\)$/);
    assert.equal(me().remote, false);
    assert.equal(rewarded?.userId, 'dev:Able', 'his rewards so far, kept');

    // Asking to come back now: refused, and told his place is gone.
    const c = await connect(srv.port);
    open.push(c);
    c.send(hello('Able', { id: 's1', rejoin: true }));
    const no = await c.next((m) => m.k === 'x');
    assert.equal(no.gone, true);
  } finally {
    for (const c of open) c.ws.close();
    await srv.close();
  }
});

test('leaving on purpose is not held; a page reloaded comes back from the menus; another soldier gives the place up', async () => {
  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), log: () => {} });
  const open = [];
  try {
    const a = await connect(srv.port);
    open.push(a);
    a.send(hello('Baker', { id: 's1' }));
    await a.next((m) => m.k === 'w');
    const room = srv.room();
    a.send({ k: 'l' });
    await a.next((m) => m.k === 'g');
    a.ws.close();
    await a.closed;
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(room.held.size, 0, 'he chose to go');

    // Charlie drops, then joins from the menus with the same soldier (a reload): his soldier.
    const c = await connect(srv.port);
    open.push(c);
    c.send(hello('Charlie', { id: 'c1' }));
    const wc = await c.next((m) => m.k === 'w');
    c.ws.terminate();
    assert.ok(await until(() => room.held.size === 1));
    const c2 = await connect(srv.port);
    open.push(c2);
    c2.send(hello('Charlie', { id: 'c1' }));
    assert.equal((await c2.next((m) => m.k === 'w')).you, wc.you);

    // Dropped again, then joins with another soldier: that place is given up first.
    c2.ws.terminate();
    assert.ok(await until(() => room.held.size === 1));
    const c3 = await connect(srv.port);
    open.push(c3);
    c3.send(hello('Charlie', { id: 'c2' }));
    const w3 = await c3.next((m) => m.k === 'w');
    assert.notEqual(w3.you, wc.you, 'a new soldier');
    assert.equal(room.held.size, 0);
    assert.match(room.g.soldiers.find((s) => s.id === wc.you).name, /\(bot\)$/);
  } finally {
    for (const c of open) c.ws.close();
    await srv.close();
  }
});
