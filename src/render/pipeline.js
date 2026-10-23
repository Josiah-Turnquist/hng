// The frame is drawn in stages:
//  1. the world (solid objects) into an HDR target with a depth texture
//  2. atmosphere: distance haze and height fog, computed from depth, so every
//     material gets the same consistent aerial perspective
//  3. see-through effects (smoke, dust, tracers, muzzle flashes) on top, depth-tested
//  4. the first-person weapon, drawn last with its own camera so it never clips walls
//  5. bloom (bright light bleeding), then tone mapping + film-style color grading
//  6. FXAA edge smoothing to the screen
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

export const LAYER_WORLD = 0;
export const LAYER_FX = 1;

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const ATMOS_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform samplerCube tSky;
uniform mat4 uInvProj;
uniform mat4 uProj;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uDensity;
uniform float uFalloff;
uniform float uBaseHeight;
uniform float uHaze;
uniform float uAO;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;

vec3 viewPos(vec2 uv, float d) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uInvProj * ndc;
  return v.xyz / v.w;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// Cheap screen-space ambient occlusion from the depth buffer alone.
float ambientOcclusion(vec2 uv, vec3 P, float d) {
  vec3 N = normalize(cross(dFdx(P), dFdy(P)));
  float radius = clamp(-P.z * 0.04, 0.25, 1.6); // meters
  float occ = 0.0;
  float a = hash(uv * 911.0) * 6.2831;
  const int S = 8;
  for (int i = 0; i < S; i++) {
    float fi = float(i);
    float ang = a + fi * 2.399963;
    float r = (fi + 0.5) / float(S);
    vec3 dir = normalize(vec3(cos(ang) * r, sin(ang) * r, 0.0) * 1.0);
    // Sample point in a hemisphere around the normal (view space).
    vec3 s = P + (N * (0.25 + 0.75 * r) + dir * 0.9) * radius * r;
    vec4 clip = uProj * vec4(s, 1.0);
    vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) continue;
    float sd = texture2D(tDepth, suv).r;
    vec3 SP = viewPos(suv, sd);
    float diff = SP.z - s.z; // positive when the scene is in front of the sample
    float range = smoothstep(0.0, 1.0, radius / abs(P.z - SP.z));
    occ += step(0.03, diff) * range;
  }
  return 1.0 - occ / float(S);
}

void main() {
  vec4 col = texture2D(tColor, vUv);
  float d = texture2D(tDepth, vUv).r;
  gl_FragDepth = d;
  if (d >= 0.99999) {
    gl_FragColor = col;
    return;
  }
  vec3 P = viewPos(vUv, d);
  if (uAO > 0.0 && -P.z < 120.0) {
    float ao = ambientOcclusion(vUv, P, d);
    col.rgb *= mix(1.0, ao, uAO * (1.0 - smoothstep(60.0, 120.0, -P.z)));
  }
  vec3 W = (uCamWorld * vec4(P, 1.0)).xyz;
  vec3 ray = W - uCamPos;
  float dist = length(ray);
  vec3 dir = ray / dist;
  // Exponential height fog: thick near the ground, thinning with altitude.
  float b = uFalloff;
  float camH = uCamPos.y - uBaseHeight;
  float dy = ray.y;
  float k = abs(b * dy) > 1e-4 ? (1.0 - exp(-b * dy)) / (b * dy) : 1.0;
  float optical = uDensity * exp(-b * camH) * dist * k + uHaze * dist;
  float fogAmt = 1.0 - exp(-optical);
  // Fog takes the color of the sky near the horizon in the same direction,
  // so far hills melt into the sky naturally. Toward the sun it glows.
  vec3 horizonDir = normalize(vec3(dir.x, max(dir.y, 0.0) * 0.5 + 0.03, dir.z));
  vec3 fogCol = textureCube(tSky, horizonDir).rgb;
  float sunAmt = pow(max(dot(dir, uSunDir), 0.0), 6.0);
  fogCol += uSunColor * sunAmt * 0.25;
  col.rgb = mix(col.rgb, fogCol, fogAmt);
  gl_FragColor = col;
}`;

const GRADE_FRAG = /* glsl */ `
#include <tonemapping_pars_fragment>

