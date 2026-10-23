// A running match: the world, the people and vehicles in it, and the rules.
import * as THREE from 'three';
import { Loop } from '../core/loop.js';
import { World } from './world.js';
import { Pipeline } from '../render/pipeline.js';
import { Effects } from '../render/effects.js';
import { ProjectileSystem } from '../ballistics/projectiles.js';
import { RayHit } from '../physics/collision.js';
import { MAPS } from '../world/maps.js';
import { Soldier } from './soldier.js';
import { PlayerController } from './player.js';
import { FACTIONS, DEFAULT_LOADOUT } from '../weapons/defs.js';
import { Hud } from '../ui/hud.js';
import { RangeMode } from './modes/range.js';
import { hitboxesFor, raycastSoldier } from './hitboxes.js';
import { clamp } from '../core/math.js';

export class Game {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    this.renderer = app.renderer;
    this.input = app.input;
    this.settings = app.settings;
    this.quality = app.settings.quality;
    this.time = 0;
    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, this.quality.viewDistance);
    this.camera.rotation.order = 'YXZ';
    this.spectator = { yaw: 0, pitch: 0, speed: 12 };
    this.soldiers = [];
    this.tmpHit = new RayHit();
    this.cameraMode = 'first';
    this.audio = app.audio || null;
    this.paused = false;
  }

  async load(progress) {
    const def = MAPS[this.opts.map] || MAPS.town;
    this.mapDef = def;
    this.world = new World(this.renderer, this.camera, this.settings, def);
    await this.world.build(progress);
    this.pipeline = new Pipeline(this.renderer, this.quality);
    this.pipeline.setSky(this.world.sky.skyCube);
    this.effects = new Effects(this.world);
    this.projectiles = new ProjectileSystem({
      world: this.world.collision,
      atmosphere: this.world.atmosphere,
      dynamicRaycast: (ox, oy, oz, dx, dy, dz, max, p) => this._raycastSoldiers(ox, oy, oz, dx, dy, dz, max, p),
    });
    this.projectiles.onImpact = (p, info) => this._onImpact(p, info);
    this.projectiles.onExpire = (p, why) => this._onExpire(p, why);
    this.projectiles.onSegment = (p, x0, y0, z0, x1, y1, z1) => this._onSegment(p, x0, y0, z0, x1, y1, z1);
    this.hud = new Hud(this);

    // Mode.
    const faction = this.opts.faction || 'GE';
    const cls = this.opts.cls || 'infantry';
    const def0 = DEFAULT_LOADOUT[faction][cls];
    const loadout = (this.opts.loadout || def0).map((id, i) => id || def0[i]);
    this.mode = new RangeMode(this);
    const spawn = this.mode.playerSpawn();
    const player = new Soldier(this, { faction, cls, loadout, team: 0, name: 'You', isPlayer: true, x: spawn.x, z: spawn.z });
    player.yaw = spawn.yaw;
    this.soldiers.push(player);
    this.player = new PlayerController(this, player);
    this.player.look.yaw = spawn.yaw;
    this.mode.start();

    // Optional fixed camera for screenshots: ?cam=x,y,z,yawDeg,pitchDeg
    const cam = this.app.params.get('cam');
    if (cam) {
      const [x, y, z, yaw, pitch] = cam.split(',').map(Number);
      this.cameraMode = 'spectate';
      this.camera.position.set(x, y, z);
      this.spectator.yaw = ((yaw || 0) * Math.PI) / 180;
      this.spectator.pitch = ((pitch || 0) * Math.PI) / 180;
    }
    this.loop = new Loop({
      step: 1 / 120,
      update: (dt) => this.update(dt),
      render: (fdt, alpha) => this.render(fdt, alpha),
    });
    this.app.canvas.addEventListener('click', () => {
      if (!this.paused) this.input.lock();
    });
  }

  start() {
    this.loop.start();
  }

  resize(w, h, pr) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pipeline.setSize(w, h, pr);
    this.world.shadows.updateFrustums();
    this.hud?.resize(w, h);
  }

  // --- simulation ----------------------------------------------------------------------
  update(dt) {
    this.time += dt;
    this.player.update(dt);
    for (const s of this.soldiers) if (!s.isPlayer) s.update(dt);
    this.projectiles.update(dt);
    this.mode.update?.(dt);
  }

  _raycastSoldiers(ox, oy, oz, dx, dy, dz, max, p) {
    let best = null;
    for (const s of this.soldiers) {
      if (s === p.owner || s === p.ignoreTarget) continue;
      const b = s.body;
      // Quick reject with a bounding sphere around the soldier.
      const cx = b.x - ox,
        cy = b.y + 0.9 - oy,
        cz = b.z - oz;
      const t = cx * dx + cy * dy + cz * dz;
      if (t < -1.5 || t > max + 1.5) continue;
      const px = cx - dx * t,
        py = cy - dy * t,
        pz = cz - dz * t;
      if (px * px + py * py + pz * pz > 1.8 * 1.8) continue;
      const hit = raycastSoldier(s, ox, oy, oz, dx, dy, dz, max);
      if (hit && (!best || hit.t < best.t)) {
        best = hit;
        best.target = s;
      }
    }
    if (best) best.material = 'flesh';
    return best;
  }

  _onImpact(p, info) {
    const fx = this.effects;
    if (info.detonate) {
      this.explode(info.x, info.y, info.z, p);
      return;
    }
    if (info.target && info.material === 'flesh') {
      if (info.kind !== 'exit') {
        const dmg = info.target.hit(info, p);
        fx.impact({ ...info, effect: 'blood' });
        this.audio?.impact('flesh', info.x, info.y, info.z, info.energy);
        if (p.owner === this.player.soldier && dmg > 0) this.hud.hitMarker(info.target.alive ? 1 : 2);
      }
      return;
    }
    if (info.kind === 'exit') {
      fx.impact({ ...info, energy: info.energy * 0.3 });
      return;
    }
    fx.impact(info);
    this.mode.onImpact?.(p, info);
    // Bullet holes on hard surfaces (not on soft ground or water).
    const m = info.material;
    if (info.kind !== 'ricochet' && m !== 'water' && m !== 'foliage' && !info.ground) {
      const tint = HOLE_TINT[m] || HOLE_TINT.default;
      const size = 0.02 + Math.min(0.06, p.ammo.diameter * 3) + (m === 'plaster' || m === 'brick' ? 0.04 : 0);
      fx.bulletHole(info.x, info.y, info.z, info.nx, info.ny, info.nz, size, tint);
    }
    if (info.kind === 'ricochet') this.audio?.play('ricochet', info, { volume: 0.6 });
    else this.audio?.impact(m, info.x, info.y, info.z, info.energy);
  }

  _onExpire(p, why) {
    if (why === 'fuse' && p.ammo.explosive) this.explode(p.x, p.y, p.z, p);
  }

  // Supersonic bullets crack as they pass the listener; slow ones whiz.
  _onSegment(p, x0, y0, z0, x1, y1, z1) {
    const me = this.player?.soldier;
    if (!me || p.owner === me || p.ammo.thrown) return;
    const e = this.player.eye;
    const sx = x1 - x0,
      sy = y1 - y0,
      sz = z1 - z0;
    const len2 = sx * sx + sy * sy + sz * sz;
    if (len2 < 1e-9) return;
    let t = ((e.x - x0) * sx + (e.y - y0) * sy + (e.z - z0) * sz) / len2;
    if (t < 0 || t > 1) return;
    const cx = x0 + sx * t - e.x,
      cy = y0 + sy * t - e.y,
      cz = z0 + sz * t - e.z;
    const miss = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (miss < 8 && !p.crackPlayed) {
      p.crackPlayed = true;
      this.audio?.crack(e.x + cx, e.y + cy, e.z + cz, miss, p.speed);
      this.player.suppression = Math.min(1, (this.player.suppression || 0) + (1 - miss / 8) * 0.4);
    }
  }

  // HE explosion: blast and fragments (fragments are real projectiles).
  explode(x, y, z, p) {
    const ex = p.ammo.explosive;
    this.effects.explosion(x, y, z, 0.6 + Math.sqrt(ex.blast) * 1.2);
    this.audio?.explosion(ex.blast > 0.3 ? 'shellExplosion' : 'grenadeExplosion', x, y, z);
    // Blast: falls off quickly with distance; cover between blocks it.
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const dx = s.body.x - x,
        dy = s.body.y + 1 - y,
        dz = s.body.z - z;
      const d = Math.hypot(dx, dy, dz);
      if (d > ex.radius * 2) continue;
      if (!this.world.collision.lineOfSight(x, y + 0.2, z, s.body.x, s.body.y + 1, s.body.z)) continue;
      const blast = (ex.blast * 900) / Math.max(1, d * d);
      if (blast > 1) s.damage(blast, { kind: 'explosion', attacker: p.owner, weapon: p.weapon });
    }
    // Fragments.
    const n = Math.min(60, ex.fragments || 30);
    const frag = { diameter: 0.004, mass: 0.0008, bc: 0.015, drag: 'G1', maxAge: 1.5 };
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1,
        th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      let dx = r * Math.cos(th),
        dy = Math.abs(u) * 0.8 + 0.05,
        dz = r * Math.sin(th);
      const v = 900 + Math.random() * 600;
      this.projectiles.fire({ x, y: y + 0.15, z, vx: dx * v, vy: dy * v, vz: dz * v, ammo: frag, owner: p.owner, weapon: p.weapon });
    }
  }

  onDamage(s, amount) {
    if (s === this.player?.soldier) this.hud?.damage(amount);
  }

  onDeath(s, cause) {
    this.hud?.killFeed(cause?.attacker, s, cause);
  }

  spawnCasing() {}
  spawnClip() {}

  // --- rendering --------------------------------------------------------------------
  render(frameDt) {
    const input = this.input;
    if (this.cameraMode === 'spectate') this._spectate(frameDt);
    else this.player.frameInput(frameDt);
    input.endFrame();
    if (this.cameraMode === 'first') this.player.render(frameDt);
    else this.camera.updateMatrixWorld();

    const camPos = this.camera.position;
    this.world.update(this.time, camPos);
    this.world.shadows.update();
    this.effects.update(frameDt, camPos, this.world.fogColor);
    const colors = FACTION_TRACERS;
    this.effects.updateTracers(this.projectiles.active, (p) => colors[p.owner?.faction] || colors.GE);
    this.hud.update(frameDt);
    const vm = this.cameraMode === 'first' ? this.player.viewmodel : null;
    this.pipeline.grade.uniforms.uDamage.value = clamp(this.hud.damageFlash, 0, 1);
    this.pipeline.render(this.world.scene, this.camera, vm?.scene, vm?.camera, this.time);
  }

  _spectate(frameDt) {
    const input = this.input;
    const [mx, my] = input.takeMouse();
    const s = this.spectator;
    s.yaw -= mx * 0.0022;
    s.pitch = clamp(s.pitch - my * 0.0022, -1.5, 1.5);
    this.camera.rotation.set(s.pitch, s.yaw, 0);
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);
    const sp = s.speed * (input.is('sprint') ? 5 : 1) * frameDt;
    if (input.is('forward')) this.camera.position.addScaledVector(fwd, sp);
    if (input.is('back')) this.camera.position.addScaledVector(fwd, -sp);
    if (input.is('right')) this.camera.position.addScaledVector(right, sp);
    if (input.is('left')) this.camera.position.addScaledVector(right, -sp);
  }
}

const HOLE_TINT = {
  wood: new THREE.Color(0.55, 0.45, 0.35),
  plank: new THREE.Color(0.55, 0.45, 0.35),
  brick: new THREE.Color(0.75, 0.55, 0.45),
  plaster: new THREE.Color(0.9, 0.88, 0.82),
  stone: new THREE.Color(0.8, 0.8, 0.78),
  concrete: new THREE.Color(0.8, 0.8, 0.78),
  steel: new THREE.Color(0.6, 0.6, 0.62),
  armor: new THREE.Color(0.7, 0.7, 0.72),
  default: new THREE.Color(0.7, 0.68, 0.62),
};

const FACTION_TRACERS = Object.fromEntries(Object.entries(FACTIONS).map(([k, f]) => [k, f.tracer]));
