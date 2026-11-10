// Camouflage prints a uniform can be made in, beside the three its army issues
// by default (splinter, marsh and amoeba in soldierMaterials.js).
//
// A print is color only: it is laid over the cloth it is printed on (cotton:
// the weave, the folds and the wear are the cloth's). They are baked side by
// side into an atlas of their own, and a vertex wears one by a material cell
// number from CAMO_BASE up (soldierMaterials.js reads it).
//
//   camoCell('oakSpring')   the cell number to give b.material()
//   camosFor('GE')          the prints an army's soldiers can wear
//
// The patterns are drawn from memory of what the real ones look like (their
// kinds of shape, how many colors, roughly which): none was checked against a
// photograph or a surviving garment, and none is a copy of a real bolt of
// cloth. Who really wore each, and on what, is in docs/CAMOUFLAGE.md.
import { addMaterials, PRESETS } from '../render/textures.js';

export const CAMO_BASE = 32;

// id, the name shown to players, the army that wore it, the size of one repeat (m).
export const CAMOS = [
  { id: 'oakSpring', name: 'Oak leaf, spring', army: 'GE', world: 0.55 },
  { id: 'oakAutumn', name: 'Oak leaf, autumn', army: 'GE', world: 0.55 },
  { id: 'planeSpring', name: 'Plane tree, spring', army: 'GE', world: 0.6 },
  { id: 'planeAutumn', name: 'Plane tree, autumn', army: 'GE', world: 0.6 },
  { id: 'peaDot', name: 'Pea dot', army: 'GE', world: 0.5 },
  { id: 'telo', name: 'Italian', army: 'GE', world: 0.75 },
  { id: 'frogGreen', name: 'Frog skin, green', army: 'US', world: 0.5 },
  { id: 'frogBrown', name: 'Frog skin, brown', army: 'US', world: 0.5 },
  { id: 'daub', name: 'Painted jump suit', army: 'US', world: 0.7 },
  { id: 'amoebaAutumn', name: 'Amoeba, autumn', army: 'SU', world: 0.7 },
  { id: 'leaf', name: 'Leaf', army: 'SU', world: 0.6 },
  { id: 'stairStep', name: 'Three-color, 1944', army: 'SU', world: 0.6 },
];

const END = /* glsl */ `
      albedo = c;
      rough = 0.9;
      metal = 0.0;
      height = 0.0;
      alpha = 1.0;
    }`;
const HEAD = /* glsl */ `
    void surface(vec2 uv, out vec3 albedo, out float rough, out float height, out float metal, out float alpha) {
      // (Edges that wander: the pattern read a little way off from where it is.)
      vec2 w = 0.03 * vec2(fbm(uv, vec2(6.0), 3, 590.0), fbm(uv, vec2(6.0), 3, 591.0));`;

// German oak leaf (Eichenlaub): dark shapes ringed by a middle tone on a light
// ground, with light flecks inside the dark.
const oak = (light, mid, dark, seed) => /* glsl */ `${HEAD}
      float n = fbm01(uv + w, vec2(4.0), 5, ${seed}.0);
      float n2 = fbm01(uv + w * 1.4 + 0.31, vec2(5.0), 4, ${seed + 1}.0);
      vec3 light = srgb(vec3(${light}));
      vec3 mid = srgb(vec3(${mid}));
      vec3 dark = srgb(vec3(${dark}));
      vec3 c = light;
      c = mix(c, mid, smoothstep(0.515, 0.527, n2));
      float d = smoothstep(0.555, 0.567, n);
      c = mix(c, mid, smoothstep(0.52, 0.532, n) * (1.0 - d));
      c = mix(c, dark, d);
      c = mix(c, light, d * smoothstep(0.64, 0.652, fbm01(uv - w, vec2(11.0), 3, ${seed + 2}.0)));${END}`;

// German plane tree (Platanenmuster): big dark blotches whose edges break up
// into dots, light spots scattered over the ground.
const plane = (ground, dark, spot, seed) => /* glsl */ `${HEAD}
      float n = fbm01(uv + w, vec2(3.0), 5, ${seed}.0);
      vec3 c = srgb(vec3(${ground}));
      vec3 dark = srgb(vec3(${dark}));
      float d = smoothstep(0.55, 0.562, n);
      // Dots: dark ones along the blotches' edges, light ones out on the ground.
      vec3 v = voronoi(uv, vec2(34.0), 0.95, ${seed + 1}.0);
      float dot = 1.0 - smoothstep(0.16 + 0.16 * v.z, 0.2 + 0.16 * v.z, v.x);
      float edge = smoothstep(0.47, 0.5, n) * (1.0 - d);
      c = mix(c, srgb(vec3(${spot})), dot * step(0.62, v.z) * (1.0 - smoothstep(0.42, 0.5, n)));
      c = mix(c, dark, dot * step(v.z, 0.6) * edge);
      c = mix(c, dark, d);
      vec3 v2 = voronoi(uv + 0.13, vec2(27.0), 0.95, ${seed + 2}.0);
      c = mix(c, srgb(vec3(${ground})), d * (1.0 - smoothstep(0.1, 0.14, v2.x)) * step(0.7, v2.z));${END}`;

