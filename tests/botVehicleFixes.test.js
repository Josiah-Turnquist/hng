// Faults found in a sweep of the computer-played soldiers and the vehicles,
// each checked here so that it stays fixed: machine gun triggers left held,
// getting off on a bridge, vehicles made inside each other or pushed while
// they rest, a bike put back where a jeep is parked, a tank crew left idle by
// a crash, tanks that never give up a way they can't get through, tanks that
// fire through their own men, and routes handed to a man who is now elsewhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, step } from './helpers/battle.js';
import { TankBrain } from '../src/ai/tankBot.js';
import { friendInLine } from '../src/ai/riderBot.js';
import { FLAG_WALKABLE } from '../src/physics/collision.js';

const g = await makeBattle({ perSide: 6, vehicles: false, seed: 1 });
step(g, 5);
const hf = g.world.hf;

// Open, level ground with room for a vehicle, not yet used by a test.
const used = [];
function openGround(room = 5) {
  for (let x = -600; x <= 600; x += 40)
    for (let z = -600; z <= 600; z += 40) {
      if (used.some((u) => Math.hypot(u.x - x, u.z - z) < 120)) continue;
      if (hf.getSlope(x, z) < 0.04 && g.findParking(x, z, 0, 6, room) && !g.soldiers.some((s) => Math.hypot(s.body.x - x, s.body.z - z) < 60)) {
        used.push({ x, z });
        return { x, z };
      }
    }
  return null;
}

// A soldier with nothing else to do (no brain of his own).
function spare(team = null) {
  const s = g.soldiers.find((x) => x.alive && !x.vehicle && x !== g.player.soldier && !x._taken && (team === null || x.team === team));
  s._taken = true;
  s.brain = null;
  return s;
}

function remove(v) {
  for (const o of v.occupants) if (o) v.exit(o);
  v.removeFromWorld();
  g.vehicles.splice(g.vehicles.indexOf(v), 1);
}

test('a machine gun stops when its gunner gets out or changes seat, and its rounds are his alone', () => {
  const at = openGround();
  const tank = g.spawnVehicle('m4a1_sherman', at.x, at.z, 0);
  const s = spare();
  // Out with the trigger held.
  assert.ok(tank.enter(s, 1));
  tank.bowMg.trigger = true;
  g.update(1 / 60);
  tank.exit(s);
  const belt = tank.bowMg.loaded;
  step(g, 3);
  assert.equal(tank.bowMg.trigger, false, 'trigger let go');
  assert.equal(tank.bowMg.pending, 0, 'no rounds kept for the next man');
  assert.equal(tank.bowMg.loaded, belt, 'the gun did not go on firing');
  // To the driver's seat with the trigger held.
  assert.ok(tank.enter(s, 1));
  tank.bowMg.trigger = true;
  g.update(1 / 60);
  assert.ok(tank.switchSeat(s, 0));
  const belt2 = tank.bowMg.loaded;
  step(g, 2);
  assert.equal(tank.bowMg.loaded, belt2, 'the bow gun stopped when he left it');
  assert.equal(tank.bowMg.pending, 0);
  remove(tank);
});

test('a bot-crewed tank still fires its coaxial gun', () => {
  const at = openGround();
  const tank = g.spawnVehicle('m4a1_sherman', at.x, at.z, 0);
  const s = spare();
  assert.ok(tank.enter(s, 0));
  const belt = tank.coax.loaded;
  for (let i = 0; i < 60; i++) {
    tank.coax.trigger = true; // (as TankBrain sets it, from the gunner's seat)
    g.update(1 / 60);
    tank.coax.takeShots();
  }
  assert.ok(tank.coax.loaded < belt, `fired ${belt - tank.coax.loaded} rounds`);
  remove(tank);
});

