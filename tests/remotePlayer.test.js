// A player on the game server: a soldier with the player's own controls, no
// screen, driven by his input messages. The gun's state the rules need (up
// after a switch, the sights up) is kept apart from the first-person drawing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, addPlayer } from '../src/server/battle.js';
import { encodeInput, watchEvents } from '../src/net/protocol.js';
import { Recorder, replay, TICK, CHECK_EVERY } from '../src/server/record.js';
import { GunHold } from '../src/game/gunHold.js';

function driver(g, pc, rec = null) {
  let seq = 0,
    tick = 0;
  const id = pc.soldier.id;
  return {
    get tick() {
      return tick;
    },
    run(seconds, held, pressedFirst = [], look = null) {
      for (let i = 0; i < seconds * 60; i++) {
        tick++;
        if (i % 2 === 0) {
          const msg = encodeInput({ seq: ++seq, held, pressed: i === 0 ? pressedFirst : [], look: look || [pc.look.yaw, pc.look.pitch] });
          rec?.input(tick, id, msg);
          g.applyInput(id, msg);
        }
        g.update(TICK);
        if (rec && tick % CHECK_EVERY === 0) rec.check(tick, g);
      }
    },
  };
}

test("the gun's hold: up about a quarter second after a switch, the sights up in the gun's time", () => {
  const h = new GunHold();
  h.lower();
  assert.equal(h.up, false);
  for (let i = 0; i < 15; i++) h.update(1 / 60, { mass: 4.3 });
  assert.equal(h.up, false);
  for (let i = 0; i < 3; i++) h.update(1 / 60, { mass: 4.3 });
  assert.equal(h.up, true);
  for (let i = 0; i < 10; i++) h.update(1 / 60, { aiming: true, mass: 4.3 });
  assert.equal(h.aimed, false, 'a Garand takes about a quarter second to the eye');
  for (let i = 0; i < 10; i++) h.update(1 / 60, { aiming: true, mass: 4.3 });
  assert.equal(h.aimed, true);
});

test('a server player walks, aims, fires and switches guns from his messages', async () => {
  const g = await makeBattle({ perSide: 4, seed: 3 });
  const ev = watchEvents(g);
  const pc = addPlayer(g, { name: 'Tester', faction: 'US', cls: 'infantry' });
  const s = pc.soldier;
  assert.equal(s.remote, true);
  assert.equal(pc.viewmodel, null, 'no first-person gun on a server');
  const d = driver(g, pc);
  const x0 = s.body.x,
    z0 = s.body.z;
  d.run(3, ['forward']);
  assert.ok(Math.hypot(s.body.x - x0, s.body.z - z0) > 5, 'walked forward');
  d.run(1, ['aim']);
  assert.ok(s.aiming && pc.hold.aimed);
  ev.take();
  d.run(0.5, ['aim', 'fire'], ['fire']);
  const shots = ev.take().filter((e) => e[0] === 'f' && e[1] === s.id);
  assert.equal(shots.length, 1, 'one round from a Garand for one pull');
  // The round leaves where he faces, at the Garand's muzzle velocity.
  const [, , , , , , vx, vy, vz] = shots[0];
  const v = Math.hypot(vx, vy, vz) / 10;
  assert.ok(v > 820 && v < 880, `${v} m/s`);
  const facing = [-Math.sin(pc.look.yaw), -Math.cos(pc.look.yaw)];
  assert.ok((vx * facing[0] + vz * facing[1]) / Math.hypot(vx, vz) > 0.99);
  // A new gun comes up before it fires.
  d.run(0.1, [], ['slot2']);
  assert.equal(s.weapon.def.id, 'm1911a1');
  assert.equal(pc.hold.up, false);
  d.run(0.4, []);
  assert.equal(pc.hold.up, true);
});

test('a battle with a player in it records and plays back the same', async () => {
  const opts = { perSide: 4, seed: 21 };
  const g = await makeBattle(opts);
  const rec = new Recorder(opts);
  const who = { name: 'Tester', faction: 'US', cls: 'infantry' };
  const pc = addPlayer(g, who);
  rec.join(0, who, pc.soldier.id);
  const d = driver(g, pc, rec);
  d.run(4, ['forward', 'sprint']);
  d.run(2, ['aim'], [], [pc.look.yaw + 0.6, 0.05]);
  d.run(2, ['aim', 'fire'], ['fire']);
  d.run(4, ['forward', 'left']);
  const r = await replay(JSON.parse(JSON.stringify(rec)));
  assert.equal(r.ok, true, JSON.stringify(r.mismatch));
  assert.equal(r.checked, 12);
});
