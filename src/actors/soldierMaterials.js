// Materials of the soldiers: procedural textures for the fabrics, leather,
// painted steel, skin and camouflage of 1944 uniforms, registered with the
// texture library, baked side by side into one atlas, and a single material
// that picks each vertex's texture cell (so a whole soldier draws in one or two
// calls). Vertex colors carry the real colors; the neutral textures average
// about 0.5 and add weave, grain, wear and normal detail. The camouflage cells
// carry their own colors (paint those parts mid-grey).
import * as THREE from 'three';
import { addMaterials, PRESETS } from '../render/textures.js';
import { addPatch, after, replace } from '../render/materialPatch.js';

// Texture cells of the atlas.
export const CELL = {
  wool: 0, // wool serge (2/2 twill): trousers, tunics, shirts, greatcoats
  cotton: 1, // cotton poplin / sateen / drill: field jackets, gymnastyorka, jump suits
  hbt: 2, // herringbone twill: fatigues, coveralls, Drillich
  duck: 3, // cotton duck canvas: leggings, gaiters, bags, covers
  webbing: 4, // woven cotton webbing: belts, straps, pouches (US)
  knit: 5, // rib knit: tanker jacket cuffs, collars, sweaters
  leather: 6, // smooth leather: boots, belts, pouches, holsters, chin straps
  suede: 7, // rough-out leather: US service shoes
  paint: 8, // painted steel with grit and chips: helmets, canteens, cans
  metal: 9, // small metal parts: buttons, buckles, D-rings, rivets
  skin: 10,
  hair: 11,
  splinter: 12, // German Splittertarn (own colors)
  waterCamo: 13, // German Sumpftarn 1943 (own colors)
  amoeba: 14, // Soviet amoeba (MKK) camouflage (own colors)
  burlap: 15, // hessian scrim
  wrinkle: 16, // folds and creases of worn cloth (a coarser layer over the cloth cells)
  hand: 17, // bare hands, painted in a fixed layout (soldierHead.buildHand sets the UVs)
};
// Mid-grey vertex color for cells with their own colors (x2 in the material = 1).
export const CAMO_GREY = new THREE.Color(0.5, 0.5, 0.5);

