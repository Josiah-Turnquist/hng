// The M1 Garand from a downloaded model: an option for the gun in your hands
// (Settings, Screen: "M1 Garand model"; other soldiers keep our own model).
//
// "Realistic M1 Garand" by Raymond (rookieray), from Sketchfab:
// https://sketchfab.com/3d-models/realistic-m1-garand-8d639aed01a94c8bb6e8cb58070a71f3
// License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). The file
// is kept as it was downloaded; the changes below are made as it loads.
//
// Fitted to the conventions of our own gun models (kit.js: meters, bore along
// Z at x = y = 0, muzzle toward -Z, trigger at z = 0) and to the game:
//  * Size: its sights are as far apart as a real Garand's (709 mm). As drawn
//    it is 22% bigger than that, and at the right size its stock comes out
//    about 5 cm short of a real one.
//  * The rounds, empty cases and spent clip set out round the rifle for its
//    loading animation are left out, and the clip goes where that animation
//    seats it in the magazine (its top round is in the chamber).
//  * The rear sight is cut out of the body as a part of its own, so it slides
//    up for longer ranges as ours does, and its peep hole is opened up to the
//    size of ours (6 mm across; drawn 2.2 mm), the disc round it grown to match.
//  * The bolt and the operating rod move, each with its own travel (from the
//    model's animation).
//  * Grips, trigger, shoulder, muzzle and sights are measured on the model.
//
// Its three texture images are decoded here (createImageBitmap) rather than by
// the model loader, which needs to fetch them from blob: addresses that a
// locked-down page may not allow. Without image decoding (Node, for the tests)
// the rifle comes out in plain colors.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Where the file is, next to the game page: the .glb itself or, for hosts that
// will not serve .glb files (a claude.ai artifact), the same bytes as base64
// text (written by the build). Tried in turn.
export const DOWNLOADED_GARAND_URLS = ['assets/models/m1_garand_rookieray.glb', 'assets/models/m1_garand_rookieray.glb.b64.txt'];

// Our point = S * (model point - C), the model point in its scene as loaded.
const S = 0.817;
const C = [0.0626, -9.4672, 0.2484];
// Model nodes and the part each goes in; the rest are left out.
const PARTS = { Garand001: 'body', Recieve: 'body', Bolt: 'bolt', Charging_Handle: 'opRod', Clip: 'clip' };
// The clip where the animation seats it, from where it is drawn (model units).
const CLIP_SEATED = [0.1038, -0.1101, 0];
// The peep hole (our space): its center, the hole's and the disc's radii as
// drawn, and as we make them.
const HOLE = { c: [0, 0.0233, -0.0021], r: 0.0011, R: 0.0044, r2: 0.003, R2: 0.0064 };
// The aperture's stem reaches this much deeper into the sight base, so no gap
// opens under it when the sight is raised (by up to 15 mm, at 1200 yards).
const STEM = 0.016;
const ANCHORS = {
  muzzle: [0, 0, -0.7476],
  frontSight: [0, 0.0232, -0.7123], // top of the blade (the ears beside it stand 2 mm higher)
  rearSight: HOLE.c,
  ejectionPort: [0, 0.012, -0.089],
  clipGuide: [0, 0.012, -0.089], // top of the seated clip
  chargingHandle: [0.0294, -0.0095, -0.101], // the operating rod's handle
  trigger: [0, -0.077, 0],
  gripR: [0, -0.08, 0.076],
  gripL: [0, -0.039, -0.36], // under the fore-end
  shoulder: [0, -0.1, 0.279], // the butt plate
};
// (Its wrist is thicker than ours: the right hand closes round 2.3 cm, not 1.9.)
const META = { sight: 'aperture', sightKind: 'slide', boltThrow: 0.0624, opRodThrow: 0.0947, gripRadius: 0.023, downloaded: true };

let state = 'idle'; // 'loading' | 'ready' | 'failed'
let pending = null;
let proto = null;

export function downloadedGarandState() {
  return state;
}

// Start loading (once). Resolves to the fitted model, or null if it failed.
export function loadDownloadedGarand(urls = DOWNLOADED_GARAND_URLS) {
  if (pending) return pending;
  state = 'loading';
  pending = (async () => {
    const why = [];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        proto = await parseDownloadedGarand(url.endsWith('.txt') ? fromBase64(await r.text()) : await r.arrayBuffer());
        state = 'ready';
        return proto;
      } catch (e) {
        why.push(`${url}: ${e?.message || e}`);
      }
    }
    state = 'failed';
    console.warn(`The downloaded M1 Garand could not be loaded (${why.join('; ')})`);
    return null;
  })();
  return pending;
}

