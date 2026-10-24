// Physical movement of a soldier: walking, running, sprinting, crouching, going
// prone, jumping, leaning, slopes, stairs, falling, and stamina. Used by both the
// player and the bots, so everyone moves by the same rules.
//
// Speeds are based on real infantry: about 1.5 m/s walking, 3.7 m/s jogging with
// kit, 6 m/s sprinting, slower when carrying heavy weapons. Moving sideways or
// backwards is slower (70%), people can't sprint uphill as fast, and turning a
// heavy machine gun while lying down takes room.
import { clamp, damp, approach, G } from '../core/math.js';
import { FLAG_SOLID } from '../physics/collision.js';

export const STANCE = { STAND: 0, CROUCH: 1, PRONE: 2 };

// Eye height, body collision spheres (height of center, radius) per stance.
const STANCE_INFO = [
  { eye: 1.64, height: 1.78, spheres: [0.55, 1.05, 1.48], radius: 0.28 },
  { eye: 1.08, height: 1.22, spheres: [0.55, 0.92], radius: 0.28 },
  { eye: 0.32, height: 0.45, spheres: [], radius: 0.24 }, // prone uses spheres along the body
];

const SPEED = {
  walk: 1.5,
  run: 3.7,
  sprint: 6.1,
  crouchWalk: 0.9,
  crouchRun: 2.1,
  prone: 0.55,
  proneFast: 0.85,
};

const STEP_HEIGHT = 0.45;
const MAX_SLOPE = (46 * Math.PI) / 180; // steeper than this, you slide (H&G used ~49 degrees)
const JUMP_SPEED = 3.3; // m/s up: about a 0.5 m jump with gear
const SAFE_FALL_SPEED = 8; // m/s (~3.3 m drop) before fall damage starts
// Stamina: three times as much as a plain reading of a loaded soldier's sprint
// gives (a full bar lasts about 27 s of sprinting with a normal load), and it
// comes back twice as fast (an empty bar refills in about 4 s standing still).
export const STAMINA_POOL = 3;
export const STAMINA_REGEN = 2;

