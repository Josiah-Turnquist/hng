// The Place de l'Eglise: a stone fountain, the WW1 war memorial (monument aux morts),
// benches, the cafe terrace and street name plaques. Plane trees come from trees.js.
import * as THREE from 'three';
import { RNG } from '../../core/math.js';
import { FLAG_BULLET, FLAG_SOLID } from '../../physics/collision.js';
import { mat4 } from './geom.js';
import { rgb } from './materials.js';

const ASH = rgb(0.97, 0.95, 0.9);
const ASH_D = rgb(0.86, 0.84, 0.8);

export function buildSquare(B, plan, ctx) {
  const sq = plan.square;
  if (!sq) return;
  const hf = ctx.hf;
  const fr = sq.frame;
  const at = (lx, lz) => {
    const c = Math.cos(fr.yaw),
      s = Math.sin(fr.yaw);
    return [fr.x + c * lx + s * lz, fr.z - s * lx + c * lz];
  };
  // Fountain.
  {
    const [x, z] = at(sq.fountain.lx, sq.fountain.lz);
    const f = B.frame(x, hf.getHeight(x, z), z, fr.yaw, { tag: 'fountain' });
    const R = 2.3,
      t = 0.32,
      h = 0.62;
    const n = 8;
    const Rc = R - t / 2 / Math.cos(Math.PI / n);
    const ext = (t / 2) * Math.tan(Math.PI / n) + 0.01;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2 + Math.PI / n,
        a1 = ((k + 1) / n) * Math.PI * 2 + Math.PI / n;
      const p0 = [Rc * Math.cos(a0), -Rc * Math.sin(a0)],
        p1 = [Rc * Math.cos(a1), -Rc * Math.sin(a1)];
      const dx = p1[0] - p0[0],
        dz = p1[1] - p0[1];
      const l = Math.hypot(dx, dz);
      const ux = dx / l,
        uz = dz / l;
      const w = f.wall(p0[0] - ux * ext, p0[1] - uz * ext, p1[0] + ux * ext, p1[1] + uz * ext, { thick: t, base: -0.3, height: h + 0.3, mat: 'ashlar', inner: 'ashlar', col: 'stone', color: ASH });
      w.build({ groundV: 0.25 });
      w.box('ashlar', -0.02, h + 0.3, -t / 2 - 0.05, w.len + 0.02, h + 0.4, t / 2 + 0.05, { color: ASH_D });
      // Cover behind the basin wall, outside.
      const pc = w.p(w.len / 2, 0, t / 2 + 0.5);
      f.cover(pc[0], 0, pc[2], -w.nx, -w.nz, 'low');
    }
    // Water and basin floor.
    const oct = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.PI / n;
      oct.push([(R - t) * Math.cos(a) / Math.cos(Math.PI / n), -((R - t) * Math.sin(a)) / Math.cos(Math.PI / n)]);
    }
    f.prism('water', oct, -0.1, h - 0.18, { color: [1, 1, 1] });
    // Central column with a small upper basin and spouts.
    f.box('ashlar', -0.42, 0, -0.42, 0.42, 0.7, 0.42, { color: ASH_D, col: 'stone' });
    f.geometry('ashlar', new THREE.CylinderGeometry(0.22, 0.26, 1.5, 10), mat4(0, 1.45, 0), { color: ASH });
    f.geometry('ashlar', new THREE.CylinderGeometry(0.75, 0.45, 0.28, 12), mat4(0, 2.1, 0), { color: ASH_D });
    f.geometry('ashlar', new THREE.SphereGeometry(0.2, 10, 6), mat4(0, 2.6, 0), { color: ASH });
    f.collider(0, 1.3, 0, 0.3, 1.3, 0.3, null, 'stone', undefined, false);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      f.beam('iron', 0.2 * Math.cos(a), 1.15, 0.2 * Math.sin(a), 0.55 * Math.cos(a), 1.05, 0.55 * Math.sin(a), 0.04, 0.04);
    }
  }
  // War memorial.
  {
    const [x, z] = at(sq.memorial.lx, sq.memorial.lz);
    const f = B.frame(x, hf.getHeight(x, z), z, fr.yaw, { tag: 'memorial' });
    const steps = [[1.7, 0.18], [1.4, 0.36], [1.1, 0.54]];
    for (const [hw, top] of steps) f.box('ashlar', -hw, -0.3, -hw, hw, top, hw, { color: ASH_D, col: 'stone', nav: top < 0.3 ? false : true });
    f.box('ashlar', -0.75, 0.54, -0.75, 0.75, 2.3, 0.75, { color: ASH, col: 'stone' });
    f.box('ashlar', -0.86, 2.3, -0.86, 0.86, 2.48, 0.86, { color: ASH_D });
    // Obelisk.
    const ob = new THREE.CylinderGeometry(0.3 * Math.SQRT2, 0.5 * Math.SQRT2, 3.4, 4, 1);
    f.geometry('ashlar', ob, mat4(0, 2.48 + 1.7, 0, Math.PI / 4), { color: ASH });
    const tip = new THREE.ConeGeometry(0.3 * Math.SQRT2, 0.45, 4);
    f.geometry('ashlar', tip, mat4(0, 2.48 + 3.4 + 0.225, 0, Math.PI / 4), { color: ASH });
    f.collider(0, 2.48 + 1.7, 0, 0.42, 1.7, 0.42, null, 'stone', undefined, false);
    // Plaque (front) and bronze palm and croix de guerre.
    const rc = ctx.atlas.memorial;
    const zf = 0.752;
    f.quad('signs', [-0.6, 0.72, zf], [0.6, 0.72, zf], [0.6, 2.32, zf], [-0.6, 2.32, zf], rc);
    const wreath = new THREE.TorusGeometry(0.26, 0.05, 6, 14);
    f.geometry('bronze', wreath, mat4(0, 3.7, 0.43, 0, 0, 0), {});
    f.box('bronze', -0.05, 3.45, 0.38, 0.05, 3.95, 0.46);
    f.box('bronze', -0.2, 3.65, 0.38, 0.2, 3.75, 0.46);
    // Chain fence on four posts.
    for (const [px, pz] of [[-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2]]) {
      f.box('ashlar', px - 0.1, -0.2, pz - 0.1, px + 0.1, 0.75, pz + 0.1, { color: ASH_D });
      f.geometry('ashlar', new THREE.SphereGeometry(0.11, 8, 5), mat4(px, 0.8, pz), { color: ASH_D });
    }
    for (const [a, b] of [[[-2.2, -2.2], [2.2, -2.2]], [[2.2, -2.2], [2.2, 2.2]], [[2.2, 2.2], [-2.2, 2.2]], [[-2.2, 2.2], [-2.2, -2.2]]]) {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      f.beam('iron', a[0], 0.65, a[1], m[0], 0.45, m[1], 0.02, 0.02);
      f.beam('iron', m[0], 0.45, m[1], b[0], 0.65, b[1], 0.02, 0.02);
    }
    f.cover(0, 0, -1.6, 0, 1, 'high');
    f.cover(0, 0, 1.6, 0, -1, 'high');
  }
  // Street plaque on the stair turret's east face (blue enamel, 0.8 x 0.15 m).
  {
    const ch = plan.church;
    const f = B.frame(ch.x, ch.floorY, ch.z, ch.yaw);
    const rc = ctx.atlas.streetPlace;
    const x = -2.185;
    f.quad('signs', [x, 2.7, 1.45], [x, 2.7, 0.65], [x, 2.85, 0.65], [x, 2.85, 1.45], rc);
  }
}

