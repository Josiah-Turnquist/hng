// The church of Saint-Aubin (objective O2): a Romanesque nave with a Gothic choir and
// polygonal apse, a tall bell tower with a slate broach spire, a stair turret on the
// facade and a sacristy tower by the choir. The nave roof has a shell hole open to the
// sky, three walls are breached so you can walk through, and all three towers can be
// climbed to their lookouts. Walled churchyard with graves.
//
// Local frame: origin at the facade center on the church floor; +z is the front (the
// square), the nave runs toward -z, +x is the bell tower side.
import * as THREE from 'three';
import { RNG } from '../../core/math.js';
import { FLAG_BULLET, FLAG_SIGHT, FLAG_DEFAULT } from '../../physics/collision.js';
import { archHeadGeometry, archRise, archPoints, roundHoleGeometry, mat4 } from './geom.js';
import { LIMEWASH, WOOD, rgb, scale, mix } from './materials.js';
import { gableRoof, gableWall, rubblePile, scatter, doorUnit, rampCollider } from './parts.js';
import { spiralStair, switchbackStair } from './stairs.js';

const STONE = rgb(1, 0.99, 0.96);
const STONE_DARK = rgb(0.86, 0.84, 0.8);
const SLATE = rgb(0.95, 0.97, 1.0);

// Arched opening in a Wall: rectangular hole up to the apex for the mesh, solid head
// filler following the arch, and colliders open to about half the arch rise.
function archOpening(wall, uc, width, y0, ySpring, kind = 'round', o = {}) {
  const r = width / 2;
  const rise = archRise(r, kind);
  const extra = 0.03;
  const v0 = y0 - wall.base,
    vs = ySpring - wall.base;
  wall.hole(uc - r, uc + r, v0, vs + rise + extra, { colV1: vs + rise * 0.55, noCol: o.noCol });
  const geo = archHeadGeometry(r, wall.t, kind, 12, extra);
  const p = wall.p(uc, vs, 0);
  wall.f.geometry(o.mat || 'ashlar', geo, mat4(p[0], p[1], p[2], wall.yaw), { color: o.color || STONE });
  // Voussoir ring on the outer face.
  if (o.ring) {
    const ring = new THREE.ExtrudeGeometry(ringShape(r, o.ring, kind), { depth: 0.06, bevelEnabled: false });
    ring.translate(0, 0, wall.t / 2);
    wall.f.geometry('ashlar', ring, mat4(p[0], p[1], p[2], wall.yaw), { color: STONE_DARK });
  }
  return { u0: uc - r, u1: uc + r, v0, vs, rise };
}

function ringShape(r, w, kind) {
  const inner = archPoints(r, 0, kind, 14);
  const outer = archPoints(r + w, 0, kind, 14);
  const sh = new THREE.Shape();
  sh.moveTo(outer[0][0], outer[0][1]);
  for (const [x, y] of outer) sh.lineTo(x, y);
  for (let i = inner.length - 1; i >= 0; i--) sh.lineTo(inner[i][0], inner[i][1]);
  return sh;
}

