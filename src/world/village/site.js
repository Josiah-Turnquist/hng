// Spatial helpers used while planning the village: exact distances to road
// centerlines and the river, an occupancy list of oriented rectangles, and a
// terrain editor that flattens building plots with smooth blends.
import { SURF } from '../heightfield.js';
import { smoothstep } from '../../core/math.js';

// Distance from point to segment (2D).
function segDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax,
    abz = bz - az;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + abx * t),
    dz = pz - (az + abz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

export class Site {
  constructor(terrain, def) {
    this.terrain = terrain;
    this.def = def;
    this.hf = terrain.hf;
    this.cell = 16;
    this.reach = 40; // distances beyond this are reported as "far"
    this.segs = []; // [ax, az, bx, bz, roadIndex, halfWidth]
    terrain.roads.forEach((road, ri) => {
      const s = road.samples;
      for (let i = 0; i < s.length - 1; i++) this.segs.push([s[i][0], s[i][1], s[i + 1][0], s[i + 1][1], ri, road.width / 2]);
    });
    this.grid = new Map();
    const c = this.cell;
    this.segs.forEach((sg, k) => {
      const x0 = Math.floor((Math.min(sg[0], sg[2]) - this.reach) / c),
        x1 = Math.floor((Math.max(sg[0], sg[2]) + this.reach) / c);
      const z0 = Math.floor((Math.min(sg[1], sg[3]) - this.reach) / c),
        z1 = Math.floor((Math.max(sg[1], sg[3]) + this.reach) / c);
      for (let gz = z0; gz <= z1; gz++)
        for (let gx = x0; gx <= x1; gx++) {
          const key = gx * 100003 + gz;
          let list = this.grid.get(key);
          if (!list) this.grid.set(key, (list = []));
          list.push(k);
        }
    });
    this.rects = []; // occupancy: {cx, cz, hx, hz, yaw, tag}
  }

  // Distance to the nearest road edge (negative inside a road). Returns reach when far.
  roadEdgeDist(x, z, extra = 0.8) {
    const list = this.grid.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    if (!list) return this.reach;
    let best = this.reach;
    for (const k of list) {
      const s = this.segs[k];
      const d = segDist(x, z, s[0], s[1], s[2], s[3]) - s[5] - extra;
      if (d < best) best = d;
    }
    return best;
  }

  // Nearest road centerline info: { d, road, i (sample), tx, tz } or null when far.
  nearestRoad(x, z) {
    const list = this.grid.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    if (!list) return null;
    let best = null;
    for (const k of list) {
      const s = this.segs[k];
      const d = segDist(x, z, s[0], s[1], s[2], s[3]);
      if (!best || d < best.d) {
        const l = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1;
        best = { d, road: this.terrain.roads[s[4]], tx: (s[2] - s[0]) / l, tz: (s[3] - s[1]) / l, half: s[5] };
      }
    }
    return best;
  }

  riverDist(x, z) {
    const river = this.terrain.river;
    if (!river) return Infinity;
    const hf = this.hf;
    const gx = Math.round((x + hf.half) / hf.cell),
      gz = Math.round((z + hf.half) / hf.cell);
    if (gx < 0 || gz < 0 || gx >= hf.res || gz >= hf.res) return Infinity;
    return river.distField.dist[gz * hf.res + gx];
  }

  // Sample points over an oriented rectangle (with margin) and return the smallest
  // clearance to roads, and whether any point is near the river.
  rectClearance(cx, cz, hx, hz, yaw, step = 1) {
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    let road = Infinity,
      river = Infinity;
    const nx = Math.max(1, Math.ceil((2 * hx) / step)),
      nz = Math.max(1, Math.ceil((2 * hz) / step));
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const lx = -hx + (2 * hx * i) / nx,
          lz = -hz + (2 * hz * j) / nz;
        const x = cx + c * lx + s * lz,
          z = cz - s * lx + c * lz;
        road = Math.min(road, this.roadEdgeDist(x, z));
        river = Math.min(river, this.riverDist(x, z));
      }
    }
    return { road, river };
  }

  // --- Occupancy ------------------------------------------------------------------
  overlaps(cx, cz, hx, hz, yaw, margin = 0, ignoreTag = null) {
    for (const r of this.rects) {
      if (ignoreTag && r.tag === ignoreTag) continue;
      if (obbOverlap(cx, cz, hx + margin, hz + margin, yaw, r.cx, r.cz, r.hx, r.hz, r.yaw)) return r;
    }
    return null;
  }

  occupy(cx, cz, hx, hz, yaw, tag = null) {
    const r = { cx, cz, hx, hz, yaw, tag };
    this.rects.push(r);
    return r;
  }
}

