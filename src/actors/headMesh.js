// A sculpted head and neck for the soldiers: those of the MakeHuman base mesh
// (headMeshData.js, CC0), shaped for each man and set on the game's skeleton.
//
// MakeHuman's head faces +Z and is measured from the point between its eyes;
// the game's faces -Z with its eyes at soldierRig's HEAD_CENTER and EYE_*.
// So the head is turned round, made a little larger (the game's head is a
// 1.78 m man's) and put with its eyes on the game's. Its neck is shorter than
// the game's body allows for, so below the jaw it is drawn down into the
// collar and kept inside the collar's ring.
//
// Every man's head is his own: MakeHuman's targets (one feature each: nose,
// chin, cheeks, lips, eyes, ears, fat; and the heads of its asian and african
// men) are added in the amounts headShape works out from the person's
// parameters (soldierKit.js personParams).
//
//   const shape = headShape(params)          // { name: amount } of the targets
//   const m = headMesh(shape, { coarse })    // coarse: the middle distance's few hundred vertices
//     m.count; m.positions, m.normals (Float32Array, model space, bind pose); m.index
//     m.head[i]: 0 the neck .. 1 the head; m.jaw, m.brow, m.hair: 0..1
//     m.colors[skin]: Float32Array r, g, b for each vertex, 1 = that skin's middle tone
//       (skin 0 caucasian, 1 asian, 2 african: MakeHuman's skins)
//     m.eyes: { L: Vector3, R: Vector3, r }   // the eyeballs' centres and radius
//   HEAD_SIZE: the plain head's skull, for headgear (soldierGear.js skull)
import * as THREE from 'three';
import { HEAD_DATA } from './headMeshData.js';
import { HEAD_CENTER } from './soldierRig.js';

const bytes = (s) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// The game's head against MakeHuman's (a 1.75 m man's): a little larger.
export const HEAD_SCALE = 1.05;
// Where the point between the eyeballs' centres goes (model space).
const EYES_AT = new THREE.Vector3(HEAD_CENTER.x, HEAD_CENTER.y + 0.001, HEAD_CENTER.z - 0.071);
// The neck goes down into the collar to here, from the jaw's level.
const NECK_LOW = 1.43;
const NECK_FROM = 1.545;

let D = null;
function data() {
  if (D) return D;
  const H = HEAD_DATA;
  const raw = new Int16Array(bytes(H.positions).buffer);
  const base = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) base[i] = raw[i] / H.steps;
  const blob = bytes(H.targetData);
  const targets = {};
  let at = 0;
  for (const [name, scale, count, eyeL, eyeR] of H.targets) {
    const idx = new Uint16Array(blob.buffer.slice(at, at + count * 2));
    const d = new Int8Array(blob.buffer.slice(at + count * 2, at + count * 5));
    targets[name] = { idx, d, scale, eyeL, eyeR };
    at += count * 5;
  }
  const u8 = (s) => {
    const b = bytes(s);
    const f = new Float32Array(b.length);
    for (let i = 0; i < b.length; i++) f[i] = b[i] / 255;
    return f;
  };
  const col = bytes(H.colors);
  const colors = [0, 1, 2].map((s) => {
    const f = new Float32Array(H.vertices * 3);
    for (let i = 0; i < H.vertices; i++) for (let k = 0; k < 3; k++) f[i * 3 + k] = col[i * 9 + s * 3 + k] / 128;
    return f;
  });
  D = {
    n: H.vertices,
    base,
    targets,
    index: new Uint16Array(bytes(H.index).buffer),
    coarse: new Uint16Array(bytes(H.coarse).buffer),
    coarseIndex: new Uint16Array(bytes(H.coarseIndex).buffer),
    head: u8(H.head),
    jaw: u8(H.jaw),
    brow: u8(H.brow),
    hair: u8(H.hair),
    colors,
  };
  return D;
}

