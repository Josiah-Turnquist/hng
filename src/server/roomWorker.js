// One battle in its own thread (a worker), so each battle gets a processor
// core to itself: the game server runs every battle this way
// (src/server/roomProxy.js starts it and speaks for it). The battle is the
// usual BattleRoom (room.js); here its players are numbers, and what it
// sends them, the rewards it works out and how it is doing go to the main
// thread as messages.
//
//   from the main thread: { t: 'join' | 'rejoin' | 'finish', call, ... } (answered),
//                         { t: 'input' | 'chat' | 'leaving' | 'leave' | 'gone' | 'release' | 'close' | 'saved', ... }
//   to the main thread:   { t: 'ready' | 'send' | 'state' | 'reward' | 'minute' | 'error' | 'over' | 'closed' | 'answer', ... }
import { parentPort, workerData } from 'node:worker_threads';
import { BattleRoom } from './room.js';
import { ATT, DEF } from './battle.js';

const post = (m) => parentPort.postMessage(m);
const room = new BattleRoom({ ...workerData.opts, send: (cid, text) => post({ t: 'send', cid, text }) });

// Who is in it, for the main thread's choices (which battle a player joins).
let last = '';
function state() {
  const s = { t: 'state', att: room.playersOn(ATT), def: room.playersOn(DEF), players: room.players.size, over: room.isOver, held: [...room.held].map(([u, h]) => [u, [h.p.pc.soldier.id, h.p.soldierId ?? null]]) };
  const text = JSON.stringify(s);
  if (text !== last) post(s);
  last = text;
}

// A reward is kept by the main thread (the database is there): the battle
// waits for it when the server stops (room.finish).
const saving = new Map();
let rewards = 0;
room.onReward = (x) => {
  const id = ++rewards;
  post({ t: 'reward', id, cid: x.client, userId: x.userId, name: x.name, soldierId: x.soldierId, reward: x.reward, info: x.info });
  return new Promise((ok) => saving.set(id, ok));
};
room.onMinute = (x) => post({ t: 'minute', x });
room.onError = (e) => post({ t: 'error', message: String(e?.message || e), place: String(e?.stack || '').split('\n')[1]?.trim() || '' });
room.onOver = (team) => post({ t: 'over', team });
room.onClose = () => {
  state();
  post({ t: 'closed' });
};

const answer = (call, ok, value) => post({ t: 'answer', call, ok, value });
parentPort.on('message', async (m) => {
  try {
    switch (m.t) {
      case 'join':
        try {
          const id = room.join(m.cid, m.info);
          state();
          answer(m.call, true, id);
        } catch (e) {
          answer(m.call, false, e.message);
        }
        return;
      case 'rejoin': {
        const id = room.rejoin(m.cid, m.userId);
        state();
        return answer(m.call, true, id);
      }
      case 'finish':
        await room.finish();
        return answer(m.call, true, null);
      case 'input':
        return room.input(m.cid, m.msg);
      case 'chat':
        return room.chat(m.cid, m.text, m.all);
      case 'leaving':
        return room.leaving(m.cid);
      case 'leave':
        room.leave(m.cid);
        return state();
      case 'gone':
        room.gone(m.cid);
        return state();
      case 'release':
        room.release(m.userId);
        return state();
      case 'saved':
        saving.get(m.id)?.();
        return saving.delete(m.id);
      case 'close':
        return room.close();
    }
  } catch (e) {
    room.onError(e);
  }
});

await room.ready;
setInterval(state, 1000).unref();
state();
post({ t: 'ready' });
