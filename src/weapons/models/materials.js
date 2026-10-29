// Gun finishes: blued, parkerized and phosphated steel, bright machined steel,
// oiled walnut, stained beech, shellacked birch and laminated stocks, bakelite,
// checkered and grooved grips, leather and webbing slings, painted launchers and
// grenades, stamped and painted markings.
//
// Two layers make a finish:
//  * A small tiling texture baked at load (GLSL below, registered with the texture
//    library): coating grain, polishing lines and scratches on steel; pores, fibers
//    and ray flecks on wood; checkering. Its alpha channel holds a wear noise.
//  * A shader patch on the material (patchGun): edges wear through to bright steel
//    (or lighter, finish-free wood) and grime collects in inside corners, using the
//    surface curvature measured from the screen-space change of the normal; wood
//    gets its growth-ring figure in 3D from the gun-space position, so the rings
//    flow over the curved stock like a carved piece of a log (or show the stacked
//    veneers of a laminated stock).
import * as THREE from 'three';
import { addMaterials } from '../../render/textures.js';
import { addPatch, after } from '../../render/materialPatch.js';

const GLSL = {
  gunFinish: /* glsl */ `
    // Gun steel. u runs along the part (the bore). uPaintA = base color.
    // uPaintB: r = roughness, g = metalness, b = kind (0 blued, 1 parkerized or
    // phosphated, 2 bright machined steel). alpha = wear noise for the shader patch.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float kind = uPaintB.b;
      float mottle = fbm01(uv, vec2(3.0), 4, 311.0);
      float mid = fbm01(uv, vec2(12.0), 4, 312.0);
      float grain = fbm01(uv, vec2(160.0), 2, 313.0);
      float speck = vnoise(uv * 380.0, vec2(380.0), 314.0);
      float lines = vnoise(uv * vec2(4.0, 460.0), vec2(4.0, 460.0), 315.0);
      // Fine scratches: mostly along the part, some diagonal.
      vec2 sp = uv * vec2(20.0, 760.0);
      sp.x += hash12(vec2(mod(floor(sp.y), 760.0), 5.0)) * 20.0;
      float sa = vnoise(sp, vec2(20.0, 760.0), 316.0);
      vec2 dg = vec2(uv.x + uv.y, uv.x - uv.y);
      float sb = vnoise(dg * vec2(26.0, 620.0), vec2(26.0, 620.0), 317.0);
      float scratch = smoothstep(0.955, 0.995, sa) * smoothstep(0.45, 0.7, mid) + smoothstep(0.965, 0.997, sb) * smoothstep(0.5, 0.8, mottle);
      vec3 c = uPaintA;
      float r = uPaintB.r;
      float m = uPaintB.g;
      float h = 0.0;
      if (kind < 0.5) {
        // Bluing: thin oxide over polished steel, slightly uneven in tone, a little
        // brown where it is thin; polishing lines show in the reflections.
        c *= 0.86 + 0.26 * mottle;
        c = mix(c, c * vec3(1.18, 1.02, 0.84), smoothstep(0.62, 0.92, mottle) * 0.55);
        r += (lines - 0.5) * 0.08 + (0.5 - mid) * 0.1;
        h = grain * 0.000012 + lines * 0.000008;
      } else if (kind < 1.5) {
        // Phosphate: matte crystalline coating, darker and smoother where oiled.
        c *= (0.88 + 0.22 * speck) * (0.9 + 0.2 * mottle);
        float oil = smoothstep(0.5, 0.8, mid);
        c *= 1.0 - oil * 0.18;
        r += (speck - 0.5) * 0.12 - oil * 0.2;
        h = speck * 0.00003 + grain * 0.00001;
      } else {
        // Bright machined steel with grinding marks and faint tarnish.
        c *= 0.9 + 0.14 * lines;
        c = mix(c, c * vec3(0.96, 0.86, 0.72), smoothstep(0.62, 0.9, mottle) * 0.45);
        r += lines * 0.1 + grain * 0.05 - 0.05;
        h = lines * 0.00001;
      }
      // Scratches cut through to brighter, smoother steel.
      c = mix(c, vec3(0.42), scratch * 0.5);
      r = mix(r, 0.3, scratch * 0.6);
      m = mix(m, 1.0, scratch * 0.6);
      albedo = c;
      rough = clamp(r, 0.08, 1.0);
      metal = clamp(m, 0.0, 1.0);
      height = h - scratch * 0.000012;
      alpha = fbm01(uv, vec2(7.0), 5, 318.0);
    }`,
  gunWood: /* glsl */ `
    // Stock wood seen along the grain (u = along the fibers): open pores, fiber
    // streaks and an oil or shellac finish. The growth-ring figure is added in 3D
    // by the shader patch. uPaintA = wood color. uPaintB: r = pore strength,
    // g = finish roughness, b = ray flecks (beech).
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float streak = fbm01(uv, vec2(2.0, 20.0), 4, 401.0);
      float fiber = fbm01(uv, vec2(8.0, 260.0), 3, 402.0);
      // Pores and rays: short streaks along the grain. Each row across the grain is
      // shifted at random so their cells do not line up into bands.
      vec2 pc = uv * vec2(60.0, 560.0);
      pc.x += hash12(vec2(mod(floor(pc.y), 560.0), 3.0)) * 60.0;
      float pore = vnoise(pc, vec2(60.0, 560.0), 403.0);
      float pores = smoothstep(0.76, 0.95, pore) * uPaintB.r;
      vec2 rc = uv * vec2(90.0, 300.0);
      rc.x += hash12(vec2(mod(floor(rc.y), 300.0), 9.0)) * 90.0;
      float rayN = vnoise(rc, vec2(90.0, 300.0), 404.0);
      float ray = smoothstep(0.86, 0.96, rayN) * uPaintB.b;
      vec3 c = uPaintA * (0.86 + 0.24 * streak) * (0.94 + 0.12 * fiber);
      c *= 1.0 - pores * 0.42;
      c = mix(c, c * vec3(1.2, 1.12, 1.02), ray * 0.75);
      albedo = c;
      rough = uPaintB.g + pores * 0.16 + (1.0 - fiber) * 0.04 - ray * 0.06;
      metal = 0.0;
      height = fiber * 0.000025 - pores * 0.00004 + ray * 0.00001;
      alpha = fbm01(uv, vec2(6.0), 4, 405.0);
    }`,
  gunBakelite: /* glsl */ `
    // Phenolic resin molded with wood flour: dark red-brown to black, faintly
    // mottled, with a satin sheen. uPaintA = color, uPaintB.r = roughness.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float mottle = fbm01(uv, vec2(5.0), 5, 421.0);
      float fine = fbm01(uv, vec2(90.0), 3, 422.0);
      float flour = smoothstep(0.7, 0.95, vnoise(uv * 300.0, vec2(300.0), 423.0));
      vec3 c = uPaintA * (0.8 + 0.4 * mottle) * (0.95 + 0.1 * fine);
      c = mix(c, c * vec3(1.35, 1.15, 1.0), flour * 0.25);
      albedo = c;
      rough = uPaintB.r + (fine - 0.5) * 0.1 + (0.5 - mottle) * 0.08;
      metal = 0.0;
      height = fine * 0.00001 + mottle * 0.00002;
      alpha = fbm01(uv, vec2(6.0), 4, 424.0);
    }`,
  gunChecker: /* glsl */ `
    // Checkered grip: sharp diamonds cut at 45 degrees (uPaintB.r = lines per
    // tile, an integer). uPaintB.g = roughness, uPaintB.b = 0 wood, 1 molded plastic.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float n = uPaintB.r;
      float a = fract((uv.x + uv.y) * n);
      float b = fract((uv.x - uv.y) * n);
      float ridge = min(min(a, 1.0 - a), min(b, 1.0 - b)) * 2.0; // 0 in the grooves, 1 on the points
      float mottle = fbm01(uv, vec2(4.0), 4, 431.0);
      float fine = fbm01(uv, vec2(40.0, 200.0), 3, 432.0);
      vec3 c = uPaintA * (0.85 + 0.25 * mottle);
      if (uPaintB.b < 0.5) c *= 0.92 + 0.14 * fine;
      c *= 0.55 + 0.45 * smoothstep(0.0, 0.5, ridge); // dirt and shadow in the grooves
      albedo = c;
      rough = uPaintB.g + (1.0 - ridge) * 0.2;
      metal = 0.0;
      height = ridge * 0.0005;
      alpha = fbm01(uv, vec2(6.0), 4, 433.0);
    }`,
  gunGrooved: /* glsl */ `
    // Molded grip with parallel grooves (Walther P38, Tokarev). uPaintB.r = grooves
    // per tile (integer; negative = grooves across u instead of along it),
    // uPaintB.g = roughness.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float n = abs(uPaintB.r);
      float t = uPaintB.r > 0.0 ? uv.y : uv.x;
      float g = fract(t * n);
      float rib = smoothstep(0.0, 0.25, g) * (1.0 - smoothstep(0.75, 1.0, g));
      float mottle = fbm01(uv, vec2(5.0), 4, 441.0);
      vec3 c = uPaintA * (0.82 + 0.3 * mottle);
      c *= 0.6 + 0.4 * rib;
      albedo = c;
      rough = uPaintB.g + (1.0 - rib) * 0.15;
      metal = 0.0;
      height = rib * 0.0006;
      alpha = fbm01(uv, vec2(6.0), 4, 442.0);
    }`,
  gunLeather: /* glsl */ `
    // Sling leather: pebbled grain, creases, darker where handled.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      float grain = fbm01(uv, vec2(120.0), 3, 451.0);
      float pores = vnoise(uv * 340.0, vec2(340.0), 452.0);
      float big = fbm01(uv, vec2(4.0), 4, 453.0);
      float crease = smoothstep(0.75, 1.0, ridged(uv * vec2(1.0, 4.0), vec2(5.0, 20.0), 3, 454.0));
      vec3 c = uPaintA * (0.85 + 0.25 * big) * (0.92 + 0.12 * grain);
      c *= 1.0 - crease * 0.25;
      albedo = c;
      rough = 0.55 + 0.2 * grain - 0.15 * smoothstep(0.6, 0.9, big);
      metal = 0.0;
      height = grain * 0.00012 + pores * 0.00005 - crease * 0.0002;
      alpha = fbm01(uv, vec2(6.0), 4, 455.0);
    }`,
  gunWebbing: /* glsl */ `
    // Woven cotton webbing (US M1 sling): tight plain weave with a ribbed edge look.
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      vec2 p = uv * vec2(260.0, 260.0);
      float warp = sin(p.x * 6.2831853) * 0.5 + 0.5;
      float weft = sin(p.y * 6.2831853) * 0.5 + 0.5;
      float cell = mod(floor(p.x) + floor(p.y), 2.0);
      float weave = mix(warp, weft, cell);
      float big = fbm01(uv, vec2(4.0), 4, 461.0);
      float dirt = smoothstep(0.55, 0.85, fbm01(uv, vec2(3.0), 4, 462.0));
      vec3 c = uPaintA * (0.82 + 0.22 * weave) * (0.88 + 0.22 * big);
      c = mix(c, c * vec3(0.7, 0.66, 0.6), dirt * 0.4);
      albedo = c;
      rough = 0.92;
      metal = 0.0;
      height = weave * 0.00015;
      alpha = fbm01(uv, vec2(6.0), 4, 463.0);
    }`,
};

