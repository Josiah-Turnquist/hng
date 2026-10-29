// The player's soldiers: the starting roster, ranks from experience, recruiting
// and dismissing, the record after a battle, and saved data that went wrong.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRoster, loadRoster, recruit, dismiss, select, selected, awardBattle, rankOf, rankTitle, playerLevel, RANK_XP, RANK_TITLES, MAX_SOLDIERS } from '../src/ui/roster.js';
import { weaponsFor } from '../src/weapons/defs.js';

test('the roster starts with an infantryman of each army', () => {
  const r = newRoster();
  assert.deepEqual(r.soldiers.map((s) => `${s.faction} ${s.cls}`), ['US infantry', 'GE infantry', 'SU infantry']);
  assert.equal(selected(r).faction, 'US');
  for (const s of r.soldiers) {
    assert.ok(s.name.split(' ').length >= 2, s.name);
    assert.equal(s.xp, 0);
    assert.equal(s.loadout.length, 3);
  }
});

test('ranks follow the original game experience table, with a title for each army', () => {
  assert.equal(RANK_XP.length, 23);
  for (const f of ['US', 'GE', 'SU']) assert.equal(RANK_TITLES[f].length, 23);
  assert.equal(rankOf(0).rank, 0);
  assert.equal(rankOf(9).rank, 0);
  assert.equal(rankOf(10).rank, 1);
  assert.equal(rankOf(101000).rank, 12);
  assert.equal(rankOf(1e9).rank, 22);
  assert.equal(rankOf(1e9).next, null);
  assert.ok(Math.abs(rankOf(2000).progress - 0.5) < 1e-9);
  assert.equal(rankTitle('GE', 12), 'Leutnant');
  assert.equal(rankTitle('US', 0), 'Private');
});

test('recruiting, choosing and dismissing soldiers', () => {
  const r = newRoster();
  const s = recruit(r, { faction: 'SU', cls: 'tanker', name: 'Test Tankist' });
  assert.equal(selected(r).id, s.id);
  assert.equal(s.cls, 'tanker');
  select(r, r.soldiers[0].id);
  assert.equal(selected(r).faction, 'US');
  while (r.soldiers.length < MAX_SOLDIERS) recruit(r, { faction: 'US', cls: 'recon' });
  assert.equal(recruit(r, { faction: 'US', cls: 'recon' }), null, 'no more than the roster holds');
  while (r.soldiers.length > 1) assert.ok(dismiss(r, r.soldiers[r.soldiers.length - 1].id));
  assert.equal(dismiss(r, r.soldiers[0].id), false, 'the last soldier stays');
});

test('a battle adds experience and the record, and can promote', () => {
  const r = newRoster();
  const s = r.soldiers[0];
  const res = awardBattle(r, s.id, { xp: 1100, won: true, kills: 3, deaths: 1, captures: 2 });
  assert.equal(res.before, 0);
  assert.equal(res.after, 2);
  assert.deepEqual(res.ribbonUps, []);
  assert.equal(s.xp, 1100);
  assert.deepEqual(s.stats, { battles: 1, wins: 1, kills: 3, deaths: 1, captures: 2 });
  assert.equal(playerLevel(r).level, 2);
});

test('without browser storage the roster still loads; bad saved data is repaired', () => {
  const r = loadRoster();
  assert.equal(r.soldiers.length, 3);
  const saved = new Map();
  const old = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) };
  try {
    saved.set('hng.roster.v1', JSON.stringify({ soldiers: [{ id: 'a', faction: 'GE', cls: 'recon', name: 'Max', xp: 'lots', loadout: ['m1_garand', 'nope'], variant: 99 }, { id: 'b', faction: 'XX', cls: 'infantry' }], selectedId: 'zzz' }));
    const q = loadRoster();
    assert.equal(q.soldiers.length, 1, 'the unknown army is dropped');
    const s = q.soldiers[0];
    assert.equal(q.selectedId, 'a');
    assert.equal(s.xp, 0);
    assert.ok(weaponsFor('GE', 'recon', 'primary').some((w) => w.id === s.loadout[0]), 'a German recon soldier cannot carry a Garand');
    assert.ok(s.variant >= 0 && s.variant < 8);
  } finally {
    if (old === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = old;
  }
});
