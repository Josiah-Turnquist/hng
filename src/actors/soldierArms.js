// Weapon handling for the soldier: where the gun is (shouldered, low ready,
// port arms when sprinting, pistols, grenades), the right hand holding the grip,
// the left hand reaching the support grip by two-bone IK, recoil, and the
// reload / bolt / throw / bandage / use gestures.
import * as THREE from 'three';
import { B, solveTwoBone, setModelRotation, quatFromAxes, poseHand, gripCenter } from './soldierRig.js';
import { clamp, lerp, smooth, yawOf, AX, AY, AZ, qAxis, TAU } from './soldierAnim.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion(),
  _q3 = new THREE.Quaternion(),
  _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3(),
  _m = new THREE.Matrix4();

// A transform (rotation + position), model space.
export class Xf {
  constructor() {
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
  }
  copy(o) {
    this.q.copy(o.q);
    this.p.copy(o.p);
    return this;
  }
  lerp(o, t) {
    if (t <= 0) return this;
    if (t >= 1) return this.copy(o);
    this.q.slerp(o.q, t);
    this.p.lerp(o.p, t);
    return this;
  }
  // Place so that local point `anchor` lands on model point `at`.
  placeAnchor(anchor, at) {
    this.p.copy(anchor).applyQuaternion(this.q).negate().add(at);
    return this;
  }
  point(local, out) {
    return out.copy(local).applyQuaternion(this.q).add(this.p);
  }
}

// Precompute how the hands hold a gun model. kind: rifle|smg|lmg|pistol|launcher|grenade.
export function weaponInfo(gun, kind) {
  const a = gun.userData?.anchors || gun.anchors || {};
  const meta = gun.userData?.meta || gun.meta || {};
  const parts = gun.userData?.parts || gun.parts || {};
  const get = (n, d) => (a[n] ? a[n].clone() : d ? V(...d) : null);
  const pistolLike = kind === 'pistol' || kind === 'grenade';
  const anchors = {
    gripR: get('gripR', pistolLike ? [0, -0.05, 0.02] : [0, -0.045, 0.07]),
    gripL: get('gripL', null),
    shoulder: get('shoulder', null),
    muzzle: get('muzzle', [0, 0, kind === 'pistol' ? -0.12 : -0.8]),
    rearSight: get('rearSight', null),
    frontSight: get('frontSight', null),
    boltHandle: get('boltHandle', null) || get('chargingHandle', null),
    clipGuide: get('clipGuide', null),
    magWell: get('magWell', null),
    trigger: get('trigger', [0, -0.05, 0]),
  };
  if (!anchors.shoulder && !pistolLike) anchors.shoulder = V(0, -0.08, 0.3);
  // Right hand: the grip runs down and back through the fist.
  const rake = meta.gripRake ?? (kind === 'rifle' ? 0.9 : kind === 'grenade' ? 0 : 0.42);
  const g = V(0, -Math.cos(rake), Math.sin(rake)).normalize();
  const Xh = V(1, 0, 0),
    Zh = g.clone(),
    Yh = new THREE.Vector3().crossVectors(Zh, Xh);
  const qHG = quatFromAxes(Xh, Yh, Zh, new THREE.Quaternion()).invert();
  // The grip lies against the palm: its center sits its radius in front of it
  // (rifle wrist ~3.8 cm thick, pistol and SMG grips ~3 x 5 cm; est.).
  const gripRadius = meta.gripRadius ?? (kind === 'pistol' ? 0.015 : kind === 'smg' ? 0.017 : kind === 'grenade' ? 0.016 : 0.019);
  const tHG = gripCenter(1, gripRadius).sub(anchors.gripR.clone().applyQuaternion(qHG));
  // Left hand: under the fore-end (cupped), around a vertical front grip, or
  // (a launcher without one: bazooka M1A1, Panzerfaust) cupping the tube itself,
  // its anchor lying under the tube near the bore line (meta.foregrip: 'vertical'
  // | 'tube' | 'fore' overrides the guess).
  let qLG = null,
    tLG = null,
    leftGrip = null;
  let foreRadius = meta.foreRadius ?? (kind === 'smg' ? 0.018 : 0.021);
  if (anchors.gripL) {
    const gl0 = anchors.gripL;
    const off = Math.hypot(gl0.x, gl0.y);
    const tube = meta.foregrip === 'tube' || (kind === 'launcher' && !meta.foregrip && off < 0.085);
    const vertical = !tube && (meta.foregrip === 'vertical' || kind === 'pistol' || kind === 'launcher');
    leftGrip = tube ? 'tube' : vertical ? 'vertical' : 'fore';
    // Tube radius: from the gun when given, else the anchor's depth under the
    // bore less a hand's half thickness (est. 3.5 cm), 2.5 to 5 cm.
    if (tube) foreRadius = meta.foreRadius ?? Math.min(0.05, Math.max(0.025, off - 0.035));
    let H;
    let palm;
    if (vertical) {
      const gl = V(0, -Math.cos(0.3), Math.sin(0.3));
      H = quatFromAxes(V(1, 0, 0), new THREE.Vector3().crossVectors(gl, V(1, 0, 0)), gl, new THREE.Quaternion());
      palm = gripCenter(-1, 0.017);
    } else {
      // Fore-end lying across the palm, the fingers curling up its right side
      // and the thumb along its left: the palm faces up and a little right.
      const fingers = V(0.86, -0.1, -0.5).normalize(); // wrist -> knuckles
      const Y = fingers.clone().negate();
      const X = V(0.3, 0.95, 0.05);
      X.addScaledVector(Y, -X.dot(Y)).normalize();
      const Z = new THREE.Vector3().crossVectors(X, Y);
      H = quatFromAxes(X, Y, Z, new THREE.Quaternion());
      palm = gripCenter(-1, foreRadius);
    }
    qLG = H.invert();
    // The held cylinder's center: the anchor, or for a tube the bore line there.
    const center = tube ? V(0, 0, gl0.z) : gl0;
    tLG = palm.sub(center.clone().applyQuaternion(qLG));
  }
  return {
    gun,
    kind,
    gripRadius,
    gripAxis: g, // the grip's slope through gripR (gun space: down and back)
    foreRadius,
    leftGrip,
    straightPull: !a.boltHandle,
    anchors,
    meta,
    parts,
    qHG,
    tHG,
    qLG,
    tLG,
    shouldered: !!anchors.shoulder && !pistolLike,
    boltPart: parts.bolt || null,
    magPart: parts.magazine || parts.mag || null,
    boltRest: parts.bolt ? { p: parts.bolt.position.clone(), q: parts.bolt.quaternion.clone() } : null,
  };
}