function fromBase64(text) {
  const s = atob(text.replace(/\s+/g, ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

// A copy of the loaded rifle ({ root, parts, anchors, meta }, as buildGun gives),
// sharing its geometry and material; null until it has loaded.
export function buildDownloadedGarand() {
  return proto ? copy(proto) : null;
}

// The .glb file's contents -> the fitted rifle.
export async function parseDownloadedGarand(arrayBuffer) {
  const { json, bin } = readGlb(arrayBuffer);
  const mat = await material(json, bin);
  const bare = structuredClone(json);
  delete bare.images;
  delete bare.textures;
  delete bare.samplers;
  for (const m of bare.materials || []) {
    delete m.normalTexture;
    delete m.pbrMetallicRoughness;
  }
  const gltf = await new GLTFLoader().parseAsync(writeGlb(bare, bin), '');
  return fit(gltf, mat);
}

function fit(gltf, mat) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const ours = new THREE.Matrix4().makeScale(S, S, S).multiply(new THREE.Matrix4().makeTranslation(-C[0], -C[1], -C[2]));
  const geos = { body: [], rearSight: [], bolt: [], opRod: [], clip: [] };
  let main = null;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let n = o;
    while (n && !Object.hasOwn(PARTS, n.name)) n = n.parent;
    if (!n) return; // the chambered round, the empty cases, the spent clip
    const M = ours.clone();
    if (n.name === 'Clip') M.multiply(new THREE.Matrix4().makeTranslation(...CLIP_SEATED));
    M.multiply(o.matrixWorld);
    const geo = o.geometry.clone().applyMatrix4(M);
    if (n.name === 'Garand001') main = geo;
    else geos[PARTS[n.name]].push(geo);
  });
  if (!main) throw new Error('no rifle body (Garand001) in the model');
  // The rear sight: the piece of the body round the peep hole.
  const [rest, sight] = splitPiece(main, [HOLE.c[0], HOLE.c[1] + HOLE.r, HOLE.c[2]]);
  geos.body.unshift(rest);
  geos.rearSight.push(widenHole(sight));

  const center = (list) => {
    const b = new THREE.Box3();
    for (const g of list) {
      g.computeBoundingBox();
      b.union(g.boundingBox);
    }
    return b.getCenter(new THREE.Vector3()).toArray();
  };
  const pivots = { body: [0, 0, 0], rearSight: HOLE.c, bolt: center(geos.bolt), opRod: center(geos.opRod), clip: center(geos.clip) };
  const root = new THREE.Group();
  root.name = 'm1_garand_downloaded';
  const parts = {};
  for (const [name, list] of Object.entries(geos)) {
    const g = new THREE.Group();
    g.name = name;
    const p = pivots[name];
    g.position.set(p[0], p[1], p[2]);
    for (const geo of list) {
      geo.translate(-p[0], -p[1], -p[2]);
      geo.computeBoundingSphere();
      g.add(new THREE.Mesh(geo, mat));
    }
    root.add(g);
    parts[name] = g;
  }
  const anchors = {};
  for (const [k, v] of Object.entries(ANCHORS)) anchors[k] = new THREE.Vector3(v[0], v[1], v[2]);
  const meta = { ...META };
  root.userData = { anchors, parts, meta };
  return { root, parts, anchors, meta };
}

