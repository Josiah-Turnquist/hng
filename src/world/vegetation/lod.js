// Streams plants into instanced meshes as the camera moves. Items live in a coarse
// grid; whenever the camera has moved or turned enough, the ones in range and in
// view (with a wide margin, so turning around doesn't pop, and everything close by
// regardless of direction, so shadows from behind stay) are copied into the
// instance buffers, nearest first. Level-of-detail fades happen in the shaders.
import * as THREE from 'three';

// A widened view frustum for culling spheres and boxes.
export class ViewFilter {
  constructor() {
    this.frustum = new THREE.Frustum();
    this.proj = new THREE.Matrix4();
    this.m = new THREE.Matrix4();
    this.planes = new Float32Array(24);
    this.valid = false;
  }

  update(camera, margin) {
    if (!camera || !camera.isPerspectiveCamera) {
      this.valid = false;
      return;
    }
    camera.updateMatrixWorld();
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / (camera.zoom || 1));
    const tv = Math.tan(Math.min(half + margin, 1.5));
    const th = Math.tan(Math.min(Math.atan(Math.tan(half) * camera.aspect) + margin, 1.5));
    const n = 0.5;
    this.proj.makePerspective(-n * th, n * th, n * tv, -n * tv, n, 1e5);
    this.m.multiplyMatrices(this.proj, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m);
    this.frustum.planes.forEach((p, i) => {
      this.planes[i * 4] = p.normal.x;
      this.planes[i * 4 + 1] = p.normal.y;
      this.planes[i * 4 + 2] = p.normal.z;
      this.planes[i * 4 + 3] = p.constant;
    });
    this.valid = true;
  }

  sphere(x, y, z, r) {
    if (!this.valid) return true;
    const P = this.planes;
    for (let i = 0; i < 24; i += 4) if (P[i] * x + P[i + 1] * y + P[i + 2] * z + P[i + 3] < -r) return false;
    return true;
  }

  box(x0, y0, z0, x1, y1, z1) {
    if (!this.valid) return true;
    const P = this.planes;
    for (let i = 0; i < 24; i += 4) {
      const x = P[i] > 0 ? x1 : x0,
        y = P[i + 1] > 0 ? y1 : y0,
        z = P[i + 2] > 0 ? z1 : z0;
      if (P[i] * x + P[i + 1] * y + P[i + 2] * z + P[i + 3] < 0) return false;
    }
    return true;
  }
}

// When to refill: the camera moved, turned or zoomed beyond these thresholds.
export class RefillTrigger {
  constructor(move, turnRad) {
    this.move = move;
    this.cosTurn = Math.cos(turnRad);
    this.pos = new THREE.Vector3(1e9, 0, 0);
    this.dir = new THREE.Vector3();
    this.lod = 0;
    this._d = new THREE.Vector3();
  }

  // Refill at the next check.
  reset() {
    this.pos.set(1e9, 0, 0);
  }

  check(camera, pos, lod) {
    if (camera) camera.getWorldDirection(this._d);
    const moved = this.pos.distanceToSquared(pos) > this.move * this.move;
    const turned = camera ? this._d.dot(this.dir) < this.cosTurn : false;
    const zoomed = Math.abs(lod - this.lod) > 0.08 * Math.max(lod, this.lod);
    if (!moved && !turned && !zoomed) return false;
    this.pos.copy(pos);
    this.dir.copy(this._d);
    this.lod = lod;
    return true;
  }
}

// Where streamed instances go: an InstancedMesh (matrices copied from items.mats),
// or any { begin(), push(i), end(count) } object.
function meshSink(mesh, items) {
  let k = 0;
  return {
    sort: true,
    begin() {
      k = 0;
    },
    push(i) {
      if (k >= mesh.instanceMatrix.count) return;
      const dst = mesh.instanceMatrix.array,
        src = items.mats;
      const o = k * 16,
        q = i * 16;
      for (let j = 0; j < 16; j++) dst[o + j] = src[q + j];
      k++;
    },
    end() {
      mesh.count = k;
      mesh.visible = k > 0;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, k * 16);
      mesh.instanceMatrix.needsUpdate = true;
      return k;
    },
  };
}

