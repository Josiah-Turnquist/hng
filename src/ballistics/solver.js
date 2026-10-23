// Trajectory calculations used for sight zeroing, range cards and tests.
// Works in 2D (downrange x, height y) with no wind.
import { TABLES, dragDecel } from './drag.js';
import { G } from '../core/math.js';

// Fly a projectile launched at `angle` (radians above horizontal) and record
// height, time and speed at each requested range. Ranges must be ascending.
export function trajectory(ammo, mv, angle, atm, ranges, { y0 = 0, step = 0.0005 } = {}) {
  const table = TABLES[ammo.drag || 'G1'];
  let x = 0,
    y = y0,
    vx = mv * Math.cos(angle),
    vy = mv * Math.sin(angle),
    t = 0;
  const out = [];
  let i = 0;
  const accel = (vx, vy) => {
    const s = Math.hypot(vx, vy);
    const d = dragDecel(table, ammo.bc, s, atm.density, atm.speedOfSound) / s;
    return [-vx * d, -vy * d - G];
  };
  while (i < ranges.length && t < 20) {
    const [ax1, ay1] = accel(vx, vy);
    const pvx = vx + ax1 * step,
      pvy = vy + ay1 * step;
    const [ax2, ay2] = accel(pvx, pvy);
    const nvx = vx + 0.5 * (ax1 + ax2) * step;
    const nvy = vy + 0.5 * (ay1 + ay2) * step;
    const nx = x + 0.5 * (vx + nvx) * step;
    const ny = y + 0.5 * (vy + nvy) * step;
    while (i < ranges.length && nx >= ranges[i]) {
      const f = (ranges[i] - x) / (nx - x);
      out.push({
        range: ranges[i],
        y: y + (ny - y) * f,
        time: t + step * f,
        speed: Math.hypot(vx + (nvx - vx) * f, vy + (nvy - vy) * f),
      });
      i++;
    }
    x = nx;
    y = ny;
    vx = nvx;
    vy = nvy;
    t += step;
    if (vx <= 1) break;
  }
  return out;
}

// Bore elevation (radians, relative to the line of sight) that makes the bullet
// cross the line of sight at `zeroRange`. sightHeight = how far the line of sight
// sits above the bore at the muzzle.
export function solveZero(ammo, mv, sightHeight, zeroRange, atm) {
  let lo = -0.02,
    hi = 0.25;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    const [p] = trajectory(ammo, mv, mid, atm, [zeroRange], { y0: -sightHeight, step: 0.001 });
    if (!p || p.y < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// A range card: drop below the line of sight (meters) at each range for a zero.
export function rangeCard(ammo, mv, sightHeight, zeroRange, atm, ranges) {
  const a = solveZero(ammo, mv, sightHeight, zeroRange, atm);
  return trajectory(ammo, mv, a, atm, ranges, { y0: -sightHeight }).map((p) => ({
    ...p,
    energy: 0.5 * ammo.mass * p.speed * p.speed,
  }));
}
