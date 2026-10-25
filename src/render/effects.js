// Visual effects: smoke, dust, sparks, splashes, tracers, bullet holes and
// short-lived flashes of light. Everything is drawn with a few instanced meshes
// so thousands of particles cost only a handful of draw calls.
//
// Smoke and dust are lit by the sun and the sky (each puff shaded like a soft ball),
// sit in the same haze as the world, and fade where they meet the ground or a wall
// instead of showing a hard line. The effects setting scales how many particles are
// made, and how many flashes light up their surroundings.
import * as THREE from 'three';
import { LAYER_FX, SHARED_UNIFORMS, ATMOSPHERE_PARS } from './pipeline.js';
import { clamp } from '../core/math.js';

const MAX_PARTICLES = 3000;
const MAX_TRACERS = 256;
const TRAIL_RANGE = 45; // m from the camera: faint trails behind ordinary bullets
const MAX_DECALS = 600;

// Per effects quality: particle count factor, soft edges, number of flash lights
// (each light costs a little on every lit pixel of the screen).
const QUALITY = {
  low: { count: 0.5, soft: false, lights: 0 },
  medium: { count: 0.75, soft: true, lights: 2 },
  high: { count: 1, soft: true, lights: 4 },
};

// Billboard particle shader. Each instance: position, size, rotation, color/alpha,
// and a seed that varies the procedural puff shape (seeds above 1 draw a
// star-shaped muzzle flash). Soft round puffs are computed in the shader with noise,
// so no textures are needed.
const PARTICLE_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iColor;
attribute vec3 iParams; // size, rotation, seed
uniform float uAdditive;
varying vec4 vColor;
varying vec2 vUv;
varying float vSeed;
varying vec3 vWorld;
varying float vViewZ;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vBack;
void main() {
  vColor = iColor;
  vUv = uv;
  vSeed = iParams.z;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  float c = cos(iParams.y), s = sin(iParams.y);
  vec2 p = position.xy;
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float size = iParams.x;
  // Flashes stay a few pixels wide far away, so a distant shot can be seen.
  if (iParams.z > 1.5) size = max(size, -mv.z * 0.004);
  mv.xy += p * size;
  vViewZ = -mv.z;
  // The quad's axes in the world, turned with the particle (to light the puff).
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vRight = c * camR + s * camU;
  vUp = -s * camR + c * camU;
  vBack = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vWorld = iPos + (vRight * position.x + vUp * position.y) * size;
  gl_Position = projectionMatrix * mv;
}`;

const PARTICLE_FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tSceneDepth;
uniform vec4 uScreen;
uniform vec2 uCamNearFar;
uniform vec3 uSunLight;
uniform vec3 uAmbient;
uniform float uAdditive;
uniform float uSoft;
${ATMOSPHERE_PARS}
varying vec4 vColor;
varying vec2 vUv;
varying float vSeed;
varying vec3 vWorld;
varying float vViewZ;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vBack;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float a;
  vec3 col = vColor.rgb;
  if (uAdditive > 0.5) {
    a = pow(max(0.0, 1.0 - r), 2.0);
    if (vSeed > 1.5) {
      // Muzzle flash: a hot core and a few uneven spikes.
      float ang = atan(c.y, c.x);
      float spikes = pow(abs(cos(ang * 2.5 + vSeed * 7.0)), 10.0) * (0.6 + 0.4 * h(vec2(floor(ang * 0.8 + 3.0), vSeed)));
      a = pow(max(0.0, 1.0 - r), 3.0) * 1.5 + spikes * pow(max(0.0, 1.0 - r), 1.2) * 0.8;
    }
  } else {
    vec2 q = c * 3.0 + vSeed * 17.0;
    float noise = n(q) * 0.55 + n(q * 2.1 + 3.0) * 0.3 + n(q * 4.3) * 0.15;
    a = smoothstep(1.0, 0.25, r + (noise - 0.5) * 0.85);
    // Light the puff like a soft ball: sun from its side, sky from above; light
    // also comes through thin smoke when looking toward the sun.
    vec2 s = c * 2.0;
    vec3 nrm = normalize(vRight * s.x + vUp * s.y + vBack * sqrt(max(0.0, 1.0 - dot(s, s)) + 0.15) + (noise - 0.5) * 0.6 * vBack);
    float wrap = clamp(dot(nrm, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
    float through = pow(max(dot(-vBack, uSunDir), 0.0), 6.0) * (1.0 - vColor.a * 0.6);
    float sky = 0.75 + 0.25 * nrm.y;
    col *= uAmbient * sky + uSunLight * (wrap * 0.85 + through * 0.6) * 0.3183;
  }
  a *= vColor.a;
  // Fade where the particle meets solid things.
  if (uSoft > 0.5) {
    float d = texture2D(tSceneDepth, gl_FragCoord.xy * uScreen.zw).r;
    float sceneZ = -perspectiveDepthToViewZ(d, uCamNearFar.x, uCamNearFar.y);
    float soft = uAdditive > 0.5 ? 0.15 : 0.6;
    a *= clamp((sceneZ - vViewZ) / (soft * (1.0 + vViewZ * 0.01)), 0.0, 1.0);
  }
  if (a < 0.003) discard;
  vec4 air = atmosphereAt(cameraPosition, vWorld);
  if (uAdditive > 0.5) {
    a *= air.x;
    gl_FragColor = vec4(col * a, a);
  } else {
    col = col * air.x + air.yzw * (1.0 - air.x);
    gl_FragColor = vec4(col, a);
  }
}`;

