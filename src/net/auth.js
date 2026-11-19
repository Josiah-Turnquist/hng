// Signing in, in the browser: Neon Auth's own calls (Better Auth's), made to
// the game server's /api/auth/..., which passes them on (src/server/
// authProxy.js). The session is a cookie on the game's own address; the
// token the game server checks comes with each look at the session (Neon
// Auth's set-auth-jwt header) and lasts 15 minutes.
//
//   await online()                     // is this page served by the game server?
//   await serverConfig()               // its settings, or null
//   await session()                    // { user: { id, name, email }, token } or null
//   await signIn(email, password) / await signUp(name, email, password) / await signOut()
//   await token()                      // a fresh token for the game server, or null
const BASE = '/api/auth';

async function call(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${BASE}/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(message(data, r.status));
  return { data, jwt: r.headers.get('set-auth-jwt') };
}

// What went wrong, in plain words.
function message(data, status) {
  const code = data?.code || '';
  if (/INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|USER_NOT_FOUND/i.test(code)) return 'That email and password do not match an account.';
  if (/USER_ALREADY_EXISTS/i.test(code)) return 'There is already an account with that email. Sign in instead.';
  if (/PASSWORD_TOO_SHORT/i.test(code)) return 'The password is too short (at least 8 characters).';
  if (/PASSWORD_TOO_LONG/i.test(code)) return 'The password is too long.';
  if (/INVALID_EMAIL/i.test(code)) return 'That email address does not look right.';
  if (/EMAIL_NOT_VERIFIED/i.test(code)) return 'Please confirm your email address first: look for the email we sent.';
  if (/INVALID_ORIGIN/i.test(code)) return 'This page could not be checked as the game\'s own, so signing in was refused. Open the game from its own address and try again.';
  if (code === 'NETWORK_ERROR' || status === 502) return 'The sign-in service could not be reached. Try again in a moment.';
  if (status === 429) return 'Too many tries. Wait a minute and try again.';
  return data?.message || `Sign-in failed (${status}).`;
}

// The game server's settings ({ online, protocol, devNames }), or null
// when the page is not served by it.
export async function serverConfig() {
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    const c = r.ok ? await r.json() : null;
    return c?.online === true ? c : null;
  } catch {
    return null;
  }
}

// What this page is served by, which decides whether signing in is needed:
//   { kind: 'server', config }  the game server: nobody plays without an account
//   { kind: 'none' }            no game server (the one-file copy, a file opened
//                               from a folder, a plain file server): offline play
//   { kind: 'unknown' }         an address that may be the game server did not
//                               answer: nobody is let in on the strength of that
// (A failed question used to count as "no server", so a player whose
// connection hiccupped at that moment walked in with no account.)
export async function serverKind({ ask = (url, o) => fetch(url, o), tries = 3, wait = (ms) => new Promise((r) => setTimeout(r, ms)), page = globalThis } = {}) {
  if (page.__HNG_ONE_FILE || page.location?.protocol === 'file:') return { kind: 'none' };
  for (let i = 0; i < tries; i++) {
    try {
      const r = await ask('/api/config', { cache: 'no-store' });
      if (r.ok) {
        const c = await r.json().catch(() => null);
        return c?.online === true ? { kind: 'server', config: c } : { kind: 'none' };
      }
      // A plain "no such page": a file server, not the game's.
      if (r.status >= 400 && r.status < 500) return { kind: 'none' };
    } catch {
      /* not reached: asked again */
    }
    if (i < tries - 1) await wait(700 * (i + 1));
  }
  return { kind: 'unknown' };
}

export async function online() {
  return !!(await serverConfig());
}

export async function session() {
  try {
    const { data, jwt } = await call('get-session');
    if (!data?.user) return null;
    return { user: { id: data.user.id, name: data.user.name, email: data.user.email }, token: jwt || data.session?.token || null };
  } catch {
    return null;
  }
}

export async function signIn(email, password) {
  await call('sign-in/email', { method: 'POST', body: { email, password } });
  return session();
}

export async function signUp(name, email, password) {
  await call('sign-up/email', { method: 'POST', body: { name, email, password } });
  return session();
}

export async function signOut() {
  await call('sign-out', { method: 'POST', body: {} }).catch(() => {});
}

// A fresh token: from the session (Neon Auth sends one with it), else from
// Better Auth's /token.
export async function token() {
  const s = await session();
  if (s?.token && s.token.split('.').length === 3) return s.token;
  try {
    const { data } = await call('token');
    return data?.token || null;
  } catch {
    return null;
  }
}
