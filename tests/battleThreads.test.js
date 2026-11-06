// Every battle in a thread of its own (src/server/roomProxy.js, roomWorker.js),
// as the game server runs them: players join and get the battle, another army
// opens a second battle in another thread, rewards come back on leaving, a
// dropped player is held and comes back, and the server's finish keeps
// everyone's battle so far.
import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { PROTOCOL_VERSION, encodeInput, readSnapshot } from '../src/net/protocol.js';
import { RoomProxy } from '../src/server/roomProxy.js';

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
  return new Promise((ok) => ws.on('open', () => ok({ ws, next, send, closed, inbox })));
}

const hello = (name, soldier) => ({ k: 'h', v: PROTOCOL_VERSION, dev: name, soldier: { faction: 'US', cls: 'infantry', ...soldier } });
const until = async (fn, ms = 10000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 50))) if (fn()) return true;
  return false;
};

test('battles in threads of their own: join, play, a second battle, rewards, a drop and back, the finish', async () => {
  const rewards = [];
  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), log: () => {} });
  const open = [];
  try {
    const a = await connect(srv.port);
    open.push(a);
    a.send(hello('Able', { id: 's1' }));
    const wa = await a.next((m) => m.k === 'w');
    assert.ok(srv.room() instanceof RoomProxy, 'the battle runs in its own thread');
    await a.next((m) => m.k === 's');

    // A German: the same battle, on the other side.
    const b = await connect(srv.port);
    open.push(b);
    b.send(hello('Baker', { id: 's1', faction: 'GE' }));
    const wb = await b.next((m) => m.k === 'w');
    assert.notEqual(wb.side, wa.side);
    assert.equal(srv.rooms().length, 1);
    const room = srv.room();
    assert.ok(await until(() => room.playersOn(wa.side) === 1 && room.playersOn(wb.side) === 1 && room.players.size === 2));
    room.onReward = ((was) => (x) => (rewards.push(x), was?.(x)))(room.onReward);

    // He walks: his soldier in the snapshots moves.
    const seen = [];
    a.ws.on('message', (d) => { const m = JSON.parse(String(d)); if (m.k === 's') seen.push(m); });
    const me = () => readSnapshot(seen.at(-1)).soldiers.find((x) => x.id === wa.you);
    const start = readSnapshot(await a.next((m) => m.k === 's')).soldiers.find((x) => x.id === wa.you);
    let seq = 0;
    const timer = setInterval(() => a.ws.send(JSON.stringify(encodeInput({ seq: ++seq, held: ['forward'], look: [start.yaw, 0] }))), 33);
    await new Promise((r) => setTimeout(r, 2500));
    clearInterval(timer);
    await a.next((m) => m.k === 's');
    const now = me();
    // (Used by the server, and he went somewhere: a wall may stand in his way.)
    assert.ok(seen.at(-1).a >= seq - 5, `inputs used: ${seen.at(-1).a} of ${seq}`);
    assert.ok(Math.hypot(now.x - start.x, now.z - start.z) > 0.5, 'walked forward from his inputs');

    // A Soviet: another battle, in another thread.
    const c = await connect(srv.port);
    open.push(c);
    c.send(hello('Charlie', { id: 's1', faction: 'SU' }));
    await c.next((m) => m.k === 'w');
    await c.next((m) => m.k === 's');
    assert.equal(srv.rooms().length, 2);
    assert.notEqual(srv.rooms()[0].worker.threadId, srv.rooms()[1].worker.threadId);

    // Baker leaves from the menu: his rewards come back to him.
    b.send({ k: 'l' });
    const g = await b.next((m) => m.k === 'g');
    assert.ok(g);
    assert.ok(rewards.some((x) => x.userId === 'dev:Baker' && x.client?.readyState !== undefined), 'his reward, for his connection');

    // Able's connection drops: held for him, and he comes back to the same soldier.
    a.ws.terminate();
    assert.ok(await until(() => room.holding('dev:Able') === wa.you));
    assert.equal(room.heldSoldier('dev:Able'), 's1');
    const a2 = await connect(srv.port);
    open.push(a2);
    a2.send(hello('Able', { id: 's1', rejoin: true }));
    const back = await a2.next((m) => m.k === 'w');
    assert.equal(back.you, wa.you);
    assert.equal(back.back, true);
    await a2.next((m) => m.k === 's');

    // The server stopping: everyone's battle so far kept, every battle closed.
    await srv.finish();
    assert.ok(srv.rooms().every((r) => r.closed) || srv.rooms().length === 0);
    assert.ok(rewards.some((x) => x.userId === 'dev:Able'), 'Able kept his battle too');
  } finally {
    for (const c of open) c.ws.close();
    await srv.close();
  }
});
