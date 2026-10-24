// Where every tree and bush goes. Deterministic for a map (seeded from def.seed).
//   forests      dense woods in the terrain's forest areas (trunks ~4-8 m apart in the
//                core, thinning toward the edge), conifer stands in the big woods,
//                hazel, hawthorn and bramble in the undergrowth and along the edges
//   orchards     tall-stem cider apple trees in rows behind and beside the farms
//   poplars      Lombardy poplars in rows along stretches of road
//   riverbank    ash and oak with bushes along the river
//   fields       lone oaks in the pastures and small copses
//   village      bushes around the outside of the gardens
// Hedgerow trees and bushes are added by hedges.js.
import { RNG, clamp, smoothstep, lerp } from '../../core/math.js';
import { SURF } from '../heightfield.js';
import { variantOf } from './species.js';
import { EX_BUILDING, EX_PLOT, EX_POINT, EX_FLAT, EX_VILLAGE } from './site.js';

export const ROLE = { forest: 0, edge: 1, hedge: 2, field: 3, orchard: 4, roadside: 5, river: 6, village: 7, under: 8 };

const BUSHES = ['hazel', 'hawthorn', 'bramble'];

export class PlantList {
  constructor(half) {
    this.n = 0;
    this.cap = 0;
    this.half = half;
    this.hc = 4;
    this.hn = Math.ceil((2 * half) / this.hc) + 1;
    this.head = new Int32Array(this.hn * this.hn).fill(-1);
    this._grow(8192);
  }

  _grow(cap) {
    const f = (A, old) => {
      const a = new A(cap);
      if (old) a.set(old);
      return a;
    };
    for (const k of ['x', 'y', 'z', 'yaw', 's', 'sw', 'sy', 'lx', 'lz']) this[k] = f(Float32Array, this[k]);
    for (const k of ['variant', 'role']) this[k] = f(Uint8Array, this[k]);
    this.nextIdx = f(Int32Array, this.nextIdx);
    this.cap = cap;
  }

  _cell(x, z) {
    const cx = Math.max(0, Math.min(this.hn - 1, Math.floor((x + this.half) / this.hc)));
    const cz = Math.max(0, Math.min(this.hn - 1, Math.floor((z + this.half) / this.hc)));
    return cz * this.hn + cx;
  }

  add(variant, role, x, y, z, yaw, s, sw = 1, sy = 1, lx = 0, lz = 0) {
    if (this.n >= this.cap) this._grow(this.cap * 2);
    const i = this.n++;
    this.variant[i] = variant;
    this.role[i] = role;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
    this.yaw[i] = yaw;
    this.s[i] = s;
    this.sw[i] = sw;
    this.sy[i] = sy;
    this.lx[i] = lx;
    this.lz[i] = lz;
    const c = this._cell(x, z);
    this.nextIdx[i] = this.head[c];
    this.head[c] = i;
    return i;
  }

  // Is any plant (or any tree, with treesOnly) within r of (x, z)?
  near(x, z, r, treesOnly = false) {
    const k = Math.ceil(r / this.hc);
    const cx = Math.floor((x + this.half) / this.hc),
      cz = Math.floor((z + this.half) / this.hc);
    for (let dz = -k; dz <= k; dz++) {
      const gz = cz + dz;
      if (gz < 0 || gz >= this.hn) continue;
      for (let dx = -k; dx <= k; dx++) {
        const gx = cx + dx;
        if (gx < 0 || gx >= this.hn) continue;
        for (let i = this.head[gz * this.hn + gx]; i >= 0; i = this.nextIdx[i]) {
          if (treesOnly && this.variant[i] >= BUSH0) continue;
          if ((this.x[i] - x) ** 2 + (this.z[i] - z) ** 2 < r * r) return true;
        }
      }
    }
    return false;
  }
}

const BUSH0 = variantOf('hazel', 0);
export const isBush = (variant) => variant >= BUSH0;

