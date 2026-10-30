// Tracked vehicles (tanks). Each track is a belt with its own speed. The engine
// drives the tracks through the gearbox; the ground pushes back on every road
// wheel where the track grips or slips. Turning means one track runs slower than
// the other, which drags the ends of the tracks sideways across the ground: that
// sideways friction is why tanks need so much power to turn, and why they turn
// more easily on mud than on dry ground.
//
// Steering follows each tank's real mechanism:
//  - controlledDiff (M4 Sherman): a braked differential. Both tracks always
//    driven; the tightest turn is a fixed radius (31 ft) and it can't turn on
//    the spot.
//  - clutchBrake (T-34): the inner track is declutched and braked. Can turn
//    around a locked track; heavy and abrupt.
//  - epicyclic (Panzer IV): steering units slow the inner track gradually; full
//    lever brakes it to turn around it.
import { badgeValue } from '../game/badges.js';
import * as THREE from 'three';
import { Vehicle, TURN_RATE } from './vehicle.js';
import { SHELLS } from './defs.js';
import { clamp, approach, DEG, wrapAngle, gaussRandom } from '../core/math.js';
import { solveZero } from '../ballistics/solver.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _wr = new THREE.Vector3();
const _wf = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

export class TrackedVehicle extends Vehicle {
  constructor(game, def, model, x, z, yaw) {
    super(game, def, model, x, z, yaw);
    const parts = model.parts || {};
    const s = def.suspension;
    this.partPivots = {};
    for (const [k, g] of Object.entries(parts)) this.partPivots[k] = g.position.clone();
    // Parts that ride on others (the gun and roof MG on the turret) become their children.
    const parents = { ...(model.meta?.partParents || {}) };
    if (parts.gun && parts.turret && !parents.gun) parents.gun = 'turret';
    for (const [child, parent] of Object.entries(parents)) {
      if (!parts[child] || !parts[parent]) continue;
      parts[parent].add(parts[child]);
      parts[child].position.copy(this.partPivots[child]).sub(this.partPivots[parent]);
    }
    // Road wheels from the model (roadL0, roadL1... front to back) or evenly spaced.
    const r = def.roadWheelRadius;
    for (const [side, sx] of [
      ['L', -1],
      ['R', 1],
    ]) {
      const list = [];
      for (let i = 0; parts[`road${side}${i}`]; i++) list.push(parts[`road${side}${i}`]);
      const n = list.length || def.roadWheels || 6;
      for (let i = 0; i < n; i++) {
        const p = list[i]?.position;
        const z = -def.contactLength / 2 + (def.contactLength * i) / Math.max(1, n - 1);
        // On the models the road wheels ride on the track links: the wheel center is
        // its radius plus the link thickness above the ground.
        const w = this.addWheel({ pos: p ? [p.x, p.y, p.z] : [(sx * def.trackCenters) / 2, r, z], radius: p ? p.y : r, k: s.k, c: s.c, side: sx, part: list[i] || null });
        w.track = side === 'L' ? 0 : 1;
      }
    }
    this.finishSuspension();

    // Hull collision spheres: the hull box, plus the sprockets and idlers at each
    // end of the tracks which act like ramps to climb obstacles.
    const [W, H, L] = def.dims;
    const [cx, cy, cz] = def.cg;
    const ends = [
      [-def.contactLength / 2 - 0.45, def.sprocketRadius + 0.25],
      [def.contactLength / 2 + 0.45, def.sprocketRadius + 0.25],
    ];
    for (const sx of [-1, 1]) {
      for (const [ez, ey] of ends) this.samples.push({ p: new THREE.Vector3((sx * def.trackCenters) / 2 - cx, ey - cy, ez - cz), r: 0.4, climb: true });
      for (const sz of [-0.5, 0, 0.5]) this.samples.push({ p: new THREE.Vector3(sx * (W / 2 - 0.4) - cx, 0.35 - cy, sz * def.contactLength - cz), r: 0.3 });
      for (const sz of [-1, 0, 1]) this.samples.push({ p: new THREE.Vector3(sx * (W / 2 - 0.45) - cx, H * 0.55 - cy, sz * (L / 2 - 0.45) - cz), r: 0.45 });
    }
    // Belly (the hull bottom between the tracks): catches on stumps and ridges.
    for (const sz of [-0.3, 0.3]) this.samples.push({ p: new THREE.Vector3(-cx, 0.55 - cy, sz * def.contactLength - cz), r: 0.4 });

    // Track state: speed (m/s, + forward) and distance run (for animating links).
    this.trackSpeed = [0, 0];
    this.trackDist = [0, 0];
    this.trackGround = [0, 0];
    this.trackLoad = [0, 0];
    this.clutchSlip = 0;

    // Turret and gun. Angles: turret yaw relative to the hull (radians, + left,
    // like THREE), gun elevation relative to the turret (+ up).
    this.turretYaw = 0;
    this.turretRate = 0;
    this.gunElev = 0;
    this.aim = { yaw: this._hullYaw(), pitch: 0 }; // world aim direction wanted by the gunner
    this.stabPitch = 0;
    const gd = def.gun;
    this.ammoTypes = gd.ammo.slice();
    this.ammoIndex = 0;
    this.stowed = { ...gd.stowed };
    this.loaded = this.ammoTypes[0];
    this.stowed[this.loaded]--;
    this.reloadT = 0;
    this.nextAmmo = this.ammoTypes[0];
    this.sightRange = 400;
    this.superElev = 0;
    this._zeroCache = new Map();
    this.coax = new MountedGun(def.coax);
    this.bowMg = new MountedGun(def.bowMg);
    this.bowAim = { yaw: 0, pitch: 0 };
    this.recoil = 0;
    this.setupArmor();
    this.setupProxies();
    this.setSightRange(this.sightRange);
  }

