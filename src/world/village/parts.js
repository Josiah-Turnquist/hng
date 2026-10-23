// Reusable building parts: window and door units (frames, glass, shutters, sills,
// stone surrounds), gable roofs with optional damage, gable walls, chimneys,
// straight stairs (ramp collider + visible treads) and rubble piles.
import * as THREE from 'three';
import { RNG } from '../../core/math.js';
import { FLAG_BULLET, FLAG_SIGHT, FLAG_SOLID } from '../../physics/collision.js';
import { wallRects, rotMatrix, mat4 } from './geom.js';
import { PAINTS, WOOD, rgb, scale } from './materials.js';

const TAU = Math.PI * 2;
export const GLASS_FLAGS = FLAG_BULLET | FLAG_SOLID;
export const SHUTTER_FLAGS = FLAG_BULLET | FLAG_SIGHT;

const ASHLAR_TINT = rgb(1, 1, 1);
const STONE_SILL = rgb(0.95, 0.93, 0.88);

// ---------------------------------------------------------------------------------------
// Windows. wall: Wall (geom.js). u0..u1 along the wall, y0..y1 in frame height.
// o: { glass, shutters: 'open'|'closed'|'broken'|'none', shutterColor, frameColor,
//      sill: true, surround: 'ashlar'|null, lintel: 'wood'|'ashlar'|null, rng, burned }
export function windowUnit(wall, u0, u1, y0, y1, o = {}) {
  const t = wall.t;
  const v0 = y0 - wall.base,
    v1 = y1 - wall.base;
  const w = u1 - u0;
  const r = o.rng || new RNG(1);
  const frameColor = o.burned ? WOOD.charred : o.frameColor || rgb(0.85, 0.84, 0.8);
  // Stone surround / lintel / sill on the outer face.
  if (o.surround === 'ashlar') {
    const out = t / 2 + 0.025;
    wall.box('ashlar', u0 - 0.17, v0, t / 2 - 0.02, u0, v1, out, { color: ASHLAR_TINT });
    wall.box('ashlar', u1, v0, t / 2 - 0.02, u1 + 0.17, v1, out, { color: ASHLAR_TINT });
    wall.box('ashlar', u0 - 0.17, v1, t / 2 - 0.02, u1 + 0.17, v1 + 0.24, out + 0.01, { color: ASHLAR_TINT });
  } else if (o.lintel === 'wood') {
    wall.box('wood', u0 - 0.22, v1, t / 2 - 0.22, u1 + 0.22, v1 + 0.17, t / 2 + 0.006, { color: o.burned ? WOOD.charred : WOOD.dark });
  } else if (o.lintel === 'ashlar') {
    wall.box('ashlar', u0 - 0.2, v1, t / 2 - 0.3, u1 + 0.2, v1 + 0.25, t / 2 + 0.008, { color: ASHLAR_TINT });
  }
  if (o.sill !== false && v0 > 0.4) wall.box('ashlar', u0 - 0.08, v0 - 0.08, -t / 2 + 0.12, u1 + 0.08, v0, t / 2 + 0.06, { color: STONE_SILL });
  // Casement frame near the inner face.
  const wf = -t / 2 + 0.13;
  const fw = 0.065,
    fd = 0.06;
  if (o.frame !== false) {
    wall.box('paint', u0, v0, wf - fd / 2, u0 + fw, v1, wf + fd / 2, { color: frameColor });
    wall.box('paint', u1 - fw, v0, wf - fd / 2, u1, v1, wf + fd / 2, { color: frameColor });
    wall.box('paint', u0 + fw, v1 - fw, wf - fd / 2, u1 - fw, v1, wf + fd / 2, { color: frameColor });
    wall.box('paint', u0 + fw, v0, wf - fd / 2, u1 - fw, v0 + fw, wf + fd / 2, { color: frameColor });
    if (!o.broken) {
      // Two leaves: center mullion and glazing bars.
      const um = (u0 + u1) / 2;
      wall.box('paint', um - 0.04, v0 + fw, wf - fd / 2 + 0.005, um + 0.04, v1 - fw, wf + fd / 2 - 0.005, { color: frameColor });
      const panes = v1 - v0 > 1.5 ? 3 : 2;
      for (let k = 1; k < panes; k++) {
        const vv = v0 + fw + ((v1 - v0 - 2 * fw) * k) / panes;
        wall.box('paint', u0 + fw, vv - 0.018, wf - 0.018, u1 - fw, vv + 0.018, wf + 0.018, { color: frameColor });
      }
    }
  }
  if (o.glass) {
    wall.box('glass', u0 + fw, v0 + fw, wf - 0.004, u1 - fw, v1 - fw, wf + 0.004);
    const p = wall.p((u0 + u1) / 2, (v0 + v1) / 2, wf);
    wall.f.collider(p[0], p[1], p[2], w / 2, (v1 - v0) / 2, 0.004, { yaw: wall.yaw }, 'glass', GLASS_FLAGS, false);
  }
  // Shutters on the outer face.
  const sh = o.shutters || 'none';
  if (sh !== 'none') {
    const col = o.burned ? WOOD.charred : o.shutterColor || PAINTS.green;
    const lw = w / 2 + 0.02,
      lh = v1 - v0 + 0.02;
    const leaf = (cu, cw, yawLocal, extraRot = null) => {
      const rot = extraRot || { yaw: yawLocal };
      wall.obox('paint', cu, (v0 + v1) / 2, cw, lw / 2, lh / 2, 0.018, { color: col, rot, uv: 'box' });
      // Two battens across the back of the leaf.
      if (!extraRot) {
        for (const fv of [0.22, 0.78]) {
          wall.obox('paint', cu, v0 + lh * fv, cw - Math.sign(cw - t / 2 + 1e-6) * 0.0, lw / 2 - 0.03, 0.045, 0.024, { color: scale(col, 0.85), rot, uv: 'box' });
        }
      }
    };
    const ow = t / 2 + 0.035;
    if (sh === 'open' || sh === 'broken') {
      leaf(u0 - lw / 2 - 0.02, ow, 0);
      if (sh === 'open') leaf(u1 + lw / 2 + 0.02, ow, 0);
      else if (r.chance(0.5)) {
        // Hanging from one hinge, twisted.
        const p = { yaw: 0.5, roll: r.range(0.2, 0.5) };
        wall.obox('paint', u1 + lw * 0.3, (v0 + v1) / 2 - 0.15, ow + 0.25, lw / 2, lh / 2, 0.018, { color: col, rot: p, uv: 'box' });
      }
    } else if (sh === 'closed') {
      const cw = t / 2 - 0.03;
      leaf(u0 + lw / 2 - 0.01, cw, 0);
      leaf(u1 - lw / 2 + 0.01, cw, 0);
      const p = wall.p((u0 + u1) / 2, (v0 + v1) / 2, cw);
      wall.f.collider(p[0], p[1], p[2], w / 2, (v1 - v0) / 2, 0.02, { yaw: wall.yaw }, 'plank', SHUTTER_FLAGS, false);
    } else if (sh === 'half') {
      const cw = t / 2 - 0.03;
      leaf(u0 + lw / 2 - 0.01, cw, 0);
      leaf(u1 + lw / 2 + 0.02, ow, 0);
    }
  }
}