const tree = (sp, r) => variantOf(sp, r.int(0, 2));
// Bush shape from the position (keeps the random sequence of the placement).
const bush = (sp, x, z) => variantOf(sp, (Math.floor(x * 7.3) ^ Math.floor(z * 5.1)) & 1);

function pick(r, table) {
  let t = r.next(),
    acc = 0;
  for (const [k, w] of table) {
    acc += w;
    if (t < acc) return k;
  }
  return table[table.length - 1][0];
}

function addBush(P, site, r, x, z, role, scale = 1) {
  const sp = pick(r, role === ROLE.under ? [['hazel', 0.55], ['hawthorn', 0.2], ['bramble', 0.25]] : [['hawthorn', 0.4], ['hazel', 0.3], ['bramble', 0.3]]);
  const s = r.range(0.75, 1.2) * scale;
  P.add(bush(sp, x, z), role, x, site.height(x, z), z, r.next() * Math.PI * 2, s, r.range(0.85, 1.2), r.range(0.8, 1.15));
}

// ---------------------------------------------------------------------------------------

export function placeForests(site, terrain, P, r) {
  const half = site.half;
  const g = 4;
  const noise = terrain.noise;
  const n = Math.floor((2 * half) / g);
  const okTree = { road: 4, river: 6 };
  const okBush = { road: 2, river: 3 };
  for (let gz = 1; gz < n - 1; gz++) {
    for (let gx = 1; gx < n - 1; gx++) {
      const x = -half + (gx + r.next()) * g,
        z = -half + (gz + r.next()) * g;
      const f = site.forest(x, z);
      if (f < -0.05) {
        r.next();
        continue;
      }
      if (f < 0) {
        // The scrubby margin: bushes and brambles, and a young tree now and then.
        if (r.chance(0.2) && site.canPlant(x, z, okBush) && !P.near(x, z, 2.2)) addBush(P, site, r, x, z, ROLE.edge, 1.05);
        continue;
      }
      const core = smoothstep(0.0, 0.2, f);
      if (!r.chance(0.15 + 0.28 * core)) {
        // Undergrowth between the trunks.
        if (r.chance(0.03 + 0.1 * (1 - core)) && site.canPlant(x, z, okBush) && !P.near(x, z, 2.5)) addBush(P, site, r, x, z, ROLE.under, 0.9);
        continue;
      }
      if (!site.canPlant(x, z, okTree) || P.near(x, z, 3.4, true)) continue;
      // Species: conifer stands in patches of the big woods, broadleaf elsewhere
      // (beech-dominated patches, oak and ash, more oak and ash at the edges).
      const con = noise.fbm2(x / 230 + 51.7, z / 230 - 13.3, 3);
      const beechy = noise.fbm2(x / 160 - 7.1, z / 160 + 3.3, 2);
      let sp;
      if (con > 0.26 && core > 0.4) sp = r.chance(0.66) ? 'spruce' : 'pine';
      else if (con > 0.16 && r.chance(0.4)) sp = r.chance(0.5) ? 'spruce' : 'pine';
      else if (core < 0.45) sp = pick(r, [['oak', 0.5], ['ash', 0.35], ['beech', 0.15]]);
      else if (beechy > 0.15) sp = pick(r, [['beech', 0.6], ['oak', 0.25], ['ash', 0.15]]);
      else sp = pick(r, [['oak', 0.5], ['beech', 0.25], ['ash', 0.25]]);
      // Edge trees lean out toward the light.
      let lx = r.range(-0.025, 0.025),
        lz = r.range(-0.025, 0.025);
      if (core < 0.5) {
        const gx2 = site.forest(x + 3, z) - site.forest(x - 3, z),
          gz2 = site.forest(x, z + 3) - site.forest(x, z - 3);
        const gl = Math.hypot(gx2, gz2) || 1;
        lx -= (gx2 / gl) * 0.06 * (1 - core);
        lz -= (gz2 / gl) * 0.06 * (1 - core);
      }
      const s = (core < 0.5 ? r.range(0.68, 1.0) : r.range(0.84, 1.14)) * (sp === 'pine' || sp === 'spruce' ? 1 : 0.95 + 0.1 * core);
      P.add(tree(sp, r), core < 0.5 ? ROLE.edge : ROLE.forest, x, site.height(x, z), z, r.next() * Math.PI * 2, s, r.range(0.9, 1.1), r.range(0.92, 1.08), lx, lz);
    }
  }
}

