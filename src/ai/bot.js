// A computer-controlled soldier. It works the same body, weapon and bullets as
// the player: it has to see you (line of sight, distance, your stance and
// movement), react, lay its sights on you with a human aiming error that shrinks
// as it tracks, allow for drop and lead at range, and manage its weapon (bolt,
// bursts, reloads). It moves along paths from the navigation grid to the point
// its side is fighting over.
//
// How far it fights depends on its sights: with iron sights it rarely takes on
// a man beyond about 250 m (about as far as a player can make one out on the
// screen), with a scope or a machine gun further; far off, its first shots go
// wide until it sees where they strike. Thick bushes and hedges hide a man from
// it as from the player; one firing from them gives away roughly where he is.
//
// It fights like an infantryman (tactics.js): it makes for cover when a fight
// starts and shoots from it, popping up or leaning out and ducking back down
// (lower and longer under heavy fire), reloads and bandages from behind it,
// lobs a grenade at an enemy who has gone to ground close by, keeps its eyes
// on where an enemy disappeared and, attacking, goes to look for him. It calls
// out what it sees to comrades nearby. Fireteams of three come at an objective
// from different sides; holding a point, a bot takes a post facing the enemy.
import * as THREE from 'three';
import { STANCE } from '../actors/body.js';
import { clamp, gaussRandom, wrapAngle, DEG, G } from '../core/math.js';
import { FLAG_SIGHT, RayHit } from '../physics/collision.js';
import { findRide } from './riderBot.js';
import { findCover, coverHolds, fireteam, callout, grenadeLob, hiddenAt, leavesBetween } from './tactics.js';
import { grenadeOf, startThrow, releasePoint, throwSpeed } from '../game/throwing.js';

const _hit = new RayHit();
const _eye = { x: 0, y: 0, z: 0 };
const _rp = { x: 0, y: 0, z: 0 };
const _v = new THREE.Vector3();
const _lv = { total: 0, dense: 0, hides: false };

export const SKILL = {
  recruit: { reaction: [0.55, 1.0], aim: 1.8, track: 1.4, spot: 0.7, burst: [2, 5] },
  regular: { reaction: [0.35, 0.7], aim: 1.1, track: 2.1, spot: 1, burst: [3, 6] },
  veteran: { reaction: [0.25, 0.5], aim: 0.7, track: 3.0, spot: 1.3, burst: [3, 8] },
};

// The bot difficulty setting (Settings > Gameplay): how many veterans and
// recruits each side has, and how quickly the bots react, how widely their aim
// starts off and wanders, how fast it settles and how soon they spot someone.
export const DIFFICULTY = {
  easy: { veteran: 0, recruit: 0.5, reaction: 1.4, aim: 1.5, track: 0.75, spot: 0.85 },
  normal: { veteran: 0.2, recruit: 0.27, reaction: 1, aim: 1, track: 1, spot: 1 },
  hard: { veteran: 0.35, recruit: 0.1, reaction: 0.85, aim: 0.9, track: 1.05, spot: 1.1 },
};

// How far a bot picks out and takes on a man, by its sights (m): spotting falls
// off sharply past spot, and it opens fire only within fire (further if he is
// shooting at it from there). Iron sights reach about as far as a player can
// make out a man on the screen (some 10 pixels tall at 200 m); scoped rifles and
// machine guns further; submachine guns, pistols and launchers (at men) less.
const RANGES = {
  iron: { spot: 200, fire: 250 },
  scope: { spot: 400, fire: 500 },
  lmg: { spot: 350, fire: 450 },
  smg: { spot: 200, fire: 175 },
  pistol: { spot: 200, fire: 60 },
  revolver: { spot: 200, fire: 60 },
  launcher: { spot: 200, fire: 120 },
};
export function engageRange(def) {
  if (!def) return RANGES.iron;
  return def.scope ? RANGES.scope : RANGES[def.type] || RANGES.iron;
}

// Beyond this range (m) the first shots at a new target go wide (misjudged range
// and wind), by more the further, and close in shot by shot.
const RANGING_FROM = 120;

