// Creating vehicles in the world: model (detailed if available, simple stand-in
// otherwise), physics, and the animated tracks for tanks.
import * as THREE from 'three';
import { VEHICLES } from './defs.js';
import { WheeledVehicle } from './wheeled.js';
import { TrackedVehicle } from './tracked.js';
import { Bike } from './bike.js';
import { buildPlaceholder } from './placeholder.js';
import { TrackRenderer } from './trackMesh.js';
import * as models from './models/index.js';

export { VEHICLES };

const STANDIN_COLOR = { US: 0x4b5320, GE: 0x8a7d5a, SU: 0x46502e };

// Build these types' models now (while the battle loads) rather than when the
// first of each drives in.
export function prepareVehicles(game, ids) {
  for (const id of ids) {
    try {
      if (VEHICLES[id]) models.prepareVehicle?.(id, game.world.textures);
    } catch (e) {
      console.warn(`Vehicle model ${id} failed`, e);
    }
  }
}

export function spawnVehicle(game, id, x, z, yaw = 0) {
  const def = { ...VEHICLES[id], id };
  if (!VEHICLES[id]) throw new Error(`Unknown vehicle ${id}`);
  let model = null;
  try {
    // Every vehicle of a type shares one built model's geometry and materials
    // (its damage is painted on copies of its own: effects.js). Building a
    // tank's model afresh took a tenth of a second and more, a stall in the
    // middle of a battle each time one arrived.
    const build = models.instanceVehicle || models.buildVehicle;
    model = build ? build(id, game.world.textures) : null;
  } catch (e) {
    console.warn(`Vehicle model ${id} failed, using a stand-in`, e);
  }
  if (!model) model = buildPlaceholder(def, STANDIN_COLOR[def.faction]);
  const V = def.kind === 'tracked' ? TrackedVehicle : def.kind === 'bike' ? Bike : WheeledVehicle;
  const v = new V(game, def, model, x, z, yaw);
  // (The drawn track links: only where there is a screen.)
  if (def.kind === 'tracked' && !game.headless) {
    let mat = null;
    try {
      mat = models.makeVehicleMaterials?.(game.world.textures)?.track;
    } catch (e) {
      mat = null;
    }
    v.trackRenderer = new TrackRenderer(v, mat || new THREE.MeshStandardMaterial({ color: 0x3b3833, roughness: 0.75, metalness: 0.55 }));
  }
  v.syncModel(0);
  game.world.add(model.root);
  return v;
}
