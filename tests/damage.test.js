// How damage shows on vehicles: the stage for the health left, engine smoke by
// stage and where it comes from, paint scorched on the vehicle's own materials
// (never on those it shares with others of its type), the charred wreck, and
// the marks hits leave on the part they struck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, spawn } from './helpers/vehicleWorld.js';
import { VEHICLES } from '../src/vehicles/defs.js';
import { TrackedVehicle } from '../src/vehicles/tracked.js';
import { WheeledVehicle } from '../src/vehicles/wheeled.js';
import { healthStage, damageStage, updateVehicleEffects, charModel, addHitMark, markCount, MARK_CAP, DAMAGE_STAGES } from '../src/vehicles/effects.js';

// A stand-in for the game's particles that keeps what was asked for.
function recorder() {
  const list = [];
  return { list, q: { count: 1 }, spawn: (kind, x, y, z, o = {}) => list.push({ kind, x, y, z, ...o }), flashLight() {} };
}

// A box-shaped vehicle whose armor boxes are its own meshes: a hull (in the
// hull's group) and, for a tank, a turret; the engine where `engineZ` says.
function boxModel(def, mat, { turret = true, engineZ = 0.3 } = {}) {
  const [W, H, L] = def.dims;
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  const hullC = [0, H * 0.35, 0],
    hullH = [W / 2, H * 0.2, L / 2];
  body.add(new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.4, L).translate(...hullC), mat));
  const parts = { body };
  const armor = [{ name: 'hull', part: 'body', center: hullC, half: hullH, mm: 20 }];
  if (turret) {
    const pivot = [0, H * 0.55, 0];
    const t = new THREE.Group();
    t.name = 'turret';
    t.position.set(...pivot);
    root.add(t);
    parts.turret = t;
    const c = [0, H * 0.7, -0.2],
      h = [W * 0.3, H * 0.15, W * 0.35];
    t.add(new THREE.Mesh(new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2).translate(c[0] - pivot[0], c[1] - pivot[1], c[2] - pivot[2]), mat));
    armor.push({ name: 'turret', part: 'turret', center: c, half: h, mm: 50 });
  }
  const modules = [{ name: 'engine', part: 'body', center: [0, H * 0.35, L * engineZ], half: [W * 0.3, H * 0.15, L * 0.12] }];
  return { root, parts, anchors: {}, meta: { armor, modules } };
}

function boxTank(game, mat = new THREE.MeshStandardMaterial({ name: 'paintTest' }), x = 0, z = 0, yaw = 0) {
  const def = { ...VEHICLES.m4a1_sherman, id: 'm4a1_sherman' };
  const v = new TrackedVehicle(game, def, boxModel(def, mat), x, z, yaw);
  v.syncModel(0);
  return v;
}

// Fire at a vehicle through its armor, as the game's rounds strike it.
function strike(v, from, to, kind, ammo) {
  const o = new THREE.Vector3(...from);
  const d = new THREE.Vector3(...to).sub(o).normalize();
  const h = v.raycastArmor(o.x, o.y, o.z, d.x, d.y, d.z, 200);
  if (!h) return null;
  addHitMark(v, { kind, x: o.x + d.x * h.t, y: o.y + d.y * h.t, z: o.z + d.z * h.t, nx: h.nx, ny: h.ny, nz: h.nz, dirX: d.x, dirY: d.y, dirZ: d.z, plate: h.plate }, ammo);
  return h.plate;
}

const AP = { diameter: 0.075, filler: 0.02 };
const HE = { diameter: 0.075, explosive: { blast: 0.67 } };
const BULLET = { diameter: 0.00782 };

function marksOn(v, part) {
  return [...v._dmg.marks.values()].filter((s) => s.mesh.parent === part);
}

test('damage stages follow the health left: wisps from 60 %, darker smoke from 35 %, almost broken from 15 %', () => {
  assert.deepEqual(DAMAGE_STAGES, [0.6, 0.35, 0.15]);
  const cases = [
    [1, 0],
    [0.61, 0],
    [0.6, 1],
    [0.4, 1],
    [0.35, 2],
    [0.2, 2],
    [0.15, 3],
    [0.02, 3],
    [0, 4],
  ];
  for (const [frac, stage] of cases) assert.equal(healthStage(frac), stage, `health ${frac}`);
});

test('a hit engine smokes whatever the health; bicycles have no engine to smoke', () => {
  const { game } = makeWorld();
  const v = spawn(game, 'willys_mb', 0, 0, 0, { empty: true });
  assert.equal(damageStage(v), 0);
  v.modules.engine = 0.5;
  assert.equal(damageStage(v), 1, 'a damaged engine: thin smoke');
  v.modules.engine = 0;
  assert.equal(damageStage(v), 2, 'a dead engine: steady smoke');
  v.hp = v.maxHp * 0.1;
  assert.equal(damageStage(v), 3, 'almost destroyed');
  v.destroy(null, 'test');
  assert.equal(damageStage(v), 4);
  const b = spawn(game, 'bicycle', 10, 0, 0, { empty: true });
  b.modules.engine = 0;
  assert.equal(damageStage(b), 0);
});

