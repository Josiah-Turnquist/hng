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
// BOT_DIFFICULTY (easy, normal or hard; easy by default), ADMIN_EMAILS (the
// sign-in emails, comma between, that may open the admin page /admin),
// BATTLE_SIZE (bots and players a side; by default the map's own, its
// onlineSize in src/world/maps.js: 30 for the town), MAX_BATTLES (battles
// running at once, default 3), WAR_SPEED (how many times faster than real
// time the shared war runs, default 6), WAR_BATTLE_WAIT (minutes a war battle
// waits for players before it settles on its own, default 10).
//
// The shared war (src/server/warService.js) runs here too: the Generals tab
// watches it and its generals give orders over /lobby, and its battles are
// fought on /play (the hello's soldier.war: { number, id }).
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { BattleRoom } from '../src/server/room.js';
import { MAPS } from '../src/world/maps.js';
import { signInChecker, NEON_AUTH_BASE_URL } from '../src/server/auth.js';
import { proxyAuth } from '../src/server/authProxy.js';
import { progressHandler, awardStored } from '../src/server/progress.js';
import { adminHandler } from '../src/server/admin.js';
import { Social } from '../src/server/social.js';
import { Telemetry } from '../src/server/telemetry.js';
import { WarService } from '../src/server/warService.js';
import { ATT } from '../src/server/battle.js';
import { MAP } from '../src/war/warMap.js';
import { fitLoadout } from '../src/ui/roster.js';
import { tankFor } from '../src/game/ribbons.js';
import { openProgressStore } from '../src/server/progressStore.js';
import { PROTOCOL_VERSION } from '../src/net/protocol.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
// Only the game's own files are handed out.
const PUBLIC = ['index.html', 'admin.html', 'src', 'assets', join('node_modules', 'three')];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary' };

