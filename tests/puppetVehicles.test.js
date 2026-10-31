// Online, the vehicles are puppets: the server drives them and the browser only
// hears where each is and how it is turned (net/online.js, net/protocol.js).
// What shows and is heard must still go as the server's own vehicle does
// (vehicle.js followPose): the engine's revs, gear and load for its sound and
// exhaust, the wheels rolling and steering and their springs, the tracks
// running each at the speed of its side, the turret motor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onlineRide } from './helpers/onlineRide.js';

// Drive the server's vehicle through a run (pull away, a right turn, coast,
// brake to a stop) and compare the puppet with it every tenth of a second.
function drive(id, check = () => {}, opts = {}) {
  const sim = onlineRide(id, 2, opts);
  const s = { n: 0, rpmErr: [], sameGear: 0, loadOn: [], loadOff: [] };
  const each = (phase) => (b, t) => {
    if (++s.n % 12 !== 0 || t < 0.3) return;
    const v = sim.v;
    if (v.engineOn && v.gear !== 0) s.rpmErr.push(Math.abs(b.rpm - v.rpm) / v.rpm);
    // (In a gear change, or not yet in the next one a tenth of a second later.)
    if (Math.abs(v.speed) > 1 && phase !== 'brake') {
      s.moving = (s.moving || 0) + 1;
      if (b.gear === v.gear || b.gear === 0 || v.gear === 0) s.sameGear++;
    }
    if (phase === 'pull') s.loadOn.push(b.load);
    if (phase === 'coast') s.loadOff.push(b.load);
    check(phase, v, b, sim);
  };
  sim.run(1.5, () => sim.v.driverInput(0, 0), each('idle'));
  sim.run(8, () => sim.v.driverInput(1, 0), each('pull'));
  sim.run(3, () => sim.v.driverInput(0.6, 0.6), each('turn'));
  sim.run(3, () => sim.v.driverInput(0, 0), each('coast'));
  sim.run(6, () => sim.v.driverInput(sim.v.speed > 0.3 ? -1 : 0, 0), each('brake'));
  const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  return { sim, rpmErr: median(s.rpmErr), gear: s.sameGear / s.moving, loadOn: median(s.loadOn), loadOff: median(s.loadOff) };
}

const engineHeard = (id, r) => {
  assert.ok(r.rpmErr < 0.12, `${id}: its revs follow the server's (typically ${(r.rpmErr * 100).toFixed(0)} % off)`);
  assert.ok(r.gear > 0.8, `${id}: in the server's gear ${(r.gear * 100).toFixed(0)} % of the time`);
  assert.ok(r.loadOn > 0.6 && r.loadOff < 0.15, `${id}: worked hard pulling away (load ${r.loadOn.toFixed(2)}), not coasting (${r.loadOff.toFixed(2)})`);
  assert.ok(r.sim.puppet.engineOn && r.sim.puppet.alive, `${id}: its engine runs`);
};

test("online, a car's engine revs and changes gear as the server's, its wheels roll, steer and spring", () => {
  let turned = 0,
    rolled = 0,
    sprung = 0,
    samples = 0;
  const r = drive('willys_mb', (phase, v, b) => {
    samples++;
    const spd = b.followSpeed; // (as it shows: b.speed is the server's, a tenth of a second ahead)
    if (Math.abs(spd) > 1 && b.wheels.every((w) => Math.abs(w.spin * w.radius - spd) < 0.05)) rolled++;
    // The springs: as far in as the server's, wheel by wheel.
    if (b.wheels.every((w, i) => Math.abs(w.compression - v.wheels[i].compression) < 0.02)) sprung++;
    if (phase === 'turn' && v.speed > 3) {
      // Turning right: the fronts steer right (the inner one more), the rears don't.
      const [fl, fr, rl, rr] = b.wheels;
      const [sfl] = v.wheels;
      if (fl.steerAngle < 0 && fr.steerAngle < fl.steerAngle && rl.steerAngle === 0 && rr.steerAngle === 0 && Math.abs(fl.steerAngle - sfl.steerAngle) < 0.6 * Math.abs(sfl.steerAngle) && b.steer > 0.03) turned++;
    }
  });
  engineHeard('willys_mb', r);
  assert.ok(rolled > 50, `the wheels roll with the ground (${rolled} times)`);
  assert.ok(sprung > 0.85 * samples, `the springs give as the server's (${sprung} of ${samples})`);
  assert.ok(turned > 15, `the front wheels and the steering wheel turn into the turn (${turned} times)`);
});

test("online, a truck's engine follows the server's", () => {
  engineHeard('opel_blitz', drive('opel_blitz'));
});

test("from a server that doesn't send a vehicle's state, a car's engine is worked out from how it moves", () => {
  const r = drive('willys_mb', () => {}, { oldServer: true });
  assert.ok(!r.sim.puppet._state, "(no state from the server)");
  engineHeard('willys_mb', r);
});

test("online, a tank's tracks run each at its side's speed, and its engine and turret motor are heard", () => {
  let tracked = 0,
    turning = 0,
    whine = 0;
  const r = drive('m4a1_sherman', (phase, v, b, sim) => {
    if (b.trackSpeed.every((x, i) => Math.abs(x - v.trackSpeed[i]) < 0.6)) tracked++;
    if (phase === 'turn' && v.speed > 2 && b.trackSpeed[0] > b.trackSpeed[1] + 0.3) turning++;
    // The gunner swings the turret round meanwhile.
    if (phase === 'coast') sim.v.aim.yaw = sim.v._hullYaw() + 1.5;
    if (phase === 'coast' && Math.abs(v.turretRate) > 0.05 && Math.abs(b.turretRate - v.turretRate) < 0.3 * Math.abs(v.turretRate)) whine++;
  });
  engineHeard('m4a1_sherman', r);
  const b = r.sim.puppet,
    v = r.sim.v;
  assert.ok(tracked > 150, `the tracks keep the server's speeds (${tracked} times)`);
  assert.ok(turning > 10, `in a right turn the left track runs quicker (${turning} times)`);
  assert.ok(whine > 5, `the turret motor runs as the turret swings round (${whine} times)`);
  assert.ok(Math.abs(b.trackDist[0] - v.trackDist[0]) < 0.05 * Math.abs(v.trackDist[0]), `the road wheels have turned as far (${b.trackDist[0].toFixed(0)} m of track against ${v.trackDist[0].toFixed(0)})`);
});

test("online, a motorcycle's engine starts when he gets on, revs as the server's, and stops when he leaves it", () => {
  const r = drive('r75');
  engineHeard('r75', r);
  const sim = r.sim;
  const man = sim.v.occupants[0];
  sim.v.exit(man);
  man.vehicle = null;
  man.seat = -1;
  sim.run(3, () => {});
  assert.ok(!sim.v.engineOn && !sim.puppet.engineOn, 'off once he has left it standing');
  sim.v.enter(man, 0);
  sim.run(2, () => sim.v.driverInput(0, 0));
  assert.ok(sim.v.engineOn && sim.puppet.engineOn, 'started again when he gets back on');
  assert.ok(Math.abs(sim.puppet.rpm - sim.v.rpm) < 0.15 * sim.v.rpm, `ticking over (${sim.puppet.rpm.toFixed(0)} rpm against ${sim.v.rpm.toFixed(0)})`);
});
