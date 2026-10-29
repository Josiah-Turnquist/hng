// The medical kits and the repair wrench (weapons/items/kits.js, game/kits.js):
// their models, their definitions, treating yourself and the man in front of
// you, repairing vehicles, the Medic ribbon's tally, and a bot's use of a kit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WEAPONS, DEFAULT_LOADOUT, weaponsFor, pointsOf } from '../src/weapons/defs.js';
import { KITS, KIT_TYPES } from '../src/weapons/items/kits.js';
import { Weapon } from '../src/weapons/weapon.js';
import { buildGun } from '../src/weapons/models/index.js';
import { Soldier } from '../src/game/soldier.js';
import { RibbonTally } from '../src/game/ribbons.js';
import { useKit, healTarget, workWrench, repairTarget, healKitOf } from '../src/game/kits.js';
import { BotBrain } from '../src/ai/bot.js';
import { makeWorld, spawn } from './helpers/vehicleWorld.js';

const IDS = ['firstaid_us', 'firstaid_ge', 'firstaid_su', 'medic_us', 'medic_ge', 'medic_su', 'wrench'];
const mats = new Proxy({}, { get: (t, k) => (t[k] ??= Object.assign(new THREE.MeshStandardMaterial(), { userData: { texWorld: 0.3, lowColor: [0.1, 0.1, 0.1] } })) });
const DT = 1 / 60;

// A small battle: flat ground, the player and whoever else, a tally and a HUD
// that keeps the lines it is given.
function battle() {
  const { game } = makeWorld({ size: 256 });
  const lines = [];
  game.soldiers = [];
  game.ribbonTally = new RibbonTally();
  game.hud = { lines, killConfirm: (name, o) => lines.push(`${o.verb} ${name}`), workLine: (verb, name) => lines.push(`${verb} ${name}`), flash: (t) => lines.push(t) };
  return game;
}

function man(game, { x = 0, z = 0, team = 0, faction = 'US', loadout = ['m1_garand', null, null, null, null, null, null], player = false, name } = {}) {
  const s = new Soldier(game, { faction, cls: 'infantry', loadout, team, name, isPlayer: player, x, z });
  game.soldiers.push(s);
  if (player) game.player = { soldier: s };
  return s;
}

// Run the soldiers for t seconds, the wrench held by `holder` if given.
function run(game, t, wrench = null) {
  for (let k = 0; k < Math.round(t / DT); k++) {
    game.time += DT;
    if (wrench) workWrench(game, wrench.s, wrench.w, DT, true);
    for (const v of game.vehicles) v.step?.(DT);
    for (const s of game.soldiers) s.update(DT);
  }
}

test('kit models build at every LOD with the anchors the hands need', () => {
  for (const id of IDS) {
    for (const lod of [0, 1, 2]) {
      const g = buildGun(id, mats, { lod });
      let tris = 0;
      g.root.traverse((o) => o.isMesh && (tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3));
      assert.ok(tris > 0 && tris < [60000, 6500, 1300][lod], `${id} LOD ${lod}: ${tris} triangles`);
      for (const a of ['gripR', 'muzzle', 'support', 'work']) assert.ok(g.anchors[a], `${id} anchor ${a}`);
      assert.ok(g.meta.handheld && g.meta.picture, `${id} meta`);
    }
  }
  assert.ok(buildGun('wrench', mats).anchors.jaw, 'the wrench turns about the nut in its jaws');
});

test('kit definitions: fixed ids and points, every class and army may carry them, nobody starts with one', () => {
  assert.deepEqual(Object.keys(KITS).sort(), [...IDS].sort());
  for (const id of IDS) {
    const d = WEAPONS[id];
    assert.ok(KIT_TYPES.has(d.type) && d.slot === 'equipment', id);
    assert.deepEqual([...d.classes].sort(), ['infantry', 'paratrooper', 'recon', 'tanker'], id);
    assert.equal(pointsOf(id), id.startsWith('medic') ? 2 : 1, `${id} points`);
    assert.ok(d.info && !/—/.test(d.info) && !/—/.test(d.name), `${id} text`);
  }
  assert.equal(WEAPONS.firstaid_us.uses, 3);
  assert.equal(WEAPONS.medic_ge.uses, 6);
  for (const f of ['US', 'GE', 'SU']) {
    assert.ok(weaponsFor(f, 'tanker', 'equipment').some((w) => w.id === 'wrench'), `${f} tank crew may take the wrench`);
    assert.ok(weaponsFor(f, 'infantry', 'equipment').some((w) => w.id === `firstaid_${f.toLowerCase()}`));
    for (const kit of Object.values(DEFAULT_LOADOUT[f])) for (const id of kit) assert.ok(!KITS[id], `${f} starts with ${id}`);
  }
});

