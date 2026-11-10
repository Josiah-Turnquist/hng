// Where the other soldiers and vehicles of an online battle are shown. The
// server sends where everyone is 30 times a second (a snapshot); they reach
// the page a little late and not evenly spaced, and the page draws 60 times a
// second or more. So others are shown a moment in the past, gliding between
// the two snapshots either side of that moment.
//
// How far in the past: as little as the connection allows. Each snapshot's
// lateness is measured against the promptest lately; the delay is one
// snapshot's time plus the worst lateness of the last few seconds, between
// MIN_DELAY and MAX_DELAY. When a snapshot is later still, others carry on
// the way they were going for up to AHEAD seconds rather than stopping dead
// and then jumping forward; and what is shown is eased toward where the
// snapshots say, so a correction is a nudge, not a jump.
//
//   const shown = new Shown()
//   shown.arrived(snap.time, performance.now() / 1000)   // as each snapshot comes
//   const at = shown.at(snaps, dt)        // each frame: { a, b, t, span, dt }
//   shown.place(body, na, nb, at)         // each soldier: x, y, z, vx, vz of body
export const MIN_DELAY = 0.075; // s
export const MAX_DELAY = 0.15;
export const SNAP = 1 / 30; // s between snapshots
const AHEAD = 0.12; // s others may be carried on past the newest snapshot
const JUMP = 3; // m between two snapshots: he was put somewhere new (a respawn), not moved
const TOP_SPEED = 12; // m/s: faster than a man runs (he is riding): his legs are told nothing
const EASE = 14; // 1/s: how fast what is shown closes on where the snapshots say

export class Shown {
  constructor() {
    this.clock = null; // the battle time shown
    this.delay = MIN_DELAY;
    this.base = null; // the promptest (page time - battle time) lately
    this.spread = 0; // the worst lateness lately (s)
  }

  // A snapshot of battle time `time` came at page time `now` (both s).
  arrived(time, now) {
    const off = now - time;
    // (The promptest creeps up, so two clocks that drift apart are followed.)
    this.base = this.base === null ? off : Math.min(off, this.base + 0.0002);
    const late = Math.min(0.5, off - this.base);
    // (The worst lateness is forgotten over some seconds.)
    this.spread = Math.max(late, this.spread - 0.0004);
    this.delay = Math.min(MAX_DELAY, Math.max(MIN_DELAY, SNAP + 0.01 + this.spread));
  }

  // The two snapshots to show between this frame, and how far along (t: 0 at
  // a, 1 at b, more than 1 when carrying on past the newest).
  at(snaps, dt) {
    const newest = snaps[snaps.length - 1].time;
    const want = newest - this.delay;
    // The shown time runs with the page's clock, steered gently to stay the
    // delay behind the newest snapshot.
    if (this.clock === null || Math.abs(want - this.clock) > 1) this.clock = want;
    else this.clock += dt * (1 + Math.max(-0.1, Math.min(0.1, (want - this.clock) * 2)));
    let a = snaps[0],
      b = snaps[snaps.length - 1];
    if (snaps.length > 1 && this.clock >= newest) a = snaps[snaps.length - 2];
    else
      for (let i = 0; i < snaps.length - 1; i++) {
        if (snaps[i].time <= this.clock && snaps[i + 1].time >= this.clock) {
          a = snaps[i];
          b = snaps[i + 1];
          break;
        }
      }
    const span = b.time - a.time;
    const t = span > 0 ? Math.max(0, Math.min(1 + AHEAD / span, (this.clock - a.time) / span)) : 1;
    return { a, b, t, span, dt };
  }

  // One soldier's body between his two snapshots na and nb: where he is
  // shown, and his speed over the ground for the walking of his legs.
  place(body, na, nb, { t, span, dt }) {
    const dx = nb.x - na.x,
      dy = (nb.y || 0) - (na.y || 0),
      dz = nb.z - na.z;
    // Put somewhere new between the two (a respawn, out of a seat): he is
    // there at once, standing, not flown across at thousands of meters a second.
    const jumped = dx * dx + dy * dy + dz * dz > JUMP * JUMP;
    let x = nb.x,
      y = nb.y || 0,
      z = nb.z,
      vx = 0,
      vz = 0;
    if (!jumped && span > 0) {
      x = na.x + dx * t;
      y = (na.y || 0) + dy * Math.min(1, t);
      z = na.z + dz * t;
      vx = dx / span;
      vz = dz / span;
    }
    const was = body._shown;
    if (was && !jumped && dt > 0) {
      // Eased: from where carrying on would put him toward where the snapshots say.
      const ex = was.x + vx * dt,
        ez = was.z + vz * dt;
      if ((ex - x) ** 2 + (ez - z) ** 2 < 1.5 * 1.5) {
        const k = Math.exp(-EASE * dt);
        x += (ex - x) * k;
        z += (ez - z) * k;
        y += (was.y - y) * k;
      }
    }
    (body._shown ||= { x: 0, y: 0, z: 0 }).x = x;
    body._shown.y = y;
    body._shown.z = z;
    body.x = x;
    body.y = y;
    body.z = z;
    if (vx * vx + vz * vz > TOP_SPEED * TOP_SPEED) vx = vz = 0;
    body.vx = vx;
    body.vz = vz;
    return jumped;
  }
}
