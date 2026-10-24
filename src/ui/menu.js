// Main menu (battle setup, settings, controls) and the in-battle pause menu.
import { MAPS } from '../world/maps.js';
import { FACTIONS, WEAPONS, weaponsFor, DEFAULT_LOADOUT } from '../weapons/defs.js';
import { SettingsView } from './settingsView.js';
import { AMMO } from '../weapons/ammo.js';

const SETUP_KEY = 'hng.setup.v1';
const CLASSES = [
  ['infantry', 'Infantry', 'Rifleman, assault or support gunner.'],
  ['recon', 'Recon', 'Scoped rifle and a sidearm; spots from range.'],
  ['paratrooper', 'Paratrooper', 'Submachine guns and carbines for close fighting.'],
  ['tanker', 'Tank crew', 'Deploys in a tank: drive with W/S/A/D, aim and fire the main gun.'],
];
const TANKS = {
  US: [['m4a1_sherman', 'M4A1 Sherman'], ['m5a1_stuart', 'M5A1 Stuart']],
  GE: [['panzer4_h', 'Panzer IV Ausf. H'], ['tiger1', 'Tiger I']],
  SU: [['t34_76', 'T-34/76'], ['t34_85', 'T-34-85']],
};
export function loadSetup() {
  const d = { map: 'town', side: 'attack', faction: 'US', cls: 'infantry', weapon: null, bots: 10, minutes: 20 };
  try {
    Object.assign(d, JSON.parse(localStorage.getItem(SETUP_KEY) || '{}'));
  } catch {
    /* defaults */
  }
  return d;
}

function saveSetup(s) {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

// Resolves with the chosen battle options when the player presses Deploy.
export function showMainMenu(app) {
  return new Promise((resolve) => {
    const setup = loadSetup();
    const root = el('div', 'menu');
    root.innerHTML = `
      <div class="menu-head"><h1>HNG</h1><div class="sub">WWII combined arms · an unofficial Heroes &amp; Generals tribute</div><div class="touch-note" hidden>This game needs a keyboard and mouse. Open it on a computer to play.</div></div>
      <div class="menu-tabs"><button data-tab="battle" class="on">Battle</button><button data-tab="settings">Settings</button><button data-tab="controls">Controls</button><button data-tab="about">About</button><button class="fullscreen" title="Fill the whole screen (Esc leaves it)">Full screen</button></div>
      <div class="menu-body"></div>`;
    app.root.appendChild(root);
    const body = root.querySelector('.menu-body');
    // The settings pages open in the Settings tab (all of them) and the Controls tab.
    let view = null;
    const pages = (rootPage) => {
      body.innerHTML = '';
      view = new SettingsView(body, app, { root: rootPage });
    };
    const tabs = {
      battle: () => battleTab(body, setup, () => {
        saveSetup(setup);
        view?.close();
        window.removeEventListener('keydown', onEsc);
        root.remove();
        resolve({ ...setup });
      }),
      settings: () => pages('home'),
      controls: () => pages('controls'),
      about: () => aboutTab(body),
    };
    // Esc goes back a page.
    const onEsc = (e) => {
      if (e.code === 'Escape' && !e.repeat && view?.body.isConnected) view.back();
    };
    window.addEventListener('keydown', onEsc);
    root.querySelectorAll('.menu-tabs button[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        root.querySelectorAll('.menu-tabs button[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
        view?.close();
        view = null;
        body.classList.remove('set-view');
        tabs[b.dataset.tab]();
      }),
    );
    // Phones and tablets: say up front that a keyboard and mouse are needed.
    root.querySelector('.touch-note').hidden = !matchMedia('(hover: none) and (pointer: coarse)').matches;
    // Full screen, where the page is allowed to use it.
    const fs = root.querySelector('.fullscreen');
    fs.hidden = !document.fullscreenEnabled;
    fs.addEventListener('click', () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
        else document.documentElement.requestFullscreen?.()?.catch?.(() => {});
      } catch {
        /* not allowed here */
      }
    });
    tabs.battle();
  });
}

function choiceRow(label, options, value, onPick, note = '') {
  const row = el('div', 'row');
  row.appendChild(el('label', '', label));
  const box = el('div', 'choices');
  for (const [v, text, title] of options) {
    const b = el('button', v === value ? 'on' : '', text);
    if (title) b.title = title;
    b.addEventListener('click', () => onPick(v));
    box.appendChild(b);
  }
  row.appendChild(box);
  if (note) row.appendChild(el('div', 'note', note));
  return row;
}