// US frog skin (the 1942 "duck hunter" print): rounded spots of four colors,
// large and small, overlapping on a pale ground.
const frog = (ground, a, b2, c3, d4, seed) => /* glsl */ `${HEAD}
      vec3 c = srgb(vec3(${ground}));
      vec3 cols[4];
      cols[0] = srgb(vec3(${a}));
      cols[1] = srgb(vec3(${b2}));
      cols[2] = srgb(vec3(${c3}));
      cols[3] = srgb(vec3(${d4}));
      // Three sizes of spot, the big ones underneath.
      for (int L = 0; L < 3; L++) {
        float f = L == 0 ? 6.0 : L == 1 ? 10.0 : 17.0;
        vec3 v = voronoi(uv + w * (1.5 - 0.4 * float(L)) + float(L) * 0.37, vec2(f), 0.9, ${seed}.0 + float(L) * 3.0);
        float r = 0.22 + 0.2 * fract(v.z * 13.0);
        float m = (1.0 - smoothstep(r - 0.025, r, v.x)) * step(L == 0 ? 0.3 : 0.45, v.z);
        int k = int(mod(floor(v.z * 97.0) + float(L), 4.0));
        c = mix(c, k == 0 ? cols[0] : k == 1 ? cols[1] : k == 2 ? cols[2] : cols[3], m);
      }${END}`;

