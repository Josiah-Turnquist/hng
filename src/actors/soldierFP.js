// First-person arms: the player's own sleeves and hands, cut from his outfit
// and person (so the cuffs, rolled sleeves, patches and skin match his soldier)
// and skinned to a flat copy of the soldier skeleton whose bones are placed in
// the view directly: shoulder to elbow to wrist by two-bone IK, the hand from
// the gun's grip anchors exactly as the third-person soldier holds it, the
// fingers closed round the grip.
//
//   const arms = new FirstPersonArms(textures, { faction, cls, seed, role });
//   scene.add(arms.root);
//   arms.setWeapon(gun, kind);   // a buildGun() result
//   arms.place(side, shoulder, gunXf | null, { point, mode, pole });
import * as THREE from 'three';
import { B, BIND, BONE_NAMES, BONE_COUNT, OFFSET, LEN, FINGER_BONES, HAND_JOINTS, Pose, fingerRotations, frameRotation, poseHand, quatFromAxes, PALM_X } from './soldierRig.js';
import { SkinBuilder } from './soldierGeo.js';
import { soldierMaterial } from './soldierMaterials.js';
import { buildOutfit, buildPerson, personParams, variantCount, mulberry } from './soldierKit.js';
import './soldierKitUS.js';
import './soldierKitGE.js';
import './soldierKitSU.js';
import { weaponInfo, handFromGun, Xf } from './soldierArms.js';

const ARM = {
  [-1]: new Set([B.upperArmL, B.forearmL, B.handL, ...Object.values(FINGER_BONES[-1]).flat()]),
  [1]: new Set([B.upperArmR, B.forearmR, B.handR, ...Object.values(FINGER_BONES[1]).flat()]),
};
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3(),
  _a = new THREE.Vector3(),
  _b = new THREE.Vector3(),
  _c = new THREE.Vector3(),
  _q = new THREE.Quaternion();
const _fc = new THREE.Vector3(),
  _fC = new THREE.Vector3(),
  _hn0 = new THREE.Vector3(),
  _ht0 = new THREE.Vector3(),
  _ht = new THREE.Vector3(),
  _hn = new THREE.Vector3(),
  _hf = new THREE.Vector3(),
  _hy = new THREE.Vector3(),
  _hz = new THREE.Vector3(),
  _hw = new THREE.Vector3(),
  _hs = new THREE.Vector3(),
  _he = new THREE.Vector3(),
  _hq = new THREE.Quaternion(),
  _ik = new THREE.Vector3(),
  _ik2 = new THREE.Vector3();
const DEG = Math.PI / 180;
// A fore-end lies in the cup of the palm, 6 cm from the wrist, sunk 4 mm into
// the flesh (est.).
const FORE_Y = -0.06,
  FORE_CUP = 0.004;

