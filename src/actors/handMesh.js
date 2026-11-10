// A sculpted hand for the soldiers: the hand of the MakeHuman base mesh
// (handMeshData.js, CC0), fitted to the game's own hand.
//
// The game's hand is a set of joints (soldierRig.js HAND_JOINTS: the wrist at
// 0, fingers down -Y, the thumb forward to -Z, the back of the hand to +X for
// a right hand) and two bones a finger. MakeHuman's hand stands differently
// (arms out, fingers a little spread and bent), is a different size and has
// three bones a finger. So each of its bones is moved onto the game's bone
// that does its work (turned the shortest way, stretched to length), and each
// vertex goes with its bones by MakeHuman's own skin weights: its fingers end
// up straight along the game's, knuckles on the game's knuckle joints, and the
// flesh between follows smoothly.
//
//   const m = handMesh()   // the right hand, built once
//     m.count; m.positions, m.normals (Float32Array, hand space, metres)
//     m.index (Uint16Array triangles)
//     m.bones[i]: [[name, weight], ...] with name 'fore' | 'hand' |
//       'thumb1' | 'thumb2' | 'index1' ... 'pinky2' (bone 1 or 2 of a finger)
//     m.part[i]: 0 the palm, 1..5 thumb..pinky (the finger a vertex is mostly of)
//   (A left hand is the same mirrored in x.)
import * as THREE from 'three';
import { HAND_DATA } from './handMeshData.js';
import { HAND_JOINTS, FINGER_NAMES } from './soldierRig.js';

const bytes = (s) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// The direction of the forearm from the wrist, in the hand's space (bind pose).
const FOREARM_UP = new THREE.Vector3(-0.04, 0.995, 0.094).normalize();

let cached = null;
export function handMesh() {
  if (cached) return cached;
  const D = HAND_DATA;
  const n = D.vertices;
  const raw = new Int16Array(bytes(D.positions).buffer);
  const skin = bytes(D.skin);
  const index = new Uint16Array(bytes(D.index).buffer);
  const B = Object.fromEntries(D.bones.map(([name, hx, hy, hz, tx, ty, tz]) => [name, { h: new THREE.Vector3(hx, hy, hz), t: new THREE.Vector3(tx, ty, tz) }]));
  const J = Object.fromEntries(FINGER_NAMES.map((f) => [f, HAND_JOINTS[f].map((p) => new THREE.Vector3(...p))]));

  // MakeHuman's hand axes: along the fingers, across the knuckles toward the
  // thumb, out of the back of the hand.
  const along = B['finger3-1.R'].h.clone().normalize();
  const across = B['finger2-1.R'].h.clone().sub(B['finger5-1.R'].h).normalize();
  const back = new THREE.Vector3().crossVectors(along, across).normalize();
  across.crossVectors(back, along).normalize();
  // ... onto the game's: back +X, fingers -Y, thumb -Z.
  const R0 = new THREE.Matrix4().makeBasis(back, along.clone().negate(), across.clone().negate()).transpose();
  const q0 = new THREE.Quaternion().setFromRotationMatrix(R0);
  // One size for the whole hand: by the length of the middle finger's line
  // from the wrist to its tip, and the breadth across the knuckles.
  const len = (pts) => pts.reduce((a, p, i) => (i ? a + p.distanceTo(pts[i - 1]) : 0), 0);
  const mhMiddle = [new THREE.Vector3(), B['finger3-1.R'].h, B['finger3-2.R'].h, B['finger3-3.R'].h, B['finger3-3.R'].t];
  const sLen = len([new THREE.Vector3(), ...J.middle]) / len(mhMiddle);
  const sBreadth = J.index[0].distanceTo(J.pinky[0]) / B['finger2-1.R'].h.distanceTo(B['finger5-1.R'].h);
  const s = (sLen + sBreadth) / 2;
  const toGame = (p, o = new THREE.Vector3()) => o.copy(p).applyQuaternion(q0).multiplyScalar(s);

  // Each MakeHuman bone: where its head and tail go in the game's hand, and
  // which of the game's bones it moves with.
  const order = D.bones.map((b) => b[0]);
  const fit = order.map((name) => {
    const b = B[name];
    let head, tail, bone;
    const m = /^finger(\d)-(\d)\.R$/.exec(name);
    if (m) {
      const f = FINGER_NAMES[m[1] - 1];
      head = J[f][m[2] - 1];
      tail = J[f][+m[2]];
      bone = f + (m[2] === '1' ? 1 : 2);
    } else if (name.startsWith('metacarpal')) {
      // The bones of the palm: from where they start in MakeHuman's hand to
      // the game's knuckle of their finger.
      head = toGame(b.h);
      tail = J[FINGER_NAMES[+name[10]]][0];
      bone = 'hand';
    } else if (name === 'lowerarm02.R') {
      // (Its head is up the arm: the stub of forearm, straight up into the cuff.)
      head = FOREARM_UP.clone().multiplyScalar(b.h.length() * s);
      tail = new THREE.Vector3();
      bone = 'fore';
    } else {
      head = new THREE.Vector3();
      tail = toGame(b.t);
      bone = 'hand';
    }
    const dm = toGame(b.t).sub(toGame(b.h));
    const lm = dm.length();
    dm.divideScalar(lm);
    const dg = tail.clone().sub(head);
    const lg = dg.length();
    dg.divideScalar(lg);
    return { h: b.h, head, dm, k: lg / lm, q: new THREE.Quaternion().setFromUnitVectors(dm, dg), bone };
  });

  const positions = new Float32Array(n * 3);
  const bones = new Array(n);
  const part = new Uint8Array(n);
  const p = new THREE.Vector3(),
    v = new THREE.Vector3(),
    acc = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.set(raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]).divideScalar(D.steps);
    acc.set(0, 0, 0);
    let total = 0;
    const w = {};
    for (let k = 0; k < 4; k++) {
      const wk = skin[i * 8 + k * 2 + 1] / 255;
      if (!wk) continue;
      const f = fit[skin[i * 8 + k * 2]];
      // Into the game's frame and size about the bone's head, stretched along
      // the bone to the game's length, turned onto the game's bone.
      toGame(v.copy(p).sub(f.h), v);
      v.addScaledVector(f.dm, (f.k - 1) * v.dot(f.dm));
      v.applyQuaternion(f.q).add(f.head);
      acc.addScaledVector(v, wk);
      total += wk;
      w[f.bone] = (w[f.bone] || 0) + wk;
    }
    acc.divideScalar(total);
    positions.set([acc.x, acc.y, acc.z], i * 3);
    bones[i] = Object.entries(w)
      .map(([name, x]) => [name, x / total])
      .sort((a, b) => b[1] - a[1]);
    // The finger it is mostly of (for the shade between fingers), else the palm.
    const fw = FINGER_NAMES.map((f) => (w[f + 1] || 0) + (w[f + 2] || 0));
    const best = fw.indexOf(Math.max(...fw));
    part[i] = fw[best] / total > 0.5 ? best + 1 : 0;
  }

  // Normals from the triangles (by area), smooth over the whole hand.
  const normals = new Float32Array(n * 3);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    a.fromArray(positions, index[t] * 3);
    b.fromArray(positions, index[t + 1] * 3).sub(a);
    c.fromArray(positions, index[t + 2] * 3).sub(a);
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
  cached = { count: n, positions, normals, index, bones, part, scale: s };
  return cached;
}
