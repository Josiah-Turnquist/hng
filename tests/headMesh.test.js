// The soldiers' heads are a sculpted head (the MakeHuman base mesh's, CC0)
// set on the game's skeleton (src/actors/headMesh.js): its eyes where the
// game's are, its neck down in the collar, a face of its own for each man,
// and one size of skull so that every helmet and cap fits every man.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headMesh, headShape, skinOf, skullRadius, SKULL_TOP } from '../src/actors/headMesh.js';
import { HEAD_CENTER as HC } from '../src/actors/soldierRig.js';

const SHAPES = [{}, { 'fat+': 0.5 }, { square: 0.6 }, { 'jaw+': 0.7, 'nose+': 0.7 }, { asian: 0.85, eyeFold: 0.5 }, { african: 1 }];

test("the sculpted head sits on the game's skeleton", () => {
  for (const shape of SHAPES) {
    const m = headMesh(shape);
    assert.ok(m.count > 3000 && m.index.length / 3 > 6000, `${m.count} vertices`);
    // Eyes level, either side of the middle, at the game's eye height.
    assert.ok(Math.abs(m.eyes.L.y - m.eyes.R.y) < 0.003);
    assert.ok(Math.abs((m.eyes.L.x + m.eyes.R.x) / 2 - HC.x) < 0.002);
    assert.ok(Math.abs((m.eyes.L.y + m.eyes.R.y) / 2 - (HC.y + 0.001)) < 0.002, JSON.stringify(shape));
    let lo = [9, 9, 9],
      hi = [-9, -9, -9];
    for (let i = 0; i < m.count; i++)
      for (let k = 0; k < 3; k++) {
        const v = m.positions[i * 3 + k];
        assert.ok(Number.isFinite(v));
        lo[k] = Math.min(lo[k], v);
        hi[k] = Math.max(hi[k], v);
      }
    // A head's size: 14 to 20 cm across with the ears, the crown 10 to 13 cm
    // over its centre; the neck reaches down into the collar.
    assert.ok(hi[0] - lo[0] > 0.14 && hi[0] - lo[0] < 0.2, `${hi[0] - lo[0]} across`);
    assert.ok(hi[1] - HC.y > 0.1 && hi[1] - HC.y < 0.13, `crown ${hi[1] - HC.y}`);
    assert.ok(lo[1] < 1.44 && lo[1] > 1.4, `neck down to ${lo[1]}`);
    // Every triangle's corners exist; normals are unit length.
    for (const i of m.index) assert.ok(i < m.count);
    for (let i = 0; i < m.count; i++) assert.ok(Math.abs(Math.hypot(m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]) - 1) < 1e-3);
  }
});

test('one helmet fits every man: the skull above the brow is the same, and inside the measure caps are built to', () => {
  const plain = headMesh({});
  skullRadius(0, 0);
  assert.ok(SKULL_TOP > 0.1 && SKULL_TOP < 0.13);
  for (const shape of SHAPES) {
    const m = headMesh(shape);
    let moved = 0;
    for (let i = 0; i < m.count; i++) {
      const dx = m.positions[i * 3] - HC.x,
        dy = m.positions[i * 3 + 1] - HC.y,
        dz = m.positions[i * 3 + 2] - HC.z + 0.002;
      if (plain.positions[i * 3 + 1] - HC.y > 0.075) {
        for (let k = 0; k < 3; k++) assert.ok(Math.abs(m.positions[i * 3 + k] - plain.positions[i * 3 + k]) < 1e-6);
        // (2 mm of give: the measure is a table with cells a few mm wide.)
        // (Not the last few mm of the crown, which caps round over.)
        if (dy < SKULL_TOP - 0.004) assert.ok(Math.hypot(dx, dz) <= skullRadius(Math.atan2(dx, -dz), dy) + 0.002, `${JSON.stringify(shape)} at ${dy.toFixed(3)}`);
      } else if (Math.hypot(...[0, 1, 2].map((k) => m.positions[i * 3 + k] - plain.positions[i * 3 + k])) > 0.001) moved++;
    }
    // (Below it the face is his own.)
    if (Object.keys(shape).length) assert.ok(moved > 50, `${JSON.stringify(shape)} moves ${moved} vertices`);
  }
});

test('the head for the middle distance is the same head with fewer vertices', () => {
  const m = headMesh({}),
    c = headMesh({}, { coarse: true });
  assert.ok(c.count < 600 && c.index.length / 3 < 1000, `${c.count} vertices, ${c.index.length / 3} triangles`);
  for (const i of c.index) assert.ok(i < c.count);
  for (const arr of [c.head, c.jaw, c.brow, c.hair]) assert.equal(arr.length, c.count);
  for (const col of c.colors) assert.equal(col.length, c.count * 3);
  assert.equal(c.eyes.r, m.eyes.r);
});

test("a man's looks choose his head and skin", () => {
  assert.ok(headShape({ asian: true }).asian > 0.5);
  assert.ok(headShape({ tone: 6 }).african > 0.5);
  assert.ok(headShape({ shape: { jaw: 1.08 } })['jaw+'] > 0);
  assert.deepEqual([skinOf({}), skinOf({ asian: true }), skinOf({ tone: 6 })], [0, 1, 2]);
  // Every shape named is one the data has (a wrong name would be passed over in silence).
  const all = headShape({
    asian: true,
    shape: { jaw: 1.2, chin: 1.2, length: 1.2, nose: 1.3, noseW: 1.3, noseHook: 1, noseBridge: 0.3, cheek: 1.4, gaunt: 1, lips: 1.3, width: 1.2, eyeSize: 1.2, eyeSpace: 1.1, brow: 1.4, earSize: 1.2, earOut: 1.8 },
  });
  const plain = headMesh({}).positions;
  for (const [name, w] of Object.entries(all)) {
    const p = headMesh({ [name]: w }).positions;
    let d = 0;
    for (let i = 0; i < p.length; i++) d = Math.max(d, Math.abs(p[i] - plain[i]));
    assert.ok(d > 0.0003, `${name} changes the head (${d})`);
  }
});
