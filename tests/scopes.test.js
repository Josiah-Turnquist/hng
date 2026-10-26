// Scopes on rifles (src/weapons/scopes.js): only the rifle and scope pairs that
// were really issued; a scope over the action stops clips (one round at a
// time); the iron sights stay usable only where the mount leaves them clear,
// and then nothing of the scope or mount is in their way; the scope's line of
// sight crosses the bullet's path at every range setting, and an offset scope
// (the M1C's) is turned in to meet it at the zero range; the old scoped rifles'
// ids still load; the loadout screen's choices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { SCOPES, FITTINGS, historical, scopedWeapon } from '../src/weapons/scopes.js';
import { WEAPONS, DEFAULT_LOADOUT, weaponFamilies, scopeChoices, baseOf } from '../src/weapons/defs.js';
import { Weapon } from '../src/weapons/weapon.js';
import { Sighting } from '../src/weapons/sighting.js';
import { GunBuilder } from '../src/weapons/models/kit.js';
import { MODELS } from '../src/weapons/models/index.js';
import { parseDownloadedGarand } from '../src/weapons/models/downloaded.js';
import { fitScopeToDownloadedGarand } from '../src/weapons/models/optics.js';
import { trajectory } from '../src/ballistics/solver.js';
import { Atmosphere } from '../src/ballistics/atmosphere.js';
import { loadRoster } from '../src/ui/roster.js';

const DT = 1 / 120;
const atm = new Atmosphere(0, 15);
const mat = new THREE.MeshStandardMaterial();
mat.userData.texWorld = 0.3;
const mats = new Proxy({}, { get: () => mat });
const ids = Object.keys(FITTINGS);

function build(model) {
  const b = new GunBuilder(mats);
  MODELS[model](b);
  const gun = b.build(model);
  gun.root.updateMatrixWorld(true);
  return gun;
}

function run(w, seconds, trigger = false) {
  w.setTrigger(trigger);
  for (let t = 0; t < seconds; t += DT) w.update(DT);
}

// Fire everything and work the action until the magazine is empty.
function empty(w) {
  for (let i = 0; i < 40 && w.loaded > 0; i++) {
    run(w, 0.05, true);
    run(w, 2.5, false);
  }
}

// Where the bullet is, across and up from the line of sight, when it has gone
// the sight's set range (in meters) out along it. Gun space -> a frame with the
// line of sight level along -Z through the eye.
function missAtSetting(gun, def, s, i) {
  s.setRangeIndex(i);
  const q = new THREE.Quaternion().setFromUnitVectors(s.losDir, new THREE.Vector3(0, 0, -1));
  const m = gun.anchors.muzzle.clone().sub(s.eye).applyQuaternion(q);
  const bore = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const R = def.sight.ranges[i] * (def.sight.unit === 'yd' ? 0.9144 : 1);
  const [p] = trajectory(def.ammoData, def.mv, Math.asin(bore.y), atm, [R + m.z], { y0: m.y });
  return { up: p.y, across: m.x + (bore.x / -bore.z) * (R + m.z), R };
}

test('only rifle and scope pairs that were really issued', () => {
  for (const [id, f] of Object.entries(FITTINGS)) {
    const s = SCOPES[f.scope];
    assert.ok(s, `${id}: scope ${f.scope}`);
    assert.ok(s.rifles.includes(f.rifle), `${id}: ${f.scope} on ${f.rifle}`);
    assert.equal(WEAPONS[f.rifle].faction, s.army, `${id}: the rifle and scope are of one army`);
    assert.ok(!WEAPONS[f.rifle].scope, `${id}: built on a plain rifle`);
    assert.equal(WEAPONS[id].base, f.rifle);
    assert.ok(f.note && f.info && f.mount, `${id}: described`);
  }
  // Every scoped weapon is one of these fittings.
  for (const [id, w] of Object.entries(WEAPONS)) if (w.scope) assert.ok(FITTINGS[id], `${id} has a scope but is not a fitting`);
  assert.equal(historical('m1_garand', 'zf39'), false);
  assert.equal(historical('kar98k', 'pu'), false);
  assert.equal(historical('svt40', 'pem'), false);
  FITTINGS.made_up = { ...FITTINGS.m1c_m81, scope: 'zf4' };
  try {
    assert.throws(() => scopedWeapon('made_up', WEAPONS.m1_garand), /never fitted/);
  } finally {
    delete FITTINGS.made_up;
  }
});

