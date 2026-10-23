// Hit zones for bullets. When a soldier has a 3D model, its posed skeleton
// provides the capsules; otherwise we build a simple stand-in from the body's
// position, facing and stance.
import { STANCE } from '../actors/body.js';

// Ray vs capsule (segment a-b, radius r). Returns [tEnter, tExit] or null.
// d must be unit length.
export function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r) {
  // Based on the standard ray / infinite cylinder + sphere caps test.
  const bax = bx - ax,
    bay = by - ay,
    baz = bz - az;
  const oax = ox - ax,
    oay = oy - ay,
    oaz = oz - az;
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * dx + bay * dy + baz * dz;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = dx * oax + dy * oay + dz * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const a = baba - bard * bard;
  let b = baba * rdoa - baoa * bard;
  let c = baba * oaoa - baoa * baoa - r * r * baba;
  let h = b * b - a * c;
  let tIn = Infinity,
    tOut = -Infinity;
  if (h >= 0 && a > 1e-12) {
    const sq = Math.sqrt(h);
    const t0 = (-b - sq) / a,
      t1 = (-b + sq) / a;
    for (const t of [t0, t1]) {
      const y = baoa + t * bard;
      if (y > 0 && y < baba) {
        tIn = Math.min(tIn, t);
        tOut = Math.max(tOut, t);
      }
    }
  }
  // Caps.
  for (const [cx, cy, cz] of [
    [ax, ay, az],
    [bx, by, bz],
  ]) {
    const px = ox - cx,
      py = oy - cy,
      pz = oz - cz;
    const bb = px * dx + py * dy + pz * dz;
    const cc = px * px + py * py + pz * pz - r * r;
    const hh = bb * bb - cc;
    if (hh >= 0) {
      const s = Math.sqrt(hh);
      tIn = Math.min(tIn, -bb - s);
      tOut = Math.max(tOut, -bb + s);
    }
  }
  if (tIn === Infinity || tOut < 0) return null;
  return [Math.max(0, tIn), tOut];
}

const _boxes = [];

