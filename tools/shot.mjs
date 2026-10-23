// Takes screenshots of the game in a headless browser (used for testing).
// Usage: node tools/shot.mjs "<query string>" out.png [waitMs] [width] [height]
// Starts its own static server on a free port.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const [query = '', out = 'shot.png', waitMs = '4000', width = '1280', height = '720'] = process.argv.slice(2);
const port = 8000 + Math.floor(Math.random() * 900);

const server = spawn(process.execPath, ['tools/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const browser = await playwright.chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e.message}`));
const url = `http://localhost:${port}/index.html?capture=1&${query}`;
const t0 = Date.now();
await page.goto(url);
let failed = false;
page.on('pageerror', () => (failed = true));
try {
  await page.waitForFunction(() => window.__app?.game?.loop?.frame > 2 || document.querySelector('.error-box'), null, { timeout: 240000 });
} catch (e) {
  logs.push(`[timeout] game did not start: ${e.message}`);
}
// Optional scripted actions: ?script=... is evaluated in the page after load.
if (process.env.SCRIPT) {
  try {
    const r = await page.evaluate(process.env.SCRIPT);
    if (r !== undefined) logs.push(`[script] ${JSON.stringify(r)}`);
  } catch (e) {
    logs.push(`[script error] ${e.message}`);
  }
}
const loadMs = Date.now() - t0;
await page.waitForTimeout(Number(waitMs));
const stats = await page.evaluate(() => {
  const g = window.__app?.game;
  const r = window.__app?.renderer;
  return g?.loop ? { frame: g.loop.frame, fps: g.loop.fps.toFixed(1), calls: r.info.render.calls, tris: r.info.render.triangles, programs: r.info.programs?.length } : null;
});
const errBox = await page.evaluate(() => document.querySelector('.error-box')?.textContent);
if (errBox) logs.push(`[error-box] ${errBox}`);
await page.screenshot({ path: out, timeout: 180000 });
console.log(`loaded in ${loadMs} ms`, JSON.stringify(stats));
for (const l of logs) console.log(l);
await browser.close();
server.kill();