// Doors. o: { leaves: 1|2, color, state: 'open'|'ajar'|'missing'|'fallen', surround,
//   step: true (stone doorstep outside down to the ground), groundY (frame y of the
//   outside ground), glazed }
export function doorUnit(wall, u0, u1, y0, y1, o = {}) {
  const t = wall.t;
  const v0 = y0 - wall.base,
    v1 = y1 - wall.base;
  const w = u1 - u0;
  const r = o.rng || new RNG(2);
  const col = o.burned ? WOOD.charred : o.color || PAINTS.brown;
  if (o.surround === 'ashlar') {
    const out = t / 2 + 0.025;
    wall.box('ashlar', u0 - 0.2, v0, t / 2 - 0.02, u0, v1, out, { color: ASHLAR_TINT });
    wall.box('ashlar', u1, v0, t / 2 - 0.02, u1 + 0.2, v1, out, { color: ASHLAR_TINT });
    wall.box('ashlar', u0 - 0.2, v1, t / 2 - 0.02, u1 + 0.2, v1 + 0.28, out + 0.01, { color: ASHLAR_TINT });
  } else if (o.lintel === 'wood') {
    wall.box('wood', u0 - 0.25, v1, t / 2 - 0.24, u1 + 0.25, v1 + 0.2, t / 2 + 0.006, { color: o.burned ? WOOD.charred : WOOD.dark });
  }
  // Frame.
  const wf = t / 2 - 0.12;
  const fc = o.burned ? WOOD.charred : scale(col, 0.9);
  wall.box('paint', u0, v0, wf - 0.04, u0 + 0.07, v1, wf + 0.04, { color: fc });
  wall.box('paint', u1 - 0.07, v0, wf - 0.04, u1, v1, wf + 0.04, { color: fc });
  wall.box('paint', u0, v1 - 0.08, wf - 0.04, u1, v1, wf + 0.04, { color: fc });
  // Leaves (open inward, hinged at the jambs on the inner side of the frame).
  const leaves = o.leaves || 1;
  const lw = (w - 0.14) / leaves;
  const lh = v1 - v0 - 0.1;
  const state = o.state || 'open';
  const wl = wf - 0.06;
  const leafAt = (hingeU, dirU, ang) => {
    // Leaf rotated around a vertical hinge at (hingeU, wl); ang 0 = closed.
    const ca = Math.cos(ang),
      sa = Math.sin(ang);
    const cu = hingeU + dirU * (lw / 2) * ca;
    const cw = wl - (lw / 2) * sa;
    wall.obox('paint', cu, v0 + 0.02 + lh / 2, cw, lw / 2, lh / 2, 0.025, { color: col, rot: { yaw: dirU * ang }, uv: 'box' });
  };
  if (state === 'open' || state === 'ajar') {
    const a = state === 'open' ? r.range(1.45, 1.75) : r.range(0.35, 0.7);
    if (leaves === 1) {
      const left = r.chance(0.5);
      leafAt(left ? u0 + 0.07 : u1 - 0.07, left ? 1 : -1, a);
    } else {
      leafAt(u0 + 0.07, 1, a);
      leafAt(u1 - 0.07, -1, r.range(1.2, 1.7));
    }
  } else if (state === 'fallen') {
    // Leaf lying flat just inside the door.
    wall.obox('paint', (u0 + u1) / 2 + 0.1, v0 + 0.03, wf - lh / 2 - 0.3, lw / 2, 0.025, lh / 2, { color: scale(col, 0.8), rot: { yaw: 0.25 }, uv: 'box' });
  }
  // Doorstep outside, down to the ground.
  if (o.step !== false) {
    const gy = (o.groundY ?? -0.25) - wall.base;
    if (v0 - gy > 0.04) {
      wall.box('ashlar', u0 - 0.12, gy - 0.2, t / 2, u1 + 0.12, v0, t / 2 + 0.42, { color: STONE_SILL });
      const p = wall.p((u0 + u1) / 2, (gy - 0.2 + v0) / 2, t / 2 + 0.21);
      wall.f.collider(p[0], p[1], p[2], w / 2 + 0.12, (v0 - gy + 0.2) / 2, 0.21, { yaw: wall.yaw }, 'stone', undefined, false);
    }
  }
  // Report the doorway for navigation.
  const c = wall.p((u0 + u1) / 2, v0, 0);
  wall.f.door(c[0], c[2], +w.toFixed(2), wall.yaw, { kind: o.kind || 'door' });
}

