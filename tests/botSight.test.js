// What the bots can see and how far they fight, in the real town: thick bushes
// and hedges hide a man from them as from the player (one firing from them
// gives away only roughly where he is); with iron sights they don't open fire
// beyond about 150 m unless shot at from there, and far off their first shots
// go wide; the bot difficulty setting changes how they react and aim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, DEF } from './helpers/battle.js';
import { BotBrain, DIFFICULTY } from '../src/ai/bot.js';
import { leavesBetween, SEE_THROUGH_LEAVES } from '../src/ai/tactics.js';
import { FLAG_SIGHT, FLAG_SOLID, RayHit } from '../src/physics/collision.js';
import { Weapon } from '../src/weapons/weapon.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { RNG } from '../src/core/math.js';

const g = await makeBattle({ perSide: 2, seed: 7 });
const coll = g.world.collision;
const ground = (x, z) => g.world.hf.getHeight(x, z);
const hit = new RayHit();
const clearLine = (ax, ay, az, bx, by, bz) => {
  const dx = bx - ax,
    dy = by - ay,
    dz = bz - az;
  const l = Math.hypot(dx, dy, dz);
  return !coll.raycast(ax, ay, az, dx / l, dy / l, dz / l, l - 0.3, hit, FLAG_SIGHT, true);
};

// Nobody about but the two soldiers a test puts down; no points to make for.
g.mode.update = () => {};
g._playerDeploy = () => {};
g.mode.botGoal = () => null;
const bot = g.soldiers.find((s) => s.brain && s.team === DEF);
const foe = g.player.soldier; // stands where he's put (his brain is taken away)
foe.brain = null;
g.player.update = (dt) => foe.update(dt);
function setup(bx, bz, fx, fz, { weapon = 'kar98k', skill = 'regular' } = {}) {
  for (const s of g.soldiers) {
    s.alive = false;
    s.respawnT = 1e9;
    s.deathTime = 0;
  }
  for (const [s, x, z] of [
    [bot, bx, bz],
    [foe, fx, fz],
  ]) {
    s.alive = true;
    s.health = 1e6;
    s.bleed = 0;
    s.body.x = x;
    s.body.z = z;
    s.body.y = ground(x, z);
    s.body.vx = s.body.vz = 0;
    s.lastShotTime = -100;
  }
  bot.yaw = bot.body.yaw = Math.atan2(-(fx - bx), -(fz - bz));
  bot.weapons[0] = new Weapon(WEAPONS[weapon]);
  bot.current = 0;
  bot.brain = new BotBrain(g, bot, { skill });
  bot.brain.lookYaw = bot.yaw;
  bot.brain.coverT = 1e12; // (fights where it stands)
  return bot.brain;
}
function run(seconds, onTick) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    g.update(1 / 60);
    onTick?.();
  }
}
let shots = 0;
const fire = g.botFire.bind(g);
g.botFire = (s, w) => {
  if (s === bot) shots++;
  fire(s, w);
};

// A man standing just behind a hedge, seen across it from d m off: the sight line
// to his head clear of anything solid, through the leaves.
function hedgeCase(d) {
  for (const b of coll.boxes) {
    if (!b.dense || !(b.flags & FLAG_SOLID) || Math.min(b.hx, b.hz) > 1.2 || Math.max(b.hx, b.hz) < 6) continue;
    const thin = b.hx < b.hz ? b.ax : b.az;
    const along = b.hx < b.hz ? b.az : b.ax;
    const reach = Math.min(b.hx, b.hz);
    for (const side of [1, -1]) {
      const tx = b.cx - thin[0] * side * (reach + 0.9),
        tz = b.cz - thin[2] * side * (reach + 0.9);
      const ox = b.cx + thin[0] * side * d,
        oz = b.cz + thin[2] * side * d;
      if (!g.nav.walkable(tx, tz) || !g.nav.walkable(ox, oz)) continue;
      const ey = ground(ox, oz) + 1.64,
        hy = ground(tx, tz) + 1.6 * 0.85;
      if (!clearLine(ox, ey, oz, tx, hy, tz)) continue;
      if (leavesBetween(coll, ox, ey, oz, tx, hy, tz).dense < 0.8) continue;
      return { tx, tz, ox, oz, along };
    }
  }
  return null;
}

