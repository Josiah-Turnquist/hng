// Skeleton layout and pose math for the procedural soldier.
//
// Model space: meters, +Y up, the soldier faces -Z, +X is his right. The root is
// at the feet. In the bind pose the bones carry no rotation (only offsets), so a
// bone's model-space rotation is simply the product of the local rotations above it.
import * as THREE from 'three';

export const B = {
  hips: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  shoulderL: 5,
  upperArmL: 6,
  forearmL: 7,
  handL: 8,
  shoulderR: 9,
  upperArmR: 10,
  forearmR: 11,
  handR: 12,
  thighL: 13,
  shinL: 14,
  footL: 15,
  thighR: 16,
  shinR: 17,
  footR: 18,
  // Fingers (appended so the body indices above never change): per hand the
  // thumb, then index, middle, ring and little finger, two bones each. Bone 1
  // pivots at the base knuckle (thumb: at the wrist, CMC joint), bone 2 at the
  // middle knuckle and carries the last two phalanges.
  thumbL1: 19,
  thumbL2: 20,
  indexL1: 21,
  indexL2: 22,
  middleL1: 23,
  middleL2: 24,
  ringL1: 25,
  ringL2: 26,
  pinkyL1: 27,
  pinkyL2: 28,
  thumbR1: 29,
  thumbR2: 30,
  indexR1: 31,
  indexR2: 32,
  middleR1: 33,
  middleR2: 34,
  ringR1: 35,
  ringR2: 36,
  pinkyR1: 37,
  pinkyR2: 38,
};
export const BONE_NAMES = Object.keys(B);
export const BONE_COUNT = BONE_NAMES.length;
export const BODY_BONES = 19; // bones before the fingers
const fingerParents = (hand, first) => [hand, first, hand, first + 2, hand, first + 4, hand, first + 6, hand, first + 8];
export const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 2, 9, 10, 11, 0, 13, 14, 0, 16, 17, ...fingerParents(8, 19), ...fingerParents(12, 29)];

// Joint positions in the bind pose (a 1.78 m man standing, arms hanging).
const arm = (s) => [
  [s * 0.03, 1.43, -0.03], // shoulder: sternoclavicular joint
  [s * 0.18, 1.425, 0.015], // upper arm: shoulder joint
  [s * 0.205, 1.12, 0.03], // forearm: elbow
  [s * 0.215, 0.855, 0.005], // hand: wrist
];
const leg = (s) => [
  [s * 0.092, 0.925, 0.0], // thigh: hip joint
  [s * 0.097, 0.5, -0.005], // shin: knee
  [s * 0.1, 0.085, 0.02], // foot: ankle
];
// Hand joints relative to the wrist, for the right hand: x > 0 toward the back
// of the hand (outward), x < 0 toward the palm, y down the fingers, z < 0 toward
// the thumb (forward in the bind pose). Mirrored in x for the left hand. A hand of
// 19 cm from the wrist joint to the middle fingertip (ANSUR 1988 hand length ~19.4
// cm; phalanx ratios from Alexander & Viktor 2010; est.).
export const HAND_JOINTS = {
  // [base knuckle (bone 1 pivot), middle knuckle (bone 2 pivot), last knuckle, tip]
  thumb: [
    [-0.01, -0.024, -0.02],
    [-0.02, -0.062, -0.04],
    [-0.024, -0.092, -0.046],
    [-0.027, -0.115, -0.048],
  ],
  index: [
    [-0.003, -0.09, -0.025],
    [-0.003, -0.133, -0.027],
    [-0.003, -0.158, -0.028],
    [-0.003, -0.177, -0.028],
  ],
  middle: [
    [-0.003, -0.094, -0.007],
    [-0.003, -0.142, -0.007],
    [-0.003, -0.17, -0.007],
    [-0.003, -0.19, -0.007],
  ],
  ring: [
    [-0.003, -0.09, 0.011],
    [-0.003, -0.135, 0.012],
    [-0.003, -0.161, 0.013],
    [-0.003, -0.18, 0.013],
  ],
  pinky: [
    [-0.003, -0.082, 0.027],
    [-0.003, -0.115, 0.029],
    [-0.003, -0.135, 0.03],
    [-0.003, -0.151, 0.03],
  ],
};
export const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const WRIST = { [-1]: arm(-1)[3], [1]: arm(1)[3] };
// Model-space bind position of a hand-local point (side -1 left, 1 right).
export function handPoint(side, p, out = new THREE.Vector3()) {
  const w = WRIST[side < 0 ? -1 : 1];
  return out.set(w[0] + (side < 0 ? -p[0] : p[0]), w[1] + p[1], w[2] + p[2]);
}
const fingerJoints = (side) => FINGER_NAMES.flatMap((f) => [HAND_JOINTS[f][0], HAND_JOINTS[f][1]]).map((p) => handPoint(side, p).toArray());

