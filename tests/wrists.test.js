// Third-person soldiers hold their rifles with wrists a real wrist can make:
// the bend between forearm and hand (not counting the forearm's own twist)
// stays under 70 degrees in every pose, for each army's rifle. (It was 115 to
// 120 standing and 87 aiming before the shooting hand could turn round the
// grip and the elbow swing to suit it: soldierArms.js _bestGrip.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SoldierModel } from '../src/actors/soldierModel.js';
import { buildGun } from '../src/weapons/models/index.js';
import { B, BIND } from '../src/actors/soldierRig.js';

const mats = new Proxy({}, { get: (t, k) => (t[k] ??= new THREE.MeshStandardMaterial()) });
const base = { stance: 0, stanceBlend: 0, speed: 0, localVelX: 0, localVelZ: 0, yaw: 0, aimPitch: 0, aimYawOffset: 0, aiming: false, lean: 0, alive: true, onGround: true };
const POSES = {
  standing: {},
  aiming: { aiming: true },
  walking: { localVelZ: -1.4, speed: 1.4 },
  crouched: { stance: 1, stanceBlend: 1 },
  'crouched aiming': { stance: 1, stanceBlend: 1, aiming: true },
};

// Degrees the hand is bent off the line of the forearm.
function wristBend(mp, fore, hand) {
  const axis = BIND[hand].clone().sub(BIND[fore]).normalize();
  const r = mp.q[fore].clone().invert().multiply(mp.q[hand]);
  const v = new THREE.Vector3(r.x, r.y, r.z);
  const p = axis.multiplyScalar(v.dot(axis));
  const twist = new THREE.Quaternion(p.x, p.y, p.z, r.w).normalize();
  const swing = r.clone().multiply(twist.invert());
  return (2 * Math.acos(Math.min(1, Math.abs(swing.w))) * 180) / Math.PI;
}

test('rifles are held with wrists that bend less than 70 degrees', () => {
  for (const [army, gun] of [
    ['US', 'm1_garand'],
    ['GE', 'kar98k'],
    ['SU', 'mosin_9130'],
  ]) {
    const m = new SoldierModel(army, null, { seed: 3 });
    m.setWeapon(buildGun(gun, mats), 'rifle');
    for (const [name, extra] of Object.entries(POSES)) {
      const s = { ...base, ...extra };
      for (let i = 0; i < 150; i++) m.update(1 / 60, s);
      const right = wristBend(m.mp, B.forearmR, B.handR),
        left = wristBend(m.mp, B.forearmL, B.handL);
      assert.ok(right < 70, `${army} ${name}: right wrist bent ${right.toFixed(0)} degrees`);
      assert.ok(left < 70, `${army} ${name}: left wrist bent ${left.toFixed(0)} degrees`);
      // And the rifle stays where the pose puts it (the hand turns, not the gun).
      const turned = (2 * Math.acos(Math.min(1, Math.abs(m.arms.G.q.dot(m.arms.Gt.q)))) * 180) / Math.PI;
      assert.ok(turned < 2, `${army} ${name}: rifle turned ${turned.toFixed(1)} degrees off its pose`);
    }
  }
});
