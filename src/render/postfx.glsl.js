// GLSL for the full-screen passes of the render pipeline (see pipeline.js).

export const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// View-space position from a depth-buffer value.
const VIEWPOS = /* glsl */ `
uniform mat4 uInvProj;
vec3 viewPos(vec2 uv, float d) {
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}`;

// The height fog and distance haze, shared by the atmosphere pass and every shader
// drawn after it (smoke, dust, sparks) so they sit in the same air.
//   uFog: ground density (1/m), falloff with height (1/m), base height (m), haze (1/m)
export const ATMOSPHERE_PARS = /* glsl */ `
uniform samplerCube tSkyCube;
uniform vec4 uFog;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSkyScale;
// Fraction of light that reaches the eye through the air between eye and p (x), and
// the color of the light the air adds on the way (yzw).
vec4 atmosphereAt(vec3 cam, vec3 p) {
  vec3 ray = p - cam;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-4);
  float b = uFog.y;
  float camH = cam.y - uFog.z;
  float by = b * ray.y;
  float k = abs(by) > 1e-4 ? (1.0 - exp(-by)) / by : 1.0;
  float optical = uFog.x * exp(-b * camH) * dist * k + uFog.w * dist;
  float trans = exp(-optical);
  // The air takes the color of the sky low over the horizon in the same direction
  // (so far hills melt into the sky), glowing toward the sun.
  vec3 hd = normalize(vec3(dir.x, max(dir.y, 0.0) * 0.4 + 0.035, dir.z));
  vec3 col = textureLod(tSkyCube, hd, 2.0).rgb * uSkyScale;
  float mu = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * (pow(mu, 8.0) * 0.05 + pow(mu, 48.0) * 0.08);
  return vec4(trans, col);
}
vec3 applyAtmosphere(vec3 c, vec3 cam, vec3 p) {
  vec4 a = atmosphereAt(cam, p);
  return c * a.x + a.yzw * (1.0 - a.x);
}`;

