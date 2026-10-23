// French village houses: 1-2 storeys, rubble stone or rendered (crepi) walls,
// painted shutters, steep tile or slate gable roofs with chimneys, real door and
// window openings, enterable ground floors, stairs to the upper floor, shop fronts
// for the cafe/bakery/grocer, and war damage (holed roofs, breached walls,
// collapsed corners, burned-out shells with rubble piles).
import { RNG } from '../../core/math.js';
import { FLAG_BULLET, FLAG_SOLID, FLAG_DEFAULT } from '../../physics/collision.js';
import { wallRects } from './geom.js';
import { PLASTER_COLORS, LIMEWASH, PAINTS, WOOD, rgb, scale, mix } from './materials.js';
import { windowUnit, doorUnit, gableRoof, gableWall, chimney, straightStair, rubblePile, scatter } from './parts.js';

const SHOP_SIGNS = { cafe: 'cafe', bakery: 'boulangerie', epicerie: 'epicerie', boucherie: 'boucherie', quincaillerie: 'quincaillerie' };

// Evenly spaced bay centers along a wall of length L.
function bays(L, n, margin) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(margin + ((L - 2 * margin) * (k + 0.5)) / n);
  return out;
}

export function buildHouse(B, h, ctx) {
  const r = new RNG(h.seed);
  const f = B.frame(h.x, h.floorY, h.z, h.yaw, { tag: h.shop ? `shop:${h.shop}` : 'house' });
  const W = h.w,
    D = h.d;
  const stone = h.wall === 'stone';
  const t = stone ? 0.55 : 0.48;
  const groundY = (h.ground ?? h.floorY - 0.2) - h.floorY;
  const base = groundY - 0.7;
  const floors = [0];
  if (h.storeys >= 2) floors.push(3.05);
  const top = floors[floors.length - 1];
  const ceilY = top + 2.65;
  const atticY = ceilY + 0.2;
  const eaves = atticY + 0.3;
  const dmg = h.damage;
  const dr = new RNG(dmg ? dmg.seed : 1);
  const burned = dmg?.kind === 'burned';

  // Colors.
  const tintStone = rgb(1, 0.98 + r.range(-0.04, 0.03), 0.95 + r.range(-0.05, 0.04));
  let wallColor = stone ? tintStone : PLASTER_COLORS[h.wallColor] || PLASTER_COLORS.cream;
  let inner = mix(LIMEWASH, rgb(0.85, 0.8, 0.7), r.range(0, 0.35));
  if (burned) {
    wallColor = scale(wallColor, 0.62);
    inner = scale(inner, 0.35);
  }
  const wallMat = stone ? 'stone' : 'plaster';
  const roofMat = h.roof === 'slate' ? 'slate' : 'tiles';
  const roofColor = roofMat === 'tiles' ? mix(rgb(1, 1, 1), rgb(0.8, 0.72, 0.65), r.range(0, 0.5)) : rgb(0.95 + r.range(-0.08, 0.05), 0.97, 1);
  const shutterColor = PAINTS[h.shutter] || PAINTS.green;
  const doorColor = PAINTS[h.door] || PAINTS.brown;
  const colMat = stone ? 'stone' : 'plaster';
  const wallOpts = { thick: t, base, height: eaves - base, mat: wallMat, inner: 'plaster', col: colMat, color: wallColor, innerColor: inner };

  const walls = {
    front: f.wall(-W / 2, D / 2 - t / 2, W / 2, D / 2 - t / 2, wallOpts),
    back: f.wall(W / 2, -D / 2 + t / 2, -W / 2, -D / 2 + t / 2, wallOpts),
    right: f.wall(W / 2 - t / 2, D / 2 - t, W / 2 - t / 2, -D / 2 + t, wallOpts),
    left: f.wall(-W / 2 + t / 2, -D / 2 + t, -W / 2 + t / 2, D / 2 - t, wallOpts),
  };
  // Frame x/z of a wall's u coordinate.
  const uToX = { front: (u) => u - W / 2, back: (u) => W / 2 - u };
  const xToU = { front: (x) => x + W / 2, back: (x) => W / 2 - x };
  const zToU = { right: (z) => D / 2 - t - z, left: (z) => z + D / 2 - t };

  // ---- Openings ------------------------------------------------------------------
  const openings = []; // { wall, u0, u1, y0, y1, type }
  const add = (wall, u0, u1, y0, y1, type, extra = {}) => {
    const o = { wall, u0, u1, y0, y1, type, ...extra };
    openings.push(o);
    return o;
  };
  const nFront = W < 7.6 ? 2 : W < 10.6 ? 3 : 4;
  const frontBays = bays(W, nFront, 1.05);
  let doorBay = h.shop ? -1 : r.int(0, nFront - 1);
  if (nFront >= 3 && !h.shop && r.chance(0.5)) doorBay = Math.floor(nFront / 2);
  const winW = r.range(0.9, 1.1);
  const upSill = (fl) => fl + 0.88;
  const upHead = (fl) => fl + 2.15;
  let doorX = 0;
  if (h.shop) {
    // Shop front over most of the ground floor facade.
    const s0 = 0.75,
      s1 = W - 0.75;
    add('front', s0, s1, 0, 2.62, 'shop');
    doorX = uToX.front((s0 + s1) / 2);
  } else {
    frontBays.forEach((u, k) => {
      if (k === doorBay) {
        const dw = r.range(1.0, 1.15);
        add('front', u - dw / 2, u + dw / 2, 0, 2.25, 'door');
        doorX = uToX.front(u);
      } else add('front', u - winW / 2, u + winW / 2, 0.95, 2.25, 'window');
    });
  }
  if (floors.length > 1) frontBays.forEach((u) => add('front', u - winW / 2, u + winW / 2, upSill(top), upHead(top), 'window', { floor: 1 }));
  // Back facade: fewer openings, often a back door.
  const nBack = Math.max(1, nFront - 1);
  const backBays = bays(W, nBack, 1.2);
  const backDoor = r.chance(0.65) ? r.int(0, nBack - 1) : -1;
  backBays.forEach((u, k) => {
    if (k === backDoor) add('back', u - 0.5, u + 0.5, 0, 2.15, 'door', { back: true });
    else if (r.chance(0.75)) add('back', u - 0.45, u + 0.45, 1.0, 2.15, 'window', { small: true });
    if (floors.length > 1 && r.chance(0.8)) add('back', u - 0.45, u + 0.45, upSill(top), upHead(top) - 0.1, 'window', { floor: 1, small: true });
  });
  // Stair against the side wall away from the front door.
  const stairSide = doorX > 0.01 ? -1 : doorX < -0.01 ? 1 : r.chance(0.5) ? 1 : -1;
  const hasStair = floors.length > 1;
  const run = 4.4;
  const stairX = stairSide * (W / 2 - t - 0.52);
  const stairZ0 = D / 2 - t - 0.25;
  const stairZTop = stairZ0 - run;
  // Side walls: windows unless attached; never on the stair wall's ground floor.
  for (const side of ['left', 'right']) {
    const attached = side === 'left' ? h.attachedL : h.attachedR;
    if (attached) continue;
    const L = walls[side].len;
    const isStair = hasStair && (side === 'right' ? stairSide > 0 : stairSide < 0);
    if (!isStair && r.chance(0.6)) add(side, L / 2 - 0.45, L / 2 + 0.45, 1.0, 2.15, 'window', { small: true });
    if (floors.length > 1 && r.chance(0.55)) add(side, L / 2 - 0.45, L / 2 + 0.45, upSill(top), upHead(top) - 0.1, 'window', { floor: 1, small: true });
  }

  // ---- Damage --------------------------------------------------------------------
  const roofHoles = { front: [], back: [] };
  const atticHoles = []; // in frame x/z: {x0,x1,z0,z1}
  const floorHoles = [];
  const piles = []; // {x, y, z, rx, rz, h, beams}
  const capWall = {}; // wall -> extra holes
  let skipGable = null;
  const th = h.pitch;
  const L = (D / 2 + 0.42) / Math.cos(th);
  const xi0 = -W / 2 + t,
    xi1 = W / 2 - t,
    zi0 = -D / 2 + t,
    zi1 = D / 2 - t;
  if (dmg) {
    const kind = dmg.kind;
    if (kind === 'roof') {
      const sideKey = dr.chance(0.5) ? 'front' : 'back';
      const hw = dr.range(1.3, Math.min(2.3, W / 2 - 0.5));
      const cx = dr.range(-W / 2 + hw + 0.5, W / 2 - hw - 0.5);
      const s0 = dr.range(0.3, 1.4),
        s1 = L - dr.range(0.2, 1.2);
      roofHoles[sideKey].push({ x0: cx - hw, x1: cx + hw, s0, s1 });
      if (dr.chance(0.45)) {
        const other = sideKey === 'front' ? 'back' : 'front';
        roofHoles[other].push({ x0: cx - hw * 0.6, x1: cx + hw * 0.7, s0: 0.1, s1: dr.range(1.2, L * 0.7) });
      }
      // Ceiling broken below the hole.
      const zs = sideKey === 'front' ? 1 : -1;
      const za = zs * Math.cos(th) * s0,
        zb = zs * Math.min(D / 2 - t - 0.1, Math.cos(th) * s1);
      atticHoles.push({ x0: cx - hw * 0.8, x1: cx + hw * 0.7, z0: Math.min(za, zb), z1: Math.max(za, zb) });
      piles.push({ x: cx, y: top, z: (za + zb) / 2, rx: hw * 0.8, rz: 1.1, h: 0.45, beams: 2 });
    } else if (kind === 'breach') {
      const cand = ['left', 'right', 'back', 'back', 'front'].filter((k) => !((k === 'left' && h.attachedL) || (k === 'right' && h.attachedR)));
      const wk = dr.pick(cand);
      const wl = walls[wk];
      const bw = dr.range(2.0, Math.min(3.2, wl.len - 1.2));
      // Pick a spot that avoids existing ground-floor openings.
      let best = null;
      for (let k = 0; k < 12; k++) {
        const u0 = dr.range(0.5, wl.len - bw - 0.5);
        const clash = openings.some((o) => o.wall === wk && o.y0 < 2.5 && o.u1 > u0 - 0.3 && o.u0 < u0 + bw + 0.3);
        if (!clash) {
          best = u0;
          break;
        }
      }
      if (best !== null) {
        const u0 = best,
          u1 = best + bw;
        const hb = dr.range(2.3, Math.min(3.4, eaves - 0.6));
        add(wk, u0, u1, 0.05, hb, 'breach');
        capWall[wk] = (capWall[wk] || []).concat([
          { u0: u0 - dr.range(0.2, 0.5), u1: u0 + 0.01, y0: dr.range(0.5, 1.2), y1: hb - dr.range(0.2, 0.6) },
          { u0: u1 - 0.01, u1: u1 + dr.range(0.2, 0.5), y0: dr.range(0.8, 1.5), y1: hb - dr.range(0.3, 0.8) },
          { u0: u0 + dr.range(0.2, 0.6), u1: u1 - dr.range(0.3, 0.7), y0: hb - 0.01, y1: hb + dr.range(0.3, 0.7) },
        ]);
        // Rubble on both sides of the breach.
        const um = (u0 + u1) / 2;
        const wlx = walls[wk];
        const pin = wlx.p(um, 0, -t / 2 - 0.9),
          pout = wlx.p(um, 0, t / 2 + 0.9);
        piles.push({ x: pin[0], y: 0, z: pin[2], rx: bw * 0.5, rz: 0.9, h: 0.55, yaw: wlx.yaw, beams: 0 });
        piles.push({ x: pout[0], y: groundY, z: pout[2], rx: bw * 0.55, rz: 1.0, h: 0.7, yaw: wlx.yaw, beams: 1 });
      }
    } else if (kind === 'corner' || kind === 'burned') {
      const sx = dmg.side;
      const sz = dr.chance(0.6) ? 1 : -1;
      if (kind === 'corner') {
        const ext = dr.range(2.6, Math.min(4.2, W - 2));
        const extZ = dr.range(2.4, D - 2);
        // Walls near the corner lose their upper part in steps.
        const fw = sz > 0 ? 'front' : 'back';
        const swk = sx > 0 ? 'right' : 'left';
        const cornerU = { front: sx > 0 ? W : 0, back: sx > 0 ? 0 : W };
        const cu = cornerU[fw];
        const steps = 3;
        const lowY = dr.range(1.4, 2.4);
        for (let k = 0; k < steps; k++) {
          const frac = (k + 1) / steps;
          const yk = lowY + (eaves - lowY) * (k / steps) + dr.range(-0.2, 0.2);
          const span = ext * (1 - k / steps) + dr.range(-0.2, 0.2);
          const ua = cu > 0 ? cu - span : 0,
            ub = cu > 0 ? cu + 0.1 : span;
          capWall[fw] = (capWall[fw] || []).concat([{ u0: ua, u1: ub, y0: yk, y1: eaves + 1 }]);
          void frac;
        }
        const sideL = walls[swk].len;
        const sideCornerU = (swk === 'right') === (sz > 0) ? 0 : sideL;
        for (let k = 0; k < steps; k++) {
          const yk = lowY + 0.3 + (eaves - lowY) * (k / steps) + dr.range(-0.2, 0.2);
          const span = extZ * (1 - k / steps);
          const ua = sideCornerU > 0 ? sideCornerU - span : -0.1,
            ub = sideCornerU > 0 ? sideCornerU + 0.1 : span;
          capWall[swk] = (capWall[swk] || []).concat([{ u0: ua, u1: ub, y0: yk, y1: eaves + 1 }]);
        }
        skipGable = swk;
        // Roof gone over that end.
        const rx0 = sx > 0 ? W / 2 - ext - 0.8 : -W / 2 - 0.4,
          rx1 = sx > 0 ? W / 2 + 0.4 : -W / 2 + ext + 0.8;
        roofHoles.front.push({ x0: rx0, x1: rx1, s0: -0.1, s1: L + 0.1 });
        roofHoles.back.push({ x0: rx0 + sx * 0.8, x1: rx1 + sx * 0.8, s0: -0.1, s1: L + 0.1 });
        atticHoles.push({ x0: sx > 0 ? W / 2 - ext - 0.6 : xi0 - 0.1, x1: sx > 0 ? xi1 + 0.1 : -W / 2 + ext + 0.6, z0: zi0 - 0.1, z1: zi1 + 0.1 });
        if (floors.length > 1) {
          const fx0 = sx > 0 ? W / 2 - ext * 0.8 : xi0 - 0.1,
            fx1 = sx > 0 ? xi1 + 0.1 : -W / 2 + ext * 0.8;
          floorHoles.push({ x0: fx0, x1: fx1, z0: sz > 0 ? D / 2 - extZ * 0.9 : zi0 - 0.1, z1: sz > 0 ? zi1 + 0.1 : -D / 2 + extZ * 0.9 });
        }
        // Big pile in the corner, inside and spilling outside.
        const px = sx * (W / 2 - ext * 0.45),
          pz = sz * (D / 2 - extZ * 0.4);
        piles.push({ x: px, y: 0, z: pz, rx: ext * 0.5, rz: extZ * 0.45, h: Math.min(1.4, top + 0.6), beams: 3 });
        piles.push({ x: sx * (W / 2 + 0.8), y: groundY, z: pz, rx: 1.2, rz: extZ * 0.5, h: 0.8, beams: 1 });
        piles.push({ x: px, y: groundY, z: sz * (D / 2 + 0.9), rx: ext * 0.5, rz: 1.1, h: 0.75, beams: 0 });
      } else {
        // Burned out: roof mostly gone, ceilings collapsed, rubble and ash inside.
        roofHoles.front.push({ x0: -W / 2 + dr.range(0.6, 1.6), x1: W / 2 - dr.range(0.4, 2.0), s0: -0.1, s1: L + 0.1 });
        roofHoles.back.push({ x0: -W / 2 + dr.range(0.2, 1.4), x1: W / 2 - dr.range(0.8, 2.2), s0: -0.1, s1: L + 0.1 });
        atticHoles.push({ x0: xi0 - 0.1, x1: xi1 + 0.1, z0: zi0 - 0.1, z1: zi1 + 0.1 });
        if (floors.length > 1) floorHoles.push({ x0: sx > 0 ? -0.5 : xi0 - 0.1, x1: sx > 0 ? xi1 + 0.1 : 0.5, z0: zi0 - 0.1, z1: zi1 + 0.1 });
        piles.push({ x: sx * W * 0.22, y: 0, z: dr.range(-1, 1), rx: W * 0.22, rz: D * 0.25, h: 0.9, beams: 4 });
      }
    }
  }

  // ---- Walls -----------------------------------------------------------------------
  for (const [key, wall] of Object.entries(walls)) {
    for (const o of openings) if (o.wall === key) wall.hole(o.u0, o.u1, o.y0 - base, o.y1 - base);
    for (const c of capWall[key] || []) wall.hole(c.u0, c.u1, c.y0 - base, c.y1 - base);
    wall.build({ groundV: groundY - 0.25 - base });
  }

  // Plinth band and quoins on rendered houses.
  if (!stone) {
    const plinthTop = 0.42;
    for (const [key, wall] of Object.entries(walls)) {
      if ((key === 'left' && h.attachedL) || (key === 'right' && h.attachedR)) continue;
      const doorHoles = openings.filter((o) => o.wall === key && o.y0 < plinthTop).map((o) => ({ u0: o.u0, u1: o.u1, v0: -1, v1: 9 }));
      const ext = key === 'front' || key === 'back' ? 0 : 0.0;
      const Lw = wall.len + ext;
      for (const rc of wallRects(Lw, plinthTop - groundY + 0.15, doorHoles)) {
        wall.box('stone', rc.u0, groundY - 0.15 - base + rc.v0, t / 2 - 0.02, rc.u1, groundY - 0.15 - base + rc.v1, t / 2 + 0.022, { color: scale(wallColor, 0.85) });
      }
    }
    if (h.quoins) {
      const cornerList = [];
      if (!h.attachedL) cornerList.push(-1);
      if (!h.attachedR) cornerList.push(1);
      for (const sx of cornerList) {
        for (const sz of [1, -1]) {
          let y = plinthTop + 0.02;
          let k = 0;
          while (y < eaves - 0.3) {
            const hq = 0.3;
            const longX = k % 2 === 0;
            const a = longX ? 0.46 : 0.26,
              b = longX ? 0.26 : 0.46;
            const x0 = sx * (W / 2 + 0.025),
              z0 = sz * (D / 2 + 0.025);
            // Face along x (front/back) and face along z (side).
            f.box('ashlar', x0, y, z0 - sz * 0.05, x0 - sx * a, y + hq, z0, { color: rgb(0.98, 0.96, 0.92) });
            f.box('ashlar', x0, y, z0, x0 - sx * 0.05, y + hq, z0 - sz * b, { color: rgb(0.98, 0.96, 0.92) });
            y += hq + 0.025;
            k++;
          }
        }
      }
    }
  }
  // Wall-top cornice under the eaves (front and back).
  for (const zs of [1, -1]) {
    f.box(stone ? 'ashlar' : 'plaster', -W / 2 - 0.02, eaves - 0.18, zs * (D / 2), W / 2 + 0.02, eaves, zs * (D / 2 + 0.1), { color: stone ? undefined : scale(wallColor, 0.92) });
  }

  // ---- Opening details --------------------------------------------------------------
  const glassChance = burned ? 0 : dmg ? 0.25 : 0.55;
  for (const o of openings) {
    const wall = walls[o.wall];
    const nearDamage = !!dmg && (o.wall === 'front' ? dr.chance(0.5) : dr.chance(0.3));
    if (o.type === 'window') {
      const stateRoll = r.next();
      let sh = stateRoll < 0.55 ? 'open' : stateRoll < 0.72 ? 'closed' : stateRoll < 0.84 ? 'half' : stateRoll < 0.93 ? 'broken' : 'none';
      if (o.floor !== 1 && sh === 'closed' && r.chance(0.6)) sh = 'open'; // keep ground floors mostly open
      if (burned) sh = r.chance(0.7) ? 'none' : 'broken';
      else if (nearDamage && sh === 'closed') sh = 'broken';
      windowUnit(wall, o.u0, o.u1, o.y0, o.y1, {
        rng: r,
        glass: !nearDamage && r.chance(glassChance),
        shutters: o.small && r.chance(0.3) ? 'none' : sh,
        shutterColor: shutterColor,
        frameColor: r.chance(0.5) ? rgb(0.88, 0.87, 0.83) : scale(shutterColor, 1.05),
        surround: !stone && h.quoins ? 'ashlar' : null,
        lintel: stone ? (r.chance(0.6) ? 'wood' : 'ashlar') : null,
        burned,
        broken: burned,
      });
      if (o.floor !== 1 || o.y0 > 0.5) {
        // Cover at the window from inside (crouched behind the sill on the ground floor).
        const p = wall.p((o.u0 + o.u1) / 2, 0, -t / 2 - 0.45);
        const fl = o.floor === 1 ? top : 0;
        f.cover(p[0], fl, p[2], wall.nx, wall.nz, o.y0 - fl > 0.8 ? 'low' : 'high');
      }
    } else if (o.type === 'door') {
      doorUnit(wall, o.u0, o.u1, o.y0, o.y1, {
        rng: r,
        color: doorColor,
        state: burned ? 'missing' : nearDamage ? (r.chance(0.5) ? 'fallen' : 'open') : r.chance(0.8) ? 'open' : 'ajar',
        surround: !stone && h.quoins ? 'ashlar' : null,
        lintel: stone ? 'wood' : null,
        groundY,
        burned,
        kind: o.back ? 'backdoor' : 'door',
      });
    } else if (o.type === 'shop') {
      shopFront(f, wall, o, h, ctx, { r, burned, groundY, base });
    } else if (o.type === 'breach') {
      const c = wall.p((o.u0 + o.u1) / 2, 0, 0);
      f.door(c[0], c[2], +(o.u1 - o.u0).toFixed(2), wall.yaw, { kind: 'breach' });
    }
  }

  // ---- Floors ---------------------------------------------------------------------------
  // Ground floor slab.
  f.box('floor', xi0, -0.3, zi0, xi1, 0, zi1, { faces: { ny: null, px: 'stone', nx: 'stone', pz: 'stone', nz: 'stone' }, color: burned ? rgb(0.45, 0.42, 0.4) : undefined, col: 'stone', nav: false });
  // Upper floor with stairwell and damage holes.
  const slab = (y0, y1, holes, topMat, botMat, colorTop, colorBot, joists) => {
    const iw = xi1 - xi0,
      id = zi1 - zi0;
    const rects = wallRects(
      iw,
      id,
      holes.map((hh) => ({ u0: hh.x0 - xi0, u1: hh.x1 - xi0, v0: hh.z0 - zi0, v1: hh.z1 - zi0 })),
    );
    for (const rc of rects) {
      f.box(topMat, xi0 + rc.u0, y0, zi0 + rc.v0, xi0 + rc.u1, y1, zi0 + rc.v1, { faces: { ny: botMat }, color: colorTop, col: 'wood', nav: false });
    }
    if (joists) {
      for (let x = xi0 + 0.5; x < xi1 - 0.3; x += 1.05) {
        // Skip joists inside holes.
        const inHole = holes.some((hh) => x > hh.x0 && x < hh.x1 && hh.z1 - hh.z0 > id * 0.6);
        if (inHole) continue;
        f.box('wood', x - 0.07, y0 - 0.2, zi0, x + 0.07, y0, zi1, { color: burned ? WOOD.charred : WOOD.dark });
      }
    }
  };
  if (floors.length > 1) {
    const holes = [...floorHoles];
    if (hasStair) holes.push({ x0: stairX - 0.55, x1: stairX + 0.55, z0: stairZTop, z1: stairZTop + 3.05 });
    slab(top - 0.22, top, holes, 'wood', 'wood', burned ? WOOD.charred : WOOD.natural, null, true);
    if (hasStair) straightStair(f, { x: stairX, z0: stairZ0, y0: 0, y1: top, run, dir: -1, width: 0.95, rail: -stairSide, color: burned ? WOOD.charred : WOOD.dark });
  }
  // Ceiling / attic floor.
  slab(ceilY, atticY, atticHoles, 'wood', 'plaster', burned ? WOOD.charred : WOOD.weathered, inner, false);
  // Big ceiling beams in the top storey.
  for (const x of [-W / 6, W / 6]) {
    if (atticHoles.some((hh) => x > hh.x0 && x < hh.x1)) continue;
    f.box('wood', x - 0.11, ceilY - 0.22, zi0, x + 0.11, ceilY, zi1, { color: burned ? WOOD.charred : WOOD.dark });
  }

  // ---- Roof and gables ------------------------------------------------------------------
  const roof = gableRoof(f, {
    x0: -W / 2,
    x1: W / 2,
    d: D,
    eaves,
    pitch: th,
    ov: 0.42,
    gvL: h.attachedL ? 0.0 : 0.32,
    gvR: h.attachedR ? 0.0 : 0.32,
    mat: roofMat,
    color: roofColor,
    holes: roofHoles,
    charred: burned,
    ridgeSegments: ridgeSegments(roofHoles, -W / 2 - (h.attachedL ? 0 : 0.32), W / 2 + (h.attachedR ? 0 : 0.32)),
  });
  for (const sx of [-1, 1]) {
    const key = sx > 0 ? 'right' : 'left';
    if (skipGable === key) continue;
    gableWall(f, sx * (W / 2), sx * (W / 2 - t), D, eaves, roof.yR, { mat: wallMat, color: wallColor, inner: 'plaster', innerColor: inner, colMat: colMat });
  }
  if (h.chimney && !burned) {
    const cxs = (skipGable === 'right' ? -1 : skipGable === 'left' ? 1 : r.chance(0.5) ? 1 : -1) * (W / 2 - t - 0.45);
    const cz = r.chance(0.6) ? 0 : r.range(-0.8, 0.8);
    chimney(f, cxs, cz, atticY, roof.yTop + 0.9, { mat: stone || r.chance(0.5) ? 'stone' : 'brick' });
  }

  // ---- Rubble and debris ---------------------------------------------------------------
  for (const p of piles) {
    rubblePile(f, p.x, p.y, p.z, p.rx, p.rz, p.h, { seed: dr.int(0, 1e6), beams: p.beams, yaw: p.yaw ? p.yaw : 0, plasterColor: wallColor });
  }
  if (dmg) scatter(f, 0, groundY + 0.02, D / 2 + 1.5, W / 2, 8, { seed: dr.int(0, 1e6), plasterColor: wallColor });

  // ---- Furniture ----------------------------------------------------------------------
  if (!burned) furnish(f, r, { W, D, t, xi0, xi1, zi0, zi1, top, floors, hasStair, stairX, stairSide, shop: h.shop, doorX, piles });

  // Corner cover outside (standing behind the corner).
  for (const sx of [-1, 1]) {
    if ((sx < 0 && h.attachedL) || (sx > 0 && h.attachedR)) continue;
    f.cover(sx * (W / 2 + 0.45), groundY, D / 2 - 0.3, -sx, 0, 'high');
  }
  return { frame: f, eaves, top, roof };
}

