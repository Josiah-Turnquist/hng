// Plays an online battle with two browsers on this computer (for testing):
// starts the game server with ALLOW_DEV_NAMES=1 (no accounts), opens two
// players, Able and Baker, chooses "Online battle" in each, has Able walk
// forward, checks that Baker sees him move, and saves a picture from each.
// Usage: node tools/online.mjs [outDir]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = process.argv[2] || '.';
const port = 9000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, ['server/main.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), ALLOW_DEV_NAMES: '1', BATTLE_SIZE: process.env.BATTLE_SIZE || '6' }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
server.stderr.on('data', (d) => process.stdout.write(`[server!] ${d}`));
await new Promise((r) => setTimeout(r, 1500));

const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let failed = false;
async function player(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() !== 'debug' && console.log(`[${name} ${m.type()}] ${m.text()}`.slice(0, 600)));
  page.on('pageerror', (e) => {
    failed = true;
    console.log(`[${name} pageerror] ${e.stack || e.message}`);
  });
  await page.goto(`http://localhost:${port}/?dev=${name}&audio=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('.fe .rm-change', { timeout: 400000 });
  await page.click('.fe .rm-change');
  await page.click('.mission-card:has-text("Online battle")');
  await page.click('.hx-win .ok');
  await page.click('.fe .ready-btn');
  return page;
}
const frames = (page) => page.evaluate(() => window.__app?.game?.loop?.frame || 0);
const started = (page) => page.waitForFunction(() => window.__app?.game?.online && window.__app.game.loop?.frame > 5, null, { timeout: 500000 });

try {
  const able = await player('Able');
  await started(able);
  const baker = await player('Baker');
  await started(baker);
  console.log('both in; frames', await frames(able), await frames(baker));
  // Who each sees.
  const seen = (page) =>
    page.evaluate(() => {
      const o = window.__app.game.online;
      return { me: o.me.id, team: o.me.team, alive: o.me.alive, puppets: o.puppets.size, players: [...o.puppets.values()].filter((s) => !/\(bot\)|^[A-Z][a-z]+ [A-Z]/.test(s.name)).map((s) => s.name), vehicles: o.vehicles.size, snaps: o.snaps.length };
    });
  console.log('Able sees', JSON.stringify(await seen(able)));
  console.log('Baker sees', JSON.stringify(await seen(baker)));
  // Able walks forward; Baker should see Able's soldier move.
  const ableId = await able.evaluate(() => window.__app.game.online.me.id);
  const where = (page, id) => page.evaluate((id) => {
    const s = window.__app.game.online.puppets.get(id);
    return s ? { x: s.body.x, z: s.body.z, alive: s.alive } : null;
  }, id);
  const own = () => able.evaluate(() => {
    const b = window.__app.game.player.soldier.body;
    return { x: b.x, z: b.z };
  });
  const before = await where(baker, ableId);
  const ownBefore = await own();
  await able.evaluate(() => {
    const i = window.__app.input;
    // (Held as if the key were down: the game's own key handling.)
    i.fakeHeld = new Set(['forward']);
    const is = i.is.bind(i);
    i.is = (a) => i.fakeHeld.has(a) || is(a);
  });
  await able.waitForTimeout(3000);
  await able.evaluate(() => window.__app.input.fakeHeld.clear());
  await able.waitForTimeout(500);
  const after = await where(baker, ableId);
  const ownAfter = await own();
  const moved = before && after ? Math.hypot(after.x - before.x, after.z - before.z) : 0;
  const ownMoved = Math.hypot(ownAfter.x - ownBefore.x, ownAfter.z - ownBefore.z);
  const gap = after ? Math.hypot(after.x - ownAfter.x, after.z - ownAfter.z) : -1;
  console.log(`Able moved ${ownMoved.toFixed(2)} m on his screen, ${moved.toFixed(2)} m on Baker's; the two places ${gap.toFixed(2)} m apart`);
  await able.screenshot({ path: join(out, 'online-able.png') });
  await baker.screenshot({ path: join(out, 'online-baker.png') });
  if (!(moved > 2 && ownMoved > 2 && gap < 1.5)) failed = true;
} catch (e) {
  failed = true;
  console.log('FAILED', e.stack || e.message);
}
await browser.close();
server.kill();
console.log(failed ? 'FAILED' : 'OK');
process.exit(failed ? 1 : 0);
