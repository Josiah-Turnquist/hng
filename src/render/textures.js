// Bakes the procedural materials from textureLib.glsl.js into GPU textures at load
// time: color, normal and roughness/metal maps, plus texture arrays for the terrain.
import * as THREE from 'three';
import { NOISE_GLSL, MATERIALS } from './textureLib.glsl.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

function fragmentFor(name) {
  return /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int uMode;
uniform float uSize;
uniform float uWorld;
uniform float uNormalScale;
uniform float uHeightRange;
uniform vec3 uPaintA;
uniform vec3 uPaintB;
${NOISE_GLSL}
${MATERIALS[name]}
void main() {
  vec3 albedo; float rough; float height; float metal; float alpha;
  surface(vUv, albedo, rough, height, metal, alpha);
  if (uMode == 0) {
    gl_FragColor = vec4(albedo, alpha);
  } else if (uMode == 1) {
    float e = 1.0 / uSize;
    vec3 a; float r; float m; float al;
    float hL; float hR; float hD; float hU;
    surface(vUv - vec2(e, 0.0), a, r, hL, m, al);
    surface(vUv + vec2(e, 0.0), a, r, hR, m, al);
    surface(vUv - vec2(0.0, e), a, r, hD, m, al);
    surface(vUv + vec2(0.0, e), a, r, hU, m, al);
    float px = uWorld / uSize;
    vec3 n = normalize(vec3(-(hR - hL) / (2.0 * px) * uNormalScale, -(hU - hD) / (2.0 * px) * uNormalScale, 1.0));
    gl_FragColor = vec4(n * 0.5 + 0.5, clamp(height / uHeightRange, 0.0, 1.0));
  } else if (uMode == 2) {
    gl_FragColor = vec4(1.0, rough, metal, 1.0);
  } else {
    gl_FragColor = vec4(albedo, rough);
  }
}`;
}

// Colors in the material presets are written in sRGB (like a paint chip) and
// converted to linear here.
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

export const PRESETS = {
  grass: { mat: 'grass', world: 3 },
  dryGrass: { mat: 'dryGrass', world: 3 },
  dirt: { mat: 'dirt', world: 3 },
  mud: { mat: 'mud', world: 4 },
  rock: { mat: 'rock', world: 6 },
  plowed: { mat: 'plowed', world: 2.4 },
  cobble: { mat: 'cobble', world: 2 },
  forest: { mat: 'forest', world: 3 },
  sand: { mat: 'sand', world: 3 },
  roadDirt: { mat: 'roadDirt', world: 6, alpha: true },
  brick: { mat: 'brick', world: 2 },
  plasterCream: { mat: 'plaster', world: 3, a: lin(0.78, 0.74, 0.64), b: lin(0.7, 0.66, 0.56) },
  plasterGrey: { mat: 'plaster', world: 3, a: lin(0.66, 0.65, 0.62), b: lin(0.58, 0.57, 0.54) },
  plasterOchre: { mat: 'plaster', world: 3, a: lin(0.76, 0.64, 0.42), b: lin(0.68, 0.56, 0.38) },
  plasterWhite: { mat: 'plaster', world: 3, a: lin(0.84, 0.83, 0.79), b: lin(0.75, 0.74, 0.7) },
  stoneWall: { mat: 'stoneWall', world: 3 },
  roofTiles: { mat: 'roofTiles', world: 2 },
  woodPlanks: { mat: 'woodPlanks', world: 1.4, a: lin(0.42, 0.35, 0.27), b: lin(0.35, 0.3, 0.25) },
  woodDark: { mat: 'woodPlanks', world: 1.4, a: lin(0.25, 0.18, 0.12), b: lin(0.2, 0.15, 0.1) },
  woodGreen: { mat: 'woodPlanks', world: 1.4, a: lin(0.25, 0.33, 0.25), b: lin(0.3, 0.36, 0.28) },
  bark: { mat: 'bark', world: 1, a: lin(0.33, 0.29, 0.24) },
  barkBirch: { mat: 'bark', world: 1, a: lin(0.75, 0.73, 0.68) },
  paintOD: { mat: 'paintedMetal', world: 2, a: lin(0.29, 0.31, 0.2), b: lin(0.42, 0.4, 0.3) }, // US olive drab No. 9
  paintGerman: { mat: 'paintedMetal', world: 2, a: lin(0.6, 0.52, 0.33), b: lin(0.66, 0.6, 0.45) }, // Dunkelgelb RAL 7028
  paintGermanGrey: { mat: 'paintedMetal', world: 2, a: lin(0.24, 0.26, 0.27), b: lin(0.35, 0.36, 0.35) }, // Dunkelgrau RAL 7021
  paintSoviet: { mat: 'paintedMetal', world: 2, a: lin(0.27, 0.33, 0.19), b: lin(0.38, 0.4, 0.28) }, // 4BO green
  paintBlack: { mat: 'paintedMetal', world: 2, a: lin(0.1, 0.1, 0.1), b: lin(0.18, 0.17, 0.16) },
  steelBlued: { mat: 'gunSteel', world: 0.3, a: lin(0.07, 0.075, 0.09), b: new THREE.Color(0.5, 0, 0) },
  steelParkerized: { mat: 'gunSteel', world: 0.3, a: lin(0.16, 0.17, 0.16), b: new THREE.Color(0.6, 0, 0) },
  steelPlain: { mat: 'gunSteel', world: 0.3, a: lin(0.22, 0.22, 0.22), b: new THREE.Color(0.45, 0, 0) },
  walnut: { mat: 'stockWood', world: 0.6, a: lin(0.3, 0.18, 0.11), b: lin(0.17, 0.09, 0.05) },
  beech: { mat: 'stockWood', world: 0.6, a: lin(0.45, 0.29, 0.17), b: lin(0.32, 0.19, 0.1) },
  birch: { mat: 'stockWood', world: 0.6, a: lin(0.52, 0.36, 0.22), b: lin(0.38, 0.24, 0.14) },
  bakelite: { mat: 'stockWood', world: 0.3, a: lin(0.28, 0.12, 0.06), b: lin(0.18, 0.08, 0.04) },
  woolOD: { mat: 'fabric', world: 0.5, a: lin(0.36, 0.33, 0.24) }, // US M1941 field jacket / wool OD
  woolFeldgrau: { mat: 'fabric', world: 0.5, a: lin(0.33, 0.35, 0.3) }, // German M40 feldgrau
  cottonKhaki: { mat: 'fabric', world: 0.5, a: lin(0.48, 0.44, 0.31) }, // Soviet gymnastyorka
  webbingKhaki: { mat: 'fabric', world: 0.3, a: lin(0.5, 0.47, 0.35) },
  leatherBlack: { mat: 'fabric', world: 0.3, a: lin(0.08, 0.07, 0.06) },
  leatherBrown: { mat: 'fabric', world: 0.3, a: lin(0.25, 0.15, 0.09) },
  burlap: { mat: 'burlap', world: 0.6, a: lin(0.55, 0.47, 0.33), b: lin(0.45, 0.38, 0.27) },
  // Neutral light-grey cloth and kit (leather / painted steel) for soldiers: the
  // real colors come from vertex colors. Both average about 0.5 in linear albedo.
  soldierCloth: { mat: 'fabric', world: 0.5, a: lin(0.78, 0.78, 0.78) },
  soldierGear: { mat: 'soldierGear', world: 0.35, a: lin(0.735, 0.735, 0.735) },
  concrete: { mat: 'concrete', world: 3 },
  water: { mat: 'water', world: 4, normalScale: 1 },
  leavesOak: { mat: 'leaves', world: 1, alpha: true, a: lin(0.24, 0.32, 0.12), b: lin(0.34, 0.4, 0.15) },
  leavesBirch: { mat: 'leaves', world: 1, alpha: true, a: lin(0.36, 0.45, 0.16), b: lin(0.45, 0.5, 0.2) },
  leavesPine: { mat: 'leaves', world: 1, alpha: true, a: lin(0.11, 0.18, 0.1), b: lin(0.16, 0.24, 0.12) },
  leavesHedge: { mat: 'leaves', world: 1, alpha: true, a: lin(0.18, 0.26, 0.09), b: lin(0.28, 0.33, 0.12) },
  grassCard: { mat: 'grassCard', world: 0.5, alpha: true, a: lin(0.42, 0.45, 0.2), b: lin(0.2, 0.28, 0.08) },
  wheatCard: { mat: 'grassCard', world: 0.5, alpha: true, a: lin(0.78, 0.65, 0.35), b: lin(0.5, 0.42, 0.2) },
  // Village buildings (src/world/village).
  slate: { mat: 'slateRoof', world: 2, a: lin(0.25, 0.27, 0.3), b: lin(0.33, 0.34, 0.37) },
  ashlar: { mat: 'ashlar', world: 4, a: lin(0.74, 0.69, 0.58), b: lin(0.63, 0.59, 0.5) }, // dressed limestone
  floorTiles: { mat: 'tomettes', world: 1.6, a: lin(0.52, 0.25, 0.15), b: lin(0.64, 0.35, 0.21) }, // terracotta tomettes
  crepi: { mat: 'crepi', world: 3, a: lin(0.85, 0.84, 0.8), b: lin(0.77, 0.76, 0.72) }, // lime render, tinted per house
  woodPaint: { mat: 'woodPlanks', world: 1.4, a: lin(0.86, 0.86, 0.84), b: lin(0.76, 0.76, 0.74) }, // white boards, tinted per object
  planeBark: { mat: 'planeBark', world: 1.2, a: lin(0.56, 0.55, 0.43), b: lin(0.4, 0.42, 0.33) },
  hay: { mat: 'hay', world: 1, a: lin(0.76, 0.63, 0.36), b: lin(0.48, 0.38, 0.19) },
  rubble: { mat: 'rubble', world: 2.5 },
  // Vehicles (src/vehicles/models).
  castOD: { mat: 'castArmor', world: 2, a: lin(0.29, 0.31, 0.2), b: lin(0.42, 0.4, 0.3) }, // cast hull/turret, olive drab
  castSoviet: { mat: 'castArmor', world: 2, a: lin(0.27, 0.33, 0.19), b: lin(0.38, 0.4, 0.28) }, // cast turret, 4BO green
  castGerman: { mat: 'castArmor', world: 2, a: lin(0.6, 0.52, 0.33), b: lin(0.66, 0.6, 0.45) }, // cast mantlet, dunkelgelb
  rubberTire: { mat: 'rubber', world: 0.8, a: lin(0.075, 0.075, 0.075), b: lin(0.34, 0.3, 0.24) }, // b = dust
  trackSteel: { mat: 'trackSteel', world: 0.6, a: lin(0.2, 0.19, 0.18), b: lin(0.3, 0.25, 0.18) }, // b = packed mud
  canvasOD: { mat: 'fabric', world: 1.2, a: lin(0.37, 0.36, 0.25) }, // cotton duck tops and seat covers
  canvasGerman: { mat: 'fabric', world: 1.2, a: lin(0.4, 0.39, 0.31) },
  canvasSoviet: { mat: 'fabric', world: 1.2, a: lin(0.4, 0.4, 0.27) },
  // Vegetation (src/world/vegetation), baked side by side with textures.atlas().
  // uniforms: shape parameters for the shader (vec4s, see vegLeaves / vegGround).
  vegBarkOak: { mat: 'vegBark', world: 1.6, a: lin(0.16, 0.14, 0.12), b: lin(0.4, 0.37, 0.33), uniforms: { uVegP: [0, 0, 0, 0] } },
  vegBarkBeech: { mat: 'vegBark', world: 1.6, a: lin(0.42, 0.42, 0.4), b: lin(0.6, 0.6, 0.56), uniforms: { uVegP: [1, 0, 0, 0] } },
  vegBarkPine: { mat: 'vegBark', world: 1.2, a: lin(0.5, 0.28, 0.15), b: lin(0.7, 0.45, 0.26), uniforms: { uVegP: [2, 0, 0, 0] } },
  vegBarkGrey: { mat: 'vegBark', world: 1.4, a: lin(0.26, 0.24, 0.21), b: lin(0.5, 0.48, 0.44), uniforms: { uVegP: [3, 0, 0, 0] } },
  vegLeafOak: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.15, 0.22, 0.07), b: lin(0.27, 0.34, 0.11), uniforms: { uVegP: [1, 0.12, 0.75, 10], uVegQ: [11, 0.75, 0.4, 0.85] } },
  vegLeafBeech: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.2, 0.29, 0.07), b: lin(0.33, 0.42, 0.12), uniforms: { uVegP: [0, 0.105, 0.62, 12], uVegQ: [11, 0.8, 0.5, 0.85] } },
  vegLeafAsh: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.24, 0.32, 0.1), b: lin(0.36, 0.44, 0.15), uniforms: { uVegP: [2, 0.1, 0.34, 13], uVegQ: [10, 0.7, 0.3, 0.9] } },
  vegLeafPoplar: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.2, 0.3, 0.1), b: lin(0.36, 0.43, 0.2), uniforms: { uVegP: [3, 0.08, 0.95, 13], uVegQ: [11, 0.5, 0.2, 0.9] } },
  vegLeafApple: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.2, 0.3, 0.1), b: lin(0.32, 0.4, 0.14), uniforms: { uVegP: [0, 0.105, 0.58, 11], uVegQ: [11, 0.85, 0.5, 0.8] } },
  vegNeedleSpruce: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.07, 0.13, 0.07), b: lin(0.15, 0.24, 0.1), uniforms: { uVegP: [4, 0.04, 0, 10], uVegQ: [7, 0.65, 0.25, 0.9] } },
  vegNeedlePine: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.12, 0.19, 0.11), b: lin(0.22, 0.3, 0.17), uniforms: { uVegP: [5, 0.13, 0, 7], uVegQ: [9, 0.8, 0.3, 0.8] } },
  vegLeafHawthorn: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.16, 0.25, 0.07), b: lin(0.27, 0.36, 0.11), uniforms: { uVegP: [6, 0.08, 0.8, 14], uVegQ: [12, 0.9, 0.6, 0.85] } },
  vegLeafHazel: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.22, 0.31, 0.09), b: lin(0.34, 0.42, 0.14), uniforms: { uVegP: [7, 0.12, 0.85, 9], uVegQ: [10, 0.85, 0.4, 0.8] } },
  vegLeafBramble: { mat: 'vegLeaves', world: 1.6, alpha: true, a: lin(0.15, 0.22, 0.08), b: lin(0.26, 0.32, 0.12), uniforms: { uVegP: [8, 0.11, 0.62, 10], uVegQ: [10, 1.0, 0.7, 0.8] } },
  vegHedgeCore: { mat: 'vegHedgeCore', world: 2, a: lin(0.14, 0.22, 0.06), b: lin(0.25, 0.33, 0.1) },
  vegGrass: { mat: 'vegGround', world: 0.6, alpha: true, a: lin(0.42, 0.48, 0.2), b: lin(0.16, 0.24, 0.07), uniforms: { uVegP: [0, 44, 0, 0] } },
  vegGrassDry: { mat: 'vegGround', world: 0.6, alpha: true, a: lin(0.6, 0.55, 0.33), b: lin(0.28, 0.3, 0.12), uniforms: { uVegP: [1, 30, 0, 0] } },
  vegWheat: { mat: 'vegGround', world: 0.6, alpha: true, a: lin(0.85, 0.7, 0.38), b: lin(0.6, 0.55, 0.28), uniforms: { uVegP: [2, 40, 0, 0] } },
  vegFern: { mat: 'vegGround', world: 0.8, alpha: true, a: lin(0.32, 0.42, 0.12), b: lin(0.18, 0.27, 0.07), uniforms: { uVegP: [3, 0, 0, 0] } },
  vegFlowers: { mat: 'vegGround', world: 0.6, alpha: true, a: lin(0.42, 0.48, 0.2), b: lin(0.16, 0.24, 0.07), uniforms: { uVegP: [4, 26, 0, 0] } },
  vegPoppies: { mat: 'vegGround', world: 0.6, alpha: true, a: lin(0.72, 0.62, 0.34), b: lin(0.3, 0.33, 0.13), uniforms: { uVegP: [5, 18, 0, 0] } },
  vegTallGrass: { mat: 'vegGround', world: 0.6, alpha: true, a: lin(0.5, 0.5, 0.25), b: lin(0.18, 0.25, 0.08), uniforms: { uVegP: [6, 34, 0, 0] } },
  vegWeeds: { mat: 'vegGround', world: 0.6, alpha: true, a: lin(0.3, 0.4, 0.13), b: lin(0.16, 0.24, 0.08), uniforms: { uVegP: [7, 10, 0, 0] } },
};

// Terrain layers (index = layer in the texture arrays; matches SURF ids 0..8).
export const TERRAIN_LAYERS = ['grass', 'dryGrass', 'dirt', 'mud', 'rock', 'plowed', 'cobble', 'forest', 'sand'];

export class TextureLibrary {
  constructor(renderer, { size = 1024, anisotropy = 8 } = {}) {
    this.renderer = renderer;
    this.size = size;
    this.anisotropy = Math.min(anisotropy, renderer.capabilities.getMaxAnisotropy());
    this.programs = new Map();
    this.cache = new Map();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  _material(name) {
    let m = this.programs.get(name);
    if (!m) {
      m = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: fragmentFor(name),
        uniforms: {
          uMode: { value: 0 },
          uSize: { value: 512 },
          uWorld: { value: 1 },
          uNormalScale: { value: 1 },
          uHeightRange: { value: 0.1 },
          uPaintA: { value: new THREE.Color(0.5, 0.5, 0.5) },
          uPaintB: { value: new THREE.Color(0.4, 0.4, 0.4) },
        },
        depthTest: false,
        depthWrite: false,
      });
      this.programs.set(name, m);
    }
    return m;
  }

  _setup(preset, size) {
    const mat = this._material(preset.mat);
    const u = mat.uniforms;
    u.uSize.value = size;
    u.uWorld.value = preset.world;
    u.uNormalScale.value = preset.normalScale ?? 1;
    u.uHeightRange.value = preset.heightRange ?? 0.1;
    if (preset.a) u.uPaintA.value.copy(preset.a);
    if (preset.b) u.uPaintB.value.copy(preset.b);
    // Extra vec4 shape parameters (vegetation presets).
    if (preset.uniforms) for (const [k, v] of Object.entries(preset.uniforms)) (u[k] ??= { value: new THREE.Vector4() }).value.fromArray(v);
    this.quad.material = mat;
    return u;
  }

  _target(size, srgb, mipmaps = true) {
    const rt = new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false,
      generateMipmaps: mipmaps,
      minFilter: mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
      anisotropy: this.anisotropy,
    });
    return rt;
  }

  _render(target, layer = 0) {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(target, layer);
    r.render(this.scene, this.camera);
    r.setRenderTarget(prev);
  }

  // Returns { map, normalMap, ormMap, repeat } for a preset name. Cached.
  get(name, size = this.size) {
    const key = `${name}@${size}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const preset = PRESETS[name];
    if (!preset) throw new Error(`Unknown texture preset ${name}`);
    const u = this._setup(preset, size);
    const map = this._target(size, true);
    u.uMode.value = 0;
    this._render(map);
    const normal = this._target(size, false);
    u.uMode.value = 1;
    this._render(normal);
    const orm = this._target(size, false);
    u.uMode.value = 2;
    this._render(orm);
    const set = {
      map: map.texture,
      normalMap: normal.texture,
      ormMap: orm.texture,
      world: preset.world,
      alpha: !!preset.alpha,
      targets: [map, normal, orm],
    };
    this.cache.set(key, set);
    return set;
  }

  // Texture arrays for the terrain: albedo+roughness (sRGB) and normal+height (linear).
  terrainArrays(size = this.size) {
    const n = TERRAIN_LAYERS.length;
    const mk = (srgb) =>
      new THREE.WebGLArrayRenderTarget(size, size, n, {
        depthBuffer: false,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
        colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
        anisotropy: this.anisotropy,
      });
    const albedo = mk(true);
    const normal = mk(false);
    for (let i = 0; i < n; i++) {
      const preset = PRESETS[TERRAIN_LAYERS[i]];
      const u = this._setup(preset, size);
      u.uMode.value = 3;
      this._render(albedo, i);
      u.uMode.value = 1;
      this._render(normal, i);
    }
    // (The renderer rebuilds the mipmaps of the whole array after each layer is drawn,
    // so after the last layer every level is up to date.)
    return {
      albedo: albedo.texture,
      normal: normal.texture,
      scales: TERRAIN_LAYERS.map((l) => PRESETS[l].world),
      targets: [albedo, normal],
    };
  }

  // Build a standard PBR material from a preset.
  standard(name, opts = {}) {
    const t = this.get(name, opts.size);
    const m = new THREE.MeshStandardMaterial({
      map: t.map,
      normalMap: t.normalMap,
      roughnessMap: t.ormMap,
      metalnessMap: t.ormMap,
      roughness: 1,
      metalness: 1,
      transparent: false,
      alphaTest: t.alpha ? 0.5 : 0,
      side: opts.side ?? THREE.FrontSide,
      color: opts.color ?? 0xffffff,
      ...opts.extra,
    });
    if (opts.normalScale !== undefined) m.normalScale.set(opts.normalScale, opts.normalScale);
    m.userData.texWorld = t.world;
    return m;
  }

  // Several presets baked side by side into one texture atlas (a grid of square
  // cells), so objects using any of them can share one material and one draw call.
  // cells: preset names in rows from the top-left (null leaves a cell empty).
  // Returns { map, normalMap (null when normals: false), ormMap, cols, rows,
  // cellSize, rect(i) -> [u0, v0, u1, v1], targets }. Cached by key and cell size.
  atlas(key, cells, { cols = 4, cellSize = 256, normals = true } = {}) {
    const cacheKey = `atlas:${key}@${cellSize}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const rows = Math.ceil(cells.length / cols);
    const w = cols * cellSize,
      h = rows * cellSize;
    // One quad per cell, each with its own copy of the preset's baking material
    // (copies share the compiled program), so a whole atlas is a single render.
    const scene = new THREE.Scene();
    const mats = [];
    cells.forEach((name, i) => {
      if (!name) return;
      const preset = PRESETS[name];
      if (!preset) throw new Error(`Unknown texture preset ${name}`);
      const m = this._material(preset.mat).clone();
      const u = m.uniforms;
      u.uSize.value = cellSize;
      u.uWorld.value = preset.world;
      u.uNormalScale.value = preset.normalScale ?? 1;
      u.uHeightRange.value = preset.heightRange ?? 0.1;
      if (preset.a) u.uPaintA.value.copy(preset.a);
      if (preset.b) u.uPaintB.value.copy(preset.b);
      if (preset.uniforms) for (const [k, v] of Object.entries(preset.uniforms)) u[k] = { value: new THREE.Vector4().fromArray(v) };
      const c = i % cols,
        r = Math.floor(i / cols);
      const x0 = (c / cols) * 2 - 1,
        x1 = ((c + 1) / cols) * 2 - 1;
      const y1 = 1 - (r / rows) * 2,
        y0 = 1 - ((r + 1) / rows) * 2;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const q = new THREE.Mesh(g, m);
      q.frustumCulled = false;
      scene.add(q);
      mats.push(m);
    });
    const mk = (srgb) =>
      new THREE.WebGLRenderTarget(w, h, {
        depthBuffer: false,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
        anisotropy: this.anisotropy,
      });
    const targets = [mk(true), normals ? mk(false) : null, mk(false)];
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const prevColor = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    targets.forEach((t, mode) => {
      if (!t) return;
      for (const m of mats) m.uniforms.uMode.value = mode;
      r.setRenderTarget(t);
      r.clear();
      r.render(scene, this.camera);
    });
    r.setRenderTarget(prev);
    r.setClearColor(prevColor, prevAlpha);
    scene.traverse((o) => o.geometry?.dispose());
    for (const m of mats) m.dispose();
    const set = {
      map: targets[0].texture,
      normalMap: targets[1]?.texture ?? null,
      ormMap: targets[2].texture,
      cols,
      rows,
      cellSize,
      world: 1,
      alpha: true,
      targets: targets.filter(Boolean),
      rect: (i) => [(i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows, ((i % cols) + 1) / cols, 1 - Math.floor(i / cols) / rows],
    };
    this.cache.set(cacheKey, set);
    return set;
  }

  dispose() {
    for (const set of this.cache.values()) for (const t of set.targets) t.dispose();
    for (const m of this.programs.values()) m.dispose();
  }
}
