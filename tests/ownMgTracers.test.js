// Online, the player's own rounds are drawn as he fires them, except a vehicle
// machine gun's: that fires only on the server (where the vehicle runs), so
// the browser draws it from the server's record (net/online.js _events).
import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineBattle } from '../src/net/online.js';
import { ammoRef } from '../src/net/protocol.js';
import { AMMO } from '../src/weapons/ammo.js';

test("online: your own vehicle machine gun's rounds are drawn and heard; your rifle's aren't drawn twice", () => {
  const fired = [];
  const heard = [];
  const ctx = {
    game: { projectiles: { fire: (o) => fired.push(o) }, effects: { muzzle() {} }, audio: { gunshot: (type, x, y, z, o) => heard.push({ type, ...o }) } },
    me: { id: 5 },
    puppets: new Map([[9, { id: 9, team: 0 }]]),
  };
  const mg = ammoRef(Object.values(AMMO)[0]);
  const shot = (who, wid, sound, aref) => ['f', who, wid, 0, 100, 0, 8000, 0, 0, 1, sound, aref];
  OnlineBattle.prototype._events.call(ctx, [
    shot(5, 'm1_garand', 'rifle', ''), // his rifle: drawn already as he fired
    shot(5, '', 'mg', mg), // his tank's machine gun: only the server fired it
    shot(9, 'kar98k', 'rifle', ''), // someone else's
  ]);
  assert.equal(fired.length, 2);
  assert.equal(fired[0].owner, ctx.me, 'his machine gun round, his');
  assert.equal(fired[0].tracer, true);
  assert.deepEqual(
    heard.map((h) => [h.type, !!h.isLocal]),
    [
      ['mg', true],
      ['rifle', false],
    ],
  );
});
