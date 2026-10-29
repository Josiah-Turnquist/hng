// The pocket pistols (Colt M1903, Beretta M1934, Korovin TK): real guns
// defined like the service pistols. Their models build at every level of
// detail with the parts and anchors a pistol needs; each fires its own real
// cartridge, which leaves at about its published velocity and slows as a
// small round-nosed pistol bullet does; and they load, fire and reload as the
// other pistols do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WEAPONS, pointsOf, DEFAULT_LOADOUT, weaponsFor } from '../src/weapons/defs.js';
import { POCKET_PISTOLS } from '../src/weapons/items/pocket.js';
import { AMMO } from '../src/weapons/ammo.js';
import { Weapon } from '../src/weapons/weapon.js';
import { MODELS, buildGun } from '../src/weapons/models/index.js';
import { Game } from '../src/game/game.js';
import { ProjectileSystem } from '../src/ballistics/projectiles.js';
import { CollisionWorld } from '../src/physics/collision.js';
import { Heightfield } from '../src/world/heightfield.js';
import { Atmosphere } from '../src/ballistics/atmosphere.js';

const IDS = ['colt_1903', 'beretta_1934', 'korovin_tk'];
const GR = 0.00006479891;
// Each one's cartridge: bullet mass (grains), diameter (mm), velocity from the pistol (m/s).
const REAL = {
  colt_1903: { ammo: '32 ACP', gr: 71, mm: 7.94, v: [255, 285], faction: 'US' },
  beretta_1934: { ammo: '380 ACP', gr: 95, mm: 9.02, v: [229, 290], faction: 'GE' },
  korovin_tk: { ammo: '25 ACP', gr: 50, mm: 6.38, v: [215, 240], faction: 'SU' },
};

const mats = new Proxy(
  {},
  {
    get: (t, k) => {
      if (!t[k]) {
        t[k] = new THREE.MeshStandardMaterial();
        t[k].userData.texWorld = 0.3;
        t[k].userData.lowColor = [0.1, 0.1, 0.1];
      }
      return t[k];
    },
  },
);

const DT = 1 / 120;
function run(w, seconds, trigger = false) {
  w.setTrigger(trigger);
  let shots = 0;
  for (let t = 0; t < seconds; t += DT) shots += w.update(DT);
  return shots;
}

test('the pocket pistols are sidearms for every class, 1 point, nobody\'s default', () => {
  assert.deepEqual(Object.keys(POCKET_PISTOLS).sort(), [...IDS].sort());
  for (const id of IDS) {
    const d = WEAPONS[id];
    assert.equal(d.slot, 'sidearm');
    assert.equal(d.type, 'pistol');
    assert.equal(d.faction, REAL[id].faction);
    assert.deepEqual([...d.classes].sort(), ['infantry', 'paratrooper', 'recon', 'tanker']);
    assert.equal(pointsOf(id), 1);
    for (const cls of d.classes) assert.ok(weaponsFor(d.faction, cls, 'sidearm').includes(d), `${id} offered to ${cls}`);
    for (const f of Object.values(DEFAULT_LOADOUT)) for (const kit of Object.values(f)) assert.ok(!kit.includes(id), `${id} in a default loadout`);
    // Smaller and lighter than the service pistols.
    assert.ok(d.mass < WEAPONS.p38.mass && d.length < WEAPONS.tt33.length, `${id} is a pocket gun`);
    assert.ok(d.info && !d.info.includes('\u2014'), `${id} info`);
  }
});

test('their models build at every LOD with a pistol\'s parts and anchors', () => {
  for (const id of IDS) {
    assert.ok(MODELS[WEAPONS[id].model], `${id} has a model`);
    for (const lod of [0, 1, 2]) {
      const g = buildGun(id, mats, { lod });
      let tris = 0;
      g.root.traverse((o) => o.isMesh && (tris += o.geometry.attributes.position.count / 3));
      assert.ok(tris > 0, `${id} LOD ${lod}`);
      for (const p of ['body', 'bolt', 'mag']) assert.ok(g.parts[p], `${id} LOD ${lod}: part ${p}`);
      for (const a of ['muzzle', 'gripR', 'gripL', 'trigger', 'frontSight', 'rearSight', 'magWell', 'ejectionPort']) assert.ok(g.anchors[a], `${id} LOD ${lod}: anchor ${a}`);
      // The real length, from the muzzle at the front to the heel of the grip
      // (or the hammer), within 3 mm.
      const box = new THREE.Box3().setFromObject(g.root);
      const len = box.max.z - box.min.z;
      assert.ok(Math.abs(len - WEAPONS[id].length) < 0.003, `${id} LOD ${lod} is ${(len * 1000).toFixed(0)} mm long`);
      assert.ok(Math.abs(box.min.z - g.anchors.muzzle.z) < 0.002, `${id}: the muzzle at the front`);
    }
  }
});