export const BIND = [
  [0, 0.95, 0.0], // hips (pelvis center)
  [0, 1.07, 0.01], // spine (lumbar)
  [0, 1.25, 0.0], // chest (thoracic)
  [0, 1.46, 0.015], // neck (base)
  [0, 1.585, 0.01], // head (top of the neck)
  ...arm(-1),
  ...arm(1),
  ...leg(-1),
  ...leg(1),
  ...fingerJoints(-1),
  ...fingerJoints(1),
].map((p) => new THREE.Vector3(...p));

// Finger bone indices per side: { thumb: [b1, b2], index: [...], ... }.
export const FINGER_BONES = {
  [-1]: Object.fromEntries(FINGER_NAMES.map((f, i) => [f, [B.thumbL1 + 2 * i, B.thumbL1 + 2 * i + 1]])),
  [1]: Object.fromEntries(FINGER_NAMES.map((f, i) => [f, [B.thumbR1 + 2 * i, B.thumbR1 + 2 * i + 1]])),
};
// Mirror an axis given for the right hand to the left hand (a rotation axis is
// an axial vector: reflecting x keeps its x component and flips the others).
export function handAxis(side, x, y, z, out = new THREE.Vector3()) {
  return side < 0 ? out.set(x, -y, -z) : out.set(x, y, z);
}

// Offset of each bone from its parent (bind pose).
export const OFFSET = BIND.map((p, i) => (PARENT[i] < 0 ? p.clone() : p.clone().sub(BIND[PARENT[i]])));

// Head center (for the face) and eyes, in model space (bind pose).
export const HEAD_CENTER = new THREE.Vector3(0, 1.648, -0.002);
export const EYE_R = new THREE.Vector3(0.032, 1.648, -0.084);
export const EYE_L = new THREE.Vector3(-0.032, 1.648, -0.084);

// Segment lengths.
export const LEN = {
  upperArm: OFFSET[B.forearmR].length(),
  forearm: OFFSET[B.handR].length(),
  thigh: OFFSET[B.shinR].length(),
  shin: OFFSET[B.footR].length(),
};

// Hand frames. A hand that grips a cylinder (a rifle wrist, a pistol grip)
// holds it here, in the hand bone's frame (bind orientation: fingers -Y, thumb
// -Z, palm facing the body's midline). The cylinder axis runs along Z.
export const GRIP_CENTER_R = new THREE.Vector3(-0.03, -0.083, 0.0);
export const GRIP_CENTER_L = new THREE.Vector3(0.03, -0.083, 0.0);
// The palm surface is ~1.9 cm in front of the wrist joint's axis; a grip of
// radius r lies against it, centered (1.9 cm + r) in front of the axis.
export const PALM_X = 0.019;
export function gripCenter(side, r, out = new THREE.Vector3()) {
  return out.set((side < 0 ? 1 : -1) * (PALM_X + r), -0.083, 0.0);
}

// Close a hand. curl: middle, ring and little fingers (0 open .. 1 fist),
// index and thumb separately (a trigger finger stays straighter), spread: the
// fingers fan out a little when open. Angles of the base and middle knuckles
// for a full fist (MCP ~90 deg, PIP + DIP ~110 deg; est.).
const _hq = new THREE.Quaternion(),
  _hq2 = new THREE.Quaternion(),
  _ha = new THREE.Vector3();
