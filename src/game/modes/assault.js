// Assault, as in Heroes & Generals: attackers push along lines of capture
// points (A-E) toward the objectives (the police station O1 and the church O2).
//  - A point can only be captured from a point you hold next to it.
//  - Normal points: 30 s to neutral + 30 s to take; objectives 45 + 45 s;
//    access points 90 s straight. More soldiers capture faster (each extra man
//    adds half as much as the one before).
//  - Defenders have 30 minutes; every first capture gives the attackers +2 min.
//  - Attackers win by holding both objectives. Defenders win when time runs out
//    with both objectives theirs, or by taking every access point. If time runs
//    out with the objectives split, it's sudden death: first to hold both wins.
//  - Spawning: 10 s + 0.5 s per link from your base; a point with enemies within
//    80 m in the last 10 s can't be spawned at.
import * as THREE from 'three';
import { Soldier } from '../soldier.js';
import { BotBrain } from '../../ai/bot.js';
import { DEFAULT_LOADOUT, weaponsFor, FACTIONS } from '../../weapons/defs.js';
import { attachSoldierModel } from '../soldierView.js';
import { TankBrain } from '../../ai/tankBot.js';
import { BikeStands, placeAssaultBikes } from '../../vehicles/bikeSpots.js';

export const DEF = 0; // defenders' team index
export const ATT = 1; // attackers

const NAMES = {
  US: ['Miller', 'Kowalski', 'Russo', 'Johnson', 'Walsh', 'Hendricks', 'Ortiz', 'Brennan', 'Novak', 'Carter', 'Delaney', 'Fischer', 'Hayes', 'Lindqvist', 'Moretti', 'Parker', 'Quinn', 'Sullivan', 'Tucker', 'Vance'],
  GE: ['Bauer', 'Becker', 'Hartmann', 'Kraus', 'Lehmann', 'Maier', 'Neumann', 'Richter', 'Schäfer', 'Schmitt', 'Vogel', 'Wagner', 'Weber', 'Wolf', 'Zimmermann', 'Krüger', 'Brandt', 'Lorenz', 'Hahn', 'Engel'],
  SU: ['Ivanov', 'Petrov', 'Smirnov', 'Kuznetsov', 'Popov', 'Sokolov', 'Lebedev', 'Kozlov', 'Novikov', 'Morozov', 'Volkov', 'Zaitsev', 'Pavlov', 'Semenov', 'Golubev', 'Vinogradov', 'Bogdanov', 'Vorobyov', 'Fedorov', 'Mikhailov'],
};

export class AssaultMode {
  constructor(game, opts = {}) {
    this.game = game;
    const def = game.mapDef;
    this.factions = [opts.defenders || 'GE', opts.attackers || 'US'];
    this.playerTeam = opts.playerTeam ?? ATT;
    this.perSide = opts.perSide ?? 12;
    this.withBikes = opts.bikes ?? !game.headless;
    this.timeLeft = (opts.minutes ?? 30) * 60;
    this.suddenDeath = false;
    this.over = null;
    this.points = [];
    this.byId = {};
    // Capture points: each line X1 (access) .. X4, then the objective.
    for (const o of def.objectives) this._addPoint({ id: o.id, name: o.name, kind: 'objective', x: o.x, z: o.z, radius: o.radius, owner: DEF });
    for (const line of def.lines) {
      let prev = null;
      line.points.forEach((p, i) => {
        const id = `${line.id}${i + 1}`;
        const access = i === 0;
        this._addPoint({ id, name: id, kind: access ? 'access' : 'point', line: line.id, x: p[0], z: p[1], radius: access ? 30 : 16, owner: access ? ATT : DEF });
        if (prev) this._link(prev, id);
        prev = id;
      });
      this._link(prev, line.objective);
    }
    if (this.byId.O1 && this.byId.O2) this._link('O1', 'O2');
    this.spawnQueue = [];
    this.capturedOnce = new Set();
  }

