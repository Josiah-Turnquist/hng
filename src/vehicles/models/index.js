// Registry of procedural vehicle models: id -> builder(b: VehicleBuilder).
// Conventions are documented in vkit.js (meters, +X right, +Y up, -Z forward, origin on
// the ground at the middle of the wheelbase / track contact length).
import * as THREE from 'three';
import { VehicleBuilder, trackPath, pathLength } from './vkit.js';
import * as us from './us.js';
import * as german from './german.js';
import * as soviet from './soviet.js';

export { trackPath, pathLength };

export const VEHICLE_MODELS = {
  willys_mb: us.willys_mb,
  m4a1_sherman: us.m4a1_sherman,
  panzer4_h: german.panzer4_h,
  t34_76: soviet.t34_76,
  kubelwagen: german.kubelwagen,
  gaz67: soviet.gaz67,
};

// Vehicle materials, created lazily (a texture preset is baked the first time a model uses
// it) and cached per TextureLibrary.
const cache = new WeakMap();

export function makeVehicleMaterials(textures) {
  let mats = cache.get(textures);
  if (mats) return mats;
  const std = (preset, extra = {}) => () => {
    const t = textures.get(preset, 512);
    const m = new THREE.MeshStandardMaterial({
      map: t.map,
      normalMap: t.normalMap,
      roughnessMap: t.ormMap,
      metalnessMap: t.ormMap,
      roughness: 1,
      metalness: 1,
      ...extra,
    });
    m.name = preset;
    m.userData.texWorld = t.world;
    return m;
  };
  const plain = (opts, texWorld = 0.5) => () => {
    const m = new THREE.MeshStandardMaterial(opts);
    m.userData.texWorld = texWorld;
    return m;
  };
  const makers = {
    // Paint (planar-mapped at 2 m per tile).
    od: std('paintOD'), // US olive drab No. 9
    odCast: std('castOD'), // cast hull/turret in olive drab
    dunkelgelb: std('paintGerman'), // German RAL 7028
    germanGrey: std('paintGermanGrey'), // German RAL 7021
    castGerman: std('castGerman'), // cast mantlets/cupolas in dunkelgelb
    sovietGreen: std('paintSoviet'), // 4BO green
    sovietCast: std('castSoviet'), // cast turret in 4BO
    black: std('paintBlack'),
    // Bare metal.
    steel: std('steelPlain'),
    parkerized: std('steelParkerized'),
    blued: std('steelBlued'),
    track: std('trackSteel'), // track links (for the game's track builder), sprocket teeth
    // Soft goods.
    rubber: std('rubberTire'),
    canvasOD: std('canvasOD'),
    canvasGerman: std('canvasGerman'),
    canvasSoviet: std('canvasSoviet'),
    wood: std('woodPlanks'),
    leather: std('leatherBrown'),
    // Untextured.
    glass: plain({ color: 0x2c3a44, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }),
    lamp: plain({ color: 0xe6e2d2, roughness: 0.15, metalness: 0.85, emissive: 0x000000 }), // headlamp lens (raise emissive to light it)
    redLamp: plain({ color: 0x7a0c08, roughness: 0.25, metalness: 0.2, emissive: 0x000000 }),
    dark: plain({ color: 0x0c0c0c, roughness: 0.85, metalness: 0.1 }), // openings, vision slits, bores
    brass: plain({ color: 0xb08d57, roughness: 0.35, metalness: 1 }),
  };
  mats = {};
  for (const [k, make] of Object.entries(makers)) {
    let m = null;
    Object.defineProperty(mats, k, { enumerable: true, get: () => (m ??= make()) });
  }
  cache.set(textures, mats);
  return mats;
}

const r3 = (v) => Math.round(v * 1000) / 1000;

// Build a vehicle by id. Returns { root, parts, anchors, meta, mats, stats }:
//   root: THREE.Group; parts: { name: Group } (all direct children of root, each positioned
//   at its pivot; re-parent with attachParts() or by hand); anchors: { name: Vector3 } in
//   vehicle space at rest; meta: see vkit.js / the model files.
export function buildVehicle(id, textures) {
  const fn = VEHICLE_MODELS[id];
  if (!fn) throw new Error(`No vehicle model ${id}`);
  const mats = makeVehicleMaterials(textures);
  const b = new VehicleBuilder(mats);
  b.meta.id = id;
  fn(b);
  const v = b.build(id);
  v.mats = mats;
  finish(v, b);
  return v;
}

function finish(v, b) {
  const { root, meta, parts } = v;
  meta.pivots = {};
  for (const [name, g] of Object.entries(parts)) meta.pivots[name] = g.position.toArray().map(r3);
  root.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(root);
  const body = new THREE.Box3();
  const turretParts = new Set(['turret', 'gun', ...Object.keys(meta.partParents || {})]);
  for (const [name, g] of Object.entries(parts)) if (!turretParts.has(name)) body.expandByObject(g);
  if (meta.track) {
    // Include the track belts the game builds along meta.track.path.
    const t = meta.track;
    let z0 = Infinity,
      z1 = -Infinity,
      y1 = -Infinity;
    for (const [z, y] of t.path) {
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
      y1 = Math.max(y1, y);
    }
    const h = t.linkThickness / 2,
      x = t.offsetX + t.width / 2;
    for (const box of [all, body]) {
      box.expandByPoint(new THREE.Vector3(-x, 0, z0 - h));
      box.expandByPoint(new THREE.Vector3(x, y1 + h, z1 + h));
    }
  }
  const size = all.getSize(new THREE.Vector3());
  meta.dims = { length: r3(size.z), width: r3(size.x), height: r3(size.y) };
  meta.bounds = { min: all.min.toArray().map(r3), max: all.max.toArray().map(r3) };
  meta.bodyBounds = { min: body.min.toArray().map(r3), max: body.max.toArray().map(r3) };
  let triangles = 0,
    drawCalls = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    drawCalls++;
    triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  v.stats = { primitives: b.primitives, triangles, drawCalls };
}

// Re-parent the parts listed in meta.partParents (gun -> turret, turret hatches and pintle
// MG -> turret...) so they follow their parent, keeping the rest pose. Optional helper.
export function attachParts(v) {
  const piv = v.meta.pivots;
  for (const [child, parent] of Object.entries(v.meta.partParents || {})) {
    const c = v.parts[child],
      p = v.parts[parent];
    if (!c || !p) continue;
    p.add(c);
    c.position.set(piv[child][0] - piv[parent][0], piv[child][1] - piv[parent][1], piv[child][2] - piv[parent][2]);
  }
  return v;
}
