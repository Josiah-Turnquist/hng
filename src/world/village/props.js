// Defensive props and clutter. Repeated pieces are InstancedMeshes (one draw call per
// kind): sandbags, crates, barrels, Czech hedgehogs, telegraph poles, hay bales.
// Barbed wire and telegraph wires are thin line segments (visual only). Carts and
// rubble heaps are merged into the village batches.
import * as THREE from 'three';
import { RNG } from '../../core/math.js';
import { FLAG_SOLID, FLAG_DEFAULT } from '../../physics/collision.js';
import { VillageBuilder, mat4 } from './geom.js';
import { WOOD, rgb, scale } from './materials.js';
import { rubblePile } from './parts.js';

const TAU = Math.PI * 2;

// Build a geometry for one material with the village modeling tools.
export function protoGeometry(materials, matKey, fn) {
  const tmp = new VillageBuilder({ materials, collision: null, chunkSize: 1e9 });
  const f = tmp.frame(0, 0, 0, 0, { chunk: 'p', uvOff: [0, 0, 0] });
  fn(f);
  const b = tmp.buckets.get(`${matKey}|p`);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setIndex(b.idx);
  return g;
}

class Instancer {
  constructor(name, geometry, material) {
    this.name = name;
    this.geometry = geometry;
    this.material = material;
    this.items = [];
  }
  add(x, y, z, yaw = 0, pitch = 0, roll = 0, s = 1, color = null) {
    this.items.push({ x, y, z, yaw, pitch, roll, s, color });
  }
  build() {
    if (!this.items.length) return null;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.items.length);
    mesh.name = `village:${this.name}`;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const c = new THREE.Color();
    this.items.forEach((it, i) => {
      e.set(it.pitch, it.yaw, it.roll, 'YXZ');
      q.setFromEuler(e);
      p.set(it.x, it.y, it.z);
      if (Array.isArray(it.s)) sc.set(it.s[0], it.s[1], it.s[2]);
      else sc.set(it.s, it.s, it.s);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
      if (it.color) mesh.setColorAt(i, c.setRGB(it.color[0], it.color[1], it.color[2]));
      else mesh.setColorAt(i, c.setRGB(1, 1, 1));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

// Sandbag: a pinched six-sided pillow 0.56 x 0.15 x 0.34 m.
function sandbagGeometry() {
  const prof = [
    [-0.17, 0.0],
    [-0.11, -0.072],
    [0.11, -0.072],
    [0.17, 0.0],
    [0.11, 0.072],
    [-0.11, 0.072],
  ];
  const rings = [
    [-0.28, 0.72],
    [-0.16, 1.0],
    [0.16, 1.0],
    [0.28, 0.72],
  ];
  const pos = [],
    uv = [],
    idx = [];
  rings.forEach(([x, s], ri) => {
    prof.forEach(([z, y], pi) => {
      pos.push(x, y * (0.8 + 0.2 * s), z * s);
      uv.push((x + 0.28) / 0.6, (pi / prof.length) * 0.7);
    });
  });
  const n = prof.length;
  for (let r = 0; r < rings.length - 1; r++)
    for (let k = 0; k < n; k++) {
      const a = r * n + k,
        b = r * n + ((k + 1) % n),
        c = (r + 1) * n + k,
        d = (r + 1) * n + ((k + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  // End caps.
  const last = (rings.length - 1) * n;
  for (let k = 1; k < n - 1; k++) {
    idx.push(0, k, k + 1);
    idx.push(last, last + k + 1, last + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  return g;
}

function barrelGeometry() {
  // Lathe profile with dark hoop bands (duplicate rings for crisp color edges).
  const ys = [0, 0.05, 0.09, 0.24, 0.28, 0.6, 0.64, 0.79, 0.83, 0.88];
  const rAt = (y) => 0.27 + 0.045 * Math.sin((y / 0.88) * Math.PI);
  const pts = [new THREE.Vector2(0.001, 0)];
  const cols = [0.2];
  for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    const hoop = (y >= 0.05 && y <= 0.09) || (y >= 0.24 && y <= 0.28) || (y >= 0.6 && y <= 0.64) || (y >= 0.79 && y <= 0.83);
    pts.push(new THREE.Vector2(rAt(y) + 0.004, y));
    cols.push(hoop ? 0.25 : 1);
  }
  pts.push(new THREE.Vector2(0.001, 0.88));
  cols.push(0.8);
  const g = new THREE.LatheGeometry(pts, 12);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let best = 0,
      bd = Infinity;
    for (let k = 0; k < pts.length; k++) {
      const d = Math.abs(pts[k].y - y);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    const c = cols[best];
    col[i * 3] = c;
    col[i * 3 + 1] = c * 0.95;
    col[i * 3 + 2] = c * 0.9;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 1.8) / 1.4, (uv.getY(i) * 1.0) / 1.4);
  return g;
}

function hedgehogGeometry() {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    // An L-section angle iron: two thin plates.
    for (const [w, h] of [[0.12, 0.012], [0.012, 0.12]]) {
      const b = new THREE.BoxGeometry(w, h, 2.0);
      b.translate(w > h ? 0.05 : 0, w > h ? 0 : 0.05, 0);
      if (k === 1) b.rotateY(Math.PI / 2);
      if (k === 2) b.rotateX(Math.PI / 2);
      parts.push(b);
    }
  }
  // Tip the cross so it stands on three ends.
  const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 1, 0)));
  const pos = [],
    nor = [],
    idx = [];
  let base = 0;
  for (const p of parts) {
    p.applyMatrix4(m);
    const pa = p.attributes.position,
      na = p.attributes.normal;
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i) + 0.6, pa.getZ(i));
      nor.push(na.getX(i), na.getY(i), na.getZ(i));
    }
    for (const i of p.index.array) idx.push(base + i);
    base += pa.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  g.setIndex(idx);
  return g;
}

