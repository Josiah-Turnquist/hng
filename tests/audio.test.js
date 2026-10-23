// Checks the procedural sound synthesis (src/audio/synth.js) without listening:
// valid samples, lengths, seamless loops, loudness relations between families and
// acoustic properties (spectra, decays, timing). Also exercises the AudioSystem
// logic (speed of sound, near/far reports, voice cap) against a mock AudioContext.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOUNDS,
  SOUND_IDS,
  GUN_TYPES,
  CRACK_MISS,
  ENGINE_SPECS,
  generateSound,
  generationCost,
  makeGunshot,
  makeBulletFlight,
  makeImpact,
  makeMechanical,
  makeFootstep,
  makePeople,
  makeExplosion,
  makeVehicle,
  makeAmbience,
  makeUI,
  makeReverbIR,
  makeGunEcho,
} from '../src/audio/synth.js';
import { bandEnergy, spectralCentroid, envelope, maxShortRms, loopSeam, stepRatioAt, peak, rms, toDb } from '../src/audio/analysis.js';
import { reflect, saturate } from '../src/audio/dsp.js';
import { AudioSystem, airAbsorptionCutoff, distanceGain, propagationDelay, gunshotLayers, crackVariant, SPEED_OF_SOUND } from '../src/audio/audio.js';

const SR = 48000;
const cache = new Map();
// The registry's own rate for each sound (full or half of SR).
function gen(id, v = 0) {
  const key = `${id}#${v}`;
  if (!cache.has(key)) cache.set(key, generateSound(id, v, SR * SOUNDS[id].rate));
  return cache.get(key);
}
const srOf = (id) => SR * SOUNDS[id].rate;

const REQUIRED = [
  ...GUN_TYPES,
  ...GUN_TYPES.map((t) => `${t}Far`),
  'crack',
  'whiz',
  'ricochet',
  'impactDirt',
  'impactMud',
  'impactWood',
  'impactStone',
  'impactMetal',
  'impactGlass',
  'impactWater',
  'impactFlesh',
  'impactSand',
  'boltOpen',
  'boltClose',
  'boltCycle',
  'stripperClip',
  'roundInsert',
  'garandPing',
  'garandClipIn',
  'magOut',
  'magIn',
  'drumIn',
  'chargingHandle',
  'beltCoverOpen',
  'beltCoverClose',
  'dryFire',
  'fireModeSwitch',
  'casingBrass',
  'casingSoft',
  'linkDrop',
  'weaponHandling',
  'scopeIn',
  'stepGrass',
  'stepDirt',
  'stepGravel',
  'stepStone',
  'stepWood',
  'stepMud',
  'stepWater',
  'stepLeaves',
  'stepSand',
  'jumpLand',
  'bodyFall',
  'proneDown',
  'breathingHeavy',
  'breathingCalm',
  'heartbeat',
  'hurtGrunt',
  'bandage',
  'grenadeExplosion',
  'explosionFar',
  'shellExplosion',
  'debrisRain',
  'tankExplosion',
  'engineJeep',
  'engineTankGas',
  'engineTankDiesel',
  'tracksClank',
  'gearShift',
  'turretMotor',
  'brakeSqueal',
  'tireSkid',
  'vehicleImpact',
  'wind',
  'windTrees',
  'riverWater',
  'distantBattle',
  'birds',
  'fire',
  'uiClick',
  'uiHover',
  'captureTick',
  'objectiveCaptured',
  'objectiveLost',
  'hitMarker',
];

test('every requested sound id exists', () => {
  for (const id of REQUIRED) assert.ok(SOUNDS[id], `missing ${id}`);
  assert.ok(GUN_TYPES.includes('tankGun') && SOUNDS.tankGunFar);
});