// Hand transform that holds the gun (gun transform G) -> wrist position + rotation.
export function handFromGun(G, qHandGun, tHandGun, out) {
  out.q.copy(G.q).multiply(_q.copy(qHandGun).invert());
  out.p.copy(tHandGun).applyQuaternion(out.q).negate().add(G.p);
  return out;
}
export function gunFromHand(H, qHandGun, tHandGun, out) {
  out.q.copy(H.q).multiply(qHandGun);
  out.p.copy(tHandGun).applyQuaternion(H.q).add(H.p);
  return out;
}

const env = (t, a = 0.12, b = 0.86) => smooth(0, a, t) * (1 - smooth(b, 1, t));
// Piecewise path through keyframes [[t, value]] with smoothstep between them.
function keys(t, ks, out) {
  if (t <= ks[0][0]) return out.copy(ks[0][1]);
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, a] = ks[i],
      [t1, b] = ks[i + 1];
    if (t <= t1) return out.copy(a).lerp(b, smooth(t0, t1, t));
  }
  return out.copy(ks[ks.length - 1][1]);
}

export class SoldierArms {
  constructor(anim) {
    this.anim = anim;
    this.info = null;
    this.G = new Xf(); // gun, model space (final)
    this.Gt = new Xf(); // desired gun
    this.handR = new Xf();
    this.handL = new Xf();
    this.tmp = new Xf();
    this.tmp2 = new Xf();
    this.holder = 'right';
    this.sight = { p: new THREE.Vector3(), d: new THREE.Vector3() };
    this.weld = 0;
    this.gunVisible = true;
    this.released = false; // grenade left the hand during a throw
    // Finger curls per hand (current and target): fingers, index, thumb.
    this.fingers = { [1]: [0.35, 0.3, 0.25, 0], [-1]: [0.35, 0.3, 0.25, 0] };
    this.fingerT = { [1]: [0.35, 0.3, 0.25, 0], [-1]: [0.35, 0.3, 0.25, 0] };
  }

  // Set a hand's grip target: c fingers, i index, t thumb (0 open .. 1 closed),
  // wrap: radius of a grip the fingers close round (0 = none).
  grip(side, c, i = c, t = c, wrap = 0) {
    const g = this.fingerT[side];
    g[0] = c;
    g[1] = i;
    g[2] = t;
    g[3] = wrap;
  }
  // Ease the fingers toward their targets and write them to the pose.
  applyFingers(pose, dt) {
    const k = dt > 0 ? 1 - Math.exp(-18 * Math.min(dt, 0.1)) : 1;
    for (const side of [1, -1]) {
      const f = this.fingers[side],
        g = this.fingerT[side];
      for (let n = 0; n < 3; n++) f[n] += (g[n] - f[n]) * k;
      f[3] = g[3];
      poseHand(pose, side, f[0], f[1], f[2], 0, f[3]);
    }
  }

  setWeapon(info) {
    if (this.info?.boltPart && this.info.boltRest) {
      this.info.boltPart.position.copy(this.info.boltRest.p);
      this.info.boltPart.quaternion.copy(this.info.boltRest.q);
    }
    this.info = info;
  }

  // chest-frame point -> model
  cp(x, y, z, out) {
    const mp = this.anim.mp;
    return out.set(x, y, z).applyQuaternion(mp.q[B.chest]).add(mp.p[B.chest]);
  }
  chestYaw() {
    const mp = this.anim.mp;
    const prone = this.anim.info.prone;
    _v.set(0, 0, -1).applyQuaternion(mp.q[B.chest]);
    _v2.set(0, 1, 0).applyQuaternion(mp.q[B.chest]);
    return prone > 0.5 ? yawOf(_v2.x, _v2.z) : yawOf(_v.x, _v.z);
  }