// Contact shadows (ambient occlusion) at half resolution from the depth buffer:
// samples in a disc around each pixel; nearby surfaces above the local tangent plane
// occlude it. The disc is turned by a 4x4 pattern that the blur pass averages out.
export const AO_FRAG = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uProj;
uniform vec2 uTexel;   // full-resolution texel
uniform vec4 uAO;      // radius (m), strength, max distance (m), rotation offset
varying vec2 vUv;
${VIEWPOS}
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float a = mod(q.x, 2.0), b = mod(q.y, 2.0);
  float c = floor(q.x * 0.5), d = floor(q.y * 0.5);
  return (8.0 * mod(a + b, 2.0) + 4.0 * b + 2.0 * mod(c + d, 2.0) + d) / 16.0;
}
void main() {
  float d = texture2D(tDepth, vUv).r;
  // (Depth is kept below the largest half-float value, 65504.)
  if (d >= 1.0) { gl_FragColor = vec4(1.0, 6e4, 0.0, 1.0); return; }
  vec3 P = viewPos(vUv, d);
  float z = -P.z;
  if (z > uAO.z) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }
  // Normal from the neighbors on the side with the smaller step (not across edges).
  vec2 ox = vec2(uTexel.x, 0.0), oy = vec2(0.0, uTexel.y);
  vec3 Pr = viewPos(vUv + ox, texture2D(tDepth, vUv + ox).r);
  vec3 Pl = viewPos(vUv - ox, texture2D(tDepth, vUv - ox).r);
  vec3 Pu = viewPos(vUv + oy, texture2D(tDepth, vUv + oy).r);
  vec3 Pd = viewPos(vUv - oy, texture2D(tDepth, vUv - oy).r);
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  float r = uAO.x * (1.0 + z * 0.012);
  vec2 rUv = vec2(uProj[0][0], uProj[1][1]) * 0.5 * r / z;
  rUv = min(rUv, vec2(0.12));
  float ang = bayer4(gl_FragCoord.xy) * 6.2831853 + uAO.w;
  float occ = 0.0;
  for (int i = 0; i < AO_SAMPLES; i++) {
    float fi = float(i);
    float t = (fi + 0.5) / float(AO_SAMPLES);
    float a = ang + fi * 2.3999632;
    vec2 suv = vUv + vec2(cos(a), sin(a)) * rUv * sqrt(t);
    vec3 S = viewPos(suv, texture2D(tDepth, suv).r);
    vec3 v = S - P;
    float vv = dot(v, v);
    float fall = max(0.0, 1.0 - vv / (r * r));
    occ += max(0.0, dot(v, N) * inversesqrt(vv + 1e-4) - 0.12) * fall;
  }
  float ao = clamp(1.0 - occ / float(AO_SAMPLES) * uAO.y * 1.6, 0.0, 1.0);
  gl_FragColor = vec4(ao, min(z, 6e4), 0.0, 1.0);
}`;

// 4x4 depth-aware blur of the half-resolution occlusion.
export const AO_BLUR_FRAG = /* glsl */ `
uniform sampler2D tAO;
uniform vec2 uTexel;   // half-resolution texel
varying vec2 vUv;
void main() {
  vec2 c = texture2D(tAO, vUv).rg;
  float sum = 0.0, wsum = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 s = texture2D(tAO, vUv + (vec2(float(x), float(y)) - 1.5) * uTexel).rg;
      float w = 1.0 / (1.0 + abs(s.g - c.g) / (0.03 * c.g + 0.05));
      sum += s.r * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, c.g, 0.0, 1.0);
}`;

// Contact shadows and atmosphere on the solid world. Also copies the depth, so the
// effects and the weapon drawn next are hidden behind walls.
export const ATMOS_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec4 uAOParams;  // strength, fade start, fade end, half-res texel x
uniform vec2 uAOTexel;   // half-resolution texel
uniform float uFar;      // view distance
varying vec2 vUv;
${VIEWPOS}
${ATMOSPHERE_PARS}
// Joint bilateral upsampling: the four nearest half-resolution samples, weighted by
// how close their depth is to this pixel's.
float aoAt(vec2 uv, float z) {
  vec2 st = uv / uAOTexel - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  float sum = 0.0, wsum = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 o = vec2(float(k - (k / 2) * 2), float(k / 2));
    vec2 s = texture2D(tAO, (i + o + 0.5) * uAOTexel).rg;
    vec2 bw = mix(1.0 - f, f, o);
    float w = bw.x * bw.y / (1e-3 + abs(s.g - z) / (0.02 * z + 0.05));
    sum += s.r * w;
    wsum += w;
  }
  return wsum > 0.0 ? sum / wsum : 1.0;
}
void main() {
  vec4 col = texture2D(tColor, vUv);
  float d = texture2D(tDepth, vUv).r;
  gl_FragDepth = d;
  if (d >= 1.0) {
    // Sky: it has its own haze.
    gl_FragColor = col;
    return;
  }
  vec3 P = viewPos(vUv, d);
  float z = -P.z;
  if (uAOParams.x > 0.0 && z < uAOParams.z) {
    float ao = aoAt(vUv, z);
    if (!(ao >= 0.0 && ao <= 1.0)) ao = 1.0; // never let a bad sample blacken the picture
    col.rgb *= mix(1.0, ao, uAOParams.x * (1.0 - smoothstep(uAOParams.y, uAOParams.z, z)));
  }
  vec3 W = (uCamWorld * vec4(P, 1.0)).xyz;
  col.rgb = applyAtmosphere(col.rgb, uCamPos, W);
  // Near the end of the view distance the land fades into the sky behind it, so
  // the cut-off never shows.
  vec3 ray = W - uCamPos;
  float dist = length(ray);
  float farFade = smoothstep(uFar * 0.7, uFar * 0.97, dist);
  if (farFade > 0.0) col.rgb = mix(col.rgb, textureLod(tSkyCube, ray / dist, 1.0).rgb * uSkyScale, farFade);
  gl_FragColor = col;
}`;