test('getting off a motorcycle or a jeep on a bridge leaves him on the deck, not in the river', () => {
  const decks = g.world.collision.boxes.filter((b) => b.flags & FLAG_WALKABLE && b.enabled && !b.owner && g.world.waterLevelAt?.(b.cx, b.cz) != null && b.maxY > hf.getHeight(b.cx, b.cz) + 1.5 && b.hx > 1.5 && b.hz > 1.5 && Math.abs(b.ay[1]) > 0.97);
  assert.ok(decks.length, 'a bridge over water');
  const d = decks.sort((a, b) => b.hx * b.hz - a.hx * a.hz)[0];
  const yaw = d.hz > d.hx ? d.yaw : d.yaw + Math.PI / 2;
  const s = spare();
  for (const id of ['wla', 'willys_mb']) {
    const v = g.spawnVehicle(id, d.cx, d.cz, yaw);
    v.body.position.y += d.maxY - hf.getHeight(d.cx, d.cz);
    if (v.isBike) {
      v.oy = d.maxY;
      v._sync();
    }
    step(g, 2);
    assert.ok(v.enter(s, 0));
    step(g, 0.2);
    v.exit(s);
    assert.ok(Math.abs(s.body.y - d.maxY) < 0.5, `${id}: he stands at ${s.body.y.toFixed(2)} m, the deck is at ${d.maxY.toFixed(2)} m`);
    s.body.y = d.maxY + 0.05;
    remove(v);
  }
  s.body.x = 0;
  s.body.z = 0;
  s.body.y = hf.getHeight(0, 0);
});

test('a vehicle made inside another is not thrown into the air', () => {
  const at = openGround();
  const tank = g.spawnVehicle('m4a1_sherman', at.x, at.z, 0);
  step(g, 4);
  const jeep = g.spawnVehicle('willys_mb', at.x + 0.5, at.z, 0.3);
  let up = 0;
  for (let i = 0; i < 300; i++) {
    g.update(1 / 60);
    for (const v of [tank, jeep]) up = Math.max(up, v.body.position.y - hf.getHeight(v.body.position.x, v.body.position.z));
  }
  // (It was thrown 404 m up and both were wrecked.)
  assert.ok(up < 15, `highest ${up.toFixed(1)} m above the ground`);
  assert.ok(tank.alive && jeep.alive, 'neither wrecked');
  remove(tank);
  remove(jeep);
});

test('a motorcycle does not take the top of another vehicle, above its wheels, for ground', () => {
  const at = openGround();
  const bike = g.spawnVehicle('r75', at.x, at.z - 2.2, Math.PI / 2);
  step(g, 2);
  const oy = bike.oy;
  // A tank driven into the parked machine: its wheels inside the tank's front.
  const tank = g.spawnVehicle('panzer4_h', at.x, at.z, 0);
  bike._probe();
  for (const w of bike.wheels) assert.ok(!w.hit || w.gy < oy + 0.3, `a wheel finds ground ${(w.gy - oy).toFixed(2)} m above where it stands (the tank)`);
  remove(bike);
  remove(tank);
});

test('pushing on a resting jeep wakes it, and nothing saved up throws it when it wakes', () => {
  const at = openGround();
  const jeep = g.spawnVehicle('willys_mb', at.x, at.z, 0);
  step(g, 4);
  assert.ok(jeep.asleep);
  const tank = g.spawnVehicle('m4a1_sherman', at.x, at.z + (jeep.def.dims[2] + 5.9) / 2 + 0.1, 0);
  step(g, 2);
  const s = spare();
  tank.enter(s, 0);
  let fast = 0,
    up = 0;
  for (let i = 0; i < 60 * 8; i++) {
    tank.driverInput(0.4, 0, false);
    g.update(1 / 60);
    // (130 MN piled up on it in 15 s, and the jeep flew when it woke.)
    assert.ok(jeep.body.force.length() < 5e6, `force on it ${(jeep.body.force.length() / 1e6).toFixed(1)} MN`);
  }
  tank.driverInput(0, 0, true);
  jeep.stir();
  for (let i = 0; i < 240; i++) {
    g.update(1 / 60);
    fast = Math.max(fast, jeep.body.velocity.length());
    up = Math.max(up, jeep.body.position.y - hf.getHeight(jeep.body.position.x, jeep.body.position.z));
  }
  assert.ok(fast < 8 && up < 3, `fastest ${fast.toFixed(1)} m/s, highest ${up.toFixed(1)} m`);
  remove(tank);
  remove(jeep);
});

test('a motorcycle is not put back on its place while a jeep stands there', async () => {
  const { BikeStands } = await import('../src/vehicles/bikeSpots.js');
  const at = openGround();
  const stands = new BikeStands(g);
  const bike = stands.park('wla', at.x, at.z, 0, { team: 0 });
  assert.ok(bike, 'parked');
  const spot = stands.spots[0];
  // Wrecked long ago, nobody near; a jeep has been parked on its place.
  bike.damage(bike.hp + 1, null, 'test');
  spot.deadT = 1000;
  const jeep = g.spawnVehicle('willys_mb', spot.cx, spot.cz, 0);
  stands.update(1 / 60);
  assert.equal(spot.v, bike, 'it waits');
  remove(jeep);
  stands.update(1 / 60);
  assert.notEqual(spot.v, bike, 'and is put back once the place is clear');
  assert.ok(spot.v.alive);
  remove(spot.v);
});