  // Desired gun transform without actions.
  _gunPose(s, out) {
    const info = this.info,
      an = info.anchors,
      anim = this.anim,
      sm = anim.sm,
      mp = anim.mp;
    const aim = sm.aim,
      sprint = sm.sprint,
      prone = anim.info.prone,
      seated = anim.info.seated;
    const cy = this.chestYaw();
    const A = this.tmp,
      L = this.tmp2;
    A.q.setFromAxisAngle(AY, sm.yaw).multiply(qAxis(_q, AX, sm.pitch));
    // Small breathing sway on the aimed weapon.
    const t = anim.time;
    A.q.multiply(qAxis(_q, AX, Math.sin(t * 1.3) * 0.004)).multiply(qAxis(_q, AY, Math.sin(t * 0.9 + 1) * 0.004));
    if (info.kind === 'pistol') {
      const eye = this.cp(0.035, 0.4, -0.06, _v3);
      _v.set(0, 0, -1).applyQuaternion(A.q);
      _v2.copy(eye).addScaledVector(_v, 0.56).add(_v3.set(0.01, -0.07, 0));
      A.placeAnchor(an.gripR, _v2);
      L.q.setFromAxisAngle(AY, cy + 0.15).multiply(qAxis(_q, AX, -0.85));
      L.placeAnchor(an.gripR, this.cp(0.09, -0.06, -0.3, _v));
    } else if (info.kind === 'grenade') {
      A.q.copy(mp.q[B.chest]).multiply(qAxis(_q, AX, 0.4));
      A.placeAnchor(an.gripR, this.cp(0.24, 0.3, 0.06, _v));
      L.q.copy(mp.q[B.chest]);
      L.placeAnchor(an.gripR, this.cp(0.15, -0.04, -0.24, _v));
    } else {
      const launcher = info.kind === 'launcher';
      const pocket = launcher ? this.cp(0.12, 0.28, 0.0, _v) : this.cp(0.095, 0.17, -0.095, _v);
      A.placeAnchor(an.shoulder, pocket);
      if (info.kind === 'lmg') {
        L.q.setFromAxisAngle(AY, cy + 0.12).multiply(qAxis(_q, AX, -0.15));
        L.placeAnchor(an.gripR, this.cp(0.16, -0.24, -0.1, _v));
      } else if (launcher) {
        L.q.setFromAxisAngle(AY, cy + 0.05).multiply(qAxis(_q, AX, -0.2));
        L.placeAnchor(an.shoulder, this.cp(0.13, 0.25, 0.02, _v));
      } else {
        L.q.setFromAxisAngle(AY, cy + 0.32 - 0.08 * anim.info.crouch).multiply(qAxis(_q, AX, -0.44 + 0.24 * anim.info.crouch));
        L.placeAnchor(an.shoulder, this.cp(0.13, 0.08, -0.04, _v));
      }
      // Port arms while sprinting (rifles, SMGs).
      if (sprint > 0.01 && (info.kind === 'rifle' || info.kind === 'smg')) {
        const P = this.tmp3 || (this.tmp3 = new Xf());
        P.q.copy(mp.q[B.chest]).multiply(qAxis(_q, AY, 0.25)).multiply(qAxis(_q, AZ, 0.62)).multiply(qAxis(_q, AX, 1.3));
        P.placeAnchor(an.gripR, this.cp(0.1, -0.22, -0.2, _v));
        L.lerp(P, sprint * (1 - aim));
      }
    }
    // Prone and not aiming: rifle lies forward in the hands.
    if (prone > 0.01) {
      const P = this.tmp4 || (this.tmp4 = new Xf());
      const fy = cy;
      P.q.setFromAxisAngle(AY, fy + 0.15).multiply(qAxis(_q, AX, -0.04));
      const cw = Math.sin(anim.crawlPhase * TAU) * anim.sm.crawl;
      _v2.set(0.13, 0.11, -0.42 + 0.08 * cw).applyAxisAngle(AY, fy);
      P.placeAnchor(an.gripR, _v2);
      L.lerp(P, prone);
    }
    // Seated, not aiming: across the lap.
    if (seated > 0.01) {
      const P = this.tmp4 || (this.tmp4 = new Xf());
      P.q.setFromAxisAngle(AY, 1.15).multiply(qAxis(_q, AX, 0.05));
      P.placeAnchor(an.gripR, _v2.set(0.15, 0.24, -0.22));
      L.lerp(P, seated);
    }
    out.copy(L).lerp(A, aim);
    // Recoil: kick back and up around the shoulder.
    const r = s.recoil || 0;
    if (r > 0) {
      const pivot = info.shouldered ? out.point(an.shoulder, _v3) : out.point(an.gripR, _v3);
      _q2.copy(out.q).multiply(qAxis(_q, AX, 0.1 * r));
      out.q.copy(_q2);
      out.placeAnchor(info.shouldered ? an.shoulder : an.gripR, pivot);
      out.p.add(_v.set(0, 0.006, 0.045).applyQuaternion(out.q).multiplyScalar(r));
    }
    this.anim.bladeAngle = info.shouldered ? 0.62 : 0;
    return out;
  }

  // Elbow poles (model space): out and down when shouldering, down at low
  // ready, down onto the ground when prone.
  _poles(aim, outR, outL) {
    const mp = this.anim.mp;
    const prone = this.anim.info.prone;
    outR.set(lerp(0.55, 0.95, aim), lerp(-0.85, -0.4, aim), lerp(0.3, 0.35, aim)).applyQuaternion(mp.q[B.chest]);
    outL.set(lerp(-0.45, -0.3, aim), -1, lerp(0.1, 0.0, aim)).applyQuaternion(mp.q[B.chest]);
    if (prone > 0.01) {
      const cy = this.chestYaw();
      outR.lerp(_v.set(0.7, -1, 0.3).applyAxisAngle(AY, cy), prone);
      outL.lerp(_v.set(-0.7, -1, 0.3).applyAxisAngle(AY, cy), prone);
    }
  }

  // Shrug / reach the clavicles toward the hand targets.
  _clavicles(pose, tR, tL) {
    const mp = this.anim.mp;
    for (const [side, t] of [
      [1, tR],
      [-1, tL],
    ]) {
      const sh = side > 0 ? B.shoulderR : B.shoulderL;
      if (!t) {
        pose.q[sh].identity();
        continue;
      }
      _v.copy(t).sub(mp.p[sh + 1]).applyQuaternion(_q.copy(mp.q[B.chest]).invert());
      const e = clamp(_v.y * 0.9 + 0.08, 0, 0.32);
      const p = clamp(-_v.z * 0.35, -0.05, 0.22);
      pose.q[sh].setFromAxisAngle(AZ, side * e).multiply(qAxis(_q, AY, side * p));
    }
    mp.fk(pose);
  }

