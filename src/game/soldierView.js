// The visible soldier: a skinned, procedurally animated model that follows the
// soldier's body and actions (walking, stances, aiming, reloading, bolt work,
// seated in a jeep, ragdoll on death). Its posed skeleton also provides the
// bullet hit zones.
import { SoldierModel } from '../actors/soldierModel.js';
import { buildGun, MODELS } from '../weapons/models/index.js';
import { makeGunMaterials } from '../weapons/models/kit.js';

const KIND = {
  rifle: 'rifle',
  semi: 'rifle',
  sniper: 'rifle',
  assault: 'rifle',
  carbine: 'rifle',
  atRifle: 'rifle',
  smg: 'smg',
  lmg: 'lmg',
  pistol: 'pistol',
  revolver: 'pistol',
  launcher: 'launcher',
  grenade: 'grenade',
};

const gunMats = new WeakMap();

export function attachSoldierModel(game, s) {
  const tex = game.world.textures;
  let model;
  try {
    model = new SoldierModel(s.faction, tex, { seed: s.id * 7919 + 13, lod: 0 });
  } catch (e) {
    console.warn('Soldier model failed', e);
    return null;
  }
  const hf = game.world.hf;
  model.setGround((x, z) => hf.getHeight(x, z));
  game.world.add(model.root);
  s.model = model;
  s.view = { gunId: null, guns: new Map(), recoil: 0, lod: 0, deathSeen: false };
  setSoldierWeapon(game, s);
  return model;
}

// Put the soldier's current weapon in its hands (guns are built once per soldier).
export function setSoldierWeapon(game, s) {
  const m = s.model;
  if (!m) return;
  const w = s.weapon;
  const id = w?.def.id ?? null;
  if (s.view.gunId === id) return;
  s.view.gunId = id;
  if (!id || !MODELS[id]) {
    m.setWeapon(null, w ? KIND[w.def.type] || 'rifle' : 'none');
    return;
  }
  let gun = s.view.guns.get(id);
  if (!gun) {
    const tex = game.world.textures;
    let mats = gunMats.get(tex);
    if (!mats) gunMats.set(tex, (mats = makeGunMaterials(tex)));
    gun = buildGun(id, mats);
    game.world.shadows.prepare(gun.root);
    s.view.guns.set(id, gun);
  }
  m.setWeapon(gun, KIND[w.def.type] || 'rifle');
}

const _state = {
  stance: 0,
  stanceBlend: 0,
  speed: 0,
  localVelX: 0,
  localVelZ: 0,
  sprinting: false,
  onGround: true,
  yaw: 0,
  aimPitch: 0,
  aimYawOffset: 0,
  aiming: false,
  lean: 0,
  recoil: 0,
  action: null,
  actionT: 0,
  alive: true,
  deathT: 0,
  hitDir: null,
  seated: false,
};

// Per rendered frame.
export function updateSoldierView(game, s, dt, camPos, firstPersonPlayer) {
  const m = s.model;
  if (!m) return;
  const b = s.body;
  const v = s.vehicle;
  // Hidden: the player's own body in first person, and crews inside tanks.
  const hidden = (s.isPlayer && firstPersonPlayer && !v) || (v && v.def.kind === 'tracked') || (!s.alive && s.deathTime > 90);
  m.root.visible = !hidden;
  if (hidden && s.alive) return;
  setSoldierWeapon(game, s);
  const st = _state;
  const smooth = (t) => t * t * (3 - 2 * t);
  st.stance = b.targetStance;
  st.stanceBlend = b.stanceT < 1 ? b.stanceFrom + (b.targetStance - b.stanceFrom) * smooth(b.stanceT) : b.stance;
  const fx = -Math.sin(b.yaw),
    fz = -Math.cos(b.yaw);
  const rx = Math.cos(b.yaw),
    rz = -Math.sin(b.yaw);
  st.localVelX = b.vx * rx + b.vz * rz;
  st.localVelZ = -(b.vx * fx + b.vz * fz);
  st.speed = Math.hypot(b.vx, b.vz);
  st.sprinting = b.sprinting;
  st.onGround = b.onGround || !!v;
  st.yaw = b.yaw;
  st.aimPitch = s.pitch;
  st.aimYawOffset = 0;
  st.aiming = s.aiming;
  st.lean = b.lean;
  s.view.recoil = Math.max(0, s.view.recoil - dt * 6);
  st.recoil = s.view.recoil;
  st.alive = s.alive;
  st.deathT = s.alive ? 0 : s.deathTime;
  st.hitDir = s.lastHitDir ? { x: -s.lastHitDir.x, z: -s.lastHitDir.z } : null;
  st.seated = !!v;
  // Actions.
  const w = s.weapon;
  st.action = null;
  st.actionT = 0;
  if (s.action === 'bandage' || s.action === 'firstaid') {
    st.action = 'bandage';
    st.actionT = Math.min(1, s.actionT / (s.action === 'bandage' ? 3.2 : 4.5));
  } else if (v && s.seat === 0) {
    st.action = 'use';
  } else if (s.throwT > 0) {
    st.action = 'throw';
    st.actionT = 1 - s.throwT / 0.8;
  } else if (w?.sequence) {
    st.action = w.sequence.kind === 'cycle' ? 'bolt' : 'reload';
    const steps = w.sequence.steps;
    let total = 0,
      done = 0;
    steps.forEach((x, i) => {
      total += x.t;
      if (i < w.stepIndex) done += x.t;
    });
    st.actionT = total > 0 ? Math.min(1, (done + w.stepT) / total) : 0;
  }
  // Placement: at the feet, or on the seat.
  if (v) {
    const p = v.seatPos(s.seat, m.root.position, 'hip');
    m.root.position.copy(p);
    const f = v.forward;
    st.yaw = Math.atan2(-f.x, -f.z);
  } else m.root.position.set(b.x, b.y, b.z);
  // Detail by distance.
  const d = m.root.position.distanceTo(camPos);
  const lod = d > 45 ? 1 : 0;
  if (lod !== s.view.lod) {
    s.view.lod = lod;
    m.setLod(lod);
  }
  m.update(dt, st);
}

export function removeSoldierModel(s) {
  if (!s.model) return;
  s.model.root.removeFromParent();
  s.model.dispose?.();
  s.model = null;
}
