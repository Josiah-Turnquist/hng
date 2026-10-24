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
// Draw calls: 2 skinned meshes at full detail (the outfit, shared by every
// soldier with the same kit, and the person: face, neck, hands), 1 in the middle
// distance and 1 far away (outfit and person merged per soldier). Everything
// uses one material (soldierMaterials.js).
//
// Levels of detail (triangles, about): 0 = 16-20k, 1 = 3-4k, 2 = 0.7-1k.
import * as THREE from 'three';
import { B, BONE_NAMES, PARENT, BIND, OFFSET, EYE_R } from './soldierRig.js';
import { buildOutfit, buildPerson, personParams, variantCount, mulberry } from './soldierKit.js';
import './soldierKitUS.js';
import './soldierKitGE.js';
import './soldierKitSU.js';
import { SkinBuilder } from './soldierGeo.js';
import { soldierMaterial } from './soldierMaterials.js';
import { SoldierAnimator, clamp } from './soldierAnim.js';
import { SoldierArms, weaponInfo, Xf } from './soldierArms.js';
import { Ragdoll } from './soldierRagdoll.js';
import { fillHitboxes, raycastHitboxes, rayCapsule, HITBOX_DEFS } from './soldierHitbox.js';

export { raycastHitboxes, rayCapsule, HITBOX_DEFS };
export const HITBOX_PARTS = HITBOX_DEFS.map((d) => d[0]);
export const LODS = 3;

// Outfit builders are shared by every soldier with the same army, class,
// variant, weapon role and level of detail (the geometry for LOD 0, the builder
// for merging with each soldier's own person at LOD 1 and 2).
const OUTFIT_CACHE = new Map();
function outfitFor(faction, cls, variant, role, lod) {
  const key = `${faction}|${cls}|${variant}|${role}|${lod}`;
  let g = OUTFIT_CACHE.get(key);
  if (!g) {
    const { b, info } = buildOutfit(faction, cls, variant, lod, role);
    g = { b, info, geo: lod === 0 ? b.toGeometry() : null };
    OUTFIT_CACHE.set(key, g);
  }
  return g;
}
export function clearOutfitCache() {
  for (const g of OUTFIT_CACHE.values()) g.geo?.dispose();
  OUTFIT_CACHE.clear();
}

const FACTIONS = new Set(['US', 'GE', 'SU']);
const CLASSES = new Set(['infantry', 'recon', 'paratrooper', 'tanker']);
const ROLES = new Set(['rifle', 'smg', 'mg', 'at']);
const KINDS = new Set(['rifle', 'smg', 'lmg', 'pistol', 'launcher', 'grenade', 'none']);
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _inv = new THREE.Matrix4();

export class SoldierModel {
  // opts: seed (face, variant), lod (0 near, 1 middle, 2 far), cls (infantry |
  // recon | paratrooper | tanker), role (primary weapon: rifle | smg | mg | at,
  // picks the ammunition pouches), variant (outfit variant, else from the seed).
  constructor(faction = 'US', textures = null, { seed = 1, lod = 0, variant, cls = 'infantry', role = 'rifle' } = {}) {
    this.faction = FACTIONS.has(faction) ? faction : 'US';
    this.cls = CLASSES.has(cls) ? cls : 'infantry';
    this.role = ROLES.has(role) ? role : 'rifle';
    this.seed = seed;
    const rng = mulberry(seed * 9973 + 17);
    this.variant = (variant ?? Math.floor(rng() * 1000)) % variantCount(this.faction, this.cls);
    this.person = personParams(this.faction, rng);
    this.material = soldierMaterial(textures);
    this.mats = { cloth: this.material, gear: this.material, skin: this.material };

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
    this.meshes = [[], [], []];
    this._geos = [];
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

  // 0 = full detail (outfit and person meshes), 1 = middle distance, 2 = far
  // (one merged mesh each).
  setLod(lod) {
    lod = Math.max(0, Math.min(LODS - 1, lod | 0));
    if (lod === this.lod) return;
    this.lod = lod;
    if (!this.meshes[lod].length) {
      const og = outfitFor(this.faction, this.cls, this.variant, this.role, lod);
      this.outfitInfo = og.info;
      if (lod === 0) {
        const pg = buildPerson(this.person, 0, og.info).toGeometry();
        this._geos.push(pg);
        this.meshes[0].push(this._mesh(og.geo, this.material), this._mesh(pg, this.material));
      } else {
        const b = new SkinBuilder(1).append(og.b).append(buildPerson(this.person, lod, og.info));
        const geo = b.toGeometry();
        this._geos.push(geo);
        this.meshes[lod].push(this._mesh(geo, this.material));
      }
    }
    for (let l = 0; l < LODS; l++) for (const m of this.meshes[l]) m.visible = l === lod;
  }

  // Build every level of detail now (avoids a hitch when one is first needed).
  prepareLods() {
    const cur = this.lod;
    for (let l = 0; l < LODS; l++) this.setLod(l);
    this.setLod(cur);
  }

  // Triangles and draw calls of a level of detail (for budgets and the viewer).
  stats(lod = this.lod) {
    const ms = this.meshes[lod] || [];
    return { meshes: ms.length, triangles: ms.reduce((n, m) => n + m.geometry.index.count / 3, 0) };
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
  //   under the buttocks; feet rest 0.42 m below it), ride (a rider pose from a
  //   bicycle's or motorcycle's riderPose(seat, out): the root is then at ride.hip and
  //   the yaw is ride.yaw; hands and feet reach the grips, pedals or footboards).
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
      // Dead hands fall half open.
      this.arms.grip(1, 0.45, 0.35, 0.3);
      this.arms.grip(-1, 0.45, 0.35, 0.3);
      this.arms.applyFingers(this.pose, dt);
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
      let pose;
      if (s.ride) {
        // On a bicycle or motorcycle: world targets into model space.
        _inv.copy(root.matrixWorld).invert();
        pose = this.anim.ride(dt, s, s.ride, (v) => v.applyMatrix4(_inv), this._groundFn ? this._groundModel : null);
      } else pose = this.anim.body(dt, s);
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
    for (const g of this._geos) g.dispose();
    this._geos.length = 0;
    this.root.removeFromParent();
  }
}
