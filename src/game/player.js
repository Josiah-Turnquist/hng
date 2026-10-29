// The local player: turns keyboard and mouse into soldier actions, runs the
// first-person camera and weapon, and fires real projectiles from the muzzle.
import { badgeValue } from './badges.js';
import * as THREE from 'three';
import { STANCE } from '../actors/body.js';
import { ViewModel } from '../weapons/viewmodel.js';
import { VehicleController } from './vehicleControl.js';
import { clamp, damp, gaussRandom, DEG } from '../core/math.js';
import { hasGrenade, startThrow, releaseThrow, lookAim } from './throwing.js';
import { meleeOf, startAttack, canAttack } from './melee.js';

const BASE_SENS = 0.0022; // radians per mouse pixel at sensitivity 1 and default FOV
const NATURAL_FOV = 31.6; // degrees: what "1x" looks like on a typical monitor (for scopes)
const _nv = new THREE.Vector3();

export class PlayerController {
  constructor(game, soldier) {
    this.game = game;
    this.soldier = soldier;
    this.input = game.input;
    this.camera = game.camera;
    this.settings = game.settings;
    this.viewmodel = new ViewModel(game.world.textures, soldier.faction, game.world.scene.environment);
    this.look = { yaw: soldier.yaw, pitch: 0 };
    this.sway = { yaw: 0, pitch: 0 };
    this.swayT = Math.random() * 100;
    this.drift = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
    this.holdingBreath = false;
    this.breathHold = 0; // seconds held
    this.breathDebt = 0;
    this.adsTime = 0;
    this.camBob = 0;
    this.camBobT = 0;
    this.landDip = 0;
    this.fovCurrent = this.baseFov;
    this.scoped = false;
    this.lightLevel = 1;
    this.ambientLevel = 1;
    this.lastLook = [0, 0];
    this.switchTo = -1;
    this.lastWeapon = -1; // to go back to after throwing the last grenade
    this.backAfterThrow = false;
    this.toggleCrouchState = false;
    this.camShake = 0;
    this.kick = { p: 0, y: 0, vp: 0, vy: 0 }; // view jolt from being hit (rad, rad/s)
    this.eye = new THREE.Vector3();
    this.vehicleCtl = new VehicleController(this);
    this._equip(soldier.current);
  }

