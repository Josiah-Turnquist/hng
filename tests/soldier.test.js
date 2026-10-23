// Checks the soldier's hit capsules, the bullet ray test, aiming, foot planting
// and the ragdoll, without a renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SoldierModel, raycastHitboxes, rayCapsule, HITBOX_PARTS } from '../src/actors/soldierModel.js';
import { buildGun } from '../src/weapons/models/index.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b}, got ${a}`);
const mats = new Proxy({}, { get: (t, k) => (t[k] ??= new THREE.MeshStandardMaterial()) });
const idle = (extra = {}) => ({ stance: 0, stanceBlend: 0, speed: 0, localVelX: 0, localVelZ: 0, yaw: 0, aimPitch: 0, aimYawOffset: 0, aiming: false, lean: 0, alive: true, ...extra });
function settle(m, s, frames = 90, dt = 1 / 60) {
  for (let i = 0; i < frames; i++) m.update(dt, s);
  return m;
}

test('ray vs capsule: through the side, along the axis, misses, from inside', () => {
  // Capsule along X from -1 to 1, radius 0.5.
  let span = rayCapsule(0, 0, -5, 0, 0, 1, -1, 0, 0, 1, 0, 0, 0.5);
  near(span[0], 4.5, 1e-9, 'side entry');
  near(span[1], 5.5, 1e-9, 'side exit');
  span = rayCapsule(-5, 0, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0.5);
  near(span[0], 3.5, 1e-9, 'cap entry');
  near(span[1], 6.5, 1e-9, 'cap exit');
  span = rayCapsule(1.2, 3, 0, 0, -1, 0, -1, 0, 0, 1, 0, 0, 0.5); // through the rounded end
  near(span[0], 3 - Math.sqrt(0.25 - 0.04), 1e-9, 'end cap entry');
  assert.equal(rayCapsule(0, 0.6, -5, 0, 0, 1, -1, 0, 0, 1, 0, 0, 0.5), null, 'passes above');
  assert.equal(rayCapsule(-5, 0.6, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0.5), null, 'parallel, outside');
  const inside = raycastHitboxes([{ part: 'chest', ax: -1, ay: 0, az: 0, bx: 1, by: 0, bz: 0, r: 0.5 }], 0, 0, 0, 0, 0, 1, 10);
  assert.equal(inside.t, 0);
  near(inside.tExit, 0.5, 1e-9);
  // Nearest of several, normal faces the shooter, maxDist respected.
  const boxes = [
    { part: 'far', ax: -1, ay: 0, az: 3, bx: 1, by: 0, bz: 3, r: 0.2 },
    { part: 'near', ax: -1, ay: 0, az: 1, bx: 1, by: 0, bz: 1, r: 0.2 },
  ];
  const hit = raycastHitboxes(boxes, 0, 0, -2, 0, 0, 1, 100);
  assert.equal(hit.part, 'near');
  near(hit.t, 2.8, 1e-9);
  near(hit.nz, -1, 1e-9);
  assert.equal(raycastHitboxes(boxes, 0, 0, -2, 0, 0, 1, 2.5), null, 'beyond maxDist');
});

test('every body part has a capsule and a standing soldier is 1.8 m tall', () => {
  const m = settle(new SoldierModel('US', null, { seed: 3 }), idle());
  const hb = m.getHitboxes([]);
  assert.deepEqual(hb.map((h) => h.part), HITBOX_PARTS);
  assert.equal(new Set(HITBOX_PARTS).size, 17);
  let top = -Infinity,
    bottom = Infinity;
  for (const h of hb) {
    top = Math.max(top, h.ay + h.r, h.by + h.r);
    bottom = Math.min(bottom, h.ay - h.r, h.by - h.r);
  }
  near(top, 1.8, 0.04, 'top of the helmet');
  near(bottom, 0, 0.03, 'soles');
});

test('bullets hit the zone they are aimed at', () => {
  const m = settle(new SoldierModel('GE', null, { seed: 5 }), idle());
  const hb = m.getHitboxes([]);
  const shoot = (x, y) => raycastHitboxes(hb, x, y, -10, 0, 0, 1, 100);
  assert.equal(shoot(0, 1.65).part, 'head');
  assert.equal(shoot(0, 1.33).part, 'chest');
  assert.equal(shoot(0, 1.12).part, 'abdomen');
  assert.equal(shoot(0, 0.88).part, 'pelvis');
  assert.match(shoot(0.1, 0.65).part, /thigh[LR]/);
  assert.match(shoot(0.1, 0.3).part, /shin[LR]/);
  assert.equal(shoot(0, 2.0), null, 'over the helmet');
  assert.equal(shoot(0.45, 1.2), null, 'beside the body');
  // A torso shot goes in through the front and out through the back.
  const h = shoot(0, 1.33);
  near(h.tExit - h.t, 0.25, 0.05, 'chest depth');
});

test('hitboxes follow the root position and facing', () => {
  const m = new SoldierModel('SU', null, { seed: 2 });
  m.root.position.set(10, 2, -4);
  settle(m, idle({ yaw: Math.PI / 2 })); // facing -X
  const hb = m.getHitboxes([]);
  // From the soldier's front (-X side) at chest height.
  const hit = raycastHitboxes(hb, 0, 2 + 1.33, -4, 1, 0, 0, 100);
  assert.equal(hit.part, 'chest');
  near(hit.nx, -1, 0.2, 'normal points back at the shooter');
});

