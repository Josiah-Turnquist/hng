// An online battle as the browser shows it: a battle on a "server" (a headless
// battle with a player in it) sends its snapshots to a "browser" (a second one,
// emptied, with net/online.js's OnlineBattle on it), and what the browser's HUD
// reads follows the server: the player's bleeding, the vehicle he drives (its
// speed, gear and engine), his side on the maps, and the point he chose to
// deploy at.
import test from 'node:test';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { makeBattle, addPlayer } from '../src/server/battle.js';
import { snapshot, readSnapshot, roster, watchEvents, RemoteInput, encodeInput, vehicleState, applyVehicleState, ACTION_LIST, PROTOCOL_VERSION } from '../src/net/protocol.js';
import { OnlineBattle } from '../src/net/online.js';
import { Soldier } from '../src/game/soldier.js';
import { PlayerController } from '../src/game/player.js';
import { pickSpawn } from '../src/game/game.js';
import { DEFAULT_BINDINGS } from '../src/core/input.js';
import { DEFAULT_LOADOUT } from '../src/weapons/defs.js';

// The server's battle, and the browser's that shows it.
async function online({ perSide = 6, vehicles = true } = {}) {
  const srv = await makeBattle({ perSide, seed: 2, vehicles });
  const ev = watchEvents(srv);
  const pc = addPlayer(srv, { name: 'Able', faction: 'US', cls: 'infantry' });
  const cli = await makeBattle({ perSide: 1, seed: 2 });
  cli.soldiers.length = 0;
  cli.vehicles.length = 0;
  cli.mode.online = true;
  delete cli._playerDeploy; // (the game's own, as in the browser)
  const me = new Soldier(cli, { faction: 'US', cls: 'infantry', loadout: DEFAULT_LOADOUT.US.infantry, team: pc.soldier.team, name: 'Able', x: 0, z: 0 });
  me.isPlayer = true;
  cli.soldiers.push(me);
  cli.input = new RemoteInput();
  Object.assign(cli.input, { key: () => 'Space', lock() {}, unlock() {} });
  cli.player = new PlayerController(cli, me, { input: cli.input, view: false });
  cli.deploy = { t: 0, index: 0 };
  cli.online = new OnlineBattle(cli, { ws: { send() {}, readyState: 1 }, welcome: { you: pc.soldier.id }, inbox: [roster(srv)] });
  let tick = 0;
  const sent = new Map();
  let seq = 0;
  const run = (seconds, held = null) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      tick++;
      if (held && tick % 2 === 0) srv.applyInput(pc.soldier.id, encodeInput({ seq: ++seq, held, look: [pc.look.yaw, 0] }));
      srv.update(1 / 60);
      if (srv.rosterChanged) {
        srv.rosterChanged = false;
        cli.online._message(JSON.parse(JSON.stringify(roster(srv))));
      }
      if (tick % 3 === 0) cli.online._message(JSON.parse(JSON.stringify(snapshot(srv, tick, { events: ev.take(), sent, full: (tick / 3) % 40 === 0 }))));
      // (His keys held here too: the vehicle he drives is run here from them.)
      cli.input.down = new Set(held || []);
      cli.update(1 / 60);
      cli.player.frameInput(1 / 60);
      cli.input.endFrame();
    }
  };
  return { srv, cli, pc, me, run };
}

test('the map key is the last action, and the protocol says so', () => {
  assert.equal(ACTION_LIST.at(-1), 'map', 'new actions go at the end: they travel by their place in the list');
  assert.deepEqual(DEFAULT_BINDINGS.map, ['KeyM']);
  assert.ok(PROTOCOL_VERSION >= 3);
});

