// Bocage: hedgerows on earth banks. The fields are the Voronoi cells of terrainGen
// (a seed per field, read back through terrain.cellOf); a boundary gets a hedge when
// either field has one (the same rule as terrain.hedgeMask), except in woods, the
// village, on roads, near the river and the capture points. Stretches of road get
// hedges on one or both sides too (the sunken lanes of Normandy). Every longer hedge
// has a gap (a field gate) so fields stay reachable; hedges end short of roads.
import { RNG, lerp } from '../../core/math.js';
import { SURF } from '../heightfield.js';
import { EX_BUILDING, EX_PLOT, EX_POINT, EX_FLAT, EX_VILLAGE } from './site.js';
import { ROLE, tree, pick, addBush } from './placement.js';
import { HEDGE } from './treeGeometry.js';

const BLOCK = EX_BUILDING | EX_PLOT | EX_POINT | EX_FLAT | EX_VILLAGE;

function hedgeOK(site, x, z, roadMin = 2.6) {
  if (!site.inside(x, z, 12)) return false;
  const i = site.index(x, z);
  if (site.mask[i] & BLOCK) return false;
  if (site.roadEdge[i] < roadMin) return false;
  const s = site.hf.surface[i];
  if (s === SURF.ROAD || s === SURF.WATER || s === SURF.COBBLE || s === SURF.SAND || s === SURF.ROCK) return false;
  if (site.forest(x, z) > -0.02) return false;
  if (site.river) {
    const d = site.river.distField.dist[i];
    if (d < site.river.half + 5) return false;
    if (d < site.river.half + 30 && site.aboveWater(x, z) < 0.7) return false;
  }
  return site.slope(x, z) < 0.7;
}

// Clip a convex polygon (vertices [x, z, tag of the edge that starts here]) to the
// half of the plane closer to seed a than to seed b.
function clip(poly, a, b) {
  const nx = b.x - a.x,
    nz = b.z - a.z;
  const mx = (a.x + b.x) / 2,
    mz = (a.z + b.z) / 2;
  const f = (p) => (p[0] - mx) * nx + (p[1] - mz) * nz;
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const P = poly[k],
      Q = poly[(k + 1) % poly.length];
    const fp = f(P),
      fq = f(Q);
    if (fp <= 0) {
      out.push(P);
      if (fq > 0) {
        const t = fp / (fp - fq);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, b.id]);
      }
    } else if (fq <= 0) {
      const t = fp / (fp - fq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2]]);
    }
  }
  return out;
}

// Field boundaries as straight segments between pairs of field seeds.
function fieldEdges(terrain, def, half) {
  const fs = def.fieldSize;
  const seeds = new Map();
  for (let z = -half; z <= half; z += fs / 4) {
    for (let x = -half; x <= half; x += fs / 4) {
      const c = terrain.cellOf(x, z);
      seeds.set(c.cell.id, c.cell);
      seeds.set(c.other.id, c.other);
    }
  }
  const gridN = Math.ceil(def.size / fs) + 2;
  const edges = [];
  for (const a of seeds.values()) {
    const ax = a.id % gridN,
      az = Math.floor(a.id / gridN);
    const e = 3 * fs;
    let poly = [
      [a.x - e, a.z - e, -1],
      [a.x + e, a.z - e, -1],
      [a.x + e, a.z + e, -1],
      [a.x - e, a.z + e, -1],
    ];
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dz) continue;
        const b = seeds.get((az + dz) * gridN + (ax + dx));
        if (b) poly = clip(poly, a, b);
      }
    }
    for (let k = 0; k < poly.length; k++) {
      const [x0, z0, tag] = poly[k];
      const [x1, z1] = poly[(k + 1) % poly.length];
      if (tag < 0 || tag < a.id) continue;
      const b = seeds.get(tag);
      if (a.hedge || b.hedge) edges.push({ x0, z0, x1, z1 });
    }
  }
  return edges;
}