test('every take of every sound: finite samples in [-1, 1], expected length, not silent', () => {
  const t0 = performance.now();
  for (const id of SOUND_IDS) {
    const d = SOUNDS[id];
    const sr = srOf(id);
    for (let v = 0; v < d.variants; v++) {
      const x = gen(id, v);
      assert.ok(x instanceof Float32Array, id);
      assert.equal(x.length, Math.round(d.dur * sr), `${id} length`);
      let pk = 0;
      for (let i = 0; i < x.length; i++) {
        const a = Math.abs(x[i]);
        if (!(a <= 1)) assert.fail(`${id}#${v}: sample ${i} = ${x[i]}`);
        if (a > pk) pk = a;
      }
      assert.ok(pk > 0.05, `${id}#${v} is (nearly) silent: peak ${pk}`);
      if (!d.loop) {
        // One-shots start from silence and fade out to (nearly) zero.
        assert.ok(Math.abs(x[0]) < 0.05, `${id}#${v} starts with ${x[0]}`);
        assert.ok(Math.abs(x[x.length - 1]) < 0.01, `${id}#${v} ends with ${x[x.length - 1]}`);
      }
    }
  }
  const ms = performance.now() - t0;
  console.log(`# synthesized ${SOUND_IDS.length} ids (${(generationCost(SR) / 1e6).toFixed(1)} M samples, all takes) in ${ms.toFixed(0)} ms`);
});

test('sounds are deterministic, and takes differ', () => {
  for (const id of ['rifle', 'stepGravel', 'impactWood', 'crack', 'garandPing']) {
    const a = generateSound(id, 1, srOf(id));
    const b = generateSound(id, 1, srOf(id));
    assert.deepEqual(a, b, `${id} not deterministic`);
    const c = generateSound(id, 0, srOf(id));
    let diff = 0;
    for (let i = 0; i < Math.min(a.length, c.length); i++) diff += Math.abs(a[i] - c[i]);
    assert.ok(diff > 1, `${id} takes 0 and 1 are identical`);
  }
});

test('family helpers match the registry and work at other sample rates', () => {
  assert.deepEqual(makeGunshot('rifle', { far: true }, 24000), generateSound('rifleFar', 0, 24000));
  assert.deepEqual(makeGunshot('tankGunFar', {}, 24000), generateSound('tankGunFar', 0, 24000));
  assert.deepEqual(makeFootstep('grass', { variant: 2 }, SR), generateSound('stepGrass', 2, SR));
  assert.deepEqual(makeImpact('wood', { variant: 1 }, SR), generateSound('impactWood', 1, SR));
  const fns = [
    () => makeGunshot('pistol', {}, 44100),
    () => makeGunEcho('rifle', {}, 22050),
    () => makeBulletFlight('crack', { miss: 3 }, 44100),
    () => makeBulletFlight('whiz', {}, 44100),
    () => makeMechanical('garandPing', {}, 44100),
    () => makePeople('hurtGrunt', {}, 44100),
    () => makeExplosion('grenadeExplosion', {}, 22050),
    () => makeVehicle('engineJeep', {}, 22050),
    () => makeAmbience('fire', {}, 22050),
    () => makeUI('objectiveCaptured', {}, 44100),
  ];
  for (const f of fns) {
    const x = f();
    assert.ok(x.length > 100 && peak(x) <= 1 && peak(x) > 0.05);
    for (let i = 0; i < x.length; i++) if (!Number.isFinite(x[i])) assert.fail('non-finite sample');
  }
  assert.equal(makeGunshot('pistol', {}, 44100).length, Math.round(SOUNDS.pistol.dur * 44100));
  assert.throws(() => makeGunshot('laser'));
});

test('loops wrap seamlessly', () => {
  const loops = SOUND_IDS.filter((id) => SOUNDS[id].loop);
  assert.ok(loops.length >= 14, `only ${loops.length} loops`);
  const continuous = new Set([
    'engineJeep',
    'engineTankGas',
    'engineTankDiesel',
    'tracksClank',
    'turretMotor',
    'tireSkid',
    'wind',
    'windTrees',
    'riverWater',
    'fire',
  ]);
  for (const id of loops) {
    const x = gen(id);
    const sr = srOf(id);
    const seam = loopSeam(x, sr);
    // Compare with the same statistic at interior cut points: the seam must not
    // stand out from the loop's own sample-to-sample motion.
    const w = Math.max(4, Math.round(0.002 * sr));
    const inner = [];
    for (let k = 1; k < 400; k++) inner.push(stepRatioAt(x, Math.floor((k * x.length) / 400), w).ratio);
    inner.sort((a, b) => a - b);
    const limit = Math.max(4, inner[Math.floor(inner.length * 0.99)] * 1.5);
    assert.ok(
      seam.jumpRatio < limit || seam.jump < 1e-4,
      `${id}: seam jump ${seam.jump.toExponential(2)} is ${seam.jumpRatio.toFixed(1)}x the local step (limit ${limit.toFixed(1)})`,
    );
    if (continuous.has(id))
      assert.ok(seam.levelRatio > 0.5 && seam.levelRatio < 2, `${id}: level jumps across the seam (${seam.levelRatio.toFixed(2)})`);
  }
});

