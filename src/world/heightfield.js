// A square grid of ground heights. Used by physics (walking, driving, bullets)
// and by the renderer (terrain mesh, normal map, splat map).
// The grid is centered on the world origin: x and z run from -size/2 to +size/2.

export const SURF = {
  GRASS: 0,
  DRY_GRASS: 1,
  DIRT: 2,
  MUD: 3,
  ROCK: 4,
  FIELD: 5, // plowed farmland
  COBBLE: 6,
  FOREST: 7, // leaves and needles on the forest floor
  ROAD: 8, // packed dirt road (drawn as a separate decal mesh)
  SAND: 9,
  WATER: 10,
  WHEAT: 11, // standing crop
};

// Rolling friction and grip for vehicles and footstep character per surface.
// mu: peak tire friction coefficient. roll: extra rolling resistance. sink: how much
// wheels/tracks sink (visual + extra drag). These follow published ranges for
// tires on dry grass (~0.55), dirt (~0.65), mud (~0.3), packed road (~0.75).
export const SURFACE_INFO = [
  { name: 'grass', mu: 0.55, roll: 0.06, sink: 0.02, step: 'grass', bulletMat: 'soil' },
  { name: 'dry grass', mu: 0.6, roll: 0.05, sink: 0.01, step: 'grass', bulletMat: 'soil' },
  { name: 'dirt', mu: 0.65, roll: 0.05, sink: 0.02, step: 'dirt', bulletMat: 'soil' },
  { name: 'mud', mu: 0.3, roll: 0.16, sink: 0.08, step: 'mud', bulletMat: 'mud' },
  { name: 'rock', mu: 0.7, roll: 0.02, sink: 0, step: 'stone', bulletMat: 'rock' },
  { name: 'field', mu: 0.45, roll: 0.12, sink: 0.05, step: 'dirt', bulletMat: 'soil' },
  { name: 'cobblestone', mu: 0.75, roll: 0.02, sink: 0, step: 'stone', bulletMat: 'rock' },
  { name: 'forest floor', mu: 0.5, roll: 0.07, sink: 0.02, step: 'leaves', bulletMat: 'soil' },
  { name: 'dirt road', mu: 0.72, roll: 0.03, sink: 0.005, step: 'gravel', bulletMat: 'soil' },
  { name: 'sand', mu: 0.45, roll: 0.15, sink: 0.06, step: 'sand', bulletMat: 'sand' },
  { name: 'water', mu: 0.2, roll: 0.4, sink: 0.3, step: 'water', bulletMat: 'water' },
  { name: 'wheat', mu: 0.5, roll: 0.08, sink: 0.03, step: 'grass', bulletMat: 'soil' },
];

export class Heightfield {
  constructor(size, res) {
    this.size = size;
    this.res = res;
    this.cell = size / (res - 1);
    this.half = size / 2;
    this.heights = new Float32Array(res * res);
    this.surface = new Uint8Array(res * res);
    this.waterLevel = -1000; // global water plane height (rivers use their own meshes)
    this.minH = 0;
    this.maxH = 0;
  }

  index(ix, iz) {
    return iz * this.res + ix;
  }

  // Grid coordinates (fractional) for a world position.
  toGrid(x, z) {
    return [(x + this.half) / this.cell, (z + this.half) / this.cell];
  }

  worldX(ix) {
    return ix * this.cell - this.half;
  }

  worldZ(iz) {
    return iz * this.cell - this.half;
  }

  heightAtIndex(ix, iz) {
    const r = this.res;
    if (ix < 0) ix = 0;
    else if (ix > r - 1) ix = r - 1;
    if (iz < 0) iz = 0;
    else if (iz > r - 1) iz = r - 1;
    return this.heights[iz * r + ix];
  }

  // Height at a world position. Uses the same two-triangles-per-cell split as the
  // rendered terrain mesh, so feet and wheels sit exactly on the visible ground.
  // Positions outside the map are clamped.
  getHeight(x, z) {
    const r = this.res;
    let gx = (x + this.half) / this.cell;
    let gz = (z + this.half) / this.cell;
    if (gx < 0) gx = 0;
    else if (gx > r - 1.0001) gx = r - 1.0001;
    if (gz < 0) gz = 0;
    else if (gz > r - 1.0001) gz = r - 1.0001;
    const ix = gx | 0;
    const iz = gz | 0;
    const fx = gx - ix;
    const fz = gz - iz;
    const i = iz * r + ix;
    const h = this.heights;
    if (fx + fz <= 1) {
      const a = h[i];
      return a + (h[i + 1] - a) * fx + (h[i + r] - a) * fz;
    }
    const d = h[i + r + 1];
    return d + (h[i + r] - d) * (1 - fx) + (h[i + 1] - d) * (1 - fz);
  }

