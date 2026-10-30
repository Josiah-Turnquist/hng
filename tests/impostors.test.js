// Far trees are impostors: two standing cards at right angles (and one lying flat)
// showing baked pictures of the tree. A standing card seen almost edge on would be
// a dark vertical stroke through the tree, so it fades out there; the other card
// then faces the eye.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { impostorGeometry } from '../src/world/vegetation/treeGeometry.js';
import { makeImpostorMaterial, makeSharedUniforms, IMPOSTOR_EDGE_FADE } from '../src/world/vegetation/materials.js';
import { VARIANTS } from '../src/world/vegetation/species.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The faces of the standing cards in the world, as the shader places them: the
// card's local x along (cos yaw, -sin yaw), local z along (sin yaw, cos yaw).
function cardNormals(yaw) {
  const g = impostorGeometry();
  const nrm = g.getAttribute('normal');
  const card = g.getAttribute('vegCard');
  const out = [];
  for (let i = 0; i < nrm.count; i += 4) {
    if (card.getX(i) > 1.5) continue;
    const nx = nrm.getX(i),
      nz = nrm.getZ(i);
    out.push([nx * Math.cos(yaw) + nz * Math.sin(yaw), -nx * Math.sin(yaw) + nz * Math.cos(yaw)]);
  }
  return out;
}

// The fade of each standing card for an eye in direction (dx, dz) from the tree.
function fades(yaw, dx, dz) {
  const l = Math.hypot(dx, dz);
  return cardNormals(yaw).map(([nx, nz]) => smoothstep(IMPOSTOR_EDGE_FADE[0], IMPOSTOR_EDGE_FADE[1], Math.abs((dx * nx + dz * nz) / l)));
}

test('one standing card of an impostor always faces the eye fully; an edge-on one is gone', () => {
  for (let k = 0; k < 400; k++) {
    const yaw = k * 0.731,
      a = k * 0.377;
    const f = fades(yaw, Math.cos(a), Math.sin(a));
    assert.equal(f.length, 2);
    assert.equal(Math.max(...f), 1, `yaw ${yaw} view ${a}: no card fully drawn`);
  }
  // Looking along each card: that card is not drawn, the other one is.
  for (const yaw of [0, 0.4, 1.9, 4]) {
    const [n0, n1] = cardNormals(yaw);
    // Along card 0 is across its normal, which is card 1's normal.
    assert.deepEqual(fades(yaw, n1[0], n1[1]).map((v) => +v.toFixed(6)), [0, 1]);
    assert.deepEqual(fades(yaw, n0[0], n0[1]).map((v) => +v.toFixed(6)), [1, 0]);
  }
});

test('the impostor shader fades its standing cards by the angle to the eye', () => {
  const imp = {
    map: null,
    normalMap: null,
    rects: VARIANTS.flatMap(() => [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()]),
    info: VARIANTS.map(() => new THREE.Vector4()),
  };
  const { material } = makeImpostorMaterial(imp, makeSharedUniforms({}), { shadowMax: 300, variants: VARIANTS.length });
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader);
  const [a, b] = IMPOSTOR_EDGE_FADE.map((v) => v.toFixed(3));
  assert.ok(shader.vertexShader.includes(`vVegOut *= smoothstep( ${a}, ${b}, abs( dot( vegH, vegCn ) ) );`));
  // The shader's card faces match the geometry (front card: local z, side card: local x).
  assert.ok(shader.vertexShader.includes('vec2 vegCn = vegCard < 0.5 ? vec2( vegS, vegC ) : vec2( vegC, -vegS );'));
  const [n0, n1] = cardNormals(0.7);
  assert.ok(Math.abs(n0[0] - Math.sin(0.7)) < 1e-6 && Math.abs(n0[1] - Math.cos(0.7)) < 1e-6);
  assert.ok(Math.abs(n1[0] - Math.cos(0.7)) < 1e-6 && Math.abs(n1[1] + Math.sin(0.7)) < 1e-6);
});
