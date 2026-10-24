// Top-level application: owns the renderer, settings and input, shows the loading
// screen and menus, and starts games.
import * as THREE from 'three';
import { Settings } from '../core/settings.js';
import { Input } from '../core/input.js';
import { Game } from '../game/game.js';
import { AudioSystem } from '../audio/audio.js';
import { showMainMenu, PauseMenu } from './menu.js';

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
        bots: Number(p.get('bots') || 10),
        minutes: Number(p.get('minutes') || 20),
      };
    } else {
      const s = await showMainMenu(this);
      opts = { map: s.map, mode: 'auto', faction: s.faction, side: s.side, cls: s.cls, tank: s.tank, loadout: s.weapon ? [s.weapon, null, null] : null, bots: s.bots, minutes: s.minutes };
      // The quality may have changed in the menu.
      renderer.setPixelRatio(this._pixelRatio(this.settings.quality));
      this.audio?.resume();
    }

    this.opts = opts;
    this.loading = this._makeLoading();
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
    this.input.onLockChange = (locked) => {
      if (locked) {
        game.everLocked = true;
        game.paused = false;
        this.pause.hide();
      } else if (game.everLocked && !game.mode?.over) {
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

  _makeLoading() {
    const el = document.createElement('div');
    el.className = 'loading';
    el.innerHTML = `
      <h1>HNG</h1>
      <div class="sub">WWII combined arms</div>
      <div class="bar"><div></div></div>
      <div class="status">Starting</div>`;
    this.root.appendChild(el);
    return { el, bar: el.querySelector('.bar > div'), status: el.querySelector('.status') };
  }

  _progress(p, msg) {
    this.loading.bar.style.width = `${Math.round(p * 100)}%`;
    if (msg) this.loading.status.textContent = msg;
  }
}
