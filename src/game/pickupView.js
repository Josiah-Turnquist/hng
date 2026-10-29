// Weapons lying on the ground (pickups.js): each drawn with its own model, on
// its side in the grass, near the camera only.
import * as THREE from 'three';
import { buildGun, MODELS } from '../weapons/models/index.js';
import { worldGunMaterials, viewZoom } from './soldierView.js';

// m from the camera, further through a scope (it magnifies: a gun 300 m off
// looks as near as one at 75 m through a 4x scope).
const RANGE = 120;

export class PickupView {
  constructor(game) {
    this.game = game;
    this.shown = new Map(); // pickup id -> Object3D
  }

  _model(def) {
    const id = MODELS[def.id] ? def.id : MODELS[def.model] ? def.model : null;
    if (!id) return null;
    const gun = buildGun(id, worldGunMaterials(this.game), { lod: 1 });
    const g = new THREE.Group();
    // Lying on its side, the middle of the gun where it was dropped.
    const box = new THREE.Box3().setFromObject(gun.root);
    const c = box.getCenter(new THREE.Vector3());
    gun.root.position.sub(c);
    gun.root.rotation.z = Math.PI / 2;
    gun.root.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    g.add(gun.root);
    g.userData.lift = Math.max(-box.min.x, box.max.x, 0.02);
    // (A launcher's rocket went with the shot or is still in it, as it was.)
    return g;
  }

  update(camPos) {
    const list = this.game.pickups?.list;
    if (!list) return;
    const keep = (this._keep ||= new Set());
    keep.clear();
    const range = RANGE * viewZoom(this.game);
    for (const d of list) {
      if (Math.hypot(d.x - camPos.x, d.z - camPos.z) > range) continue;
      let o = this.shown.get(d.id);
      if (!o) {
        o = this._model(d.w.def);
        if (!o) continue;
        o.position.set(d.x, d.y + o.userData.lift, d.z);
        o.rotation.set(0, d.yaw, 0);
        this.game.world.add(o);
        this.shown.set(d.id, o);
      }
      keep.add(d.id);
    }
    for (const [id, o] of this.shown)
      if (!keep.has(id)) {
        o.removeFromParent();
        this.shown.delete(id);
      }
  }
}
