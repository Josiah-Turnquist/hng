// Visual effects tied to vehicles: exhaust smoke (thicker under load and from
// diesels), dust and spray thrown up by wheels and tracks, fire and smoke from
// damaged or destroyed vehicles, and a flying turret after an ammunition blast.
import * as THREE from 'three';
import { G } from '../core/math.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const DUSTY = new Set([1, 2, 5, 8, 9, 11]); // dry grass, dirt, field, dirt road, sand, wheat
const MUDDY = new Set([3]);

export function updateVehicleEffects(game, v, dt) {
  const fx = game.effects;
  if (!fx) return;
  v._fxT = (v._fxT || 0) + dt;
  const b = v.body;
  const up = _v2.set(0, 1, 0).applyQuaternion(b.quaternion);
  // Exhaust.
  if (v.alive && v.engineOn) {
    v._exhaustAcc = (v._exhaustAcc || 0) + dt * (2 + v.load * 14 + (v.shiftTimer > 0 ? 6 : 0));
    const diesel = v.def.engine.sound === 'engineTankDiesel';
    while (v._exhaustAcc > 1) {
      v._exhaustAcc -= 1;
      for (const name of ['exhaustL', 'exhaustR']) {
        const p = v.anchorWorld(name, _v);
        if (!p) continue;
        const shade = diesel ? 0.12 + (1 - v.load) * 0.1 : 0.35;
        fx.spawn('muzzleSmoke', p.x, p.y, p.z, { count: 1, dir: [b.velocity.x * 0.3, 0.6, b.velocity.z * 0.3], spread: 0.15, scale: diesel ? 2.4 : 1.4, color: [shade, shade, shade * 0.95] });
      }
      if (!v.model.anchors?.exhaustL && !v.model.anchors?.exhaustR) {
        const p = _v.set(0, v.def.dims[1] * 0.4, v.def.dims[2] * 0.5);
        v._modelToWorld(p, p);
        fx.spawn('muzzleSmoke', p.x, p.y, p.z, { count: 1, dir: [0, 0.6, 0], spread: 0.15, scale: 1.4 });
      }
    }
  }
  // Dust or mud from wheels and tracks.
  const speed = b.velocity.length();
  if (speed > 2.5 && v.wheels.length) {
    v._dustAcc = (v._dustAcc || 0) + dt * Math.min(12, speed * (v.def.kind === 'tracked' ? 1.2 : 0.8));
    while (v._dustAcc > 1) {
      v._dustAcc -= 1;
      const w = v.wheels[(Math.random() * v.wheels.length) | 0];
      if (!w.onGround) continue;
      const p = w.contactNow;
      if (DUSTY.has(w.surface)) {
        fx.spawn('dust', p.x, p.y + 0.15, p.z, { count: 1, dir: [-b.velocity.x * 0.15, 0.4, -b.velocity.z * 0.15], spread: 0.5, scale: 1 + speed * 0.08 });
      } else if (MUDDY.has(w.surface)) {
        fx.spawn('mud', p.x, p.y + 0.1, p.z, { count: 2, dir: [-b.velocity.x * 0.2, 1.5, -b.velocity.z * 0.2], spread: 0.8, speed: 1.2, ground: p.y - 0.05 });
      }
    }
  }
  if (v.waterDepth > 0.15 && speed > 1) {
    const p = b.position;
    fx.spawn('water', p.x + (Math.random() - 0.5) * 2, p.y - v.cg.y + v.waterDepth, p.z + (Math.random() - 0.5) * 2, { count: 2, dir: [0, 2 + speed * 0.3, 0], spread: 1, speed: 1 });
  }
  // Fire and smoke.
  if (v.fire > 0 || !v.alive) {
    const burning = v.fire > 0;
    v._fireAcc = (v._fireAcc || 0) + dt * (burning ? 10 : 2);
    while (v._fireAcc > 1) {
      v._fireAcc -= 1;
      const p = _v.set((Math.random() - 0.5) * v.def.dims[0] * 0.5, v.def.dims[1] * 0.8, v.def.dims[2] * (0.15 + Math.random() * 0.2));
      v._modelToWorld(p, p);
      if (burning) fx.spawn('fire', p.x, p.y, p.z, { count: 1, spread: 0.4, scale: v.alive ? 0.6 : 1.1 });
      fx.spawn('smoke', p.x, p.y + 0.5, p.z, { count: 1, spread: 0.4, scale: burning ? 1.2 : 0.9, color: [0.08, 0.08, 0.08] });
    }
    // Firelight: a faint, flickering glow on what stands close (in daylight flames
    // light little; brighter pulses made everything near a burning vehicle flash).
    if (burning && Math.random() < dt * 3) fx.flashLight(b.position.x, b.position.y + 1.5, b.position.z, 1.6, 8, 0.25);
  }
  // A turret thrown off by an ammunition explosion flies, then lies where it lands.
  const tf = v.turretFly;
  const t = v.model.parts?.turret;
  if (tf && t && !tf.landed) {
    if (!tf.started) {
      tf.started = true;
      t.updateWorldMatrix(true, false);
      const pos = new THREE.Vector3(),
        quat = new THREE.Quaternion();
      t.matrixWorld.decompose(pos, quat, new THREE.Vector3());
      game.world.scene.attach(t);
      tf.pos = pos;
      t.position.copy(pos);
      t.quaternion.copy(quat);
    }
    tf.vy -= G * dt;
    t.position.x += tf.vx * dt;
    t.position.y += tf.vy * dt;
    t.position.z += tf.vz * dt;
    t.rotateX(tf.spin * dt * 0.3);
    t.rotateZ(tf.spin * dt);
    const gy = game.world.hf.getHeight(t.position.x, t.position.z);
    if (t.position.y < gy + 0.3 && tf.vy < 0) {
      t.position.y = gy + 0.3;
      tf.landed = true;
      fx.spawn('dust', t.position.x, gy + 0.3, t.position.z, { count: 10, spread: 2, speed: 1.5, scale: 2 });
    }
  }
}

// Burnt-out wreck: every material goes dark and dull.
export function charModel(v) {
  const game = v.game;
  const done = new Map();
  v.model.root.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const out = list.map((m) => {
      if (done.has(m)) return done.get(m);
      const c = m.clone();
      c.userData = { texWorld: m.userData?.texWorld, charred: true };
      if (c.color) c.color.multiplyScalar(0.16);
      if ('roughness' in c) c.roughness = 1;
      if ('metalness' in c) c.metalness *= 0.4;
      if (c.emissive) c.emissive.setRGB(0, 0, 0);
      game.world.shadows?.setup(c);
      done.set(m, c);
      return c;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}