  _hullYaw() {
    const f = _v.set(0, 0, -1).applyQuaternion(this.body.quaternion);
    return Math.atan2(-f.x, -f.z);
  }

  // Track plates (the tracks and road wheels soak up hits on the lower side).
  _extraPlates() {
    const d = this.def;
    const t = this.model.meta?.track;
    const off = t?.offsetX ?? d.trackCenters / 2;
    const width = t?.width ?? d.trackWidth;
    const h = d.roadWheelRadius * 2 + 0.25;
    const len = d.contactLength + 0.9;
    return ['L', 'R'].map((side) => ({ name: `track${side}`, kind: 'track', part: 'body', center: [(side === 'L' ? -1 : 1) * off, h / 2, 0], half: [width / 2 + 0.03, h / 2, len / 2], mm: 25 }));
  }

  _defaultModules() {
    const [w, h, l] = this.def.dims;
    const rearEngine = true;
    const frontTrans = this.def.steering !== 'clutchBrake';
    return [
      { name: 'engine', part: 'body', center: [0, h * 0.42, rearEngine ? l * 0.3 : -l * 0.3], half: [w * 0.28, h * 0.17, l * 0.13] },
      { name: 'transmission', part: 'body', center: [0, h * 0.3, frontTrans ? -l * 0.38 : l * 0.42], half: [w * 0.3, h * 0.12, l * 0.07] },
      { name: 'fuel', part: 'body', center: [0, h * 0.4, l * 0.12], half: [w * 0.36, h * 0.12, l * 0.06] },
      { name: 'ammo', part: 'body', center: [-w * 0.3, h * 0.3, -l * 0.02], half: [w * 0.08, h * 0.12, l * 0.14] },
      { name: 'ammo', part: 'body', center: [w * 0.3, h * 0.3, -l * 0.02], half: [w * 0.08, h * 0.12, l * 0.14] },
    ];
  }

