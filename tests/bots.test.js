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
  bot.health = 1e6; // (whatever happens, the test is about where he goes)
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
