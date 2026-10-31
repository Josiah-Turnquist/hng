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

export function openProgressStore(url, { log = console.log } = {}) {
  // (A few connections are plenty: a save is one small statement.)
  const pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000 });
  pool.on('error', (e) => log(`database: ${e.message}`));
  // The table is made the first time it is needed (the database may be
  // asleep when the server starts); tried again after a failure.
  let ready = null;
  const table = () =>
    (ready ??= pool.query(TABLE).then(() => pool.query(FRIENDS)).catch((e) => {
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
    close: () => pool.end(),
  };
}
