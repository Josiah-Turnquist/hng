// A battle with no graphics, as a game server runs it (and the tests): the real
// town (terrain, village collision, navigation grid), real soldiers, bots,
// bullets and Assault rules. Seeded, so the same seed plays out the same way
// (core/math.js rand). Each battle gets its own collision world and village
// (vehicles add to the collision world as they go); only the terrain, which
// never changes, is shared between battles in one program.
//
//   const g = await makeBattle({ perSide, minutes, seed, attackers, defenders })
//   step(g, seconds)                // run it on, 60 steps a second
import * as THREE from 'three';
import { Game } from '../game/game.js';
import { generateTerrain } from '../world/terrainGen.js';
import { MAPS } from '../world/maps.js';
import { CollisionWorld, RayHit } from '../physics/collision.js';
import { Atmosphere } from '../ballistics/atmosphere.js';
import { RNG, useStream } from '../core/math.js';
import { ProjectileSystem } from '../ballistics/projectiles.js';
import { NavGrid } from '../ai/navgrid.js';
import { AssaultMode, ATT, DEF, NAMES } from '../game/modes/assault.js';
import { Soldier } from '../game/soldier.js';
import { BotBrain } from '../ai/bot.js';
import { DEFAULT_LOADOUT } from '../weapons/defs.js';
import { PlayerController } from '../game/player.js';
import { RemoteInput, decodeInput } from '../net/protocol.js';
import { RibbonTally } from '../game/ribbons.js';

// Minimal browser stand-ins for the village's canvas-painted signs and the HUD.
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^(create|measure)/.test(k) ? () => ({ addColorStop() {}, width: 10 }) : () => {}), set: (t, k, v) => ((t[k] = v), true) });
const el = () => ({ style: {}, classList: { add() {}, toggle() {}, remove() {} }, appendChild() {}, querySelector: () => el(), set innerHTML(v) {}, set textContent(v) {} });
globalThis.document ??= { createElement: (tag) => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx2d } : el()) };

let terrainCache = null;
async function buildTown() {
  const { planVillage, buildVillage } = await import('../world/village/index.js');
  const { PRESETS } = await import('../render/textures.js');
  const def = MAPS.town;
  // The ground and the village's plan (which flattens the ground under it)
  // once; the village and its collision new for every battle.
  terrainCache ??= (() => {
    const terrain = generateTerrain(def);
    const plan = planVillage(terrain, def, new RNG(def.seed * 7 + 3));
    terrain.hf.computeRange();
    return { terrain, plan };
  })();
  const { terrain, plan } = terrainCache;
  const collision = new CollisionWorld(terrain.hf);
  const textures = {
    standard(name) {
      const m = new THREE.MeshStandardMaterial();
      m.userData.texWorld = PRESETS[name]?.world ?? 1;
      return m;
    },
    // No pictures: every texture a model asks for is none.
    get: () => new Proxy({}, { get: () => null }),
  };
  const village = buildVillage(plan, { terrain, def, collision, textures });
  // Trees, hedges and bushes are solid, as in the game (no graphics here).
  const { buildVegetation } = await import('../world/vegetation.js');
  buildVegetation({ terrain, def, collision, village, plan });
  const riverData = terrain.river;
  const hf = terrain.hf;
  const waterLevelAt = (x, z) => {
    if (!riverData) return null;
    const [gx, gz] = hf.toGrid(x, z);
    const i = Math.round(gz) * hf.res + Math.round(gx);
    const d = riverData.distField.dist[i];
    if (!(d < riverData.half)) return null;
    return riverData.level[riverData.distField.nearest[i]] - 0.25;
  };
  collision.waterLevelAt = waterLevelAt;
  return { def, terrain, hf, collision, village, waterLevelAt, textures };
}

