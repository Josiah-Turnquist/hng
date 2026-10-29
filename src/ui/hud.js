// Heads-up display. Kept sparse and period-appropriate like the original game:
// a small hip-fire crosshair (gone when you aim with the real sights; it can be
// turned off), ammo and sight setting at the bottom right, health and stamina at
// the bottom left, a compass at the top, and marks round the middle of the
// screen pointing where shots at you came from.
import * as THREE from 'three';
import { STANCE } from '../actors/body.js';
import { damp, clamp, clamp01, DEG, wrapAngle } from '../core/math.js';
import { HIP_CONVERGE } from '../weapons/viewmodel.js';
import { BattleMap } from './battleMap.js';
import { healthStage } from '../vehicles/effects.js';
import { healTarget, repairTarget, isHealKit } from '../game/kits.js';

const _cv = new THREE.Vector3();

const FACTION_ARMY = { US: 'US Army', GE: 'Wehrmacht', SU: 'Red Army' };

const STANCE_NAMES = ['Standing', 'Crouched', 'Prone'];

// Where on the screen a shot mark goes: the angle round the middle of the
// screen (0 = right, then clockwise, as the canvas draws arcs) pointing from
// (fx, fz) toward the shot's origin (x, z), for a camera looking along camYaw.
export function shotMarkAngle(fx, fz, x, z, camYaw) {
  const rel = wrapAngle(Math.atan2(-(x - fx), -(z - fz)) - camYaw); // (> 0: from our left)
  return Math.atan2(-Math.cos(rel), -Math.sin(rel));
}

