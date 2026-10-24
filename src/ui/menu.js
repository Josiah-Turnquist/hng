// The in-battle pause menu (the front end before a battle is frontend.js).
import { SettingsView } from './settingsView.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

// Pause overlay while the mouse is released during a battle. Esc goes back a
// page in the settings and, on the first page, closes the menu. Browsers only
// give the mouse back to the game on a click or a key press (never on Esc), so
// after Esc the battle waits for one.
export class PauseMenu {
  constructor(app, game) {
    this.app = app;
    this.game = game;
    this.visible = false;
    this.view = null;
    const root = el('div', 'pause');
    root.innerHTML = `
      <div class="box">
        <div class="pause-home">
          <h2>Paused</h2>
          <button class="resume">Back to the battle</button>
          <button class="settings">Settings</button>
          <button class="controls">Controls</button>
          <button class="leave">Leave battle</button>
          <div class="pause-tip">Esc closes this menu</div>
        </div>
        <div class="pause-pages" hidden></div>
      </div>
      <div class="pause-wait" hidden><div>Click or press a key to go back to the battle</div></div>`;
    app.root.appendChild(root);
    this.root = root;
    this.box = root.querySelector('.box');
    this.home = root.querySelector('.pause-home');
    this.pages = root.querySelector('.pause-pages');
    this.waitEl = root.querySelector('.pause-wait');
    root.querySelector('.resume').addEventListener('click', () => this.resume());
    root.querySelector('.leave').addEventListener('click', () => app.leaveBattle());
    root.querySelector('.settings').addEventListener('click', () => this._pages());
    root.querySelector('.controls').addEventListener('click', () => this._pages('controls'));
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || e.repeat || e.hngPaused) return;
      if (this.waiting) {
        // Esc again while waiting: the menu comes back.
        this._stopWaiting();
        this.show();
        return;
      }
      // (Not the press that opened the menu.)
      if (!this.visible || performance.now() - this.shownAt < 250) return;
      e.preventDefault();
      if (this.view) this.view.back();
      else this.close();
    });
  }

  // The settings pages in place of the buttons (Back from the first one returns).
  _pages(open) {
    this.home.hidden = true;
    this.pages.hidden = false;
    this.box.classList.add('wide');
    this.view = new SettingsView(this.pages, this.app, { root: 'home', onExit: () => this._home() });
    if (open) this.view.open(open);
  }

  _home() {
    this.view?.close();
    this.view = null;
    this.pages.innerHTML = '';
    this.pages.hidden = true;
    this.home.hidden = false;
    this.box.classList.remove('wide');
  }

  show() {
    this._home();
    this.box.hidden = false;
    this.root.style.display = 'flex';
    this.visible = true;
    this.shownAt = performance.now();
  }

  hide() {
    this._stopWaiting();
    this._home();
    this.root.style.display = 'none';
    this.visible = false;
  }

  // Esc on the first page: close the menu. Where the game plays with the free
  // mouse (no capture), go straight back; otherwise wait for a click or a key.
  close() {
    if (this.game.input.freeMouse) return this.resume();
    this._home();
    this.box.hidden = true;
    this.waitEl.hidden = false;
    this.waiting = true;
    const go = (e) => {
      if (e.type === 'keydown') {
        if (e.code === 'Escape' || /^(Shift|Control|Alt|Meta)/.test(e.code)) return;
        // (The key that brings you back does nothing else.)
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      this.resume();
    };
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
    this._waitOff = () => {
      window.removeEventListener('pointerdown', go, true);
      window.removeEventListener('keydown', go, true);
    };
  }

  _stopWaiting() {
    this._waitOff?.();
    this._waitOff = null;
    this.waiting = false;
    this.waitEl.hidden = true;
    this.box.hidden = false;
  }

  resume() {
    this.hide();
    this.game.paused = false;
    this.game.input.lock();
  }
}