// Simple stand-in hitboxes (used until the soldier has a posed model).
export function hitboxesFor(s, out = _boxes) {
  out.length = 0;
  const b = s.body;
  const yaw = b.yaw;
  const fx = -Math.sin(yaw),
    fz = -Math.cos(yaw); // forward
  const rx = Math.cos(yaw),
    rz = -Math.sin(yaw); // right
  const P = (right, up, fwd) => [b.x + rx * right + fx * fwd, b.y + up, b.z + rz * right + fz * fwd];
  const add = (part, a, c, r) => out.push({ part, ax: a[0], ay: a[1], az: a[2], bx: c[0], by: c[1], bz: c[2], r });
  if (b.stance === STANCE.PRONE) {
    add('head', P(0, 0.22, 0.75), P(0, 0.24, 0.8), 0.11);
    add('chest', P(0, 0.2, 0.25), P(0, 0.22, 0.55), 0.17);
    add('abdomen', P(0, 0.18, -0.05), P(0, 0.2, 0.25), 0.15);
    add('pelvis', P(0, 0.16, -0.2), P(0, 0.17, -0.05), 0.15);
    add('thighL', P(-0.12, 0.13, -0.25), P(-0.15, 0.1, -0.65), 0.08);
    add('thighR', P(0.12, 0.13, -0.25), P(0.15, 0.1, -0.65), 0.08);
    add('shinL', P(-0.15, 0.09, -0.65), P(-0.17, 0.08, -1.05), 0.06);
    add('shinR', P(0.15, 0.09, -0.65), P(0.17, 0.08, -1.05), 0.06);
    add('upperArmL', P(-0.22, 0.25, 0.55), P(-0.2, 0.15, 0.75), 0.055);
    add('upperArmR', P(0.22, 0.25, 0.55), P(0.18, 0.15, 0.75), 0.055);
    return out;
  }
  const h = b.stance === STANCE.CROUCH ? 0.68 : 1.0; // crouched: torso lower, legs folded
  const torsoBase = b.stance === STANCE.CROUCH ? 0.55 : 0.88;
  const lean = b.lean * 0.3;
  add('head', P(lean, torsoBase + 0.76 * 1, 0.02), P(lean, torsoBase + 0.82, 0.02), 0.105);
  add('neck', P(lean * 0.9, torsoBase + 0.6, 0), P(lean * 0.9, torsoBase + 0.68, 0.01), 0.06);
  add('chest', P(lean * 0.7, torsoBase + 0.32, 0), P(lean * 0.8, torsoBase + 0.52, 0), 0.17);
  add('abdomen', P(lean * 0.4, torsoBase + 0.12, 0), P(lean * 0.6, torsoBase + 0.3, 0), 0.155);
  add('pelvis', P(0, torsoBase - 0.02, 0), P(lean * 0.3, torsoBase + 0.1, 0), 0.16);
  if (b.stance === STANCE.CROUCH) {
    add('thighL', P(-0.11, 0.55, 0), P(-0.12, 0.45, 0.4), 0.08);
    add('thighR', P(0.11, 0.55, 0), P(0.12, 0.45, 0.4), 0.08);
    add('shinL', P(-0.12, 0.45, 0.4), P(-0.12, 0.05, 0.35), 0.06);
    add('shinR', P(0.12, 0.45, 0.4), P(0.12, 0.05, 0.1), 0.06);
  } else {
    add('thighL', P(-0.11, 0.86 * h, 0), P(-0.11, 0.48 * h, 0.02), 0.08);
    add('thighR', P(0.11, 0.86 * h, 0), P(0.11, 0.48 * h, 0.02), 0.08);
    add('shinL', P(-0.11, 0.47 * h, 0.02), P(-0.11, 0.08, 0), 0.06);
    add('shinR', P(0.11, 0.47 * h, 0.02), P(0.11, 0.08, 0), 0.06);
  }
  // Arms raised holding a weapon forward.
  const sh = torsoBase + 0.55;
  add('upperArmL', P(-0.2 + lean, sh, 0), P(-0.18 + lean, sh - 0.18, 0.2), 0.055);
  add('forearmL', P(-0.18 + lean, sh - 0.18, 0.2), P(-0.02 + lean, sh - 0.08, 0.42), 0.045);
  add('upperArmR', P(0.2 + lean, sh, 0), P(0.24 + lean, sh - 0.25, 0.05), 0.055);
  add('forearmR', P(0.24 + lean, sh - 0.25, 0.05), P(0.08 + lean, sh - 0.12, 0.2), 0.045);
  return out;
}

// Nearest hit on a soldier: { t, tExit, part, nx, ny, nz } or null.
export function raycastSoldier(s, ox, oy, oz, dx, dy, dz, maxDist) {
  if (!s.alive && s.deathTime > 30) return null;
  const boxes = s.model?.getHitboxes ? s.model.getHitboxes(_tmpBoxes) : hitboxesFor(s);
  let best = null;
  for (const h of boxes) {
    const r = rayCapsule(ox, oy, oz, dx, dy, dz, h.ax, h.ay, h.az, h.bx, h.by, h.bz, h.r);
    if (!r || r[0] > maxDist) continue;
    if (!best || r[0] < best.t) {
      // Normal: from the capsule axis to the hit point.
      const t = r[0];
      const px = ox + dx * t,
        py = oy + dy * t,
        pz = oz + dz * t;
      const abx = h.bx - h.ax,
        aby = h.by - h.ay,
        abz = h.bz - h.az;
      const l2 = abx * abx + aby * aby + abz * abz || 1;
      let u = ((px - h.ax) * abx + (py - h.ay) * aby + (pz - h.az) * abz) / l2;
      u = Math.max(0, Math.min(1, u));
      let nx = px - (h.ax + abx * u),
        ny = py - (h.ay + aby * u),
        nz = pz - (h.az + abz * u);
      const nl = Math.hypot(nx, ny, nz) || 1;
      best = { t, tExit: r[1], part: h.part, nx: nx / nl, ny: ny / nl, nz: nz / nl };
    }
  }
  return best;
}

const _tmpBoxes = [];
