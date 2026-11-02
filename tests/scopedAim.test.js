// Through a scope, the round goes where the reticle is: on the player's own
// screen and on the game server. The gun model's own motions (its kick after
// a shot, lagging behind a turn) are hidden while looking through the scope,
// so they must not turn the round off the reticle; and online the server's
// round must leave along the line the browser showed (the player's own sway,
// his sight's setting), not along a sway of the server's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeBattle, addPlayer } from '../src/server/battle.js';
import { PlayerController } from '../src/game/player.js';
import { Soldier } from '../src/game/soldier.js';
import { encodeInput, decodeInput } from '../src/net/protocol.js';
import { TABLES, dragDecel } from '../src/ballistics/drag.js';
import { G } from '../src/core/math.js';

const loadout = (id) => [id, null, null, null, null, null, null];
const YD = 0.9144;

// A battle with no graphics, and what the player's own screen needs.
async function battle() {
  const g = await makeBattle({ perSide: 1, seed: 5 });
  g.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 3000);
  g.settings = { get: (k) => ({ fov: 90, mouseSensitivity: 1, adsSensitivity: 1, invertY: false, aimToggle: false, garandModel: 'code' })[k] };
  g.cameraMode = 'first';
  g.world.textures.get = () => ({ map: null, normalMap: null, ormMap: null, world: 1 });
  g.world.sky = { sunDir: new THREE.Vector3(0.3, 0.8, 0.2).normalize(), sun: { color: new THREE.Color(1, 1, 1), intensity: 3 } };
  g.world.shadows.updateFrustums = () => {};
  g.hud.weaponChanged = () => {};
  // The rounds fired, kept rather than flown through the town.
  g.launches = [];
  g.projectiles.fire = (o) => g.launches.push(o);
  return g;
}

// The player at his own screen, aiming (the mouse moved by mouse.dx pixels a frame).
function browserPlayer(g, id) {
  const mouse = { dx: 0 };
  const input = { remote: false, is: (a) => a === 'aim', hit: () => false, up: () => false, takeMouse: () => [mouse.dx, 0], takeWheel: () => 0, endFrame() {} };
  g.input = input;
  const s = new Soldier(g, { faction: 'US', cls: 'recon', loadout: loadout(id), team: 0, name: 'Able', x: 0, z: 0 });
  s.isPlayer = true;
  g.soldiers.push(s);
  g.mode.spawnSoldier(s, g.mode._spawnPoints(0)[0]);
  const pc = new PlayerController(g, s, { input, view: true });
  pc._scatter = () => {}; // (no scatter: the line itself is measured)
  pc.mouse = mouse;
  return pc;
}

// The line he sees along: the middle of the view (the reticle).
const sightLine = (cam) => ({ pos: cam.position.clone(), dir: new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion) });

// Fly a round to the plane square to the line of sight R m ahead: how far it
// passes above and right of the point aimed at (m).
function missAt(g, o, line, R) {
  const atm = g.world.atmosphere;
  const table = TABLES[o.ammo.drag || 'G1'];
  const p = new THREE.Vector3(o.x, o.y, o.z),
    v = new THREE.Vector3(o.vx, o.vy, o.vz),
    prev = new THREE.Vector3();
  const along = (q) => q.clone().sub(line.pos).dot(line.dir);
  const h = 0.0005;
  for (let t = 0; t < 5; t += h) {
    const d = dragDecel(table, o.ammo.bc, v.length(), atm.density, atm.speedOfSound) / v.length();
    v.x -= v.x * d * h;
    v.y -= (v.y * d + G) * h;
    v.z -= v.z * d * h;
    prev.copy(p);
    p.addScaledVector(v, h);
    if (along(p) >= R) {
      const a0 = along(prev);
      const off = prev.lerp(p, (R - a0) / (along(p) - a0)).sub(line.pos.clone().addScaledVector(line.dir, R));
      const right = new THREE.Vector3().crossVectors(line.dir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, line.dir);
      return { up: off.dot(up), right: off.dot(right) };
    }
  }
  return null;
}

test('through a scope the round goes to the reticle: a quick second shot, and a shot right after a turn', async () => {
  const g = await battle();
  // The M1C (a semi-automatic, its scope offset to the left), set at 200 yd.
  const pc = browserPlayer(g, 'm1c_m81');
  const w = pc.soldier.weapon;
  assert.equal(w.zeroRange, 200);
  const R = 200 * YD;
  const frame = () => {
    pc.frameInput(1 / 60);
    pc.update(1 / 60);
    pc.render(1 / 60);
  };
  for (let i = 0; i < 90; i++) frame();
  assert.ok(pc.scoped, 'looking through the scope');
  const shoot = () => {
    const line = sightLine(g.camera);
    g.launches.length = 0;
    pc.fire(w);
    return missAt(g, g.launches[0], line, R);
  };
  const first = shoot();
  // At its zero the round meets the reticle (the side mount's windage is set for it).
  assert.ok(Math.hypot(first.up, first.right) < 0.02, `first shot ${(first.up * 100).toFixed(1)} cm up, ${(first.right * 100).toFixed(1)} cm right`);
  // A second round 0.15 s later, the gun still kicked up from the first (it
  // was 3 m high at 100 m when it left along the kicked gun's bore).
  for (let i = 0; i < 9; i++) frame();
  const second = shoot();
  assert.ok(Math.hypot(second.up, second.right) < 0.02, `second shot ${(second.up * 100).toFixed(1)} cm up, ${(second.right * 100).toFixed(1)} cm right`);
  // A quick turn of about 7 degrees and a shot as it ends (the gun lagging behind it).
  for (let i = 0; i < 90; i++) frame();
  pc.mouse.dx = 60;
  for (let i = 0; i < 6; i++) frame();
  pc.mouse.dx = 0;
  frame();
  const turned = shoot();
  assert.ok(Math.hypot(turned.up, turned.right) < 0.02, `after a turn ${(turned.up * 100).toFixed(1)} cm up, ${(turned.right * 100).toFixed(1)} cm right`);
  // (Why: through the scope the gun is not drawn, so its motions can't be seen.)
  assert.equal(pc.viewmodel.visible, false, 'the gun is not drawn through the scope');
});