function battleTab(body, s, deploy) {
  const render = () => {
    body.innerHTML = '';
    const maps = [
      ['town', MAPS.town.name, 'Assault: five lines of capture points toward the police station and the church.'],
      ['range', MAPS.range.name, 'Firing range with targets from 25 to 800 m, a penetration lane and parked vehicles.'],
    ];
    body.appendChild(choiceRow('Battlefield', maps, s.map, (v) => ((s.map = v), render()), s.map === 'town' ? 'Assault (Heroes & Generals rules)' : 'Practice: no enemies'));
    body.appendChild(
      choiceRow(
        'Army',
        Object.entries(FACTIONS).map(([k, f]) => [k, f.army]),
        s.faction,
        (v) => {
          s.faction = v;
          s.weapon = null;
          render();
        },
      ),
    );
    if (s.map === 'town') {
      body.appendChild(choiceRow('Side', [['attack', 'Attack'], ['defend', 'Defend']], s.side, (v) => ((s.side = v), render())));
    }
    body.appendChild(
      choiceRow(
        'Class',
        CLASSES.map(([k, n, t]) => [k, n, t]),
        s.cls,
        (v) => {
          s.cls = v;
          s.weapon = null;
          render();
        },
        CLASSES.find((c) => c[0] === s.cls)?.[2] || '',
      ),
    );
    if (s.cls === 'tanker') {
      const tanks = TANKS[s.faction];
      if (!tanks.some((t) => t[0] === s.tank)) s.tank = tanks[0][0];
      body.appendChild(choiceRow('Tank', tanks, s.tank, (v) => ((s.tank = v), render())));
    }
    const list = weaponsFor(s.faction, s.cls, 'primary');
    const def = DEFAULT_LOADOUT[s.faction][s.cls]?.[0];
    if (!s.weapon || !list.some((w) => w.id === s.weapon)) s.weapon = def || list[0]?.id;
    const wsel = el('div', 'row');
    const wl = wsel.appendChild(el('label', '', 'Weapon'));
    const sel = el('select');
    sel.id = wl.htmlFor = 'menu-weapon';
    for (const w of list) {
      const o = el('option', '', `${w.name}`);
      o.value = w.id;
      if (w.id === s.weapon) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => ((s.weapon = sel.value), render()));
    wsel.appendChild(sel);
    const w = WEAPONS[s.weapon];
    if (w) wsel.appendChild(el('div', 'note', weaponNote(w)));
    body.appendChild(wsel);
    if (s.map === 'town') {
      const r = el('div', 'row');
      const bl = r.appendChild(el('label', '', `Soldiers per side: <b>${s.bots}</b>`));
      const inp = el('input');
      inp.id = bl.htmlFor = 'menu-soldiers';
      inp.type = 'range';
      inp.min = 4;
      inp.max = 18;
      inp.value = s.bots;
      inp.addEventListener('input', () => {
        s.bots = Number(inp.value);
        r.querySelector('b').textContent = s.bots;
      });
      r.appendChild(inp);
      r.appendChild(el('div', 'note', 'The original game fought 18 against 18. Fewer is lighter on slower computers.'));
      body.appendChild(r);
      body.appendChild(choiceRow('Battle clock', [[10, '10 min'], [20, '20 min'], [30, '30 min']], s.minutes, (v) => ((s.minutes = v), render()), '+2 minutes for each point the attackers take'));
    }
    const go = el('button', 'deploy', 'Deploy');
    go.addEventListener('click', deploy);
    body.appendChild(go);
  };
  render();
}

function weaponNote(w) {
  const parts = [AMMO[w.ammo]?.name || w.ammo, `${Math.round(w.mv)} m/s`];
  if (w.rpm && w.modes.some((m) => m === 'auto')) parts.push(`${w.rpm} rounds/min`);
  parts.push(`${w.capacity} rounds`, `${w.mass.toFixed(1)} kg`);
  return parts.join(' · ');
}

function aboutTab(body) {
  body.innerHTML = `
    <p>An unofficial fan tribute to <b>Heroes &amp; Generals</b>, the WWII game by Reto-Moto (2016 to 2023; its servers closed in May 2023): large battles of infantry, tanks and vehicles fought over a French village. It is not connected with Reto-Moto or the game's later owners and uses none of their assets.</p>
    <p>Everything is simulated: bullets fly with real drag and drop for their ammunition and slow down through walls; guns load, cycle and recoil like the originals and are aimed through their real sights; armor stops or fails against each shell by its real thickness and slope; tanks steer like their real transmissions; soldiers tire, bleed and bandage.</p>
    <p>All models, textures and sounds are generated in code when the game loads.</p>
    <p>Play it on a computer with a keyboard and mouse.</p>`;
}

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
    root.querySelector('.leave').addEventListener('click', () => location.reload());
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
