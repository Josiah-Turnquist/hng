// A computer-crewed tank. It drives along routes planned for its size, holds
// back from the point its side is fighting over to support the infantry,
// looks for targets through the gun sight (slowly - it's buttoned up), lays the
// gun with the turret's real traverse, picks armor-piercing for vehicles and
// high explosive for infantry, fires when the sight is on, and stops to shoot
// unless the gun is stabilized.
import * as THREE from 'three';
import { clamp, wrapAngle, DEG, rand } from '../core/math.js';
import { FLAG_SIGHT, RayHit } from '../physics/collision.js';
import { SHELLS, isHE } from '../vehicles/defs.js';
import { leavesBetween } from './tactics.js';
import { BotBrain } from './bot.js';
import { friendInLine } from './riderBot.js';

// How far short of a point a tank that can't reach it tries to get, in turn (m).
const BACK = [0, 50, 90, 140];

// Stuck: if it is stuck again less than this far (m) from where it was last
// stuck, the backing off didn't help; it backs off for longer (s), and after
// this many tries in the same place it gives up that point for a while.
const ESCAPE_TRY = 2.5; // s of backing that gets it nowhere before it tries going forward (the gear change alone takes over a second)
const STRAIGHT_TRY = 4; // s it drives straight on (or back) to get clear of something beside it
const STRAND_TIME = 60; // s of trying to go and getting nowhere before the last resort
const STRAND_MOVE = 4; // m: less than this from where it was is nowhere
const STRAND_UNSEEN = 90; // m: no player nearer than this to it, or to where it is set down
const CORNER_NEAR = 2.5; // m from a point of its route at which it has reached it, whatever lies beyond
const AHEAD_CLOSED = 2; // m ahead of the nose that it takes as blocked, when stuck
const CLOSED_FOR = 60; // s it stays so
const STUCK_PROGRESS = 8;
const REVERSE_LONG = 5;
const STUCK_TRIES = 3;
// Throttle for a sharp turn that isn't coming round at the usual quarter.
const TURN_HARD = 0.5;

// How far a tank crew makes out men at all (m).
const INFANTRY_SIGHT = 900;
const _lv = { total: 0, dense: 0, hides: false };

