// Procedural sound synthesis: every sound in the game is generated in code at
// startup (there are no audio files). Pure functions returning mono
// Float32Array samples in [-1, 1] at a given sample rate; no Web Audio, so it
// all runs in Node as well (tests) and in the browser (AudioSystem in audio.js).
//
// Two ways in:
//  - SOUNDS / generateSound(id, variant, sampleRate): the registry the
//    AudioSystem uses (ids such as 'rifle', 'rifleFar', 'impactWood', 'stepGravel').
//  - make*(kind, opts, sampleRate) helpers per family, e.g.
//    makeGunshot('rifle', { far: true }), makeBulletFlight('crack', { miss: 2 }).
//    opts.variant picks the same take the registry would generate; opts.seed
//    overrides the random seed.
//
// Recipes live in ./recipes/*.js and the DSP primitives in ./dsp.js.
import { Rng, hashString } from './dsp.js';
import {
  CRACK_MISS,
  ECHO_DUR,
  ECHO_OF,
  ECHO_SIZES,
  FAR_DUR,
  FAR_OF,
  GUN_TYPES,
  NEAR_DUR,
  crackSound,
  gunEcho,
  gunshotFar,
  gunshotNear,
  ricochetSound,
  whizSound,
} from './recipes/weapons.js';
import { IMPACTS, MECHANICAL } from './recipes/foley.js';
import { PEOPLE, STEP_DUR, SURFACES, footstep } from './recipes/people.js';
import { AMBIENCE, ENGINE_SPECS, EXPLOSIONS, IR_DUR, TRACK_SPEC, UI, VEHICLES, reverbIR } from './recipes/world.js';
import { BIKE_ENGINE_SPECS, BIKE_SOUNDS } from './recipes/bikes.js';

export { GUN_TYPES, FAR_OF, ECHO_OF, CRACK_MISS, SURFACES, ENGINE_SPECS, TRACK_SPEC, BIKE_ENGINE_SPECS };

export const DEFAULT_SAMPLE_RATE = 48000;

// ---------------------------------------------------------------------------
// Registry
//
// id -> {
//   id, group,        listing group (gunshots, gunshotsFar, bullets, impacts, ...)
//   dur,              length in seconds (loops: exact loop length)
//   loop,             true for seamless loops
//   variants,         number of different takes generated at startup
//   rate,             1 = full sample rate; 0.5 = half (for content below ~10 kHz:
//                     far reports, rumbles, engines, ambience) to save time/memory
//   cls,              distance class used by the AudioSystem (see audio.js)
//   pitchVar, volVar  random playback variation (fraction)
//   alias,            shares the buffers of another id
//   make(rng, sr, variant) -> Float32Array
// }
export const SOUNDS = {};

