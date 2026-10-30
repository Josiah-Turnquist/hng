// Shared vehicle physics: a rigid hull on raycast suspension, hull collisions with
// the ground, buildings and other vehicles, seats, armor plates and damage.
// Wheeled and tracked vehicles extend this with their drive trains
// (wheeled.js, tracked.js).
import * as THREE from 'three';
import { RigidBody } from '../physics/rigidbody.js';
import { FLAG_SOLID, FLAG_SIGHT, FLAG_WALKABLE, RayHit, CollisionWorld, Box } from '../physics/collision.js';
import { SURFACE_INFO } from '../world/heightfield.js';
import { G, clamp, rand } from '../core/math.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _f = new THREE.Vector3();
const _up = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _hit = new RayHit();
const _boxes = [];

export function torqueAt(curve, rpm) {
  if (rpm <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (rpm <= curve[i][0]) {
      const [r0, t0] = curve[i - 1],
        [r1, t1] = curve[i];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return curve[curve.length - 1][1];
}

// How the weight of a rigid hull is shared between its springs when it sits
// level: solve for the spring deflection plane (heave, roll, pitch) so the spring
// forces carry the weight with no turning moment about the center of mass.
// points: [[x, z], ...] spring positions; ks: spring rates. Returns loads (N).
export function staticLoads(points, ks, weight, cgx, cgz) {
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  points.forEach(([x, z], i) => {
    const k = ks[i];
    const r = [1, x, z];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) A[a][b] += k * r[a] * r[b];
  });
  const rhs = [weight, weight * cgx, weight * cgz];
  const sol = solve3(A, rhs);
  if (!sol) return points.map(() => weight / points.length);
  return points.map(([x, z], i) => Math.max(0.05 * weight / points.length, ks[i] * (sol[0] + sol[1] * x + sol[2] * z)));
}

function solve3(A, b) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A);
  if (Math.abs(d) < 1e-9) return null;
  const out = [];
  for (let c = 0; c < 3; c++) {
    const M = A.map((row, r) => row.map((v, k) => (k === c ? b[r] : v)));
    out.push(det(M) / d);
  }
  return out;
}

// Which part each anchor rides on (the gun is a child of the turret).
const ANCHOR_PART = {
  muzzle: 'gun',
  coaxMuzzle: 'gun',
  gunnerEye: 'turret',
  commanderEye: 'turret',
  mgMount: 'turret',
};


// Gameplay tuning the players asked for, on top of the real figures: every
// vehicle picks up speed twice as fast (the push left over after the hill, the
// ground and the air is doubled, and gear changes take half the time, so the
// top speeds stay where they were), and turns much sharper (a turning circle
// TURN_CIRCLE the size at the same speed; tanks pivot and turn TURN_RATE times
// as fast). The bicycle's rider gets three times the push (bike.js).
// At speed, where grip sets the limit, cars and trucks turn harder still: their
// tires grip TURN_GRIP times as hard sideways (braking and pulling away stay as
// they were), and their weight sits ROLL_CG as high as the real one (sidecar
// outfits' too), so the harder turns don't roll them over.
export const ACCEL_GAIN = 2;
export const TURN_CIRCLE = 0.55;
export const TURN_RATE = 1.7;
export const TURN_GRIP = 1.9;
export const ROLL_CG = 0.6;

// Crashes, by the speed (m/s) at which the vehicle closes on what it hits (a
// wall, a tree, another vehicle, the ground after a jump). Up to 8 m/s (about
// 30 km/h, and a 3 m drop) a knock does no harm; past that the damage grows
// with the square of the speed (the energy): into a wall at 40 km/h a jeep
// loses a twentieth of its strength, at 60 km/h two fifths, and at 80 km/h it
// is wrecked. The people in an open vehicle or on a motorcycle are hurt from
// 9 m/s: a little at 45 km/h, half their health at 60 km/h; at 80 km/h it
// kills them.
export const CRASH_SAFE = 8;
export function crashDamage(speed, maxHp) {
  return maxHp * 0.005 * Math.max(0, speed - CRASH_SAFE) ** 2;
}
export function crashInjury(speed) {
  return 0.8 * Math.max(0, speed - 9) ** 2;
}
// Thrown off (or jumping off) a machine moving at `speed`: a slide along the
// ground, gentler than hitting a wall. Nothing at a trot, a few points at
// 40 km/h, a third of his health at 60 km/h; at a motorcycle's full speed it
// kills.
export function fallInjury(speed) {
  return 0.22 * Math.max(0, speed - 5) ** 2;
}

export class Vehicle {
  constructor(game, def, model, x, z, yaw) {
    this.id = game.ids ? ++game.ids.vehicle : (game.ids = { soldier: 0, vehicle: 1, pickup: 0 }).vehicle;
    this.isVehicle = true;
    this.game = game;
    this.def = def;
    this.name = def.name;
    this.model = model; // { root, parts, anchors, meta }
    this.world = game.world;
    const cg = new THREE.Vector3(...def.cg);
    this.cg = cg;
    const body = new RigidBody(def.mass, def.dims, def.inertiaScale ?? 1);
    // Start sitting on the ground, tilted to match the slope under it.
    const hf = game.world.hf;
    const hl = def.dims[2] * 0.4,
      hw = def.dims[0] * 0.4;
    const fx = -Math.sin(yaw),
      fz = -Math.cos(yaw),
      rx = Math.cos(yaw),
      rz = -Math.sin(yaw);
    const hF = hf.getHeight(x + fx * hl, z + fz * hl),
      hB = hf.getHeight(x - fx * hl, z - fz * hl);
    const hR = hf.getHeight(x + rx * hw, z + rz * hw),
      hL = hf.getHeight(x - rx * hw, z - rz * hw);
    const pitch = Math.atan2(hF - hB, 2 * hl);
    const roll = Math.atan2(hR - hL, 2 * hw);
    body.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
    const ground = new THREE.Vector3(x, (hF + hB + hR + hL) / 4 + 0.03, z);
    body.position.copy(cg).applyQuaternion(body.quaternion).add(ground);
    body.updateDerived();
    this.body = body;
    this.wheels = [];
    this.samples = []; // hull collision spheres: { p (body frame from CG), r }
    this.seats = def.seats || [{ name: 'Driver', anchor: 'driverEye', eye: true }];
    this.occupants = new Array(this.seats.length).fill(null);
    this.team = def.faction === 'US' || def.faction === 'SU' ? 1 : 0;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.alive = true;
    this.deadTime = 0;
    this.steer = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.wantDir = 1;
    this.engineOn = true;
    this.rpm = def.engine.idle;
    this.gear = 0; // 1..n forward, -1 reverse, 0 neutral
    this.nextGear = 1;
    this.shiftTimer = 0;
    this.speed = 0; // forward speed m/s (signed)
    this.slipping = 0;
    this.contacts = 0;
    this.load = 0; // engine load 0..1 (for sound)
    this.fire = 0; // seconds left burning
    this.modules = { engine: 1, transmission: 1, trackL: 1, trackR: 1, turret: 1, gun: 1, fuel: 1, ammo: 1 };
    this.waterDepth = 0;
    this.lastImpact = 0;
    this.lastAttacker = null;
  }

