import type { EciVec3 } from 'satellite.js';
import { degToRad } from '../utils/math';
import { julianCenturiesSinceJ2000, julianDate } from './time';

/**
 * Low-precision solar position (Astronomical Almanac / Vallado algorithm, ~0.01deg
 * accurate 1950-2050), returning a unit vector from Earth toward the Sun in the
 * ECI frame. satellite.js has no solar ephemeris of its own, so this fills that gap
 * without pulling in a full astronomy library.
 */
export function sunEciUnitVector(date: Date): EciVec3<number> {
  const t = julianCenturiesSinceJ2000(julianDate(date));

  const meanLongitudeDeg = 280.46 + 36000.771 * t;
  const meanAnomalyDeg = 357.5291092 + 35999.05034 * t;
  const meanAnomalyRad = degToRad(meanAnomalyDeg);

  const eclipticLongitudeDeg =
    meanLongitudeDeg +
    1.914666471 * Math.sin(meanAnomalyRad) +
    0.019994643 * Math.sin(2 * meanAnomalyRad);
  const eclipticLongitudeRad = degToRad(eclipticLongitudeDeg);

  const obliquityDeg = 23.439291 - 0.0130042 * t;
  const obliquityRad = degToRad(obliquityDeg);

  const sinLambda = Math.sin(eclipticLongitudeRad);

  return {
    x: Math.cos(eclipticLongitudeRad),
    y: Math.cos(obliquityRad) * sinLambda,
    z: Math.sin(obliquityRad) * sinLambda,
  };
}