// What the support hand closes on, measured once per gun by rays across the
// real model at the left hand's anchor: a fore-end (or tube) running along the
// bore, as a circle as wide as the wood with its bottom at the wood's
// underside, or, when something hangs below the anchor (a magazine or its
// housing), that upright box, as a circle round its middle. Returns { c (gun
// space), r, axis (the held part's direction, gun space) } or null.
const _rc = new THREE.Raycaster();
function foreSection(root, info) {
  const L = info.anchors.gripL;
  root.updateMatrixWorld(true);
  // (Not the sling, which hangs below the wood.)
  const sling = info.parts?.sling;
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p === sling) return;
    meshes.push(o);
  });
  if (!meshes.length) return null;
  const M = root.matrixWorld,
    Mi = new THREE.Matrix4().copy(M).invert();
  // First surface met by a ray from o (gun space) along d, as a gun-space point.
  const cast = (o, d) => {
    _rc.set(_v.copy(o).applyMatrix4(M), _v2.copy(d).transformDirection(M));
    _rc.far = 0.4;
    const hit = _rc.intersectObjects(meshes, false)[0];
    return hit ? hit.point.applyMatrix4(Mi) : null;
  };
  const tube = info.leftGrip === 'tube';
  const ax = tube ? 0 : L.x,
    ay = tube ? 0 : L.y;
  const bottom = cast(new THREE.Vector3(ax, ay - 0.25, L.z), new THREE.Vector3(0, 1, 0));
  if (!bottom || bottom.y > ay + 0.03) return null;
  if (bottom.y < ay - 0.09) {
    // An upright part: its middle at the anchor's height.
    // (Rays from close by, so the grip and trigger guard behind are not met first.)
    const l = cast(new THREE.Vector3(L.x - 0.12, L.y, L.z), new THREE.Vector3(1, 0, 0));
    const rr = cast(new THREE.Vector3(L.x + 0.12, L.y, L.z), new THREE.Vector3(-1, 0, 0));
    const fr = cast(new THREE.Vector3(L.x, L.y, L.z - 0.1), new THREE.Vector3(0, 0, 1));
    const bk = cast(new THREE.Vector3(L.x, L.y, L.z + 0.05), new THREE.Vector3(0, 0, -1));
    if (!l || !rr || !fr || !bk || rr.x - l.x > 0.07 || bk.z - fr.z > 0.12 || bk.z < fr.z) return null;
    const r = Math.min(0.03, Math.max(0.012, (rr.x - l.x + (bk.z - fr.z)) / 4));
    return { c: new THREE.Vector3((l.x + rr.x) / 2, L.y, (fr.z + bk.z) / 2), r, axis: new THREE.Vector3(0, 1, 0) };
  }
  // The width 1.6 cm above the underside gives the circle through the bottom
  // (half width w at height h: r = (w^2 + h^2) / 2h; a box comes out about as
  // wide as it is, a tube as its own radius).
  const h = 0.016;
  const l = cast(new THREE.Vector3(ax - 0.25, bottom.y + h, L.z), new THREE.Vector3(1, 0, 0));
  const rr = cast(new THREE.Vector3(ax + 0.25, bottom.y + h, L.z), new THREE.Vector3(-1, 0, 0));
  if (!l || !rr || rr.x - l.x < 0.01) return null;
  const w = (rr.x - l.x) / 2;
  const r = Math.min(0.04, Math.max(0.012, (w * w + h * h) / (2 * h)));
  return { c: new THREE.Vector3((l.x + rr.x) / 2, bottom.y + r, L.z), r, axis: new THREE.Vector3(0, 0, -1) };
}

// What the fingers close on: the gun's outline round a hold (the wrist of the
// stock or the pistol grip in the right hand, the fore-end in the left), as
// cross sections along the held part. Each section is the gun sliced across,
// and for each of N directions out from the held part's middle line, the
// farthest surface met within reach (so hollows between parts count as filled,
// but not the trigger guard, a drum magazine or a slide further off). The hand
// is posed round a circle; a fore-end with a handguard over the barrel is
// taller than that, and fingers closed round the circle would come out through
// the top of the wood. Measured once per gun.
const PROFILE_N = 48;
const _pp = new THREE.Vector3(),
  _pq = new THREE.Vector3();