// Split a polyline run at gates: 4.5-6.5 m openings away from the ends.
function cutGates(pts, r, out) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = acc[acc.length - 1];
  const gates = [];
  if (len > 22 && r.chance(0.85)) gates.push(r.range(0.25, 0.75));
  if (len > 75) gates.push(r.chance(0.5) ? r.range(0.08, 0.2) : r.range(0.8, 0.92));
  if (len > 150) gates.push(r.range(0.4, 0.6));
  gates.sort((a, b) => a - b);
  const at = (L) => {
    let i = 1;
    while (i < pts.length - 1 && acc[i] < L) i++;
    const t = (L - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
  };
  const sub = (L0, L1) => {
    if (L1 - L0 < 5) return;
    const p = [at(L0)];
    for (let i = 1; i < pts.length - 1; i++) if (acc[i] > L0 && acc[i] < L1) p.push(pts[i]);
    p.push(at(L1));
    out.push(p);
  };
  let L0 = 0;
  for (const g of gates) {
    const w = r.range(4.5, 6.5);
    const c = Math.max(4 + w / 2, Math.min(len - 4 - w / 2, g * len));
    if (c - w / 2 <= L0 + 3) continue;
    sub(L0, c - w / 2);
    L0 = c + w / 2;
  }
  sub(L0, len);
}

