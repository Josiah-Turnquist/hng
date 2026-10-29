// The working mechanism of one weapon: what's in the chamber and magazine, how it
// cycles, how it reloads, fire modes and sight settings. It produces "shots" and
// "events" (for sounds and animations); the soldier turns shots into bullets.
//
// Reloading follows how each weapon really works:
//  * box/drum/pan magazines: swap magazines; partly used ones are kept. Closed-bolt
//    guns keep a round in the chamber on a tactical reload (+1).
//  * open-bolt guns (most SMGs and MGs): if you hold the trigger until empty the bolt
//    slams home on an empty chamber and must be cocked again after the reload.
//  * stripper-clip rifles (Kar 98k, Mosin, Springfield): open the bolt, push a full
//    5-round clip in when empty, or single rounds to top off; close the bolt.
//  * M1 Garand: the en-bloc clip ejects with a ping after the last shot; you can
//    eject a part-used clip, but those rounds are lost.
//  * revolvers: Nagant loads round by round through the gate; M1917 uses half-moon clips.
//  * a scope over the action covers the clip guide (def.clipsBlocked): every
//    round is pushed in on its own, even into an empty magazine.
//
// A scoped rifle whose iron sights stay usable (def.irons) aims with one or the
// other (toggleSights); each keeps its own range setting.
//
// A close-combat weapon (def.type 'melee': knife, bayonet, spade, bat) has no
// ammunition and never fires; its blows are game/melee.js's. It is a Weapon so
// that it sits in a loadout slot like the rest.
import { getAmmo } from './ammo.js';

// How much faster than the original game's reload times every reload runs.
export const RELOAD_SPEED = 1.5;

export class Weapon {
  constructor(def) {
    this.def = def;
    this.melee = def.type === 'melee';
    this.ammo = this.melee ? null : getAmmo(def.ammo);
    this.modeIndex = 0;
    this.trigger = false;
    this.triggerWasDown = false;
    this.state = 'ready'; // ready | cycling | reloading | switching | empty-click
    this.stateT = 0;
    this.sequence = null; // active reload/cycle steps
    this.stepIndex = 0;
    this.stepT = 0;
    this.events = []; // emitted this update: {type, ...}
    this.cooldown = 0; // time until the action can fire again
    this.shotsInBurst = 0;
    this.shotsFired = 0;
    this.heat = 0;
    this.zeroIndex = Math.max(0, def.sight.ranges.indexOf(def.sight.zero));
    this.useIrons = false; // a scoped rifle aiming with its iron sights
    this.otherZero = def.irons ? Math.max(0, def.irons.ranges.indexOf(def.irons.zero)) : 0; // the other sight's setting
    this.needsCycle = false; // bolt action: fired, bolt not yet worked
    this.boltBack = false; // open-bolt guns: bolt held back, ready to fire
    this.boltLocked = false; // closed-bolt guns: bolt held open on an empty magazine
    this.fill();
  }

  get mode() {
    return this.def.modes[this.modeIndex];
  }

  get isBolt() {
    return this.mode === 'bolt';
  }

  // The sight in use: the scope (or the only sight), or the iron sights.
  get sight() {
    return this.useIrons ? this.def.irons : this.def.sight;
  }

  // The scope in use, or null (no scope, or aiming with the iron sights).
  get scope() {
    return this.useIrons ? null : this.def.scope || null;
  }

  get zeroRange() {
    return this.sight.ranges[this.zeroIndex];
  }

  // Scope or iron sights, where both can be used.
  toggleSights() {
    if (!this.def.irons) return false;
    this.useIrons = !this.useIrons;
    [this.zeroIndex, this.otherZero] = [this.otherZero, this.zeroIndex];
    this.events.push({ type: 'sights', irons: this.useIrons });
    return true;
  }

