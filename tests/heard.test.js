// Enemy gunfire heard anywhere within earshot marks which way it came from
// (game.js _heardShot, hud.js shotFrom 'heard'), however far off the shot goes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';

test('enemy gunfire within earshot is marked, faint with distance; friends, far shots and grenades are not', () => {
  const marks = [];
  const me = { alive: true, team: 1, body: { x: 0, z: 0 } };
  const game = { player: { soldier: me }, hud: { shotFrom: (x, z, kind, s) => marks.push({ x, z, kind, s }) } };
  const shot = (owner, x, z, ammo = {}) => Game.prototype._heardShot.call(game, { owner, x, z, ammo });
  const foe = { team: 0 };
  shot(foe, 100, 0);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].kind, 'heard');
  assert.ok(marks[0].s > 0.6, 'loud close by');
  shot(foe, 250, 0);
  assert.ok(marks[1].s < 0.2, 'faint far off');
  shot(foe, 900, 0);
  shot({ team: 1 }, 50, 0);
  shot(me, 0, 0);
  shot(foe, 50, 0, { thrown: true });
  shot(foe, 50, 0, { fragment: true });
  assert.equal(marks.length, 2, 'out of earshot, a friend, his own, a grenade and its fragments: no mark');
  me.alive = false;
  shot(foe, 50, 0);
  assert.equal(marks.length, 2, 'nothing while down');
});
