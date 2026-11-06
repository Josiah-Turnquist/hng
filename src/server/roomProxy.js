// A battle running in its own thread (roomWorker.js), as the game server sees
// it: the same calls as a BattleRoom (room.js), passed on as messages. The
// server does one thing at a time, and one full battle keeps most of a
// processor core busy; with each battle in a thread of its own, two or three
// battles at once each get a core instead of slowing every battle down.
//
//   const r = new RoomProxy({ perSide, attackers, defenders, difficulty, war, send })
//   await r.ready
//   await r.join(client, info) -> soldier id (or throws)    await r.rejoin(client, userId) -> soldier id or null
//   r.input / chat / leaving / leave / gone / release        r.holding(userId), r.heldSoldier(userId)
//   r.playersOn(team), r.sideOf(army), r.players.size, r.isOver, r.closed, r.opts
//   r.onReward / onMinute / onError / onOver / onClose       await r.finish(); r.close()
//
// What it knows of the battle (who is on which side, who is held) is what the
// battle last told it, a moment old at most.
import { Worker } from 'node:worker_threads';
import { ATT, DEF } from './battle.js';

export class RoomProxy {
  constructor({ send, ...opts } = {}) {
    this.opts = { perSide: 12, attackers: 'US', defenders: 'GE', ...opts };
    this.send = send;
    this.closed = false;
    this.isOver = false;
    this.players = { size: 0 };
    this._on = { [ATT]: 0, [DEF]: 0 };
    this._held = new Map(); // user id -> [his held soldier's id in the battle, his kept soldier's id]
    this._cids = new Map(); // client -> number
    this._clients = new Map(); // number -> client
    this._calls = new Map();
    this._n = 0;
    this.onClose = this.onReward = this.onMinute = this.onError = this.onOver = null;
    this.worker = new Worker(new URL('./roomWorker.js', import.meta.url), { workerData: { opts: this.opts } });
    this.ready = new Promise((ok, fail) => {
      this._ready = ok;
      this._failed = fail;
    });
    this.worker.on('message', (m) => this._message(m));
    this.worker.on('error', (e) => {
      this.onError?.(e);
      this._failed?.(e);
    });
    // The thread gone (closed, or failed): its players are told, so their
    // games try to get back in (and hear that the battle is gone).
    this.worker.on('exit', () => {
      if (!this.closed) {
        for (const [client] of this._cids) client.close?.(4000, 'battle ended');
        this._closed();
      }
      for (const [, c] of this._calls) c.fail(new Error('The battle has ended'));
      this._calls.clear();
    });
  }

  _cid(client) {
    let id = this._cids.get(client);
    if (!id) {
      id = this._cids.size + 1;
      this._cids.set(client, id);
      this._clients.set(id, client);
    }
    return id;
  }

  _call(m) {
    const call = ++this._n;
    return new Promise((ok, fail) => {
      this._calls.set(call, { ok, fail });
      this.worker.postMessage({ ...m, call });
    });
  }

  _post(m) {
    if (!this.closed) this.worker.postMessage(m);
  }

  _message(m) {
    switch (m.t) {
      case 'send': {
        const c = this._clients.get(m.cid);
        if (c) this.send(c, m.text);
        return;
      }
      case 'state':
        this._on = { [ATT]: m.att, [DEF]: m.def };
        this.players = { size: m.players };
        this.isOver = m.over;
        this._held = new Map(m.held);
        return;
      case 'answer': {
        const c = this._calls.get(m.call);
        this._calls.delete(m.call);
        if (c) m.ok ? c.ok(m.value) : c.fail(new Error(m.value));
        return;
      }
      case 'reward': {
        const saving = this.onReward?.({ client: this._clients.get(m.cid), userId: m.userId, name: m.name, soldierId: m.soldierId, reward: m.reward, info: m.info });
        Promise.resolve(saving)
          .catch(() => {})
          .then(() => this._post({ t: 'saved', id: m.id }));
        return;
      }
      case 'minute':
        return this.onMinute?.(m.x);
      case 'error':
        return this.onError?.(Object.assign(new Error(m.message), { stack: `Error: ${m.message}\n    ${m.place}` }));
      case 'over':
        this.isOver = true;
        return this.onOver?.(m.team);
      case 'ready':
        return this._ready(this);
      case 'closed':
        this._closed();
        this.worker.terminate();
        return;
    }
  }

  _closed() {
    if (this.closed) return;
    this.closed = true;
    this.onClose?.(this);
  }

  sideOf(faction) {
    return faction === this.opts.attackers ? ATT : faction === this.opts.defenders ? DEF : null;
  }
  playersOn(team) {
    return this._on[team] || 0;
  }
  holding(userId) {
    return this._held.get(userId)?.[0] ?? null;
  }
  heldSoldier(userId) {
    return this._held.get(userId)?.[1] ?? null;
  }

  join(client, info) {
    return this._call({ t: 'join', cid: this._cid(client), info });
  }
  rejoin(client, userId) {
    return this._call({ t: 'rejoin', cid: this._cid(client), userId });
  }
  input(client, msg) {
    const cid = this._cids.get(client);
    if (cid) this._post({ t: 'input', cid, msg });
  }
  chat(client, text, all) {
    const cid = this._cids.get(client);
    if (cid) this._post({ t: 'chat', cid, text, all });
  }
  leaving(client) {
    const cid = this._cids.get(client);
    if (cid) this._post({ t: 'leaving', cid });
  }
  leave(client) {
    const cid = this._cids.get(client);
    if (cid) this._post({ t: 'leave', cid });
  }
  gone(client) {
    const cid = this._cids.get(client);
    if (cid) this._post({ t: 'gone', cid });
  }
  release(userId) {
    this._held.delete(userId);
    this._post({ t: 'release', userId });
  }

  // The server is stopping: every player's battle so far kept, then closed.
  async finish() {
    if (this.closed) return;
    await this._call({ t: 'finish' }).catch(() => {});
  }

  close() {
    if (this.closed) return;
    this._post({ t: 'close' });
  }
}