export class BotBrain {
  // skill: 'recruit', 'regular' or 'veteran', or by default from the difficulty's
  // mix, where rank (0..1) places him in it.
  constructor(game, soldier, { skill = null, rank = Math.random() } = {}) {
    this.game = game;
    this.s = soldier;
    this.level = SKILL[skill] ? skill : null;
    this.rank = rank;
    this.difficulty = null;
    this._updateSkill();
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
    this.cover = null; // where we fight from: { x, y, z, low, high, lean } (tactics.js)
    this.coverT = 0; // next time to look for cover
    this.coverCheckT = 0;
    this.peek = { up: false, until: 0 }; // up: showing ourselves to shoot
    this.boundT = 6 + Math.random() * 8; // moving up: how long to fire from each cover
    this.watch = null; // a post held on an objective, facing the enemy
    this.hunt = null; // where an enemy we lost sight of was: { e, x, y, z, t, go }
    this.heard = null; // a comrade's callout: { x, z, t }
    this.nadeT = 8 + Math.random() * 12; // no grenade before this
    this.throwAt = null; // where a grenade we're throwing should land
    this.treatT = 0; // stopping to treat a wound until then
    this.goalT = 0; // next time to choose which point to fight for
    this.goalOwner = undefined;
    this.engagedAt = 0; // when we picked the current target
    this.bias = { yaw: 0, pitch: 0 }; // first shots far off: misjudged range and wind
    this.shotBy = new Map(); // enemy -> when a bullet of his last hit us or passed close
  }

  // Skill from the level and the difficulty setting (read again whenever it changes).
  _updateSkill() {
    const set = this.game.settings?.get?.('botDifficulty');
    const diff = DIFFICULTY[set] ? set : 'normal';
    if (diff === this.difficulty) return;
    this.difficulty = diff;
    const D = DIFFICULTY[diff];
    const level = this.level || (this.rank < D.veteran ? 'veteran' : this.rank < D.veteran + D.recruit ? 'recruit' : 'regular');
    const k = SKILL[level];
    this.skill = { level, reaction: [k.reaction[0] * D.reaction, k.reaction[1] * D.reaction], aim: k.aim * D.aim, track: k.track * D.track, spot: k.spot * D.spot, burst: k.burst };
  }

  // A bullet of his hit us or cracked past: we know he's about, and may shoot
  // back at him even from beyond our usual range.
  shotAt(e) {
    this.aware.set(e, Math.min(1.2, (this.aware.get(e) || 0) + 0.35));
    this.shotBy.set(e, this.game.time);
  }

  // Carrying a bazooka, Panzerschreck, Panzerfaust or anti-tank rifle.
  get hasAT() {
    const t = this.s.weapon?.def.type;
    return t === 'launcher' || t === 'atRifle';
  }

