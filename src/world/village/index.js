// The village of the "Town" map: planning (layout + ground shaping) and building
// (merged meshes, instanced props and collision boxes).
//
//   const plan = planVillage(terrain, def, rng);   // after generateTerrain, before the terrain mesh
//   const v = buildVillage(plan, { terrain, def, collision, textures });
//   scene.add(v.group);
//
// buildVillage returns { group, coverPoints, navBlockers, doors, spawnHints, bridges,
// footprints, stats }. See README notes in each module for conventions.
import * as THREE from 'three';
import { FLAG_SOLID } from '../../physics/collision.js';
import { VillageBuilder } from './geom.js';
import { makeVillageMaterials } from './materials.js';
import { planVillage } from './plan.js';
import { buildHouse } from './house.js';

export { planVillage };

export function buildVillage(plan, { terrain, def, collision, textures, textureSize, chunkSize = 80 } = {}) {
  const t0 = performance.now();
  const { mats, atlas, atlasTexture } = makeVillageMaterials(textures, { textureSize });
  const B = new VillageBuilder({ materials: mats, collision, chunkSize });
  B.spawnHints = { O1: [], O2: [] };
  const hf = terrain.hf;
  const ctx = { terrain, def, atlas, mats, hf, plan, B };
  const footprints = [];
  for (const b of plan.buildings) {
    if (b.kind === 'house') {
      buildHouse(B, b, ctx);
      footprints.push({ kind: b.shop || 'house', cx: b.x, cz: b.z, hx: b.w / 2, hz: b.d / 2, yaw: b.yaw, floorY: b.floorY });
    }
  }
  const group = B.finish('village');
  // Navigation blockers: every solid, upright collider that stands across walking height.
  const navBlockers = [];
  for (const box of B.colliders) {
    if (!(box.flags & FLAG_SOLID)) continue;
    if (box.village && box.village.nav === false) continue;
    if (Math.abs(box.pitch) > 1e-3 || Math.abs(box.roll) > 1e-3) continue;
    const g = hf.getHeight(box.cx, box.cz);
    if (box.minY > g + 0.5 || box.maxY < g + 1.0) continue;
    navBlockers.push({ cx: +box.cx.toFixed(2), cz: +box.cz.toFixed(2), hx: +box.hx.toFixed(3), hz: +box.hz.toFixed(3), yaw: +box.yaw.toFixed(4) });
  }
  const stats = {
    meshes: group.children.length,
    triangles: B.triangles,
    colliders: B.colliders.length,
    buildings: plan.buildings.length,
    houses: plan.buildings.filter((b) => b.kind === 'house').length,
    ms: Math.round(performance.now() - t0),
  };
  group.userData.stats = stats;
  group.userData.materials = mats;
  group.userData.atlasTexture = atlasTexture;
  return {
    group,
    coverPoints: B.coverPoints,
    navBlockers,
    doors: B.doors,
    spawnHints: B.spawnHints,
    bridges: [],
    footprints,
    colliders: B.colliders,
    stats,
    dispose() {
      group.traverse((o) => o.geometry && o.geometry.dispose());
      for (const m of Object.values(mats)) m.dispose();
      atlasTexture.dispose();
    },
  };
}

export { THREE };