// Projectiles in flight, drawn as camera-facing strips from the tail A to the
// head B (the head is where the projectile is now), with a rounded end and room
// round it for a glow. Shaded as a projectile seen in motion: a solid head and
// a tail thinning and fading behind it (the blur of something moving fast).
//   iWidth: radius of the head (m); uKind: 0 glowing tracers (added light),
//   1 ball rounds (copper bullets, blended over the scene).
const TRACER_VERT = /* glsl */ `
attribute vec3 iA;
attribute vec3 iB;
attribute vec4 iColor;
attribute float iWidth;
uniform float uKind;
varying vec4 vColor;
varying vec2 vQ; // (along from the head, m: < 0 toward the tail; across, m)
varying float vLen;
varying float vR;
varying vec3 vWorld;
void main() {
  vColor = iColor;
  vec3 dir = iB - iA;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec3(0.0, 0.0, 1.0);
  vec3 toCam = normalize(cameraPosition - iB);
  float dist = length(cameraPosition - iB);
  // Seen end on (coming at you, or going away), the strip shortens to a round head.
  vec3 dv = dir - toCam * dot(dir, toCam);
  float dvl = length(dv);
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 axis = dvl > 1e-3 ? dv / dvl : camRight;
  // The tail is the blur of the last moment of flight: never more than a few
  // degrees across the view, so close by it reads as a slug, not a line.
  float plen = min(len * dvl, dist * (uKind > 0.5 ? 0.12 : 0.2));
  // Never thinner than a pixel or two, so they stay visible far away.
  float r = max(iWidth, dist * (uKind > 0.5 ? 0.0016 : 0.0014));
  float pad = r * (uKind > 0.5 ? 1.8 : 5.0); // room for the glow
  float s = mix(-plen - pad, pad, position.x);
  vec3 side = normalize(cross(axis, toCam));
  vec3 P = iB + axis * s + side * position.y * 2.0 * pad;
  vQ = vec2(s, position.y * 2.0 * pad);
  vLen = max(plen, 1e-4);
  vR = r;
  // Thinner than a pixel: fainter instead.
  vColor.a *= min(1.0, iWidth / r * 1.5 + 0.4);
  vWorld = P;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}`;

const TRACER_FRAG = /* glsl */ `
${ATMOSPHERE_PARS}
uniform vec3 uSunLight;
uniform vec3 uAmbient;
uniform float uKind;
varying vec4 vColor;
varying vec2 vQ;
varying float vLen;
varying float vR;
varying vec3 vWorld;
void main() {
  // 0 at the head .. 1 at the end of the tail.
  float t = clamp(-vQ.x / vLen, 0.0, 1.0);
  // Distance from the centre line (round at both ends).
  float d = vQ.x > 0.0 ? length(vQ) : vQ.x < -vLen ? length(vec2(vQ.x + vLen, vQ.y)) : abs(vQ.y);
  vec4 air = atmosphereAt(cameraPosition, vWorld);
  if (uKind < 0.5) {
    // Tracer: a white-hot head in a ball of coloured glow (the burning
    // compound), the tail narrowing and fading fast behind it. Drawn over what's
    // behind (not only added), so the colour shows against a bright sky too.
    float rc = vR * mix(1.0, 0.3, t);
    float fade = exp(-3.2 * t);
    float core = (1.0 - smoothstep(rc * 0.35, rc, d)) * fade;
    float head = exp(-dot(vQ, vQ) / (vR * vR * 5.0));
    float tail = exp(-(d * d) / (rc * rc * 3.0)) * fade * 0.7;
    float a = clamp(max(core, max(head * 0.95, tail)), 0.0, 1.0) * vColor.a * air.x;
    if (a < 0.003) discard;
    float peak = max(max(vColor.r, vColor.g), vColor.b);
    float hot = clamp(core * 1.2 + head * head * 0.6, 0.0, 1.0);
    vec3 col = mix(vColor.rgb * 0.35, vec3(peak) * vec3(1.0, 0.93, 0.82), hot);
    gl_FragColor = vec4(col * a, a);
  } else {
    // Ball round: a small copper-coloured bullet, lit by the sun and sky, with a
    // short blur behind it; a glint along its top, darker at the edges so it
    // shows against grass as well as sky.
    float rc = vR * mix(1.0, 0.45, t);
    float body = 1.0 - smoothstep(rc * 0.6, rc, d);
    float a = body * mix(1.0, 0.0, pow(t, 0.5)) * vColor.a;
    if (a < 0.004) discard;
    float glint = exp(-pow((vQ.y + vR * 0.3) / (vR * 0.28), 2.0)) * (1.0 - t);
    float edge = smoothstep(rc * 0.2, rc * 0.9, d);
    vec3 metal = vColor.rgb * (uAmbient * 0.9 + uSunLight * 0.3) * (1.0 - edge * 0.65) + glint * uSunLight * 0.3;
    vec3 col = metal * air.x + air.yzw * (1.0 - air.x);
    gl_FragColor = vec4(col, a);
  }
}`;

