// The battle map (src/ui/battleMap.js) without a browser: where things land on the
// canvas and back, which spawn a click picks, the opening points of a map, and the
// ground painter's colors and relief on a small heightfield.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleMap, mapPoints, paintGround } from '../src/ui/battleMap.js';
import { MAPS } from '../src/world/maps.js';
import { Heightfield, SURF } from '../src/world/heightfield.js';

// A canvas whose 2D context accepts every call and draws nothing.
function fakeCanvas(w, h) {
  const ctx = new Proxy(
    {},
    {
      get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^(create|measure)/.test(k) ? () => ({ addColorStop() {}, width: 10 }) : () => {}),
      set: (t, k, v) => ((t[k] = v), true),
    },
  );
  return { width: 300, height: 150, clientWidth: w, clientHeight: h, getContext: () => ctx };
}

const town = MAPS.town;

test('world positions go to the canvas and back, north up and east right', () => {
  const canvas = fakeCanvas(800, 600);
  const map = new BattleMap(canvas, town, { preview: false, dpr: 1 });
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 600);
  // The battlefield's center is the canvas's.
  assert.deepEqual(map.toMap(0, 0), [400, 300]);
  const [ex, ey] = map.toMap(100, 0);
  const [nx, ny] = map.toMap(0, -100);
  assert.ok(ex > 400 && Math.abs(ey - 300) < 1e-9, 'east is to the right');
  assert.ok(ny < 300 && Math.abs(nx - 400) < 1e-9, 'north (-z) is up');
  for (const [x, z] of [[0, 0], [-560, -500], [720, 160], [123.4, 567.8]]) {
    const [px, py] = map.toMap(x, z);
    const [bx, bz] = map.toWorld(px, py);
    assert.ok(Math.abs(bx - x) < 1e-9 && Math.abs(bz - z) < 1e-9, `${x}, ${z} came back as ${bx}, ${bz}`);
  }
  // Every capture point fits, with room for its marker and spawn tag.
  for (const p of mapPoints(town)) {
    const [px, py] = map.toMap(p.x, p.z);
    assert.ok(px >= map.R * 4 && px <= 800 - map.R * 4 && py >= map.R * 4 && py <= 600 - map.R * 4, `${p.id} at ${px.toFixed(0)}, ${py.toFixed(0)}`);
  }
  // The whole battlefield shows on the shorter side.
  const [, top] = map.toMap(0, -town.playRadius);
  const [, bottom] = map.toMap(0, town.playRadius);
  assert.ok(top >= 0 && bottom <= 600);
});

test('a high-density screen gets more pixels, not a different map', () => {
  const canvas = fakeCanvas(500, 400);
  const map = new BattleMap(canvas, town, { preview: false, dpr: 2 });
  assert.equal(canvas.width, 1000);
  assert.equal(canvas.height, 800);
  assert.deepEqual(map.toMap(0, 0), [250, 200]);
  const plain = new BattleMap(fakeCanvas(500, 400), town, { preview: false, dpr: 1 });
  assert.deepEqual(map.toMap(300, -200), plain.toMap(300, -200));
  // A canvas that changes size is laid out again; one that didn't is left alone.
  assert.equal(map.resize(), false);
  canvas.clientWidth = 700;
  assert.equal(map.resize(), true);
  assert.equal(canvas.width, 1400);
  assert.deepEqual(map.toMap(0, 0), [350, 200]);
});

test('a given center and scale replace the fit to the battlefield', () => {
  const map = new BattleMap(fakeCanvas(600, 400), town, { preview: false, dpr: 1, view: { x: 70, z: 115, scale: 2 } });
  assert.deepEqual(map.toMap(70, 115), [300, 200]);
  assert.deepEqual(map.toMap(80, 115), [320, 200]);
  map.setView({ x: -25, z: -45, radius: 100 });
  assert.deepEqual(map.toMap(-25, -45), [300, 200]);
  const [, py] = map.toMap(-25, 55);
  assert.ok(Math.abs(py - 400) < 1e-9, '100 m reaches the nearer edge');
  map.setView(null);
  assert.deepEqual(map.toMap(0, 0), [300, 200]);
});

