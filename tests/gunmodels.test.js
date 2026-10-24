// Every gun model builds at all three levels of detail, keeps the same moving parts
// and anchors at each level, stays within its triangle budget, and copies of the
// same gun share their geometry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MODELS, buildGun } from '../src/weapons/models/index.js';

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

// Budgets: first person, soldiers nearby, soldiers far away.
const BUDGET = [60000, 6500, 1300];

for (const id of Object.keys(MODELS)) {
  test(`${id}: builds at every LOD within budget, same parts and anchors`, () => {
    const guns = [0, 1, 2].map((lod) => buildGun(id, mats, { lod }));
    guns.forEach((g, lod) => {
      const tris = triangles(g.root);
      assert.ok(tris > 0, `LOD ${lod} has geometry`);
      assert.ok(tris <= BUDGET[lod], `LOD ${lod}: ${tris} triangles > ${BUDGET[lod]}`);
      g.root.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), `LOD ${lod}: bad vertex in ${o.parent?.name}`);
      });
    });
    const names = (g) => Object.keys(g.parts).sort().join();
    const anchors = (g) => Object.keys(g.anchors).sort().join();
    assert.equal(names(guns[1]), names(guns[0]), 'LOD 1 parts');
    assert.equal(names(guns[2]), names(guns[0]), 'LOD 2 parts');
    assert.equal(anchors(guns[1]), anchors(guns[0]), 'LOD 1 anchors');
    assert.equal(anchors(guns[2]), anchors(guns[0]), 'LOD 2 anchors');
    // Anchors are the same points at every LOD (the sights must not move).
    for (const [k, v] of Object.entries(guns[0].anchors)) assert.ok(v.distanceTo(guns[2].anchors[k]) < 1e-9, `anchor ${k} moved`);
  });
}

test('copies of a gun share geometry but not transforms', () => {
  const a = buildGun('kar98k', mats, { lod: 1 });
  const b = buildGun('kar98k', mats, { lod: 1 });
  const meshes = (g) => {
    const out = [];
    g.root.traverse((o) => o.isMesh && out.push(o));
    return out;
  };
  const ma = meshes(a),
    mb = meshes(b);
  assert.equal(ma.length, mb.length);
  ma.forEach((m, i) => assert.equal(m.geometry, mb[i].geometry));
  assert.notEqual(a.parts.bolt, b.parts.bolt);
  a.parts.bolt.position.z += 0.05;
  assert.notEqual(a.parts.bolt.position.z, b.parts.bolt.position.z);
  a.anchors.muzzle.z += 1;
  assert.notEqual(a.anchors.muzzle.z, b.anchors.muzzle.z);
});
