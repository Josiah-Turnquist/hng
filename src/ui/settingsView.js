// Settings in pages: a first page of sections (Graphics, Controls, Sound,
// Screen), each opening a page of its own; Graphics and Controls have pages
// below them. A trail at the top shows where you are; Back (or Esc) goes up a
// level. The main menu and the pause menu both show it.
//
//   const view = new SettingsView(body, app, { root: 'home', onExit });
//   view.open('keys');   // a page below this one
//   view.back();         // up a level (at the top: onExit, if given); false if nowhere to go
import { GRAPHICS_OPTIONS, GRAPHICS_PRESETS } from '../core/settings.js';
import { ACTIONS, RESERVED, clash, mergeBindings, bindingChanges, keyName } from '../core/input.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

// The graphics options in their groups (GRAPHICS_OPTIONS lists them in order; the
// first of each group carries its name).
const GROUPS = [];
for (const o of GRAPHICS_OPTIONS) {
  if (o.group || !GROUPS.length) GROUPS.push({ name: o.group || 'Picture', options: [] });
  GROUPS[GROUPS.length - 1].options.push(o);
}

const ACTION_NAMES = Object.fromEntries(ACTIONS.flatMap((g) => g.actions.map(([a, name]) => [a, name])));

const PAGES = {
  home: { title: 'Settings', render: homePage },
  graphics: { title: 'Graphics', render: graphicsPage },
  controls: { title: 'Controls', render: controlsPage },
  keys: { title: 'Keys', render: keysPage },
  sound: { title: 'Sound', render: soundPage },
  screen: { title: 'Screen', render: screenPage },
};
for (const g of GROUPS) PAGES[`gfx:${g.name}`] = { title: g.name, render: (body, view) => groupPage(body, view, g) };

export class SettingsView {
  constructor(body, app, { root = 'home', onExit = null } = {}) {
    this.body = body;
    this.app = app;
    this.onExit = onExit;
    this.stack = [root];
    this.capture = null; // the key box waiting for a key (keys page)
    this.notice = null; // { text, undo } shown on the keys page
    body.classList.add('set-view');
    this.render(true);
  }

  get page() {
    return this.stack[this.stack.length - 1];
  }

  open(id) {
    this._endCapture();
    this.notice = null;
    this.stack.push(id);
    this.render(true);
  }

  // Up a level; at the top, onExit. Esc does this too. Returns false if there was
  // nowhere to go.
  back() {
    if (this.capture) {
      this._endCapture();
      this.render();
      return true;
    }
    this.notice = null;
    if (this.stack.length > 1) {
      this.stack.pop();
      this.render(true);
      return true;
    }
    if (this.onExit) {
      this.onExit();
      return true;
    }
    return false;
  }

  close() {
    this._endCapture();
  }

  // Draw the current page, keeping the scroll position unless it is a new page.
  render(newPage = false) {
    const sc = this.body.closest('.fe-main, .pause .box') || this.body;
    const y = sc.scrollTop;
    this.body.innerHTML = '';
    const nav = el('div', 'set-nav');
    if (this.stack.length > 1 || this.onExit) {
      const b = el('button', 'set-back', '&lsaquo; Back');
      b.title = 'Back (Esc)';
      b.addEventListener('click', () => this.back());
      nav.appendChild(b);
    }
    const trail = el('div', 'set-trail');
    this.stack.forEach((id, i) => {
      if (i) trail.appendChild(el('span', 'sep', '&rsaquo;'));
      const here = i === this.stack.length - 1;
      const t = el(here ? 'span' : 'button', here ? 'here' : 'crumb');
      t.textContent = PAGES[id].title;
      if (!here)
        t.addEventListener('click', () => {
          this._endCapture();
          this.notice = null;
          this.stack.length = i + 1;
          this.render(true);
        });
      trail.appendChild(t);
    });
    nav.appendChild(trail);
    this.body.appendChild(nav);
    const page = el('div', 'set-page');
    this.body.appendChild(page);
    PAGES[this.page].render(page, this);
    sc.scrollTop = newPage ? 0 : y;
  }

