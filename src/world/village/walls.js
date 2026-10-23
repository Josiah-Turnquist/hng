// Free-standing walls between and behind houses: rubble-stone garden walls with
// coping stones, low walls (murets) and wooden fences, with gates. Walls follow the
// ground in short stepped sections.
import { RNG } from '../../core/math.js';
import { FLAG_SOLID } from '../../physics/collision.js';
import { PAINTS, WOOD, rgb, scale } from './materials.js';

const COPING = rgb(0.9, 0.88, 0.84);

export function buildWalls(B, plan, ctx) {
  const hf = ctx.hf;
  for (const w of plan.walls) {
    const r = new RNG(w.seed ?? 1);
    const pts = w.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i],
        [x1, z1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.3) continue;
      // Gate interval on this segment.
      let gate = null;
      if (w.gate && w.gate.seg === i && len > w.gate.w + 1.2) {
        const c = Math.min(Math.max(w.gate.t * len, w.gate.w / 2 + 0.5), len - w.gate.w / 2 - 0.5);
        gate = [c - w.gate.w / 2, c + w.gate.w / 2];
      }
      const yaw = Math.atan2(-(z1 - z0), x1 - x0); // frame yaw so local +x runs along the segment
      const f = B.frame(x0, 0, z0, yaw, { tag: 'wall' });
      const pieces = gate ? [[0, gate[0]], [gate[1], len]] : [[0, len]];
      for (const [a, b] of pieces) {
        if (b - a < 0.2) continue;
        if (w.kind === 'fence') fence(f, r, a, b, w.h, hf, x0, z0, x1, z1, len);
        else stoneWall(f, r, a, b, w.kind === 'low' ? 0.9 : w.h, hf, x0, z0, x1, z1, len, w.kind);
      }
      if (gate) gateLeaf(f, r, gate, w, hf, x0, z0, x1, z1, len);
    }
  }
}

function groundAt(hf, x0, z0, x1, z1, len, u) {
  const t = u / len;
  return hf.getHeight(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
}

function stoneWall(f, r, a, b, h, hf, x0, z0, x1, z1, len, kind) {
  const T = kind === 'low' ? 0.42 : 0.48;
  const n = Math.max(1, Math.ceil((b - a) / 3.5));
  const tint = rgb(0.95 + r.range(-0.05, 0.03), 0.93, 0.88);
  for (let k = 0; k < n; k++) {
    const ua = a + ((b - a) * k) / n,
      ub = a + ((b - a) * (k + 1)) / n;
    const g0 = groundAt(hf, x0, z0, x1, z1, len, ua),
      g1 = groundAt(hf, x0, z0, x1, z1, len, ub),
      gm = groundAt(hf, x0, z0, x1, z1, len, (ua + ub) / 2);
    const lo = Math.min(g0, g1, gm) - 0.35;
    const top = gm + h;
    f.box('stone', ua, lo, -T / 2, ub, top, T / 2, { color: tint, col: 'stone', uv: 'frame' });
    // Rounded coping (a ridge of stones on edge).
    f.box('ashlar', ua - 0.01, top, -T / 2 - 0.04, ub + 0.01, top + 0.1, T / 2 + 0.04, { color: COPING });
    if (kind !== 'low') f.obox('stone', (ua + ub) / 2, top + 0.13, 0, (ub - ua) / 2, 0.08, 0.08, { rot: { roll: 0, pitch: Math.PI / 4 }, uv: 'box', color: scale(tint, 0.9) });
    // Cover on both sides.
    if (ub - ua > 1.2) {
      const um = (ua + ub) / 2;
      for (const s of [-1, 1]) f.cover(um, gm - f.oy, s * (T / 2 + 0.45), 0, -s, h < 1.35 ? 'low' : 'high');
    }
  }
}

function fence(f, r, a, b, h, hf, x0, z0, x1, z1, len) {
  const col = r.chance(0.5) ? WOOD.weathered : scale(PAINTS.cream, 0.9);
  const step = 2.0;
  const n = Math.max(1, Math.round((b - a) / step));
  for (let k = 0; k <= n; k++) {
    const u = a + ((b - a) * k) / n;
    const g = groundAt(hf, x0, z0, x1, z1, len, u);
    f.box('wood', u - 0.05, g - 0.3, -0.05, u + 0.05, g + h + 0.08, 0.05, { color: col });
  }
  for (let k = 0; k < n; k++) {
    const ua = a + ((b - a) * k) / n,
      ub = a + ((b - a) * (k + 1)) / n;
    const ga = groundAt(hf, x0, z0, x1, z1, len, ua),
      gb = groundAt(hf, x0, z0, x1, z1, len, ub);
    const broken = r.chance(0.12);
    for (const fy of [0.35, h - 0.12]) {
      if (broken && fy > 0.5) continue;
      f.slab('wood', ua, ga + fy, 0.07, ub, gb + fy, 0.07, 0.025, 0.12, { color: col, center: true });
    }
    // Pickets.
    for (let u = ua + 0.12; u < ub - 0.05; u += 0.24) {
      if (broken && r.chance(0.5)) continue;
      const g = ga + ((gb - ga) * (u - ua)) / (ub - ua);
      f.box('wood', u - 0.045, g + 0.05, 0.085, u + 0.045, g + h - (r.chance(0.1) ? 0.4 : 0), 0.105, { color: col });
    }
    const gm = (ga + gb) / 2;
    f.collider((ua + ub) / 2, gm + h / 2, 0.05, (ub - ua) / 2, h / 2, 0.06, null, 'plank', FLAG_SOLID, true);
  }
}

function gateLeaf(f, r, gate, w, hf, x0, z0, x1, z1, len) {
  const [a, b] = gate;
  const g = groundAt(hf, x0, z0, x1, z1, len, (a + b) / 2);
  const h = Math.min(1.4, w.kind === 'fence' ? 1.1 : w.h);
  const col = PAINTS[['green', 'greyblue', 'oxblood', 'cream', 'brown'][r.int(0, 4)]];
  // Pillars for stone walls.
  if (w.kind !== 'fence') {
    for (const u of [a - 0.2, b + 0.2]) {
      f.box('ashlar', u - 0.22, g - 0.3, -0.3, u + 0.22, g + h + 0.35, 0.3, { color: COPING, col: 'stone' });
      f.box('ashlar', u - 0.27, g + h + 0.35, -0.35, u + 0.27, g + h + 0.45, 0.35, { color: COPING });
    }
  }
  // Leaf swung open on its hinge at u = a.
  const lw = b - a - 0.06;
  const ang = r.range(1.4, 1.75) * (r.chance(0.5) ? 1 : -1);
  const cu = a + 0.03 + (lw / 2) * Math.cos(ang),
    cw = -(lw / 2) * Math.sin(ang);
  f.obox('paint', cu, g + 0.12 + (h - 0.2) / 2, cw, lw / 2, (h - 0.2) / 2, 0.025, { color: col, rot: { yaw: ang }, uv: 'box' });
  const p = f.toWorld((a + b) / 2, 0, 0);
  f.b.doors.push({ x: +p[0].toFixed(2), z: +p[2].toFixed(2), y: +g.toFixed(2), yaw: +f.yaw.toFixed(4), width: +(b - a).toFixed(2), kind: 'gate' });
}