test('loudness relations: gunshots >> mechanics >> footsteps; UI stays modest', () => {
  const loud = (id) => maxShortRms(gen(id), srOf(id), 0.05);
  const steps = SOUND_IDS.filter((id) => SOUNDS[id].group === 'footsteps');
  const loudestStep = Math.max(...steps.map(loud));
  const nearGuns = GUN_TYPES.map(loud);
  const quietestGun = Math.min(...nearGuns);
  assert.ok(quietestGun > 3 * loudestStep, `quietest gunshot ${quietestGun.toFixed(3)} vs loudest footstep ${loudestStep.toFixed(3)}`);
  const median = (a) => [...a].sort((p, q) => p - q)[a.length >> 1];
  assert.ok(median(nearGuns) > 6 * median(steps.map(loud)), 'typical gunshot should be ~16 dB+ over a typical footstep');
  for (const id of ['boltCycle', 'magIn', 'stripperClip']) assert.ok(loud(id) < quietestGun / 2 && loud(id) > loudestStep * 0.5, id);
  assert.ok(loud('grenadeExplosion') > loud('rifle') && loud('shellExplosion') > loud('rifle'), 'explosions louder than a rifle');
  assert.ok(loud('tankGun') > loud('rifle') && loud('atRifle') > loud('rifle'));
  for (const id of ['uiClick', 'uiHover', 'captureTick', 'hitMarker']) assert.ok(peak(gen(id)) <= 0.35 && loud(id) < quietestGun, id);
  // A near miss is very sharp: huge crest factor.
  const c = gen('crack', 0);
  assert.ok(peak(c) / rms(c) > 10, 'crack crest factor');
});

test('gunshots: far reports are darker than near ones; big guns have more low end', () => {
  for (const t of GUN_TYPES) {
    const near = spectralCentroid(gen(t), srOf(t));
    const far = spectralCentroid(gen(`${t}Far`), srOf(`${t}Far`));
    assert.ok(far < near * 0.9, `${t}: far centroid ${far.toFixed(0)} Hz vs near ${near.toFixed(0)} Hz`);
    // Far: almost nothing above 6 kHz (air absorption).
    assert.ok(bandEnergy(gen(`${t}Far`), srOf(`${t}Far`), 6000, 12000) < 0.01, `${t}Far keeps highs`);
  }
  const low = (id) => bandEnergy(gen(id), srOf(id), 20, 120);
  assert.ok(low('tankGun') > low('rifle') && low('rifle') > low('pistol'), 'low-end order tankGun > rifle > pistol');
  // The PPSh's Tokarev round is sharp and high; the Thompson's .45 deeper than it.
  assert.ok(spectralCentroid(gen('smgTokarev'), SR) > spectralCentroid(gen('smg45'), SR));
  // Machine-gun reports are short so bursts don't smear: most energy within 60 ms.
  const mg = gen('mg');
  assert.ok(rms(mg, 0, Math.round(0.06 * SR)) > 4 * rms(mg, Math.round(0.08 * SR)), 'mg tail too long');
  assert.ok(SOUNDS.mg.dur <= 0.4);
  // The rolling echo makes far reports long.
  for (const t of ['rifle', 'tankGun']) {
    const x = gen(`${t}Far`);
    const e = envelope(x, srOf(`${t}Far`), 0.05);
    assert.ok(toDb(e[16] / Math.max(...e)) > -40, `${t}Far: no rolling tail at 0.8 s`);
  }
});