  // Back from the dead: forget where we were fighting, hiding and looking.
  newLife() {
    this.cover = null;
    this.watch = null;
    this.hunt = null;
    this.heard = null;
    this.ride = null;
    this.throwAt = null;
    this.treatT = 0;
    this.peek.up = false;
    this.peek.until = 0;
    this.lastSeen.clear();
    this.shotBy.clear();
    this.coverT = 0;
    this.stuckT = 0;
    this.unstickT = 0;
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
      this._updateSkill();
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
    const range = engageRange(s.weapon?.def);
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
      let leafy = false; // in sight but for thick leaves
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
        // Leaves in the way: a thick bush or hedge hides a man (unless he's a few
        // meters off); thinner foliage is partial cover, the thicker the longer it
        // takes to pick someone out, and a muzzle flash shows through.
        if (visible) {
          const lv = leavesBetween(coll, _eye.x, _eye.y, _eye.z, ti.x, ty, ti.z, _lv);
          if (lv.hides && !veh) {
            visible = false;
            leafy = true;
          } else if (lv.total > 0) cover = Math.max(Math.exp(-lv.total / 0.9), firing ? 0.5 : 0.08);
        }
      }
      if (visible && (inView || heard)) {
        // How fast we notice: close, moving, standing, shooting people stand out; vehicles more so.
        const stance = e.isVehicle ? 2 : e.body.stance === STANCE.PRONE ? 0.3 : e.body.stance === STANCE.CROUCH ? 0.65 : 1;
        const moving = (e.isVehicle ? Math.abs(e.speed) > 1 : e.body.moving > 1) ? 1.6 : 1;
        // Past what our sights pick out (iron sights: about 200 m), a man is a few
        // pixels on a player's screen: hard to make out, soon not at all.
        const far = e.isVehicle || d <= range.spot ? 1 : Math.exp(-(((d - range.spot) / 50) ** 2));
        const rate = ((this.skill.spot * 2.6 * stance * moving * (firing ? 3 : 1)) / (1 + d / 70)) * cover * far;
        a = Math.min(1.5, a + rate * dt * (inView ? 1 : 0.5));
        this.lastSeen.set(e, { x: ti.x, y: ti.y, z: ti.z, t: this.game.time, visible: true });
      } else {
        a = Math.max(0, a - dt * 0.25);
        const ls = this.lastSeen.get(e);
        if (ls) ls.visible = false;
        // Firing from inside or behind thick leaves: the flash and the report give
        // away about where he is (the further, the rougher), not where he goes after.
        if (leafy && firing && (inView || heard) && e.lastShotTime !== ls?.shotT) {
          const err = 0.5 + d * 0.04;
          this.lastSeen.set(e, { x: ti.x + gaussRandom(0, err), y: ti.y, z: ti.z + gaussRandom(0, err), t: this.game.time, visible: false, guess: true, shotT: e.lastShotTime });
          a = Math.min(1.5, a + 0.5);
        }
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
    const ducked = this.cover && this._atCover();
    const now = this.game.time;
    for (const [e, a] of this.aware) {
      if (!e.alive || a < 1) continue;
      const ls = this.lastSeen.get(e);
      // Only a rough idea where he is (he fired from thick leaves): we may shoot back there.
      const guess = !ls?.visible && ls?.guess && now - ls.t < 3;
      // (Ducked behind cover we can't see him, but we know he's there.)
      if (!ls?.visible && !guess && !(ducked && e === this.target && now - (ls?.t ?? -99) < 4)) continue;
      const ti = this._where(e, _ti);
      const d = Math.hypot(ti.x - b.x, ti.z - b.z);
      // With an anti-tank weapon, vehicles in range come first; without, only men.
      if (e.isVehicle && (!at || d > 220)) continue;
      // A man too far for our sights, unless he's shooting at us from there (and
      // not hopelessly far).
      if (!e.isVehicle && d > range.fire * (e === this.target ? 1.1 : 1) && !(now - (this.shotBy.get(e) ?? -99) < 10 && d < range.fire * 1.5)) continue;
      const score = -d + (e.isVehicle ? 400 : 0) + (now - (e.lastShotTime ?? -99) < 2 ? 40 : 0) + (e === this.target ? 25 : 0) - (guess ? 60 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best !== this.target) {
      const prev = this.target;
      this.target = best;
      if (best) {
        const ti = this._where(best, _ti);
        this._engage(Math.hypot(ti.x - b.x, ti.z - b.z));
        this.hunt = null;
        this.engagedAt = this.game.time;
        if (!best.isVehicle) callout(this.game, s, best, 60, this.lastSeen.get(best));
      } else if (prev?.alive && !prev.isVehicle) {
        // Lost sight of him: remember where he was.
        const ls = this.lastSeen.get(prev);
        if (ls) this.hunt = { e: prev, x: ls.x, y: ls.y, z: ls.z, t: this.game.time, go: false };
      }
    }
    for (const [e] of this.aware) if (!e.alive) this.aware.delete(e);
  }

  // A new target d m off: a moment to react; the aim starts off by more the
  // further he is (finding him in the sights); and far off, the range and the
  // wind are misjudged (by a meter or so at 300 m, less for the skilled), so the
  // first shots go wide and close in as we see where they strike.
  _engage(d) {
    const r = this.skill.reaction;
    this.reactT = r[0] + Math.random() * (r[1] - r[0]);
    const e0 = this.skill.aim * (0.6 + d / 120) * DEG;
    this.err.yaw = gaussRandom(0, e0 * 2.2);
    this.err.pitch = gaussRandom(0, e0 * 1.6);
    const far = (Math.max(0, d - RANGING_FROM) * 0.006 * this.skill.aim) / Math.max(d, 1);
    this.bias.yaw = gaussRandom(0, far * 0.6);
    this.bias.pitch = gaussRandom(0, far);
  }

  // Where we take an enemy to be: where he is while we can see him; otherwise
  // where we last saw him (or our guess of where he fired from), standing still.
  _where(e, out) {
    tinfo(e, out);
    const ls = e.isVehicle ? null : this.lastSeen.get(e);
    if (ls && !ls.visible) {
      out.x = ls.x;
      out.y = ls.y;
      out.z = ls.z;
      out.vx = out.vy = out.vz = 0;
    }
    return out;
  }

  // --- deciding where to go ----------------------------------------------------
  _decide() {
    const s = this.s;
    const b = s.body;
    const g = this.game;
    const mode = g.mode;
    // Which point to fight for: chosen afresh now and then, or when it changes
    // hands (asking every moment, the choice would flicker between two points and
    // every new choice throws the route away).
    const gp = this.goal && mode.byId?.[this.goal.id];
    if (!this.goal || g.time > this.goalT || (gp && gp.owner !== this.goalOwner)) {
      const goal = mode.botGoal?.(this) || null;
      this.goalT = g.time + 12 + Math.random() * 10;
      if (goal && (!this.goal || goal.id !== this.goal.id)) {
        this.goal = goal;
        this.path = null;
        this.wander = null;
        this.watch = null;
      }
      this.goalOwner = this.goal ? mode.byId?.[this.goal.id]?.owner : undefined;
    }
    // A long way to go: take a bicycle or motorcycle if there's one at hand.
    if (!this.target && this.goal && !s.vehicle && !this.ride) this.ride = findRide(this);
    this._treat();
    // Reload behind whatever cover we have when there's a lull, or ducked down in it.
    const w = s.weapon;
    const ducked = this.cover && this._atCover() && !this.peek.up;
    if (w && w.state === 'ready' && !s.throwing) {
      if (w.loaded === 0 && w.canReload()) w.startReload();
      else if ((!this.target || ducked) && w.loaded < w.def.capacity * (ducked ? 0.6 : 0.4) && w.canReload() && g.time - (s.lastShotTime ?? -99) > (ducked ? 0.5 : 2)) w.startReload();
    }
    this._grenade();
    if (this.target) {
      this._fight();
      return;
    }
    // Lost sight of an enemy: watch where he was, then (attacking) go and look.
    if (this.hunt && this._hunt()) return;
    // A comrade called out an enemy: look that way for a moment.
    if (this.heard && g.time - this.heard.t < 3) this.lookYaw = Math.atan2(-(this.heard.x - b.x), -(this.heard.z - b.z));
    this.cover = null;
    if (!this.goal) {
      if (b.targetStance !== STANCE.STAND) b.setStance(STANCE.STAND);
      return;
    }
    if (this._inGoal()) {
      this._hold();
      return;
    }
    this.watch = null;
    if (b.targetStance !== STANCE.STAND) b.setStance(STANCE.STAND);
    if (!this.path || g.time > this.pathT) this._approach();
  }

  // Fighting a target: from cover if there's any near, popping up (or leaning
  // out) to shoot and ducking back down; in the open, low. Moving up on an
  // objective, fire and move: shoot from cover a while, then dash to cover
  // further forward (one of a fireteam at a time); an enemy far off doesn't
  // stop the advance.
  _fight() {
    const g = this.game;
    const s = this.s;
    const b = s.body;
    const t = this.target;
    const w = s.weapon;
    const ti = this._where(t, _ti);
    const d = Math.hypot(ti.x - b.x, ti.z - b.z);
    const pushing = !!this.goal && !this._inGoal();
    const threat = { x: ti.x, y: ti.y + ti.h * 0.92, z: ti.z };
    if (!t.isVehicle && d < (pushing ? 90 : 300)) {
      // A post we were holding is our cover, if it hides us from him.
      if (!this.cover && this.watch && !this.watch.open && Math.hypot(this.watch.x - b.x, this.watch.z - b.z) < 1.5 && coverHolds(g, this.watch, threat)) this.cover = this.watch;
      // Still good, now that he may have moved?
      if (this.cover && g.time > this.coverCheckT) {
        this.coverCheckT = g.time + 1.5 + Math.random();
        if (!coverHolds(g, this.cover, threat)) {
          this.cover = null;
          this.coverT = 0;
        }
      }
      if (!this.cover && g.time > this.coverT && d > 7) {
        this.coverT = g.time + 2 + Math.random() * 1.5;
        const spot = findCover(g, s, threat, { radius: d < 30 ? 9 : 15, taken: this._taken() });
        if (spot) this._takeCover(spot);
      }
    } else if (this.cover && pushing && !this._atCover()) this.cover = null;
    if (this.cover && this._atCover()) {
      const p = this.peek;
      const sup = s.suppression || 0;
      this.cover.since ??= g.time;
      // Moving up: after a while here, on to cover further forward (or along
      // the way if there's none), unless pinned down or a mate is on the move.
      if (pushing && g.time - this.cover.since > this.boundT && sup < 0.5 && !this._mateMoving()) {
        this.boundT = 6 + Math.random() * 8;
        const spot = t.isVehicle ? null : findCover(g, s, threat, { radius: 18, toward: this.goal, taken: this._taken() });
        if (spot) this._takeCover(spot);
        else {
          this.cover = null;
          this.coverT = g.time + 4 + Math.random() * 3;
          this._approach();
        }
        if (b.targetStance !== STANCE.STAND) b.setStance(STANCE.STAND);
        return;
      }
      if (g.time > p.until) {
        p.up = !p.up;
        p.until = g.time + (p.up ? 1.5 + Math.random() * 2 - sup : 0.8 + Math.random() * 1.2 + sup * 2.5);
        // Coming up, it takes a moment to find him in the sights again.
        if (p.up) this.reactT = Math.max(this.reactT, 0.15 + Math.random() * 0.2);
      }
      // Heavy fire, a reload or a bandage: stay down.
      if (sup > 0.75 || (w && w.state === 'reloading') || s.action) p.up = false;
      b.setStance(p.up ? this.cover.high : this.cover.low);
      return;
    }
    if (this.cover) {
      // Running for it.
      if (b.targetStance !== STANCE.STAND) b.setStance(STANCE.STAND);
      return;
    }
    // Moving up with no cover to make for: on along the way.
    if (pushing && (!this.path || this.pathI >= this.path.length || g.time > this.pathT)) this._approach();
    // No cover at hand: crouch or lie down where we are, flat under heavy fire.
    const lmg = w?.def.type === 'lmg' || w?.def.proneOrBipodOnly;
    let want = (lmg && d > 40) || (d > 140 && Math.random() < 0.5) ? STANCE.PRONE : d > 25 ? STANCE.CROUCH : STANCE.STAND;
    if ((s.suppression || 0) > 0.6 && d > 15) want = STANCE.PRONE;
    if (b.targetStance !== want && Math.random() < 0.5) b.setStance(want);
  }

  // Where we lost sight of an enemy: watch the spot for a few seconds; then,
  // attacking (or with no point to hold), go there (crouched, close in) to find him.
  // True while it's what we're doing.
  _hunt() {
    const g = this.game;
    const s = this.s;
    const b = s.body;
    const h = this.hunt;
    const age = g.time - h.t;
    if (!h.e.alive || age > 25 || (h.go && Math.hypot(h.x - b.x, h.z - b.z) < 3)) {
      this.hunt = null;
      return false;
    }
    this.lookYaw = Math.atan2(-(h.x - b.x), -(h.z - b.z));
    this.lookPitch = 0;
    if (this.cover && this._atCover()) b.setStance(this.cover.high);
    if (age < 4) return true;
    const attacking = g.mode?.attacking?.(s.team) || !this.goal;
    if (!attacking) {
      this.hunt = null;
      return false;
    }
    if (!h.go) {
      h.go = true;
      this.cover = null;
      this._plan(h.x, h.z);
    }
    if (b.targetStance !== STANCE.CROUCH && Math.hypot(h.x - b.x, h.z - b.z) < 25) b.setStance(STANCE.CROUCH);
    return true;
  }

  // On the objective with nobody to shoot: take a post in cover facing the way
  // the enemy will come, and watch from it (a spot in the open if there's none).
  _hold() {
    const g = this.game;
    const s = this.s;
    const b = s.body;
    const goal = this.goal;
    if (!this.watch || g.time > this.watch.until) {
      const dir = this._frontDir();
      const front = { x: b.x + dir.x * 70, y: b.y + 1.6, z: b.z + dir.z * 70 };
      const spot = findCover(g, s, front, { radius: Math.min(14, goal.radius * 0.8), tries: 6, taken: this._taken() });
      const yaw = Math.atan2(-dir.x, -dir.z);
      if (spot && Math.hypot(spot.x - goal.x, spot.z - goal.z) < goal.radius * 0.85) this.watch = { ...spot, yaw, until: g.time + 25 + Math.random() * 30 };
      else {
        const a = Math.random() * Math.PI * 2,
          rr = Math.sqrt(Math.random()) * goal.radius * 0.7;
        this.watch = { x: goal.x + Math.cos(a) * rr, y: b.y, z: goal.z + Math.sin(a) * rr, low: STANCE.CROUCH, high: STANCE.CROUCH, lean: 0, yaw, open: true, until: g.time + 6 + Math.random() * 10 };
      }
      this._plan(this.watch.x, this.watch.z);
    }
    const wt = this.watch;
    if (Math.hypot(wt.x - b.x, wt.z - b.z) < 1.2) {
      // Look out over the ground in front, now a little this way, now that.
      this.lookYaw = wt.yaw + Math.sin(g.time * 0.35 + s.id) * 0.5;
      if (b.targetStance !== wt.high) b.setStance(wt.high);
    } else if (b.targetStance !== STANCE.STAND && Math.random() < 0.3) b.setStance(STANCE.STAND);
  }

  // The way to the enemy: toward the middle of their side.
  _frontDir() {
    let x = 0,
      z = 0,
      n = 0;
    for (const o of this.game.soldiers)
      if (o.alive && o.team !== this.s.team) {
        x += o.body.x;
        z += o.body.z;
        n++;
      }
    const b = this.s.body;
    if (!n) return { x: -Math.sin(this.s.yaw), z: -Math.cos(this.s.yaw) };
    const dx = x / n - b.x,
      dz = z / n - b.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: dx / d, z: dz / d };
  }

