// The soldiers' hands are a sculpted hand (the MakeHuman base mesh's, CC0)
// fitted to the game's own hand joints and finger bones (src/actors/
// handMesh.js): each fingertip ends where the game's finger ends, every
// vertex moves with bones the game has, and it faces outward.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handMesh } from '../src/actors/handMesh.js';
import { HAND_JOINTS, FINGER_NAMES } from '../src/actors/soldierRig.js';

test('the sculpted hand is fitted to the game\'s hand', () => {
  const m = handMesh();
  assert.ok(m.count > 1000 && m.index.length / 3 > 2000, `${m.count} vertices`);
  const P = m.positions;
  // Each finger's furthest point is at the game's fingertip (within 3 mm).
  for (const [fi, f] of FINGER_NAMES.entries()) {
    const tip = HAND_JOINTS[f][3];
    const base = HAND_JOINTS[f][2];
    const d = [tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]];
    let far = -Infinity,
      at = null;
    for (let i = 0; i < m.count; i++) {
      if (m.part[i] !== fi + 1) continue;
      const s = (P[i * 3] - base[0]) * d[0] + (P[i * 3 + 1] - base[1]) * d[1] + (P[i * 3 + 2] - base[2]) * d[2];
      if (s > far) (far = s), (at = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    }
    const off = Math.hypot(at[0] - tip[0], at[1] - tip[1], at[2] - tip[2]);
    assert.ok(off < 0.003, `${f}: its tip is ${(off * 1000).toFixed(1)} mm from the game's`);
  }
  // Weights: bones the game has, adding up to 1.
  const names = new Set(['fore', 'hand', ...FINGER_NAMES.flatMap((f) => [f + 1, f + 2])]);
  for (let i = 0; i < m.count; i++) {
    let sum = 0;
    for (const [name, w] of m.bones[i]) {
      assert.ok(names.has(name), name);
      sum += w;
    }
    assert.ok(Math.abs(sum - 1) < 1e-6);
  }
  // A hand's size: 17 to 21 cm long, 7 to 11 cm across with the thumb.
  let lo = [9, 9, 9],
    hi = [-9, -9, -9];
  for (let i = 0; i < m.count; i++) for (let k = 0; k < 3; k++) (lo[k] = Math.min(lo[k], P[i * 3 + k])), (hi[k] = Math.max(hi[k], P[i * 3 + k]));
  assert.ok(-lo[1] > 0.17 && -lo[1] < 0.21, `${(-lo[1] * 100).toFixed(1)} cm from the wrist to the fingertip`);
  assert.ok(hi[2] - lo[2] > 0.07 && hi[2] - lo[2] < 0.11, `${((hi[2] - lo[2]) * 100).toFixed(1)} cm across`);
  // Facing outward: the back of the hand (+X side) has normals to +X.
  let back = 0,
    n = 0;
  for (let i = 0; i < m.count; i++) {
    if (m.part[i] !== 0 || P[i * 3 + 1] > -0.03 || P[i * 3 + 1] < -0.08) continue;
    if (P[i * 3] > 0.004) (back += m.normals[i * 3]), n++;
  }
  assert.ok(n > 10 && back / n > 0.5, `back of the hand faces out (${(back / n).toFixed(2)} over ${n})`);
});
