// A tab left open across an update is told a new version is out
// (ui/updateNotice.js): once, when the server's version is no longer the one
// the page was loaded from, and never for a copy run from a folder or when the
// server cannot be reached.
import test from 'node:test';
import assert from 'node:assert/strict';
import { versionChanged, watchVersion } from '../src/ui/updateNotice.js';

test('which answers count as a new version', () => {
  assert.equal(versionChanged('e6657eb', 'a1b2c3d'), true);
  assert.equal(versionChanged('e6657eb', 'e6657eb'), false);
  assert.equal(versionChanged('local', 'local'), false);
  assert.equal(versionChanged('local', 'a1b2c3d'), false, 'a copy run from a folder');
  assert.equal(versionChanged('e6657eb', null), false, 'the server did not answer');
  assert.equal(versionChanged('e6657eb', ''), false);
  assert.equal(versionChanged(null, 'a1b2c3d'), false, 'the page never learned its own version');
});

test('told once, when the version has changed', async () => {
  const answers = ['e6657eb', 'e6657eb', null, 'e6657eb', 'a1b2c3d', 'ffff000'];
  let asked = 0;
  const said = [];
  let tick = null;
  const w = watchVersion({
    ask: async () => {
      const a = answers[Math.min(asked++, answers.length - 1)];
      if (a === null) throw new Error('offline');
      return a;
    },
    onChange: (v) => said.push(v),
    timer: (fn) => ((tick = fn), 7),
    clear: (id) => assert.equal(id, 7),
  });
  // The first answer is what this page is; nothing is said for it.
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(asked, 1);
  assert.deepEqual(said, []);
  assert.equal(await tick(), false, 'the same version');
  assert.equal(await tick(), false, 'the server could not be reached');
  assert.equal(await tick(), false, 'the same again');
  assert.equal(await tick(), true, 'a new version');
  assert.deepEqual(said, ['a1b2c3d']);
  // Said once: a later version does not say it again.
  assert.equal(await w.check(), false);
  assert.deepEqual(said, ['a1b2c3d']);
  assert.equal(asked, 5, 'and it stops asking');
  w.stop();
});

test('a server that did not say its version at first is learned from later', async () => {
  const answers = [null, 'abc1234', 'abc1234', 'def5678'];
  let i = 0;
  const said = [];
  const w = watchVersion({ ask: async () => answers[i++], onChange: (v) => said.push(v), timer: () => 1, clear: () => {} });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(await w.check(), false, 'now it knows its own version');
  assert.equal(await w.check(), false);
  assert.equal(await w.check(), true);
  assert.deepEqual(said, ['def5678']);
});
