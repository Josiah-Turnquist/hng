// The first-person weapon: the gun model, the soldier's arms, and how they move.
//
// Aiming down the sights puts the eye exactly on the line through the gun's real
// rear and front sights (see sighting.js), so what you see through the sights is
// where the bullet goes. Recoil kicks the gun back and up from the shoulder; sway
// comes from breathing, heart rate, fatigue and stance; the gun lags behind fast
// turns depending on its weight. Reloads and bolt cycling are animated from the
// weapon's own moving parts (bolt, magazine, clip, feed cover) with the hands
// following them.
import * as THREE from 'three';
import { buildGun, MODELS } from './models/index.js';
import { makeGunMaterials } from './models/kit.js';
import { Sighting } from './sighting.js';
import { damp, clamp } from '../core/math.js';
import { FirstPersonArms } from '../actors/soldierFP.js';
import { WINDUP, SWING, FOLLOW } from '../game/throwing.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const Z_NEG = new THREE.Vector3(0, 0, -1);

// Simple damped spring on a number.
class Spring {
  constructor(k = 120, d = 14) {
    this.x = 0;
    this.v = 0;
    this.k = k;
    this.d = d;
  }
  step(dt, target = 0) {
    // Sub-step so the spring stays stable even when the frame rate drops.
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.k * (this.x - target) - this.d * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

// Carry when not aiming, in camera space (m, rad): hip = where the trigger sits,
// dir = [yaw left, pitch up, roll] of the gun. Low and to the right, pointing
// forward and a little up, so the barrel crosses the screen at about 30 degrees
// with the front sight just right of center near the horizon (as in Heroes &
// Generals). Guns held by a fore-end well ahead of the trigger are placed by
// the support hand instead (support), the shortest reach of the two arms.
const POSES = {
  rifle: { hip: [0.17, -0.12, -0.14], support: [0.172, -0.115, -0.501], dir: [0, 0.1, 0.06], sprint: [0.06, -0.24, -0.2] },
  smg: { hip: [0.14, -0.095, -0.225], dir: [0, 0.075, 0.06], sprint: [0.06, -0.22, -0.22] },
  lmg: { hip: [0.19, -0.16, -0.17], support: [0.172, -0.115, -0.501], dir: [0, 0.06, 0.06], sprint: [0.08, -0.3, -0.1] },
  pistol: { hip: [0.16, -0.1, -0.42], dir: [0, 0.05, 0.06], sprint: [0.12, -0.26, -0.22] },
  launcher: { hip: [0.17, -0.13, 0.04], dir: [0, 0.05, 0.06], sprint: [0.12, -0.2, 0.0] },
  grenade: { hip: [0.16, -0.2, -0.3], dir: [0.006, 0.008, 0.06], sprint: [0.12, -0.26, -0.22] },
};
// Throwing a grenade, in camera space: [x, y, z (m), pitch, yaw, roll (rad)].
const THROW = {
  back: [0.17, -0.03, -0.25, 0.9, -0.25, 0.45], // drawn back beside the head
  out: [0.1, 0.06, -0.42, -0.6, 0.05, 0.1], // letting go, ahead and a little up
  down: [0.02, -0.45, -0.38, -1.2, 0.1, -0.2], // follow-through, out of view
};
const smooth = (x) => x * x * (3 - 2 * x);

// Set p, q to the throwing pose a..b at u (a may be the carry pose { p, q }).
function throwPose(a, b, u, p, q) {
  const ap = a.p || _v3.fromArray(a),
    aq = a.q || _q3.setFromEuler(_e.set(a[3], a[4], a[5]));
  p.copy(ap).lerp(_v2.fromArray(b), u);
  q.copy(aq).slerp(_q2.setFromEuler(_e.set(b[3], b[4], b[5])), u);
}

// From the hip, shots leave the muzzle toward the center of view this far ahead
// (the shooter points the gun at what he looks at); aimed shots follow the bore.
export const HIP_CONVERGE = 25;

function poseKind(def) {
  switch (def.type) {
    case 'pistol':
    case 'revolver':
      return 'pistol';
    case 'smg':
      return 'smg';
    case 'lmg':
    case 'atRifle':
      return 'lmg';
    case 'launcher':
      return 'launcher';
    case 'grenade':
      return 'grenade';
    default:
      return 'rifle';
  }
}

export class ViewModel {
  constructor(textures, faction = 'US', envMap = null) {
    this.textures = textures;
    this.mats = makeGunMaterials(textures, { firstPerson: true });
    this.scene = new THREE.Scene();
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 0.4;
    this.camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.01, 30);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.fill = new THREE.HemisphereLight(0xb0c4de, 0x3a3428, 0.06);
    this.scene.add(this.fill);
    this.root = new THREE.Group(); // gun + arms, placed at the camera each frame
    this.scene.add(this.root);
    this.cache = new Map();
    this.gun = null;
    this.def = null;
    this.sighting = null;
    this.faction = faction;
    this._makeArms(faction);
    this._makeFlash();

    // Motion state.
    this.aim = 0; // 0 hip .. 1 aimed
    this.sprint = 0;
    this.swap = 1; // 0 = lowered out of view (weapon switching), 1 = up
    this.kickBack = new Spring(260, 22);
    this.kickPitch = new Spring(160, 16);
    this.kickYaw = new Spring(160, 16);
    this.kickRoll = new Spring(140, 14);
    this.lagYaw = new Spring(90, 13);
    this.lagPitch = new Spring(90, 13);
    this.bobT = 0;
    this.bob = 0;
    this.reloadTilt = 0;
    this.action = null; // { name, t, dur }
    this.blocked = 0;
    this.flashT = 0;
    this.localPose = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    this.muzzleWorld = new THREE.Vector3();
    this.boreWorld = new THREE.Vector3(0, 0, -1);
    this.hipAim = new THREE.Quaternion(); // hip shots: bore -> point of convergence
    this.ejectWorld = new THREE.Vector3();
    this.eyeOffset = new THREE.Vector3(); // ADS eye point relative to camera (zero when aimed)
    this.visible = true;
  }

  // The arms: the player's own sleeves and hands (soldierFP.js), skinned and
  // posed from the gun's grips. setOutfit matches them to his soldier.
  _makeArms(faction) {
    this.fpArms = new FirstPersonArms(this.textures, { faction });
    this.root.add(this.fpArms.root);
    this.fpArmsGun = null;
  }

  setOutfit({ faction = this.faction, cls = 'infantry', seed = 1, role = 'rifle', variant } = {}) {
    this.fpArms.setOutfit({ faction, cls, seed, role, variant });
  }

  _makeFlash() {
    // Muzzle flash: crossed glowing quads (very bright so the bloom picks them up).
    const tex = makeFlashTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(14, 9, 4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      q.rotation.z = (i * Math.PI) / 3;
      q.rotation.y = Math.PI / 2;
      g.add(q);
    }
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    g.add(front);
    g.visible = false;
    this.flash = g;
    this.root.add(g);
  }

  // Build (or reuse) the gun model for a weapon.
  setWeapon(def, atm) {
    if (this.def === def) return;
    if (this.gun) this.root.remove(this.gun.root);
    this.def = def;
    if (!def) {
      this.gun = null;
      return;
    }
    let entry = this.cache.get(def.id);
    if (!entry) {
      const modelId = MODELS[def.model] ? def.model : fallbackModel(def);
      const gun = buildGun(modelId, this.mats);
      gun.root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
          o.frustumCulled = false;
        }
      });
      const sighting = new Sighting(gun, def, atm);
      // Remember the rest transform of every animated part.
      const rest = {};
      for (const [n, p] of Object.entries(gun.parts)) rest[n] = { p: p.position.clone(), q: p.quaternion.clone() };
      entry = { gun, sighting, rest };
      this.cache.set(def.id, entry);
    }
    this.gun = entry.gun;
    this.sighting = entry.sighting;
    this.rest = entry.rest;
    this.root.add(this.gun.root);
    this.kind = poseKind(def);
    this.swap = 0;
  }

  setZero(index) {
    if (this.sighting) this.sighting.setRangeIndex(index);
  }

  // Start a named animation step (from Weapon events): reload steps, bolt cycling.
  playStep(name, duration) {
    this.action = { name, t: 0, dur: Math.max(0.01, duration) };
  }

  stopAction() {
    this.action = null;
  }

  // Called for every shot: physical recoil impulse (N s) drives the kick.
  shot(impulse, def, supported) {
    const k = supported ? 0.35 : 1;
    const r = def.recoil || { rise: 1, side: 0.3 };
    // Spring velocities (impulse in N s): a Kar 98k (about 13 N s) kicks the gun
    // ~5 cm back and ~3-4 degrees up, then the shooter brings it back down.
    this.kickBack.v += impulse * 0.12 * k;
    this.kickPitch.v += impulse * 0.1 * r.rise * k;
    this.kickYaw.v += (Math.random() - 0.5) * impulse * 0.06 * r.side * k;
    this.kickRoll.v += (Math.random() - 0.3) * impulse * 0.05 * k;
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = 0.12 + Math.min(0.35, impulse * 0.018);
    this.flash.scale.set(s, s, s * 1.8);
  }

  // Main per-frame update. cam = world camera (already positioned).
  // ctx: { aiming, sprinting, speed, onGround, stance, lookDelta: [dyaw, dpitch], sway: {yaw, pitch}, blockedDist, light }
  update(dt, cam, ctx) {
    if (!this.gun) return;
    const def = this.def;
    const poses = POSES[this.kind];
    const mass = def.mass;
    // Heavier guns come up to the eye more slowly.
    const adsSpeed = 1 / (0.16 + mass * 0.025);
    this.aim = damp(this.aim, ctx.aiming ? 1 : 0, adsSpeed * 2.2, dt);
    this.sprint = damp(this.sprint, ctx.sprinting ? 1 : 0, 7, dt);
    this.swap = Math.min(1, this.swap + dt * 3.2);
    this.blocked = damp(this.blocked, ctx.blocked ? 1 : 0, 10, dt);

    // Inertia: the gun lags behind quick turns.
    const lagK = 0.6 + mass * 0.05;
    this.lagYaw.v -= (ctx.lookDelta[0] || 0) * lagK * 2.2;
    this.lagPitch.v -= (ctx.lookDelta[1] || 0) * lagK * 2.2;
    this.lagYaw.step(dt);
    this.lagPitch.step(dt);
    this.lagYaw.x = clamp(this.lagYaw.x, -0.08, 0.08);
    this.lagPitch.x = clamp(this.lagPitch.x, -0.06, 0.06);

    this.kickBack.step(dt);
    this.kickPitch.step(dt);
    this.kickYaw.step(dt);
    this.kickRoll.step(dt);

    // Walking bob (smaller when aiming).
    const moving = ctx.onGround ? Math.min(1, ctx.speed / 3.5) : 0;
    this.bobT += dt * (ctx.sprinting ? 9.5 : 6.2 + ctx.speed * 0.9) * (moving > 0.05 ? 1 : 0);
    this.bob = damp(this.bob, moving * (ctx.sprinting ? 1.6 : 1), 6, dt);

    // --- hip pose -----------------------------------------------------------------
    const hip = this.localPose;
    const hd = poses.dir;
    const hipQ = _q.setFromEuler(_e.set(hd[1], hd[0], hd[2]));
    const hipPos = _v.fromArray(poses.hip);
    const gl = this.gun.anchors.gripL;
    if (poses.support && gl && gl.z < -0.25) hipPos.fromArray(poses.support).sub(_v2.copy(gl).applyQuaternion(hipQ));
    // Turn that carries hip shots from the bore to the point of convergence.
    _v2.copy(this.gun.anchors.muzzle || Z_NEG).applyQuaternion(hipQ).add(hipPos);
    this.hipAim.setFromUnitVectors(_v3.copy(Z_NEG).applyQuaternion(hipQ), _v2.set(-_v2.x, -_v2.y, -HIP_CONVERGE - _v2.z).normalize());

    // --- aimed pose (sights on the eye line) -----------------------------------------
    const s = this.sighting;
    const adsQ = new THREE.Quaternion().setFromUnitVectors(s.losDir, Z_NEG);
    const adsPos = s.eye.clone().applyQuaternion(adsQ).negate();

    // Blend hip -> aimed (not with the muzzle up against something: the gun is
    // pushed off the eye rather than into it).
    const a = this.aim * (1 - this.sprint) * (1 - this.blocked);
    hip.p.copy(hipPos).lerp(adsPos, a);
    hip.q.copy(hipQ).slerp(adsQ, a);

    // Sprint: gun lowered and turned across the body.
    if (this.sprint > 0.01) {
      const sp = poses.sprint;
      _v.set(sp[0], sp[1], sp[2]);
      hip.p.lerp(_v, this.sprint);
      _e.set(-0.55, 0.65, 0.35);
      _q2.setFromEuler(_e);
      hip.q.slerp(_q2.premultiply(hipQ), this.sprint * 0.9);
    }

    // Throwing a grenade (throwing.js): drawn back as the pin comes out (and
    // held there while it cooks), swung over and let go, then the arm follows
    // through and the next grenade comes up from below. None left: hand down.
    const th = this.kind === 'grenade' ? ctx.throwing : null;
    this.throwState = th;
    if (th) {
      const carry = { p: hip.p.clone(), q: hip.q.clone() };
      if (th.phase === 'windup') {
        throwPose(carry, THROW.back, smooth(Math.min(1, th.t / WINDUP)), hip.p, hip.q);
        // Holding it cooked: a little unsteady.
        if (th.t > WINDUP) hip.p.y += Math.sin(th.t * 9) * 0.003;
      } else if (th.phase === 'swing') throwPose(THROW.back, THROW.out, Math.min(1, th.t / SWING) ** 2, hip.p, hip.q);
      else throwPose(THROW.out, THROW.down, 1 - (1 - Math.min(1, th.t / FOLLOW)) ** 2, hip.p, hip.q);
      this._threw = th.phase === 'follow';
    } else if (this._threw) {
      // Thrown: the next one comes up from below.
      this._threw = false;
      this.swap = 0;
    }
    if (this.kind === 'grenade' && ctx.empty) this.swap = 0;
    this.gun.root.visible = !(th?.phase === 'follow' || (this.kind === 'grenade' && ctx.empty));

    // Reload / bolt motions tilt the gun to show the action.
    const act = this.action;
    let tiltTarget = 0;
    if (act) {
      act.t += dt;
      if (act.t > act.dur + 0.15) this.action = null;
      tiltTarget = this._actionTilt(act);
    }
    this.reloadTilt = damp(this.reloadTilt, tiltTarget, 9, dt);

    // Compose extra rotations around the shoulder/grip area.
    const pivot = this.gun.anchors.gripR || new THREE.Vector3();
    const rot = new THREE.Quaternion();
    _e.set(
      this.kickPitch.x + this.lagPitch.x * (1 - a * 0.7) + ctx.sway.pitch * (1 - a) + this.reloadTilt * 0.35 + this.blocked * 0.9,
      this.kickYaw.x + this.lagYaw.x * (1 - a * 0.7) + ctx.sway.yaw * (1 - a),
      this.kickRoll.x * 0.5 - this.reloadTilt * 0.6,
    );
    rot.setFromEuler(_e);
    // Bob offsets.
    const bx = Math.sin(this.bobT) * 0.012 * this.bob * (1 - a * 0.8);
    const by = -Math.abs(Math.cos(this.bobT)) * 0.012 * this.bob * (1 - a * 0.8);
    // Lowered while switching weapons or when the muzzle is pushed into a wall.
    const lower = (1 - this.swap) * 0.35;

    // Final gun transform in camera space: pose, then rotate around the grip pivot.
    const pivotCam = pivot.clone().applyQuaternion(hip.q).add(hip.p);
    const finalQ = rot.clone().multiply(hip.q);
    const finalP = hip.p.clone().sub(pivotCam).applyQuaternion(rot).add(pivotCam);
    finalP.z += this.kickBack.x + this.blocked * 0.12;
    finalP.x += bx;
    finalP.y += by - lower - this.reloadTilt * 0.04;

    // Place in the world, attached to the camera.
    this.camera.position.copy(cam.position);
    this.camera.quaternion.copy(cam.quaternion);
    this.camera.updateMatrixWorld();
    const gunRoot = this.gun.root;
    gunRoot.position.copy(finalP).applyQuaternion(cam.quaternion).add(cam.position);
    gunRoot.quaternion.copy(cam.quaternion).multiply(finalQ);
    gunRoot.updateMatrixWorld(true);

    this.emptyTube = !!ctx.emptyTube;
    this._animateParts(dt);
    gunRoot.updateMatrixWorld(true);

    // Muzzle position and bore direction in the world.
    this.muzzleWorld.copy(this.gun.anchors.muzzle || _v.set(0, 0, -0.6)).applyMatrix4(gunRoot.matrixWorld);
    // From the hip the shot is turned from the bore toward the point of
    // convergence (fading out as the gun comes up to the eye).
    const toAim = _q3.identity().slerp(this.hipAim, 1 - a);
    this.boreWorld.set(0, 0, -1).applyQuaternion(finalQ).applyQuaternion(toAim).applyQuaternion(cam.quaternion);
    if (this.gun.anchors.ejectionPort) this.ejectWorld.copy(this.gun.anchors.ejectionPort).applyMatrix4(gunRoot.matrixWorld);

    // Flash.
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    if (this.flash.visible) {
      this.flash.position.copy(this.muzzleWorld).addScaledVector(this.boreWorld, 0.04);
      this.flash.quaternion.copy(gunRoot.quaternion);
    }

    this._updateArms(cam, gunRoot);

    // Lighting: match the world sun; dim it in shade or indoors.
    if (ctx.sunDir) {
      this.sun.position.copy(cam.position).addScaledVector(ctx.sunDir, 10);
      this.sun.target.position.copy(cam.position);
      this.sun.color.copy(ctx.sunColor);
      this.sun.intensity = ctx.sunIntensity * ctx.light;
      this.scene.environmentIntensity = 0.4 * (0.45 + 0.55 * ctx.ambient);
    }
    this.root.visible = this.visible;
  }

  _actionTilt(act) {
    const n = act.name;
    const u = clamp(act.t / act.dur, 0, 1);
    const bell = Math.sin(Math.PI * Math.min(1, u * 1.1));
    if (n === 'magOut' || n === 'magIn' || n === 'clip' || n === 'round' || n === 'clipIn' || n === 'coverOpen' || n === 'coverClose' || n === 'load' || n === 'gateOpen' || n === 'cylinderOut' || n === 'moonIn' || n === 'ejectClip') return 0.75;
    if (n === 'boltOpen' || n === 'boltClose' || n === 'charge' || n === 'boltRelease') return 0.45;
    if (n === 'boltUp' || n === 'boltBack' || n === 'boltForward' || n === 'boltDown') return 0.18 + 0.1 * bell;
    if (n === 'settle') return 0.4 * (1 - u);
    return 0;
  }

  // Move bolts, magazines, clips and covers according to the current action.
  _animateParts(dt) {
    const parts = this.gun.parts;
    const rest = this.rest;
    const meta = this.gun.meta || {};
    for (const [n, p] of Object.entries(parts)) {
      if (n === 'body' || n === 'rearSight') continue;
      p.position.copy(rest[n].p);
      p.quaternion.copy(rest[n].q);
    }
    const act = this.action;
    const u = act ? clamp(act.t / act.dur, 0, 1) : 0;
    const ease = (x) => x * x * (3 - 2 * x);
    // Bolt.
    if (parts.bolt) {
      const throwD = meta.boltThrow ?? 0.06;
      const lift = meta.boltLift ?? 0;
      let r = 0,
        back = 0;
      const n = act?.name;
      if (n === 'boltUp') r = ease(u);
      else if (n === 'boltBack') {
        r = 1;
        back = ease(u);
      } else if (n === 'boltForward') {
        r = 1;
        back = 1 - ease(u);
      } else if (n === 'boltDown') r = 1 - ease(u);
      else if (n === 'boltOpen') {
        r = Math.min(1, u * 2.5);
        back = ease(clamp(u * 2.5 - 1, 0, 1));
      } else if (n === 'clip' || n === 'round' || n === 'ejectClip' || n === 'clipIn') {
        r = 1;
        back = 1;
      } else if (n === 'boltClose') {
        back = 1 - ease(clamp(u * 1.6, 0, 1));
        r = 1 - ease(clamp(u * 2.2 - 1.2, 0, 1));
      } else if (n === 'charge') back = Math.sin(Math.PI * u);
      else if (n === 'boltRelease') back = 1 - ease(u);
      // Firing: semi/auto actions slam back briefly.
      if (this.flashT > -0.03 && !lift) back = Math.max(back, clamp(1 - (0.05 - this.flashT) / 0.06, 0, 1) * 0.85);
      if (lift) parts.bolt.rotateZ(lift * r); // handle swings up (counterclockwise seen from behind)
      parts.bolt.position.z += throwD * back;
    }
    // Magazine out and in.
    if (parts.mag) {
      const axis = meta.magAxis ? _v.fromArray(meta.magAxis) : _v.set(0, -1, 0);
      let out = 0;
      if (act?.name === 'magOut') out = ease(u) * 0.35;
      else if (act?.name === 'magIn') out = (1 - ease(u)) * 0.35;
      else if (act?.name === 'coverOpen' || act?.name === 'coverClose') out = 0;
      parts.mag.position.addScaledVector(axis, out);
      parts.mag.visible = !(act?.name === 'magOut' && u > 0.85);
    }
    // Garand clip: pushed down into the receiver.
    if (parts.clip) {
      let up = 0;
      if (act?.name === 'clipIn') up = (1 - ease(u)) * 0.12;
      parts.clip.position.y += up;
      parts.clip.visible = this.clipVisible !== false || act?.name === 'clipIn' || act?.name === 'boltRelease' || act?.name === 'settle';
    }
    // A grenade's pin: drawn out with the ring as the left hand pulls it, then gone.
    if (parts.pin) {
      const th = this.throwState;
      const u = th ? (th.phase === 'windup' ? Math.min(1, th.t / WINDUP) : 1) : 0;
      const k = smooth(clamp((u - 0.25) / 0.2, 0, 1));
      parts.pin.position.add(_v.set(-0.05 * k, 0.03 * k, -0.02 * k));
      parts.pin.visible = u < 0.5;
    }
    // A launcher's rocket (or the Panzerfaust's warhead) is gone once fired.
    for (const r of [parts.rocket, parts.warhead]) if (r) r.visible = !this.emptyTube;
    // Feed cover.
    if (parts.cover) {
      let open = 0;
      if (act?.name === 'coverOpen') open = ease(u);
      else if (act?.name === 'magOut' || act?.name === 'magIn') open = 1;
      else if (act?.name === 'coverClose') open = 1 - ease(u);
      parts.cover.rotateX(-open * 1.2);
    }
  }

  _updateArms(cam, gunRoot) {
    const anchors = this.gun.anchors;
    const toWorld = (p) => p.clone().applyMatrix4(gunRoot.matrixWorld);
    const camRight = _v2.set(1, 0, 0).applyQuaternion(cam.quaternion).clone();
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    // Shoulders sit low and slightly behind the eye, so the upper arms stay
    // mostly out of view and the forearms reach up to the gun. The stance is
    // bladed: the left shoulder turned forward and in (est. 12 cm ahead of the
    // right), so the support arm reaches a long fore-end with its elbow bent.
    const shoulder = (side) =>
      cam.position
        .clone()
        .addScaledVector(camRight, side * (side > 0 ? 0.16 : 0.15))
        .addScaledVector(camUp, side > 0 ? -0.34 : -0.33)
        .addScaledVector(camFwd, side > 0 ? -0.02 : 0.1);
    const arms = this.fpArms;
    if (this.fpArmsGun !== this.gun) {
      arms.setWeapon(this.gun, this.kind);
      this.fpArmsGun = this.gun;
    }
    // By default both hands hold their grips (as the third-person soldier
    // does); during reloads they go to the magazine, clip guide or bolt.
    let right = null,
      left = null;
    const act = this.action;
    if (act) {
      const n = act.name;
      const u = clamp(act.t / act.dur, 0, 1);
      if ((n === 'magOut' || n === 'magIn' || n === 'load' || n === 'moonIn') && anchors.magWell) {
        const axis = this.gun.meta.magAxis ? new THREE.Vector3().fromArray(this.gun.meta.magAxis) : new THREE.Vector3(0, -1, 0);
        const outAmt = n === 'magOut' ? u * 0.35 : (1 - u) * 0.35;
        left = anchors.magWell.clone().addScaledVector(axis, 0.05 + outAmt);
      } else if ((n === 'clip' || n === 'round' || n === 'clipIn') && (anchors.clipGuide || anchors.magWell)) {
        const top = (anchors.clipGuide || anchors.magWell).clone();
        right = top.clone().add(new THREE.Vector3(0.01, 0.04 + Math.sin(u * Math.PI) * 0.03, 0.01));
      } else if ((n.startsWith('bolt') || n === 'charge') && (anchors.boltHandle || anchors.chargingHandle)) {
        right = (anchors.boltHandle || anchors.chargingHandle).clone();
        if (this.gun.parts.bolt) {
          // Follow the moving bolt: anchor relative to the bolt's rest pivot,
          // then through the bolt's current transform.
          right.sub(this.rest.bolt.p).applyMatrix4(this.gun.parts.bolt.matrix);
        }
      } else if ((n === 'coverOpen' || n === 'coverClose') && anchors.coverHinge) {
        left = anchors.coverHinge.clone().add(new THREE.Vector3(0, 0.02, -0.06));
      }
    }
    // Without a support grip the left hand cups the right (a point below it).
    if (!left && !anchors.gripL) left = (anchors.gripR || new THREE.Vector3(0, -0.05, 0.05)).clone().add(new THREE.Vector3(-0.03, -0.04, 0));
    // Throwing: the left hand pulls the pin, then drops away out of sight.
    const th = this.throwState;
    let leftWorld = null;
    if (th) {
      const grip = anchors.gripR || new THREE.Vector3();
      const cup = toWorld(left || grip);
      const pin = toWorld(anchors.pin || grip.clone().add(new THREE.Vector3(-0.025, 0.06, 0)));
      const low = cam.position.clone().addScaledVector(camRight, -0.12).addScaledVector(camUp, -0.45).addScaledVector(camFwd, 0.3);
      const u = th.phase === 'windup' ? Math.min(1, th.t / WINDUP) : 1;
      leftWorld = u < 0.45 ? cup.lerp(pin, smooth(u / 0.45)) : pin.lerp(low, smooth(Math.min(1, (u - 0.45) / 0.4)));
    }
    const G = (this._gunXf ||= { q: new THREE.Quaternion(), p: new THREE.Vector3() });
    G.q.copy(gunRoot.quaternion);
    G.p.copy(gunRoot.position);
    const pinch = [0.62, 0.45, 0.65];
    for (const [target, sgn] of [
      [right, 1],
      [left, -1],
    ]) {
      const S = shoulder(sgn);
      const pole = new THREE.Vector3().addScaledVector(camRight, sgn * 0.3).addScaledVector(camUp, -0.5);
      if (sgn < 0 && leftWorld) arms.place(sgn, S, G, { mode: 'point', point: leftWorld, pole, curl: pinch });
      else if (target) arms.place(sgn, S, G, { mode: 'point', point: toWorld(target), pole, curl: pinch });
      else if (sgn > 0 && th?.phase === 'follow') arms.place(sgn, S, G, { mode: 'grip', pole, curl: [0.2, 0.15, 0.25] }); // let go: hand open
      else arms.place(sgn, S, G, { mode: 'grip', pole, curl: sgn > 0 ? [1, 0.55, 0.82] : [0.95, 0.9, 0.45] });
    }
  }
}

function fallbackModel(def) {
  // Until every gun has its own model, borrow the closest one that exists.
  const prefer = {
    US: ['m1_garand', 'm1903', 'kar98k'],
    GE: ['kar98k'],
    SU: ['mosin_9130', 'kar98k'],
  };
  for (const id of prefer[def.faction] || []) if (MODELS[id]) return id;
  return 'kar98k';
}

function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,240,1)');
  grad.addColorStop(0.2, 'rgba(255,220,140,0.9)');
  grad.addColorStop(0.5, 'rgba(255,140,40,0.35)');
  grad.addColorStop(1, 'rgba(255,100,0,0)');
  g.fillStyle = grad;
  // Star-shaped flash: several thin spikes plus a core.
  g.translate(64, 64);
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    g.beginPath();
    g.moveTo(-4, 0);
    g.lineTo(0, -62);
    g.lineTo(4, 0);
    g.closePath();
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, 26, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