  // Start fully loaded.
  // Rounds taken from elsewhere (Scavenger): a part-filled magazine, loose
  // rounds or a clip, as the weapon is fed. Returns whether it took any.
  addRounds(n) {
    const d = this.def;
    if (!(n > 0)) return false;
    if (this.spareMags) this.spareMags.push(Math.min(n, d.capacity));
    else if (d.feed === 'stripper' || d.feed === 'gate') this.loose = (this.loose || 0) + n;
    else if (d.feed === 'enbloc' || d.feed === 'moon') this.clips = (this.clips || 0) + Math.max(1, Math.round(n / d.capacity));
    else return false;
    return true;
  }

  // Spare magazines (clips, rounds) carried: the weapon's, and any extra a
  // combat badge gives (game/badges.js: Hoarder, Dynamite Lover).
  get reserveCount() {
    return (this.def.reserve || 0) + (this.extraReserve || 0);
  }

  fill() {
    const d = this.def;
    this.mag = d.capacity;
    this.chambered = false;
    if (this.melee) {
      this.spareMags = [];
      return;
    }
    if (d.feed === 'stripper' || d.feed === 'enbloc') {
      this.clips = this.reserveCount; // full clips
      this.loose = 0; // loose rounds (from partly used clips)
    } else if (d.feed === 'gate') {
      this.loose = this.reserveCount;
      this.clips = 0;
    } else if (d.feed === 'moon') {
      this.clips = this.reserveCount; // half-moon clips of 3
      this.loose = 0;
    } else {
      this.spareMags = new Array(this.reserveCount).fill(d.capacity);
    }
    if (d.openBolt) this.boltBack = true;
    else if (d.feed !== 'single' && d.feed !== 'disposable' && d.type !== 'grenade') {
      // Closed bolt: one round chambered from the magazine.
      if (d.feed === 'stripper' || d.feed === 'enbloc' || d.feed === 'gate' || d.feed === 'moon') {
        this.mag -= 1;
      }
      this.chambered = true;
    } else {
      this.chambered = true;
      this.mag = 0;
    }
  }

  // Rounds ready to fire without reloading.
  get loaded() {
    return this.mag + (this.chambered ? 1 : 0);
  }

  // Total rounds carried (for the HUD).
  get reserveRounds() {
    const d = this.def;
    if (d.feed === 'stripper' || d.feed === 'enbloc') return this.clips * d.capacity + this.loose;
    if (d.feed === 'gate') return this.loose;
    if (d.feed === 'moon') return this.clips * 3;
    if (this.spareMags) return this.spareMags.reduce((a, b) => a + b, 0);
    return 0;
  }

  get reserveUnits() {
    const d = this.def;
    if (d.feed === 'stripper' || d.feed === 'enbloc' || d.feed === 'moon') return this.clips;
    if (this.spareMags) return this.spareMags.length;
    return this.loose ?? 0;
  }

  setTrigger(down) {
    this.trigger = down;
  }

  cycleMode() {
    if (this.def.modes.length < 2) return false;
    this.modeIndex = (this.modeIndex + 1) % this.def.modes.length;
    this.events.push({ type: 'mode', mode: this.mode });
    return true;
  }

  changeZero(dir) {
    const n = this.sight.ranges.length;
    const i = Math.max(0, Math.min(n - 1, this.zeroIndex + dir));
    if (i === this.zeroIndex) return false;
    this.zeroIndex = i;
    this.events.push({ type: 'zero', range: this.zeroRange });
    return true;
  }

  canFire() {
    const d = this.def;
    if (this.state !== 'ready' || this.cooldown > 1e-9) return false;
    if (d.openBolt) return this.boltBack && this.mag > 0;
    return this.chambered && !this.needsCycle;
  }

