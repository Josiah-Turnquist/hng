// Wheeled vehicles (jeeps and field cars): engine with a real torque curve, a
// manual gearbox shifted for you (with the slow shifts of the period), brakes,
// and tires with a Pacejka-style grip curve that depends on the ground (dry road,
// grass, mud, sand...).
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { clamp, approach } from '../core/math.js';

const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _wr = new THREE.Vector3();
const _q = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

// Simplified Pacejka "magic formula": normalized tire force for a slip value.
export function magic(x, B, C, E) {
  const bx = B * x;
  return Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
}

export class WheeledVehicle extends Vehicle {
  constructor(game, def, model, x, z, yaw) {
    super(game, def, model, x, z, yaw);
    const r = def.wheelRadius;
    const hw = def.track / 2;
    const hb = def.wheelbase / 2;
    const parts = model.parts || {};
    const s = def.suspension;
    const driveFront = def.driven === 'all' || def.driven === 'front';
    const driveRear = def.driven === 'all' || def.driven === 'rear';
    for (const [name, fx, fz, front] of [
      ['wheelFL', -hw, -hb, true],
      ['wheelFR', hw, -hb, true],
      ['wheelRL', -hw, hb, false],
      ['wheelRR', hw, hb, false],
    ]) {
      const p = parts[name]?.position;
      const w = this.addWheel({
        pos: p ? [p.x, p.y, p.z] : [fx, r, fz],
        radius: r,
        k: s.k,
        c: s.c,
        side: fx < 0 ? -1 : 1,
        steer: front ? 1 : 0,
        driven: front ? driveFront : driveRear,
        part: parts[name] || null,
      });
      w.front = front;
    }
    this.finishSuspension();
    // Rotating parts (engine flywheel, wheels) that the engine has to spin up.
    this.wheelInertia = 4 * 0.6 * def.wheelMass * r * r;

    // Hull collision spheres around the body (relative to the center of mass).
    const [W, , L] = def.dims;
    const [cx, cy, cz] = def.cg;
    for (const sx of [-1, 1])
      for (const sz of [-1, -0.33, 0.33, 1]) {
        const ex = sx * (W / 2 - 0.25) - cx;
        const ez = sz * (L / 2 - 0.25) - cz;
        this.samples.push({ p: new THREE.Vector3(ex, 0.5 - cy, ez), r: 0.25 });
        this.samples.push({ p: new THREE.Vector3(ex * 0.95, 1.0 - cy, ez * 0.95), r: 0.3 });
      }
    this.wheelSpin = 0;
    this.clutchSlip = 0;
    this.setupArmor();
    this.setupProxies();
  }

