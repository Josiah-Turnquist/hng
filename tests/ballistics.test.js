// Checks the bullet physics against physics and published ballistics tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cdAt, dragDecel } from '../src/ballistics/drag.js';
import { G1, G7 } from '../src/ballistics/dragTables.js';
import { Atmosphere, STD_DENSITY } from '../src/ballistics/atmosphere.js';
import { trajectory, solveZero, rangeCard } from '../src/ballistics/solver.js';
import { AMMO } from '../src/weapons/ammo.js';
import { MATERIALS, residualSpeed, penetrationDepth, armorPenetrationMM, effectiveArmorMM } from '../src/ballistics/materials.js';
import { ProjectileSystem } from '../src/ballistics/projectiles.js';
import { CollisionWorld, Box } from '../src/physics/collision.js';
import { Heightfield } from '../src/world/heightfield.js';

const FPS = 0.3048;
const YD = 0.9144;
const std = new Atmosphere(0, 15, 0); // ICAO standard day

test('standard atmosphere matches ICAO sea level', () => {
  assert.ok(Math.abs(std.density - STD_DENSITY) < 0.002, `density ${std.density}`);
  assert.ok(Math.abs(std.speedOfSound - 340.3) < 0.5, `speed of sound ${std.speedOfSound}`);
  const high = new Atmosphere(2000, 2, 0);
  assert.ok(high.density < 1.02 && high.density > 0.98, `2000 m density ${high.density}`);
});

test('drag tables interpolate and cover the sound barrier', () => {
  assert.equal(cdAt(G1, 0), 0.2629);
  assert.ok(Math.abs(cdAt(G1, 1.0) - 0.4805) < 1e-9);
  // Between 1.0 (0.4805) and 1.025 (0.5136)
  assert.ok(Math.abs(cdAt(G1, 1.0125) - (0.4805 + 0.5136) / 2) < 1e-9);
  // G7 is much lower drag than G1 at supersonic speed (it is a sleeker shape).
  assert.ok(cdAt(G7, 2.5) < cdAt(G1, 2.5));
  // Drag deceleration of .30-06 at the muzzle is several hundred m/s^2.
  const a = dragDecel(G1, 0.4, 853, STD_DENSITY, 340.3);
  assert.ok(a > 550 && a < 800, `decel ${a}`);
});

test('without drag the trajectory is a perfect parabola', () => {
  const ammo = { bc: 1e12, drag: 'G1' };
  const v = 300,
    ang = 0.2;
  const pts = trajectory(ammo, v, ang, std, [100, 200]);
  for (const p of pts) {
    const t = p.range / (v * Math.cos(ang));
    const y = v * Math.sin(ang) * t - 0.5 * 9.80665 * t * t;
    assert.ok(Math.abs(p.y - y) < 0.002, `range ${p.range}: ${p.y} vs ${y}`);
    assert.ok(Math.abs(p.time - t) < 1e-3);
  }
});

test('.30-06 150 gr ball slows down like published ballistic tables', () => {
  // Typical published remaining velocities for a 150 gr bullet with a G1 BC of
  // 0.409 fired at 2800 fps (Army Standard Metro air, 1.2034 kg/m^3):
  // 2578 fps at 100 yd, 2366 at 200, 2166 at 300, 1974 at 400, 1793 at 500 yd.
  const metro = new Atmosphere(0, 15, 0);
  metro.density = 1.2034;
  const expected = [
    [100, 2578],
    [200, 2366],
    [300, 2166],
    [400, 1974],
    [500, 1793],
  ];
  const pts = trajectory({ bc: 0.409, drag: 'G1' }, 2800 * FPS, 0.002, metro, expected.map(([r]) => r * YD));
  pts.forEach((p, i) => {
    const fps = p.speed / FPS;
    const want = expected[i][1];
    assert.ok(Math.abs(fps - want) / want < 0.01, `${expected[i][0]} yd: ${fps.toFixed(0)} fps vs ${want}`);
  });
});

test('zeroed rifle hits point of aim at the zero range', () => {
  const ammo = AMMO['792 sS'];
  const sightHeight = 0.028;
  for (const zero of [100, 300, 500]) {
    const ang = solveZero(ammo, ammo.mv, sightHeight, zero, std);
    const [p] = trajectory(ammo, ammo.mv, ang, std, [zero], { y0: -sightHeight });
    assert.ok(Math.abs(p.y) < 0.002, `zero ${zero}: ${p.y}`);
  }
});

test('Kar98k range card is realistic', () => {
  const ammo = AMMO['792 sS'];
  const card = rangeCard(ammo, 760, 0.028, 100, std, [100, 200, 300, 400, 500, 600]);
  // Flight time to 500 m is roughly 0.75 s and the bullet stays supersonic.
  const at500 = card.find((p) => p.range === 500);
  assert.ok(at500.time > 0.7 && at500.time < 0.82, `time to 500 m ${at500.time}`);
  assert.ok(at500.speed > 520 && at500.speed < 610, `speed at 500 m ${at500.speed}`);
  // With a 100 m zero, a 500 m shot lands about 2 m low: you must raise the
  // tangent sight (or hold over) for long shots.
  assert.ok(at500.y < -1.8 && at500.y > -2.6, `drop at 500 m ${at500.y}`);
  // Energy at 300 m is still above 2000 J (lethal far beyond that).
  const at300 = card.find((p) => p.range === 300);
  assert.ok(at300.energy > 2000, `energy at 300 m ${at300.energy}`);
});

