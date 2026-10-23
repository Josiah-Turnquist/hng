// Real sight alignment and zeroing.
//
// When aiming, the eye looks along the line through the rear sight and the front
// sight (or through a scope). The barrel is not parallel to that line: it points
// slightly upward so the bullet, which starts below the line of sight and falls
// under gravity, crosses the line of sight exactly at the set range. Changing the
// range setting raises the rear sight (tangent leaf, sliding aperture) or turns the
// scope's elevation drum, which tilts the barrel further up.
//
// For each weapon and range setting we solve the bore elevation with the real
// ballistics (solver.js), then work out how far the rear sight must be raised.
import * as THREE from 'three';
import { solveZero } from '../ballistics/solver.js';

const X = new THREE.Vector3(1, 0, 0);

export class Sighting {
  // gun: built model { anchors, parts, meta }; def: weapon definition; atm: Atmosphere
  constructor(gun, def, atm) {
    this.def = def;
    this.gun = gun;
    const a = gun.anchors;
    this.kind = def.sight.kind;
    this.front = a.frontSight ? a.frontSight.clone() : new THREE.Vector3(0, 0.025, -0.5);
    this.rear = a.rearSight ? a.rearSight.clone() : new THREE.Vector3(0, 0.025, -0.1);
    this.scopeEye = a.scopeEye ? a.scopeEye.clone() : null;
    this.scopeFront = a.scopeFront ? a.scopeFront.clone() : null;
    this.part = gun.parts.rearSight || null;
    this.pivot = this.part ? this.part.position.clone() : null;
    this.sightKind = gun.meta.sightKind || (this.part ? 'leaf' : 'fixed');
    if (this.kind === 'scope' && this.scopeEye) this.sightKind = 'scope';
    else if (this.kind === 'post' || this.kind === 'scope') this.sightKind = 'virtual';

    // Height of the line of sight above the bore at the muzzle.
    const sightHeight = this.kind === 'scope' && this.scopeFront ? this.scopeFront.y : this.front.y;
    this.sightHeight = Math.max(0.005, sightHeight);
    // Bore elevation for every range setting.
    this.angles = def.sight.ranges.map((r) => solveZero(def.ammoData, def.mv, this.sightHeight, r, atm));
    // Line-of-sight angle the sights give at rest (for fixed sights this is the zero).
    this.restAngle = Math.atan2(this.rear.y - this.front.y, this.rear.z - this.front.z);

    // Eye distance behind the rear sight (cheek on the stock, or arms extended).
    const shoulder = a.shoulder;
    if (this.sightKind === 'scope') this.eyeRelief = 0.085;
    else if (!shoulder) this.eyeRelief = 0.55; // pistols held at arm's length
    else if (this.kind === 'aperture') this.eyeRelief = Math.max(0.05, Math.min(0.12, shoulder.z - 0.2 - this.rear.z));
    else this.eyeRelief = Math.max(0.08, Math.min(0.5, shoulder.z - 0.17 - this.rear.z));
    if (def.type === 'launcher') this.eyeRelief = 0.12;

    this.state = { leaf: 0, slide: 0, extra: 0 };
    this.losDir = new THREE.Vector3(0, 0, -1);
    this.eye = new THREE.Vector3();
    this.rearNow = this.rear.clone();
  }

  // Rear sight position after raising the leaf by angle phi / sliding by h.
  _rearAt(phi, h) {
    const r = this.rear.clone();
    if (this.sightKind === 'leaf' && this.pivot) {
      r.sub(this.pivot).applyAxisAngle(X, phi).add(this.pivot);
    } else if (this.sightKind === 'slide') {
      r.y += h;
    }
    return r;
  }

  // Configure for range setting index i: moves the rear sight part and computes
  // the line of sight and eye position in gun space.
  setRangeIndex(i) {
    const theta = this.angles[Math.max(0, Math.min(this.angles.length - 1, i))];
    this.theta = theta;
    const F = this.front;
    if (this.sightKind === 'leaf') {
      // Find the leaf angle where the line rear -> front sits theta below the bore.
      // Works whichever way the leaf is hinged (search both directions).
      const angAt = (phi) => {
        const R = this._rearAt(phi, 0);
        return Math.atan2(R.y - F.y, R.z - F.z);
      };
      let lo = -1.3,
        hi = 1.3;
      const rising = angAt(0.05) > angAt(-0.05);
      if (rising) lo = -0.25;
      else hi = 0.25;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (angAt(mid) < theta === rising) lo = mid;
        else hi = mid;
      }
      this.state.leaf = (lo + hi) / 2;
      if (this.part) this.part.rotation.x = this.state.leaf;
      this.rearNow.copy(this._rearAt(this.state.leaf, 0));
      this.losDir.copy(F).sub(this.rearNow).normalize();
      this.state.extra = 0;
    } else if (this.sightKind === 'slide') {
      const h = F.y + (this.rear.z - F.z) * Math.tan(theta) - this.rear.y;
      this.state.slide = h;
      if (this.part) this.part.position.y = this.pivot.y + h;
      this.rearNow.copy(this._rearAt(0, h));
      this.losDir.copy(F).sub(this.rearNow).normalize();
      this.state.extra = 0;
    } else if (this.sightKind === 'scope') {
      // The scope's elevation drum tilts the line of sight inside the scope.
      const base = Math.atan2(this.scopeEye.y - this.scopeFront.y, this.scopeEye.z - this.scopeFront.z);
      const dir = this.scopeFront.clone().sub(this.scopeEye).normalize();
      dir.applyAxisAngle(X, -(theta - base));
      this.losDir.copy(dir);
      this.rearNow.copy(this.scopeEye);
    } else if (this.sightKind === 'virtual') {
      // Range posts / fixed scopes without a model: tilt the line of sight directly.
      const dir = F.clone().sub(this.rear).normalize();
      dir.applyAxisAngle(X, -(theta - this.restAngle));
      this.losDir.copy(dir);
      this.rearNow.copy(this.rear);
    } else {
      // Fixed sights: the geometry decides; the solver only tells us the true zero.
      this.losDir.copy(F).sub(this.rear).normalize();
      this.rearNow.copy(this.rear);
    }
    this.eye.copy(this.rearNow).addScaledVector(this.losDir, -this.eyeRelief);
    return this;
  }
}
