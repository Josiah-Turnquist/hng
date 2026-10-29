// Every upgrade and round a gun takes has a part, made for that gun, that builds
// with geometry; the parts follow the gun's size and tell their variants apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GUN_UPGRADES, upgradesOf } from '../src/weapons/upgrades.js';
import { partOf, partKey, buildPart } from '../src/weapons/models/upgradeParts.js';

const made = {};
const mats = new Proxy(made, {
  get: (t, k) => {
    if (!t[k]) {
      t[k] = new THREE.MeshStandardMaterial();
      t[k].userData.texWorld = 0.3;
      t[k].userData.lowColor = [0.1, 0.1, 0.1];
    }
    return t[k];
  },
});

function triangles(root) {
  let n = 0;
  root.traverse((o) => {
    if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  return n;
}

const built = new Set();
for (const gun of Object.keys(GUN_UPGRADES)) {
  test(`${gun}: every upgrade and round has a part that builds`, () => {
    const list = upgradesOf(gun);
    assert.ok(list.length > 0, 'takes upgrades');
    for (const u of list) {
      const part = partOf(gun, u.id);
      assert.ok(part?.model, `${u.id} ${u.name}: no part`);
      const key = partKey(part);
      if (built.has(key)) continue;
      const { root } = buildPart(part, mats, { lod: 0 });
      assert.ok(triangles(root) > 0, `${u.id} ${u.name}: no geometry`);
      root.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), `${u.id} ${u.name}: bad vertex`);
      });
      built.add(key);
    }
  });
}

const size = (gun, id) => {
  const { root } = buildPart(partOf(gun, id), mats, { lod: 0 });
  return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
};

test('parts are made to the size of their gun', () => {
  assert.ok(size('m1911a1', 'u27').z < size('mg42', 'u86').z, 'pistol spring < MG spring');
  assert.ok(size('m1911a1', 'u29').z < size('kar98k', 'u60').z / 3, 'pistol barrel < rifle barrel');
  assert.ok(size('m1911a1', 'u25').x < size('kar98k', 'u50').x, 'pistol slide < rifle bolt (across, with its handle)');
  assert.ok(size('p38', 'a12').z < size('kar98k', 'a24').z / 2, 'pistol round < rifle round');
  assert.ok(size('ptrd41', 'a48').z > size('kar98k', 'a24').z * 1.8, 'the 14.5 mm round is the biggest');
});

test('every variant is its own part; scopes of a family share a body', () => {
  for (const gun of ['kar98k', 'm1903', 'mosin_9130', 'm1911a1', 'mp40', 'fg42', 'm1_garand']) {
    const list = upgradesOf(gun);
    const keys = new Set(list.map((u) => partKey(partOf(gun, u.id))));
    const families = new Set(list.filter((u) => u.family).map((u) => u.family));
    assert.equal(keys.size, list.filter((u) => !u.family).length + families.size, gun);
  }
  assert.ok(partOf('m1_garand', 'u44').wire > partOf('m1_garand', 'u43').wire, 'heavy spring has thicker wire');
});
