// Species and atlas layout for the countryside vegetation of 1944 Normandy: mixed
// broadleaf woods (oak, beech, ash), conifer stands (Norway spruce, Scots pine),
// Lombardy poplars along roads, tall-stem cider apple orchards by the farms, hazel,
// hawthorn and bramble in the undergrowth and the bocage hedges.

// One texture atlas holds every bark and foliage texture, so a whole tree (trunk and
// leaves) is drawn with a single material. 4 x 5 cells, row 0 at the top.
export const ATLAS_CELLS = [
  'vegBarkOak', 'vegBarkBeech', 'vegBarkPine', 'vegBarkGrey',
  'vegLeafOak', 'vegLeafBeech', 'vegLeafAsh', 'vegLeafPoplar',
  'vegLeafApple', 'vegNeedleSpruce', 'vegNeedlePine', 'vegLeafHawthorn',
  'vegLeafHazel', 'vegLeafBramble', 'vegHedgeCore', 'grass',
  'vegTallGrass', 'vegFern', 'vegFlowers', 'vegGrass',
];
export const CELL = {
  barkOak: 0, barkBeech: 1, barkPine: 2, barkGrey: 3,
  oak: 4, beech: 5, ash: 6, poplar: 7,
  apple: 8, spruce: 9, pine: 10, hawthorn: 11,
  hazel: 12, bramble: 13, hedgeCore: 14, bank: 15,
  grassTall: 16, fern: 17, flowers: 18, grass: 19,
};
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 5;
// Texture size of one cell in meters (bark and hedge core tile at this size).
export const BARK_WORLD = 1.6;

// Ground cover atlas: 4 x 2 cells of plant cards.
export const GROUND_CELLS = ['vegGrass', 'vegGrassDry', 'vegWheat', 'vegFern', 'vegFlowers', 'vegPoppies', 'vegTallGrass', 'vegWeeds'];
export const GC = { grass: 0, dry: 1, wheat: 2, fern: 3, flowers: 4, poppies: 5, tall: 6, weeds: 7 };

// Tree species. Heights are for a typical full-grown tree (instances are scaled
// 0.7-1.25). Crown: center height and radii as fractions of the height.
export const SPECIES = {
  oak: {
    kind: 'broadleaf', H: [15, 18], trunk: [0.26, 0.34], r0: 0.034, crown: { y: 0.6, rx: [0.44, 0.52], ry: [0.3, 0.35] },
    limbs: [6, 8], limbAngle: [42, 78], bend: 0.12, wiggle: 0.18, leader: false, clusters: 40, card: [2.8, 3.5],
    leaf: 'oak', bark: 'barkOak', barkTint: [0.95, 0.92, 0.88], flutter: 0.9, density: 0.85,
  },
  beech: {
    kind: 'broadleaf', H: [20, 25], trunk: [0.3, 0.4], r0: 0.022, crown: { y: 0.62, rx: [0.32, 0.38], ry: [0.34, 0.38] },
    limbs: [7, 9], limbAngle: [30, 72], bend: 0.22, wiggle: 0.08, leader: true, clusters: 44, card: [2.9, 3.6],
    leaf: 'beech', bark: 'barkBeech', barkTint: [1, 1, 1], flutter: 0.9, density: 1,
  },
  ash: {
    kind: 'broadleaf', H: [17, 22], trunk: [0.3, 0.4], r0: 0.022, crown: { y: 0.63, rx: [0.31, 0.37], ry: [0.32, 0.36] },
    limbs: [6, 8], limbAngle: [28, 62], bend: 0.32, wiggle: 0.1, leader: true, clusters: 34, card: [2.6, 3.3],
    leaf: 'ash', bark: 'barkGrey', barkTint: [0.92, 0.92, 0.9], flutter: 1.2, density: 0.7,
  },
  poplar: {
    kind: 'poplar', H: [22, 27], trunk: [0.06, 0.1], r0: 0.017, crown: { y: 0.54, rx: [0.1, 0.12], ry: [0.46, 0.48] },
    limbs: [18, 22], limbAngle: [12, 24], bend: 0.1, wiggle: 0.05, leader: true, clusters: 68, card: [1.9, 2.4],
    leaf: 'poplar', bark: 'barkGrey', barkTint: [0.98, 0.95, 0.9], flutter: 1.8, density: 1,
  },
  apple: {
    kind: 'broadleaf', H: [5.5, 6.8], trunk: [0.26, 0.32], r0: 0.026, crown: { y: 0.6, rx: [0.5, 0.6], ry: [0.36, 0.42] },
    limbs: [4, 5], limbAngle: [42, 66], bend: 0.18, wiggle: 0.22, leader: false, clusters: 26, card: [1.9, 2.3],
    leaf: 'apple', bark: 'barkGrey', barkTint: [0.72, 0.66, 0.6], flutter: 1, density: 0.9,
  },
  spruce: {
    kind: 'spruce', H: [21, 27], trunk: [0.14, 0.3], r0: 0.019, crown: { y: 0.55, rx: [0.17, 0.2], ry: [0.42, 0.45] },
    leaf: 'spruce', bark: 'barkGrey', barkTint: [0.78, 0.6, 0.5], flutter: 0.35, density: 1,
  },
  pine: {
    kind: 'pine', H: [18, 23], trunk: [0.58, 0.68], r0: 0.022, crown: { y: 0.81, rx: [0.19, 0.23], ry: [0.12, 0.14] },
    limbs: [5, 7], limbAngle: [48, 78], bend: 0.2, wiggle: 0.25, clusters: 30, card: [2.5, 3.1],
    leaf: 'pine', bark: 'barkPine', barkTint: [1, 1, 1], flutter: 0.4, density: 1,
  },
  hazel: { kind: 'bush', shape: 'hazel', H: [3.2, 4.0], leaf: 'hazel', bark: 'barkGrey', barkTint: [0.78, 0.68, 0.6], flutter: 1.2 },
  hawthorn: { kind: 'bush', shape: 'hawthorn', H: [2.6, 3.2], leaf: 'hawthorn', bark: 'barkGrey', barkTint: [0.6, 0.55, 0.5], flutter: 1 },
  bramble: { kind: 'bush', shape: 'bramble', H: [1.1, 1.4], leaf: 'bramble', bark: 'barkGrey', barkTint: [0.6, 0.45, 0.4], flutter: 1 },
};

// Shape variants: three of each tree species, two of each bush (27 in all, which
// fills the 8 x 8 impostor atlas). A variant id indexes VARIANTS (and the impostor
// atlas); trees come first.
export const TREE_SPECIES = ['oak', 'beech', 'ash', 'poplar', 'apple', 'spruce', 'pine'];
export const BUSH_SPECIES = ['hazel', 'hawthorn', 'bramble'];
export const VARIANTS = [];
for (const sp of TREE_SPECIES) for (let v = 0; v < 3; v++) VARIANTS.push({ species: sp, v, bush: false });
for (const sp of BUSH_SPECIES) for (let v = 0; v < 2; v++) VARIANTS.push({ species: sp, v, bush: true });
VARIANTS.forEach((d, i) => (d.id = i));
export const variantOf = (species, v = 0) => VARIANTS.findIndex((d) => d.species === species && d.v === v);