// items: { count, x, y, z (bounding sphere centers), r (radii), group (per item),
// mats (16 floats per item, for InstancedMesh sinks) }. sinks[group]: an InstancedMesh,
// a sink object (see meshSink) or null. Several groups may share a sink.
export class InstanceStreamer {
  constructor(items, sinks, { half, cellSize = 64 }) {
    this.items = items;
    const wrapped = new Map();
    this.sinks = sinks.map((m) => {
      if (!m) return null;
      if (!wrapped.has(m)) wrapped.set(m, m.isInstancedMesh ? meshSink(m, items) : m);
      return wrapped.get(m);
    });
    this.unique = [...wrapped.values()];
    this.half = half;
    this.cs = cellSize;
    this.n = Math.ceil((2 * half) / cellSize) + 1;
    const N = this.n * this.n;
    const counts = new Int32Array(N + 1);
    const cellOf = new Int32Array(items.count);
    for (let i = 0; i < items.count; i++) {
      const cx = Math.max(0, Math.min(this.n - 1, Math.floor((items.x[i] + half) / cellSize)));
      const cz = Math.max(0, Math.min(this.n - 1, Math.floor((items.z[i] + half) / cellSize)));
      cellOf[i] = cz * this.n + cx;
      counts[cellOf[i] + 1]++;
    }
    for (let c = 0; c < N; c++) counts[c + 1] += counts[c];
    this.start = counts;
    this.list = new Int32Array(items.count);
    const fill = counts.slice(0, N);
    for (let i = 0; i < items.count; i++) this.list[fill[cellOf[i]]++] = i;
    // Height range and biggest radius per cell, for culling whole cells.
    this.ylo = new Float32Array(N).fill(Infinity);
    this.yhi = new Float32Array(N).fill(-Infinity);
    this.rmax = new Float32Array(N);
    for (let i = 0; i < items.count; i++) {
      const c = cellOf[i];
      this.ylo[c] = Math.min(this.ylo[c], items.y[i] - items.r[i]);
      this.yhi[c] = Math.max(this.yhi[c], items.y[i] + items.r[i]);
      this.rmax[c] = Math.max(this.rmax[c], items.r[i]);
    }
    this.picked = this.sinks.map(() => []);
    this.visible = 0;
  }

  // maxDist[group] / minDist[group]: the level-of-detail distance band (already
  // scaled by lod) of the group; slack: extra meters to include (the camera may move
  // this far before the next refill); always: include everything this close, in
  // view or not.
  refill(cam, view, lod, maxDist, slack, always, minDist = null) {
    const { items, half, cs, n } = this;
    let R = 0;
    for (const d of maxDist) R = Math.max(R, d);
    R = R / lod + slack;
    const x0 = Math.max(0, Math.floor((cam.x - R + half) / cs)),
      x1 = Math.min(n - 1, Math.floor((cam.x + R + half) / cs));
    const z0 = Math.max(0, Math.floor((cam.z - R + half) / cs)),
      z1 = Math.min(n - 1, Math.floor((cam.z + R + half) / cs));
    for (const p of this.picked) p.length = 0;
    for (const s of this.unique) s.begin();
    const { x, y, z, r, group } = items;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cz * n + cx;
        const a = this.start[c],
          b = this.start[c + 1];
        if (a === b) continue;
        const rx = Math.max(0, Math.abs(cam.x - (cx * cs - half + cs / 2)) - cs / 2);
        const rz = Math.max(0, Math.abs(cam.z - (cz * cs - half + cs / 2)) - cs / 2);
        if (rx * rx + rz * rz > R * R) continue;
        // The whole cell out of view (and not close by)?
        const ex = this.rmax[c];
        const bx0 = cx * cs - half - ex,
          bz0 = cz * cs - half - ex;
        if (rx * rx + rz * rz > always * always && !view.box(bx0, this.ylo[c], bz0, bx0 + cs + 2 * ex, this.yhi[c], bz0 + cs + 2 * ex)) continue;
        for (let k = a; k < b; k++) {
          const i = this.list[k];
          const g = group[i];
          if (!this.sinks[g]) continue;
          const dx = x[i] - cam.x,
            dy = y[i] - cam.y,
            dz = z[i] - cam.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > maxDist[g] / lod + slack) continue;
          if (minDist && d < minDist[g] / lod - slack) continue;
          if (d > always + r[i] && !view.sphere(x[i], y[i], z[i], r[i])) continue;
          const sink = this.sinks[g];
          if (sink.sort) this.picked[g].push(Math.floor(d * 16) * 1e6 + i);
          else sink.push(i);
        }
      }
    }
    // Nearest first (helps the depth test reject hidden foliage early).
    this.picked.forEach((p, g) => {
      const sink = this.sinks[g];
      if (!sink || !sink.sort) return;
      p.sort((a, b) => a - b);
      for (let k = 0; k < p.length; k++) sink.push(p[k] % 1e6);
    });
    let total = 0;
    for (const s of this.unique) total += s.end();
    this.visible = total;
    return total;
  }
}
