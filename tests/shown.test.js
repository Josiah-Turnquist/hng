// Where the other soldiers of an online battle are shown (src/net/shown.js):
// between the server's snapshots, a moment in the past. When snapshots come
// late or in bursts a running man must not stop dead and jump forward; a man
// put somewhere new (a respawn) is there at once, not flown across.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Shown, MIN_DELAY, MAX_DELAY } from '../src/net/shown.js';

// A man running at 5.5 m/s on a wandering line for 40 s, as the server sends
// him (30 snapshots a second, rounded to the centimeter), reaching the page
// `spread` ms late or more, the server now and then held up `stall` ms; the
// page drawing 60 times a second. How he is shown.
function watch({ spread = 25, stall = 120, respawnAt = null } = {}) {
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const snaps = [];
  let x = 0,
    z = 0,
    dir = 0,
    hold = 0;
  for (let tick = 0; tick < 60 * 40; tick++) {
    const t = tick / 60;
    dir += Math.sin(t * 0.7) * 0.01;
    x += (-Math.sin(dir) * 5.5) / 60;
    z += (-Math.cos(dir) * 5.5) / 60;
    if (respawnAt !== null && tick === respawnAt * 60) {
      x += 120;
      z -= 80;
    }
    if (tick % 2) continue;
    if (rnd() < 1 / 90) hold = stall / 1000;
    const sent = t + hold;
    hold = Math.max(0, hold - 0.03);
    snaps.push({ time: Math.round(t * 1000) / 1000, x: Math.round(x * 100) / 100, y: 0, z: Math.round(z * 100) / 100, arrive: sent + 0.04 + (spread / 1000) * -Math.log(1 - rnd() * 0.98) * 0.6 });
  }
  snaps.sort((a, b) => a.arrive - b.arrive);
  const shown = new Shown();
  const got = [];
  const body = {};
  const out = { frames: 0, frozen: 0, jumping: 0, furthest: 0, jumps: 0, fastestLegs: 0, delays: [] };
  let wall = 0,
    k = 0,
    prev = null;
  while (wall < 38) {
    const dt = 1 / 60 + (rnd() - 0.5) * 0.004;
    wall += dt;
    while (k < snaps.length && snaps[k].arrive <= wall) {
      const s = snaps[k++];
      if (got.length && s.time <= got[got.length - 1].time) continue;
      got.push(s);
      if (got.length > 30) got.shift();
      shown.arrived(s.time, wall);
    }
    if (!got.length) continue;
    const at = shown.at(got, dt);
    const jumped = shown.place(body, at.a, at.b, at);
    if (wall > 3) {
      out.frames++;
      out.delays.push(shown.delay);
      if (jumped) out.jumps++;
      out.fastestLegs = Math.max(out.fastestLegs, Math.hypot(body.vx, body.vz));
      if (prev && !jumped) {
        const v = Math.hypot(body.x - prev.x, body.z - prev.z) / dt;
        out.furthest = Math.max(out.furthest, v);
        if (v < 5.5 * 0.4) out.frozen++;
        if (v > 5.5 * 1.8) out.jumping++;
      }
    }
    prev = { x: body.x, z: body.z };
  }
  return out;
}

test('a running man is shown running: no stopping dead and jumping forward when snapshots come late or in bursts', () => {
  for (const net of [
    { spread: 8, stall: 0 },
    { spread: 25, stall: 120 },
    { spread: 50, stall: 120 },
    { spread: 60, stall: 250 },
  ]) {
    const r = watch(net);
    const name = `${net.spread} ms late, held up ${net.stall} ms`;
    // (Before: with 25 ms and 120 ms, 2% of frames stopped dead and 1% jumped; with 60 and 250, 7%.)
    assert.equal(r.frozen, 0, `${name}: ${r.frozen} of ${r.frames} frames stopped dead`);
    assert.equal(r.jumping, 0, `${name}: ${r.jumping} frames jumped forward`);
    assert.ok(r.furthest < 5.5 * 1.5, `${name}: ${r.furthest.toFixed(1)} m/s at the most`);
  }
});

test('others are shown as little in the past as the connection allows', () => {
  const steady = watch({ spread: 3, stall: 0 });
  assert.ok(Math.max(...steady.delays) < MIN_DELAY + 0.01, `a steady connection: ${Math.max(...steady.delays).toFixed(3)} s`);
  const rough = watch({ spread: 60, stall: 250 });
  assert.ok(Math.max(...rough.delays) <= MAX_DELAY);
  assert.ok(rough.delays.reduce((a, b) => a + b, 0) / rough.delays.length > MIN_DELAY + 0.02, 'an uneven one: further back');
});

test('a man put somewhere new (a respawn) is there at once, and his legs are not told he flew', () => {
  const r = watch({ spread: 8, stall: 0, respawnAt: 20 });
  assert.ok(r.jumps >= 1, 'the respawn is seen as one');
  // (Before: 144 m in a thirtieth of a second read as 4300 m/s, which flung his feet 16 m behind him.)
  assert.ok(r.fastestLegs < 8, `the speed his legs were given: ${r.fastestLegs.toFixed(1)} m/s at the most`);
  assert.equal(r.frozen, 0);
  // Riding (faster than a man runs): his legs are told nothing.
  const shown = new Shown();
  const body = {};
  shown.place(body, { x: 0, y: 0, z: 0 }, { x: 0.6, y: 0, z: 0 }, { t: 0.5, span: 1 / 30, dt: 1 / 60 });
  assert.deepEqual([body.vx, body.vz], [0, 0]);
  assert.ok(Math.abs(body.x - 0.3) < 1e-9, 'but he is shown where he is');
});
