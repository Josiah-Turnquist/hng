// Village layout: decides where every building, wall, tree and prop goes, and
// shapes the ground under them (flattened plots, cobbled square and streets, dirt
// farmyards). Runs once after terrain generation and before the terrain mesh is
// built. Fully deterministic for a given map definition and RNG seed.
import { RNG } from '../../core/math.js';
import { SURF } from '../heightfield.js';
import { Site, TerrainEditor, inRect, pointInPoly } from './site.js';

const TAU = Math.PI * 2;

// Unit tangent of a road at the sample nearest to (x, z).
function roadAt(road, x, z) {
  const s = road.samples;
  let bi = 0,
    bd = Infinity;
  for (let i = 0; i < s.length; i++) {
    const d = (s[i][0] - x) ** 2 + (s[i][1] - z) ** 2;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  const a = s[Math.max(0, bi - 2)],
    b = s[Math.min(s.length - 1, bi + 2)];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { i: bi, x: s[bi][0], z: s[bi][1], tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l, d: Math.sqrt(bd), h: road.heights[bi] };
}

// Frame helper on plain numbers: local (lx, lz) -> world for origin/yaw.
function local(o, lx, lz) {
  const c = Math.cos(o.yaw),
    s = Math.sin(o.yaw);
  return [o.x + c * lx + s * lz, o.z - s * lx + c * lz];
}

const yawFacing = (fx, fz) => Math.atan2(fx, fz);

export function planVillage(terrain, def, rng) {
  if (!(rng instanceof RNG)) rng = new RNG(typeof rng === 'number' ? rng : (def.seed || 1) * 7919 + 17);
  const site = new Site(terrain, def);
  const ed = new TerrainEditor(site);
  const hf = terrain.hf;
  const V = def.village;
  const center = { x: V.x, z: V.z };
  const plan = {
    version: 1,
    center,
    radius: V.radius,
    playRadius: def.playRadius ?? 760,
    buildings: [], // houses, shops, farm buildings, gendarmerie, church
    walls: [], // free-standing walls: { kind: 'stone'|'low'|'fence'|'yard', pts: [[x,z],...], h, gates: [...] }
    trees: [], // { x, z, kind: 'plane'|'fruit', size }
    props: [], // { kind, x, z, yaw, ... }
    square: null,
    church: null,
    bridges: [],
    poles: [],
    farms: [],
    graves: [],
    sites: site,
  };
  const roads = Object.fromEntries(terrain.roads.map((r) => [r.id, r]));
  const objective = (id) => (def.objectives || []).find((o) => o.id === id);
  const seed = () => Math.floor(rng.next() * 2 ** 31);
  const ground = (x, z) => hf.getHeight(x, z);

  // Reserve a footprint and flatten its plot. Returns the floor height.
  const placeFootprint = (b, { plinth = 0.2, blend = 4, margin = 1.2 } = {}) => {
    const h = ed.averageHeight(b.x, b.z, b.w / 2, b.d / 2, b.yaw);
    b.ground = h;
    b.floorY = h + plinth;
    b.id = b.id || `${b.kind}${plan.buildings.length}`;
    site.occupy(b.x, b.z, b.w / 2 + (b.occupyMargin ?? 0.5), b.d / 2 + (b.occupyMargin ?? 0.5), b.yaw, b.id);
    ed.flattenRect(b.x, b.z, b.w / 2 + margin, b.d / 2 + margin, b.yaw, h, blend);
    return b.floorY;
  };

  // ------------------------------------------------------------------------------------
  // 1) The church (O2), parallel to the nearest road, facade toward the village center.
  const o2 = objective('O2') || { x: center.x, z: center.z - 60 };
  {
    const nr = site.nearestRoad(o2.x, o2.z);
    const road = nr ? nr.road : null;
    let fx = 0,
      fz = 1,
      ax = o2.x,
      az = o2.z;
    if (road) {
      const ra = roadAt(road, o2.x, o2.z);
      fx = ra.tx;
      fz = ra.tz;
      if (fx * (center.x - o2.x) + fz * (center.z - o2.z) < 0) {
        fx = -fx;
        fz = -fz;
      }
      // Side of the road the objective is on.
      let nx = o2.x - ra.x,
        nz = o2.z - ra.z;
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl;
      nz /= nl;
      const off = road.width / 2 + 0.8 + 1.6 + 8.6; // ribbon edge + gap + half the church (west extent incl. buttresses)
      ax = ra.x + nx * off;
      az = ra.z + nz * off;
    }
    const yaw = yawFacing(fx, fz);
    // Church local origin = facade center; its middle (z = -17) sits on the objective.
    const along = (o2.x - ax) * fx + (o2.z - az) * fz;
    const ox = ax + fx * (along + 17),
      oz = az + fz * (along + 17);
    const church = { kind: 'church', tag: 'church', x: ox, z: oz, yaw, seed: seed() };
    // Footprint for the flattening and occupancy (local x -10..13, z -40..+6).
    const fpC = local(church, 1.5, -17);
    const fp = { x: fpC[0], z: fpC[1], w: 24, d: 47, yaw };
    church.ground = ed.averageHeight(fp.x, fp.z, fp.w / 2, fp.d / 2, yaw);
    church.floorY = church.ground + 0.45;
    site.occupy(fp.x, fp.z, fp.w / 2, fp.d / 2, yaw, 'church');
    ed.flattenRect(fp.x, fp.z, fp.w / 2 + 1, fp.d / 2 + 1, yaw, church.ground, 5);
    plan.church = church;
    plan.buildings.push(church);

    // Churchyard (cemetery) east and north of the church, walled.
    const yard = { x0: -8.5, x1: 22, z0: -48, z1: -6 };
    church.yard = yard;
    const yc = local(church, (yard.x0 + yard.x1) / 2, (yard.z0 + yard.z1) / 2);
    site.occupy(yc[0], yc[1], (yard.x1 - yard.x0) / 2, (yard.z1 - yard.z0) / 2, yaw, 'churchyard');
    ed.flattenRect(yc[0], yc[1], (yard.x1 - yard.x0) / 2, (yard.z1 - yard.z0) / 2, yaw, church.ground, 6);
    // Graves in rows in the open parts of the yard (east of the nave and north of the apse).
    const gr = new RNG(church.seed + 5);
    for (let gx = 15; gx <= 20.5; gx += 1.9)
      for (let gz = -44; gz <= -9; gz += 2.6) if (gr.chance(0.82)) plan.graves.push({ lx: gx + gr.range(-0.15, 0.15), lz: gz + gr.range(-0.2, 0.2), kind: gr.pick(['slab', 'cross', 'stele', 'stele', 'tomb']), tilt: gr.chance(0.18) ? gr.range(-0.25, 0.25) : 0, seed: gr.int(0, 1e6) });
    for (let gx = -6; gx <= 13; gx += 1.9) for (let gz = -46.5; gz <= -42.5; gz += 2.6) if (gr.chance(0.8)) plan.graves.push({ lx: gx + gr.range(-0.15, 0.15), lz: gz, kind: gr.pick(['slab', 'cross', 'stele', 'tomb']), tilt: gr.chance(0.15) ? gr.range(-0.2, 0.2) : 0, seed: gr.int(0, 1e6) });
  }

  // ------------------------------------------------------------------------------------
  // 2) Town square in front of the church facade, down to the next road.
  const ch = plan.church;
  {
    const x0 = -9.6,
      x1 = 24;
    // March south (local +z) from the parvis until the road clearance runs out.
    const edgeZ = (lx) => {
      let lz = 6;
      for (; lz < 70; lz += 0.5) {
        const [wx, wz] = local(ch, lx, lz);
        if (site.roadEdgeDist(wx, wz, 0.8) < 0.6) break;
      }
      return lz;
    };
    const south = [];
    for (let lx = x1; lx >= x0 - 0.01; lx -= (x1 - x0) / 8) south.push([lx, edgeZ(lx)]);
    const localPoly = [[x0, 4.6], [x1, 4.6], ...south];
    const poly = localPoly.map(([lx, lz]) => local(ch, lx, lz));
    let hsum = 0,
      hn = 0;
    for (let lx = x0; lx <= x1; lx += 3) for (let lz = 5; lz < 30; lz += 3) {
      const [wx, wz] = local(ch, lx, lz);
      if (pointInPoly(wx, wz, poly)) {
        hsum += ground(wx, wz);
        hn++;
      }
    }
    const h = hn ? hsum / hn : ch.ground;
    plan.square = { poly, localPoly, frame: { x: ch.x, z: ch.z, yaw: ch.yaw }, h, depth: Math.min(...south.map((p) => p[1])) };
    // Occupancy: the square stays open (trees, memorial and fountain are planned inside).
    const sqc = local(ch, (x0 + x1) / 2, (4.6 + plan.square.depth) / 2);
    site.occupy(sqc[0], sqc[1], (x1 - x0) / 2, (plan.square.depth - 4.6) / 2, ch.yaw, 'square');
    ed.flattenPoly(poly, h, 5);
    // Contents (local to the church frame).
    const sq = plan.square;
    const midZ = Math.min(sq.depth - 4, 26);
    sq.memorial = { lx: 7, lz: midZ + 1.5 };
    sq.fountain = { lx: 7, lz: 15 };
    const tr = new RNG(ch.seed + 11);
    for (const [lx, lz] of [[-6.6, 9.5], [-6.6, 19], [-6.6, 28.5], [21, 10], [21, 19.5], [21, 29], [16.5, 7.8]]) {
      if (lz > sq.depth - 2.5) continue;
      const [wx, wz] = local(ch, lx, lz);
      plan.trees.push({ x: wx, z: wz, kind: 'plane', size: tr.range(0.9, 1.1), seed: tr.int(0, 1e6) });
    }
  }

  // ------------------------------------------------------------------------------------
  // 3) Gendarmerie (O1): main block on the street, walled courtyard beside and behind.
  const o1 = objective('O1');
  if (o1) {
    const nr = site.nearestRoad(o1.x, o1.z);
    const ra = roadAt(nr.road, o1.x, o1.z);
    let nx = o1.x - ra.x,
      nz = o1.z - ra.z;
    const nl = Math.hypot(nx, nz);
    if (nl < 0.5) {
      nx = -ra.tz;
      nz = ra.tx;
    } else {
      nx /= nl;
      nz /= nl;
    }
    const W = 16,
      D = 11;
    const setback = nr.road.width / 2 + 0.8 + 2.4;
    const cx = ra.x + nx * (setback + D / 2),
      cz = ra.z + nz * (setback + D / 2);
    const yaw = yawFacing(-nx, -nz);
    // Courtyard on the side away from the village center.
    const lxDir = [Math.cos(yaw), -Math.sin(yaw)];
    const side = lxDir[0] * (cx - center.x) + lxDir[1] * (cz - center.z) > 0 ? 1 : -1;
    const g = { kind: 'gendarmerie', tag: 'gendarmerie', x: cx, z: cz, yaw, w: W, d: D, side, seed: seed() };
    placeFootprint(g, { plinth: 0.35, margin: 1.5 });
    // Courtyard: x from W/2 to W/2+14 on `side`, z from front (D/2) to back (-D/2 - 9).
    const cyW = 14,
      backZ = -D / 2 - 9.5;
    g.court = { x0: W / 2, x1: W / 2 + cyW, z0: backZ, z1: D / 2, backZ };
    const ccx = side * (W / 2 + cyW / 2) * 0.5;
    const [ccxW, cczW] = local(g, side * (W / 2 + cyW / 2) - ccx * 0, (backZ + D / 2) / 2);
    site.occupy(ccxW, cczW, cyW / 2 + 0.6, (D / 2 - backZ) / 2 + 0.6, yaw, 'gendarmerie-court');
    const [bcx, bcz] = local(g, 0, (backZ + -D / 2) / 2);
    site.occupy(bcx, bcz, W / 2 + 0.6, (-D / 2 - backZ) / 2 + 0.6, yaw, 'gendarmerie-court');
    ed.flattenRect(ccxW, cczW, cyW / 2 + 1, (D / 2 - backZ) / 2 + 1, yaw, g.ground, 5);
    ed.flattenRect(bcx, bcz, W / 2 + 1, (-D / 2 - backZ) / 2 + 1, yaw, g.ground, 5);
    plan.gendarmerie = g;
    plan.buildings.push(g);
  }

  // ------------------------------------------------------------------------------------
  // 4) Cafe and bakery facing the square from its east side.
  {
    const sq = plan.square;
    const shops = [
      { shop: 'cafe', lz: 12, w: 12, d: 9.5, storeys: 2 },
      { shop: 'bakery', lz: 24.5, w: 9, d: 8.5, storeys: 2 },
    ];
    for (const s of shops) {
      if (s.lz + s.w / 2 > sq.depth + 6) continue;
      const lx = 24.6 + s.d / 2;
      const [x, z] = local(ch, lx, s.lz);
      const b = makeHouse(rng, { x, z, yaw: ch.yaw - Math.PI / 2, w: s.w, d: s.d, storeys: s.storeys, shop: s.shop, core: true, damageChance: 0 });
      const clr = site.rectClearance(x, z, b.w / 2, b.d / 2, b.yaw);
      if (clr.road < 0.5 || site.overlaps(x, z, b.w / 2, b.d / 2, b.yaw, 0.2)) continue;
      placeFootprint(b);
      plan.buildings.push(b);
    }
  }

  // ------------------------------------------------------------------------------------
  // 5) Farms around the village edge, each facing a road.
  {
    const farmSpots = [];
    const addSpot = (roadId, x, z, sideHint) => {
      const road = roads[roadId];
      if (!road) return;
      const ra = roadAt(road, x, z);
      if (ra.d > 60) return;
      farmSpots.push({ ra, sideHint });
    };
    addSpot('farm', 186, -62, -1);
    addSpot('north', -40, -128, 1);
    addSpot('main', -150, 97, -1);
    addSpot('south', 75, 188, -1);
    for (const { ra, sideHint } of farmSpots) {
      for (const sgn of [sideHint, -sideHint]) {
        let nx = -ra.tz * sgn,
          nz = ra.tx * sgn;
        const depth = 34,
          width = 34;
        const setback = 5.5;
        const cx = ra.x + nx * (setback + depth / 2),
          cz = ra.z + nz * (setback + depth / 2);
        const yaw = yawFacing(-nx, -nz);
        const clr = site.rectClearance(cx, cz, width / 2, depth / 2, yaw, 2);
        if (clr.road < 1 || clr.river < 30) continue;
        if (site.overlaps(cx, cz, width / 2, depth / 2, yaw, 1)) continue;
        const farm = { kind: 'farm', tag: 'farm', x: cx, z: cz, yaw, w: width, d: depth, seed: seed(), barnSide: rng.chance(0.5) ? 1 : -1 };
        farm.ground = ed.averageHeight(cx, cz, width / 2, depth / 2, yaw);
        site.occupy(cx, cz, width / 2, depth / 2, yaw, 'farm');
        ed.flattenRect(cx, cz, width / 2 + 1, depth / 2 + 1, yaw, farm.ground, 6);
        plan.farms.push(farm);
        break;
      }
    }
  }

  // ------------------------------------------------------------------------------------
  // 6) Houses along the streets, densest near the square.
  {
    const maxHouses = 38;
    const sq = plan.square;
    const sqCenter = local(ch, 7, (4.6 + sq.depth) / 2);
    const coreR = 75;
    const candidates = [];
    const streets = [
      { id: 'main', from: -150, to: 160 },
      { id: 'north', from: -1, to: 1 },
      { id: 'south', from: -1, to: 1 },
    ];
    for (const st of streets) {
      const road = roads[st.id];
      if (!road) continue;
      const s = road.samples;
      // Arc length along the samples.
      const arc = [0];
      for (let i = 1; i < s.length; i++) arc.push(arc[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
      const at = (L) => {
        let i = 1;
        while (i < s.length - 1 && arc[i] < L) i++;
        const t = (L - arc[i - 1]) / (arc[i] - arc[i - 1] || 1);
        const x = s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t,
          z = s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t;
        const a = s[Math.max(0, i - 3)],
          b = s[Math.min(s.length - 1, i + 2)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return { x, z, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l };
      };
      const total = arc[arc.length - 1];
      for (const sgn of [1, -1]) {
        let L = 0;
        while (L < total) {
          const p = at(L);
          const dc = Math.hypot(p.x - center.x, p.z - center.z);
          if (dc > V.radius - 4) {
            L += 4;
            continue;
          }
          const dsq = Math.hypot(p.x - sqCenter[0], p.z - sqCenter[1]);
          const core = dsq < coreR;
          const hr = new RNG(Math.floor(p.x * 13 + p.z * 7 + sgn * 1000 + st.id.length * 77) >>> 0);
          const w = core ? hr.range(7.5, 11.5) : hr.range(8, 12.5);
          const d = core ? hr.range(7.5, 9.5) : hr.range(6.8, 9);
          const setback = road.width / 2 + 0.8 + (core ? hr.range(1.4, 2.2) : hr.range(2, 5));
          const q = at(L + w / 2);
          const nx = -q.tz * sgn,
            nz = q.tx * sgn;
          const cx = q.x + nx * (setback + d / 2),
            cz = q.z + nz * (setback + d / 2);
          const yaw = yawFacing(-nx, -nz);
          const clr = site.rectClearance(cx, cz, w / 2, d / 2, yaw, 1);
          const dcB = Math.hypot(cx - center.x, cz - center.z);
          const ok = clr.road > 1.0 && clr.river > 20 && dcB < V.radius + 4 && !site.overlaps(cx, cz, w / 2, d / 2, yaw, core ? 0.05 : 1.5);
          if (ok) {
            candidates.push({ x: cx, z: cz, yaw, w, d, core, dsq, street: st.id, front: setback, roadX: q.x, roadZ: q.z, nx, nz });
            site.occupy(cx, cz, w / 2, d / 2, yaw, 'lot');
            const gap = core ? (hr.chance(0.6) ? 0.0 : hr.range(1.5, 3.5)) : hr.range(3, 9);
            L += w + gap;
          } else {
            L += 2;
          }
        }
      }
    }
    // Keep the ones closest to the square, and those lining the street that links the
    // square to the gendarmerie (so the two objectives are joined by village streets).
    const g = plan.gendarmerie;
    for (const c of candidates) {
      c.score = c.dsq;
      if (g) {
        const ax = sqCenter[0],
          az = sqCenter[1];
        const bx = g.x,
          bz = g.z;
        const t = Math.max(0, Math.min(1, ((c.x - ax) * (bx - ax) + (c.z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
        const dLink = Math.hypot(c.x - (ax + (bx - ax) * t), c.z - (az + (bz - az) * t));
        c.score = Math.min(c.score, 25 + dLink * 1.5 + t * 20);
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    site.rects = site.rects.filter((r) => r.tag !== 'lot');
    let count = 0;
    for (const c of candidates) {
      if (count >= maxHouses) break;
      if (site.overlaps(c.x, c.z, c.w / 2, c.d / 2, c.yaw, c.core ? -0.02 : 1.0)) continue;
      const b = makeHouse(rng, { ...c, storeys: c.core ? (rng.chance(0.85) ? 2 : 1) : rng.chance(0.45) ? 2 : 1 });
      placeFootprint(b);
      plan.buildings.push(b);
      count++;
    }
  }
  // Terraces: houses that touch a neighbor get no windows or overhang on that side.
  const houses = plan.buildings.filter((b) => b.kind === 'house');
  for (const a of houses) {
    for (const b of houses) {
      if (a === b) continue;
      for (const side of [-1, 1]) {
        // Point just outside a's side wall, at mid depth.
        const [px, pz] = local(a, side * (a.w / 2 + 0.3), 0);
        if (inRect(px, pz, { cx: b.x, cz: b.z, hx: b.w / 2, hz: b.d / 2, yaw: b.yaw }, 0.05)) {
          if (side < 0) a.attachedL = true;
          else a.attachedR = true;
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------
  // 7) Garden walls, fences and back gardens.
  planGardens(plan, site, rng, local, ed);

  // ------------------------------------------------------------------------------------
  // 7b) Low walls, garden walls and fences along open stretches of street (cover).
  planStreetWalls(plan, site, rng, roads, V, center);

  // 7c) Signs: village entry boards, street plaques, painted adverts, the mairie.
  planSigns(plan, site, rng, roads, V, center, local);

  // ------------------------------------------------------------------------------------
  // 8) Bridges where roads cross the river.
  for (const br of def.bridges || []) {
    const road = roads[br.road];
    if (!road || !terrain.river) continue;
    // Find the road sample closest to the river centerline near the hint.
    let best = null;
    road.samples.forEach(([x, z], i) => {
      if (Math.hypot(x - br.near[0], z - br.near[1]) > 60) return;
      const d = site.riverDist(x, z);
      if (!best || d < best.d) best = { i, d, x, z };
    });
    if (!best) continue;
    const s = road.samples;
    const a = s[Math.max(0, best.i - 3)],
      b = s[Math.min(s.length - 1, best.i + 3)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / l,
      tz = (b[1] - a[1]) / l;
    // Water level at the crossing.
    let wl = 0;
    {
      let bd = Infinity;
      terrain.river.samples.forEach(([x, z], i) => {
        const d = (x - best.x) ** 2 + (z - best.z) ** 2;
        if (d < bd) {
          bd = d;
          wl = terrain.river.level[i];
        }
      });
    }
    // The deck sits a little above the lower bank (and well clear of the
    // water), so the bridge spans the river and its banks, not the meadows.
    const bankAt = (dir) => {
      let k = best.i,
        dist = 0;
      while (k + dir >= 0 && k + dir < s.length && dist < terrain.river.half + 6) {
        dist += Math.hypot(s[k + dir][0] - s[k][0], s[k + dir][1] - s[k][1]);
        k += dir;
      }
      return Math.max(road.heights[k], hf.getHeight(s[k][0], s[k][1]));
    };
    const deckY = Math.min(wl + 2.6, Math.max(wl + 1.5, Math.min(bankAt(-1), bankAt(1)) + 0.4));
    // Walk along the road both ways until the road surface reaches the deck height.
    const reach = (dir) => {
      let k = best.i;
      let dist = 0;
      while (k + dir >= 0 && k + dir < s.length) {
        const n = k + dir;
        dist += Math.hypot(s[n][0] - s[k][0], s[n][1] - s[k][1]);
        k = n;
        const rh = Math.max(road.heights[k], hf.getHeight(s[k][0], s[k][1]));
        // (The last half meter is taken up by the approach ramp.)
        if (dist > terrain.river.half + 4 && rh >= deckY - 0.55) break;
        if (dist > 60) break;
      }
      return dist;
    };
    const lenA = reach(-1),
      lenB = reach(1);
    plan.bridges.push({
      road: br.road,
      kind: br.kind,
      x: best.x,
      z: best.z,
      tx,
      tz,
      yaw: Math.atan2(tx, tz),
      width: road.width + 2,
      waterY: wl,
      deckY,
      back: lenA,
      ahead: lenB,
      seed: seed(),
    });
  }

  // ------------------------------------------------------------------------------------
  // 9) Defensive props, telegraph poles, carts and clutter.
  planProps(plan, site, rng, local, roads, terrain);

  // ------------------------------------------------------------------------------------
  // 10) Ground: apply the flattening, then paint cobbles and dirt.
  ed.apply();
  for (const b of plan.buildings) {
    if (b.kind !== 'house') continue;
    // Trampled dirt around houses (garden paths, yards).
    if (!b.core) ed.paintRect(b.x, b.z, b.w / 2 + 1.2, b.d / 2 + 1.2, b.yaw, SURF.DIRT);
  }
  if (plan.square) ed.paintPoly(plan.square.poly, SURF.COBBLE, { overRoad: true });
  // Cobbled streets in the village core.
  {
    for (const road of terrain.roads) {
      for (const [x, z] of road.samples) {
        const dc = Math.hypot(x - center.x, z - center.z);
        if (dc > V.radius * 0.72) continue;
        const reachW = road.width / 2 + 2.2;
        for (let dz = -reachW; dz <= reachW; dz += hf.cell * 0.5)
          for (let dx = -reachW; dx <= reachW; dx += hf.cell * 0.5) {
            if (dx * dx + dz * dz > reachW * reachW) continue;
            const s = hf.getSurface(x + dx, z + dz);
            if (s === SURF.WATER) continue;
            hf.setSurfaceAt(x + dx, z + dz, SURF.COBBLE);
          }
      }
    }
  }
  for (const f of plan.farms) {
    ed.paintRect(f.x, f.z, f.w / 2 + 2, f.d / 2 + 2, f.yaw, SURF.DIRT);
    // Muddy patches in the yard.
    const fr = new RNG(f.seed + 3);
    for (let k = 0; k < 5; k++) {
      const [mx, mz] = local(f, fr.range(-8, 8), fr.range(-3, 6));
      ed.paintRect(mx, mz, fr.range(1, 2.5), fr.range(1, 2.5), fr.range(0, 3), SURF.MUD);
    }
  }
  if (plan.gendarmerie) {
    const g = plan.gendarmerie;
    const c = g.court;
    const [cx, cz] = local(g, g.side * (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2);
    ed.paintRect(cx, cz, (c.x1 - c.x0) / 2, (c.z1 - c.z0) / 2, g.yaw, SURF.COBBLE);
    const [bx, bz] = local(g, 0, (c.backZ - g.d / 2) / 2);
    ed.paintRect(bx, bz, g.w / 2, (-g.d / 2 - c.backZ) / 2, g.yaw, SURF.DIRT);
  }
  if (plan.church) {
    const c = plan.church;
    const y = c.yard;
    const [cx, cz] = local(c, (y.x0 + y.x1) / 2, (y.z0 + y.z1) / 2);
    ed.paintRect(cx, cz, (y.x1 - y.x0) / 2, (y.z1 - y.z0) / 2, c.yaw, SURF.GRASS);
    const [px, pz] = local(c, 3, 2.3);
    ed.paintRect(px, pz, 12.5, 2.4, c.yaw, SURF.COBBLE);
  }
  // Ground height at each tree/prop after flattening.
  for (const t of plan.trees) t.y = hf.getHeight(t.x, t.z);
  delete plan.sites;
  plan.site = site;
  return plan;
}

// ---------------------------------------------------------------------------------------
// House parameters (the geometry is made by house.js).

const WALL_COLORS = ['cream', 'cream', 'ochre', 'sand', 'grey', 'white', 'rose', 'dirty', 'sand'];
const SHUTTER_COLORS = ['green', 'sage', 'blue', 'greyblue', 'oxblood', 'brown', 'cream', 'grey', 'bottle', 'green', 'greyblue'];

export function makeHouse(rng, o) {
  const r = new RNG(Math.floor(rng.next() * 2 ** 31));
  const storeys = o.storeys ?? (r.chance(0.5) ? 2 : 1);
  const stone = o.shop ? r.chance(0.25) : r.chance(0.42);
  const b = {
    kind: 'house',
    tag: 'house',
    x: o.x,
    z: o.z,
    yaw: o.yaw,
    w: +o.w.toFixed(2),
    d: +o.d.toFixed(2),
    core: !!o.core,
    street: o.street,
    storeys,
    shop: o.shop || null,
    wall: stone ? 'stone' : 'plaster',
    wallColor: r.pick(WALL_COLORS),
    quoins: !stone && r.chance(0.55),
    roof: r.chance(o.core ? 0.35 : 0.25) ? 'slate' : 'tiles',
    pitch: (r.range(38, 50) * Math.PI) / 180,
    shutter: r.pick(SHUTTER_COLORS),
    door: r.pick(SHUTTER_COLORS),
    chimney: r.chance(0.85),
    seed: r.int(0, 2 ** 30),
    damage: null,
  };
  if (b.roof === 'slate') b.pitch = Math.max(b.pitch, (44 * Math.PI) / 180);
  const dmgChance = o.damageChance ?? 0.27;
  if (r.chance(dmgChance)) {
    const kinds = ['roof', 'roof', 'breach', 'corner', 'burned', 'breach'];
    b.damage = { kind: r.pick(kinds), side: r.chance(0.5) ? 1 : -1, seed: r.int(0, 1e6) };
  }
  return b;
}

// ---------------------------------------------------------------------------------------

function planGardens(plan, site, rng, local, ed) {
  const houses = plan.buildings.filter((b) => b.kind === 'house');
  // Group houses by street side to connect neighbors with frontage walls.
  for (const h of houses) {
    const r = new RNG(h.seed + 101);
    // Back garden (or a small yard for terraced houses), shrinking until it fits.
    if (r.chance(h.core ? 0.8 : 0.95)) {
      const side = r.chance(0.5) ? 1 : -1;
      for (const gd of h.core ? [9, 7, 5.5, 4] : [13, 11, 9, 7, 5.5]) {
        const gw = h.w + (h.core ? 0 : r.range(0, 3));
        const [gx, gz] = local(h, ((gw - h.w) / 2) * side, -h.d / 2 - gd / 2 - 0.05);
        const clr = site.rectClearance(gx, gz, gw / 2, gd / 2, h.yaw, 1.5);
        if (clr.road < 1.0 || clr.river < 18 || site.overlaps(gx, gz, gw / 2, gd / 2, h.yaw, 0.05, h.id)) continue;
        site.occupy(gx, gz, gw / 2, gd / 2, h.yaw, 'garden');
        const kind = h.core ? (r.chance(0.8) ? 'stone' : 'fence') : r.chance(0.55) ? 'stone' : 'fence';
        const hgt = kind === 'stone' ? r.range(1.2, 1.9) : 1.1;
        // Three sides (the house closes the fourth).
        const c = Math.cos(h.yaw),
          s = Math.sin(h.yaw);
        const L = (lx, lz) => [gx + c * lx + s * lz, gz - s * lx + c * lz];
        const p0 = L(-gw / 2, gd / 2),
          p1 = L(-gw / 2, -gd / 2),
          p2 = L(gw / 2, -gd / 2),
          p3 = L(gw / 2, gd / 2);
        // A shed at one back corner of bigger gardens; the gate goes in the other half.
        const shed = gd >= 7 && r.chance(0.5);
        const shedSide = (r.chance(0.7) ? 1 : -1) * side;
        const gateT = shed ? (shedSide > 0 ? r.range(0.15, 0.35) : r.range(0.65, 0.85)) : r.range(0.25, 0.75);
        plan.walls.push({ kind, pts: [p0, p1, p2, p3], h: hgt, gate: { seg: 1, t: gateT, w: gd > 8 && r.chance(0.3) && !shed ? 2.6 : 1.1 }, seed: r.int(0, 1e6), owner: h.id });
        if (gd >= 7 && r.chance(0.6)) {
          const tlx = shed ? -shedSide * r.range(0.6, gw / 3) : r.range(-gw / 3, gw / 3);
          const [tx, tz] = local(h, ((gw - h.w) / 2) * side + tlx, -h.d / 2 - gd * r.range(0.35, 0.6));
          plan.trees.push({ x: tx, z: tz, kind: 'fruit', size: r.range(0.75, 1.0), seed: r.int(0, 1e6) });
        }
        if (shed) {
          const aw = r.range(3.2, 4.6),
            ad = r.range(2.8, 3.4);
          const ax = shedSide * (gw / 2 - aw / 2 - 0.3);
          const [x, z] = local(h, ((gw - h.w) / 2) * side + ax, -h.d / 2 - gd + ad / 2 + 0.35);
          const ag = ed.averageHeight(x, z, aw / 2, ad / 2, h.yaw);
          ed.flattenRect(x, z, aw / 2 + 0.6, ad / 2 + 0.6, h.yaw, ag, 2.5);
          plan.buildings.push({ kind: 'annex', tag: 'annex', id: `annex${plan.buildings.length}`, x, z, yaw: h.yaw, w: +aw.toFixed(2), d: +ad.toFixed(2), ground: ag, floorY: ag + 0.08, wall: r.chance(0.6) ? 'stone' : 'plaster', wallColor: h.wallColor, roof: h.roof, seed: r.int(0, 1e6), damaged: r.chance(0.25) });
        }
        h.garden = { gw, gd };
        break;
      }
    }
  }
  // Frontage walls between neighboring detached houses on the same street side.
  for (const a of houses) {
    if (a.core) continue;
    let best = null;
    for (const b of houses) {
      if (a === b || b.street !== a.street) continue;
      // b must be beside a (to its right), roughly in line.
      const c = Math.cos(a.yaw),
        s = Math.sin(a.yaw);
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const lx = c * dx - s * dz,
        lz = s * dx + c * dz;
      if (lx <= 0 || Math.abs(lz) > 4 || Math.abs(Math.cos(a.yaw - b.yaw)) < 0.85) continue;
      const gap = lx - a.w / 2 - b.w / 2;
      if (gap < 1.5 || gap > 14) continue;
      if (!best || lx < best.lx) best = { b, lx, gap };
    }
    if (!best) continue;
    const b = best.b;
    const r = new RNG(a.seed + 7);
    // Wall line slightly behind the house fronts.
    const pA = local(a, a.w / 2 + 0.15, a.d / 2 - 0.4);
    const pB = local(b, -b.w / 2 - 0.15, b.d / 2 - 0.4);
    const kind = r.chance(0.6) ? 'stone' : r.chance(0.5) ? 'low' : 'fence';
    plan.walls.push({ kind, pts: [pA, pB], h: kind === 'stone' ? r.range(1.3, 1.9) : kind === 'low' ? 0.9 : 1.1, gate: best.gap > 3 ? { seg: 0, t: r.range(0.3, 0.7), w: best.gap > 6 ? 2.8 : 1.1 } : null, seed: r.int(0, 1e6) });
  }
}

// ---------------------------------------------------------------------------------------

function planProps(plan, site, rng, local, roads, terrain) {
  const hf = terrain.hf;
  const props = plan.props;
  const pr = new RNG(Math.floor(rng.next() * 2 ** 31));

  // Sandbag emplacements: { kind: 'sandbags', x, z, yaw, shape: 'line'|'u'|'l', len, h }
  const g = plan.gendarmerie;
  if (g) {
    // Two machine-gun nests flanking the front door on the pavement, one at the gate.
    for (const lx of [-5.5, 5.5]) {
      const [x, z] = local(g, lx, g.d / 2 + 2.1);
      props.push({ kind: 'sandbags', x, z, yaw: g.yaw, shape: 'u', len: 2.6, depth: 1.6, h: 1.1 });
    }
    const [x, z] = local(g, g.side * (g.w / 2 + 3.2), g.d / 2 + 2.3);
    props.push({ kind: 'sandbags', x, z, yaw: g.yaw, shape: 'line', len: 3.6, h: 1.2 });
    // Barricade of crates and barrels in the courtyard.
    for (let k = 0; k < 7; k++) {
      const [cx, cz] = local(g, g.side * pr.range(g.w / 2 + 2, g.w / 2 + 12), pr.range(-g.d / 2 - 8, -g.d / 2 + 2));
      props.push({ kind: pr.chance(0.6) ? 'crate' : 'barrel', x: cx, z: cz, yaw: pr.range(0, TAU), stack: pr.chance(0.3) });
    }
    // Wire across the street south of the station.
    const [wx, wz] = local(g, g.side * (g.w / 2 + 16), g.d / 2 + 5.5);
    props.push({ kind: 'wire', x: wx, z: wz, yaw: g.yaw + Math.PI / 2, len: 9 });
  }
  const ch = plan.church;
  if (ch) {
    // Nest on the parvis, one at the churchyard corner, one facing the north road.
    const spots = [
      [3, 7.6, 0, 'u', 3.2],
      [-8.5, -30, Math.PI / 2, 'line', 4],
      [20, -50, Math.PI, 'l', 3.5],
      [12, 7.5, 0, 'line', 3.4],
    ];
    for (const [lx, lz, dy, shape, len] of spots) {
      const [x, z] = local(ch, lx, lz);
      props.push({ kind: 'sandbags', x, z, yaw: ch.yaw + dy, shape, len, depth: 1.8, h: 1.15 });
    }
    // Barbed wire north of the churchyard (toward lines A and B).
    for (const [lx, lz, dy, len] of [[6, -51, 0, 14], [-12, -40, Math.PI / 2, 10]]) {
      const [x, z] = local(ch, lx, lz);
      props.push({ kind: 'wire', x, z, yaw: ch.yaw + dy, len });
    }
  }
  if (plan.square) {
    const sq = plan.square;
    // Cafe terrace: tables and chairs in front of the cafe.
    for (let k = 0; k < 4; k++) {
      const [x, z] = local(ch, 20.5 - (k % 2) * 2.8, 9 + Math.floor(k / 2) * 3 + pr.range(-0.3, 0.3));
      props.push({ kind: 'table', x, z, yaw: pr.range(0, TAU), chairs: pr.int(1, 3) });
    }
    for (let k = 0; k < 3; k++) {
      const [x, z] = local(ch, 23.6, 14 + k * 0.9);
      props.push({ kind: 'barrel', x, z, yaw: pr.range(0, TAU) });
    }
    // Sandbags around the memorial (a fighting position in the square).
    const [mx, mz] = local(ch, sq.memorial.lx - 3.8, sq.memorial.lz + 0.5);
    props.push({ kind: 'sandbags', x: mx, z: mz, yaw: ch.yaw + Math.PI / 2, shape: 'line', len: 3, h: 1.0 });
    // Benches.
    for (const [lx, lz] of [[-4.6, 13.5], [-4.6, 23], [19.2, 15]]) {
      const [x, z] = local(ch, lx, lz);
      if (lz < sq.depth - 2) props.push({ kind: 'bench', x, z, yaw: ch.yaw + (lx < 0 ? Math.PI / 2 : -Math.PI / 2) });
    }
  }
  // Czech hedgehogs and wire blocking the roads at the village entrances.
  const blockRoad = (roadId, hx, hz, count, wire = true) => {
    const road = roads[roadId];
    if (!road) return;
    // Road sample nearest to the hint point.
    const s = road.samples;
    let best = null;
    for (let i = 0; i < s.length; i++) {
      const e = Math.hypot(s[i][0] - hx, s[i][1] - hz);
      if (!best || e < best.e) best = { i, e };
    }
    if (best.e > 30) return;
    const i = best.i;
    const a = s[Math.max(0, i - 2)],
      b = s[Math.min(s.length - 1, i + 2)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / l,
      tz = (b[1] - a[1]) / l;
    const nx = -tz,
      nz = tx;
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * 2.4 + pr.range(-0.3, 0.3);
      const along = pr.range(-1.5, 1.5) + (k % 2) * 2;
      props.push({ kind: 'hedgehog', x: s[i][0] + nx * off + tx * along, z: s[i][1] + nz * off + tz * along, yaw: pr.range(0, TAU) });
    }
    if (wire) props.push({ kind: 'wire', x: s[i][0] - tx * 4, z: s[i][1] - tz * 4, yaw: Math.atan2(nx, nz), len: road.width + 6 });
  };
  blockRoad('main', 168, 2, 4);
  blockRoad('main', 132, 4, 2, false);
  blockRoad('main', -132, 84, 3);
  blockRoad('north', -38, -104, 3);
  blockRoad('south', 73, 166, 2);

  // Telegraph poles along the main road (north side), from the western bridge to the eastern one.
  const main = roads.main;
  if (main) {
    const s = main.samples;
    let acc = 0;
    let last = null;
    for (let i = 1; i < s.length; i++) {
      acc += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      if (acc < 42) continue;
      acc = 0;
      const [x, z] = s[i];
      if (Math.hypot(x, z) > plan.playRadius + 100) continue;
      const a = s[Math.max(0, i - 2)],
        b = s[Math.min(s.length - 1, i + 2)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const tx = (b[0] - a[0]) / l,
        tz = (b[1] - a[1]) / l;
      // Left side when walking east.
      const side = tx >= 0 ? -1 : 1;
      const px = x - tz * side * (main.width / 2 + 2.6),
        pz = z + tx * side * (main.width / 2 + 2.6);
      if (site.riverDist(px, pz) < terrain.river?.half + 6 || site.overlaps(px, pz, 0.6, 0.6, 0, 0)) {
        last = null;
        continue;
      }
      const pole = { x: px, z: pz, yaw: Math.atan2(tx, tz), y: hf.getHeight(px, pz), link: last ? plan.poles.length - 1 : -1 };
      plan.poles.push(pole);
      last = pole;
    }
  }
  // Clutter: crates and barrels by houses, carts in streets.
  for (const b of plan.buildings) {
    if (b.kind !== 'house') continue;
    const r = new RNG(b.seed + 55);
    if (r.chance(0.45)) {
      // By a front corner, out of the way of the door.
      const [x, z] = local(b, (r.chance(0.5) ? 1 : -1) * (b.w / 2 - r.range(0.35, 0.7)), b.d / 2 + 0.65);
      if (site.roadEdgeDist(x, z) > 0.3) props.push({ kind: r.chance(0.5) ? 'barrel' : 'crate', x, z, yaw: b.yaw + r.range(-0.3, 0.3), stack: r.chance(0.25) });
    }
    if (b.damage && r.chance(0.5)) {
      const [x, z] = local(b, (r.chance(0.5) ? 1 : -1) * (b.w / 2 + r.range(0.4, 1.2)), b.d / 2 + 1.0);
      if (site.roadEdgeDist(x, z) > 0) props.push({ kind: 'debris', x, z, yaw: r.range(0, TAU), size: r.range(0.8, 1.4) });
    }
  }
  // A hand cart abandoned in the Grande Rue and a hay cart left at a farm gate.
  {
    const sq = plan.square;
    if (sq && ch) {
      const [x, z] = local(ch, -2, sq.depth - 1.4);
      props.push({ kind: 'cart', x, z, yaw: ch.yaw + 1.3, hay: false });
    }
  }
}

// ---------------------------------------------------------------------------------------
// Walls along the streets where no house fronts the road.
function planStreetWalls(plan, site, rng, roads, V, center) {
  const r = new RNG(Math.floor(rng.next() * 2 ** 31));
  for (const id of ['main', 'north', 'south']) {
    const road = roads[id];
    if (!road) continue;
    const s = road.samples;
    for (const sgn of [1, -1]) {
      let run = [];
      const flush = () => {
        if (run.length >= 5 && r.chance(0.7)) {
          // Split long runs into pieces with gaps (gateways, broken sections).
          let k = 0;
          while (k < run.length - 3) {
            const len = Math.min(run.length - k, r.int(5, 12));
            const pts = run.slice(k, k + len);
            if (pts.length >= 3) {
              const roll = r.next();
              const kind = roll < 0.5 ? 'low' : roll < 0.8 ? 'stone' : 'fence';
              plan.walls.push({ kind, pts, h: kind === 'stone' ? r.range(1.2, 1.6) : kind === 'low' ? 0.9 : 1.1, gate: null, seed: r.int(0, 1e6), street: true });
            }
            k += len + r.int(1, 3);
          }
        }
        run = [];
      };
      for (let i = 0; i < s.length; i += 2) {
        const [x, z] = s[i];
        const dc = Math.hypot(x - center.x, z - center.z);
        if (dc > V.radius + 25 || dc < 25) {
          flush();
          continue;
        }
        const a = s[Math.max(0, i - 2)],
          b = s[Math.min(s.length - 1, i + 2)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = (-(b[1] - a[1]) / l) * sgn,
          nz = ((b[0] - a[0]) / l) * sgn;
        const off = road.width / 2 + 2.1;
        const px = x + nx * off,
          pz = z + nz * off;
        const free = !site.overlaps(px, pz, 1.2, 1.2, 0, 0.6) && site.roadEdgeDist(px, pz, 0.8) > 1.0 && site.riverDist(px, pz) > 20;
        if (free) run.push([px, pz]);
        else flush();
      }
      flush();
    }
  }
}

// Entry boards at the village limits, enamel street plaques, faded painted adverts on
// gable ends facing the street, and the MAIRIE band on the largest house by the square.
function planSigns(plan, site, rng, roads, V, center, local) {
  plan.signs = [];
  const main = roads.main;
  if (main) {
    for (const end of [-1, 1]) {
      const s = main.samples;
      let best = null;
      for (let i = 0; i < s.length; i++) {
        const d = Math.hypot(s[i][0] - center.x, s[i][1] - center.z);
        const side = s[i][0] - center.x;
        if (Math.sign(side) !== end) continue;
        const e = Math.abs(d - (V.radius + 8));
        if (!best || e < best.e) best = { i, e };
      }
      if (!best) continue;
      const i = best.i;
      const a = s[Math.max(0, i - 2)],
        b = s[Math.min(s.length - 1, i + 2)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const tx = (b[0] - a[0]) / l,
        tz = (b[1] - a[1]) / l;
      const side = 1;
      const px = s[i][0] - tz * side * (main.width / 2 + 1.6),
        pz = s[i][1] + tx * side * (main.width / 2 + 1.6);
      // Face traffic arriving from outside the village.
      const fx = end > 0 ? tx : -tx,
        fz = end > 0 ? tz : -tz;
      plan.signs.push({ kind: 'entry', x: px, z: pz, yaw: Math.atan2(fx, fz) });
    }
  }
  const houses = plan.buildings.filter((b) => b.kind === 'house');
  const r = new RNG(Math.floor(rng.next() * 2 ** 31));
  // Street plaques on the front corner of one house per street.
  const plaque = { main: 'streetGrande', north: 'streetMoulin', south: 'streetGare' };
  for (const [street, key] of Object.entries(plaque)) {
    const h = houses.filter((b) => b.street === street).sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z))[0];
    if (h) h.plaque = key;
  }
  // Painted adverts on free gable ends.
  let ads = 0;
  for (const h of houses) {
    if (ads >= 3 || h.damage || h.storeys < 2) continue;
    if (!h.attachedL && r.chance(0.35)) {
      h.ad = { side: -1, key: ads % 2 ? 'ad2' : 'ad1' };
      ads++;
    } else if (!h.attachedR && r.chance(0.35)) {
      h.ad = { side: 1, key: ads % 2 ? 'ad2' : 'ad1' };
      ads++;
    }
  }
  // The mairie: the widest undamaged two-storey house near the square.
  const sq = plan.square;
  if (sq) {
    const [sx, sz] = local(sq.frame, 7, (4.6 + sq.depth) / 2);
    const cand = houses.filter((b) => !b.shop && !b.damage && b.storeys === 2 && b.w >= 9).sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz));
    if (cand[0]) {
      cand[0].mairie = true;
      cand[0].wall = 'plaster';
      cand[0].wallColor = 'white';
      cand[0].quoins = true;
      cand[0].roof = 'slate';
    }
  }
}
