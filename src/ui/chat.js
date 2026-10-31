// Chat in an online battle: Enter speaks to his side, Y to everyone; party
// chat from the menus shows here too. Lines fade after a while; the last few
// come back while typing. While the box is open the game's keys rest.
//
//   const chat = new BattleChat(game, { send: (text, all) => ... })
//   chat.line({ name, text, kind: 'team' | 'all' | 'party', mine })
//   chat.dispose()
const SHOW = 12; // seconds a line stays
const KEEP = 8; // lines kept

export class BattleChat {
  constructor(game, { send }) {
    this.game = game;
    this.send = send;
    this.lines = [];
    this.open = null; // 'team' | 'all' while typing
    const root = document.createElement('div');
    root.className = 'hud-chat';
    root.innerHTML = '<div class="hc-lines"></div><form class="hc-say" hidden><span></span><input maxlength="200" autocomplete="off"></form>';
    game.hud.root.appendChild(root);
    this.root = root;
    this.box = root.querySelector('.hc-lines');
    this.form = root.querySelector('form');
    this.input = root.querySelector('input');
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = this.input.value.trim();
      if (t) this.send(t, this.open === 'all');
      this._close();
    });
    this.onKey = (e) => {
      if (this.open) {
        e.stopPropagation();
        if (e.key === 'Escape') this._close();
        return;
      }
      // Only while playing (the mouse held by the game), not in a menu.
      const input = this.game.app?.input;
      if (e.repeat || !input?.locked || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') this._start('team', e);
      else if (e.code === 'KeyY') this._start('all', e);
    };
    window.addEventListener('keydown', this.onKey, true);
    this.timer = setInterval(() => this._draw(), 1000);
  }

  _start(kind, e) {
    e.preventDefault();
    e.stopPropagation();
    const input = this.game.app.input;
    this.open = kind;
    input.enabled = false;
    input.down.clear();
    this.form.hidden = false;
    this.form.querySelector('span').textContent = kind === 'all' ? 'To everyone:' : 'To your side:';
    this.root.classList.add('typing');
    this.input.value = '';
    this.input.focus();
    this._draw();
  }

  _close() {
    this.open = null;
    this.form.hidden = true;
    this.root.classList.remove('typing');
    this.input.blur();
    const input = this.game.app?.input;
    if (input) input.enabled = true;
    this._draw();
  }

  line({ name, text, kind = 'team', mine = false }) {
    this.lines.push({ name, text, kind, mine, t: performance.now() });
    if (this.lines.length > KEEP) this.lines.shift();
    this._draw();
  }

  _draw() {
    const now = performance.now();
    this.box.innerHTML = '';
    for (const l of this.lines) {
      if (!this.open && now - l.t > SHOW * 1000) continue;
      const d = document.createElement('div');
      d.className = `hc-line ${l.kind}${l.mine ? ' mine' : ''}`;
      d.innerHTML = '<i></i><b></b><span></span>';
      d.querySelector('i').textContent = l.kind === 'all' ? '[All] ' : l.kind === 'party' ? '[Party] ' : '';
      d.querySelector('b').textContent = `${l.name}: `;
      d.querySelector('span').textContent = l.text;
      this.box.appendChild(d);
    }
  }

  dispose() {
    clearInterval(this.timer);
    window.removeEventListener('keydown', this.onKey, true);
    this.root.remove();
  }
}