  _solveArm(pose, side, target, pole) {
    const mp = this.anim.mp;
    const ua = side > 0 ? B.upperArmR : B.upperArmL;
    solveTwoBone(pose, mp, ua, ua + 1, target.p, pole);
    setModelRotation(pose, mp, ua + 2, target.q);
    mp.fk(pose);
  }

  // Free arm swinging with the gait (no weapon / free hand).
  _swingArm(pose, side) {
    const anim = this.anim,
      sm = anim.sm,
      g = anim.g || { run: 0, sprint: 0 };
    const prone = anim.info.prone;
    const walk = smooth(0.1, 1.2, sm.speed) * sm.moving;
    const amp = 0.22 * walk + 0.4 * g.run + 0.25 * g.sprint;
    const ph = anim.phase * TAU;
    const sw = side < 0 ? -Math.cos(ph) : Math.cos(ph);
    const ua = side > 0 ? B.upperArmR : B.upperArmL;
    pose.q[ua].setFromAxisAngle(AX, 0.06 + amp * sw).multiply(qAxis(_q, AZ, side * 0.1));
    pose.q[ua + 1].setFromAxisAngle(AX, 0.2 + 0.3 * walk + 1.1 * g.run + 0.3 * g.sprint + Math.max(0, sw) * 0.3 * walk);
    pose.q[ua + 2].setFromAxisAngle(AX, 0.1);
    if (prone > 0.01) {
      // Hands on the ground in front.
      anim.mp.fk(pose);
      const t = this.tmp;
      t.p.set(side * 0.24, 0.05, -0.32).applyAxisAngle(AY, this.chestYaw());
      t.q.setFromAxisAngle(AY, this.chestYaw()).multiply(qAxis(_q, AX, -1.4));
      const q0 = pose.q[ua].clone(),
        q1 = pose.q[ua + 1].clone();
      _v2.set(side * 0.6, -1, 0.2);
      this._solveArm(pose, side, t, _v2);
      pose.q[ua].slerp(q0, 1 - prone);
      pose.q[ua + 1].slerp(q1, 1 - prone);
    }
    anim.mp.fk(pose);
  }

