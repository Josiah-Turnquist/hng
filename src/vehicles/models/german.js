// German vehicles. Conventions (vkit.js): meters, +X right, +Y up, -Z forward; origin on the
// ground at the middle of the wheelbase (wheeled) or of the track contact length (tracked).
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { DEG, ribbon, roundRect, arc, circle, torusProfile, section, mirrorHalf, eulerFromTo, slotV } from './vkit.js';
import { jeepWheel, roadWheel, sprocket, runningGear, steeringWheel } from './parts.js';

const side = (s) => (s < 0 ? 'L' : 'R');

// A round cable, hose or bent bar through the points pts ([x, y, z]): one skin, mitred at
// the bends, open at the ends (end it inside an eye or a fitting).
function cable(b, pts, r, mat, seg = 6) {
  const P = pts.map((p) => new Vector3(p[0], p[1], p[2]));
  const n = P.length;
  const pos = [],
    idx = [];
  const d0 = new Vector3(),
    d1 = new Vector3(),
    t = new Vector3(),
    nrm = new Vector3(0, 1, 0),
    bin = new Vector3();
  for (let i = 0; i < n; i++) {
    d0.subVectors(P[i], P[Math.max(0, i - 1)]).normalize();
    d1.subVectors(P[Math.min(n - 1, i + 1)], P[i]).normalize();
    t.addVectors(d0, d1).normalize();
    if (Math.abs(nrm.dot(t)) > 0.95) nrm.set(t.y, t.z, t.x);
    nrm.addScaledVector(t, -nrm.dot(t)).normalize();
    bin.crossVectors(t, nrm);
    const k = r / Math.max(0.6, t.dot(i < n - 1 ? d1 : d0)); // wider across a mitre
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2,
        c = Math.cos(a) * k,
        q = Math.sin(a) * k;
      pos.push(P[i].x + nrm.x * c + bin.x * q, P[i].y + nrm.y * c + bin.y * q, P[i].z + nrm.z * c + bin.z * q);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j,
        c = i * seg + ((j + 1) % seg);
      idx.push(a, c, a + seg, c, c + seg, a + seg);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return b.add(geo, mat);
}

// A flat block on a sloping surface: from the point o it spans a[0]..a[1] along u, c[0]..c[1]
// along v and h[0]..h[1] off the surface along nrm (unit vectors, square to each other).
function slab(b, o, u, v, nrm, a, c, h, mat) {
  const pts = [];
  for (const i of a) for (const j of c) for (const k of h) pts.push([0, 1, 2].map((q) => o[q] + u[q] * i + v[q] * j + nrm[q] * k));
  return b.convex({ points: pts, mat });
}

// A row of n spare track links on a plate: the row starts at o and runs along u, each link
// is w wide along v and stands t off the plate along nrm: three pads with the tooth openings
// between them, tied by the cleat.
function spareLinks(b, o, u, v, nrm, { n, pitch, w, t = 0.05 }) {
  for (let i = 0; i < n; i++) {
    const a = i * pitch,
      g = pitch * 0.1;
    for (const [c0, c1] of [
      [0, 0.16],
      [0.26, 0.74],
      [0.84, 1],
    ])
      slab(b, o, u, v, nrm, [a + g, a + pitch - g], [c0 * w, c1 * w], [0, t * 0.6], 'track');
    slab(b, o, u, v, nrm, [a + pitch * 0.36, a + pitch * 0.64], [0, w], [t * 0.15, t], 'track');
  }
}

// ---------------------------------------------------------------------------------------
// Panzerkampfwagen IV Ausf. H (1943): 7.5 cm KwK 40 L/48 with a double-baffle muzzle brake,
// 8 road wheels a side on 4 leaf-spring bogies, 4 return rollers, front drive sprocket
// (20 teeth), rear idler, Kgs 61/400/120 track (99 links). Schürzen (5 mm) on the hull and
// 8 mm skirts around the turret, commander's cupola. 7.02 m long with the gun (hull 5.89),
// 2.88 m wide (3.33 with skirts), 2.68 m high; 25 t. Turret offset 66 mm to the left.
// Armor: nose and superstructure front 80 mm (14 / 9 deg), glacis 25 mm at 72 deg, sides
// 30 mm, rear 20 mm, roof 16 / 10 mm, belly 10 mm; turret front 50 mm, mantlet 50 mm,
// sides 30 mm at 25 deg, rear 30 mm, roof 16 / 10 mm, cupola 50 mm.
export function panzer4_h(b) {
  const P = 'dunkelgelb',
    Cst = 'castGerman';
  // ---- Running gear -------------------------------------------------------------------------
  const T = 0.04,
    RW = 0.235,
    yW = RW + T,
    OX = 1.2;
  const bogies = [-1.545, -0.515, 0.515, 1.545];
  const wheels = [];
  for (const zc of bogies) wheels.push([zc - 0.25, yW], [zc + 0.25, yW]);
  const rollers = [-1.36, -0.45, 0.45, 1.36].map((z) => [z, 0.81]);
  const SPR = { z: -2.5, y: 0.555 },
    IDL = { z: 2.36, y: 0.6 };
  runningGear(b, {
    wheels,
    wheel: roadWheel({ r: RW, width: 0.24, gap: 0.07, tire: 0.04, dish: 0.025, hubR: 0.065, hubLen: 0.05, mat: P, bolts: 8 }),
    wheelR: RW,
    rollers,
    roller: roadWheel({ r: 0.11, width: 0.15, gap: 0.04, tire: 0.025, dish: 0.012, hubR: 0.045, hubLen: 0.035, mat: P }),
    rollerR: 0.11,
    sprocket: { ...SPR, r: 0.3835, teeth: 20, items: sprocket({ n: 20, r0: 0.355, r1: 0.418, ringGap: 0.2, t: 0.035, drumR: 0.3, hubR: 0.14, hubLen: 0.1, mat: P, bolts: 10, tooth: 0.5, tip: 0.18 }) },
    idler: { ...IDL, r: 0.27 + T / 2, items: roadWheel({ r: 0.27, width: 0.2, gap: 0.06, rubber: false, dish: 0.03, hubR: 0.075, hubLen: 0.05, mat: P, holes: 6 }) },
    track: { width: 0.4, pitch: 0.12, thick: T, offsetX: OX, realLinks: 99 },
  });
  for (const s of [-1, 1]) {
    // Leaf-spring bogies: bracket on the hull side, two swing arms, quarter-elliptic spring.
    for (const zc of bogies) {
      b.box({ x: s * 0.93, y: 0.42, z: zc, w: 0.18, h: 0.2, d: 0.26, r: 0.02, mat: P });
      for (const d of [-1, 1]) b.rod({ from: [s * 1.02, 0.37, zc + d * 0.06], to: [s * 1.06, yW, zc + d * 0.25], r: 0.035, mat: P });
      const line = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        line.push([zc - 0.26 + 0.52 * t, 0.555 - 0.05 * (2 * t - 1) ** 2]);
      }
      b.prismX({ points: ribbon(line, 0.045), x0: s * 0.99, x1: s * 1.07, mat: 'black', bevel: 0.005 });
      b.box({ x: s * 1.0, y: 0.5, z: zc, w: 0.12, h: 0.1, d: 0.1, r: 0.015, mat: P });
    }
    // Return roller brackets, final drive housing, idler crank.
    for (const [z, y] of rollers) b.cylAxis({ axis: 'x', x: s * 0.97, y, z, len: 0.26, r: 0.035, mat: P, seg: 10 });
    b.cylAxis({ axis: 'x', x: s * 0.93, y: SPR.y, z: SPR.z, len: 0.16, r: 0.2, mat: Cst, seg: 20 });
    b.convex({
      points: [
        [s * 0.84, 0.48, IDL.z + 0.08],
        [s * 0.84, 0.82, IDL.z + 0.12],
        [s * 0.84, 0.62, IDL.z - 0.28],
        [s * 1.06, 0.66, IDL.z],
        [s * 1.06, 0.54, IDL.z],
        [s * 1.06, 0.6, IDL.z - 0.07],
      ],
      mat: P,
    });
  }

  // ---- Hull ---------------------------------------------------------------------------------
  // Lower hull between the tracks: lower nose plate, 80 mm nose plate, glacis.
  b.prismX({
    points: [
      [-2.45, 0.4],
      [2.42, 0.4],
      [2.65, 0.8],
      [2.65, 1.01],
      [-2.4, 1.01],
      [-2.4, 1.14],
      [-2.84, 1.0],
      [-2.92, 0.67],
    ],
    x0: -0.84,
    x1: 0.84,
    mat: P,
    bevel: 0.012,
  });
  // Superstructure over the tracks with the 80 mm front plate; engine deck a step lower.
  b.prismX({
    points: [
      [-2.42, 1.0],
      [2.65, 1.0],
      [2.65, 1.55],
      [2.52, 1.72],
      [0.8, 1.72],
      [0.74, 1.8],
      [-2.295, 1.8],
    ],
    x0: -1.15,
    x1: 1.15,
    mat: P,
    bevel: 0.012,
  });
  // Fenders with hinged mud flaps front and rear, a stay from the nose to each front corner.
  for (const s of [-1, 1]) {
    b.span({ z0: -2.84, z1: 2.68, y0: 0.99, y1: 1.0, w: 0.33, x: s * 1.285, mat: P, r: 0.003 });
    b.span({ z0: -2.84, z1: -2.4, y0: 0.99, y1: 1.0, w: 0.32, x: s * 0.98, mat: P, r: 0.003 });
    b.prismX({
      points: ribbon(
        [
          [-2.83, 0.99],
          [-2.93, 0.975],
          [-2.995, 0.87],
        ],
        -0.01,
      ),
      x0: s * 0.86,
      x1: s * 1.45,
      mat: P,
      bevel: 0.003,
      bevelSegments: 1,
    });
    b.prismX({
      points: ribbon(
        [
          [2.67, 0.99],
          [2.74, 0.975],
          [2.8, 0.8],
        ],
        0.01,
      ),
      x0: s * 1.0,
      x1: s * 1.45,
      mat: P,
      bevel: 0.003,
      bevelSegments: 1,
    });
    for (const x of [0.98, 1.3]) b.cylAxis({ axis: 'x', x: s * x, y: 1.003, z: -2.835, len: 0.14, r: 0.012, mat: P, seg: 6 });
    b.cylAxis({ axis: 'x', x: s * 1.22, y: 1.003, z: 2.675, len: 0.16, r: 0.012, mat: P, seg: 6 });
    b.rod({ from: [s * 0.84, 0.8, -2.975], to: [s * 1.4, 0.955, -2.975], r: 0.013, mat: P, seg: 5 });
  }
  // Hull sides carried forward past the nose as tow eyes with shackles; tow eyes at the tail.
  for (const s of [-1, 1]) {
    b.prismX({
      points: [
        [-2.55, 0.47],
        [-2.93, 0.685],
        [-3.0, 0.73],
        [-3.0, 0.82],
        [-2.93, 0.9],
        [-2.86, 0.94],
        [-2.55, 0.94],
      ],
      holes: [circle(0.03, 8, -2.95, 0.775)],
      x0: s * 0.765,
      x1: s * 0.846,
      mat: P,
      bevel: 0.006,
      bevelSegments: 1,
    });
    const bow = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI,
        k = 0.05 + 0.055 * Math.sin(a);
      bow.push([s * 0.8055 - 0.055 * Math.cos(a), 0.775 - 0.9 * k, -2.95 - 0.44 * k]);
    }
    cable(b, [[s * 0.8055 - 0.055, 0.775, -2.95], ...bow, [s * 0.8055 + 0.055, 0.775, -2.95]], 0.014, 'steel');
    b.cylAxis({ axis: 'x', x: s * 0.8055, y: 0.775, z: -2.95, len: 0.16, r: 0.018, mat: 'steel', seg: 6 });
    b.prismX({
      points: [
        [2.4, 0.45],
        [2.68, 0.62],
        [2.76, 0.7],
        [2.76, 0.8],
        [2.67, 0.86],
        [2.4, 0.86],
      ],
      holes: [circle(0.03, 8, 2.7, 0.75)],
      x0: s * 0.765,
      x1: s * 0.846,
      mat: P,
      bevel: 0.006,
      bevelSegments: 1,
    });
  }
  // Glacis: brake access hatches with hinges and air intake cowls, three spare track links
  // strapped down between them; a row of spare links across the nose under a holding bar.
  for (const s of [-1, 1]) {
    b.quad({
      p: [
        [s * 0.25, 1.012, -2.79],
        [s * 0.7, 1.012, -2.79],
        [s * 0.7, 1.147, -2.42],
        [s * 0.25, 1.147, -2.42],
      ],
      t: 0.025,
      mat: P,
      out: [0, 1, 0],
    });
    b.box({ x: s * 0.47, y: 1.14, z: -2.6, w: 0.3, h: 0.06, d: 0.16, r: 0.015, mat: P });
    b.box({ x: s * 0.47, y: 1.14, z: -2.682, w: 0.24, h: 0.03, d: 0.004, r: 0, mat: 'dark' });
    for (const x of [0.33, 0.62]) b.box({ x: s * x, y: 1.156, z: -2.42, w: 0.07, h: 0.03, d: 0.06, r: 0, mat: P });
  }
  {
    const run = [0, 0.3032, 0.9529],
      up = [0, 0.9529, -0.3032],
      o = [-0.2, 1.0127, -2.8];
    spareLinks(b, o, run, [1, 0, 0], up, { n: 3, pitch: 0.12, w: 0.4, t: 0.04 });
    for (const c of [0.06, 0.34]) slab(b, o, run, [1, 0, 0], up, [-0.02, 0.38], [c - 0.015, c + 0.015], [0, 0.048], P);
    const nu = [0, 0.9718, 0.2356],
      no = [0, 0.2356, -0.9718],
      q = [-0.66, 0.7, -2.9127];
    spareLinks(b, q, [1, 0, 0], nu, no, { n: 11, pitch: 0.12, w: 0.28, t: 0.04 });
    slab(b, q, [1, 0, 0], nu, no, [-0.04, 1.36], [0.115, 0.165], [0.04, 0.05], P);
    for (const a of [-0.04, 1.335]) slab(b, q, [1, 0, 0], nu, no, [a, a + 0.025], [0.09, 0.19], [0, 0.05], P);
  }
  // Driver's visor in its frame (left) and the ball-mounted MG 34 in its armored ring (right)
  // in the superstructure front plate.
  const fz = (y) => -2.4 + ((y - 1.14) / 0.66) * 0.105; // front plate surface z at height y
  {
    const y = 1.5;
    b.box({ x: -0.5, y, z: fz(y) - 0.012, w: 0.46, h: 0.23, d: 0.04, rx: 0.158, r: 0.01, mat: P });
    b.box({ x: -0.5, y, z: fz(y) - 0.03, w: 0.36, h: 0.16, d: 0.07, r: 0.02, mat: P });
    b.box({ x: -0.5, y: y + 0.01, z: fz(y) - 0.066, w: 0.2, h: 0.022, d: 0.006, r: 0.002, mat: 'dark' });
    b.anchor('driverEye', -0.5, y + 0.01, fz(y) - 0.075); // at the visor slit
    b.latheDir({
      profile: [
        [0.125, 0],
        [0.2, 0],
        [0.2, 0.03],
        [0.16, 0.055],
        [0.125, 0.055],
        [0.125, 0],
      ],
      at: [0.5, y - 0.02, fz(y - 0.02) + 0.005],
      dir: [0, 0.157, -0.9876],
      mat: Cst,
      seg: 16,
    });
    b.sphere({ x: 0.5, y: y - 0.02, z: fz(y) - 0.01, r: 0.14, sz: 0.55, mat: Cst, seg: 18 });
    b.cyl({ z0: fz(y) - 0.08, z1: fz(y) - 0.22, r0: 0.026, x: 0.5, y: y - 0.02, mat: 'blued', seg: 10 });
    b.cyl({ z0: fz(y) - 0.22, z1: fz(y) - 0.26, r0: 0.013, x: 0.5, y: y - 0.02, mat: 'blued', seg: 8 });
    b.anchor('bowMgMuzzle', 0.5, y - 0.02, fz(y) - 0.26);
  }
  // Hull roof hatches for driver and radio operator (coaming, lid, hinges, signal port,
  // handle), headlight, horn.
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.55, y: 1.81, z: -1.85, w: 0.56, h: 0.024, d: 0.54, r: 0.008, mat: P });
    b.box({ x: s * 0.55, y: 1.83, z: -1.85, w: 0.49, h: 0.024, d: 0.47, r: 0.01, mat: P });
    b.cylAxis({ axis: 'y', x: s * 0.55, y: 1.848, z: -1.85, len: 0.016, r: 0.075, mat: P, seg: 12 });
    for (const dx of [-0.15, 0.15]) b.box({ x: s * 0.55 + dx, y: 1.83, z: -2.1, w: 0.07, h: 0.035, d: 0.08, r: 0, mat: P });
    cable(b, [[s * 0.55 - 0.06, 1.84, -1.68], [s * 0.55 - 0.06, 1.87, -1.68], [s * 0.55 + 0.06, 1.87, -1.68], [s * 0.55 + 0.06, 1.84, -1.68]], 0.007, 'steel', 4);
  }
  b.cylAxis({ axis: 'y', x: -1.12, y: 1.06, z: -2.72, len: 0.12, r: 0.02, mat: P, seg: 8 });
  b.cyl({ z0: -2.84, z1: -2.7, r0: 0.085, r1: 0.075, x: -1.12, y: 1.15, mat: P, seg: 16 });
  b.cyl({ z0: -2.846, z1: -2.838, r0: 0.07, x: -1.12, y: 1.15, mat: 'lamp', seg: 16 });
  b.anchor('headlightL', -1.12, 1.15, -2.85);
  // Engine deck: hatches with hinges, handles and air cowls, intake grilles at the sides.
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.45, y: 1.735, z: 1.75, w: 0.7, h: 0.03, d: 1.1, r: 0.01, mat: P });
    b.box({ x: s * 0.45, y: 1.77, z: 1.95, w: 0.4, h: 0.045, d: 0.5, r: 0.012, mat: P });
    b.box({ x: s * 0.45, y: 1.77, z: 2.202, w: 0.34, h: 0.022, d: 0.004, r: 0, mat: 'dark' });
    for (const z of [1.4, 2.1]) b.box({ x: s * 0.81, y: 1.745, z, w: 0.07, h: 0.035, d: 0.1, r: 0, mat: P });
    cable(b, [[s * 0.2, 1.745, 1.34], [s * 0.2, 1.775, 1.34], [s * 0.2, 1.775, 1.46], [s * 0.2, 1.745, 1.46]], 0.007, 'steel', 4);
    b.box({ x: s * 0.98, y: 1.735, z: 1.75, w: 0.25, h: 0.03, d: 1.2, r: 0.01, mat: 'black' });
    for (let i = 0; i < 6; i++) b.box({ x: s * 0.98, y: 1.755, z: 1.25 + i * 0.2, w: 0.26, h: 0.015, d: 0.05, r: 0.004, mat: P });
    // Tow cable hung along the side on three hooks, an eye at each end.
    const cab = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      cab.push([s * 1.168, 1.3 - 0.03 * Math.abs(Math.sin(t * Math.PI * 2)), -1.75 + 2.7 * t]);
    }
    cable(b, cab, 0.014, 'steel', 5);
    for (const z of [-1.75, 0.95]) b.latheDir({ profile: torusProfile(0.04, 0.012, 6), at: [s * 1.168, 1.3, z + Math.sign(z) * 0.05], dir: [1, 0, 0], mat: 'steel', seg: 8 });
    for (const z of [-1.75, -0.4, 0.95]) b.box({ x: s * 1.17, y: 1.31, z, w: 0.04, h: 0.07, d: 0.03, r: 0, mat: P });
  }
  // Left side: gun cleaning rods on the superstructure, crowbar and fire extinguisher on the
  // fender, two spare road wheels in their rack beside the engine.
  for (const y of [1.46, 1.5, 1.54]) b.rod({ from: [-1.17, y, -1.5], to: [-1.17, y, 0.4], r: 0.016, mat: 'wood', seg: 6 });
  for (const z of [-1.2, -0.55, 0.1]) b.box({ x: -1.172, y: 1.5, z, w: 0.045, h: 0.14, d: 0.03, r: 0, mat: P });
  cable(b, [[-1.33, 1.014, -1.9], [-1.33, 1.014, -0.75], [-1.31, 1.02, -0.69], [-1.27, 1.03, -0.66]], 0.012, 'steel', 5);
  for (const z of [-1.7, -0.95]) b.box({ x: -1.33, y: 1.015, z, w: 0.05, h: 0.035, d: 0.03, r: 0, mat: P });
  b.cyl({ z0: -0.35, z1: 0.05, r0: 0.055, x: -1.3, y: 1.065, mat: P, seg: 10 });
  b.cyl({ z0: 0.05, z1: 0.1, r0: 0.03, r1: 0.02, x: -1.3, y: 1.065, mat: 'steel', seg: 8 });
  for (const z of [-0.27, -0.03]) b.box({ x: -1.3, y: 1.06, z, w: 0.125, h: 0.13, d: 0.02, r: 0, mat: P });
  {
    const spare = roadWheel({ r: RW, width: 0.1, tire: 0.04, dish: 0.025, hubR: 0.065, hubLen: 0.025, mat: P, seg: 16 });
    for (const z of [1.42, 1.94]) b.addAll(spare, { x: -1.29, y: 1.0 + RW + 0.022, z });
    b.box({ x: -1.29, y: 1.011, z: 1.68, w: 0.18, h: 0.022, d: 1.06, r: 0, mat: P });
    b.box({ x: -1.375, y: 1.27, z: 1.68, w: 0.012, h: 0.04, d: 1.06, r: 0, mat: P });
    for (const z of [1.16, 1.68, 2.2]) b.box({ x: -1.375, y: 1.14, z, w: 0.012, h: 0.28, d: 0.03, r: 0, mat: P });
  }
  // Right side: wooden antenna trough with the aerial folded down into it, axe, jack block,
  // jack and tool box on the fender.
  b.prismZ({
    points: [
      [1.15, 1.46],
      [1.25, 1.46],
      [1.25, 1.53],
      [1.232, 1.53],
      [1.232, 1.478],
      [1.168, 1.478],
      [1.168, 1.53],
      [1.15, 1.53],
    ],
    z0: -1.0,
    z1: 0.86,
    mat: 'wood',
    bevel: 0,
  });
  b.rod({ from: [1.2, 1.5, 0.93], to: [1.2, 1.495, -0.95], r: 0.007, mat: 'steel', seg: 5 });
  b.cyl({ z0: 0.9, z1: 1.02, r0: 0.032, x: 1.2, y: 1.5, mat: 'rubber', seg: 8 });
  b.box({ x: 1.185, y: 1.5, z: 1.05, w: 0.08, h: 0.09, d: 0.06, r: 0.008, mat: P });
  b.rod({ from: [1.3, 1.018, -1.95], to: [1.3, 1.018, -1.3], r: 0.015, mat: 'wood', seg: 6 });
  b.prismY({
    points: [
      [1.26, -1.94],
      [1.42, -1.97],
      [1.42, -1.85],
      [1.26, -1.88],
    ],
    y0: 1.002,
    y1: 1.03,
    mat: 'steel',
    bevel: 0,
  });
  b.box({ x: 1.3, y: 1.02, z: -1.5, w: 0.05, h: 0.04, d: 0.03, r: 0, mat: P });
  b.box({ x: 1.3, y: 1.065, z: -0.75, w: 0.22, h: 0.13, d: 0.34, r: 0.008, mat: 'wood' });
  for (const z of [-0.85, -0.65]) b.box({ x: 1.3, y: 1.068, z, w: 0.235, h: 0.14, d: 0.025, r: 0, mat: 'steel' });
  b.cyl({ z0: -0.2, z1: 0.25, r0: 0.05, x: 1.3, y: 1.07, mat: P, seg: 10 });
  b.cyl({ z0: 0.25, z1: 0.42, r0: 0.026, x: 1.3, y: 1.07, mat: 'steel', seg: 8 });
  b.box({ x: 1.3, y: 1.07, z: -0.22, w: 0.14, h: 0.14, d: 0.03, r: 0, mat: P });
  b.box({ x: 1.3, y: 1.12, z: 0.0, w: 0.09, h: 0.09, d: 0.1, r: 0.008, mat: P });
  for (const z of [-0.1, 0.18]) b.box({ x: 1.3, y: 1.035, z, w: 0.13, h: 0.07, d: 0.02, r: 0, mat: P });
  b.box({ x: 1.3, y: 1.07, z: 1.6, w: 0.22, h: 0.14, d: 0.5, r: 0.01, mat: P });
  b.box({ x: 1.3, y: 1.145, z: 1.6, w: 0.235, h: 0.015, d: 0.515, r: 0, mat: P });
  // Rear: main muffler in its straps (left), auxiliary muffler (right), tow bracket.
  b.latheDir({
    profile: [
      [0, -0.55],
      [0.1, -0.55],
      [0.15, -0.5],
      [0.15, 0.5],
      [0.1, 0.55],
      [0, 0.55],
    ],
    at: [-0.3, 1.3, 2.82],
    dir: [1, 0, 0],
    mat: 'black',
    seg: 16,
  });
  b.cylAxis({ axis: 'x', x: -0.86, y: 1.3, z: 2.82, len: 0.06, r: 0.05, mat: 'black', seg: 10 });
  for (const s of [-1, 1]) {
    b.cylAxis({ axis: 'x', x: -0.3 + s * 0.38, y: 1.3, z: 2.82, len: 0.045, r: 0.152, mat: P, seg: 16 });
    b.box({ x: -0.3 + s * 0.38, y: 1.3, z: 2.7, w: 0.045, h: 0.08, d: 0.14, r: 0, mat: P });
  }
  b.rod({ from: [-0.3, 1.5, 2.64], to: [-0.3, 1.42, 2.8], r: 0.04, mat: 'black', seg: 8 });
  b.latheDir({
    profile: [
      [0, -0.17],
      [0.045, -0.17],
      [0.072, -0.145],
      [0.072, 0.145],
      [0.045, 0.17],
      [0, 0.17],
    ],
    at: [0.66, 1.26, 2.74],
    dir: [0, 1, 0],
    mat: 'black',
    seg: 12,
  });
  b.cylAxis({ axis: 'y', x: 0.66, y: 1.44, z: 2.74, len: 0.03, r: 0.02, mat: 'black', seg: 6 });
  b.cylAxis({ axis: 'y', x: 0.66, y: 1.26, z: 2.74, len: 0.04, r: 0.077, mat: P, seg: 12 });
  b.box({ x: 0.66, y: 1.26, z: 2.675, w: 0.05, h: 0.04, d: 0.06, r: 0, mat: P });
  b.box({ x: 0, y: 0.75, z: 2.65, w: 0.3, h: 0.16, d: 0.12, r: 0.02, mat: P });
  b.cylAxis({ axis: 'y', x: 0, y: 0.75, z: 2.69, len: 0.2, r: 0.018, mat: 'steel', seg: 6 });
  b.anchor('exhaustL', -0.89, 1.3, 2.82);
  b.anchor('exhaustR', 0.66, 1.45, 2.74);
  // Schürzen: 5 mm plates hooked onto a rail on brackets, a stay from the fender edge to
  // each (separate parts so they can be knocked off).
  for (const s of [-1, 1]) {
    const L = side(s);
    b.part(`skirt${L}`, [s * 1.64, 1.62, 0]);
    for (let i = 0; i < 5; i++) {
      const z0 = -2.36 + i * 0.96,
        z1 = z0 + (i < 4 ? 0.92 : 0.96);
      const cf = i === 0 ? 0.22 : 0.02,
        cr = i === 4 ? 0.22 : 0.02;
      b.prismX({
        points: [
          [z0, 1.59],
          [z0, 0.6 + cf],
          [z0 + cf, 0.6],
          [z1 - cr, 0.6],
          [z1, 0.6 + cr],
          [z1, 1.59],
        ],
        x0: s * 1.642,
        x1: s * 1.648,
        mat: P,
        bevel: 0,
      });
      for (const z of [z0 + 0.18, z1 - 0.18]) {
        b.box({ x: s * 1.651, y: 1.57, z, w: 0.007, h: 0.15, d: 0.05, r: 0, mat: P }); // hanger strap
        b.box({ x: s * 1.632, y: 1.64, z, w: 0.045, h: 0.014, d: 0.05, r: 0, mat: P }); // hooked over the rail
      }
    }
    b.span({ z0: -2.38, z1: 2.44, y0: 1.58, y1: 1.63, w: 0.03, x: s * 1.625, mat: P, r: 0.004 });
    for (let i = 0; i < 6; i++) {
      const z = -2.36 + i * 0.96 - (i === 5 ? 0.02 : 0);
      b.span({ z0: z - 0.02, z1: z + 0.02, y0: 1.56, y1: 1.6, w: 0.48, x: s * 1.39, mat: P, r: 0.004 });
      b.rod({ from: [s * 1.43, 1.0, z], to: [s * 1.612, 1.565, z], r: 0.012, mat: P, seg: 5 });
      b.box({ x: s * 1.54, y: 0.99, z, w: 0.2, h: 0.016, d: 0.03, r: 0, mat: P });
    }
    b.body();
  }

  // ---- Turret (offset 66 mm to the left) --------------------------------------------------
  const xT = -0.066,
    zT = -0.3,
    yR = 1.8;
  b.part('turret', [xT, yR, zT]);
  const base = mirrorHalf([
    [0, -0.95],
    [0.6, -0.95],
    [0.86, -0.4],
    [0.86, 0.45],
    [0.7, 0.88],
    [0, 0.9],
  ]);
  const top = mirrorHalf([
    [0, -0.84],
    [0.5, -0.84],
    [0.6, -0.4],
    [0.6, 0.4],
    [0.5, 0.7],
    [0, 0.72],
  ]);
  const P3 = (o, y) => o.map(([x, dz]) => [xT + x, y, zT + dz]);
  b.convex({ points: [...P3(base, 1.82), ...P3(top, 2.42)], mat: P });
  // Side doors: two leaves a side on hinges, vision port in the front leaf, pistol port in
  // the rear one, a rain strip above.
  for (const s of [-1, 1]) {
    const u = [0, 0, 1],
      v = [-s * 0.3976, 0.9176, 0],
      n = [s * 0.9176, 0.3976, 0],
      o = [xT + s * 0.8253, 1.9, zT - 0.32];
    for (const [a0, a1, hinge] of [
      [0, 0.244, -0.012],
      [0.256, 0.5, 0.512],
    ]) {
      slab(b, o, u, v, n, [a0, a1], [0, 0.436], [-0.01, 0.024], P);
      for (const c of [0.07, 0.31]) slab(b, o, u, v, n, [hinge - 0.03, hinge + 0.03], [c, c + 0.06], [-0.01, 0.036], P);
    }
    slab(b, o, u, v, n, [0.07, 0.18], [0.2, 0.275], [0.024, 0.046], P);
    slab(b, o, u, v, n, [0.085, 0.165], [0.23, 0.245], [0.046, 0.049], 'dark');
    b.latheDir({
      profile: [
        [0, 0.045],
        [0.03, 0.045],
        [0.048, 0.024],
        [0, 0.024],
      ],
      at: [o[0] + v[0] * 0.24, o[1] + v[1] * 0.24, o[2] + 0.38],
      dir: n,
      mat: P,
      seg: 8,
    });
    slab(b, o, u, v, n, [-0.05, 0.55], [0.46, 0.48], [-0.01, 0.03], P);
  }
  // Roof: ventilator, signal port, two lifting hooks.
  b.latheDir({
    profile: [
      [0, 0.05],
      [0.08, 0.05],
      [0.12, 0.03],
      [0.12, 0.015],
      [0.09, 0.015],
      [0.09, 0],
      [0, 0],
    ],
    at: [xT + 0.32, 2.42, zT - 0.5],
    dir: [0, 1, 0],
    mat: P,
    seg: 12,
  });
  b.cylAxis({ axis: 'y', x: xT - 0.3, y: 2.432, z: zT - 0.55, len: 0.03, r: 0.07, mat: P, seg: 10 });
  for (const s of [-1, 1]) b.latheDir({ profile: torusProfile(0.03, 0.01, 6), at: [xT + s * 0.42, 2.425, zT - 0.72], dir: [1, 0, 0], mat: 'steel', seg: 8 });
  // Commander's cupola: vision blocks in their housings, hatch with hinge and handle, MG ring.
  const cz = zT + 0.42;
  b.latheDir({
    profile: [
      [0, 2.41],
      [0.36, 2.41],
      [0.36, 2.47],
      [0.33, 2.49],
      [0.33, 2.6],
      [0.29, 2.63],
      [0.29, 2.66],
      [0, 2.66],
    ].map(([r, y]) => [r, y - 2.41]),
    at: [xT, 2.41, cz],
    dir: [0, 1, 0],
    mat: P,
    seg: 28,
  });
  for (let i = 0; i < 7; i++) {
    const a = Math.PI / 2 + (i / 7) * Math.PI * 2;
    b.box({ x: xT + Math.cos(a) * 0.332, y: 2.55, z: cz - Math.sin(a) * 0.332, w: 0.024, h: 0.075, d: 0.16, ry: a, r: 0, mat: P });
    b.box({ x: xT + Math.cos(a) * 0.342, y: 2.55, z: cz - Math.sin(a) * 0.342, w: 0.012, h: 0.035, d: 0.1, ry: a, r: 0.003, mat: 'dark' });
  }
  b.cylAxis({ axis: 'y', x: xT, y: 2.675, z: cz, len: 0.03, r: 0.25, mat: P, seg: 24 });
  b.box({ x: xT, y: 2.685, z: cz + 0.25, w: 0.14, h: 0.04, d: 0.08, r: 0, mat: P });
  cable(b, [[xT - 0.06, 2.688, cz - 0.1], [xT - 0.06, 2.718, cz - 0.1], [xT + 0.06, 2.718, cz - 0.1], [xT + 0.06, 2.688, cz - 0.1]], 0.007, 'steel', 4);
  b.anchor('commanderEye', xT, 2.88, cz);
  b.meta.anchorParts.commanderEye = 'turret';
  b.latheDir({ profile: torusProfile(0.3, 0.012, 8), at: [xT, 2.68, cz], dir: [0, 1, 0], mat: 'steel', seg: 28 }); // MG ring
  // Turret skirts (8 mm): separate plates on brackets, a two-leaf door a side in line with
  // the turret doors.
  const skirt = [];
  for (const s of [-1, 1])
    skirt.push(
      [s * 1.06, -0.62, s * 1.12, -0.5],
      [s * 1.12, -0.49, s * 1.12, -0.36],
      [s * 1.12, -0.34, s * 1.12, -0.08],
      [s * 1.12, -0.06, s * 1.12, 0.2],
      [s * 1.12, 0.22, s * 1.12, 0.75],
      [s * 1.117, 0.765, s * 0.957, 1.112],
      [s * 0.94, 1.12, s * 0.012, 1.12],
    );
  for (const [x0, d0, x1, d1] of skirt) {
    b.quad({
      p: [
        [xT + x0, 1.86, zT + d0],
        [xT + x1, 1.86, zT + d1],
        [xT + x1, 2.4, zT + d1],
        [xT + x0, 2.4, zT + d0],
      ],
      t: 0.01,
      mat: P,
    });
  }
  for (const s of [-1, 1]) {
    for (const dz of [-0.43, 0.68]) b.rod({ from: [xT + s * 0.6, 2.2, zT + dz], to: [xT + s * 1.115, 2.2, zT + dz], r: 0.016, mat: P, seg: 6 });
    b.rod({ from: [xT + s * 0.5, 2.2, zT + 0.7], to: [xT + s * 0.5, 2.2, zT + 1.115], r: 0.016, mat: P, seg: 6 });
    for (const [dz, c] of [
      [-0.345, 2.0],
      [-0.345, 2.28],
      [0.205, 2.0],
      [0.205, 2.28],
    ])
      b.box({ x: xT + s * 1.128, y: c, z: zT + dz, w: 0.016, h: 0.07, d: 0.045, r: 0, mat: P }); // door hinges
    b.box({ x: xT + s * 1.128, y: 2.14, z: zT - 0.07, w: 0.014, h: 0.03, d: 0.1, r: 0, mat: P }); // latch
    for (const dz of [-0.43, 0.3, 0.68]) b.box({ x: xT + s * 0.99, y: 2.39, z: zT + dz, w: 0.26, h: 0.012, d: 0.035, r: 0, mat: P }); // top stays
  }
  // MG 34 on the cupola ring (anti-aircraft mount).
  const mg = [xT - 0.22, 2.74, cz - 0.2];
  b.part('pintleMg', mg);
  b.box({ x: mg[0], y: mg[1] + 0.04, z: mg[2] + 0.12, w: 0.06, h: 0.09, d: 0.36, r: 0.01, mat: 'blued' });
  b.cyl({ z0: mg[2] - 0.06, z1: mg[2] - 0.6, r0: 0.024, x: mg[0], y: mg[1] + 0.05, mat: 'blued', seg: 10 });
  b.cyl({ z0: mg[2] - 0.6, z1: mg[2] - 0.66, r0: 0.014, x: mg[0], y: mg[1] + 0.05, mat: 'blued', seg: 8 });
  b.box({ x: mg[0], y: mg[1] + 0.02, z: mg[2] + 0.42, w: 0.05, h: 0.12, d: 0.2, r: 0.01, mat: 'blued' });
  b.cylAxis({ axis: 'x', x: mg[0] - 0.08, y: mg[1] + 0.02, z: mg[2] + 0.12, len: 0.1, r: 0.07, mat: 'blued', seg: 14 });
  b.cylAxis({ axis: 'y', x: mg[0], y: mg[1] - 0.05, z: mg[2], len: 0.1, r: 0.015, mat: 'steel', seg: 8 });
  b.at('pintleMg', 'mgMount', mg[0], mg[1], mg[2]);
  b.at('pintleMg', 'mgMuzzle', mg[0], mg[1] + 0.05, mg[2] - 0.66);
  b.body();

  // ---- Gun: 7.5 cm KwK 40 L/48 ---------------------------------------------------------------
  const yG = 2.03,
    zG = zT - 0.8,
    zM = zT - 0.95; // turret front plate
  b.part('gun', [xT, yG, zG]);
  // Mantlet: a boxy plate, its face curved about the trunnions; the recoil sleeve stepped
  // down from its flange (kept slim at the front, clear of the gunsight).
  const mant = [[zM + 0.08, yG - 0.18]];
  for (let i = 0; i <= 6; i++) {
    const a = -0.54 + (1.08 * i) / 6;
    mant.push([zG - 0.35 * Math.cos(a), yG + 0.35 * Math.sin(a)]);
  }
  mant.push([zM + 0.08, yG + 0.18]);
  b.prismX({ points: mant, x0: xT - 0.32, x1: xT + 0.32, mat: Cst, bevel: 0.012, bevelSegments: 1 });
  b.latheDir({
    profile: [
      [0, 0],
      [0.15, 0],
      [0.15, 0.035],
      [0.128, 0.05],
      [0.125, 0.12],
      [0.106, 0.135],
      [0.1, 0.31],
      [0, 0.31],
    ],
    at: [xT, yG, zM - 0.19],
    dir: [0, 0, -1],
    mat: Cst,
    seg: 18,
  });
  b.cyl({ z0: zM - 0.18, z1: zM - 0.207, r0: 0.045, r1: 0.038, x: xT + 0.2, y: yG, mat: Cst, seg: 10 }); // lip round the coax MG opening
  const zB = zM - 0.5;
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.078, -0.02],
      [0.072, 0.1],
      [0.064, 1.1],
      [0.057, 2.04],
      [0.06, 2.06],
      [0, 2.06],
    ],
    at: [xT, yG, zB],
    dir: [0, 0, -1],
    mat: P,
    seg: 18,
  });
  // Double-baffle muzzle brake.
  const zMB = zB - 2.06;
  b.latheDir({
    profile: [
      [0, -0.01],
      [0.07, -0.01],
      [0.085, 0.02],
      [0.085, 0.05],
      [0.07, 0.06],
      [0.07, 0.11],
      [0.085, 0.12],
      [0.085, 0.16],
      [0.07, 0.17],
      [0.07, 0.2],
      [0.085, 0.21],
      [0.085, 0.235],
      [0.045, 0.245],
      [0.04, 0.2],
      [0, 0.2],
    ],
    at: [xT, yG, zMB],
    dir: [0, 0, -1],
    mat: P,
    seg: 18,
  });
  for (const s of [-1, 1]) for (const dz of [0.035, 0.14]) b.box({ x: xT + s * 0.072, y: yG, z: zMB - dz, w: 0.03, h: 0.1, d: 0.06, r: 0.005, mat: 'dark' });
  b.cyl({ z0: zM - 0.2, z1: zM - 0.21, r0: 0.022, x: xT + 0.2, y: yG, mat: 'dark', seg: 10 }); // coax MG port
  b.cyl({ z0: zM - 0.2, z1: zM - 0.26, r0: 0.014, x: xT + 0.2, y: yG, mat: 'blued', seg: 8 });
  b.cyl({ z0: zM - 0.19, z1: zM - 0.205, r0: 0.024, x: xT - 0.2, y: yG + 0.03, mat: 'dark', seg: 10 }); // TZF port
  b.at('gun', 'muzzle', xT, yG, zMB - 0.245);
  b.at('gun', 'coaxMuzzle', xT + 0.2, yG, zM - 0.26);
  b.at('gun', 'gunnerEye', xT - 0.2, yG + 0.03, zM - 0.205);
  b.body();
  b.meta.partParents = { gun: 'turret', pintleMg: 'turret' };

  // ---- Meta, armor, modules -----------------------------------------------------------------
  Object.assign(b.meta, {
    name: 'Panzer IV Ausf. H',
    faction: 'de',
    type: 'tracked',
    crew: 5,
    gun: { name: '7.5 cm KwK 40 L/48', caliber: 75 },
    gunElevation: [-8, 20],
    turretTraverse: 14,
    groundClearance: 0.4,
    turretRing: { center: [xT, yR, zT], radius: 0.84 },
    specs: { mass: 25000, maxSpeed: 38, power: 300, engine: 'Maybach HL 120 TRM', fuel: 470 },
  });
  b.armorZY('nosePlate', 'body', 80, [-2.92, 0.67], [-2.84, 1.0], -0.84, 0.84, [0, 0, -1]);
  b.armorZY('lowerNose', 'body', 20, [-2.45, 0.4], [-2.92, 0.67], -0.84, 0.84, [0, -0.5, -1]);
  b.armorZY('glacis', 'body', 25, [-2.84, 1.0], [-2.4, 1.14], -0.84, 0.84, [0, 1, -0.3]);
  b.armorZY('superFront', 'body', 80, [-2.42, 1.0], [-2.295, 1.8], -1.15, 1.15, [0, 0, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorXY(`sideLower${L}`, 'body', 30, [s * 0.84, 0.4], [s * 0.84, 1.0], -2.45, 2.5, [s, 0, 0]);
    b.armorXY(`sideUpper${L}`, 'body', 30, [s * 1.15, 1.0], [s * 1.15, 1.8], -2.4, 2.65, [s, 0, 0]);
    b.armorZY(`sponsonFloor${L}`, 'body', 10, [-2.4, 1.0], [2.65, 1.0], s * 0.84, s * 1.15, [0, -1, 0]);
    b.armorXY(`schurzen${L}`, 'body', 5, [s * 1.648, 0.6], [s * 1.648, 1.6], -2.36, 2.44, [s, 0, 0]);
  }
  b.armorZY('roof', 'body', 16, [-2.295, 1.8], [0.74, 1.8], -1.15, 1.15, [0, 1, 0]);
  b.armorZY('engineDeck', 'body', 10, [0.8, 1.72], [2.52, 1.72], -1.15, 1.15, [0, 1, 0]);
  b.armorZY('rearUpper', 'body', 20, [2.65, 1.55], [2.52, 1.72], -1.15, 1.15, [0, 0.5, 1]);
  b.armorZY('rear', 'body', 20, [2.65, 0.8], [2.65, 1.55], -1.15, 1.15, [0, 0, 1]);
  b.armorZY('rearLower', 'body', 20, [2.42, 0.4], [2.65, 0.8], -0.84, 0.84, [0, -0.5, 1]);
  b.armorZY('belly', 'body', 10, [-2.45, 0.4], [2.42, 0.4], -0.84, 0.84, [0, -1, 0]);
  // Turret faces (vehicle space at rest).
  const tp = (x, dz, y) => [xT + x, y, zT + dz];
  b.armorPoly('turretFront', 'turret', 50, [tp(-0.6, -0.95, 1.82), tp(0.6, -0.95, 1.82), tp(0.5, -0.84, 2.42), tp(-0.5, -0.84, 2.42)], [0, 0, -1], 3, [1, 0, 0]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorPoly(`turretFrontSide${L}`, 'turret', 30, [tp(s * 0.6, -0.95, 1.82), tp(s * 0.86, -0.4, 1.82), tp(s * 0.6, -0.4, 2.42), tp(s * 0.5, -0.84, 2.42)], [s, 0, -0.5], 3);
    b.armorPoly(`turretSide${L}`, 'turret', 30, [tp(s * 0.86, -0.4, 1.82), tp(s * 0.86, 0.45, 1.82), tp(s * 0.6, 0.4, 2.42), tp(s * 0.6, -0.4, 2.42)], [s, 0.3, 0], 3, [0, 0, 1]);
    b.armorPoly(`turretRearSide${L}`, 'turret', 30, [tp(s * 0.86, 0.45, 1.82), tp(s * 0.7, 0.88, 1.82), tp(s * 0.5, 0.7, 2.42), tp(s * 0.6, 0.4, 2.42)], [s, 0, 0.5], 2);
    b.armorXZ(`turretSkirt${L}`, 'turret', 8, [xT + s * 1.12, zT - 0.5], [xT + s * 1.12, zT + 0.75], 1.86, 2.4, [s, 0, 0]);
  }
  b.armorPoly('turretRear', 'turret', 30, [tp(-0.7, 0.88, 1.82), tp(0.7, 0.88, 1.82), tp(0.5, 0.72, 2.42), tp(-0.5, 0.72, 2.42)], [0, 0, 1], 3, [1, 0, 0]);
  b.armorXZ('turretSkirtRear', 'turret', 8, [xT - 0.95, zT + 1.12], [xT + 0.95, zT + 1.12], 1.86, 2.4, [0, 0, 1]);
  b.armorZY('turretRoofFront', 'turret', 16, [zT - 0.84, 2.42], [zT, 2.42], xT - 0.6, xT + 0.6, [0, 1, 0]);
  b.armorZY('turretRoofRear', 'turret', 10, [zT, 2.42], [zT + 0.72, 2.42], xT - 0.6, xT + 0.6, [0, 1, 0]);
  b.armor('cupola', 'turret', 50, [xT, 2.54, cz - 0.33], [0.66, 0, 0], [0, 0.24, 0], [0, 0, -1]);
  b.armor('mantlet', 'gun', 50, [xT, yG, zM - 0.2], [0.64, 0, 0], [0, 0.36, 0], [0, 0, -1]);
  b.armor('recoilSleeve', 'gun', 50, [xT, yG, zM - 0.5], [0.21, 0, 0], [0, 0.21, 0], [0, 0, -1]);
  // Internal modules.
  b.module('engine', 'body', [0.1, 1.2, 1.7], [0.5, 0.42, 0.6]);
  b.module('transmission', 'body', [0, 0.75, -2.45], [0.55, 0.28, 0.3]);
  b.module('fuel', 'body', [0, 0.55, 0.4], [0.6, 0.12, 0.4]);
  b.module('fuel', 'body', [-0.6, 1.2, 1.05], [0.25, 0.3, 0.2]);
  for (const s of [-1, 1]) b.module('ammo', 'body', [s * 0.86, 1.3, -0.6], [0.24, 0.3, 0.45]);
  b.module('ammo', 'body', [0.55, 0.65, -0.95], [0.25, 0.2, 0.3]);
  b.module('driver', 'body', [-0.5, 1.25, -1.95], [0.25, 0.45, 0.3]);
  b.module('radio', 'body', [0.5, 1.25, -1.95], [0.25, 0.45, 0.3]); // radio operator / bow gunner
  b.module('gunner', 'turret', [xT - 0.35, 1.85, zT - 0.5], [0.2, 0.45, 0.25]);
  b.module('commander', 'turret', [xT, 2.05, cz], [0.22, 0.5, 0.25]);
  b.module('loader', 'turret', [xT + 0.4, 1.75, zT - 0.1], [0.22, 0.5, 0.25]);
}

