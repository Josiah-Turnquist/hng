// AudioSystem: Web Audio playback of the synthesized sounds (synth.js).
//
// Signal graph per voice (kept cheap: 3-5 nodes):
//   BufferSource -> Gain (volume x distance) -> [Lowpass (air, occlusion)] -> [Panner (HRTF)] -> category bus
//                                                       \-> [send Gain] -> reverb buses (outdoor / indoor convolvers)
// Buses: effects, ambience, ui -> master -> bus compressor -> limiter -> destination.
//
// Positional sounds get inverse-distance attenuation (per distance class), air
// absorption (low-pass falling from ~20 kHz at 10 m to ~2.5 kHz at 800 m),
// HRTF panning and the speed of sound: a sound starts distance / 343 m/s after
// it is triggered, so distant shots are heard after their muzzle flash is seen.
//
// Usage:
//   const audio = new AudioSystem();
//   await audio.init({ onProgress: (p) => ... });  // on a user gesture
//   audio.setListener(x, y, z, fx, fy, fz, ux, uy, uz);  // every frame
//   audio.gunshot('rifle', x, y, z);  audio.play('boltCycle', null);
import { CRACK_MISS, ECHO_OF, ENGINE_SPECS, GUN_TYPES, SOUNDS, SOUND_IDS, generateSound, makeReverbIR } from './synth.js';

export const SPEED_OF_SOUND = 343; // m/s, dry air at 20 C

// Distance classes. ref: distance (m) within which the level is constant; roll:
// fall-off exponent of (ref / d) (1 = inverse distance law, -6 dB per doubling;
// below 1 keeps loud sounds audible far away, as a game mix needs); max: the
// sound fades out over the last 20% before max and is not played beyond.
export const DISTANCE_CLASSES = {
  gun: { ref: 10, roll: 0.65, max: 2500, weight: 1 },
  heavy: { ref: 20, roll: 0.65, max: 5000, weight: 1.3 },
  crack: { ref: 1, roll: 0.75, max: 80, weight: 0.9 },
  impact: { ref: 2, roll: 1, max: 250, weight: 0.6 },
  mech: { ref: 1, roll: 1, max: 40, weight: 0.3 },
  step: { ref: 1.5, roll: 0.9, max: 70, weight: 0.35 },
  voice: { ref: 1.5, roll: 1, max: 60, weight: 0.4 },
  vehicle: { ref: 6, roll: 0.9, max: 900, weight: 0.8 },
  ambience: { ref: 6, roll: 1, max: 400, weight: 0.6 },
  ui: { ref: 1, roll: 1, max: 50, weight: 3 },
  medium: { ref: 2, roll: 1, max: 200, weight: 0.5 },
};

const GROUP_DEFAULTS = {
  gunshots: { category: 'effects', reverb: 0.3 },
  gunshotsFar: { category: 'effects', reverb: 0.15 },
  bullets: { category: 'effects', reverb: 0.12 },
  impacts: { category: 'effects', reverb: 0.2 },
  mechanical: { category: 'effects', reverb: 0.05 },
  footsteps: { category: 'effects', reverb: 0.08 },
  people: { category: 'effects', reverb: 0.05 },
  explosions: { category: 'effects', reverb: 0.3 },
  vehicles: { category: 'effects', reverb: 0.12 },
  ambience: { category: 'ambience', reverb: 0 },
  ui: { category: 'ui', reverb: 0 },
};

// Bullet impact material (ballistics/materials.js names) -> [sound id, rate, volume].
export const IMPACT_SOUNDS = {
  soil: ['impactDirt', 1, 1],
  mud: ['impactMud', 1, 1],
  sand: ['impactSand', 1, 1],
  sandbag: ['impactSand', 0.85, 0.9],
  wood: ['impactWood', 1, 1],
  plank: ['impactWood', 1.15, 0.9],
  brick: ['impactStone', 0.9, 1],
  plaster: ['impactStone', 1.1, 0.8],
  stone: ['impactStone', 1, 1],
  concrete: ['impactStone', 0.95, 1],
  roofTile: ['impactStone', 1.2, 0.9],
  rock: ['impactStone', 0.9, 1],
  steel: ['impactMetal', 1, 1],
  armor: ['impactArmor', 1, 1],
  glass: ['impactGlass', 1, 1],
  water: ['impactWater', 1, 1],
  flesh: ['impactFlesh', 1, 1],
  foliage: ['impactFoliage', 1, 0.8],
};

export const SURFACE_SOUNDS = {
  grass: 'stepGrass',
  dirt: 'stepDirt',
  gravel: 'stepGravel',
  stone: 'stepStone',
  wood: 'stepWood',
  mud: 'stepMud',
  water: 'stepWater',
  leaves: 'stepLeaves',
  sand: 'stepSand',
};