const FIST = { index: [1.5, 1.95], middle: [1.55, 2.05], ring: [1.58, 2.05], pinky: [1.6, 2.0] };
const SPREAD = { index: 0.1, middle: 0.02, ring: -0.06, pinky: -0.14 };
// Knuckle angles [a1, a2] that wrap a finger round a cylinder of radius r lying
// against the palm (see gripCenter), from circle intersections in the plane of
// the finger: the middle knuckle and the tip both touch the cylinder. cy: where
// the cylinder crosses the hand (from the wrist; -0.083 at the finger roots, as
// a grip is held, about -0.06 for a fore-end lying in the palm); cup: how far it
// sinks into the palm's flesh.
const WRAP = {};
function wrapAngles(name, r, cy = -0.083, cup = 0) {
  const key = `${name}${Math.round(r * 2000)}|${Math.round(cy * 2000)}|${Math.round(cup * 2000)}`;
  if (WRAP[key]) return WRAP[key];
  const J = HAND_JOINTS[name];
  const fr = { thumb: 0.0095, index: 0.0088, middle: 0.009, ring: 0.0086, pinky: 0.0078 }[name];
  // 2D: x toward the back of the hand, y along the hand.
  const M = [J[0][0], J[0][1]],
    Pj = [J[1][0], J[1][1]],
    T = [J[3][0], J[3][1]];
  const L1 = Math.hypot(Pj[0] - M[0], Pj[1] - M[1]),
    L2 = Math.hypot(T[0] - Pj[0], T[1] - Pj[1]);
  const C = [-(PALM_X + r - cup), cy];
  const rho = r + fr;
  // Angle a (from straight down, toward the palm) where a segment from A of
  // length L meets the circle (C, rho); the far intersection (wrapping round).
  // The first angle (curling from a0) at which a segment from A of length L
  // touches the circle (C, rho), or its closest approach.
  const reach = (A, L, a0) => {
    let best = null;
    for (let i = 0; i <= 320; i++) {
      const a = a0 + (i / 320) * 3.2;
      const x = A[0] - Math.sin(a) * L,
        y = A[1] - Math.cos(a) * L;
      const d = Math.hypot(x - C[0], y - C[1]);
      if (d <= rho) return { a, p: [x, y] };
      if (best === null || d < best.d) best = { a, d, p: [x, y] };
    }
    return best;
  };
  if (name === 'thumb') {
    // The thumb starts above the grip and reaches over it: its metacarpal
    // turns until the base knuckle meets the grip, the last joints stay
    // nearly straight along it. Angles from the thumb's own rest direction.
    const a0 = Math.atan2(-(Pj[0] - M[0]), -(Pj[1] - M[1]));
    const p1 = reach(M, L1, a0);
    const p2 = reach(p1.p, L2, p1.a - 0.4);
    return (WRAP[key] = [Math.min(1.2, p1.a - a0), Math.max(-0.3, Math.min(0.9, p2.a - p1.a))]);
  }
  const p1 = reach(M, L1, 0);
  const p2 = reach(p1.p, L2, p1.a);
  // The rigid middle + last phalanx is built straight: aim its tip at the
  // contact point, a little short of a full wrap.
  return (WRAP[key] = [Math.min(1.75, p1.a), Math.min(2.3, p2.a - p1.a)]);
}

// A finger's two bones bent a1 at the base knuckle and a2 at the middle one
// (rad, toward the palm about the knuckle line, z), the first also spread by sp
// (about the palm normal, x).
export function fingerRotations(side, a1, a2, sp, q1, q2) {
  _hq.setFromAxisAngle(handAxis(side, 0, 0, 1, _ha), -a1);
  _hq2.setFromAxisAngle(handAxis(side, 1, 0, 0, _ha), sp);
  q1.multiplyQuaternions(_hq2, _hq);
  q2.setFromAxisAngle(handAxis(side, 0, 0, 1, _ha), -a2);
}

