// Scope upgrades (src/weapons/models/upgradeScopes.js): every rifle and scope
// pair the original game sold builds at every level of detail with the scope's
// anchors and magnification; SCOPE_MOUNTS and the models list the same pairs;
// clips are only blocked on rifles loaded from clips; where the iron sights
// stay usable, nothing of the scope or mount is in their way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MODELS, buildGun } from '../src/weapons/models/index.js';
import { SCOPE_MOUNTS, UPGRADE_MODELS } from '../src/weapons/models/upgradeScopes.js';
import { GunBuilder } from '../src/weapons/models/kit.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { Sighting } from '../src/weapons/sighting.js';
import { Atmosphere } from '../src/ballistics/atmosphere.js';

const PAIRS = {
  m1_garand: ['m73b1', 'm84'],
  m1_carbine: ['m73b1', 'm84'],
  m1a1_carbine: ['m73b1', 'm84'],
  m2_carbine: ['m73b1', 'm84'],
  m1903: ['m73b1', 'm84', 'unertl'],
  kar98k: ['zf39', 'zf4', 'zf41', 'zielacht'],
  gewehr43: ['zf4', 'zf41'],
  fg42: ['zf4'],
  stg44: ['zf4', 'zf41'],
  mosin_9130: ['pe', 'pu', 'zielacht'],
  svt40: ['pe', 'pu'],
  avs36: ['pe', 'pu'],
};
const ids = Object.entries(PAIRS).flatMap(([rifle, families]) => families.map((f) => `${rifle}+${f}`));

const mat = new THREE.MeshStandardMaterial();
mat.userData.texWorld = 0.3;
mat.userData.lowColor = [0.1, 0.1, 0.1];
const mats = new Proxy({}, { get: () => mat });
const atm = new Atmosphere(0, 15);

test('every rifle and scope pair builds at every LOD with its scope anchors', () => {
  for (const id of ids) {
    assert.ok(MODELS[id], `${id} is a model`);
    for (const lod of [0, 1, 2]) {
      const g = buildGun(id, mats, { lod });
      const { scopeEye: e, scopeFront: f } = g.anchors;
      assert.ok(e && f, `${id} LOD ${lod}: scopeEye and scopeFront`);
      assert.ok(e.z > f.z + 0.1 && e.y > 0.02, `${id} LOD ${lod}: the eyepiece behind the objective, above the bore`);
      assert.ok(Math.abs(e.y - f.y) < 1e-9 && Math.abs(e.x - f.x) < 1e-9, `${id}: the scope parallel to the bore`);
      assert.equal(g.meta.sight, 'scope');
      assert.ok(g.meta.scopeMag >= 1.5 && g.meta.scopeMag <= 8, `${id} magnification`);
    }
  }
});

test('SCOPE_MOUNTS and the models list the same pairs', () => {
  assert.deepEqual(Object.keys(SCOPE_MOUNTS).sort(), [...ids].sort());
  assert.deepEqual(Object.keys(UPGRADE_MODELS).sort(), [...ids].sort());
  for (const [id, m] of Object.entries(SCOPE_MOUNTS)) {
    assert.ok(MODELS[id], `${id} has a model`);
    assert.equal(typeof m.clipsBlocked, 'boolean');
    assert.equal(typeof m.irons, 'boolean');
    assert.ok(m.mountMass > 0.03 && m.mountMass < 0.5, `${id} mount weight`);
    // Only a rifle loaded from clips can have them blocked.
    const feed = WEAPONS[id.split('+')[0]].feed;
    if (feed === 'box') assert.equal(m.clipsBlocked, false, `${id}: a magazine rifle`);
  }
});

// Distance to the first surface of a model along a ray (null: none).
function firstHit(gun, origin, dir) {
  const meshes = [];
  gun.root.traverse((o) => o.isMesh && meshes.push(o));
  return new THREE.Raycaster(origin, dir, 0, 2).intersectObjects(meshes, false)[0]?.distance ?? null;
}

function build(fn) {
  const b = new GunBuilder(mats);
  fn(b);
  const gun = b.build('gun');
  gun.root.updateMatrixWorld(true);
  return gun;
}

test('where the iron sights stay usable, nothing of the scope or mount is in their way', () => {
  for (const id of ids.filter((k) => SCOPE_MOUNTS[k].irons)) {
    const rifle = id.split('+')[0];
    const d = WEAPONS[rifle];
    const plain = build(MODELS[rifle]);
    const scoped = build(MODELS[id]);
    const s = new Sighting(scoped, { ...d, scope: null }, atm).setRangeIndex(d.sight.ranges.indexOf(d.sight.zero));
    const o = s.eye.clone().add(new THREE.Vector3(0, 0.0005, 0));
    const a = firstHit(plain, o, s.losDir),
      b = firstHit(scoped, o, s.losDir);
    assert.ok(a === b || (a !== null && b !== null && Math.abs(a - b) < 1e-6), `${id}: the line of the iron sights meets the scope or mount at ${b} m (plain rifle: ${a})`);
  }
});