export class Hud {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <div class="hud-compass"><div class="strip"></div><div class="needle"></div></div>
      <div class="hud-objectives"></div>
      <div class="hud-killfeed"></div>
      <div class="hud-msg"></div>
      <div class="hud-center"><div class="hud-cross"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="c"></i></div><div class="hitmark"></div></div>
      <div class="hud-kill"></div>
      <div class="hud-left">
        <div class="hud-health"><div class="bar"><div class="fill"></div></div><span class="label">Health</span><span class="bleed">Bleeding (X to bandage)</span></div>
        <div class="hud-stamina"><div class="bar"><div class="fill"></div></div><span class="label">Stamina</span></div>
        <div class="hud-stance"></div>
      </div>
      <div class="hud-right">
        <div class="hud-weapon"></div>
        <div class="hud-ammo"><span class="loaded"></span><span class="reserve"></span></div>
        <div class="hud-mode"></div>
      </div>
      <div class="hud-hint"></div>
      <div class="hud-vehicle">
        <div class="vname"></div>
        <div class="vrow"><span class="vspeed"></span><span class="vgear"></span></div>
        <div class="bar rpm"><div class="fill"></div></div>
        <div class="bar hp"><div class="fill"></div></div>
        <div class="vwarn"></div>
        <div class="vmods"></div>
        <div class="vgun"></div>
        <div class="bar reload"><div class="fill"></div></div>
        <div class="vseat"></div>
      </div>
      <div class="hud-gunmark"></div>
      <div class="hud-tankdir"><div class="hull"></div><div class="turret"></div></div>
      <canvas class="hud-scope"></canvas>
      <canvas class="hud-shots"></canvas>
      <div class="hud-scores"></div>
      <div class="hud-dead"><div class="title">You were killed</div><div class="by"></div><div class="hint"></div></div>
      <div class="hud-use"><span class="k"></span><span class="t"></span></div>
      <div class="hud-deploy" hidden>
        <div class="dp-head"><div class="dp-title">You were killed</div><div class="dp-by"></div></div>
        <div class="dp-body">
          <div class="dp-mapbox"><canvas class="dp-map"></canvas></div>
          <div class="dp-side"><h3>Deploy</h3><div class="dp-list"></div><div class="dp-keys"></div><button class="cta dp-go">Deploy</button></div>
        </div>
      </div>`;
    document.getElementById('app').appendChild(root);
    this.root = root;
    this.el = (sel) => root.querySelector(sel);
    this.healthFill = this.el('.hud-health .fill');
    this.bleedEl = this.el('.hud-health .bleed');
    this.stamFill = this.el('.hud-stamina .fill');
    this.stanceEl = this.el('.hud-stance');
    this.weaponEl = this.el('.hud-weapon');
    this.loadedEl = this.el('.hud-ammo .loaded');
    this.reserveEl = this.el('.hud-ammo .reserve');
    this.modeEl = this.el('.hud-mode');
    this.msgEl = this.el('.hud-msg');
    this.killfeedEl = this.el('.hud-killfeed');
    this.compassStrip = this.el('.hud-compass .strip');
    this.hitEl = this.el('.hitmark');
    this.killEl = this.el('.hud-kill');
    this.crossEl = this.el('.hud-cross');
    this.cross = { a: 0, r: 12, shown: -1 };
    this.hintEl = this.el('.hud-hint');
    this.deadEl = this.el('.hud-dead');
    this.objectivesEl = this.el('.hud-objectives');
    this.vehEl = this.el('.hud-vehicle');
    this.vEls = {
      name: this.el('.hud-vehicle .vname'),
      speed: this.el('.hud-vehicle .vspeed'),
      gear: this.el('.hud-vehicle .vgear'),
      rpm: this.el('.hud-vehicle .rpm .fill'),
      hp: this.el('.hud-vehicle .hp .fill'),
      hpBar: this.el('.hud-vehicle .hp'),
      warn: this.el('.hud-vehicle .vwarn'),
      mods: this.el('.hud-vehicle .vmods'),
      gun: this.el('.hud-vehicle .vgun'),
      reload: this.el('.hud-vehicle .reload .fill'),
      reloadBar: this.el('.hud-vehicle .reload'),
      seat: this.el('.hud-vehicle .vseat'),
    };
    this.gunMark = this.el('.hud-gunmark');
    this.tankDir = this.el('.hud-tankdir');
    this.tankDirHull = this.el('.hud-tankdir .hull');
    this.tankDirTurret = this.el('.hud-tankdir .turret');
    this.scope = this.el('.hud-scope');
    this.scopeCtx = this.scope.getContext('2d');
    this.shotsCanvas = this.el('.hud-shots');
    this.shotsCtx = this.shotsCanvas.getContext('2d');
    this.shots = []; // { x, z (where the shot came from), kind: 'hit' | 'near', t, life, s }
    this.shotsDrawn = false;
    this.damageFlash = 0;
    this.msgT = 0;
    this.hitT = 0;
    this.killT = 0;
    this._buildCompass();
    this.lastScope = null;
    const k = (a) => game.input.keys(a);
    this.hint(
      `Click to play. ${['forward', 'left', 'back', 'right'].map((a) => game.input.key(a)).join(' ')} move, ${k('sprint')} sprint, ${k('crouch')} crouch, ${k('prone')} lie down, ${k('jump')} jump, ${k('aim')} aim, ${k('fire')} fire, ${k('reload')} reload, ${k('use')} get in a vehicle. Esc: menu (Settings > Controls has every key and lets you change them).`,
      14,
    );
    this.useEl = this.el('.hud-use');
    this.use = { t: 0, text: '' };
  }

  _buildCompass() {
    const marks = [];
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let rep = 0; rep < 3; rep++) {
      for (let d = 0; d < 360; d += 15) {
        const label = names[d] ? `<b>${names[d]}</b>` : d % 45 === 0 ? '' : `<i>${d}</i>`;
        marks.push(`<span>${label || '·'}</span>`);
      }
    }
    this.compassStrip.innerHTML = marks.join('');
  }

  resize(w, h) {
    this.scope.width = w;
    this.scope.height = h;
    this.shotsCanvas.width = w;
    this.shotsCanvas.height = h;
    this.shotsDrawn = true;
    this.lastScope = null;
  }

  weaponChanged(w) {
    this.weaponEl.textContent = w.def.name;
  }

  setDeploy(text) {
    this.el('.hud-dead .hint').textContent = text;
  }

  // After falling in an Assault, as in the original game: the battlefield's map
  // with the points you can deploy at (click one, or the lean keys), their
  // waits, and Deploy (or the jump key). state: { opts, index, t } from
  // Game._playerDeploy, or null to close it.
  deployScreen(state) {
    const g = this.game;
    const root = (this.dpEl ??= this.el('.hud-deploy'));
    if (!state) {
      if (!root.hidden) root.hidden = true;
      this.deployState = null;
      return;
    }
    this.deployState = state;
    if (root.hidden) {
      root.hidden = false;
      this.dpKey = '';
      if (!this.dpMap) {
        this.dpMap = new BattleMap(this.el('.dp-map'), g.mapDef, { world: g.world });
        this.el('.dp-map').addEventListener('click', (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const id = this.dpMap.spawnAt(e.clientX - r.left, e.clientY - r.top);
          const i = this.deployState?.opts.findIndex((o) => o.id === id);
          if (i >= 0) g.deploy.index = i;
        });
        this.el('.dp-go').addEventListener('click', () => {
          g.deploy.go = true;
          // (A click may take the mouse back; the game also asks when it deploys.)
          g.input.lock();
        });
      }
      this.dpMap.resize();
      const s = g.player.soldier;
      this.el('.dp-by').textContent = s.killer ? `by ${s.killer.name}` : '';
      this.el('.dp-keys').textContent = `${g.input.key('leanLeft')} / ${g.input.key('leanRight')}: choose a point · ${g.input.key('jump')}: deploy · or click the map`;
    }
    const { opts, index, t } = state;
    const sel = opts[Math.min(index, opts.length - 1)];
    const wait = (o) => Math.max(0, o.delay - t);
    // The list (redrawn when something shown changes).
    const key = `${opts.map((o) => `${o.id}:${Math.ceil(wait(o))}`).join(',')}|${sel?.id}`;
    const changed = key !== this.dpKey;
    if (changed) {
      this.dpKey = key;
      const list = this.el('.dp-list');
      list.innerHTML = '';
      opts.forEach((o, i) => {
        const b = document.createElement('button');
        b.className = `dp-opt${o === sel ? ' on' : ''}`;
        const w = Math.ceil(wait(o));
        b.innerHTML = '<b></b><span></span><em></em>';
        b.querySelector('b').textContent = o.id;
        b.querySelector('span').textContent = o.name !== o.id ? o.name : o.point?.kind === 'objective' ? 'Objective' : o.point?.kind === 'access' ? 'Access point' : 'Capture point';
        b.querySelector('em').textContent = w > 0 ? `${w} s` : 'Ready';
        b.addEventListener('click', () => (g.deploy.index = i));
        list.appendChild(b);
      });
      const go = this.el('.dp-go');
      const w = sel ? Math.ceil(wait(sel)) : 1;
      go.disabled = w > 0;
      go.textContent = w > 0 ? `Deploy at ${sel.id} in ${w} s` : `Deploy at ${sel.id}`;
    }
    // The map, a few times a second (and with the list, so their numbers agree).
    const now = performance.now();
    if (changed || now - (this.dpT || 0) > 120) {
      this.dpT = now;
      const s = g.player.soldier;
      const team = s.team;
      this.dpMap.draw({
        points: g.mode.points,
        team,
        spawns: opts.map((o) => ({ id: o.id, name: o.name, x: o.point.x, z: o.point.z, delay: wait(o) })),
        selected: sel?.id,
        player: { x: s.body.x, z: s.body.z, yaw: s.yaw ?? 0 },
        friends: g.soldiers.filter((x) => x !== s && x.alive && x.team === team).map((x) => ({ x: x.body.x, z: x.body.z })),
      });
    }
  }

  flash(text, seconds = 1.6) {
    this.msgEl.textContent = text;
    this.msgT = seconds;
  }

  hint(text, seconds = 6) {
    this.hintEl.textContent = text;
    this.hintT = seconds;
  }

  hitMarker(kind) {
    this.hitT = kind === 2 ? 0.45 : 0.22;
    this.hitEl.classList.toggle('kill', kind === 2);
  }

  // The player killed an enemy (or knocked out a vehicle): a short chime and a
  // small line under the sights that fades. Kills close together count up.
  killConfirm(name, { verb = 'Killed', points = 0, headshot = false, quiet = false } = {}) {
    const now = this.game.time;
    // (An assist, quiet, is not a kill: it doesn't count up.)
    if (!quiet) {
      this.killStreak = now - (this.killLast ?? -99) < 4 ? (this.killStreak || 1) + 1 : 1;
      this.killLast = now;
    }
    const streak = quiet ? 1 : this.killStreak;
    this.workVerb = null;
    const el = this.killEl;
    el.innerHTML = `<span class="v">${verb}</span> <span class="n"></span>${headshot ? ' <span class="h">Headshot</span>' : ''}${points ? ` <span class="p">+${points}</span>` : ''}${streak > 1 ? ` <span class="x">×${streak}</span>` : ''}`;
    el.querySelector('.n').textContent = name ?? '';
    this.killT = 2;
    el.classList.remove('pop');
    void el.offsetWidth; // (restart the animation)
    el.classList.add('pop');
    if (!quiet) this.game.audio?.play?.('killConfirm', null, { volume: 0.6 });
  }

  // What a kit or the wrench is doing, on the same small line under the sights
  // ("Repairing Willys MB 64%"): quiet, and updated in place while the work
  // goes on rather than popping up again each time.
  workLine(verb, name) {
    if (this.workVerb === verb && this.killT > 0) {
      this.killEl.querySelector('.n').textContent = name ?? '';
      this.killT = 2;
      return;
    }
    this.killConfirm(name, { verb, quiet: true });
    this.workVerb = verb;
  }

  damage(amount) {
    this.damageFlash = Math.min(1, this.damageFlash + amount / 50);
  }

  // A shot from (x, z) hit us ('hit': a red mark) or cracked past ('near': a
  // pale one). The mark points that way round the middle of the screen, and
  // keeps pointing there as you turn and move, until it fades.
  shotFrom(x, z, kind = 'hit', strength = 1) {
    if (!this.game.settings.get('shotMarkers') || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const b = this.game.player.soldier.body;
    const ang = Math.atan2(-(x - b.x), -(z - b.z));
    const life = kind === 'hit' ? 2.4 : 1.4;
    // A shot from about the same way as one already showing renews that mark.
    for (const m of this.shots) {
      if (m.kind === kind && Math.abs(wrapAngle(Math.atan2(-(m.x - b.x), -(m.z - b.z)) - ang)) < 0.3) {
        m.x = x;
        m.z = z;
        m.t = m.life;
        m.s = Math.min(1, Math.max(m.s, strength) + 0.15);
        return;
      }
    }
    this.shots.push({ x, z, kind, t: life, life, s: clamp(strength, 0.4, 1) });
    if (this.shots.length > 12) this.shots.shift();
  }

  killFeed(killer, victim, cause) {
    const row = document.createElement('div');
    const weapon = cause?.weapon?.name || (cause?.kind === 'bleeding' ? 'bled out' : cause?.kind === 'fall' ? 'fell' : cause?.kind === 'explosion' ? 'explosion' : '');
    row.innerHTML = `<span class="k">${killer?.name ?? ''}</span> <span class="w">${weapon}</span> <span class="v">${victim.name}</span>${cause?.headshot ? ' <span class="h">head</span>' : ''}`;
    this.killfeedEl.prepend(row);
    setTimeout(() => row.remove(), 7000);
    while (this.killfeedEl.children.length > 6) this.killfeedEl.lastChild.remove();
  }

  setObjectives(html) {
    this.objectivesEl.innerHTML = html;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const s = p.soldier;
    const b = s.body;
    const w = s.weapon;
    this.healthFill.style.width = `${Math.max(0, s.health)}%`;
    this.healthFill.style.background = s.health > 50 ? '#c9c2a5' : s.health > 25 ? '#d29a4a' : '#c4513f';
    this.bleedEl.style.display = s.bleed > 0 ? 'inline' : 'none';
    this.stamFill.style.width = `${b.stamina}%`;
    this.stamFill.style.opacity = b.staminaLock ? 0.35 : 1;
    const act = s.action === 'bandage' ? ' · bandaging' : s.action === 'firstaid' || s.action === 'kit' ? ' · first aid' : s.action === 'repair' ? ' · repairing' : '';
    this.stanceEl.textContent = `${STANCE_NAMES[b.targetStance]}${b.sprinting ? ' · sprinting' : ''}${p.holdingBreath ? ' · holding breath' : ''}${act}`;
    if (w) {
      const d = w.def;
      if (w.kit) {
        // Kits: the uses left where the rounds would be (the wrench has none).
        this.loadedEl.textContent = w.uses === null ? '' : `${w.uses}`;
        this.reserveEl.textContent = w.uses === null ? '' : w.uses === 1 ? ' use' : ' uses';
        this.modeEl.textContent = d.type === 'wrench' ? 'Hold fire at a damaged vehicle to repair it' : 'Fire: treat the wounded man in front of you, or yourself';
      } else if (d.type === 'grenade') {
        this.loadedEl.textContent = `${(w.chambered ? 1 : 0) + (w.spareMags?.length || 0)}`;
        this.reserveEl.textContent = '';
        this.modeEl.textContent = 'Hold LMB to cook, release to throw';
      } else if (d.type === 'melee') {
        // Nothing to load: what it does instead.
        this.loadedEl.textContent = '';
        this.reserveEl.textContent = '';
        this.modeEl.textContent = d.style === 'stab' ? 'Close combat: LMB to stab' : 'Close combat: LMB to strike';
      } else if (d.type === 'binoculars') {
        // Nothing to count: how to use them instead.
        this.loadedEl.textContent = '';
        this.reserveEl.textContent = '';
        this.modeEl.textContent = `${d.optic.mag}x · ${g.input.key('aim')} to raise, ${g.input.key('fire')} to spot`;
      } else {
        this.loadedEl.textContent = `${w.loaded}`;
        const unit = d.feed === 'stripper' ? 'clips' : d.feed === 'enbloc' ? 'clips' : d.feed === 'belt' ? 'belts' : d.feed === 'drum' ? 'drums' : d.feed === 'pan' ? 'pans' : d.feed === 'single' ? 'rounds' : d.feed === 'gate' ? 'rounds' : d.feed === 'moon' ? 'clips' : 'mags';
        // (A scope over the clip guide: the rounds go in one by one, so count rounds.)
        this.reserveEl.textContent = d.clipsBlocked ? ` / ${w.reserveRounds} rounds` : ` / ${w.reserveUnits} ${unit}`;
        const mode = w.mode === 'bolt' ? 'bolt action' : w.mode === 'slow' ? 'auto (slow)' : w.mode;
        const status = w.state === 'reloading' ? ' · reloading' : w.needsCycle ? ' · work bolt' : w.loaded === 0 ? ' · empty' : '';
        const heat = w.heat > 120 ? ' · barrel hot' : '';
        const sights = d.irons ? (w.useIrons ? ' (irons)' : ' (scope)') : '';
        this.modeEl.textContent = `${mode} · sight ${w.zeroRange} ${w.sight.unit}${sights}${status}${heat}`;
      }
    }
    this._updateVehicle(p);
    this._updateScores(g);
    // Compass: 30 px per 15 degrees.
    const yaw = s.vehicle ? p.camera.rotation.y : p.look.yaw;
    const deg = ((-yaw * 180) / Math.PI) % 360;
    const heading = (deg + 360) % 360;
    this.compassStrip.style.transform = `translateX(${-(heading / 15) * 30 - 360 / 15 * 30 + 150}px)`;

    this.msgT -= dt;
    this.msgEl.style.opacity = this.msgT > 0 ? Math.min(1, this.msgT * 3) : 0;
    this.hintT -= dt;
    this.hintEl.style.opacity = this.hintT > 0 ? Math.min(1, this.hintT) : 0;
    this.hitT -= dt;
    this.hitEl.style.opacity = this.hitT > 0 ? 1 : 0;
    this.killT -= dt;
    this.killEl.style.opacity = this.killT > 0 ? Math.min(1, this.killT / 0.6) : 0;
    this.damageFlash = damp(this.damageFlash, s.health < 30 ? 0.35 : 0, 1.5, dt);
    this.deadEl.style.display = s.alive || this.deployState ? 'none' : 'flex';
    if (!s.alive && s.killer) this.el('.hud-dead .by').textContent = `by ${s.killer.name}`;
    this._updateCrosshair(p, dt);
    this._updateUse(p, dt);
    this._drawScope(p);
    this._spawnHint(p);
    this._drawShots(p, dt);
  }

  // The shot marks: arcs on a ring round the middle of the screen, each
  // pointing the way its shot came from (relative to where the camera looks).
  _drawShots(p, dt) {
    const marks = this.shots;
    for (let i = marks.length - 1; i >= 0; i--) {
      marks[i].t -= dt;
      if (marks[i].t <= 0 || !p.soldier.alive) marks.splice(i, 1);
    }
    const nades = this._nearGrenades(p);
    const objs = this._objectives(p);
    const allies = this._allies(p);
    const spots = this._spotted(p);
    if (!marks.length && !nades.length && !objs && !allies && !spots && !this.shotsDrawn) return;
    const c = this.shotsCanvas;
    const ctx = this.shotsCtx;
    ctx.clearRect(0, 0, c.width, c.height);
    this.shotsDrawn = marks.length > 0 || nades.length > 0 || !!objs || !!allies || !!spots;
    if (!this.shotsDrawn) return;
    const f = _cv.set(0, 0, -1).applyQuaternion(this.game.camera.quaternion);
    const camYaw = Math.atan2(-f.x, -f.z);
    const b = p.soldier.body;
    const cx = c.width / 2,
      cy = c.height / 2;
    const R = Math.max(70, Math.min(c.width, c.height) * 0.16);
    if (allies) this._drawAllies(ctx, allies);
    if (spots) this._drawSpotted(ctx, spots);
    if (objs) this._drawObjectives(ctx, objs, camYaw);
    if (nades.length) this._drawGrenades(ctx, nades, b, camYaw, cx, cy, R);
    ctx.lineCap = 'butt';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 4;
    for (const m of marks) {
      const th = shotMarkAngle(b.x, b.z, m.x, m.z, camYaw);
      const fade = Math.min(1, m.t / 0.7);
      const hit = m.kind === 'hit';
      const a = fade * (hit ? 0.6 + 0.35 * m.s : 0.45 + 0.3 * m.s);
      const half = hit ? 0.17 + 0.07 * m.s : 0.12;
      const wdt = hit ? 5 + 3 * m.s : 3;
      ctx.strokeStyle = hit ? `rgba(214, 40, 26, ${a})` : `rgba(255, 240, 205, ${a})`;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.arc(cx, cy, R, th - half, th + half);
      ctx.stroke();
      // A point on the outside of the arc, aimed at the shooter.
      const ux = Math.cos(th),
        uy = Math.sin(th);
      const r0 = R + wdt / 2,
        r1 = R + wdt / 2 + (hit ? 12 : 8),
        side = hit ? 6 : 4;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(cx + ux * r1, cy + uy * r1);
      ctx.lineTo(cx + ux * r0 - uy * side, cy + uy * r0 + ux * side);
      ctx.lineTo(cx + ux * r0 + uy * side, cy + uy * r0 - ux * side);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- teammates ------------------------------------------------------------------
  // Everyone on the player's side, alive (and not the player), when the marks are on.
  _allies(p) {
    const me = p.soldier;
    if (!me.alive || !this.game.settings.get('allyMarkers')) return null;
    const list = this.game.soldiers.filter((s) => s !== me && s.alive && s.team === me.team);
    return list.length ? list : null;
  }

  // A green dot over the head of each teammate in view (through walls and
  // smoke too: it says who not to shoot), smaller and fainter far off.
  _drawAllies(ctx, list) {
    const c = this.shotsCanvas;
    const w = c.width,
      h = c.height;
    const cam = this.game.camera;
    const cp = cam.position;
    const k = Math.max(0.8, Math.min(w, h) / 1080); // (sizes for a 1080-line screen)
    ctx.save();
    ctx.fillStyle = 'rgb(70, 215, 95)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1.5 * k;
    for (const s of list) {
      const veh = s.vehicle;
      if (veh?.seatPos) veh.seatPos(s.seat, _cv, 'eye');
      else s.body.eyePosition(_cv);
      const d = Math.hypot(_cv.x - cp.x, _cv.y - cp.y, _cv.z - cp.z);
      if (d > 600 || d < 1.5) continue;
      _cv.y += 0.35 + d * 0.004; // over the helmet, a little higher far off (where a man is a few pixels tall)
      const v = _cv.project(cam);
      if (v.z >= 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const x = (v.x * 0.5 + 0.5) * w,
        y = (0.5 - v.y * 0.5) * h;
      ctx.globalAlpha = d < 350 ? 0.95 : 0.95 * (1 - (d - 350) / 250);
      ctx.beginPath();
      ctx.arc(x, y, clamp(8 - d / 50, 4, 8) * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- spotted enemies ---------------------------------------------------------------
  // The enemies someone on the player's side has spotted through binoculars
  // (game/spotting.js), while their marks last.
  _spotted(p) {
    const me = p.soldier;
    const list = me.alive ? this.game.spotting?.marked(me.team) : null;
    return list?.length ? list : null;
  }

  // A red mark over each spotted enemy's head, in view through walls and smoke
  // as the teammate dots are (that is what spotting tells the side): a point
  // down at him, his distance under it far off, fading in its last two seconds.
  _drawSpotted(ctx, list) {
    const c = this.shotsCanvas;
    const w = c.width,
      h = c.height;
    const cam = this.game.camera;
    const cp = cam.position;
    const k = Math.max(0.8, Math.min(w, h) / 1080);
    ctx.save();
    ctx.lineWidth = 1.5 * k;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${Math.round(10 * k)}px sans-serif`;
    for (const { e, t } of list) {
      e.body.eyePosition(_cv);
      const d = Math.hypot(_cv.x - cp.x, _cv.y - cp.y, _cv.z - cp.z);
      if (d < 1.5) continue;
      _cv.y += 0.4 + d * 0.004;
      const v = _cv.project(cam);
      if (v.z >= 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const x = (v.x * 0.5 + 0.5) * w,
        y = (0.5 - v.y * 0.5) * h;
      const s = clamp(9 - d / 60, 5, 9) * k;
      ctx.globalAlpha = Math.min(1, t / 2) * 0.95;
      ctx.fillStyle = 'rgb(222, 46, 32)';
      ctx.beginPath();
      ctx.moveTo(x, y + s);
      ctx.lineTo(x - s, y - s * 0.7);
      ctx.lineTo(x + s, y - s * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (d > 60) {
        ctx.fillStyle = 'rgba(255, 214, 200, 0.95)';
        ctx.fillText(`${Math.round(d / 10) * 10} m`, x, y + s + 3 * k);
      }
    }
    ctx.restore();
  }

  // --- where to go next ------------------------------------------------------------
  // The points the player's side should take or hold now, and the one to make for.
  _objectives(p) {
    const mode = this.game.mode;
    const s = p.soldier;
    if (!mode?.activePoints || !mode.points || mode.over || !s.alive || !this.game.settings.get('objectiveMarkers')) return null;
    const cp = this.game.camera.position;
    const list = mode.activePoints(s.team);
    if (!list.length) return null;
    const next = mode.suggestedPoint(s.team, cp.x, cp.z);
    // The point we're standing on, if any (for the status line).
    const b = s.vehicle ? s.vehicle.body.position : s.body;
    const on = mode.points.find((q) => Math.hypot(q.x - b.x, q.z - b.z) < q.radius) || null;
    return { list, next, on, team: s.team };
  }

  // A mark over each point (and above the compass), the one to make for bigger,
  // labelled and kept at the edge of the screen when out of view; a line under
  // the points bar while standing on one.
  _drawObjectives(ctx, o, camYaw) {
    const c = this.shotsCanvas;
    const w = c.width,
      h = c.height;
    const cam = this.game.camera;
    const cp = cam.position;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 3;
    for (const a of o.list) {
      const pt = a.p;
      const main = a.p === o.next?.p;
      const d = Math.hypot(pt.x - cp.x, pt.z - cp.z);
      const th = shotMarkAngle(cp.x, cp.z, pt.x, pt.z, camYaw);
      // Above the compass: which way it lies.
      const rel = wrapAngle(th + Math.PI / 2) / DEG;
      if (Math.abs(rel) < 72) this._pointDiamond(ctx, w / 2 + rel * 2, 7, main ? 5 : 3.5, pt, o.team, 1, false, t);
      if (o.on === pt) continue; // standing on it: the status line instead
      const v = _cv.set(pt.x, pt.y + 5, pt.z).project(cam);
      let x, y, edge;
      if (v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9) {
        x = (v.x * 0.5 + 0.5) * w;
        y = (0.5 - v.y * 0.5) * h;
      } else if (main) {
        // Out of view: at the edge of the screen (clear of the bars at the top
        // and the panels at the bottom), the way it lies.
        const ux = Math.cos(th),
          uy = Math.sin(th);
        const ex = w / 2 - 70,
          eyUp = h / 2 - 135,
          eyDown = h / 2 - 125;
        const k = Math.min(ex / Math.max(1e-3, Math.abs(ux)), (uy < 0 ? eyUp : eyDown) / Math.max(1e-3, Math.abs(uy)));
        x = w / 2 + ux * k;
        y = h / 2 + uy * k;
        edge = th;
      } else continue;
      const r = main ? 13 : 9;
      ctx.globalAlpha = main ? 1 : 0.75;
      this._pointDiamond(ctx, x, y, r, pt, o.team, 1, true, t);
      ctx.fillStyle = 'rgba(245, 240, 225, 0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const dist = d < 1000 ? `${Math.round(d / (d > 100 ? 10 : 1)) * (d > 100 ? 10 : 1)} m` : `${(d / 1000).toFixed(1)} km`;
      const role = a.role === 'attack' ? 'ATTACK' : 'DEFEND';
      if (edge === undefined) {
        ctx.font = `600 ${main ? 11 : 10}px sans-serif`;
        ctx.fillText(dist, x, y + r + 9);
        if (main) {
          ctx.font = '700 10px sans-serif';
          ctx.fillText(role, x, y - r - 9);
        }
      } else {
        // An arrow out toward it, the words on the inner side.
        const ux = Math.cos(edge),
          uy = Math.sin(edge);
        ctx.beginPath();
        ctx.moveTo(x + ux * (r + 14), y + uy * (r + 14));
        ctx.lineTo(x + ux * (r + 6) - uy * 5, y + uy * (r + 6) + ux * 5);
        ctx.lineTo(x + ux * (r + 6) + uy * 5, y + uy * (r + 6) - ux * 5);
        ctx.closePath();
        ctx.fill();
        ctx.font = '700 11px sans-serif';
        const tx = x - ux * (r + 30),
          ty = y - uy * (r + 16);
        ctx.fillText(`${role} · ${dist}`, tx, ty);
      }
      ctx.globalAlpha = 1;
    }
    // On a point: how it's going there.
    const on = o.on;
    if (on) {
      const me = o.team,
        them = 1 - me;
      const mine = me === 0 ? on.c : -on.c; // control: +1 ours .. -1 theirs (defenders hold +1)
      const pct = Math.round(((mine + 1) / 2) * 100);
      const nMe = on.count[me],
        nThem = on.count[them];
      const name = on.name && on.name !== on.id ? `${on.id} ${on.name}` : on.id;
      const text = nMe && nThem ? `${name}: contested, ${nMe} against ${nThem}` : on.owner === me ? (Math.abs(on.c) < 0.999 ? `Retaking ${name}: ${pct}%` : `Holding ${name}`) : nThem && !nMe ? `${name}: enemies on it` : `Taking ${name}: ${pct}%`;
      ctx.font = '600 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = nMe && nThem ? 'rgba(255, 214, 110, 0.95)' : 'rgba(245, 240, 225, 0.95)';
      ctx.fillText(text, w / 2, 104);
    }
    ctx.restore();
  }

  // A point's diamond: its owner's color (pale while nobody holds it), pulsing
  // while both sides are on it, with its letter and a ring for how far control
  // has swung when it is changing hands.
  _pointDiamond(ctx, x, y, r, pt, me, alpha, label, t) {
    const col = pt.owner === null ? '232, 224, 200' : pt.owner === me ? '95, 149, 214' : '208, 96, 78';
    const contested = pt.count[0] > 0 && pt.count[1] > 0;
    const k = contested ? 0.65 + 0.35 * Math.sin(t * 8) : 1;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fillStyle = `rgba(${col}, ${0.9 * k * alpha})`;
    ctx.fill();
    ctx.lineWidth = r > 10 ? 2 : 1.2;
    ctx.strokeStyle = pt.kind === 'objective' ? 'rgba(255, 230, 160, 0.95)' : 'rgba(20, 20, 16, 0.85)';
    ctx.stroke();
    if (!label) return;
    if (Math.abs(pt.c) < 0.999) {
      const mine = me === 0 ? pt.c : -pt.c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + ((mine + 1) / 2) * Math.PI * 2);
      ctx.strokeStyle = 'rgba(95, 149, 214, 0.95)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r + 5, -Math.PI / 2 + ((mine + 1) / 2) * Math.PI * 2, Math.PI * 1.5);
      ctx.strokeStyle = 'rgba(208, 96, 78, 0.95)';
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(16, 16, 12, 0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${r > 10 ? 11 : 9}px sans-serif`;
    ctx.fillText(pt.id, x, y + 0.5);
    ctx.shadowBlur = 3;
  }

  // Back in the fight: say where to go.
  _spawnHint(p) {
    const s = p.soldier;
    const was = this._wasAlive;
    this._wasAlive = s.alive;
    if (!s.alive || was !== false) return;
    const mode = this.game.mode;
    const b = s.body;
    const a = mode?.suggestedPoint?.(s.team, b.x, b.z);
    if (!a) return;
    const pt = a.p;
    const d = Math.hypot(pt.x - b.x, pt.z - b.z);
    const deg = ((Math.atan2(pt.x - b.x, -(pt.z - b.z)) / DEG) + 360) % 360;
    const way = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(deg / 45) % 8];
    const name = pt.name && pt.name !== pt.id ? `${pt.id} (${pt.name})` : pt.id;
    this.hint(`Next: ${a.role === 'attack' ? 'take' : 'hold'} ${name}, ${Math.round(d / 10) * 10} m ${way}.`, 7);
  }

  // Live grenades within 12 m (your own once it has had time to get away from you).
  _nearGrenades(p) {
    const out = (this._nades ||= []);
    out.length = 0;
    const s = p.soldier;
    if (!s.alive || !this.game.settings.get('grenadeWarning')) return out;
    const b = s.body;
    for (const q of this.game.projectiles.active) {
      if (!q.ammo.thrown || !q.alive || (q.owner === s && q.age < 1.2 && !q.resting)) continue;
      const d = Math.hypot(q.x - b.x, q.z - b.z);
      if (d < 12 && Math.abs(q.y - b.y) < 5) out.push({ q, d, lethal: d < (q.ammo.explosive?.radius ?? 6) });
    }
    return out;
  }

  // A grenade mark on each: on the grenade if it's in view, else at the edge of
  // the ring pointing to it. Red and blinking when it can hurt you.
  _drawGrenades(ctx, nades, b, camYaw, cx, cy, R) {
    const cam = this.game.camera;
    const c = this.shotsCanvas;
    const blink = 0.65 + 0.35 * Math.sin(performance.now() / 90);
    for (const { q, d, lethal } of nades) {
      const v = _cv.set(q.x, q.y + 0.15, q.z).project(cam);
      let x, y, edge;
      if (v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95) {
        x = (v.x * 0.5 + 0.5) * c.width;
        y = (0.5 - v.y * 0.5) * c.height - 18;
      } else {
        const th = shotMarkAngle(b.x, b.z, q.x, q.z, camYaw);
        x = cx + Math.cos(th) * (R + 26);
        y = cy + Math.sin(th) * (R + 26);
        edge = th;
      }
      const col = lethal ? `rgba(226, 52, 34, ${blink})` : 'rgba(255, 236, 190, 0.9)';
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      // The grenade: a round body, the fuze and lever on top, the ring beside.
      ctx.beginPath();
      ctx.arc(0, 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-3, -8, 6, 5);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(6, -8, 3, 0, Math.PI * 2);
      ctx.stroke();
      if (edge !== undefined) {
        // Pointing out toward it.
        const ux = Math.cos(edge),
          uy = Math.sin(edge);
        ctx.beginPath();
        ctx.moveTo(ux * 20, uy * 20);
        ctx.lineTo(ux * 13 - uy * 5, uy * 13 + ux * 5);
        ctx.lineTo(ux * 13 + uy * 5, uy * 13 - ux * 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.font = '600 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(d)} m`, 0, 22);
      ctx.restore();
    }
  }