  // Can a reload start right now (and is there anything to load)?
  canReload() {
    const d = this.def;
    if (this.state === 'reloading' || this.melee) return false;
    if (d.feed === 'disposable' || d.type === 'grenade') return false;
    if (d.feed === 'stripper' || d.feed === 'enbloc') {
      const room = d.capacity - this.mag - (d.feed === 'enbloc' && this.chambered ? 0 : 0);
      if (d.feed === 'enbloc') return this.clips > 0 && (this.loaded < d.capacity || this.boltLocked);
      return room > 0 && (this.clips > 0 || this.loose > 0);
    }
    if (d.feed === 'gate') return this.loaded < d.capacity && this.loose > 0;
    if (d.feed === 'moon') return this.loaded < d.capacity && this.clips > 0;
    if (d.feed === 'single') return !this.chambered && this.spareMags.length > 0;
    return this.spareMags.length > 0 && this.mag < d.capacity;
  }

  // Build and start the reload sequence for this weapon type.
  startReload() {
    if (!this.canReload()) return false;
    const d = this.def;
    const r = d.reload;
    const steps = [];
    if (d.feed === 'stripper') {
      // Clip when the magazine is empty and we have a full clip (and no scope
      // over the clip guide); otherwise single rounds.
      steps.push({ name: 'boltOpen', t: r.boltOpen, end: () => this._openBolt() });
      const room = d.capacity - this.mag;
      if (room >= d.capacity && this.clips > 0 && !d.clipsBlocked) {
        steps.push({ name: 'clip', t: r.clip, end: () => this._loadClip() });
      } else {
        for (let i = 0; i < room; i++) steps.push({ name: 'round', t: r.round, single: true, end: () => this._loadRound() });
      }
      steps.push({ name: 'boltClose', t: r.boltClose, end: () => this._closeBolt() });
    } else if (d.feed === 'enbloc') {
      if (!this.boltLocked) {
        // Eject a part-used clip: the remaining rounds are lost.
        steps.push({ name: 'ejectClip', t: 0.55, end: () => this._ejectPartialClip() });
      }
      steps.push({ name: 'clipIn', t: r.clip, end: () => this._garandClipIn() });
      steps.push({ name: 'boltRelease', t: 0.35, end: () => this._garandBoltForward() });
      steps.push({ name: 'settle', t: Math.max(0.2, r.empty - r.clip - 0.35) });
    } else if (d.feed === 'gate') {
      steps.push({ name: 'gateOpen', t: r.boltOpen });
      const spent = d.capacity - this.loaded;
      for (let i = 0; i < spent && i < this.loose; i++) steps.push({ name: 'round', t: r.round, single: true, end: () => this._revolverRound() });
      steps.push({ name: 'gateClose', t: r.boltClose });
    } else if (d.feed === 'moon') {
      steps.push({ name: 'cylinderOut', t: 0.6 });
      steps.push({ name: 'moonIn', t: r.empty - 1.1, end: () => this._moonClips() });
      steps.push({ name: 'cylinderIn', t: 0.5 });
    } else if (d.feed === 'single') {
      steps.push({ name: 'load', t: r.empty, end: () => this._loadSingle() });
    } else {
      // Detachable magazine, drum, pan or belt.
      const empty = this.loaded === 0 || (d.openBolt && !this.boltBack);
      const total = empty ? r.empty : r.tactical ?? r.empty;
      const needCharge = (d.openBolt && !this.boltBack) || (!d.openBolt && !this.chambered && !this.boltLocked);
      const releaseAfter = !d.openBolt && this.boltLocked;
      if (d.feed === 'belt') {
        steps.push({ name: 'coverOpen', t: total * 0.22 });
        steps.push({ name: 'magOut', t: total * 0.18, end: () => this._magOut() });
        steps.push({ name: 'magIn', t: total * 0.3, end: () => this._magIn() });
        steps.push({ name: 'coverClose', t: total * 0.15 });
        if (needCharge) steps.push({ name: 'charge', t: total * 0.15, end: () => this._charge() });
        else steps.push({ name: 'settle', t: total * 0.15 });
      } else {
        const chargeT = needCharge || releaseAfter ? Math.min(0.55, total * 0.2) : 0;
        steps.push({ name: 'magOut', t: (total - chargeT) * 0.42, end: () => this._magOut() });
        steps.push({ name: 'magIn', t: (total - chargeT) * 0.58, end: () => this._magIn() });
        if (needCharge) steps.push({ name: 'charge', t: chargeT, end: () => this._charge() });
        else if (releaseAfter) steps.push({ name: 'boltRelease', t: chargeT, end: () => this._charge() });
      }
    }
    // Every reload runs RELOAD_SPEED times as fast as the original game's
    // timings (ours), and faster still with Fast Reload (game/badges.js).
    const k = (this.reloadMul ?? 1) / RELOAD_SPEED;
    for (const st of steps) st.t *= k;
    this.sequence = { kind: 'reload', steps };
    this.stepIndex = 0;
    this.stepT = 0;
    this.state = 'reloading';
    this.events.push({ type: 'reloadStart', steps: steps.map((s) => s.name) });
    this.events.push({ type: 'step', name: steps[0].name, t: steps[0].t });
    return true;
  }

