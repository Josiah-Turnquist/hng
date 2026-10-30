// Recording a battle and playing it back, for finding bugs: the battle's
// settings and seed, every player's input with the step it was used on, and a
// fingerprint of the battle every second (net/protocol.js stateHash). Played
// back, the same battle runs again from the same seed and inputs, and the
// fingerprints say whether it went the same way. If it didn't, something rolled
// dice outside the battle's own stream (core/math.js rand) or carried over
// from another battle.
//
//   const rec = new Recorder(opts)          // opts as for makeBattle
//   rec.join(tick, playerOpts, id)          // a player joining (addPlayer's options; his soldier's number)
//   rec.input(tick, playerId, message)      // each input as it is applied
//   rec.check(tick, game)                   // a fingerprint (the runner does it every second)
//   JSON.stringify(rec)                     // to a file
//   await replay(recording)                 // -> { ok, ticks, checked, mismatch }
import { makeBattle, addPlayer } from './battle.js';
import { stateHash } from '../net/protocol.js';

export const TICK = 1 / 60;
export const CHECK_EVERY = 60;

export class Recorder {
  constructor(opts) {
    this.data = { v: 1, opts, joins: [], inputs: [], checks: [] };
  }
  join(tick, playerOpts, id) {
    this.data.joins.push([tick, playerOpts, id]);
  }
  input(tick, playerId, message) {
    this.data.inputs.push([tick, playerId, message]);
  }
  check(tick, game) {
    this.data.checks.push([tick, stateHash(game)]);
  }
  toJSON() {
    return this.data;
  }
}

export async function replay(rec, { upTo = Infinity } = {}) {
  const g = await makeBattle(rec.opts);
  const checks = new Map(rec.checks.map(([t, h]) => [t, h]));
  const last = Math.min(upTo, rec.checks.length ? rec.checks[rec.checks.length - 1][0] : 0);
  const joins = rec.joins || [];
  let k = 0,
    j = 0,
    checked = 0;
  // Players who joined before the first step.
  while (j < joins.length && joins[j][0] <= 0) addPlayer(g, joins[j++][1]);
  for (let tick = 1; tick <= last; tick++) {
    // Players joining, then their inputs, on the step they were used.
    while (j < joins.length && joins[j][0] === tick) addPlayer(g, joins[j++][1]);
    while (k < rec.inputs.length && rec.inputs[k][0] === tick) {
      const [, id, msg] = rec.inputs[k++];
      g.applyInput?.(id, msg);
    }
    g.update(TICK);
    const want = checks.get(tick);
    if (want) {
      const got = stateHash(g);
      checked++;
      if (got !== want) return { ok: false, ticks: tick, checked, mismatch: { tick, want, got } };
    }
  }
  return { ok: true, ticks: last, checked, mismatch: null };
}