  // On foot next to a vehicle or bike: which key gets you in, and where you'd
  // sit. With a kit in hand, who it would treat; with the wrench, the damaged
  // vehicle it would mend (the fire key).
  _updateUse(p, dt) {
    const u = this.use;
    const s = p.soldier;
    u.t -= dt;
    if (u.t <= 0) {
      u.t = 0.15;
      let text = '',
        key = '';
      if (s.alive && !s.vehicle && this.game.cameraMode === 'first') {
        const input = this.game.input;
        const w = s.weapon;
        const pick = p.nearestPickup?.();
        const near = pick ? null : p.nearestVehicle();
        const man = !pick && isHealKit(w?.def) && w.uses > 0 && !s.action ? healTarget(this.game, s, w.def.reach) : null;
        const v = !pick && w?.def.type === 'wrench' && s.action !== 'repair' ? repairTarget(this.game, s, w.def.reach) : null;
        const damaged = v?.alive && (v.hp < v.maxHp || Object.values(v.modules || {}).some((m) => m < 1));
        if (pick) {
          const d = pick.w.def;
          text = d.type === 'melee' || d.type === 'binoculars' ? `Pick up: ${d.name}` : `Pick up: ${d.name} (${pick.w.kit ? `${pick.w.uses ?? 'no'} uses` : `${pick.w.loaded + pick.w.reserveRounds} rounds`})`;
          key = input.key('use');
        } else if (man) {
          text = `Treat ${man.name}`;
          key = input.key('fire');
        } else if (damaged) {
          text = v.fire > 0 ? `${v.def.name} is burning` : `Repair ${v.def.name}`;
          key = v.fire > 0 ? '' : input.key('fire');
        } else if (near && s.action !== 'repair') {
          text = near.seat < 0 ? `${near.v.def.name}: no free seat` : `Get in: ${near.v.def.name} (${near.v.seats[near.seat].name})`;
          key = near.seat < 0 ? '' : input.key('use');
        }
      }
      if (text !== u.text || key !== u.key) {
        u.text = text;
        u.key = key;
        this.useEl.querySelector('.k').textContent = key;
        this.useEl.querySelector('.k').hidden = !key;
        this.useEl.querySelector('.t').textContent = text;
        this.useEl.style.display = text ? 'flex' : 'none';
      }
    }
  }

