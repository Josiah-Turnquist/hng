// Binoculars: each army's 6x30 glasses in the binoculars slot. Their models
// build at every level of detail with what the hands and the view need; they
// fire nothing; and, raised to the eyes, fire spots the enemy in the middle of
// the view for the whole side: the bots of the side know he is there for 10
// seconds. Not through a wall, and not with the glasses lowered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeBattle, ATT, DEF } from './helpers/battle.js';
import { WEAPONS, LOADOUT_SLOTS, pointsOf, DEFAULT_LOADOUT, weaponsFor } from '../src/weapons/defs.js';
import { BINOCULARS } from '../src/weapons/items/binoculars.js';
import { Weapon } from '../src/weapons/weapon.js';
import { MODELS, buildGun } from '../src/weapons/models/index.js';
import { Sighting } from '../src/weapons/sighting.js';
import { Atmosphere } from '../src/ballistics/atmosphere.js';
import { Pickups } from '../src/game/pickups.js';
import { Spotting, SPOT_TIME } from '../src/game/spotting.js';
import { hiddenAt } from '../src/ai/tactics.js';
import { FLAG_SIGHT, RayHit } from '../src/physics/collision.js';
import { RNG } from '../src/core/math.js';

const IDS = ['binoc_us', 'binoc_ge', 'binoc_su'];
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

test('binoculars: one pair per army, in slot 7, 1 point, any class, nobody\'s default', () => {
  assert.deepEqual(Object.keys(BINOCULARS).sort(), [...IDS].sort());
  assert.equal(LOADOUT_SLOTS[6], 'binoculars');
  for (const id of IDS) {
    const d = WEAPONS[id];
    assert.equal(d.type, 'binoculars');
    assert.equal(d.slot, 'binoculars');
    assert.equal(pointsOf(id), 1);
    assert.deepEqual([...d.classes].sort(), ['infantry', 'paratrooper', 'recon', 'tanker']);
    for (const cls of d.classes) assert.deepEqual(weaponsFor(d.faction, cls, 'binoculars'), [d]);
    for (const f of Object.values(DEFAULT_LOADOUT)) for (const kit of Object.values(f)) assert.ok(!kit.includes(id));
    assert.ok(d.mass >= 0.5 && d.mass <= 0.6, `${id} mass`);
    assert.equal(d.optic.mag, 6);
    assert.equal(d.optic.fieldDeg, 8.5);
    assert.equal(d.loadedMass, d.mass);
    assert.ok(!d.info.includes('\u2014'));
  }
});

test('binoculars: the models build at every LOD with the anchors the hands and the view need', () => {
  for (const id of IDS) {
    assert.ok(MODELS[WEAPONS[id].model], `${id} has a model`);
    const guns = [0, 1, 2].map((lod) => buildGun(id, mats, { lod }));
    for (const [lod, g] of guns.entries()) {
      let tris = 0;
      g.root.traverse((o) => o.isMesh && (tris += o.geometry.attributes.position.count / 3));
      assert.ok(tris > 0 && tris < [60000, 6500, 1300][lod], `${id} LOD ${lod}: ${tris} triangles`);
      for (const a of ['scopeEye', 'scopeFront', 'muzzle', 'gripR', 'gripL', 'trigger']) assert.ok(g.anchors[a], `${id} LOD ${lod}: ${a}`);
      // A 6x30's size: about 11 cm long and 16 cm across, the eyepieces 64 mm apart.
      const s = new THREE.Box3().setFromObject(g.root).getSize(new THREE.Vector3());
      assert.ok(Math.abs(s.z - WEAPONS[id].length) < 0.006, `${id} LOD ${lod}: ${(s.z * 1000).toFixed(0)} mm long`);
      assert.ok(s.x > 0.14 && s.x < 0.18, `${id} LOD ${lod}: ${(s.x * 1000).toFixed(0)} mm across`);
      assert.equal(g.anchors.gripR.x, -g.anchors.gripL.x, 'a hand on each half');
    }
    // Looking through them: along their axis, the eye just behind the eyecups.
    const sg = new Sighting(guns[0], WEAPONS[id], new Atmosphere(0, 15));
    sg.setRangeIndex(0);
    assert.ok(sg.losDir.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9);
    assert.ok(Math.abs(sg.eye.z - (guns[0].anchors.scopeEye.z + WEAPONS[id].optic.eyeRelief)) < 1e-9);
  }
});

test('binoculars fire nothing, load nothing, and are kept in their own slot', () => {
  const w = new Weapon(WEAPONS.binoc_ge);
  assert.equal(w.ammo, null);
  assert.equal(w.loaded, 0);
  assert.equal(w.reserveRounds, 0);
  assert.equal(w.canReload(), false);
  assert.equal(w.startReload(), false);
  assert.equal(w.scope, WEAPONS.binoc_ge.optic, 'raised: the view through them');
  w.setTrigger(true);
  let shots = 0;
  for (let i = 0; i < 120; i++) shots += w.update(1 / 120);
  assert.equal(shots, 0);
  assert.deepEqual(w.takeEvents(), [], 'not even a click');
  const pickups = new Pickups({ time: 0, world: { hf: { getHeight: () => 0 } } });
  assert.equal(pickups.slotFor(w), 6);
});