function ridgeSegments(roofHoles, xa, xb) {
  // Ridge cap only where both slopes have tiles at the top.
  const cut = [];
  for (const side of ['front', 'back']) for (const hh of roofHoles[side]) if (hh.s0 < 0.3) cut.push([hh.x0, hh.x1]);
  let segs = [[xa, xb]];
  for (const [c0, c1] of cut) {
    const next = [];
    for (const [a, b] of segs) {
      if (c1 <= a || c0 >= b) next.push([a, b]);
      else {
        if (c0 > a) next.push([a, c0]);
        if (c1 < b) next.push([c1, b]);
      }
    }
    segs = next;
  }
  return segs.filter(([a, b]) => b - a > 0.3);
}

// Shop front: painted wooden frame, a big window over a low panel, a glazed door and a sign board.
function shopFront(f, wall, o, h, ctx, { r, burned, groundY }) {
  const t = wall.t;
  const u0 = o.u0,
    u1 = o.u1;
  const v0 = o.y0 - wall.base,
    v1 = o.y1 - wall.base;
  const col = burned ? WOOD.charred : h.shop === 'cafe' ? PAINTS.bottle : h.shop === 'bakery' ? PAINTS.oxblood : PAINTS[h.door] || PAINTS.navy;
  const out = t / 2;
  // Pilasters and fascia.
  wall.box('paint', u0 - 0.32, v0 - 0.15, out - 0.02, u0, v1 + 0.62, out + 0.12, { color: col });
  wall.box('paint', u1, v0 - 0.15, out - 0.02, u1 + 0.32, v1 + 0.62, out + 0.12, { color: col });
  wall.box('paint', u0 - 0.36, v1, out - 0.02, u1 + 0.36, v1 + 0.66, out + 0.13, { color: col });
  wall.box('paint', u0 - 0.42, v1 + 0.66, out - 0.02, u1 + 0.42, v1 + 0.74, out + 0.2, { color: scale(col, 0.85) });
  // Sign on the fascia.
  const sign = SHOP_SIGNS[h.shop];
  const rect = ctx.atlas[sign];
  if (rect) {
    const a = wall.p(u0 - 0.2, v1 + 0.08, out + 0.135),
      b = wall.p(u1 + 0.2, v1 + 0.08, out + 0.135),
      c2 = wall.p(u1 + 0.2, v1 + 0.58, out + 0.135),
      d = wall.p(u0 - 0.2, v1 + 0.58, out + 0.135);
    f.quad('signs', a, b, c2, d, rect, { color: burned ? rgb(0.35, 0.33, 0.3) : undefined });
  }
  // Door in the middle (cafe) or at one end.
  const w = u1 - u0;
  const dw = h.shop === 'cafe' ? 1.5 : 1.1;
  const du0 = h.shop === 'cafe' ? (u0 + u1) / 2 - dw / 2 : r.chance(0.5) ? u0 + 0.1 : u1 - dw - 0.1;
  const du1 = du0 + dw;
  const wf = out - 0.14;
  // Window parts: low panel + glass + frame on each side of the door.
  const segs = [];
  if (du0 - u0 > 0.4) segs.push([u0, du0 - 0.08]);
  if (u1 - du1 > 0.4) segs.push([du1 + 0.08, u1]);
  for (const [a, b] of segs) {
    wall.box('paint', a, v0, wf - 0.05, b, v0 + 0.75, wf + 0.05, { color: col, col: 'plank', colFlags: FLAG_DEFAULT });
    wall.box('paint', a, v0 + 0.75, wf - 0.06, b, v0 + 0.85, wf + 0.08, { color: scale(col, 0.9) });
    wall.box('paint', a, v1 - 0.12, wf - 0.05, b, v1, wf + 0.05, { color: col });
    wall.box('paint', a, v0 + 0.85, wf - 0.05, a + 0.08, v1 - 0.12, wf + 0.05, { color: col });
    wall.box('paint', b - 0.08, v0 + 0.85, wf - 0.05, b, v1 - 0.12, wf + 0.05, { color: col });
    const mid = (a + b) / 2;
    if (b - a > 1.6) wall.box('paint', mid - 0.04, v0 + 0.85, wf - 0.04, mid + 0.04, v1 - 0.12, wf + 0.04, { color: col });
    if (!burned && r.chance(0.6)) {
      wall.box('glass', a + 0.08, v0 + 0.85, wf - 0.004, b - 0.08, v1 - 0.12, wf + 0.004);
      const p = wall.p((a + b) / 2, (v0 + 0.85 + v1 - 0.12) / 2, wf);
      f.collider(p[0], p[1], p[2], (b - a) / 2, (v1 - 0.97 - v0) / 2, 0.005, { yaw: wall.yaw }, 'glass', FLAG_BULLET | FLAG_SOLID, false);
    } else {
      // Broken shop window: keep a solid rail so it is not walked through.
      const p = wall.p((a + b) / 2, v0 + 1.1, wf);
      f.collider(p[0], p[1], p[2], (b - a) / 2, 0.25, 0.05, { yaw: wall.yaw }, 'plank', FLAG_SOLID, false);
    }
  }
  // Mullion posts between the door and windows.
  for (const uu of [du0 - 0.08, du1]) wall.box('paint', uu, v0, wf - 0.06, uu + 0.08, v1, wf + 0.06, { color: col });
  // Glazed double door leaves, open.
  const lw = dw / 2;
  for (const [hu, dir] of [[du0, 1], [du1, -1]]) {
    const ang = r.range(1.3, 1.7);
    const cu = hu + dir * (lw / 2) * Math.cos(ang),
      cw = wf - 0.05 - (lw / 2) * Math.sin(ang);
    wall.obox('paint', cu, v0 + 1.1, cw, lw / 2, 1.1, 0.025, { color: col, rot: { yaw: dir * ang }, uv: 'box' });
  }
  const c = wall.p((du0 + du1) / 2, v0, 0);
  f.door(c[0], c[2], dw, wall.yaw, { kind: 'shop' });
  // Doorstep.
  const gy = groundY - wall.base;
  if (v0 - gy > 0.04) {
    wall.box('ashlar', u0 - 0.3, gy - 0.2, out, u1 + 0.3, v0, out + 0.45, { color: rgb(0.95, 0.93, 0.88) });
    const p = wall.p((u0 + u1) / 2, (gy - 0.2 + v0) / 2, out + 0.225);
    f.collider(p[0], p[1], p[2], (u1 - u0) / 2 + 0.3, (v0 - gy + 0.2) / 2, 0.225, { yaw: wall.yaw }, 'stone', undefined, false);
  }
  // Awning over the cafe and bakery windows (canvas on an iron frame).
  if ((h.shop === 'cafe' || h.shop === 'bakery') && !burned) {
    const ac = h.shop === 'cafe' ? rgb(0.55, 0.16, 0.13) : rgb(0.75, 0.62, 0.38);
    const ua = u0 - 0.2,
      ub = u1 + 0.2;
    const pa = wall.p((ua + ub) / 2, v1 + 0.3, out + 0.75);
    f.obox('burlap', pa[0], pa[1], pa[2], (ub - ua) / 2, 0.02, 0.8, { rot: { yaw: wall.yaw, pitch: 0.38 }, uv: 'box', color: ac });
    // Valance.
    const pv = wall.p((ua + ub) / 2, v1 - 0.05, out + 1.47);
    f.obox('burlap', pv[0], pv[1], pv[2], (ub - ua) / 2, 0.14, 0.01, { rot: { yaw: wall.yaw }, uv: 'box', color: scale(ac, 0.9) });
  }
  void w;
}

