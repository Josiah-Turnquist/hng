// The countryside of 1944 Normandy: woods (oak, beech, ash, with spruce and Scots pine
// stands), copses, bocage hedgerows on earth banks with oaks and ashes growing out of
// them, Lombardy poplars along the roads, cider apple orchards by the farms, bushes
// and brambles, and grass, wheat, bracken and flowers that move in the wind.
//
//   const veg = buildVegetation({ terrain, def, collision, textures, quality, village,
//                                 plan, shadows, camera });
//   scene.add(veg.group);                 // before shadows.prepare(scene)
//   every frame: veg.update(cameraPosition, time);
//
// Returns { group, update(cameraPosition, time), stats, debug(), plants, hedges,
// landmarks, dispose() }.
//
// Drawing: every tree and bush shape is an InstancedMesh (bark and foliage share one
// texture atlas, so one draw call per shape) holding the plants near the camera,
// refilled from a grid as the camera moves or turns; farther away all plants are
// impostors (three crossed cards with baked pictures) in one instanced mesh, refilled
// the same way but less often; hedges are instanced sections (detailed near, simple
// far); ground cover is one instanced mesh refilled from 16 m tiles. Levels of detail
// cross-fade with dithering in the shaders. Collision boxes (trunks, open-field
// crowns, bushes, hedge banks and hedges) go into `collision` for the battlefield
// area.
//
// Without a texture library that can bake atlases (headless tests) only the plants
// and their collision are made.
import * as THREE from 'three';
import { RNG } from '../core/math.js';
import { VegSite } from './vegetation/site.js';
import { PlantList, placeForests, placeOrchards, placePoplars, placeRiverbank, placeFields, placeVillageBushes, isBush } from './vegetation/placement.js';
import { planHedges, hedgeSections, hedgePieces } from './vegetation/hedges.js';
import { addVegetationColliders } from './vegetation/colliders.js';
import { buildVariant, hedgeGeometry, impostorGeometry, clumpGeometry } from './vegetation/treeGeometry.js';
import { VARIANTS, ATLAS_CELLS, ATLAS_COLS, GROUND_CELLS } from './vegetation/species.js';
import { bakeImpostors } from './vegetation/impostors.js';
import { makeSharedUniforms, makeTreeMaterial, makeImpostorMaterial, makeGroundMaterial } from './vegetation/materials.js';
import { InstanceStreamer, ViewFilter, RefillTrigger } from './vegetation/lod.js';
import { GroundCover } from './vegetation/grass.js';

// Level-of-detail distances (m) per quality preset: full trees, bushes and hedge
// sections up to these distances, impostors and simple hedges beyond.
const LOD = {
  Low: { tree: 80, bush: 45, hedge: 55, hedgeFar: 650, bushFar: 260, atlasCell: 256, impostor: 1024 },
  Medium: { tree: 115, bush: 60, hedge: 85, hedgeFar: 900, bushFar: 350, atlasCell: 384, impostor: 1536 },
  High: { tree: 155, bush: 75, hedge: 115, hedgeFar: 1200, bushFar: 450, atlasCell: 512, impostor: 1536 },
  Ultra: { tree: 210, bush: 100, hedge: 150, hedgeFar: 1600, bushFar: 600, atlasCell: 512, impostor: 2048 },
};

function lodFor(quality) {
  const td = quality.treeDistance ?? 1500;
  const base = LOD[quality.label] || (td <= 700 ? LOD.Low : td <= 1100 ? LOD.Medium : td <= 1700 ? LOD.High : LOD.Ultra);
  return { ...base, far: td, hedgeFar: Math.min(base.hedgeFar, td), bushFar: Math.min(base.bushFar, td), shadow: quality.shadowDistance ?? 300 };
}

const MOVE = 8; // refill after moving this far (m)
const TURN = 0.26; // ... or turning this much (rad)
const ALWAYS = 45; // plants this close are kept whatever the view direction (shadows)