// Colors are written in sRGB like paint chips (see textures.js) and stored linear.
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const raw = (r, g, b) => new THREE.Color(r, g, b);

const PRESETS = {
  // Steel. b = (roughness, metalness, kind).
  gunBlued: { mat: 'gunFinish', world: 0.15, a: lin(0.3, 0.312, 0.345), b: raw(0.33, 0.9, 0) }, // rust-blued service finish
  gunBluedDark: { mat: 'gunFinish', world: 0.15, a: lin(0.22, 0.228, 0.25), b: raw(0.42, 0.82, 0) }, // wartime Soviet bluing, coarser polish
  gunParkerized: { mat: 'gunFinish', world: 0.15, a: lin(0.2, 0.212, 0.192), b: raw(0.48, 0.38, 1) }, // US manganese phosphate, grey-green, oiled
  gunPhosphate: { mat: 'gunFinish', world: 0.15, a: lin(0.22, 0.225, 0.23), b: raw(0.5, 0.42, 1) }, // German late-war phosphate under black lacquer
  gunBright: { mat: 'gunFinish', world: 0.15, a: lin(0.62, 0.62, 0.61), b: raw(0.3, 1.0, 2) }, // bolts and polished parts "in the white"
  // Wood. b = (pores, finish roughness, ray flecks).
  gunWalnut: { mat: 'gunWood', world: 0.15, a: lin(0.31, 0.19, 0.118), b: raw(0.8, 0.5, 0.0) },
  gunBeech: { mat: 'gunWood', world: 0.15, a: lin(0.37, 0.205, 0.11), b: raw(0.3, 0.46, 0.7) },
  gunBirch: { mat: 'gunWood', world: 0.15, a: lin(0.42, 0.215, 0.1), b: raw(0.2, 0.34, 0.15) }, // shellacked, reddish
  gunLaminate: { mat: 'gunWood', world: 0.15, a: lin(0.32, 0.175, 0.105), b: raw(0.15, 0.44, 0.35) },
  // Molded grips and furniture.
  gunBakelite: { mat: 'gunBakelite', world: 0.15, a: lin(0.17, 0.08, 0.052), b: raw(0.34, 0, 0) },
  gunBakeliteBlack: { mat: 'gunBakelite', world: 0.15, a: lin(0.085, 0.075, 0.07), b: raw(0.34, 0, 0) },
  gunCheckerWalnut: { mat: 'gunChecker', world: 0.05, a: lin(0.36, 0.22, 0.13), b: raw(22, 0.55, 0) }, // about 18 lines per inch
  gunCheckerPlastic: { mat: 'gunChecker', world: 0.05, a: lin(0.17, 0.09, 0.058), b: raw(22, 0.42, 1) }, // M1911A1 brown plastic
  gunGrooved: { mat: 'gunGrooved', world: 0.05, a: lin(0.11, 0.085, 0.07), b: raw(28, 0.4, 0) }, // P38 grooves along the grip
  gunRibbed: { mat: 'gunGrooved', world: 0.05, a: lin(0.09, 0.08, 0.075), b: raw(-26, 0.38, 0) }, // TT-33 vertical ribs
  gunGroovedWalnut: { mat: 'gunGrooved', world: 0.05, a: lin(0.36, 0.21, 0.12), b: raw(-12, 0.5, 0) }, // C96 grip: grooves around it, 4 mm apart
  // Slings.
  gunLeather: { mat: 'gunLeather', world: 0.2, a: lin(0.36, 0.22, 0.12) },
  gunLeatherBlack: { mat: 'gunLeather', world: 0.2, a: lin(0.11, 0.095, 0.085) },
  gunWebbing: { mat: 'gunWebbing', world: 0.1, a: lin(0.46, 0.42, 0.29) },
  gunCanvas: { mat: 'gunWebbing', world: 0.1, a: lin(0.38, 0.36, 0.24) },
  // Paint: the yellow band of a US high-explosive grenade.
  gunPaintYellow: { mat: 'paintedMetal', world: 0.3, a: lin(0.72, 0.6, 0.22), b: lin(0.7, 0.62, 0.4) },
  // Unfinished beech of grenade handles.
  gunBeechRaw: { mat: 'gunWood', world: 0.15, a: lin(0.6, 0.45, 0.29), b: raw(0.3, 0.72, 0.7) },
  // Pale ash or birch under clear varnish: baseball and lapta bats, tool handles.
  gunAsh: { mat: 'gunWood', world: 0.15, a: lin(0.66, 0.52, 0.35), b: raw(0.55, 0.4, 0.2) },
};

