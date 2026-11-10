// The field kit on the soldiers (src/actors/soldierKit*.js, soldierGear.js):
// beside belt, pouches, canteen and tool, many carry what real ones did: the
// German assault frame with its mess tin and rolled shelter quarter, a belt of
// machine gun rounds, the Soviet gas mask bag and mess pot, the US blanket
// roll and gas mask bag. And a man's kit is the same however far off he is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutfit, variantCount } from '../src/actors/soldierKit.js';
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
      for (const role of ['rifle', 'smg', 'mg'])
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
  // The belt of rounds: several hundred points of metal down the chest.
  const chest = (x, y, z) => z < -0.08 && y > 1.15 && y < 1.46 && Math.abs(x) > 0.05;
  const plain = variants('GE', 'infantry').map((v) => count(buildOutfit('GE', 'infantry', v, 0, 'rifle').b, CELL.metal, chest));
  const gunners = variants('GE', 'infantry').map((v) => count(buildOutfit('GE', 'infantry', v, 0, 'mg').b, CELL.metal, chest));
  const belted = gunners.filter((n, v) => n > plain[v] + 300 || n > 600).length;
  assert.ok(belted >= 4, `${belted} of 8 gunners with a belt of rounds`);
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
