// Vehicles and the things they got stuck on (a player's report: computer
// crews sat behind trees for the rest of the battle). A hull meets a tree or a
// post with its whole outline; a tank can start on a hill; the vehicles' route
// grid gives trees room, takes low walls for walls, lets a boxed-in vehicle
// out, and can close a place for a while; and a tank that has got nowhere for
// a minute is set down on clear ground, out of the players' sight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from './helpers/battle.js';
import { Box, FLAG_SOLID } from '../src/physics/collision.js';
import { NavGrid, VEHICLE_TREE_BERTH } from '../src/ai/navgrid.js';
import { TankBrain } from '../src/ai/tankBot.js';

const g = await makeBattle({ perSide: 1, seed: 5 });
for (const s of g.soldiers) if (s.brain) s.brain.update = () => {};
const hf = g.world.hf;
const coll = g.world.collision;
const driver = g.soldiers.find((s) => s.alive);
const dt = 1 / 60;

function take(v) {
  if (driver.vehicle === v) v.exit(driver);
  v.removeFromWorld();
  g.vehicles.splice(g.vehicles.indexOf(v), 1);
}

// Which way a vehicle put down with this heading faces.
function facing(id, yaw) {
  const v = g.spawnVehicle(id, 600, 600, yaw);
  const f = v.forward;
  take(v);
  return f;
}

// Flat open ground with nothing solid within `clear` meters.
function openGround(clear = 16, slope = 0.04) {
  for (let r = 120; r < 650; r += 17)
    for (let a = 0; a < 6.28; a += 0.13) {
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (hf.getSlope(x, z) > slope || g.world.waterLevelAt?.(x, z) != null) continue;
      const y = hf.getHeight(x, z);
      if (coll.query(x - clear, y - 3, z - clear, x + clear, y + 6, z + clear, [], FLAG_SOLID).length) continue;
      return { x, z, y };
    }
  return null;
}

// How far the post (at px, pz, radius r) is inside the hull's outline (above 0: inside).
function inside(v, px, pz, r) {
  // (The middle of the hull is the body's place less its centre of mass, turned.)
  const o = v.cg.clone().negate().applyQuaternion(v.body.quaternion).add(v.body.position);
  const f = v.forward;
  const dx = px - o.x,
    dz = pz - o.z;
  const lx = dx * f.z - dz * f.x,
    lz = dx * f.x + dz * f.z;
  return Math.min(v.def.dims[0] / 2 - Math.abs(lx), v.def.dims[2] / 2 - Math.abs(lz)) + r;
}

test('a thin post meets the whole outline of a hull: it does not get in at the middle of a tank or a jeep', () => {
  const at = openGround();
  assert.ok(at, 'open ground on the map');
  // A post as thin as a village tree or a telegraph pole, 4 m tall.
  const post = coll.add(new Box(at.x, at.y + 2, at.z, 0.25, 2, 0.25, 0, 'wood', FLAG_SOLID));
  try {
    for (const id of ['m4a1_sherman', 'willys_mb']) {
      for (const off of [0, 0.3]) {
        const f = facing(id, 0);
        const v = g.spawnVehicle(id, at.x - f.x * 9 + f.z * off, at.z - f.z * 9 - f.x * off, 0);
        v.enter(driver, 0);
        let worst = -9;
        for (let i = 0; i < 60 * 9; i++) {
          v.driverInput(0.7, 0);
          g.update(dt);
          worst = Math.max(worst, inside(v, at.x, at.z, 0.25));
        }
        assert.ok(worst < 0.15, `${id}, ${off} m off its middle: the post got ${worst.toFixed(2)} m inside the hull`);
        // Up against it, not past it; and it backs away freely.
        const d0 = Math.hypot(v.body.position.x - at.x, v.body.position.z - at.z);
        assert.ok(d0 < v.def.dims[2] / 2 + 1.2, `${id} reached the post (${d0.toFixed(1)} m from it)`);
        for (let i = 0; i < 60 * 5; i++) {
          v.driverInput(-0.7, 0);
          g.update(dt);
        }
        assert.ok(Math.hypot(v.body.position.x - at.x, v.body.position.z - at.z) > d0 + 1.5, `${id} backed off it`);
        take(v);
      }
    }
  } finally {
    coll.remove ? coll.remove(post) : (post.enabled = false);
  }
});