const GLSL = {
  soldierWool: /* glsl */ `
    // Wool serge, 2/2 twill: diagonal ribs (about 1 mm on real serge, drawn at 1.9 mm so a
    // 256 px bake still resolves them), fiber fuzz, pilling, mottling.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float wob = fbm(uv, vec2(24.0), 3, 311.0) * 0.6;
      float rib = 0.5 + 0.5 * sin(((uv.x + uv.y) * 80.0 + wob) * 6.2831853);
      float fuzz = fbm01(uv, vec2(48.0), 2, 312.0);
      float mott = fbm01(uv, vec2(5.0), 4, 313.0);
      float pill = smoothstep(0.72, 0.9, fbm01(uv, vec2(40.0), 3, 314.0));
      float a = (0.97 + 0.03 * rib) * (0.88 + 0.24 * fuzz) * (0.9 + 0.2 * mott) * (1.0 + 0.06 * pill);
      albedo = vec3(0.5 * a / 0.96);
      rough = 0.88 + 0.1 * fuzz;
      metal = 0.0;
      height = rib * 0.00006 + fuzz * 0.00014 + pill * 0.0002;
      alpha = 1.0;
    }`,
  soldierCotton: /* glsl */ `
    // Cotton poplin / drill: fine plain weave, slubs along the warp, mottling.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = uv * 90.0;
      vec2 f = fract(p);
      float chk = mod(floor(p.x) + floor(p.y), 2.0);
      float warp = sin(3.14159 * f.x) * (0.7 + 0.3 * sin(3.14159 * f.y));
      float weft = sin(3.14159 * f.y) * (0.7 + 0.3 * sin(3.14159 * f.x));
      float w = mix(weft, warp, chk);
      float slub = fbm01(uv, vec2(8.0, 64.0), 3, 322.0);
      float mott = fbm01(uv, vec2(5.0), 4, 323.0);
      float a = (0.97 + 0.04 * w) * (0.9 + 0.2 * slub) * (0.9 + 0.2 * mott);
      albedo = vec3(0.5 * a / 0.99);
      rough = 0.8 + 0.12 * slub;
      metal = 0.0;
      height = w * 0.00003 + slub * 0.00014 + mott * 0.0002;
      alpha = 1.0;
    }`,
  soldierHBT: /* glsl */ `
    // Herringbone twill: diagonal ribs reversing in 4.5 mm columns.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float cols = 40.0;
      float c = floor(uv.x * cols);
      float dir = mod(c, 2.0) * 2.0 - 1.0;
      float lx = fract(uv.x * cols);
      float rib = 0.5 + 0.5 * sin((uv.y + dir * uv.x) * 110.0 * 6.2831853);
      float edge = smoothstep(0.0, 0.08, lx) * smoothstep(1.0, 0.92, lx);
      float mott = fbm01(uv, vec2(5.0), 4, 333.0);
      float fuzz = fbm01(uv, vec2(48.0), 2, 332.0);
      float a = (0.8 + 0.2 * rib) * (0.9 + 0.1 * edge) * (0.9 + 0.2 * mott) * (0.94 + 0.12 * fuzz);
      albedo = vec3(0.5 * a / 0.88);
      rough = 0.86 + 0.08 * fuzz;
      metal = 0.0;
      height = rib * 0.0002 * edge + fuzz * 0.0001;
      alpha = 1.0;
    }`,
  soldierDuck: /* glsl */ `
    // Cotton duck canvas: coarse plain weave of about 1.3 mm threads.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = uv * 110.0;
      vec2 f = fract(p);
      float chk = mod(floor(p.x) + floor(p.y), 2.0);
      float warp = sin(3.14159 * f.x) * (0.6 + 0.4 * sin(3.14159 * f.y));
      float weft = sin(3.14159 * f.y) * (0.6 + 0.4 * sin(3.14159 * f.x));
      float h = mix(weft, warp, chk);
      float slub = fbm01(uv, vec2(12.0, 90.0), 3, 342.0);
      float mott = fbm01(uv, vec2(6.0), 4, 343.0);
      float a = (0.74 + 0.32 * h) * (0.9 + 0.18 * slub) * (0.88 + 0.24 * mott);
      albedo = vec3(0.5 * a / 0.9);
      rough = 0.92;
      metal = 0.0;
      height = h * 0.0003 + slub * 0.0001;
      alpha = 1.0;
    }`,
  soldierWebbing: /* glsl */ `
    // Woven cotton webbing: ribs along the strap (v), picks across.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = vec2(uv.x * 70.0, uv.y * 140.0);
      float rib = 0.5 + 0.5 * sin(p.x * 6.2831853);
      float pick = 0.5 + 0.5 * sin((p.y + floor(p.x) * 0.5) * 6.2831853);
      float h = rib * (0.7 + 0.3 * pick);
      float mott = fbm01(uv, vec2(4.0, 8.0), 4, 352.0);
      float fuzz = fbm01(uv, vec2(60.0), 3, 353.0);
      float a = (0.76 + 0.3 * h) * (0.88 + 0.24 * mott) * (0.95 + 0.1 * fuzz);
      albedo = vec3(0.5 * a / 0.92);
      rough = 0.9;
      metal = 0.0;
      height = h * 0.00035;
      alpha = 1.0;
    }`,
  soldierKnit: /* glsl */ `
    // 1x1 rib knit: raised wales of V-shaped stitches.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = vec2(uv.x * 36.0, uv.y * 60.0);
      float col = fract(p.x);
      float rib = smoothstep(0.0, 0.25, col) * smoothstep(1.0, 0.75, col);
      float v = fract(p.y + abs(col - 0.5) * 1.2);
      float st = smoothstep(0.0, 0.3, v) * smoothstep(1.0, 0.6, v);
      float h = rib * (0.6 + 0.4 * st);
      float mott = fbm01(uv, vec2(5.0), 4, 362.0);
      float a = (0.62 + 0.45 * h) * (0.92 + 0.16 * mott);
      albedo = vec3(0.5 * a / 0.9);
      rough = 0.95;
      metal = 0.0;
      height = h * 0.0007;
      alpha = 1.0;
    }`,
  soldierLeather: /* glsl */ `
    // Smooth leather: fine grain, pores, creases, scuffs (boots, belts, pouches).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float grain = fbm01(uv, vec2(80.0), 2, 371.0);
      float pores = vnoise(uv * 160.0, vec2(160.0), 372.0);
      float crease = ridged(uv, vec2(5.0, 12.0), 4, 373.0);
      float cr = smoothstep(0.74, 0.98, crease);
      float scuff = smoothstep(0.62, 0.86, fbm01(uv, vec2(9.0), 5, 374.0));
      float big = fbm01(uv, vec2(3.0), 4, 375.0);
      float a = (0.92 + 0.12 * grain) * (0.84 + 0.32 * big) * (1.0 - 0.1 * cr) * (1.0 + 0.35 * scuff);
      albedo = vec3(0.5 * a / 1.05);
      rough = 0.46 + 0.14 * grain + 0.28 * scuff + 0.06 * cr;
      metal = 0.0;
      height = grain * 0.0002 + pores * 0.0001 - cr * 0.00025;
      alpha = 1.0;
    }`,
  soldierSuede: /* glsl */ `
    // Rough-out (flesh side out) leather with dubbing: fuzzy, blotchy, matte.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float fuzz = fbm01(uv, vec2(80.0), 2, 381.0);
      float nap = vnoise(uv * vec2(160.0, 60.0), vec2(160.0, 60.0), 382.0);
      float blot = fbm01(uv, vec2(7.0), 4, 383.0);
      float crease = smoothstep(0.78, 0.98, ridged(uv, vec2(4.0, 10.0), 3, 384.0));
      float a = (0.78 + 0.3 * fuzz) * (0.92 + 0.12 * nap) * (0.8 + 0.4 * blot) * (1.0 - 0.25 * crease);
      albedo = vec3(0.5 * a / 0.95);
      rough = 0.9 + 0.08 * fuzz;
      metal = 0.0;
      height = fuzz * 0.0003 - crease * 0.0004;
      alpha = 1.0;
    }`,
  soldierPaint: /* glsl */ `
    // Painted steel with a gritty (sand or cork) finish, chips and scratches.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float sand = fbm01(uv, vec2(96.0), 2, 391.0);
      float grit = smoothstep(0.55, 0.85, vnoise(uv * 150.0, vec2(150.0), 392.0));
      float big = fbm01(uv, vec2(4.0), 4, 393.0);
      float chip = smoothstep(0.76, 0.79, fbm01(uv, vec2(12.0), 6, 394.0));
      float sw = fbm(uv, vec2(3.0), 3, 395.0);
      float scratch = smoothstep(0.992, 1.0, sin((uv.x * 3.0 + uv.y * 7.0 + sw * 2.0) * 6.2831853 * 9.0)) * step(0.6, fbm01(uv, vec2(6.0), 3, 396.0));
      float a = (0.86 + 0.16 * sand) * (0.88 + 0.24 * big) * (1.0 + 0.1 * grit);
      vec3 paint = vec3(0.5 * a / 0.98);
      vec3 steel = vec3(0.17, 0.165, 0.16);
      albedo = mix(paint, steel, max(chip, scratch * 0.8));
      rough = mix(0.72 + 0.14 * sand, 0.42, max(chip, scratch));
      metal = max(chip, scratch) * 0.7;
      height = sand * 0.00025 + grit * 0.0002 - chip * 0.00025;
      alpha = 1.0;
    }`,
  soldierMetal: /* glsl */ `
    // Small metal parts: stamped steel, brass or aluminum, worn bright on the edges.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float fine = fbm01(uv, vec2(80.0), 3, 401.0);
      float wear = smoothstep(0.55, 0.8, fbm01(uv, vec2(10.0), 4, 402.0));
      albedo = vec3(0.5) * (0.9 + 0.2 * fine) * (1.0 + 0.2 * wear);
      rough = mix(0.5, 0.3, wear) + fine * 0.08;
      metal = mix(0.55, 0.9, wear);
      height = fine * 0.0001;
      alpha = 1.0;
    }`,
  soldierSkin: /* glsl */ `
    // Skin: pores, fine mottling and blotches.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float pore = smoothstep(0.72, 0.95, vnoise(uv * 180.0, vec2(180.0), 411.0));
      float fine = fbm01(uv, vec2(60.0), 3, 412.0);
      float mott = fbm01(uv, vec2(6.0), 4, 413.0);
      float blot = fbm01(uv, vec2(14.0), 3, 414.0);
      albedo = vec3(0.5) * (0.95 + 0.08 * fine) * (0.94 + 0.12 * mott) * vec3(1.0, 0.985 + 0.03 * blot, 0.975 + 0.04 * blot) * (1.0 - 0.07 * pore);
      rough = 0.5 + 0.14 * fine + 0.1 * pore;
      metal = 0.0;
      height = -pore * 0.00007 + fine * 0.00005;
      alpha = 1.0;
    }`,
  soldierHair: /* glsl */ `
    // Short hair: strands along v.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float strands = vnoise(vec2(uv.x * 160.0, uv.y * 12.0), vec2(160.0, 12.0), 421.0);
      float s2 = vnoise(vec2(uv.x * 320.0, uv.y * 30.0), vec2(320.0, 30.0), 422.0);
      float clump = fbm01(uv, vec2(10.0), 3, 423.0);
      albedo = vec3(0.5) * (0.7 + 0.35 * strands + 0.15 * s2) * (0.9 + 0.2 * clump) / 0.97;
      rough = 0.55 + 0.2 * s2;
      metal = 0.0;
      height = (strands * 0.6 + s2 * 0.4) * 0.0004;
      alpha = 1.0;
    }`,
  soldierSplinter: /* glsl */ `
    // German Splittertarn (1931): angular green and brown patches on a tan-grey
    // base, with short dark green rain strokes. Tile = 0.6 m.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 q = vec2(uv.x + uv.y, uv.y);
      vec3 v1 = voronoi(q, vec2(4.0, 6.0), 1.0, 431.0);
      vec3 v2 = voronoi(q + vec2(0.37, 0.11), vec2(5.0, 4.0), 1.0, 432.0);
      vec3 base = srgb(vec3(0.6, 0.57, 0.46));
      vec3 green = srgb(vec3(0.34, 0.39, 0.27));
      vec3 brown = srgb(vec3(0.42, 0.33, 0.23));
      vec3 c = base;
      if (v1.z < 0.34) c = green;
      else if (v1.z < 0.56) c = brown;
      if (v2.z < 0.18) c = green;
      float col = floor(uv.x * 90.0);
      float r = fract(uv.x * 90.0);
      float line = smoothstep(0.3, 0.42, r) * smoothstep(0.7, 0.58, r);
      float dash = step(0.55, hash12(vec2(col, floor(uv.y * 26.0)) + 3.7));
      c = mix(c, srgb(vec3(0.21, 0.27, 0.19)), line * dash * 0.9);
      vec2 p = uv * 200.0;
      float w = 0.5 + 0.5 * sin(p.x * 6.2831853) * sin(p.y * 6.2831853);
      float mott = fbm01(uv, vec2(8.0), 4, 433.0);
      albedo = c * (0.97 + 0.04 * w) * (0.92 + 0.16 * mott);
      rough = 0.85;
      metal = 0.0;
      height = w * 0.0001 + mott * 0.0002;
      alpha = 1.0;
    }`,
  soldierWaterCamo: /* glsl */ `
    // German Sumpftarn (1943): soft brown and green blotches on light tan, rain strokes.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float n1 = fbm01(uv, vec2(6.0), 5, 441.0);
      float n2 = fbm01(uv, vec2(7.0), 5, 442.0);
      vec3 c = srgb(vec3(0.67, 0.63, 0.5));
      c = mix(c, srgb(vec3(0.43, 0.46, 0.31)), smoothstep(0.5, 0.58, n1));
      c = mix(c, srgb(vec3(0.5, 0.4, 0.28)), smoothstep(0.54, 0.62, n2) * 0.85);
      float col = floor(uv.x * 100.0);
      float r = fract(uv.x * 100.0);
      float line = smoothstep(0.3, 0.42, r) * smoothstep(0.7, 0.58, r);
      float dash = step(0.6, hash12(vec2(col, floor(uv.y * 30.0)) + 9.1));
      c = mix(c, srgb(vec3(0.33, 0.33, 0.24)), line * dash * 0.7);
      vec2 p = uv * 200.0;
      float w = 0.5 + 0.5 * sin(p.x * 6.2831853) * sin(p.y * 6.2831853);
      albedo = c * (0.97 + 0.04 * w);
      rough = 0.86;
      metal = 0.0;
      height = w * 0.0001;
      alpha = 1.0;
    }`,
  soldierAmoeba: /* glsl */ `
    // Soviet amoeba (MKK) camouflage: dark brown blots on khaki.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float n = fbm01(uv, vec2(5.0), 5, 451.0);
      float n2 = fbm01(uv, vec2(9.0), 4, 452.0);
      vec3 c = mix(srgb(vec3(0.55, 0.52, 0.35)), srgb(vec3(0.3, 0.25, 0.16)), smoothstep(0.55, 0.575, n + (n2 - 0.5) * 0.25));
      vec2 p = uv * 200.0;
      float w = 0.5 + 0.5 * sin(p.x * 6.2831853) * sin(p.y * 6.2831853);
      float mott = fbm01(uv, vec2(8.0), 4, 453.0);
      albedo = c * (0.97 + 0.04 * w) * (0.92 + 0.16 * mott);
      rough = 0.86;
      metal = 0.0;
      height = w * 0.0001 + mott * 0.0002;
      alpha = 1.0;
    }`,
  soldierHand: /* glsl */ `
    // The skin of a bare hand in a fixed layout (buildHand sets the UVs): the
    // palm and the back of the hand in u 0.01-0.49, round the hand from the
    // little-finger edge (0.13 palm, 0.25 thumb edge, 0.37 back) and v from the
    // wrist (0) to the knuckles (1); the five fingers in strips of 0.1 from
    // u 0.5 (thumb first), round the finger (0 pad, 0.5 nail side) and v from
    // the root (0) through the knuckle (0.19) and the joints (0.52, 0.76) to
    // the tip (0.94) and its rounded end. Creases of the palm and the joints, wrinkles over the knuckles,
    // veins on the back, nails with moons and dirty free edges. Sizes from an
    // adult man's hand (est.): palm 10 x 8.5 cm, fingers 1.5-1.9 cm across.
    float hLine(float d, float w) { return exp(-(d * d) / (w * w)); }
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec3 tint = vec3(1.0);
      float h = 0.0;
      float crease = 0.0;
      rough = 0.56;
      if (uv.x < 0.5) {
        float U = clamp((uv.x - 0.01) / 0.48, 0.0, 1.0);
        float V = clamp((uv.y - 0.005) / 0.99, 0.0, 1.0);
        vec2 mm = vec2(U * 200.0, V * 102.0);
        float fine = vnoise(mm * 1.1, vec2(4096.0), 601.0);
        float mott = vnoise(mm * 0.12, vec2(4096.0), 602.0);
        tint *= (0.96 + 0.08 * fine) * (0.94 + 0.12 * mott);
        h += fine * 0.0004;
        float palm = 1.0 - smoothstep(0.17, 0.25, abs(U - 0.25));
        float back = 1.0 - smoothstep(0.17, 0.25, abs(U - 0.75));
        // Palm: the heart line from the little-finger edge toward the gap
        // between index and middle, the head line from the index edge across,
        // the life line round the ball of the thumb, bracelets at the wrist.
        float cU = clamp(U, 0.02, 0.37);
        float lH = hLine((V - (0.72 + 0.4 * cU + 0.04 * sin(cU * 9.0))) * 102.0, 0.75) * smoothstep(0.0, 0.04, U) * smoothstep(0.39, 0.33, U);
        float lHd = hLine((V - (0.6 + 0.12 * (U - 0.1) / 0.37 + 0.02 * sin(U * 14.0))) * 102.0, 0.7) * smoothstep(0.08, 0.16, U) * smoothstep(0.5, 0.45, U);
        float uL = 0.3 + 0.16 * sin(clamp(V / 0.71, 0.0, 1.0) * 1.5708);
        float lL = hLine((U - uL) * 200.0, 0.8) * smoothstep(0.08, 0.2, V) * smoothstep(0.76, 0.68, V);
        float lW = (hLine((V - 0.03) * 102.0, 0.5) + 0.7 * hLine((V - 0.075) * 102.0, 0.45)) * smoothstep(0.06, 0.12, U) * smoothstep(0.44, 0.38, U);
        float fl = smoothstep(0.62, 0.9, vnoise(vec2(mm.x * 0.35, mm.y * 1.4), vec2(4096.0), 603.0));
        crease += palm * (max(max(lH, lHd), max(lL, lW)) + fl * 0.18);
        tint *= mix(vec3(1.0), vec3(1.04, 0.97, 0.95), palm * 0.5);
        // Back: veins from the wrist toward the gaps between the knuckles,
        // wrinkles over the knuckles, a fine diamond grain.
        float vein = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float u0 = 0.68 + fi * 0.07 + 0.012 * sin(V * 8.0 + fi * 2.1) + 0.02 * (V - 0.5) * (fi - 1.0);
          vein = max(vein, hLine((U - u0) * 200.0, 1.3) * smoothstep(0.05, 0.25, V) * smoothstep(0.88, 0.7, V));
        }
        tint *= mix(vec3(1.0), vec3(0.84, 0.88, 1.05), vein * 0.6 * back);
        h += vein * back * 0.0015;
        float kw = 0.0;
        for (int i = 0; i < 4; i++) {
          float uk = i == 0 ? 0.663 : i == 1 ? 0.735 : i == 2 ? 0.78 : 0.847;
          vec2 d = vec2((U - uk) * 200.0, (V - 0.97) * 102.0);
          float r = length(d * vec2(1.0, 1.3));
          kw = max(kw, (0.5 + 0.5 * cos(r * 1.9)) * smoothstep(9.0, 3.0, r) * smoothstep(1.5, 3.0, r));
        }
        float dia = abs(sin((mm.x + mm.y) * 2.2)) * abs(sin((mm.x - mm.y) * 2.2));
        crease += back * (kw * 0.6 + (1.0 - dia) * 0.1);
      } else {
        float k = floor((uv.x - 0.5) / 0.1);
        float Uf = clamp(((uv.x - 0.5 - k * 0.1) / 0.1 - 0.01) / 0.98, 0.0, 1.0);
        float V = clamp((uv.y - 0.005) / 0.99, 0.0, 1.0);
        float circ = k < 0.5 ? 53.0 : 48.0;
        vec2 mm = vec2(Uf * circ, V * 110.0);
        float fine = vnoise(mm * 1.2, vec2(4096.0), 611.0 + k);
        tint *= 0.96 + 0.08 * fine;
        h += fine * 0.0003;
        float dp = min(Uf, 1.0 - Uf);
        float pad = 1.0 - smoothstep(0.14, 0.3, dp);
        float dor = 1.0 - smoothstep(0.12, 0.3, abs(Uf - 0.5));
        // Flexion creases under the joints (the thumb has no crease at its root).
        float c = 0.0;
        if (k > 0.5) c = max(c, hLine((V - 0.24) * 110.0, 0.6) + 0.8 * hLine((V - 0.272) * 110.0, 0.5));
        c = max(c, hLine((V - 0.51) * 110.0, 0.6) + 0.8 * hLine((V - 0.535) * 110.0, 0.5));
        c = max(c, hLine((V - 0.755) * 110.0, 0.6));
        crease += pad * min(1.0, c);
        // Wrinkles over the middle and end joints, bowed toward the tip.
        float kj = 0.0;
        for (int j = 0; j < 2; j++) {
          float vc = j == 0 ? 0.52 : 0.76;
          float span = j == 0 ? 7.0 : 4.5;
          vec2 d = vec2((Uf - 0.5) * circ, (V - vc) * 110.0);
          float bow = d.y + 0.012 * d.x * d.x;
          kj = max(kj, (0.5 + 0.5 * cos(bow * 2.4)) * smoothstep(span, span * 0.4, abs(bow)) * smoothstep(9.0, 4.0, abs(d.x)));
        }
        crease += dor * kj * 0.65;
        // The nail: plate, the fold and cuticle round its base, the moon, the free edge.
        float nw = k < 0.5 ? 0.125 : 0.105;
        vec2 nq = vec2((Uf - 0.5) / nw, (V - 0.8925) / 0.0625);
        float nd = pow(pow(abs(nq.x), 3.0) + pow(abs(nq.y), 3.0), 1.0 / 3.0);
        float nail = 1.0 - smoothstep(0.9, 1.0, nd);
        float fold = hLine((nd - 1.0) * 6.0, 0.6) * step(nq.y, 0.3);
        float moon = smoothstep(-0.6, -0.95, nq.y) * nail;
        float edge = smoothstep(0.62, 0.8, nq.y) * nail;
        tint = mix(tint, tint * vec3(1.16, 1.0, 0.98), nail);
        tint = mix(tint, vec3(1.25, 1.18, 1.12), moon * 0.35);
        tint = mix(tint, vec3(1.35, 1.3, 1.2), edge * 0.6);
        tint *= 1.0 - 0.35 * fold;
        tint *= 1.0 - 0.45 * hLine((nq.y - 0.68) * 8.0, 0.7) * nail;
        h += nail * 0.0006 - fold * 0.0004;
        rough = mix(rough, 0.32, nail);
        tint *= mix(vec3(1.0), vec3(1.03, 0.97, 0.95), pad * smoothstep(0.8, 0.93, V));
      }
      float cr = clamp(crease, 0.0, 1.0);
      tint *= 1.0 - 0.5 * cr;
      albedo = vec3(0.5) * tint;
      height = h - cr * 0.0012;
      metal = 0.0;
      alpha = 1.0;
    }`,
  soldierWrinkle: /* glsl */ `
    // Folds and creases of worn cloth, at the scale of a hand so they still read
    // a few meters away: soft ridges running round the limb or body (along u),
    // 2.5 to 4 cm apart, wandering and breaking off, and a few diagonal
    // creases; up to ~4 mm high. The albedo is the cavity (darker in the hollows).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float w1 = fbm(uv, vec2(3.0), 3, 501.0);
      float w2 = fbm(uv, vec2(2.0, 4.0), 2, 502.0);
      float f = 0.5 + 0.5 * sin((uv.y * 10.0 + w1 * 1.8 + w2 * 0.7) * 6.2831853);
      f = pow(f, 2.0);
      float keep = smoothstep(0.4, 0.75, fbm01(uv, vec2(3.0, 5.0), 3, 503.0));
      float dg = 0.5 + 0.5 * sin((uv.x * 2.0 + uv.y * 6.0 + w2 * 0.9) * 6.2831853);
      dg = pow(dg, 5.0) * smoothstep(0.45, 0.75, fbm01(uv, vec2(3.0), 2, 504.0));
      float h = clamp(f * keep + 0.7 * dg, 0.0, 1.2);
      height = h * 0.004;
      albedo = vec3(0.5 * (0.82 + 0.18 * smoothstep(0.0, 0.8, h)) / 0.9);
      rough = 0.9;
      metal = 0.0;
      alpha = 1.0;
    }`,
};