// ---------------------------------------------------------------------------------------
// Gable roof (ridge along x). Slope coordinates for holes: x (frame) and s = distance
// from the ridge down the slope (0 .. L). Returns geometry info.
// o: { x0, x1, d, eaves, pitch, ov, gvL, gvR, mat, color, T, holes: {front: [], back: []},
//      charred, rafters: [{side, x0, x1, s0, s1}], ridge: true, cz (ridge z, default 0) }
export function gableRoof(f, o) {
  const th = o.pitch;
  const c = Math.cos(th),
    s = Math.sin(th);
  const T = o.T ?? 0.16;
  const cz = o.cz ?? 0;
  const yR = o.eaves + (o.d / 2) * Math.tan(th);
  const L = (o.d / 2 + (o.ov ?? 0.4)) / c;
  const xa = o.x0 - (o.gvL ?? 0.3),
    xb = o.x1 + (o.gvR ?? 0.3);
  const mat = o.mat || 'tiles';
  const under = o.underMat || 'wood';
  const info = { yR, L, xa, xb, c, s, T, cz, yTop: yR + T / c };
  for (const side of [1, -1]) {
    const holes = ((side > 0 ? o.holes?.front : o.holes?.back) || []).map((h) => ({ u0: h.x0 - xa, u1: h.x1 - xa, v0: h.s0, v1: h.s1 }));
    if (holes.some((h) => h.u0 <= 0 && h.u1 >= xb - xa && h.v0 <= 0 && h.v1 >= L)) continue;
    const rects = wallRects(xb - xa, L, holes);
    for (const r of rects) {
      const sm = (r.v0 + r.v1) / 2;
      const zc = cz + side * (sm * c + (T / 2) * s);
      const yc = yR - sm * s + (T / 2) * c;
      const xc = xa + (r.u0 + r.u1) / 2;
      f.obox(mat, xc, yc, zc, (r.u1 - r.u0) / 2, T / 2, (r.v1 - r.v0) / 2, {
        rot: { yaw: side > 0 ? 0 : Math.PI, pitch: th },
        uv: 'box',
        faces: { ny: under, px: under, nx: under },
        col: 'roofTile',
        colThick: 0.04,
        nav: false,
        color: o.color,
      });
    }
    // Exposed rafters and purlins in the holes.
    for (const h of holes) {
      const hx0 = xa + h.u0,
        hx1 = xa + h.u1;
      const rc = o.charred ? WOOD.charred : WOOD.scorched;
      const rr = new RNG(Math.floor((hx0 + 100) * 1000 + side * 7));
      for (let x = Math.ceil(hx0 / 0.6) * 0.6; x < hx1; x += 0.6) {
        if (rr.chance(0.3)) continue; // burned away
        const s0 = Math.max(0, h.v0 - 0.3),
          s1 = Math.min(L, h.v1 + 0.3);
        const s1b = rr.chance(0.35) ? s0 + (s1 - s0) * rr.range(0.3, 0.8) : s1; // broken
        const a = [x, yR - s0 * s - 0.07 * c, cz + side * (s0 * c - 0.07 * s)];
        const b = [x, yR - s1b * s - 0.07 * c, cz + side * (s1b * c - 0.07 * s)];
        f.beam('wood', a[0], a[1], a[2], b[0], b[1], b[2], 0.08, 0.14, { color: rc });
      }
      for (const sp of [L * 0.33, L * 0.66]) {
        if (sp < h.v0 - 0.5 || sp > h.v1 + 0.5) continue;
        const y = yR - sp * s - 0.22 * c,
          z = cz + side * (sp * c - 0.22 * s);
        const x0 = Math.max(xa, hx0 - 0.5),
          x1 = Math.min(xb, hx1 + 0.5);
        if (rr.chance(0.25)) continue;
        f.beam('wood', x0, y, z, x1, y - (rr.chance(0.3) ? 0.6 : 0), z, 0.16, 0.18, { color: rc });
      }
    }
  }
  // Ridge cap.
  if (o.ridge !== false) {
    const segs = o.ridgeSegments || [[xa, xb]];
    for (const [r0, r1] of segs) {
      f.obox(mat, (r0 + r1) / 2, yR + T / c - 0.02, cz, (r1 - r0) / 2, 0.13, 0.13, { rot: { pitch: Math.PI / 4 }, uv: 'box', color: o.color ? scale(o.color, 0.9) : undefined });
    }
  }
  return info;
}