test('bullet crack is an N-wave of 0.5-1.5 ms; closer misses are sharper', () => {
  let prevLen = 0;
  for (let v = 0; v < CRACK_MISS.length; v++) {
    const x = gen('crack', v);
    let iMax = 0;
    for (let i = 0; i < 200; i++) if (x[i] > x[iMax]) iMax = i;
    let iMin = iMax;
    for (let i = iMax; i < iMax + 120; i++) if (x[i] < x[iMin]) iMin = i;
    const lenMs = ((iMin - iMax) / SR) * 1000;
    assert.ok(lenMs >= 0.45 && lenMs <= 1.6, `miss ${CRACK_MISS[v]} m: N-wave ${lenMs.toFixed(2)} ms`);
    assert.ok(x[iMin] < -0.4 * x[iMax], 'negative phase of the N-wave');
    assert.ok(lenMs >= prevLen - 0.02, 'N-wave lengthens with miss distance');
    prevLen = lenMs;
    let iStart = iMax;
    while (iStart > 0 && x[iStart - 1] > 0.05 * x[iMax]) iStart--;
    assert.ok(((iMax - iStart) / SR) * 1000 <= 0.35, 'rise time at most ~0.3 ms');
  }
  // Whiz: Doppler, the pitch falls as the bullet goes by.
  for (let v = 0; v < SOUNDS.whiz.variants; v++) {
    const x = gen('whiz', v);
    const early = spectralCentroid(x, SR, { end: Math.round(0.08 * SR), size: 2048 });
    const late = spectralCentroid(x, SR, { start: Math.round(0.1 * SR), size: 2048 });
    assert.ok(late < early * 0.8, `whiz ${early.toFixed(0)} -> ${late.toFixed(0)} Hz`);
  }
});

test('Garand ping: bright inharmonic ring in 2-9 kHz that dies away in ~0.5 s', () => {
  for (let v = 0; v < SOUNDS.garandPing.variants; v++) {
    const x = gen('garandPing', v);
    assert.ok(bandEnergy(x, SR, 2000, 9000) > 0.7, '2-9 kHz energy');
    const e = envelope(x, SR, 0.01);
    const pk = Math.max(...e);
    assert.ok(toDb(e[20] / pk) > -30, 'still ringing at 0.2 s');
    assert.ok(toDb(e[50] / pk) < -20, 'mostly gone by 0.5 s');
  }
});

test('engine loops fire at rpm/60 x cylinders/2 at their reference rpm', () => {
  for (const id of Object.keys(ENGINE_SPECS)) {
    const spec = ENGINE_SPECS[id];
    assert.ok(Math.abs(spec.firingHz - (spec.refRpm / 60) * (spec.cylinders / 2)) < 1e-9);
    const x = gen(id);
    const sr = srOf(id);
    const want = 1 / spec.firingHz;
    let best = -Infinity,
      bestLag = 0;
    for (let lag = Math.round(sr * want * 0.6); lag <= Math.round(sr * want * 1.5); lag++) {
      let s = 0;
      for (let i = 0; i < x.length; i += 2) s += x[i] * x[(i + lag) % x.length];
      if (s > best) {
        best = s;
        bestLag = lag;
      }
    }
    const period = bestLag / sr;
    assert.ok(Math.abs(period - want) / want < 0.04, `${id}: period ${(period * 1000).toFixed(2)} ms, want ${(want * 1000).toFixed(2)} ms`);
    // A whole number of engine cycles per loop.
    const cycles = SOUNDS[id].dur / (120 / spec.refRpm);
    assert.ok(Math.abs(cycles - Math.round(cycles)) < 1e-6, `${id}: ${cycles} cycles`);
  }
  // Jeep: 4-cylinder 4-stroke, 2000 rpm -> 66.7 Hz.
  assert.ok(Math.abs(ENGINE_SPECS.engineJeep.firingHz - 66.667) < 0.01);
});

test('dsp: reflections and saturation never leave a step in the waveform', () => {
  // A slowly decaying signal: any step would be far larger than the natural
  // sample-to-sample change.
  const sr = 48000;
  const x = new Float32Array(sr);
  for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.exp(-i / (0.3 * sr));
  reflect(x, sr, 0.004, 0.6, 5000, 0.1);
  saturate(x, 3);
  let maxStep = 0;
  for (let i = 2000; i < x.length; i++) maxStep = Math.max(maxStep, Math.abs(x[i] - x[i - 1]));
  assert.ok(maxStep < 1e-3, `step ${maxStep}`);
});