uniform sampler2D tColor;
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uAberration;
uniform float uDamage;   // red tint and darkening when hurt
uniform float uBlur;     // tunnel blur when exhausted/bleeding
uniform float uFlash;    // white flash from nearby explosions
varying vec2 vUv;

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  // Slight lens chromatic aberration toward the edges.
  vec3 hdr;
  if (uAberration > 0.0) {
    vec2 off = c * r2 * uAberration;
    hdr.r = texture2D(tColor, uv - off).r;
    hdr.g = texture2D(tColor, uv).g;
    hdr.b = texture2D(tColor, uv + off).b;
  } else {
    hdr = texture2D(tColor, uv).rgb;
  }
  if (uBlur > 0.0) {
    vec3 acc = hdr;
    float wsum = 1.0;
    float rr = uBlur * smoothstep(0.05, 0.45, r2) * 0.012;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec2 o = vec2(cos(a), sin(a)) * rr;
      acc += texture2D(tColor, uv + o).rgb;
      wsum += 1.0;
    }
    hdr = acc / wsum;
  }
  hdr += uFlash;
  vec3 col = AgXToneMapping(hdr);
  // Color grade in display space: lift/gain, contrast, saturation.
  col = sRGBTransferOETF(vec4(col, 1.0)).rgb;
  col = col * uGain + uLift * (1.0 - col);
  col = (col - 0.5) * uContrast + 0.5;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  // Damage: desaturate and redden the edges.
  if (uDamage > 0.0) {
    float edge = smoothstep(0.08, 0.5, r2);
    col = mix(col, vec3(l) * vec3(0.9, 0.3, 0.25), uDamage * edge * 0.8);
    col *= 1.0 - uDamage * 0.25;
  }
  col *= 1.0 - uVignette * smoothstep(0.1, 0.65, r2);
  col += (rand(uv * 731.0 + fract(uTime) * 91.0) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Pipeline {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.width = 1;
    this.height = 1;
    this.scale = quality.renderScale ?? 1;
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsGeo = new THREE.PlaneGeometry(2, 2);

    this.depthTexture = new THREE.DepthTexture(1, 1);
    this.depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthTexture: this.depthTexture,
      depthBuffer: true,
      samples: 0,
    });
    this.hdrRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    this.ldrRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false });

    this.atmos = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: ATMOS_FRAG,
      uniforms: {
        tColor: { value: this.sceneRT.texture },
        tDepth: { value: this.depthTexture },
        tSky: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
        uDensity: { value: 0.00032 },
        uFalloff: { value: 0.0035 },
        uBaseHeight: { value: 0 },
        uHaze: { value: 0.00009 },
        uAO: { value: quality.ssao ? 0.7 : 0 },
        uTexel: { value: new THREE.Vector2() },
        uNear: { value: 0.1 },
        uFar: { value: 3000 },
      },
      // Depth testing must be on (with "always pass") or the GPU won't write depth.
      depthTest: true,
      depthFunc: THREE.AlwaysDepth,
      depthWrite: true,
    });
    this.atmosQuad = new THREE.Mesh(this.fsGeo, this.atmos);
    this.atmosQuad.frustumCulled = false;
    this.atmosScene = new THREE.Scene();
    this.atmosScene.add(this.atmosQuad);

    this.grade = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: GRADE_FRAG,
      uniforms: {
        tColor: { value: this.hdrRT.texture },
        uTime: { value: 0 },
        uVignette: { value: 0.32 },
        uGrain: { value: 0.035 },
        uSaturation: { value: 0.86 },
        uContrast: { value: 1.06 },
        uLift: { value: new THREE.Vector3(0.012, 0.012, 0.02) },
        uGain: { value: new THREE.Vector3(1.0, 0.99, 0.95) },
        uAberration: { value: 0.012 },
        uDamage: { value: 0 },
        uBlur: { value: 0 },
        uFlash: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.gradeScene = new THREE.Scene();
    const gq = new THREE.Mesh(this.fsGeo, this.grade);
    gq.frustumCulled = false;
    this.gradeScene.add(gq);

    this.fxaa = new THREE.ShaderMaterial({
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: FXAAShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
      depthTest: false,
      depthWrite: false,
    });
    this.fxaa.uniforms.tDiffuse.value = this.ldrRT.texture;
    this.fxaaScene = new THREE.Scene();
    const fq = new THREE.Mesh(this.fsGeo, this.fxaa);
    fq.frustumCulled = false;
    this.fxaaScene.add(fq);

    this.bloom = quality.bloom ? new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.6) : null;
  }

  setSize(w, h, pixelRatio) {
    this.width = w;
    this.height = h;
    const s = this.scale * pixelRatio;
    const rw = Math.max(1, Math.floor(w * s)),
      rh = Math.max(1, Math.floor(h * s));
    this.sceneRT.setSize(rw, rh);
    this.hdrRT.setSize(rw, rh);
    this.ldrRT.setSize(rw, rh);
    this.atmos.uniforms.uTexel.value.set(1 / rw, 1 / rh);
    this.fxaa.uniforms.resolution.value.set(1 / rw, 1 / rh);
    if (this.bloom) this.bloom.setSize(Math.floor(rw / 2), Math.floor(rh / 2));
  }

  setSky(cubeTexture) {
    this.atmos.uniforms.tSky.value = cubeTexture;
  }

  // world: { scene, camera }, viewmodel: { scene, camera } or null
  render(scene, camera, viewScene, viewCamera, time) {
    const r = this.renderer;
    const u = this.atmos.uniforms;

    // 1) Solid world.
    r.shadowMap.needsUpdate = true;
    camera.layers.set(LAYER_WORLD);
    r.setRenderTarget(this.sceneRT);
    r.autoClear = true;
    r.render(scene, camera);

    // 2) Atmosphere and ambient occlusion.
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uProj.value.copy(camera.projectionMatrix);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    r.setRenderTarget(this.hdrRT);
    r.autoClear = false;
    r.clear(true, true, false);
    r.render(this.atmosScene, this.fsCam);

    // 3) See-through effects.
    camera.layers.set(LAYER_FX);
    r.render(scene, camera);
    camera.layers.set(LAYER_WORLD);

    // 4) First-person weapon.
    if (viewScene && viewCamera) {
      r.clearDepth();
      r.render(viewScene, viewCamera);
    }

    // 5) Bloom, then grading.
    if (this.bloom) this.bloom.render(r, null, this.hdrRT, 0, false);
    this.grade.uniforms.uTime.value = time;
    r.setRenderTarget(this.quality.fxaa ? this.ldrRT : null);
    r.autoClear = true;
    r.render(this.gradeScene, this.fsCam);
    if (this.quality.fxaa) {
      r.setRenderTarget(null);
      r.render(this.fxaaScene, this.fsCam);
    }
  }

}