export function buildProps(B, plan, ctx) {
  const mats = ctx.mats;
  const hf = ctx.hf;
  const group = new THREE.Group();
  group.name = 'village-props';
  const inst = {
    sandbag: new Instancer('sandbags', sandbagGeometry(), mats.burlap),
    crate: new Instancer('crates', protoGeometry(mats, 'wood', (f) => {
      f.box('wood', -0.4, 0, -0.3, 0.4, 0.6, 0.3, { color: rgb(0.85, 0.75, 0.6) });
      for (const sx of [-1, 1]) f.box('wood', sx * 0.4 - 0.03, 0.02, -0.31, sx * 0.4 + 0.03, 0.58, 0.31, { color: rgb(0.6, 0.5, 0.38) });
      for (const y of [0.03, 0.57]) f.box('wood', -0.42, y - 0.025, -0.31, 0.42, y + 0.025, 0.31, { color: rgb(0.6, 0.5, 0.38) });
    }), mats.wood),
    barrel: new Instancer('barrels', barrelGeometry(), mats.wood),
    hedgehog: new Instancer('hedgehogs', hedgehogGeometry(), mats.iron),
    pole: new Instancer('poles', protoGeometry(mats, 'wood', (f) => {
      f.geometry('wood', new THREE.CylinderGeometry(0.09, 0.13, 7.6, 8), mat4(0, 3.6, 0), { color: rgb(0.75, 0.7, 0.62) });
      f.box('wood', -0.8, 6.85, -0.05, 0.8, 6.97, 0.05, { color: rgb(0.7, 0.66, 0.6) });
      for (const x of [-0.65, -0.25, 0.25, 0.65]) f.geometry('wood', new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), mat4(x, 7.03, 0), { color: rgb(2.2, 2.2, 2.1) });
      f.beam('wood', -0.5, 6.4, 0, -0.05, 6.86, 0, 0.05, 0.05, { color: rgb(0.7, 0.66, 0.6) });
      f.beam('wood', 0.5, 6.4, 0, 0.05, 6.86, 0, 0.05, 0.05, { color: rgb(0.7, 0.66, 0.6) });
    }), mats.wood),
    bale: new Instancer('bales', protoGeometry(mats, 'hay', (f) => {
      f.box('hay', -0.48, 0, -0.24, 0.48, 0.42, 0.24);
    }), mats.hay),
  };
  const wire = [];

  for (const p of plan.props) {
    const y = hf.getHeight(p.x, p.z);
    const r = new RNG(Math.floor(p.x * 1013 + p.z * 7919) >>> 0);
    switch (p.kind) {
      case 'sandbags':
        sandbagWall(B, inst.sandbag, p, y, r, hf);
        break;
      case 'crate': {
        inst.crate.add(p.x, y - 0.02, p.z, p.yaw, 0, 0, 1, scale([1, 1, 1], r.range(0.8, 1.1)));
        B.addCollider(p.x, y + 0.3, p.z, 0.4, 0.3, 0.3, p.yaw, 0, 0, 'wood', FLAG_DEFAULT, { nav: true, tag: 'crate' });
        if (p.stack) {
          inst.crate.add(p.x + r.range(-0.1, 0.1), y + 0.6, p.z + r.range(-0.1, 0.1), p.yaw + r.range(-0.3, 0.3), 0, 0, 1, scale([1, 1, 1], r.range(0.8, 1.1)));
          B.addCollider(p.x, y + 0.9, p.z, 0.4, 0.3, 0.3, p.yaw, 0, 0, 'wood', FLAG_DEFAULT, { nav: false, tag: 'crate' });
        }
        coverAround(B, p.x, y, p.z, 0.9, p.stack ? 'high' : 'low');
        break;
      }
      case 'barrel': {
        const tipped = r.chance(0.15);
        if (tipped) {
          inst.barrel.add(p.x, y + 0.3, p.z, p.yaw, 0, Math.PI / 2, 1, [0.9, 0.8, 0.75]);
          B.addCollider(p.x, y + 0.3, p.z, 0.44, 0.3, 0.3, p.yaw, 0, 0, 'wood', FLAG_DEFAULT, { nav: false, tag: 'barrel' });
        } else {
          inst.barrel.add(p.x, y, p.z, p.yaw, 0, 0, 1, scale([1, 1, 1], r.range(0.75, 1.05)));
          B.addCollider(p.x, y + 0.44, p.z, 0.3, 0.44, 0.3, p.yaw, 0, 0, 'wood', FLAG_DEFAULT, { nav: true, tag: 'barrel' });
        }
        break;
      }
      case 'hedgehog':
        inst.hedgehog.add(p.x, y - 0.05, p.z, p.yaw, 0, 0, 1, [0.55, 0.45, 0.38]);
        B.addCollider(p.x, y + 0.6, p.z, 0.75, 0.6, 0.75, p.yaw, 0, 0, 'steel', FLAG_SOLID, { nav: true, tag: 'hedgehog' });
        coverAround(B, p.x, y, p.z, 1.0, 'low');
        break;
      case 'wire':
        wireObstacle(B, wire, p, hf, r);
        break;
      case 'cart':
        cart(B, p, y, r, false);
        break;
      case 'haycart':
        cart(B, p, y, r, true);
        break;
      case 'bale':
        inst.bale.add(p.x, y - 0.02, p.z, p.yaw, 0, 0, 1, scale([1, 1, 1], r.range(0.85, 1.1)));
        B.addCollider(p.x, y + 0.21, p.z, 0.48, 0.21, 0.24, p.yaw, 0, 0, 'wood', FLAG_DEFAULT, { nav: false, tag: 'bale' });
        if (p.stack) {
          inst.bale.add(p.x + 0.05, y + 0.42, p.z, p.yaw + 0.1, 0, 0, 1);
          B.addCollider(p.x, y + 0.63, p.z, 0.48, 0.21, 0.24, p.yaw, 0, 0, 'wood', FLAG_DEFAULT, { nav: false, tag: 'bale' });
        }
        break;
      case 'debris': {
        const f = B.frame(p.x, y, p.z, p.yaw, { tag: 'debris' });
        rubblePile(f, 0, 0, 0, 0.9 * p.size, 0.7 * p.size, 0.45 * p.size, { seed: r.int(0, 1e6), beams: r.chance(0.4) ? 1 : 0, collide: true });
        break;
      }
      default:
        break;
    }
  }
  // Telegraph poles and wires.
  const poles = plan.poles || [];
  for (const pl of poles) {
    inst.pole.add(pl.x, pl.y - 0.4, pl.z, pl.yaw, 0, 0, 1, null);
    B.addCollider(pl.x, pl.y + 3.4, pl.z, 0.12, 3.8, 0.12, 0, 0, 0, 'wood', FLAG_DEFAULT, { nav: true, tag: 'pole' });
  }
  for (let i = 0; i < poles.length; i++) {
    const a = poles[i];
    if (a.link < 0) continue;
    const b = poles[a.link];
    const span = Math.hypot(a.x - b.x, a.z - b.z);
    if (span > 70) continue;
    for (const off of [-0.65, -0.25, 0.25, 0.65]) {
      const pa = armPoint(a, off),
        pb = armPoint(b, off);
      const sag = 0.25 + span * span * 0.00018;
      const n = 10;
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const pt = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t - sag * 4 * t * (1 - t), pa[2] + (pb[2] - pa[2]) * t];
        if (prev) wire.push(...prev, ...pt);
        prev = pt;
      }
    }
  }
  for (const key of Object.keys(inst)) {
    const m = inst[key].build();
    if (m) group.add(m);
  }
  if (wire.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a2724 }));
    lines.name = 'village:wire';
    lines.frustumCulled = false;
    group.add(lines);
  }
  return group;
}

