// Main menu (battle setup, settings, controls) and the in-battle pause menu.
import { MAPS } from '../world/maps.js';
import { FACTIONS, WEAPONS, weaponsFor, DEFAULT_LOADOUT } from '../weapons/defs.js';
import { QUALITY_PRESETS } from '../core/settings.js';
import { AMMO } from '../weapons/ammo.js';

const SETUP_KEY = 'hng.setup.v1';
const CLASSES = [
  ['infantry', 'Infantry', 'Rifleman, assault or support gunner.'],
  ['recon', 'Recon', 'Scoped rifle and a sidearm; spots from range.'],
  ['paratrooper', 'Paratrooper', 'Submachine guns and carbines for close fighting.'],
  ['tanker', 'Tank crew', 'Deploys in a tank: drive with W/S/A/D, aim and fire the main gun.'],
];
const CONTROLS = [
  ['Move', 'W A S D'],
  ['Sprint / hold breath while aiming', 'Shift'],
  ['Crouch / prone', 'C / Z'],
  ['Jump / stand up', 'Space'],
  ['Lean', 'Q / E'],
  ['Aim down the sights', 'Right mouse'],
  ['Fire', 'Left mouse'],
  ['Sight range up / down', 'Mouse wheel while aiming, or Page Up / Page Down'],
  ['Reload / work the bolt', 'R'],
  ['Fire mode', 'B or middle mouse'],
  ['Weapons', '1 2 3, G for grenade'],
  ['Bandage', 'X'],
  ['Get in / out of a vehicle', 'F'],
  ['Vehicle: throttle, brake, steer', 'W S A D (Space: handbrake on jeeps, coaxial MG on tanks)'],
  ['Tank: gunner sight, shell type', 'Hold right mouse or V; 1 / 2'],
  ['Change seat', 'F1 - F4'],
  ['Release the mouse (pause)', 'Esc'],
];

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
      <div class="menu-head"><h1>HNG</h1><div class="sub">WWII combined arms · inspired by Heroes &amp; Generals</div></div>
      <div class="menu-tabs"><button data-tab="battle" class="on">Battle</button><button data-tab="settings">Settings</button><button data-tab="controls">Controls</button><button data-tab="about">About</button></div>
      <div class="menu-body"></div>`;
    app.root.appendChild(root);
    const body = root.querySelector('.menu-body');
    const tabs = {
      battle: () => battleTab(body, setup, () => {
        saveSetup(setup);
        root.remove();
        resolve({ ...setup });
      }),
      settings: () => settingsTab(body, app),
      controls: () => controlsTab(body),
      about: () => aboutTab(body),
    };
    root.querySelectorAll('.menu-tabs button').forEach((b) =>
      b.addEventListener('click', () => {
        root.querySelectorAll('.menu-tabs button').forEach((x) => x.classList.toggle('on', x === b));
        tabs[b.dataset.tab]();
      }),
    );
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
    const list = weaponsFor(s.faction, s.cls, 'primary');
    const def = DEFAULT_LOADOUT[s.faction][s.cls]?.[0];
    if (!s.weapon || !list.some((w) => w.id === s.weapon)) s.weapon = def || list[0]?.id;
    const wsel = el('div', 'row');
    wsel.appendChild(el('label', '', 'Weapon'));
    const sel = el('select');
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
      r.appendChild(el('label', '', `Soldiers per side: <b>${s.bots}</b>`));
      const inp = el('input');
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

function settingsTab(body, app) {
  const st = app.settings;
  body.innerHTML = '';
  const q = el('div', 'row');
  q.appendChild(el('label', '', 'Graphics quality'));
  const box = el('div', 'choices');
  for (const [k, p] of Object.entries(QUALITY_PRESETS)) {
    const b = el('button', st.get('quality') === k ? 'on' : '', p.label);
    b.addEventListener('click', () => {
      st.set('quality', k);
      settingsTab(body, app);
    });
    box.appendChild(b);
  }
  q.appendChild(box);
  q.appendChild(el('div', 'note', 'Shadows, grass, view distance and texture detail. Takes effect when the next battle loads.'));
  body.appendChild(q);
  const slider = (key, label, min, max, step, fmt = (v) => v) => {
    const r = el('div', 'row');
    r.appendChild(el('label', '', `${label}: <b>${fmt(st.get(key))}</b>`));
    const i = el('input');
    i.type = 'range';
    i.min = min;
    i.max = max;
    i.step = step;
    i.value = st.get(key);
    i.addEventListener('input', () => {
      st.set(key, Number(i.value));
      r.querySelector('b').textContent = fmt(Number(i.value));
      if (key === 'masterVolume') app.audio?.setVolume?.('master', Number(i.value));
    });
    r.appendChild(i);
    body.appendChild(r);
  };
  slider('fov', 'Field of view', 60, 100, 1, (v) => `${v}°`);
  slider('mouseSensitivity', 'Mouse sensitivity', 0.2, 3, 0.05, (v) => Number(v).toFixed(2));
  slider('adsSensitivity', 'Aiming sensitivity', 0.2, 1.5, 0.05, (v) => Number(v).toFixed(2));
  slider('masterVolume', 'Volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`);
  const inv = el('div', 'row');
  inv.appendChild(el('label', '', 'Invert mouse'));
  const cb = el('button', st.get('invertY') ? 'on' : '', st.get('invertY') ? 'On' : 'Off');
  cb.addEventListener('click', () => {
    st.set('invertY', !st.get('invertY'));
    settingsTab(body, app);
  });
  const c2 = el('div', 'choices');
  c2.appendChild(cb);
  inv.appendChild(c2);
  body.appendChild(inv);
}

function controlsTab(body) {
  body.innerHTML = `<table class="keys">${CONTROLS.map(([a, k]) => `<tr><td>${a}</td><td>${k}</td></tr>`).join('')}</table>`;
}

function aboutTab(body) {
  body.innerHTML = `
    <p>A tribute to <b>Heroes &amp; Generals</b> (Reto-Moto, 2016-2022): large WWII battles of infantry, tanks and vehicles fought over a French village.</p>
    <p>Everything is simulated: bullets fly with real drag and drop for their ammunition and slow down through walls; guns load, cycle and recoil like the originals and are aimed through their real sights; armor stops or fails against each shell by its real thickness and slope; tanks steer like their real transmissions; soldiers tire, bleed and bandage.</p>
    <p>All models, textures and sounds are generated in code when the game loads.</p>`;
}

// Pause overlay while the mouse is released during a battle.
export class PauseMenu {
  constructor(app, game) {
    this.app = app;
    this.game = game;
    const root = el('div', 'pause');
    root.innerHTML = `<div class="box"><h2>Paused</h2><button class="resume">Resume (click)</button><button class="settings">Settings</button><button class="leave">Leave battle</button><div class="extra"></div></div>`;
    app.root.appendChild(root);
    this.root = root;
    root.querySelector('.resume').addEventListener('click', () => this.resume());
    root.querySelector('.leave').addEventListener('click', () => location.reload());
    root.querySelector('.settings').addEventListener('click', () => {
      const ex = root.querySelector('.extra');
      if (ex.childElementCount) ex.innerHTML = '';
      else settingsTab(ex, app);
    });
  }

  show() {
    this.root.style.display = 'flex';
  }

  hide() {
    this.root.style.display = 'none';
  }

  resume() {
    this.hide();
    this.game.paused = false;
    this.game.input.lock();
  }
}