test('reverb impulse responses: unit energy, outdoor longer and sparser at first', () => {
  const out = makeReverbIR('outdoor', {}, SR);
  const ind = makeReverbIR('indoor', {}, SR);
  for (const ir of [out, ind]) {
    let e = 0;
    for (const v of ir) {
      assert.ok(Number.isFinite(v));
      e += v * v;
    }
    assert.ok(Math.abs(e - 1) < 1e-3, `energy ${e}`);
    assert.ok(rms(ir, ir.length - Math.round(0.2 * SR)) < 0.01 * rms(ir, 0, Math.round(0.2 * SR)), 'decays');
  }
  assert.ok(out.length > ind.length);
  // Indoors the first 20 ms are dense with reflections; outdoors nearly empty.
  const early = (ir) => rms(ir, 0, Math.round(0.02 * SR));
  assert.ok(early(ind) > 3 * early(out));
  // Stereo pair channels are decorrelated.
  const b = makeReverbIR('outdoor', { channel: 1 }, SR);
  let c = 0;
  for (let i = 0; i < out.length; i++) c += out[i] * b[i];
  assert.ok(Math.abs(c) < 0.3);
});

// ---------------------------------------------------------------------------
// AudioSystem against a minimal mock of the Web Audio API.

class MockParam {
  constructor(v) {
    this.value = v;
    this.events = [];
  }
  setValueAtTime(v, t) {
    this.events.push(['set', v, t]);
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v, t) {
    this.events.push(['ramp', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v, t, c) {
    this.events.push(['target', v, t, c]);
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class MockNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.outputs = [];
  }
  connect(n) {
    this.outputs.push(n);
    return n;
  }
  disconnect() {
    this.outputs = [];
  }
}

class MockBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  copyToChannel(src, ch) {
    this.data[ch].set(src);
  }
  getChannelData(ch) {
    return this.data[ch];
  }
}

class MockContext {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new MockNode(this);
    this.sources = [];
    const p = (v) => new MockParam(v);
    this.listener = {
      positionX: p(0),
      positionY: p(0),
      positionZ: p(0),
      forwardX: p(0),
      forwardY: p(0),
      forwardZ: p(-1),
      upX: p(0),
      upY: p(1),
      upZ: p(0),
    };
  }
  createGain() {
    const n = new MockNode(this);
    n.gain = new MockParam(1);
    return n;
  }
  createBiquadFilter() {
    const n = new MockNode(this);
    n.type = 'lowpass';
    n.frequency = new MockParam(350);
    n.Q = new MockParam(1);
    return n;
  }
  createPanner() {
    const n = new MockNode(this);
    for (const k of ['positionX', 'positionY', 'positionZ']) n[k] = new MockParam(0);
    return n;
  }
  createConvolver() {
    const n = new MockNode(this);
    n.normalize = true;
    n.buffer = null;
    return n;
  }
  createDynamicsCompressor() {
    const n = new MockNode(this);
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new MockParam(0);
    return n;
  }
  createBuffer(channels, length, sampleRate) {
    return new MockBuffer(channels, length, sampleRate);
  }
  createBufferSource() {
    const ctx = this;
    const n = new MockNode(this);
    n.buffer = null;
    n.loop = false;
    n.playbackRate = new MockParam(1);
    n.onended = null;
    n.start = (when = 0, offset = 0) => {
      n.when = when;
      n.offset = offset;
      ctx.sources.push(n);
    };
    n.stop = (when = 0) => {
      n.stoppedAt = when;
    };
    return n;
  }
}

function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function mockSystem(opts = {}) {
  const ctx = new MockContext();
  const sys = new AudioSystem({ random: seeded(), ...opts });
  await sys.init({
    context: ctx,
    ids: [
      'rifle',
      'rifleFar',
      'mg',
      'mgFar',
      'echoMedium',
      'stepGrass',
      'wind',
      'crack',
      'whiz',
      'impactWood',
      'impactStone',
      'garandPing',
      'grenadeExplosion',
      'explosionFar',
      'debrisRain',
    ],
  });
  sys.setListener(0, 0, 0, 0, 0, -1, 0, 1, 0);
  return { ctx, sys };
}

const idOf = (sys, src) => Object.keys(sys.buffers).find((id) => sys.buffers[id].includes(src.buffer));