  _addPoint(p) {
    const hf = this.game.world.hf;
    p.y = hf.getHeight(p.x, p.z);
    p.links = [];
    p.c = p.owner === DEF ? 1 : -1; // control: +1 defenders .. -1 attackers
    p.count = [0, 0];
    p.threat = [-99, -99]; // last time enemies of each team were near
    this.points.push(p);
    this.byId[p.id] = p;
  }

  _link(a, b) {
    this.byId[a].links.push(b);
    this.byId[b].links.push(a);
  }

  // Links from a team's home (access points for attackers, objectives for defenders).
  _depth(p, team) {
    const homes = this.points.filter((q) => (team === ATT ? q.kind === 'access' : q.kind === 'objective'));
    const seen = new Map(homes.map((h) => [h.id, 0]));
    const queue = homes.map((h) => h.id);
    while (queue.length) {
      const id = queue.shift();
      for (const n of this.byId[id].links) {
        if (seen.has(n)) continue;
        seen.set(n, seen.get(id) + 1);
        queue.push(n);
      }
    }
    return seen.get(p.id) ?? 4;
  }

  // Can `team` capture this point now (next to a point it holds, not already its own)?
  // Is this team the one attacking (bots on it go looking for enemies they lose sight of)?
  attacking(team) {
    return team === ATT;
  }

  // Where a team's fight is now (the HUD marks these): the points it can take
  // next ('attack'), and its own the enemy can take next or is taking ('defend').
  // Defenders aren't sent back to the attackers' access points.
  activePoints(team) {
    const out = [];
    for (const p of this.points) {
      if (p.owner !== team && this.capturable(p, team) && !(team === DEF && p.kind === 'access')) out.push({ p, role: 'attack' });
      else if (p.owner === team && p.kind !== 'access' && (this.capturable(p, 1 - team) || Math.abs(p.c) < 0.999)) out.push({ p, role: 'defend' });
    }
    return out;
  }

  // The one to make for: the nearest, a point under attack first when defending.
  suggestedPoint(team, x, z) {
    const list = this.activePoints(team);
    const enemy = 1 - team;
    let best = null,
      bestD = Infinity;
    for (const a of list) {
      let d = Math.hypot(a.p.x - x, a.p.z - z);
      if (team === DEF && a.role === 'defend' && a.p.count[enemy] > 0) d *= 0.5;
      if (team === ATT && a.role !== 'attack') d *= 1.5;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  capturable(p, team) {
    if (p.owner === team && Math.abs(p.c) >= 0.999) return false;
    if (p.kind === 'access' && team === ATT) return p.owner !== ATT;
    return p.links.some((id) => this.byId[id].owner === team && Math.abs(this.byId[id].c) >= 0.999);
  }

  playerSpawn() {
    const p = this._spawnPoints(this.playerTeam)[0] || this.points[0];
    const pos = this._spawnPos(p);
    return { x: pos.x, z: pos.z, yaw: this._facing(p) };
  }

  start() {
    const g = this.game;
    // The player.
    const ps = g.player.soldier;
    ps.team = this.playerTeam;
    // Bots fill both sides.
    // Each side has a tank or two crewed by bots (more in bigger battles).
    const tanks = this.perSide >= 16 ? 3 : this.perSide >= 10 ? 2 : this.perSide >= 6 ? 1 : 0;
    for (const team of [DEF, ATT]) {
      const n = this.perSide - (team === this.playerTeam ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const s = this._makeBot(team, i);
        if (i < tanks) s.tankCrew = true;
      }
    }
    // Jeeps wait at each side's spawn points.
    this.vehicleSpots = [];
    const jeep = { US: 'willys_mb', GE: 'kubelwagen', SU: 'gaz67' };
    if (!g.headless) {
      for (const p of this.points.filter((q) => q.kind === 'access')) this._park(jeep[this.factions[ATT]], p, ATT);
      for (const p of this.points.filter((q) => q.kind === 'objective')) this._park(jeep[this.factions[DEF]], p, DEF);
    }
    // Bicycles and motorcycles at the spawn points and around the village.
    this.bikes = new BikeStands(g);
    if (this.withBikes) placeAssaultBikes(this, this.bikes);
    // HUD: points and timer.
    const el = document.createElement('div');
    el.className = 'assault-bar';
    g.hud.root.appendChild(el);
    this.barEl = el;
    const big = document.createElement('div');
    big.className = 'assault-result';
    g.hud.root.appendChild(big);
    this.resultEl = big;
    const side = this.playerTeam === ATT ? 'attacking' : 'defending';
    const f = FACTIONS[this.factions[this.playerTeam]];
    const goal = this.playerTeam === ATT ? 'Take the points in order toward the police station (O1) and the church (O2).' : 'Hold the police station (O1) and the church (O2) until the clock runs out.';
    g.hud.hint(`Assault on ${g.mapDef.name}: the ${f.army} is ${side}. ${goal} Blue points are yours, red the enemy's.`, 14);
    this._updateBar(true);
  }

  // Park a vehicle on a clear, level spot near a point, facing the fight.
  _park(id, p, team) {
    const g = this.game;
    const hf = g.world.hf;
    const coll = g.world.collision;
    const yaw = this._facing({ ...p, owner: team });
    for (let r = 10; r < 70; r += 6) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + r;
        const x = p.x + Math.cos(a) * r,
          z = p.z + Math.sin(a) * r;
        if (g.nav && !g.nav.walkable(x, z)) continue;
        const h = hf.getHeight(x, z);
        if (Math.abs(hf.getHeight(x + 2.5, z) - hf.getHeight(x - 2.5, z)) > 0.5 || Math.abs(hf.getHeight(x, z + 2.5) - hf.getHeight(x, z - 2.5)) > 0.5) continue;
        if (g.world.waterLevelAt?.(x, z) != null) continue;
        if (coll.query(x - 2.5, h + 0.2, z - 2.5, x + 2.5, h + 2.2, z + 2.5, [], 1).length) continue;
        const v = g.spawnVehicle(id, x, z, yaw);
        v.team = team;
        this.vehicleSpots.push({ id, x, z, yaw, team, v, deadT: 0 });
        return v;
      }
    }
    return null;
  }

