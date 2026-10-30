// /api/progress on the game server: a signed-in player's saved soldiers and
// war (src/server/progressStore.js). The browser loads them when he signs in
// and saves after each change (src/net/progress.js).
//
//   GET  /api/progress        -> { roster, war, rev }   (nulls and 0 for a new player)
//   PUT  /api/progress  { roster?, war?, rev }  -> { rev }, or 409 { roster, war, rev }
//
// Signed in with the Neon Auth token (Authorization: Bearer ...), checked as
// for battles (src/server/auth.js); with ALLOW_DEV_NAMES=1 on your own
// computer, X-Dev-Name instead.
//
// What is earned in battle (experience, ribbon points, records, credits) only
// grows here, on the server: awardStored adds an online battle's rewards, and
// keepEarned takes a save from the browser as a change of choices and
// purchases, never of earnings. A save it had to correct is answered with the
// roster as kept: { rev, roster }.
import { awardBattle } from '../ui/roster.js';
import { WEAPONS } from '../weapons/defs.js';
import { upgradesOf, upgradeOpen } from '../weapons/upgrades.js';
import { isFree, priceOf } from '../game/armory.js';
import { unlocked } from '../game/ribbons.js';
import { wearable } from '../game/badges.js';
import { canPromote, HIRE_PRICE } from '../war/warStore.js';

const MAX_BODY = 1024 * 1024;
const MAX_SOLDIERS = 200;

export function progressHandler({ store, check, log = console.log }) {
  return async function handle(req, res) {
    const send = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
    if (!store) return send(503, { error: 'Saving on the server is not set up' });
    let who;
    try {
      const auth = String(req.headers.authorization || '');
      who = await check({ token: auth.startsWith('Bearer ') ? auth.slice(7) : null, dev: req.headers['x-dev-name'] || null });
    } catch {
      return send(401, { error: 'Please sign in' });
    }
    try {
      if (req.method === 'GET') {
        const row = await store.get(who.id);
        return send(200, { roster: row?.roster ?? null, war: row?.war ?? null, rev: row?.rev ?? 0 });
      }
      if (req.method !== 'PUT') return send(405, { error: 'GET or PUT' });
      const text = await readBody(req);
      if (text === null) return send(413, { error: 'Too big' });
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return send(400, { error: 'Not JSON' });
      }
      const problem = checkProgress(body);
      if (problem) return send(400, { error: problem });
      let roster = body.roster ?? null;
      let fixed = false;
      if (roster) {
        const row = await store.get(who.id);
        if (row && row.rev !== body.rev) return send(409, { roster: row.roster ?? null, war: row.war ?? null, rev: row.rev });
        if (row?.roster) ({ roster, fixed } = keepEarned(row.roster, roster));
      }
      const r = await store.put(who.id, who.name, { roster, war: body.war ?? null }, body.rev);
      if (r.conflict) return send(409, { roster: r.conflict?.roster ?? null, war: r.conflict?.war ?? null, rev: r.conflict?.rev ?? 0 });
      return send(200, fixed ? { rev: r.rev, roster } : { rev: r.rev });
    } catch (e) {
      log(`progress: ${e.message}`);
      return send(503, { error: 'The database could not be reached' });
    }
  };
}

// What a save must look like (the browser checks the rest when it loads it).
export function checkProgress(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Expected an object';
  if (!Number.isInteger(body.rev) || body.rev < 0) return 'Missing rev';
  const { roster, war } = body;
  if (roster === undefined && war === undefined) return 'Nothing to save';
  if (roster !== undefined && roster !== null) {
    if (typeof roster !== 'object' || !Array.isArray(roster.soldiers)) return 'A roster has soldiers';
    if (roster.soldiers.length > MAX_SOLDIERS) return 'Too many soldiers';
  }
  if (war !== undefined && war !== null && (typeof war !== 'object' || Array.isArray(war))) return 'A war is an object';
  return null;
}

// An online battle's rewards (game/rewards.js) added to the soldier kept here.
// Returns { result, soldier, roster, rev }, or null if he has no such soldier.
// (Saved meanwhile from the browser: read again and added again.)
export async function awardStored(store, userId, name, soldierId, reward) {
  for (let i = 0; i < 4; i++) {
    const row = await store.get(userId);
    const roster = row?.roster;
    const s = roster?.soldiers?.find((x) => x && x.id === soldierId);
    if (!s) return null;
    s.stats = { battles: 0, wins: 0, kills: 0, deaths: 0, captures: 0, ...(s.stats || {}) };
    s.xp = Math.max(0, Number(s.xp) || 0);
    const result = awardBattle(roster, soldierId, reward);
    const put = await store.put(userId, name, { roster }, row.rev);
    if (!put.conflict) return { result: { ...reward, ...result }, soldier: s, roster, rev: put.rev };
  }
  throw new Error('kept changing');
}

