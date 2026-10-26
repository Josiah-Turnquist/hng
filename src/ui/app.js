// Top-level application: owns the renderer, settings and input, shows the loading
// screen and menus, and starts games.
import * as THREE from 'three';
import { Settings } from '../core/settings.js';
import { Input } from '../core/input.js';
import { Game } from '../game/game.js';
import { AudioSystem } from '../audio/audio.js';
import { PauseMenu } from './menu.js';
import { showFrontEnd } from './frontend.js';
import { loadRoster, saveRoster, awardBattle, rankOf, rankTitle } from './roster.js';
import { emblem, rankBadge } from './icons.js';
import { BattleMap } from './battleMap.js';
import { MAPS } from '../world/maps.js';
import { FACTIONS } from '../weapons/defs.js';

export class App {
  // resume: state handed over from a previous version of the page (see main.js).
  constructor(root, resume = {}) {
    this.root = root;
    this.resume = resume || {};
    this.settings = new Settings();
    this.params = new URLSearchParams(location.search);
  }

  // What a new version of the page needs to pick up where this one was.
  snapshot() {
    return this.opts ? { opts: this.opts } : {};
  }

  async start() {
    const q = this.settings.quality;
    // The interface's typefaces (system fonts stand in where they can't load).
    try {
      const f = document.createElement('link');
      f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap';
      document.head.appendChild(f);
    } catch {
      /* no fonts: the fallbacks look fine */
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'game';
    this.root.appendChild(canvas);
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: this.params.has('capture'),
    });
    renderer.setPixelRatio(this._pixelRatio(q));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.renderer = renderer;
    this.input = new Input(canvas);
    // The player's keys (Settings > Controls > Keys), changed from any menu.
    this.input.setBindings(this.settings.get('bindings'));
    this.settings.listen((key) => key === 'bindings' && this.input.setBindings(this.settings.get('bindings')));
    // Sound: generated in code while the game loads; it starts playing on the
    // first click (browsers only allow audio after a user gesture).
    this.audio = this.params.get('audio') === '0' ? null : new AudioSystem({ masterVolume: this.settings.get('masterVolume') ?? 0.8 });
    const unlock = () => this.audio?.resume();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    // A battle set up in the address bar (used by tests and links) skips the menu.
    const p = this.params;
    let opts;
    if (this.resume.opts) {
      opts = { ...this.resume.opts };
    } else if (p.has('map') || p.has('mode') || p.has('cam') || p.has('play')) {
      opts = {
        map: p.get('map') || 'range',
        mode: p.get('mode') || 'auto',
        faction: p.get('faction') || 'US',
        side: p.get('side') || 'attack',
        cls: p.get('class') || 'infantry',
        tank: p.get('tank') || null,
        loadout: p.get('weapon') ? [p.get('weapon'), null, null] : null,
        bots: Number(p.get('bots') || 24),
        minutes: Number(p.get('minutes') || 20),
      };
    } else {
      opts = await showFrontEnd(this);
      // The quality may have changed in the menu.
      renderer.setPixelRatio(this._pixelRatio(this.settings.quality));
      this.audio?.resume();
    }

