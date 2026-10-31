// The aim's breathing sway after a run: a steady heavy rhythm while winded,
// easing off smoothly as he recovers, never a shake (game/player.js _updateSway).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerController } from '../src/game/player.js';
import { STANCE } from '../src/actors/body.js';

test('breathing after a run sways the aim smoothly, however long the battle has gone on', () => {
  const body = { stance: STANCE.STAND, breath: 1, moving: 0 };
  const soldier = { body, weapon: { def: { mass: 4.3 } }, armWound: 0, aiming: true, supported: false, badges: [] };
  const pc = Object.assign(Object.create(PlayerController.prototype), {
    soldier,
    sway: { yaw: 0, pitch: 0 },
    swayT: 600, // ten minutes in
    drift: { yaw: 0, pitch: 0, vy: 0, vp: 0 },
    holdingBreath: false,
    breathHold: 0,
    breathDebt: 0,
    adsTime: 0,
  });
  const dt = 1 / 60;
  let fastest = 0;
  let last = null;
  for (let i = 0; i < 60 * 25; i++) {
    // Winded for a few seconds, then recovering.
    body.breath = i < 60 * 5 ? 1 : Math.max(0, 1 - (i - 300) / (60 * 20));
    pc._updateSway(dt);
    if (last) fastest = Math.max(fastest, Math.hypot(pc.sway.pitch - last[0], pc.sway.yaw - last[1]) / dt);
    last = [pc.sway.pitch, pc.sway.yaw];
  }
  // A heavy breath moves the aim a few hundredths of a radian a second, not
  // the tenths of a shake.
  assert.ok(fastest < 0.06, `aim moved at most ${fastest.toFixed(3)} rad/s`);
});