// Presets: [name, glsl material, tile size (m), normal strength].
const CELLS = [
  ['soldierWool', 0.15, 1],
  ['soldierCotton', 0.15, 1],
  ['soldierHBT', 0.18, 1],
  ['soldierDuck', 0.14, 1],
  ['soldierWebbing', 0.1, 1],
  ['soldierKnit', 0.1, 1],
  ['soldierLeather', 0.2, 1],
  ['soldierSuede', 0.15, 1],
  ['soldierPaint', 0.2, 1],
  ['soldierMetal', 0.1, 1],
  ['soldierSkin', 0.1, 0.6],
  ['soldierHair', 0.08, 1],
  ['soldierSplinter', 0.6, 1],
  ['soldierWaterCamo', 0.6, 1],
  ['soldierAmoeba', 0.7, 1],
  ['burlap', null, 1], // the library's own hessian
  ['soldierWrinkle', 0.32, 1],
  ['soldierHand', 1, 1], // one hand per cell
];
const presets = {};
for (const [name, world, ns] of CELLS) {
  if (!GLSL[name]) continue;
  presets[`${name}Tex`] = { mat: name, world, normalScale: ns };
}
if (!PRESETS.soldierWoolTex) addMaterials(GLSL, presets);
export const CELL_PRESETS = CELLS.map(([name]) => (GLSL[name] ? `${name}Tex` : name));
const COLS = 4;
const ROWS = Math.ceil(CELLS.length / COLS);

