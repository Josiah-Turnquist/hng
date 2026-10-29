// Registry of procedural gun models: id -> builder(b: GunBuilder). The kits
// and the wrench (kits.js) are built the same way.
import * as german from './german.js';
import * as us from './us.js';
import * as soviet from './soviet.js';
import * as melee from './melee.js';
import * as pocket from './pocket.js';
import * as binoculars from './binoculars.js';
import { UPGRADE_MODELS } from './upgradeScopes.js';
import * as kits from './kits.js';
import { GunBuilder } from './kit.js';

export const MODELS = {
  ...us,
  ...german,
  ...soviet,
  ...melee,
  ...pocket,
  ...binoculars,
  ...UPGRADE_MODELS, // rifles with a scope upgrade: `${rifle}+${family}`
  ...kits,
};

// Levels of detail: 0 = first person (30k-60k triangles), 1 = soldiers nearby
// (3k-6k), 2 = soldiers far away (a few hundred, one material).
export const GUN_LODS = [0, 1, 2];

// Distance (m) from the camera beyond which a soldier's gun drops to LOD 2.
export const GUN_LOD2_DISTANCE = 40;

// LOD for a gun carried by a soldier seen from `distance` meters (third person).
export function gunLodForDistance(distance) {
  return distance > GUN_LOD2_DISTANCE ? 2 : 1;
}

// Built models are kept per material set and LOD; each call returns a clone that
// shares the geometry (and materials) with every other copy of the same gun.
const built = new WeakMap();

// Build a gun model by id. Returns { root, parts, anchors, meta }.
// opts.lod: 0 (default, full detail), 1 or 2.
export function buildGun(id, mats, { lod = 0 } = {}) {
  const fn = MODELS[id];
  if (!fn) throw new Error(`No model for ${id}`);
  let cache = built.get(mats);
  if (!cache) built.set(mats, (cache = new Map()));
  const key = `${id}@${lod}`;
  let proto = cache.get(key);
  if (!proto) {
    const b = new GunBuilder(mats, { lod });
    fn(b);
    proto = b.build(id);
    proto.meta.lod = lod;
    cache.set(key, proto);
  }
  return cloneGun(proto);
}

// Copy a built gun: new objects and transforms, shared geometry and materials.
function cloneGun(proto) {
  const src = proto.root;
  const ud = src.userData;
  src.userData = {}; // keep Object3D.clone from serializing anchors and parts
  const root = src.clone(true);
  src.userData = ud;
  const parts = {};
  for (const g of root.children) parts[g.name] = g;
  const anchors = {};
  for (const [k, v] of Object.entries(proto.anchors)) anchors[k] = v.clone();
  const meta = structuredClone(proto.meta);
  root.userData = { anchors, parts, meta };
  return { root, parts, anchors, meta };
}