// Orchards of tall-stem apple trees behind and beside each farm.
export function placeOrchards(site, plan, P, r, landmarks) {
  for (const farm of plan?.farms || []) {
    const c = Math.cos(farm.yaw),
      s = Math.sin(farm.yaw);
    const L = (lx, lz) => [farm.x + c * lx + s * lz, farm.z - s * lx + c * lz];
    const spots = [{ lx: r.range(-6, 6), lz: -(farm.d / 2 + 6 + 20), w: 46, d: 38 }];
    if (r.chance(0.6)) {
      const side = r.chance(0.5) ? 1 : -1;
      spots.push({ lx: side * (farm.w / 2 + 6 + 18), lz: r.range(-6, 2), w: 34, d: 40 });
    }
    for (const o of spots) {
      const sp = 8.5;
      let count = 0;
      const nx = Math.floor(o.w / sp),
        nz = Math.floor(o.d / sp);
      for (let i = 0; i <= nx; i++) {
        for (let j = 0; j <= nz; j++) {
          if (r.chance(0.1)) continue;
          const ax = o.lx - o.w / 2 + i * sp + r.range(-0.7, 0.7);
          const az = o.lz - o.d / 2 + j * sp + r.range(-0.7, 0.7);
          const [x, z] = L(ax, az);
          if (!site.canPlant(x, z, { road: 3, river: 10 }) || site.forest(x, z) > -0.02) continue;
          if (P.near(x, z, 5)) continue;
          P.add(tree('apple', r), ROLE.orchard, x, site.height(x, z), z, r.next() * Math.PI * 2, r.range(0.82, 1.1), r.range(0.92, 1.12), r.range(0.9, 1.05), r.range(-0.04, 0.04), r.range(-0.04, 0.04));
          count++;
        }
      }
      if (count) {
        const [x, z] = L(o.lx, o.lz);
        landmarks.orchards.push({ x, z, yaw: farm.yaw, w: o.w, d: o.d, trees: count });
      }
    }
  }
}