test('a real tree: a Sherman driven at its middle stops against the bark', () => {
  const all = coll.query(-700, -50, -700, 700, 200, 700, [], FLAG_SOLID);
  let tree = null;
  for (const b of all) {
    if (!b.trunk || b.trunk.r < 0.2 || b.trunk.r > 0.6) continue;
    const { x, z } = b.trunk;
    const y = hf.getHeight(x, z);
    if (Math.abs(b.minY - y) > 1.2 || hf.getSlope(x, z) > 0.05 || g.world.waterLevelAt?.(x, z) != null) continue;
    if (coll.query(x - 14, y, z - 14, x + 14, y + 3, z + 14, [], FLAG_SOLID).some((o) => Math.hypot((o.trunk?.x ?? o.cx) - x, (o.trunk?.z ?? o.cz) - z) > 0.6)) continue;
    tree = b.trunk;
    break;
  }
  assert.ok(tree, 'a tree standing alone on the map');
  const f = facing('m4a1_sherman', 0);
  const v = g.spawnVehicle('m4a1_sherman', tree.x - f.x * 9, tree.z - f.z * 9, 0);
  v.enter(driver, 0);
  let worst = -9;
  for (let i = 0; i < 60 * 10; i++) {
    v.driverInput(0.7, 0);
    g.update(dt);
    worst = Math.max(worst, inside(v, tree.x, tree.z, tree.r));
  }
  // (Its trunk leans a little, so a few centimetres either way.)
  assert.ok(worst < 0.2, `the trunk got ${worst.toFixed(2)} m inside the hull (it used to go 1.4 m in)`);
  take(v);
});

test('a tank stopped on a hill gets going again at part throttle (down to its crawler gear)', () => {
  // A slope of about one in six, open for 20 m uphill.
  let sp = null;
  for (let r = 100; r < 650 && !sp; r += 13)
    for (let a = 0; a < 6.28 && !sp; a += 0.11) {
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (Math.abs(hf.getSlope(x, z) - 0.18) > 0.015 || g.world.waterLevelAt?.(x, z) != null) continue;
      let best = null;
      for (let h = 0; h < 6.28; h += 0.2) {
        const rise = hf.getHeight(x + Math.sin(h) * 12, z + Math.cos(h) * 12) - hf.getHeight(x, z);
        if (!best || rise > best.rise) best = { h, rise };
      }
      if (best.rise < 0.18 * 12 * 0.8 || best.rise > 0.18 * 12 * 1.25) continue;
      if (coll.query(x - 16, hf.getHeight(x, z) - 3, z - 16, x + 16, hf.getHeight(x, z) + 6, z + 16, [], FLAG_SOLID).length) continue;
      sp = { x, z, yaw: Math.atan2(-Math.sin(best.h), -Math.cos(best.h)) };
    }
  assert.ok(sp, 'a slope of one in six on the map');
  for (const [id, thr] of [
    ['m4a1_sherman', 0.7],
    ['m4a1_sherman', 1],
    ['panzer4_h', 1],
  ]) {
    const v = g.spawnVehicle(id, sp.x, sp.z, sp.yaw);
    v.enter(driver, 0);
    for (let i = 0; i < 90; i++) {
      v.driverInput(0, 0);
      g.update(dt);
    }
    const p0 = v.body.position.clone();
    for (let i = 0; i < 60 * 8; i++) {
      v.driverInput(thr, 0);
      g.update(dt);
    }
    const moved = v.body.position.distanceTo(p0);
    assert.ok(moved > 3.5, `${id} at throttle ${thr}: ${moved.toFixed(1)} m up the hill in 8 s`);
    take(v);
  }
});