// ---------------------------------------------------------------------------
// The shader patch: sample the atlas cell of each vertex, tiled by the vertex
// UVs (meters), with explicit gradients so mipmaps follow the tiling and stay
// inside the cell. Skin gets a little light wrap (subsurface scattering, est.),
// and `gloss` makes eyes, lips and polished leather shine.
const VERT_DECL = /* glsl */ `
attribute vec2 soldierMat;
flat varying float vSCell;
varying float vSGloss;
varying vec2 vSUv;
varying float vSCrease;`;
// Crease strength: some everywhere (base), most where the skin weights blend
// between bones (elbows, knees, the waist, armpits, the crotch), where cloth
// bunches. The first-person sleeves, seen from a hand's breadth, get more.
const vertMain = (base) => /* glsl */ `
vSCell = soldierMat.x;
vSGloss = soldierMat.y;
vSUv = uv;
#ifdef USE_SKINNING
  float sMaxW = max( max( skinWeight.x, skinWeight.y ), max( skinWeight.z, skinWeight.w ) );
  vSCrease = ${base.toFixed(2)} + 0.9 * smoothstep( 0.0, 0.3, 1.0 - sMaxW );
#else
  vSCrease = ${base.toFixed(2)};
#endif`;
const FRAG_DECL = /* glsl */ `
uniform vec4 uSCells[${CELLS.length}];
flat varying float vSCell;
varying float vSGloss;
varying vec2 vSUv;
varying float vSCrease;
vec2 sAtlasUv;
vec2 sDx;
vec2 sDy;
vec2 sWrUv;
vec2 sWDx;
vec2 sWDy;
float sSkin = 0.0;
float sCloth = 0.0;
float sCrease = 0.0;`;
// First person only: the gun held in the hands darkens the skin and cloth
// round it (no shadow maps in the view model scene): three capsules in world
// space (fore-end, grip, the stock between them) occlude the light by their
// share of the view from the surface, so the fingers wrapped round the wood
// are dark where they touch it.
const VM_VERT_DECL = /* glsl */ `
varying vec3 vSWPos;`;
const VM_VERT_MAIN = /* glsl */ `
vSWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`;
const VM_FRAG_DECL = /* glsl */ `
uniform vec4 uSOcc[ 6 ];
varying vec3 vSWPos;
float sGunOcclusion( vec3 p, vec3 n ) {
  float vis = 1.0;
  for ( int i = 0; i < 3; i ++ ) {
    vec4 A = uSOcc[ i * 2 ];
    vec4 Bc = uSOcc[ i * 2 + 1 ];
    if ( A.w > 0.0 ) {
      vec3 ab = Bc.xyz - A.xyz;
      float h = clamp( dot( p - A.xyz, ab ) / max( dot( ab, ab ), 1e-8 ), 0.0, 1.0 );
      vec3 d = A.xyz + ab * h - p;
      float l = max( length( d ), 1e-5 );
      float c = max( 0.0, dot( n, d / l ) );
      float k = A.w / max( l, A.w );
      vis *= 1.0 - 0.75 * c * k;
    }
  }
  return vis;
}`;
const VM_FRAG_AO = /* glsl */ `
{
  float sGO = sGunOcclusion( vSWPos, inverseTransformDirection( normal, viewMatrix ) );
  reflectedLight.indirectDiffuse *= sGO;
  reflectedLight.indirectSpecular *= sGO;
  reflectedLight.directDiffuse *= mix( 1.0, sGO, 0.5 );
  reflectedLight.directSpecular *= sGO;
}`;

