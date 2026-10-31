// Friends, parties and chat on the game server, over each signed-in player's
// menu connection (/lobby; the battle has its own, /play).
//
// Friends are kept in the database (progressStore: befriend, unfriend,
// friendsOf, byName); who is online, parties and invites live here only, for
// as long as the server runs. A party fights together: its players go into
// the same battle (roomFor in server/main.mjs asks partyRoom), and when its
// leader goes in, the others are called after him ('go').
//
// From the browser:
//   { k: 'h', v, token | dev }      who he is (as for a battle)
//   { k: 'fr', name }               ask a player to be friends, by name
//   { k: 'fa', id } / { k: 'fd', id }   accept / decline, cancel or remove
//   { k: 'pi', id }                 invite a friend into his party
//   { k: 'pa', party } / { k: 'pn', party }   take / turn down an invite
//   { k: 'pl' }  { k: 'pk', id }    leave his party / (leader) send one out
//   { k: 'pc', text }               party chat
//   { k: 'army', army }             the army of the soldier he has chosen
//   { k: 'go' }                     (leader) going into battle: the party follows
// To the browser:
//   { k: 'w', me }                  welcome
//   { k: 'f', friends: [{ id, name, status: 'friend' | 'asked' | 'asks', where }] }
//       where: 'menus', 'battle' or null (offline)
//   { k: 'p', party: { id, leader, members: [{ id, name, army, where }] } | null,
//            invites: [{ party, from, name }] }
//   { k: 'pc', from, name, text }   party chat
//   { k: 'go', by }                 his leader went into battle
//   { k: 'n', text }                a note (an error, a refusal)
import { cleanName } from './auth.js';

const MAX_PARTY = 6;
const CHAT_MAX = 200; // letters a line
const CHAT_RATE = [4, 5]; // at most 4 lines in 5 s

// A line of chat as it may be shown: no control characters, trimmed, short.
export function cleanChat(text) {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_MAX);
}

// Not too many lines too fast: true if this one may go (times: his recent lines).
export function chatAllowed(times, now = Date.now()) {
  while (times.length && now - times[0] > CHAT_RATE[1] * 1000) times.shift();
  if (times.length >= CHAT_RATE[0]) return false;
  times.push(now);
  return true;
}

export class Social {
  constructor({ store = null, log = console.log } = {}) {
    // (A store without friends, as some tests use: no friends here.)
    this.store = store?.friendsOf ? store : null;
    this.log = log;
    this.users = new Map(); // id -> { id, name, sockets: Set, army, battle, chat: [] }
    this.parties = new Map(); // party id -> { id, leader, members: [ids], invited: Set }
    this.partyOf = new Map(); // user id -> party id
    this.nextParty = 1;
  }

  // --- Connections ---

  // A menu connection that has said who he is.
  join(ws, who) {
    let u = this.users.get(who.id);
    if (!u) this.users.set(who.id, (u = { id: who.id, name: who.name, sockets: new Set(), army: null, battle: null, chat: [] }));
    u.name = who.name;
    u.sockets.add(ws);
    this.send(u.id, { k: 'w', me: { id: u.id, name: u.name } });
    this._friends(u.id).catch(() => {});
    this._party(u.id);
    this._tellFriends(u.id);
  }

  leave(ws, id) {
    const u = this.users.get(id);
    if (!u) return;
    u.sockets.delete(ws);
    if (u.sockets.size || u.battle) return;
    // Gone (not in a battle either): out of his party, offline to his friends.
    this._leaveParty(id);
    this.users.delete(id);
    this._tellFriends(id);
  }

  // His battle starts or ends (server/main.mjs, from /play).
  inBattle(id, name, room) {
    let u = this.users.get(id);
    if (!u && room) this.users.set(id, (u = { id, name, sockets: new Set(), army: null, battle: null, chat: [] }));
    if (!u) return;
    u.battle = room || null;
    if (!u.battle && !u.sockets.size) {
      this._leaveParty(id);
      this.users.delete(id);
    }
    this._tellFriends(id);
    const p = this._partyOfUser(id);
    if (p) for (const m of p.members) this._party(m);
  }

