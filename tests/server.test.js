// The battle as a game server runs it: seeded, so the same seed plays out the
// same way, even with other battles run before it in the same program.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, step } from '../src/server/battle.js';

const state = (g) => g.soldiers.map((s) => `${s.id}:${s.alive ? 1 : 0}:${s.body.x.toFixed(4)},${s.body.z.toFixed(4)}:${s.health.toFixed(3)}`).join('|') + `#${g.stats.kills}`;

async function run(seed) {
  const g = await makeBattle({ perSide: 6, seed });
  const out = [];
  for (let i = 0; i < 3; i++) {
    step(g, 10);
    out.push(state(g));
  }
  return out;
}

test('a battle plays out the same for the same seed, and differently for another', async () => {
  const a = await run(42);
  const b = await run(42);
  const c = await run(43);
  assert.deepEqual(b, a);
  assert.notDeepEqual(c, a);
});