// The triangles of the gun's meshes (gun space; not the sling) near a stretch of
// line from a - axis * half to a + axis * half.
function holdTriangles(root, info, a, axis, half, reach = 0.1) {
  root.updateMatrixWorld(true);
  const sling = info.parts?.sling;
  const lo = new THREE.Vector3().copy(a).addScaledVector(axis, -half);
  const hi = new THREE.Vector3().copy(a).addScaledVector(axis, half);
  const box = new THREE.Box3().setFromPoints([lo, hi]).expandByScalar(reach);
  const Mi = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const M = new THREE.Matrix4();
  const out = [];
  const tri = new THREE.Box3();
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    for (let q = o; q; q = q.parent) if (q === sling) return;
    M.multiplyMatrices(Mi, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      for (let k = 0; k < 3; k++) p[k].fromBufferAttribute(pos, idx ? idx.getX(t + k) : t + k).applyMatrix4(M);
      if (!box.intersectsBox(tri.setFromPoints(p))) continue;
      for (let k = 0; k < 3; k++) out.push(p[k].x, p[k].y, p[k].z);
    }
  });
  return out;
}
// { c, axis, u, v, ts, r: [section][direction] } for a part held along axis
// through c (gun space), over c +- axis * half, out to reach from it.
function holdProfile(tris, c, axis, half, reach, sections = 5) {
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(axis)) > 0.9) u.set(0, 1, 0);
  u.addScaledVector(axis, -u.dot(axis)).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u);
  const ts = [],
    r = [];
  const d = [0, 0, 0];
  for (let s = 0; s < sections; s++) {
    const t = -half + (2 * half * s) / (sections - 1);
    const o = _pp.copy(c).addScaledVector(axis, t);
    // Slice: the segments where the plane through o cuts the triangles (2D, u v).
    const segs = [];
    for (let i = 0; i < tris.length; i += 9) {
      for (let k = 0; k < 3; k++) d[k] = (tris[i + 3 * k] - o.x) * axis.x + (tris[i + 3 * k + 1] - o.y) * axis.y + (tris[i + 3 * k + 2] - o.z) * axis.z;
      if ((d[0] > 0 && d[1] > 0 && d[2] > 0) || (d[0] < 0 && d[1] < 0 && d[2] < 0)) continue;
      const cut = [];
      for (let k = 0; k < 3; k++) {
        const k2 = (k + 1) % 3;
        if ((d[k] <= 0 && d[k2] > 0) || (d[k] > 0 && d[k2] <= 0)) {
          const w = d[k] / (d[k] - d[k2]);
          _pq.set(tris[i + 3 * k], tris[i + 3 * k + 1], tris[i + 3 * k + 2]);
          _pq.x += (tris[i + 3 * k2] - _pq.x) * w;
          _pq.y += (tris[i + 3 * k2 + 1] - _pq.y) * w;
          _pq.z += (tris[i + 3 * k2 + 2] - _pq.z) * w;
          _pq.sub(o);
          cut.push(_pq.dot(u), _pq.dot(v));
        }
      }
      if (cut.length === 4) segs.push(cut);
    }
    // The farthest crossing along each direction.
    const row = new Float32Array(PROFILE_N);
    for (let k = 0; k < PROFILE_N; k++) {
      const a = (k / PROFILE_N) * Math.PI * 2;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      for (const [ax, ay, bx, by] of segs) {
        const ex = bx - ax,
          ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const dist = (ax * ey - ay * ex) / den,
          w = (ax * dy - ay * dx) / den;
        if (w >= 0 && w <= 1 && dist > row[k] && dist <= reach) row[k] = dist;
      }
    }
    ts.push(t);
    r.push(row);
  }
  return { c: c.clone(), axis: axis.clone().normalize(), u, v, ts, r };
}
// Whether p (gun space) comes within margin of the outline (or inside it).
function inProfile(P, p, margin) {
  const rel = _pp.copy(p).sub(P.c);
  const t = rel.dot(P.axis);
  const ts = P.ts;
  if (t < ts[0] - margin || t > ts[ts.length - 1] + margin) return false;
  const x = rel.dot(P.u),
    y = rel.dot(P.v);
  const f = (Math.atan2(y, x) / (Math.PI * 2) + 1) * PROFILE_N;
  const k0 = Math.floor(f) % PROFILE_N,
    k1 = (k0 + 1) % PROFILE_N,
    wk = f - Math.floor(f);
  let s = 0;
  while (s < ts.length - 2 && t > ts[s + 1]) s++;
  const ws = Math.min(1, Math.max(0, (t - ts[s]) / (ts[s + 1] - ts[s])));
  const at = (row) => {
    const a = row[k0],
      b = row[k1];
    return a && b ? a + (b - a) * wk : Math.max(a, b);
  };
  const R0 = at(P.r[s]),
    R1 = at(P.r[s + 1]);
  const R = R0 && R1 ? R0 + (R1 - R0) * ws : Math.max(R0, R1);
  return R > 0 && Math.hypot(x, y) < R + margin;
}
// A finger's joints in the hand's frame: knuckle offset, the second bone's
// offset from it, and the tip from the second bone; finger half thickness.
const FINGER_R = { index: 0.0088, middle: 0.009, ring: 0.0086, pinky: 0.0078 };
const SINK = 0.0045; // how far a finger's flesh may sink into the gun (m)
const TIP = {};
for (const side of [-1, 1])
  for (const f of Object.keys(FINGER_R)) {
    const J = HAND_JOINTS[f];
    TIP[`${side}${f}`] = new THREE.Vector3(side * (J[3][0] - J[1][0]), J[3][1] - J[1][1], J[3][2] - J[1][2]);
  }
// Where a finger is tested ([from, to, fraction]): on its first bone (part 0)
// halfway along and at the middle knuckle; on the rest (part 1) three points
// out to the tip.
const SAMPLES = (k, m, t, part) =>
  part === 0
    ? [
        [k, m, 0.5],
        [k, m, 1],
      ]
    : [
        [m, t, 0.35],
        [m, t, 0.7],
        [m, t, 1],
      ];
