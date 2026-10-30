// Bots on bicycles and motorcycles. With a long way to go (more than about 200 m
// to the point its side is fighting over) and no enemy in sight, a bot takes a
// free bicycle or motorcycle nearby, rides it along a route that keeps to the
// roads and village streets where it can, and gets off short of the goal (or as
// soon as it sees the enemy) to fight on foot. A bot taking a sidecar outfit
// waves a comrade into the sidecar, who works its machine gun on the way.
//
// BotBrain owns a ride while it lasts: ride.update(dt) returns true while it
// controls the soldier, false once it is over (the brain then carries on).
import * as THREE from 'three';
import { approach, clamp, wrapAngle, gaussRandom, DEG, G, rand } from '../core/math.js';
import { SURF } from '../world/heightfield.js';
import { LOCK_USE } from '../vehicles/bike.js';
import { FLAG_SOLID, RayHit } from '../physics/collision.js';

const RIDE_MIN = 200; // m to the goal before a ride is worth it
const SEARCH = 45; // m he'll walk to get a bike
const DISMOUNT = 55; // m short of the goal's edge he gets off
const SPOT_STOP = 260; // m: an enemy seen closer than this, he gets off to fight
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hit = new RayHit();

// The vehicle grid with costs for two wheels: roads and village streets are
// quick, fields slower, mud and wading avoided. It shares the grid's cells,
// areas and search buffers (searches never overlap).
export function bikeNav(game) {
  if (game._bikeNav !== undefined) return game._bikeNav;
  const base = game.vnav || game.nav;
  if (!base) return (game._bikeNav = null);
  const nav = Object.create(base);
  Object.defineProperty(nav, 'gen', { get: () => base.gen, set: (v) => (base.gen = v) });
  const hf = game.world.hf;
  const cost = new Uint8Array(base.cost.length);
  for (let i = 0; i < cost.length; i++) {
    const c = base.cost[i];
    if (!c) continue;
    const s = hf.getSurface(base.cellX(i), base.cellZ(i));
    if (c >= 30) cost[i] = 90;
    else if (s === SURF.ROAD || s === SURF.COBBLE) cost[i] = Math.max(7, c - 3);
    else if (s === SURF.MUD || s === SURF.SAND) cost[i] = Math.min(250, c * 3);
    else cost[i] = Math.min(250, Math.round(c * 1.4));
  }
  nav.cost = cost;
  // Straighten a route only over ground no worse than its ends, so a road
  // route keeps to the road round its bends.
  nav.lineWalkable = function (x0, z0, x1, z1) {
    const lim = Math.max(this.cost[this.index(x0, z0)] || 0, this.cost[this.index(x1, z1)] || 0) + 2;
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      const i = this.index(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (i < 0 || !this.cost[i] || this.cost[i] > lim || this.cost[i] >= 60) return false;
    }
    return true;
  };
  return (game._bikeNav = nav);
}

