// The war on the Generals side: the original's map, assault teams that move
// along the supply lines and take points, battles, supply and victory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP, route, distance } from '../src/war/warMap.js';
import { newWar, tick, buy, deploy, deployProblem, order, withdraw, upgrade, upgradeProblem, resolveBattle, capitalsOf, ownerOf, teamOf, cpUsed, refillCost, TEAMS, BUYABLE, save, load, nextWar, armyCode } from '../src/war/war.js';

const capital = (name) => MAP.capitals.find((c) => MAP.name(c.point) === name).point;

test("the original game's war map: 4,248 points, 23 capitals, three each at the start", () => {
  assert.equal(MAP.count, 4248);
  assert.equal(MAP.capitals.length, 23);
  const w = newWar({ army: 'US', seed: 1 });
  assert.deepEqual(capitalsOf(w, 'US').map(MAP.name).sort(), ['Arnhem', 'Edinburgh', 'Saint-Quentin']);
  assert.deepEqual(capitalsOf(w, 'GE').map(MAP.name).sort(), ['Athens', 'Budapest', 'Rome']);
  assert.deepEqual(capitalsOf(w, 'SU').map(MAP.name).sort(), ['Donetsk', 'Leningrad', 'Warsaw']);
  assert.equal(ownerOf(w, capital('Berlin')), '');
  // Every capital can be reached from every other along the lines.
  assert.ok(route(capital('Edinburgh'), capital('Donetsk')).length > 20);
  assert.deepEqual(BUYABLE.sort(), ['guard', 'light_armor', 'pathfinders', 'recon']);
  assert.deepEqual(TEAMS.medium_armor.made, { tank_crew: 20, medium_armor: 18 });
});

test('a team is bought, set down at a capital within command points, and takes the points it reaches', () => {
  const w = newWar({ army: 'US', seed: 2 });
  const t = w.teams.find((x) => x.army === 'US');
  const arnhem = capital('Arnhem');
  assert.equal(refillCost(t), 36 * 40);
  assert.ok(deploy(w, t.id, arnhem));
  assert.equal(cpUsed(w, 'US'), 1);
  w.cpLimit.US = 1;
  const t2 = buy(w, 'US', 'recon');
  assert.equal(deployProblem(w, t2, arnhem), 'Not enough command points');
  // Off to Berlin (neutral): it marches, then holds each point it does not own.
  assert.ok(order(w, t.id, capital('Berlin')));
  const first = t.path[0];
  tick(w, distance(arnhem, first) / TEAMS.guard.speed + 1);
  assert.equal(t.at, first);
  if (ownerOf(w, first) !== 'US') {
    assert.ok(t.hold > 0);
    tick(w, 11 * 60);
    assert.equal(ownerOf(w, first), 'US');
  }
  // Back to the reserve from its own, supplied land: its command points are free again.
  assert.ok(withdraw(w, t.id));
  assert.equal(cpUsed(w, 'US'), 0);
});

test('meeting the enemy makes a battle; the loser goes back to the reserve and the winner takes the point', () => {
  const w = newWar({ army: 'US', seed: 3 });
  const us = w.teams.find((x) => x.army === 'US');
  const ge = w.teams.find((x) => x.army === 'GE');
  const a = capital('Arnhem');
  const p = MAP.next[a][0];
  w.owner[p] = armyCode('GE');
  deploy(w, us.id, a);
  deploy(w, ge.id, capital('Rome'));
  ge.at = p; // stood there
  order(w, us.id, p);
  tick(w, distance(a, p) / TEAMS.guard.speed + 1);
  const b = w.battles.find((x) => x.point === p);
  assert.ok(b, 'a battle');
  assert.equal(b.att, 'US');
  assert.equal(us.battle, b.id);
  const fundsBefore = w.funds.US;
  resolveBattle(w, b.id, true, { hero: 'sA' });
  assert.equal(ownerOf(w, p), 'US');
  assert.equal(ge.at, null, 'the loser is back in the reserve');
  assert.equal(us.at, p);
  assert.ok(w.funds.US > fundsBefore);
  assert.equal(us.morale, 90);
  assert.ok(us.xp > 0 && ge.xp > 0);
  assert.equal(w.battles.length, 0);
});

