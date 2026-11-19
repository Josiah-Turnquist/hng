// Battle rules put right after a bug sweep: grenades knocking off men and tanks,
// the server's stand-in player, winning back an access point, what the dead
// drop and get back, tank wrecks, bots' wait to come back in, and the sway's dice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, step, ATT, DEF } from '../src/server/battle.js';
import { Pickups } from '../src/game/pickups.js';
import { startThrow, grenadeOf } from '../src/game/throwing.js';
import { AMMO } from '../src/weapons/ammo.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { PlayerController } from '../src/game/player.js';
import { RemoteInput } from '../src/net/protocol.js';

// Everyone but these out of the way for good.
function only(g, keep) {
  for (const s of g.soldiers) if (!keep.includes(s)) ((s.alive = false), (s.respawnT = 1e9), (s.deathTime = 0));
}

const liveGrenades = (g) => g.projectiles.active.filter((p) => p.ammo.thrown).length;

test('a thrown grenade knocking off a man or a tank hurts nobody until it goes off', async () => {
  const g = await makeBattle({ perSide: 2, seed: 3 });
  const me = g.player.soldier;
  const foe = g.soldiers.find((s) => s.team !== me.team);
  only(g, [me, foe]);
  g.mode.spawnSoldier(foe, g.mode._spawnPoints(foe.team)[0]);
  const b = foe.body;
  const p = g.projectiles.fire({ x: b.x, y: b.y + 1.65, z: b.z + 3, vx: 0, vy: 0, vz: -15, ammo: AMMO['Mk II'], owner: me, weapon: WEAPONS.mk2_grenade });
  let knocked = 0;
  const orig = g._onImpact.bind(g);
  g._onImpact = (pp, info) => {
    if (pp === p && info.kind === 'bounce' && info.target === foe) knocked++;
    return orig(pp, info);
  };
  for (let i = 0; i < 30; i++) g.projectiles.update(1 / 60);
  assert.ok(knocked > 0, 'it did knock off him');
  assert.ok(p.alive, 'still on its fuse');
  assert.equal(foe.health, 100);
  assert.equal(foe.bleed, 0);
  // And off a tank's side.
  const sp = g.mode._spawnPoints(me.team)[0];
  const v = g.spawnVehicle('m4a1_sherman', sp.x + 40, sp.z + 40, 0);
  for (let i = 0; i < 120; i++) {
    v.step(1 / 120);
    v.syncMoved(1 / 120);
  }
  const P = v.body.position;
  const hp = v.hp;
  let onTank = 0;
  const q = g.projectiles.fire({ x: P.x + 6, y: P.y + 0.9, z: P.z, vx: -12, vy: 0, vz: 0, ammo: AMMO['Mk II'], owner: me, weapon: WEAPONS.mk2_grenade });
  g._onImpact = (pp, info) => {
    if (pp === q && info.kind === 'bounce' && info.target === v) onTank++;
    return orig(pp, info);
  };
  for (let i = 0; i < 80; i++) {
    g.time += 1 / 120;
    g.projectiles.update(1 / 120);
  }
  assert.ok(onTank > 0, 'it did knock off the tank');
  assert.ok(q.alive);
  assert.equal(v.hp, hp);
  assert.equal(v.alive, true);
});

test("on the game server the stand-in player's bot runs once a step, like the others", async () => {
  const g = await makeBattle({ perSide: 4, seed: 3 });
  const ps = g.player.soldier;
  let n = 0,
    nb = 0;
  const ou = ps.update.bind(ps);
  ps.update = (dt) => (n++, ou(dt));
  const ob = ps.brain.update.bind(ps.brain);
  ps.brain.update = (dt) => (nb++, ob(dt));
  step(g, 1);
  assert.equal(n, 60);
  assert.equal(nb, 60);
});

test('attackers on their own partly drained access point win it back', async () => {
  const g = await makeBattle({ perSide: 1, seed: 3 });
  const m = g.mode;
  const p = m.points.find((q) => q.kind === 'access');
  const s = g.player.soldier;
  only(g, [s]);
  g.player.update = () => {
    s.body.x = p.x;
    s.body.z = p.z;
    s.body.vx = s.body.vz = 0;
  };
  assert.equal(p.owner, ATT);
  assert.equal(m.capturable(p, ATT), false, 'not while fully his');
  p.c = -0.3; // (-1 attackers .. +1 defenders)
  assert.equal(m.capturable(p, ATT), true);
  step(g, 60);
  assert.ok(p.c <= -0.999, `back to the attackers (c ${p.c})`);
  assert.equal(p.owner, ATT);
});