    this.opts = opts;
    this.loading = this._makeLoading(opts);
    const game = new Game(this, opts);
    this.game = game;
    const soundReady = this.audio
      ? this.audio.init({ onProgress: () => {} }).catch((e) => {
          console.warn('Sound disabled:', e);
          this.audio = null;
          game.audio = null;
        })
      : Promise.resolve();
    await game.load((p, msg) => this._progress(p, msg));
    await Promise.race([soundReady, new Promise((r) => setTimeout(r, 4000))]);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.loading.el.classList.add('done');
    setTimeout(() => this.loading.el.remove(), 800);
    // Releasing the mouse (Esc) pauses, once the player has started playing.
    this.pause = new PauseMenu(this, game);
    // Experience for the soldier when the battle ends, or when he leaves it.
    game.onBattleOver = (r) => this._battleOver(r);
    window.addEventListener('pagehide', () => this._recordBattle(false));
    this.input.onLockChange = (locked) => {
      if (locked) {
        game.everLocked = true;
        game.paused = false;
        this.pause.hide();
      } else if (game.everLocked && !game.mode?.over && !game.deployOpen) {
        game.paused = true;
        this.pause.show();
      }
    };
    // Graphics settings changed in the menus apply at once.
    this.settings.listen((key) => {
      if (key === 'graphics') this.applyGraphics();
      if (key === 'showFps') this._fpsCounter();
    });
    this._fpsCounter();
    game.start();
  }

  // Sharpest pixel ratio the quality allows on this screen.
  _pixelRatio(q) {
    return Math.min(window.devicePixelRatio || 1, q.maxPixelRatio || 1);
  }

  // Apply the current graphics settings to the running battle. Texture detail waits
  // for the next battle; everything else changes now (some changes recompile
  // shaders, which can pause the game for a moment).
  applyGraphics() {
    const g = this.game;
    if (!g?.pipeline) return;
    const q = this.settings.quality;
    g.quality = q;
    this.renderer.setPixelRatio(this._pixelRatio(q));
    if (g.camera.far !== q.viewDistance) {
      g.camera.far = q.viewDistance;
      g.camera.updateProjectionMatrix();
    }
    g.world.applyQuality(q);
    g.pipeline.apply(q);
    g.effects?.setQuality(q);
    this._resize();
  }

  // Frames per second in the top left corner (Settings: show frame rate).
  _fpsCounter() {
    const on = !!this.settings.get('showFps');
    if (!on) {
      clearInterval(this.fpsTimer);
      this.fpsTimer = null;
      this.fpsEl?.remove();
      this.fpsEl = null;
      return;
    }
    if (this.fpsEl) return;
    const el = document.createElement('div');
    el.className = 'fps-counter';
    el.style.cssText = 'position:absolute;top:6px;left:8px;z-index:25;font:12px var(--mono, monospace);color:#e9e4d6;background:rgba(10,10,8,0.5);padding:2px 6px;pointer-events:none;';
    this.root.appendChild(el);
    this.fpsEl = el;
    const tick = () => {
      const fps = this.game?.loop?.fps || 0;
      el.textContent = fps > 0 ? `${Math.round(fps)} fps · ${(1000 / fps).toFixed(1)} ms` : '';
    };
    tick();
    this.fpsTimer = setInterval(tick, 500);
  }

  _resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.game?.resize(w, h, this.renderer.getPixelRatio());
  }

  // The loading screen, as in the original game: the kind of battle, the
  // battlefield, the two armies, a tip, and the progress.
  _makeLoading(opts = {}) {
    const def = MAPS[opts.map] || MAPS.town;
    const assault = !!def.objectives && opts.mode !== 'range';
    const me = FACTIONS[opts.faction] ? opts.faction : 'US';
    const foe = FACTIONS[opts.enemy] && opts.enemy !== me ? opts.enemy : me === 'GE' ? 'US' : 'GE';
    const attack = (opts.side || 'attack') === 'attack';
    const army = (f, what) => `<span class="ld-army">${emblem(f)}<span>${FACTIONS[f].army}<small>${what}</small></span></span>`;
    const k = (a) => this.input.keys(a);
    const tips = [
      `Lean around a corner with ${k('leanLeft')} and ${k('leanRight')}: you show much less of yourself than stepping out.`,
      'Bullets slow down through wood and brick but keep going. Earth banks, stone walls and steel stop them.',
      `While aiming, hold ${k('sprint')} to hold your breath and steady the gun for a few seconds.`,
      `Bleeding takes your health away over time: bandage with ${k('bandage')} as soon as you are in cover.`,
      'For a long shot, raise the rear sight with the mouse wheel while aiming: the bullet drops more than you think.',
      'Leaves hide you, but only partly: enemies spot you more slowly through a hedge or a bush, not never.',
      `Walk up to a bicycle, a motorcycle or a jeep and press ${k('use')} to get in. Bikes are the quickest way to the front.`,
      'Capture points are taken in order along each line. Stand in a point with your side to take it; more men take it faster.',
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    const el = document.createElement('div');
    el.className = 'loading';
    el.innerHTML = `
      <div class="ld-head">
        <div class="ld-kind">${assault ? 'Assault' : 'Practice'}</div>
        <h1></h1>
        <div class="ld-sides">${assault ? `${army(me, attack ? 'attacking' : 'defending')}<b>vs</b>${army(foe, attack ? 'defending' : 'attacking')}` : army(me, 'no enemies')}</div>
      </div>
      <div class="ld-map"><canvas></canvas></div>
      <div class="ld-foot">
        <div class="ld-tip"><b>Tip</b><span></span></div>
        <div class="bar"><div></div></div>
        <div class="status">Starting</div>
      </div>`;
    el.querySelector('h1').textContent = def.name;
    el.querySelector('.ld-tip span').textContent = tip;
    this.root.appendChild(el);
    // The battlefield's map, where the map module is there.
    const canvas = el.querySelector('.ld-map canvas');
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      try {
        new BattleMap(canvas, def, {}).draw({ team: attack ? 1 : 0 });
      } catch (e) {
        console.warn('No battle map', e);
        el.querySelector('.ld-map').hidden = true;
      }
    });
    return { el, bar: el.querySelector('.bar > div'), status: el.querySelector('.status') };
  }

  // Experience for the battle just fought (an Assault): for taking part, for
  // every enemy put out of the fight, for every point taken, and more for a win.
  // Once per battle; nothing for practice or for leaving straight away.
  _recordBattle(won) {
    const g = this.game;
    const id = this.opts?.soldier?.id;
    if (this.recorded || !g?.mode?.points || !id) return this.recorded || null;
    const s = g.player.soldier;
    if (g.time < 60 && !s.kills) return null;
    const captures = s.captures || 0;
    const xp = 100 + s.kills * 100 + captures * 150 + (won ? 400 : 0);
    const roster = loadRoster();
    const res = awardBattle(roster, id, { xp, won, kills: s.kills, deaths: s.deaths, captures });
    if (!res) return null;
    saveRoster(roster);
    const soldier = roster.soldiers.find((x) => x.id === id);
    this.recorded = { xp, captures, kills: s.kills, deaths: s.deaths, ...res, soldier };
    return this.recorded;
  }

  // Leave the battle (pause menu): keep the experience, back to the Heroes screen.
  leaveBattle() {
    this._recordBattle(false);
    location.reload();
  }

  // The battle is decided: the results, with the experience and any promotion.
  _battleOver({ won, why }) {
    const g = this.game;
    const r = this._recordBattle(won);
    const s = g.player.soldier;
    const el = document.createElement('div');
    el.className = `battle-result ${won ? 'won' : 'lost'}`;
    const f = r?.soldier?.faction || s.faction;
    const rk = r ? rankOf(r.soldier.xp) : null;
    el.innerHTML = `<div class="br-box">
        <div class="br-kind">Assault · ${g.mapDef.name}</div>
        <h1>${won ? 'Victory' : 'Defeat'}</h1>
        <div class="br-why"></div>
        <div class="br-stats">
          <div><b>${s.kills}</b><span>Enemies down</span></div>
          <div><b>${s.deaths}</b><span>Times fallen</span></div>
          <div><b>${s.captures || 0}</b><span>Points taken</span></div>
          <div class="xp"><b>${r ? `+${r.xp.toLocaleString('en-US')}` : '0'}</b><span>Experience</span></div>
        </div>
        ${
          r
            ? `<div class="br-rank">${rankBadge(rk.rank)}<div><b></b><small></small><div class="br-xp"><i style="width:${(rk.progress * 100).toFixed(1)}%"></i></div></div></div>`
            : ''
        }
        <button class="cta">Back to headquarters</button>
      </div>`;
    el.querySelector('.br-why').textContent = why;
    if (r) {
      const promoted = r.after > r.before;
      el.querySelector('.br-rank b').textContent = `${promoted ? 'Promoted: ' : ''}Rank ${rk.rank} ${rankTitle(f, rk.rank)}`;
      el.querySelector('.br-rank small').textContent = `${r.soldier.name} · ${r.soldier.xp.toLocaleString('en-US')} XP${rk.next ? ` · ${(rk.next - r.soldier.xp).toLocaleString('en-US')} to ${rankTitle(f, rk.rank + 1)}` : ''}`;
      el.querySelector('.br-rank').prepend(Object.assign(document.createElement('span'), { className: 'br-emb', innerHTML: emblem(f) }));
    }
    el.querySelector('.cta').addEventListener('click', () => location.reload());
    g.hud.root.appendChild(el);
    // The mouse is needed for the button.
    setTimeout(() => this.input.unlock(), 1200);
    return true;
  }

  _progress(p, msg) {
    this.loading.bar.style.width = `${Math.round(p * 100)}%`;
    if (msg) this.loading.status.textContent = msg;
  }
}
