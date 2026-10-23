// Vehicle sounds: the engine (pitched by its real rpm, louder under load), track
// clatter with speed, the turret traverse motor, tire squeal and knocks.
export function updateVehicleSound(game, v, dt) {
  const a = game.audio;
  if (!a?.ready) return;
  const s = (v.snd ??= { knockT: 0 });
  const p = v.body.position;
  const pos = { x: p.x, y: p.y, z: p.z };
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
