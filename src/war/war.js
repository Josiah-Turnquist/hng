// The war, as in the original game's "Generals" side: three armies fight
// over Europe on its real war map. Each army's general buys assault teams
// with warfunds, sets them down at his capitals within his command points and
// sends them along the supply lines. A team takes the points it reaches; where
// it meets the enemy there is a battle, fought by heroes or settled on its
// own. Holding 15 of the 23 capitals wins the war.
//
// From the original (docs/research/heroes-and-generals.md, section 2): the map,
// capitals and who starts with them, the assault teams (speed, command points,
// levels, upgrades, what each is made of, warfunds for taking part and for a
// win), the army's production every ten minutes and its stock, morale (20 lost
// a battle, 10 back for a win, 0.15 a minute, surrender at 25), team levels at
// 350 / 3,450 / 9,200 XP, the 30-minute assault, 40 warfunds a man, the loser
// of a battle going back to the reserve, 15 capitals to win, 250 warfunds a
// team for the winners. Ours: how much each thing counts in a battle settled on
// its own, prices the sources don't give, how long taking a point takes, the
// steady income for capitals, the land each army starts with (the points
// nearest its capitals), the computer generals, and the XP for a battle (five
// times the original's 30 and 5, as one player fights far fewer battles).
//
//   newWar({ army, seed, carry })   // a new war; army is the player's
//   tick(war, seconds)              // run the war on (war seconds)
//   buy(war, army, type), deploy(war, id, capital), order(war, id, point),
//   withdraw(war, id), upgrade(war, id, type), resolveBattle(war, id, attackersWon, { hero })
//   save(war) / load(text)          // to and from a string
import { MAP, distance, route, spread } from './warMap.js';
import { TEAM_DATA, PRODUCTION, MORALE, TEAM_LEVELS, WAR_BONUS } from './warMapData.js';

export const ARMIES = ['US', 'GE', 'SU'];
const CODE = { '': 0, US: 1, GE: 2, SU: 3 };
const ARMY_OF = ['', 'US', 'GE', 'SU'];

// War time runs this many times faster than real time on the war map.
export const WAR_SPEED = 20;
export const CAPITALS_TO_WIN = 15;
export const BATTLE_TIME = 30 * 60;
const TAKE_TIME = { point: 10 * 60, capital: 2 * 3600 };
const MAN_COST = 40;
const XP_K = 5;
const GARRISON = 150;
const START_FUNDS = 50000;
const CAPITAL_INCOME = 400;
const AI_CP = 4;

// The teams there are here (not the aircraft: this game has none). Prices in
// warfunds: the original's where known (wiki tables), else ours.
const NAMES = {
  guard: ['Guard', 14000],
  motorized_guard: ['Motorized Guard', 24000],
  infantry: ['Infantry', 20000],
  motorized_infantry: ['Motorized Infantry', 30000],
  mechanized_infantry: ['Mechanized Infantry', 30000],
  recon: ['Recon', 28500],
  motorized_recon: ['Motorized Recon', 24000],
  mechanized_recon: ['Mechanized Recon', 36000],
  light_armor: ['Light Armor', 44500],
  medium_armor: ['Medium Armor', 50000],
  heavy_armor: ['Heavy Armor', 72000],
  medium_tank_destroyer: ['Medium Tank Destroyer', 40000],
  heavy_tank_destroyer: ['Heavy Tank Destroyer', 72000],
  pathfinders: ['Pathfinders', 46000],
  paratroopers: ['Paratroopers', 50000],
};
export const TEAMS = {};
for (const [id, [name, price]] of Object.entries(NAMES)) {
  const d = TEAM_DATA[id];
  // Airborne teams march as their "on the ground" form and fly as this one.
  const ground = d.becomes ? TEAM_DATA[d.becomes] : d;
  TEAMS[id] = {
    id,
    name,
    price,
    branch: d.owner,
    cp: d.cp,
    level: d.level,
    from: d.from,
    speed: ground.speed,
    airSpeed: d.becomes ? d.speed : 0,
    airRange: d.becomes ? d.attackRadius : 0,
    made: Object.fromEntries(ground.made.map(([r, n]) => [r, n])),
    winFunds: d.winFunds,
    joinFunds: d.joinFunds || ground.joinFunds,
  };
}
export const BUYABLE = Object.values(TEAMS)
  .filter((t) => !t.from)
  .map((t) => t.id);