// Split off the connected piece of an indexed geometry that has the vertex
// nearest to `at` (vertices in the same place count as joined). -> [rest, piece]
function splitPiece(geo, at) {
  const pos = geo.attributes.position;
  const idx = geo.index.array;
  const weld = new Int32Array(pos.count);
  const seen = new Map();
  let near = 0,
    nearD = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const k = `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
    if (!seen.has(k)) seen.set(k, seen.size);
    weld[i] = seen.get(k);
    const d = (x - at[0]) ** 2 + (y - at[1]) ** 2 + (z - at[2]) ** 2;
    if (d < nearD) {
      nearD = d;
      near = i;
    }
  }
  const up = new Int32Array(seen.size).map((_, i) => i);
  const find = (a) => {
    while (up[a] !== a) a = up[a] = up[up[a]];
    return a;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(weld[idx[t]]);
    up[find(weld[idx[t + 1]])] = a;
    up[find(weld[idx[t + 2]])] = a;
  }
  const mine = find(weld[near]);
  const inPiece = [],
    rest = [];
  for (let t = 0; t < idx.length; t += 3) (find(weld[idx[t]]) === mine ? inPiece : rest).push(idx[t], idx[t + 1], idx[t + 2]);
  return [subset(geo, rest), subset(geo, inPiece)];
}

// A geometry of the given triangles (vertex indices) only.
function subset(geo, tris) {
  const map = new Map();
  const index = tris.map((i) => {
    if (!map.has(i)) map.set(i, map.size);
    return map.get(i);
  });
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    const arr = new a.array.constructor(map.size * a.itemSize);
    for (const [from, to] of map) for (let k = 0; k < a.itemSize; k++) arr[to * a.itemSize + k] = a.array[from * a.itemSize + k];
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  out.setIndex(index);
  return out;
}

// Open the peep hole up: the disc's points move out from the hole's middle, the
// hole's edge to r2 and the disc's to R2, those between in proportion. (The
// faces keep their facing: the hole's wall still faces in, the disc's sides
// still face along the bore.)
function widenHole(geo) {
  const pos = geo.attributes.position;
  const [cx, cy] = HOLE.c;
  const k = (HOLE.R2 - HOLE.r2) / (HOLE.R - HOLE.r);
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - cx,
      dy = pos.getY(i) - cy;
    const r = Math.hypot(dx, dy);
    if (r < HOLE.R * 1.08) {
      const s = (HOLE.r2 + (r - HOLE.r) * k) / Math.max(r, 1e-6);
      pos.setXY(i, cx + dx * s, cy + dy * s);
    } else if (dy < -0.0085) pos.setY(i, pos.getY(i) - STEM); // the stem's foot
  }
  pos.needsUpdate = true;
  return geo;
}

function copy(p) {
  const ud = p.root.userData;
  p.root.userData = {}; // (Object3D.clone would copy the parts and anchors as JSON)
  const root = p.root.clone(true);
  p.root.userData = ud;
  const parts = {};
  for (const g of root.children) parts[g.name] = g;
  const anchors = {};
  for (const [k, v] of Object.entries(p.anchors)) anchors[k] = v.clone();
  const meta = { ...p.meta };
  root.userData = { anchors, parts, meta };
  return { root, parts, anchors, meta };
}

// One material for the whole rifle (both of the model's materials use the same
// textures): base color, metal and roughness, and the normal map.
async function material(json, bin) {
  const m = new THREE.MeshStandardMaterial({ name: 'downloadedGarand', side: THREE.DoubleSide, metalness: 1, roughness: 1 });
  const def = json.materials?.[0];
  if (typeof createImageBitmap !== 'function' || !def?.pbrMetallicRoughness) {
    m.color.setRGB(0.3, 0.1, 0.05);
    m.metalness = 0.2;
    m.roughness = 0.6;
    return m;
  }
  const texture = async (ref, srgb) => {
    const img = json.images[json.textures[ref.index].source];
    const view = json.bufferViews[img.bufferView];
    const start = view.byteOffset || 0;
    const blob = new Blob([bin.subarray(start, start + view.byteLength)], { type: img.mimeType });
    const t = new THREE.Texture(await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }));
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const pbr = def.pbrMetallicRoughness;
  const [map, orm, normal] = await Promise.all([texture(pbr.baseColorTexture, true), texture(pbr.metallicRoughnessTexture, false), texture(def.normalTexture, false)]);
  m.map = map;
  m.metalnessMap = m.roughnessMap = orm;
  m.normalMap = normal;
  return m;
}

// A .glb file is a header and chunks: the JSON, then the binary data.
function readGlb(ab) {
  const dv = new DataView(ab);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb file');
  let json = null,
    bin = null;
  for (let at = 12; at + 8 <= dv.byteLength; ) {
    const len = dv.getUint32(at, true),
      type = dv.getUint32(at + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, at + 8, len)));
    else if (type === 0x004e4942) bin = new Uint8Array(ab, at + 8, len);
    at += 8 + len;
  }
  if (!json || !bin) throw new Error('a .glb file without its JSON or binary data');
  return { json, bin };
}

function writeGlb(json, bin) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jlen = Math.ceil(text.length / 4) * 4;
  const blen = Math.ceil(bin.length / 4) * 4;
  const out = new Uint8Array(12 + 8 + jlen + 8 + blen);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // "glTF"
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, jlen, true);
  dv.setUint32(16, 0x4e4f534a, true); // "JSON"
  out.set(text, 20);
  out.fill(0x20, 20 + text.length, 20 + jlen);
  dv.setUint32(20 + jlen, blen, true);
  dv.setUint32(24 + jlen, 0x004e4942, true); // "BIN"
  out.set(bin, 28 + jlen);
  return out.buffer;
}
