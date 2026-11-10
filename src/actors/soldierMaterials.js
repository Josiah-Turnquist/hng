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
import { BONE_COUNT } from './soldierRig.js';

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
    // Wool serge, 2/2 twill: diagonal ribs (about 1 mm on real serge, drawn at 1.9 mm and
    // a little stronger than life so they still show a couple of meters away), fibres of
    // slightly different dye (the heathered look of wool cloth), streaks along the yarn,
    // fuzz, pilling and mottling.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float wob = fbm(uv, vec2(24.0), 3, 311.0) * 0.6;
      float rib = 0.5 + 0.5 * sin(((uv.x + uv.y) * 80.0 + wob) * 6.2831853);
      float fuzz = fbm01(uv, vec2(48.0), 2, 312.0);
      float mott = fbm01(uv, vec2(5.0), 4, 313.0);
      float pill = smoothstep(0.72, 0.9, fbm01(uv, vec2(40.0), 3, 314.0));
      float fib = vnoise(uv * 240.0, vec2(240.0), 315.0) * 2.0 - 1.0;
      float streak = fbm01(uv, vec2(36.0, 4.0), 3, 316.0);
      float a = (0.88 + 0.16 * rib) * (0.8 + 0.4 * fuzz) * (0.86 + 0.28 * streak) * (0.82 + 0.36 * mott) * (1.0 + 0.1 * pill) * (1.0 + 0.08 * fib);
      albedo = vec3(0.5 * a / 0.97) * vec3(1.0 + 0.05 * fib, 1.0, 1.0 - 0.05 * fib);
      rough = 0.9 + 0.08 * fuzz;
      metal = 0.0;
      height = rib * 0.00012 + fuzz * 0.00014 + pill * 0.0002 + streak * 0.00008;
      alpha = 1.0;
    }`,
  soldierCotton: /* glsl */ `
    // Cotton poplin / drill: fine plain weave (drawn a little coarser and stronger than
    // life so it shows), slubs along the warp, faded fibres, mottling.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = uv * 90.0;
      vec2 f = fract(p);
      float chk = mod(floor(p.x) + floor(p.y), 2.0);
      float warp = sin(3.14159 * f.x) * (0.7 + 0.3 * sin(3.14159 * f.y));
      float weft = sin(3.14159 * f.y) * (0.7 + 0.3 * sin(3.14159 * f.x));
      float w = mix(weft, warp, chk);
      float slub = fbm01(uv, vec2(8.0, 64.0), 3, 322.0);
      float mott = fbm01(uv, vec2(5.0), 4, 323.0);
      float fib = vnoise(uv * 200.0, vec2(200.0), 324.0) * 2.0 - 1.0;
      float a = (0.86 + 0.2 * w) * (0.84 + 0.32 * slub) * (0.84 + 0.32 * mott) * (1.0 + 0.06 * fib);
      albedo = vec3(0.5 * a / 0.97) * vec3(1.0 + 0.03 * fib, 1.0, 1.0 - 0.04 * fib);
      rough = 0.86 + 0.1 * slub;
      metal = 0.0;
      height = w * 0.00006 + slub * 0.00014 + mott * 0.0002;
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
    // Woven cotton webbing: ribs along the strap (v), picks across, loose fibres and
    // dirty, darker patches where hands and sweat have rubbed.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = vec2(uv.x * 70.0, uv.y * 140.0);
      float rib = 0.5 + 0.5 * sin(p.x * 6.2831853);
      float pick = 0.5 + 0.5 * sin((p.y + floor(p.x) * 0.5) * 6.2831853);
      float h = rib * (0.7 + 0.3 * pick);
      float mott = fbm01(uv, vec2(4.0, 8.0), 4, 352.0);
      float fuzz = fbm01(uv, vec2(60.0), 3, 353.0);
      float stain = smoothstep(0.55, 0.8, fbm01(uv, vec2(5.0, 9.0), 4, 354.0));
      float a = (0.72 + 0.36 * h) * (0.86 + 0.28 * mott) * (0.94 + 0.12 * fuzz) * (1.0 - 0.22 * stain);
      albedo = vec3(0.5 * a / 0.88);
      rough = 0.9 - 0.08 * stain;
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
    // Smooth leather: pebbled grain, pores, creases, scuffs that show the paler
    // leather under the finish, blotches of dubbin and polish (boots, belts, pouches).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float grain = fbm01(uv, vec2(80.0), 2, 371.0);
      vec3 peb = voronoi(uv, vec2(120.0), 0.9, 376.0);
      float pebble = smoothstep(0.0, 0.18, peb.y - peb.x);
      float pores = vnoise(uv * 160.0, vec2(160.0), 372.0);
      float crease = ridged(uv, vec2(5.0, 12.0), 4, 373.0);
      float cr = smoothstep(0.7, 0.98, crease);
      float scuff = smoothstep(0.6, 0.84, fbm01(uv, vec2(9.0), 5, 374.0));
      float scratch = smoothstep(0.985, 1.0, sin((uv.x * 5.0 - uv.y * 3.0 + fbm(uv, vec2(4.0), 2, 377.0)) * 6.2831853 * 14.0)) * step(0.55, fbm01(uv, vec2(7.0), 3, 378.0));
      float big = fbm01(uv, vec2(3.0), 4, 375.0);
      float a = (0.9 + 0.14 * grain) * (0.94 + 0.08 * pebble) * (0.8 + 0.4 * big) * (1.0 - 0.22 * cr) * (1.0 + 0.5 * scuff) * (1.0 + 0.6 * scratch);
      albedo = vec3(0.5 * a / 1.08);
      rough = 0.5 + 0.12 * grain + 0.3 * scuff + 0.1 * cr + 0.1 * (1.0 - pebble);
      metal = 0.0;
      height = grain * 0.0002 + pebble * 0.00012 + pores * 0.0001 - cr * 0.0004 - scratch * 0.00008;
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
      rough = 0.58 + 0.14 * fine + 0.1 * pore;
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
      albedo = vec3(0.5 * (0.74 + 0.26 * smoothstep(0.0, 0.8, h)) / 0.87);
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
flat varying vec2 vSCell;
varying float vSGloss;
varying vec2 vSUv;
varying float vSCrease;
varying vec3 vSBind;
varying vec3 vSBindN;`;
// Crease strength: some everywhere (base), most where the skin weights blend
// between bones (elbows, knees, the waist, armpits, the crotch), where cloth
// bunches. The first-person sleeves, seen from a hand's breadth, get more.
const vertMain = (base) => /* glsl */ `
vSCell = vec2( soldierMat.x, 0.0 );
vSGloss = soldierMat.y;
vSUv = uv;
// The bind pose position and normal: fixed on the body however he moves, so
// the dirt, fading and sweat stay put on the cloth.
vSBind = position;
vSBindN = normal;
#ifdef USE_SKINNING
  // This man's own wear (setSoldierWear): one spare texel after the bones.
  {
    int sSz = textureSize( boneTexture, 0 ).x;
    int sJ = ${BONE_COUNT * 4};
    if ( sJ < sSz * sSz ) vSCell.y = texelFetch( boneTexture, ivec2( sJ % sSz, sJ / sSz ), 0 ).x;
  }
  float sMaxW = max( max( skinWeight.x, skinWeight.y ), max( skinWeight.z, skinWeight.w ) );
  vSCrease = ${base.toFixed(2)} + 0.9 * smoothstep( 0.0, 0.3, 1.0 - sMaxW );
  // On the body (hips, spine, chest: bones 0 to 2) the creases are much
  // fainter than on the limbs: they run round, as cloth bunches at an elbow or
  // knee, and all over a tunic's front they looked like crumpled paper.
  vSCrease *= 1.0 - 0.65 * dot( skinWeight, vec4( lessThan( skinIndex, vec4( 2.5 ) ) ) );
