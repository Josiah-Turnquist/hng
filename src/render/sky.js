// Sky, sun and clouds. The sky is a physically based scattering model
// (Preetham); clouds are a procedural layer 1.5 km up that drifts with the wind.
// The same sky is captured into an environment map so metal, wet mud and glass
// reflect it, and into a small cube that gives distant haze its color.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { DEG } from '../core/math.js';
import { SHARED_UNIFORMS } from './pipeline.js';

// The scattering model's sky is too bright next to our sunlight: a clear blue sky is
// about as bright as a sunlit dirt road, not five times brighter. The visible sky is
// scaled down by this; the environment light keeps the full model at the same low
// intensity, so reflections of the sky match the sky.
const SKY_SCALE = 0.42;

const CLOUD_VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w * 0.99999; // just in front of the sky
}`;

const CLOUD_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uShadowColor;
uniform float uTime;
uniform float uCoverage;
uniform float uDensity;
uniform vec2 uWind;
uniform float uHeight;
varying vec3 vWorldPos;

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 R = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < CLOUD_OCTAVES; i++) { s += a * noise(p); p = R * p * 2.03 + 1.7; a *= 0.5; }
  return s;
}
void main() {
  vec3 dir = normalize(vWorldPos - cameraPosition);
  if (dir.y < 0.015) discard;
  float t = (uHeight - cameraPosition.y) / dir.y;
  vec2 p = (cameraPosition.xz + dir.xz * t) * 0.00032 + uWind * uTime;
  // Large-scale weather shape times detail.
  float shape = fbm(p * 0.35 + 3.1);
  float n = fbm(p) * 0.65 + shape * 0.55;
  float cov = smoothstep(1.0 - uCoverage, 1.0 - uCoverage + 0.22, n);
  if (cov <= 0.001) discard;
  // Self-shadowing: denser toward the sun means darker underside. (The large shape
  // hardly changes over that small step, so it is reused.)
  vec2 toSun = normalize(uSunDir.xz + 1e-4) * 0.06;
  float n2 = fbm(p + toSun) * 0.65 + shape * 0.55;
  float shade = clamp(0.62 - (n2 - n) * 3.5 + (1.0 - cov) * 0.25, 0.0, 1.0);
  vec3 col = mix(uShadowColor, uSunColor, shade);
  // Bright silver lining around the sun.
  float mu = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * pow(mu, 12.0) * (1.0 - cov) * 1.5;
  float fade = smoothstep(0.015, 0.25, dir.y);
  gl_FragColor = vec4(col, cov * uDensity * fade);
}`;

export class SkySystem {
  constructor(renderer, scene, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.quality = quality;
    this.elevation = 34 * DEG;
    this.azimuth = 215 * DEG;
    this.sunDir = new THREE.Vector3();
    this.sunColor = new THREE.Color();
    this.wind = new THREE.Vector2(0.004, 0.0015);

    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    const u = this.sky.material.uniforms;
    // The sun disc is drawn in the visible sky but left out of the captured
    // environment light: the sun already lights the scene directly, and counting
    // it twice makes every surface glare.
    u.uSunDisk = { value: 1 };
    u.uSkyScale = { value: SKY_SCALE };
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace('L0 += ( vSunE * 19000.0 * Fex ) * sundisk;', 'L0 += ( vSunE * 19000.0 * Fex ) * sundisk * uSunDisk;')
      .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * uSkyScale, 1.0 );')
      .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float uSunDisk;\nuniform float uSkyScale;');
    // A late summer afternoon over Normandy: fairly clear, with haze low down that
    // glows around the sun.
    u.turbidity.value = 5.2;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.0055;
    u.mieDirectionalG.value = 0.86;
    scene.add(this.sky);

