// Bridges where the roads cross the river: a three-arch stone bridge with parapets
// ('stone'), or the same bridge with its middle span blown into the river ('destroyed'),
// leaving broken deck ends, a fallen slab you can climb down and rubble to wade across.
//
// Frame: origin at the crossing on the road centerline, +z along the road, absolute y.
import * as THREE from 'three';
import { RNG } from '../../core/math.js';
import { FLAG_DEFAULT } from '../../physics/collision.js';
import { rgb, scale } from './materials.js';
import { rampCollider, rubblePile, scatter } from './parts.js';

const STONE = rgb(0.92, 0.9, 0.85);
const RING = rgb(0.85, 0.83, 0.78);

// Segmental arch points from (a0, ys) over to (a1, ys) with the given rise.
function segArch(a0, a1, ys, rise, n = 12) {
  const r = (a1 - a0) / 2;
  const R = (r * r + rise * rise) / (2 * rise);
  const c = (a0 + a1) / 2;
  const cy = ys + rise - R;
  const t0 = Math.asin(r / R);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = -t0 + (2 * t0 * i) / n;
    pts.push([c + R * Math.sin(t), cy + R * Math.cos(t)]);
  }
  return pts; // from left (a0) to right (a1)
}

export function buildBridges(B, plan, ctx) {
  const out = [];
  for (const br of plan.bridges) {
    const r = new RNG(br.seed);
    const f = B.frame(br.x, 0, br.z, br.yaw, { tag: `bridge:${br.kind}` });
    const W = br.width;
    const wy = br.waterY;
    const deck = br.deckY;
    const z0 = -br.back - 1,
      z1 = br.ahead + 1;
    const bottom = wy - 3.2;
    const spring = wy - 0.4;
    const crown = deck - 0.75;
    // Three arches over the river: spans of 6.5 m with 1.6 m piers.
    const span = 6.5,
      pier = 1.6;
    const arches = [
      [-span * 1.5 - pier, -span / 2 - pier],
      [-span / 2, span / 2],
      [span / 2 + pier, span * 1.5 + pier],
    ];
    const destroyed = br.kind === 'destroyed';
    const gap = destroyed ? [-span / 2 - 0.4, span / 2 + 0.6] : null;
    // Profile pieces (z ranges) of the bridge body.
    const pieces = destroyed ? [[z0, gap[0]], [gap[1], z1]] : [[z0, z1]];
    for (const [pa, pb] of pieces) {
      const sh = new THREE.Shape();
      const left = pa === z0,
        right = pb === z1;
      sh.moveTo(pa, bottom);
      sh.lineTo(pb, bottom);
      if (right) sh.lineTo(pb, deck - 0.05);
      else jagged(sh, pb, bottom, deck - 0.05, r, -1);
      sh.lineTo(pa, deck - 0.05);
      if (!left) jagged(sh, pa, deck - 0.05, bottom, r, 1);
      sh.lineTo(pa, bottom);
      for (const [a0, a1] of arches) {
        if (a0 < pa + 0.5 || a1 > pb - 0.5) continue;
        const hole = new THREE.Path();
        const pts = segArch(a0, a1, spring, crown - spring);
        hole.moveTo(a0, bottom + 0.3);
        for (const [z, y] of pts) hole.lineTo(z, y);
        hole.lineTo(a1, bottom + 0.3);
        hole.lineTo(a0, bottom + 0.3);
        sh.holes.push(hole);
      }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: W - 0.1, bevelEnabled: false, curveSegments: 10 });
      // Shape x -> frame z, shape y -> y, extrusion -> -x (proper rotation).
      const m = new THREE.Matrix4().set(0, 0, -1, (W - 0.1) / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
      f.geometry('stone', geo, m, { color: STONE });
      // Deck paving on top.
      f.box('cobble', -W / 2 + 0.05, deck - 0.06, pa, W / 2 - 0.05, deck, pb, { color: rgb(0.95, 0.93, 0.9), faces: { ny: null } });
      // Deck collider.
      f.collider(0, deck - 0.4, (pa + pb) / 2, W / 2, 0.4, (pb - pa) / 2, null, 'stone', FLAG_DEFAULT, false);
      // Parapets.
      for (const sx of [-1, 1]) {
        const x0 = sx * (W / 2 - 0.2);
        const ends = destroyed && !left ? [pa + r.range(0.4, 1.4), pb] : destroyed && !right ? [pa, pb - r.range(0.4, 1.4)] : [pa, pb];
        f.box('stone', x0 - 0.2, deck - 0.1, ends[0], x0 + 0.2, deck + 0.95, ends[1], { color: STONE, col: 'stone' });
        f.box('ashlar', x0 - 0.26, deck + 0.95, ends[0], x0 + 0.26, deck + 1.07, ends[1], { color: RING });
        for (let z = ends[0] + 1.5; z < ends[1] - 1; z += 3.5) f.cover(sx * (W / 2 - 0.85), deck, z, sx, 0, 'low');
      }
      // String course along the faces.
      for (const sx of [-1, 1]) f.box('ashlar', sx * (W / 2 - 0.02) - 0.06, deck - 0.32, pa, sx * (W / 2 - 0.02) + 0.06, deck - 0.12, pb, { color: RING });
    }
    // Arch rings (voussoirs) on both faces.
    for (const [a0, a1] of arches) {
      if (destroyed && a0 >= gap[0] - 0.1 && a1 <= gap[1] + 0.1) continue;
      const inner = segArch(a0, a1, spring, crown - spring);
      const outerR = segArch(a0 - 0.45, a1 + 0.45, spring - 0.05, crown - spring + 0.5);
      const sh = new THREE.Shape();
      sh.moveTo(outerR[0][0], outerR[0][1]);
      for (const [z, y] of outerR) sh.lineTo(z, y);
      for (let i = inner.length - 1; i >= 0; i--) sh.lineTo(inner[i][0], inner[i][1]);
      for (const sx of [-1, 1]) {
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false });
        // Shape x -> z, shape y -> y, extrusion -> -x; the ring stands 3 cm proud of the face.
        const xo = sx > 0 ? W / 2 + 0.03 : -W / 2 + 0.05;
        const m = new THREE.Matrix4().set(0, 0, -1, xo, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
        f.geometry('ashlar', g, m, { color: RING });
      }
    }
    // Piers with pointed cutwaters (up- and downstream), and their colliders.
    for (const pz of [-span / 2 - pier / 2, span / 2 + pier / 2]) {
      for (const sx of [-1, 1]) {
        const nose = [
          [sx * (W / 2), pz - pier / 2],
          [sx * (W / 2 + 1.3), pz],
          [sx * (W / 2), pz + pier / 2],
        ];
        f.prism('stone', nose, bottom, spring + 0.9, { color: STONE, top: false });
        // Sloped cap on the cutwater.
        f.tris('ashlar', [[sx * (W / 2), spring + 0.9, pz - pier / 2], [sx * (W / 2 + 1.3), spring + 0.9, pz], [sx * (W / 2), spring + 0.9, pz + pier / 2], [sx * (W / 2), spring + 1.6, pz]], sx > 0 ? [[0, 3, 1], [1, 3, 2]] : [[0, 1, 3], [1, 2, 3]], { color: RING });
      }
      f.collider(0, (bottom + crown) / 2, pz, W / 2 + 0.6, (crown - bottom) / 2, pier / 2, null, 'stone', FLAG_DEFAULT, true);
    }
    // Abutment colliders (solid masonry at both ends below the deck).
    for (const [a, b] of [[z0, arches[0][0]], [arches[2][1], z1]]) f.collider(0, (bottom + deck - 0.8) / 2, (a + b) / 2, W / 2, (deck - 0.8 - bottom) / 2, (b - a) / 2, null, 'stone', FLAG_DEFAULT, false);
    // Gentle approach ramps where the road meets the deck.
    const hf = ctx.hf;
    for (const [zEnd, dir] of [[z0, -1], [z1, 1]]) {
      const zFar = zEnd + dir * 4;
      const pFar = f.toWorld(0, 0, zFar);
      const gFar = hf.getHeight(pFar[0], pFar[2]);
      if (deck - gFar > 0.05) {
        f.slab('cobble', 0, deck, zEnd, 0, gFar + 0.02, zFar, W - 0.1, 0.5, { color: rgb(0.9, 0.88, 0.85), faces: { ny: null } });
        rampCollider(f, 0, deck, zEnd, 0, gFar + 0.02, zFar, W - 0.1, 0.3, 'stone');
      }
    }
    // The blown span: rubble in the river, a fallen deck slab, broken stones.
    if (destroyed) {
      const zc = (gap[0] + gap[1]) / 2;
      rubblePile(f, -0.5, wy - 1.6, zc, 3.2, 2.6, 1.95, { seed: r.int(0, 1e6), beams: 0, palette: ['stone', 'ashlar', 'cobble'] });
      rubblePile(f, 2.4, wy - 1.8, zc + 2.6, 2.0, 1.8, 1.7, { seed: r.int(0, 1e6), beams: 0, palette: ['stone', 'ashlar'] });
      rubblePile(f, -2.6, wy - 1.8, zc - 2.4, 2.2, 1.7, 1.6, { seed: r.int(0, 1e6), beams: 0, palette: ['stone', 'ashlar'] });
      // Fallen slab: from the broken deck end down onto the rubble (walkable, ~30 degrees).
      const top = [0.6, deck - 0.01, gap[0] - 0.15];
      const low = [0.2, wy + 0.25, gap[0] + 3.4];
      f.slab('stone', top[0], top[1], top[2], low[0], low[1], low[2], 3.0, 0.55, { color: scale(STONE, 0.92) });
      f.slab('cobble', top[0], top[1] + 0.01, top[2], low[0], low[1] + 0.01, low[2], 2.9, 0.04, { color: rgb(0.85, 0.83, 0.8) });
      rampCollider(f, top[0], top[1], top[2], low[0], low[1], low[2], 3.0, 0.3, 'stone');
      const top2 = [-0.8, deck - 0.01, gap[1] + 0.15];
      const low2 = [-0.4, wy + 0.1, gap[1] - 3.6];
      f.slab('stone', top2[0], top2[1], top2[2], low2[0], low2[1], low2[2], 2.6, 0.55, { color: scale(STONE, 0.9), roll: 0.12 });
      rampCollider(f, top2[0], top2[1], top2[2], low2[0], low2[1], low2[2], 2.6, 0.3, 'stone');
      scatter(f, 0, wy + 0.1, zc, 4.5, 26, { seed: r.int(0, 1e6), palette: ['stone', 'ashlar'] });
      f.door(0, zc, 4, 0, { kind: 'ford', y: wy });
    }
    const pc = f.toWorld(0, deck, 0);
    out.push({
      road: br.road,
      kind: br.kind,
      x: +pc[0].toFixed(2),
      z: +pc[2].toFixed(2),
      yaw: +br.yaw.toFixed(4),
      deckY: +deck.toFixed(2),
      waterY: +wy.toFixed(2),
      width: W,
      length: +(z1 - z0).toFixed(1),
      ends: [f.toWorld(0, deck, z0), f.toWorld(0, deck, z1)].map((p) => ({ x: +p[0].toFixed(2), y: +p[1].toFixed(2), z: +p[2].toFixed(2) })),
      gap: gap ? [f.toWorld(0, deck, gap[0]), f.toWorld(0, deck, gap[1])].map((p) => ({ x: +p[0].toFixed(2), z: +p[2].toFixed(2) })) : null,
    });
  }
  return out;
}

// Broken edge from (z, yA) to (z, yB) with random notches (dir = which side is open).
function jagged(sh, z, yA, yB, r, dir) {
  const n = 7;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const y = yA + (yB - yA) * t;
    sh.lineTo(z + dir * r.range(-0.15, 0.9) * (1 - Math.abs(0.5 - t)), y);
  }
  sh.lineTo(z, yB);
}
