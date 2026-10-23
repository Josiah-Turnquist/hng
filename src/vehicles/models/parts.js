// Shared vehicle sub-assemblies: tires, road wheels, sprockets, return rollers, simple
// fittings. Each factory returns a list of { geo, mat } in a LOCAL frame with the wheel
// axis along X, centered at the origin, outer face toward +X; place it with
// b.addAll(items, { x, y, z, ry: Math.PI }) (ry = PI turns the outer face to -X for the
// left side). Not a model registry.
import { latheGeo, prismGeoX, gear, circle, TAU, trackPath, pathLength } from './vkit.js';

// Hexagon outlines (bolt heads / nuts) on a ring of radius rr in the side view.
export function boltRing(n, rr, size, phase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * TAU;
    out.push(circle(size, 6, rr * Math.cos(a), rr * Math.sin(a), Math.PI / 6));
  }
  return out;
}

// Military tire (non-directional bar tread) on a steel disc rim. r = outer radius over the
// lugs (the rolling radius), width = section width, rimR = bead seat radius.
export function jeepWheel({ r, width, rimR = 0.205, lugs = 18, lugH = 0.012, rimMat = 'od', nuts = 5, splitBolts = 10 }) {
  const W = width / 2,
    Rb = r - lugH;
  const items = [];
  items.push({
    mat: 'rubber',
    geo: latheGeo(
      [
        [rimR + 0.002, -W + 0.024],
        [rimR + 0.022, -W + 0.004],
        [(rimR + Rb) / 2, -W],
        [Rb - 0.026, -W + 0.003],
        [Rb - 0.008, -W + 0.017],
        [Rb, -W + 0.036],
        [Rb, W - 0.036],
        [Rb - 0.008, W - 0.017],
        [Rb - 0.026, W - 0.003],
        [(rimR + Rb) / 2, W],
        [rimR + 0.022, W - 0.004],
        [rimR + 0.002, W - 0.024],
        [rimR + 0.002, -W + 0.024],
      ],
      { seg: 36, crease: 0.9 },
    ),
  });
  // Tread: two staggered rows of bars.
  const row = (x0, x1, phase) => prismGeoX(gear(lugs, Rb - 0.004, r, { tooth: 0.42, tip: 0.36, phase, rootSeg: 2 }), x0, x1, { bevel: 0 });
  items.push({ mat: 'rubber', geo: row(-W + 0.014, -0.005, 0) });
  items.push({ mat: 'rubber', geo: row(0.005, W - 0.014, Math.PI / lugs) });
  // Disc rim with the hub boss.
  items.push({
    mat: rimMat,
    geo: latheGeo(
      [
        [0, 0.04],
        [0.05, 0.04],
        [0.066, 0.034],
        [0.08, 0.016],
        [0.13, 0.012],
        [0.165, 0.016],
        [0.178, 0.03],
        [rimR - 0.006, 0.042],
        [rimR + 0.008, W - 0.028],
        [rimR + 0.012, W - 0.02],
        [rimR + 0.004, W - 0.016],
        [rimR - 0.008, 0.0],
        [rimR + 0.004, -W + 0.016],
        [rimR + 0.012, -W + 0.02],
        [rimR + 0.008, -W + 0.028],
        [rimR - 0.012, -0.03],
        [0.12, -0.02],
        [0, -0.02],
      ],
      { seg: 32, crease: 0.6 },
    ),
  });
  if (nuts) items.push({ mat: 'steel', geo: prismGeoX(boltRing(nuts, 0.052, 0.011), 0.04, 0.056, { bevel: 0 }) });
  if (splitBolts) items.push({ mat: rimMat, geo: prismGeoX(boltRing(splitBolts, 0.148, 0.008), 0.012, 0.024, { bevel: 0 }) });
  items.push({
    mat: rimMat,
    geo: latheGeo(
      [
        [0, 0.072],
        [0.022, 0.07],
        [0.034, 0.06],
        [0.036, 0.04],
        [0, 0.04],
      ],
      { seg: 16 },
    ),
  });
  return items;
}

