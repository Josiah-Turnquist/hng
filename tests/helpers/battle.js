// A headless battle for tests and tuning: the real town (terrain, village
// collision, navigation grid), real soldiers, bots, bullets and Assault rules,
// with no graphics.
import * as THREE from 'three';
import { Game } from '../../src/game/game.js';
import { generateTerrain } from '../../src/world/terrainGen.js';
import { MAPS } from '../../src/world/maps.js';
import { CollisionWorld } from '../../src/physics/collision.js';
import { Atmosphere } from '../../src/ballistics/atmosphere.js';
import { RNG } from '../../src/core/math.js';
import { ProjectileSystem } from '../../src/ballistics/projectiles.js';
import { NavGrid } from '../../src/ai/navgrid.js';
import { AssaultMode, ATT, DEF } from '../../src/game/modes/assault.js';
import { Soldier } from '../../src/game/soldier.js';
import { BotBrain } from '../../src/ai/bot.js';
import { DEFAULT_LOADOUT } from '../../src/weapons/defs.js';

// Minimal browser stand-ins for the village's canvas-painted signs and the HUD.
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^(create|measure)/.test(k) ? () => ({ addColorStop() {}, width: 10 }) : () => {}), set: (t, k, v) => ((t[k] = v), true) });
const el = () => ({ style: {}, classList: { add() {}, toggle() {}, remove() {} }, appendChild() {}, querySelector: () => el(), set innerHTML(v) {}, set textContent(v) {} });
globalThis.document ??= { createElement: (tag) => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx2d } : el()) };

let cached = null;
async function buildTown() {
  if (cached) return cached;
  const { planVillage, buildVillage } = await import('../../src/world/village/index.js');
  const { PRESETS } = await import('../../src/render/textures.js');
  const def = MAPS.town;
  const terrain = generateTerrain(def);
  const plan = planVillage(terrain, def, new RNG(def.seed * 7 + 3));
  terrain.hf.computeRange();
  const collision = new CollisionWorld(terrain.hf);
  const textures = {
    standard(name) {
      const m = new THREE.MeshStandardMaterial();
      m.userData.texWorld = PRESETS[name]?.world ?? 1;
      return m;
    },
    get: () => ({}),
  };
  const village = buildVillage(plan, { terrain, def, collision, textures });
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
  cached = { def, terrain, hf, collision, village, waterLevelAt };
  return cached;
}

export async function makeBattle({ perSide = 8, minutes = 30, seed = 1 } = {}) {
  const town = await buildTown();
  const world = {
    def: town.def,
    hf: town.hf,
    collision: town.collision,
    atmosphere: new Atmosphere(town.def.altitude, town.def.temperatureC),
    waterLevelAt: town.waterLevelAt,
    village: town.village,
    scene: new THREE.Scene(),
    add() {},
    shadows: { prepare() {}, setup() {} },
  };
  const nav = new NavGrid(world, { radius: town.def.playRadius + 60 });
  nav.build({ doors: town.village.doors });
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    headless: true,
    world,
    mapDef: town.def,
    nav,
    time: 0,
    soldiers: [],
    vehicles: [],
    audio: null,
    opts: {},
    app: { params: new URLSearchParams() },
    stats: { kills: [0, 0], shots: 0 },
  });
  const noop = () => {};
  g.effects = { impact: noop, spawn: noop, muzzle: noop, explosion: noop, bulletHole: noop, flashLight: noop };
  g.hud = { flash: noop, hint: noop, hitMarker: noop, killFeed: noop, damage: noop, setDeploy: noop, root: el() };
  g.projectiles = new ProjectileSystem({ world: world.collision, atmosphere: world.atmosphere, dynamicRaycast: (...a) => g._raycastDynamic(...a) });
  g.projectiles.onImpact = (p, info) => g._onImpact(p, info);
  g.projectiles.onExpire = (p, why) => g._onExpire(p, why);
  g.projectiles.onSegment = (p, ...a) => g._botsNearMiss(p, ...a);
  g.mode = new AssaultMode(g, { attackers: 'US', defenders: 'GE', playerTeam: ATT, perSide, minutes });
  // The "player" is just one more bot here.
  const ps = new Soldier(g, { faction: 'US', cls: 'infantry', loadout: DEFAULT_LOADOUT.US.infantry, team: ATT, name: 'P', x: 0, z: 0 });
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
  g.onDeath = (s, cause) => {
    if (cause?.attacker && cause.attacker.team !== s.team) g.stats.kills[cause.attacker.team]++;
  };
  g._playerDeploy = () => {
    if (!ps.alive && ps.deathTime > 12) {
      const p = g.mode._spawnPoints(ps.team)[0];
      if (p) g.mode.spawnSoldier(ps, p);
    }
  };
  return g;
}

export function step(g, seconds, dt = 1 / 60, onTick = null) {
  for (let t = 0; t < seconds; t += dt) {
    g.update(dt);
    if (onTick) onTick(g, t);
  }
}

export { ATT, DEF };