addMaterials(GLSL, PRESETS);

// --- Shader patch -------------------------------------------------------------------

const DECL = /* glsl */ `
varying vec3 vGunPos;
float gunH13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float gunNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = gunH13(i), b = gunH13(i + vec3(1.0, 0.0, 0.0)), c = gunH13(i + vec3(0.0, 1.0, 0.0)), d = gunH13(i + vec3(1.0, 1.0, 0.0));
  float e = gunH13(i + vec3(0.0, 0.0, 1.0)), g = gunH13(i + vec3(1.0, 0.0, 1.0)), h = gunH13(i + vec3(0.0, 1.0, 1.0)), k = gunH13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
`;

// Right after the color map: keep the wear noise, restore opacity (the map's alpha
// is not transparency here), then the 3D wood figure.
const AFTER_MAP = /* glsl */ `
float gunWearN = 0.5;
#ifdef USE_MAP
  gunWearN = sampledDiffuseColor.a;
  diffuseColor.a = opacity;
#endif
#ifdef GUN_WOOD
{
  vec3 p = vGunPos;
  #ifdef GUN_WOOD_Y
    p = p.xzy; // grain along the gun's Y axis (an upright grenade handle)
  #endif
  #ifdef GUN_LAMINATE
    // Beech veneers about 1.6 mm thick glued in vertical sheets: the carved surface
    // cuts through them in contour bands; dark glue lines between them.
    float layer = p.x / 0.0016 + (gunNoise3(p * vec3(10.0, 10.0, 2.5)) - 0.5) * 2.4 + (gunNoise3(p * vec3(70.0, 70.0, 6.0)) - 0.5) * 0.35;
    float lf = fract(layer);
    float tone = 0.8 + 0.34 * gunH13(vec3(floor(layer), 7.0, 3.0));
    float glue = smoothstep(0.84, 0.97, lf) * (1.0 - smoothstep(0.97, 1.0, lf));
    float aa = clamp(1.0 - fwidth(layer) * 0.6, 0.0, 1.0);
    diffuseColor.rgb *= mix(1.0, tone, aa) * (1.0 - glue * 0.5 * aa);
  #else
    // Growth rings around a pith line running nearly along the gun (with a little
    // run-out), wavy; latewood bands darker. Large-scale color streaks on top.
    vec2 d = p.xy - GUN_PITH - p.z * GUN_RUNOUT;
    float r = length(d) + (gunNoise3(p * vec3(40.0, 40.0, 6.0)) - 0.5) * 0.006 + (gunNoise3(p * vec3(7.0, 7.0, 1.4)) - 0.5) * 0.03;
    float rings = r * GUN_RINGS;
    float rf = fract(rings);
    // Ring widths vary from year to year.
    float yr = gunH13(vec3(floor(rings), 1.0, 2.0));
    float late = smoothstep(0.55 - 0.25 * yr, 0.9, rf) * (1.0 - smoothstep(0.92, 1.0, rf)) * (0.5 + yr);
    float aa = clamp(1.0 - fwidth(rings) * 0.7, 0.0, 1.0);
    float figure = 0.8 + 0.4 * gunNoise3(p * vec3(9.0, 9.0, 1.6));
    diffuseColor.rgb *= figure * (1.0 - late * GUN_LATE * aa);
  #endif
}
#endif
`;