test('a click picks the spawn under it, or its delay tag, or nothing', () => {
  const map = new BattleMap(fakeCanvas(800, 800), town, { preview: false, dpr: 1 });
  const points = mapPoints(town);
  const by = Object.fromEntries(points.map((p) => [p.id, p]));
  assert.equal(map.spawnAt(400, 400), null, 'nothing drawn yet');
  const spawns = ['A1', 'C1', 'D1', 'O1'].map((id, i) => ({ id, name: by[id].name, delay: 10 + i, point: by[id] }));
  map.draw({ points, team: 1, spawns, selected: 'C1' });
  for (const s of spawns) {
    const [px, py] = map.toMap(s.point.x, s.point.z);
    assert.equal(map.spawnAt(px, py), s.id);
    assert.equal(map.spawnAt(px + 6, py - 6), s.id, 'a little off the middle still counts');
    // The tag with the delay sits under the marker, beyond the marker's own reach.
    assert.equal(map.spawnAt(px, py + map.R * 2.6), s.id, 'the delay tag');
    assert.equal(map.spawnAt(px + map.R * 5, py - map.R * 5), null, 'well away');
  }
  // Points without a spawn there are not clickable.
  const [qx, qy] = map.toMap(by.O2.x, by.O2.z);
  assert.equal(map.spawnAt(qx, qy), null);
  // Spawns found by their point's id, from the definition's points.
  map.draw({ spawns: [{ id: 'B1' }] });
  const [bx, by1] = map.toMap(by.B1.x, by.B1.z);
  assert.equal(map.spawnAt(bx + 3, by1), 'B1');
  // Of two spawns within reach, the nearer one.
  const near = [{ id: 'west', point: { x: -10, z: 0 } }, { id: 'east', point: { x: 10, z: 0 } }];
  map.draw({ spawns: near });
  const [wx, wy] = map.toMap(-10, 0);
  assert.equal(map.spawnAt(wx - 1, wy), 'west');
  const [cx, cy] = map.toMap(9, 0);
  assert.equal(map.spawnAt(cx, cy), 'east');
});

test('the live layer draws on a context without a browser', () => {
  const map = new BattleMap(fakeCanvas(400, 400), town, { preview: false, dpr: 2 });
  const points = mapPoints(town);
  points[3].owner = null;
  points[3].c = -0.4;
  points[4].count = [2, 1];
  map.draw({ points, team: 0, spawns: [{ id: 'O1', delay: 10.5, point: points[0] }], selected: 'O1', hover: 'O1', player: { x: 10, z: 20, yaw: 1 }, friends: [{ x: 5, z: 5 }, { body: { x: 1, z: 2 } }], enemies: [{ x: 50, z: 60 }], marks: [{ x: 0, z: -100, label: '100 m' }], time: 3 });
  map.draw();
  assert.ok(map.stats.liveMs >= 0);
  map.dispose();
  map.draw();
});

test('the opening points of the Town: four per line, access points held by the attackers', () => {
  const pts = mapPoints(town);
  assert.equal(pts.length, town.objectives.length + town.lines.length * 4);
  const by = Object.fromEntries(pts.map((p) => [p.id, p]));
  for (const line of town.lines) {
    const ids = [1, 2, 3, 4].map((i) => `${line.id}${i}`);
    assert.equal(by[ids[0]].kind, 'access');
    assert.equal(by[ids[0]].owner, 1);
    assert.equal(by[ids[0]].c, -1);
    for (const id of ids.slice(1)) {
      assert.equal(by[id].kind, 'point');
      assert.equal(by[id].owner, 0);
    }
    // Linked in order, the last to the line's objective.
    for (let i = 0; i < 3; i++) assert.ok(by[ids[i]].links.includes(ids[i + 1]));
    assert.ok(by[ids[3]].links.includes(line.objective));
    assert.deepEqual([by[ids[0]].x, by[ids[0]].z], line.points[0]);
  }
  assert.ok(by.O1.links.includes('O2') && by.O2.links.includes('O1'));
  assert.equal(by.O1.name, 'Police Station');
  assert.deepEqual(mapPoints(MAPS.range), []);
});