test("the vehicles' grid: room round trees, low walls in the way, a way out of a pocket, a place closed for a while", () => {
  const at = openGround(30);
  assert.ok(at);
  const R = 40;
  const added = [];
  const add = (b, mark = {}) => added.push(Object.assign(coll.add(b), mark));
  try {
    // A "tree" (as thin as a trunk), and 12 m east of it a wall 0.7 m high.
    // (The tree on the middle of a cell, so the wider berth takes in the cells next to it.)
    const tx = at.x + 1,
      tz = at.z + 1;
    add(new Box(tx, at.y + 2, tz, 0.3, 2, 0.3, 0, 'wood', FLAG_SOLID), { tree: true });
    add(new Box(at.x + 12, at.y + 0.35, at.z, 0.2, 0.35, 4, 0, 'stone', FLAG_SOLID));
    const grid = (opts) => {
      const nav = new NavGrid(g.world, { radius: R, centerX: at.x, centerZ: at.z });
      nav.build({ doors: [], agentRadius: 1.6, maxSlopeDeg: 28, ...opts });
      return nav;
    };
    const blockedRound = (nav, x, z, r) => {
      let n = 0;
      for (let i = 0; i < nav.cost.length; i++) if (!nav.cost[i] && Math.hypot(nav.cellX(i) - x, nav.cellZ(i) - z) < r) n++;
      return n;
    };
    const plain = grid({});
    const wide = grid({ treeRadius: VEHICLE_TREE_BERTH, minHeight: 0.5, startHop: 14 });
    assert.ok(blockedRound(wide, tx, tz, 4) > blockedRound(plain, tx, tz, 4), `more room round the tree (${blockedRound(wide, tx, tz, 4)} cells closed against ${blockedRound(plain, tx, tz, 4)})`);
    assert.equal(blockedRound(plain, at.x + 12, at.z, 2.5), 0, 'a 0.7 m wall is nothing to the grid for men');
    assert.ok(blockedRound(wide, at.x + 12, at.z, 2.5) > 0, 'and a wall to the grid for vehicles');

    // Standing right against the wall's west face (where the grid lets
    // nobody be), a route begins on that side of it, not through it.
    const sx = at.x + 12 - 0.9,
      sz = at.z;
    assert.equal(wide.walkable(sx, sz), false);
    const start = wide._startCell(sx, sz);
    assert.ok(wide.cellX(start) < at.x + 12, 'the route starts on the side he is on');
    const east = wide._startCell(at.x + 12 + 0.9, sz);
    assert.ok(wide.cellX(east) > at.x + 12);

    // A place closed for a while: routes go round it, and it opens again.
    const cx = at.x - 14,
      cz = at.z - 14;
    assert.equal(wide.walkable(cx, cz), true);
    wide.closeFor(cx, cz, 2.5, 60, 100);
    assert.equal(wide.walkable(cx, cz), false);
    const route = wide.findPath(cx - 10, cz, cx + 10, cz, 50000);
    assert.ok(route && route.every((p) => Math.hypot(p.x - cx, p.z - cz) > 1.5), 'the route goes round the closed place');
    wide.tick(130);
    assert.equal(wide.walkable(cx, cz), false, 'still closed at 30 s');
    wide.tick(161);
    assert.equal(wide.walkable(cx, cz), true, 'open again after its minute');

    // In a pocket cut off from the rest, a vehicle's route begins from the
    // nearest ground that does join up; a man's does not (his pockets have walls).
    let pocket = -1;
    const nav = g.vnav;
    for (let i = 0; i < nav.comp.length && pocket < 0; i++) if (nav.cost[i] && nav.compSize[nav.comp[i]] < 12 && nav._nearestOf(nav.cellX(i), nav.cellZ(i), nav.comp[nav.nearestWalkable(100, 500)], 5) >= 0) pocket = i;
    assert.ok(pocket >= 0, 'a small pocket near open ground on the map');
    assert.ok(nav.findPath(nav.cellX(pocket), nav.cellZ(pocket), 100, 500, 200000), 'a way out of it for a vehicle');
  } finally {
    for (const b of added) coll.remove ? coll.remove(b) : (b.enabled = false);
  }
});

test('a computer tank that has got nowhere for a minute is set down on clear ground, but not in front of a player', () => {
  const at = openGround(20);
  const v = g.spawnVehicle('m4a1_sherman', at.x, at.z, 0);
  const s = g.soldiers.find((x) => x.alive && x !== driver) || driver;
  if (s.vehicle) s.vehicle.exit(s);
  v.enter(s, 0);
  const brain = new TankBrain(g, s, v);
  brain.goal = g.mode.points[0];
  brain.holding = false;
  brain.target = null;
  const here = () => ({ x: v.body.position.x, z: v.body.position.z });
  const p0 = here();
  // A player close by: it stays where it is, however long.
  const watcher = g.soldiers.find((x) => x.alive && x !== s);
  const was = { remote: watcher.remote, x: watcher.body.x, z: watcher.body.z };
  watcher.remote = true;
  watcher.body.x = at.x + 30;
  watcher.body.z = at.z;
  for (let t = 0; t < 70; t += 0.5) brain._stranded(0.5);
  assert.ok(Math.hypot(here().x - p0.x, here().z - p0.z) < 0.5, 'not moved while a player is near');
  // Nobody near: set down a little way off, on ground a vehicle may stand on.
  watcher.body.x = at.x + 400;
  for (let t = 0; t < 10; t += 0.5) brain._stranded(0.5);
  const moved = Math.hypot(here().x - p0.x, here().z - p0.z);
  assert.ok(moved > 6 && moved < 80, `set down ${moved.toFixed(0)} m away`);
  assert.ok(g.vnav.inMainArea(here().x, here().z), 'on open ground');
  // Holding by its point, or with someone to fire at, it is never moved.
  const p1 = here();
  brain.goal = g.mode.points[0];
  brain.holding = true;
  for (let t = 0; t < 90; t += 0.5) brain._stranded(0.5);
  assert.ok(Math.hypot(here().x - p1.x, here().z - p1.z) < 0.5, 'not moved while it holds its place');
  Object.assign(watcher, { remote: was.remote });
  watcher.body.x = was.x;
  watcher.body.z = was.z;
  v.exit(s);
  take(v);
});
