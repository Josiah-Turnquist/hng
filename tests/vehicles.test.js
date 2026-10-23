// Vehicle physics against real-world figures: ride height, acceleration, top
// speed, braking, steering mechanisms, slopes, turret traverse and armor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, spawn, run } from './helpers/vehicleWorld.js';
import { staticLoads } from '../src/vehicles/vehicle.js';
import { SHELLS } from '../src/vehicles/defs.js';
import { armorPenetrationMM, effectiveArmorMM } from '../src/ballistics/materials.js';
import { SURF } from '../src/world/heightfield.js';

const kmh = (v) => v.speed * 3.6;
const yawOf = (v) => {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(v.body.quaternion);
  return Math.atan2(-f.x, -f.z);
};

function accelerate(id, seconds) {
  const { game } = makeWorld();
  const v = spawn(game, id, 0, 400, 0);
  run(v, 2);
  const marks = {};
  run(v, seconds, (t) => {
    v.driverInput(1, 0);
    for (const k of [20, 30, 50]) if (marks[k] === undefined && kmh(v) >= k) marks[k] = t;
  });
  return { v, marks };
}

test('static wheel loads carry the weight with no turning moment', () => {
  const pts = [
    [-0.6, -1],
    [0.6, -1],
    [-0.6, 1],
    [0.6, 1],
  ];
  const loads = staticLoads(pts, [1, 1, 1, 1], 1000, 0, 0.3);
  const sum = loads.reduce((a, b) => a + b, 0);
  const mz = loads.reduce((a, f, i) => a + f * pts[i][1], 0);
  assert.ok(Math.abs(sum - 1000) < 1e-6);
  assert.ok(Math.abs(mz - 300) < 1e-6, 'moment balances the center of mass');
  assert.ok(loads[2] > loads[0], 'rear wheels carry more when the weight sits back');
});

test('vehicles settle at their modeled ride height', () => {
  for (const id of ['willys_mb', 'm4a1_sherman', 't34_76']) {
    const { game } = makeWorld();
    const v = spawn(game, id, 0, 0, 0);
    run(v, 3);
    assert.ok(Math.abs(v.body.position.y - 50 - v.def.cg[1]) < 0.02, `${id} height ${v.body.position.y}`);
    assert.ok(Math.abs(v.speed) < 0.05, `${id} at rest`);
  }
});

test('Willys MB: about 105 km/h flat out, 0-50 km/h in well under 10 s', () => {
  const { v, marks } = accelerate('willys_mb', 60);
  assert.ok(kmh(v) > 95 && kmh(v) < 112, `top speed ${kmh(v)}`);
  assert.ok(marks[50] > 4 && marks[50] < 10, `0-50 ${marks[50]}`);
});

test('Willys MB: brakes from 60 km/h in a plausible distance', () => {
  const { game } = makeWorld();
  const v = spawn(game, 'willys_mb', 0, 400, 0);
  run(v, 2);
  run(v, 40, () => v.driverInput(kmh(v) < 60 ? 1 : 0, 0));
  run(v, 0.3, () => v.driverInput(0, 0));
  const p0 = v.body.position.clone();
  let stopped = false;
  run(v, 6, () => {
    if (!stopped && v.speed < 0.2) stopped = v.body.position.distanceTo(p0);
    v.driverInput(stopped ? 0 : -1, 0);
  });
  assert.ok(stopped > 12 && stopped < 40, `stopping distance ${stopped}`);
});

test('tank top speeds match the real ones', () => {
  const expect = { m4a1_sherman: [36, 42], panzer4_h: [37, 44], t34_76: [48, 56] };
  for (const [id, [lo, hi]] of Object.entries(expect)) {
    const { v } = accelerate(id, 80);
    assert.ok(kmh(v) > lo && kmh(v) < hi, `${id} top speed ${kmh(v)}`);
  }
});

