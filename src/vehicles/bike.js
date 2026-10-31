// Motorcycles, sidecar outfits and bicycles.
//
// A solo machine stays up only because its rider steers it under its own weight,
// so it gets its own physics instead of the car's rigid hull:
//  - The machine rolls (leans) about the line where its tires touch the ground,
//    an inverted pendulum: gravity tips it over, the sideways push of the tires
//    stands it up. In a steady turn the two balance: tan(lean) = v^2 / (g R).
//  - The rider balances by steering, abstracted: A/D asks for a turn, and the
//    rider rolls the machine to the lean that turn needs while the bars follow
//    the lean. (A real rider countersteers to roll in, a swing the wrong way
//    first; for gameplay he rolls it in by his weight, so the machine turns the
//    way the key says at once and stops turning soon after it is let go.)
//    Steering can only balance a machine that is moving: at walking pace it
//    wobbles, and below about 1 m/s the rider puts a foot down.
//  - He rides within the grip: leaned over he keeps some in hand, eases the
//    throttle so the rear tire can hold the line, and doesn't change gear.
//  - The tires grip by the ground (SURFACE_INFO) with a friction circle shared by
//    braking, drive and cornering. Asking for more lean than the grip allows (on
//    mud or grass) washes the tires out: the machine falls and slides and the
//    rider is thrown off, hurt at speed. So does hitting a wall or a vehicle.
//    (For gameplay a turn held hard over never does: leaned past where he
//    wants to be, he hauls the machine back up. See _rollSupport.)
//  - Braking pitches the machine on its springs and moves weight to the front, so
//    the front brake does most of the work; a locked rear wheel skids.
//  - Sidecar outfits don't lean: three wheels, asymmetric. The sidecar's mass
//    drags the outfit toward it under power and swings it away under braking;
//    turning hard toward the sidecar lifts its wheel ("flying the chair") and
//    can roll the outfit over onto the bike side. The rider turns no harder
//    than the outfit takes either way, brings the chair down when it lifts,
//    and catches the rear when it slides out.
//  - Bicycles are driven by the soldier's legs: force falls with cadence (about
//    600 W at best), a steady cruise (stronger than a real rider's: see bikeDefs.js), and sprints spend his stamina (the
//    work he can do above his critical power, W').
// The heading, position and speeds follow a single-track (bicycle) model with
// tire slip; pitch and heave come from the wheel springs. Units: SI.
import * as THREE from 'three';
import { Vehicle, sphereBox, ACCEL_GAIN, TURN_CIRCLE, TURN_GRIP, ROLL_CG, CRASH_SAFE, crashDamage, crashInjury, fallInjury } from './vehicle.js';
import { STAMINA_POOL, STAMINA_REGEN } from '../actors/body.js';
import { MountedGun } from './tracked.js';
import { magic } from './wheeled.js';
import { FLAG_SOLID, FLAG_WALKABLE, RayHit, Box, CollisionWorld } from '../physics/collision.js';
import { SURFACE_INFO } from '../world/heightfield.js';
import { G, clamp, approach, damp, smoothstep, wrapAngle, DEG, rand } from '../core/math.js';

const SUB = 4; // physics sub-steps per tick
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _axis = new THREE.Vector3();
const _hit = new RayHit();
const _boxes = [];
const X = new THREE.Vector3(1, 0, 0);
const _rh = new RayHit();

// Rolling resistance of the tires on each ground (index = SURF id: grass, dry
// grass, dirt, mud, rock, field, cobble, forest, road, sand, water, wheat). The
// period's tires: 28 x 1 1/2 in bicycle tires at 3-4 bar, 4.00-18 / 4.50-16
// bias-ply motorcycle tires at 1.5-2 bar. Hard roads 0.012-0.02, soft ground far
// worse (est. from published rolling-resistance tables).
const ROLL = {
  bicycle: [0.05, 0.04, 0.022, 0.14, 0.012, 0.09, 0.018, 0.06, 0.015, 0.18, 0.3, 0.07],
  motorcycle: [0.05, 0.045, 0.03, 0.12, 0.02, 0.09, 0.022, 0.06, 0.022, 0.15, 0.4, 0.07],
};

// Slip angle (rad) at which the tire curve used here (magic(x, 9.5, 1.9, 0.95))
// gives a fraction `f` of the peak force; past the peak, the peak.
const TIRE_B = 9.5,
  TIRE_C = 1.9,
  TIRE_E = 0.95;
const TIRE_YPEAK = (() => {
  const target = Math.tan(Math.PI / 2 / TIRE_C);
  let y = 1;
  for (let i = 0; i < 30; i++) y -= (0.05 * y + TIRE_E * Math.atan(y) - target) / (0.05 + TIRE_E / (1 + y * y));
  return y;
})();
export function magicInv(f) {
  if (!(f > 0)) return 0;
  if (f >= 0.999) return TIRE_YPEAK / TIRE_B;
  const target = Math.tan(Math.asin(f) / TIRE_C);
  let y = target;
  for (let i = 0; i < 6; i++) {
    const g = (1 - TIRE_E) * y + TIRE_E * Math.atan(y) - target;
    y -= g / (1 - TIRE_E + TIRE_E / (1 + y * y));
    if (y < 0) y = 0;
  }
  return Math.min(y, TIRE_YPEAK) / TIRE_B;
}

// The share of full lock a rider turns with when slow (the rest he keeps in
// hand to balance with): 0.6 of it, and for gameplay tighter turns
// than that gives (TURN_CIRCLE in vehicle.js).
export const LOCK_USE = 0.6 / TURN_CIRCLE;

// Gameplay: the bicycle's rider picks up speed three times as fast as his legs
// alone would push him (the motorcycles get ACCEL_GAIN, vehicle.js).
const PEDAL_GAIN = 3;

// Gameplay: the share of the pull of a hill the bicycle's rider is spared, so
// a climb slows him about 3 km/h (2 mph) less than it would.
const HILL_HELP = 0.33;

// Gameplay: what soft ground (grass, leaf litter, crops, fields, mud, sand)
// adds to a bicycle's rolling resistance over a hard road's is cut to this
// share. With the real figures his steady 160 W, which gives 18 km/h on a road,
// gave 9 km/h on grass and 5 on a ploughed field (slower than a soldier jogs),
// in mud or sand his legs could not get it rolling at all, and nine tenths of
// a battlefield is soft ground. (He also works harder there: see _legs.)
const SOFT_ROLL = 0.3;
const HARD_ROLL = ROLL.bicycle[8]; // (a road)

// Gameplay: riders roll into a lean, and back up out of it, this many times
// quicker than a careful rider would, so a machine answers A and D about as
// briskly as a car and stops turning soon after the key is let go.
const ROLL_QUICK = 2;

// Gameplay: as with the cars (TURN_GRIP, vehicle.js), tires grip harder
// sideways than the real ones, and riders may lean a little past the point
// where a footboard or cylinder head would touch the road, so the machines
// turn harder at speed.
const BIKE_GRIP = TURN_GRIP;
const LEAN_EXTRA = 0.1; // rad

// How far a rider overrates the grip of each ground (index = SURF id): roads,
// dirt and cobbles look what they are; grass, fields and leaf litter are
// slipperier than they look, so riders lean too far on them (est.).
const MISJUDGE = [0.12, 0.08, 0.03, 0.1, 0.03, 0.1, 0.03, 0.1, 0.03, 0.1, 0.1, 0.1];

// Mass and kit of a soldier on board (kg), and where his own center of mass sits
// above his hip point.
const MAN = 75;
const MAN_CG = { bicycle: [0, 0.22, -0.16], motorcycle: [0, 0.24, -0.08], pillion: [0, 0.24, -0.04], sidecar: [0, 0.18, -0.12] };

export class Bike extends Vehicle {
  constructor(game, def, model, x, z, yaw) {
    super(game, def, model, x, z, yaw);
    this.isBike = true;
    this.pedal = !!def.pedal;
    this.rig = !!def.sidecar;
    this.engineOn = false; // parked: engine off, on the stand
    const parts = model.parts || {};
    this.partPivots = {};
    for (const [k, g] of Object.entries(parts)) this.partPivots[k] = g.position.clone();
    const st = def.steering;
    this.rake = st.rake;
    this.headPoint = new THREE.Vector3(...st.head);
    this.steerAxis = new THREE.Vector3(0, Math.cos(st.rake), Math.sin(st.rake));

    // Wheels: front, rear and the sidecar's.
    const L = def.wheelbase;
    const s = def.suspension;
    this.wheels = [];
    this.wF = this._wheel('front', 0, -L / 2, def.wheelRadiusF ?? def.wheelRadius, s.front, parts.wheelF);
    this.wR = this._wheel('rear', 0, L / 2, def.wheelRadius, s.rear, parts.wheelR);
    this.wF.steer = true;
    this.wR.driven = 1 - (def.sidecar?.driven || 0);
    if (this.rig) {
      const sc = def.sidecar;
      this.wS = this._wheel('side', sc.track, sc.z, sc.wheelRadius ?? def.wheelRadius, s.side, parts.wheelS);
      this.wS.driven = sc.driven || 0;
    }
    this.rollTable = ROLL[def.tire] || ROLL.motorcycle;
    if (this.pedal) this.rollTable = this.rollTable.map((c) => (c > HARD_ROLL ? HARD_ROLL + (c - HARD_ROLL) * SOFT_ROLL : c));
    this.wheelInertia = this.wheels.length * 0.6 * (this.pedal ? 1.6 : 9) * def.wheelRadius * def.wheelRadius;

    // Collision spheres (model space) against walls and vehicles.
    this.spheres = this._collisionSpheres();

    // State: P = ground point under the center of mass (horizontal), its
    // velocity, heading and yaw rate; O = the model origin on the ground (the
    // contact line) with its height; pitch and lean (+ = leaning right).
    const hf = game.world.hf;
    this.yaw = yaw;
    this.yawRate = 0;
    this.vx = 0;
    this.vz = 0;
    this.oy = hf.getHeight(x, z);
    this.vy = 0;
    this.pitch = 0;
    this.pitchRate = 0;
    this.lean = this.rig ? 0 : def.lean.stand ?? 0;
    this.leanRate = 0;
    this.leanTarget = 0;
    this.leanTargetRate = 0;
    this.steerTrim = 0;
    this.holdYaw = null;
    this.holdAfterTurn = false;
    this.leanPush = 0; // the rider's push into the lean he wants (N m)
    this.chairLift = 0; // outfits: how far the sidecar wheel is off the ground (rad)
    this.rigSpin = 0; // outfits: how much the rider has rolled off for a slide (0-1)
    this._gripNow = 0.7;
    this.grip = BIKE_GRIP * (def.grip ?? 1); // gameplay grip of this machine's tires (see BIKE_GRIP)
    this.steerG = 0; // front wheel steer angle on the ground (+ = right)
    this.u = 0;
    this.ay = 0;
    this.ayPath = 0;
    this.footDown = 0;
    this.onStand = !this.rig;
    this.fallen = 0; // 0 upright, else the side it lies on (-1 left, 1 right)
    this.fallT = 0;
    this.rightingT = 0;
    this.crank = 0;
    this.cadence = 0;
    this.effort = 'idle';
    this.standing = false; // out of the saddle on the pedals
    this.walking = false; // pushing it up a hill too steep to ride
    this.wMax = def.pedal ? def.pedal.wPrime * STAMINA_POOL : 0; // the rider's sprint reserve (J)
    this.wBal = this.wMax;
    this.noise = 0;
    this.noiseT = 0;
    this.kickT = 0;
    this.asleep = false;
    this.restT = 0;
    this.wakeT = 0;
    this.lastCrash = -99;
    this.offroad = false;
    this.roadGears = def.gears;
    this.roadReverse = def.reverse;
    this.paddle = 0;
    this.modules.tireF = 1;
    this.modules.tireR = 1;
    if (this.rig) this.modules.tireS = 1;
    this.input.sprint = false;
    // Sidecar machine gun.
    if (def.sidecarMg) {
      this.mg = new MountedGun(def.sidecarMg);
      this.mgPivot = new THREE.Vector3(...def.sidecarMg.pivot);
      this.mgYaw = 0; // relative to the outfit (+ = left)
      this.mgPitch = 0;
      this.mgAim = { yaw: 0, pitch: 0 }; // wanted, relative to the outfit
    }
    // Scratch vectors for riderPose (one set per seat).
    this._pose = this.seats.map(() => ({ hip: new THREE.Vector3(), handL: new THREE.Vector3(), handR: new THREE.Vector3(), footL: new THREE.Vector3(), footR: new THREE.Vector3() }));
    this._massProps(true);
    this._placeStatic(x, z);
    this.setupArmor();
    this.setupProxies();
    this._sync();
  }

  _wheel(name, x, z, r, sp, part) {
    const w = {
      name,
      x,
      z,
      radius: r,
      k: sp.k,
      c: sp.c,
      droop: sp.droop,
      bump: sp.bump,
      L: 0, // nominal static load (N)
      part: part || null,
      steer: false,
      driven: 0,
      // ground under the wheel (from the probe each tick)
      hit: false,
      nx: 0,
      ny: 1,
      nz: 0,
      planeD: 0,
      surface: 8,
      onGround: false,
      contactNow: new THREE.Vector3(),
      comp: 0,
      N: 0,
      fz: 0,
      spin: 0,
      angle: 0,
      slip: 0,
      lock: false,
      drive: 0,
      brake: 0,
      travel: 0,
      cx: 0,
      cz: 0,
    };
    this.wheels.push(w);
    return w;
  }

