// A gun finish's textures are painted when the first gun to be drawn in it is
// built, not when the set of materials is made (weapons/models/materials.js):
// some thirty finishes at 4 MB each were all painted for every battle, which
// shows a handful.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// (The stamped markings and the perforated jackets draw on a canvas.)
const ctx = new Proxy({}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k.startsWith?.('create') ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const { makeGunMaterials } = await import('../src/weapons/models/materials.js');
const { buildGun } = await import('../src/weapons/models/index.js');

test('finishes are painted as guns that show them are built', () => {
  const painted = [];
  const lib = {
    worldOf: () => 0.15,
    get: (name) => {
      painted.push(name);
      return { map: new THREE.Texture(), normalMap: new THREE.Texture(), ormMap: new THREE.Texture(), world: 0.15 };
    },
  };
  const mats = makeGunMaterials(lib);
  assert.ok(Object.keys(mats).length > 30);
  assert.deepEqual(painted, [], 'nothing painted for making the set');
  for (const m of Object.values(mats)) assert.ok(m.userData.texWorld > 0 && m.userData.lowColor, `${m.name} has what a far gun needs`);
  // A far gun is one flat material: no finish is painted for it.
  buildGun('m1_garand', mats, { lod: 2 });
  assert.deepEqual(painted, []);
  // A near one paints its own finishes, once.
  buildGun('m1_garand', mats, { lod: 1 });
  const garand = painted.slice();
  assert.ok(garand.length >= 2 && garand.length <= 6, `a Garand shows ${garand.join(', ')}`);
  assert.ok(mats.walnut.map && mats.walnut.normalMap && mats.walnut.roughnessMap && mats.walnut.metalnessMap, 'its wood has its maps');
  buildGun('m1_garand', mats, { lod: 0 });
  assert.deepEqual(painted, garand, 'not painted again');
  // Another army's rifle adds what it alone shows.
  buildGun('kar98k', mats, { lod: 1 });
  assert.ok(painted.length > garand.length && painted.length < 12, `with a Kar98k: ${painted.join(', ')}`);
  assert.equal(mats.bakelite.map, null, 'a finish no gun here has stays unpainted');
  // A mesh that reaches the screen in an unpainted finish by another road is painted as it is drawn.
  mats.bakelite.onBeforeRender();
  assert.ok(mats.bakelite.map, 'painted on first drawing');
  assert.equal(painted.at(-1), 'gunBakelite');
});