export function startServer({ port = Number(process.env.PORT || 8080), battleSize = Number(process.env.BATTLE_SIZE) || null, devNames = process.env.ALLOW_DEV_NAMES === '1', check = signInChecker({ allowDevNames: devNames }), authBase = NEON_AUTH_BASE_URL, databaseUrl = process.env.DATABASE_URL, maxBattles = Number(process.env.MAX_BATTLES || 3), admins = String(process.env.ADMIN_EMAILS || '').split(','), log = console.log, store = databaseUrl ? openProgressStore(databaseUrl, { log }) : null, warSpeed = Number(process.env.WAR_SPEED) || 6, warBattleWait = Number(process.env.WAR_BATTLE_WAIT) || 10 } = {}) {
  const rooms = new Set();
  const warRooms = new Map(); // war battle id -> its online battle (or the battle being made)
  const war = new WarService({ store, log, speed: warSpeed, battleWait: warBattleWait });
  const warReady = war.start().catch((e) => log(`war: ${e.message}`));
  const progress = progressHandler({ store, check, log });
  const admin = adminHandler({ store, check, admins, log, war });
  const social = new Social({ store, log, war });
  const telemetry = new Telemetry({ store, log });
  const telemetryRoute = telemetry.handler({ check });
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
  async function rewardPlayer({ client, userId, name, soldierId, reward, info }) {
    if (info) telemetry.record(userId, 'battle', info);
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
  // (party: the battle his party is in, if it has a place for him: that one.)
  async function roomFor(faction, party = null) {
    const army = ['US', 'GE', 'SU'].includes(faction) ? faction : 'US';
    if (party && !party.closed && !party.g?.mode?.over && party.sideOf(army) !== null && party.playersOn(party.sideOf(army)) < party.opts.perSide) return party;
    const open = [...rooms].filter((r) => !r.closed && !r.g?.mode?.over && r.sideOf(army) !== null && r.playersOn(r.sideOf(army)) < r.opts.perSide);
    if (open.length) return open.sort((a, b) => b.players.size - a.players.size)[0];
    for (const [key, p] of opening) if (key.split('-').includes(army)) return p;
    if (rooms.size + opening.size >= maxBattles) throw new Error('Every battle is full right now. Try again in a few minutes.');
    const defenders = army === 'GE' ? 'US' : 'GE';
    const key = `${army}-${defenders}`;
    const p = (async () => {
      const r = new BattleRoom({ perSide: battleSize || MAPS.town.onlineSize || 24, difficulty: process.env.BOT_DIFFICULTY || 'easy', attackers: army, defenders, send: (ws, text) => ws.readyState === 1 && ws.send(text) });
      await r.ready;
      r.onReward = rewardPlayer;
      r.onError = (e) => telemetry.record(null, 'error', { where: 'server', message: String(e?.message || e), place: String(e?.stack || '').split('\n')[1]?.trim() || '' });
      r.onClose = () => {
        rooms.delete(r);
        log(`battle closed: ${r.opts.attackers} against ${r.opts.defenders}`);
      };
      rooms.add(r);
      log(`battle opened: ${r.opts.attackers} against ${r.opts.defenders}, ${r.opts.perSide} a side (${rooms.size} running)`);
      return r;
    })().finally(() => opening.delete(key));
    opening.set(key, p);
    return p;
  }

  // The online battle for a battle of the shared war: the one open for it if
  // his side has room, else a new one (counted with the others, MAX_BATTLES).
  async function warRoomFor(faction, ask) {
    const number = Number(ask?.number);
    const id = Number(ask?.id);
    const b = war.battleFor(number, id, faction);
    const have = warRooms.get(id);
    if (have) {
      const r = await have;
      if (r.opts.war.number === number && !r.closed && !r.g?.mode?.over) {
        if (r.playersOn(r.sideOf(faction)) >= r.opts.perSide) throw new Error('Your side of that battle is full');
        return r;
      }
    }
    if (rooms.size + opening.size >= maxBattles) throw new Error('Every battle is full right now. Try again in a few minutes.');
    const p = (async () => {
      const r = new BattleRoom({ perSide: battleSize || MAPS.town.onlineSize || 24, difficulty: process.env.BOT_DIFFICULTY || 'easy', attackers: b.att, defenders: b.def, war: { number, id, point: MAP.name(b.point) }, send: (ws, text) => ws.readyState === 1 && ws.send(text) });
      await r.ready;
      // (The warfunds his heroes earn the army: 40 a man put down, 250 a point taken.)
      r.onReward = (x) => {
        if (x.info) war.heroFunds(number, x.info.army, (x.info.kills || 0) * 40 + (x.info.captures || 0) * 250);
        return rewardPlayer(x);
      };
      r.onError = (e) => telemetry.record(null, 'error', { where: 'server', message: String(e?.message || e), place: String(e?.stack || '').split('\n')[1]?.trim() || '' });
      r.onOver = (team) => war.result(number, id, team === ATT);
      r.onClose = () => {
        rooms.delete(r);
        if (warRooms.get(id) === p) warRooms.delete(id);
        if (!r.g?.mode?.over) war.closedEarly(number, id);
        log(`war battle closed: ${r.opts.war.point}`);
      };
      rooms.add(r);
      war.opened(number, id, r);
      log(`war battle opened: ${b.att} against ${b.def} at ${r.opts.war.point} (${rooms.size} running)`);
      return r;
    })();
    warRooms.set(id, p);
    p.catch(() => warRooms.get(id) === p && warRooms.delete(id));
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
        await proxyAuth(req, res, path, authBase, { log });
        return log(`sign-in ${req.method} ${path}: ${res.statusCode} in ${Math.round(performance.now() - t0)} ms`);
      }
      if (url.pathname.startsWith('/api/admin/')) return await admin(req, res, url.pathname.slice('/api/admin/'.length));
      if (url.pathname === '/api/telemetry') return await telemetryRoute(req, res);
      if (url.pathname === '/admin') return res.writeHead(302, { Location: '/admin.html' }).end();
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
      // The page and its code are checked with the server each time (an
      // unchanged file costs a short "not modified"), so a reload always gets
      // the latest game; three.js and the models may be kept a while.
      const fresh = path === 'index.html' || path === 'admin.html' || path.startsWith(`src${sep}`) || path.startsWith('src/');
      const headers = { 'Content-Type': f.type, 'Cache-Control': fresh ? 'no-cache' : 'public, max-age=300', ETag: f.etag, Vary: 'Accept-Encoding' };
      if (req.headers['if-none-match'] === f.etag) return res.writeHead(304, headers).end();
      const gz = f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (gz) headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      res.end(gz ? f.gz : f.raw);
    } catch {
      res.writeHead(500).end('Server error');
    }
  });

  // Two kinds of connection on one address: /play (a battle) and /lobby (the
  // menus: friends, party, chat).
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: { threshold: 256 } });
  const lobby = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024, perMessageDeflate: { threshold: 1024 } });
  http.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url, 'http://x').pathname;
    const to = path === '/play' ? wss : path === '/lobby' ? lobby : null;
    if (!to) return socket.destroy();
    to.handleUpgrade(req, socket, head, (ws) => to.emit('connection', ws, req));
  });
  lobby.on('connection', (ws) => {
    let who = null;
    let since = 0;
    let budget = 20; // messages in ten seconds
    const held = [];
    const refill = setInterval(() => (budget = 20), 10000);
    const helloTimer = setTimeout(() => !who && ws.close(4000, 'No sign-in'), 10000);
    ws.on('message', async (data) => {
      if (--budget < 0) return;
      let m;
      try {
        m = JSON.parse(String(data));
      } catch {
        return;
      }
      if (who) return social.message(who.id, m);
      // (Sent right after the hello, while it is being checked: kept till then.)
      if (who === false) return held.length < 10 && held.push(m);
      if (m?.k !== 'h') return;
      who = false;
      clearTimeout(helloTimer);
      try {
        const w = await check(m);
        if (ws.readyState !== 1) return;
        who = w;
        since = Date.now();
        social.join(ws, who);
        for (const x of held.splice(0)) await social.message(who.id, x);
      } catch {
        ws.close(4000, 'No sign-in');
      }
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      clearInterval(refill);
      if (who) {
        social.leave(ws, who.id);
        // (A session: from the menus opening to the page closing.)
        telemetry.record(who.id, 'session', { minutes: (Date.now() - since) / 60000 });
      }
    });
  });
  wss.on('connection', (ws) => {
    let joined = null;
    let player = null;
    // (retry: a passing trouble; the browser tries again on its own.)
    const refuse = (why, retry = false) => {
      if (ws.readyState === 1) ws.send(JSON.stringify(retry ? { k: 'x', why, retry } : { k: 'x', why }));
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
        else if (m.k === 't') joined.chat(ws, m.text, !!m.all);
        else if (m.k === 'l') joined.leaving(ws);
        return;
      }
      if (m.k !== 'h' || joined === false) return;
      joined = false; // (one hello)
      clearTimeout(helloTimer);
      // An older copy of the game in his browser: it reloads itself (reload).
      if (m.v !== PROTOCOL_VERSION) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ k: 'x', why: 'The game has been updated. Please refresh the page.', reload: true }));
        return ws.close(4000, 'refused');
      }
      try {
        const who = await check(m);
        const s = m.soldier || {};
        let me = { faction: s.faction, cls: s.cls, loadout: s.loadout, tank: s.tank, soldierId: typeof s.id === 'string' ? s.id.slice(0, 64) : null };
        // Soldiers kept here: his army, class and what he may carry are the
        // kept soldier's, not what the browser says.
        if (store) {
          // (A save on its way may land a moment after the hello: looked for again.)
          let kept = null;
          for (let i = 0; i < 3 && !kept; i++) {
            if (i) await new Promise((r) => setTimeout(r, 600));
            try {
              const row = await store.get(who.id);
              kept = row?.roster?.soldiers?.find((x) => x && x.id === me.soldierId) || null;
            } catch (e) {
              log(`progress: ${e.message}`);
            }
          }
          if (ws.readyState !== 1) return;
          if (!kept) return refuse('Your soldier could not be loaded. Try again in a moment.', true);
          me = { ...me, faction: kept.faction, cls: kept.cls, loadout: fitLoadout(kept, s.loadout), tank: kept.cls === 'tanker' ? tankFor(kept, s.tank) : null };
        }
        const r = s.war ? (await warReady, await warRoomFor(me.faction, s.war)) : await roomFor(me.faction, social.partyRoom(who.id));
        if (ws.readyState !== 1) return;
        r.join(ws, { userId: who.id, name: who.name, ...me });
        joined = r;
        player = who;
        social.inBattle(who.id, who.name, r);
        log(`${who.name} joined`);
      } catch (e) {
        refuse(e.message || 'Could not join');
      }
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (joined) joined.leave(ws);
      if (player) social.inBattle(player.id, player.name, null);
    });
  });

  return new Promise((ok) =>
    http.listen(port, () => {
      log(`Game server on port ${http.address().port}`);
      ok({ http, wss, war, warReady, port: http.address().port, room: () => [...rooms].at(-1) ?? null, rooms: () => [...rooms], finish: () => Promise.all([...rooms].map((r) => r.finish())).then(() => Promise.all([telemetry.stop(), war.stop()])), close: () => new Promise((done) => { for (const r of rooms) r.close(); telemetry.stop(); war.stop(); wss.close(); lobby.close(); store?.close().catch(() => {}); http.close(done); }) });
    }),
  );
}

// Run as the game server: when Railway stops it (a new version going up), the
// players' battles so far are kept before it goes (eight seconds at most).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  let stopping = false;
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, async () => {
      if (stopping) return;
      stopping = true;
      console.log(`${sig}: keeping the players' battles before stopping`);
      await Promise.race([server.finish(), new Promise((r) => setTimeout(r, 8000))]);
      process.exit(0);
    });
  }
}