  // ------------------------------------------------------------------ driving
  _drive(dt) {
    const d = this.def;
    const b = this.body;
    const inp = this.input;
    const rs = d.sprocketRadius;
    let throttle = inp.throttle;
    const steer = inp.steer;
    // The Tiger's regenerative steering turns it on the spot in neutral.
    const neutralTurn = d.steering === 'regenerative' && Math.abs(steer) > 0.1 && throttle < 0.05 && inp.brake < 0.05 && this.alive && Math.abs(this.speed) < 1;
    // Turning from a standstill with only A or D: the driver puts it in gear and
    // feeds in the gas to swing round at a brisk walk. (Quicker than a careful
    // driver would, for gameplay: see TURN_RATE. A tank that can't pivot, like
    // the Sherman, swings round its smallest circle, kept at up to a fast walk.)
    let pivoting = false;
    if (!neutralTurn && Math.abs(steer) > 0.1 && throttle < 0.05 && inp.brake < 0.05 && this.alive && Math.abs(this.speed) < (this.pivotThrottle > 0 ? 4 : 1.5)) {
      this.wantDir = 1;
      pivoting = true;
      const vo = Math.max(Math.abs(this.trackSpeed[0]), Math.abs(this.trackSpeed[1]));
      const quick = d.steering === 'controlledDiff' ? 2 : TURN_RATE;
      const target = (d.steering === 'controlledDiff' ? 1.6 : 1.1) * quick;
      throttle = clamp((target - vo) * 4, 0, 1) * Math.abs(steer);
    }
    this.pivotThrottle = pivoting ? Math.max(throttle, 0.01) : 0;
    // Levers let go while under way: the driver checks the hull's swing with a
    // touch of the other lever, so it stops turning when the key is let go
    // (left alone, 30 tonnes swing on well past where he wanted to be).
    let lever = steer;
    if (Math.abs(steer) < 0.05 && this.alive && Math.abs(this.speed) > 2) {
      const swing = b.angular.dot(_v2.set(0, 1, 0).applyQuaternion(b.quaternion));
      lever = clamp(swing * 4, -0.8, 0.8);
    }
    // (The driver lets a lever go quicker than he pulls it.)
    const back = Math.abs(lever) < Math.abs(this.steer) || lever * this.steer < 0;
    this.steer = approach(this.steer, lever, dt * (back ? 20 : d.steering === 'clutchBrake' ? 6 : 4));
    const st = this.steer;
    const a = Math.abs(st);
    const inner = st > 0 ? 1 : 0; // turning right: the right track is inside
    const outer = 1 - inner;
    // No gear changes in the middle of a hard turn.
    this.holdGear = a > 0.3;

    // Engine and gearbox. Through a differential the engine turns with the
    // average of the tracks; with a steering clutch out, only the outer track.
    const vMean = (this.trackSpeed[0] + this.trackSpeed[1]) / 2;
    const declutched = d.steering !== 'controlledDiff' && a >= 0.15;
    const ratio = this._engineRpm(declutched ? this.trackSpeed[outer] : vMean, rs, throttle, dt);
    const broken = this.modules.transmission <= 0;
    const torque = broken ? 0 : this._engineTorque(throttle);
    const tmax = this._tmax || (this._tmax = Math.max(...d.engine.torque.map((p) => p[1])));
    this.load = clamp(torque / tmax, 0, 1);
    let engineBrake = 0;
    if (throttle < 0.05 && ratio !== 0 && !broken && this.engineOn) {
      const over = clamp((this.rpm - d.engine.idle * 1.3) / 500, 0, 1);
      engineBrake = -0.18 * tmax * over * Math.sign(vMean || 1) * Math.sign(ratio);
    }
    // (With the gameplay gain on the push when getting under way, ACCEL_GAIN in
    // vehicle.js; not for swinging round on the spot.)
    const push = ((torque + engineBrake) * ratio * d.efficiency) / rs;
    const total = pivoting ? push : this._gain(push);
    // Effective mass of each track: the track itself plus (in gear) the engine's
    // spinning parts seen through the gearbox.
    const engM = ratio !== 0 ? (d.engine.inertia * ratio * ratio) / (rs * rs) / 2 : 0;
    const m = [d.trackMass + engM, d.trackMass + engM];

    // Split the drive between the tracks and apply the steering.
    const drive = [total / 2, total / 2];
    const brake = [0, 0];
    let lock = false;
    let diffTarget = null;
    if (d.steering === 'regenerative') {
      // A steering differential driven from the gearbox: the turning radius is
      // fixed by the gear (3.4 m in first, wider in each higher gear); in
      // neutral the tracks counter-rotate.
      // (The turns, in or out of gear, quicker than the real ones:
      // gameplay, see TURN_RATE.)
      const g = Math.max(1, Math.abs(this.gear || this.nextGear || 1));
      const R = (d.turnRadius * (d.gears[0] / d.gears[g - 1]) ** 0.75) / TURN_RATE;
      const kmin = d.trackCenters / (2 * R);
      // In neutral: outer track forward and inner back, about 0.9 m/s each.
      diffTarget = neutralTurn ? a * 1.8 * TURN_RATE : a * 2 * kmin * vMean;
      lock = a < 0.05;
    } else if (d.steering === 'controlledDiff') {
      // Braking one side of the differential speeds up the other: the track speeds
      // are forced apart, up to the fixed ratio of the mechanism (applied below).
      // Fast, the driver eases the steering brake to keep the turn under about
      // half a g sideways. (Both sharper for gameplay: TURN_RATE.)
      const R = Math.max(d.turnRadius / TURN_RATE, (vMean * vMean) / (4.9 * TURN_RATE));
      diffTarget = (a * d.trackCenters * vMean) / R;
      lock = a < 0.05;
    } else {
      // Clutch-brake and epicyclic steering: the lever slows the inner track to a
      // fraction of the outer one (a fully pulled lever stops it: the tank turns
      // around it). Drivers feather the lever at speed, so the fraction is less
      // extreme when moving fast.
      // Tightest radius the driver will use: a pivot when slow, and no more than
      // about 0.4 g sideways when moving (more for gameplay: TURN_RATE).
      const half = d.trackCenters / 2;
      const rMin = Math.max(half, (vMean * vMean) / (3.9 * TURN_RATE));
      const kMin = (rMin - half) / (rMin + half);
      const k = 1 - a * (1 - kMin);
      const vo = this.trackSpeed[outer],
        vi = this.trackSpeed[inner];
      const over = (vi - k * vo) * Math.sign(vo || vMean || 1);
      // He brakes the inner track firmly toward that fraction: a gentler hand
      // never got a heavy tank to swing round at speed (the lever did nothing).
      const steerBrake = a > 0.15 ? clamp(over * m[inner] * 80, 0, d.brakeForce * 0.5) : 0;
      if (d.steering === 'clutchBrake') {
        if (a < 0.15) lock = true;
        else {
          // Steering clutch out: all the drive goes to the outer track.
          drive[outer] = total;
          drive[inner] = 0;
        }
      } else {
        drive[inner] = (total / 2) * (1 - a);
        drive[outer] = (total / 2) * (1 + a);
        lock = a < 0.05;
      }
      brake[inner] = steerBrake;
    }
    // Service brakes (S while rolling forward, or with no driver) and a broken track.
    for (let i = 0; i < 2; i++) {
      brake[i] = Math.max(brake[i], inp.brake * d.brakeForce * 0.5);
      if (throttle < 0.05 && inp.brake < 0.05 && a < 0.1 && Math.abs(this.speed) < 0.4) brake[i] = Math.max(brake[i], d.brakeForce * 0.3);
      if (this.modules[i === 0 ? 'trackL' : 'trackR'] <= 0) {
        drive[i] = 0;
        brake[i] = Math.max(brake[i], d.brakeForce * 0.5);
      }
    }

    // Ground forces under each road wheel. The sideways resistance of tracks
    // falls as the turn widens (Nikitin's empirical rule): wide turns at speed
    // cost far less than pivoting.
    _fwd.set(0, 0, -1).applyQuaternion(b.quaternion);
    const up = _v2.set(0, 1, 0).applyQuaternion(b.quaternion);
    const yawRate = Math.abs(b.angular.dot(up));
    // (Only while steering: with the levers let go the tracks run straight, and
    // the hull swinging on past that slides them sideways against all of it.)
    const rb = Math.min(8, Math.abs(this.speed) / Math.max(1e-3, yawRate) / d.trackCenters);
    const nikitin = a < 0.05 ? 1 : 1 + (1 / (0.925 + 0.15 * Math.max(0.5, rb)) - 1) * Math.min(1, yawRate / 0.08);
    const ground = this.trackGround;
    const loads = this.trackLoad;
    const stiff = [0, 0];
    ground[0] = ground[1] = 0;
    loads[0] = loads[1] = 0;
    for (const w of this.wheels) {
      w.slip = 0;
      if (!w.onGround || w.fz <= 0) {
        w.bristle = w.bristleLat = 0;
        continue;
      }
      const wf = _wf.copy(_fwd).addScaledVector(w.normal, -_fwd.dot(w.normal)).normalize();
      const wr = _wr.crossVectors(wf, w.normal).normalize();
      const p = w.contactNow;
      b.pointVelocity(p, _vel);
      const vLong = _vel.dot(wf);
      const vLat = _vel.dot(wr);
      const surf = this.surfaceAt(w);
      // Grousers dig into soft ground, so tracks keep more grip there than tires.
      const grip = clamp(0.55 + surf.mu * 0.7, 0.6, 1.1);
      const Fz = Math.min(w.fz, w.load * 3);
      const muL = d.trackMu * grip;
      const muS = d.lateralMu * clamp(0.4 + surf.mu, 0.55, 1.1) * nikitin;
      const slipV = this.trackSpeed[w.track] - vLong;
      // Grip as springy "bristles" (the track shoes and soil give a couple of
      // centimeters) plus damping: holds a tank still on a slope, and lets go
      // into sliding once the friction limit is reached.
      const limL = muL * Fz,
        limS = muS * Fz;
      const ks = Fz * 50,
        cs = Fz * 4;
      w.bristle = clamp((w.bristle || 0) + slipV * dt, -limL / ks, limL / ks);
      w.bristleLat = clamp((w.bristleLat || 0) - vLat * dt, -limS / ks, limS / ks);
      let fl = clamp(ks * w.bristle + cs * slipV, -limL, limL);
      let fs = clamp(ks * w.bristleLat - cs * vLat, -limS, limS);
      // Friction ellipse: sliding sideways uses up grip along the track.
      const e = Math.hypot(fl / limL, fs / limS);
      if (e > 1) {
        fl /= e;
        fs /= e;
        w.bristle = (fl - cs * slipV) / ks;
        w.bristleLat = (fs + cs * vLat) / ks;
      }
      w.slip = Math.min(1, Math.abs(slipV) / 3);
      b.applyForce(_v.copy(wf).multiplyScalar(fl).addScaledVector(wr, fs), p);
      ground[w.track] += fl;
      loads[w.track] += Fz;
      if (e <= 1 && Math.abs(fl) < limL) stiff[w.track] += cs + ks * dt;
    }
    // The gun's recoil, spread over the stroke of the recoil system.
    const ri = this.recoilImpulse;
    if (ri && ri.t > 0) {
      b.applyForce(_v.copy(ri.dir).multiplyScalar(-ri.j / 0.15), ri.at);
      ri.t -= dt;
    }

    // Track speeds: drive minus ground reaction, rolling losses and brakes.
    const roll = d.rollCoef;
    for (let i = 0; i < 2; i++) {
      const surfRoll = 0.6 * (this._avgRoll ?? 0.05);
      const resist = (roll + surfRoll) * loads[i];
      // Semi-implicit: the ground's grip is stiff, so include it in the track's
      // effective mass for this step (keeps the simulation stable).
      const me = m[i] + stiff[i] * dt;
      let v = this.trackSpeed[i] + ((drive[i] - ground[i]) * dt) / me;
      // Rolling resistance and brakes oppose the track's motion but can't reverse it.
      const stop = ((resist + brake[i]) * dt) / me;
      if (Math.abs(v) <= stop) v = 0;
      else v -= Math.sign(v) * stop;
      this.trackSpeed[i] = v;
    }
    if (lock) {
      // Tracks tied together (cross-shaft or differential with nothing braked).
      const vm = (this.trackSpeed[0] * m[0] + this.trackSpeed[1] * m[1]) / (m[0] + m[1]);
      this.trackSpeed[0] = this.trackSpeed[1] = vm;
    } else if (diffTarget !== null) {
      // Controlled differential: push the speeds apart (momentum-conserving), as
      // far as the steering brake can hold.
      const me0 = m[outer] + stiff[outer] * dt,
        me1 = m[inner] + stiff[inner] * dt;
      const err = diffTarget - (this.trackSpeed[outer] - this.trackSpeed[inner]);
      const cap = d.brakeForce * a * dt;
      const J = clamp(err / (1 / me0 + 1 / me1), -cap, cap);
      this.trackSpeed[outer] += J / me0;
      this.trackSpeed[inner] -= J / me1;
    }
    this.slipping = clamp(Math.abs(vMean - this.speed) / 2, 0, 1);
    this._shift(dt);
  }

