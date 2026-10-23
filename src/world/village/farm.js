// Farms on the village edge: a farmhouse, a big barn (stone base, vertical plank
// walls, large double doors, hay loft), an open-fronted shed, a yard closed by a stone
// wall with a gate, a well, a hay cart, hay bales and a haystack.
//
// Local frame: origin at the yard center on the ground, +z toward the road.
import * as THREE from 'three';
import { RNG } from '../../core/math.js';
import { FLAG_DEFAULT, FLAG_SOLID, FLAG_BULLET, FLAG_SIGHT } from '../../physics/collision.js';
import { mat4 } from './geom.js';
import { WOOD, rgb, scale } from './materials.js';
import { gableRoof, gableWall, rubblePile, rampCollider } from './parts.js';
import { makeHouse } from './plan.js';
import { buildHouse } from './house.js';

const TAU = Math.PI * 2;

export function buildFarm(B, farm, ctx) {
  const r = new RNG(farm.seed);
  const g = farm.ground;
  const f = B.frame(farm.x, g, farm.z, farm.yaw, { tag: 'farm' });
  const world = (lx, lz) => f.toWorld(lx, 0, lz);
  const spawn = [];

  // Farmhouse at the back of the yard, facing it.
  {
    const [x, , z] = world(r.range(-2, 2), -12.5);
    const h = makeHouse(r, { x, z, yaw: farm.yaw, w: r.range(11, 13), d: r.range(7.6, 8.6), storeys: 2, core: false, damageChance: 0.35 });
    h.ground = g;
    h.floorY = g + 0.25;
    h.attachedL = h.attachedR = false;
    buildHouse(B, h, ctx);
  }
  // Barn on one side, its long wall (with the doors) facing the yard.
  const bs = farm.barnSide ?? 1;
  {
    const bf = f.sub(bs * 11.8, 0, -1.5, bs * (Math.PI / 2) * -1);
    barn(bf, r, { W: 16, D: 10, eaves: 5.4 });
  }
  // Open shed on the other side.
  {
    const sf = f.sub(-bs * 12.5, 0, -2, bs * (Math.PI / 2));
    shed(sf, r);
  }
  // Yard wall along the front with a gate, and side walls to the buildings.
  {
    const H = 1.6,
      T = 0.45;
    const zf = 13.5;
    const col = rgb(0.95, 0.93, 0.88);
    const wf = f.wall(-16.8, zf, 16.8, zf, { thick: T, base: -0.4, height: H + 0.4, mat: 'stone', inner: 'stone', col: 'stone', color: col });
    const gu = 16.8 + r.range(-3, 3);
    wf.hole(gu - 2.1, gu + 2.1, -1, 9);
    wf.build({ groundV: 0.3 });
    for (const [a, b] of [[0, gu - 2.1], [gu + 2.1, wf.len]]) {
      wf.box('ashlar', a, H + 0.4, -T / 2 - 0.05, b, H + 0.5, T / 2 + 0.05, { color: rgb(0.9, 0.88, 0.84) });
      for (let u = a + 1; u < b - 0.6; u += 3.4) {
        for (const side of [-1, 1]) {
          const p = wf.p(u, 0, side * (T / 2 + 0.45));
          f.cover(p[0], 0, p[2], -side * wf.nx, -side * wf.nz, 'low');
        }
      }
    }
    for (const e of [-1, 1]) {
      const u = gu + e * 2.1 + (e > 0 ? 0.3 : -0.3);
      wf.box('ashlar', u - 0.3, 0, -0.35, u + 0.3, H + 0.9, 0.35, { color: col, col: 'stone' });
    }
    // Gate leaf (one open, one fallen).
    wf.obox('wood', gu - 2.1 + 1.0, 0.4 + 0.75, T / 2 + 0.9, 1.0, 0.75, 0.04, { rot: { yaw: -1.25 }, color: WOOD.weathered, uv: 'box' });
    wf.obox('wood', gu + 1.0, 0.4 + 0.06, 1.6, 1.0, 0.04, 0.75, { rot: { yaw: 0.3 }, color: WOOD.weathered, uv: 'box' });
    const pg = wf.p(gu, 0, 0);
    f.door(pg[0], pg[2], 4.2, wf.yaw, { kind: 'gate' });
    // Side walls from the front corners back to the barn/shed.
    for (const sx of [-1, 1]) {
      // On the barn side the barn's back wall closes the yard; the wall only runs to its corner.
      const z0 = sx === bs ? 6.5 : -6.5;
      const ws = f.wall(sx * 16.8, zf, sx * 16.8, z0, { thick: T, base: -0.4, height: H + 0.4, mat: 'stone', inner: 'stone', col: 'stone', color: col });
      ws.build({ groundV: 0.3 });
      ws.box('ashlar', 0, H + 0.4, -T / 2 - 0.05, ws.len, H + 0.5, T / 2 + 0.05, { color: rgb(0.9, 0.88, 0.84) });
    }
  }
  // Well.
  {
    const wx = r.range(-4, 4),
      wz = r.range(2, 6);
    f.geometry('stone', new THREE.CylinderGeometry(0.85, 0.9, 0.85, 12, 1, true), mat4(wx, 0.35, wz), { color: rgb(0.95, 0.93, 0.88) });
    f.geometry('stone', new THREE.CylinderGeometry(0.6, 0.6, 0.85, 12, 1, true), mat4(wx, 0.35, wz, 0, Math.PI, 0), { color: rgb(0.7, 0.68, 0.64) });
    f.geometry('ashlar', new THREE.RingGeometry(0.6, 0.92, 12), mat4(wx, 0.78, wz, 0, -Math.PI / 2), { color: rgb(0.9, 0.88, 0.84) });
    f.geometry('water', new THREE.CircleGeometry(0.6, 12), mat4(wx, -0.2, wz, 0, -Math.PI / 2), {});
    for (const sx of [-1, 1]) f.box('wood', wx + sx * 0.75 - 0.06, 0.6, wz - 0.06, wx + sx * 0.75 + 0.06, 2.3, wz + 0.06, { color: WOOD.weathered });
    f.box('wood', wx - 0.85, 1.6, wz - 0.04, wx + 0.85, 1.68, wz + 0.04, { color: WOOD.dark });
    for (const sz of [-1, 1]) f.obox('tiles', wx, 2.45, wz + sz * 0.42, 1.0, 0.04, 0.55, { rot: { pitch: sz * 0.6 }, uv: 'box' });
    f.collider(wx, 0.4, wz, 0.9, 0.4, 0.9, null, 'stone', FLAG_DEFAULT, true);
    f.cover(wx, 0, wz + 1.4, 0, -1, 'low');
    f.cover(wx, 0, wz - 1.4, 0, 1, 'low');
  }
  // Hay cart, bales, haystack, manure heap, trough.
  {
    const props = [];
    const [cx, , cz] = world(-bs * r.range(3, 6), r.range(-4, 2));
    props.push({ kind: 'haycart', x: cx, z: cz, yaw: farm.yaw + r.range(-1, 1) });
    for (let k = 0; k < 6; k++) {
      const [bx, , bz] = world(bs * (6.8 + (k % 3) * 1.0), 6 + Math.floor(k / 3) * 0.6);
      props.push({ kind: 'bale', x: bx, z: bz, yaw: farm.yaw + Math.PI / 2 + r.range(-0.1, 0.1), stack: k < 3 && r.chance(0.6) });
    }
    ctx.extraProps.push(...props);
    // Haystack (meule) beside the barn.
    const hs = f.sub(bs * 7.5, 0, 9.5, 0);
    hs.geometry('hay', new THREE.SphereGeometry(1, 12, 7, 0, TAU, 0, Math.PI / 2), mat4(0, 0, 0, 0, 0, 0, 2.2, 3.0, 2.2), {});
    hs.geometry('hay', new THREE.CylinderGeometry(2.2, 2.0, 1.2, 12, 1, true), mat4(0, -0.55, 0), {});
    hs.collider(0, 1.2, 0, 1.6, 1.4, 1.6, null, 'foliage', FLAG_SOLID | FLAG_BULLET | FLAG_SIGHT, true);
    f.cover(bs * 7.5 - 2.6, 0, 9.5, 1, 0, 'high');
    // Manure heap.
    rubblePile(f, -bs * 7, 0, -6.5, 1.8, 1.3, 0.8, { seed: r.int(0, 1e6), color: rgb(0.45, 0.35, 0.25), palette: ['hay'], blocks: 6 });
  }
  spawn.push(world(0, 0));
  return f;
}