// Temporal anti-aliasing: the camera is shifted by a different fraction of a pixel
// every frame, and each pixel is blended with where it was in the previous frames
// (found from the depth and the previous camera). The previous color is limited to
// the range of colors around the pixel now, so moving things don't leave trails.
export const TAA_FRAG = /* glsl */ `
uniform sampler2D tCurrent;
uniform sampler2D tHistory;
uniform sampler2D tDepth;
uniform mat4 uCamWorld;
uniform mat4 uPrevViewProj;
uniform vec3 uCamPos;
uniform vec2 uTexel;
uniform float uReset;
varying vec2 vUv;
${VIEWPOS}
vec3 toYCoCg(vec3 c) { return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
vec3 fromYCoCg(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
// Compress bright values so a single bright pixel can't dominate (tone-mapped blend).
vec3 tm(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
vec3 itm(vec3 c) { return c / max(1e-4, 1.0 - max(c.r, max(c.g, c.b))); }
// Catmull-Rom history sample with 5 bilinear taps (keeps the image sharp).
vec3 historyAt(vec2 uv) {
  vec2 res = 1.0 / uTexel;
  vec2 p = uv * res;
  vec2 c = floor(p - 0.5) + 0.5;
  vec2 f = p - c;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (c - 1.0) * uTexel, t3 = (c + 2.0) * uTexel;
  vec2 t12 = (c + w2 / w12) * uTexel;
  vec3 r = texture2D(tHistory, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y)
         + texture2D(tHistory, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y)
         + texture2D(tHistory, t12).rgb * (w12.x * w12.y)
         + texture2D(tHistory, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
         + texture2D(tHistory, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
  float wsum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / wsum, 0.0);
}
void main() {
  vec3 cur = texture2D(tCurrent, vUv).rgb;
  // Neighborhood statistics (in tone-mapped YCoCg) and the nearest depth around.
  vec3 m1 = vec3(0.0), m2 = vec3(0.0);
  vec3 mn = vec3(1e9), mx = vec3(-1e9);
  float dmin = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y)) * uTexel;
      vec3 s = toYCoCg(tm(texture2D(tCurrent, vUv + o).rgb));
      m1 += s;
      m2 += s * s;
      mn = min(mn, s);
      mx = max(mx, s);
      dmin = min(dmin, texture2D(tDepth, vUv + o).r);
    }
  }
  m1 /= 9.0;
  vec3 sigma = sqrt(max(m2 / 9.0 - m1 * m1, 0.0));
  // Where was this point in the previous frame?
  vec2 prevUv;
  if (dmin >= 1.0) {
    vec3 dir = (uCamWorld * vec4(viewPos(vUv, 1.0), 0.0)).xyz;
    vec4 pc = uPrevViewProj * vec4(dir, 0.0);
    prevUv = pc.xy / pc.w * 0.5 + 0.5;
  } else {
    vec3 W = (uCamWorld * vec4(viewPos(vUv, dmin), 1.0)).xyz;
    vec4 pc = uPrevViewProj * vec4(W, 1.0);
    prevUv = pc.xy / pc.w * 0.5 + 0.5;
  }
  vec3 c = toYCoCg(tm(cur));
  if (uReset > 0.5 || prevUv.x < 0.0 || prevUv.y < 0.0 || prevUv.x > 1.0 || prevUv.y > 1.0) {
    gl_FragColor = vec4(cur, 1.0);
    return;
  }
  vec3 h = toYCoCg(tm(historyAt(prevUv)));
  // Clip the history toward the neighborhood mean, inside mean +- 1.25 sigma.
  vec3 lo = max(mn, m1 - 1.25 * sigma), hi = min(mx, m1 + 1.25 * sigma);
  vec3 center = 0.5 * (lo + hi), ext = max(0.5 * (hi - lo), vec3(1e-4));
  vec3 v = h - center;
  vec3 a = abs(v / ext);
  float ma = max(a.x, max(a.y, a.z));
  if (ma > 1.0) h = center + v / ma;
  // Blend: mostly history; more of the new frame where the image moves fast.
  vec2 vel = (vUv - prevUv) / uTexel;
  float w = mix(0.08, 0.3, clamp(length(vel) / 12.0, 0.0, 1.0));
  vec3 res = mix(h, c, w);
  gl_FragColor = vec4(itm(fromYCoCg(res)), 1.0);
}`;

export const COPY_FRAG = /* glsl */ `
uniform sampler2D tColor;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(tColor, vUv); }`;