  // Hip-fire crosshair: four ticks round the point the gun points at (where hip
  // shots go, HIP_CONVERGE ahead, so it follows the kick and the gun's lag when
  // turning), as far apart as the shots spread right now: most shots (about 6 in
  // 7, two standard deviations) land inside the ticks. It fades out as the sights
  // come up to the eye, and while sprinting, switching weapons, or in a vehicle.
  _updateCrosshair(p, dt) {
    const c = this.cross;
    const s = p.soldier;
    const w = s.weapon;
    const vm = p.viewmodel;
    const cam = p.camera;
    let want = 0;
    if (this.game.settings.get('crosshair') && this.game.cameraMode === 'first' && s.alive && !s.vehicle && w && w.def.type !== 'grenade' && w.def.type !== 'melee' && w.def.type !== 'binoculars' && !w.kit && vm.gun && vm.visible) {
      want = clamp01(1 - vm.aim * 2) * (1 - vm.sprint) * vm.swap * (1 - vm.blocked) * (vm.action ? 0.5 : 1);
    }
    c.a = damp(c.a, want, 16, dt);
    const shown = c.a > 0.02;
    if (shown !== (c.shown === 1)) {
      this.crossEl.style.display = shown ? 'block' : 'none';
      c.shown = shown ? 1 : 0;
    }
    if (!shown) return;
    const halfH = window.innerHeight / 2;
    const tanHalf = Math.tan((cam.fov * DEG) / 2);
    const r = (Math.tan(2 * p.spread(w, false)) / tanHalf) * halfH;
    c.r = damp(c.r, Math.max(4, r), 12, dt);
    _cv.copy(vm.muzzleWorld).addScaledVector(vm.boreWorld, HIP_CONVERGE).project(cam);
    const ok = _cv.z < 1;
    const x = ok ? clamp(_cv.x, -0.4, 0.4) * (window.innerWidth / 2) : 0;
    const y = ok ? clamp(-_cv.y, -0.4, 0.4) * halfH : 0;
    this.crossEl.style.opacity = c.a.toFixed(3);
    this.crossEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.crossEl.style.setProperty('--gap', `${c.r.toFixed(1)}px`);
  }

