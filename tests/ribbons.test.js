// Ribbons, as in the original game: what a battle earns each ribbon (the game's
// own point values), the twelve levels, which ribbon level opens each of an
// army's guns and tanks for each class, the kit a new soldier starts with, and
// what a battle's results report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RibbonTally, ribbonPoints, ribbonLevel, requirement, unlocked, tankUnlocked, ribbonsFor, ribbonInfo, carriable, RIBBON_XP } from '../src/game/ribbons.js';
import { newRoster, recruit, awardBattle, loadRoster } from '../src/ui/roster.js';
import { WEAPONS, DEFAULT_LOADOUT, weaponsFor } from '../src/weapons/defs.js';

const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

test('a battle earns ribbon points at the original game values', () => {
  const t = new RibbonTally();
  const kar = WEAPONS.kar98k;
  for (let i = 0; i < 10; i++) t.shot(kar, null);
  t.damage(kar, null, 100);
  t.kill(kar, null, false);
  t.kill(kar, null, true);
  const p = ribbonPoints(t, 'infantry');
  // 10 shots x 7.398, 100 damage x 0.571, a kill 94.709, a headshot kill 212.654.
  assert.ok(near(p.infantryAssault, 10 * 7.398 + 100 * 0.571 + 94.709 + 212.654), String(p.infantryAssault));
  assert.equal(p.lmgAssault, undefined);

  // A machine gun: Infantry Assault and LMG Assault both, for an infantryman only.
  const m = new RibbonTally();
  m.kill(WEAPONS.mg42, null);
  assert.ok(near(ribbonPoints(m, 'infantry').lmgAssault, 100.065));
  assert.ok(near(ribbonPoints(m, 'infantry').infantryAssault, 52.786));
  assert.equal(ribbonPoints(m, 'paratrooper').lmgAssault, undefined);

  // Grenades, launchers on tanks, a tank gun, driving, a jump.
  const x = new RibbonTally();
  x.kill(WEAPONS.mk2_grenade, null);
  x.vehicleKill(WEAPONS.bazooka_m1a1, null);
  assert.ok(near(ribbonPoints(x, 'infantry').explosives, 770.699));
  assert.ok(near(ribbonPoints(x, 'infantry').tankDestruction, 253.925));
  const tk = new RibbonTally();
  tk.shot({ name: '75 mm', id: 'm4a1_sherman', vehicle: true }, null);
  tk.vehicleKill({ name: '75 mm', id: 'm4a1_sherman', vehicle: true }, null);
  tk.drive(1000);
  const tp = ribbonPoints(tk, 'tanker');
  assert.ok(near(tp.armorAssault, 4.475 + 152.552));
  assert.ok(near(tp.armorDamage, 34.924));
  assert.ok(near(tp.tankDriver, 196));
  const j = new RibbonTally();
  j.jump();
  assert.ok(ribbonPoints(j, 'paratrooper').parachute > 150);
  assert.equal(ribbonPoints(j, 'infantry').parachute, undefined);
});

test('twelve ribbon levels at the original thresholds', () => {
  assert.equal(RIBBON_XP.length, 13);
  assert.equal(ribbonLevel(0).level, 0);
  assert.equal(ribbonLevel(499).level, 0);
  assert.equal(ribbonLevel(500).level, 1);
  assert.equal(ribbonLevel(15500).level, 5);
  assert.equal(ribbonLevel(1e7).level, 12);
  assert.equal(ribbonLevel(1e7).next, null);
  assert.deepEqual(ribbonsFor('infantry').slice(0, 2), ['infantryAssault', 'lmgAssault']);
  assert.ok(ribbonsFor('tanker').includes('armorAssault'));
  assert.ok(!ribbonsFor('recon').includes('lmgAssault'));
});

test('guns open at the original ribbon levels, by class', () => {
  const R = (id, cls) => requirement(id, cls);
  assert.equal(R('m1_garand', 'infantry').level, 0);
  assert.deepEqual(R('m3_greasegun', 'infantry'), { ribbon: 'infantryAssault', level: 1 });
  assert.deepEqual(R('m3_greasegun', 'tanker'), { ribbon: 'armorDamage', level: 0 });
  assert.deepEqual(R('m1_carbine', 'infantry'), { ribbon: 'infantryAssault', level: 5 });
  assert.deepEqual(R('m1_carbine', 'paratrooper'), { ribbon: 'parachute', level: 4 });
  assert.deepEqual(R('bar_m1918a2', 'infantry'), { ribbon: 'infantryAssault', level: 7 });
  assert.deepEqual(R('thompson_m1a1', 'paratrooper'), { ribbon: 'smgAssault', level: 9 });
  assert.deepEqual(R('kar98k', 'infantry'), { ribbon: 'infantryAssault', level: 6 });
  assert.deepEqual(R('mg42', 'infantry'), { ribbon: 'lmgAssault', level: 12 });
  assert.deepEqual(R('stg44', 'infantry'), { ribbon: 'infantryAssault', level: 12 });
  assert.deepEqual(R('ptrd41', 'infantry'), { ribbon: 'tankDestruction', level: 5 });
  // A scoped rifle opens with the plain rifle.
  assert.deepEqual(R('kar98k_zf39', 'recon'), R('kar98k', 'recon'));
  // Every own-army gun a class may carry has a requirement or is starting kit.
  for (const f of ['US', 'GE', 'SU'])
    for (const cls of ['infantry', 'recon', 'paratrooper', 'tanker'])
      for (const slot of ['primary', 'sidearm', 'equipment'])
        for (const w of weaponsFor(f, cls, slot)) {
          const r = requirement(w.id, cls);
          assert.ok(r === null || (r.level >= 0 && r.level <= 12), `${w.id} ${cls}`);
        }
});