const PROFILES = new WeakMap(); // gun root -> { R, L } (FirstPersonArms._profiles)
const _fq1 = new THREE.Quaternion(),
  _fq2 = new THREE.Quaternion(),
  _fk = new THREE.Vector3(),
  _fm = new THREE.Vector3(),
  _ft = new THREE.Vector3(),
  _fw = new THREE.Vector3(),
  _fGi = new THREE.Quaternion();

// Two-bone arm IK for the first-person arms: the elbow for wrist W, bending
// toward pole. When W is out of the arm's reach (or too close), the shoulder,
// which is never in view, is moved along the line to it, so the forearm always
// ends exactly at the wrist. Writes the shoulder used to outS, the elbow to outE.
function armIK(S, W, pole, outS, outE) {
  const L1 = LEN.upperArm,
    L2 = LEN.forearm;
  const d = _ik.copy(W).sub(S);
  const dist = d.length() || 1e-6;
  d.divideScalar(dist);
  const want = Math.min(L1 + L2 - 0.004, Math.max(Math.abs(L1 - L2) + 0.02, dist));
  outS.copy(W).addScaledVector(d, -want);
  const a = (L1 * L1 - L2 * L2 + want * want) / (2 * want);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const p = _ik2.copy(pole).addScaledVector(d, -pole.dot(d));
  if (p.lengthSq() < 1e-10) p.set(0, -1, 0).addScaledVector(d, d.y);
  p.normalize();
  return outE.copy(outS).addScaledVector(d, a).addScaledVector(p, h);
}

// Copy the triangles of a builder that belong to the arms (by their dominant
// bone); anything else they lean on (shoulder cap: clavicle, chest) is moved
// onto the upper arm of that side.
function cutArms(src, dst) {
  const map = new Map();
  const dom = (i) => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (src.sw[i * 4 + k] > src.sw[i * 4 + best]) best = k;
    return src.si[i * 4 + best];
  };
  const sideOf = (bone) => (ARM[1].has(bone) ? 1 : ARM[-1].has(bone) ? -1 : 0);
  const add = (i, side) => {
    let j = map.get(i);
    if (j !== undefined) return j;
    j = dst.count;
    dst.pos.push(src.pos[i * 3], src.pos[i * 3 + 1], src.pos[i * 3 + 2]);
    dst.nor.push(src.nor[i * 3], src.nor[i * 3 + 1], src.nor[i * 3 + 2]);
    dst.uv.push(src.uv[i * 2], src.uv[i * 2 + 1]);
    dst.col.push(src.col[i * 3], src.col[i * 3 + 1], src.col[i * 3 + 2]);
    dst.mat.push(src.mat[i * 2], src.mat[i * 2 + 1]);
    dst.prim.push(0);
    for (let k = 0; k < 4; k++) {
      const b = src.si[i * 4 + k];
      dst.si.push(ARM[side].has(b) ? b : side > 0 ? B.upperArmR : B.upperArmL);
      dst.sw.push(src.sw[i * 4 + k]);
    }
    map.set(i, j);
    return j;
  };
  for (let t = 0; t < src.idx.length; t += 3) {
    const a = src.idx[t],
      b = src.idx[t + 1],
      c = src.idx[t + 2];
    const sa = sideOf(dom(a)),
      sb = sideOf(dom(b)),
      sc = sideOf(dom(c));
    if (!sa || sa !== sb || sa !== sc) continue;
    dst.idx.push(add(a, sa), add(b, sa), add(c, sa));
  }
  return dst;
}