test('a kit is a weapon that never fires or reloads, counts its uses and refills at a crate', () => {
  for (const id of IDS) {
    const w = new Weapon(WEAPONS[id]);
    w.setTrigger(true);
    for (let i = 0; i < 60; i++) assert.equal(w.update(DT), 0);
    assert.equal(w.loaded, 0);
    assert.equal(w.reserveRounds, 0);
    assert.equal(w.canReload(), false);
    assert.equal(w.uses, WEAPONS[id].uses ?? null);
  }
  const game = battle();
  const s = man(game, { loadout: ['m1_garand', 'm1911a1', 'firstaid_us', 'medic_us', 'wrench', null, null] });
  assert.ok(s.body.load > 12 && Number.isFinite(s.body.load));
  s.weapons[2].uses = 0;
  s.resupply();
  assert.equal(s.weapons[2].uses, 3);
});

test('a first-aid kit heals a wounded man and stops his bleeding; its uses run out', () => {
  const game = battle();
  const s = man(game, { player: true, loadout: ['m1_garand', null, 'firstaid_ge', null, null, null, null] });
  const w = s.weapons[2];
  s.health = 30;
  s.bleed = 2;
  s.lastHitTime = game.time;
  assert.equal(useKit(game, s, w), s, 'nobody in front: on himself');
  assert.equal(s.action, 'kit');
  assert.ok(!s.canShoot, "can't shoot while treating");
  run(game, 4.2);
  assert.equal(s.action, null);
  assert.equal(s.bleed, 0, 'bleeding stopped');
  assert.ok(s.health > 66 && s.health < 72, `about +40 health: ${s.health}`);
  assert.equal(w.uses, 2);
  assert.equal(game.ribbonTally.healSelf, 1);
  assert.ok(game.hud.lines.includes('Healed yourself'));
  // Twice more, then none left.
  for (let k = 0; k < 2; k++) {
    s.health = 50;
    s.lastHitTime = game.time;
    assert.ok(useKit(game, s, w));
    run(game, 4.2);
  }
  assert.equal(w.uses, 0);
  assert.ok(Math.abs(s.health - 90) < 1e-6, `${s.health}`);
  s.health = 50;
  assert.equal(useKit(game, s, w), null, 'used up');
  assert.equal(game.ribbonTally.healSelf, 3);
  // Not wounded: nothing to do.
  const f = new Weapon(WEAPONS.firstaid_ge);
  s.health = 100;
  assert.equal(useKit(game, s, f), null);
  assert.equal(f.uses, 3);
});

test('moving before the dressing is on keeps the kit; a hit after it keeps what it gave', () => {
  const game = battle();
  const s = man(game, { player: true });
  const w = new Weapon(WEAPONS.firstaid_us);
  s.health = 40;
  s.lastHitTime = game.time;
  useKit(game, s, w);
  run(game, 0.3);
  s.intent.mz = -1; // he sets off
  run(game, 0.5);
  assert.equal(s.action, null);
  assert.equal(w.uses, 3, 'not used yet');
  s.intent.mz = 0;
  run(game, 2);
  useKit(game, s, w);
  run(game, 2.0);
  s.action = null; // knocked out of it by a hit
  run(game, 1);
  assert.equal(w.uses, 2);
  assert.ok(s.health > 50 && s.health < 70, `part of the healing: ${s.health}`);
  assert.equal(game.ribbonTally.healSelf, 1);
});

test('a medic heals the wounded teammate in front of him, not an enemy or a man out of reach', () => {
  const game = battle();
  const medic = man(game, { player: true, z: 0, loadout: ['m1_garand', null, 'medic_us', null, null, null, null] });
  const pal = man(game, { z: -1.5, name: 'Pvt. Weber' });
  const w = medic.weapons[2];
  medic.yaw = 0; // looking along -Z, at him
  pal.health = 35;
  pal.bleed = 3;
  pal.lastHitTime = game.time;
  assert.equal(healTarget(game, medic), pal);
  assert.equal(useKit(game, medic, w), pal);
  run(game, 3.2);
  assert.equal(pal.bleed, 0);
  assert.ok(pal.health > 92, `+60 from a medic pouch: ${pal.health}`);
  assert.equal(medic.health, 100);
  assert.equal(w.uses, 5);
  assert.equal(game.ribbonTally.healOther, 1);
  assert.ok(game.hud.lines.includes('Healed Pvt. Weber'));
  // Looking away, too far, or an enemy: not him.
  pal.health = 50;
  medic.yaw = Math.PI / 2;
  assert.equal(healTarget(game, medic), null);
  medic.yaw = 0;
  pal.body.z = -4;
  assert.equal(healTarget(game, medic), null);
  pal.body.z = -1.5;
  pal.team = 1;
  assert.equal(healTarget(game, medic), null);
  // He walks off during the treatment: it stops.
  pal.team = 0;
  useKit(game, medic, w);
  run(game, 1);
  pal.body.z = -5;
  run(game, 0.1);
  assert.equal(medic.action, null);
});

