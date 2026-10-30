// Play a recorded battle back (server/battle.mjs --record) and check it goes
// the same way, fingerprint by fingerprint.
//
//   node server/replay.mjs battle.json
import { readFileSync } from 'node:fs';
import { replay } from '../src/server/record.js';

const rec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.warn = () => {};
const r = await replay(rec);
console.log(r.ok ? `Same battle: ${r.checked} fingerprints over ${r.ticks} steps match.` : `Different at step ${r.mismatch.tick}: recorded ${r.mismatch.want}, played back ${r.mismatch.got} (${r.checked - 1} matched before).`);
process.exit(r.ok ? 0 : 1);