function def(id, d) {
  SOUNDS[id] = { id, variants: 1, rate: 1, loop: false, cls: 'medium', pitchVar: 0.03, volVar: 0.1, ...d };
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const HEAVY_GUNS = new Set(['atRifle', 'panzerfaust', 'tankGun']);

for (const type of GUN_TYPES) {
  const cls = HEAVY_GUNS.has(type) ? 'heavy' : 'gun';
  def(type, {
    group: 'gunshots',
    dur: NEAR_DUR[type],
    variants: type === 'tankGun' ? 2 : 3,
    cls,
    pitchVar: 0.025,
    volVar: 0.08,
    make: (rng, sr) => gunshotNear(type, rng, sr),
  });
}
for (const type of GUN_TYPES) {
  const far = FAR_OF[type];
  const cls = HEAVY_GUNS.has(type) ? 'heavy' : 'gun';
  if (far !== type) def(`${type}Far`, { group: 'gunshotsFar', alias: `${far}Far`, cls });
  else
    def(`${type}Far`, {
      group: 'gunshotsFar',
      dur: FAR_DUR[far],
      variants: 2,
      rate: 0.5,
      cls,
      pitchVar: 0.04,
      make: (rng, sr) => gunshotFar(type, rng, sr),
    });
}
for (const size of ECHO_SIZES) {
  def(`echo${cap(size)}`, {
    group: 'gunshots',
    dur: ECHO_DUR[size],
    variants: 2,
    rate: 0.5,
    cls: size === 'heavy' ? 'heavy' : 'gun',
    make: (rng, sr) => gunEcho(size, rng, sr),
  });
}

def('crack', {
  group: 'bullets',
  dur: 0.25,
  variants: CRACK_MISS.length,
  cls: 'crack',
  pitchVar: 0.02,
  volVar: 0.05,
  make: (rng, sr, v) => crackSound(rng, sr, CRACK_MISS[Math.min(v, CRACK_MISS.length - 1)]),
});
def('whiz', { group: 'bullets', dur: 0.3, variants: 3, cls: 'crack', pitchVar: 0.08, make: whizSound });
def('ricochet', { group: 'bullets', dur: 0.9, variants: 4, cls: 'impact', pitchVar: 0.1, make: ricochetSound });

for (const [id, d] of Object.entries(IMPACTS)) {
  const variants = ['impactDirt', 'impactWood', 'impactStone', 'impactMetal', 'impactFlesh'].includes(id) ? 4 : 3;
  def(id, { group: 'impacts', dur: d.dur, variants, cls: 'impact', pitchVar: 0.06, make: d.make });
}

const MECH_VARIANTS = { casingBrass: 4, casingSoft: 3, linkDrop: 3 };
for (const [id, d] of Object.entries(MECHANICAL)) {
  def(id, { group: 'mechanical', dur: d.dur, variants: MECH_VARIANTS[id] ?? 2, cls: 'mech', pitchVar: 0.03, volVar: 0.08, make: d.make });
}

for (const s of SURFACES) {
  def(`step${cap(s)}`, {
    group: 'footsteps',
    dur: STEP_DUR[s],
    variants: 6,
    cls: 'step',
    pitchVar: 0.05,
    volVar: 0.15,
    make: (rng, sr) => footstep(s, rng, sr),
  });
}

const PEOPLE_VARIANTS = { jumpLand: 2, bodyFall: 2, proneDown: 2, hurtGrunt: 4 };
for (const [id, d] of Object.entries(PEOPLE)) {
  def(id, {
    group: 'people',
    dur: d.dur,
    loop: !!d.loop,
    variants: PEOPLE_VARIANTS[id] ?? 1,
    rate: d.loop ? (id === 'heartbeat' ? 0.25 : 0.5) : 1,
    cls: 'voice',
    pitchVar: d.loop ? 0 : 0.04,
    volVar: d.loop ? 0 : 0.1,
    make: d.make,
  });
}

for (const [id, d] of Object.entries(EXPLOSIONS)) {
  def(id, { group: 'explosions', dur: d.dur, variants: id === 'tankExplosion' ? 1 : 2, rate: 0.5, cls: 'heavy', pitchVar: 0.06, make: d.make });
}

// Vehicles, then motorcycles and bicycles (recipes/bikes.js).
for (const [id, d] of Object.entries({ ...VEHICLES, ...BIKE_SOUNDS })) {
  def(id, {
    group: 'vehicles',
    dur: d.dur,
    loop: !!d.loop,
    variants: d.loop ? 1 : 2,
    rate: 0.5,
    cls: 'vehicle',
    pitchVar: d.loop ? 0 : 0.05,
    volVar: d.loop ? 0 : 0.1,
    make: d.make,
  });
}

for (const [id, d] of Object.entries(AMBIENCE)) {
  def(id, { group: 'ambience', dur: d.dur, loop: true, rate: 0.5, cls: 'ambience', pitchVar: 0, volVar: 0, make: d.make });
}

for (const [id, d] of Object.entries(UI)) {
  def(id, { group: 'ui', dur: d.dur, cls: 'ui', pitchVar: 0, volVar: 0, make: d.make });
}

// Resolve aliases (they share the target's buffers, length and rate).
for (const d of Object.values(SOUNDS)) {
  if (!d.alias) continue;
  const t = SOUNDS[d.alias];
  if (!t || t.alias) throw new Error(`Bad alias ${d.id} -> ${d.alias}`);
  Object.assign(d, { dur: t.dur, loop: t.loop, variants: t.variants, rate: t.rate, pitchVar: t.pitchVar, volVar: t.volVar, make: t.make });
}

export const SOUND_IDS = Object.keys(SOUNDS);
export const GROUPS = [...new Set(SOUND_IDS.map((id) => SOUNDS[id].group))];

export function seedFor(id, variant = 0) {
  return (hashString(id) ^ Math.imul(variant + 1, 0x9e3779b1)) >>> 0;
}

// The exact samples the AudioSystem uses for (id, variant). sampleRate is the
// rate of the returned buffer (the AudioSystem passes context rate * def.rate).
export function generateSound(id, variant = 0, sampleRate = DEFAULT_SAMPLE_RATE) {
  const d = SOUNDS[id];
  if (!d) throw new Error(`Unknown sound ${id}`);
  const src = d.alias || id;
  return d.make(new Rng(seedFor(src, variant)), sampleRate, variant);
}

// Total samples generate-all would produce at a context rate (for progress).
export function generationCost(sampleRate = DEFAULT_SAMPLE_RATE, ids = SOUND_IDS) {
  let n = 0;
  for (const id of ids) {
    const d = SOUNDS[id];
    if (!d.alias) n += d.dur * sampleRate * d.rate * d.variants;
  }
  return n;
}

function make(id, opts, sampleRate) {
  const d = SOUNDS[id];
  if (!d) throw new Error(`Unknown sound ${id}`);
  const src = d.alias || id;
  const variant = opts.variant ?? 0;
  const rng = new Rng(opts.seed ?? seedFor(src, variant));
  return d.make(rng, sampleRate, variant);
}

// ---------------------------------------------------------------------------
// Family helpers (all return Float32Array mono samples at sampleRate)

// type: one of GUN_TYPES, or '<type>Far'. opts: { far, variant, seed }.
export function makeGunshot(type, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  let t = type;
  let far = !!opts.far;
  if (t.endsWith('Far')) {
    t = t.slice(0, -3);
    far = true;
  }
  if (!GUN_TYPES.includes(t)) throw new Error(`Unknown gun type ${type}`);
  const id = far ? `${t}Far` : t;
  const src = SOUNDS[id].alias || id;
  const rng = new Rng(opts.seed ?? seedFor(src, opts.variant ?? 0));
  return far ? gunshotFar(t, rng, sampleRate) : gunshotNear(t, rng, sampleRate);
}

// size: 'light' | 'medium' | 'heavy' (or a gun type, mapped with ECHO_OF).
export function makeGunEcho(size = 'medium', opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  const s = ECHO_OF[size] || size;
  return make(`echo${cap(s)}`, opts, sampleRate);
}

// kind: 'crack' | 'whiz' | 'ricochet'. opts.miss (m) for 'crack' (default 1.5).
export function makeBulletFlight(kind, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (kind === 'crack') {
    const rng = new Rng(opts.seed ?? seedFor('crack', opts.variant ?? 0));
    const miss = opts.miss ?? CRACK_MISS[Math.min(opts.variant ?? 2, CRACK_MISS.length - 1)];
    return crackSound(rng, sampleRate, miss);
  }
  if (kind !== 'whiz' && kind !== 'ricochet') throw new Error(`Unknown bullet sound ${kind}`);
  return make(kind, opts, sampleRate);
}

const prefixed = (prefix, kind) => (kind.startsWith(prefix) ? kind : prefix + cap(kind));

// kind: 'impactDirt' ... or the short form 'dirt', 'mud', 'wood', 'stone', 'metal',
// 'armor', 'glass', 'water', 'flesh', 'sand', 'foliage'.
export function makeImpact(kind, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  const id = prefixed('impact', kind);
  if (!IMPACTS[id]) throw new Error(`Unknown impact ${kind}`);
  return make(id, opts, sampleRate);
}

export function makeMechanical(kind, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!MECHANICAL[kind]) throw new Error(`Unknown mechanical sound ${kind}`);
  return make(kind, opts, sampleRate);
}