// Triangular gable wall on top of a side wall: the triangle spans z from -d/2 to d/2
// at y = eaves up to the apex yR (z = cz). xo = outer face x, xi = inner face x.
export function gableWall(f, xo, xi, d, eaves, yR, o = {}) {
  const cz = o.cz ?? 0;
  const V = [
    [xo, eaves, cz - d / 2],
    [xo, eaves, cz + d / 2],
    [xo, yR, cz],
    [xi, eaves, cz - d / 2],
    [xi, eaves, cz + d / 2],
    [xi, yR, cz],
  ];
  const outward = xo > xi;
  // Outer face (normal toward +x when outward).
  const outer = outward ? [[0, 1, 2]] : [[0, 2, 1]];
  const inner = outward ? [[3, 5, 4]] : [[3, 4, 5]];
  f.tris(o.mat || 'plaster', V, outer, { color: o.color });
  if (o.inner !== null) f.tris(o.inner || o.mat || 'plaster', V, inner, { color: o.innerColor || o.color });
  // Collider: three stepped boxes.
  if (o.col !== false) {
    const hg = yR - eaves;
    const xc = (xo + xi) / 2,
      hx = Math.abs(xo - xi) / 2;
    for (let k = 0; k < 3; k++) {
      const wk = d * (1 - (k + 0.5) / 3);
      f.collider(xc, eaves + (hg * (k + 0.5)) / 3, cz, hx, hg / 6, wk / 2, null, o.colMat || 'stone', undefined, false);
    }
  }
}