test('scopes: real magnification, field and eye relief; the scope adds its weight', () => {
  for (const [k, s] of Object.entries(SCOPES)) {
    assert.ok(s.mag >= 1.5 && s.mag <= 8, `${k} magnification`);
    assert.ok(s.fieldDeg > 1 && s.fieldDeg < 10, `${k} field of view`);
    assert.ok(s.eyeRelief >= 0.05 && s.eyeRelief <= 0.35, `${k} eye relief`);
    assert.ok(s.mass > 0.1 && s.mass < 1, `${k} weight`);
  }
  for (const id of ids) {
    const w = WEAPONS[id];
    assert.equal(w.sight.kind, 'scope');
    assert.ok(w.sight.ranges.includes(w.sight.zero), `${id} zero is a setting`);
    assert.ok(w.mass > baseOf(w).mass + 0.15, `${id} is heavier than the plain rifle`);
    assert.equal(w.scope.mag, SCOPES[FITTINGS[id].scope].mag);
  }
  // A few figures from the sources.
  assert.equal(SCOPES.pu.mag, 3.5);
  assert.equal(SCOPES.pu.fieldDeg, 4.5);
  assert.equal(SCOPES.pu.drum.to, 1300);
  assert.equal(SCOPES.zf41.mag, 1.5);
  assert.equal(SCOPES.m81.mag, 2.5);
  assert.equal(SCOPES.weaver330.mag, 2.75);
});

test('a scope over the action stops clips: the rifle loads one round at a time', () => {
  for (const id of ids) {
    const f = FITTINGS[id];
    const w = new Weapon(WEAPONS[id]);
    empty(w);
    assert.equal(w.loaded, 0, `${id} emptied`);
    const ev = [];
    w.takeEvents();
    assert.ok(w.startReload(), `${id} reloads`);
    const steps = w.takeEvents().find((e) => e.type === 'reloadStart').steps;
    ev.push(...steps);
    run(w, 8);
    assert.equal(w.loaded, w.def.capacity, `${id} full after the reload`);
    const rounds = steps.filter((n) => n === 'round').length;
    if (f.clips === 'blocked') {
      assert.equal(WEAPONS[f.rifle].feed, 'stripper');
      assert.ok(!steps.includes('clip'), `${id}: no clip with the scope over the action`);
      assert.equal(rounds, w.def.capacity, `${id}: a round at a time`);
    } else if (f.clips === 'free') {
      assert.ok(steps.includes('clip') || steps.includes('clipIn'), `${id}: clips still load (${steps})`);
      assert.equal(rounds, 0);
    } else {
      assert.ok(steps.includes('magIn'), `${id}: a magazine as before`);
    }
  }
  // The plain rifles still take clips.
  for (const id of ['kar98k', 'mosin_9130', 'm1903']) {
    const w = new Weapon(WEAPONS[id]);
    empty(w);
    w.takeEvents();
    w.startReload();
    assert.ok(w.takeEvents().find((e) => e.type === 'reloadStart').steps.includes('clip'), id);
  }
  // Topping off after a shot: single rounds, as on the plain rifle.
  const w = new Weapon(WEAPONS.mosin_pu);
  run(w, 0.05, true);
  run(w, 2.5);
  w.takeEvents();
  w.startReload();
  const steps = w.takeEvents().find((e) => e.type === 'reloadStart').steps;
  assert.ok(steps.includes('round') && !steps.includes('clip'), String(steps));
  run(w, 5);
  assert.equal(w.loaded, 5);
});

test('iron sights: usable beside an offset or see-through mount, gone under the others', () => {
  for (const id of ids) {
    const f = FITTINGS[id];
    const d = WEAPONS[id];
    const w = new Weapon(d);
    assert.equal(!!d.irons, f.irons, id);
    if (!f.irons) {
      assert.equal(w.toggleSights(), false, `${id} has only its scope`);
      assert.equal(w.scope, d.scope);
      continue;
    }
    assert.deepEqual(d.irons, WEAPONS[f.rifle].sight, `${id} keeps the rifle's own sight`);
    assert.equal(w.scope, d.scope);
    w.changeZero(2);
    const scopeZero = w.zeroIndex;
    assert.ok(w.toggleSights());
    assert.equal(w.scope, null);
    assert.equal(w.sight, d.irons);
    assert.equal(w.zeroRange, d.irons.zero, `${id}: the irons keep their own setting`);
    assert.ok(w.takeEvents().some((e) => e.type === 'sights' && e.irons));
    assert.ok(w.toggleSights());
    assert.equal(w.zeroIndex, scopeZero, `${id}: back on the scope at its setting`);
  }
  // The M1903A4 was made without iron sights.
  assert.ok(!build('m1903a4').anchors.frontSight);
});

// Distance to the first surface of a model along a ray (null: none).
function firstHit(gun, origin, dir) {
  const meshes = [];
  gun.root.traverse((o) => o.isMesh && meshes.push(o));
  const ray = new THREE.Raycaster(origin, dir, 0, 2);
  return ray.intersectObjects(meshes, false)[0]?.distance ?? null;
}