  step(dt) {
    super.step(dt);
    for (let i = 0; i < 2; i++) this.trackDist[i] += this.trackSpeed[i] * dt;
    this._turret(dt);
    this.coax.update(dt);
    this.bowMg.update(dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt * (this.modules.gun > 0 ? 1 : 0);
      if (this.reloadT <= 0 && this.nextAmmo && this.stowed[this.nextAmmo] > 0) {
        this.loaded = this.nextAmmo;
        this.stowed[this.nextAmmo]--;
        this.game.audio?.play?.('boltClose', this.body.position, { volume: 0.9, rate: 0.55 });
      }
    }
    this.recoil = Math.max(0, this.recoil - dt * 2.5);
  }

  // ------------------------------------------------------------------ turret and gun
  // The gunner wants the gun to point at a world direction (yaw, pitch). The
  // turret traverses toward it at its real speed (power traverse needs the engine
  // running; otherwise slow hand cranking). Only stabilized guns hold their
  // elevation steady while the hull pitches.
  _turret(dt) {
    const t = this.def.turret;
    const powered = this.engineOn && this.modules.engine > 0;
    const jammed = this.modules.turret <= 0;
    // Desired yaw relative to the hull.
    const hullQ = this.body.quaternion;
    const aimDir = _v.set(-Math.sin(this.aim.yaw) * Math.cos(this.aim.pitch), Math.sin(this.aim.pitch), -Math.cos(this.aim.yaw) * Math.cos(this.aim.pitch));
    const local = _v2.copy(aimDir).applyQuaternion(_q.copy(hullQ).invert());
    const wantYaw = Math.atan2(-local.x, -local.z);
    const err = wrapAngle(wantYaw - this.turretYaw);
    const maxRate = (jammed ? 0 : powered ? t.traverse : t.manualTraverse) * DEG;
    // Slow down near the target so it doesn't overshoot.
    const want = clamp(err * 6, -maxRate, maxRate);
    this.turretRate = approach(this.turretRate, want, (powered ? t.traverseAccel : 30) * DEG * dt);
    this.turretYaw = wrapAngle(this.turretYaw + this.turretRate * dt);

    // Elevation: in the turret's frame.
    _q.setFromAxisAngle(_v2.set(0, 1, 0), this.turretYaw).premultiply(hullQ);
    const inTurret = _v2.copy(aimDir).applyQuaternion(_q.invert());
    const wantRel = Math.atan2(inTurret.y, Math.hypot(inTurret.x, inTurret.z)) + this.superElev;
    const [lo, hi] = t.elevation;
    const rate = t.elevRate * DEG;
    // Pitch of the turret itself along the line of the gun.
    const turretPitch = this._gunWorldPitch() - this.gunElev;
    if (t.stabilizer && powered) {
      // Gyrostabilizer: the gun holds its angle in space while the hull pitches;
      // the gunner moves it at the hand-wheel rate.
      this.stabPitch = approach(this.stabPitch, wantRel + turretPitch, rate * dt);
      this.gunElev = clamp(this.stabPitch - turretPitch, lo * DEG, hi * DEG);
    } else {
      // Elevation is set by hand against the turret: hull pitching moves the aim.
      this.gunElev = clamp(approach(this.gunElev, wantRel, rate * dt), lo * DEG, hi * DEG);
      this.stabPitch = this.gunElev + turretPitch;
    }
  }

