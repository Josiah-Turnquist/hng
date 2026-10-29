// Weapons lying on the ground. A soldier killed drops his main weapon beside
// him, with what ammunition he had left in it and for it; anyone on foot can
// pick it up (the player with the use key), leaving the gun he carried in that
// slot in its place. Dropped weapons stay a couple of minutes.
import { badgeValue } from './badges.js';
import { Weapon } from '../weapons/weapon.js';

const LIFE = 120; // s a dropped weapon stays
const MAX = 60; // weapons lying about at once (the oldest go first)
const REACH = 1.7; // m from the soldier

let nextId = 1;

export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = []; // { id, w, x, y, z, yaw, t }
  }

  // A weapon put down at (x, z).
  put(w, x, z, yaw = Math.random() * Math.PI * 2) {
    const y = this.game.world.hf.getHeight(x, z);
    const d = { id: nextId++, w, x, y, z, yaw, t: this.game.time };
    this.list.push(d);
    while (this.list.length > MAX) this.list.shift();
    return d;
  }

  // Killed: his main weapon falls beside him; he gets a fresh one of the same
  // kind when he comes back.
  dropFrom(s) {
    const w = s.weapons[0];
    if (!w || s.vehicle) return null;
    if (s.throwing) s.throwing = null;
    w.setTrigger(false);
    if (w.state === 'reloading') w.cancelReload();
    s.weapons[0] = new Weapon(w.def);
    s.gunDropped = true;
    const a = Math.random() * Math.PI * 2,
      r = 0.4 + Math.random() * 0.4;
    return this.put(w, s.body.x + Math.cos(a) * r, s.body.z + Math.sin(a) * r);
  }

  // The nearest weapon within reach of a soldier on foot, or null.
  nearest(s) {
    if (s.vehicle || !s.alive) return null;
    const b = s.body;
    let best = null,
      bestD = REACH;
    for (const d of this.list) {
      const dist = Math.hypot(d.x - b.x, d.z - b.z);
      if (dist < bestD && Math.abs(d.y - b.y) < 1.5) {
        bestD = dist;
        best = d;
      }
    }
    return best ? { d: best, dist: bestD } : null;
  }

  // Which of the soldier's slots a weapon goes in.
  slotFor(w) {
    return { sidearm: 1, equipment: 2, closecombat: 5, binoculars: 6 }[w.def.slot] ?? 0;
  }

  // Pick it up: it goes in its slot, and what he had there is left in its place.
  take(s, d) {
    const i = this.list.indexOf(d);
    if (i < 0) return null;
    this.list.splice(i, 1);
    const slot = this.slotFor(d.w);
    const old = s.weapons[slot];
    if (old) {
      old.setTrigger(false);
      if (old.state === 'reloading') old.cancelReload();
      this.put(old, d.x, d.z, d.yaw);
    }
    s.weapons[slot] = d.w;
    s._updateLoad?.();
    return slot;
  }

  update() {
    const t = this.game.time;
    if (this.list.length && t - this.list[0].t > LIFE) this.list = this.list.filter((d) => t - d.t <= LIFE);
    this._scavenge();
  }

  // Scavenger (a combat badge, game/badges.js): walking past a fallen man's gun
  // the player takes part of a magazine for his own main weapon from it, once
  // per gun.
  _scavenge() {
    const s = this.game.player?.soldier;
    const share = badgeValue(s, 'scavenger', 0);
    if (!share || !s.alive || s.vehicle) return;
    const w = s.weapons[0];
    if (!w || w.def.type === 'grenade' || !w.def.capacity) return;
    for (const d of this.list) {
      if (d.scavenged || Math.hypot(d.x - s.body.x, d.z - s.body.z) > 2) continue;
      d.scavenged = true;
      if (w.addRounds?.(Math.ceil(w.def.capacity * share))) this.game.hud?.flash?.('Ammunition taken', 1.2);
    }
  }
}
