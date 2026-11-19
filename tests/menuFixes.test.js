// Fixes to the menus and the battle screen, checked with small stand-ins for
// the page: keys typed in the menus do not carry into the battle, "click again
// to confirm" is not passed by a double-click, names are shown as written in
// the kill feed and on the scoreboard, and the battle chat gives the game its
// keys back when the mouse is let go.
import test from 'node:test';
import assert from 'node:assert/strict';

// A stand-in for window and document that keeps the listeners.
function page() {
  const on = { window: {}, document: {} };
  const add = (where) => (type, fn) => (on[where][type] ||= []).push(fn);
  const remove = (where) => (type, fn) => (on[where][type] = (on[where][type] || []).filter((f) => f !== fn));
  globalThis.window = { addEventListener: add('window'), removeEventListener: remove('window') };
  globalThis.document = { addEventListener: add('document'), removeEventListener: remove('document'), querySelector: () => null, pointerLockElement: null };
  const fire = (where, type, e) => (on[where][type] || []).forEach((fn) => fn(e));
  return { on, fire };
}
const key = (code, target = { tagName: 'BODY' }) => ({ code, key: code, target, repeat: false, preventDefault() {}, stopPropagation() {} });

test("keys typed in a box are not the game's, and none carry into the battle", async () => {
  const { fire } = page();
  const { Input, typing } = await import('../src/core/input.js');
  const input = new Input({ addEventListener() {} });
  // Typing a name or an email: not a key of the game.
  fire('window', 'keydown', key('KeyM', { tagName: 'INPUT', type: 'email' }));
  fire('window', 'keydown', key('KeyW', { tagName: 'TEXTAREA' }));
  fire('window', 'keydown', key('KeyE', { tagName: 'DIV', isContentEditable: true }));
  assert.equal(input.pressed.size, 0);
  assert.equal(input.down.size, 0);
  // A slider or tick box keeps the focus after a click: its keys still count.
  assert.equal(typing({ tagName: 'INPUT', type: 'range' }), false);
  assert.equal(typing({ tagName: 'INPUT', type: 'checkbox' }), false);
  assert.equal(typing({ tagName: 'INPUT' }), true, 'a plain box is a text box');
  assert.equal(typing(null), false);
  // A key pressed in the menus (outside a box) is forgotten as the battle starts.
  fire('window', 'keydown', key('KeyM'));
  assert.ok(input.hit('map'));
  input.wheel = 2;
  input.dx = 5;
  input.clear();
  assert.equal(input.hit('map'), false);
  assert.equal(input.is('map'), false);
  assert.deepEqual([input.pressed.size, input.released.size, input.down.size, input.wheel, input.dx], [0, 0, 0, 0, 0]);
  // And keys work as before afterwards.
  fire('window', 'keydown', key('KeyR'));
  assert.ok(input.hit('reload'));
});

test('a confirming click only counts when it is a click of its own', async () => {
  const { tooSoon, CONFIRM_GAP } = await import('../src/ui/confirmClick.js');
  assert.equal(tooSoon({ detail: 2 }, 0, 5000), true, 'the second half of a double-click');
  assert.equal(tooSoon({ detail: 1 }, 1000, 1000 + CONFIRM_GAP - 1), true, 'too quick after the first');
  assert.equal(tooSoon({ detail: 1 }, 1000, 1000 + CONFIRM_GAP + 1), false);
  assert.equal(tooSoon({}, 0, 5000), false, 'a click with no count');
});

// A stand-in element that keeps what is put in it.
function box() {
  const kids = [];
  return {
    innerHTML: '',
    children: kids,
    style: {},
    classList: { toggle() {}, contains: () => false },
    prepend: (x) => kids.unshift(x),
    get lastChild() {
      return { remove: () => kids.pop() };
    },
  };
}

test('names in the kill feed and on the scoreboard are shown as written', async () => {
  page();
  globalThis.document.createElement = () => box();
  const { Hud } = await import('../src/ui/hud.js');
  const odd = '<img src=x onerror=alert(1)>';
  const feed = box();
  const hud = Object.create(Hud.prototype);
  hud.killfeedEl = feed;
  const t = setTimeout;
  globalThis.setTimeout = () => 0;
  try {
    hud.killFeed({ name: odd }, { name: 'A & B' }, { weapon: { name: 'Kar98k' } });
  } finally {
    globalThis.setTimeout = t;
  }
  const row = feed.children[0].innerHTML;
  assert.ok(!row.includes('<img'), row);
  assert.ok(row.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(row.includes('A &amp; B'));
  // The scoreboard, held open.
  const scores = box();
  hud.scoresEl = scores;
  hud.root = { querySelector: () => null };
  const me = { name: 'Me', team: 1, faction: 'US', score: 5, kills: 1, deaths: 0, alive: true };
  const g = { input: { is: () => true }, mode: null, player: { soldier: me }, soldiers: [me, { name: odd, team: 2, faction: 'GE', score: 1, kills: 0, deaths: 1, alive: true }] };
  hud._updateScores(g);
  assert.ok(scores.innerHTML.includes('&lt;img'), scores.innerHTML);
  assert.ok(!scores.innerHTML.includes('<img'));
});

test('the battle chat closes when the mouse is let go, giving the game its keys back', async () => {
  const { fire } = page();
  const el = () => {
    const e = box();
    e.hidden = true;
    e.classList = { add() {}, remove() {} };
    e.addEventListener = () => {};
    e.querySelector = () => field;
    e.appendChild = () => {};
    e.focus = () => {};
    e.blur = () => {};
    e.remove = () => {};
    return e;
  };
  const field = el();
  globalThis.document.createElement = () => el();
  globalThis.performance ??= { now: () => 0 };
  const { BattleChat } = await import('../src/ui/chat.js');
  const input = { locked: true, enabled: true, down: new Set() };
  const game = { app: { input }, hud: { root: { appendChild() {} } } };
  const chat = new BattleChat(game, { send() {} });
  fire('window', 'keydown', { ...key('Enter'), ctrlKey: false, metaKey: false, altKey: false });
  assert.equal(chat.open, 'team');
  assert.equal(input.enabled, false, 'the game rests while he types');
  // Esc with the mouse held: the browser lets the mouse go and the box never hears it.
  input.locked = false;
  fire('document', 'pointerlockchange', {});
  assert.equal(chat.open, null);
  assert.equal(input.enabled, true);
  chat.dispose();
});
