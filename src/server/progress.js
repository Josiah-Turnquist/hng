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
      const r = await store.put(who.id, who.name, { roster: body.roster ?? null, war: body.war ?? null }, body.rev);
      if (r.conflict) return send(409, { roster: r.conflict?.roster ?? null, war: r.conflict?.war ?? null, rev: r.conflict?.rev ?? 0 });
      return send(200, { rev: r.rev });
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
