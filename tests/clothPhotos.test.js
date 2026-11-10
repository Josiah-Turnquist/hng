// The soldiers' cloth and leather are made from photographs of the real stuff
// (src/actors/clothPhotoData.js, CC0 scans): each is a WebP picture the
// texture maker can read, and every preset that names one names one that exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOTH_PHOTOS } from '../src/actors/clothPhotoData.js';
import { CELL, CELL_PRESETS } from '../src/actors/soldierMaterials.js';
import { PRESETS } from '../src/render/textures.js';

test('each cloth photograph is a WebP picture of two squares, with a sensible height', () => {
  assert.deepEqual(Object.keys(CLOTH_PHOTOS).sort(), ['canvas', 'cotton', 'leather', 'wool']);
  for (const [name, p] of Object.entries(CLOTH_PHOTOS)) {
    const bytes = Buffer.from(p.webp, 'base64');
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF', name);
    assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP', name);
    assert.ok(bytes.length > 10000 && bytes.length < 150000, `${name}: ${bytes.length} bytes`);
    assert.ok(p.size >= 256 && p.size <= 512);
    // Cloth stands a fraction of a millimetre high: under half a percent of a 15 cm tile.
    assert.ok(p.range > 0.0001 && p.range < 0.005, `${name}: range ${p.range}`);
    assert.ok(p.from, name);
  }
});

test('wool, cotton, twill, canvas and leather are made from photographs; the rest are drawn', () => {
  const photoOf = (cell) => PRESETS[CELL_PRESETS[cell]].photo;
  assert.equal(photoOf(CELL.wool), 'wool');
  assert.equal(photoOf(CELL.cotton), 'cotton');
  assert.equal(photoOf(CELL.hbt), 'cotton');
  assert.equal(photoOf(CELL.duck), 'canvas');
  assert.equal(photoOf(CELL.leather), 'leather');
  for (const name of CELL_PRESETS) {
    const p = PRESETS[name];
    assert.ok(p, name);
    if (p.photo) assert.ok(CLOTH_PHOTOS[p.photo], `${name} names ${p.photo}`);
  }
  assert.equal(photoOf(CELL.skin), undefined);
  assert.equal(photoOf(CELL.paint), undefined);
});
