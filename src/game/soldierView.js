// The visible soldier: a skinned, procedurally animated model that follows the
// soldier's body and actions (walking, stances, aiming, reloading, bolt work,
// seated in a jeep, riding a bicycle or motorcycle, ragdoll on death). Its posed
// skeleton also provides the bullet hit zones. The uniform and kit follow the
// soldier's army, class and primary weapon; three levels of detail by distance.
import { badgeValue } from './badges.js';
import { SoldierModel } from '../actors/soldierModel.js';
import { buildGun, gunLodForDistance, MODELS } from '../weapons/models/index.js';
import { makeGunMaterials } from '../weapons/models/kit.js';
import { throwActionT } from './throwing.js';
import { meleeActionT } from './melee.js';

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
  melee: 'melee',
  binoculars: 'binoculars',
};

// The primary weapon decides the ammunition pouches on the belt.
const ROLE = { smg: 'smg', lmg: 'mg', launcher: 'at', atRifle: 'at' };

const gunMats = new WeakMap();

// The materials for guns seen in the world (shared by every soldier's guns and
// thrown grenades).
export function worldGunMaterials(game) {
  const tex = game.world.textures;
  let mats = gunMats.get(tex);
  if (!mats) gunMats.set(tex, (mats = makeGunMaterials(tex)));
  return mats;
}

export function attachSoldierModel(game, s) {
  const tex = game.world.textures;
  let model;
  try {
    const primary = s.weapons?.[0]?.def;
    // The player looks like his soldier on the Heroes screen (face and uniform).
    const look = s.isPlayer ? game.opts?.soldier : null;
    model = new SoldierModel(s.faction, tex, { seed: look?.seed ?? s.id * 7919 + 13, variant: look?.variant, lod: 0, cls: s.cls, role: ROLE[primary?.type] || 'rifle' });
    // Build every level of detail now so none is first built mid-battle.
    model.prepareLods();
  } catch (e) {
    console.warn('Soldier model failed', e);
    return null;
  }
  const hf = game.world.hf;
  model.setGround((x, z) => hf.getHeight(x, z));
  game.world.add(model.root);
  s.model = model;
  s.view = { gunId: null, gunLod: 1, guns: new Map(), recoil: 0, lod: 0, deathSeen: false, ride: {} };
  setSoldierWeapon(game, s);
  // The player's first-person arms wear the same sleeves, cuffs and hands.
  if (s.isPlayer) game.player?.viewmodel?.setOutfit?.({ faction: model.faction, cls: model.cls, seed: model.seed, role: model.role, variant: model.variant });
  return model;
}

// Level of detail switching distances (m): full detail up close, a lighter model
// in the middle distance, a very cheap one far away. The quality settings scale
// them (soldierLod if a preset defines it, else the general detail level).
function lodDistances(game) {
  const q = game.world.quality || {};
  if (Array.isArray(q.soldierLodDistance)) return q.soldierLodDistance;
  const k = q.soldierLod ?? Math.min(1.3, Math.max(0.6, q.terrainLod ?? 1));
  return [16 * k, 50 * k];
}