// After the normal maps: wear on convex edges, grime in concave corners.
const AFTER_NORMALS = /* glsl */ `
{
  // Mean curvature (1/m) from the screen-space change of the smooth normal:
  // positive on rounded edges, negative in fillets and inside corners.
  vec3 gN = nonPerturbedNormal;
  vec3 gP = -vViewPosition;
  vec3 dpx = dFdx(gP);
  vec3 dpy = dFdy(gP);
  float kx = dot(dFdx(gN), dpx) / max(dot(dpx, dpx), 1e-12);
  float ky = dot(dFdy(gN), dpy) / max(dot(dpy, dpy), 1e-12);
  float curv = 0.5 * (kx + ky);
  float n3 = gunNoise3(vGunPos * 160.0);
  float wn = clamp(gunWearN * 0.75 + n3 * 0.35, 0.0, 1.0);
  float edge = smoothstep(GUN_EDGE.x, GUN_EDGE.y, curv);
  float wear = clamp(edge * smoothstep(0.3, 0.72, wn) * GUN_WEAR, 0.0, 1.0);
  float grime = smoothstep(GUN_EDGE.x * 0.5, GUN_EDGE.y, -curv) * (0.5 + 0.5 * wn);
  #if GUN_KIND == 0
    #ifdef GUN_POLISH
      // Handling polishes every edge a little: the finish there is thin and
      // smooth and catches the light (the player's own gun, seen up close).
      float pol = edge * GUN_POLISH;
      roughnessFactor = mix(roughnessFactor, 0.26, pol);
      metalnessFactor = mix(metalnessFactor, 1.0, pol * 0.7);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.3, 0.31), pol * 0.45);
    #endif
    // Finish worn through to bright steel.
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.36, 0.37), wear);
    metalnessFactor = mix(metalnessFactor, 1.0, wear);
    roughnessFactor = mix(roughnessFactor, 0.34, wear);
  #elif GUN_KIND == 1
    // Paint chipped to dark primer, then steel.
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.05, 0.045, 0.04), vec3(0.45), smoothstep(0.5, 1.0, wear)), smoothstep(0.1, 0.5, wear));
    metalnessFactor = mix(metalnessFactor, 1.0, smoothstep(0.5, 1.0, wear));
    roughnessFactor = mix(roughnessFactor, 0.4, wear);
  #else
    // Wood and plastics: the finish rubs off the edges (lighter, duller).
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.32 + 0.012, wear * 0.75);
    roughnessFactor = mix(roughnessFactor, 0.72, wear * 0.8);
  #endif
  diffuseColor.rgb *= 1.0 - grime * 0.45;
  roughnessFactor = mix(roughnessFactor, 0.85, grime * 0.4);
}
`;

