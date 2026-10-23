// Keyboard and mouse input with pointer lock.
// Actions are looked up by name (e.g. "sprint") so keys can be rebound in one place.

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
  use: ['KeyF'],
  reload: ['KeyR'],
  fireMode: ['KeyB'],
  zeroUp: ['PageUp', 'BracketRight'],
  zeroDown: ['PageDown', 'BracketLeft'],
  bandage: ['KeyX'],
  grenade: ['KeyG'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  slot4: ['Digit4'],
  map: ['KeyM'],
  scores: ['Tab'],
  camera: ['KeyV'],
  seat1: ['F1'],
  seat2: ['F2'],
  seat3: ['F3'],
  seat4: ['F4'],
  ammo1: ['Digit1'],
  ammo2: ['Digit2'],
  ammo3: ['Digit3'],
  gearUp: ['KeyE'],
  gearDown: ['KeyQ'],
  handbrake: ['Space'],
  freeLook: ['KeyL'],
  debug: ['F9'],
};

export class Input {
  constructor(element) {
    this.element = element;
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.down = new Set();
    this.pressed = new Set(); // keys that went down since last endFrame()
    this.released = new Set();
    this.mouseDown = [false, false, false];
    this.mousePressed = [false, false, false];
    this.mouseReleased = [false, false, false];
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      // Free-mouse mode has no browser exit key: Esc releases (pauses) here.
      if (e.code === 'Escape' && this.freeMouse && this.locked) {
        this.unlock();
        return;
      }
      if (this.locked && (e.code === 'Tab' || e.code.startsWith('F') || e.code === 'Space' || e.code === 'AltLeft')) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = [false, false, false];
    });
    element.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button < 3) {
        this.mouseDown[e.button] = true;
        this.mousePressed[e.button] = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) {
        if (this.mouseDown[e.button]) this.mouseReleased[e.button] = true;
        this.mouseDown[e.button] = false;
      }
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
      if (!this.locked) {
        this.down.clear();
        this.mouseDown = [false, false, false];
      }
      this.onLockChange?.(this.locked);
    });
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
      this.mouseDown = [false, false, false];
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

  up(action) {
    const keys = this.bindings[action];
    if (!keys) return false;
    for (const k of keys) if (this.released.has(k)) return true;
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
    this.mousePressed[0] = this.mousePressed[1] = this.mousePressed[2] = false;
    this.mouseReleased[0] = this.mouseReleased[1] = this.mouseReleased[2] = false;
  }
}
