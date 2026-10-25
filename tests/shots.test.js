// Seeing where fire comes from: marks round the middle of the screen pointing
// to where a shot that hit the player, or cracked past, was fired from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { Projectile } from '../src/ballistics/projectiles.js';
import { shotMarkAngle } from '../src/ui/hud.js';

const near = (a, b, eps = 1e-6) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < eps;

test('a shot mark points the way the shot came from, wherever the camera looks', () => {
  // Looking north (yaw 0, along -z): canvas angles are 0 = right, clockwise.
  assert.ok(near(shotMarkAngle(0, 0, 0, -50, 0), -Math.PI / 2), 'ahead: top of the screen');
  assert.ok(near(shotMarkAngle(0, 0, -50, 0, 0), Math.PI), 'from the west: left');
  assert.ok(near(shotMarkAngle(0, 0, 50, 0, 0), 0), 'from the east: right');
  assert.ok(near(shotMarkAngle(0, 0, 0, 50, 0), Math.PI / 2), 'from behind: bottom');
  // Turned to face west (yaw +90 degrees): a shot from the west is ahead.
  assert.ok(near(shotMarkAngle(0, 0, -50, 0, Math.PI / 2), -Math.PI / 2));
  // It is measured from where the player stands.
  assert.ok(near(shotMarkAngle(100, 100, 100, 50, 0), -Math.PI / 2));
});

test('bullets remember where they were fired from, and crack afresh when the pool reuses them', () => {
  const ammo = { drag: 'G1', bc: 0.4, mass: 0.01, diameter: 0.0078 };
  const p = new Projectile().init({ x: 10, y: 1, z: -20, vx: 0, vy: 0, vz: -800, ammo });
  assert.equal(p.ox, 10);
  assert.equal(p.oz, -20);
  p.crackPlayed = true;
  p.init({ x: 3, y: 1, z: 4, vx: 800, vy: 0, vz: 0, ammo });
  assert.equal(p.crackPlayed, false);
  assert.equal(p.ox, 3);
  assert.equal(p.oz, 4);
});

function fakeGame(me) {
  const calls = [];
  const g = Object.create(Game.prototype);
  const noop = () => {};
  Object.assign(g, {
    soldiers: [],
    audio: null,
    player: { soldier: me, eye: { x: 0, y: 1.6, z: 0 }, suppression: 0 },
    hud: { shotFrom: (...a) => calls.push(a), hitMarker: noop },
    effects: { impact: noop },
    mode: {},
  });
  return { g, calls };
}

test('an enemy bullet cracking past the player puts up a mark toward the shooter', () => {
  const me = { team: 1, body: { x: 0, y: 0, z: 0 } };
  const enemy = { team: 0 };
  const friend = { team: 1 };
  const pass = (owner, ammo = {}) => {
    const { g, calls } = fakeGame(me);
    const p = { owner, ammo, ox: 120, oz: -40, speed: 800, crackPlayed: false };
    // From the east, 2 m in front of the player's eyes.
    g._onSegment(p, 30, 1.6, -2, -30, 1.6, -2);
    return calls;
  };
  const c = pass(enemy);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].slice(0, 3), [120, -40, 'near']);
  assert.equal(pass(friend).length, 0, 'not for a comrade shooting past');
  assert.equal(pass(enemy, { fragment: true }).length, 0, 'not for shell fragments');
  assert.equal(pass(me).length, 0, 'not for our own shots');
});

test('a hit on the player puts up a red mark toward where the shot came from', () => {
  const me = { team: 1, alive: true, body: { x: 0, y: 0, z: 0 }, hit: () => 30 };
  const { g, calls } = fakeGame(me);
  const p = { owner: { team: 0 }, ammo: {}, ox: -200, oz: 15 };
  g._onImpact(p, { target: me, material: 'flesh', kind: 'enter', x: 0, y: 1, z: 0, energy: 3000 });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 3), [-200, 15, 'hit']);
});
