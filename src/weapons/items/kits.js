// Medical kits and the repair wrench, the original game's "equipment" items
// that are not grenades (docs/ITEMS.md). They take an equipment slot like a
// grenade but fire nothing: a kit treats the wounded man in front of you, or
// yourself; the wrench repairs the vehicle you stand at (game/kits.js).
//
// Fields beyond the common ones:
//   uses       how many times a kit can be used (refilled at an ammo crate)
//   heal       health a use gives back (up to full), over healTime seconds; the
//              first fifth of that time is putting the dressing on, which stops
//              the bleeding and spends the use
//   reach      m from the user to the man or vehicle he works on
//   repairRate share of the vehicle's full health restored a second
//   moduleTime s to put a broken track, tire, engine or other part right
//   anyArmy    every army may carry it (the wrench: its faction is only nominal)
//
// The numbers follow how the original game played (a first-aid kit about +40
// health over 4 s, a medic pouch more and faster, the wrench about 5% of a
// vehicle a second); they are game values, not research. What the real kits
// looked like: docs/research/weapons.md, section 12.

export const KIT_TYPES = new Set(['firstaid', 'medkit', 'wrench']);

const ALL = ['infantry', 'paratrooper', 'recon', 'tanker'];

const firstAid = { slot: 'equipment', type: 'firstaid', classes: ALL, points: 1, uses: 3, heal: 40, healTime: 4, reach: 2 };
const medic = { slot: 'equipment', type: 'medkit', classes: ALL, points: 2, uses: 6, heal: 60, healTime: 3, reach: 2 };

export const KITS = {
  firstaid_us: {
    ...firstAid,
    name: 'First aid kit',
    faction: 'US',
    mass: 0.2,
    length: 0.13,
    info: 'The M-1924 pouch on the belt with a Carlisle dressing. Three uses: on yourself, or on a wounded man in front of you. Stops bleeding and gives back about 40 health.',
  },
  firstaid_ge: {
    ...firstAid,
    name: 'First aid kit',
    faction: 'GE',
    mass: 0.25,
    length: 0.12,
    info: 'Verbandpäckchen in a field grey tin. Three uses: on yourself, or on a wounded man in front of you. Stops bleeding and gives back about 40 health.',
  },
  firstaid_su: {
    ...firstAid,
    name: 'First aid kit',
    faction: 'SU',
    mass: 0.2,
    length: 0.13,
    info: 'A small canvas sumka of dressing packets. Three uses: on yourself, or on a wounded man in front of you. Stops bleeding and gives back about 40 health.',
  },
  medic_us: {
    ...medic,
    name: 'Medic pouch',
    faction: 'US',
    mass: 1.4,
    length: 0.2,
    info: "An aidman's canvas pouch of dressings, sulfa and morphine. Six uses, mostly for others: stops bleeding and gives back about 60 health, faster than a first aid kit.",
  },
  medic_ge: {
    ...medic,
    name: 'Medic pouch',
    faction: 'GE',
    mass: 1.5,
    length: 0.18,
    info: "A Sanitäter's leather belt pouch of dressings and instruments. Six uses, mostly for others: stops bleeding and gives back about 60 health, faster than a first aid kit.",
  },
  medic_su: {
    ...medic,
    name: 'Medic pouch',
    faction: 'SU',
    mass: 1.6,
    length: 0.26,
    info: "A sanitar's canvas bag with the red cross. Six uses, mostly for others: stops bleeding and gives back about 60 health, faster than a first aid kit.",
  },
  wrench: {
    name: 'Adjustable wrench',
    faction: 'US',
    anyArmy: true,
    slot: 'equipment',
    type: 'wrench',
    classes: ['infantry', 'recon', 'tanker'], // (never a paratrooper's, as in the original game)
    points: 1,
    mass: 0.9,
    length: 0.3,
    reach: 3,
    repairRate: 0.05,
    moduleTime: 3,
    info: 'A 12 inch adjustable wrench from a vehicle tool roll, for drivers and tank crews. Hold fire at a damaged vehicle to repair it: tracks, tires and engine too. Not while it burns.',
  },
};
