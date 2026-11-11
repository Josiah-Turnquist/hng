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

// What an upgrade does in a fight: the damage of a hit at each distance (the
// energy the bullet still has, times the upgrade's scale), and with it the
// hits a man takes in the chest, the belly and a limb.
const FAR = [5, 15, 30, 50, 75, 100, 150, 200, 300, 400];
const ZONE = [1.15, 1.0, 0.55];
const flown = new Map();
async function hitsAt(def) {
  const { AMMO } = await import('../src/weapons/ammo.js');
  const { trajectory } = await import('../src/ballistics/solver.js');
  const { Atmosphere } = await import('../src/ballistics/atmosphere.js');
  const { bulletDamage } = await import('../src/game/soldier.js');
  const ammo = AMMO[def.ammo];
  const key = `${def.ammo}|${def.mv}`;
  if (!flown.has(key)) flown.set(key, trajectory(ammo, def.mv, 0.002, new Atmosphere(), FAR, { step: 0.002 }).map((p) => 0.5 * ammo.mass * p.speed * p.speed));
  const e = flown.get(key);
  return FAR.map((d, i) => bulletDamage(e[i] ?? 0, ammo.diameter) * damageScale(def, d));
}
const fewerHits = (now, stock) => now.some((d, i) => ZONE.some((z) => Math.ceil(100 / (d * z)) < Math.ceil(100 / (stock[i] * z))));

test('upgrades: every part gives the gun something back', async () => {
  // The original's numbers were made for its own rules. Under ours a good
  // many parts cost credits and handling and gave nothing: a barrel that only
  // added range, a quicker trigger on a rifle that already fires as fast as a
  // finger. Each part on each gun must now do at least one thing worth having.
  const { paceOf } = await import('../src/weapons/upgrades.js');
  const none = [];
  for (const gun of Object.keys(GUN_UPGRADES)) {
    const base = WEAPONS[gun];
    const stock = await hitsAt(base);
    for (const u of upgradesOf(gun)) {
      if (u.slot === 'ammo' || u.family) continue;
      const d = upgradedDef(gun, { [u.slot]: u.id });
      const gain =
        fewerHits(await hitsAt(d), stock) ||
        paceOf(d, base) >= 1.05 ||
        d.recoil.rise / (base.recoil?.rise ?? 1) <= 0.92 ||
        d.recoilSettle >= 1.1 ||
        d.accuracy / base.accuracy <= 0.92 ||
        d.mv / base.mv >= 1.03;
      if (!gain) none.push(`${gun} ${u.name}`);
    }
  }
  assert.deepEqual(none, []);
});

test('upgrades: range is bullet speed, and a quick trigger on a self-loader is a quick return to the aim', async () => {
  const { paceOf, punch } = await import('../src/weapons/upgrades.js');
  // The Garand's Stainless Steel Barrel: 5% more range and nothing else good.
  const garand = WEAPONS.m1_garand;
  const barrel = upgradesOf('m1_garand').find((u) => u.name === 'Stainless Steel Barrel');
  assert.deepEqual([barrel.f.rangeNear, barrel.f.rangeFar, barrel.f.damage], [1.05, 1.05, undefined]);
  const b = upgradedDef('m1_garand', { barrel: barrel.id });
  assert.ok(Math.abs(b.mv / garand.mv - 1.05) < 0.002, `speed ${b.mv}`);
  assert.ok(punch(b, garand, 20) > 1.04 && punch(b, garand, 200) > 1.04);
  assert.ok(fewerHits(await hitsAt(b), await hitsAt(garand)), 'a hit less somewhere');
  // A lightened bolt gives speed up for its quicker action.
  const light = upgradesOf('kar98k').find((u) => u.name === 'Lightened Bolt');
  const lb = upgradedDef('kar98k', { internal: light.id });
  assert.ok(lb.mv < WEAPONS.kar98k.mv && paceOf(lb, WEAPONS.kar98k) > 1.1);
  // The Garand fires as fast as a finger: its trigger job is no faster shot
  // to shot, and brings the sights back sooner than the kick's own change.
  const job = upgradesOf('m1_garand').find((u) => u.name === 'Field Trigger Job');
  const j = upgradedDef('m1_garand', { trigger: job.id });
  assert.equal(paceOf(j, garand), 1);
  assert.ok(j.recoilSettle > 1.15 && j.recoilSettle > 1 / job.f.recoilTime + 0.05, `settle ${j.recoilSettle}`);
  // The Thompson's rate of fire is the gun's: the same job is more rounds a minute.
  const tj = upgradesOf('thompson_m1a1').find((u) => u.name === 'Field Trigger Job');
  const t = upgradedDef('thompson_m1a1', { trigger: tj.id });
  assert.ok(paceOf(t, WEAPONS.thompson_m1a1) > 1.05);
  assert.ok(Math.abs(t.recoilSettle - 1 / tj.f.recoilTime) < 1e-9);
  // A revolver's slow action is felt, so there it is the rate of fire.
  assert.ok(paceOf(upgradedDef('nagant_m1895', { trigger: 'u21' }), WEAPONS.nagant_m1895) > 1.05);
});

test('upgrades: every round has a use, and a harder-hitting round goes through more plate', async () => {
  const none = [];
  for (const [gun, e] of Object.entries(GUN_UPGRADES)) {
    const base = WEAPONS[gun];
    const stock = await hitsAt(base);
    for (const id of e.rounds) {
      const d = upgradedDef(gun, { ammo: id });
      // Fewer hits somewhere, or enough more punch near or far to get there with a barrel.
      const gain = fewerHits(await hitsAt(d), stock) || damageScale(d, 20) >= 1.03 || damageScale(d, 500) >= 1.03;
      if (!gain) none.push(`${gun} ${AMMO_TYPES[id].name}`);
    }
  }
  assert.deepEqual(none, []);
  // The anti-tank rifle against a plate at 100 m: the hot round pierces more.
  const { ProjectileSystem } = await import('../src/ballistics/projectiles.js');
  const { Atmosphere } = await import('../src/ballistics/atmosphere.js');
  const { AMMO } = await import('../src/weapons/ammo.js');
  const pierced = (def) => {
    let pen = 0;
    const plate = (ox, oy, oz, dx, dy, dz, max) => (ox < 100 && ox + dx * max >= 100 ? { t: (100 - ox) / dx, tExit: (100.03 - ox) / dx, nx: -1, ny: 0, nz: 0, material: 'armor', armorMM: 30 } : null);
    const sys = new ProjectileSystem({ world: null, atmosphere: new Atmosphere(), dynamicRaycast: plate });
    sys.onImpact = (p, info) => (pen ||= info.penMM || 0);
    sys.fire({ x: 0, y: 50, z: 0, vx: def.mv, vy: 0, vz: 0, ammo: AMMO[def.ammo], weapon: def });
    for (let i = 0; i < 60 && !pen; i++) sys.update(1 / 120);
    return pen;
  };
  const stock = pierced(WEAPONS.ptrd41);
  const hot = pierced(upgradedDef('ptrd41', { ammo: 'a48' }));
  assert.ok(stock > 20, `stock ${stock}`);
  assert.ok(hot > stock * 1.1 && hot < stock * 1.2, `${stock} -> ${hot}`);
});