// wrap: radius of a grip the fingers close round (overrides curl, which then
// scales how firmly: 1 = fully closed on it). opts (for a fore-end lying in the
// palm): cy and cup (see wrapAngles), tilt: the slope of the cylinder across the
// hand (dy/dz: a fore-end runs from the heel of the hand to the index's root),
// thumbAlong: the thumb lies along the cylinder's near side, pointing forward.
export function poseHand(pose, side, curl = 0.3, index = curl, thumb = curl, spread = 0, wrap = 0, { cy = -0.083, cup = 0, tilt = 0, thumbAlong = false } = {}) {
  const fb = FINGER_BONES[side < 0 ? -1 : 1];
  for (const name of ['index', 'middle', 'ring', 'pinky']) {
    const c = name === 'index' ? index : curl;
    // Little and ring fingers close a touch more than the index in a grip.
    const k = name === 'pinky' ? 1.06 : name === 'ring' ? 1.03 : 1;
    let [a1, a2] = FIST[name];
    let cc = Math.min(1, c * k);
    if (wrap > 0 && !(name === 'index' && index < curl - 0.1)) {
      [a1, a2] = wrapAngles(name, wrap, cy + HAND_JOINTS[name][0][2] * tilt, cup);
      cc = Math.min(1, c);
    }
    const [b1, b2] = fb[name];
    const sp = SPREAD[name] * (spread + 0.3 * (1 - cc));
    fingerRotations(side, cc * a1, cc * a2, sp, pose.q[b1], pose.q[b2]);
    // (Kept for closing the fingers on a gun's real outline: soldierFP.js.)
    (pose.fingers ||= {})[name] = [cc * a1, cc * a2, sp];
  }
  // Thumb: reaches its tip by a small two-bone solve to a point over the
  // fingers' middle joints on the far side of the grip (or of the fist).
  const [t1, t2] = fb.thumb;
  const T = wrap > 0 ? _ht.set(-(PALM_X + 2 * wrap) - 0.004, -0.072, -0.012) : _ht.set(-0.045, -0.104, -0.012);
  // Along the cylinder: on its flank toward the wrist, 7 cm ahead of the hand.
  if (wrap > 0 && thumbAlong) T.set(-(PALM_X + wrap - cup) - 0.2 * wrap, cy - 0.07 * tilt + wrap + 0.008, -0.07);
  thumbIK(T, _tq1, _tq2);
  const k = Math.min(1, thumb / (wrap > 0 ? 0.8 : 1));
  _hq.identity().slerp(_tq1, k);
  _hq2.identity().slerp(_tq2, k);
  mirrorQ(side, _hq, pose.q[t1]);
  mirrorQ(side, _hq2, pose.q[t2]);
}
// Two-bone solve of the right thumb in the hand's frame: local rotations of
// its two bones that put the tip at T, the base knuckle bulging out.
const _ht = new THREE.Vector3(),
  _tq1 = new THREE.Quaternion(),
  _tq2 = new THREE.Quaternion();
const TH = HAND_JOINTS.thumb.map((p) => new THREE.Vector3(...p));
const TH_L1 = TH[0].distanceTo(TH[1]),
  TH_L2 = TH[1].distanceTo(TH[3]);
const TH_POLE = new THREE.Vector3(0.45, 0.2, -0.87);
function thumbIK(T, q1, q2) {
  const A = TH[0];
  const d = _hv.copy(T).sub(A);
  let dist = d.length();
  dist = Math.min(TH_L1 + TH_L2 - 1e-4, Math.max(Math.abs(TH_L1 - TH_L2) + 1e-4, dist));
  d.normalize();
  const along = (TH_L1 * TH_L1 - TH_L2 * TH_L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, TH_L1 * TH_L1 - along * along));
  const perp = _hv2.copy(TH_POLE).addScaledVector(d, -TH_POLE.dot(d)).normalize();
  const E = _hv3.copy(A).addScaledVector(d, along).addScaledVector(perp, h);
  q1.setFromUnitVectors(_hv4.copy(TH[1]).sub(A).normalize(), _hv2.copy(E).sub(A).normalize());
  // Second bone: its rest direction carried by the first, onto E -> T.
  const tip = A.clone().addScaledVector(d, dist);
  const r0 = _hv4.copy(TH[3]).sub(TH[1]).applyQuaternion(q1).normalize();
  _hq3.setFromUnitVectors(r0, _hv2.copy(tip).sub(E).normalize());
  // Local to the first bone: q1^-1 * (qd * q1).
  q2.copy(q1).invert().multiply(_hq3).multiply(q1);
}
const _hv = new THREE.Vector3(),
  _hv2 = new THREE.Vector3(),
  _hv3 = new THREE.Vector3(),
  _hv4 = new THREE.Vector3(),
  _hq3 = new THREE.Quaternion();
