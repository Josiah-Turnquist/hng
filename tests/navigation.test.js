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