// Presets: color (linear albedo, or light for additive ones), size range, growth,
// life, gravity scale, drag, upward drift.
const P = {
  dust: { color: [0.3, 0.25, 0.19], alpha: 0.7, size: [0.25, 0.5], grow: 1.6, life: [1.2, 2.2], g: 0.0, drag: 2.5, rise: 0.3 },
  dirt: { color: [0.14, 0.11, 0.08], alpha: 0.95, size: [0.04, 0.09], grow: 0, life: [0.6, 1.0], g: 1.0, drag: 0.5, rise: 0 },
  mud: { color: [0.09, 0.07, 0.05], alpha: 0.95, size: [0.05, 0.11], grow: 0, life: [0.5, 0.9], g: 1.0, drag: 0.4, rise: 0 },
  brick: { color: [0.42, 0.24, 0.17], alpha: 0.75, size: [0.2, 0.4], grow: 1.3, life: [1.0, 2.0], g: 0.05, drag: 2.5, rise: 0.15 },
  stone: { color: [0.46, 0.44, 0.41], alpha: 0.75, size: [0.2, 0.4], grow: 1.3, life: [1.0, 2.0], g: 0.05, drag: 2.5, rise: 0.15 },
  plaster: { color: [0.62, 0.6, 0.55], alpha: 0.8, size: [0.2, 0.45], grow: 1.4, life: [1.2, 2.2], g: 0.05, drag: 2.5, rise: 0.15 },
  wood: { color: [0.36, 0.27, 0.17], alpha: 1, size: [0.03, 0.07], grow: 0, life: [0.6, 1.1], g: 1.0, drag: 0.6, rise: 0 },
  leaves: { color: [0.16, 0.24, 0.08], alpha: 1, size: [0.04, 0.08], grow: 0, life: [1.0, 2.0], g: 0.25, drag: 3, rise: 0 },
  spark: { color: [9, 5, 1.6], alpha: 1, size: [0.015, 0.03], grow: 0, life: [0.15, 0.35], g: 1.0, drag: 0.3, rise: 0, add: true },
  blood: { color: [0.2, 0.015, 0.01], alpha: 0.85, size: [0.12, 0.25], grow: 0.8, life: [0.25, 0.5], g: 0.4, drag: 4, rise: 0 },
  water: { color: [0.62, 0.67, 0.7], alpha: 0.75, size: [0.1, 0.22], grow: 0.6, life: [0.6, 1.1], g: 1.0, drag: 0.6, rise: 0 },
  glass: { color: [0.7, 0.8, 0.85], alpha: 0.9, size: [0.02, 0.04], grow: 0, life: [0.5, 0.9], g: 1.0, drag: 0.3, rise: 0 },
  muzzleSmoke: { color: [0.5, 0.5, 0.48], alpha: 0.3, size: [0.08, 0.16], grow: 0.9, life: [0.9, 1.8], g: 0, drag: 3, rise: 0.15 },
  // A rocket motor's smoke: a pale trail hanging in the air behind it.
  rocketSmoke: { color: [0.66, 0.66, 0.64], alpha: 0.8, size: [0.26, 0.4], grow: 1.3, life: [1.8, 3.0], g: 0, drag: 2.5, rise: 0.12 },
  smoke: { color: [0.24, 0.24, 0.23], alpha: 0.7, size: [1.2, 2.2], grow: 1.2, life: [5, 9], g: 0, drag: 0.8, rise: 0.9 },
  fire: { color: [7, 2.6, 0.6], alpha: 0.9, size: [0.6, 1.1], grow: 0.4, life: [0.4, 0.8], g: 0, drag: 1.5, rise: 2.5, add: true },
  flash: { color: [30, 18, 7], alpha: 1, size: [2.5, 3.5], grow: 2, life: [0.06, 0.1], g: 0, drag: 0, rise: 0, add: true },
  // A high-explosive burst is over in a fraction of a second (no lingering flames).
  fireball: { color: [10, 4.5, 1.4], alpha: 1, size: [0.8, 1.4], grow: 3, life: [0.1, 0.22], g: 0, drag: 2, rise: 1, add: true },
  muzzleFlash: { color: [26, 15, 6], alpha: 1, size: [0.16, 0.24], grow: 1.5, life: [0.035, 0.05], g: 0, drag: 0, rise: 0, add: true, star: true },
  debris: { color: [0.12, 0.1, 0.07], alpha: 1, size: [0.05, 0.14], grow: 0, life: [1.2, 2.2], g: 1.0, drag: 0.25, rise: 0 },
  // A shell's burst of earth: dark clods thrown high, and a brown dust column.
  clods: { color: [0.08, 0.065, 0.05], alpha: 1, size: [0.12, 0.3], grow: 0, life: [1.4, 2.4], g: 1.0, drag: 0.15, rise: 0 },
  column: { color: [0.16, 0.13, 0.1], alpha: 0.85, size: [0.8, 1.4], grow: 2.2, life: [2.5, 4.5], g: 0.02, drag: 1.2, rise: 0.3 },
};