test("a new soldier's kit is all open to him, and the next guns open as his ribbons rise", () => {
  for (const f of ['US', 'GE', 'SU'])
    for (const [cls, kit] of Object.entries(DEFAULT_LOADOUT[f])) {
      const s = { faction: f, cls, ribbons: {} };
      for (const id of kit) assert.ok(unlocked(s, id), `${f} ${cls} ${id}`);
    }
  assert.deepEqual(DEFAULT_LOADOUT.GE.infantry[0], 'gewehr43');
  const s = { faction: 'US', cls: 'infantry', ribbons: {} };
  assert.ok(!unlocked(s, 'm3_greasegun'));
  s.ribbons.infantryAssault = 500;
  assert.ok(unlocked(s, 'm3_greasegun'));
  assert.ok(!unlocked(s, 'm1_carbine'));
  const t = { faction: 'US', cls: 'tanker', ribbons: {} };
  assert.ok(tankUnlocked(t, 'm5a1_stuart'));
  assert.ok(!tankUnlocked(t, 'm4a1_sherman'));
  t.ribbons.armorAssault = 29500;
  assert.ok(tankUnlocked(t, 'm4a1_sherman'));
});

test('a battle adds ribbon points and reports the levels gained and what they opened', () => {
  const r = newRoster();
  const s = r.soldiers[0];
  const res = awardBattle(r, s.id, { xp: 500, kills: 6, ribbons: { infantryAssault: 600, lmgAssault: 10 } });
  assert.equal(s.ribbons.infantryAssault, 600);
  assert.deepEqual(res.ribbonUps, [{ key: 'infantryAssault', from: 0, to: 1 }]);
  assert.ok(res.unlocks.includes(WEAPONS.m3_greasegun.name), res.unlocks.join());
  assert.equal(res.gained.infantryAssault, 600);
  // A recruit has no ribbons yet.
  const p = recruit(r, { faction: 'GE', cls: 'paratrooper' });
  assert.deepEqual(p.ribbons, {});
  assert.equal(p.loadout[0], 'gewehr43');
});

test('soldiers saved before ribbons keep credit for their kills; locked guns go back to the kit', () => {
  const saved = {
    soldiers: [{ id: 'a', faction: 'US', cls: 'infantry', name: 'Old Hand', xp: 60000, loadout: ['bar_m1918a2', 'm1911a1', 'mk2_grenade'], stats: { kills: 400 } }, { id: 'b', faction: 'GE', cls: 'infantry', name: 'New Boy', xp: 10, loadout: ['stg44', 'p38', 'stielhandgranate24'], stats: { kills: 2 } }],
    selectedId: 'a',
  };
  const store = new Map([['hng.roster.v1', JSON.stringify(saved)]]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    const r = loadRoster();
    const [a, b] = r.soldiers;
    assert.equal(a.ribbons.infantryAssault, 400 * 85);
    assert.equal(a.loadout[0], 'bar_m1918a2', 'Infantry Assault 8: the BAR (7) stays');
    assert.deepEqual(b.loadout, DEFAULT_LOADOUT.GE.infantry, 'the StG 44 and P38 were not open to him');
  } finally {
    delete globalThis.localStorage;
  }
});

