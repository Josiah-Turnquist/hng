// Screenshot any page in the repo with a headless browser: node tools/page.mjs debug/textures.html?x out.png
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const [path, out = 'page.png', w = '1280', h = '800'] = process.argv.slice(2);
const port = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, ['tools/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('console', (m) => console.log(`[${m.type()}] ${m.text()}`.slice(0, 2000)));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.stack || e.message}`));
await page.goto(`http://localhost:${port}/${path}`);
try { await page.waitForFunction(() => window.__done === true, null, { timeout: 240000 }); } catch (e) { console.log('timeout', e.message); }
await page.screenshot({ path: out, fullPage: true });
await browser.close();
server.kill();
