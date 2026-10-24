// Procedural landscape: rolling farmland, a river valley, a flattened village
// plateau, roads that follow the ground smoothly, forests, and a patchwork of fields.
// Everything is deterministic for a given map definition and seed.

import { Heightfield, SURF } from './heightfield.js';
import { Noise, RNG, clamp01, smoothstep, lerp, sampleSpline2 } from '../core/math.js';

// Stamp a "distance to polyline" field: for every grid cell within `radius` of any
// sample point we store the smallest distance and the index of the nearest point.
function distanceField(hf, samples, radius) {
  const r = hf.res;
  const dist = new Float32Array(r * r).fill(Infinity);
  const nearest = new Int32Array(r * r).fill(-1);
  const rc = Math.ceil(radius / hf.cell);
  for (let s = 0; s < samples.length; s++) {
    const [sx, sz] = samples[s];
    const gx = Math.round((sx + hf.half) / hf.cell);
    const gz = Math.round((sz + hf.half) / hf.cell);
    for (let dz = -rc; dz <= rc; dz++) {
      const iz = gz + dz;
      if (iz < 0 || iz >= r) continue;
      const wz = iz * hf.cell - hf.half;
      for (let dx = -rc; dx <= rc; dx++) {
        const ix = gx + dx;
        if (ix < 0 || ix >= r) continue;
        const wx = ix * hf.cell - hf.half;
        const d = Math.hypot(wx - sx, wz - sz);
        const i = iz * r + ix;
        if (d < dist[i]) {
          dist[i] = d;
          nearest[i] = s;
        }
      }
    }
  }
  return { dist, nearest };
}

// Moving average along a polyline's height profile so roads don't follow every bump.
function smoothProfile(values, window) {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let s = 0,
      n = 0;
    for (let k = -window; k <= window; k++) {
      const j = i + k;
      if (j < 0 || j >= values.length) continue;
      const w = 1 - Math.abs(k) / (window + 1);
      s += values[j] * w;
      n += w;
    }
    out[i] = s / n;
  }
  return out;
}

