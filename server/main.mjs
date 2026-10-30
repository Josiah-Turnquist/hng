// The game server (docs/MULTIPLAYER.md): what Railway runs (npm start).
//
//   /         the game (index.html and its files: src/, assets/, three.js)
//   /health   "ok", for Railway's health check
//   /api/config     { online: true, protocol }: the page asks, to know it can play online
//   /api/auth/...   sign-in, passed on to Neon Auth (src/server/authProxy.js)
//   /play     the WebSocket a player's browser plays over
//
// A player's first message says who he is and which soldier he brings:
//   { k: 'h', v: PROTOCOL_VERSION, token: <Neon Auth sign-in token>, soldier: { faction, cls, loadout } }
// The server checks the token (src/server/auth.js), puts him in the battle
// (src/server/room.js) and sends him 'w' (welcome), 'r' (who is in it) and
// then snapshots 's'; he sends inputs 'i'. 'x' is a refusal ({ k: 'x', why }),
// 'o' the battle decided. One battle at a time for now; it starts with the
// first player and closes when everyone has gone, so an idle server uses
// nothing and Railway can put it to sleep.
//
// Settings (environment variables): PORT (Railway sets it),
// NEON_AUTH_BASE_URL (Neon Auth; the game's own by default), NEON_AUTH_JWKS_URL
// (its public keys; worked out from the base by default), NEON_AUTH_ISSUER (optional),
// ALLOW_DEV_NAMES=1 (sign in with just a name: your own computer only),
// BATTLE_SIZE (bots and players a side, default 12).
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { BattleRoom } from '../src/server/room.js';
import { signInChecker, NEON_AUTH_BASE_URL } from '../src/server/auth.js';
import { proxyAuth } from '../src/server/authProxy.js';
import { PROTOCOL_VERSION } from '../src/net/protocol.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
// Only the game's own files are handed out.
const PUBLIC = ['index.html', 'src', 'assets', join('node_modules', 'three')];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary' };

export function startServer({ port = Number(process.env.PORT || 8080), battleSize = Number(process.env.BATTLE_SIZE || 12), check = signInChecker(), authBase = NEON_AUTH_BASE_URL, log = console.log } = {}) {
  let room = null;
  let opening = null;

  // The game's files, read once and kept, each also squeezed (gzip): the page
  // loads hundreds of small code files, so this makes it much quicker.
  const files = new Map();
  async function fileFor(path) {
    if (files.has(path)) return files.get(path);
    const file = join(root, path);
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) return null;
    const raw = await readFile(file);
    const type = TYPES[extname(file)] || 'application/octet-stream';
    const gz = /^(text|application\/(json|javascript))/.test(type) || type.startsWith('image/svg') ? gzipSync(raw, { level: 9 }) : null;
    const f = { raw, gz, type, etag: `"${createHash('sha1').update(raw).digest('base64url').slice(0, 16)}"` };
    files.set(path, f);
    return f;
  }

  // The battle players join: the one running, or a new one.
  async function currentRoom() {
    if (room && !room.closed) return room;
    opening ??= (async () => {
      const r = new BattleRoom({ perSide: battleSize, send: (ws, text) => ws.readyState === 1 && ws.send(text) });
      await r.ready;
      r.onClose = () => {
        if (room === r) room = null;
        log('battle closed');
      };
      room = r;
      opening = null;
      log(`battle opened: ${r.opts.attackers} against ${r.opts.defenders}, ${battleSize} a side`);
      return r;
    })();
    return opening;
  }

  const http = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/health') return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      if (url.pathname === '/api/config') return res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ online: true, protocol: PROTOCOL_VERSION }));
      if (url.pathname.startsWith('/api/auth/')) {
        // (How long each sign-in step takes, in the server's log: no names or addresses.)
        const t0 = performance.now();
        const path = url.pathname.slice('/api/auth/'.length);
        await proxyAuth(req, res, path, authBase);
        return log(`sign-in ${req.method} ${path}: ${res.statusCode} in ${Math.round(performance.now() - t0)} ms`);
      }
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '') || 'index.html';
      if (!PUBLIC.some((p) => path === p || path.startsWith(p + sep) || path.startsWith(p + '/'))) return res.writeHead(404).end('Not found');
      const f = await fileFor(path);
      if (!f) return res.writeHead(404).end('Not found');
      // Squeezed when the browser takes it, and not sent again while unchanged.
      const headers = { 'Content-Type': f.type, 'Cache-Control': path === 'index.html' ? 'no-cache' : 'public, max-age=300', ETag: f.etag, Vary: 'Accept-Encoding' };
      if (req.headers['if-none-match'] === f.etag) return res.writeHead(304, headers).end();
      const gz = f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (gz) headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      res.end(gz ? f.gz : f.raw);
    } catch {
      res.writeHead(500).end('Server error');
    }
  });

  const wss = new WebSocketServer({ server: http, path: '/play', maxPayload: 16 * 1024, perMessageDeflate: { threshold: 256 } });
  wss.on('connection', (ws) => {
    let joined = null;
    const refuse = (why) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ k: 'x', why }));
      ws.close(4000, 'refused');
    };
    // Ten seconds to say who you are.
    const helloTimer = setTimeout(() => !joined && refuse('No sign-in'), 10000);
    ws.on('message', async (data) => {
      let m;
      try {
        m = JSON.parse(String(data));
      } catch {
        return refuse('Bad message');
      }
      if (joined) {
        if (m.k === 'i') joined.input(ws, m);
        return;
      }
      if (m.k !== 'h' || joined === false) return;
      joined = false; // (one hello)
      clearTimeout(helloTimer);
      if (m.v !== PROTOCOL_VERSION) return refuse('Please reload the page: the game has been updated');
      try {
        const who = await check(m);
        const r = await currentRoom();
        if (ws.readyState !== 1) return;
        const s = m.soldier || {};
        r.join(ws, { userId: who.id, name: who.name, faction: s.faction, cls: s.cls, loadout: s.loadout });
        joined = r;
        log(`${who.name} joined`);
      } catch (e) {
        refuse(e.message || 'Could not join');
      }
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (joined) joined.leave(ws);
    });
  });

  return new Promise((ok) =>
    http.listen(port, () => {
      log(`Game server on port ${http.address().port}`);
      ok({ http, wss, port: http.address().port, room: () => room, close: () => new Promise((done) => { room?.close(); wss.close(); http.close(done); }) });
    }),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
