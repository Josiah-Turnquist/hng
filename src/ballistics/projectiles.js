// Flying bullets, rockets and shells. Every projectile is simulated through the
// air with gravity, drag (from its real ballistic coefficient) and wind, in small
// time steps. Between steps we check the path for anything it hits.
//
// What happens on a hit depends on the material: the bullet may stop, glance off
// (ricochet), or punch through with reduced speed and a slight deflection.
// This file has no graphics code so it can be tested on its own.
import { TABLES, dragDecel } from './drag.js';
import { MATERIALS, residualSpeed, ricochetChance } from './materials.js';
import { RayHit, FLAG_BULLET } from '../physics/collision.js';
import { G } from '../core/math.js';

const MIN_SPEED = 25; // m/s: below this a bullet is spent

// Turn a direction by small random angles (radians, normal distribution).
function deflect(p, sigma) {
  if (sigma <= 0) return;
  const sp = Math.hypot(p.vx, p.vy, p.vz);
  let dx = p.vx / sp,
    dy = p.vy / sp,
    dz = p.vz / sp;
  // Build two vectors perpendicular to the direction.
  let ax = Math.abs(dy) < 0.9 ? 0 : 1,
    ay = Math.abs(dy) < 0.9 ? 1 : 0,
    az = 0;
  let ux = dy * az - dz * ay,
    uy = dz * ax - dx * az,
    uz = dx * ay - dy * ax;
  const ul = Math.hypot(ux, uy, uz);
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const wx = dy * uz - dz * uy,
    wy = dz * ux - dx * uz,
    wz = dx * uy - dy * ux;
  const a = gauss() * sigma,
    b = gauss() * sigma;
  dx += ux * a + wx * b;
  dy += uy * a + wy * b;
  dz += uz * a + wz * b;
  const l = Math.hypot(dx, dy, dz);
  p.vx = (dx / l) * sp;
  p.vy = (dy / l) * sp;
  p.vz = (dz / l) * sp;
}

function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

let nextId = 1;

export class Projectile {
  constructor() {
    this.alive = false;
  }

  init(o) {
    this.id = nextId++;
    this.alive = true;
    this.x = o.x;
    this.y = o.y;
    this.z = o.z;
    this.vx = o.vx;
    this.vy = o.vy;
    this.vz = o.vz;
    this.px = o.x; // previous position (for tracer streaks)
    this.py = o.y;
    this.pz = o.z;
    this.ammo = o.ammo;
    this.table = TABLES[o.ammo.drag || 'G1'];
    this.bc = o.ammo.bc;
    this.mass = o.ammo.mass;
    this.area = Math.PI * (o.ammo.diameter / 2) ** 2;
    this.owner = o.owner ?? null;
    this.weapon = o.weapon ?? null;
    this.tracer = !!o.tracer;
    this.age = 0;
    this.distance = 0;
    this.tumble = 1; // drag multiplier: >1 once the bullet is tumbling after hitting something
    this.hits = 0;
    this.ignoreBox = null;
    this.ignoreTarget = null;
    this.startSpeed = Math.hypot(o.vx, o.vy, o.vz);
    this.fuse = o.fuse ?? 0; // for timed/impact-fused explosives
    this.userData = o.userData ?? null;
    return this;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy, this.vz);
  }

  get energy() {
    const s = this.speed;
    return 0.5 * this.mass * s * s;
  }
}

export class ProjectileSystem {
  // world: CollisionWorld; atmosphere: Atmosphere.
  // dynamicRaycast(ox,oy,oz,dx,dy,dz,maxDist,projectile) -> null | { t, tExit, nx,ny,nz, material, target, part, armorMM }
  constructor({ world, atmosphere, dynamicRaycast = null, maxStep = 1 / 400 }) {
    this.world = world;
    this.atmosphere = atmosphere;
    this.dynamicRaycast = dynamicRaycast;
    this.maxStep = maxStep;
    this.pool = [];
    this.active = [];
    this.hit = new RayHit();
    // Event hooks set by the game.
    this.onImpact = null; // (projectile, info) on every surface interaction
    this.onSegment = null; // (projectile, x0,y0,z0, x1,y1,z1) for fly-by sounds
    this.onExpire = null; // (projectile, reason)
    this.bounds = world ? world.hf.half + 300 : 5000;
  }

  fire(opts) {
    const p = (this.pool.pop() || new Projectile()).init(opts);
    this.active.push(p);
    return p;
  }