test('where the iron sights stay usable, nothing of the scope or mount is in their way', () => {
  for (const id of ids.filter((k) => FITTINGS[k].irons)) {
    const d = WEAPONS[id];
    const plain = build(WEAPONS[d.base].model || d.base);
    const scoped = build(d.model);
    const irons = { ...d, sight: d.irons, scope: null };
    const s = new Sighting(scoped, irons, atm).setRangeIndex(d.irons.ranges.indexOf(d.irons.zero));
    // Just above the line through the sights (clear of their own edges).
    const o = s.eye.clone().add(new THREE.Vector3(0, 0.0005, 0));
    const a = firstHit(plain, o, s.losDir),
      b = firstHit(scoped, o, s.losDir);
    assert.ok(a === b || (a !== null && b !== null && Math.abs(a - b) < 1e-6), `${id}: the line of the iron sights meets the scope or mount at ${b} m (plain rifle: ${a})`);
  }
});

test("the scope's line of sight meets the bullet at every range setting", () => {
  for (const id of ids) {
    const d = WEAPONS[id];
    const gun = build(d.model);
    const s = new Sighting(gun, d, atm);
    assert.equal(s.sightKind, 'scope', `${id} aims through its scope`);
    assert.ok(Math.abs(s.eyeRelief - d.scope.eyeRelief) < 1e-9, `${id} eye relief`);
    for (let i = 0; i < d.sight.ranges.length; i++) {
      const { up, across, R } = missAtSetting(gun, d, s, i);
      // (Within 5 mm, or 0.02 mrad far out: a fiftieth of the best rifle's spread.)
      assert.ok(Math.abs(up) < Math.max(0.005, R * 2e-5), `${id} at ${d.sight.ranges[i]} ${d.sight.unit}: ${(up * 1000).toFixed(1)} mm off`);
      // Offset scopes: turned in to cross the bore at the zero range.
      if (d.sight.ranges[i] === d.sight.zero) assert.ok(Math.abs(across) < 0.005, `${id} at its zero (${R.toFixed(0)} m): ${(across * 1000).toFixed(1)} mm to the side`);
    }
  }
});

test('the iron sights beside a scope are zeroed as on the plain rifle, yards flown as yards', () => {
  for (const id of ids.filter((k) => FITTINGS[k].irons)) {
    const d = WEAPONS[id];
    const gun = build(d.model);
    const irons = { ...d, sight: d.irons, scope: null };
    const s = new Sighting(gun, irons, atm);
    for (const i of [0, d.irons.ranges.indexOf(d.irons.zero), d.irons.ranges.length - 1]) {
      const { up, R } = missAtSetting(gun, irons, s, i);
      assert.ok(Math.abs(up) < Math.max(0.005, R * 2e-5), `${id} irons at ${d.irons.ranges[i]} ${d.irons.unit}: ${(up * 1000).toFixed(1)} mm off`);
    }
  }
});

test("the Marine Corps' Unertl is pulled back after every shot", () => {
  const time = (id) => {
    const w = new Weapon(WEAPONS[id]);
    run(w, 0.05, true);
    w.setTrigger(false);
    let t = 0;
    const steps = [];
    while (!w.canFire() && t < 5) {
      w.update(DT);
      t += DT;
      for (const e of w.takeEvents()) if (e.type === 'step') steps.push(e.name);
    }
    return { t, steps };
  };
  const u = time('m1903a1_unertl'),
    a4 = time('m1903a4');
  assert.ok(u.steps.includes('scopeBack') && !a4.steps.includes('scopeBack'));
  assert.ok(u.t > a4.t + 0.4, `${u.t} s against ${a4.t} s`);
});

test('the old scoped rifles still load, and loadouts remember the scope', () => {
  for (const id of ['m1903a4', 'kar98k_zf39', 'mosin_pu']) assert.ok(WEAPONS[id]?.scope, id);
  assert.equal(DEFAULT_LOADOUT.US.recon[0], 'm1903a4');
  const saved = new Map();
  const old = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) };
  try {
    const soldier = (id, faction, cls, gun) => ({ id, faction, cls, name: 'X Y', loadout: [gun, null, null] });
    saved.set(
      'hng.roster.v1',
      JSON.stringify({
        soldiers: [soldier('a', 'GE', 'recon', 'kar98k_zf39'), soldier('b', 'SU', 'recon', 'mosin_pu'), soldier('c', 'US', 'recon', 'm1c_m82'), soldier('d', 'GE', 'infantry', 'kar98k_zf41'), soldier('e', 'GE', 'infantry', 'kar98k_zf39'), soldier('f', 'US', 'recon', 'm1903a4')],
        selectedId: 'a',
      }),
    );
    const r = loadRoster();
    assert.deepEqual(
      r.soldiers.map((s) => s.loadout[0]),
      ['kar98k_zf39', 'mosin_pu', 'm1c_m82', 'kar98k_zf41', 'kar98k', 'm1903a4'],
      'kept, except a scout scope on an infantryman (back to his default rifle)',
    );
  } finally {
    if (old === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = old;
  }
});

