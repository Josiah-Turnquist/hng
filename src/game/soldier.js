// A soldier (the player or a bot): body physics, weapons, health and wounds.
//
// Wound model: damage comes from the bullet's energy when it hits (a bullet that
// has slowed down or passed through a wall does less), scaled by where it hits.
// Hit-zone multipliers follow Heroes & Generals (head x4, body x1, legs x0.8,
// arms x0.5) with the torso split into chest/abdomen. Serious wounds bleed until
// bandaged; leg wounds slow you down, arm wounds make your aim shakier.
// Like the original game, health recovers on its own up to the top of the
// current third once you stop bleeding.
import { upgradedDef, damageScale } from '../weapons/upgrades.js';
import { badgeValue } from './badges.js';
import { Body, STANCE } from '../actors/body.js';
import { Weapon } from '../weapons/weapon.js';
import { WEAPONS } from '../weapons/defs.js';
import { clamp } from '../core/math.js';
import { updateThrow } from './throwing.js';
import { updateMelee } from './melee.js';
import { updateKit, endKit } from './kits.js';

export const ZONES = {
  head: 4.0,
  neck: 2.5,
  chest: 1.15,
  abdomen: 1.0,
  pelvis: 0.9,
  upperArmL: 0.55,
  upperArmR: 0.55,
  forearmL: 0.45,
  forearmR: 0.45,
  handL: 0.35,
  handR: 0.35,
  thighL: 0.8,
  thighR: 0.8,
  shinL: 0.6,
  shinR: 0.6,
  footL: 0.4,
  footR: 0.4,
};

// Damage of a bullet hit, before the hit-zone multiplier.
// Calibrated so a full-power rifle round does ~75 at short range (2 body hits or
// 1 hit and bleeding), an SMG/pistol round ~28-36, an intermediate round ~55.
export function bulletDamage(energyJ, diameterM) {
  return 1.3 * Math.sqrt(Math.max(0, energyJ)) * Math.pow(diameterM / 0.008, 0.35);
}


export class Soldier {
  constructor(game, { faction, cls = 'infantry', loadout, team, name, isPlayer = false, x = 0, z = 0, badges = [], upgrades = null }) {
    // Numbered within the battle (bots use it to spread out; messages name him by it).
    this.id = game.ids ? ++game.ids.soldier : (game.ids = { soldier: 1, vehicle: 0, pickup: 0 }).soldier;
    this.game = game;
    this.faction = faction;
    this.cls = cls;
    this.team = team;
    this.name = name || `Soldier ${this.id}`;
    this.isPlayer = isPlayer;
    this.vehicle = null;
    this.seat = -1;
    const y = game.world.hf.getHeight(x, z);
    this.body = new Body(game.world.collision, x, y, z);
    this.loadout = loadout.slice(); // the weapons he set out with (ids): he has them again each time he comes back
    this.badges = badges; // the combat badges he wears: [{ id, tier, value }] (game/badges.js)
    this.body.staminaRegenMul = badgeValue(this, 'marathonMan', 1);
    this.upgrades = upgrades; // the upgrades fitted to his guns: { gun: { slot: id } } (weapons/upgrades.js)
    this.weapons = loadout.map((id, i) => this._arm(id, i));
    this.current = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.bleed = 0; // HP per second
    this.armWound = 0;
    this.alive = true;
    this.deathTime = 0;
    this.lastHitTime = -100;
    this.lastHitDir = null;
    this.killer = null;
    this.yaw = 0;
    this.pitch = 0;
    this.aiming = false;
    this.action = null; // bandage, firstaid, kit (a kit from his equipment: kits.js), repair
    this.kitUse = null; // a treatment under way with a kit (kits.js)
    this.repair = null; // a spell of work on a vehicle with the wrench (kits.js)
    this.actionT = 0;
    this.throwing = null; // a grenade throw under way (throwing.js)
    this.lastThrowTime = -100;
    this.melee = null; // a blow with a close-combat weapon under way (melee.js)
    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.bandages = 2;
    this.firstAid = 1;
    this.intent = { mx: 0, mz: 0, sprint: false, walk: false, jump: false, leanL: false, leanR: false, yaw: 0, aiming: false };
    this._updateLoad();
  }

  get weapon() {
    return this.weapons[this.current];
  }

  get position() {
    return this.body;
  }

  _updateLoad() {
    // Kit (helmet, webbing, canteen, entrenching tool...) about 12 kg plus weapons and ammo.
    let kg = 12;
    for (const w of this.weapons) if (w) kg += w.def.loadedMass + (w.ammo ? w.reserveRounds * w.ammo.mass * 2.2 : 0); // (binoculars carry no rounds)
    this.body.load = kg;
  }

