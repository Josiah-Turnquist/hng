// A vehicle that hits a tree stops against it and is damaged; it isn't thrown
// into the air (a trunk is no ground for its wheels, and pushes straight
// back: vegetation/colliders.js TRUNK, vehicle.js) and doesn't end up inside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeBattle, step } from '../src/server/battle.js';
import { sphereBox } from '../src/vehicles/vehicle.js';

test('vehicles driven hard into trees stop against them, damaged, on the ground', async () => {
  const g = await makeBattle({ perSide: 0, seed: 4 });
  const hf = g.world.hf;
  const all = [];
  g.world.collision.query(-900, -50, -900, 900, 400, 900, all);
  const trees = all.filter((b) => b.tree && b.hx < 1.2);
  let n = 0,
    lift = 0,
    into = 0,
    damaged = 0,
    runs = 0;
  const p = new THREE.Vector3(),
    nrm = new THREE.Vector3();
  for (const tree of trees) {
    if (n >= 12) break;
    if (Math.abs(hf.getHeight(tree.cx, tree.cz + 20) - hf.getHeight(tree.cx, tree.cz)) > 2) continue;
    if (all.some((o) => o !== tree && Math.abs(o.cx - tree.cx) < 4 && o.cz > tree.cz + 1 && o.cz < tree.cz + 22)) continue;
    n++;
    for (const [id, speed, off] of [['willys_mb', 24, 0], ['opel_blitz', 22, 0.4]]) {
      const v = g.spawnVehicle(id, tree.cx + off, tree.cz + 20, 0); // facing -z, at the tree
      v.body.velocity.set(0, 0, -speed);
      const hp0 = v.hp;
      for (let i = 0; i < 150; i++) {
        v.driverInput(1, 0, false);
        step(g, 1 / 60);
        lift = Math.max(lift, v.body.position.y - hf.getHeight(v.body.position.x, v.body.position.z));
        for (const s of v.samples) into = Math.max(into, sphereBox(p.copy(s.p).applyQuaternion(v.body.quaternion).add(v.body.position), s.r, tree, nrm));
      }
      runs++;
      if (v.hp < hp0) damaged++;
      v.removeFromWorld();
      g.vehicles.splice(g.vehicles.indexOf(v), 1);
    }
  }
  assert.ok(n >= 8, 'trees to drive into');
  assert.ok(lift < 2, `stayed on the ground (highest ${lift.toFixed(2)} m)`);
  assert.ok(into < 0.5, `stopped at the trunk (at most ${into.toFixed(2)} m into it)`);
  assert.ok(damaged >= runs - 1, `damaged in ${damaged} of ${runs} crashes`);
});