export const RESOURCE_NAMES = {
  infantryman: 'infantry',
  recon: 'recon',
  paratrooper: 'paratroopers',
  tank_crew: 'tank crew',
  motorcycle: 'motorcycles',
  terrain_vehicle: 'cars',
  armoured_car: 'armoured cars',
  armored_personnel_carrier: 'half-tracks',
  light_armor: 'light tanks',
  medium_armor: 'medium tanks',
  heavy_armor: 'heavy tanks',
  tank_destroyer: 'tank destroyers',
  heavy_tank_destroyer: 'heavy tank destroyers',
};
const MEN = new Set(['infantryman', 'recon', 'paratrooper', 'tank_crew']);
// How much one of each counts in a battle settled on its own (ours).
const WEIGHT = { infantryman: 1, recon: 1.1, paratrooper: 1.2, tank_crew: 0.5, motorcycle: 1, terrain_vehicle: 1.5, armoured_car: 4, armored_personnel_carrier: 3, light_armor: 6, medium_armor: 9, heavy_armor: 13, tank_destroyer: 8, heavy_tank_destroyer: 11 };
const unitCost = (r) => MAN_COST * (PRODUCTION[r]?.size || 1);

// --- Starting a war -----------------------------------------------------------

export function newWar({ army = 'US', seed = Date.now() % 2147483647, carry = null } = {}) {
  const owner = new Uint8Array(MAP.count);
  // The land nearest each capital goes to whoever holds that capital.
  const { from } = spread(MAP.capitals.map((c) => c.point));
  const start = new Map(MAP.capitals.map((c) => [c.point, CODE[c.start]]));
  for (let i = 0; i < MAP.count; i++) owner[i] = start.get(from[i]) || 0;
  const war = {
    v: 1,
    number: (carry?.number || 0) + 1,
    army,
    rng: seed >>> 0 || 1,
    t: 8 * 3600,
    owner,
    teams: [],
    battles: [],
    funds: { US: START_FUNDS, GE: START_FUNDS, SU: START_FUNDS },
    pools: Object.fromEntries(ARMIES.map((a) => [a, Object.fromEntries(Object.entries(PRODUCTION).map(([r, p]) => [r, p.start]))])),
    cpLimit: { US: AI_CP, GE: AI_CP, SU: AI_CP },
    log: [],
    over: null,
    nextId: 1,
    nextSupply: 8 * 3600 + 600,
    nextAi: 8 * 3600,
  };
  // The player's general keeps his warfunds and his teams from war to war.
  if (carry) {
    war.funds[army] = carry.funds;
    for (const t of carry.teams) war.teams.push({ ...blankTeam(war, army, t.type), xp: t.xp });
  } else war.teams.push(blankTeam(war, army, 'guard'));
  for (const a of ARMIES) if (a !== army) war.teams.push(blankTeam(war, a, 'guard'));
  note(war, '', `War ${war.number} begins`);
  return war;
}

function blankTeam(war, army, type) {
  return { id: war.nextId++, army, type, at: null, path: [], leg: 0, air: false, men: {}, morale: 100, xp: 0, hold: 0, battle: null };
}

// --- What things are ----------------------------------------------------------

export const armyCode = (a) => CODE[a];
export const ownerOf = (war, p) => ARMY_OF[war.owner[p]];
export const teamOf = (war, id) => war.teams.find((t) => t.id === id);
export const battleOf = (war, id) => war.battles.find((b) => b.id === id);
export const deployed = (war, army) => war.teams.filter((t) => t.army === army && t.at !== null);
export const cpUsed = (war, army) => deployed(war, army).reduce((n, t) => n + TEAMS[t.type].cp, 0);
export const capitalsOf = (war, army) => MAP.capitals.filter((c) => war.owner[c.point] === CODE[army]).map((c) => c.point);

