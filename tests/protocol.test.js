// The messages between browser and game server, the server's stand-in for a
// player's keyboard, and recording a battle to play it back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeInput, decodeInput, RemoteInput, snapshot, readSnapshot, roster, watchEvents, stateHash, ACTION_LIST } from '../src/net/protocol.js';
import { makeBattle, step } from '../src/server/battle.js';
import { Recorder, replay, TICK, CHECK_EVERY } from '../src/server/record.js';

test('an input frame names actions, not keys, and survives the trip', () => {
  const m = encodeInput({ seq: 7, held: ['forward', 'sprint', 'fire'], pressed: ['fire', 'nonsense'], look: [1.2345, -0.25], wheel: 1 });
  const back = decodeInput(JSON.parse(JSON.stringify(m)));
  assert.deepEqual([...back.held].sort(), ['fire', 'forward', 'sprint']);
  assert.deepEqual([...back.pressed], ['fire']);
  assert.ok(Math.abs(back.look[0] - 1.2345) < 1e-4 && Math.abs(back.look[1] + 0.25) < 1e-4);
  assert.equal(back.seq, 7);
  assert.ok(ACTION_LIST.includes('bandage'));
  // Rubbish is refused, out-of-range values are clamped.
  assert.equal(decodeInput({ k: 'i', h: 'x' }), null);
  assert.equal(decodeInput({ k: 'i', q: 1, h: [], p: [], l: [0, 99999], w: 50 }).wheel, 5);
});

test("the server's stand-in keyboard answers like the real one", () => {
  const inp = new RemoteInput();
  const frame = (seq, held, pressed = [], wheel = 0) => decodeInput(encodeInput({ seq, held, pressed, look: [0.5, 0], wheel }));
  assert.ok(inp.apply(frame(1, ['forward', 'fire'], ['fire'])));
  assert.ok(inp.is('forward') && inp.hit('fire') && !inp.hit('forward'));
  inp.endFrame();
  assert.ok(!inp.hit('fire') && inp.is('fire'), 'a press counts once');
  assert.equal(inp.apply(frame(1, [])), false, 'old or repeated frames are ignored');
  inp.apply(frame(2, ['forward'], [], -1));
  assert.ok(inp.up('fire') && !inp.is('fire'));
  assert.equal(inp.takeWheel(), -1);
  assert.equal(inp.takeWheel(), 0);
  assert.deepEqual(inp.look, [0.5, 0]);
  assert.deepEqual(inp.takeMouse(), [0, 0]);
});

test('a snapshot carries every soldier, vehicle and point, and reads back', async () => {
  const g = await makeBattle({ perSide: 4, seed: 5 });
  const ev = watchEvents(g);
  step(g, 45);
  const m = JSON.parse(JSON.stringify(snapshot(g, 2700, { events: ev.take() })));
  const s = readSnapshot(m);
  assert.equal(s.soldiers.length, g.soldiers.length);
  const a = g.soldiers[0],
    b = s.soldiers[0];
  assert.equal(b.id, a.id);
  assert.ok(Math.abs(b.x - a.body.x) <= 0.005 && Math.abs(b.z - a.body.z) <= 0.005);
  assert.equal(b.alive, a.alive);
  assert.equal(s.points.length, g.mode.points.length);
  assert.equal(s.vehicles.length, g.vehicles.length);
  assert.ok(s.events.some((e) => e[0] === 'f'), 'shots were fired');
  const r = roster(g);
  assert.equal(r.s.length, g.soldiers.length);
  // About a kilobyte and a half for 8 soldiers and the town's 22 points.
  assert.ok(JSON.stringify(m).length < 4000);
});

test('a recorded battle plays back the same, fingerprint by fingerprint', async () => {
  const opts = { perSide: 4, seed: 11 };
  const g = await makeBattle(opts);
  const rec = new Recorder(opts);
  for (let tick = 1; tick <= 20 * 60; tick++) {
    g.update(TICK);
    if (tick % CHECK_EVERY === 0) rec.check(tick, g);
  }
  const saved = JSON.parse(JSON.stringify(rec));
  const r = await replay(saved);
  assert.equal(r.ok, true);
  assert.equal(r.checked, 20);
  // A tampered fingerprint is caught.
  saved.checks[5][1] = 'deadbeef';
  const bad = await replay(saved);
  assert.equal(bad.ok, false);
  assert.equal(bad.mismatch.tick, 6 * 60);
  assert.equal(stateHash(g), r.ok && saved.checks[19][1]);
});

test('an online battle turns the short way round between snapshots', async () => {
  const { lerpAngle } = await import('../src/net/online.js');
  // From just short of half a turn one way to just past it: the short way, through the back.
  const a = Math.PI - 0.1,
    b = -Math.PI + 0.1;
  const mid = lerpAngle(a, b, 0.5);
  assert.ok(Math.abs(Math.abs(Math.atan2(Math.sin(mid), Math.cos(mid))) - Math.PI) < 1e-9);
  assert.equal(lerpAngle(0.2, 0.6, 0.5), 0.4);
});
