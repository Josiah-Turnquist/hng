// The aimed pose must put the eye, rear sight and front sight on one line, with
// the bore tilted up by exactly the zeroing angle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GunBuilder } from '../src/weapons/models/kit.js';
import { MODELS } from '../src/weapons/models/index.js';
import { Sighting } from '../src/weapons/sighting.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { Atmosphere } from '../src/ballistics/atmosphere.js';

const mat = new THREE.MeshStandardMaterial();
mat.userData.texWorld = 0.3;
const mats = new Proxy({}, { get: () => mat });

function aimed(id, rangeIndex) {
  const b = new GunBuilder(mats);
  MODELS[WEAPONS[id].model](b);
  const gun = b.build(id);
  const s = new Sighting(gun, WEAPONS[id], new Atmosphere(0, 15));
  s.setRangeIndex(rangeIndex);
  const q = new THREE.Quaternion().setFromUnitVectors(s.losDir, new THREE.Vector3(0, 0, -1));
  const pos = s.eye.clone().applyQuaternion(q).negate();
  const toCam = (p) => p.clone().applyQuaternion(q).add(pos);
  return { s, rear: toCam(s.rearNow), front: toCam(s.front), bore: new THREE.Vector3(0, 0, -1).applyQuaternion(q) };
}

for (const id of Object.keys(WEAPONS)) {
  const def = WEAPONS[id];
  if (def.type === 'grenade' || !MODELS[def.model] || def.sight.kind === 'scope' || def.sight.kind === 'post') continue;
  test(`${id}: sights line up with the eye and the bore is zeroed`, () => {
    const ranges = def.sight.ranges;
    for (const i of [0, Math.floor(ranges.length / 2), ranges.length - 1]) {
      const { s, rear, front, bore } = aimed(id, i);
      // Both sights on the camera's forward axis (x = y = 0).
      assert.ok(Math.hypot(rear.x, rear.y) < 1e-4, `rear sight off axis at ${ranges[i]}: ${rear.toArray()}`);
      assert.ok(Math.hypot(front.x, front.y) < 1e-4, `front sight off axis at ${ranges[i]}: ${front.toArray()}`);
      assert.ok(rear.z < 0 && front.z < rear.z, 'rear sight in front of the eye, front sight beyond it');
      if (s.sightKind === 'leaf' || s.sightKind === 'slide') {
        const elev = Math.asin(bore.y);
        assert.ok(Math.abs(elev - s.theta) < 2e-5, `bore elevation ${elev} vs ${s.theta} at ${ranges[i]}`);
      }
    }
  });
}
