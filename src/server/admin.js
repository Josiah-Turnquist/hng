// /api/admin on the game server, for the game's admins (ADMIN_EMAILS: their
// sign-in emails, or for tests their ids): look players up and change what
// they have, as the admin page (admin.html) does. Everyone else gets 403.
//
//   GET  /api/admin/players?q=name   -> { players: [{ id, name, updated, credits, soldiers: [...] }] }
//   POST /api/admin/change  { id, what, value, soldier? }  -> { player }
//     what: 'credits' (value: how many), 'rank' (value 0-22; soldier: one, or
//     all), 'ribbons' (every ribbon at its top level), 'specialists' (every
//     gun's specialist ribbon at its top level)
//
// A change bumps the saved revision, so a game open for that player takes the
// new copy on its next save (net/progress.js). Each change goes to the log.
import { RANK_XP, rankOf } from '../ui/roster.js';
import { RIBBONS, RIBBON_XP, ribbonInfo } from '../game/ribbons.js';
import { WEAPONS } from '../weapons/defs.js';

const TOP = RIBBON_XP[RIBBON_XP.length - 1];
const MAX_BODY = 16 * 1024;

export function adminHandler({ store, check, admins = [], log = console.log }) {
  const allowed = new Set(admins.map((a) => String(a).trim().toLowerCase()).filter(Boolean));
  return async function handle(req, res, path) {
    const send = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
    let who;
    try {
      const auth = String(req.headers.authorization || '');
      who = await check({ token: auth.startsWith('Bearer ') ? auth.slice(7) : null, dev: req.headers['x-dev-name'] || null });
    } catch {
      return send(401, { error: 'Please sign in' });
    }
    if (!allowed.has(String(who.email || '').toLowerCase()) && !allowed.has(String(who.id).toLowerCase())) return send(403, { error: 'Not an admin' });
    if (!store) return send(503, { error: 'Saving on the server is not set up' });
    try {
      if (req.method === 'GET' && path === 'stats') {
        if (!store.stats) return send(503, { error: 'No stats here' });
        const days = Number(new URL(req.url, 'http://x').searchParams.get('days')) || 7;
        return send(200, await store.stats(days));
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
