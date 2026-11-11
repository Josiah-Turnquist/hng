// How much a gun's upgrades and ammunition change a hit at a distance (see
// upgrades.js). On its own, with nothing else brought in, so the bullets'
// flight (ballistics/projectiles.js) can use it too.

// The original's damage at a distance for a round (damage, damageFar,
// rangeNear, rangeFar).
function hgDamage(h, d) {
  if (d <= h.rangeNear) return h.damage;
  if (d >= h.rangeFar) return h.damageFar;
  return h.damage + ((h.damageFar - h.damage) * (d - h.rangeNear)) / (h.rangeFar - h.rangeNear);
}

// A hit's damage multiplier: how much the gun's upgrades and ammunition change
// the original's damage at this distance. 1 for a stock gun.
export function damageScale(def, distance) {
  const h = def?.falloff;
  if (!h) return 1;
  return hgDamage(h.now, distance) / hgDamage(h.stock, distance);
}
