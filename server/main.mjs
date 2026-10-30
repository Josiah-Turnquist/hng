// The game server (docs/MULTIPLAYER.md): what Railway runs (npm start).
//
//   /         the game (index.html and its files: src/, assets/, three.js)
//   /health   "ok", for Railway's health check
//   /api/config     { online: true, protocol, devNames, progress }: the page asks, to know it can play online
//   /api/auth/...   sign-in, passed on to Neon Auth (src/server/authProxy.js)
//   /api/progress   a signed-in player's soldiers and war, saved in the database (src/server/progress.js)
//   /play     the WebSocket a player's browser plays over
//
// A player's first message says who he is and which soldier he brings:
//   { k: 'h', v: PROTOCOL_VERSION, token: <Neon Auth sign-in token>, soldier: { faction, cls, loadout } }
// The server checks the token (src/server/auth.js), puts him in the battle
// (src/server/room.js) and sends him 'w' (welcome), 'r' (who is in it) and
// then snapshots 's'; he sends inputs 'i'. 'x' is a refusal ({ k: 'x', why }),
// 'o' the battle decided. Battles start with their first player and close when
// everyone has gone, so an idle server uses nothing and Railway can put it to
// sleep. A player joins a running battle his army fights in, with a place on
// his side; else a new one opens, up to MAX_BATTLES at once.
//
// Settings (environment variables): PORT (Railway sets it),
// NEON_AUTH_BASE_URL (Neon Auth; the game's own by default), NEON_AUTH_JWKS_URL
// (its public keys; worked out from the base by default), NEON_AUTH_ISSUER (optional),
// ALLOW_DEV_NAMES=1 (sign in with just a name: your own computer only),
// DATABASE_URL (Neon's Postgres, for saved progress; without it progress
// stays in each browser),
// BATTLE_SIZE (bots and players a side, default 12), MAX_BATTLES (battles
// running at once, default 3).
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
import { progressHandler, awardStored } from '../src/server/progress.js';
import { fitLoadout } from '../src/ui/roster.js';
import { tankFor } from '../src/game/ribbons.js';
import { openProgressStore } from '../src/server/progressStore.js';
import { PROTOCOL_VERSION } from '../src/net/protocol.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
// Only the game's own files are handed out.
const PUBLIC = ['index.html', 'src', 'assets', join('node_modules', 'three')];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary' };

export function startServer({ port = Number(process.env.PORT || 8080), battleSize = Number(process.env.BATTLE_SIZE || 12), devNames = process.env.ALLOW_DEV_NAMES === '1', check = signInChecker({ allowDevNames: devNames }), authBase = NEON_AUTH_BASE_URL, databaseUrl = process.env.DATABASE_URL, maxBattles = Number(process.env.MAX_BATTLES || 3), log = console.log, store = databaseUrl ? openProgressStore(databaseUrl, { log }) : null } = {}) {
  const rooms = new Set();
  const progress = progressHandler({ store, check, log });
  const opening = new Map(); // 'GE-US' -> the battle being made

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

  // An online battle's rewards, kept with his soldiers and sent to him
  // ({ k: 'g' }: the result, or null when nothing was earned or kept).
  async function rewardPlayer({ client, userId, name, soldierId, reward }) {
    let out = null;
    if (store && reward && soldierId) {
      try {
        out = await awardStored(store, userId, name, soldierId, reward);
        if (out) log(`${name}: +${reward.xp} XP`);
      } catch (e) {
        log(`rewards not saved for ${name}: ${e.message}`);
      }
    }
    if (client.readyState === 1) client.send(JSON.stringify(out ? { k: 'g', ...out } : { k: 'g', result: null }));
  }

  // The battle a player of this army joins: a running one his army fights in,
  // not yet decided and with a place on his side (the fullest first), else a
  // new one where his army attacks (the Germans against the Americans, the
  // others against the Germans).
  async function roomFor(faction) {
    const army = ['US', 'GE', 'SU'].includes(faction) ? faction : 'US';
    const open = [...rooms].filter((r) => !r.closed && !r.g?.mode?.over && r.sideOf(army) !== null && r.playersOn(r.sideOf(army)) < r.opts.perSide);
    if (open.length) return open.sort((a, b) => b.players.size - a.players.size)[0];
    for (const [key, p] of opening) if (key.split('-').includes(army)) return p;
    if (rooms.size + opening.size >= maxBattles) throw new Error('Every battle is full right now. Try again in a few minutes.');
    const defenders = army === 'GE' ? 'US' : 'GE';
    const key = `${army}-${defenders}`;
    const p = (async () => {
      const r = new BattleRoom({ perSide: battleSize, attackers: army, defenders, send: (ws, text) => ws.readyState === 1 && ws.send(text) });
      await r.ready;
      r.onReward = rewardPlayer;
      r.onClose = () => {
        rooms.delete(r);
        log(`battle closed: ${r.opts.attackers} against ${r.opts.defenders}`);
      };
      rooms.add(r);
      log(`battle opened: ${r.opts.attackers} against ${r.opts.defenders}, ${battleSize} a side (${rooms.size} running)`);
      return r;
    })().finally(() => opening.delete(key));
    opening.set(key, p);
    return p;
  }

  const http = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/health') return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      if (url.pathname === '/api/config') return res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ online: true, protocol: PROTOCOL_VERSION, devNames, progress: !!store }));
      if (url.pathname.startsWith('/api/auth/')) {
        // (How long each sign-in step takes, in the server's log: no names or addresses.)
        const t0 = performance.now();
        const path = url.pathname.slice('/api/auth/'.length);
        await proxyAuth(req, res, path, authBase);
        return log(`sign-in ${req.method} ${path}: ${res.statusCode} in ${Math.round(performance.now() - t0)} ms`);
      }
      if (url.pathname === '/api/progress') {
        const t0 = performance.now();
        await progress(req, res);
        return log(`progress ${req.method}: ${res.statusCode} in ${Math.round(performance.now() - t0)} ms`);
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
        else if (m.k === 'l') joined.leaving(ws);
        return;
      }
      if (m.k !== 'h' || joined === false) return;
      joined = false; // (one hello)
      clearTimeout(helloTimer);
      if (m.v !== PROTOCOL_VERSION) return refuse('Please reload the page: the game has been updated');
      try {
        const who = await check(m);
        const s = m.soldier || {};
        let me = { faction: s.faction, cls: s.cls, loadout: s.loadout, tank: s.tank, soldierId: typeof s.id === 'string' ? s.id.slice(0, 64) : null };
        // Soldiers kept here: his army, class and what he may carry are the
        // kept soldier's, not what the browser says.
        if (store) {
          let row;
          try {
            row = await store.get(who.id);
          } catch (e) {
            log(`progress: ${e.message}`);
            return refuse('Your soldiers could not be loaded. Try again in a moment.');
          }
          const kept = row?.roster?.soldiers?.find((x) => x && x.id === me.soldierId);
          if (!kept) return refuse('This soldier is not saved on the server yet. Go back and try again in a moment.');
          me = { ...me, faction: kept.faction, cls: kept.cls, loadout: fitLoadout(kept, s.loadout), tank: kept.cls === 'tanker' ? tankFor(kept, s.tank) : null };
        }
        const r = await roomFor(me.faction);
        if (ws.readyState !== 1) return;
        r.join(ws, { userId: who.id, name: who.name, ...me });
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
      ok({ http, wss, port: http.address().port, room: () => [...rooms].at(-1) ?? null, rooms: () => [...rooms], close: () => new Promise((done) => { for (const r of rooms) r.close(); wss.close(); store?.close().catch(() => {}); http.close(done); }) });
    }),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
