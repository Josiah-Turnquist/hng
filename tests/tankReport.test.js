// What a tank's crew is shown about their own tank (ui/tankReport.js): each
// part marked as it is damaged or put out of action, once. (A broken track
// used to be one line of small print in a corner of the screen.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { TANK_PARTS, partLevel, tankNews } from '../src/ui/tankReport.js';
import { makeBattle } from './helpers/battle.js';

test('a broken track is marked on its own side, once', () => {
  const m = { engine: 1, transmission: 1, trackL: 1, trackR: 1, turret: 1, gun: 1, fuel: 1, ammo: 1 };
  // Climbing in: nothing said, whatever state the tank is in.
  let seen = tankNews({ ...m, trackR: 0 });
  assert.deepEqual(seen.worse, []);
  assert.equal(seen.levels.trackR, 2);
  seen = tankNews(m);
  m.trackL = 0;
  let news = tankNews(m, seen.levels);
  assert.deepEqual(news.worse.map((w) => w.part), ['trackL']);
  assert.equal(news.levels.trackL, 2);
  assert.equal(news.levels.trackR, 0);
  // Not said again while it stays broken.
  assert.deepEqual(tankNews(m, news.levels).worse, []);
  // The engine: damaged, then destroyed, each told as it happens.
  m.engine = 0.5;
  news = tankNews(m, news.levels);
  assert.deepEqual(news.worse.map((w) => [w.part, w.level]), [['engine', 1]]);
  m.engine = 0;
  m.trackR = 0;
  news = tankNews(m, news.levels);
  assert.deepEqual(news.worse.map((w) => w.part).sort(), ['engine', 'trackR']);
  // Mended: nothing said, and it can be told again later.
  m.trackL = 1;
  news = tankNews(m, news.levels);
  assert.deepEqual(news.worse, []);
  assert.equal(news.levels.trackL, 0);
});

test('every part on the picture is a part real tanks have', async () => {
  assert.equal(partLevel({ gun: 0.4 }, 'gun'), 1);
  const g = await makeBattle({ perSide: 1, vehicles: false, seed: 2 });
  const v = g.spawnVehicle('m4a1_sherman', 0, 0, 0);
  for (const part of TANK_PARTS) assert.equal(v.modules[part], 1, `a Sherman has a ${part}`);
  // The picture places the engine and the gearbox where the tank has them.
  for (const name of ['engine', 'transmission']) assert.ok(v.internals.some((x) => x.name === name), name);
});