// After the image-based light: GUN_ENV = (reflections, diffuse sky light) multipliers.
const AFTER_IBL = /* glsl */ `
#ifdef GUN_ENV
  radiance *= GUN_ENV.x;
  iblIrradiance *= GUN_ENV.y;
  #ifdef USE_CLEARCOAT
    clearcoatRadiance *= GUN_ENV.x;
  #endif
#endif
`;

// kind: 0 steel, 1 paint, 2 wood or plastic. wood: { pith: [x, y], runout: [dx, dy] per
// meter of z, rings: per meter, late: latewood darkening } or { laminate: true }.
// polish: steel edges smoothed by handling (0..1).
function patchGun(mat, { kind = 0, edge = [180, 650], wear = 1, wood = null, polish = 0 } = {}) {
  const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
  const defines = { GUN_KIND: kind, GUN_EDGE: `vec2(${f(edge[0])}, ${f(edge[1])})`, GUN_WEAR: f(wear) };
  if (polish > 0) defines.GUN_POLISH = f(polish);
  if (wood) {
    defines.GUN_WOOD = 1;
    if (wood.alongY) defines.GUN_WOOD_Y = 1;
    if (wood.laminate) defines.GUN_LAMINATE = 1;
    else {
      defines.GUN_PITH = `vec2(${f(wood.pith[0])}, ${f(wood.pith[1])})`;
      defines.GUN_RUNOUT = `vec2(${f(wood.runout[0])}, ${f(wood.runout[1])})`;
      defines.GUN_RINGS = f(wood.rings);
      defines.GUN_LATE = f(wood.late);
    }
  }
  mat.defines = { ...(mat.defines || {}), ...defines };
  addPatch(mat, 'gunSurface', (shader) => {
    shader.vertexShader = after(shader.vertexShader, '#include <common>', 'varying vec3 vGunPos;');
    shader.vertexShader = after(shader.vertexShader, '#include <begin_vertex>', 'vGunPos = position;');
    shader.fragmentShader = after(shader.fragmentShader, '#include <common>', DECL);
    shader.fragmentShader = after(shader.fragmentShader, '#include <map_fragment>', AFTER_MAP);
    shader.fragmentShader = after(shader.fragmentShader, '#include <normal_fragment_maps>', AFTER_NORMALS);
    shader.fragmentShader = after(shader.fragmentShader, '#include <lights_fragment_maps>', AFTER_IBL);
  });
  return mat;
}