export async function makeBattle({ perSide = 8, minutes = 30, seed = 1, attackers = 'US', defenders = 'GE' } = {}) {
  const town = await buildTown();
  const world = {
    def: town.def,
    hf: town.hf,
    collision: town.collision,
    atmosphere: new Atmosphere(town.def.altitude, town.def.temperatureC),
    waterLevelAt: town.waterLevelAt,
    village: town.village,
    // Plain materials: vehicles are built from their real models (their
    // armour, hit areas and seats come from them), with nothing to draw.
    textures: town.textures,
    scene: new THREE.Scene(),
    add() {},
    shadows: { prepare() {}, setup() {} },
  };
  const nav = new NavGrid(world, { radius: town.def.playRadius + 60 });
  nav.build({ doors: town.village.doors });
  // Vehicles plan on their own grid, as in Game.load: more clearance, no
  // doorways, gentler slopes.
  const vnav = new NavGrid(world, { radius: town.def.playRadius + 60 });
  vnav.build({ doors: [], agentRadius: 1.6, maxSlopeDeg: 28 });
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    headless: true,
    world,
    mapDef: town.def,
    nav,
    vnav,
    time: 0,
    soldiers: [],
    vehicles: [],
    audio: null,
    opts: {},
    app: { params: new URLSearchParams() },
    stats: { kills: [0, 0], shots: 0 },
    seed,
    rng: new RNG(seed),
    tmpHit: new RayHit(),
  });
  useStream(g.rng);
  const noop = () => {};
  g.effects = { impact: noop, spawn: noop, muzzle: noop, explosion: noop, bulletHole: noop, flashLight: noop };
  g.hud = { flash: noop, hint: noop, hitMarker: noop, killFeed: noop, damage: noop, setDeploy: noop, root: el() };
  g.projectiles = new ProjectileSystem({ world: world.collision, atmosphere: world.atmosphere, dynamicRaycast: (...a) => g._raycastDynamic(...a) });
  g.projectiles.onImpact = (p, info) => g._onImpact(p, info);
  g.projectiles.onExpire = (p, why) => g._onExpire(p, why);
  g.projectiles.onSegment = (p, ...a) => g._botsNearMiss(p, ...a);
  g.mode = new AssaultMode(g, { attackers, defenders, playerTeam: ATT, perSide, minutes });
  // The "player" is just one more bot here.
  const ps = new Soldier(g, { faction: attackers, cls: 'infantry', loadout: DEFAULT_LOADOUT[attackers].infantry, team: ATT, name: NAMES[attackers][(perSide - 1) % NAMES[attackers].length], x: 0, z: 0 });
  ps.brain = new BotBrain(g, ps);
  g.soldiers.push(ps);
  g.player = {
    soldier: ps,
    eye: { x: 0, y: -1000, z: 0 },
    update(dt) {
      if (ps.alive) ps.brain.update(dt);
      ps.update(dt);
    },
  };
  g.mode.start();
  g.mode.spawnSoldier(ps, g.mode._spawnPoints(ATT)[0]);
  // Kills, scores and the players' ribbon tallies as in the game; the side totals too.
  g.onDeath = (s, cause) => {
    if (cause?.attacker && cause.attacker.team !== s.team) g.stats.kills[cause.attacker.team]++;
    Game.prototype.onDeath.call(g, s, cause);
  };
  g._playerDeploy = () => {
    if (!ps.alive && ps.deathTime > 12) {
      const p = g.mode._spawnPoints(ps.team)[0];
      if (p) g.mode.spawnSoldier(ps, p);
    }
    // Players back in at the point they chose, once its wait is over (and
    // after a minute at the front if they choose none).
    for (const pc of g.remotePlayers || []) {
      const s = pc.soldier;
      if (s.alive) continue;
      const p = pc.deployAt && g.mode._spawnPoints(s.team).find((q) => q.id === pc.deployAt);
      if (pc.deployAt && s.deathTime >= (p ? g.mode._spawnDelay(p, s.team) : 10)) deployPlayer(g, pc, p);
      else if (s.deathTime > 60) deployPlayer(g, pc);
    }
  };
  // A player's input message, on the step it arrives (record.js keeps them).
  g.applyInput = (id, msg) => {
    const pc = g.remotePlayers?.find((p) => p.soldier.id === id);
    const frame = decodeInput(msg);
    if (!pc || !frame || !pc.input.apply(frame)) return false;
    // (Only while down: a choice still on its way after he is back in is not kept for next time.)
    if (frame.deploy && !pc.soldier.alive) pc.deployAt = frame.deploy;
    return true;
  };
  return g;
}

// A player in the battle, driven by his input messages (net/protocol.js):
// a soldier with the player's controls and no screen. Returns his controller;
// his soldier's number is what his messages and the snapshots name him by.
// What he does is tallied for his ribbons (s.tally), and when he came in kept
// (s.joinedAt), for his rewards (game/rewards.js).
export function addPlayer(g, { faction = 'US', cls = 'infantry', loadout = null, team = ATT, name = 'Player', tank = null } = {}) {
  // A bot on his side makes room: he fights on until he falls, then is gone
  // (game/modes/assault.js). A fallen one goes first, and tank crews last.
  // (Not the battle's own stand-in "player": he always comes back.)
  const bots = g.soldiers.filter((b) => b.team === team && b.brain && !b.remote && !b.retire && b !== g.player.soldier);
  const bot = bots.find((b) => !b.alive && !b.tankCrew) || bots.find((b) => !b.tankCrew) || bots[0];
  if (bot) bot.retire = true;
  const s = new Soldier(g, { faction, cls, loadout: loadout || DEFAULT_LOADOUT[faction][cls], team, name, x: 0, z: 0 });
  s.remote = true;
  s.tankId = tank;
  s.tally = new RibbonTally();
  s.joinedAt = g.time;
  g.soldiers.push(s);
  const pc = new PlayerController(g, s, { input: new RemoteInput(), view: false });
  (g.remotePlayers ??= []).push(pc);
  deployPlayer(g, pc);
  return pc;
}

function deployPlayer(g, pc, at = null) {
  const s = pc.soldier;
  const p = at || g.mode._spawnPoints(s.team)[0];
  if (!p) return;
  pc.deployAt = null;
  g.mode.spawnSoldier(s, p);
  // (A paratrooper's every time into battle is a jump.)
  if (s.cls === 'paratrooper') s.tally?.jump();
  pc.look.yaw = s.yaw;
  pc.look.pitch = 0;
  s.current = -1;
  pc._equip(0);
  // A tank crewman comes in in his tank, as in the game.
  if (s.cls === 'tanker') {
    const v = g._deployInTank(s);
    if (v) pc.vehicleCtl.entered(v);
  }
}

export function step(g, seconds, dt = 1 / 60, onTick = null) {
  for (let t = 0; t < seconds; t += dt) {
    g.update(dt);
    if (onTick) onTick(g, t);
  }
}

export { ATT, DEF };