  // Hold Tab: both sides' soldiers with kills, deaths and score.
  _updateScores(g) {
    const el = (this.scoresEl ??= this.el('.hud-scores'));
    // (Not over the battle results, which have their own summary.)
    const show = (g.input.is('scores') || !!g.mode?.over) && !this.root.querySelector('.battle-result');
    el.style.display = show ? 'flex' : 'none';
    if (!show) return;
    this._scoreT = (this._scoreT || 0) + 1;
    if (this._scoreT % 15 !== 1) return;
    const me = g.player.soldier;
    const teams = [...new Set(g.soldiers.map((s) => s.team))].sort((a, b) => (a === me.team ? -1 : b === me.team ? 1 : a - b));
    const side = (t) => {
      const list = g.soldiers.filter((s) => s.team === t).sort((a, b) => b.score - a.score || b.kills - a.kills);
      const f = list[0]?.faction;
      const rows = list.map((s) => `<tr class="${s === me ? 'me' : ''}${s.alive ? '' : ' dead'}"><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.score}</td></tr>`).join('');
      return `<div class="side ${t === me.team ? 'own' : 'enemy'}"><h3>${f ? (FACTION_ARMY[f] || f) : ''}${g.mode?.points ? (t === 1 ? ' · attacking' : ' · defending') : ''}</h3><table><tr><th>Soldier</th><th>K</th><th>D</th><th>Score</th></tr>${rows}</table></div>`;
    };
    el.innerHTML = teams.map(side).join('');
  }