  // Health "thirds": you heal back up to the top of the band you're in.
  get healCap() {
    if (this.health > 66.6) return 100;
    if (this.health > 33.3) return 66.6;
    return 33.3;
  }

  update(dt) {
    if (!this.alive) {
      this.deathTime += dt;
      if (this.throwing) updateThrow(this.game, this, dt);
      return;
    }
    const intent = this.intent;
    intent.yaw = this.yaw;
    intent.aiming = this.aiming;
    // Riding in a vehicle: the vehicle carries the body.
    if (!this.vehicle) this.body.update(dt, intent);

    // Fall damage.
    if (this.body.fallDamage > 0) {
      this.damage(this.body.fallDamage, { kind: 'fall', part: 'legs' });
      this.body.legWound = Math.min(1, this.body.legWound + this.body.fallDamage / 80);
      this.body.fallDamage = 0;
    }

    // Wounds.
    if (this.bleed > 0) {
      this.health -= this.bleed * dt;
      if (this.health <= 0) this.bleedOut();
    } else if (this.game.time - this.lastHitTime > 8 && this.health < this.healCap) {
      this.health = Math.min(this.healCap, this.health + 2.5 * dt);
    }

    // Actions that take time (bandaging, first aid). The bandage or kit is used
    // up only once it's done: moving interrupts treatment, and you keep it.
    if (this.action) {
      this.actionT += dt;
      // (First Aid: game/badges.js.)
      const quick = badgeValue(this, 'firstAid', 1);
      if (this.action === 'bandage' && this.actionT >= 3.2 * quick) {
        this.bandages = Math.max(0, this.bandages - 1);
        this.bleed = 0;
        this.health = Math.min(100, this.health + 8);
        this.action = null;
      } else if (this.action === 'firstaid' && this.actionT >= 4.5 * quick) {
        this.firstAid = Math.max(0, this.firstAid - 1);
        this.bleed = 0;
        this.health = Math.min(100, Math.max(this.health, 80));
        this.body.legWound *= 0.5;
        this.armWound *= 0.5;
        this.action = null;
      } else if (this.action === 'kit') updateKit(this.game, this, dt);
      // Moving interrupts treatment.
      if (this.action && this.body.moving > 1.2) this.action = null;
    }
    // A treatment with a kit stopped (by moving, a hit, or a weapon change).
    if (this.kitUse && this.action !== 'kit') endKit(this.game, this);

    updateThrow(this.game, this, dt);
    updateMelee(this.game, this, dt);
    for (const w of this.weapons) if (w && w !== this.weapon) w.update(0);
  }

  startBandage() {
    if (!this.alive || this.action || this.bleed <= 0 && this.health > 90) return false;
    if (this.bleed > 0 && this.bandages > 0) {
      this.action = 'bandage';
      this.actionT = 0;
      return true;
    }
    if (this.firstAid > 0 && this.health < 80) {
      this.action = 'firstaid';
      this.actionT = 0;
      return true;
    }
    return false;
  }

  // A bullet (or fragment) hit this soldier. info comes from the projectile system.
  hit(info, projectile) {
    // (Online the game server decides every wound: game/../net/online.js.)
    if (!this.alive || this.game.online) return 0;
    const ammo = projectile.ammo;
    const zone = ZONES[info.part] ?? 1;
    let dmg = bulletDamage(info.energy, ammo.diameter) * zone * damageScale(projectile.weapon, projectile.distance);
    if (ammo.explosive && !ammo.thrown) dmg = Math.max(dmg, 150);
    this.lastHitTime = this.game.time;
    this.lastHitDir = { x: -info.dirX, z: -info.dirZ };
    // Bleeding: big wounds to the torso, neck and thighs bleed hard.
    const torso = info.part === 'chest' || info.part === 'abdomen' || info.part === 'pelvis' || info.part === 'neck';
    const thigh = info.part === 'thighL' || info.part === 'thighR';
    if (torso || thigh) this.bleed += dmg * (thigh ? 0.035 : 0.028);
    else if (info.part !== 'head') this.bleed += dmg * 0.012;
    if (info.part?.startsWith('thigh') || info.part?.startsWith('shin') || info.part?.startsWith('foot')) this.body.legWound = Math.min(1, this.body.legWound + dmg / 70);
    if (info.part?.includes('Arm') || info.part?.startsWith('forearm') || info.part?.startsWith('hand')) this.armWound = Math.min(1, this.armWound + dmg / 60);
    this.damage(dmg, { kind: 'bullet', part: info.part, attacker: projectile.owner, weapon: projectile.weapon, headshot: info.part === 'head' });
    // Being hit interrupts actions (and knocks the player's aim: game.onDamage).
    this.action = null;
    return dmg;
  }