export const EXPLOSION_SOUNDS = {
  grenade: { near: 'grenadeExplosion', far: 'explosionFar', farGain: 0.6, debris: 0.6, fade: [120, 400] },
  shell: { near: 'shellExplosion', far: 'explosionFar', farGain: 1, debris: 1, fade: [200, 600] },
  mortar: { near: 'shellExplosion', far: 'explosionFar', farGain: 0.8, debris: 0.8, fade: [150, 500] },
  rocket: { near: 'grenadeExplosion', far: 'explosionFar', farGain: 0.7, debris: 0.5, fade: [120, 400] },
  tank: { near: 'tankExplosion', far: 'explosionFar', farGain: 1.2, debris: 0, fade: [250, 700] },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (u) => u * u * (3 - 2 * u);

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests and for game code that wants the numbers).

export function distanceGain(d, cls = 'medium') {
  const c = DISTANCE_CLASSES[cls] || DISTANCE_CLASSES.medium;
  if (d >= c.max) return 0;
  let g = d <= c.ref ? 1 : Math.pow(c.ref / d, c.roll);
  const f0 = c.max * 0.8;
  if (d > f0) g *= 1 - (d - f0) / (c.max - f0);
  return g;
}

// Air absorption as a low-pass cutoff: ~20 kHz at 10 m, ~6.7 kHz at 100 m,
// ~3.5 kHz at 400 m, ~2.5 kHz at 800 m (log-log fit of ISO 9613-1 attenuation).
export function airAbsorptionCutoff(d) {
  if (d <= 10) return 20000;
  return Math.max(900, 20000 * Math.pow(d / 10, -0.475));
}

export function propagationDelay(d) {
  return Math.max(0, d) / SPEED_OF_SOUND;
}

// Near/far report weights for a gunshot at distance d: equal-power crossfade
// over [from, to] meters (default 100-300 m).
export function gunshotLayers(d, from = 100, to = 300) {
  const s = smooth(clamp((d - from) / (to - from), 0, 1));
  return { near: Math.cos((s * Math.PI) / 2), far: Math.sin((s * Math.PI) / 2) };
}

// Occlusion (0..1) -> [cutoff multiplier toward ~350 Hz, gain].
export function occlusionEffect(occ, cutoff) {
  const o = clamp(occ, 0, 1);
  const fc = Math.exp(Math.log(cutoff) * (1 - o) + Math.log(350) * o);
  return { cutoff: fc, gain: 1 - 0.55 * o };
}

// Crack variant (index into CRACK_MISS) closest to a miss distance (log scale).
export function crackVariant(miss) {
  let best = 0,
    bestD = Infinity;
  for (let i = 0; i < CRACK_MISS.length; i++) {
    const dd = Math.abs(Math.log(Math.max(0.1, miss) / CRACK_MISS[i]));
    if (dd < bestD) {
      bestD = dd;
      best = i;
    }
  }
  return best;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

const nowMs = () => (globalThis.performance ? performance.now() : Date.now());

function yieldToEventLoop() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        // Close both ends: open ports would keep Node (tests) alive.
        ch.port1.close();
        ch.port2.close();
        resolve();
      };
      ch.port2.postMessage(0);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setParam(param, value, t, tc) {
  if (!param) return;
  if (tc > 0) param.setTargetAtTime(value, t, tc);
  else {
    param.cancelScheduledValues(t);
    param.setValueAtTime(value, t);
  }
}

function setPannerPosition(p, x, y, z, t, tc = 0) {
  if (p.positionX) {
    setParam(p.positionX, x, t, tc);
    setParam(p.positionY, y, t, tc);
    setParam(p.positionZ, z, t, tc);
  } else p.setPosition(x, y, z);
}

// Handle returned for a sound that was not played (culled, dropped, not ready),
// so game code never needs null checks.
const DUMMY = Object.freeze({
  id: null,
  playing: false,
  stop() {},
  set() {},
});

class VoiceHandle {
  constructor(sys, v) {
    this.sys = sys;
    this.v = v;
    this.id = v.id;
  }
  get playing() {
    return !this.v.done;
  }
  // When the sound actually starts (context time, after any propagation delay).
  get startTime() {
    return this.v.start;
  }
  // Fade out over fadeTime seconds and stop.
  stop(fadeTime = 0.05) {
    this.sys._stopVoice(this.v, fadeTime);
  }
  // Change volume, playback rate, position, low-pass cutoff or occlusion.
  set(p = {}) {
    this.sys._setVoice(this.v, p);
  }
}

