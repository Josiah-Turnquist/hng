// A battle on the server keeps step with the players' screens through a
// hiccup (src/server/room.js): the steps missed while the server was busy are
// run afterwards rather than dropped (dropping them snapped walking players
// back to where they were seconds before), each input runs on its own step in
// the order sent, and a new battle is built in pieces so the running ones get
// their turns meanwhile (src/server/battle.js breather).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleRoom } from '../src/server/room.js';
import { encodeInput } from '../src/net/protocol.js';
import { TICK } from '../src/server/record.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const busy = (ms) => {
  for (const end = performance.now() + ms; performance.now() < end; );
};

test('a battle runs the steps it missed, its inputs one a step, and keeps going while another is built', async () => {
  const room = new BattleRoom({ perSide: 3, vehicles: false, send: () => {} });
  await room.ready;
  const client = {};
  const id = room.join(client, { userId: 'u1', name: 'Able', faction: 'US' });
  const applied = [];
  const apply = room.g.applyInput;
  room.g.applyInput = (sid, m) => (sid === id && applied.push([room.tick, m.q]), apply(sid, m));
  try {
    await wait(300);

    // The server busy for 0.6 s: afterwards the battle is back in step with the clock.
    const t0 = performance.now();
    const k0 = room.tick;
    busy(600);
    await wait(400);
    const want = (performance.now() - t0) / 1000 / TICK;
    assert.ok(room.tick - k0 > want - 6, `ran ${room.tick - k0} steps in ${want.toFixed(0)} steps' time`);

    // Five inputs in at once, the battle in step: all run within a step, in order.
    applied.length = 0;
    for (let q = 1; q <= 5; q++) room.input(client, encodeInput({ seq: q, held: ['forward'] }));
    await wait(200);
    assert.deepEqual(applied.map((a) => a[1]), [1, 2, 3, 4, 5]);
    const ticks = applied.map((a) => a[0]);
    assert.ok(ticks[4] - ticks[0] <= 1, `steps ${ticks}`);

    // The server busy while his inputs come in: afterwards they are run one a
    // step, as his screen played them, not all at once.
    applied.length = 0;
    const t2 = performance.now();
    busy(500);
    for (let q = 6; q < 6 + 30; q++) room.input(client, encodeInput({ seq: q, held: ['forward'] }));
    room.behind = Math.floor((performance.now() - t2) / 1000 / TICK);
    await wait(400);
    const spread = applied.map((a) => a[0]);
    assert.equal(applied.length, 30);
    assert.ok(spread.at(-1) - spread[0] >= 12, `30 inputs over ${spread.at(-1) - spread[0]} steps`);

    // Two seconds of inputs delivered at once (a stalled connection) all get in.
    applied.length = 0;
    for (let q = 36; q < 36 + 120; q++) room.input(client, encodeInput({ seq: q, held: ['forward'] }));
    await wait(300);
    assert.equal(applied.length, 120);

    // Another battle built meanwhile: this one is never stopped long.
    let last = performance.now();
    let worst = 0;
    const watch = setInterval(() => {
      const n = performance.now();
      worst = Math.max(worst, n - last);
      last = n;
    }, 2);
    const k1 = room.tick;
    const t1 = performance.now();
    const other = new BattleRoom({ perSide: 3, vehicles: true, send: () => {} });
    await other.ready;
    other.close();
    clearInterval(watch);
    // (The first battle with vehicles builds their models, once: up to a second.)
    assert.ok(worst < 1500, `stopped for ${worst.toFixed(0)} ms`);
    await wait(500);
    const behind = (performance.now() - t1) / 1000 / TICK - (room.tick - k1);
    assert.ok(behind < 6, `${behind.toFixed(0)} steps lost while another battle was built (longest stop ${worst.toFixed(0)} ms)`);
  } finally {
    room.close();
  }
});
