// Controls: every action has a key and a place in the controls menu, no two
// actions that are used in the same place share a key, and a player's changes
// are saved and loaded back as they were made.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_BINDINGS, ACTIONS, RESERVED, clash, mergeBindings, bindingChanges, keyName } from '../src/core/input.js';

const listed = ACTIONS.flatMap((g) => g.actions.map(([a]) => a));

test('every action has a default key and a row in the controls menu', () => {
  assert.deepEqual([...listed].sort(), Object.keys(DEFAULT_BINDINGS).sort());
  for (const [a, keys] of Object.entries(DEFAULT_BINDINGS)) {
    assert.ok(keys.length >= 1 && keys.length <= 2, `${a} has ${keys.length} keys`);
    for (const k of keys) assert.ok(!RESERVED.has(k), `${a} uses the reserved ${k}`);
  }
});

test('the actions the game reads are all bound', () => {
  const used = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js')) for (const m of readFileSync(p, 'utf8').matchAll(/input\.(?:is|hit|up|key|keys)\('([a-zA-Z0-9]+)'\)/g)) used.add(m[1]);
    }
  };
  walk(new URL('../src', import.meta.url).pathname);
  assert.ok(used.size > 20, `found only ${used.size} actions in the code`);
  for (const a of used) assert.ok(DEFAULT_BINDINGS[a], `the game reads "${a}", which has no key`);
});

test('no two actions used in the same place share a default key', () => {
  const by = new Map();
  for (const [a, keys] of Object.entries(DEFAULT_BINDINGS)) for (const k of keys) by.set(k, [...(by.get(k) || []), a]);
  for (const [k, acts] of by) for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) assert.ok(!clash(acts[i], acts[j]), `${k} is both ${acts[i]} and ${acts[j]}`);
  // (Sharing is fine where the places differ: 1 is the rifle on foot, the first shell in a tank.)
  assert.ok(!clash('slot1', 'ammo1'));
  assert.ok(clash('fire', 'reload'));
});

test('aiming has a key on the keyboard as well as the right mouse button', () => {
  assert.deepEqual(DEFAULT_BINDINGS.aim, ['Mouse2', 'Backquote']);
  assert.equal(keyName('Backquote'), '`');
  assert.equal(keyName('Mouse2'), 'Right mouse');
  assert.equal(keyName('KeyF'), 'F');
  assert.equal(keyName('Digit3'), '3');
  assert.equal(keyName('ShiftLeft'), 'Left Shift');
});

test("a player's key changes are saved as changes and load back", () => {
  const b = mergeBindings({});
  assert.deepEqual(bindingChanges(b), {});
  b.aim = ['KeyT'];
  b.reload = [];
  const saved = bindingChanges(b);
  assert.deepEqual(saved, { aim: ['KeyT'], reload: [] });
  const back = mergeBindings(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.aim, ['KeyT']);
  assert.deepEqual(back.reload, []);
  assert.deepEqual(back.fire, DEFAULT_BINDINGS.fire);
  // Unknown actions, reserved keys and junk are dropped.
  const odd = mergeBindings({ fly: ['KeyY'], jump: ['Escape', 'KeyJ', 7], crouch: 'KeyC' });
  assert.equal(odd.fly, undefined);
  assert.deepEqual(odd.jump, ['KeyJ']);
  assert.deepEqual(odd.crouch, DEFAULT_BINDINGS.crouch);
});