  // ------------------------------------------------------------------ mass
  // Total mass, center of mass and inertias with whoever is aboard; the spring
  // preloads are set for the machine with its rider so it sits at its modeled
  // height then (empty it rides a little high, loaded it sags).
  _massProps(nominal = false) {
    const d = this.def;
    let m = d.mass;
    const cg = d.cg;
    let sx = m * cg[0],
      sy = m * cg[1],
      sz = m * cg[2];
    const people = [];
    const list = nominal ? [{ seat: 0, kg: MAN + 22 }] : this.occupants.map((o, i) => (o ? { seat: i, kg: MAN + (o.body?.load ?? 22) } : null)).filter(Boolean);
    for (const p of list) {
      const seat = this.seats[p.seat];
      const hip = seat.hip;
      const o = MAN_CG[seat.style] || MAN_CG.motorcycle;
      const c = [hip[0] + o[0], hip[1] + o[1], hip[2] + o[2]];
      people.push({ kg: p.kg, c });
      m += p.kg;
      sx += p.kg * c[0];
      sy += p.kg * c[1];
      sz += p.kg * c[2];
    }
    const cx = sx / m,
      cy = sy / m,
      cz = sz / m;
    // Inertias: the machine's own about its CG moved to the total CG, plus each
    // person as a body with about 0.25 m radius of gyration.
    const [Ir, Ip, Iy] = d.inertia;
    const mb = d.mass;
    const dxb = cg[0] - cx,
      dyb = cg[1] - cy,
      dzb = cg[2] - cz;
    let Iroll = Ir + mb * (dxb * dxb + dyb * dyb);
    let Ipitch = Ip + mb * (dyb * dyb + dzb * dzb);
    let Iyaw = Iy + mb * (dxb * dxb + dzb * dzb);
    for (const p of people) {
      const dx = p.c[0] - cx,
        dy = p.c[1] - cy,
        dz = p.c[2] - cz;
      Iroll += p.kg * (dx * dx + dy * dy + 0.06);
      Ipitch += p.kg * (dy * dy + dz * dz + 0.06);
      Iyaw += p.kg * (dx * dx + dz * dz + 0.03);
    }
    if (nominal) {
      // Static loads with the rider aboard: these preload the springs.
      const W = m * G;
      const ws = this.wheels;
      if (this.rig) {
        const sc = this.wS;
        const Fs = (W * cx) / sc.x;
        const rest = W - Fs;
        // Front and rear share the rest so the pitch moments balance.
        const zf = this.wF.z,
          zr = this.wR.z;
        const Fr = (rest * (cz - zf) - Fs * (sc.z - cz)) / (zr - zf);
        this.wR.L = Math.max(0.05 * W, Fr);
        this.wF.L = Math.max(0.05 * W, rest - Fr);
        sc.L = Math.max(0.03 * W, Fs);
      } else {
        const zf = this.wF.z,
          zr = this.wR.z;
        this.wR.L = (W * (cz - zf)) / (zr - zf);
        this.wF.L = W - this.wR.L;
      }
      this.nominalMass = m;
      this.nominalCg = [cx, cy, cz];
      // Recompute with the real occupants (none at spawn).
      return this._massProps(false);
    }
    // Keep O where it is when the center of mass moves (someone got on or off).
    if (this.m !== undefined && this.px !== undefined) {
      const cyw = Math.cos(this.yaw),
        syw = Math.sin(this.yaw);
      const ox = this.px - (this.cx * cyw + this.cz * syw),
        oz = this.pz - (-this.cx * syw + this.cz * cyw);
      this.px = ox + (cx * cyw + cz * syw);
      this.pz = oz + (-cx * syw + cz * cyw);
    }
    this.m = m;
    this.cx = cx;
    // (Gameplay: a sidecar outfit's weight sits lower than the real one, as the
    // cars' does, ROLL_CG in vehicle.js, so it takes harder turns before the
    // chair lifts.)
    this.hc = this.rig ? cy * ROLL_CG : cy;
    this.cz = cz;
    // Roll about the contact line: the inertia about the CG plus m h^2.
    this.Ic = Iroll + m * (this.hc * this.hc + cx * cx);
    this.Ip = Ipitch;
    this.Iz = Iyaw;
    this.kRoll2 = Iroll / m; // radius of gyration squared (about the CG)
    this._massDirty = false;
  }

  // Sit the machine at rest on the ground where it was spawned.
  _placeStatic(x, z) {
    const cyw = Math.cos(this.yaw),
      syw = Math.sin(this.yaw);
    // x, z given = the model origin. P = O + the CG offset.
    this.px = x + (this.cx * cyw + this.cz * syw);
    this.pz = z + (-this.cx * syw + this.cz * cyw);
    this._settle(x, z);
  }

  // Each wheel on whatever is under it (the ground, or a kerb, step or bridge
  // deck), the springs at their static load: pitch from the two wheels, and a
  // sidecar outfit tilted with the ground under its third wheel. (x, z) is the
  // model origin.
  _settle(x, z) {
    const w0 = this.game.world;
    const hf = w0.hf;
    const cyw = Math.cos(this.yaw),
      syw = Math.sin(this.yaw);
    const ground = (w) => {
      const wx = x + (w.x * cyw + w.z * syw),
        wz = z + (-w.x * syw + w.z * cyw);
      const h = hf.getHeight(wx, wz);
      // (Looking down from a little above the ground: a kerb under the tire, not a bench or a roof.)
      if (w0.collision?.raycast(wx, h + 0.6, wz, 0, -1, 0, 0.9, _hit, FLAG_WALKABLE, true)) return h + 0.6 - _hit.t;
      return h;
    };
    const zF = this.wF.z,
      zR = this.wR.z;
    const hF = ground(this.wF),
      hR = ground(this.wR);
    this.pitch = Math.asin(clamp((hF - hR) / (zR - zF), -0.6, 0.6));
    this.oy = hF + zF * Math.sin(this.pitch);
    if (this.wS) {
      const s = this.wS;
      const yS = this.oy - s.z * Math.sin(this.pitch);
      this.lean = Math.asin(clamp((yS - ground(s)) / (s.x * Math.cos(this.pitch)), -0.35, 0.35));
    }
    this.vy = 0;
    this.pitchRate = 0;
    for (const w of this.wheels) w.comp = 0;
    this._settled = true; // (no spring damping kick on the first step)
  }

  _collisionSpheres() {
    const d = this.def;
    const L = d.wheelbase;
    const rF = d.wheelRadiusF ?? d.wheelRadius,
      rR = d.wheelRadius;
    const list = [
      { p: new THREE.Vector3(0, rF, -L / 2), r: rF * 0.85, wheel: true },
      { p: new THREE.Vector3(0, rR, L / 2), r: rR * 0.85, wheel: true },
    ];
    if (this.pedal) {
      list.push({ p: new THREE.Vector3(0, 0.95, -0.3), r: 0.22 });
    } else {
      list.push({ p: new THREE.Vector3(0, 0.45, -0.1), r: 0.34 }); // engine and crash bars
      list.push({ p: new THREE.Vector3(0, 0.95, -0.45), r: 0.26 }); // handlebars and headlamp
    }
    if (this.rig) {
      const sc = d.sidecar;
      list.push({ p: new THREE.Vector3(sc.bodyX, 0.45, sc.nose + 0.3), r: 0.3 });
      list.push({ p: new THREE.Vector3(sc.bodyX, 0.5, (sc.nose + sc.tail) / 2 + 0.2), r: 0.38 });
      list.push({ p: new THREE.Vector3(sc.bodyX, 0.5, sc.tail - 0.3), r: 0.34 });
    }
    return list;
  }

  // ------------------------------------------------------------------ controls
  // drive -1..1 (W/S), steer -1..1 (A/D, right positive), rear brake (Space),
  // sprint (Shift: pedal hard). S brakes; stopped, it backs up (the R 75 has a
  // reverse gear; on the others the rider walks it back with his feet).
  driverInput(drive, steer, handbrake = false, sprint = false) {
    super.driverInput(drive, steer, handbrake);
    this.input.sprint = !!sprint;
    if (this.input.throttle > 0.05 || Math.abs(steer) > 0.05) this.wake();
  }

  gearRatio(gear = this.gear) {
    const d = this.def;
    if (gear === 0) return 0;
    if (gear < 0) return d.reverse ? -d.reverse * d.finalDrive : 0;
    return d.gears[gear - 1] * d.finalDrive;
  }

  // (As the base class, without the truck's gearbox clunk: sound.js plays the
  // motorcycle's own.)
  _startShift(g, time = this.def.shiftTime) {
    this.nextGear = g;
    this.gear = 0;
    this.shiftTimer = time / ACCEL_GAIN; // (gameplay: quicker changes)
  }

  // Force needed to keep going (for the gear choice): hill, tires and air.
  _resistance() {
    const v = Math.abs(this.speed);
    return this.m * G * (Math.max(0, Math.sin(Math.atan(this._grade()))) + this._rolling()) + 0.5 * 1.2 * (this.def.cda ?? 0.8) * v * v;
  }

  // Rolling resistance coefficient of the ground under the wheels.
  _rolling() {
    let crr = 0,
      n = 0;
    for (const w of this.wheels)
      if (w.onGround) {
        crr += this.rollTable[w.surface] ?? 0.03;
        n++;
      }
    return n ? crr / n : 0.03;
  }

  // The ground's rise per meter along the heading, under the wheels (not the
  // machine's own pitch, which squats and dives on its springs).
  _grade() {
    let s = 0,
      n = 0;
    const fx = -Math.sin(this.yaw),
      fz = -Math.cos(this.yaw);
    for (const w of this.wheels)
      if (w.hit && w !== this.wS) {
        s -= (w.nx * fx + w.nz * fz) / w.ny;
        n++;
      }
    return n ? s / n : Math.tan(this.pitch);
  }

  // R 75: the off-road range is selected at a standstill (a lever by the tank),
  // when the ground under the machine is soft or steep.
  _chooseRange() {
    const d = this.def;
    if (!d.offroadGears) return;
    const soft = this.wheels.some((w) => w.hit && SURFACE_INFO[w.surface]?.mu < 0.5);
    const steep = Math.abs(this.pitch) > 0.15;
    const want = soft || steep;
    if (want === this.offroad) return;
    this.offroad = want;
    d.gears = want ? d.offroadGears : this.roadGears;
    d.reverse = want ? d.offroadReverse : this.roadReverse;
  }

  // ------------------------------------------------------------------ simulation
  step(dt) {
    if (this.asleep) {
      if (this.fire > 0) this._burn(dt);
      this.wakeT -= dt;
      if (this.wakeT > 0) return;
      this.wakeT = 0.25;
      if (!this._shouldWake()) return;
      this.wake();
    }
    if (!this.alive) {
      this.deadTime += dt;
      this.engineOn = false;
    }
    if (this.fire > 0) this._burn(dt);
    // Somebody left (or was killed in the saddle): weight and owner change.
    const aboard = this.occupants.reduce((n, o) => n + (o ? 1 : 0), 0);
    if (aboard !== this._aboard) {
      this._aboard = aboard;
      this._massDirty = true;
      if (!aboard && this.homeTeam !== undefined) this.team = this.homeTeam;
    }
    if (this._massDirty) this._massProps();
    const rider = this.occupants[0];
    const inp = this.input;
    if (!rider || !this.alive) {
      inp.throttle = 0;
      inp.brake = rider || this.fallen || Math.abs(this.u) > 1 ? 0 : 0.6;
      inp.steer = 0;
      inp.sprint = false;
    }
    // Starting the engine (a kick) when the rider gets on.
    if (rider && !this.pedal && !this.engineOn && this.alive && this.modules.engine > 0 && !this.fallen) {
      this.kickT += dt;
      if (this.kickT > 0.9) {
        this.engineOn = true;
        this.kickT = 0;
      }
    } else this.kickT = 0;
    if (!rider && this.engineOn && Math.abs(this.u) < 0.5) this.engineOn = false;
    if (this.rightingT > 0) this._righting(dt);
    this._probe();
    if (this.latCap) this.latCapAvg = this.latCapAvg ? damp(this.latCapAvg, this.latCap, 3, dt) : this.latCap;
    const h = dt / SUB;
    this.lastImpact = 0;
    this._rideNoise(dt);
    for (let i = 0; i < SUB; i++) this._substep(h);
    this._collide(dt);
    this._people();
    // Keep inside the map.
    const lim = this.world.hf.half - 40;
    this.px = clamp(this.px, -lim, lim);
    this.pz = clamp(this.pz, -lim, lim);
    const prev = this.speed;
    this.speed = this.u;
    this.accel = (this.accel ?? 0) + ((this.speed - prev) / dt - (this.accel ?? 0)) * Math.min(1, dt * 2);
    if (!this.pedal && rider && !this.fallen) {
      if (this.gear === 0 && this.shiftTimer <= 0 && Math.abs(this.u) < 0.5) this._chooseRange();
      // No gear changes leaned over in a bend (slowing there with the throttle
      // held back is not a hill to change down for, and the jolt upsets it).
      this.holdGear = !this.rig && Math.abs(this.lean) > 0.12;
      this._shift(dt);
    }
    if (this.pedal) this._stamina(dt);
    this._crashChecks(dt);
    if (this.mg) this._mgStep(dt);
    this._sync();
    if (this.proxies) this.updateProxies();
    if (this.lastImpact > CRASH_SAFE && !this.fallen) this.damage(crashDamage(this.lastImpact, this.maxHp), null, 'crash');
    for (const o of this.occupants) if (o) this._seatOccupant(o);
    // Parked and settled: stop simulating until something disturbs it.
    const still = Math.hypot(this.vx, this.vz) < 0.03 && Math.abs(this.yawRate) < 0.02 && Math.abs(this.leanRate) < 0.03 && Math.abs(this.vy) < 0.05 && Math.abs(this.pitchRate) < 0.03;
    if (!this.occupants.some(Boolean) && still && this.fire <= 0 && this.rightingT <= 0) {
      this.restT += dt;
      if (this.restT > 1.5) this.asleep = true;
    } else this.restT = 0;
  }

