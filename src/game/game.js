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
import { AssaultMode, ATT, DEF } from './modes/assault.js';
import { NavGrid } from '../ai/navgrid.js';
import { attachSoldierModel, updateSoldierView } from './soldierView.js';
import { ThrownView } from './thrownView.js';
import { ProjectileView } from './projectileView.js';
import { Pickups } from './pickups.js';
import { PickupView } from './pickupView.js';
import { gaussRandom } from '../core/math.js';
import { Casings } from '../render/casings.js';
import { AMMO } from '../weapons/ammo.js';
import { hitboxesFor, raycastSoldier } from './hitboxes.js';
import { spawnVehicle } from '../vehicles/index.js';
import { updateVehicleEffects, charModel, addHitMark } from '../vehicles/effects.js';
import { SURFACE_INFO } from '../world/heightfield.js';
import { MATERIALS } from '../ballistics/materials.js';
import { updateVehicleSound } from '../vehicles/sound.js';
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
    this.vehicles = [];
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
    this.pickups = new Pickups(this);
    this.casings = new Casings(this.world, this.audio);
    this.projectiles = new ProjectileSystem({
      world: this.world.collision,
      atmosphere: this.world.atmosphere,
      dynamicRaycast: (ox, oy, oz, dx, dy, dz, max, p) => this._raycastDynamic(ox, oy, oz, dx, dy, dz, max, p),
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
    const modeName = this.opts.mode && this.opts.mode !== 'auto' ? this.opts.mode : def.objectives ? 'assault' : 'range';
    let team = 0;
    if (modeName === 'assault' && def.objectives) {
      // Bots find their way on a walkability grid over the battlefield.
      const t0 = performance.now();
      this.nav = new NavGrid(this.world, { radius: (def.playRadius || 700) + 60 });
      this.nav.build({ doors: this.world.village?.doors || [] });
      // Vehicles need wider gaps and no doorways.
      this.vnav = new NavGrid(this.world, { radius: (def.playRadius || 700) + 60 });
      this.vnav.build({ doors: [], agentRadius: 1.6, maxSlopeDeg: 28 });
      console.log(`navigation grid ${this.nav.n}x${this.nav.n} built in ${Math.round(performance.now() - t0)} ms`);
      const enemy = this.opts.enemy || (faction === 'GE' ? 'US' : 'GE');
      const attack = (this.opts.side || 'attack') === 'attack';
      team = attack ? ATT : DEF;
      this.mode = new AssaultMode(this, {
        attackers: attack ? faction : enemy,
        defenders: attack ? enemy : faction,
        playerTeam: team,
        perSide: this.opts.bots || Number(this.app.params.get('bots') || 24),
        minutes: this.opts.minutes || Number(this.app.params.get('minutes') || 20),
      });
    } else this.mode = new RangeMode(this);
    const spawn = this.mode.playerSpawn();
    const player = new Soldier(this, { faction, cls, loadout, team, name: 'You', isPlayer: true, x: spawn.x, z: spawn.z });
    player.yaw = spawn.yaw;
    this.soldiers.push(player);
    this.player = new PlayerController(this, player);
    this.player.look.yaw = spawn.yaw;
    attachSoldierModel(this, player);
    this.mode.start();
    this.deploy = { t: 0, index: 0 };

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
    // Tank crews start in their tank.
    if (cls === 'tanker') this._deployInTank(player);
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

  // A clear, level spot for a vehicle near (x, z), or null.
  findParking(x, z, minR = 0, maxR = 60, half = 2.5, nav = this.nav) {
    const hf = this.world.hf;
    const coll = this.world.collision;
    for (let r = minR; r < maxR; r += 5) {
      const n = r < 1 ? 1 : 10;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r * 0.37;
        const px = x + Math.cos(a) * r,
          pz = z + Math.sin(a) * r;
        if (nav && !(nav.inMainArea ? nav.inMainArea(px, pz) : nav.walkable(px, pz))) continue;
        if (this.world.waterLevelAt?.(px, pz) != null) continue;
        const h = hf.getHeight(px, pz);
        if (Math.abs(hf.getHeight(px + half, pz) - hf.getHeight(px - half, pz)) > half * 0.25) continue;
        if (Math.abs(hf.getHeight(px, pz + half) - hf.getHeight(px, pz - half)) > half * 0.25) continue;
        if (coll.query(px - half, h + 0.2, pz - half * 1.4, px + half, h + 2.5, pz + half * 1.4, [], 1).length) continue;
        // (Parked bicycles have no collision box: keep clear of them too.)
        if (this.vehicles.some((v) => v.isBike && (v.body.position.x - px) ** 2 + (v.body.position.z - pz) ** 2 < (half * 1.4 + 1.5) ** 2)) continue;
        return { x: px, z: pz };
      }
    }
    return null;
  }

  // Put a soldier in a fresh tank of their army near where they stand.
  _deployInTank(s) {
    const id = (s.isPlayer && this.opts.tank) || { US: 'm4a1_sherman', GE: 'panzer4_h', SU: 't34_76' }[s.faction];
    if (!id) return null;
    const b = s.body;
    // Somewhere a tank can actually drive out of (not wedged between houses).
    const spot = this.findParking(b.x, b.z, 8, 160, 3.5, this.vnav || this.nav) || this.findParking(b.x, b.z, 6, 80, 3.5) || { x: b.x - Math.sin(s.yaw) * 6, z: b.z - Math.cos(s.yaw) * 6 };
    const v = this.spawnVehicle(id, spot.x, spot.z, s.yaw);
    v.team = s.team;
    v.enter(s, 0);
    if (s.isPlayer) this.player.vehicleCtl.entered(v);
    return v;
  }

  // One round from a vehicle's machine gun (coaxial, bow or roof).
  vehicleMgShot(v, mg, anchor, dir, owner) {
    const d = mg.def;
    const ammo = AMMO[d.ammo];
    const m = v.anchorWorld(anchor, new THREE.Vector3()) || v.muzzleWorld?.(new THREE.Vector3()) || v.body.position.clone();
    const dd = dir.clone();
    const sig = 0.0012;
    dd.x += gaussRandom(0, sig);
    dd.y += gaussRandom(0, sig);
    dd.z += gaussRandom(0, sig);
    dd.normalize();
    const mv = ammo.mv * (1 + gaussRandom(0, 0.006));
    const bv = v.body.velocity;
    const p = this.projectiles.fire({
      x: m.x,
      y: m.y,
      z: m.z,
      vx: dd.x * mv + bv.x,
      vy: dd.y * mv + bv.y,
      vz: dd.z * mv + bv.z,
      ammo,
      owner,
      weapon: { name: d.name, vehicle: true },
      tracer: d.tracerEvery > 0 && mg.shots % d.tracerEvery === 0,
    });
    p.ignoreTarget = v;
    if (owner) owner.lastShotTime = this.time;
    this.effects.muzzle(m.x, m.y, m.z, dd.x, dd.y, dd.z, 0.6);
    this.audio?.gunshot?.(d.sound, m.x, m.y, m.z, { isLocal: owner === this.player?.soldier, source: `v${v.id}` });
  }

  spawnVehicle(id, x, z, yaw = 0) {
    const v = spawnVehicle(this, id, x, z, yaw);
    this.vehicles.push(v);
    return v;
  }

  // --- simulation ----------------------------------------------------------------------
  update(dt) {
    if (this.paused) return;
    this.time += dt;
    this.navBudget = 1;
    this._guard(this.player.soldier, () => this.player.update(dt));
    for (const v of this.vehicles) this._guard(v, () => v.step(dt));
    for (const s of this.soldiers) {
      if (s.isPlayer) continue;
      this._guard(s, () => {
        if (s.alive && s.brain) s.brain.update(dt);
        s.update(dt);
      });
      if (s.suppression) s.suppression = Math.max(0, s.suppression - dt * 0.35);
    }
    this._playerDeploy(dt);
    this._footsteps();
    this._runOver();
    this.projectiles.update(dt);
    this.pickups?.update();
    this._guard(this.mode, () => this.mode.update?.(dt));
  }

  // A bug in one soldier, vehicle or rule shouldn't stop the whole battle (an
  // error thrown every step would freeze it): report it once and go on. Headless
  // (tests, tuning) errors still stop everything, so they get noticed.
  _guard(who, fn) {
    if (this.headless) return fn();
    try {
      fn();
    } catch (e) {
      if (!who._updateError) {
        who._updateError = true;
        console.error(`Update failed for ${who.name || who.def?.id || who.constructor?.name || 'something'}; carrying on without it`, e);
      }
    }
  }

  // A bot's shot: from the eye along its aim, with the weapon's own accuracy and
  // a pointing error when not using the sights.
  botFire(s, w) {
    const d = w.def;
    const b = s.body;
    const eye = b.eyePosition({ x: 0, y: 0, z: 0 });
    const cp = Math.cos(s.pitch);
    let dx = -Math.sin(s.yaw) * cp,
      dy = Math.sin(s.pitch),
      dz = -Math.cos(s.yaw) * cp;
    let err = s.aiming ? 0 : (d.hipError * Math.PI) / 180 * 0.5;
    err = Math.hypot(err, d.accuracy * 0.000291 * 0.42);
    dx += gaussRandom(0, err);
    dy += gaussRandom(0, err);
    dz += gaussRandom(0, err);
    const l = Math.hypot(dx, dy, dz);
    dx /= l;
    dy /= l;
    dz /= l;
    const mv = d.mv * (1 + gaussRandom(0, 0.006));
    const tracer = d.tracerEvery > 0 && w.shotsFired % d.tracerEvery === 0;
    const sx = eye.x + dx * 0.3,
      sy = eye.y + dy * 0.3,
      sz = eye.z + dz * 0.3;
    this.projectiles.fire({ x: sx, y: sy, z: sz, vx: dx * mv + b.vx, vy: dy * mv + b.vy, vz: dz * mv + b.vz, ammo: w.ammo, owner: s, weapon: d, tracer });
    s.lastShotTime = this.time;
    if (s.view) s.view.recoil = 1;
    const m = s.model?.muzzleWorld;
    const mx = m ? m.x : sx,
      my = m ? m.y : sy,
      mz = m ? m.z : sz;
    this.effects.muzzle(mx, my, mz, dx, dy, dz, 0.8);
    this.audio?.gunshot?.(d.sound, mx, my, mz, { source: `s${s.id}` });
  }

  // Sounds of other soldiers handling their weapons.
  onWeaponEvent(s, w, ev) {
    if (ev.type === 'sound') this.audio?.play?.(ev.id, { x: s.body.x, y: s.body.y + 1.2, z: s.body.z }, { volume: 0.8 });
  }

  // Dead player: choose where to go back in (jump deploys, the lean keys change the point).
  _playerDeploy(dt) {
    const s = this.player.soldier;
    const d = this.deploy;
    if (s.alive) {
      d.t = 0;
      d.go = false;
      d.freed = false;
      if (this.deployOpen) this.hud.deployScreen?.(null);
      this.deployOpen = false;
      return;
    }
    d.t += dt;
    const opts = this.mode.deployOptions ? this.mode.deployOptions() : null;
    const input = this.input;
    if (opts && opts.length) {
      if (input.hit('leanLeft')) d.index = (d.index + opts.length - 1) % opts.length;
      if (input.hit('leanRight')) d.index = (d.index + 1) % opts.length;
      d.index = Math.min(d.index, opts.length - 1);
      const o = opts[d.index];
      const wait = Math.max(0, o.delay - d.t);
      this.hud.setDeploy(`Deploy at ${o.id}${o.name !== o.id ? ` ${o.name}` : ''} ${wait > 0 ? `in ${wait.toFixed(0)} s` : `: press ${input.key('jump')}`}   (${input.key('leanLeft')} / ${input.key('leanRight')}: ${opts.length} points)`);
      // After a moment of the death camera, the deploy map, and the mouse to use it.
      if (d.t > 1.5 && !this.mode.over) {
        this.deployOpen = true;
        this.hud.deployScreen?.({ opts, index: d.index, t: d.t });
        if (!d.freed) {
          d.freed = true;
          input.unlock();
        }
      }
      if (wait <= 0 && (input.hit('jump') || d.go)) {
        d.go = false;
        this.mode.spawnSoldier(s, o.point);
        this.player.look.yaw = s.yaw;
        this.player.look.pitch = 0;
        this.player._equip(0);
        if (s.cls === 'tanker') this._deployInTank(s);
        this.hud.deployScreen?.(null);
        this.deployOpen = false;
        input.lock();
      }
    } else if (!opts) {
      const wait = Math.max(0, 5 - d.t);
      this.hud.setDeploy(wait > 0 ? `Back in ${wait.toFixed(0)} s` : `Press ${input.key('jump')} to go back in`);
      if (wait <= 0 && input.hit('jump')) {
        const sp = this.mode.playerSpawn();
        const b = s.body;
        b.x = sp.x;
        b.z = sp.z;
        b.y = this.world.hf.getHeight(sp.x, sp.z);
        b.vx = b.vy = b.vz = 0;
        s.alive = true;
        s.health = 100;
        s.bleed = 0;
        s.deathTime = 0;
        s.resupply();
        for (const w of s.weapons) w?.fill();
        this.player.look.yaw = sp.yaw;
      }
    } else this.hud.setDeploy('No point to deploy at');
  }

  // Footsteps: the ground's own sound; crawling and walking are quieter.
  _footsteps() {
    const a = this.audio;
    if (!a) return;
    for (const s of this.soldiers) {
      const b = s.body;
      if (!b.stepEvent || !s.alive || s.vehicle) continue;
      let surface;
      if (b.waterDepth > 0.15) surface = 'water';
      else if (b.groundOnTerrain) surface = SURFACE_INFO[b.groundSurface]?.step || 'dirt';
      else {
        const m = b.groundBox?.material;
        surface = m === 'wood' || m === 'plank' ? 'wood' : m === 'sandbag' ? 'sand' : 'stone';
      }
      const loud = b.sprinting;
      const vol = b.stance === 2 ? 0.35 : b.stance === 1 || s.intent.walk ? 0.55 : 1;
      if (s.isPlayer) a.footstep(surface, null, 0, 0, { loud, volume: vol * 0.7 });
      else a.footstep(surface, b.x, b.y, b.z, { loud, volume: vol });
    }
  }

  // Vehicles knock down (and hurt) people in their way; slow ones just push.
  _runOver() {
    const p = new THREE.Vector3();
    for (const v of this.vehicles) {
      const b = v.body;
      const [W, H, L] = v.def.dims;
      const reach = Math.hypot(W, L) / 2 + 0.6;
      for (const s of this.soldiers) {
        if (!s.alive || s.vehicle) continue;
        const sb = s.body;
        const dx = sb.x - b.position.x,
          dz = sb.z - b.position.z;
        if (dx * dx + dz * dz > reach * reach) continue;
        v.worldToModel(p.set(sb.x, sb.y + 0.5, sb.z), p);
        const r = 0.35;
        if (p.y < -0.3 || p.y > H + 0.3) continue;
        const ox = W / 2 + r - Math.abs(p.x),
          oz = L / 2 + r - Math.abs(p.z);
        if (ox <= 0 || oz <= 0) continue;
        // Relative speed of the vehicle where it touches the soldier.
        const vel = b.pointVelocity(new THREE.Vector3(sb.x, sb.y + 0.5, sb.z), new THREE.Vector3());
        const rel = Math.hypot(vel.x - sb.vx, vel.z - sb.vz);
        if (rel > 2.2) {
          const dmg = 2 * rel * rel * Math.pow(v.def.mass / 1000, 0.3);
          s.damage(dmg, { kind: 'vehicle', attacker: v.driver || v.lastDriver, vehicle: v, weapon: { name: v.def.name } });
        }
        // Push out sideways (or ahead) of the hull.
        const side = ox < oz ? new THREE.Vector3(Math.sign(p.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(p.z) || 1);
        side.applyQuaternion(b.quaternion);
        const push = Math.min(ox, oz) + 0.02;
        sb.x += side.x * push;
        sb.z += side.z * push;
        sb.vx = vel.x * 0.8 + side.x * 2;
        sb.vz = vel.z * 0.8 + side.z * 2;
      }
    }
  }

  _raycastDynamic(ox, oy, oz, dx, dy, dz, max, p) {
    let best = this._raycastSoldiers(ox, oy, oz, dx, dy, dz, max, p);
    for (const v of this.vehicles) {
      if (v === p.ignoreTarget || (v === p.ignoreVehicle && p.distance < 40)) continue;
      const hit = v.raycastArmor(ox, oy, oz, dx, dy, dz, best ? best.t : max);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    return best;
  }

  _raycastSoldiers(ox, oy, oz, dx, dy, dz, max, p) {
    let best = null;
    for (const s of this.soldiers) {
      if (s === p.owner || s === p.ignoreTarget) continue;
      // Crews inside tanks are behind armor (hit through the vehicle damage model).
      if (s.vehicle && s.vehicle.def.kind === 'tracked') continue;
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
    if (info.target?.isVehicle) {
      this._vehicleImpact(p, info);
      return;
    }
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
        // Hit: the HUD points to where the shot came from.
        if (info.target === this.player.soldier && dmg > 0) this.hud?.shotFrom?.(p.ox, p.oz, 'hit', dmg / 40);
      }
      return;
    }
    if (info.kind === 'exit') {
      fx.impact({ ...info, energy: info.energy * 0.3 });
      return;
    }
    // A hit on a tree trunk: the splinters and the hole come off the round bark, not on the face of
    // the box standing in for it.
    const tr = info.box?.trunk;
    if (tr) {
      const dx = info.x - tr.x,
        dz = info.z - tr.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-4) {
        info.nx = dx / d;
        info.ny = 0;
        info.nz = dz / d;
        info.x = tr.x + info.nx * tr.r;
        info.z = tr.z + info.nz * tr.r;
      }
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

  // A bullet or shell hitting a vehicle's armor.
  _vehicleImpact(p, info) {
    const v = info.target;
    const fx = this.effects;
    const wasAlive = v.alive;
    const res = v.onHit(info, p);
    // Where it struck stays marked: a hole, a gouge or a scorch.
    addHitMark(v, info, p.ammo);
    const big = p.ammo.diameter >= 0.019 || p.ammo.heat;
    fx.impact({ ...info, effect: 'sparks', energy: big ? info.energy * 0.05 : info.energy });
    if (info.kind === 'ricochet') this.audio?.play?.('ricochet', info, { volume: big ? 1 : 0.6 });
    else this.audio?.impact?.('armor', info.x, info.y, info.z, big ? 20000 : info.energy);
    if (big && info.kind === 'penetrate') {
      fx.spawn?.('spark', info.x, info.y, info.z, { count: 30, dir: [info.dirX * 4, info.dirY * 4, info.dirZ * 4], spread: 3, speed: 3 });
      fx.flashLight?.(info.x, info.y, info.z, 12, 8, 0.06);
    }
    if (info.detonate) this.explode(info.x, info.y, info.z, p, v);
    // Our own vehicle hit: point to where it came from (a shell or a hole
    // through the armor in red; small arms rattling off it, pale).
    if (v === this.player?.soldier.vehicle && p.owner !== this.player.soldier) this.hud?.shotFrom?.(p.ox, p.oz, big || info.kind === 'penetrate' ? 'hit' : 'near', big ? 1 : 0.6);
    if (p.owner === this.player?.soldier && big) {
      const msg = info.kind === 'penetrate' ? 'Penetration' : info.kind === 'ricochet' ? 'Ricochet' : 'No penetration';
      this.hud?.flash(`${msg} (${Math.round(info.penMM || 0)} mm vs ${Math.round(info.effMM || 0)} mm)`, 2);
      if (info.kind === 'penetrate') this.hud.hitMarker(wasAlive && !v.alive ? 2 : 1);
    }
    this.mode.onImpact?.(p, info);
    return res;
  }

  onVehicleDestroyed(v, attacker, cause) {
    const p = v.body.position;
    const big = v.def.kind === 'tracked';
    if (v.isBike) {
      // A bicycle is simply wrecked; a motorcycle's petrol tank goes up in a
      // burst of flame, not a blast.
      if (!v.def.pedal) {
        this.effects.spawn('fire', p.x, p.y + 0.3, p.z, { count: 5, spread: 1, speed: 1.5, scale: 0.7 });
        this.effects.spawn('smoke', p.x, p.y + 0.5, p.z, { count: 3, spread: 1, speed: 1, scale: 0.6 });
        this.effects.flashLight(p.x, p.y + 0.6, p.z, 10, 8, 0.25);
        this.audio?.play?.('fuelWhoosh', p, { volume: 0.9 });
        charModel(v);
      }
    } else {
      this.effects.explosion(p.x, p.y + 0.5, p.z, big ? (cause === 'ammo' ? 4 : 2.5) : 1.6);
      this.audio?.explosion?.('shellExplosion', p.x, p.y, p.z);
      charModel(v);
    }
    this.hud?.killFeed(attacker, { name: v.def.name, faction: v.def.faction }, { kind: 'vehicle', weapon: { name: cause } });
    if (attacker === this.player?.soldier) this.hud?.hitMarker(2);
    // An ammunition explosion throws the turret off.
    if (cause === 'ammo' && v.model.parts?.turret) {
      v.turretFly = { vy: 9 + Math.random() * 5, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, spin: (Math.random() - 0.5) * 4 };
    }
  }

  onVehicleEvent(v, kind, attacker) {
    if (attacker === this.player?.soldier) this.hud?.flash(kind === 'track' ? 'Track destroyed' : kind === 'fire' ? 'Target on fire' : kind, 2);
    if (this.player?.soldier.vehicle === v) this.hud?.flash(kind === 'track' ? 'Our track is broken!' : kind === 'fire' ? 'We are on fire!' : kind, 2.5);
  }

  _onExpire(p, why) {
    if (why === 'fuse' && p.ammo.explosive) this.explode(p.x, p.y, p.z, p);
  }

  // Supersonic bullets crack as they pass the listener; slow ones whiz.
  _onSegment(p, x0, y0, z0, x1, y1, z1) {
    if (p.ammo.thrown) return;
    this._botsNearMiss(p, x0, y0, z0, x1, y1, z1);
    const me = this.player?.soldier;
    if (!me || p.owner === me) return;
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
      // An enemy bullet close by: a pale mark points to where it came from.
      if (miss < 6 && !p.ammo.fragment && (!p.owner || p.owner.team !== me.team)) this.hud?.shotFrom?.(p.ox, p.oz, 'near', 1 - miss / 6);
    }
  }

  // Bullets cracking past bots keep their heads down and give the shooter away.
  _botsNearMiss(p, x0, y0, z0, x1, y1, z1) {
    const sx = x1 - x0,
      sy = y1 - y0,
      sz = z1 - z0;
    const len2 = sx * sx + sy * sy + sz * sz;
    if (len2 < 1e-9) return;
    const mx = (x0 + x1) / 2,
      mz = (z0 + z1) / 2;
    const reach2 = len2 / 4 + 25;
    for (const s of this.soldiers) {
      if (!s.brain || !s.alive || s === p.owner || (p.owner && s.team === p.owner.team)) continue;
      const b = s.body;
      if ((b.x - mx) ** 2 + (b.z - mz) ** 2 > reach2) continue;
      const ey = b.y + 1.2;
      const t = ((b.x - x0) * sx + (ey - y0) * sy + (b.z - z0) * sz) / len2;
      if (t < 0 || t > 1) continue;
      const miss = Math.hypot(x0 + sx * t - b.x, y0 + sy * t - ey, z0 + sz * t - b.z);
      if (miss > 4) continue;
      s.suppression = Math.min(1, (s.suppression || 0) + (1 - miss / 4) * 0.25);
      if (p.owner) s.brain.aware.set(p.owner, Math.min(1.2, (s.brain.aware.get(p.owner) || 0) + 0.35));
      if (!s.brain.target) s.brain.lookYaw = Math.atan2(sx, sz);
    }
  }

  // HE explosion: blast and fragments (fragments are real projectiles).
  explode(x, y, z, p, skipVehicle = null) {
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
      if (blast > 1 && s === this.player?.soldier) this.hud?.shotFrom?.(x, z, 'hit', blast / 40);
    }
    // Vehicles: blast against thin-skinned ones, tracks of tanks close by.
    for (const v of this.vehicles) {
      if (!v.alive || v === skipVehicle) continue;
      const vp = v.body.position;
      const d = Math.max(0.5, Math.hypot(vp.x - x, vp.y - y, vp.z - z) - Math.hypot(...v.def.dims) / 4);
      if (d > ex.radius * 1.5) continue;
      const armored = v.def.kind === 'tracked';
      v.damage((ex.blast * (armored ? 60 : 900)) / (d * d), p.owner, 'blast');
    }
    // Fragments.
    const n = Math.min(60, ex.fragments || 30);
    const frag = { diameter: 0.004, mass: 0.0008, bc: 0.015, drag: 'G1', maxAge: 1.5, fragment: true };
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

  // The player hurt: a red flash at the edges, the view jolts, and he grunts.
  onDamage(s, amount) {
    if (s !== this.player?.soldier) return;
    this.hud?.damage(amount);
    this.player.flinch?.(amount);
    if (amount >= 4) this.audio?.play?.('hurtGrunt', null, { volume: Math.min(1, 0.45 + amount / 60) });
  }

  // Scores as in the original game: +5 a kill, -10 a team kill, -1 a suicide.
  onDeath(s, cause) {
    const a = cause?.attacker;
    if (a && a !== s) {
      if (a.team !== s.team) {
        a.kills++;
        a.score += 5;
      } else a.score -= 10;
    } else if (a === s) s.score -= 1;
    this.hud?.killFeed(a, s, cause);
  }

  // Spent case thrown out of the player's gun (from the ejection port).
  spawnCasing(pos, w, quat) {
    if (!pos || !quat) return;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const b = this.player.soldier.body;
    this.casings.ejectCase(pos, right, up, back, w.ammo, new THREE.Vector3(b.vx, b.vy, b.vz));
  }

  // The M1 Garand's en-bloc clip pinging out.
  spawnClip(pos) {
    if (!pos) return;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const b = this.player.soldier.body;
    this.casings.ejectClip(pos, up, new THREE.Vector3(b.vx, b.vy, b.vz));
  }

  // --- rendering --------------------------------------------------------------------
  render(frameDt) {
    const input = this.input;
    if (this.cameraMode === 'spectate') this._spectate(frameDt);
    else this.player.frameInput(frameDt);
    input.endFrame();
    for (const v of this.vehicles) v.syncModel(frameDt);
    if (this.cameraMode === 'first') this.player.render(frameDt);
    else this.camera.updateMatrixWorld();

    const camPos = this.camera.position;
    const fp = this.cameraMode === 'first';
    for (const s of this.soldiers) updateSoldierView(this, s, frameDt, camPos, fp);
    (this.thrownView ||= new ThrownView(this)).update(frameDt, camPos);
    (this.projectileView ||= new ProjectileView(this)).update(frameDt);
    (this.pickupView ||= new PickupView(this)).update(camPos);
    for (const v of this.vehicles) {
      updateVehicleEffects(this, v, frameDt);
      if (this.audio) updateVehicleSound(this, v, frameDt);
    }
    if (this.audio) {
      const c = this.camera;
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
      const u = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
      this.audio.setListener(c.position.x, c.position.y, c.position.z, f.x, f.y, f.z, u.x, u.y, u.z);
    }
    this.world.update(this.time, camPos);
    this.world.shadows.update();
    this.effects.update(frameDt, camPos, this.world.fogColor);
    if (!this.paused) this.casings.update(frameDt);
    const colors = FACTION_TRACERS;
    const cp = this.camera.position;
    const trails = this.settings.get('bulletTrails') ? { x: cp.x, y: cp.y, z: cp.z, skip: this.player?.soldier } : null;
    this.effects.updateTracers(this.projectiles.active, (p) => colors[p.owner?.faction] || colors.GE, trails);
    this.hud.update(frameDt);
    const vm = this.cameraMode === 'first' && !this.player.soldier.vehicle ? this.player.viewmodel : null;
    this.pipeline.grade.uniforms.uDamage.value = clamp(this.hud.damageFlash, 0, 1);
    // Bleeding hard or nearly dead: the edges of the view blur.
    const me = this.player?.soldier;
    this.pipeline.grade.uniforms.uBlur.value = me?.alive ? clamp(me.bleed / 2.5, 0, 0.6) + (me.health < 25 ? 0.25 : 0) : 0;
    // (The first-person gun and arms only while they are shown: not when killed,
    // scoped, or seen from outside.)
    const fpv = vm?.visible ? vm : null;
    this.pipeline.render(this.world.scene, this.camera, fpv?.scene, fpv?.camera, this.time, { aim: fpv ? fpv.aim : 0, dt: frameDt });
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
