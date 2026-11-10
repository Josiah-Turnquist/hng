// The field kit on the soldiers (src/actors/soldierKit*.js, soldierGear.js):
// beside belt, pouches, canteen and tool, many carry what real ones did: the
// German assault frame with its mess tin and rolled shelter quarter, a belt of
// machine gun rounds, the Soviet gas mask bag and mess pot, the US blanket
// roll and gas mask bag. And a man's kit is the same however far off he is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutfit, variantCount, roleOf, carryOf, carryKey } from '../src/actors/soldierKit.js';
import { SoldierModel } from '../src/actors/soldierModel.js';
import { WEAPONS } from '../src/weapons/defs.js';
import '../src/actors/soldierKitUS.js';
import '../src/actors/soldierKitGE.js';
import '../src/actors/soldierKitSU.js';
import { CELL } from '../src/actors/soldierMaterials.js';

// How many of a builder's vertices are of `cell` and where `where(x, y, z)` says.
const count = (b, cell, where) => {
  let n = 0;
  for (let i = 0; i < b.count; i++) if (b.mat[i * 2] === cell && where(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2])) n++;
  return n;
};
const variants = (army, cls) => Array.from({ length: variantCount(army, cls) }, (_, v) => v);

test('a kit takes the same random draws at every level of detail (it does not change as a man comes nearer)', () => {
  let n = 0;
  for (const army of ['US', 'GE', 'SU'])
    for (const cls of ['infantry', 'recon', 'paratrooper', 'tanker'])
      for (const role of ['rifle', 'smg', 'mg', 'mgBelt'])
        for (const v of variants(army, cls)) {
          const infos = [0, 1, 2].map((lod) => buildOutfit(army, cls, v, lod, role).info);
          for (const lod of [1, 2]) {
            assert.equal(infos[lod].draws, infos[0].draws, `${army} ${cls} ${role} variant ${v}: ${infos[lod].draws} draws at detail ${lod}, ${infos[0].draws} at 0`);
            assert.equal(infos[lod].headgear, infos[0].headgear, `${army} ${cls} variant ${v}: headgear`);
            assert.equal(!!infos[lod].rolled, !!infos[0].rolled);
          }
          n++;
        }
  assert.ok(n >= 150);
});

test("German infantry: some carry the assault frame with the shelter quarter rolled round it; a machine gunner's mate a belt of rounds", () => {
  // The roll: splinter cloth standing off the upper back.
  const behind = (x, y, z) => z > 0.13 && y > 1.15;
  const framed = variants('GE', 'infantry').filter((v) => count(buildOutfit('GE', 'infantry', v, 0, 'rifle').b, CELL.splinter, behind) > 150);
  assert.ok(framed.length >= 2 && framed.length <= 6, `${framed.length} of 8 with the frame`);
  // At the middle distance it is still there, in fewer points.
  assert.ok(count(buildOutfit('GE', 'infantry', framed[0], 1, 'rifle').b, CELL.splinter, behind) > 20);
  // A belt of rounds round the neck (several hundred points of metal down the
  // chest): on every man whose own gun is fed by belt, and on nobody else.
  const chest = (x, y, z) => z < -0.08 && y > 1.15 && y < 1.46 && Math.abs(x) > 0.05;
  for (const v of variants('GE', 'infantry')) {
    const of = (role) => count(buildOutfit('GE', 'infantry', v, 0, role).b, CELL.metal, chest);
    const rifle = of('rifle');
    assert.ok(of('mgBelt') > rifle + 300, `variant ${v}: a belt-fed gunner carries a belt`);
    // (A gunner with a magazine-fed gun has his pouch and pistol, no belt.)
    assert.ok(of('mg') < rifle + 300, `variant ${v}: a gunner with a magazine-fed gun does not`);
    assert.ok(rifle < 500, `variant ${v}: a rifleman does not (${rifle})`);
  }
});

test('Soviet infantry: some carry the gas mask bag at the left hip', () => {
  const leftHip = (x, y, z) => x < -0.1 && z > 0.06 && y < 1.02 && y > 0.75;
  const bags = variants('SU', 'infantry').filter((v) => count(buildOutfit('SU', 'infantry', v, 0, 'rifle').b, CELL.duck, leftHip) > 40);
  assert.ok(bags.length >= 2 && bags.length <= 7, `${bags.length} of 8 with the bag`);
  // Not from far off.
  assert.equal(count(buildOutfit('SU', 'infantry', bags[0], 2, 'rifle').b, CELL.duck, leftHip), 0);
});