export class Body {
  constructor(world, x, y, z) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = 0;
    this.onGround = false;
    this.groundY = y;
    this.groundSurface = 0;
    this.stance = STANCE.STAND;
    this.targetStance = STANCE.STAND;
    this.stanceT = 1; // 0..1 progress of the current stance transition
    this.stanceFrom = STANCE.STAND;
    this.eye = STANCE_INFO[0].eye; // current eye height (smoothly changes)
    this.lean = 0; // -1 left .. 1 right
    this.leanTarget = 0;
    this.stamina = 100;
    this.staminaLock = false; // exhausted: can't sprint until recovered
    this.staminaDelay = 0;
    this.breath = 0; // 0 calm .. 1 out of breath (drives weapon sway and breathing sound)
    this.load = 20; // kg carried (kit + weapon + ammo)
    this.moving = 0; // current horizontal speed
    this.sprinting = false;
    this.landImpact = 0; // for camera dip
    this.fallDamage = 0; // set when landing hard; consumed by the soldier
    this.stepDistance = 0; // accumulates for footstep sounds
    this.stepEvent = false;
    this.legWound = 0; // 0..1 from leg hits: slows and stops sprinting
    this.inWater = 0; // water depth at the feet
    this.swimming = false;
    this.airTime = 0;
    this.maxFallSpeed = 0;
    this._tmp = { x: 0, y: 0, z: 0, floorY: -1, hit: false };
    this._list = [];
  }

  get stanceInfo() {
    return STANCE_INFO[this.stance];
  }

  // Stance changes take time; going prone or getting up needs room.
  setStance(s) {
    if (s === this.targetStance) return;
    if (s < this.stance && !this._roomFor(s)) return; // can't stand up under a table
    this.stanceFrom = this.stance;
    this.targetStance = s;
    this.stanceT = 0;
  }

  _stanceDuration(from, to) {
    if (from === STANCE.PRONE || to === STANCE.PRONE) return from === STANCE.STAND || to === STANCE.STAND ? 1.0 : 0.75;
    return 0.32;
  }

  _roomFor(stance) {
    // Would the head fit at the new stance's height?
    const info = STANCE_INFO[stance];
    const r = 0.26;
    const p = { x: this.x, y: this.y + info.height - r, z: this.z };
    const out = { x: 0, y: 0, z: 0, floorY: -1, hit: false };
    this.world.resolveSphere(p, r, out, FLAG_SOLID);
    return !out.hit;
  }

  // Main update. intent: { mx, mz (local move -1..1), sprint, walk, jump, crouch, prone, leanL, leanR, yaw }
  update(dt, intent) {
    const hf = this.world.hf;
    this.yaw = intent.yaw;

    // --- Stance transitions ---------------------------------------------------
    if (this.stanceT < 1) {
      this.stanceT = Math.min(1, this.stanceT + dt / this._stanceDuration(this.stanceFrom, this.targetStance));
      if (this.stanceT >= 1) this.stance = this.targetStance;
      else if (this.stanceT > 0.5) this.stance = this.targetStance;
    }
    const eyeTarget = STANCE_INFO[this.targetStance].eye;
    const transitioning = this.stanceT < 1;
    this.eye = damp(this.eye, eyeTarget, transitioning ? 7 : 14, dt);

    // --- Desired horizontal velocity --------------------------------------------
    let mx = intent.mx,
      mz = intent.mz;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) {
      mx /= ml;
      mz /= ml;
    }
    const forwardAmount = Math.max(0, -mz); // moving forward (local -z)
    const wantsSprint = intent.sprint && forwardAmount > 0.5 && this.stance === STANCE.STAND && !this.staminaLock && this.legWound < 0.5 && !transitioning && !intent.aiming;
    this.sprinting = wantsSprint && this.onGround;

    let speed;
    if (this.stance === STANCE.PRONE || (transitioning && this.targetStance === STANCE.PRONE)) speed = intent.walk ? SPEED.prone : SPEED.proneFast;
    else if (this.stance === STANCE.CROUCH) speed = intent.walk ? SPEED.crouchWalk : SPEED.crouchRun;
    else if (this.sprinting) speed = SPEED.sprint;
    else speed = intent.walk ? SPEED.walk : SPEED.run;
    if (transitioning) speed *= 0.5;
    if (intent.aiming && !this.sprinting) speed *= this.stance === STANCE.STAND ? 0.6 : 0.75;

    // Heavy loads slow you down (each kg over 20 costs about 1%).
    speed *= clamp(1 - (this.load - 20) * 0.01, 0.7, 1.05);
    // Leg wounds slow you down.
    speed *= 1 - this.legWound * 0.45;
    // Wading through water.
    if (this.inWater > 0.3) speed *= clamp(1 - this.inWater * 0.45, 0.35, 1);
    // Sideways and backwards movement is slower.
    const sideBack = Math.abs(mx) * 0.3 + Math.max(0, mz) * 0.3;
    speed *= 1 - Math.min(0.3, sideBack);

    // Slope: uphill is slower, steep downhill a bit faster.
    const sin = Math.sin(this.yaw),
      cos = Math.cos(this.yaw);
    // Local (mx, mz) -> world. Forward is -z in local space.
    let wx = mx * cos + mz * sin;
    let wz = -mx * sin + mz * cos;
    const n = this._normal || (this._normal = { x: 0, y: 1, z: 0 });
    if (this.onGround && this.groundOnTerrain) {
      hf.getNormal(this.x, this.z, n);
      const uphill = -(wx * n.x + wz * n.z); // > 0 when moving up the slope
      speed *= clamp(1 - uphill * 1.1, 0.45, 1.15);
    }
    const tx = wx * speed,
      tz = wz * speed;

    // --- Acceleration ----------------------------------------------------------
    const accel = this.onGround ? (ml > 0.05 ? (this.stance === STANCE.PRONE ? 6 : 11) : 14) : 1.5;
    this.vx = approach(this.vx, tx, accel * dt);
    this.vz = approach(this.vz, tz, accel * dt);

    // --- Jumping and gravity ------------------------------------------------------
    if (intent.jump && this.onGround && this.stance === STANCE.STAND && !transitioning && this.stamina > 8 && this.inWater < 1.0) {
      this.vy = JUMP_SPEED * (this.legWound > 0.5 ? 0.6 : 1);
      this.onGround = false;
      this.stamina -= 8 / STAMINA_POOL;
      this.staminaDelay = 1;
      this.jumped = true;
    }
    if (!this.onGround) {
      this.vy -= G * dt;
      this.airTime += dt;
      if (-this.vy > this.maxFallSpeed) this.maxFallSpeed = -this.vy;
    }

    // --- Move and collide ---------------------------------------------------------
    const prevX = this.x,
      prevZ = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y += this.vy * dt;

    // Ground probe first, so small steps and stairs are climbed instead of blocking.
    const wasOnGround = this.onGround;
    const ground = this._findGround(this.x, this.y + STEP_HEIGHT, this.z, STEP_HEIGHT + (wasOnGround ? 0.45 : 0.05) + Math.max(0, -this.vy * dt));
    if (ground !== null && this.vy <= 0.01 && this.y <= ground + 0.05 + (wasOnGround ? 0.45 : 0)) {
      // Landed or walking along the ground.
      if (!wasOnGround) this._land();
      this.y = ground;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this._resolveCollisions();

    // Too steep: slide down instead of standing.
    if (this.onGround && this.groundOnTerrain) {
      hf.getNormal(this.x, this.z, n);
      const slope = Math.acos(Math.min(1, n.y));
      if (slope > MAX_SLOPE) {
        const k = (slope - MAX_SLOPE) * 12 * dt;
        this.vx += n.x * k * 9;
        this.vz += n.z * k * 9;
      }
    }

    // Keep inside the map.
    const lim = hf.half - 30;
    this.x = clamp(this.x, -lim, lim);
    this.z = clamp(this.z, -lim, lim);

    // --- Bookkeeping ---------------------------------------------------------------
    const mdx = this.x - prevX,
      mdz = this.z - prevZ;
    const moved = Math.hypot(mdx, mdz);
    this.moving = moved / dt;
    this.stepEvent = false;
    if (this.onGround) {
      this.stepDistance += moved;
      const stride = this.stance === STANCE.PRONE ? 0.9 : this.sprinting ? 1.7 : 1.25;
      if (this.stepDistance > stride) {
        this.stepDistance -= stride;
        this.stepEvent = true;
      }
    }

    // Lean (only standing or crouched, and only if the head has room).
    this.leanTarget = this.stance === STANCE.PRONE || this.sprinting ? 0 : (intent.leanR ? 1 : 0) - (intent.leanL ? 1 : 0);
    this.lean = damp(this.lean, this.leanTarget, 9, dt);

    this._updateStamina(dt);
    this._updateWater();
  }

  _updateStamina(dt) {
    // Sprinting burns stamina, more with heavy loads; resting restores it.
    // (Stamina is a percentage: STAMINA_POOL times more of it lasts that much
    // longer, STAMINA_REGEN refills the bar that much faster.)
    const loadFactor = clamp(this.load / 20, 0.8, 2);
    if (this.sprinting) {
      this.stamina -= (11 * loadFactor * dt) / STAMINA_POOL;
      this.staminaDelay = 0.8;
      this.breath = Math.min(1, this.breath + 0.12 * dt * loadFactor);
    } else if (this.staminaDelay > 0) {
      this.staminaDelay -= dt;
    } else {
      const rest = this.moving < 0.2 ? 14 : this.moving < 2 ? 9 : 5;
      const stanceBonus = this.stance === STANCE.PRONE ? 1.3 : this.stance === STANCE.CROUCH ? 1.15 : 1;
      this.stamina += rest * stanceBonus * STAMINA_REGEN * dt;
    }
    // Breathing settles more slowly than stamina recovers.
    const exertion = 1 - this.stamina / 100;
    this.breath = damp(this.breath, exertion, this.sprinting ? 0.6 : 0.35, dt);
    this.stamina = clamp(this.stamina, 0, 100);
    if (this.stamina <= 1) this.staminaLock = true;
    if (this.staminaLock && this.stamina > 30) this.staminaLock = false;
  }

  _updateWater() {
    const wl = this.world.waterLevelAt ? this.world.waterLevelAt(this.x, this.z) : null;
    this.inWater = wl === null ? 0 : Math.max(0, wl - this.y);
  }

  _land() {
    const v = this.maxFallSpeed;
    this.landImpact = clamp(v / 10, 0, 1);
    if (v > SAFE_FALL_SPEED) this.fallDamage += (v - SAFE_FALL_SPEED) * 13;
    if (v > 5) this.stamina -= 5 / STAMINA_POOL;
    this.maxFallSpeed = 0;
    this.airTime = 0;
  }

  // Highest walkable surface under (x, z) starting from fromY going down maxDrop.
  _findGround(x, fromY, z, maxDrop) {
    const hf = this.world.hf;
    let best = null;
    const th = hf.getHeight(x, z);
    if (th <= fromY && th >= fromY - maxDrop - 0.01) {
      best = th;
      this.groundOnTerrain = true;
      this.groundSurface = hf.getSurface(x, z);
    }
    // Boxes (floors, stairs, rubble) under the feet.
    const r = 0.2;
    const list = this.world.query(x - r, fromY - maxDrop, z - r, x + r, fromY, z + r, this._list, FLAG_SOLID);
    for (const b of list) {
      const top = boxTopAt(b, x, z);
      if (top === null) continue;
      if (top <= fromY + 0.001 && top >= fromY - maxDrop && (best === null || top > best)) {
        best = top;
        this.groundOnTerrain = false;
        this.groundBox = b;
      }
    }
    return best;
  }

  // Push the body's collision spheres out of walls.
  _resolveCollisions() {
    const info = STANCE_INFO[this.stance];
    const out = this._tmp;
    const p = this._p || (this._p = { x: 0, y: 0, z: 0 });
    if (this.stance === STANCE.PRONE) {
      // Lying down: head, middle and feet along the facing direction.
      const fx = -Math.sin(this.yaw),
        fz = -Math.cos(this.yaw);
      for (const o of [0.7, 0, -0.75]) {
        p.x = this.x + fx * o;
        p.z = this.z + fz * o;
        p.y = this.y + 0.25;
        this.world.resolveSphere(p, info.radius, out, FLAG_SOLID);
        if (out.hit) {
          this.x += out.x;
          this.z += out.z;
        }
      }
      return;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const h of info.spheres) {
        p.x = this.x;
        p.y = this.y + h;
        p.z = this.z;
        this.world.resolveSphere(p, info.radius, out, FLAG_SOLID);
        if (!out.hit) continue;
        this.x += out.x;
        this.z += out.z;
        // Hitting a ceiling stops upward motion.
        if (out.y < -0.001 && this.vy > 0) this.vy = 0;
        // Cancel velocity into the wall so we slide along it.
        const len = Math.hypot(out.x, out.z);
        if (len > 1e-6) {
          const nx = out.x / len,
            nz = out.z / len;
          const vn = this.vx * nx + this.vz * nz;
          if (vn < 0) {
            this.vx -= vn * nx;
            this.vz -= vn * nz;
          }
        }
      }
    }
  }

  // Eye position including lean (returns into out).
  eyePosition(out) {
    const leanDist = this.lean * 0.38 * (this.stance === STANCE.CROUCH ? 0.85 : 1);
    const rx = Math.cos(this.yaw),
      rz = -Math.sin(this.yaw);
    out.x = this.x + rx * leanDist;
    out.y = this.y + this.eye - Math.abs(this.lean) * 0.06;
    out.z = this.z + rz * leanDist;
    return out;
  }
}

// Height of a box's top surface at (x, z), or null if (x, z) is outside it.
// Works for tilted boxes (ramps, roofs) by intersecting a vertical line.
export function boxTopAt(b, x, z) {
  // Vertical line through (x, z): find where it exits the box's top.
  const px = x - b.cx,
    pz = z - b.cz;
  const ax = b.ax,
    ay = b.ay,
    az = b.az;
  // Local coordinates of the line origin at y = b.cy and direction (0,1,0).
  const ox = px * ax[0] + pz * ax[2],
    oy = px * ay[0] + pz * ay[2],
    oz = px * az[0] + pz * az[2];
  const dx = ax[1],
    dy = ay[1],
    dz = az[1];
  let tmin = -Infinity,
    tmax = Infinity;
  const o = [ox, oy, oz],
    d = [dx, dy, dz],
    h = [b.hx, b.hy, b.hz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < -h[i] || o[i] > h[i]) return null;
    } else {
      let t1 = (-h[i] - o[i]) / d[i],
        t2 = (h[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
    }
  }
  if (tmin > tmax) return null;
  return b.cy + tmax;
}
