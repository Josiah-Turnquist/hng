// Spotting, as in the original game: a soldier looking at an enemy through his
// raised binoculars presses fire, and that enemy is marked for his whole side
// for SPOT_TIME seconds. The player's side sees a red mark over him (hud.js),
// and every bot on the side knows he is there and where: he counts as
// spotted (bot.js: aware), with where he is now as the last place seen (but
// not as seen: a bot still has to see him to shoot, and turns that way when he
// has nobody else to fight).
//
//   game.spotting = new Spotting(game);
//   game.spotting.trySpot(s, { eye, dir, raised });  // the enemy marked, or null
//   game.spotting.update(dt);                        // keeps the side's bots aware
//   game.spotting.marked(team)                       // [{ e, t (seconds left) }]
//
// What can be spotted: an enemy soldier (not one inside a tank) whose head or
// chest the spotter can see, past nothing solid and no thick bush or hedge
// (the bots' own sight test, tactics.js), and within SPOT_CONE of the middle of
// the view (about a third of the way out to the edge of a 6x30's field).
import { hiddenAt } from '../ai/tactics.js';

export const SPOT_TIME = 10; // s
export const SPOT_CONE = (1.5 * Math.PI) / 180; // rad from the line of sight
export const SPOT_RANGE = 1200; // m
const REFRESH = 0.25; // s between passing the marks on to the bots

export class Spotting {
  constructor(game) {
    this.game = game;
    this.marks = new Map(); // enemy -> { team, until }
    this.refreshT = 0;
    this.lastTry = -99;
  }

  // The enemy s sees nearest the middle of his view (eye and dir: { x, y, z },
  // dir of unit length), or null.
  target(s, eye, dir) {
    const coll = this.game.world.collision;
    let best = null,
      bestA = SPOT_CONE;
    for (const e of this.game.soldiers) {
      if (!e.alive || e.team === s.team || e === s) continue;
      if (e.vehicle?.def.kind === 'tracked') continue;
      const b = e.body;
      // Toward his chest (a little lower lying down).
      const h = b.stance === 2 ? 0.25 : b.stance === 1 ? 0.8 : 1.25;
      const dx = b.x - eye.x,
        dy = b.y + h - eye.y,
        dz = b.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 1 || d > SPOT_RANGE) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dy * dir.y + dz * dir.z) / d)));
      if (a >= bestA) continue;
      if (hiddenAt(coll, eye, b.x, b.y, b.z, b.stance)) continue;
      bestA = a;
      best = e;
    }
    return best;
  }

  // Fire pressed with binoculars in hand: spots only with them raised to the
  // eyes (raised: how far they are up, 0 .. 1). Returns the enemy marked, or null.
  trySpot(s, { eye, dir, raised = 0 }) {
    const w = s.weapon;
    if (!s.alive || w?.def.type !== 'binoculars' || !s.aiming || raised < 0.9) return null;
    const now = this.game.time;
    if (now - this.lastTry < 0.3) return null;
    this.lastTry = now;
    const e = this.target(s, eye, dir);
    if (!e) return null;
    this.mark(e, s.team);
    return e;
  }

  // Mark e for the side `team` (renewed if already marked).
  mark(e, team) {
    this.marks.set(e, { team, until: this.game.time + SPOT_TIME });
    this._tell(e, team);
  }

  // The enemies marked for a side, with the seconds left on each.
  marked(team) {
    const out = [];
    const now = this.game.time;
    for (const [e, m] of this.marks) if (m.team === team && m.until > now && e.alive) out.push({ e, t: m.until - now });
    return out;
  }

  update(dt) {
    if (!this.marks.size) return;
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = REFRESH;
    const now = this.game.time;
    for (const [e, m] of this.marks) {
      if (m.until <= now || !e.alive) this.marks.delete(e);
      else this._tell(e, m.team);
    }
  }

  // Every bot on the side learns where e is now.
  _tell(e, team) {
    const g = this.game;
    const b = e.body;
    for (const o of g.soldiers) {
      const br = o.brain;
      if (!o.alive || o.team !== team || !br?.aware) continue;
      if ((br.aware.get(e) || 0) < 1) br.aware.set(e, 1);
      const ls = br.lastSeen.get(e);
      if (!ls?.visible) br.lastSeen.set(e, { x: b.x, y: b.y, z: b.z, t: g.time, visible: false });
      if (!br.target && !o.vehicle) br.heard = { x: b.x, z: b.z, t: g.time };
    }
  }
}
