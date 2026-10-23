// How bullets interact with materials: penetration, exit speed and ricochet.
//
// Penetration uses a two-term resistance law (a Poncelet-type model):
//     m dv/dx = -A * (sigma + Cd * rho * v^2)
// sigma is the material's resistance to being crushed (Pa) and rho its density.
// The fast term (rho v^2) dominates for rifle bullets in soft materials; the
// strength term dominates for slow bullets and hard materials. Integrating over a
// thickness t gives the exit speed:
//     v_exit^2 = (v^2 + s) * exp(-k t) - s,   k = 2 A Cd rho / m,   s = sigma / (Cd rho)
// The constants below were calibrated so that a .30-06 ball round (9.8 g at
// 850 m/s) gets through roughly: 60 cm of pine, 15 cm of brick, 10 cm of
// concrete, 35 cm of sand, 45 cm of packed earth, 9 mm of mild steel; and a
// 9 mm pistol round about 14 cm of pine and 3 cm of brick - in line with
// military field-fortification guidance and published test shooting.

export const MATERIALS = {
  wood: { name: 'wood', density: 550, strength: 3.6e7, cd: 0.8, ricochetDeg: 9, effect: 'wood', hard: false },
  plank: { name: 'wood', density: 550, strength: 3.6e7, cd: 0.8, ricochetDeg: 9, effect: 'wood', hard: false },
  brick: { name: 'brick', density: 1900, strength: 1.5e8, cd: 0.8, ricochetDeg: 16, effect: 'brick', hard: true },
  plaster: { name: 'plaster', density: 1800, strength: 1.3e8, cd: 0.8, ricochetDeg: 15, effect: 'plaster', hard: true },
  stone: { name: 'stone', density: 2500, strength: 3.2e8, cd: 0.8, ricochetDeg: 19, effect: 'stone', hard: true },
  concrete: { name: 'concrete', density: 2300, strength: 3.0e8, cd: 0.8, ricochetDeg: 18, effect: 'stone', hard: true },
  roofTile: { name: 'tile', density: 1900, strength: 1.0e8, cd: 0.8, ricochetDeg: 12, effect: 'brick', hard: true },
  sandbag: { name: 'sandbag', density: 1600, strength: 1.5e7, cd: 0.8, ricochetDeg: 8, effect: 'dust', hard: false },
  soil: { name: 'soil', density: 1700, strength: 3.4e6, cd: 0.8, ricochetDeg: 11, effect: 'dirt', hard: false },
  mud: { name: 'mud', density: 1800, strength: 1.0e6, cd: 0.8, ricochetDeg: 6, effect: 'mud', hard: false },
  sand: { name: 'sand', density: 1600, strength: 8.0e6, cd: 0.8, ricochetDeg: 9, effect: 'dust', hard: false },
  rock: { name: 'rock', density: 2600, strength: 4.0e8, cd: 0.8, ricochetDeg: 20, effect: 'stone', hard: true },
  steel: { name: 'steel', density: 7850, strength: 6.0e9, cd: 1.0, ricochetDeg: 28, effect: 'sparks', hard: true },
  armor: { name: 'armor', density: 7850, strength: 1.2e10, cd: 1.0, ricochetDeg: 32, effect: 'sparks', hard: true, isArmor: true },
  glass: { name: 'glass', density: 2500, strength: 5.0e7, cd: 0.8, ricochetDeg: 4, effect: 'glass', hard: true },
  foliage: { name: 'foliage', density: 18, strength: 0, cd: 1.0, ricochetDeg: 0, effect: 'leaves', hard: false, soft: true },
  water: { name: 'water', density: 1000, strength: 2.0e5, cd: 0.8, ricochetDeg: 7, effect: 'water', hard: false },
  flesh: { name: 'flesh', density: 1060, strength: 1.0e6, cd: 0.8, ricochetDeg: 0, effect: 'blood', hard: false },
};

// Exit speed after pushing through `thickness` meters, or 0 if the bullet stops.
// hardness > 1 for steel-core armor-piercing bullets (they resist deforming on
// hard targets, so they lose less speed there).
export function residualSpeed(v, thickness, mass, area, mat, hardness = 1) {
  const cd = mat.cd;
  const k = (2 * area * cd * mat.density) / mass;
  const strength = mat.hard ? mat.strength / hardness : mat.strength;
  const s = strength / (cd * mat.density);
  const v2 = (v * v + s) * Math.exp(-k * thickness) - s;
  return v2 > 0 ? Math.sqrt(v2) : 0;
}

// How deep a bullet would go into an endless block of the material (meters).
export function penetrationDepth(v, mass, area, mat, hardness = 1) {
  const cd = mat.cd;
  const k = (2 * area * cd * mat.density) / mass;
  const strength = mat.hard ? mat.strength / hardness : mat.strength;
  if (strength <= 0) return Infinity;
  const s = strength / (cd * mat.density);
  return Math.log(1 + (v * v) / s) / k;
}

// Chance that a bullet glances off rather than digging in, given the grazing
// angle (radians between the flight path and the surface).
export function ricochetChance(grazingRad, mat, speed) {
  const crit = (mat.ricochetDeg * Math.PI) / 180;
  if (crit <= 0 || grazingRad >= crit) return 0;
  const x = grazingRad / crit;
  // Slower bullets ricochet more readily off hard surfaces.
  const slow = speed < 300 ? 1.15 : 1;
  return Math.min(1, (1 - x * x) * slow);
}

// ---------------------------------------------------------------------------
// Armor (rolled homogeneous armor plate) for anti-tank weapons and tank guns.
//
// Kinetic shells: penetration scales with impact velocity following the
// de Marre relation P ~ v^1.43 (same shell). Each ammo type gives a reference
// penetration (mm of armor at 0 degrees) at a reference velocity.
// Shaped-charge (HEAT) warheads: penetration doesn't depend on velocity.
export function armorPenetrationMM(ammo, speed) {
  if (ammo.heat) return ammo.penetrationMM;
  if (!ammo.penRefMM) return 0;
  return ammo.penRefMM * Math.pow(Math.max(0, speed) / ammo.penRefVel, 1.43);
}

// Effective thickness of a plate hit at angle `angleRad` from the plate normal.
// Capped shells "normalize" (turn into the plate) a few degrees.
export function effectiveArmorMM(thicknessMM, angleRad, ammo) {
  let a = angleRad;
  if (!ammo.heat && ammo.capped) a = Math.max(0, a - (5 * Math.PI) / 180);
  a = Math.min(a, (85 * Math.PI) / 180);
  return thicknessMM / Math.cos(a);
}
