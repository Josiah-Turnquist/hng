// Route grids on the town map, with the village, trees and hedges in place:
// soldiers must be able to reach every capture point from every other, and
// tanks must be able to cross the river on the stone bridges.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, step } from './helpers/battle.js';

const g = await makeBattle({ perSide: 2 });

// The connected area a search from (x, z) would start in.
function areaOf(nav, x, z) {
  const w = nav.nearestWalkable(x, z);
  return w >= 0 ? nav.comp[w] : `blocked at ${x},${z}`;
}

test('soldiers can reach every capture point', () => {
  const areas = new Set(g.mode.points.map((p) => areaOf(g.nav, p.x, p.z)));
  assert.equal(areas.size, 1, `capture points split over ${areas.size} unconnected areas`);
});

test('tanks can reach the capture points on both sides of the river', () => {
  // The church (O2) stands in a square closed in by houses; tanks stop short of it.
  const pts = g.mode.points.filter((p) => p.id !== 'O2');
  const areas = new Set(pts.map((p) => areaOf(g.vnav, p.x, p.z)));
  assert.equal(areas.size, 1, `capture points split over ${areas.size} unconnected areas`);
  // And a route across the south stone bridge exists and is found.
  const p = g.vnav.findPath(75, 235, 100, 500, 120000);
  assert.ok(p, 'no tank route over the south bridge');
});

test('a search between unconnected areas gives up at once', () => {
  const nav = g.vnav;
  // Find a small pocket and a cell of the main area.
  let pocket = -1;
  for (let i = 0; i < nav.comp.length && pocket < 0; i++) if (nav.cost[i] && nav.compSize[nav.comp[i]] < 200) pocket = i;
  assert.ok(pocket >= 0);
  const t = performance.now();
  const r = nav.findPath(nav.cellX(pocket), nav.cellZ(pocket), 100, 500, 120000);
  assert.equal(r, null);
  assert.equal(nav.lastFail, 'apart');
  assert.ok(performance.now() - t < 5);
});

test('bots in the woods and hedgerows keep moving', () => {
  step(g, 120, 1 / 60);
  const bots = g.soldiers.filter((s) => s.brain && s.alive && !s.vehicle);
  const stuck = bots.filter((s) => s.brain.stuckT > 2).length;
  assert.ok(stuck <= 1, `${stuck} bots stuck`);
});

// Routes worked out a little each step (findPathSoon, tick): the same routes
// as worked out all at once, however the askers and the grids are mixed. The
// bikes' grid shares its working data with the vehicles': their searches
// must take turns, or each scrambles the other's.
test('routes worked out a little each step are the same routes', async () => {
  const { bikeNav } = await import('../src/ai/riderBot.js');
  const bike = bikeNav(g);
  assert.ok(bike && bike.shared === g.vnav, 'the bike grid shares the vehicle grid');
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const asks = [];
  for (let i = 0; i < 24; i++) {
    const nav = [g.nav, g.vnav, bike][i % 3];
    asks.push({ who: { i }, nav, a: [(rnd() * 2 - 1) * 600, (rnd() * 2 - 1) * 600], b: [(rnd() * 2 - 1) * 600, (rnd() * 2 - 1) * 600], limit: i % 3 ? 120000 : 80000 });
  }
  const key = (p) => (p ? `${p.partial ? 'part ' : ''}${p.map((q) => `${q.x.toFixed(1)},${q.z.toFixed(1)}`).join(' ')}` : 'none');
  const want = asks.map((q) => key(q.nav.findPath(q.a[0], q.a[1], q.b[0], q.b[1], q.limit, { partial: true })));
  assert.ok(want.filter((w) => w !== 'none').length > 12, 'most of the routes exist');
  // All asked at once, then collected as they come.
  const got = new Array(asks.length);
  let ticks = 0,
    worst = 0;
  for (let left = asks.length; left > 0 && ticks < 6000; ticks++) {
    asks.forEach((q, i) => {
      if (got[i] !== undefined) return;
      const p = q.nav.findPathSoon(q.who, q.a[0], q.a[1], q.b[0], q.b[1], q.limit, { partial: true });
      if (p === undefined) return;
      got[i] = key(p);
      left--;
    });
    const t = performance.now();
    g.nav.tick();
    g.vnav.tick();
    worst = Math.max(worst, performance.now() - t);
  }
  assert.deepEqual(got, want);
  // (Spread over many steps, none of them long.)
  assert.ok(ticks > 40, `${ticks} steps`);
  assert.ok(worst < 30, `longest step ${worst.toFixed(1)} ms`);
  // A search all at once while others are part way: they start again and still come out right.
  const q = asks[1];
  assert.equal(q.nav.findPathSoon(q.who, q.a[0], q.a[1], q.b[0], q.b[1], q.limit, { partial: true }), undefined);
  g.vnav.tick();
  const now = key(asks[4].nav.findPath(asks[4].a[0], asks[4].a[1], asks[4].b[0], asks[4].b[1], asks[4].limit, { partial: true }));
  assert.equal(now, want[4]);
  let late;
  for (let i = 0; i < 3000 && late === undefined; i++) {
    g.vnav.tick();
    late = q.nav.findPathSoon(q.who, q.a[0], q.a[1], q.b[0], q.b[1], q.limit, { partial: true });
  }
  assert.equal(key(late), want[1]);
});
