// Map definitions. Coordinates: x = east, z = south (so -z is north), y = up, meters.

export const MAPS = {
  // "Town": a medium French village inside a bend of the river, modeled on the
  // Heroes & Generals assault map of the same name. The church (O2) stands in the
  // middle; the police station (O1) is about 175 m to the south-east. Attackers
  // come in along five lines (A-E). Only line A (north-west, through the woods)
  // reaches the village without crossing water; the others need the bridges
  // or the fords.
  town: {
    id: 'town',
    name: 'Saint-Aubin-sur-Lenne',
    kind: 'Town',
    description: 'A French village in a river bend. Take the police station and the church.',
    size: 2048,
    res: 1025,
    seed: 1944,
    altitude: 120, // meters above sea level (for air density)
    temperatureC: 19,
    baseAltitude: 0,
    hills: 22,
    undulation: 6,
    edgeHills: 70,
    playRadius: 760,
    // Late afternoon in late summer: the sun low in the west-south-west, warm light
    // and long shadows. (Azimuth: direction = (sin a, cos a) in x, z; 285 is WSW.)
    sun: { elevation: 19, azimuth: 285 },
    wind: { speed: 3.5, from: 250 },
    village: { x: 0, z: 30, radius: 150, falloff: 130, tilt: 0.4 },
    river: {
      points: [
        [310, -1100],
        [292, -700],
        [276, -380],
        [270, -140],
        [272, 60],
        [246, 200],
        [140, 282],
        [-20, 300],
        [-170, 268],
        [-262, 170],
        [-300, 40],
        [-420, -10],
        [-640, 10],
        [-860, 60],
        [-1100, 90],
      ],
      width: 18,
      depth: 2.3,
      valley: 50,
      sink: 2.4,
    },
    // Where roads cross the river: "destroyed" bridges leave a gap you can wade.
    bridges: [
      { road: 'main', near: [272, 0], kind: 'destroyed' },
      { road: 'main', near: [-262, 190], kind: 'stone' },
      { road: 'south', near: [90, 290], kind: 'stone' },
    ],
    roads: [
      {
        id: 'main',
        points: [
          [-1100, 520],
          [-760, 400],
          [-470, 300],
          [-262, 190],
          [-140, 90],
          [-40, 30],
          [60, 10],
          [180, 2],
          [272, 0],
          [420, -10],
          [700, -60],
          [1100, -110],
        ],
        width: 6,
        kind: 'dirt',
      },
      {
        id: 'north',
        points: [
          [-30, 20],
          [-40, -120],
          [-80, -320],
          [-160, -600],
          [-230, -1100],
        ],
        width: 5,
        kind: 'dirt',
      },
      {
        id: 'south',
        points: [
          [60, 10],
          [70, 140],
          [90, 290],
          [120, 520],
          [130, 800],
          [170, 1100],
        ],
        width: 5,
        kind: 'dirt',
      },
      {
        id: 'farm',
        points: [
          [180, 2],
          [190, -120],
          [170, -220],
        ],
        width: 4,
        kind: 'dirt',
      },
    ],
    // Objectives and lines: access point (X1) first, then X2-X4 toward the
    // objective, four points per line as on the original map.
    objectives: [
      { id: 'O1', name: 'Police Station', x: 70, z: 115, radius: 22 },
      { id: 'O2', name: 'Church', x: -25, z: -45, radius: 26 },
    ],
    lines: [
      { id: 'A', objective: 'O2', points: [[-560, -500], [-400, -340], [-240, -210], [-140, -120]] },
      { id: 'B', objective: 'O2', points: [[540, -560], [370, -380], [190, -230], [100, -140]] },
      { id: 'C', objective: 'O1', points: [[720, 160], [480, 120], [320, 95], [200, 110]] },
      { id: 'D', objective: 'O1', points: [[130, 740], [100, 500], [80, 330], [75, 235]] },
      { id: 'E', objective: 'O1', points: [[-720, 300], [-480, 250], [-300, 230], [-120, 160]] },
    ],
    forests: [
      { x: -520, z: -480, r: 320, strength: 0.7 },
      { x: 560, z: -620, r: 260, strength: 0.45 },
      { x: 600, z: 520, r: 260, strength: 0.4 },
      { x: -600, z: 560, r: 220, strength: 0.35 },
    ],
    forestThreshold: 0.32,
    fieldSize: 72,
    hedgeChance: 0.55,
    features: [
      { x: 620, z: 140, rx: 260, rz: 320, height: 14 },
      { x: -660, z: 320, rx: 300, rz: 220, height: 11 },
      { x: 120, z: 640, rx: 260, rz: 200, height: 8 },
    ],
    craterZones: [
      { x: -250, z: -150, r: 200, count: 26, min: 2.2, max: 5 },
      { x: 300, z: 60, r: 160, count: 16, min: 2, max: 4.5 },
      { x: 0, z: 0, r: 120, count: 8, min: 1.6, max: 3 },
    ],
  },

  // Flat open ground with a long firing range and a vehicle test course.
  range: {
    id: 'range',
    name: 'Proving Ground',
    kind: 'Range',
    description: 'Firing lanes from 25 to 800 m and an open area for vehicles.',
    size: 2048,
    res: 513,
    seed: 77,
    altitude: 50,
    temperatureC: 15,
    baseAltitude: 0,
    hills: 4,
    undulation: 1.2,
    edgeHills: 60,
    playRadius: 820,
    sun: { elevation: 22, azimuth: 290 }, // late afternoon, from the west: side light on the targets
    wind: { speed: 2.5, from: 270 },
    village: { x: 0, z: 0, radius: 120, falloff: 120, tilt: 0 },
    flatZones: [{ x0: -60, z0: -880, x1: 60, z1: 40, falloff: 60 }],
    roads: [],
    forests: [{ x: -600, z: 600, r: 250, strength: 0.4 }],
    forestThreshold: 0.45,
    fieldSize: 140,
    hedgeChance: 0.1,
    features: [{ x: 500, z: 300, rx: 150, rz: 150, height: 18 }],
    craterZones: [],
  },
};