// Camera motion blur: each pixel is smeared along the path it moved on the screen
// since the last frame (from the depth and the previous camera), half a frame long.
export const MOTION_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform mat4 uCamWorld;
uniform mat4 uPrevViewProj;
uniform vec2 uTexel;
uniform float uAmount;
varying vec2 vUv;
${VIEWPOS}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  float d = texture2D(tDepth, vUv).r;
  vec4 pc;
  if (d >= 1.0) pc = uPrevViewProj * vec4((uCamWorld * vec4(viewPos(vUv, 1.0), 0.0)).xyz, 0.0);
  else pc = uPrevViewProj * vec4((uCamWorld * vec4(viewPos(vUv, d), 1.0)).xyz, 1.0);
  vec2 prevUv = pc.xy / pc.w * 0.5 + 0.5;
  vec2 vel = (vUv - prevUv) * uAmount;
  float len = length(vel / uTexel);
  vec4 c = texture2D(tColor, vUv);
  if (len < 1.0 || pc.w <= 0.0) { gl_FragColor = c; return; }
  vel *= min(1.0, 40.0 / len);
  vec3 acc = c.rgb;
  float j = ign(gl_FragCoord.xy) - 0.5;
  for (int i = 0; i < 8; i++) {
    float t = (float(i) + 0.5 + j) / 8.0 - 0.5;
    acc += texture2D(tColor, vUv - vel * t).rgb;
  }
  gl_FragColor = vec4(acc / 9.0, c.a);
}`;

// Focus when aiming: the weapon layer (drawn on its own with alpha) is blurred where
// it is nearer than the front sight, then laid over the world. The focus distance is
// read from the weapon's depth at the center of the screen, where the sights are.
export const DOF_FRAG = /* glsl */ `
uniform sampler2D tColor;    // world
uniform sampler2D tLayer;    // weapon layer, premultiplied
uniform sampler2D tLayerDepth;
uniform vec2 uNearFar;       // weapon camera
uniform vec2 uTexel;
uniform float uAmount;       // 0..1 (aiming)
uniform float uMaxBlur;      // pixels
varying vec2 vUv;
float linZ(float d) {
  float zn = d * 2.0 - 1.0;
  return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - zn * (uNearFar.y - uNearFar.x));
}
float focusZ() {
  float f = 0.0, n = 0.0;
  for (int i = 0; i < 5; i++) {
    float d = texture2D(tLayerDepth, vec2(0.5, 0.5 - float(i) * 0.012)).r;
    if (d < 1.0) { f += linZ(d); n += 1.0; }
  }
  return n > 0.0 ? f / n : 0.7;
}
float blurAt(vec2 uv, float fz) {
  float d = texture2D(tLayerDepth, uv).r;
  if (d >= 1.0) return 0.0;
  float z = linZ(d);
  // Defocus grows with the difference in diopters from the focus distance (for a
  // 3 mm pupil: a rear peep sight 8 cm from the eye blurs into a soft ring).
  return clamp((1.0 / z - 1.0 / fz) * 0.14, 0.0, 1.0) * uMaxBlur * uAmount;
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec4 world = texture2D(tColor, vUv);
  vec4 layer = texture2D(tLayer, vUv);
  float fz = focusZ();
  // Largest blur nearby (a blurred edge spreads over the world behind it).
  float r = blurAt(vUv, fz);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    r = max(r, blurAt(vUv + vec2(cos(a), sin(a)) * uTexel * uMaxBlur * uAmount, fz) * 0.85);
  }
  if (r > 0.6) {
    vec4 acc = layer;
    float wsum = 1.0;
    float rot = ign(gl_FragCoord.xy) * 6.2831853;
    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      float t = sqrt((fi + 0.5) / 32.0);
      float a = fi * 2.3999632 + rot;
      vec2 o = vec2(cos(a), sin(a)) * t * r;
      vec2 suv = vUv + o * uTexel;
      vec4 s = texture2D(tLayer, suv);
      float sr = blurAt(suv, fz);
      // Empty samples count fully (the edge fades); weapon samples only when their
      // own blur reaches this far.
      float w = s.a < 0.01 ? 1.0 : smoothstep(t * r - 1.5, t * r, max(sr, 1.0));
      acc += s * w;
      wsum += w;
    }
    layer = acc / wsum;
  }
  gl_FragColor = vec4(world.rgb * (1.0 - layer.a) + layer.rgb, 1.0);
}`;

// Bloom: a chain of downsampled copies (13-tap filter) and a tent-filtered way back
// up; the grade pass mixes a small part of the result into the image.
export const BLOOM_DOWN_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uTexel;   // source texel
uniform float uClamp;  // brightest value let in (the sun disc would flood the frame)
varying vec2 vUv;
vec3 s(vec2 o) {
  vec3 c = texture2D(tColor, vUv + o * uTexel).rgb;
  // (A stray invalid pixel must not spread over the screen.)
  return c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0 ? min(c, vec3(uClamp)) : vec3(0.0);
}
void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(r, 1.0);
}`;