// A rotation worked out for the right hand, for either hand.
function mirrorQ(side, q, out) {
  return side < 0 ? out.set(q.x, -q.y, -q.z, q.w) : out.copy(q);
}

// ---------------------------------------------------------------------------
// A pose: local rotation per bone plus the hips position in model space.
export class Pose {
  constructor() {
    this.q = BONE_NAMES.map(() => new THREE.Quaternion());
    this.hips = BIND[0].clone();
  }
  reset() {
    for (const q of this.q) q.identity();
    this.hips.copy(BIND[0]);
    return this;
  }
  copy(p) {
    for (let i = 0; i < BONE_COUNT; i++) this.q[i].copy(p.q[i]);
    this.hips.copy(p.hips);
    return this;
  }
  // this = a blended toward b by w (per-bone slerp, linear hips).
  blend(a, b, w) {
    if (w <= 0) return this.copy(a);
    if (w >= 1) return this.copy(b);
    for (let i = 0; i < BONE_COUNT; i++) this.q[i].slerpQuaternions(a.q[i], b.q[i], w);
    this.hips.lerpVectors(a.hips, b.hips, w);
    return this;
  }
}

// Model-space transforms of every bone for a pose.
export class ModelPose {
  constructor() {
    this.q = BONE_NAMES.map(() => new THREE.Quaternion());
    this.p = BONE_NAMES.map(() => new THREE.Vector3());
  }
  fk(pose) {
    const q = this.q,
      p = this.p;
    for (let i = 0; i < BONE_COUNT; i++) {
      const par = PARENT[i];
      if (par < 0) {
        q[i].copy(pose.q[i]);
        p[i].copy(pose.hips);
      } else {
        q[i].multiplyQuaternions(q[par], pose.q[i]);
        p[i].copy(OFFSET[i]).applyQuaternion(q[par]).add(p[par]);
      }
    }
    return this;
  }
  // Point given in a bone's bind-pose model coordinates -> current model space.
  point(bone, bindPoint, out) {
    return out.copy(bindPoint).sub(BIND[bone]).applyQuaternion(this.q[bone]).add(this.p[bone]);
  }
}

// Set a bone's local rotation so that its model-space rotation becomes `world`.
const _qi = new THREE.Quaternion();
export function setModelRotation(pose, mp, bone, world) {
  const par = PARENT[bone];
  if (par < 0) pose.q[bone].copy(world);
  else pose.q[bone].copy(_qi.copy(mp.q[par]).invert()).multiply(world);
}

// ---------------------------------------------------------------------------
// Rotation that takes the frame (d0, n0) to (d1, n1): direction and a reference
// normal (orthogonalized against the direction).
const _m0 = new THREE.Matrix4(),
  _m1 = new THREE.Matrix4();
const _a = new THREE.Vector3(),
  _b = new THREE.Vector3(),
  _c = new THREE.Vector3(),
  _d = new THREE.Vector3(),
  _e = new THREE.Vector3(),
  _f = new THREE.Vector3();
