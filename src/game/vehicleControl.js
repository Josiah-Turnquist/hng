// The player inside a vehicle: driving, the tank gunner's sight and gun, the bow
// machine gun, passenger seats, and the cameras for each.
//
// Controls (like the original game): W/S throttle and brake/reverse, A/D steer,
// Space handbrake (wheeled) or coaxial MG (tanks), LMB fire, hold RMB for the
// gunner's sight, mouse wheel sets the sight range, 1/2 choose the shell, V
// switches camera, F1-F4 change seat, F gets out. On bicycles and motorcycles:
// Shift pedals hard (bicycle), Space is the rear brake, and the sidecar gunner
// lays his machine gun with the mouse.
import * as THREE from 'three';
import { clamp, damp, DEG, wrapAngle } from '../core/math.js';
import { FLAG_SIGHT, RayHit } from '../physics/collision.js';

const BASE_SENS = 0.0022;
const NATURAL_FOV = 31.6;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _v3 = new THREE.Vector3();
const _qh = new THREE.Quaternion();
const _e2 = new THREE.Euler(0, 0, 0, 'YXZ');
const _hit = new RayHit();

export class VehicleController {
  constructor(player) {
    this.player = player;
    this.game = player.game;
    this.input = player.input;
    this.camera = player.camera;
    this.view = 'third';
    this.orbit = { yaw: 0, pitch: -0.12, dist: 8 };
    this.look = { yaw: 0, pitch: 0 };
    this.sight = false;
    this.drive = 0;
    this.steer = 0;
    this.handbrake = false;
    this.wantFire = false;
    this.exitRequested = false;
    this.switchTo = -1;
    this.shake = 0;
    this.camDist = 8;
    this.aimPoint = new THREE.Vector3();
    this.gunPoint = new THREE.Vector3();
  }

  get soldier() {
    return this.player.soldier;
  }

  get vehicle() {
    return this.soldier.vehicle;
  }

  get role() {
    const v = this.vehicle;
    return v ? v.seats[this.soldier.seat]?.role || 'passenger' : null;
  }

  // Called when the player gets in.
  entered(v) {
    const f = v.forward;
    this.orbit.yaw = Math.atan2(-f.x, -f.z);
    this.orbit.pitch = -0.12;
    this.orbit.dist = v.def.kind === 'tracked' ? 9 : v.isBike ? (v.pedal ? 4 : 4.8) : 6;
    this.camDist = this.orbit.dist;
    this.idleLook = 0;
    this._eyeLocal = null;
    this._bikeT = null;
    this.look.yaw = this.look.pitch = 0;
    // On a bike he looks down the road over the lamp and front fender.
    if (v.isBike) this.look.pitch = -0.3;
    this.view = 'third';
    this.sight = false;
    if (v.aim) {
      v.aim.yaw = this.orbit.yaw + v.turretYaw;
      v.aim.pitch = 0;
    }
  }