// The amounts of MakeHuman's targets for a person (soldierKit.js personParams:
// shape values are mostly round 1, 0.85 to 1.15 or so; tone 0 pale .. 7 dark).
export function headShape(p = {}) {
  const s = p.shape || {};
  const w = {};
  // v round `mid`, `span` either way, onto -1..1 of a pair of targets.
  const pair = (name, v, mid = 1, span = 0.15, gain = 1) => {
    if (v === undefined) return;
    const x = Math.max(-1, Math.min(1, ((v - mid) / span) * gain));
    if (x > 0.01) w[name + '+'] = x;
    else if (x < -0.01) w[name + '-'] = -x;
  };
  pair('jaw', s.jaw, 1, 0.07, 0.7);
  pair('chinWidth', s.jaw, 1, 0.07, 0.6);
  pair('chinOut', s.chin, 1.01, 0.06, 0.6);
  pair('chinHeight', s.length, 1, 0.05, 0.5);
  pair('nose', s.nose, 1, 0.15, 0.7);
  pair('noseWidth', s.noseW, 1, 0.12, 0.7);
  pair('noseHump', s.noseHook ?? 0, 0, 1, 0.8);
  pair('nosePoint', s.noseBridge, 0.9, 0.3, -0.3);
  pair('noseLength', s.length, 1, 0.05, 0.4);
  pair('cheekBones', s.cheek, 1, 0.25, 0.7);
  pair('cheeks', 0.4 - (s.gaunt ?? 0), 0, 0.5, 0.7);
  pair('fat', 0.25 - (s.gaunt ?? 0), 0, 0.8, 0.5);
  pair('lips', s.lips, 0.97, 0.22, 0.6);
  pair('mouthWidth', s.width, 1, 0.06, 0.4);
  pair('eyes', s.eyeSize, 0.99, 0.07, 0.5);
  pair('eyesApart', s.eyeSpace, 1, 0.04, 0.5);
  pair('brow', s.brow, 1, 0.25, 0.6);
  pair('ears', s.earSize, 1, 0.08, 0.6);
  pair('earsOut', s.earOut, 1.05, 0.45, 0.7);
  if (s.jaw > 1.03) w.square = Math.min(0.6, (s.jaw - 1.03) * 12);
  else if (s.jaw < 0.97) w.oval = Math.min(0.5, (0.97 - s.jaw) * 10);
  // The men MakeHuman has heads for.
  if (p.asian) {
    w.asian = 0.85;
    w.eyeFold = Math.min(1, s.lid ?? 0.8) * 0.6;
  } else if ((p.tone ?? 0) >= 5) w.african = Math.min(1, 0.55 + 0.2 * (p.tone - 5));
  else if (p.tone === 4) w.african = 0.2;
  return w;
}

// Which of MakeHuman's skins a person's color variation comes from.
export const skinOf = (p = {}) => (p.asian ? 1 : (p.tone ?? 0) >= 5 ? 2 : 0);