function armPoint(pl, off) {
  // The crossarm (pole local x) runs across the road; wires run along it.
  return [pl.x + Math.cos(pl.yaw) * off, pl.y - 0.4 + 7.06, pl.z - Math.sin(pl.yaw) * off];
}

function coverAround(B, x, y, z, d, h) {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) B.coverPoints.push({ x: +(x + dx * d).toFixed(2), y: +y.toFixed(2), z: +(z + dz * d).toFixed(2), nx: -dx, nz: -dz, height: h });
}

// Sandbag walls: courses of bags in a running bond, two rows thick.
function sandbagWall(B, inst, p, y0, r, hf) {
  const h = p.h ?? 1.1;
  const courses = Math.max(3, Math.round(h / 0.14));
  const segs = [];
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw);
  const L = (lx, lz) => [p.x + c * lx + s * lz, p.z - s * lx + c * lz];
  const len = p.len ?? 3;
  const dep = p.depth ?? 1.6;
  // Segments in local space: front line along x (facing +z), sides go back (-z).
  if (p.shape === 'u') {
    segs.push([[-len / 2, 0], [len / 2, 0]]);
    segs.push([[-len / 2 - 0.15, -0.3], [-len / 2 - 0.15, -dep]]);
    segs.push([[len / 2 + 0.15, -0.3], [len / 2 + 0.15, -dep]]);
  } else if (p.shape === 'l') {
    segs.push([[-len / 2, 0], [len / 2, 0]]);
    segs.push([[len / 2 + 0.15, -0.3], [len / 2 + 0.15, -dep]]);
  } else {
    segs.push([[-len / 2, 0], [len / 2, 0]]);
  }
  for (const [si, [a, b]] of segs.entries()) {
    const pa = L(a[0], a[1]),
      pb = L(b[0], b[1]);
    const dx = pb[0] - pa[0],
      dz = pb[1] - pa[1];
    const sl = Math.hypot(dx, dz);
    const ux = dx / sl,
      uz = dz / sl;
    const nx = -uz,
      nz = ux;
    const yaw = Math.atan2(-uz, ux); // bag local x along the wall
    const g = hf.getHeight((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2);
    for (let k = 0; k < courses; k++) {
      const off = (k % 2) * 0.28;
      const rows = k < courses - 2 ? 2 : 1;
      for (let row = 0; row < rows; row++) {
        const w = (row - (rows - 1) / 2) * 0.33;
        for (let u = -off + 0.28; u < sl + 0.1; u += 0.56) {
          const uu = Math.min(u, sl - 0.28);
          const x = pa[0] + ux * uu + nx * w + r.range(-0.02, 0.02),
            z = pa[1] + uz * uu + nz * w + r.range(-0.02, 0.02);
          const tint = 0.82 + r.next() * 0.3;
          inst.add(x, g + 0.065 + k * 0.135, z, yaw + r.range(-0.08, 0.08), r.range(-0.04, 0.04), r.range(-0.05, 0.05), [1, 1, 1].map(() => 1 + r.range(-0.06, 0.06)), [tint, tint * 0.97, tint * 0.9]);
        }
      }
    }
    const hgt = courses * 0.135 + 0.02;
    const cx = (pa[0] + pb[0]) / 2,
      cz = (pa[1] + pb[1]) / 2;
    B.addCollider(cx, g + hgt / 2, cz, sl / 2 + 0.25, hgt / 2, 0.36, yaw, 0, 0, 'sandbag', FLAG_DEFAULT, { nav: true, tag: 'sandbags' });
    // Cover behind the front line (its -n side).
    if (si === 0) for (let u = 0.5; u < sl - 0.3; u += 1.2) {
      const bx = pa[0] + ux * u - nx * 0.75,
        bz = pa[1] + uz * u - nz * 0.75;
      B.coverPoints.push({ x: +bx.toFixed(2), y: +g.toFixed(2), z: +bz.toFixed(2), nx: +nx.toFixed(3), nz: +nz.toFixed(3), height: hgt > 1.3 ? 'high' : 'low' });
    }
  }
}

