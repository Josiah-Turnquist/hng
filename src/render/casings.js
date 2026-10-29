// Spent cartridge cases, ejected clips and belt links: little brass and steel
// pieces flung out of the gun that tumble, bounce off the ground (with their
// own sounds) and lie where they land for a while.
import * as THREE from 'three';
import { G } from '../core/math.js';
import { FLAG_WALKABLE, RayHit } from '../physics/collision.js';

const MAX = 160;
const LIFE = 40; // seconds on the ground before they're tidied away
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _hit = new RayHit();
const HARD = new Set([4, 6, 8]); // rock, cobbles, road: casings ring on these

export class Casings {
  constructor(world, audio) {
    this.world = world;
    this.audio = audio;
    const brass = new THREE.MeshStandardMaterial({ color: 0xb58a43, roughness: 0.35, metalness: 1 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x55534d, roughness: 0.5, metalness: 0.9 });
    // A cartridge case: unit length along Y (scaled per caliber), with a bottleneck.
    const pts = [
      [0, 0],
      [0.48, 0],
      [0.5, 0.05],
      [0.5, 0.72],
      [0.33, 0.82],
      [0.3, 1],
      [0.26, 1],
    ].map(([r, y]) => new THREE.Vector2(r, y - 0.5));
    const caseGeo = new THREE.LatheGeometry(pts, 8);
    this.cases = new THREE.InstancedMesh(caseGeo, brass, MAX);
    this.clips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.03, 0.06), steel, 24);
    for (const m of [this.cases, this.clips]) {
      m.count = 0;
      m.castShadow = false;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    world.add(this.cases);
    world.add(this.clips);
    this.list = [];
    this.clipList = [];
  }

  // pos: world position; dir: unit vectors of the gun (right/up/back) for the throw.
  ejectCase(pos, right, up, back, ammo, inherit) {
    const len = caseLength(ammo);
    const k = 0.75 + Math.random() * 0.5;
    const v = new THREE.Vector3()
      .addScaledVector(right, 3.2 * k)
      .addScaledVector(up, 1.8 * k)
      .addScaledVector(back, 0.6 * k);
    if (inherit) v.add(inherit);
    this._add(this.list, MAX, { p: pos.clone(), v, len, dia: ammo.diameter * 1.45, rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40), bounces: 0, t: 0, rest: false, steel: false });
  }

  ejectClip(pos, up, inherit) {
    const v = new THREE.Vector3().addScaledVector(up, 2.6 + Math.random()).add(inherit || new THREE.Vector3());
    this._add(this.clipList, 24, { p: pos.clone(), v, rot: new THREE.Euler(), spin: new THREE.Vector3((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30), bounces: 0, t: 0, rest: false, steel: true });
  }

  _add(list, max, o) {
    if (list.length >= max) list.shift();
    list.push(o);
  }

  update(dt) {
    this._step(this.list, dt, false);
    this._step(this.clipList, dt, true);
    this._write(this.cases, this.list, false);
    this._write(this.clips, this.clipList, true);
  }

  _step(list, dt, isClip) {
    const hf = this.world.hf;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      c.t += dt;
      if (c.t > LIFE) {
        list.splice(i, 1);
        continue;
      }
      if (c.rest) continue;
      c.v.y -= G * dt;
      c.v.multiplyScalar(1 - Math.min(0.5, 0.25 * dt));
      const nx = c.p.x + c.v.x * dt,
        ny = c.p.y + c.v.y * dt,
        nz = c.p.z + c.v.z * dt;
      // Floor: the ground or a box top (floors, sandbags, vehicle decks).
      let floor = hf.getHeight(nx, nz);
      let hard = HARD.has(hf.getSurface(nx, nz));
      if (this.world.collision.raycast(nx, Math.max(ny, c.p.y) + 0.05, nz, 0, -1, 0, 0.6, _hit, FLAG_WALKABLE, false)) {
        const top = Math.max(ny, c.p.y) + 0.05 - _hit.t;
        if (top > floor) {
          floor = top;
          hard = true;
        }
      }
      c.p.set(nx, ny, nz);
      c.rot.x += c.spin.x * dt;
      c.rot.y += c.spin.y * dt;
      c.rot.z += c.spin.z * dt;
      const r = isClip ? 0.008 : (c.dia || 0.01) * 0.5;
      if (c.p.y < floor + r) {
        c.p.y = floor + r;
        if (c.v.y < -0.6 && c.bounces < 3) {
          c.bounces++;
          if (this.audio && c.bounces <= 2) this.audio.play(hard || c.steel ? (isClip ? 'impactMetal' : 'casingBrass') : 'casingSoft', { x: c.p.x, y: c.p.y, z: c.p.z }, { volume: (isClip ? 0.5 : 0.35) * Math.min(1, -c.v.y / 3), rate: isClip ? 1.6 : 1 });
          c.v.y *= -0.32;
          c.v.x *= 0.55;
          c.v.z *= 0.55;
          c.spin.multiplyScalar(0.5);
        } else {
          // Settle: lie on its side.
          c.rest = true;
          c.rot.x = Math.PI / 2;
          c.rot.z = 0;
        }
      }
    }
  }

  _write(mesh, list, isClip) {
    let n = 0;
    for (const c of list) {
      _q.setFromEuler(_e.set(c.rot.x, c.rot.y, c.rot.z));
      if (isClip) _s.set(1, 1, 1);
      else _s.set(c.dia, c.len, c.dia);
      _m.compose(c.p, _q, _s);
      mesh.setMatrixAt(n++, _m);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// Approximate case length from the bullet (rifle, intermediate, pistol, heavy).
function caseLength(a) {
  const d = a.diameter;
  if (d > 0.0125) return d > 0.014 ? 0.114 : 0.099;
  if (a.mass > 0.0085 && d > 0.0075) return 0.058;
  if (a.mass > 0.0075) return 0.033;
  if (d > 0.0105) return 0.023;
  if (a.mass < 0.0065 && a.mv < 300) return 0.017; // pocket pistol rounds (.25, .32, .380 ACP)
  return 0.021;
}