const _hit = new RayHit();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class TankBrain {
  constructor(game, soldier, vehicle) {
    this.game = game;
    this.s = soldier;
    this.v = vehicle;
    this.thinkT = rand() * 0.4;
    this.path = null;
    this.pathI = 0;
    this.pathT = 0;
    this.goal = null;
    this.target = null; // { kind: 'soldier'|'vehicle', obj }
    this.aware = new Map();
    this.lookYaw = soldier.yaw;
    this.stuckT = 0;
    this.strandAt = null;
    this.strandT = 0;
    this.reverseT = 0;
    this.escapeDir = -1;
    this.escapeT = 0;
    this.escapeAt = { x: 0, z: 0 };
    this.fireDelay = 1;
    this.mgBurst = 0;
    this.noRoute = new Map(); // point id -> time until which it's left out
  }

  update(dt) {
    const v = this.v;
    if (!v.alive || v.occupants[0] !== this.s) {
      // His tank was wrecked (in a crash, say) and he got out alive: he fights
      // on foot, as a man who found no room for a tank does (modes/assault.js).
      if (!v.alive && this.s.alive && !this.s.vehicle && this.s.brain === this) this.s.brain = new BotBrain(this.game, this.s);
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.35 + rand() * 0.15;
      this._perceive(0.4);
      this._decide();
    }
    this._drive(dt);
    this._gun(dt);
    this._stranded(dt);
  }

  // The last resort. A tank that has a way to go and has got nowhere for a
  // minute, whatever it tried, is set down on clear ground close by, as
  // abandoned bicycles and jeeps are brought back: only when no player is
  // anywhere near to see it.
  _stranded(dt) {
    const v = this.v;
    const p = v.body.position;
    const a = this.strandAt;
    // (Holding by its point, or halted to fire, it is where it means to be.)
    if (!a || this.holding || this.target || Math.hypot(p.x - a.x, p.z - a.z) > STRAND_MOVE) {
      this.strandAt = { x: p.x, z: p.z };
      this.strandT = 0;
      return;
    }
    // (With nowhere to go it is not stranded, unless it has only given up
    // the points it could not get to from here.)
    if (!this.goal && !this.noRoute.size) return;
    this.strandT += dt;
    if (this.strandT < STRAND_TIME) return;
    this.strandT = STRAND_TIME - 5; // (if it can't be done now, tried again in a few seconds)
    const g = this.game;
    const near = (x, z, r) => g.soldiers.some((s) => s.alive && (s.isPlayer || s.remote) && (s.body.x - x) ** 2 + (s.body.z - z) ** 2 < r * r);
    if (near(p.x, p.z, STRAND_UNSEEN)) return;
    const spot = g.findParking?.(p.x, p.z, 8, 70, 3.5, g.vnav || g.nav);
    if (!spot || near(spot.x, spot.z, STRAND_UNSEEN)) return;
    const b = v.body;
    b.position.set(spot.x, g.world.hf.getHeight(spot.x, spot.z) + v.cg.y + 0.1, spot.z);
    b.velocity.set(0, 0, 0);
    b.angular.set(0, 0, 0);
    b.force.set(0, 0, 0);
    b.torque.set(0, 0, 0);
    b.updateDerived();
    v.syncMoved?.(0);
    v.stir?.();
    this.path = null;
    this.pathT = 0;
    this.stuckT = 0;
    this.stuckN = 0;
    this.reverseT = 0;
    this.strandAt = null;
    this.noRoute.clear();
  }

  _enemyVehicles() {
    return this.game.vehicles.filter((o) => o.alive && o !== this.v && o.team !== this.s.team && o.occupants.some((x) => x));
  }

  _perceive(dt) {
    const v = this.v;
    const eye = v.anchorWorld('gunnerEye', _v) || _v.copy(v.body.position).add(_v2.set(0, 2, 0));
    const coll = this.game.world.collision;
    const own = v.proxies || [];
    for (const p of own) p.box.enabled = false;
    const cands = [];
    for (const o of this._enemyVehicles()) cands.push({ obj: o, kind: 'vehicle', p: o.body.position, h: 0 });
    for (const s of this.game.soldiers) if (s.alive && s.team !== this.s.team && !s.vehicle) cands.push({ obj: s, kind: 'soldier', p: s.body, h: 1.1 });
    let checks = 0;
    for (const c of cands) {
      const dx = c.p.x - eye.x,
        dz = c.p.z - eye.z;
      const d = Math.hypot(dx, dz);
      if (d > (c.kind === 'soldier' ? INFANTRY_SIGHT : 900)) {
        this.aware.set(c.obj, Math.max(0, (this.aware.get(c.obj) || 0) - dt * 0.3));
        continue;
      }
      let a = this.aware.get(c.obj) || 0;
      if (checks < 6) {
        checks++;
        const ty = c.p.y + c.h;
        const dy = ty - eye.y;
        const len = Math.hypot(dx, dy, dz);
        const tgtProx = c.kind === 'vehicle' ? c.obj.proxies || [] : [];
        for (const p of tgtProx) p.box.enabled = false;
        const blocked = coll.raycast(eye.x, eye.y, eye.z, dx / len, dy / len, dz / len, len - 0.5, _hit, FLAG_SIGHT, true);
        for (const p of tgtProx) p.box.enabled = true;
        // Bushes, shrubs and hedges hide men from the crew as from anyone (a
        // vehicle is too big to hide in them); thinner leaves slow spotting.
        const lv = blocked ? null : leavesBetween(coll, eye.x, eye.y, eye.z, c.p.x, ty, c.p.z, _lv);
        if (lv?.hides && c.kind === 'soldier') a = Math.max(0, a - dt * 0.3);
        else if (!blocked) {
          // Buttoned up, a tank crew is slow to spot men; vehicles are obvious.
          const cover = lv.total > 0 ? Math.max(Math.exp(-lv.total / 0.5), 0.04) : 1;
          const rate = (c.kind === 'vehicle' ? 1.4 / (1 + d / 400) : ((c.obj.body.moving > 1 ? 0.9 : 0.4) / (1 + d / 80)) * (c.obj.body.stance === 2 ? 0.3 : 1)) * cover;
          a = Math.min(1.5, a + rate * dt * 2);
        } else a = Math.max(0, a - dt * 0.3);
      }
      this.aware.set(c.obj, a);
    }
    for (const p of own) p.box.enabled = true;
    // Choose: enemy tanks first, then other vehicles, then the nearest infantry.
    let best = null,
      bestScore = -Infinity;
    for (const c of cands) {
      if ((this.aware.get(c.obj) || 0) < 1) continue;
      const d = Math.hypot(c.p.x - v.body.position.x, c.p.z - v.body.position.z);
      const tank = c.kind === 'vehicle' && c.obj.def.kind === 'tracked';
      const score = (tank ? 600 : c.kind === 'vehicle' ? 300 : 0) - d + (this.target?.obj === c.obj ? 80 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best?.obj !== this.target?.obj) this.fireDelay = 0.8 + rand() * 1.2; // laying and ranging
    this.target = best ? { kind: best.kind, obj: best.obj } : null;
    for (const [o] of this.aware) if (!o.alive) this.aware.delete(o);
  }

  _decide() {
    const g = this.game;
    const v = this.v;
    for (const [id, t] of this.noRoute) if (g.time > t) this.noRoute.delete(id);
    const goal = g.mode.botGoal?.(this, { vehicle: true, exclude: this.noRoute }) || null;
    if (goal && (!this.goal || goal.id !== this.goal.id)) {
      this.goal = goal;
      this.path = null;
      this.pathT = 0;
    }
    if (!this.goal) return;
    // Hold back from the point to support the infantry (and stay out of the streets).
    const b = v.body.position;
    const dGoal = Math.hypot(this.goal.x - b.x, this.goal.z - b.z);
    this.holding = dGoal < 90 && this._seesPoint();
    // (After a route search fails, wait for pathT before trying again; meanwhile
    // the tank holds where it is and fights.)
    if (!this.holding && g.time > this.pathT) this._plan(this.goal.x, this.goal.z);
  }

  _seesPoint() {
    const v = this.v;
    const eye = v.anchorWorld('gunnerEye', _v) || v.body.position;
    const g = this.goal;
    const gy = this.game.world.hf.getHeight(g.x, g.z) + 1.5;
    return this.game.world.collision.lineOfSight(eye.x, eye.y, eye.z, g.x, gy, g.z);
  }

  _plan(x, z) {
    const g = this.game;
    const nav = g.vnav || g.nav;
    const b = this.v.body.position;
    if (!nav) {
      this.pathT = g.time + 0.5;
      return;
    }
    // The route is worked out over the next few steps of the battle (a long
    // one all at once is a stutter): asked for again until it comes.
    // Can't get right there (e.g. the point is inside the village): get as
    // close as the tank can, on the side it's coming from, trying 50, 90 and
    // 140 m short in turn. (Not when the route is simply too long: points a
    // little nearer won't be any shorter.)
    const d = Math.hypot(x - b.x, z - b.z) || 1;
    const back = BACK[this.planTry || 0];
    const p = nav.findPathSoon(this, b.x, b.z, x - ((x - b.x) / d) * back, z - ((z - b.z) / d) * back, 120000);
    if (p === undefined) {
      this.pathT = g.time + 0.05;
      return;
    }
    if (!p && nav.lastFail !== 'limit' && (this.planTry || 0) < BACK.length - 1 && BACK[(this.planTry || 0) + 1] < d) {
      this.planTry = (this.planTry || 0) + 1;
      this.pathT = g.time + 0.05;
      return;
    }
    this.planTry = 0;
    this.pathT = g.time + 15 + rand() * 5;
    // Stop well short of the point itself.
    if (p) {
      while (p.length > 1) {
        const last = p[p.length - 1];
        if (Math.hypot(last.x - x, last.z - z) > 60) break;
        p.pop();
      }
    }
    this.path = p;
    this.pathI = 0;
    // No route (or too long a drive): leave that point to others for a few
    // minutes and take the next one, or hold here and fight.
    if (!p) {
      if (this.goal) this.noRoute.set(this.goal.id, g.time + 150 + rand() * 60);
      this.goal = null;
      this.pathT = 0;
    }
  }

  _drive(dt) {
    const v = this.v;
    const b = v.body;
    let drive = 0,
      steer = 0;
    const engaging = this.target && (this.target.kind === 'vehicle' || !v.def.turret.stabilizer);
    const p = this.path && this.pathI < this.path.length ? this.path[this.pathI] : null;
    if (this.reverseT > 0) {
      // Backing out of something we drove into. If backing gets it nowhere
      // either (it is what is behind that holds it: a tank backed against a
      // trunk went on backing into it for the rest of the battle), forward.
      this.reverseT -= dt;
      this.escapeT += dt;
      if (this.escapeT > ESCAPE_TRY) {
        if (Math.hypot(b.position.x - this.escapeAt.x, b.position.z - this.escapeAt.z) < 0.4) this.escapeDir = -this.escapeDir;
        this.escapeT = 0;
        this.escapeAt = { x: b.position.x, z: b.position.z };
      }
      drive = 0.7 * this.escapeDir;
      steer = this.reverseSteer * (this.escapeDir < 0 ? 1 : 0.3);
    } else if (p && !this.holding && !(engaging && this.fireDelay < 1.5)) {
      const dx = p.x - b.position.x,
        dz = p.z - b.position.z;
      const d = Math.hypot(dx, dz);
      // A point of the route counts as reached from a few meters off only if
      // the way straight on to the next one is clear: reached from 6 m off
      // whatever lay between, a tank cut every corner, across the wall or the
      // tree the route had been taken round.
      const next = this.path[this.pathI + 1];
      const nav = this.game.vnav || this.game.nav;
      if (d < CORNER_NEAR || (d < 6 && (!next || !nav?.lineWalkable || nav.lineWalkable(b.position.x, b.position.z, next.x, next.z)))) this.pathI++;
      else {
        const f = v.forward;
        const want = Math.atan2(-dx, -dz);
        const have = Math.atan2(-f.x, -f.z);
        const err = wrapAngle(want - have);
        steer = clamp(-err * 2, -1, 1);
        // (Turning on the spot at a quarter throttle a Panzer IV doesn't turn
        // at all, and a Sherman barely: not getting round, he gives it more.)
        if (Math.abs(err) <= 0.7) this.hardTurn = false;
        else if (this.stuckT > 1) this.hardTurn = true;
        drive = Math.abs(err) > 0.7 ? (this.hardTurn ? TURN_HARD : 0.25) : Math.abs(err) > 0.3 ? 0.6 : 1;
        this.wasAhead = Math.abs(err) <= 0.7;
        // Slow down for the last waypoint.
        if (this.pathI === this.path.length - 1 && d < 25) drive *= 0.5;
      }
    }
    // Asked to go and not going (a start on a slope, soft ground): all the
    // throttle it has, before deciding it is stuck.
    if (drive > 0.2 && this.stuckT > 1 && this.reverseT <= 0) drive = 1;
    v.driverInput(drive, steer, false);
    // Stuck against something: reverse a bit, then find another way.
    if (Math.abs(drive) > 0.2 && Math.abs(v.speed) < 0.3 && this.reverseT <= 0) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 3) {
      this.stuckT = 0;
      // Stuck again where he was stuck last time: backing off and taking the
      // same route has not worked (wedged on low posts the route doesn't
      // know about, a tank sat there for minutes). Back off further, and
      // after a few tries leave that point for a while, as when no route is found.
      const at = b.position;
      const last = this.stuckAt;
      this.stuckN = last && Math.hypot(at.x - last.x, at.z - last.z) < STUCK_PROGRESS ? (this.stuckN || 0) + 1 : 1;
      this.stuckAt = { x: at.x, z: at.z };
      if (this.wasAhead) {
        // Driving on when it stopped: what holds it is ahead. Back off, turning.
        this.reverseT = this.stuckN > 1 ? REVERSE_LONG : 2.5;
        this.reverseSteer = rand() < 0.5 ? -0.6 : 0.6;
        this.escapeDir = -1;
      } else {
        // Turning on the spot when it stopped: something stands beside it or
        // behind it (a hull as long as a tank's cannot swing with a trunk
        // against the middle of its side). Straight on a few meters to get
        // clear of it, and the next time straight back.
        this.reverseT = STRAIGHT_TRY;
        this.reverseSteer = 0;
        this.escapeDir = this.stuckN % 2 ? 1 : -1;
      }
      this.escapeT = 0;
      this.escapeAt = { x: at.x, z: at.z };
      // Whatever stopped it is just ahead of its nose: the routes worked out
      // in the next minute go round that place. (Backing off and asking
      // again gave the same route, into the same hedge bank or wall.)
      // (Only when it was driving on, not when it was turning on the spot:
      // then what stopped it is not ahead.)
      if (this.wasAhead) {
        const nav = this.game.vnav || this.game.nav;
        const f = v.forward;
        const ahead = v.def.dims[2] / 2 + AHEAD_CLOSED;
        nav?.closeFor?.(at.x + f.x * ahead, at.z + f.z * ahead, AHEAD_CLOSED + 0.5, CLOSED_FOR, this.game.time);
      }
      this.path = null;
      this.pathT = 0;
      if (this.stuckN >= STUCK_TRIES && this.goal) {
        this.noRoute.set(this.goal.id, this.game.time + 150 + rand() * 60);
        this.goal = null;
        this.stuckN = 0;
      }
    }
  }

  _gun(dt) {
    const v = this.v;
    const t = this.target;
    const g = this.game;
    v.coax.trigger = false;
    if (!t || !t.obj.alive) {
      // Scan ahead.
      const f = v.forward;
      v.aim.yaw = Math.atan2(-f.x, -f.z);
      v.aim.pitch = 0;
      return;
    }
    const m = v.muzzleWorld(_v);
    const tp = t.kind === 'vehicle' ? t.obj.body.position : t.obj.body;
    const tv = t.kind === 'vehicle' ? t.obj.body.velocity : { x: t.obj.body.vx, y: 0, z: t.obj.body.vz };
    const aimY = (tp.y ?? 0) + (t.kind === 'vehicle' ? 0.2 : 0.9);
    const d = Math.hypot(tp.x - m.x, tp.z - m.z);
    // Pick the shell: armor-piercing for vehicles, HE for men.
    const ap = v.ammoTypes.find((id) => SHELLS[id].penRefMM);
    const he = v.ammoTypes.find((id) => isHE(SHELLS[id]));
    const want = t.kind === 'vehicle' ? ap : he || ap;
    if (want && v.nextAmmo !== want && v.stowed[want] > 0) v.selectAmmo(v.ammoTypes.indexOf(want));
    const shell = SHELLS[v.loaded || v.nextAmmo || ap];
    const tof = d / (shell.mv * 0.9);
    const ax = tp.x + tv.x * tof,
      az = tp.z + tv.z * tof;
    const dx = ax - m.x,
      dy = aimY - m.y,
      dz = az - m.z;
    v.aim.yaw = Math.atan2(-dx, -dz);
    v.aim.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    // The gunner sets the range drum to his estimate (within ~10%).
    if (!this.rangeEst || Math.abs(this.rangeEst - d) > d * 0.15) this.rangeEst = d * (0.92 + rand() * 0.16);
    v.setSightRange(this.rangeEst);
    v.layRange = null; // (a player's laying, if he sat here before)
    // Fire when the sight is on and (unless stabilized) the hull is nearly still.
    this.fireDelay -= dt;
    const dir = v.sightDir(_v2);
    const to = new THREE.Vector3(dx, dy, dz).normalize();
    const off = Math.acos(clamp(dir.dot(to), -1, 1));
    const size = (t.kind === 'vehicle' ? 1.2 : 0.4) / Math.max(d, 1);
    const steady = v.def.turret.stabilizer ? Math.abs(v.speed) < 5 : Math.abs(v.speed) < 1;
    // Don't fire high explosive at enemies mixed up with our own men, nor
    // anything through them.
    let clear = true;
    if (t.kind === 'soldier')
      for (const o of g.soldiers) {
        if (o.alive && o.team === this.s.team && !o.vehicle && Math.hypot(o.body.x - tp.x, o.body.z - tp.z) < 12) clear = false;
      }
    const lineDist = Math.hypot(dx, dy, dz);
    const friendAhead = friendInLine(this.s, m, to, lineDist);
    if (this.fireDelay <= 0 && v.loaded && off < size + 0.0015 && steady && clear && !friendAhead) {
      const p = v.fireMain(this.s);
      if (p) this.fireDelay = 0.5 + rand();
    }
    // Coaxial MG on infantry within a few hundred meters.
    if (t.kind === 'soldier' && d < 350 && off < 0.02) {
      this.mgBurst -= dt;
      if (this.mgBurst < -1.2) this.mgBurst = 0.8 + rand();
      v.coax.trigger = this.mgBurst > 0 && !friendAhead;
    }
    // Shots from the coax are fired by the game for the crew.
    const n = v.coax.takeShots();
    for (let i = 0; i < n; i++) g.vehicleMgShot(v, v.coax, 'coaxMuzzle', v.boreDir(new THREE.Vector3()), this.s);
  }
}