// Rows of Lombardy poplars along some stretches of road, outside the village.
export function placePoplars(site, terrain, def, P, r, landmarks) {
  const vil = def.village;
  for (const road of terrain.roads) {
    const s = road.samples;
    if (s.length < 20) continue;
    const arc = [0];
    for (let i = 1; i < s.length; i++) arc.push(arc[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
    const total = arc[arc.length - 1];
    const stretches = total > 1200 ? 2 : total > 500 ? 1 : 0;
    const at = (L) => {
      let i = 1;
      while (i < s.length - 1 && arc[i] < L) i++;
      const t = (L - arc[i - 1]) / (arc[i] - arc[i - 1] || 1);
      const a = s[Math.max(0, i - 2)],
        b = s[Math.min(s.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return { x: s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, z: s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l };
    };
    for (let k = 0; k < stretches; k++) {
      // Try a few starting points; keep the first that is well clear of the village.
      for (let attempt = 0; attempt < 8; attempt++) {
        const len = r.range(170, 360);
        const L0 = r.range(30, Math.max(31, total - len - 30));
        const mid = at(L0 + len / 2);
        if (vil && Math.hypot(mid.x - vil.x, mid.z - vil.z) < vil.radius + 90) continue;
        if (site.forest(mid.x, mid.z) > -0.05) continue;
        const sides = r.chance(0.7) ? [1, -1] : [r.chance(0.5) ? 1 : -1];
        const off = road.width / 2 + 3.3;
        const spacing = r.range(8, 9.5);
        let placed = 0;
        let first = null,
          last = null;
        for (const side of sides) {
          for (let L = L0; L < L0 + len; L += spacing) {
            const p = at(L);
            const x = p.x - p.tz * off * side + r.range(-0.3, 0.3),
              z = p.z + p.tx * off * side + r.range(-0.3, 0.3);
            if (!site.canPlant(x, z, { road: 2.2, river: 22 }) || site.forest(x, z) > -0.05 || P.near(x, z, 4)) continue;
            P.add(tree('poplar', r), ROLE.roadside, x, site.height(x, z), z, r.next() * Math.PI * 2, r.range(0.9, 1.08), r.range(0.92, 1.08), 1, r.range(-0.015, 0.015), r.range(-0.015, 0.015));
            placed++;
            first ??= [x, z];
            last = [x, z];
          }
        }
        if (placed) landmarks.poplars.push({ road: road.id, from: first, to: last, trees: placed });
        break;
      }
    }
  }
}

export function placeRiverbank(site, terrain, P, r) {
  const river = terrain.river;
  if (!river) return;
  const s = river.samples;
  for (let i = 2; i < s.length - 2; i += 3) {
    const a = s[i - 2],
      b = s[i + 2];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l,
      nz = (b[0] - a[0]) / l;
    for (const side of [1, -1]) {
      if (!r.chance(0.32)) continue;
      const off = river.half + r.range(3.5, 11);
      const x = s[i][0] + nx * off * side + r.range(-1, 1),
        z = s[i][1] + nz * off * side + r.range(-1, 1);
      const isTree = r.chance(0.32);
      if (!site.canPlant(x, z, { road: isTree ? 4 : 2, river: isTree ? 5 : 2.5 }) || site.aboveWater(x, z) < 0.6) continue;
      if (P.near(x, z, isTree ? 5 : 2.5)) continue;
      if (isTree) {
        const sp = pick(r, [['ash', 0.55], ['oak', 0.25], ['poplar', 0.2]]);
        P.add(tree(sp, r), ROLE.river, x, site.height(x, z), z, r.next() * Math.PI * 2, r.range(0.7, 1.0), r.range(0.95, 1.15), r.range(0.9, 1.05), r.range(-0.05, 0.05), r.range(-0.05, 0.05));
      } else addBush(P, site, r, x, z, ROLE.river, 1.1);
    }
  }
}

// Lone trees in the pastures and meadows, and small copses.
export function placeFields(site, terrain, def, P, r, landmarks) {
  const half = site.half;
  const fieldOK = (x, z, roadM = 7) => {
    const sf = site.surface(x, z);
    if (sf !== SURF.GRASS && sf !== SURF.DRY_GRASS && sf !== SURF.WHEAT && sf !== SURF.FIELD) return false;
    if (site.flags(x, z) & EX_VILLAGE) return false;
    return site.canPlant(x, z, { road: roadM, river: 10 }) && site.forest(x, z) < -0.12;
  };
  const area = (2 * half) * (2 * half);
  const lone = Math.round(area / 22000);
  for (let k = 0; k < lone; k++) {
    const x = r.range(-half + 30, half - 30),
      z = r.range(-half + 30, half - 30);
    if (!fieldOK(x, z) || P.near(x, z, 14)) continue;
    const sf = site.surface(x, z);
    if (sf === SURF.WHEAT || sf === SURF.FIELD) continue; // not in the middle of a crop
    const sp = pick(r, [['oak', 0.65], ['ash', 0.2], ['beech', 0.15]]);
    P.add(tree(sp, r), ROLE.field, x, site.height(x, z), z, r.next() * Math.PI * 2, r.range(0.85, 1.18), r.range(1.08, 1.25), r.range(0.9, 1.0), r.range(-0.03, 0.03), r.range(-0.03, 0.03));
  }
  const copses = Math.round(area / 260000);
  for (let k = 0; k < copses; k++) {
    const cx = r.range(-half + 80, half - 80),
      cz = r.range(-half + 80, half - 80);
    if (!fieldOK(cx, cz, 15) || P.near(cx, cz, 25)) continue;
    const rad = r.range(12, 26);
    const n = Math.round((Math.PI * rad * rad) / 55);
    const mix = r.chance(0.2) ? [['pine', 0.6], ['oak', 0.4]] : [['oak', 0.45], ['ash', 0.3], ['beech', 0.25]];
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i++) {
      const a = r.next() * Math.PI * 2,
        d = Math.sqrt(r.next()) * rad;
      const x = cx + Math.cos(a) * d,
        z = cz + Math.sin(a) * d;
      if (!site.canPlant(x, z, { road: 5, river: 8 }) || P.near(x, z, 4)) continue;
      const edge = d / rad;
      P.add(tree(pick(r, mix), r), ROLE.edge, x, site.height(x, z), z, r.next() * Math.PI * 2, lerp(r.range(0.85, 1.1), r.range(0.65, 0.9), edge), r.range(0.95, 1.15), r.range(0.9, 1.05), r.range(-0.04, 0.04), r.range(-0.04, 0.04));
      placed++;
    }
    // A ring of bushes around the copse.
    for (let i = 0; i < n; i++) {
      const a = r.next() * Math.PI * 2,
        d = rad * r.range(0.85, 1.2);
      const x = cx + Math.cos(a) * d,
        z = cz + Math.sin(a) * d;
      if (site.canPlant(x, z, { road: 3, river: 3 }) && !P.near(x, z, 2.5)) addBush(P, site, r, x, z, ROLE.edge);
    }
    if (placed) landmarks.copses.push({ x: cx, z: cz, r: rad, trees: placed });
  }
}

// Bushes along the outside of the village gardens.
export function placeVillageBushes(site, plan, P, r) {
  const rects = plan?.site?.rects || [];
  const inside = (x, z) =>
    rects.some((q) => {
      const c = Math.cos(q.yaw),
        s = Math.sin(q.yaw);
      const dx = x - q.cx,
        dz = z - q.cz;
      return Math.abs(c * dx - s * dz) <= q.hx + 0.6 && Math.abs(s * dx + c * dz) <= q.hz + 0.6;
    });
  for (const g of rects) {
    if (g.tag !== 'garden') continue;
    const c = Math.cos(g.yaw),
      s = Math.sin(g.yaw);
    const per = 2 * (g.hx + g.hz) * 2;
    const n = Math.round(per / 3.5);
    for (let k = 0; k < n; k++) {
      if (!r.chance(0.22)) continue;
      // A point on the outline, pushed outward.
      const t = r.next() * 4;
      const side = Math.floor(t),
        f = t - side;
      const off = r.range(1.6, 2.6);
      let lx, lz;
      if (side === 0) [lx, lz] = [lerp(-g.hx, g.hx, f), -g.hz - off];
      else if (side === 1) [lx, lz] = [g.hx + off, lerp(-g.hz, g.hz, f)];
      else if (side === 2) [lx, lz] = [lerp(-g.hx, g.hx, f), g.hz + off];
      else [lx, lz] = [-g.hx - off, lerp(-g.hz, g.hz, f)];
      const x = g.cx + c * lx + s * lz,
        z = g.cz - s * lx + c * lz;
      if (inside(x, z) || !site.canPlant(x, z, { road: 2, river: 3, mask: EX_BUILDING | EX_POINT | EX_FLAT })) continue;
      if (P.near(x, z, 2.5)) continue;
      addBush(P, site, r, x, z, ROLE.village, 0.9);
    }
  }
}

export { addBush, pick, tree, bush, BUSHES, clamp, EX_PLOT };