  update(dt, s, pose) {
    const anim = this.anim,
      mp = anim.mp;
    const info = this.info;
    this.weld = 0;
    this.released = false;
    if (s.ride && (s.ride.handL || s.ride.handR)) {
      this._ride(dt, s, pose, s.ride);
      return;
    }
    if (!info) {
      this.gunVisible = false;
      this.holderOut = 'none';
      anim.bladeAngle = 0;
      // Relaxed hands, a fist for a throw, half open when working.
      const a = s.action;
      const tt = clamp(s.actionT || 0, 0, 1);
      if (a === 'throw') {
        this.grip(1, tt < 0.5 ? 0.85 : 0.2, tt < 0.5 ? 0.8 : 0.15, tt < 0.5 ? 0.8 : 0.2);
        this.grip(-1, 0.15, 0.05, 0.2);
      } else if (a === 'bandage' || a === 'use') {
        this.grip(1, 0.55, 0.45, 0.5);
        this.grip(-1, 0.55, 0.45, 0.5);
      } else {
        this.grip(1, 0.38, 0.3, 0.25);
        this.grip(-1, 0.38, 0.3, 0.25);
      }
      if (!this._freeHands(pose, s.action, tt)) {
        this._clavicles(pose, null, null);
        this._swingArm(pose, 1);
        this._swingArm(pose, -1);
      }
      this.applyFingers(pose, dt);
      return;
    }
    this.gunVisible = true;
    const act = s.action || null;
    const t = clamp(s.actionT || 0, 0, 1);
    // Body twist for a throw happens before the hands are placed.
    if (act === 'throw') {
      const tw = keys(t, [
        [0, _v.set(0, 0, 0)],
        [0.35, _v2.set(-0.7, 0.18, 0)],
        [0.52, _v3.set(0.55, -0.3, 0)],
        [1, new THREE.Vector3(0, 0, 0)],
      ], new THREE.Vector3());
      anim._rotateModel(pose, B.spine, qAxis(_q3, AY, tw.x * 0.4));
      anim._rotateModel(pose, B.chest, qAxis(_q3, AY, tw.x * 0.6));
      _v.set(Math.cos(anim.sm.yaw), 0, -Math.sin(anim.sm.yaw));
      anim._rotateModel(pose, B.chest, _q3.setFromAxisAngle(_v, tw.y));
    }
    const G = this._gunPose(s, this.Gt);
    let holder = 'right';
    let handRT = null,
      handLT = null; // overrides (Xf) for the free hand
    let wR = 0,
      wL = 0;
    const an = info.anchors;
    const poleR = this.poleR || (this.poleR = new THREE.Vector3()),
      poleL = this.poleL || (this.poleL = new THREE.Vector3());
    this._poles(anim.sm.aim, poleR, poleL);
    let leftFree = !info.qLG;
    this.gunVisible = true;

    if (act === 'reload' || act === 'bolt') {
      const e = env(t, 0.1, 0.88);
      const boltGun = !!an.boltHandle && (act === 'bolt' || info.kind === 'rifle' || !an.magWell);
      if (boltGun) {
        holder = t > 0.06 && t < 0.94 && info.qLG ? 'left' : 'right';
        const R = this.tmp3 || (this.tmp3 = new Xf());
        if (act === 'reload') {
          R.q.setFromAxisAngle(AY, this.chestYaw() + 0.45).multiply(qAxis(_q, AX, 0.3)).multiply(qAxis(_q, AZ, 0.45));
          if (an.gripL) R.placeAnchor(an.gripL, this.cp(-0.06, -0.1, -0.36, _v));
          else R.placeAnchor(an.trigger, this.cp(0.07, -0.05, -0.28, _v));
        } else {
          R.copy(G);
          R.q.multiply(qAxis(_q, AX, -0.05)).multiply(qAxis(_q, AZ, 0.12));
          R.p.y -= 0.02;
        }
        G.lerp(R, e);
        // Right hand path in gun space.
        const bh = an.boltHandle;
        const throw_ = info.meta.boltThrow ?? 0.09,
          lift = info.straightPull ? 0 : info.meta.boltLift ?? Math.PI / 2;
        const up = V(bh.x + 0.005, bh.y + 0.035, bh.z);
        const back = V(up.x, up.y, up.z + throw_);
        let ks, boltK;
        if (act === 'bolt') {
          ks = [
            [0.0, an.gripR],
            [0.18, bh],
            [0.28, up],
            [0.46, back],
            [0.62, up],
            [0.72, bh],
            [0.92, an.gripR],
          ];
          boltK = [
            [0.18, 0, 0],
            [0.28, 1, 0],
            [0.46, 1, 1],
            [0.62, 1, 0],
            [0.72, 0, 0],
          ];
        } else {
          const pouch = _v3.set(0.1, 1.03, -0.14);
          mp.point(B.hips, pouch, pouch);
          const pouchG = pouch.sub(G.p).applyQuaternion(_q.copy(G.q).invert()).clone();
          const clip = an.clipGuide ? an.clipGuide.clone().add(V(0, 0.05, 0)) : up.clone().add(V(0, 0.02, -0.05));
          const clipDown = clip.clone().add(V(0, -0.045, 0));
          ks = [
            [0.0, an.gripR],
            [0.12, bh],
            [0.18, up],
            [0.27, back],
            [0.4, pouchG],
            [0.47, pouchG],
            [0.58, clip],
            [0.68, clipDown],
            [0.74, back],
            [0.8, up],
            [0.85, bh],
            [0.95, an.gripR],
          ];
          boltK = [
            [0.12, 0, 0],
            [0.18, 1, 0],
            [0.27, 1, 1],
            [0.74, 1, 1],
            [0.8, 1, 0],
            [0.85, 0, 0],
          ];
        }
        const pt = keys(t, ks, new THREE.Vector3());
        handRT = this.handR;
        // Pinch hand: palm down over the action.
        handRT.q.copy(G.q).multiply(qAxis(_q, AY, 0.4)).multiply(qAxis(_q, AX, -1.2));
        G.point(pt, _v);
        handRT.p.copy(_v).add(_v3.set(0.03, 0.07, 0.02).applyQuaternion(handRT.q));
        // Blend the grip pose into the gesture.
        const gripH = handFromGun(G, info.qHG, info.tHG, new Xf());
        wR = smooth(0.0, 0.1, t) * (1 - smooth(0.9, 0.97, t));
        handRT = gripH.lerp(handRT, wR);
        if (holder !== 'left') holder = 'right-free';
        this._bolt(t, boltK, lift, throw_);
      } else if (an.magWell && info.qLG) {
        // Magazine change with the left hand.
        const R = this.tmp3 || (this.tmp3 = new Xf());
        R.q.setFromAxisAngle(AY, this.chestYaw() + 0.25).multiply(qAxis(_q, AX, -0.12)).multiply(qAxis(_q, AZ, -0.35));
        R.placeAnchor(an.trigger, this.cp(0.09, -0.08, -0.3, _v));
        G.lerp(R, env(t, 0.1, 0.9));
        const well = an.magWell.clone().add(V(0, -0.03, 0));
        const out = well.clone().add(V(0, -0.14, 0.02));
        const pouch = _v3.set(-0.1, 1.03, -0.14);
        mp.point(B.hips, pouch, pouch);
        const pouchG = pouch.sub(G.p).applyQuaternion(_q.copy(G.q).invert()).clone();
        const pt = keys(t, [
          [0.0, an.gripL],
          [0.14, well],
          [0.26, out],
          [0.42, pouchG],
          [0.5, pouchG],
          [0.66, out],
          [0.76, well],
          [0.84, well],
          [0.97, an.gripL],
        ], new THREE.Vector3());
        handLT = this.handL;
        handLT.q.copy(G.q).multiply(qAxis(_q, AZ, -0.4)).multiply(qAxis(_q, AX, 0.3));
        G.point(pt, handLT.p);
        handLT.p.add(_v.set(-0.02, -0.07, 0).applyQuaternion(handLT.q));
        wL = smooth(0.02, 0.12, t) * (1 - smooth(0.88, 0.97, t));
        if (info.magPart) info.magPart.visible = !(t > 0.3 && t < 0.62);
      }
    } else if (act === 'throw') {
      const grenadeInHand = info.kind === 'grenade';
      const path = [
        [0.0, this.cp(0.18, -0.02, -0.22, new THREE.Vector3())],
        [0.35, this.cp(0.28, 0.3, 0.2, new THREE.Vector3())],
        [0.5, this.cp(0.12, 0.42, -0.38, new THREE.Vector3())],
        [0.66, this.cp(-0.12, -0.05, -0.4, new THREE.Vector3())],
        [1.0, this.cp(0.18, -0.02, -0.22, new THREE.Vector3())],
      ];
      const pt = keys(t, path, new THREE.Vector3());
      handRT = this.handR;
      handRT.q.copy(anim.mp.q[B.chest]).multiply(qAxis(_q, AX, t < 0.42 ? 2.2 : 1.2)).multiply(qAxis(_q, AY, 0.3));
      handRT.p.copy(pt);
      wR = env(t, 0.08, 0.85);
      this.released = t >= 0.5;
      if (grenadeInHand) {
        holder = 'right';
        this.gunVisible = t < 0.5;
        // Grenade follows the hand.
        G.copy(gunFromHand(handFromGun(G, info.qHG, info.tHG, new Xf()).lerp(handRT, wR), info.qHG, info.tHG, new Xf()));
        handRT = null;
        wR = 0;
      } else {
        holder = t > 0.05 && t < 0.95 ? 'left' : 'right';
        const R = this.tmp3 || (this.tmp3 = new Xf());
        R.q.setFromAxisAngle(AY, this.chestYaw() + 0.15).multiply(qAxis(_q, AX, 1.15)).multiply(qAxis(_q, AY, -0.3));
        if (info.qLG) R.placeAnchor(an.gripL, this.cp(-0.27, -0.14, -0.2, _v));
        else R.placeAnchor(an.gripR, this.cp(-0.27, -0.14, -0.2, _v));
        G.lerp(R, env(t, 0.06, 0.9));
        const gripH = handFromGun(G, info.qHG, info.tHG, new Xf());
        handRT = gripH.lerp(handRT, wR);
        holder = holder === 'left' ? 'left' : 'right-free';
      }
    } else if (act === 'bandage' || act === 'use') {
      // Sling the weapon over the back; both hands work in front.
      const S = this._sling(this.tmp3 || (this.tmp3 = new Xf()));
      const e = env(t, 0.15, 0.85);
      G.lerp(S, e);
      holder = e > 0.5 ? 'sling' : 'right';
      const wob = Math.sin(t * TAU * 4);
      handRT = this.handR;
      handLT = this.handL;
      if (act === 'bandage') {
        const c = this.cp(-0.12, -0.04, -0.27, new THREE.Vector3());
        handLT.p.copy(this.cp(-0.06, -0.08, -0.33, _v));
        handLT.q.copy(anim.mp.q[B.chest]).multiply(qAxis(_q, AX, 1.4)).multiply(qAxis(_q, AY, 0.9));
        const a = t * TAU * 5;
        handRT.p.copy(c).add(_v.set(0.05 * Math.cos(a), 0.05 * Math.sin(a), 0.02 * Math.sin(a)).applyQuaternion(anim.mp.q[B.chest]));
        handRT.q.copy(anim.mp.q[B.chest]).multiply(qAxis(_q, AX, 1.3)).multiply(qAxis(_q, AY, -0.8));
      } else {
        const drive = anim.info.seated > 0.5;
        handRT.p.copy(this.cp(0.15, drive ? -0.06 : -0.16, -0.38 + 0.02 * wob, _v));
        handLT.p.copy(this.cp(-0.15, drive ? -0.06 : -0.16, -0.38 - 0.02 * wob, _v));
        handRT.q.copy(anim.mp.q[B.chest]).multiply(qAxis(_q, AX, 1.45)).multiply(qAxis(_q, AY, -0.3));
        handLT.q.copy(anim.mp.q[B.chest]).multiply(qAxis(_q, AX, 1.45)).multiply(qAxis(_q, AY, 0.3));
      }
      wR = wL = e;
      const gripH = handFromGun(G, info.qHG, info.tHG, new Xf());
      handRT = gripH.lerp(handRT, wR);
      if (info.qLG) handLT = handFromGun(G, info.qLG, info.tLG, new Xf()).lerp(handLT, wL);
      holder = holder === 'sling' ? 'sling' : 'right-free';
    } else if (info.magPart) info.magPart.visible = true;
    if (act !== 'reload' && act !== 'bolt') this._bolt(0, null);

    // Place the hands.
    const tR = holder === 'right' ? handFromGun(G, info.qHG, info.tHG, this.handR) : handRT || handFromGun(G, info.qHG, info.tHG, this.handR);
    let tL = null;
    this.tLGcur = info.tLG;
    if (holder === 'left') tL = this._reachGrip(G, this.handL);
    else if (handLT && wL > 0) tL = info.qLG ? handFromGun(G, info.qLG, info.tLG, new Xf()).lerp(handLT, wL) : handLT;
    else if (info.qLG) tL = null; // solved after the right hand holds the gun
    this._clavicles(pose, tR.p, tL ? tL.p : info.qLG ? handFromGun(G, info.qLG, info.tLG, this.tmp).p : null);
    if (holder === 'left') {
      this._solveArm(pose, -1, tL, poleL);
      // The gun follows the left hand.
      this._handXf(-1, this.tmp);
      gunFromHand(this.tmp, info.qLG, this.tLGcur, this.G);
      this._solveArm(pose, 1, tR, poleR);
    } else {
      this._solveArm(pose, 1, tR, poleR);
      if (holder === 'right') {
        this._handXf(1, this.tmp);
        gunFromHand(this.tmp, info.qHG, info.tHG, this.G);
      } else this.G.copy(G);
      if (tL) this._solveArm(pose, -1, tL, poleL);
      else if (info.qLG) this._solveArm(pose, -1, this._reachGrip(this.G, this.handL), poleL);
      else this._swingArm(pose, -1);
    }
    this.holderOut = holder;
    // Fingers: the shooting hand round the grip with the index on the trigger,
    // the support hand cupping the fore-end (or round a front grip), a pinch on
    // the bolt, open hands for bandaging and for a thrown grenade's follow-through.
    const vertical = info.leftGrip === 'vertical';
    const onGun = !(handRT && wR > 0.5);
    if (info.kind === 'grenade') this.grip(1, this.released ? 0.2 : 0.85, this.released ? 0.15 : 0.8, this.released ? 0.2 : 0.8);
    else if (!onGun) this.grip(1, act === 'bandage' || act === 'use' ? 0.55 : 0.7, act === 'bandage' ? 0.45 : 0.62, 0.62);
    else this.grip(1, 1, act === 'bolt' || act === 'reload' ? 0.75 : 0.55, 0.82, info.gripRadius);
    if (handLT && wL > 0.5) this.grip(-1, act === 'bandage' || act === 'use' ? 0.5 : 0.7, 0.6, 0.5);
    else if (info.qLG) this.grip(-1, vertical ? 1 : 0.95, vertical ? 1 : 0.9, vertical ? 0.75 : 0.45, vertical ? 0.017 : info.foreRadius);
    else this.grip(-1, 0.38, 0.3, 0.25);
    this.applyFingers(pose, dt);
    // Sight line for the head (cheek weld).
    if (info.shouldered && holder === 'right') {
      const rs = an.rearSight,
        fs = an.frontSight;
      if (rs && fs) {
        this.G.point(rs, this.sight.p);
        this.G.point(fs, _v).sub(this.sight.p).normalize();
        this.sight.d.copy(_v);
      } else {
        this.G.point(V(0, 0.03, 0), this.sight.p);
        this.sight.d.set(0, 0, -1).applyQuaternion(this.G.q);
      }
      this.weld = anim.sm.aim * (act ? 0.4 : 1);
    }
  }

