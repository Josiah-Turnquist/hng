// Walkability grid for the bots: 2 m cells over the play area. A cell is blocked
// by walls and other solid things at body height (grown by a soldier's radius),
// deep water without a bridge over it, and cliffs. Doorways are forced open so
// paths go through doors. A* finds routes; the route is then straightened by
// cutting corners wherever a straight line stays walkable.
import { FLAG_SOLID, FLAG_WALKABLE } from '../physics/collision.js';

const SQRT2 = Math.SQRT2;

export class NavGrid {
  constructor(world, { radius, cell = 2, centerX = 0, centerZ = 0 } = {}) {
    this.world = world;
    this.cell = cell;
    const half = Math.ceil(radius / cell) * cell;
    this.minX = centerX - half;
    this.minZ = centerZ - half;
    this.n = Math.round((2 * half) / cell);
    const N = this.n * this.n;
    this.cost = new Uint8Array(N); // 0 blocked, else step cost x10
    this.floorY = new Float32Array(N);
    this.doorAt = new Map(); // cell -> {x, z} of a doorway center
    // Search scratch (reused between searches).
    this.g = new Float32Array(N);
    this.parent = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.closed = new Uint32Array(N);
    this.gen = 0;
    this.heap = new Int32Array(N);
    this.heapF = new Float32Array(N);
  }

  index(x, z) {
    const ix = Math.floor((x - this.minX) / this.cell),
      iz = Math.floor((z - this.minZ) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.n || iz >= this.n) return -1;
    return iz * this.n + ix;
  }

  cellX(i) {
    return this.minX + ((i % this.n) + 0.5) * this.cell;
  }

  cellZ(i) {
    return this.minZ + (Math.floor(i / this.n) + 0.5) * this.cell;
  }

  walkable(x, z) {
    const i = this.index(x, z);
    return i >= 0 && this.cost[i] > 0;
  }

