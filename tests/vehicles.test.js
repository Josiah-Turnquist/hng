// Vehicle physics against real-world figures: ride height, acceleration, top
// speed, braking, steering mechanisms, slopes, turret traverse and armor; and
// the bicycles and motorcycles: speeds, pedal power, lean in turns, braking,
// sidecar stability, crashes, rider poses, engine sounds and the bots riding them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, spawn, run, rider } from './helpers/vehicleWorld.js';
import { staticLoads, TURN_CIRCLE } from '../src/vehicles/vehicle.js';
import { Box } from '../src/physics/collision.js';
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

test('Willys MB: about 105 km/h flat out, 0-50 km/h in about 4 s (twice its real pick-up, for gameplay)', () => {
  const { v, marks } = accelerate('willys_mb', 60);
  assert.ok(kmh(v) > 95 && kmh(v) < 112, `top speed ${kmh(v)}`);
  assert.ok(marks[50] > 2.5 && marks[50] < 5.5, `0-50 ${marks[50]}`);
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
  const expect = { m4a1_sherman: [36, 42], panzer4_h: [37, 44], t34_76: [48, 56], t34_85: [48, 57], tiger1: [36, 46], m5a1_stuart: [50, 61] };
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

test('Tiger I turns on the spot in neutral (regenerative steering)', () => {
  const { game } = makeWorld();
  const v = spawn(game, 'tiger1', 0, 0, 0);
  run(v, 2);
  const p0 = v.body.position.clone();
  const y0 = yawOf(v);
  run(v, 8, () => v.driverInput(0, 1));
  const turned = Math.abs(((yawOf(v) - y0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * (180 / Math.PI);
  assert.ok(turned > 30, `turned ${turned}`);
  assert.ok(v.body.position.distanceTo(p0) < 2, `stayed in place (${v.body.position.distanceTo(p0)} m)`);
});

test('Opel Blitz: a slow, heavy truck (about 80-90 km/h flat out)', () => {
  const { v } = accelerate('opel_blitz', 120);
  assert.ok(kmh(v) > 70 && kmh(v) < 95, `top speed ${kmh(v)}`);
});

test('Sherman turns at speed on a fixed circle (the real 31 ft, a quarter tighter for gameplay)', () => {
  const { game } = makeWorld();
  const v = spawn(game, 'm4a1_sherman', 0, 300, 0);
  run(v, 2);
  // (Six seconds now get it to the speed twelve did with the real pick-up.)
  run(v, 6, () => v.driverInput(1, 0));
  run(v, 6, () => v.driverInput(1, 1));
  const r = Math.abs(v.speed / v.body.angular.y);
  assert.ok(r > 6.3 && r < 9, `radius ${r}`);
});

test('gameplay: twice the pick-up and a quarter sharper turns than the real figures, the same top speeds', () => {
  // 0-20 km/h (the real machines: Willys 2.1 s, T-34/76 7.9 s, WLA 2.5 s).
  const t20 = (id) => {
    const { game } = makeWorld({ size: 2048 });
    const v = spawn(game, id, 0, 900, 0);
    run(v, 2);
    let t = 0;
    for (; t < 30 && kmh(v) < 20; t += 1 / 120) {
      v.driverInput(1, 0);
      v.step(1 / 120);
    }
    return t;
  };
  for (const [id, lo, hi] of [
    ['willys_mb', 0.8, 1.5],
    ['t34_76', 3, 4.8],
    ['wla', 1, 1.7],
  ]) {
    const t = t20(id);
    assert.ok(t > lo && t < hi, `${id} 0-20 km/h in ${t.toFixed(2)} s, want ${lo}-${hi}`);
  }
  // Turning circle at 10 km/h with the wheel or bars full over (real: Willys 4.0 m, WLA 3.4 m radius).
  const circle = (id) => {
    const { game } = makeWorld({ size: 2048 });
    const v = spawn(game, id, 0, 900, 0);
    run(v, 2);
    const drive = () => (kmh(v) < 10 ? Math.min(1, (10 - kmh(v)) / 4 + 0.3) : 0);
    run(v, 20, () => v.driverInput(drive(), 0));
    let w = 0,
      u = 0,
      n = 0;
    run(v, 10, (t) => {
      v.driverInput(drive(), 1);
      if (t > 5) {
        w += Math.abs(v.yawRate ?? v.body.angular.y);
        u += v.speed;
        n++;
      }
    });
    return u / w;
  };
  for (const [id, lo, hi] of [
    ['willys_mb', 2.7, 3.3],
    ['wla', 2.3, 2.9],
  ]) {
    const r = circle(id);
    assert.ok(r > lo && r < hi, `${id} turning radius at 10 km/h ${r.toFixed(2)} m, want ${lo}-${hi}`);
  }
  // Swinging round on the spot (real: T-34/76 7.6, Tiger 26 degrees a second).
  for (const [id, lo, hi] of [
    ['t34_76', 8.5, 11.5],
    ['tiger1', 30, 37],
  ]) {
    const { game } = makeWorld();
    const v = spawn(game, id, 0, 0, 0);
    run(v, 2);
    let s = 0,
      n = 0;
    run(v, 8, (t) => {
      v.driverInput(0, 1);
      if (t > 4) {
        s += Math.abs(v.body.angular.y);
        n++;
      }
    });
    const rate = ((s / n) * 180) / Math.PI;
    assert.ok(rate > lo && rate < hi, `${id} pivots at ${rate.toFixed(1)} deg/s, want ${lo}-${hi}`);
  }
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

// ---------------------------------------------------------------------------
// Bicycles and motorcycles (bike.js, bikeDefs.js).

const G = 9.80665;

// Ride flat out on a long straight road; the best speed reached.
function topSpeed(id, seconds = 60) {
  const { game } = makeWorld({ size: 2048 });
  const v = spawn(game, id, 0, 900, 0);
  run(v, 1);
  let top = 0;
  run(v, seconds, () => {
    v.driverInput(1, 0);
    top = Math.max(top, kmh(v));
  });
  return { v, top };
}

test('motorcycles: real top speeds, solo and with sidecar', () => {
  // WLA about 105 km/h (65 mph allowed); R 75 outfit 92-95; M-72 outfit 85-90.
  const want = { wla: [96, 108], r75_sidecar: [88, 100], m72_sidecar: [82, 94], wla_sidecar: [80, 95], m72: [92, 108] };
  for (const [id, [lo, hi]] of Object.entries(want)) {
    const { v, top } = topSpeed(id);
    assert.ok(top > lo && top < hi, `${id}: ${top.toFixed(1)} km/h, want ${lo}-${hi}`);
    assert.ok(!v.fallen, `${id} fell over`);
  }
});

test('bicycle: about 18 km/h at a steady effort, a sprint near 30 km/h that fades, hills slow it', () => {
  const ride = (slopeDeg, sprint, seconds) => {
    const { game } = makeWorld({ size: 2048, slopeDeg });
    const v = spawn(game, 'bicycle', 0, 600, 0);
    run(v, 1);
    let top = 0;
    run(v, seconds, () => {
      v.driverInput(1, 0, false, sprint);
      top = Math.max(top, kmh(v));
    });
    return { v, top, end: kmh(v) };
  };
  const cruise = ride(0, false, 40);
  assert.ok(cruise.end > 15 && cruise.end < 22, `cruise ${cruise.end.toFixed(1)} km/h`);
  assert.ok(Math.abs(cruise.v.power - 160) < 25, `cruise power ${cruise.v.power.toFixed(0)} W`);
  // (With the soldiers' bigger stamina, STAMINA_POOL, a sprint lasts a couple of minutes.)
  const sprint = ride(0, true, 150);
  assert.ok(sprint.top > 27 && sprint.top < 36, `sprint peak ${sprint.top.toFixed(1)} km/h`);
  assert.ok(sprint.end < sprint.top - 2, `the sprint fades as he tires (${sprint.end.toFixed(1)} km/h at the end)`);
  assert.ok(sprint.v.occupants[0].body.stamina < 60, `sprinting uses stamina (${sprint.v.occupants[0].body.stamina.toFixed(0)} left)`);
  // A 3 degree (5 %) climb: walking pace and a little more at a steady effort.
  const hill = ride(3, false, 30);
  assert.ok(hill.end > 4 && hill.end < 10, `uphill ${hill.end.toFixed(1)} km/h`);
  // Coasting down the same slope, it runs away to over 30 km/h.
  const { game } = makeWorld({ size: 2048, slopeDeg: 3 });
  const v = spawn(game, 'bicycle', 0, -600, Math.PI);
  run(v, 3, () => v.driverInput(1, 0));
  run(v, 40, () => v.driverInput(0, 0));
  assert.ok(kmh(v) > 30, `downhill coasting ${kmh(v).toFixed(1)} km/h`);
  assert.equal(v.effort, 'coast');
});

test('bicycle: climbs real hills at a walk to a jog, standing on the pedals when it gets steep', () => {
  // A fit soldier with his kit on a loaded single-speed: about 2-3 m/s up a 6-8 %
  // road, slower on steeper ones, faster for a while standing hard on the pedals.
  const climb = (grade, sprint, seconds = 8) => {
    const { game } = makeWorld({ size: 2048, slopeDeg: (Math.atan(grade) * 180) / Math.PI });
    const v = spawn(game, 'bicycle', 0, 600, 0);
    run(v, 1);
    run(v, seconds, () => v.driverInput(1, 0, false, sprint));
    return v;
  };
  for (const [grade, lo, hi] of [
    [0.06, 2.2, 3.2],
    [0.08, 1.8, 2.8],
    [0.1, 1.3, 2.4],
    [0.15, 0.7, 1.8],
  ]) {
    const v = climb(grade, false);
    assert.ok(v.speed > lo && v.speed < hi, `${grade * 100} % at a steady effort: ${v.speed.toFixed(2)} m/s, want ${lo}-${hi}`);
    assert.ok(!v.fallen, `fell on the ${grade * 100} % climb`);
  }
  const hard = climb(0.08, true, 6);
  assert.ok(hard.speed > 3, `8 % standing on the pedals: ${hard.speed.toFixed(2)} m/s`);
  // Down a 10 % hill: coasting runs it up past 30 km/h, and the brakes stop it.
  const { game } = makeWorld({ size: 2048, slopeDeg: (Math.atan(0.1) * 180) / Math.PI });
  const v = spawn(game, 'bicycle', 0, -600, Math.PI);
  run(v, 2, () => v.driverInput(1, 0));
  run(v, 30, () => v.driverInput(0, 0));
  assert.ok(kmh(v) > 30, `coasting down 10 %: ${kmh(v).toFixed(1)} km/h`);
  const z0 = v.body.position.z;
  let t = 0;
  for (; t < 15 && v.speed > 0.2; t += 1 / 120) {
    v.driverInput(-1, 0, true);
    v.step(1 / 120);
  }
  assert.ok(v.speed < 0.3 && v.body.position.z - z0 < 40, `stopped in ${(v.body.position.z - z0).toFixed(1)} m (${t.toFixed(1)} s)`);
  run(v, 3, () => v.driverInput(0, 0));
  assert.ok(Math.abs(v.speed) < 0.3, `held still on the hill (${v.speed.toFixed(2)} m/s)`);
});

test('bicycle: three times the pick-up of the plain figures (gameplay), the same cruising and sprint speeds', () => {
  // Without the gain: 0-15 km/h in 12.8 s at a steady effort, 0-20 km/h in 7.3 s sprinting.
  const pick = (sprint, to) => {
    const { game } = makeWorld({ size: 2048 });
    const v = spawn(game, 'bicycle', 0, 900, 0);
    run(v, 1);
    let t = 0;
    for (; t < 40 && kmh(v) < to; t += 1 / 120) {
      v.driverInput(1, 0, false, sprint);
      v.step(1 / 120);
    }
    return t;
  };
  const cruise = pick(false, 15),
    sprint = pick(true, 20);
  assert.ok(cruise > 3.2 && cruise < 5.5, `0-15 km/h at a steady effort in ${cruise.toFixed(2)} s`);
  assert.ok(sprint > 1.8 && sprint < 3.2, `0-20 km/h sprinting in ${sprint.toFixed(2)} s`);
});

test('parked machines stand upright on their stands, also with a wheel up on a kerb; outfits sit with the ground', () => {
  // A stone kerb 10 cm high under the rear wheel (it used to throw the machine in the air).
  for (const id of ['bicycle', 'wla']) {
    const { game, collision } = makeWorld();
    collision.add(new Box(0, 49.95, 0.9, 0.6, 0.15, 0.45, 0, 'stone'));
    const v = spawn(game, id, 0, 0, 0, { empty: true });
    const p0 = v.body.position.clone();
    run(v, 4);
    assert.ok(!v.fallen && Math.abs(v.lean) < 0.03, `${id} stands upright (lean ${((v.lean * 180) / Math.PI).toFixed(1)} deg)`);
    assert.ok(v.body.position.distanceTo(p0) < 0.15 && v.asleep, `${id} stays put on the kerb (moved ${v.body.position.distanceTo(p0).toFixed(2)} m)`);
    assert.ok(v.pitch < -0.03, `${id} sits nose down off the kerb (${((v.pitch * 180) / Math.PI).toFixed(1)} deg)`);
  }
  // A sidecar outfit parked across a 10 degree slope sits tilted with it and stays on its wheels.
  const { game } = makeWorld({ slopeDeg: 10 });
  const v = spawn(game, 'r75_sidecar', 0, 0, Math.PI / 2, { empty: true });
  run(v, 4);
  assert.ok(!v.fallen, 'the outfit stays on its wheels');
  assert.ok(Math.abs(Math.abs(v.lean) - 10 * (Math.PI / 180)) < 2 * (Math.PI / 180), `tilted with the ground (${((v.lean * 180) / Math.PI).toFixed(1)} deg)`);
});

test('a straight ride stays upright; a steady turn leans by tan(lean) = v^2 / (g R)', () => {
  const { game } = makeWorld({ size: 2048 });
  const v = spawn(game, 'wla', 0, 0, 0);
  run(v, 1);
  let maxLean = 0;
  run(v, 25, (t) => {
    v.driverInput(kmh(v) < 50 ? 1 : 0, 0);
    if (t > 3) maxLean = Math.max(maxLean, Math.abs(v.lean));
  });
  assert.ok(maxLean < 2 * (Math.PI / 180), `lean on a straight ${((maxLean * 180) / Math.PI).toFixed(2)} deg`);
  assert.ok(Math.abs(v.body.position.x) < 8, `wandered ${v.body.position.x.toFixed(1)} m off the line`);
  for (const [id, speed, steer] of [
    ['wla', 40, 0.4],
    ['r75', 60, 0.6],
    ['bicycle', 15, 0.5],
  ]) {
    const { game: g2 } = makeWorld({ size: 2048 });
    const b = spawn(g2, id, 0, 0, 0);
    run(b, 1);
    run(b, 25, () => b.driverInput(kmh(b) < speed ? 1 : 0, 0));
    let lean = 0,
      r = 0,
      u = 0,
      n = 0;
    run(b, 10, (t) => {
      b.driverInput(kmh(b) < speed ? 0.6 : 0, steer);
      if (t > 5) {
        lean += b.lean;
        r += b.yawRate;
        u += b.speed;
        n++;
      }
    });
    lean /= n;
    u /= n;
    const R = u / Math.abs(r / n);
    const ideal = Math.atan((u * u) / (G * R));
    assert.ok(lean > 0.1, `${id} leans into a right turn (${((lean * 180) / Math.PI).toFixed(1)} deg)`);
    assert.ok(Math.abs(lean - ideal) < 2.5 * (Math.PI / 180), `${id}: lean ${((lean * 180) / Math.PI).toFixed(1)} deg, v^2/gR gives ${((ideal * 180) / Math.PI).toFixed(1)}`);
    assert.ok(!b.fallen);
  }
});

test('motorcycles cannot turn sharply at speed', () => {
  // Full bars at 70 km/h: the rider leans as far as he dares, no further.
  const { game } = makeWorld({ size: 2048 });
  const v = spawn(game, 'wla', 0, 0, 0);
  run(v, 1);
  run(v, 30, () => v.driverInput(kmh(v) < 70 ? 1 : 0, 0));
  let minR = Infinity,
    maxLean = 0;
  run(v, 6, (t) => {
    v.driverInput(kmh(v) < 70 ? 0.5 : 0, 1);
    if (t > 2) {
      minR = Math.min(minR, Math.abs(v.speed / v.yawRate));
      maxLean = Math.max(maxLean, Math.abs(v.lean));
    }
  });
  assert.ok(minR > 35, `turn radius at 70 km/h ${minR.toFixed(1)} m`);
  assert.ok(maxLean < 35 * (Math.PI / 180), `lean ${((maxLean * 180) / Math.PI).toFixed(1)} deg`);
  assert.ok(!v.fallen, 'stays up on a dry road');
});

test('braking: front brake does most of the work, sensible stopping distances', () => {
  const stop = (id, from) => {
    const { game } = makeWorld({ size: 2048 });
    const v = spawn(game, id, 0, 800, 0);
    run(v, 1);
    for (let t = 0; t < 60 && kmh(v) < from; t += 1 / 120) {
      v.driverInput(1, 0, false, true);
      v.step(1 / 120);
    }
    const z0 = v.body.position.z;
    let nf = 0,
      nr = 0;
    for (let t = 0; t < 20 && v.speed > 0.1; t += 1 / 120) {
      v.driverInput(-1, 0);
      v.step(1 / 120);
      nf = Math.max(nf, v.wF.N);
      nr = Math.max(nr, v.wR.N);
    }
    return { v, d: z0 - v.body.position.z, nf };
  };
  const wla = stop('wla', 50);
  // About 0.4-0.6 g on drum brakes: 16-25 m from 50 km/h.
  assert.ok(wla.d > 16 && wla.d < 26, `WLA from 50 km/h: ${wla.d.toFixed(1)} m`);
  assert.ok(!wla.v.fallen);
  // Weight transfer loads the front wheel well past its static share.
  const statF = wla.v.wF.L;
  assert.ok(wla.nf > statF * 1.3, `front load ${wla.nf.toFixed(0)} N vs static ${statF.toFixed(0)} N`);
  const bike = stop('bicycle', 25);
  assert.ok(bike.d > 4 && bike.d < 10, `bicycle from 25 km/h: ${bike.d.toFixed(1)} m`);
  const outfit = stop('r75_sidecar', 50);
  assert.ok(outfit.d > 15 && outfit.d < 28, `R 75 outfit from 50 km/h: ${outfit.d.toFixed(1)} m`);
});

test('sidecar outfits stay on three wheels in gentle turns either way', () => {
  // (A gentle turn: 0.3 of the real bars, which now turn a quarter sharper.)
  for (const steer of [0.3 * TURN_CIRCLE, -0.3 * TURN_CIRCLE]) {
    const { game } = makeWorld({ size: 2048 });
    const v = spawn(game, 'r75_sidecar', 0, 0, 0);
    run(v, 1);
    run(v, 20, () => v.driverInput(kmh(v) < 40 ? 1 : 0, 0));
    let minSide = Infinity,
      maxRoll = 0;
    run(v, 10, () => {
      v.driverInput(kmh(v) < 40 ? 0.6 : 0, steer);
      minSide = Math.min(minSide, v.wS.N);
      maxRoll = Math.max(maxRoll, Math.abs(v.lean));
    });
    assert.ok(minSide > 300, `sidecar wheel load fell to ${minSide.toFixed(0)} N (steer ${steer})`);
    assert.ok(maxRoll < 3 * (Math.PI / 180), `outfit rolled ${((maxRoll * 180) / Math.PI).toFixed(1)} deg`);
    assert.ok(Math.abs(v.yawRate) > 0.05, 'it turned');
    assert.ok(!v.fallen);
  }
});

test('too much lean on grass puts a motorcycle down and hurts the rider', () => {
  const { game } = makeWorld({ size: 2048, surface: SURF.GRASS });
  const v = spawn(game, 'wla', 0, 0, 0);
  const man = v.occupants[0];
  run(v, 1);
  run(v, 25, () => v.driverInput(kmh(v) < 60 ? 1 : 0, 0));
  run(v, 6, () => v.driverInput(kmh(v) < 60 ? 0.6 : 0, 1));
  assert.ok(v.fallen, 'it went down');
  assert.ok(!v.occupants[0], 'the rider was thrown off');
  assert.ok(man.hurt > 5, `the rider got hurt (${(man.hurt || 0).toFixed(0)})`);
});

test('parked machines go to sleep on their stands; riders sit where riderPose says', () => {
  const { game } = makeWorld();
  const v = spawn(game, 'r75', 0, 0, 0, { empty: true });
  run(v, 4);
  assert.ok(v.asleep, 'a parked motorcycle stops simulating');
  assert.ok(Math.abs(v.lean) < 0.03, `stands upright on its rear stand (${((v.lean * 180) / Math.PI).toFixed(1)} deg)`);
  assert.ok(v.onStand, 'on its stand');
  // Rider poses: the interface the soldier models read.
  const bike = spawn(game, 'bicycle', 10, 0, 0);
  run(bike, 3, () => bike.driverInput(1, 0));
  const pose = bike.riderPose(0, {});
  assert.equal(pose.style, 'bicycle');
  assert.ok(pose.hip.isVector3 && pose.handL.isVector3 && pose.handR.isVector3 && pose.footL.isVector3 && pose.footR.isVector3);
  assert.ok(typeof pose.pedal === 'number', 'pedal crank angle');
  const ground = game.world.hf.getHeight(pose.hip.x, pose.hip.z);
  assert.ok(pose.hip.y - ground > 0.9 && pose.hip.y - ground < 1.3, `saddle height ${(pose.hip.y - ground).toFixed(2)}`);
  assert.ok(pose.handL.distanceTo(pose.handR) > 0.4, 'hands on both grips');
  const eye = bike.seatPos(0, new THREE.Vector3(), 'eye');
  assert.ok(eye.y > pose.hip.y + 0.5, 'eye above the hips');
  const outfit = spawn(game, 'm72_sidecar', 20, 0, 0, { empty: true });
  const side = outfit.riderPose(1, {});
  assert.equal(side.style, 'sidecar');
  assert.ok(side.handR?.isVector3, 'sidecar gunner holds the machine gun');
  assert.equal(outfit.riderPose(5, {}), null);
});

test('the V-twin fires unevenly (315/405 degrees), the flat twins evenly', async () => {
  const { generateSound, SOUNDS } = await import('../src/audio/synth.js');
  const { BIKE_ENGINE_SPECS } = await import('../src/audio/recipes/bikes.js');
  const corr = (id, deg) => {
    const sr = 48000 * SOUNDS[id].rate;
    const x = generateSound(id, 0, sr);
    const cycle = 120 / BIKE_ENGINE_SPECS[id].refRpm;
    const lag = Math.round((deg / 720) * cycle * sr);
    let s = 0,
      s0 = 0;
    for (let i = 0; i < x.length; i++) {
      s += x[i] * x[(i + lag) % x.length];
      s0 += x[i] * x[i];
    }
    return s / s0;
  };
  assert.ok(corr('engineVTwin', 315) > corr('engineVTwin', 360) + 0.1, 'V-twin: the beat comes in pairs');
  assert.ok(corr('engineBoxer', 360) > corr('engineBoxer', 315) + 0.3, 'boxer: one even beat per turn');
  assert.ok(corr('engineBoxerSV', 360) > corr('engineBoxerSV', 315) + 0.3, 'M-72: one even beat per turn');
});

test('a bot rides a motorcycle toward a far goal and gets off short of it', async () => {
  const { BikeRide } = await import('../src/ai/riderBot.js');
  for (const [id, angleDeg] of [
    ['wla', 150],
    ['r75_sidecar', -100],
    ['bicycle', 40],
  ]) {
    const { game } = makeWorld({ size: 2048, surface: SURF.ROAD });
    const v = spawn(game, id, 0, 0, 0);
    const man = v.occupants[0];
    man.team = 1;
    const a = (angleDeg * Math.PI) / 180;
    const goal = { id: 'G', x: -Math.sin(a) * 300, z: -Math.cos(a) * 300, radius: 20 };
    game.mode = { botGoal: () => goal };
    const brain = { s: man, game, goal, thinkT: 1, target: null, skill: { aim: 1.4 }, path: null, _perceive() {}, lookYaw: 0 };
    const ride = new BikeRide(brain, v);
    ride.phase = 'ride';
    let t = 0;
    for (; t < 90; t += 1 / 120) {
      game.navBudget = 1;
      if (!ride.update(1 / 120)) break;
      v.step(1 / 120);
      game.time += 1 / 120;
    }
    const d = Math.hypot(goal.x - man.body.x, goal.z - man.body.z);
    assert.ok(!v.fallen, `${id} fell on the way`);
    assert.ok(!man.vehicle, `${id}: still aboard after ${t.toFixed(0)} s`);
    assert.ok(d > 25 && d < 95, `${id}: got off ${d.toFixed(0)} m from the goal`);
  }
});

test('a bot in the sidecar lays the machine gun on an enemy and fires bursts', async () => {
  const { GunnerRide } = await import('../src/ai/riderBot.js');
  const { game } = makeWorld({ size: 2048 });
  const v = spawn(game, 'r75_sidecar', 0, 0, 0);
  const seat = v.seats.findIndex((s) => s.role === 'sidecarMg');
  const gunner = { ...rider(), team: 1, game, alive: true };
  game.soldiers.push(gunner);
  assert.ok(v.enter(gunner, seat));
  const enemy = { alive: true, team: 0, game, body: { x: 60, y: 50, z: -150, vx: 0, vz: 0 } };
  game.soldiers.push(enemy);
  const shots = [];
  game.vehicleMgShot = (veh, mg, anchor, dir) => shots.push(dir.clone());
  const brain = { s: gunner, game, goal: null, thinkT: 1, target: enemy, skill: { aim: 1.4 }, path: null, _perceive() {}, lookYaw: 0 };
  const ride = new GunnerRide(brain, v, seat);
  ride.phase = 'sit';
  run(v, 4, () => ride.update(1 / 120));
  assert.ok(shots.length >= 10 && shots.length < 57, `${shots.length} rounds in 4 s (bursts, not one long one)`);
  // The gunner aims with a human error he keeps correcting, so judge the
  // spread: nine shots in ten within 4 degrees, none wild.
  const want = Math.atan2(-60, 150);
  const off = shots.map((d) => Math.abs(Math.atan2(-d.x, -d.z) - want) / (Math.PI / 180)).sort((a, b) => a - b);
  assert.ok(off[Math.floor(off.length * 0.9)] < 4, `90% of rounds within ${off[Math.floor(off.length * 0.9)].toFixed(1)} degrees`);
  assert.ok(off[off.length - 1] < 8, `a round ${off[off.length - 1].toFixed(1)} degrees off`);
});

// Steering, as the player feels it. (Bikes used to swing the wrong way first
// and run on long after the key was let go; tanks and jeeps ran on too.)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
function cruise(id, speed, { surface } = {}) {
  const { game } = makeWorld({ size: 2048, surface });
  const v = spawn(game, id, 0, 600, 0);
  run(v, 1.5);
  run(v, 30, () => v.driverInput(kmh(v) < speed ? 1 : 0, 0, false, id === 'bicycle' && kmh(v) < speed - 3));
  return v;
}

test('steering answers the way it is pressed at once, and stops soon after the key is let go', () => {
  for (const [id, speed, runOnMax] of [
    ['willys_mb', 29, 8],
    ['m4a1_sherman', 22, 14],
    ['wla', 45, 9],
    ['bicycle', 18, 20],
    ['r75_sidecar', 40, 4],
  ]) {
    const v = cruise(id, speed);
    const hold = () => (kmh(v) < speed ? 0.6 : 0);
    const y0 = yawOf(v);
    let wrongWay = 0;
    run(v, 1.2, () => {
      v.driverInput(hold(), 1);
      wrongWay = Math.max(wrongWay, wrap(yawOf(v) - y0)); // (a right turn takes the yaw down)
    });
    const turned = -wrap(yawOf(v) - y0);
    const y1 = yawOf(v);
    run(v, 3, () => v.driverInput(hold(), 0));
    const runOn = Math.abs(wrap(yawOf(v) - y1));
    assert.ok(wrongWay < 1 * DEG, `${id} first swung ${(wrongWay / DEG).toFixed(1)} degrees the wrong way`);
    assert.ok(turned > 10 * DEG, `${id} turned ${(turned / DEG).toFixed(1)} degrees in 1.2 s`);
    assert.ok(runOn < runOnMax * DEG, `${id} turned on ${(runOn / DEG).toFixed(1)} degrees after the key was let go`);
    assert.ok(!v.fallen);
  }
});

test('holding the throttle and a turn key does not put a motorcycle or an outfit down', () => {
  for (const [id, surface, steer] of [
    ['wla', SURF.ROAD, 1],
    ['m72', SURF.ROAD, -1],
    ['r75', SURF.GRASS, 1],
    ['wla', SURF.DIRT, -1],
    ['wla_sidecar', SURF.ROAD, 1],
    ['m72_sidecar', SURF.GRASS, 1],
    ['r75_sidecar', SURF.ROAD, -1],
  ]) {
    const { game } = makeWorld({ size: 2048, surface });
    const v = spawn(game, id, 0, 600, 0);
    run(v, 1.5);
    run(v, 3, () => v.driverInput(1, 0));
    let turned = 0;
    let last = yawOf(v);
    run(v, 8, () => {
      v.driverInput(1, steer);
      turned += wrap(yawOf(v) - last);
      last = yawOf(v);
    });
    assert.ok(!v.fallen, `${id} went down (${v.fallCause}) holding a turn`);
    assert.ok(Math.abs(turned) > 60 * DEG, `${id} only turned ${(Math.abs(turned) / DEG).toFixed(0)} degrees in 8 s`);
    assert.ok(kmh(v) > 15, `${id} slowed to ${kmh(v).toFixed(0)} km/h in the turn`);
  }
});

test('clutch-brake and epicyclic tanks turn at speed; a jeep holds its turn at speed', () => {
  for (const id of ['t34_76', 't34_85', 'panzer4_h']) {
    const v = cruise(id, 32);
    let s = 0,
      n = 0;
    run(v, 2, (t) => {
      v.driverInput(kmh(v) < 32 ? 0.6 : 0, 1);
      if (t > 1) {
        s += Math.abs(v.body.angular.y);
        n++;
      }
    });
    assert.ok(s / n > 10 * DEG, `${id} turns at ${((s / n) / DEG).toFixed(1)} degrees a second at 32 km/h`);
  }
  // Full lock at 50 km/h: the turn settles near its first rate instead of fading.
  const v = cruise('willys_mb', 50);
  let peak = 0;
  run(v, 1.5, () => {
    v.driverInput(kmh(v) < 50 ? 0.6 : 0, 1);
    peak = Math.max(peak, Math.abs(v.body.angular.y));
  });
  assert.ok(Math.abs(v.body.angular.y) > 0.7 * peak, `the turn faded from ${(peak / DEG).toFixed(0)} to ${(Math.abs(v.body.angular.y) / DEG).toFixed(0)} degrees a second`);
});