class ParticleLayer {
  constructor(additive) {
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 4);
    this.par = new Float32Array(MAX_PARTICLES * 3);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aPar = new THREE.InstancedBufferAttribute(this.par, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iColor', this.aCol);
    geo.setAttribute('iParams', this.aPar);
    geo.instanceCount = 0;
    const S = SHARED_UNIFORMS;
    this.uniforms = {
      uAdditive: { value: additive ? 1 : 0 },
      uSoft: { value: 1 },
      tSceneDepth: S.tSceneDepth,
      uScreen: S.uScreen,
      uCamNearFar: S.uCamNearFar,
      uSunLight: S.uSunLight,
      uAmbient: S.uAmbient,
      tSkyCube: S.tSkyCube,
      uFog: S.uFog,
      uSunDir: S.uSunDir,
      uSunColor: S.uSunColor,
      uSkyScale: S.uSkyScale,
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER_FX);
    this.mesh.renderOrder = additive ? 20 : 10;
    this.list = [];
  }

  update(dt, camPos) {
    const L = this.list;
    let n = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) {
        L[i] = L[L.length - 1];
        L.pop();
        continue;
      }
      p.vy -= 9.81 * p.g * dt;
      p.vy += p.rise * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vz *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.ground !== undefined && p.y < p.ground) {
        p.y = p.ground;
        p.vy *= -0.2;
        p.vx *= 0.5;
        p.vz *= 0.5;
      }
      p.size += p.grow * dt;
      p.rot += p.spin * dt;
    }
    // Sort far to near so blending looks right (cheap enough for a few thousand).
    if (!this.additive && L.length > 1) {
      for (const p of L) p.cd = (p.x - camPos.x) ** 2 + (p.y - camPos.y) ** 2 + (p.z - camPos.z) ** 2;
      L.sort((a, b) => b.cd - a.cd);
    }
    for (const p of L) {
      if (n >= MAX_PARTICLES) break;
      const t = p.age / p.life;
      const fade = p.star ? 1 - t * t : Math.min(1, t * 8) * (1 - t) * (1 - t);
      this.pos[n * 3] = p.x;
      this.pos[n * 3 + 1] = p.y;
      this.pos[n * 3 + 2] = p.z;
      this.col[n * 4] = p.r;
      this.col[n * 4 + 1] = p.gc;
      this.col[n * 4 + 2] = p.b;
      this.col[n * 4 + 3] = p.a * fade;
      this.par[n * 3] = p.size;
      this.par[n * 3 + 1] = p.rot;
      this.par[n * 3 + 2] = p.seed;
      n++;
    }
    this.mesh.geometry.instanceCount = n;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aPar.needsUpdate = true;
  }
}

