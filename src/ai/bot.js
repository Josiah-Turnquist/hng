// A computer-controlled soldier. It works the same body, weapon and bullets as
// the player: it has to see you (line of sight, distance, your stance and
// movement), react, lay its sights on you with a human aiming error that shrinks
// as it tracks, allow for drop and lead at range, and manage its weapon (bolt,
// bursts, reloads). It moves along paths from the navigation grid to the point
// its side is fighting over, and crouches or goes prone when engaging.
import * as THREE from 'three';
import { STANCE } from '../actors/body.js';
import { clamp, gaussRandom, wrapAngle, DEG, G } from '../core/math.js';
import { FLAG_SIGHT, RayHit } from '../physics/collision.js';
import { findRide } from './riderBot.js';

const _hit = new RayHit();
const _eye = { x: 0, y: 0, z: 0 };
const _v = new THREE.Vector3();

export const SKILL = {
  recruit: { reaction: [0.6, 1.1], aim: 2.2, track: 1.2, spot: 0.7, burst: [2, 5] },
  regular: { reaction: [0.4, 0.8], aim: 1.4, track: 1.8, spot: 1, burst: [3, 6] },
  veteran: { reaction: [0.3, 0.55], aim: 0.9, track: 2.6, spot: 1.3, burst: [3, 8] },
};

export class BotBrain {
  constructor(game, soldier, { skill = 'regular' } = {}) {
    this.game = game;
    this.s = soldier;
    this.skill = SKILL[skill] || SKILL.regular;
    this.thinkT = Math.random() * 0.3;
    this.path = null;
    this.pathI = 0;
    this.pathT = 0;
    this.goal = null;
    this.target = null;
    this.aware = new Map(); // enemy -> 0..1 how sure we are they're there
    this.lastSeen = new Map(); // enemy -> { x, y, z, t }
    this.reactT = 0;
    this.err = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
    this.burstLeft = 0;
    this.holdFire = 0;
    this.stuckT = 0;
    this.lastPos = { x: soldier.body.x, z: soldier.body.z };
    this.wander = null;
    this.wanderT = 0;
    this.lookYaw = soldier.yaw;
    this.lookPitch = 0;
    this.strafe = 0;
    this.strafeT = 0;
  }

  // Carrying a bazooka, Panzerschreck, Panzerfaust or anti-tank rifle.
  get hasAT() {
    const t = this.s.weapon?.def.type;
    return t === 'launcher' || t === 'atRifle';
  }

  get enemies() {
    return this.game.soldiers.filter((o) => o.alive && o.team !== this.s.team);
  }

  update(dt) {
    const s = this.s;
    if (!s.alive) return;
    // Getting to, riding or getting off a bicycle or motorcycle (riderBot.js).
    if (this.ride) {
      if (this.ride.update(dt)) return;
      this.ride = null;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.2 + Math.random() * 0.1;
      this._perceive(0.25);
      this._decide();
    }
    this._move(dt);
    this._aimAndShoot(dt);
  }