test('the chosen deploy point stays chosen while the list changes round it', () => {
  const opts = (...ids) => ids.map((id) => ({ id }));
  const d = { index: 0 };
  assert.equal(pickSpawn(opts('A', 'B', 'C'), d), 0);
  assert.equal(d.id, 'A');
  // He picks C; the points are sorted again (B taken, the front moved): still C.
  d.index = 2;
  d.id = 'C';
  assert.equal(pickSpawn(opts('C', 'A', 'B'), d), 0);
  assert.equal(pickSpawn(opts('B', 'D', 'A', 'C'), d), 3);
  // C can't be had for a while: another in its place, and C again once it can.
  assert.equal(pickSpawn(opts('B', 'D', 'A'), d), 2);
  assert.equal(d.id, 'C');
  assert.equal(pickSpawn(opts('B', 'C', 'A'), d), 1);
  // The lean keys: the one after, which is now his choice.
  assert.equal(pickSpawn(opts('B', 'C', 'A'), d, 1), 2);
  assert.equal(d.id, 'A');
  assert.equal(pickSpawn(opts('B', 'C', 'A'), d, 1), 0);
  assert.equal(d.id, 'B');
});

test("a vehicle's speed, engine, damage and guns go in its snapshot and back", async () => {
  const g = await makeBattle({ perSide: 6, seed: 4, vehicles: true });
  const tank = g.spawnVehicle('m4a1_sherman', 30, 30, 0);
  const jeep = g.vehicles.find((v) => !v.isBike && v.def.kind !== 'tracked');
  const bike = g.vehicles.find((v) => v.isBike && v.pedal);
  assert.ok(tank && jeep && bike);
  // A tank: running, a round fired and the next loading, the coax half used, the engine hurt.
  tank.speed = 4.37;
  tank.rpm = 1834;
  tank.gear = 3;
  tank.engineOn = true;
  tank.modules.engine = 0.4;
  tank.modules.trackL = 0;
  tank.fireMain(null);
  tank.coax.loaded = 60;
  const row = readSnapshot(JSON.parse(JSON.stringify(snapshot(g, 1)))).vehicles.find((x) => x.id === tank.id);
  const twin = g.spawnVehicle(tank.def.id, 0, 0, 0);
  g.vehicles.pop();
  applyVehicleState(twin, row.state);
  assert.equal(twin.speed, 4.4);
  assert.equal(twin.rpm, 1830);
  assert.equal(twin.gear, 3);
  assert.equal(twin.engineOn, true);
  assert.ok(twin.modules.engine > 0 && twin.modules.engine < 1, 'engine damaged');
  assert.equal(twin.modules.trackL, 0, 'track broken');
  assert.equal(twin.modules.trackR, 1);
  assert.equal(twin.loaded, null);
  assert.equal(twin.nextAmmo, tank.nextAmmo);
  assert.ok(Math.abs(twin.reloadT - tank.reloadT) < 0.06);
  assert.deepEqual(twin.stowed, tank.stowed);
  assert.equal(twin.coax.loaded, 60);
  assert.equal(twin.coax.belts, tank.coax.belts);
  // A jeep off-road, changing gear, on fire; a bicycle on its side, coasting.
  jeep.offroad = true;
  jeep.shiftTimer = 0.2;
  jeep.fire = 3;
  bike.fallen = -1;
  bike.effort = 'coast';
  bike.power = 120;
  for (const v of [jeep, bike]) {
    const t = g.spawnVehicle(v.def.id, 0, 0, 0);
    g.vehicles.pop();
    applyVehicleState(t, JSON.parse(JSON.stringify(vehicleState(v))));
    assert.equal(t.offroad, !!v.offroad);
    assert.equal(t.shiftTimer > 0, v.shiftTimer > 0);
    assert.equal(t.fire > 0, v.fire > 0);
    assert.equal(t.fallen || 0, v.fallen || 0);
    if (v.isBike) assert.deepEqual([t.effort, t.power], ['coast', 120]);
  }
  // Older snapshots without any of it still read.
  const old = readSnapshot({ t: 1, tm: 0, s: [[1, 0, 0, 0, 0, 0, 0, 9, 0, 80, 0, -1]], v: [[3, 'willys_mb', 0, 0, 0, 0, 0, 0, 10000, 0, 0, 100, 1]], p: [], e: [], a: 0 });
  assert.equal(old.vehicles[0].state, null);
  assert.equal(old.soldiers[0].bleeding, true);
  assert.equal(old.soldiers[0].bleed, 1);
});

