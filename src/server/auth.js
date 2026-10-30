// Who a player is, from the sign-in token his browser got from Neon Auth
// (managed Better Auth): a short-lived JWT signed with Neon's key. The game
// server checks the signature against Neon's public keys (fetched once from
// NEON_AUTH_JWKS_URL and kept) and that it hasn't run out. Nothing else of
// Neon's is needed here. No guests: without a good token there is no battle.
//
//   const check = signInChecker({ jwksUrl, issuer, allowDevNames })
//   await check(hello)  -> { id, name } or throws
//
// allowDevNames (ALLOW_DEV_NAMES=1) lets a name stand in for a token, for
// trying the server on your own computer and for the tests. Never on Railway.
import { createRemoteJWKSet, jwtVerify } from 'jose';

// The game's Neon Auth (project hng, branch production). Not a secret: it is
// where browsers sign in. NEON_AUTH_BASE_URL overrides it.
export const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL || 'https://ep-weathered-meadow-ary5i3vv.neonauth.c-4.us-west-2.aws.neon.tech/neondb/auth';

export function signInChecker({ jwksUrl = process.env.NEON_AUTH_JWKS_URL || `${NEON_AUTH_BASE_URL}/.well-known/jwks.json`, issuer = process.env.NEON_AUTH_ISSUER || undefined, allowDevNames = process.env.ALLOW_DEV_NAMES === '1' } = {}) {
  const keys = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;
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

// A name to show other players: letters, numbers, spaces and a little
// punctuation, up to 24 characters.
export function cleanName(s) {
  return String(s ?? '')
    .replace(/[^\p{L}\p{N} ._'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}
