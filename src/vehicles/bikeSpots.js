// Where bicycles and motorcycles wait on a map: in rows where soldiers come in,
// beside the village doors, and with each army's motorcycles at its spawn
// points. Wrecked machines are replaced, and ones left lying about far from
// their place are brought back (as the jeeps are), out of everyone's sight.
import { FLAG_SOLID, FLAG_WALKABLE, RayHit } from '../physics/collision.js';
import { ARMY_BIKES } from './bikeDefs.js';
import { VEHICLES } from './defs.js';

const WRECK_RESPAWN = 45; // s after it was wrecked
const ABANDON_TIME = 90; // s left alone away from its place (or lying on its side)
const ABANDON_DIST = 30; // m from its place
const UNSEEN = 40; // m: nobody this close to it (or to its place) when it is put back
const _boxes = [];
const _hit = new RayHit();

export class BikeStands {
  constructor(game) {
    this.game = game;
    this.spots = [];
  }

  // Is there room for a machine of this size here: firm, fairly level open
  // ground, no wall, fence or vehicle in the way, and no roof overhead?
  _fits(id, x, z, yaw) {
    const g = this.game;
    const w = g.world;
    const hf = w.hf;
    const d = VEHICLES[id];
    const [W, , L] = d.dims;
    const fx = -Math.sin(yaw),
      fz = -Math.cos(yaw);
    const rx = Math.cos(yaw),
      rz = -Math.sin(yaw);
    // Sidecar outfits sit off to the right of the machine's own line.
    const off = d.sidecar ? d.sidecar.track / 2 : 0;
    const cx = x + rx * off,
      cz = z + rz * off;
    const nav = g.vnav || g.nav;
    if (nav && !(nav.inMainArea ? nav.inMainArea(cx, cz) : nav.walkable(cx, cz))) return false;
    if (w.waterLevelAt?.(cx, cz) != null) return false;
    const y = hf.getHeight(cx, cz);
    if (Math.abs(hf.getHeight(x + fx * L * 0.5, z + fz * L * 0.5) - hf.getHeight(x - fx * L * 0.5, z - fz * L * 0.5)) > L * 0.12) return false;
    const coll = w.collision;
    const r = Math.max(0.25, (d.sidecar ? W - off : W) / 2);
    for (const k of [-0.45, -0.15, 0.15, 0.45]) {
      const px = cx + fx * L * k,
        pz = cz + fz * L * k;
      if (coll.query(px - r, y + 0.15, pz - r, px + r, y + 1.5, pz + r, _boxes, FLAG_SOLID).length) return false;
    }
    if (coll.raycast(cx, y + 1.2, cz, 0, 1, 0, 12, _hit, FLAG_SOLID | FLAG_WALKABLE, false)) return false;
    // Not on top of another parked machine.
    for (const s of this.spots) if ((s.x - x) ** 2 + (s.z - z) ** 2 < (Math.max(L, 1.6) * 0.75) ** 2) return false;
    // A motorcycle has room to ride off: nothing solid (a tree, a wall, a
    // parked jeep or another machine) in its first 6 m. Parked nose to a tree
    // or to the next machine, it went nowhere when the rider pressed W (6 of
    // the 14 on the town map had something within 6 m ahead).
    const lane = halfWidth(d);
    if (!d.pedal) {
      for (let k = L / 2 + 0.5; k <= L / 2 + 6; k += 1) {
        const px = cx + fx * k,
          pz = cz + fz * k;
        const py = hf.getHeight(px, pz);
        if (coll.query(px - lane, py + 0.2, pz - lane, px + lane, py + 1.2, pz + lane, _boxes, FLAG_SOLID).length) return false;
        for (const s of this.spots) if ((s.cx - px) ** 2 + (s.cz - pz) ** 2 < (lane + halfWidth(VEHICLES[s.id])) ** 2) return false;
      }
    }
    // Nor in the way of a motorcycle already parked.
    for (const s of this.spots) {
      const sd = VEHICLES[s.id];
      if (sd.pedal) continue;
      const sfx = -Math.sin(s.yaw),
        sfz = -Math.cos(s.yaw);
      const along = (cx - s.cx) * sfx + (cz - s.cz) * sfz,
        across = Math.abs((cx - s.cx) * -sfz + (cz - s.cz) * sfx);
      if (along > 0 && along < sd.dims[2] / 2 + 6 + lane && across < lane + halfWidth(sd) + 0.3) return false;
    }
    return true;
  }