export function generateTerrain(def) {
  const t0 = performance.now();
  const hf = new Heightfield(def.size, def.res);
  const noise = new Noise(def.seed);
  const noise2 = new Noise(def.seed * 7 + 3);
  const rng = new RNG(def.seed);
  const r = hf.res;
  const H = hf.heights;
  const vil = def.village;

  // 1) Base relief -----------------------------------------------------------
  for (let iz = 0; iz < r; iz++) {
    const z = iz * hf.cell - hf.half;
    for (let ix = 0; ix < r; ix++) {
      const x = ix * hf.cell - hf.half;
      let h = def.baseAltitude;
      h += def.hills * noise.fbm2(x / 1100 + 3.3, z / 1100 - 1.7, 4);
      h += def.undulation * noise.fbm2(x / 320 + 13.1, z / 320 - 7.7, 4);
      h += 1.1 * noise2.fbm2(x / 70, z / 70, 3);
      h += 0.22 * noise2.fbm2(x / 12.5, z / 12.5, 2);
      // Deliberate features (ridges, hills) from the map definition.
      for (const f of def.features || []) {
        const d = Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz);
        if (d < 1) {
          const k = 0.5 + 0.5 * Math.cos(Math.PI * d);
          h += f.height * k * (0.85 + 0.15 * noise.noise2(x / 60, z / 60));
        }
      }
      // Hills rise toward the map edge to frame the battlefield.
      const edge = Math.max(Math.abs(x), Math.abs(z));
      const e = smoothstep(def.playRadius, hf.half - 20, edge);
      if (e > 0) h += e * (def.edgeHills * (0.55 + 0.45 * noise.ridged2(x / 420, z / 420, 4)));
      H[iz * r + ix] = h;
    }
  }

  // 2) Village plateau ---------------------------------------------------------
  let villageH = 0;
  {
    let s = 0,
      n = 0;
    for (let a = 0; a < 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      for (const rr of [0, vil.radius * 0.5, vil.radius]) {
        s += hf.getHeight(vil.x + Math.cos(ang) * rr, vil.z + Math.sin(ang) * rr);
        n++;
      }
    }
    villageH = s / n;
  }
  for (let iz = 0; iz < r; iz++) {
    const z = iz * hf.cell - hf.half;
    for (let ix = 0; ix < r; ix++) {
      const x = ix * hf.cell - hf.half;
      const d = Math.hypot(x - vil.x, z - vil.z);
      const w = 1 - smoothstep(vil.radius, vil.radius + vil.falloff, d);
      if (w <= 0) continue;
      const i = iz * r + ix;
      const target = villageH + 0.6 * noise2.fbm2(x / 90, z / 90, 2) + vil.tilt * ((x - vil.x) / vil.radius);
      H[i] = lerp(H[i], target, w * 0.92);
    }
  }

  // 2b) Flat zones (firing ranges, airfields): blend to a level height.
  for (const fz of def.flatZones || []) {
    const level = fz.h ?? hf.getHeight((fz.x0 + fz.x1) / 2, (fz.z0 + fz.z1) / 2);
    const fall = fz.falloff ?? 30;
    for (let iz = 0; iz < r; iz++) {
      const z = iz * hf.cell - hf.half;
      const dz = Math.max(fz.z0 - z, 0, z - fz.z1);
      if (dz > fall) continue;
      for (let ix = 0; ix < r; ix++) {
        const x = ix * hf.cell - hf.half;
        const dx = Math.max(fz.x0 - x, 0, x - fz.x1);
        const d = Math.hypot(dx, dz);
        if (d > fall) continue;
        const w = 1 - smoothstep(0, fall, d);
        const i = iz * r + ix;
        H[i] = lerp(H[i], level + 0.15 * noise2.fbm2(x / 20, z / 20, 2), w);
      }
    }
  }

  // 3) River valley ------------------------------------------------------------
  let river = null;
  if (def.river) {
    const samples = sampleSpline2(def.river.points, 2);
    const half = def.river.width / 2;
    const valley = def.river.valley;
    const df = distanceField(hf, samples, half + valley + 4);
    // Water level along the river: a little below its banks all the way (a
    // lowland river in a gentle valley, not a gorge cut down to the lowest
    // point on its course). It never stands above the lowest ground across the
    // valley a little way out, and where the ground climbs steeply it rises no
    // faster than a gentle slope, cutting a deeper valley instead.
    const ground = samples.map(([x, z]) => hf.getHeight(x, z));
    const smooth = smoothProfile(ground, 40);
    const hi = samples.map(([x, z], i) => {
      const [ax, az] = samples[Math.max(0, i - 1)],
        [bx, bz] = samples[Math.min(samples.length - 1, i + 1)];
      const l = Math.hypot(bx - ax, bz - az) || 1;
      const px = -(bz - az) / l,
        pz = (bx - ax) / l;
      let m = Infinity;
      for (const o of [half + 2, half + 6, half + 12]) for (const sd of [-1, 1]) m = Math.min(m, hf.getHeight(x + px * o * sd, z + pz * o * sd));
      return Math.min(smooth[i] - def.river.sink, m - 0.6);
    });
    const maxRise = 0.035 * 2; // per 2 m sample (3.5%)
    const rise = (v) => {
      for (let i = 1; i < v.length; i++) v[i] = Math.min(v[i], v[i - 1] + maxRise);
      return v;
    };
    const level = rise(smoothProfile(rise(Float32Array.from(hi)), 12).map((v, i) => Math.min(v, hi[i])));
    for (let i = 0; i < r * r; i++) {
      const d = df.dist[i];
      if (d === Infinity) continue;
      const wl = level[df.nearest[i]];
      let target;
      if (d < half) {
        const k = d / half;
        target = wl - def.river.depth * (1 - k * k);
      } else {
        // Banks: from just above the water out to the natural ground.
        const k = smoothstep(half, half + valley, d);
        target = lerp(wl + 0.35, H[i], k * k * (3 - 2 * k));
      }
      if (d < half + valley) H[i] = Math.min(H[i], target);
    }
    river = { samples, level, half, distField: df };
  }

  // 4) Roads -------------------------------------------------------------------
  const roads = [];
  for (const rd of def.roads) {
    const samples = sampleSpline2(rd.points, 2);
    const ground = samples.map(([x, z]) => hf.getHeight(x, z));
    let prof = smoothProfile(ground, 10);
    // Bridges keep their deck height above the river.
    const half = rd.width / 2;
    const df = distanceField(hf, samples, half + 8);
    for (let i = 0; i < r * r; i++) {
      const d = df.dist[i];
      if (d === Infinity) continue;
      const rh = prof[df.nearest[i]] - 0.08;
      const w = 1 - smoothstep(half + 0.5, half + 7, d);
      if (river && river.distField.dist[i] < river.half + 3) continue; // don't fill the river bed
      H[i] = lerp(H[i], rh, w);
      if (d < half + 0.6) hf.surface[i] = SURF.ROAD;
    }
    roads.push({ ...rd, samples, heights: prof, distField: df });
  }

  // 5) Craters from earlier shelling ---------------------------------------------
  const craters = [];
  for (const zone of def.craterZones || []) {
    for (let k = 0; k < zone.count; k++) {
      const a = rng.next() * Math.PI * 2;
      const rr = Math.sqrt(rng.next()) * zone.r;
      const cx = zone.x + Math.cos(a) * rr;
      const cz = zone.z + Math.sin(a) * rr;
      const size = rng.range(zone.min, zone.max);
      craters.push({ x: cx, z: cz, r: size });
      stampCrater(hf, cx, cz, size);
    }
  }

  hf.computeRange();

  // 6) Fields (Voronoi patchwork) and forests -------------------------------------
  const fieldSpacing = def.fieldSize;
  const seeds = [];
  const gridN = Math.ceil(def.size / fieldSpacing) + 2;
  for (let gz = 0; gz < gridN; gz++) {
    for (let gx = 0; gx < gridN; gx++) {
      const sx = (gx - 1) * fieldSpacing - hf.half + rng.range(0.15, 0.85) * fieldSpacing;
      const sz = (gz - 1) * fieldSpacing - hf.half + rng.range(0.15, 0.85) * fieldSpacing;
      const roll = rng.next();
      let kind = 'meadow';
      if (roll < 0.16) kind = 'plowed';
      else if (roll < 0.36) kind = 'wheat';
      else if (roll < 0.58) kind = 'pasture';
      seeds.push({ x: sx, z: sz, kind, hedge: rng.next() < def.hedgeChance, id: seeds.length });
    }
  }
  const cellOf = (x, z) => {
    const gx = Math.floor((x + hf.half) / fieldSpacing) + 1;
    const gz = Math.floor((z + hf.half) / fieldSpacing) + 1;
    let best = Infinity,
      second = Infinity,
      bi = -1,
      si = -1;
    for (let oz = -1; oz <= 1; oz++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = gx + ox,
          cz = gz + oz;
        if (cx < 0 || cz < 0 || cx >= gridN || cz >= gridN) continue;
        const s = seeds[cz * gridN + cx];
        const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
        if (d < best) {
          second = best;
          si = bi;
          best = d;
          bi = cz * gridN + cx;
        } else if (d < second) {
          second = d;
          si = cz * gridN + cx;
        }
      }
    }
    // Distance to the boundary between the two nearest seeds (exact for Voronoi).
    const a = seeds[bi],
      b = seeds[si];
    const mx = (a.x + b.x) / 2,
      mz = (a.z + b.z) / 2;
    let nx = b.x - a.x,
      nz = b.z - a.z;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    const edgeDist = Math.abs((x - mx) * nx + (z - mz) * nz);
    return { cell: a, other: b, edgeDist };
  };

  const forestAt = (x, z) => {
    let f = noise.fbm2(x / 420 + 40, z / 420 - 20, 4) * 0.9 + 0.1 * noise2.noise2(x / 60, z / 60);
    for (const fz of def.forests || []) {
      const d = Math.hypot(x - fz.x, z - fz.z) / fz.r;
      f += fz.strength * (1 - smoothstep(0.6, 1.0, d));
    }
    const dv = Math.hypot(x - vil.x, z - vil.z);
    f -= 0.9 * (1 - smoothstep(vil.radius + 40, vil.radius + 160, dv));
    return f - def.forestThreshold;
  };

  const forest = new Float32Array(r * r);
  const fieldKind = new Uint8Array(r * r);
  const hedgeMask = new Uint8Array(r * r);
  const kinds = { meadow: 0, plowed: 1, wheat: 2, pasture: 3 };
  const nrm = { x: 0, y: 1, z: 0 };

  for (let iz = 0; iz < r; iz++) {
    const z = iz * hf.cell - hf.half;
    for (let ix = 0; ix < r; ix++) {
      const x = ix * hf.cell - hf.half;
      const i = iz * r + ix;
      const fval = forestAt(x, z);
      forest[i] = fval;
      const c = cellOf(x, z);
      fieldKind[i] = kinds[c.cell.kind];
      const dv = Math.hypot(x - vil.x, z - vil.z);
      if (c.edgeDist < 1.6 && (c.cell.hedge || c.other.hedge) && dv > vil.radius + 15 && fval < 0) hedgeMask[i] = 1;

      if (hf.surface[i] === SURF.ROAD) continue;
      hf.getNormal(x, z, nrm);
      const slope = Math.acos(Math.min(1, nrm.y));
      let s;
      if (river && river.distField.dist[i] < river.half - 0.3) s = SURF.WATER;
      else if (river && river.distField.dist[i] < river.half + 2.5) s = noise2.noise2(x / 6, z / 6) > 0 ? SURF.MUD : SURF.SAND;
      else if (slope > 0.62) s = SURF.ROCK;
      else if (slope > 0.42) s = SURF.DIRT;
      else if (fval > 0) s = SURF.FOREST;
      else if (dv < vil.radius + 10) {
        // Village: grass with some trampled, bare patches.
        s = noise2.fbm2(x / 14, z / 14, 2) > 0.5 ? SURF.DIRT : SURF.GRASS;
      } else {
        const k = c.cell.kind;
        if (c.edgeDist < 2.5) s = SURF.GRASS; // grassy field margins
        else if (k === 'plowed') s = SURF.FIELD;
        else if (k === 'wheat') s = SURF.WHEAT;
        else if (k === 'pasture') s = noise2.fbm2(x / 30, z / 30, 2) > 0.1 ? SURF.DRY_GRASS : SURF.GRASS;
        else s = noise2.fbm2(x / 45, z / 45, 3) > 0.25 ? SURF.DRY_GRASS : SURF.GRASS;
        // A few muddy spots (summer: most of the countryside is dry).
        if (noise.fbm2(x / 35 + 100, z / 35, 3) > 0.66) s = SURF.MUD;
      }
      hf.surface[i] = s;
    }
  }
  for (const c of craters) {
    const rc = c.r * 1.1;
    for (let dz = -rc; dz <= rc; dz += hf.cell) for (let dx = -rc; dx <= rc; dx += hf.cell) {
      if (dx * dx + dz * dz < rc * rc) {
        const s = hf.getSurface(c.x + dx, c.z + dz);
        if (s !== SURF.ROAD && s !== SURF.WATER) hf.setSurfaceAt(c.x + dx, c.z + dz, dx * dx + dz * dz < c.r * c.r * 0.4 ? SURF.MUD : SURF.DIRT);
      }
    }
  }

  console.log(`terrain generated in ${(performance.now() - t0).toFixed(0)} ms`);
  return {
    hf,
    villageHeight: villageH,
    river,
    roads,
    craters,
    forest,
    fieldKind,
    hedgeMask,
    cellOf,
    forestAt,
    noise,
  };
}

// A shell crater: a bowl with a raised lip of thrown-out earth.
export function stampCrater(hf, cx, cz, radius, depthScale = 1) {
  const r = hf.res;
  const depth = radius * 0.32 * depthScale;
  const lip = radius * 0.12 * depthScale;
  const ext = radius * 1.8;
  const [gx0, gz0] = hf.toGrid(cx - ext, cz - ext);
  const [gx1, gz1] = hf.toGrid(cx + ext, cz + ext);
  for (let iz = Math.max(0, Math.floor(gz0)); iz <= Math.min(r - 1, Math.ceil(gz1)); iz++) {
    for (let ix = Math.max(0, Math.floor(gx0)); ix <= Math.min(r - 1, Math.ceil(gx1)); ix++) {
      const x = hf.worldX(ix),
        z = hf.worldZ(iz);
      const d = Math.hypot(x - cx, z - cz) / radius;
      let dh = 0;
      if (d < 1) dh = -depth * (1 - d * d) + lip * d * d * d * d;
      else if (d < 1.8) {
        const k = (d - 1) / 0.8;
        dh = lip * (1 - k) * (1 - k);
      }
      hf.heights[iz * r + ix] += dh;
    }
  }
}

export { clamp01 };