test('the loadout screen: one card per rifle, its scopes under it', () => {
  const list = (f, c, s) => weaponFamilies(f, c, s).map((w) => w.id);
  assert.ok(!list('GE', 'recon', 'primary').some((id) => WEAPONS[id].scope), 'no scoped rifle as a card of its own');
  assert.ok(list('US', 'recon', 'primary').includes('m1_garand'), 'the Garand, for its M1C scopes');
  const ch = (id, cls) => scopeChoices(WEAPONS[id], cls).map((c) => c.id);
  assert.deepEqual(ch('kar98k', 'recon'), ['kar98k', 'kar98k_zf39', 'kar98k_zf41']);
  assert.deepEqual(ch('kar98k_zf41', 'infantry'), ['kar98k', 'kar98k_zf41'], "a marksman's ZF 41 for the infantry");
  assert.deepEqual(ch('m1_garand', 'recon'), ['m1c_m81', 'm1c_m82'], 'a scout carries the Garand only as an M1C');
  assert.deepEqual(ch('m1_garand', 'infantry'), ['m1_garand']);
  assert.deepEqual(ch('fg42', 'paratrooper'), ['fg42', 'fg42_zfg42']);
  assert.deepEqual(ch('mosin_9130', 'recon'), ['mosin_9130', 'mosin_pu', 'mosin_pem']);
  assert.deepEqual(ch('svt40', 'recon'), ['svt40_pu']);
  for (const c of scopeChoices(WEAPONS.kar98k, 'recon')) assert.ok(c.note.length > 10 && !c.note.includes(String.fromCharCode(0x2014)), c.id);
});

// The downloaded Garand (the default in first person) as an M1C: the mount fits
// its receiver, the irons stay clear and the scope is zeroed.
const file = readFileSync(new URL('../assets/models/m1_garand_rookieray.glb', import.meta.url));
const glb = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

test('the downloaded Garand as an M1C', async () => {
  const plain = await parseDownloadedGarand(glb.slice(0));
  const gun = fitScopeToDownloadedGarand(await parseDownloadedGarand(glb.slice(0)), mats);
  plain.root.updateMatrixWorld(true);
  gun.root.updateMatrixWorld(true);
  assert.ok(gun.anchors.scopeEye && gun.anchors.scopeFront);
  // Left of the bore, over the receiver and clear of the rear sight.
  assert.ok(gun.anchors.scopeEye.x < -0.025 && gun.anchors.scopeEye.y > 0.04);
  assert.ok(Math.abs(gun.anchors.scopeEye.z - gun.anchors.rearSight.z) < 0.08, 'the eyepiece over the rear of the receiver');
  for (const id of ['m1c_m81', 'm1c_m82']) {
    const d = WEAPONS[id];
    const s = new Sighting(gun, d, atm);
    const z = d.sight.ranges.indexOf(d.sight.zero);
    const { up, across } = missAtSetting(gun, d, s, z);
    assert.ok(Math.abs(up) < 0.005 && Math.abs(across) < 0.005, `${id}: ${up}, ${across}`);
    const irons = { ...d, sight: d.irons, scope: null };
    const si = new Sighting(gun, irons, atm).setRangeIndex(d.irons.ranges.indexOf(d.irons.zero));
    const o = si.eye.clone().add(new THREE.Vector3(0, 0.0005, 0));
    const a = firstHit(plain, o, si.losDir),
      b = firstHit(gun, o, si.losDir);
    assert.ok(a === b || Math.abs(a - b) < 1e-6, `${id}: the iron sights' line meets the mount (${b} against ${a})`);
  }
  // The scope clears the receiver and the rear sight: all along it, the rifle
  // under its inner edge (2 cm left of the bore) stays below its underside.
  const e = gun.anchors.scopeEye,
    f = gun.anchors.scopeFront;
  const r = 0.0165; // the eyepiece, the widest part over the receiver
  const under = e.y - Math.sqrt(r * r - (e.x + 0.02) ** 2);
  for (let z = f.z; z <= e.z; z += 0.01) {
    const d = firstHit(plain, new THREE.Vector3(-0.02, 0.1, z), new THREE.Vector3(0, -1, 0));
    if (d !== null) assert.ok(0.1 - d < under - 0.002, `at z = ${z.toFixed(2)} the rifle reaches ${(0.1 - d).toFixed(4)}, the scope ${under.toFixed(4)}`);
  }
});