  // Park one at the first spot that fits, searching outward from (x, z) between
  // r0 and r1 m. Returns the machine or null.
  park(id, x, z, yaw, { team = null, r0 = 0, r1 = 20 } = {}) {
    for (let r = r0; r <= r1; r += 2.5) {
      const n = r < 1 ? 1 : Math.max(6, Math.round(r * 1.2));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r * 0.73;
        const px = x + Math.cos(a) * r,
          pz = z + Math.sin(a) * r;
        if (this._fits(id, px, pz, yaw)) return this._spawn(id, px, pz, yaw, team);
      }
    }
    return null;
  }

  // A row side by side (as outside a billet or a café), searching for room as park().
  row(id, n, x, z, yaw, { team = null, r0 = 0, r1 = 20, gap = 0.95 } = {}) {
    const rx = Math.cos(yaw),
      rz = -Math.sin(yaw);
    for (let r = r0; r <= r1; r += 2.5) {
      const m = r < 1 ? 1 : Math.max(6, Math.round(r * 1.2));
      for (let k = 0; k < m; k++) {
        const a = (k / m) * Math.PI * 2 + r * 0.73;
        const px = x + Math.cos(a) * r,
          pz = z + Math.sin(a) * r;
        const at = (i) => [px + rx * gap * (i - (n - 1) / 2), pz + rz * gap * (i - (n - 1) / 2)];
        // (The row's members are checked before any is placed, so they may
        // stand closer together than park() allows.)
        let ok = true;
        for (let i = 0; i < n && ok; i++) ok = this._fits(id, ...at(i), yaw);
        if (!ok) continue;
        const out = [];
        for (let i = 0; i < n; i++) out.push(this._spawn(id, ...at(i), yaw, team));
        return out;
      }
    }
    return [];
  }

  _spawn(id, x, z, yaw, team) {
    const g = this.game;
    const v = g.spawnVehicle(id, x, z, yaw);
    v.team = team;
    // (The middle of the machine: an outfit's is off to the side of its chair.)
    const off = VEHICLES[id].sidecar ? VEHICLES[id].sidecar.track / 2 : 0;
    this.spots.push({ id, x, z, cx: x + Math.cos(yaw) * off, cz: z - Math.sin(yaw) * off, yaw, team, v, deadT: 0, idleT: 0 });
    return v;
  }

  // Beside a doorway, along the wall (doors: the village's list, the outward
  // normal is (sin yaw, cos yaw)).
  byDoor(door, id = 'bicycle') {
    const nx = Math.sin(door.yaw),
      nz = Math.cos(door.yaw);
    const tx = Math.cos(door.yaw),
      tz = -Math.sin(door.yaw);
    const yaw = Math.atan2(-tx, -tz);
    for (const side of [1, -1]) {
      const along = side * ((door.width || 1) / 2 + 1.05);
      const x = door.x + nx * 0.62 + tx * along,
        z = door.z + nz * 0.62 + tz * along;
      if (this._fitsAtWall(id, x, z, yaw)) return this._spawn(id, x, z, yaw, null);
    }
    return null;
  }

  // Against a wall: only the machine's own narrow footprint must be clear.
  _fitsAtWall(id, x, z, yaw) {
    const w = this.game.world;
    const d = VEHICLES[id];
    const L = d.dims[2];
    const fx = -Math.sin(yaw),
      fz = -Math.cos(yaw);
    if (w.waterLevelAt?.(x, z) != null) return false;
    const y = w.hf.getHeight(x, z);
    for (const k of [-0.45, 0, 0.45]) {
      const px = x + fx * L * k,
        pz = z + fz * L * k;
      if (w.collision.query(px - 0.2, y + 0.15, pz - 0.2, px + 0.2, y + 1.3, pz + 0.2, _boxes, FLAG_SOLID).length) return false;
      if (Math.abs(w.hf.getHeight(px, pz) - y) > 0.25) return false;
    }
    if (w.collision.raycast(x, y + 1.2, z, 0, 1, 0, 2.5, _hit, FLAG_SOLID | FLAG_WALKABLE, false)) return false;
    for (const s of this.spots) if ((s.x - x) ** 2 + (s.z - z) ** 2 < 1.4 ** 2) return false;
    return true;
  }

  // Wrecks are replaced after a while, and machines left lying about or far from
  // their place are brought back, when nobody is near to see it happen.
  update(dt) {
    const g = this.game;
    for (const s of this.spots) {
      const v = s.v;
      const p = v.body.position;
      const busy = v.occupants.some(Boolean) || (v.claimedBy?.alive && v.claimT > g.time);
      if (!v.alive) s.deadT += dt;
      else if (!busy && (v.fallen || (p.x - s.x) ** 2 + (p.z - s.z) ** 2 > ABANDON_DIST ** 2)) s.idleT += dt;
      else s.idleT = 0;
      const due = (!v.alive && s.deadT > WRECK_RESPAWN && !v.occupants.some(Boolean)) || (v.alive && s.idleT > ABANDON_TIME);
      if (!due || this._watched(p) || this._watched(s)) continue;
      v.removeFromWorld();
      const i = g.vehicles.indexOf(v);
      if (i >= 0) g.vehicles.splice(i, 1);
      s.v = g.spawnVehicle(s.id, s.x, s.z, s.yaw);
      s.v.team = s.team;
      s.deadT = s.idleT = 0;
    }
  }

  _watched(p) {
    for (const o of this.game.soldiers) {
      if (!o.alive) continue;
      const b = o.body;
      if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 < UNSEEN * UNSEEN) return true;
    }
    return false;
  }
}