export const BLOOM_UP_FRAG = /* glsl */ `
uniform sampler2D tColor;   // smaller level (being added)
uniform sampler2D tBase;    // this level's downsampled image
uniform vec2 uTexel;        // smaller level's texel
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * uRadius;
  vec3 r = texture2D(tColor, vUv).rgb * 4.0;
  r += (texture2D(tColor, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tColor, vUv + vec2(o.x, 0.0)).rgb + texture2D(tColor, vUv + vec2(0.0, -o.y)).rgb + texture2D(tColor, vUv + vec2(0.0, o.y)).rgb) * 2.0;
  r += texture2D(tColor, vUv - o).rgb + texture2D(tColor, vUv + o).rgb + texture2D(tColor, vUv + vec2(-o.x, o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, -o.y)).rgb;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + r / 16.0, 1.0);
}`;

// Sun rays: bright sky near the sun (where nothing blocks it) smeared toward the sun.
export const SHAFT_MASK_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uSun;        // sun position on screen (uv)
uniform float uAspect;
varying vec2 vUv;
void main() {
  float d = texture2D(tDepth, vUv).r;
  float sky = step(1.0, d);
  vec2 dv = (vUv - uSun) * vec2(uAspect, 1.0);
  float fall = exp(-dot(dv, dv) * 9.0);
  float lum = dot(texture2D(tColor, vUv).rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(sky * fall * min(lum, 4.0), 0.0, 0.0, 1.0);
}`;

export const SHAFT_BLUR_FRAG = /* glsl */ `
uniform sampler2D tMask;
uniform vec2 uSun;
uniform float uStep;      // fraction of the way to the sun per pass
varying vec2 vUv;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 dv = (uSun - vUv) * uStep / 24.0;
  vec2 uv = vUv + dv * ign(gl_FragCoord.xy);
  float acc = 0.0, w = 1.0, wsum = 0.0;
  for (int i = 0; i < 24; i++) {
    acc += texture2D(tMask, uv).r * w;
    wsum += w;
    w *= 0.96;
    uv += dv;
  }
  gl_FragColor = vec4(acc / wsum, 0.0, 0.0, 1.0);
}`;

// Average brightness of the view (for the eye adapting to dark interiors and bright
// skies): log luminance, weighted toward the center of the screen.
export const LUM_FRAG = /* glsl */ `
uniform sampler2D tColor;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec2 q = vUv - 0.5;
  float w = 1.0 - smoothstep(0.1, 0.75, length(q * vec2(1.4, 1.0)));
  w = 0.25 + w;
  gl_FragColor = vec4(log2(max(l, 1e-4)) * w, w, 0.0, 1.0);
}`;

export const ADAPT_FRAG = /* glsl */ `
uniform sampler2D tLum;     // weighted log luminance, 64 x 32
uniform sampler2D tPrev;    // previous adapted value (1 x 1)
uniform vec2 uRate;         // adaptation toward brighter / darker this frame (0..1)
uniform float uReset;
varying vec2 vUv;
void main() {
  // Each bilinear tap between four texels averages them: 16 x 8 taps cover 64 x 32.
  vec2 s = vec2(0.0);
  for (int y = 0; y < 8; y++)
    for (int x = 0; x < 16; x++) s += texture2D(tLum, (vec2(float(x), float(y)) * 2.0 + 1.0) / vec2(32.0, 16.0) * 0.5).rg;
  float now = s.x / max(s.y, 1e-4);
  float prev = texture2D(tPrev, vec2(0.5)).r;
  float k = now > prev ? uRate.x : uRate.y;
  gl_FragColor = vec4(uReset > 0.5 ? now : mix(prev, now, k), 0.0, 0.0, 1.0);
}`;

// Exposure, tone mapping and a film-like grade, then vignette and grain.
export const GRADE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform sampler2D tShafts;
uniform sampler2D tAdapt;
uniform float uTime;
uniform float uExposure;
uniform vec4 uAdaptRange;    // key (log2), min, max (stops), strength
uniform vec2 uBloom;        // weight of the bloom image, weight kept of the original
uniform vec3 uShaftColor;
uniform float uVignette;
uniform float uGrain;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uBlack;
uniform float uAberration;
uniform float uDamage;   // red tint and darkening when hurt
uniform float uBlur;     // tunnel blur when exhausted/bleeding
uniform float uFlash;    // white flash from nearby explosions
varying vec2 vUv;

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

// ACES filmic curve (Stephen Hill's fit of the RRT and ODT): a soft toe, a long
// shoulder, and very bright colors bleach toward white the way film does.
vec3 aces(vec3 c) {
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  vec3 v = inM * c;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(outM * (a / b), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
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
  if (uBloom.x > 0.0) hdr = hdr * uBloom.y + texture2D(tBloom, uv).rgb * uBloom.x;
  hdr += uShaftColor * texture2D(tShafts, uv).r;
  if (!(hdr.r + hdr.g + hdr.b >= 0.0)) hdr = vec3(0.0);
  // Exposure: a fixed base, adjusted toward the brightness the eye has adapted to.
  float adapted = texture2D(tAdapt, vec2(0.5)).r;
  float ev = clamp((uAdaptRange.x - adapted) * uAdaptRange.w, uAdaptRange.y, uAdaptRange.z);
  hdr *= uExposure * exp2(ev);
  hdr += uFlash;
  vec3 col = aces(hdr);
  col = toSRGB(col);
  // Grade in display space: split toning, contrast around mid grey, saturation.
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(uShadowTint, uHighlightTint, smoothstep(0.05, 0.75, l));
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
  l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  col = uBlack + col * (1.0 - uBlack);
  // Damage: desaturate and redden the edges.
  if (uDamage > 0.0) {
    float edge = smoothstep(0.08, 0.5, r2);
    col = mix(col, vec3(l) * vec3(0.9, 0.3, 0.25), uDamage * edge * 0.8);
    col *= 1.0 - uDamage * 0.25;
  }
  col *= 1.0 - uVignette * smoothstep(0.12, 0.7, r2);
  // Grain, stronger in the mid-tones like film.
  float g = rand(uv * 731.0 + fract(uTime) * 91.0) - 0.5;
  col += g * uGrain * (0.4 + 2.4 * l * (1.0 - l));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// Light sharpening (contrast adaptive) while scaling the image to the screen.
export const SHARPEN_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uTexel;       // source texel
uniform float uSharpness;  // 0..1
varying vec2 vUv;
void main() {
  vec3 b = texture2D(tColor, vUv + vec2(0.0, -uTexel.y)).rgb;
  vec3 d = texture2D(tColor, vUv + vec2(-uTexel.x, 0.0)).rgb;
  vec3 e = texture2D(tColor, vUv).rgb;
  vec3 f = texture2D(tColor, vUv + vec2(uTexel.x, 0.0)).rgb;
  vec3 h = texture2D(tColor, vUv + vec2(0.0, uTexel.y)).rgb;
  vec3 mn = min(min(min(d, e), min(f, b)), h);
  vec3 mx = max(max(max(d, e), max(f, b)), h);
  vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
  vec3 w = -amp / mix(8.0, 5.0, uSharpness);
  vec3 r = (e + (b + d + f + h) * w) / (1.0 + 4.0 * w);
  gl_FragColor = vec4(clamp(r, 0.0, 1.0), 1.0);
}`;
