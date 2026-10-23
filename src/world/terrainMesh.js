// Draws the heightfield as square chunks with several levels of detail.
// The surface look comes from a custom shader: each 2 m ground cell stores a
// surface type (grass, mud, cobbles...), and the shader blends the matching
// ground textures using their height (so grass tufts poke through dirt rather
// than fading like a cross-dissolve). Lighting uses a smooth per-pixel normal.
import * as THREE from 'three';
import { SURF } from './heightfield.js';
import { addPatch } from '../render/materialPatch.js';

// Surface type -> terrain texture layer (see TERRAIN_LAYERS in textures.js).
const SURF_TO_LAYER = new Uint8Array(16);
SURF_TO_LAYER[SURF.GRASS] = 0;
SURF_TO_LAYER[SURF.DRY_GRASS] = 1;
SURF_TO_LAYER[SURF.DIRT] = 2;
SURF_TO_LAYER[SURF.MUD] = 3;
SURF_TO_LAYER[SURF.ROCK] = 4;
SURF_TO_LAYER[SURF.FIELD] = 5;
SURF_TO_LAYER[SURF.COBBLE] = 6;
SURF_TO_LAYER[SURF.FOREST] = 7;
SURF_TO_LAYER[SURF.ROAD] = 2;
SURF_TO_LAYER[SURF.SAND] = 8;
SURF_TO_LAYER[SURF.WATER] = 3;
SURF_TO_LAYER[SURF.WHEAT] = 1;

export class TerrainRenderer {
  constructor(hf, textures, quality) {
    this.hf = hf;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    this.chunkCells = 64; // cells per chunk side at full detail (128 m with 2 m cells)
    this.chunks = [];
    this.layerTextures = textures.terrainArrays();
    this._buildTextures();
    this.material = this._makeMaterial();
    this._buildChunks();
  }