// Assault: each side's motorcycles (solo and with sidecar) and a pair of
// bicycles where it comes in (attackers at the access points, defenders at the
// objectives), a bicycle at every other point, and bicycles by doors around
// the village.
export function placeAssaultBikes(mode, stands) {
  const g = mode.game;
  for (const p of mode.points) {
    const team = p.owner;
    const yaw = mode._facing(p);
    const army = ARMY_BIKES[mode.factions[team]];
    const home = (p.kind === 'access' && team === 1) || (p.kind === 'objective' && team === 0);
    if (home) {
      // Defenders come in at the objectives' spawn spots, in the village.
      const hint = g.world.village?.spawnHints?.[p.id]?.[0];
      const x = hint ? hint.x : p.x,
        z = hint ? hint.z : p.z;
      stands.row('bicycle', 2, x, z, yaw, { r0: 5, r1: 30 });
      if (army) {
        stands.park(army.solo, x, z, yaw, { team, r0: 6, r1: 34 });
        stands.park(army.sidecar, x, z, yaw, { team, r0: 7, r1: 36 });
      }
    } else stands.park('bicycle', p.x, p.z, yaw, { r0: 4, r1: 22 });
  }
  // Around the village: shops first (the café and the bakery on the square),
  // then house doors, spread out.
  const doors = (g.world.village?.doors || []).filter((d) => d.kind === 'shop' || d.kind === 'door');
  doors.sort((a, b) => (a.kind === 'shop' ? 0 : 1) - (b.kind === 'shop' ? 0 : 1) || hash(a) - hash(b));
  const used = [];
  for (const d of doors) {
    if (used.length >= 10) break;
    if (used.some((u) => (u.x - d.x) ** 2 + (u.z - d.z) ** 2 < 28 * 28)) continue;
    if (stands.byDoor(d)) used.push(d);
  }
}

// Half the width of a machine, about its middle (an outfit from the far side
// of the motorcycle to the far side of its chair).
function halfWidth(d) {
  return d.sidecar ? (d.sidecar.track + 0.9) / 2 : d.dims[0] / 2;
}

// A stable pseudo-random order for doors (the same village every time).
function hash(d) {
  const h = Math.sin(d.x * 12.9898 + d.z * 78.233) * 43758.5453;
  return h - Math.floor(h);
}