  frameInput(dt) {
    const v = this.vehicle;
    const input = this.input;
    const s = this.player.settings;
    const [mx, my] = input.takeMouse();
    const wheel = input.takeWheel();
    if (!v) return;
    if (input.hit('use')) this.exitRequested = true;
    for (let i = 0; i < 4; i++) if (input.hit(`seat${i + 1}`)) this.switchTo = i;
    if (input.hit('camera')) this.view = this.view === 'third' ? 'first' : 'third';
    const role = this.role;
    const inv = s.get('invertY') ? -1 : 1;
    const zoom = this.player.baseFov / Math.max(1, this.camera.fov);
    const sens = (BASE_SENS * s.get('mouseSensitivity')) / Math.max(1, zoom);

    if (role === 'gunner') {
      this.sight = input.mouseDown[2] || this.view === 'first';
      if (this.sight) {
        // In the sight the mouse lays the gun directly.
        v.aim.yaw -= mx * sens * 0.6;
        v.aim.pitch = clamp(v.aim.pitch - my * sens * 0.6 * inv, -0.6, 0.7);
      } else {
        this.orbit.yaw -= mx * sens;
        this.orbit.pitch = clamp(this.orbit.pitch - my * sens * inv, -1.2, 0.6);
      }
      if (wheel && this.sight) v.setSightRange(v.sightRange - Math.sign(wheel) * v.def.gun.sight.ranges[2]);
      if (input.hit('zeroUp')) v.setSightRange(v.sightRange + v.def.gun.sight.ranges[2]);
      if (input.hit('zeroDown')) v.setSightRange(v.sightRange - v.def.gun.sight.ranges[2]);
      if (input.mousePressed[0]) this.wantFire = true;
      v.coax.trigger = input.is('jump');
      if (input.hit('ammo1')) this._ammo(v, 0);
      if (input.hit('ammo2')) this._ammo(v, 1);
      if (input.hit('ammo3')) this._ammo(v, 2);
    } else if (role === 'bowMg') {
      const mg = v.def.bowMg;
      if (this.view === 'first') {
        v.bowAim.yaw = clamp(v.bowAim.yaw - mx * sens * 0.7, -mg.traverse * DEG, mg.traverse * DEG);
        v.bowAim.pitch = clamp(v.bowAim.pitch - my * sens * 0.7 * inv, mg.elev[0] * DEG, mg.elev[1] * DEG);
      } else {
        this.orbit.yaw -= mx * sens;
        this.orbit.pitch = clamp(this.orbit.pitch - my * sens * inv, -1.2, 0.6);
      }
      v.bowMg.trigger = input.mouseDown[0];
    } else if (role === 'sidecarMg') {
      // The sidecar gun: in first person the mouse swings it; in third person it
      // follows where the camera looks.
      if (this.view === 'first') {
        const d = v.def.sidecarMg;
        v.mgAim.yaw = clamp(v.mgAim.yaw - mx * sens * 0.8, -d.traverse * DEG, d.traverse * DEG);
        v.mgAim.pitch = clamp(v.mgAim.pitch - my * sens * 0.8 * inv, d.elev[0] * DEG, d.elev[1] * DEG);
      } else {
        this.orbit.yaw -= mx * sens;
        this.orbit.pitch = clamp(this.orbit.pitch - my * sens * inv, -1.2, 0.6);
      }
      v.mg.trigger = input.mouseDown[0] && v.alive;
    } else {
      // Driver or passenger: look around.
      if (this.view === 'first') {
        this.look.yaw = clamp(this.look.yaw - mx * sens, -2.1, 2.1);
        this.look.pitch = clamp(this.look.pitch - my * sens * inv, -1.0, 0.9);
      } else {
        this.orbit.yaw -= mx * sens;
        this.orbit.pitch = clamp(this.orbit.pitch - my * sens * inv, -1.2, 0.6);
      }
    }
    if (this.soldier.seat === 0) {
      this.drive = (input.is('forward') ? 1 : 0) - (input.is('back') ? 1 : 0);
      this.steer = (input.is('right') ? 1 : 0) - (input.is('left') ? 1 : 0);
      this.handbrake = (v.def.kind === 'wheeled' || v.isBike) && input.is('jump');
      this.sprint = input.is('sprint');
    }
    // Bikes: the chase camera swings in behind when the mouse is left alone.
    this.idleLook = mx || my ? 0 : (this.idleLook || 0) + dt;
  }

  _ammo(v, i) {
    if (v.selectAmmo(i)) this.game.hud?.flash(`Loading ${v.nextAmmo}`);
  }

  // Fixed-step part: controls go to the vehicle, guns fire.
  update(dt) {
    const v = this.vehicle;
    const s = this.soldier;
    if (!v) return;
    if (this.exitRequested) {
      this.exitRequested = false;
      if (v.exit(s)) {
        this.player.exitedVehicle(v);
        return;
      }
    }
    if (this.switchTo >= 0) {
      const to = this.switchTo;
      this.switchTo = -1;
      if (to !== s.seat && to < v.seats.length) {
        if (s.seat === 0) v.driverInput(0, 0, true);
        if (v.switchSeat(s, to)) {
          this.view = 'third';
          this.game.hud?.flash(v.seats[to].name);
        }
      }
    }
    if (s.seat === 0) v.driverInput(this.drive, this.steer, this.handbrake, this.sprint);
    if (this.role === 'gunner' && this.wantFire) {
      this.wantFire = false;
      const p = v.fireMain(s);
      if (p) this.shake = 1;
      else if (!v.loaded) this.game.audio?.play?.('dryFire', null, { volume: 0.4 });
    }
    this.wantFire = false;
    // Machine guns.
    if (v.coax) {
      const n = v.coax.takeShots();
      for (let i = 0; i < n; i++) this._mgShot(v, v.coax, 'coaxMuzzle', v.boreDir(_v2));
    }
    if (v.bowMg) {
      const n = v.bowMg.takeShots();
      if (n) {
        _q.setFromEuler(_e.set(v.bowAim.pitch, v.bowAim.yaw, 0, 'YXZ')).premultiply(v.body.quaternion);
        const dir = _v2.set(0, 0, -1).applyQuaternion(_q);
        for (let i = 0; i < n; i++) this._mgShot(v, v.bowMg, 'bowMgMuzzle', dir);
      }
    }
    if (v.mg && this.role === 'sidecarMg') {
      const n = v.mg.takeShots();
      for (let i = 0; i < n; i++) this._mgShot(v, v.mg, 'mgMuzzle', v.mgDir(_v2));
    }
  }

