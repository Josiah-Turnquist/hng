// Builds the whole game into one self-contained HTML file (dist/hng.html):
// all code, three.js and styles inline. Everything else (models, textures,
// sounds) is generated in the browser, so nothing else is needed.
import { build } from 'esbuild';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const opts = { bundle: true, format: 'esm', minify: true, write: false, target: 'es2020', legalComments: 'none', absWorkingDir: root, logLevel: 'warning' };
const main = await build({ ...opts, entryPoints: ['src/main.js'] });
const worker = await build({ ...opts, entryPoints: ['src/audio/synthWorker.js'] });
const js = main.outputFiles[0].text;
const workerSrc = worker.outputFiles[0].text;
const css = readFileSync(resolve(root, 'src/ui/styles.css'), 'utf8');
// Keep "</script" out of inline code.
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HNG: WWII Combined Arms</title>
<meta name="description" content="A realistic WWII combined-arms shooter in the browser, inspired by Heroes &amp; Generals.">
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>window.__HNG_SYNTH_WORKER_SRC = ${JSON.stringify(workerSrc).replace(/</g, '\\u003c')};</script>
<script type="module">${safe(js)}</script>
</body>
</html>
`;
mkdirSync(resolve(root, 'dist'), { recursive: true });
const out = resolve(root, 'dist/hng.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1e6).toFixed(2)} MB)`);
