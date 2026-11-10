// Where a player is, as near as the game knows (src/core/timeZones.js): the
// time zone his computer is set to, turned into a country and a city for the
// admin page. Nothing but a real zone name is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanZone, placeOf, placeName } from '../src/core/timeZones.js';

test('only a time zone name is kept: nothing else a browser might send', () => {
  assert.equal(cleanZone('America/Chicago'), 'America/Chicago');
  assert.equal(cleanZone('America/Argentina/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  assert.equal(cleanZone('Etc/GMT+5'), 'Etc/GMT+5');
  for (const bad of [null, undefined, 42, '', 'Chicago', '203.0.113.7', '<b>x</b>', 'America/Chicago; DROP TABLE', 'A/' + 'b'.repeat(60), { tz: 'x' }]) assert.equal(cleanZone(bad), null, String(bad));
});

test('a zone gives its country and city; one not in the list, its city alone', () => {
  assert.deepEqual(placeOf('America/Chicago'), { code: 'US', city: 'Chicago', area: 'America' });
  assert.deepEqual(placeOf('America/Los_Angeles'), { code: 'US', city: 'Los Angeles', area: 'America' });
  assert.equal(placeOf('Europe/Berlin').code, 'DE');
  // (Older names some browsers still give.)
  assert.equal(placeOf('Europe/Kiev').code, 'UA');
  assert.equal(placeOf('Asia/Calcutta').code, 'IN');
  assert.deepEqual(placeOf('Africa/Accra'), { code: null, city: 'Accra', area: 'Africa' });
  assert.equal(placeOf('not a zone'), null);
  assert.equal(placeName('America/Chicago'), 'United States (Chicago)');
  assert.equal(placeName('Europe/London'), 'United Kingdom (London)');
  assert.equal(placeName('Africa/Accra'), 'Accra (Africa)');
  assert.equal(placeName(null), '');
});
