// Sky, sun and clouds. The sky is a physically based scattering model
// (Preetham); clouds are a procedural layer 1.5 km up that drifts with the wind.
// The same sky is captured into an environment map so metal, wet mud and glass
// reflect it, and into a small cube that gives distant haze its color.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { DEG } from '../core/math.js';

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
  for (int i = 0; i < 6; i++) { s += a * noise(p); p = R * p * 2.03 + 1.7; a *= 0.5; }
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
  float cov = smoothstep(1.0 - uCoverage, 1.0 - uCoverage + 0.28, n);
  if (cov <= 0.001) discard;
  // Self-shadowing: denser toward the sun means darker underside.
  vec2 toSun = normalize(uSunDir.xz + 1e-4) * 0.06;
  float n2 = fbm(p + toSun) * 0.65 + fbm(p * 0.35 + 3.1 + toSun * 0.35) * 0.55;
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
    u.turbidity.value = 7.5;
    u.rayleigh.value = 1.35;
    u.mieCoefficient.value = 0.0045;
    u.mieDirectionalG.value = 0.82;
    scene.add(this.sky);

    this.cloudMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uSunColor: { value: new THREE.Color(1.15, 1.1, 1.0) },
        uShadowColor: { value: new THREE.Color(0.42, 0.45, 0.52) },
        uTime: { value: 0 },
        uCoverage: { value: 0.42 },
        uDensity: { value: 0.92 },
        uWind: { value: this.wind },
        uHeight: { value: 1600 },
      },
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
    this.hemi = new THREE.HemisphereLight(0xbfd2e6, 0x4a4030, 0.25);
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

    // Sunlight gets warmer and dimmer near the horizon (longer path through air).
    const h = Math.max(0.0, Math.sin(el));
    const warm = 1 - Math.min(1, h / 0.5);
    this.sunColor.setRGB(1.0, 0.94 - warm * 0.25, 0.84 - warm * 0.45);
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = 3.2 * Math.min(1, h * 3 + 0.05);
    this.cloudMat.uniforms.uSunColor.value.setRGB(1.25 * this.sunColor.r, 1.2 * this.sunColor.g, 1.12 * this.sunColor.b);

    // Capture the sky (with clouds) for reflections and for fog color.
    const cap = this.captureScene;
    const skyParent = this.sky.parent,
      cloudParent = this.clouds.parent;
    cap.add(this.sky);
    cap.add(this.clouds);
    this.cubeCamera.position.set(0, 2, 0);
    this.cubeCamera.update(this.renderer, cap);
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = this.pmrem.fromScene(cap, 0.0, 1, 30000);
    skyParent?.add(this.sky);
    cloudParent?.add(this.clouds);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.85;
  }

  update(time) {
    this.cloudMat.uniforms.uTime.value = time;
  }

  // Keep the sun light's shadow centered on the viewer (non-cascaded fallback).
  get skyCube() {
    return this.cubeTarget.texture;
  }
}
