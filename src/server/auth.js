// Who a player is, from the sign-in token his browser got from Neon Auth
// (managed Better Auth): a short-lived JWT signed with Neon's key. The game
// server checks the signature against Neon's public keys (fetched once from
// NEON_AUTH_JWKS_URL and kept) and that it hasn't run out. Nothing else of
// Neon's is needed here. No guests: without a good token there is no battle.
// The keys are fetched when the server starts, tried again a few times if Neon
// doesn't answer (it may be waking up), and fetched afresh now and then or when
// a token names a key not yet seen.
//
//   const check = signInChecker({ jwksUrl, issuer, allowDevNames, log })
//   await check(hello)  -> { id, name } or throws
//
// allowDevNames (ALLOW_DEV_NAMES=1) lets a name stand in for a token, for
// trying the server on your own computer and for the tests. Never on Railway.
import { createLocalJWKSet, jwtVerify } from 'jose';

// The game's Neon Auth (project hng, branch production). Not a secret: it is
// where browsers sign in. NEON_AUTH_BASE_URL overrides it.
// (Without a slash at the end: ".../auth/" would make ".../auth//.well-known/...",
// which Neon doesn't know.)
export const NEON_AUTH_BASE_URL = (process.env.NEON_AUTH_BASE_URL || 'https://ep-weathered-meadow-ary5i3vv.neonauth.c-4.us-west-2.aws.neon.tech/neondb/auth').trim().replace(/\/+$/, '');
const STANDARD_JWKS_URL = `${NEON_AUTH_BASE_URL}/.well-known/jwks.json`;

export function signInChecker({ jwksUrl = process.env.NEON_AUTH_JWKS_URL?.trim() || STANDARD_JWKS_URL, issuer = process.env.NEON_AUTH_ISSUER || undefined, allowDevNames = process.env.ALLOW_DEV_NAMES === '1', log = console.log, tries = 4 } = {}) {
  // (A keys address set by hand that doesn't work falls back to the standard one.)
  const urls = jwksUrl ? [...new Set([jwksUrl, jwksUrl === process.env.NEON_AUTH_JWKS_URL?.trim() ? STANDARD_JWKS_URL : jwksUrl])] : [];
  const keys = urls.length ? signInKeys(urls, { log, tries }) : null;
  return async function check(hello) {
    if (hello?.token && keys) {
      const { payload } = await jwtVerify(String(hello.token), keys, { issuer, algorithms: ['EdDSA', 'ES256', 'RS256'] });
      if (!payload.sub) throw new Error('No user in the sign-in');
      const name = cleanName(payload.name) || cleanName(String(payload.email || '').split('@')[0]) || 'Soldier';
      return { id: String(payload.sub), name };
    }
    if (allowDevNames && hello?.dev) {
      const name = cleanName(hello.dev) || 'Tester';
      return { id: `dev:${name}`, name };
    }
    throw new Error(keys ? 'Please sign in' : 'Sign-in is not set up on this server');
  };
}

const KEYS_FRESH = 10 * 60 * 1000; // ms: fetch the keys again after this
const KEYS_RECHECK = 30 * 1000; // ms: at most this often for an unknown key

// Neon's public keys, as jose's key lookup for jwtVerify. Kept once fetched; a
// failed refresh keeps the old ones.
function signInKeys(urls, { log, tries }) {
  let local = null;
  let at = 0;
  let loading = null;
  const fetchKeys = async () => {
    let last = '';
    for (let i = 0; i < tries; i++) {
      if (i) await new Promise((r) => setTimeout(r, 400 * 2 ** i));
      for (const url of urls) {
        try {
          const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'hng-game-server' }, signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            local = createLocalJWKSet(await r.json());
            at = Date.now();
            return;
          }
          last = `HTTP ${r.status} from ${url}`;
        } catch (e) {
          last = `${e.message} (${url})`;
        }
        log(`sign-in keys: ${last} (try ${i + 1} of ${tries})`);
      }
    }
    throw new Error(`Could not get the sign-in keys: ${last}`);
  };
  const load = () =>
    (loading ??= fetchKeys()
      .catch((e) => {
        if (!local) throw e;
      })
      .finally(() => (loading = null)));
  load().catch(() => {}); // ready before the first player
  return async (header, token) => {
    if (!local || Date.now() - at > KEYS_FRESH) await load();
    try {
      return await local(header, token);
    } catch (e) {
      // A new key (Neon changed keys): fetch them again, once in a while.
      if (e.code !== 'ERR_JWKS_NO_MATCHING_KEY' || Date.now() - at < KEYS_RECHECK) throw e;
      await load();
      return local(header, token);
    }
  };
}

// A name to show other players: letters, numbers, spaces and a little
// punctuation, up to 24 characters.
export function cleanName(s) {
  return String(s ?? '')
    .replace(/[^\p{L}\p{N} ._'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}
