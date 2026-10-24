// Ground cover around the camera: meadow grass, dry pasture grass, ripe wheat, bracken
// in the woods, flowers, poppies at the edges of the wheat, weeds on bare ground.
//
// The ground is cut into 16 m tiles. A tile's plants are generated once (deterministic
// for the map) from the surface types - following the same wobbly borders the terrain
// shader draws - and kept sorted by a random rank. The instance buffer is refilled
// from the tiles in range and in view when the camera moves or turns; farther tiles
// contribute only their lowest-ranked plants. In the shader every clump fades by rank
// (fewer, bigger clumps with distance) and all of them sink into the ground at the
// far end, so there's no visible edge. One draw call; the nearest clumps also cast
// shadows (a second mesh in vegetation.js draws them into the shadow maps only).
import * as THREE from 'three';
import { SURF } from '../heightfield.js';
import { GC } from './species.js';
import { EX_BUILDING, EX_FLAT } from './site.js';
import { ViewFilter, RefillTrigger } from './lod.js';

const TILE = 16;
const MAX_DENSITY = 12; // clumps per m2 at grassDensity 1 (meadows, wheat)

// Per surface: clumps per m2 and the mix of plants. Late summer: the meadows have
// grown knee-high and gone to seed (straw, tan and olive, still green low down).
const COVER = [];
COVER[SURF.GRASS] = { d: 12, mix: [[GC.grass, 0.46], [GC.dry, 0.2], [GC.tall, 0.24], [GC.flowers, 0.06], [GC.weeds, 0.04]] };
// Pasture: grazed a little shorter and drier.
COVER[SURF.DRY_GRASS] = { d: 11, mix: [[GC.dry, 0.45], [GC.grass, 0.27], [GC.tall, 0.22], [GC.flowers, 0.06]] };
COVER[SURF.WHEAT] = { d: 11, mix: [[GC.wheat, 0.955], [GC.poppies, 0.03], [GC.tall, 0.015]] };
COVER[SURF.FOREST] = { d: 1.3, mix: [[GC.fern, 0.75], [GC.tall, 0.1], [GC.weeds, 0.15]] };
COVER[SURF.DIRT] = { d: 0.6, mix: [[GC.grass, 0.5], [GC.weeds, 0.5]] };
// Plowed land is bare except for a weedy strip along its margins.
COVER[SURF.FIELD] = { d: 2.5, edge: true, mix: [[GC.weeds, 0.55], [GC.grass, 0.35], [GC.tall, 0.1]] };
// Nothing on mud, rock, cobbles, sand, water or roads.
// Width and height ranges (m) per plant card.
const SIZE = [];
SIZE[GC.grass] = [0.55, 0.75, 0.38, 0.62];
SIZE[GC.dry] = [0.55, 0.75, 0.42, 0.66];
SIZE[GC.wheat] = [0.5, 0.62, 0.82, 1.02];
SIZE[GC.fern] = [0.9, 1.3, 0.5, 0.8];
SIZE[GC.flowers] = [0.5, 0.6, 0.45, 0.6];
SIZE[GC.poppies] = [0.5, 0.6, 0.62, 0.82];
SIZE[GC.tall] = [0.6, 0.8, 0.7, 1.0];
SIZE[GC.weeds] = [0.4, 0.55, 0.18, 0.3];

