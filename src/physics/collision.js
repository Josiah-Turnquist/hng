// Static collision world: the ground (a heightfield) plus many oriented boxes
// (walls, floors, roofs, sandbags, tree trunks...). Boxes carry a material name so
// bullets know how hard they are to punch through.
//
// Boxes are kept in a uniform grid on the ground plane so rays and spheres only
// test nearby boxes.

export const FLAG_SOLID = 1; // blocks people and vehicles
export const FLAG_BULLET = 2; // stops or slows bullets
export const FLAG_SIGHT = 4; // blocks line of sight for AI
export const FLAG_WALKABLE = 8; // can be stood on
export const FLAG_VEHICLE_ONLY = 16; // only blocks vehicles (e.g. low walls people can step over handled separately)
export const FLAG_DEFAULT = FLAG_SOLID | FLAG_BULLET | FLAG_SIGHT | FLAG_WALKABLE;

let nextBoxId = 1;

export class Box {
  // center (cx,cy,cz), half extents (hx,hy,hz), yaw (rotation around Y) and optional pitch/roll.
  constructor(cx, cy, cz, hx, hy, hz, yaw = 0, material = 'brick', flags = FLAG_DEFAULT, pitch = 0, roll = 0) {
    this.id = nextBoxId++;
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.hx = hx;
    this.hy = hy;
    this.hz = hz;
    this.material = material;
    this.flags = flags;
    this.owner = null; // optional game object (door, building, destructible)
    this.stamp = 0;
    this.enabled = true;
    this.setRotation(yaw, pitch, roll);
  }

  // Rotation order: yaw (Y), then pitch (X), then roll (Z) - same as THREE 'YXZ'.
  setRotation(yaw, pitch = 0, roll = 0) {
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw);
    const cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const cr = Math.cos(roll),
      sr = Math.sin(roll);
    // Rotation matrix R = Ry * Rx * Rz. Columns are the local axes in world space.
    const m00 = cy * cr + sy * sp * sr,
      m01 = -cy * sr + sy * sp * cr,
      m02 = sy * cp;
    const m10 = cp * sr,
      m11 = cp * cr,
      m12 = -sp;
    const m20 = -sy * cr + cy * sp * sr,
      m21 = sy * sr + cy * sp * cr,
      m22 = cy * cp;
    this.ax = [m00, m10, m20];
    this.ay = [m01, m11, m21];
    this.az = [m02, m12, m22];
    this.yaw = yaw;
    this.pitch = pitch;
    this.roll = roll;
    this.updateBounds();
  }

  updateBounds() {
    // World AABB of the oriented box.
    const ex = Math.abs(this.ax[0]) * this.hx + Math.abs(this.ay[0]) * this.hy + Math.abs(this.az[0]) * this.hz;
    const ey = Math.abs(this.ax[1]) * this.hx + Math.abs(this.ay[1]) * this.hy + Math.abs(this.az[1]) * this.hz;
    const ez = Math.abs(this.ax[2]) * this.hx + Math.abs(this.ay[2]) * this.hy + Math.abs(this.az[2]) * this.hz;
    this.minX = this.cx - ex;
    this.maxX = this.cx + ex;
    this.minY = this.cy - ey;
    this.maxY = this.cy + ey;
    this.minZ = this.cz - ez;
    this.maxZ = this.cz + ez;
  }
}

// Result object reused by queries to avoid garbage.
export class RayHit {
  constructor() {
    this.reset();
  }
  reset() {
    this.t = Infinity; // distance to entry point
    this.tExit = Infinity; // distance to exit point (same box)
    this.box = null; // null means the ground was hit
    this.nx = 0;
    this.ny = 1;
    this.nz = 0;
    this.material = null;
    this.ground = false;
    return this;
  }
}

const tmpHit = new RayHit();

export class CollisionWorld {
  constructor(heightfield, cellSize = 8) {
    this.hf = heightfield;
    this.boxes = [];
    this.cellSize = cellSize;
    this.half = heightfield.half;
    this.gridN = Math.ceil(heightfield.size / cellSize);
    this.cells = new Array(this.gridN * this.gridN);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    this.stamp = 1;
  }

  add(box) {
    this.boxes.push(box);
    this._insert(box);
    return box;
  }

  remove(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
    this._forCells(box, (cell) => {
      const k = cell.indexOf(box);
      if (k >= 0) cell.splice(k, 1);
    });
  }

  // Call after changing a box's position/rotation.
  update(box, oldBounds) {
    if (oldBounds) this._forCellsBounds(oldBounds.minX, oldBounds.minZ, oldBounds.maxX, oldBounds.maxZ, (cell) => {
      const k = cell.indexOf(box);
      if (k >= 0) cell.splice(k, 1);
    });
    box.updateBounds();
    this._insert(box);
  }

  _insert(box) {
    this._forCells(box, (cell) => cell.push(box));
  }