#else
  vSCrease = ${base.toFixed(2)};
#endif`;
// Helpers of the weathering layer (below).
const WEATHER_FUNCS = /* glsl */ `
float sHash3( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.zyx + 31.32 );
  return fract( ( p.x + p.y ) * p.z );
}
// Smooth value noise in 3D, 0..1.
float sNoise3( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  vec2 e = vec2( 1.0, 0.0 );
  return mix(
    mix( mix( sHash3( i ), sHash3( i + e.xyy ), f.x ), mix( sHash3( i + e.yxy ), sHash3( i + e.xxy ), f.x ), f.y ),
    mix( mix( sHash3( i + e.yyx ), sHash3( i + e.xyx ), f.x ), mix( sHash3( i + e.yxx ), sHash3( i + e.xxx ), f.x ), f.y ),
    f.z );
}
// A line of half width w (m) at distance d (m); aa = the change of d over a pixel.
// Smoothed over the pixel, and fainter when it is thinner than a pixel.
float sLine( float d, float w, float aa ) {
  aa = max( aa, 1e-6 );
  return ( 1.0 - smoothstep( w - aa, w + aa, abs( d ) ) ) * min( 1.0, w / aa );
}`;

const FRAG_DECL = /* glsl */ `
uniform vec4 uSCells[${CELLS.length}];
flat varying vec2 vSCell;
varying float vSGloss;
varying vec2 vSUv;
varying float vSCrease;
varying vec3 vSBind;
varying vec3 vSBindN;
vec2 sAtlasUv;
vec2 sDx;
vec2 sDy;
vec2 sWrUv;
vec2 sWDx;
vec2 sWDy;
float sSkin = 0.0;
float sCloth = 0.0;
float sCrease = 0.0;
int sCellI = 0;
float sCav = 1.0; // cavity of the folds and seams (1 = open), darkens the sky light
float sDust = 0.0; // dust on the surface (a dull, pale sheen)
${WEATHER_FUNCS}`;
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