test('helpers: air absorption, distance gain, speed of sound, near/far crossfade', () => {
  assert.equal(airAbsorptionCutoff(5), 20000);
  assert.ok(Math.abs(airAbsorptionCutoff(10) - 20000) < 1);
  const c100 = airAbsorptionCutoff(100),
    c400 = airAbsorptionCutoff(400),
    c800 = airAbsorptionCutoff(800);
  assert.ok(c100 > 5000 && c100 < 8000, `100 m: ${c100}`);
  assert.ok(c400 > 3000 && c400 < 4500 && c800 >= 2000 && c800 <= 3000, `400 m ${c400}, 800 m ${c800}`);
  assert.ok(Math.abs(propagationDelay(343) - 1) < 1e-12 && Math.abs(propagationDelay(800) - 800 / 343) < 1e-12);
  assert.equal(distanceGain(5, 'gun'), 1);
  let prev = 1;
  for (const d of [20, 50, 100, 200, 400, 800, 1600]) {
    const g = distanceGain(d, 'gun');
    assert.ok(g < prev && g > 0, `gun gain at ${d}`);
    prev = g;
  }
  assert.equal(distanceGain(3000, 'gun'), 0);
  assert.ok(Math.abs(distanceGain(3, 'step') / distanceGain(6, 'step') - 2 ** 0.9) < 1e-9, 'inverse-distance law');
  const a = gunshotLayers(50),
    b = gunshotLayers(200),
    c = gunshotLayers(500);
  assert.ok(a.near === 1 && a.far === 0 && c.near < 1e-9 && c.far === 1);
  assert.ok(Math.abs(b.near ** 2 + b.far ** 2 - 1) < 1e-9 && b.near > 0.3 && b.far > 0.3, 'equal-power crossfade');
  assert.equal(crackVariant(0.3), 0);
  assert.equal(crackVariant(100), CRACK_MISS.length - 1);
  assert.equal(SPEED_OF_SOUND, 343);
});

test('AudioSystem: sounds start after distance / 343 m/s; 2D sounds at once', async () => {
  const { ctx, sys } = await mockSystem();
  assert.ok(sys.ready && sys.progress === 1);
  ctx.currentTime = 10;
  sys.play('stepGrass', null);
  assert.equal(ctx.sources.at(-1).when, 10);
  sys.play('impactWood', { x: 0, y: 0, z: -34.3 }, { delay: 0.5 });
  assert.ok(Math.abs(ctx.sources.at(-1).when - 10.6) < 1e-9);
  const h = sys.gunshot('rifle', 0, 0, -686);
  assert.ok(h.playing);
  const far = ctx.sources.at(-1);
  assert.equal(idOf(sys, far), 'rifleFar', 'a shot at 686 m uses the far report only');
  assert.ok(Math.abs(far.when - 12) < 1e-9, `starts at ${far.when}`);
});

test('AudioSystem: gunshot picks near/far layers by distance and adds an echo tail', async () => {
  const { ctx, sys } = await mockSystem();
  const count = () => ctx.sources.length;
  let n = count();
  sys.gunshot('rifle', 0, 0, -40);
  let ids = ctx.sources.slice(n).map((s) => idOf(sys, s));
  assert.deepEqual(ids.sort(), ['echoMedium', 'rifle']);
  n = count();
  sys.gunshot('rifle', 0, 0, -200);
  ids = ctx.sources.slice(n).map((s) => idOf(sys, s));
  assert.ok(ids.includes('rifle') && ids.includes('rifleFar'), `crossfade zone: ${ids}`);
  n = count();
  sys.gunshot('rifle', 0, 0, 0, { isLocal: true });
  const local = ctx.sources.slice(n);
  assert.ok(local.every((s) => s.when < 0.5) && local[0].when === 0, 'own shot is immediate');
  // Air absorption filter of a far shot.
  n = count();
  sys.gunshot('rifle', 400, 0, 0);
  const v = sys.voices.find((x) => x.src === ctx.sources[n]);
  assert.ok(v.filter.frequency.value < 4500 && v.filter.frequency.value > 3000, `cutoff ${v.filter.frequency.value}`);
  // Automatic fire from one shooter keeps one far tail: the previous fades out.
  n = count();
  for (let i = 0; i < 5; i++) {
    ctx.currentTime += 0.05;
    sys.gunshot('mg', 0, 0, -500, { source: 'mg42' });
  }
  const tails = sys.voices.filter((x) => x.id === 'mgFar');
  assert.equal(tails.length, 5);
  assert.equal(tails.filter((x) => x.src.stoppedAt === undefined).length, 1, 'old far tails are cut');
});

