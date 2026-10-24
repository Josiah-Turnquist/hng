// First-person arms: the player's own sleeves and hands, cut from his outfit
// and person (so the cuffs, rolled sleeves, patches and skin match his soldier)
// and skinned to a flat copy of the soldier skeleton whose bones are placed in
// the view directly: shoulder to elbow to wrist by two-bone IK, the hand from
// the gun's grip anchors exactly as the third-person soldier holds it, the
// fingers closed round the grip.
//
//   const arms = new FirstPersonArms(textures, { faction, cls, seed, role });
//   scene.add(arms.root);
//   arms.setWeapon(gun, kind);   // a buildGun() result
//   arms.place(side, shoulder, gunXf | null, { point, mode, pole });
import * as THREE from 'three';
import { B, BIND, BONE_NAMES, BONE_COUNT, OFFSET, LEN, FINGER_BONES, Pose, frameRotation, poseHand } from './soldierRig.js';
import { SkinBuilder } from './soldierGeo.js';
import { soldierMaterial } from './soldierMaterials.js';
import { buildOutfit, buildPerson, personParams, variantCount, mulberry } from './soldierKit.js';
import './soldierKitUS.js';
import './soldierKitGE.js';
import './soldierKitSU.js';
import { weaponInfo, handFromGun, Xf } from './soldierArms.js';

const ARM = {
  [-1]: new Set([B.upperArmL, B.forearmL, B.handL, ...Object.values(FINGER_BONES[-1]).flat()]),
  [1]: new Set([B.upperArmR, B.forearmR, B.handR, ...Object.values(FINGER_BONES[1]).flat()]),
};
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _q = new THREE.Quaternion();

// Copy the triangles of a builder that belong to the arms (by their dominant
// bone); anything else they lean on (shoulder cap: clavicle, chest) is moved
// onto the upper arm of that side.
function cutArms(src, dst) {
  const map = new Map();
  const dom = (i) => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (src.sw[i * 4 + k] > src.sw[i * 4 + best]) best = k;
    return src.si[i * 4 + best];
  };
  const sideOf = (bone) => (ARM[1].has(bone) ? 1 : ARM[-1].has(bone) ? -1 : 0);
  const add = (i, side) => {
    let j = map.get(i);
    if (j !== undefined) return j;
    j = dst.count;
    dst.pos.push(src.pos[i * 3], src.pos[i * 3 + 1], src.pos[i * 3 + 2]);
    dst.nor.push(src.nor[i * 3], src.nor[i * 3 + 1], src.nor[i * 3 + 2]);
    dst.uv.push(src.uv[i * 2], src.uv[i * 2 + 1]);
    dst.col.push(src.col[i * 3], src.col[i * 3 + 1], src.col[i * 3 + 2]);
    dst.mat.push(src.mat[i * 2], src.mat[i * 2 + 1]);
    dst.prim.push(0);
    for (let k = 0; k < 4; k++) {
      const b = src.si[i * 4 + k];
      dst.si.push(ARM[side].has(b) ? b : side > 0 ? B.upperArmR : B.upperArmL);
      dst.sw.push(src.sw[i * 4 + k]);
    }
    map.set(i, j);
    return j;
  };
  for (let t = 0; t < src.idx.length; t += 3) {
    const a = src.idx[t],
      b = src.idx[t + 1],
      c = src.idx[t + 2];
    const sa = sideOf(dom(a)),
      sb = sideOf(dom(b)),
      sc = sideOf(dom(c));
    if (!sa || sa !== sb || sa !== sc) continue;
    dst.idx.push(add(a, sa), add(b, sa), add(c, sa));
  }
  return dst;
}

