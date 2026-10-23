// A small test world for vehicle physics in Node: flat or sloped ground with a
// chosen surface, a collision world, air, and a fake game object.
import * as THREE from 'three';
import { Heightfield, SURF } from '../../src/world/heightfield.js';
import { CollisionWorld } from '../../src/physics/collision.js';
import { Atmosphere } from '../../src/ballistics/atmosphere.js';
import { VEHICLES } from '../../src/vehicles/defs.js';
import { WheeledVehicle } from '../../src/vehicles/wheeled.js';
import { TrackedVehicle } from '../../src/vehicles/tracked.js';

// slope: rise per meter along -Z (uphill going "north"), in radians of grade.
export function makeWorld({ size = 1024, slopeDeg = 0, surface = SURF.ROAD } = {}) {
  const res = Math.round(size / 2) + 1;
  const hf = new Heightfield(size, res);
  const grade = Math.tan((slopeDeg * Math.PI) / 180);
  for (let iz = 0; iz < res; iz++)
    for (let ix = 0; ix < res; ix++) {
      const z = hf.worldZ(iz);
      hf.heights[iz * res + ix] = 50 - z * grade;
    }
  hf.surface.fill(surface);
  hf.computeRange();
  const collision = new CollisionWorld(hf);
  const atmosphere = new Atmosphere(0, 15, 0.5);
  const world = { hf, collision, atmosphere, waterLevelAt: () => null, scene: new THREE.Scene() };
  const game = { world, time: 0, audio: null, effects: null };
  return { game, world, hf, collision };
}

export function spawn(game, id, x = 0, z = 0, yaw = 0) {
  const def = { ...VEHICLES[id], id };
  const model = { root: new THREE.Group(), parts: {}, anchors: {}, meta: {} };
  const V = def.kind === 'tracked' ? TrackedVehicle : WheeledVehicle;
  const v = new V(game, def, model, x, z, yaw);
  v.enter({ body: { x: 0, y: 0, z: 0 }, alive: true, damage() {} }, 0);
  return v;
}

export function run(v, seconds, fn = null, dt = 1 / 120) {
  for (let t = 0; t < seconds; t += dt) {
    if (fn) fn(t);
    v.step(dt);
    v.game.time += dt;
  }
}
