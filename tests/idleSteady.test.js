// A soldier standing still with his gun (the main screen, a sentry in battle)
// moves smoothly: no limb jumps from one frame to the next. Two things used
// to: the left hand slid along the fore-end in steps of a few centimetres,
// taking the elbow with it; and a foot shifted while standing left the ground
// at full speed, snapping the knee forward.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SoldierModel } from '../src/actors/soldierModel.js';
import { buildGun } from '../src/weapons/models/index.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { roleOf } from '../src/actors/soldierKit.js';

const mats = new Proxy({}, { get: (t, k) => (t[k] ??= new THREE.MeshStandardMaterial()) });
const KIND = { smg: 'smg', lmg: 'lmg' };
const WATCH = ['handL', 'handR', 'forearmL', 'forearmR', 'upperArmL', 'upperArmR', 'footL', 'footR', 'shinL', 'shinR', 'head'];

// The fastest any watched bone moves, and the most its speed changes from one
// frame to the next (m/s), standing still for `secs` with frames of `dt`.
function standStill(id, secs, dt) {
  const def = WEAPONS[id];
  const m = new SoldierModel(def.faction || 'US', null, { seed: 7, lod: 2, role: roleOf(def) });
  m.setWeapon(buildGun(id, mats, { lod: 2 }), KIND[def.type] || 'rifle');
  m.setGround(() => 0);
  // (As the main screen holds him: soldierPreview.js.)
  const state = {
    stance: 0,
    stanceBlend: 0,
    speed: 0,
    localVelX: 0,
    localVelZ: 0,
    sprinting: false,
    onGround: true,
    yaw: 0,
    aimPitch: -0.05,
    aimYawOffset: 0,
    aiming: false,
    lean: 0,
    recoil: 0,
    action: null,
    actionT: 0,
    alive: true,
    deathT: 0,
    seated: false,
  };
  for (let i = 0; i < 90; i++) m.update(1 / 60, state);
  const idx = WATCH.map((n) => m.bones.findIndex((b) => b.name === n));
  const prev = idx.map(() => new THREE.Vector3()),
    prevV = idx.map(() => new THREE.Vector3());
  const p = new THREE.Vector3(),
    v = new THREE.Vector3();
  const out = { speed: 0, change: 0, hand: 0, steps: 0 };
  let first = true,
    lifted = false;
  for (let t = 0; t < secs; t += dt) {
    m.update(dt, state);
    m.root.updateMatrixWorld(true);
    idx.forEach((bi, k) => {
      m.bones[bi].getWorldPosition(p);
      if (!first) {
        v.copy(p).sub(prev[k]).divideScalar(dt);
        out.speed = Math.max(out.speed, v.length());
        out.change = Math.max(out.change, v.distanceTo(prevV[k]));
        if (WATCH[k].startsWith('hand') || WATCH[k].startsWith('forearm')) out.hand = Math.max(out.hand, v.length());
        prevV[k].copy(v);
      }
      prev[k].copy(p);
    });
    // (He does shift his feet now and then: that is meant, and must be smooth.)
    const up = m.anim.feet.some((f) => !f.planted);
    if (up && !lifted) out.steps++;
    lifted = up;
    first = false;
  }
  m.dispose();
  return out;
}

test('standing still with a rifle, nothing jumps: the hands stay put and a shifted foot starts gently', () => {
  for (const id of ['kar98k', 'm1_garand', 'bar_m1918a2', 'mp40']) {
    for (const dt of [1 / 60, 1 / 30, 1 / 144]) {
      const r = standStill(id, 30, dt);
      // The hands and elbows: breathing only (they jumped 4 to 6 cm in a frame: 2 to 4 m/s).
      assert.ok(r.hand < 0.3, `${id} at ${Math.round(1 / dt)} frames a second: a hand or elbow moves at ${r.hand.toFixed(2)} m/s`);
      // No bone's speed changes by more than 0.6 m/s between frames (a knee's changed by 2.6).
      assert.ok(r.change < 0.6, `${id} at ${Math.round(1 / dt)} frames a second: a jolt of ${r.change.toFixed(2)} m/s in one frame`);
      assert.ok(r.speed < 1.2, `${id}: ${r.speed.toFixed(2)} m/s`);
      if (dt === 1 / 60) assert.ok(r.steps >= 1, `${id}: he shifts his feet now and then (${r.steps})`);
    }
  }
});
