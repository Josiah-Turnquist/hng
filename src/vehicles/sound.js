// Vehicle sounds: the engine (pitched by its real rpm, louder under load), track
// clatter with speed, the turret traverse motor, tire squeal and knocks.
import { BIKE_ENGINE_SPECS, CHAIN_SPEC, FREEWHEEL_SPEC } from '../audio/recipes/bikes.js';

export function updateVehicleSound(game, v, dt) {
  const a = game.audio;
  if (!a?.ready) return;
  const s = (v.snd ??= { knockT: 0 });
  const p = v.body.position;
  const pos = { x: p.x, y: p.y, z: p.z };
  if (v.isBike) return bikeSound(a, v, s, pos, dt);
  const tracked = v.def.kind === 'tracked';
  const running = v.alive && v.engineOn;
  if (running && !s.engine) s.engine = a.engine(v.def.engine.sound, { ...pos, volume: tracked ? 1.3 : 0.9 });
  if (!running && s.engine) {
    s.engine.stop(0.6);
    s.engine = null;
  }
  if (s.engine) {
    s.engine.set(pos);
    s.engine.setRpm(v.rpm, v.load);
  }
  // Tracks: a clatter that speeds up with the track.
  if (tracked) {
    const sp = Math.abs((v.trackSpeed[0] + v.trackSpeed[1]) / 2);
    if (sp > 0.25 && !s.tracks) s.tracks = a.loop('tracksClank', { ...pos, volume: 0 });
    if (s.tracks) {
      if (sp < 0.15) {
        s.tracks.stop(0.3);
        s.tracks = null;
      } else s.tracks.set({ ...pos, volume: Math.min(1.1, 0.25 + sp / 5), rate: 0.6 + Math.min(1.2, sp / 7) });
    }
    const turning = Math.abs(v.turretRate || 0) > 0.02 && v.engineOn;
    if (turning && !s.turret) s.turret = a.loop('turretMotor', { ...pos, volume: 0.5 });
    if (s.turret) {
      if (!turning) {
        s.turret.stop(0.15);
        s.turret = null;
      } else s.turret.set(pos);
    }
  } else {
    // Tires squeal when they slide on a hard surface.
    const skid = v.slipping > 0.12 && Math.abs(v.speed) > 3;
    if (skid && !s.skid) s.skid = a.loop('tireSkid', { ...pos, volume: 0 });
    if (s.skid) {
      if (!skid) {
        s.skid.stop(0.2);
        s.skid = null;
      } else s.skid.set({ ...pos, volume: Math.min(1, v.slipping * 2.5) });
    }
  }
  // Knocks against walls, other vehicles and big bumps.
  s.knockT -= dt;
  if (v.lastImpact > 2.5 && s.knockT <= 0) {
    a.play('vehicleImpact', pos, { volume: Math.min(1.5, v.lastImpact / 6), rate: tracked ? 0.7 : 1 });
    s.knockT = 0.4;
  }
}

// How loud tires roll on each ground surface (heightfield SURF codes): stones
// and grit crunch, grass and leaves only hiss.
const GRIT = [0.25, 0.25, 0.8, 0.4, 0.7, 0.6, 0.6, 0.3, 1, 0.5, 0, 0.3];

// Bicycles and motorcycles: the engine loop (rate = rpm / refRpm, as the other
// engines), gear changes, the bicycle's chain and freewheel, tires on gravel,
// skids, knocks and crashes. A parked, sleeping machine makes no sound.
function bikeSound(a, v, s, pos, dt) {
  const d = v.def;
  const speed = Math.abs(v.speed);
  const loop = (key, id, on, set) => {
    if (on && !s[key]) s[key] = a.loop(id, { ...pos, volume: 0 });
    if (!s[key]) return;
    if (!on) {
      s[key].stop(0.25);
      s[key] = null;
    } else s[key].set({ ...pos, ...set });
  };
  if (!v.pedal) {
    // Engine: the same mapping as the AudioSystem's engine handle.
    const spec = BIKE_ENGINE_SPECS[d.engine.sound];
    const running = !!spec && v.alive && v.engineOn;
    const r = spec ? Math.min(2.6, Math.max(0.3, v.rpm / spec.refRpm)) : 1;
    const th = Math.min(1, Math.max(0, v.load || 0));
    loop('engine', d.engine.sound, running, { rate: r, volume: 0.85 * (0.45 + 0.4 * th) * (0.7 + 0.3 * Math.min(1, r)), lowpass: 1200 + 5000 * th * Math.min(1.5, r) });
    const shifting = v.shiftTimer > 0;
    if (shifting && !s.shifting && running && speed > 0.5) a.play('motoShift', pos, { volume: 0.6 });
    s.shifting = shifting;
  } else {
    // Bicycle: the chain while pedaling, the freewheel ticking while coasting.
    const pedaling = v.alive && v.cadence > 5 && !v.fallen;
    const coasting = v.alive && !pedaling && !v.fallen && speed > 0.6;
    loop('chain', 'pedalChain', pedaling, { rate: Math.max(0.3, v.cadence / CHAIN_SPEC.refCadence), volume: 0.25 + 0.35 * Math.min(1, (v.power || 0) / 600) });
    const rev = speed / (2 * Math.PI * d.wheelRadius);
    loop('freewheel', 'freewheel', coasting, { rate: Math.min(3, Math.max(0.3, rev / FREEWHEEL_SPEC.refRevPerSec)), volume: 0.3 });
  }
  // Tires on the ground: crunch on grit, a hiss on grass, faster with speed.
  const w = v.wR || v.wheels?.[0];
  const grit = w?.hit ? (GRIT[w.surface] ?? 0.4) : 0;
  const rolling = speed > 1 && grit > 0 && !v.fallen;
  loop('roll', 'tireGravel', rolling, { rate: Math.min(1.8, 0.6 + speed / 15), volume: grit * Math.min(1, speed / 12) * (v.pedal ? 0.35 : 0.5) });
  // Tires sliding (skids on hard ground).
  const skid = v.slipping > 0.15 && speed > 3 && !v.fallen;
  loop('skid', 'tireSkid', skid, { volume: Math.min(0.8, v.slipping * 2) * (v.pedal ? 0.5 : 0.8), rate: v.pedal ? 1.3 : 1.1 });
  // Down: a crash (or a clatter for a bicycle).
  if (v.fallen && !s.fallen) {
    if (v.pedal) a.play('vehicleImpact', pos, { volume: 0.25 + Math.min(0.5, speed / 15), rate: 1.7 });
    else a.play('bikeCrash', pos, { volume: 0.5 + Math.min(0.7, speed / 15) });
  }
  s.fallen = v.fallen;
  // Knocks against walls, vehicles and big bumps.
  s.knockT -= dt;
  if (v.lastImpact > 2.5 && s.knockT <= 0) {
    a.play('vehicleImpact', pos, { volume: Math.min(1, v.lastImpact / 8), rate: v.pedal ? 1.7 : 1.35 });
    s.knockT = 0.4;
  }
}