export function teamLevel(t) {
  let l = 0;
  while (l < TEAM_LEVELS.length && t.xp >= TEAM_LEVELS[l]) l++;
  return l;
}

// The share of its full strength a team has (0 to 1).
export function fullness(t) {
  const made = TEAMS[t.type].made;
  let have = 0,
    full = 0;
  for (const [r, n] of Object.entries(made)) {
    have += Math.min(n, t.men[r] || 0) * WEIGHT[r];
    full += n * WEIGHT[r];
  }
  return full ? have / full : 0;
}

export function strength(t) {
  let s = 0;
  for (const [r, n] of Object.entries(t.men)) s += n * (WEIGHT[r] || 1);
  return s * (0.5 + t.morale / 200) * (1 + 0.1 * teamLevel(t));
}

// What it costs to bring a team up to full strength (warfunds).
export function refillCost(t) {
  let c = 0;
  for (const [r, n] of Object.entries(TEAMS[t.type].made)) c += Math.max(0, n - (t.men[r] || 0)) * unitCost(r);
  return c;
}

// The points of an army joined to one of its capitals by its own points.
export function supplied(war, army) {
  const code = CODE[army];
  const seen = new Uint8Array(MAP.count);
  const stack = capitalsOf(war, army);
  for (const p of stack) seen[p] = 1;
  while (stack.length) {
    const u = stack.pop();
    for (const v of MAP.next[u])
      if (!seen[v] && war.owner[v] === code) {
        seen[v] = 1;
        stack.push(v);
      }
  }
  return seen;
}

// Can it fly from where it is: an airborne team at its own capital or airfield.
export function canFly(war, t) {
  if (!TEAMS[t.type].airRange || t.at === null || t.battle) return false;
  return war.owner[t.at] === CODE[t.army] && (MAP.isCapital(t.at) || MAP.kind[t.at] === 'a' || MAP.kind[t.at] === 'w');
}

// The teams standing at a point (not in the reserve).
export const teamsAt = (war, p) => war.teams.filter((t) => t.at === p);

export function upgradesFor(t) {
  return Object.values(TEAMS).filter((u) => u.from === t.type);
}

// --- Orders -------------------------------------------------------------------

function pay(war, army, n) {
  if (war.funds[army] < n) return false;
  war.funds[army] -= n;
  return true;
}

export function buy(war, army, type) {
  const d = TEAMS[type];
  if (!d || d.from || war.over) return null;
  if (!pay(war, army, d.price)) return null;
  const t = blankTeam(war, army, type);
  war.teams.push(t);
  return t;
}

// What stands in the way of setting a team down (or null).
export function deployProblem(war, t, capital) {
  if (war.over) return 'The war is over';
  if (t.at !== null) return 'Already in the field';
  if (!capitalsOf(war, t.army).length) return 'No capital left to set it down at';
  if (capital != null && (!MAP.isCapital(capital) || war.owner[capital] !== CODE[t.army])) return 'Not one of your capitals';
  if (cpUsed(war, t.army) + TEAMS[t.type].cp > war.cpLimit[t.army]) return 'Not enough command points';
  if (war.funds[t.army] < refillCost(t)) return 'Not enough warfunds';
  const pool = war.pools[t.army];
  for (const [r, n] of Object.entries(TEAMS[t.type].made)) if ((pool[r] ?? Infinity) < n - (t.men[r] || 0)) return `Your army has no ${RESOURCE_NAMES[r]} to spare`;
  return null;
}