  get forward() {
    return _v.set(0, 0, -1).applyQuaternion(this.body.quaternion).clone();
  }

  get position() {
    return this.body.position;
  }

  get driver() {
    return this.occupants[0];
  }

  // Add a wheel/suspension unit. pos: model-space wheel center at normal ride height.
  addWheel(opts) {
    const w = {
      model: new THREE.Vector3(...opts.pos),
      radius: opts.radius,
      k: opts.k,
      c: opts.c,
      side: opts.side,
      steer: opts.steer || 0,
      driven: !!opts.driven,
      part: opts.part || null,
      droop: 0.1,
      bump: 0.08,
      rest: 0.2,
      travel: 0.18,
      preload: 0,
      staticOffset: 0.1,
      compression: 0.1,
      prevCompression: 0.1,
      onGround: false,
      contact: new THREE.Vector3(),
      contactNow: new THREE.Vector3(),
      mount: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 1, 0),
      surface: 0,
      fz: 0,
      spin: 0,
      angle: 0,
      steerAngle: 0,
      slip: 0,
      planeD: 0,
    };
    this.wheels.push(w);
    return w;
  }

  // Once all wheels exist: share out the weight and set every spring so the
  // vehicle sits level at its modeled ride height. Each spring is preloaded so
  // the wheel can still drop `droop` below and rise `bump` above that height.
  finishSuspension() {
    const s = this.def.suspension;
    const loads = staticLoads(
      this.wheels.map((w) => [w.model.x, w.model.z]),
      this.wheels.map((w) => w.k),
      this.def.mass * G,
      this.cg.x,
      this.cg.z,
    );
    this.wheels.forEach((w, i) => {
      w.load = loads[i];
      w.droop = s.droop;
      w.bump = s.bump;
      w.staticOffset = s.droop; // mount point above the wheel center at ride height
      w.rest = 2 * s.droop; // suspension length at full droop
      w.travel = s.droop + s.bump; // compression where the bump stop starts
      w.preload = loads[i] / w.k - s.droop;
      w.compression = w.prevCompression = s.droop;
    });
  }

  // Raycast each suspension against the ground, buildings and other vehicles (once per tick).
  _probeWheels() {
    const b = this.body;
    const up = _up.set(0, 1, 0).applyQuaternion(b.quaternion);
    let n = 0;
    for (const w of this.wheels) {
      const mount = this._modelToWorld(_v2.copy(w.model).setY(w.model.y + w.staticOffset), _v3);
      w.mount.copy(mount);
      // Start the ray above the top of the wheel so curbs and rubble are found.
      const lift = w.radius + 0.15;
      const start = _v.copy(mount).addScaledVector(up, lift);
      const len = lift + w.rest + w.radius + 0.2;
      const ok = this.world.collision.raycast(start.x, start.y, start.z, -up.x, -up.y, -up.z, len, _hit, FLAG_WALKABLE, true);
      if (ok) {
        w.onGround = true;
        w.contact.set(start.x - up.x * _hit.t, start.y - up.y * _hit.t, start.z - up.z * _hit.t);
        w.normal.set(_hit.nx, _hit.ny, _hit.nz);
        w.surface = _hit.ground ? this.world.hf.getSurface(w.contact.x, w.contact.z) : _hit.box?.owner?.isVehicle ? 4 : 6;
        w.planeD = w.normal.dot(w.contact);
        n++;
      } else {
        w.onGround = false;
      }
    }
    this.contacts = n;
  }

  _modelToWorld(p, out) {
    // Model space -> body (relative to CG) -> world.
    return out.copy(p).sub(this.cg).applyQuaternion(this.body.quaternion).add(this.body.position);
  }

  worldToModel(p, out) {
    return out
      .copy(p)
      .sub(this.body.position)
      .applyQuaternion(_q.copy(this.body.quaternion).invert())
      .add(this.cg);
  }

  // Suspension spring force for one wheel against its cached contact plane.
  _suspension(w, dt) {
    w.prevCompression = w.compression;
    if (!w.onGround) {
      w.compression = Math.max(0, w.compression - dt * 2);
      w.fz = 0;
      return 0;
    }
    const b = this.body;
    const up = _up.set(0, 1, 0).applyQuaternion(b.quaternion);
    const mount = this._modelToWorld(_v2.copy(w.model).setY(w.model.y + w.staticOffset), _v3);
    // Distance from the mount down the suspension axis to the contact plane.
    const denom = -up.dot(w.normal);
    if (denom > -0.2) {
      w.fz = 0;
      return 0;
    }
    const dist = (w.planeD - w.normal.dot(mount)) / denom;
    const length = dist - w.radius;
    let compression = w.rest - length;
    if (compression <= 0) {
      w.compression = 0;
      w.fz = 0;
      return 0;
    }
    // Bump stop: past full travel the spring gets very stiff.
    let k = w.k;
    let f = (compression + w.preload) * w.k;
    if (compression > w.travel) f += (compression - w.travel) * k * 12;
    compression = Math.min(compression, w.rest + 0.3);
    w.compression = compression;
    const vel = (w.compression - w.prevCompression) / dt;
    f = Math.max(0, f + vel * w.c);
    // A wheel that has only just touched down can't pull the hull down.
    w.fz = f;
    if (f <= 0) return 0;
    const p = _v.copy(mount).addScaledVector(up, -(length + w.radius));
    b.applyForce(_f.copy(up).multiplyScalar(f), p);
    w.contactNow.copy(p);
    return f;
  }

  // Penalty contacts that keep the hull out of the ground, walls and other vehicles.
  _hullCollisions(dt) {
    const b = this.body;
    const hf = this.world.hf;
    const k = this.def.mass * 380;
    const c = this.def.mass * 28;
    const up = _up.set(0, 1, 0).applyQuaternion(b.quaternion);
    for (const s of this.samples) {
      const p = _v.copy(s.p).applyQuaternion(b.quaternion).add(b.position);
      // Ground.
      const h = hf.getHeight(p.x, p.z);
      const depthG = h + s.r - p.y;
      if (depthG > 0) {
        hf.getNormal(p.x, p.z, _n);
        this._contactForce(p, _n, depthG * _n.y, k, c, 0.6, dt, null, s);
      }
      // Buildings, walls and other vehicles.
      const list = this.world.collision.query(p.x - s.r, p.y - s.r, p.z - s.r, p.x + s.r, p.y + s.r, p.z + s.r, _boxes, FLAG_SOLID);
      for (let i = 0; i < list.length; i++) {
        const box = list[i];
        if (box.owner === this) continue;
        // Motorcycles work out their own knocks (and push back on us): a 300 kg
        // machine is no wall to a tank.
        if (box.owner?.isBike) continue;
        const depth = sphereBox(p, s.r, box, _n);
        if (depth <= 0) continue;
        // Tracks climb low obstacles: the front and back runs slope like a ramp.
        if (s.climb && _n.dot(up) < 0.5) _n.addScaledVector(up, 0.9).normalize();
        this._contactForce(p, _n, depth, k, c, 0.4, dt, box.owner?.isVehicle ? box.owner : null, s);
      }
    }
  }

  // Spring-damper contact at a point with friction. `other` gets the reaction.
  _contactForce(p, n, depth, k, c, mu, dt, other = null, sample = null) {
    const b = this.body;
    const vel = b.pointVelocity(p, _v3);
    if (other) vel.sub(other.body.pointVelocity(p, _v2));
    const vn = vel.dot(n);
    let fn = depth * k - vn * c;
    if (fn <= 0) return;
    // Don't let the penalty spring launch the vehicle.
    fn = Math.min(fn, this.def.mass * G * 6);
    _f.copy(n).multiplyScalar(fn);
    // Friction opposing sliding along the surface.
    const vt = _v3.addScaledVector(n, -vn);
    const vtl = vt.length();
    if (vtl > 1e-3) {
      const ft = Math.min(mu * fn, (vtl * this.def.mass) / dt / Math.max(4, this.samples.length));
      _f.addScaledVector(vt, -ft / vtl);
    }
    b.applyForce(_f, p);
    if (other) other.body.applyForce(_f.negate(), p);
    // (How fast it was closing in: the spring pushing it back out again is no knock.)
    if (vn < 0) this.lastImpact = Math.max(this.lastImpact, -vn);
    if (sample) sample.touching = true;
  }

  // Aerodynamic drag and water.
  _environment(dt) {
    const b = this.body;
    const v = b.velocity;
    const sp = v.length();
    const atm = this.world.atmosphere;
    if (sp > 0.1) {
      const drag = 0.5 * atm.density * (this.def.dragCoef ?? 1.0) * (this.def.frontalArea ?? 6) * sp * sp;
      b.applyForce(_f.copy(v).multiplyScalar(-drag / sp));
    }
    // Wading: water slows the vehicle down.
    const wl = this.world.waterLevelAt?.(b.position.x, b.position.z);
    this.waterDepth = wl === null || wl === undefined ? 0 : Math.max(0, wl - (b.position.y - this.cg.y));
    if (this.waterDepth > 0.1) {
      b.applyForce(_f.copy(v).multiplyScalar(-this.def.mass * 0.6 * Math.min(1, this.waterDepth)));
    }
    // Internal friction keeps the hull from rocking forever.
    b.angular.multiplyScalar(1 - Math.min(0.5, 0.4 * dt));
  }

  // Driver input: drive -1..1 (W/S), steer -1..1 (A/D, right positive), handbrake.
  // There is no reverse pedal: S brakes to a stop, then the driver selects reverse.
  driverInput(drive, steer, handbrake = false) {
    const v = this.speed;
    let throttle = 0,
      brake = 0;
    if (drive > 0.05) {
      if (v < -0.8) brake = drive;
      else {
        throttle = drive;
        this.wantDir = 1;
      }
    } else if (drive < -0.05) {
      if (v > 0.8) brake = -drive;
      else {
        throttle = -drive;
        this.wantDir = -1;
      }
    }
    this.input.throttle = throttle;
    this.input.brake = brake;
    this.input.steer = clamp(steer, -1, 1);
    this.input.handbrake = handbrake;
  }

  // Overall reduction from engine to wheel or sprocket for a gear.
  gearRatio(gear = this.gear) {
    const d = this.def;
    if (gear === 0) return 0;
    const g = gear > 0 ? d.gears[gear - 1] : -d.reverse;
    return g * d.finalDrive * (d.transfer || 1);
  }

  // Automatic gear changes, as an experienced driver would make them. Gearboxes
  // of the period had no synchromesh on the low gears: each change takes time
  // with no drive (double-declutching). Heavy vehicles start in a higher gear
  // (the lowest is a crawler for steep slopes) and slip the clutch.
  _shift(dt) {
    const d = this.def;
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        this.gear = this.nextGear;
        this.sinceShift = 0;
      }
      return;
    }
    this.sinceShift = (this.sinceShift || 0) + dt;
    const v = this.speed;
    const inp = this.input;
    const start = d.startGear || 1;
    if (this.gear === 0) return this._startShift(this.wantDir < 0 ? -1 : start, 0.25);
    if (this.wantDir < 0 && this.gear > 0 && v < 0.8) return this._startShift(-1);
    if (this.wantDir > 0 && this.gear < 0 && v > -0.8) return this._startShift(start);
    if (this.gear < 0) return;
    const e = d.engine;
    const up = e.redline * 0.9;
    const shaft = this.shaftRpm || 0;
    const g = d.gears;
    // Up a gear at the top of the rev range, if the next gear will still pull
    // (on a steep hill it won't: stay in the low gear and crawl up).
    if (!this.holdGear && shaft > up && this.gear < g.length && inp.throttle > 0.2 && this.slipping < 0.3) {
      const rpmNext = (shaft * g[this.gear]) / g[this.gear - 1];
      if (rpmNext > e.idle * 1.15 && this._pull(this.gear + 1, rpmNext) > this._resistance() * 1.1) return this._startShift(this.gear + 1);
    }
    if (this.gear <= 1 || this.sinceShift < 1.2) return;
    // Down when the engine labors below its useful range (skipping gears if the
    // speed has dropped a lot), or when speed falls away at full throttle on a
    // hill or in deep mud. On the flat, not below the starting gear.
    const peak = this._peakTorqueRpm();
    const lugging = shaft < Math.max(e.idle * 1.25, peak * 0.55) && this.gear > start;
    const climbing = !this.holdGear && inp.throttle > 0.8 && (this.accel ?? 0) < -0.03 && shaft < e.redline * 0.55;
    if (!lugging && !climbing) return;
    const min = climbing ? 1 : start;
    let best = 0;
    for (let k = this.gear - 1; k >= min; k--) {
      if ((shaft * g[k - 1]) / g[this.gear - 1] <= up * 0.85) best = k;
      else break;
    }
    if (best) this._startShift(best);
  }

  // Tractive force (N) the engine gives in a gear at an engine speed.
  _pull(gear, rpm) {
    const d = this.def;
    const r = d.kind === 'tracked' ? d.sprocketRadius : d.wheelRadius;
    return (torqueAt(d.engine.torque, rpm) * Math.abs(this.gearRatio(gear)) * d.efficiency) / r;
  }

  // The drive force F (N, along the way it is going) with the gameplay gain:
  // what is left over after the resistance to motion is multiplied by k.
  _gain(F, k = ACCEL_GAIN) {
    if (!(F > 0) || k === 1) return F;
    const R = Math.max(0, this._resistance());
    return F > R ? R + k * (F - R) : F;
  }

  // Force needed to keep going: the hill, rolling resistance and air.
  _resistance() {
    const d = this.def;
    const fwdY = _v.set(0, 0, -1).applyQuaternion(this.body.quaternion).y;
    const surf = this._avgRoll ?? 0.04;
    const roll = d.kind === 'tracked' ? (d.rollCoef ?? 0.03) + 0.6 * surf : surf;
    const v = Math.abs(this.speed);
    return d.mass * G * (Math.max(0, fwdY) + roll) + 0.5 * 1.2 * (d.dragCoef ?? 1) * (d.frontalArea ?? 6) * v * v;
  }

  _peakTorqueRpm() {
    const c = this.def.engine.torque;
    let best = c[0];
    for (const p of c) if (p[1] > best[1]) best = p;
    return best[0];
  }

  _startShift(g, time = this.def.shiftTime) {
    this.nextGear = g;
    this.gear = 0;
    this.shiftTimer = time / ACCEL_GAIN; // (gameplay: quicker changes, see ACCEL_GAIN)
    if (time > 0.25) this.game.audio?.play?.('gearShift', this.body.position, { volume: 0.35 });
  }

  // Engine speed: follows the wheels through the gearbox, with the clutch slipping
  // at low speed so the engine doesn't stall; free-revving in neutral.
  _engineRpm(groundSpeed, radius, throttle, dt) {
    const e = this.def.engine;
    const ratio = this.gearRatio();
    let target;
    if (this.shiftTimer > 0) {
      // Driver is off the throttle; revs fall to match the next gear.
      const r2 = Math.abs(this.gearRatio(this.nextGear));
      target = Math.max(e.idle, ((Math.abs(groundSpeed) / radius) * 60 * r2) / (2 * Math.PI));
    } else if (ratio === 0 || !this.engineOn) {
      target = this.engineOn ? e.idle + throttle * (e.redline * 0.75 - e.idle) : 0;
    } else {
      target = ((Math.abs(groundSpeed) / radius) * 60 * Math.abs(ratio)) / (2 * Math.PI);
      this.shaftRpm = target;
      // Slipping the clutch, the driver holds the engine near its best torque.
      const launch = e.idle * 1.05 + throttle * Math.max(0, Math.max(e.idle * 1.3, this._peakTorqueRpm() * 0.85) - e.idle * 1.05);
      this.clutchSlip = target < launch ? 1 - target / launch : 0;
      target = Math.max(target, launch);
    }
    target = clamp(target, this.engineOn ? e.idle * 0.95 : 0, e.redline * 1.05);
    this.rpm += (target - this.rpm) * Math.min(1, dt * (target > this.rpm ? 6 : 9));
    return ratio;
  }

  // Engine torque at the current speed and throttle (with damage and the governor).
  _engineTorque(throttle) {
    const e = this.def.engine;
    if (!this.engineOn || this.shiftTimer > 0 || this.modules.engine <= 0) return 0;
    let t = torqueAt(e.torque, this.rpm) * throttle * (0.35 + 0.65 * this.modules.engine);
    if (this.rpm > e.redline) t *= Math.max(0, 1 - (this.rpm - e.redline) / (e.redline * 0.04));
    return t;
  }

  // Gravity + everything else, integrated in sub-steps for the stiff springs.
  step(dt) {
    if (!this.alive) {
      this.deadTime += dt;
      this.input.throttle = 0;
      this.input.brake = 1;
      this.engineOn = false;
    }
    if (this.fire > 0) this._burn(dt);
    // Average rolling resistance of the ground under us (sand and mud drag).
    let rr = 0,
      nr = 0;
    for (const w of this.wheels)
      if (w.onGround) {
        rr += this.surfaceAt(w).roll;
        nr++;
      }
    this._avgRoll = nr ? rr / nr : 0.04;
    // Our own collision boxes must not collide with us.
    if (this.proxies) for (const p of this.proxies) p.box.enabled = false;
    const sub = 4;
    const h = dt / sub;
    this._probeWheels();
    this.lastImpact = 0;
    for (const s of this.samples) s.touching = false;
    for (let i = 0; i < sub; i++) {
      const b = this.body;
      b.applyForce(_f.set(0, -G * this.def.mass, 0));
      for (const w of this.wheels) this._suspension(w, h);
      this._drive(h);
      this._hullCollisions(h);
      this._environment(h);
      b.integrate(h);
    }
    // Keep inside the map.
    const lim = this.world.hf.half - 40;
    this.body.position.x = clamp(this.body.position.x, -lim, lim);
    this.body.position.z = clamp(this.body.position.z, -lim, lim);
    const fwd = _v.set(0, 0, -1).applyQuaternion(this.body.quaternion);
    const prev = this.speed;
    this.speed = this.body.velocity.dot(fwd);
    this.accel = (this.accel ?? 0) + ((this.speed - prev) / dt - (this.accel ?? 0)) * Math.min(1, dt * 2);
    if (this.proxies) {
      for (const p of this.proxies) p.box.enabled = true;
      this.updateProxies();
    }
    this._knock(this.lastImpact, dt);
    for (const o of this.occupants) if (o) this._seatOccupant(o);
  }

  // Hard knocks hurt the vehicle and (in the open, not inside a tank) whoever
  // is aboard: once for each knock, by its hardest moment (a crash goes on for
  // several steps while the vehicle stops; charged step by step, a jeep that
  // ran into a wall at 60 km/h used to be wrecked and its crew killed).
  _knock(speed, dt) {
    const peak = Math.max(0, (this.knockPeak || 0) - 20 * dt);
    this.knockPeak = Math.max(peak, speed);
    if (speed <= Math.max(peak, CRASH_SAFE)) return;
    const hurt = crashInjury(speed) - crashInjury(peak);
    if (hurt > 0.5 && this.def.kind !== 'tracked') {
      for (const o of this.occupants) if (o?.alive && o.damage) o.damage(hurt, { kind: 'crash', vehicle: this, weapon: { name: `${this.def.name} crash` } });
    }
    this.damage(crashDamage(speed, this.maxHp) - crashDamage(peak, this.maxHp), null, 'crash');
  }

  // Surface grip and rolling resistance under a wheel.
  surfaceAt(w) {
    return SURFACE_INFO[w.surface] || SURFACE_INFO[0];
  }

  _drive() {}

  // Position the 3D model from the physics state.
  syncModel() {
    const root = this.model.root;
    const b = this.body;
    root.quaternion.copy(b.quaternion);
    root.position.copy(this.cg).negate().applyQuaternion(b.quaternion).add(b.position);
    root.updateMatrixWorld(true);
  }

  // World position of a model anchor (e.g. 'driverEye', 'muzzle'). Anchors on
  // the turret or gun turn and elevate with them.
  anchorWorld(name, out = new THREE.Vector3()) {
    const a = this.model.anchors?.[name];
    if (!a) return null;
    const partName = this.model.meta?.anchorParts?.[name] ?? ANCHOR_PART[name];
    const part = partName && this.model.parts?.[partName];
    const pivot = part && this.partPivots?.[partName];
    if (pivot) return out.copy(a).sub(pivot).applyMatrix4(part.matrixWorld);
    return out.copy(a).applyMatrix4(this.model.root.matrixWorld);
  }

  // Eye or hip position of a seat in the world.
  seatPos(i, out = new THREE.Vector3(), kind = 'eye') {
    const s = this.seats[i] || this.seats[0];
    const up = _up.set(0, 1, 0).applyQuaternion(this.body.quaternion);
    if (!this.anchorWorld(s.anchor, out)) out.copy(this.body.position).addScaledVector(up, 1);
    if (s.offset) out.add(_v.set(...s.offset).applyQuaternion(this.body.quaternion));
    if (kind === 'hip' && s.eye) out.addScaledVector(up, -0.72);
    if (kind === 'eye' && !s.eye) out.addScaledVector(up, 0.72);
    return out;
  }

  // ------------------------------------------------------------------ occupants
  seatIndexFor(soldier) {
    return this.occupants.indexOf(soldier);
  }

  freeSeat(prefer = 0) {
    if (!this.occupants[prefer]) return prefer;
    return this.occupants.findIndex((o) => !o);
  }

  enter(soldier, seat = this.freeSeat()) {
    if (!this.alive || seat < 0 || this.occupants[seat]) return false;
    this.occupants[seat] = soldier;
    soldier.vehicle = this;
    soldier.seat = seat;
    soldier.body.vx = soldier.body.vy = soldier.body.vz = 0;
    this._seatOccupant(soldier);
    if (seat === 0) {
      this.engineOn = this.modules.engine > 0;
      this.gear = 0;
      this.lastDriver = soldier; // (a vehicle that rolls on after he jumps out is still his)
    }
    return true;
  }

  switchSeat(soldier, seat) {
    if (seat < 0 || seat >= this.occupants.length || this.occupants[seat]) return false;
    const cur = this.seatIndexFor(soldier);
    if (cur >= 0) this.occupants[cur] = null;
    this.occupants[seat] = soldier;
    soldier.seat = seat;
    return true;
  }

  // Leave on the side nearest to the seat, at a spot where there's room to stand.
  exit(soldier) {
    const i = this.seatIndexFor(soldier);
    if (i < 0) return false;
    const b = this.body;
    const right = _v.set(1, 0, 0).applyQuaternion(b.quaternion);
    const local = this.worldToModel(this.seatPos(i, _v2, 'hip'), _v3);
    const side = local.x >= 0 ? 1 : -1;
    const halfW = this.def.dims[0] / 2 + 0.6;
    const coll = this.world.collision;
    let placed = null;
    for (const [sx, dz] of [
      [side, 0],
      [-side, 0],
      [side, 1.5],
      [-side, 1.5],
      [0, 1],
    ]) {
      const p = _v3.copy(b.position).addScaledVector(right, sx * halfW);
      if (sx === 0) p.addScaledVector(this.forward, -(this.def.dims[2] / 2 + 0.8));
      else p.addScaledVector(this.forward, -dz);
      const y = this.world.hf.getHeight(p.x, p.z);
      // Room to stand?
      const list = coll.query(p.x - 0.3, y + 0.2, p.z - 0.3, p.x + 0.3, y + 1.8, p.z + 0.3, _boxes, FLAG_SOLID);
      if (list.length === 0 || (list.length === 1 && list[0].owner === this)) {
        placed = { x: p.x, y, z: p.z };
        break;
      }
    }
    if (!placed) placed = { x: b.position.x, y: b.position.y + this.def.dims[1], z: b.position.z };
    this.occupants[i] = null;
    soldier.vehicle = null;
    soldier.seat = -1;
    soldier.leftVehicle = this;
    soldier.leftAt = this.game.time ?? 0;
    const sb = soldier.body;
    sb.x = placed.x;
    sb.y = placed.y + 0.05;
    sb.z = placed.z;
    sb.vx = b.velocity.x * 0.5;
    sb.vy = 0;
    sb.vz = b.velocity.z * 0.5;
    if (i === 0) {
      this.driverInput(0, 0, true);
      this.input.brake = 0.3;
    }
    return true;
  }

  // Keep a seated soldier's body at the seat (for hit boxes, sound and AI):
  // feet about half a meter below the hips.
  _seatOccupant(s) {
    const p = this.seatPos(s.seat, _v2, 'hip');
    const sb = s.body;
    sb.x = p.x;
    sb.y = p.y - 0.5;
    sb.z = p.z;
    sb.vx = this.body.velocity.x;
    sb.vy = this.body.velocity.y;
    sb.vz = this.body.velocity.z;
    sb.onGround = true;
  }

  // ------------------------------------------------------------------ collision proxies
  // Boxes in the collision world so people can't walk through the vehicle (and can
  // climb onto it), other vehicles bump into it, and AI can't see through it.
  setupProxies() {
    const coll = this.world.collision;
    const meta = this.model.meta || {};
    const boxesFor = (part) => {
      const plates = (meta.armor || []).filter((a) => (a.part || 'body') === part && !/track|skirt|wheel/i.test(a.name || ''));
      if (!plates.length) return null;
      const mn = [Infinity, Infinity, Infinity],
        mx = [-Infinity, -Infinity, -Infinity];
      for (const a of plates)
        for (let k = 0; k < 3; k++) {
          const ext = Math.hypot(...a.half) * 0.85;
          mn[k] = Math.min(mn[k], a.center[k] - Math.min(ext, a.half[k] + 0.2));
          mx[k] = Math.max(mx[k], a.center[k] + Math.min(ext, a.half[k] + 0.2));
        }
      return { center: mn.map((v, k) => (v + mx[k]) / 2), half: mn.map((v, k) => (mx[k] - v) / 2) };
    };
    const [W, H, L] = this.def.dims;
    const clearance = this.def.kind === 'tracked' ? 0.15 : 0.4;
    const list = [];
    const hull = boxesFor('body') || { center: [0, clearance + (H * 0.6 - clearance) / 2 + 0.05, 0], half: [W / 2, (H * 0.6 - clearance) / 2, L / 2] };
    hull.center[1] = Math.max(hull.center[1], clearance + hull.half[1]);
    if (this.def.kind === 'tracked') {
      // Include the tracks: the full width down to near the ground.
      const top = hull.center[1] + hull.half[1];
      hull.half[0] = Math.max(hull.half[0], W / 2);
      hull.center[1] = (top + clearance) / 2;
      hull.half[1] = (top - clearance) / 2;
    }
    list.push({ part: null, ...hull });
    const tur = boxesFor('turret');
    if (tur) list.push({ part: 'turret', ...tur });
    this.proxies = list.map((p) => {
      const box = new Box(0, 0, 0, p.half[0], p.half[1], p.half[2], 0, 'armor', FLAG_SOLID | FLAG_SIGHT | FLAG_WALKABLE);
      box.owner = this;
      coll.add(box);
      return { part: p.part, center: new THREE.Vector3(...p.center), box };
    });
    this.updateProxies();
  }

  updateProxies() {
    const coll = this.world.collision;
    for (const p of this.proxies) {
      const obj = p.part ? this.model.parts?.[p.part] : null;
      const box = p.box;
      const old = { minX: box.minX, minZ: box.minZ, maxX: box.maxX, maxZ: box.maxZ };
      // Center in world space and axes from the hull (the turret box turns with the turret).
      _v.copy(p.center);
      if (obj && this.partPivots?.[p.part]) {
        obj.updateWorldMatrix(true, false);
        _v.sub(this.partPivots[p.part]).applyMatrix4(obj.matrixWorld);
        _m.extractRotation(obj.matrixWorld);
      } else {
        this._modelToWorld(_v, _v);
        _m.makeRotationFromQuaternion(this.body.quaternion);
      }
      const e = _m.elements;
      box.cx = _v.x;
      box.cy = _v.y;
      box.cz = _v.z;
      box.ax = [e[0], e[1], e[2]];
      box.ay = [e[4], e[5], e[6]];
      box.az = [e[8], e[9], e[10]];
      coll.update(box, old);
    }
  }

  removeFromWorld() {
    if (this.snd) for (const h of Object.values(this.snd)) h?.stop?.(0.2);
    this.snd = null;
    if (this.proxies) for (const p of this.proxies) this.world.collision.remove(p.box);
    this.model.root.removeFromParent();
  }

  // ------------------------------------------------------------------ armor
  // Bullets and shells against the armor: returns the nearest plate hit.
  raycastArmor(ox, oy, oz, dx, dy, dz, maxDist) {
    const plates = this.plates;
    if (!plates) return null;
    // Bounding sphere test first.
    const b = this.body;
    const cx = b.position.x - ox,
      cy = b.position.y - oy,
      cz = b.position.z - oz;
    const t = cx * dx + cy * dy + cz * dz;
    const r = this.radius;
    if (t < -r || t > maxDist + r) return null;
    const px = cx - dx * t,
      py = cy - dy * t,
      pz = cz - dz * t;
    if (px * px + py * py + pz * pz > r * r) return null;
    let best = null;
    for (const pl of plates) {
      if (CollisionWorld.rayBox(pl.box, ox, oy, oz, dx, dy, dz, maxDist, _hit) && _hit.t > 0 && (!best || _hit.t < best.t)) {
        best = { t: _hit.t, tExit: _hit.tExit, nx: _hit.nx, ny: _hit.ny, nz: _hit.nz, plate: pl, armorMM: pl.mm, material: 'armor', target: this, part: pl.name };
      }
    }
    return best;
  }

  // Armor plates from the model's metadata, as oriented boxes that follow the
  // hull, turret and gun.
  setupArmor() {
    const meta = this.model.meta || {};
    const list = (meta.armor && meta.armor.length ? meta.armor : this._defaultArmor()).slice();
    list.push(...this._extraPlates());
    this.plates = list.map((a) => {
      const local = new THREE.Matrix4().compose(new THREE.Vector3(...a.center), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(a.rot || [0, 0, 0]), 'XYZ')), new THREE.Vector3(1, 1, 1));
      const box = new Box(0, 0, 0, a.half[0], a.half[1], a.half[2], 0, 'armor', 2);
      box.owner = this;
      return { name: a.name, mm: a.mm, part: a.part || 'body', local, box, kind: a.kind || null };
    });
    // Internal modules (engine, ammo, fuel, crew...) for damage after a penetration.
    const mods = meta.modules && meta.modules.length ? meta.modules : this._defaultModules();
    this.internals = mods.map((m) => {
      const box = new Box(0, 0, 0, m.half[0], m.half[1], m.half[2], 0, 'steel', 0);
      return { name: m.name, part: m.part || 'body', local: new THREE.Matrix4().makeTranslation(...m.center), box };
    });
    const d = this.def.dims;
    this.radius = Math.hypot(d[0], d[1] * 1.6, d[2]) / 2 + 0.6;
    this.updateArmor();
  }

  _defaultArmor() {
    const [w, h, l] = this.def.dims;
    return [{ name: 'hull', part: 'body', center: [0, h / 2 + 0.3, 0], half: [w / 2, h / 2, l / 2], mm: 5 }];
  }

  _extraPlates() {
    return [];
  }

  _defaultModules() {
    const [w, h, l] = this.def.dims;
    return [
      { name: 'engine', part: 'body', center: [0, h * 0.45, l * 0.32], half: [w * 0.3, h * 0.18, l * 0.12] },
      { name: 'fuel', part: 'body', center: [0, h * 0.3, l * 0.15], half: [w * 0.35, h * 0.1, l * 0.08] },
    ];
  }

  updateArmor() {
    if (!this.plates) return;
    const parts = this.model.parts || {};
    const m = new THREE.Matrix4();
    const e = new THREE.Matrix4();
    const place = (list) => {
      for (const pl of list) {
        const owner = parts[pl.part] && pl.part !== 'body' ? parts[pl.part] : this.model.root;
        // Part matrices are relative to the part pivot; armor coords are in model space.
        if (owner === this.model.root) m.multiplyMatrices(owner.matrixWorld, pl.local);
        else {
          const pivot = this.partPivots?.[pl.part];
          e.copy(pl.local);
          if (pivot) e.premultiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
          m.multiplyMatrices(owner.matrixWorld, e);
        }
        const el = m.elements;
        const b = pl.box;
        b.cx = el[12];
        b.cy = el[13];
        b.cz = el[14];
        b.ax = [el[0], el[1], el[2]];
        b.ay = [el[4], el[5], el[6]];
        b.az = [el[8], el[9], el[10]];
      }
    };
    place(this.plates);
    if (this.internals) place(this.internals);
  }

  // ------------------------------------------------------------------ damage
  // A projectile hit one of our plates. The projectile system has already decided
  // whether it went through (info.kind: 'penetrate', 'nonpen', 'ricochet').
  onHit(info, p) {
    if (p.owner) {
      this.lastAttacker = p.owner;
      this.lastWeapon = p.weapon; // (for the ribbons: game/ribbons.js)
    }
    const ammo = p.ammo;
    const shell = ammo.diameter >= 0.019 || ammo.heat || ammo.explosive;
    const plate = info.plate || this.plates?.find((pl) => pl.name === info.part);
    if (info.kind === 'ricochet') return { effect: 'sparks' };
    // Tracks and wheels: a heavy hit breaks the track.
    if (plate?.kind === 'track') {
      if (shell && (info.kind === 'penetrate' || ammo.explosive)) {
        const side = plate.name.endsWith('L') ? 'trackL' : 'trackR';
        if (this.modules[side] > 0) {
          this.modules[side] = 0;
          this.game.onVehicleEvent?.(this, 'track', p.owner);
        }
        this.damage(ammo.explosive ? 40 : 25, p.owner, 'track');
      }
      return { effect: 'sparks' };
    }
    if (info.kind === 'nonpen') {
      // High explosive bursting on the outside still hurts thin-skinned vehicles.
      if (ammo.explosive) {
        const blast = ammo.explosive.blast * 400;
        this.damage(blast / (1 + (info.armorMM || 0) / 12), p.owner, 'he');
      } else if (shell) this.damage(4, p.owner, 'bounce');
      return { effect: 'sparks' };
    }
    // Penetration.
    if (!shell) {
      // A bullet through sheet metal: may hit the engine, fuel or the people inside.
      this._internalPath(info, p, 1.6, 0.25);
      this.damage(bulletDamageToVehicle(info.energy), p.owner, 'bullet');
      return { effect: 'sparks' };
    }
    const cal = ammo.diameter * 1000;
    const filler = ammo.heat ? 0.3 : ammo.filler || (ammo.explosive ? 0.6 : 0);
    // Base damage grows with caliber; explosive filler bursting inside adds a lot.
    const dmg = 170 * Math.pow(cal / 75, 1.5) + filler * 2600 + (ammo.explosive ? ammo.explosive.blast * 400 : 0);
    this._internalPath(info, p, ammo.heat ? 1.4 : 3.2, 1 + filler * 8);
    this.damage(dmg, p.owner, 'penetration');
    return { effect: 'penetration' };
  }

  // What a projectile (and the spall it throws) does inside the vehicle.
  _internalPath(info, p, depth, power) {
    const ox = info.x,
      oy = info.y,
      oz = info.z;
    const dx = info.dirX,
      dy = info.dirY,
      dz = info.dirZ;
    for (const m of this.internals || []) {
      if (!CollisionWorld.rayBox(m.box, ox, oy, oz, dx, dy, dz, depth, _hit)) continue;
      this._moduleHit(m.name, p, power);
    }
    // People inside: hit if close to the shell's path (spall spreads in a cone).
    for (const o of this.occupants) {
      if (!o || !o.alive) continue;
      const a = this.seatPos(o.seat, _v2, 'eye');
      const rx = a.x - ox,
        ry = a.y - 0.3 - oy,
        rz = a.z - oz;
      const along = rx * dx + ry * dy + rz * dz;
      if (along < -0.3 || along > depth + 0.5) continue;
      const miss = Math.sqrt(Math.max(0, rx * rx + ry * ry + rz * rz - along * along));
      const cone = 0.25 + Math.max(0, along) * 0.35 * Math.min(1, power);
      if (miss > cone + 0.6) continue;
      const dmg = (power >= 1 ? 160 : 55) * Math.exp(-Math.max(0, miss - 0.2) / Math.max(0.25, cone));
      o.damage(dmg, { kind: power >= 1 ? 'penetration' : 'bullet', attacker: p.owner, weapon: p.weapon, vehicle: this });
    }
  }

  _moduleHit(name, p, power) {
    const m = this.modules;
    switch (name) {
      case 'engine':
        m.engine = Math.max(0, m.engine - 0.5 * Math.min(2, power));
        if (rand() < 0.18 * power) this.startFire(p.owner);
        if (m.engine <= 0) this.engineOn = false;
        break;
      case 'transmission':
        m.transmission = Math.max(0, m.transmission - 0.6 * Math.min(2, power));
        break;
      case 'fuel':
        if (rand() < 0.3 * power) this.startFire(p.owner);
        break;
      case 'ammo':
        if (power >= 1 && rand() < 0.45 + 0.1 * power) this.destroy(p.owner, 'ammo');
        break;
      case 'gun':
        m.gun = Math.max(0, m.gun - 0.5 * power);
        break;
      case 'turret':
        m.turret = Math.max(0, m.turret - 0.5 * power);
        break;
    }
  }

  startFire(attacker) {
    if (this.fire > 0 || !this.alive) return;
    this.fire = 10 + rand() * 10;
    this.fireAttacker = attacker;
    this.game.onVehicleEvent?.(this, 'fire', attacker);
  }

  _burn(dt) {
    this.fire -= dt;
    this.damage(14 * dt, this.fireAttacker, 'fire');
    for (const o of this.occupants) if (o && o.alive) o.damage(5 * dt, { kind: 'fire', attacker: this.fireAttacker, vehicle: this });
    // A built-in extinguisher sometimes puts it out.
    if (this.fire < 4 && this.alive && rand() < dt * 0.15) this.fire = 0;
  }

  damage(amount, attacker, cause) {
    if (!this.alive || amount <= 0) return;
    this.hp -= amount;
    if (attacker) this.lastAttacker = attacker;
    if (this.hp <= 0) this.destroy(attacker || this.lastAttacker, cause);
  }

  destroy(attacker, cause) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.engineOn = false;
    this.fire = Math.max(this.fire, 60);
    this.destroyCause = cause;
    for (const o of this.occupants.slice()) {
      if (!o || !o.alive) continue;
      // Wrecked in a crash, the people aboard have had their knocks (_knock):
      // they climb out of it. Anything else that wrecks it kills them.
      if (cause === 'crash' && this.exit(o)) {
        if (o === this.game.player?.soldier) this.game.player.exitedVehicle?.(this);
      } else o.damage(1000, { kind: 'vehicle', attacker, vehicle: this });
    }
    this.game.onVehicleDestroyed?.(this, attacker, cause);
  }
}

