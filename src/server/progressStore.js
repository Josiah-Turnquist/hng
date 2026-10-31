// Each player's saved progress, in Postgres (Neon on Railway: DATABASE_URL).
// One row an account: his soldiers (the roster: experience, credits, guns,
// upgrades, ribbons) and his war, as the browser keeps them
// (src/ui/roster.js, src/war/warStore.js), and a revision number that goes up
// with each save, so two computers can't quietly overwrite each other.
//
//   const store = openProgressStore(process.env.DATABASE_URL)
//   await store.get(userId)                       // { name, roster, war, rev } or null
//   await store.put(userId, name, { roster, war }, rev)
//       // -> { rev } saved (a part left out stays as it was), or { conflict: { roster, war, rev } }
//   await store.list(search)                      // up to 50 players, latest first: [{ user_id, name, roster, rev, updated_at }]
//   await store.close()
import pg from 'pg';

const TABLE = `CREATE TABLE IF NOT EXISTS progress (
  user_id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  roster jsonb,
  war jsonb,
  rev integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`;

// Friends: one row a pair, from who asked to who was asked; pending until
// accepted.
const FRIENDS = `CREATE TABLE IF NOT EXISTS friends (
  a text NOT NULL,
  b text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a, b)
)`;

// What happens in the game, for the admin page's stats (server/telemetry.js):
// sessions, battles, frame rates and errors. No addresses, emails or chat;
// kept KEEP_DAYS days.
const EVENTS = `CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id text,
  kind text NOT NULL,
  data jsonb
);
CREATE INDEX IF NOT EXISTS events_kind_at ON events (kind, at)`;
export const KEEP_DAYS = 90;