// (Cells are square in texels; with fewer rows than columns they are shorter
// in v: the cell's v size is its u size times columns / rows.)
const FRAG_MAP = /* glsl */ `
{
  int sc = int( vSCell + 0.5 );
  vec4 cr = uSCells[ sc ];
  vec2 t = vSUv * cr.w;
  float pad = 0.006;
  vec2 csz = vec2( cr.z, cr.z * ${(COLS / ROWS).toFixed(6)} );
  vec2 span = csz * ( 1.0 - 2.0 * pad );
  sAtlasUv = cr.xy + csz * pad + fract( t ) * span;
  vec2 gx = dFdx( t ) * span;
  vec2 gy = dFdy( t ) * span;
  float m = max( length( gx ), length( gy ) );
  float lim = min( csz.x, csz.y ) / 20.0;
  if ( m > lim ) { gx *= lim / m; gy *= lim / m; }
  sDx = gx;
  sDy = gy;
  sSkin = ( sc == 10 || sc == ${CELL.hand} ) ? 1.0 : 0.0;
  sCloth = ( sc <= 5 || ( sc >= 12 && sc <= 15 ) ) ? 1.0 : 0.0;
  diffuseColor *= textureGrad( map, sAtlasUv, sDx, sDy );
  // Dyed wool and cotton reflect little light (uniform cloth ~5-15%, est.):
  // the swatch colors are taken down so a soldier reads darker than sunlit grass.
  diffuseColor.rgb *= 1.0 - 0.28 * sCloth;
  // Skin of men a summer outdoors: a little darker and warmer than the swatch.
  diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.86, 0.79, 0.74 ), sSkin );
  // Folds and creases: a coarser layer on the garment cloths (wool, cotton,
  // herringbone, camouflage; less on canvas and knit).
  // (On skin the same layer, much finer, makes the creases over knuckles and
  // wrists, where the joints bend.)
  vec4 wr = uSCells[ ${CELL.wrinkle} ];
  vec2 wt = vSUv * wr.w * ( sc == 10 ? 7.0 : 1.0 );
  vec2 wsz = vec2( wr.z, wr.z * ${(COLS / ROWS).toFixed(6)} );
  vec2 wspan = wsz * ( 1.0 - 2.0 * pad );
  sWrUv = wr.xy + wsz * pad + fract( wt ) * wspan;
  vec2 wx = dFdx( wt ) * wspan;
  vec2 wy = dFdy( wt ) * wspan;
  float wm = max( length( wx ), length( wy ) );
  if ( wm > lim ) { wx *= lim / wm; wy *= lim / wm; }
  sWDx = wx;
  sWDy = wy;
  float wk = sc <= 2 ? 1.0 : sc == 3 ? 0.6 : sc == 5 ? 0.3 : ( sc >= 12 && sc <= 14 ) ? 1.0 : 0.0;
  sCrease = sc == 10 ? 0.5 * smoothstep( 0.4, 1.0, vSCrease ) : wk * vSCrease; // (the hand cell has its own)
  if ( sCrease > 0.001 ) diffuseColor.rgb *= mix( 1.0, textureGrad( map, sWrUv, sWDx, sWDy ).r * 2.0, min( 1.0, sCrease ) );
}`;