  cancelReload() {
    if (this.state !== 'reloading') return;
    // Single-round loading can be stopped cleanly: close the bolt and go.
    const st = this.sequence.steps;
    const closeIdx = st.findIndex((s) => s.name === 'boltClose' || s.name === 'gateClose');
    if (closeIdx > this.stepIndex && st[this.stepIndex].single) {
      this.stepIndex = closeIdx;
      this.stepT = 0;
      this.events.push({ type: 'step', name: st[closeIdx].name, t: st[closeIdx].t });
      return;
    }
    if (st[this.stepIndex].single) return;
    this.state = 'ready';
    this.sequence = null;
    this.events.push({ type: 'reloadCancel' });
  }

  // Work the bolt of a bolt-action rifle (after each shot).
  startBoltCycle() {
    if (!this.needsCycle || this.state !== 'ready') return false;
    const c = this.def.bolt.cycle;
    this.sequence = {
      kind: 'cycle',
      steps: [
        { name: 'boltUp', t: c * 0.18 },
        { name: 'boltBack', t: c * 0.3, end: () => this._extract() },
        { name: 'boltForward', t: c * 0.32, end: () => this._feedFromMag() },
        { name: 'boltDown', t: c * 0.2, end: () => (this.needsCycle = false) },
      ],
    };
    // A target scope without a return spring slides forward in its mounts with
    // each shot and is pulled back by hand before the next.
    if (this.def.scopeReturn) this.sequence.steps.push({ name: 'scopeBack', t: this.def.scopeReturn });
    this.stepIndex = 0;
    this.stepT = 0;
    this.state = 'cycling';
    this.events.push({ type: 'step', name: 'boltUp', t: c * 0.18 });
    return true;
  }

  // --- reload step effects -------------------------------------------------------
  _openBolt() {
    if (this.chambered && this.def.feed === 'stripper') {
      // Opening the bolt doesn't eject a live round when topping off; keep it on the follower.
      this.chambered = false;
      this.mag = Math.min(this.def.capacity, this.mag + 1);
    }
    this.needsCycle = false;
    this.events.push({ type: 'sound', id: 'boltOpen' });
  }

  _loadClip() {
    const d = this.def;
    if (this.clips <= 0) return;
    this.clips--;
    this.mag = d.capacity;
    this.events.push({ type: 'sound', id: 'stripperClip' });
  }

  _loadRound() {
    if (this.mag >= this.def.capacity) return;
    if (this.loose > 0) this.loose--;
    else if (this.clips > 0) {
      // Break open a clip: take one round, keep the rest loose.
      this.clips--;
      this.loose += this.def.capacity - 1;
    } else return;
    this.mag++;
    this.events.push({ type: 'sound', id: 'roundInsert' });
  }

  _closeBolt() {
    if (!this.chambered && this.mag > 0) {
      this.mag--;
      this.chambered = true;
    }
    this.boltLocked = false;
    this.events.push({ type: 'sound', id: 'boltClose' });
  }