export function deploy(war, id, capital) {
  const t = teamOf(war, id);
  if (!t || deployProblem(war, t, capital)) return false;
  pay(war, t.army, refillCost(t));
  const pool = war.pools[t.army];
  for (const [r, n] of Object.entries(TEAMS[t.type].made)) {
    const need = Math.max(0, n - (t.men[r] || 0));
    pool[r] = (pool[r] ?? 0) - need;
    t.men[r] = n;
  }
  Object.assign(t, { at: capital, path: [], leg: 0, air: false, hold: 0, battle: null, morale: 100 });
  return true;
}

// Back to the reserve (frees its command points). From the army's own,
// supplied land only.
export function withdraw(war, id) {
  const t = teamOf(war, id);
  if (!t || t.at === null || t.battle) return false;
  if (!supplied(war, t.army)[t.at]) return false;
  undeploy(t);
  return true;
}

function undeploy(t) {
  Object.assign(t, { at: null, path: [], leg: 0, air: false, hold: 0, battle: null });
}

// Send a team to a point: by air when it is an airborne team at its own
// airfield or capital and the point is within its range, else along the lines.
export function order(war, id, point) {
  const t = teamOf(war, id);
  if (!t || t.at === null || t.battle || war.over) return false;
  if (point === t.at) {
    t.path = [];
    t.leg = 0;
    return true;
  }
  const d = TEAMS[t.type];
  if (canFly(war, t) && distance(t.at, point) <= d.airRange) {
    Object.assign(t, { path: [point], leg: 0, air: true, hold: 0 });
    return true;
  }
  const path = route(t.at, point, pathCost(war, t.army));
  if (!path) return false;
  Object.assign(t, { path, leg: 0, air: false, hold: 0 });
  return true;
}

// Taking a point slows a team: the way prefers its own land a little.
const pathCost = (war, army) => (a, b) => (war.owner[b] === CODE[army] ? 0 : 120);

export function upgradeProblem(war, t, to) {
  const u = TEAMS[to];
  if (!u || u.from !== t.type) return 'Not an upgrade of this team';
  if (t.battle) return 'In battle';
  if (t.at !== null && !(MAP.isCapital(t.at) && war.owner[t.at] === CODE[t.army])) return 'Only in the reserve or at a capital';
  if (teamLevel(t) < u.level) return `Needs team level ${u.level}`;
  if (war.funds[t.army] < u.price) return 'Not enough warfunds';
  if (t.at !== null && cpUsed(war, t.army) - TEAMS[t.type].cp + u.cp > war.cpLimit[t.army]) return 'Not enough command points';
  return null;
}

export function upgrade(war, id, to) {
  const t = teamOf(war, id);
  if (!t || upgradeProblem(war, t, to)) return false;
  pay(war, t.army, TEAMS[to].price);
  t.type = to;
  return true;
}

// --- Running the war ----------------------------------------------------------

export function tick(war, seconds) {
  if (war.over) return;
  let left = seconds;
  while (left > 0 && !war.over) {
    const dt = Math.min(left, 20);
    left -= dt;
    war.t += dt;
    step(war, dt);
  }
}

function step(war, dt) {
  for (const t of war.teams) {
    if (t.at === null) continue;
    t.morale = Math.min(MORALE.moraleMaxValue, t.morale + (MORALE.moraleGainedPerMinute * dt) / 60);
    if (t.battle) continue;
    if (t.hold > 0) {
      t.hold -= dt;
      if (t.hold <= 0) take(war, t.at, t.army);
      continue;
    }
    if (!t.path.length) {
      // Standing on a point it doesn't hold (after a battle there, or told to
      // stop): it carries on taking it.
      if (war.owner[t.at] !== CODE[t.army]) t.hold = MAP.isCapital(t.at) ? TAKE_TIME.capital : TAKE_TIME.point;
      continue;
    }
    const to = t.path[0];
    const len = distance(t.at, to);
    t.leg += (t.air ? TEAMS[t.type].airSpeed : TEAMS[t.type].speed) * dt;
    if (t.leg >= len) arrive(war, t, to);
  }
  for (const b of [...war.battles]) if (war.t >= b.ends && !b.hero) resolveBattle(war, b.id, autoWinner(war, b));
  if (war.t >= war.nextSupply) {
    war.nextSupply += 600;
    produceAndSupply(war);
  }
  if (war.t >= war.nextAi) {
    war.nextAi += 300;
    for (const a of ARMIES) if (a !== war.army) think(war, a);
  }
  checkVictory(war);
}