// Tank road wheel: steel disc(s) with rubber tire(s). width = total width over both halves
// of a dual wheel, gap = space between the halves for the track guide horns (0 = single).
// tire = rubber depth. dish = how far the disc face is recessed. holes = lightening holes
// (count) cut through the disc as a separate plate (spoked look).
export function roadWheel({ r, width, gap = 0, tire = 0.035, dish = 0.02, hubR = 0.075, hubLen = 0.045, mat, bolts = 0, boltR = 0, rubber = true, holes = 0, holeR = 0, seg = 24 }) {
  const b = width / 2,
    a = gap / 2;
  const rt = rubber ? r - tire : r;
  const items = [];
  if (rubber) {
    const prof = [
      [rt, b],
      [r - 0.01, b],
      [r, b - 0.01],
      [r, gap ? a + 0.01 : -b + 0.01],
    ];
    if (gap) prof.push([r - 0.01, a], [rt, a], [rt, -a], [r - 0.01, -a], [r, -a - 0.01], [r, -b + 0.01]);
    prof.push([r - 0.01, -b], [rt, -b], [rt, b]);
    items.push({ mat: 'rubber', geo: latheGeo(prof, { seg, crease: 0.9 }) });
  }
  const rim = Math.min(0.02, rt * 0.1);
  const prof = [
    [0, b + hubLen],
    [hubR * 0.75, b + hubLen],
    [hubR, b + hubLen - 0.012],
    [hubR, b - dish + 0.008],
    [hubR + 0.018, b - dish],
    [rt - rim - 0.012, b - dish * 0.35],
    [rt - rim, b],
    [rt + 0.002, b],
  ];
  if (gap) prof.push([rt + 0.002, a], [rt * 0.62, a], [rt * 0.62, -a], [rt + 0.002, -a]);
  prof.push([rt + 0.002, -b], [rt - rim, -b], [rt - rim - 0.012, -b + dish * 0.35], [hubR + 0.018, -b + dish], [hubR * 0.9, -b - 0.012], [0, -b - 0.012]);
  items.push({ mat, geo: latheGeo(prof, { seg, crease: 0.6 }) });
  if (bolts) items.push({ mat, geo: prismGeoX(boltRing(bolts, boltR || hubR * 0.7, Math.max(0.008, hubR * 0.12)), b + hubLen - 0.004, b + hubLen + 0.012, { bevel: 0 }) });
  if (holes) {
    // A pierced plate standing proud of the dished face: reads as a spoked/holed disc.
    const ring = [];
    const rr = (hubR + rt - rim) / 2;
    for (let i = 0; i < holes; i++) {
      const ang = (i / holes) * TAU;
      ring.push(circle(holeR || (rt - hubR) * 0.28, 12, rr * Math.cos(ang), rr * Math.sin(ang)));
    }
    items.push({ mat, geo: prismGeoX(circle(rt - rim - 0.004, seg), b - dish * 0.6, b - dish * 0.6 + 0.012, { holes: ring, bevel: 0.002, bevelSegments: 1 }) });
  }
  return items;
}

