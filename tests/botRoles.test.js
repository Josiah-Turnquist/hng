// Bots fight as their class does: infantry press on and hold ground, scouts
// support from an overwatch post well back from the objective.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, step, ATT } from './helpers/battle.js';
import { seesFrom, findOverwatch } from '../src/ai/tactics.js';
import { STANCE } from '../src/actors/body.js';

const g = await makeBattle({ perSide: 8, seed: 7 });
const ground = (x, z) => g.world.hf.getHeight(x, z);

test('infantry move up in shorter bounds and push through more fire than scouts', () => {
  const inf = g.soldiers.find((s) => s.brain && s.cls === 'infantry').brain;
  const rec = g.soldiers.find((s) => s.brain && s.cls === 'recon').brain;
  assert.ok(inf.style.bound[1] <= rec.style.bound[0], 'shorter bounds');
  assert.ok(inf.style.pinned > rec.style.pinned, 'harder to pin down');
  assert.ok(inf.style.pushCover < rec.style.pushCover, 'stops for cover only from enemies close by');
  assert.ok(inf.style.huntAfter < 4 && rec.style.huntAfter === Infinity, 'infantry go after a vanished enemy; scouts keep their post');
  for (let k = 0; k < 20; k++) {
    const t = inf._boundTime();
    assert.ok(t >= 3 && t <= 6, `bound ${t}`);
  }
});

test('an overwatch post is well back from the objective and sees it', () => {
  const p = g.mode.points.find((q) => q.kind !== 'access');
  const scout = g.soldiers.find((s) => s.brain && s.cls === 'recon');
  let found = 0;
  for (let k = 0; k < 6; k++) {
    const post = findOverwatch(g, scout, p, { near: 80, far: 200, from: { x: p.x + 200, z: p.z } });
    if (!post) continue;
    found++;
    const d = Math.hypot(post.x - p.x, post.z - p.z);
    assert.ok(d >= 40 && d <= 201, `${d.toFixed(0)} m off`);
    // It sees some of the point: its middle or a spot across it.
    const rg = p.radius * 0.6;
    const looks = [[0, 0], [rg, 0], [-rg, 0], [0, rg], [0, -rg], [rg * 0.5, rg * 0.87], [-rg * 0.5, rg * 0.87], [rg * 0.5, -rg * 0.87], [-rg * 0.5, -rg * 0.87]];
    assert.ok(looks.some(([dx, dz]) => seesFrom(g.world.collision, post.x, post.y, post.z, post.low, { x: p.x + dx, y: ground(p.x + dx, p.z + dz) + 1.2, z: p.z + dz })), 'sees some of the point');
  }
  assert.ok(found >= 3, `found posts (${found} of 6)`);
});

test('a scout makes for his post, lies or crouches there facing the point, and never goes onto it', () => {
  const scout = g.soldiers.find((s) => s.brain && s.cls === 'recon' && s.team === ATT);
  const br = scout.brain;
  // Everyone else out of the way: no fight to distract him.
  for (const s of g.soldiers) if (s !== scout) {
    s.alive = false;
    s.respawnT = 1e9;
  }
  const goal = g.mode.points.find((q) => g.mode.capturable(q, ATT));
  // Start him 250 m from it on open ground.
  let at = -1;
  for (let k = 0; k < 16 && at < 0; k++) {
    const a = (k / 16) * Math.PI * 2;
    const i = g.nav.nearestWalkable(goal.x + Math.cos(a) * 250, goal.z + Math.sin(a) * 250);
    if (i >= 0 && Math.hypot(g.nav.cellX(i) - goal.x, g.nav.cellZ(i) - goal.z) > 200) at = i;
  }
  assert.ok(at >= 0);
  g.mode.spawnSoldier(scout, goal);
  scout.respawnT = 1e9;
  scout.body.x = g.nav.cellX(at);
  scout.body.z = g.nav.cellZ(at);
  scout.body.y = ground(scout.body.x, scout.body.z);
  br.newLife();
  br.goal = null;
  let inGoal = 0,
    atPost = 0;
  step(g, 90, 1 / 30, () => {
    if (br.goal && Math.hypot(scout.body.x - br.goal.x, scout.body.z - br.goal.z) < br.goal.radius * 0.85) inGoal++;
    if (br.post && br._atPost()) atPost += 1 / 30;
  });
  assert.ok(br.goal, 'has a point to support');
  assert.ok(br.post, 'took a post');
  const d = Math.hypot(br.post.x - br.goal.x, br.post.z - br.goal.z);
  assert.ok(d >= 40, `post ${d.toFixed(0)} m from the point`);
  assert.ok(atPost > 10, `stayed at his post (${atPost.toFixed(0)} s)`);
  assert.equal(inGoal, 0, 'never went onto the point');
  if (br._atPost()) assert.ok([STANCE.PRONE, STANCE.CROUCH].includes(scout.body.targetStance), 'down on his post');
});