  // --- key boxes (keys page) ---------------------------------------------------
  // Waits for the key (or, clicked on this box, the mouse button) for one of an
  // action's two slots. Esc cancels, Delete or Backspace clears the slot.
  _startCapture(action, slot, box) {
    this._endCapture();
    box.classList.add('wait');
    box.textContent = 'Press a key';
    const t0 = performance.now();
    const onKey = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === 'Escape') {
        this._endCapture();
        this.render();
      } else if (e.code === 'Backspace' || e.code === 'Delete') this._assign(action, slot, null);
      else if (RESERVED.has(e.code)) {
        this.notice = { text: `${keyName(e.code)} is kept by the browser. Pick another key.` };
        this._endCapture();
        this.render();
      } else this._assign(action, slot, e.code);
    };
    const onMouse = (e) => {
      // A click anywhere else cancels (and does what it would have done).
      if (e.target !== box) {
        this._endCapture();
        this.render();
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      // (Not the second click of a double click on the box.)
      if (performance.now() - t0 < 350) return;
      if (e.button < 5) this._assign(action, slot, `Mouse${e.button}`);
    };
    const noMenu = (e) => e.target === box && e.preventDefault();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('contextmenu', noMenu, true);
    this.capture = {
      off: () => {
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('mousedown', onMouse, true);
        window.removeEventListener('contextmenu', noMenu, true);
      },
    };
  }

  _endCapture() {
    this.capture?.off();
    this.capture = null;
  }

  // Put a key in an action's slot (null clears it). The key comes off any action
  // it would clash with; a key already in the other slot swaps places.
  _assign(action, slot, code) {
    this._endCapture();
    const st = this.app.settings;
    const before = st.get('bindings') || {};
    const b = mergeBindings(before);
    const list = [...(b[action] || [])];
    let text = '';
    if (code) {
      for (const [a, codes] of Object.entries(b)) {
        if (a === action || !codes.includes(code) || !clash(a, action)) continue;
        b[a] = codes.filter((c) => c !== code);
        text = `${keyName(code)} was ${ACTION_NAMES[a] || a}${b[a].length ? '' : ', which now has no key'}.`;
      }
      const j = list.indexOf(code);
      if (j >= 0 && j !== slot) list[j] = list[slot];
      list[slot] = code;
    } else list.splice(slot, 1);
    b[action] = list.filter(Boolean).slice(0, 2);
    st.set('bindings', bindingChanges(b));
    this.notice = text ? { text, undo: before } : null;
    this.render();
  }
}

// A button that opens a page below, with a line saying what is set there.
function link(view, id, summary) {
  const b = el('button', 'set-link');
  b.appendChild(el('span', 't')).textContent = PAGES[id].title;
  b.appendChild(el('span', 's')).textContent = summary;
  b.appendChild(el('span', 'go', '&rsaquo;'));
  b.addEventListener('click', () => view.open(id));
  return b;
}

function choiceRow(label, options, value, onPick, note = '') {
  const row = el('div', 'row');
  row.appendChild(el('label')).textContent = label;
  const box = el('div', 'choices');
  for (const [v, text] of options) {
    const b = el('button', v === value ? 'on' : '');
    b.textContent = text;
    b.addEventListener('click', () => onPick(v));
    box.appendChild(b);
  }
  row.appendChild(box);
  if (note) row.appendChild(el('div', 'note')).textContent = note;
  return row;
}

function toggleRow(view, key, label, note) {
  const st = view.app.settings;
  return choiceRow(
    label,
    [
      [true, 'On'],
      [false, 'Off'],
    ],
    !!st.get(key),
    (v) => {
      st.set(key, v);
      view.render();
    },
    note,
  );
}

function slider(view, key, label, min, max, step, fmt, note = '') {
  const st = view.app.settings;
  const r = el('div', 'row');
  const l = r.appendChild(el('label', '', `${label}: <b></b>`));
  l.querySelector('b').textContent = fmt(st.get(key));
  const i = el('input');
  i.id = l.htmlFor = `setting-${key}`;
  i.type = 'range';
  i.min = min;
  i.max = max;
  i.step = step;
  i.value = st.get(key);
  i.addEventListener('input', () => {
    st.set(key, Number(i.value));
    l.querySelector('b').textContent = fmt(Number(i.value));
    if (key === 'masterVolume') view.app.audio?.setVolume?.('master', Number(i.value));
  });
  r.appendChild(i);
  if (note) r.appendChild(el('div', 'note')).textContent = note;
  return r;
}

// How a graphics option is set right now, in words.
function optionValue(o, v) {
  return o.type === 'range' ? o.fmt(v) : (o.choices.find((c) => c[0] === v)?.[1] ?? String(v));
}

// --- pages ----------------------------------------------------------------------

function homePage(body, view) {
  const st = view.app.settings;
  const p = st.preset;
  const fps = view.app.game?.pipeline ? view.app.game.loop?.fps : 0;
  const b = mergeBindings(st.get('bindings'));
  body.appendChild(link(view, 'graphics', `${p === 'custom' ? 'Custom' : GRAPHICS_PRESETS[p].label} quality${fps ? `, ${Math.round(fps)} frames per second now` : ''}`));
  body.appendChild(link(view, 'controls', `See and change every key. Aim: ${keysOf(b, 'aim')}${st.get('aimToggle') ? ' (press once)' : ''}`));
  body.appendChild(link(view, 'sound', `Volume ${Math.round((st.get('masterVolume') ?? 0.8) * 100)}%`));
  body.appendChild(link(view, 'screen', `Field of view ${st.get('fov')}°, crosshair ${st.get('crosshair') ? 'on' : 'off'}`));
}

