// Close-combat weapons: every knife, bayonet, spade and bat has a model at each
// level of detail held at its handle; a blow lands on the man in front within
// reach and not beyond it, nor through a wall; a knife kills with one stab, a
// spade with one blow to the head or two to the body; each blow counts toward
// the player's ribbons; a quick blow goes back to the gun in hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MODELS, buildGun } from '../src/weapons/models/index.js';
import { WEAPONS, LOADOUT_SLOTS } from '../src/weapons/defs.js';
import { MELEE } from '../src/weapons/items/melee.js';
import { Weapon } from '../src/weapons/weapon.js';
import { Soldier } from '../src/game/soldier.js';
import { Game } from '../src/game/game.js';
import { startAttack, updateMelee, zoneClass } from '../src/game/melee.js';

const mats = new Proxy({}, {
  get: (t, k) => {
    if (!t[k]) {
      t[k] = new THREE.MeshStandardMaterial();
      t[k].userData.texWorld = 0.3;
      t[k].userData.lowColor = [0.1, 0.1, 0.1];
    }
    return t[k];
  },
});

// A battle of two (or more) on open, flat ground, with the game's own damage
// and death rules (kills, the kill feed, the ribbon tally). wallAt: a wall
// across the way that far ahead of the first man's eyes.
function setup({ wallAt = null } = {}) {
  const feed = [];
  const shots = [];
  const collision = {
    raycast(ox, oy, oz, dx, dy, dz, maxDist, hit) {
      if (wallAt === null || dz >= 0) return false;
      const t = (-wallAt - oz) / dz;
      if (t < 0 || t > maxDist) return false;
      hit.t = t;
      return true;
    },
  };
  const game = {
    time: 0,
    soldiers: [],
    world: { hf: { getHeight: () => 0 }, collision },
    hud: { killFeed: (a, s, cause) => feed.push({ a, s, cause }), hitMarker() {}, killConfirm() {} },
    ribbonTally: { shot: (def, s) => shots.push(def.id), damage() {}, kill() {}, assist() {} },
  };
  game.onDamage = (s, amount, cause) => Game.prototype.onDamage.call(game, s, amount, cause);
  game.onDeath = (s, cause) => Game.prototype.onDeath.call(game, s, cause);
  const man = (team, x, z, yaw, melee = 'knife_m3') => {
    const loadout = LOADOUT_SLOTS.map(() => null);
    loadout[0] = 'm1_garand';
    loadout[5] = melee;
    const s = new Soldier(game, { faction: team ? 'GE' : 'US', team, loadout, x, z, name: team ? 'Him' : 'You' });
    s.yaw = s.body.yaw = yaw;
    game.soldiers.push(s);
    return s;
  };
  const me = man(0, 0, 0, 0);
  game.player = { soldier: me };
  me.tally = game.ribbonTally;
  // A blow from start to finish, in the game's steps.
  const blow = (s, w = s.weapons[5], opts) => {
    assert.ok(startAttack(s, w, opts), 'the blow starts');
    for (let i = 0; i < 240 && s.melee; i++) {
      game.time += 1 / 120;
      updateMelee(game, s, 1 / 120);
    }
    assert.equal(s.melee, null, 'and is over');
  };
  return { game, me, man, blow, feed, shots };
}

// Look at a point (x, y, z) from the man's eyes.
function lookAt(s, x, y, z) {
  const e = s.body.eyePosition({ x: 0, y: 0, z: 0 });
  s.yaw = Math.atan2(-(x - e.x), -(z - e.z));
  s.pitch = Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z));
}

test('every close-combat weapon is in its slot, has a model at each level of detail, and is held at its handle', () => {
  const ids = Object.keys(MELEE);
  assert.equal(ids.length, 10);
  for (const id of ids) {
    const d = WEAPONS[id];
    assert.equal(d.type, 'melee');
    assert.equal(d.slot, 'closecombat');
    assert.equal(LOADOUT_SLOTS[5], 'closecombat');
    assert.deepEqual(d.classes, ['infantry', 'paratrooper', 'recon', 'tanker']);
    assert.equal(d.points, id.startsWith('bat') ? 2 : 1);
    assert.ok(MODELS[id], `${id} has a model`);
    for (const lod of [0, 1, 2]) {
      const g = buildGun(id, mats, { lod });
      let tris = 0;
      g.root.traverse((o) => o.isMesh && (tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3));
      assert.ok(tris > 0 && tris <= [8000, 1500, 400][lod], `${id} LOD ${lod}: ${tris} triangles (a pistol's budget)`);
      assert.ok(g.anchors.gripR.length() < 1e-9, `${id}: the hand at the origin`);
      assert.equal(g.meta.gripRake, Math.PI / 2, `${id}: the handle runs through the fist`);
      // Its real length, from the point to the far end of the handle (the far
      // models leave out small parts such as a knife's pommel).
      const box = new THREE.Box3().setFromObject(g.root);
      const len = box.max.z - box.min.z;
      if (lod === 0) assert.ok(Math.abs(len - d.length) < d.length * 0.03, `${id}: ${len.toFixed(3)} m long, the real one ${d.length} m`);
      assert.ok(Math.abs(g.anchors.muzzle.z - box.min.z) < 0.01, `${id}: the tip anchor at the point`);
    }
    // A Weapon with nothing to load or fire.
    const w = new Weapon(d);
    assert.equal(w.ammo, null);
    assert.equal(w.canReload(), false);
    w.setTrigger(true);
    assert.equal(w.update(0.1), 0);
  }
});