export class Effects {
  constructor(world, quality = world.quality) {
    this.world = world;
    this.alpha = new ParticleLayer(false);
    this.add = new ParticleLayer(true);
    this.add.additive = true;
    world.scene.add(this.alpha.mesh, this.add.mesh);
    this._makeTracers();
    this._makeDecals();
    this.camPos = new THREE.Vector3(1e9, 0, 0);
    // A fixed pool of lights for flashes (a fixed count so shaders don't recompile
    // during play; only the effects setting changes it).
    this.lights = [];
    this.lightIndex = 0;
    this.setQuality(quality);
  }

  // Effects quality from the settings ('low', 'medium', 'high' in quality.effects).
  setQuality(quality) {
    const q = QUALITY[quality?.effects] || QUALITY.high;
    this.q = q;
    this.alpha.uniforms.uSoft.value = q.soft ? 1 : 0;
    this.add.uniforms.uSoft.value = q.soft ? 1 : 0;
    while (this.lights.length > q.lights) this.world.scene.remove(this.lights.pop());
    while (this.lights.length < q.lights) {
      const l = new THREE.PointLight(0xffaa55, 0, 12, 2);
      l.userData.t = 0;
      this.world.scene.add(l);
      this.lights.push(l);
    }
    this.lightIndex = 0;
  }

  spawn(type, x, y, z, { count = 1, speed = 1, dir = null, spread = 1, scale = 1, ground = undefined, color = null } = {}) {
    const p = P[type];
    if (!p) return;
    const layer = p.add ? this.add : this.alpha;
    // Fewer particles on lower settings (randomly rounded); single ones, such as
    // flashes, always appear.
    if (count > 1) count = Math.max(1, Math.floor(count * this.q.count + Math.random() * 0.999));
    for (let i = 0; i < count; i++) {
      if (layer.list.length >= MAX_PARTICLES) layer.list.shift();
      let vx = (Math.random() - 0.5) * 2 * spread,
        vy = (Math.random() - 0.5) * 2 * spread,
        vz = (Math.random() - 0.5) * 2 * spread;
      if (dir) {
        vx += dir[0];
        vy += dir[1];
        vz += dir[2];
      }
      const c = color || p.color;
      const tint = 0.85 + Math.random() * 0.3;
      layer.list.push({
        x,
        y,
        z,
        vx: vx * speed,
        vy: vy * speed,
        vz: vz * speed,
        age: 0,
        life: p.life[0] + Math.random() * (p.life[1] - p.life[0]),
        size: (p.size[0] + Math.random() * (p.size[1] - p.size[0])) * scale,
        grow: p.grow * scale,
        g: p.g,
        drag: p.drag,
        rise: p.rise,
        r: c[0] * tint,
        gc: c[1] * tint,
        b: c[2] * tint,
        a: p.alpha,
        rot: Math.random() * 6.28,
        spin: (Math.random() - 0.5) * 2,
        seed: Math.random() + (p.star ? 2 : 0),
        star: !!p.star,
        ground,
      });
    }
  }