  // --- seeing ----------------------------------------------------------------
  _perceive(dt) {
    const s = this.s;
    const b = s.body;
    b.eyePosition(_eye);
    const fx = -Math.sin(s.yaw),
      fz = -Math.cos(s.yaw);
    const coll = this.game.world.collision;
    let checks = 0;
    const at = this.hasAT;
    const list = this.enemies
      .filter((e) => !(e.vehicle && e.vehicle.def.kind === 'tracked'))
      .map((e) => ({ e, d: Math.hypot(e.body.x - b.x, e.body.z - b.z) }));
    if (at) for (const v of this.game.vehicles) if (v.alive && v.team !== s.team && v.occupants.some((o) => o)) list.push({ e: v, d: Math.hypot(v.body.position.x - b.x, v.body.position.z - b.z) });
    list.sort((a, b2) => a.d - b2.d);
    for (const { e, d } of list) {
      if (d > 520) continue;
      let a = this.aware.get(e) || 0;
      const ti = tinfo(e, _ti);
      const dx = ti.x - b.x,
        dz = ti.z - b.z;
      const inView = (dx * fx + dz * fz) / Math.max(d, 1e-3) > 0.35 || d < 6;
      const firing = e.isVehicle ? Math.abs(e.speed) > 0.5 || e.engineOn : this.game.time - (e.lastShotTime ?? -99) < 1.2;
      const heard = firing && d < (e.isVehicle ? 250 : 120);
      let visible = false;
      let cover = 1;
      if ((inView || heard || a > 0.3) && checks < 5) {
        checks++;
        const ty = ti.y + ti.h * 0.85;
        const vx = ti.x - _eye.x,
          vy = ty - _eye.y,
          vz = ti.z - _eye.z;
        const len = Math.hypot(vx, vy, vz);
        // A hit on the target's own vehicle counts as seeing it.
        const veh = e.isVehicle ? e : e.vehicle;
        visible = !coll.raycast(_eye.x, _eye.y, _eye.z, vx / len, vy / len, vz / len, len - 0.4, _hit, FLAG_SIGHT, true) || (veh && _hit.box?.owner === veh);
        // Leaves in the way are partial cover: the thicker the foliage, the
        // longer it takes to pick someone out (about 4 times as long behind a
        // hedge), but nobody vanishes, and a muzzle flash shows through.
        if (visible) {
          const leaves = coll.foliageAlong(_eye.x, _eye.y, _eye.z, ti.x, ty, ti.z);
          if (leaves > 0) cover = Math.max(Math.exp(-leaves / 0.9), firing ? 0.5 : 0.08);
        }
      }
      if (visible && (inView || heard)) {
        // How fast we notice: close, moving, standing, shooting people stand out; vehicles more so.
        const stance = e.isVehicle ? 2 : e.body.stance === STANCE.PRONE ? 0.3 : e.body.stance === STANCE.CROUCH ? 0.65 : 1;
        const moving = (e.isVehicle ? Math.abs(e.speed) > 1 : e.body.moving > 1) ? 1.6 : 1;
        const rate = ((this.skill.spot * 2.6 * stance * moving * (firing ? 3 : 1)) / (1 + d / 70)) * cover;
        a = Math.min(1.5, a + rate * dt * (inView ? 1 : 0.5));
        this.lastSeen.set(e, { x: ti.x, y: ti.y, z: ti.z, t: this.game.time, visible: true });
      } else {
        a = Math.max(0, a - dt * 0.25);
        const ls = this.lastSeen.get(e);
        if (ls) ls.visible = false;
      }
      this.aware.set(e, a);
    }
    // Being shot at: look toward where it came from.
    if (this.game.time - s.lastHitTime < 0.5 && s.lastHitDir && !this.target) {
      this.lookYaw = Math.atan2(-s.lastHitDir.x, -s.lastHitDir.z);
    }
    // Pick the target: the most threatening spotted enemy we can see.
    let best = null,
      bestScore = -Infinity;
    for (const [e, a] of this.aware) {
      if (!e.alive || a < 1) continue;
      const ls = this.lastSeen.get(e);
      if (!ls?.visible) continue;
      const ti = tinfo(e, _ti);
      const d = Math.hypot(ti.x - b.x, ti.z - b.z);
      // With an anti-tank weapon, vehicles in range come first; without, only men.
      if (e.isVehicle && (!at || d > 220)) continue;
      const score = -d + (e.isVehicle ? 400 : 0) + (this.game.time - (e.lastShotTime ?? -99) < 2 ? 40 : 0) + (e === this.target ? 25 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best !== this.target) {
      this.target = best;
      if (best) {
        const r = this.skill.reaction;
        this.reactT = r[0] + Math.random() * (r[1] - r[0]);
        // Starting aim error grows with distance (finding the target in the sights).
        const ti = tinfo(best, _ti);
        const d = Math.hypot(ti.x - b.x, ti.z - b.z);
        const e0 = (this.skill.aim * (0.6 + d / 120)) * DEG;
        this.err.yaw = gaussRandom(0, e0 * 2.2);
        this.err.pitch = gaussRandom(0, e0 * 1.6);
      }
    }
    for (const [e] of this.aware) if (!e.alive) this.aware.delete(e);
  }

  // --- deciding where to go ----------------------------------------------------
  _decide() {
    const s = this.s;
    const b = s.body;
    const mode = this.game.mode;
    const goal = mode.botGoal?.(this) || null;
    if (goal && (!this.goal || goal.id !== this.goal.id)) {
      this.goal = goal;
      this.path = null;
      this.wander = null;
    }
    // A long way to go: take a bicycle or motorcycle if there's one at hand.
    if (!this.target && this.goal && !s.vehicle && !this.ride) this.ride = findRide(this);
    // Reload behind whatever cover we have when there's a lull.
    const w = s.weapon;
    if (w && w.state === 'ready') {
      if (w.loaded === 0 && w.canReload()) w.startReload();
      else if (!this.target && w.loaded < w.def.capacity * 0.4 && w.canReload() && this.game.time - (s.lastShotTime ?? -99) > 2) w.startReload();
    }
    // Stance: crouch when fighting at range, prone with machine guns or under heavy fire.
    if (this.target) {
      const ti = tinfo(this.target, _ti);
      const d = Math.hypot(ti.x - b.x, ti.z - b.z);
      const lmg = w?.def.type === 'lmg' || w?.def.proneOrBipodOnly;
      const want = (lmg && d > 40) || (d > 140 && Math.random() < 0.5) ? STANCE.PRONE : d > 25 ? STANCE.CROUCH : STANCE.STAND;
      if (b.targetStance !== want && Math.random() < 0.5) b.setStance(want);
    } else if (b.targetStance !== STANCE.STAND && (!this.goal || !this._inGoal())) b.setStance(STANCE.STAND);
    // Path to the goal (or a spot inside it).
    if (this.goal && !this.target) {
      if (this._inGoal()) {
        if (!this.wander || this.game.time > this.wanderT) {
          const r = this.goal.radius * 0.7;
          const a = Math.random() * Math.PI * 2,
            rr = Math.sqrt(Math.random()) * r;
          this.wander = { x: this.goal.x + Math.cos(a) * rr, z: this.goal.z + Math.sin(a) * rr };
          this.wanderT = this.game.time + 6 + Math.random() * 10;
          this._plan(this.wander.x, this.wander.z);
        }
      } else if (!this.path || this.game.time > this.pathT) {
        const a = Math.random() * Math.PI * 2,
          rr = Math.sqrt(Math.random()) * this.goal.radius * 0.6;
        this._plan(this.goal.x + Math.cos(a) * rr, this.goal.z + Math.sin(a) * rr);
      }
    }
  }

  _inGoal() {
    const g = this.goal;
    return g && Math.hypot(this.s.body.x - g.x, this.s.body.z - g.z) < g.radius * 0.85;
  }

  _plan(x, z) {
    const nav = this.game.nav;
    const b = this.s.body;
    this.pathT = this.game.time + 12 + Math.random() * 6;
    if (!nav) {
      this.path = [{ x, z }];
      this.pathI = 0;
      return;
    }
    // Path searches are spread out: at most one per tick for all bots.
    if (this.game.navBudget <= 0) {
      this.pathT = this.game.time + 0.3 + Math.random() * 0.5;
      return;
    }
    this.game.navBudget--;
    const p = nav.findPath(b.x, b.z, x, z, 80000, { partial: true });
    this.path = p || [{ x, z }];
    this.pathI = 0;
    // Part of the way only (a long route): plan on again soon.
    if (p?.partial) this.pathT = this.game.time + 6 + Math.random() * 3;
  }

  // --- moving ------------------------------------------------------------------
  _move(dt) {
    const s = this.s;
    const b = s.body;
    const it = s.intent;
    it.mx = it.mz = 0;
    it.sprint = false;
    it.walk = false;
    it.jump = false;
    let wx = 0,
      wz = 0;
    const engaging = this.target && this.reactT <= 0;
    if (this.path && this.pathI < this.path.length) {
      const p = this.path[this.pathI];
      const dx = p.x - b.x,
        dz = p.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < (p.door ? 0.6 : 1.4) || (this.pathI < this.path.length - 1 && d < 2.5 && this._passed(p))) this.pathI++;
      else {
        wx = dx / d;
        wz = dz / d;
      }
    }
    // Keep a little apart from friends.
    for (const o of this.game.soldiers) {
      if (o === s || !o.alive || o.team !== s.team) continue;
      const dx = b.x - o.body.x,
        dz = b.z - o.body.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 4 && d2 > 1e-4) {
        const d = Math.sqrt(d2);
        wx += (dx / d) * (2 - d) * 0.6;
        wz += (dz / d) * (2 - d) * 0.6;
      }
    }
    // Get out of the way of vehicles coming at us.
    for (const v of this.game.vehicles) {
      if (!v.alive || Math.abs(v.speed) < 1) continue;
      const p = v.body.position;
      const dx = b.x - p.x,
        dz = b.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 14 || d < 1e-3) continue;
      const f = v.forward.multiplyScalar(Math.sign(v.speed));
      const ahead = (dx * f.x + dz * f.z) / d;
      if (ahead < 0.3) continue;
      // Step to the side of its path we're already on.
      const side = Math.sign(dx * f.z - dz * f.x) || 1;
      wx += f.z * side * 2.5;
      wz += -f.x * side * 2.5;
      this.strafe = 0;
    }
    // Stuck on something small (a trunk, a post, the end of a parapet): step
    // sideways for a moment.
    if (this.unstickT > 0) {
      this.unstickT -= dt;
      wx = this.unstickX;
      wz = this.unstickZ;
    }
    // While shooting: stop (rifles) or creep, sidestepping now and then.
    let speed = 1;
    if (engaging) {
      const auto = s.weapon && (s.weapon.mode === 'auto' || s.weapon.mode === 'slow');
      const ti = tinfo(this.target, _ti);
      const d = Math.hypot(ti.x - b.x, ti.z - b.z);
      speed = auto && d < 40 ? 0.5 : 0;
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafe = d < 50 && b.stance === STANCE.STAND && Math.random() < 0.5 ? (Math.random() < 0.5 ? -1 : 1) : 0;
        this.strafeT = 0.8 + Math.random() * 1.5;
      }
    } else this.strafe = 0;
    const len = Math.hypot(wx, wz);
    if (len > 0.05) {
      wx /= len;
      wz /= len;
    }
    // Into the body's frame (it faces where we look).
    const fx = -Math.sin(s.yaw),
      fz = -Math.cos(s.yaw);
    const rx = Math.cos(s.yaw),
      rz = -Math.sin(s.yaw);
    let fwd = (wx * fx + wz * fz) * speed;
    let side = (wx * rx + wz * rz) * speed + this.strafe * 0.7;
    it.mz = -clamp(fwd, -1, 1);
    it.mx = clamp(side, -1, 1);
    // Run when there's ground to cover and nobody to shoot.
    const farToGo = this.goal && !this._inGoal() && Math.hypot(this.goal.x - b.x, this.goal.z - b.z) > 40;
    it.sprint = !this.target && farToGo && fwd > 0.7 && b.stamina > 30 && !b.staminaLock;
    // Stuck? Try to hop, then pick a new path.
    const moved = Math.hypot(b.x - this.lastPos.x, b.z - this.lastPos.z);
    if (len > 0.5 && speed > 0 && moved < 0.25 * dt) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    this.lastPos.x = b.x;
    this.lastPos.z = b.z;
    if (this.stuckT > 0.8 && this.stuckT < 0.9) it.jump = true;
    if (this.stuckT > 1.6 && !(this.unstickT > 0) && len > 0.5) {
      // Sideways (and a little back) from where we were trying to go.
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.unstickX = -wz * dir - wx * 0.35;
      this.unstickZ = wx * dir - wz * 0.35;
      this.unstickT = 0.9;
    }
    if (this.stuckT > 3.2) {
      this.stuckT = 0;
      this.path = null;
      this.pathT = 0;
    }
    // Look where we're going when there's nothing to shoot.
    if (!this.target) {
      if (len > 0.05 && speed > 0) this.lookYaw = Math.atan2(-wx, -wz);
      this.lookPitch = 0;
    }
  }

  _passed(p) {
    // Already beyond this waypoint toward the next one.
    const n = this.path[this.pathI + 1];
    if (!n) return false;
    const b = this.s.body;
    const ax = n.x - p.x,
      az = n.z - p.z;
    return (b.x - p.x) * ax + (b.z - p.z) * az > 0;
  }

  // --- aiming and shooting --------------------------------------------------------
  _aimAndShoot(dt) {
    const s = this.s;
    const b = s.body;
    const w = s.weapon;
    const t = this.target;
    let wantYaw = this.lookYaw,
      wantPitch = this.lookPitch;
    let pull = false;
    if (t && t.alive) {
      if (this.reactT > 0) this.reactT -= dt;
      b.eyePosition(_eye);
      const ti = tinfo(t, _ti);
      const d = Math.hypot(ti.x - b.x, ti.z - b.z);
      // Lead a moving target by the bullet's flight time; hold over for drop.
      const mv = w?.def.mv || 700;
      const tof = d / (mv * 0.85);
      const tx = ti.x + ti.vx * tof,
        tz = ti.z + ti.vz * tof;
      const ty = ti.y + ti.h * (t.isVehicle ? 0.5 : 0.72) + ti.vy * tof * 0.5;
      const dx = tx - _eye.x,
        dy = ty - _eye.y,
        dz = tz - _eye.z;
      const hd = Math.hypot(dx, dz);
      wantYaw = Math.atan2(-dx, -dz);
      // The rifle is zeroed (about 100-300 m); hold over by the extra drop.
      const zero = w ? w.zeroRange : 100;
      const drop = (a) => 0.5 * G * (a / (mv * 0.88)) ** 2;
      const hold = Math.max(-0.02, (drop(hd) - (drop(zero) * hd) / Math.max(zero, 1)) / Math.max(hd, 1));
      wantPitch = Math.atan2(dy, hd) + hold;
      // Human aiming error: wanders, shrinks the longer we track, grows when we move.
      const e = this.err;
      const steady = (b.stance === STANCE.PRONE ? 0.45 : b.stance === STANCE.CROUCH ? 0.7 : 1) * (b.moving > 0.5 ? 2.2 : 1) * (1 + (s.suppression || 0));
      const target = this.skill.aim * DEG * 0.18 * steady * (1 + d / 250);
      e.vy += (gaussRandom() * target * 6 - e.yaw * this.skill.track * 3 - e.vy * 3) * dt;
      e.vp += (gaussRandom() * target * 6 - e.pitch * this.skill.track * 3 - e.vp * 3) * dt;
      e.yaw += e.vy * dt;
      e.pitch += e.vp * dt;
      wantYaw += e.yaw;
      wantPitch += e.pitch;
      // Fire once the sights settle on the target (its angular size).
      const size = ti.size / Math.max(d, 1);
      const off = Math.hypot(e.yaw, e.pitch);
      this.holdFire -= dt;
      if (this.reactT <= 0 && off < size * 1.6 + 0.004 && this.holdFire <= 0 && w && w.state === 'ready' && w.loaded > 0) {
        if (!this._friendlyInLine(ti, d)) pull = true;
      }
      s.aiming = d > 12 && w?.def.type !== 'lmg';
    } else {
      s.aiming = false;
      this.target = t && t.alive ? t : null;
    }
    // Turn the head and gun at a human rate.
    const maxTurn = (t ? 5 : 3) * dt;
    s.yaw += clamp(wrapAngle(wantYaw - s.yaw), -maxTurn, maxTurn);
    s.pitch = clamp(s.pitch + clamp(wantPitch - s.pitch, -maxTurn, maxTurn), -1.2, 1.2);
    b.yaw = s.yaw;
    // Triggers: bursts for automatic weapons, aimed single shots otherwise.
    if (w) {
      const auto = w.mode === 'auto' || w.mode === 'slow';
      if (pull && auto) {
        if (this.burstLeft <= 0) {
          const [lo, hi] = this.skill.burst;
          const ti = tinfo(t, _ti);
          const d = Math.hypot(ti.x - b.x, ti.z - b.z);
          this.burstLeft = Math.max(2, Math.round((lo + Math.random() * (hi - lo)) * (d > 80 ? 0.6 : 1)));
        }
      }
      let trig = pull && (!auto || this.burstLeft > 0);
      if (w.isBolt || (!auto && w.mode !== 'auto')) {
        // Semi-auto and bolt: one press per shot, with a pause to re-aim.
        trig = pull && !w.triggerWasDown;
      }
      w.setTrigger(trig && s.canShoot);
      const shots = w.update(dt);
      for (let i = 0; i < shots; i++) {
        this.game.botFire(s, w);
        if (auto) {
          this.burstLeft--;
          if (this.burstLeft <= 0) this.holdFire = 0.25 + Math.random() * 0.5;
        } else this.holdFire = w.isBolt ? 0.2 : 0.25 + Math.random() * 0.35;
        // Recoil throws the aim off; it's pulled back over the next moments.
        this.err.vp += 0.08 + Math.random() * 0.05;
        this.err.vy += gaussRandom(0, 0.04);
      }
      for (const ev of w.takeEvents()) this.game.onWeaponEvent?.(s, w, ev);
    }
  }

  _friendlyInLine(ti, d) {
    const s = this.s;
    const b = s.body;
    const dx = (ti.x - b.x) / d,
      dz = (ti.z - b.z) / d;
    for (const o of this.game.soldiers) {
      if (o === s || !o.alive || o.team !== s.team) continue;
      const ox = o.body.x - b.x,
        oz = o.body.z - b.z;
      const along = ox * dx + oz * dz;
      if (along < 0.5 || along > d) continue;
      if (Math.abs(ox * dz - oz * dx) < 0.9) return true;
    }
    return false;
  }
}

// Where a target is and how it moves: soldiers and vehicles alike.
function tinfo(t, out) {
  if (t.isVehicle) {
    const p = t.body.position,
      v = t.body.velocity;
    out.x = p.x;
    out.y = p.y - t.cg.y;
    out.z = p.z;
    out.vx = v.x;
    out.vy = v.y;
    out.vz = v.z;
    out.h = t.def.dims[1] * 0.75;
    out.size = 2.2;
  } else {
    const b = t.body;
    out.x = b.x;
    out.y = b.y;
    out.z = b.z;
    out.vx = b.vx;
    out.vy = b.vy;
    out.vz = b.vz;
    out.h = targetHeight(t);
    out.size = 0.35;
  }
  return out;
}
const _ti = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, h: 0, size: 0 };

export function targetHeight(e) {
  const st = e.body.stance;
  return st === STANCE.PRONE ? 0.35 : st === STANCE.CROUCH ? 1.15 : 1.6;
}