function cellUniforms(atlas) {
  return CELL_PRESETS.map((name, i) => {
    const r = atlas.rect(i);
    const world = PRESETS[name]?.world || 0.5;
    return new THREE.Vector4(r[0], r[1], r[2] - r[0], 1 / world);
  });
}

const MATS = new WeakMap();
const NO_TEX = {};

// The soldier material for a texture library (shared by every soldier).
// textures: TextureLibrary or null (tests: plain vertex colors).
// viewmodel: a separate instance for the first-person scene (not set up for
// the world's cascaded shadows).
export function soldierMaterial(textures, { viewmodel = false, cellSize } = {}) {
  const key = textures || NO_TEX;
  let entry = MATS.get(key);
  if (!entry) MATS.set(key, (entry = {}));
  const which = viewmodel ? 'vm' : 'world';
  if (entry[which]) return entry[which];
  let mat;
  if (!textures || !textures.atlas) {
    mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  } else {
    const size = cellSize || Math.min(512, Math.max(128, (textures.size || 1024) / 2));
    const atlas = textures.atlas('soldiers', CELL_PRESETS, { cols: COLS, cellSize: size });
    mat = new THREE.MeshStandardMaterial({
      map: atlas.map,
      normalMap: atlas.normalMap,
      roughnessMap: atlas.ormMap,
      metalnessMap: atlas.ormMap,
      roughness: 1,
      metalness: 1,
      vertexColors: true,
    });
    // The neutral textures average ~0.5, so vertex colors carry the real colors.
    mat.color.setScalar(2);
    const cells = { value: cellUniforms(atlas) };
    // First person: the gun's occluding capsules, set each frame (FirstPersonArms.place).
    const occ = { value: Array.from({ length: 6 }, () => new THREE.Vector4()) };
    if (viewmodel) mat.userData.gunOcc = occ;
    addPatch(mat, viewmodel ? 'soldier-atlas-vm' : 'soldier-atlas', (shader) => {
      shader.uniforms.uSCells = cells;
      let vs = shader.vertexShader;
      vs = after(vs, '#include <common>', VERT_DECL);
      vs = after(vs, '#include <uv_vertex>', vertMain(viewmodel ? 0.6 : 0.22));
      if (viewmodel) {
        shader.uniforms.uSOcc = occ;
        vs = after(vs, '#include <common>', VM_VERT_DECL);
        vs = after(vs, '#include <worldpos_vertex>', VM_VERT_MAIN);
      }
      shader.vertexShader = vs;
      let fs = shader.fragmentShader;
      fs = after(fs, '#include <common>', FRAG_DECL);
      if (viewmodel) {
        fs = after(fs, '#include <common>', VM_FRAG_DECL);
        fs = after(fs, '#include <aomap_fragment>', VM_FRAG_AO);
        // The player's own hands, a hand's breadth from the eye and never in a
        // shadow map, come out lighter than skin out in the world: a little less.
        // The sleeves, seen from a hand's breadth and without the world's sky and
        // bounce light, keep the cloth's own swatch value (not darkened for distance).
        fs = after(fs, '#include <map_fragment>', 'diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.84, 0.82, 0.8 ), sSkin ) * ( 1.0 + 0.35 * sCloth );');
      }
      fs = replace(fs, '#include <map_fragment>', FRAG_MAP);
      fs = replace(fs, '#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'textureGrad( roughnessMap, sAtlasUv, sDx, sDy )') + '\nroughnessFactor = mix( roughnessFactor, 0.16, vSGloss );');
      fs = replace(fs, '#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment.replace('texture2D( metalnessMap, vMetalnessMapUv )', 'textureGrad( metalnessMap, sAtlasUv, sDx, sDy )'));
      // (replaceAll: the chunk samples the normal map in both its object and tangent space branches.)
      fs = replace(
        fs,
        '#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps
          .replaceAll('texture2D( normalMap, vNormalMapUv )', 'textureGrad( normalMap, sAtlasUv, sDx, sDy )')
          .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;\n\tif ( sCrease > 0.001 ) mapN.xy += ( textureGrad( normalMap, sWrUv, sWDx, sWDy ).xy * 2.0 - 1.0 ) * sCrease;'),
      );
      // Cloth is matte: wool and cotton reflect little and have no glossy rim.
      fs = after(fs, '#include <lights_physical_fragment>', 'material.specularColor *= 1.0 - 0.6 * sCloth;\nmaterial.specularF90 = mix( material.specularF90, 0.3, sCloth );');
      fs = replace(
        fs,
        '#include <lights_physical_pars_fragment>',
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          'vec3 irradiance = dotNL * directLight.color;',
          `vec3 irradiance = dotNL * directLight.color;
	float sWrap = saturate( ( dot( geometryNormal, directLight.direction ) + 0.4 ) / 1.4 );
	irradiance += max( sWrap - dotNL, 0.0 ) * directLight.color * vec3( 0.55, 0.2, 0.12 ) * sSkin;`,
        ),
      );
      shader.fragmentShader = fs;
    });
    mat.userData.atlas = atlas;
  }
  mat.name = viewmodel ? 'soldier:viewmodel' : 'soldier';
  entry[which] = mat;
  return mat;
}