  // A bullet hitting something: dust/debris/sparks shaped by the material,
  // thrown back along the surface normal.
  impact(info) {
    const { x, y, z, nx, ny, nz } = info;
    const e = Math.min(1, Math.sqrt(Math.max(0, info.energy)) / 60);
    const n = [nx * 2.5, ny * 2.5, nz * 2.5];
    const fx = info.effect || info.mat?.effect || 'dirt';
    const gy = this.world.hf.getHeight(x, z);
    switch (fx) {
      case 'dirt':
      case 'dust':
        this.spawn('dust', x, y, z, { count: 3, dir: n.map((v) => v * 0.6), spread: 0.4, scale: 0.6 + e });
        this.spawn('dust', x, y, z, { count: 1, dir: [n[0] * 0.3, 1.2, n[2] * 0.3], spread: 0.2, scale: 0.4 + e * 0.5 });
        this.spawn('dirt', x, y, z, { count: 6 + Math.round(e * 8), dir: n.map((v) => v * 1.4), spread: 1.4, speed: 1.5, ground: gy });
        break;
      case 'mud':
        this.spawn('mud', x, y, z, { count: 8, dir: n.map((v) => v * 1.4), spread: 1.2, speed: 1.4, ground: gy });
        this.spawn('dust', x, y, z, { count: 1, scale: 0.4, color: [0.16, 0.13, 0.1] });
        break;
      case 'brick':
      case 'plaster':
      case 'stone':
        this.spawn(fx, x, y, z, { count: 3, dir: n.map((v) => v * 0.8), spread: 0.35, scale: 0.6 + e * 0.8 });
        this.spawn('debris', x, y, z, { count: 5, dir: n.map((v) => v * 1.6), spread: 1.2, speed: 1.6, ground: gy, color: fx === 'brick' ? [0.3, 0.13, 0.08] : [0.38, 0.36, 0.33] });
        if (fx === 'stone') this.spawn('spark', x, y, z, { count: 2, dir: n.map((v) => v * 1.5), spread: 2, speed: 2, ground: gy });
        break;
      case 'wood':
        this.spawn('wood', x, y, z, { count: 6, dir: n.map((v) => v * 1.5), spread: 1.4, speed: 1.4, ground: gy });
        this.spawn('dust', x, y, z, { count: 1, scale: 0.4, color: [0.38, 0.32, 0.23] });
        break;
      case 'sparks':
        this.spawn('spark', x, y, z, { count: 6 + Math.round(e * 10), dir: n.map((v) => v * 2), spread: 2.5, speed: 2.5, ground: gy });
        this.spawn('dust', x, y, z, { count: 1, scale: 0.3, color: [0.33, 0.33, 0.33] });
        // (A spark lights only the metal right round it, and only for a moment.)
        this.flashLight(x + nx * 0.2, y + ny * 0.2, z + nz * 0.2, 0.5 + e, 2, 0.03);
        break;
      case 'water':
        this.spawn('water', x, y, z, { count: 10, dir: [0, 3.5, 0], spread: 0.9, speed: 1.2 });
        this.spawn('water', x, y, z, { count: 3, dir: [0, 1.2, 0], spread: 0.5, speed: 1, scale: 1.6 });
        break;
      case 'glass':
        this.spawn('glass', x, y, z, { count: 10, dir: n.map((v) => -v), spread: 1.5, speed: 1.5, ground: gy });
        break;
      case 'leaves':
        this.spawn('leaves', x, y, z, { count: 6, spread: 1.0, speed: 0.8, ground: gy });
        break;
      case 'blood':
        this.spawn('blood', x, y, z, { count: 3, dir: [info.dirX * 1.5, info.dirY * 1.5 + 0.3, info.dirZ * 1.5], spread: 0.5 });
        break;
      default:
        this.spawn('dust', x, y, z, { count: 2, scale: 0.5 });
    }
  }

  muzzle(x, y, z, dx, dy, dz, big = 1) {
    this.spawn('muzzleSmoke', x + dx * 0.1, y + dy * 0.1, z + dz * 0.1, { count: 2 + Math.round(big), dir: [dx * 1.5, dy * 1.5, dz * 1.5], spread: 0.25, scale: 0.6 + big * 0.5 });
    // The flash, seen by everyone but the shooter (whose own gun draws its flash).
    const near = (x - this.camPos.x) ** 2 + (y - this.camPos.y) ** 2 + (z - this.camPos.z) ** 2 < 2.5 * 2.5;
    if (!near) {
      const s = 0.7 + big * 0.5;
      this.spawn('muzzleFlash', x + dx * 0.06, y + dy * 0.06, z + dz * 0.06, { count: 1, dir: [dx * 2, dy * 2, dz * 2], spread: 0, scale: s });
      this.spawn('muzzleFlash', x + dx * 0.18 * s, y + dy * 0.18 * s, z + dz * 0.18 * s, { count: 1, dir: [dx * 3, dy * 3, dz * 3], spread: 0, scale: s * 0.7 });
    }
    // A muzzle flash lasts a few thousandths of a second: in daylight it lights
    // almost nothing round it, in a dark room it lights the walls. (Brighter or
    // longer, every shot made the soldiers and vehicles near it flash.)
    this.flashLight(x, y, z, 1.1 * big, 3 + 1.5 * big, 0.03);
  }

