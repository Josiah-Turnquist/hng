// What projectiles look like in flight: which ones are models (rockets,
// shells) and that the models are real objects pointing the way they fly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/battle.js'; // (its stand-ins for the browser's canvas, for painted textures)
import { ProjectileView } from '../src/game/projectileView.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { AMMO } from '../src/weapons/ammo.js';
import { SHELLS } from '../src/vehicles/defs.js';

function fakeGame(active) {
  const scene = new THREE.Group();
  return {
    scene,
    world: {
      textures: {
        standard() {
          const m = new THREE.MeshStandardMaterial();
          m.userData.texWorld = 0.3;
          return m;
        },
        get: () => ({}),
      },
      add: (o) => scene.add(o),
      shadows: { prepare() {} },
    },
    projectiles: { active },
    effects: { spawn() {} },
  };
}

const flying = (ammo, weapon, v = [0, 0, -100], extra = {}) => ({ id: Math.random(), alive: true, x: 0, y: 2, z: 0, px: 0, py: 2, pz: 0.5, vx: v[0], vy: v[1], vz: v[2], speed: Math.hypot(...v), age: 0.1, distance: 10, ammo, weapon, ...extra });

test('rockets fly as their launchers\' own rockets, tank shells as shells, bullets and grenades as neither', () => {
  const view = new ProjectileView(fakeGame([]));
  assert.equal(view._key(flying(AMMO['M6A1 rocket'], WEAPONS.bazooka_m1a1)), 'rocket:bazooka_m1a1');
  assert.equal(view._key(flying(AMMO['RPzBGr 4322'], WEAPONS.panzerschreck)), 'rocket:panzerschreck');
  assert.equal(view._key(flying(AMMO['PzF 60'], WEAPONS.panzerfaust60)), 'rocket:panzerfaust60');
  assert.equal(view._key(flying(SHELLS['PzGr 39'], { name: 'KwK 40', vehicle: true })), `shell:${SHELLS['PzGr 39'].diameter}:ap`);
  assert.equal(view._key(flying(SHELLS['M48 HE'], { name: 'M3', vehicle: true })), `shell:${SHELLS['M48 HE'].diameter}:he`);
  assert.equal(view._key(flying(AMMO['792 sS'], WEAPONS.kar98k)), null);
  assert.equal(view._key(flying(AMMO['Mk II'], WEAPONS.mk2_grenade)), null);
});

test('a rocket or shell in flight is a model at its position, nose first, and goes when it does', () => {
  const active = [flying(AMMO['M6A1 rocket'], WEAPONS.bazooka_m1a1, [30, 5, -70]), flying(SHELLS['PzGr 39'], { name: 'KwK 40', vehicle: true }, [0, 0, -780])];
  const g = fakeGame(active);
  const view = new ProjectileView(g);
  view.update(1 / 60);
  assert.equal(view.live.size, 2);
  for (const p of active) {
    const v = view.live.get(p.id);
    let meshes = 0;
    v.pivot.traverse((o) => (meshes += o.isMesh ? 1 : 0));
    assert.ok(meshes > 0, `${p.ammo.name} has a model`);
    assert.ok(v.pivot.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) < 1e-6);
    const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(v.pivot.quaternion);
    const dir = new THREE.Vector3(p.vx, p.vy, p.vz).normalize();
    assert.ok(nose.dot(dir) > 0.999, `${p.ammo.name} points the way it flies`);
    // About the right size: a 2.36 in rocket about half a metre long, a 75 mm shell about 30 cm.
    const size = new THREE.Box3().setFromObject(v.pivot).getSize(new THREE.Vector3()).length();
    assert.ok(size > 0.2 && size < 0.9, `${p.ammo.name}: ${size.toFixed(2)} m`);
  }
  // Gone off: the models are put away.
  active.length = 0;
  view.update(1 / 60);
  assert.equal(view.live.size, 0);
  assert.equal(g.scene.children.length, 0);
});