export class FirstPersonArms {
  constructor(textures, { faction = 'US', cls = 'infantry', seed = 1, role = 'rifle', variant } = {}) {
    this.root = new THREE.Group();
    this.root.name = 'fp-arms';
    this.bones = BONE_NAMES.map((n) => {
      const b = new THREE.Bone();
      b.name = n;
      this.root.add(b);
      return b;
    });
    this.skeleton = new THREE.Skeleton(
      this.bones,
      BIND.map((p) => new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z)),
    );
    this.material = soldierMaterial(textures, { viewmodel: true });
    this.pose = new Pose();
    this.info = null;
    this.mesh = null;
    this.setOutfit({ faction, cls, seed, role, variant });
  }

  // Rebuild the arms for a soldier (the same seed rules as SoldierModel).
  setOutfit({ faction = 'US', cls = 'infantry', seed = 1, role = 'rifle', variant } = {}) {
    const rng = mulberry(seed * 9973 + 17);
    const v0 = Math.floor(rng() * 1000);
    const person = personParams(faction, rng);
    const nv = variantCount(faction, cls);
    const { b, info } = buildOutfit(faction, cls, (variant ?? v0) % nv, 0, role);
    const arms = cutArms(b, new SkinBuilder(1));
    cutArms(buildPerson(person, 0, info), arms);
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.root.remove(this.mesh);
    }
    const geo = arms.toGeometry();
    const m = new THREE.SkinnedMesh(geo, this.material);
    m.bind(this.skeleton, new THREE.Matrix4());
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    this.mesh = m;
    this.root.add(m);
    this.key = `${faction}|${cls}|${seed}|${role}|${variant}`;
  }

  setWeapon(gun, kind) {
    this.info = gun ? weaponInfo(gun, kind) : null;
  }

  // Place one arm. side 1 right, -1 left; shoulder: world position of the
  // shoulder joint; G: the gun's world transform (Xf); target: { mode: 'grip' |
  // 'point' | 'hidden', point (world, for 'point'), pole (world direction the
  // elbow bends toward), curl: [fingers, index, thumb] }.
  place(side, shoulder, G, target) {
    const info = this.info;
    const hb = side > 0 ? B.handR : B.handL;
    const ua = side > 0 ? B.upperArmR : B.upperArmL;
    const H = (this._h ||= { [1]: new Xf(), [-1]: new Xf() })[side];
    if (info && G && target.mode !== 'point' && (side > 0 || info.qLG)) {
      handFromGun(G, side > 0 ? info.qHG : info.qLG, side > 0 ? info.tHG : info.tLG, H);
    } else if (info && G) {
      // Work with the fingertips at a point (bolt, magazine, clip), the hand
      // turned as on its grip.
      if (side > 0 || info.qLG) handFromGun(G, side > 0 ? info.qHG : info.qLG, side > 0 ? info.tHG : info.tLG, H);
      else H.q.copy(G.q);
      const tip = _v.set(side * -0.02, -0.11, -0.025).applyQuaternion(H.q);
      H.p.copy(target.point).sub(tip);
    }
    // Two-bone IK: elbow on the side of the pole.
    const L1 = LEN.upperArm,
      L2 = LEN.forearm;
    const S = shoulder,
      W = H.p;
    const d = _v.copy(W).sub(S);
    let dist = d.length();
    dist = Math.min(L1 + L2 - 1e-4, Math.max(Math.abs(L1 - L2) + 1e-4, dist));
    d.normalize();
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const p = _v2.copy(target.pole).addScaledVector(d, -target.pole.dot(d)).normalize();
    const E = (this._e ||= new THREE.Vector3()).copy(S).addScaledVector(d, a).addScaledVector(p, h);
    // If the hand is out of reach, it stays on the grip and the arm stretches toward it.
    const set = (bone, pos, q) => {
      this.bones[bone].position.copy(pos);
      this.bones[bone].quaternion.copy(q);
    };
    // Upper arm: the bind segment onto shoulder -> elbow, the forearm's side as the bend.
    const qU = new THREE.Quaternion();
    const d0 = new THREE.Vector3().copy(BIND[ua + 1]).sub(BIND[ua]),
      fwd = new THREE.Vector3(0, 0, -1);
    frameRotation(d0, fwd, new THREE.Vector3().copy(E).sub(S), new THREE.Vector3().copy(W).sub(E), qU);
    set(ua, S, qU);
    // Forearm: twisted with the hand (its thumb side).
    const qF = new THREE.Quaternion();
    d0.copy(BIND[ua + 2]).sub(BIND[ua + 1]);
    frameRotation(d0, fwd, new THREE.Vector3().copy(W).sub(E), new THREE.Vector3(0, 0, -1).applyQuaternion(H.q), qF);
    set(ua + 1, E, qF);
    set(hb, W, H.q);
    // Fingers.
    const c = target.curl || [1, 0.55, 0.8];
    const wrap = target.mode === 'grip' && info ? (side > 0 ? info.gripRadius : info.qLG && (info.meta.foregrip === 'vertical' || info.kind === 'pistol') ? 0.017 : info.foreRadius) : 0;
    poseHand(this.pose, side, c[0], c[1], c[2], 0, wrap);
    for (const name of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      const [b1, b2] = FINGER_BONES[side][name];
      const q1 = _q.copy(H.q).multiply(this.pose.q[b1]);
      const p1 = _v.copy(OFFSET[b1]).applyQuaternion(H.q).add(W);
      set(b1, p1, q1);
      const q2 = new THREE.Quaternion().copy(q1).multiply(this.pose.q[b2]);
      set(b2, _v2.copy(OFFSET[b2]).applyQuaternion(q1).add(p1), q2);
    }
    this.mesh.visible = true;
  }

  dispose() {
    this.mesh?.geometry.dispose();
    this.root.removeFromParent();
  }
}
export { BONE_COUNT };