// Barn: stone base, plank walls on a timber frame, big doors on the front (+z) wall.
function barn(f, r, { W, D, eaves }) {
  const base = -0.5;
  const sb = 1.3; // stone base height
  const stoneCol = rgb(0.95, 0.93, 0.88);
  const plankCol = r.chance(0.5) ? WOOD.weathered : rgb(0.75, 0.68, 0.6);
  const t = 0.5;
  const walls = {
    front: f.wall(-W / 2, D / 2 - t / 2, W / 2, D / 2 - t / 2, { thick: t, base, height: sb - base, mat: 'stone', inner: 'stone', col: 'stone', color: stoneCol }),
    back: f.wall(W / 2, -D / 2 + t / 2, -W / 2, -D / 2 + t / 2, { thick: t, base, height: sb - base, mat: 'stone', inner: 'stone', col: 'stone', color: stoneCol }),
    right: f.wall(W / 2 - t / 2, D / 2 - t, W / 2 - t / 2, -D / 2 + t, { thick: t, base, height: sb - base, mat: 'stone', inner: 'stone', col: 'stone', color: stoneCol }),
    left: f.wall(-W / 2 + t / 2, -D / 2 + t, -W / 2 + t / 2, D / 2 - t, { thick: t, base, height: sb - base, mat: 'stone', inner: 'stone', col: 'stone', color: stoneCol }),
  };
  const doorW = 4.2,
    doorH = 4.3;
  walls.front.hole(W / 2 - doorW / 2, W / 2 + doorW / 2, -1, 9);
  walls.back.hole(W / 2 - 0.6, W / 2 + 0.6, -1, 9);
  for (const w of Object.values(walls)) w.build({ groundV: 0.3 });
  // Plank walls above the base, on the outer line, with the door opening.
  const pt = 0.06;
  const plank = (x0, z0, x1, z1, holes = []) => {
    const w = f.wall(x0, z0, x1, z1, { thick: pt, base: sb, height: eaves - sb, mat: 'wood', inner: 'wood', col: 'plank', color: plankCol });
    for (const h of holes) w.hole(h[0], h[1], h[2] - sb, h[3] - sb);
    w.build({});
    return w;
  };
  plank(-W / 2, D / 2 - pt / 2, W / 2, D / 2 - pt / 2, [[W / 2 - doorW / 2, W / 2 + doorW / 2, sb - 0.1, doorH]]);
  plank(W / 2, -D / 2 + pt / 2, -W / 2, -D / 2 + pt / 2, [[W / 2 - 0.6, W / 2 + 0.6, sb - 0.1, 2.3], [3, 4.2, 3.4, 4.3]]);
  plank(W / 2 - pt / 2, D / 2 - pt, W / 2 - pt / 2, -D / 2 + pt, [[D / 2 - 0.8, D / 2 + 0.6, 3.0, 4.4]]);
  plank(-W / 2 + pt / 2, -D / 2 + pt, -W / 2 + pt / 2, D / 2 - pt, []);
  // Door frame and leaves (one swung open, one ajar).
  const frameCol = WOOD.dark;
  f.box('wood', -doorW / 2 - 0.2, 0, D / 2 - 0.25, -doorW / 2, doorH + 0.2, D / 2 + 0.05, { color: frameCol, col: 'wood' });
  f.box('wood', doorW / 2, 0, D / 2 - 0.25, doorW / 2 + 0.2, doorH + 0.2, D / 2 + 0.05, { color: frameCol, col: 'wood' });
  f.box('wood', -doorW / 2 - 0.2, doorH, D / 2 - 0.25, doorW / 2 + 0.2, doorH + 0.25, D / 2 + 0.05, { color: frameCol });
  const lw = doorW / 2;
  const a1 = r.range(1.6, 2.2),
    a2 = r.range(0.3, 0.9);
  f.obox('wood', -doorW / 2 + (lw / 2) * Math.cos(a1), doorH / 2, D / 2 + 0.1 + (lw / 2) * Math.sin(a1), lw / 2, doorH / 2, 0.05, { rot: { yaw: -a1 }, color: scale(plankCol, 0.9), uv: 'box' });
  f.obox('wood', doorW / 2 - (lw / 2) * Math.cos(a2), doorH / 2, D / 2 + 0.1 + (lw / 2) * Math.sin(a2), lw / 2, doorH / 2, 0.05, { rot: { yaw: a2 }, color: scale(plankCol, 0.9), uv: 'box', col: 'plank', colFlags: FLAG_DEFAULT });
  f.door(0, D / 2, doorW, 0, { kind: 'barn' });
  f.door(0, -D / 2, 1.2, Math.PI, { kind: 'door' });
  // Timber posts at corners and along the walls.
  for (const x of [-W / 2 + 0.12, -W / 4, W / 4, W / 2 - 0.12])
    for (const z of [-D / 2 + 0.12, D / 2 - 0.12]) {
      if (Math.abs(x) < doorW / 2 + 0.3 && z > 0) continue;
      f.box('wood', x - 0.12, 0, z - 0.12, x + 0.12, eaves, z + 0.12, { color: WOOD.dark, col: 'wood' });
    }
  // Earth floor and hay loft over the back half.
  f.box('rubble', -W / 2 + t, -0.2, -D / 2 + t, W / 2 - t, 0.02, D / 2 - t, { color: rgb(0.55, 0.45, 0.35), col: 'stone', nav: false });
  const loftY = 3.2;
  f.box('wood', -W / 2 + 0.1, loftY - 0.15, -D / 2 + 0.1, W / 2 - 0.1, loftY, -0.6, { color: plankCol, col: 'wood', nav: false });
  for (const x of [-W / 3, 0, W / 3]) f.box('wood', x - 0.12, 0, -0.85, x + 0.12, loftY, -0.6, { color: WOOD.dark, col: 'wood' });
  // Hay on the loft and on the floor.
  f.geometry('hay', new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI / 2), mat4(-2, loftY, -2.8, 0, 0, 0, 5.2, 1.4, 1.8), {});
  f.geometry('hay', new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI / 2), mat4(-4.5, 0, 2.2, 0, 0, 0, 1.8, 0.9, 1.4), {});
  f.collider(-4.5, 0.3, 2.2, 1.2, 0.3, 0.9, null, 'foliage', FLAG_SOLID, false);
  // Stacked hay bales make steps up to the loft; a ramp collider (33 degrees) runs
  // over their nosings so people can climb them.
  for (let k = 0; k < 8; k++) {
    const y = Math.min(loftY, 0.4 * (k + 1));
    const z1 = 4.2 - 0.6 * k,
      z0 = z1 - 0.6;
    f.box('hay', 4.2, 0, z0, 5.4, y, z1);
  }
  rampCollider(f, 4.8, 0.02, 4.2, 4.8, loftY, -0.6, 1.2, 0.2, 'wood');
  // Roof and plank gables.
  const roof = gableRoof(f, { x0: -W / 2, x1: W / 2, d: D, eaves, pitch: (42 * Math.PI) / 180, ov: 0.5, gvL: 0.35, gvR: 0.35, mat: r.chance(0.7) ? 'tiles' : 'slate', color: rgb(0.88, 0.8, 0.74), T: 0.15 });
  for (const sx of [-1, 1]) gableWall(f, sx * (W / 2), sx * (W / 2 - pt), D, eaves, roof.yR, { mat: 'wood', color: plankCol, inner: 'wood', colMat: 'plank' });
  // Cover beside the doors.
  for (const sx of [-1, 1]) f.cover(sx * (doorW / 2 + 0.6), 0, D / 2 + 0.6, 0, -1, 'high');
}