  // Speed, gear, engine, damage, gun and seat while in a vehicle.
  _updateVehicle(p) {
    const s = p.soldier;
    const v = s.vehicle;
    const inV = !!v && s.alive;
    this.vehEl.style.display = inV ? 'block' : 'none';
    this.el('.hud-right').style.display = inV ? 'none' : 'block';
    this.el('.hud-stance').style.display = inV ? 'none' : 'block';
    const vc = p.vehicleCtl;
    const role = inV ? vc.role : null;
    const showMark = inV && ((role === 'gunner' && !vc.sight) || (role === 'sidecarMg' && vc.view !== 'first')) && v.alive;
    this.gunMark.style.display = showMark ? 'block' : 'none';
    this.tankDir.style.display = inV && v.def.kind === 'tracked' ? 'block' : 'none';
    if (!inV) return;
    const E = this.vEls;
    const d = v.def;
    E.name.textContent = v.alive ? d.name : `${d.name} (destroyed)`;
    E.speed.textContent = `${Math.round(Math.abs(v.speed) * 3.6)} km/h`;
    if (d.pedal) {
      // Bicycle: what the legs are doing instead of a gear, and how hard (600 W
      // is a strong sprint).
      const effort = { sprint: 'pedaling hard', cruise: 'pedaling', spent: 'out of breath', coast: 'coasting', walk: 'walking it up' };
      E.gear.textContent = v.fallen ? 'on its side' : effort[v.effort] || '';
      E.rpm.style.width = `${Math.min(100, ((v.power || 0) / 600) * 100)}%`;
      E.rpm.style.background = v.effort === 'sprint' ? '#d29a4a' : '#8a9b6a';
    } else {
      const gear = v.shiftTimer > 0 ? '-' : v.gear < 0 ? 'R' : v.gear === 0 ? 'N' : String(v.gear);
      E.gear.textContent = `gear ${gear}${v.offroad ? ' (off-road)' : ''}`;
      E.rpm.style.width = `${Math.min(100, (v.rpm / d.engine.redline) * 100)}%`;
      E.rpm.style.background = v.rpm > d.engine.redline * 0.95 ? '#d29a4a' : '#8a9b6a';
    }
    const hp = Math.max(0, v.hp / v.maxHp);
    // The bar tells the same story as the smoke (see DAMAGE_STAGES): amber once
    // the engine smokes, red when badly hurt, pulsing when almost destroyed, with
    // a plain warning under it.
    const stage = v.alive ? Math.min(3, healthStage(hp)) : 4;
    E.hp.style.width = `${hp * 100}%`;
    E.hp.style.background = stage === 0 ? '#c9c2a5' : stage === 1 ? '#d29a4a' : '#c4513f';
    const warn = stage === 3 ? (v.isBike ? 'Almost wrecked: get off!' : 'Almost destroyed: get out!') : stage === 2 ? 'Badly damaged' : '';
    if (E.warn.textContent !== warn) E.warn.textContent = warn;
    E.warn.style.display = warn ? 'block' : 'none';
    E.warn.classList.toggle('crit', stage === 3);
    E.hpBar.classList.toggle('crit', stage === 3);
    // Said once in the middle of the screen too, where a driver is looking.
    if (stage === 3 && this._warnedFor !== v) {
      this._warnedFor = v;
      this.flash(warn, 3);
    }
    const m = v.modules;
    const bad = [];
    if (m.engine <= 0) bad.push('engine destroyed');
    else if (m.engine < 1) bad.push('engine damaged');
    if (m.transmission <= 0) bad.push('transmission destroyed');
    if (m.trackL <= 0) bad.push('left track broken');
    if (m.trackR <= 0) bad.push('right track broken');
    if (m.turret <= 0) bad.push('turret ring jammed');
    if (m.gun <= 0) bad.push('gun disabled');
    if (m.fuel <= 0) bad.push('fuel tank holed');
    if (m.tireF <= 0) bad.push('front tire flat');
    if (m.tireR <= 0) bad.push('rear tire flat');
    if (m.tireS <= 0) bad.push('sidecar tire flat');
    if (v.fallen && !d.pedal) bad.push('on its side');
    if (v.fire > 0 && v.alive) bad.push('ON FIRE');
    E.mods.textContent = bad.join(' · ');
    E.mods.style.display = bad.length ? 'block' : 'none';
    if (role === 'gunner') {
      const types = v.ammoTypes.map((id, i) => `${i + 1} ${id} ${v.stowed[id] + (v.loaded === id ? 1 : 0)}${v.nextAmmo === id ? '*' : ''}`).join('   ');
      const state = v.loaded ? `${v.loaded} loaded` : v.nextAmmo ? 'loading...' : 'no ammunition';
      E.gun.textContent = `${state} · sight ${v.sightRange} m\n${types}\ncoax ${v.coax.loaded}/${v.coax.belts} belts`;
      E.reloadBar.style.display = 'block';
      const frac = v.loaded ? 1 : 1 - Math.max(0, v.reloadT) / d.gun.reload;
      E.reload.style.width = `${clamp01(frac) * 100}%`;
    } else if (role === 'bowMg') {
      E.gun.textContent = `${d.bowMg.name} · ${v.bowMg.loaded} / ${v.bowMg.belts} belts${v.bowMg.reloadT > 0 ? ' · reloading' : ''}`;
      E.reloadBar.style.display = 'none';
    } else if (role === 'sidecarMg' && v.mg) {
      E.gun.textContent = `${d.sidecarMg.name} · ${v.mg.loaded} / ${v.mg.belts} belts${v.mg.reloadT > 0 ? ' · reloading' : ''}`;
      E.reloadBar.style.display = 'none';
    } else {
      E.gun.textContent = '';
      E.reloadBar.style.display = 'none';
    }
    E.seat.textContent = `${v.seats[s.seat]?.name || ''} · F exit · V camera · F1-F${v.seats.length} seats`;
    // Turret direction relative to the hull (top view, camera up).
    if (v.def.kind === 'tracked') {
      const camYaw = p.camera.rotation.y;
      const f = v.forward;
      const hullYaw = Math.atan2(-f.x, -f.z);
      this.tankDirHull.style.transform = `rotate(${(-(hullYaw - camYaw) * 180) / Math.PI}deg)`;
      this.tankDirTurret.style.transform = `rotate(${(-(hullYaw + v.turretYaw - camYaw) * 180) / Math.PI}deg)`;
    }
    if (showMark) {
      const pt = vc.gunPoint.clone().project(p.camera);
      const W = this.root.clientWidth,
        H = this.root.clientHeight;
      if (pt.z < 1) {
        this.gunMark.style.left = `${((pt.x + 1) / 2) * W}px`;
        this.gunMark.style.top = `${((1 - pt.y) / 2) * H}px`;
      }
      this.gunMark.classList.toggle('ready', role === 'sidecarMg' ? v.mg?.reloadT <= 0 : !!v.loaded);
    }
  }

