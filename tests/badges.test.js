// Combat badges, as in the original game: their tiers open at levels of the
// soldier's ribbons, he wears one, and it changes what it says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BADGES, badgeTiers, badgeOf, wearable, badgeValue } from '../src/game/badges.js';
import { Weapon } from '../src/weapons/weapon.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { RIBBON_XP } from '../src/game/ribbons.js';

const at = (level) => RIBBON_XP[level];

test("a badge's tiers open at its ribbon's levels, as in the game data", () => {
  const s = { ribbons: { combatMovement: at(8) } };
  const q = badgeTiers(s, 'quickdraw');
  assert.deepEqual(q.map((t) => t.open), [true, true, false]);
  assert.deepEqual(q.map((t) => t.value), [0.75, 0.62, 0.5]);
  s.badge = 'quickdraw';
  assert.deepEqual(badgeOf(s), { id: 'quickdraw', tier: 2, value: 0.62 });
  assert.ok(wearable(s).includes('quickdraw'));
  assert.ok(!wearable(s).includes('hoarder'));
  // The Mechanic opens by Driver or by Tank Driver.
  assert.equal(badgeTiers({ ribbons: { tankDriver: at(3) } }, 'mechanic')[0].open, true);
  assert.equal(badgeTiers({ ribbons: { driver: at(3) } }, 'mechanic')[0].open, true);
  // A badge he hasn't opened can't be worn.
  assert.equal(badgeOf({ ribbons: {}, badge: 'quickdraw' }), null);
  for (const b of Object.values(BADGES)) assert.equal(b.tiers.length % 3, 0, b.name);
});

test('badges change what they say: spare magazines, reloading, blasts', async () => {
  const { Soldier } = await import('../src/game/soldier.js');
  const arm = (badge, id, i) => Soldier.prototype._arm.call({ badge }, id, i);
  const plain = arm(null, 'm1_garand', 0);
  const hoard = arm({ id: 'hoarder', value: 2 }, 'm1_garand', 0);
  assert.equal(hoard.clips, plain.clips + 2);
  assert.equal(arm({ id: 'hoarder', value: 2 }, 'm1911a1', 1).spareMags.length, new Weapon(WEAPONS.m1911a1).spareMags.length, 'only his main weapon');
  const fast = arm({ id: 'fastReload', value: 0.7 }, 'thompson_m1a1', 0);
  fast.mag = 0;
  fast.startReload();
  const slow = arm(null, 'thompson_m1a1', 0);
  slow.mag = 0;
  slow.startReload();
  const total = (w) => w.sequence.steps.reduce((n, s) => n + s.t, 0);
  assert.ok(Math.abs(total(fast) / total(slow) - 0.7) < 1e-9);
  assert.equal(badgeValue({ badge: { id: 'heavySet', value: 0.85 } }, 'heavySet', 1), 0.85);
  assert.equal(badgeValue({ badge: { id: 'heavySet', value: 0.85 } }, 'ghillie', 1), 1);
});