  wake() {
    this.asleep = false;
    this.restT = 0;
  }

  _shouldWake() {
    if (this.occupants.some(Boolean) || this.fire > 0) return true;
    const p = this.body.position;
    for (const v of this.game.vehicles || []) {
      if (v === this || v.asleep) continue;
      const q = v.body.position;
      const r = 4 + Math.hypot(v.def.dims[0], v.def.dims[2]) / 2;
      if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < r * r && (Math.abs(v.speed) > 0.3 || v.body.velocity.lengthSq() > 0.1)) return true;
    }
    return false;
  }

  // Ground under each wheel: height, slope and surface (one ray per wheel per tick).
  _probe() {
    const coll = this.world.collision;
    const hf = this.world.hf;
    const cyw = Math.cos(this.yaw),
      syw = Math.sin(this.yaw);
    const ox = this.px - (this.cx * cyw + this.cz * syw),
      oz = this.pz - (-this.cx * syw + this.cz * cyw);
    for (const w of this.wheels) {
      const wx = ox + (w.x * cyw + w.z * syw),
        wz = oz + (-w.x * syw + w.z * cyw);
      const yf = this.oy - w.x * Math.sin(this.lean) * Math.cos(this.pitch) - w.z * Math.sin(this.pitch);
      const y0 = yf + w.radius + 0.25;
      if (coll.raycast(wx, y0, wz, 0, -1, 0, w.radius + 1.6, _hit, FLAG_WALKABLE, true)) {
        w.hit = true;
        w.nx = _hit.nx;
        w.ny = Math.max(0.3, _hit.ny);
        w.nz = _hit.nz;
        const gy = y0 - _hit.t;
        w.gy = gy;
        w.planeD = w.nx * wx + w.ny * gy + w.nz * wz;
        w.surface = _hit.ground ? hf.getSurface(wx, wz) : _hit.box?.owner?.isVehicle ? 4 : 6;
      } else w.hit = false;
    }
    // An outfit sits tilted with the ground across it (as lean: + = down to
    // the right): the ground under the sidecar wheel against the ground under
    // the motorcycle's own wheels there. Its chair is off the ground only by
    // as much as it leans past that.
    const sc = this.wS;
    if (sc && sc.hit && this.wF.hit && this.wR.hit) {
      const t = (sc.z - this.wF.z) / (this.wR.z - this.wF.z);
      const line = this.wF.gy + (this.wR.gy - this.wF.gy) * t;
      this.groundLean = Math.asin(clamp((line - sc.gy) / (sc.x * Math.cos(this.pitch)), -0.5, 0.5));
    }
    let mu = 0,
      mis = 0,
      n = 0;
    for (const w of this.wheels)
      if (w.hit) {
        mu += SURFACE_INFO[w.surface]?.mu ?? 0.6;
        mis += MISJUDGE[w.surface] ?? 0.05;
        n++;
      }
    this._gripNow = n ? mu / n : 0.6;
    this._misjudge = n ? mis / n : 0.05;
    // Wading.
    const wl = this.world.waterLevelAt?.(this.px, this.pz);
    this.waterDepth = wl === null || wl === undefined ? 0 : Math.max(0, wl - this.oy);
  }

  // Small disturbances (road, gusts, the rider's own wobble): they only show at
  // walking pace, where steering has little authority to correct them.
  _rideNoise(dt) {
    this.noiseT -= dt;
    if (this.noiseT <= 0) {
      this.noiseT = 0.25 + rand() * 0.35;
      this.noiseTarget = (rand() * 2 - 1) * (this.pedal ? 1 : 0.6);
    }
    this.noise = damp(this.noise, this.noiseTarget || 0, 4, dt);
  }

  _substep(h) {
    const d = this.def;
    const m = this.m;
    const cyw = Math.cos(this.yaw),
      syw = Math.sin(this.yaw);
    const fx = -syw,
      fz = -cyw,
      rx = cyw,
      rz = -syw;
    const ox = this.px - (this.cx * cyw + this.cz * syw);
    const oz = this.pz - (-this.cx * syw + this.cz * cyw);
    const r = this.yawRate;
    // Velocity of the contact-line origin.
    const vOx = this.vx + r * (oz - this.pz),
      vOz = this.vz - r * (ox - this.px);
    const u = vOx * fx + vOz * fz;
    this.u = u;
    const sinL = Math.sin(this.lean),
      cosL = Math.cos(this.lean);
    const sinP = Math.sin(this.pitch),
      cosP = Math.cos(this.pitch);

    // 1. The rider: steering, throttle, brakes, feet.
    this._rider(h, u);
    this._drivetrain(h, u);

    // 2. Springs: vertical load on each wheel.
    let Fy = 0,
      Mp = 0,
      Msc = 0,
      nGround = 0;
    let nX = 0,
      nZ = 0,
      Nsum = 0;
    for (const w of this.wheels) {
      const wx = ox + (w.x * cyw + w.z * syw),
        wz = oz + (-w.x * syw + w.z * cyw);
      w.cx = wx;
      w.cz = wz;
      const yf = this.oy - w.x * sinL * cosP - w.z * sinP;
      let N = 0;
      let comp = -1;
      if (w.hit && !this.fallen) {
        const gy = (w.planeD - w.nx * wx - w.nz * wz) / w.ny;
        comp = gy - yf;
        if (comp > -w.droop) {
          N = w.k * comp + w.L;
          const t = (comp + w.droop) / 0.015;
          if (t < 1) N *= t;
          if (comp > w.bump) N += 12 * w.k * (comp - w.bump);
          if (!this._settled) N += (w.c * (comp - w.comp)) / h;
          if (N < 0) N = 0;
          w.contactNow.set(wx, gy, wz);
        }
      }
      w.comp = comp;
      w.N = N;
      w.fz = N;
      w.onGround = N > 0;
      if (N > 0) {
        nGround++;
        Fy += N;
        Mp += N * (this.cz - w.z);
        nX += N * w.nx;
        nZ += N * w.nz;
        Nsum += N;
        if (w === this.wS) Msc -= N * w.x * cosL;
      }
    }
    this._settled = false;
    this.contacts = nGround;

    // 3. Tires: drive, brakes, rolling resistance and cornering, each limited by
    // the grip under it (friction circle).
    let Fx = 0,
      Fz = 0,
      tau = 0,
      Flong = 0,
      slipSum = 0;
    const share = nGround ? m / nGround : m;
    for (const w of this.wheels) {
      if (w.N <= 0) {
        w.slip = 0;
        w.lock = false;
        w.spin = approach(w.spin, w.driven && w.drive > 0 ? w.spin + 2 : w.spin * 0.98, h * 30);
        continue;
      }
      let wfX = fx,
        wfZ = fz,
        wrX = rx,
        wrZ = rz;
      if (w.steer && this.steerG !== 0) {
        const ca = Math.cos(this.steerG),
          sa = Math.sin(this.steerG);
        wfX = fx * ca + rx * sa;
        wfZ = fz * ca + rz * sa;
        wrX = rx * ca - fx * sa;
        wrZ = rz * ca - fz * sa;
      }
      const dx = w.cx - this.px,
        dz = w.cz - this.pz;
      const vcx = this.vx + r * dz,
        vcz = this.vz - r * dx;
      const vLong = vcx * wfX + vcz * wfZ,
        vLat = vcx * wrX + vcz * wrZ;
      const surf = SURFACE_INFO[w.surface] || SURFACE_INFO[0];
      const flat = this.modules[w === this.wF ? 'tireF' : w === this.wR ? 'tireR' : 'tireS'] <= 0;
      const mu = surf.mu * (this.waterDepth > 0.3 ? 0.75 : 1) * (flat ? 0.55 : 1);
      const N = Math.min(w.N, w.L * 3.5 + 500);
      const maxF = mu * N;
      const maxFy = maxF * this.grip; // (sideways: gameplay grip, this.grip)
      const crr = (this.rollTable[w.surface] ?? 0.03) * (flat ? 3 : 1);
      // Along the wheel.
      let fl = w.drive;
      const stop = (Math.abs(vLong) * share) / h;
      const resist = Math.min(stop, w.brake + crr * N);
      fl -= Math.sign(vLong) * resist;
      // Across the wheel: slip angle through the tire curve; at walking pace plain
      // friction against sliding sideways.
      const slipA = Math.atan2(vLat, Math.abs(vLong) + 0.6);
      let fy = -maxFy * magic(slipA, TIRE_B, TIRE_C, TIRE_E);
      if (Math.abs(vLong) < 1.5) {
        const lowF = clamp(((-vLat * share) / h) * 0.5, -maxFy, maxFy);
        const t = Math.abs(vLong) / 1.5;
        fy = lowF * (1 - t) + fy * t;
      }
      let slip = 0;
      w.lock = false;
      if (w.brake > maxF * 1.05 && Math.abs(vLong) > 0.6) {
        // Locked: the tire slides; its friction opposes the slide, so there is
        // little left to hold the wheel's line.
        const vs = Math.hypot(vLong, vLat) || 1;
        fl = (-0.85 * maxF * vLong) / vs;
        fy = (-0.85 * maxF * vLat) / vs;
        slip = 1;
        w.lock = true;
      } else {
        // Friction circle (an ellipse with the extra sideways grip, and the
        // same extra grip for a driven tire pulling: gameplay, this.grip).
        const maxFl = fl > 0 && w.drive > 0 ? maxF * this.grip : maxF;
        const e = Math.hypot(fl / maxFl, fy / maxFy);
        if (e > 1) {
          slip = 1 - 1 / e;
          fl /= e;
          fy /= e;
        }
      }
      w.slip = slip;
      slipSum += slip;
      const FxW = fl * wfX + fy * wrX,
        FzW = fl * wfZ + fy * wrZ;
      Fx += FxW;
      Fz += FzW;
      tau += dz * FxW - dx * FzW;
      Flong += FxW * fx + FzW * fz;
      // Wheel speed: rolling, plus wheelspin or lock-up.
      let spin = vLong / w.radius;
      if (w.lock) spin = 0;
      else if (slip > 0.05 && w.driven && w.drive > 1) spin += slip * 14;
      w.spin = spin;
    }
    this.slipping = slipSum / this.wheels.length;

    // 4. Forces at the center of mass: the slope (the ground's push has a
    // horizontal part on a hill), air and water.
    if (Nsum > 0) {
      Fx += nX;
      Fz += nZ;
    }
    const sp2 = this.vx * this.vx + this.vz * this.vz;
    if (sp2 > 0.01) {
      const sp = Math.sqrt(sp2);
      const drag = 0.5 * (this.world.atmosphere?.density ?? 1.2) * (d.cda ?? 0.8) * sp;
      Fx -= drag * this.vx;
      Fz -= drag * this.vz;
      if (this.waterDepth > 0.1) {
        const wd = m * 0.6 * Math.min(1, this.waterDepth);
        Fx -= wd * this.vx;
        Fz -= wd * this.vz;
      }
    }
    // Walking it backward, or pushing a dead machine.
    if (this.paddle) {
      Fx += this.paddle * fx;
      Fz += this.paddle * fz;
    }
    // Fallen: it slides on its side.
    if (this.fallen) {
      const sp = Math.sqrt(sp2);
      if (sp > 1e-3) {
        const surf = SURFACE_INFO[this.wR.surface] || SURFACE_INFO[0];
        const muS = 0.35 + (1 - surf.mu) * 0.5;
        const f = Math.min(muS * m * G, (sp * m) / h);
        Fx -= (f * this.vx) / sp;
        Fz -= (f * this.vz) / sp;
      }
      tau -= this.yawRate * this.Iz * 2;
    }
    this.ay = (Fx * rx + Fz * rz) / m;
    // What rolls a solo machine is the path its tires follow: the centripetal
    // acceleration of its heading (the contact patches track the steered path;
    // a sliding tire can't keep the heading turning, and the machine falls in).
    this.ayPath = this.rig ? this.ay : -u * this.yawRate;

    // 5. Integrate the horizontal motion and heading.
    this.vx += (Fx / m) * h;
    this.vz += (Fz / m) * h;
    this.yawRate += (tau / this.Iz) * h;
    this.yawRate *= 1 - Math.min(0.5, 0.5 * h);
    this.px += this.vx * h;
    this.pz += this.vz * h;
    this.yaw = wrapAngle(this.yaw + this.yawRate * h);

    // 6. Heave and pitch on the springs (the drive and brake forces at the ground
    // pitch the machine: weight moves to the front when braking).
    if (this.fallen) {
      // Lying on the ground, on the handlebar and the engine or pedal.
      const gy = this.world.hf.getHeight(ox, oz) + this.fallLift;
      this.oy = damp(this.oy, gy, 8, h);
      this.vy = 0;
      this.pitch = damp(this.pitch, 0, 3, h);
      this.pitchRate = 0;
    } else {
      this.vy += (Fy / m - G) * h;
      this.oy += this.vy * h;
      const H = this.hc * cosL - this.cx * sinL;
      Mp += Flong * H;
      this.pitchRate += (Mp / this.Ip) * h;
      this.pitchRate *= 1 - Math.min(0.5, 1.5 * h);
      this.pitch += this.pitchRate * h;
    }

    // 7. Lean: an inverted pendulum about the contact line.
    const Ycg = this.cx * cosL + this.hc * sinL; // CG to the right of the contact line
    const Hcg = this.hc * cosL - this.cx * sinL; // CG height
    let Mr = m * G * Ycg - m * this.ayPath * Hcg + Msc;
    Mr += this._rollSupport(h);
    this.leanRate += (Mr / this.Ic) * h;
    this.leanRate *= 1 - Math.min(0.5, 0.8 * h);
    this.lean += this.leanRate * h;
  }

  // Moments that hold the machine up besides the tires: the rider's foot, the
  // stand, the rider shifting his weight, or the ground when it lies on its side.
  _rollSupport(h) {
    const Ic = this.Ic;
    const spring = (target, w, zeta = 0.9) => -Ic * w * w * (this.lean - target) - 2 * zeta * w * Ic * this.leanRate;
    if (this.fallen) return spring(this.fallen * this.fallAngle, 9, 1.2);
    if (this.rig) return 0;
    if (this.rightingT > 0) return 0;
    const rider = this.occupants[0];
    if (!rider) {
      if (this.onStand) return spring(this.def.lean.stand ?? 0, 14, 1);
      return 0;
    }
    // Foot down: leaning on it when stopped, the machine upright as he pushes off.
    if (this.footDown) return spring(this.footDown * 0.1 * clamp(1 - Math.abs(this.u) / 1.3, 0, 1), 11, 1);
    // Riding: the push into the lean he wants (see _rider), and his hips moving
    // a little to help the bars (and wobbles).
    const mr = MAN + 20;
    const lim = mr * G * 0.06;
    const e = this.lean - this.leanTarget;
    const slow = 1 - smoothstep(1, 4, Math.abs(this.u));
    // (Gameplay: fallen past the most lean he would ever ask for, as he can
    // when holding a hard turn at speed, he hauls the machine back up rather
    // than going down with it. Not once the tires are sliding out from under
    // him: that still puts him down.)
    const over = Math.abs(this.lean) - this._leanLimit();
    const sliding = Math.max(this.wF.slip || 0, this.wR.slip || 0) > 0.25;
    const save = over > 0 && !sliding ? -Math.sign(this.lean) * Ic * 60 * over - Ic * 8 * this.leanRate : 0;
    return (this.leanPush || 0) + clamp(-Ic * 4 * e - Ic * 1.5 * (this.leanRate - this.leanTargetRate), -lim, lim) + save + this.noise * slow * mr * G * 0.035;
  }

  // ------------------------------------------------------------------ the rider
  _rider(h, u) {
    const d = this.def;
    const inp = this.input;
    const L = d.wheelbase;
    const au = Math.abs(u);
    const rider = this.occupants[0];
    const lockG = d.steering.lock * Math.cos(this.rake);
    const kLock = Math.tan(lockG) / L;
    const steerIn = rider ? inp.steer : 0;
    this.paddle = 0;
    this.leanPush = 0;
    // Backing up without a reverse gear: the rider walks it back with his feet.
    const noReverse = this.pedal || !d.reverse || !this.engineOn;
    const backing = rider && this.wantDir < 0 && noReverse && inp.throttle > 0.05;
    if (backing) {
      this.paddle = clamp((-0.8 - u) * this.m * 3, -320, 320) * inp.throttle;
    }
    // A dead engine: he can still push it along at a walk.
    const dead = this.modules.engine <= 0 || !this.alive;
    if (rider && !this.pedal && this.wantDir > 0 && inp.throttle > 0.05 && dead) this.paddle = clamp((1.2 - u) * this.m * 2, -250, 250) * inp.throttle;
    if (this.fallen) {
      this.steerG = approach(this.steerG, 0, h * 2);
      this.footDown = 0;
      return;
    }
    if (this.rig) {
      // Sidecar outfit: steered like a car. The turn asked for is limited by the
      // lock at low speed and, at speed, by what the outfit takes: toward the
      // chair a little short of where its wheel lifts, away from it well short
      // of where the rear wheel goes light and slides (both worked out from
      // the outfit's own loads on its wheels). He eases off when the chair
      // lifts anyway.
      // (For gameplay tighter than the real lock and a careful rider
      // give, TURN_CIRCLE in vehicle.js; toward the chair its wheel lifting
      // sets the limit.)
      const side = Math.sign(this.def.sidecar.track);
      const towardChair = steerIn * side > 0;
      const lockR = Math.atan(Math.tan(lockG) / TURN_CIRCLE);
      const latG = (d.rider?.latG ?? 0.55) * G;
      const track = Math.abs(this.def.sidecar.track);
      const hc = Math.max(0.3, this.hc);
      const aChair = (this.wS.L * track) / (this.m * hc);
      const aRear = (this.wR.L * (this.wF.z - this.wR.z) * track) / ((this.wF.z - this.wS.z) * this.m * hc);
      // (And no more than the ground under it gives: grass and mud hold less.)
      const aLim = Math.min(towardChair ? Math.min(latG, 0.95 * aChair) : Math.min(latG / TURN_CIRCLE, 0.65 * aRear), 0.75 * this._gripNow * this.grip * G);
      let kappa = steerIn * Math.min(Math.tan(lockR) / L, aLim / Math.max(u * u, 0.5));
      let spin = 0;
      // Bars left alone, he holds his line (outfits are rigged to run straight,
      // but the pull under power and braking still swings them off it first).
      if (Math.abs(steerIn) < 0.05 && Math.abs(u) > 1.5 && rider) {
        if (this.holdYaw === null) this.holdYaw = this.yaw;
        const e = wrapAngle(this.yaw - this.holdYaw);
        kappa = (1.6 * e + 0.8 * this.yawRate) / Math.max(u, 2);
      } else {
        this.holdYaw = null;
        // Turning, he steers by the turn he feels as well as by the bars:
        // swinging round quicker than he asked (the rear wheel light and
        // sliding, or the driven sidecar wheel pushing it round), he steers
        // against it to catch it and rolls off the throttle (in _drivetrain).
        if (rider && u > 1.5) {
          const err = this.yawRate + u * kappa; // (yaw rate past the one asked for, + = to the left)
          const slide = clamp((this.wR.slip - 0.25) / 0.35, 0, 1); // (the rear wheel sliding out)
          kappa = kappa * (1 - 0.7 * slide) + (0.8 * err) / Math.max(u, 2);
          spin = Math.max(slide, err * kappa < 0 ? clamp((Math.abs(err) - 0.15) / 0.3, 0, 1) : 0);
        }
      }
      // (A rider's hand on the throttle, not a switch: quick to close, slower to open.)
      this.rigSpin = approach(this.rigSpin || 0, spin, (spin > (this.rigSpin || 0) ? 6 : 2) * h);
      // Turning toward the sidecar unloads its wheel: he eases off as it goes
      // light and straightens up if it lifts, so the chair flies but drops back.
      // (+ = the chair off the ground: leaning past the ground's own tilt. On
      // a hillside with the chair uphill, the plain lean read as the chair up,
      // and he would not open the throttle at all.)
      const lift = -(this.lean - (this.groundLean || 0)) * side;
      this.chairLift = lift;
      if (kappa * side > 0 && this.wS) {
        const light = this.wS.N / Math.max(1, this.wS.L);
        let ease = light < 0.3 ? 0.55 + 1.5 * light : 1;
        if (lift > 0.02) ease = Math.min(ease, clamp(1 - (lift - 0.02) / 0.1, 0, 1));
        kappa *= Math.min(1, ease);
      }
      // Turning hard away from it, the rear wheel goes light (the outfit would
      // tip over the front wheel and the chair): he eases off the same way.
      if (kappa * side < 0) {
        const light = this.wR.N / Math.max(1, this.wR.L);
        const tip = (this.lean - (this.groundLean || 0)) * side;
        let ease = light < 0.35 ? 0.5 + 1.4 * light : 1;
        if (tip > 0.04) ease = Math.min(ease, clamp(1 - (tip - 0.04) / 0.1, 0, 1));
        kappa *= Math.min(1, ease);
      }
      // The chair well up, straightening is not enough (under power the outfit
      // pulls toward the chair): he steers away from it to bring it down, and
      // rolls off the throttle (in _drivetrain).
      if (lift > 0.06 && rider) kappa = Math.min(kappa * side, 0) * side - side * clamp((lift - 0.06) * 4, 0, 1) * (aLim / Math.max(u * u, 4));
      const want = u < -0.2 ? -Math.atan(L * kappa) : Math.atan(L * kappa);
      this.steerG = approach(this.steerG, clamp(want, -lockR, lockR), (d.rider?.barRate ?? 2) * h);
      this.footDown = 0;
      return;
    }
    // Solo: balance by steering.
    if (!rider) {
      // Nobody aboard: a rolling machine keeps itself upright for a moment
      // (trail and the spinning wheels steer it into a fall), then topples.
      const self = smoothstep(3, 8, au);
      const e = this.lean;
      const aDes = G * Math.tan(this.lean) + G * self * (0.6 * e + 0.25 * this.leanRate);
      const want = au > 1 ? Math.atan((L * aDes) / Math.max(u * u, 1)) * self : 0;
      this.steerG = approach(this.steerG, clamp(want, -lockG, lockG), 3 * h);
      this.footDown = 0;
      this.leanTarget = this.lean;
      this.leanTargetRate = 0;
      return;
    }
    // (Slow, he keeps some lock in hand to balance with.)
    const tanLim = Math.tan(this._leanLimit());
    const kLean = (G * tanLim) / Math.max(u * u, 0.25);
    let kappaD = steerIn * Math.min(kLock * LOCK_USE, kLean);
    // Bars left alone under way, he holds the line he was on (pulling away
    // from a foot down swings the machine a little off it): a slow trim. The
    // line is the one he settles on coming out of a turn, not the heading he
    // had when he let go (that would turn him back toward it on its own).
    if (steerIn === 0 && au > 4) {
      const settled = Math.abs(this.yawRate) < 0.05 && Math.abs(this.lean) < 0.03 && Math.abs(this.leanTarget) < 0.02;
      if (this.holdYaw === null && (!this.holdAfterTurn || settled)) {
        this.holdYaw = this.yaw;
        this.holdAfterTurn = false;
      }
      if (this.holdYaw !== null) {
        const e = wrapAngle(this.yaw - this.holdYaw);
        kappaD = clamp((0.3 * e) / u, -0.05 * kLean, 0.05 * kLean);
      }
    } else {
      this.holdYaw = null;
      if (steerIn !== 0) this.holdAfterTurn = true;
    }
    // The rider rolls in at a human rate: a smooth reference lean, limited in
    // rate and in how fast that rate changes.
    const phiWant = Math.atan((u * u * kappaD) / G);
    // (On loose ground he changes lean more gently.)
    const rate = (d.rider?.rollRate ?? 1) * ROLL_QUICK * clamp(this._gripNow / 0.7, 0.6, 1);
    const wantRate = clamp((phiWant - this.leanTarget) * 4 * ROLL_QUICK, -rate, rate);
    const jerk = (d.rider?.rollAcc ?? 4) * ROLL_QUICK;
    const refAcc = clamp((wantRate - this.leanTargetRate) / h, -rate * jerk, rate * jerk);
    this.leanTargetRate += refAcc * h;
    this.leanTarget += this.leanTargetRate * h;
    // Feet down at walking pace (and up again once moving). Slow and leaning
    // further than full lock could bring back, he dabs a foot down to save it.
    this.dabT = Math.max(0, (this.dabT || 0) - h);
    if (this.footDown === 0) {
      if ((au < 0.7 && (inp.throttle < 0.1 || au < 0.3)) || backing || this.paddle || this.walking) this.footDown = this._footSide();
      else if (au < 3.5 && this.lean * this.leanRate > 0) {
        const tanHold = (0.8 * au * au * Math.tan(lockG)) / (L * G);
        if (Math.abs(Math.tan(this.lean)) > tanHold + 0.04) {
          this.footDown = Math.sign(this.lean);
          this.dabT = 0.8;
        }
      }
    } else if (au > (this.pedal ? 1.5 : 1.8) && !backing && !this.walking && !(this.paddle && inp.throttle > 0) && this.dabT <= 0 && (Math.abs(this.lean) < 0.02 || au > 3)) this.footDown = 0; // (once he has pushed it upright)
    if (this.footDown) {
      // (The reference picks up the machine as it is, moving, when the foot
      // comes up: from there the push rolls it upright, not the bars.)
      this.leanTarget = this.lean;
      this.leanTargetRate = this.leanRate;
      this.steerTrim = 0;
      // Pointing the bars where he wants to go, paddling.
      const want = u < -0.1 ? -Math.atan(L * steerIn * kLock) : Math.atan(L * steerIn * kLock);
      this.steerG = approach(this.steerG, want, (d.rider?.barRate ?? 2.5) * h);
      return;
    }
    // Balance: the sideways acceleration that makes the lean follow the
    // reference (I phi'' = m g H sin(phi) - m a H cos(phi) + push, solved for
    // a), then the steering that gives it at this speed. He won't ask the tires
    // for more than he thinks they have.
    // (For gameplay he rolls the machine into the lean he wants, and back out
    // of it, as if by his weight alone: the push, applied in _rollSupport. A
    // real rider countersteers first, a swing the wrong way that made A and D
    // feel backward and kept the machine turning after the key was let go; the
    // bars now only follow the lean and catch what the push leaves over.)
    const H = Math.max(0.3, this.hc);
    const k2 = this.kRoll2 + H * H;
    const wn = d.rider?.wn ?? 3.6;
    const zeta = d.rider?.zeta ?? 1.1;
    this.leanPush = this.Ic * refAcc;
    const accWant = refAcc - 2 * zeta * wn * (this.leanRate - this.leanTargetRate) - wn * wn * (this.lean - this.leanTarget);
    const cosL = Math.max(0.3, Math.cos(this.lean));
    let aDes = G * Math.tan(this.lean) - ((k2 / H) * (accWant - refAcc)) / cosL;
    const grip = this._gripNow * this.grip * G * 0.95;
    aDes = clamp(aDes, -grip, grip);
    // The bars: the path curvature plus the slip angles the tires need for that
    // turn (the front and rear share of the cornering force, on their loads),
    // and a little trim once settled for what that estimate misses.
    const sens = L / Math.max(u * u, 4);
    const settled = Math.abs(this.lean - this.leanTarget) < 0.06 && Math.abs(this.leanRate - this.leanTargetRate) < 0.25;
    if (settled) this.steerTrim += (aDes - this.ayPath) * sens * (d.rider?.trim ?? 2) * h;
    this.steerTrim = clamp(this.steerTrim * (1 - 0.3 * h), -0.05, 0.05);
    // Falling into the turn past where he wants to be: he uses all the grip
    // there is to catch it.
    const catching = this.lean * this.leanTarget >= 0 && Math.abs(this.lean) > Math.abs(this.leanTarget) + 0.02 && this.lean * this.leanRate > 0;
    let want = this._steerFor(aDes, au, catching ? 0.97 : 0.85) + this.steerTrim;
    // Slow, a big countersteer would throw the machine into a lean faster than
    // the bars can come back to catch it: he only nudges them the other way.
    // (Steering into a lean he already has, to pick it up, is not that.)
    if (want * this.leanTarget < 0 && want * this.lean < 0.002) {
      const cs = 0.3 + 0.5 * smoothstep(3, 10, au);
      want = clamp(want, -cs * lockG, cs * lockG);
    }
    if (u < 0) want = -want;
    // (Slow, he works the bars quicker: big movements, little effort.)
    const bars = (d.rider?.barRate ?? 2.5) * (2 - smoothstep(3, 9, au));
    this.steerG = approach(this.steerG, clamp(want, -lockG, lockG), bars * h);
  }

  // Front wheel steer angle for a steady sideways acceleration `ay` at speed u:
  // delta = L / R + (front slip angle - rear slip angle), the slip angles read off
  // the tire curve for each tire's share of the force (rear: what the drive leaves).
  _steerFor(ay, u, margin = 0.85) {
    const L = this.def.wheelbase;
    const a = this.cz - this.wF.z,
      b = this.wR.z - this.cz;
    const mu = this._gripNow;
    const capF = mu * this.grip * Math.max(this.wF.N, 50);
    const nR = Math.max(this.wR.N, 50);
    const capR = Math.max(50, mu * this.grip * nR * Math.sqrt(Math.max(0, 1 - (this.wR.drive / (mu * nR)) ** 2)));
    // No more than the tires give comfortably (near their peak the steering
    // needed stops growing with the turn and a rider can't use it).
    const cap = Math.min((capF * L) / b, (capR * L) / a);
    this.latCap = cap;
    const F = Math.min(this.m * Math.abs(ay), margin * cap);
    const k = 1 + 0.6 / Math.max(u, 1);
    const af = Math.atan(Math.tan(magicInv((F * b) / L / capF)) * k);
    const ar = Math.atan(Math.tan(magicInv((F * a) / L / capR)) * k);
    // (Understeer adds lock; an oversteering rear would want less, but leaning on
    // a sliding rear is a trap: he never steers less than the geometry says.)
    const s = Math.sign(ay);
    return Math.atan((L * s * F) / this.m / Math.max(u * u, 0.4)) + s * Math.max(0, af - ar);
  }

  // The most lean the rider will ask for: ground clearance, and the grip he
  // expects (riders trust the ground a little more than mud or grass deserve).
  _leanLimit() {
    const d = this.def;
    // He knows loose ground is slippery, but not quite how slippery (at a
    // walk or a trot he feels it well enough; it catches him out at speed).
    const mu = this._gripNow;
    const trust = Math.min(0.72, mu + (this._misjudge ?? 0.05) * smoothstep(6, 14, Math.abs(this.u)));
    const cap = this.latCapAvg ?? 0.6 * this.m * G;
    // Below about 35 km/h he keeps more in hand. (For gameplay he dares a
    // tighter turns than a careful rider would, TURN_CIRCLE, but always
    // keeps a quarter of the grip in hand to catch a wobble with.)
    const keep = Math.min(0.75, (0.55 + 0.2 * smoothstep(4, 10, Math.abs(this.u))) / TURN_CIRCLE);
    const tanGrip = (keep * cap * (trust / Math.max(mu, 0.1))) / (this.m * G);
    let clear = d.lean.clear - 0.04 + LEAN_EXTRA;
    // Pedaling, the inside pedal comes down: less clearance on a bicycle.
    if (this.pedal && this.effort !== 'coast' && this.effort !== 'idle') clear = Math.min(clear, (d.lean.pedal ?? 0.45) + LEAN_EXTRA);
    return Math.min(clear, Math.atan(tanGrip));
  }

  // The tightest path curvature (1/m) the rider asks for at speed u with the
  // bars full over (see _rider; the bots steer by it).
  maxCurvature(u) {
    const d = this.def;
    const lockG = d.steering.lock * Math.cos(this.rake);
    const u2 = Math.max(u * u, 0.25);
    if (this.rig) return Math.min(Math.tan(lockG) / TURN_CIRCLE / d.wheelbase, ((d.rider?.latG ?? 0.55) * G) / TURN_CIRCLE / u2);
    return Math.min((Math.tan(lockG) / d.wheelbase) * LOCK_USE, (G * Math.tan(this._leanLimit())) / u2);
  }

  _footSide() {
    if (Math.abs(this.lean) > 0.04) return Math.sign(this.lean);
    return this.def.rider?.foot ?? -1;
  }

  // Engine, gearbox and brakes (motorcycles), or the rider's legs (bicycle).
  _drivetrain(h, u) {
    const d = this.def;
    const inp = this.input;
    const rider = this.occupants[0];
    for (const w of this.wheels) {
      w.drive = 0;
      w.brake = 0;
    }
    let throttle = rider && !this.fallen && this.wantDir > 0 ? inp.throttle : 0;
    // The sidecar flying high, or the outfit swinging round on him: off the
    // throttle until it settles (see _rider).
    if (this.rig && this.chairLift > 0.04) throttle *= clamp(1 - (this.chairLift - 0.04) / 0.06, 0, 1);
    if (this.rig && this.rigSpin) throttle *= 1 - this.rigSpin;
    // Turning hard at speed on a solo machine he rolls off the throttle, so the
    // rear tire has the grip to lean on (flat out, it had none to spare and he
    // hardly dared lean until the machine stopped picking up speed).
    if (!this.rig && !this.pedal && rider && Math.abs(u) > 5) throttle *= 1 - 0.65 * Math.min(1, Math.abs(inp.steer));
    if (this.wantDir < 0 && rider && !this.fallen && !this.pedal && d.reverse && this.engineOn) throttle = inp.throttle; // reverse gear
    // Brakes: S works both, and he keeps the wheels turning on ground he knows
    // (front first: most of the stopping happens there, the weight moves
    // forward); on loose ground he misjudges it and the rear can lock. Space is
    // the rear brake alone, as hard as it goes.
    const b = inp.brake;
    const trust = (w) => Math.min(0.72, (SURFACE_INFO[w.surface]?.mu ?? 0.6) + (MISJUDGE[w.surface] ?? 0.05)) * Math.max(0, w.N);
    let bf = Math.min(b * d.brakes.front, 0.92 * trust(this.wF));
    let br = Math.min(b * d.brakes.rear, 0.95 * trust(this.wR));
    if (inp.handbrake) br = d.brakes.rear;
    // Stopped with nothing pressed: the rider (or the stand) holds it, on both
    // brakes so that it stays put on a hill. So he does while he kicks the
    // engine into life and gets it into gear (it used to roll back down a
    // hill the moment W was pressed, with nothing yet to drive it).
    const noDrive = !this.pedal && this.wantDir > 0 && (!this.engineOn || this.gear === 0 || this.shiftTimer > 0);
    if ((throttle < 0.05 || noDrive) && Math.abs(u) < 0.5 && !this.paddle) {
      br = Math.max(br, d.brakes.rear * 0.6);
      bf = Math.max(bf, d.brakes.front * 0.6);
    }
    this.wF.brake = bf;
    this.wR.brake = br;
    if (this.wS) this.wS.brake = Math.min(b * (d.brakes.side || 0), 0.95 * trust(this.wS));
    if (this.pedal) {
      this._legs(h, u, throttle);
      return;
    }
    // Engine through the gearbox to the rear wheel (and the R 75's sidecar wheel).
    const R = d.wheelRadius;
    const groundSpeed = this.wR.spin * R;
    const ratio = this._engineRpm(groundSpeed, R, throttle, h);
    const broken = this.modules.transmission <= 0;
    const torque = broken ? 0 : this._engineTorque(throttle);
    const tmax = this._tmax || (this._tmax = Math.max(...d.engine.torque.map((p) => p[1])));
    let engineBrake = 0;
    if (throttle < 0.05 && ratio !== 0 && !broken && this.engineOn) {
      const over = clamp((this.rpm - d.engine.idle * 1.3) / 500, 0, 1);
      engineBrake = -0.16 * tmax * over * Math.sign(groundSpeed || u || 1) * Math.sign(ratio);
    }
    const wheelT = (torque + engineBrake) * ratio * d.efficiency;
    const rotMass = (d.engine.inertia * ratio * ratio + this.wheelInertia) / (R * R);
    const share = this.m / (this.m + rotMass);
    // The engine and the wheels have to be spun up as well: of the push left
    // over after the hill, the ground and the air, only a share speeds the
    // machine up (and that with the gameplay gain, ACCEL_GAIN in vehicle.js).
    // What holds it against a hill is the whole push. (It used to be only the
    // share of it all: a quarter less pull at a standstill, and an outfit
    // stalled on a 20 % grass bank.)
    const push = wheelT / R;
    const hold = Math.max(0, this._resistance());
    let F = push > hold ? hold + ACCEL_GAIN * share * (push - hold) : push > 0 ? push : push * share;
    // On an outfit in a turn he keeps the rear wheel from spinning, leaving it
    // the grip the turn needs (it goes light in a turn away from the chair).
    // (At a walk he lets it spin: that is how it gets through mud and sand.)
    if (F > 0 && this.rig && this.occupants[0] && u > 3) {
      const nR = Math.max(0, this.wR.N),
        nS = Math.max(0, this.wS.N);
      const fyR = (((this.m * Math.abs(this.ay) * (this.cz - this.wF.z)) / d.wheelbase) * nR) / Math.max(1, nR + nS);
      const room = this._gripNow * this.grip * nR * Math.sqrt(Math.max(0, 1 - (fyR / (this._gripNow * this.grip * Math.max(1, nR))) ** 2)) + (this.rollTable[this.wR.surface] ?? 0.03) * nR;
      F = Math.min(F, Math.max(room / Math.max(0.05, this.wR.driven), 0.4 * F));
    }
    // Leaned over, the rider feeds the throttle in only as far as the rear
    // tire has grip left over from the turn (as anyone who rides does): the
    // turn his lean asks for, which he holds, not the swing of the moment.
    // (Wide open in a long bend, the rear tire had nothing left to hold the
    // line with and the machine fell into the turn.)
    if (F > 0 && !this.rig && this.occupants[0]) {
      const lean = this.footDown ? 0 : Math.abs(this.lean);
      const ay = Math.max(Math.abs(this.ayPath), G * Math.tan(lean));
      const fyR = (this.m * ay * (this.cz - this.wF.z)) / d.wheelbase;
      const care = smoothstep(0.03, 0.12, lean); // (leaned over: a little more in hand)
      const nR = Math.max(1, this.wR.N);
      // (Upright he counts on the tire's whole pull, this.grip; leaned over
      // only on what a real tire gives, or he would run wide in a long bend.)
      const pull = this.grip - (this.grip - 1) * care;
      const room = (0.9 - 0.05 * care) * this._gripNow * pull * nR * Math.sqrt(Math.max(0, 1 - (fyR / (this._gripNow * this.grip * nR)) ** 2));
      F = Math.min(F, Math.max(room, (0.25 - 0.15 * care) * F));
    }
    this.wR.drive = F * this.wR.driven;
    if (this.wS) this.wS.drive = F * this.wS.driven;
    this.load = clamp(Math.abs(torque) / tmax, 0, 1);
  }

  // Pedaling: the force the legs can put on the pedals falls with cadence
  // (F = F0 (1 - c / c0)); cruising he keeps to a steady 160 W (more up a hill
  // or on soft ground), sprinting he gives all he has, which spends W' (his
  // stamina) above his critical power. Climbing, he stands on the pedals when
  // sitting won't turn the cranks, and where even that won't do he walks it up.
  _legs(h, u, throttle) {
    const pd = this.def.pedal;
    const R = this.def.wheelRadius;
    const dev = (2 * Math.PI * R * pd.chainring) / pd.sprocket; // m per crank turn
    const cad = (Math.max(0, u) / dev) * 60;
    const toWheel = (pd.crank * pd.sprocket) / pd.chainring / R;
    const fall = Math.max(0, 1 - cad / pd.c0);
    const rider = this.occupants[0];
    const spent = rider?.body?.staminaLock || this.wBal < this.wMax * 0.02;
    // Up a hill he works harder than on the flat, up to his critical power, and
    // out of the saddle he pushes harder on the pedals. On soft ground he works
    // as much harder as it takes to keep up the pace he rides at on a road
    // (within the same limit).
    const grade = Math.max(0, this._grade());
    const steady = this._effort(pd.cruise, pd.cp, grade);
    const fSeat = pd.F0 * fall * toWheel; // the most force at the tire at this cadence
    const fMax = grade > 0.02 ? (pd.F0stand ?? pd.F0) * fall * toWheel : fSeat;
    let F = 0;
    let effort = 'coast';
    this.standing = false;
    if (throttle > 0.05 && !this.fallen && this.rightingT <= 0) {
      if (this.input.sprint && !spent) {
        // Pedalling hard, out of the saddle: the steady effort of a stronger
        // rider (pd.heavy, about 5 km/h quicker), within what the legs push at
        // this cadence. What is above his critical power comes out of his W'.
        const want = (this._effort(pd.heavy.cruise, pd.heavy.cp, grade) * throttle) / Math.max(u, 0.8);
        F = Math.min(want, fMax);
        effort = 'sprint';
        this.standing = true;
      } else {
        const want = (steady * throttle) / Math.max(u, 0.8);
        F = Math.min(want, fMax);
        this.standing = want > fSeat;
        effort = spent ? 'spent' : 'cruise';
      }
    }
    F *= pd.efficiency;
    // (Gameplay: a hand up hills, a share of the pull of the slope, so he
    // climbs about 3 km/h quicker than his legs alone would take him. See
    // HILL_HELP.)
    if (F > 0) F += HILL_HELP * this.m * G * Math.sin(Math.atan(grade)) * throttle;
    // Too steep to ride: slowed to a walk and still unable to turn the cranks
    // over, he gets a foot down and walks it up (and rides on where it eases).
    const hill = this.m * G * (Math.sin(Math.atan(grade)) + 0.02);
    const going = throttle > 0.05 && rider && !this.fallen && this.rightingT <= 0 && grade > 0.03;
    if (!going || F > hill * 1.08) this.walking = false;
    else if (u < 0.8) this.walking = true;
    if (this.walking) {
      const vWalk = clamp(220 / hill, 0.5, 1.3);
      this.paddle = clamp(hill + (vWalk - u) * this.m * 3, 0, this.m * G * 0.45) * throttle;
      F = 0;
      effort = 'walk';
      this.standing = false;
    }
    // (Gameplay: three times the push he has left over after the hill, the
    // ground and the air, so he picks up speed three times as fast; the speeds
    // he settles at stay the same. See PEDAL_GAIN.)
    F = this._gain(F, PEDAL_GAIN);
    this.wR.drive = Math.max(0, F);
    const P = (F * Math.max(u, 0)) / pd.efficiency;
    this.power = P;
    this.effort = this.occupants[0] ? effort : 'idle';
    this.cadence = F > 0 ? cad : 0;
    this.load = clamp(P / 600, 0, 1);
    this.rpm = this.cadence;
    this.gear = 1;
  }

  // What he puts out to hold an effort of cruise W on the flat: more up a hill
  // and on soft ground (as much more as it takes to keep up the pace that
  // effort gives on a road), up to cp.
  _effort(cruise, cp, grade) {
    const pd = this.def.pedal;
    const soft = (this.m * G * Math.max(0, this._rolling() - HARD_ROLL) * this._pace(cruise)) / pd.efficiency;
    return Math.min(cp, cruise + (cp - cruise) * clamp(grade / (pd.climb ?? 0.06), 0, 1) + soft);
  }

  // The speed an effort of cruise W gives on a level road (m/s, about 7).
  _pace(cruise = this.def.pedal.cruise) {
    const cache = (this._paceV ||= {});
    if (cache[cruise]) return cache[cruise];
    const pd = this.def.pedal;
    const P = cruise * pd.efficiency;
    const roll = this.nominalMass * G * HARD_ROLL,
      air = 0.5 * 1.2 * (this.def.cda ?? 0.8);
    let lo = 0,
      hi = 20;
    for (let i = 0; i < 40; i++) {
      const v = (lo + hi) / 2;
      if ((roll + air * v * v) * v > P) hi = v;
      else lo = v;
    }
    return (cache[cruise] = lo);
  }

  // W' balance: work above critical power drains it; below, it comes back. (As
  // on foot, the reserve is STAMINA_POOL times the plain figure and comes back
  // STAMINA_REGEN times as fast: see the soldier's body.)
  _stamina(dt) {
    const pd = this.def.pedal;
    const rider = this.occupants[0];
    const P = this.power || 0;
    if (P > pd.cp) this.wBal -= (P - pd.cp) * dt;
    else {
      const tau = (24 + 40 * (P / pd.cp)) / STAMINA_REGEN;
      this.wBal += (this.wMax - this.wBal) * (1 - Math.exp(-dt / tau));
    }
    this.wBal = clamp(this.wBal, 0, this.wMax);
    if (!rider?.body) return;
    const b = rider.body;
    b.stamina = (100 * this.wBal) / this.wMax;
    if (b.stamina <= 1) b.staminaLock = true;
    if (b.staminaLock && b.stamina > 30) b.staminaLock = false;
    const exertion = clamp(Math.max(1 - b.stamina / 100, (P - pd.cruise) / (pd.cp * 2)), 0, 1);
    b.breath = damp(b.breath ?? 0, exertion, 0.5, dt);
  }

  // ------------------------------------------------------------------ crashes
  _crashChecks(dt) {
    if (this.fallen) {
      this.fallT += dt;
      return;
    }
    const d = this.def;
    if (this.rig) {
      // Rolled over onto the bike side (or, rarely, over the sidecar).
      if (this.lean < -(d.lean?.tip ?? 0.5) - 0.1 || this.lean > 0.5) this._fall(Math.sign(this.lean), 'rollover');
      return;
    }
    const lim = d.lean.crash;
    if (Math.abs(this.lean) > lim && this.rightingT <= 0) this._fall(Math.sign(this.lean), 'slide');
  }

  // Down it goes: the machine slides on its side and everybody aboard is thrown.
  // impact: how fast it closed on whatever it hit (m/s), if it hit something.
  _fall(side, cause, impact = 0) {
    if (this.fallen) return;
    const sp = Math.hypot(this.vx, this.vz);
    this.fallen = side || -1;
    this.fallCause = cause;
    this.fallAngle = this.rig ? 1.45 : this.pedal ? 1.45 : 1.3;
    this.fallLift = this.pedal ? 0.16 : 0.28;
    this.fallT = 0;
    this.footDown = 0;
    this.engineOn = false;
    this.lastCrash = this.game.time ?? 0;
    for (let i = 0; i < this.occupants.length; i++) {
      const o = this.occupants[i];
      if (o) this._throw(o, sp, cause, impact);
    }
    // The machine takes a beating too.
    if (sp > 4) this.damage((sp - 4) * (sp - 4) * (this.pedal ? 1.2 : 2.5), null, 'crash');
  }

  // Throw a rider off: hurt by how fast he hits the ground, or what he hit.
  _throw(o, speed, cause, impact = 0) {
    const v = this.body.velocity;
    if (!this.exit(o, true)) return;
    const b = o.body;
    if (b) {
      b.vx = v.x * 0.7;
      b.vz = v.z * 0.7;
      b.vy = Math.min(3, speed * 0.15);
    }
    const hurt = Math.max(fallInjury(speed), crashInjury(impact));
    if (hurt > 0.5 && o.damage) o.damage(hurt, { kind: 'fall', part: 'legs', vehicle: this, weapon: { name: `${this.def.name} crash` } });
    if (o.isPlayer) this.game.hud?.flash?.(cause === 'rollover' ? 'Rolled over!' : 'Thrown off!', 1.5);
  }

  // Lifting a fallen machine back onto its wheels (it takes a moment).
  pickUp() {
    if (!this.fallen || this.rightingT > 0) return false;
    this.rightingT = this.rig ? 2.2 : 1.3;
    this.wake();
    return true;
  }

  _righting(dt) {
    this.rightingT -= dt;
    const target = this.rig ? 0 : this.occupants[0] ? this._footSide() * 0.1 : this.def.lean.stand ?? 0;
    this.fallen = 0;
    this.lean = damp(this.lean, target, 5, dt);
    this.leanRate = 0;
    this.vx *= 0.9;
    this.vz *= 0.9;
    this.yawRate = 0;
    if (this.rightingT <= 0) {
      this.rightingT = 0;
      this.lean = target;
      this.footDown = this.occupants[0] ? this._footSide() : 0;
      this.onStand = !this.occupants[0] && !this.rig;
      // Settle on the ground.
      const cyw = Math.cos(this.yaw),
        syw = Math.sin(this.yaw);
      this._settle(this.px - (this.cx * cyw + this.cz * syw), this.pz - (-this.cx * syw + this.cz * cyw));
    }
  }

  // ------------------------------------------------------------------ collisions
  // Walls, buildings and vehicles: push back, lose the speed into them, and crash
  // when the knock is hard.
  _collide(dt) {
    if (this.rightingT > 0) return;
    const coll = this.world.collision;
    if (this.proxies) for (const p of this.proxies) p.box.enabled = false;
    const q = _q.setFromEuler(_e.set(this.pitch, this.yaw, -this.lean, 'YXZ'));
    const cyw = Math.cos(this.yaw),
      syw = Math.sin(this.yaw);
    const ox = this.px - (this.cx * cyw + this.cz * syw),
      oz = this.pz - (-this.cx * syw + this.cz * cyw);
    let impact = 0;
    let impactOther = null;
    const m = this.m;
    for (const s of this.spheres) {
      const p = _v.copy(s.p).applyQuaternion(q);
      p.x += ox;
      p.y += this.oy;
      p.z += oz;
      const list = coll.query(p.x - s.r, p.y - s.r, p.z - s.r, p.x + s.r, p.y + s.r, p.z + s.r, _boxes, FLAG_SOLID);
      for (let i = 0; i < list.length; i++) {
        const box = list[i];
        if (box.owner === this) continue;
        const depth = sphereBox(p, s.r, box, _n);
        if (depth <= 0) continue;
        // Low steps and curbs: the wheel rolls up them (the ground probe sees the top).
        if (s.wheel && box.maxY < this.oy + (this.pedal ? 0.12 : 0.2)) continue;
        if (_n.y > 0.7) continue;
        let nx = _n.x,
          nz = _n.z;
        const nl = Math.hypot(nx, nz);
        if (nl < 0.2) continue;
        nx /= nl;
        nz /= nl;
        const other = box.owner?.isVehicle ? box.owner : null;
        // Push out (horizontally).
        const push = Math.min(depth, 0.3);
        this.px += nx * push;
        this.pz += nz * push;
        // Velocity of our point against theirs.
        const dx = p.x - this.px,
          dz = p.z - this.pz;
        let vpx = this.vx + this.yawRate * dz,
          vpz = this.vz - this.yawRate * dx;
        if (other) {
          const ov = other.body.pointVelocity(p, _v2);
          vpx -= ov.x;
          vpz -= ov.z;
        }
        const vn = vpx * nx + vpz * nz;
        if (vn >= 0) continue;
        const arm = dz * nx - dx * nz;
        const k = 1 / m + (arm * arm) / this.Iz;
        const j = (-(1 + 0.15) * vn) / k;
        this.vx += (j * nx) / m;
        this.vz += (j * nz) / m;
        this.yawRate += (arm * j) / this.Iz;
        // Scrape along the wall.
        const tx = -nz,
          tz = nx;
        const vt = vpx * tx + vpz * tz;
        const jt = clamp(-vt / k, -0.4 * j, 0.4 * j);
        this.vx += (jt * tx) / m;
        this.vz += (jt * tz) / m;
        if (-vn > impact) {
          impact = -vn;
          impactOther = other;
        }
        if (other) {
          if (other.isBike) other.wake();
          else other.body.applyImpulse?.(_v3.set(-j * nx * 0.5, 0, -j * nz * 0.5), p);
        }
      }
    }
    if (this.proxies) for (const p of this.proxies) p.box.enabled = true;
    this.lastImpact = Math.max(this.lastImpact, impact);
    // A hard knock: solo machines go down, outfits just take the damage.
    const crashAt = this.pedal ? 3.2 : 4.2;
    if (impact > crashAt && !this.fallen) {
      if (!this.rig) this._fall(this.lean >= 0 ? 1 : -1, impactOther ? 'vehicle' : 'wall', impact);
      else for (const o of this.occupants) if (o && crashInjury(impact) > 0.5 && o.damage) o.damage(crashInjury(impact), { kind: 'crash', vehicle: this, weapon: { name: `${this.def.name} crash` } });
    }
    if (impactOther && impact > 2 && !impactOther.isBike) {
      // Run down by something big: a bicycle under a tank is scrap.
      const heavy = impactOther.def.mass > this.m * 6;
      if (heavy && impact > 3) this.damage(impact * impact * (this.pedal ? 8 : 4), impactOther.driver || null, 'crushed');
    }
  }

  // People in the way: the game hurts them (Game._runOver); the rider of a solo
  // machine that hits someone at speed comes off too.
  _people() {
    if (this.fallen || this.rig) return;
    const sp = Math.abs(this.u);
    if (sp < 3) return;
    const L = this.def.wheelbase;
    const cyw = Math.cos(this.yaw),
      syw = Math.sin(this.yaw);
    const fx = -syw,
      fz = -cyw;
    const ox = this.px - (this.cx * cyw + this.cz * syw),
      oz = this.pz - (-this.cx * syw + this.cz * cyw);
    const nx = ox + fx * (L / 2 + 0.3),
      nz = oz + fz * (L / 2 + 0.3);
    for (const s of this.game.soldiers || []) {
      if (!s.alive || s.vehicle) continue;
      const b = s.body;
      const dx = b.x - nx,
        dz = b.z - nz;
      if (dx * dx + dz * dz > 0.5 * 0.5 || b.y > this.oy + 1.2 || b.y < this.oy - 1) continue;
      const rel = (this.vx - b.vx) * fx + (this.vz - b.vz) * fz;
      if (rel < 4) continue;
      // Momentum shared with the person hit.
      const share = 85 / (this.m + 85);
      this.vx -= fx * rel * share;
      this.vz -= fz * rel * share;
      if (rel > 4.5) this._fall(this.lean >= 0 ? 1 : -1, 'person');
      return;
    }
  }

  // ------------------------------------------------------------------ state for others
  _sync() {
    const b = this.body;
    const q = b.quaternion.setFromEuler(_e.set(this.pitch, this.yaw, -this.lean, 'YXZ'));
    const cyw = Math.cos(this.yaw),
      syw = Math.sin(this.yaw);
    const ox = this.px - (this.cx * cyw + this.cz * syw),
      oz = this.pz - (-this.cx * syw + this.cz * cyw);
    b.position.copy(this.cg).applyQuaternion(q);
    b.position.x += ox;
    b.position.y += this.oy;
    b.position.z += oz;
    // Velocity of the machine's reference point (its own CG).
    const dx = b.position.x - this.px,
      dz = b.position.z - this.pz;
    b.velocity.set(this.vx + this.yawRate * dz, this.vy, this.vz - this.yawRate * dx);
    const fx = -syw,
      fz = -cyw;
    b.angular.set(this.pitchRate * cyw + this.leanRate * fx, this.yawRate, -this.pitchRate * syw + this.leanRate * fz);
  }

  // Model point -> world, from the current physics state (not the rendered model).
  _modelToWorld(p, out) {
    return out.copy(p).sub(this.cg).applyQuaternion(this.body.quaternion).add(this.body.position);
  }

  // ------------------------------------------------------------------ puppets
  // Online the server rides the machine; the browser hears only where it is and
  // how it is turned (net/online.js). What the rider and the model go by (the
  // heading, lean and pitch, the speed, the bars, the wheels and pedals turning,
  // a foot down at a stop, the stand, the sidecar gun) is worked out from that
  // here, each step, in place of step(). (Without it a puppet's rider kept the
  // heading it was made with and twisted round to reach bars pointing elsewhere,
  // and nothing on the machine moved.)
  followPose(dt) {
    super.followPose(dt);
    if (!(dt > 0)) return;
    const b = this.body,
      p = b.position;
    _e.setFromQuaternion(b.quaternion, 'YXZ');
    const yaw = _e.y;
    this.pitch = _e.x;
    this.lean = -_e.z;
    const last = this._pup;
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 5) {
      // Just made, or put somewhere new: no speed to go by yet.
      this._pup = { x: p.x, y: p.y, z: p.z };
      this.yaw = yaw;
      this.vx = this.vz = this.vy = this.yawRate = this.u = this.speed = this.ay = this.accel = 0;
    } else {
      // Speeds from the change since the last step, smoothed (between two
      // updates the place moves at a steady pace, then turns a corner).
      const k = 1 - Math.exp(-10 * dt);
      this.vx += ((p.x - last.x) / dt - this.vx) * k;
      this.vy += ((p.y - last.y) / dt - this.vy) * k;
      this.vz += ((p.z - last.z) / dt - this.vz) * k;
      this.yawRate += (wrapAngle(yaw - this.yaw) / dt - this.yawRate) * k;
      this.yaw = yaw;
      last.x = p.x;
      last.y = p.y;
      last.z = p.z;
      const u = -this.vx * Math.sin(yaw) - this.vz * Math.cos(yaw);
      this.accel += ((u - this.u) / dt - this.accel) * (1 - Math.exp(-3 * dt));
      this.u = this.speed = u;
      this.ay = this.ayPath = -u * this.yawRate;
    }
    const u = this.u,
      au = Math.abs(u);
    const d = this.def;
    // The model origin on the ground under the contact line (see _sync).
    const cyw = Math.cos(yaw),
      syw = Math.sin(yaw);
    _v.copy(this.cg).applyQuaternion(b.quaternion);
    const ox = p.x - _v.x,
      oz = p.z - _v.z;
    this.oy = p.y - _v.y;
    this.px = ox + (this.cx * cyw + this.cz * syw);
    this.pz = oz + (-this.cx * syw + this.cz * cyw);
    // The wheels roll with the ground.
    for (const w of this.wheels) w.spin = u / w.radius;
    // The bars: the steer that gives the turn it makes (a single track rolls
    // where its front wheel points), held as it is when too slow to tell.
    const rider = this.occupants[0];
    const lockG = d.steering.lock * Math.cos(this.rake);
    if (au > 0.5) {
      const want = clamp(Math.atan((-this.yawRate / u) * d.wheelbase), -lockG, lockG);
      this.steerG = approach(this.steerG, want, (d.rider?.barRate ?? 2.5) * dt);
    } else if (!rider) this.steerG = approach(this.steerG, 0, dt);
    // Lying on its side, or stood on its stand when nobody rides it.
    this.fallen = !this.rig && Math.abs(this.lean) > Math.max(1, d.lean.crash ?? 0) ? Math.sign(this.lean) : 0;
    if (rider) this.onStand = false;
    else if (au < 0.1 && !this.fallen) this.onStand = !this.rig;
    // A foot down at walking pace, up again once moving (as _rider does).
    if (!rider || this.fallen) this.footDown = 0;
    else if (au < 0.8) this.footDown ||= this._footSide();
    else if (au > 1.6) this.footDown = 0;
    if (this.pedal) {
      // Pedaling while he keeps his speed up; coasting while he slows (the
      // server doesn't say: he slows only by braking or coasting).
      const pd = d.pedal;
      if (!rider || this.fallen || au < 0.8 || u < 0) this._pedaling = false;
      else if (this.accel > -0.2) this._pedaling = true;
      else if (this.accel < -0.8) this._pedaling = false;
      const dev = (2 * Math.PI * d.wheelRadius * pd.chainring) / pd.sprocket; // m per crank turn
      this.cadence = this._pedaling ? (u / dev) * 60 : 0;
      this.effort = !rider ? 'idle' : this._pedaling ? 'cruise' : 'coast';
      this.power = this._pedaling ? pd.cruise : 0;
      this.rpm = this.cadence;
    }
    // The sidecar's gun, as the server has it turned (net/protocol.js).
    if (this.mg) {
      this.mgYaw = this.turretYaw || 0;
      this.mgPitch = this.gunElev || 0;
    }
  }

  // ------------------------------------------------------------------ seats and riders
  // Eye or hip of a seat in the world (for cameras and hit boxes).
  seatPos(i, out = new THREE.Vector3(), kind = 'eye') {
    const s = this.seats[i] || this.seats[0];
    const a = this.model.anchors?.[s.anchor];
    const hip = a ? _v3.copy(a) : _v3.set(...s.hip);
    if (kind === 'eye') {
      if (s.eye) hip.set(...s.eye);
      else hip.add(_v2.set(0, s.style === 'sidecar' ? 0.66 : 0.7, s.style === 'sidecar' ? 0.02 : -0.06));
    }
    return this._modelToWorld(hip, out);
  }

  // How a rider sits on this machine (see the soldiers' rider poses):
  //   { style, hip, yaw, lean, pitch, handL, handR, footL, footR, pedal, footDown }
  riderPose(seat, out = {}) {
    const s = this.seats[seat];
    if (!s) return null;
    const P = this._pose[seat];
    const anchors = this.model.anchors || {};
    out.style = s.style;
    out.hip = this.seatPos(seat, out.hip?.isVector3 ? out.hip : P.hip, 'hip');
    out.yaw = this.yaw;
    out.pitch = this.pitch;
    const isRider = seat === 0;
    if (this.rig) {
      // The outfit stays level; its people lean into the turn.
      const into = clamp(this.ay / G, -0.6, 0.6);
      out.lean = this.lean + into * (s.style === 'sidecar' ? 0.75 : 0.45);
    } else out.lean = this.lean;
    out.pedal = isRider && this.pedal ? this.crank : null;
    out.footDown = isRider && !this.fallen ? this.footDown : 0;
    out.handL = out.handR = null;
    out.footL = out.footR = null;
    if (s.role === 'driver') {
      // Handlebar grips turn with the steering.
      const bar = this.steerG / Math.max(0.5, Math.cos(this.rake));
      _q2.setFromAxisAngle(this.steerAxis, -bar);
      const gl = anchors.gripL ? _v.copy(anchors.gripL) : _v.set(...s.grips[0]);
      out.handL = this._modelToWorld(gl.sub(this.headPoint).applyQuaternion(_q2).add(this.headPoint), P.handL);
      const gr = anchors.gripR ? _v.copy(anchors.gripR) : _v.set(...s.grips[1]);
      out.handR = this._modelToWorld(gr.sub(this.headPoint).applyQuaternion(_q2).add(this.headPoint), P.handR);
      if (this.pedal) {
        const pd = this.def.pedal;
        const bb = _v2.set(...pd.bb);
        // Right crank at angle `crank` (0 = straight down; pedaling forward it
        // swings back at the bottom, like the wheels), left crank opposite.
        const c = this.crank;
        out.footR = this._modelToWorld(_v.set(pd.pedalX, bb.y - pd.crank * Math.cos(c), bb.z + pd.crank * Math.sin(c)), P.footR);
        out.footL = this._modelToWorld(_v.set(-pd.pedalX, bb.y + pd.crank * Math.cos(c), bb.z - pd.crank * Math.sin(c)), P.footL);
      } else if (s.feet) {
        out.footL = this._modelToWorld(anchors.footL ? _v.copy(anchors.footL) : _v.set(...s.feet[0]), P.footL);
        out.footR = this._modelToWorld(anchors.footR ? _v.copy(anchors.footR) : _v.set(...s.feet[1]), P.footR);
      }
      if (out.footDown) {
        // That foot goes to the ground beside the machine.
        const side = out.footDown;
        const fp = this._modelToWorld(_v.set(side * 0.36, 0, (s.hip[2] ?? 0) - 0.12), side < 0 ? P.footL : P.footR);
        fp.y = this.world.hf.getHeight(fp.x, fp.z);
        if (side < 0) out.footL = fp;
        else out.footR = fp;
      }
    } else if (s.style === 'pillion') {
      if (s.grips) {
        out.handL = this._modelToWorld(anchors.pillionGripL ? _v.copy(anchors.pillionGripL) : _v.set(...s.grips[0]), P.handL);
        out.handR = this._modelToWorld(anchors.pillionGripR ? _v.copy(anchors.pillionGripR) : _v.set(...s.grips[1]), P.handR);
      }
      if (s.feet) {
        out.footL = this._modelToWorld(anchors.pillionFootL ? _v.copy(anchors.pillionFootL) : _v.set(...s.feet[0]), P.footL);
        out.footR = this._modelToWorld(anchors.pillionFootR ? _v.copy(anchors.pillionFootR) : _v.set(...s.feet[1]), P.footR);
      }
    } else if (s.style === 'sidecar') {
      if (this.mg) {
        // Hands on the gun; he turns with it.
        out.yaw = this.yaw + clamp(this.mgYaw, -0.9, 0.9) * 0.7;
        out.handR = this.mgPointWorld(anchors.mgGripR ? _v.copy(anchors.mgGripR) : _v.copy(this.mgPivot).add(_v2.set(0.02, 0.0, 0.32)), P.handR);
        out.handL = this.mgPointWorld(anchors.mgGripL ? _v.copy(anchors.mgGripL) : _v.copy(this.mgPivot).add(_v2.set(-0.1, 0.03, 0.18)), P.handL);
      }
      if (s.feet) {
        out.footL = this._modelToWorld(anchors.sideFootL ? _v.copy(anchors.sideFootL) : _v.set(...s.feet[0]), P.footL);
        out.footR = this._modelToWorld(anchors.sideFootR ? _v.copy(anchors.sideFootR) : _v.set(...s.feet[1]), P.footR);
      }
    }
    return out;
  }

  enter(soldier, seat = this.freeSeat()) {
    if (!this.alive || seat < 0 || this.occupants[seat]) return false;
    if (this.fallen) this.pickUp();
    this.wake();
    // Ridden, it belongs to the rider's side (a bicycle is nobody's when parked).
    if (this.homeTeam === undefined) this.homeTeam = this.team ?? null;
    if (seat === 0 || !this.occupants.some(Boolean)) this.team = soldier.team ?? this.team;
    this.occupants[seat] = soldier;
    soldier.vehicle = this;
    soldier.seat = seat;
    if (soldier.body) soldier.body.vx = soldier.body.vy = soldier.body.vz = 0;
    this._massDirty = true;
    if (seat === 0) {
      this.gear = 0;
      this.onStand = false;
      this.footDown = this._footSide();
      this.lastDriver = soldier;
      if (this.pedal) this.wBal = this.wMax * clamp((soldier.body?.stamina ?? 100) / 100, 0, 1);
      if (!this.pedal && this.alive && this.modules.engine > 0) this.game.audio?.play?.('motoStart', this.body.position, { volume: 0.8 });
    }
    this._seatOccupant(soldier);
    return true;
  }

  switchSeat(soldier, seat) {
    const was = this.seatIndexFor(soldier);
    const ok = super.switchSeat(soldier, seat);
    if (ok) {
      this._massDirty = true;
      if (seat === 0) this.footDown = this._footSide();
      if (was === 0) this.input.throttle = 0;
    }
    return ok;
  }

  // Get off. Slow: he puts the machine on its stand. Fast (or thrown): it carries
  // on without him.
  exit(soldier, thrown = false) {
    const i = this.seatIndexFor(soldier);
    if (i < 0) return false;
    const speed = Math.hypot(this.vx, this.vz);
    const b = soldier.body;
    const p = this.seatPos(i, _v, 'hip');
    // Step off on the side of the seat (left for the rider, unless the sidecar...).
    const cyw = Math.cos(this.yaw),
      syw = Math.sin(this.yaw);
    const rx = cyw,
      rz = -syw;
    let side = i === 0 || this.seats[i].style === 'pillion' ? -1 : 1;
    if (this.seats[i].style === 'sidecar') side = 1;
    const off = this.seats[i].style === 'sidecar' ? 0.75 : 0.7;
    let x = p.x + rx * side * off,
      z = p.z + rz * side * off;
    const coll = this.world.collision;
    const y0 = this.world.hf.getHeight(x, z);
    if (coll.query(x - 0.3, y0 + 0.2, z - 0.3, x + 0.3, y0 + 1.8, z + 0.3, _boxes, FLAG_SOLID).some((bx) => bx.owner !== this)) {
      x = p.x - rx * side * off;
      z = p.z - rz * side * off;
    }
    this.occupants[i] = null;
    soldier.vehicle = null;
    soldier.seat = -1;
    soldier.leftVehicle = this;
    soldier.leftAt = this.game.time ?? 0;
    if (b) {
      b.x = x;
      b.z = z;
      b.y = this.world.hf.getHeight(x, z) + 0.05;
      b.vx = this.body.velocity.x * 0.5;
      b.vy = 0;
      b.vz = this.body.velocity.z * 0.5;
    }
    this._massDirty = true;
    if (i === 0) {
      this.input.throttle = 0;
      this.input.steer = 0;
      this.input.sprint = false;
      this.footDown = 0;
      if (!thrown && speed < 2.5 && !this.fallen) {
        // On the stand.
        this.onStand = !this.rig;
        this.vx *= 0.3;
        this.vz *= 0.3;
      } else this.onStand = false;
      if (!thrown && speed > 3 && soldier.damage) {
        // Jumping off a moving machine hurts.
        const hurt = fallInjury(speed);
        if (hurt > 0.5) soldier.damage(hurt, { kind: 'fall', part: 'legs', vehicle: this });
      }
    }
    this.wake();
    return true;
  }

  // ------------------------------------------------------------------ sidecar gun
  _mgStep(dt) {
    const d = this.def.sidecarMg;
    this.mg.update(dt);
    const gunner = this.occupants.findIndex((o, i) => o && this.seats[i].role === 'sidecarMg');
    if (gunner < 0) this.mg.trigger = false;
    // He swings the gun at a human rate, within the mount's limits.
    const lim = d.traverse * DEG;
    const yaw = clamp(wrapAngle(this.mgAim.yaw), -lim, lim);
    const pitch = clamp(this.mgAim.pitch, d.elev[0] * DEG, d.elev[1] * DEG);
    this.mgYaw = approach(this.mgYaw, yaw, 3 * dt);
    this.mgPitch = approach(this.mgPitch, pitch, 2.5 * dt);
  }

  // A point on the sidecar gun (model space at rest) in the world, as the gun is laid.
  mgPointWorld(p, out) {
    _q2.setFromEuler(_e.set(this.mgPitch, this.mgYaw, 0, 'YXZ'));
    _v2.copy(p).sub(this.mgPivot).applyQuaternion(_q2).add(this.mgPivot);
    return this._modelToWorld(_v2, out);
  }

  mgDir(out = new THREE.Vector3()) {
    _q2.setFromEuler(_e.set(this.mgPitch, this.mgYaw, 0, 'YXZ')).premultiply(this.body.quaternion);
    return out.set(0, 0, -1).applyQuaternion(_q2);
  }

  // Wanted gun direction from a world direction.
  aimMgAt(dir) {
    _q2.copy(this.body.quaternion).invert();
    const l = _v2.copy(dir).applyQuaternion(_q2);
    this.mgAim.yaw = Math.atan2(-l.x, -l.z);
    this.mgAim.pitch = Math.asin(clamp(l.y, -1, 1));
  }

  anchorWorld(name, out = new THREE.Vector3()) {
    if (name === 'mgMuzzle' && this.mg) {
      const a = this.model.anchors?.mgMuzzle;
      return this.mgPointWorld(a ? _v.copy(a) : _v.copy(this.mgPivot).add(_v3.set(0, 0.04, -0.8)), out);
    }
    return super.anchorWorld(name, out);
  }

  // ------------------------------------------------------------------ the model
  syncModel(dt = 0) {
    const root = this.model.root;
    const cam = this.game.camera?.position;
    const dist = cam ? cam.distanceTo(this.body.position) : 0;
    const near = this.pedal ? 22 : 34;
    const cull = this.pedal ? 180 : 320;
    // A tenth of the distance as a margin, so a machine right at the edge doesn't
    // flip between its models from frame to frame (it flashed).
    const cur = this._lod ?? 0;
    const lod = dist > cull * (cur < 2 ? 1.1 : 1) ? 2 : dist > near * (cur < 1 ? 1.1 : 1) ? 1 : 0;
    if (lod !== this._lod) {
      this._lod = lod;
      const far = this.model.parts?.far;
      if (far) for (const [k, g] of Object.entries(this.model.parts)) g.visible = lod === 1 ? k === 'far' : k !== 'far';
      root.visible = lod < 2;
      this._synced = false; // (bring the moving parts up to date once)
    }
    // Parked: nothing moves (one last update after it settled).
    if (this.asleep && this._synced) return;
    super.syncModel();
    this._synced = !!this.asleep;
    const parts = this.model.parts || {};
    if (lod === 0) {
      for (const w of this.wheels) w.angle += w.spin * dt;
      // Steering: the bars, fork and front wheel turn about the steering head.
      const bar = this.steerG / Math.max(0.5, Math.cos(this.rake));
      _q2.setFromAxisAngle(this.steerAxis, -bar);
      if (parts.steer) parts.steer.quaternion.copy(_q2);
      const wF = this.wF;
      if (wF.part) {
        const piv = this.partPivots.wheelF;
        const travel = this._travel(wF);
        _v.copy(piv).sub(this.headPoint).addScaledVector(this.steerAxis, travel).applyQuaternion(_q2).add(this.headPoint);
        wF.part.position.copy(_v);
        wF.part.quaternion.copy(_q2).multiply(_q.setFromAxisAngle(X, -wF.angle));
      }
      for (const w of [this.wR, this.wS]) {
        if (!w?.part) continue;
        const piv = this.partPivots[w === this.wR ? 'wheelR' : 'wheelS'];
        w.part.position.set(piv.x, piv.y + this._travel(w), piv.z);
        w.part.rotation.set(-w.angle, 0, 0);
      }
      if (this.pedal) {
        const pd = this.def.pedal;
        if (this.cadence > 0) this.crank += ((this.cadence / 60) * 2 * Math.PI * dt) % (2 * Math.PI);
        else {
          // Coasting: pedals level.
          const level = Math.round(this.crank / Math.PI - 0.5) * Math.PI + Math.PI / 2;
          this.crank = damp(this.crank, level, 3, dt);
        }
        if (parts.crank) parts.crank.rotation.x = -this.crank;
        const bb = this.partPivots.crank;
        if (bb && parts.pedalR && parts.pedalL) {
          const c = this.crank;
          parts.pedalR.position.set(this.partPivots.pedalR.x, bb.y - pd.crank * Math.cos(c), bb.z + pd.crank * Math.sin(c));
          parts.pedalL.position.set(this.partPivots.pedalL.x, bb.y + pd.crank * Math.cos(c), bb.z - pd.crank * Math.sin(c));
        }
      }
      if (this.mg && parts.mg) parts.mg.quaternion.setFromEuler(_e.set(this.mgPitch, this.mgYaw, 0, 'YXZ'));
      // The rear stand: down while it is parked on it, folded up behind the
      // mudguard while it is ridden (or lying on its side).
      if (parts.stand) {
        const want = this.onStand && !this.fallen ? 0 : (this.model.meta?.standFold ?? -1.4);
        this.standAngle = this.asleep || this.standAngle === undefined ? want : approach(this.standAngle, want, dt * 6);
        const piv = this.partPivots.stand;
        parts.stand.position.set(piv.x, piv.y + this._travel(this.wR), piv.z);
        parts.stand.rotation.x = this.standAngle;
      }
      // The sprung saddle (and the rest) stays put; fork springs show their travel.
      root.updateMatrixWorld(true);
    }
    if (!this.asleep || !this._armorSynced) {
      this.updateArmor();
      this._armorSynced = true;
    }
  }

  // Visible suspension travel of a wheel relative to the frame (springs only: on
  // a rigid frame or a bicycle the "spring" is the tire, which doesn't show).
  _travel(w) {
    if (w.k > 100000) return 0;
    return clamp(w.comp, -w.droop, w.bump);
  }

  // ------------------------------------------------------------------ hits and damage
  setupProxies() {
    // Bicycles don't block anyone; motorcycles are solid to people and vehicles.
    if (this.pedal) {
      this.proxies = null;
      return;
    }
    const d = this.def;
    const [W, , L] = d.dims;
    let x0 = -W / 2,
      x1 = W / 2;
    if (this.rig) {
      x0 = -0.42;
      x1 = d.sidecar.track + 0.42;
    }
    const box = new Box(0, 0, 0, (x1 - x0) / 2, 0.42, L / 2 - 0.1, 0, 'steel', FLAG_SOLID);
    box.owner = this;
    this.world.collision.add(box);
    this.proxies = [{ part: null, center: new THREE.Vector3((x0 + x1) / 2, 0.5, 0), box }];
    this.updateProxies();
  }

  _defaultArmor() {
    const [w, h, l] = this.def.dims;
    return [{ name: 'frame', part: 'body', center: [this.rig ? this.def.sidecar.track / 2 : 0, h * 0.45, 0], half: [w * (this.rig ? 0.5 : 0.25), h * 0.3, l * 0.4], mm: 2 }];
  }

  _defaultModules() {
    if (this.pedal) return [];
    return [
      { name: 'engine', part: 'body', center: [0, 0.42, -0.1], half: [0.22, 0.15, 0.2] },
      { name: 'fuel', part: 'body', center: [0, 0.82, -0.2], half: [0.14, 0.1, 0.25] },
    ];
  }

  // Bullets through a machine don't hurt its riders unless they hit them (the
  // riders are out in the open and have their own hit boxes).
  _internalPath(info, p, depth, power) {
    for (const m of this.internals || []) {
      if (!CollisionWorld.rayBox(m.box, info.x, info.y, info.z, info.dirX, info.dirY, info.dirZ, depth, _rh)) continue;
      this._moduleHit(m.name, p, power);
    }
  }

  onHit(info, p) {
    this.wake();
    const plate = info.plate;
    if (plate?.kind === 'tire') {
      const key = plate.name === 'tireF' ? 'tireF' : plate.name === 'tireS' ? 'tireS' : 'tireR';
      if (this.modules[key] > 0 && info.kind !== 'ricochet') {
        this.modules[key] = 0;
        if (p.owner) this.lastAttacker = p.owner;
        this.game.audio?.play?.('tireBurst', info, { volume: 0.7 });
        if (this.game.player?.soldier?.vehicle === this) this.game.hud?.flash?.('Flat tire!', 2);
      }
      this.damage(2, p.owner, 'tire');
      return { effect: 'dust' };
    }
    if (plate?.kind === 'spokes') {
      this.damage(1, p.owner, 'bullet');
      return { effect: 'sparks' };
    }
    return super.onHit(info, p);
  }

  _moduleHit(name, p, power) {
    if (this.pedal && (name === 'fuel' || name === 'engine')) return;
    super._moduleHit(name, p, power);
  }

  startFire(attacker) {
    if (this.pedal) return;
    super.startFire(attacker);
  }

  damage(amount, attacker, cause) {
    this.wake();
    super.damage(amount, attacker, cause);
  }

  // Wrecked: whoever is aboard is thrown clear (not trapped as in a tank).
  destroy(attacker, cause) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.engineOn = false;
    if (!this.pedal) this.fire = Math.max(this.fire, 25);
    this.destroyCause = cause;
    for (const o of this.occupants.slice()) {
      if (!o) continue;
      this.exit(o, true);
      // (Wrecked in a crash, he has had his knocks already.)
      if (o.alive && o.damage && cause !== 'crash') o.damage(cause === 'fire' ? 10 : 20, { kind: 'vehicle', attacker, vehicle: this });
    }
    if (!this.rig && !this.fallen) this._fall(this.lean >= 0 ? 1 : -1, 'wreck');
    this.game.onVehicleDestroyed?.(this, attacker, cause);
  }

}