  _ejectPartialClip() {
    // The rounds left in the clip are picked up and kept as loose rounds; every
    // 8 loose rounds make up a new clip.
    this.loose += this.mag + (this.chambered ? 1 : 0);
    while (this.loose >= this.def.capacity) {
      this.loose -= this.def.capacity;
      this.clips++;
    }
    this.mag = 0;
    this.chambered = false;
    this.boltLocked = true;
    this.events.push({ type: 'clipEject', partial: true });
    this.events.push({ type: 'sound', id: 'garandPing' });
  }

  _garandClipIn() {
    if (this.clips <= 0) return;
    this.clips--;
    this.mag = this.def.capacity;
    this.events.push({ type: 'sound', id: 'garandClipIn' });
  }

  _garandBoltForward() {
    this.mag--;
    this.chambered = true;
    this.boltLocked = false;
    this.events.push({ type: 'sound', id: 'boltClose' });
  }

  _revolverRound() {
    if (this.loose <= 0) return;
    this.loose--;
    if (!this.chambered) this.chambered = true;
    else this.mag++;
    this.events.push({ type: 'sound', id: 'roundInsert' });
  }

  _moonClips() {
    const need = this.def.capacity - this.loaded;
    const clipsUsed = Math.min(this.clips, Math.ceil(need / 3));
    this.clips -= clipsUsed;
    const add = Math.min(need, clipsUsed * 3);
    if (!this.chambered && add > 0) {
      this.chambered = true;
      this.mag += add - 1;
    } else this.mag += add;
    this.events.push({ type: 'sound', id: 'magIn' });
  }

  _loadSingle() {
    this.spareMags.pop();
    this.chambered = true;
    this.events.push({ type: 'sound', id: 'roundInsert' });
  }

  _magOut() {
    // Keep the partly used magazine (a soldier would stow it), unless it's empty.
    if (this.mag > 0) this.spareMags.unshift(this.mag);
    this.mag = 0;
    this.events.push({ type: 'sound', id: this.def.feed === 'belt' ? 'linkDrop' : 'magOut' });
  }

  _magIn() {
    // Take the fullest spare magazine.
    let best = 0;
    for (let i = 1; i < this.spareMags.length; i++) if (this.spareMags[i] > this.spareMags[best]) best = i;
    this.mag = this.spareMags.splice(best, 1)[0] ?? 0;
    this.events.push({ type: 'sound', id: this.def.feed === 'drum' ? 'drumIn' : 'magIn' });
  }

  _charge() {
    const d = this.def;
    if (d.openBolt) this.boltBack = true;
    else if (!this.chambered && this.mag > 0) {
      this.mag--;
      this.chambered = true;
    }
    this.boltLocked = false;
    this.events.push({ type: 'sound', id: 'chargingHandle' });
  }

  _extract() {
    this.events.push({ type: 'eject' });
    this.events.push({ type: 'sound', id: 'boltOpen' });
  }

  _feedFromMag() {
    if (this.mag > 0) {
      this.mag--;
      this.chambered = true;
    }
    this.events.push({ type: 'sound', id: 'boltClose' });
  }

