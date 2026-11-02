// Being hit, online: the server tells a player each time he is hurt and where
// from (net/protocol.js 'h'), and his page shows it as offline does: the red
// round the screen's edges, the jolt, the grunt, the mark toward the shooter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, addPlayer, step } from '../src/server/battle.js';
import { watchEvents } from '../src/net/protocol.js';
import { OnlineBattle } from '../src/net/online.js';

test('the server tells a player he was hurt, how badly and where from; bots are not told', async () => {
  const g = await makeBattle({ perSide: 3, seed: 11 });
  const pc = addPlayer(g, { name: 'Tester', faction: 'US', cls: 'infantry' });
  const events = watchEvents(g);
  step(g, 1);
  events.take();
  const me = pc.soldier;
  const foe = g.soldiers.find((s) => s.team !== me.team);
  foe.body.x = 40;
  foe.body.z = -12;

  me.damage(18.4, { kind: 'bullet', attacker: foe, ox: 41.5, oz: -12.25 });
  me.damage(9, { kind: 'melee', attacker: foe });
  me.damage(6, { kind: 'fall' });
  const bot = g.soldiers.find((s) => s !== me && s.team === me.team && s.alive);
  bot.damage(10, { kind: 'bullet', attacker: foe, ox: 1, oz: 1 });

  const hurt = events.take().filter((e) => e[0] === 'h');
  assert.deepEqual(hurt, [
    ['h', me.id, 18, 4150, -1225],
    ['h', me.id, 9, 4000, -1200],
    ['h', me.id, 6, null, null],
  ]);
});

test('in the browser, being hurt shows: the red, the jolt and the mark toward the shooter', () => {
  const calls = [];
  const game = {
    hurt: (n) => calls.push(['hurt', n]),
    hud: { shotFrom: (x, z, kind, s) => calls.push(['from', x, z, kind, s]) },
  };
  const me = { id: 7, alive: true };
  OnlineBattle.prototype._events.call({ game, me, puppets: new Map() }, [
    ['h', 7, 20, 4150, -1225],
    ['h', 8, 50, 0, 0], // someone else
    ['h', 7, 5, null, null], // a fall: no direction
  ]);
  assert.deepEqual(calls, [
    ['hurt', 20],
    ['from', 41.5, -12.25, 'hit', 0.5],
    ['hurt', 5],
  ]);
});