  // The weapon slung on the back: muzzle up over the right shoulder, sights
  // facing back.
  _sling(S) {
    const an = this.info.anchors;
    const m = _v.set(0.38, 0.92, 0.1).normalize();
    const yg = _v3.set(0, 0, 1);
    yg.addScaledVector(m, -yg.dot(m)).normalize();
    const zg = _v2.copy(m).negate();
    _m.makeBasis(new THREE.Vector3().crossVectors(yg, zg), yg, zg);
    S.q.setFromRotationMatrix(_m).premultiply(this.anim.mp.q[B.chest]);
    S.placeAnchor(an.trigger, this.cp(0.03, -0.02, 0.2, _v));
    return S;
  }

  // Riding with the hands on the grips: handlebars (bicycle, motorcycle) held
  // from above, palms down, or the spade grips of a sidecar machine gun; the
  // rider's own weapon slung on his back.
  _ride(dt, s, pose, r) {
    const anim = this.anim;
    const info = this.info;
    const T = anim._rideT;
    const qB = _q3.setFromAxisAngle(AZ, -(r.lean || 0)).multiply(qAxis(_q2, AX, r.pitch || 0));
    const mg = r.style === 'sidecar';
    const rBar = mg ? 0.016 : 0.012;
    if (info) {
      this.gunVisible = true;
      this._sling(this.G);
      this.holderOut = 'sling';
      if (info.magPart) info.magPart.visible = true;
      this._bolt(0, null);
    } else {
      this.gunVisible = false;
      this.holderOut = 'none';
    }
    const hands = [];
    for (const side of [1, -1]) {
      const tgt = side > 0 ? r.handR && T.hR : r.handL && T.hL;
      if (!tgt) {
        hands.push(null);
        continue;
      }
      const X = new THREE.Vector3(),
        Y = new THREE.Vector3(),
        Z = new THREE.Vector3();
      if (mg) {
        // Pistol-style spade grip, raked back: the palm against it from the side.
        X.set(1, 0, 0);
        Z.set(0, -Math.cos(0.3), Math.sin(0.3));
      } else if (side > 0) {
        X.set(0, 0.86, -0.5);
        Z.set(1, 0, 0);
      } else {
        X.set(0, -0.86, 0.5);
        Z.set(-1, 0, 0);
      }
      X.applyQuaternion(qB);
      Z.applyQuaternion(qB);
      Y.crossVectors(Z, X).normalize();
      Z.crossVectors(X, Y).normalize();
      const H = side > 0 ? this.handR : this.handL;
      quatFromAxes(X, Y, Z, H.q);
      gripCenter(side, rBar, _v).applyQuaternion(H.q);
      H.p.copy(tgt).sub(_v);
      hands.push(H);
      this.grip(side, 1, 1, 0.75, rBar);
    }
    const [hR, hL] = hands;
    this._clavicles(pose, hR ? hR.p : null, hL ? hL.p : null);
    const poleR = (this.poleR ||= new THREE.Vector3()).set(0.8, -0.6, 0.35).applyQuaternion(qB);
    const poleL = (this.poleL ||= new THREE.Vector3()).set(-0.8, -0.6, 0.35).applyQuaternion(qB);
    if (hR) this._solveArm(pose, 1, hR, poleR);
    else {
      this._swingArm(pose, 1);
      this.grip(1, 0.38, 0.3, 0.25);
    }
    if (hL) this._solveArm(pose, -1, hL, poleL);
    else {
      this._swingArm(pose, -1);
      this.grip(-1, 0.38, 0.3, 0.25);
    }
    this.applyFingers(pose, dt);
  }

