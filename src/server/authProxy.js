// Sign-in through the game server: the browser asks /api/auth/... on the
// game's own address, and the server passes it on to Neon Auth (managed Better
// Auth) and hands back the answer. So the sign-in cookies belong to the game's
// own address: browsers that block cookies from other sites (Safari, and
// others more and more) still keep you signed in.
//
// As Neon's own server toolkit does it (@neondatabase/auth/server, its proxy):
// only a few request headers go on, with only Neon Auth's own cookies; only a
// few answer headers come back (the cookies, the sign-in token in
// set-auth-jwt, the type); every cookie comes back Secure and SameSite=Lax,
// with no Domain and not partitioned, so it is the game address's own.
//
// Which web address a sign-in comes from: Neon Auth refuses any that is not on
// its short list of trusted addresses ("Invalid origin"). It was sent the
// address in the player's browser, so the game could be signed in to from one
// exact address only: a second address for the game (a name of its own, a
// changed Railway address) let nobody sign in, while those signed in already
// carried on. Now the check is made here, where it belongs (ownPage: the
// request must come from a page of this very server), and Neon Auth is told
// the one address it trusts (`origin`), whichever address the player used.
//
//   await proxyAuth(req, res, path, baseUrl, { log, origin })    // path: what follows /api/auth/
//
// Neon not reached (a dropped connection, its service waking up) is tried once
// more at once; why it failed goes to the log.
export const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';
const REQUEST_HEADERS = ['user-agent', 'authorization', 'referer', 'content-type', 'x-neon-client-info'];
const ANSWER_HEADERS = ['content-type', 'content-encoding', 'date', 'set-auth-jwt', 'set-auth-token', 'x-neon-ret-request-id'];
const MAX_BODY = 64 * 1024;

export async function proxyAuth(req, res, path, baseUrl, { log = console.log, origin = null } = {}) {
  // Only Neon Auth's own paths (letters, numbers, dashes and slashes).
  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(path) || path.includes('..')) return res.writeHead(404).end();
  // Anything that changes something must come from the game's own page.
  if (!ownPage(req, origin)) {
    log(`sign-in: refused, not from the game's own page (site: ${req.headers['sec-fetch-site'] || 'not said'}, origin: ${String(req.headers.origin || 'none').slice(0, 80)}, host: ${String(req.headers.host || '').slice(0, 80)})`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Invalid origin', code: 'INVALID_ORIGIN' }));
  }
  const query = new URL(req.url, 'http://x').search;
  const headers = new Headers();
  for (const h of REQUEST_HEADERS) if (req.headers[h]) headers.set(h, req.headers[h]);
  headers.set('origin', origin || originOf(req));
  const cookies = neonCookies(req.headers.cookie);
  if (cookies) headers.set('cookie', cookies);
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await readBody(req);
    if (body === null) return res.writeHead(413).end();
  }
  let answer;
  try {
    // (Ten seconds at most: a player never waits on a service that is down.)
    const ask = () => fetch(`${baseUrl.replace(/\/$/, '')}/${path}${query}`, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    try {
      answer = await ask();
    } catch (e) {
      log(`sign-in: Neon Auth not reached (${why(e)}), trying again`);
      if (e.name === 'TimeoutError') throw e;
      await new Promise((r) => setTimeout(r, 400));
      answer = await ask();
    }
  } catch (e) {
    log(`sign-in: Neon Auth not reached (${why(e)})`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'The sign-in service could not be reached', code: 'NETWORK_ERROR' }));
  }
  const out = {};
  for (const h of ANSWER_HEADERS) {
    const v = answer.headers.get(h);
    if (v) out[h] = v;
  }
  // (A redirect, for signing in with Google and the like, goes on as it is.)
  const loc = answer.headers.get('location');
  if (loc) out.location = loc;
  const set = answer.headers.getSetCookie().map(ownCookie);
  if (set.length) out['set-cookie'] = set;
  // (fetch has already unpacked a squeezed answer.)
  delete out['content-encoding'];
  // (The whole answer is read before any of it is passed on: one cut off
  // half way is a plain "could not be reached", not half an answer.)
  let bytes;
  try {
    bytes = Buffer.from(await answer.arrayBuffer());
  } catch (e) {
    log(`sign-in: Neon Auth's answer was cut off (${why(e)})`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'The sign-in service could not be reached', code: 'NETWORK_ERROR' }));
  }
  res.writeHead(answer.status, out);
  res.end(bytes);
}

// Does this request come from a page of this very server? Asked of every
// request that changes something (not of plain reads, which carry no such
// risk and include the browser coming back from another site's sign-in).
// The browser itself says so in Sec-Fetch-Site, which a page cannot forge;
// older browsers say where the page is from in Origin, which must be the
// address this request came to. A request that says neither is no browser's
// (a script, a test): another site's page cannot make one.
export function ownPage(req, trusted = null) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';
  const from = req.headers.origin;
  if (!from) return true;
  const hostOf = (o) => {
    try {
      return new URL(o).host.toLowerCase();
    } catch {
      return null;
    }
  };
  const h = hostOf(from);
  if (!h) return false;
  const mine = [req.headers.host, req.headers['x-forwarded-host'], trusted && hostOf(trusted)].filter(Boolean).map((x) => String(x).toLowerCase());
  return mine.includes(h);
}

// The page's own origin, as the browser gave it.
function originOf(req) {
  if (req.headers.origin) return req.headers.origin;
  if (req.headers.referer) return req.headers.referer.split('/').slice(0, 3).join('/');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

export function neonCookies(header = '') {
  return String(header)
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(NEON_AUTH_COOKIE_PREFIX))
    .join('; ');
}

// A cookie from Neon Auth made the game address's own: Secure, SameSite=Lax,
// no Domain, not partitioned.
export function ownCookie(setCookie) {
  const [nameValue, ...attrs] = setCookie.split(';').map((s) => s.trim());
  const keep = attrs.filter((a) => !/^(domain|samesite|secure|partitioned)\b/i.test(a));
  return [nameValue, ...keep, 'Secure', 'SameSite=Lax'].join('; ');
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
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', () => ok(null));
  });
}

// Why a request failed, in a few words (the network's reason, not the request).
function why(e) {
  const c = e?.cause;
  return [e?.name === 'TimeoutError' ? 'no answer in 10 s' : e?.message, c?.code, c?.message].filter(Boolean).join(': ').slice(0, 200);
}