export function buildChurch(B, ch, ctx) {
  const r = new RNG(ch.seed);
  const f = B.frame(ch.x, ch.floorY, ch.z, ch.yaw, { tag: 'church' });
  const groundY = ch.ground - ch.floorY; // outside ground (about -0.45)
  const base = groundY - 0.8;
  const inner = mix(LIMEWASH, rgb(0.86, 0.82, 0.74), 0.35);
  const spawn = (x, y, z) => {
    const p = f.toWorld(x, y, z);
    B.spawnHints.O2.push({ x: +p[0].toFixed(2), y: +p[1].toFixed(2), z: +p[2].toFixed(2) });
  };
  const wallOpts = (t, top, extra = {}) => ({ thick: t, base, height: top - base, mat: 'ashlar', inner: 'plaster', col: 'stone', color: STONE, innerColor: inner, ...extra });
  const pitch = (50 * Math.PI) / 180;
  const tan = Math.tan(pitch);

  // ===== NAVE ========================================================================
  const NE = 9.0; // eaves
  const nt = 0.9;
  const nave = {
    front: f.wall(-6, -nt / 2, 6, -nt / 2, wallOpts(nt, NE)),
    back: f.wall(6, -26 + nt / 2, -6, -26 + nt / 2, wallOpts(nt, NE)),
    east: f.wall(6 - nt / 2, -nt, 6 - nt / 2, -26 + nt, wallOpts(nt, NE)),
    west: f.wall(-6 + nt / 2, -26 + nt, -6 + nt / 2, -nt, wallOpts(nt, NE)),
  };
  // u helpers: east wall u = -nt - z ; west wall u = z + 26 - nt.
  const eastU = (z) => -nt - z,
    westU = (z) => z + 26 - nt;
  // Portal (round arch) and rose window in the facade.
  archOpening(nave.front, 6, 2.5, 0, 3.5, 'round', { ring: 0.42 });
  nave.front.hole(6 - 1.45, 6 + 1.45, 5.8 - base, 8.7 - base);
  // Nave windows.
  const winZ = { west: [-3.3, -9.8, -16.25, -22.75], east: [-9.8, -16.25, -22.75] };
  for (const side of ['west', 'east']) {
    for (const z of winZ[side]) {
      const u = side === 'east' ? eastU(z) : westU(z);
      archOpening(nave[side], u, 1.3, 3.4, 6.4, 'round', { ring: 0.25 });
    }
  }
  // Door into the bell tower.
  nave.east.hole(eastU(-2.8), eastU(-3.9), 0 - base, 2.3 - base);
  // Breach 1: east wall around the window at z = -9.8 (shell hole down to the floor).
  {
    const u0 = eastU(-8.2),
      u1 = eastU(-11.5);
    const a = Math.min(u0, u1),
      b = Math.max(u0, u1);
    nave.east.hole(a, b, 0.02 - base, 4.4 - base);
    nave.east.hole(a - 0.45, a + 0.01, 0.9 - base, 3.8 - base);
    nave.east.hole(b - 0.01, b + 0.6, 1.4 - base, 4.1 - base);
    nave.east.hole(a + 0.4, b - 0.3, 4.3 - base, 5.2 - base);
  }
  // Breach 2: west wall below the window at z = -16.25.
  {
    const a = westU(-17.7),
      b = westU(-14.9);
    nave.west.hole(a, b, 0.02 - base, 3.6 - base);
    nave.west.hole(a - 0.35, a + 0.01, 0.7 - base, 3.0 - base);
    nave.west.hole(b - 0.01, b + 0.4, 1.1 - base, 3.3 - base);
    nave.west.hole(a + 0.3, b - 0.2, 3.5 - base, 3.9 - base);
  }
  // Chancel arch in the back wall (into the choir).
  archOpening(nave.back, 6, 6.0, 0.3, 3.6, 'pointed', { ring: 0.3 });
  for (const w of Object.values(nave)) w.build({ groundV: groundY - 0.3 - base });
  // Rose window: round plate in the square hole + tracery + glass remains.
  {
    const p = nave.front.p(6, 7.25 - base, 0);
    f.geometry('ashlar', roundHoleGeometry(2.9, 1.3, nt, 24), mat4(p[0], p[1], p[2], nave.front.yaw), { color: STONE });
    const ring = new THREE.RingGeometry(1.3, 1.62, 24, 1);
    f.geometry('ashlar', ring, mat4(p[0], p[1], p[2] + nt / 2 + 0.02, 0), { color: STONE_DARK });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI;
      f.obox('ashlar', p[0], p[1], p[2], 1.28, 0.06, 0.12, { rot: { roll: a }, uv: 'box', color: STONE });
    }
    f.obox('ashlar', p[0], p[1], p[2], 0.3, 0.3, 0.14, { rot: { roll: Math.PI / 4 }, uv: 'box', color: STONE });
    f.collider(p[0], p[1], p[2], 1.45, 1.45, 0.05, null, 'stone', FLAG_BULLET, false);
  }
  // Portal: carved tympanum under the arch on a lintel, flanking pilasters and a string course.
  {
    const zf = 0.0;
    const tymp = new THREE.CircleGeometry(1.25, 16, 0, Math.PI);
    f.geometry('ashlar', tymp, mat4(0, 3.5, zf - 0.32, 0, 0, 0), { color: rgb(0.8, 0.78, 0.73) });
    f.box('ashlar', -1.3, 3.32, -0.5, 1.3, 3.52, zf - 0.28, { color: STONE_DARK, col: 'stone', nav: false });
    // Carved cross on the tympanum.
    f.box('ashlar', -0.07, 3.62, zf - 0.33, 0.07, 4.45, zf - 0.27, { color: STONE });
    f.box('ashlar', -0.3, 4.0, zf - 0.33, 0.3, 4.12, zf - 0.27, { color: STONE });
    for (const sx of [-1, 1]) {
      f.box('ashlar', sx * 1.95 - 0.28, -0.4, -0.05, sx * 1.95 + 0.28, 5.3, 0.16, { color: STONE, col: 'stone', nav: false });
      f.box('ashlar', sx * 1.95 - 0.36, 5.3, -0.05, sx * 1.95 + 0.36, 5.5, 0.22, { color: STONE_DARK });
    }
    f.box('ashlar', -6.0, 5.5, -0.05, 6.0, 5.68, 0.12, { color: STONE_DARK });
  }
  // Portal doors: one leaf open, one hanging.
  {
    const w = nave.front;
    const col = rgb(0.38, 0.25, 0.17);
    w.obox('wood', 6 - 1.25 + 0.06, 1.8 - base, -0.25 - 0.62, 0.62, 1.8, 0.05, { rot: { yaw: Math.PI / 2 - 0.15 }, color: col, uv: 'box' });
    w.obox('wood', 6 + 1.25 - 0.4, 1.65 - base, -0.65, 0.62, 1.7, 0.05, { rot: { yaw: -Math.PI / 2 + 0.5, roll: 0.12 }, color: col, uv: 'box' });
    f.door(0, 0, 2.5, 0, { kind: 'portal' });
  }
  // Buttresses.
  const buttress = (x, z, ox, oz, h) => {
    // ox/oz: outward direction (unit along x or z). 1.0 wide, 0.9 deep.
    const w = 0.55,
      d = 0.9;
    const x0 = ox ? x : x - w,
      x1 = ox ? x + ox * d : x + w,
      z0 = oz ? z : z - w,
      z1 = oz ? z + oz * d : z + w;
    f.box('ashlar', x0, base, z0, x1, h, z1, { color: STONE, col: 'stone' });
    // Sloped cap (water table).
    const capC = [ox ? x + (ox * d) / 2 : x, h + 0.3, oz ? z + (oz * d) / 2 : z];
    f.obox('ashlar', capC[0], capC[1], capC[2], ox ? d / 2 + 0.05 : w + 0.05, 0.12, oz ? d / 2 + 0.05 : w + 0.05, { rot: ox ? { roll: ox * 0.55 } : { pitch: -oz * 0.55 }, uv: 'box', color: STONE_DARK });
    f.box('ashlar', ox ? Math.min(x, x + ox * 0.45) : x - w, h, oz ? Math.min(z, z + oz * 0.45) : z - w, ox ? Math.max(x, x + ox * 0.45) : x + w, h + 1.6, oz ? Math.max(z, z + oz * 0.45) : z + w, { color: STONE });
    f.cover(ox ? x + ox * (d + 0.4) : x + 0.95, groundY, oz ? z + oz * (d + 0.4) : z + 0.95, -ox, oz ? -oz : 0, 'high');
  };
  for (const z of [-6.6, -13, -19.5]) buttress(-6, z, -1, 0, 5.8);
  for (const z of [-13, -19.5]) buttress(6, z, 1, 0, 5.8);
  buttress(-6, -25.55, -1, 0, 6.2);
  buttress(6, -25.55, 1, 0, 6.2);
  // Plinth and string course.
  for (const [x0, z0, x1, z1] of [[-6.08, -26.05, -5.98, -0.02], [5.98, -26.05, 6.08, -6.6]]) {
    f.box('ashlar', x0, base + 0.3, z0, x1, 0.4, z1, { color: STONE_DARK });
    f.box('ashlar', x0 - 0.04, 3.05, z0, x1 + 0.04, 3.2, z1, { color: STONE_DARK });
  }
  // Cornice under the eaves.
  for (const sx of [-1, 1]) f.box('ashlar', sx * 6 - 0.12, NE - 0.3, -26.1, sx * 6 + 0.12, NE, 0.05, { color: STONE_DARK });

  // ----- Nave roof (ridge along z): built in a sub-frame rotated 90 degrees.
  const navF = f.sub(0, 0, -13, Math.PI / 2); // sub x runs toward the back, sub z = east
  // Hole: east slope from z = -7 to -17, west slope from z = -11 to -16.5.
  const zToSub = (z) => -13 - z;
  const Ln = (6 + 0.4) / Math.cos(pitch);
  const roofN = gableRoof(navF, {
    x0: -13,
    x1: 13,
    d: 12,
    eaves: NE,
    pitch,
    ov: 0.4,
    gvL: 0.25,
    gvR: 0.0,
    mat: 'slate',
    color: SLATE,
    T: 0.2,
    holes: {
      front: [
        { x0: zToSub(-7.2), x1: zToSub(-17.4), s0: 0.9, s1: Ln - 1.3 },
        { x0: zToSub(-9.5), x1: zToSub(-14.5), s0: 0.2, s1: 1.0 },
      ].map((h) => ({ x0: Math.min(h.x0, h.x1), x1: Math.max(h.x0, h.x1), s0: h.s0, s1: h.s1 })),
      back: [{ x0: zToSub(-11.2), x1: zToSub(-16.6), s0: 0.25, s1: 4.9 }].map((h) => ({ x0: Math.min(h.x0, h.x1), x1: Math.max(h.x0, h.x1), s0: h.s0, s1: h.s1 })),
    },
    charred: true,
    ridgeSegments: [
      [-13.25, zToSub(-9.4)],
      [zToSub(-17.4), 13],
    ].map(([a, b]) => [Math.min(a, b), Math.max(a, b)]),
  });
  gableWall(navF, -13, -13 + nt, 12, NE, roofN.yR, { mat: 'ashlar', color: STONE, inner: 'plaster', innerColor: inner });
  gableWall(navF, 13, 13 - nt, 12, NE, roofN.yR, { mat: 'ashlar', color: STONE, inner: 'plaster', innerColor: inner });
  // Cross on the facade gable.
  f.box('ashlar', -0.12, roofN.yTop - 0.1, -0.5, 0.12, roofN.yTop + 1.4, -0.3, { color: STONE });
  f.box('ashlar', -0.5, roofN.yTop + 0.75, -0.5, 0.5, roofN.yTop + 0.98, -0.3, { color: STONE });
  // Trusses.
  for (let z = -3; z >= -23.5; z -= 3.25) {
    const burnt = z < -6.5 && z > -18;
    const col = burnt ? WOOD.charred : WOOD.dark;
    const broken = burnt && r.chance(0.5);
    if (!(burnt && r.chance(0.25))) f.box('wood', -5.1, NE - 0.55, z - 0.13, broken ? r.range(-1, 2) : 5.1, NE - 0.25, z + 0.13, { color: col });
    for (const sx of [-1, 1]) {
      if (burnt && sx > 0 && r.chance(0.6)) continue;
      f.beam('wood', sx * 5.3, NE - 0.3, z, 0, roofN.yR - 0.35, z, 0.22, 0.26, { color: col });
    }
    if (!broken) f.box('wood', -0.12, NE - 0.55, z - 0.12, 0.12, roofN.yR - 0.3, z + 0.12, { color: col });
  }
  // Ridge beam and purlins.
  f.box('wood', -0.13, roofN.yR - 0.45, -25.1, 0.13, roofN.yR - 0.15, -18.5, { color: WOOD.dark });
  f.box('wood', -0.13, roofN.yR - 0.45, -7.5, 0.13, roofN.yR - 0.15, -0.9, { color: WOOD.dark });
  f.beam('wood', 0, roofN.yR - 0.3, -18.5, 0.6, roofN.yR - 1.9, -15.8, 0.24, 0.28, { color: WOOD.charred });

  // ===== FLOOR, STEPS, PARVIS ===========================================================
  f.box('ashlar', -5.1, -0.35, -25.1, 5.1, 0, -0.9, { color: rgb(0.85, 0.83, 0.79), faces: { ny: null }, col: 'stone', nav: false });
  // Choir step and floor (raised 0.3).
  f.box('ashlar', -3.6, -0.35, -25.1, 3.6, 0.15, -24.6, { color: STONE_DARK, col: 'stone', nav: false });
  // Parvis platform and steps down to the square.
  f.box('ashlar', -2.2, base + 0.5, 0, 12.6, 0, 2.9, { color: STONE_DARK, col: 'stone', nav: false });
  for (let k = 1; k <= 3; k++) {
    const y = -0.15 * k;
    f.box('ashlar', -2.2, base + 0.5, 2.9 + (k - 1) * 0.35, 12.6, y, 2.9 + k * 0.35, { color: STONE_DARK, col: 'stone', nav: false });
  }
  // Threshold under the portal.
  f.box('ashlar', -1.3, -0.35, -0.95, 1.3, 0.0, 0.05, { color: STONE_DARK });

  // ===== CHOIR + APSE =================================================================
  const CE = 7.6;
  const ct = 0.8;
  const choir = {
    east: f.wall(4.5 - ct / 2, -26, 4.5 - ct / 2, -34, wallOpts(ct, CE)),
    west: f.wall(-4.5 + ct / 2, -34, -4.5 + ct / 2, -26, wallOpts(ct, CE)),
  };
  // Choir windows (pointed).
  archOpening(choir.west, 4, 1.0, 3.0, 5.2, 'pointed', { ring: 0.18 });
  archOpening(choir.east, 1.6, 0.9, 3.0, 5.2, 'pointed', { ring: 0.18 });
  // Door to the sacristy tower (east wall, z -31.1 .. -32.1 -> u 5.1 .. 6.1).
  choir.east.hole(5.1, 6.1, 0.3 - base, 2.4 - base);
  for (const w of Object.values(choir)) w.build({ groundV: groundY - 0.3 - base });
  // Apse: five-sided half octagon around (0, -34).
  const R = 4.5;
  const apsePts = [];
  for (let k = 0; k <= 4; k++) {
    const a = -(k * Math.PI) / 4; // 0 .. -pi, starting at +x
    apsePts.push([R * Math.cos(a), -34 + R * Math.sin(a)]);
  }
  const Rc = R - ct / 2 / Math.cos(Math.PI / 8);
  const ext = (ct / 2) * Math.tan(Math.PI / 8) + 0.02;
  for (let k = 0; k < 4; k++) {
    const a0 = -(k * Math.PI) / 4,
      a1 = -((k + 1) * Math.PI) / 4;
    const p0 = [Rc * Math.cos(a0), -34 + Rc * Math.sin(a0)],
      p1 = [Rc * Math.cos(a1), -34 + Rc * Math.sin(a1)];
    const dx = p1[0] - p0[0],
      dz = p1[1] - p0[1];
    const l = Math.hypot(dx, dz);
    const ux = dx / l,
      uz = dz / l;
    // Extend each segment a little so the corners close.
    const w = f.wall(p0[0] - ux * ext, p0[1] - uz * ext, p1[0] + ux * ext, p1[1] + uz * ext, wallOpts(ct, CE));
    const L = w.len;
    if (k === 0 || k === 1 || k === 3) archOpening(w, L / 2, 0.85, 3.0, 5.0, 'pointed', { ring: 0.16 });
    if (k === 2) {
      // Breach 3: the north-west facet of the apse is blown open.
      w.hole(L / 2 - 1.15, L / 2 + 1.05, 0.32 - base, 3.3 - base);
      w.hole(L / 2 - 1.5, L / 2 - 1.14, 1.0 - base, 2.8 - base);
      w.hole(L / 2 + 1.04, L / 2 + 1.4, 1.5 - base, 3.0 - base);
      w.hole(L / 2 - 0.7, L / 2 + 0.6, 3.29 - base, 3.9 - base);
    }
    w.build({ groundV: groundY - 0.3 - base });
    if (k === 2) {
      const pi = w.p(L / 2, 0, -1.4),
        po = w.p(L / 2, 0, 1.5);
      rubblePile(f, pi[0], 0.3, pi[2], 1.4, 1.1, 0.5, { seed: 31, beams: 1, yaw: w.yaw });
      rubblePile(f, po[0], groundY, po[2], 1.6, 1.3, 0.75, { seed: 32, beams: 0, yaw: w.yaw, onGround: true, collide: false });
      // Ramp over the rubble from the outside ground up to the breach threshold.
      const ra = w.p(L / 2, 0, w.t / 2 + 2.3),
        rb = w.p(L / 2, 0, w.t / 2 - 0.05);
      rampCollider(f, ra[0], f.groundY(ra[0], ra[2]) - 0.02, ra[2], rb[0], 0.33, rb[2], 2.0, 0.3, 'stone');
      const c = w.p(L / 2, 0, 0);
      f.door(c[0], c[2], 2.2, w.yaw, { kind: 'breach' });
    }
    // Buttress at the apse vertices between facets.
    if (k < 3) {
      const am = a1;
      const bx = (R + 0.45) * Math.cos(am),
        bz = -34 + (R + 0.45) * Math.sin(am);
      f.obox('ashlar', bx, (base + 5.2) / 2, bz, 0.5, (5.2 - base) / 2, 0.3, { rot: { yaw: -am + Math.PI / 2 }, color: STONE, col: 'stone' });
    }
  }
  // Choir floor (raised) incl. the apse.
  {
    const inner = [];
    for (let k = 0; k <= 4; k++) {
      const a = -(k * Math.PI) / 4;
      inner.push([(R - ct) * Math.cos(a) / Math.cos(Math.PI / 8) * 0.99, -34 + ((R - ct) * Math.sin(a)) / Math.cos(Math.PI / 8) * 0.99]);
    }
    const outline = [[3.7, -24.6], ...inner, [-3.7, -24.6]];
    f.prism('ashlar', outline, -0.35, 0.3, { color: rgb(0.88, 0.86, 0.82) });
    f.colliderBox(-3.7, -0.35, -36.5, 3.7, 0.3, -25.1, 'stone', undefined, false);
    f.colliderBox(-1.9, -0.35, -37.9, 1.9, 0.3, -36.4, 'stone', undefined, false);
    // Altar on a step.
    f.box('ashlar', -1.9, 0.3, -35.6, 1.9, 0.48, -33.3, { color: STONE_DARK, col: 'stone', nav: false });
    f.box('ashlar', -1.3, 0.48, -35.2, 1.3, 1.5, -34.1, { color: STONE, col: 'stone' });
    f.box('ashlar', -1.45, 1.5, -35.3, 1.45, 1.62, -34.0, { color: STONE_DARK });
    f.cover(0, 0.48, -32.9, 0, -1, 'low');
  }
  // Choir roof and apse roof.
  const chF = f.sub(0, 0, -30, Math.PI / 2);
  const roofC = gableRoof(chF, { x0: -4, x1: 4, d: 9, eaves: CE, pitch, ov: 0.35, gvL: 0, gvR: 0, mat: 'slate', color: SLATE, T: 0.18 });
  // Apse roof: four sloped facets meeting at the end of the choir ridge.
  {
    const T = 0.18;
    const apexY = roofC.yTop,
      apexZ = -34;
    const ov = 0.35;
    const eaveY = CE - ov * tan + T / Math.cos(pitch);
    const Ro = R + ov / Math.cos(Math.PI / 8);
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const a = -(k * Math.PI) / 4;
      pts.push([Ro * Math.cos(a), eaveY, -34 + Ro * Math.sin(a)]);
    }
    const apex = [0, apexY, apexZ];
    for (let k = 0; k < 4; k++) {
      const A = pts[k],
        Bp = pts[k + 1];
      // Top surface and underside (dropped by T).
      const verts = [A, Bp, apex, [A[0], A[1] - T, A[2]], [Bp[0], Bp[1] - T, Bp[2]], [apex[0], apex[1] - T, apex[2]]];
      f.tris('slate', verts, [[0, 1, 2]], { color: SLATE, uvFn: slopeUV(A, Bp, apex) });
      f.tris('wood', verts, [[3, 5, 4], [0, 4, 1], [0, 3, 4]], { color: WOOD.dark });
      // Collider: a tilted box over the middle of the facet.
      const mx = (A[0] + Bp[0]) / 2,
        mz = (A[2] + Bp[2]) / 2;
      const dirx = apex[0] - mx,
        dirz = apex[2] - mz,
        diry = apex[1] - A[1];
      const hl = Math.hypot(dirx, dirz);
      const len = Math.hypot(hl, diry);
      const ex = mx + dirx * 0.38,
        ez = mz + dirz * 0.38,
        ey = A[1] + diry * 0.38;
      const yaw = Math.atan2(dirx, dirz);
      const pitchF = -Math.atan2(diry, hl);
      const edge = Math.hypot(Bp[0] - A[0], Bp[2] - A[2]);
      f.collider(ex, ey - 0.03, ez, edge * 0.36, 0.03, len * 0.36, { yaw, pitch: pitchF }, 'roofTile', undefined, false);
    }
  }
  // Nave back gable above the choir roof is already built (sub-frame gable at x=13).

  // ===== PEWS, FONT, RUBBLE ===========================================================
  {
    const rr = new RNG(ch.seed + 9);
    const pewCol = rgb(0.52, 0.38, 0.27);
    for (let z = -5.0; z >= -22.6; z -= 1.25) {
      for (const sx of [-1, 1]) {
        // Pews under the roof hole were smashed or pushed around.
        const inHole = z < -6.8 && z > -17.5 && sx > 0;
        if (inHole && rr.chance(0.55)) continue;
        // Aisles cleared by the blasts in front of the breaches.
        if ((sx > 0 && z < -7.6 && z > -12.0) || (sx < 0 && z < -14.2 && z > -18.4)) continue;
        const x0 = sx > 0 ? 0.85 : -4.75,
          x1 = sx > 0 ? 4.75 : -0.85;
        const yaw = inHole ? rr.range(-0.5, 0.5) : rr.range(-0.02, 0.02);
        const xc = (x0 + x1) / 2 + (inHole ? rr.range(-0.4, 0.4) : 0),
          zc = z + (inHole ? rr.range(-0.3, 0.3) : 0);
        const len = (x1 - x0) / 2;
        const c = Math.cos(yaw),
          s = Math.sin(yaw);
        const at = (lx, lz) => [xc + c * lx + s * lz, zc - s * lx + c * lz];
        const p1 = at(0, 0);
        f.obox('wood', p1[0], 0.45, p1[1], len, 0.03, 0.2, { rot: { yaw }, color: pewCol, uv: 'box' });
        const p2 = at(0, 0.24);
        f.obox('wood', p2[0], 0.72, p2[1], len, 0.3, 0.03, { rot: { yaw }, color: pewCol, uv: 'box' });
        for (const e of [-1, 1]) {
          const p3 = at(e * (len - 0.03), 0.04);
          f.obox('wood', p3[0], 0.48, p3[1], 0.03, 0.48, 0.27, { rot: { yaw }, color: scale(pewCol, 0.85), uv: 'box' });
        }
        f.collider(p1[0], 0.48, (p1[1] + p2[1]) / 2, len, 0.48, 0.2, { yaw }, 'wood', FLAG_DEFAULT, false);
        if (!inHole && Math.abs(z + 13) < 6) f.cover(p1[0], 0, p1[1] - 0.6, 0, 1, 'low');
      }
    }
    // Baptismal font by the door.
    const font = new THREE.CylinderGeometry(0.55, 0.42, 0.45, 8);
    f.geometry('ashlar', font, mat4(-3.6, 0.85, -2.6), { color: STONE });
    f.box('ashlar', -3.8, 0, -2.8, -3.4, 0.62, -2.4, { color: STONE_DARK, col: 'stone' });
    // Collapse under the roof hole: roof timbers and slates on the floor.
    rubblePile(f, 2.6, 0, -12.2, 2.3, 3.4, 1.25, { seed: 41, beams: 5, palette: ['ashlar', 'stone', 'slate'] });
    rubblePile(f, -2.3, 0, -14.8, 1.4, 1.6, 0.55, { seed: 42, beams: 2, palette: ['ashlar', 'slate'] });
    // Breach rubble.
    const b1i = [5.1 - 1.1, -9.9],
      b1o = [6 + 1.2, -9.9];
    rubblePile(f, b1i[0], 0, b1i[1], 1.0, 1.6, 0.55, { seed: 43, beams: 0, yaw: Math.PI / 2 });
    rubblePile(f, b1o[0], groundY, b1o[1], 1.2, 1.9, 0.75, { seed: 44, beams: 1, yaw: Math.PI / 2, onGround: true, collide: false });
    rubblePile(f, -5.1 + 1.0, 0, -16.3, 0.9, 1.4, 0.45, { seed: 45, beams: 0, yaw: Math.PI / 2 });
    rubblePile(f, -6 - 1.1, groundY, -16.3, 1.1, 1.6, 0.7, { seed: 46, beams: 0, yaw: Math.PI / 2, onGround: true, collide: false });
    // Ramps over the outside rubble up to the breach thresholds.
    rampCollider(f, 8.4, f.groundY(8.4, -9.85) - 0.02, -9.85, 5.95, 0.03, -9.85, 3.0, 0.3, 'stone');
    rampCollider(f, -8.4, f.groundY(-8.4, -16.3) - 0.02, -16.3, -5.95, 0.03, -16.3, 2.6, 0.3, 'stone');
    f.door(6 - nt / 2, -9.85, 3.3, -Math.PI / 2, { kind: 'breach' });
    f.door(-6 + nt / 2, -16.3, 2.8, Math.PI / 2, { kind: 'breach' });
    scatter(f, 1, 0.02, -11, 4, 18, { seed: 47, palette: ['ashlar', 'slate', 'stone'] });
  }
  // Spawn points inside, and in the churchyard behind the nave.
  for (let z = -3.5; z >= -23; z -= 3.2) spawn(0, 0, z);
  for (const [x, z] of [[13.5, -12], [13.5, -21], [9.5, -39], [-1, -42]]) spawn(x, groundY, z);
  spawn(0, 0.3, -29);
  spawn(-2.5, 0.3, -31.5);

  // ===== BELL TOWER ====================================================================
  {
    const tx0 = 6,
      tx1 = 12.6,
      tz0 = -6.6,
      tz1 = 0;
    const tt = 0.8;
    const TOP = 20.4;
    const BF = 15.4; // belfry floor
    const tw = {
      south: f.wall(tx0, tz1 - tt / 2, tx1, tz1 - tt / 2, wallOpts(tt, TOP)),
      north: f.wall(tx1, tz0 + tt / 2, tx0, tz0 + tt / 2, wallOpts(tt, TOP)),
      east: f.wall(tx1 - tt / 2, tz1 - tt, tx1 - tt / 2, tz0 + tt, wallOpts(tt, TOP)),
      west: f.wall(tx0 + tt / 2, tz0 + tt, tx0 + tt / 2, tz1 - tt, wallOpts(tt, TOP)),
    };
    // Exterior door (south) and door from the nave (west, z -2.8 .. -3.9).
    tw.south.hole(3.9, 5.0, 0 - base, 2.4 - base);
    tw.west.hole(-3.9 - (tz0 + tt), -2.8 - (tz0 + tt), 0 - base, 2.3 - base);
    // Arrow slits.
    for (const [key, u, y] of [['south', 1.6, 5.2], ['south', 1.6, 9.6], ['east', 2.4, 7.0], ['east', 2.4, 11.4], ['north', 3.3, 8.2], ['north', 3.3, 12.6], ['south', 3.3, 13.0 - 0.5]]) {
      if (key === 'south' && y > 12) continue;
      tw[key].hole(u - 0.16, u + 0.16, y - base, y + 1.25 - base);
    }
    // Belfry openings: two per face.
    for (const key of ['south', 'north', 'east', 'west']) {
      const L = tw[key].len;
      for (const u of [L * 0.29, L * 0.71]) archOpening(tw[key], u, 1.0, BF + 0.75, BF + 3.1, 'round', { ring: 0.2 });
    }
    for (const w of Object.values(tw)) w.build({ groundV: groundY - 0.3 - base });
    // Doors.
    doorUnitSimple(f, tw.south, 3.9, 5.0, 0, 2.4, groundY);
    f.door(...(() => {
      const c = tw.west.p((tw.west.holes[0].u0 + tw.west.holes[0].u1) / 2, 0, 0);
      return [c[0], c[2]];
    })(), 1.1, tw.west.yaw, { kind: 'door' });
    // Clock on the south face.
    {
      const cy = 13.4,
        cx = (tx0 + tx1) / 2,
        cz = tz1 + 0.03;
      const rc = ctx.atlas.clock;
      f.quad('signs', [cx - 0.9, cy - 0.9, cz], [cx + 0.9, cy - 0.9, cz], [cx + 0.9, cy + 0.9, cz], [cx - 0.9, cy + 0.9, cz], rc);
      f.box('ashlar', cx - 1.05, cy - 1.05, tz1 - 0.02, cx + 1.05, cy + 1.05, tz1 + 0.02, { color: STONE_DARK, faces: { pz: null } });
    }
    // String courses and the cornice.
    for (const y of [9.0, BF - 0.1]) f.box('ashlar', tx0 - 0.05, y, tz0 - 0.08, tx1 + 0.08, y + 0.22, tz1 + 0.08, { color: STONE_DARK, faces: { ny: 'ashlar' } });
    f.box('ashlar', tx0 - 0.2, TOP - 0.05, tz0 - 0.2, tx1 + 0.2, TOP + 0.3, tz1 + 0.2, { color: STONE_DARK });
    // Corner buttresses (east side).
    for (const [x, z] of [[tx1, tz1], [tx1, tz0]]) {
      f.box('ashlar', x - 0.1, base, z - 0.45, x + 0.55, 8.5, z + 0.45, { color: STONE, col: 'stone' });
      f.obox('ashlar', x + 0.25, 8.75, z, 0.38, 0.12, 0.5, { rot: { roll: 0.6 }, uv: 'box', color: STONE_DARK });
    }
    // Floor and stairs inside.
    const ix0 = tx0 + tt,
      ix1 = tx1 - tt,
      iz0 = tz0 + tt,
      iz1 = tz1 - tt;
    f.box('ashlar', ix0, -0.35, iz0, ix1, 0, iz1, { color: STONE_DARK, col: 'stone', nav: false });
    const sb = switchbackStair(f, { x0: ix0, x1: ix1, z0: iz0, z1: iz1, y0: 0, flights: 7, rise: BF / 7, dividerMat: 'plaster', dividerColor: inner, color: WOOD.dark });
    // Belfry floor with the stair opening.
    const hole = sb.hole;
    for (const [a, b, c, d] of [
      [ix0, iz0 + 0.93, hole.x0, iz1 - 0.93],
      [ix0, iz1 - 0.93, ix1, iz1],
    ]) {
      f.box('wood', a, BF - 0.2, b, c, BF, d, { color: WOOD.weathered, faces: { ny: 'wood' }, col: 'wood', nav: false });
    }
    // Bell frame and bell.
    const bx = (ix0 + hole.x0) / 2,
      bz = (iz0 + iz1) / 2;
    for (const sx of [-1, 1]) f.box('wood', bx + sx * 0.9 - 0.1, BF, bz - 0.1, bx + sx * 0.9 + 0.1, BF + 3.4, bz + 0.1, { color: WOOD.dark });
    f.box('wood', bx - 1.1, BF + 3.3, bz - 0.12, bx + 1.1, BF + 3.55, bz + 0.12, { color: WOOD.dark });
    const bell = new THREE.LatheGeometry(
      [[0.0, 0.0], [0.62, 0.0], [0.6, 0.12], [0.48, 0.3], [0.38, 0.6], [0.34, 0.9], [0.3, 1.05], [0.18, 1.12], [0.0, 1.14]].map(([x, y]) => new THREE.Vector2(x, y)),
      14,
    );
    f.geometry('bronze', bell, mat4(bx, BF + 2.15, bz), {});
    // Louvres in the upper part of the openings.
    for (const key of ['south', 'north', 'east', 'west']) {
      const w = tw[key];
      for (const u of [w.len * 0.29, w.len * 0.71]) {
        for (let k = 0; k < 3; k++) {
          if (r.chance(0.35)) continue; // shot away
          w.obox('wood', u, BF + 3.0 - k * 0.32 - base, 0, 0.5, 0.012, 0.22, { rot: { roll: 0, pitch: 0.75 }, color: WOOD.weathered, uv: 'box' });
        }
        // Cover point (standing at the opening, looking out).
        const p = w.p(u, 0, -tt / 2 - 0.45);
        f.cover(p[0], BF, p[2], w.nx, w.nz, 'high');
      }
    }
    // Spire: octagonal slate pyramid with four corner broaches and a cross.
    const sH = 13.8;
    const sBase = TOP + 0.3;
    const cx = (tx0 + tx1) / 2,
      cz = (tz0 + tz1) / 2;
    const apoth = 3.2;
    const rad = apoth / Math.cos(Math.PI / 8);
    const spire = new THREE.CylinderGeometry(0.05, rad, sH, 8, 4, true);
    f.geometry('slate', spire, mat4(cx, sBase + sH / 2, cz, Math.PI / 8), { color: SLATE });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const C = [cx + sx * 3.25, sBase, cz + sz * 3.25];
      const A = [cx + sx * rad * Math.cos(Math.PI / 8), sBase, cz + sz * rad * Math.sin(Math.PI / 8)];
      const Bv = [cx + sx * rad * Math.sin(Math.PI / 8), sBase, cz + sz * rad * Math.cos(Math.PI / 8)];
      const k = 0.36;
      const T = [cx + sx * rad * 0.707 * (1 - k), sBase + sH * k, cz + sz * rad * 0.707 * (1 - k)];
      const flip = sx * sz > 0;
      f.tris('slate', [C, A, Bv, T], flip ? [[0, 1, 3], [0, 3, 2]] : [[0, 3, 1], [0, 2, 3]], { color: SLATE });
    }
    f.box('iron', cx - 0.04, sBase + sH - 0.2, cz - 0.04, cx + 0.04, sBase + sH + 1.6, cz + 0.04);
    f.box('iron', cx - 0.45, sBase + sH + 0.95, cz - 0.03, cx + 0.45, sBase + sH + 1.03, cz + 0.03);
    // Spire colliders (stepped).
    for (let k = 0; k < 3; k++) {
      const h0 = sBase + (sH * k) / 3,
        h1 = sBase + (sH * (k + 1)) / 3;
      const a = apoth * (1 - (k + 0.5) / 3);
      f.collider(cx, (h0 + h1) / 2, cz, a, (h1 - h0) / 2, a, null, 'roofTile', FLAG_BULLET | FLAG_SIGHT, false);
    }
    // Spawn: tower ground floor.
    spawn((ix0 + hole.x0) / 2, 0, (iz0 + iz1) / 2);
    f.cover(cx, BF, iz1 - 0.6, 0, 1, 'high');
  }

  // ===== STAIR TURRET on the facade (lookout at 12.6 m) =================================
  {
    const x0 = -6.4,
      x1 = -2.2,
      z0 = 0,
      z1 = 4.2;
    const tt = 0.5;
    const LOOK = 12.6,
      PAR = LOOK + 1.05,
      EAV = LOOK + 2.65;
    const tw = {
      south: f.wall(x0, z1 - tt / 2, x1, z1 - tt / 2, wallOpts(tt, EAV)),
      north: f.wall(x1, z0 + tt / 2, x0, z0 + tt / 2, wallOpts(tt, EAV)),
      east: f.wall(x1 - tt / 2, z1 - tt, x1 - tt / 2, z0 + tt, wallOpts(tt, EAV)),
      west: f.wall(x0 + tt / 2, z0 + tt, x0 + tt / 2, z1 - tt, wallOpts(tt, EAV)),
    };
    // Door (south) and lookout openings above the parapet on every side.
    tw.south.hole(1.55, 2.6, 0 - base, 2.2 - base);
    for (const key of ['south', 'north', 'east', 'west']) {
      const w = tw[key];
      w.hole(0.62, w.len - 0.62, PAR - base, EAV - 0.35 - base);
      // Slits lower down.
      if (key !== 'north') w.hole(w.len / 2 - 0.13, w.len / 2 + 0.13, 6.0 - base, 7.1 - base);
    }
    for (const w of Object.values(tw)) w.build({ groundV: groundY - 0.3 - base });
    doorUnitSimple(f, tw.south, 1.55, 2.6, 0, 2.2, groundY);
    const ix0 = x0 + tt,
      ix1 = x1 - tt,
      iz0 = z0 + tt,
      iz1 = z1 - tt;
    f.box('ashlar', ix0, -0.35, iz0, ix1, 0, iz1, { color: STONE_DARK, col: 'stone', nav: false });
    spiralStair(f, { x0: ix0, x1: ix1, z0: iz0, z1: iz1, y0: 0, flights: 13, rise: LOOK / 13, c: 0.9, start: 0 });
    // Parapet coping and the pyramid roof.
    pyramidRoof(f, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.6, EAV, 3.0, 'slate', SLATE);
    for (const key of ['south', 'north', 'east', 'west']) {
      const w = tw[key];
      const p = w.p(w.len / 2, 0, -tt / 2 - 0.5);
      f.cover(p[0], LOOK, p[2], w.nx, w.nz, 'low');
    }
    spawn((ix0 + ix1) / 2, 0, iz1 - 0.45);
  }

  // ===== SACRISTY TOWER by the choir (lookout at 10.7 m) =================================
  {
    const x0 = 4.5,
      x1 = 9.3,
      z0 = -34,
      z1 = -29.2;
    const tt = 0.6;
    const flights = 9;
    const rise = 1.19;
    const LOOK = flights * rise,
      PAR = LOOK + 1.05,
      EAV = LOOK + 2.7;
    const tw = {
      south: f.wall(x0, z1 - tt / 2, x1, z1 - tt / 2, wallOpts(tt, EAV)),
      north: f.wall(x1, z0 + tt / 2, x0, z0 + tt / 2, wallOpts(tt, EAV)),
      east: f.wall(x1 - tt / 2, z1 - tt, x1 - tt / 2, z0 + tt, wallOpts(tt, EAV)),
      west: f.wall(x0 + tt / 2, z0 + tt, x0 + tt / 2, z1 - tt, wallOpts(tt, EAV)),
    };
    tw.south.hole(1.9, 2.95, 0.15 - base, 2.35 - base);
    // Door from the choir: z -31.1 .. -32.1 -> west wall u = z - (z0 + tt).
    tw.west.hole(-32.1 - (z0 + tt), -31.1 - (z0 + tt), 0.3 - base, 2.4 - base);
    for (const key of ['south', 'north', 'east', 'west']) {
      const w = tw[key];
      w.hole(0.7, w.len - 0.7, PAR - base, EAV - 0.35 - base);
      if (key === 'east' || key === 'north') w.hole(w.len / 2 - 0.13, w.len / 2 + 0.13, 4.5 - base, 5.6 - base);
    }
    for (const w of Object.values(tw)) w.build({ groundV: groundY - 0.3 - base });
    doorUnitSimple(f, tw.south, 1.9, 2.95, 0.15, 2.35, groundY);
    f.door(4.9, -31.6, 1.0, -Math.PI / 2, { kind: 'door' });
    const ix0 = x0 + tt,
      ix1 = x1 - tt,
      iz0 = z0 + tt,
      iz1 = z1 - tt;
    f.box('ashlar', ix0, -0.35, iz0, ix1, 0.15, iz1, { color: STONE_DARK, col: 'stone', nav: false });
    spiralStair(f, { x0: ix0, x1: ix1, z0: iz0, z1: iz1, y0: 0.15, flights, rise, c: 0.95, start: 0 });
    pyramidRoof(f, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.6, EAV, 3.0, 'slate', SLATE);
    for (const key of ['south', 'north', 'east', 'west']) {
      const w = tw[key];
      const p = w.p(w.len / 2, 0, -tt / 2 - 0.5);
      f.cover(p[0], LOOK + 0.15, p[2], w.nx, w.nz, 'low');
    }
  }

  // ===== CHURCHYARD: walls, gates and graves ============================================
  churchyard(f, ch, ctx, { groundY, spawn });
  return f;
}