function arrive(war, t, p) {
  const from = t.at;
  const here = war.teams.filter((o) => o.at === p && o !== t);
  const fight = war.battles.find((b) => b.point === p);
  if (fight) {
    if (fight.att === t.army || fight.def === t.army) return enter(war, t, p, fight);
    // A third army waits where it was.
    return Object.assign(t, { path: [], leg: 0, air: false });
  }
  const foe = here.find((o) => o.army !== t.army);
  t.at = p;
  t.path.shift();
  t.leg = 0;
  t.air = false;
  if (foe) return startBattle(war, p, t.army, foe.army, [t], here.filter((o) => o.army === foe.army), 0);
  const holder = ARMY_OF[war.owner[p]];
  if (holder && holder !== t.army && MAP.isCapital(p)) return startBattle(war, p, t.army, holder, [t], [], GARRISON);
  if (holder !== t.army) t.hold = MAP.isCapital(p) ? TAKE_TIME.capital : TAKE_TIME.point;
  void from;
}

function enter(war, t, p, b) {
  Object.assign(t, { at: p, path: [], leg: 0, air: false, hold: 0, battle: b.id });
  (b.att === t.army ? b.attTeams : b.defTeams).push(t.id);
}

function startBattle(war, p, att, def, attTeams, defTeams, garrison) {
  const b = { id: war.nextId++, point: p, att, def, attTeams: attTeams.map((t) => t.id), defTeams: defTeams.map((t) => t.id), garrison, start: war.t, ends: war.t + BATTLE_TIME, hero: null };
  for (const t of [...attTeams, ...defTeams]) Object.assign(t, { battle: b.id, hold: 0, path: t.army === att ? t.path : [], leg: 0 });
  war.battles.push(b);
  note(war, att, `Battle at ${MAP.name(p)}: ${att} attacks ${def}`, p);
  return b;
}

function take(war, p, army) {
  const was = ARMY_OF[war.owner[p]];
  if (was === army) return;
  war.owner[p] = CODE[army];
  if (MAP.isCapital(p)) note(war, army, `${army} takes ${MAP.name(p)}${was ? ` from ${was}` : ''}`, p);
}

function sideStrength(war, b, side) {
  const ids = side === 'att' ? b.attTeams : b.defTeams;
  let s = ids.reduce((n, id) => n + strength(teamOf(war, id)), 0);
  if (side === 'def') s = (s + b.garrison) * (MAP.isCapital(b.point) ? 1.5 : 1.3);
  return s;
}

// A battle settled on its own: the stronger side is likelier to win.
function autoWinner(war, b) {
  const a = sideStrength(war, b, 'att') ** 2,
    d = sideStrength(war, b, 'def') ** 2;
  return rand(war) < a / (a + d || 1);
}