test("online, the player's bleeding, his vehicle's speed and his side follow the server", async () => {
  const { srv, cli, pc, me, run } = await online();
  run(6);
  assert.ok(me.alive);
  // His side, as the deploy screen's and the battle map's dots draw it.
  const allies = (g, s) => g.soldiers.filter((x) => x !== s && x.alive && x.team === s.team).length;
  assert.equal(allies(cli, me), allies(srv, pc.soldier));
  assert.ok(allies(cli, me) >= 3);
  // Parked vehicles still stay out of the snapshots that needn't have them.
  const sent = new Map();
  snapshot(srv, 1, { sent });
  srv.update(1 / 60);
  assert.ok(snapshot(srv, 2, { sent, full: false }).v.length < srv.vehicles.length / 2, 'parked vehicles left out');
  // Bleeding: shown here (with how hard, for the blurred view) but not bled here.
  pc.soldier.bleed = 1.3;
  pc.soldier.health = 60;
  run(0.5);
  assert.ok(Math.abs(me.bleed - 1.3) < 0.051, `bleeding ${me.bleed}`);
  me.health = 0.5;
  cli.update(1 / 60);
  assert.ok(me.alive, 'only the server decides he bleeds out');
  pc.soldier.bleed = 0;
  run(0.2);
  assert.equal(me.bleed, 0);
  // Driving a jeep: its speed, gear and engine here as on the server.
  const jeep = srv.vehicles.find((v) => !v.isBike && v.def.kind !== 'tracked' && !v.occupants.some(Boolean));
  jeep.enter(pc.soldier, 0);
  pc.vehicleCtl.entered(jeep);
  run(4, ['forward']);
  const here = cli.online.vehicles.get(jeep.id);
  assert.equal(me.vehicle, here);
  assert.ok(jeep.speed > 3, `the jeep goes (${jeep.speed} m/s)`);
  assert.ok(Math.abs(here.speed - jeep.speed) < 1.5, `${here.speed} here, ${jeep.speed} on the server`);
  assert.equal(here.gear, jeep.gear);
  assert.ok(Math.abs(here.rpm - jeep.rpm) < 400);
});

test('online, the point he chose stays chosen as the points change, and goes to the server', async () => {
  const { srv, cli, pc, me, run } = await online({ perSide: 4, vehicles: false });
  run(2);
  pc.soldier.die({ kind: 'test' });
  run(2.5);
  assert.equal(me.alive, false);
  const opts = cli.mode.deployOptions();
  assert.ok(opts.length >= 2, `${opts.length} points to deploy at`);
  // He picks the first; then the order changes (the front moves) and it goes
  // to the end of the list: still his.
  const want = opts[0].id;
  cli.deploy.id = want;
  cli.deploy.index = 0;
  const front = cli.mode._frontScore.bind(cli.mode);
  cli.mode._frontScore = (p, team) => (p.id === want ? -5 : front(p, team));
  run(0.5);
  const now = cli.mode.deployOptions();
  assert.equal(now.at(-1).id, want);
  assert.equal(cli.deploy.index, now.length - 1);
  // A point the server closes (enemies on it) is gone from his list here too.
  const other = now[0].id;
  srv.mode.byId[other].threat[pc.soldier.team] = srv.time;
  run(0.2);
  assert.ok(!cli.mode.deployOptions().some((o) => o.id === other), 'closed as on the server');
  srv.mode.byId[other].threat[pc.soldier.team] = -99;
  run(0.2);
  assert.ok(cli.mode.deployOptions().some((o) => o.id === other), 'and open again');
  assert.equal(cli.mode.deployOptions()[cli.deploy.index].id, want);
  // Deploying (once its wait is over): his choice goes to the server, which
  // puts him there.
  cli.deploy.t = 60;
  cli.deploy.go = true;
  run(0.1);
  assert.equal(cli.online.deployAt, want);
  srv.applyInput(pc.soldier.id, encodeInput({ seq: 1e6, deploy: want }));
  for (let i = 0; i < 30 && !me.alive; i++) run(1);
  assert.ok(me.alive, 'back in');
  const p = srv.mode.byId[want];
  assert.ok(Math.hypot(me.body.x - p.x, me.body.z - p.z) < p.radius + 5, 'at the point he chose');
});

