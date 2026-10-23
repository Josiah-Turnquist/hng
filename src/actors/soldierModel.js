// Procedural infantryman for 1944: US, German and Soviet uniforms and kit built
// from simple shapes at real scale, skinned to a 19-bone skeleton and posed in
// code every frame (gait with planted feet, stances, aiming, actions, ragdoll).
//
//   const m = new SoldierModel('GE', textures, { seed: 7, lod: 0 });
//   scene.add(m.root);                     // root is at the feet, facing -Z at yaw 0
//   m.setWeapon(buildGun('kar98k', mats), 'rifle');
//   m.setGround((x, z) => hf.getHeight(x, z));
//   m.root.position.set(x, y, z);           // each frame: position the feet...
//   m.update(dt, state);                    // ...then pose (also sets root yaw)
//   m.muzzleWorld, m.aimDir                 // where the bore points
//   m.getHitboxes(list); raycastHitboxes(list, ox, oy, oz, dx, dy, dz, maxDist)
//
// Draw calls: 3 skinned meshes at full detail (cloth, kit, skin), 1 at LOD 1.
// Outfit geometry is shared between soldiers of the same faction/variant.
import * as THREE from 'three';
import { B, BONE_NAMES, PARENT, BIND, OFFSET, EYE_R } from './soldierRig.js';
import { buildOutfit, buildPerson, personParams } from './soldierKit.js';
import { SkinBuilder } from './soldierGeo.js';
import { SoldierAnimator, clamp } from './soldierAnim.js';
import { SoldierArms, weaponInfo, Xf } from './soldierArms.js';
import { Ragdoll } from './soldierRagdoll.js';
import { fillHitboxes, raycastHitboxes, rayCapsule, HITBOX_DEFS } from './soldierHitbox.js';

export { raycastHitboxes, rayCapsule, HITBOX_DEFS };
export const HITBOX_PARTS = HITBOX_DEFS.map((d) => d[0]);

const MAT_CACHE = new WeakMap();
const NO_TEX = {};
function materialsFor(textures) {
  const key = textures || NO_TEX;
  let m = MAT_CACHE.get(key);
  if (m) return m;
  const mk = (preset) => {
    let mat;
    if (textures && textures.standard) mat = textures.standard(preset, { size: 512 });
    else mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    mat.vertexColors = true;
    // The neutral textures average ~0.5, so vertex colors carry the real colors.
    if (mat.map) mat.color.setScalar(2);
    return mat;
  };
  const cloth = mk('soldierCloth');
  const gear = mk('soldierGear');
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
  cloth.name = 'soldierCloth';
  gear.name = 'soldierGear';
  skin.name = 'soldierSkin';
  m = { cloth, gear, skin };
  MAT_CACHE.set(key, m);
  return m;
}