  // Off to the objective. Attacking, each fireteam comes at it from its own
  // side (left, straight in or right) until it's close.
  _approach() {
    const g = this.game;
    const s = this.s;
    const b = s.body;
    const goal = this.goal;
    const d = Math.hypot(goal.x - b.x, goal.z - b.z) || 1;
    const a = Math.random() * Math.PI * 2,
      rr = Math.sqrt(Math.random()) * goal.radius * 0.6;
    let tx = goal.x + Math.cos(a) * rr,
      tz = goal.z + Math.sin(a) * rr;
    const side = fireteam(g, s).side;
    if (side && g.mode?.attacking?.(s.team) && d > goal.radius + 70) {
      const ux = (goal.x - b.x) / d,
        uz = (goal.z - b.z) / d;
      const off = goal.radius + 35;
      tx = goal.x - ux * goal.radius - uz * side * off;
      tz = goal.z - uz * goal.radius + ux * side * off;
    }
    this._plan(tx, tz);
  }

  _takeCover(spot) {
    const g = this.game;
    const b = this.s.body;
    this.cover = spot;
    this.peek.up = false;
    this.peek.until = 0;
    if (g.nav?.lineWalkable(b.x, b.z, spot.x, spot.z) ?? true) {
      this.path = [{ x: spot.x, z: spot.z }];
      this.pathI = 0;
      this.pathT = g.time + 8;
    } else this._plan(spot.x, spot.z);
  }