// The browser and the server a connection apart: his inputs reach the server
// `lag` steps after they go, and its snapshots reach him `lag` steps after.
async function connected({ lag = 3, seed = 2 } = {}) {
  const srv = await makeBattle({ perSide: 2, seed, vehicles: true });
  const ev = watchEvents(srv);
  const pc = addPlayer(srv, { name: 'Able', faction: 'US', cls: 'infantry' });
  const cli = await makeBattle({ perSide: 1, seed });
  cli.soldiers.length = 0;
  cli.vehicles.length = 0;
  cli.mode.online = true;
  delete cli._playerDeploy;
  const me = new Soldier(cli, { faction: 'US', cls: 'infantry', loadout: DEFAULT_LOADOUT.US.infantry, team: pc.soldier.team, name: 'Able', x: 0, z: 0 });
  me.isPlayer = true;
  cli.soldiers.push(me);
  cli.input = new RemoteInput();
  Object.assign(cli.input, { key: () => 'Space', lock() {}, unlock() {} });
  cli.player = new PlayerController(cli, me, { input: cli.input, view: false });
  cli.deploy = { t: 0, index: 0 };
  const outbox = [];
  cli.online = new OnlineBattle(cli, { ws: { send: (t) => outbox.push(t), readyState: 1 }, welcome: { you: pc.soldier.id }, inbox: [roster(srv)] });
  const toServer = [];
  const toBrowser = [];
  const sent = new Map();
  let tick = 0;
  // One step of each: the browser's frame (its step, then its keys and what it
  // sends), the server's step, and what is due to arrive at either end.
  const step = (held = []) => {
    tick++;
    cli.input.down = new Set(held);
    // (The browser's game runs 120 steps a second, the server 60.)
    cli.update(1 / 120);
    cli.update(1 / 120);
    cli.player.frameInput(1 / 60);
    cli.online.sendInput(1 / 60);
    cli.input.endFrame();
    for (const t of outbox.splice(0)) toServer.push({ at: tick + lag, m: JSON.parse(t) });
    while (toServer.length && toServer[0].at <= tick) srv.applyInput(pc.soldier.id, toServer.shift().m);
    srv.update(1 / 60);
    if (srv.rosterChanged) {
      srv.rosterChanged = false;
      toBrowser.push({ at: tick + lag, m: JSON.parse(JSON.stringify(roster(srv))) });
    }
    if (tick % 2 === 0) {
      // (With the input the server last used, as the game server adds for each player.)
      const snap = snapshot(srv, tick, { events: ev.take(), sent, full: (tick / 2) % 60 === 0 });
      snap.a = pc.input.seq;
      toBrowser.push({ at: tick + lag, m: JSON.parse(JSON.stringify(snap)) });
    }
    while (toBrowser.length && toBrowser[0].at <= tick) cli.online._message(toBrowser.shift().m);
  };
  const run = (seconds, held) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) step(held);
  };
  return { srv, cli, pc, me, step, run, tick: () => tick };
}

