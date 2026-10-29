// Bot tactics in the real town: finding cover to fight from, making for it
// when an enemy shows up, holding posts on an objective, and bandaging.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, step, DEF } from './helpers/battle.js';
import { findCover, hiddenAt, seesFrom } from '../src/ai/tactics.js';

const g = await makeBattle({ perSide: 4, seed: 5 });
const coll = g.world.collision;
const ground = (x, z) => g.world.hf.getHeight(x, z);

// Somewhere in town with an enemy 35 m off where there is cover to be had.
function coverCase() {
  for (const p of g.mode.points.filter((q) => q.kind !== 'access')) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const at = g.nav.nearestWalkable(p.x + Math.cos(a) * 6, p.z + Math.sin(a) * 6);
      if (at < 0) continue;
      const x = g.nav.cellX(at),
        z = g.nav.cellZ(at);
      const tx = x + Math.cos(a) * 35,
        tz = z + Math.sin(a) * 35;
      const threat = { x: tx, y: ground(tx, tz) + 1.6, z: tz };
      const spot = findCover(g, { body: { x, z } }, threat, { radius: 14 });
      if (spot) return { x, z, threat, spot };
    }
  }
  return null;
}

test('the points to make for: attackers the next point of each line, defenders those under threat', () => {
  const att = g.mode.activePoints(1 - DEF);
  const def = g.mode.activePoints(DEF);
  // At the start the attackers hold the access points (A1..E1): the second point of every line is next.
  assert.deepEqual(att.map((a) => `${a.role} ${a.p.id}`).sort(), ['attack A2', 'attack B2', 'attack C2', 'attack D2', 'attack E2']);
  assert.deepEqual(def.map((a) => `${a.role} ${a.p.id}`).sort(), ['defend A2', 'defend B2', 'defend C2', 'defend D2', 'defend E2']);
  // The one to make for is the nearest.
  const c2 = g.mode.byId.C2;
  assert.equal(g.mode.suggestedPoint(1 - DEF, c2.x + 20, c2.z).p.id, 'C2');
  // Taken: the next one along the line becomes the attackers' target, and the defenders' to retake.
  const b2 = g.mode.byId.B2;
  const keep = { owner: b2.owner, c: b2.c };
  b2.owner = 1 - DEF;
  b2.c = -1;
  assert.ok(g.mode.activePoints(1 - DEF).some((a) => a.p.id === 'B3' && a.role === 'attack'));
  assert.ok(g.mode.activePoints(DEF).some((a) => a.p.id === 'B2' && a.role === 'attack'));
  assert.ok(g.mode.activePoints(DEF).some((a) => a.p.id === 'B3' && a.role === 'defend'));
  Object.assign(b2, keep);
});

test('the dead come back all along the front, where their side is thinnest', () => {
  const ATT = 1 - DEF;
  const keep = g.soldiers.map((s) => ({ s, alive: s.alive, x: s.body.x, z: s.body.z }));
  for (const s of g.soldiers) s.alive = false;
  const bot = g.soldiers.find((s) => s.brain && s.team === ATT);
  const pts = g.mode._spawnPoints(ATT);
  const seen = new Set();
  for (let i = 0; i < 80; i++) seen.add(g.mode._botSpawnPoint(bot, pts).id);
  for (const id of ['A1', 'B1', 'C1', 'D1', 'E1']) assert.ok(seen.has(id), `someone comes back at ${id} (${[...seen]})`);
  // Plenty of his side already at A1: he comes back somewhere else.
  const a1 = g.mode.byId.A1;
  const crowd = g.soldiers.filter((s) => s.team === ATT && s !== bot).slice(0, 4);
  for (const s of crowd) {
    s.alive = true;
    s.body.x = a1.x;
    s.body.z = a1.z;
  }
  let atA1 = 0;
  for (let i = 0; i < 80; i++) if (g.mode._botSpawnPoint(bot, pts).id === 'A1') atA1++;
  assert.ok(atA1 < 8, `came back at the crowded point ${atA1} times in 80`);
  for (const k of keep) Object.assign(k.s, { alive: k.alive }) && Object.assign(k.s.body, { x: k.x, z: k.z });
});

test('defenders come back where the attack presses, and only enemies on a point close it', () => {
  const ATT = 1 - DEF;
  const keep = g.soldiers.map((s) => ({ s, alive: s.alive, x: s.body.x, z: s.body.z }));
  const keepT = g.mode.points.map((p) => [...p.threat]);
  for (const s of g.soldiers) s.alive = false;
  const bot = g.soldiers.find((s) => s.brain && s.team === DEF);
  // Five attackers 50 m short of C2: it stays open for the defenders, and they go there.
  const c2 = g.mode.byId.C2;
  const pushing = g.soldiers.filter((s) => s.team === ATT).slice(0, 5);
  for (const s of pushing) {
    s.alive = true;
    s.body.x = c2.x + 50;
    s.body.z = c2.z;
  }
  g.mode.update(0);
  const pts = g.mode._spawnPoints(DEF);
  assert.ok(pts.some((p) => p.id === 'C2'), `C2 open with the enemy 50 m off (${pts.map((p) => p.id)})`);
  let atC2 = 0;
  for (let i = 0; i < 40; i++) if (g.mode._botSpawnPoint(bot, pts).id === 'C2') atC2++;
  assert.ok(atC2 > 30, `came back at the pressed point ${atC2} times in 40`);
  // One of them on the point: closed.
  pushing[0].body.x = c2.x;
  g.mode.update(0);
  assert.ok(!g.mode._spawnPoints(DEF).some((p) => p.id === 'C2'), 'C2 closed with an enemy on it');
  for (const k of keep) Object.assign(k.s, { alive: k.alive }) && Object.assign(k.s.body, { x: k.x, z: k.z });
  g.mode.points.forEach((p, i) => (p.threat = keepT[i]));
});