const cache = new Map();
export function headMesh(shape = {}, { coarse = false } = {}) {
  const key = JSON.stringify(shape) + (coarse ? 'c' : '');
  const hit = cache.get(key);
  if (hit) return hit;
  const d = data();
  // The man's own head, in MakeHuman's space.
  const P = d.base.slice();
  const eL = new THREE.Vector3(...HEAD_DATA.eyes[0]),
    eR = new THREE.Vector3(...HEAD_DATA.eyes[1]);
  for (const [name, w] of Object.entries(shape)) {
    const t = d.targets[name];
    if (!t || !w) continue;
    const k = w * t.scale;
    for (let j = 0; j < t.idx.length; j++) {
      const i = t.idx[j] * 3;
      P[i] += t.d[j * 3] * k;
      P[i + 1] += t.d[j * 3 + 1] * k;
      P[i + 2] += t.d[j * 3 + 2] * k;
    }
    eL.add(new THREE.Vector3(...t.eyeL).multiplyScalar(w));
    eR.add(new THREE.Vector3(...t.eyeR).multiplyScalar(w));
  }
  // Onto the game's skeleton: turned to face -Z, sized, and the point between
  // his own eyes on the game's. (His own: MakeHuman's asian and african men
  // are of other heights, and their targets carry the whole head down or up.)
  const s = HEAD_SCALE;
  const mx = (eL.x + eR.x) / 2,
    my = (eL.y + eR.y) / 2,
    mz = (eL.z + eR.z) / 2;
  const place = (x, y, z, o) => o.set(EYES_AT.x - (x - mx) * s, EYES_AT.y + (y - my) * s, EYES_AT.z - (z - mz) * s);
  const n = d.n;
  const pos = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  let low = Infinity,
    zLow = 0,
    nLow = 0;
  for (let i = 0; i < n; i++) {
    place(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], v);
    pos.set([v.x, v.y, v.z], i * 3);
    if (v.y < low) low = v.y;
  }
  // Above the brow every man has the plain head's skull: his helmet and cap
  // are made to that one size. (His face, jaw and ears are his own.)
  if (Object.keys(shape).length) {
    const plain = headMesh({}).positions;
    for (let i = 0; i < n; i++) {
      const k = smooth(0.045, 0.075, plain[i * 3 + 1] - HEAD_CENTER.y);
      if (k > 0) for (let c = 0; c < 3; c++) pos[i * 3 + c] = lerp(pos[i * 3 + c], plain[i * 3 + c], k);
    }
  }
  for (let i = 0; i < n; i++) {
    if (pos[i * 3 + 1] < low + 0.02) {
      zLow += pos[i * 3 + 2];
      nLow++;
    }
  }
  zLow /= nLow;
  // The neck: drawn down to the collar, and kept inside the collar's ring
  // (the ring the old neck was built to: about 40 cm round at the top, wider
  // into the shoulders).
  const stretch = (NECK_FROM - NECK_LOW) / (NECK_FROM - low);
  for (let i = 0; i < n; i++) {
    let x = pos[i * 3],
      y = pos[i * 3 + 1],
      z = pos[i * 3 + 2];
    if (y >= NECK_FROM || d.head[i] >= 1) continue;
    // (Only what is of the neck: the jaw and chin stay as they are.)
    y = lerp(NECK_FROM - (NECK_FROM - y) * stretch, y, d.head[i]);
    const f = smooth(NECK_FROM, 1.5, y) * (1 - d.head[i]);
    const t = smooth(1.43, 1.6, y);
    const rx = lerp(0.08, 0.0635, Math.sqrt(t)),
      rz = lerp(0.071, 0.064, t),
      cz = lerp(0.025, 0.014, t);
    z += f * smooth(1.53, 1.46, y) * (cz - zLow);
    const r = Math.hypot(x / rx, (z - cz) / rz);
    if (r > 0.97) {
      const k = lerp(1, 0.97 / r, f);
      x *= k;
      z = cz + (z - cz) * k;
    }
    pos.set([x, y, z], i * 3);
  }
  const index = d.index;
  const normals = new Float32Array(n * 3);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    a.fromArray(pos, index[t] * 3);
    b.fromArray(pos, index[t + 1] * 3).sub(a);
    c.fromArray(pos, index[t + 2] * 3).sub(a);
    // (Turned round by a mirror in x and z: a turn, so the winding holds.)
    b.cross(c);
    for (let k = 0; k < 3; k++) {
      const i = index[t + k] * 3;
      normals[i] += b.x;
      normals[i + 1] += b.y;
      normals[i + 2] += b.z;
    }
  }
  for (let i = 0; i < n; i++) {
    a.fromArray(normals, i * 3).normalize();
    normals.set([a.x, a.y, a.z], i * 3);
  }
  const eyes = {
    L: place(eL.x, eL.y, eL.z, new THREE.Vector3()),
    R: place(eR.x, eR.y, eR.z, new THREE.Vector3()),
    r: HEAD_DATA.eyes[2] * s,
  };
  let out = {
    count: n,
    positions: pos,
    normals,
    index,
    head: d.head,
    jaw: d.jaw,
    brow: d.brow,
    hair: d.hair,
    colors: d.colors,
    eyes,
  };
  if (coarse) {
    // Some of the same vertices, with their own triangles.
    const pick = (src, w) => {
      const o = new Float32Array(d.coarse.length * w);
      for (let i = 0; i < d.coarse.length; i++) for (let k = 0; k < w; k++) o[i * w + k] = src[d.coarse[i] * w + k];
      return o;
    };
    out = {
      count: d.coarse.length,
      positions: pick(pos, 3),
      normals: pick(normals, 3),
      index: d.coarseIndex,
      head: pick(d.head, 1),
      jaw: pick(d.jaw, 1),
      brow: pick(d.brow, 1),
      hair: pick(d.hair, 1),
      colors: d.colors.map((c3) => pick(c3, 3)),
      eyes,
    };
  }
  if (cache.size > 64) cache.delete(cache.keys().next().value);
  cache.set(key, out);
  return out;
}

