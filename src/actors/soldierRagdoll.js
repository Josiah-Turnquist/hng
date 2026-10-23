// A small verlet ragdoll for dead soldiers: point masses at the joints, rigid
// sticks for the bones, range constraints as joint limits, a knee/elbow hinge
// rule, a few body-part collisions and the terrain. Settles and goes to sleep.
// Works in the soldier's model space (the root stays where he died).
import * as THREE from 'three';
import { B, BIND, HEAD_CENTER, PARENT, OFFSET, frameRotation, setModelRotation } from './soldierRig.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Particles: [name, bone, bind position, radius]
const P = [];
const add = (name, bone, pos, r) => P.push({ name, bone, bind: pos.clone(), r });
add('pelvis', B.hips, BIND[B.hips], 0.1);
add('spine', B.spine, BIND[B.spine], 0.1);
add('chest', B.chest, BIND[B.chest], 0.11);
add('neck', B.neck, BIND[B.neck], 0.05);
add('head', B.head, HEAD_CENTER, 0.115);
add('face', B.head, V(0, 1.655, -0.1), 0.04);
add('sternum', B.chest, V(0, 1.3, -0.12), 0.07);
for (const s of [-1, 1]) {
  const ua = s < 0 ? B.upperArmL : B.upperArmR;
  add(`shoulder${s}`, ua, BIND[ua], 0.06);
  add(`elbow${s}`, ua + 1, BIND[ua + 1], 0.045);
  add(`wrist${s}`, ua + 2, BIND[ua + 2], 0.04);
  add(`tip${s}`, ua + 2, BIND[ua + 2].clone().add(V(0, -0.1, -0.005)), 0.035);
}
for (const s of [-1, 1]) {
  const th = s < 0 ? B.thighL : B.thighR;
  add(`hip${s}`, th, BIND[th], 0.075);
  add(`knee${s}`, th + 1, BIND[th + 1], 0.055);
  add(`ankle${s}`, th + 2, BIND[th + 2], 0.05);
  add(`toe${s}`, th + 2, V(BIND[th + 2].x, 0.035, -0.17), 0.04);
}
add('pubis', B.hips, V(0, 0.88, -0.09), 0.07);
add('sacrum', B.hips, V(0, 0.99, 0.1), 0.08);
const I = Object.fromEntries(P.map((p, i) => [p.name, i]));
const N = P.length;

// Constraints: [a, b, min, max] as fractions of the rest length.
const C = [];
const rest = (a, b) => P[I[a]].bind.distanceTo(P[I[b]].bind);
const stick = (a, b) => C.push([I[a], I[b], rest(a, b), rest(a, b)]);
const range = (a, b, lo, hi) => C.push([I[a], I[b], rest(a, b) * lo, rest(a, b) * hi]);
const group = (names) => {
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) stick(names[i], names[j]);
};
group(['pelvis', 'pubis', 'sacrum', 'hip-1', 'hip1', 'spine']);
group(['chest', 'sternum', 'neck', 'shoulder-1', 'shoulder1']);
stick('spine', 'chest');
range('spine', 'sternum', 0.92, 1.08);
range('pubis', 'sternum', 0.86, 1.04);
range('sacrum', 'neck', 0.9, 1.03);
range('hip-1', 'shoulder-1', 0.86, 1.06);
range('hip1', 'shoulder1', 0.86, 1.06);
range('hip-1', 'shoulder1', 0.9, 1.06);
range('hip1', 'shoulder-1', 0.9, 1.06);
group(['neck', 'head', 'face']);
range('chest', 'head', 0.9, 1.04);
range('sternum', 'face', 0.75, 1.12);
range('shoulder-1', 'head', 0.85, 1.12);
range('shoulder1', 'head', 0.85, 1.12);
for (const s of ['-1', '1']) {
  stick(`shoulder${s}`, `elbow${s}`);
  stick(`elbow${s}`, `wrist${s}`);
  stick(`wrist${s}`, `tip${s}`);
  range(`shoulder${s}`, `wrist${s}`, 0.3, 1.0);
  range(`elbow${s}`, `tip${s}`, 0.62, 1.0);
  stick(`hip${s}`, `knee${s}`);
  stick(`knee${s}`, `ankle${s}`);
  stick(`ankle${s}`, `toe${s}`);
  range(`knee${s}`, `toe${s}`, 0.82, 1.12);
  range(`hip${s}`, `ankle${s}`, 0.55, 1.0);
  range(`pubis`, `knee${s}`, 0.68, 1.15);
  range(`sacrum`, `knee${s}`, 0.85, 1.3);
}
range('knee-1', 'knee1', 0.6, 4);
range('ankle-1', 'ankle1', 0.5, 6);
// Limbs vs torso: [limb particle, body particle].
const BODY = ['chest', 'sternum', 'spine', 'pelvis', 'pubis'].map((n) => I[n]);
const LIMBS = ['wrist-1', 'wrist1', 'tip-1', 'tip1', 'elbow-1', 'elbow1', 'knee-1', 'knee1'].map((n) => I[n]);

