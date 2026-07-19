import { propagate } from 'satellite.js';
import type { SatRec } from 'satellite.js';
import { lookAnglesDeg, type ObserverDeg } from '../astro/coords';
import { isEclipsed } from '../astro/eclipse';
import { sunEciUnitVector } from '../astro/sun';

export interface SatellitePosition {
  azDeg: number;
  elDeg: number;
  rangeKm: number;
  illuminated: boolean;
}

/**
 * Propagates one satellite to `date` and returns its topocentric look angles plus
 * whether it's currently sunlit. Returns null if propagation failed (e.g. a decayed
 * object with invalid elements) so callers can skip it.
 */
export function computeSatellitePosition(
  satrec: SatRec,
  observer: ObserverDeg,
  date: Date,
): SatellitePosition | null {
  const { position } = propagate(satrec, date);
  if (!position || typeof position === 'boolean') return null;

  const look = lookAnglesDeg(position, observer, date);
  const sunlit = !isEclipsed(position, sunEciUnitVector(date));

  return { azDeg: look.azDeg, elDeg: look.elDeg, rangeKm: look.rangeKm, illuminated: sunlit };
}
