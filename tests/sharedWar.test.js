// The shared war (src/server/warService.js): one war run on the game server,
// its generals' orders, computer generals for the armies nobody leads, and its
// battles fought online with their results going back into the war.
import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { WarService, ONLINE } from '../src/server/warService.js';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { PROTOCOL_VERSION } from '../src/net/protocol.js';
import { capitalsOf, battleOf, teamOf, ARMIES, load } from '../src/war/war.js';
import { MAP } from '../src/war/warMap.js';
import { DEFAULT_LOADOUT } from '../src/weapons/defs.js';

// The database, in memory: players, the war and its generals.
function memoryStore() {
  const rows = new Map();
  const gens = new Map();
  let war = null;
  return {
    rows,
    get: async (id) => rows.get(id) ?? null,
    put: async (id, name, { roster }, rev) => {
      const r = rows.get(id);
      if (r && r.rev !== rev) return { conflict: r };
      rows.set(id, { name, roster: roster ?? r?.roster, war: null, rev: (r?.rev ?? 0) + 1 });
      return { rev: rows.get(id).rev };
    },
    list: async () => [...rows].map(([user_id, r]) => ({ user_id, ...r })),
    loadWar: async () => war,
    saveWar: async (text) => void (war = JSON.parse(text)),
    generals: async () => [...gens].map(([user_id, g]) => ({ user_id, ...g })),
    setGeneral: async (id, army, name) => void (army ? gens.set(id, { army, name, last_seen: null }) : gens.delete(id)),
    generalSeen: async () => {},
    close: async () => {},
  };
}

// A battle put straight into the war: an attack by `att` on a capital of `def`.
function battleAt(war, att, def) {
  const point = capitalsOf(war, def)[0];
  const b = { id: war.nextId++, point, att, def, attTeams: [], defTeams: [], garrison: 150, start: war.t, ends: war.t + 600, hero: null };
  war.battles.push(b);
  return b;
}

test('the shared war: generals give orders for their own army only; the computer leads the rest', async () => {
  let clock = 0;
  const w = new WarService({ log: () => {}, speed: 6, now: () => clock });
  await w.start();
  try {
    const war = w.war;
    assert.equal(war.army, null, 'no army is one player\'s');
    assert.deepEqual(war.humans, [], 'nobody leads yet: the computer leads all three');
    assert.match(w.order('dev:Pipsy', { act: 'buy', type: 'guard' }).why, /Only generals/);

    await w.setGeneral('dev:Pipsy', 'US', 'Pipsy');
    w.seen('dev:Pipsy');
    w._leaders();
    assert.deepEqual(war.humans, ['US'], 'the US has a general now');

    // Buy, set down at a capital, march.
    const bought = w.order('dev:Pipsy', { act: 'buy', type: 'guard' });
    assert.ok(bought.ok && bought.team);
    const cap = capitalsOf(war, 'US')[0];
    assert.equal(w.order('dev:Pipsy', { act: 'deploy', id: bought.team, point: capitalsOf(war, 'GE')[0] }).why, 'Not one of your capitals');
    assert.ok(w.order('dev:Pipsy', { act: 'deploy', id: bought.team, point: cap }).ok);
    const to = MAP.next[cap][0];
    assert.ok(w.order('dev:Pipsy', { act: 'move', id: bought.team, point: to }).ok);
    assert.deepEqual(teamOf(war, bought.team).path, [to]);
    assert.ok(w.order('dev:Pipsy', { act: 'stop', id: bought.team }).ok);
    assert.equal(w.order('dev:Pipsy', { act: 'move', id: bought.team, point: 999999 }).why, 'No such place');
    // A German team is not his to order.
    const ge = war.teams.find((t) => t.army === 'GE');
    assert.equal(w.order('dev:Pipsy', { act: 'withdraw', id: ge.id }).why, 'Not one of your teams');

    // An hour of war: the computer generals set their teams down; the US
    // reserve team (his) stays where he left it.
    const reserve = war.teams.find((t) => t.army === 'US' && t.id !== bought.team);
    for (let i = 0; i < 600; i++) {
      clock += 1000;
      w._run();
    }
    assert.ok(war.t > 8 * 3600 + 3000, 'the war ran on at six times real time');
    assert.equal(reserve.at, null, 'nobody set his reserve team down for him');
    assert.ok(war.teams.some((t) => t.army === 'GE' && t.at !== null), 'the Germans\' computer general sent a team out');

    // A general away a day: the computer leads his army again.
    clock += 25 * 3600 * 1000;
    w._leaders();
    assert.deepEqual(war.humans, []);
  } finally {
    await w.stop();
  }
});