  // Telescopic sight picture: black around the eyepiece and the period reticle.
  _drawScope(p) {
    const vc = p.vehicleCtl;
    const v = p.soldier.vehicle;
    if (v && p.soldier.alive && vc && ((vc.role === 'gunner' && vc.sight) || (vc.role === 'bowMg' && vc.view === 'first' && v.def.bowMg.sight))) {
      const sd = vc.role === 'gunner' ? v.def.gun.sight : v.def.bowMg.sight;
      const key = `tank:${v.id}:${vc.role}:${v.sightRange}:${v.loaded}:${this.scope.width}x${this.scope.height}`;
      if (key === this.lastScope) return;
      this.lastScope = key;
      drawTankSight(this.scopeCtx, this.scope.width, this.scope.height, sd, vc.role === 'gunner' ? v : null, p.camera.fov);
      this.scope.style.display = 'block';
      return;
    }
    const w = p.soldier.weapon;
    const show = p.scoped && w?.scope && !v;
    const key = show ? `${w.def.id}:${this.scope.width}x${this.scope.height}` : null;
    if (key === this.lastScope) return;
    this.lastScope = key;
    const c = this.scopeCtx;
    const W = this.scope.width,
      H = this.scope.height;
    c.clearRect(0, 0, W, H);
    this.scope.style.display = show ? 'block' : 'none';
    if (!show) return;
    const sc = w.scope;
    if (w.def.type === 'binoculars') {
      drawBinocularView(c, W, H, sc);
      return;
    }
    // Apparent field of view: true field x magnification, relative to the 31.6 deg "1x" view.
    const apparent = Math.min(0.9, (sc.fieldDeg * sc.mag) / 31.6);
    const R = (H * apparent) / 2;
    const cx = W / 2,
      cy = H / 2;
    c.fillStyle = '#000';
    c.beginPath();
    c.rect(0, 0, W, H);
    c.arc(cx, cy, R, 0, Math.PI * 2, true);
    c.fill();
    // Soft dark edge of the eyepiece.
    const g = c.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.9)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#050505';
    c.strokeStyle = '#050505';
    const u = R / 100;
    if (sc.reticle === 'german1' || sc.reticle === 'germanPost') {
      // ZF39 "Absehen 1": a pointed post from below and two thick side bars.
      c.beginPath();
      c.moveTo(cx - 2.2 * u, cy + R);
      c.lineTo(cx - 2.2 * u, cy + 6 * u);
      c.lineTo(cx, cy);
      c.lineTo(cx + 2.2 * u, cy + 6 * u);
      c.lineTo(cx + 2.2 * u, cy + R);
      c.fill();
      // (The ZF 41's post stands alone.)
      if (sc.reticle === 'german1') {
        c.fillRect(cx - R, cy - 1.6 * u, R - 14 * u, 3.2 * u);
        c.fillRect(cx + 14 * u, cy - 1.6 * u, R - 14 * u, 3.2 * u);
      }
    } else if (sc.reticle === 'soviet') {
      // PU: pointed post from below, thin tapered side lines.
      c.beginPath();
      c.moveTo(cx - 2 * u, cy + R);
      c.lineTo(cx - 2 * u, cy + 5 * u);
      c.lineTo(cx, cy);
      c.lineTo(cx + 2 * u, cy + 5 * u);
      c.lineTo(cx + 2 * u, cy + R);
      c.fill();
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.moveTo(cx + sgn * R, cy - 1.2 * u);
        c.lineTo(cx + sgn * 10 * u, cy - 0.3 * u);
        c.lineTo(cx + sgn * 10 * u, cy + 0.3 * u);
        c.lineTo(cx + sgn * R, cy + 1.2 * u);
        c.fill();
      }
    } else if (sc.reticle === 'post') {
      // M82: a post from below, tapering to a flat tip at the center.
      c.beginPath();
      c.moveTo(cx - 3.2 * u, cy + R);
      c.lineTo(cx - 3.2 * u, cy + 18 * u);
      c.lineTo(cx - 0.9 * u, cy);
      c.lineTo(cx + 0.9 * u, cy);
      c.lineTo(cx + 3.2 * u, cy + 18 * u);
      c.lineTo(cx + 3.2 * u, cy + R);
      c.fill();
    } else if (sc.reticle === 'fineDuplex') {
      // Duplex: thick wires in from the edge, thinning to fine wires across the middle.
      c.lineWidth = Math.max(1, 0.5 * u);
      c.beginPath();
      c.moveTo(cx - R, cy);
      c.lineTo(cx + R, cy);
      c.moveTo(cx, cy - R);
      c.lineTo(cx, cy + R);
      c.stroke();
      const t = 2.4 * u;
      c.fillRect(cx - R, cy - t / 2, R - 30 * u, t);
      c.fillRect(cx + 30 * u, cy - t / 2, R - 30 * u, t);
      c.fillRect(cx - t / 2, cy - R, t, R - 30 * u);
      c.fillRect(cx - t / 2, cy + 30 * u, t, R - 30 * u);
    } else if (sc.reticle === 'german4') {
      // "Absehen 4": thick posts from the left, the right and below, ending short
      // of the center, and a fine crosshair between them.
      c.lineWidth = Math.max(1, 0.5 * u);
      c.beginPath();
      c.moveTo(cx - R, cy);
      c.lineTo(cx + R, cy);
      c.moveTo(cx, cy - R);
      c.lineTo(cx, cy + R);
      c.stroke();
      c.fillRect(cx - R, cy - 1.8 * u, R - 16 * u, 3.6 * u);
      c.fillRect(cx + 16 * u, cy - 1.8 * u, R - 16 * u, 3.6 * u);
      c.fillRect(cx - 2 * u, cy + 16 * u, 4 * u, R - 16 * u);
    } else if (sc.reticle === 'tPost') {
      // A thick flat-topped post from below to the center, a fine wire across.
      c.lineWidth = Math.max(1, 0.5 * u);
      c.beginPath();
      c.moveTo(cx - R, cy);
      c.lineTo(cx + R, cy);
      c.stroke();
      c.fillRect(cx - 2.6 * u, cy, 5.2 * u, R);
    } else if (sc.reticle === 'infantry' || sc.reticle === 'infantryMarksman') {
      // A plain pointed post from below with a short tip; the marksman's adds
      // fine side bars ending short of the center.
      c.beginPath();
      c.moveTo(cx - 1.8 * u, cy + R);
      c.lineTo(cx - 1.8 * u, cy + 3 * u);
      c.lineTo(cx, cy);
      c.lineTo(cx + 1.8 * u, cy + 3 * u);
      c.lineTo(cx + 1.8 * u, cy + R);
      c.fill();
      if (sc.reticle === 'infantryMarksman') {
        c.fillRect(cx - R, cy - 0.5 * u, R - 12 * u, u);
        c.fillRect(cx + 12 * u, cy - 0.5 * u, R - 12 * u, u);
      }
    } else {
      // Crosshair: fine, or medium wires (the Marine Corps' Unertl).
      c.lineWidth = Math.max(1, (sc.reticle === 'crosshairMedium' ? 1.2 : 0.6) * u);
      c.beginPath();
      c.moveTo(cx - R, cy);
      c.lineTo(cx + R, cy);
      c.moveTo(cx, cy - R);
      c.lineTo(cx, cy + R);
      c.stroke();
    }
  }
}