// Wood figure per species (gun space, meters). The pith runs about 30 cm to the side
// of the stocks, so their sides cut the rings almost tangentially (flat-sawn): long
// arches and bands with straight grain along the edges.
const WOOD = {
  walnut: { pith: [0.34, -0.07], runout: [0.03, 0.045], rings: 150, late: 0.34 },
  beech: { pith: [-0.3, -0.04], runout: [-0.025, 0.04], rings: 190, late: 0.24 },
  birch: { pith: [0.28, 0.0], runout: [0.03, -0.035], rings: 230, late: 0.2 },
  laminate: { laminate: true },
  handle: { pith: [-0.3, -0.04], runout: [-0.025, 0.04], rings: 190, late: 0.16, alongY: true },
};

// Average linear colors for the flat-colored far LOD (one vertex-colored material).
const LOW = {
  steel: [0.022, 0.024, 0.03],
  parkerized: [0.035, 0.038, 0.033],
  phosphate: [0.028, 0.029, 0.03],
  steelBright: [0.3, 0.3, 0.3],
  steelDark: [0.018, 0.019, 0.022],
  walnut: [0.08, 0.03, 0.012],
  beech: [0.1, 0.032, 0.012],
  birch: [0.13, 0.035, 0.01],
  laminate: [0.078, 0.025, 0.011],
  bakelite: [0.04, 0.016, 0.009],
  bakeliteBlack: [0.009, 0.008, 0.007],
  checkerWalnut: [0.08, 0.035, 0.015],
  checkerPlastic: [0.04, 0.016, 0.008],
  grooved: [0.012, 0.009, 0.007],
  ribbed: [0.009, 0.008, 0.007],
  groovedWalnut: [0.08, 0.03, 0.012],
  sheet: [0.012, 0.012, 0.012],
  leather: [0.08, 0.04, 0.016],
  leatherBlack: [0.012, 0.01, 0.009],
  webbing: [0.25, 0.21, 0.11],
  canvas: [0.19, 0.17, 0.08],
  olive: [0.06, 0.07, 0.035],
  germanGrey: [0.05, 0.055, 0.06],
  germanYellow: [0.3, 0.24, 0.1],
  sovietGreen: [0.055, 0.08, 0.035],
  brass: [0.45, 0.3, 0.12],
  black: [0.006, 0.006, 0.006],
  glassClear: [0.2, 0.22, 0.24],
  yellowPaint: [0.45, 0.31, 0.06],
  handleWood: [0.3, 0.17, 0.07],
  ash: [0.36, 0.24, 0.12],
  oliveCast: [0.06, 0.07, 0.035],
};