test('Sherman cannot turn on the spot; T-34 and Panzer IV can pivot on a track', () => {
  for (const [id, canPivot] of [
    ['m4a1_sherman', false],
    ['t34_76', true],
    ['panzer4_h', true],
  ]) {
    const { game } = makeWorld();
    const v = spawn(game, id, 0, 0, 0);
    run(v, 2);
    const p0 = v.body.position.clone();
    const y0 = yawOf(v);
    run(v, 8, () => v.driverInput(0, 1));
    const turned = Math.abs(((yawOf(v) - y0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * (180 / Math.PI);
    const moved = v.body.position.distanceTo(p0);
    assert.ok(turned > 15, `${id} turned ${turned}`);
    if (canPivot) assert.ok(moved < 4, `${id} pivots in place (moved ${moved} m)`);
    else assert.ok(moved > 3, `${id} has to drive round (moved ${moved} m)`);
  }
});

test('Sherman turning circle at speed is about 31 ft (controlled differential)', () => {
  const { game } = makeWorld();
  const v = spawn(game, 'm4a1_sherman', 0, 300, 0);
  run(v, 2);
  run(v, 12, () => v.driverInput(1, 0));
  run(v, 6, () => v.driverInput(1, 1));
  const r = Math.abs(v.speed / v.body.angular.y);
  assert.ok(r > 7 && r < 14, `radius ${r}`);
});

test('parked tanks and jeeps hold on a 15 degree slope', () => {
  for (const id of ['m4a1_sherman', 'willys_mb']) {
    const { game } = makeWorld({ slopeDeg: 15 });
    const v = spawn(game, id, 0, 0, 0);
    run(v, 3);
    const p0 = v.body.position.clone();
    run(v, 8);
    assert.ok(v.body.position.distanceTo(p0) < 0.3, `${id} crept ${v.body.position.distanceTo(p0)} m`);
  }
});

test('a T-34 climbs a 25 degree slope', () => {
  const { game } = makeWorld({ slopeDeg: 25, surface: SURF.DIRT });
  const v = spawn(game, 't34_76', 0, 100, 0);
  run(v, 2);
  const y0 = v.body.position.y;
  run(v, 20, () => v.driverInput(1, 0));
  assert.ok(v.body.position.y - y0 > 8, `climbed ${v.body.position.y - y0} m`);
});

test('turret traverse speed and gun laying', () => {
  const { game } = makeWorld();
  const v = spawn(game, 'panzer4_h', 0, 0, 0);
  run(v, 1);
  // Order a 90 degree traverse to the left; the Panzer IV's electric drive does ~14 deg/s.
  v.aim.yaw = Math.PI / 2;
  v.aim.pitch = 0.05;
  let t90 = null;
  run(v, 12, (t) => {
    if (t90 === null && Math.abs(v.turretYaw - Math.PI / 2) < 0.01) t90 = t;
  });
  assert.ok(t90 > 5.5 && t90 < 8.5, `90 degrees in ${t90} s`);
  const d = v.sightDir();
  assert.ok(Math.abs(Math.asin(d.y) - 0.05) < 0.002, 'sight on the ordered elevation');
});

test('main gun fires the right shell at the right speed and reloads', () => {
  const { game } = makeWorld();
  const fired = [];
  game.projectiles = { fire: (o) => (fired.push(o), { ...o }) };
  const v = spawn(game, 'm4a1_sherman', 0, 0, 0);
  run(v, 1);
  const p = v.fireMain(null);
  assert.ok(p, 'fired');
  const speed = Math.hypot(fired[0].vx, fired[0].vy, fired[0].vz);
  assert.ok(Math.abs(speed - SHELLS['M61 APC'].mv) < 15, `muzzle velocity ${speed}`);
  assert.equal(v.fireMain(null), null, 'must reload first');
  run(v, v.def.gun.reload + 0.1);
  assert.ok(v.fireMain(null), 'reloaded');
});

test('armor: historical match-ups come out right', () => {
  const deg = Math.PI / 180;
  const pen = (id, v) => armorPenetrationMM(SHELLS[id], v);
  // PzGr 39 from the long 75 at 300 m (~740 m/s) defeats the Sherman's 51 mm glacis at 56 degrees.
  assert.ok(pen('PzGr 39', 740) > effectiveArmorMM(51, 56 * deg, SHELLS['PzGr 39']));
  // The T-34/76's BR-350A at 500 m (~610 m/s) fails against the Panzer IV H's 80 mm front.
  assert.ok(pen('BR-350A', 610) < effectiveArmorMM(80, 10 * deg, SHELLS['BR-350A']));
  // ...but goes through its 30 mm side at 1000 m (~560 m/s), even angled 30 degrees.
  assert.ok(pen('BR-350A', 560) > effectiveArmorMM(30, 30 * deg, SHELLS['BR-350A']));
  // The Sherman's 75 mm M61 gets through the Panzer IV H's 80 mm front at 300 m (~590 m/s)
  // but not at 1000 m (~520 m/s).
  const pz4front = effectiveArmorMM(80, 10 * deg, SHELLS['M61 APC']);
  assert.ok(pen('M61 APC', 590) > pz4front);
  assert.ok(pen('M61 APC', 520) < pz4front);
});