test('a war battle held open by an online battle, then decided by it; one left early settles on its own', async () => {
  let clock = 0;
  const w = new WarService({ log: () => {}, speed: 6, now: () => clock });
  await w.start();
  try {
    const war = w.war;
    assert.throws(() => w.battleFor(war.number, 999, 'US'), /over/);
    const b = battleAt(war, 'US', 'GE');
    assert.throws(() => w.battleFor(war.number, b.id, 'SU'), /does not fight/);
    assert.equal(w.battleFor(war.number, b.id, 'US'), b);
    w.opened(war.number, b.id, { players: new Map() });
    assert.equal(b.hero, ONLINE);
    // Its time is up, but it is being fought: it waits.
    for (let i = 0; i < 200; i++) {
      clock += 1000;
      w._run();
    }
    assert.ok(battleOf(war, b.id), 'still on while fought online');
    const r = w.result(war.number, b.id, true);
    assert.equal(r.winArmy, 'US');
    assert.equal(war.owner[b.point], 1, 'the capital is American now');
    assert.equal(battleOf(war, b.id), undefined);
    assert.equal(w.result(war.number, b.id, false), null, 'a battle decided once only');

    // Everyone left before the end: it settles on its own, after a short wait.
    const c = battleAt(war, 'GE', 'SU');
    w.opened(war.number, c.id, { players: new Map() });
    w.closedEarly(war.number, c.id);
    assert.equal(c.hero, null);
    for (let i = 0; i < 200; i++) {
      clock += 1000;
      w._run();
    }
    assert.equal(battleOf(war, c.id), undefined, 'settled on its own');
  } finally {
    await w.stop();
  }
});

test('the war is kept in the database and taken up again; a new war begins after one ends', async () => {
  const store = memoryStore();
  let clock = 0;
  const w = new WarService({ store, log: () => {}, now: () => clock });
  await w.start();
  await w.setGeneral('dev:Pipsy', 'GE', 'Pipsy');
  w.war.funds.GE = 123456;
  await w.stop();
  const again = new WarService({ store, log: () => {}, now: () => clock });
  await again.start();
  try {
    assert.equal(again.war.funds.GE, 123456, 'the same war');
    assert.equal(again.generals.get('dev:Pipsy').army, 'GE', 'and its generals');
    const n = again.war.number;
    again.war.over = { winner: 'GE', t: again.war.t };
    for (let i = 0; i < 601; i++) {
      clock += 1000;
      again._run();
    }
    assert.equal(again.war.number, n + 1, 'the next war');
    assert.equal(again.war.army, null);
    assert.equal(load(JSON.stringify(store.loadWar ? await store.loadWar() : null))?.number, n + 1, 'saved');
  } finally {
    await again.stop();
  }
});

