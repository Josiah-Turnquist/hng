// Friends, parties and chat (src/server/social.js) over the menu connection
// (/lobby), and a party going into the same battle and talking there (/play).
import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { PROTOCOL_VERSION } from '../src/net/protocol.js';
import { cleanChat, chatAllowed } from '../src/server/social.js';
import { DEFAULT_LOADOUT } from '../src/weapons/defs.js';

// The database, in memory: progress rows (for names) and friends.
function memoryStore() {
  const rows = new Map();
  const friends = new Map(); // 'a|b' -> status
  return {
    rows,
    get: async (id) => rows.get(id) ?? null,
    put: async (id, name, { roster }, rev) => {
      const r = rows.get(id);
      if (r && r.rev !== rev) return { conflict: r };
      rows.set(id, { name, roster: roster ?? r?.roster, war: null, rev: (r?.rev ?? 0) + 1 });
      return { rev: rows.get(id).rev };
    },
    byName: async (name) => [...rows].filter(([, r]) => r.name.toLowerCase() === String(name).toLowerCase()).map(([id, r]) => ({ user_id: id, name: r.name })),
    friendsOf: async (me) =>
      [...friends]
        .map(([k, status]) => [k.split('|'), status])
        .filter(([[a, b]]) => a === me || b === me)
        .map(([[a, b], status]) => ({ id: a === me ? b : a, name: rows.get(a === me ? b : a)?.name || '', status, asked: a === me })),
    befriend: async (from, to) => {
      if (friends.has(`${to}|${from}`)) {
        friends.set(`${to}|${from}`, 'accepted');
        return { status: 'accepted' };
      }
      if (!friends.has(`${from}|${to}`)) friends.set(`${from}|${to}`, 'pending');
      return { status: friends.get(`${from}|${to}`) };
    },
    unfriend: async (x, y) => {
      friends.delete(`${x}|${y}`);
      friends.delete(`${y}|${x}`);
    },
    close: async () => {},
  };
}

function connect(port, path) {
  const ws = new WebSocket(`ws://localhost:${port}${path}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    inbox.push(m);
    for (const w of [...waiters]) if (w.test(m)) waiters.splice(waiters.indexOf(w), 1) && w.ok(m);
  });
  // The next message that passes the test (one already come counts, once).
  const next = (test, ms = 20000) =>
    new Promise((ok, fail) => {
      const i = inbox.findIndex(test);
      if (i >= 0) return ok(inbox.splice(i, 1)[0]);
      waiters.push({ test, ok: (m) => (inbox.splice(inbox.indexOf(m), 1), ok(m)) });
      setTimeout(() => fail(new Error('no such message')), ms);
    });
  const send = (m) => ws.send(JSON.stringify(m));
  return new Promise((ok) => ws.on('open', () => ok({ ws, inbox, next, send })));
}

test('chat lines are tidied and kept to a few at a time', () => {
  assert.equal(cleanChat('  hi\n\tthere  '), 'hi there');
  assert.equal(cleanChat('x'.repeat(500)).length, 200);
  const times = [];
  assert.deepEqual([1, 2, 3, 4, 5].map(() => chatAllowed(times, 1000)), [true, true, true, true, false]);
  assert.equal(chatAllowed(times, 7000), true, 'free again after a few seconds');
});

test('friends, a party and its chat; the party goes into one battle and talks there', async () => {
  const store = memoryStore();
  const soldier = { id: 's1', name: 'Hale', faction: 'US', cls: 'infantry', xp: 0, ribbons: {}, stats: {}, armory: {}, loadout: DEFAULT_LOADOUT.US.infantry };
  for (const n of ['Able', 'Baker']) await store.put(`dev:${n}`, n, { roster: { soldiers: [soldier], selectedId: 's1', credits: 0 } }, 0);
  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), store, log: () => {} });
  const open = [];
  try {
    const a = await connect(srv.port, '/lobby');
    const b = await connect(srv.port, '/lobby');
    open.push(a, b);
    a.send({ k: 'h', v: PROTOCOL_VERSION, dev: 'Able' });
    b.send({ k: 'h', v: PROTOCOL_VERSION, dev: 'Baker' });
    assert.equal((await a.next((m) => m.k === 'w')).me.name, 'Able');
    await b.next((m) => m.k === 'w');

    // Friends: asked by name, accepted, both online in the menus.
    a.send({ k: 'fr', name: 'nobody' });
    assert.match((await a.next((m) => m.k === 'n')).text, /No player/);
    a.send({ k: 'fr', name: 'baker' });
    assert.match((await a.next((m) => m.k === 'n')).text, /request sent/);
    const asks = await b.next((m) => m.k === 'f' && m.friends.some((f) => f.status === 'asks'));
    b.send({ k: 'fa', id: asks.friends[0].id });
    const fa = await a.next((m) => m.k === 'f' && m.friends.some((f) => f.status === 'friend'));
    assert.deepEqual(fa.friends[0], { id: 'dev:Baker', name: 'Baker', status: 'friend', where: 'menus' });

    // A party: invited, taken up, chat.
    a.send({ k: 'pi', id: 'dev:Baker' });
    const inv = await b.next((m) => m.k === 'p' && m.invites.length);
    assert.equal(inv.invites[0].name, 'Able');
    b.send({ k: 'pa', party: inv.invites[0].party });
    const party = await a.next((m) => m.k === 'p' && m.party?.members.length === 2);
    assert.equal(party.party.leader, 'dev:Able');
    b.send({ k: 'pc', text: 'ready when you are' });
    assert.deepEqual(await a.next((m) => m.k === 'pc'), { k: 'pc', from: 'dev:Baker', name: 'Baker', text: 'ready when you are' });

    // The leader goes in: the other is called, and joins the same battle.
    a.send({ k: 'go' });
    assert.equal((await b.next((m) => m.k === 'go')).by, 'dev:Able');
    const pa = await connect(srv.port, '/play');
    open.push(pa);
    pa.send({ k: 'h', v: PROTOCOL_VERSION, dev: 'Able', soldier: { id: 's1', faction: 'US', cls: 'infantry' } });
    const wa = await pa.next((m) => m.k === 'w');
    // (A battle of the other army's war elsewhere must not pull him away.)
    const pb = await connect(srv.port, '/play');
    open.push(pb);
    pb.send({ k: 'h', v: PROTOCOL_VERSION, dev: 'Baker', soldier: { id: 's1', faction: 'US', cls: 'infantry' } });
    const wb = await pb.next((m) => m.k === 'w');
    assert.equal(srv.rooms().length, 1, 'the same battle');
    assert.equal(wb.side, wa.side, 'the same side');
    assert.equal((await b.next((m) => m.k === 'f' && m.friends[0]?.where === 'battle')).friends[0].name, 'Able', 'his friend shows as in battle');

    // Chat in battle: his side hears it.
    pa.send({ k: 't', text: 'on me', all: false });
    const heard = await pb.next((m) => m.k === 't');
    assert.deepEqual([heard.name, heard.text, heard.all], ['Able', 'on me', false]);
  } finally {
    for (const c of open) c.ws.close();
    await new Promise((r) => setTimeout(r, 200));
    await srv.close();
  }
});