    this.cloudMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uSunColor: { value: new THREE.Color(1.15, 1.1, 1.0) },
        uShadowColor: { value: new THREE.Color(0.34, 0.37, 0.43) },
        uTime: { value: 0 },
        uCoverage: { value: 0.42 },
        uDensity: { value: 0.92 },
        uWind: { value: this.wind },
        uHeight: { value: 1600 },
      },
      defines: { CLOUD_OCTAVES: quality?.effects === 'low' ? 4 : 6 },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), this.cloudMat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -9;
    scene.add(this.clouds);

    // Sun light. Cascaded shadows are attached by the World (see shadows.js).
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.hemi = new THREE.HemisphereLight(0xbfd2e6, 0x4a4030, 0.08);
    scene.add(this.hemi);

    // Capture targets.
    this.cubeTarget = new THREE.WebGLCubeRenderTarget(64, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.cubeCamera = new THREE.CubeCamera(1, 30000, this.cubeTarget);
    this.captureScene = new THREE.Scene();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = null;
    this.update(0);
  }

  setSun(elevationDeg, azimuthDeg) {
    this.elevation = elevationDeg * DEG;
    this.azimuth = azimuthDeg * DEG;
  }

  // Recompute sun direction, light colors and the captured sky.
  refresh() {
    const el = this.elevation,
      az = this.azimuth;
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir).multiplyScalar(450000);

    // Sunlight gets warmer and dimmer near the horizon: the air it crosses (air mass,
    // Kasten and Young) scatters blue away more than red. A late afternoon sun about
    // 20 degrees up is golden; at 30 degrees and more it is nearly white.
    const elDeg = Math.max(0, el / DEG);
    const airMass = 1 / (Math.sin(Math.max(el, 0)) + 0.15 * Math.pow(elDeg + 3.885, -1.253));
    const t = [0.09, 0.14, 0.28].map((tau) => Math.exp(-tau * airMass));
    this.sunColor.setRGB(1, t[1] / t[0], t[2] / t[0]);
    this.sun.color.copy(this.sunColor);
    const lum = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
    this.sun.intensity = 6.0 * lum * Math.min(1, elDeg / 3);
    this.cloudMat.uniforms.uSunColor.value.setRGB(1.25 * this.sunColor.r, 1.2 * this.sunColor.g, 1.12 * this.sunColor.b);

    // Capture the sky (with clouds, without the sun disc) for fog color, and at full
    // strength for the environment light and reflections.
    const cap = this.captureScene;
    const skyParent = this.sky.parent,
      cloudParent = this.clouds.parent;
    const su = this.sky.material.uniforms;
    cap.add(this.sky);
    cap.add(this.clouds);
    su.uSunDisk.value = 0;
    this.cubeCamera.position.set(0, 2, 0);
    this.cubeCamera.update(this.renderer, cap);
    su.uSkyScale.value = 1;
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = this.pmrem.fromScene(cap, 0.0, 1, 30000);
    su.uSkyScale.value = SKY_SCALE;
    su.uSunDisk.value = 1;
    skyParent?.add(this.sky);
    cloudParent?.add(this.clouds);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = SKY_SCALE;

    // Shared with the atmosphere pass and the particles.
    const S = SHARED_UNIFORMS;
    S.tSkyCube.value = this.cubeTarget.texture;
    S.uSkyScale.value = 1; // the fog cube is captured at the visible sky's brightness
    S.uSunDir.value.copy(this.sunDir);
    S.uSunColor.value.copy(this.sunColor);
    S.uSunLight.value.copy(this.sunColor).multiplyScalar(this.sun.intensity);
    this._measureAmbient(S.uAmbient.value);
  }

  // Average sky light (what lights a surface facing up, per unit of albedo), read
  // back from the captured sky: the top face counts double, the sides once.
  _measureAmbient(out) {
    const n = this.cubeTarget.width;
    const buf = new Uint16Array(n * n * 4);
    const acc = [0, 0, 0];
    let w = 0;
    try {
      for (const [face, k] of [[2, 2], [0, 1], [1, 1], [4, 1], [5, 1]]) {
        this.renderer.readRenderTargetPixels(this.cubeTarget, 0, 0, n, n, buf, face);
        for (let i = 0; i < n * n; i += 7) {
          for (let c = 0; c < 3; c++) acc[c] += THREE.DataUtils.fromHalfFloat(buf[i * 4 + c]) * k;
          w += k;
        }
      }
      // (Some browsers can't read these pixels back and leave zeros: keep the default.)
      if (w > 0 && acc.every(Number.isFinite) && acc[0] + acc[1] + acc[2] > 1e-3 * w) out.setRGB(acc[0] / w, acc[1] / w, acc[2] / w);
    } catch {
      /* keep the default */
    }
  }

  update(time) {
    this.cloudMat.uniforms.uTime.value = time;
  }

  // Lower effects settings draw the clouds with less fine detail.
  setQuality(q) {
    this.quality = q;
    const oct = q.effects === 'low' ? 4 : 6;
    if (this.cloudMat.defines.CLOUD_OCTAVES !== oct) {
      this.cloudMat.defines.CLOUD_OCTAVES = oct;
      this.cloudMat.needsUpdate = true;
    }
  }

  // Keep the sun light's shadow centered on the viewer (non-cascaded fallback).
  get skyCube() {
    return this.cubeTarget.texture;
  }
}