  // Throw / bandage / use with empty hands. Returns false when there is no
  // gesture to play.
  _freeHands(pose, act, t) {
    if (act !== 'throw' && act !== 'bandage' && act !== 'use') return false;
    const anim = this.anim,
      cq = anim.mp.q[B.chest];
    const R = this.handR,
      L = this.handL;
    let w;
    if (act === 'throw') {
      // Twist and throw overhand; the left arm points at the target.
      const tw = keys(t, [
        [0, _v.set(0, 0, 0)],
        [0.35, _v2.set(-0.7, 0.18, 0)],
        [0.52, _v3.set(0.55, -0.3, 0)],
        [1, new THREE.Vector3(0, 0, 0)],
      ], new THREE.Vector3());
      anim._rotateModel(pose, B.spine, qAxis(_q3, AY, tw.x * 0.4));
      anim._rotateModel(pose, B.chest, qAxis(_q3, AY, tw.x * 0.6));
      keys(t, [
        [0.0, this.cp(0.18, -0.12, -0.18, new THREE.Vector3())],
        [0.35, this.cp(0.28, 0.3, 0.2, new THREE.Vector3())],
        [0.5, this.cp(0.12, 0.42, -0.38, new THREE.Vector3())],
        [0.66, this.cp(-0.12, -0.05, -0.4, new THREE.Vector3())],
        [1.0, this.cp(0.18, -0.12, -0.18, new THREE.Vector3())],
      ], R.p);
      R.q.copy(cq).multiply(qAxis(_q, AX, t < 0.42 ? 2.2 : 1.2)).multiply(qAxis(_q, AY, 0.3));
      keys(t, [
        [0.0, this.cp(-0.2, -0.2, -0.2, new THREE.Vector3())],
        [0.35, this.cp(-0.12, 0.25, -0.48, new THREE.Vector3())],
        [0.6, this.cp(-0.25, -0.15, -0.1, new THREE.Vector3())],
        [1.0, this.cp(-0.2, -0.2, -0.2, new THREE.Vector3())],
      ], L.p);
      L.q.copy(cq).multiply(qAxis(_q, AX, 1.3));
      w = env(t, 0.08, 0.85);
      this.released = t >= 0.5;
    } else {
      const wob = Math.sin(t * TAU * 4);
      if (act === 'bandage') {
        const c = this.cp(-0.12, -0.04, -0.27, new THREE.Vector3());
        L.p.copy(this.cp(-0.06, -0.08, -0.33, _v));
        L.q.copy(cq).multiply(qAxis(_q, AX, 1.4)).multiply(qAxis(_q, AY, 0.9));
        const a = t * TAU * 5;
        R.p.copy(c).add(_v.set(0.05 * Math.cos(a), 0.05 * Math.sin(a), 0.02 * Math.sin(a)).applyQuaternion(cq));
        R.q.copy(cq).multiply(qAxis(_q, AX, 1.3)).multiply(qAxis(_q, AY, -0.8));
      } else {
        const drive = anim.info.seated > 0.5;
        R.p.copy(this.cp(0.15, drive ? -0.06 : -0.16, -0.38 + 0.02 * wob, _v));
        L.p.copy(this.cp(-0.15, drive ? -0.06 : -0.16, -0.38 - 0.02 * wob, _v));
        R.q.copy(cq).multiply(qAxis(_q, AX, 1.45)).multiply(qAxis(_q, AY, -0.3));
        L.q.copy(cq).multiply(qAxis(_q, AX, 1.45)).multiply(qAxis(_q, AY, 0.3));
      }
      w = env(t, 0.15, 0.85);
    }
    // Blend from the hanging arms into the gesture.
    this._clavicles(pose, null, null);
    this._swingArm(pose, 1);
    this._swingArm(pose, -1);
    const hang = [pose.q[B.upperArmR].clone(), pose.q[B.forearmR].clone(), pose.q[B.handR].clone(), pose.q[B.upperArmL].clone(), pose.q[B.forearmL].clone(), pose.q[B.handL].clone()];
    this._clavicles(pose, R.p, L.p);
    this._solveArm(pose, 1, R, _v.set(0.6, -0.8, 0.3).applyQuaternion(cq));
    this._solveArm(pose, -1, L, _v.set(-0.6, -0.8, 0.3).applyQuaternion(cq));
    const bones = [B.upperArmR, B.forearmR, B.handR, B.upperArmL, B.forearmL, B.handL];
    bones.forEach((b, i) => pose.q[b].slerp(hang[i], 1 - w));
    for (const sh of [B.shoulderR, B.shoulderL]) pose.q[sh].slerp(_q.identity(), 1 - w);
    anim.mp.fk(pose);
    return true;
  }