// Props that belong to the square / cafe: tables with chairs and benches (merged).
export function buildFurniture(B, plan, ctx) {
  const hf = ctx.hf;
  for (const p of plan.props) {
    if (p.kind !== 'table' && p.kind !== 'bench') continue;
    const f = B.frame(p.x, hf.getHeight(p.x, p.z), p.z, p.yaw, { tag: p.kind });
    if (p.kind === 'table') {
      const c = rgb(0.25, 0.27, 0.25);
      f.geometry('iron', new THREE.CylinderGeometry(0.36, 0.36, 0.03, 14), mat4(0, 0.72, 0), { color: c });
      f.box('iron', -0.025, 0, -0.025, 0.025, 0.72, 0.025, { color: c });
      f.geometry('iron', new THREE.CylinderGeometry(0.22, 0.24, 0.03, 10), mat4(0, 0.02, 0), { color: c });
      f.collider(0, 0.4, 0, 0.3, 0.38, 0.3, null, 'steel', FLAG_SOLID, false);
      const r = new RNG(Math.floor(p.x * 100 + p.z));
      for (let k = 0; k < p.chairs; k++) {
        const a = (k / Math.max(1, p.chairs)) * Math.PI * 2 + r.range(-0.4, 0.4);
        const cx = Math.cos(a) * 0.7,
          cz = Math.sin(a) * 0.7;
        const fallen = r.chance(0.3);
        const cf = f.sub(cx, 0, cz, -a + Math.PI / 2);
        if (fallen) {
          cf.obox('wood', 0, 0.2, 0, 0.21, 0.02, 0.21, { rot: { pitch: 1.4 }, color: rgb(0.55, 0.4, 0.28), uv: 'box' });
        } else {
          cf.box('wood', -0.21, 0.44, -0.21, 0.21, 0.47, 0.21, { color: rgb(0.55, 0.4, 0.28) });
          cf.box('wood', -0.21, 0.47, 0.17, 0.21, 0.9, 0.2, { color: rgb(0.55, 0.4, 0.28) });
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) cf.box('iron', sx * 0.18 - 0.012, 0, sz * 0.18 - 0.012, sx * 0.18 + 0.012, 0.44, sz * 0.18 + 0.012, { color: c });
        }
      }
    } else {
      const c = rgb(0.5, 0.36, 0.24);
      for (const z of [-0.18, 0.0, 0.18]) f.box('wood', -0.9, 0.44, z - 0.07, 0.9, 0.48, z + 0.07, { color: c });
      for (const y of [0.62, 0.8]) f.box('wood', -0.9, y, 0.27, 0.9, y + 0.1, 0.3, { color: c });
      for (const sx of [-0.75, 0.75]) {
        f.box('iron', sx - 0.03, 0, -0.22, sx + 0.03, 0.44, 0.22, { color: rgb(0.2, 0.2, 0.2) });
        f.box('iron', sx - 0.03, 0.44, 0.24, sx + 0.03, 0.92, 0.3, { color: rgb(0.2, 0.2, 0.2) });
      }
      f.collider(0, 0.24, 0, 0.9, 0.24, 0.27, null, 'wood', FLAG_SOLID | FLAG_BULLET, false);
    }
  }
}

// Village entry boards on the main road (white with a red border) on two posts.
export function buildSigns(B, plan, ctx) {
  for (const sg of plan.signs || []) {
    if (sg.kind !== 'entry') continue;
    const f = B.frame(sg.x, ctx.hf.getHeight(sg.x, sg.z), sg.z, sg.yaw, { tag: 'sign' });
    for (const x of [-0.5, 0.5]) f.box('iron', x - 0.03, -0.3, -0.03, x + 0.03, 2.3, 0.03, { color: rgb(0.35, 0.35, 0.33) });
    f.box('paint', -0.66, 1.66, -0.06, 0.66, 2.24, -0.03, { color: rgb(0.9, 0.9, 0.88) });
    const rc = ctx.atlas.entry;
    f.quad('signs', [-0.62, 1.7, 0.0], [0.62, 1.7, 0.0], [0.62, 2.2, 0.0], [-0.62, 2.2, 0.0], rc);
    f.quad('signs', [0.62, 1.7, -0.09], [-0.62, 1.7, -0.09], [-0.62, 2.2, -0.09], [0.62, 2.2, -0.09], rc);
  }
}
