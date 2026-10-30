// Throwing a hand grenade, the same for the player and the bots.
//
// Starting a throw pulls the pin and draws the arm back (WINDUP s). Held drawn
// back after that, the grenade is cooking: its fuse is burning. Letting go
// starts the swing, and SWING s later the grenade leaves the hand, launched by
// aim(s) -> { x, y, z, vx, vy, vz } worked out at that moment; then the arm
// follows through. Killed with a cooking grenade in hand, a soldier drops it.
// The first- and third-person throwing motions read s.throwing:
//   { phase: 'windup' | 'swing' | 'follow', t (s into the phase), cook, w, ... }
import { badgeValue } from './badges.js';
import { STANCE } from '../actors/body.js';

export const WINDUP = 0.3; // s to pull the pin and draw the arm back
export const SWING = 0.1; // s from the start of the swing to letting go
export const FOLLOW = 0.45; // s of follow-through

export function hasGrenade(w) {
  return !!w && w.def.type === 'grenade' && (w.chambered || w.spareMags?.length > 0);
}

// The grenades a soldier carries, if he has any left.
export function grenadeOf(s) {
  const w = s.weapons.find((x) => x?.def.type === 'grenade');
  return hasGrenade(w) ? w : null;
}

// Pull the pin and draw back. With aim given, the throw goes as soon as the arm
// is back (after cook more seconds of cooking); otherwise call releaseThrow.
export function startThrow(s, w, { aim = null, cook = 0 } = {}) {
  if (s.throwing || !s.alive || s.vehicle || !hasGrenade(w)) return false;
  s.throwing = { phase: 'windup', t: 0, cook: 0, w, aim, hold: aim ? cook : Infinity, release: !!aim };
  return true;
}

// Let go: the swing starts as soon as the arm is drawn back.
export function releaseThrow(s, aim) {
  const th = s.throwing;
  if (!th || th.phase !== 'windup') return;
  th.release = true;
  th.hold = 0;
  th.aim = aim;
}

// Per simulation step (from Soldier.update).
export function updateThrow(game, s, dt) {
  const th = s.throwing;
  if (!th) return;
  if (!s.alive || s.vehicle) {
    // Dropped: a cooking grenade falls where he was.
    if (th.phase === 'windup' && th.cook > 0) launch(game, s, th, dropAim);
    s.throwing = null;
    return;
  }
  th.t += dt;
  if (th.phase === 'windup') {
    if (th.t > WINDUP) th.cook += dt;
    if (th.release && th.t >= WINDUP && th.cook >= th.hold) {
      th.phase = 'swing';
      th.t = 0;
    }
  } else if (th.phase === 'swing') {
    th.cook += dt;
    if (th.t >= SWING) {
      launch(game, s, th, th.aim);
      th.phase = 'follow';
      th.t = 0;
    }
  } else if (th.t >= FOLLOW) s.throwing = null;
}

// How far through the third-person throw (soldierArms.js 'throw': drawn back at
// 0.36, the grenade leaves the hand at 0.5).
export function throwActionT(th) {
  if (th.phase === 'windup') return 0.36 * Math.min(1, th.t / WINDUP);
  if (th.phase === 'swing') return 0.36 + 0.14 * Math.min(1, th.t / SWING);
  return 0.5 + 0.5 * Math.min(1, th.t / FOLLOW);
}

// Throw strength by stance: lying down you can only lob it a short way.
export function throwSpeed(s, w) {
  const st = s.body.stance;
  // (Grenadier: the range goes with the square of the speed.)
  return w.def.throwSpeed * (st === STANCE.PRONE ? 0.55 : st === STANCE.CROUCH ? 0.85 : 1) * Math.sqrt(badgeValue(s, 'grenadier', 1));
}

// Where the hand lets go: just ahead of the eye, a little to the right.
export function releasePoint(s, out) {
  const b = s.body;
  b.eyePosition(out);
  const fx = -Math.sin(s.yaw),
    fz = -Math.cos(s.yaw);
  out.x += fx * 0.35 + fz * -0.12;
  out.z += fz * 0.35 - fx * -0.12;
  out.y += 0.08;
  return out;
}

// The thrower's view: along his look, a little upward (the player's aim).
export function lookAim(s) {
  const w = s.throwing?.w;
  const p = releasePoint(s, { x: 0, y: 0, z: 0 });
  const cp = Math.cos(s.pitch);
  let dx = -Math.sin(s.yaw) * cp,
    dy = Math.sin(s.pitch) + 0.18,
    dz = -Math.cos(s.yaw) * cp;
  const l = Math.hypot(dx, dy, dz);
  const v = throwSpeed(s, w);
  const b = s.body;
  return { x: p.x, y: p.y, z: p.z, vx: (dx / l) * v + b.vx, vy: (dy / l) * v + b.vy, vz: (dz / l) * v + b.vz };
}

function dropAim(s) {
  const b = s.body;
  return { x: b.x, y: b.y + 0.4, z: b.z, vx: b.vx * 0.5, vy: 0, vz: b.vz * 0.5 };
}

function launch(game, s, th, aim) {
  const w = th.w;
  if (!hasGrenade(w) || !aim) return;
  if (w.chambered) w.chambered = false;
  else w.spareMags.pop();
  const a = aim(s);
  const p = game.projectiles.fire({ x: a.x, y: a.y, z: a.z, vx: a.vx, vy: a.vy, vz: a.vz, ammo: w.ammo, owner: s, weapon: w.def });
  s.tally?.shot(w.def, s);
  // The fuse has been burning since the arm was drawn back.
  p.age = Math.min(w.ammo.fuseTime - 0.5, th.cook);
  game.audio?.play?.('weaponHandling', s.isPlayer ? null : s.body, { volume: 0.5 });
  // The next grenade into the hand.
  if (!w.chambered && w.spareMags.length) {
    w.spareMags.pop();
    w.chambered = true;
  }
  s.lastThrowTime = game.time;
}