  // Pitch of the gun barrel in the world (radians).
  _gunWorldPitch() {
    const dir = this.boreDir(_v2);
    return Math.asin(clamp(dir.y, -1, 1));
  }

  // Direction the barrel points (world).
  boreDir(out = new THREE.Vector3()) {
    _q.setFromAxisAngle(_v.set(0, 1, 0), this.turretYaw).premultiply(this.body.quaternion);
    out.set(0, Math.sin(this.gunElev), -Math.cos(this.gunElev)).applyQuaternion(_q);
    return out;
  }

  // Line of sight of the gunner's telescope: the bore minus the range setting.
  sightDir(out = new THREE.Vector3()) {
    _q.setFromAxisAngle(_v.set(0, 1, 0), this.turretYaw).premultiply(this.body.quaternion);
    const e = this.gunElev - this.superElev;
    out.set(0, Math.sin(e), -Math.cos(e)).applyQuaternion(_q);
    return out;
  }

  muzzleWorld(out = new THREE.Vector3()) {
    if (this.anchorWorld('muzzle', out)) return out;
    // No model anchor: estimate from the turret.
    return out.copy(this.body.position).addScaledVector(this.boreDir(_v), this.def.dims[2] * 0.6).add(_v.set(0, this.def.dims[1] * 0.45, 0));
  }

