// Procedural body animation for the soldier: a gait with planted feet (no foot
// sliding), strafing and backpedalling, crouch walk and kneeling, prone crawl,
// sitting, the aiming posture (upper-body twist, pitch, lean), breathing and the
// head look. Weapon handling is in soldierArms.js, death in soldierRagdoll.js.
import * as THREE from 'three';
import { B, BIND, LEN, Pose, ModelPose, solveTwoBone, setModelRotation } from './soldierRig.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const wrap = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
// Yaw of a horizontal direction: 0 = forward (-Z), positive = toward -X (left).
export const yawOf = (x, z) => Math.atan2(-x, -z);

export const AX = new THREE.Vector3(1, 0, 0);
export const AY = new THREE.Vector3(0, 1, 0);
export const AZ = new THREE.Vector3(0, 0, 1);
export const qAxis = (out, axis, a) => out.setFromAxisAngle(axis, a);

const ANKLE_H = BIND[B.footR].y;
const BALL = 0.12; // ankle to ball of the foot, forward
const LEG = LEN.thigh + LEN.shin;

const _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion(),
  _q3 = new THREE.Quaternion(),
  _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3();

class Foot {
  constructor(side) {
    this.side = side;
    this.planted = true;
    this.x = side * 0.105; // ground point under the ankle, root frame
    this.z = 0;
    this.h = 0; // height above the ground (swing)
    this.pitch = 0; // + = heel up
    this.u = 0; // swing progress
    this.sx = 0;
    this.sz = 0;
    this.sh = 0;
    this.sp = 0;
    this.swingT = 0.3;
    this.lift = 0.08;
    this.prevPsi = 0;
    this.landPitch = -0.15;
  }
}

export class SoldierAnimator {
  constructor() {
    this.pose = new Pose();
    this.mp = new ModelPose();
    this.poseB = new Pose();
    this.feet = [new Foot(-1), new Foot(1)];
    this.phase = 0;
    this.crawlPhase = 0;
    this.prevYaw = null;
    this.time = Math.random() * 10;
    this.lastIdleStep = 0;
    this.groundOffset = null; // (x, z) root frame -> ground height relative to the root
    this.sm = { vx: 0, vz: 0, speed: 0, aim: 0, sprint: 0, kneel: 0, hipYaw: 0, crawl: 0, seated: 0, moving: 0, pitch: 0, yaw: 0, lean: 0, stance: 0 };
    // Targets the arms code may use.
    this.ankleT = [new THREE.Vector3(), new THREE.Vector3()];
    this.footQ = [new THREE.Quaternion(), new THREE.Quaternion()];
    this.kneePole = [new THREE.Vector3(), new THREE.Vector3()];
    this.info = { prone: 0, seated: 0, kneel: 0, crouch: 0, run: 0 };
  }

  reset() {
    for (const f of this.feet) {
      f.planted = true;
      f.x = f.side * 0.105;
      f.z = 0;
      f.h = 0;
      f.pitch = 0;
    }
    this.prevYaw = null;
  }

  // Body pose (everything except the arms and head look).
  body(dt, s) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.time += dt;
    const sm = this.sm;
    sm.vx = damp(sm.vx, s.localVelX || 0, 12, dt);
    sm.vz = damp(sm.vz, s.localVelZ || 0, 12, dt);
    sm.speed = Math.hypot(sm.vx, sm.vz);
    sm.moving = damp(sm.moving, sm.speed > 0.15 ? 1 : 0, 6, dt);
    sm.aim = damp(sm.aim, s.aiming ? 1 : 0, 9, dt);
    sm.sprint = damp(sm.sprint, s.sprinting && sm.speed > 2.5 ? 1 : 0, 6, dt);
    sm.seated = s.seated ? Math.min(1, sm.seated + dt * 4) : Math.max(0, sm.seated - dt * 4);
    sm.pitch = clamp(s.aimPitch || 0, -1.4, 1.4);
    sm.yaw = clamp(s.aimYawOffset || 0, -1.2, 1.2);
    sm.lean = clamp(s.lean || 0, -1, 1);
    const stance = clamp(s.stanceBlend ?? s.stance ?? 0, 0, 2);
    sm.stance = stance;
    sm.kneel = damp(sm.kneel, stance > 0.5 && sm.speed < 0.35 ? 1 : 0, 5, dt);
    sm.crawl = damp(sm.crawl, stance > 1.5 && sm.speed > 0.1 ? 1 : 0, 5, dt);
    sm.air = damp(sm.air || 0, s.onGround === false && !s.seated ? 1 : 0, 10, dt);