test('cover hides a soldier from the enemy when he is down and lets him see out when he is up', () => {
  let n = 0;
  for (const p of g.mode.points.filter((q) => q.kind !== 'access'))
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.3;
      const tx = p.x + Math.cos(a) * 40,
        tz = p.z + Math.sin(a) * 40;
      const threat = { x: tx, y: ground(tx, tz) + 1.6, z: tz };
      const c = findCover(g, { body: { x: p.x, z: p.z } }, threat, { radius: 14 });
      if (!c) continue;
      n++;
      assert.ok(Math.hypot(c.x - p.x, c.z - p.z) <= 14.01, 'within reach');
      assert.ok(hiddenAt(coll, threat, c.x, c.y, c.z, c.low), 'hidden when down');
      assert.ok(seesFrom(coll, c.x, c.y, c.z, c.high, threat, c.lean), 'sees out when up');
    }
  assert.ok(n >= 4, `cover found ${n} times round the points in town`);
});

test('a bot that spots an enemy close by makes for cover and fights from it', () => {
  const c = coverCase();
  assert.ok(c, 'a place in town with cover');
  // Just the two of them: nobody else spawns.
  for (const s of g.soldiers) {
    s.alive = false;
    s.respawnT = 1e9;
    s.deathTime = 0;
  }
  const bot = g.soldiers.find((s) => s.brain && s.team === DEF);
  const foe = g.soldiers.find((s) => s.team !== DEF && s !== g.player.soldier);
  g.mode.spawnSoldier(bot, g.mode.points[0]);
  g.mode.spawnSoldier(foe, g.mode.points[0]);
  bot.respawnT = foe.respawnT = 1e9;
  bot.body.x = c.x;
  bot.body.z = c.z;
  bot.body.y = ground(c.x, c.z);
  foe.body.x = c.threat.x;
  foe.body.z = c.threat.z;
  foe.body.y = ground(c.threat.x, c.threat.z);
  foe.brain = null; // stands there
  // (Whatever happens, the test is about where he goes: neither falls, so the
  // fight goes on.)
  bot.health = 1e6;
  foe.health = 1e6;
  const br = bot.brain;
  br.aware.set(foe, 1);
  br.lastSeen.set(foe, { x: foe.body.x, y: foe.body.y, z: foe.body.z, t: g.time, visible: true });
  br.target = foe;
  let inCover = 0;
  step(g, 8, 1 / 60, (g2, t) => {
    if (Math.round(t * 60) % 15 === 0 && br.cover && br._atCover()) inCover++;
  });
  assert.ok(br.cover || inCover, 'chose cover');
  assert.ok(inCover > 4, `reached it and stayed (${inCover} of 32 samples)`);
});

test('a bot holding an objective takes a post on it, and a bleeding bot out of the fight bandages', () => {
  const bot = g.soldiers.find((s) => s.brain && s.team === DEF);
  const obj = g.mode.points.find((p) => p.kind === 'objective');
  g.mode.spawnSoldier(bot, obj);
  bot.respawnT = 1e9;
  bot.health = 100;
  for (const s of g.soldiers) if (s !== bot) s.alive = false;
  const br = bot.brain;
  br.target = null;
  br.aware.clear();
  br.hunt = null;
  br.goal = null;
  // Once he knows which point he holds, put him on it.
  step(g, 1, 1 / 60);
  assert.ok(br.goal, 'has a point to hold');
  const at = g.nav.nearestWalkable(br.goal.x, br.goal.z);
  bot.body.x = g.nav.cellX(at);
  bot.body.z = g.nav.cellZ(at);
  bot.body.y = ground(bot.body.x, bot.body.z);
  br.path = null;
  // (Posts in the open are changed every few seconds: count the time spent at one.)
  let atPost = 0;
  step(g, 15, 1 / 60, () => {
    if (br.watch && Math.hypot(bot.body.x - br.watch.x, bot.body.z - br.watch.z) < 1.2) atPost += 1 / 60;
  });
  assert.ok(br.watch, 'took a post');
  assert.ok(atPost > 3, `and stood at it (${atPost.toFixed(1)} of 15 s)`);
  // Hit: bleeding, nobody in sight.
  const bandages = bot.bandages;
  bot.bleed = 1.2;
  bot.health = 70;
  step(g, 6, 1 / 60);
  assert.equal(bot.bleed, 0, 'bandaged');
  assert.equal(bot.bandages, bandages - 1);
  assert.ok(bot.alive);
});
