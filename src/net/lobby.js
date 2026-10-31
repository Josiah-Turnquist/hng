// The menu connection to the game server (/lobby, src/server/social.js):
// friends, the party and party chat, kept up for as long as the page is open
// (it comes back by itself after a drop).
//
//   const lobby = new Lobby(account)
//   lobby.on(() => ...)                 // something changed (state below)
//   lobby.state: { me, friends: [...], party, invites: [...], chat: [{ name, text, mine }], note }
//   lobby.ask(name), accept(id), drop(id)          // friends
//   lobby.invite(id), take(party), turnDown(party), leave(), kick(id), say(text)
//   lobby.army(army)                    // the army of the soldier he has chosen
//   lobby.go()                          // (leader) going into battle: the party follows
//   lobby.onGo = (leaderId) => ...      // his leader went in
//   lobby.watchWar(true | false)        // the shared war (the Generals tab open)
//   lobby.onWar(() => ...)              // it came: lobby.war (war.js shape), lobby.general (army he leads or null)
//   await lobby.warOrder({ act, id, type, point, to })   -> { ok, why }
import { token } from './auth.js';
import { PROTOCOL_VERSION } from './protocol.js';
import { load } from '../war/war.js';

const CHAT_KEEP = 60; // party chat lines kept

export class Lobby {
  constructor(account) {
    this.account = account;
    this.state = { me: null, friends: [], party: null, invites: [], chat: [], note: '' };
    this.listeners = new Set();
    this.onGo = null;
    this.onChat = null; // (line) party chat as it comes (the battle shows it too)
    this.wait = 1000;
    this._army = null;
    this.war = null;
    this.general = null;
    this.warAt = 0; // (performance.now() when it came)
    this.warListeners = new Set();
    this._watching = false;
    this._orders = new Map(); // n -> answer
    this._n = 0;
    this._open();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _changed() {
    for (const fn of this.listeners) fn(this.state);
  }

  async _open() {
    const t = this.account.dev ? null : await token().catch(() => null);
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/lobby`);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ k: 'h', v: PROTOCOL_VERSION, token: t, dev: this.account.dev || null }));
      if (this._army) ws.send(JSON.stringify({ k: 'army', army: this._army }));
      if (this._watching) ws.send(JSON.stringify({ k: 'ww', on: true }));
    };
    ws.onmessage = (e) => this._message(JSON.parse(e.data));
    ws.onclose = () => {
      if (this.closed) return;
      // Back in a moment (longer each time, up to half a minute).
      setTimeout(() => this._open(), this.wait);
      this.wait = Math.min(30000, this.wait * 2);
    };
  }

  _message(m) {
    const s = this.state;
    if (m.k === 'w') {
      s.me = m.me;
      this.wait = 1000;
    } else if (m.k === 'f') s.friends = m.friends;
    else if (m.k === 'p') {
      s.party = m.party;
      s.invites = m.invites;
    } else if (m.k === 'pc') {
      const line = { name: m.name, text: m.text, mine: m.from === s.me?.id };
      s.chat.push(line);
      if (s.chat.length > CHAT_KEEP) s.chat.shift();
      this.onChat?.(line);
    } else if (m.k === 'n') s.note = m.text;
    else if (m.k === 'go') return this.onGo?.(m.by);
    else if (m.k === 'war') {
      const w = load(JSON.stringify(m.war));
      if (!w) return;
      for (const k of ['leaders', 'fights', 'speed', 'nextIn']) w[k] = m.war[k];
      this.war = w;
      this.general = m.you || null;
      this.warAt = performance.now();
      for (const fn of this.warListeners) fn();
      return;
    } else if (m.k === 'wr') {
      this._orders.get(m.n)?.(m);
      return this._orders.delete(m.n);
    }
    else return;
    this._changed();
  }

  _send(m) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m));
  }

  ask(name) {
    this.state.note = '';
    this._send({ k: 'fr', name });
  }
  accept(id) {
    this._send({ k: 'fa', id });
  }
  drop(id) {
    this._send({ k: 'fd', id });
  }
  invite(id) {
    this._send({ k: 'pi', id });
  }
  take(party) {
    this._send({ k: 'pa', party });
  }
  turnDown(party) {
    this._send({ k: 'pn', party });
  }
  leave() {
    this._send({ k: 'pl' });
  }
  kick(id) {
    this._send({ k: 'pk', id });
  }
  say(text) {
    this._send({ k: 'pc', text });
  }
  army(army) {
    if (army === this._army) return;
    this._army = army;
    this._send({ k: 'army', army });
  }
  go() {
    this._send({ k: 'go' });
  }

  watchWar(on) {
    this._watching = !!on;
    this._send({ k: 'ww', on: !!on });
  }
  onWar(fn) {
    this.warListeners.add(fn);
    return () => this.warListeners.delete(fn);
  }
  warOrder(order) {
    const n = ++this._n;
    return new Promise((ok) => {
      if (this.ws?.readyState !== 1) return ok({ ok: false, why: 'Not connected to the game server. Try again in a moment.' });
      const timer = setTimeout(() => {
        this._orders.delete(n);
        ok({ ok: false, why: 'The game server did not answer' });
      }, 8000);
      this._orders.set(n, (m) => {
        clearTimeout(timer);
        ok(m);
      });
      this._send({ ...order, k: 'wo', n });
    });
  }

  // Is he in a party, and its leader?
  get leading() {
    const p = this.state.party;
    return !!p && p.leader === this.state.me?.id;
  }
  // The army his party's leader fights with (to fight on his side), or null.
  get leaderArmy() {
    const p = this.state.party;
    return p && !this.leading ? p.members.find((x) => x.id === p.leader)?.army || null : null;
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}