// The battle is over: losses, warfunds, morale and experience; the losers go
// back to the reserve, and the point goes to the attackers if they won.
export function resolveBattle(war, id, attackersWon, { hero = null } = {}) {
  const b = battleOf(war, id);
  if (!b) return null;
  const sA = sideStrength(war, b, 'att'),
    sD = sideStrength(war, b, 'def');
  const ratio = Math.max(0.1, Math.min(1, attackersWon ? sD / (sA || 1) : sA / (sD || 1)));
  const winners = (attackersWon ? b.attTeams : b.defTeams).map((i) => teamOf(war, i));
  const losers = (attackersWon ? b.defTeams : b.attTeams).map((i) => teamOf(war, i));
  const winArmy = attackersWon ? b.att : b.def,
    loseArmy = attackersWon ? b.def : b.att;
  const killed = { [b.att]: 0, [b.def]: 0 };
  const hurt = (t, share) => {
    for (const r of Object.keys(t.men)) {
      const lost = Math.round(t.men[r] * share * (0.8 + rand(war) * 0.4));
      t.men[r] -= lost;
      if (MEN.has(r)) killed[t.army] += lost;
    }
  };
  for (const t of winners) hurt(t, 0.1 + 0.2 * ratio);
  for (const t of losers) hurt(t, 0.4 + 0.3 * rand(war));
  if (b.garrison) killed[b.def] += Math.round(b.garrison * (attackersWon ? 1 : 0.3));
  // Each man put down pays the other side's general (40 warfunds).
  war.funds[b.att] += killed[b.def] * MAN_COST;
  war.funds[b.def] += killed[b.att] * MAN_COST;
  for (const t of [...winners, ...losers]) {
    war.funds[t.army] += TEAMS[t.type].joinFunds || 0;
    t.morale = Math.max(0, t.morale - MORALE.moraleLostPerBattle);
    t.battle = null;
  }
  for (const t of winners) {
    war.funds[t.army] += TEAMS[t.type].winFunds || 0;
    t.morale = Math.min(100, t.morale + MORALE.moraleGainedPerWin);
    t.xp += 30 * XP_K;
  }
  for (const t of losers) {
    t.xp += 5 * XP_K;
    undeploy(t);
  }
  for (const t of winners)
    if (t.morale <= MORALE.moraleSurrenderLimit || fullness(t) < 0.05) {
      note(war, t.army, `${TEAMS[t.type].name} (${t.army}) is spent and falls back`, b.point);
      undeploy(t);
    }
  if (attackersWon) take(war, b.point, b.att);
  war.battles = war.battles.filter((x) => x !== b);
  note(war, winArmy, `${winArmy} wins at ${MAP.name(b.point)}${hero ? ' (with your hero)' : ''}`, b.point);
  checkVictory(war);
  return { winArmy, loseArmy, killed, point: b.point };
}

// Every ten minutes: each army produces, earns for its capitals, and its teams
// on supplied land are brought up toward full strength, paid in warfunds.
function produceAndSupply(war) {
  for (const a of ARMIES) {
    const caps = capitalsOf(war, a).length;
    if (!caps) continue;
    for (const [r, p] of Object.entries(PRODUCTION)) war.pools[a][r] = (war.pools[a][r] || 0) + p.make;
    war.funds[a] += CAPITAL_INCOME * caps;
    const ok = supplied(war, a);
    for (const t of war.teams) {
      if (t.army !== a || t.at === null || t.battle || !ok[t.at]) continue;
      for (const [r, n] of Object.entries(TEAMS[t.type].made)) {
        const want = Math.ceil(Math.max(0, n - (t.men[r] || 0)) * 0.25);
        const can = Math.min(want, war.pools[a][r] || 0, Math.floor(war.funds[a] / unitCost(r)));
        if (can <= 0) continue;
        t.men[r] = (t.men[r] || 0) + can;
        war.pools[a][r] -= can;
        war.funds[a] -= can * unitCost(r);
      }
    }
  }
}

function checkVictory(war) {
  if (war.over) return;
  const held = Object.fromEntries(ARMIES.map((a) => [a, capitalsOf(war, a).length]));
  const alive = ARMIES.filter((a) => held[a] > 0);
  const winner = ARMIES.find((a) => held[a] >= CAPITALS_TO_WIN) || (alive.length === 1 ? alive[0] : null);
  // An army with no capital left is out: its teams go home.
  for (const a of ARMIES) if (!held[a]) for (const t of war.teams) if (t.army === a && t.at !== null) undeploy(t);
  if (!winner) return;
  war.over = { winner, t: war.t };
  war.battles = [];
  if (winner === war.army) war.funds[war.army] += WAR_BONUS.warfunds * deployed(war, war.army).length;
  note(war, winner, `${winner} wins the war`);
}

