// A vehicle driven on a server's world, and a browser's OnlineBattle fed its
// snapshots 20 times a second (as JSON, as they go over the wire), its own copy
// of the vehicle made by spawnVehicle and moved by nothing else. Each step goes
// as in game.js: the snapshots first, then the puppets follow (followPose).
import { makeWorld, spawn, rider } from './vehicleWorld.js';
import { snapshot } from '../../src/net/protocol.js';
import { OnlineBattle } from '../../src/net/online.js';

export const DT = 1 / 120;

// (oldServer: snapshots without the vehicles' state, speed, engine and the rest,
// as before protocol 3: the browser works the engine out from the motion alone.)
export function onlineRide(id, yaw = 2, { x = 0, z = 300, oldServer = false } = {}) {
  const server = makeWorld();
  const v = spawn(server.game, id, x, z, yaw, { empty: true });
  v.id = 5;
  const man = Object.assign(rider(), { id: 9, yaw, pitch: 0, current: 0, health: 100 });
  server.game.soldiers.push(man);
  v.enter(man, 0);
  const client = makeWorld().game;
  client.headless = true;
  client.player = { soldier: { id: 1 } };
  client.projectiles = { fire() {} };
  client.spawnVehicle = (def, px, pz, y) => spawn(client, def, px, pz, y, { empty: true });
  const net = new OnlineBattle(client, { ws: { readyState: 1, send() {} }, welcome: { you: 1 } });
  // The driver as the browser has him: a puppet the snapshots seat in the vehicle.
  net.puppets.set(9, { id: 9, body: {}, weapons: [], alive: true, puppet: true });
  let tick = 0;
  const sim = {
    v,
    net,
    client,
    get puppet() {
      return net.vehicles.get(5);
    },
    run(seconds, input, each = null) {
      for (let t = 0; t < seconds; t += DT) {
        input(t);
        v.step(DT);
        server.game.time += DT;
        if (++tick % 6 === 0) {
          const m = JSON.parse(JSON.stringify(snapshot(server.game, tick)));
          if (oldServer) m.v = m.v.map((row) => row.slice(0, 13));
          net._message(m);
        }
        net.update(DT);
        for (const c of client.vehicles) c.puppet ? c.followPose(DT) : c.step(DT);
        if (each && sim.puppet) each(sim.puppet, t);
      }
    },
  };
  return sim;
}