test('AudioSystem: crack vs whiz, culling, voice cap, loops', async () => {
  const { ctx, sys } = await mockSystem({ maxVoices: 8 });
  sys.crack(1, 0, 0, 0.5, 800);
  assert.equal(idOf(sys, ctx.sources.at(-1)), 'crack');
  assert.equal(sys.buffers.crack.indexOf(ctx.sources.at(-1).buffer), crackVariant(0.5));
  sys.crack(1, 0, 0, 2, 280);
  assert.equal(idOf(sys, ctx.sources.at(-1)), 'whiz');
  // Footsteps 500 m away are not played at all.
  const n0 = ctx.sources.length;
  const h = sys.footstep('grass', 500, 0, 0);
  assert.equal(h.playing, false);
  assert.equal(ctx.sources.length, n0);
  // Voice cap: loud nearby shots take priority over quiet faraway footsteps.
  for (let i = 0; i < 20; i++) sys.footstep('grass', 20 + i, 0, 0);
  assert.ok(sys.voices.length <= 8);
  for (let i = 0; i < 8; i++) sys.play('rifle', { x: 5, y: 0, z: i });
  assert.ok(sys.voices.length <= 8);
  assert.ok(sys.voices.filter((v) => v.id === 'rifle').length >= 6, 'loud sounds replaced the quiet ones');
  const quiet = sys.footstep('grass', 60, 0, 0);
  assert.equal(quiet.playing, false, 'a quieter sound than all playing voices is dropped');
  // Loops: set() and stop().
  const { sys: s2, ctx: c2 } = await mockSystem();
  const loop = s2.loop('wind', { volume: 0.5, category: 'ambience' });
  const src = c2.sources.at(-1);
  assert.ok(src.loop && loop.playing);
  loop.set({ volume: 0.2, rate: 1.1, lowpass: 2000 });
  assert.ok(Math.abs(src.playbackRate.value - 1.1) < 1e-9);
  const v = s2.voices.find((x) => x.src === src);
  assert.ok(v.filter.frequency.value <= 2000);
  loop.stop(0.2);
  assert.ok(src.stoppedAt > 0);
  // Positional loop follows set({x, y, z}) with distance attenuation.
  const car = s2.loop('wind', { x: 10, y: 0, z: 0 });
  const cv = s2.voices.at(-1);
  const g0 = cv.gain.gain.value;
  car.set({ x: 200 });
  assert.ok(cv.gain.gain.value < g0, 'farther is quieter');
  // Indoors: reverb returns cross-fade.
  s2.setIndoor(1);
  assert.equal(s2.reverb.outdoor.ret.gain.value, 0);
  assert.ok(s2.reverb.indoor.ret.gain.value > 0);
});

test('AudioSystem: impacts by material, footsteps by surface, explosions with debris', async () => {
  const { ctx, sys } = await mockSystem();
  let n = ctx.sources.length;
  sys.impact('concrete', 0, 0, -10, 3500);
  assert.equal(idOf(sys, ctx.sources.at(-1)), 'impactStone');
  sys.impact('plank', 0, 0, -10, 500);
  assert.equal(idOf(sys, ctx.sources.at(-1)), 'impactWood');
  n = ctx.sources.length;
  sys.explosion('grenade', 0, 0, -30);
  const ids = ctx.sources.slice(n).map((s) => idOf(sys, s));
  assert.ok(ids.includes('grenadeExplosion') && ids.includes('debrisRain'), ids.join());
  n = ctx.sources.length;
  sys.explosion('grenade', 0, 0, -900);
  assert.deepEqual(
    ctx.sources.slice(n).map((s) => idOf(sys, s)),
    ['explosionFar'],
  );
  sys.footstep('grass', null, null, null, { loud: true });
  assert.equal(idOf(sys, ctx.sources.at(-1)), 'stepGrass');
});