// Field wear, painted per pixel over the textures and vertex colors, from the
// bind pose position and normal (fixed on the body however he moves), so it
// looks the same at every level of detail and reads from 10 to 50 m:
//  - cloth: uneven dye and washing, sun-faded shoulders, upper back and outer
//    sleeves, sweat under the arms and down the spine with a pale rim of salt,
//    grime at the cuffs, the collar, where the hands wipe and on worn edges;
//  - the ground: mud round the boots and splashed up the legs, dust thinning
//    toward the waist, the knees (more on the right, the kneeling knee), the
//    seat, the elbows and the front from lying prone, dust on top surfaces;
//  - leather: matte and dusty, polished toes, darker patches of dubbin, creases
//    round the ankle, paler worn edges; webbing and canvas: dirty dark edges;
//  - seams with their stitching on the uniforms (close up only).
// How dirty, faded and sweaty each man is comes from his own seed (setSoldierWear).
const WEATHER = /* glsl */ `
{
  vec3 P = vSBind;
  vec3 N = normalize( vSBindN );
  float side = P.x < 0.0 ? -1.0 : 1.0;
  float ax = abs( P.x );
  // (Everything that takes a derivative is worked out here, outside the branch.)
  #ifndef FLAT_SHADED
    float sCurv = length( fwidth( vNormal ) ) / max( length( fwidth( vViewPosition ) ), 1e-5 );
  #else
    float sCurv = 0.0;
  #endif
  float edge = smoothstep( 40.0, 160.0, sCurv );
  // Seams: where the surface turns from front to back (trouser outseams and
  // inseams, the side seams of the tunic, the shoulder seams on top, the
  // sleeve seams), and round the armhole. Distance in meters, roughly.
  float sR = P.y < 0.92 ? 0.08 : ( ax > 0.17 && P.y < 1.38 ? 0.05 : 0.14 );
  float seamD = abs( N.z ) * sR;
  if ( P.y > 1.2 && P.y < 1.5 ) seamD = min( seamD, abs( ax - ( 0.165 + ( P.y - 1.32 ) * 0.12 ) ) );
  float seamAA = fwidth( seamD );
  int sc = sCellI;
  float garment = ( sc <= 2 || sc == 5 || ( sc >= 12 && sc <= 14 ) ) ? 1.0 : 0.0;
  float canvas = ( sc == 3 || sc == 4 || sc == 15 ) ? 1.0 : 0.0;
  float leath = ( sc == 6 || sc == 7 ) ? 1.0 : 0.0;
  float paint = sc == 8 ? 1.0 : 0.0;
  float worn = garment + canvas + leath + paint;
  if ( worn > 0.5 ) {
    float sd = vSCell.y;
    float dirt = sd > 0.0 ? 0.45 + 0.55 * fract( sd * 13.17 ) : 0.65;
    float fade = sd > 0.0 ? 0.25 + 0.75 * fract( sd * 7.31 + 0.3 ) : 0.5;
    float sweat = sd > 0.0 ? 0.15 + 0.85 * fract( sd * 3.97 + 0.6 ) : 0.4;
    vec3 so = vec3( 37.1, 11.7, 23.3 ) * fract( sd * 5.3 );
    float n2 = sNoise3( P * 3.0 + so );
    float n1 = sNoise3( P * 8.0 - so );
    // (The finer noise only where it can show: within 25 m.)
    float nf = 0.5;
    float spl = 0.0;
    if ( length( vViewPosition ) < 25.0 ) {
      n1 = n1 * 0.65 + sNoise3( P * 19.0 + so.yzx ) * 0.35;
      nf = sNoise3( P * 55.0 + so.zxy );
      spl = sNoise3( P * 110.0 + so );
    }
    vec3 c = diffuseColor.rgb;
    float L = dot( c, vec3( 0.3, 0.59, 0.11 ) );
    float rT = roughnessFactor;
    float cl = garment + canvas;
    // ---- cloth ----
    // Dye lots, washing and wear: never one flat color over a panel.
    c *= mix( vec3( 1.0 ), ( 0.8 + 0.4 * n2 ) * ( 0.88 + 0.24 * n1 ) * mix( vec3( 1.035, 1.0, 0.94 ), vec3( 0.97, 1.0, 1.04 ), n1 ), cl );
    // Sun: paler and greyer on top of the shoulders, the upper back and the outer sleeves.
    float sun = max( smoothstep( 0.15, 0.85, N.y ) * smoothstep( 1.16, 1.36, P.y ), smoothstep( 0.05, 0.75, N.z ) * smoothstep( 0.95, 1.4, P.y ) * 0.85 );
    sun = max( sun, smoothstep( 0.3, 0.9, N.x * side ) * smoothstep( 0.95, 1.3, P.y ) * 0.5 );
    sun *= fade * ( 0.5 + 0.5 * n2 ) * cl;
    c = mix( c, vec3( L ) * vec3( 1.07, 1.04, 0.92 ) * 1.5 + 0.004, sun * 0.5 );
    // Sweat under the arms and down the spine: darker, a pale rim of salt where it dried.
    float pit = 1.0 - smoothstep( 0.03, 0.11, length( ( P - vec3( side * 0.15, 1.29, 0.015 ) ) * vec3( 1.3, 0.7, 1.1 ) ) + ( n1 - 0.5 ) * 0.06 );
    float spine = ( 1.0 - smoothstep( 0.015, 0.075, ax + ( n1 - 0.5 ) * 0.05 ) ) * smoothstep( 0.2, 0.6, N.z ) * smoothstep( 1.0, 1.12, P.y ) * ( 1.0 - smoothstep( 1.3, 1.45, P.y ) );
    float sw = max( pit, spine * 0.85 ) * garment;
    float wet = smoothstep( 0.25, 0.6, sw ) * sweat;
    float salt = smoothstep( 0.06, 0.2, sw ) * ( 1.0 - smoothstep( 0.2, 0.36, sw ) ) * sweat * smoothstep( 0.35, 0.6, n1 );
    c *= 1.0 - 0.42 * wet;
    c += vec3( 0.018, 0.017, 0.015 ) * salt;
    // Grime: cuffs, collar, where the hands wipe on the thighs, worn edges and hems.
    float cuff = 1.0 - smoothstep( 0.05, 0.13, length( P - vec3( side * 0.212, 0.9, 0.01 ) ) );
    float collar = smoothstep( 1.41, 1.46, P.y ) * ( 1.0 - smoothstep( 0.085, 0.115, length( P.xz - vec2( 0.0, 0.01 ) ) ) );
    float wipe = ( 1.0 - smoothstep( 0.03, 0.11, length( P - vec3( side * 0.16, 0.8, -0.07 ) ) ) ) * 0.6;
    float grime = clamp( max( max( cuff, collar ), wipe ) * ( 0.55 + 0.6 * n1 ) + edge * 0.7, 0.0, 1.0 ) * ( 0.55 + 0.45 * dirt ) * cl;
    c = mix( c, c * vec3( 0.42, 0.4, 0.37 ), grime * 0.85 );
    rT = mix( rT, 0.62, grime * 0.5 );
    // Webbing and canvas: blotchy stains.
    c *= 1.0 - 0.22 * smoothstep( 0.55, 0.8, n1 ) * canvas;
    // Seams: a dark groove, the doubled cloth either side, a row of stitches.
    float sOk = max( 1.0 - smoothstep( 0.55, 0.8, abs( N.y ) ), step( 1.36, P.y ) * step( 0.06, ax ) ) * step( 0.12, P.y ) * garment;
    float groove = sLine( seamD, 0.0008, seamAA ) * sOk;
    float allow = clamp( sLine( seamD, 0.006, seamAA ) * sOk - groove, 0.0, 1.0 );
    float stitch = sLine( seamD - 0.0045, 0.0005, seamAA ) * step( 0.4, fract( ( P.x + P.y + P.z ) * 300.0 ) ) * sOk;
    c *= ( 1.0 - 0.32 * groove ) * ( 1.0 + 0.1 * allow * ( 0.5 + nf ) ) * ( 1.0 - 0.25 * stitch );
    sCav *= 1.0 - 0.4 * groove;
    // ---- leather ----
    float boot = 1.0 - smoothstep( 0.45, 0.55, P.y );
    float toe = smoothstep( -0.1, -0.16, P.z ) * ( 1.0 - smoothstep( 0.1, 0.14, P.y ) );
    float oil = smoothstep( 0.55, 0.75, n2 * 0.5 + n1 * 0.5 );
    // Creases round the ankle (the folds of a jackboot), across the shaft.
    float fold = boot * smoothstep( 0.08, 0.12, P.y ) * ( 1.0 - smoothstep( 0.24, 0.34, P.y ) ) * ( 1.0 - abs( N.y ) );
    float fw = 0.5 + 0.5 * sin( ( P.y + ( n1 - 0.5 ) * 0.025 + ( n2 - 0.5 ) * 0.03 ) * 150.0 );
    float fcr = pow( fw, 6.0 ) * fold;
    float crest = smoothstep( 0.5, 0.0, fw ) * fold;
    vec3 lc = c * ( 1.0 - 0.25 * oil );
    lc = mix( lc, lc * 1.9 + vec3( 0.014, 0.009, 0.005 ), edge * 0.65 );
    lc *= 1.0 - 0.45 * fcr;
    lc = mix( lc, lc * 1.35 + vec3( 0.006, 0.004, 0.002 ), crest * 0.5 );
    c = mix( c, lc, leath );
    float lr = mix( 0.74, 0.52, oil );
    lr = mix( lr, 0.3, toe );
    lr = mix( lr, 0.9, min( 1.0, edge * 0.6 + fcr * 0.5 ) );
    rT = mix( rT, clamp( lr + ( roughnessFactor - 0.65 ) * 0.5, 0.0, 1.0 ), leath );
    // ---- the ground ----
    // Mud: a band from the soles with a ragged top, thicker in places, and
    // small splashes above it.
    float mudLine = 0.05 + 0.17 * dirt + 0.06 * ( n2 - 0.5 );
    float mudTop = mudLine + ( n1 - 0.5 ) * 0.1 + ( nf - 0.5 ) * 0.04;
    float mud = ( 1.0 - smoothstep( mudTop - 0.05, mudTop, P.y ) ) * ( 0.55 + 0.45 * smoothstep( 0.3, 0.7, n1 ) );
    float splash = smoothstep( 0.8, 0.86, spl ) * ( 1.0 - smoothstep( mudLine, mudLine + 0.35, P.y ) );
    mud = max( mud, splash * 0.8 ) * ( 0.5 + 0.5 * dirt );
    // (On leather, wiped and polished: caked only round the welt, patchy above.)
    mud *= mix( 1.0, ( 1.0 - smoothstep( 0.025, 0.06, P.y ) ) * 0.8 + 0.35 * smoothstep( 0.45, 0.75, n1 ) * ( 1.0 - toe ), leath );
    float dust = ( 1.0 - smoothstep( 0.1, 1.0, P.y ) ) * ( 0.3 + 0.7 * n1 ) * dirt * 0.45;
    float knee = ( 1.0 - smoothstep( 0.035, 0.11, length( ( P - vec3( side * 0.1, 0.47, -0.06 ) ) * vec3( 1.0, 0.6, 1.0 ) ) + ( n1 - 0.5 ) * 0.06 ) ) * ( 1.0 - smoothstep( -0.4, 0.2, N.z ) ) * ( side > 0.0 ? 1.0 : 0.65 );
    float seat = ( 1.0 - smoothstep( 0.04, 0.14, length( ( P - vec3( side * 0.075, 0.86, 0.11 ) ) * vec3( 1.0, 0.8, 1.0 ) ) ) ) * smoothstep( -0.2, 0.5, N.z ) * 0.7;
    float elbow = ( 1.0 - smoothstep( 0.03, 0.1, length( P - vec3( side * 0.21, 1.1, 0.05 ) ) + ( n1 - 0.5 ) * 0.05 ) ) * 0.85;
    float prone = smoothstep( -0.2, -0.75, N.z ) * smoothstep( 0.5, 0.62, n2 * 0.6 + n1 * 0.4 ) * step( 0.45, P.y ) * step( P.y, 1.42 ) * 0.55;
    float earth = max( max( knee * 1.3, seat ), max( elbow, prone ) ) * dirt * ( 0.6 + 0.5 * n1 );
    float top = smoothstep( 0.3, 0.95, N.y ) * ( 0.15 + 0.3 * n1 ) * dirt * ( 1.0 - 0.7 * toe );
    float dst = clamp( max( dust + earth, top ), 0.0, 0.85 );
    vec3 dustC = vec3( 0.2, 0.17, 0.13 ) * ( 0.85 + 0.3 * n1 );
    // (Dust clings less to leather, except in the creases and down by the welt.)
    c = mix( c, dustC, dst * mix( 0.75, ( 0.12 + 0.5 * max( fcr, 1.0 - smoothstep( 0.02, 0.08, P.y ) ) ) * ( 1.0 - 0.8 * toe ), leath ) );
    float wetMud = smoothstep( 0.4, 0.75, nf * 0.5 + n1 * 0.5 );
    vec3 mudC = mix( vec3( 0.12, 0.098, 0.072 ), vec3( 0.05, 0.038, 0.027 ), wetMud );
    c = mix( c, mudC, mud * 0.9 );
    rT = mix( rT, 1.0, dst );
    rT = mix( rT, mix( 0.95, 0.5, wetMud ), mud );
    sDust = dst;
    diffuseColor.rgb = c;
    roughnessFactor = rT;
  }
}`;

