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
