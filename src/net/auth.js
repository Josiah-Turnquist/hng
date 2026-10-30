// Signing in, in the browser: Neon Auth's own calls (Better Auth's), made to
// the game server's /api/auth/..., which passes them on (src/server/
// authProxy.js). The session is a cookie on the game's own address; the
// token the game server checks comes with each look at the session (Neon
// Auth's set-auth-jwt header) and lasts 15 minutes.
//
//   await online()                     // is this page served by the game server?
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
  if (code === 'NETWORK_ERROR' || status === 502) return 'The sign-in service could not be reached. Try again in a moment.';
  if (status === 429) return 'Too many tries. Wait a minute and try again.';
  return data?.message || `Sign-in failed (${status}).`;
}

export async function online() {
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    return r.ok && (await r.json()).online === true;
  } catch {
    return false;
  }
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
