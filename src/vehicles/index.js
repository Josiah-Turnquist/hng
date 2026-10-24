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

export function spawnVehicle(game, id, x, z, yaw = 0) {
  const def = { ...VEHICLES[id], id };
  if (!VEHICLES[id]) throw new Error(`Unknown vehicle ${id}`);
  let model = null;
  try {
    // Bicycles and motorcycles come in numbers: they share one built model's
    // geometry and materials per type.
    const build = def.kind === 'bike' && models.instanceVehicle ? models.instanceVehicle : models.buildVehicle;
    model = build ? build(id, game.world.textures) : null;
  } catch (e) {
    console.warn(`Vehicle model ${id} failed, using a stand-in`, e);
  }
  if (!model) model = buildPlaceholder(def, STANDIN_COLOR[def.faction]);
  const V = def.kind === 'tracked' ? TrackedVehicle : def.kind === 'bike' ? Bike : WheeledVehicle;
  const v = new V(game, def, model, x, z, yaw);
  if (def.kind === 'tracked') {
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