// Outfit geometry is shared by every soldier of the same faction/variant/LOD.
const OUTFIT_CACHE = new Map();
function outfitGeometry(faction, variant, lod) {
  const key = `${faction}|${variant}|${lod}`;
  let g = OUTFIT_CACHE.get(key);
  if (!g) {
    const { cloth, gear } = buildOutfit(faction, variant, lod);
    g = lod ? { merged: cloth.append(gear) } : { cloth: cloth.toGeometry(), gear: gear.toGeometry() };
    OUTFIT_CACHE.set(key, g);
  }
  return g;
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VARIANTS = { US: 2, GE: 2, SU: 4 };
const KINDS = new Set(['rifle', 'smg', 'lmg', 'pistol', 'launcher', 'grenade', 'none']);
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _q = new THREE.Quaternion(),
  _m3 = new THREE.Matrix3();

export class SoldierModel {
  constructor(faction = 'US', textures = null, { seed = 1, lod = 0, variant } = {}) {
    this.faction = faction in VARIANTS ? faction : 'US';
    this.seed = seed;
    const rng = mulberry(seed * 9973 + 17);
    this.variant = variant ?? Math.floor(rng() * VARIANTS[this.faction]);
    this.person = personParams(this.faction, rng);
    this.mats = materialsFor(textures);

    this.root = new THREE.Object3D();
    this.root.name = `soldier-${this.faction}`;
    this.bones = BONE_NAMES.map((n, i) => {
      const b = new THREE.Bone();
      b.name = n;
      b.position.copy(OFFSET[i]);
      return b;
    });
    for (let i = 1; i < this.bones.length; i++) this.bones[PARENT[i]].add(this.bones[i]);
    this.root.add(this.bones[0]);
    const inverses = BIND.map((p) => new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    this.skeleton = new THREE.Skeleton(this.bones, inverses);
    this.meshes = [[], []];
    this.lod = -1;

    this.anim = new SoldierAnimator();
    this.arms = new SoldierArms(this.anim);
    this.ragdoll = new Ragdoll();
    this.pose = this.anim.pose;
    this.mp = this.anim.mp;
    this.mp.fk(this.pose);

    this.gun = null;
    this.weaponKind = 'none';
    this.muzzleWorld = new THREE.Vector3();
    this.aimDir = new THREE.Vector3(0, 0, -1);
    this.eyeWorld = new THREE.Vector3();
    this.grenadeReleased = false; // true from the release moment of a throw
    this._groundFn = null;
    this._gunXf = new Xf();
    this._hitboxes = [];
    this._groundModel = (x, z) => {
      if (!this._groundFn) return 0;
      const e = this.root.matrixWorld.elements;
      return this._groundFn(e[0] * x + e[8] * z + e[12], e[2] * x + e[10] * z + e[14]) - e[13];
    };
    this.setLod(lod);
    this.applyPose();
  }

  _mesh(geo, mat) {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.bind(this.skeleton, new THREE.Matrix4());
    m.castShadow = true;
    m.receiveShadow = true;
    // Generous fixed bounds (covers prone, sitting and the ragdoll).
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), 1.7);
    this.root.add(m);
    return m;
  }

  // 0 = full detail (cloth, kit and skin meshes), 1 = distant (one mesh).
  setLod(lod) {
    lod = lod ? 1 : 0;
    if (lod === this.lod) return;
    this.lod = lod;
    if (!this.meshes[lod].length) {
      const og = outfitGeometry(this.faction, this.variant, lod);
      if (lod === 0) {
        this._skinGeo = buildPerson(this.person, 0).toGeometry();
        this.meshes[0].push(this._mesh(og.cloth, this.mats.cloth), this._mesh(og.gear, this.mats.gear), this._mesh(this._skinGeo, this.mats.skin));
      } else {
        const b = new SkinBuilder(0.5).append(og.merged).append(buildPerson(this.person, 1));
        this._lodGeo = b.toGeometry();
        this.meshes[1].push(this._mesh(this._lodGeo, this.mats.cloth));
      }
    }
    for (let l = 0; l < 2; l++) for (const m of this.meshes[l]) m.visible = l === lod;
  }

  // Terrain height function groundAt(x, z) -> y (world). Used for foot placement
  // and for the ragdoll to settle on.
  setGround(fn) {
    this._groundFn = fn || null;
  }

  // Put a gun model (from buildGun) in the hands, or null. kind: rifle | smg |
  // lmg | pistol | launcher | grenade | none.
  setWeapon(gun, kind = 'rifle') {
    if (this.gun && this.gun.root?.parent) this.gun.root.parent.remove(this.gun.root);
    if (this.gun?.isObject3D && this.gun.parent) this.gun.parent.remove(this.gun);
    if (!KINDS.has(kind)) kind = 'rifle';
    const obj = gun ? (gun.isObject3D ? gun : gun.root) : null;
    this.gun = obj;
    this.weaponKind = obj ? kind : 'none';
    this.arms.setWeapon(obj && kind !== 'none' ? weaponInfo(obj, kind) : null);
    if (obj) {
      obj.matrixAutoUpdate = true;
      this.root.add(obj);
    }
  }

  // Pose the soldier for this frame. Position the root (feet) first; the root's
  // yaw is set from s.yaw. State fields (all optional):
  //   stance 0 stand / 1 crouch / 2 prone, stanceBlend (continuous 0..2, wins over stance),
  //   localVelX, localVelZ (m/s relative to the facing, -Z forward; drive the gait),
  //   sprinting, onGround, yaw (body facing, rad), aimPitch (rad, + up),
  //   aimYawOffset (rad, upper body twist, + = to the left like yaw), aiming (shouldered),
  //   lean (-1 left .. 1 right), recoil (0..1 kick),
  //   action null | 'reload' | 'bolt' | 'throw' | 'bandage' | 'use', actionT (0..1),
  //   alive, deathT (s since death), hitDir {x, z} (world direction the killing shot
  //   travelled; the body is pushed along it), seated (the root is then the seat point
  //   under the buttocks; feet rest 0.42 m below it).
  update(dt, s = {}) {
    const root = this.root;
    const alive = s.alive !== false;
    if (alive || !this.ragdoll.active) {
      if (s.yaw !== undefined) root.rotation.y = s.yaw;
    }
    root.updateWorldMatrix(true, false);
    let holder = 'right';
    if (!alive) {
      if (!this.ragdoll.active) this._startRagdoll(s);
      const steps = this._pending || 0;
      this._pending = 0;
      if (steps > 0) for (let i = 0; i < steps; i++) this.ragdoll.update(1 / 60, this._groundModel, 1);
      this.ragdoll.update(dt, this._groundModel);
      this.ragdoll.toPose(this.pose, this.mp);
      holder = 'drop';
      this.grenadeReleased = false;
      // Keep the culling spheres around the body.
      const c = this.ragdoll.center(_v);
      for (const l of this.meshes) for (const m of l) m.boundingSphere.center.set(c.x, c.y + 0.2, c.z);
    } else {
      if (this.ragdoll.active) {
        this.ragdoll.active = false;
        this.anim.reset();
        for (const l of this.meshes) for (const m of l) m.boundingSphere.center.set(0, 0.8, 0);
      }
      this.anim.groundOffset = this._groundFn && !s.seated ? this._groundModel : null;
      const pose = this.anim.body(dt, s);
      this.arms.update(dt, s, pose);
      this.anim.head(pose, this.arms.weld > 0 ? this.arms.sight : null, this.arms.weld);
      holder = this.arms.holderOut || 'right';
      this.grenadeReleased = this.arms.released;
      this._lastVel = s;
    }
    this.applyPose();
    this._placeGun(holder);
    this._outputs();
  }

  _startRagdoll(s) {
    // Body velocity in model space (local velocities are relative to the facing).
    const vel = _v.set(s.localVelX || 0, 0, s.localVelZ || 0);
    let push = null;
    if (!s.hitDir) {
      // No hit direction: fall backward or forward, a little to the side.
      const r = mulberry(this.seed * 31 + ((this._deaths = (this._deaths || 0) + 1) * 7))();
      const a = (r - 0.5) * 1.4 + (r < 0.6 ? 0 : Math.PI);
      push = _v2.set(Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8);
    } else if (s.hitDir.x || s.hitDir.z) {
      // World direction -> model space.
      const yaw = this.root.rotation.y;
      const c = Math.cos(-yaw),
        sn = Math.sin(-yaw);
      const x = s.hitDir.x,
        z = s.hitDir.z;
      const l = Math.hypot(x, z) || 1;
      push = _v2.set((x * c + z * sn) / l, 0, (-x * sn + z * c) / l);
    }
    const info = this.arms.info;
    let gunXf = null,
      pts = null;
    if (this.gun && info) {
      gunXf = this.arms.G;
      const a = info.anchors;
      pts = [a.shoulder ? a.shoulder.clone() : a.gripR.clone().add(new THREE.Vector3(0, 0, 0.1)), a.muzzle.clone(), a.gripR.clone().add(new THREE.Vector3(0, 0.07, 0))];
    }
    this.ragdoll.start(this.mp, vel, push, gunXf, pts);
    // A soldier who died before we started animating him: settle at once.
    const behind = clamp(s.deathT || 0, 0, 4);
    this._pending = Math.floor(behind * 60);
  }

  _placeGun(holder) {
    const gun = this.gun;
    if (!gun) return;
    const info = this.arms.info;
    if (!info) {
      gun.visible = false; // kind 'none': not in the hands
      return;
    }
    let parent = this.root;
    const g = this._gunXf;
    if (holder === 'drop') {
      if (!this.ragdoll.gunXf(g)) g.copy(this.arms.G);
      gun.visible = this.weaponKind !== 'grenade';
    } else {
      gun.visible = this.arms.gunVisible;
      if (holder === 'right' && info) {
        parent = this.bones[B.handR];
        g.q.copy(info.qHG);
        g.p.copy(info.tHG);
      } else if (holder === 'left' && info?.qLG) {
        parent = this.bones[B.handL];
        g.q.copy(info.qLG);
        g.p.copy(this.arms.tLGcur || info.tLG);
      } else g.copy(this.arms.G);
    }
    if (gun.parent !== parent) parent.add(gun);
    gun.quaternion.copy(g.q);
    gun.position.copy(g.p);
  }

  _outputs() {
    const mw = this.root.matrixWorld;
    const info = this.arms.info;
    const ragdoll = this.ragdoll.active;
    if (this.gun && info) {
      const G = ragdoll ? this._gunXf : this.arms.G;
      G.point(info.anchors.muzzle, this.muzzleWorld).applyMatrix4(mw);
      this.aimDir.set(0, 0, -1).applyQuaternion(G.q).transformDirection(mw);
    } else {
      this.mp.point(B.head, EYE_R, this.muzzleWorld).applyMatrix4(mw);
      this.aimDir.set(0, 0, -1).applyQuaternion(this.mp.q[B.head]).transformDirection(mw);
    }
    this.mp.point(B.head, EYE_R, this.eyeWorld).applyMatrix4(mw);
  }

  // Write the current pose to the bones.
  applyPose() {
    const pose = this.pose;
    for (let i = 0; i < this.bones.length; i++) this.bones[i].quaternion.copy(pose.q[i]);
    this.bones[0].position.copy(pose.hips);
  }

  // World-space hit capsules for the current pose (call after update()).
  getHitboxes(out = []) {
    this.root.updateWorldMatrix(true, false);
    return fillHitboxes(this.mp, this.root.matrixWorld, out);
  }

  // World position of a hand (side: 1 right, -1 left), e.g. to spawn a thrown grenade.
  getHandWorld(side, out = new THREE.Vector3()) {
    const h = side < 0 ? B.handL : B.handR;
    return this.mp.point(h, _v.copy(BIND[h]).add(_v2.set(side * -0.03, -0.08, 0)), out).applyMatrix4(this.root.matrixWorld);
  }

  dispose() {
    this._skinGeo?.dispose();
    this._lodGeo?.dispose();
    this.root.removeFromParent();
  }
}