test('engine smoke by stage: none when sound, grey wisps, then darker, then thick black smoke with flames and sparks', () => {
  const { game } = makeWorld();
  const fx = recorder();
  game.effects = fx;
  const v = boxTank(game);
  const runAt = (frac) => {
    v.hp = v.maxHp * frac;
    fx.list.length = 0;
    for (let t = 0; t < 4; t += 1 / 30) updateVehicleEffects(game, v, 1 / 30);
    const smoke = fx.list.filter((p) => p.kind === 'smoke');
    return {
      smoke,
      shade: smoke.reduce((a, p) => a + p.color[0], 0) / Math.max(1, smoke.length),
      size: smoke.reduce((a, p) => a + p.scale, 0) / Math.max(1, smoke.length),
      fire: fx.list.filter((p) => p.kind === 'fire').length,
      sparks: fx.list.filter((p) => p.kind === 'spark').length,
    };
  };
  const sound = runAt(1),
    hurt = runAt(0.5),
    bad = runAt(0.3),
    almost = runAt(0.1);
  assert.equal(sound.smoke.length, 0, 'a sound vehicle does not smoke');
  assert.ok(hurt.smoke.length > 0 && hurt.shade > 0.35, `grey wisps (${hurt.smoke.length}, shade ${hurt.shade})`);
  assert.ok(bad.smoke.length > hurt.smoke.length && bad.shade < hurt.shade && bad.size > hurt.size, 'more, darker and bigger');
  assert.ok(almost.smoke.length > bad.smoke.length && almost.shade < 0.1 && almost.size > bad.size, `thick black smoke (shade ${almost.shade})`);
  assert.equal(hurt.fire + bad.fire + hurt.sparks + bad.sparks, 0, 'no flames or sparks before it is almost broken');
  assert.ok(almost.fire > 0 && almost.sparks > 0, 'flames and sparks when almost broken');
  // Modest numbers: a few puffs a second even at the worst.
  assert.ok(almost.smoke.length < 4 * 10, `${almost.smoke.length} puffs in 4 s`);
  // From the engine: the tank's is at the back, under the deck.
  for (const p of almost.smoke) {
    const m = v.worldToModel(new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3());
    assert.ok(m.z > 0.5 && m.y > v.def.dims[1] * 0.5, `smoke at ${m.toArray().map((x) => x.toFixed(2))}`);
  }
});

test('engine smoke comes from where the engine is: a jeep bonnet at the front; bicycles never smoke', () => {
  const { game } = makeWorld();
  const fx = recorder();
  game.effects = fx;
  const def = { ...VEHICLES.willys_mb, id: 'willys_mb' };
  const jeep = new WheeledVehicle(game, def, boxModel(def, new THREE.MeshStandardMaterial(), { turret: false, engineZ: -0.32 }), 0, 0, 0);
  jeep.syncModel(0);
  jeep.hp = jeep.maxHp * 0.3;
  for (let t = 0; t < 3; t += 1 / 30) updateVehicleEffects(game, jeep, 1 / 30);
  const smoke = fx.list.filter((p) => p.kind === 'smoke');
  assert.ok(smoke.length > 0);
  for (const p of smoke) assert.ok(jeep.worldToModel(new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3()).z < -0.5, 'from the front');
  fx.list.length = 0;
  const bike = spawn(game, 'bicycle', 10, 0, 0, { empty: true });
  bike.hp = bike.maxHp * 0.05;
  for (let t = 0; t < 3; t += 1 / 30) updateVehicleEffects(game, bike, 1 / 30);
  assert.equal(fx.list.filter((p) => p.kind === 'smoke' || p.kind === 'fire' || p.kind === 'spark').length, 0);
});

test('scorching one vehicle leaves the others that share its materials as they were; the wreck is charred once', () => {
  const { game } = makeWorld();
  game.effects = recorder();
  const shared = new THREE.MeshStandardMaterial({ name: 'paintTest', color: 0x667755, roughness: 0.6, metalness: 0.3 });
  const first = shared.color.clone();
  const a = boxTank(game, shared, 0, 0);
  const b = boxTank(game, shared, 20, 0);
  const meshOf = (v) => v.model.parts.body.children.find((o) => o.isMesh);
  for (const frac of [0.7, 0.5, 0.3, 0.1]) {
    a.hp = a.maxHp * frac;
    updateVehicleEffects(game, a, 1 / 30);
    updateVehicleEffects(game, b, 1 / 30);
  }
  const mine = meshOf(a).material;
  assert.notEqual(mine, shared, 'a damaged vehicle paints its own copy');
  assert.equal(meshOf(b).material, shared, 'the sound one keeps the shared material');
  assert.ok(shared.color.equals(first) && shared.roughness === 0.6, 'and the shared material is untouched');
  assert.ok(mine.color.r < first.r * 0.7 && mine.roughness > 0.6, 'the hurt one is darker and duller');
  // Darker as it gets worse.
  const c = boxTank(game, shared, 40, 0);
  c.hp = c.maxHp * 0.5;
  updateVehicleEffects(game, c, 1 / 30);
  assert.ok(meshOf(c).material.color.r > mine.color.r, 'half health is less scorched than a tenth');
  // Burnt out: the old charred look, from the paint's first color (no darker for the scorching before).
  charModel(a);
  assert.ok(Math.abs(mine.color.r - first.r * 0.16) < 1e-6 && mine.roughness === 1);
  updateVehicleEffects(game, a, 1 / 30);
  assert.ok(Math.abs(mine.color.r - first.r * 0.16) < 1e-6, 'it stays charred');
  assert.ok(shared.color.equals(first));
});

