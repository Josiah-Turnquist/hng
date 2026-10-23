// The village of the "Town" map: planning (layout + ground shaping) and building
// (merged meshes, instanced props and collision boxes).
//
//   const terrain = generateTerrain(def);
//   const plan = planVillage(terrain, def, rng);   // BEFORE the terrain mesh is built
//   ... new TerrainRenderer(terrain.hf, ...), buildRoads(terrain, ...), ...
//   const v = buildVillage(plan, { terrain, def, collision, textures });
//   scene.add(v.group);                            // before shadows.prepare(scene)
//
// planVillage(terrain, def, rng?) -> plan
//   Decides every placement (church, gendarmerie, square, houses, sheds, farms, walls,
//   trees, props, bridges) and edits terrain.hf: plots flattened with smooth blends
//   (never on road surfaces or the river bed), cobbles on the square and the streets
//   of the village core, dirt in farmyards. rng: a core/math.js RNG (or a number seed).
//
// buildVillage(plan, { terrain, def, collision, textures, textureSize?, chunkSize? }) ->
//   group        THREE.Group: one merged mesh per material per 100 m chunk, plus
//                InstancedMeshes (sandbags, crates, barrels, hedgehogs, poles, bales)
//                and LineSegments (barbed and telegraph wire).
//   coverPoints  [{x, y, z, nx, nz, height: 'low'|'high'}]: where to stand/crouch
//                (y = floor). (nx, nz) points from the position toward the cover and
//                the threat; 'low' = crouch behind (sandbags, low walls, sills).
//   navBlockers  [{cx, cz, hx, hz, yaw}]: every solid upright collider that blocks
//                walking height (wall pieces, fences, props), so doorways stay open.
//   footprints   [{kind, cx, cz, hx, hz, yaw, floorY}]: whole-building rectangles.
//   doors        [{x, z, y, yaw, width, kind}]: doorway centers; (sin yaw, cos yaw) is
//                the outward normal. kind: door|backdoor|shop|portal|gate|barn|
//                breach|interior|ford.
//   spawnHints   {O1: [{x, y, z}], O2: [...]}: defender spawn spots at the objectives.
//   bridges      [{road, kind, x, z, yaw, deckY, waterY, width, length, ends, gap}].
//   colliders    the Box objects added to `collision`; stats; dispose().
import { FLAG_SOLID } from '../../physics/collision.js';
import { VillageBuilder } from './geom.js';
import { makeVillageMaterials } from './materials.js';
import { planVillage } from './plan.js';
import { buildHouse, buildAnnex } from './house.js';
import { buildChurch } from './church.js';
import { buildGendarmerie } from './gendarmerie.js';
import { buildFarm } from './farm.js';
import { buildSquare, buildFurniture, buildSigns } from './square.js';
import { buildTrees } from './trees.js';
import { buildWalls } from './walls.js';
import { buildProps } from './props.js';
import { buildBridges } from './bridges.js';

export { planVillage };

export function buildVillage(plan, { terrain, def, collision, textures, textureSize, chunkSize = 100 } = {}) {
  const t0 = performance.now();
  const { mats, atlas, atlasTexture } = makeVillageMaterials(textures, { textureSize });
  const B = new VillageBuilder({ materials: mats, collision, chunkSize });
  B.spawnHints = { O1: [], O2: [] };
  B.hf = terrain.hf;
  const hf = terrain.hf;
  const ctx = { terrain, def, atlas, mats, hf, plan, B, extraProps: [] };
  const footprints = [];
  for (const b of plan.buildings) {
    if (b.kind === 'house') {
      buildHouse(B, b, ctx);
      footprints.push({ kind: b.shop || 'house', cx: b.x, cz: b.z, hx: b.w / 2, hz: b.d / 2, yaw: b.yaw, floorY: b.floorY });
    } else if (b.kind === 'annex') {
      buildAnnex(B, b, ctx);
      footprints.push({ kind: 'annex', cx: b.x, cz: b.z, hx: b.w / 2, hz: b.d / 2, yaw: b.yaw, floorY: b.floorY });
    } else if (b.kind === 'church') {
      const f = buildChurch(B, b, ctx);
      const c = f.toWorld(1.5, 0, -17);
      footprints.push({ kind: 'church', cx: +c[0].toFixed(2), cz: +c[2].toFixed(2), hx: 12, hz: 23.5, yaw: b.yaw, floorY: b.floorY });
    } else if (b.kind === 'gendarmerie') {
      buildGendarmerie(B, b, ctx);
      footprints.push({ kind: 'gendarmerie', cx: b.x, cz: b.z, hx: b.w / 2, hz: b.d / 2, yaw: b.yaw, floorY: b.floorY });
    }
  }
  for (const farm of plan.farms) {
    buildFarm(B, farm, ctx);
    footprints.push({ kind: 'farm', cx: farm.x, cz: farm.z, hx: farm.w / 2, hz: farm.d / 2, yaw: farm.yaw, floorY: farm.ground });
  }
  buildSquare(B, plan, ctx);
  buildFurniture(B, plan, ctx);
  buildSigns(B, plan, ctx);
  buildTrees(B, plan, ctx);
  buildWalls(B, plan, ctx);
  const bridges = buildBridges(B, plan, ctx);
  const propsGroup = buildProps(B, { ...plan, props: [...plan.props, ...ctx.extraProps] }, ctx);
  const group = B.finish('village');
  group.add(propsGroup);
  // Drop or nudge spawn/cover points that ended up inside geometry or over a hole.
  if (collision) {
    const fix = (p) => {
      for (let iter = 0; iter < 4; iter++) {
        let mx = 0,
          mz = 0;
        for (const h of [0.55, 1.05, 1.48]) {
          const q = { x: p.x, y: p.y + h, z: p.z };
          const out = { x: 0, y: 0, z: 0 };
          collision.resolveSphere(q, 0.27, out, FLAG_SOLID);
          mx += out.x;
          mz += out.z;
        }
        if (Math.hypot(mx, mz) < 0.03) {
          // Standing surface: terrain or a box top within 0.4 m below.
          if (Math.abs(hf.getHeight(p.x, p.z) - p.y) < 0.4) return true;
          const list = collision.query(p.x - 0.05, p.y - 0.4, p.z - 0.05, p.x + 0.05, p.y + 0.05, p.z + 0.05, [], FLAG_SOLID);
          return list.length > 0;
        }
        p.x = +(p.x + mx * 1.2).toFixed(2);
        p.z = +(p.z + mz * 1.2).toFixed(2);
      }
      return false;
    };
    B.coverPoints = B.coverPoints.filter(fix);
    for (const k of Object.keys(B.spawnHints)) B.spawnHints[k] = B.spawnHints[k].filter(fix);
  }
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
  let propTris = 0;
  propsGroup.traverse((o) => {
    if (o.isInstancedMesh) propTris += (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3) * o.count;
  });
  const stats = {
    meshes: group.children.length - 1 + propsGroup.children.length,
    triangles: B.triangles + propTris,
    colliders: B.colliders.length,
    buildings: plan.buildings.length,
    houses: plan.buildings.filter((b) => b.kind === 'house').length,
    farms: plan.farms.length,
    annexes: plan.buildings.filter((b) => b.kind === 'annex').length,
    coverPoints: B.coverPoints.length,
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
    bridges,
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