// ---------------------------------------------------------------------------------------
// Panzerkampfwagen VI Tiger Ausf. E (mid 1943): box hull with the superstructure over the
// tracks, horseshoe turret with the cast cupola, 8.8 cm KwK 36 L/56 with the double-baffle
// muzzle brake, interleaved 800 mm road wheels on 8 torsion-bar stations a side (outer and
// inner wheels on even stations, a double middle wheel on odd ones), front sprocket (18
// teeth), rear idler, Kgs 63/725/130 combat track (96 links). 8.45 m long with the gun
// (hull 6.32), 3.56 m wide, 3.0 m high; 54 t.
// Armor: nose and front plate 100 mm (24 / 10 deg), glacis 60 mm at 80 deg, superstructure
// sides 80 mm, lower sides 60 mm, rear 80 mm, roof and belly 25 mm; turret front 100 mm,
// mantlet 120 mm, sides and rear 80 mm, roof 25 mm, cupola 110 mm.
export function tiger1(b) {
  const P = 'dunkelgelb',
    Cst = 'castGerman';
  // ---- Running gear -------------------------------------------------------------------------
  const T = 0.055,
    RW = 0.4,
    yW = RW + T,
    OX = 1.41;
  const wheels = [];
  for (let i = 0; i < 8; i++) wheels.push([-1.8 + (3.6 * i) / 7, yW]);
  const single = roadWheel({ r: RW, width: 0.1, tire: 0.06, dish: 0.03, hubR: 0.1, hubLen: 0.04, mat: P, bolts: 8 });
  const outerInner = [...single.map((it) => ({ mat: it.mat, geo: it.geo.clone().translate(0.235, 0, 0) })), ...single.map((it) => ({ mat: it.mat, geo: it.geo.clone().translate(-0.235, 0, 0) }))];
  const middle = roadWheel({ r: RW, width: 0.24, gap: 0.06, tire: 0.06, dish: 0.03, hubR: 0.1, hubLen: 0.04, mat: P, bolts: 8 });
  const SPR = { z: -2.6, y: 0.53 },
    IDL = { z: 2.53, y: 0.555 };
  runningGear(b, {
    wheels,
    wheel: (i) => (i % 2 === 0 ? outerInner : middle),
    wheelR: RW,
    sprocket: { ...SPR, r: 0.3743, teeth: 18, items: sprocket({ n: 18, r0: 0.345, r1: 0.405, ringGap: 0.26, t: 0.04, drumR: 0.29, hubR: 0.16, hubLen: 0.11, mat: P, bolts: 12, tooth: 0.5, tip: 0.2 }) },
    idler: { ...IDL, r: 0.3 + T / 2, items: roadWheel({ r: 0.3, width: 0.3, gap: 0.08, rubber: false, dish: 0.035, hubR: 0.09, hubLen: 0.05, mat: P, holes: 8, holeR: 0.045 }) },
    track: { width: 0.725, pitch: 0.13, thick: T, offsetX: OX, realLinks: 96, sag: 0.015 },
  });
  for (const s of [-1, 1]) {
    for (const [z] of wheels) b.rod({ from: [s * 1.0, 0.56, z + 0.3], to: [s * 1.1, yW, z], r: 0.045, mat: P }); // torsion arms
    b.cylAxis({ axis: 'x', x: s * 1.07, y: SPR.y, z: SPR.z, len: 0.16, r: 0.22, mat: Cst, seg: 20 });
    b.rod({ from: [s * 1.0, 0.75, IDL.z - 0.3], to: [s * 1.15, IDL.y, IDL.z], r: 0.06, mat: P });
  }

  // ---- Hull ---------------------------------------------------------------------------------
  const fz = (y) => -2.42 + ((1.3 - y) / 0.56) * 0.1; // front plate surface z at height y (10 deg)
  // Lower hull: lower nose, nose plate (24 deg), glacis (80 deg), lower rear.
  b.prismX({
    points: [
      [-2.75, 0.47],
      [2.75, 0.47],
      [3.06, 0.62],
      [3.12, 0.96],
      [-2.42, 0.96],
      [-2.42, 1.3],
      [-2.89, 1.22],
      [-3.12, 0.7],
    ],
    x0: -1.0,
    x1: 1.0,
    mat: P,
    bevel: 0.015,
  });
  // Superstructure over the tracks: front plate (10 deg), roof, rear plate.
  b.prismX({
    points: [
      [fz(0.95), 0.95],
      [3.12, 0.95],
      [3.04, 1.86],
      [fz(1.86), 1.86],
    ],
    x0: -1.79,
    x1: 1.79,
    mat: P,
    bevel: 0.015,
  });
  // Hull side plates carried forward past the nose and back past the tail, each with a tow shackle.
  for (const s of [-1, 1]) {
    for (const [pts, hz, hy, fwd] of [
      [[[-2.62, 0.5], [-3.08, 0.62], [-3.17, 0.72], [-3.17, 0.86], [-3.06, 1.0], [-2.9, 1.215], [-2.62, 1.215]], -3.09, 0.79, -1],
      [[[2.6, 0.5], [3.02, 0.6], [3.2, 0.7], [3.22, 0.84], [3.12, 0.955], [2.6, 0.955]], 3.13, 0.78, 1],
    ]) {
      b.prismX({ points: pts, holes: [circle(0.04, 10, hz, hy)], x0: s * 0.925, x1: s * 1.006, mat: P, bevel: 0.008, bevelSegments: 1 });
      const bow = [];
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI,
          k = 0.07 + 0.065 * Math.sin(a);
        bow.push([s * 0.9655 - 0.065 * Math.cos(a), hy - 0.85 * k, hz + fwd * 0.53 * k]);
      }
      cable(b, [[s * 0.9655 - 0.065, hy, hz], ...bow, [s * 0.9655 + 0.065, hy, hz]], 0.018, 'steel');
      b.cylAxis({ axis: 'x', x: s * 0.9655, y: hy, z: hz, len: 0.2, r: 0.024, mat: 'steel', seg: 8 });
    }
  }
  // Front mudguards (fixed plate, hinged flap sloping down, folded lips), rear mudguards,
  // side track guards in four bolted panels a side.
  for (const s of [-1, 1]) {
    const mg = [
      [fz(1.1) + 0.01, 1.1],
      [-2.86, 1.1],
      [-3.1, 1.02],
      [-3.165, 0.93],
    ];
    const lip = mg.map(([z, y]) => [z, y + 0.012]).reverse();
    b.prismX({ points: ribbon(mg, 0.012), x0: s * 1.047, x1: s * 1.775, mat: P, bevel: 0.003, bevelSegments: 1 });
    b.prismX({ points: ribbon(lip, 0.06), x0: s * 1.775, x1: s * 1.79, mat: P, bevel: 0 });
    b.prismX({ points: ribbon(lip.slice(1), 0.045), x0: s * 1.035, x1: s * 1.047, mat: P, bevel: 0 });
    for (const x of [1.16, 1.41, 1.66]) b.cylAxis({ axis: 'x', x: s * x, y: 1.112, z: -2.86, len: 0.16, r: 0.014, mat: P, seg: 6 }); // flap hinges
    const rg = [
      [3.07, 0.957],
      [3.15, 0.945],
      [3.245, 0.8],
    ];
    b.prismX({ points: ribbon(rg, 0.012), x0: s * 1.047, x1: s * 1.775, mat: P, bevel: 0.003, bevelSegments: 1 });
    b.prismX({ points: ribbon(rg, 0.055), x0: s * 1.775, x1: s * 1.79, mat: P, bevel: 0 });
    for (const x of [1.2, 1.6]) b.cylAxis({ axis: 'x', x: s * x, y: 0.953, z: 3.15, len: 0.16, r: 0.014, mat: P, seg: 6 });
    for (let i = 0; i < 4; i++) {
      const z0 = -2.3 + i * 1.345;
      b.prismZ({
        points: ribbon(
          [
            [s * 1.79, 1.035],
            [s * 1.79, 0.975],
            [s * 1.818, 0.93],
          ],
          -s * 0.008,
        ),
        z0,
        z1: z0 + 1.33,
        mat: P,
        bevel: 0,
      });
      for (let k = 0; k < 4; k++) b.box({ x: s * 1.8, y: 1.012, z: z0 + 0.16 + k * 0.336, w: 0.012, h: 0.022, d: 0.022, r: 0, mat: P }); // bolt heads
    }
  }
  // Interlocking plate joints at the front corners: the tongues of the side plates show in
  // the front plate, the ends of the front plate show in the sides.
  {
    const lean = [0, 0.9844, -0.1758],
      out = [0, -0.1758, -0.9844];
    for (const s of [-1, 1]) {
      for (const y of [1.0, 1.52]) slab(b, [s * 1.7, y, fz(y)], [s, 0, 0], lean, out, [0, 0.092], [0, 0.26], [-0.02, 0.007], P);
      slab(b, [s * 1.79, 1.27, fz(1.27)], [0, 0, 1], lean, [s, 0, 0], [0, 0.1], [0, 0.24], [-0.02, 0.007], P);
      slab(b, [s * 1.79, 1.79, fz(1.79)], [0, 0, 1], lean, [s, 0, 0], [0, 0.1], [0, 0.07], [-0.02, 0.007], P);
    }
  }
  // Spare track links across the nose plate under a holding bar, shovel on the glacis.
  {
    const up = [0, 0.9145, 0.4045],
      out = [0, 0.4045, -0.9145],
      o = [-0.78, 0.752, -3.097];
    spareLinks(b, o, [1, 0, 0], up, out, { n: 12, pitch: 0.13, w: 0.46, t: 0.05 });
    slab(b, o, [1, 0, 0], up, out, [-0.03, 1.59], [0.2, 0.26], [0.05, 0.062], P);
    for (const a of [-0.03, 1.56]) slab(b, o, [1, 0, 0], up, out, [a, a + 0.03], [0.17, 0.29], [0, 0.062], P);
    b.place({ pos: [0, 1.2525 + 0.012, -2.7], rot: [-0.1687, 0, 0] }, () => {
      b.rod({ from: [-0.16, 0.012, 0], to: [0.66, 0.012, 0], r: 0.016, mat: 'wood', seg: 6 });
      b.prismY({
        points: [
          [-0.14, -0.02],
          [-0.17, -0.1],
          [-0.36, -0.1],
          [-0.42, -0.07],
          [-0.45, 0],
          [-0.42, 0.07],
          [-0.36, 0.1],
          [-0.17, 0.1],
          [-0.14, 0.02],
        ],
        y0: 0,
        y1: 0.014,
        mat: 'steel',
        bevel: 0,
      });
      for (const x of [-0.05, 0.5]) b.box({ x, y: 0.02, z: 0, w: 0.03, h: 0.045, d: 0.07, r: 0, mat: P });
    });
  }
  // Driver's visor in its frame (left), ball-mounted MG 34 in its armored ring (right).
  {
    const y = 1.6;
    b.box({ x: -0.55, y, z: fz(y) - 0.015, w: 0.52, h: 0.26, d: 0.05, rx: -0.177, r: 0.012, mat: P });
    b.box({ x: -0.55, y, z: fz(y) - 0.04, w: 0.42, h: 0.18, d: 0.09, r: 0.025, mat: P });
    b.box({ x: -0.55, y: y + 0.01, z: fz(y) - 0.087, w: 0.22, h: 0.022, d: 0.006, r: 0.002, mat: 'dark' });
    for (const dx of [-0.07, 0.07]) b.cyl({ z0: fz(y + 0.2), z1: fz(y + 0.2) - 0.012, r0: 0.024, x: -0.55 + dx, y: y + 0.2, mat: P, seg: 8 }); // plugged periscope holes
    b.anchor('driverEye', -0.55, y + 0.01, fz(y) - 0.095); // at the visor slit
    b.latheDir({
      profile: [
        [0.14, 0],
        [0.215, 0],
        [0.215, 0.03],
        [0.175, 0.062],
        [0.14, 0.062],
        [0.14, 0],
      ],
      at: [0.55, y - 0.04, fz(y - 0.04) + 0.005],
      dir: [0, -0.1758, -0.9844],
      mat: Cst,
      seg: 16,
    });
    b.sphere({ x: 0.55, y: y - 0.04, z: fz(y) - 0.01, r: 0.16, sz: 0.55, mat: Cst, seg: 18 });
    b.cyl({ z0: fz(y) - 0.08, z1: fz(y) - 0.24, r0: 0.026, x: 0.55, y: y - 0.04, mat: 'blued', seg: 10 });
    b.cyl({ z0: fz(y) - 0.24, z1: fz(y) - 0.28, r0: 0.013, x: 0.55, y: y - 0.04, mat: 'blued', seg: 8 });
    b.anchor('bowMgMuzzle', 0.55, y - 0.04, fz(y) - 0.28);
  }
  // Roof: round hatches for driver and radio operator (collar, domed lid, hinge, periscope
  // under its guard, grab handle), twin headlights, S-mine launchers at the corners.
  for (const s of [-1, 1]) {
    const hx = s * 0.62,
      hz = -1.85;
    b.latheDir({
      profile: [
        [0, 0.05],
        [0.19, 0.05],
        [0.25, 0.036],
        [0.265, 0.018],
        [0.3, 0.018],
        [0.3, 0],
        [0, 0],
      ],
      at: [hx, 1.86, hz],
      dir: [0, 1, 0],
      mat: P,
      seg: 20,
    });
    b.box({ x: hx + s * 0.31, y: 1.882, z: hz, w: 0.1, h: 0.045, d: 0.2, r: 0.01, mat: P });
    b.cylAxis({ axis: 'z', x: hx + s * 0.35, y: 1.9, z: hz, len: 0.24, r: 0.018, mat: P, seg: 6 });
    b.box({ x: hx, y: 1.925, z: hz - 0.1, w: 0.17, h: 0.05, d: 0.09, r: 0.012, mat: P });
    b.box({ x: hx, y: 1.928, z: hz - 0.146, w: 0.12, h: 0.024, d: 0.004, r: 0, mat: 'dark' });
    cable(b, [[hx - 0.07, 1.9, hz + 0.1], [hx - 0.07, 1.935, hz + 0.1], [hx + 0.07, 1.935, hz + 0.1], [hx + 0.07, 1.9, hz + 0.1]], 0.008, 'steel', 4);
    b.cyl({ z0: fz(1.86) - 0.02, z1: fz(1.86) + 0.12, r0: 0.08, r1: 0.075, x: s * 0.82, y: 1.95, mat: P, seg: 16 });
    b.cyl({ z0: fz(1.86) - 0.026, z1: fz(1.86) - 0.018, r0: 0.068, x: s * 0.82, y: 1.95, mat: 'lamp', seg: 16 });
    b.cylAxis({ axis: 'y', x: s * 0.82, y: 1.88, z: fz(1.86) + 0.05, len: 0.05, r: 0.02, mat: P, seg: 8 });
    b.anchor(`headlight${side(s)}`, s * 0.82, 1.95, fz(1.86) - 0.03);
    for (const z of [-2.36, 2.9]) {
      b.box({ x: s * 1.62, y: 1.88, z, w: 0.12, h: 0.04, d: 0.1, r: 0, mat: P });
      b.rod({ from: [s * 1.62, 1.89, z], to: [s * 1.715, 2.005, z], r: 0.045, mat: P, seg: 8 });
      b.rod({ from: [s * 1.7, 1.987, z], to: [s * 1.72, 2.011, z], r: 0.03, mat: 'dark', seg: 8 });
    }
    // Tow cable: both eyes at the front, the run doubled back around the engine deck.
    const xo = s * 1.7,
      xi = s * 1.56,
      yc = 1.877,
      yd = 1.913;
    cable(b, [[xo, yc, -2.0], [xo, yc, 0.5], [xo, yd, 0.86], [xo, yd, 2.3], [s * 1.688, yd, 2.375], [s * 1.66, yd, 2.425], [s * 1.63, yd, 2.44], [s * 1.6, yd, 2.425], [s * 1.572, yd, 2.375], [xi, yd, 2.3], [xi, yd, 0.86], [xi, yc, 0.5], [xi, yc, -1.82]], 0.017, 'steel');
    for (const [x, z] of [
      [xo, -2.0],
      [xi, -1.82],
    ]) {
      b.cyl({ z0: z - 0.03, z1: z + 0.06, r0: 0.024, x, y: yc, mat: 'steel', seg: 6 });
      b.latheDir({ profile: torusProfile(0.05, 0.015, 6), at: [x, yc - 0.002, z - 0.075], dir: [0, 1, 0], mat: 'steel', seg: 10 });
    }
    for (const [z, y] of [
      [-1.35, yc],
      [-0.1, yc],
      [1.3, yd],
      [2.1, yd],
    ])
      b.box({ x: s * 1.63, y: y - 0.004, z, w: 0.2, h: 0.05, d: 0.035, r: 0, mat: P });
  }
  // Tools on the roof: axe and gun cleaning rods (right), sledge and crowbar (left); the
  // track changing cable clipped along the left side.
  b.rod({ from: [1.2, 1.878, -2.25], to: [1.2, 1.878, -1.55], r: 0.016, mat: 'wood', seg: 6 });
  b.prismY({
    points: [
      [1.15, -2.24],
      [1.33, -2.275],
      [1.33, -2.135],
      [1.15, -2.17],
    ],
    y0: 1.862,
    y1: 1.892,
    mat: 'steel',
    bevel: 0,
  });
  for (const x of [1.33, 1.375, 1.42]) b.rod({ from: [x, 1.878, -1.5], to: [x, 1.878, 0.2], r: 0.017, mat: 'wood', seg: 6 });
  for (const z of [-1.3, -0.65, 0.0]) b.box({ x: 1.375, y: 1.88, z, w: 0.15, h: 0.05, d: 0.03, r: 0, mat: P });
  b.rod({ from: [-1.2, 1.878, -2.2], to: [-1.2, 1.878, -1.5], r: 0.016, mat: 'wood', seg: 6 });
  b.box({ x: -1.2, y: 1.892, z: -2.2, w: 0.18, h: 0.064, d: 0.064, r: 0.006, mat: 'steel' });
  cable(b, [[-1.37, 1.873, -2.3], [-1.37, 1.873, -1.0], [-1.39, 1.873, -0.94], [-1.43, 1.873, -0.9]], 0.013, 'steel', 5);
  for (const [x, z] of [
    [1.2, -1.75],
    [-1.2, -1.7],
    [-1.37, -2.0],
    [-1.37, -1.2],
  ])
    b.box({ x, y: 1.88, z, w: 0.06, h: 0.05, d: 0.03, r: 0, mat: P });
  b.rod({ from: [-1.8, 1.74, -2.15], to: [-1.8, 1.74, 2.7], r: 0.009, mat: 'steel', seg: 5 });
  for (const z of [-2.05, -0.85, 0.35, 1.55, 2.6]) b.box({ x: -1.797, y: 1.74, z, w: 0.03, h: 0.05, d: 0.03, r: 0, mat: P });
  // Engine deck: engine hatch with its round vent cover, two grilles a side set in frames.
  b.box({ x: 0, y: 1.875, z: 1.9, w: 1.24, h: 0.036, d: 1.86, r: 0.012, mat: P });
  b.latheDir({
    profile: [
      [0, 0.075],
      [0.14, 0.075],
      [0.21, 0.05],
      [0.21, 0.03],
      [0.16, 0.03],
      [0.16, 0],
      [0, 0],
    ],
    at: [0, 1.892, 2.25],
    dir: [0, 1, 0],
    mat: P,
    seg: 16,
  });
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.36, y: 1.9, z: 1.72, w: 0.3, h: 0.022, d: 0.34, r: 0.008, mat: P });
    b.box({ x: s * 0.4, y: 1.886, z: 0.96, w: 0.14, h: 0.045, d: 0.07, r: 0, mat: P }); // hatch hinges
    cable(b, [[s * 0.45 - 0.07, 1.89, 2.66], [s * 0.45 - 0.07, 1.925, 2.66], [s * 0.45 + 0.07, 1.925, 2.66], [s * 0.45 + 0.07, 1.89, 2.66]], 0.008, 'steel', 4);
    for (const [g0, g1] of [
      [0.86, 1.76],
      [1.86, 2.78],
    ]) {
      const gc = (g0 + g1) / 2,
        gx = s * 1.24;
      b.prismY({ points: roundRect(gx, gc, 0.5, (g1 - g0) / 2, 0.03, 2), holes: [roundRect(gx, gc, 0.45, (g1 - g0) / 2 - 0.05)], y0: 1.86, y1: 1.895, mat: P, bevel: 0.004, bevelSegments: 1 });
      b.box({ x: gx, y: 1.864, z: gc, w: 0.9, h: 0.008, d: g1 - g0 - 0.1, r: 0, mat: 'black' });
      for (let z = g0 + 0.09; z < g1 - 0.06; z += 0.075) b.box({ x: gx, y: 1.878, z, w: 0.9, h: 0.03, d: 0.01, rx: 0.5, r: 0, mat: P });
      b.box({ x: gx, y: 1.886, z: gc, w: 0.03, h: 0.014, d: g1 - g0 - 0.1, r: 0, mat: P });
    }
    // Feifel air cleaners on the tail plate, their pipes over the deck to the engine hatch.
    for (const fx of [1.3, 1.5]) {
      b.cylAxis({ axis: 'y', x: s * fx, y: 1.62, z: 3.165, len: 0.36, r: 0.09, mat: P, seg: 12 });
      b.cylAxis({ axis: 'y', x: s * fx, y: 1.82, z: 3.165, len: 0.04, r: 0.09, r1: 0.05, mat: P, seg: 12 });
    }
    b.box({ x: s * 1.4, y: 1.835, z: 3.15, w: 0.34, h: 0.05, d: 0.1, r: 0.012, mat: P });
    b.box({ x: s * 1.4, y: 1.6, z: 3.09, w: 0.42, h: 0.06, d: 0.08, r: 0, mat: P });
    cable(b, [[s * 1.4, 1.84, 3.14], [s * 1.385, 1.93, 3.07], [s * 1.2, 1.955, 2.96], [s * 0.7, 1.95, 2.9], [s * 0.36, 1.945, 2.86], [s * 0.23, 1.95, 2.76], [s * 0.2, 1.945, 2.66], [s * 0.2, 1.9, 2.63]], 0.035, P, 8);
    b.cylAxis({ axis: 'y', x: s * 0.2, y: 1.905, z: 2.63, len: 0.035, r: 0.07, mat: P, seg: 8 }); // pipe flange on the hatch
    for (const y of [1.05, 1.55]) b.box({ x: s * 1.793, y: y + 0.12, z: 3.0, w: 0.014, h: 0.24, d: 0.1, r: 0, mat: P }); // ends of the tail plate showing in the side
    // Exhaust stack: cast guard at the foot, the pipe, a sheet shield round the back.
    const ex = s * 0.55;
    b.cylAxis({ axis: 'y', x: ex, y: 1.36, z: 3.16, len: 0.26, r: 0.12, r1: 0.1, mat: Cst, seg: 12 });
    b.cylAxis({ axis: 'y', x: ex, y: 1.74, z: 3.16, len: 0.52, r: 0.07, mat: 'black', seg: 10 });
    b.prismY({ points: ribbon(arc(ex, 3.16, 0.112, -0.35, Math.PI + 0.35, 8), 0.006), y0: 1.5, y1: 1.91, mat: P, bevel: 0 });
    b.cyl({ z0: 3.1, z1: 3.16, r0: 0.05, x: ex, y: 2.0, mat: 'black', seg: 10 });
    b.cylAxis({ axis: 'y', x: ex, y: 2.0, z: 3.16, len: 0.08, r: 0.05, mat: 'black', seg: 10 });
    b.anchor(`exhaust${side(s)}`, ex, 2.04, 3.16);
  }
  // Tail plate: jack under the right exhaust, wooden jack block under the left, tow coupling.
  b.cylAxis({ axis: 'x', x: 0.55, y: 1.08, z: 3.2, len: 0.5, r: 0.05, mat: P, seg: 10 });
  b.cylAxis({ axis: 'x', x: 0.2, y: 1.08, z: 3.2, len: 0.22, r: 0.028, mat: 'steel', seg: 8 });
  b.box({ x: 0.82, y: 1.08, z: 3.2, w: 0.035, h: 0.15, d: 0.13, r: 0, mat: P });
  b.box({ x: 0.5, y: 1.125, z: 3.2, w: 0.12, h: 0.1, d: 0.1, r: 0.01, mat: P });
  for (const x of [0.36, 0.7]) b.box({ x, y: 1.08, z: 3.16, w: 0.03, h: 0.13, d: 0.12, r: 0, mat: P });
  b.box({ x: -0.55, y: 1.08, z: 3.185, w: 0.42, h: 0.17, d: 0.13, r: 0.008, mat: 'wood' });
  for (const x of [-0.7, -0.4]) b.box({ x, y: 1.08, z: 3.185, w: 0.03, h: 0.185, d: 0.145, r: 0, mat: 'steel' });
  b.box({ x: 0, y: 0.8, z: 3.11, w: 0.24, h: 0.15, d: 0.1, r: 0.015, mat: P });
  b.cylAxis({ axis: 'y', x: 0, y: 0.8, z: 3.16, len: 0.2, r: 0.02, mat: 'steel', seg: 6 });

  // ---- Turret ----------------------------------------------------------------------------------
  const zT = -0.15,
    yR = 1.86;
  b.part('turret', [0, yR, zT]);
  const plan = mirrorHalf([
    [0, -0.98],
    [0.92, -0.98],
    [1.02, -0.86],
    [1.06, -0.5],
    [1.06, 0.2],
    [1.02, 0.6],
    [0.9, 0.95],
    [0.68, 1.22],
    [0.36, 1.38],
    [0, 1.42],
  ]);
  const L3 = (y, sc) => plan.map(([x, dz]) => [x * sc, y, zT + dz * sc]);
  b.convex({ points: [...L3(1.88, 1), ...L3(2.74, 1), ...L3(2.78, 0.985)], mat: P, crease: 0.35 });
  // Cast cupola (left rear) with seven periscopes under their hoods, hatch and MG ring.
  const cx = -0.48,
    cz = zT + 0.55;
  b.latheDir({
    profile: [
      [0, 0],
      [0.4, 0],
      [0.4, 0.05],
      [0.36, 0.08],
      [0.35, 0.19],
      [0.3, 0.22],
      [0, 0.22],
    ],
    at: [cx, 2.77, cz],
    dir: [0, 1, 0],
    mat: Cst,
    seg: 28,
  });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.box({ x: cx + Math.cos(a) * 0.355, y: 2.91, z: cz + Math.sin(a) * 0.355, w: 0.012, h: 0.04, d: 0.11, ry: -a + Math.PI / 2, r: 0.003, mat: 'dark' });
    b.box({ x: cx + Math.cos(a) * 0.345, y: 2.953, z: cz + Math.sin(a) * 0.345, w: 0.07, h: 0.034, d: 0.16, ry: -a + Math.PI / 2, r: 0, mat: Cst });
    const q = a + Math.PI / 7;
    b.box({ x: cx + Math.cos(q) * 0.362, y: 2.975, z: cz + Math.sin(q) * 0.362, w: 0.02, h: 0.05, d: 0.03, ry: -q + Math.PI / 2, r: 0, mat: 'steel' }); // ring posts
  }
  b.cylAxis({ axis: 'y', x: cx, y: 3.0, z: cz, len: 0.03, r: 0.3, mat: P, seg: 24 });
  b.cylAxis({ axis: 'y', x: cx + 0.2, y: 3.005, z: cz + 0.2, len: 0.06, r: 0.05, mat: P, seg: 8 }); // hatch pivot
  cable(b, [[cx - 0.07, 3.01, cz - 0.12], [cx - 0.07, 3.04, cz - 0.12], [cx + 0.07, 3.04, cz - 0.12], [cx + 0.07, 3.01, cz - 0.12]], 0.008, 'steel', 4);
  b.latheDir({ profile: torusProfile(0.37, 0.012, 8), at: [cx, 3.0, cz], dir: [0, 1, 0], mat: 'steel', seg: 28 });
  // Roof: loader's hatch with hinges and handle, his periscope under its guard, the
  // ventilator, three lifting eyes.
  b.box({ x: 0.48, y: 2.795, z: zT + 0.2, w: 0.5, h: 0.04, d: 0.56, r: 0.015, mat: P });
  for (const dx of [-0.15, 0.15]) b.box({ x: 0.48 + dx, y: 2.8, z: zT - 0.1, w: 0.08, h: 0.04, d: 0.08, r: 0, mat: P });
  cable(b, [[0.41, 2.81, zT + 0.38], [0.41, 2.845, zT + 0.38], [0.55, 2.845, zT + 0.38], [0.55, 2.81, zT + 0.38]], 0.008, 'steel', 4);
  b.box({ x: 0.5, y: 2.815, z: zT - 0.45, w: 0.18, h: 0.075, d: 0.11, r: 0.012, mat: P });
  b.box({ x: 0.5, y: 2.825, z: zT - 0.506, w: 0.13, h: 0.03, d: 0.004, r: 0, mat: 'dark' });
  b.latheDir({
    profile: [
      [0, 0.065],
      [0.1, 0.065],
      [0.15, 0.04],
      [0.15, 0.022],
      [0.11, 0.022],
      [0.11, 0],
      [0, 0],
    ],
    at: [0, 2.775, zT - 0.25],
    dir: [0, 1, 0],
    mat: P,
    seg: 14,
  });
  for (const [x, dz] of [
    [-0.8, -0.72],
    [0.8, -0.72],
    [0, 1.22],
  ])
    b.latheDir({ profile: torusProfile(0.035, 0.011, 6), at: [x, 2.785, zT + dz], dir: [1, 0, 0], mat: 'steel', seg: 8 });
  // Stowage bin shaped to the turret rear: body, lid, hinges, latches.
  {
    const bin = mirrorHalf([
      [0, 1.3],
      [0.62, 1.12],
      [0.62, 1.5],
      [0.46, 1.64],
      [0, 1.68],
    ]);
    b.prismY({ points: bin.map(([x, dz]) => [x, zT + dz]), y0: 2.08, y1: 2.6, mat: P, bevel: 0.01, bevelSegments: 1 });
    b.prismY({ points: bin.map(([x, dz]) => [x * 1.025, zT + 1.4 + (dz - 1.4) * 1.04]), y0: 2.59, y1: 2.625, mat: P, bevel: 0.006, bevelSegments: 1 });
    for (const x of [-0.3, 0.3]) {
      b.box({ x, y: 2.56, z: zT + 1.69, w: 0.05, h: 0.1, d: 0.025, r: 0, mat: 'steel' });
      b.box({ x: x * 1.4, y: 2.63, z: zT + 1.36, w: 0.12, h: 0.02, d: 0.05, r: 0, mat: P });
    }
  }
  // Spare track links racked on the sides (five left, two right), pistol port (left rear),
  // escape hatch on its hinge (right rear).
  for (const [s, dz, n] of [
    [-1, -0.47, 3],
    [-1, -0.04, 2],
    [1, -0.42, 2],
  ]) {
    const o = [s * 1.06, 1.99, zT + dz];
    spareLinks(b, o, [0, 0, 1], [0, 1, 0], [s, 0, 0], { n, pitch: 0.13, w: 0.64, t: 0.055 });
    for (const c of [-0.03, 0.63]) slab(b, o, [0, 0, 1], [0, 1, 0], [s, 0, 0], [-0.015, n * 0.13 + 0.015], [c, c + 0.04], [0, 0.07], P);
  }
  b.latheDir({
    profile: [
      [0, 0.045],
      [0.045, 0.045],
      [0.08, 0.02],
      [0.095, 0],
      [0, 0],
    ],
    at: [-1.028, 2.3, zT + 0.5],
    dir: [-0.995, 0, 0.1],
    mat: Cst,
    seg: 12,
  });
  b.latheDir({
    profile: [
      [0, 0.055],
      [0.06, 0.055],
      [0.06, 0.04],
      [0.2, 0.04],
      [0.245, 0.02],
      [0.245, -0.02],
      [0, -0.02],
    ],
    at: [0.962, 2.3, zT + 0.75],
    dir: [0.946, 0, 0.324],
    mat: P,
    seg: 18,
  });
  b.box({ x: 0.962 + 0.946 * 0.02, y: 2.035, z: zT + 0.75 + 0.324 * 0.02, w: 0.07, h: 0.1, d: 0.22, ry: -0.33, r: 0.01, mat: P });
  b.at('turret', 'commanderEye', cx, 3.22, cz);
  // MG 34 on the cupola ring.
  const mg = [cx + 0.25, 3.08, cz - 0.22];
  b.part('pintleMg', mg);
  b.box({ x: mg[0], y: mg[1] + 0.04, z: mg[2] + 0.12, w: 0.06, h: 0.09, d: 0.36, r: 0.01, mat: 'blued' });
  b.cyl({ z0: mg[2] - 0.06, z1: mg[2] - 0.6, r0: 0.024, x: mg[0], y: mg[1] + 0.05, mat: 'blued', seg: 10 });
  b.cyl({ z0: mg[2] - 0.6, z1: mg[2] - 0.66, r0: 0.014, x: mg[0], y: mg[1] + 0.05, mat: 'blued', seg: 8 });
  b.box({ x: mg[0], y: mg[1] + 0.02, z: mg[2] + 0.42, w: 0.05, h: 0.12, d: 0.2, r: 0.01, mat: 'blued' });
  b.cylAxis({ axis: 'x', x: mg[0] - 0.08, y: mg[1] + 0.02, z: mg[2] + 0.12, len: 0.1, r: 0.07, mat: 'blued', seg: 14 });
  b.cylAxis({ axis: 'y', x: mg[0], y: mg[1] - 0.05, z: mg[2], len: 0.1, r: 0.015, mat: 'steel', seg: 8 });
  b.at('pintleMg', 'mgMount', mg[0], mg[1], mg[2]);
  b.at('pintleMg', 'mgMuzzle', mg[0], mg[1] + 0.05, mg[2] - 0.66);
  b.body();

  // ---- Gun: 8.8 cm KwK 36 L/56 ----------------------------------------------------------------
  const yG = 2.3,
    zG = zT - 0.78;
  b.part('gun', [0, yG, zG]);
  // Mantlet: a thick flat plate rounded off above and below about the trunnions, with the
  // raised reinforcement around the gun sleeve and the gunsight openings standing 35 mm off it.
  const mant = [];
  for (let i = 0; i <= 4; i++) {
    const a = 0.69 + (0.115 * i) / 4;
    mant.push([zG - 0.5 * Math.cos(a), yG + 0.5 * Math.sin(a)]);
  }
  mant.push([zG - 0.12, yG + 0.36]);
  b.prismX({ points: [...mant, ...mant.map(([z, y]) => [z, 2 * yG - y]).reverse()], x0: -0.7, x1: 0.7, mat: Cst, bevel: 0.015, bevelSegments: 1 });
  const zF = zG - 0.42;
  b.latheDir({
    profile: [
      [0, -0.02],
      [0.17, -0.02],
      [0.17, 0.06],
      [0.155, 0.12],
      [0.145, 0.4],
      [0, 0.4],
    ],
    at: [0, yG, zF],
    dir: [0, 0, -1],
    mat: Cst,
    seg: 22,
  });
  b.prismZ({ points: roundRect(0, yG, 0.27, 0.3, 0.07, 3), z0: zF, z1: zF + 0.06, mat: Cst, bevel: 0.012, bevelSegments: 1 });
  b.box({ x: -0.38, y: yG + 0.085, z: zF + 0.03, w: 0.34, h: 0.24, d: 0.06, r: 0.012, mat: Cst });
  b.cyl({ z0: zF + 0.05, z1: zF - 0.03, r0: 0.085, r1: 0.06, x: 0.32, y: yG + 0.04, mat: Cst, seg: 12 }); // boss round the coax MG opening
  const zB = zF - 0.4;
  b.latheDir({
    profile: [
      [0, 0],
      [0.1, 0],
      [0.092, 0.2],
      [0.082, 1.6],
      [0.072, 3.1],
      [0.075, 3.12],
      [0, 3.12],
    ],
    at: [0, yG, zB],
    dir: [0, 0, -1],
    mat: P,
    seg: 18,
  });
  const zMB = zB - 3.12;
  b.latheDir({
    profile: [
      [0, -0.01],
      [0.09, -0.01],
      [0.13, 0.03],
      [0.13, 0.11],
      [0.1, 0.13],
      [0.1, 0.2],
      [0.13, 0.22],
      [0.13, 0.3],
      [0.1, 0.32],
      [0.1, 0.36],
      [0.13, 0.38],
      [0.13, 0.41],
      [0.06, 0.43],
      [0.05, 0.36],
      [0, 0.36],
    ],
    at: [0, yG, zMB],
    dir: [0, 0, -1],
    mat: P,
    seg: 20,
  });
  for (const s of [-1, 1]) for (const dz of [0.07, 0.26]) b.box({ x: s * 0.118, y: yG, z: zMB - dz, w: 0.04, h: 0.16, d: 0.1, r: 0.006, mat: 'dark' });
  b.cyl({ z0: zF + 0.03, z1: zF - 0.06, r0: 0.03, x: 0.32, y: yG + 0.04, mat: 'dark', seg: 10 }); // coax MG port
  b.cyl({ z0: zF - 0.02, z1: zF - 0.08, r0: 0.014, x: 0.32, y: yG + 0.04, mat: 'blued', seg: 8 });
  for (const dx of [-0.28, -0.4]) b.cyl({ z0: zF + 0.03, z1: zF - 0.012, r0: 0.022, x: dx, y: yG + 0.08, mat: 'dark', seg: 10 }); // TZF 9b binocular ports
  b.at('gun', 'muzzle', 0, yG, zMB - 0.43);
  b.at('gun', 'coaxMuzzle', 0.32, yG + 0.04, zF - 0.08);
  b.at('gun', 'gunnerEye', -0.34, yG + 0.08, zF - 0.012);
  b.body();
  b.meta.partParents = { gun: 'turret', pintleMg: 'turret' };

  // ---- Meta, armor, modules -----------------------------------------------------------------
  Object.assign(b.meta, {
    name: 'Tiger I Ausf. E',
    faction: 'de',
    type: 'tracked',
    crew: 5,
    gun: { name: '8.8 cm KwK 36 L/56', caliber: 88 },
    gunElevation: [-9, 10],
    turretTraverse: 6,
    groundClearance: 0.47,
    turretRing: { center: [0, yR, zT], radius: 0.9 },
    specs: { mass: 54000, maxSpeed: 38, power: 690, engine: 'Maybach HL 230 P45', fuel: 540 },
  });
  b.armorZY('nosePlate', 'body', 100, [-3.12, 0.7], [-2.89, 1.22], -1.0, 1.0, [0, 0, -1]);
  b.armorZY('lowerNose', 'body', 60, [-2.75, 0.47], [-3.12, 0.7], -1.0, 1.0, [0, -0.5, -1]);
  b.armorZY('glacis', 'body', 60, [-2.89, 1.22], [-2.42, 1.3], -1.0, 1.0, [0, 1, -0.2]);
  b.armorZY('superFront', 'body', 100, [fz(0.95), 0.95], [fz(1.86), 1.86], -1.79, 1.79, [0, 0, -1]);
  for (const s of [-1, 1]) {
    const L = side(s);
    b.armorXY(`superSide${L}`, 'body', 80, [s * 1.79, 0.95], [s * 1.79, 1.86], fz(1.2), 3.08, [s, 0, 0]);
    b.armorXY(`lowerSide${L}`, 'body', 60, [s * 1.0, 0.47], [s * 1.0, 0.96], -2.75, 3.05, [s, 0, 0]);
    b.armorZY(`sponsonFloor${L}`, 'body', 25, [fz(0.95), 0.95], [3.12, 0.95], s * 1.0, s * 1.79, [0, -1, 0]);
  }
  b.armorZY('rear', 'body', 80, [3.12, 0.95], [3.04, 1.86], -1.79, 1.79, [0, 0, 1]);
  b.armorZY('rearLower', 'body', 60, [2.75, 0.47], [3.12, 0.96], -1.0, 1.0, [0, -0.3, 1]);
  b.armorZY('roof', 'body', 25, [fz(1.86), 1.86], [3.04, 1.86], -1.79, 1.79, [0, 1, 0]);
  b.armorZY('belly', 'body', 25, [-2.75, 0.47], [2.75, 0.47], -1.0, 1.0, [0, -1, 0]);
  b.armorShell('turret', 'turret', plan.map(([x, dz]) => [x, zT + dz]), [1.88, 1], [2.76, 1], [0, zT], (deg) => (deg < 30 ? 100 : 80));
  b.armorPoly('turretRoof', 'turret', 25, L3(2.78, 0.985), [0, 1, 0], 4, [0, 0, 1]);
  b.armor('cupola', 'turret', 110, [cx, 2.89, cz - 0.38], [0.76, 0, 0], [0, 0.24, 0], [0, 0, -1]);
  b.armor('mantlet', 'gun', 120, [0, yG, zF], [1.4, 0, 0], [0, 0.66, 0], [0, 0, -1]);
  b.armor('gunCollar', 'gun', 100, [0, yG, zB], [0.32, 0, 0], [0, 0.32, 0], [0, 0, -1]);
  b.module('engine', 'body', [0, 1.3, 2.2], [0.55, 0.45, 0.65]);
  b.module('transmission', 'body', [0, 0.85, -2.55], [0.65, 0.3, 0.35]);
  for (const s of [-1, 1]) {
    b.module('fuel', 'body', [s * 0.95, 1.35, 1.8], [0.3, 0.4, 0.65]);
    b.module('ammo', 'body', [s * 1.4, 1.35, -0.4], [0.33, 0.35, 1.0]);
  }
  b.module('ammo', 'body', [0, 0.68, -0.3], [0.6, 0.15, 0.4]);
  b.module('driver', 'body', [-0.55, 1.35, -1.95], [0.25, 0.45, 0.3]);
  b.module('radio', 'body', [0.55, 1.35, -1.95], [0.25, 0.45, 0.3]); // radio operator / bow gunner
  b.module('gunner', 'turret', [-0.42, 2.0, zT - 0.45], [0.22, 0.5, 0.28]);
  b.module('commander', 'turret', [cx, 2.3, cz], [0.22, 0.55, 0.28]);
  b.module('loader', 'turret', [0.45, 1.95, zT + 0.1], [0.22, 0.55, 0.28]);
}