// Into a vehicle on the server (the browser follows), then drive it from the
// browser: forward, left, right, forward, then stop.
async function driveOnline(pick, { lag = +(process.env.LAG || 3), seconds = 4 } = {}) {
  const { srv, cli, pc, me, step, run, tick } = await connected({ lag });
  run(4);
  assert.ok(me.alive);
  const v = pick(srv, pc.soldier);
  assert.ok(v, 'a vehicle to drive');
  v.enter(pc.soldier, 0);
  pc.vehicleCtl.entered(v);
  run(3);
  const here = cli.online.vehicles.get(v.id);
  assert.equal(me.vehicle, here, 'in it here too');
  assert.equal(cli.online.driving, here, 'driven here');
  assert.equal(here.puppet, false);
  const at = (x) => x.body.position.clone();
  const from = at(here),
    srvFrom = at(v);
  let movedHere = null,
    movedThere = null;
  const offs = [];
  const driven = cli.online._driven.bind(cli.online);
  cli.online._driven = (snap) => {
    const st = snap.vehicles.find((x) => x.id === here.id);
    const h = cli.online.vhistory.find((q) => q.seq === snap.ack);
    if (st && h) offs.push(Math.hypot(st.x - h.p.x, st.z - h.p.z));
    return driven(snap);
  };
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    step(i < n * 0.4 ? ['forward'] : i < n * 0.6 ? ['forward', 'left'] : i < n * 0.8 ? ['forward', 'right'] : ['forward']);
    if (movedHere === null && at(here).distanceTo(from) > 0.2) movedHere = tick();
    if (movedThere === null && at(v).distanceTo(srvFrom) > 0.2) movedThere = tick();
  }
  offs.sort((a, b) => a - b);
  const name = v.def.id;
  if (process.env.SHOW) console.log(`${name}: moved here at ${movedHere}, there at ${movedThere}; drove ${at(v).distanceTo(srvFrom).toFixed(1)} m; apart: middle ${offs[offs.length >> 1]?.toFixed(3)} m, 90% ${offs[Math.floor(offs.length * 0.9)]?.toFixed(3)} m, worst ${offs.at(-1)?.toFixed(3)} m, of ${offs.length}`);
  assert.ok(movedHere !== null && movedThere !== null, `${name}: both went`);
  assert.ok(movedHere <= movedThere - 2, `${name}: moved here at step ${movedHere}, on the server at ${movedThere}`);
  assert.ok(at(v).distanceTo(srvFrom) > 5, `${name}: drove ${at(v).distanceTo(srvFrom).toFixed(1)} m`);
  // Here and on the server, at the same input: close, all the way (no jumps).
  assert.ok(offs.length > 40);
  assert.ok(offs.at(-1) < 1.5, `${name}: worst ${offs.at(-1).toFixed(2)} m apart, middle ${offs[offs.length >> 1].toFixed(2)} m`);
  // Stopped: in the same place, pointing the same way.
  run(4, ['back']);
  run(4);
  const heading = (x) => {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(x.body.quaternion);
    return Math.atan2(f.x, f.z);
  };
  assert.ok(at(here).distanceTo(at(v)) < 0.5, `${name}: ${at(here).distanceTo(at(v)).toFixed(2)} m apart when stopped`);
  let turn = Math.abs(heading(here) - heading(v));
  turn = Math.min(turn, Math.PI * 2 - turn);
  assert.ok(turn < 0.05, `${name}: pointing ${turn.toFixed(3)} rad apart`);
  // Out again: a puppet, placed as the server says.
  if (v.exit(pc.soldier)) pc.exitedVehicle(v);
  run(1);
  assert.equal(cli.online.driving, null);
  assert.equal(here.puppet, true);
}

test('online, the vehicle he drives answers his keys at once and agrees with the server: a jeep', async () => {
  await driveOnline((srv) => srv.vehicles.find((v) => !v.isBike && v.def.kind !== 'tracked' && !v.occupants.some(Boolean)));
});

test('online, driving here: a motorcycle, a bicycle and a tank', async () => {
  const near = (srv, s, id) => {
    const v = srv.spawnVehicle(id, s.body.x + 6, s.body.z + 6, 0);
    return v;
  };
  await driveOnline((srv) => srv.vehicles.find((v) => v.isBike && !v.pedal && !v.occupants.some(Boolean)));
  await driveOnline((srv) => srv.vehicles.find((v) => v.isBike && v.pedal && !v.occupants.some(Boolean)));
  await driveOnline((srv, s) => near(srv, s, 'm4a1_sherman'), { seconds: 6 });
});