const NO_STATS = { battles: 0, wins: 0, kills: 0, deaths: 0, captures: 0 };

// A roster saved by the browser, made honest against the one kept here (kept):
// names, loadouts, worn badges, recruits and soldiers sent home are the
// player's to change; experience, ribbon points and records stay as kept;
// credits can only go down, by what new guns, upgrades and hiring a General
// cost. Purchases he can't pay for, or of things not opened to him, are undone.
// Returns { roster, fixed } (fixed: something had to be put right).
export function keepEarned(kept, sent) {
  if (!kept || !Array.isArray(kept.soldiers)) return { roster: sent, fixed: false };
  const out = structuredClone(sent);
  let fixed = false;
  const put = (o, k, v) => {
    if (!same(o[k], v)) fixed = true;
    o[k] = v;
  };
  const was = new Map(kept.soldiers.filter((s) => s && s.id).map((s) => [s.id, s]));
  const n = out.soldiers.length;
  out.soldiers = out.soldiers.filter((s) => s && typeof s === 'object' && typeof s.id === 'string');
  if (out.soldiers.length !== n) fixed = true;
  let cost = 0;
  for (const s of out.soldiers) {
    const old = was.get(s.id);
    // (A new recruit starts from nothing.)
    if (old) {
      put(s, 'faction', old.faction);
      put(s, 'cls', old.cls);
    }
    put(s, 'xp', Math.max(0, Number(old?.xp) || 0));
    put(s, 'ribbons', structuredClone(old?.ribbons || {}));
    put(s, 'stats', { ...NO_STATS, ...structuredClone(old?.stats || {}) });
    put(s, 'general', !!old?.general || (!!s.general && !!old && canPromote(old)));
    const a = armoryCost(old?.armory || {}, s);
    cost += a.cost;
    fixed ||= a.dropped;
  }
  const credits = Math.max(0, Number(kept.credits) || 0);
  let hired = !!kept.generalHired || !!sent.generalHired;
  if (hired && !kept.generalHired) cost += HIRE_PRICE;
  if (cost > credits) {
    // More than he has: none of the new purchases.
    for (const s of out.soldiers) s.armory = structuredClone(was.get(s.id)?.armory || {});
    hired = !!kept.generalHired;
    fixed = true;
  }
  if (hired !== !!sent.generalHired) fixed = true;
  if (hired || 'generalHired' in out) out.generalHired = hired;
  put(out, 'credits', cost > credits ? credits : Math.min(Math.max(0, Number(sent.credits) || 0), credits - cost));
  // Badges: only ones he has earned.
  for (const s of out.soldiers) if (Array.isArray(s.badges)) put(s, 'badges', s.badges.map((id) => (id && wearable(s).includes(id) ? id : null)));
  return { roster: out, fixed };
}

// The same value, whatever the order of its keys (and a missing part the same as none).
function same(a, b) {
  const norm = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? v.map(norm) : Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])]))) : (v ?? null));
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

// What a soldier's new guns and upgrades cost, beside the ones he had (had:
// his kept armory). Ones not opened to him, or unknown, are dropped.
function armoryCost(had, s) {
  let cost = 0;
  let dropped = false;
  if (!s.armory || typeof s.armory !== 'object' || Array.isArray(s.armory)) s.armory = {};
  for (const [gun, a] of Object.entries(s.armory)) {
    if (!WEAPONS[gun] || !a || typeof a !== 'object') {
      delete s.armory[gun];
      dropped = true;
      continue;
    }
    const before = had[gun];
    if (!before && !isFree(s, gun)) {
      if (!unlocked(s, gun)) {
        delete s.armory[gun];
        dropped = true;
        continue;
      }
      cost += priceOf(gun);
    }
    const prev = new Set(before?.bought || []);
    const bought = Array.isArray(a.bought) ? a.bought : [];
    a.bought = bought.filter((up) => {
      if (prev.has(up)) return true;
      const u = upgradesOf(gun).find((x) => x.id === up);
      if (!u || !upgradeOpen(s, gun, up)) return false;
      cost += u.credits || 0;
      return true;
    });
    if (a.bought.length !== bought.length) dropped = true;
  }
  return { cost, dropped };
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