test('pistol and SMG bullets drop far more than rifle bullets', () => {
  const rifle = rangeCard(AMMO['30-06 M2'], 853, 0.025, 100, std, [200]);
  const smg = rangeCard(AMMO['45 ACP'], 285, 0.025, 100, std, [200]);
  assert.ok(smg[0].y < rifle[0].y * 5, `smg ${smg[0].y} rifle ${rifle[0].y}`);
  // A .45 from a Thompson is subsonic and takes about 0.75 s to reach 200 m.
  assert.ok(smg[0].time > 0.7 && smg[0].time < 0.85, `time ${smg[0].time}`);
});

test('bazooka rocket has a steep arc', () => {
  const r = AMMO['M6A1 rocket'];
  const ang = solveZero(r, r.mv, 0.05, 100, std);
  // About 4 degrees of elevation needed for 100 m.
  assert.ok(ang > 0.06 && ang < 0.09, `elevation ${(ang * 180) / Math.PI} deg`);
});

test('material penetration matches field guidance', () => {
  const rifle = AMMO['30-06 M2'];
  const pistol = AMMO['9 Para'];
  const area = (a) => Math.PI * (a.diameter / 2) ** 2;
  const depth = (a, v, m) => penetrationDepth(v, a.mass, area(a), MATERIALS[m]);
  const between = (x, lo, hi, what) => assert.ok(x > lo && x < hi, `${what}: ${(x * 100).toFixed(1)} cm`);
  between(depth(rifle, 850, 'wood'), 0.45, 0.8, 'rifle into pine');
  between(depth(rifle, 850, 'brick'), 0.1, 0.22, 'rifle into brick');
  between(depth(rifle, 850, 'concrete'), 0.06, 0.15, 'rifle into concrete');
  between(depth(rifle, 850, 'sandbag'), 0.25, 0.5, 'rifle into sandbags');
  between(depth(rifle, 850, 'steel'), 0.006, 0.013, 'rifle into mild steel');
  between(depth(pistol, 360, 'wood'), 0.08, 0.22, 'pistol into pine');
  between(depth(pistol, 360, 'brick'), 0.015, 0.06, 'pistol into brick');
  // A rifle bullet goes through a 2 cm plank and keeps most of its speed.
  const v = residualSpeed(850, 0.02, rifle.mass, area(rifle), MATERIALS.wood);
  assert.ok(v > 780 && v < 850, `after plank ${v}`);
  // A pistol bullet does not get through a 25 cm brick wall.
  assert.equal(residualSpeed(360, 0.25, pistol.mass, area(pistol), MATERIALS.brick), 0);
});

test('armor penetration follows impact speed and slope', () => {
  const ptrd = AMMO['145 B32'];
  assert.ok(Math.abs(armorPenetrationMM(ptrd, ptrd.penRefVel) - ptrd.penRefMM) < 1e-9);
  assert.ok(armorPenetrationMM(ptrd, 800) < ptrd.penRefMM);
  // A 45 mm plate sloped 60 degrees is about 90 mm thick along the shot line.
  assert.ok(Math.abs(effectiveArmorMM(45, Math.PI / 3, {}) - 90) < 0.01);
  // Shaped charges don't care about speed.
  const r = AMMO['RPzBGr 4322'];
  assert.equal(armorPenetrationMM(r, 50), armorPenetrationMM(r, 110));
});

function flatWorld() {
  const hf = new Heightfield(512, 65);
  hf.computeRange();
  return new CollisionWorld(hf);
}

test('projectile system: bullets fly, hit walls, and pass through thin wood', () => {
  const world = flatWorld();
  world.add(new Box(50, 1.5, 0, 0.01, 1.5, 3, 0, 'wood')); // 2 cm plank fence
  world.add(new Box(80, 1.5, 0, 0.12, 1.5, 3, 0, 'brick')); // 24 cm brick wall
  const sys = new ProjectileSystem({ world, atmosphere: std });
  const events = [];
  sys.onImpact = (p, info) => events.push({ kind: info.kind, material: info.material, x: info.x });
  const ammo = AMMO['30-06 M2'];
  sys.fire({ x: 0, y: 1.5, z: 0, vx: ammo.mv, vy: 0.4, vz: 0, ammo });
  for (let i = 0; i < 120; i++) sys.update(1 / 120);
  const kinds = events.map((e) => `${e.kind}:${e.material}`);
  assert.deepEqual(kinds.slice(0, 3), ['through:wood', 'exit:wood', 'stop:brick'], kinds.join(', '));
  assert.ok(Math.abs(events[0].x - 49.99) < 0.05);
  assert.equal(sys.active.length, 0);
});

test('projectile system: shallow shots ricochet off water', () => {
  const world = flatWorld();
  world.hf.surface.fill(10); // water
  const sys = new ProjectileSystem({ world, atmosphere: std });
  let ricochets = 0;
  sys.onImpact = (p, info) => {
    if (info.kind === 'ricochet') ricochets++;
  };
  const ammo = AMMO['30-06 M2'];
  for (let i = 0; i < 40; i++) {
    // About 2 degrees down onto the water.
    sys.fire({ x: 0, y: 1, z: 0, vx: ammo.mv, vy: -ammo.mv * 0.035, vz: 0, ammo });
  }
  for (let i = 0; i < 60; i++) sys.update(1 / 120);
  assert.ok(ricochets > 20, `ricochets ${ricochets}`);
});