test('hits leave marks on the part they struck, laid on its surface, riding with it', () => {
  const { game } = makeWorld();
  const v = boxTank(game);
  const { body, turret } = v.model.parts;
  const p = v.body.position;
  const [W, H] = v.def.dims;
  // AP through the left of the hull: a hole in a ring of soot.
  assert.equal(strike(v, [p.x - 30, p.y, p.z + 0.5], [p.x, p.y - 0.2, p.z], 'penetrate', AP).name, 'hull');
  const hull = marksOn(v, body);
  assert.deepEqual(hull.map((s) => s.mesh.name).sort(), ['marks-hole', 'marks-scorch']);
  // On the hull's left face (x = -W/2 in its own frame) and nowhere past its edges.
  for (const s of hull) {
    const pos = s.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      assert.ok(Math.abs(pos.getX(i) + W / 2) < 0.005, `x ${pos.getX(i)}`);
      assert.ok(pos.getY(i) >= H * 0.15 - 0.005 && pos.getY(i) <= H * 0.55 + 0.005, `y ${pos.getY(i)}`);
    }
  }
  // HE bursting on the turret roof: a scorch and a gouge on the turret.
  const tw = turret.getWorldPosition(new THREE.Vector3());
  assert.equal(strike(v, [tw.x + 2, tw.y + 30, tw.z], [tw.x, tw.y, tw.z - 0.2], 'nonpen', HE).name, 'turret');
  const top = marksOn(v, turret);
  assert.deepEqual(top.map((s) => s.mesh.name).sort(), ['marks-gouge', 'marks-scorch']);
  // The turret turns: its marks go with it, the hull's stay.
  const at = (s) => new THREE.Vector3().fromBufferAttribute(s.mesh.geometry.attributes.position, 0).applyMatrix4(s.mesh.matrixWorld);
  v.syncModel(0);
  const t0 = at(top[0]),
    h0 = at(hull[0]);
  v.turretYaw += 1.2;
  v.syncModel(0);
  assert.ok(at(top[0]).distanceTo(t0) > 0.3, 'turret marks turn with the turret');
  assert.ok(at(hull[0]).distanceTo(h0) < 1e-6, 'hull marks stay put');
  assert.equal(markCount(v), 4);
});

test('marks are capped per part; tracks, bullets on armor and bicycles leave none', () => {
  const { game } = makeWorld();
  const v = boxTank(game);
  const p = v.body.position;
  for (let i = 0; i < 40; i++) strike(v, [p.x - 30, p.y, p.z + ((i % 9) - 4) * 0.4], [p.x, p.y - 0.2, p.z + ((i % 9) - 4) * 0.4], 'nonpen', HE);
  const counts = Object.fromEntries([...v._dmg.marks.values()].map((s) => [s.mesh.name, s.recs.length]));
  assert.deepEqual(counts, { 'marks-scorch': MARK_CAP.scorch, 'marks-gouge': MARK_CAP.gouge });
  const n = markCount(v);
  // Rifle bullets bounce off armor without a mark; shells on a track leave none.
  strike(v, [p.x - 30, p.y, p.z], [p.x, p.y - 0.2, p.z], 'nonpen', BULLET);
  const track = v.plates.find((pl) => pl.kind === 'track');
  addHitMark(v, { kind: 'penetrate', x: track.box.cx, y: track.box.cy, z: track.box.cz, nx: -1, ny: 0, nz: 0, dirX: 1, dirY: 0, dirZ: 0, plate: track }, AP);
  assert.equal(markCount(v), n);
  const bike = spawn(game, 'bicycle', 10, 0, 0, { empty: true });
  bike.model.root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  bike.syncModel(0);
  addHitMark(bike, { kind: 'penetrate', x: 9.5, y: 0.5, z: 0, nx: -1, ny: 0, nz: 0, dirX: 1, dirY: 0, dirZ: 0, plate: bike.plates[0] }, BULLET);
  assert.equal(markCount(bike), 0);
});