    // Root yaw change: planted feet stay put in the world.
    const yaw = s.yaw || 0;
    const dyaw = this.prevYaw === null ? 0 : wrap(yaw - this.prevYaw);
    this.prevYaw = yaw;
    if (dyaw) {
      const c = Math.cos(-dyaw),
        sn = Math.sin(-dyaw);
      for (const f of this.feet) {
        const rot = (x, z) => [x * c + z * sn, -x * sn + z * c];
        [f.x, f.z] = rot(f.x, f.z);
        [f.sx, f.sz] = rot(f.sx, f.sz);
      }
    }

    const info = this.info;
    info.prone = smooth(1, 2, stance);
    info.crouch = Math.min(1, stance);
    info.seated = sm.seated;
    const pose = this.pose;
    if (sm.seated >= 1) {
      this._seated(pose);
    } else if (stance >= 2 && sm.seated <= 0) {
      this._prone(pose, dt);
    } else {
      const c = Math.min(1, stance);
      this._gait(dt, c);
      this._upright(pose, c);
      if (stance > 1) {
        this._prone(this.poseB, dt);
        pose.blend(pose, this.poseB, smooth(1, 2, stance));
      }
      if (sm.seated > 0) {
        this._seated(this.poseB);
        pose.blend(pose, this.poseB, smooth(0, 1, sm.seated));
      }
    }
    this.mp.fk(pose);
    this._aimTorso(pose);
    return pose;
  }

  // -------------------------------------------------------------------------
  _gaitParams(c) {
    const sm = this.sm;
    const v = sm.speed;
    const run = smooth(1.9, 3.3, v) * (1 - c);
    const sprint = sm.sprint * (1 - c);
    // Steps per second: walking ~2.0 at 1.5 m/s, running ~2.8 at 3.7, sprinting ~3.4 at 6.1.
    const cadUp = v < 2.5 ? 1.25 + 0.5 * v : 2.5 + 0.25 * (v - 2.5);
    const cad = lerp(cadUp, 1.5 + 0.7 * v, c);
    const T = 2 / Math.max(0.8, cad);
    return {
      v,
      run,
      sprint,
      T,
      duty: lerp(lerp(0.6, 0.34, run) - 0.05 * sprint, lerp(0.64, 0.55, smooth(1, 2.2, v)), c),
      land: lerp(lerp(0.37, 0.3, run), 0.42, c), // where the foot lands, as a fraction of the stance travel
      lift: lerp(lerp(0.09, 0.26, run) + 0.12 * sprint, 0.11, c),
      heelOff: lerp(lerp(0.85, 1.1, run) + 0.1 * sprint, 0.55, c),
      heelStart: lerp(0.45, 0.3, run),
      landPitch: lerp(lerp(-0.25, -0.05, run), -0.12, c),
    };
  }

  _rest(i, c, out) {
    const sm = this.sm;
    const side = this.feet[i].side;
    const blade = sm.aim * (1 - sm.moving) * (1 - c);
    const x = side * (0.105 + 0.03 * c);
    const z = (side < 0 ? -0.02 : 0.03) * (1 - blade) + (side < 0 ? -0.1 : 0.1) * blade;
    const cy = Math.cos(sm.hipYaw),
      sy = Math.sin(sm.hipYaw);
    out.x = x * cy + z * sy;
    out.z = -x * sy + z * cy;
    return out;
  }

  _gait(dt, c) {
    const sm = this.sm;
    const g = (this.g = this._gaitParams(c));
    const v = g.v;
    // Lower body faces along the movement (strafing / backpedalling); bladed when aiming still.
    let hy;
    if (v > 0.15) {
      let d = yawOf(sm.vx, sm.vz);
      if (Math.abs(d) > Math.PI / 2 + 0.25) d = wrap(d - Math.PI);
      hy = clamp(d, -0.8, 0.8) * smooth(0.15, 0.8, v);
    } else hy = -0.42 * sm.aim * (1 - c * 0.3);
    sm.hipYaw = damp(sm.hipYaw, hy, 6, dt);

    const moving = v > 0.12;
    if (moving && !this._wasMoving) {
      // Start with the foot that is further behind.
      const f0 = this.feet[0],
        f1 = this.feet[1];
      const back0 = f0.x * sm.vx + f0.z * sm.vz,
        back1 = f1.x * sm.vx + f1.z * sm.vz;
      this.phase = back0 < back1 ? g.duty - 0.02 : (g.duty + 0.5 - 0.02) % 1;
      for (const f of this.feet) f.prevPsi = (this.phase + (f.side > 0 ? 0.5 : 0)) % 1;
    }
    this._wasMoving = moving;
    if (moving) this.phase = (this.phase + dt / g.T) % 1;
    const rest = this._restA || (this._restA = { x: 0, z: 0 });
    const restO = this._restB || (this._restB = { x: 0, z: 0 });
    const stanceT = g.duty * g.T;
    let swinging = 0;
    for (const f of this.feet) if (!f.planted) swinging++;
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      this._rest(i, c, rest);
      const psi = (this.phase + (i ? 0.5 : 0)) % 1;
      if (f.planted) {
        f.x -= sm.vx * dt;
        f.z -= sm.vz * dt;
        let lift = false;
        if (moving) {
          if (f.prevPsi < g.duty && psi >= g.duty) lift = true;
          const roll = g.heelOff * Math.pow(smooth(g.duty * g.heelStart, g.duty, Math.min(psi, g.duty)), 1.5);
          f.pitch = Math.max(roll, f.pitch * (psi > g.duty * 0.5 ? 1 : 0));
          if (psi < 0.1) f.pitch = lerp(f.landPitch, 0, smooth(0, 0.1, psi));
        } else {
          f.pitch = damp(f.pitch, 0, 12, dt);
          const off = Math.hypot(f.x - rest.x, f.z - rest.z);
          const other = this.feet[1 - i];
          this._rest(1 - i, c, restO);
          const otherOff = Math.hypot(other.x - restO.x, other.z - restO.z);
          if (off > 0.07 && swinging === 0 && other.planted && this.time - this.lastIdleStep > 0.18 && off >= otherOff - 0.01) {
            lift = true;
            this.lastIdleStep = this.time;
          }
        }
        if (lift) {
          f.planted = false;
          f.u = 0;
          f.sx = f.x;
          f.sz = f.z;
          f.sh = f.h;
          f.sp = f.pitch;
          f.swingT = moving ? Math.max(0.12, (1 - g.duty) * g.T) : 0.3;
          f.lift = moving ? g.lift : 0.06;
          f.landPitch = moving ? g.landPitch : -0.05;
          swinging++;
          // Heel-off: start the swing from the lifted ankle position.
          if (f.pitch > 0) {
            const fy = sm.hipYaw;
            const fwdX = -Math.sin(fy),
              fwdZ = -Math.cos(fy);
            const dx = BALL - (BALL * Math.cos(f.pitch) - (ANKLE_H * Math.sin(f.pitch)));
            f.sx += fwdX * dx;
            f.sz += fwdZ * dx;
            f.sh = BALL * Math.sin(f.pitch) + ANKLE_H * Math.cos(f.pitch) - ANKLE_H;
          }
        }
      } else {
        f.u = Math.min(1, f.u + dt / f.swingT);
        const tx = rest.x + (moving ? sm.vx * stanceT * g.land : 0);
        const tz = rest.z + (moving ? sm.vz * stanceT * g.land : 0);
        const e = smooth(0, 1, f.u);
        f.x = lerp(f.sx, tx, e);
        f.z = lerp(f.sz, tz, e);
        // Lift: the foot rises early (heel kicks up when running) and comes down softly.
        f.h = f.sh * (1 - e) + f.lift * Math.sin(Math.PI * Math.pow(f.u, lerp(0.85, 0.6, g.run)));
        f.pitch = lerp(f.sp, f.landPitch, smooth(0.15, 0.95, f.u)) + (moving ? 0.25 * g.run * Math.sin(Math.PI * f.u) : 0);
        if (f.u >= 1) {
          f.planted = true;
          f.h = 0;
        }
      }
      f.prevPsi = psi;
    }
  }

  // Standing / crouching (c = 0..1), including kneeling when crouched still.
  _upright(pose, c) {
    const sm = this.sm,
      g = this.g;
    const mp = this.mp;
    pose.reset();
    const run = g.run,
      sprint = g.sprint,
      v = g.v;
    const walk = smooth(0.1, 1.2, v) * (1 - run);
    const ph = this.phase * TAU;
    const mid = (this.phase - g.duty * 0.5) * TAU;
    const mov = sm.moving;
    const aimK = sm.aim;
    // Pelvis motion.
    const bob = (walk * 0.016 * Math.cos(2 * mid) - run * 0.03 * Math.cos(2 * mid) + run * 0.012) * mov;
    const swayX = -0.022 * walk * Math.cos(mid) * mov * (1 - c * 0.5);
    const yawOsc = (-0.1 * walk - 0.16 * run) * Math.cos(ph) * mov;
    const roll = -0.05 * walk * Math.cos(mid) * mov;
    let lean = 0.04 + 0.06 * walk + 0.16 * run * (1 - 0.5 * aimK) + 0.22 * sprint + c * (0.32 + 0.1 * mov);
    lean -= 0.03 * aimK;
    let h = lerp(0.95, 0.68, c) - 0.008 * walk - 0.03 * run - 0.02 * sprint + bob;
    const breath = Math.sin(this.time * 1.6) * 0.008;
    // Lean (peeking): hips shift the other way.
    const leanS = -sm.lean * 0.05;
    const cy = Math.cos(sm.yaw),
      sy = Math.sin(sm.yaw);
    pose.hips.set(swayX + leanS * cy, h, 0.03 * c - leanS * sy);
    const hq = pose.q[B.hips];
    hq.setFromAxisAngle(AY, sm.hipYaw + yawOsc);
    hq.multiply(qAxis(_q, AX, -0.25 * lean)).multiply(qAxis(_q2, AZ, roll));
    qAxis(pose.q[B.spine], AX, -0.3 * lean).premultiply(qAxis(_q, AY, -0.7 * yawOsc));
    qAxis(pose.q[B.chest], AX, -0.45 * lean + breath).premultiply(qAxis(_q, AY, -0.9 * yawOsc));

    // Feet targets.
    const k = sm.kneel * smooth(0.5, 1, c);
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      this._footTarget(i);
      const fy = sm.hipYaw - f.side * 0.08;
      // Knees forward and a bit out.
      this.kneePole[i].set(-Math.sin(fy) + f.side * 0.15, 0.05 + 0.3 * c, -Math.cos(fy));
    }
    if (k > 0.001) {
      // Kneeling on the right knee, left foot forward.
      const ky = -0.3 - 0.15 * aimK;
      const ck = Math.cos(ky),
        sk = Math.sin(ky);
      const rot = (x, y, z, out) => out.set(x * ck + z * sk, y, -x * sk + z * ck);
      rot(0.02, 0.49, 0.1, _v);
      pose.hips.lerp(_v, k);
      _q.setFromAxisAngle(AY, ky).multiply(qAxis(_q2, AX, -0.05));
      hq.slerp(_q, k);
      rot(-0.13, ANKLE_H, -0.3, _v);
      this.ankleT[0].lerp(_v, k);
      rot(0.15, 0.115, 0.33, _v);
      this.ankleT[1].lerp(_v, k);
      this.footQ[0].slerp(_q.setFromAxisAngle(AY, ky + 0.25), k);
      this.footQ[1].slerp(_q.setFromAxisAngle(AY, ky - 0.1).multiply(qAxis(_q2, AX, -1.2)), k);
      rot(0, 0.5, -1, _v);
      this.kneePole[0].lerp(_v, k);
      rot(0.1, -0.8, -0.6, _v);
      this.kneePole[1].lerp(_v, k);
      pose.q[B.spine].slerp(_q.setFromAxisAngle(AY, -0.5 * ky).multiply(qAxis(_q2, AX, -0.12)), k);
      if (k > 0.6) for (const f of this.feet) this._resetFoot(f, c);
    }
    // Off the ground (jumping, falling): feet tuck up under the body.
    const air = sm.air;
    if (air > 0.001) {
      for (let i = 0; i < 2; i++) {
        const f = this.feet[i];
        this._rest(i, c, this._restA || (this._restA = { x: 0, z: 0 }));
        _v.set(this._restA.x, ANKLE_H + 0.16 + (i ? 0.06 : 0), this._restA.z + (i ? 0.08 : -0.06));
        this.ankleT[i].lerp(_v, air);
        this.footQ[i].slerp(_q.setFromAxisAngle(AY, sm.hipYaw).multiply(qAxis(_q2, AX, -0.35)), air);
        if (air > 0.6) this._resetFoot(f, c);
      }
    }
    this._legs(pose, mp, k < 0.01 && air < 0.01);
  }

  _resetFoot(f, c) {
    const r = this._rest(f.side < 0 ? 0 : 1, c, { x: 0, z: 0 });
    f.x = r.x;
    f.z = r.z;
    f.planted = true;
    f.h = 0;
    f.pitch = 0;
  }

  // Leg IK to this.ankleT with reach clamping. A trailing planted foot first
  // rises onto its toes; only then do the hips come down.
  _legs(pose, mp, gait = false) {
    mp.fk(pose);
    const maxL = LEG * 0.995;
    if (gait) {
      const fy = this.sm.hipYaw;
      const fx = -Math.sin(fy),
        fz = -Math.cos(fy);
      for (let i = 0; i < 2; i++) {
        const f = this.feet[i];
        if (!f.planted) continue;
        const hip = mp.p[i ? B.thighR : B.thighL];
        const t = this.ankleT[i];
        if ((t.x - hip.x) * fx + (t.z - hip.z) * fz > -0.05) continue; // only feet behind the hip
        for (let k = 0; k < 8 && hip.distanceTo(t) > maxL && f.pitch < 1.3; k++) {
          f.pitch = Math.max(f.pitch, 0) + 0.12;
          this._footTarget(i);
        }
      }
    }
    let drop = 0;
    for (let i = 0; i < 2; i++) {
      const hip = mp.p[i ? B.thighR : B.thighL];
      const t = this.ankleT[i];
      const dxz = Math.hypot(t.x - hip.x, t.z - hip.z);
      const dy = hip.y - t.y;
      const need = dy - Math.sqrt(Math.max(0, maxL * maxL - dxz * dxz));
      if (need > drop) drop = need;
    }
    if (drop > 0) {
      pose.hips.y -= Math.min(drop, 0.5);
      mp.fk(pose);
    }
    for (let i = 0; i < 2; i++) {
      const th = i ? B.thighR : B.thighL;
      solveTwoBone(pose, mp, th, th + 1, this.ankleT[i], this.kneePole[i]);
      setModelRotation(pose, mp, th + 2, this.footQ[i]);
    }
    mp.fk(pose);
  }

  // Ankle target and foot rotation for a gait foot (heel-toe roll about the ball).
  _footTarget(i) {
    const sm = this.sm;
    const f = this.feet[i];
    const t = this.ankleT[i];
    const fy = sm.hipYaw - f.side * 0.08;
    const fwdX = -Math.sin(fy),
      fwdZ = -Math.cos(fy);
    const gy = this.groundOffset ? clamp(this.groundOffset(f.x, f.z), -0.35, 0.35) : 0;
    if (f.planted && f.pitch > 0) {
      const p = f.pitch;
      const ux = -BALL * Math.cos(p) + ANKLE_H * Math.sin(p);
      const uy = BALL * Math.sin(p) + ANKLE_H * Math.cos(p);
      t.set(f.x + fwdX * (BALL + ux), gy + uy, f.z + fwdZ * (BALL + ux));
    } else t.set(f.x, gy + ANKLE_H + f.h, f.z);
    this.footQ[i].setFromAxisAngle(AY, fy).multiply(qAxis(_q, AX, -f.pitch));
    return fwdX;
  }

  // -------------------------------------------------------------------------
  _prone(pose, dt) {
    const sm = this.sm;
    pose.reset();
    const crawl = sm.crawl;
    this.crawlPhase = (this.crawlPhase + (dt * sm.speed) / 0.9) % 1;
    const cp = this.crawlPhase * TAU;
    const sw = Math.sin(cp);
    const aim = sm.aim;
    pose.hips.set(0.03 * sw * crawl, 0.125, 0.13);
    const hq = pose.q[B.hips];
    hq.setFromAxisAngle(AY, 0.1 * sw * crawl).multiply(qAxis(_q, AX, -Math.PI / 2)).multiply(qAxis(_q2, AY, 0.1 * sw * crawl));
    qAxis(pose.q[B.spine], AX, 0.06 + 0.06 * aim).multiply(qAxis(_q, AZ, -0.08 * sw * crawl));
    qAxis(pose.q[B.chest], AX, 0.1 + 0.22 * aim).multiply(qAxis(_q, AZ, -0.1 * sw * crawl));
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const u = Math.max(0, side * sw) * crawl; // this leg pulls up
      const t = this.ankleT[i];
      t.set(side * (0.2 + 0.1 * u), 0.085 + 0.02 * u, 0.97 - 0.42 * u);
      this.kneePole[i].set(side * (0.35 + 1.2 * u), -1, 0.1);
      this.footQ[i].setFromAxisAngle(AZ, side * (0.8 + 0.4 * u)).multiply(qAxis(_q, AX, -Math.PI / 2 - 0.45));
    }
    this._legs(pose, this.mp);
  }

  // Sitting: the root is the seat point under the buttocks, feet 0.42 m below.
  _seated(pose) {
    pose.reset();
    pose.hips.set(0, 0.11, 0.03);
    pose.q[B.hips].setFromAxisAngle(AX, 0.12);
    qAxis(pose.q[B.spine], AX, -0.1);
    qAxis(pose.q[B.chest], AX, -0.06 + Math.sin(this.time * 1.6) * 0.008);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      this.ankleT[i].set(side * 0.125, -0.42 + ANKLE_H, -0.43);
      this.kneePole[i].set(side * 0.1, 0.6, -1);
      this.footQ[i].setFromAxisAngle(AY, -side * 0.12);
    }
    this._legs(pose, this.mp);
  }

  // -------------------------------------------------------------------------
  // Upper body: twist toward the aim, pitch with it, lean around corners.
  _aimTorso(pose) {
    const sm = this.sm,
      mp = this.mp;
    const prone = this.info.prone;
    // Twist: chest faces the aim (bladed a little when shouldering a weapon).
    const blade = (this.bladeAngle ?? 0.35) * sm.aim * (1 - prone);
    const target = sm.yaw - blade;
    _v.set(0, 0, -1).applyQuaternion(mp.q[B.chest]);
    let cur = yawOf(_v.x, _v.z);
    if (prone > 0.5) {
      // Lying down the chest's forward points down; use its up axis instead.
      _v.set(0, 1, 0).applyQuaternion(mp.q[B.chest]);
      cur = yawOf(_v.x, _v.z);
    }
    let d = wrap(target - cur);
    const lim = lerp(1.3, 0.45, prone);
    d = clamp(d, -lim, lim);
    this._rotateModel(pose, B.spine, qAxis(_q3, AY, d * 0.4));
    this._rotateModel(pose, B.chest, qAxis(_q3, AY, d * 0.6));
    // Pitch about the aim's lateral axis.
    const share = lerp(0.3 + 0.25 * sm.aim, 0.25, prone) * (1 - 0.5 * this.info.seated * 0);
    _v2.set(Math.cos(sm.yaw), 0, -Math.sin(sm.yaw));
    const p = sm.pitch * share;
    this._rotateModel(pose, B.spine, _q3.setFromAxisAngle(_v2, p * 0.4));
    this._rotateModel(pose, B.chest, _q3.setFromAxisAngle(_v2, p * 0.6));
    // Lean: roll about the aim's forward axis.
    if (Math.abs(sm.lean) > 0.001) {
      _v2.set(-Math.sin(sm.yaw), 0, -Math.cos(sm.yaw));
      const L = sm.lean * 0.3 * (1 - prone);
      this._rotateModel(pose, B.spine, _q3.setFromAxisAngle(_v2, L));
      this._rotateModel(pose, B.chest, _q3.setFromAxisAngle(_v2, L));
    }
  }

  // Rotate a bone in model space (about its own pivot) and refresh the model pose.
  _rotateModel(pose, bone, dq) {
    const mp = this.mp;
    _q.multiplyQuaternions(dq, mp.q[bone]);
    setModelRotation(pose, mp, bone, _q);
    mp.fk(pose);
  }

  // Head looks along the aim; with a shouldered weapon the head tilts onto the
  // stock and the neck bends to bring the right eye onto the sight line.
  head(pose, sightLine = null, weld = 0) {
    const sm = this.sm,
      mp = this.mp;
    const prone = this.info.prone;
    const look = _q.setFromAxisAngle(AY, sm.yaw).multiply(qAxis(_q2, AX, sm.pitch));
    if (weld > 0) look.multiply(qAxis(_q2, AZ, -0.22 * weld)).multiply(qAxis(_q2, AX, -0.1 * weld));
    // Neck takes part of the turn.
    _q3.copy(mp.q[B.chest]).slerp(look, 0.45);
    setModelRotation(pose, mp, B.neck, _q3);
    mp.fk(pose);
    const lookQ = this._lookQ || (this._lookQ = new THREE.Quaternion());
    lookQ.copy(look);
    setModelRotation(pose, mp, B.head, lookQ);
    mp.fk(pose);
    if (sightLine && weld > 0.01) {
      // Bring the eye to the line (two iterations).
      for (let it = 0; it < 2; it++) {
        const eye = mp.point(B.head, EYE_BIND, _v);
        const { p, d } = sightLine;
        _v2.copy(eye).sub(p);
        const along = _v2.dot(d);
        _v3.copy(p).addScaledVector(d, along).add(EYE_ABOVE).sub(eye); // error
        const lever = _v2.copy(eye).sub(mp.p[B.neck]);
        const len = lever.length();
        const axis = _v2.cross(_v3);
        const al = axis.length();
        if (al < 1e-7) break;
        const ang = Math.min(_v3.length() / len, 0.45) * weld;
        this._rotateModel(pose, B.neck, _q3.setFromAxisAngle(axis.divideScalar(al), ang));
        setModelRotation(pose, mp, B.head, lookQ);
        mp.fk(pose);
      }
    }
  }
}
const EYE_BIND = new THREE.Vector3(0.032, 1.648, -0.084);
const EYE_ABOVE = new THREE.Vector3(0, 0.012, 0);