test('a tank crewman whose tank is wrecked in a crash fights on foot', () => {
  const at = openGround();
  const tank = g.spawnVehicle('panzer4_h', at.x, at.z, 0);
  const s = spare();
  tank.enter(s, 0);
  s.brain = new TankBrain(g, s, tank);
  tank.damage(tank.hp + 1, null, 'crash');
  assert.ok(s.alive && !s.vehicle, 'he climbed out');
  step(g, 1);
  assert.equal(s.brain?.constructor.name, 'BotBrain');
  s.brain = null;
  remove(tank);
});

test('a tank stuck in the same place again and again gives up that point', () => {
  const at = openGround();
  const tank = g.spawnVehicle('m4a1_sherman', at.x, at.z, 0);
  const s = spare();
  tank.enter(s, 0);
  const brain = new TankBrain(g, s, tank);
  const goal = { id: 'TEST', x: at.x, z: at.z - 300 };
  brain.goal = goal;
  // Wedged: whatever the driver does, it doesn't move.
  tank.driverInput = () => {};
  tank.speed = 0;
  let tries = 0;
  for (let t = 0; t < 60 && brain.goal; t += 1 / 60) {
    if (!brain.path) {
      brain.path = [{ x: at.x, z: at.z - 100 }];
      brain.pathI = 0;
      tries++;
    }
    brain._drive(1 / 60);
  }
  assert.equal(brain.goal, null, 'gave up the point');
  assert.ok(brain.noRoute.has('TEST'), 'left to others for a while');
  assert.ok(tries <= 4, `after ${tries} tries`);
  delete tank.driverInput;
  remove(tank);
});

test('a tank does not fire through its own men', () => {
  for (const x of g.soldiers) x._taken = false;
  const at = openGround();
  const tank = g.spawnVehicle('m4a1_sherman', at.x, at.z, 0);
  const crew = spare(0);
  tank.enter(crew, 0);
  const foe = spare(1);
  const friend = spare(0);
  const put = (o, dz) => {
    o.body.x = at.x;
    o.body.z = at.z - dz;
    o.body.y = hf.getHeight(o.body.x, o.body.z);
    o.body.vx = o.body.vz = 0;
  };
  const shots = (withFriend) => {
    const brain = new TankBrain(g, crew, tank);
    put(foe, 150);
    put(friend, withFriend ? 60 : 400);
    friend.body.x += withFriend ? 0 : 200;
    let fired = 0;
    const loaded = () => tank.loaded;
    for (let i = 0; i < 60 * 8; i++) {
      put(foe, 150);
      if (withFriend) put(friend, 60);
      brain.target = { kind: 'soldier', obj: foe };
      const was = loaded();
      brain._gun(1 / 60);
      if (was && !loaded()) fired++;
      fired += tank.coax.shots;
      tank.coax.shots = 0;
      g.update(1 / 60);
      tank.coax.takeShots();
    }
    return fired;
  };
  assert.ok(shots(false) > 0, 'with the way clear he fires');
  assert.equal(shots(true), 0, 'with a comrade in the way he holds fire');
  assert.ok(friendInLine(crew, { x: at.x, y: friend.body.y + 1, z: at.z }, { x: 0, y: 0, z: -1 }, 150));
  remove(tank);
});

test('a route worked out for a man is not handed over once he is somewhere else', () => {
  const nav = g.nav;
  const who = {};
  const a = { x: 0, z: 0 },
    goal = { x: 150, z: 150 };
  let p;
  for (let i = 0; i < 400 && (p = nav.findPathSoon(who, a.x, a.z, goal.x, goal.z)) === undefined; i++) nav.tick();
  // Asked again (and answered), then the answer collected from 600 m away.
  nav.findPathSoon(who, a.x, a.z, goal.x, goal.z);
  for (let i = 0; i < 400 && nav.answers.size === 0; i++) nav.tick();
  assert.ok(nav.answers.has(who), 'an answer waits');
  const far = nav.findPathSoon(who, -600, 0, goal.x, goal.z);
  assert.equal(far, undefined, 'the old route is not handed over');
  nav.forget(who);
  assert.ok(!nav.answers.has(who) && !nav.queue.some((q) => q.who === who), 'forgotten');
});