// Standard gun materials from the texture library. size = texture size in pixels.
// Every material carries userData.texWorld (meters per texture tile, for UVs) and
// userData.lowColor (for the far LOD). firstPerson: the player's own gun, seen up
// close: the woods get the sheen of their oil or shellac finish and the steel a
// thin film of oil (clear coats that catch the light along edges and curves), and
// the edges show more wear.
export function makeGunMaterials(textures, { size = 512, firstPerson = false } = {}) {
  const fp = firstPerson;
  const Coat = fp ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const std = (preset, extra = {}, Mat = THREE.MeshStandardMaterial) => {
    const t = textures.get(preset, size);
    const m = new Mat({
      map: t.map,
      normalMap: t.normalMap,
      roughnessMap: t.ormMap,
      metalnessMap: t.ormMap,
      roughness: 1,
      metalness: 1,
      ...extra,
    });
    m.userData.texWorld = t.world;
    return m;
  };
  const oil = fp ? { clearcoat: 0.1, clearcoatRoughness: 0.3 } : {};
  const finish = fp ? { clearcoat: 0.5, clearcoatRoughness: 0.3 } : {};
  const steel = (p, kind = 0) => patchGun(std(p, oil, Coat), { kind, edge: fp ? [200, 760] : [260, 900], wear: fp ? 1 : 0.75, polish: fp ? 0.75 : 0 });
  const wood = (p, w) => patchGun(std(p, finish, Coat), { kind: 2, wood: WOOD[w], edge: [160, 620], wear: fp ? 0.7 : 0.55 });
  const plastic = (p, extra) => patchGun(std(p, extra), { kind: 2, edge: [160, 600], wear: 0.6 });
  const mats = {
    steel: steel('gunBlued'),
    steelDark: steel('gunBluedDark'),
    parkerized: steel('gunParkerized'),
    phosphate: steel('gunPhosphate'),
    steelBright: steel('gunBright'),
    walnut: wood('gunWalnut', 'walnut'),
    beech: wood('gunBeech', 'beech'),
    birch: wood('gunBirch', 'birch'),
    laminate: wood('gunLaminate', 'laminate'),
    bakelite: plastic('gunBakelite'),
    bakeliteBlack: plastic('gunBakeliteBlack'),
    checkerWalnut: plastic('gunCheckerWalnut'),
    checkerPlastic: plastic('gunCheckerPlastic'),
    grooved: plastic('gunGrooved'),
    ribbed: plastic('gunRibbed'),
    groovedWalnut: wood('gunGroovedWalnut', 'walnut'),
    sheet: patchGun(std('paintBlack'), { kind: 1, wear: 0.7 }), // painted stamped sheet metal
    leather: plastic('gunLeather'),
    leatherBlack: plastic('gunLeatherBlack'),
    webbing: std('gunWebbing'),
    canvas: std('gunCanvas'),
    olive: patchGun(std('paintOD'), { kind: 1 }), // painted launch tubes etc.
    germanGrey: patchGun(std('paintGermanGrey'), { kind: 1 }),
    germanYellow: patchGun(std('paintGerman'), { kind: 1 }),
    sovietGreen: patchGun(std('paintSoviet'), { kind: 1 }),
    oliveCast: patchGun(std('paintOD'), { kind: 1, wear: 0.45 }), // painted cast iron: chips show dark iron
    yellowPaint: patchGun(std('gunPaintYellow'), { kind: 1 }),
    handleWood: wood('gunBeechRaw', 'handle'), // grain along Y: upright stick grenade handles
    ash: wood('gunAsh', 'beech'), // grain along Z: bats and spade handles
    brass: new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.78, 0.56, 0.3), roughness: 0.32, metalness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 }),
    glassClear: new THREE.MeshStandardMaterial({ color: 0xb8c4c8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false }), // window panes
    black: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.7, metalness: 0.2 }),
  };
  // Perforated barrel jackets (MG 42, PPSh-41, MP 34...): steel with round holes
  // cut by an alpha test, in the gun's finish.
  const holes = makeHoleTexture();
  const perforated = (preset) => {
    const m = patchGun(std(preset, { alphaMap: holes, alphaTest: 0.5, side: THREE.DoubleSide }), { kind: 0, edge: [260, 900], wear: 0.6 });
    m.userData.texWorld = 0.06; // one 4x4 tile of holes every 6 cm
    m.userData.perforated = true;
    return m;
  };
  mats.perforated = perforated('gunBlued');
  mats.perforatedDark = perforated('gunBluedDark');
  mats.perforatedPhosphate = perforated('gunPhosphate');
  mats.perforatedParkerized = perforated('gunParkerized');
  // Stamped markings: letters cut into the steel, a little darker and duller
  // than the finish around them (alpha-tested decals laid on the surface). The
  // same letters as red or white paint for painted and stenciled markings.
  const stampTex = makeStampTexture();
  const decal = (color, roughness, metalness) =>
    new THREE.MeshStandardMaterial({ color, alphaMap: stampTex, alphaTest: 0.45, roughness, metalness, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mats.stamp = decal(0x0c0c0c, 0.62, 0.55);
  mats.paintRed = decal(0x8c1d12, 0.7, 0);
  mats.paintWhite = decal(0xcfc9b8, 0.82, 0);
  // Far LOD: one flat material colored per vertex.
  mats.low = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.25, side: THREE.DoubleSide });
  for (const [k, m] of Object.entries(mats)) {
    // First person: the sky shows more strongly in the gun's surfaces (they are
    // seen from a hand's breadth, and the eye reads the shape from them).
    if (fp && m.defines?.GUN_KIND !== undefined) m.defines.GUN_ENV = ['vec2(1.45, 1.2)', 'vec2(1.3, 1.15)', 'vec2(1.35, 1.2)'][m.defines.GUN_KIND];
    if (m.userData.texWorld === undefined) m.userData.texWorld = 0.3;
    m.userData.lowColor = LOW[k] || LOW[m.userData.perforated ? 'steel' : 'black'] || [0.05, 0.05, 0.05];
    m.name = `gun:${k}`;
  }
  return mats;
}