  where(id) {
    const u = this.users.get(id);
    return !u ? null : u.battle ? 'battle' : 'menus';
  }

  send(id, msg) {
    const u = this.users.get(id);
    if (!u) return;
    const text = JSON.stringify(msg);
    for (const ws of u.sockets) if (ws.readyState === 1) ws.send(text);
  }

  // --- Messages from the browser ---

  async message(id, m) {
    const u = this.users.get(id);
    if (!u || !m || typeof m.k !== 'string') return;
    try {
      if (m.k === 'fr') return await this._ask(u, m.name);
      if (m.k === 'fa') return await this._accept(u, String(m.id));
      if (m.k === 'fd') return await this._drop(u, String(m.id));
      if (m.k === 'pi') return await this._invite(u, String(m.id));
      if (m.k === 'pa') return this._takeInvite(u, Number(m.party));
      if (m.k === 'pn') return this._turnDown(u, Number(m.party));
      if (m.k === 'pl') return this._leaveParty(u.id);
      if (m.k === 'pk') return this._kick(u, String(m.id));
      if (m.k === 'pc') return this._partyChat(u, m.text);
      if (m.k === 'army') {
        u.army = ['US', 'GE', 'SU'].includes(m.army) ? m.army : null;
        const p = this._partyOfUser(u.id);
        if (p) for (const x of p.members) this._party(x);
        return;
      }
      if (m.k === 'go') return this._go(u);
    } catch (e) {
      this.log(`social: ${e.message}`);
      this.send(u.id, { k: 'n', text: 'That did not work. Try again in a moment.' });
    }
  }

  // --- Friends ---

  async _ask(u, name) {
    if (!this.store) return this.send(u.id, { k: 'n', text: 'Friends need the game server to keep players (not set up here).' });
    const n = cleanName(name);
    if (!n) return this.send(u.id, { k: 'n', text: 'Type the player name to add.' });
    const found = (await this.store.byName(n)).filter((x) => x.user_id !== u.id);
    if (!found.length) return this.send(u.id, { k: 'n', text: `No player called ${n}.` });
    if (found.length > 1) return this.send(u.id, { k: 'n', text: `More than one player is called ${n}: ask them for an invite instead.` });
    const them = found[0].user_id;
    const r = await this.store.befriend(u.id, them);
    this.send(u.id, { k: 'n', text: r.status === 'accepted' ? `You and ${found[0].name} are friends.` : `Friend request sent to ${found[0].name}.` });
    await this._friends(u.id);
    await this._friends(them);
  }

  async _accept(u, id) {
    const mine = await this.store.friendsOf(u.id);
    if (!mine.some((f) => f.id === id && f.status === 'pending' && !f.asked)) return;
    await this.store.befriend(u.id, id);
    await this._friends(u.id);
    await this._friends(id);
  }

  async _drop(u, id) {
    await this.store.unfriend(u.id, id);
    await this._friends(u.id);
    await this._friends(id);
  }

  async _isFriend(a, b) {
    return (await this.store?.friendsOf(a))?.some((f) => f.id === b && f.status === 'accepted') ?? false;
  }

  // His friends list, sent to him (if he is on).
  async _friends(id) {
    if (!this.users.get(id)?.sockets.size || !this.store) return;
    const list = await this.store.friendsOf(id);
    this.send(id, { k: 'f', friends: list.map((f) => ({ id: f.id, name: f.name, status: f.status === 'accepted' ? 'friend' : f.asked ? 'asked' : 'asks', where: f.status === 'accepted' ? this.where(f.id) : null })) });
  }

  // Someone came on, went off or into a battle: his friends' lists change.
  _tellFriends(id) {
    if (!this.store) return;
    this.store
      .friendsOf(id)
      .then((list) => {
        for (const f of list) if (f.status === 'accepted') this._friends(f.id).catch(() => {});
      })
      .catch(() => {});
  }

  // --- Parties ---

  _partyOfUser(id) {
    return this.parties.get(this.partyOf.get(id)) || null;
  }

