// Nobody plays on the game server without an account (net/auth.js serverKind):
// the page finds out what it is served by, and a question that could not be
// asked never counts as "no server here", which used to let a player in with
// no account. Only a copy with no server behind it plays offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { serverKind } from '../src/net/auth.js';

const page = { location: { protocol: 'https:' } };
const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
const noWait = async () => {};

test('the game server is known for what it is, and so is a copy with no server', async () => {
  const cfg = { online: true, protocol: 5, version: 'abc1234' };
  assert.deepEqual(await serverKind({ ask: async () => answer(200, cfg), page, wait: noWait }), { kind: 'server', config: cfg });
  // A plain file server (the tests', a developer's): no such page.
  assert.deepEqual(await serverKind({ ask: async () => answer(404, {}), page, wait: noWait }), { kind: 'none' });
  // A server that answers every address with the page itself.
  assert.deepEqual(await serverKind({ ask: async () => answer(200, '<!doctype html>'), page, wait: noWait }), { kind: 'none' });
  // The one-file copy and a file opened from a folder never ask.
  let asked = 0;
  const ask = async () => (asked++, answer(200, cfg));
  assert.deepEqual(await serverKind({ ask, page: { __HNG_ONE_FILE: true, location: { protocol: 'https:' } } }), { kind: 'none' });
  assert.deepEqual(await serverKind({ ask, page: { location: { protocol: 'file:' } } }), { kind: 'none' });
  assert.equal(asked, 0);
});

test('a server that cannot be asked is not taken for no server', async () => {
  let asked = 0;
  const down = async () => {
    asked++;
    throw new TypeError('Failed to fetch');
  };
  assert.deepEqual(await serverKind({ ask: down, page, wait: noWait }), { kind: 'unknown' });
  assert.equal(asked, 3, 'asked three times before giving up');
  assert.deepEqual(await serverKind({ ask: async () => answer(502, {}), page, wait: noWait }), { kind: 'unknown' }, 'the host answering for a server that is down');
  // A hiccup, then an answer: the game server after all.
  let n = 0;
  const flaky = async () => {
    if (n++ === 0) throw new TypeError('Failed to fetch');
    return answer(200, { online: true });
  };
  assert.equal((await serverKind({ ask: flaky, page, wait: noWait })).kind, 'server');
});