  // Dead of his wounds: the kill of the enemy who wounded him, if that was
  // within the last minute.
  bleedOut() {
    const his = this.game.time - (this.woundedT ?? -99) < 60;
    this.die({ kind: 'bleeding', ...(his ? { attacker: this.woundedBy, weapon: this.woundedWith } : {}) });
  }

  damage(amount, cause) {
    if (!this.alive || this.game.online) return;
    // Who last hurt him, for a death by bleeding later.
    const a = cause?.attacker;
    if (a && a !== this && a.team !== this.team) {
      this.woundedBy = a;
      this.woundedWith = cause.weapon;
      this.woundedT = this.game.time;
    }
    // (Heavy Set: less harm from falls and blasts; Driver: from crashes.)
    if (cause?.kind === 'fall' || cause?.kind === 'explosion') amount *= badgeValue(this, 'heavySet', 1);
    if (cause?.vehicle && (cause.kind === 'crash' || cause.kind === 'fall')) amount *= badgeValue(this, 'driver', 1);
    this.health -= amount;
    this.lastHitTime = this.game.time;
    this.game.onDamage?.(this, amount, cause);
    if (this.health <= 0) this.die(cause);
  }

  die(cause) {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.deathTime = 0;
    this.deaths++;
    this.killer = cause?.attacker || null;
    this.melee = null;
    this.action = null;
    this.kitUse = null;
    this.repair = null;
    for (const w of this.weapons) w?.setTrigger(false);
    // His main weapon falls beside him, for anyone to pick up.
    this.game.pickups?.dropFrom(this);
    // The dead are left where they fell (out of the seat).
    if (this.vehicle) {
      const v = this.vehicle;
      const i = v.occupants.indexOf(this);
      if (i >= 0) v.occupants[i] = null;
      if (i === 0) v.driverInput(0, 0, true);
      this.vehicle = null;
      this.seat = -1;
    }
    this.game.onDeath?.(this, cause);
  }

  // Spare ammo from a crate.
  resupply() {
    for (const w of this.weapons) w?.resupply();
    this.bandages = Math.max(this.bandages, 2);
  }

  // Coming back in: the weapons of his loadout again, in place of any he picked
  // up (those stay with the life they were picked up in).
  rearm() {
    this.loadout.forEach((id, i) => {
      if (this.weapons[i]?.def.id !== (id || undefined)) this.weapons[i] = this._arm(id, i);
    });
    this._updateLoad();
  }

  // A weapon of his loadout, with the upgrades he fitted to it, and as his
  // combat badge has it: Hoarder's spare magazines for his main weapon,
  // Dynamite Lover's extra grenades, Fast Reload (game/badges.js).
  _arm(id, i) {
    if (!id || !WEAPONS[id]) return null;
    const w = new Weapon(upgradedDef(id, this.upgrades?.[id]));
    const extra = i === 0 ? badgeValue(this, 'hoarder', 0) : w.def.type === 'grenade' ? badgeValue(this, 'dynamiteLover', 0) : 0;
    if (extra) {
      w.extraReserve = extra;
      w.fill();
    }
    // Combat Medic: more uses of a first-aid kit or medic pouch.
    if (w.kit && w.def.uses != null && badgeValue(this, 'combatMedic', 0)) {
      w.extraUses = badgeValue(this, 'combatMedic', 0);
      w.fill();
    }
    w.reloadMul = badgeValue(this, 'fastReload', 1);
    return w;
  }

  // Support for weapon stability: bipod down on the ground / prone.
  get supported() {
    const w = this.weapon;
    if (!w) return false;
    return this.body.stance === STANCE.PRONE && this.body.stanceT >= 1;
  }

  get canShoot() {
    const w = this.weapon;
    if (!w || !this.alive || this.action) return false;
    if (this.body.sprinting) return false;
    // Heavy machine guns can only be fired lying down or braced (as in H&G).
    if (w.def.proneOrBipodOnly && !this.supported && this.body.stance !== STANCE.CROUCH) return false;
    return true;
  }

  clampedAim() {
    return clamp(this.pitch, -1.45, 1.45);
  }
}