// ---------------------------------------------------------------------------------------
// Volkswagen Typ 82 Kübelwagen (1940-45): angular pressed-steel body with four doors, rear
// air-cooled flat four, spare wheel on the sloping front lid, fold-down windshield, top
// folded on the rear deck. 3.74 m long, 1.60 m wide, 1.35 m to the windshield top, 2.40 m
// wheelbase, 1.356 m track, 5.25-16 tires (0.34 m radius), 290 mm ground clearance. Driver
// on the left, 4 seats. Doors are parts hinged at their front edge.
export function kubelwagen(b) {
  const WB = 2.4,
    TRK = 1.356,
    R = 0.34,
    TW = 0.14;
  const zF = -WB / 2,
    zR = WB / 2,
    xw = TRK / 2;
  const P = 'germanGrey';
  // ---- Wheels -------------------------------------------------------------------------------
  const wheel = jeepWheel({ r: R, width: TW, rimR: 0.205, lugs: 16, lugH: 0.011, rimMat: P, splitBolts: 0 });
  for (const [name, x, z] of [
    ['wheelFL', -xw, zF],
    ['wheelFR', xw, zF],
    ['wheelRL', -xw, zR],
    ['wheelRR', xw, zR],
  ]) {
    b.part(name, [x, R, z]).addAll(wheel, { x, y: R, z, ry: x < 0 ? Math.PI : 0 });
  }
  b.body();

  // ---- Chassis: platform floor pan, front beam axle, rear swing axles with portal hubs ----
  b.span({ z0: -1.7, z1: 1.84, y0: 0.4, y1: 0.445, w: 1.3, mat: P, r: 0.01 });
  b.span({ z0: -0.25, z1: 1.2, y0: 0.36, y1: 0.45, w: 0.2, mat: P, r: 0.02 }); // backbone tunnel
  for (const dz of [-0.07, 0.07]) b.cylAxis({ axis: 'x', x: 0, y: 0.44, z: zF + dz, len: 1.12, r: 0.035, mat: P });
  for (const s of [-1, 1]) {
    b.rod({ from: [s * 0.5, 0.44, zF + 0.07], to: [s * 0.6, R, zF], r: 0.03, mat: P });
    b.rod({ from: [s * 0.12, 0.45, zR], to: [s * 0.56, 0.42, zR], r: 0.04, mat: P });
    b.box({ x: s * 0.575, y: 0.38, z: zR, w: 0.07, h: 0.2, d: 0.17, r: 0.02, mat: P }); // portal gear case
  }
  b.box({ x: 0, y: 0.5, z: zR, w: 0.34, h: 0.2, d: 0.3, r: 0.03, mat: P }); // transaxle

  // ---- Body ---------------------------------------------------------------------------------
  const sideOutline = [
    [-1.72, 0.47],
    ...arc(zF, 0.4, 0.41, Math.PI - 0.17, 0.17, 12),
    ...arc(zR, 0.4, 0.41, Math.PI - 0.17, 0.17, 12),
    [1.86, 0.47],
    [1.88, 0.72],
    [1.42, 0.97],
    [-0.6, 0.97],
    [-0.62, 0.96],
    [-1.8, 0.66],
  ];
  const doorF = roundRect(-0.24, 0.73, 0.32, 0.225, 0.04),
    doorR = roundRect(0.45, 0.73, 0.3, 0.225, 0.04);
  for (const s of [-1, 1]) {
    b.prismX({ points: sideOutline, holes: [doorF, doorR], x0: s * 0.71, x1: s * 0.74, mat: P, bevel: 0.006 });
    // Pressed ribs on the front and rear quarters.
    for (const [z0, z1] of [
      [-1.62, -0.6],
      [0.8, 1.7],
    ])
      b.span({ z0, z1, y0: 0.815, y1: 0.835, w: 0.016, x: s * 0.745, mat: P, r: 0.004 });
    // Flat fender shelves over the wheels.
    for (const zc of [zF, zR]) {
      const line = [
        [zc - 0.52, 0.5],
        [zc - 0.4, 0.84],
        [zc + 0.4, 0.84],
        [zc + 0.5, 0.62],
      ];
      b.prismX({ points: ribbon(line, 0.014), x0: s * 0.7, x1: s * 0.8, mat: P, bevel: 0.004 });
    }
  }
  // Doors (parts hinged at the front edge, vertical axis).
  for (const s of [-1, 1]) {
    for (const [name, o, z0] of [
      [`doorF${side(s)}`, doorF, -0.56],
      [`doorR${side(s)}`, doorR, 0.15],
    ]) {
      b.part(name, [s * 0.745, 0.73, z0]);
      const inset = o.map(([z, y]) => [z + (z < z0 + 0.3 ? 0.004 : -0.004) * 1, y + (y > 0.73 ? -0.004 : 0.004)]);
      b.prismX({ points: inset, x0: s * 0.712, x1: s * 0.745, mat: P, bevel: 0.005 });
      b.span({ z0: z0 + 0.04, z1: z0 + 0.6, y0: 0.815, y1: 0.835, w: 0.016, x: s * 0.75, mat: P, r: 0.004 });
      b.box({ x: s * 0.755, y: 0.88, z: z0 + 0.5, w: 0.02, h: 0.02, d: 0.1, r: 0.006, mat: 'steel' }); // handle
      b.meta.hinges[name] = { axis: [0, 1, 0], open: s * 1.2 };
    }
  }
  b.body();
  // Front luggage compartment (fuel tank inside), sloping lid, nose panel.
  b.prismX({
    points: [
      [-1.72, 0.47],
      [-0.62, 0.47],
      [-0.62, 0.96],
      [-1.8, 0.66],
    ],
    x0: -0.52,
    x1: 0.52,
    mat: P,
    bevel: 0.01,
  });
  b.quad({
    p: [
      [-0.735, 0.66, -1.8],
      [0.735, 0.66, -1.8],
      [0.735, 0.96, -0.62],
      [-0.735, 0.96, -0.62],
    ],
    t: 0.02,
    mat: P,
    out: [0, 1, 0],
  });
  b.quad({
    p: [
      [-0.735, 0.47, -1.72],
      [0.735, 0.47, -1.72],
      [0.735, 0.66, -1.8],
      [-0.735, 0.66, -1.8],
    ],
    t: 0.02,
    mat: P,
    out: [0, 0, -1],
  });
  for (const x of [-0.2, 0.2]) b.span({ z0: -1.86, z1: -1.78, y0: 0.5, y1: 0.58, w: 0.06, x, mat: P, r: 0.01 }); // bumper horns
  b.span({ z0: -1.87, z1: -1.83, y0: 0.5, y1: 0.58, w: 1.2, mat: P, r: 0.01 });
  // Spare wheel lying on the front lid.
  {
    const ang = Math.atan2(0.3, 1.18);
    const n = [0, Math.cos(ang), -Math.sin(ang)];
    const zc = -1.2,
      yh = 0.66 + ((1.8 + zc) / 1.18) * 0.3;
    const c = [0, yh + n[1] * (TW / 2 + 0.012), zc + n[2] * (TW / 2 + 0.012)];
    b.addAll(wheel, { x: c[0], y: c[1], z: c[2], ...eulerFromTo([1, 0, 0], n) });
  }
  // Cowl, dash, floor, engine compartment and rear deck with cooling louvers.
  b.span({ z0: -0.64, z1: -0.58, y0: 0.6, y1: 0.965, w: 1.44, mat: P, r: 0.01 });
  b.cyl({ z0: -0.58, z1: -0.574, r0: 0.05, x: 0.0, y: 0.84, mat: 'dark', seg: 16 });
  b.span({ z0: -0.6, z1: 1.05, y0: 0.44, y1: 0.47, w: 1.44, mat: P, r: 0.004 });
  b.prismX({
    points: [
      [1.0, 0.47],
      [1.86, 0.47],
      [1.88, 0.72],
      [1.42, 0.97],
      [1.0, 0.97],
    ],
    x0: -0.56,
    x1: 0.56,
    mat: P,
    bevel: 0.01,
  });
  b.span({ z0: 1.0, z1: 1.43, y0: 0.95, y1: 0.97, w: 1.47, mat: P, r: 0.004 });
  b.quad({
    p: [
      [-0.735, 0.97, 1.42],
      [0.735, 0.97, 1.42],
      [0.735, 0.72, 1.88],
      [-0.735, 0.72, 1.88],
    ],
    t: 0.02,
    mat: P,
    out: [0, 1, 0],
  });
  for (let i = 0; i < 7; i++) {
    const t = 0.18 + i * 0.1;
    const y = 0.97 - 0.25 * t,
      z = 1.42 + 0.46 * t;
    b.box({ x: 0, y: y + 0.004, z, w: 0.9, h: 0.012, d: 0.025, rx: Math.atan2(0.25, 0.46), r: 0.003, mat: 'dark' });
  }
  for (const s of [-1, 1]) {
    b.box({ x: s * 0.6, y: 0.8, z: 1.84, w: 0.07, h: 0.05, d: 0.04, r: 0.008, mat: 'redLamp' });
    b.cyl({ z0: 1.82, z1: 1.94, r0: 0.022, x: s * 0.1, y: 0.43, mat: 'black', seg: 10 });
    b.anchor(`exhaust${side(s)}`, s * 0.1, 0.43, 1.94);
  }
  b.cylAxis({ axis: 'x', x: 0, y: 0.44, z: 1.8, len: 0.4, r: 0.08, mat: 'black' }); // muffler
  // Headlights on the fenders, Notek blackout lamp.
  for (const s of [-1, 1]) {
    b.cylAxis({ axis: 'y', x: s * 0.6, y: 0.87, z: -1.42, len: 0.06, r: 0.015, mat: P, seg: 8 });
    b.cyl({ z0: -1.52, z1: -1.38, r0: 0.075, r1: 0.06, x: s * 0.6, y: 0.93, mat: P, seg: 16 });
    b.cyl({ z0: -1.526, z1: -1.518, r0: 0.066, x: s * 0.6, y: 0.93, mat: 'lamp', seg: 16 });
    b.anchor(`headlight${side(s)}`, s * 0.6, 0.93, -1.53);
  }
  b.box({ x: -0.62, y: 0.87, z: -1.66, w: 0.1, h: 0.05, d: 0.06, r: 0.01, mat: P });
  // Windshield (folds forward onto the lid).
  const hz = -0.6,
    hy = 0.965;
  b.part('windshield', [0, hy, hz]);
  const bar = (x0, x1, y0, y1) => b.span({ z0: hz - 0.016, z1: hz + 0.016, y0, y1, w: x1 - x0, x: (x0 + x1) / 2, mat: P, r: 0.008 });
  bar(-0.7, 0.7, hy, hy + 0.035);
  bar(-0.7, 0.7, 1.31, 1.345);
  bar(-0.7, -0.665, hy, 1.345);
  bar(0.665, 0.7, hy, 1.345);
  b.span({ z0: hz - 0.003, z1: hz + 0.003, y0: hy + 0.035, y1: 1.31, w: 1.33, mat: 'glass' });
  b.body();
  b.meta.hinges.windshield = { axis: [1, 0, 0], open: -1.35 };
  // Steering wheel, seats, folded top.
  steeringWheel(b, { hub: [-0.33, 1.0, -0.33], col: [0, 0.55, 0.835], r: 0.2, spokes: [-Math.PI / 2 + 0.5, -Math.PI / 2 - 0.5, Math.PI / 2 + Math.PI], columnLen: 0.75 });
  const seat = (x, z, w) => {
    b.box({ x, y: 0.635, z, w, h: 0.09, d: 0.42, r: 0.035, mat: 'canvasGerman' });
    b.box({ x, y: 0.93, z: z + 0.24, w, h: 0.42, d: 0.07, r: 0.03, rx: 0.15, mat: 'canvasGerman' });
    b.box({ x, y: 0.53, z, w: w - 0.04, h: 0.12, d: 0.38, r: 0.01, mat: P });
  };
  seat(-0.33, 0.06, 0.44);
  seat(0.33, 0.06, 0.44);
  b.box({ x: 0, y: 0.6, z: 0.76, w: 1.2, h: 0.24, d: 0.38, r: 0.01, mat: P });
  b.box({ x: 0, y: 0.755, z: 0.76, w: 1.22, h: 0.08, d: 0.42, r: 0.035, mat: 'canvasGerman' });
  b.box({ x: 0, y: 0.95, z: 0.99, w: 1.22, h: 0.36, d: 0.06, r: 0.03, rx: 0.12, mat: 'canvasGerman' });
  b.box({ x: 0, y: 1.035, z: 1.24, w: 1.34, h: 0.13, d: 0.26, r: 0.06, mat: 'canvasGerman' });
  for (const s of [-1, 1]) b.rod({ from: [s * 0.75, 0.95, 0.95], to: [s * 0.75, 1.05, 1.4], r: 0.011, mat: P });

  // ---- Anchors, meta ---------------------------------------------------------------------------
  b.anchor('driverSeat', -0.33, 0.76, 0.1);
  b.anchor('driverEye', -0.33, 1.44, 0.03);
  b.anchor('seat1', 0.33, 0.76, 0.1);
  b.anchor('seat2', -0.3, 0.86, 0.8);
  b.anchor('seat3', 0.3, 0.86, 0.8);
  Object.assign(b.meta, {
    name: 'Kübelwagen Typ 82',
    faction: 'de',
    type: 'wheeled',
    crew: 1,
    seats: 4,
    wheelRadius: R,
    wheelWidth: TW,
    wheelbase: WB,
    trackWidth: TRK,
    groundClearance: 0.29,
    maxSteer: 0.55,
    wheels: { wheelFL: [-xw, R, zF], wheelFR: [xw, R, zF], wheelRL: [-xw, R, zR], wheelRR: [xw, R, zR] },
    specs: { mass: 725, maxSpeed: 80, power: 25, fuel: 40, range: 450, drive: '4x2, rear engine' },
  });
  b.armorZY('front', 'body', 0, [-1.72, 0.47], [-1.8, 0.66], -0.735, 0.735, [0, 0, -1]);
  b.armorZY('hood', 'body', 0, [-1.8, 0.66], [-0.62, 0.96], -0.735, 0.735, [0, 1, 0]);
  for (const s of [-1, 1]) b.armorXY(`side${side(s)}`, 'body', 0, [s * 0.74, 0.46], [s * 0.74, 0.97], -1.75, 1.87, [s, 0, 0]);
  b.armorZY('rear', 'body', 0, [1.86, 0.47], [1.88, 0.72], -0.735, 0.735, [0, 0, 1]);
  b.armorZY('engineLid', 'body', 0, [1.42, 0.97], [1.88, 0.72], -0.735, 0.735, [0, 1, 1]);
  b.armorZY('floor', 'body', 0, [-1.7, 0.4], [1.84, 0.4], -0.65, 0.65, [0, -1, 0]);
  b.armorZY('windshield', 'body', 0, [hz, hy], [hz, 1.345], -0.7, 0.7, [0, 0, -1]);
  b.module('engine', 'body', [0, 0.66, 1.48], [0.42, 0.2, 0.34]);
  b.module('fuel', 'body', [0, 0.62, -1.15], [0.35, 0.1, 0.25]);
  b.module('driver', 'body', [-0.33, 1.0, 0.05], [0.22, 0.42, 0.25]);
}