// surface: 'grass', 'dirt', 'gravel', 'stone', 'wood', 'mud', 'water', 'leaves',
// 'sand' (or 'stepGrass' etc.).
export function makeFootstep(surface, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  const id = prefixed('step', surface);
  if (!SOUNDS[id] || SOUNDS[id].group !== 'footsteps') throw new Error(`Unknown surface ${surface}`);
  return make(id, opts, sampleRate);
}

export function makePeople(kind, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!PEOPLE[kind]) throw new Error(`Unknown people sound ${kind}`);
  return make(kind, opts, sampleRate);
}

export function makeExplosion(kind, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!EXPLOSIONS[kind]) throw new Error(`Unknown explosion ${kind}`);
  return make(kind, opts, sampleRate);
}

export function makeVehicle(kind, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!VEHICLES[kind]) throw new Error(`Unknown vehicle sound ${kind}`);
  return make(kind, opts, sampleRate);
}

export function makeAmbience(kind, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!AMBIENCE[kind]) throw new Error(`Unknown ambience ${kind}`);
  return make(kind, opts, sampleRate);
}

export function makeUI(kind, opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!UI[kind]) throw new Error(`Unknown UI sound ${kind}`);
  return make(kind, opts, sampleRate);
}

// Reverb impulse response, unit energy. kind: 'outdoor' (sparse early reflections,
// ~1.2 s decay) | 'indoor' (dense, ~0.55 s). opts.channel picks a decorrelated
// channel (0/1) for a stereo pair; opts.seed overrides the seed.
export function makeReverbIR(kind = 'outdoor', opts = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!IR_DUR[kind]) throw new Error(`Unknown reverb ${kind}`);
  const rng = new Rng(opts.seed ?? seedFor(`ir.${kind}`, opts.channel ?? 0));
  return reverbIR(kind, rng, sampleRate);
}

export const IR_KINDS = Object.keys(IR_DUR);
export { IR_DUR };
