// GLSL source for procedurally painted, seamlessly tiling surface textures.
// Each material is a function `surface(uv, ...)` that returns color, roughness,
// height (in meters) and metalness. The baker renders them into textures once at
// load time, including normal maps derived from the height.

export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
// Periodic gradient noise. p in lattice units, per = period (integer lattice cells).
float gnoise(vec2 p, vec2 per, float seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 s = vec2(seed * 17.0, seed * 59.0);
  vec2 g00 = hash22(mod(i, per) + s) * 2.0 - 1.0;
  vec2 g10 = hash22(mod(i + vec2(1.0, 0.0), per) + s) * 2.0 - 1.0;
  vec2 g01 = hash22(mod(i + vec2(0.0, 1.0), per) + s) * 2.0 - 1.0;
  vec2 g11 = hash22(mod(i + vec2(1.0, 1.0), per) + s) * 2.0 - 1.0;
  float a = dot(g00, f);
  float b = dot(g10, f - vec2(1.0, 0.0));
  float c = dot(g01, f - vec2(0.0, 1.0));
  float d = dot(g11, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4;
}
// Periodic value noise, 0..1
float vnoise(vec2 p, vec2 per, float seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 s = vec2(seed * 13.0, seed * 7.0);
  float a = hash12(mod(i, per) + s);
  float b = hash12(mod(i + vec2(1.0, 0.0), per) + s);
  float c = hash12(mod(i + vec2(0.0, 1.0), per) + s);
  float d = hash12(mod(i + vec2(1.0, 1.0), per) + s);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Fractal noise on the unit square that tiles. freq must be an integer (or vec2 of integers).
float fbm(vec2 uv, vec2 freq, int oct, float seed) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  vec2 f = freq;
  for (int i = 0; i < 9; i++) {
    if (i >= oct) break;
    sum += amp * gnoise(uv * f, f, seed + float(i) * 3.1);
    norm += amp;
    amp *= 0.5;
    f *= 2.0;
  }
  return sum / norm; // about -1..1
}
float fbm01(vec2 uv, vec2 freq, int oct, float seed) { return fbm(uv, freq, oct, seed) * 0.5 + 0.5; }
float ridged(vec2 uv, vec2 freq, int oct, float seed) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  vec2 f = freq;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(gnoise(uv * f, f, seed + float(i) * 5.7));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    f *= 2.0;
  }
  return sum / norm;
}
// Periodic Voronoi. Returns (F1, F2, cell id 0..1). jitter 0..1.
vec3 voronoi(vec2 uv, vec2 freq, float jitter, float seed) {
  vec2 p = uv * freq;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float F1 = 8.0, F2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = mod(i + g, freq);
      vec2 o = 0.5 + (hash22(cell + seed * 11.0) - 0.5) * jitter;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < F1) { F2 = F1; F1 = d; id = hash12(cell + seed * 3.0 + 7.0); }
      else if (d < F2) { F2 = d; }
    }
  }
  return vec3(sqrt(F1), sqrt(F2), id);
}
// Voronoi variant that also returns the vector to the cell center (for rounded stones).
vec4 voronoiVec(vec2 uv, vec2 freq, float jitter, float seed) {
  vec2 p = uv * freq;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float F1 = 8.0, id = 0.0;
  vec2 best = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = mod(i + g, freq);
      vec2 o = 0.5 + (hash22(cell + seed * 11.0) - 0.5) * jitter;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < F1) { F1 = d; id = hash12(cell + seed * 3.0 + 7.0); best = r; }
    }
  }
  // Distance to the nearest cell border (Inigo Quilez method).
  float border = 8.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = mod(i + g, freq);
      vec2 o = 0.5 + (hash22(cell + seed * 11.0) - 0.5) * jitter;
      vec2 r = g + o - f;
      if (dot(best - r, best - r) > 0.00001)
        border = min(border, dot(0.5 * (best + r), normalize(r - best)));
    }
  }
  return vec4(best, border, id);
}
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); } // author colors in sRGB, convert to linear
`;

// Every material function has this signature:
//   void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha)
// height is in meters; the texture covers uWorld meters.
export const MATERIALS = {
  grass: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float big = fbm01(uv, vec2(3.0), 4, 1.0);
      float patchy = fbm01(uv, vec2(7.0), 3, 2.0);
      // Thin blade streaks in random directions: layered stretched noise.
      float blades = 0.0;
      for (int k = 0; k < 4; k++) {
        float fk = float(k);
        vec2 dir = normalize(hash22(vec2(fk, 3.0)) - 0.5);
        mat2 R = mat2(dir.x, -dir.y, dir.y, dir.x);
        vec2 q = uv;
        blades += vnoise(uv * vec2(160.0, 160.0) + vec2(fk * 31.0), vec2(160.0), 4.0 + fk) * 0.25;
      }
      float fine = fbm01(uv, vec2(48.0), 3, 5.0);
      float clover = smoothstep(0.62, 0.7, fbm01(uv, vec2(10.0), 3, 9.0));
      vec3 green = srgb(vec3(0.27, 0.36, 0.12));
      vec3 yellow = srgb(vec3(0.45, 0.43, 0.2));
      vec3 dark = srgb(vec3(0.13, 0.19, 0.07));
      vec3 soil = srgb(vec3(0.27, 0.21, 0.14));
      albedo = mix(green, yellow, smoothstep(0.3, 0.8, big) * 0.25);
      albedo = mix(albedo, dark, (1.0 - blades) * 0.55);
      albedo *= 0.8 + 0.4 * fine;
      albedo = mix(albedo, srgb(vec3(0.2, 0.33, 0.1)), clover * 0.5);
      float bare = smoothstep(0.72, 0.82, patchy) * (1.0 - blades);
      albedo = mix(albedo, soil, bare * 0.7);
      rough = 0.82 + 0.1 * fine;
      height = blades * 0.025 + fine * 0.01 - bare * 0.01;
      metal = 0.0;
      alpha = 1.0;
    }`,
  dryGrass: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float big = fbm01(uv, vec2(3.0), 4, 11.0);
      float blades = vnoise(uv * vec2(220.0, 90.0), vec2(220.0, 90.0), 3.0) * 0.6 + vnoise(uv * vec2(90.0, 220.0), vec2(90.0, 220.0), 4.0) * 0.4;
      float fine = fbm01(uv, vec2(40.0), 3, 12.0);
      vec3 straw = srgb(vec3(0.55, 0.48, 0.28));
      vec3 olive = srgb(vec3(0.36, 0.37, 0.17));
      vec3 dark = srgb(vec3(0.22, 0.2, 0.11));
      albedo = mix(olive, straw, 0.55 + 0.25 * (big - 0.5));
      albedo = mix(dark, albedo, 0.45 + 0.55 * blades);
      albedo *= 0.85 + 0.3 * fine;
      rough = 0.88;
      height = blades * 0.02 + fine * 0.008;
      metal = 0.0;
      alpha = 1.0;
    }`,
  dirt: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float base = fbm01(uv, vec2(4.0), 5, 21.0);
      float fine = fbm01(uv, vec2(32.0), 4, 22.0);
      // Small stones, a few centimeters across. They sit low: where dirt meets
      // grass the highest points of each texture win, and tall stones would
      // show through the grass as pale flakes.
      vec4 peb = voronoiVec(uv, vec2(40.0), 0.9, 23.0);
      float pebMask = step(0.87, peb.w) * smoothstep(0.0, 0.08, peb.z);
      float pebH = sqrt(max(0.0, 1.0 - dot(peb.xy, peb.xy) * 2.2)) * pebMask;
      vec3 c1 = srgb(vec3(0.36, 0.28, 0.2));
      vec3 c2 = srgb(vec3(0.26, 0.2, 0.14));
      albedo = mix(c2, c1, 0.5 + 0.4 * (base - 0.5)) * (0.85 + 0.3 * fine);
      vec3 stone = srgb(mix(vec3(0.34, 0.31, 0.27), vec3(0.45, 0.41, 0.35), hash12(vec2(peb.w * 91.0))));
      albedo = mix(albedo, stone * 0.75, pebMask * smoothstep(0.0, 0.3, pebH) * 0.45);
      rough = 0.9 - pebMask * 0.06;
      height = base * 0.03 + fine * 0.01 + pebH * 0.005;
      metal = 0.0;
      alpha = 1.0;
    }`,
  mud: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float base = fbm01(uv, vec2(3.0), 5, 31.0);
      float ruts = fbm01(uv * vec2(1.0, 4.0), vec2(2.0, 8.0), 4, 32.0);
      float fine = fbm01(uv, vec2(36.0), 3, 33.0);
      float h = base * 0.06 + ruts * 0.04 + fine * 0.006;
      // A few puddles in the deepest spots; small mirror-like ones would
      // sparkle as white specks from a distance.
      float puddle = smoothstep(0.31, 0.26, base * 0.7 + ruts * 0.3);
      vec3 wet = srgb(vec3(0.2, 0.15, 0.1));
      vec3 dryer = srgb(vec3(0.3, 0.23, 0.16));
      albedo = mix(wet, dryer, smoothstep(0.45, 0.8, base) * 0.8) * (0.85 + 0.3 * fine);
      albedo = mix(albedo, srgb(vec3(0.1, 0.09, 0.07)), puddle * 0.7);
      rough = mix(0.62 - 0.15 * (1.0 - base), 0.2, puddle);
      height = mix(h, 0.035, puddle * 0.9);
      metal = 0.0;
      alpha = 1.0;
    }`,
  rock: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float r = ridged(uv, vec2(3.0), 6, 41.0);
      float base = fbm01(uv, vec2(5.0), 5, 42.0);
      vec3 cr = voronoi(uv, vec2(6.0), 1.0, 43.0);
      float crack = 1.0 - smoothstep(0.0, 0.05, cr.y - cr.x);
      float lichen = smoothstep(0.6, 0.72, fbm01(uv, vec2(9.0), 4, 44.0));
      vec3 g1 = srgb(vec3(0.45, 0.44, 0.41));
      vec3 g2 = srgb(vec3(0.3, 0.29, 0.27));
      albedo = mix(g2, g1, base) * (0.75 + 0.4 * r);
      albedo = mix(albedo, srgb(vec3(0.42, 0.45, 0.28)), lichen * 0.6);
      albedo *= 1.0 - crack * 0.5;
      rough = 0.78 + 0.15 * (1.0 - r);
      height = r * 0.12 + base * 0.05 - crack * 0.03;
      metal = 0.0;
      alpha = 1.0;
    }`,
  plowed: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float wob = fbm(uv, vec2(2.0), 3, 51.0) * 0.08;
      float furrow = sin((uv.x + wob) * 6.2831853 * 6.0) * 0.5 + 0.5; // 6 furrows across the tile
      float clods = voronoi(uv, vec2(40.0), 1.0, 52.0).x;
      float fine = fbm01(uv, vec2(30.0), 4, 53.0);
      float stubble = step(0.93, vnoise(uv * vec2(260.0, 60.0), vec2(260.0, 60.0), 54.0));
      vec3 c1 = srgb(vec3(0.3, 0.22, 0.15));
      vec3 c2 = srgb(vec3(0.2, 0.15, 0.1));
      albedo = mix(c2, c1, furrow * 0.7 + fine * 0.3);
      albedo = mix(albedo, srgb(vec3(0.4, 0.35, 0.25)), stubble * 0.35);
      rough = 0.92;
      height = furrow * 0.09 + (1.0 - clods) * 0.02 + fine * 0.01;
      metal = 0.0;
      alpha = 1.0;
    }`,
  cobble: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec4 v = voronoiVec(uv, vec2(10.0, 12.0), 0.75, 61.0);
      float edge = smoothstep(0.0, 0.12, v.z);
      float dome = sqrt(max(0.0, 1.0 - dot(v.xy, v.xy) * 1.6));
      float fine = fbm01(uv, vec2(64.0), 3, 62.0);
      vec3 stone = srgb(mix(vec3(0.42, 0.4, 0.37), vec3(0.58, 0.55, 0.5), v.w));
      stone *= 0.8 + 0.35 * fine;
      vec3 grout = srgb(vec3(0.22, 0.19, 0.15));
      albedo = mix(grout, stone, edge);
      rough = mix(0.95, 0.55 + 0.2 * fine, edge);
      height = edge * (0.02 + dome * 0.03) + fine * 0.003;
      metal = 0.0;
      alpha = 1.0;
    }`,
  forest: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      // Summer woodland floor: dark humus, last year's leaves gone brown and
      // grey, and patches of moss.
      vec3 soil = srgb(vec3(0.17, 0.13, 0.09));
      albedo = soil * (0.8 + 0.4 * fbm01(uv, vec2(8.0), 4, 71.0));
      height = 0.0;
      // Several layers of fallen leaves.
      for (int k = 0; k < 4; k++) {
        float fk = float(k);
        vec4 v = voronoiVec(uv + vec2(fk * 0.37, fk * 0.71), vec2(26.0 + fk * 6.0), 1.0, 72.0 + fk);
        float ang = v.w * 6.2831;
        vec2 d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * v.xy;
        float leaf = 1.0 - smoothstep(0.24, 0.3, length(d * vec2(1.0, 2.2)));
        vec3 lc = srgb(mix(vec3(0.27, 0.19, 0.12), vec3(0.38, 0.29, 0.18), hash12(vec2(v.w * 37.0))));
        lc = mix(lc, srgb(vec3(0.24, 0.2, 0.16)), hash12(vec2(v.w * 13.0)) * 0.6);
        float present = step(0.45, hash12(vec2(v.w * 71.0, fk)));
        albedo = mix(albedo, lc, leaf * present);
        height = max(height, leaf * present * (0.006 + fk * 0.003));
      }
      float moss = smoothstep(0.5, 0.75, fbm01(uv, vec2(3.0), 4, 78.0));
      albedo = mix(albedo, srgb(vec3(0.17, 0.21, 0.08)) * (0.8 + 0.4 * fbm01(uv, vec2(40.0), 2, 77.0)), moss * 0.7);
      float twig = smoothstep(0.985, 1.0, sin((uv.x * 0.6 + uv.y) * 140.0 + fbm(uv, vec2(6.0), 3, 79.0) * 30.0)) * step(0.65, fbm01(uv, vec2(5.0), 2, 80.0));
      albedo = mix(albedo, srgb(vec3(0.3, 0.22, 0.14)), twig);
      rough = 0.85;
      height += twig * 0.01;
      metal = 0.0;
      alpha = 1.0;
    }`,
  sand: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float ripple = sin((uv.y + fbm(uv, vec2(3.0), 3, 91.0) * 0.1) * 6.2831853 * 18.0) * 0.5 + 0.5;
      float fine = fbm01(uv, vec2(80.0), 3, 92.0);
      float base = fbm01(uv, vec2(4.0), 4, 93.0);
      // Riverbank sand and silt: grey-brown, darker where damp.
      albedo = mix(srgb(vec3(0.36, 0.33, 0.27)), srgb(vec3(0.46, 0.42, 0.34)), 0.5 + 0.3 * (base - 0.5)) * (0.9 + 0.2 * fine);
      rough = 0.9;
      height = ripple * 0.006 + fine * 0.002 + base * 0.02;
      metal = 0.0;
      alpha = 1.0;
    }`,
  roadDirt: /* glsl */ `
    // u runs across the road (0..1), v runs along it.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float across = uv.x;
      float wob = fbm(vec2(0.0, uv.y) + vec2(0.3, 0.0), vec2(1.0, 4.0), 3, 101.0) * 0.03;
      float rutL = exp(-pow((across - 0.27 - wob) / 0.06, 2.0));
      float rutR = exp(-pow((across - 0.73 - wob) / 0.06, 2.0));
      float ruts = rutL + rutR;
      float crown = 1.0 - pow(abs(across - 0.5) * 2.0, 2.0);
      float base = fbm01(uv, vec2(4.0, 8.0), 5, 102.0);
      float fine = fbm01(uv, vec2(40.0, 80.0), 3, 103.0);
      // Packed earth with a light scatter of gravel (not a paved surface).
      vec4 peb = voronoiVec(uv, vec2(30.0, 60.0), 0.9, 104.0);
      float pebMask = step(0.86, peb.w) * smoothstep(0.0, 0.1, peb.z) * (0.4 + 0.6 * ruts);
      float puddle = smoothstep(0.62, 0.7, base) * ruts;
      float grassMid = smoothstep(0.75, 0.95, 1.0 - abs(across - 0.5) * 6.0) * smoothstep(0.35, 0.6, fbm01(uv, vec2(3.0, 12.0), 3, 105.0));
      vec3 c1 = srgb(vec3(0.48, 0.4, 0.3));
      vec3 c2 = srgb(vec3(0.34, 0.27, 0.19));
      albedo = mix(c1, c2, ruts * 0.6 + base * 0.3) * (0.85 + 0.3 * fine);
      albedo = mix(albedo, srgb(vec3(0.46, 0.43, 0.38)), pebMask * 0.4);
      albedo = mix(albedo, srgb(vec3(0.3, 0.33, 0.15)), grassMid * 0.8);
      albedo = mix(albedo, srgb(vec3(0.18, 0.15, 0.12)), puddle * 0.8);
      rough = mix(0.88, 0.1, puddle);
      height = crown * 0.04 - ruts * 0.05 + base * 0.02 + fine * 0.005 + pebMask * 0.004;
      metal = 0.0;
      // Soft, irregular road edges.
      float edgeNoise = fbm(vec2(across * 0.2, uv.y), vec2(1.0, 16.0), 3, 106.0) * 0.06;
      alpha = smoothstep(0.0, 0.1, across + edgeNoise) * smoothstep(1.0, 0.9, across - edgeNoise);
    }`,
  brick: /* glsl */ `
    // 0.25 x 0.065 m bricks (Reichsformat-like), 1 cm mortar. Tile covers 2x2 m.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 grid = vec2(8.0, 26.0); // bricks per tile horizontally, rows per tile
      vec2 p = uv * grid;
      float row = floor(p.y);
      p.x += mod(row, 2.0) * 0.5;
      vec2 cell = floor(p);
      vec2 f = fract(p);
      vec2 cid = vec2(mod(cell.x, grid.x), row);
      float mx = 0.045, my = 0.14;
      float mortar = 1.0 - smoothstep(0.0, mx, f.x) * smoothstep(1.0, 1.0 - mx, f.x) * smoothstep(0.0, my, f.y) * smoothstep(1.0, 1.0 - my, f.y);
      vec3 h3 = hash32(cid);
      vec3 brickCol = srgb(mix(vec3(0.48, 0.21, 0.14), vec3(0.62, 0.32, 0.2), h3.x));
      brickCol = mix(brickCol, srgb(vec3(0.33, 0.16, 0.12)), step(0.86, h3.y) * 0.7); // burnt bricks
      float fine = fbm01(uv, vec2(48.0), 4, 111.0);
      float chips = smoothstep(0.7, 0.8, fbm01(uv, vec2(24.0), 3, 112.0));
      float dirt = fbm01(uv, vec2(3.0), 4, 113.0);
      brickCol *= 0.8 + 0.35 * fine;
      vec3 mortarCol = srgb(vec3(0.62, 0.6, 0.55)) * (0.8 + 0.3 * fine);
      albedo = mix(brickCol, mortarCol, mortar);
      albedo *= 0.75 + 0.35 * dirt;
      rough = mix(0.82, 0.95, mortar);
      height = (1.0 - mortar) * 0.008 + fine * 0.002 - chips * (1.0 - mortar) * 0.004;
      metal = 0.0;
      alpha = 1.0;
    }`,
  plaster: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float stucco = fbm01(uv, vec2(40.0), 4, 121.0);
      float big = fbm01(uv, vec2(3.0), 5, 122.0);
      float streaks = fbm01(uv * vec2(1.0, 0.15), vec2(16.0, 2.0), 4, 123.0); // rain streaks run down
      float damage = smoothstep(0.66, 0.7, fbm01(uv, vec2(4.0), 5, 124.0));
      vec3 wall = mix(uPaintA, uPaintB, big);
      wall *= 0.88 + 0.18 * stucco;
      wall *= 1.0 - smoothstep(0.55, 0.85, streaks) * 0.25;
      // Exposed brick where plaster fell off.
      vec2 p = uv * vec2(8.0, 26.0);
      p.x += mod(floor(p.y), 2.0) * 0.5;
      vec2 f = fract(p);
      float mortar = 1.0 - smoothstep(0.0, 0.05, f.x) * smoothstep(1.0, 0.95, f.x) * smoothstep(0.0, 0.15, f.y) * smoothstep(1.0, 0.85, f.y);
      vec3 brick = mix(srgb(vec3(0.5, 0.24, 0.16)), srgb(vec3(0.62, 0.6, 0.55)), mortar) * (0.8 + 0.3 * stucco);
      albedo = mix(wall, brick, damage);
      rough = 0.9;
      height = stucco * 0.002 + (1.0 - damage) * 0.012 + damage * (1.0 - mortar) * 0.004;
      metal = 0.0;
      alpha = 1.0;
    }`,
  stoneWall: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec4 v = voronoiVec(uv * vec2(1.0, 1.6), vec2(6.0, 10.0), 0.8, 131.0);
      float edge = smoothstep(0.02, 0.1, v.z);
      float fine = fbm01(uv, vec2(50.0), 4, 132.0);
      float dome = sqrt(max(0.0, 1.0 - dot(v.xy, v.xy) * 1.3));
      vec3 s = srgb(mix(vec3(0.52, 0.49, 0.43), vec3(0.66, 0.62, 0.54), v.w));
      s = mix(s, srgb(vec3(0.45, 0.42, 0.36)), step(0.8, hash12(vec2(v.w * 9.0))) * 0.6);
      s *= 0.8 + 0.3 * fine;
      vec3 mortar = srgb(vec3(0.55, 0.53, 0.48)) * (0.7 + 0.3 * fine);
      albedo = mix(mortar, s, edge);
      rough = mix(0.95, 0.75, edge);
      height = edge * (0.02 + dome * 0.04) + fine * 0.004;
      metal = 0.0;
      alpha = 1.0;
    }`,
  roofTiles: /* glsl */ `
    // Clay beaver-tail tiles in overlapping rows. v runs down the roof slope.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 grid = vec2(11.0, 13.0);
      vec2 p = uv * grid;
      float row = floor(p.y);
      p.x += mod(row, 2.0) * 0.5;
      vec2 f = fract(p);
      vec2 cid = vec2(mod(floor(p.x), grid.x), row);
      vec3 h3 = hash32(cid + 5.0);
      // Rounded tile bottom edge and slope within each row.
      float shape = 1.0 - smoothstep(0.38, 0.5, length(vec2(f.x - 0.5, max(0.0, f.y - 0.5)) * vec2(1.0, 1.2)));
      float gap = smoothstep(0.0, 0.05, f.x) * smoothstep(1.0, 0.95, f.x);
      float fine = fbm01(uv, vec2(64.0), 3, 141.0);
      float moss = smoothstep(0.58, 0.75, fbm01(uv, vec2(5.0), 4, 142.0));
      vec3 clay = srgb(mix(vec3(0.5, 0.2, 0.12), vec3(0.62, 0.3, 0.16), h3.x));
      clay = mix(clay, srgb(vec3(0.33, 0.15, 0.1)), step(0.88, h3.y) * 0.6);
      clay *= 0.82 + 0.3 * fine;
      clay = mix(clay, srgb(vec3(0.25, 0.27, 0.15)), moss * 0.6);
      float t = shape * gap;
      albedo = mix(srgb(vec3(0.12, 0.08, 0.06)), clay, t * 0.9 + 0.1);
      rough = 0.78 + 0.1 * moss;
      height = t * (0.01 + f.y * 0.012) + fine * 0.001;
      metal = 0.0;
      alpha = 1.0;
    }`,
  woodPlanks: /* glsl */ `
    // Vertical weathered boards (barns, doors, shutters). u across, v along the grain.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float boards = 7.0;
      float bx = uv.x * boards;
      float id = floor(bx);
      float fx = fract(bx);
      float seam = smoothstep(0.0, 0.04, fx) * smoothstep(1.0, 0.96, fx);
      float shift = hash12(vec2(id, 1.0));
      float grain = fbm01(vec2(uv.x * 2.0, uv.y + shift), vec2(boards * 6.0, 2.0), 5, 151.0);
      float lines = sin((uv.x * boards * 18.0 + grain * 6.0) * 3.14159) * 0.5 + 0.5;
      float knots = smoothstep(0.08, 0.0, length(fract(vec2(fx, uv.y * 3.0 + shift * 7.0)) - vec2(0.5, 0.5)) - 0.03) * step(0.7, hash12(vec2(id, floor(uv.y * 3.0 + shift * 7.0))));
      vec3 c1 = mix(uPaintA, uPaintB, hash12(vec2(id, 9.0)));
      albedo = c1 * (0.75 + 0.3 * lines) * (0.85 + 0.25 * grain);
      albedo = mix(albedo, albedo * 0.4, knots);
      albedo *= 0.35 + 0.65 * seam;
      rough = 0.85;
      height = seam * (0.006 + lines * 0.0015) - knots * 0.001;
      metal = 0.0;
      alpha = 1.0;
    }`,
  bark: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float r = ridged(uv * vec2(1.0, 0.25), vec2(10.0, 2.0), 5, 161.0);
      float fine = fbm01(uv, vec2(30.0), 4, 162.0);
      float moss = smoothstep(0.55, 0.75, fbm01(uv, vec2(4.0), 4, 163.0));
      albedo = mix(uPaintA * 0.5, uPaintA, r) * (0.8 + 0.3 * fine);
      albedo = mix(albedo, srgb(vec3(0.25, 0.3, 0.12)), moss * 0.5);
      rough = 0.92;
      height = r * 0.025 + fine * 0.003;
      metal = 0.0;
      alpha = 1.0;
    }`,
  paintedMetal: /* glsl */ `
    // Vehicle armor/body paint with chipping, rust, dust and subtle cast/rolled texture.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float big = fbm01(uv, vec2(3.0), 5, 171.0);
      float fine = fbm01(uv, vec2(60.0), 4, 172.0);
      float castTex = fbm01(uv, vec2(12.0), 4, 173.0);
      float chip = smoothstep(0.72, 0.76, fbm01(uv, vec2(10.0), 6, 174.0));
      float rust = smoothstep(0.6, 0.85, fbm01(uv * vec2(1.0, 0.4), vec2(8.0, 3.0), 5, 175.0)) * 0.6;
      vec3 paint = uPaintA * (0.85 + 0.25 * big) * (0.95 + 0.1 * fine);
      paint = mix(paint, uPaintB, smoothstep(0.55, 0.9, big) * 0.35); // faded/dusty
      vec3 primer = srgb(vec3(0.18, 0.17, 0.16));
      vec3 rustc = srgb(vec3(0.35, 0.18, 0.08));
      albedo = mix(paint, rustc, rust * 0.5);
      albedo = mix(albedo, primer, chip);
      rough = mix(0.62 + 0.15 * fine, 0.45, chip);
      metal = chip * 0.6;
      height = castTex * 0.0015 - chip * 0.0003;
      alpha = 1.0;
    }`,
  gunSteel: /* glsl */ `
    // Blued or parkerized steel. uPaintA tints (bluish black vs grey-green phosphate).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float fine = fbm01(uv, vec2(90.0), 4, 181.0);
      float wear = smoothstep(0.62, 0.8, fbm01(uv, vec2(6.0), 5, 182.0));
      float brushed = vnoise(uv * vec2(400.0, 12.0), vec2(400.0, 12.0), 183.0);
      albedo = mix(uPaintA, srgb(vec3(0.42, 0.42, 0.42)), wear * 0.5) * (0.9 + 0.2 * fine);
      rough = mix(uPaintB.r, 0.36, wear) + brushed * 0.06;
      metal = mix(0.45, 0.85, wear); // bluing/phosphate is a dark oxide layer, bare steel shows at wear points
      height = fine * 0.0002;
      alpha = 1.0;
    }`,
  stockWood: /* glsl */ `
    // Walnut / beech / birch gunstock wood with an oil or varnish finish. u runs
    // along the stock: fine, mostly straight grain lines with a few gentle waves.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float warp = fbm(uv, vec2(2.0, 3.0), 4, 191.0) * 0.35;
      float lines = sin((uv.y * 70.0 + warp * 9.0 + fbm(uv, vec2(1.0, 6.0), 3, 192.0) * 1.5) * 6.2831853) * 0.5 + 0.5;
      float fine = fbm01(uv * vec2(1.0, 4.0), vec2(30.0, 160.0), 3, 194.0);
      float figure = fbm01(uv, vec2(3.0, 5.0), 4, 196.0);
      float pores = step(0.82, vnoise(uv * vec2(90.0, 600.0), vec2(90.0, 600.0), 193.0));
      float wear = smoothstep(0.7, 0.85, fbm01(uv, vec2(5.0), 4, 195.0));
      vec3 c = mix(uPaintA, uPaintB, pow(lines, 3.0) * 0.45 + figure * 0.35);
      c *= 0.9 + 0.15 * fine;
      c *= 1.0 - pores * 0.15;
      c = mix(c, c * 1.25, wear * 0.4); // handled wood gets lighter where the finish wore off
      albedo = c;
      rough = mix(0.62, 0.78, wear) + fine * 0.06; // oil finish, not glossy varnish
      metal = 0.0;
      height = lines * 0.00015 + fine * 0.0001 - pores * 0.00008;
      alpha = 1.0;
    }`,
  soldierGear: /* glsl */ `
    // Neutral leather / painted steel for soldiers' kit (tinted by vertex colors):
    // fine pebbled grain, creases, scuffs. uPaintA is the base albedo.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float grain = fbm01(uv, vec2(90.0), 3, 251.0);
      float pores = vnoise(uv * 260.0, vec2(260.0), 252.0);
      float big = fbm01(uv, vec2(4.0), 4, 253.0);
      float crease = ridged(uv * vec2(1.0, 3.0), vec2(6.0, 18.0), 3, 254.0);
      float scuff = smoothstep(0.62, 0.8, fbm01(uv, vec2(8.0), 5, 255.0));
      float cr = smoothstep(0.72, 1.0, crease);
      albedo = uPaintA * (0.9 + 0.12 * grain) * (0.88 + 0.24 * big);
      albedo *= 1.0 - 0.18 * cr;
      albedo = mix(albedo, uPaintA * 1.3, scuff * 0.3);
      rough = 0.5 + 0.2 * grain + 0.18 * scuff;
      metal = 0.0;
      height = grain * 0.0004 + pores * 0.0002 - cr * 0.0005;
      alpha = 1.0;
    }`,
  fabric: /* glsl */ `
    // Wool serge / cotton twill for uniforms. Fine diagonal weave + wear.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = uv * 160.0;
      float twill = sin((p.x + p.y) * 3.14159) * 0.5 + 0.5;
      float warp = sin(p.x * 3.14159 * 2.0) * 0.5 + 0.5;
      float big = fbm01(uv, vec2(4.0), 5, 201.0);
      float fine = fbm01(uv, vec2(50.0), 3, 202.0);
      float dirt = smoothstep(0.55, 0.85, fbm01(uv, vec2(3.0), 4, 203.0));
      albedo = uPaintA * (0.85 + 0.2 * twill * warp) * (0.85 + 0.25 * big) * (0.92 + 0.12 * fine);
      albedo = mix(albedo, srgb(vec3(0.24, 0.2, 0.15)), dirt * 0.3);
      rough = 0.95;
      metal = 0.0;
      height = twill * warp * 0.0004 + big * 0.001;
      alpha = 1.0;
    }`,
  burlap: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = uv * 90.0;
      float wx = sin(p.x * 3.14159 * 2.0) * 0.5 + 0.5;
      float wy = sin(p.y * 3.14159 * 2.0) * 0.5 + 0.5;
      float weave = mix(wx, wy, step(0.5, fract(floor(p.x) * 0.5 + floor(p.y) * 0.5)));
      float big = fbm01(uv, vec2(4.0), 5, 211.0);
      float dirt = smoothstep(0.45, 0.85, fbm01(uv, vec2(3.0), 4, 212.0));
      albedo = mix(uPaintA, uPaintB, big) * (0.75 + 0.35 * weave);
      albedo = mix(albedo, srgb(vec3(0.25, 0.2, 0.15)), dirt * 0.5);
      rough = 0.97;
      metal = 0.0;
      height = weave * 0.0015 + big * 0.004;
      alpha = 1.0;
    }`,
  concrete: /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float big = fbm01(uv, vec2(3.0), 5, 221.0);
      float fine = fbm01(uv, vec2(70.0), 3, 222.0);
      float pores = step(0.82, vnoise(uv * 220.0, vec2(220.0), 223.0));
      float streaks = fbm01(uv * vec2(1.0, 0.2), vec2(12.0, 2.0), 4, 224.0);
      albedo = mix(srgb(vec3(0.5, 0.49, 0.46)), srgb(vec3(0.62, 0.61, 0.57)), big) * (0.9 + 0.15 * fine);
      albedo *= 1.0 - pores * 0.35;
      albedo *= 1.0 - smoothstep(0.6, 0.9, streaks) * 0.2;
      rough = 0.88;
      metal = 0.0;
      height = fine * 0.001 - pores * 0.0015 + big * 0.003;
      alpha = 1.0;
    }`,
  water: /* glsl */ `
    // Small wind ripples for water normal maps.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float h = 0.0;
      h += fbm(uv, vec2(4.0), 5, 241.0) * 0.012;
      h += sin((uv.x * 7.0 + uv.y * 3.0) * 6.2831853 + fbm(uv, vec2(3.0), 3, 242.0) * 3.0) * 0.004;
      h += sin((uv.x * -2.0 + uv.y * 9.0) * 6.2831853 + fbm(uv, vec2(5.0), 3, 243.0) * 2.0) * 0.003;
      albedo = vec3(0.05, 0.07, 0.06);
      rough = 0.04;
      metal = 0.0;
      height = h;
      alpha = 1.0;
    }`,
  leaves: /* glsl */ `
    // A card full of leaves with transparency, used on tree and bush foliage.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      alpha = 0.0;
      albedo = uPaintA;
      height = 0.0;
      // Fade out near the card edges so cards blend into a soft clump.
      float edgeFade = smoothstep(0.0, 0.18, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        vec4 v = voronoiVec(uv + vec2(fk * 0.31, fk * 0.53), vec2(9.0 + fk * 3.0), 1.0, 231.0 + fk);
        float ang = v.w * 6.2831;
        vec2 d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * v.xy;
        float shape = length(d * vec2(1.0, 1.9));
        float leaf = 1.0 - smoothstep(0.3, 0.36, shape);
        float present = step(0.25 + 0.3 * (1.0 - edgeFade), hash12(vec2(v.w * 17.0, fk)));
        if (leaf * present > 0.5) {
          vec3 lc = mix(uPaintA, uPaintB, hash12(vec2(v.w * 31.0)));
          lc *= 0.75 + 0.4 * (1.0 - shape * 1.8);
          // Central vein.
          lc *= 1.0 - 0.25 * smoothstep(0.03, 0.0, abs(d.x)) * step(abs(d.y), 0.25);
          albedo = lc;
          alpha = 1.0;
          height = 0.002 * (1.0 - shape) + fk * 0.001;
        }
      }
      rough = 0.7;
      metal = 0.0;
    }`,
  grassCard: /* glsl */ `
    // Blades of grass on a transparent card (u across, v up).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      alpha = 0.0;
      albedo = uPaintA;
      for (int k = 0; k < 14; k++) {
        float fk = float(k);
        vec3 h = hash32(vec2(fk, 7.0));
        float x0 = 0.05 + 0.9 * h.x;
        float tall = 0.55 + 0.45 * h.y;
        float lean = (h.z - 0.5) * 0.35;
        float y = uv.y / tall;
        if (y > 1.0) continue;
        float cx = x0 + lean * y * y;
        float w = 0.018 * (1.0 - y) + 0.002;
        if (abs(uv.x - cx) < w) {
          alpha = 1.0;
          albedo = mix(uPaintB, uPaintA, y) * (0.85 + 0.3 * h.y);
          height = 0.001;
        }
      }
      rough = 0.75;
      metal = 0.0;
    }`,
  // ---- Village building materials ------------------------------------------------
  slateRoof: /* glsl */ `
    // Natural roof slates in overlapping courses (v runs down the roof slope).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 grid = vec2(9.0, 16.0); // slates across, courses down (2 m tile: 22 x 12.5 cm exposed)
      vec2 p = uv * grid;
      float row = floor(p.y);
      p.x += mod(row, 2.0) * 0.5;
      vec2 f = fract(p);
      vec2 cid = vec2(mod(floor(p.x), grid.x), row);
      vec3 h3 = hash32(cid + 11.0);
      float gap = smoothstep(0.0, 0.035, f.x) * smoothstep(1.0, 0.965, f.x);
      float edge = smoothstep(1.0, 0.92, f.y);
      float fine = fbm01(uv, vec2(48.0), 4, 251.0);
      float cleave = fbm01(uv * vec2(1.0, 3.0), vec2(30.0, 90.0), 3, 254.0);
      float lichen = smoothstep(0.64, 0.8, fbm01(uv, vec2(6.0), 4, 252.0));
      vec3 slate = mix(uPaintA, uPaintB, h3.x);
      slate *= 0.84 + 0.22 * fine + 0.08 * cleave;
      slate = mix(slate, slate * 0.72, step(0.86, h3.y));
      slate = mix(slate, slate * vec3(1.08, 1.0, 0.92), step(0.9, h3.z) * 0.6);
      slate = mix(slate, srgb(vec3(0.58, 0.58, 0.46)), lichen * 0.4);
      float t = gap * edge;
      albedo = mix(slate * 0.3, slate, t);
      rough = 0.58 + 0.2 * fine + lichen * 0.18;
      height = t * (0.003 + f.y * 0.006) + cleave * 0.0006;
      metal = 0.0;
      alpha = 1.0;
    }`,
  ashlar: /* glsl */ `
    // Dressed limestone blocks in courses (about 33 cm high) with thin lime joints.
    // Tile covers uWorld meters (4 m): 12 courses, 6 blocks per course with varied lengths.
    float ashJ(float k, float row, float n) { return (hash12(vec2(mod(k, n), row * 1.7 + 7.0)) - 0.5) * 0.56; }
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float rows = 12.0;
      float n = 6.0;
      float ry = uv.y * rows;
      float row = mod(floor(ry), rows);
      float fy = fract(ry);
      float fx = uv.x * n + hash12(vec2(row, 41.0)) * n;
      float cell = floor(fx);
      float local = fx - cell;
      float jc = ashJ(cell, row, n);
      float jn = ashJ(cell + 1.0, row, n);
      float left, right, bid;
      if (local < jc) { left = ashJ(cell - 1.0, row, n) - 1.0; right = jc; bid = cell - 1.0; }
      else if (local > 1.0 + jn) { left = 1.0 + jn; right = 2.0 + ashJ(cell + 2.0, row, n); bid = cell + 1.0; }
      else { left = jc; right = 1.0 + jn; bid = cell; }
      float blockW = uWorld / n;
      float rowH = uWorld / rows;
      float dx = min(local - left, right - local) * blockW; // meters to vertical joint
      float dy = min(fy, 1.0 - fy) * rowH;                  // meters to bed joint
      float d = min(dx, dy);
      float mortar = 1.0 - smoothstep(0.004, 0.009, d);
      float bevel = smoothstep(0.004, 0.03, d);
      vec3 h3 = hash32(vec2(mod(bid, n), row) + 3.0);
      float fine = fbm01(uv, vec2(64.0), 4, 261.0);
      float chisel = fbm01(uv * vec2(1.0, 1.0), vec2(160.0), 2, 262.0);
      float big = fbm01(uv, vec2(3.0), 4, 263.0);
      float streak = smoothstep(0.55, 0.85, fbm01(uv * vec2(1.0, 0.2), vec2(14.0, 2.0), 4, 264.0));
      float lichen = smoothstep(0.66, 0.8, fbm01(uv, vec2(7.0), 4, 265.0));
      vec3 stone = mix(uPaintA, uPaintB, h3.x * 0.7 + big * 0.3);
      stone *= 0.9 + 0.16 * fine + 0.06 * chisel;
      stone = mix(stone, stone * vec3(0.92, 0.9, 0.86), step(0.82, h3.y));
      stone = mix(stone, stone * 0.68, streak * 0.45);
      stone = mix(stone, srgb(vec3(0.5, 0.52, 0.42)), lichen * 0.35);
      vec3 mortarCol = srgb(vec3(0.6, 0.58, 0.53)) * (0.8 + 0.2 * fine);
      albedo = mix(stone, mortarCol, mortar);
      rough = mix(0.82 + 0.08 * fine, 0.95, mortar);
      height = bevel * (0.012 + chisel * 0.002 + h3.z * 0.004) + fine * 0.001;
      metal = 0.0;
      alpha = 1.0;
    }`,
  crepi: /* glsl */ `
    // Lime render (crepi) on rubble masonry: trowel marks, rain streaks and patches
    // where the render has fallen off and shows the stones underneath.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float stucco = fbm01(uv, vec2(48.0), 4, 311.0);
      float trowel = fbm01(uv, vec2(9.0), 3, 312.0);
      float big = fbm01(uv, vec2(3.0), 5, 313.0);
      float streaks = fbm01(uv * vec2(1.0, 0.15), vec2(16.0, 2.0), 4, 314.0);
      float patchN = fbm01(uv, vec2(4.0), 5, 315.0);
      float fallen = smoothstep(0.665, 0.69, patchN);
      vec4 v = voronoiVec(uv * vec2(1.0, 1.6), vec2(12.0, 19.0), 0.8, 316.0);
      float edge = smoothstep(0.02, 0.08, v.z);
      vec3 stone = mix(srgb(vec3(0.5, 0.47, 0.42)), srgb(vec3(0.63, 0.59, 0.51)), v.w) * (0.8 + 0.3 * stucco);
      vec3 under = mix(srgb(vec3(0.56, 0.53, 0.48)), stone, edge);
      float blotch = fbm01(uv, vec2(6.0), 4, 317.0);
      vec3 wall = mix(uPaintA, uPaintB, big) * (0.84 + 0.24 * stucco) * (0.9 + 0.16 * trowel);
      wall *= 0.92 + 0.12 * blotch;
      wall *= 1.0 - smoothstep(0.5, 0.85, streaks) * 0.28;
      float rim = smoothstep(0.62, 0.665, patchN) * (1.0 - fallen);
      wall *= 1.0 - rim * 0.22;
      albedo = mix(wall, under, fallen);
      rough = 0.92;
      height = stucco * 0.002 + trowel * 0.003 + (1.0 - fallen) * 0.012 + fallen * edge * 0.01;
      metal = 0.0;
      alpha = 1.0;
    }`,
  tomettes: /* glsl */ `
    // Hexagonal terracotta floor tiles (tomettes) with worn faces and dirty grout.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 N = vec2(10.0, 12.0);
      vec2 p = uv * N;
      float F1 = 9.0, F2 = 9.0, id = 0.0;
      vec2 base = floor(p);
      for (int j = -1; j <= 2; j++) {
        for (int i = -1; i <= 2; i++) {
          vec2 c = base + vec2(float(i), float(j));
          vec2 seed = c + vec2(0.5 + 0.5 * mod(c.y, 2.0), 0.5);
          vec2 d = (p - seed) * vec2(1.0, 0.87);
          float dd = dot(d, d);
          if (dd < F1) { F2 = F1; F1 = dd; id = hash12(mod(c, N) + 17.0); }
          else if (dd < F2) { F2 = dd; }
        }
      }
      float border = sqrt(F2) - sqrt(F1);
      float grout = 1.0 - smoothstep(0.03, 0.08, border);
      float fine = fbm01(uv, vec2(40.0), 4, 271.0);
      float wear = fbm01(uv, vec2(4.0), 4, 272.0);
      vec3 clay = mix(uPaintA, uPaintB, id);
      clay = mix(clay, clay * 0.75, step(0.85, fract(id * 13.7)));
      clay *= 0.85 + 0.22 * fine;
      clay = mix(clay, clay * 1.12 + 0.02, smoothstep(0.55, 0.8, wear) * 0.5);
      vec3 groutCol = srgb(vec3(0.3, 0.26, 0.21));
      albedo = mix(clay, groutCol, grout);
      rough = mix(0.62 - 0.12 * wear, 0.92, grout);
      height = (1.0 - grout) * 0.004 + fine * 0.0006;
      metal = 0.0;
      alpha = 1.0;
    }`,
  planeBark: /* glsl */ `
    // London plane bark: smooth, peeling in jigsaw patches of olive, grey and cream.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 w = vec2(fbm(uv, vec2(4.0), 3, 281.0), fbm(uv, vec2(4.0), 3, 282.0)) * 0.06;
      vec3 v = voronoi(uv + w, vec2(5.0, 9.0), 1.0, 283.0);
      vec3 v2 = voronoi(uv + w * 1.5, vec2(11.0, 18.0), 1.0, 284.0);
      float edge = smoothstep(0.0, 0.06, v.y - v.x);
      float fine = fbm01(uv, vec2(48.0), 3, 285.0);
      vec3 cA = uPaintA;
      vec3 cB = uPaintB;
      vec3 cC = srgb(vec3(0.78, 0.74, 0.6));
      vec3 col = v.z < 0.4 ? cA : (v.z < 0.75 ? cB : cC);
      col = mix(col, v2.z < 0.5 ? cB : cC, step(0.7, v2.z) * 0.5);
      col = mix(col, (cA + cB + cC) / 3.0, 0.3);
      col *= 0.88 + 0.2 * fine;
      albedo = mix(col * 0.8, col, edge);
      rough = 0.7 + 0.15 * fine;
      height = edge * 0.002 + step(0.5, v.z) * 0.001 + fine * 0.0005;
      metal = 0.0;
      alpha = 1.0;
    }`,
  hay: /* glsl */ `
    // Straw: thin stalks crossing in many directions (tiles seamlessly).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float s = 0.0;
      float dark = 1.0;
      for (int k = 0; k < 6; k++) {
        vec2 ab = k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(0.0, 1.0) : k == 2 ? vec2(1.0, 1.0) : k == 3 ? vec2(1.0, -1.0) : k == 4 ? vec2(2.0, 1.0) : vec2(1.0, -2.0);
        float q1 = ab.x * uv.x + ab.y * uv.y;
        float q2 = -ab.y * uv.x + ab.x * uv.y;
        float st = vnoise(vec2(q1 * 6.0, q2 * 140.0), vec2(6.0, 140.0), 291.0 + float(k));
        st = smoothstep(0.55, 0.9, st);
        s = max(s, st * (0.7 + 0.3 * float(k) / 5.0));
      }
      float big = fbm01(uv, vec2(3.0), 4, 297.0);
      float fine = fbm01(uv, vec2(50.0), 3, 298.0);
      vec3 col = mix(uPaintB, uPaintA, s);
      col *= 0.8 + 0.3 * big;
      col = mix(col * 0.45, col, 0.35 + 0.65 * s);
      albedo = col * (0.9 + 0.15 * fine);
      rough = 0.9;
      height = s * 0.01 + big * 0.01;
      metal = 0.0;
      alpha = 1.0;
    }`,
  rubble: /* glsl */ `
    // Broken masonry: lumps of limestone, brick and plaster in dust.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec4 a = voronoiVec(uv, vec2(9.0), 1.0, 301.0);
      vec4 b = voronoiVec(uv + 0.37, vec2(19.0), 1.0, 302.0);
      float fine = fbm01(uv, vec2(60.0), 3, 303.0);
      float dust = fbm01(uv, vec2(5.0), 4, 304.0);
      float ea = smoothstep(0.0, 0.1, a.z);
      float eb = smoothstep(0.0, 0.08, b.z);
      float domeA = sqrt(max(0.0, 1.0 - dot(a.xy, a.xy) * 1.8));
      float domeB = sqrt(max(0.0, 1.0 - dot(b.xy, b.xy) * 2.0));
      vec3 lime = srgb(vec3(0.62, 0.58, 0.5));
      vec3 brick = srgb(vec3(0.5, 0.25, 0.17));
      vec3 plas = srgb(vec3(0.75, 0.72, 0.64));
      vec3 char = srgb(vec3(0.12, 0.11, 0.1));
      vec3 ca = a.w < 0.5 ? lime : a.w < 0.7 ? brick : a.w < 0.96 ? plas : char;
      vec3 cb = b.w < 0.5 ? lime : b.w < 0.8 ? plas : brick;
      vec3 dustCol = srgb(vec3(0.47, 0.43, 0.37));
      vec3 col = mix(dustCol, ca, ea * 0.85);
      col = mix(col, cb, eb * step(0.55, b.w) * (1.0 - ea * 0.5) * 0.8);
      col *= 0.78 + 0.3 * fine;
      col = mix(col, dustCol, 0.25 + smoothstep(0.5, 0.85, dust) * 0.45);
      albedo = col;
      rough = 0.92;
      height = ea * domeA * 0.06 + eb * domeB * step(0.55, b.w) * 0.03 + fine * 0.004;
      metal = 0.0;
      alpha = 1.0;
    }`,
  // ---- Vehicle materials (src/vehicles/models) ----------------------------------------
  castArmor: /* glsl */ `
    // Cast steel armor (cast hulls, turrets, mantlets): lumpy surface with casting pits,
    // painted uPaintA (faded toward uPaintB) with chips, rust streaks and dust.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float big = fbm01(uv, vec2(3.0), 5, 311.0);
      float lumps = fbm01(uv, vec2(9.0), 5, 312.0);
      float fine = fbm01(uv, vec2(48.0), 4, 313.0);
      vec4 pit = voronoiVec(uv, vec2(36.0), 1.0, 314.0);
      float pits = step(0.84, pit.w) * (1.0 - smoothstep(0.08, 0.28, length(pit.xy)));
      float chip = smoothstep(0.73, 0.77, fbm01(uv, vec2(10.0), 6, 315.0));
      float streak = smoothstep(0.6, 0.9, fbm01(uv * vec2(1.0, 0.3), vec2(12.0, 3.0), 4, 316.0));
      vec3 paint = uPaintA * (0.85 + 0.25 * big) * (0.92 + 0.12 * fine) * (0.94 + 0.12 * lumps);
      paint = mix(paint, uPaintB, smoothstep(0.55, 0.9, big) * 0.35);
      paint *= 1.0 - pits * 0.3;
      paint = mix(paint, srgb(vec3(0.33, 0.2, 0.1)), streak * 0.16);
      albedo = mix(paint, srgb(vec3(0.17, 0.16, 0.15)), chip);
      rough = mix(0.68 + 0.14 * fine, 0.48, chip);
      metal = chip * 0.6;
      height = lumps * 0.004 + fine * 0.0009 - pits * 0.0012 - chip * 0.0003;
      alpha = 1.0;
    }`,
  rubber: /* glsl */ `
    // Tire and road wheel rubber: near black, fine grain, dust (uPaintB) and scuffs.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float fine = fbm01(uv, vec2(64.0), 4, 321.0);
      float big = fbm01(uv, vec2(4.0), 4, 322.0);
      float dust = smoothstep(0.45, 0.85, fbm01(uv, vec2(6.0), 5, 323.0));
      float scuff = smoothstep(0.7, 0.9, fbm01(uv * vec2(1.0, 0.25), vec2(20.0, 5.0), 3, 324.0));
      albedo = uPaintA * (0.85 + 0.3 * fine) * (0.9 + 0.2 * big);
      albedo = mix(albedo, uPaintB, dust * 0.4);
      albedo = mix(albedo, uPaintA * 1.6, scuff * 0.3);
      rough = 0.82 + 0.1 * fine - scuff * 0.1;
      metal = 0.0;
      height = fine * 0.0006 + big * 0.001;
      alpha = 1.0;
    }`,
  trackSteel: /* glsl */ `
    // Cast manganese-steel track links: dark oxide, rust, packed mud (uPaintB) and polished
    // wear on the contact faces.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float fine = fbm01(uv, vec2(70.0), 4, 331.0);
      float big = fbm01(uv, vec2(5.0), 5, 332.0);
      float rust = smoothstep(0.5, 0.8, fbm01(uv, vec2(8.0), 5, 333.0));
      float mud = smoothstep(0.56, 0.76, fbm01(uv, vec2(4.0), 5, 334.0));
      float wear = smoothstep(0.68, 0.8, fbm01(uv, vec2(14.0), 4, 335.0));
      vec3 steel = uPaintA * (0.8 + 0.4 * fine);
      vec3 rustc = srgb(vec3(0.36, 0.2, 0.1)) * (0.8 + 0.3 * big);
      albedo = mix(steel, rustc, rust * 0.6);
      albedo = mix(albedo, srgb(vec3(0.55, 0.53, 0.5)), wear * 0.7);
      albedo = mix(albedo, uPaintB * (0.8 + 0.3 * fine), mud * 0.85);
      rough = mix(mix(0.7, 0.85, rust), 0.35, wear);
      rough = mix(rough, 0.95, mud);
      metal = mix(mix(0.6, 0.2, rust), 0.9, wear) * (1.0 - mud);
      height = fine * 0.0008 + mud * 0.003 + big * 0.002;
      alpha = 1.0;
    }`,
  // ---- Vegetation (src/world/vegetation) ----------------------------------------------
  // Shape parameters come in as vec4 uniforms uVegP / uVegQ (from a preset's `uniforms`
  // field), so one program serves every species. Baked into atlases (textures.atlas).
  vegBark: /* glsl */ `
    // Tree bark. uVegP.x: 0 oak (deep furrows broken into blocks), 1 beech (smooth grey),
    // 2 Scots pine (thin orange plates), 3 fissured bark that is tinted per species.
    // uPaintA: furrow (dark) color, uPaintB: ridge (light) color.
    uniform vec4 uVegP;
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float style = uVegP.x;
      float fine = fbm01(uv, vec2(32.0), 4, 401.0);
      float big = fbm01(uv, vec2(3.0), 4, 402.0);
      float lichen = smoothstep(0.66, 0.8, fbm01(uv, vec2(6.0), 4, 403.0));
      vec3 col;
      float h;
      if (style < 0.5) {
        vec2 w = vec2(fbm(uv, vec2(3.0, 2.0), 3, 405.0) * 0.05, 0.0);
        float r = ridged(uv + w, vec2(7.0, 2.0), 4, 406.0);
        float breaks = smoothstep(0.72, 0.9, vnoise(uv * vec2(7.0, 9.0), vec2(7.0, 9.0), 407.0));
        float ridge = smoothstep(0.3, 0.75, r) * (1.0 - breaks * 0.7);
        col = mix(uPaintA, uPaintB, ridge) * (0.82 + 0.3 * fine);
        h = ridge * 0.035 + fine * 0.004;
        rough = 0.93;
      } else if (style < 1.5) {
        float marks = smoothstep(0.8, 0.95, vnoise(uv * vec2(5.0, 48.0), vec2(5.0, 48.0), 408.0));
        float blot = smoothstep(0.5, 0.8, fbm01(uv, vec2(4.0), 4, 409.0));
        col = mix(uPaintB, uPaintA, blot * 0.28 + big * 0.3) * (0.94 + 0.1 * fine);
        col *= 1.0 - marks * 0.2;
        h = fine * 0.0015 + big * 0.002 - marks * 0.001;
        rough = 0.74;
      } else if (style < 2.5) {
        vec4 v = voronoiVec(uv, vec2(10.0, 5.0), 0.9, 410.0);
        float plate = smoothstep(0.0, 0.05, v.z);
        col = mix(uPaintA * 0.45, mix(uPaintA, uPaintB, v.w), plate) * (0.85 + 0.25 * fine);
        h = plate * (0.006 + v.w * 0.004) + fine * 0.002;
        rough = 0.86;
      } else {
        vec2 w = vec2(fbm(uv, vec2(4.0, 2.0), 3, 411.0) * 0.04, 0.0);
        float r = ridged(uv + w, vec2(11.0, 3.0), 4, 412.0);
        float ridge = smoothstep(0.3, 0.8, r);
        col = mix(uPaintA, uPaintB, ridge) * (0.85 + 0.25 * fine);
        h = ridge * 0.016 + fine * 0.003;
        rough = 0.9;
      }
      albedo = mix(col, srgb(vec3(0.45, 0.48, 0.34)), lichen * 0.3);
      height = h;
      metal = 0.0;
      alpha = 1.0;
    }`,
  vegLeaves: /* glsl */ `
    // A spray of foliage on a transparent card: twigs fan up from the bottom middle
    // of the card and carry leaves (or needles) along them. The spray is scaled to fit.
    //   uVegP: x shape (0 oval: beech/apple, 1 oak, 2 ash leaflets, 3 poplar, 4 spruce,
    //          5 pine tufts, 6 hawthorn, 7 hazel, 8 bramble), y leaf (needle) length,
    //          z leaf width / length, w leaves per twig.
    //   uVegQ: x twigs, y fan half-angle (radians), z twig curl, w twig length.
    // uPaintA / uPaintB: the range of leaf colors.
    uniform vec4 uVegP;
    uniform vec4 uVegQ;
    float vegHalfWidth(float y, float shape) {
      float s = sin(3.14159 * clamp(y, 0.0, 1.0));
      if (shape < 0.5) return pow(s, 0.7) * (1.0 - 0.15 * y);
      if (shape < 1.5) return pow(sin(3.14159 * pow(clamp(y, 0.0, 1.0), 0.8)), 0.65) * (0.7 + 0.3 * abs(sin(y * 12.5 + 0.6)));
      if (shape < 2.5) return pow(s, 0.9);
      if (shape < 3.5) return pow(clamp(y < 0.4 ? y / 0.4 : (1.0 - y) / 0.6, 0.0, 1.0), 0.7);
      if (shape < 6.5) return pow(clamp(y, 0.0, 1.0), 0.4) * (0.45 + 0.55 * abs(sin(y * 7.0 + 0.5))) * (1.0 - 0.3 * y);
      if (shape < 7.5) return pow(s, 0.45) * (1.0 - 0.05 * abs(sin(y * 48.0)));
      return pow(s, 0.6) * (1.0 - 0.1 * abs(sin(y * 40.0)));
    }
    // Needle comb: q.y along a twig, q.x across it; 1 inside a needle.
    float vegComb(vec2 q, float nl, float seed) {
      float r = abs(q.x) / nl;
      float u2 = (q.y - abs(q.x) * 0.75) * 170.0;
      float ln = hash12(vec2(floor(u2), seed));
      return (abs(fract(u2) - 0.5) < 0.32 * (1.0 - r * 0.5) && r < 0.6 + 0.4 * ln) ? 0.75 + 0.45 * ln : 0.0;
    }
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float shape = uVegP.x;
      float W = uVegP.z * 0.5;
      float leafL = uVegP.y;
      int M = int(uVegP.w + 0.5);
      int K = int(uVegQ.x + 0.5);
      float spread = uVegQ.y;
      float lenMax = uVegQ.w;
      bool spruce = shape > 3.5 && shape < 4.5;
      bool pine = shape > 4.5 && shape < 5.5;
      // Spray space: the base of the twigs at the origin, scaled so it fits the card.
      float R = lenMax * 0.85 * sin(min(spread * 0.85, 1.5)) + leafL * 0.7;
      float fit = min(0.96 / (2.0 * R), 0.95 / (lenMax * 0.92 + leafL * 0.6));
      vec2 p = (uv - vec2(0.5, 0.025)) / fit;
      float aa = 1.2 / uSize / fit;
      alpha = 0.0;
      height = 0.0;
      metal = 0.0;
      rough = 0.66;
      albedo = mix(uPaintA, uPaintB, 0.4) * 0.7;
      vec3 twigCol = srgb(vec3(0.32, 0.25, 0.17));
      for (int k = 0; k < 12; k++) {
        if (k >= K) break;
        float fk = float(k);
        vec3 hk = hash32(vec2(fk * 7.0 + 1.0, 17.0 + shape * 3.0));
        float a0 = (K > 1 ? -spread + 2.0 * spread * fk / float(K - 1) : 0.0) + (hk.x - 0.5) * 0.3;
        // Outer twigs long, a few short ones fill the middle of the spray.
        float len = lenMax * (0.55 + 0.45 * hk.y) * (1.0 - 0.25 * step(0.6, hk.z) * (1.0 - abs(a0) / max(spread, 0.1)));
        float curl = uVegQ.z * (hk.z - 0.5) * 2.0 - a0 * 0.35;
        // Skip twigs whose reach (twig plus leaves) is nowhere near this pixel.
        vec2 tip = vec2(sin(a0 + curl * 0.5), cos(a0 + curl * 0.5)) * len;
        float hsT = clamp(dot(p, tip) / max(dot(tip, tip), 1e-6), 0.0, 1.0);
        if (length(p - tip * hsT) > leafL * 1.3 + len * abs(curl) * 0.15 + 0.02) continue;
        vec2 prev = vec2(0.0);
        for (int i = 0; i < 16; i++) {
          if (i >= M) break;
          float t = (float(i) + 1.0) / float(M);
          float a = a0 + curl * t;
          vec2 P = vec2(sin(a0 + curl * t * 0.5), cos(a0 + curl * t * 0.5)) * len * t;
          vec2 dir = vec2(sin(a), cos(a));
          vec2 pa = p - prev;
          vec2 ba = P - prev;
          float hs = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
          float dTw = length(pa - ba * hs);
          float tw = (spruce || pine ? 0.008 : 0.0055) * (1.3 - t);
          if (dTw < tw) {
            albedo = twigCol * (0.75 + 0.45 * (1.0 - dTw / tw));
            alpha = 1.0;
            height = 0.004 * (1.0 - dTw / tw);
          }
          vec3 h = hash32(vec2(fk * 31.0 + float(i) * 3.0, 5.0 + shape));
          float side = mod(float(i) + fk, 2.0) < 0.5 ? 1.0 : -1.0;
          if (length(p - P) > leafL * 1.25 + (spruce ? lenMax * 0.22 : 0.0)) {
            prev = P;
            continue;
          }
          if (spruce) {
            // Bottle brushes of short needles: along the twig and on side twigs.
            float nl = leafL * (0.9 + 0.3 * h.x) * (1.1 - 0.3 * t);
            vec2 sd = ba / max(length(ba), 1e-5);
            float c = vegComb(vec2(dot(pa, vec2(-sd.y, sd.x)), dot(pa, sd)), nl, fk * 13.0 + float(i));
            if (c > 0.0 && dot(pa, sd) > -0.004 && dot(pa, sd) < length(ba) + 0.004) {
              albedo = mix(uPaintA, uPaintB, 0.3 + t * 0.4) * c;
              alpha = 1.0;
              height = 0.002;
            }
            vec2 s2 = vec2(sin(a + side * 0.9), cos(a + side * 0.9));
            vec2 rel = p - P;
            float sl = (0.12 + 0.1 * h.y) * (1.0 - 0.45 * t) * lenMax;
            vec2 q = vec2(dot(rel, vec2(s2.y, -s2.x)), dot(rel, s2));
            if (q.y > 0.0 && q.y < sl) {
              float c2 = vegComb(q, nl * (1.0 - 0.4 * q.y / sl), fk * 19.0 + float(i) * 5.0);
              if (abs(q.x) < 0.0035) c2 = 0.6;
              if (c2 > 0.0) {
                albedo = mix(uPaintA, uPaintB, 0.45 + 0.5 * q.y / sl) * c2;
                alpha = 1.0;
                height = 0.002;
              }
            }
          } else if (pine) {
            // Tufts of long needles pointing forward along the twig.
            vec2 rel = p - P;
            float tl = leafL * (0.8 + 0.35 * h.x);
            float r = length(rel) / tl;
            if (r < 1.0) {
              vec2 td = vec2(sin(a + side * 0.35 * h.z), cos(a + side * 0.35 * h.z));
              float ang = atan(dot(rel, vec2(td.y, -td.x)), dot(rel, td));
              if (abs(ang) < 0.95) {
                float n = ang * 10.0 + h.y * 3.0;
                float ln = hash12(vec2(floor(n), fk * 5.0 + float(i)));
                float lineD = abs(fract(n) - 0.5) / 10.0 * r * tl;
                if (lineD < 0.0028 + 0.0016 * (1.0 - r) && r < 0.6 + 0.4 * ln) {
                  albedo = mix(uPaintA, uPaintB, r * 0.7) * (0.8 + 0.4 * ln);
                  alpha = 1.0;
                  height = 0.002;
                }
              }
            }
          } else {
            // Leaves beside the twig (alternating; ash leaflets in opposite pairs) and at the tip.
            for (int s = 0; s < 2; s++) {
              if (s == 1 && shape > 2.5 && h.z < 0.5) break;
              if (s == 1 && shape < 1.5 && h.z < 0.75) break;
              float sd = s == 0 ? side : -side;
              float la = i == M - 1 && s == 0 ? a + (h.x - 0.5) * 0.4 : a + sd * (0.6 + 0.5 * h.x);
              vec2 ld = vec2(sin(la), cos(la));
              float ll = leafL * (0.75 + 0.45 * fract(h.y + float(s) * 0.37)) * (1.0 - 0.2 * t);
              vec2 rel = p - P - ld * ll * 0.05;
              vec2 q = vec2(dot(rel, vec2(ld.y, -ld.x)), dot(rel, ld)) / ll;
              if (q.y > 0.0 && q.y < 1.0) {
                float hw = vegHalfWidth(q.y, shape) * W;
                float edge = hw - abs(q.x);
                float cov = clamp(edge * ll / aa + 0.5, 0.0, 1.0);
                if (cov > 0.0) {
                  vec3 lc = mix(uPaintA, uPaintB, fract(h.z + float(s) * 0.5));
                  lc *= 0.78 + 0.32 * h.y;
                  lc *= 0.88 + 0.2 * q.y;
                  lc *= 1.0 - 0.2 * smoothstep(0.035 * W, 0.0, abs(q.x)) * step(q.y, 0.92);
                  float vein = abs(fract((q.y - abs(q.x) * 1.3) * 7.0) - 0.5);
                  lc *= 1.0 - 0.07 * smoothstep(0.08, 0.0, vein);
                  lc *= 0.84 + 0.16 * clamp(edge * ll / (aa * 3.0), 0.0, 1.0);
                  cov *= smoothstep(0.0, 0.02, min(min(uv.x, 1.0 - uv.x), 1.0 - uv.y));
                  albedo = mix(albedo, lc, cov);
                  alpha = max(alpha, cov);
                  height = max(height, cov * (0.003 * sqrt(clamp(edge / max(hw, 1e-3), 0.0, 1.0)) + 0.0015 * t));
                }
              }
            }
          }
          prev = P;
        }
      }
    }`,
  vegHedgeCore: /* glsl */ `
    // The dense inside of a hedge seen from outside: small leaves over dark, shadowed
    // twigs. Opaque and tiling (hedge cores, far hedges).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float deep = fbm01(uv, vec2(5.0), 4, 421.0);
      albedo = mix(uPaintA * 0.22, uPaintA * 0.45, deep);
      height = 0.0;
      for (int k = 0; k < 4; k++) {
        float fk = float(k);
        vec4 v = voronoiVec(uv + vec2(fk * 0.27, fk * 0.61), vec2(14.0 + fk * 4.0), 1.0, 422.0 + fk);
        float ang = v.w * 6.2831;
        vec2 d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * v.xy;
        float shape = length(d * vec2(1.0, 1.8));
        float leaf = 1.0 - smoothstep(0.32, 0.38, shape);
        float present = step(0.18 + 0.1 * fk, hash12(vec2(v.w * 17.0, fk)));
        if (leaf * present > 0.5) {
          vec3 lc = mix(uPaintA, uPaintB, hash12(vec2(v.w * 31.0)));
          lc *= (0.5 + 0.17 * fk) * (0.85 + 0.3 * (1.0 - shape * 1.6));
          albedo = lc;
          height = 0.004 + fk * 0.004 * (1.0 - shape);
        }
      }
      rough = 0.75;
      metal = 0.0;
      alpha = 1.0;
    }`,
  vegGround: /* glsl */ `
    // Ground cover on transparent cards (u across, v up), several plants per card.
    // uVegP.x: 0 meadow grass, 1 dry grass with seed heads, 2 ripe wheat, 3 bracken,
    // 4 meadow flowers (daisies, buttercups), 5 poppies and cornflowers, 6 tall rough
    // grass, 7 low weeds. uVegP.y: blades/stalks per card. uPaintA: tips, uPaintB: base.
    uniform vec4 uVegP;
    float vegSeg(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
      return length(pa - ba * h);
    }
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float kind = uVegP.x;
      int N = int(uVegP.y + 0.5);
      alpha = 0.0;
      height = 0.0;
      metal = 0.0;
      rough = 0.82;
      albedo = mix(uPaintA, uPaintB, 0.6);
      bool wheat = kind > 1.5 && kind < 2.5;
      if (kind > 2.5 && kind < 3.5) {
        // Bracken: fronds arching out from the middle, pinnae on both sides.
        for (int k = 0; k < 6; k++) {
          float fk = float(k);
          vec3 h = hash32(vec2(fk * 3.1, 41.0));
          float a0 = -1.1 + 2.2 * (fk + 0.5) / 6.0 + (h.x - 0.5) * 0.3;
          float len = 0.42 + 0.2 * h.y;
          float droop = (a0 < 0.0 ? -1.0 : 1.0) * (0.5 + 0.6 * h.z);
          vec2 base = vec2(0.5 + (h.x - 0.5) * 0.12, 0.0);
          vec2 prev = base;
          for (int i = 0; i < 14; i++) {
            float t = (float(i) + 1.0) / 14.0;
            vec2 P = base + vec2(sin(a0 + droop * t * t * 0.5), cos(a0 + droop * t * t * 0.5)) * len * t;
            vec2 dir = normalize(P - prev);
            if (vegSeg(uv, prev, P) < 0.005 * (1.2 - t)) {
              albedo = uPaintB * 0.8;
              alpha = 1.0;
              height = 0.002;
            }
            float pl = 0.11 * pow(1.0 - t, 0.6) + 0.012;
            for (int s = 0; s < 2; s++) {
              float sd = s == 0 ? 1.0 : -1.0;
              vec2 pd = normalize(vec2(dir.y, -dir.x) * sd + dir * 0.5);
              vec2 rel = uv - P;
              vec2 q = vec2(dot(rel, vec2(pd.y, -pd.x)), dot(rel, pd)) / pl;
              if (q.y > 0.0 && q.y < 1.0) {
                float hw = 0.22 * pow(sin(3.14159 * q.y), 0.6) * (0.62 + 0.38 * abs(sin(q.y * 22.0)));
                if (abs(q.x) < hw) {
                  albedo = mix(uPaintB, uPaintA, 0.35 + 0.65 * q.y) * (0.8 + 0.3 * hash12(vec2(fk * 17.0 + float(i), float(s))));
                  alpha = 1.0;
                  height = 0.002 + 0.001 * q.y;
                }
              }
            }
            prev = P;
          }
        }
        rough = 0.75;
        return;
      }
      for (int k = 0; k < 64; k++) {
        if (k >= N) break;
        float fk = float(k);
        vec3 h = hash32(vec2(fk * 1.37 + kind * 11.0, 7.0));
        vec3 h2 = hash32(vec2(fk * 2.11 + kind * 5.0, 13.0));
        float x0 = 0.06 + 0.88 * h.x;
        float tall;
        float lean;
        float w0;
        if (wheat) {
          tall = 0.8 + 0.12 * h.y;
          lean = (h.z - 0.5) * 0.1;
          w0 = 0.0055;
        } else if (kind > 6.5) {
          tall = 0.22 + 0.25 * h.y;
          lean = (h.z - 0.5) * 0.9;
          w0 = 0.035;
        } else {
          tall = (kind > 5.5 ? 0.6 : 0.42) + 0.5 * h.y;
          lean = (h.z - 0.5) * 0.5;
          w0 = 0.011 + 0.008 * h2.x;
        }
        tall = min(tall, 0.9);
        vec2 top = vec2(x0 + lean, tall);
        if (wheat) {
          // The ear: rows of grains, short awns above.
          vec2 ec = top + vec2(lean * 0.05, 0.02);
          vec2 rel = (uv - ec) / vec2(0.02, 0.07);
          float er = length(rel);
          if (er < 1.0) {
            float grain = abs(fract(rel.y * 4.5 + (rel.x > 0.0 ? 0.25 : 0.0)) - 0.5);
            albedo = mix(uPaintA, uPaintA * 0.7, smoothstep(0.1, 0.5, grain)) * (0.85 + 0.3 * h2.y) * (1.0 - 0.2 * er);
            alpha = 1.0;
            height = 0.004 * (1.0 - er);
            continue;
          }
          if (h2.z > 0.5) {
            for (int a = 0; a < 3; a++) {
              float fa = float(a) - 1.0;
              if (vegSeg(uv, ec + vec2(fa * 0.01, 0.05), ec + vec2(fa * 0.025 + lean * 0.05, 0.1)) < 0.0015) {
                albedo = uPaintA * 1.05;
                alpha = 1.0;
                height = 0.001;
              }
            }
          }
        } else if (((kind > 0.5 && kind < 1.5) || (kind > 5.5 && kind < 6.5)) && h2.z > 0.55) {
          // Seed head: a loose spike at the tip.
          vec2 rel = (uv - top - vec2(lean * 0.06, 0.03)) / vec2(0.016, 0.06);
          if (length(rel) < 1.0 && hash12(floor(uv * uSize * 0.5)) > 0.3) {
            albedo = mix(uPaintA, srgb(vec3(0.55, 0.47, 0.3)), 0.6) * (0.8 + 0.3 * h2.y);
            alpha = 1.0;
            height = 0.002;
          }
        }
        float y = uv.y / tall;
        if (y > 1.0) continue;
        float cx = x0 + lean * y * y;
        float w = wheat ? w0 : w0 * (1.0 - y) + 0.0015;
        if (kind > 6.5) w = w0 * pow(sin(3.14159 * y), 0.6);
        if (abs(uv.x - cx) < w) {
          float sh = 0.85 + 0.3 * h2.y;
          albedo = (wheat ? mix(uPaintB, uPaintA * 0.92, 0.5 + 0.5 * y) : mix(uPaintB, uPaintA, pow(y, 0.8))) * sh;
          alpha = 1.0;
          height = 0.0015 * (1.0 - abs(uv.x - cx) / w);
        }
      }
      if (kind > 3.5 && kind < 5.5) {
        // Flowers on thin stems.
        for (int f = 0; f < 7; f++) {
          float ff = float(f);
          vec3 h = hash32(vec2(ff * 5.3 + kind, 29.0));
          vec2 c = vec2(0.12 + 0.76 * h.x, 0.45 + 0.42 * h.y);
          if (vegSeg(uv, vec2(c.x + (h.z - 0.5) * 0.08, 0.0), c) < 0.0025) {
            albedo = uPaintB * 1.1;
            alpha = 1.0;
          }
          float type = hash12(vec2(ff, kind * 3.0));
          vec3 petal;
          vec3 mid;
          float rad;
          float lobeN;
          if (kind < 4.5) {
            petal = type < 0.6 ? srgb(vec3(0.92, 0.92, 0.88)) : srgb(vec3(0.95, 0.82, 0.18));
            mid = srgb(vec3(0.9, 0.7, 0.12));
            rad = type < 0.6 ? 0.04 : 0.028;
            lobeN = 6.0;
          } else {
            petal = type < 0.65 ? srgb(vec3(0.76, 0.09, 0.05)) : srgb(vec3(0.24, 0.36, 0.82));
            mid = type < 0.65 ? srgb(vec3(0.08, 0.06, 0.06)) : petal * 0.6;
            rad = type < 0.65 ? 0.05 : 0.035;
            lobeN = type < 0.65 ? 2.0 : 6.0;
          }
          vec2 rp = (uv - c) / vec2(1.0, 1.15);
          float r = length(rp);
          float ang = atan(rp.y, rp.x);
          if (r < rad * (0.8 + 0.2 * abs(cos(ang * lobeN)))) {
            albedo = r < rad * 0.28 ? mid : petal * (0.85 + 0.15 * (1.0 - r / rad));
            alpha = 1.0;
            height = 0.002;
            rough = 0.6;
          }
        }
      }
    }`,
};