// Put the soldier's current weapon in its hands. Guns are built once per soldier
// and level of detail (copies share their geometry); dist (m from the camera)
// picks the detail: the lighter gun beyond GUN_LOD2_DISTANCE, with a 10% band
// so it doesn't flicker at the boundary. The anchors are the same at every level.
export function setSoldierWeapon(game, s, dist = 0) {
  const m = s.model;
  if (!m) return;
  const w = s.weapon;
  const id = w?.def.id ?? null;
  const lod = gunLodForDistance(s.view.gunLod === 2 ? dist * 1.1 : dist / 1.1);
  const key = id && MODELS[id] ? `${id}@${lod}` : id;
  if (s.view.gunId === key) return;
  s.view.gunId = key;
  if (!id || !MODELS[id]) {
    m.setWeapon(null, w ? KIND[w.def.type] || 'rifle' : 'none');
    return;
  }
  s.view.gunLod = lod;
  let gun = s.view.guns.get(key);
  if (!gun) {
    gun = buildGun(id, worldGunMaterials(game), { lod });
    game.world.shadows.prepare(gun.root);
    s.view.guns.set(key, gun);
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

// How much the view is magnified over the normal field of view (1 unless
// looking through a scope or zoomed sights).
const DEG = Math.PI / 180;
export function viewZoom(game) {
  const base = game.player?.baseFov ?? game.camera.fov;
  return Math.max(1, Math.tan((base * DEG) / 2) / Math.tan((game.camera.fov * DEG) / 2));
}

// Per rendered frame.
export function updateSoldierView(game, s, dt, camPos, firstPersonPlayer) {
  const m = s.model;
  if (!m) return;
  const b = s.body;
  const v = s.vehicle;
  // Hidden: the player's own body in first person, and crews inside tanks.
  const hidden = (s.isPlayer && firstPersonPlayer && !v && s.alive) || (v && v.def.kind === 'tracked') || (!s.alive && s.deathTime > 90);
  m.root.visible = !hidden;
  // A hidden model isn't posed, so its skeleton can't stand in for the soldier's
  // hit zones (hitboxes.js builds them from his body instead).
  m.poseValid = !(hidden && s.alive);
  if (hidden && s.alive) return;
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
  // Bicycles and motorcycles pose their riders (saddle, grips, pedals, lean).
  st.ride = v?.riderPose && s.alive ? v.riderPose(s.seat, s.view.ride) : null;
  // A close-combat weapon's carry and blow (soldierArms.js).
  const md = s.weapon?.def;
  st.meleeStyle = md?.type === 'melee' ? md.style : null;
  st.meleeHit = md?.type === 'melee' ? md.attack.hit / md.attack.period : 0;
  if (st.ride) st.seated = false;
  // Actions.
  const w = s.weapon;
  st.action = null;
  st.actionT = 0;
  if (s.action === 'bandage' || s.action === 'firstaid') {
    st.action = 'bandage';
    st.actionT = Math.min(1, s.actionT / ((s.action === 'bandage' ? 3.2 : 4.5) * badgeValue(s, 'firstAid', 1)));
  } else if (v && s.seat === 0 && !st.ride) {
    st.action = 'use';
  } else if (s.throwing) {
    st.action = 'throw';
    st.actionT = throwActionT(s.throwing);
  } else if (s.melee) {
    st.action = 'melee';
    st.actionT = meleeActionT(s.melee);
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
  // Placement: at the feet, on the saddle (the root is then the hip point), or
  // on the seat.
  if (st.ride) {
    m.root.position.copy(st.ride.hip);
    st.yaw = st.ride.yaw;
  } else if (v) {
    const p = v.seatPos(s.seat, m.root.position, 'hip');
    m.root.position.copy(p);
    const f = v.forward;
    st.yaw = Math.atan2(-f.x, -f.z);
  } else m.root.position.set(b.x, b.y, b.z);
  // Detail by how big he looks, with a little hysteresis so it doesn't flicker:
  // through a scope's magnification he is as near as he looks. (Picked by the
  // bare distance, a man 150 m off seen through a 4x scope kept the far,
  // stripped-down gun, its thin parts gone.)
  const d = m.root.position.distanceTo(camPos) / viewZoom(game);
  setSoldierWeapon(game, s, d);
  // A fired launcher's tube stays empty until it's reloaded.
  const gun = s.view.guns.get(s.view.gunId);
  if (gun && (gun.parts.rocket || gun.parts.warhead)) {
    const empty = w?.def.type === 'launcher' && w.loaded === 0 && w.state !== 'reloading';
    for (const r of [gun.parts.rocket, gun.parts.warhead]) if (r) r.visible = !empty;
  }
  const [d0, d1] = lodDistances(game);
  const cur = s.view.lod;
  const h = cur === 0 ? 1.1 : 1.0;
  const h1 = cur <= 1 ? 1.1 : 1.0;
  const lod = d > d1 * h1 ? 2 : d > d0 * h ? 1 : 0;
  if (lod !== cur) {
    s.view.lod = lod;
    m.setLod(lod);
  }
  m.update(dt, st);
  // His gun was dropped (it lies on the ground as a pickup): not in the dead hands.
  if (!s.alive && s.gunDropped && m.gun) m.gun.visible = false;
}

export function removeSoldierModel(s) {
  if (!s.model) return;
  s.model.root.removeFromParent();
  s.model.dispose?.();
  s.model = null;
}
