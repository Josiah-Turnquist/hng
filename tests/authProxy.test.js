// Sign-in through the game server: requests to /api/auth/... go on to the
// sign-in service and come back with its cookies made the game address's own,
// and its sign-in token; nothing else of the browser's is passed on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { ownCookie, neonCookies } from '../src/server/authProxy.js';

test('cookies from the sign-in service become the game address own', () => {
  assert.equal(ownCookie('__Secure-neon-auth.session_token=abc; Path=/; Domain=neon.tech; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=600'), '__Secure-neon-auth.session_token=abc; Path=/; HttpOnly; Max-Age=600; Secure; SameSite=Lax');
  assert.equal(neonCookies('theme=dark; __Secure-neon-auth.session_token=abc; other=1'), '__Secure-neon-auth.session_token=abc');
});

test('sign-in requests are passed on to the sign-in service and back', async () => {
  // A stand-in for Neon Auth (Better Auth's calls), recording what it is sent.
  const seen = [];
  const upstream = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, origin: req.headers.origin, cookie: req.headers.cookie, body });
      if (req.url.startsWith('/neondb/auth/sign-in/email')) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': '__Secure-neon-auth.session_token=s3cret; Path=/; Domain=example.neon.tech; HttpOnly; SameSite=None; Secure; Partitioned', 'X-Internal': 'no' });
        return res.end(JSON.stringify({ user: { id: 'u1', name: 'Able' } }));
      }
      if (req.url.startsWith('/neondb/auth/get-session')) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'set-auth-jwt': 'a.b.c' });
        return res.end(JSON.stringify({ user: { id: 'u1', name: 'Able', email: 'able@example.com' }, session: { token: 'opaque' } }));
      }
      res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ code: 'NOT_FOUND' }));
    });
  });
  await new Promise((r) => upstream.listen(0, r));
  const srv = await startServer({ port: 0, check: signInChecker({ jwksUrl: null }), authBase: `http://localhost:${upstream.address().port}/neondb/auth`, log: () => {} });
  const base = `http://localhost:${srv.port}`;
  try {
    const r = await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://hng.up.railway.app', Cookie: 'theme=dark' }, body: JSON.stringify({ email: 'able@example.com', password: 'longenough' }) });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { user: { id: 'u1', name: 'Able' } });
    const cookie = r.headers.getSetCookie()[0];
    assert.match(cookie, /^__Secure-neon-auth\.session_token=s3cret/);
    assert.doesNotMatch(cookie, /Domain|Partitioned|SameSite=None/);
    assert.match(cookie, /SameSite=Lax/);
    assert.equal(r.headers.get('x-internal'), null, 'only the allowed answer headers come back');
    assert.equal(seen[0].origin, 'https://hng.up.railway.app', "the page's origin goes on, for the service's allowed sites");
    assert.equal(seen[0].cookie, undefined, 'other cookies of the site are not passed on');
    assert.match(seen[0].body, /able@example\.com/);
    // The session, with its token for the game server.
    const s = await fetch(`${base}/api/auth/get-session`, { headers: { Cookie: 'x=1; __Secure-neon-auth.session_token=s3cret' } });
    assert.equal(s.headers.get('set-auth-jwt'), 'a.b.c');
    assert.equal(seen[1].cookie, '__Secure-neon-auth.session_token=s3cret');
    // Odd paths are refused before they leave.
    assert.equal((await fetch(`${base}/api/auth/..%2F..%2Fadmin`)).status, 404);
    assert.equal((await fetch(`${base}/api/config`)).status, 200);
  } finally {
    await srv.close();
    upstream.close();
  }
});