// Penetration of a sphere into an oriented box; fills the push-out normal.
export function sphereBox(p, r, b, outN) {
  const px = p.x - b.cx,
    py = p.y - b.cy,
    pz = p.z - b.cz;
  const ax = b.ax,
    ay = b.ay,
    az = b.az;
  const lx = px * ax[0] + py * ax[1] + pz * ax[2];
  const ly = px * ay[0] + py * ay[1] + pz * ay[2];
  const lz = px * az[0] + py * az[1] + pz * az[2];
  const cx = Math.max(-b.hx, Math.min(b.hx, lx));
  const cy = Math.max(-b.hy, Math.min(b.hy, ly));
  const cz = Math.max(-b.hz, Math.min(b.hz, lz));
  let nx = lx - cx,
    ny = ly - cy,
    nz = lz - cz;
  const d2 = nx * nx + ny * ny + nz * nz;
  let depth;
  if (d2 > 1e-10) {
    if (d2 >= r * r) return 0;
    const d = Math.sqrt(d2);
    depth = r - d;
    nx /= d;
    ny /= d;
    nz /= d;
  } else {
    const ex = b.hx - Math.abs(lx),
      ey = b.hy - Math.abs(ly),
      ez = b.hz - Math.abs(lz);
    if (ex < ey && ex < ez) {
      nx = Math.sign(lx) || 1;
      ny = nz = 0;
      depth = ex + r;
    } else if (ey < ez) {
      ny = Math.sign(ly) || 1;
      nx = nz = 0;
      depth = ey + r;
    } else {
      nz = Math.sign(lz) || 1;
      nx = ny = 0;
      depth = ez + r;
    }
  }
  outN.set(nx * ax[0] + ny * ay[0] + nz * az[0], nx * ax[1] + ny * ay[1] + nz * az[1], nx * ax[2] + ny * ay[2] + nz * az[2]);
  return depth;
}

function bulletDamageToVehicle(energy) {
  return Math.min(12, Math.sqrt(Math.max(0, energy)) * 0.18);
}
