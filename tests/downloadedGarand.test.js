// The downloaded M1 Garand (models/downloaded.js), loaded from the real file:
// fitted to our gun conventions, nothing loose left round it, its clip in the
// magazine, its peep hole opened up, a clear view from the rear sight to the
// front sight at every range setting, and the hands' points on the rifle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parseDownloadedGarand } from '../src/weapons/models/downloaded.js';
import { Sighting } from '../src/weapons/sighting.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { Atmosphere } from '../src/ballistics/atmosphere.js';

const file = readFileSync(new URL('../assets/models/m1_garand_rookieray.glb', import.meta.url));
const gun = await parseDownloadedGarand(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const { root, parts, anchors } = gun;
root.updateMatrixWorld(true);
const meshes = [];
root.traverse((o) => o.isMesh && meshes.push(o));
const ray = new THREE.Raycaster();
// Distance to the first surface from p along d (gun space; the root sits at the origin).
const cast = (p, d, far = 1) => {
  ray.set(new THREE.Vector3(...p), new THREE.Vector3(...d).normalize());
  ray.far = far;
  return ray.intersectObjects(meshes, false)[0]?.distance ?? null;
};

test('the moving parts are there, and nothing lies round the rifle', () => {
  for (const n of ['body', 'rearSight', 'bolt', 'opRod', 'clip']) assert.ok(parts[n]?.children.length, `part ${n}`);
  const b = new THREE.Box3().setFromObject(root);
  // Muzzle to butt, at the size of a real Garand between the sights.
  assert.ok(Math.abs(b.min.z - anchors.muzzle.z) < 0.002 && b.max.z < 0.29, `${b.min.z} to ${b.max.z}`);
  // (The loose rounds, cases and spent clip lay up to 15 cm off to the side.)
  assert.ok(b.min.x > -0.04 && b.max.x < 0.04, `sideways ${b.min.x} to ${b.max.x}`);
  assert.ok(b.min.y > -0.2 && b.max.y < 0.04, `up and down ${b.min.y} to ${b.max.y}`);
  // The clip in the magazine, under the bolt.
  const c = new THREE.Box3().setFromObject(parts.clip);
  assert.ok(Math.abs(c.min.x + c.max.x) < 0.004 && c.max.y < 0.003 && c.min.y > -0.05, `clip ${c.min.toArray()} ${c.max.toArray()}`);
});

test('the peep hole is opened up to 6 mm across', () => {
  const pos = parts.rearSight.children[0].geometry.attributes.position;
  const p = parts.rearSight.position;
  let r = Infinity;
  for (let i = 0; i < pos.count; i++) r = Math.min(r, Math.hypot(pos.getX(i) + p.x - anchors.rearSight.x, pos.getY(i) + p.y - anchors.rearSight.y));
  assert.ok(r > 0.0028 && r < 0.0032, `hole radius ${r}`);
});

test('through the rear sight the front sight is in clear view, at every range setting', () => {
  const s = new Sighting(gun, WEAPONS.m1_garand, new Atmosphere(0, 15));
  assert.equal(s.sightKind, 'slide');
  const ranges = WEAPONS.m1_garand.sight.ranges;
  let lastRise = -1;
  for (let i = 0; i < ranges.length; i++) {
    s.setRangeIndex(i);
    root.updateMatrixWorld(true);
    const rise = parts.rearSight.position.y - anchors.rearSight.y;
    assert.ok(rise > lastRise && rise < 0.016, `the sight slides up: ${rise} at ${ranges[i]} yd`);
    lastRise = rise;
    // From the eye at the blade, a millimeter under its top: the first thing met is the blade.
    const to = s.front.clone().add(new THREE.Vector3(0, -0.001, 0));
    const d = to.clone().sub(s.eye);
    const hit = cast(s.eye.toArray(), d.toArray(), 2);
    assert.ok(hit !== null && Math.abs(hit - d.length()) < 0.004, `at ${ranges[i]} yd the view stops ${hit} m from the eye, the blade is ${d.length()} m`);
  }
});

test('the trigger, grips and shoulder are on the rifle', () => {
  const t = anchors.trigger;
  // The trigger blade just behind the finger.
  const tr = cast([t.x, t.y, t.z - 0.02], [0, 0, 1], 0.06); // (from between the safety and the trigger)
  assert.ok(tr !== null && Math.abs(tr - 0.02) < 0.006, `trigger met ${tr} m on`);
  // The right hand round the wrist of the stock: wood above and below it.
  const g = anchors.gripR;
  const up = cast([g.x, g.y - 0.1, g.z], [0, 1, 0], 0.2);
  const down = cast([g.x, g.y + 0.1, g.z], [0, -1, 0], 0.2);
  assert.ok(up !== null && up < 0.1 && down !== null && down < 0.1, `wrist below ${up}, above ${down}`);
  // The left hand under the fore-end: its underside a little below the point.
  const l = anchors.gripL;
  const under = cast([l.x, l.y - 0.2, l.z], [0, 1, 0], 0.4);
  assert.ok(under !== null && Math.abs(l.y - 0.2 + under - l.y) < 0.01, `fore-end underside ${l.y - 0.2 + under}`);
  // The butt plate at the shoulder point.
  const sh = anchors.shoulder;
  const butt = cast([sh.x, sh.y, sh.z + 0.1], [0, 0, -1], 0.2);
  assert.ok(butt !== null && Math.abs(butt - 0.1) < 0.006, `butt plate ${butt} m on`);
});
