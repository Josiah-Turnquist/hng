// Sign-in through the game server: requests to /api/auth/... go on to the
// sign-in service and come back with its cookies made the game address's own,
// and its sign-in token; nothing else of the browser's is passed on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startServer } from '../server/main.mjs';
import { signInChecker } from '../src/server/auth.js';
import { ownCookie, neonCookies, ownPage } from '../src/server/authProxy.js';

test('cookies from the sign-in service become the game address own', () => {
  assert.equal(ownCookie('__Secure-neon-auth.session_token=abc; Path=/; Domain=neon.tech; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=600'), '__Secure-neon-auth.session_token=abc; Path=/; HttpOnly; Max-Age=600; Secure; SameSite=Lax');
  assert.equal(neonCookies('theme=dark; __Secure-neon-auth.session_token=abc; other=1'), '__Secure-neon-auth.session_token=abc');
});

test('a sign-in must come from a page of the game itself, at whatever address the game is', () => {
  const post = (headers) => ownPage({ method: 'POST', headers }, 'https://trusted.example');
  // Today's browsers say it themselves, and a page cannot forge it.
  assert.equal(post({ 'sec-fetch-site': 'same-origin', origin: 'https://my-own-name.example', host: 'my-own-name.example' }), true, 'the game at a second address');
  assert.equal(post({ 'sec-fetch-site': 'same-origin', origin: 'null', host: 'game.example' }), true, 'a browser that hides the origin');
  assert.equal(post({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example', host: 'game.example' }), false, "another site's page");
  assert.equal(post({ 'sec-fetch-site': 'same-site', origin: 'https://other.game.example', host: 'game.example' }), false, 'a neighbouring address is not the game');
  assert.equal(post({ 'sec-fetch-site': 'cross-site', origin: 'https://trusted.example', host: 'game.example' }), false, 'what the browser says wins over the origin');
  // Older browsers: the origin must be the address the request came to.
  assert.equal(post({ origin: 'https://game.example', host: 'game.example' }), true);
  assert.equal(post({ origin: 'https://GAME.example', host: 'game.example' }), true);
  assert.equal(post({ origin: 'https://game.example', host: 'inner:8080', 'x-forwarded-host': 'game.example' }), true, 'behind the host\'s own front door');
  assert.equal(post({ origin: 'https://trusted.example', host: 'inner:8080' }), true, 'the trusted address itself');
  assert.equal(post({ origin: 'https://evil.example', host: 'game.example' }), false);
  assert.equal(post({ origin: 'null', host: 'game.example' }), false, 'no way to tell: refused');
  // No browser at all (a script, a test), and plain reads.
  assert.equal(post({ host: 'game.example' }), true);
  assert.equal(ownPage({ method: 'GET', headers: { 'sec-fetch-site': 'cross-site', host: 'game.example' } }), true, 'coming back from another site\'s sign-in is a read');
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
  const srv = await startServer({ port: 0, check: signInChecker({ jwksUrl: null }), authBase: `http://localhost:${upstream.address().port}/neondb/auth`, authOrigin: 'https://trusted.example', log: () => {} });
  const base = `http://localhost:${srv.port}`;
  try {
    const r = await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: 'theme=dark' }, body: JSON.stringify({ email: 'able@example.com', password: 'longenough' }) });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { user: { id: 'u1', name: 'Able' } });
    const cookie = r.headers.getSetCookie()[0];
    assert.match(cookie, /^__Secure-neon-auth\.session_token=s3cret/);
    assert.doesNotMatch(cookie, /Domain|Partitioned|SameSite=None/);
    assert.match(cookie, /SameSite=Lax/);
    assert.equal(r.headers.get('x-internal'), null, 'only the allowed answer headers come back');
    assert.equal(seen[0].origin, 'https://trusted.example', 'the service is told the one address it trusts, whichever the player used');
    assert.equal(seen[0].cookie, undefined, 'other cookies of the site are not passed on');
    assert.match(seen[0].body, /able@example\.com/);
    // The session, with its token for the game server.
    const s = await fetch(`${base}/api/auth/get-session`, { headers: { Cookie: 'x=1; __Secure-neon-auth.session_token=s3cret' } });
    assert.equal(s.headers.get('set-auth-jwt'), 'a.b.c');
    assert.equal(seen[1].cookie, '__Secure-neon-auth.session_token=s3cret');
    const n = seen.length - 1;
    // From another site's page: refused here, and the service never hears of it.
    const r3 = await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: JSON.stringify({ email: 'able@example.com', password: 'secret-word' }) });
    assert.equal(r3.status, 403);
    assert.equal((await r3.json()).code, 'INVALID_ORIGIN');
    assert.equal(seen.length, n + 1, 'nothing was passed on');
    // Odd paths are refused before they leave.
    assert.equal((await fetch(`${base}/api/auth/..%2F..%2Fadmin`)).status, 404);
    assert.equal((await fetch(`${base}/api/config`)).status, 200);
  } finally {
    await srv.close();
    upstream.close();
  }
});
