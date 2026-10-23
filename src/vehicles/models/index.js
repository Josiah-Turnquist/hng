// Registry of procedural vehicle models: id -> builder(b: VehicleBuilder).
// Conventions are documented in vkit.js (meters, +X right, +Y up, -Z forward, origin on
// the ground at the middle of the wheelbase / track contact length).
//
// buildVehicle(id, textures) -> { root, parts, anchors, meta, mats, stats }
//   parts: { name: THREE.Group } all direct children of root, positioned at their pivot.
//     Wheeled: wheelFL, wheelFR, wheelRL, wheelRR, steeringWheel, windshield?, doors?
//     Tracked: turret, gun, road{L,R}{0..n} (0 = front), roller{L,R}{i}, sprocket{L,R},
//       idler{L,R}, pintleMg?, skirtL/R (Panzer IV Schürzen)
//     Half-track: wheelFL, wheelFR, steeringWheel, doors + the tracked running gear parts.
//   anchors: { name: Vector3 } in vehicle space at rest; meta.anchorParts[name] = part the
//     anchor moves with (anchors not listed there are on the body).
//   meta (all positions in vehicle space at rest):
//     id, name, faction 'us'|'de'|'su', type 'wheeled'|'tracked'|'halftrack', crew, seats,
//     dims { length, width, height } (bounding box incl. tracks), bounds { min, max },
//     bodyBounds { min, max } (without turret/gun/turret-mounted parts), pivots { part: xyz },
//     partParents { child: parent } (gun -> turret, pintleMg -> turret: see attachParts),
//     hinges { part: { axis, open } } (rotation axis in the part's frame, open angle in rad),
//     armor [{ name, part, center, half, rot (XYZ Euler), mm }] (names repeat when a plate
//     is split into strips), modules [{ name, part, center, half }] (names repeat),
//     specs { mass kg, maxSpeed km/h, power hp, ... } (reference data)
//     wheeled: wheelRadius, wheelWidth, wheelbase, trackWidth, wheels { part: xyz },
//       steeringAxis (unit vector of the steering column, toward the driver), maxSteer (rad),
//       groundClearance; opel_blitz also rearTrackWidth, dualRear
//     tracked: roadWheelRadius, roadWheels { count, z[], y }, wheelbase (= track ground
//       contact length), trackWidth (= 2 * track.offsetX), turretRing { center, radius },
//       gun { name, caliber }, gunElevation [down, up] deg, turretTraverse deg/s,
//       track { width, pitch, linkThickness, offsetX, path [[z, y]...] (closed loop of the
//       link centerline, counterclockwise in z-y = order the links travel when driving
//       forward; bottom run at y = linkThickness / 2), length, links, realLinks, sag,
//       guides [{ kind, part, z, y, r }] (circles the loop wraps; feed trackPath() with moved
//       road wheels to re-shape it), sprocketRadius, sprocketTeeth, idlerRadius, rollerRadius }
//     half-track: wheeled fields for the front axle (wheelRadius, trackWidth, wheelbase =
//       front axle -> track bogie center, frontAxleZ, trackBogieZ) + track,
//       roadWheelRadius, trackContactLength.
import * as THREE from 'three';
import { VehicleBuilder, trackPath, pathLength } from './vkit.js';
import * as us from './us.js';
import * as german from './german.js';
import * as soviet from './soviet.js';

export { trackPath, pathLength };

export const VEHICLE_MODELS = {
  willys_mb: us.willys_mb,
  m4a1_sherman: us.m4a1_sherman,
  m5a1_stuart: us.m5a1_stuart,
  panzer4_h: german.panzer4_h,
  tiger1: german.tiger1,
  t34_76: soviet.t34_76,
  t34_85: soviet.t34_85,
  kubelwagen: german.kubelwagen,
  opel_blitz: german.opel_blitz,
  m3_halftrack: us.m3_halftrack,
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

// Cheap copies: the first call per (textures, id) builds a prototype; every call returns new
// groups/meshes that share its geometry and materials (meta is shared, treat it as
// read-only; do not dispose the geometry of an instance while others are alive).
const protos = new WeakMap();

export function instanceVehicle(id, textures) {
  let byId = protos.get(textures);
  if (!byId) protos.set(textures, (byId = new Map()));
  let proto = byId.get(id);
  if (!proto) byId.set(id, (proto = buildVehicle(id, textures)));
  const root = new THREE.Group();
  root.name = proto.root.name;
  const parts = {};
  for (const [name, g] of Object.entries(proto.parts)) {
    const ng = new THREE.Group();
    ng.name = name;
    ng.position.copy(g.position);
    for (const c of g.children) {
      if (!c.isMesh) continue;
      const mesh = new THREE.Mesh(c.geometry, c.material);
      mesh.castShadow = c.castShadow;
      mesh.receiveShadow = c.receiveShadow;
      ng.add(mesh);
    }
    root.add(ng);
    parts[name] = ng;
  }
  const anchors = {};
  for (const [k, p] of Object.entries(proto.anchors)) anchors[k] = p.clone();
  root.userData = { anchors, parts, meta: proto.meta };
  return { root, parts, anchors, meta: proto.meta, mats: proto.mats, stats: proto.stats };
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