// Runs of valid ground along a polyline sampled every ~1 m.
function validRuns(samples, ok, minLen) {
  const runs = [];
  let cur = null;
  for (const p of samples) {
    if (ok(p[0], p[1])) {
      (cur ??= []).push(p);
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs.filter((run) => run.length > 1 && Math.hypot(run[run.length - 1][0] - run[0][0], run[run.length - 1][1] - run[0][1]) >= minLen);
}

export function planHedges(site, terrain, def, P, r) {
  const half = site.half;
  const runs = [];
  if (def.fieldSize && def.hedgeChance > 0) {
    for (const e of fieldEdges(terrain, def, half)) {
      const L = Math.hypot(e.x1 - e.x0, e.z1 - e.z0);
      if (L < 6) continue;
      const n = Math.ceil(L);
      const samples = [];
      for (let k = 0; k <= n; k++) samples.push([lerp(e.x0, e.x1, k / n), lerp(e.z0, e.z1, k / n)]);
      for (const run of validRuns(samples, (x, z) => hedgeOK(site, x, z), 6)) cutGates([run[0], run[run.length - 1]], r, runs);
    }
  }
  const fieldCount = runs.length;
  // Hedges along stretches of road (both sides of a sunken lane, or one).
  const vil = def.village;
  for (const road of terrain.roads) {
    const s = road.samples;
    for (const side of [1, -1]) {
      let on = r.chance(0.6);
      let left = on ? r.range(60, 260) : r.range(15, 80);
      let cur = [];
      const flush = () => {
        if (cur.length > 4) cutGates(cur, r, runs);
        cur = [];
      };
      for (let i = 1; i < s.length - 1; i++) {
        const step = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        left -= step;
        if (left <= 0) {
          on = !on;
          left = on ? r.range(60, 260) : r.range(15, 80);
          flush();
        }
        if (!on) continue;
        const a = s[i - 1],
          b = s[i + 1];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const off = road.width / 2 + 2.5;
        const x = s[i][0] - ((b[1] - a[1]) / l) * off * side,
          z = s[i][1] + ((b[0] - a[0]) / l) * off * side;
        const nearVillage = vil && Math.hypot(x - vil.x, z - vil.z) < vil.radius + 40;
        // (The offset keeps it off this road; the low limit only stops it at crossings.)
        if (!nearVillage && hedgeOK(site, x, z, 0.9) && !P.near(x, z, 3.5, true)) cur.push([x, z]);
        else flush();
      }
      flush();
    }
  }
  // Annotate runs: length, a height and width scale for the whole hedge.
  const out = runs.map((pts, i) => {
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    return { pts, len, road: i >= fieldCount, hs: r.range(0.85, 1.25), ws: r.range(0.9, 1.12), seed: r.int(1, 1e6) };
  });
  // Trees growing out of the hedges, and bushes or a big oak at the corners.
  for (const run of out) {
    const pts = run.pts;
    if (run.len > 14 && r.chance(run.road ? 0.55 : 0.75)) {
      let L = r.range(3, 14);
      const acc = [0];
      for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      while (L < run.len - 2.5) {
        let k = 1;
        while (k < pts.length - 1 && acc[k] < L) k++;
        const t = (L - acc[k - 1]) / (acc[k] - acc[k - 1] || 1);
        const x = lerp(pts[k - 1][0], pts[k][0], t) + r.range(-0.25, 0.25),
          z = lerp(pts[k - 1][1], pts[k][1], t) + r.range(-0.25, 0.25);
        if (!P.near(x, z, 5, true) && site.canPlant(x, z, { road: 2.5, river: 5, mask: EX_BUILDING | EX_PLOT | EX_POINT | EX_FLAT })) {
          const sp = pick(r, [['oak', 0.55], ['ash', 0.35], ['beech', 0.1]]);
          P.add(tree(sp, r), ROLE.hedge, x, site.height(x, z), z, r.next() * Math.PI * 2, r.range(0.72, 1.1), r.range(0.95, 1.15), r.range(0.92, 1.05), r.range(-0.04, 0.04), r.range(-0.04, 0.04));
        }
        L += r.range(12, 38);
      }
    }
    for (const end of [pts[0], pts[pts.length - 1]]) {
      const x = end[0] + r.range(-1.2, 1.2),
        z = end[1] + r.range(-1.2, 1.2);
      if (r.chance(0.3) && site.canPlant(x, z, { road: 2, river: 3, mask: EX_BUILDING | EX_PLOT | EX_POINT | EX_FLAT }) && !P.near(x, z, 2.5)) addBush(P, site, r, x, z, ROLE.hedge, 1.1);
    }
  }
  return out;
}

// Hedge sections of length `len` along every run: { count, x, y, z, r, group, mats }.
// The section geometry is `len` long on its local x axis (see hedgeGeometry).
export function hedgeSections(runs, site, len) {
  const list = [];
  for (const run of runs) {
    const { pts } = run;
    const acc = [0];
    for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const total = acc[acc.length - 1];
    const m = Math.max(1, Math.round(total / len));
    const at = (L) => {
      let k = 1;
      while (k < pts.length - 1 && acc[k] < L) k++;
      const t = (L - acc[k - 1]) / (acc[k] - acc[k - 1] || 1);
      return [lerp(pts[k - 1][0], pts[k][0], t), lerp(pts[k - 1][1], pts[k][1], t)];
    };
    const r = new RNG(run.seed);
    for (let k = 0; k < m; k++) {
      const p0 = at((k * total) / m),
        p1 = at(((k + 1) * total) / m);
      const dx = p1[0] - p0[0],
        dz = p1[1] - p0[1];
      const c = Math.hypot(dx, dz);
      if (c < 0.5) continue;
      const h0 = site.height(p0[0], p0[1]),
        h1 = site.height(p1[0], p1[1]);
      const cx = (p0[0] + p1[0]) / 2,
        cz = (p0[1] + p1[1]) / 2;
      const hm = site.height(cx, cz);
      const y = Math.min((h0 + h1) / 2, hm + 0.1) - 0.05;
      list.push({ cx, cz, y, yaw: Math.atan2(-dz, dx), pitch: Math.atan2(h1 - h0, c), sx: (c / len) * 1.04, sy: run.hs * r.range(0.93, 1.07), sz: run.ws * r.range(0.95, 1.05), flip: r.chance(0.5) });
    }
  }
  const count = list.length;
  const items = { count, x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count), r: new Float32Array(count), group: new Uint8Array(count), mats: new Float32Array(count * 16) };
  list.forEach((s, i) => {
    items.x[i] = s.cx;
    items.y[i] = s.y + 1.5;
    items.z[i] = s.cz;
    items.r[i] = len * 0.55 + 2.5;
    // T * Ry(yaw [+ pi]) * Rz(pitch) * S
    const yaw = s.yaw + (s.flip ? Math.PI : 0);
    const pitch = s.flip ? -s.pitch : s.pitch;
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    // Columns of Ry * Rz.
    const ax = [cy * cp, sp, -sy * cp],
      ay = [-cy * sp, cp, sy * sp],
      az = [sy, 0, cy];
    const m = items.mats;
    const o = i * 16;
    m[o] = ax[0] * s.sx;
    m[o + 1] = ax[1] * s.sx;
    m[o + 2] = ax[2] * s.sx;
    m[o + 4] = ay[0] * s.sy;
    m[o + 5] = ay[1] * s.sy;
    m[o + 6] = ay[2] * s.sy;
    m[o + 8] = az[0] * s.sz;
    m[o + 9] = az[1] * s.sz;
    m[o + 10] = az[2] * s.sz;
    m[o + 12] = s.cx;
    m[o + 13] = s.y;
    m[o + 14] = s.cz;
    m[o + 15] = 1;
  });
  return items;
}

// Straight pieces for the collision boxes: up to 24 m long, split where the hedge
// turns or the ground isn't close to a straight line under it. Gentle slopes along a
// piece are followed by tilting the box (roll), steeper ground by making it taller.
// { cx, cz, cy (ground at the middle), len, yaw, roll, lo, hi (ground range around the
// line), hs, ws }.
export function hedgePieces(runs, site, radius = Infinity) {
  const out = [];
  for (const run of runs) {
    const pts = run.pts;
    if (!pts.some((p) => p[0] * p[0] + p[1] * p[1] < (radius + 30) ** 2)) continue;
    const dense = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const L = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
      const n = Math.max(1, Math.ceil(L / 2));
      for (let j = 0; j < n; j++) dense.push([lerp(pts[k][0], pts[k + 1][0], j / n), lerp(pts[k][1], pts[k + 1][1], j / n)]);
    }
    dense.push(pts[pts.length - 1]);
    const H = dense.map((p) => site.height(p[0], p[1]));
    const acc = [0];
    for (let k = 1; k < dense.length; k++) acc.push(acc[k - 1] + Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1]));
    // Fit for points a..b: a line along the hedge, its slope clamped to what the bots'
    // navigation grid still counts as upright (0.045), and the rest of the ground
    // within 0.5 m of it.
    const fit = (a, b) => {
      const len = acc[b] - acc[a];
      const slope = Math.max(-0.045, Math.min(0.045, (H[b] - H[a]) / Math.max(len, 1e-3)));
      let lo = Infinity,
        hi = -Infinity;
      for (let k = a; k <= b; k++) {
        const d = H[k] - (H[a] + slope * (acc[k] - acc[a]));
        lo = Math.min(lo, d);
        hi = Math.max(hi, d);
      }
      if (hi - lo > 0.6) return null;
      const mid = (lo + hi) / 2;
      return { len, roll: Math.atan(slope), cy: H[a] + (slope * len) / 2 + mid, lo: lo - mid, hi: hi - mid };
    };
    let a = 0;
    while (a < dense.length - 1) {
      let best = { b: a + 1, f: fit(a, a + 1) || { len: 2, roll: 0, cy: (H[a] + H[a + 1]) / 2, lo: -Math.abs(H[a + 1] - H[a]) / 2, hi: Math.abs(H[a + 1] - H[a]) / 2 } };
      const d0 = Math.atan2(dense[a + 1][1] - dense[a][1], dense[a + 1][0] - dense[a][0]);
      for (let b = a + 2; b < dense.length; b++) {
        const dir = Math.atan2(dense[b][1] - dense[b - 1][1], dense[b][0] - dense[b - 1][0]);
        let turn = Math.abs(dir - d0);
        if (turn > Math.PI) turn = 2 * Math.PI - turn;
        if (turn > 0.18) break;
        const f = fit(a, b);
        if (!f || f.len > 24) break;
        best = { b, f };
      }
      const p0 = dense[a],
        p1 = dense[best.b];
      const dx = p1[0] - p0[0],
        dz = p1[1] - p0[1];
      out.push({ cx: (p0[0] + p1[0]) / 2, cz: (p0[1] + p1[1]) / 2, cy: best.f.cy, len: Math.hypot(dx, dz), yaw: Math.atan2(-dz, dx), roll: best.f.roll, lo: best.f.lo, hi: best.f.hi, hs: run.hs, ws: run.ws });
      a = best.b;
    }
  }
  return out;
}

export { HEDGE };