export class FirstPersonArms {
  constructor(textures, { faction = 'US', cls = 'infantry', seed = 1, role = 'rifle', variant } = {}) {
    this.root = new THREE.Group();
    this.root.name = 'fp-arms';
    this.bones = BONE_NAMES.map((n) => {
      const b = new THREE.Bone();
      b.name = n;
      this.root.add(b);
      return b;
    });
    this.skeleton = new THREE.Skeleton(
      this.bones,
      BIND.map((p) => new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z)),
    );
    this.material = soldierMaterial(textures, { viewmodel: true });
    this.pose = new Pose();
    this.info = null;
    this.mesh = null;
    this.setOutfit({ faction, cls, seed, role, variant });
  }

  // Rebuild the arms for a soldier (the same seed rules as SoldierModel).
  setOutfit({ faction = 'US', cls = 'infantry', seed = 1, role = 'rifle', variant } = {}) {
    const rng = mulberry(seed * 9973 + 17);
    const v0 = Math.floor(rng() * 1000);
    const person = personParams(faction, rng);
    const nv = variantCount(faction, cls);
    // (Without the baked shading of the body round them: these arms are held up.)
    const { b, info } = buildOutfit(faction, cls, (variant ?? v0) % nv, 0, role, { bakes: false });
    const arms = cutArms(b, new SkinBuilder(1));
    cutArms(buildPerson(person, 0, info), arms);
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.root.remove(this.mesh);
    }
    const geo = arms.toGeometry();
    const m = new THREE.SkinnedMesh(geo, this.material);
    m.bind(this.skeleton, new THREE.Matrix4());
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    this.mesh = m;
    this.root.add(m);
    this.key = `${faction}|${cls}|${seed}|${role}|${variant}`;
  }

  setWeapon(gun, kind) {
    this.info = gun ? weaponInfo(gun, kind) : null;
    this.fore = this.info?.anchors.gripL ? foreSection(gun.root || gun, this.info) : null;
    this.profiles = gun ? this._profiles(gun.root || gun) : null;
    this.cuts = new Map(); // how far each finger may close, per hold (_clearFingers)
    this._occ(null);
  }

  // What the eye sees through a peep sight close to it, in gun space: a cone
  // from the eye along the line of sight, widening by slope (the hole's radius
  // over its distance from the eye); null for other sights.
  setView(view) {
    this.view = view;
    this.cuts?.clear();
  }

  // The outlines the fingers close on (holdProfile), where the circle the hand
  // is posed round is a poor fit: a long gun's fore-end (a handguard over the
  // barrel makes it taller than it is wide) in the left hand, and the wrist of
  // its stock (sloped well back, 0.7 rad or more from upright) in the right. A
  // pistol grip or a magazine is near enough round, and fingers pressed a
  // little into it hide themselves. Once per gun.
  _profiles(root) {
    let P = PROFILES.get(root);
    if (P) return P;
    const info = this.info;
    const g = info.gripAxis;
    P = { R: null, L: null };
    // (Out to 4.5 cm round the wrist, 5 cm round the fore-end with its handguard.)
    if (g.z >= Math.sin(0.7)) P.R = holdProfile(holdTriangles(root, info, info.anchors.gripR, g, 0.05), info.anchors.gripR, g, 0.05, 0.045);
    const F = this.fore;
    if (F && info.leftGrip === 'fore' && Math.abs(F.axis.z) > 0.9) P.L = holdProfile(holdTriangles(root, info, F.c, F.axis, 0.06), F.c, F.axis, 0.06, 0.05);
    PROFILES.set(root, P);
    return P;
  }

  // Fingers kept off the gun's real outline (holdProfile): a finger the hand's
  // pose puts into the wood (more than SINK: a finger pressed a little into a
  // grip hides itself, one pushed further comes out through the wood) takes
  // instead the bend of its two knuckles nearest to that pose which keeps it
  // out, so it ends against the wood. For a given hold the hand always sits
  // the same way on the gun, so this is worked out once per hold and kept.
  // (The right index stays on the trigger.)
  _clearFingers(side, H, G, key) {
    const P = side > 0 ? this.profiles?.R : this.profiles?.L;
    if (!P || !key || !this.pose.fingers) return;
    let cut = this.cuts.get(key);
    if (!cut) {
      cut = {};
      _fGi.copy(G.q).invert();
      const toGun = (p) => p.applyQuaternion(H.q).add(H.p).sub(G.p).applyQuaternion(_fGi);
      for (const name of Object.keys(FINGER_R)) {
        if (side > 0 && name === 'index') continue;
        const [A1, A2, sp] = this.pose.fingers[name];
        const margin = FINGER_R[name] - SINK;
        // The left fingers also keep out of what the eye sees through a peep
        // sight (setView), with their flesh: a fingertip at the top of a fore-end
        // that runs just under the line of sight would show in it.
        const V = side < 0 ? this.view : null,
          fr = FINGER_R[name] * 0.8;
        // Whether the first bone (part 0), or the rest (part 1), is clear of the gun with the knuckles bent a1, a2.
        const clear = (a1, a2, part) => {
          fingerRotations(side, a1, a2, sp, _fq1, _fq2);
          _fq2.premultiply(_fq1);
          const k = _fk.copy(OFFSET[FINGER_BONES[side][name][0]]);
          const m = _fm.copy(OFFSET[FINGER_BONES[side][name][1]]).applyQuaternion(_fq1).add(k);
          const t = _ft.copy(TIP[`${side}${name}`]).applyQuaternion(_fq2).add(m);
          for (const [a, b, w] of SAMPLES(k, m, t, part)) {
            const g = toGun(_fw.copy(a).lerp(b, w));
            if (inProfile(P, g, margin)) return false;
            if (V) {
              const rel = _pq.copy(g).sub(V.eye);
              const along = rel.dot(V.dir);
              if (along > 0 && rel.addScaledVector(V.dir, -along).length() < along * V.slope + fr) return false;
            }
          }
          return true;
        };
        // As posed if that is clear; else the clear bend of the two knuckles
        // nearest to it (so the finger ends against the wood, or just out of the
        // sight picture), looked for on a grid of bends. Left as posed when no
        // bend is clear.
        if (clear(A1, A2, 0) && clear(A1, A2, 1)) continue;
        let best = null,
          bestD = Infinity;
        for (let i = 0; i <= 12; i++) {
          const a1 = (A1 * i) / 12;
          if (!clear(a1, 0, 0)) continue; // (the first bone does not depend on the middle knuckle)
          for (let j = 0; j <= 18; j++) {
            const a2 = (2.3 * j) / 18;
            const d = Math.abs(a1 - A1) + 0.7 * Math.abs(a2 - A2);
            if (d < bestD && clear(a1, a2, 1)) {
              bestD = d;
              best = [a1, a2];
            }
          }
        }
        if (best) cut[name] = [best[0], best[1], sp, A1, A2]; // (and as posed, for the tests)
      }
      this.cuts.set(key, cut);
    }
    for (const name in cut) {
      const [b1, b2] = FINGER_BONES[side][name];
      fingerRotations(side, cut[name][0], cut[name][1], cut[name][2], this.pose.q[b1], this.pose.q[b2]);
    }
  }

  // The gun's occluding capsules for the arms' shading (soldierMaterial, first
  // person): the fore-end (or launcher tube, or front grip) round the left
  // hand's hold, the grip in the right hand, and the stock between them.
  // Sizes from the hold radii (est. stock 4 cm deep).
  _occ(G) {
    const u = this.material.userData.gunOcc?.value;
    if (!u) return;
    const info = this.info;
    if (!info || !G) {
      for (const v of u) v.set(0, 0, 0, 0);
      return;
    }
    const an = info.anchors;
    // (G: the gun's world transform { q, p }.)
    const set = (i, a, b, r) => {
      _v.copy(a).applyQuaternion(G.q).add(G.p);
      _v2.copy(b).applyQuaternion(G.q).add(G.p);
      u[i * 2].set(_v.x, _v.y, _v.z, r);
      u[i * 2 + 1].set(_v2.x, _v2.y, _v2.z, 0);
    };
    const rake = info.meta.gripRake ?? (info.kind === 'rifle' ? 0.9 : 0.42);
    const g = _v3.set(0, -Math.cos(rake), Math.sin(rake));
    set(1, _a.copy(an.gripR).addScaledVector(g, -0.05), _b.copy(an.gripR).addScaledVector(g, 0.05), info.gripRadius);
    if (an.gripL) {
      const L = an.gripL;
      if (info.leftGrip === 'vertical') {
        const gl = _v3.set(0, -Math.cos(0.3), Math.sin(0.3));
        set(0, _a.copy(L).addScaledVector(gl, -0.045), _b.copy(L).addScaledVector(gl, 0.045), 0.017);
      } else {
        const c = info.leftGrip === 'tube' ? _c.set(0, 0, L.z) : _c.copy(L);
        set(0, _a.copy(c).setZ(c.z + 0.11), _b.copy(c).setZ(c.z - 0.11), info.foreRadius);
      }
      if (info.leftGrip !== 'tube' && info.kind !== 'pistol') set(2, _a.copy(an.gripR).lerp(L, 0.15), _b.copy(an.gripR).lerp(L, 0.85), 0.02);
      else u[4].w = 0;
    } else {
      u[0].w = 0;
      u[4].w = 0;
    }
  }

  // The support hand on a fore-end (or a launcher's tube), as the shooter sees
  // it. The hand can roll round the fore-end and turn along it; of the ways a
  // hand really cups one (the palm under it, rolled up to 50 deg onto its left
  // side; the fingers straight across it to 50 deg forward, so that it lies
  // diagonally in the palm from the heel of the hand to the root of the index)
  // take the one that keeps the wrist straightest for the line the forearm
  // comes in on from its shoulder. The fore-end lies in the cup of the palm, not
  // at the finger roots as a grip does. Writes the hand's world transform to H
  // and returns the hold's slope across the hand (for the fingers' wrap).
  _foreHold(G, S, pole, H) {
    const { r, axis: A } = this.fore;
    const c = _fc.copy(this.fore.c);
    // The held part's axis in the hand's frame (left hand: +x toward the palm).
    const C = _fC.set(PALM_X + r - FORE_CUP, FORE_Y, 0);
    // Rest hold: a fore-end on the palm (palm up, fingers across to the right);
    // an upright magazine against it (palm facing right, fingers round its
    // front, the thumb up toward the receiver). Then rolled round the axis by
    // th (toward the left side / the back) and turned along it by al.
    const upright = A.y > 0.5;
    const n0 = upright ? _hn0.set(1, 0, 0) : _hn0.set(0, 1, 0);
    const t0 = _ht0.crossVectors(A, n0);
    // (Preferred: rolled a little onto the fore-end's near side, so the shooter
    // sees the knuckles along it and the thumb lies along its left flank.)
    const [th0, th1, thPref, alPref] = upright ? [-20, 40, 10, 10] : [15, 45, 30, 30];
    let best = Infinity,
      tilt = 0;
    for (let ti = 0; ti <= 6; ti++)
      for (let ai = 0; ai <= 5; ai++) {
        const th = (th0 + ((th1 - th0) * ti) / 6) * DEG,
          al = (upright ? -10 + ai * 8 : ai * 10) * DEG;
        // Palm normal (toward the axis), the way across the part, wrist -> knuckles.
        const n = _hn.copy(n0).multiplyScalar(Math.cos(th)).addScaledVector(t0, Math.sin(th));
        const t = _ht.copy(t0).multiplyScalar(Math.cos(th)).addScaledVector(n0, -Math.sin(th));
        const f = _hf.copy(t).multiplyScalar(Math.cos(al)).addScaledVector(A, Math.sin(al));
        const y = _hy.copy(f).negate();
        const z = _hz.crossVectors(n, y);
        quatFromAxes(n, y, z, _hq);
        const W = _hw.copy(C).applyQuaternion(_hq).negate().add(c).applyQuaternion(G.q).add(G.p);
        armIK(S, W, pole, _hs, _he);
        const fa = _v.copy(W).sub(_he).normalize();
        const bend = Math.acos(Math.max(-1, Math.min(1, fa.dot(_v2.copy(f).applyQuaternion(G.q)))));
        const cost = bend + 1.0 * Math.abs(th - thPref * DEG) + 0.15 * Math.abs(al - alPref * DEG);
        if (cost < best) {
          best = cost;
          H.q.copy(G.q).multiply(_hq);
          H.p.copy(W);
          tilt = Math.tan(al);
          this._holdKey = ti * 8 + ai;
        }
      }
    return tilt;
  }

  // Place one arm. side 1 right, -1 left; shoulder: world position of the
  // shoulder joint; G: the gun's world transform (Xf); target: { mode: 'grip' |
  // 'point' | 'hidden', point (world, for 'point'), pole (world direction the
  // elbow bends toward), curl: [fingers, index, thumb] }.
  place(side, shoulder, G, target) {
    const info = this.info;
    if (side > 0 || !this._occSet) this._occ(info ? G : null);
    this._occSet = true;
    const hb = side > 0 ? B.handR : B.handL;
    const ua = side > 0 ? B.upperArmR : B.upperArmL;
    const H = (this._h ||= { [1]: new Xf(), [-1]: new Xf() })[side];
    // The support hand on a fore-end or tube ahead of the trigger.
    const fore = side < 0 && info && G && this.fore && target.mode === 'grip' && (info.leftGrip === 'fore' || info.leftGrip === 'tube') && info.anchors.gripL.z < info.anchors.gripR.z - 0.12;
    let tilt = 0;
    if (side < 0) this.foreHeld = !!fore;
    if (fore) tilt = this._foreHold(G, shoulder, target.pole, H);
    else if (info && G && target.mode !== 'point' && (side > 0 || info.qLG)) {
      handFromGun(G, side > 0 ? info.qHG : info.qLG, side > 0 ? info.tHG : info.tLG, H);
    } else if (info && G) {
      // Work with the fingertips at a point (bolt, magazine, clip), the hand
      // turned as on its grip.
      if (side > 0 || info.qLG) handFromGun(G, side > 0 ? info.qHG : info.qLG, side > 0 ? info.tHG : info.tLG, H);
      else H.q.copy(G.q);
      const tip = _v.set(side * -0.02, -0.11, -0.025).applyQuaternion(H.q);
      H.p.copy(target.point).sub(tip);
    }
    // Two-bone IK, the elbow on the side of the pole; the unseen shoulder gives
    // way along the arm when the hand is out of reach, so the hand always meets
    // the end of the forearm.
    const W = H.p;
    const S = (this._s ||= new THREE.Vector3());
    const E = (this._e ||= new THREE.Vector3());
    armIK(shoulder, W, target.pole, S, E);
    // How far the shoulder had to give (m; tests and tuning).
    (this.shoulderShift ||= { [1]: 0, [-1]: 0 })[side] = S.distanceTo(shoulder);
    const set = (bone, pos, q) => {
      this.bones[bone].position.copy(pos);
      this.bones[bone].quaternion.copy(q);
    };
    // Upper arm: the bind segment onto shoulder -> elbow, the forearm's side as the bend.
    const qU = new THREE.Quaternion();
    const d0 = new THREE.Vector3().copy(BIND[ua + 1]).sub(BIND[ua]),
      fwd = new THREE.Vector3(0, 0, -1);
    frameRotation(d0, fwd, new THREE.Vector3().copy(E).sub(S), new THREE.Vector3().copy(W).sub(E), qU);
    set(ua, S, qU);
    // Forearm: twisted with the hand (its thumb side).
    const qF = new THREE.Quaternion();
    d0.copy(BIND[ua + 2]).sub(BIND[ua + 1]);
    frameRotation(d0, fwd, new THREE.Vector3().copy(W).sub(E), new THREE.Vector3(0, 0, -1).applyQuaternion(H.q), qF);
    set(ua + 1, E, qF);
    set(hb, W, H.q);
    // Fingers: closed round the grip; on a fore-end round the wood in the palm,
    // the thumb along its side.
    let c = target.curl || [1, 0.55, 0.8];
    if (fore) c = [Math.max(c[0], 0.95), Math.max(c[1], 0.92), 1];
    const wrap = target.mode === 'grip' && info ? (side > 0 ? info.gripRadius : fore ? this.fore.r : info.leftGrip === 'vertical' ? 0.017 : info.foreRadius) : 0;
    poseHand(this.pose, side, c[0], c[1], c[2], 0, wrap, fore ? { cy: FORE_Y, cup: FORE_CUP, tilt, thumbAlong: true } : undefined);
    if (target.mode === 'grip' && info && G && (side > 0 || fore)) this._clearFingers(side, H, G, `${side > 0 ? 'R' : `L${this._holdKey}`}|${c.join(',')}`);
    for (const name of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      const [b1, b2] = FINGER_BONES[side][name];
      const q1 = _q.copy(H.q).multiply(this.pose.q[b1]);
      const p1 = _v.copy(OFFSET[b1]).applyQuaternion(H.q).add(W);
      set(b1, p1, q1);
      const q2 = new THREE.Quaternion().copy(q1).multiply(this.pose.q[b2]);
      set(b2, _v2.copy(OFFSET[b2]).applyQuaternion(q1).add(p1), q2);
    }
    this.mesh.visible = true;
  }

  // How far the hand bone is from the end of the forearm (m): zero when the arm
  // holds together (tests).
  wristGap(side) {
    const fa = this.bones[side > 0 ? B.forearmR : B.forearmL];
    const end = _v.copy(BIND[side > 0 ? B.handR : B.handL]).sub(BIND[side > 0 ? B.forearmR : B.forearmL]).applyQuaternion(fa.quaternion).add(fa.position);
    return end.distanceTo(this.bones[side > 0 ? B.handR : B.handL].position);
  }

  dispose() {
    this.mesh?.geometry.dispose();
    this.root.removeFromParent();
  }
}
export { BONE_COUNT, inProfile };
