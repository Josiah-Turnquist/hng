// Close-combat weapons (the "closecombat" loadout slot, key 6; docs/ITEMS.md):
// each army's entrenching spade, knife or bayonet, and a baseball bat. Real
// lengths and masses (docs/research/weapons.md, section 10); estimates are
// marked "est.".
//
// Fields besides the usual ones (defs.js):
//   style    stab (a knife or bayonet: a quick thrust) | swing (a spade or bat:
//            a chop from over the shoulder)
//   length   overall length (m)
//   reach    how far in front of the eyes a blow lands (m)
//   attack   { period: s from one blow to the next, hit: s from the start of
//            the blow to the moment it lands }
//   damage   { head, body, limb }: health taken by one blow there. As in the
//            original game a knife or bayonet kills with one stab to the head
//            or body; a spade or bat with one blow to the head or two to the
//            body.
//   sound    'blade' | 'spade' | 'bat': which swish and hit (audio/recipes/foley.js)
//
// Timing: a knife thrust takes about 0.6 s from start to finish (0.61 +- 0.15 s
// measured for a forward thrust); a spade or bat swung one-handed from the
// shoulder is slower, a bat (about 1 kg, its weight far out) slowest.
const ALL = ['infantry', 'paratrooper', 'recon', 'tanker'];

const STAB = { head: 150, body: 150, limb: 45 };
const BLUNT = { head: 150, body: 55, limb: 30 };
const KNIFE = { period: 0.55, hit: 0.2 };
const BAYONET = { period: 0.6, hit: 0.22 };
const SPADE = { period: 0.75, hit: 0.34 };
const BAT = { period: 0.9, hit: 0.42 };

const melee = (o) => ({ slot: 'closecombat', type: 'melee', classes: ALL, points: 1, ...o });

export const MELEE = {
  // ======================================================================== US
  spade_m1910: melee({
    name: 'M-1910 entrenching tool',
    faction: 'US',
    style: 'swing',
    mass: 0.68,
    length: 0.56,
    reach: 1.3,
    attack: SPADE,
    damage: BLUNT,
    sound: 'spade',
    info: 'The "T-handle" shovel every US infantryman carried on his pack. Its edge kills with a blow to the head, or two to the body.',
  }),
  knife_m3: melee({
    name: 'M3 trench knife',
    faction: 'US',
    style: 'stab',
    mass: 0.23,
    length: 0.298,
    reach: 1.0,
    attack: KNIFE,
    damage: STAB,
    sound: 'blade',
    info: 'Combat knife with a 17 cm blade and a stacked leather grip. One stab kills.',
  }),
  bat_us: melee({
    name: 'Baseball bat',
    faction: 'US',
    style: 'swing',
    mass: 1.02,
    length: 0.889,
    reach: 1.4,
    attack: BAT,
    damage: BLUNT,
    sound: 'bat',
    points: 2,
    info: 'A 35-inch ash bat from home. Slow, but it kills with a blow to the head.',
  }),

  // =================================================================== Germany
  spade_ge: melee({
    name: 'Kleines Schanzzeug',
    faction: 'GE',
    style: 'swing',
    mass: 0.9, // est.
    length: 0.535,
    reach: 1.3,
    attack: SPADE,
    damage: BLUNT,
    sound: 'spade',
    info: 'The small entrenching spade on a straight wooden handle. A blow to the head kills, or two to the body.',
  }),
  bayonet_s84_98: melee({
    name: 'Seitengewehr 84/98',
    faction: 'GE',
    style: 'stab',
    mass: 0.4, // est.
    length: 0.385,
    reach: 1.3,
    attack: BAYONET,
    damage: STAB,
    sound: 'blade',
    info: 'The Kar 98k\'s bayonet, used as a knife: a 25 cm blade with a fuller. One stab kills.',
  }),
  bat_ge: melee({
    name: 'Baseball bat (Berlin 1936)',
    faction: 'GE',
    style: 'swing',
    mass: 1.02,
    length: 0.889,
    reach: 1.4,
    attack: BAT,
    damage: BLUNT,
    sound: 'bat',
    points: 2,
    info: 'A souvenir of the baseball game at the 1936 Olympics. Slow, but it kills with a blow to the head.',
  }),

  // ================================================================ Soviet Union
  spade_mpl50: melee({
    name: 'MPL-50 small infantry spade',
    faction: 'SU',
    style: 'swing',
    mass: 0.8, // est.
    length: 0.5,
    reach: 1.3,
    attack: SPADE,
    damage: BLUNT,
    sound: 'spade',
    info: 'The Red Army\'s short spade, its edges ground sharp for fighting. A blow to the head kills, or two to the body.',
  }),
  knife_nr40: melee({
    name: 'NR-40 scout\'s knife',
    faction: 'SU',
    style: 'stab',
    mass: 0.15,
    length: 0.267,
    reach: 1.0,
    attack: KNIFE,
    damage: STAB,
    sound: 'blade',
    info: 'The scouts\' knife with its S-shaped guard and black wooden grip. One stab kills.',
  }),
  bayonet_avs36: melee({
    name: 'AVS-36 bayonet',
    faction: 'SU',
    style: 'stab',
    mass: 0.5, // est.
    length: 0.45,
    reach: 1.3,
    attack: BAYONET,
    damage: STAB,
    sound: 'blade',
    info: 'The Simonov rifle\'s long knife bayonet, a 33.5 cm blade. One stab kills.',
  }),
  bat_lapta: melee({
    name: 'Lapta bat',
    faction: 'SU',
    style: 'swing',
    mass: 0.6, // est.
    length: 0.8,
    reach: 1.4,
    attack: BAT,
    damage: BLUNT,
    sound: 'bat',
    points: 2,
    info: 'A birch bat from the Russian ball game lapta. Slow, but it kills with a blow to the head.',
  }),
};