function graphicsPage(body, view) {
  const app = view.app;
  const st = app.settings;
  const inBattle = !!app.game?.pipeline;
  const preset = st.preset;
  const q = el('div', 'row');
  q.appendChild(el('label', '', 'Graphics quality'));
  const box = el('div', 'choices');
  for (const [k, p] of Object.entries(GRAPHICS_PRESETS)) {
    const b = el('button', preset === k ? 'on' : '', p.label);
    b.addEventListener('click', () => {
      st.setPreset(k);
      view.render();
    });
    box.appendChild(b);
  }
  if (preset === 'custom') box.appendChild(el('span', 'custom-tag', 'Custom'));
  q.appendChild(box);
  const qn = el('div', 'note');
  const gpu = gpuName(st.get('gpu'));
  qn.textContent =
    (st.get('autoQuality') ? `Picked automatically for this computer${gpu ? ` (${gpu})` : ''}. ` : '') +
    'Low suits laptops and older computers, Medium most computers, High a gaming graphics card, Ultra a fast one. ' +
    (inBattle ? 'Changes apply at once (the game may pause for a moment while it adjusts). ' : '') +
    'Each option can also be set on its own below.';
  q.appendChild(qn);
  if (inBattle) {
    // The battle keeps drawing behind this menu: show how fast.
    const now = el('div', 'note fps-now');
    q.appendChild(now);
    const tick = () => {
      if (!now.isConnected) return clearInterval(timer);
      const fps = app.game?.loop?.fps || 0;
      now.textContent = fps > 0 ? `Running now at ${Math.round(fps)} frames per second.` : '';
    };
    const timer = setInterval(tick, 500);
    tick();
  }
  body.appendChild(q);
  const g = st.graphics;
  for (const grp of GROUPS) body.appendChild(link(view, `gfx:${grp.name}`, grp.options.map((o) => `${o.label} ${optionValue(o, g[o.key])}`).join(', ')));
}

function groupPage(body, view, grp) {
  const st = view.app.settings;
  const g = st.graphics;
  const preset = st.preset;
  body.appendChild(el('div', 'note set-intro')).textContent = `Quality: ${preset === 'custom' ? 'Custom' : GRAPHICS_PRESETS[preset].label}. Changing an option here makes it Custom; Graphics has the presets.`;
  for (const o of grp.options) {
    const r = el('div', 'row opt');
    const label = el('label');
    const val = el('b');
    label.append(document.createTextNode(`${o.label}: `), val);
    r.appendChild(label);
    const show = (v) => (val.textContent = optionValue(o, v));
    show(g[o.key]);
    if (o.type === 'range') {
      const i = el('input');
      i.id = label.htmlFor = `setting-${o.key}`;
      i.type = 'range';
      i.min = o.min;
      i.max = o.max;
      i.step = o.step;
      i.value = g[o.key];
      i.addEventListener('input', () => show(Number(i.value)));
      // Applied when the slider is let go (some changes rebuild things).
      i.addEventListener('change', () => {
        st.setGraphics(o.key, Number(i.value));
        view.render();
      });
      r.appendChild(i);
    } else {
      const c = el('div', 'choices');
      for (const [v, text] of o.choices) {
        const b = el('button', g[o.key] === v ? 'on' : '', text);
        b.addEventListener('click', () => {
          st.setGraphics(o.key, v);
          view.render();
        });
        c.appendChild(b);
      }
      r.appendChild(c);
    }
    const n = el('div', 'note');
    n.textContent = o.note + (o.live ? '' : ' Takes effect when the next battle loads.');
    r.appendChild(n);
    body.appendChild(r);
  }
}

function keysOf(b, action) {
  const k = b[action] || [];
  return k.length ? k.map(keyName).join(' or ') : 'no key';
}

