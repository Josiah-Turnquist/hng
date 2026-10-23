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

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
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

// Two-bone inverse kinematics: find the elbow for a shoulder and hand position.
function solveElbow(S, T, L1, L2, pole, out) {
  const d = _v.copy(T).sub(S);
  let dist = d.length();
  dist = clamp(dist, Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
  d.normalize();
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  // Direction toward the pole, perpendicular to the shoulder-hand line.
  const p = _v2.copy(pole).sub(S);
  p.addScaledVector(d, -p.dot(d)).normalize();
  out.copy(S).addScaledVector(d, a).addScaledVector(p, h);
  return out;
}

// A limb segment stretched between two points (unit cylinder along Y).
function placeSegment(mesh, a, b, radius) {
  const len = a.distanceTo(b);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  _v.copy(b).sub(a).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v);
  mesh.scale.set(radius, len, radius);
}

const POSES = {
  rifle: { hip: [0.12, -0.17, -0.1], sprint: [0.06, -0.24, -0.2] },
  smg: { hip: [0.14, -0.19, -0.22], sprint: [0.06, -0.22, -0.22] },
  lmg: { hip: [0.16, -0.27, -0.08], sprint: [0.08, -0.3, -0.1] },
  pistol: { hip: [0.13, -0.17, -0.36], sprint: [0.12, -0.26, -0.22] },
  launcher: { hip: [0.16, -0.12, 0.05], sprint: [0.12, -0.2, 0.0] },
  grenade: { hip: [0.16, -0.2, -0.3], sprint: [0.12, -0.26, -0.22] },
};

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

const SLEEVES = { US: 'woolOD', GE: 'woolFeldgrau', SU: 'cottonKhaki' };

export class ViewModel {
  constructor(textures, faction = 'US', envMap = null) {
    this.textures = textures;
    this.mats = makeGunMaterials(textures);
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
    this.ejectWorld = new THREE.Vector3();
    this.eyeOffset = new THREE.Vector3(); // ADS eye point relative to camera (zero when aimed)
    this.visible = true;
  }

  _makeArms(faction) {
    const sleeve = this.textures.standard(SLEEVES[faction] || 'woolOD');
    const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.5, 0.38, 0.31, THREE.SRGBColorSpace), roughness: 0.62, metalness: 0 });
    // Sleeve: tapered tube, unit length along +Y (scaled to the bone length).
    const sleeveGeo = new THREE.CylinderGeometry(1, 0.82, 1, 16, 4);
    this.arms = { R: {}, L: {} };
    for (const side of ['R', 'L']) {
      const upper = new THREE.Mesh(sleeveGeo, sleeve);
      const fore = new THREE.Mesh(sleeveGeo, sleeve);
      const hand = makeHand(skin, side === 'R' ? 1 : -1);
      this.root.add(upper, fore, hand);
      this.arms[side] = { upper, fore, hand, elbow: new THREE.Vector3() };
    }
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
    const hp = poses.hip;
    const hipPos = _v.set(hp[0], hp[1], hp[2]);
    const hipQ = _q.setFromUnitVectors(Z_NEG, _v2.set(-hp[0], -hp[1], -25).normalize());
    hipQ.multiply(_q2.setFromAxisAngle(Z_NEG, -0.06));

    // --- aimed pose (sights on the eye line) -----------------------------------------
    const s = this.sighting;
    const adsQ = new THREE.Quaternion().setFromUnitVectors(s.losDir, Z_NEG);
    const adsPos = s.eye.clone().applyQuaternion(adsQ).negate();

    // Blend hip -> aimed.
    const a = this.aim * (1 - this.sprint);
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

    this._animateParts(dt);
    gunRoot.updateMatrixWorld(true);

    // Muzzle position and bore direction in the world.
    this.muzzleWorld.copy(this.gun.anchors.muzzle || _v.set(0, 0, -0.6)).applyMatrix4(gunRoot.matrixWorld);
    this.boreWorld.set(0, 0, -1).applyQuaternion(gunRoot.quaternion);
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
    // mostly out of view and the forearms reach up to the gun.
    const shoulder = (side) =>
      cam.position
        .clone()
        .addScaledVector(camRight, side * (side > 0 ? 0.16 : 0.2))
        .addScaledVector(camUp, -0.34)
        .addScaledVector(camFwd, side > 0 ? -0.02 : 0.02);
    const grip = anchors.gripR || new THREE.Vector3(0, -0.05, 0.05);
    let left = anchors.gripL || new THREE.Vector3(0, -0.04, -0.3);
    let right = grip;
    // During reloads the hands go to the magazine, clip guide or bolt.
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
    const sides = this.kind === 'pistol' ? [['R', right, 1], ['L', anchors.gripL || right, -1]] : [['R', right, 1], ['L', left, -1]];
    for (const [side, target, sgn] of sides) {
      const arm = this.arms[side];
      const S = shoulder(sgn);
      const T = toWorld(target);
      const pole = S.clone().addScaledVector(camRight, sgn * 0.3).addScaledVector(camUp, -0.5);
      // The hand sits on the outside of the grip; the wrist is a few cm behind it.
      arm.hand.quaternion.copy(gunRoot.quaternion);
      const out = side === 'R' ? new THREE.Vector3(0.024, -0.012, 0.012) : new THREE.Vector3(-0.004, -0.026, 0.0);
      arm.hand.position.copy(T).add(out.applyQuaternion(gunRoot.quaternion));
      const wrist = side === 'R' ? new THREE.Vector3(0.03, -0.045, 0.07) : new THREE.Vector3(-0.025, -0.05, 0.06);
      const W = T.clone().add(wrist.applyQuaternion(gunRoot.quaternion));
      solveElbow(S, W, 0.3, 0.27, pole, arm.elbow);
      placeSegment(arm.upper, S, arm.elbow, 0.052);
      placeSegment(arm.fore, arm.elbow, W, 0.04);
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

// A simple hand gripping something: palm, curled fingers and a thumb.
// side = 1 for the right hand (grip on its left), -1 for the left hand.
function makeHand(skin, side) {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.07, 0.08), skin);
  palm.position.set(0, 0, 0.01);
  g.add(palm);
  // Fingers curl under and around the grip (toward -x for the right hand).
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.032, 3, 6), skin);
    f.rotation.z = Math.PI / 2;
    f.position.set(-side * 0.02, -0.03 + i * 0.0, 0.035 - i * 0.019);
    f.position.y = -0.028;
    g.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.035, 3, 6), skin);
  thumb.rotation.set(0.3, 0, side * 1.2);
  thumb.position.set(-side * 0.015, 0.03, 0.0);
  g.add(thumb);
  g.traverse((o) => (o.frustumCulled = false));
  return g;
}