  // Sight range drum: raises the gun above the line of sight for the distance.
  setSightRange(r) {
    const [mn, mx, step] = this.def.gun.sight.ranges;
    this.sightRange = clamp(Math.round(r / step) * step, mn, mx);
    // (Out of every kind of shell: zero for the first kind, ready for a resupply.)
    const shell = SHELLS[this.loaded || this.nextAmmo || this.ammoTypes[0]];
    if (!shell) return;
    const key = `${shell.id}:${this.sightRange}`;
    if (!this._zeroCache.has(key)) {
      const atm = this.world.atmosphere;
      const a = this.sightRange > 0 ? solveZero(shell, shell.mv, 0.3, this.sightRange, atm) : 0;
      this._zeroCache.set(key, a);
    }
    this.superElev = this._zeroCache.get(key);
  }

  selectAmmo(i) {
    const id = this.ammoTypes[i];
    if (!id || this.stowed[id] <= 0 && this.loaded !== id) return false;
    this.ammoIndex = i;
    this.nextAmmo = id;
    // Unload what's in the breech and load the new type.
    if (this.loaded && this.loaded !== id) {
      this.stowed[this.loaded]++;
      this.loaded = null;
      this.reloadT = this.def.gun.reload * this._loaderFactor();
    } else if (!this.loaded && this.reloadT <= 0) this.reloadT = this.def.gun.reload * this._loaderFactor();
    this.setSightRange(this.sightRange);
    return true;
  }