// Drive sprocket: two toothed rings at x = +-ringGap/2 around a hub drum, with a domed
// outer hub. n teeth, r0 root radius, r1 tip radius, t ring thickness.
export function sprocket({ n, r0, r1, ringGap, t = 0.035, drumR, hubR = 0.12, hubLen = 0.08, mat, toothMat = mat, bolts = 0, tooth = 0.5, tip = 0.22, outerOnly = false }) {
  const items = [];
  const ring = gear(n, r0, r1, { tooth, tip, phase: 0 });
  const hole = circle(drumR * 0.85, 24);
  const halves = outerOnly ? [ringGap / 2] : [-ringGap / 2, ringGap / 2];
  for (const x of halves) items.push({ mat: toothMat, geo: prismGeoX(ring, x - t / 2, x + t / 2, { holes: [hole], bevel: 0.004, bevelSegments: 1 }) });
  // Drum between (and slightly beyond) the rings, outer disc and hub boss.
  const xo = ringGap / 2 + t / 2,
    xi = -ringGap / 2 - t / 2;
  items.push({
    mat,
    geo: latheGeo(
      [
        [0, xo + hubLen],
        [hubR * 0.7, xo + hubLen],
        [hubR, xo + hubLen - 0.015],
        [hubR, xo + 0.02],
        [hubR + 0.02, xo + 0.008],
        [r0 * 0.94, xo],
        [r0 * 0.94, xo - t * 0.6],
        [drumR, xo - t],
        [drumR, xi + t],
        [r0 * 0.94, xi + t * 0.6],
        [r0 * 0.94, xi],
        [drumR * 0.8, xi - 0.02],
        [0, xi - 0.02],
      ],
      { seg: 32, crease: 0.6 },
    ),
  });
  if (bolts) items.push({ mat, geo: prismGeoX(boltRing(bolts, (hubR + r0 * 0.94) / 2, 0.012), xo - 0.002, xo + 0.016, { bevel: 0 }) });
  return items;
}

// Small return roller (rubber-tired or steel), axis X.
export function roller({ r, width, mat, rubber = true, hubLen = 0.03 }) {
  return roadWheel({ r, width, tire: rubber ? Math.min(0.025, r * 0.25) : 0, rubber, dish: 0.012, hubR: r * 0.42, hubLen, mat, bolts: 0, seg: 16 });
}

// Tracked running gear: creates the parts road{L,R}{i}, roller{L,R}{i}, sprocket{L,R} and
// idler{L,R} (pivots at their centers) from local item lists, and fills meta.track.
//   wheels: [[z, y], ...] road wheel centers, front to rear (index 0 = front)
//   wheel: item list for every road wheel station, or (index, side) => item list
//   rollers: [[z, y], ...] return roller centers (any order), [] for none
//   sprocket / idler: { z, y, items, r }: r = track centerline radius around it (pitch
//     radius for the sprocket, rim radius + linkThickness / 2 for the idler)
//   wheelR, rollerR: rim radii of road wheels and rollers
//   track: { width, pitch, thick, offsetX, sag = 0, realLinks, rollerX = offsetX }
export function runningGear(b, { wheels, wheel, wheelR, rollers = [], roller: rollerItems = null, rollerR = 0, rollerX = null, sprocket: spr, idler, track }) {
  const { offsetX } = track;
  const h = track.thick / 2;
  for (const s of [-1, 1]) {
    const S = s < 0 ? 'L' : 'R';
    const ry = s < 0 ? Math.PI : 0;
    wheels.forEach(([z, y], i) => b.part(`road${S}${i}`, [s * offsetX, y, z]).addAll(typeof wheel === 'function' ? wheel(i, s) : wheel, { x: s * offsetX, y, z, ry }));
    const rx = (rollerX ?? offsetX) * s;
    rollers.forEach(([z, y], i) => b.part(`roller${S}${i}`, [rx, y, z]).addAll(rollerItems, { x: rx, y, z, ry }));
    b.part(`sprocket${S}`, [s * offsetX, spr.y, spr.z]).addAll(spr.items, { x: s * offsetX, y: spr.y, z: spr.z, ry });
    b.part(`idler${S}`, [s * offsetX, idler.y, idler.z]).addAll(idler.items, { x: s * offsetX, y: idler.y, z: idler.z, ry });
  }
  b.body();
  // Guide circles in link travel order for forward driving (counterclockwise in z-y): along
  // the top from the rear, around the front, back under the road wheels.
  const rear = spr.z > idler.z ? { ...spr, kind: 'sprocket', part: 'sprocket' } : { ...idler, kind: 'idler', part: 'idler' };
  const front = spr.z > idler.z ? { ...idler, kind: 'idler', part: 'idler' } : { ...spr, kind: 'sprocket', part: 'sprocket' };
  const top = [
    ...wheels.map(([z, y], i) => ({ kind: 'road', part: `road${i}`, z, y, r: wheelR + h })),
    ...rollers.map(([z, y], i) => ({ kind: 'roller', part: `roller${i}`, z, y, r: rollerR + h })),
  ].sort((a, c) => c.z - a.z);
  const bottom = wheels.map(([z, y], i) => ({ kind: 'road', part: `road${i}`, z, y, r: wheelR + h }));
  const guides = [rear, ...top, front, ...bottom].map(({ kind, part, z, y, r }) => ({ kind, part, z, y, r }));
  const path = trackPath(guides, { sag: track.sag || 0 });
  const length = pathLength(path);
  b.meta.track = {
    width: track.width,
    pitch: track.pitch,
    linkThickness: track.thick,
    offsetX,
    path,
    length: Math.round(length * 1000) / 1000,
    links: Math.round(length / track.pitch),
    realLinks: track.realLinks,
    sag: track.sag || 0,
    guides,
    sprocketRadius: spr.r,
    sprocketTeeth: spr.teeth,
    idlerRadius: idler.r - h,
    rollerRadius: rollerR,
  };
  b.meta.roadWheelRadius = wheelR;
  b.meta.roadWheels = { count: wheels.length, z: wheels.map((w) => w[0]), y: wheels[0][1] };
  b.meta.wheelbase = Math.round((wheels[wheels.length - 1][0] - wheels[0][0]) * 1000) / 1000;
  b.meta.trackWidth = 2 * offsetX;
  return b.meta.track;
}

