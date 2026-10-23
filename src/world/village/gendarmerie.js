// The Gendarmerie (objective O1): a two-storey rendered municipal building with
// dressed-stone quoins and window surrounds, a slate hipped roof, "GENDARMERIE
// NATIONALE" carved on a band over the door, a central hall with a stair to the upper
// floor, offices and a barred cell. Beside it a walled courtyard with a carriage gate
// and a stable/garage.
//
// Local frame: origin at the building center on the ground floor; +z faces the street.
import { RNG } from '../../core/math.js';
import { FLAG_SOLID, FLAG_DEFAULT } from '../../physics/collision.js';
import { wallRects } from './geom.js';
import { PLASTER_COLORS, LIMEWASH, PAINTS, WOOD, rgb, mix } from './materials.js';
import { windowUnit, doorUnit, hipRoof, gableRoof, gableWall, chimney, straightStair } from './parts.js';
import { table } from './house.js';

const ASH = rgb(0.97, 0.95, 0.9);

export function buildGendarmerie(B, g, ctx) {
  const r = new RNG(g.seed);
  const f = B.frame(g.x, g.floorY, g.z, g.yaw, { tag: 'gendarmerie' });
  const W = g.w,
    D = g.d;
  const t = 0.55;
  const groundY = g.ground - g.floorY;
  const base = groundY - 0.8;
  const F1 = 3.5;
  const ceil = F1 + 2.9;
  const eaves = ceil + 0.5;
  const wallColor = mix(PLASTER_COLORS.sand, PLASTER_COLORS.grey, 0.4);
  const inner = mix(LIMEWASH, rgb(0.82, 0.84, 0.8), 0.4);
  const side = g.side;
  const spawn = (x, y, z) => {
    const p = f.toWorld(x, y, z);
    B.spawnHints.O1.push({ x: +p[0].toFixed(2), y: +p[1].toFixed(2), z: +p[2].toFixed(2) });
  };
  const opts = { thick: t, base, height: eaves - base, mat: 'plaster', inner: 'plaster', col: 'stone', color: wallColor, innerColor: inner };
  const walls = {
    front: f.wall(-W / 2, D / 2 - t / 2, W / 2, D / 2 - t / 2, opts),
    back: f.wall(W / 2, -D / 2 + t / 2, -W / 2, -D / 2 + t / 2, opts),
    right: f.wall(W / 2 - t / 2, D / 2 - t, W / 2 - t / 2, -D / 2 + t, opts),
    left: f.wall(-W / 2 + t / 2, -D / 2 + t, -W / 2 + t / 2, D / 2 - t, opts),
  };
  const ops = [];
  const add = (wall, u0, u1, y0, y1, type, extra = {}) => ops.push({ wall, u0, u1, y0, y1, type, ...extra });
  // Front: five bays, central double door.
  const bayU = [0, 1, 2, 3, 4].map((k) => 1.4 + ((W - 2.8) * (k + 0.5)) / 5);
  bayU.forEach((u, k) => {
    if (k === 2) add('front', u - 0.8, u + 0.8, 0, 2.9, 'door', { leaves: 2 });
    else add('front', u - 0.55, u + 0.55, 1.0, 2.6, 'window');
    add('front', u - 0.55, u + 0.55, F1 + 0.9, F1 + 2.3, 'window', { up: true });
  });
  // Back: door to the yard in the middle.
  bayU.forEach((u, k) => {
    if (k === 2) add('back', u - 0.6, u + 0.6, 0, 2.4, 'door', { leaves: 1 });
    else add('back', u - 0.5, u + 0.5, 1.0, 2.5, 'window');
    add('back', u - 0.5, u + 0.5, F1 + 0.9, F1 + 2.3, 'window', { up: true });
  });
  // Sides: the courtyard side has a door.
  for (const key of ['left', 'right']) {
    const court = (key === 'right') === side > 0;
    for (const [k, u] of [3.3, 6.6].entries()) {
      if (court && k === 1) add(key, u - 0.55, u + 0.55, 0, 2.3, 'door', { leaves: 1 });
      else add(key, u - 0.5, u + 0.5, 1.0, 2.5, 'window');
      add(key, u - 0.5, u + 0.5, F1 + 0.9, F1 + 2.3, 'window', { up: true });
    }
  }
  for (const [key, wall] of Object.entries(walls)) {
    for (const o of ops) if (o.wall === key) wall.hole(o.u0, o.u1, o.y0 - base, o.y1 - base);
    wall.build({ groundV: groundY - 0.25 - base });
  }
  // Ashlar plinth, string course, quoins and cornice.
  for (const [key, wall] of Object.entries(walls)) {
    const doors = ops.filter((o) => o.wall === key && o.type === 'door').map((o) => ({ u0: o.u0, u1: o.u1, v0: -1, v1: 9 }));
    for (const rc of wallRects(wall.len, 0.95 - groundY + 0.15, doors)) wall.box('ashlar', rc.u0, groundY - 0.15 - base + rc.v0, t / 2 - 0.02, rc.u1, groundY - 0.15 - base + rc.v1, t / 2 + 0.035, { color: ASH });
    wall.box('ashlar', 0, F1 - 0.1 - base, t / 2 - 0.02, wall.len, F1 + 0.12 - base, t / 2 + 0.05, { color: ASH });
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      let y = 0.95;
      let k = 0;
      while (y < eaves - 0.35) {
        const a = k % 2 ? 0.3 : 0.55,
          b = k % 2 ? 0.55 : 0.3;
        const x0 = sx * (W / 2 + 0.03),
          z0 = sz * (D / 2 + 0.03);
        f.box('ashlar', x0, y, z0 - sz * 0.06, x0 - sx * a, y + 0.34, z0, { color: ASH });
        f.box('ashlar', x0, y, z0, x0 - sx * 0.06, y + 0.34, z0 - sz * b, { color: ASH });
        y += 0.37;
        k++;
      }
    }
  for (const zs of [1, -1]) f.box('ashlar', -W / 2 - 0.1, eaves - 0.3, zs * (D / 2 - 0.02), W / 2 + 0.1, eaves, zs * (D / 2 + 0.16), { color: ASH });
  for (const xs of [1, -1]) f.box('ashlar', xs * (W / 2 - 0.02), eaves - 0.3, -D / 2 - 0.1, xs * (W / 2 + 0.16), eaves, D / 2 + 0.1, { color: ASH });

  // Openings.
  for (const o of ops) {
    const wall = walls[o.wall];
    if (o.type === 'window') {
      const roll = r.next();
      windowUnit(wall, o.u0, o.u1, o.y0, o.y1, {
        rng: r,
        glass: roll < 0.35,
        shutters: roll < 0.5 ? 'open' : roll < 0.65 ? 'half' : roll < 0.8 ? 'closed' : 'broken',
        shutterColor: PAINTS.grey,
        frameColor: rgb(0.9, 0.9, 0.88),
        surround: 'ashlar',
      });
      const fl = o.up ? F1 : 0;
      const p = wall.p((o.u0 + o.u1) / 2, 0, -t / 2 - 0.45);
      f.cover(p[0], fl, p[2], wall.nx, wall.nz, o.up ? 'low' : 'low');
    } else {
      doorUnit(wall, o.u0, o.u1, o.y0, o.y1, { rng: r, leaves: o.leaves, color: PAINTS.navy, state: 'open', surround: 'ashlar', groundY, kind: 'door' });
    }
  }
  // Sign band over the front door.
  {
    const rc = ctx.atlas.gendarmerie;
    const w = walls.front;
    const zf = t / 2 + 0.04;
    const y0 = 3.7,
      y1 = y0 + 0.52;
    const u0 = W / 2 - 2.8,
      u1 = W / 2 + 2.8;
    const a = w.p(u0, y0 - base, zf),
      b = w.p(u1, y0 - base, zf),
      c = w.p(u1, y1 - base, zf),
      d = w.p(u0, y1 - base, zf);
    f.quad('signs', a, b, c, d, rc);
    w.box('ashlar', u0 - 0.08, y0 - 0.08 - base, t / 2, u1 + 0.08, y1 + 0.08 - base, zf - 0.005, { color: ASH });
  }

  // Floors, partitions, stair.
  const xi0 = -W / 2 + t,
    xi1 = W / 2 - t,
    zi0 = -D / 2 + t,
    zi1 = D / 2 - t;
  f.box('floor', xi0, -0.3, zi0, xi1, 0, zi1, { faces: { ny: null }, col: 'stone', nav: false });
  const run = 5.0,
    sx0 = 0.75,
    sx1 = 1.7,
    sz0 = zi1 - 1.55;
  const szTop = sz0 - run;
  const hole = { x0: sx0 - 0.05, x1: sx1, z0: szTop, z1: szTop + 3.4 };
  for (const rc of wallRects(xi1 - xi0, zi1 - zi0, [{ u0: hole.x0 - xi0, u1: hole.x1 - xi0, v0: hole.z0 - zi0, v1: hole.z1 - zi0 }])) {
    f.box('wood', xi0 + rc.u0, F1 - 0.22, zi0 + rc.v0, xi0 + rc.u1, F1, zi0 + rc.v1, { faces: { ny: 'plaster' }, color: WOOD.natural, col: 'wood', nav: false });
  }
  f.box('wood', xi0, ceil, zi0, xi1, ceil + 0.2, zi1, { faces: { ny: 'plaster' }, color: WOOD.weathered, col: 'wood', nav: false });
  straightStair(f, { x: (sx0 + sx1) / 2, z0: sz0, y0: 0, y1: F1, run, dir: -1, width: sx1 - sx0, rail: -1, color: WOOD.dark });
  // Partitions along z at x = +-1.7 (brick, plastered), each floor, with doorways.
  for (const fl of [0, F1]) {
    const top = fl === 0 ? F1 - 0.22 : ceil;
    for (const px of [-1.7, 1.7]) {
      const pw = f.wall(px, zi1, px, zi0, { thick: 0.16, base: fl, height: top - fl, mat: 'plaster', inner: 'plaster', col: 'brick', color: inner, innerColor: inner });
      // Doorways into the front and back rooms (u = zi1 - z); upstairs on the stair
      // side the front doorway sits past the stairwell.
      const dzs = fl > 0 && px > 0 ? [2.7, -3.0] : [1.4, -3.0];
      for (const dz of dzs) {
        pw.hole(zi1 - dz - 0.5, zi1 - dz + 0.5, 0, 2.2);
        f.door(px, dz, 1.0, Math.PI / 2, { kind: 'interior', y: fl });
      }
      pw.build({ flags: FLAG_DEFAULT });
    }
    // Cross wall between front and back rooms on each side.
    for (const sxw of [-1, 1]) {
      const xa = sxw * 1.78,
        xb = sxw * (W / 2 - t);
      const cw = f.wall(Math.min(xa, xb), -0.8, Math.max(xa, xb), -0.8, { thick: 0.14, base: fl, height: top - fl, mat: 'plaster', inner: 'plaster', col: 'plank', color: inner, innerColor: inner });
      const L = cw.len;
      cw.hole(L / 2 - 0.45, L / 2 + 0.45, 0, 2.15);
      cw.build({ flags: FLAG_DEFAULT });
    }
  }
  // Barred cell in the back right room (ground floor), on the side away from the court.
  {
    const cx0 = -side * 1.86,
      cx1 = -side * (W / 2 - t);
    const zc = -2.9;
    const xa = Math.min(cx0, cx1),
      xb = Math.max(cx0, cx1);
    for (let x = xa + 0.1; x < xb - 0.05; x += 0.14) {
      if (Math.abs(x - (xa + xb) / 2) < 0.4) continue; // cell door gap
      f.box('iron', x - 0.012, 0, zc - 0.012, x + 0.012, 2.4, zc + 0.012);
    }
    f.box('iron', xa, 2.35, zc - 0.03, xb, 2.42, zc + 0.03);
    f.box('iron', xa, 1.1, zc - 0.025, xb, 1.15, zc + 0.025);
    f.colliderBox(xa, 0, zc - 0.03, (xa + xb) / 2 - 0.42, 2.4, zc + 0.03, 'steel', FLAG_SOLID, false);
    f.colliderBox((xa + xb) / 2 + 0.42, 0, zc - 0.03, xb, 2.4, zc + 0.03, 'steel', FLAG_SOLID, false);
    // A cot in the cell.
    f.box('wood', xa + 0.3, 0, zi0 + 0.1, xa + 2.2, 0.45, zi0 + 0.9, { color: WOOD.dark, col: 'wood' });
  }
  // Office furniture in the front rooms.
  for (const sxr of [-1, 1]) {
    table(f, r, sxr * 4.6, 2.6);
    f.box('wood', sxr * (W / 2 - t - 0.3) - 0.3, 0, -0.3, sxr * (W / 2 - t - 0.3) + 0.3, 1.9, 0.9, { color: WOOD.dark, col: 'wood' });
    table(f, r, sxr * 4.4, 2.4, F1);
  }
  // Spawn points.
  spawn(0, 0, 2.0);
  spawn(-1, 0, -2.8);
  spawn(-4.5, 0, 0.5);
  spawn(4.5, 0, 0.5);
  spawn(-4.5, F1, -2);
  spawn(4.5, F1, -2);
  spawn(-0.6, F1, -3.5);

  // Roof.
  const roof = hipRoof(f, { x0: -W / 2, x1: W / 2, d: D, eaves, pitch: (40 * Math.PI) / 180, ov: 0.45, mat: 'slate', color: rgb(0.95, 0.97, 1), T: 0.18 });
  for (const cx of [-4.2, 4.2]) chimney(f, cx, 0.2, ceil + 0.2, roof.yTop + 0.7, { mat: 'brick', w: 0.9, d: 0.6 });

  // ---- Courtyard ---------------------------------------------------------------------
  const c = g.court;
  const H = 2.4,
    T = 0.5;
  const sx = side;
  const xa = sx * (W / 2),
    xb = sx * (W / 2 + 14);
  const zf = D / 2 - 0.25,
    zb = c.backZ;
  const wallStyle = { thick: T, base: groundY - 0.5, height: H + 0.5, mat: 'stone', inner: 'stone', col: 'stone', color: rgb(0.95, 0.94, 0.9) };
  const gateU = 7,
    gateW = 3.6;
  const segs = [
    { a: [xa, zf], b: [xb, zf], gate: true },
    { a: [xb, zf], b: [xb, zb] },
    { a: [xb, zb], b: [-xa, zb] },
    { a: [-xa, zb], b: [-xa, -D / 2] },
  ];
  const inYard = (x, z) => (sx * x > W / 2 && sx * x < W / 2 + 14 && z > zb && z < D / 2) || (Math.abs(x) < W / 2 && z > zb && z < -D / 2);
  for (const sg of segs) {
    // Orient each segment so its outward side faces away from the yard.
    const [p0, p1] = [sg.a, sg.b];
    const w0 = f.wall(p0[0], p0[1], p1[0], p1[1], wallStyle);
    const inside = inYard((p0[0] + p1[0]) / 2 + w0.nx * 0.8, (p0[1] + p1[1]) / 2 + w0.nz * 0.8);
    const w = inside ? f.wall(p1[0], p1[1], p0[0], p0[1], wallStyle) : w0;
    let gate = null;
    if (sg.gate) {
      const u = w === w0 ? gateU : w.len - gateU;
      gate = [u - gateW / 2, u + gateW / 2];
      w.hole(gate[0], gate[1], -1, 9);
    }
    w.build({ groundV: 0.3 });
    const cuts = gate ? [[0, gate[0]], [gate[1], w.len]] : [[0, w.len]];
    for (const [a, b] of cuts) {
      w.box('ashlar', a, H + 0.5, -T / 2 - 0.05, b, H + 0.62, T / 2 + 0.05, { color: ASH });
      for (let u = a + 1.0; u < b - 0.6; u += 3.2) {
        const p = w.p(u, 0, -T / 2 - 0.45);
        f.cover(p[0], groundY, p[2], w.nx, w.nz, 'high');
      }
    }
    if (gate) {
      for (const e of [0, 1]) {
        const uu = gate[e];
        const a = e === 0 ? uu - 0.6 : uu,
          b = e === 0 ? uu : uu + 0.6;
        w.box('ashlar', a, 0, -0.38, b, H + 1.1, 0.38, { color: ASH, col: 'stone' });
        w.box('ashlar', a - 0.06, H + 1.1, -0.44, b + 0.06, H + 1.25, 0.44, { color: ASH });
        w.box('ashlar', (a + b) / 2 - 0.18, H + 1.25, -0.18, (a + b) / 2 + 0.18, H + 1.55, 0.18, { color: ASH });
      }
      // Gate leaves: one open into the yard, one closed.
      const lw = gateW / 2 - 0.05;
      const gc = PAINTS.bottle;
      w.obox('paint', gate[0] + lw / 2 + 0.02, 1.1 - w.base + groundY, 0, lw / 2, 1.1, 0.04, { color: gc, uv: 'box', col: 'wood' });
      const ang = 1.35;
      const hu = gate[1] - 0.02;
      w.obox('paint', hu - (lw / 2) * Math.cos(ang), 1.1 - w.base + groundY, -(lw / 2) * Math.sin(ang), lw / 2, 1.1, 0.04, { color: gc, uv: 'box', rot: { yaw: ang } });
      const cp = w.p((gate[0] + gate[1]) / 2, 0, 0);
      f.door(cp[0], cp[2], gateW / 2, w.yaw, { kind: 'gate' });
    }
  }
  // Stable / garage at the back of the yard.
  {
    const gw = 9.5,
      gd = 5.6;
    const cx = sx * (W / 2 + 14 - T / 2 - gw / 2 - 0.05),
      cz = zb + T / 2 + gd / 2 + 0.05;
    const s = f.sub(cx, 0, cz, 0);
    const st = 0.45;
    const eav = 3.1;
    const so = { thick: st, base: groundY - 0.5, height: eav - groundY + 0.5, mat: 'stone', inner: 'stone', col: 'stone', color: rgb(0.92, 0.9, 0.86) };
    const sw = {
      front: s.wall(-gw / 2, gd / 2 - st / 2, gw / 2, gd / 2 - st / 2, so),
      back: s.wall(gw / 2, -gd / 2 + st / 2, -gw / 2, -gd / 2 + st / 2, so),
      right: s.wall(gw / 2 - st / 2, gd / 2 - st, gw / 2 - st / 2, -gd / 2 + st, so),
      left: s.wall(-gw / 2 + st / 2, -gd / 2 + st, -gw / 2 + st / 2, gd / 2 - st, so),
    };
    const g0 = s;
    for (const u of [2.4, 7.1]) sw.front.hole(u - 1.3, u + 1.3, groundY - so.base, 2.6 - so.base);
    sw.left.hole(1.8, 2.6, 1.2 - so.base, 2.0 - so.base);
    for (const w of Object.values(sw)) w.build({ groundV: 0.3 });
    // Big plank doors, open.
    for (const u of [2.4, 7.1]) {
      sw.front.obox('wood', u - 1.3 - 0.06, 1.35 - so.base, st / 2 + 0.65, 0.04, 1.3, 0.62, { color: WOOD.weathered, uv: 'box' });
      sw.front.obox('wood', u + 1.3 + 0.06, 1.35 - so.base, st / 2 + 0.6, 0.04, 1.3, 0.62, { color: WOOD.weathered, uv: 'box', rot: { yaw: 0.15 } });
      sw.front.box('wood', u - 1.4, 2.6 - so.base, st / 2 - 0.2, u + 1.4, 2.82 - so.base, st / 2 + 0.01, { color: WOOD.dark });
    }
    g0.box('concrete', -gw / 2 + st, groundY - 0.2, -gd / 2 + st, gw / 2 - st, groundY + 0.02, gd / 2 - st, { col: 'stone', nav: false });
    const rf = gableRoof(g0, { x0: -gw / 2, x1: gw / 2, d: gd, eaves: eav, pitch: (32 * Math.PI) / 180, ov: 0.35, gvL: 0.25, gvR: 0.25, mat: 'tiles', color: rgb(0.92, 0.85, 0.8), T: 0.14 });
    for (const sxg of [-1, 1]) gableWall(g0, sxg * (gw / 2), sxg * (gw / 2 - st), gd, eav, rf.yR, { mat: 'stone', color: rgb(0.92, 0.9, 0.86), inner: 'stone' });
  }
  // Pump and trough in the yard.
  {
    const px = sx * (W / 2 + 3.2),
      pz = zb + 2.2;
    f.box('ashlar', px - 0.9, groundY, pz - 0.35, px + 0.9, groundY + 0.55, pz + 0.35, { color: ASH, col: 'stone' });
    f.box('water', px - 0.8, groundY + 0.45, pz - 0.25, px + 0.8, groundY + 0.5, pz + 0.25);
    f.box('iron', px - 0.1, groundY + 0.55, pz - 0.5, px + 0.1, groundY + 1.6, pz - 0.3);
    f.beam('iron', px, groundY + 1.45, pz - 0.4, px + 0.5, groundY + 1.25, pz - 0.4, 0.04, 0.04);
  }
  spawn(sx * (W / 2 + 6), groundY, -2);
  spawn(sx * (W / 2 + 9), groundY, -8);
  spawn(0, groundY, -D / 2 - 3);
  return f;
}