// Gable wall facing +z/-z instead (triangle in the x/y plane), for buildings whose ridge
// runs along z. zo = outer face z, zi = inner face z, width along x.
export function gableWallZ(f, zo, zi, width, eaves, yR, o = {}) {
  const cx = o.cx ?? 0;
  const V = [
    [cx - width / 2, eaves, zo],
    [cx + width / 2, eaves, zo],
    [cx, yR, zo],
    [cx - width / 2, eaves, zi],
    [cx + width / 2, eaves, zi],
    [cx, yR, zi],
  ];
  const outward = zo > zi;
  f.tris(o.mat || 'plaster', V, outward ? [[0, 1, 2]] : [[0, 2, 1]], { color: o.color });
  if (o.inner !== null) f.tris(o.inner || o.mat || 'plaster', V, outward ? [[3, 5, 4]] : [[3, 4, 5]], { color: o.innerColor || o.color });
  if (o.col !== false) {
    const hg = yR - eaves;
    const zc = (zo + zi) / 2,
      hz = Math.abs(zo - zi) / 2;
    for (let k = 0; k < 3; k++) {
      const wk = width * (1 - (k + 0.5) / 3);
      f.collider(cx, eaves + (hg * (k + 0.5)) / 3, zc, wk / 2, hg / 6, hz, null, o.colMat || 'stone', undefined, false);
    }
  }
}