  explosion(x, y, z, size = 1) {
    const gy = this.world.hf.getHeight(x, z);
    this.spawn('flash', x, y + 0.3, z, { count: 1, scale: size });
    this.spawn('fireball', x, y + 0.4, z, { count: Math.round(5 * size), spread: 1.2, speed: 2.5, scale: Math.sqrt(size) });
    this.spawn('smoke', x, y + 0.5, z, { count: Math.round(8 * size), spread: 1.6, speed: 1.2, scale: size });
    this.spawn('dust', x, y + 0.2, z, { count: Math.round(12 * size), dir: [0, 0.6, 0], spread: 3, speed: 2, scale: size * 1.5 });
    // The burst throws up a fountain of earth: fast, narrow jets up the middle,
    // slower and wider at the sides, so it rises as a column rather than a ball.
    const k = Math.sqrt(size);
    for (let i = 0; i < 4; i++) {
      const f = 0.35 + (0.65 * i) / 3;
      this.spawn('column', x, y + 0.5, z, { count: Math.round(3 * size), dir: [0, 12 * k * f, 0], spread: 1.7 * (1.25 - f), speed: 1, scale: k * (1.3 - 0.45 * f) });
    }
    this.spawn('clods', x, y + 0.3, z, { count: Math.round(14 * size), dir: [0, 10 * k, 0], spread: 4, speed: 1.2, ground: gy, scale: k });
    this.spawn('debris', x, y + 0.2, z, { count: Math.round(30 * size), dir: [0, 6, 0], spread: 5, speed: 1.3, ground: gy });
    this.spawn('spark', x, y + 0.4, z, { count: Math.round(10 * size), dir: [0, 4, 0], spread: 6, speed: 1.5, ground: gy });
    // The flash of the burst: bright, but over in about a tenth of a second.
    this.flashLight(x, y + 1, z, 40 * size, 20 * size, 0.12);
  }

  flashLight(x, y, z, intensity, distance, time) {
    if (!this.lights.length) return;
    const l = this.lights[this.lightIndex];
    this.lightIndex = (this.lightIndex + 1) % this.lights.length;
    l.position.set(x, y, z);
    l.intensity = intensity;
    l.distance = distance;
    l.userData.t = time;
    l.userData.i0 = intensity;
    l.userData.t0 = time;
  }

  // --- projectiles in flight ---------------------------------------------------------
  _makeTracers() {
    this.tracers = this._makeStrips(0);
    this.bullets = this._makeStrips(1);
    this.tracerMesh = this.tracers.mesh;
  }

