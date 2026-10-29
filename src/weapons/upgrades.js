// Weapon upgrades, as in the original game: each gun has five upgrade slots
// (ammunition, barrel, internal parts, sight, trigger), one upgrade in each.
// The upgrades, the ammunition and their prices are the original's
// (upgradeData.js, from its data); this file says what their numbers do here.
//
// Each upgrade multiplies some of the original's handling numbers:
//   damage, damageFar, rangeNear, rangeFar   the original's damage falloff: full
//       damage out to rangeNear, falling to damageFar at rangeFar. Here bullets
//       wound by their energy (soldier.js), and the upgrade scales that by how
//       much it changes the original's damage at that distance.
//   recoilUp, recoilRight, recoilVariance     the kick up and to the side
//   chamberTime    time between shots (the bolt's cycle, the rate of fire)
//   recoilTime     how long the kick takes to settle
//   coneAim        spread when aiming (the rifle's accuracy)
//   coneStand, coneCrouch, coneProne         spread from the hip in each stance
//   coneSettle     how fast the spread closes again after shooting (a hot barrel
//       cools that much faster or slower)
// A round of ammunition brings its own damage and falloff, its speed, and
// multiplies spread (cone) and recoil.
// A scope (a sight upgrade with a magnification) makes the gun a scoped rifle:
// its model, sight picture, magnification, reticle and range drum.
//
// Upgrades open with the gun's Specialist ribbon. The original's unlock tables
// in the data come from a later version than its upgrade list and don't match
// it, so the levels here are ours: the gun's upgrades and rounds in order of
// price, cheapest at level 0, the dearest at level 8. A gun with no Specialist
// ribbon has all of its upgrades open.
//
//   upgradesOf(gunId)                 // [{ id, slot, name, level, credits, ... }]
//   upgradeLevel(gunId, upId)         // the Specialist level that opens it
//   upgradeOpen(soldier, gunId, upId) // opened by his ribbon?
//   upgradedDef(gunId, picks)         // the weapon with picks { slot: id } fitted
//   damageScale(def, distance)        // a hit's damage multiplier at a distance
//   describe(upId)                    // what an upgrade changes, in words
import { UPGRADES, AMMO_TYPES, GUN_UPGRADES } from './upgradeData.js';
import { WEAPONS } from './defs.js';
import { ribbonInfo, ribbonLevel } from '../game/ribbons.js';

export { UPGRADES, AMMO_TYPES, GUN_UPGRADES };

export const UPGRADE_SLOTS = ['ammo', 'barrel', 'internal', 'sight', 'trigger'];
export const SLOT_NAMES = { ammo: 'Ammunition', barrel: 'Barrel', internal: 'Internal', sight: 'Sight', trigger: 'Trigger' };

// The scopes the original's upgrades put on guns: what they are, the army's
// range unit, eye relief (m), field of view and weight (est. where noted in
// scopes.js for the same scope; the Zielacht's from Zeiss hunting scopes of
// the 1930s, est.).
export const SCOPE_FAMILIES = {
  m84: { name: 'M84', unit: 'yd', eyeRelief: 0.09, fieldDeg: 6, mass: 0.3 },
  m73b1: { name: 'M73B1 (Weaver 330)', unit: 'yd', eyeRelief: 0.089, fieldDeg: 6.7, mass: 0.29 },
  unertl: { name: 'Unertl 8x', unit: 'yd', eyeRelief: 0.06, fieldDeg: 2.2, mass: 0.7 },
  zf39: { name: 'ZF 39 (Zielvier)', unit: 'm', eyeRelief: 0.085, fieldDeg: 6, mass: 0.45 },
  zf4: { name: 'ZF 4', unit: 'm', eyeRelief: 0.085, fieldDeg: 6, mass: 0.4 },
  zf41: { name: 'ZF 41', unit: 'm', eyeRelief: 0.3, fieldDeg: 7, mass: 0.2 },
  zielacht: { name: 'Zeiss Zielacht', unit: 'm', eyeRelief: 0.08, fieldDeg: 3.3, mass: 0.6 },
  pu: { name: 'PU', unit: 'm', eyeRelief: 0.072, fieldDeg: 4.5, mass: 0.27 },
  pe: { name: 'PE', unit: 'm', eyeRelief: 0.085, fieldDeg: 5.5, mass: 0.6 },
};