  // A fireteam mate close by running to cover (we hold and cover him).
  _mateMoving() {
    const b = this.s.body;
    for (const o of fireteam(this.game, this.s).mates) {
      const br = o.brain;
      if (o === this.s || !o.alive || !br?.cover || br._atCover()) continue;
      if (Math.hypot(o.body.x - b.x, o.body.z - b.z) < 50) return true;
    }
    return false;
  }

  // Cover and posts comrades close by are using.
  _taken() {
    const out = [];
    const b = this.s.body;
    for (const o of this.game.soldiers) {
      const br = o.brain;
      if (o === this.s || !br || !o.alive || o.team !== this.s.team) continue;
      for (const c of [br.cover, br.watch]) if (c && Math.hypot(c.x - b.x, c.z - b.z) < 30) out.push(c);
    }
    return out;
  }

  _atCover() {
    const c = this.cover;
    return !!c && Math.hypot(c.x - this.s.body.x, c.z - this.s.body.z) < 1.0;
  }

  // Bleeding, or badly hurt in a lull: bandage or first aid (keeping still),
  // from behind cover if the fight is still on, or lying flat if the enemy is
  // well off; bleeding out fast, whatever the risk.
  _treat() {
    const s = this.s;
    if (s.action || s.vehicle || s.throwing) return;
    const b = s.body;
    const t = this.target;
    const seen = t && this.lastSeen.get(t)?.visible;
    const ducked = this.cover && this._atCover() && !this.peek.up;
    if (s.bleed > 0) {
      const ti = t ? this._where(t, _ti) : null;
      const d = ti ? Math.hypot(ti.x - b.x, ti.z - b.z) : Infinity;
      const urgent = s.health < 40 || s.bleed * 25 > s.health; // dead within ~25 s
      if (!seen || ducked || (urgent && d > 40) || s.health < 20) {
        if (seen && !ducked && d > 40 && b.targetStance !== STANCE.PRONE) b.setStance(STANCE.PRONE);
        this._startTreat();
      }
    } else if (s.health < 45 && !t && this.game.time - s.lastHitTime > 4) this._startTreat();
  }

