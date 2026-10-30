// Sign-in through the game server: the browser asks /api/auth/... on the
// game's own address, and the server passes it on to Neon Auth (managed Better
// Auth) and hands back the answer. So the sign-in cookies belong to the game's
// own address: browsers that block cookies from other sites (Safari, and
// others more and more) still keep you signed in.
//
// As Neon's own server toolkit does it (@neondatabase/auth/server, its proxy):
// only a few request headers go on, with the page's origin and only Neon
// Auth's own cookies; only a few answer headers come back (the cookies, the
// sign-in token in set-auth-jwt, the type); every cookie comes back Secure and
// SameSite=Lax, with no Domain and not partitioned, so it is the game
// address's own.
//
//   await proxyAuth(req, res, path, baseUrl)    // path: what follows /api/auth/
export const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';
const REQUEST_HEADERS = ['user-agent', 'authorization', 'referer', 'content-type', 'x-neon-client-info'];
const ANSWER_HEADERS = ['content-type', 'content-encoding', 'date', 'set-auth-jwt', 'set-auth-token', 'x-neon-ret-request-id'];
const MAX_BODY = 64 * 1024;

export async function proxyAuth(req, res, path, baseUrl) {
  // Only Neon Auth's own paths (letters, numbers, dashes and slashes).
  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(path) || path.includes('..')) return res.writeHead(404).end();
  const query = new URL(req.url, 'http://x').search;
  const headers = new Headers();
  for (const h of REQUEST_HEADERS) if (req.headers[h]) headers.set(h, req.headers[h]);
  headers.set('origin', originOf(req));
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
    answer = await fetch(`${baseUrl.replace(/\/$/, '')}/${path}${query}`, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  } catch {
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
  res.writeHead(answer.status, out);
  res.end(Buffer.from(await answer.arrayBuffer()));
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