export function chimney(f, x, z, y0, y1, o = {}) {
  const w = o.w ?? 0.75,
    d = o.d ?? 0.55;
  const mat = o.mat || 'brick';
  f.box(mat, x - w / 2, y0, z - d / 2, x + w / 2, y1, z + d / 2, { color: o.color });
  f.box(o.capMat || 'ashlar', x - w / 2 - 0.06, y1, z - d / 2 - 0.06, x + w / 2 + 0.06, y1 + 0.08, z + d / 2 + 0.06, { color: STONE_SILL });
  // Flue pots.
  f.box('brick', x - 0.16, y1 + 0.08, z - 0.1, x + 0.04, y1 + 0.32, z + 0.1, { color: rgb(0.8, 0.55, 0.45) });
}

// ---------------------------------------------------------------------------------------
// Straight stair along z: from (x, y0, z0) rising to y1 over `run` meters in direction dir (+1/-1).
// One ramp collider plus visible treads, stringers and a rail.
export function straightStair(f, o) {
  const { x, z0, y0, y1, run } = o;
  const dir = o.dir ?? -1;
  const width = o.width ?? 0.95;
  const rise = y1 - y0;
  const n = Math.max(3, Math.round(rise / 0.2));
  const rs = rise / n,
    ts = run / n;
  const col = o.color || WOOD.dark;
  for (let k = 0; k < n; k++) {
    const yt = y0 + (k + 0.5) * rs;
    const zc = z0 + dir * (k + 0.5) * ts;
    f.box(o.mat || 'wood', x - width / 2, yt - 0.05, zc - ts / 2 - 0.03, x + width / 2, yt, zc + ts / 2 + 0.03, { color: col });
  }
  // Stringers.
  for (const sx of [-1, 1]) {
    const xs = x + sx * (width / 2 + 0.03);
    f.slab('wood', xs, y0 + 0.12, z0, xs, y1 + 0.12, z0 + dir * run, 0.05, 0.3, { color: scale(col, 0.85) });
  }
  // Hand rail on the open side.
  if (o.rail) {
    const xr = x + o.rail * (width / 2 + 0.03);
    f.slab('wood', xr, y0 + 0.95, z0 + dir * 0.1, xr, y1 + 0.95, z0 + dir * run, 0.06, 0.06, { color: col });
    for (const tz of [0.1, run * 0.5, run]) f.box('wood', xr - 0.03, y0 + (tz / run) * rise, z0 + dir * tz - 0.03, xr + 0.03, y0 + (tz / run) * rise + 0.95, z0 + dir * tz + 0.03, { color: col });
  }
  rampCollider(f, x, y0, z0, x, y1, z0 + dir * run, width, 0.12, o.colMat || 'wood');
}

// A walkable tilted box whose top surface runs from A to B (frame space).
export function rampCollider(f, ax, ay, az, bx, by, bz, width, thick, material = 'wood', flags) {
  const dx = bx - ax,
    dy = by - ay,
    dz = bz - az;
  const hl = Math.hypot(dx, dz);
  const len = Math.hypot(hl, dy);
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.atan2(dy, hl);
  const R = rotMatrix(yaw, pitch, 0);
  const cx = (ax + bx) / 2 - R[1] * (thick / 2),
    cy = (ay + by) / 2 - R[4] * (thick / 2),
    cz = (az + bz) / 2 - R[7] * (thick / 2);
  return f.collider(cx, cy, cz, width / 2, thick / 2, len / 2, { yaw, pitch }, material, flags, false);
}

