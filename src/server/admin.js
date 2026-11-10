// /api/admin on the game server, for the game's admins (made admins in the
// Neon Console: Auth, Users, "Make admin"; or listed in ADMIN_EMAILS, their
// sign-in emails, or for tests their ids): look players up and change what
// they have, as the admin page (admin.html) does. Everyone else gets 403.
//
//   GET  /api/admin/recent           -> { players: [{ id, name, now, at, minutes, tz, total, sessions }] }
//     who last had the game open, the latest first: those in it now (now:
//     true, minutes so far), then the rest (at: when they left, minutes: how
//     long that visit was); tz: the time zone of his computer, which is all
//     the game knows of where he is; total, sessions: over the days kept
//   GET  /api/admin/player?id=       -> { player } (one, as below)
//   GET  /api/admin/players?q=name   -> { players: [{ id, name, updated, credits, soldiers: [...] }] }
//   POST /api/admin/change  { id, what, value, soldier? }  -> { player }
//     what: 'credits' (value: how many), 'rank' (value 0-22; soldier: one, or
//     all), 'ribbons' (every ribbon at its top level), 'specialists' (every
//     gun's specialist ribbon at its top level)
//
//   GET  /api/admin/generals         -> { generals: [{ id, army, name, seen, watching }], war: { number, day, over } }
//   POST /api/admin/general { id, army }   -> the same (army null: no longer a general)
//   POST /api/admin/war { act: 'restart' } -> the same, with a new war begun
//
// A change bumps the saved revision, so a game open for that player takes the
// new copy on its next save (net/progress.js). Each change goes to the log.
import { RANK_XP, rankOf } from '../ui/roster.js';
import { RIBBONS, RIBBON_XP, ribbonInfo } from '../game/ribbons.js';
import { WEAPONS } from '../weapons/defs.js';

const TOP = RIBBON_XP[RIBBON_XP.length - 1];
const MAX_BODY = 16 * 1024;

export function adminHandler({ store, check, admins = [], log = console.log, war = null, playing = () => [] }) {
  const allowed = new Set(admins.map((a) => String(a).trim().toLowerCase()).filter(Boolean));
  // An admin: made one in the Neon Console (Auth, Users, "Make admin"), which
  // his sign-in or Neon Auth's record of him in the database says, or listed
  // in ADMIN_EMAILS. (The database is asked at most every half minute a user.)
  const hasAdmin = (role) => String(role || '').split(',').some((r) => r.trim().toLowerCase() === 'admin');
  const asked = new Map(); // user id -> { admin, at }
  async function isAdmin(who) {
    if (allowed.has(String(who.email || '').toLowerCase()) || allowed.has(String(who.id).toLowerCase())) return true;
    if (hasAdmin(who.role)) return true;
    if (!store?.authRole) return false;
    const was = asked.get(who.id);
    if (was && Date.now() - was.at < 30000) return was.admin;
    const admin = hasAdmin(await store.authRole(who.id));
    asked.set(who.id, { admin, at: Date.now() });
    return admin;
  }
  return async function handle(req, res, path) {
    const send = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
    let who;
    try {
      const auth = String(req.headers.authorization || '');
      who = await check({ token: auth.startsWith('Bearer ') ? auth.slice(7) : null, dev: req.headers['x-dev-name'] || null });
    } catch {
      return send(401, { error: 'Please sign in' });
    }
    if (!(await isAdmin(who))) return send(403, { error: 'Not an admin' });
    if (!store) return send(503, { error: 'Saving on the server is not set up' });
    try {
      if (req.method === 'GET' && path === 'stats') {
        if (!store.stats) return send(503, { error: 'No stats here' });
        const days = Number(new URL(req.url, 'http://x').searchParams.get('days')) || 7;
        return send(200, await store.stats(days));
      }
      // --- The shared war: its generals ---
      const warInfo = () => ({ generals: war.list(), war: war.war ? { number: war.war.number, t: war.war.t, over: war.war.over?.winner ?? null, humans: war.war.humans ?? [] } : null });
      if (path === 'generals' || path === 'general' || path === 'war') {
        if (!war) return send(503, { error: 'This server runs no war' });
        if (req.method === 'GET' && path === 'generals') return send(200, warInfo());
        let body;
        try {
          body = JSON.parse((await readBody(req)) ?? '');
        } catch {
          return send(400, { error: 'Not JSON' });
        }
        if (req.method === 'POST' && path === 'general') {
          if (typeof body?.id !== 'string' || !body.id) return send(400, { error: 'Which player?' });
          const army = body.army || null;
          if (army && !['US', 'GE', 'SU'].includes(army)) return send(400, { error: 'No such army' });
          const kept = await store.get(body.id);
          if (!kept) return send(400, { error: 'No such player' });
          await war.setGeneral(body.id, army, kept.name || '');
          log(`admin ${who.name}: ${kept.name} ${army ? `made general of ${army}` : 'no longer a general'}`);
          return send(200, warInfo());
        }
        if (req.method === 'POST' && path === 'war' && body?.act === 'restart') {
          await war.restart();
          log(`admin ${who.name}: started a new war`);
          return send(200, warInfo());
        }
        return send(404, { error: 'No such thing' });
      }
      if (req.method === 'GET' && path === 'recent') {
        const kept = store.recent ? await store.recent(40) : [];
        const past = new Map(kept.map((r) => [r.user_id, r]));
        // Those in the game now come first (a player with two tabs open, once:
        // by his earlier one).
        const here = new Map();
        for (const p of playing()) if (!here.has(p.id) || p.since < here.get(p.id).since) here.set(p.id, p);
        const now = Date.now();
        const rows = [...here.values()]
          .sort((a, b) => b.since - a.since)
          .map((p) => {
            const was = past.get(p.id);
            const minutes = (now - p.since) / 60000;
            return { id: p.id, name: was?.name || p.name, now: true, at: new Date(p.since).toISOString(), minutes: Math.round(minutes * 10) / 10, tz: p.tz || was?.tz || null, total: Math.round((was?.total || 0) + minutes), sessions: (was?.sessions || 0) + 1 };
          });
        for (const r of kept) if (!here.has(r.user_id)) rows.push({ id: r.user_id, name: r.name || '', now: false, at: r.at, minutes: r.minutes, tz: r.tz || null, total: r.total, sessions: r.sessions });
        return send(200, { players: rows.slice(0, 40) });
      }
      if (req.method === 'GET' && path === 'player') {
        const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
        const kept = id ? await store.get(id) : null;
        if (!kept) return send(404, { error: 'No such player' });
        return send(200, { player: summary({ user_id: id, name: kept.name, roster: kept.roster, updated_at: kept.updated_at ?? null }) });
      }
      if (req.method === 'GET' && path === 'players') {
        const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
        const rows = await store.list(q.slice(0, 40));
        return send(200, { players: rows.map(summary) });
      }
      if (req.method === 'POST' && path === 'change') {
        let body;
        try {
          body = JSON.parse((await readBody(req)) ?? '');
        } catch {
          return send(400, { error: 'Not JSON' });
        }
        const out = await change(store, body);
        if (out.error) return send(400, out);
        log(`admin ${who.name}: ${body.what} ${body.value ?? ''} for ${out.player.name}${body.soldier ? ` (soldier ${body.soldier})` : ''}`);
        return send(200, out);
      }
      return send(404, { error: 'No such thing' });
    } catch (e) {
      log(`admin: ${e.message}`);
      return send(503, { error: 'The database could not be reached' });
    }
  };
}