test('killed with a cooking grenade, or in mid swing, he drops it live (with dropped guns about too)', async () => {
  const g = await makeBattle({ perSide: 1, seed: 3 });
  g.pickups = new Pickups(g);
  const s = g.player.soldier;
  only(g, [s]);
  g.player.update = (dt) => s.update(dt);
  startThrow(s, grenadeOf(s)); // held drawn back: cooking
  step(g, 1);
  assert.equal(s.throwing.phase, 'windup');
  s.die({ kind: 'test' });
  step(g, 0.05);
  assert.equal(liveGrenades(g), 1, 'the cooking one');

  const h = await makeBattle({ perSide: 1, seed: 4 });
  const t = h.player.soldier;
  only(h, [t]);
  h.player.update = (dt) => t.update(dt);
  const aim = (x) => ({ x: x.body.x, y: x.body.y + 1.5, z: x.body.z, vx: 0, vy: 5, vz: -10 });
  startThrow(t, grenadeOf(t), { aim, cook: 1 });
  for (let i = 0; i < 400 && t.throwing?.phase !== 'swing'; i++) step(h, 1 / 120, 1 / 120);
  assert.equal(t.throwing.phase, 'swing');
  const cooked = t.throwing.cook;
  t.die({ kind: 'test' });
  step(h, 1 / 60);
  const p = h.projectiles.active.find((q) => q.ammo.thrown);
  assert.ok(p, 'the one in mid swing');
  assert.ok(p.age >= cooked && p.age < cooked + 0.1, 'with the fuse it had left');
});

test('back in after dying: own gun with his badges, first aid again, no wounds, and no credit for the last life', async () => {
  const g = await makeBattle({ perSide: 2, seed: 3 });
  g.pickups = new Pickups(g);
  const s = g.player.soldier;
  s.badges = [
    { id: 'hoarder', value: 2 },
    { id: 'fastReload', value: 0.7 },
  ];
  s.weapons = s.loadout.map((id, i) => s._arm(id, i));
  const before = s.weapons[0].reserveRounds;
  const spot = g.mode._spawnPoints(s.team)[0];
  s.firstAid = 0;
  s.die({ kind: 'test' });
  g.mode.spawnSoldier(s, spot);
  assert.equal(s.weapons[0].extraReserve, 2);
  assert.equal(s.weapons[0].reloadMul, 0.7);
  assert.equal(s.weapons[0].reserveRounds, before);
  assert.equal(s.firstAid, 1);
  // Died holding an enemy's gun he picked up: his own comes back.
  s.weapons[0] = g.soldiers.find((o) => o.team !== s.team)._arm('kar98k', 0) || s.weapons[0];
  assert.equal(s.weapons[0].def.id, 'kar98k');
  // Wounded, lying down, tired, by an enemy who then lost track of him.
  const foe = g.soldiers.find((o) => o.team !== s.team);
  s.damage(5, { kind: 'bullet', attacker: foe });
  s.body.legWound = 0.8;
  s.armWound = 0.5;
  s.body.stance = s.body.targetStance = 2;
  s.body.stamina = 10;
  s.die({ kind: 'test' });
  g.mode.spawnSoldier(s, spot);
  assert.equal(s.weapons[0].def.id, s.loadout[0]);
  assert.equal(s.weapons[0].extraReserve, 2);
  assert.equal(s.body.legWound, 0);
  assert.equal(s.armWound, 0);
  assert.equal(s.body.stance, 0);
  assert.equal(s.body.stamina, 100);
  assert.equal(s.woundedBy, null);
  // A bleed later in this life is put down to nobody from the last one.
  let cause = null;
  const od = g.onDeath;
  g.onDeath = (x, c) => (x === s && (cause = c), od(x, c));
  s.bleed = 100;
  s.health = 1;
  s.update(1 / 60);
  assert.equal(s.alive, false);
  assert.equal(cause.kind, 'bleeding');
  assert.equal(cause.attacker, undefined);
  // And a crate's resupply gives back the first aid.
  s.revive();
  s.firstAid = 0;
  s.resupply();
  assert.equal(s.firstAid, 1);
});

