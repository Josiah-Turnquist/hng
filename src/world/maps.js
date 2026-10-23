// Map definitions. Coordinates: x = east, z = south (so -z is north), y = up, meters.

export const MAPS = {
  // A Central-European farming village in late summer 1944: church square,
  // farms, a river with a stone bridge, hedgerow fields and woods. Attackers come
  // from the western hills, defenders hold the village.
  village: {
    id: 'village',
    name: 'Grauwald',
    description: 'Farming village on the river Lenne. Attackers advance from the western ridge.',
    size: 2048,
    res: 1025,
    seed: 1944,
    altitude: 180, // meters above sea level (for air density)
    temperatureC: 18,
    baseAltitude: 0,
    hills: 24,
    undulation: 6.5,
    edgeHills: 75,
    playRadius: 720,
    sun: { elevation: 33, azimuth: 205 },
    village: { x: 0, z: 0, radius: 135, falloff: 140, tilt: 0.6 },
    river: {
      points: [
        [250, -1100],
        [300, -650],
        [235, -300],
        [262, -60],
        [300, 160],
        [270, 480],
        [330, 800],
        [380, 1100],
      ],
      width: 16,
      depth: 2.2,
      valley: 55,
      sink: 2.6,
    },
    roads: [
      {
        id: 'main',
        points: [
          [-1100, 70],
          [-760, 40],
          [-430, 18],
          [-180, 4],
          [0, 0],
          [140, -6],
          [262, -10],
          [420, -40],
          [700, -120],
          [1100, -170],
        ],
        width: 6,
        kind: 'dirt',
      },
      {
        id: 'north',
        points: [
          [-6, -2],
          [-24, -190],
          [6, -420],
          [-50, -760],
          [-80, -1100],
        ],
        width: 5,
        kind: 'dirt',
      },
      {
        id: 'south',
        points: [
          [4, 4],
          [36, 170],
          [96, 400],
          [62, 760],
          [120, 1100],
        ],
        width: 5,
        kind: 'dirt',
      },
      {
        id: 'farm',
        points: [
          [-180, 4],
          [-250, 120],
          [-300, 260],
        ],
        width: 4,
        kind: 'dirt',
      },
    ],
    forests: [
      { x: -560, z: -470, r: 330, strength: 0.55 },
      { x: 600, z: 520, r: 300, strength: 0.5 },
      { x: 520, z: -560, r: 220, strength: 0.35 },
    ],
    forestThreshold: 0.3,
    fieldSize: 72,
    hedgeChance: 0.5,
    features: [
      { x: -640, z: 160, rx: 320, rz: 240, height: 16 },
      { x: 560, z: 200, rx: 220, rz: 300, height: 9 },
    ],
    craterZones: [
      { x: -330, z: 30, r: 230, count: 38, min: 2.2, max: 5.5 },
      { x: -120, z: -40, r: 110, count: 10, min: 1.8, max: 3.5 },
    ],
  },
};