test('a battle no hero joins settles itself when its 30 minutes are up', () => {
  const w = newWar({ army: 'US', seed: 4 });
  const ge = w.teams.find((x) => x.army === 'GE');
  deploy(w, ge.id, capital('Rome'));
  // Walk the German team into a US capital with nobody in it: its garrison fights.
  const target = capital('Saint-Quentin');
  ge.at = MAP.next[target][0];
  w.owner[ge.at] = armyCode('GE');
  order(w, ge.id, target);
  w.nextAi = Infinity;
  tick(w, distance(ge.at, target) / TEAMS.guard.speed + 1);
  assert.equal(w.battles.length, 1);
  assert.equal(w.battles[0].garrison, 150);
  tick(w, 31 * 60);
  assert.equal(w.battles.length, 0);
});

test('airborne teams fly from their own airfield or capital to a point within range', () => {
  const w = newWar({ army: 'US', seed: 5 });
  w.funds.US = 1e6;
  w.pools.US.paratrooper = 100;
  const t = buy(w, 'US', 'pathfinders');
  const a = capital('Arnhem');
  assert.ok(deploy(w, t.id, a));
  const far = MAP.capitals.map((c) => c.point).find((p) => p !== a && distance(a, p) < TEAMS.pathfinders.airRange);
  assert.ok(order(w, t.id, far));
  assert.equal(t.air, true);
  assert.deepEqual(t.path, [far]);
});

test('upgrades follow the original tree and need the team to have risen in level', () => {
  const w = newWar({ army: 'US', seed: 6 });
  w.funds.US = 1e6;
  const t = w.teams.find((x) => x.army === 'US');
  assert.equal(upgradeProblem(w, t, 'medium_armor'), 'Not an upgrade of this team');
  assert.equal(upgradeProblem(w, t, 'infantry'), 'Needs team level 1');
  t.xp = 350;
  assert.ok(upgrade(w, t.id, 'infantry'));
  assert.equal(t.type, 'infantry');
});

test('holding 15 capitals wins the war; the next war keeps the general\'s warfunds and teams', () => {
  const w = newWar({ army: 'US', seed: 7 });
  for (const c of MAP.capitals.slice(0, 15)) w.owner[c.point] = armyCode('US');
  tick(w, 20);
  assert.equal(w.over?.winner, 'US');
  const n = nextWar(w);
  assert.equal(n.number, 2);
  assert.equal(n.funds.US, w.funds.US);
  assert.equal(n.teams.filter((t) => t.army === 'US').length, w.teams.filter((t) => t.army === 'US').length);
});

test('a war saves and loads, and the computer generals fight it on their own', () => {
  const w = newWar({ army: 'US', seed: 8 });
  tick(w, 12 * 3600);
  assert.ok(w.teams.some((t) => t.army === 'GE' && t.at !== null), 'the German general has teams out');
  assert.ok(capitalsOf(w, 'GE').length + capitalsOf(w, 'SU').length > 6, 'and they have taken capitals');
  const back = load(save(w));
  assert.deepEqual(Array.from(back.owner), Array.from(w.owner));
  assert.equal(back.t, w.t);
  assert.equal(teamOf(back, w.teams[0].id).type, w.teams[0].type);
  assert.equal(load('nonsense'), null);
});

test('a team that wins a battle on a point it does not hold goes on to take it', () => {
  const w = newWar({ army: 'US', seed: 9 });
  w.nextAi = Infinity;
  const us = w.teams.find((x) => x.army === 'US');
  const ge = w.teams.find((x) => x.army === 'GE');
  const berlin = capital('Berlin');
  deploy(w, us.id, capital('Arnhem'));
  deploy(w, ge.id, capital('Rome'));
  Object.assign(us, { at: berlin, hold: 3600 });
  ge.at = MAP.next[berlin][0];
  order(w, ge.id, berlin);
  tick(w, distance(ge.at, berlin) / TEAMS.guard.speed + 1);
  const b = w.battles[0];
  resolveBattle(w, b.id, false);
  tick(w, 30);
  assert.ok(us.hold > 0, 'taking Berlin again');
  tick(w, 2 * 3600 + 60);
  assert.equal(ownerOf(w, berlin), 'US');
});

test('a soldier of rank 18 can be promoted to General (and keeps fighting), or a General hired with credits', async () => {
  const { canPromote, promote, hireGeneral, mayLead, HIRE_PRICE, GENERALS_OPEN } = await import('../src/war/warStore.js');
  const { RANK_XP } = await import('../src/ui/roster.js');
  const young = { id: 'a', xp: RANK_XP[17] };
  const old = { id: 'b', xp: RANK_XP[18] };
  const roster = { soldiers: [young, old], credits: HIRE_PRICE };
  assert.equal(canPromote(young), false);
  assert.ok(promote(roster, 'b'));
  assert.equal(old.general, true);
  assert.equal(canPromote(old), false, 'once only');
  assert.ok(mayLead(roster));
  // The beta is open to everyone; with it shut, a General is needed.
  assert.equal(mayLead({ soldiers: [young] }), GENERALS_OPEN);
  assert.ok(hireGeneral(roster));
  assert.equal(roster.credits, 0);
  assert.equal(hireGeneral(roster), false);
});