test("a tank a crew brought in is taken away a while after it is wrecked, once nobody's in it", async () => {
  const g = await makeBattle({ perSide: 2, seed: 3 });
  step(g, 8);
  const [a, b, c] = g.soldiers.filter((s) => s.alive && s !== g.player.soldier).concat(g.player.soldier);
  only(g, [a, b, c]);
  for (const s of [a, b, c]) s.brain.update = () => {};
  const wreck = g._deployInTank(a);
  const kept = g._deployInTank(b); // empty but working
  const manned = g._deployInTank(c); // a wreck someone is still in
  assert.ok(wreck && kept && manned);
  a.die({ kind: 'test' });
  kept.exit(b);
  wreck.damage(1e9, null, 'blast');
  manned.damage(1e9, null, 'blast');
  assert.equal(wreck.alive, false);
  step(g, 5);
  assert.ok(g.vehicles.includes(wreck), 'a wreck stays a while, as cover');
  wreck.deadTime = manned.deadTime = 1000;
  if (!manned.occupants[0]) manned.occupants[0] = c;
  step(g, 1);
  assert.ok(!g.vehicles.includes(wreck), 'then it goes');
  assert.ok(g.vehicles.includes(kept), 'a working one stays');
  assert.ok(g.vehicles.includes(manned), 'not while someone is in it');
});

test('a bot waits the time of the point he comes back in at, not of the first objective', async () => {
  const g = await makeBattle({ perSide: 6, seed: 7 });
  const m = g.mode;
  const waits = [];
  const orig = m.spawnSoldier.bind(m);
  m.spawnSoldier = (s, p) => {
    if (s !== g.player.soldier && s.deaths > 0) waits.push({ waited: s.deathTime, need: m._spawnDelay(p, s.team), first: m._spawnDelay(m.points[0], s.team) });
    return orig(s, p);
  };
  step(g, 8);
  for (const s of g.soldiers) if (s !== g.player.soldier && s.alive) s.die({ kind: 'test' });
  step(g, 25);
  assert.ok(waits.length > 4, `bots came back (${waits.length})`);
  for (const w of waits) assert.ok(w.waited >= w.need && w.waited < w.need + 0.1, JSON.stringify(w));
  assert.ok(
    waits.some((w) => w.need !== w.first),
    'some came back at a point with another wait',
  );
});

test('the sway drawn on the screen does not use the battle dice', async () => {
  const g = await makeBattle({ perSide: 1, seed: 3 });
  const s = g.player.soldier;
  const pc = new PlayerController(g, s, { input: new RemoteInput(), view: false });
  s.current = 0;
  s.aiming = true;
  const was = g.rng.s;
  pc.viewmodel = {}; // (as on the player's own screen)
  for (let i = 0; i < 10; i++) pc._updateSway(1 / 60);
  assert.equal(g.rng.s, was);
  pc.viewmodel = null; // (a server keeps it in step from the battle's dice)
  pc._updateSway(1 / 60);
  assert.notEqual(g.rng.s, was);
});

test('a wrecked jeep is not put back on its spot while another vehicle stands there', async () => {
  const g = await makeBattle({ perSide: 2, vehicles: true, seed: 3 });
  step(g, 2);
  for (const s of g.soldiers) if (s.brain) s.brain.update = () => {};
  const spot = g.mode.vehicleSpots[0];
  assert.ok(spot, 'the battle has vehicles on spots');
  const old = spot.v;
  // Driven off and wrecked elsewhere, and another vehicle parked on its spot.
  old.body.position.x += 60;
  old.damage(1e9, null, 'blast');
  const other = g.spawnVehicle(spot.id, spot.x + 1, spot.z, spot.yaw);
  spot.deadT = 44;
  step(g, 4);
  assert.equal(spot.v, old, 'it waits while the spot is taken');
  assert.equal(other.alive, true, 'and the one standing there is unharmed');
  // (It drives off: taken out of the battle here, which comes to the same.)
  other.removeFromWorld();
  g.vehicles.splice(g.vehicles.indexOf(other), 1);
  step(g, 2);
  assert.notEqual(spot.v, old, 'put back once the spot is clear');
  assert.equal(spot.v.alive, true);
  assert.ok(!g.vehicles.includes(old));
});