  _buildTextures() {
    const hf = this.hf;
    const r = hf.res;
    // Surface layer per grid point (read with texelFetch, no filtering).
    const ids = new Uint8Array(r * r);
    for (let i = 0; i < r * r; i++) ids[i] = SURF_TO_LAYER[hf.surface[i]];
    this.idTex = new THREE.DataTexture(ids, r, r, THREE.RedFormat, THREE.UnsignedByteType);
    this.idTex.minFilter = THREE.NearestFilter;
    this.idTex.magFilter = THREE.NearestFilter;
    this.idTex.needsUpdate = true;

    // Smooth normals per grid point, stored as 8-bit RGB (filtered).
    const nrm = new Uint8Array(r * r * 4);
    const n = { x: 0, y: 0, z: 0 };
    for (let iz = 0; iz < r; iz++) {
      for (let ix = 0; ix < r; ix++) {
        const hl = hf.heightAtIndex(ix - 1, iz),
          hr = hf.heightAtIndex(ix + 1, iz);
        const hd = hf.heightAtIndex(ix, iz - 1),
          hu = hf.heightAtIndex(ix, iz + 1);
        n.x = hl - hr;
        n.y = 2 * hf.cell;
        n.z = hd - hu;
        const len = Math.hypot(n.x, n.y, n.z);
        const i = (iz * r + ix) * 4;
        nrm[i] = Math.round((n.x / len * 0.5 + 0.5) * 255);
        nrm[i + 1] = Math.round((n.y / len * 0.5 + 0.5) * 255);
        nrm[i + 2] = Math.round((n.z / len * 0.5 + 0.5) * 255);
        nrm[i + 3] = 255;
      }
    }
    this.normalTex = new THREE.DataTexture(nrm, r, r, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.normalTex.minFilter = THREE.LinearFilter;
    this.normalTex.magFilter = THREE.LinearFilter;
    this.normalTex.needsUpdate = true;
  }

  // Call after editing surfaces (e.g. craters from explosions).
  refreshSurface(x0, z0, x1, z1) {
    const hf = this.hf;
    const r = hf.res;
    const data = this.idTex.image.data;
    const [gx0, gz0] = hf.toGrid(x0, z0);
    const [gx1, gz1] = hf.toGrid(x1, z1);
    for (let iz = Math.max(0, Math.floor(gz0)); iz <= Math.min(r - 1, Math.ceil(gz1)); iz++)
      for (let ix = Math.max(0, Math.floor(gx0)); ix <= Math.min(r - 1, Math.ceil(gx1)); ix++)
        data[iz * r + ix] = SURF_TO_LAYER[hf.surface[iz * r + ix]];
    this.idTex.needsUpdate = true;
  }

  _makeMaterial() {
    const hf = this.hf;
    const lt = this.layerTextures;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    const uniforms = {
      tSurfaceId: { value: this.idTex },
      tTerrainNormal: { value: this.normalTex },
      tLayerAlbedo: { value: lt.albedo },
      tLayerNormal: { value: lt.normal },
      uLayerScale: { value: lt.scales.map((s) => 1 / s) },
      uTerrain: { value: new THREE.Vector4(hf.half, hf.cell, hf.res, 0) },
    };
    this.uniforms = uniforms;
    addPatch(mat, 'terrain', (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
varying vec3 vTerrainPos;
uniform sampler2D tSurfaceId;
uniform sampler2D tTerrainNormal;
uniform sampler2DArray tLayerAlbedo;
uniform sampler2DArray tLayerNormal;
uniform float uLayerScale[${lt.scales.length}];
uniform vec4 uTerrain;
vec4 tAlb; vec3 tNrmW; float tRough;
float th(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tvn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1, 0)), u.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), u.x), u.y);
}
int surfId(vec2 g) {
  ivec2 c = clamp(ivec2(g), ivec2(0), ivec2(int(uTerrain.z) - 1));
  return int(texelFetch(tSurfaceId, c, 0).r * 255.0 + 0.5);
}
void terrainSample(vec3 wp) {
  vec2 xz = wp.xz;
  // Organic borders between surface types: wobble the lookup position.
  vec2 warp = vec2(tvn(xz * 0.31), tvn(xz * 0.31 + 19.7)) - 0.5;
  warp += (vec2(tvn(xz * 1.3 + 7.1), tvn(xz * 1.3 - 3.3)) - 0.5) * 0.35;
  vec2 g = (xz + uTerrain.x) / uTerrain.y + warp * 1.6;
  vec2 b = floor(g);
  vec2 f = g - b;
  int i00 = surfId(b);
  int i10 = surfId(b + vec2(1.0, 0.0));
  int i01 = surfId(b + vec2(0.0, 1.0));
  int i11 = surfId(b + vec2(1.0, 1.0));
  vec4 a0, a1, a2, a3, n0, n1, n2, n3;
  if (i00 == i10 && i00 == i01 && i00 == i11) {
    vec2 uv = xz * uLayerScale[i00];
    tAlb = texture(tLayerAlbedo, vec3(uv, float(i00)));
    vec4 nn = texture(tLayerNormal, vec3(uv, float(i00)));
    tNrmW = nn.xyz * 2.0 - 1.0;
  } else {
    float w[4];
    w[0] = (1.0 - f.x) * (1.0 - f.y);
    w[1] = f.x * (1.0 - f.y);
    w[2] = (1.0 - f.x) * f.y;
    w[3] = f.x * f.y;
    int ids[4];
    ids[0] = i00; ids[1] = i10; ids[2] = i01; ids[3] = i11;
    vec4 al[4];
    vec4 nr[4];
    float hmax = -1.0;
    float hb[4];
    for (int k = 0; k < 4; k++) {
      vec2 uv = xz * uLayerScale[ids[k]];
      al[k] = texture(tLayerAlbedo, vec3(uv, float(ids[k])));
      nr[k] = texture(tLayerNormal, vec3(uv, float(ids[k])));
      hb[k] = nr[k].a * 0.6 + w[k];
      hmax = max(hmax, hb[k]);
    }
    float sum = 0.0;
    tAlb = vec4(0.0);
    vec3 nsum = vec3(0.0);
    for (int k = 0; k < 4; k++) {
      float bw = max(hb[k] - hmax + 0.22, 0.0);
      sum += bw;
      tAlb += al[k] * bw;
      nsum += (nr[k].xyz * 2.0 - 1.0) * bw;
    }
    tAlb /= sum;
    tNrmW = nsum / sum;
  }
  // Large-scale color variation hides texture repetition.
  float macro = tvn(xz * 0.018) * 0.6 + tvn(xz * 0.075) * 0.4;
  tAlb.rgb *= 0.78 + 0.44 * macro;
  tRough = tAlb.a;
  // Combine the smooth ground normal with the texture detail normal.
  vec2 nuv = (xz + uTerrain.x) / uTerrain.y;
  vec3 N = texture(tTerrainNormal, (nuv + 0.5) / uTerrain.z).xyz * 2.0 - 1.0;
  float detailFade = 1.0 - smoothstep(60.0, 260.0, length(wp - cameraPosition));
  tNrmW = normalize(vec3(N.x + tNrmW.x * detailFade, N.y, N.z + tNrmW.y * detailFade));
}`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `terrainSample(vTerrainPos);
diffuseColor.rgb *= tAlb.rgb;`,
        )
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
        .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tNrmW, 0.0)).xyz);');
    });
    return mat;
  }

  _buildChunks() {
    const hf = this.hf;
    const cc = this.chunkCells;
    const nChunks = Math.ceil((hf.res - 1) / cc);
    this.nChunks = nChunks;
    const lodSteps = [1, 2, 4, 8];
    for (let cz = 0; cz < nChunks; cz++) {
      for (let cx = 0; cx < nChunks; cx++) {
        const lods = lodSteps.map((step) => this._chunkGeometry(cx * cc, cz * cc, cc, step));
        const mesh = new THREE.Mesh(lods[0], this.material);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        const x0 = hf.worldX(cx * cc),
          z0 = hf.worldZ(cz * cc);
        const size = cc * hf.cell;
        const chunk = { mesh, lods, lod: 0, cx: x0 + size / 2, cz: z0 + size / 2, size };
        this.chunks.push(chunk);
        this.group.add(mesh);
      }
    }
  }

  _chunkGeometry(ix0, iz0, cells, step) {
    const hf = this.hf;
    const r = hf.res;
    const n = Math.floor(cells / step) + 1;
    const ixMax = Math.min(ix0 + cells, r - 1);
    const izMax = Math.min(iz0 + cells, r - 1);
    // Main grid plus a skirt ring hanging down to hide gaps between detail levels.
    const verts = n * n + 4 * n;
    const pos = new Float32Array(verts * 3);
    const nor = new Float32Array(verts * 3);
    const nv = { x: 0, y: 1, z: 0 };
    let v = 0;
    const put = (ix, iz, drop) => {
      ix = Math.min(ix, ixMax);
      iz = Math.min(iz, izMax);
      const x = hf.worldX(ix),
        z = hf.worldZ(iz);
      pos[v * 3] = x;
      pos[v * 3 + 1] = hf.heights[iz * r + ix] - drop;
      pos[v * 3 + 2] = z;
      hf.getNormal(x, z, nv);
      nor[v * 3] = nv.x;
      nor[v * 3 + 1] = nv.y;
      nor[v * 3 + 2] = nv.z;
      v++;
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(ix0 + i * step, iz0 + j * step, 0);
    const skirt = 2 + step * 1.5;
    const sBase = v;
    for (let i = 0; i < n; i++) put(ix0 + i * step, iz0, skirt); // north edge
    for (let i = 0; i < n; i++) put(ix0 + i * step, iz0 + (n - 1) * step, skirt); // south
    for (let j = 0; j < n; j++) put(ix0, iz0 + j * step, skirt); // west
    for (let j = 0; j < n; j++) put(ix0 + (n - 1) * step, iz0 + j * step, skirt); // east
    const idx = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i,
          b = a + 1,
          c = a + n,
          d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // Skirt quads (two-sided via both windings).
    const edge = (rowStart, skirtStart, count, stride) => {
      for (let k = 0; k < count - 1; k++) {
        const a = rowStart + k * stride,
          b = rowStart + (k + 1) * stride;
        const sa = skirtStart + k,
          sb = skirtStart + k + 1;
        idx.push(a, sa, b, b, sa, sb);
        idx.push(a, b, sa, b, sb, sa);
      }
    };
    edge(0, sBase, n, 1);
    edge((n - 1) * n, sBase + n, n, 1);
    edge(0, sBase + 2 * n, n, n);
    edge(n - 1, sBase + 3 * n, n, n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  // Pick a level of detail for each chunk from its distance to the camera.
  update(cameraPos) {
    const k = this.quality.terrainLod;
    for (const c of this.chunks) {
      const dx = Math.max(0, Math.abs(cameraPos.x - c.cx) - c.size / 2);
      const dz = Math.max(0, Math.abs(cameraPos.z - c.cz) - c.size / 2);
      const d = Math.hypot(dx, dz);
      let lod = 0;
      if (d > 220 * k) lod = 1;
      if (d > 520 * k) lod = 2;
      if (d > 1000 * k) lod = 3;
      if (lod !== c.lod) {
        c.lod = lod;
        c.mesh.geometry = c.lods[lod];
      }
    }
  }
}
