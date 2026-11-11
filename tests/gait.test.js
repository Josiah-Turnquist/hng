// A soldier's stride (src/actors/soldierAnim.js): each foot stands its share
// of the stride and then lifts. Breaking from a walk into a run shortens that
// share; a foot already past the new point used to miss its moment, stay on
// the ground a whole stride and be dragged metres behind him (the leg stuck
// out straight behind).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SoldierModel } from '../src/actors/soldierModel.js';

const state = (vz) => ({
  stance: 0,
  stanceBlend: 0,
  speed: Math.abs(vz),
  localVelX: 0,
  localVelZ: vz,
  sprinting: Math.abs(vz) > 4,
  onGround: true,
  yaw: 0,
  aimPitch: 0,
  aimYawOffset: 0,
  aiming: false,
  lean: 0,
  recoil: 0,
  action: null,
  actionT: 0,
  alive: true,
  deathT: 0,
  seated: false,
});

// The furthest either foot gets from under him (m), over `frames` at speed v.
function go(m, v, frames, dt = 1 / 60) {
  let far = 0;
  for (let i = 0; i < frames; i++) {
    m.update(dt, state(-v));
    for (const f of m.anim.feet) far = Math.max(far, Math.hypot(f.x, f.z));
  }
  return far;
}

test('no foot is left behind: from a walk into a run at any point of the stride, and from a stand into a sprint', () => {
  const m = new SoldierModel('US', null, { seed: 5, lod: 2 });
  m.setGround(() => 0);
  let worst = 0;
  // (A walking stride is about a second: every sixtieth of it.)
  for (let wait = 30; wait < 110; wait++) {
    m.anim.reset();
    go(m, 0, 20);
    go(m, 1.6, wait);
    worst = Math.max(worst, go(m, 6.5, 150));
  }
  // (A running stride puts a foot 0.85 m back at the most. Before: 3.9 m.)
  assert.ok(worst < 1.05, `walk to run: a foot ${worst.toFixed(2)} m from him`);
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    m.anim.reset();
    go(m, 0, 30, dt);
    const far = go(m, 6.5, Math.round(3 / dt), dt);
    assert.ok(far < 1.05, `stand to sprint at ${Math.round(1 / dt)} frames a second: ${far.toFixed(2)} m`);
  }
  // A speed no man runs at (a jump taken for a move) does not fling his feet.
  m.anim.reset();
  go(m, 5, 60);
  const flung = go(m, 4000, 2) + go(m, 5, 60) * 0;
  assert.ok(flung < 1.2, `${flung.toFixed(2)} m`);
  // And he still takes steps as he runs: each foot lifts and lands.
  m.anim.reset();
  let lifts = 0,
    up = [false, false];
  for (let i = 0; i < 240; i++) {
    m.update(1 / 60, state(-5.5));
    m.anim.feet.forEach((f, k) => {
      if (!f.planted && !up[k]) lifts++;
      up[k] = !f.planted;
    });
  }
  assert.ok(lifts >= 10 && lifts <= 16, `${lifts} steps in 4 s of running`);
  m.dispose();
});

test("a walking or running man's head stays level: it rides a few centimetres up and down, never drops and pops back", () => {
  // (The hips used to come down at once by all that the furthest foot asked,
  // up to half a metre, and spring back as it lifted: 0.3 m at a walk and
  // 0.5 m at a run, in single frames.)
  for (const v of [1.6, 3, 5, 6.5]) {
    for (const fps of [24, 30, 60, 120]) {
      const m = new SoldierModel('US', null, { seed: 5, lod: 2 });
      m.setGround(() => 0);
      const dt = 1 / fps;
      for (let i = 0; i < fps; i++) m.update(dt, state(0));
      let lo = Infinity;
      let hi = -Infinity;
      let fastest = 0;
      let prev = null;
      for (let i = 0; i < fps * 4; i++) {
        m.update(dt, state(-v));
        const y = m.eyeWorld.y;
        // (After the first second: getting going is its own motion.)
        if (i > fps) {
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
          if (prev !== null) fastest = Math.max(fastest, Math.abs(y - prev) / dt);
        }
        prev = y;
      }
      assert.ok(hi - lo < 0.12, `${v} m/s at ${fps} frames a second: his head moves ${(hi - lo).toFixed(2)} m up and down`);
      assert.ok(fastest < 1.6, `${v} m/s at ${fps} frames a second: his head moves at up to ${fastest.toFixed(1)} m/s`);
    }
  }
});