// Open-fronted lean-to shed with a stone back wall and posts in front.
function shed(f, r) {
  const W = 9,
    D = 5;
  const backH = 3.2,
    frontH = 2.3;
  const col = rgb(0.93, 0.9, 0.85);
  const t = 0.45;
  const wb = f.wall(W / 2, -D / 2 + t / 2, -W / 2, -D / 2 + t / 2, { thick: t, base: -0.4, height: backH + 0.4, mat: 'stone', inner: 'stone', col: 'stone', color: col });
  wb.build({ groundV: 0.3 });
  for (const sx of [-1, 1]) {
    const ws = f.wall(sx * (W / 2 - t / 2), sx > 0 ? D / 2 : -D / 2 + t, sx * (W / 2 - t / 2), sx > 0 ? -D / 2 + t : D / 2, { thick: t, base: -0.4, height: frontH + 0.4, mat: 'stone', inner: 'stone', col: 'stone', color: col });
    ws.build({ groundV: 0.3 });
  }
  for (const x of [-W / 2 + 0.3, 0, W / 2 - 0.3]) f.box('wood', x - 0.1, 0, D / 2 - 0.25, x + 0.1, frontH, D / 2 - 0.05, { color: WOOD.dark, col: 'wood' });
  f.box('wood', -W / 2, frontH - 0.2, D / 2 - 0.28, W / 2, frontH, D / 2 - 0.02, { color: WOOD.dark });
  // Mono-pitch roof.
  const rise = backH - frontH;
  const L = Math.hypot(D + 0.6, rise);
  const pitch = Math.atan2(rise, D + 0.6);
  f.obox('tiles', 0, (backH + frontH) / 2 + 0.12, 0.05, W / 2 + 0.3, 0.07, L / 2, { rot: { pitch }, uv: 'box', faces: { ny: 'wood' }, col: 'roofTile', colThick: 0.04, nav: false, color: rgb(0.9, 0.82, 0.76) });
  // Firewood stack and a cart wheel against the wall.
  f.box('wood', -W / 2 + 0.6, 0, -D / 2 + 0.5, -W / 2 + 3.2, 1.3, -D / 2 + 1.3, { color: rgb(0.7, 0.55, 0.4), col: 'wood' });
  f.geometry('wood', new THREE.CylinderGeometry(0.6, 0.6, 0.07, 14, 1, true), mat4(2.5, 0.62, -D / 2 + 0.55, 0, Math.PI / 2, 0.15), { color: WOOD.weathered });
  f.cover(0, 0, D / 2 + 0.6, 0, -1, 'high');
}