// A US team walked onto Rome (a German capital) where a German team stands,
// and the battle that makes.
function battleAtRome(seed) {
  const w = newWar({ army: 'US', seed });
  w.nextAi = Infinity;
  const us = w.teams.find((x) => x.army === 'US');
  const ge = w.teams.find((x) => x.army === 'GE');
  const rome = capital('Rome');
  deploy(w, us.id, capital('Arnhem'));
  deploy(w, ge.id, rome);
  us.at = rome;
  return { w, us, ge, rome };
}

test('enemy teams standing on one point fight there; none can be set down beside them while they stand', () => {
  const { w, us, ge, rome } = battleAtRome(10);
  const more = buy(w, 'GE', 'guard');
  assert.equal(deployProblem(w, more, rome), 'The enemy is there');
  tick(w, 20);
  const b = w.battles.find((x) => x.point === rome);
  assert.ok(b, 'a battle, not a quiet hold');
  assert.equal(b.att, 'US');
  assert.deepEqual(b.attTeams, [us.id]);
  assert.deepEqual(b.defTeams, [ge.id]);
  assert.equal(us.hold, 0);
});

test('a team set down at a capital while a battle is on there fights in it, and goes back to the reserve if it is lost', () => {
  const { w, us, rome } = battleAtRome(11);
  tick(w, 20);
  const b = w.battles.find((x) => x.point === rome);
  const more = buy(w, 'GE', 'guard');
  assert.equal(deployProblem(w, more, rome), null);
  assert.ok(deploy(w, more.id, rome));
  assert.equal(more.battle, b.id);
  assert.ok(b.defTeams.includes(more.id));
  // (Seed 8 of the old war: the US took Rome while the German team set down
  // there stood by, then it took Rome back without a fight.)
  resolveBattle(w, b.id, true);
  assert.equal(ownerOf(w, rome), 'US');
  assert.equal(more.at, null);
  assert.ok(w.teams.every((t) => t.at !== rome || t.army === 'US'));
  tick(w, 3 * 3600);
  assert.equal(ownerOf(w, rome), 'US');
  assert.equal(us.at, rome);
});

test('an army that loses its last capital loses its battles and cannot win a capital back through them', () => {
  const w = newWar({ army: 'US', seed: 12 });
  w.nextAi = Infinity;
  const us = w.teams.find((x) => x.army === 'US');
  const su = w.teams.find((x) => x.army === 'SU');
  const arnhem = capital('Arnhem');
  deploy(w, us.id, arnhem);
  deploy(w, su.id, capital('Warsaw'));
  su.at = arnhem;
  tick(w, 20);
  const b = w.battles.find((x) => x.point === arnhem);
  assert.equal(b?.att, 'SU');
  for (const c of capitalsOf(w, 'SU')) w.owner[c] = armyCode('GE');
  tick(w, 20);
  assert.equal(w.over, null);
  assert.ok(!w.battles.some((x) => x.att === 'SU' || x.def === 'SU'), 'its battles are over');
  assert.equal(su.at, null);
  assert.equal(su.battle, null);
  assert.equal(us.battle, null, 'the other side is free again');
  assert.equal(us.at, arnhem);
  assert.equal(ownerOf(w, arnhem), 'US');
  assert.equal(resolveBattle(w, b.id, true), null, 'the battle can no longer be won');
  assert.equal(capitalsOf(w, 'SU').length, 0);
});

test('when the war is over no team is left in a battle', () => {
  const { w, rome } = battleAtRome(13);
  tick(w, 20);
  assert.ok(w.battles.some((x) => x.point === rome));
  for (const c of MAP.capitals) if (!['Rome', 'Athens', 'Budapest', 'Warsaw', 'Leningrad', 'Donetsk'].includes(MAP.name(c.point))) w.owner[c.point] = armyCode('US');
  tick(w, 20);
  assert.equal(w.over?.winner, 'US');
  assert.equal(w.battles.length, 0);
  assert.ok(w.teams.every((t) => t.battle === null));
});
