// The battle map: the battlefield seen from above on a 2D canvas, as in the map
// and deploy screen of Heroes & Generals. The ground reads like a muted aerial
// photograph: relief shading and surface colors from the heightfield (fields,
// woods, hedgerows, water), the roads and the river, and the village's roofs with
// their late-afternoon shadows. A clean overlay on top shows the capture points
// and the links between them, the spawn choices and the player.
//
//   const map = new BattleMap(canvas, def, { world, view });   // world optional
//   map.setWorld(world);       // the terrain (or the village) arrived: redo the ground
//   map.draw({ points, team, spawns, selected, hover, player, friends, enemies, marks, time });
//   map.toMap(x, z) -> [px, py];  map.toWorld(px, py) -> [x, z]   (CSS pixels)
//   map.spawnAt(px, py) -> the id of the spawn under a click, or null
//   map.resize();              // after the canvas changes size (cheap when it didn't)
//   map.setView({ x, z, radius } or { x, z, scale });   map.dispose();
//
// Everything in draw() is optional. points: Assault's points (id, kind, x, z,
// owner DEF 0 / ATT 1 / null, c -1..1, links; count [def, att] shows a fight), or
// the opening state from the map definition. team: the viewer's side (default the
// attackers): own points blue, the enemy's red, neutral grey. spawns: what
// deployOptions() returns ({ id, delay, point }); selected and hover are spawn ids.
// player: { x, z, yaw } with the game's yaw (0 faces north, positive turns left).
// friends, enemies: [{ x, z }] or soldiers. marks: [{ x, z, label }] (range targets).
// time: seconds, makes the selected spawn pulse.
//
// world: anything with the heightfield `hf`; it also uses `terrain` (hedgerow
// mask), `villagePlan` (roofs, farms, walls, the square), `village.footprints`
// when there is no plan, and `vegetation` (hedgerows and single trees), as the
// game's World keeps them. Without a world the map draws from the definition: at
// once a sketch (river, roads, woods, the village area), then a low-resolution
// preview of the real terrain and village made in the background (opts.preview:
// false turns it off; about a tenth of a second, once per map definition).
//
// The ground and everything else that never changes is drawn once into an
// offscreen canvas, so draw() copies it and adds the live layer on top.
import { SURF } from '../world/heightfield.js';
import { RNG, sampleSpline2 } from '../core/math.js';
import { generateTerrain } from '../world/terrainGen.js';
import { planVillage } from '../world/village/plan.js';
import { ROLE } from '../world/vegetation/placement.js';
import { SPECIES, VARIANTS } from '../world/vegetation/species.js';

// Teams, as in src/game/modes/assault.js.
const DEF = 0;
const ATT = 1;

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const scaled = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

// Overlay colors, from the viewer's side as in H&G (and the HUD's point bar).
const OWN = [70, 128, 200];
const ENEMY = [196, 70, 56];
const NEUTRAL = [146, 144, 136];
const GOLD = [238, 202, 112]; // the selected spawn and the player
const FIGHT = [255, 210, 80]; // both sides on a point (the HUD's "contested")
const INK = [16, 17, 13];
const PAPER = [240, 235, 220];
const OFF_MAP = [22, 23, 17];

// Labels: a condensed sans-serif where there is one, then the usual sans faces.
const FONT = '"Roboto Condensed", "Arial Narrow", "Avenir Next Condensed", "Helvetica Neue", "Liberation Sans Narrow", "DejaVu Sans Condensed", "Segoe UI", Roboto, Arial, sans-serif';

function setFont(ctx, size, weight = 700) {
  ctx.font = `${weight} ${size.toFixed(1)}px ${FONT}`;
  if ('fontStretch' in ctx) ctx.fontStretch = 'condensed';
}

// Ground colors per surface (SURF codes), muted like a summer aerial photograph.
const GROUND = [];
GROUND[SURF.GRASS] = [102, 114, 76];
GROUND[SURF.DRY_GRASS] = [122, 124, 88];
GROUND[SURF.DIRT] = [122, 111, 89];
GROUND[SURF.MUD] = [96, 89, 72];
GROUND[SURF.ROCK] = [120, 117, 108];
GROUND[SURF.FIELD] = [111, 98, 79];
GROUND[SURF.COBBLE] = [132, 126, 116];
GROUND[SURF.FOREST] = [49, 61, 41];
GROUND[SURF.ROAD] = [168, 157, 131];
GROUND[SURF.SAND] = [148, 138, 109];
GROUND[SURF.WATER] = [50, 63, 68];
GROUND[SURF.WHEAT] = [142, 133, 93];
// Fine texture strength per surface (tree crowns in the woods, furrows, stubble).
const GRAIN = [];
for (let i = 0; i < 32; i++) GRAIN[i] = 0.035;
GRAIN[SURF.FOREST] = 0.3;
GRAIN[SURF.FIELD] = 0.07;
GRAIN[SURF.WHEAT] = 0.05;
GRAIN[SURF.WATER] = 0.01;
const HEDGE_COLOR = [52, 63, 43];

// Ground codes for paintGround: the low 5 bits are a SURF code; bits 5-7 how much of
// a hedgerow is in the pixel (0-7), bits 8-10 how much of a grassy field margin
// (0-7), bits 11-18 how much of a wood (0-255). Blending these keeps the edges of
// woods, fields and hedges smooth however coarse the pixels.
const HEDGE_W = 5,
  MARGIN_W = 8,
  WOOD_W = 11;
const FULL_HEDGE = 7 << HEDGE_W;

// Vector colors.
const WATER = [46, 59, 64];
const WATER_EDGE = [70, 84, 86];
const BANK = [112, 104, 82];
const ROAD = [190, 178, 148];
const ROAD_EDGE = [70, 62, 48];
const COBBLE = [138, 131, 120];
const YARD = [124, 112, 90];
const CHURCHYARD = [96, 110, 72];
const WALL = [86, 80, 70];
const TILES = [140, 100, 84];
const SLATE = [92, 98, 106];
const BARN = [118, 102, 88];
const CROWN = [52, 64, 42];
const SHADOW = [12, 16, 10];

// A smooth random field that tiles (values -1..1), sampled at any scale for the
// ground's natural variation; made once.
let noiseTile = null;
function noiseField() {
  if (noiseTile) return noiseTile;
  const n = 256;
  const rng = new RNG(4242);
  let a = new Float32Array(n * n).map(() => rng.next() * 2 - 1);
  // Blur with wrap-around until blobs a few texels across remain.
  for (let pass = 0; pass < 4; pass++) {
    const b = new Float32Array(n * n);
    for (let z = 0; z < n; z++) {
      const zm = ((z + n - 1) % n) * n,
        z0 = z * n,
        zp = ((z + 1) % n) * n;
      for (let x = 0; x < n; x++) {
        const xm = (x + n - 1) % n,
          xp = (x + 1) % n;
        b[z0 + x] = (a[z0 + x] * 4 + a[z0 + xm] + a[z0 + xp] + a[zm + x] + a[zp + x]) / 8;
      }
    }
    a = b;
  }
  let m = 0;
  for (const v of a) m = Math.max(m, Math.abs(v));
  noiseTile = a.map((v) => v / m);
  return noiseTile;
}