  // --- firing ------------------------------------------------------------------
  // Advance timers; returns the number of shots fired during this step (0 or 1).
  update(dt) {
    if (this.melee) {
      this.triggerWasDown = this.trigger;
      return 0;
    }
    // Keep the leftover fraction of a step so the cyclic rate is exact at any tick rate.
    this.cooldown -= dt;
    if (this.cooldown < 0 && !this.trigger) this.cooldown = 0;
    this.heat = Math.max(0, this.heat - dt * (this.heat > 100 ? 0.9 : 0.6) * (this.def.heatSettle ?? 1));

    if (this.sequence) {
      this.stepT += dt;
      const steps = this.sequence.steps;
      while (this.sequence && this.stepT >= steps[this.stepIndex].t) {
        this.stepT -= steps[this.stepIndex].t;
        const st = steps[this.stepIndex];
        if (st.end) st.end();
        this.stepIndex++;
        if (this.stepIndex >= steps.length) {
          this.events.push({ type: this.sequence.kind === 'reload' ? 'reloadEnd' : 'cycleEnd' });
          this.sequence = null;
          this.state = 'ready';
          break;
        }
        this.events.push({ type: 'step', name: steps[this.stepIndex].name, t: steps[this.stepIndex].t });
      }
      // Interrupt single-round loading by pulling the trigger.
      if (this.sequence && this.sequence.kind === 'reload' && this.trigger && !this.triggerWasDown && steps[this.stepIndex].single) this.cancelReload();
      this.triggerWasDown = this.trigger;
      return 0;
    }

    let shots = 0;
    const pressed = this.trigger && !this.triggerWasDown;
    const mode = this.mode;
    if (this.trigger && this.state === 'ready') {
      const auto = mode === 'auto' || mode === 'slow';
      if (pressed || auto) {
        if (this.canFire()) {
          this._fire();
          shots = 1;
        } else if (pressed) {
          this._dryFire();
        }
      }
    }
    // Bolt action: work the bolt once the trigger is released.
    if (this.needsCycle && !this.trigger && this.state === 'ready' && this.cooldown <= 1e-9) this.startBoltCycle();
    if (!this.trigger) this.shotsInBurst = 0;
    this.triggerWasDown = this.trigger;
    return shots;
  }

  _fire() {
    const d = this.def;
    const rpm = this.mode === 'slow' ? d.rpmSlow : d.rpm;
    const interval = 60 / rpm;
    this.cooldown = Math.max(this.cooldown, -interval) + interval;
    this.shotsFired++;
    this.shotsInBurst++;
    this.heat += d.heatPerShot ?? 0.5;
    const tracer = d.tracerEvery > 0 && this.shotsFired % d.tracerEvery === 0;
    this.events.push({ type: 'shot', tracer });
    if (d.openBolt) {
      this.mag--;
      // The bolt flies forward, fires and comes back. If the trigger is still held
      // with nothing left, it rides home on an empty chamber.
      if (this.mag === 0) this.boltBack = !this.trigger || this.mode === 'semi' ? true : false;
      this.events.push({ type: 'eject' });
      return;
    }
    this.chambered = false;
    if (this.isBolt) {
      this.needsCycle = true;
      this.cooldown = 0.12;
      return;
    }
    if (d.feed === 'single' || d.feed === 'disposable') {
      return;
    }
    if (d.feed === 'gate' || d.feed === 'moon') {
      // Revolver: next chamber rotates under the hammer.
      if (this.mag > 0) {
        this.mag--;
        this.chambered = true;
      }
      return;
    }
    this.events.push({ type: 'eject' });
    if (this.mag > 0) {
      this.mag--;
      this.chambered = true;
    } else if (d.feed === 'enbloc') {
      // Last round: the clip flies out with its famous ping and the bolt locks open.
      this.boltLocked = true;
      this.events.push({ type: 'clipEject', partial: false });
      this.events.push({ type: 'sound', id: 'garandPing' });
    } else if (d.holdOpen) {
      this.boltLocked = true;
    }
  }

  _dryFire() {
    this.events.push({ type: 'dry' });
    this.events.push({ type: 'sound', id: 'dryFire' });
    this.cooldown = 0.2;
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // Refill ammunition (ammo crates).
  resupply() {
    const d = this.def;
    if (this.melee) return;
    if (d.feed === 'stripper' || d.feed === 'enbloc') this.clips = this.reserveCount;
    else if (d.feed === 'gate') this.loose = this.reserveCount;
    else if (d.feed === 'moon') this.clips = this.reserveCount;
    else if (this.spareMags) this.spareMags = new Array(this.reserveCount).fill(d.capacity);
  }
}