const G = -9.81;
const STEP = 1 / 60;
const _a = new THREE.Vector3(),
  _b = new THREE.Vector3(),
  _c = new THREE.Vector3(),
  _d = new THREE.Vector3(),
  _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion();

export class Ragdoll {
  constructor() {
    this.x = P.map(() => new THREE.Vector3());
    this.o = P.map(() => new THREE.Vector3());
    this.active = false;
    this.asleep = false;
    this.still = 0;
    this.acc = 0;
    this.time = 0;
    // Dropped weapon: butt, muzzle, top.
    this.gx = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.go = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.gl = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]; // gun-space points
    this.gunRest = [0, 0, 0];
    this.hasGun = false;
  }

  // Start from the current model pose. vel: model-space velocity of the body,
  // push: model-space impulse direction (hit) or null. gunXf: {q,p} model space.
  start(mp, vel, push, gunXf, gunPoints) {
    for (let i = 0; i < N; i++) {
      mp.point(P[i].bone, P[i].bind, this.x[i]);
      this.o[i].copy(this.x[i]).addScaledVector(vel, -STEP);
    }
    // Knees give way, the upper body goes with the hit.
    const kick = (name, v) => this.o[I[name]].addScaledVector(v, -STEP);
    if (push) {
      for (const n of ['head', 'face']) kick(n, _a.copy(push).multiplyScalar(2.4));
      for (const n of ['neck', 'chest', 'sternum', 'shoulder-1', 'shoulder1']) kick(n, _a.copy(push).multiplyScalar(1.9));
      for (const n of ['pelvis', 'pubis', 'sacrum', 'spine']) kick(n, _a.copy(push).multiplyScalar(0.7));
    }
    // The legs give way a little.
    const fwd = _b.set(0, 0, -1).applyQuaternion(mp.q[B.hips]);
    fwd.y = 0;
    if (fwd.lengthSq() > 1e-4) {
      fwd.normalize();
      kick('knee-1', _a.copy(fwd).multiplyScalar(0.4));
      kick('knee1', _a.copy(fwd).multiplyScalar(0.25));
      kick('pelvis', _a.set(0, -0.25, 0));
    }
    this.hasGun = !!gunXf;
    if (gunXf) {
      const [butt, muzzle, top] = gunPoints;
      this.gl[0].copy(butt);
      this.gl[1].copy(muzzle);
      this.gl[2].copy(top);
      for (let k = 0; k < 3; k++) {
        this.gx[k].copy(this.gl[k]).applyQuaternion(gunXf.q).add(gunXf.p);
        this.go[k].copy(this.gx[k]).addScaledVector(vel, -STEP);
      }
      this.gunRest = [butt.distanceTo(muzzle), butt.distanceTo(top), muzzle.distanceTo(top)];
      this.gripOffset = this.gx[0].clone().sub(this.x[I.wrist1]);
    }
    this.active = true;
    this.asleep = false;
    this.still = 0;
    this.time = 0;
    this.acc = 0;
  }

  // ground(x, z) -> y in model space.
  update(dt, ground, maxSteps = 6) {
    if (!this.active || this.asleep) return;
    this.acc += Math.min(dt, 0.25);
    let n = 0;
    while (this.acc >= STEP && n < maxSteps) {
      this.acc -= STEP;
      this._step(ground);
      n++;
    }
    if (n === maxSteps) this.acc = 0;
  }

  _step(ground) {
    this.time += STEP;
    const x = this.x,
      o = this.o;
    const damp = 0.992;
    let moved = 0;
    for (let i = 0; i < N; i++) {
      const p = x[i],
        q = o[i];
      const vx = (p.x - q.x) * damp,
        vy = (p.y - q.y) * damp,
        vz = (p.z - q.z) * damp;
      q.copy(p);
      p.x += vx;
      p.y += vy + G * STEP * STEP;
      p.z += vz;
    }
    for (let it = 0; it < 10; it++) {
      for (const [a, b, lo, hi] of C) {
        const pa = x[a],
          pb = x[b];
        _a.subVectors(pb, pa);
        const d = _a.length();
        if (d < 1e-9) continue;
        let target = d;
        if (d < lo) target = lo;
        else if (d > hi) target = hi;
        else continue;
        _a.multiplyScalar((0.5 * (d - target)) / d);
        pa.add(_a);
        pb.sub(_a);
      }
      this._hinges();
      // Limbs out of the torso.
      for (const li of LIMBS) {
        for (const bi of BODY) {
          const r = P[li].r + P[bi].r * 0.85;
          _a.subVectors(x[li], x[bi]);
          const d = _a.length();
          if (d < r && d > 1e-6) {
            _a.multiplyScalar((r - d) / d);
            x[li].addScaledVector(_a, 0.7);
            x[bi].addScaledVector(_a, -0.3);
          }
        }
      }
      // Ground with friction.
      for (let i = 0; i < N; i++) {
        const p = x[i];
        const gy = ground(p.x, p.z) + P[i].r;
        if (p.y < gy) {
          p.y = gy;
          const q = o[i];
          q.x += (p.x - q.x) * 0.2;
          q.z += (p.z - q.z) * 0.2;
        }
      }
    }
    for (let i = 0; i < N; i++) moved = Math.max(moved, x[i].distanceToSquared(o[i]));
    if (this.hasGun) this._gunStep(ground);
    if (moved < 1e-7 && this.time > 1.2) {
      if (++this.still > 45) this.asleep = true;
    } else this.still = 0;
  }

  // Knees bend forward only, elbows backward only.
  _hinges() {
    const x = this.x;
    // Pelvis forward = (hipR - hipL) x up.
    _b.subVectors(x[I.hip1], x[I.hip0 ?? I['hip-1']]);
    _c.subVectors(x[I.spine], x[I.pelvis]);
    const fwd = _d.crossVectors(_c, _b).normalize(); // up x right = back? (sign fixed below)
    // In the bind pose up=(0,1,0), right=(1,0,0): up x right = (0,0,-1) = forward.
    for (const s of ['-1', '1']) {
      this._hinge(I[`hip${s}`], I[`knee${s}`], I[`ankle${s}`], fwd, 1);
    }
    _b.subVectors(x[I.shoulder1], x[I['shoulder-1']]);
    _c.subVectors(x[I.neck], x[I.chest]);
    const cf = _d.crossVectors(_c, _b).normalize();
    for (const s of ['-1', '1']) this._hinge(I[`shoulder${s}`], I[`elbow${s}`], I[`wrist${s}`], cf, -1);
  }

  _hinge(ia, ib, ic, dir, sign) {
    const x = this.x;
    const a = x[ia],
      b = x[ib],
      c = x[ic];
    _a.subVectors(c, a);
    const len2 = _a.lengthSq();
    if (len2 < 1e-8) return;
    const t = _b.subVectors(b, a).dot(_a) / len2;
    const off = _b.subVectors(b, a).addScaledVector(_a, -t); // joint offset from the line
    const side = off.dot(dir) * sign;
    if (side < 0) {
      const corr = _c.copy(dir).multiplyScalar(-side * sign * 1.05);
      b.add(corr);
    }
  }

  _gunStep(ground) {
    const gx = this.gx,
      go = this.go;
    if (this.time < 0.12) {
      // Still in the hand for a moment.
      const d = _a.copy(this.x[I.wrist1]).add(this.gripOffset).sub(gx[0]);
      for (let k = 0; k < 3; k++) gx[k].add(d);
    }
    for (let k = 0; k < 3; k++) {
      const p = gx[k],
        q = go[k];
      const vx = (p.x - q.x) * 0.99,
        vy = (p.y - q.y) * 0.99,
        vz = (p.z - q.z) * 0.99;
      q.copy(p);
      p.x += vx;
      p.y += vy + G * STEP * STEP;
      p.z += vz;
    }
    const pairs = [
      [0, 1, this.gunRest[0]],
      [0, 2, this.gunRest[1]],
      [1, 2, this.gunRest[2]],
    ];
    for (let it = 0; it < 6; it++) {
      for (const [a, b, r] of pairs) {
        _a.subVectors(gx[b], gx[a]);
        const d = _a.length();
        if (d < 1e-9) continue;
        _a.multiplyScalar((0.5 * (d - r)) / d);
        gx[a].add(_a);
        gx[b].sub(_a);
      }
      for (let k = 0; k < 3; k++) {
        const p = gx[k];
        const gy = ground(p.x, p.z) + 0.025;
        if (p.y < gy) {
          p.y = gy;
          go[k].x += (p.x - go[k].x) * 0.5;
          go[k].z += (p.z - go[k].z) * 0.5;
        }
      }
    }
  }

  // Write bone rotations (and the hips position) for the current particles.
  toPose(pose, mp) {
    const x = this.x;
    const bindV = (a, b) => _a.copy(P[I[b]].bind).sub(P[I[a]].bind);
    const curV = (a, b) => _b.copy(x[I[b]]).sub(x[I[a]]);
    const sideBind = _c.copy(BIND[B.thighR]).sub(BIND[B.thighL]);
    const sideCur = _d.copy(x[I.hip1]).sub(x[I['hip-1']]);
    pose.hips.copy(x[I.pelvis]);
    frameRotation(bindV('pelvis', 'spine'), sideBind, curV('pelvis', 'spine'), sideCur, _q);
    pose.q[B.hips].copy(_q);
    mp.fk(pose);
    // Spine and chest: direction to the next joint, side from shoulders/hips.
    const shB = new THREE.Vector3().copy(BIND[B.upperArmR]).sub(BIND[B.upperArmL]);
    const shC = new THREE.Vector3().copy(x[I.shoulder1]).sub(x[I['shoulder-1']]);
    const mid = shC.clone().add(sideCur).multiplyScalar(0.5);
    frameRotation(bindV('spine', 'chest'), sideBind, curV('spine', 'chest'), mid, _q);
    setModelRotation(pose, mp, B.spine, _q);
    mp.fk(pose);
    frameRotation(_a.copy(BIND[B.neck]).sub(BIND[B.chest]), shB, _b.copy(x[I.neck]).sub(x[I.chest]), shC, _q);
    setModelRotation(pose, mp, B.chest, _q);
    mp.fk(pose);
    frameRotation(_a.copy(HEAD_CENTER).sub(BIND[B.neck]), shB, _b.copy(x[I.head]).sub(x[I.neck]), shC, _q);
    setModelRotation(pose, mp, B.neck, _q);
    mp.fk(pose);
    frameRotation(bindV('head', 'face'), _c.copy(HEAD_CENTER).sub(BIND[B.neck]), curV('head', 'face'), _d.copy(x[I.head]).sub(x[I.neck]), _q);
    setModelRotation(pose, mp, B.head, _q);
    mp.fk(pose);
    // Limbs: minimal twist from the parent.
    const limb = (bone, toPoint) => {
      const par = PARENT[bone];
      _a.copy(OFFSET[bone + 1] || _a.set(0, -0.1, 0));
      _a.applyQuaternion(mp.q[par]).normalize(); // bind direction carried by the parent
      _b.copy(toPoint).sub(mp.p[bone]).normalize();
      _q2.setFromUnitVectors(_a, _b);
      _q.multiplyQuaternions(_q2, mp.q[par]);
      setModelRotation(pose, mp, bone, _q);
      mp.fk(pose);
    };
    for (const s of ['-1', '1']) {
      const sh = s === '1' ? B.shoulderR : B.shoulderL;
      limb(sh, x[I[`shoulder${s}`]]);
      limb(sh + 1, x[I[`elbow${s}`]]);
      limb(sh + 2, x[I[`wrist${s}`]]);
      // Hand: direction to the finger tips.
      const par = sh + 2;
      _a.copy(P[I[`tip${s}`]].bind).sub(P[I[`wrist${s}`]].bind).applyQuaternion(mp.q[par]).normalize();
      _b.copy(x[I[`tip${s}`]]).sub(x[I[`wrist${s}`]]).normalize();
      _q.multiplyQuaternions(_q2.setFromUnitVectors(_a, _b), mp.q[par]);
      setModelRotation(pose, mp, sh + 3, _q);
      mp.fk(pose);
      const th = s === '1' ? B.thighR : B.thighL;
      limb(th, x[I[`knee${s}`]]);
      limb(th + 1, x[I[`ankle${s}`]]);
      _a.copy(P[I[`toe${s}`]].bind).sub(P[I[`ankle${s}`]].bind).applyQuaternion(mp.q[th + 1]).normalize();
      _b.copy(x[I[`toe${s}`]]).sub(x[I[`ankle${s}`]]).normalize();
      _q.multiplyQuaternions(_q2.setFromUnitVectors(_a, _b), mp.q[th + 1]);
      setModelRotation(pose, mp, th + 2, _q);
      mp.fk(pose);
    }
  }

  // Gun transform from its three points (model space).
  gunXf(out) {
    if (!this.hasGun) return null;
    const [b, m, t] = this.gx;
    frameRotation(_a.copy(this.gl[1]).sub(this.gl[0]), _c.copy(this.gl[2]).sub(this.gl[0]), _b.copy(m).sub(b), _d.copy(t).sub(b), out.q);
    out.p.copy(this.gl[0]).applyQuaternion(out.q).negate().add(b);
    return out;
  }

  center(out) {
    return out.copy(this.x[I.pelvis]);
  }
}
