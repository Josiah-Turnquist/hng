// Heads-up display. Kept sparse and period-appropriate like the original game:
// no crosshair (you aim with the real sights), ammo and sight setting at the
// bottom right, health and stamina at the bottom left, a compass at the top.
import { STANCE } from '../actors/body.js';
import { damp } from '../core/math.js';

const STANCE_NAMES = ['Standing', 'Crouched', 'Prone'];

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
      <div class="hud-center"><div class="hitmark"></div><div class="dot"></div></div>
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
      <canvas class="hud-scope"></canvas>
      <div class="hud-dead"><div class="title">You were killed</div><div class="by"></div><div class="hint">Press SPACE to redeploy</div></div>`;
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
    this.hintEl = this.el('.hud-hint');
    this.deadEl = this.el('.hud-dead');
    this.objectivesEl = this.el('.hud-objectives');
    this.scope = this.el('.hud-scope');
    this.scopeCtx = this.scope.getContext('2d');
    this.damageFlash = 0;
    this.msgT = 0;
    this.hitT = 0;
    this._buildCompass();
    this.lastScope = null;
    this.hint('Click to play. WASD move, Shift sprint, C crouch, Z prone, Space jump, Q/E lean, RMB aim, mouse wheel while aiming = sight range, R reload, B fire mode, X bandage, 1/2/3 weapons.', 12);
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
    this.lastScope = null;
  }

  weaponChanged(w) {
    this.weaponEl.textContent = w.def.name;
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

  damage(amount) {
    this.damageFlash = Math.min(1, this.damageFlash + amount / 50);
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
    const act = s.action === 'bandage' ? ' · bandaging' : s.action === 'firstaid' ? ' · first aid' : '';
    this.stanceEl.textContent = `${STANCE_NAMES[b.targetStance]}${b.sprinting ? ' · sprinting' : ''}${p.holdingBreath ? ' · holding breath' : ''}${act}`;
    if (w) {
      const d = w.def;
      if (d.type === 'grenade') {
        this.loadedEl.textContent = `${(w.chambered ? 1 : 0) + (w.spareMags?.length || 0)}`;
        this.reserveEl.textContent = '';
        this.modeEl.textContent = 'Hold LMB to cook, release to throw';
      } else {
        this.loadedEl.textContent = `${w.loaded}`;
        const unit = d.feed === 'stripper' ? 'clips' : d.feed === 'enbloc' ? 'clips' : d.feed === 'belt' ? 'belts' : d.feed === 'drum' ? 'drums' : d.feed === 'pan' ? 'pans' : d.feed === 'single' ? 'rounds' : d.feed === 'gate' ? 'rounds' : d.feed === 'moon' ? 'clips' : 'mags';
        this.reserveEl.textContent = ` / ${w.reserveUnits} ${unit}`;
        const mode = w.mode === 'bolt' ? 'bolt action' : w.mode === 'slow' ? 'auto (slow)' : w.mode;
        const status = w.state === 'reloading' ? ' · reloading' : w.needsCycle ? ' · work bolt' : w.loaded === 0 ? ' · empty' : '';
        const heat = w.heat > 120 ? ' · barrel hot' : '';
        this.modeEl.textContent = `${mode} · sight ${w.zeroRange} ${d.sight.unit}${status}${heat}`;
      }
    }
    // Compass: 30 px per 15 degrees.
    const deg = ((-p.look.yaw * 180) / Math.PI) % 360;
    const heading = (deg + 360) % 360;
    this.compassStrip.style.transform = `translateX(${-(heading / 15) * 30 - 360 / 15 * 30 + 150}px)`;

    this.msgT -= dt;
    this.msgEl.style.opacity = this.msgT > 0 ? Math.min(1, this.msgT * 3) : 0;
    this.hintT -= dt;
    this.hintEl.style.opacity = this.hintT > 0 ? Math.min(1, this.hintT) : 0;
    this.hitT -= dt;
    this.hitEl.style.opacity = this.hitT > 0 ? 1 : 0;
    this.damageFlash = damp(this.damageFlash, s.health < 30 ? 0.35 : 0, 1.5, dt);
    this.deadEl.style.display = s.alive ? 'none' : 'flex';
    if (!s.alive && s.killer) this.el('.hud-dead .by').textContent = `by ${s.killer.name}`;
    this._drawScope(p);
  }

  // Telescopic sight picture: black around the eyepiece and the period reticle.
  _drawScope(p) {
    const w = p.soldier.weapon;
    const show = p.scoped && w?.def.scope;
    const key = show ? `${w.def.id}:${this.scope.width}x${this.scope.height}` : null;
    if (key === this.lastScope) return;
    this.lastScope = key;
    const c = this.scopeCtx;
    const W = this.scope.width,
      H = this.scope.height;
    c.clearRect(0, 0, W, H);
    this.scope.style.display = show ? 'block' : 'none';
    if (!show) return;
    const sc = w.def.scope;
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
    if (sc.reticle === 'german1') {
      // ZF39 "Absehen 1": a pointed post from below and two thick side bars.
      c.beginPath();
      c.moveTo(cx - 2.2 * u, cy + R);
      c.lineTo(cx - 2.2 * u, cy + 6 * u);
      c.lineTo(cx, cy);
      c.lineTo(cx + 2.2 * u, cy + 6 * u);
      c.lineTo(cx + 2.2 * u, cy + R);
      c.fill();
      c.fillRect(cx - R, cy - 1.6 * u, R - 14 * u, 3.2 * u);
      c.fillRect(cx + 14 * u, cy - 1.6 * u, R - 14 * u, 3.2 * u);
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
    } else {
      // Fine crosshair.
      c.lineWidth = Math.max(1, 0.6 * u);
      c.beginPath();
      c.moveTo(cx - R, cy);
      c.lineTo(cx + R, cy);
      c.moveTo(cx, cy - R);
      c.lineTo(cx, cy + R);
      c.stroke();
    }
  }
}