  // Stop, then treat (on the move it would be interrupted at once).
  _startTreat() {
    if (this.s.body.moving < 0.6) {
      this.treatT = 0;
      this.s.startBandage();
    } else this.treatT = this.game.time + 0.8;
  }

  // An enemy 9 to 28 m away who has gone to ground (seen in the last few
  // seconds), or who we've been trading shots with for a while behind cover,
  // with no comrade near him: lob a grenade at him.
  _grenade() {
    const g = this.game;
    const s = this.s;
    const b = s.body;
    if (g.time < this.nadeT || s.vehicle || s.action || s.throwing) return;
    const w = grenadeOf(s);
    if (!w) return;
    b.eyePosition(_eye);
    for (const [e, a] of this.aware) {
      if (!e.alive || e.isVehicle || e.vehicle || a < 0.8) continue;
      const ls = this.lastSeen.get(e);
      if (!ls || g.time - ls.t > 6) continue;
      // In sight: only one we've been fighting a while who keeps low behind something.
      if (ls.visible && !(e === this.target && g.time - this.engagedAt > 5 && hiddenAt(g.world.collision, _eye, e.body.x, e.body.y, e.body.z, STANCE.CROUCH))) continue;
      const d = Math.hypot(ls.x - b.x, ls.z - b.z);
      if (d < 9 || d > 28) continue;
      if (g.soldiers.some((o) => o.alive && o.team === s.team && Math.hypot(o.body.x - ls.x, o.body.z - ls.z) < 8)) continue;
      // A lob that drops in there, a little short for the roll (too far from
      // where we lie: don't).
      const roll = Math.min(1.5, d * 0.06) / d;
      const spot = { x: ls.x - (ls.x - b.x) * roll, y: ls.y, z: ls.z - (ls.z - b.z) * roll };
      const v = throwSpeed(s, w);
      const angle = 0.55 + Math.random() * 0.25;
      const lob = grenadeLob(releasePoint(s, _rp), spot, v, angle);
      if (!lob) continue;
      this.nadeT = g.time + 18 + Math.random() * 14;
      this.throwAt = spot;
      // Cook it so he has no time to throw it back or run (not too long: we're exposed).
      const cook = clamp(w.ammo.fuseTime - lob.t - 0.9 - Math.random() * 0.8, 0, 1.2);
      // Off by a metre or two, more for the less skilled and the further.
      const err = (0.5 + d * 0.05) * this.skill.aim * 0.7;
      startThrow(s, w, {
        cook,
        aim: (t) => {
          const p = releasePoint(t, { x: 0, y: 0, z: 0 });
          const l = grenadeLob(p, { x: spot.x + gaussRandom(0, err), y: spot.y, z: spot.z + gaussRandom(0, err) }, v, angle) || lob;
          return { x: p.x, y: p.y, z: p.z, vx: l.vx, vy: l.vy, vz: l.vz };
        },
      });
      return;
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
    it.leanL = it.leanR = false;
    // Treating a wound (moving would undo it), about to, or throwing a grenade: keep still.
    if (s.action || this.game.time < this.treatT || (s.throwing && s.throwing.phase !== 'follow')) return;
    // Up behind a corner (fighting or watching): lean out past it.
    const post = this.cover && this._atCover() ? (this.target ? (this.peek.up ? this.cover : null) : this.cover) : this.watch && !this.target && Math.hypot(this.watch.x - b.x, this.watch.z - b.z) < 1.2 ? this.watch : null;
    if (post?.lean > 0) it.leanR = true;
    else if (post?.lean < 0) it.leanL = true;
    let wx = 0,
      wz = 0;
    const engaging = this.target && this.reactT <= 0;
    const toCover = this.cover && !this._atCover();
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
    // The last metre or two to a cover spot or a post: straight onto it (the
    // path counts as done a little short).
    const spot = toCover ? this.cover : !this.target && this.watch ? this.watch : null;
    if (spot && (!this.path || this.pathI >= this.path.length)) {
      const dx = spot.x - b.x,
        dz = spot.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.35 && d < 4) {
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
    // While shooting: stop (rifles) or creep, sidestepping now and then (not
    // on the way to cover, nor in it).
    let speed = 1;
    if (engaging && this.cover) {
      if (!toCover) speed = 0;
      this.strafe = 0;
    } else if (engaging) {
      const auto = s.weapon && (s.weapon.mode === 'auto' || s.weapon.mode === 'slow');
      const ti = this._where(this.target, _ti);
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
    const coverRun = toCover && Math.hypot(this.cover.x - b.x, this.cover.z - b.z) > 3;
    it.sprint = ((!this.target && farToGo && !this.hunt) || coverRun) && fwd > 0.7 && b.stamina > 20 && !b.staminaLock;
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
    if (s.throwing && this.throwAt) {
      // Throwing: face where it should land.
      wantYaw = Math.atan2(-(this.throwAt.x - b.x), -(this.throwAt.z - b.z));
      wantPitch = 0.25;
      s.aiming = false;
    } else if (t && t.alive) {
      if (this.reactT > 0) this.reactT -= dt;
      b.eyePosition(_eye);
      // (Out of sight: at where we last saw him, or think he fired from.)
      const ti = this._where(t, _ti);
      const ls = this.lastSeen.get(t);
      const blind = !!ls?.guess && !ls.visible;
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
      // (US sights are graduated in yards.)
      const zero = w ? w.zeroRange * (w.sight.unit === 'yd' ? 0.9144 : 1) : 100;
      const drop = (a) => 0.5 * G * (a / (mv * 0.88)) ** 2;
      const hold = Math.max(-0.02, (drop(hd) - (drop(zero) * hd) / Math.max(zero, 1)) / Math.max(hd, 1));
      wantPitch = Math.atan2(dy, hd) + hold;
      // Human aiming error: wanders, shrinks the longer we track, grows when we move.
      const e = this.err;
      const steady = (b.stance === STANCE.PRONE ? 0.45 : b.stance === STANCE.CROUCH ? 0.7 : 1) * (b.moving > 0.5 ? 2.2 : 1) * (1 + (s.suppression || 0)) * (blind ? 3 : 1);
      const target = this.skill.aim * DEG * 0.18 * steady * (1 + d / 250);
      e.vy += (gaussRandom() * target * 6 - e.yaw * this.skill.track * 3 - e.vy * 3) * dt;
      e.vp += (gaussRandom() * target * 6 - e.pitch * this.skill.track * 3 - e.vp * 3) * dt;
      e.yaw += e.vy * dt;
      e.pitch += e.vp * dt;
      wantYaw += e.yaw + this.bias.yaw;
      wantPitch += e.pitch + this.bias.pitch;
      // Fire once the sights settle on the target (its angular size).
      const size = ti.size / Math.max(d, 1);
      const off = Math.hypot(e.yaw, e.pitch);
      this.holdFire -= dt;
      if (this.reactT <= 0 && off < size * 1.6 + 0.004 && this.holdFire <= 0 && w && w.state === 'ready' && w.loaded > 0) {
        // Not ducked behind cover, nor on the run to it (unless close with an automatic).
        const autoW = w.mode === 'auto' || w.mode === 'slow';
        const ducked = this.cover && this._atCover() && !this.peek.up;
        const running = this.cover && !this._atCover() && !(autoW && d < 25);
        if (!ducked && !running && !this._friendlyInLine(ti, d)) pull = true;
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
          const ti = this._where(t, _ti);
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
        // Firing blind at where he fired from: now and then, not a steady stream.
        if (t && !this.lastSeen.get(t)?.visible && this.lastSeen.get(t)?.guess) this.holdFire = Math.max(this.holdFire, 0.8 + Math.random() * 1.2);
        // Seeing where the shot went, the next is laid closer.
        this.bias.yaw *= 0.5;
        this.bias.pitch *= 0.5;
        // Recoil throws the aim off; it's pulled back over the next moments.
        this.err.vp += 0.06 + Math.random() * 0.04;
        this.err.vy += gaussRandom(0, 0.03);
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
