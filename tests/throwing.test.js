// Hand grenades: the throw (pin, draw back, cook, swing, let go), what a
// grenade does once thrown (bounce, roll, lie still, go off on its fuse), and
// the bots' lob.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Weapon } from '../src/weapons/weapon.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { ProjectileSystem } from '../src/ballistics/projectiles.js';
import { Atmosphere } from '../src/ballistics/atmosphere.js';
import { startThrow, releaseThrow, updateThrow, throwActionT, lookAim, hasGrenade, WINDUP, SWING, FOLLOW } from '../src/game/throwing.js';
import { grenadeLob } from '../src/ai/tactics.js';

// Flat open ground at y = 0 (soil), nothing else in the way.
function flatWorld() {
  return {
    hf: { half: 2000, minH: -10, getSurface: () => 0 },
    raycast(ox, oy, oz, dx, dy, dz, maxDist, hit) {
      if (dy >= 0) return false;
      const t = -oy / dy;
      if (t < 0 || t > maxDist) return false;
      Object.assign(hit, { t, nx: 0, ny: 1, nz: 0, ground: true, material: 'soil', box: null });
      return true;
    },
  };
}

function setup(weapon = 'mk2_grenade') {
  const expired = [];
  const projectiles = new ProjectileSystem({ world: flatWorld(), atmosphere: new Atmosphere(0, 15) });
  projectiles.onExpire = (p, why) => expired.push({ p, why, age: p.age, x: p.x, z: p.z });
  const game = { time: 0, projectiles, audio: null };
  const w = new Weapon(WEAPONS[weapon]);
  const body = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    stance: 0,
    eyePosition(out) {
      out.x = this.x;
      out.y = this.y + 1.64;
      out.z = this.z;
      return out;
    },
  };
  const s = { alive: true, vehicle: null, throwing: null, body, yaw: 0, pitch: 0.3, weapons: [null, null, w], isPlayer: true, lastThrowTime: -100 };
  const run = (seconds, dt = 1 / 60) => {
    for (let t = 0; t < seconds - 1e-9; t += dt) {
      game.time += dt;
      updateThrow(game, s, dt);
      projectiles.update(dt);
    }
  };
  return { game, s, w, run, expired, projectiles };
}

const count = (w) => (w.chambered ? 1 : 0) + w.spareMags.length;
const thrown = (projectiles) => projectiles.active.filter((p) => p.ammo.thrown);

test('pressing draws the arm back and holds it there; letting go throws after the swing', () => {
  const { s, w, run, projectiles } = setup();
  const n0 = count(w);
  assert.ok(startThrow(s, w));
  run(1.0);
  assert.equal(s.throwing.phase, 'windup', 'held: still drawn back');
  assert.equal(thrown(projectiles).length, 0);
  assert.ok(Math.abs(s.throwing.cook - (1.0 - WINDUP)) < 0.03, `cooking since the arm was back (${s.throwing.cook})`);
  releaseThrow(s, lookAim);
  run(SWING - 0.04);
  assert.equal(thrown(projectiles).length, 0, 'not yet: still swinging');
  for (let i = 0; i < 10 && !thrown(projectiles).length; i++) run(1 / 60);
  const [p] = thrown(projectiles);
  assert.ok(p, 'the grenade left the hand');
  assert.equal(count(w), n0 - 1, 'one grenade fewer');
  assert.ok(w.chambered, 'the next one in the hand');
  // Its fuse has been burning for the time it was held cooked (to a step or two).
  const burnt = p.age - (1.0 - WINDUP + SWING);
  assert.ok(burnt > -0.02 && burnt < 0.06, `fuse burnt ${p.age.toFixed(2)} s`);
  assert.equal(s.throwing.phase, 'follow');
  run(FOLLOW + 0.02);
  assert.equal(s.throwing, null, 'the throw is over');
});

test('a quick throw keeps nearly its whole fuse; a long cook still leaves half a second', () => {
  const quick = setup();
  startThrow(quick.s, quick.w);
  releaseThrow(quick.s, lookAim);
  quick.run(WINDUP + SWING + 0.05);
  const [p] = thrown(quick.projectiles);
  assert.ok(p && p.age < SWING + 0.1, `a tap: ${p?.age.toFixed(2)} s burnt`);

  const long = setup();
  startThrow(long.s, long.w);
  long.run(8);
  releaseThrow(long.s, lookAim);
  long.run(SWING + 0.02);
  const [q] = thrown(long.projectiles);
  assert.ok(q && Math.abs(q.ammo.fuseTime - q.age - 0.5) < 0.05, `held too long: ${(q.ammo.fuseTime - q.age).toFixed(2)} s left`);
});