// Barbed wire: a concertina coil on pickets with straight strands.
function wireObstacle(B, out, p, hf, r) {
  const len = p.len ?? 8;
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw);
  const ux = c,
    uz = -s; // along local x
  const x0 = p.x - (ux * len) / 2,
    z0 = p.z - (uz * len) / 2;
  const f = B.frame(x0, 0, z0, p.yaw, { tag: 'wire' });
  const turns = Math.round(len / 0.32);
  const R = 0.42;
  let prev = null;
  for (let k = 0; k <= turns * 10; k++) {
    const t = k / (turns * 10);
    const a = t * turns * TAU;
    const lx = t * len + 0.05 * Math.sin(a * 0.5);
    const wx = x0 + ux * lx,
      wz = z0 + uz * lx;
    const g = hf.getHeight(wx, wz);
    const pt = [wx - uz * Math.sin(a) * R, g + R + Math.cos(a) * R * 0.95, wz + ux * Math.sin(a) * R];
    if (prev) out.push(...prev, ...pt);
    prev = pt;
  }
  // Pickets every 2.5 m with three strands each side.
  const n = Math.max(1, Math.round(len / 2.5));
  const tops = [];
  for (let k = 0; k <= n; k++) {
    const u = (len * k) / n;
    for (const side of [-1, 1]) {
      const wx = x0 + ux * u + -uz * side * 0.6,
        wz = z0 + uz * u + ux * side * 0.6;
      const g = hf.getHeight(wx, wz);
      const lz = side * 0.6;
      f.obox('wood', u, g + 0.45, lz, 0.03, 0.55, 0.03, { rot: { roll: r.range(-0.12, 0.12) }, color: WOOD.weathered });
      tops.push([wx, g, wz, side, k]);
    }
  }
  for (const side of [-1, 1]) {
    const pts = tops.filter((t) => t[3] === side);
    for (let k = 0; k < pts.length - 1; k++) {
      for (const hgt of [0.25, 0.55, 0.85]) out.push(pts[k][0], pts[k][1] + hgt, pts[k][2], pts[k + 1][0], pts[k + 1][1] + hgt, pts[k + 1][2]);
    }
  }
  // Visual only (no collider), as specified; the pickets are thin decoration.
}

