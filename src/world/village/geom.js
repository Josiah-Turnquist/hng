// Geometry and collider accumulation for the village.
//
// Everything is built from simple pieces (boxes, prisms, extruded outlines, lathed
// shapes) written straight into big per-material vertex arrays, so a whole group of
// buildings ends up as one mesh per material (one draw call each). Texture
// coordinates are planar projections in meters (divided by the material's
// texture size), so every wall shows its texture at real-world scale.
//
// Coordinates: a Frame is a building's local space (origin + yaw around Y). Inside
// a frame +x is the building's right, +z its front, +y up. Collider boxes are
// converted to world space and added to the CollisionWorld.
import * as THREE from 'three';
import { Box, FLAG_DEFAULT } from '../../physics/collision.js';

// Face corner signs (counter-clockwise seen from outside) and normals of a unit box.
const FACE_DEFS = [
  { key: 'px', n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { key: 'nx', n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { key: 'py', n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { key: 'ny', n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { key: 'pz', n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { key: 'nz', n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];

// 3x3 rotation matrix (row-major array of 9) for yaw (Y), pitch (X), roll (Z) in
// THREE's 'YXZ' order, the same convention as collision Box.setRotation.
export function rotMatrix(yaw = 0, pitch = 0, roll = 0) {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const cr = Math.cos(roll),
    sr = Math.sin(roll);
  return [
    cy * cr + sy * sp * sr, -cy * sr + sy * sp * cr, sy * cp,
    cp * sr, cp * cr, -sp,
    -sy * cr + cy * sp * sr, sy * sr + cy * sp * cr, cy * cp,
  ];
}

const IDENT = rotMatrix(0, 0, 0);

// Dominant-axis planar UV mapping, in meters.
function planarUV(qx, qy, qz, nx, ny, nz, out) {
  const ax = Math.abs(nx),
    ay = Math.abs(ny),
    az = Math.abs(nz);
  if (ax >= ay && ax >= az) {
    out[0] = nx > 0 ? -qz : qz;
    out[1] = qy;
  } else if (ay >= az) {
    out[0] = qx;
    out[1] = ny > 0 ? -qz : qz;
  } else {
    out[0] = nz > 0 ? qx : -qx;
    out[1] = qy;
  }
  return out;
}

class Bucket {
  constructor(matKey, chunk) {
    this.matKey = matKey;
    this.chunk = chunk;
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this.count = 0;
  }
}

const WHITE = [1, 1, 1];
const _uv = [0, 0];

// Collects geometry per (material, chunk) and colliders.
export class VillageBuilder {
  constructor({ materials, collision = null, chunkSize = 80 }) {
    this.materials = materials; // key -> THREE.Material (userData.texWorld)
    this.collision = collision;
    this.chunkSize = chunkSize;
    this.buckets = new Map();
    this.colliders = [];
    this.coverPoints = [];
    this.doors = [];
    this.triangles = 0;
  }

  chunkOf(x, z) {
    const s = this.chunkSize;
    return `${Math.floor(x / s)},${Math.floor(z / s)}`;
  }

  bucket(matKey, chunk) {
    const key = `${matKey}|${chunk}`;
    let b = this.buckets.get(key);
    if (!b) {
      if (!this.materials[matKey]) throw new Error(`village material missing: ${matKey}`);
      b = new Bucket(matKey, chunk);
      this.buckets.set(key, b);
    }
    return b;
  }

  texScale(matKey) {
    const m = this.materials[matKey];
    return 1 / ((m && m.userData.texWorld) || 1);
  }

  frame(x, y, z, yaw = 0, opts = {}) {
    return new Frame(this, x, y, z, yaw, opts);
  }

  // Adds a world-space collider box.
  addCollider(cx, cy, cz, hx, hy, hz, yaw, pitch, roll, material, flags = FLAG_DEFAULT, meta = null) {
    const box = new Box(cx, cy, cz, hx, hy, hz, yaw, material, flags, pitch, roll);
    if (meta) box.village = meta;
    if (this.collision) this.collision.add(box);
    this.colliders.push(box);
    return box;
  }

  // Build the final meshes. Returns a THREE.Group.
  finish(name = 'village') {
    const group = new THREE.Group();
    group.name = name;
    for (const b of this.buckets.values()) {
      if (b.count === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.count > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const mat = this.materials[b.matKey];
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = `${name}:${b.matKey}:${b.chunk}`;
      const noShadow = mat.userData.noShadow;
      mesh.castShadow = !noShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (mat.transparent) mesh.renderOrder = 2;
      group.add(mesh);
      this.triangles += b.idx.length / 3;
    }
    return group;
  }
}

// A building's local space. All modeling calls take local coordinates.
export class Frame {
  constructor(builder, x, y, z, yaw, opts = {}) {
    this.b = builder;
    this.ox = x;
    this.oy = y;
    this.oz = z;
    this.yaw = yaw;
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
    this.chunk = opts.chunk ?? builder.chunkOf(x, z);
    // Offsetting texture coordinates per building hides repetition between neighbors.
    this.uvOff = opts.uvOff ?? [((x * 7.31) % 3) + 0.37 * z, 0.21 * x, ((z * 3.17) % 5) + 0.29 * x];
    this.tag = opts.tag ?? null;
  }

  // Local -> world position.
  toWorld(x, y, z, out = [0, 0, 0]) {
    out[0] = this.ox + this.c * x + this.s * z;
    out[1] = this.oy + y;
    out[2] = this.oz - this.s * x + this.c * z;
    return out;
  }

  // Local direction -> world direction (horizontal).
  dirToWorld(x, z, out = [0, 0]) {
    out[0] = this.c * x + this.s * z;
    out[1] = -this.s * x + this.c * z;
    return out;
  }

  sub(x, y, z, yaw = 0) {
    // A child frame (e.g. a wing of a building), in this frame's coordinates.
    const p = this.toWorld(x, y, z);
    return new Frame(this.b, p[0], p[1], p[2], this.yaw + yaw, { chunk: this.chunk, uvOff: this.uvOff, tag: this.tag });
  }

  // --- Visual boxes ----------------------------------------------------------------

  // Oriented box: center, half extents, local rotation (yaw/pitch/roll inside the frame).
  // opts: rot {yaw,pitch,roll}, uv: 'frame' | 'box', color [r,g,b] (linear),
  // faces: { px: matKey|null, ... } overrides (null skips a face), skip: ['ny', ...],
  // col: collider material name (adds a matching collider), colFlags, colThick,
  // nav: false to keep it out of the nav blockers.
  obox(mat, cx, cy, cz, hx, hy, hz, opts = {}) {
    const r = opts.rot;
    const R = r ? rotMatrix(r.yaw || 0, r.pitch || 0, r.roll || 0) : IDENT;
    const uvBox = opts.uv === 'box';
    const color = opts.color || WHITE;
    const faces = opts.faces;
    const skip = opts.skip;
    const c = this.c,
      s = this.s;
    const uo = this.uvOff;
    for (let f = 0; f < 6; f++) {
      const fd = FACE_DEFS[f];
      if (skip && skip.includes(fd.key)) continue;
      let fm = mat;
      if (faces && fd.key in faces) {
        fm = faces[fd.key];
        if (fm === null) continue;
      }
      if (!fm) continue;
      const bk = this.b.bucket(fm, this.chunk);
      const ts = this.b.texScale(fm);
      const n0 = fd.n[0],
        n1 = fd.n[1],
        n2 = fd.n[2];
      // Normal in frame space.
      const fnx = R[0] * n0 + R[1] * n1 + R[2] * n2;
      const fny = R[3] * n0 + R[4] * n1 + R[5] * n2;
      const fnz = R[6] * n0 + R[7] * n1 + R[8] * n2;
      const wnx = c * fnx + s * fnz;
      const wnz = -s * fnx + c * fnz;
      const base = bk.count;
      for (let k = 0; k < 4; k++) {
        const sg = fd.c[k];
        const lx = sg[0] * hx,
          ly = sg[1] * hy,
          lz = sg[2] * hz;
        const px = cx + R[0] * lx + R[1] * ly + R[2] * lz;
        const py = cy + R[3] * lx + R[4] * ly + R[5] * lz;
        const pz = cz + R[6] * lx + R[7] * ly + R[8] * lz;
        bk.pos.push(this.ox + c * px + s * pz, this.oy + py, this.oz - s * px + c * pz);
        bk.nor.push(wnx, fny, wnz);
        if (uvBox) {
          // Coordinates in the box's rotated axes (continuous across boxes with equal rotation).
          const qx = R[0] * px + R[3] * py + R[6] * pz;
          const qy = R[1] * px + R[4] * py + R[7] * pz;
          const qz = R[2] * px + R[5] * py + R[8] * pz;
          planarUV(qx + uo[0], qy + uo[1], qz + uo[2], n0, n1, n2, _uv);
        } else {
          planarUV(px + uo[0], py + uo[1], pz + uo[2], fnx, fny, fnz, _uv);
        }
        bk.uv.push(_uv[0] * ts, _uv[1] * ts);
        bk.col.push(color[0], color[1], color[2]);
      }
      bk.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      bk.count += 4;
    }
    if (opts.col) {
      const t = opts.colThick;
      if (t) {
        // Collider thinner than the visual, aligned with the box's top (roof tiles).
        const ux = R[1],
          uy = R[4],
          uz = R[7];
        const d = hy - t / 2;
        this.collider(cx + ux * d, cy + uy * d, cz + uz * d, hx, t / 2, hz, r, opts.col, opts.colFlags, opts.nav, opts.meta);
      } else {
        this.collider(cx, cy, cz, hx, hy, hz, r, opts.col, opts.colFlags, opts.nav, opts.meta);
      }
    }
  }

  // Axis-aligned (in frame space) box from min/max corners.
  box(mat, x0, y0, z0, x1, y1, z1, opts = {}) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    this.obox(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2, opts);
  }

  // Collider only (frame space).
  collider(cx, cy, cz, hx, hy, hz, rot, material, flags = FLAG_DEFAULT, nav = true, meta = null) {
    const p = this.toWorld(cx, cy, cz);
    const yaw = this.yaw + ((rot && rot.yaw) || 0);
    const pitch = (rot && rot.pitch) || 0;
    const roll = (rot && rot.roll) || 0;
    const m = meta || {};
    if (nav === false) m.nav = false;
    if (this.tag && !m.tag) m.tag = this.tag;
    return this.b.addCollider(p[0], p[1], p[2], hx, hy, hz, yaw, pitch, roll, material, flags ?? FLAG_DEFAULT, m);
  }

  colliderBox(x0, y0, z0, x1, y1, z1, material, flags, nav = true) {
    return this.collider((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2, null, material, flags, nav);
  }

  // A slab between two points (ramps, beams, rafters): A and B are the centers of
  // the slab's top edge line; width across, thickness below the line.
  slab(mat, ax, ay, az, bx, by, bz, width, thick, opts = {}) {
    const dx = bx - ax,
      dy = by - ay,
      dz = bz - az;
    const hl = Math.hypot(dx, dz);
    const len = Math.hypot(hl, dy);
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(dy, hl);
    const R = rotMatrix(yaw, pitch, opts.roll || 0);
    const off = opts.center ? 0 : thick / 2;
    const cx = (ax + bx) / 2 - R[1] * off,
      cy = (ay + by) / 2 - R[4] * off,
      cz = (az + bz) / 2 - R[7] * off;
    this.obox(mat, cx, cy, cz, width / 2, thick / 2, len / 2 + (opts.extend || 0), { ...opts, rot: { yaw, pitch, roll: opts.roll || 0 }, uv: opts.uv || 'box' });
    return { yaw, pitch, len };
  }

  // Beam between two points with a square-ish section (w x h), centered on the line.
  beam(mat, ax, ay, az, bx, by, bz, w, h, opts = {}) {
    return this.slab(mat, ax, ay, az, bx, by, bz, w, h, { ...opts, center: true });
  }

  // --- Arbitrary geometry ------------------------------------------------------------

  // Append a THREE.BufferGeometry transformed by a local Matrix4 (frame space).
  // uv: 'frame' (planar projection in frame space, default), 'keep' (geometry's own
  // uv * uvScale), 'atlas' (geometry uv mapped into rect [u0,v0,u1,v1]).
  geometry(mat, geo, matrix = null, opts = {}) {
    const bk = this.b.bucket(mat, this.chunk);
    const ts = this.b.texScale(mat);
    const pos = geo.attributes.position;
    let nor = geo.attributes.normal;
    if (!nor) {
      geo.computeVertexNormals();
      nor = geo.attributes.normal;
    }
    const uvA = geo.attributes.uv;
    const m = matrix ? matrix.elements : null;
    const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix).elements : null;
    const color = opts.color || WHITE;
    const colA = opts.vertexColors && geo.attributes.color;
    const c = this.c,
      s = this.s;
    const uo = this.uvOff;
    const base = bk.count;
    const mode = opts.uv || 'frame';
    const uvs = opts.uvScale || 1;
    const rect = opts.rect;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      let nx = nor.getX(i),
        ny = nor.getY(i),
        nz = nor.getZ(i);
      if (m) {
        const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
        const tz = m[2] * x + m[6] * y + m[10] * z + m[14];
        x = tx;
        y = ty;
        z = tz;
        const ux = nm[0] * nx + nm[3] * ny + nm[6] * nz;
        const uy = nm[1] * nx + nm[4] * ny + nm[7] * nz;
        const uz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
        const l = Math.hypot(ux, uy, uz) || 1;
        nx = ux / l;
        ny = uy / l;
        nz = uz / l;
      }
      bk.pos.push(this.ox + c * x + s * z, this.oy + y, this.oz - s * x + c * z);
      bk.nor.push(c * nx + s * nz, ny, -s * nx + c * nz);
      if (mode === 'keep' && uvA) {
        bk.uv.push(uvA.getX(i) * uvs, uvA.getY(i) * uvs);
      } else if (mode === 'atlas' && uvA) {
        bk.uv.push(rect[0] + (rect[2] - rect[0]) * uvA.getX(i), rect[1] + (rect[3] - rect[1]) * uvA.getY(i));
      } else {
        planarUV(x + uo[0], y + uo[1], z + uo[2], nx, ny, nz, _uv);
        bk.uv.push(_uv[0] * ts, _uv[1] * ts);
      }
      if (colA) bk.col.push(colA.getX(i) * color[0], colA.getY(i) * color[1], colA.getZ(i) * color[2]);
      else bk.col.push(color[0], color[1], color[2]);
    }
    if (geo.index) {
      const ia = geo.index.array;
      for (let i = 0; i < ia.length; i++) bk.idx.push(base + ia[i]);
    } else {
      for (let i = 0; i < pos.count; i++) bk.idx.push(base + i);
    }
    bk.count += pos.count;
  }

  // A flat quad (4 corners in frame space, CCW seen from the front) with an atlas
  // rectangle [u0, v0, u1, v1] (for signs and painted lettering).
  quad(mat, p0, p1, p2, p3, rect, opts = {}) {
    const bk = this.b.bucket(mat, this.chunk);
    const ax = p1[0] - p0[0],
      ay = p1[1] - p0[1],
      az = p1[2] - p0[2];
    const bx = p3[0] - p0[0],
      by = p3[1] - p0[1],
      bz = p3[2] - p0[2];
    let nx = ay * bz - az * by,
      ny = az * bx - ax * bz,
      nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const c = this.c,
      s = this.s;
    const color = opts.color || WHITE;
    const base = bk.count;
    const uvs = [
      [rect[0], rect[1]],
      [rect[2], rect[1]],
      [rect[2], rect[3]],
      [rect[0], rect[3]],
    ];
    const pts = [p0, p1, p2, p3];
    for (let k = 0; k < 4; k++) {
      const p = pts[k];
      bk.pos.push(this.ox + c * p[0] + s * p[2], this.oy + p[1], this.oz - s * p[0] + c * p[2]);
      bk.nor.push(c * nx + s * nz, ny, -s * nx + c * nz);
      bk.uv.push(uvs[k][0], uvs[k][1]);
      bk.col.push(color[0], color[1], color[2]);
    }
    bk.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    if (opts.doubleSided) bk.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    bk.count += 4;
  }

  // Raw triangles: verts = [[x,y,z],...] in frame space, tris = [[a,b,c],...].
  // Flat normals per triangle; planar UVs.
  tris(mat, verts, tris, opts = {}) {
    const bk = this.b.bucket(mat, this.chunk);
    const ts = this.b.texScale(mat);
    const c = this.c,
      s = this.s;
    const uo = this.uvOff;
    const color = opts.color || WHITE;
    for (const [ia, ib, ic] of tris) {
      const A = verts[ia],
        B = verts[ib],
        C = verts[ic];
      const ux = B[0] - A[0],
        uy = B[1] - A[1],
        uz = B[2] - A[2];
      const vx = C[0] - A[0],
        vy = C[1] - A[1],
        vz = C[2] - A[2];
      let nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      const base = bk.count;
      for (const P of [A, B, C]) {
        bk.pos.push(this.ox + c * P[0] + s * P[2], this.oy + P[1], this.oz - s * P[0] + c * P[2]);
        bk.nor.push(c * nx + s * nz, ny, -s * nx + c * nz);
        if (opts.uvFn) {
          opts.uvFn(P, _uv);
          bk.uv.push(_uv[0] * ts, _uv[1] * ts);
        } else {
          planarUV(P[0] + uo[0], P[1] + uo[1], P[2] + uo[2], nx, ny, nz, _uv);
          bk.uv.push(_uv[0] * ts, _uv[1] * ts);
        }
        bk.col.push(color[0], color[1], color[2]);
      }
      bk.idx.push(base, base + 1, base + 2);
      bk.count += 3;
    }
  }

  // Vertical prism from a 2D outline (in the x/z plane, CCW seen from above) between y0 and y1.
  prism(mat, outline, y0, y1, opts = {}) {
    const n = outline.length;
    const verts = [];
    for (const [x, z] of outline) verts.push([x, y0, z]);
    for (const [x, z] of outline) verts.push([x, y1, z]);
    const tris = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tris.push([i, j, n + j], [i, n + j, n + i]);
    }
    if (opts.top !== false) for (let i = 1; i < n - 1; i++) tris.push([n, n + i, n + i + 1]);
    if (opts.bottom) for (let i = 1; i < n - 1; i++) tris.push([0, i + 1, i]);
    // Outline CCW seen from above (y up, z toward the viewer) means clockwise in x/z
    // with +z down the page; make the side faces point outward either way.
    const area = outline.reduce((a, p, i) => {
      const q = outline[(i + 1) % n];
      return a + (p[0] * q[1] - q[0] * p[1]);
    }, 0);
    const flip = area > 0;
    this.tris(mat, verts, flip ? tris.map(([a, b, c]) => [a, c, b]) : tris, opts);
  }

  // A wall object for modeling along a line in this frame.
  wall(x0, z0, x1, z1, opts) {
    return new Wall(this, x0, z0, x1, z1, opts);
  }

  cover(x, y, z, nx, nz, height = 'low') {
    const p = this.toWorld(x, y, z);
    const d = this.dirToWorld(nx, nz);
    this.b.coverPoints.push({ x: +p[0].toFixed(2), y: +p[1].toFixed(2), z: +p[2].toFixed(2), nx: +d[0].toFixed(3), nz: +d[1].toFixed(3), height });
  }

  door(x, z, width, yawLocal = 0, meta = {}) {
    const p = this.toWorld(x, 0, z);
    this.b.doors.push({ x: +p[0].toFixed(2), z: +p[2].toFixed(2), y: +p[1].toFixed(2), yaw: +(this.yaw + yawLocal).toFixed(4), width, ...meta });
  }
}

// ---------------------------------------------------------------------------------------
// Walls with rectangular openings. Wall space: u along the wall from its start, v up
// from the wall base, w across (+w = outside). The wall line is its centerline.

// Solid rectangles of [0,L] x [0,H] minus holes [{u0,u1,v0,v1}].
export function wallRects(L, H, holes) {
  const xs = [0, L];
  for (const h of holes) {
    if (h.u1 <= 0 || h.u0 >= L) continue;
    xs.push(Math.max(0, h.u0), Math.min(L, h.u1));
  }
  xs.sort((a, b) => a - b);
  const cols = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i],
      b = xs[i + 1];
    if (b - a < 1e-4) continue;
    const mid = (a + b) / 2;
    const cover = holes
      .filter((h) => h.u0 < mid && h.u1 > mid)
      .map((h) => [Math.max(0, h.v0), Math.min(H, h.v1)])
      .filter(([p, q]) => q > p)
      .sort((p, q) => p[0] - q[0]);
    const spans = [];
    let y = 0;
    for (const [v0, v1] of cover) {
      if (v0 > y + 1e-4) spans.push([y, v0]);
      y = Math.max(y, v1);
    }
    if (H > y + 1e-4) spans.push([y, H]);
    const sig = spans.map((sp) => sp[0].toFixed(3) + ':' + sp[1].toFixed(3)).join('|');
    const last = cols[cols.length - 1];
    if (last && last.sig === sig && Math.abs(last.b - a) < 1e-4) last.b = b;
    else cols.push({ a, b, spans, sig });
  }
  const rects = [];
  for (const c of cols) for (const [v0, v1] of c.spans) rects.push({ u0: c.a, u1: c.b, v0, v1 });
  return rects;
}

export class Wall {
  // opts: thick, base (y of v=0), height, mat (exterior), inner (interior face mat),
  // col (collider material), color, innerColor
  constructor(frame, x0, z0, x1, z1, opts = {}) {
    this.f = frame;
    this.x0 = x0;
    this.z0 = z0;
    const dx = x1 - x0,
      dz = z1 - z0;
    this.len = Math.hypot(dx, dz);
    this.dx = dx / this.len;
    this.dz = dz / this.len;
    // Outward normal (right-hand side of the direction).
    this.nx = -this.dz;
    this.nz = this.dx;
    this.yaw = Math.atan2(-this.dz, this.dx);
    const q = this.yaw / (Math.PI / 2);
    this.axisAligned = Math.abs(q - Math.round(q)) < 1e-6;
    this.t = opts.thick ?? 0.5;
    this.base = opts.base ?? 0;
    this.height = opts.height ?? 3;
    this.mat = opts.mat ?? 'plaster';
    this.inner = opts.inner === undefined ? this.mat : opts.inner;
    this.col = opts.col ?? 'stone';
    this.color = opts.color;
    this.innerColor = opts.innerColor ?? opts.color;
    this.holes = [];
    this.opts = opts;
  }

  // Wall space -> frame space point.
  p(u, v, w) {
    return [this.x0 + this.dx * u + this.nx * w, this.base + v, this.z0 + this.dz * u + this.nz * w];
  }

  hole(u0, u1, v0, v1, meta = {}) {
    const h = { u0, u1, v0, v1, ...meta };
    this.holes.push(h);
    return h;
  }

  // Box in wall space (u0..u1, v0..v1, w0..w1).
  box(mat, u0, v0, w0, u1, v1, w1, opts = {}) {
    const cu = (u0 + u1) / 2,
      cv = (v0 + v1) / 2,
      cw = (w0 + w1) / 2;
    this.obox(mat, cu, cv, cw, Math.abs(u1 - u0) / 2, Math.abs(v1 - v0) / 2, Math.abs(w1 - w0) / 2, opts);
  }

  obox(mat, cu, cv, cw, hu, hv, hw, opts = {}) {
    const p = this.p(cu, cv, cw);
    const r = opts.rot || {};
    const rot = { yaw: this.yaw + (r.yaw || 0), pitch: r.pitch || 0, roll: r.roll || 0 };
    const uv = opts.uv || (this.axisAligned && !opts.rot ? 'frame' : 'box');
    this.f.obox(mat, p[0], p[1], p[2], hu, hv, hw, { ...opts, rot, uv });
  }

  // Emit the solid wall (minus holes) with colliders. extra: { colliders: false }
  build(extra = {}) {
    const rects = wallRects(this.len, this.height, this.holes);
    const t = this.t;
    const faces = { pz: this.mat, nz: this.inner };
    const split = this.inner !== this.mat || this.innerColor !== this.color;
    for (const r of rects) {
      if (split) {
        // Different material or tint inside: emit the inner face separately.
        this.box(this.mat, r.u0, r.v0, -t / 2, r.u1, r.v1, t / 2, { faces: { ...faces, nz: null }, color: this.color });
        if (this.inner) this.box(this.inner, r.u0, r.v0, -t / 2, r.u1, r.v1, t / 2, { faces: { px: null, nx: null, py: null, ny: null, pz: null, nz: this.inner }, color: this.innerColor });
      } else {
        this.box(this.mat, r.u0, r.v0, -t / 2, r.u1, r.v1, t / 2, { faces, color: this.color });
      }
      if (extra.colliders !== false) {
        // Skip colliders for the buried foundation part.
        let v0 = r.v0;
        const ground = extra.groundV ?? -Infinity;
        if (r.v1 <= ground + 0.05) continue;
        if (v0 < ground) v0 = ground;
        const p = this.p((r.u0 + r.u1) / 2, (v0 + r.v1) / 2, 0);
        this.f.collider(p[0], p[1], p[2], (r.u1 - r.u0) / 2, (r.v1 - v0) / 2, t / 2, { yaw: this.yaw }, this.col, extra.flags, extra.nav ?? true);
      }
    }
    return rects;
  }
}

// ---------------------------------------------------------------------------------------
// Shape helpers producing THREE geometries (local space) for frame.geometry().

// A wall plate with an arched hole: plate covers u0..u1 (width), v from 0 to h, centered
// on w = 0 with thickness t. The hole spans hole width hw (centered) from v = 0 up to an
// arch: 'round' (semicircle) or 'pointed' (two arcs). Returns a geometry in wall space
// (x = u, y = v, z = w).
export function archPlateGeometry(width, height, thick, holeW, springV, kind = 'round', segments = 10) {
  const sh = new THREE.Shape();
  const hw = width / 2;
  sh.moveTo(-hw, 0);
  sh.lineTo(hw, 0);
  sh.lineTo(hw, height);
  sh.lineTo(-hw, height);
  sh.lineTo(-hw, 0);
  const path = new THREE.Path();
  const r = holeW / 2;
  path.moveTo(-r, 0);
  path.lineTo(-r, springV);
  archPoints(r, springV, kind, segments).forEach(([x, y]) => path.lineTo(x, y));
  path.lineTo(r, 0);
  path.lineTo(-r, 0);
  sh.holes.push(path);
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: segments });
  g.translate(0, 0, -thick / 2);
  return g;
}