// Planar UVs on a roof facet (u along the eave, v up the slope).
function slopeUV(A, Bp, apex) {
  const ux = Bp[0] - A[0],
    uz = Bp[2] - A[2];
  const ul = Math.hypot(ux, uz);
  const ex = ux / ul,
    ez = uz / ul;
  return (P, out) => {
    const dx = P[0] - A[0],
      dy = P[1] - A[1],
      dz = P[2] - A[2];
    out[0] = dx * ex + dz * ez;
    const h = -dx * ez + dz * ex;
    out[1] = -Math.hypot(h, dy) * Math.sign(dy || 1);
    return out;
  };
}

// Square pyramid roof on four corner piers (the walls below carry the openings).
function pyramidRoof(f, cx, cz, size, eaves, height, mat, color) {
  const T = 0.16;
  const h = size / 2;
  const P = [
    [cx - h, eaves, cz + h],
    [cx + h, eaves, cz + h],
    [cx + h, eaves, cz - h],
    [cx - h, eaves, cz - h],
  ];
  const apex = [cx, eaves + height, cz];
  for (let k = 0; k < 4; k++) {
    const A = P[k],
      Bv = P[(k + 1) % 4];
    const verts = [A, Bv, apex, [A[0], A[1] - T, A[2]], [Bv[0], Bv[1] - T, Bv[2]], [apex[0], apex[1] - T, apex[2]]];
    f.tris(mat, verts, [[0, 1, 2]], { color, uvFn: slopeUV(A, Bv, apex) });
    f.tris('wood', verts, [[3, 5, 4], [0, 4, 1], [0, 3, 4]], { color: WOOD.dark });
  }
  f.box('iron', cx - 0.03, eaves + height - 0.1, cz - 0.03, cx + 0.03, eaves + height + 0.9, cz + 0.03);
  f.collider(cx, eaves + height * 0.3, cz, h * 0.7, height * 0.3, h * 0.7, null, 'roofTile', FLAG_BULLET | FLAG_SIGHT, false);
}

