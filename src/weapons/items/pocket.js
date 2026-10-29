// Pocket pistols: the small automatics officers, staff and police carried in
// the war, lighter and weaker than the service pistols. Defined like the
// pistols in defs.js (see its field list); their cartridges are in ammo.js.
// Sources in docs/research/weapons.md, section 10; values marked "est." were
// not found there. See docs/ITEMS.md for the conventions.
//
// None of the three holds its slide open on the last round (the Beretta's
// follower does, but the slide runs forward as the magazine comes out), so an
// empty one is cocked again after the new magazine goes in.
export const POCKET_PISTOLS = {
  colt_1903: {
    name: 'Colt M1903 Pocket',
    faction: 'US',
    type: 'pistol',
    slot: 'sidearm',
    classes: ['infantry', 'paratrooper', 'recon', 'tanker'],
    points: 1,
    ammo: '32 ACP',
    mv: 270, // 3.75 in barrel (est. from 276 m/s out of 4 in)
    mass: 0.68, // 24 oz
    length: 0.171, // 6.75 in
    modes: ['semi'],
    rpm: 600,
    feed: 'box',
    capacity: 8,
    reserve: 4,
    reload: { tactical: 1.9, empty: 2.4 },
    sight: { kind: 'notch', unit: 'yd', ranges: [25], zero: 25 },
    accuracy: 9, // est.
    hipError: 1.9,
    recoil: { rise: 0.8, side: 0.3 },
    sound: 'pistol',
    info: 'The Colt Pocket Hammerless in .32 ACP, issued to US general officers and the OSS. Flat, light and mild, with eight rounds.',
  },
  beretta_1934: {
    name: 'Beretta M1934',
    faction: 'GE',
    type: 'pistol',
    slot: 'sidearm',
    classes: ['infantry', 'paratrooper', 'recon', 'tanker'],
    points: 1,
    ammo: '380 ACP',
    mv: 260, // 94 mm barrel (published 229 to 290 m/s; est.)
    mass: 0.66,
    length: 0.152,
    modes: ['semi'],
    rpm: 600,
    feed: 'box',
    capacity: 7,
    reserve: 4,
    reload: { tactical: 1.9, empty: 2.4 },
    sight: { kind: 'notch', unit: 'm', ranges: [25], zero: 25 },
    accuracy: 8, // est.
    hipError: 1.9,
    recoil: { rise: 0.95, side: 0.32 },
    sound: 'pistol',
    info: 'The Italian army pistol in 9 mm Corto, taken over by the Wehrmacht and the German police as the Pistole 671(i). Seven rounds.',
  },
  korovin_tk: {
    name: 'Korovin TK',
    faction: 'SU',
    type: 'pistol',
    slot: 'sidearm',
    classes: ['infantry', 'paratrooper', 'recon', 'tanker'],
    points: 1,
    ammo: '25 ACP',
    mv: 228, // 67.5 mm barrel
    mass: 0.423,
    length: 0.127,
    modes: ['semi'],
    rpm: 600,
    feed: 'box',
    capacity: 8,
    reserve: 4,
    reload: { tactical: 1.8, empty: 2.3 },
    sight: { kind: 'notch', unit: 'm', ranges: [25], zero: 25 },
    accuracy: 11, // est.
    hipError: 1.8,
    recoil: { rise: 0.6, side: 0.28 },
    sound: 'pistol',
    info: 'The Tula Korovin, the first Soviet automatic pistol: a 6.35 mm pocket gun for officers, commissars and the NKVD. Eight small rounds.',
  },
};