  // Support hand on the gun: at gripL, or slid back along the fore-end toward
  // the receiver until the arm can reach it.
  _reachGrip(G, out) {
    const info = this.info,
      mp = this.anim.mp;
    const sh = mp.p[B.upperArmL];
    const reach = (0.306 + 0.266) * 0.985;
    const slideMax = info.kind === 'pistol' ? 0 : Math.min(0.32, Math.max(0, info.anchors.gripR.z - info.anchors.gripL.z - 0.12));
    const t = this._tSlide || (this._tSlide = new THREE.Vector3());
    for (let k = 0; k <= 8; k++) {
      const slide = (slideMax * k) / 8;
      t.copy(info.tLG).sub(_v2.set(0, 0, slide).applyQuaternion(info.qLG));
      out.q.copy(G.q).multiply(_q.copy(info.qLG).invert());
      out.p.copy(t).applyQuaternion(out.q).negate().add(G.p);
      if (out.p.distanceTo(sh) <= reach) break;
    }
    this.tLGcur = t;
    return out;
  }

  _handXf(side, out) {
    const mp = this.anim.mp;
    const h = side > 0 ? B.handR : B.handL;
    out.q.copy(mp.q[h]);
    out.p.copy(mp.p[h]);
    return out;
  }

  // Animate the bolt part: keys [t, lift 0..1, back 0..1].
  _bolt(t, ks, lift = Math.PI / 2, throw_ = 0.09) {
    const info = this.info;
    const part = info?.boltPart;
    if (!part || !info.boltRest) return;
    let l = 0,
      b = 0;
    if (ks) {
      for (let i = 0; i < ks.length - 1; i++) {
        const [t0, l0, b0] = ks[i],
          [t1, l1, b1] = ks[i + 1];
        if (t >= t0 && t <= t1) {
          const f = smooth(t0, t1, t);
          l = lerp(l0, l1, f);
          b = lerp(b0, b1, f);
        }
      }
    }
    part.quaternion.copy(info.boltRest.q).multiply(qAxis(_q, AZ, l * lift));
    part.position.copy(info.boltRest.p).add(_v.set(0, 0, b * throw_));
  }
}