function connect(port, path) {
  const ws = new WebSocket(`ws://localhost:${port}${path}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    inbox.push(m);
    for (const x of [...waiters]) if (x.test(m)) waiters.splice(waiters.indexOf(x), 1) && x.ok(m);
  });
  const next = (test, ms = 20000) =>
    new Promise((ok, fail) => {
      const i = inbox.findIndex(test);
      if (i >= 0) return ok(inbox.splice(i, 1)[0]);
      waiters.push({ test, ok: (m) => (inbox.splice(inbox.indexOf(m), 1), ok(m)) });
      setTimeout(() => fail(new Error("no such message")), ms).unref?.();
    });
  const send = (m) => ws.send(JSON.stringify(m));
  return new Promise((ok) => ws.on('open', () => ok({ ws, inbox, next, send })));
}

test('on the game server: watch the war, a general made on the admin page gives orders, a war battle is fought online', async () => {
  const store = memoryStore();
  const soldier = { id: 's1', name: 'Hale', faction: 'US', cls: 'infantry', xp: 0, ribbons: {}, stats: {}, armory: {}, loadout: DEFAULT_LOADOUT.US.infantry };
  await store.put('dev:Pipsy', 'Pipsy', { roster: { soldiers: [soldier], selectedId: 's1', credits: 0 } }, 0);
  const srv = await startServer({ port: 0, battleSize: 4, check: signInChecker({ jwksUrl: null, allowDevNames: true }), store, admins: ['dev:Boss'], log: () => {} });
  const open = [];
  const as = (name, path, body) =>
    fetch(`http://localhost:${srv.port}/api/admin/${path}`, { method: body ? 'POST' : 'GET', headers: { 'X-Dev-Name': name, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  try {
    await srv.warReady;
    const lob = await connect(srv.port, '/lobby');
    open.push(lob);
    lob.send({ k: 'h', v: PROTOCOL_VERSION, dev: 'Pipsy' });
    await lob.next((m) => m.k === 'w');
    lob.send({ k: 'ww', on: true });
    const first = await lob.next((m) => m.k === 'war');
    assert.equal(first.you, null, 'not a general');
    assert.equal(first.war.owner.length, MAP.count);
    assert.equal(first.war.rng, undefined, 'the war\'s dice are not sent');
    assert.ok(ARMIES.every((a) => Array.isArray(first.war.leaders[a])));
    // (Asked for straight after the hello, before the server has checked it: still kept.)
    const quick = await connect(srv.port, '/lobby');
    open.push(quick);
    quick.send({ k: 'h', v: PROTOCOL_VERSION, dev: 'Able' });
    quick.send({ k: 'ww', on: true });
    assert.equal((await quick.next((m) => m.k === 'war')).war.number, first.war.number);
    lob.send({ k: 'wo', n: 1, act: 'buy', type: 'guard' });
    assert.match((await lob.next((m) => m.k === 'wr' && m.n === 1)).why, /Only generals/);

    // The admin page makes him general of the US Army.
    assert.equal((await as('Pipsy', 'general', { id: 'dev:Pipsy', army: 'US' })).status, 403, 'not by a player');
    const made = await as('Boss', 'general', { id: 'dev:Pipsy', army: 'US' });
    assert.equal(made.status, 200);
    assert.deepEqual(made.body.generals.map((g) => [g.name, g.army, g.watching]), [['Pipsy', 'US', true]]);
    assert.equal((await lob.next((m) => m.k === 'war' && m.you === 'US')).you, 'US', 'he is told at once');
    lob.send({ k: 'wo', n: 2, act: 'buy', type: 'guard' });
    const bought = await lob.next((m) => m.k === 'wr' && m.n === 2);
    assert.ok(bought.ok, bought.why);
    const seen = await lob.next((m) => m.k === 'war' && m.war.teams.some((t) => t.id === bought.team));
    assert.equal(seen.war.teams.find((t) => t.id === bought.team).army, 'US');

    // A war battle, fought online: the armies are the battle's, and the war
    // holds it open.
    const war = srv.war.war;
    const b = battleAt(war, 'US', 'GE');
    const play = await connect(srv.port, '/play');
    open.push(play);
    play.send({ k: 'h', v: PROTOCOL_VERSION, dev: 'Pipsy', soldier: { id: 's1', faction: 'US', cls: 'infantry', war: { number: war.number, id: b.id } } });
    const welcome = await play.next((m) => m.k === 'w' || m.k === 'x', 60000);
    assert.equal(welcome.k, 'w', welcome.why);
    assert.deepEqual([welcome.attackers, welcome.defenders, welcome.side], ['US', 'GE', 1]);
    assert.equal(welcome.war.id, b.id);
    assert.equal(welcome.war.point, MAP.name(b.point));
    assert.equal(b.hero, ONLINE);
    const watched = await lob.next((m) => m.k === 'war' && m.war.fights[b.id] === 1);
    assert.equal(watched.war.fights[b.id], 1, 'everyone sees it is being fought, by one player');

    // Decided online: back into the war.
    srv.rooms()[0].onOver(1);
    assert.equal(battleOf(war, b.id), undefined);
    assert.equal(war.owner[b.point], 1, 'the Americans took it');

    // A battle that is over can't be joined.
    const late = await connect(srv.port, '/play');
    open.push(late);
    late.send({ k: 'h', v: PROTOCOL_VERSION, dev: 'Pipsy', soldier: { id: 's1', faction: 'US', cls: 'infantry', war: { number: war.number, id: b.id } } });
    assert.match((await late.next((m) => m.k === 'x')).why, /over/);

    // A new war from the admin page.
    const n = war.number;
    assert.equal((await as('Boss', 'war', { act: 'restart' })).body.war.number, n + 1);
  } finally {
    for (const c of open) c.ws.close();
    await srv.close();
  }
});
