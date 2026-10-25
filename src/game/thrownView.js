// Thrown grenades you can see. Each grenade in the air is drawn with its own
// model, turning over and over as it flies, spinning less after each bounce,
// and lying on its side where it stops until it goes off. A soldier throwing
// with a gun in his other hand holds a grenade in his right hand until he lets
// go (one holding the grenade itself shows it through his weapon model).
import * as THREE from 'three';
import { buildGun, MODELS } from '../weapons/models/index.js';
import { worldGunMaterials } from './soldierView.js';

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const Y = new THREE.Vector3(0, 1, 0);
const ID = new THREE.Quaternion();

// Grenades in a soldier's hand are drawn only this close to the camera (m).
const HELD_RANGE = 90;

export class ThrownView {
  constructor(game) {
    this.game = game;
    this.spare = new Map(); // model id -> copies not in use
    this.flying = new Map(); // projectile id -> view
    this.held = new Map(); // soldier -> view
  }

  _modelId(def) {
    if (!def) return null;
    return MODELS[def.id] ? def.id : MODELS[def.model] ? def.model : null;
  }

  // A copy of a grenade model, centered on a pivot so it turns about its middle.
  _take(id) {
    let v = this.spare.get(id)?.pop();
    if (!v) {
      const gun = buildGun(id, worldGunMaterials(this.game), { lod: 1 });
      const box = new THREE.Box3().setFromObject(gun.root);
      const c = box.getCenter(new THREE.Vector3());
      gun.root.position.sub(c);
      // (The pin stayed in the thrower's hand.)
      if (gun.parts.pin) gun.parts.pin.visible = false;
      const pivot = new THREE.Group();
      pivot.add(gun.root);
      // Lying on its side, its middle sits this high (the widest part's radius).
      const lie = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
      v = { id, pivot, lie, q: new THREE.Quaternion(), spin: 0, vy: 0, speed: 0, axis: new THREE.Vector3() };
    }
    this.game.world.add(v.pivot);
    v.pivot.visible = true;
    return v;
  }

  _give(v) {
    v.pivot.removeFromParent();
    let list = this.spare.get(v.id);
    if (!list) this.spare.set(v.id, (list = []));
    list.push(v);
  }

  // Per rendered frame.
  update(dt, camPos) {
    const g = this.game;
    const seen = (this._seen ||= new Set());
    seen.clear();
    for (const p of g.projectiles.active) {
      if (!p.ammo.thrown) continue;
      let v = this.flying.get(p.id);
      if (!v) {
        const id = this._modelId(p.weapon);
        if (!id) continue;
        v = this._take(id);
        this.flying.set(p.id, v);
        // Leaves the hand head up, tipped back, turning over forward.
        v.q.setFromEuler(_e.set(0.6, Math.atan2(-p.vx, -p.vz), 0));
        v.spin = 11 + Math.random() * 7;
        v.axis.set(0, 0, 0);
        v.vy = p.vy;
        v.speed = p.speed;
      }
      seen.add(p.id);
      const sp = p.speed;
      // A bounce (the fall turned upward, or the speed suddenly dropped): less spin,
      // and a knock off its line.
      if ((v.vy < -1 && p.vy > v.vy * 0.2) || sp < v.speed * 0.6) {
        v.spin *= 0.45;
        v.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.6);
      }
      v.vy = p.vy;
      v.speed = sp;
      let y = p.y;
      if (p.resting || sp < 0.2) {
        // Settle on its side: turn the long axis level.
        const up = _v.copy(Y).applyQuaternion(v.q);
        const flat = _v2.set(up.x, 0, up.z);
        if (flat.lengthSq() < 0.01) flat.set(1, 0, 0).applyQuaternion(v.q).setY(0);
        flat.normalize();
        _q.setFromUnitVectors(up, flat);
        _q2.copy(ID).slerp(_q, Math.min(1, dt * 10));
        v.q.premultiply(_q2);
        if (p.resting) y += v.lie;
      } else if (v.spin > 0.05) {
        // Turning over forward about the level line across its path (plus any knock).
        const h = Math.hypot(p.vx, p.vz);
        _v.set(h > 0.05 ? p.vz / h : 1, 0, h > 0.05 ? -p.vx / h : 0).add(v.axis).normalize();
        _q.setFromAxisAngle(_v, v.spin * dt);
        v.q.premultiply(_q);
        // Rolling along the ground slows it.
        if (Math.abs(p.vy) < 0.5) v.spin = Math.max(sp / Math.max(v.lie, 0.02) * 0.3, v.spin * (1 - Math.min(1, dt * 3)));
      }
      v.pivot.position.set(p.x, y, p.z);
      v.pivot.quaternion.copy(v.q);
    }
    // Gone off: put the model away.
    for (const [id, v] of this.flying)
      if (!seen.has(id)) {
        this._give(v);
        this.flying.delete(id);
      }
    this._updateHeld(camPos);
  }

  _updateHeld(camPos) {
    const g = this.game;
    for (const s of g.soldiers) {
      const th = s.throwing;
      const m = s.model;
      const show = th && th.phase !== 'follow' && s.alive && m?.root.visible && s.weapon?.def.type !== 'grenade' && Math.hypot(s.body.x - camPos.x, s.body.z - camPos.z) < HELD_RANGE;
      let v = this.held.get(s);
      if (!show) {
        if (v) {
          this._give(v);
          this.held.delete(s);
        }
        continue;
      }
      if (!v) {
        const id = this._modelId(th.w?.def);
        if (!id) continue;
        v = this._take(id);
        this.held.set(s, v);
      }
      m.getHandWorld(1, v.pivot.position);
      // Upright in the fist, tipped back with the arm as it's drawn back.
      v.pivot.quaternion.setFromEuler(_e.set(th.phase === 'windup' ? 0.9 : -0.4, s.body.yaw, 0));
    }
    // Soldiers gone from the battle.
    if (this.held.size)
      for (const [s, v] of this.held)
        if (!g.soldiers.includes(s)) {
          this._give(v);
          this.held.delete(s);
        }
  }
}
