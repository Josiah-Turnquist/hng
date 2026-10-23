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
};
export const BONE_NAMES = Object.keys(B);
export const BONE_COUNT = BONE_NAMES.length;
export const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 2, 9, 10, 11, 0, 13, 14, 0, 16, 17];

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
].map((p) => new THREE.Vector3(...p));

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