  _forCells(box, fn) {
    this._forCellsBounds(box.minX, box.minZ, box.maxX, box.maxZ, fn);
  }

  _forCellsBounds(minX, minZ, maxX, maxZ, fn) {
    const n = this.gridN,
      cs = this.cellSize,
      h = this.half;
    const x0 = Math.max(0, Math.floor((minX + h) / cs));
    const z0 = Math.max(0, Math.floor((minZ + h) / cs));
    const x1 = Math.min(n - 1, Math.floor((maxX + h) / cs));
    const z1 = Math.min(n - 1, Math.floor((maxZ + h) / cs));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) fn(this.cells[z * n + x]);
  }

  // Collect boxes overlapping an axis-aligned region (deduplicated).
  query(minX, minY, minZ, maxX, maxY, maxZ, out = [], mask = FLAG_SOLID) {
    const stamp = ++this.stamp;
    out.length = 0;
    this._forCellsBounds(minX, minZ, maxX, maxZ, (cell) => {
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        if (b.stamp === stamp || !b.enabled || !(b.flags & mask)) continue;
        b.stamp = stamp;
        if (b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY || b.maxZ < minZ || b.minZ > maxZ) continue;
        out.push(b);
      }
    });
    return out;
  }

  // Ray vs one oriented box (slab test in the box's own frame).
  // Returns true and fills hit.t / hit.tExit / normal if the ray enters the box within maxDist.
  static rayBox(b, ox, oy, oz, dx, dy, dz, maxDist, hit) {
    const px = ox - b.cx,
      py = oy - b.cy,
      pz = oz - b.cz;
    const ax = b.ax,
      ay = b.ay,
      az = b.az;
    const lo = [px * ax[0] + py * ax[1] + pz * ax[2], px * ay[0] + py * ay[1] + pz * ay[2], px * az[0] + py * az[1] + pz * az[2]];
    const ld = [dx * ax[0] + dy * ax[1] + dz * ax[2], dx * ay[0] + dy * ay[1] + dz * ay[2], dx * az[0] + dy * az[1] + dz * az[2]];
    const he = [b.hx, b.hy, b.hz];
    let tmin = -Infinity,
      tmax = Infinity,
      axis = -1,
      sgn = 0;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(ld[i]) < 1e-12) {
        if (lo[i] < -he[i] || lo[i] > he[i]) return false;
      } else {
        const inv = 1 / ld[i];
        let t1 = (-he[i] - lo[i]) * inv;
        let t2 = (he[i] - lo[i]) * inv;
        let s = -1;
        if (t1 > t2) {
          const tt = t1;
          t1 = t2;
          t2 = tt;
          s = 1;
        }
        if (t1 > tmin) {
          tmin = t1;
          axis = i;
          sgn = s;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
      }
    }
    if (tmax < 0 || tmin > maxDist) return false;
    if (tmin < 0) {
      // Ray starts inside the box.
      hit.t = 0;
      hit.tExit = tmax;
      hit.nx = -dx;
      hit.ny = -dy;
      hit.nz = -dz;
      return true;
    }
    const A = axis === 0 ? ax : axis === 1 ? ay : az;
    hit.t = tmin;
    hit.tExit = tmax;
    // The face normal points against the ray direction.
    hit.nx = A[0] * sgn;
    hit.ny = A[1] * sgn;
    hit.nz = A[2] * sgn;
    return true;
  }

  // Nearest hit along a ray against boxes (matching mask) and optionally the ground.
  // Direction must be unit length. ignore: a box to skip (e.g. the one we just exited).
  raycast(ox, oy, oz, dx, dy, dz, maxDist, hit, mask = FLAG_BULLET, withGround = true, ignore = null) {
    hit.reset();
    if (withGround) {
      const tg = this.hf.raycast(ox, oy, oz, dx, dy, dz, maxDist);
      if (tg >= 0) {
        hit.t = tg;
        hit.tExit = tg;
        hit.ground = true;
        const n = this.hf.getNormal(ox + dx * tg, oz + dz * tg, { x: 0, y: 0, z: 0 });
        hit.nx = n.x;
        hit.ny = n.y;
        hit.nz = n.z;
        maxDist = tg;
      }
    }
    // 2D DDA through grid cells.
    const cs = this.cellSize,
      h = this.half,
      n = this.gridN;
    const stamp = ++this.stamp;
    let gx = Math.floor((ox + h) / cs);
    let gz = Math.floor((oz + h) / cs);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const invDx = Math.abs(dx) > 1e-12 ? 1 / Math.abs(dx) : Infinity;
    const invDz = Math.abs(dz) > 1e-12 ? 1 / Math.abs(dz) : Infinity;
    const cellX0 = gx * cs - h,
      cellZ0 = gz * cs - h;
    let tMaxX = dx > 0 ? (cellX0 + cs - ox) * invDx : (ox - cellX0) * invDx;
    let tMaxZ = dz > 0 ? (cellZ0 + cs - oz) * invDz : (oz - cellZ0) * invDz;
    if (!isFinite(tMaxX)) tMaxX = Infinity;
    if (!isFinite(tMaxZ)) tMaxZ = Infinity;
    const tDeltaX = cs * invDx,
      tDeltaZ = cs * invDz;
    let tCell = 0;
    let guard = 0;
    while (tCell <= Math.min(maxDist, hit.t) && guard++ < 4096) {
      if (gx >= 0 && gz >= 0 && gx < n && gz < n) {
        const cell = this.cells[gz * n + gx];
        for (let i = 0; i < cell.length; i++) {
          const b = cell[i];
          if (b.stamp === stamp || !b.enabled || !(b.flags & mask) || b === ignore) continue;
          b.stamp = stamp;
          if (CollisionWorld.rayBox(b, ox, oy, oz, dx, dy, dz, Math.min(maxDist, hit.t), tmpHit) && tmpHit.t < hit.t) {
            hit.t = tmpHit.t;
            hit.tExit = tmpHit.tExit;
            hit.nx = tmpHit.nx;
            hit.ny = tmpHit.ny;
            hit.nz = tmpHit.nz;
            hit.box = b;
            hit.ground = false;
            hit.material = b.material;
          }
        }
      } else if ((gx < 0 && stepX < 0) || (gz < 0 && stepZ < 0) || (gx >= n && stepX > 0) || (gz >= n && stepZ > 0)) {
        break; // left the grid for good
      }
      if (tMaxX < tMaxZ) {
        tCell = tMaxX;
        tMaxX += tDeltaX;
        gx += stepX;
      } else {
        tCell = tMaxZ;
        tMaxZ += tDeltaZ;
        gz += stepZ;
      }
    }
    return hit.t < Infinity;
  }

  // True when nothing blocks sight between two points.
  lineOfSight(ax, ay, az, bx, by, bz, mask = FLAG_SIGHT) {
    const dx = bx - ax,
      dy = by - ay,
      dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return true;
    return !this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, tmpHit2, mask, true);
  }

  // Push a sphere out of boxes. Returns the total correction applied (x,y,z) through out,
  // and the steepest contact normal's y (for "is this floor?").
  resolveSphere(pos, radius, out, mask = FLAG_SOLID) {
    const list = this.query(pos.x - radius, pos.y - radius, pos.z - radius, pos.x + radius, pos.y + radius, pos.z + radius, sphereList, mask);
    out.x = out.y = out.z = 0;
    out.floorY = -1;
    out.hit = false;
    for (let k = 0; k < list.length; k++) {
      const b = list[k];
      const px = pos.x - b.cx,
        py = pos.y - b.cy,
        pz = pos.z - b.cz;
      const ax = b.ax,
        ay = b.ay,
        az = b.az;
      const lx = px * ax[0] + py * ax[1] + pz * ax[2];
      const ly = px * ay[0] + py * ay[1] + pz * ay[2];
      const lz = px * az[0] + py * az[1] + pz * az[2];
      const cx = Math.max(-b.hx, Math.min(b.hx, lx));
      const cy = Math.max(-b.hy, Math.min(b.hy, ly));
      const cz = Math.max(-b.hz, Math.min(b.hz, lz));
      let nx = lx - cx,
        ny = ly - cy,
        nz = lz - cz;
      let d2 = nx * nx + ny * ny + nz * nz;
      let push;
      if (d2 > 1e-10) {
        if (d2 >= radius * radius) continue;
        const d = Math.sqrt(d2);
        push = radius - d;
        nx /= d;
        ny /= d;
        nz /= d;
      } else {
        // Center is inside the box: push out along the shallowest axis.
        const ex = b.hx - Math.abs(lx),
          ey = b.hy - Math.abs(ly),
          ez = b.hz - Math.abs(lz);
        if (ex < ey && ex < ez) {
          nx = Math.sign(lx) || 1;
          ny = 0;
          nz = 0;
          push = ex + radius;
        } else if (ey < ez) {
          nx = 0;
          ny = Math.sign(ly) || 1;
          nz = 0;
          push = ey + radius;
        } else {
          nx = 0;
          ny = 0;
          nz = Math.sign(lz) || 1;
          push = ez + radius;
        }
      }
      // Local normal back to world.
      const wx = nx * ax[0] + ny * ay[0] + nz * az[0];
      const wy = nx * ax[1] + ny * ay[1] + nz * az[1];
      const wz = nx * ax[2] + ny * ay[2] + nz * az[2];
      pos.x += wx * push;
      pos.y += wy * push;
      pos.z += wz * push;
      out.x += wx * push;
      out.y += wy * push;
      out.z += wz * push;
      out.hit = true;
      if (wy > out.floorY) out.floorY = wy;
    }
    return out;
  }
}

const tmpHit2 = new RayHit();
const sphereList = [];