  // The nearest vehicle within reach on foot (1.8 m from its outline) and the
  // seat you would take (driver's first; -1 when all are taken), or null.
  nearestVehicle() {
    const s = this.soldier;
    const b = s.body;
    let best = null,
      bestD = 1.8;
    const p = _nv;
    for (const v of this.game.vehicles || []) {
      if (!v.alive) continue;
      // Distance from the soldier to the vehicle's outline.
      v.worldToModel(p.set(b.x, b.y + 1, b.z), p);
      const [W, H, L] = v.def.dims;
      const dx = Math.max(0, Math.abs(p.x) - W / 2);
      const dz = Math.max(0, Math.abs(p.z) - L / 2);
      const dy = Math.max(0, p.y - H - 0.5, -0.5 - p.y);
      const d = Math.hypot(dx, dy, dz);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best ? { v: best, seat: best.freeSeat(0) } : null;
  }

  // Hit: the view jolts up and to one side, then settles back (the aim isn't lost).
  flinch(amount) {
    const k = clamp(amount / 35, 0.25, 1.3);
    // (About 2 to 3 degrees for a rifle hit to the body.)
    this.kick.vp += (0.8 + Math.random() * 0.6) * k;
    this.kick.vy += (Math.random() - 0.5) * 1.4 * k;
    // The gun in your hands is knocked once too, and springs back.
    this.viewmodel.jolt(k);
  }

  // A weapon on the ground within reach, unless a vehicle is nearer.
  nearestPickup() {
    const near = this.game.pickups?.nearest(this.soldier);
    if (!near) return null;
    const v = this.nearestVehicle();
    if (v && near.dist > 0.9) return null;
    return near.d;
  }

  // Pick it up: it goes in its slot and in your hands; your own is left there.
  _tryPickup() {
    const d = this.nearestPickup();
    if (!d) return false;
    const s = this.soldier;
    const cur = s.weapon;
    if (cur?.state === 'reloading') cur.cancelReload();
    cur?.setTrigger(false);
    if (s.throwing) return false;
    const slot = this.game.pickups.take(s, d);
    if (slot === null) return false;
    const prev = s.current;
    s.current = -1; // (so the equip below counts as a change)
    this._equip(slot);
    this.lastWeapon = prev;
    this.game.hud?.flash(`Picked up ${s.weapon.def.name}`, 1.5);
    this.game.audio?.play?.('weaponHandling', null, { volume: 0.8 });
    return true;
  }

  // Get into the nearest vehicle within reach.
  _tryEnterVehicle() {
    const s = this.soldier;
    const near = this.nearestVehicle();
    if (!near) return false;
    const { v: best, seat } = near;
    if (seat < 0) {
      this.game.hud?.flash('No free seat');
      return false;
    }
    const w = s.weapon;
    if (w?.state === 'reloading') w.cancelReload();
    w?.setTrigger(false);
    s.aiming = false;
    if (!best.enter(s, seat)) return false;
    this.vehicleCtl.entered(best);
    this.game.hud?.flash(`${best.def.name}: ${best.seats[seat].name}`);
    this.game.audio?.play?.('weaponHandling', best.body.position, { volume: 0.8, rate: 0.7 });
    return true;
  }

  exitedVehicle(v) {
    v.model.root.visible = true;
    const f = v.forward;
    this.look.yaw = Math.atan2(-f.x, -f.z);
    this.look.pitch = 0;
    this.fovCurrent = -1;
  }

  get baseFov() {
    // Settings store a horizontal-feeling FOV; convert to vertical for a 16:9 screen.
    const h = this.settings.get('fov') * DEG;
    return (2 * Math.atan(Math.tan(h / 2) / (16 / 9))) / DEG + 12;
  }

  _equip(index) {
    const s = this.soldier;
    const w = s.weapons[index];
    if (!w) return;
    // (Quickdraw: game/badges.js.)
    this.viewmodel.swapRate = 3.2 / badgeValue(s, 'quickdraw', 1);
    if (index !== s.current) this.lastWeapon = s.current;
    s.current = index;
    this.viewmodel.setWeapon(w.def, this.game.world.atmosphere);
    this.viewmodel.setIrons(w.useIrons);
    this.viewmodel.setZero(w.zeroIndex);
    this.game.hud?.weaponChanged(w);
  }

  // Called once per rendered frame before the fixed-step simulation runs.
  frameInput(dt) {
    const s = this.soldier;
    const input = this.input;
    if (!s.alive) {
      input.takeMouse();
      input.takeWheel();
      this.aimToggled = false;
      return;
    }
    if (s.vehicle) {
      this.aimToggled = false;
      this.vehicleCtl.frameInput(dt);
      return;
    }
    if (input.hit('use') && (this._tryPickup() || this._tryEnterVehicle())) return;
    const w = s.weapon;
    // --- Looking -------------------------------------------------------------------
    const [mx, my] = input.takeMouse();
    const zoom = this.baseFov / this.fovCurrent;
    let sens = BASE_SENS * this.settings.get('mouseSensitivity') / zoom;
    if (s.aiming) sens *= this.settings.get('adsSensitivity');
    const inv = this.settings.get('invertY') ? -1 : 1;
    const dyaw = -mx * sens;
    const dpitch = -my * sens * inv;
    this.look.yaw += dyaw;
    this.look.pitch = clamp(this.look.pitch + dpitch, -1.45, 1.45);
    // Lying prone limits how far up you can look.
    if (s.body.stance === STANCE.PRONE) this.look.pitch = clamp(this.look.pitch, -0.6, 0.55);
    this.lastLook = [dyaw / Math.max(dt, 1e-3) * 0.02, dpitch / Math.max(dt, 1e-3) * 0.02];

    // --- Stance and movement -----------------------------------------------------------
    const b = s.body;
    const it = s.intent;
    it.mz = (input.is('back') ? 1 : 0) - (input.is('forward') ? 1 : 0);
    it.mx = (input.is('right') ? 1 : 0) - (input.is('left') ? 1 : 0);
    it.walk = input.is('walk');
    it.leanL = input.is('leanLeft');
    it.leanR = input.is('leanRight');
    // Sprint key doubles as "hold breath" while aiming.
    it.sprint = input.is('sprint') && !s.aiming;
    if (input.hit('jump')) {
      if (b.stance !== STANCE.STAND) b.setStance(STANCE.STAND);
      else it.jump = true;
    }
    if (input.hit('crouch')) b.setStance(b.targetStance === STANCE.CROUCH ? STANCE.STAND : STANCE.CROUCH);
    if (input.hit('prone')) b.setStance(b.targetStance === STANCE.PRONE ? STANCE.CROUCH : STANCE.PRONE);
    if (it.sprint && b.targetStance !== STANCE.STAND && it.mz < 0) b.setStance(STANCE.STAND);

    // --- Weapon handling ---------------------------------------------------------------------
    // Aiming: while the aim key is held or (Settings > Controls) from one press to
    // the next. Sprinting, reloading a long gun or a grenade in hand lowers the gun.
    const canAim = !b.sprinting && s.canShoot && !(w && w.state === 'reloading' && w.def.type !== 'pistol') && !(w && (w.def.type === 'grenade' || w.def.type === 'melee'));
    if (this.settings.get('aimToggle')) {
      if (input.hit('aim')) this.aimToggled = !this.aimToggled;
      if (!canAim) this.aimToggled = false;
      s.aiming = this.aimToggled;
    } else {
      s.aiming = input.is('aim') && canAim;
    }
    this.holdingBreath = s.aiming && input.is('sprint') && this.breathDebt <= 0;

    // Slots 1 to 7 (game/defs LOADOUT_SLOTS); the wheel steps through those
    // that hold something.
    for (let k = 0; k < 7; k++) if (input.hit(`slot${k + 1}`)) this._requestSwitch(k);
    const wheel = input.takeWheel();
    if (wheel && w) {
      if (s.aiming && w.sight?.ranges.length > 1) {
        if (w.changeZero(-Math.sign(wheel))) this.viewmodel.setZero(w.zeroIndex);
      } else {
        const n = s.weapons.length;
        for (let k = 1; k < n; k++) {
          const i = (s.current + (wheel > 0 ? k : n - k)) % n;
          if (s.weapons[i]) {
            this._requestSwitch(i);
            break;
          }
        }
      }
    }
    if (w && input.hit('zeroUp') && w.changeZero(1)) this.viewmodel.setZero(w.zeroIndex);
    if (w && input.hit('zeroDown') && w.changeZero(-1)) this.viewmodel.setZero(w.zeroIndex);
    // The fire mode key: on a rifle with one fire mode and a scope that leaves
    // the iron sights clear, it switches between the scope and the irons.
    if (w && input.hit('fireMode') && (w.def.modes.length > 1 || !w.toggleSights())) w.cycleMode();
    if (w && input.hit('reload') && s.alive && !b.sprinting) {
      if (w.state === 'reloading') w.cancelReload();
      else if (w.needsCycle && w.state === 'ready') w.startBoltCycle();
      else w.startReload();
    }
    if (input.hit('bandage')) s.startBandage();
    if (input.hit('melee')) this._quickMelee();

    // Trigger. A grenade: press to pull the pin and draw back (holding cooks
    // it), let go to throw (throwing.js).
    if (w && w.def.type === 'grenade') {
      if (input.hit('fire') && !s.throwing && startThrow(s, w)) this.backAfterThrow = true;
      if (s.throwing && !input.is('fire')) releaseThrow(s, lookAim);
      w.setTrigger(false);
    } else if (w && w.def.type === 'melee') {
      // A close-combat weapon: a blow on the fire button, another as soon as
      // that one is done while it is held (melee.js).
      if (input.is('fire') && this.viewmodel.swap > 0.9) startAttack(s, w);
      w.setTrigger(false);
    } else if (w && w.def.type === 'binoculars') {
      // Binoculars: raised to the eyes, fire spots the enemy in the middle of
      // the view for the whole side (spotting.js).
      w.setTrigger(false);
      if (input.hit('fire')) this._spot();
    } else if (w) {
      w.setTrigger(input.is('fire') && s.canShoot && this.viewmodel.swap > 0.9);
    }
  }

  // The melee key: one blow with the close-combat weapon from whatever is in
  // the hands, then back to it (melee.js), as in the original game. It comes
  // up as the arm draws back for the blow.
  _quickMelee() {
    const s = this.soldier;
    const m = meleeOf(s);
    if (!m || !canAttack(s)) return;
    const i = s.weapons.indexOf(m);
    if (i === s.current) {
      startAttack(s, m);
      return;
    }
    const back = s.current;
    const cur = s.weapon;
    if (cur?.state === 'reloading') cur.cancelReload();
    cur?.setTrigger(false);
    this._equip(i);
    this.viewmodel.swap = 0.6;
    startAttack(s, m, { back });
  }

  // Spot through the binoculars, if they are up at the eyes: the line under
  // the sights names him.
  _spot() {
    const g = this.game;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const e = g.spotting?.trySpot(this.soldier, { eye: this.eye, dir, raised: this.viewmodel.aim });
    if (e) g.hud?.killConfirm(e.name, { verb: 'Spotted', quiet: true });
    return e;
  }

  _requestSwitch(i) {
    const s = this.soldier;
    // (Not with a grenade's pin pulled, nor in the middle of a blow.)
    if (i === s.current || !s.weapons[i] || s.throwing || s.melee) return;
    const cur = s.weapon;
    if (cur?.state === 'reloading') cur.cancelReload();
    cur?.setTrigger(false);
    this._equip(i);
  }

  // Fixed-step simulation for the player.
  update(dt) {
    const s = this.soldier;
    if (s.vehicle) {
      this.vehicleCtl.update(dt);
      s.update(dt);
      return;
    }
    s.yaw = this.look.yaw;
    s.pitch = this.look.pitch;
    s.update(dt);
    s.intent.jump = false;
    if (!s.alive) return;
    const w = s.weapon;
    if (!w) return;

    // Thrown the last grenade: back to the gun you had before.
    if (this.backAfterThrow && !s.throwing) {
      this.backAfterThrow = false;
      if (w.def.type === 'grenade' && !hasGrenade(w)) this._requestSwitch(this.lastWeapon >= 0 && s.weapons[this.lastWeapon] ? this.lastWeapon : 0);
    }

    const shots = w.update(dt);
    for (let i = 0; i < shots; i++) this.fire(w);
    for (const ev of w.takeEvents()) this._weaponEvent(w, ev);
  }

  _weaponEvent(w, ev) {
    const g = this.game;
    switch (ev.type) {
      case 'step':
        this.viewmodel.playStep(ev.name, ev.t);
        break;
      case 'reloadCancel':
        this.viewmodel.stopAction();
        break;
      case 'sound':
        g.audio?.play(ev.id, null, { volume: 0.7 });
        break;
      case 'eject':
        g.spawnCasing?.(this.viewmodel.ejectWorld, w, this.viewmodel.gun?.root.quaternion);
        break;
      case 'clipEject':
        g.spawnClip?.(this.viewmodel.ejectWorld, w);
        break;
      case 'mode':
        g.audio?.play('fireModeSwitch', null, { volume: 0.6 });
        g.hud?.flash(`Fire mode: ${ev.mode === 'slow' ? 'slow auto' : ev.mode}`);
        break;
      case 'zero':
        g.hud?.flash(`Sight: ${ev.range} ${w.sight.unit}`);
        break;
      case 'sights':
        this.viewmodel.setIrons(ev.irons);
        this.viewmodel.setZero(w.zeroIndex);
        g.audio?.play('fireModeSwitch', null, { volume: 0.4 });
        g.hud?.flash(ev.irons ? `Iron sights: ${w.zeroRange} ${w.sight.unit}` : `Scope: ${w.zeroRange} ${w.sight.unit}`);
        break;
      case 'dry':
        break;
    }
  }

  // Fire one round from the muzzle along the bore.
  fire(w) {
    const g = this.game;
    const s = this.soldier;
    const vm = this.viewmodel;
    const d = w.def;
    const ammo = w.ammo;
    // Direction: the real bore direction of the gun as it's held right now.
    const dir = vm.boreWorld.clone();
    this._scatter(dir, this.spread(w, vm.aim > 0.85));

    // Start at the muzzle, unless the muzzle is through a wall (then from the eye).
    const muzzle = vm.muzzleWorld.clone();
    const eye = this.eye;
    const toM = muzzle.clone().sub(eye);
    const dist = toM.length();
    const hit = g.world.collision.raycast(eye.x, eye.y, eye.z, toM.x / dist, toM.y / dist, toM.z / dist, dist, g.tmpHit, 2, true);
    const start = hit ? eye.clone().addScaledVector(toM, (g.tmpHit.t - 0.02) / dist) : muzzle;

    // Muzzle velocity varies a little from round to round.
    const mv = d.mv * (1 + gaussRandom(0, 0.006));
    const tracer = d.tracerEvery > 0 && w.shotsFired % d.tracerEvery === 0;
    // Moving with the shooter: the bullet inherits the soldier's velocity.
    g.projectiles.fire({
      x: start.x,
      y: start.y,
      z: start.z,
      vx: dir.x * mv + s.body.vx,
      vy: dir.y * mv + s.body.vy,
      vz: dir.z * mv + s.body.vz,
      ammo,
      owner: s,
      weapon: d,
      tracer,
    });
    g.ribbonTally?.shot(d, s);

    // Recoil from momentum: bullet + powder gas push the gun back.
    const gasV = mv > 600 ? 1300 : mv * 1.5;
    const impulse = ammo.mass * mv + (ammo.powder || 0) * gasV;
    const supported = s.supported || (d.bipod && s.body.stance === STANCE.PRONE);
    const stanceK = s.body.stance === STANCE.PRONE ? 0.6 : s.body.stance === STANCE.CROUCH ? 0.85 : 1;
    const massK = Math.sqrt(4 / Math.max(1.5, d.mass)); // heavier guns kick less
    vm.shot(impulse * massK * stanceK, d, supported);
    // Part of the kick stays: automatic fire climbs unless you pull down.
    const auto = w.mode === 'auto' || w.mode === 'slow';
    const r = d.recoil || { rise: 1, side: 0.3 };
    const climb = impulse * 0.00105 * r.rise * massK * stanceK * (supported ? 0.3 : 1) * (auto ? 1 : 0.35) * badgeValue(s, 'tightGrip', 1);
    this.look.pitch += climb;
    this.look.yaw += gaussRandom(0, climb * r.side * 0.8);
    this.camShake = Math.min(1, this.camShake + impulse * 0.01);

    // Muzzle effects and sound.
    g.effects.muzzle(muzzle.x, muzzle.y, muzzle.z, dir.x, dir.y, dir.z, Math.min(2, impulse / 8));
    g.audio?.gunshot(d.sound, muzzle.x, muzzle.y, muzzle.z, { isLocal: true });
    g.onShot?.(s, w, start, dir);
    s.lastShotTime = g.time;
  }

  // How widely shots scatter right now (one standard deviation, radians). From
  // the hip the gun isn't aligned with the eye: a pointing error, less crouched
  // or prone, more on the move. Always: the mechanical accuracy of gun and
  // ammunition (MOA -> radians, as a spread), wider with a hot barrel.
  spread(w, aimed) {
    const s = this.soldier;
    const d = w.def;
    const hs = d.hipStance;
    let err = aimed ? 0 : d.hipError * DEG * 0.5 * (s.body.stance === STANCE.PRONE ? 0.6 * (hs?.prone ?? 1) : s.body.stance === STANCE.CROUCH ? 0.8 * (hs?.crouch ?? 1) : hs?.stand ?? 1) * (1 + s.body.moving * 0.25) * badgeValue(s, 'pointShooter', 1);
    err = Math.hypot(err, (d.accuracy || 0) * 0.000291 * 0.42);
    if (w.heat > 120) err *= 1 + (w.heat - 120) / 150;
    return err;
  }

  _scatter(dir, sigma) {
    if (sigma <= 0) return;
    const up = Math.abs(dir.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
    dir.addScaledVector(right, gaussRandom(0, sigma)).addScaledVector(up2, gaussRandom(0, sigma)).normalize();
  }

  // Per-frame visuals: camera, sway, viewmodel.
  render(dt, alpha) {
    const s = this.soldier;
    const b = s.body;
    const cam = this.camera;
    const w = s.weapon;
    if (s.vehicle) {
      this.vehicleCtl.render(dt);
      this.eye.copy(cam.position);
      this.viewmodel.visible = false;
      this.scoped = false;
      this.fovCurrent = cam.fov;
      this.deathCam = null;
      return;
    }
    if (!s.alive) {
      // Killed: the view drifts up and away from where you fell.
      const dc = (this.deathCam ??= { yaw: this.look.yaw + Math.PI, t: 0 });
      dc.t += dt;
      dc.yaw += dt * 0.12;
      const target = new THREE.Vector3(b.x, b.y + 0.4, b.z);
      const hips = s.model?.bones?.[0];
      if (hips) hips.getWorldPosition(target);
      const dist = 2.5 + Math.min(3, dc.t * 0.8);
      cam.position.set(target.x + Math.sin(dc.yaw) * dist, target.y + 1.2 + Math.min(2.5, dc.t * 0.5), target.z + Math.cos(dc.yaw) * dist);
      const gy = this.game.world.hf.getHeight(cam.position.x, cam.position.z) + 0.3;
      if (cam.position.y < gy) cam.position.y = gy;
      cam.lookAt(target);
      cam.rotation.setFromQuaternion(cam.quaternion, 'YXZ');
      if (Math.abs(cam.fov - this.baseFov) > 0.01) {
        cam.fov = this.baseFov;
        cam.updateProjectionMatrix();
      }
      this.fovCurrent = cam.fov;
      cam.updateMatrixWorld();
      this.eye.copy(cam.position);
      this.viewmodel.visible = false;
      this.scoped = false;
      return;
    }
    this.deathCam = null;

    // Eye position with head bob and landing dip.
    b.eyePosition(this.eye);
    const moving = b.onGround ? Math.min(1, b.moving / 4) : 0;
    this.camBobT += dt * (b.sprinting ? 11 : 7 + b.moving);
    this.camBob = damp(this.camBob, moving * (s.aiming ? 0.3 : 1), 6, dt);
    if (b.landImpact > 0) {
      this.landDip = Math.max(this.landDip, b.landImpact);
      b.landImpact = 0;
    }
    this.landDip = damp(this.landDip, 0, 5, dt);
    const bobY = Math.sin(this.camBobT * 2) * 0.022 * this.camBob - this.landDip * 0.12;
    const bobX = Math.cos(this.camBobT) * 0.014 * this.camBob;

    // Sway: breathing, pulse, slow drift, fatigue; less when crouched or prone.
    this._updateSway(dt);
    const aimBlend = this.viewmodel.aim;
    this.camShake = damp(this.camShake, 0, 8, dt);
    const shakeP = (Math.random() - 0.5) * this.camShake * 0.004;
    const shakeY = (Math.random() - 0.5) * this.camShake * 0.004;
    // The jolt of a hit: a stiff spring back to where you were looking.
    const kk = this.kick;
    for (const [x, v] of [['p', 'vp'], ['y', 'vy']]) {
      kk[v] += (-kk[x] * 140 - kk[v] * 16) * Math.min(dt, 0.05);
      kk[x] += kk[v] * Math.min(dt, 0.05);
    }

    const right = new THREE.Vector3(Math.cos(this.look.yaw), 0, -Math.sin(this.look.yaw));
    cam.position.copy(this.eye).addScaledVector(right, bobX);
    cam.position.y += bobY;
    const rollLean = -b.lean * 0.17;
    cam.rotation.set(
      this.look.pitch + this.sway.pitch * aimBlend + shakeP + kk.p,
      this.look.yaw + this.sway.yaw * aimBlend + shakeY + kk.y,
      rollLean + Math.sin(this.camBobT) * 0.004 * this.camBob,
      'YXZ',
    );

    // Field of view: slight zoom on iron sights (eye focusing), real magnification on scopes.
    let fov = this.baseFov;
    const scope = w?.scope;
    if (scope) {
      const scopeFov = (2 * Math.atan(Math.tan((NATURAL_FOV * DEG) / 2) / scope.mag)) / DEG;
      fov = THREE.MathUtils.lerp(this.baseFov, scopeFov, Math.pow(aimBlend, 3));
    } else {
      fov = this.baseFov / (1 + 0.18 * aimBlend);
    }
    if (Math.abs(fov - this.fovCurrent) > 0.01) {
      this.fovCurrent = fov;
      cam.fov = fov;
      cam.updateProjectionMatrix();
      this.game.world.shadows.updateFrustums();
    }
    this.scoped = !!scope && aimBlend > 0.93;
    cam.updateMatrixWorld();

    // Light level at the eye for the first-person gun (sun blocked by a wall/roof?).
    this._probeLight(dt);

    // Weapon blocked by a wall right in front?
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const len = w ? Math.min(0.9, w.def.length * 0.7) : 0.5;
    const blocked = this.game.world.collision.raycast(this.eye.x, this.eye.y, this.eye.z, fwd.x, fwd.y, fwd.z, len, this.game.tmpHit, 1, false);

    const sky = this.game.world.sky;
    this.viewmodel.visible = !this.scoped && s.alive && this.game.cameraMode === 'first';
    this.viewmodel.garandModel = this.settings.get('garandModel');
    this.viewmodel.update(dt, cam, {
      aiming: s.aiming,
      sprinting: b.sprinting,
      speed: b.moving,
      onGround: b.onGround,
      stance: b.stance,
      lookDelta: this.lastLook,
      sway: this.sway,
      blocked,
      sunDir: sky.sunDir,
      sunColor: sky.sun.color,
      sunIntensity: sky.sun.intensity,
      light: this.lightLevel,
      ambient: this.ambientLevel,
      throwing: s.throwing,
      melee: s.melee,
      empty: w?.def.type === 'grenade' && !hasGrenade(w) && !s.throwing,
      emptyTube: w?.def.type === 'launcher' && w.loaded === 0 && w.state !== 'reloading',
    });
    this.lastLook = [0, 0];
    this.viewmodel.camera.fov = 52;
    this.viewmodel.camera.aspect = cam.aspect;
    this.viewmodel.camera.updateProjectionMatrix();
  }

  _updateSway(dt) {
    const s = this.soldier;
    const b = s.body;
    const w = s.weapon;
    if (!w) return;
    const mass = w.def.mass;
    // Stance and support.
    let k = b.stance === STANCE.PRONE ? 0.25 : b.stance === STANCE.CROUCH ? 0.55 : 1;
    if (s.supported && w.def.bipod) k *= 0.35;
    // Heavy guns are hard to hold up for long standing.
    if (b.stance === STANCE.STAND) k *= Math.sqrt(Math.max(1, mass / 4));
    // Exertion: breathing faster and harder after running.
    const breath = b.breath;
    k *= 1 + s.armWound * 1.5;
    // Holding the gun up gets tiring after a while.
    this.adsTime = s.aiming ? this.adsTime + dt : Math.max(0, this.adsTime - dt * 2);
    const fatigue = Math.max(0, this.adsTime - 8) * 0.06;
    // Hold breath: steadier for ~6 s, then you must gasp.
    if (this.holdingBreath) {
      this.breathHold += dt;
      if (this.breathHold > 6.5 * badgeValue(s, 'deadEye', 1)) {
        this.breathDebt = 3;
        this.holdingBreath = false;
      }
    } else {
      this.breathHold = Math.max(0, this.breathHold - dt * 2);
      this.breathDebt = Math.max(0, this.breathDebt - dt);
    }
    const breathAmp = this.holdingBreath ? 0.12 : this.breathDebt > 0 ? 2.2 : 1;
    const rate = 0.22 + breath * 0.45; // breaths per second
    this.swayT += dt;
    const t = this.swayT;
    const breathP = Math.sin(t * rate * 2 * Math.PI) * (0.0016 + breath * 0.004) * breathAmp;
    const breathY = Math.sin(t * rate * Math.PI + 1.3) * (0.0006 + breath * 0.0018) * breathAmp;
    // Slow drift (random walk pulled back to center) and a fine tremor.
    const dr = this.drift;
    const driftAmp = 0.0012 * (1 + fatigue + breath);
    dr.vy += (gaussRandom() * driftAmp * 6 - dr.yaw * 2.5 - dr.vy * 1.6) * dt;
    dr.vp += (gaussRandom() * driftAmp * 6 - dr.pitch * 2.5 - dr.vp * 1.6) * dt;
    dr.yaw += dr.vy * dt;
    dr.pitch += dr.vp * dt;
    const pulse = Math.sin(t * (1.2 + breath * 1.3) * 2 * Math.PI) * 0.00018 * (1 + breath * 2);
    // Walking while aiming shakes a lot.
    const walk = Math.min(1, b.moving / 2) * 0.006;
    const walkP = Math.sin(t * 7.5) * walk,
      walkY = Math.cos(t * 3.75) * walk;
    // (A hit knocks the view and the gun once, in flinch(): a new random push
    // every frame for a second after each hit read as the gun shaking.)
    this.sway.pitch = (breathP + dr.pitch + pulse + walkP) * k;
    this.sway.yaw = (breathY + dr.yaw + walkY) * k;
  }

  _probeLight(dt) {
    const w = this.game.world;
    const sd = w.sky.sunDir;
    const e = this.eye;
    const sunBlocked = w.collision.raycast(e.x, e.y, e.z, sd.x, sd.y, sd.z, 300, this.game.tmpHit, 4, true);
    const roof = w.collision.raycast(e.x, e.y, e.z, 0, 1, 0, 30, this.game.tmpHit, 4, false);
    this.lightLevel = damp(this.lightLevel, sunBlocked ? 0.08 : 1, 6, dt);
    this.ambientLevel = damp(this.ambientLevel, roof ? 0.35 : 1, 4, dt);
  }
}