export function openProgressStore(url, { log = console.log } = {}) {
  // (A few connections are plenty: a save is one small statement.)
  const pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000 });
  pool.on('error', (e) => log(`database: ${e.message}`));
  // The table is made the first time it is needed (the database may be
  // asleep when the server starts); tried again after a failure.
  let ready = null;
  const table = () =>
    (ready ??= pool.query(TABLE).then(() => pool.query(FRIENDS)).then(() => pool.query(EVENTS)).catch((e) => {
      ready = null;
      throw e;
    }));
  return {
    async get(userId) {
      await table();
      const r = await pool.query('SELECT name, roster, war, rev FROM progress WHERE user_id = $1', [userId]);
      return r.rows[0] || null;
    },
    async put(userId, name, { roster = null, war = null }, rev) {
      await table();
      const r = await pool.query(
        `INSERT INTO progress (user_id, name, roster, war, rev) VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name,
           roster = COALESCE(EXCLUDED.roster, progress.roster), war = COALESCE(EXCLUDED.war, progress.war),
           rev = progress.rev + 1, updated_at = now()
         WHERE progress.rev = $5
         RETURNING rev`,
        [userId, name || '', roster === null ? null : JSON.stringify(roster), war === null ? null : JSON.stringify(war), rev | 0],
      );
      if (r.rows.length) return { rev: r.rows[0].rev };
      // Saved meanwhile from somewhere else: what is there now.
      return { conflict: await this.get(userId) };
    },
    // Players by name (part of it, any case), the latest played first.
    async list(search = '') {
      await table();
      const r = await pool.query(`SELECT user_id, name, roster, rev, updated_at FROM progress WHERE name ILIKE $1 ORDER BY updated_at DESC LIMIT 50`, [`%${String(search).replace(/[\\%_]/g, (c) => '\\' + c)}%`]);
      return r.rows;
    },
    // --- Friends ---
    // Players of this name (any case).
    async byName(name) {
      await table();
      return (await pool.query('SELECT user_id, name FROM progress WHERE lower(name) = lower($1) LIMIT 5', [String(name)])).rows;
    },
    // His friends and requests: [{ id, name, status, asked }] (asked: he asked them).
    async friendsOf(userId) {
      await table();
      const r = await pool.query(
        `SELECT CASE WHEN f.a = $1 THEN f.b ELSE f.a END AS id, p.name, f.status, f.a = $1 AS asked
         FROM friends f LEFT JOIN progress p ON p.user_id = CASE WHEN f.a = $1 THEN f.b ELSE f.a END
         WHERE f.a = $1 OR f.b = $1 ORDER BY p.name`,
        [userId],
      );
      return r.rows.map((x) => ({ id: x.id, name: x.name || '', status: x.status, asked: x.asked }));
    },
    // Ask, or accept when the other asked first: { status } now.
    async befriend(from, to) {
      await table();
      const back = await pool.query(`UPDATE friends SET status = 'accepted' WHERE a = $1 AND b = $2 RETURNING status`, [to, from]);
      if (back.rows.length) return { status: 'accepted' };
      const r = await pool.query(`INSERT INTO friends (a, b) VALUES ($1, $2) ON CONFLICT (a, b) DO UPDATE SET a = EXCLUDED.a RETURNING status`, [from, to]);
      return { status: r.rows[0].status };
    },
    async unfriend(x, y) {
      await table();
      await pool.query('DELETE FROM friends WHERE (a = $1 AND b = $2) OR (a = $2 AND b = $1)', [x, y]);
    },
    // --- Events (telemetry) ---
    // rows: [{ user_id, kind, data, at }]; old ones go at the same time.
    async logEvents(rows) {
      if (!rows.length) return;
      await table();
      await pool.query(`INSERT INTO events (at, user_id, kind, data) SELECT at, user_id, kind, data FROM jsonb_to_recordset($1::jsonb) AS x(at timestamptz, user_id text, kind text, data jsonb)`, [JSON.stringify(rows)]);
      if (Math.random() < 0.02) await pool.query(`DELETE FROM events WHERE at < now() - interval '${KEEP_DAYS} days'`);
    },
    // The last few days at a glance (admin page).
    async stats(days = 7) {
      await table();
      const d = Math.max(1, Math.min(KEEP_DAYS, Math.floor(days) || 7));
      const since = `now() - interval '${d} days'`;
      const q = async (sql) => (await pool.query(sql)).rows;
      const [daily, battles, sides, perf, errors, sessions] = await Promise.all([
        q(`SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS day, count(DISTINCT user_id) AS players, count(*) FILTER (WHERE kind = 'battle') AS battles
           FROM events WHERE at > ${since} GROUP BY 1 ORDER BY 1`),
        q(`SELECT count(*) AS battles, count(DISTINCT user_id) AS players, round(avg((data->>'seconds')::numeric) / 60, 1) AS minutes,
             round(avg((data->>'kills')::numeric), 1) AS kills, round(avg((data->>'deaths')::numeric), 1) AS deaths,
             count(*) FILTER (WHERE (data->>'won')::boolean) AS won, count(*) FILTER (WHERE (data->>'early')::boolean) AS left_early
           FROM events WHERE kind = 'battle' AND at > ${since}`),
        q(`SELECT data->>'army' AS army, data->>'cls' AS cls, count(*) AS battles FROM events WHERE kind = 'battle' AND at > ${since} GROUP BY 1, 2 ORDER BY 3 DESC`),
        q(`SELECT data->>'quality' AS quality, count(*) AS samples, round(avg((data->>'fps')::numeric)) AS fps, round(avg((data->>'low')::numeric)) AS low
           FROM events WHERE kind = 'perf' AND at > ${since} GROUP BY 1 ORDER BY 2 DESC`),
        q(`SELECT data->>'message' AS message, max(data->>'where') AS place, count(*) AS times, count(DISTINCT user_id) AS players, max(at) AS last
           FROM events WHERE kind = 'error' AND at > ${since} GROUP BY 1 ORDER BY 3 DESC LIMIT 15`),
        q(`SELECT count(*) AS sessions, count(DISTINCT user_id) AS players, round(avg((data->>'minutes')::numeric), 1) AS minutes
           FROM events WHERE kind = 'session' AND at > ${since}`),
      ]);
      return { days: d, daily, battles: battles[0], sides, perf, errors, sessions: sessions[0] };
    },
    close: () => pool.end(),
  };
}
