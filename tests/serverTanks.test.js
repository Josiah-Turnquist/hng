// On the game server nothing draws the vehicles, and it was drawing that put
// their parts in place: so a tank that had driven off still fired from, and
// was hit at, the spot where it came in, and the shot's kick (taken at the
// gun, wherever that was thought to be) spun the hull. And from the outside
// view the gun was always set for 400 m, so a shell aimed at a man's feet
// close by went well past him.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeBattle, addPlayer } from '../src/server/battle.js';
import { encodeInput, decodeInput, watchEvents } from '../src/net/protocol.js';
import { makeWorld, run, rider } from './helpers/vehicleWorld.js';
import { SURF } from '../src/world/heightfield.js';
import { VEHICLES, SHELLS } from '../src/vehicles/defs.js';
import { AMMO } from '../src/weapons/ammo.js';
import { Game } from '../src/game/game.js';
import { TrackedVehicle } from '../src/vehicles/tracked.js';
import { buildVehicle } from '../src/vehicles/models/index.js';
import { ProjectileSystem } from '../src/ballistics/projectiles.js';

const DEG = Math.PI / 180;

test('on the game server, a tank that has driven off fires from its gun, keeps its armour and seats with it, and is not spun by the shot', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const g = await makeBattle({ perSide: 4, seed: 2, vehicles: true });
    const ev = watchEvents(g);
    const pc = addPlayer(g, { name: 'Able', faction: 'US', cls: 'tanker', tank: 'm4a1_sherman' });
    const me = pc.soldier;
    for (const s of g.soldiers) if (s.brain) s.brain.update = () => {};
    const v = me.vehicle;
    assert.ok(v && v.def.kind === 'tracked', 'he comes in in his tank');
    const from = v.body.position.clone();
    const f = new THREE.Vector3();
    const hullYaw = () => {
      f.set(0, 0, -1).applyQuaternion(v.body.quaternion);
      return Math.atan2(-f.x, -f.z);
    };
    let seq = 0;
    let aimOff = 0;
    let lay = null;
    const go = (seconds, held = [], pressed = [], each = null) => {
      for (let i = 0; i < seconds * 60; i++) {
        g.applyInput(me.id, encodeInput({ seq: ++seq, held, pressed: i === 0 ? pressed : [], look: [hullYaw() + aimOff, 0], lay }));
        g.update(1 / 60);
        each?.();
      }
    };
    go(2);
    go(6, ['forward']);
    go(5, ['forward', 'right']);
    go(4);
    const p = v.body.position;
    assert.ok(p.distanceTo(from) > 4, `it drove off (${p.distanceTo(from).toFixed(1)} m)`);

    // Its parts are where it is: the muzzle, the gunner's seat, the armour.
    // (Against the same things worked out afresh, as drawing would.)
    const parts = () => [v.muzzleWorld(new THREE.Vector3()), v.seatPos(0, new THREE.Vector3()), ...v.plates.map((pl) => new THREE.Vector3(pl.box.cx, pl.box.cy, pl.box.cz))];
    const kept = parts();
    v.syncModel(0);
    const fresh = parts();
    kept.forEach((k, i) =>
      assert.ok(k.distanceTo(fresh[i]) < 0.02, `${['the muzzle', "the gunner's seat"][i] || `armour plate ${v.plates[i - 2].name}`} is where the tank is (${k.distanceTo(fresh[i]).toFixed(2)} m off)`),
    );
    assert.ok(kept[0].distanceTo(p) < 7, 'the muzzle is on the tank');

    // The gun swung well off the line back to where it came in, then fired.
    aimOff = 70 * DEG;
    go(8);
    ev.take();
    v.syncModel(0);
    const muzzle = v.muzzleWorld(new THREE.Vector3());
    let swing = 0;
    const yaw0 = hullYaw();
    go(2.5, [], ['fire'], () => (swing = Math.max(swing, Math.abs(v.body.angular.y) / DEG)));
    const shot = ev.take().find((e) => e[0] === 'f');
    assert.ok(shot, 'the gun fired');
    const at = new THREE.Vector3(shot[3] / 100, shot[4] / 100, shot[5] / 100);
    assert.ok(at.distanceTo(muzzle) < 0.5, `the shell left from the muzzle (${at.distanceTo(muzzle).toFixed(1)} m from it)`);
    assert.ok(swing < 3, `the shot doesn't spin the hull (it swung at up to ${swing.toFixed(1)} deg/s)`);
    assert.ok(Math.abs(hullYaw() - yaw0) / DEG < 1, 'nor leave it pointing elsewhere');

    // The machine gun beside it: its rounds leave from the tank too.
    go(0.6, ['handbrake']);
    const mg = ev.take().filter((e) => e[0] === 'f');
    assert.ok(mg.length >= 2, 'the machine gun fired');
    for (const e of mg) assert.ok(Math.hypot(e[3] / 100 - p.x, e[4] / 100 - p.y, e[5] / 100 - p.z) < 7, 'its rounds leave from the tank');

    // The distance he lays the gun for from the outside view reaches the server, and going to the sight clears it.
    lay = 83;
    go(0.1);
    assert.equal(v.layRange, 83);
    lay = null;
    go(0.1);
    assert.equal(v.layRange, null);
  } finally {
    console.warn = warn;
  }
});