// Points along an arch from the left springing point (-r, spring) to the right (r, spring).
export function archPoints(r, spring, kind = 'round', segments = 10) {
  const pts = [];
  if (kind === 'pointed') {
    // Equilateral Gothic arch: each side is an arc centered on the opposite springing point.
    const R = 2 * r;
    const top = Math.sqrt(R * R - r * r);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.atan2(top, r);
      // left arc centered at (r, spring)
      pts.push([r - R * Math.cos(a), spring + R * Math.sin(a)]);
    }
    for (let i = segments - 1; i >= 0; i--) {
      const a = (i / segments) * Math.atan2(top, r);
      pts.push([-r + R * Math.cos(a), spring + R * Math.sin(a)]);
    }
  } else if (kind === 'segmental') {
    const rise = r * 0.35;
    const R = (r * r + rise * rise) / (2 * rise);
    const cy = spring + rise - R;
    const a0 = Math.asin(r / R);
    for (let i = 0; i <= segments; i++) {
      const a = -a0 + (2 * a0 * i) / segments;
      pts.push([R * Math.sin(a), cy + R * Math.cos(a)]);
    }
  } else {
    for (let i = 0; i <= segments; i++) {
      const a = Math.PI - (i / segments) * Math.PI;
      pts.push([r * Math.cos(a), spring + r * Math.sin(a)]);
    }
  }
  return pts;
}

// Height of the arch apex above the springing line.
export function archRise(r, kind) {
  if (kind === 'pointed') return Math.sqrt(3) * r;
  if (kind === 'segmental') return r * 0.35;
  return r;
}

// A ring of voussoirs (arch stones) as an extruded annulus segment.
export function archRingGeometry(r, ringW, spring, thick, kind = 'round', segments = 12) {
  const inner = archPoints(r, spring, kind, segments);
  const outer = archPoints(r + ringW, spring, kind, segments);
  const sh = new THREE.Shape();
  sh.moveTo(outer[0][0], outer[0][1]);
  for (const [x, y] of outer) sh.lineTo(x, y);
  for (let i = inner.length - 1; i >= 0; i--) sh.lineTo(inner[i][0], inner[i][1]);
  sh.lineTo(outer[0][0], outer[0][1]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  return g;
}

export const M4 = new THREE.Matrix4();
export function mat4(x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}