// The value noise and border wobble of the terrain shader (terrainMesh.js), so plants
// stop where the drawn grass stops.
const fract = (v) => v - Math.floor(v);
function th(x, y) {
  let p3x = fract(x * 0.1031),
    p3y = fract(y * 0.1031),
    p3z = fract(x * 0.1031);
  const d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x += d;
  p3y += d;
  p3z += d;
  return fract((p3x + p3y) * p3z);
}
function tvn(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = th(ix, iy),
    b = th(ix + 1, iy),
    c = th(ix, iy + 1),
    d = th(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

// Small deterministic hash -> 0..1.
function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class GroundCover {
  constructor({ site, terrain, geometry, material, quality, seed = 1 }) {
    this.site = site;
    this.terrain = terrain;
    this.seed = seed;
    this.exp = 1.25;
    this.tiles = new Map();
    this._configure(quality);
    const geo = geometry;
    this.geo = geo;
    // Room for the most clumps any setting asks for (so settings can change live).
    const most = 104000;
    this.aA = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aB = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iA', this.aA);
    geo.setAttribute('iB', this.aB);
    geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.name = 'vegetation:ground';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
    this.view = new ViewFilter();
    this.trigger = new RefillTrigger(2.5, 0.14);
    this.count = 0;
    this.first = true;
    this.tris = geo.index.count / 3;
  }

  _configure(quality) {
    this.density = Math.max(0.1, quality.grassDensity ?? 1);
    this.distance = Math.max(20, quality.grassDistance ?? 60);
    this.spacing = 1 / Math.sqrt(MAX_DENSITY * this.density);
    this.full = Math.min(14, this.distance * 0.2); // full density out to here
    this.cap = Math.round(52000 * Math.min(2, Math.max(0.5, this.density * (this.distance / 70) ** 1.2)));
    // Thinner settings grow fewer but wider tufts (not taller ones: cover from
    // grass is the same at every setting), so the ground stays covered.
    this.tuft = Math.min(1.5, Math.max(0.85, Math.pow(1 / this.density, 0.35)));
  }

  // New grass density or distance while playing: the tiles are made again. Returns
  // whether anything changed (then the material needs lodParams() again).
  setQuality(quality) {
    const d = Math.max(0.1, quality.grassDensity ?? 1),
      r = Math.max(20, quality.grassDistance ?? 60);
    if (d === this.density && r === this.distance) return false;
    this._configure(quality);
    this.tiles.clear();
    this.first = true;
    this.trigger.reset();
    return true;
  }

  lodParams() {
    return [this.full, this.exp, this.distance * 0.78, this.distance];
  }

  // Surface type near (x, z) as the terrain draws it, or -1 for none.
  _surface(x, z) {
    const site = this.site;
    const { cell, half, res } = site;
    const s = site.hf.surface;
    let wx = tvn(x * 0.31, z * 0.31) - 0.5,
      wz = tvn(x * 0.31 + 19.7, z * 0.31 + 19.7) - 0.5;
    wx += (tvn(x * 1.3 + 7.1, z * 1.3 + 7.1) - 0.5) * 0.35;
    wz += (tvn(x * 1.3 - 3.3, z * 1.3 - 3.3) - 0.5) * 0.35;
    const gx = (x + half) / cell + wx * 1.6,
      gz = (z + half) / cell + wz * 1.6;
    const ix = Math.max(0, Math.min(res - 2, Math.floor(gx))),
      iz = Math.max(0, Math.min(res - 2, Math.floor(gz)));
    const fx = gx - ix,
      fz = gz - iz;
    const i = iz * res + ix;
    // The corner with the biggest bilinear weight wins.
    const w00 = (1 - fx) * (1 - fz),
      w10 = fx * (1 - fz),
      w01 = (1 - fx) * fz,
      w11 = fx * fz;
    let best = s[i],
      bw = w00;
    if (w10 > bw) (bw = w10), (best = s[i + 1]);
    if (w01 > bw) (bw = w01), (best = s[i + res]);
    if (w11 > bw) best = s[i + res + 1];
    const edge = s[i] !== s[i + 1] || s[i] !== s[i + res] || s[i] !== s[i + res + 1];
    return { surf: best, edge };
  }

  _tile(tx, tz) {
    const key = tx * 100003 + tz;
    let t = this.tiles.get(key);
    if (t) return t;
    const site = this.site;
    const noise = this.terrain.noise;
    const x0 = tx * TILE - site.half,
      z0 = tz * TILE - site.half;
    const s = this.spacing;
    const n = Math.ceil(TILE / s);
    const tmp = [];
    let ymin = Infinity,
      ymax = -Infinity;
    // Grid cells whose 4 x 4 neighborhood is all one surface: no border wobble
    // can reach another surface there, so the lookup can skip it.
    const { res, cell, half } = site;
    const sf = site.hf.surface;
    const gx0 = Math.floor((x0 + half) / cell) - 1,
      gz0 = Math.floor((z0 + half) / cell) - 1;
    const gn = Math.ceil(TILE / cell) + 3;
    const uni = new Int16Array(gn * gn).fill(-1);
    for (let b = 0; b < gn; b++) {
      for (let a = 0; a < gn; a++) {
        const ix = gx0 + a,
          iz = gz0 + b;
        if (ix < 1 || iz < 1 || ix > res - 3 || iz > res - 3) continue;
        const v = sf[iz * res + ix];
        let same = true;
        for (let dz = -1; dz <= 2 && same; dz++) for (let dx = -1; dx <= 2; dx++) if (sf[(iz + dz) * res + ix + dx] !== v) { same = false; break; }
        if (same) uni[b * gn + a] = v;
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const h0 = hash(tx * 977 + i, tz * 991 + j, this.seed);
        const x = x0 + (i + hash(tx + i * 7, tz + j * 13, 11)) * s,
          z = z0 + (j + hash(tx + i * 5, tz + j * 3, 23)) * s;
        if (!site.inside(x, z, 2)) continue;
        const idx = site.index(x, z);
        const m = site.mask[idx];
        if (m & EX_BUILDING) continue;
        if (site.roadEdge[idx] < 0.35) continue;
        const ua = Math.floor((x + half) / cell) - gx0,
          ub = Math.floor((z + half) / cell) - gz0;
        const u = ua >= 0 && ub >= 0 && ua < gn && ub < gn ? uni[ub * gn + ua] : -1;
        const { surf, edge } = u >= 0 ? { surf: u, edge: false } : this._surface(x, z);
        let cov = COVER[surf];
        if (!cov || (cov.edge && !edge)) continue;
        if (surf === SURF.WHEAT && m & EX_FLAT) cov = COVER[SURF.GRASS];
        if (h0 * MAX_DENSITY > cov.d) continue;
        let pick = hash(i * 31 + tx, j * 17 + tz, 41);
        let type = cov.mix[cov.mix.length - 1][0];
        let mix = cov.mix;
        if (surf === SURF.WHEAT && edge) mix = [[GC.wheat, 0.78], [GC.poppies, 0.17], [GC.tall, 0.05]];
        if (surf === SURF.FOREST && noise.noise2(x / 9, z / 9) < 0.05) {
          if (h0 > 0.25) continue; // bare leaf litter between the bracken patches
          mix = [[GC.weeds, 0.7], [GC.tall, 0.3]];
        }
        // The firing range lanes are mown short.
        const mown = (m & EX_FLAT) !== 0;
        if (mown && surf !== SURF.WHEAT) mix = [[GC.grass, 0.92], [GC.dry, 0.08]];
        for (const [k, w] of mix) {
          if (pick < w) {
            type = k;
            break;
          }
          pick -= w;
        }
        const sz = SIZE[type];
        const a = hash(i, j, tx * 3 + tz * 7);
        const b = hash(j, i, tx * 5 + tz * 11);
        const w = (sz[0] + (sz[1] - sz[0]) * a) * (type === GC.wheat ? 1 : this.tuft);
        // Patchy heights: some meadow patches grow taller.
        const patch = 0.85 + 0.3 * (0.5 + 0.5 * noise.noise2(x / 23 + 7.7, z / 23 - 3.1));
        const h = (sz[2] + (sz[3] - sz[2]) * b) * (type === GC.wheat ? 1 : patch) * (mown ? 0.45 : 1) * (surf === SURF.DRY_GRASS && type === GC.grass ? 0.8 : 1);
        const y = site.hf.getHeight(x, z);
        const tint = Math.min(0.99, Math.max(0, 0.5 + 0.45 * noise.noise2(x / 17 - 4.1, z / 17 + 2.3) + (a - 0.5) * 0.25));
        tmp.push([x, y - 0.03, z, hash(i, j, 77) * Math.PI * 2, w, h, type + tint, hash(i * 13 + 1, j * 7 + 3, tx + tz)]);
        if (y < ymin) ymin = y;
        if (y + h > ymax) ymax = y + h;
      }
    }
    tmp.sort((p, q) => p[7] - q[7]);
    const data = new Float32Array(tmp.length * 8);
    tmp.forEach((p, k) => data.set(p, k * 8));
    t = { tx, tz, x0, z0, data, n: tmp.length, ymin: ymin - 0.2, ymax: ymax + 0.2 };
    this.tiles.set(key, t);
    return t;
  }

  // Keep the fraction k of a tile's plants (sorted by rank) -> how many.
  _count(t, k) {
    if (k >= 1) return t.n;
    let lo = 0,
      hi = t.n;
    const d = t.data;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (d[mid * 8 + 7] < k) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  update(camera, cam, lod, budgetMs = 4) {
    const site = this.site;
    const R = this.distance / lod + 4;
    const tx0 = Math.max(0, Math.floor((cam.x - R + site.half) / TILE)),
      tx1 = Math.min(Math.floor((2 * site.half) / TILE), Math.floor((cam.x + R + site.half) / TILE));
    const tz0 = Math.max(0, Math.floor((cam.z - R + site.half) / TILE)),
      tz1 = Math.min(Math.floor((2 * site.half) / TILE), Math.floor((cam.z + R + site.half) / TILE));
    // Make tiles nearest first, within a time budget (all at once the first time).
    // Distances are 3D: from high up (aerial views) nothing is needed.
    const dy = Math.max(0, cam.y - site.hf.getHeight(cam.x, cam.z) - 1.5);
    if (dy > R) {
      this.count = 0;
      this.geo.instanceCount = 0;
      this.mesh.visible = false;
      return;
    }
    const need = [];
    for (let tz = tz0; tz <= tz1; tz++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const cx = tx * TILE - site.half + TILE / 2,
          cz = tz * TILE - site.half + TILE / 2;
        const d = Math.hypot(Math.max(0, Math.hypot(cx - cam.x, cz - cam.z) - TILE * 0.71), dy);
        if (d > R) continue;
        need.push([d, tx, tz]);
      }
    }
    need.sort((a, b) => a[0] - b[0]);
    const t0 = performance.now();
    let made = false;
    for (const [, tx, tz] of need) {
      if (this.tiles.has(tx * 100003 + tz)) continue;
      if (!this.first && performance.now() - t0 > budgetMs) break;
      this._tile(tx, tz);
      made = true;
    }
    this.first = false;
    if (this.tiles.size > 900) {
      for (const [k, t] of this.tiles) {
        const cx = t.x0 + TILE / 2 - cam.x,
          cz = t.z0 + TILE / 2 - cam.z;
        if (cx * cx + cz * cz > (R + 120) ** 2) this.tiles.delete(k);
      }
    }
    if (!this.trigger.check(camera, cam, lod) && !made) return;
    this.view.update(camera, 0.25);
    const A = this.aA.array,
      B = this.aB.array;
    let c = 0;
    for (const [d, tx, tz] of need) {
      const t = this.tiles.get(tx * 100003 + tz);
      if (!t || !t.n) continue;
      if (d > 8 && !this.view.box(t.x0, t.ymin, t.z0, t.x0 + TILE, t.ymax, t.z0 + TILE)) continue;
      const de = Math.max(0, d - 2.5) * lod;
      const k = de < this.full ? 1 : Math.pow(this.full / de, this.exp);
      const m = Math.min(this._count(t, k * 1.05 + 0.01), this.cap - c);
      const src = t.data;
      for (let q = 0; q < m; q++) {
        const o = q * 8;
        A[c * 4] = src[o];
        A[c * 4 + 1] = src[o + 1];
        A[c * 4 + 2] = src[o + 2];
        A[c * 4 + 3] = src[o + 3];
        B[c * 4] = src[o + 4];
        B[c * 4 + 1] = src[o + 5];
        B[c * 4 + 2] = src[o + 6];
        B[c * 4 + 3] = src[o + 7];
        c++;
      }
      if (c >= this.cap) break;
    }
    this.count = c;
    this.geo.instanceCount = c;
    this.mesh.visible = c > 0;
    for (const a of [this.aA, this.aB]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, c * 4);
      a.needsUpdate = true;
    }
  }
}