export class AudioSystem {
  constructor(opts = {}) {
    this.maxVoices = opts.maxVoices ?? 48;
    this.hrtf = opts.hrtf ?? true;
    // HRTF (front/back and elevation cues) for sources within this distance;
    // cheaper equal-power panning beyond, where sound is diffuse anyway.
    this.hrtfMaxDistance = opts.hrtfMaxDistance ?? 150;
    this.ctx = null;
    this.ready = false;
    this.progress = 0;
    this.buffers = {};
    this.voices = [];
    this.indoor = 0;
    this.volumes = { master: opts.masterVolume ?? 0.8, effects: 1, ambience: 1, ui: 1 };
    this.listener = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, ux: 0, uy: 1, uz: 0 };
    this.stats = { generationMs: 0, buffers: 0, seconds: 0, workers: 0, dropped: 0, culled: 0 };
    this.random = opts.random || Math.random;
    this._lastVariant = {};
    this._tails = new Map();
    this._echoDelays = new Map();
    this._init = null;
  }

  // Creates the AudioContext (or uses opts.context, e.g. an OfflineAudioContext),
  // the buses and reverbs, and synthesizes every buffer. Synthesis runs in a
  // pool of Web Workers when available (opts.workers, default: cores - 1, max
  // 4; 0 = main thread), otherwise on the main thread in batches that yield to
  // the event loop. opts: { context, onProgress(p), ids, workers, batchMs }.
  init(opts = {}) {
    if (!this._init) {
      this._init = this._doInit(opts).catch((e) => {
        this._init = null; // allow a retry (e.g. on the next user gesture)
        throw e;
      });
    }
    return this._init;
  }

  async _doInit({ context, onProgress, ids, workers, batchMs = 12 } = {}) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!context && !AC) throw new Error('Web Audio is not available');
    const ctx = context || new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this._buildGraph();
    const offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    if (ctx.state === 'suspended' && typeof window !== 'undefined' && !offline) {
      const resume = () => {
        ctx.resume();
        window.removeEventListener('pointerdown', resume, true);
        window.removeEventListener('keydown', resume, true);
      };
      window.addEventListener('pointerdown', resume, true);
      window.addEventListener('keydown', resume, true);
    }
    const wanted = ids ? [...new Set(ids)] : SOUND_IDS;
    const gen = [...new Set(wanted.map((id) => SOUNDS[id]?.alias || id))].filter((id) => SOUNDS[id]);
    const jobs = [];
    const lists = {};
    for (const id of gen) {
      const d = SOUNDS[id];
      const sampleRate = Math.round(ctx.sampleRate * d.rate);
      lists[id] = new Array(d.variants);
      for (let v = 0; v < d.variants; v++) jobs.push({ id, variant: v, sampleRate, cost: d.dur * sampleRate });
    }
    const total = jobs.reduce((sum, j) => sum + j.cost, 0) || 1;
    let done = 0;
    const store = (job, data) => {
      const buf = ctx.createBuffer(1, data.length, job.sampleRate);
      buf.copyToChannel(data, 0);
      lists[job.id][job.variant] = buf;
      done += job.cost;
      this.stats.buffers++;
      this.stats.seconds += data.length / job.sampleRate;
    };
    const report = () => {
      this.progress = Math.min(0.999, done / total);
      onProgress?.(this.progress);
    };
    const t0 = nowMs();
    const nWorkers = workers ?? Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency || 2) - 1));
    let remaining = jobs;
    // Workers pay off for real workloads (each one loads and warms up the code).
    if (nWorkers > 0 && total > 2e6) remaining = await this._generateInWorkers(jobs, nWorkers, store, report);
    this.stats.workers = remaining.length < jobs.length ? nWorkers : 0;
    let tBatch = nowMs();
    for (const job of remaining) {
      store(job, generateSound(job.id, job.variant, job.sampleRate));
      if (nowMs() - tBatch > batchMs) {
        report();
        await yieldToEventLoop();
        tBatch = nowMs();
      }
    }
    for (const id of gen) this.buffers[id] = lists[id];
    for (const id of wanted) if (SOUNDS[id]?.alias) this.buffers[id] = this.buffers[SOUNDS[id].alias];
    this.stats.generationMs = nowMs() - t0;
    this.ready = true;
    this.progress = 1;
    onProgress?.(1);
    return this;
  }

  // Runs synthesis jobs on a pool of module workers (largest first). Resolves
  // with the jobs left undone: all of them if workers are unavailable, or what
  // remained when one failed, so the caller finishes them on the main thread.
  _generateInWorkers(jobs, n, store, report) {
    if (typeof Worker === 'undefined') return Promise.resolve(jobs);
    const queue = [...jobs].sort((a, b) => b.cost - a.cost);
    const pending = new Set(queue);
    return new Promise((resolve) => {
      const pool = [];
      let finished = false;
      let watchdog = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        for (const w of pool) w.terminate();
        resolve([...pending]);
      };
      // If the workers go quiet (failed module load, stalled tab), give up on
      // them and let the main thread finish the rest.
      const arm = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(finish, 8000);
      };
      const next = (w) => {
        const job = queue.shift();
        w.job = job || null;
        if (job) w.postMessage({ id: job.id, variant: job.variant, sampleRate: job.sampleRate });
        else if (pool.every((x) => !x.job)) finish();
      };
      try {
        for (let i = 0; i < n; i++) {
          const w = new Worker(new URL('./synthWorker.js', import.meta.url), { type: 'module' });
          w.onmessage = (e) => {
            const job = w.job;
            if (!job || e.data.error) return finish();
            store(job, e.data.data);
            pending.delete(job);
            report();
            arm();
            next(w);
          };
          w.onerror = () => finish();
          pool.push(w);
        }
      } catch {
        finish();
        return;
      }
      arm();
      for (const w of pool) next(w);
    });
  }

  _buildGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    // Bus compression glues the mix (and ducks the world under a nearby blast,
    // a little like the ear does); the limiter catches the peaks.
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.25;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;
    this.master.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    this.bus = {};
    for (const name of ['effects', 'ambience', 'ui']) {
      const g = ctx.createGain();
      g.gain.value = this.volumes[name];
      g.connect(this.master);
      this.bus[name] = g;
    }
    // Reverb: one send bus feeding an outdoor and an indoor convolver; setIndoor
    // blends their returns.
    this.reverbSend = ctx.createGain();
    this.reverb = {};
    for (const kind of ['outdoor', 'indoor']) {
      const conv = ctx.createConvolver();
      conv.normalize = false;
      const a = makeReverbIR(kind, { channel: 0 }, ctx.sampleRate);
      const b = makeReverbIR(kind, { channel: 1 }, ctx.sampleRate);
      const ir = ctx.createBuffer(2, a.length, ctx.sampleRate);
      ir.copyToChannel(a, 0);
      ir.copyToChannel(b, 1);
      conv.buffer = ir;
      const ret = ctx.createGain();
      this.reverbSend.connect(conv);
      conv.connect(ret);
      ret.connect(this.bus.effects);
      this.reverb[kind] = { conv, ret };
    }
    this.reverbLevels = { outdoor: 0.55, indoor: 0.9 };
    this._applyIndoor(0);
    this._applyListener(0);
  }

  get context() {
    return this.ctx;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Resume after a user gesture (also done automatically on the first click/key).
  resume() {
    return this.ctx?.state === 'suspended' ? this.ctx.resume() : Promise.resolve();
  }

  // Volume of 'master', 'effects', 'ambience' or 'ui' (0..1+).
  setVolume(category, v) {
    this.volumes[category] = v;
    if (!this.ctx) return;
    const node = category === 'master' ? this.master : this.bus[category];
    if (node) setParam(node.gain, v, this.ctx.currentTime, 0.02);
  }

  // Listener position and orientation (forward and up vectors), every frame.
  setListener(x, y, z, fx = 0, fy = 0, fz = -1, ux = 0, uy = 1, uz = 0) {
    const L = this.listener;
    L.x = x;
    L.y = y;
    L.z = z;
    L.fx = fx;
    L.fy = fy;
    L.fz = fz;
    L.ux = ux;
    L.uy = uy;
    L.uz = uz;
    if (!this.ctx) return;
    this._applyListener(0.02);
    this._updateVoices();
  }

  _applyListener(tc) {
    const l = this.ctx.listener;
    const L = this.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      setParam(l.positionX, L.x, t, tc);
      setParam(l.positionY, L.y, t, tc);
      setParam(l.positionZ, L.z, t, tc);
      setParam(l.forwardX, L.fx, t, tc);
      setParam(l.forwardY, L.fy, t, tc);
      setParam(l.forwardZ, L.fz, t, tc);
      setParam(l.upX, L.ux, t, tc);
      setParam(l.upY, L.uy, t, tc);
      setParam(l.upZ, L.uz, t, tc);
    } else {
      l.setPosition(L.x, L.y, L.z);
      l.setOrientation(L.fx, L.fy, L.fz, L.ux, L.uy, L.uz);
    }
  }

  // 0 = outdoors, 1 = inside a building/bunker/vehicle: blends the reverbs.
  setIndoor(amount) {
    this.indoor = clamp(amount, 0, 1);
    if (!this.ctx) return;
    this._applyIndoor(0.15);
    for (const v of this.voices) if (v.loop) this._refresh(v, 0.15);
  }

  _applyIndoor(tc) {
    const t = this.ctx.currentTime;
    setParam(this.reverb.outdoor.ret.gain, (1 - this.indoor) * this.reverbLevels.outdoor, t, tc);
    setParam(this.reverb.indoor.ret.gain, this.indoor * this.reverbLevels.indoor, t, tc);
  }

  _distanceTo(p) {
    const L = this.listener;
    const dx = p.x - L.x,
      dy = p.y - L.y,
      dz = p.z - L.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  _pickVariant(id, n, variation) {
    if (n <= 1 || !variation) return 0;
    const last = this._lastVariant[id] ?? -1;
    let v = Math.floor(this.random() * n);
    if (v === last) v = (v + 1 + Math.floor(this.random() * (n - 1))) % n;
    this._lastVariant[id] = v;
    return v;
  }

  // Play a sound. pos: {x, y, z} for a positional sound or null for 2D.
  // opts: volume=1, rate=1, delay=0 (s, on top of the propagation delay),
  // variation=true (random take, pitch and volume), category ('effects' |
  // 'ambience' | 'ui'), occlusion=0 (0..1 muffles), reverb (send 0..1),
  // variant (force a take), lowpass (Hz), loop=false, cls (distance class),
  // speedOfSound=true, attenuation=true, offset (s into the buffer), fadeIn (s).
  // Returns a handle { id, playing, stop(fade), set({volume, rate, x, y, z, lowpass, occlusion}) }.
  play(id, pos = null, opts = {}) {
    if (!this.ready) return DUMMY;
    const bufs = this.buffers[id];
    const def = SOUNDS[id];
    if (!bufs || !def) {
      if (!this._warned?.[id]) {
        (this._warned ||= {})[id] = true;
        console.warn(`AudioSystem: unknown or not generated sound "${id}"`);
      }
      return DUMMY;
    }
    const ctx = this.ctx;
    const g = GROUP_DEFAULTS[def.group] || GROUP_DEFAULTS.gunshots;
    const variation = opts.variation ?? true;
    const category = opts.category ?? g.category;
    const cls = opts.cls ?? def.cls;
    const loop = !!opts.loop;
    let volume = opts.volume ?? 1;
    let rate = opts.rate ?? 1;
    if (variation && !loop) {
      rate *= 1 + def.pitchVar * (2 * this.random() - 1);
      volume *= 1 + def.volVar * (2 * this.random() - 1);
    }
    const vi = opts.variant != null ? clamp(opts.variant | 0, 0, bufs.length - 1) : this._pickVariant(id, bufs.length, variation);
    const buffer = bufs[vi];
    const v = {
      id,
      def,
      cls,
      category,
      pos: pos ? { x: pos.x, y: pos.y, z: pos.z } : null,
      volume,
      rate,
      occlusion: opts.occlusion ?? 0,
      lowpass: opts.lowpass ?? 22000,
      attenuation: opts.attenuation ?? true,
      reverb: category === 'ui' ? 0 : (opts.reverb ?? g.reverb),
      loop,
      done: false,
    };
    const sp = this._spatial(v);
    if (sp.gain <= 0) {
      this.stats.culled++;
      return DUMMY;
    }
    v.audibility = volume * sp.gain * (DISTANCE_CLASSES[cls]?.weight ?? 0.5) * (loop ? 2 : 1);
    if (!this._makeRoom(v.audibility)) {
      this.stats.dropped++;
      return DUMMY;
    }
    const t = ctx.currentTime;
    const delay = Math.max(0, opts.delay ?? 0) + (v.pos && opts.speedOfSound !== false ? propagationDelay(sp.d) : 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.loop = loop;
    const gain = ctx.createGain();
    const level = volume * sp.gain;
    const fadeIn = opts.fadeIn ?? (loop ? 0.05 : 0);
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(level, t + delay + fadeIn);
    } else gain.gain.value = level;
    src.connect(gain);
    let tail = gain;
    // A filter is needed for positional sounds (air absorption), occlusion,
    // explicit low-pass, and loops (which can change later via set()).
    if (v.pos || loop || sp.cutoff < 20000) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = Math.SQRT1_2;
      f.frequency.value = Math.min(sp.cutoff, ctx.sampleRate * 0.45);
      gain.connect(f);
      tail = f;
      v.filter = f;
    }
    let out = tail;
    if (v.pos) {
      const p = ctx.createPanner();
      p.panningModel = this.hrtf && sp.d < this.hrtfMaxDistance ? 'HRTF' : 'equalpower';
      p.distanceModel = 'linear';
      p.rolloffFactor = 0; // attenuation is done in the gain node (with air absorption and reverb send)
      p.refDistance = 1;
      p.maxDistance = 100000;
      setPannerPosition(p, v.pos.x, v.pos.y, v.pos.z, t);
      tail.connect(p);
      out = p;
      v.panner = p;
    }
    out.connect(this.bus[category] || this.bus.effects);
    if (v.reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = v.reverb * sp.send;
      tail.connect(s);
      s.connect(this.reverbSend);
      v.send = s;
    }
    const offset = opts.offset ?? (loop ? this.random() * buffer.duration : 0);
    src.start(t + delay, offset % buffer.duration);
    v.src = src;
    v.gain = gain;
    v.level = level;
    v.start = t + delay;
    v.end = loop ? Infinity : t + delay + (buffer.duration - (offset % buffer.duration)) / rate;
    src.onended = () => this._release(v);
    this.voices.push(v);
    return new VoiceHandle(this, v);
  }

  // Start a loop (engine, ambience, breathing...). opts as play() plus x, y, z
  // for a positional loop. Returns a handle: set({ volume, rate, x, y, z,
  // lowpass, occlusion }) and stop(fadeTime).
  loop(id, opts = {}) {
    const pos = opts.x != null ? { x: opts.x, y: opts.y ?? 0, z: opts.z ?? 0 } : null;
    return this.play(id, pos, { variation: false, speedOfSound: false, ...opts, loop: true });
  }

  // Engine loop driven by rpm: handle.setRpm(rpm, throttle 0..1) maps to
  // playback rate (rpm / refRpm), loudness and brightness. opts as loop().
  engine(id, opts = {}) {
    const spec = ENGINE_SPECS[id];
    if (!spec) throw new Error(`Not an engine sound: ${id}`);
    const base = opts.volume ?? 1;
    const h = this.loop(id, { ...opts, volume: base * 0.6, lowpass: 2500 });
    if (h === DUMMY) return { ...DUMMY, setRpm() {} };
    h.setRpm = (rpm, throttle = 0.5) => {
      const th = clamp(throttle, 0, 1);
      const r = clamp(rpm / spec.refRpm, 0.25, 2.5);
      h.set({ rate: r, volume: base * (0.45 + 0.4 * th) * (0.7 + 0.3 * Math.min(1, r)), lowpass: 1200 + 5000 * th * Math.min(1.5, r) });
    };
    return h;
  }

  // Effective level, low-pass and reverb send for a voice at the current listener.
  _spatial(v) {
    let gain = 1,
      cutoff = Math.min(22000, v.lowpass),
      d = 0,
      send = 1;
    if (v.pos) {
      d = this._distanceTo(v.pos);
      if (v.attenuation) gain = distanceGain(d, v.cls);
      cutoff = Math.min(cutoff, airAbsorptionCutoff(d));
      // Farther away, the reverberant field is relatively stronger.
      send = clamp(Math.sqrt(d / 15), 1, 3);
    }
    // Indoors the reverberant field is about as strong as the direct sound.
    send *= 1 + this.indoor;
    if (v.occlusion > 0) {
      const o = occlusionEffect(v.occlusion, cutoff);
      cutoff = o.cutoff;
      gain *= o.gain;
    }
    return { gain, cutoff, d, send };
  }

  _setVoice(v, p) {
    if (v.done) return;
    const t = this.ctx.currentTime;
    if (p.volume != null) v.volume = p.volume;
    if (p.lowpass != null) v.lowpass = p.lowpass;
    if (p.occlusion != null) v.occlusion = p.occlusion;
    if (p.rate != null) {
      v.rate = p.rate;
      setParam(v.src.playbackRate, p.rate, t, 0.03);
    }
    if (p.x != null || p.y != null || p.z != null) {
      if (!v.pos) v.pos = { x: 0, y: 0, z: 0 };
      if (p.x != null) v.pos.x = p.x;
      if (p.y != null) v.pos.y = p.y;
      if (p.z != null) v.pos.z = p.z;
      if (v.panner) setPannerPosition(v.panner, v.pos.x, v.pos.y, v.pos.z, t, 0.02);
    }
    this._refresh(v, 0.03);
  }

  _refresh(v, tc) {
    if (v.done || v.stopping) return;
    const sp = this._spatial(v);
    const t = this.ctx.currentTime;
    v.level = v.volume * sp.gain;
    // Gains of sounds still waiting for their propagation delay are set at their start.
    setParam(v.gain.gain, v.level, Math.max(t, v.start), tc);
    if (v.filter) setParam(v.filter.frequency, Math.min(sp.cutoff, this.ctx.sampleRate * 0.45), t, tc);
    if (v.send) setParam(v.send.gain, v.reverb * sp.send, t, tc);
    v.audibility = v.volume * sp.gain * (DISTANCE_CLASSES[v.cls]?.weight ?? 0.5) * (v.loop ? 2 : 1);
  }

  // Keep long and looping positional voices in step with the moving listener.
  _updateVoices() {
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      if (!v.pos || v.done || v.stopping) continue;
      if (v.loop || v.end - t > 0.4) this._refresh(v, 0.05);
    }
  }

  // Voice cap: if full, drop the least audible voice (age lowers audibility) or
  // refuse the new one if it would be the quietest.
  _makeRoom(aud) {
    const t = this.ctx.currentTime;
    if (this.voices.length < this.maxVoices) return true;
    let victim = null,
      worst = Infinity;
    for (const v of this.voices) {
      if (v.stopping) continue;
      const age = v.loop ? 0 : clamp((t - v.start) / Math.max(0.05, v.end - v.start), 0, 1);
      const score = v.audibility * (1 - 0.8 * age);
      if (score < worst) {
        worst = score;
        victim = v;
      }
    }
    if (!victim || aud < worst) return false;
    this._stopVoice(victim, 0.02);
    this._release(victim);
    return true;
  }

  _stopVoice(v, fade = 0.05) {
    if (v.done || v.stopping) return;
    const t = this.ctx.currentTime;
    v.stopping = true;
    const g = v.gain.gain;
    g.cancelScheduledValues(t);
    if (v.start > t) {
      // Not started yet (still travelling at the speed of sound): just cancel.
      g.setValueAtTime(0, t);
      try {
        v.src.stop(t);
      } catch {
        /* already stopped */
      }
      return;
    }
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + Math.max(0.005, fade));
    try {
      v.src.stop(t + Math.max(0.005, fade) + 0.01);
    } catch {
      /* already stopped */
    }
  }

  _release(v) {
    if (v.done) return;
    v.done = true;
    const i = this.voices.indexOf(v);
    if (i >= 0) {
      this.voices[i] = this.voices[this.voices.length - 1];
      this.voices.pop();
    }
    v.src.onended = null;
    // Disconnect a little later so a fade in progress is not cut.
    const nodes = [v.src, v.gain, v.filter, v.panner, v.send];
    const disconnect = () => nodes.forEach((n) => n && n.disconnect());
    if (v.stopping && typeof setTimeout !== 'undefined') setTimeout(disconnect, 100);
    else disconnect();
  }

  // Fade out a previous echo/tail voice of the same source when a new one starts
  // (keeps automatic fire from stacking dozens of long tails).
  _replaceTail(key, handle) {
    if (!(handle instanceof VoiceHandle)) return;
    const prev = this._tails.get(key);
    if (prev && !prev.v.done && !prev.v.stopping) {
      const t = this.ctx.currentTime;
      const at = Math.max(t, handle.v.start);
      // Marked as stopping so per-frame updates don't raise its gain again.
      prev.v.stopping = true;
      const g = prev.v.gain.gain;
      g.cancelScheduledValues(at);
      g.setTargetAtTime(0, at, 0.06);
      try {
        prev.v.src.stop(at + 0.4);
      } catch {
        /* ignore */
      }
      prev.v.end = Math.min(prev.v.end, at + 0.4);
    }
    this._tails.set(key, handle);
    if (this._tails.size > 64) this._tails.delete(this._tails.keys().next().value);
  }

  stopAll(fade = 0.1) {
    for (const v of [...this.voices]) this._stopVoice(v, fade);
  }

  get activeVoices() {
    return this.voices.length;
  }

  // ---------------------------------------------------------------------------
  // Game-facing helpers

  // Echo delay of one shooter's surroundings: the same tree line answers every
  // shot of a burst, so it stays constant per source.
  _echoDelay(key, lo, hi) {
    let d = this._echoDelays.get(key);
    if (d == null) {
      d = lo + this.random() * (hi - lo);
      this._echoDelays.set(key, d);
      if (this._echoDelays.size > 128) this._echoDelays.delete(this._echoDelays.keys().next().value);
    }
    return d;
  }

  // A gunshot of `type` (GUN_TYPES, or '<type>Far' to force the far report).
  // opts: { isLocal (fired by the listener: no propagation delay, 2D),
  // volume, occlusion, delay (s, schedule ahead: lets automatic fire keep exact
  // cadence between frames), source (key that identifies the shooter, so
  // automatic fire reuses one echo tail) }. Near and far reports cross-fade
  // between 100 and 300 m; near shots add the surroundings' echo.
  gunshot(type, x, y, z, opts = {}) {
    let t = type;
    let forceFar = false;
    if (t.endsWith('Far')) {
      t = t.slice(0, -3);
      forceFar = true;
    }
    if (!GUN_TYPES.includes(t)) {
      console.warn(`AudioSystem: unknown gun type "${type}"`);
      return DUMMY;
    }
    const vol = opts.volume ?? 1;
    const delay = Math.max(0, opts.delay ?? 0);
    const echoId = `echo${cap(ECHO_OF[t])}`;
    const outdoor = 1 - this.indoor;
    if (opts.isLocal) {
      const key = opts.source ?? 'local';
      const h = this.play(t, null, { volume: 0.9 * vol, reverb: 0.35, delay });
      if (outdoor > 0.05) {
        const e = this.play(echoId, null, { volume: 0.3 * vol * outdoor, delay: delay + this._echoDelay(key, 0.08, 0.3), reverb: 0 });
        this._replaceTail(key, e);
      }
      return h;
    }
    const pos = { x, y, z };
    const d = this._distanceTo(pos);
    const w = forceFar ? { near: 0, far: 1 } : gunshotLayers(d);
    const occ = opts.occlusion ?? 0;
    const key = opts.source ?? `${t}:${Math.round(x / 4)}:${Math.round(z / 4)}`;
    let h = DUMMY;
    if (w.near > 0.02) h = this.play(t, pos, { volume: vol * w.near, occlusion: occ, reverb: 0.3, delay });
    if (w.far > 0.02) {
      const hf = this.play(`${t}Far`, pos, { volume: vol * w.far, occlusion: occ, reverb: 0.15, delay });
      this._replaceTail(`${key}:far`, hf);
      if (h === DUMMY) h = hf;
    }
    if (w.near > 0.1 && outdoor > 0.05) {
      const he = this.play(echoId, pos, {
        volume: 0.32 * vol * w.near * outdoor,
        delay: delay + this._echoDelay(key, 0.1, 0.4),
        occlusion: occ,
        reverb: 0,
      });
      this._replaceTail(`${key}:echo`, he);
    }
    return h;
  }

  // A bullet passing the listener: x, y, z = closest point of its path,
  // missDistance (m) and speed (m/s). Supersonic -> N-wave crack (sharper and
  // louder for close misses), subsonic -> whiz. opts: { volume, delay }.
  crack(x, y, z, missDistance = 2, speed = 800, opts = {}) {
    const miss = Math.max(0.1, missDistance);
    const pos = { x, y, z };
    const delay = opts.delay ?? 0;
    const v0 = opts.volume ?? 1;
    if (speed < SPEED_OF_SOUND * 1.02) {
      return this.play('whiz', pos, { volume: v0 * clamp(1.2 / Math.max(miss, 0.4), 0.15, 1), attenuation: false, reverb: 0.05, delay });
    }
    let variant = crackVariant(miss);
    // The shock is very short, so close misses are driven hot (the limiter
    // catches the peak); farther misses fall off roughly with r^-3/4.
    let vol = clamp(Math.pow(1.5 / Math.max(miss, 0.4), 0.75), 0.08, 1.3);
    if (speed < 400) {
      // Barely supersonic: a weaker, rounder crack.
      variant = Math.min(CRACK_MISS.length - 1, variant + 1);
      vol *= 0.7;
    }
    return this.play('crack', pos, { variant, volume: v0 * vol, attenuation: false, reverb: 0.15, delay });
  }

  // A ricochet whine from x, y, z. opts: { volume, delay }.
  ricochet(x, y, z, opts = {}) {
    return this.play('ricochet', { x, y, z }, { volume: opts.volume ?? 0.8, reverb: 0.15, delay: opts.delay ?? 0 });
  }

  // Bullet impact. material: ballistics material name (soil, mud, sand, wood,
  // plank, brick, plaster, stone, concrete, roofTile, rock, steel, armor, glass,
  // water, flesh, foliage, sandbag); energyJ: impact energy (rifle ~3000 J,
  // pistol ~500 J, AT rifle ~30 kJ): louder and slightly deeper when larger.
  // opts: { volume, occlusion, delay }.
  impact(material, x, y, z, energyJ = 3000, opts = {}) {
    const [id, rate, vol] = IMPACT_SOUNDS[material] || IMPACT_SOUNDS.soil;
    const e = clamp(Math.log10(Math.max(10, energyJ) / 3000), -2, 1.3);
    return this.play(
      id,
      { x, y, z },
      {
        volume: (opts.volume ?? 1) * vol * clamp(0.8 + 0.3 * e, 0.25, 1.2),
        rate: rate * (1 - 0.04 * e),
        occlusion: opts.occlusion ?? 0,
        delay: opts.delay ?? 0,
      },
    );
  }

  // Footstep. surface: grass, dirt, gravel, stone, wood, mud, water, leaves,
  // sand. Pass x = null for the listener's own steps (2D). opts: { loud
  // (running/landing), volume, occlusion, delay }.
  footstep(surface, x, y, z, opts = {}) {
    const id = SURFACE_SOUNDS[surface] || 'stepDirt';
    const pos = x == null ? null : { x, y, z };
    return this.play(id, pos, { volume: (opts.loud ? 1 : 0.6) * (opts.volume ?? 1), occlusion: opts.occlusion ?? 0, delay: opts.delay ?? 0 });
  }

  // Explosion. kind: 'grenade' | 'shell' | 'mortar' | 'rocket' | 'tank' (or a
  // sound id). Near and far versions cross-fade with distance; nearby ground
  // bursts add falling debris. opts: { volume, occlusion, delay }.
  explosion(kind, x, y, z, opts = {}) {
    const k = EXPLOSION_SOUNDS[kind];
    const pos = { x, y, z };
    const vol = opts.volume ?? 1;
    const delay = opts.delay ?? 0;
    const occlusion = opts.occlusion ?? 0;
    if (!k) return this.play(kind, pos, { volume: vol, delay, occlusion });
    const d = this._distanceTo(pos);
    const w = gunshotLayers(d, k.fade[0], k.fade[1]);
    let h = DUMMY;
    if (w.near > 0.02) h = this.play(k.near, pos, { volume: vol * w.near, occlusion, delay });
    if (w.far > 0.02) {
      const hf = this.play(k.far, pos, { volume: vol * w.far * k.farGain, occlusion, delay });
      if (h === DUMMY) h = hf;
    }
    if (k.debris > 0 && d < 90) this.play('debrisRain', pos, { volume: vol * k.debris, delay: delay + 0.3 + this.random() * 0.3, occlusion });
    return h;
  }
}

export { SOUNDS, SOUND_IDS };
