import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, AMMO_TYPES, GUN_UPGRADES, PRICES } from '../src/weapons/upgradeData.js';
import { upgradesOf, upgradedDef, damageScale, upgradeOpen, describe, UPGRADE_SLOTS } from '../src/weapons/upgrades.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { priceOf, owns, buy, buyUpgrade, picksOf, fit, battleCredits, checkArmory, loadoutUpgrades } from '../src/game/armory.js';

test("upgrades: the original's data, every gun and upgrade known", () => {
  for (const [gun, e] of Object.entries(GUN_UPGRADES)) {
    for (const id of e.upgrades) assert.ok(UPGRADES[id], `${gun} ${id}`);
    for (const id of [e.ammo, ...e.rounds]) assert.ok(AMMO_TYPES[id], `${gun} ${id}`);
  }
  for (const u of Object.values(UPGRADES)) {
    assert.ok(UPGRADE_SLOTS.includes(u.slot));
    assert.ok(u.credits > 0, u.name);
  }
  // The Kar 98k takes the ZS Zielacht in five reticles, 8x.
  const z = upgradesOf('kar98k').filter((u) => u.family === 'zielacht');
  assert.equal(z.length, 5);
  assert.ok(z.every((u) => u.mag === 8));
  assert.equal(PRICES.m1_garand, 24000);
});

test('upgrades: levels run 0 to 8 by price, opened by the gun\'s Specialist ribbon', () => {
  const list = upgradesOf('m1_garand');
  assert.ok(list.some((u) => u.level === 0) && list.some((u) => u.level === 8));
  const dear = list.reduce((a, b) => (b.credits > a.credits ? b : a));
  assert.equal(dear.level, 8);
  const s = { ribbons: {} };
  assert.equal(upgradeOpen(s, 'm1_garand', dear.id), false);
  s.ribbons['spec:m1_garand'] = 1e9;
  assert.equal(upgradeOpen(s, 'm1_garand', dear.id), true);
  // A scoped rifle takes no second scope; its upgrades open with its rifle's ribbon.
  assert.ok(!upgradesOf('gewehr43_zf4').some((u) => u.family));
  assert.ok(upgradesOf('gewehr43').some((u) => u.family === 'zf4'));
});

test('upgrades: what they do to the gun', () => {
  const stock = WEAPONS.kar98k;
  assert.equal(upgradedDef('kar98k', {}), stock);
  // Heavy spring: less kick, slower bolt.
  const spring = upgradesOf('kar98k').find((u) => u.name === 'Heavy Spring');
  const d = upgradedDef('kar98k', { internal: spring.id });
  assert.ok(d.recoil.rise < stock.recoil.rise);
  assert.ok(d.bolt.cycle > stock.bolt.cycle);
  // Match sights: tighter spread.
  const match = upgradesOf('kar98k').find((u) => u.name === 'Match Sights');
  assert.ok(upgradedDef('kar98k', { sight: match.id }).accuracy < stock.accuracy);
  // A barrel that adds damage close in.
  const scout = upgradesOf('kar98k').find((u) => u.name === 'Scout II');
  const sd = upgradedDef('kar98k', { barrel: scout.id });
  assert.ok(damageScale(sd, 20) > 1.2);
  assert.equal(damageScale(stock, 20), 1);
  // A scope makes a scoped rifle with its model, magnification and reticle.
  const zs = upgradesOf('kar98k').find((u) => u.name === 'ZS Zielacht (German#4)');
  const zd = upgradedDef('kar98k', { sight: zs.id });
  assert.equal(zd.model, 'kar98k+zielacht');
  assert.equal(zd.scope.mag, 8);
  assert.equal(zd.scope.reticle, 'german4');
  assert.equal(zd.sight.kind, 'scope');
  assert.ok(zd.clipsBlocked);
  assert.ok(zd.sight.ranges.includes(zd.sight.zero));
  // An upgrade it doesn't take is ignored.
  assert.equal(upgradedDef('kar98k', { sight: 'u96' }), stock);
  assert.ok(describe('kar98k', scout.id).some((x) => x.good) && describe('kar98k', scout.id).some((x) => !x.good));
});

test('armory: credits buy opened guns and upgrades once; the kit is free', () => {
  const r = { credits: 0 };
  const s = { faction: 'US', cls: 'infantry', ribbons: {}, armory: {}, loadout: ['m1_garand', 'm1911a1', 'mk2_grenade', null, null, null, null] };
  assert.ok(owns(s, 'm1_garand') && owns(s, 'm1911a1'));
  assert.equal(owns(s, 'thompson_m1a1'), false);
  s.ribbons.infantryAssault = 1e9;
  s.ribbons.smgAssault = 1e9;
  assert.equal(buy(r, s, 'thompson_m1a1'), false, 'no credits');
  r.credits = battleCredits(50000);
  assert.equal(r.credits, 185000);
  assert.ok(buy(r, s, 'thompson_m1a1'));
  assert.equal(r.credits, 185000 - priceOf('thompson_m1a1'));
  assert.equal(buy(r, s, 'thompson_m1a1'), false, 'once');
  // An upgrade: open, bought, fitted.
  const up = upgradesOf('m1_garand').find((u) => u.name === 'Heavy Spring');
  assert.equal(buyUpgrade(r, s, 'm1_garand', up.id), false, 'not open yet');
  s.ribbons['spec:m1_garand'] = 1e9;
  assert.ok(buyUpgrade(r, s, 'm1_garand', up.id));
  assert.deepEqual(picksOf(s, 'm1_garand'), {});
  assert.ok(fit(s, 'm1_garand', up.slot, up.id));
  assert.deepEqual(picksOf(s, 'm1_garand'), { [up.slot]: up.id });
  assert.deepEqual(loadoutUpgrades(s, s.loadout), { m1_garand: { [up.slot]: up.id } });
  assert.equal(fit(s, 'm1_garand', 'trigger', 'u999'), false);
  // A scoped rifle the original made with a scope upgrade: the rifle and the scope.
  assert.ok(priceOf('gewehr43_zf4') > priceOf('gewehr43'));
  // Saved before the shop: he owns what he carries.
  const old = { faction: 'GE', cls: 'infantry', ribbons: {}, loadout: ['mp40', 'c96', null, null, null, null, null] };
  checkArmory(old);
  assert.ok(owns(old, 'mp40'));
});

test('upgrades: every scope pairing has a model and the same mount as its model file', async () => {
  const { SCOPE_MOUNTS } = await import('../src/weapons/models/upgradeScopes.js');
  const { MODELS } = await import('../src/weapons/models/index.js');
  const { scopeMount } = await import('../src/weapons/upgrades.js');
  for (const [gun, e] of Object.entries(GUN_UPGRADES)) {
    if (WEAPONS[gun]?.scope) continue;
    for (const id of e.upgrades) {
      const u = UPGRADES[id];
      if (!u.family) continue;
      const key = `${gun}+${u.family}`;
      assert.ok(MODELS[key], `model ${key}`);
      const a = scopeMount(gun, u.family),
        b = SCOPE_MOUNTS[key];
      assert.deepEqual([a.clipsBlocked, a.irons, a.mountMass], [b.clipsBlocked, b.irons, b.mountMass], key);
    }
  }
});
