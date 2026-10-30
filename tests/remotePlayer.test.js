// A player on the game server: a soldier with the player's own controls, no
// screen, driven by his input messages. The gun's state the rules need (up
// after a switch, the sights up) is kept apart from the first-person drawing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, addPlayer, step } from '../src/server/battle.js';
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

test('a player takes a bot\'s place: the bot fights on until he falls, then is gone for good', async () => {
  const g = await makeBattle({ perSide: 4, seed: 5 });
  const side = (t) => g.soldiers.filter((s) => s.team === t).length;
  const before = side(1);
  const pc = addPlayer(g, { name: 'Tester', faction: 'US', cls: 'infantry', team: 1 });
  const bot = g.soldiers.find((s) => s.retire);
  assert.ok(bot && bot.team === 1 && bot !== pc.soldier, 'one bot on his side makes room');
  assert.equal(side(1), before + 1, 'still there until he falls');
  bot.die({ type: 'test' });
  step(g, 5);
  assert.ok(!g.soldiers.includes(bot), 'gone once down');
  assert.equal(g.rosterChanged, true);
  assert.equal(side(1), before, 'the side is back to its size');
  step(g, 20);
  assert.ok(!g.soldiers.includes(bot), 'and never back');
});

test('a fallen player comes back in at the point he chose, once its wait is over', async () => {
  const g = await makeBattle({ perSide: 4, seed: 9 });
  const pc = addPlayer(g, { name: 'Tester', faction: 'US', cls: 'infantry', team: 1 });
  const s = pc.soldier;
  const pts = g.mode._spawnPoints(1);
  const pick = pts[pts.length - 1];
  s.die({ type: 'test' });
  let seq = 0;
  const send = (deploy) => g.applyInput(s.id, encodeInput({ seq: ++seq, deploy }));
  step(g, 2);
  send(pick.id);
  const wait = g.mode._spawnDelay(pick, 1);
  step(g, wait - 3);
  assert.equal(s.alive, false, 'not before the wait');
  step(g, 2);
  assert.equal(s.alive, true);
  assert.ok(Math.hypot(s.body.x - pick.x, s.body.z - pick.z) < pick.radius + 30, 'at the point he chose');
  // A choice that arrives once he is back in is not kept for next time.
  send(pts[0].id);
  assert.equal(pc.deployAt ?? null, null);
});

test('a tank crewman joins in the tank he chose, drives it from his messages, and comes back in a tank', async () => {
  const g = await makeBattle({ perSide: 4, seed: 11 });
  const pc = addPlayer(g, { name: 'Tanker', faction: 'GE', cls: 'tanker', team: 0, tank: 'tiger1' });
  const s = pc.soldier;
  assert.ok(s.vehicle, 'in a tank at once');
  assert.equal(s.vehicle.def.id, 'tiger1');
  assert.equal(s.seat, 0, 'in the driver\'s seat');
  assert.equal(s.vehicle.team, 0);
  // His forward key drives it.
  const v = s.vehicle;
  const x0 = v.body.position.x,
    z0 = v.body.position.z;
  let seq = 0;
  for (let i = 0; i < 240; i++) {
    g.applyInput(s.id, encodeInput({ seq: ++seq, held: ['forward'], look: [pc.look.yaw, 0] }));
    step(g, 1 / 60);
  }
  assert.ok(Math.hypot(v.body.position.x - x0, v.body.position.z - z0) > 1, 'it moved');
  // To the gunner's seat: his aim turns the turret, his fire key fires the gun.
  const gunner = v.seats.findIndex((q) => q.role === 'gunner');
  g.applyInput(s.id, encodeInput({ seq: ++seq, pressed: [`seat${gunner + 1}`] }));
  step(g, 0.1);
  assert.equal(s.seat, gunner);
  const want = v.aim.yaw + 0.8;
  for (let i = 0; i < 300; i++) {
    g.applyInput(s.id, encodeInput({ seq: ++seq, look: [want, 0.02], range: 600 }));
    step(g, 1 / 60);
  }
  assert.ok(Math.abs(v.aim.yaw - want) < 1e-3, 'aimed where his browser says');
  assert.equal(v.sightRange, 600);
  const shells = g.projectiles.active?.length ?? 0;
  g.applyInput(s.id, encodeInput({ seq: ++seq, pressed: ['fire'], look: [want, 0.02] }));
  step(g, 0.05);
  assert.ok(!v.loaded || (g.projectiles.active?.length ?? 0) > shells, 'the gun fired');
  // Out, on foot.
  g.applyInput(s.id, encodeInput({ seq: ++seq, pressed: ['use'] }));
  step(g, 0.1);
  assert.equal(s.vehicle, null, 'got out');
  // Down and back: in a tank again.
  s.die({ type: 'test' });
  step(g, 65);
  assert.equal(s.alive, true);
  assert.ok(s.vehicle && s.vehicle !== v, 'a new tank');
  assert.equal(s.vehicle.def.id, 'tiger1');
});

test("an online battle's bots fight at the battle's difficulty (easy unless the server says otherwise)", async () => {
  const g = await makeBattle({ perSide: 4, seed: 2, difficulty: 'easy' });
  step(g, 1);
  const brains = g.soldiers.map((s) => s.brain).filter((b) => b?.difficulty);
  assert.ok(brains.length > 0 && brains.every((b) => b.difficulty === 'easy'));
});