// Plain plank door in a tower wall (open), with a doorstep.
function doorUnitSimple(f, wall, u0, u1, y0, y1, groundY) {
  doorUnit(wall, u0, u1, y0, y1, { color: rgb(0.36, 0.26, 0.18), state: 'open', lintel: null, groundY, rng: new RNG(Math.floor(u0 * 100 + y1 * 7)) });
}

function churchyard(f, ch, ctx, { groundY }) {
  const y = ch.yard;
  const H = 1.6,
    T = 0.5;
  const col = rgb(0.98, 0.96, 0.92);
  const segs = [
    // [x0, z0, x1, z1, gates [u, w]]
    [12.6, y.z1, y.x1, y.z1, [[4.4, 1.6]]],
    [y.x1, y.z1, y.x1, y.z0, [[14, 1.5]]],
    [y.x1, y.z0, y.x0, y.z0, [[17.5, 1.5]]],
    [y.x0, y.z0, y.x0, -28.2, []],
  ];
  for (const [x0, z0, x1, z1, gates] of segs) {
    const w = f.wall(x0, z0, x1, z1, { thick: T, base: groundY - 0.4, height: H + 0.4, mat: 'stone', inner: 'stone', col: 'stone', color: col });
    for (const [u, gw] of gates) w.hole(u - gw / 2, u + gw / 2, -1, 9);
    w.build({ groundV: 0.3 });
    // Coping stones.
    const L = w.len;
    const cuts = [[0, L]];
    for (const [u, gw] of gates) {
      const last = cuts.pop();
      cuts.push([last[0], u - gw / 2], [u + gw / 2, last[1]]);
    }
    for (const [a, b] of cuts) {
      w.box('ashlar', a, H + 0.4, -T / 2 - 0.06, b, H + 0.52, T / 2 + 0.06, { color: rgb(0.9, 0.88, 0.84) });
      // Cover along the wall on both sides.
      for (let u = a + 1.2; u < b - 0.8; u += 3.5) {
        for (const side of [-1, 1]) {
          const p = w.p(u, 0, side * (T / 2 + 0.45));
          f.cover(p[0], groundY, p[2], -side * w.nx, -side * w.nz, 'low');
        }
      }
    }
    // Gate pillars.
    for (const [u, gw] of gates) {
      for (const e of [-1, 1]) {
        const uu = u + (e * gw) / 2;
        const a = e < 0 ? uu - 0.4 : uu,
          b = e < 0 ? uu : uu + 0.4;
        w.box('ashlar', a, 0, -0.35, b, H + 0.4 + 0.45, 0.35, { color: col, col: 'stone' });
        w.box('ashlar', a - 0.05, H + 0.85, -0.4, b + 0.05, H + 0.97, 0.4, { color: rgb(0.9, 0.88, 0.84) });
      }
    }
  }
  // Graves.
  const graveCol = rgb(0.86, 0.85, 0.82);
  for (const g of ctx.plan.graves || []) {
    const gr = new RNG(g.seed);
    const gx = g.lx,
      gz = g.lz;
    const gyy = groundY;
    const tint = mix(graveCol, rgb(0.6, 0.6, 0.56), gr.range(0, 0.5));
    if (g.kind === 'slab' || g.kind === 'tomb') {
      const h = g.kind === 'tomb' ? 0.65 : 0.22;
      f.box('ashlar', gx - 0.48, gyy - 0.1, gz - 1.0, gx + 0.48, gyy + h, gz + 1.0, { color: tint, col: g.kind === 'tomb' ? 'stone' : undefined, nav: g.kind === 'tomb' });
      if (g.kind === 'tomb') f.box('ashlar', gx - 0.55, gyy + h, gz - 1.07, gx + 0.55, gyy + h + 0.08, gz + 1.07, { color: scale(tint, 1.05) });
    }
    if (g.kind === 'cross' || g.kind === 'slab') {
      const cz = gz - (g.kind === 'slab' ? 1.1 : 0.9);
      f.obox('iron', gx, gyy + 0.55, cz, 0.03, 0.55, 0.03, { rot: { roll: g.tilt } });
      f.obox('iron', gx, gyy + 0.8, cz, 0.24, 0.025, 0.025, { rot: { roll: g.tilt } });
    }
    if (g.kind === 'stele') {
      f.obox('ashlar', gx, gyy + 0.4, gz - 0.9, 0.3, 0.45, 0.07, { rot: { roll: g.tilt, pitch: gr.range(-0.08, 0.08) }, uv: 'box', color: tint });
      f.box('ashlar', gx - 0.4, gyy - 0.05, gz - 0.8, gx + 0.4, gyy + 0.12, gz + 0.9, { color: scale(tint, 0.95) });
    }
  }
}
