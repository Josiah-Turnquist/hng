// Road surfaces (textured strips laid on the ground with rutted tire tracks and soft
// edges) and river water (a reflective strip that follows the river bed).
import * as THREE from 'three';
import { addPatch } from '../render/materialPatch.js';

// Builds a ribbon mesh along a list of [x, z] points. `across` controls how many
// vertices span the width, so the ribbon can follow bumps in the ground.
function ribbon(points, width, heightAt, { across = 5, lift = 0.04, vScale = 1, uvAcross = [0, 1] } = {}) {
  const n = points.length;
  const pos = new Float32Array(n * across * 3);
  const uv = new Float32Array(n * across * 2);
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const [x, z] = points[i];
    const [xa, za] = points[Math.max(0, i - 1)];
    const [xb, zb] = points[Math.min(n - 1, i + 1)];
    let tx = xb - xa,
      tz = zb - za;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const nx = -tz,
      nz = tx; // left-hand side normal
    if (i > 0) dist += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    for (let k = 0; k < across; k++) {
      const s = k / (across - 1) - 0.5;
      const px = x + nx * s * width;
      const pz = z + nz * s * width;
      const o = (i * across + k) * 3;
      pos[o] = px;
      pos[o + 1] = heightAt(px, pz, i, s) + lift;
      pos[o + 2] = pz;
      const t = (i * across + k) * 2;
      uv[t] = uvAcross[0] + (uvAcross[1] - uvAcross[0]) * (k / (across - 1));
      uv[t + 1] = dist * vScale;
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < across - 1; k++) {
      const a = i * across + k,
        b = a + 1,
        c = a + across,
        d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function buildRoads(terrain, textures) {
  const hf = terrain.hf;
  const group = new THREE.Group();
  group.name = 'roads';
  const tex = textures.get('roadDirt');
  const mat = new THREE.MeshStandardMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    roughnessMap: tex.ormMap,
    roughness: 1,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const road of terrain.roads) {
    const width = road.width + 1.6;
    // Thin out samples (every 4 m) and lay the ribbon on the actual ground. The
    // dirt road stops where the village has paved the street with cobbles.
    const pts = road.samples.filter((_, i) => i % 2 === 0);
    const runs = [];
    let run = [];
    for (const p of pts) {
      if (hf.getSurface(p[0], p[1]) === 6) {
        if (run.length > 1) runs.push(run);
        run = [];
      } else run.push(p);
    }
    if (run.length > 1) runs.push(run);
    runs.forEach((r, i) => {
      const geo = ribbon(r, width, (x, z) => hf.getHeight(x, z), {
        across: 7,
        lift: 0.03,
        vScale: 1 / 12,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.renderOrder = 1;
      mesh.name = `road-${road.id}-${i}`;
      group.add(mesh);
    });
  }
  return group;
}

export function buildRiver(terrain, textures) {
  if (!terrain.river) return null;
  const river = terrain.river;
  const tex = textures.get('water');
  tex.normalMap.wrapS = tex.normalMap.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(0.035, 0.05, 0.045),
    roughness: 0.06,
    metalness: 0.0,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 1.2,
  });
  // Animate two scrolling ripple layers so the water flows downstream.
  const uniforms = { uTime: { value: 0 } };
  addPatch(mat, 'water', (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        vec3 n1 = texture2D(normalMap, vNormalMapUv + vec2(0.0, uTime * 0.05)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(normalMap, vNormalMapUv * 1.7 + vec2(uTime * 0.013, uTime * 0.031)).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(vec3((n1.xy + n2.xy) * normalScale, n1.z * n2.z));
        normal = normalize(tbn * mapN);`,
      );
  });
  const pts = river.samples.filter((_, i) => i % 2 === 0);
  const levels = river.level.filter((_, i) => i % 2 === 0);
  const geo = ribbon(pts, river.half * 2 + 6, (x, z, i) => levels[i], {
    across: 3,
    lift: -0.25,
    vScale: 1 / 4,
    uvAcross: [0, (river.half * 2 + 6) / 4],
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'river';
  mesh.userData.update = (t) => (uniforms.uTime.value = t);
  return mesh;
}