// A few pieces of furniture (also give cover inside).
function furnish(f, r, o) {
  const { xi0, xi1, zi0, zi1, top, floors, hasStair, stairX, shop } = o;
  const wood = WOOD.dark;
  const inStair = (x, z) => hasStair && Math.abs(x - stairX) < 0.9 && z > zi1 - 5.2;
  if (shop === 'cafe') {
    // Bar counter along the back.
    const z = zi0 + 1.6;
    f.box('wood', xi0 + 1.5, 0, z - 0.3, xi1 - 2.5, 1.1, z + 0.3, { color: rgb(0.55, 0.42, 0.32), col: 'wood' });
    f.box('ashlar', xi0 + 1.45, 1.1, z - 0.35, xi1 - 2.45, 1.15, z + 0.35, { color: rgb(0.8, 0.8, 0.78) });
    f.box('wood', xi0 + 1.2, 0, zi0, xi1 - 2.5, 2.0, zi0 + 0.4, { color: wood });
    for (let k = 0; k < 3; k++) if (!inStair(xi0 + 1.6 + k * 2.3, zi1 - 1.6)) table(f, r, xi0 + 1.6 + k * 2.3, zi1 - 1.6);
    return;
  }
  if (shop) {
    const z = zi0 + 1.9;
    f.box('wood', xi0 + 0.8, 0, z - 0.35, xi1 - 0.8, 1.0, z + 0.35, { color: rgb(0.5, 0.38, 0.28), col: 'wood' });
    f.box('wood', xi0 + 0.3, 0, zi0, xi1 - 0.3, 2.2, zi0 + 0.45, { color: wood });
    if (shop === 'bakery') f.box('brick', xi1 - 2.2, 0, zi0 + 0.6, xi1 - 0.2, 1.6, zi0 + 2.0, { color: rgb(0.85, 0.75, 0.7), col: 'brick' });
    return;
  }
  // Table and chairs in the main room.
  const tx = (xi0 + xi1) / 2 + r.range(-0.6, 0.6),
    tz = (zi0 + zi1) / 2 + r.range(-0.5, 0.5);
  if (!inStair(tx, tz) && !o.piles.some((p) => p.y === 0 && Math.hypot(p.x - tx, p.z - tz) < p.rx + 1)) table(f, r, tx, tz);
  // Wardrobe against the back wall.
  if (r.chance(0.7)) {
    const ax = r.range(xi0 + 0.9, xi1 - 0.9);
    if (!inStair(ax, zi0 + 0.3)) f.box('wood', ax - 0.6, 0, zi0, ax + 0.6, 2.0, zi0 + 0.55, { color: scale(wood, 1.15), col: 'wood' });
  }
  if (floors.length > 1) {
    // Bed and a chest upstairs.
    const bx = r.chance(0.5) ? xi0 + 0.85 : xi1 - 0.85;
    if (!(hasStair && Math.abs(bx - stairX) < 1.2)) {
      f.box('wood', bx - 0.75, top, zi0 + 0.1, bx + 0.75, top + 0.45, zi0 + 2.1, { color: wood, col: 'wood' });
      f.box('burlap', bx - 0.7, top + 0.45, zi0 + 0.2, bx + 0.7, top + 0.62, zi0 + 2.0, { color: rgb(0.9, 0.88, 0.82) });
      f.box('wood', bx - 0.75, top, zi0 + 0.02, bx + 0.75, top + 1.1, zi0 + 0.12, { color: wood });
    }
  }
}