// ---------------------------------------------------------------------------------------
// Rubble: a lumpy mound with scattered blocks and maybe a charred beam. Walkable
// through stepped colliders (each step <= 0.4 m).
export function rubblePile(f, x, y, z, rx, rz, h, o = {}) {
  const rng = new RNG(o.seed ?? Math.floor(x * 131 + z * 71 + 9999));
  const yaw = o.yaw ?? 0;
  const geo = new THREE.SphereGeometry(1, 9, 5, 0, TAU, 0, Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i),
      py = pos.getY(i),
      pz = pos.getZ(i);
    const ang = Math.atan2(pz, px);
    const n = 1 + 0.16 * Math.sin(ang * 3 + rng.next() * 0.5) + rng.range(-0.1, 0.1);
    const yy = py < 0.02 ? 0 : py * (0.85 + rng.range(0, 0.3));
    pos.setXYZ(i, px * n, yy, pz * n);
  }
  geo.computeVertexNormals();
  f.geometry('rubble', geo, mat4(x, y - 0.05, z, yaw, 0, 0, rx, h, rz), { color: o.color });
  // Blocks lying on the pile.
  const pal = o.palette || ['stone', 'ashlar', 'plaster', 'brick'];
  const nb = o.blocks ?? Math.round(4 + rx * rz * 2.2);
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  for (let k = 0; k < nb; k++) {
    const a = rng.next() * TAU,
      rr = Math.sqrt(rng.next()) * 1.05;
    const lx = Math.cos(a) * rr * rx,
      lz = Math.sin(a) * rr * rz;
    const hh = h * Math.sqrt(Math.max(0, 1 - rr * rr));
    const sz = rng.range(0.12, 0.42);
    const m = rng.pick(pal);
    const tint = m === 'plaster' ? o.plasterColor || rgb(0.95, 0.92, 0.85) : undefined;
    f.obox(m, x + cy * lx + sy * lz, y + hh + sz * 0.2, z - sy * lx + cy * lz, sz * rng.range(0.8, 1.6), sz * rng.range(0.4, 0.8), sz * rng.range(0.7, 1.2), {
      rot: { yaw: rng.next() * TAU, pitch: rng.range(-0.5, 0.5), roll: rng.range(-0.5, 0.5) },
      uv: 'box',
      color: tint,
    });
  }
  if (o.beams) {
    for (let k = 0; k < o.beams; k++) {
      const a = rng.next() * TAU;
      const len = rng.range(1.6, 3.2);
      const lx = Math.cos(a) * rx * 0.3,
        lz = Math.sin(a) * rz * 0.3;
      const bx = x + cy * lx + sy * lz,
        bz = z - sy * lx + cy * lz;
      const dir = rng.next() * TAU;
      f.beam('wood', bx, y + h * 0.5, bz, bx + Math.cos(dir) * len, y + h * rng.range(0.1, 1.3), bz + Math.sin(dir) * len, 0.16, 0.18, { color: WOOD.charred });
    }
  }
  // Stepped colliders.
  if (o.collide !== false) {
    const n = Math.max(1, Math.ceil(h / 0.38));
    for (let k = 1; k <= n; k++) {
      const yk = (k * h) / n;
      const rk = Math.sqrt(Math.max(0.05, 1 - ((k - 0.5) / n) ** 2)) * 0.74;
      const y0 = y - 0.3;
      f.collider(x, (y0 + y + yk) / 2, z, rx * rk, (y + yk - y0) / 2, rz * rk, { yaw }, 'stone', undefined, false);
    }
  }
}

// Loose blocks scattered on the ground (no colliders).
export function scatter(f, x, y, z, radius, count, o = {}) {
  const rng = new RNG(o.seed ?? Math.floor(x * 31 + z * 17 + 777));
  const pal = o.palette || ['stone', 'ashlar', 'plaster', 'brick'];
  for (let k = 0; k < count; k++) {
    const a = rng.next() * TAU,
      rr = Math.sqrt(rng.next()) * radius;
    const sz = rng.range(0.08, 0.3);
    const m = rng.pick(pal);
    const gy = o.groundAt ? o.groundAt(x + Math.cos(a) * rr, z + Math.sin(a) * rr) : y;
    f.obox(m, x + Math.cos(a) * rr, gy + sz * 0.25, z + Math.sin(a) * rr, sz * rng.range(0.8, 1.6), sz * 0.45, sz, {
      rot: { yaw: rng.next() * TAU, pitch: rng.range(-0.3, 0.3), roll: rng.range(-0.3, 0.3) },
      uv: 'box',
      color: m === 'plaster' ? o.plasterColor : undefined,
    });
  }
}
