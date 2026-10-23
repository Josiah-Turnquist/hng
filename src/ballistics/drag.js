// Air drag on a projectile from a standard drag table and a ballistic coefficient.
//
// For a bullet with ballistic coefficient BC (published in lb/in^2 against a
// reference shape G1/G7/...), the drag deceleration is:
//     a = (pi/8) * rho * v^2 * Cd_ref(Mach) / (BC * 703.07)
// where rho is air density (kg/m^3), v is speed through the air (m/s), and
// 703.07 converts lb/in^2 to kg/m^2. Published BCs assume the ICAO standard
// atmosphere (1.225 kg/m^3), so using the real local density handles altitude,
// heat and cold correctly.
import { G1, G2, G7 } from './dragTables.js';

export const TABLES = { G1, G2, G7 };
export const LB_IN2_TO_KG_M2 = 703.0696;

// Linear interpolation in a flat [mach, cd, mach, cd, ...] table.
export function cdAt(table, mach) {
  const n = table.length / 2;
  if (mach <= table[0]) return table[1];
  if (mach >= table[(n - 1) * 2]) return table[(n - 1) * 2 + 1];
  let lo = 0,
    hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid * 2] <= mach) lo = mid;
    else hi = mid;
  }
  const m0 = table[lo * 2],
    c0 = table[lo * 2 + 1];
  const m1 = table[hi * 2],
    c1 = table[hi * 2 + 1];
  return c0 + ((c1 - c0) * (mach - m0)) / (m1 - m0);
}

// Drag deceleration magnitude (m/s^2) for speed v through air.
export function dragDecel(table, bc, v, density, speedOfSound) {
  const cd = cdAt(table, v / speedOfSound);
  return ((Math.PI / 8) * density * v * v * cd) / (bc * LB_IN2_TO_KG_M2);
}
