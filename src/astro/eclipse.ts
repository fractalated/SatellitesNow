import type { EciVec3 } from 'satellite.js';
import { EARTH_RADIUS_KM } from '../utils/constants';

/**
 * Cylindrical Earth-shadow test: is the satellite eclipsed (not sunlit)?
 * Ignores penumbra (conical shadow) — a standard simplification, fine at the
 * line-width precision this app renders tracks at.
 */
export function isEclipsed(satEci: EciVec3<number>, sunUnit: EciVec3<number>): boolean {
  const alongSun = satEci.x * sunUnit.x + satEci.y * sunUnit.y + satEci.z * sunUnit.z;
  if (alongSun > 0) return false; // satellite is on the sun-facing side

  const perpX = satEci.x - alongSun * sunUnit.x;
  const perpY = satEci.y - alongSun * sunUnit.y;
  const perpZ = satEci.z - alongSun * sunUnit.z;
  const perpDistKm = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);

  return perpDistKm < EARTH_RADIUS_KM;
}