  _makeBot(team, i) {
    const g = this.game;
    const faction = this.factions[team];
    const classes = ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'recon', 'infantry'];
    const cls = classes[i % classes.length];
    const loadout = this._botLoadout(faction, cls, i);
    const names = NAMES[faction] || NAMES.US;
    const s = new Soldier(g, { faction, cls, loadout, team, name: names[i % names.length], x: 0, z: 0 });
    s.brain = new BotBrain(g, s, { skill: i % 5 === 0 ? 'veteran' : i % 3 === 0 ? 'recruit' : 'regular' });
    s.alive = false;
    s.deathTime = 100;
    s.respawnT = 1 + Math.random() * 6;
    g.soldiers.push(s);
    if (!g.headless) attachSoldierModel(g, s);
    return s;
  }

  // A varied but sensible loadout per faction: mostly rifles, some SMGs and MGs.
  _botLoadout(faction, cls, i) {
    const base = DEFAULT_LOADOUT[faction][cls] || DEFAULT_LOADOUT[faction].infantry;
    const prim = weaponsFor(faction, cls, 'primary').filter((w) => w.type !== 'launcher' && w.type !== 'atRifle');
    const pick = prim[(i * 7 + 3) % prim.length];
    const loadout = base.slice();
    if (pick && i % 2 === 1) loadout[0] = pick.id;
    // Every fifth man carries the army's anti-tank weapon.
    const at = { US: 'bazooka_m1a1', GE: 'panzerschreck', SU: 'ptrd41' }[faction];
    if (i % 5 === 4 && at) loadout[0] = at;
    return loadout;
  }

  // Points a team may spawn at: its own, not under threat.
  _spawnPoints(team) {
    const t = this.game.time;
    return this.points
      .filter((p) => p.owner === team && Math.abs(p.c) >= 0.999 && t - p.threat[team] > 10)
      .sort((a, b) => this._frontScore(b, team) - this._frontScore(a, team));
  }

  // Prefer points near the fighting.
  _frontScore(p, team) {
    const enemy = 1 - team;
    return p.links.some((id) => this.byId[id].owner === enemy) ? 2 : p.kind === 'objective' ? 1 : 0;
  }

  _spawnDelay(p, team) {
    return 10 + 0.5 * this._depth(p, team);
  }

  _spawnPos(p) {
    const g = this.game;
    const hints = g.world.village?.spawnHints?.[p.id];
    if (hints && hints.length) {
      const h = hints[(Math.random() * hints.length) | 0];
      return { x: h.x + (Math.random() - 0.5), z: h.z + (Math.random() - 0.5), y: h.y };
    }
    const nav = g.nav;
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * Math.PI * 2,
        r = Math.sqrt(Math.random()) * p.radius * 0.7;
      const x = p.x + Math.cos(a) * r,
        z = p.z + Math.sin(a) * r;
      if (!nav || nav.walkable(x, z)) return { x, z };
    }
    return { x: p.x, z: p.z };
  }

  _facing(p) {
    // Face the nearest enemy-held neighbor (or the map center).
    const team = p.owner;
    const tgt = p.links.map((id) => this.byId[id]).find((q) => q.owner !== team) || { x: 0, z: 0 };
    return Math.atan2(-(tgt.x - p.x), -(tgt.z - p.z));
  }

  spawnSoldier(s, p) {
    const pos = this._spawnPos(p);
    const b = s.body;
    b.x = pos.x;
    b.z = pos.z;
    b.y = pos.y ?? this.game.world.hf.getHeight(pos.x, pos.z);
    b.vx = b.vy = b.vz = 0;
    b.stance = b.targetStance = 0;
    b.stanceT = 1;
    b.stamina = 100;
    s.alive = true;
    s.health = 100;
    s.bleed = 0;
    s.armWound = 0;
    b.legWound = 0;
    s.action = null;
    s.deathTime = 0;
    s.killer = null;
    s.yaw = this._facing(p);
    b.yaw = s.yaw;
    s.resupply();
    for (const w of s.weapons) w?.fill();
    s.current = 0;
    if (s.brain) {
      s.brain.path = null;
      s.brain.target = null;
      s.brain.aware.clear();
      s.brain.goal = null;
    }
  }

  // --- the bots' plan ----------------------------------------------------------
  // vehicle: a tank crew, which goes for the nearest point (a long drive round
  // the river is minutes wasted).
  // exclude: point ids to leave out (ones a tank found no route to).
  botGoal(brain, { vehicle = false, exclude = null } = {}) {
    const team = brain.s.team;
    const enemy = 1 - team;
    // Points we can capture now, and our points the enemy can capture now.
    const attack = this.points.filter((p) => this.capturable(p, team));
    const threatened = this.points.filter((p) => p.owner === team && this.capturable(p, enemy) && p.kind !== 'access');
    let options;
    if (team === ATT) options = attack.length ? attack : threatened;
    else {
      // Defenders: hold what's threatened, retake what was lost; keep some on the objectives.
      options = threatened.concat(attack.filter((p) => p.kind !== 'access' || Math.random() < 0.2));
      if (!options.length || brain.s.id % 4 === 0) options = options.concat(this.points.filter((p) => p.kind === 'objective' && p.owner === team));
    }
    if (exclude) options = options.filter((p) => !exclude.has(p.id));
    if (!options.length) return null;
    // Spread the team out, preferring nearby points (but not ones far beyond
    // the nearest: across the river that can mean a long way round; defenders
    // still fall back to hold the objectives).
    const b = brain.s.vehicle ? brain.s.vehicle.body.position : brain.s.body;
    const dmin = Math.min(...options.map((p) => Math.hypot(p.x - b.x, p.z - b.z)));
    options = options.filter((p) => Math.hypot(p.x - b.x, p.z - b.z) < dmin + 300 || (team === DEF && !vehicle && p.kind === 'objective'));
    const spread = vehicle ? 0 : 0.6;
    const pick = options
      .map((p) => ({ p, w: 1 / (1 + Math.hypot(p.x - b.x, p.z - b.z) / 150) + (((brain.s.id * 13 + p.id.charCodeAt(0)) % 7) / 7) * spread + (p.kind === 'objective' && !vehicle ? 0.3 : 0) }))
      .sort((a, c) => c.w - a.w)[0].p;
    return { id: pick.id, x: pick.x, z: pick.z, radius: pick.radius };
  }

  // --- rules ---------------------------------------------------------------------
  update(dt) {
    const g = this.game;
    if (this.over) {
      this.overT = (this.overT || 0) + dt;
      return;
    }
    // Who is on each point.
    for (const p of this.points) {
      p.count[0] = p.count[1] = 0;
    }
    for (const s of g.soldiers) {
      if (!s.alive || s.vehicle) continue;
      for (const p of this.points) {
        const dx = s.body.x - p.x,
          dz = s.body.z - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < p.radius * p.radius) p.count[s.team]++;
        if (d2 < 80 * 80) p.threat[1 - s.team] = g.time;
      }
    }
    for (const p of this.points) this._capture(p, dt);
    // Time.
    this.timeLeft -= dt;
    const objs = this.points.filter((p) => p.kind === 'objective');
    const holds = (team) => objs.every((p) => p.owner === team && Math.abs(p.c) >= 0.999);
    if (holds(ATT)) this._end(ATT, 'The attackers took every objective.');
    else if (this.points.filter((p) => p.kind === 'access').every((p) => p.owner === DEF)) this._end(DEF, 'The defenders overran every access point.');
    else if (this.timeLeft <= 0) {
      if (holds(DEF)) this._end(DEF, 'The defenders held out.');
      else this.suddenDeath = true;
    }
    // Respawns.
    for (const s of g.soldiers) {
      if (s.alive || s.isPlayer) continue;
      if (s.respawnT === undefined || s.respawnT === null) s.respawnT = this._spawnDelay(this.points[0], s.team);
      s.respawnT -= dt;
      if (s.respawnT <= 0 && s.deathTime > 3) {
        let pts = this._spawnPoints(s.team);
        // Tanks come in only at access points (attackers) and objectives (defenders).
        if (s.tankCrew) pts = pts.filter((p) => p.kind === (s.team === ATT ? 'access' : 'objective'));
        if (!pts.length) continue;
        const p = pts[(Math.random() * Math.min(2, pts.length)) | 0];
        this.spawnSoldier(s, p);
        s.respawnT = s.tankCrew ? 40 : null;
        if (s.tankCrew) {
          const v = g._deployInTank(s);
          if (v) s.brain = new TankBrain(g, s, v);
          else s.brain = new BotBrain(g, s); // no room for a tank: fight on foot
          s.respawnT = null;
        }
      }
    }
    // Wrecked vehicles are replaced after a while.
    for (const spot of this.vehicleSpots || []) {
      if (spot.v.alive) continue;
      spot.deadT += dt;
      if (spot.deadT < 45 || spot.v.occupants.some((o) => o)) continue;
      spot.v.removeFromWorld();
      g.vehicles.splice(g.vehicles.indexOf(spot.v), 1);
      spot.v = g.spawnVehicle(spot.id, spot.x, spot.z, spot.yaw);
      spot.v.team = spot.team;
      spot.deadT = 0;
    }
    this.bikes?.update(dt);
    if (((g.time * 4) | 0) !== this._barTick) {
      this._barTick = (g.time * 4) | 0;
      this._updateBar();
    }
  }

  _capture(p, dt) {
    const [nd, na] = p.count;
    const halfT = p.kind === 'objective' ? 45 : p.kind === 'access' ? 45 : 30;
    const boost = (n) => 2 - Math.pow(0.5, Math.max(0, n - 1));
    let dir = 0,
      n = 0;
    if (na > nd && this.capturable(p, ATT)) {
      dir = -1;
      n = na - nd;
    } else if (nd > na && this.capturable(p, DEF)) {
      dir = 1;
      n = nd - na;
    }
    if (dir) {
      // Access points go straight over (no neutral stage).
      const before = p.c;
      p.c = Math.max(-1, Math.min(1, p.c + (dir * dt * boost(n)) / halfT));
      if (Math.sign(before) !== Math.sign(p.c) && p.kind !== 'access') p.owner = null; // neutral
      if (p.c <= -0.999 && p.owner !== ATT) this._captured(p, ATT);
      if (p.c >= 0.999 && p.owner !== DEF) this._captured(p, DEF);
    } else if (na === 0 && nd === 0 && p.owner !== null && Math.abs(p.c) < 1) {
      // Abandoned half-way: it drifts back to its owner.
      const home = p.owner === DEF ? 1 : -1;
      p.c += Math.sign(home - p.c) * Math.min(Math.abs(home - p.c), dt / (halfT * 2));
    }
  }

  _captured(p, team) {
    const g = this.game;
    // Everyone of the capturing side on the point shares the credit.
    for (const s of g.soldiers)
      if (s.alive && s.team === team && Math.hypot(s.body.x - p.x, s.body.z - p.z) < p.radius) {
        s.score += p.kind === 'objective' ? 20 : 10;
        s.captures = (s.captures || 0) + 1;
      }
    p.owner = team;
    p.c = team === DEF ? 1 : -1;
    if (team === ATT && p.kind !== 'access' && !this.capturedOnce.has(p.id)) {
      this.capturedOnce.add(p.id);
      this.timeLeft += 120;
    }
    const mine = team === g.player.soldier.team;
    g.hud.flash(`${p.name === p.id ? p.id : `${p.id} ${p.name}`} ${mine ? 'captured' : 'lost'}${team === ATT && p.kind !== 'access' ? ' (+2:00)' : ''}`, 3);
    g.audio?.play?.(mine ? 'objectiveCaptured' : 'objectiveLost', null, { volume: 0.7 });
    if (this.suddenDeath) {
      const objs = this.points.filter((q) => q.kind === 'objective');
      if (objs.every((q) => q.owner === team)) this._end(team, 'Sudden death decided it.');
    }
  }

  _end(team, why) {
    if (this.over) return;
    this.over = { team, why };
    const g = this.game;
    const won = team === g.player.soldier.team;
    // The app shows the results (experience, rank) when it can; otherwise a plain line.
    if (!g.onBattleOver?.({ won, why })) {
      this.resultEl.innerHTML = `<div class="title">${won ? 'Victory' : 'Defeat'}</div><div class="why">${why}</div><div class="hint">Reload the page to play again</div>`;
      this.resultEl.style.display = 'flex';
    }
    g.audio?.play?.(won ? 'objectiveCaptured' : 'objectiveLost', null, { volume: 1 });
  }

  _updateBar() {
    const t = Math.max(0, this.timeLeft);
    const mm = Math.floor(t / 60),
      ss = Math.floor(t % 60);
    const me = this.game.player.soldier.team;
    const cell = (p) => {
      const own = p.owner === null ? 'neutral' : p.owner === me ? 'own' : 'enemy';
      const prog = Math.abs(p.c) < 0.999 ? `<i style="width:${Math.round(((1 - Math.abs(p.c)) / 2 + (p.owner === null ? 0.5 : 0)) * 100)}%"></i>` : '';
      const fight = p.count[0] && p.count[1] ? ' contested' : '';
      return `<span class="pt ${own}${p.kind === 'objective' ? ' obj' : ''}${fight}" title="${p.name}">${p.id}${prog}</span>`;
    };
    const lines = this.game.mapDef.lines.map((l) => this.points.filter((p) => p.line === l.id).map(cell).join('')).join('<b>·</b>');
    const objs = this.points.filter((p) => p.kind === 'objective').map(cell).join('');
    this.barEl.innerHTML = `<div class="timer">${this.suddenDeath ? 'SUDDEN DEATH' : `${mm}:${String(ss).padStart(2, '0')}`}</div><div class="pts">${lines}<b>|</b>${objs}</div>`;
  }

  // Where the player can deploy and how long it takes.
  deployOptions() {
    const team = this.game.player.soldier.team;
    return this._spawnPoints(team).map((p) => ({ id: p.id, name: p.name, delay: this._spawnDelay(p, team), point: p }));
  }

  onImpact() {}
}