const GLSL = {
  camoOakSpring: oak('0.5, 0.52, 0.33', '0.33, 0.4, 0.24', '0.13, 0.16, 0.11', 601),
  camoOakAutumn: oak('0.63, 0.48, 0.3', '0.43, 0.29, 0.18', '0.16, 0.12, 0.09', 611),
  camoPlaneSpring: plane('0.37, 0.43, 0.26', '0.12, 0.15, 0.1', '0.56, 0.58, 0.36', 621),
  camoPlaneAutumn: plane('0.56, 0.39, 0.23', '0.17, 0.12, 0.09', '0.7, 0.58, 0.38', 631),
  // German pea dot (Erbsenmuster, 1944): brown and green areas on an ochre
  // ground, all of it peppered with small dots of the other colors.
  camoPeaDot: /* glsl */ `${HEAD}
      float n1 = fbm01(uv + w, vec2(4.0), 4, 641.0);
      float n2 = fbm01(uv + w + 0.4, vec2(5.0), 4, 642.0);
      vec3 ochre = srgb(vec3(0.55, 0.44, 0.31));
      vec3 green = srgb(vec3(0.35, 0.42, 0.24));
      vec3 dark = srgb(vec3(0.2, 0.15, 0.12));
      vec3 c = ochre;
      c = mix(c, green, smoothstep(0.51, 0.522, n1));
      c = mix(c, dark, smoothstep(0.56, 0.572, n2));
      for (int L = 0; L < 2; L++) {
        vec3 v = voronoi(uv + float(L) * 0.21, vec2(L == 0 ? 30.0 : 44.0), 0.95, 643.0 + float(L) * 5.0);
        float r = 0.14 + 0.16 * fract(v.z * 9.0);
        float m = (1.0 - smoothstep(r - 0.04, r, v.x)) * step(0.5, v.z);
        float k = fract(v.z * 41.0);
        c = mix(c, k < 0.34 ? srgb(vec3(0.5, 0.55, 0.31)) : k < 0.67 ? srgb(vec3(0.1, 0.1, 0.08)) : ochre, m);
      }${END}`,
  // Italian M1929 (telo mimetico, worn by German troops from 1943): big flowing
  // patches of ochre, green and chestnut, about a third each.
  camoTelo: /* glsl */ `${HEAD}
      float n1 = fbm01(uv + w * 2.0, vec2(3.0), 4, 651.0);
      float n2 = fbm01(uv + w * 2.0 + 0.5, vec2(3.0), 4, 652.0);
      vec3 c = srgb(vec3(0.62, 0.52, 0.31));
      c = mix(c, srgb(vec3(0.29, 0.37, 0.23)), smoothstep(0.5, 0.51, n1));
      c = mix(c, srgb(vec3(0.37, 0.24, 0.17)), smoothstep(0.535, 0.545, n2));${END}`,
  camoFrogGreen: frog('0.57, 0.56, 0.4', '0.2, 0.28, 0.18', '0.36, 0.42, 0.26', '0.36, 0.28, 0.18', '0.67, 0.61, 0.45', 661),
  camoFrogBrown: frog('0.67, 0.59, 0.43', '0.26, 0.19, 0.13', '0.43, 0.32, 0.2', '0.52, 0.46, 0.3', '0.34, 0.33, 0.22', 671),
  // US paratroopers' jump suits daubed with paint before Normandy: broad brush
  // strokes of dark green, and fewer of black, over the khaki.
  camoDaub: /* glsl */ `${HEAD}
      vec2 q = vec2(uv.x + uv.y, uv.y);
      vec2 q2 = vec2(uv.x - uv.y, uv.y);
      float s1 = fbm01(q + w, vec2(3.0, 8.0), 4, 681.0);
      float s2 = fbm01(q2 + w, vec2(2.0, 7.0), 4, 682.0);
      // (A brush runs dry: the strokes thin out and break toward their ends.)
      float dry = fbm01(uv, vec2(40.0, 6.0), 2, 683.0);
      vec3 c = srgb(vec3(0.55, 0.5, 0.36));
      c = mix(c, srgb(vec3(0.21, 0.27, 0.17)), smoothstep(0.55, 0.57, s1 + (dry - 0.5) * 0.08));
      c = mix(c, srgb(vec3(0.12, 0.12, 0.1)), smoothstep(0.63, 0.65, s2 + (dry - 0.5) * 0.08) * 0.92);${END}`,
  // Soviet amoeba in its autumn colors: dark brown blots on yellow-tan.
  camoAmoebaAutumn: /* glsl */ `${HEAD}
      float n = fbm01(uv, vec2(5.0), 5, 451.0);
      float n2 = fbm01(uv, vec2(9.0), 4, 452.0);
      vec3 c = mix(srgb(vec3(0.63, 0.54, 0.33)), srgb(vec3(0.2, 0.15, 0.11)), smoothstep(0.55, 0.575, n + (n2 - 0.5) * 0.25));${END}`,
  // Soviet leaf pattern (1940-41): ragged leaf and twig shapes of green on a
  // pale yellow-green, with darker blots over both.
  camoLeaf: /* glsl */ `${HEAD}
      float jag = vnoise(uv * 70.0, vec2(70.0), 691.0) - 0.5;
      float n1 = fbm01(uv + w, vec2(5.0), 3, 692.0) + jag * 0.07;
      float n2 = fbm01(uv, vec2(4.0), 5, 693.0);
      vec3 c = srgb(vec3(0.58, 0.6, 0.38));
      c = mix(c, srgb(vec3(0.33, 0.42, 0.24)), smoothstep(0.5, 0.51, n1));
      c = mix(c, srgb(vec3(0.26, 0.2, 0.14)), smoothstep(0.585, 0.6, n2));${END}`,
  // Soviet three-color suit of 1944 (TTsMKK): two greens over a yellow-tan
  // ground, their edges cut in steps like a staircase.
  camoStairStep: /* glsl */ `${HEAD}
      // (The steps: the shapes are read on a grid of 12 mm squares.)
      vec2 q = (floor(uv * 48.0) + 0.5) / 48.0;
      float n1 = fbm01(q, vec2(4.0), 4, 701.0);
      float n2 = fbm01(q + 0.37, vec2(5.0), 4, 702.0);
      vec3 c = srgb(vec3(0.64, 0.58, 0.37));
      c = mix(c, srgb(vec3(0.4, 0.47, 0.26)), step(0.5, n1));
      c = mix(c, srgb(vec3(0.2, 0.27, 0.17)), step(0.56, n2));${END}`,
};

const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const CAMO_PRESETS = CAMOS.map((c) => `camo${cap(c.id)}Tex`);
export const CAMO_COLS = 4;
export const CAMO_ROWS = Math.ceil(CAMOS.length / CAMO_COLS);
if (!PRESETS[CAMO_PRESETS[0]]) {
  const presets = {};
  for (const c of CAMOS) presets[`camo${cap(c.id)}Tex`] = { mat: `camo${cap(c.id)}`, world: c.world };
  addMaterials(GLSL, presets);
}

export const camoCell = (id) => {
  const i = CAMOS.findIndex((c) => c.id === id);
  return i < 0 ? null : CAMO_BASE + i;
};
export const camosFor = (army) => CAMOS.filter((c) => c.army === army);
