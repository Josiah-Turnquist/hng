// The war map as a network: its points, the supply lines between them, the
// capitals, and the way along the lines from one point to another. Built
// once from the original game's data (warMapData.js).
//
//   MAP.count                       // how many points
//   MAP.name(i), MAP.x[i], MAP.y[i], MAP.kind[i]   // 't' 'm' 'f' 'a' 'w'
//   MAP.next[i]                     // the points a line runs to from i
//   MAP.capitals                    // [{ point, start }]: start is the army holding it at the start, or ''
//   MAP.isCapital(i)
//   distance(a, b)                  // straight across, in map units
//   route(from, to, cost)           // points along the lines from 'from' (left out) to 'to', or null
//   nearest(x, y)                   // the point nearest a place on the map
import { POINT_NAMES, POINT_XY, POINT_KINDS, LINES, CAPITALS } from './warMapData.js';

const names = POINT_NAMES.split('\n');
const count = names.length;
const x = new Float32Array(count);
const y = new Float32Array(count);
for (let i = 0; i < count; i++) {
  x[i] = POINT_XY[i * 2];
  y[i] = POINT_XY[i * 2 + 1];
}
const next = Array.from({ length: count }, () => []);
for (let k = 0; k < LINES.length; k += 2) {
  next[LINES[k]].push(LINES[k + 1]);
  next[LINES[k + 1]].push(LINES[k]);
}
const capitalOf = new Map(CAPITALS.map(([p, f]) => [p, f]));

export const KIND_NAMES = { t: 'Town', m: 'Mountain town', f: 'Factory', a: 'Airfield', w: 'Forward airfield' };

export const MAP = {
  count,
  x,
  y,
  kind: POINT_KINDS,
  next,
  lines: LINES,
  name: (i) => names[i],
  capitals: CAPITALS.map(([point, start]) => ({ point, start })),
  isCapital: (i) => capitalOf.has(i),
  // The map's extent, for drawing.
  bounds: (() => {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i < count; i++) {
      x0 = Math.min(x0, x[i]);
      y0 = Math.min(y0, y[i]);
      x1 = Math.max(x1, x[i]);
      y1 = Math.max(y1, y[i]);
    }
    return { x0, y0, x1, y1 };
  })(),
};

export function distance(a, b) {
  return Math.hypot(x[a] - x[b], y[a] - y[b]);
}

// Shortest way along the supply lines. cost(a, b) adds to a line's length
// (Infinity closes it); without it, the lines' lengths alone.
export function route(from, to, cost = null) {
  if (from === to) return [];
  const best = new Float64Array(count).fill(Infinity);
  const prev = new Int32Array(count).fill(-1);
  const heap = [[0, from]];
  best[from] = 0;
  while (heap.length) {
    const [d, u] = pop(heap);
    if (d > best[u]) continue;
    if (u === to) break;
    for (const v of next[u]) {
      const extra = cost ? cost(u, v) : 0;
      if (extra === Infinity) continue;
      const nd = d + distance(u, v) + extra;
      if (nd < best[v]) {
        best[v] = nd;
        prev[v] = u;
        push(heap, [nd, v]);
      }
    }
  }
  if (prev[to] === -1) return null;
  const out = [];
  for (let p = to; p !== from; p = prev[p]) out.push(p);
  return out.reverse();
}

// How far every point is from the nearest of some points, along the lines,
// and which of them it is nearest to.
export function spread(sources) {
  const best = new Float64Array(count).fill(Infinity);
  const from = new Int32Array(count).fill(-1);
  const heap = [];
  for (const s of sources) {
    best[s] = 0;
    from[s] = s;
    push(heap, [0, s]);
  }
  while (heap.length) {
    const [d, u] = pop(heap);
    if (d > best[u]) continue;
    for (const v of next[u]) {
      const nd = d + distance(u, v);
      if (nd < best[v]) {
        best[v] = nd;
        from[v] = from[u];
        push(heap, [nd, v]);
      }
    }
  }
  return { best, from };
}

export function nearest(px, py) {
  let bi = 0,
    bd = Infinity;
  for (let i = 0; i < count; i++) {
    const d = (x[i] - px) ** 2 + (y[i] - py) ** 2;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return bi;
}

// A small binary heap of [key, value].
function push(h, item) {
  h.push(item);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p][0] <= h[i][0]) break;
    [h[p], h[i]] = [h[i], h[p]];
    i = p;
  }
}
function pop(h) {
  const top = h[0];
  const last = h.pop();
  if (h.length) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1,
        r = l + 1;
      let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]];
      i = m;
    }
  }
  return top;
}
