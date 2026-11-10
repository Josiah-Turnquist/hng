// Camouflage prints (src/actors/soldierCamo.js): each army has several a
// uniform can be made in, on top of what it issues by default. A soldier
// asked for one wears it on his tunic, sleeves, trousers, pockets and helmet;
// asked for none (or one that does not exist), he is dressed as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMOS, CAMO_BASE, CAMO_PRESETS, CAMO_COLS, CAMO_ROWS, camoCell, camosFor } from '../src/actors/soldierCamo.js';
import { CELL, CELL_PRESETS } from '../src/actors/soldierMaterials.js';
import { PRESETS } from '../src/render/textures.js';
import { MATERIALS } from '../src/render/textureLib.glsl.js';
import { buildOutfit } from '../src/actors/soldierKit.js';
import { SoldierModel } from '../src/actors/soldierModel.js';

const cells = (b) => {
  const n = new Map();
  for (let i = 0; i < b.count; i++) n.set(b.mat[i * 2], (n.get(b.mat[i * 2]) || 0) + 1);
  return n;
};

test('every army has prints to choose from, each with a pattern of its own', () => {
  assert.ok(CAMOS.length >= 10);
  assert.equal(new Set(CAMOS.map((c) => c.id)).size, CAMOS.length);
  assert.equal(new Set(CAMOS.map((c) => c.name)).size, CAMOS.length);
  for (const army of ['US', 'GE', 'SU']) assert.ok(camosFor(army).length >= 3, army);
  assert.ok(CAMO_COLS * CAMO_ROWS >= CAMOS.length);
  const sources = new Set();
  CAMOS.forEach((c, i) => {
    assert.ok(c.world >= 0.3 && c.world <= 1, `${c.id}: a repeat of ${c.world} m`);
    assert.equal(camoCell(c.id), CAMO_BASE + i);
    const p = PRESETS[CAMO_PRESETS[i]];
    assert.ok(p && MATERIALS[p.mat], c.id);
    assert.ok(/void surface\(/.test(MATERIALS[p.mat]));
    sources.add(MATERIALS[p.mat]);
  });
  assert.equal(sources.size, CAMOS.length);
  // The cell numbers of prints never run into the cloth cells'.
  assert.ok(CAMO_BASE > Math.max(...Object.values(CELL)));
  assert.ok(CAMO_BASE >= CELL_PRESETS.length);
  assert.equal(camoCell('none such'), null);
});

test('a uniform asked for in a print is made of it; without, it is as before', () => {
  for (const [army, cls, camo] of [
    ['GE', 'infantry', 'oakSpring'],
    ['GE', 'tanker', 'peaDot'],
    ['US', 'paratrooper', 'frogGreen'],
    ['US', 'infantry', 'daub'],
    ['SU', 'infantry', 'leaf'],
    ['SU', 'recon', 'palm'],
  ]) {
    const plain = cells(buildOutfit(army, cls, 1, 0, 'rifle').b);
    const printed = cells(buildOutfit(army, cls, 1, 0, 'rifle', { camo }).b);
    const cell = camoCell(camo);
    for (const c of plain.keys()) assert.ok(c < CAMO_BASE, `${army} ${cls}: no print unless asked`);
    assert.ok(printed.get(cell) > 4000, `${army} ${cls} in ${camo}: ${printed.get(cell)} vertices`);
    // Tunic, sleeves and trousers are all of it: little plain cloth is left.
    const left = (printed.get(CELL.wool) || 0) + (printed.get(CELL.cotton) || 0) + (printed.get(CELL.hbt) || 0);
    assert.ok(left < printed.get(cell) * 0.2, `${army} ${cls}: ${left} plain cloth vertices left`);
    // Leather, webbing and steel stay what they are.
    for (const c of [CELL.leather, CELL.webbing, CELL.metal]) assert.equal(printed.get(c) || 0, plain.get(c) || 0, `${army} ${cls}: cell ${c}`);
    // The same man: as many vertices either way.
    assert.equal(
      [...printed.values()].reduce((a, b) => a + b, 0),
      [...plain.values()].reduce((a, b) => a + b, 0),
    );
  }
});

test("pockets are of the garment's cloth, not of their buttons' metal", () => {
  const b = buildOutfit('GE', 'infantry', 1, 0, 'rifle').b;
  // (Four pockets with a button each: about 240 vertices of metal a pocket was the fault.)
  assert.ok((cells(b).get(CELL.metal) || 0) < 1100, `${cells(b).get(CELL.metal)} metal vertices`);
});

test('a soldier model takes a print by its id, at every level of detail', () => {
  const m = new SoldierModel('GE', null, { seed: 5, camo: 'oakAutumn' });
  m.prepareLods();
  assert.equal(m.camo, 'oakAutumn');
  for (let lod = 0; lod < 3; lod++) {
    const mats = m.meshes[lod].map((mesh) => mesh.geometry.attributes.soldierMat.array);
    assert.ok(
      mats.some((a) => {
        for (let i = 0; i < a.length; i += 2) if (a[i] === camoCell('oakAutumn')) return true;
        return false;
      }),
      `lod ${lod}`,
    );
  }
  assert.equal(new SoldierModel('GE', null, { seed: 5, camo: 'none such' }).camo, null);
  assert.equal(new SoldierModel('GE', null, { seed: 5 }).camo, null);
});
