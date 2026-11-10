// How the tanks look (src/vehicles/weather.js, models/markings.js): field
// wear painted from where each point is on the vehicle, and national markings
// laid on the hull and turret.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildVehicle, instanceVehicle } from '../src/vehicles/models/index.js';
import { charModel } from '../src/vehicles/effects.js';

const textures = () => ({ standard: () => new THREE.MeshStandardMaterial(), get: () => ({}) });
const TANKS = { m4a1_sherman: ['star', 4], m5a1_stuart: ['star', 4], panzer4_h: ['cross', 2], tiger1: ['cross', 2], t34_76: ['redStar', 2], t34_85: ['redStar', 2] };

test('every mesh of a vehicle knows where its points are on the vehicle, for its field wear', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const id of [...Object.keys(TANKS), 'willys_mb', 'opel_blitz']) {
      const v = buildVehicle(id, textures());
      const box = new THREE.Box3().setFromObject(v.root);
      let meshes = 0;
      v.root.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        const a = o.geometry.attributes.aModel;
        assert.ok(a && a.itemSize === 4 && a.count === o.geometry.attributes.position.count, `${id}: ${o.name || 'a mesh'} has its places`);
        // (w = 2 marks them as baked; y is the height above the ground.)
        for (const i of [0, a.count >> 1, a.count - 1]) {
          assert.equal(a.getW(i), 2);
          assert.ok(a.getY(i) > box.min.y - 0.01 && a.getY(i) < box.max.y + 0.01, `${id}: a point ${a.getY(i).toFixed(2)} m up`);
        }
      });
      assert.ok(meshes > 5);
      // The paint carries the wear; a copy made for a damaged vehicle keeps it.
      const paint = Object.values(v.mats).find((m) => m.userData?.vehWeather === 'paint');
      assert.ok(paint, `${id}: a weathered paint`);
    }
  } finally {
    console.warn = warn;
  }
});

test('each tank carries its markings on both sides, laid on its own skin; a wreck burns them dark', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const [id, [kind, sides]] of Object.entries(TANKS)) {
      const v = buildVehicle(id, textures());
      const marks = [];
      v.root.traverse((o) => o.userData.marking && marks.push(o));
      assert.ok(marks.length >= 1, `${id}: marked`);
      let left = 0,
        right = 0;
      v.root.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      const half = v.meta.bounds.max[0];
      for (const m of marks) {
        assert.equal(m.material.name, `marking-${kind}`, id);
        const pos = m.geometry.attributes.position;
        assert.ok(pos.count >= 6, `${id}: ${pos.count / 3} triangles`);
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          // On a side of the tank, not floating off it nor sunk through to the middle.
          assert.ok(Math.abs(p.x) > 0.5 && Math.abs(p.x) < half + 0.02, `${id}: a marking at x ${p.x.toFixed(2)}`);
          if (p.x < 0) left++;
          else right++;
        }
      }
      assert.ok(left > 0 && right > 0, `${id}: on both sides (${left} and ${right} points)`);
      assert.ok(marks.length * 2 >= sides / 2, id);
      // A copy for the battle keeps them as markings; burnt out, they go nearly black.
      const copy = instanceVehicle(id, textures());
      const copied = [];
      copy.root.traverse((o) => o.userData.marking && copied.push(o));
      assert.equal(copied.length, marks.length, `${id}: the copy has them`);
      charModel({ model: copy, def: {}, game: null });
      for (const m of copied) assert.ok(m.material.color.r < 0.06, `${id}: a burnt marking at ${m.material.color.r.toFixed(2)}`);
    }
  } finally {
    console.warn = warn;
  }
});
