// Registry of procedural gun models: id -> builder(b: GunBuilder).
import * as german from './german.js';
import * as us from './us.js';
import * as soviet from './soviet.js';

export const MODELS = {
  ...us,
  ...german,
  ...soviet,
};

import { GunBuilder } from './kit.js';

// Build a gun model by id. Returns { root, parts, anchors, meta }.
export function buildGun(id, mats) {
  const fn = MODELS[id];
  if (!fn) throw new Error(`No model for ${id}`);
  const b = new GunBuilder(mats);
  fn(b);
  return b.build(id);
}