// How a scope sits on each gun: clipsBlocked (over the clip guide: loaded a
// round at a time), irons (the iron sights still usable beside or under it),
// the mount's weight. Bolt-action rifles fed by clips take most scopes over
// the action; the ZF 41 sits ahead of it; the Garand's go to the side, as the
// M1C's did; magazine guns load as before.
const OVER_ACTION = ['kar98k', 'm1903', 'mosin_9130'];
export function scopeMount(gun, family) {
  if (OVER_ACTION.includes(gun)) return { clipsBlocked: family !== 'zf41', irons: family === 'zf39' || family === 'zf41', mountMass: 0.2 };
  if (gun === 'm1_garand') return { clipsBlocked: false, irons: true, mountMass: 0.3 };
  return { clipsBlocked: false, irons: family === 'zf41', mountMass: 0.15 };
}

const steps = (from, to, step) => {
  const out = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(v);
  return out;
};

// The gun's upgrade entry (a scoped rifle's own, else its rifle's).
const entry = (gun) => GUN_UPGRADES[gun] || GUN_UPGRADES[WEAPONS[gun]?.base] || null;

// Everything that can go on a gun, with the level that opens it.
const listCache = new Map();
export function upgradesOf(gun) {
  if (listCache.has(gun)) return listCache.get(gun);
  const e = entry(gun);
  const out = [];
  if (e) {
    // A gun that already has its scope takes no other.
    const scoped = !!WEAPONS[gun]?.scope;
    for (const id of e.upgrades) if (!(scoped && UPGRADES[id].family)) out.push({ id, ...UPGRADES[id] });
    for (const id of e.rounds) out.push({ id, ...AMMO_TYPES[id], slot: 'ammo' });
    const order = [...out].sort((a, b) => a.credits - b.credits || a.id.localeCompare(b.id));
    for (const u of out) u.level = Math.min(8, Math.floor((order.indexOf(u) * 9) / order.length));
  }
  listCache.set(gun, out);
  return out;
}

export function upgradeLevel(gun, id) {
  return upgradesOf(gun).find((u) => u.id === id)?.level ?? null;
}

// The Specialist ribbon that opens a gun's upgrades (its rifle's, for a
// scoped rifle), or null.
export function specialistKey(gun) {
  const k = `spec:${WEAPONS[gun]?.base || gun}`;
  return ribbonInfo(k) ? k : null;
}

export function upgradeOpen(s, gun, id) {
  const lv = upgradeLevel(gun, id);
  if (lv === null) return false;
  const k = specialistKey(gun);
  return !k || ribbonLevel(s?.ribbons?.[k]).level >= lv;
}

// The original's damage at a distance for a round (damage, damageFar,
// rangeNear, rangeFar).
function hgDamage(h, d) {
  if (d <= h.rangeNear) return h.damage;
  if (d >= h.rangeFar) return h.damageFar;
  return h.damage + ((h.damageFar - h.damage) * (d - h.rangeNear)) / (h.rangeFar - h.rangeNear);
}

// A hit's damage multiplier: how much the gun's upgrades and ammunition change
// the original's damage at this distance. 1 for a stock gun.
export function damageScale(def, distance) {
  const h = def?.falloff;
  if (!h) return 1;
  return hgDamage(h.now, distance) / hgDamage(h.stock, distance);
}

// The upgrades picked for a gun, kept to those it takes: { slot: id }.
export function cleanPicks(gun, picks) {
  const out = {};
  const list = upgradesOf(gun);
  for (const slot of UPGRADE_SLOTS) {
    const id = picks?.[slot];
    if (id && list.some((u) => u.id === id && u.slot === slot)) out[slot] = id;
  }
  return out;
}