  async _invite(u, id) {
    if (!(await this._isFriend(u.id, id))) return this.send(u.id, { k: 'n', text: 'Only friends can be invited.' });
    if (!this.users.get(id)) return this.send(u.id, { k: 'n', text: 'That friend is not on right now.' });
    let p = this._partyOfUser(u.id);
    if (!p) {
      p = { id: this.nextParty++, leader: u.id, members: [u.id], invited: new Set() };
      this.parties.set(p.id, p);
      this.partyOf.set(u.id, p.id);
    }
    if (p.members.includes(id)) return;
    if (p.members.length >= MAX_PARTY) return this.send(u.id, { k: 'n', text: `A party is ${MAX_PARTY} players at most.` });
    p.invited.add(id);
    this._party(u.id);
    this._party(id);
  }

  _takeInvite(u, partyId) {
    const p = this.parties.get(partyId);
    if (!p || !p.invited.has(u.id)) return this.send(u.id, { k: 'n', text: 'That invite has gone.' });
    if (p.members.length >= MAX_PARTY) return this.send(u.id, { k: 'n', text: 'That party is full.' });
    this._leaveParty(u.id);
    p.invited.delete(u.id);
    p.members.push(u.id);
    this.partyOf.set(u.id, p.id);
    for (const m of p.members) this._party(m);
  }

  _turnDown(u, partyId) {
    const p = this.parties.get(partyId);
    if (!p) return;
    p.invited.delete(u.id);
    this._party(u.id);
    this._party(p.leader);
  }

  _kick(u, id) {
    const p = this._partyOfUser(u.id);
    if (!p || p.leader !== u.id || id === u.id) return;
    if (p.members.includes(id)) this._leaveParty(id);
    else if (p.invited.delete(id)) {
      this._party(id);
      this._party(u.id);
    }
  }

  _leaveParty(id) {
    const p = this._partyOfUser(id);
    if (!p) return;
    p.members = p.members.filter((m) => m !== id);
    this.partyOf.delete(id);
    if (p.leader === id) p.leader = p.members[0];
    // A party of one is no party.
    if (p.members.length < 2 && !p.invited.size) {
      for (const m of p.members) this.partyOf.delete(m);
      this.parties.delete(p.id);
      for (const m of [...p.members, ...p.invited]) this._party(m);
      p.members = [];
    }
    if (!p.members.length) {
      this.parties.delete(p.id);
      for (const m of p.invited) this._party(m);
    }
    for (const m of p.members) this._party(m);
    this._party(id);
  }

  // His party and the invites waiting for him, sent to him.
  _party(id) {
    const p = this._partyOfUser(id);
    const party = p && {
      id: p.id,
      leader: p.leader,
      members: p.members.map((m) => ({ id: m, name: this.users.get(m)?.name || '', army: this.users.get(m)?.army || null, where: this.where(m) })),
      invited: [...p.invited].map((m) => ({ id: m, name: this.users.get(m)?.name || '' })),
    };
    const invites = [];
    for (const q of this.parties.values()) if (q.invited.has(id)) invites.push({ party: q.id, from: q.leader, name: this.users.get(q.leader)?.name || '' });
    this.send(id, { k: 'p', party: party || null, invites });
  }

  _partyChat(u, text) {
    const p = this._partyOfUser(u.id);
    const t = cleanChat(text);
    if (!p || !t || !chatAllowed(u.chat)) return;
    for (const m of p.members) this.send(m, { k: 'pc', from: u.id, name: u.name, text: t });
  }

  // The leader is going into a battle: the others are called after him.
  _go(u) {
    const p = this._partyOfUser(u.id);
    if (!p || p.leader !== u.id) return;
    for (const m of p.members) if (m !== u.id && this.where(m) === 'menus') this.send(m, { k: 'go', by: u.id });
  }

  // The battle a player's party is in, for one of his army: so he joins it
  // (server/main.mjs roomFor). Null if none of them is in one.
  partyRoom(id) {
    const p = this._partyOfUser(id);
    if (!p) return null;
    for (const m of p.members) if (m !== id && this.users.get(m)?.battle && !this.users.get(m).battle.closed) return this.users.get(m).battle;
    return null;
  }
}