// A 64 m square of ground at 2 m cells.
function ground(fill = SURF.GRASS) {
  const hf = new Heightfield(64, 33);
  hf.surface.fill(fill);
  return hf;
}

function mean(px, from = 0, to = px.length / 4) {
  const m = [0, 0, 0];
  for (let i = from; i < to; i++) for (let c = 0; c < 3; c++) m[c] += px[i * 4 + c];
  return m.map((v) => v / (to - from));
}

const paint = (hf, src = {}) => paintGround(new Uint8ClampedArray(32 * 32 * 4), 32, 32, -32, -32, 2, { hf, ...src });

test('the ground painter: woods dark, wheat light, water dark and cool', () => {
  const grass = mean(paint(ground(SURF.GRASS)));
  const wood = mean(paint(ground(SURF.FOREST)));
  const wheat = mean(paint(ground(SURF.WHEAT)));
  const water = mean(paint(ground(SURF.WATER)));
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  assert.ok(lum(wood) < lum(grass) * 0.7, 'woods are darker than meadows');
  assert.ok(lum(wheat) > lum(grass), 'wheat is lighter than meadows');
  assert.ok(lum(water) < lum(grass) && water[2] > water[0], 'water is dark and cool');
  assert.ok(grass[1] > grass[0] && grass[1] > grass[2], 'meadows are green');
  // Every pixel is opaque.
  const px = paint(ground());
  for (let i = 3; i < px.length; i += 4) assert.equal(px[i], 255);
  // Hedgerows from the mask darken their cells.
  const hf = ground();
  const mask = new Uint8Array(33 * 33);
  // (Pixel i of this painting falls on cell i + 1.)
  for (let iz = 0; iz < 33; iz++) mask[iz * 33 + 16] = 1;
  const hedged = paint(hf, { hedgeMask: mask });
  const col = (p, i) => mean(p, i, i + 1);
  let darker = 0;
  for (let j = 2; j < 30; j++) if (lum(col(hedged, j * 32 + 15)) < lum(col(hedged, j * 32 + 10)) * 0.8) darker++;
  assert.ok(darker > 24, `the hedge column is darker in ${darker} of 28 rows`);
  // A classifier replaces the surfaces.
  const classified = mean(paint(ground(SURF.GRASS), { classify: () => SURF.FOREST }));
  assert.ok(Math.abs(lum(classified) - lum(wood)) < 2);
});

test('the ground painter: slopes facing the light from the north-west are lighter', () => {
  const hf = ground();
  // A round hill 6 m high in the middle.
  for (let iz = 0; iz < 33; iz++)
    for (let ix = 0; ix < 33; ix++) {
      const x = hf.worldX(ix),
        z = hf.worldZ(iz);
      hf.heights[iz * 33 + ix] = 6 * Math.exp(-(x * x + z * z) / (2 * 9 * 9));
    }
  const px = paint(hf);
  const flat = mean(paint(ground()));
  const at = (x, z) => mean(px, (z + 16) * 32 + (x + 16), (z + 16) * 32 + (x + 16) + 1);
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  const nw = lum(at(-6, -6)),
    se = lum(at(6, 6));
  assert.ok(nw > se * 1.15, `north-west flank ${nw.toFixed(0)} against south-east ${se.toFixed(0)}`);
  assert.ok(nw > lum(flat) && se < lum(flat));
});