// Stamped and painted markings, packed in a 1024 x 1024 texture in slots 128 px
// tall: half rows (512 px) for stamps up to 500 px wide, whole rows for wider
// ones. Each is drawn centered in a box of w x h pixels; stampRect() gives its UVs.
// Lines are drawn top to bottom; '^' draws an arsenal mark (Izhevsk triangle and
// arrow). font: CSS font family (default a plain sans-serif).
export const STAMPS = {
  k98kRing: { lines: ['byf', '43'], w: 200, h: 128 },
  k98kSide: { lines: ['Mod. 98'], w: 320, h: 64 },
  garandHeel: { lines: ['U.S. RIFLE', 'CAL. .30 M1', 'SPRINGFIELD ARMORY', '2735190'], w: 400, h: 128 },
  mosinRing: { lines: ['^', '1942'], w: 160, h: 128 },
  mp40Top: { lines: ['MP 40', 'bnz 42'], w: 260, h: 128 },
  thompsonSide: { lines: ['U.S. SUBMACHINE GUN', 'CAL. .45  M1A1'], w: 640, h: 112 },
  stg44Top: { lines: ['MP 44', 'fxo 44'], w: 260, h: 128 },
  p38Slide: { lines: ['P.38   ac 43'], w: 480, h: 56 },
  // Painted: the red "9" burned into the grips of 9 mm C96s (M1916 "Red 9"), the
  // Panzerfaust's back-blast warning, the stick grenade's stenciled reminder.
  c96Nine: { lines: ['9'], w: 90, h: 128, font: 'Georgia, "Times New Roman", serif' },
  pzfWarn: { lines: ['Achtung!', 'Feuerstrahl!'], w: 300, h: 116 },
  m24Head: { lines: ['Vor Gebrauch', 'Sprengkapsel', 'einsetzen'], w: 300, h: 124 },
  ptrdRing: { lines: ['^', '1942'], w: 160, h: 128 },
};
const STAMP_SLOTS = (() => {
  const out = {};
  let bottom = 7;
  for (const [name, s] of Object.entries(STAMPS)) if (s.w > 500) out[name] = { row: bottom--, cx: 512 };
  let i = 0;
  for (const [name, s] of Object.entries(STAMPS)) {
    if (s.w > 500) continue;
    out[name] = { row: i >> 1, cx: i & 1 ? 768 : 256 };
    i++;
  }
  if ((i + 1) >> 1 > bottom + 1) throw new Error('gun stamp texture is full');
  return out;
})();

export function stampRect(name) {
  const { w, h } = STAMPS[name];
  const { row, cx } = STAMP_SLOTS[name];
  const u0 = (cx - w / 2) / 1024,
    u1 = (cx + w / 2) / 1024;
  const cy = row * 128 + 64; // px from the top
  return [u0, 1 - (cy + h / 2) / 1024, u1, 1 - (cy - h / 2) / 1024];
}

function makeStampTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 1024);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [name, { lines, w, h, font = 'Arial, Helvetica, sans-serif' }] of Object.entries(STAMPS)) {
    const { row, cx } = STAMP_SLOTS[name];
    const lh = h / lines.length;
    lines.forEach((line, k) => {
      const cy = row * 128 + 64 - h / 2 + lh * (k + 0.5);
      if (line === '^') {
        // Izhevsk arsenal mark: a triangle with an arrow inside.
        const r = lh * 0.42;
        g.lineWidth = Math.max(3, r * 0.14);
        g.strokeStyle = '#fff';
        g.beginPath();
        g.moveTo(cx, cy - r);
        g.lineTo(cx + r * 0.95, cy + r * 0.7);
        g.lineTo(cx - r * 0.95, cy + r * 0.7);
        g.closePath();
        g.stroke();
        g.beginPath();
        g.moveTo(cx, cy - r * 0.55);
        g.lineTo(cx, cy + r * 0.55);
        g.moveTo(cx - r * 0.25, cy - r * 0.25);
        g.lineTo(cx, cy - r * 0.55);
        g.lineTo(cx + r * 0.25, cy - r * 0.25);
        g.stroke();
        return;
      }
      let px = Math.floor(lh * 0.82);
      g.font = `bold ${px}px ${font}`;
      const tw = g.measureText(line).width;
      if (tw > w * 0.96) {
        px = Math.floor((px * w * 0.96) / tw);
        g.font = `bold ${px}px ${font}`;
      }
      g.fillText(line, cx, cy);
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

// Rows of round holes for perforated jackets. UV space: u along the barrel.
function makeHoleTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#000';
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      g.beginPath();
      g.ellipse(32 + col * 64, 32 + row * 64, 20, 20, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