  _drive(dt) {
    const d = this.def;
    const b = this.body;
    const inp = this.input;
    // Steering: rate-limited, and drivers use less lock at speed.
    const speedK = 1 / (1 + Math.abs(this.speed) / 12);
    this.steer = approach(this.steer, inp.steer * speedK, dt * 2.4);

    // Engine and gearbox.
    const groundSpeed = this.wheelSpin * d.wheelRadius;
    const ratio = this._engineRpm(groundSpeed, d.wheelRadius, inp.throttle, dt);
    const broken = this.modules.transmission <= 0;
    let engineTorque = broken ? 0 : this._engineTorque(inp.throttle);
    // Off the throttle in gear the engine holds the vehicle back.
    let engineBrake = 0;
    if (inp.throttle < 0.05 && ratio !== 0 && !broken && this.engineOn) {
      const over = clamp((this.rpm - d.engine.idle * 1.3) / 600, 0, 1);
      engineBrake = -0.14 * torqueMax(d) * over * Math.sign(groundSpeed || this.speed || 1) * Math.sign(ratio);
    }
    const wheelTorque = (engineTorque + engineBrake) * ratio * d.efficiency;
    // Part of the force goes into spinning up the engine and wheels.
    const rotMass = (d.engine.inertia * ratio * ratio + this.wheelInertia) / (d.wheelRadius * d.wheelRadius);
    const share = d.mass / (d.mass + rotMass);
    const driven = this.wheels.filter((w) => w.driven).length;
    const perWheel = driven ? (wheelTorque * share) / driven : 0;
    this.load = clamp(Math.abs(engineTorque) / torqueMax(d), 0, 1);

    _fwd.set(0, 0, -1).applyQuaternion(b.quaternion);
    let slipSum = 0;
    let spinSum = 0;
    let n = 0;
    for (const w of this.wheels) {
      // Ackermann steering: the inner front wheel turns more.
      let steerAngle = 0;
      if (w.steer) {
        const a = -this.steer * d.steerMax;
        if (Math.abs(a) > 1e-4) {
          const R = d.wheelbase / Math.tan(Math.abs(a));
          const inner = (a > 0 && w.side < 0) || (a < 0 && w.side > 0);
          steerAngle = Math.sign(a) * Math.atan(d.wheelbase / (R + (inner ? -1 : 1) * (d.track / 2)));
        }
      }
      w.steerAngle = steerAngle;
      if (!w.onGround || w.fz <= 0) {
        w.slip = 0;
        w.spin = approach(w.spin, w.driven ? (perWheel / w.radius) * 0.02 : w.spin * 0.98, dt * 40);
        continue;
      }
      // Wheel heading on the ground plane.
      _q.setFromAxisAngle(Y, steerAngle);
      const wf = _v.copy(_fwd).applyQuaternion(_q);
      wf.addScaledVector(w.normal, -wf.dot(w.normal)).normalize();
      const wr = _wr.crossVectors(wf, w.normal).normalize();
      const p = w.contactNow;
      b.pointVelocity(p, _vel);
      const vLong = _vel.dot(wf);
      const vLat = _vel.dot(wr);
      const surf = this.surfaceAt(w);
      const mu = surf.mu * (this.waterDepth > 0.3 ? 0.75 : 1);
      const Fz = Math.min(w.fz, w.load * 3);
      const maxF = mu * Fz;

      // Along the wheel: drive torque, brakes and rolling resistance.
      let fx = w.driven ? perWheel / w.radius : 0;
      let brake = inp.brake * d.brakeForce * (w.front ? 0.3 : 0.2);
      if (inp.handbrake && !w.front) brake = Math.max(brake, d.brakeForce * 0.35);
      // Stopped with no input: the driver (or the parking brake) holds it still.
      if (inp.throttle < 0.05 && Math.abs(this.speed) < 0.5) brake = Math.max(brake, d.brakeForce * 0.25);
      const stopF = (Math.abs(vLong) * d.mass) / dt / 4; // force that would stop this corner this step
      fx -= Math.sign(vLong) * Math.min(brake, stopF);
      fx -= Math.sign(vLong) * Math.min(stopF, surf.roll * Fz);
      // Across the wheel: slip angle through the tire curve. Old bias-ply tires
      // peak at about 10 degrees of slip and hold most of their grip beyond it.
      const slipAngle = Math.atan2(vLat, Math.abs(vLong) + 0.8);
      let fy = -maxF * magic(slipAngle, 9, 1.9, 0.95);
      if (Math.abs(vLong) < 2) {
        // At walking pace the slip angle is meaningless: plain sideways friction.
        const lowF = clamp((-vLat * d.mass) / dt / 4 * 0.5, -maxF, maxF);
        const t = Math.abs(vLong) / 2;
        fy = lowF * (1 - t) + fy * t;
      }
      // Friction circle: drive/brake and cornering share the same grip.
      const total = Math.hypot(fx, fy);
      let slip = 0;
      if (total > maxF && total > 0) {
        slip = 1 - maxF / total;
        fx *= maxF / total;
        fy *= maxF / total;
      }
      w.slip = slip;
      slipSum += slip;
      b.applyForce(_v.copy(wf).multiplyScalar(fx).addScaledVector(wr, fy), p);
      // Wheel speed: rolling, plus wheelspin or lock-up when grip runs out.
      let spin = vLong / w.radius;
      if (slip > 0.05 && w.driven && Math.abs(perWheel) > 1) spin += Math.sign(perWheel) * slip * 12;
      if (brake > maxF * 1.1 && slip > 0.2) spin *= 0.2; // locked wheel
      w.spin = spin;
      if (w.driven) {
        spinSum += spin;
        n++;
      }
    }
    this.wheelSpin = n ? spinSum / n : this.speed / d.wheelRadius;
    this.slipping = slipSum / Math.max(1, this.wheels.length);
    this._shift(dt);
  }

  syncModel(dt = 0) {
    super.syncModel();
    for (const w of this.wheels) {
      if (!w.part) continue;
      w.angle += w.spin * dt;
      // Suspension travel moves the wheel up and down relative to the body.
      const travel = w.compression - w.droop;
      w.part.position.set(w.model.x, w.model.y + clamp(travel, -w.droop, w.bump + 0.05), w.model.z);
      w.part.rotation.set(-w.angle, w.steerAngle, 0, 'YXZ');
    }
    const sw = this.model.parts?.steeringWheel;
    if (sw) sw.rotation.z = -this.steer * 2.4;
    this.model.root.updateMatrixWorld(true);
    this.updateArmor();
  }
}

function torqueMax(d) {
  return d._tmax || (d._tmax = Math.max(...d.engine.torque.map((p) => p[1])));
}
