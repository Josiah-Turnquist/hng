// Leaves are never a wall in the collision world: sight lines through them are
// measured instead. Thin leaves (tree crowns) make the bots slower to spot
// someone behind them; thick bushes and hedges, which nobody can see through on
// the screen either, hide him beyond a few meters. Earth banks block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from './helpers/battle.js';
import { FLAG_SIGHT, FLAG_FOLIAGE, FLAG_SOLID } from '../src/physics/collision.js';
import { leavesBetween } from '../src/ai/tactics.js';

const g = await makeBattle({ perSide: 2 });
const coll = g.world.collision;

// A point on either side of a box, across its thin horizontal axis, at height y.
function across(b, y, reach) {
  const thin = b.hx < b.hz ? b.ax : b.az;
  return [
    [b.cx - thin[0] * reach, y, b.cz - thin[2] * reach],
    [b.cx + thin[0] * reach, y, b.cz + thin[2] * reach],
  ];
}

test('leaves never block sight; they are measured as cover instead', () => {
  const leafy = coll.boxes.filter((b) => b.material === 'foliage');
  assert.ok(leafy.length > 1000, `only ${leafy.length} foliage boxes`);
  for (const b of leafy) assert.equal(b.flags & FLAG_SIGHT, 0, 'a foliage box still blocks sight');
  // Hedges, bushes and tree crowns all count as cover.
  assert.ok(leafy.filter((b) => b.flags & FLAG_FOLIAGE).length > 0.99 * leafy.length);
});

test('a hedge is about a meter of leaves to look through, above a solid bank', () => {
  // Hedge tops: solid leafy boxes standing on an earth bank, upright.
  const hedges = coll.boxes.filter((b) => b.material === 'foliage' && b.flags & FLAG_SOLID && Math.abs(b.roll) < 0.02 && Math.abs(b.pitch) < 0.02 && Math.max(b.hx, b.hz) > 1.5);
  assert.ok(hedges.length > 50);
  let tested = 0;
  for (const b of hedges.slice(0, 40)) {
    const y = b.cy + b.hy * 0.4;
    const [p, q] = across(b, y, Math.min(b.hx, b.hz) + 2.5);
    // Other hedges, trees or houses may stand in the way; only test clean views.
    if (!coll.lineOfSight(p[0], p[1], p[2], q[0], q[1], q[2])) continue;
    const leaves = coll.foliageAlong(p[0], p[1], p[2], q[0], q[1], q[2]);
    assert.ok(leaves > 0.5 && leaves < 3, `${leaves.toFixed(2)} m of leaves through a hedge`);
    tested++;
  }
  assert.ok(tested >= 10, `only ${tested} hedges had a clean view`);
  // The bank under a hedge is solid earth: low down, the hedge does block sight.
  const banks = coll.boxes.filter((b) => b.material === 'soil' && b.flags & FLAG_SIGHT);
  assert.ok(banks.length > 50);
  let blocked = 0;
  for (const b of banks.slice(0, 40)) {
    const [p, q] = across(b, b.cy + b.hy * 0.5, Math.min(b.hx, b.hz) + 2);
    if (!coll.lineOfSight(p[0], p[1], p[2], q[0], q[1], q[2])) blocked++;
  }
  assert.ok(blocked >= 35, `the bank blocked only ${blocked} of 40 low sight lines`);
});

test('bushes and hedges are thick (they hide a man beyond a few meters), tree crowns thin', () => {
  const leafy = coll.boxes.filter((b) => b.flags & FLAG_FOLIAGE);
  const hedges = leafy.filter((b) => b.flags & FLAG_SOLID);
  assert.ok(hedges.length > 50 && hedges.every((b) => b.dense), 'hedges (and haystacks) are thick');
  // Bushes stand on the ground; crowns are high up and wide.
  const bushes = leafy.filter((b) => !(b.flags & FLAG_SOLID) && b.dense);
  assert.ok(bushes.length > 1000, `${bushes.length} bushes`);
  const crowns = leafy.filter((b) => !b.dense);
  assert.ok(crowns.length > 200, `${crowns.length} tree crowns`);
  // Across a hedge: hidden from a bot 20 m off, not from one 6 m off.
  let tested = 0;
  for (const b of hedges.filter((h) => Math.max(h.hx, h.hz) > 3).slice(0, 60)) {
    const y = b.cy + b.hy * 0.4;
    const thin = b.hx < b.hz ? b.ax : b.az;
    const r = Math.min(b.hx, b.hz);
    const at = (k) => [b.cx + thin[0] * k, y, b.cz + thin[2] * k];
    const far = at(20),
      near = at(5),
      man = at(-r - 0.8);
    if (!coll.lineOfSight(...far, ...man) || !coll.lineOfSight(...near, ...man)) continue;
    assert.ok(leavesBetween(coll, ...far, ...man).hides, 'seen through a hedge from 20 m');
    assert.ok(!leavesBetween(coll, ...near, ...man).hides, 'hidden behind a hedge from 6 m');
    tested++;
  }
  assert.ok(tested >= 10, `only ${tested} hedges had a clean view`);
});

test('open ground has no leaves in the way', () => {
  assert.equal(coll.foliageAlong(0, 50, 0, 10, 50, 10), 0);
});