  // Surface normal from central differences. Writes into out (THREE.Vector3 or {x,y,z}).
  getNormal(x, z, out) {
    const e = this.cell;
    const hl = this.getHeight(x - e, z);
    const hr = this.getHeight(x + e, z);
    const hd = this.getHeight(x, z - e);
    const hu = this.getHeight(x, z + e);
    let nx = hl - hr;
    let ny = 2 * e;
    let nz = hd - hu;
    const len = Math.hypot(nx, ny, nz);
    out.x = nx / len;
    out.y = ny / len;
    out.z = nz / len;
    return out;
  }

  // Slope angle in radians at a point.
  getSlope(x, z) {
    const n = this.getNormal(x, z, { x: 0, y: 0, z: 0 });
    return Math.acos(Math.min(1, n.y));
  }

  getSurface(x, z) {
    const r = this.res;
    let ix = Math.round((x + this.half) / this.cell);
    let iz = Math.round((z + this.half) / this.cell);
    if (ix < 0) ix = 0;
    else if (ix > r - 1) ix = r - 1;
    if (iz < 0) iz = 0;
    else if (iz > r - 1) iz = r - 1;
    return this.surface[iz * r + ix];
  }

  setSurfaceAt(x, z, s) {
    const r = this.res;
    const ix = Math.round((x + this.half) / this.cell);
    const iz = Math.round((z + this.half) / this.cell);
    if (ix < 0 || iz < 0 || ix >= r || iz >= r) return;
    this.surface[iz * r + ix] = s;
  }

  // Ray against the ground. Returns distance along the (unit) direction, or -1.
  // Marches forward (taking bigger steps while high above the ground, which is safe
  // because the ground can't rise faster than about 1 m per meter), then refines the
  // crossing with bisection.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    const step = this.cell * 0.5;
    let prevT = 0;
    let t = 0;
    for (;;) {
      const y = oy + dy * t;
      if (dy >= 0 && y > this.maxH + 0.01) return -1;
      const above = y - this.getHeight(ox + dx * t, oz + dz * t);
      if (above <= 0) {
        if (t === 0) return 0; // started underground
        let lo = prevT,
          hi = t;
        for (let k = 0; k < 12; k++) {
          const mid = (lo + hi) * 0.5;
          const a = oy + dy * mid - this.getHeight(ox + dx * mid, oz + dz * mid);
          if (a > 0) lo = mid;
          else hi = mid;
        }
        return (lo + hi) * 0.5;
      }
      if (t >= maxDist) return -1;
      prevT = t;
      t = Math.min(maxDist, t + Math.max(step, above * 0.4));
    }
  }

  computeRange() {
    let lo = Infinity,
      hi = -Infinity;
    for (const h of this.heights) {
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
    this.minH = lo;
    this.maxH = hi;
  }

  // Simple box blur over a region, used to soften edits (craters, flattening).
  smoothRegion(x0, z0, x1, z1, passes = 1) {
    const r = this.res;
    const [gx0, gz0] = this.toGrid(x0, z0);
    const [gx1, gz1] = this.toGrid(x1, z1);
    const ax = Math.max(1, Math.floor(gx0)),
      az = Math.max(1, Math.floor(gz0));
    const bx = Math.min(r - 2, Math.ceil(gx1)),
      bz = Math.min(r - 2, Math.ceil(gz1));
    const h = this.heights;
    for (let p = 0; p < passes; p++) {
      const copy = h.slice();
      for (let iz = az; iz <= bz; iz++) {
        for (let ix = ax; ix <= bx; ix++) {
          const i = iz * r + ix;
          h[i] = (copy[i] * 4 + copy[i - 1] + copy[i + 1] + copy[i - r] + copy[i + r]) / 8;
        }
      }
    }
  }
}
