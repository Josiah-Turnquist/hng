// What happens in the game, kept for the admin page's stats
// (progressStore.js events): the server's own records (sessions, battles,
// its errors) and what signed-in players' browsers send to /api/telemetry
// (frame rate, load time, errors on their screen). No addresses, emails or
// chat. Without a database it keeps nothing.
//
//   const t = new Telemetry({ store, log })
//   t.record(userId, kind, data)        // kept with the next batch (every 10 s)
//   t.handler({ check })                // the /api/telemetry route
//   await t.flush()                     // (on stopping)
const EVERY = 10000; // ms between batches
const MAX_WAITING = 2000; // events held at most (the rest dropped)
const FROM_BROWSER = new Set(['perf', 'error', 'load']); // what a browser may send
const PER_HOUR = 120; // events a player's browser may send in an hour
const MAX_BODY = 16 * 1024;

export class Telemetry {
  constructor({ store = null, log = console.log } = {}) {
    this.store = store?.logEvents ? store : null;
    this.log = log;
    this.waiting = [];
    this.sent = new Map(); // user id -> { hour, n }
    if (this.store) {
      this.timer = setInterval(() => this.flush(), EVERY);
      this.timer.unref?.();
    }
  }

  record(userId, kind, data = {}) {
    if (!this.store || this.waiting.length >= MAX_WAITING) return;
    this.waiting.push({ at: new Date().toISOString(), user_id: userId ? String(userId) : null, kind: String(kind).slice(0, 20), data: tidy(data) });
  }

  async flush() {
    if (!this.store || !this.waiting.length) return;
    const rows = this.waiting.splice(0);
    try {
      await this.store.logEvents(rows);
    } catch (e) {
      this.log(`telemetry: ${e.message}`);
    }
  }

  stop() {
    clearInterval(this.timer);
    return this.flush();
  }

  // POST /api/telemetry { events: [{ kind, data }] }, signed in. Answers 204
  // (or 401 / 400); a browser that sends too much is quietly cut off.
  handler({ check }) {
    return async (req, res) => {
      const done = (status) => res.writeHead(status, { 'Cache-Control': 'no-store' }).end();
      if (req.method !== 'POST') return done(405);
      let who;
      try {
        const auth = String(req.headers.authorization || '');
        who = await check({ token: auth.startsWith('Bearer ') ? auth.slice(7) : null, dev: req.headers['x-dev-name'] || null });
      } catch {
        return done(401);
      }
      let body;
      try {
        body = JSON.parse((await readBody(req)) ?? '');
      } catch {
        return done(400);
      }
      const list = Array.isArray(body?.events) ? body.events.slice(0, 20) : [];
      const hour = Math.floor(Date.now() / 3600000);
      let q = this.sent.get(who.id);
      if (!q || q.hour !== hour) this.sent.set(who.id, (q = { hour, n: 0 }));
      for (const e of list) {
        if (!FROM_BROWSER.has(e?.kind) || q.n >= PER_HOUR) continue;
        q.n++;
        this.record(who.id, e.kind, e.data);
      }
      if (this.sent.size > 5000) this.sent.clear();
      return done(204);
    };
  }
}

// What may be kept of the data: a flat object of short strings, numbers and
// true/false (anything else is left out).
function tidy(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [k, v] of Object.entries(data).slice(0, 24)) {
    const key = String(k).slice(0, 24);
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') out[key] = v;
    else if (typeof v === 'string') out[key] = v.slice(0, 300);
  }
  return out;
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