  // Acceleration from gravity, drag and wind for a given velocity.
  _accel(p, vx, vy, vz, out) {
    const atm = this.atmosphere;
    const rx = vx - atm.windX,
      ry = vy,
      rz = vz - atm.windZ;
    const s = Math.hypot(rx, ry, rz);
    let k = 0;
    if (s > 1e-6) {
      const d = dragDecel(p.table, p.bc, s, atm.density, atm.speedOfSound) * p.tumble;
      k = d / s;
    }
    out[0] = -rx * k;
    out[1] = -ry * k - G;
    out[2] = -rz * k;
    if (p.ammo.thrust && p.age < p.ammo.burnTime) {
      // Rocket motor still burning: push along the direction of travel.
      const sp = Math.hypot(vx, vy, vz) || 1;
      const a = p.ammo.thrust / p.mass;
      out[0] += (vx / sp) * a;
      out[1] += (vy / sp) * a;
      out[2] += (vz / sp) * a;
    }
  }

  update(dt) {
    const list = this.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      this._advance(p, dt);
      if (!p.alive) {
        list[i] = list[list.length - 1];
        list.pop();
        this.pool.push(p);
      }
    }
  }

  _advance(p, dt) {
    const a1 = this._a1 || (this._a1 = [0, 0, 0]);
    const a2 = this._a2 || (this._a2 = [0, 0, 0]);
    p.px = p.x;
    p.py = p.y;
    p.pz = p.z;
    let remaining = dt;
    let guard = 0;
    while (remaining > 1e-7 && p.alive && guard++ < 32) {
      const h = Math.min(remaining, this.maxStep);
      // Heun's method (second-order): predict with the start acceleration,
      // correct with the average of start and end accelerations.
      this._accel(p, p.vx, p.vy, p.vz, a1);
      const pvx = p.vx + a1[0] * h,
        pvy = p.vy + a1[1] * h,
        pvz = p.vz + a1[2] * h;
      this._accel(p, pvx, pvy, pvz, a2);
      const nvx = p.vx + 0.5 * (a1[0] + a2[0]) * h;
      const nvy = p.vy + 0.5 * (a1[1] + a2[1]) * h;
      const nvz = p.vz + 0.5 * (a1[2] + a2[2]) * h;
      const nx = p.x + 0.5 * (p.vx + nvx) * h;
      const ny = p.y + 0.5 * (p.vy + nvy) * h;
      const nz = p.z + 0.5 * (p.vz + nvz) * h;

      const sx = nx - p.x,
        sy = ny - p.y,
        sz = nz - p.z;
      const segLen = Math.hypot(sx, sy, sz);
      if (segLen < 1e-9) {
        remaining -= h;
        continue;
      }
      const dx = sx / segLen,
        dy = sy / segLen,
        dz = sz / segLen;

      // Nearest thing along this segment: static world or a dynamic target.
      const hit = this.hit;
      let hitT = Infinity;
      let dyn = null;
      if (this.world && this.world.raycast(p.x, p.y, p.z, dx, dy, dz, segLen, hit, FLAG_BULLET, true, p.ignoreBox)) hitT = hit.t;
      if (this.dynamicRaycast) {
        const d = this.dynamicRaycast(p.x, p.y, p.z, dx, dy, dz, Math.min(segLen, hitT), p);
        if (d && d.t < hitT) {
          hitT = d.t;
          dyn = d;
        }
      }

      if (hitT === Infinity) {
        if (this.onSegment) this.onSegment(p, p.x, p.y, p.z, nx, ny, nz);
        p.x = nx;
        p.y = ny;
        p.z = nz;
        p.vx = nvx;
        p.vy = nvy;
        p.vz = nvz;
        p.distance += segLen;
        p.ignoreBox = null;
        remaining -= h;
      } else {
        // Move to the impact point with the velocity interpolated along the step.
        const f = hitT / segLen;
        const ix = p.x + dx * hitT,
          iy = p.y + dy * hitT,
          iz = p.z + dz * hitT;
        if (this.onSegment) this.onSegment(p, p.x, p.y, p.z, ix, iy, iz);
        p.vx += (nvx - p.vx) * f;
        p.vy += (nvy - p.vy) * f;
        p.vz += (nvz - p.vz) * f;
        p.x = ix;
        p.y = iy;
        p.z = iz;
        p.distance += hitT;
        remaining -= h * Math.max(f, 0.02);
        if (dyn) this._hitDynamic(p, dyn, dx, dy, dz);
        else this._hitStatic(p, hit, dx, dy, dz);
      }

      p.age += h;
      if (p.ammo.fuseTime && p.age >= p.ammo.fuseTime) this._expire(p, 'fuse');
    }
    if (!p.alive) return;
    const sp = p.speed;
    if (sp < MIN_SPEED && !p.ammo.thrown) this._expire(p, 'spent');
    else if (p.age > (p.ammo.maxAge || 10)) this._expire(p, 'age');
    else if (p.y < (this.world ? this.world.hf.minH - 50 : -1000) || Math.abs(p.x) > this.bounds || Math.abs(p.z) > this.bounds) this._expire(p, 'bounds');
  }

  _expire(p, reason) {
    if (!p.alive) return;
    p.alive = false;
    if (this.onExpire) this.onExpire(p, reason);
  }

  _impact(p, info) {
    p.hits++;
    if (this.onImpact) this.onImpact(p, info);
  }

  // Explosive projectiles (rockets, shells, rifle grenades) detonate on impact.
  _explosive(p, info) {
    if (!p.ammo.explosive) return false;
    info.detonate = true;
    this._impact(p, info);
    this._expire(p, 'detonated');
    return true;
  }

  _hitStatic(p, hit, dx, dy, dz) {
    const matName = hit.ground ? this._groundMaterial(p) : hit.material;
    const mat = MATERIALS[matName] || MATERIALS.soil;
    const speed = p.speed;
    // Grazing angle between the flight path and the surface.
    const cosN = -(dx * hit.nx + dy * hit.ny + dz * hit.nz);
    const grazing = Math.asin(Math.min(1, Math.max(0, cosN)));
    const info = {
      x: p.x,
      y: p.y,
      z: p.z,
      nx: hit.nx,
      ny: hit.ny,
      nz: hit.nz,
      material: matName,
      mat,
      speed,
      energy: p.energy,
      box: hit.box,
      ground: hit.ground,
      kind: 'enter',
      dirX: dx,
      dirY: dy,
      dirZ: dz,
      armorMM: hit.box?.owner?.armorMM ?? 0,
      target: hit.box?.owner ?? null,
      detonate: false,
    };
    if (this._explosive(p, info)) return;
    if (p.ammo.thrown) return this._bounce(p, hit, info);

    if (Math.random() < ricochetChance(grazing, mat, speed) * (p.ammo.ricochetMult ?? 1)) {
      // Glance off: reflect, lose speed, pick up random deflection and start tumbling.
      const vn = p.vx * hit.nx + p.vy * hit.ny + p.vz * hit.nz;
      p.vx -= 2 * vn * hit.nx;
      p.vy -= 2 * vn * hit.ny;
      p.vz -= 2 * vn * hit.nz;
      const keep = 0.45 + 0.35 * (1 - grazing / ((mat.ricochetDeg * Math.PI) / 180));
      p.vx *= keep;
      p.vy *= keep;
      p.vz *= keep;
      deflect(p, 0.06);
      p.tumble = 3;
      p.x += hit.nx * 0.002;
      p.y += hit.ny * 0.002;
      p.z += hit.nz * 0.002;
      info.kind = 'ricochet';
      this._impact(p, info);
      return;
    }

    if (hit.ground || !hit.box) {
      // The ground is effectively infinitely thick: the bullet stops in it.
      info.kind = 'stop';
      this._impact(p, info);
      this._expire(p, 'ground');
      return;
    }

    if (mat.isArmor) {
      this._hitArmor(p, info, hit.tExit - hit.t, cosN);
      return;
    }

    const thickness = Math.max(0.001, hit.tExit - hit.t);
    const exitSpeed = residualSpeed(speed, thickness, p.mass, p.area, mat, p.ammo.hardness || 1);
    if (exitSpeed < MIN_SPEED) {
      info.kind = 'stop';
      this._impact(p, info);
      this._expire(p, 'stopped');
      return;
    }
    // Through and out the other side.
    info.kind = 'through';
    info.exitSpeed = exitSpeed;
    this._impact(p, info);
    const k = exitSpeed / speed;
    p.vx *= k;
    p.vy *= k;
    p.vz *= k;
    p.x += dx * (thickness + 0.002);
    p.y += dy * (thickness + 0.002);
    p.z += dz * (thickness + 0.002);
    p.ignoreBox = hit.box;
    // Penetrating anything disturbs the bullet: more for dense and thick stuff.
    const disturb = mat.soft ? 0.004 * thickness : Math.min(0.12, 0.015 + (1 - k) * 0.12);
    deflect(p, disturb);
    if (!mat.soft) p.tumble = Math.max(p.tumble, 1 + 2.5 * (1 - k));
    // Exit hole effect.
    this._impact(p, { ...info, kind: 'exit', x: p.x, y: p.y, z: p.z, nx: dx, ny: dy, nz: dz });
  }

  _hitArmor(p, info, thicknessM, cosN) {
    // Plates on vehicles carry their real thickness in mm; the box thickness is visual.
    const angle = Math.acos(Math.min(1, Math.max(0, cosN)));
    info.angle = angle;
    info.kind = 'armor';
    this._impact(p, info);
    this._expire(p, 'armor');
  }

  _hitDynamic(p, d, dx, dy, dz) {
    const mat = MATERIALS[d.material] || MATERIALS.flesh;
    const speed = p.speed;
    const info = {
      x: p.x,
      y: p.y,
      z: p.z,
      nx: d.nx,
      ny: d.ny,
      nz: d.nz,
      material: d.material,
      mat,
      speed,
      energy: p.energy,
      target: d.target,
      part: d.part,
      kind: 'enter',
      dirX: dx,
      dirY: dy,
      dirZ: dz,
      armorMM: d.armorMM ?? 0,
      detonate: false,
    };
    if (this._explosive(p, info)) return;
    if (p.ammo.thrown) return this._bounce(p, { nx: d.nx, ny: d.ny, nz: d.nz }, info);
    if (mat.isArmor) {
      const cosN = -(dx * d.nx + dy * d.ny + dz * d.nz);
      this._hitArmor(p, info, 0, cosN);
      return;
    }
    const thickness = Math.max(0.01, (d.tExit ?? d.t + 0.2) - d.t);
    const exitSpeed = residualSpeed(speed, thickness, p.mass, p.area, mat, p.ammo.hardness || 1);
    info.exitSpeed = exitSpeed;
    // Energy actually delivered to the target (what causes wounds).
    info.energyDeposited = 0.5 * p.mass * (speed * speed - exitSpeed * exitSpeed);
    if (exitSpeed < MIN_SPEED) {
      info.kind = 'stop';
      this._impact(p, info);
      this._expire(p, 'stopped');
      return;
    }
    info.kind = 'through';
    this._impact(p, info);
    const k = exitSpeed / speed;
    p.vx *= k;
    p.vy *= k;
    p.vz *= k;
    p.x += dx * (thickness + 0.005);
    p.y += dy * (thickness + 0.005);
    p.z += dz * (thickness + 0.005);
    p.ignoreTarget = d.target;
    deflect(p, 0.05);
    p.tumble = Math.max(p.tumble, 2);
  }

  // Grenades and other thrown things bounce and roll.
  _bounce(p, hit, info) {
    const vn = p.vx * hit.nx + p.vy * hit.ny + p.vz * hit.nz;
    const restitution = 0.3;
    const friction = 0.55;
    // Split into normal and tangential parts.
    const tx = p.vx - vn * hit.nx,
      ty = p.vy - vn * hit.ny,
      tz = p.vz - vn * hit.nz;
    p.vx = tx * friction - vn * restitution * hit.nx;
    p.vy = ty * friction - vn * restitution * hit.ny;
    p.vz = tz * friction - vn * restitution * hit.nz;
    p.x += hit.nx * 0.03;
    p.y += hit.ny * 0.03;
    p.z += hit.nz * 0.03;
    info.kind = 'bounce';
    if (Math.abs(vn) > 1.5) this._impact(p, info);
    if (p.speed < 0.4 && hit.ny > 0.5) {
      // Resting on the ground: stop moving but keep the fuse burning.
      p.vx = p.vy = p.vz = 0;
      p.resting = true;
    }
  }

  _groundMaterial(p) {
    if (!this.world) return 'soil';
    const s = this.world.hf.getSurface(p.x, p.z);
    return SURFACE_BULLET[s] || 'soil';
  }
}

// Ground surface id -> bullet material (see SURF in heightfield.js).
const SURFACE_BULLET = ['soil', 'soil', 'soil', 'mud', 'rock', 'soil', 'stone', 'soil', 'soil', 'sand', 'water', 'soil'];