export function buildVegetation({ terrain, def, collision = null, textures = null, quality = {}, village = null, plan = null, shadows = null, camera = null, renderer = null } = {}) {
  const t0 = performance.now();
  const q = lodFor(quality);
  const site = new VegSite(terrain, def, { village, plan });
  const rng = new RNG(((def.seed || 1) * 101 + 17) >>> 0);
  const P = new PlantList(site.half);
  const landmarks = { orchards: [], poplars: [], copses: [] };
  placeOrchards(site, plan, P, rng, landmarks);
  placePoplars(site, terrain, def, P, rng, landmarks);
  placeForests(site, terrain, P, rng);
  const runs = planHedges(site, terrain, def, P, rng);
  placeRiverbank(site, terrain, P, rng);
  placeFields(site, terrain, def, P, rng, landmarks);
  placeVillageBushes(site, plan, P, rng);
  const tPlace = performance.now();

  const shapes = VARIANTS.map((v) => buildVariant(v.id));
  const info = shapes.map((s) => s.info);
  const pieces = hedgePieces(runs, site, (def.playRadius ?? 760) + 25);
  const colliders = addVegetationColliders(collision, { plants: P, info, pieces, def });
  const tColl = performance.now();

  let trees = 0;
  for (let i = 0; i < P.n; i++) if (!isBush(P.variant[i])) trees++;
  let hedgeLen = 0;
  for (const r of runs) hedgeLen += r.len;
  const group = new THREE.Group();
  group.name = 'vegetation';
  const stats = {
    plants: P.n,
    trees,
    bushes: P.n - trees,
    hedgeRuns: runs.length,
    hedgeKm: +(hedgeLen / 1000).toFixed(1),
    colliders,
    variants: VARIANTS.map((v, i) => ({ species: v.species, v: v.v, triangles: info[i].triangles, height: +info[i].top.toFixed(1) })),
    lod: q,
    placeMs: Math.round(tPlace - t0),
    collisionMs: Math.round(tColl - tPlace),
  };
  const gl = renderer || textures?.renderer;
  if (!gl || typeof textures?.atlas !== 'function') {
    for (const s of shapes) s.geometry.dispose();
    stats.buildMs = Math.round(performance.now() - t0);
    return { group, update() {}, debug: () => ({ drawCalls: 0, triangles: 0 }), stats, plants: P, hedges: runs, landmarks, site, dispose() {} };
  }

  // --- Textures --------------------------------------------------------------------
  const atlas = textures.atlas('vegetation', ATLAS_CELLS, { cols: ATLAS_COLS, cellSize: q.atlasCell, orm: false });
  const groundAtlas = textures.atlas('vegetationGround', GROUND_CELLS, { cols: 4, cellSize: q.atlasCell, normals: false, orm: false });
  const imp = bakeImpostors(gl, shapes, atlas.map, { size: q.impostor });
  VARIANTS.forEach((v, i) => {
    const near = v.bush ? q.bush : q.tree;
    imp.info[i].set(imp.info[i].x, near * 0.86, near, v.bush ? q.bushFar : q.far);
  });
  const tTex = performance.now();

  // --- Materials -----------------------------------------------------------------
  const shared = makeSharedUniforms(def);
  const treeMat = makeTreeMaterial(atlas, shared, { fadeOut: [q.tree * 0.86, q.tree], shadow: [-1, q.tree * 0.93], name: 'vegetation:trees' });
  const bushMat = makeTreeMaterial(atlas, shared, { fadeOut: [q.bush * 0.86, q.bush], shadow: [-1, q.bush * 0.93], translucency: 0.1, name: 'vegetation:bushes' });
  const hedgeNearMat = makeTreeMaterial(atlas, shared, { fadeOut: [q.hedge * 0.86, q.hedge], shadow: [-1, q.hedge * 0.93], translucency: 0.06, name: 'vegetation:hedges' });
  const hedgeFarMat = makeTreeMaterial(atlas, shared, { fadeIn: [q.hedge * 0.86, q.hedge], fadeOut: [q.hedgeFar * 0.9, q.hedgeFar], shadow: [q.hedge * 0.93, q.shadow], translucency: 0.04, name: 'vegetation:hedgesFar' });
  const impMat = makeImpostorMaterial(imp, shared, { shadowMax: Math.min(q.shadow, q.far), variants: VARIANTS.length });
  const groundGeo = clumpGeometry();
  const ground = new GroundCover({ site, terrain, geometry: groundGeo, material: null, quality, seed: (def.seed || 1) & 0xffff });
  const groundMat = makeGroundMaterial(groundAtlas, shared, { lod: ground.lodParams(), cols: 4, rows: 2 });
  ground.mesh.material = groundMat.material;
  const materials = [treeMat, bushMat, hedgeNearMat, hedgeFarMat, impMat, groundMat];
  if (shadows) for (const m of materials) shadows.setup(m.material);

  // --- Near plants: one InstancedMesh per shape ------------------------------------
  const count = new Int32Array(VARIANTS.length);
  for (let i = 0; i < P.n; i++) count[P.variant[i]]++;
  const items = { count: P.n, x: new Float32Array(P.n), y: new Float32Array(P.n), z: new Float32Array(P.n), r: new Float32Array(P.n), group: P.variant, mats: new Float32Array(P.n * 16) };
  {
    const m = new THREE.Matrix4(),
      qy = new THREE.Quaternion(),
      ql = new THREE.Quaternion(),
      pos = new THREE.Vector3(),
      scl = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0),
      lean = new THREE.Vector3();
    for (let i = 0; i < P.n; i++) {
      const vi = info[P.variant[i]];
      const s = P.s[i];
      qy.setFromAxisAngle(up, P.yaw[i]);
      ql.setFromUnitVectors(up, lean.set(P.lx[i], 1, P.lz[i]).normalize()).multiply(qy);
      m.compose(pos.set(P.x[i], P.y[i], P.z[i]), ql, scl.set(s * P.sw[i], s * P.sy[i], s * P.sw[i]));
      m.toArray(items.mats, i * 16);
      items.x[i] = P.x[i];
      items.y[i] = P.y[i] + vi.top * s * P.sy[i] * 0.5;
      items.z[i] = P.z[i];
      items.r[i] = Math.max(vi.halfW * s * P.sw[i], vi.top * s * P.sy[i] * 0.5);
    }
  }
  const nearMeshes = VARIANTS.map((v, i) => {
    if (!count[i]) return null;
    const mat = v.bush ? bushMat : treeMat;
    const mesh = new THREE.InstancedMesh(shapes[i].geometry, mat.material, Math.min(count[i], v.bush ? 3000 : 2500));
    mesh.name = `vegetation:${v.species}${v.v}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.customDepthMaterial = mat.depth;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });
  const plantMax = new Float32Array(VARIANTS.length);
  VARIANTS.forEach((v, i) => (plantMax[i] = v.bush ? q.bush : q.tree));
  const plantStream = new InstanceStreamer(items, nearMeshes, { half: site.half });

  // --- Far plants: impostors, streamed like the near ones (trees and bushes have
  // their own distance bands; the shader cross-fades them with the near shapes) ----
  const impGeo = impostorGeometry();
  const impData = new Float32Array(P.n * 8);
  for (let i = 0; i < P.n; i++) {
    const v = P.variant[i];
    const d = imp.dims[v];
    const s = P.s[i];
    impData.set([P.x[i], P.y[i] + d.bottom * s * P.sy[i], P.z[i], P.yaw[i], d.width * s * P.sw[i], d.height * s * P.sy[i], v, 0], i * 8);
  }
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(P.n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iSize = new THREE.InstancedBufferAttribute(new Float32Array(P.n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  impGeo.setAttribute('iPos', iPos);
  impGeo.setAttribute('iSize', iSize);
  impGeo.instanceCount = 0;
  let impK = 0;
  const impSink = {
    sort: false,
    begin() {
      impK = 0;
    },
    push(i) {
      const a = iPos.array,
        b = iSize.array;
      const o = impK * 4,
        q = i * 8;
      a[o] = impData[q];
      a[o + 1] = impData[q + 1];
      a[o + 2] = impData[q + 2];
      a[o + 3] = impData[q + 3];
      b[o] = impData[q + 4];
      b[o + 1] = impData[q + 5];
      b[o + 2] = impData[q + 6];
      b[o + 3] = impData[q + 7];
      impK++;
    },
    end() {
      impGeo.instanceCount = impK;
      impMesh.visible = impK > 0;
      for (const a of [iPos, iSize]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, impK * 4);
        a.needsUpdate = true;
      }
      return impK;
    },
  };
  const impGroups = new Uint8Array(P.n);
  for (let i = 0; i < P.n; i++) impGroups[i] = isBush(P.variant[i]) ? 1 : 0;
  const impStream = new InstanceStreamer({ ...items, group: impGroups }, [impSink, impSink], { half: site.half, cellSize: 128 });
  const impMax = new Float32Array([q.far, q.bushFar]);
  const impMin = new Float32Array([q.tree * 0.86, q.bush * 0.86]);
  const impTrigger = new RefillTrigger(30, 0.4);
  const impMesh = new THREE.Mesh(impGeo, impMat.material);
  impMesh.name = 'vegetation:impostors';
  impMesh.customDepthMaterial = impMat.depth;
  impMesh.castShadow = true;
  impMesh.receiveShadow = true;
  impMesh.frustumCulled = false;
  group.add(impMesh);

  // --- Hedges --------------------------------------------------------------------------
  const nearSections = hedgeSections(runs, site, 4);
  const farSections = hedgeSections(runs, site, 16);
  const hedgeNear = new THREE.InstancedMesh(hedgeGeometry(4, true, 7), hedgeNearMat.material, Math.max(1, Math.min(nearSections.count, 6000)));
  hedgeNear.name = 'vegetation:hedgeNear';
  hedgeNear.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  hedgeNear.customDepthMaterial = hedgeNearMat.depth;
  const hedgeFar = new THREE.InstancedMesh(hedgeGeometry(16, false, 9), hedgeFarMat.material, Math.max(1, farSections.count));
  hedgeFar.name = 'vegetation:hedgeFar';
  hedgeFar.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  hedgeFar.customDepthMaterial = hedgeFarMat.depth;
  for (const h of [hedgeNear, hedgeFar]) {
    h.castShadow = true;
    h.receiveShadow = true;
    h.frustumCulled = false;
    group.add(h);
  }
  for (const h of [hedgeNear, hedgeFar]) {
    h.count = 0;
    h.visible = false;
  }
  const hedgeStream = new InstanceStreamer(nearSections, [hedgeNear], { half: site.half });
  const hedgeFarStream = new InstanceStreamer(farSections, [hedgeFar], { half: site.half, cellSize: 128 });
  const hedgeMax = new Float32Array([q.hedge]);
  const hedgeFarMax = new Float32Array([q.hedgeFar]);

  group.add(ground.mesh);

  // --- Per-frame update ------------------------------------------------------------------
  const view = new ViewFilter();
  const impView = new ViewFilter();
  const trigger = new RefillTrigger(MOVE, TURN);
  let refFov = 0;
  let pendingNear = false,
    pendingImp = false;
  const update = (cam, time) => {
    shared.uVegTime.value = time;
    shared.uVegCam.value.copy(cam);
    let lod = 1;
    if (camera?.isPerspectiveCamera) {
      const f = THREE.MathUtils.degToRad(camera.fov) / 2;
      refFov = Math.max(refFov, f);
      lod = Math.min(1, Math.tan(f) / Math.tan(refFov) / (camera.zoom || 1));
    }
    // At most one big refill per frame (near plants and hedges, or the impostors,
    // which are refilled less often with a wider margin) - except when zooming, where
    // both must switch to the new level-of-detail scale together.
    const zoomed = Math.abs(lod - shared.uVegLod.value) > 0.08 * Math.max(lod, shared.uVegLod.value);
    if (trigger.check(camera, cam, lod)) pendingNear = true;
    if (impTrigger.check(camera, cam, lod)) pendingImp = true;
    let heavy = false;
    const t0 = performance.now();
    if (pendingNear) {
      shared.uVegLod.value = lod;
      view.update(camera, 0.35);
      plantStream.refill(cam, view, lod, plantMax, MOVE + 2, ALWAYS);
      hedgeStream.refill(cam, view, lod, hedgeMax, MOVE + 2, ALWAYS);
      hedgeFarStream.refill(cam, view, lod, hedgeFarMax, MOVE + 10, ALWAYS);
      pendingNear = false;
      heavy = true;
    }
    const t1 = performance.now();
    if (pendingImp && (!heavy || zoomed)) {
      shared.uVegLod.value = lod;
      impView.update(camera, 0.6);
      impStream.refill(cam, impView, lod, impMax, 32, 80, impMin);
      pendingImp = false;
      heavy = true;
    }
    const t2 = performance.now();
    ground.update(camera, cam, Math.max(lod, 0.6), heavy ? 0.8 : 2.5);
    timing.near = t1 - t0;
    timing.impostors = t2 - t1;
    timing.ground = performance.now() - t2;
  };
  const timing = { near: 0, impostors: 0, ground: 0 };

  // What is drawn right now (main pass): draw calls and triangles per mesh.
  const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const debug = () => {
    const out = { drawCalls: 0, triangles: 0, meshes: {} };
    group.traverse((o) => {
      if (!o.isMesh || !o.visible || o === group) return;
      const n = o.isInstancedMesh ? o.count : o.geometry.isInstancedBufferGeometry ? o.geometry.instanceCount : 1;
      if (!n) return;
      const t = tri(o.geometry) * n;
      out.drawCalls++;
      out.triangles += t;
      out.meshes[o.name] = { instances: n, triangles: t };
    });
    return out;
  };

  stats.textureMs = Math.round(tTex - tColl);
  stats.hedgeSections = { near: nearSections.count, far: farSections.count };
  stats.buildMs = Math.round(performance.now() - t0);
  return {
    group,
    update,
    debug,
    stats,
    plants: P,
    hedges: runs,
    landmarks,
    site,
    ground,
    impostors: imp,
    atlas,
    timing,
    dispose() {
      group.traverse((o) => o.geometry?.dispose());
      for (const m of materials) {
        m.material.dispose();
        m.depth?.dispose();
      }
      for (const t of imp.targets) t.dispose();
    },
  };
}