// Separating-axis test for two oriented rectangles in the x/z plane.
// A rectangle's local x axis is (cos yaw, -sin yaw), local z is (sin yaw, cos yaw).
export function obbOverlap(ax, az, ahx, ahz, ayaw, bx, bz, bhx, bhz, byaw) {
  const ac = Math.cos(ayaw),
    as = Math.sin(ayaw);
  const bc = Math.cos(byaw),
    bs = Math.sin(byaw);
  const axes = [
    [ac, -as],
    [as, ac],
    [bc, -bs],
    [bs, bc],
  ];
  const dx = bx - ax,
    dz = bz - az;
  for (const [ux, uz] of axes) {
    const ra = ahx * Math.abs(ac * ux - as * uz) + ahz * Math.abs(as * ux + ac * uz);
    const rb = bhx * Math.abs(bc * ux - bs * uz) + bhz * Math.abs(bs * ux + bc * uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  }
  return true;
}

// Point inside an oriented rectangle?
export function inRect(x, z, r, margin = 0) {
  const c = Math.cos(r.yaw),
    s = Math.sin(r.yaw);
  const dx = x - r.cx,
    dz = z - r.cz;
  const lx = c * dx - s * dz,
    lz = s * dx + c * dz;
  return Math.abs(lx) <= r.hx + margin && Math.abs(lz) <= r.hz + margin;
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i],
      [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function polyDist(x, z, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, segDist(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  return pointInPoly(x, z, poly) ? -best : best;
}

// ---------------------------------------------------------------------------------------
// Terrain editing: plots are flattened toward a target height with a smooth blend.
// Several overlapping plots are combined with weights that favor the strongest.

export class TerrainEditor {
  constructor(site) {
    this.site = site;
    this.hf = site.hf;
    const n = this.hf.res * this.hf.res;
    this.wsum = new Float32Array(n);
    this.tsum = new Float32Array(n);
    this.wmax = new Float32Array(n);
  }

  // Average ground height over an oriented rectangle.
  averageHeight(cx, cz, hx, hz, yaw) {
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    let sum = 0,
      n = 0;
    for (let i = 0; i <= 6; i++)
      for (let j = 0; j <= 6; j++) {
        const lx = -hx + (2 * hx * i) / 6,
          lz = -hz + (2 * hz * j) / 6;
        sum += this.hf.getHeight(cx + c * lx + s * lz, cz - s * lx + c * lz);
        n++;
      }
    return sum / n;
  }

  _stamp(x0, z0, x1, z1, weightAt, target) {
    const hf = this.hf;
    const r = hf.res;
    const gx0 = Math.max(0, Math.floor((x0 + hf.half) / hf.cell)),
      gx1 = Math.min(r - 1, Math.ceil((x1 + hf.half) / hf.cell));
    const gz0 = Math.max(0, Math.floor((z0 + hf.half) / hf.cell)),
      gz1 = Math.min(r - 1, Math.ceil((z1 + hf.half) / hf.cell));
    for (let iz = gz0; iz <= gz1; iz++) {
      const z = iz * hf.cell - hf.half;
      for (let ix = gx0; ix <= gx1; ix++) {
        const x = ix * hf.cell - hf.half;
        let w = weightAt(x, z);
        if (w <= 0) continue;
        // Never touch road surfaces or the river bed.
        const rd = this.site.roadEdgeDist(x, z, 0.4);
        w *= smoothstep(0, 2.5, rd);
        const rv = this.site.riverDist(x, z);
        if (rv < this.site.terrain.river?.half + 12) w *= smoothstep(this.site.terrain.river.half + 4, this.site.terrain.river.half + 12, rv);
        if (w <= 0) continue;
        const i = iz * r + ix;
        const wp = w * w * w * w;
        this.wsum[i] += wp;
        this.tsum[i] += wp * (typeof target === 'function' ? target(x, z) : target);
        if (w > this.wmax[i]) this.wmax[i] = w;
      }
    }
  }

  // Flatten an oriented rectangle (core) to height h, blending over `blend` meters.
  flattenRect(cx, cz, hx, hz, yaw, h, blend = 4) {
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const ext = Math.hypot(hx, hz) + blend + 2;
    this._stamp(
      cx - ext,
      cz - ext,
      cx + ext,
      cz + ext,
      (x, z) => {
        const dx = x - cx,
          dz = z - cz;
        const lx = Math.abs(c * dx - s * dz) - hx,
          lz = Math.abs(s * dx + c * dz) - hz;
        const d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
        return 1 - smoothstep(0, blend, d);
      },
      h,
    );
  }

  flattenPoly(poly, h, blend = 4) {
    let x0 = Infinity,
      z0 = Infinity,
      x1 = -Infinity,
      z1 = -Infinity;
    for (const [x, z] of poly) {
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x);
      z1 = Math.max(z1, z);
    }
    this._stamp(x0 - blend - 2, z0 - blend - 2, x1 + blend + 2, z1 + blend + 2, (x, z) => 1 - smoothstep(0, blend, polyDist(x, z, poly)), h);
  }

  apply() {
    const hf = this.hf;
    const H = hf.heights;
    for (let i = 0; i < H.length; i++) {
      const w = this.wmax[i];
      if (w <= 0) continue;
      const t = this.tsum[i] / this.wsum[i];
      H[i] += (t - H[i]) * w;
    }
    hf.computeRange();
  }

  // Surfaces -----------------------------------------------------------------------
  paintRect(cx, cz, hx, hz, yaw, surf, opts = {}) {
    const hf = this.hf;
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const ext = Math.hypot(hx, hz) + 1;
    for (let z = cz - ext; z <= cz + ext; z += hf.cell * 0.5) {
      for (let x = cx - ext; x <= cx + ext; x += hf.cell * 0.5) {
        const dx = x - cx,
          dz = z - cz;
        const lx = c * dx - s * dz,
          lz = s * dx + c * dz;
        if (Math.abs(lx) > hx || Math.abs(lz) > hz) continue;
        this._paint(x, z, surf, opts);
      }
    }
  }

  paintPoly(poly, surf, opts = {}) {
    let x0 = Infinity,
      z0 = Infinity,
      x1 = -Infinity,
      z1 = -Infinity;
    for (const [x, z] of poly) {
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x);
      z1 = Math.max(z1, z);
    }
    const hf = this.hf;
    for (let z = z0; z <= z1; z += hf.cell * 0.5) for (let x = x0; x <= x1; x += hf.cell * 0.5) if (pointInPoly(x, z, poly)) this._paint(x, z, surf, opts);
  }

  _paint(x, z, surf, opts) {
    const cur = this.hf.getSurface(x, z);
    if (cur === SURF.WATER) return;
    if (cur === SURF.ROAD && !opts.overRoad) return;
    this.hf.setSurfaceAt(x, z, surf);
  }
}