// Bilinear sample of the tile at texel coordinates (u, v).
function tileAt(t, u, v) {
  const x0 = Math.floor(u),
    z0 = Math.floor(v);
  const fx = u - x0,
    fz = v - z0;
  const i0 = x0 & 255,
    i1 = (x0 + 1) & 255;
  const j0 = (z0 & 255) << 8,
    j1 = ((z0 + 1) & 255) << 8;
  const a = t[j0 + i0],
    b = t[j0 + i1],
    c = t[j1 + i0],
    d = t[j1 + i1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

// Paints the ground seen from above into RGBA pixels (w x h, mpp meters per pixel,
// the top left pixel's corner at x0, z0): the surface color of each spot, relief
// shading with light from the north-west, and texture. src: { hf, classify?,
// hedgeMask?, hedges?, relief? }. classify(x, z) returns a ground code (see above)
// instead of reading hf.surface (the preview has no surfaces of its own); hedgeMask
// (one byte per cell, as terrainGen's) marks the hedgerows, hedges (0-1) is how
// dark they are; relief is the height exaggeration (the battlefields are gentle).
export function paintGround(out, w, h, x0, z0, mpp, src) {
  const hf = src.hf;
  const H = hf.heights,
    S = hf.surface,
    res = hf.res,
    cell = hf.cell,
    half = hf.half;
  const last = res - 1;
  const classify = src.classify || null;
  const mask = src.hedgeMask || null;
  const hedges = 0.85 * (src.hedges ?? 1);
  const tile = noiseField();
  const grass = GROUND[SURF.GRASS],
    wood = GROUND[SURF.FOREST];
  // Relief: the light on each heightfield cell of the area, from the slope over 8 m
  // or more either side (so it shows hills, banks and hollows rather than every
  // bump), then looked up for each pixel. Light from the north-west, 40 degrees up:
  // the map maker's convention, so hills read as hills.
  const LX = -0.5417,
    LY = 0.6428,
    LZ = -0.5417;
  const n = Math.max(1, Math.round(Math.max(mpp * 1.5, cell * 1.5, 8) / cell - 0.25));
  const k = (src.relief ?? 2.5) / (2 * n * cell);
  const cx0 = Math.max(0, Math.floor((x0 + half) / cell) - 1),
    cz0 = Math.max(0, Math.floor((z0 + half) / cell) - 1);
  const cx1 = Math.min(last, Math.ceil((x0 + w * mpp + half) / cell) + 1),
    cz1 = Math.min(last, Math.ceil((z0 + h * mpp + half) / cell) + 1);
  const lw = cx1 - cx0 + 1,
    lh = cz1 - cz0 + 1;
  const light = new Float32Array(lw * lh);
  for (let j = 0; j < lh; j++) {
    const iz = cz0 + j;
    const row = iz * res,
      up = Math.max(0, iz - n) * res,
      down = Math.min(last, iz + n) * res;
    for (let i = 0; i < lw; i++) {
      const ix = cx0 + i;
      const gx = (H[row + (ix + n > last ? last : ix + n)] - H[row + (ix - n < 0 ? 0 : ix - n)]) * k;
      const gz = (H[down + ix] - H[up + ix]) * k;
      let shade = (LY - gx * LX - gz * LZ) / (Math.sqrt(gx * gx + 1 + gz * gz) * LY);
      shade = shade < 0.62 ? 0.62 : shade > 1.3 ? 1.3 : shade;
      light[j * lw + i] = 1 + (shade - 1) * 0.8;
    }
  }
  const lMaxX = lw - 1.001,
    lMaxZ = lh - 1.001;
  let p = 0;
  for (let j = 0; j < h; j++) {
    const z = z0 + (j + 0.5) * mpp;
    let iz = Math.round((z + half) / cell);
    iz = iz < 0 ? 0 : iz > last ? last : iz;
    const row = iz * res;
    let lz = (z + half) / cell - cz0;
    lz = lz < 0 ? 0 : lz > lMaxZ ? lMaxZ : lz;
    const lj = lz | 0,
      fz = lz - lj;
    for (let i = 0; i < w; i++, p += 4) {
      const x = x0 + (i + 0.5) * mpp;
      let code;
      if (classify !== null) code = classify(x, z);
      else {
        let ix = Math.round((x + half) / cell);
        ix = ix < 0 ? 0 : ix > last ? last : ix;
        code = S[row + ix];
        if (mask !== null && mask[row + ix]) code |= FULL_HEDGE;
      }
      const base = code & 31;
      const c = GROUND[base] || grass;
      // Large blotches (soil and moisture) and fine grain (crowns, furrows).
      const n1 = tileAt(tile, x * 0.045, z * 0.045);
      const n2 = tile[(((z * 0.42 + 19.1) & 255) << 8) | ((x * 0.42 + 67.3) & 255)];
      let f = 1 + 0.05 * n1 + GRAIN[base] * n2;
      let r = c[0] * f,
        g = c[1] * f,
        b = c[2] * f;
      if (code > 31) {
        const mw = ((code >> MARGIN_W) & 7) / 7;
        if (mw > 0) {
          const t = 1 + 0.05 * n1 + 0.035 * n2;
          r += (grass[0] * t - r) * mw;
          g += (grass[1] * t - g) * mw;
          b += (grass[2] * t - b) * mw;
        }
        const ww = (code >> WOOD_W) / 255;
        if (ww > 0) {
          const t = 1 + 0.05 * n1 + 0.3 * n2;
          r += (wood[0] * t - r) * ww;
          g += (wood[1] * t - g) * ww;
          b += (wood[2] * t - b) * ww;
        }
        const hw = (((code >> HEDGE_W) & 7) / 7) * hedges;
        if (hw > 0) {
          const t = 1 + 0.12 * n2;
          r += (HEDGE_COLOR[0] * t - r) * hw;
          g += (HEDGE_COLOR[1] * t - g) * hw;
          b += (HEDGE_COLOR[2] * t - b) * hw;
        }
      }
      // Relief.
      let lx = (x + half) / cell - cx0;
      lx = lx < 0 ? 0 : lx > lMaxX ? lMaxX : lx;
      const li = lx | 0,
        fx = lx - li;
      const q = lj * lw + li;
      const l0 = light[q] + (light[q + 1] - light[q]) * fx;
      const l1 = light[q + lw] + (light[q + lw + 1] - light[q + lw]) * fx;
      f = l0 + (l1 - l0) * fz;
      // Greens lean warmer or cooler with the blotches, as fields do.
      out[p] = r * f * (1 + 0.025 * n1);
      out[p + 1] = g * f;
      out[p + 2] = b * f * (1 - 0.03 * n1);
      out[p + 3] = 255;
    }
  }
  return out;
}

// --- preview: the real terrain at low resolution, from the definition ---------------
// The heights come from a coarse heightfield (about 16 m cells); woods, fields and
// hedgerows are worked out for every pixel from the terrain's own functions, the
// way terrainGen classifies its cells (step 6), so their edges stay sharp. The
// village plan comes out exactly as in the battle (it only depends on the roads, the
// river and the seed).
const previews = new WeakMap();

function requestPreview(def) {
  let p = previews.get(def);
  if (p) return p;
  p = { data: null, waiters: [] };
  previews.set(def, p);
  setTimeout(() => {
    try {
      p.data = makePreview(def);
    } catch (e) {
      console.warn('battle map: no preview', e);
      p.data = { failed: true };
    }
    for (const f of p.waiters.splice(0)) f(p.data);
  }, 0);
  return p;
}

function makePreview(def) {
  const res = Math.max(33, Math.round(def.size / 16) + 1);
  const terrain = generateTerrain({ ...def, res });
  // As in World.build.
  const plan = def.objectives && def.village ? planVillage(terrain, def, new RNG(def.seed * 7 + 3)) : null;
  return { terrain, plan, classifier: (x0, z0, x1, z1, mpp) => previewClassifier(terrain, def, x0, z0, x1, z1, mpp) };
}

// Ground codes for the area x0..x1, z0..z1 at mpp meters per pixel.
function previewClassifier(terrain, def, x0, z0, x1, z1, mpp) {
  const vil = def.village || { x: 0, z: 0, radius: 0 };
  const tile = noiseField();
  // The forest value changes slowly (its finest part is 60 m across): work it out
  // every 8 m and interpolate, which also gives smooth edges to the woods.
  const st = 8;
  const gx0 = Math.floor(x0 / st) - 1,
    gz0 = Math.floor(z0 / st) - 1;
  const nx = Math.ceil(x1 / st) + 2 - gx0,
    nz = Math.ceil(z1 / st) + 2 - gz0;
  const F = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) F[j * nx + i] = terrain.forestAt((gx0 + i) * st, (gz0 + j) * st);
  // How far the forest value moves across a pixel or so: the width of a wood's edge.
  const soft = 0.004 * Math.max(mpp, 2);
  const half = mpp / 2;
  const ramp = (v) => (v <= 0 ? 0 : v >= 1 ? 7 : Math.round(v * 7));
  return (x, z) => {
    const u = x / st - gx0,
      v = z / st - gz0;
    const i = u | 0,
      j = v | 0;
    const fu = u - i,
      fv = v - j;
    const q = j * nx + i;
    const fval = F[q] + (F[q + 1] - F[q]) * fu + (F[q + nx] - F[q]) * fv + (F[q] - F[q + 1] - F[q + nx] + F[q + nx + 1]) * fu * fv;
    const ww = fval >= soft ? 1 : fval <= -soft ? 0 : (fval + soft) / (2 * soft);
    if (ww >= 1) return SURF.FOREST;
    const wood = Math.round(ww * 255) << WOOD_W;
    const dv = Math.hypot(x - vil.x, z - vil.z);
    // Inside the village: grass with trampled patches.
    const inV = (vil.radius + 10 + half - dv) / mpp;
    if (inV >= 1) return (tileAt(tile, x * 0.25, z * 0.25) > 0.45 ? SURF.DIRT : SURF.GRASS) | wood;
    const c = terrain.cellOf(x, z);
    const e = c.edgeDist;
    const kind = c.cell.kind;
    let s;
    if (kind === 'plowed') s = SURF.FIELD;
    else if (kind === 'wheat') s = SURF.WHEAT;
    else s = tileAt(tile, x * 0.09 + 31, z * 0.09) > (kind === 'pasture' ? -0.1 : 0.2) ? SURF.DRY_GRASS : SURF.GRASS;
    // Grassy margins along the field edges, and hedgerows on many of them.
    const margin = ramp(Math.max(inV, (2.5 + half - e) / mpp));
    const hedge = (c.cell.hedge || c.other.hedge) && dv > vil.radius + 15 ? ramp(((1.6 + half - e) / mpp) * (1 - ww)) : 0;
    return s | (hedge << HEDGE_W) | (margin << MARGIN_W) | wood;
  };
}

// --- what the definition gives -------------------------------------------------------
const geometries = new WeakMap();

// River, roads, bridges and the opening points of a map definition (made once).
function mapGeometry(def) {
  let g = geometries.get(def);
  if (g) return g;
  // The same splines terrainGen lays the river and the roads along.
  const river = def.river ? { samples: sampleSpline2(def.river.points, 2), width: def.river.width } : null;
  const roads = (def.roads || []).map((r) => ({ id: r.id, width: r.width, samples: sampleSpline2(r.points, 2) }));
  g = { river, roads, bridges: defBridges(def, river, roads), points: mapPoints(def) };
  geometries.set(def, g);
  return g;
}

// The capture points as Assault starts them: each line's access point (held by the
// attackers) and three points toward its objective (held by the defenders).
export function mapPoints(def) {
  const pts = [];
  const byId = {};
  const add = (p) => {
    p.links = [];
    p.c = p.owner === DEF ? 1 : -1;
    pts.push(p);
    byId[p.id] = p;
  };
  const link = (a, b) => {
    if (!byId[a] || !byId[b]) return;
    byId[a].links.push(b);
    byId[b].links.push(a);
  };
  for (const o of def.objectives || []) add({ id: o.id, name: o.name, kind: 'objective', x: o.x, z: o.z, owner: DEF });
  for (const line of def.lines || []) {
    let prev = null;
    line.points.forEach((q, i) => {
      const id = `${line.id}${i + 1}`;
      add({ id, name: id, kind: i === 0 ? 'access' : 'point', line: line.id, x: q[0], z: q[1], owner: i === 0 ? ATT : DEF });
      if (prev) link(prev, id);
      prev = id;
    });
    link(prev, line.objective);
  }
  link('O1', 'O2');
  return pts;
}

// Where each bridge of the definition crosses the river (as the village plan finds it).
function defBridges(def, river, roads) {
  const out = [];
  if (!river) return out;
  const riverDist = (x, z) => {
    let best = Infinity;
    for (const [rx, rz] of river.samples) best = Math.min(best, (rx - x) ** 2 + (rz - z) ** 2);
    return Math.sqrt(best);
  };
  for (const br of def.bridges || []) {
    const road = roads.find((r) => r.id === br.road);
    if (!road) continue;
    let best = null;
    road.samples.forEach(([x, z], i) => {
      if (Math.hypot(x - br.near[0], z - br.near[1]) > 60) return;
      const d = riverDist(x, z);
      if (!best || d < best.d) best = { i, d, x, z };
    });
    if (!best) continue;
    const s = road.samples;
    const a = s[Math.max(0, best.i - 3)],
      b = s[Math.min(s.length - 1, best.i + 3)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const reach = river.width / 2 + 7;
    out.push({ kind: br.kind, x: best.x, z: best.z, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l, width: road.width + 2, z0: -reach, z1: reach, gap: br.kind === 'destroyed' ? [-3.65, 3.85] : null });
  }
  return out;
}

// --- the village as drawing parts ------------------------------------------------------
// Local (lx, lz) in a frame (x, z, yaw as the game turns things) to world x, z.
function local(f, lx, lz) {
  const c = Math.cos(f.yaw),
    s = Math.sin(f.yaw);
  return [f.x + c * lx + s * lz, f.z - s * lx + c * lz];
}

function faceNormals(f, faces) {
  const c = Math.cos(f.yaw),
    s = Math.sin(f.yaw);
  for (const fa of faces) {
    const [a, b] = fa.n;
    fa.nx = c * a + s * b;
    fa.nz = -s * a + c * b;
  }
  return faces;
}

// A gabled roof over a rectangle of frame f (center cx, cz, half sizes hx, hz): two
// faces either side of a ridge along the frame's x axis (or z, alongZ).
function gabled(f, cx, cz, hx, hz, alongZ, h, roof) {
  const P = (lx, lz) => local(f, cx + lx, cz + lz);
  const pts = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
  const faces = alongZ
    ? [
        { pts: [P(0, -hz), P(hx, -hz), P(hx, hz), P(0, hz)], n: [1, 0] },
        { pts: [P(-hx, -hz), P(0, -hz), P(0, hz), P(-hx, hz)], n: [-1, 0] },
      ]
    : [
        { pts: [P(-hx, 0), P(hx, 0), P(hx, hz), P(-hx, hz)], n: [0, 1] },
        { pts: [P(-hx, -hz), P(hx, -hz), P(hx, 0), P(-hx, 0)], n: [0, -1] },
      ];
  const ridge = alongZ ? [P(0, -hz), P(0, hz)] : [P(-hx, 0), P(hx, 0)];
  return { pts, faces: faceNormals(f, faces), ridge, h, roof };
}

// A hipped roof (the gendarmerie): a short ridge and four faces.
function hipped(f, cx, cz, hx, hz, h, roof) {
  const P = (lx, lz) => local(f, cx + lx, cz + lz);
  const r = Math.max(0, hx - hz);
  const pts = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
  const faces = [
    { pts: [P(-hx, hz), P(hx, hz), P(r, 0), P(-r, 0)], n: [0, 1] },
    { pts: [P(-hx, -hz), P(hx, -hz), P(r, 0), P(-r, 0)], n: [0, -1] },
    { pts: [P(hx, -hz), P(hx, hz), P(r, 0)], n: [1, 0] },
    { pts: [P(-hx, -hz), P(-hx, hz), P(-r, 0)], n: [-1, 0] },
  ];
  return { pts, faces: faceNormals(f, faces), ridge: [P(-r, 0), P(r, 0)], h, roof };
}

// A pyramid roof or spire (towers): four faces meeting at the top.
function pyramid(f, cx, cz, hx, hz, h, roof) {
  const P = (lx, lz) => local(f, cx + lx, cz + lz);
  const top = P(0, 0);
  const pts = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
  const faces = [
    { pts: [pts[0], pts[1], top], n: [0, -1] },
    { pts: [pts[1], pts[2], top], n: [1, 0] },
    { pts: [pts[2], pts[3], top], n: [0, 1] },
    { pts: [pts[3], pts[0], top], n: [-1, 0] },
  ];
  return { pts, faces: faceNormals(f, faces), ridge: [top, top], h, roof, spire: true };
}

// A roof of one slope (a lean-to shed, or the apse seen as one): n is its local slope.
function single(f, localPts, n, h, roof) {
  const pts = localPts.map(([lx, lz]) => local(f, lx, lz));
  return { pts, faces: faceNormals(f, [{ pts, n }]), ridge: null, h, roof };
}

const roofOf = (b) => (b.roof === 'slate' ? SLATE : TILES);
const houseHeight = (b) => (b.storeys === 1 ? 6 : 8.5);

// The parts of the church of the Town map (local frame: origin at the facade, +z
// toward the square, the nave toward -z; see village/church.js).
function churchParts(f) {
  const apse = [[4.5, -34]];
  for (let k = 1; k <= 4; k++) apse.push([4.5 * Math.cos((-k * Math.PI) / 4), -34 + 4.5 * Math.sin((-k * Math.PI) / 4)]);
  return [
    gabled(f, 0, -13, 6, 13, true, 15, SLATE),
    gabled(f, 0, -30, 4.5, 4, true, 12, SLATE),
    single(f, apse, [0, -1], 10, SLATE),
    pyramid(f, 6.9, -31.6, 2.4, 2.4, 13, SLATE),
    pyramid(f, -4.3, 2.1, 2.1, 2.1, 16, SLATE),
    pyramid(f, 9.3, -3.3, 3.3, 3.3, 30, scaled(SLATE, 0.85)),
  ];
}

// A farm (local frame: origin at the yard center, +z toward the road): the house at
// the back, the barn on one side, an open shed on the other (see village/farm.js).
function farmParts(f, barnSide = 1) {
  return [
    gabled(f, 0, -12.5, 6, 4.1, false, 8.5, TILES),
    gabled(f, barnSide * 11.8, -1.5, 5, 8, true, 9, BARN),
    single(
      f,
      [
        [-barnSide * 12.5 - 2.5, -6.5],
        [-barnSide * 12.5 + 2.5, -6.5],
        [-barnSide * 12.5 + 2.5, 2.5],
        [-barnSide * 12.5 - 2.5, 2.5],
      ],
      [barnSide, 0],
      4,
      BARN,
    ),
  ];
}

const rect = (f, cx, cz, hx, hz) => [local(f, cx - hx, cz - hz), local(f, cx + hx, cz - hz), local(f, cx + hx, cz + hz), local(f, cx - hx, cz + hz)];

// Everything of the village to draw: ground patches, walls, trees and buildings
// (roofs), from the village plan when there is one, else from the footprints.
function villageDrawing(plan, footprints, roads) {
  const v = { patches: [], streets: [], walls: [], trees: [], parts: [] };
  if (plan) {
    for (const b of plan.buildings) {
      const f = { x: b.x, z: b.z, yaw: b.yaw };
      if (b.kind === 'church') v.parts.push(...churchParts(f));
      else if (b.kind === 'gendarmerie') v.parts.push(hipped(f, 0, 0, b.w / 2, b.d / 2, 11, SLATE));
      else if (b.kind === 'annex') v.parts.push({ ...gabled(f, 0, 0, b.w / 2, b.d / 2, false, 4.2, roofOf(b)), damaged: b.damaged });
      else {
        const dmg = b.damage && (b.damage.kind === 'roof' || b.damage.kind === 'burned');
        v.parts.push({ ...gabled(f, 0, 0, b.w / 2, b.d / 2, false, houseHeight(b), roofOf(b)), damaged: dmg, burned: b.damage?.kind === 'burned' });
        if (!b.core) v.patches.push({ pts: rect(f, 0, 0, b.w / 2 + 1.2, b.d / 2 + 1.2), color: YARD });
      }
    }
    for (const farm of plan.farms) {
      const f = { x: farm.x, z: farm.z, yaw: farm.yaw };
      v.patches.push({ pts: rect(f, 0, 0, farm.w / 2 + 2, farm.d / 2 + 2), color: YARD });
      v.parts.push(...farmParts(f, farm.barnSide));
      v.walls.push({ pts: [local(f, -16.8, 13.5), local(f, 16.8, 13.5)], kind: 'stone' });
    }
    if (plan.square) v.patches.push({ pts: plan.square.poly, color: COBBLE });
    const ch = plan.church;
    if (ch) {
      const y = ch.yard;
      v.patches.push({ pts: rect(ch, (y.x0 + y.x1) / 2, (y.z0 + y.z1) / 2, (y.x1 - y.x0) / 2, (y.z1 - y.z0) / 2), color: CHURCHYARD });
      v.patches.push({ pts: rect(ch, 3, 2.3, 12.5, 2.4), color: COBBLE });
    }
    const g = plan.gendarmerie;
    if (g && g.court) {
      const c = g.court;
      v.patches.push({ pts: rect(g, (g.side * (c.x0 + c.x1)) / 2, (c.z0 + c.z1) / 2, (c.x1 - c.x0) / 2, (c.z1 - c.z0) / 2), color: COBBLE });
    }
    // Cobbled streets in the village core (as the plan paints them).
    const ctr = plan.center,
      core = plan.radius * 0.72;
    for (const road of roads) {
      let run = [];
      for (const q of road.samples) {
        if (Math.hypot(q[0] - ctr.x, q[1] - ctr.z) < core) run.push(q);
        else if (run.length) {
          v.streets.push({ pts: run, width: road.width + 4.4 });
          run = [];
        }
      }
      if (run.length > 1) v.streets.push({ pts: run, width: road.width + 4.4 });
    }
    for (const w of plan.walls) v.walls.push({ pts: w.pts, kind: w.kind });
    for (const t of plan.trees) v.trees.push({ x: t.x, z: t.z, r: (t.kind === 'plane' ? 5 : 2.8) * (t.size || 1), h: t.kind === 'plane' ? 16 : 6 });
  } else if (footprints) {
    for (const fp of footprints) {
      const f = { x: fp.cx, z: fp.cz, yaw: fp.yaw };
      // A steady pick of roof per building, as the plan's mix (about a third slate).
      const slate = (Math.abs(Math.round(fp.cx * 7.1 + fp.cz * 3.7)) % 3) === 0;
      if (fp.kind === 'church') {
        // The footprint's center is the church's local (1.5, -17).
        const o = local({ x: 0, z: 0, yaw: fp.yaw }, 1.5, -17);
        v.parts.push(...churchParts({ x: fp.cx - o[0], z: fp.cz - o[1], yaw: fp.yaw }));
      } else if (fp.kind === 'gendarmerie') v.parts.push(hipped(f, 0, 0, fp.hx, fp.hz, 11, SLATE));
      else if (fp.kind === 'farm') {
        v.patches.push({ pts: rect(f, 0, 0, fp.hx + 2, fp.hz + 2), color: YARD });
        v.parts.push(...farmParts(f));
      } else v.parts.push(gabled(f, 0, 0, fp.hx, fp.hz, false, fp.kind === 'annex' ? 4.2 : 7.5, slate ? SLATE : TILES));
    }
  }
  return v;
}

// Hedgerows and the trees that stand on their own (not in the woods) from the
// vegetation, when the world has it.
function vegetationDrawing(veg) {
  if (!veg || !veg.plants) return null;
  const P = veg.plants;
  const loose = new Set([ROLE.hedge, ROLE.field, ROLE.orchard, ROLE.roadside, ROLE.river, ROLE.village]);
  const trees = [];
  for (let i = 0; i < P.n; i++) {
    if (!loose.has(P.role[i])) continue;
    const sp = SPECIES[VARIANTS[P.variant[i]]?.species];
    if (!sp) continue;
    const H = sp.H ? (sp.H[0] + sp.H[1]) / 2 : 3;
    const rx = sp.crown ? (sp.crown.rx[0] + sp.crown.rx[1]) / 2 : 0.45;
    const s = P.s[i] * (P.sw?.[i] || 1);
    trees.push({ x: P.x[i], z: P.z[i], r: Math.max(0.8, H * rx * s * 0.8), h: H * P.s[i] });
  }
  return { hedges: veg.hedges || [], trees };
}

// Points of a convex hull (for shadows: a footprint swept away from the sun).
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [],
    hi = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
    hi.push(q);
  }
  lo.pop();
  hi.pop();
  return lo.concat(hi);
}