// (Cells are square in texels; with fewer rows than columns they are shorter
// in v: the cell's v size is its u size times columns / rows.)
const FRAG_MAP = /* glsl */ `
{
  int sc = int( vSCell.x + 0.5 );
  sCellI = sc;
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
  // (Faint on skin: the hands and faces have their shapes in the mesh; strong,
  // it read as scars across the wrists and knuckles.)
  sCrease = sc == 10 ? 0.16 * smoothstep( 0.4, 1.0, vSCrease ) : wk * vSCrease;
  if ( sCrease > 0.001 ) {
    sCav = mix( 1.0, textureGrad( map, sWrUv, sWDx, sWDy ).r * 2.0, min( 1.0, sCrease ) );
    diffuseColor.rgb *= sCav;
  }
}`;

function cellUniforms(atlas) {
  return CELL_PRESETS.map((name, i) => {
    const r = atlas.rect(i);
    const world = PRESETS[name]?.world || 0.5;
    return new THREE.Vector4(r[0], r[1], r[2] - r[0], 1 / world);
  });
}

// Each man's own field wear (how dirty, how faded, how sweaty; and where the
// blotches fall), from his seed. Soldiers with the same kit share their outfit
// geometry and the material, so the value rides in a spare texel of his
// skeleton's bone texture, just after the bone matrices (read once per vertex).
export function setSoldierWear(skeleton, seed) {
  const n = skeleton.bones.length;
  const need = n * 4 + 1;
  let size = Math.max(4, Math.ceil(Math.sqrt(need) / 4) * 4);
  if (!skeleton.boneTexture || skeleton.boneTexture.image.width < size) {
    if (skeleton.boneTexture) size = Math.max(size, skeleton.boneTexture.image.width);
    const data = new Float32Array(size * size * 4);
    data.set(skeleton.boneMatrices.subarray(0, n * 16));
    skeleton.boneTexture?.dispose();
    skeleton.boneMatrices = data;
    skeleton.boneTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  }
  const x = Math.sin(seed * 91.7 + 3.1) * 43758.5453;
  // (Never 0: 0 means "not set" to the shader.)
  skeleton.boneMatrices[n * 16] = 0.02 + 0.97 * (x - Math.floor(x));
  skeleton.boneTexture.needsUpdate = true;
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
      fs = replace(fs, '#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'textureGrad( roughnessMap, sAtlasUv, sDx, sDy )') + '\nroughnessFactor = mix( roughnessFactor, 0.16, vSGloss );\n' + WEATHER);
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
      // Skin: a soft sheen, not a bright edge round the face against the sky.
      // The folds, seams and creases keep out some of the sky light.
      fs = after(fs, '#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= mix( 1.0, sCav, 0.6 );\nreflectedLight.indirectSpecular *= sCav;');
      fs = after(fs, '#include <lights_physical_fragment>', 'material.specularColor *= 1.0 - 0.75 * sCloth - 0.45 * sSkin * ( 1.0 - vSGloss );\nmaterial.specularF90 = mix( material.specularF90, 0.15, sCloth );\nmaterial.specularF90 = mix( material.specularF90, 0.12, sSkin * ( 1.0 - vSGloss ) );');
      fs = replace(
        fs,
        '#include <lights_physical_pars_fragment>',
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          'vec3 irradiance = dotNL * directLight.color;',
          `vec3 irradiance = dotNL * directLight.color;
	float sWrap = saturate( ( dot( geometryNormal, directLight.direction ) + 0.4 ) / 1.4 );
	irradiance += max( sWrap - dotNL, 0.0 ) * directLight.color * vec3( 0.42, 0.2, 0.14 ) * sSkin;
	// Wool and cotton: no glossy highlight but a soft, wide sheen where the
	// cloth turns away from the eye (loose fibres catching the light), a little
	// past the shadow line too; paler on dusty cloth.
	float sNV = saturate( dot( geometryNormal, geometryViewDir ) );
	float sFz = sCloth * pow( 1.0 - sNV, 3.0 ) * saturate( ( dot( geometryNormal, directLight.direction ) + 0.35 ) / 1.35 );
	reflectedLight.directDiffuse += directLight.color * sFz * ( material.diffuseColor * 0.55 + vec3( 0.01 + 0.03 * sDust ) );`,
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