// Steering wheel as the part 'steeringWheel' (pivot at the hub) plus its column in the body.
// col = unit vector of the column axis pointing from the dash toward the driver; spokes =
// angles (radians) in the wheel plane, 0 = toward +X, PI/2 = toward the top of the wheel.
export function steeringWheel(b, { hub, col, r = 0.2, spokes = [0, Math.PI, -Math.PI / 2], columnLen = 0.85, mat = 'black' }) {
  const along = (t) => [hub[0] + col[0] * t, hub[1] + col[1] * t, hub[2] + col[2] * t];
  b.rod({ from: along(-0.05), to: along(-columnLen), r: 0.022, mat });
  b.part('steeringWheel', hub);
  b.latheDir({ profile: torusProfileLocal(r, 0.0125), at: hub, dir: col, mat, seg: 36 });
  b.latheDir({
    profile: [
      [0, 0.025],
      [0.032, 0.02],
      [0.04, -0.02],
      [0, -0.03],
    ],
    at: hub,
    dir: col,
    mat,
    seg: 16,
  });
  // In-plane basis: e1 = +X projected off the column, e2 = col x e1 (top of the wheel).
  const c = col;
  let e1 = [1 - c[0] * c[0], -c[0] * c[1], -c[0] * c[2]];
  const l1 = Math.hypot(...e1);
  e1 = e1.map((v) => v / l1);
  const e2 = [c[1] * e1[2] - c[2] * e1[1], c[2] * e1[0] - c[0] * e1[2], c[0] * e1[1] - c[1] * e1[0]];
  for (const a of spokes) {
    const d = [0, 1, 2].map((k) => Math.cos(a) * e1[k] + Math.sin(a) * e2[k]);
    const p0 = [0, 1, 2].map((k) => hub[k] + d[k] * 0.03);
    const p1 = [0, 1, 2].map((k) => hub[k] + d[k] * (r - 0.008) - c[k] * 0.015);
    b.rod({ from: p0, to: p1, r: 0.007, mat: 'steel' });
  }
  b.body();
  b.anchor('steeringHub', hub[0], hub[1], hub[2]);
  b.meta.anchorParts.steeringHub = 'steeringWheel';
  b.meta.steeringAxis = col;
}

function torusProfileLocal(R, t, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([R + t * Math.cos(a), t * Math.sin(a)]);
  }
  return out;
}