function polyPath(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function linePath(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeCanvas(w, h, like) {
  const doc = like?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (doc) {
    const c = doc.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}

// Film grain, a small tile laid over the whole picture.
let grainTile = null;
function grainCanvas(like) {
  if (grainTile !== null) return grainTile;
  grainTile = makeCanvas(128, 128, like) || false;
  if (!grainTile) return grainTile;
  const g = grainTile.getContext('2d');
  const img = g.createImageData(128, 128);
  const rng = new RNG(77);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rng.next() + rng.next() - 1) * 120;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grainTile;
}

export class BattleMap {
  constructor(canvas, def, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.def = def;
    this.opts = { preview: true, grid: true, ...opts };
    this.geo = mapGeometry(def);
    this.world = opts.world || null;
    this.state = {};
    this.drawn = false;
    this.base = null;
    this.preview = null;
    this.stats = { baseMs: 0, groundMs: 0, paintMs: 0, groundPx: 0, liveMs: 0 };
    if (!this.world && this.opts.preview) this._wantPreview();
    this.resize(true);
  }

  // The terrain (or the village, or the vegetation) arrived: draw the ground again.
  setWorld(world) {
    this.world = world || null;
    if (!this.world && this.opts.preview) this._wantPreview();
    this._buildBase();
    this._redraw();
  }

  // Show another area: { x, z, radius } (meters from the center to the nearer edge)
  // or { x, z, scale } (CSS pixels per meter); null fits the battlefield again.
  setView(view) {
    this.opts.view = view;
    this._layout();
    this._buildBase();
    this._redraw();
  }

  // Match the canvas to its size on the page (and the screen's pixel ratio).
  resize(force = false) {
    const c = this.canvas;
    const dpr = this.opts.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ?? 1;
    // A canvas that is not laid out yet keeps the size it has.
    const w = c.clientWidth || this.opts.width || this.cssW || c.width;
    const h = c.clientHeight || this.opts.height || this.cssH || c.height;
    if (!force && w === this.cssW && h === this.cssH && dpr === this.dpr) return false;
    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    this._layout();
    this._buildBase();
    this._redraw();
    return true;
  }

  dispose() {
    this.disposed = true;
    this.base = null;
  }

  // World (x, z) to CSS pixels on the canvas, and back.
  toMap(x, z) {
    const v = this.view;
    return [this.cssW / 2 + (x - v.x) * v.scale, this.cssH / 2 + (z - v.z) * v.scale];
  }

  toWorld(px, py) {
    const v = this.view;
    return [v.x + (px - this.cssW / 2) / v.scale, v.z + (py - this.cssH / 2) / v.scale];
  }

  // The spawn under a click (CSS pixels) among the spawns last drawn: the nearest
  // marker within reach, or its delay tag.
  spawnAt(px, py) {
    let best = null,
      bestD = Infinity;
    for (const m of this._spawnMarkers(this.state.spawns, this.state.points)) {
      const d = Math.hypot(px - m.x, py - m.y);
      const onTag = px >= m.tag.x && px <= m.tag.x + m.tag.w && py >= m.tag.y && py <= m.tag.y + m.tag.h;
      if ((d <= m.reach || onTag) && d < bestD) {
        best = m.id;
        bestD = d;
      }
    }
    return best;
  }

  // --- layout -------------------------------------------------------------------------
  _layout() {
    const v = this.opts.view || {};
    const def = this.def;
    const W = this.cssW,
      H = this.cssH;
    // Marker size grows with the map, within what stays readable.
    this.R = clamp(Math.min(W, H) * 0.021, 7, 12.5);
    const x = v.x ?? 0,
      z = v.z ?? 0;
    let scale = v.scale;
    if (!scale && v.radius) scale = Math.min(W, H) / (2 * v.radius);
    if (!scale) {
      // The battlefield, and every point with room for its marker and spawn tag.
      const play = (def.playRadius ?? def.size / 2) * 1.03;
      const pad = this.R * 4.2;
      let ex = 1,
        ez = 1;
      for (const p of this.geo.points) {
        ex = Math.max(ex, Math.abs(p.x - x));
        ez = Math.max(ez, Math.abs(p.z - z));
      }
      scale = Math.min(W / (2 * play), H / (2 * play), (W / 2 - pad) / ex, (H / 2 - pad) / ez);
    }
    this.view = { x, z, scale };
  }

  _wantPreview() {
    const p = requestPreview(this.def);
    if (p.data) {
      this.preview = p.data.failed ? null : p.data;
      return;
    }
    if (this.waiting) return;
    this.waiting = true;
    p.waiters.push((data) => {
      this.waiting = false;
      if (this.disposed || data.failed) return;
      this.preview = data;
      if (this.world) return;
      this._buildBase();
      this._redraw();
    });
  }

  _redraw() {
    if (this.drawn && !this.disposed) this.draw(this.state);
  }

  // --- the base layer: ground, river, roads, village, the frame -------------------------
  _buildBase() {
    if (this.disposed || !this.view) return;
    const t0 = performance.now();
    const W = this.canvas.width,
      H = this.canvas.height;
    if (!this.base || this.base.width !== W || this.base.height !== H) this.base = makeCanvas(W, H, this.canvas);
    if (!this.base) return;
    const b = this.base.getContext('2d');
    const dpr = this.dpr;
    const s = this.view.scale;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.fillStyle = css(OFF_MAP);
    b.fillRect(0, 0, W, H);
    // World meters to device pixels.
    const k = s * dpr;
    const ox = (this.cssW / 2 - this.view.x * s) * dpr,
      oy = (this.cssH / 2 - this.view.z * s) * dpr;
    const toWorldT = () => b.setTransform(k, 0, 0, k, ox, oy);
    const px = 1 / k; // one device pixel in meters
    const minPx = (w, cssPx) => Math.max(w, (cssPx * dpr) * px);

    const world = this.world;
    const preview = !world ? this.preview : null;
    const hf = world?.hf || preview?.terrain.hf || null;
    const half = (hf?.size ?? this.def.size) / 2;
    toWorldT();
    // The ground.
    const tg = performance.now();
    if (hf) this._paintGround(b, hf, preview, half, k);
    else this._sketchGround(b, half);
    this.stats.groundMs = performance.now() - tg;

    // Everything on the ground stops at the edge of the map.
    b.save();
    b.beginPath();
    b.rect(-half, -half, 2 * half, 2 * half);
    b.clip();
    const sun = this.def.sun || { elevation: 25, azimuth: 285 };
    const az = (sun.azimuth * Math.PI) / 180;
    this.sunDir = [Math.sin(az), Math.cos(az)];
    // Shadows as long as a late afternoon's, but not so long they hide the ground.
    const shadowK = Math.min(1.6, 0.55 / Math.tan((Math.max(8, sun.elevation) * Math.PI) / 180));
    const plan = world?.villagePlan || (world && world.village ? null : this.preview?.plan) || null;
    const footprints = !plan ? world?.village?.footprints || null : null;
    const village = plan || footprints ? villageDrawing(plan, footprints, this.geo.roads) : null;
    const veg = world ? vegetationDrawing(world.vegetation) : null;
    const trees = (village?.trees || []).concat(veg?.trees || []);
    const hedges = veg?.hedges || [];
    this._drawRiver(b, minPx);
    this._drawRoads(b, minPx);
    this._drawBridges(b, plan, minPx);
    if (village) this._drawYards(b, village, minPx);
    else if (!hf && this.def.objectives && this.def.village) {
      // The village before anything is known of it: a built-up patch.
      const vl = this.def.village;
      b.fillStyle = css([128, 120, 104], 0.55);
      b.beginPath();
      b.arc(vl.x, vl.z, vl.radius * 0.8, 0, TAU);
      b.fill();
    }
    this._drawShadows(b, village, trees, hedges, shadowK, minPx, [k, ox, oy]);
    if (hedges.length) this._drawHedges(b, hedges, minPx);
    if (trees.length) this._drawTrees(b, trees, k);
    if (village) this._drawRoofs(b, village.parts, minPx, k);
    b.restore();

    // Grain and a soft vignette, as on a print.
    b.setTransform(1, 0, 0, 1, 0, 0);
    const grain = grainCanvas(this.canvas);
    if (grain) {
      b.globalCompositeOperation = 'overlay';
      b.globalAlpha = 0.09;
      b.fillStyle = b.createPattern(grain, 'repeat');
      b.fillRect(0, 0, W, H);
      b.globalAlpha = 1;
      b.globalCompositeOperation = 'source-over';
    }
    const vg = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    b.fillStyle = vg;
    b.fillRect(0, 0, W, H);

    toWorldT();
    this._drawPlayArea(b, half, px);
    if (this.opts.grid) this._drawGrid(b, px);
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._drawNorth(b);
    this._drawScale(b);
    this.stats.baseMs = performance.now() - t0;
  }

  // Relief and surface colors from a heightfield, painted and laid in scaled up.
  _paintGround(b, hf, preview, half, k) {
    const [ax, az] = this.toWorld(0, 0);
    const [bx, bz] = this.toWorld(this.cssW, this.cssH);
    const x0 = Math.max(-half, ax),
      z0 = Math.max(-half, az);
    const x1 = Math.min(half, bx),
      z1 = Math.min(half, bz);
    if (x1 <= x0 || z1 <= z0) return;
    // One pixel per heightfield cell (or per screen pixel, if fewer), but never more
    // than about 1.2 million pixels, or a quarter of that for the preview (which
    // works out its woods and fields pixel by pixel).
    let mpp = Math.max(preview ? 0 : hf.cell, 1 / k);
    mpp = Math.max(mpp, Math.sqrt(((x1 - x0) * (z1 - z0)) / (preview ? 2.5e5 : 1.2e6)));
    const w = Math.ceil((x1 - x0) / mpp),
      h = Math.ceil((z1 - z0) / mpp);
    const cnv = makeCanvas(w, h, this.canvas);
    if (!cnv) return;
    const g = cnv.getContext('2d');
    const img = g.createImageData(w, h);
    const hedgeMask = this.world && !this.world.vegetation?.hedges ? this.world.terrain?.hedgeMask : null;
    const classify = preview ? preview.classifier(x0, z0, x0 + w * mpp, z0 + h * mpp, mpp) : null;
    const t0 = performance.now();
    paintGround(img.data, w, h, x0, z0, mpp, { hf, classify, hedgeMask, hedges: this._fine() });
    this.stats.paintMs = performance.now() - t0;
    this.stats.groundPx = w * h;
    g.putImageData(img, 0, 0);
    b.imageSmoothingEnabled = true;
    b.imageSmoothingQuality = 'high';
    b.drawImage(cnv, x0, z0, w * mpp, h * mpp);
  }

  // The ground from the definition alone: meadows, soft woods, the hills.
  _sketchGround(b, half) {
    b.fillStyle = css(GROUND[SURF.GRASS]);
    b.fillRect(-half, -half, 2 * half, 2 * half);
    for (const f of this.def.features || []) {
      const g = b.createRadialGradient(f.x - f.rx * 0.25, f.z - f.rz * 0.25, 0, f.x, f.z, Math.max(f.rx, f.rz));
      g.addColorStop(0, css([150, 150, 104], clamp(f.height / 40, 0.1, 0.35)));
      g.addColorStop(1, css([150, 150, 104], 0));
      b.fillStyle = g;
      b.fillRect(f.x - f.rx, f.z - f.rz, f.rx * 2, f.rz * 2);
    }
    for (const f of this.def.forests || []) {
      const g = b.createRadialGradient(f.x, f.z, f.r * 0.45, f.x, f.z, f.r);
      const a = clamp(f.strength * 1.3, 0.25, 0.85);
      g.addColorStop(0, css(GROUND[SURF.FOREST], a));
      g.addColorStop(1, css(GROUND[SURF.FOREST], 0));
      b.fillStyle = g;
      b.beginPath();
      b.arc(f.x, f.z, f.r, 0, TAU);
      b.fill();
    }
  }

  _drawRiver(b, minPx) {
    const r = this.geo.river;
    if (!r) return;
    b.lineCap = 'round';
    b.lineJoin = 'round';
    b.beginPath();
    linePath(b, r.samples);
    b.strokeStyle = css(BANK, 0.85);
    b.lineWidth = minPx(r.width + 5, 3.5);
    b.stroke();
    b.strokeStyle = css(WATER_EDGE);
    b.lineWidth = minPx(r.width - 0.6, 2.5);
    b.stroke();
    b.strokeStyle = css(WATER);
    b.lineWidth = minPx(r.width - 3.5, 1.5);
    b.stroke();
  }

  _drawRoads(b, minPx) {
    b.lineCap = 'round';
    b.lineJoin = 'round';
    for (const pass of [0, 1]) {
      for (const r of this.geo.roads) {
        b.beginPath();
        linePath(b, r.samples);
        if (pass === 0) {
          b.strokeStyle = css(ROAD_EDGE, 0.4);
          b.lineWidth = minPx(r.width + 2.2, 2.2);
        } else {
          b.strokeStyle = css(ROAD);
          b.lineWidth = minPx(r.width + 0.6, 1.2);
        }
        b.stroke();
      }
    }
  }

  // Bridges: the deck with its parapets; a blown one has its middle span in the river.
  _drawBridges(b, plan, minPx) {
    const list = plan?.bridges?.length
      ? plan.bridges.map((br) => ({ kind: br.kind, x: br.x, z: br.z, tx: br.tx, tz: br.tz, width: br.width, z0: -br.back - 1, z1: br.ahead + 1, gap: br.kind === 'destroyed' ? [-3.65, 3.85] : null }))
      : this.geo.bridges;
    for (const br of list) {
      const nx = -br.tz,
        nz = br.tx;
      const hw = Math.max(br.width / 2, minPx(0, 2.2));
      const P = (a, c) => [br.x + br.tx * a + nx * c, br.z + br.tz * a + nz * c];
      const spans = br.gap ? [[br.z0, br.gap[0]], [br.gap[1], br.z1]] : [[br.z0, br.z1]];
      for (const [a0, a1] of spans) {
        b.beginPath();
        polyPath(b, [P(a0, -hw), P(a1, -hw), P(a1, hw), P(a0, hw)]);
        b.fillStyle = css([176, 168, 150]);
        b.fill();
        b.lineWidth = minPx(0.6, 0.8);
        b.strokeStyle = css(INK, 0.6);
        b.beginPath();
        linePath(b, [P(a0, -hw), P(a1, -hw)]);
        linePath(b, [P(a0, hw), P(a1, hw)]);
        b.stroke();
      }
      if (br.gap) {
        // Rubble in the water.
        b.fillStyle = css([120, 114, 102], 0.9);
        const rng = new RNG(Math.round(br.x * 13 + br.z * 7) >>> 0);
        b.beginPath();
        for (let i = 0; i < 7; i++) {
          const [x, z] = P(br.gap[0] + rng.next() * (br.gap[1] - br.gap[0]), (rng.next() - 0.5) * hw * 2);
          const rr = minPx(0.5 + rng.next() * 0.7, 0.8);
          b.moveTo(x + rr, z);
          b.arc(x, z, rr, 0, TAU);
        }
        b.fill();
      }
    }
  }

  // How much of the small things (single trees, hedgerows) to show: on a small map
  // they would only speckle the ground, so they fade.
  _fine() {
    return clamp((this.view.scale - 0.15) / 0.4, 0.3, 1);
  }

  // The village's ground: yards, the square, the cobbled streets, walls.
  _drawYards(b, v, minPx) {
    for (const p of v.patches) {
      b.beginPath();
      polyPath(b, p.pts);
      b.fillStyle = css(p.color, 0.9);
      b.fill();
    }
    b.lineCap = 'round';
    b.lineJoin = 'round';
    for (const st of v.streets) {
      b.beginPath();
      linePath(b, st.pts);
      b.strokeStyle = css(COBBLE);
      b.lineWidth = st.width;
      b.stroke();
    }
    b.strokeStyle = css(WALL, 0.85);
    b.lineWidth = minPx(0.6, 0.6);
    b.beginPath();
    for (const w of v.walls) if (w.pts.length > 1 && w.kind !== 'fence') linePath(b, w.pts);
    b.stroke();
  }

  // Shadows of hedges, trees and buildings, away from the low sun. They are drawn
  // solid on a layer of their own and laid on at once, so where two overlap the
  // ground is no darker.
  _drawShadows(b, village, trees, hedges, shadowK, minPx, [k, ox, oy]) {
    if (!village && !trees.length && !hedges.length) return;
    const W = this.base.width,
      H = this.base.height;
    const layer = makeCanvas(W, H, this.canvas);
    if (!layer) return;
    const g = layer.getContext('2d');
    g.setTransform(k, 0, 0, k, ox, oy);
    g.fillStyle = g.strokeStyle = css(SHADOW);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const [sx, sz] = this.sunDir;
    const fine = this._fine();
    // Hedges (about 2.5 m tall): a band from the hedge to the far edge of its shadow.
    if (hedges.length) {
      const L = 2.5 * shadowK;
      g.save();
      g.translate((-sx * L) / 2, (-sz * L) / 2);
      g.globalAlpha = fine;
      g.lineWidth = minPx(L + 1.4, 0.8);
      g.beginPath();
      for (const r of hedges) if (r.pts.length > 1) linePath(g, r.pts);
      g.stroke();
      g.restore();
    }
    // Trees: the crown's shadow drawn out from the trunk (crowns of a size together).
    if (trees.length) {
      const sizes = new Map();
      for (const t of trees) {
        const key = Math.max(1, Math.round(t.r * 2));
        if (!sizes.has(key)) sizes.set(key, []);
        sizes.get(key).push(t);
      }
      g.globalAlpha = fine;
      for (const [key, list] of sizes) {
        g.lineWidth = key * 0.9;
        g.beginPath();
        for (const t of list) {
          // (No longer than a few crowns: rows of tall poplars would look like rails.)
          const L = Math.min(t.h * 0.45 * shadowK, t.r * 2.5);
          g.moveTo(t.x, t.z);
          g.lineTo(t.x - sx * L, t.z - sz * L);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // Buildings: the footprint swept away from the sun, the ridge reaching farthest.
    if (village) {
      g.beginPath();
      for (const p of village.parts) {
        const L = p.h * shadowK;
        const off = (q, f) => [q[0] - sx * L * f, q[1] - sz * L * f];
        const pts = p.pts.concat(p.pts.map((q) => off(q, 0.6)));
        if (p.ridge) pts.push(off(p.ridge[0], 1), off(p.ridge[1], 1));
        polyPath(g, hull(pts));
      }
      g.fill();
    }
    b.save();
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 0.32;
    b.drawImage(layer, 0, 0);
    b.restore();
  }

  _drawHedges(b, runs, minPx) {
    b.lineCap = 'round';
    b.lineJoin = 'round';
    b.strokeStyle = css(HEDGE_COLOR, 0.85 * this._fine());
    b.lineWidth = minPx(2.6, 0.8);
    b.beginPath();
    for (const r of runs) if (r.pts.length > 1) linePath(b, r.pts);
    b.stroke();
  }

  // Tree crowns, the sunny side of each a little lighter.
  _drawTrees(b, trees, k) {
    const [sx, sz] = this.sunDir;
    b.globalAlpha = this._fine();
    b.beginPath();
    for (const t of trees) {
      b.moveTo(t.x + t.r, t.z);
      b.arc(t.x, t.z, t.r, 0, TAU);
    }
    b.fillStyle = css(CROWN);
    b.fill();
    if (k > 0.6) {
      b.beginPath();
      for (const t of trees) {
        const x = t.x + sx * t.r * 0.3,
          z = t.z + sz * t.r * 0.3;
        b.moveTo(x + t.r * 0.55, z);
        b.arc(x, z, t.r * 0.55, 0, TAU);
      }
      b.fillStyle = css([72, 86, 57], 0.8);
      b.fill();
    }
    b.globalAlpha = 1;
  }

  // Roofs: each face lit by how much it faces the sun, a thin ridge, an outline.
  _drawRoofs(b, parts, minPx, k) {
    const [sx, sz] = this.sunDir;
    const lw = minPx(0.35, 0.5);
    for (const p of parts) {
      const tone = 0.92 + 0.16 * ((Math.abs(Math.round(p.pts[0][0] * 31 + p.pts[0][1] * 17)) % 97) / 97);
      for (const fa of p.faces) {
        const dot = fa.nx * sx + fa.nz * sz;
        const f = tone * (1 + 0.24 * dot) * (p.burned ? 0.55 : 1);
        b.beginPath();
        polyPath(b, fa.pts);
        b.fillStyle = css(scaled(p.roof, f));
        b.fill();
      }
      if (p.damaged) {
        // A hole in the roof.
        const c = p.pts;
        const m = [(c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4];
        b.beginPath();
        polyPath(b, [0, 1, 2, 3].map((i) => [m[0] + (c[i][0] - m[0]) * 0.4, m[1] + (c[i][1] - m[1]) * 0.4]));
        b.fillStyle = css([36, 32, 28], 0.85);
        b.fill();
      }
      b.lineWidth = lw;
      b.strokeStyle = css(INK, 0.55);
      b.beginPath();
      polyPath(b, p.pts);
      b.stroke();
      if (p.ridge && !p.spire && k > 0.5) {
        b.strokeStyle = css(scaled(p.roof, 1.3), 0.7);
        b.beginPath();
        linePath(b, p.ridge);
        b.stroke();
      }
    }
  }

  // Outside the battlefield the ground is dimmed, with a thin border.
  _drawPlayArea(b, half, px) {
    const r = this.def.playRadius;
    if (!r) return;
    b.beginPath();
    b.rect(-half * 3, -half * 3, half * 6, half * 6);
    b.rect(-r, r, 2 * r, -2 * r);
    b.fillStyle = css(OFF_MAP, 0.42);
    b.fill('evenodd');
    b.strokeStyle = css(PAPER, 0.32);
    b.lineWidth = px * this.dpr;
    b.setLineDash([px * 6 * this.dpr, px * 4 * this.dpr]);
    b.strokeRect(-r, -r, 2 * r, 2 * r);
    b.setLineDash([]);
  }

  // A faint grid, 100, 200 or 500 m, whichever leaves at least 60 pixels between lines.
  _drawGrid(b, px) {
    const s = this.view.scale;
    const step = [100, 200, 500, 1000].find((g) => g * s >= 60) || 1000;
    const [ax, az] = this.toWorld(0, 0);
    const [bx, bz] = this.toWorld(this.cssW, this.cssH);
    b.beginPath();
    for (let x = Math.ceil(ax / step) * step; x <= bx; x += step) linePath(b, [[x, az], [x, bz]]);
    for (let z = Math.ceil(az / step) * step; z <= bz; z += step) linePath(b, [[ax, z], [bx, z]]);
    b.strokeStyle = css(PAPER, 0.075);
    b.lineWidth = px * this.dpr;
    b.stroke();
  }

  _drawNorth(b) {
    const R = this.R;
    const L = R * 1.4;
    const size = Math.max(9, R * 0.95);
    const x = this.cssW - R * 1.2 - L,
      y = R * 1.2 + size + L + 2;
    b.lineJoin = 'round';
    b.fillStyle = css(INK, 0.4);
    b.beginPath();
    b.arc(x, y, L * 1.08, 0, TAU);
    b.fill();
    // Needle: the north half filled, the south half open.
    b.beginPath();
    b.moveTo(x, y - L);
    b.lineTo(x + L * 0.3, y);
    b.lineTo(x, y - L * 0.1);
    b.lineTo(x - L * 0.3, y);
    b.closePath();
    b.fillStyle = css(PAPER, 0.92);
    b.fill();
    b.beginPath();
    b.moveTo(x, y + L);
    b.lineTo(x + L * 0.3, y);
    b.lineTo(x, y + L * 0.1);
    b.lineTo(x - L * 0.3, y);
    b.closePath();
    b.strokeStyle = css(PAPER, 0.75);
    b.lineWidth = 1;
    b.stroke();
    setFont(b, size);
    b.textAlign = 'center';
    b.textBaseline = 'bottom';
    this._halo(b, 'N', x, y - L - 2, PAPER);
  }

  // A scale bar of alternating segments with the distance in meters, on a plate.
  _drawScale(b) {
    const s = this.view.scale;
    const R = this.R;
    const want = this.cssW * 0.24;
    let len = 25;
    for (const c of [25, 50, 100, 200, 250, 500, 1000, 2000]) if (c * s <= want) len = c;
    const n = len === 250 || len === 25 ? 5 : 4;
    const w = len * s;
    const size = Math.max(9, R * 0.9);
    const h = Math.max(3, R * 0.32);
    const x = R * 1.2 + 6,
      y = this.cssH - R * 1.2 - 6 - h;
    setFont(b, size, 600);
    const tw = b.measureText(`${len} m`).width;
    b.beginPath();
    roundRect(b, x - 6, y - size - 9, w + 12 + tw / 2, size + h + 15, 4);
    b.fillStyle = css(INK, 0.45);
    b.fill();
    b.fillStyle = css(INK, 0.9);
    b.fillRect(x - 1, y - 1, w + 2, h + 2);
    for (let i = 0; i < n; i += 2) {
      b.fillStyle = css(PAPER, 0.92);
      b.fillRect(x + (w * i) / n, y, w / n, h);
    }
    b.textBaseline = 'bottom';
    b.textAlign = 'center';
    this._halo(b, '0', x, y - 3, PAPER);
    this._halo(b, `${len} m`, x + w, y - 3, PAPER);
  }

  _halo(ctx, text, x, y, color, alpha = 1) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = css(INK, 0.7 * alpha);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = css(color, alpha);
    ctx.fillText(text, x, y);
  }

  // --- the live layer ---------------------------------------------------------------------
  // Where each spawn's marker is drawn (CSS pixels), for drawing and clicks alike.
  _spawnMarkers(spawns, points) {
    if (!spawns || !spawns.length) return [];
    const R = this.R;
    const byId = {};
    for (const p of points || this.geo.points) byId[p.id] = p;
    const out = [];
    for (const s of spawns) {
      const p = s.point || byId[s.id] || s;
      if (p.x === undefined) continue;
      const [x, y] = this.toMap(p.x, p.z);
      const r = (p.kind === 'objective' ? R * 1.3 : R) + R * 0.55;
      const label = s.delay !== undefined && s.delay !== null ? `${Math.ceil(s.delay)} s` : '';
      const tw = label ? Math.max(R * 2.4, label.length * R * 0.62 + R * 0.8) : 0;
      const th = R * 1.35;
      out.push({ id: s.id, x, y, r, label, reach: Math.max(r + 6, 16), tag: { x: x - tw / 2, y: y + r + 2, w: tw, h: label ? th : 0 } });
    }
    return out;
  }

  draw(state = {}) {
    if (this.disposed) return;
    const t0 = performance.now();
    this.state = state;
    this.drawn = true;
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.base) ctx.drawImage(this.base, 0, 0);
    else {
      ctx.fillStyle = css(OFF_MAP);
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const points = state.points || this.geo.points;
    const team = state.team ?? ATT;
    const byId = {};
    for (const p of points) byId[p.id] = p;
    const side = (owner) => (owner === null || owner === undefined ? NEUTRAL : owner === team ? OWN : ENEMY);
    this._drawLinks(ctx, points, byId, side);
    for (const m of state.marks || []) this._drawMark(ctx, m);
    for (const f of state.friends || []) this._dot(ctx, f.body || f, OWN);
    for (const f of state.enemies || []) this._dot(ctx, f.body || f, ENEMY);
    const spawns = this._spawnMarkers(state.spawns, points);
    for (const m of spawns) this._drawSpawnRing(ctx, m, m.id === state.selected, m.id === state.hover, state.time);
    for (const p of points) this._drawPoint(ctx, p, side, team);
    for (const m of spawns) this._drawSpawnTag(ctx, m, m.id === state.selected, m.id === state.hover);
    this._drawNames(ctx, points);
    if (state.player) this._drawPlayer(ctx, state.player.body || state.player, state.player.yaw ?? state.player.body?.yaw ?? 0);
    this.stats.liveMs = performance.now() - t0;
  }

  // Faint lines from point to point along each line, with a chevron pointing toward
  // the objective; tinted by who holds both ends.
  _drawLinks(ctx, points, byId, side) {
    const R = this.R;
    ctx.lineCap = 'round';
    for (const p of points) {
      for (const id of p.links || []) {
        const q = byId[id];
        if (!q || !(p.id < id)) continue;
        const [x0, y0] = this.toMap(p.x, p.z);
        const [x1, y1] = this.toMap(q.x, q.z);
        const col = p.owner === q.owner && p.owner !== null && p.owner !== undefined ? side(p.owner) : PAPER;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = css(INK, 0.35);
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = css(col, 0.55);
        ctx.lineWidth = 1.25;
        ctx.stroke();
        // Toward the objective: along a line by number, or into the objective.
        let dir = 0;
        if (q.kind === 'objective' && p.kind !== 'objective') dir = 1;
        else if (p.kind === 'objective' && q.kind !== 'objective') dir = -1;
        else if (p.line && p.line === q.line) dir = p.id < q.id ? 1 : -1;
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (!dir || len < R * 5) continue;
        const ux = ((x1 - x0) / len) * dir,
          uy = ((y1 - y0) / len) * dir;
        const mx = (x0 + x1) / 2,
          my = (y0 + y1) / 2;
        const a = R * 0.42;
        ctx.beginPath();
        ctx.moveTo(mx - ux * a - uy * a, my - uy * a + ux * a);
        ctx.lineTo(mx + ux * a * 0.4, my + uy * a * 0.4);
        ctx.lineTo(mx - ux * a + uy * a, my - uy * a - ux * a);
        ctx.strokeStyle = css(INK, 0.4);
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = css(col, 0.7);
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    }
  }

  // A capture point: a disc (objectives bigger, access points square) in its
  // holder's color with its name; while it changes hands a ring shows how far the
  // control has gone, in the color of the side it leans to.
  _drawPoint(ctx, p, side, team) {
    const R = this.R;
    const [x, y] = this.toMap(p.x, p.z);
    const obj = p.kind === 'objective';
    const r = obj ? R * 1.3 : R;
    const col = side(p.owner);
    const c = p.c ?? (p.owner === DEF ? 1 : p.owner === ATT ? -1 : 0);
    const moving = Math.abs(c) < 0.999;
    const fight = p.count && p.count[0] > 0 && p.count[1] > 0;
    const shape = () => {
      ctx.beginPath();
      if (p.kind === 'access') roundRect(ctx, x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8, r * 0.32);
      else ctx.arc(x, y, r, 0, TAU);
    };
    if (fight) {
      ctx.beginPath();
      ctx.arc(x, y, r + R * 0.75, 0, TAU);
      ctx.fillStyle = css(FIGHT, 0.22);
      ctx.fill();
      ctx.strokeStyle = css(FIGHT, 0.9);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Body, with a dark edge and a light inner rim.
    shape();
    ctx.fillStyle = css(col, 0.95);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = css(INK, 0.85);
    ctx.stroke();
    if (obj) {
      ctx.beginPath();
      ctx.arc(x, y, r - 2.6, 0, TAU);
      ctx.strokeStyle = css(PAPER, 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (moving) {
      const rr = r + R * 0.32;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.strokeStyle = css(INK, 0.7);
      ctx.lineWidth = R * 0.34 + 2;
      ctx.stroke();
      const lean = c > 0 ? DEF : ATT;
      ctx.beginPath();
      ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * Math.abs(c));
      ctx.strokeStyle = css(lean === team ? OWN : ENEMY);
      ctx.lineWidth = R * 0.34;
      ctx.stroke();
    }
    setFont(ctx, obj ? R * 1.02 : R * 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(INK, 0.45);
    ctx.fillText(p.id, x + 0.6, y + 1.2);
    ctx.fillStyle = css(PAPER);
    ctx.fillText(p.id, x, y + 0.6);
  }

  // Objective names beside their markers, wherever they cover no other point or
  // name (and none at all if there is no room).
  _drawNames(ctx, points) {
    const R = this.R;
    const size = clamp(R * 0.95, 9, 12);
    setFont(ctx, size, 600);
    const discs = points.map((p) => {
      const [x, y] = this.toMap(p.x, p.z);
      return { x, y, r: (p.kind === 'objective' ? R * 1.3 : R) + 2 };
    });
    const taken = [];
    const free = (box) =>
      box.x >= 2 &&
      box.y >= 2 &&
      box.x + box.w <= this.cssW - 2 &&
      box.y + box.h <= this.cssH - 2 &&
      !discs.some((d) => d.x + d.r > box.x && d.x - d.r < box.x + box.w && d.y + d.r > box.y && d.y - d.r < box.y + box.h) &&
      !taken.some((q) => q.x < box.x + box.w && q.x + q.w > box.x && q.y < box.y + box.h && q.y + q.h > box.y);
    for (const p of points) {
      if (p.kind !== 'objective' || !p.name || p.name === p.id) continue;
      const text = p.name.toUpperCase();
      const w = ctx.measureText(text).width + 4,
        h = size + 3;
      const [x, y] = this.toMap(p.x, p.z);
      const r = R * 1.3 + 4;
      // Right, left, below, above, then the corners.
      const spots = [
        [x + r, y - h / 2],
        [x - r - w, y - h / 2],
        [x - w / 2, y + r],
        [x - w / 2, y - r - h],
        [x + r * 0.7, y + r * 0.7],
        [x + r * 0.7, y - r * 0.7 - h],
        [x - r * 0.7 - w, y + r * 0.7],
        [x - r * 0.7 - w, y - r * 0.7 - h],
      ];
      const spot = spots.find(([bx, by]) => free({ x: bx, y: by, w, h }));
      if (!spot) continue;
      taken.push({ x: spot[0], y: spot[1], w, h });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      this._halo(ctx, text, spot[0] + 2, spot[1] + h / 2 + 0.5, PAPER, 0.95);
    }
  }

  // A spawn: a ring around its point (gold when chosen, pulsing with time).
  _drawSpawnRing(ctx, m, selected, hover, time) {
    const R = this.R;
    const pulse = selected && time !== undefined ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r + pulse * R * 0.25, 0, TAU);
    if (selected) {
      ctx.fillStyle = css(GOLD, 0.2 + 0.1 * pulse);
      ctx.fill();
    }
    ctx.strokeStyle = css(INK, 0.6);
    ctx.lineWidth = selected ? 5 : 3.5;
    ctx.stroke();
    ctx.strokeStyle = selected ? css(GOLD) : css(PAPER, hover ? 1 : 0.75);
    ctx.lineWidth = selected ? 2.5 : hover ? 2 : 1.5;
    ctx.stroke();
  }

  // The time to deploy under the spawn's point.
  _drawSpawnTag(ctx, m, selected, hover) {
    if (!m.label) return;
    const R = this.R;
    const t = m.tag;
    ctx.beginPath();
    roundRect(ctx, t.x, t.y, t.w, t.h, Math.min(t.h / 2, R * 0.5));
    ctx.fillStyle = selected ? css(GOLD) : css(INK, hover ? 0.9 : 0.78);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = selected ? css(INK, 0.8) : css(PAPER, hover ? 0.9 : 0.5);
    ctx.stroke();
    setFont(ctx, R * 0.88);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = selected ? css(INK) : css(PAPER);
    ctx.fillText(m.label, t.x + t.w / 2, t.y + t.h / 2 + 0.5);
  }

  _dot(ctx, p, col) {
    if (p.alive === false || p.x === undefined) return;
    const [x, y] = this.toMap(p.x, p.z);
    const r = Math.max(2.4, this.R * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = css(col);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = css(INK, 0.85);
    ctx.stroke();
  }

  // A small labeled marker (firing range targets and the like).
  _drawMark(ctx, m) {
    const R = this.R;
    const [x, y] = this.toMap(m.x, m.z);
    const a = R * 0.34;
    ctx.fillStyle = css(PAPER, 0.95);
    ctx.strokeStyle = css(INK, 0.85);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(x - a, y - a, a * 2, a * 2);
    ctx.fill();
    ctx.stroke();
    if (m.label) {
      setFont(ctx, clamp(R * 0.85, 8.5, 11), 600);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      this._halo(ctx, m.label, x + a + 3, y + 0.5, PAPER);
    }
  }

  // The player: an arrow along his facing and a faint cone of view.
  _drawPlayer(ctx, p, yaw) {
    const R = this.R;
    const [x, y] = this.toMap(p.x, p.z);
    const ux = -Math.sin(yaw),
      uy = -Math.cos(yaw);
    const vx = -uy,
      vy = ux;
    const reach = R * 5;
    const ang = Math.atan2(uy, ux);
    const g = ctx.createRadialGradient(x, y, R * 0.6, x, y, reach);
    g.addColorStop(0, css(GOLD, 0.32));
    g.addColorStop(1, css(GOLD, 0));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, reach, ang - 0.6, ang + 0.6);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    const L = R * 1.25;
    const P = (a, b) => [x + ux * a + vx * b, y + uy * a + vy * b];
    const pts = [P(L * 1.15, 0), P(-L * 0.75, L * 0.72), P(-L * 0.35, 0), P(-L * 0.75, -L * 0.72)];
    ctx.beginPath();
    polyPath(ctx, pts);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = css(INK, 0.85);
    ctx.stroke();
    ctx.fillStyle = css(GOLD);
    ctx.fill();
  }
}
