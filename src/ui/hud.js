// Heads-up display. Kept sparse and period-appropriate like the original game:
// a small hip-fire crosshair (gone when you aim with the real sights; it can be
// turned off), ammo and sight setting at the bottom right, health and stamina at
// the bottom left, a compass at the top.
import * as THREE from 'three';
import { STANCE } from '../actors/body.js';
import { damp, clamp, clamp01, DEG } from '../core/math.js';
import { HIP_CONVERGE } from '../weapons/viewmodel.js';

const _cv = new THREE.Vector3();

const FACTION_ARMY = { US: 'US Army', GE: 'Wehrmacht', SU: 'Red Army' };

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
      <div class="hud-center"><div class="hud-cross"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="c"></i></div><div class="hitmark"></div></div>
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
        <div class="vmods"></div>
        <div class="vgun"></div>
        <div class="bar reload"><div class="fill"></div></div>
        <div class="vseat"></div>
      </div>
      <div class="hud-gunmark"></div>
      <div class="hud-tankdir"><div class="hull"></div><div class="turret"></div></div>
      <canvas class="hud-scope"></canvas>
      <div class="hud-scores"></div>
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

  setDeploy(text) {
    this.el('.hud-dead .hint').textContent = text;
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
    this.damageFlash = damp(this.damageFlash, s.health < 30 ? 0.35 : 0, 1.5, dt);
    this.deadEl.style.display = s.alive ? 'none' : 'flex';
    if (!s.alive && s.killer) this.el('.hud-dead .by').textContent = `by ${s.killer.name}`;
    this._updateCrosshair(p, dt);
    this._drawScope(p);
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
    if (this.game.settings.get('crosshair') && this.game.cameraMode === 'first' && s.alive && !s.vehicle && w && w.def.type !== 'grenade' && vm.gun && vm.visible) {
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
    const show = g.input.is('scores') || !!g.mode?.over;
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
      const effort = { sprint: 'pedaling hard', cruise: 'pedaling', spent: 'out of breath', coast: 'coasting' };
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
    E.hp.style.width = `${hp * 100}%`;
    E.hp.style.background = hp > 0.5 ? '#c9c2a5' : hp > 0.25 ? '#d29a4a' : '#c4513f';
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
    const show = p.scoped && w?.def.scope && !v;
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