test('one stab with a knife kills a man in front of you', () => {
  const { me, man, blow, feed } = setup();
  const him = man(1, 0, -0.75, Math.PI);
  lookAt(me, 0, 1.3, -0.75); // his chest
  blow(me);
  assert.equal(him.alive, false, 'dead of one stab');
  assert.equal(me.kills, 1, 'the kill is his');
  assert.equal(feed.length, 1);
  assert.equal(feed[0].cause.kind, 'melee');
  assert.equal(feed[0].cause.weapon.id, 'knife_m3');
  assert.equal(zoneClass(feed[0].cause.part), 'body');
});

test('a spade takes two blows to the body, one to the head', () => {
  const { me, man, blow } = setup();
  me.weapons[5] = new Weapon(WEAPONS.spade_m1910);
  const him = man(1, 0, -0.9, Math.PI);
  lookAt(me, 0, 1.25, -0.9);
  blow(me);
  assert.ok(him.alive, 'still standing after one');
  assert.ok(him.health > 30 && him.health < 60, `health ${him.health}`);
  blow(me);
  assert.equal(him.alive, false, 'down after the second');
  assert.equal(me.kills, 1);
  const other = man(1, 0.0, -0.9, Math.PI);
  lookAt(me, 0, other.body.eyePosition({}).y + 0.02, -0.9);
  blow(me);
  assert.equal(other.alive, false, 'one blow to the head');
});

test('nothing is hit beyond reach, nor through a wall', () => {
  const { me, man, blow } = setup();
  const him = man(1, 0, -1.6, Math.PI);
  lookAt(me, 0, 1.3, -1.6);
  blow(me); // a knife reaches about 1 m
  assert.equal(him.health, 100, 'a knife 1.6 m short');
  me.weapons[5] = new Weapon(WEAPONS.bat_us);
  him.body.z = -2.1;
  lookAt(me, 0, 1.3, -2.1);
  blow(me);
  assert.equal(him.health, 100, 'a bat 2.1 m short');
  him.body.z = -1.2;
  lookAt(me, 0, 1.3, -1.2);
  blow(me);
  assert.ok(him.health < 100, 'the bat reaches 1.2 m');
  // A wall half a meter ahead.
  const w = setup({ wallAt: 0.4 });
  const them = w.man(1, 0, -0.75, Math.PI);
  lookAt(w.me, 0, 1.3, -0.75);
  w.blow(w.me);
  assert.equal(them.health, 100, 'not through the wall');
  // Nor his own side.
  const s2 = setup();
  const friend = s2.man(0, 0, -0.75, Math.PI);
  lookAt(s2.me, 0, 1.3, -0.75);
  s2.blow(s2.me);
  assert.equal(friend.health, 100, 'not a man of his own side');
});

test('each blow of the player counts toward his ribbons (as a shot), a bot\'s does not', () => {
  const { me, man, blow, shots } = setup();
  blow(me);
  blow(me);
  assert.deepEqual(shots, ['knife_m3', 'knife_m3']);
  const bot = man(1, 5, 5, 0, 'spade_ge');
  blow(bot);
  assert.equal(shots.length, 2);
});

test('a quick blow from the gun in hand goes back to it', () => {
  const { man, blow } = setup();
  const bot = man(1, 5, 5, 0, 'bayonet_s84_98');
  bot.current = 5;
  blow(bot, bot.weapons[5], { back: 0 });
  assert.equal(bot.current, 0, 'the rifle again');
  // The blows come no faster than the weapon's own time for one.
  for (const d of Object.values(MELEE)) {
    assert.ok(d.attack.period >= 0.5 && d.attack.period <= 0.95, `${d.name}: ${d.attack.period} s a blow`);
    assert.ok(d.attack.hit > 0.1 && d.attack.hit < d.attack.period * 0.6, `${d.name}: lands ${d.attack.hit} s in`);
  }
});
