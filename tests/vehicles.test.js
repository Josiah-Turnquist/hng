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
import { Game } from '../src/game/game.js';
import { ProjectileSystem } from '../src/ballistics/projectiles.js';
import { buildVehicle } from '../src/vehicles/models/index.js';
import { VEHICLES } from '../src/vehicles/defs.js';
import { TrackedVehicle } from '../src/vehicles/tracked.js';
import { PlayerController } from '../src/game/player.js';
import { BikeStands } from '../src/vehicles/bikeSpots.js';

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

test('a tank\'s own shells never hurt it or its crew at the muzzle: on a wall just in front, or fired out over its own hull', () => {
  // The real Sherman (its muzzle and armor where the model puts them) in a
  // game with real shells, blasts and fragments; the crew stand-ins count
  // their injuries.
  const { game: base, world, collision } = makeWorld();
  const g = Object.create(Game.prototype);
  const noop = () => {};
  Object.assign(g, base, { headless: true, mode: {}, effects: { impact: noop, spawn: noop, muzzle: noop, explosion: noop, bulletHole: noop, flashLight: noop } });
  g.hud = { flash: noop, hitMarker: noop, killFeed: noop, shotFrom: noop, damage: noop };
  g.projectiles = new ProjectileSystem({ world: collision, atmosphere: world.atmosphere, dynamicRaycast: (...a) => g._raycastDynamic(...a) });
  g.projectiles.onImpact = (p, info) => g._onImpact(p, info);
  g.projectiles.onExpire = (p, why) => g._onExpire(p, why);
  const textures = { standard: () => new THREE.MeshStandardMaterial(), get: () => ({}) };
  const def = { ...VEHICLES.m4a1_sherman, id: 'm4a1_sherman' };
  const v = new TrackedVehicle(g, def, buildVehicle('m4a1_sherman', textures), 0, 0, 0);
  g.vehicles.push(v);
  const crew = [rider(), rider()];
  crew.forEach((m, i) => {
    Object.assign(m, { team: 1, seat: -1, vehicle: null });
    v.enter(m, i);
    g.soldiers.push(m);
  });
  g.player = { soldier: crew[0], eye: { x: 0, y: -100, z: 0 } };
  run(v, 1);
  const shoot = (shell, setup) => {
    v.hp = v.maxHp;
    v.loaded = shell;
    v.reloadT = 0;
    const wall = setup();
    v.syncModel(0);
    assert.ok(v.fireMain(crew[0]), 'fired');
    for (let i = 0; i < 120; i++) g.projectiles.update(1 / 120);
    if (wall) collision.remove(wall);
    return { lost: v.maxHp - v.hp, hurt: crew.map((m) => m.hurt || 0) };
  };
  // A brick wall square to the bore, its face `d` m beyond the muzzle (or
  // round it, the barrel through a hole in it).
  const wallAt = (d) => () => {
    v.turretYaw = v.gunElev = 0;
    v.syncModel(0);
    const m = v.muzzleWorld(new THREE.Vector3()),
      dir = v.boreDir(new THREE.Vector3());
    const box = new Box(m.x + dir.x * (d + 0.25), m.y, m.z + dir.z * (d + 0.25), 3, 2, 0.25, Math.atan2(-dir.x, -dir.z), 'brick');
    collision.add(box);
    return box;
  };
  for (const shell of ['M48 HE', 'M61 APC'])
    for (const d of [-0.3, 0.5, 2]) {
      const r = shoot(shell, wallAt(d));
      assert.ok(r.lost === 0 && r.hurt.every((h) => h === 0), `${shell} on a wall ${d} m from the muzzle: the tank lost ${r.lost.toFixed(1)}, the crew took ${r.hurt}`);
    }
  // Turret over the engine deck and the gun down: the shell leaves from out
  // over the hull and bursts on the ground just behind it.
  const r = shoot('M48 HE', () => {
    v.turretYaw = Math.PI;
    v.gunElev = -10 * (Math.PI / 180);
    v.aim.yaw = Math.PI;
    v.aim.pitch = v.gunElev;
    return null;
  });
  assert.ok(r.lost === 0 && r.hurt.every((h) => h === 0), `fired over the engine deck: the tank lost ${r.lost.toFixed(1)}, the crew took ${r.hurt}`);
  // Another tank's shell bursting on that wall still hurts it.
  const hp = v.hp;
  const w = wallAt(0.5)();
  const m = v.muzzleWorld(new THREE.Vector3());
  g.projectiles.fire({ x: m.x, y: m.y, z: m.z - 10, vx: 0, vy: 0, vz: 460, ammo: SHELLS['M48 HE'], owner: null });
  for (let i = 0; i < 60; i++) g.projectiles.update(1 / 120);
  collision.remove(w);
  assert.ok(v.hp < hp, 'a shell from elsewhere bursting there damages it');
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

test('bicycle: about 25 km/h at a steady effort (quicker than running), 5 km/h more pedalling hard, hills slow it', () => {
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
  // (Gameplay: a real soldier's steady 160 W rides at 18 km/h, slower than the
  // game's soldiers sprint on foot, 22 km/h: see bikeDefs.)
  assert.ok(cruise.end > 23 && cruise.end < 27, `cruise ${cruise.end.toFixed(1)} km/h`);
  assert.ok(Math.abs(cruise.v.power - cruise.v.def.pedal.cruise) < 25, `cruise power ${cruise.v.power.toFixed(0)} W`);
  // (With the soldiers' bigger stamina, STAMINA_POOL, a sprint lasts a couple of minutes.)
  const sprint = ride(0, true, 150);
  assert.ok(sprint.top > cruise.end + 3.5 && sprint.top < cruise.end + 6.5, `pedalling hard ${sprint.top.toFixed(1)} km/h`);
  assert.ok(sprint.v.occupants[0].body.stamina < 85, `sprinting uses stamina (${sprint.v.occupants[0].body.stamina.toFixed(0)} left)`);
  // A 3 degree (5 %) climb: slower than on the flat, still quicker than running.
  const hill = ride(3, false, 30);
  assert.ok(hill.end > 11 && hill.end < 19, `uphill ${hill.end.toFixed(1)} km/h`);
  // Coasting down the same slope, it runs away to over 30 km/h.
  const { game } = makeWorld({ size: 2048, slopeDeg: 3 });
  const v = spawn(game, 'bicycle', 0, -600, Math.PI);
  run(v, 3, () => v.driverInput(1, 0));
  run(v, 40, () => v.driverInput(0, 0));
  assert.ok(kmh(v) > 30, `downhill coasting ${kmh(v).toFixed(1)} km/h`);
  assert.equal(v.effort, 'coast');
});

test('bicycle: climbs hills, slower as they steepen, standing on the pedals when it gets steep', () => {
  // (A real fit soldier with his kit on a loaded single-speed does about 2-3 m/s
  // up a 6-8 % road; the game's rider is stronger: see bikeDefs.)
  const climb = (grade, sprint, seconds = 8) => {
    const { game } = makeWorld({ size: 2048, slopeDeg: (Math.atan(grade) * 180) / Math.PI });
    const v = spawn(game, 'bicycle', 0, 600, 0);
    run(v, 1);
    run(v, seconds, () => v.driverInput(1, 0, false, sprint));
    return v;
  };
  for (const [grade, lo, hi] of [
    [0.06, 3.3, 4.4],
    [0.08, 2.7, 3.7],
    [0.1, 2.2, 3.2],
    [0.15, 0.7, 1.8],
  ]) {
    const v = climb(grade, false);
    assert.ok(v.speed > lo && v.speed < hi, `${grade * 100} % at a steady effort: ${v.speed.toFixed(2)} m/s, want ${lo}-${hi}`);
    assert.ok(!v.fallen, `fell on the ${grade * 100} % climb`);
  }
  const hard = climb(0.08, true, 6);
  assert.ok(hard.speed > 3.7, `8 % standing on the pedals: ${hard.speed.toFixed(2)} m/s`);
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

test('bicycle: a full turn at riding speed comes round quickly and stays up', () => {
  // (At 25 km/h a quarter turn in about 1.7 s, as a real rider manages at 18:
  // gameplay lean and grip, see bikeDefs.)
  for (const sprint of [false, true]) {
    const { game } = makeWorld({ size: 2048, surface: SURF.GRASS });
    const v = spawn(game, 'bicycle', 0, 600, 0);
    run(v, 1);
    run(v, 12, () => v.driverInput(1, 0, false, sprint));
    let turned = 0,
      last = v.yaw,
      t90 = null;
    run(v, 4, (t) => {
      v.driverInput(1, 1, false, sprint);
      const d = v.yaw - last;
      turned += Math.atan2(Math.sin(d), Math.cos(d));
      last = v.yaw;
      if (t90 === null && Math.abs(turned) >= Math.PI / 2) t90 = t;
    });
    assert.ok(!v.fallen, `fell in the turn (${sprint ? 'pedalling hard' : 'steady'})`);
    assert.ok(t90 !== null && t90 < (sprint ? 2.2 : 2.0), `a quarter turn ${sprint ? 'pedalling hard' : 'steady'} in ${t90?.toFixed(2)} s`);
  }
});

test('bicycle: three times the pick-up of the plain figures (gameplay)', () => {
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
  assert.ok(cruise > 1.4 && cruise < 2.8, `0-15 km/h at a steady effort in ${cruise.toFixed(2)} s`);
  assert.ok(sprint > 1.8 && sprint < 3.2, `0-20 km/h sprinting in ${sprint.toFixed(2)} s`);
});

test('bicycle: holding W gets it going on grass, leaf litter and crops too (most of a battlefield), and up a grassy hill', () => {
  // With the real figures his steady 160 W gave 9 km/h on grass and 5 on a
  // ploughed field, slower than a soldier jogs (13 km/h), and nothing at all in
  // mud or sand (his legs could not push it off against them).
  const ride = (surface, seconds, slopeDeg = 0) => {
    const { game } = makeWorld({ size: 2048, surface, slopeDeg });
    const v = spawn(game, 'bicycle', 0, 600, 0);
    run(v, 1);
    let t15 = null;
    run(v, seconds, (t) => {
      v.driverInput(1, 0);
      if (t15 === null && kmh(v) >= 15) t15 = t;
    });
    return { v, t15 };
  };
  const grass = ride(SURF.GRASS, 20);
  assert.ok(grass.t15 !== null && grass.t15 < 3, `0-15 km/h on grass in ${grass.t15?.toFixed(1)} s`);
  assert.ok(kmh(grass.v) > 23 && kmh(grass.v) < 27, `cruising on grass at ${kmh(grass.v).toFixed(1)} km/h`);
  // He works harder there, but no harder than he can keep up (his stamina
  // stays near full).
  const pd = grass.v.def.pedal;
  assert.ok(grass.v.power > pd.cruise + 30 && grass.v.power < pd.cp + 8, `on grass at ${grass.v.power.toFixed(0)} W`);
  assert.ok(grass.v.occupants[0].body.stamina > 90, `stamina ${grass.v.occupants[0].body.stamina.toFixed(0)}`);
  for (const [name, lo, hi] of [
    ['FOREST', 22, 26.5],
    ['WHEAT', 21, 25.5],
    ['FIELD', 19.5, 24],
    ['MUD', 15.5, 20.5],
    ['SAND', 13.5, 18],
  ]) {
    const { v } = ride(SURF[name], 15);
    assert.ok(kmh(v) > lo && kmh(v) < hi, `${name.toLowerCase()}: ${kmh(v).toFixed(1)} km/h, want ${lo}-${hi}`);
  }
  // A 6 % grassy hill: he rides up it at about a running pace, not walking it.
  const hill = ride(SURF.GRASS, 12, (Math.atan(0.06) * 180) / Math.PI);
  assert.ok(!hill.v.walking && !hill.v.fallen && kmh(hill.v) > 9 && kmh(hill.v) < 18, `6 % on grass: ${kmh(hill.v).toFixed(1)} km/h`);
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
  // (The footboards touch at about 31 degrees; for gameplay riders lean a little past that.)
  assert.ok(maxLean < 38 * (Math.PI / 180), `lean ${((maxLean * 180) / Math.PI).toFixed(1)} deg`);
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

// Drive into a brick wall at a set speed, head-on or at an angle; the people
// aboard are stand-ins that count their injuries. Returns the share of the
// vehicle's strength lost and what each of them took.
function intoWall(id, kmhAt, angleDeg = 0) {
  const { game, collision } = makeWorld({ size: 2048 });
  const v = spawn(game, id, 0, 800, 0);
  const people = [v.occupants[0]];
  for (let i = 1; i < v.seats.length; i++) {
    const r = rider();
    if (v.enter(r, i)) people.push(r);
  }
  run(v, 1);
  for (let t = 0; t < 40 && kmh(v) < kmhAt; t += 1 / 120) {
    v.driverInput(1, 0);
    v.step(1 / 120);
  }
  const p = v.body.position;
  collision.add(new Box(p.x, 52, p.z - v.def.dims[2] / 2 - 5, 30, 2.5, 1, (angleDeg * Math.PI) / 180, 'brick'));
  const hp = v.hp;
  let hit = false;
  run(v, 4, () => {
    hit ||= v.lastImpact > 1;
    v.driverInput(hit ? 0 : kmh(v) < kmhAt ? 1 : 0.2, 0);
  });
  return { v, lost: (hp - Math.max(0, v.hp)) / v.maxHp, hurt: people.map((m) => m.hurt || 0) };
}

test('crashes: bumping a wall is nothing, 60 km/h into one hurts, 80 km/h and more kills', () => {
  // A crash used to be charged on every step of the simulation while the
  // vehicle stopped, and a vehicle wrecked that way killed everybody in it: a
  // jeep lost half its strength at 40 km/h, and at 60 km/h it and its crew
  // were gone.
  const slow = intoWall('willys_mb', 25);
  assert.ok(slow.lost < 0.01 && slow.hurt.every((h) => h === 0), `25 km/h: jeep lost ${(slow.lost * 100).toFixed(0)} %, crew hurt ${slow.hurt}`);
  const bump = intoWall('willys_mb', 40);
  assert.ok(bump.lost < 0.1 && bump.hurt.every((h) => h < 10), `40 km/h: jeep lost ${(bump.lost * 100).toFixed(0)} %, crew hurt ${bump.hurt.map(Math.round)}`);
  const hard = intoWall('willys_mb', 60);
  assert.ok(hard.v.alive && hard.lost < 0.6, `60 km/h: jeep lost ${(hard.lost * 100).toFixed(0)} %`);
  assert.ok(hard.hurt.every((h) => h > 20 && h < 70), `60 km/h: crew hurt ${hard.hurt.map(Math.round)}, but alive`);
  const glance = intoWall('willys_mb', 60, 60);
  assert.ok(glance.lost < 0.05 && glance.hurt.every((h) => h < 5), `scraping a wall at 60 km/h: jeep lost ${(glance.lost * 100).toFixed(0)} %, crew hurt ${glance.hurt.map(Math.round)}`);
  const fast = intoWall('willys_mb', 90);
  assert.ok(fast.hurt.every((h) => h >= 100), `90 km/h: crew hurt ${fast.hurt.map(Math.round)}`);
  // A tank flat out into a wall: a dent; the crew are braced inside.
  const tank = intoWall('m4a1_sherman', 37);
  assert.ok(tank.lost < 0.1 && tank.hurt.every((h) => h === 0), `Sherman at 37 km/h: lost ${(tank.lost * 100).toFixed(0)} %, crew hurt ${tank.hurt}`);
  // Motorcycles: off over the bars, hurt by how hard he hits the wall.
  const moto = intoWall('wla', 40);
  assert.ok(moto.v.fallen && moto.hurt[0] < 10, `WLA at 40 km/h: rider hurt ${moto.hurt[0].toFixed(0)}`);
  const motoFast = intoWall('wla', 100);
  assert.ok(motoFast.hurt[0] >= 100, `WLA at 100 km/h: rider hurt ${motoFast.hurt[0].toFixed(0)}`);
  const outfit = intoWall('r75_sidecar', 50);
  assert.ok(outfit.hurt.every((h) => h > 5 && h < 30), `R 75 outfit at 50 km/h: hurt ${outfit.hurt.map(Math.round)}`);
});

test('falling or jumping off a motorcycle at an ordinary speed hurts a little; at full speed it can kill', () => {
  const at = (kmhAt, fn) => {
    const { game } = makeWorld({ size: 2048 });
    const v = spawn(game, 'wla', 0, 800, 0);
    const man = v.occupants[0];
    run(v, 1);
    for (let t = 0; t < 40 && kmh(v) < kmhAt; t += 1 / 120) {
      v.driverInput(1, 0);
      v.step(1 / 120);
    }
    fn(v, man);
    run(v, 1, () => v.driverInput(0, 0));
    return man.hurt || 0;
  };
  const fall = (k) => at(k, (v) => v._fall(1, 'slide'));
  const jump = (k) => at(k, (v, man) => v.exit(man));
  assert.ok(fall(25) < 1, `down at 25 km/h: hurt ${fall(25).toFixed(1)}`);
  assert.ok(fall(45) < 15, `down at 45 km/h: hurt ${fall(45).toFixed(1)}`);
  assert.ok(jump(50) < 20, `off at 50 km/h: hurt ${jump(50).toFixed(1)}`);
  assert.ok(fall(100) >= 100, `down at 100 km/h: hurt ${fall(100).toFixed(1)}`);
});

test('a rider who gets off or is thrown off is not run down by his own machine as it goes on', () => {
  for (const [id, how] of [
    ['wla', 'off'],
    ['wla', 'thrown'],
    ['r75_sidecar', 'off'],
    ['willys_mb', 'off'],
  ]) {
    const { game } = makeWorld({ size: 2048 });
    const g = Object.create(Game.prototype);
    const noop = () => {};
    Object.assign(g, game, { effects: { spawn: noop, flashLight: noop, explosion: noop }, hud: { killFeed: noop, flash: noop, hitMarker: noop } });
    const v = spawn(g, id, 0, 800, 0);
    const man = v.occupants[0];
    Object.assign(man, { team: 1 });
    g.soldiers.push(man);
    run(v, 1);
    for (let t = 0; t < 30 && kmh(v) < 60; t += 1 / 120) {
      v.driverInput(1, 0);
      v.step(1 / 120);
    }
    // Somebody standing in the road ahead is still run down.
    const p = v.body.position;
    const other = { ...rider(), team: 0, body: { x: p.x, y: 50, z: p.z - 25, vx: 0, vz: 0 } };
    g.soldiers.push(other);
    if (how === 'off') v.exit(man);
    else v._fall(1, 'slide');
    const jump = man.hurt || 0;
    for (let t = 0; t < 2; t += 1 / 120) {
      v.step(1 / 120);
      g.time += 1 / 120;
      g._runOver();
    }
    assert.equal(man.hurt || 0, jump, `${id}, ${how} at 60 km/h: hurt ${jump.toFixed(0)} getting off, ${((man.hurt || 0) - jump).toFixed(0)} more by his own machine`);
    if (how === 'off' && id === 'wla') assert.ok(other.hurt > 0, `${id} still runs down someone in its way`);
  }
});

test('running into a parked bicycle or jeep does not hurt; one driving into you does', () => {
  for (const id of ['bicycle', 'willys_mb']) {
    const { game } = makeWorld({ size: 2048 });
    const g = Object.create(Game.prototype);
    const noop = () => {};
    Object.assign(g, game, { effects: { spawn: noop, flashLight: noop, explosion: noop }, hud: { killFeed: noop, flash: noop, hitMarker: noop } });
    const v = spawn(g, id, 0, 800, 0, { empty: true });
    run(v, 2);
    const p = v.body.position;
    // A sprint (6 m/s) straight into its side.
    const man = { ...rider(), team: 0, body: { x: p.x + 2, y: p.y, z: p.z, vx: -6, vz: 0 } };
    g.soldiers.push(man);
    for (let t = 0; t < 0.6; t += 1 / 120) {
      man.body.x += man.body.vx / 120;
      man.body.vx = Math.min(man.body.vx, -6) || -6;
      g.time += 1 / 120;
      g._runOver();
    }
    assert.equal(man.hurt || 0, 0, `${id}: hurt ${(man.hurt || 0).toFixed(0)} running into it parked`);
  }
  // A jeep driven at about 30 km/h into a man standing in the road.
  const { game } = makeWorld({ size: 2048 });
  const g = Object.create(Game.prototype);
  const noop = () => {};
  Object.assign(g, game, { effects: { spawn: noop, flashLight: noop, explosion: noop }, hud: { killFeed: noop, flash: noop, hitMarker: noop } });
  const v = spawn(g, 'willys_mb', 0, 800, 0);
  run(v, 1);
  for (let t = 0; t < 20 && kmh(v) < 30; t += 1 / 120) {
    v.driverInput(1, 0);
    v.step(1 / 120);
  }
  const p = v.body.position;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(v.body.quaternion);
  const other = { ...rider(), team: 0, body: { x: p.x + fwd.x * 6, y: p.y, z: p.z + fwd.z * 6, vx: 0, vz: 0 } };
  g.soldiers.push(other);
  for (let t = 0; t < 1.5 && !other.hurt; t += 1 / 120) {
    v.driverInput(1, 0);
    v.step(1 / 120);
    g.time += 1 / 120;
    g._runOver();
  }
  assert.ok(other.hurt > 20, `run down at 30 km/h: hurt ${(other.hurt || 0).toFixed(0)}`);
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
    ['wla', 45, 12],
    ['bicycle', 18, 28], // (it turns 90 degrees in those 1.2 s: the run-on is a quarter of that)
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

// A parked machine, a rider gets on and holds W for `seconds`: its speed
// then, the slowest it went (backward is negative) and how far it got.
function pullAway(id, surface, { slopePct = 0, yaw = 0, seconds = 10 } = {}) {
  const { game } = makeWorld({ size: 2048, surface, slopeDeg: (Math.atan(slopePct / 100) * 180) / Math.PI });
  const v = spawn(game, id, 0, 0, yaw, { empty: true });
  run(v, 2);
  v.enter(rider(), 0);
  const p0 = v.body.position.clone();
  let min = 0;
  run(v, seconds, () => {
    v.driverInput(1, 0);
    min = Math.min(min, v.speed);
  });
  return { v, kmh: kmh(v), min, moved: v.body.position.distanceTo(p0) };
}

test('motorcycles pull away from rest on the battlefield\'s ground: grass, ploughed fields, mud and hills', () => {
  const all = ['wla', 'r75', 'm72', 'wla_sidecar', 'r75_sidecar', 'm72_sidecar'];
  // Up a 20 % grass bank, from a standstill, and on up it. (The outfits whose
  // sidecar wheel is not driven used to stall there with the clutch slipping
  // and the rear wheel spinning: the steady pull was cut by the share of it
  // that spins up the engine, and the rear tire had a real tire's grip.)
  for (const id of all) {
    const r = pullAway(id, SURF.GRASS, { slopePct: 20 });
    assert.ok(r.kmh > 10 && !r.v.fallen, `${id} up 20 % of grass: ${r.kmh.toFixed(1)} km/h after 10 s`);
  }
  // Up a 15 % ploughed field, and along flat mud.
  for (const id of all) {
    const field = pullAway(id, SURF.FIELD, { slopePct: 15 });
    assert.ok(field.kmh > 10, `${id} up 15 % of ploughed field: ${field.kmh.toFixed(1)} km/h after 10 s`);
    const mud = pullAway(id, SURF.MUD);
    assert.ok(mud.kmh > 15, `${id} on flat mud: ${mud.kmh.toFixed(1)} km/h after 10 s`);
  }
  // It doesn't roll back down a hill while he kicks the engine into life.
  for (const id of ['wla', 'wla_sidecar']) {
    const r = pullAway(id, SURF.DRY_GRASS, { slopePct: 10, seconds: 3 });
    assert.ok(r.min > -0.1, `${id} rolled back ${(-r.min * 3.6).toFixed(1)} km/h pulling away up 10 %`);
  }
});

test('a sidecar outfit parked across a hillside pulls away, its chair uphill or downhill', () => {
  // The rider read the outfit's tilt with the ground as its chair lifting, and
  // with the chair uphill he kept off the throttle: it never moved.
  for (const id of ['wla_sidecar', 'r75_sidecar', 'm72_sidecar'])
    for (const [yaw, side] of [
      [Math.PI / 2, 'chair uphill'],
      [-Math.PI / 2, 'chair downhill'],
    ]) {
      const r = pullAway(id, SURF.DRY_GRASS, { slopePct: 10, yaw });
      assert.ok(r.kmh > 30 && r.moved > 40 && !r.v.fallen, `${id}, ${side} on a 10 % hillside: ${r.kmh.toFixed(1)} km/h, ${r.moved.toFixed(0)} m in 10 s`);
    }
});

test('motorcycles are parked with room to ride off: not nose to a tree, a jeep or another machine', () => {
  // On the town map 6 of the 14 motorcycles had something solid within 6 m
  // ahead (one outfit a parked jeep 2.7 m in front), and pressing W went nowhere.
  const { game, collision } = makeWorld();
  game.spawnVehicle = (id, x, z, yaw) => spawn(game, id, x, z, yaw, { empty: true });
  const stands = new BikeStands(game);
  const tree = new Box(0, 51, -4, 0.4, 1, 0.4, 0, 'wood');
  collision.add(tree);
  // (A row of them, as at a spawn point: each must keep clear of the others' way.)
  const parked = ['wla', 'wla_sidecar', 'wla', 'r75_sidecar'].map((id) => stands.park(id, 0, 0, 0, { r0: 0, r1: 20 }));
  // The lane each one rides off along: from the far side of the motorcycle to
  // the far side of its chair, 6 m on from its front.
  const lane = (v) => (v.rig ? [-0.45, v.def.sidecar.track + 0.45] : [-v.def.dims[0] / 2, v.def.dims[0] / 2]);
  for (const v of parked) {
    assert.ok(v, 'parked');
    const [x0, x1] = lane(v);
    const things = [{ p: new THREE.Vector3(tree.cx, 51, tree.cz), r: 0.4, what: 'the tree' }];
    // (The others by their wheels: front, back and the chair's.)
    for (const o of parked) {
      if (o === v) continue;
      const L = o.def.dims[2];
      const pts = [new THREE.Vector3(0, 0.5, -L / 2), new THREE.Vector3(0, 0.5, L / 2)];
      if (o.rig) pts.push(new THREE.Vector3(o.def.sidecar.track, 0.5, o.def.sidecar.z));
      for (const q of pts) things.push({ p: o._modelToWorld(q, new THREE.Vector3()), r: 0.45, what: `the ${o.def.id}` });
    }
    for (const t of things) {
      const m = v.worldToModel(t.p, new THREE.Vector3());
      const ahead = -m.z - v.def.dims[2] / 2;
      assert.ok(!(ahead > -t.r && ahead < 6 + t.r && m.x > x0 - t.r && m.x < x1 + t.r), `${v.def.id} parked with ${t.what} ${ahead.toFixed(1)} m ahead`);
    }
  }
});

test('getting on beside a machine (F) puts a lone player on the saddle; the sidecar only when the saddle is taken', () => {
  const { game } = makeWorld();
  const v = spawn(game, 'wla_sidecar', 0, 0, 0, { empty: true });
  run(v, 1);
  const near = (x, z) => PlayerController.prototype.nearestVehicle.call({ soldier: { body: { x, y: 50, z } }, game });
  // On the rider's side, beside the chair, and behind it.
  for (const [x, z] of [
    [-1.2, 0],
    [2.3, 0],
    [0.5, 1.9],
  ]) {
    const n = near(x, z);
    assert.ok(n && n.v === v && n.seat === 0, `from (${x}, ${z}): ${n ? `seat ${n.seat}` : 'out of reach'}`);
  }
  v.enter(rider(), 0);
  const n = near(-1.2, 0);
  assert.equal(v.seats[n.seat].role, 'sidecarMg', 'with somebody on the saddle, the sidecar');
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