// --- Spotting, in the real town ------------------------------------------------------
const g = await makeBattle({ perSide: 3, seed: 5 });
g.mode.update = () => {};
g._playerDeploy = () => {};
g.spotting = new Spotting(g);
const coll = g.world.collision;
const ground = (x, z) => g.world.hf.getHeight(x, z);
const spotter = g.player.soldier;
const ally = g.soldiers.find((s) => s.team === ATT && s !== spotter && s.brain);
const enemy = g.soldiers.find((s) => s.team === DEF);
const foeBot = g.soldiers.find((s) => s.team === DEF && s !== enemy && s.brain);
for (const s of g.soldiers) {
  s.alive = [spotter, ally, enemy, foeBot].includes(s);
  s.respawnT = 1e9;
}
const put = (s, x, z) => {
  s.body.x = x;
  s.body.z = z;
  s.body.y = ground(x, z);
  s.body.vx = s.body.vz = 0;
};
const eyeOf = (s) => s.body.eyePosition(new THREE.Vector3());
const chest = (s) => new THREE.Vector3(s.body.x, s.body.y + 1.25, s.body.z);

// Places in the village: one where the spotter sees a man standing 25 to 80 m
// off, one where a wall stands between them (both lines to his head and chest
// meet something solid that is not a bush or hedge).
const hit = new RayHit();
const wallBetween = (e, x, y, z) =>
  [1.5, 1.0].every((h) => {
    const dx = x - e.x,
      dy = y + h - e.y,
      dz = z - e.z;
    const l = Math.hypot(dx, dy, dz);
    return coll.raycast(e.x, e.y, e.z, dx / l, dy / l, dz / l, l - 0.3, hit, FLAG_SIGHT, true) && !hit.box?.dense;
  });
function findCase(wantWall) {
  const rng = new RNG(wantWall ? 11 : 7);
  const centers = g.mode.points.map((p) => [p.x, p.z]);
  for (let k = 0; k < 4000; k++) {
    const [cx, cz] = centers[k % centers.length];
    const sx = cx + (rng.next() - 0.5) * 80,
      sz = cz + (rng.next() - 0.5) * 80;
    if (!g.nav.walkable(sx, sz)) continue;
    const a = rng.next() * Math.PI * 2,
      d = 25 + rng.next() * 55;
    const ex = sx + Math.cos(a) * d,
      ez = sz + Math.sin(a) * d;
    if (!g.nav.walkable(ex, ez)) continue;
    put(spotter, sx, sz);
    const eye = eyeOf(spotter);
    const ey = ground(ex, ez);
    const hidden = hiddenAt(coll, eye, ex, ey, ez, 0);
    if (wantWall ? hidden && wallBetween(eye, ex, ey, ez) : !hidden) return { sx, sz, ex, ez };
  }
  throw new Error('no place found');
}
function setup(c) {
  put(spotter, c.sx, c.sz);
  put(enemy, c.ex, c.ez);
  put(ally, c.sx + 3, c.sz + 3);
  put(foeBot, c.ex + 2, c.ez + 2);
  spotter.weapons[6] = new Weapon(WEAPONS.binoc_us);
  spotter.current = 6;
  spotter.aiming = true;
  for (const s of [ally, foeBot]) {
    s.brain.aware.clear();
    s.brain.lastSeen.clear();
    s.brain.target = null;
  }
  g.spotting.marks.clear();
  g.spotting.lastTry = -99;
  const eye = eyeOf(spotter);
  return { eye, dir: chest(enemy).sub(eye).normalize() };
}

test('spotting through raised binoculars marks a visible enemy for the bots of the side, for 10 seconds', () => {
  const { eye, dir } = setup(findCase(false));
  // Lowered (or still coming up): nothing.
  spotter.aiming = false;
  assert.equal(g.spotting.trySpot(spotter, { eye, dir, raised: 0 }), null);
  spotter.aiming = true;
  g.spotting.lastTry = -99;
  assert.equal(g.spotting.trySpot(spotter, { eye, dir, raised: 0.4 }), null);
  assert.equal(ally.brain.aware.get(enemy), undefined);
  // Raised to the eyes: spotted.
  g.spotting.lastTry = -99;
  assert.equal(g.spotting.trySpot(spotter, { eye, dir, raised: 1 }), enemy);
  assert.deepEqual(g.spotting.marked(ATT).map((m) => m.e), [enemy]);
  assert.equal(g.spotting.marked(DEF).length, 0, 'the other side is told nothing');
  assert.ok(ally.brain.aware.get(enemy) >= 1, 'the bots of the side know of him');
  const ls = ally.brain.lastSeen.get(enemy);
  assert.ok(ls && Math.hypot(ls.x - enemy.body.x, ls.z - enemy.body.z) < 0.01, 'and where he is');
  assert.equal(foeBot.brain.aware.get(enemy), undefined);
  // He moves on and the ally forgets (out of sight): the mark keeps them told.
  const t0 = g.time;
  put(enemy, enemy.body.x + 4, enemy.body.z);
  ally.brain.aware.set(enemy, 0.2);
  g.time = t0 + SPOT_TIME - 1;
  g.spotting.update(0.5);
  assert.ok(ally.brain.aware.get(enemy) >= 1);
  assert.ok(Math.abs(ally.brain.lastSeen.get(enemy).x - enemy.body.x) < 0.01, 'his new place');
  // After 10 seconds the mark is gone.
  g.time = t0 + SPOT_TIME + 0.1;
  g.spotting.update(0.5);
  assert.equal(g.spotting.marked(ATT).length, 0);
  // Looking well off to the side of him: nothing.
  g.spotting.lastTry = -99;
  const off = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  assert.equal(g.spotting.trySpot(spotter, { eye, dir: off, raised: 1 }), null);
});

test('an enemy behind a wall cannot be spotted', () => {
  const { eye, dir } = setup(findCase(true));
  assert.equal(g.spotting.trySpot(spotter, { eye, dir, raised: 1 }), null);
  assert.equal(g.spotting.marked(ATT).length, 0);
  assert.equal(ally.brain.aware.get(enemy), undefined);
});
