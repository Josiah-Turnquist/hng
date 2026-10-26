// Tree trunks: a bullet hits where the bark is, from any side, and its hole goes
// on the bark (not in the air beside the trunk, on a box standing in for it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from './helpers/battle.js';
import { RayHit, FLAG_BULLET } from '../src/physics/collision.js';
import { Game } from '../src/game/game.js';

const g = await makeBattle({ perSide: 1 });
const coll = g.world.collision;
const trunks = coll.boxes.filter((b) => b.trunk);

test('trunks are stacks of boxes along the trunk as drawn, each inside the bark', () => {
  assert.ok(trunks.length > 500, `${trunks.length} trunk pieces`);
  for (const b of trunks.slice(0, 2000)) {
    assert.ok(b.hx <= b.trunk.r && b.hz <= b.trunk.r, 'inside the bark');
    assert.ok(Math.hypot(b.cx - b.trunk.x, b.cz - b.trunk.z) < 1e-9);
  }
});

test('a shot at a trunk from any side strikes close to the bark, and its hole is put on it', () => {
  const hit = new RayHit();
  let n = 0,
    worst = 0;
  // Trunk pieces at chest height, shot at from eight directions (the box corners too).
  const chest = trunks.filter((b) => b.cy - b.hy < g.world.hf.getHeight(b.cx, b.cz) + 1.3 && b.cy + b.hy > g.world.hf.getHeight(b.cx, b.cz) + 1.3 && b.trunk.r > 0.12);
  for (const b of chest.slice(0, 60)) {
    const y = g.world.hf.getHeight(b.cx, b.cz) + 1.3;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const ox = b.cx + Math.cos(a) * 3,
        oz = b.cz + Math.sin(a) * 3;
      if (!coll.raycast(ox, y, oz, -Math.cos(a), 0, -Math.sin(a), 3.2, hit, FLAG_BULLET, true) || hit.box !== b) continue;
      const px = ox - Math.cos(a) * hit.t,
        pz = oz - Math.sin(a) * hit.t;
      // Where it struck, measured from the trunk's middle, against the bark's radius.
      const d = Math.hypot(px - b.trunk.x, pz - b.trunk.z) / b.trunk.r;
      worst = Math.max(worst, d);
      n++;
    }
  }
  assert.ok(n > 100, `${n} shots hit trunks`);
  assert.ok(worst < 1.2, `struck at most ${worst.toFixed(2)} of the bark's radius from the middle`);
  // The hole: moved onto the bark, facing out.
  const b = chest[0];
  const holes = [];
  const fake = Object.create(Game.prototype);
  Object.assign(fake, { effects: { impact() {}, bulletHole: (...a) => holes.push(a) }, mode: {}, audio: null, player: { soldier: {} } });
  const info = { kind: 'enter', material: 'wood', box: b, x: b.cx + b.hx, y: b.cy, z: b.cz + b.hz, nx: 1, ny: 0, nz: 0, energy: 3000 };
  fake._onImpact({ ammo: { diameter: 0.0078 }, owner: null }, info);
  assert.equal(holes.length, 1);
  const [hx, , hz, nx, , nz] = holes[0];
  assert.ok(Math.abs(Math.hypot(hx - b.trunk.x, hz - b.trunk.z) - b.trunk.r) < 1e-6, 'on the bark');
  assert.ok(Math.abs(Math.hypot(nx, nz) - 1) < 1e-6, 'facing straight out');
});