const defCache = new Map();
export function upgradedDef(gun, picks) {
  const base = WEAPONS[gun];
  if (!base) return null;
  const p = cleanPicks(gun, picks);
  const key = `${gun}|${UPGRADE_SLOTS.map((s) => p[s] || '').join('|')}`;
  if (!Object.keys(p).length) return base;
  if (defCache.has(key)) return defCache.get(key);
  const f = {};
  for (const slot of ['barrel', 'internal', 'sight', 'trigger']) {
    const u = p[slot] && UPGRADES[p[slot]];
    for (const [k, v] of Object.entries(u?.f || {})) f[k] = (f[k] ?? 1) * v;
  }
  const m = (k) => f[k] ?? 1;
  const e = entry(gun);
  const stockRound = AMMO_TYPES[e.ammo];
  const round = (p.ammo && AMMO_TYPES[p.ammo]) || stockRound;
  const w = structuredClone(base);
  w.upgrades = p;
  // Damage and its falloff, from the round and the upgrades.
  if (stockRound) {
    const fall = (r) => ({ damage: r.damage, damageFar: r.damageFar, rangeNear: r.rangeNear, rangeFar: r.rangeFar });
    const now = fall(round);
    now.damage *= m('damage');
    now.damageFar *= m('damageFar');
    now.rangeNear *= m('rangeNear');
    now.rangeFar = Math.max(now.rangeNear + 1, now.rangeFar * m('rangeFar'));
    w.falloff = { stock: fall(stockRound), now };
    w.mv = Math.round(base.mv * (round.speed / stockRound.speed));
  }
  const cone = (round.cone ?? 1) / (stockRound?.cone ?? 1),
    kick = (round.recoil ?? 1) / (stockRound?.recoil ?? 1);
  w.accuracy = base.accuracy * m('coneAim') * cone;
  w.hipStance = { stand: m('coneStand') * cone, crouch: m('coneCrouch') * cone, prone: m('coneProne') * cone };
  const r = base.recoil || { rise: 1, side: 0.3 };
  w.recoil = { ...r, rise: r.rise * m('recoilUp') * kick, side: r.side * ((m('recoilRight') + m('recoilVariance')) / 2) * kick };
  w.recoilSettle = 1 / m('recoilTime');
  w.heatSettle = m('coneSettle');
  if (w.rpm) w.rpm = Math.round(w.rpm / m('chamberTime'));
  if (w.rpmSlow) w.rpmSlow = Math.round(w.rpmSlow / m('chamberTime'));
  if (w.bolt?.cycle) w.bolt.cycle *= m('chamberTime');
  if (round !== stockRound) w.round = round.name;
  // A scope: the gun becomes a scoped rifle.
  const sc = p.sight && UPGRADES[p.sight];
  if (sc?.family && !base.scope) {
    const fam = SCOPE_FAMILIES[sc.family];
    const mount = scopeMount(gun, sc.family);
    const unit = fam.unit;
    const [from, to, step] = sc.drum;
    // The drum in the army's unit (the data's settings are in meters).
    const k = unit === 'yd' ? 1 / 0.9144 : 1;
    const ranges = steps(Math.round(from * k / 50) * 50 || 100, Math.round(to * k / 50) * 50, step);
    w.model = `${gun}+${sc.family}`;
    w.type = base.type === 'rifle' ? 'sniper' : base.type;
    w.sight = { kind: 'scope', unit, ranges, zero: ranges.includes(200) ? 200 : ranges[0] };
    w.scope = { name: `${fam.name} ${sc.mag}x`, mag: sc.mag, reticle: sc.reticle, fieldDeg: fam.fieldDeg, eyeRelief: fam.eyeRelief };
    w.irons = mount.irons ? { ...base.sight, ranges: [...base.sight.ranges] } : null;
    w.clipsBlocked = mount.clipsBlocked;
    w.mass = Math.round((base.mass + fam.mass + mount.mountMass) * 100) / 100;
    w.loadedMass = base.loadedMass + (w.mass - base.mass);
    w.hipError = base.hipError + 0.5;
  }
  defCache.set(key, w);
  return w;
}

// What an upgrade or a round changes, in words: ['+27% damage', ...].
const PCT = [
  ['damage', 'damage close in', 1],
  ['damageFar', 'damage far off', 1],
  ['rangeNear', 'full-damage range', 1],
  ['rangeFar', 'falloff range', 1],
  ['recoilUp', 'kick upward', -1],
  ['recoilRight', 'kick sideways', -1],
  ['chamberTime', 'time between shots', -1],
  ['recoilTime', 'time to settle', -1],
  ['coneAim', 'spread aimed', -1],
  ['coneStand', 'spread from the hip', -1],
  ['coneSettle', 'spread recovery', 1],
];
export function describe(gun, id) {
  const u = upgradesOf(gun).find((x) => x.id === id);
  if (!u) return [];
  const out = [];
  if (u.slot === 'ammo') {
    const stock = AMMO_TYPES[entry(gun).ammo];
    const rel = (a, b) => (b ? a / b : 1);
    const f = {
      damage: rel(u.damage, stock.damage),
      damageFar: rel(u.damageFar, stock.damageFar),
      rangeNear: rel(u.rangeNear, stock.rangeNear),
      rangeFar: rel(u.rangeFar, stock.rangeFar),
      coneAim: u.cone / stock.cone,
      recoilUp: u.recoil / stock.recoil,
    };
    if (u.speed !== stock.speed) out.push({ text: `${u.speed - stock.speed > 0 ? '+' : ''}${u.speed - stock.speed} m/s`, good: u.speed > stock.speed });
    pushPct(out, f);
    return out;
  }
  if (u.family) out.push({ text: `${u.mag}x, ${u.drum[0]} to ${u.drum[1]} m`, good: true });
  pushPct(out, u.f || {});
  return out;
}
function pushPct(out, f) {
  for (const [k, label, sign] of PCT) {
    const v = f[k];
    if (v === undefined || Math.abs(v - 1) < 0.005) continue;
    const pct = Math.round((v - 1) * 100);
    out.push({ text: `${pct > 0 ? '+' : ''}${pct}% ${label}`, good: pct * sign > 0 });
  }
}