  _loaderFactor() {
    // (Gunner: a crewman's combat badge, game/badges.js.)
    const gunner = Math.min(1, ...this.occupants.map((o) => (o ? badgeValue(o, 'gunner', 1) : 1)));
    return (this.modules.gun < 1 ? 1.6 : 1) * gunner;
  }

  // Fire the main gun. Returns the projectile or null.
  fireMain(owner) {
    if (!this.loaded || this.reloadT > 0 || this.modules.gun <= 0 || !this.alive) return null;
    const g = this.game;
    const shell = SHELLS[this.loaded];
    const muzzle = this.muzzleWorld(new THREE.Vector3());
    const dir = this.boreDir(new THREE.Vector3());
    // Gun and ammunition dispersion: about 0.3 mil.
    const sigma = 0.0003;
    dir.x += gaussRandom(0, sigma);
    dir.y += gaussRandom(0, sigma);
    dir.z += gaussRandom(0, sigma);
    dir.normalize();
    const mv = shell.mv * (1 + gaussRandom(0, 0.004));
    const v = this.body.velocity;
    const p = g.projectiles.fire({
      x: muzzle.x,
      y: muzzle.y,
      z: muzzle.z,
      vx: dir.x * mv + v.x,
      vy: dir.y * mv + v.y,
      vz: dir.z * mv + v.z,
      ammo: shell,
      owner,
      weapon: { name: this.def.gun.name, id: this.def.id, vehicle: true, sound: 'tankGun' },
      tracer: true,
    });
    p.ignoreVehicle = this;
    owner?.tally?.shot(p.weapon, owner);
    // Recoil: shell and powder gas momentum pushes the whole tank (the recoil
    // system spreads it over a few tenths of a second).
    const impulse = shell.mass * mv + shell.mass * 0.45 * 1400;
    const at = this.anchorWorld('gunnerEye', _v2) || this.body.position;
    this.recoilImpulse = { j: impulse, dir: dir.clone(), at: at.clone(), t: 0.15 };
    this.recoil = 1;
    this.loaded = null;
    if (this.stowed[this.nextAmmo] <= 0) {
      // Out of this type: switch to whatever is left.
      const other = this.ammoTypes.find((id) => this.stowed[id] > 0);
      if (other) {
        this.nextAmmo = other;
        this.ammoIndex = this.ammoTypes.indexOf(other);
      } else this.nextAmmo = null;
    }
    this.reloadT = this.nextAmmo ? this.def.gun.reload * this._loaderFactor() : 0;
    g.effects?.tankMuzzle ? g.effects.tankMuzzle(muzzle, dir) : g.effects?.muzzle(muzzle.x, muzzle.y, muzzle.z, dir.x, dir.y, dir.z, 6);
    g.audio?.gunshot?.('tankGun', muzzle.x, muzzle.y, muzzle.z, { isLocal: owner === g.player?.soldier });
    g.onVehicleFire?.(this, muzzle, dir);
    return p;
  }

