// Top-level application: owns the renderer, settings and input, shows the loading
// screen and menus, and starts games.
import * as THREE from 'three';
import { Settings } from '../core/settings.js';
import { Input } from '../core/input.js';
import { Game } from '../game/game.js';

export class App {
  constructor(root) {
    this.root = root;
    this.settings = new Settings();
    this.params = new URLSearchParams(location.search);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.renderer = renderer;
    this.input = new Input(canvas);

    this.loading = this._makeLoading();
    const game = new Game(this, {
      map: this.params.get('map') || 'range',
      mode: this.params.get('mode') || 'range',
      faction: this.params.get('faction') || 'GE',
      cls: this.params.get('class') || 'infantry',
      loadout: this.params.get('weapon') ? [this.params.get('weapon'), null, null] : null,
    });
    this.game = game;
    await game.load((p, msg) => this._progress(p, msg));
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.loading.el.classList.add('done');
    setTimeout(() => this.loading.el.remove(), 800);
    game.start();
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
