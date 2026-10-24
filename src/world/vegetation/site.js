// What the ground looks like to a planter: forest value, surface type, height, slope,
// distance to roads and the river, and an exclusion mask (buildings, village plots,
// capture points, firing lanes). Everything is sampled on the heightfield grid.
import { SURF } from '../heightfield.js';

export const EX_BUILDING = 1; // building footprints: nothing grows (not even grass)
export const EX_PLOT = 2; // village plots, gardens, yards, the square: no wild trees or hedges
export const EX_POINT = 4; // capture points: kept clear so they stay fightable
export const EX_FLAT = 8; // firing range lanes: no trees, hedges, bushes or tall crops
export const EX_VILLAGE = 16; // near the village center (as terrainGen does for hedges)

export class VegSite {
  constructor(terrain, def, { village = null, plan = null } = {}) {
    this.terrain = terrain;
    this.def = def;
    const hf = (this.hf = terrain.hf);
    this.res = hf.res;
    this.cell = hf.cell;
    this.half = hf.half;
    const n = hf.res * hf.res;
    // Distance to the nearest road edge (meters, Infinity when far from every road).
    this.roadEdge = new Float32Array(n).fill(Infinity);
    for (const road of terrain.roads) {
      const d = road.distField.dist;
      const h = road.width / 2;
      for (let i = 0; i < n; i++) {
        const e = d[i] - h;
        if (e < this.roadEdge[i]) this.roadEdge[i] = e;
      }
    }
    this.river = terrain.river;
    this.mask = new Uint8Array(n);
    this._buildMask(village, plan);
  }

  _buildMask(village, plan) {
    const def = this.def;
    // Oriented rectangles.
    const rect = (cx, cz, hx, hz, yaw, margin, bit) => {
      const c = Math.cos(yaw),
        s = Math.sin(yaw);
      const ex = hx + margin,
        ez = hz + margin;
      const rx = Math.abs(c) * ex + Math.abs(s) * ez,
        rz = Math.abs(s) * ex + Math.abs(c) * ez;
      this._forCells(cx - rx, cz - rz, cx + rx, cz + rz, (i, x, z) => {
        const dx = x - cx,
          dz = z - cz;
        const lx = c * dx - s * dz,
          lz = s * dx + c * dz;
        if (Math.abs(lx) <= ex && Math.abs(lz) <= ez) this.mask[i] |= bit;
      });
    };
    const disc = (cx, cz, r, bit) =>
      this._forCells(cx - r, cz - r, cx + r, cz + r, (i, x, z) => {
        if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) this.mask[i] |= bit;
      });
    for (const f of village?.footprints || []) rect(f.cx, f.cz, f.hx, f.hz, f.yaw, 0.8, EX_BUILDING | EX_PLOT);
    for (const r of plan?.site?.rects || []) rect(r.cx, r.cz, r.hx, r.hz, r.yaw, 3, EX_PLOT);
    if (plan?.square?.poly) {
      const xs = plan.square.poly.map((p) => p[0]),
        zs = plan.square.poly.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
        cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      disc(cx, cz, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 3, EX_PLOT);
    }
    for (const o of def.objectives || []) disc(o.x, o.z, 12, EX_POINT);
    for (const line of def.lines || []) for (const p of line.points) disc(p[0], p[1], 12, EX_POINT);
    for (const fz of def.flatZones || []) {
      const m = 18;
      this._forCells(fz.x0 - m, fz.z0 - m, fz.x1 + m, fz.z1 + m, (i) => (this.mask[i] |= EX_FLAT));
    }
    if (def.village) disc(def.village.x, def.village.z, def.village.radius + 15, EX_VILLAGE);
  }

  _forCells(x0, z0, x1, z1, fn) {
    const { res, cell, half } = this;
    const ix0 = Math.max(0, Math.floor((x0 + half) / cell)),
      ix1 = Math.min(res - 1, Math.ceil((x1 + half) / cell));
    const iz0 = Math.max(0, Math.floor((z0 + half) / cell)),
      iz1 = Math.min(res - 1, Math.ceil((z1 + half) / cell));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) fn(iz * res + ix, ix * cell - half, iz * cell - half);
  }

  index(x, z) {
    const { res, cell, half } = this;
    let ix = Math.round((x + half) / cell),
      iz = Math.round((z + half) / cell);
    if (ix < 0) ix = 0;
    else if (ix > res - 1) ix = res - 1;
    if (iz < 0) iz = 0;
    else if (iz > res - 1) iz = res - 1;
    return iz * res + ix;
  }

  inside(x, z, margin = 0) {
    return Math.abs(x) < this.half - margin && Math.abs(z) < this.half - margin;
  }

  // Bilinear forest value (> 0 inside woods).
  forest(x, z) {
    const { res, cell, half } = this;
    const f = this.terrain.forest;
    let gx = (x + half) / cell,
      gz = (z + half) / cell;
    gx = Math.max(0, Math.min(res - 1.001, gx));
    gz = Math.max(0, Math.min(res - 1.001, gz));
    const ix = gx | 0,
      iz = gz | 0;
    const fx = gx - ix,
      fz = gz - iz;
    const i = iz * res + ix;
    return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fz) + (f[i + res] * (1 - fx) + f[i + res + 1] * fx) * fz;
  }

  height(x, z) {
    return this.hf.getHeight(x, z);
  }

  surface(x, z) {
    return this.hf.surface[this.index(x, z)];
  }

  flags(x, z) {
    return this.mask[this.index(x, z)];
  }

  roadDist(x, z) {
    return this.roadEdge[this.index(x, z)];
  }

  riverDist(x, z) {
    if (!this.river) return Infinity;
    return this.river.distField.dist[this.index(x, z)];
  }

  // Ground height above the river's water level (Infinity away from the river).
  aboveWater(x, z) {
    if (!this.river) return Infinity;
    const i = this.index(x, z);
    const n = this.river.distField.nearest[i];
    if (n < 0) return Infinity;
    return this.hf.getHeight(x, z) - this.river.level[n];
  }

  slope(x, z) {
    const e = this.cell;
    const dx = this.hf.getHeight(x + e, z) - this.hf.getHeight(x - e, z);
    const dz = this.hf.getHeight(x, z + e) - this.hf.getHeight(x, z - e);
    return Math.atan(Math.hypot(dx, dz) / (2 * e));
  }

  // Can a tree (or a bush, with smaller margins) grow here?
  canPlant(x, z, { road = 3, river = 4, mask = EX_BUILDING | EX_PLOT | EX_POINT | EX_FLAT, maxSlope = 0.62 } = {}) {
    if (!this.inside(x, z, 6)) return false;
    const i = this.index(x, z);
    if (this.mask[i] & mask) return false;
    if (this.roadEdge[i] < road) return false;
    const s = this.hf.surface[i];
    if (s === SURF.ROAD || s === SURF.WATER || s === SURF.COBBLE || s === SURF.ROCK || s === SURF.SAND) return false;
    if (this.river) {
      const d = this.river.distField.dist[i];
      if (d < this.river.half + river) return false;
      if (d < this.river.half + 30 && this.aboveWater(x, z) < 0.5) return false;
    }
    if (this.slope(x, z) > maxSlope) return false;
    return true;
  }
}