  // Build from the terrain, water, solid boxes (and the village's own lists of
  // blockers and doors when given).
  build({ blockers = null, doors = [], agentRadius = 0.35, maxSlopeDeg = 38 } = {}) {
    const { world, n, cell } = this;
    const hf = world.hf;
    const coll = world.collision;
    const maxRise = Math.tan((maxSlopeDeg * Math.PI) / 180) * cell;
    // 1. Ground: slope and water.
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        const x = this.minX + (ix + 0.5) * cell,
          z = this.minZ + (iz + 0.5) * cell;
        const h = hf.getHeight(x, z);
        this.floorY[i] = h;
        let c = 10;
        const rise = Math.max(Math.abs(hf.getHeight(x + cell * 0.5, z) - hf.getHeight(x - cell * 0.5, z)), Math.abs(hf.getHeight(x, z + cell * 0.5) - hf.getHeight(x, z - cell * 0.5)));
        if (rise > maxRise) c = 0;
        else if (rise > maxRise * 0.6) c = 18; // steep: slow going
        const wl = world.waterLevelAt?.(x, z);
        if (wl !== null && wl !== undefined && c > 0) {
          const depth = wl - h;
          if (depth > 1.1) c = 0;
          else if (depth > 0.3) c = 30; // wading: avoid unless needed
        }
        this.cost[i] = c;
      }
    }
    // 2. Walkable decks (bridges) open cells over water or gaps.
    for (const b of coll.boxes) {
      if (!(b.flags & FLAG_WALKABLE) || !b.enabled) continue;
      if (b.owner?.isVehicle) continue;
      this._raster(b.cx, b.cz, b.hx, b.hz, b.ax, b.az, -0.1, (i, x, z) => {
        const top = b.maxY;
        const ground = hf.getHeight(x, z);
        if (top > ground + 0.4 && top < ground + 12 && this.cost[i] === 0) {
          // Only a deck if it's a broad, flat surface.
          if (b.hx > 0.8 && b.hz > 0.8 && Math.abs(b.ay[1]) > 0.97) {
            this.cost[i] = 10;
            this.floorY[i] = top;
          }
        }
      });
    }
    // 3. Solid things at body height (grown by the agent's radius). Body height
    // is measured from each cell's own floor, so a bridge's piers and the
    // masonry under its deck don't cut the deck, and overhangs don't block.
    const list = blockers || this._blockersFromWorld();
    for (const b of list) {
      const ax = [Math.cos(b.yaw), 0, -Math.sin(b.yaw)];
      const az = [Math.sin(b.yaw), 0, Math.cos(b.yaw)];
      const lo = b.minY ?? -Infinity,
        hi = b.maxY ?? Infinity;
      this._raster(b.cx, b.cz, b.hx, b.hz, ax, az, agentRadius, (i) => {
        const f = this.floorY[i];
        if (lo > f + 0.6 || hi < f + 0.9) return;
        this.cost[i] = 0;
      });
    }
    // 4. Doorways: open a short corridor through each door.
    for (const d of doors) {
      const fx = Math.sin(d.yaw),
        fz = Math.cos(d.yaw);
      for (let s = -1.6; s <= 1.6; s += cell * 0.4) {
        const i = this.index(d.x + fx * s, d.z + fz * s);
        if (i < 0) continue;
        if (this.cost[i] === 0) this.cost[i] = 12;
        this.doorAt.set(i, { x: d.x + fx * s, z: d.z + fz * s });
      }
    }
    // 5. Prefer to keep off walls: cells next to blocked ones cost a little more.
    const next = this.cost.slice();
    for (let iz = 1; iz < n - 1; iz++)
      for (let ix = 1; ix < n - 1; ix++) {
        const i = iz * n + ix;
        if (!this.cost[i] || this.doorAt.has(i)) continue;
        if (!this.cost[i - 1] || !this.cost[i + 1] || !this.cost[i - n] || !this.cost[i + n]) next[i] = Math.min(250, this.cost[i] + 6);
      }
    this.cost = next;
    this._label();
  }

  // Connected areas (cells joined by open neighbors, as paths move). A search
  // between areas that don't connect gives up at once instead of flooding the
  // map, and inMainArea() tells big open areas from pockets boxed in by walls.
  _label() {
    const { n, cost } = this;
    const N = n * n;
    const comp = new Int32Array(N).fill(-1);
    const sizes = [];
    const q = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (!cost[s] || comp[s] >= 0) continue;
      const id = sizes.length;
      let head = 0,
        tail = 0;
      q[tail++] = s;
      comp[s] = id;
      while (head < tail) {
        const c = q[head++];
        const cx = c % n;
        if (cx > 0 && cost[c - 1] && comp[c - 1] < 0) (comp[c - 1] = id), (q[tail++] = c - 1);
        if (cx < n - 1 && cost[c + 1] && comp[c + 1] < 0) (comp[c + 1] = id), (q[tail++] = c + 1);
        if (c >= n && cost[c - n] && comp[c - n] < 0) (comp[c - n] = id), (q[tail++] = c - n);
        if (c < N - n && cost[c + n] && comp[c + n] < 0) (comp[c + n] = id), (q[tail++] = c + n);
      }
      sizes.push(tail);
    }
    this.comp = comp;
    this.compSize = sizes;
    this.mainSize = sizes.reduce((a, b) => Math.max(a, b), 0);
  }

  inMainArea(x, z) {
    const i = this.index(x, z);
    return i >= 0 && this.cost[i] > 0 && this.compSize[this.comp[i]] >= this.mainSize * 0.2;
  }

  _blockersFromWorld() {
    const out = [];
    for (const b of this.world.collision.boxes) {
      if (!(b.flags & FLAG_SOLID) || !b.enabled || b.owner?.isVehicle) continue;
      // Parts the village builder marks as never in the way (floors, steps,
      // roofs, a bridge's deck and the masonry under it).
      if (b.village?.nav === false) continue;
      // Ramps and slabs are tilted surfaces to walk on; tilted solid volumes
      // (a hedge bank following a slope) still block.
      if ((Math.abs(b.pitch) > 0.05 || Math.abs(b.roll) > 0.05) && b.flags & FLAG_WALKABLE) continue;
      out.push({ cx: b.cx, cz: b.cz, hx: b.hx, hz: b.hz, yaw: b.yaw, minY: b.minY, maxY: b.maxY });
    }
    return out;
  }

  // Call fn for each cell whose center lies in an oriented rectangle grown by pad.
  _raster(cx, cz, hx, hz, ax, az, pad, fn) {
    const ex = hx + pad,
      ez = hz + pad;
    if (ex <= 0 || ez <= 0) return;
    const rx = Math.abs(ax[0]) * ex + Math.abs(az[0]) * ez;
    const rz = Math.abs(ax[2]) * ex + Math.abs(az[2]) * ez;
    const { cell, n } = this;
    const x0 = Math.max(0, Math.floor((cx - rx - this.minX) / cell)),
      x1 = Math.min(n - 1, Math.floor((cx + rx - this.minX) / cell));
    const z0 = Math.max(0, Math.floor((cz - rz - this.minZ) / cell)),
      z1 = Math.min(n - 1, Math.floor((cz + rz - this.minZ) / cell));
    for (let iz = z0; iz <= z1; iz++)
      for (let ix = x0; ix <= x1; ix++) {
        const x = this.minX + (ix + 0.5) * cell - cx,
          z = this.minZ + (iz + 0.5) * cell - cz;
        const lx = x * ax[0] + z * ax[2],
          lz = x * az[0] + z * az[2];
        if (Math.abs(lx) <= ex && Math.abs(lz) <= ez) fn(iz * n + ix, x + cx, z + cz);
      }
  }

  // Nearest walkable cell to a point (searching outward in rings).
  nearestWalkable(x, z, maxR = 20) {
    const i0 = this.index(x, z);
    if (i0 >= 0 && this.cost[i0]) return i0;
    const n = this.n;
    const ix = Math.floor((x - this.minX) / this.cell),
      iz = Math.floor((z - this.minZ) / this.cell);
    for (let r = 1; r <= maxR; r++) {
      let best = -1,
        bd = Infinity;
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const jx = ix + dx,
            jz = iz + dz;
          if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue;
          const j = jz * n + jx;
          if (!this.cost[j]) continue;
          const d = dx * dx + dz * dz;
          if (d < bd) {
            bd = d;
            best = j;
          }
        }
      if (best >= 0) return best;
    }
    return -1;
  }

  // A* from (sx, sz) to (gx, gz). Returns [{x, z}, ...] or null. With partial,
  // a search that runs out of steps returns the route to the point it got
  // closest to the goal (flagged .partial), to walk while planning on from there.
  findPath(sx, sz, gx, gz, maxExpand = 80000, { partial = false } = {}) {
    const n = this.n;
    const start = this.nearestWalkable(sx, sz);
    const goal = this.nearestWalkable(gx, gz);
    // Why the last search failed: 'blocked' (no open cell nearby), 'apart' (the
    // two ends are in areas that don't connect) or 'limit' (too long a route).
    this.lastFail = null;
    if (start < 0 || goal < 0) {
      this.lastFail = 'blocked';
      return null;
    }
    if (start === goal) return [{ x: gx, z: gz }];
    if (this.comp && this.comp[start] !== this.comp[goal]) {
      this.lastFail = 'apart';
      return null;
    }
    const gen = ++this.gen;
    const { g, parent, stamp, closed, cost, heap, heapF } = this;
    const gxI = goal % n,
      gzI = Math.floor(goal / n);
    const h = (i) => {
      const dx = Math.abs((i % n) - gxI),
        dz = Math.abs(Math.floor(i / n) - gzI);
      return 10 * (dx + dz) + (10 * SQRT2 - 20) * Math.min(dx, dz);
    };
    let size = 0;
    const push = (i, f) => {
      let k = size++;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heapF[p] <= f) break;
        heap[k] = heap[p];
        heapF[k] = heapF[p];
        k = p;
      }
      heap[k] = i;
      heapF[k] = f;
    };
    const pop = () => {
      const top = heap[0];
      const li = heap[--size],
        lf = heapF[size];
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= size) break;
        if (c + 1 < size && heapF[c + 1] < heapF[c]) c++;
        if (heapF[c] >= lf) break;
        heap[k] = heap[c];
        heapF[k] = heapF[c];
        k = c;
      }
      heap[k] = li;
      heapF[k] = lf;
      return top;
    };
    stamp[start] = gen;
    g[start] = 0;
    parent[start] = -1;
    push(start, h(start));
    let expanded = 0;
    let found = false;
    let best = start,
      bestH = h(start);
    while (size > 0) {
      const cur = pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === goal) {
        found = true;
        break;
      }
      const hc = h(cur);
      if (hc < bestH) {
        bestH = hc;
        best = cur;
      }
      if (++expanded > maxExpand) break;
      const cx = cur % n,
        cz = (cur - cx) / n;
      for (let k = 0; k < 8; k++) {
        const dx = DX[k],
          dz = DZ[k];
        const nx = cx + dx,
          nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
        const j = nz * n + nx;
        const cj = cost[j];
        if (!cj || closed[j] === gen) continue;
        // No cutting corners past blocked cells.
        if (dx && dz && (!cost[cz * n + nx] || !cost[nz * n + cx])) continue;
        const step = (dx && dz ? SQRT2 : 1) * (cj + cost[cur]) * 0.5;
        const ng = g[cur] + step;
        if (stamp[j] !== gen || ng < g[j]) {
          stamp[j] = gen;
          g[j] = ng;
          parent[j] = cur;
          push(j, ng + h(j));
        }
      }
    }
    let end = goal;
    if (!found) {
      this.lastFail = 'limit';
      if (!partial || best === start) return null;
      end = best;
    }
    const cells = [];
    for (let c = end; c !== -1; c = parent[c]) cells.push(c);
    cells.reverse();
    const path = found ? this._smooth(cells, gx, gz) : this._smooth(cells, this.cellX(end), this.cellZ(end));
    // Standing in a blocked cell (pressed against a wall or hedge): step to
    // the open cell the route starts from first.
    if (this.index(sx, sz) !== start) path.unshift({ x: this.cellX(start), z: this.cellZ(start) });
    if (!found) path.partial = true;
    return path;
  }

  // Keep only the turning points: skip ahead while a straight line stays on
  // walkable cells; always keep doorways.
  _smooth(cells, gx, gz) {
    const out = [];
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      for (; j > i + 1; j--) {
        if (this._hasDoorBetween(cells, i, j)) continue;
        if (this.lineWalkable(this.cellX(cells[i]), this.cellZ(cells[i]), this.cellX(cells[j]), this.cellZ(cells[j]))) break;
      }
      const c = cells[j];
      const door = this.doorAt.get(c);
      out.push(door ? { x: door.x, z: door.z, door: true } : { x: this.cellX(c), z: this.cellZ(c) });
      i = j;
    }
    if (out.length) {
      const last = out[out.length - 1];
      if (this.walkable(gx, gz)) {
        last.x = gx;
        last.z = gz;
      }
    }
    return out;
  }

  _hasDoorBetween(cells, i, j) {
    for (let k = i + 1; k < j; k++) if (this.doorAt.has(cells[k])) return true;
    return false;
  }

  // Is the straight line walkable (cells along it all open, a little margin)?
  lineWalkable(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(d / (this.cell * 0.5));
    let maxCost = 0;
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      const i = this.index(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (i < 0 || !this.cost[i]) return false;
      maxCost = Math.max(maxCost, this.cost[i]);
    }
    return maxCost < 30; // don't straighten a path into the water
  }
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