// A player as the admin page shows him.
function summary(row) {
  const r = row.roster || {};
  return {
    id: row.user_id,
    name: row.name,
    updated: row.updated_at,
    credits: r.credits || 0,
    soldiers: (r.soldiers || []).filter(Boolean).map((s) => ({ id: s.id, name: s.name, faction: s.faction, cls: s.cls, xp: s.xp || 0, rank: rankOf(s.xp || 0).rank })),
  };
}

// The change asked for, made to the kept roster (read again if the player
// saved meanwhile).
async function change(store, { id, what, value, soldier = null } = {}) {
  if (typeof id !== 'string' || !id) return { error: 'Which player?' };
  for (let i = 0; i < 4; i++) {
    const kept = await store.get(id);
    if (!kept?.roster) return { error: 'No such player' };
    const roster = structuredClone(kept.roster);
    const soldiers = (roster.soldiers || []).filter((s) => s && (!soldier || s.id === soldier));
    if (soldier && !soldiers.length) return { error: 'No such soldier' };
    if (what === 'credits') {
      const n = Math.floor(Number(value));
      if (!Number.isFinite(n) || n < 0 || n > 1e9) return { error: 'Credits: a number from 0 to 1,000,000,000' };
      roster.credits = n;
    } else if (what === 'rank') {
      const rank = Math.floor(Number(value));
      if (!(rank >= 0 && rank < RANK_XP.length)) return { error: `Rank: 0 to ${RANK_XP.length - 1}` };
      for (const s of soldiers) s.xp = RANK_XP[rank];
    } else if (what === 'ribbons') {
      for (const s of soldiers) s.ribbons = { ...(s.ribbons || {}), ...Object.fromEntries(Object.keys(RIBBONS).map((k) => [k, TOP])) };
    } else if (what === 'specialists') {
      const keys = [...new Set(Object.keys(WEAPONS).map((w) => `spec:${WEAPONS[w].base || w}`).filter((k) => ribbonInfo(k)))];
      for (const s of soldiers) s.ribbons = { ...(s.ribbons || {}), ...Object.fromEntries(keys.map((k) => [k, TOP])) };
    } else return { error: 'Unknown change' };
    const name = kept.name ?? '';
    const put = await store.put(id, name, { roster }, kept.rev);
    if (!put.conflict) return { player: summary({ user_id: id, name, roster, updated_at: new Date().toISOString() }) };
  }
  return { error: 'The player kept saving: try again' };
}

function readBody(req) {
  return new Promise((ok) => {
    const parts = [];
    let size = 0;
    req.on('data', (d) => {
      size += d.length;
      if (size > MAX_BODY) {
        req.destroy();
        ok(null);
      } else parts.push(d);
    });
    req.on('end', () => ok(Buffer.concat(parts).toString('utf8')));
    req.on('error', () => ok(null));
  });
}