// How far the plain head's skull reaches from its upright axis (through
// soldierRig's HEAD_CENTER, 2 mm back) at height y above the centre, toward
// th (0 the front, round by the wearer's right): soft headgear is built
// round it (soldierGear.js skull). Above the crown, 0.
const TH = 48,
  Y0 = -0.03,
  DY = 0.0025;
let table = null;
export let SKULL_TOP = 0;
export function skullRadius(th, y) {
  if (!table) {
    const rows = Math.ceil((0.13 - Y0) / DY) + 1;
    const raw = Array.from({ length: rows }, () => new Float32Array(TH));
    // (The plain head and the biggest the men come with: one cap fits them all.)
    for (const shape of [{}, { 'fat+': 0.5 }, { square: 0.6 }, { asian: 0.85 }, { african: 1 }]) measure(headMesh(shape), raw, rows);
    // (A cell nothing fell in takes the most of its neighbours.)
    table = raw.map((row, j) => row.map((r, k) => r || Math.max(...[-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => raw[j + a]?.[(k + b + TH) % TH] ?? 0)))));
  }
  const fj = Math.max(0, Math.min(table.length - 1.001, (y - Y0) / DY));
  const fk = ((((th / (2 * Math.PI)) * TH) % TH) + TH) % TH;
  const j = Math.floor(fj),
    k = Math.floor(fk);
  const tj = fj - j,
    tk = fk - k;
  const at = (a, b) => table[a][b % TH];
  return lerp(lerp(at(j, k), at(j, k + 1), tk), lerp(at(j + 1, k), at(j + 1, k + 1), tk), tj);
}
function measure(m, raw, rows) {
  {
    // (Points all over each triangle, not only its corners: the scalp's
    // triangles are bigger than the cells.)
    const P = m.positions;
    const put = (x, y, z) => {
      const dx = x - HEAD_CENTER.x,
        dy = y - HEAD_CENTER.y,
        dz = z - HEAD_CENTER.z + 0.002;
      SKULL_TOP = Math.max(SKULL_TOP, dy);
      const j = Math.round((dy - Y0) / DY);
      if (j < 0 || j >= rows) return;
      // (Not the ears: they count as the side of the head they stand on.)
      const ex = dy < 0.03 ? Math.max(-0.07, Math.min(0.07, dx)) : dx;
      const k = ((Math.round((Math.atan2(ex, -dz) / (2 * Math.PI)) * TH) % TH) + TH) % TH;
      raw[j][k] = Math.max(raw[j][k], Math.hypot(ex, dz));
    };
    const S = 5;
    for (let t = 0; t < m.index.length; t += 3) {
      const a = m.index[t] * 3,
        b = m.index[t + 1] * 3,
        c = m.index[t + 2] * 3;
      for (let u = 0; u <= S; u++)
        for (let v = 0; u + v <= S; v++) {
          const wa = u / S,
            wb = v / S,
            wc = 1 - wa - wb;
          put(P[a] * wa + P[b] * wb + P[c] * wc, P[a + 1] * wa + P[b + 1] * wb + P[c + 1] * wc, P[a + 2] * wa + P[b + 2] * wb + P[c + 2] * wc);
        }
    }
  }
}

// The plain head's skull, from the head's centre (soldierRig HEAD_CENTER):
// half its width over the ears, how far it reaches forward (the forehead) and
// back, and its top. Headgear is built round these.
export function headSize() {
  const m = headMesh({});
  let rx = 0,
    front = 0,
    back = 0,
    top = 0;
  for (let i = 0; i < m.count; i++) {
    const x = m.positions[i * 3],
      y = m.positions[i * 3 + 1] - HEAD_CENTER.y,
      z = m.positions[i * 3 + 2] - HEAD_CENTER.z;
    top = Math.max(top, y);
    if (y < 0.035) continue; // above the ears and brows
    rx = Math.max(rx, Math.abs(x));
    front = Math.max(front, -z);
    back = Math.max(back, z);
  }
  return { rx, front, back, top };
}