  syncModel(dt = 0) {
    super.syncModel();
    const parts = this.model.parts || {};
    if (parts.turret) parts.turret.rotation.y = this.turretYaw;
    if (parts.gun) {
      parts.gun.rotation.x = this.gunElev;
      // The barrel runs back in its cradle when it fires.
      const back = this.recoil > 0.5 ? (this.recoil - 0.5) * 2 * 0.3 : 0;
      const piv = this.partPivots.gun.clone().sub(this.partPivots.turret);
      parts.gun.position.copy(piv).add(_v.set(0, Math.sin(this.gunElev), -Math.cos(this.gunElev)).multiplyScalar(-back));
    }
    // Road wheels follow the suspension and spin with the track.
    for (const w of this.wheels) {
      if (!w.part) continue;
      const travel = clamp(w.compression - w.droop, -w.droop, w.bump + 0.05);
      w.part.position.set(w.model.x, w.model.y + travel, w.model.z);
      w.part.rotation.x = -this.trackDist[w.track] / w.radius;
    }
    for (const [name, i, rad] of [
      ['sprocketL', 0, this.def.sprocketRadius],
      ['sprocketR', 1, this.def.sprocketRadius],
      ['idlerL', 0, this.def.sprocketRadius * 0.9],
      ['idlerR', 1, this.def.sprocketRadius * 0.9],
    ]) {
      const p = parts[name];
      if (p) p.rotation.x = -this.trackDist[i] / rad;
    }
    this.model.root.updateMatrixWorld(true);
    this.trackRenderer?.update(this);
    this.updateArmor();
  }
}

// A machine gun fixed in the vehicle (coaxial or bow): belt fed, real rate of fire.
export class MountedGun {
  constructor(def) {
    this.def = def;
    this.loaded = def ? def.belt : 0;
    this.belts = def ? def.belts : 0;
    this.trigger = false;
    this.cooldown = 0;
    this.reloadT = 0;
    this.shots = 0;
    this.heat = 0;
    this.pending = 0;
  }

  update(dt) {
    if (!this.def) return;
    this.heat = Math.max(0, this.heat - dt * 6);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0 && this.belts > 0) {
        this.belts--;
        this.loaded = this.def.belt;
      }
      return;
    }
    this.cooldown -= dt;
    if (this.trigger && this.loaded > 0) {
      const interval = 60 / this.def.rpm;
      while (this.cooldown <= 0 && this.loaded > 0) {
        this.cooldown = Math.max(this.cooldown, -interval) + interval;
        this.loaded--;
        this.shots++;
        this.heat += 1;
        this.pending++;
      }
    } else this.cooldown = Math.max(this.cooldown, 0);
    if (this.loaded === 0 && this.belts > 0 && this.reloadT <= 0) this.reloadT = 7;
  }

  takeShots() {
    const n = this.pending;
    this.pending = 0;
    return n;
  }
}