// Two-wheeled farm cart (optionally loaded with hay).
function cart(B, p, y, r, hay) {
  const f = B.frame(p.x, y, p.z, p.yaw, { tag: 'cart' });
  const wood = WOOD.weathered;
  const bedY = 0.85;
  const tilt = hay ? 0 : 0.12;
  const sub = f.sub(0, 0, 0, 0);
  sub.obox('wood', 0, bedY, 0, 0.75, 0.05, 1.3, { rot: { pitch: tilt }, color: wood, uv: 'box' });
  for (const sx of [-1, 1]) sub.obox('wood', sx * 0.74, bedY + 0.25, 0, 0.03, 0.22, 1.3, { rot: { pitch: tilt }, color: wood, uv: 'box' });
  for (const sx of [-1, 1]) sub.beam('wood', sx * 0.45, bedY - 0.08, -1.2, sx * 0.4, 0.15 + (hay ? 0.4 : 0), -3.2, 0.08, 0.08, { color: wood });
  for (const sx of [-1, 1]) {
    const wheel = new THREE.CylinderGeometry(0.62, 0.62, 0.07, 16, 1, true);
    f.geometry('wood', wheel, mat4(sx * 0.9, 0.62, 0.15, 0, 0, Math.PI / 2), { color: scale(wood, 0.7) });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      f.obox('wood', sx * 0.9, 0.62, 0.15, 0.025, 0.6, 0.025, { rot: { pitch: a }, color: scale(wood, 0.8), uv: 'box' });
    }
  }
  f.box('iron', -0.95, 0.6, 0.11, 0.95, 0.65, 0.19, {});
  if (hay) {
    const hayG = new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI / 2);
    f.geometry('hay', hayG, mat4(0, bedY + 0.05, 0, 0, 0, 0, 0.95, 1.1, 1.55), {});
  }
  B.addCollider(...f.toWorld(0, bedY / 2 + 0.2, 0), 0.95, bedY / 2 + 0.25 + (hay ? 0.5 : 0), 1.35, p.yaw, 0, 0, 'wood', FLAG_DEFAULT, { nav: true, tag: 'cart' });
  coverAround(B, p.x, y, p.z, 1.6, 'low');
}