// The next war, carrying over the player's warfunds and teams.
export function nextWar(war) {
  return newWar({ army: war.army, carry: { number: war.number, funds: war.funds[war.army], teams: war.teams.filter((t) => t.army === war.army) } });
}

// --- The computer generals ----------------------------------------------------

function think(war, army) {
  if (!capitalsOf(war, army).length) return;
  const caps = capitalsOf(war, army);
  // Buy, upgrade and set teams down while there is room.
  for (const t of war.teams) if (t.army === army && (t.at === null || caps.includes(t.at))) for (const u of upgradesFor(t)) if (war.funds[army] > u.price + 15000 && !upgradeProblem(war, t, u.id)) upgrade(war, t.id, u.id);
  const room = () => war.cpLimit[army] - cpUsed(war, army);
  if (room() > 0 && !war.teams.some((t) => t.army === army && t.at === null) && war.funds[army] > 30000) {
    const pick = ['guard', 'guard', 'guard', 'light_armor', 'light_armor', 'recon'][Math.floor(rand(war) * 6)];
    if (war.funds[army] > TEAMS[pick].price + 15000) buy(war, army, pick);
  }
  for (const t of war.teams) {
    if (t.army !== army || t.at !== null || room() < TEAMS[t.type].cp) continue;
    const at = caps[Math.floor(rand(war) * caps.length)];
    deploy(war, t.id, at);
  }
  // Orders for those standing idle.
  const taken = new Map();
  const ok = supplied(war, army);
  for (const t of war.teams) {
    if (t.army !== army || t.at === null || t.battle || t.hold > 0 || t.path.length) continue;
    // Worn down: back to a capital to fill up.
    if (t.morale < 45 || fullness(t) < 0.45) {
      if (caps.includes(t.at)) continue;
      const home = closest(t.at, caps.filter((c) => ok[c]));
      if (home != null) order(war, t.id, home);
      continue;
    }
    // A capital of ours with the enemy near and nobody in it.
    const threat = caps.find((c) => !teamsAt(war, c).some((o) => o.army === army) && war.teams.some((o) => o.army !== army && o.at !== null && distance(o.at, c) < 500));
    if (threat != null && distance(t.at, threat) < 1500) {
      order(war, t.id, threat);
      continue;
    }
    const targets = MAP.capitals.map((c) => c.point).filter((p) => war.owner[p] !== CODE[army]);
    const { best } = spread([t.at]);
    let pick = null,
      score = Infinity;
    for (const p of targets) {
      const s = best[p] * (1 + 0.6 * (taken.get(p) || 0)) * (war.owner[p] ? 1.15 : 1) * (0.85 + rand(war) * 0.3);
      if (s < score) {
        score = s;
        pick = p;
      }
    }
    if (pick != null) {
      taken.set(pick, (taken.get(pick) || 0) + 1);
      order(war, t.id, pick);
    }
  }
}

function closest(from, points) {
  if (!points.length) return null;
  const { best } = spread([from]);
  return points.reduce((a, b) => (best[b] < best[a] ? b : a));
}

// --- Bits -----------------------------------------------------------------------

function rand(war) {
  // mulberry32
  war.rng = (war.rng + 0x6d2b79f5) >>> 0;
  let x = war.rng;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

function note(war, army, text, point = null) {
  war.log.unshift({ t: war.t, army, text, point });
  war.log.length = Math.min(war.log.length, 40);
}

// War time as "Day 2, 14:05".
export function clock(t) {
  const day = Math.floor(t / 86400) + 1;
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `Day ${day}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function save(war) {
  return JSON.stringify({ ...war, owner: Array.from(war.owner).join('') });
}

export function load(text) {
  try {
    const w = JSON.parse(text);
    if (w?.v !== 1 || typeof w.owner !== 'string' || w.owner.length !== MAP.count) return null;
    w.owner = Uint8Array.from(w.owner, (c) => Number(c));
    w.teams = (w.teams || []).filter((t) => TEAMS[t.type]);
    return w;
  } catch {
    return null;
  }
}
