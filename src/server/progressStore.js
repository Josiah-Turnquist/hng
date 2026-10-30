// Each player's saved progress, in Postgres (Neon on Railway: DATABASE_URL).
// One row an account: his soldiers (the roster: experience, credits, guns,
// upgrades, ribbons) and his war, as the browser keeps them
// (src/ui/roster.js, src/war/warStore.js), and a revision number that goes up
// with each save, so two computers can't quietly overwrite each other.
//
//   const store = openProgressStore(process.env.DATABASE_URL)
//   await store.get(userId)                       // { roster, war, rev } or null
//   await store.put(userId, name, { roster, war }, rev)
//       // -> { rev } saved (a part left out stays as it was), or { conflict: { roster, war, rev } }
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

export function openProgressStore(url, { log = console.log } = {}) {
  // (A few connections are plenty: a save is one small statement.)
  const pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000 });
  pool.on('error', (e) => log(`database: ${e.message}`));
  // The table is made the first time it is needed (the database may be
  // asleep when the server starts); tried again after a failure.
  let ready = null;
  const table = () =>
    (ready ??= pool.query(TABLE).catch((e) => {
      ready = null;
      throw e;
    }));
  return {
    async get(userId) {
      await table();
      const r = await pool.query('SELECT roster, war, rev FROM progress WHERE user_id = $1', [userId]);
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
    close: () => pool.end(),
  };
}
