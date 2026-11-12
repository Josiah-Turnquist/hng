// Two savings in the battle's own work, and that neither changes what
// happens: a parked or wrecked vehicle rests until something disturbs it
// (vehicles/vehicle.js), and a flying round is checked against the soldiers
// and vehicles near it, found by 32 m squares, not against all of them
// (game.js _nearby).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, step } from './helpers/battle.js';

const g = await makeBattle({ perSide: 6, vehicles: true, seed: 3 });

test('a parked jeep rests, and stirs when someone gets in, when it is hit, and when a vehicle moves by', () => {
  const hf = g.world.hf;
  // Open, level ground well away from the others.
  let spot = null;
  for (let x = -600; x <= 600 && !spot; x += 40) for (let z = -600; z <= 600 && !spot; z += 40) if (hf.getSlope(x, z) < 0.04 && hf.getSurface(x, z) <= 1 && g.findParking(x, z, 0, 6, 3)) spot = { x, z };
  assert.ok(spot, 'open ground');
  const jeep = g.spawnVehicle('willys_mb', spot.x, spot.z, 0);
  assert.ok(!jeep.asleep);
  step(g, 6);
  assert.ok(jeep.asleep, 'rests once it has settled');
  const at = jeep.body.position.clone();
  let steps = 0;
  const probe = jeep._probeWheels;
  jeep._probeWheels = function () {
    steps++;
    return probe.call(this);
  };
  step(g, 3);
  assert.equal(steps, 0, 'nothing worked out while it rests');
  assert.ok(jeep.body.position.distanceTo(at) < 1e-9, 'it stays where it is');
  // Hit: awake at once.
  jeep.damage(1, null, 'test');
  assert.ok(!jeep.asleep, 'a hit stirs it');
  step(g, 6);
  assert.ok(jeep.asleep);
  // Someone gets in: awake, and it drives.
  const s = g.soldiers.find((x) => x.alive && !x.vehicle);
  s.brain = null;
  assert.ok(jeep.enter(s, 0));
  assert.ok(!jeep.asleep, 'getting in stirs it');
  jeep.engineOn = true;
  for (let i = 0; i < 180; i++) {
    jeep.driverInput?.(1, 0, false);
    g.update(1 / 60);
  }
  assert.ok(jeep.body.position.distanceTo(at) > 1, `it drove ${jeep.body.position.distanceTo(at).toFixed(1)} m`);
  jeep.exit(s);
  step(g, 8);
  assert.ok(jeep.asleep, 'rests again once left and stopped');
  // Another vehicle moving close by: awake within the quarter second it looks.
  const other = g.spawnVehicle('willys_mb', jeep.body.position.x + 5, jeep.body.position.z, 0);
  other.body.velocity.set(0, 0, -3);
  other.speed = 3;
  for (let i = 0; i < 20 && jeep.asleep; i++) {
    other.body.velocity.set(0, 0, -3);
    other.speed = 3;
    jeep._resting(1 / 60);
  }
  assert.ok(!jeep.asleep, 'a vehicle moving by stirs it');
  // A wreck rests too, and goes on burning.
  const wreck = g.spawnVehicle('willys_mb', spot.x + 30, spot.z, 0);
  step(g, 1);
  wreck.destroy?.(null, 'test');
  step(g, 8);
  assert.ok(!wreck.alive && wreck.asleep, 'a wreck rests');
  const dead = wreck.deadTime;
  step(g, 1);
  assert.ok(wreck.deadTime > dead + 0.9, 'and its time as a wreck still runs');
});

test('rounds checked against what is near them hit the same things as checked against everything', () => {
  step(g, 10);
  let seed = 99;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const p = { owner: null, ignoreTarget: null, ignoreVehicle: null, distance: 100 };
  const everything = (ox, oy, oz, dx, dy, dz, max) => {
    let best = g._raycastSoldiers(ox, oy, oz, dx, dy, dz, max, p, g.soldiers);
    for (const v of g.vehicles) {
      const hit = v.raycastArmor(ox, oy, oz, dx, dy, dz, best ? best.t : max);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    return best;
  };
  const targets = [...g.soldiers.filter((s) => s.alive).map((s) => [s.body.x, s.body.y + 1, s.body.z]), ...g.vehicles.map((v) => [v.body.position.x, v.body.position.y + 0.3, v.body.position.z])];
  let hits = 0,
    rays = 0;
  for (const [tx, ty, tz] of targets) {
    for (let k = 0; k < 12; k++) {
      // From a few metres off toward (or just past) each soldier and vehicle, at hop lengths a round makes.
      const a = rnd() * Math.PI * 2,
        d = 2 + rnd() * 30;
      const ox = tx + Math.cos(a) * d,
        oz = tz + Math.sin(a) * d,
        oy = ty + (rnd() - 0.4) * 2;
      let dx = tx - ox + (rnd() - 0.5) * 1.5,
        dy = ty - oy + (rnd() - 0.5) * 1,
        dz = tz - oz + (rnd() - 0.5) * 1.5;
      const len = Math.hypot(dx, dy, dz);
      dx /= len;
      dy /= len;
      dz /= len;
      const max = Math.min(47, d + 4);
      const near = g._raycastDynamic(ox, oy, oz, dx, dy, dz, max, p);
      const all = everything(ox, oy, oz, dx, dy, dz, max);
      rays++;
      assert.equal(!!near, !!all, `ray ${rays}: hit or miss`);
      if (near) {
        hits++;
        assert.equal(near.target, all.target, `ray ${rays}: the same target`);
        assert.ok(Math.abs(near.t - all.t) < 1e-9, `ray ${rays}: at the same distance`);
      }
    }
  }
  assert.ok(rays > 300 && hits > 60, `${hits} hits of ${rays} rays`);
  // A long ray goes against everything, as before.
  const s = g.soldiers.find((x) => x.alive && !x.vehicle);
  const far = g._raycastDynamic(s.body.x, s.body.y + 1.2, s.body.z - 200, 0, 0, 1, 400, p);
  assert.ok(far && far.t > 150, 'a 400 m ray still finds a man 200 m off');
});
