// A rigid body (vehicle hull) with full 3D motion: forces and torques applied at
// points produce linear and angular acceleration through the mass and the
// inertia tensor (a box approximation of the real mass distribution).
// No graphics code: plain numbers so it can be tested in Node.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix3();

export class RigidBody {
  // dims: box size [x, y, z] (m) used to estimate the inertia tensor.
  constructor(mass, dims, inertiaScale = 1) {
    this.mass = mass;
    this.invMass = 1 / mass;
    const [x, y, z] = dims;
    // Solid box inertia (kg m^2) in the body frame; inertiaScale accounts for mass
    // being concentrated low/centrally (engine, armor) rather than uniform.
    this.Ibody = new THREE.Vector3((mass / 12) * (y * y + z * z), (mass / 12) * (x * x + z * z), (mass / 12) * (x * x + y * y)).multiplyScalar(inertiaScale);
    this.IbodyInv = new THREE.Vector3(1 / this.Ibody.x, 1 / this.Ibody.y, 1 / this.Ibody.z);
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.angular = new THREE.Vector3(); // world-space angular velocity (rad/s)
    this.force = new THREE.Vector3();
    this.torque = new THREE.Vector3();
    this.rot = new THREE.Matrix3();
    this.invInertiaWorld = new THREE.Matrix3();
    this.sleeping = false;
    this.updateDerived();
  }

  updateDerived() {
    this.rot.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(this.quaternion));
    // I_world^-1 = R * I_body^-1 * R^T
    const R = this.rot.elements; // column-major
    const d = this.IbodyInv;
    const e = this.invInertiaWorld.elements;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        // sum_k R[i][k] * d[k] * R[j][k]
        e[j * 3 + i] = R[0 * 3 + i] * d.x * R[0 * 3 + j] + R[1 * 3 + i] * d.y * R[1 * 3 + j] + R[2 * 3 + i] * d.z * R[2 * 3 + j];
      }
    }
  }

  // Body-frame vector -> world (direction only).
  toWorldDir(v, out = new THREE.Vector3()) {
    return out.copy(v).applyQuaternion(this.quaternion);
  }

  toWorldPoint(v, out = new THREE.Vector3()) {
    return out.copy(v).applyQuaternion(this.quaternion).add(this.position);
  }

  // Velocity of a world-space point attached to the body.
  pointVelocity(p, out = new THREE.Vector3()) {
    _v.copy(p).sub(this.position);
    return out.crossVectors(this.angular, _v).add(this.velocity);
  }

  applyForce(f, p = null) {
    this.force.add(f);
    if (p) {
      _v.copy(p).sub(this.position);
      this.torque.add(_v2.crossVectors(_v, f));
    }
  }

  applyImpulse(j, p) {
    this.velocity.addScaledVector(j, this.invMass);
    _v.copy(p).sub(this.position);
    _v2.crossVectors(_v, j).applyMatrix3(this.invInertiaWorld);
    this.angular.add(_v2);
  }

  // Effective mass along a direction at a contact point (for impulses).
  effectiveMass(p, n) {
    _v.copy(p).sub(this.position);
    _v2.crossVectors(_v, n).applyMatrix3(this.invInertiaWorld);
    const k = this.invMass + n.dot(new THREE.Vector3().crossVectors(_v2, _v));
    return 1 / k;
  }

  integrate(dt) {
    // Linear.
    this.velocity.addScaledVector(this.force, this.invMass * dt);
    this.position.addScaledVector(this.velocity, dt);
    // Angular: dw = I^-1 (T - w x (I w)) dt (gyroscopic term included).
    _m.copy(this.rot);
    const Iw = _v.copy(this.angular).applyMatrix3(_m.clone().transpose()); // body frame
    Iw.multiply(this.Ibody).applyMatrix3(_m); // back to world: I w
    const gyro = _v2.crossVectors(this.angular, Iw);
    const t = this.torque.clone().sub(gyro).applyMatrix3(this.invInertiaWorld);
    this.angular.addScaledVector(t, dt);
    // Orientation: q += 0.5 * (w, 0) * q * dt
    const w = this.angular;
    const q = this.quaternion;
    const qx = q.x,
      qy = q.y,
      qz = q.z,
      qw = q.w;
    q.x += 0.5 * dt * (w.x * qw + w.y * qz - w.z * qy);
    q.y += 0.5 * dt * (w.y * qw + w.z * qx - w.x * qz);
    q.z += 0.5 * dt * (w.z * qw + w.x * qy - w.y * qx);
    q.w += 0.5 * dt * (-w.x * qx - w.y * qy - w.z * qz);
    q.normalize();
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
    this.updateDerived();
  }
}