// ---------------------------------------------------------------------------------------
// Opel Blitz 3.6-36S (3-ton 4x2 truck): long hood, steel cab with two doors (front-hinged
// parts), crowned front fenders with the headlamps, dual rear wheels, open cargo bed with
// drop sides and troop benches. 6.02 m long, 2.265 m wide, 2.18 m high (cab), 3.60 m
// wheelbase, 1.64 m front track, 7.50-20 tires (0.445 m radius). wheelRL/RR carry both
// tires of the dual pair. Seats: driver + cab passenger (seat1) + 12 on the benches.
export function opel_blitz(b) {
  const WB = 3.6,
    TRK = 1.64,
    R = 0.445,
    TW = 0.19;
  const zF = -WB / 2,
    zR = WB / 2,
    xw = TRK / 2;
  const P = 'germanGrey';
  // ---- Wheels -------------------------------------------------------------------------------
  const wheel = jeepWheel({ r: R, width: TW, rimR: 0.254, lugs: 22, lugH: 0.014, rimMat: P, splitBolts: 0, nuts: 8 });
  const dual = [...wheel.map((it) => ({ mat: it.mat, geo: it.geo.clone().translate(0.105, 0, 0) })), ...wheel.map((it) => ({ mat: it.mat, geo: it.geo.clone().rotateY(Math.PI).translate(-0.105, 0, 0) }))];
  for (const [name, x, z, items] of [
    ['wheelFL', -xw, zF, wheel],
    ['wheelFR', xw, zF, wheel],
    ['wheelRL', -0.8, zR, dual],
    ['wheelRR', 0.8, zR, dual],
  ]) {
    b.part(name, [x, R, z]).addAll(items, { x, y: R, z, ry: x < 0 ? Math.PI : 0 });
  }
  b.body();

  // ---- Chassis ----------------------------------------------------------------------------------
  for (const s of [-1, 1]) b.span({ z0: -2.72, z1: 3.22, y0: 0.7, y1: 0.88, w: 0.07, x: s * 0.45, mat: 'black', r: 0.01 });
  b.span({ z0: -2.82, z1: -2.72, y0: 0.6, y1: 0.75, w: 2.0, mat: 'black', r: 0.012 }); // bumper
  b.cylAxis({ axis: 'x', x: 0, y: R + 0.02, z: zF, len: TRK - 0.2, r: 0.05, mat: 'black' });
  b.cylAxis({ axis: 'x', x: 0, y: R, z: zR, len: 1.3, r: 0.065, mat: 'black' });
  b.sphere({ x: 0, y: R, z: zR, r: 0.18, sz: 1.1, mat: 'black' });
  for (const s of [-1, 1])
    for (const [z, L] of [
      [zF, 1.2],
      [zR, 1.4],
    ]) {
      const line = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        line.push([z - L / 2 + L * t, R + 0.16 + 0.08 * (2 * t - 1) ** 2]);
      }
      b.prismX({ points: ribbon(line, 0.06), x0: s * 0.45 - 0.035, x1: s * 0.45 + 0.035, mat: 'black', bevel: 0.005 });
    }
  b.rod({ from: [0, 0.75, -1.0], to: [0, R + 0.05, zR - 0.15], r: 0.04, mat: 'black' }); // drive shaft
  b.cyl({ z0: 0.05, z1: 0.75, r0: 0.2, x: 0.75, y: 0.86, mat: P }); // fuel tank
  b.cyl({ z0: -0.6, z1: 0.6, r0: 0.03, x: 0.6, y: 0.62, mat: 'black' });
  b.anchor('exhaustR', 0.6, 0.62, 0.62);
  b.box({ x: 0, y: 0.95, z: -1.95, w: 0.6, h: 0.5, d: 0.95, r: 0.05, mat: 'black' }); // engine

  // ---- Hood, grille, fenders, lamps -------------------------------------------------------
  b.convex({ points: [...section(-2.62, 0.4, 0.95, 1.5, 0.12, 0.02), ...section(-1.04, 0.43, 0.95, 1.58, 0.14, 0.02)], mat: P, crease: 0.5 });
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) b.box({ x: s * 0.428, y: 1.28, z: -1.95 + i * 0.09, w: 0.008, h: 0.18, d: 0.035, r: 0.002, mat: 'dark' }); // louvers
  const grilleO = [[-0.38, 0.92], [0.38, 0.92], [0.38, 1.4], ...arc(0, 1.4, 0.38, 0, Math.PI, 12).slice(1, -1), [-0.38, 1.4]];
  const bars = [];
  for (let i = -6; i <= 6; i++) bars.push(slotV(i * 0.05, 1.2, 0.015, 0.24));
  b.prismZ({ points: grilleO, holes: bars, z0: -2.68, z1: -2.63, mat: P, bevel: 0.006 });
  b.span({ z0: -2.63, z1: -2.55, y0: 0.95, y1: 1.6, w: 0.7, mat: 'dark' });
  for (const s of [-1, 1]) {
    const fl = [...arc(zF, 0.5, 0.6, Math.PI - 0.32, 0.6, 14), [-1.12, 0.9], [-0.04, 0.9]];
    b.prismX({ points: ribbon(fl, 0.022), x0: s * 0.58, x1: s * 1.05, mat: P, bevel: 0.008 });
    b.cylAxis({ axis: 'y', x: s * 0.72, y: 1.12, z: -2.3, len: 0.1, r: 0.02, mat: P, seg: 8 });
    b.cyl({ z0: -2.42, z1: -2.24, r0: 0.11, r1: 0.085, x: s * 0.72, y: 1.25, mat: P, seg: 18 });
    b.cyl({ z0: -2.428, z1: -2.418, r0: 0.098, x: s * 0.72, y: 1.25, mat: 'lamp', seg: 18 });
    b.anchor(`headlight${side(s)}`, s * 0.72, 1.25, -2.43);
  }

  // ---- Cab ----------------------------------------------------------------------------------
  b.convex({
    points: [
      ...section(-1.04, 0.95, 0.95, 1.58, 0.05, 0.02),
      ...section(-0.97, 0.96, 0.95, 2.06, 0.12, 0.02),
      ...section(-0.86, 0.96, 0.95, 2.17, 0.16, 0.02),
      ...section(-0.1, 0.96, 0.95, 2.18, 0.16, 0.02),
      ...section(-0.04, 0.95, 0.95, 2.15, 0.12, 0.02),
    ],
    mat: P,
    crease: 0.45,
  });
  const wsN = [0, Math.sin(9 * DEG), -Math.cos(9 * DEG)];
  for (const s of [-1, 1])
    b.quad({
      p: [
        [s * 0.05, 1.62, -1.02],
        [s * 0.86, 1.62, -1.02],
        [s * 0.86, 2.0, -0.96],
        [s * 0.05, 2.0, -0.96],
      ].map((p) => [p[0] + wsN[0] * 0.004, p[1] + wsN[1] * 0.004, p[2] + wsN[2] * 0.004]),
      t: 0.006,
      mat: 'glass',
    });
  b.span({ z0: -0.04, z1: -0.03, y0: 1.72, y1: 1.98, w: 0.9, mat: 'glass' }); // rear window
  // Doors (front-hinged) with windows.
  for (const s of [-1, 1]) {
    const name = `doorF${side(s)}`;
    b.part(name, [s * 0.975, 1.5, -0.92]);
    b.prismX({
      points: [
        [-0.92, 0.98],
        [-0.22, 0.98],
        [-0.22, 2.05],
        [-0.88, 2.05],
        [-0.92, 1.6],
      ],
      holes: [roundRect(-0.56, 1.82, 0.28, 0.17, 0.03)],
      x0: s * 0.955,
      x1: s * 0.975,
      mat: P,
      bevel: 0.005,
    });
    b.span({ z0: -0.84, z1: -0.28, y0: 1.65, y1: 1.99, w: 0.006, x: s * 0.963, mat: 'glass' });
    b.box({ x: s * 0.985, y: 1.5, z: -0.3, w: 0.02, h: 0.03, d: 0.1, r: 0.006, mat: 'steel' });
    b.meta.hinges[name] = { axis: [0, 1, 0], open: s * 1.2 };
  }
  b.body();
  for (const s of [-1, 1]) b.cylAxis({ axis: 'x', x: s * 1.05, y: 1.95, z: -0.98, len: 0.16, r: 0.012, mat: 'black', seg: 8 }); // mirror arms
  steeringWheel(b, { hub: [-0.45, 1.72, -0.78], col: [0, 0.8, 0.6], r: 0.23, spokes: [0, Math.PI, -Math.PI / 2], columnLen: 0.9 });
  b.box({ x: 0, y: 1.25, z: -0.32, w: 1.7, h: 0.1, d: 0.45, r: 0.03, mat: 'leather' }); // bench seat
  b.box({ x: 0, y: 1.55, z: -0.12, w: 1.7, h: 0.5, d: 0.08, r: 0.03, mat: 'leather' });

  // ---- Cargo bed: floor, headboard, drop sides, tailgate, benches, mudguards ------------------
  const bz0 = 0.02,
    bz1 = 3.24,
    bw = 1.1,
    fy = 1.17;
  b.span({ z0: bz0, z1: bz1, y0: 1.1, y1: fy, w: 2 * bw, mat: P, r: 0.008 });
  for (let i = 0; i < 6; i++) b.span({ z0: 0.2 + i * 0.6, z1: 0.28 + i * 0.6, y0: 0.88, y1: 1.1, w: 2.1, mat: 'black', r: 0.01 });
  const planks = (fn) => {
    for (let k = 0; k < 3; k++) fn(fy + 0.01 + k * 0.155, fy + 0.155 + k * 0.155);
  };
  planks((y0, y1) => b.span({ z0: bz0, z1: bz0 + 0.05, y0, y1: y1 + (y1 > 1.6 ? 0.25 : 0), w: 2 * bw, mat: P, r: 0.006 }));
  for (const s of [-1, 1]) planks((y0, y1) => b.span({ z0: bz0, z1: bz1, y0, y1, w: 0.04, x: s * (bw - 0.02), mat: P, r: 0.006 }));
  planks((y0, y1) => b.span({ z0: bz1 - 0.04, z1: bz1, y0, y1, w: 2 * bw, mat: P, r: 0.006 }));
  for (const s of [-1, 1]) {
    for (const z of [0.6, 1.6, 2.6]) b.span({ z0: z - 0.03, z1: z + 0.03, y0: fy, y1: fy + 0.47, w: 0.05, x: s * (bw + 0.005), mat: 'black', r: 0.006 }); // stakes
    b.span({ z0: 0.3, z1: 3.05, y0: fy + 0.38, y1: fy + 0.43, w: 0.32, x: s * 0.86, mat: 'wood', r: 0.01 }); // bench
    for (const z of [0.35, 1.7, 3.0]) b.span({ z0: z - 0.03, z1: z + 0.03, y0: fy, y1: fy + 0.38, w: 0.05, x: s * 0.86, mat: 'black' });
    b.span({ z0: zR - 0.6, z1: zR + 0.62, y0: 1.04, y1: 1.06, w: 0.5, x: s * 0.8, mat: 'black', r: 0.004 }); // rear mudguards
    b.box({ x: s * 0.95, y: 0.98, z: 3.2, w: 0.08, h: 0.06, d: 0.04, r: 0.008, mat: 'redLamp' });
  }

  // ---- Anchors, meta ---------------------------------------------------------------------------
  b.anchor('driverSeat', -0.45, 1.36, -0.34);
  b.anchor('driverEye', -0.45, 2.0, -0.42);
  b.anchor('seat1', 0.45, 1.36, -0.34);
  let n = 2;
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.anchor(`seat${n++}`, s * 0.86, fy + 0.5, 0.45 + i * 0.47);
  Object.assign(b.meta, {
    name: 'Opel Blitz 3.6-36S',
    faction: 'de',
    type: 'wheeled',
    crew: 1,
    seats: 14,
    wheelRadius: R,
    wheelWidth: TW,
    wheelbase: WB,
    trackWidth: TRK,
    rearTrackWidth: 1.6,
    dualRear: true,
    groundClearance: 0.26,
    maxSteer: 0.6,
    wheels: { wheelFL: [-xw, R, zF], wheelFR: [xw, R, zF], wheelRL: [-0.8, R, zR], wheelRR: [0.8, R, zR] },
    specs: { mass: 3290, payload: 3300, maxSpeed: 85, power: 75, fuel: 82, range: 410, drive: '4x2' },
  });
  b.armorZY('grille', 'body', 0, [-2.68, 0.92], [-2.68, 1.6], -0.4, 0.4, [0, 0, -1]);
  b.armorZY('hood', 'body', 0, [-2.62, 1.52], [-1.04, 1.58], -0.43, 0.43, [0, 1, 0]);
  b.armorZY('cabFront', 'body', 0, [-1.04, 0.95], [-0.96, 2.06], -0.96, 0.96, [0, 0, -1]);
  for (const s of [-1, 1]) b.armorXY(`cabSide${side(s)}`, 'body', 0, [s * 0.96, 0.95], [s * 0.96, 2.18], -1.04, -0.04, [s, 0, 0]);
  b.armorZY('cabRoof', 'body', 0, [-0.9, 2.18], [-0.04, 2.18], -0.96, 0.96, [0, 1, 0]);
  b.armorZY('cabRear', 'body', 0, [-0.04, 0.95], [-0.04, 2.15], -0.96, 0.96, [0, 0, 1]);
  for (const s of [-1, 1]) b.armorXY(`bedSide${side(s)}`, 'body', 0, [s * bw, fy], [s * bw, fy + 0.47], bz0, bz1, [s, 0, 0]);
  b.armorZY('bedFloor', 'body', 0, [bz0, 1.1], [bz1, 1.1], -bw, bw, [0, -1, 0]);
  b.armorZY('tailgate', 'body', 0, [bz1, fy], [bz1, fy + 0.47], -bw, bw, [0, 0, 1]);
  b.module('engine', 'body', [0, 1.05, -1.95], [0.32, 0.3, 0.5]);
  b.module('fuel', 'body', [0.75, 0.86, 0.4], [0.2, 0.2, 0.35]);
  b.module('driver', 'body', [-0.45, 1.7, -0.4], [0.24, 0.45, 0.28]);
}