  // Instanced strips (see TRACER_VERT): kind 0 glows (added light), kind 1 is drawn over.
  _makeStrips(kind) {
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1, 1, 1);
    base.translate(0.5, 0, 0);
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    const st = {
      A: new Float32Array(MAX_TRACERS * 3),
      B: new Float32Array(MAX_TRACERS * 3),
      C: new Float32Array(MAX_TRACERS * 4),
      W: new Float32Array(MAX_TRACERS),
      n: 0,
    };
    st.attrs = [
      ['iA', st.A, 3],
      ['iB', st.B, 3],
      ['iColor', st.C, 4],
      ['iWidth', st.W, 1],
    ].map(([name, arr, k]) => {
      const a = new THREE.InstancedBufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    });
    geo.instanceCount = 0;
    const S = SHARED_UNIFORMS;
    const mat = new THREE.ShaderMaterial({
      vertexShader: TRACER_VERT,
      fragmentShader: TRACER_FRAG,
      uniforms: { tSkyCube: S.tSkyCube, uFog: S.uFog, uSunDir: S.uSunDir, uSunColor: S.uSunColor, uSkyScale: S.uSkyScale, uSunLight: S.uSunLight, uAmbient: S.uAmbient, uKind: { value: kind } },
      transparent: true,
      depthWrite: false,
      // Tracers: colour premultiplied by cover, drawn over (light added, and what's
      // behind partly hidden); bullets: ordinary see-through.
      blending: kind === 0 ? THREE.CustomBlending : THREE.NormalBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      side: THREE.DoubleSide,
    });
    st.mesh = new THREE.Mesh(geo, mat);
    st.mesh.frustumCulled = false;
    st.mesh.layers.set(LAYER_FX);
    st.mesh.renderOrder = kind === 0 ? 30 : 12;
    this.world.scene.add(st.mesh);
    return st;
  }

  // One projectile: from the tail (x, y, z) - dir * len to the head (x, y, z).
  _strip(st, x, y, z, ix, iy, iz, len, r, g, b, a, w) {
    if (st.n >= MAX_TRACERS) return;
    const n = st.n++;
    st.A[n * 3] = x - ix * len;
    st.A[n * 3 + 1] = y - iy * len;
    st.A[n * 3 + 2] = z - iz * len;
    st.B[n * 3] = x;
    st.B[n * 3 + 1] = y;
    st.B[n * 3 + 2] = z;
    st.C[n * 4] = r;
    st.C[n * 4 + 1] = g;
    st.C[n * 4 + 2] = b;
    st.C[n * 4 + 3] = a;
    st.W[n] = w;
  }

  // Draw what's in flight: tracer rounds as white-hot slugs with a tinted glow
  // and a short fading tail; a tank shell's tracer glowing at its base (the shell
  // itself is a model, projectileView.js); and, given trails (the camera
  // position and whose shots to leave out), ordinary bullets near the camera as
  // small copper bullets with a little blur, so you can see fire coming past.
  // Rockets and grenades are models (projectileView.js, thrownView.js).
  updateTracers(projectiles, colorFor, trails = null) {
    const T = this.tracers,
      Bu = this.bullets;
    T.n = 0;
    Bu.n = 0;
    for (const p of projectiles) {
      if (p.ammo.thrown || p.ammo.heat) continue;
      const sp = p.speed || 1;
      const ix = p.vx / sp,
        iy = p.vy / sp,
        iz = p.vz / sp;
      if (!p.tracer && !p.ammo.tracer) {
        if (!trails || p.owner === trails.skip || p.ammo.fragment) continue;
        const d = Math.hypot(p.x - trails.x, p.y - trails.y, p.z - trails.z);
        if (d > TRAIL_RANGE) continue;
        const len = Math.min(clamp(sp * 0.0014, 0.12, 1.4), p.distance);
        if (len < 0.05) continue;
        const a = Math.min(1, (TRAIL_RANGE - d) / 15);
        this._strip(Bu, p.x, p.y, p.z, ix, iy, iz, len, 0.78, 0.5, 0.26, a, Math.max(0.005, (p.ammo.diameter || 0.008) * 1.3));
        continue;
      }
      if (p.ammo.tracerBurn && p.distance > p.ammo.tracerBurn) continue; // burned out
      const c = colorFor(p);
      const fadeIn = Math.min(1, p.age * 30);
      if (p.weapon?.vehicle && p.ammo.diameter >= 0.02) {
        // A shell: the tracer burns in its base, half a shell length behind the middle.
        const back = p.ammo.diameter * 2.2;
        const len = Math.min(clamp(sp * 0.006, 1, 7), p.distance);
        this._strip(T, p.x - ix * back, p.y - iy * back, p.z - iz * back, ix, iy, iz, len, c[0] * 14, c[1] * 14, c[2] * 14, fadeIn, p.ammo.diameter * 0.5);
        continue;
      }
      const len = Math.min(clamp(sp * 0.005, 0.5, 6), p.distance);
      this._strip(T, p.x, p.y, p.z, ix, iy, iz, len, c[0] * 12, c[1] * 12, c[2] * 12, fadeIn, 0.034);
    }
    for (const st of [T, Bu]) {
      st.mesh.geometry.instanceCount = st.n;
      for (const a of st.attrs) a.needsUpdate = true;
    }
  }

  // --- bullet holes ------------------------------------------------------------------
  _makeDecals() {
    const tex = makeHoleTexture();
    this.decalMat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      roughness: 0.9,
      metalness: 0,
    });
    this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.decalMat, MAX_DECALS);
    this.decals.count = 0;
    this.decals.frustumCulled = false;
    this.decals.receiveShadow = true;
    this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.decals.setColorAt(0, new THREE.Color(1, 1, 1));
    this.decalIndex = 0;
    this.world.add(this.decals);
  }

  bulletHole(x, y, z, nx, ny, nz, size, tint) {
    const m = new THREE.Matrix4();
    const n = new THREE.Vector3(nx, ny, nz);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28));
    m.compose(new THREE.Vector3(x + nx * 0.004, y + ny * 0.004, z + nz * 0.004), q, new THREE.Vector3(size, size, size));
    const i = this.decalIndex;
    this.decals.setMatrixAt(i, m);
    this.decals.setColorAt(i, tint);
    this.decalIndex = (i + 1) % MAX_DECALS;
    this.decals.count = Math.max(this.decals.count, i + 1);
    this.decals.instanceMatrix.needsUpdate = true;
    if (this.decals.instanceColor) this.decals.instanceColor.needsUpdate = true;
  }

  // fogColor: no longer used (particles share the atmosphere of the world).
  update(dt, camPos) {
    this.camPos.copy(camPos);
    this.alpha.update(dt, camPos);
    this.add.update(dt, camPos);
    for (const l of this.lights) {
      if (l.userData.t > 0) {
        l.userData.t -= dt;
        l.intensity = Math.max(0, (l.userData.t / l.userData.t0) * l.userData.i0);
      } else l.intensity = 0;
    }
  }
}

function makeHoleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(10,8,6,1)');
  grad.addColorStop(0.18, 'rgba(20,16,12,1)');
  grad.addColorStop(0.3, 'rgba(70,60,50,0.85)');
  grad.addColorStop(0.6, 'rgba(120,110,95,0.35)');
  grad.addColorStop(1, 'rgba(120,110,95,0)');
  g.fillStyle = grad;
  g.beginPath();
  // Ragged outline.
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 26 + Math.random() * 6;
    const px = 32 + Math.cos(a) * r,
      py = 32 + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
