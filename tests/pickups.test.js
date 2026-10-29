// Weapons on the ground: dropped by the dead with their ammunition, picked up
// within reach (swapping for the gun in the same slot), gone after a while.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pickups } from '../src/game/pickups.js';
import { Weapon } from '../src/weapons/weapon.js';
import { WEAPONS } from '../src/weapons/defs.js';

function setup() {
  const game = { time: 0, world: { hf: { getHeight: () => 0 } } };
  const pickups = new Pickups(game);
  const soldier = (x, z, ids) => ({ alive: true, vehicle: null, throwing: null, body: { x, y: 0, z }, weapons: ids.map((id) => (id ? new Weapon(WEAPONS[id]) : null)), current: 0 });
  return { game, pickups, soldier };
}

test('the dead drop their main weapon with the ammunition left in it, and get a fresh one', () => {
  const { pickups, soldier } = setup();
  const s = soldier(10, 10, ['mp40', 'p38', 'stielhandgranate24']);
  const w = s.weapons[0];
  w.spareMags.length = 2; // used some
  const d = pickups.dropFrom(s);
  assert.equal(d.w, w, 'his own gun, as it was');
  assert.equal(d.w.spareMags.length, 2);
  assert.ok(Math.hypot(d.x - 10, d.z - 10) < 1, 'beside him');
  assert.notEqual(s.weapons[0], w);
  assert.equal(s.weapons[0].def.id, 'mp40', 'a fresh one of the same kind for next time');
  assert.equal(s.gunDropped, true);
});

test('within reach on foot you can pick it up; it goes in its slot and yours is left there', () => {
  const { pickups, soldier } = setup();
  const dead = soldier(0, 0, ['mp40', 'p38', null]);
  const d = pickups.dropFrom(dead);
  const me = soldier(d.x + 3, d.z, ['m1_garand', 'm1911a1', 'mk2_grenade']);
  assert.equal(pickups.nearest(me), null, 'out of reach');
  me.body.x = d.x + 1;
  assert.equal(pickups.nearest(me).d, d);
  me.vehicle = {};
  assert.equal(pickups.nearest(me), null, 'not from a vehicle');
  me.vehicle = null;
  const garand = me.weapons[0];
  const slot = pickups.take(me, d);
  assert.equal(slot, 0);
  assert.equal(me.weapons[0].def.id, 'mp40');
  assert.equal(pickups.list.length, 1, 'only the Garand lies there now');
  assert.equal(pickups.list[0].w, garand);
  // A sidearm goes in the sidearm slot.
  const p = pickups.put(new Weapon(WEAPONS.p38), me.body.x, me.body.z);
  assert.equal(pickups.take(me, p), 1);
  assert.equal(me.weapons[1].def.id, 'p38');
});

test('weapons on the ground go after two minutes', () => {
  const { game, pickups, soldier } = setup();
  pickups.dropFrom(soldier(0, 0, ['kar98k']));
  game.time = 60;
  pickups.update();
  assert.equal(pickups.list.length, 1);
  game.time = 125;
  pickups.update();
  assert.equal(pickups.list.length, 0);
});

test('coming back in, a soldier has his own loadout again, not what he picked up', async () => {
  const { Soldier } = await import('../src/game/soldier.js');
  const { pickups, soldier } = setup();
  const me = soldier(0, 0, ['m1_garand', 'm1911a1', 'mk2_grenade']);
  me.loadout = ['m1_garand', 'm1911a1', 'mk2_grenade'];
  me._updateLoad = () => {};
  me._arm = Soldier.prototype._arm;
  const grenades = me.weapons[2];
  pickups.take(me, pickups.put(new Weapon(WEAPONS.mp40), 0, 0));
  pickups.take(me, pickups.put(new Weapon(WEAPONS.p38), 0, 0));
  assert.deepEqual(me.weapons.map((w) => w.def.id), ['mp40', 'p38', 'mk2_grenade']);
  Soldier.prototype.rearm.call(me);
  assert.deepEqual(me.weapons.map((w) => w.def.id), ['m1_garand', 'm1911a1', 'mk2_grenade']);
  assert.equal(me.weapons[2], grenades, 'what was his own all along is left as it was');
});

test('kills by running over, by fire, or by bleeding out later count for whoever caused them', async () => {
  const { Game } = await import('../src/game/game.js');
  const { Soldier } = await import('../src/game/soldier.js');
  let marks = 0;
  const game = { time: 0, player: null, hud: { hitMarker: (k) => k === 2 && marks++, killFeed() {} } };
  game.onDeath = (s, cause) => Game.prototype.onDeath.call(game, s, cause);
  const man = (team, name) => Object.assign(Object.create(Soldier.prototype), { game, team, name, alive: true, health: 100, kills: 0, deaths: 0, score: 0, weapons: [], vehicle: null, bleed: 0 });
  const me = man(0, 'You');
  game.player = { soldier: me };
  // Run over: the driver gets the kill and the kill mark.
  const a = man(1, 'A');
  a.damage(150, { kind: 'vehicle', attacker: me, weapon: { name: 'Willys MB' } });
  assert.equal(me.kills, 1);
  assert.equal(marks, 1);
  // Wounded, then bled out half a minute later: still his kill.
  const b = man(1, 'B');
  b.damage(40, { kind: 'bullet', attacker: me, weapon: { name: 'M1 Garand' } });
  game.time = 30;
  b.health = 0;
  b.bleedOut();
  assert.equal(me.kills, 2);
  assert.equal(marks, 2);
  assert.equal(me.score, 10);
});