test('killed with a cooking grenade in hand, a soldier drops it at his feet', () => {
  const { s, w, run, projectiles } = setup();
  startThrow(s, w);
  run(WINDUP + 0.5);
  s.alive = false;
  run(1 / 60);
  const [p] = thrown(projectiles);
  assert.ok(p, 'dropped');
  assert.ok(Math.hypot(p.x, p.z) < 0.5 && Math.hypot(p.vx, p.vz) < 0.5, 'at his feet');
  assert.equal(s.throwing, null);
  // Only once the arm was back (the pin out and cooking): before that, nothing.
  const b = setup();
  startThrow(b.s, b.w);
  b.run(0.1);
  b.s.alive = false;
  b.run(0.1);
  assert.equal(thrown(b.projectiles).length, 0);
});

test('a thrown grenade bounces, rolls a little, lies still and goes off on its fuse, not on landing', () => {
  for (const id of ['mk2_grenade', 'stielhandgranate24', 'rgd33']) {
    const { s, w, run, expired, projectiles } = setup(id);
    startThrow(s, w);
    releaseThrow(s, lookAim);
    run(WINDUP + SWING + 0.02);
    const [p] = thrown(projectiles);
    let landed = null,
      restY = null,
      moved = 0;
    for (let i = 0; i < 60 * 8 && p.alive; i++) {
      run(1 / 60);
      if (!landed && p.y < 0.2) landed = { x: p.x, z: p.z, age: p.age };
      if (p.resting) {
        if (restY === null) restY = { x: p.x, y: p.y, z: p.z };
        moved = Math.max(moved, Math.hypot(p.x - restY.x, p.y - restY.y, p.z - restY.z));
      }
    }
    const ex = expired.find((e) => e.p === p);
    assert.equal(ex?.why, 'fuse', `${id}: went off on its fuse`);
    assert.ok(Math.abs(ex.age - w.ammo.fuseTime) < 0.05, `${id}: after ${ex.age.toFixed(2)} s`);
    assert.ok(landed && landed.age < 3, `${id}: landed first`);
    assert.ok(restY, `${id}: came to rest`);
    assert.ok(moved < 1e-6, `${id}: lying still (moved ${moved})`);
    assert.ok(Math.abs(restY.y) < 0.01, `${id}: on the ground`);
    const roll = Math.hypot(restY.x - landed.x, restY.z - landed.z);
    assert.ok(roll < 3, `${id}: rolled ${roll.toFixed(1)} m on soil`);
  }
});

test("a bot's lob drops in close to where it aims", () => {
  for (const d of [8, 12, 16, 20]) {
    const { s, w, run, projectiles } = setup();
    const hand = { x: 0.12, y: 1.72, z: -0.35 };
    const lob = grenadeLob(hand, { x: 0, y: 0, z: -d }, w.def.throwSpeed, 0.66);
    assert.ok(lob, `${d} m is within reach`);
    startThrow(s, w, { aim: () => ({ ...hand, vx: lob.vx, vy: lob.vy, vz: lob.vz }) });
    run(WINDUP + SWING + 0.02);
    const [p] = thrown(projectiles);
    let first = null;
    for (let i = 0; i < 60 * 4 && !first; i++) {
      const vy = p.vy;
      run(1 / 60);
      if (vy < -1 && p.vy > vy * 0.2) first = { x: p.x, z: p.z };
    }
    assert.ok(first, `${d} m: landed`);
    const off = Math.hypot(first.x, first.z + d);
    assert.ok(off < 0.9, `${d} m: first bounce ${off.toFixed(2)} m from the aim point`);
  }
});

test('the third-person throw lets go when the grenade leaves the hand', () => {
  assert.equal(throwActionT({ phase: 'windup', t: 0 }), 0);
  assert.ok(Math.abs(throwActionT({ phase: 'windup', t: 5 }) - 0.36) < 1e-9, 'held drawn back');
  assert.ok(throwActionT({ phase: 'swing', t: SWING * 0.99 }) < 0.5, 'not yet');
  assert.ok(Math.abs(throwActionT({ phase: 'follow', t: 0 }) - 0.5) < 1e-9, 'let go');
  assert.equal(throwActionT({ phase: 'follow', t: FOLLOW }), 1);
});

test('out of grenades: no throw starts', () => {
  const { s, w } = setup();
  w.chambered = false;
  w.spareMags.length = 0;
  assert.equal(hasGrenade(w), false);
  assert.equal(startThrow(s, w), false);
  assert.equal(s.throwing, null);
});