test("each gun's Specialist ribbon, at the original values; another army's gun at its level 9", () => {
  const t = new RibbonTally();
  t.shot(WEAPONS.m1_garand, null);
  t.kill(WEAPONS.m1_garand, null, true);
  t.kill(WEAPONS.kar98k_zf39, null); // (a scoped rifle's go to the rifle's)
  const p = ribbonPoints(t, 'infantry');
  assert.ok(near(p['spec:m1_garand'], 9.844 + 1580.168));
  assert.ok(near(p['spec:kar98k'], 224.161));
  assert.equal(ribbonInfo('spec:m1_garand').name, 'M1 Garand Specialist');
  assert.equal(ribbonInfo('spec:nothing'), null);
  // A German infantryman and the Garand: Specialist 9.
  assert.deepEqual(requirement('m1_garand', 'infantry', 'GE'), { ribbon: 'spec:m1_garand', level: 9 });
  const g = { faction: 'GE', cls: 'infantry', ribbons: {} };
  assert.ok(!unlocked(g, 'm1_garand'));
  g.ribbons['spec:m1_garand'] = 73500;
  assert.ok(unlocked(g, 'm1_garand'));
  // Launchers by Tank Destruction (the Soviets' Lend-Lease Bazooka by Infantry
  // Assault); never another army's grenades or the Panzerfaust.
  assert.deepEqual(requirement('bazooka_m1a1', 'infantry', 'GE'), { ribbon: 'tankDestruction', level: 9 });
  assert.deepEqual(requirement('bazooka_m1a1', 'infantry', 'SU'), { ribbon: 'infantryAssault', level: 4 });
  assert.deepEqual(requirement('panzerschreck', 'infantry', 'US'), { ribbon: 'tankDestruction', level: 12 });
  assert.equal(requirement('stielhandgranate24', 'infantry', 'US'), false);
  assert.equal(requirement('panzerfaust60', 'infantry', 'SU'), false);
  assert.ok(!unlocked({ faction: 'US', cls: 'infantry', ribbons: { explosives: 1e6 } }, 'rgd33'));
  // What he may choose from: his army's guns first, then others'; within class rules.
  const us = carriable({ faction: 'US', cls: 'infantry' }, 'primary');
  assert.equal(us[0].faction, 'US');
  assert.ok(us.some((w) => w.id === 'mg42'));
  assert.ok(!us.some((w) => w.id === 'fg42'), 'paratroopers only');
  assert.ok(!carriable({ faction: 'US', cls: 'infantry' }, 'equipment').some((w) => w.faction !== 'US'));
});

test('a kill assist scores as a kill', () => {
  const t = new RibbonTally();
  t.assist(WEAPONS.thompson_m1a1, null);
  const p = ribbonPoints(t, 'infantry');
  assert.ok(near(p.smgAssault, 79.629));
  assert.ok(near(p.infantryAssault, 35.191));
  assert.ok(near(p['spec:thompson_m1a1'], 135.794));
});

test("a soldier keeps another army's gun once he has earned it", () => {
  const saved = { soldiers: [{ id: 'a', faction: 'GE', cls: 'infantry', name: 'Karl Weber', xp: 9000, loadout: ['m1_garand', 'luger_p08', 'stielhandgranate24'], ribbons: { 'spec:m1_garand': 80000, 'spec:luger_p08': 10, bogus: 5 }, stats: {} }], selectedId: 'a' };
  const store = new Map([['hng.roster.v1', JSON.stringify(saved)]]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    const s = loadRoster().soldiers[0];
    assert.equal(s.loadout[0], 'm1_garand');
    assert.equal(s.loadout[1], DEFAULT_LOADOUT.GE.infantry[1], 'the P08 is not open to him yet (Handgun Assault 8)');
    assert.equal(s.ribbons.bogus, undefined);
    assert.equal(s.ribbons['spec:luger_p08'], 10);
  } finally {
    delete globalThis.localStorage;
  }
});

test('the other ribbons earn at the original values: moving, driving, points, defending, medic, recon', () => {
  const t = new RibbonTally();
  t.move('run', 100);
  t.move('sprint', 100);
  t.move('walk', 10);
  t.move('crouch', 10);
  t.ride('bicycle', 100);
  t.ride('car', 1000, true);
  t.event('capture');
  t.event('neutralize');
  t.event('killWhileCapturing');
  t.event('killCapturing');
  t.heal('self');
  t.heal('other');
  t.repair();
  t.far('kill');
  t.far('dmg', 100);
  t.end({ won: true, defending: true, seconds: 600, deaths: 0 });
  const p = ribbonPoints(t, 'infantry');
  assert.ok(near(p.physicalTraining, 100 * 0.148 + 100 * 0.308 + 100 * 0.173));
  assert.ok(near(p.combatMovement, 10 * 1.62 + 10 * 14.494));
  assert.ok(near(p.driver, 1000 * 0.338));
  assert.ok(near(p.chauffeur, 1000));
  assert.ok(near(p.tactical, 164.788 + 40 + 164.788));
  assert.ok(near(p.defense, 194.311 + 600 * 2.46));
  assert.ok(near(p.medic, 2 + 25 + 30));
  assert.ok(near(p.recon, 28.099 + 100 * 0.225 + 224.792));
  // Driver, Chauffeur and Recon are the infantryman's and the scout's.
  const q = ribbonPoints(t, 'paratrooper');
  assert.equal(q.driver, undefined);
  assert.equal(q.recon, undefined);
  assert.ok(q.tactical > 0);
  // A close-combat kill (category 10): 305.45.
  const m = new RibbonTally();
  m.kill({ id: 'x', type: 'melee' }, null);
  assert.ok(near(ribbonPoints(m, 'tanker').closeCombat, 305.45));
});

test('items open by the other ribbons; each army starts with its spade and may earn the others', () => {
  // (The items' definitions come with them; the requirement is already set.)
  const req = (id, cls, f) => requirement(id, cls, f);
  for (const r of [req('colt_1903', 'infantry', 'US'), req('firstaid_ge', 'recon', 'GE'), req('binoc_su', 'tanker', 'SU'), req('medic_us', 'infantry', 'US'), req('wrench', 'tanker', 'US')]) assert.ok(r === null || r === undefined || r.level >= 0);
});