// A soldier 1.5 m from a vehicle's near end, looking at it.
function atVehicle(game, id) {
  const s = man(game, { player: true, z: 0, loadout: ['m1_garand', null, 'wrench', null, null, null, null] });
  const v = spawn(game, id, 0, -3.5, 0, { empty: true });
  s.yaw = 0;
  s.pitch = -0.45;
  return { s, v, w: s.weapons[2] };
}

test('the wrench repairs a damaged jeep a little at a time, and counts one repair', () => {
  const game = battle();
  const { s, v, w } = atVehicle(game, 'willys_mb');
  assert.equal(repairTarget(game, s), v);
  v.hp = v.maxHp * 0.4;
  run(game, 4, { s, w });
  const share = v.hp / v.maxHp;
  assert.ok(share > 0.58 && share < 0.62, `5% a second: ${share}`);
  assert.equal(s.action, 'repair');
  assert.ok(game.hud.lines.some((l) => /^Repairing Willys MB \d+%$/.test(l)), game.hud.lines.at(-1));
  assert.equal(game.ribbonTally.repairs, undefined, 'counted when he stops');
  workWrench(game, s, w, DT, false);
  assert.equal(s.action, null);
  assert.equal(game.ribbonTally.repairs, 1);
  // To the end: full, and one more repair.
  run(game, 10, { s, w });
  assert.equal(v.hp, v.maxHp);
  assert.ok(game.hud.lines.includes('Repaired Willys MB'));
  assert.equal(game.ribbonTally.repairs, 2);
  // A scratch (under a tenth) is no repair for the ribbon.
  v.hp = v.maxHp * 0.97;
  run(game, 2, { s, w });
  workWrench(game, s, w, DT, false);
  assert.equal(game.ribbonTally.repairs, 2);
  // Looking away, the wrench does nothing.
  v.hp = v.maxHp * 0.5;
  s.yaw = Math.PI;
  run(game, 1, { s, w });
  assert.equal(v.hp, v.maxHp * 0.5);
});

test('the wrench mends a broken tank track and tire, but not a burning vehicle', () => {
  const game = battle();
  const { s, v, w } = atVehicle(game, 'm4a1_sherman');
  v.modules.trackL = 0;
  run(game, 1, { s, w });
  assert.equal(v.modules.trackL, 0, 'a broken track takes a few seconds');
  run(game, 2.5, { s, w });
  assert.equal(v.modules.trackL, 1);
  workWrench(game, s, w, DT, false);
  assert.equal(game.ribbonTally.repairs, 1, 'a broken part is a repair');
  // Burning: nothing doing.
  v.hp = v.maxHp * 0.5;
  v.modules.trackR = 0;
  v.fire = 10;
  for (let k = 0; k < 120; k++) assert.equal(workWrench(game, s, w, DT, true), null);
  assert.equal(v.hp, v.maxHp * 0.5);
  assert.equal(v.modules.trackR, 0);
  assert.ok(game.hud.lines.some((l) => l.startsWith('Burning')), 'says why');
  // A wreck is past repair.
  v.fire = 0;
  v.destroy(null, 'test');
  assert.equal(workWrench(game, s, w, DT, true), null);
  assert.equal(game.ribbonTally.repairs, 1);
});

test('the wrench mends a flat motorcycle tire', () => {
  const game = battle();
  const { s, v, w } = atVehicle(game, 'wla');
  v.modules.tireR = 0;
  run(game, 3.5, { s, w });
  assert.equal(v.modules.tireR, 1);
});

test('a hurt bot out of the fight uses his first-aid kit on himself', () => {
  const game = battle();
  const s = man(game, { loadout: ['m1_garand', null, 'firstaid_su', null, null, null, null], faction: 'SU' });
  s.health = 40;
  s.lastHitTime = game.time;
  assert.equal(healKitOf(s), s.weapons[2]);
  const brain = { s, game, target: null, treatT: 0, lastSeen: new Map(), cover: null };
  BotBrain.prototype._startTreat.call(brain);
  assert.equal(s.action, 'kit');
  run(game, 4.2);
  assert.equal(s.weapons[2].uses, 2);
  assert.ok(s.health > 75);
  assert.equal(game.ribbonTally.healSelf, undefined, "a bot's healing is not the player's");
  // Merely scratched and bleeding: a bandage, the kit kept for worse.
  s.health = 80;
  s.bleed = 1;
  BotBrain.prototype._startTreat.call(brain);
  assert.equal(s.action, 'bandage');
});