  _mgShot(v, mg, anchor, dir) {
    this.game.vehicleMgShot(v, mg, anchor, dir, this.soldier);
  }

  // Per-frame camera.
  render(dt) {
    const v = this.vehicle;
    const cam = this.camera;
    if (!v) return;
    const role = this.role;
    this.shake = damp(this.shake, 0, 5, dt);
    let fov = this.player.baseFov;
    const up = _v2.set(0, 1, 0).applyQuaternion(v.body.quaternion);
    // Looking through a sight from inside: don't draw our own vehicle.
    v.model.root.visible = !((role === 'gunner' && this.sight) || (role === 'bowMg' && this.view === 'first'));
    if (role === 'gunner' && this.sight) {
      // Gunner's telescope: looks along the gun's line of sight, real magnification.
      const sd = v.def.gun.sight;
      const eye = v.anchorWorld('gunnerEye', _v) || v.muzzleWorld(_v);
      cam.position.copy(eye);
      const dir = v.sightDir(new THREE.Vector3());
      lookAlong(cam, dir, up);
      fov = sightFov(sd);
    } else if (role === 'bowMg' && this.view === 'first') {
      const m = v.anchorWorld('bowMgMuzzle', _v) || _v.copy(v.body.position);
      _q.setFromEuler(_e.set(v.bowAim.pitch, v.bowAim.yaw, 0, 'YXZ')).premultiply(v.body.quaternion);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(_q);
      cam.position.copy(m).addScaledVector(dir, -0.75).addScaledVector(up, 0.17);
      lookAlong(cam, dir, up);
      const sd = v.def.bowMg.sight;
      if (sd) fov = sightFov(sd);
    } else if (role === 'sidecarMg' && this.view === 'first' && v.mg) {
      // Behind the sidecar gun: from the gunner's eyes, looking along the bore.
      const dir = v.mgDir(new THREE.Vector3());
      this._bikeEye(v, cam.position);
      lookAlong(cam, dir, up);
    } else if (this.view === 'first') {
      // Seat view: turn your head inside the vehicle. On a bike the head follows
      // the heading and the slope but stays nearer level than the leaning machine.
      if (v.isBike) this._bikeEye(v, cam.position);
      else v.seatPos(this.soldier.seat, cam.position, 'eye');
      const head = v.isBike ? _qh.setFromEuler(_e2.set(v.pitch, v.yaw, -v.lean * (v.rig ? 1 : 0.7), 'YXZ')) : v.body.quaternion;
      _q.setFromEuler(_e.set(this.look.pitch, this.look.yaw, 0, 'YXZ')).premultiply(head);
      cam.quaternion.copy(_q);
      // A rider sees the lamp, bars and tank at the edge of his vision: a little
      // more of it on the screen than the usual field of view gives.
      if (v.isBike) fov += 10;
    } else {
      // Third person: orbit around the vehicle; walls and the ground pull the camera in.
      // Bikes: the camera doesn't roll with the lean, and swings in behind the
      // machine when the mouse is left alone.
      const target = v.isBike
        ? _v.copy(v.body.position).add(_v3.set(0, 0.95, 0))
        : _v.copy(v.body.position).addScaledVector(up, v.def.kind === 'tracked' ? 1.9 : 1.2);
      const o = this.orbit;
      if (v.isBike && this.idleLook > 1.2 && Math.abs(v.speed) > 3) {
        o.yaw += wrapAngle(v.yaw - o.yaw) * (1 - Math.exp(-1.6 * dt));
        o.pitch = damp(o.pitch, -0.14, 1.2, dt);
      }
      const back = new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), -Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch));
      let dist = o.dist;
      const proxies = v.proxies || [];
      for (const p of proxies) p.box.enabled = false;
      if (this.game.world.collision.raycast(target.x, target.y, target.z, back.x, back.y, back.z, dist, _hit, FLAG_SIGHT, true)) dist = Math.max(1.2, _hit.t - 0.3);
      for (const p of proxies) p.box.enabled = true;
      this.camDist = dist < this.camDist ? dist : damp(this.camDist, dist, 3, dt);
      cam.position.copy(target).addScaledVector(back, this.camDist);
      const gy = this.game.world.hf.getHeight(cam.position.x, cam.position.z) + 0.4;
      if (cam.position.y < gy) cam.position.y = gy;
      cam.rotation.set(o.pitch, o.yaw, 0, 'YXZ');
      cam.updateMatrixWorld();
      if (role === 'gunner') this._aimFromCamera(v);
      else if (role === 'sidecarMg' && v.mg) this._aimMgFromCamera(v);
    }
    if (this.shake > 0.01) {
      cam.rotation.x += (Math.random() - 0.5) * this.shake * 0.02;
      cam.rotation.y += (Math.random() - 0.5) * this.shake * 0.02;
    }
    if (Math.abs(fov - cam.fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
      this.game.world.shadows.updateFrustums();
    }
    cam.updateMatrixWorld();
  }

  // Third person: the gun follows where the camera looks (the point under the
  // screen center), like the original game.
  _aimFromCamera(v) {
    const cam = this.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const proxies = v.proxies || [];
    for (const p of proxies) p.box.enabled = false;
    const c = this.game.world.collision;
    const hit = c.raycast(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, 2500, _hit, 2 | 4, true);
    for (const p of proxies) p.box.enabled = true;
    const dist = hit ? _hit.t : 2000;
    this.aimPoint.copy(cam.position).addScaledVector(dir, dist);
    const from = v.muzzleWorld(_v);
    const to = _v2.copy(this.aimPoint).sub(from).normalize();
    v.aim.yaw = Math.atan2(-to.x, -to.z);
    v.aim.pitch = Math.asin(clamp(to.y, -1, 1));
    // Where the gun points right now, at the same distance (for the HUD marker).
    this.gunPoint.copy(from).addScaledVector(v.sightDir(_v2), from.distanceTo(this.aimPoint));
  }

  // On a bike the eyes are in the rider's head, wherever leaning to the bars
  // put it: last frame's head (the rider is posed after the camera), carried
  // along with the machine; the seat's eye point until there is one.
  _bikeEye(v, out) {
    const m = this.soldier.model;
    const head = m?.eyeWorld || m?.bones?.[4];
    const T = (this._bikeT ??= { p: new THREE.Vector3(), q: new THREE.Quaternion(), ok: false });
    if (head && T.ok) {
      // The eyes (as the soldier model last posed them, or above and in front
      // of the top of the neck), the camera just clear of the face so the head
      // itself never fills the view.
      if (m.eyeWorld && m.aimDir) _v3.copy(m.eyeWorld).addScaledVector(m.aimDir, 0.14);
      else {
        head.getWorldPosition(_v3);
        head.getWorldQuaternion(_qh);
        _v3.add(_v.set(0, 0.08, -0.2).applyQuaternion(_qh));
      }
      this._eyeLocal = (this._eyeLocal || new THREE.Vector3()).copy(_v3).sub(T.p).applyQuaternion(_qh.copy(T.q).invert());
    }
    T.p.copy(v.body.position);
    T.q.copy(v.body.quaternion);
    T.ok = !!head;
    if (!this._eyeLocal) {
      // (First frame: the seat's eye point, moved clear of the face.)
      v.seatPos(this.soldier.seat, out, 'eye');
      return out.add(_v.set(-Math.sin(v.yaw) * 0.18, 0, -Math.cos(v.yaw) * 0.18));
    }
    return out.copy(this._eyeLocal).applyQuaternion(v.body.quaternion).add(v.body.position);
  }

  // The same for the sidecar gun: the gunner swings it toward the point under
  // the screen center.
  _aimMgFromCamera(v) {
    const cam = this.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const proxies = v.proxies || [];
    for (const p of proxies) p.box.enabled = false;
    const c = this.game.world.collision;
    const hit = c.raycast(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, 1500, _hit, 2 | 4, true);
    for (const p of proxies) p.box.enabled = true;
    this.aimPoint.copy(cam.position).addScaledVector(dir, hit ? _hit.t : 1200);
    const from = v.anchorWorld('mgMuzzle', _v);
    v.aimMgAt(_v2.copy(this.aimPoint).sub(from).normalize());
    this.gunPoint.copy(from).addScaledVector(v.mgDir(_v2), from.distanceTo(this.aimPoint));
  }
}

// Point the camera along a direction, keeping the vehicle's "up" (so the view
// tilts with the hull, as through a real sight).
const _lm = new THREE.Matrix4();
const _o = new THREE.Vector3();
function lookAlong(cam, dir, up) {
  _lm.lookAt(_o, dir, up);
  cam.quaternion.setFromRotationMatrix(_lm);
  cam.rotation.setFromQuaternion(cam.quaternion, 'YXZ');
}

// Vertical camera FOV through a sight: the natural view divided by the sight's
// magnification, so things look as big as they did through the real optic. The
// HUD draws the edge of the field where it falls (or at the screen's edge).
export function sightFov(sd) {
  return (2 * Math.atan(Math.tan((NATURAL_FOV * DEG) / 2) / sd.mag)) / DEG;
}