test('each fires its own real cartridge at a plausible velocity', () => {
  const hf = new Heightfield(512, 65);
  hf.computeRange();
  const atm = new Atmosphere(0, 15, 0);
  const projectiles = new ProjectileSystem({ world: new CollisionWorld(hf), atmosphere: atm });
  const noop = () => {};
  // The game's own firing for a soldier (Game.botFire), on a flat field.
  const g = Object.assign(Object.create(Game.prototype), { time: 0, projectiles, effects: { muzzle: noop }, audio: null });
  for (const id of IDS) {
    const r = REAL[id];
    const a = AMMO[r.ammo];
    assert.equal(WEAPONS[id].ammoData, a, `${id} fires ${r.ammo}`);
    assert.ok(Math.abs(a.mass - r.gr * GR) < 1e-6, `${r.ammo} bullet ${r.gr} gr`);
    assert.ok(Math.abs(a.diameter * 1000 - r.mm) < 0.05, `${r.ammo} ${r.mm} mm`);
    assert.ok(a.bc > 0.05 && a.bc < 0.16 && a.drag === 'G1', `${r.ammo} ballistic coefficient`);
    const w = new Weapon(WEAPONS[id]);
    assert.equal(w.ammo, a);
    const s = { id: 1, yaw: 0, pitch: 0, aiming: true, body: { vx: 0, vy: 0, vz: 0, eyePosition: (o) => Object.assign(o, { x: 0, y: 1.6, z: 0 }) } };
    projectiles.active.length = 0;
    for (let i = 0; i < 20; i++) g.botFire(s, w);
    assert.equal(projectiles.active.length, 20);
    for (const p of projectiles.active) {
      assert.equal(p.ammo, a);
      assert.ok(p.speed >= r.v[0] && p.speed <= r.v[1], `${id}: ${p.speed.toFixed(0)} m/s`);
    }
    // Out to 25 m: a few percent slower, about as the published tables have it.
    const p = projectiles.active[0];
    const v0 = p.speed;
    for (let t = 0; t < 1 && p.alive && p.z > -25; t += 1 / 400) projectiles._advance(p, 1 / 400);
    const loss = 1 - p.speed / v0;
    assert.ok(loss > 0.005 && loss < 0.06, `${id}: ${(loss * 100).toFixed(1)}% slower at 25 m`);
    // Muzzle energy: about 80 J for the 6.35 mm, 160 J the .32, 200 J the 9 mm Corto.
    const e = 0.5 * a.mass * WEAPONS[id].mv ** 2;
    assert.ok(e > 60 && e < 260, `${id}: ${e.toFixed(0)} J`);
  }
  // Weaker than the service pistols' rounds.
  for (const id of IDS) assert.ok(WEAPONS[id].ammoData.mass * WEAPONS[id].mv < WEAPONS.m1911a1.ammoData.mass * WEAPONS.m1911a1.mv);
});

test('they load, fire and reload like the other pistols', () => {
  for (const id of IDS) {
    const d = WEAPONS[id];
    const w = new Weapon(d);
    assert.equal(w.loaded, d.capacity + 1, `${id}: a full magazine and one in the chamber`);
    assert.equal(w.spareMags.length, d.reserve);
    // Semi-automatic: one shot per pull.
    assert.equal(run(w, 0.3, true), 1);
    run(w, 0.3, false);
    // A tactical reload keeps the round in the chamber and the part-used magazine.
    const left = w.mag;
    assert.ok(w.startReload());
    run(w, d.reload.tactical + 0.5);
    assert.equal(w.loaded, d.capacity + 1);
    assert.ok(w.spareMags.includes(left));
    // Empty it: the slide doesn't stay back, so an empty reload ends by cocking it.
    let shots = 0;
    for (let i = 0; i < d.capacity + 3; i++) {
      shots += run(w, 0.05, true);
      run(w, 0.2, false);
    }
    assert.equal(shots, d.capacity + 1);
    assert.equal(w.loaded, 0);
    assert.equal(w.boltLocked, false);
    const steps = [];
    w.takeEvents();
    w.startReload();
    for (const ev of w.takeEvents()) if (ev.type === 'reloadStart') steps.push(...ev.steps);
    assert.deepEqual(steps, ['magOut', 'magIn', 'charge']);
    run(w, d.reload.empty + 0.5);
    assert.equal(w.loaded, d.capacity, 'a full magazine, its top round chambered');
  }
});