// An open line in the battlefield: nothing in the way of a man's head out to 320 m.
function openLine() {
  const rng = new RNG(11);
  for (let k = 0; k < 50000; k++) {
    const x = rng.range(-500, 500),
      z = rng.range(-500, 500),
      a = rng.range(0, Math.PI * 2);
    const ux = Math.cos(a),
      uz = Math.sin(a);
    if (!g.nav.walkable(x, z) || !g.nav.walkable(x + ux * 300, z + uz * 300) || Math.hypot(x + ux * 300, z + uz * 300) > 600) continue;
    const y0 = ground(x, z) + 1.64;
    let ok = true;
    for (const d of [50, 100, 200, 300, 320]) {
      const tx = x + ux * d,
        tz = z + uz * d;
      if (g.world.waterLevelAt(tx, tz) != null || !clearLine(x, y0, z, tx, ground(tx, tz) + 1.3, tz) || coll.foliageAlong(x, y0, z, tx, ground(tx, tz) + 1.3, tz) > 0) {
        ok = false;
        break;
      }
    }
    if (ok) return { x, z, ux, uz };
  }
  return null;
}

test('thick leaves hide a man from the bots beyond a few meters; firing from them gives away roughly where he is', () => {
  const c = hedgeCase(40);
  assert.ok(c, 'a hedge with open ground on both sides');
  const d = Math.hypot(c.tx - c.ox, c.tz - c.oz);
  const br = setup(c.ox, c.oz, c.tx, c.tz);
  run(6);
  assert.ok(!br.lastSeen.get(foe)?.visible, 'seen through the hedge');
  assert.ok((br.aware.get(foe) || 0) < 1 && br.target !== foe, 'picked out through the hedge');
  // He fires from behind it, once a second.
  let guess = null;
  run(6, () => {
    if (g.time - foe.lastShotTime > 1) foe.lastShotTime = g.time;
    const ls = br.lastSeen.get(foe);
    if (ls?.guess) guess = ls;
  });
  assert.ok(guess, 'his shots gave him away');
  const off = Math.hypot(guess.x - foe.body.x, guess.z - foe.body.z);
  assert.ok(off < 4 * (0.5 + 0.04 * d), `the guess is ${off.toFixed(1)} m off`);
  assert.ok(!guess.visible, 'a guess is not seeing him');
  assert.equal(br.target, foe, 'and he is the one to shoot back at');
  // He moves along the hedge and stops firing: the bot doesn't follow him.
  const at = { x: guess.x, z: guess.z };
  foe.body.x += c.along[0] * 3;
  foe.body.z += c.along[2] * 3;
  run(1.5);
  const ls = br.lastSeen.get(foe);
  assert.ok(ls && !ls.visible && Math.hypot(ls.x - at.x, ls.z - at.z) < 1e-6, 'tracked him behind the hedge');
  // Close in, leaves don't hide him.
  const near = hedgeCase(SEE_THROUGH_LEAVES - 3);
  assert.ok(near, 'a hedge to look through from close by');
  const br2 = setup(near.ox, near.oz, near.tx, near.tz);
  run(4);
  assert.ok(br2.lastSeen.get(foe)?.visible, 'a man a few meters off behind leaves is seen');
});