function controlsPage(body, view) {
  const st = view.app.settings;
  const b = mergeBindings(st.get('bindings'));
  body.appendChild(
    link(view, 'keys', `Move ${['forward', 'left', 'back', 'right'].map((a) => keyName(b[a]?.[0])).join(' ')}, fire ${keysOf(b, 'fire')}, aim ${keysOf(b, 'aim')}, reload ${keysOf(b, 'reload')}, get in ${keysOf(b, 'use')}`),
  );
  body.appendChild(
    choiceRow(
      'Aiming',
      [
        [false, 'Hold the key'],
        [true, 'Press once, again to lower'],
      ],
      !!st.get('aimToggle'),
      (v) => {
        st.set('aimToggle', v);
        view.render();
      },
      `Aim through the sights with ${keysOf(b, 'aim')}: while you hold it, or from one press to the next. Sprinting or reloading lowers the gun.`,
    ),
  );
  body.appendChild(slider(view, 'mouseSensitivity', 'Mouse sensitivity', 0.2, 3, 0.05, (v) => Number(v).toFixed(2), 'How far the view turns for a move of the mouse or touchpad.'));
  body.appendChild(slider(view, 'adsSensitivity', 'Aiming sensitivity', 0.2, 1.5, 0.05, (v) => Number(v).toFixed(2), 'The same while aiming, on top of the zoom of the sight.'));
  body.appendChild(toggleRow(view, 'invertY', 'Invert mouse', 'Mouse forward looks down, as in a flight game.'));
}

function keysPage(body, view) {
  const st = view.app.settings;
  const b = mergeBindings(st.get('bindings'));
  body.appendChild(el('div', 'note set-intro')).textContent =
    'Click a box, then press the key you want (or click the box again with the mouse button you want). Delete clears a box, Esc cancels. Each action can have two keys.';
  if (view.notice) {
    const n = el('div', 'set-notice');
    n.appendChild(el('span')).textContent = view.notice.text;
    if (view.notice.undo) {
      const u = el('button', '', 'Undo');
      const before = view.notice.undo;
      u.addEventListener('click', () => {
        st.set('bindings', before);
        view.notice = null;
        view.render();
      });
      n.appendChild(u);
    }
    body.appendChild(n);
  }
  for (const grp of ACTIONS) {
    body.appendChild(el('h4', 'set-group')).textContent = grp.group;
    const table = el('div', 'keys-table');
    for (const [action, name, , note] of grp.actions) {
      const r = el('div', 'key-row');
      const l = r.appendChild(el('div', 'key-name'));
      l.textContent = name;
      if (note) l.appendChild(el('div', 'key-note')).textContent = note;
      const codes = b[action] || [];
      for (let slot = 0; slot < 2; slot++) {
        const code = codes[slot];
        const box = el('button', `key-box${code ? '' : ' empty'}`);
        box.textContent = code ? keyName(code) : slot && !codes[0] ? '' : 'Add';
        box.title = `${name}: ${code ? 'click to change' : 'click to add a key'}`;
        if (slot === 1 && !codes[0]) box.disabled = true;
        box.addEventListener('click', () => view._startCapture(action, slot, box));
        r.appendChild(box);
      }
      table.appendChild(r);
    }
    body.appendChild(table);
  }
  body.appendChild(el('h4', 'set-group', 'Fixed'));
  const fixed = el('div', 'keys-table');
  for (const [name, keys] of [
    ['Menu: open, close, back', 'Esc'],
    ['Change weapon; the sight range while aiming', 'Mouse wheel'],
    ['Look around', 'Mouse or touchpad'],
  ]) {
    const r = el('div', 'key-row');
    r.appendChild(el('div', 'key-name')).textContent = name;
    r.appendChild(el('div', 'key-fixed')).textContent = keys;
    fixed.appendChild(r);
  }
  body.appendChild(fixed);
  const reset = el('button', 'set-reset', 'Reset all keys');
  reset.addEventListener('click', () => {
    const before = st.get('bindings') || {};
    st.set('bindings', {});
    view.notice = { text: 'All keys are back to how the game came.', undo: before };
    view.render();
  });
  body.appendChild(reset);
}

function soundPage(body, view) {
  body.appendChild(slider(view, 'masterVolume', 'Volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`));
}

function screenPage(body, view) {
  body.appendChild(slider(view, 'fov', 'Field of view', 60, 100, 1, (v) => `${v}°`, 'How wide you see. Wider shows more at the sides; narrower makes things look bigger.'));
  body.appendChild(
    toggleRow(view, 'crosshair', 'Crosshair', 'A mark where the gun points when you shoot from the hip. Its gap shows how widely the shots spread (wider on the move, narrower crouched or prone). It fades out when you aim through the sights.'),
  );
  body.appendChild(toggleRow(view, 'showFps', 'Show frame rate', 'Frames per second in the top left corner. 60 is smooth; below 30 try a lower quality or render resolution.'));
}

// A short name for the graphics card from the browser's description of it.
function gpuName(s) {
  s = String(s || '');
  const m = /^ANGLE \((.*)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(', ');
    s = parts[1] || parts[0];
  }
  return s
    .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
    .replace(/\s*(Direct3D|vs_\d|OpenGL ES|D3D1).*$/i, '')
    .replace(/^ANGLE Metal Renderer:\s*/i, '')
    .replace(/,? or similar$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
