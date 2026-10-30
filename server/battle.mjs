// Run one battle the way the game server will: no graphics, 60 steps a
// second in real time, a snapshot for the players 20 times a second, and a
// recording to play back. Bots only for now (players join in Phase 1).
//
//   node server/battle.mjs [--seed 7] [--per-side 12] [--minutes 20]
//                          [--seconds 120] [--fast] [--record battle.json]
//
// --fast runs as quickly as the processor allows instead of in real time.
// Every 5 seconds it prints the battle's state, how much of one processor
// core it takes, and how big the snapshots are (as sent, and squeezed the
// way browsers and servers squeeze WebSocket messages).
import { writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { makeBattle } from '../src/server/battle.js';
import { snapshot, watchEvents } from '../src/net/protocol.js';
import { Recorder, TICK, CHECK_EVERY } from '../src/server/record.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const opts = { seed: Number(arg('seed', 7)), perSide: Number(arg('per-side', 12)), minutes: Number(arg('minutes', 20)) };
const seconds = Number(arg('seconds', 120));
const fast = arg('fast', false) === true;
const recordTo = arg('record', null);

const t0 = performance.now();
const g = await makeBattle(opts);
console.log(`Battle ready in ${((performance.now() - t0) / 1000).toFixed(1)} s: seed ${opts.seed}, ${opts.perSide} a side, ${g.soldiers.length} soldiers, ${g.vehicles.length} vehicles`);

const events = watchEvents(g);
const rec = new Recorder(opts);
const SNAP_EVERY = 3; // 60 steps a second / 3 = 20 snapshots a second
let tick = 0,
  bytes = 0,
  squeezed = 0,
  snaps = 0;
let cpu = process.cpuUsage(),
  from = 0;

function stepOnce() {
  tick++;
  g.update(TICK);
  if (tick % CHECK_EVERY === 0) rec.check(tick, g);
  if (tick % SNAP_EVERY === 0) {
    const text = JSON.stringify(snapshot(g, tick, { events: events.take() }));
    bytes += text.length;
    squeezed += deflateRawSync(text).length;
    snaps++;
  }
  if (tick % 300 === 0) report();
}

function report() {
  // Processor time for each second of battle: the share of one core the
  // battle needs in real time.
  const used = process.cpuUsage(cpu);
  const core = (used.user + used.system) / 1e6 / (g.time - from);
  cpu = process.cpuUsage();
  from = g.time;
  const alive = [0, 1].map((team) => g.soldiers.filter((s) => s.team === team && s.alive).length);
  const owners = (g.mode.points || []).map((p) => (p.owner === 0 ? 'A' : p.owner === 1 ? 'D' : '-')).join('');
  const per = snaps ? bytes / snaps : 0;
  console.log(
    `${String(Math.round(g.time)).padStart(4)} s | alive ${alive[0]} v ${alive[1]} | kills ${g.stats.kills.join(' v ')} | points ${owners} | ` +
      `${(core * 100).toFixed(0)}% of a core | snapshot ${(per / 1024).toFixed(1)} KB, ${(squeezed / snaps / 1024).toFixed(1)} KB squeezed = ${((squeezed / snaps) * 20 / 1024).toFixed(1)} KB/s a player`,
  );
  bytes = squeezed = snaps = 0;
}

const total = Math.round(seconds / TICK);
if (fast) {
  while (tick < total && !g.mode.over) stepOnce();
  finish();
} else {
  // Real time: as many steps as the clock says are due, then wait.
  const start = performance.now();
  const loop = () => {
    const due = Math.min(total, Math.floor((performance.now() - start) / 1000 / TICK));
    while (tick < due && !g.mode.over) stepOnce();
    if (tick >= total || g.mode.over) return finish();
    setTimeout(loop, 4);
  };
  loop();
}

function finish() {
  if (g.mode.over) console.log(`Battle over: ${g.mode.over.team === 0 ? 'attackers' : 'defenders'} win (${g.mode.over.why ?? ''})`);
  if (recordTo) {
    writeFileSync(recordTo, JSON.stringify(rec));
    console.log(`Recorded ${tick} steps to ${recordTo}`);
  }
  process.exit(0);
}