// Tank gunner's sight: round field (90% of the screen height = the true field of
// view), with each army's reticle. 1 mil = 1/6400 of a circle (German "Strich").
function drawTankSight(c, W, H, sd, v, fovDeg) {
  c.clearRect(0, 0, W, H);
  // Pixels per radian at the screen center for the camera's field of view.
  const f = H / 2 / Math.tan((fovDeg * Math.PI) / 360);
  const R = Math.min(H * 0.48, f * Math.tan((sd.fieldDeg * Math.PI) / 360));
  const cx = W / 2,
    cy = H / 2;
  c.fillStyle = '#000';
  c.beginPath();
  c.rect(0, 0, W, H);
  c.arc(cx, cy, R, 0, Math.PI * 2, true);
  c.fill();
  const g = c.createRadialGradient(cx, cy, R * 0.8, cx, cy, R);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.85)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cy, R, 0, Math.PI * 2);
  c.fill();
  // Pixels per mil (1/6400 of a circle) at the center of the view.
  const mil = f * ((2 * Math.PI) / 6400);
  const ink = 'rgba(8,8,8,0.92)';
  c.fillStyle = ink;
  c.strokeStyle = ink;
  c.lineWidth = Math.max(1, mil * 0.15);
  const reticle = sd.reticle || 'german';
  if (reticle === 'german') {
    // TZF 5: a big aiming triangle with smaller ones every 4 mils for lead.
    const tri = (x, h, w) => {
      c.beginPath();
      c.moveTo(x, cy);
      c.lineTo(x - w / 2, cy + h);
      c.lineTo(x + w / 2, cy + h);
      c.closePath();
      c.fill();
    };
    tri(cx, 4 * mil, 4 * mil);
    for (let k = 1; k <= 6; k++) {
      tri(cx - k * 8 * mil, 2 * mil, 2 * mil);
      tri(cx + k * 8 * mil, 2 * mil, 2 * mil);
    }
    c.fillRect(cx - 0.12 * mil, cy + 4 * mil, 0.24 * mil, R);
  } else if (reticle === 'us') {
    // M70: crosshair line with mil marks for lead; range lines below the center.
    c.beginPath();
    c.moveTo(cx - R, cy);
    c.lineTo(cx - 2 * mil, cy);
    c.moveTo(cx + 2 * mil, cy);
    c.lineTo(cx + R, cy);
    c.moveTo(cx, cy - R);
    c.lineTo(cx, cy - 2 * mil);
    c.stroke();
    for (let k = 1; k <= 8; k++) {
      for (const sgn of [-1, 1]) {
        const x = cx + sgn * k * 5 * mil;
        c.beginPath();
        c.moveTo(x, cy - mil * (k % 2 ? 1 : 2));
        c.lineTo(x, cy + mil * (k % 2 ? 1 : 2));
        c.stroke();
      }
    }
    for (let k = 0; k <= 6; k++) {
      const y = cy + k * 4 * mil;
      c.beginPath();
      c.moveTo(cx - mil * (k % 2 ? 1.5 : 3), y);
      c.lineTo(cx + mil * (k % 2 ? 1.5 : 3), y);
      c.stroke();
    }
  } else {
    // Soviet TMFD: an inverted V aiming mark with smaller marks every 4 mils.
    const chev = (x, s) => {
      c.beginPath();
      c.moveTo(x - 2 * s * mil, cy + 3 * s * mil);
      c.lineTo(x, cy);
      c.lineTo(x + 2 * s * mil, cy + 3 * s * mil);
      c.stroke();
    };
    c.lineWidth = Math.max(1.5, mil * 0.35);
    chev(cx, 1);
    c.lineWidth = Math.max(1, mil * 0.2);
    for (let k = 1; k <= 5; k++) {
      chev(cx - k * 8 * mil, 0.5);
      chev(cx + k * 8 * mil, 0.5);
    }
  }
  // Sight label: range drum setting and the shell it's graduated for.
  if (v) {
    c.font = `${Math.round(H * 0.022)}px monospace`;
    c.fillStyle = 'rgba(20,20,20,0.85)';
    c.textAlign = 'left';
    c.fillText(`${v.sightRange} m  ${v.loaded || v.nextAmmo || ''}`, cx - R * 0.62, cy + R * 0.72);
    c.textAlign = 'right';
    c.fillText(sd.name || '', cx + R * 0.62, cy + R * 0.72);
  }
}

// The view through binoculars raised to the eyes: the classic figure-eight of
// the two eyepieces, black round it, and the army's reticle. The camera shows
// the real magnification (player.js, as for a scope); the two circles together
// span the glasses' true field of view across (8.5 degrees for a 6x30), each
// as tall as the screen allows. The reticle sits in one eyepiece of the real
// glasses, but with both eyes open it is seen over the one picture the eyes
// make of the two, in its middle: drawn so here, over both circles, at the
// center of the view (where spotting looks). Mils: 1/6400 of a circle (US and
// German, the "Strich"); the Red Army's thousandths: 1/6000.
function drawBinocularView(c, W, H, sc) {
  const fov = 2 * Math.atan(Math.tan((31.6 * Math.PI) / 360) / sc.mag); // (player.js: 31.6 deg is "1x")
  const f = H / 2 / Math.tan(fov / 2); // pixels per radian at the center
  let r = H * 0.47;
  const span = Math.min(W * 0.98, 2 * f * Math.tan((sc.fieldDeg * Math.PI) / 360));
  if (span < 2.3 * r) r = span / 2.3; // (a narrow window: smaller circles, still two)
  const off = span / 2 - r;
  const cx = W / 2,
    cy = H / 2;
  const circles = [cx - off, cx + off];
  const union = () => {
    c.beginPath();
    for (const x of circles) {
      c.moveTo(x + r, cy);
      c.arc(x, cy, r, 0, Math.PI * 2);
    }
  };
  c.save();
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'destination-out';
  union();
  c.fill('nonzero');
  c.globalCompositeOperation = 'source-over';
  // The dark rim of each eyepiece, but not across the other's picture.
  circles.forEach((x, i) => {
    const o = circles[1 - i];
    c.save();
    c.beginPath();
    c.rect(0, 0, W, H);
    c.arc(o, cy, r, 0, Math.PI * 2);
    c.clip('evenodd');
    const g = c.createRadialGradient(x, cy, r * 0.84, x, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.9)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, cy, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });
  // The reticle, inside the picture only.
  union();
  c.clip('nonzero');
  const mil = f * ((2 * Math.PI) / (sc.reticle === 'binoSU' ? 6000 : 6400));
  const ink = 'rgba(10,10,10,0.9)';
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = Math.max(1, mil * 0.1);
  c.textAlign = 'center';
  c.textBaseline = 'bottom';
  c.font = `${Math.max(9, Math.round(mil * 1.5))}px sans-serif`;
  const line = (x0, y0, x1, y1) => {
    c.beginPath();
    c.moveTo(cx + x0 * mil, cy + y0 * mil);
    c.lineTo(cx + x1 * mil, cy + y1 * mil);
    c.stroke();
  };
  const label = (x, y, text) => c.fillText(text, cx + x * mil, cy + y * mil);
  if (sc.reticle === 'binoUS') {
    // M3 (TM 9-575): a horizontal mil scale, a mark every 10 mils from 50 left
    // to 50 right of the center, numbered in tens.
    line(-50, 0, 50, 0);
    for (let m = -50; m <= 50; m += 10) {
      const long = m === 0 ? 4 : 2;
      line(m, -long, m, long);
      if (m) label(m, -2.4, `${Math.abs(m / 10)}`);
    }
  } else if (sc.reticle === 'binoGE') {
    // Dienstglas "Strichplatte" (est. from photos): a horizontal scale with a
    // mark every 5 Strich (longer at the tens) and a vertical one rising from
    // the middle, for widths and heights to judge range by.
    line(-50, 0, 50, 0);
    for (let m = -50; m <= 50; m += 5) {
      const long = m % 10 ? 1 : 2;
      line(m, 0, m, -long);
      if (m && m % 20 === 0) label(m, -2.6, `${Math.abs(m / 10)}`);
    }
    line(0, 0, 0, -25);
    for (let m = 5; m <= 25; m += 5) line(-(m % 10 ? 1 : 2), -m, m % 10 ? 1 : 2, -m);
  } else {
    // Soviet B-6 (est.): a horizontal scale in thousandths, a mark every 0-05
    // (longer at each 0-10), a vertical scale at its middle and one at its
    // left end, rising to 0-20.
    line(-40, 0, 40, 0);
    for (let m = -40; m <= 40; m += 5) {
      const long = m % 10 ? 1.2 : 2.4;
      line(m, -long / 2, m, long / 2);
      if (m && m % 20 === 0) label(m, -1.8, `${Math.abs(m / 10)}`);
    }
    for (const x of [0, -40]) {
      line(x, 0, x, -20);
      for (let m = 5; m <= 20; m += 5) line(x - (m % 10 ? 0.8 : 1.6), -m, x + (m % 10 ? 0.8 : 1.6), -m);
    }
  }
  c.restore();
}