test("online: the server's round leaves along the line the browser drew, sway and sight setting and all", async () => {
  const g = await battle();
  // The browser's player, and the server's copy of him driven by the browser's messages.
  const pc = browserPlayer(g, 'm1903a4');
  const rp = addPlayer(g, { name: 'Able', faction: 'US', cls: 'recon', loadout: loadout('m1903a4') });
  rp._scatter = () => {};
  let seq = 0;
  // (As in game.js: the frame's input is sent before the frame is drawn.)
  const send = () => g.applyInput(rp.soldier.id, encodeInput({ seq: ++seq, held: ['aim'], look: [pc.look.yaw, pc.look.pitch], gun: pc.gunOffset() }));
  const frame = () => {
    pc.frameInput(1 / 60);
    pc.update(1 / 60);
    send();
    rp.frameInput(1 / 60);
    rp.update(1 / 60);
    rp.input.endFrame();
    pc.render(1 / 60);
  };
  // Breathing hard after a run: a big sway, the browser's own and the server's different.
  pc.soldier.body.breath = rp.soldier.body.breath = 1;
  for (let i = 0; i < 90; i++) frame();
  assert.ok(pc.scoped && rp.hold.aimed);
  for (const yd of [100, 200, 400]) {
    // The sight set for the range (the scope's drum, in yards).
    while (pc.soldier.weapon.zeroRange !== yd) pc.soldier.weapon.changeZero(Math.sign(yd - pc.soldier.weapon.zeroRange));
    pc.viewmodel.setZero(pc.soldier.weapon.zeroIndex);
    for (let i = 0; i < 30; i++) frame();
    pc.frameInput(1 / 60);
    send();
    rp.frameInput(1 / 60);
    pc.render(1 / 60);
    // What the browser shows, from his eye and look; the same line on the server's copy of him.
    const line = sightLine(g.camera);
    const yaw = Math.atan2(-line.dir.x, -line.dir.z) - pc.look.yaw + rp.look.yaw,
      pitch = Math.asin(line.dir.y) - pc.look.pitch + rp.look.pitch;
    const onServer = {
      pos: line.pos.clone().sub(pc.eye).applyAxisAngle(new THREE.Vector3(0, 1, 0), rp.look.yaw - pc.look.yaw).add(rp.eye),
      dir: new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)),
    };
    g.launches.length = 0;
    pc.fire(pc.soldier.weapon);
    rp.fire(rp.soldier.weapon);
    const R = yd * YD;
    const drawn = missAt(g, g.launches[0], line, R);
    const real = missAt(g, g.launches[1], onServer, R);
    // At the range the sight is set for, both meet the reticle.
    assert.ok(Math.hypot(drawn.up, drawn.right) < 0.03, `${yd} yd, drawn: ${(drawn.up * 100).toFixed(1)} cm up, ${(drawn.right * 100).toFixed(1)} cm right`);
    assert.ok(Math.hypot(real.up, real.right) < 0.03, `${yd} yd, server: ${(real.up * 100).toFixed(1)} cm up, ${(real.right * 100).toFixed(1)} cm right`);
    pc.look.pitch = rp.look.pitch = 0;
  }
});

test("the gun's line in an input message: kept to a believable one", () => {
  const sent = [0.0123, -0.0045, 0.05, -0.061, -0.82];
  const got = decodeInput(encodeInput({ seq: 1, look: [1, 0], gun: sent })).gun;
  for (let i = 0; i < 5; i++) assert.ok(Math.abs(got[i] - sent[i]) < (i < 2 ? 1e-5 : 1e-3), `${i}: ${got[i]}`);
  assert.equal(decodeInput(encodeInput({ seq: 1, look: [1, 0] })).gun, null, 'none sent: none');
  assert.equal(decodeInput(encodeInput({ seq: 1, look: [1, 0], gun: [0.5, 0, 0, 0, -0.8] })).gun, null, 'far off the look');
  assert.equal(decodeInput(encodeInput({ seq: 1, look: [1, 0], gun: [0, 0, 0, 0, -3] })).gun, null, 'a muzzle out of reach');
  assert.equal(decodeInput({ k: 'i', q: 1, h: [], p: [], l: [0, 0], g: ['x', 0, 0, 0, 0] }).gun, null);
});
