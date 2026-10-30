// How the gun in a player's hands is held, as plain numbers the rules need:
// how far it has come back up after a weapon change (it can't fire until it
// is up), and how far the sights have come up to the eye (a shot counts as
// aimed when they are nearly there). Stepped with the battle, so the server
// knows it as well as the player's own screen does; the first-person gun
// (weapons/viewmodel.js) shows the same thing.
export class GunHold {
  constructor() {
    this.swap = 1; // 0 lowered out of view .. 1 up
    this.swapRate = 3.2; // a second over three to come up (Quickdraw is quicker)
    this.aimT = 0; // how far the sights have come up, in time (0 .. 1)
    this.aim = 0; // the same, eased (0 hip .. 1 aimed)
  }

  // A new gun in the hands (or a blow with the close-combat weapon): it comes up from below.
  lower(to = 0) {
    this.swap = Math.min(this.swap, to);
  }

  // Raising the sights takes a set time, longer for heavier guns (a Garand
  // 0.35 s), eased in and out (as the first-person gun shows it).
  update(dt, { aiming = false, mass = 4 } = {}) {
    this.swap = Math.min(1, this.swap + dt * this.swapRate);
    const adsTime = 1.3 * (0.16 + mass * 0.025);
    const step = dt / adsTime;
    const target = aiming ? 1 : 0;
    this.aimT = this.aimT < target ? Math.min(target, this.aimT + step) : Math.max(target, this.aimT - step);
    this.aim = this.aimT * this.aimT * (3 - 2 * this.aimT);
  }

  // Up and ready to fire.
  get up() {
    return this.swap > 0.9;
  }

  // Shots count as aimed (no pointing error from the hip).
  get aimed() {
    return this.aim > 0.85;
  }
}
