// Rockets and shells you can see in flight. The bazooka's and Panzerschreck's
// rockets and the Panzerfaust's warhead are the launchers' own models (their
// 'rocket' and 'warhead' parts), the rockets trailing a wisp of smoke from
// the motor. Tank shells are steel shells of the gun's calibre, armour-piercing
// ones black, high explosive painted olive, with the copper driving band; the
// tracer glowing in the base is drawn with the other tracers (effects.js).
import * as THREE from 'three';
import { buildGun, MODELS } from '../weapons/models/index.js';
import { worldGunMaterials } from './soldierView.js';

const _v = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, -1);

// Shell paint and the driving band.
const SHELL_MATS = {
  ap: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, metalness: 0.55, roughness: 0.45 }),
  he: new THREE.MeshStandardMaterial({ color: 0x4a4d2e, metalness: 0.2, roughness: 0.6 }),
  band: new THREE.MeshStandardMaterial({ color: 0x9a6038, metalness: 0.8, roughness: 0.35 }),
};

// A shell of diameter D (m), nose toward -Z, its middle at the origin. Armour-
// piercing: blunter, about 4 calibres long; high explosive: a fuze on a longer
// ogive, about 4.5 calibres.
function shellGeometry(D, he) {
  const R = D / 2,
    L = D * (he ? 4.5 : 4);
  const ogive = he ? 0.5 : 0.42; // fraction of the length that tapers
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(R * 0.88, 0), new THREE.Vector2(R, L * 0.06)];
  const y0 = L * (1 - ogive);
  pts.push(new THREE.Vector2(R, y0));
  for (let k = 1; k <= 8; k++) {
    const u = k / 8;
    const tip = he ? R * 0.18 : R * 0.3;
    pts.push(new THREE.Vector2(tip + (R - tip) * Math.cos((u * Math.PI) / 2), y0 + (L - y0) * u));
  }
  pts.push(new THREE.Vector2(0, L));
  const g = new THREE.LatheGeometry(pts, 14);
  g.translate(0, -L / 2, 0);
  g.rotateX(-Math.PI / 2);
  return { geo: g, L, band: new THREE.CylinderGeometry(R * 1.03, R * 1.03, L * 0.05, 14).rotateX(Math.PI / 2).translate(0, 0, L * 0.3) };
}

export class ProjectileView {
  constructor(game) {
    this.game = game;
    this.live = new Map(); // projectile id -> { pivot, key, smoked }
    this.spare = new Map(); // model key -> copies not in use
    this.protos = new Map(); // model key -> { pivot } or null
  }

  // Which model a projectile gets, if any.
  _key(p) {
    if (p.ammo.thrown || p.ammo.fragment) return null;
    if (p.ammo.heat) {
      const d = p.weapon;
      const id = d && (MODELS[d.id] ? d.id : MODELS[d.model] ? d.model : null);
      return id ? `rocket:${id}` : null;
    }
    if (p.weapon?.vehicle && p.ammo.diameter >= 0.02) return `shell:${p.ammo.diameter}:${p.ammo.explosive && !p.ammo.penRefMM ? 'he' : 'ap'}`;
    return null;
  }

  _build(key) {
    const [kind, a, b] = key.split(':');
    const pivot = new THREE.Group();
    if (kind === 'rocket') {
      const gun = buildGun(a, worldGunMaterials(this.game), { lod: 1 });
      const part = gun.parts.rocket || gun.parts.warhead;
      if (!part) return null;
      const obj = part.clone(true);
      obj.position.set(0, 0, 0);
      obj.quaternion.identity();
      obj.visible = true;
      obj.updateMatrixWorld(true);
      const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      obj.position.sub(c);
      pivot.add(obj);
    } else {
      const he = b === 'he';
      const s = shellGeometry(Number(a), he);
      pivot.add(new THREE.Mesh(s.geo, he ? SHELL_MATS.he : SHELL_MATS.ap));
      pivot.add(new THREE.Mesh(s.band, SHELL_MATS.band));
    }
    pivot.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    return pivot;
  }

  _take(key) {
    let pivot = this.spare.get(key)?.pop();
    if (!pivot) {
      if (!this.protos.has(key)) this.protos.set(key, this._build(key));
      const proto = this.protos.get(key);
      if (!proto) return null;
      pivot = proto.clone(true);
    }
    this.game.world.add(pivot);
    return pivot;
  }

  _give(v) {
    v.pivot.removeFromParent();
    let list = this.spare.get(v.key);
    if (!list) this.spare.set(v.key, (list = []));
    list.push(v.pivot);
  }

  // Per rendered frame.
  update(dt) {
    const g = this.game;
    const seen = (this._seen ||= new Set());
    seen.clear();
    for (const p of g.projectiles.active) {
      let v = this.live.get(p.id);
      if (!v) {
        const key = this._key(p);
        if (!key) continue;
        const pivot = this._take(key);
        if (!pivot) continue;
        v = { pivot, key, sx: p.x, sy: p.y, sz: p.z, rocket: key.startsWith('rocket') };
        this.live.set(p.id, v);
      }
      seen.add(p.id);
      const sp = p.speed;
      if (sp > 0.1) v.pivot.quaternion.setFromUnitVectors(FWD, _v.set(p.vx / sp, p.vy / sp, p.vz / sp));
      v.pivot.position.set(p.x, p.y, p.z);
      if (v.rocket && p.ammo.tracer) this._smoke(v, p);
    }
    for (const [id, v] of this.live)
      if (!seen.has(id)) {
        this._give(v);
        this.live.delete(id);
      }
  }

  // A rocket's smoke: puffs along the way it came, thinning out after the first
  // tenths of a second (the motor burns out just after leaving the tube), and a
  // spark of flame at the tail at first.
  _smoke(v, p) {
    const fx = this.game.effects;
    const k = Math.max(0, 1 - p.age / 0.7);
    if (k <= 0) return;
    const dx = p.x - v.sx,
      dy = p.y - v.sy,
      dz = p.z - v.sz;
    const d = Math.hypot(dx, dy, dz);
    const step = 0.22 / k;
    if (d < step) return;
    const n = Math.min(16, Math.floor(d / step));
    for (let i = 1; i <= n; i++) {
      const f = (i * step) / d;
      fx.spawn('rocketSmoke', v.sx + dx * f, v.sy + dy * f, v.sz + dz * f, { count: 1, speed: 0.12, spread: 1, scale: 0.8 + (1 - k) * 0.6 });
    }
    if (p.age < 0.08) fx.spawn('fire', p.x - (p.vx / (p.speed || 1)) * 0.35, p.y - (p.vy / (p.speed || 1)) * 0.35, p.z - (p.vz / (p.speed || 1)) * 0.35, { count: 1, speed: 0.2, spread: 0.3, scale: 0.18 });
    const f = (n * step) / d;
    v.sx += dx * f;
    v.sy += dy * f;
    v.sz += dz * f;
  }
}