export function table(f, r, x, z) {
  const c = rgb(0.6, 0.45, 0.32);
  f.box('wood', x - 0.6, 0.72, z - 0.4, x + 0.6, 0.78, z + 0.4, { color: c, col: 'wood', colFlags: FLAG_SOLID | FLAG_BULLET, nav: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box('wood', x + sx * 0.52 - 0.03, 0, z + sz * 0.32 - 0.03, x + sx * 0.52 + 0.03, 0.72, z + sz * 0.32 + 0.03, { color: c });
  // Two chairs.
  for (const sz of [-1, 1]) {
    if (r.chance(0.3)) continue;
    const cz = z + sz * 0.75,
      cx = x + r.range(-0.3, 0.3);
    f.box('wood', cx - 0.22, 0.43, cz - 0.22, cx + 0.22, 0.47, cz + 0.22, { color: c });
    f.box('wood', cx - 0.22, 0.47, cz + sz * 0.2 - 0.02, cx + 0.22, 0.95, cz + sz * 0.2 + 0.02, { color: c });
    for (const a of [-1, 1]) for (const b of [-1, 1]) f.box('wood', cx + a * 0.19 - 0.02, 0, cz + b * 0.19 - 0.02, cx + a * 0.19 + 0.02, 0.43, cz + b * 0.19 + 0.02, { color: c });
  }
}
