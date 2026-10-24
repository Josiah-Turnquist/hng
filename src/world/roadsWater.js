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

// How deep the water is over each ground grid point (8 bits, 1 unit = 4 m / 255),
// so the water shader can let the river bed show through where it is shallow.
function waterDepthTexture(hf, river) {
  const r = hf.res;
  const data = new Uint8Array(r * r);
  const df = river.distField;
  for (let i = 0; i < r * r; i++) {
    const d = df.dist[i];
    if (!(d < river.half + 8)) continue;
    const depth = river.level[df.nearest[i]] - 0.25 - hf.heights[i];
    data[i] = Math.max(0, Math.min(255, Math.round((depth / 4) * 255)));
  }
  const t = new THREE.DataTexture(data, r, r, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// The river: a dark, slightly green lowland river. What you see is mostly the sky
// reflected (more at a glancing angle, the Fresnel effect), darker where the banks
// and trees would be reflected; where it is shallow the muddy bed shows through and
// the water fades out at the banks. Two layers of ripples flow downstream, calmer
// near the banks and smoothed out in the distance (so they don't shimmer).
export function buildRiver(terrain, textures) {
  if (!terrain.river) return null;
  const river = terrain.river;
  const hf = terrain.hf;
  const tex = textures.get('water');
  tex.normalMap.wrapS = tex.normalMap.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(0.025, 0.04, 0.03),
    roughness: 0.05,
    metalness: 0.0,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    envMapIntensity: 1.0,
    transparent: true,
    depthWrite: true,
    // Color is written already weighted by its own opacity, so reflections stay at
    // full strength over shallow water.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const uniforms = {
    uTime: { value: 0 },
    tWaterDepth: { value: waterDepthTexture(hf, river) },
    uWaterGrid: { value: new THREE.Vector3(hf.half, hf.cell, hf.res) },
  };
  addPatch(mat, 'water', (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform sampler2D tWaterDepth;
uniform vec3 uWaterGrid;
varying vec3 vWaterPos;
float waterDepth;
float waterFresnel;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        {
          vec2 g = (vWaterPos.xz + uWaterGrid.x) / uWaterGrid.y;
          waterDepth = texture2D(tWaterDepth, (g + 0.5) / uWaterGrid.z).r * 4.0;
        }
        float wDist = length(vWaterPos - cameraPosition);
        float wCalm = smoothstep(0.0, 0.6, waterDepth) * (1.0 - smoothstep(60.0, 400.0, wDist) * 0.75);
        // Three ripple layers at different sizes and angles (so no grid shows).
        const mat2 wRot2 = mat2(0.8, -0.6, 0.6, 0.8);
        const mat2 wRot3 = mat2(0.48, 0.88, -0.88, 0.48);
        vec3 n1 = texture2D(normalMap, vNormalMapUv + vec2(0.0, uTime * 0.05)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(normalMap, wRot2 * vNormalMapUv * 1.7 + vec2(uTime * 0.013, uTime * 0.031)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(normalMap, wRot3 * vNormalMapUv * 0.37 + vec2(-uTime * 0.007, uTime * 0.018)).xyz * 2.0 - 1.0;
        n2.xy = n2.xy * wRot2;
        n3.xy = n3.xy * wRot3;
        vec3 mapN = normalize(vec3((n1.xy + n2.xy * 0.8 + n3.xy * 0.6) * normalScale * wCalm, n1.z * n2.z));
        normal = normalize(tbn * mapN);
        waterFresnel = 0.02 + 0.98 * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 5.0);`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        /* glsl */ `#include <lights_fragment_maps>
        #if defined( RE_IndirectSpecular )
        {
          // A low reflection shows the far bank and its trees rather than the sky,
          // except straight up or down the river, where the sky stays open.
          vec3 wR = reflect(normalize(vWaterPos - cameraPosition), inverseTransformDirection(normal, viewMatrix));
          vec3 wAlong = inverseTransformDirection(tbn[1], viewMatrix);
          vec2 rh = normalize(wR.xz + 1e-5), ah = normalize(wAlong.xz + 1e-5);
          float across = abs(rh.x * ah.y - rh.y * ah.x);
          float banks = mix(0.04, 0.45, across);
          float open = smoothstep(banks * 0.5, banks * 1.3, wR.y);
          radiance *= mix(vec3(0.07, 0.09, 0.055), vec3(1.0), open);
        }
        #endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
          // Light passing through the water: the bed fades out with the length of
          // the path through the water (deeper, or seen at a low angle).
          vec3 vv = normalize(vViewPosition);
          float path = waterDepth / max(0.25, abs(dot(vv, normal)));
          float a = 1.0 - exp(-path * 1.7);
          a = mix(a, 1.0, waterFresnel * smoothstep(0.0, 0.15, waterDepth));
          a *= smoothstep(0.0, 0.06, waterDepth);
          vec3 lit = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * a;
          vec3 spec = (reflectedLight.directSpecular + reflectedLight.indirectSpecular) * smoothstep(0.0, 0.03, waterDepth);
          gl_FragColor = vec4(lit + spec + totalEmissiveRadiance, a);
        }`,
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
  mesh.renderOrder = 2;
  mesh.name = 'river';
  mesh.userData.update = (t) => (uniforms.uTime.value = t);
  return mesh;
}