// A ride worth taking now (a free machine of his side, or a bicycle, close
// by), or null. Looks again only every few seconds.
export function findRide(brain) {
  const s = brain.s;
  const g = brain.game;
  const b = s.body;
  if (s.vehicle || brain.target || !brain.goal || s.tankCrew || (brain.noRideUntil ?? 0) > g.time) return null;
  brain.noRideUntil = g.time + 2 + rand() * 2;
  const goal = brain.goal;
  if (Math.hypot(goal.x - b.x, goal.z - b.z) - goal.radius < RIDE_MIN) return null;
  if (g.time - (s.lastHitTime ?? -99) < 8) return null;
  let best = null,
    bestScore = SEARCH;
  for (const v of g.vehicles) {
    if (!v.isBike || !usable(v, s, g)) continue;
    const p = v.body.position;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (d > SEARCH) continue;
    // A motorcycle beats a bicycle; one on the way beats one behind him.
    const toward = ((p.x - b.x) * (goal.x - b.x) + (p.z - b.z) * (goal.z - b.z)) / Math.max(1, d * Math.hypot(goal.x - b.x, goal.z - b.z));
    const score = d - (v.pedal ? 0 : 12) - toward * 6;
    if (score < bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best ? new BikeRide(brain, best) : null;
}

function usable(v, s, g) {
  if (!v.alive || v.occupants[0] || v.fire > 0) return false;
  if (v.team !== null && v.team !== undefined && v.team !== s.team) return false;
  if (v.claimedBy && v.claimedBy !== s && v.claimedBy.alive && v.claimT > g.time) return false;
  if (!v.pedal && v.modules.engine <= 0) return false;
  return v.modules.tireF > 0 && v.modules.tireR > 0;
}

// The tightest path curvature he'll ask for at speed u: the steering input is
// a share of this (see Bike._rider).
function maxCurvature(v, u) {
  if (v.maxCurvature) return v.maxCurvature(u);
  const d = v.def;
  const lockG = d.steering.lock * Math.cos(v.rake);
  const kLock = Math.tan(lockG) / d.wheelbase;
  const u2 = Math.max(u * u, 0.25);
  if (v.rig) return Math.min(kLock, ((d.rider?.latG ?? 0.55) * G) / u2);
  return Math.min(kLock * LOCK_USE, (G * Math.tan(v._leanLimit())) / u2);
}

// Perceive on the brain's own schedule (it notices enemies while riding too).
function look(brain, dt) {
  brain.thinkT -= dt;
  if (brain.thinkT > 0) return;
  brain.thinkT = 0.25 + rand() * 0.1;
  brain._perceive(0.3);
}

// A comrade within a couple of meters of the line of fire (out to dist).
function friendInLine(s, from, dir, dist) {
  for (const o of s.game.soldiers) {
    if (o === s || !o.alive || o.team !== s.team || o.vehicle === s.vehicle) continue;
    const dx = o.body.x - from.x,
      dy = o.body.y + 1 - from.y,
      dz = o.body.z - from.z;
    const t = dx * dir.x + dy * dir.y + dz * dir.z;
    if (t < 0 || t > dist) continue;
    if (dx * dx + dy * dy + dz * dz - t * t < 4) return true;
  }
  return false;
}

function targetDist(brain) {
  const t = brain.target;
  if (!t) return Infinity;
  const p = t.isVehicle ? t.body.position : t.body;
  const b = brain.s.body;
  return Math.hypot(p.x - b.x, p.z - b.z);
}

// Walk to a machine (along the foot paths) and get on at `seat`. Returns
// 'on', 'walking' or 'fail'.
function walkTo(ride, dt) {
  const { v, s, brain } = ride;
  ride.t += dt;
  if (!v.alive || (v.occupants[ride.seat] && v.occupants[ride.seat] !== s) || ride.t > 40) return 'fail';
  if (ride.seat > 0 && Math.abs(v.speed) > 1.5) return 'fail'; // it left without him
  const p = v.seatPos(ride.seat, _p, 'hip');
  const d = Math.hypot(p.x - s.body.x, p.z - s.body.z);
  if (d < 1.7) return v.enter(s, ride.seat) ? 'on' : 'fail';
  if (d > SEARCH + 20) return 'fail'; // (killed on the way, and back at a spawn point)
  if (!brain.path || ride.t > ride.replanT) {
    ride.replanT = ride.t + 6;
    brain._plan(p.x, p.z);
  }
  brain._move(dt);
  brain._aimAndShoot(dt);
  return 'walking';
}

// The driver's ride: walk to it, (wait for a sidecar gunner), ride, stop, get off.
export class BikeRide {
  constructor(brain, v) {
    this.brain = brain;
    this.s = brain.s;
    this.game = brain.game;
    this.v = v;
    this.seat = 0;
    this.phase = 'walk';
    this.t = 0;
    this.replanT = 0;
    this.path = null;
    this.i = 0;
    this.planT = 0;
    this.stuckT = 0;
    this.stuckN = 0;
    this.backT = 0;
    v.claimedBy = this.s;
    v.claimT = this.game.time + 30;
    brain.path = null;
  }

  update(dt) {
    const s = this.s;
    if (!s.alive) return false;
    if (this.phase === 'walk') {
      look(this.brain, dt);
      if (this.brain.target) return this._end();
      const r = walkTo(this, dt);
      if (r === 'fail') return this._end();
      if (r === 'on') this._mounted();
      return true;
    }
    if (s.vehicle !== this.v) return this._end(); // thrown off, or it was wrecked
    // He looks where he rides (what he can see depends on it).
    s.yaw = this.brain.lookYaw = this.v.yaw;
    look(this.brain, dt);
    if (this.phase === 'wait') {
      // Hold still while the gunner climbs in (not for long).
      this.v.driverInput(0, 0, true);
      this.t += dt;
      const mate = this.mate;
      const aboard = mate && this.v.occupants.includes(mate);
      if (aboard || this.t > 9 || !mate?.alive || mate.brain?.ride !== this.mateRide || this.brain.target) this.phase = 'ride';
      return true;
    }
    if (this.phase === 'ride') {
      if (this.brain.target && targetDist(this.brain) < SPOT_STOP) this.phase = 'stop';
      else this._ride(dt);
    }
    if (this.phase === 'stop') return this._stop(dt);
    return true;
  }

  _mounted() {
    const v = this.v;
    this.t = 0;
    this.phase = 'ride';
    // A sidecar outfit with a machine gun: call a comrade over to man it.
    const seat = v.seats.findIndex((x) => x.role === 'sidecarMg');
    if (!v.mg || seat < 0 || v.occupants[seat]) return;
    const b = this.s.body;
    let best = null,
      bd = 30;
    for (const o of this.game.soldiers) {
      if (o === this.s || !o.alive || o.team !== this.s.team || o.vehicle || o.isPlayer || o.tankCrew) continue;
      const br = o.brain;
      if (!br || br.ride || br.target || !br.goal || typeof br._perceive !== 'function') continue;
      const d = Math.hypot(o.body.x - b.x, o.body.z - b.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) return;
    this.mate = best;
    this.mateRide = best.brain.ride = new GunnerRide(best.brain, v, seat);
    this.phase = 'wait';
  }

  // Route from here to the goal on the bike grid (one search per tick for all bots).
  _plan() {
    const g = this.game;
    const nav = bikeNav(g);
    const goal = this.brain.goal;
    const p = this.v.body.position;
    if (!nav || !goal) {
      this.path = goal ? [{ x: goal.x, z: goal.z }] : null;
      this.start = { x: p.x, z: p.z };
      this.i = 0;
      return;
    }
    if (g.navBudget <= 0) return;
    g.navBudget--;
    const path = nav.findPath(p.x, p.z, goal.x, goal.z, 120000, { partial: true });
    this.planT = g.time + (path?.partial ? 6 : 25);
    if (!path || !path.length) {
      this.failed = (this.failed || 0) + 1;
      return;
    }
    this.path = path;
    this.start = { x: p.x, z: p.z };
    this.i = 0;
  }

  _ride(dt) {
    const v = this.v;
    const g = this.game;
    const goal = this.brain.goal;
    const p = v.body.position;
    if (!goal || (this.failed || 0) > 2) {
      this.phase = 'stop';
      return;
    }
    // The fight moves on: head for wherever his side now needs him.
    this.goalT = (this.goalT ?? 3) - dt;
    if (this.goalT <= 0) {
      this.goalT = 3;
      const next = g.mode?.botGoal?.(this.brain);
      if (next && next.id !== goal.id) {
        this.brain.goal = next;
        this.path = null;
        this.planT = 0;
        return;
      }
    }
    if (Math.hypot(goal.x - p.x, goal.z - p.z) - goal.radius < DISMOUNT) {
      this.phase = 'stop';
      return;
    }
    if (!this.path || g.time > this.planT) this._plan();
    const path = this.path;
    if (!path) {
      v.driverInput(0, 0, true);
      return;
    }
    const u = v.speed;
    // Backing off something he ran into.
    if (this.backT > 0) {
      this.backT -= dt;
      v.driverInput(-0.7, this.backSteer, false);
      if (this.backT <= 0) this.path = null;
      return;
    }
    // Pure pursuit: aim at a point a little way along the route.
    const A = this.i > 0 ? path[this.i - 1] : this.start;
    const B = path[this.i];
    const ax = B.x - A.x,
      az = B.z - A.z;
    const len2 = Math.max(1e-6, ax * ax + az * az);
    const tSeg = clamp(((p.x - A.x) * ax + (p.z - A.z) * az) / len2, 0, 1);
    if ((tSeg > 0.999 || Math.hypot(B.x - p.x, B.z - p.z) < 2.5) && this.i < path.length - 1) this.i++;
    const Ld = clamp(Math.abs(u) * 1.3, 4, 16);
    let cx = A.x + ax * tSeg,
      cz = A.z + az * tSeg,
      k = this.i,
      need = Ld,
      tx = B.x,
      tz = B.z;
    for (;;) {
      const n = path[k];
      const seg = Math.hypot(n.x - cx, n.z - cz);
      if (seg >= need || k === path.length - 1) {
        const f = Math.min(1, need / Math.max(seg, 1e-6));
        tx = cx + (n.x - cx) * f;
        tz = cz + (n.z - cz) * f;
        break;
      }
      need -= seg;
      cx = n.x;
      cz = n.z;
      k++;
    }
    const dx = tx - p.x,
      dz = tz - p.z;
    const alpha = wrapAngle(Math.atan2(-dx, -dz) - v.yaw); // + = to the left
    let kappa = (2 * Math.sin(alpha)) / Math.max(2, Math.hypot(dx, dz));
    if (Math.abs(alpha) > 1.2) kappa = Math.sign(alpha) * 1e3; // behind him: as tight as he can
    // He asks no more of the tires than the ground really gives (on loose
    // ground with a margin: bots don't get to learn from a fall).
    const kMax = maxCurvature(v, Math.abs(u));
    const mu = v._gripNow ?? 0.6;
    const kSafe = ((mu < 0.62 ? 0.5 : 0.7) * mu * G) / Math.max(u * u, 0.25);
    let steer = clamp(-kappa / kMax, -1, 1);
    const lim = Math.min(1, kSafe / kMax);
    steer = clamp(steer, -lim, lim);
    // Speed: what the corners ahead allow, slowing in good time, and to a stop
    // at the end of the route.
    const aLat = (v.pedal || v.rig ? 0.25 : 0.3) * G;
    const aBrake = 2.5;
    const soft = (v._gripNow ?? 0.7) < 0.62;
    let vt = v.pedal ? (soft ? 6 : 9) : soft ? 7.5 : 19;
    // Water ahead (a ford): through it at a walk.
    if (v.waterDepth > 0.05 || g.world.waterLevelAt?.(tx, tz) != null) vt = Math.min(vt, 2.5);
    // Pointing well off the route (a hairpin, or after a detour): slow first.
    if (Math.abs(alpha) > 0.5) vt = Math.min(vt, Math.max(3, 9 - 6 * Math.abs(alpha)));
    let dist = Math.hypot(B.x - p.x, B.z - p.z);
    let prev = A;
    for (let j = this.i; j < Math.min(path.length - 1, this.i + 8); j++) {
      const b = path[j],
        c = path[j + 1];
      const l0 = Math.hypot(b.x - prev.x, b.z - prev.z),
        l1 = Math.hypot(c.x - b.x, c.z - b.z);
      const th = Math.abs(wrapAngle(Math.atan2(c.x - b.x, c.z - b.z) - Math.atan2(b.x - prev.x, b.z - prev.z)));
      if (th > 0.03) {
        const vc = Math.max(3, Math.min((1.3 * aLat) / Math.tan(Math.min(th, 2.8) / 2), Math.sqrt((aLat * Math.max(2, Math.min(l0, l1))) / th)));
        vt = Math.min(vt, Math.sqrt(vc * vc + 2 * aBrake * dist));
      }
      dist += l1;
      prev = b;
    }
    if (!path.partial) {
      let left = Math.hypot(B.x - p.x, B.z - p.z);
      for (let j = this.i; j < path.length - 1; j++) left += Math.hypot(path[j + 1].x - path[j].x, path[j + 1].z - path[j].z);
      vt = Math.min(vt, Math.sqrt(2 * aBrake * Math.max(0, left - 3)));
      if (left < 4) {
        this.phase = 'stop';
        return;
      }
    }
    // Feelers ahead: a tree, a wall or a vehicle in the way. He steers round it
    // (to the side with more room) and slows to stop short of it if need be.
    const [fr, fc, fl, len] = this._feel(v, u);
    if (fc < len || fr < len * 0.7 || fl < len * 0.7) {
      const away = fl > fr ? -1 : 1;
      steer = clamp(steer + away * (1 - Math.min(fc, fl, fr) / len) * 1.2, -lim, lim);
      vt = Math.min(vt, Math.sqrt(2 * 3 * Math.max(0, fc - 2.5)));
    }
    const err = vt - u;
    const drive = err > 0.4 ? clamp(err / 3, 0.35, 1) : err < -1.5 ? clamp(err / 4, v.rig ? -0.6 : -1, -0.25) : 0;
    // Pedal hard on a bicycle while he still has the legs for it.
    const sprint = v.pedal && err > 2 && Math.abs(steer) < 0.3 && (this.s.body.stamina ?? 0) > 55;
    // Smooth hands: no sudden stabs at the bars when the route turns a corner.
    this.steer = approach(this.steer ?? 0, steer, 2.5 * dt);
    v.driverInput(drive, this.steer, false, sprint);
    // Stuck against something (or stopped short of it): back off a little and
    // plan again.
    if (Math.abs(u) < 0.5) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 3) {
      this.stuckT = 0;
      if (++this.stuckN > 3) this.phase = 'stop';
      else {
        this.backT = 1.6;
        this.backSteer = -Math.sign(steer || 1);
      }
    }
  }

  // Clear distances ahead to the right, straight on and to the left (rays at
  // knee height), and how far it looked.
  _feel(v, u) {
    const coll = this.game.world.collision;
    const p = v.body.position;
    const len = 3 + Math.abs(u) * 1.1;
    const out = this._feelOut || (this._feelOut = [0, 0, 0, 0]);
    if (v.proxies) for (const q of v.proxies) q.box.enabled = false;
    for (let k = 0; k < 3; k++) {
      const yaw = v.yaw + (k - 1) * 0.35;
      const hit = coll.raycast(p.x, p.y + 0.1, p.z, -Math.sin(yaw), 0, -Math.cos(yaw), len, _hit, FLAG_SOLID, false);
      out[k] = hit ? _hit.t : len;
    }
    if (v.proxies) for (const q of v.proxies) q.box.enabled = true;
    out[3] = len;
    return out;
  }

  // Brake to a walk and get off (on the stand if it's slow enough).
  _stop(dt) {
    const v = this.v;
    const u = v.speed;
    if (Math.abs(u) > 1.2) {
      // Firmly but not in a panic (a sidecar outfit braked hard in a turn
      // swings round and can go over), straightening up as he slows.
      this.steer = approach(this.steer ?? 0, 0, 1.5 * dt);
      v.driverInput(u > 0 ? (v.rig ? -0.5 : -0.8) : 0, this.steer, false);
      return true;
    }
    v.driverInput(0, 0, true);
    v.exit(this.s);
    return this._end();
  }

  _end() {
    const v = this.v;
    if (v.claimedBy === this.s) v.claimedBy = null;
    const brain = this.brain;
    brain.path = null;
    brain.pathT = 0;
    // Don't go straight back for another one.
    brain.noRideUntil = this.game.time + 20;
    return false;
  }
}

// In the sidecar: climb in, lay the machine gun on what he sees, fire bursts,
// and get out when the driver does.
export class GunnerRide {
  constructor(brain, v, seat) {
    this.brain = brain;
    this.s = brain.s;
    this.game = brain.game;
    this.v = v;
    this.seat = seat;
    this.phase = 'walk';
    this.t = 0;
    this.replanT = 0;
    this.burst = 0;
    this.pause = 0;
    brain.path = null;
  }

  update(dt) {
    const s = this.s;
    const v = this.v;
    if (!s.alive) return false;
    if (this.phase === 'walk') {
      look(this.brain, dt);
      if (this.brain.target && targetDist(this.brain) < 120) return this._end();
      const r = walkTo(this, dt);
      if (r === 'fail') return this._end();
      if (r === 'on') this.phase = 'sit';
      return true;
    }
    if (s.vehicle !== v) return this._end();
    s.yaw = this.brain.lookYaw = v.yaw + v.mgYaw;
    look(this.brain, dt);
    // The driver got off and it has stopped: out we get too.
    if (!v.occupants[0] && Math.abs(v.speed) < 1.5) {
      v.mg.trigger = false;
      v.exit(s);
      return this._end();
    }
    this._gun(dt);
    return true;
  }

  _gun(dt) {
    const v = this.v;
    const g = this.game;
    const t = this.brain.target;
    const mg = v.mg;
    mg.trigger = false;
    if (t?.alive && v.alive) {
      const tp = t.isVehicle ? t.body.position : t.body;
      const m = v.anchorWorld('mgMuzzle', _p);
      const dist = Math.hypot(tp.x - m.x, tp.z - m.z);
      if (dist < 450) {
        // Lead for the bullet's flight and the outfit's own motion, plus a
        // human error that he keeps correcting with the tracers.
        const tof = dist / 760;
        const tv = t.isVehicle ? t.body.velocity : { x: t.body.vx, y: 0, z: t.body.vz };
        const bv = v.body.velocity;
        const aimY = (t.isVehicle ? tp.y + 1 : t.body.y + 1.0) + 0.5 * G * tof * tof;
        _d.set(tp.x + (tv.x - bv.x) * tof - m.x, aimY - m.y, tp.z + (tv.z - bv.z) * tof - m.z).normalize();
        this.errT = (this.errT ?? 0) - dt;
        if (this.errT <= 0) {
          this.errT = 0.6;
          const e = this.brain.skill.aim * (0.8 + Math.hypot(bv.x, bv.z) * 0.15) * DEG;
          this.err = { x: gaussRandom(0, e), y: gaussRandom(0, e * 0.6) };
        }
        _d.x += this.err?.x ?? 0;
        _d.y += this.err?.y ?? 0;
        v.aimMgAt(_d.normalize());
        // Bursts once the gun is laid near enough (and no friend in the way).
        const laid = v.mgDir(new THREE.Vector3()).dot(_d) > Math.cos(4 * DEG) && !friendInLine(this.s, m, _d, dist);
        if (this.pause > 0) this.pause -= dt;
        else if (laid) {
          if (this.burst <= 0) this.burst = 0.35 + rand() * 0.5;
          this.burst -= dt;
          mg.trigger = true;
          if (this.burst <= 0) this.pause = 0.5 + rand() * 0.9;
        }
      }
    } else {
      // Nothing to shoot: the gun forward.
      v.mgAim.yaw *= 1 - Math.min(1, dt);
      v.mgAim.pitch *= 1 - Math.min(1, dt);
    }
    const n = mg.takeShots();
    for (let i = 0; i < n; i++) g.vehicleMgShot(v, mg, 'mgMuzzle', v.mgDir(new THREE.Vector3()), this.s);
  }

  _end() {
    if (this.v.mg) this.v.mg.trigger = false;
    this.brain.path = null;
    this.brain.pathT = 0;
    this.brain.noRideUntil = this.game.time + 20;
    return false;
  }
}