export function frameRotation(d0, n0, d1, n1, out) {
  _a.copy(d0).normalize();
  _b.copy(n0).addScaledVector(_a, -_a.dot(n0)).normalize();
  _c.crossVectors(_a, _b);
  _m0.makeBasis(_a, _b, _c);
  _d.copy(d1).normalize();
  _e.copy(n1).addScaledVector(_d, -_d.dot(n1));
  if (_e.lengthSq() < 1e-10) _e.copy(Math.abs(_d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).addScaledVector(_d, -_d.y);
  _e.normalize();
  _f.crossVectors(_d, _e);
  _m1.makeBasis(_d, _e, _f);
  _m0.transpose();
  _m1.multiply(_m0);
  return out.setFromRotationMatrix(_m1);
}

// Quaternion from three orthonormal axes (columns).
export function quatFromAxes(x, y, z, out) {
  _m0.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m0);
}

// ---------------------------------------------------------------------------
// Two-bone IK (thigh-shin-foot, upperArm-forearm-hand). Moves the end joint to
// `target` (model space), bending toward `pole` (a direction). The chain's own
// rest bend is precomputed so the joint bends the natural way. Returns the
// distance by which the target could not be reached.
const CHAINS = {};
function chainInfo(a, b, c, bindPole) {
  const key = `${a}`;
  if (CHAINS[key]) return CHAINS[key];
  const A = BIND[a],
    E = BIND[b],
    T = BIND[c];
  const u = T.clone().sub(A).normalize();
  const perp = bindPole.clone().addScaledVector(u, -u.dot(bindPole)).normalize();
  const n = new THREE.Vector3().crossVectors(u, perp).normalize();
  const info = {
    l1: E.distanceTo(A),
    l2: T.distanceTo(E),
    d1: E.clone().sub(A).normalize(),
    d2: T.clone().sub(E).normalize(),
    n,
  };
  CHAINS[key] = info;
  return info;
}
export const LEG_POLE = new THREE.Vector3(0, 0, -1);
export const ARM_POLE = new THREE.Vector3(0, 0, 1);
for (const [a, b, c, p] of [
  [B.thighL, B.shinL, B.footL, LEG_POLE],
  [B.thighR, B.shinR, B.footR, LEG_POLE],
  [B.upperArmL, B.forearmL, B.handL, ARM_POLE],
  [B.upperArmR, B.forearmR, B.handR, ARM_POLE],
])
  chainInfo(a, b, c, p);

const _u = new THREE.Vector3(),
  _perp = new THREE.Vector3(),
  _n = new THREE.Vector3(),
  _E = new THREE.Vector3(),
  _T = new THREE.Vector3(),
  _dd = new THREE.Vector3(),
  _q1 = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion();
export function solveTwoBone(pose, mp, a, b, target, pole, maxStretch = 0.999) {
  const info = CHAINS[`${a}`];
  const A = mp.p[a];
  _u.copy(target).sub(A);
  let dist = _u.length();
  if (dist < 1e-6) {
    _u.set(0, -1, 0);
    dist = 1e-6;
  } else _u.divideScalar(dist);
  const { l1, l2 } = info;
  const maxD = (l1 + l2) * maxStretch;
  const minD = Math.abs(l1 - l2) + 0.01;
  const miss = Math.max(0, dist - maxD);
  dist = Math.min(maxD, Math.max(minD, dist));
  _perp.copy(pole).addScaledVector(_u, -_u.dot(pole));
  if (_perp.lengthSq() < 1e-8) _perp.set(0, 0, -1).addScaledVector(_u, -_u.z);
  _perp.normalize();
  const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  _E.copy(A).addScaledVector(_u, along).addScaledVector(_perp, h);
  _T.copy(A).addScaledVector(_u, dist);
  _n.crossVectors(_u, _perp).normalize();
  frameRotation(info.d1, info.n, _dd.copy(_E).sub(A), _n, _q1);
  frameRotation(info.d2, info.n, _dd.copy(_T).sub(_E), _n, _q2);
  setModelRotation(pose, mp, a, _q1);
  pose.q[b].copy(_q1).invert().multiply(_q2);
  // Keep the model pose in step for the bones we changed (and the end joint).
  mp.q[a].copy(_q1);
  mp.q[b].copy(_q2);
  mp.p[b].copy(_E);
  mp.p[b + 1].copy(_T);
  mp.q[b + 1].multiplyQuaternions(_q2, pose.q[b + 1]);
  return miss;
}