test('the distance a gun is laid for goes in the input message, kept within what a gun can do', () => {
  assert.equal(decodeInput(encodeInput({ seq: 1, lay: 61.4 })).lay, 61);
  assert.equal(decodeInput(encodeInput({ seq: 1 })).lay, null);
  assert.equal(decodeInput({ ...encodeInput({ seq: 1 }), y: 9e9 }).lay, 3000);
  assert.equal(decodeInput({ ...encodeInput({ seq: 1 }), y: -4 }).lay, 5);
  assert.equal(decodeInput({ ...encodeInput({ seq: 1 }), y: 'far' }).lay, null);
});

// Flat ground, a point on it ahead: how far past (or short of) it the shell comes down.
function past(id, range, lay) {
  const textures = { standard: () => new THREE.MeshStandardMaterial(), get: () => ({}) };
  const { game } = makeWorld({ size: 2048, surface: SURF.GRASS });
  let landed = null;
  game.projectiles = new ProjectileSystem({ world: game.world.collision, atmosphere: game.world.atmosphere });
  game.projectiles.onImpact = (p, info) => (landed ??= info);
  const v = new TrackedVehicle(game, { ...VEHICLES[id], id }, buildVehicle(id, textures), 0, 600, 0);
  game.vehicles.push(v);
  v.enter(rider(), 0);
  // (The explosive shell: the one for men in the open.)
  v.selectAmmo(1);
  v.reloadT = 0;
  v.loaded = v.nextAmmo;
  const m = new THREE.Vector3();
  const t = new THREE.Vector3();
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(v.body.quaternion);
  run(v, 8, () => {
    v.syncModel(0);
    v.muzzleWorld(m);
    t.copy(v.body.position).addScaledVector(f, range);
    t.y = game.world.hf.getHeight(t.x, t.z);
    const d = t.clone().sub(m);
    v.layRange = lay ? d.length() : null;
    d.normalize();
    v.aim.yaw = Math.atan2(-d.x, -d.z);
    v.aim.pitch = Math.asin(d.y);
  });
  v.syncModel(0);
  assert.ok(v.fireMain(null), 'it fired');
  for (let i = 0; i < 900 && !landed; i++) game.projectiles.update(1 / 120);
  assert.ok(landed, 'the shell came down');
  return Math.hypot(landed.x - v.body.position.x, landed.z - v.body.position.z) - range;
}

test('from the outside view the gun is laid for the distance to the point aimed at: the shell lands there', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const id of ['m4a1_sherman', 't34_76', 'tiger1']) {
      for (const range of [30, 60, 120]) {
        const off = past(id, range, true);
        assert.ok(Math.abs(off) < 3, `${id} at ${range} m: within 3 m of the point (${off.toFixed(1)} m)`);
      }
    }
    // (Through the sight the range is the gunner's to set: at its 400 m, a point 60 m off is overshot.)
    assert.ok(past('m4a1_sherman', 60, false) > 8, "the sight's range still stands when it is used");
  } finally {
    console.warn = warn;
  }
});

// A shell bursting on open ground, men standing at set distances from it: the harm each takes from the blast.
function blastHarm(shell, distances) {
  const harm = distances.map(() => 0);
  const men = distances.map((d, i) => ({ alive: true, body: { x: d, y: 0, z: 0 }, damage: (a) => (harm[i] += a) }));
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    effects: { explosion() {} },
    audio: null,
    soldiers: men,
    vehicles: [],
    world: { collision: { lineOfSight: () => true } },
    // (Splinters fly as real projectiles: left out here, only the blast is measured.)
    projectiles: { fire: () => ({}) },
  });
  g.explode(0, 0, 0, { ammo: shell, owner: null, weapon: { name: 'gun' }, distance: 100 });
  return harm;
}

test("a tank's explosive shell kills men in the open within about 5 m and wounds well beyond; its blast on vehicles and a hand grenade's are as they were", () => {
  const [at3, at4, at7, at12, at20] = blastHarm(SHELLS['M48 HE'], [3, 4, 7, 12, 20]);
  assert.ok(at3 >= 100 && at4 >= 100, `3 m and 4 m off: killed (${at3.toFixed(0)}, ${at4.toFixed(0)})`);
  assert.ok(at7 > 35 && at7 < 100, `7 m off: badly hurt, not killed (${at7.toFixed(0)})`);
  assert.ok(at12 > 8 && at12 < 35, `12 m off: hurt (${at12.toFixed(0)})`);
  assert.equal(at20, 0, 'beyond its reach: nothing');
  // (The small 37 mm shell stays small.)
  const [near, off] = blastHarm(SHELLS['M63 HE'], [0.5, 3]);
  assert.ok(near >= 100 && off < 30, `the 37 mm shell: deadly only close by (${near.toFixed(0)}, ${off.toFixed(0)})`);
  // Every explosive tank shell is set the same way, and nothing thrown or fired from the shoulder is.
  for (const s of Object.values(SHELLS)) if (s.explosive) assert.equal(s.explosive.men, 4, s.name);
  for (const a of Object.values(AMMO)) if (a.explosive) assert.equal(a.explosive.men, undefined, a.name);
});
