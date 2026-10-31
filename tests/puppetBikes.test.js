// Online, the bicycles and motorcycles others ride are puppets: the server rides
// them and the browser only hears where each is and how it is turned
// (net/online.js, net/protocol.js). Their riders must still sit facing the way
// the machine goes, lean with it, hold the bars as they turn, pedal, and put a
// foot down at a stop (Bike._followParts), as offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { onlineRide } from './helpers/onlineRide.js';
import { wrapAngle } from '../src/core/math.js';

const headingOf = (v) => {
  const e = new THREE.Euler().setFromQuaternion(v.body.quaternion, 'YXZ');
  return e.y;
};

test('online, a bicycle rider faces the way his machine goes, leans and steers with it, pedals, and puts a foot down', () => {
  const sim = onlineRide('bicycle');
  const pose = {};
  // Twitching: the most the rider's facing, lean and the bars move in a step,
  // here and on the server.
  const jump = { yaw: 0, lean: 0, bars: 0 },
    jumpS = { yaw: 0, lean: 0, bars: 0 };
  let last = null,
    lastS = null;
  const most = (into, was, now) => {
    if (was) for (const k in into) into[k] = Math.max(into[k], Math.abs(wrapAngle(now[k] - was[k])));
    return now;
  };
  const watch = (b) => {
    b.riderPose(0, pose);
    last = most(jump, last, { yaw: pose.yaw, lean: pose.lean, bars: b.steerG });
    lastS = most(jumpS, lastS, { yaw: sim.v.yaw, lean: sim.v.lean, bars: sim.v.steerG });
  };
  // Off down the road.
  sim.run(4, () => sim.v.driverInput(1, 0), watch);
  const b = sim.puppet;
  assert.ok(b?.puppet, 'the browser made a puppet of the machine');
  assert.equal(b.occupants[0]?.id, 9, 'his rider is aboard');
  b.riderPose(0, pose);
  assert.ok(Math.abs(wrapAngle(pose.yaw - headingOf(b))) < 0.01, `the rider faces the way the machine points (${pose.yaw.toFixed(2)} against ${headingOf(b).toFixed(2)})`);
  assert.ok(Math.abs(wrapAngle(pose.yaw - sim.v.yaw)) < 0.05, 'and the way the server has it going');
  assert.ok(b.speed > 3, `it is going (${b.speed.toFixed(1)} m/s)`);
  assert.ok(b.cadence > 30, `he pedals (${b.cadence.toFixed(0)} rpm)`);
  assert.ok(Math.abs(b.wR.spin * b.wR.radius - b.followSpeed) < 0.2, 'the wheels roll with the ground');
  assert.equal(b.footDown, 0, 'feet on the pedals while riding');
  // Hands on the grips: as far from the saddle as the server's rider's are.
  const srv = sim.v.riderPose(0, {});
  for (const k of ['handL', 'handR', 'footL', 'footR']) {
    const dc = pose[k].distanceTo(pose.hip),
      ds = srv[k].distanceTo(srv.hip);
    assert.ok(Math.abs(dc - ds) < 0.06, `${k} where it is on the server (${dc.toFixed(2)} m from the saddle against ${ds.toFixed(2)})`);
  }
  // A right turn: leaned and steered into it.
  sim.run(2.5, () => sim.v.driverInput(0.7, 0.6), watch);
  b.riderPose(0, pose);
  assert.ok(sim.v.lean > 0.1, `(the server's machine leans into the turn: ${sim.v.lean.toFixed(2)})`);
  assert.ok(Math.abs(pose.lean - sim.v.lean) < 0.08, `the rider leans with it (${pose.lean.toFixed(2)} against ${sim.v.lean.toFixed(2)})`);
  assert.ok(Math.abs(wrapAngle(pose.yaw - headingOf(b))) < 0.01, 'still facing the way it points in the turn');
  assert.ok(b.steerG > 0.01 && Math.abs(b.steerG - sim.v.steerG) < 0.06, `the bars turned right (${b.steerG.toFixed(3)} against ${sim.v.steerG.toFixed(3)})`);
  // Braking to a stop: a foot down, the pedals still.
  sim.run(5, () => sim.v.driverInput(sim.v.speed > 0.3 ? -1 : 0, 0), watch);
  assert.ok(Math.abs(b.speed) < 0.3, `stopped (${b.speed.toFixed(2)} m/s)`);
  assert.equal(b.cadence, 0, 'not pedaling at a stop');
  assert.ok(sim.v.footDown !== 0 && b.footDown !== 0, 'a foot down at a stop');
  // No twitching: from step to step no jumpier than the server's own machine.
  for (const k of ['yaw', 'lean', 'bars']) assert.ok(jump[k] <= jumpS[k] * 1.1 + 0.002, `smooth: ${k} at most ${jump[k].toFixed(3)} rad in a step (on the server ${jumpS[k].toFixed(3)})`);
});

test("online, a motorcycle's rider sits facing forward, its collision box goes with it, and a sidecar's gun turns as the server's", () => {
  const sim = onlineRide('r75_sidecar', -1);
  sim.run(4, () => sim.v.driverInput(1, 0.3));
  const b = sim.puppet;
  const pose = b.riderPose(0, {});
  assert.ok(Math.abs(wrapAngle(pose.yaw - headingOf(b))) < 0.01 && Math.abs(wrapAngle(pose.yaw - sim.v.yaw)) < 0.05, 'the rider faces the way it goes');
  assert.ok(b.speed > 3);
  // Its box (people and vehicles bump into it) is where it is, not where it was made.
  const box = b.proxies[0].box;
  const p = b.body.position;
  assert.ok(Math.hypot(box.cx - p.x, box.cz - p.z) < 1, 'the collision box goes with the machine');
  // The sidecar gunner's gun.
  sim.v.mgAim.yaw = 0.5;
  sim.v.mgAim.pitch = 0.1;
  sim.run(1, () => sim.v.driverInput(0, 0));
  assert.ok(Math.abs(sim.v.mgYaw - 0.5) < 0.01, '(the server turned it)');
  assert.ok(Math.abs(b.mgYaw - 0.5) < 0.01 && Math.abs(b.mgPitch - 0.1) < 0.01, `the gun turned (${b.mgYaw.toFixed(2)}, ${b.mgPitch.toFixed(2)})`);
});