test('prone soldiers are low, crouched ones lower than standing', () => {
  const heights = {};
  for (const [name, st] of [
    ['stand', 0],
    ['crouch', 1],
    ['prone', 2],
  ]) {
    const m = settle(new SoldierModel('US', null, { seed: 1 }), idle({ stance: st, stanceBlend: st }));
    const head = m.getHitboxes([]).find((h) => h.part === 'head');
    heights[name] = Math.max(head.ay, head.by);
  }
  assert.ok(heights.stand > 1.65 && heights.stand < 1.75, `stand ${heights.stand}`);
  assert.ok(heights.crouch > 0.95 && heights.crouch < 1.25, `crouch ${heights.crouch}`);
  assert.ok(heights.prone < 0.5, `prone ${heights.prone}`);
});

test('the bore points where the soldier aims', () => {
  const m = new SoldierModel('GE', null, { seed: 1 });
  m.setWeapon(buildGun('kar98k', mats), 'rifle');
  for (const [pitch, yaw] of [
    [0, 0],
    [0.3, 0],
    [-0.25, 0.4],
    [0.1, -0.5],
  ]) {
    settle(m, idle({ aiming: true, aimPitch: pitch, aimYawOffset: yaw }), 60);
    const want = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    assert.ok(m.aimDir.angleTo(want) < 0.03, `pitch ${pitch} yaw ${yaw}: off by ${m.aimDir.angleTo(want)}`);
    // The muzzle is in front of the shooter, at about shoulder height when level.
    if (pitch === 0 && yaw === 0) {
      assert.ok(m.muzzleWorld.z < -0.8, `muzzle z ${m.muzzleWorld.z}`);
      near(m.muzzleWorld.y, 1.5, 0.12, 'muzzle height');
    }
  }
});

test('planted feet do not slide while walking, strafing and running', () => {
  for (const [vx, vz] of [
    [0, -1.5],
    [1.2, 0],
    [0, 1.0],
    [0, -3.7],
  ]) {
    const m = new SoldierModel('US', null, { seed: 1 });
    const s = idle({ localVelX: vx, localVelZ: vz, speed: Math.hypot(vx, vz) });
    let x = 0,
      z = 0;
    const dt = 1 / 60;
    let worst = 0;
    const prev = [null, null];
    for (let i = 0; i < 240; i++) {
      x += vx * dt;
      z += vz * dt;
      m.root.position.set(x, 0, z);
      m.update(dt, s);
      m.anim.feet.forEach((f, k) => {
        const flat = f.planted && f.pitch <= 0.02;
        const wx = f.x + x,
          wz = f.z + z;
        if (flat && prev[k] && i > 60) worst = Math.max(worst, Math.hypot(wx - prev[k][0], wz - prev[k][1]));
        prev[k] = flat ? [wx, wz] : null;
      });
    }
    assert.ok(worst < 0.002, `foot slid ${worst} m per frame at (${vx}, ${vz})`);
  }
});

test('a dead soldier falls and comes to rest on the ground', () => {
  const ground = (x, z) => 0.2 * Math.sin(x * 0.5) + 0.1 * z;
  const m = new SoldierModel('SU', null, { seed: 4 });
  m.setWeapon(buildGun('kar98k', mats), 'rifle');
  m.setGround(ground);
  m.root.position.set(1, ground(1, 2), 2);
  const s = idle();
  settle(m, s, 30);
  s.alive = false;
  s.hitDir = { x: 0, z: 1 };
  for (let i = 0; i < 300; i++) {
    s.deathT = i / 60;
    m.update(1 / 60, s);
  }
  const hb = m.getHitboxes([]);
  for (const h of hb) {
    for (const [px, py, pz] of [
      [h.ax, h.ay, h.az],
      [h.bx, h.by, h.bz],
    ]) {
      const g = ground(px, pz);
      assert.ok(py - g > -0.03, `${h.part} under the ground by ${g - py}`);
      assert.ok(py - g < 0.45, `${h.part} still ${py - g} m up`);
    }
  }
  assert.ok(m.ragdoll.asleep || m.ragdoll.still > 0, 'ragdoll settled');
  // The dropped rifle lies on the ground too.
  assert.ok(m.muzzleWorld.y - ground(m.muzzleWorld.x, m.muzzleWorld.z) < 0.15, 'rifle on the ground');
});

test('full detail uses 3 skinned meshes, the distant version 1', () => {
  const m = new SoldierModel('GE', null, { seed: 1 });
  const count = (lod) => m.meshes[lod].filter((x) => x.visible).length;
  assert.equal(count(0), 3);
  m.setLod(1);
  assert.equal(count(1), 1);
  assert.equal(count(0), 0);
  const tris = (meshes) => meshes.reduce((n, x) => n + x.geometry.index.count / 3, 0);
  assert.ok(tris(m.meshes[0]) < 9000, `full ${tris(m.meshes[0])} triangles`);
  assert.ok(tris(m.meshes[1]) < 1800, `lod ${tris(m.meshes[1])} triangles`);
  for (const mesh of [...m.meshes[0], ...m.meshes[1]]) assert.equal(mesh.skeleton.bones.length, 19);
});
