// The folds of sleeves and trouser legs (src/actors/soldierDrape.js): deep
// where the limb bends, on the side it bends to; nothing where the cloth is
// held or sewn on (the shoulder's head, the cuff, a badge, the point of the
// elbow); the same on a left limb mirrored; a little different on every man.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sleeveDrape, trouserDrape } from '../src/actors/soldierDrape.js';

const PI = Math.PI;
// The tube's own angle a for a place round the limb: front, outside, back, body side.
const FRONT = -PI / 2,
  BACK = PI / 2;
const outside = (side) => (side > 0 ? 0 : PI);
// The most of fn(s) over a stretch of the limb.
const most = (fn, s0, s1) => {
  let m = -Infinity;
  for (let s = s0; s <= s1; s += 0.002) m = Math.max(m, fn(s));
  return m;
};

test('a sleeve folds deep inside the elbow and lies flat over its point and where a badge is sewn', () => {
  for (const seed of [1, 2, 5, 9, 14]) {
    for (const side of [-1, 1]) {
      const d = sleeveDrape({ side, seed, elbow: 0.306, end: 0.555, cuff: true });
      const inside = most((s) => d.at(s, FRONT), 0.25, 0.37);
      assert.ok(inside > 0.012 && inside < 0.035, `seed ${seed}: ${(inside * 1000).toFixed(1)} mm inside the elbow`);
      // (The point of the elbow, where a patch may be sewn: within 2 mm.)
      assert.ok(most((s) => Math.abs(d.at(s, BACK)), 0.25, 0.37) < 0.002, `seed ${seed}: the point of the elbow`);
      assert.ok(most((s) => Math.abs(d.at(s, outside(side))), 0.05, 0.17) < 0.0025, `seed ${seed}: where a badge is sewn`);
      // Nothing at the shoulder's head nor on the cuff band.
      assert.equal(d.at(-0.02, FRONT), 0);
      for (const a of [FRONT, BACK, 0, PI]) assert.ok(Math.abs(d.at(0.5, a)) < 1e-9, 'on the cuff band');
      // The hollows beside the folds are shaded, never lit up, and not to black.
      for (let s = 0; s < 0.55; s += 0.01)
        for (let a = -PI; a < PI; a += 0.3) {
          const sh = d.shade(s, a);
          assert.ok(sh <= 1 && sh >= 0.55, `shade ${sh}`);
          assert.ok(Number.isFinite(d.at(s, a)) && d.at(s, a) > -0.008 && d.at(s, a) < 0.04);
        }
    }
  }
});

test('a rolled sleeve has its folds above the roll only', () => {
  const d = sleeveDrape({ side: 1, seed: 3, elbow: 0.306, end: 0.24, cuff: true, roll: 0.009 });
  for (const a of [FRONT, BACK, 0, PI]) for (let s = 0.2; s < 0.3; s += 0.005) assert.ok(Math.abs(d.at(s, a)) < 1e-9);
  assert.ok(most((s) => Math.max(d.at(s, FRONT), d.at(s, PI), d.at(s, BACK)), 0.03, 0.19) > 0.004);
});

test('a trouser leg folds deep behind the knee and bags over it in front', () => {
  for (const seed of [1, 2, 5, 9, 14]) {
    for (const side of [-1, 1]) {
      const d = trouserDrape({ side, seed, knee: 0.425, end: 0.84 });
      const behind = most((s) => d.at(s, BACK), 0.36, 0.5);
      assert.ok(behind > 0.012 && behind < 0.035, `seed ${seed}: ${(behind * 1000).toFixed(1)} mm behind the knee`);
      assert.ok(most((s) => d.at(s, FRONT), 0.42, 0.5) > 0.006, 'the bag of the knee');
      // Inside the hips: nothing; at the top of the thigh (under a tunic's skirt): little.
      assert.equal(d.at(-0.05, FRONT), 0);
      for (let a = -PI; a < PI; a += 0.2) assert.ok(most((s) => d.at(s, a), 0.0, 0.1) < 0.008, 'under the skirt');
    }
  }
});

test('breeches are tight below the knee; a leg tucked into a boot has nothing below the tuck', () => {
  const b = trouserDrape({ side: 1, seed: 4, knee: 0.425, end: 0.56, style: 'breeches', tuck: 0.53 });
  const st = trouserDrape({ side: 1, seed: 4, knee: 0.425, end: 0.56, style: 'straight', tuck: 0.53 });
  let mb = 0,
    ms = 0;
  for (let a = -PI; a < PI; a += 0.2) {
    mb = Math.max(
      mb,
      most((s) => Math.abs(b.at(s, a)), 0.52, 0.56),
    );
    ms = Math.max(
      ms,
      most((s) => Math.abs(st.at(s, a)), 0.52, 0.56),
    );
  }
  assert.ok(mb < 1e-9 && ms < 1e-9, 'below the tuck');
});

test('a left limb is the right one mirrored, and no two men fold alike', () => {
  const r = sleeveDrape({ side: 1, seed: 6 }),
    l = sleeveDrape({ side: -1, seed: 6 });
  // (Mirrored in x: the tube's angle a becomes PI - a.)
  for (let s = 0.05; s < 0.5; s += 0.03) for (let a = -PI; a < PI; a += 0.4) assert.ok(Math.abs(r.at(s, a) - l.at(s, PI - a)) < 1e-9);
  const other = sleeveDrape({ side: 1, seed: 7 });
  let differ = 0;
  for (let s = 0.05; s < 0.5; s += 0.01) if (Math.abs(r.at(s, FRONT) - other.at(s, FRONT)) > 0.002) differ++;
  assert.ok(differ > 5);
});
