// Keyboard and mouse input with pointer lock.
// Actions are looked up by name (e.g. "sprint") so keys can be rebound in one
// place (Settings > Controls > Keys). Keys are named by their position on the
// keyboard (KeyboardEvent.code, so W A S D stay put on any layout); mouse
// buttons are Mouse0 (left), Mouse1 (middle), Mouse2 (right), Mouse3 and Mouse4
// (the side buttons), so any action can be on a key or a mouse button.

export const DEFAULT_BINDINGS = {
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  sprint: ['ShiftLeft'],
  walk: ['AltLeft'],
  jump: ['Space'],
  crouch: ['KeyC', 'ControlLeft'],
  prone: ['KeyZ'],
  leanLeft: ['KeyQ'],
  leanRight: ['KeyE'],
  fire: ['Mouse0'],
  aim: ['Mouse2', 'Backquote'],
  reload: ['KeyR'],
  fireMode: ['KeyB', 'Mouse1'],
  zeroUp: ['PageUp', 'BracketRight'],
  zeroDown: ['PageDown', 'BracketLeft'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3', 'KeyG'],
  slot4: ['Digit4'],
  slot5: ['Digit5'],
  slot6: ['Digit6'],
  slot7: ['Digit7'],
  melee: ['KeyT'],
  bandage: ['KeyX'],
  use: ['KeyF'],
  handbrake: ['Space'],
  camera: ['KeyV'],
  seat1: ['F1'],
  seat2: ['F2'],
  seat3: ['F3'],
  seat4: ['F4'],
  ammo1: ['Digit1'],
  ammo2: ['Digit2'],
  ammo3: ['Digit3'],
  scores: ['Tab'],
};

// The actions as the controls menu shows them, in groups: [action, name, where it
// is used, note]. Where: 'foot' (on foot), 'vehicle' (in a vehicle) or 'any'. Two
// actions may share a key only if they are never used in the same place (1 picks
// your rifle on foot and the first shell type in a tank).
export const ACTIONS = [
  {
    group: 'Moving',
    actions: [
      ['forward', 'Move forward', 'any', 'Also the throttle in a vehicle.'],
      ['back', 'Move back', 'any', 'Also the brake and reverse.'],
      ['left', 'Move left', 'any', 'Also steers left.'],
      ['right', 'Move right', 'any', 'Also steers right.'],
      ['sprint', 'Sprint', 'any', 'While aiming: hold your breath to steady the gun.'],
      ['walk', 'Walk slowly', 'foot'],
      ['jump', 'Jump, stand up', 'foot', 'Also goes back into the battle after you fall.'],
      ['crouch', 'Crouch', 'foot'],
      ['prone', 'Lie down', 'foot'],
      ['leanLeft', 'Lean left', 'foot', 'Also picks the spawn point after you fall.'],
      ['leanRight', 'Lean right', 'foot'],
    ],
  },
  {
    group: 'Weapons',
    actions: [
      ['fire', 'Fire', 'any', 'Hold to cook a grenade, let go to throw it.'],
      ['aim', 'Aim through the sights', 'any', 'Also the gunner\'s sight in a tank.'],
      ['reload', 'Reload, work the bolt', 'foot'],
      ['fireMode', 'Fire mode, scope or iron sights', 'foot', 'On a scoped rifle with one fire mode whose mount leaves the iron sights clear, switches between the scope and the iron sights.'],
      ['zeroUp', 'Sight range up', 'any'],
      ['zeroDown', 'Sight range down', 'any'],
      ['slot1', 'Main weapon', 'foot'],
      ['slot2', 'Sidearm', 'foot'],
      ['slot3', 'Equipment 1 (grenade)', 'foot'],
      ['slot4', 'Equipment 2', 'foot'],
      ['slot5', 'Equipment 3', 'foot'],
      ['slot6', 'Close combat weapon', 'foot'],
      ['slot7', 'Binoculars', 'foot'],
      ['melee', 'Quick close combat attack', 'foot', 'One blow with your close combat weapon (knife, bayonet, spade or bat) from whatever is in your hands, then back to it.'],
      ['bandage', 'Bandage', 'foot'],
    ],
  },
  {
    group: 'Vehicles',
    actions: [
      ['use', 'Get in, get out', 'any'],
      ['handbrake', 'Handbrake, coaxial machine gun', 'vehicle', 'The handbrake for drivers, the machine gun beside a tank\'s main gun for its gunner.'],
      ['camera', 'Inside or outside view', 'vehicle'],
      ['seat1', 'Seat 1 (driver)', 'vehicle'],
      ['seat2', 'Seat 2', 'vehicle'],
      ['seat3', 'Seat 3', 'vehicle'],
      ['seat4', 'Seat 4', 'vehicle'],
      ['ammo1', 'Tank shell 1', 'vehicle'],
      ['ammo2', 'Tank shell 2', 'vehicle'],
      ['ammo3', 'Tank shell 3', 'vehicle'],
    ],
  },
  {
    group: 'Battle',
    actions: [['scores', 'Scoreboard (hold)', 'any']],
  },
];
const WHERE = Object.fromEntries(ACTIONS.flatMap((g) => g.actions.map(([a, , w]) => [a, w])));

// Keys the browser keeps for itself or that the game reserves.
export const RESERVED = new Set(['Escape', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'ContextMenu']);

// Would these two actions get in each other's way on one key?
export function clash(a, b) {
  const wa = WHERE[a] || 'any',
    wb = WHERE[b] || 'any';
  return a !== b && (wa === 'any' || wb === 'any' || wa === wb);
}

// The bindings with a player's changes (saved as { action: [codes] }) on top of
// the defaults. Unknown actions and malformed entries are left out.
export function mergeBindings(saved) {
  const b = structuredClone(DEFAULT_BINDINGS);
  if (saved && typeof saved === 'object') {
    for (const [a, codes] of Object.entries(saved)) {
      if (a in b && Array.isArray(codes)) b[a] = codes.filter((c) => typeof c === 'string' && !RESERVED.has(c)).slice(0, 2);
    }
  }
  return b;
}

// What to save: only the actions that differ from the defaults.
export function bindingChanges(bindings) {
  const out = {};
  for (const [a, codes] of Object.entries(bindings)) {
    const d = DEFAULT_BINDINGS[a];
    if (d && (codes.length !== d.length || codes.some((c, i) => c !== d[i]))) out[a] = [...codes];
  }
  return out;
}

// Plain names for key codes. The letters and symbols are those of a US keyboard
// unless the browser tells us the real layout (see loadKeyboardLayout).
const NAMES = {
  Mouse0: 'Left mouse',
  Mouse1: 'Middle mouse',
  Mouse2: 'Right mouse',
  Mouse3: 'Mouse button 4',
  Mouse4: 'Mouse button 5',
  Space: 'Space',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  Tab: 'Tab',
  CapsLock: 'Caps Lock',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '\\',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Home: 'Home',
  End: 'End',
  Insert: 'Insert',
  Delete: 'Delete',
  ArrowUp: 'Up arrow',
  ArrowDown: 'Down arrow',
  ArrowLeft: 'Left arrow',
  ArrowRight: 'Right arrow',
  NumpadEnter: 'Num Enter',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
};
let layout = null;
// Where the browser can say what is printed on each key (Chrome and Edge, in
// pages allowed to ask), use those names for letters and symbols.
export function loadKeyboardLayout() {
  try {
    navigator.keyboard
      ?.getLayoutMap?.()
      ?.then((m) => (layout = m))
      .catch(() => {});
  } catch {
    /* not available here */
  }
}
const PRINTED = /^(Key|Digit|Backquote|Minus|Equal|Bracket|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)/;
export function keyName(code) {
  if (!code) return '';
  // Letters and symbols: what is printed on the key, where the browser says.
  const printed = PRINTED.test(code) ? layout?.get?.(code) : null;
  if (printed && printed.trim()) return printed.length === 1 ? printed.toUpperCase() : printed;
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export class Input {
  constructor(element) {
    this.element = element;
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.down = new Set(); // keys and mouse buttons held
    this.pressed = new Set(); // went down since last endFrame()
    this.released = new Set();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    this.onLockChange = null;
    loadKeyboardLayout();

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      // Free-mouse mode has no browser exit key: Esc releases (pauses) here.
      if (e.code === 'Escape' && this.freeMouse && this.locked) {
        e.hngPaused = true;
        this.unlock();
        return;
      }
      // (On the deploy screen the mouse is free but Tab is still the
      // scoreboard: it must not also step between the screen's buttons.)
      if (e.code === 'Tab' && !this.locked && document.querySelector('.hud.deploying')) e.preventDefault();
      if (this.locked && (e.code === 'Tab' || e.code.startsWith('F') || e.code === 'Space' || e.code.startsWith('Alt') || e.code === 'Backquote' || e.code === 'Quote' || e.code === 'Slash')) e.preventDefault();
      if (e.repeat) return;
      this._press(e.code);
    });
    window.addEventListener('keyup', (e) => this._release(e.code));
    window.addEventListener('blur', () => this.down.clear());
    element.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 1) e.preventDefault(); // (no autoscroll)
      if (e.button < 5) this._press(`Mouse${e.button}`);
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 5) this._release(`Mouse${e.button}`);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Ignore absurd spikes some browsers produce right after locking.
      if (Math.abs(e.movementX) > 600 || Math.abs(e.movementY) > 600) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.locked) return;
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: true },
    );
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.freeMouse = false;
      this.locked = document.pointerLockElement === element;
      if (!this.locked) this.down.clear();
      this.onLockChange?.(this.locked);
    });
  }

  _press(code) {
    if (this.down.has(code)) return;
    this.down.add(code);
    this.pressed.add(code);
  }

  _release(code) {
    if (!this.down.delete(code)) return;
    this.released.add(code);
  }

  // A player's key changes (Settings > Controls > Keys) on top of the defaults.
  setBindings(saved) {
    this.bindings = mergeBindings(saved);
  }

  // The keys of an action in plain words: "Right mouse or `".
  keys(action) {
    const k = this.bindings[action] || [];
    return k.length ? k.map(keyName).join(' or ') : 'no key';
  }

  // The first key of an action: "F".
  key(action) {
    return keyName(this.bindings[action]?.[0]) || 'no key';
  }

  lock() {
    if (this.locked) return;
    let p = null;
    try {
      p = this.element.requestPointerLock?.({ unadjustedMovement: true });
    } catch {
      p = null;
    }
    // Some browsers reject unadjustedMovement; fall back to a plain request
    // (which may be refused too, inside pages that don't allow mouse capture).
    if (p && p.catch)
      p.catch(() => {
        try {
          this.element.requestPointerLock?.()?.catch?.(() => {});
        } catch {
          /* the free-mouse fallback below takes over */
        }
      });
    // Where the mouse can't be captured at all (some embedded pages), play with
    // the free mouse instead: its movement still turns the view.
    clearTimeout(this._lockTimer);
    this._lockTimer = setTimeout(() => {
      if (this.locked || document.pointerLockElement) return;
      this.freeMouse = true;
      this.locked = true;
      this.onLockChange?.(true);
    }, 600);
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.freeMouse && this.locked) {
      this.locked = false;
      this.down.clear();
      this.onLockChange?.(false);
    }
  }

  // True while any key bound to the action is held.
  is(action) {
    const keys = this.bindings[action];
    if (!keys) return false;
    for (const k of keys) if (this.down.has(k)) return true;
    return false;
  }

  // True only on the frame the action was pressed.
  hit(action) {
    const keys = this.bindings[action];
    if (!keys) return false;
    for (const k of keys) if (this.pressed.has(k)) return true;
    return false;
  }

  // True only on the frame the action was let go (and no other key of it is held).
  up(action) {
    const keys = this.bindings[action];
    if (!keys) return false;
    for (const k of keys) if (this.released.has(k)) return !this.is(action);
    return false;
  }

  // Take the accumulated mouse movement (and reset it).
  takeMouse() {
    const d = [this.dx, this.dy];
    this.dx = 0;
    this.dy = 0;
    return d;
  }

  takeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  // Called once per rendered frame after all systems have read input.
  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}
