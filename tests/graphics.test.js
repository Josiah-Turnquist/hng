// Checks the graphics settings: presets, single options turning a preset into
// "Custom", what each option resolves to, and that settings work without storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Settings, GRAPHICS_OPTIONS, GRAPHICS_PRESETS, QUALITY_PRESETS, resolveQuality, matchPreset } from '../src/core/settings.js';

test('every preset sets every option to an allowed value and matches itself', () => {
  for (const [name, p] of Object.entries(GRAPHICS_PRESETS)) {
    for (const o of GRAPHICS_OPTIONS) {
      const v = p[o.key];
      if (o.type === 'range') assert.ok(v >= o.min && v <= o.max, `${name}.${o.key} = ${v} out of range`);
      else assert.ok(o.choices.some((c) => c[0] === v), `${name}.${o.key} = ${v} is not a choice`);
    }
    assert.equal(matchPreset(p), name);
  }
});

test('presets get lighter from Ultra to Low', () => {
  const order = ['ultra', 'high', 'medium', 'low'].map((k) => QUALITY_PRESETS[k]);
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1],
      b = order[i];
    assert.ok(b.renderScale <= a.renderScale, 'render scale');
    assert.ok(b.cascades <= a.cascades, 'shadow maps');
    assert.ok(b.shadowDistance <= a.shadowDistance, 'shadow distance');
    assert.ok(b.viewDistance <= a.viewDistance, 'view distance');
    assert.ok(b.grassDensity <= a.grassDensity && b.grassDistance <= a.grassDistance, 'grass');
    assert.ok(b.textureSize <= a.textureSize, 'textures');
  }
  const low = QUALITY_PRESETS.low;
  assert.equal(low.ssao, false);
  assert.equal(low.bloom, false);
  assert.equal(low.msaa, 0);
  assert.equal(low.taa, false);
  assert.ok(low.renderScale < 1);
});

test('options resolve to what the renderer reads', () => {
  const q = resolveQuality({ ...GRAPHICS_PRESETS.high, antiAliasing: 'msaa', shadows: 'off', ambientOcclusion: 'off', textureQuality: 'low' });
  assert.equal(q.msaa, 4);
  assert.equal(q.fxaa, false);
  assert.equal(q.shadows, false);
  assert.equal(q.ssao, false);
  assert.equal(q.textureSize, 512);
  assert.equal(q.label, 'Custom');
  assert.ok(q.treeDistance <= q.viewDistance);
  assert.equal(resolveQuality(GRAPHICS_PRESETS.ultra, 'ultra').taa, true);
});

test('settings work without browser storage, and one change makes the preset custom', () => {
  const s = new Settings();
  assert.ok(GRAPHICS_PRESETS[s.preset], `starts on a preset, got ${s.preset}`);
  s.setPreset('high');
  assert.equal(s.preset, 'high');
  let heard = 0;
  s.listen((k) => k === 'graphics' && heard++);
  s.setGraphics('bloom', false);
  assert.equal(s.preset, 'custom');
  assert.equal(s.quality.bloom, false);
  assert.equal(heard, 1);
  s.setGraphics('bloom', true);
  assert.equal(s.preset, 'high', 'back to the preset when the options match again');
  s.setPreset('low');
  assert.equal(s.quality.renderScale, GRAPHICS_PRESETS.low.renderScale);
});

test('a preset saved by an older version follows the preset as it is now', () => {
  const saved = new Map();
  const old = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) };
  try {
    // Low, as an older version saved it, with a grass density it no longer has.
    const oldLow = { ...GRAPHICS_PRESETS.low, grassDensity: GRAPHICS_PRESETS.low.grassDensity + 0.05 };
    saved.set('hng.settings.v1', JSON.stringify({ quality: 'low', graphics: oldLow }));
    const s = new Settings();
    assert.equal(s.preset, 'low');
    assert.equal(s.graphics.grassDensity, GRAPHICS_PRESETS.low.grassDensity);
    // Options the player changed are kept.
    saved.set('hng.settings.v1', JSON.stringify({ quality: 'custom', graphics: { ...GRAPHICS_PRESETS.high, bloom: false } }));
    const c = new Settings();
    assert.equal(c.preset, 'custom');
    assert.equal(c.graphics.bloom, false);
  } finally {
    if (old === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = old;
  }
});