test('US infantry: some packs have the blanket rolled over them', () => {
  const behind = (x, y, z) => z > 0.14 && y > 1.15;
  const rolls = variants('US', 'infantry').filter((v) => count(buildOutfit('US', 'infantry', v, 0, 'rifle').b, CELL.wool, behind) > 100);
  assert.ok(rolls.length >= 2 && rolls.length <= 5, `${rolls.length} of 8 with a blanket roll`);
});

test('the kit a weapon calls for: belt-fed machine guns are told from magazine-fed ones', () => {
  assert.equal(roleOf(WEAPONS.mg42), 'mgBelt');
  assert.equal(roleOf(WEAPONS.mg34), 'mgBelt');
  assert.equal(roleOf(WEAPONS.fg42), 'mg');
  assert.equal(roleOf(WEAPONS.bar_m1918a2), 'mg');
  assert.equal(roleOf(WEAPONS.dp28), 'mg');
  assert.equal(roleOf(WEAPONS.kar98k), 'rifle');
  assert.equal(roleOf(null), 'rifle');
  for (const w of Object.values(WEAPONS)) assert.ok(['rifle', 'smg', 'mg', 'mgBelt', 'at'].includes(roleOf(w)), w.name);
});

test('what shows on a soldier is what he carries: grenades, pistol, binoculars and knife from his loadout', () => {
  const none = { grenades: false, pistol: false, binoculars: false, knife: false };
  // From a loadout (empty slots allowed).
  assert.deepEqual(carryOf([WEAPONS.m1_garand, WEAPONS.m1911a1, WEAPONS.mk2_grenade, null, null, WEAPONS.spade_m1910, null]), { ...none, grenades: true, pistol: true });
  assert.deepEqual(carryOf([WEAPONS.mp40, null, WEAPONS.binoc_ge, WEAPONS.knife_m3]), { ...none, binoculars: true, knife: true });
  assert.deepEqual(carryOf([WEAPONS.kar98k, WEAPONS.nagant_m1895]), { ...none, pistol: true });
  assert.deepEqual(carryOf([]), none);
  assert.equal(carryKey(null), '');
  assert.notEqual(carryKey(none), carryKey({ ...none, pistol: true }));

  const size = (army, cls, v, carry) => buildOutfit(army, cls, v, 0, 'rifle', { carry }).b.count;
  for (const army of ['US', 'GE', 'SU'])
    for (const v of variants(army, 'infantry')) {
      const bare = size(army, 'infantry', v, none);
      // Each thing he carries adds its piece; nothing shows that he does not carry.
      for (const what of ['grenades', 'pistol', 'binoculars']) {
        const with1 = size(army, 'infantry', v, { ...none, [what]: true });
        assert.ok(with1 > bare, `${army} infantry variant ${v}: ${what} show when carried (${with1} against ${bare})`);
      }
    }
  // A man with no grenades has none on him, whatever his variant would have drawn.
  const belt = (x, y, z) => z < -0.05 && y > 0.9 && y < 1.2 && Math.abs(x) < 0.09;
  for (const v of variants('GE', 'infantry')) {
    const wood = (carry) => count(buildOutfit('GE', 'infantry', v, 0, 'rifle', { carry }).b, CELL.paint, belt);
    assert.ok(wood({ ...none, grenades: true }) > wood(none), `variant ${v}: a stick grenade in the belt`);
  }
  // Paratroopers and scouts wear their knife only when they carry one.
  for (const [army, cls] of [
    ['US', 'paratrooper'],
    ['SU', 'recon'],
    ['SU', 'paratrooper'],
  ])
    assert.ok(size(army, cls, 0, { ...none, knife: true }) > size(army, cls, 0, none), `${army} ${cls}: the knife`);
  // The loadout does not change the kit's draws (the rest of it stays the same), at any level of detail.
  for (const lod of [0, 1, 2]) {
    const a = buildOutfit('SU', 'infantry', 3, lod, 'rifle', { carry: none }).info,
      b = buildOutfit('SU', 'infantry', 3, lod, 'rifle', { carry: { ...none, grenades: true, pistol: true, binoculars: true, knife: true } }).info,
      c = buildOutfit('SU', 'infantry', 3, lod, 'rifle').info;
    assert.equal(a.draws, b.draws);
    assert.equal(a.draws, c.draws);
    assert.equal(a.headgear, c.headgear);
  }
  // Not known (a model looked at on its own): the kit decides, as before.
  assert.equal(new SoldierModel('GE', null, { seed: 4 }).carry, null);
  const m = new SoldierModel('GE', null, { seed: 4, carry: { ...none, grenades: true } });
  m.prepareLods();
  assert.ok(m.stats(0).triangles > 30000);
});