test('with iron sights a bot does not open fire on a man 180 m off unless he shoots at it; a scoped rifle takes him on at 250 m, its first shots wide', () => {
  const L = openLine();
  assert.ok(L, 'an open line 300 m long');
  let fx = L.x + L.ux * 180,
    fz = L.z + L.uz * 180;
  let br = setup(L.x, L.z, fx, fz);
  br.aware.set(foe, 1.5); // (he knows the man is there)
  shots = 0;
  run(12);
  assert.equal(shots, 0, 'opened fire at 180 m');
  // A bullet of his cracks past: now it answers.
  const e = { x: fx, y: ground(fx, fz) + 1.5, z: fz };
  const t = { x: L.x + 0.8, y: ground(L.x, L.z) + 1.6, z: L.z };
  const dx = t.x - e.x,
    dy = t.y - e.y,
    dz = t.z - e.z;
  const l = Math.hypot(dx, dy, dz);
  g.projectiles.fire({ x: e.x, y: e.y, z: e.z, vx: (dx / l) * 800, vy: (dy / l) * 800 + 1, vz: (dz / l) * 800, ammo: foe.weapon.ammo, owner: foe, weapon: foe.weapon.def });
  run(10);
  assert.ok(br.shotBy.has(foe), 'the crack told him who');
  assert.ok(shots > 0, 'shot back');
  // A scoped rifle takes him on at 250 m.
  fx = L.x + L.ux * 250;
  fz = L.z + L.uz * 250;
  br = setup(L.x, L.z, fx, fz, { weapon: 'kar98k_zf39' });
  br.aware.set(foe, 1.5);
  shots = 0;
  let first = null;
  run(12, () => {
    if (br.target === foe && !first) first = { ...br.bias };
  });
  assert.ok(shots > 0, 'a scoped rifle stayed silent');
  assert.ok(first, 'engaged');
  if (shots >= 3) assert.ok(Math.hypot(br.bias.yaw, br.bias.pitch) < 0.3 * Math.hypot(first.yaw, first.pitch) + 1e-9, 'the aim closed in shot by shot');
});

test('far off the first shots go wider than at 100 m', () => {
  const br = setup(0, 0, 10, 0);
  const spread = (d) => {
    let s = 0;
    for (let i = 0; i < 400; i++) {
      br._engage(d);
      s += (br.bias.pitch * d) ** 2 + (br.bias.yaw * d) ** 2;
    }
    return Math.sqrt(s / 400); // m at the target
  };
  const at100 = spread(100),
    at300 = spread(300);
  assert.ok(at100 < 0.25, `${at100.toFixed(2)} m off at 100 m`);
  assert.ok(at300 > 0.8 && at300 > 4 * at100, `${at300.toFixed(2)} m off at 300 m`);
});

test('the bot difficulty setting changes how fast the bots react and how well they aim, live', () => {
  const keep = g.settings;
  let level = 'normal';
  g.settings = { get: (k) => (k === 'botDifficulty' ? level : undefined) };
  const skillAt = (diff) => {
    level = diff;
    const br = new BotBrain(g, bot, { skill: 'regular' });
    return br.skill;
  };
  const easy = skillAt('easy'),
    normal = skillAt('normal'),
    hard = skillAt('hard');
  assert.ok(easy.reaction[0] > normal.reaction[0] && normal.reaction[0] > hard.reaction[0], 'reaction');
  assert.ok(easy.aim > normal.aim && normal.aim > hard.aim, 'aim error');
  // Normal is the bots as they were tuned before the setting.
  assert.deepEqual(normal.reaction, [0.35, 0.7]);
  assert.equal(normal.aim, 1.1);
  // The mix of veterans and recruits on a side of 24.
  const mix = (diff) => {
    level = diff;
    const n = { veteran: 0, regular: 0, recruit: 0 };
    for (let i = 0; i < 24; i++) n[new BotBrain(g, bot, { rank: (i * 0.618034 + 0.05) % 1 }).skill.level]++;
    return n;
  };
  assert.equal(mix('easy').veteran, 0);
  assert.ok(mix('hard').veteran > mix('normal').veteran && mix('normal').veteran >= 4);
  assert.ok(mix('easy').recruit > mix('normal').recruit && mix('normal').recruit > mix('hard').recruit);
  // Changed mid-battle: the bots take it up at their next look round.
  level = 'normal';
  const br = setup(0, 0, 10, 0);
  assert.equal(br.skill.aim, 1.1);
  level = 'easy';
  run(0.5);
  assert.equal(br.skill.aim, 1.1 * DIFFICULTY.easy.aim);
  g.settings = keep;
});
