import { propagate } from 'satellite.js';
import type { SatRec } from 'satellite.js';
import { lookAnglesDeg, observerEciPosition, type ObserverDeg } from '../astro/coords';
import { isEclipsed } from '../astro/eclipse';
import { estimateApparentMagnitude, phaseAngleRad } from '../astro/magnitude';
import { sunEciUnitVector } from '../astro/sun';

export interface SatellitePosition {
  azDeg: number;
  elDeg: number;
  rangeKm: number;
  illuminated: boolean;
  /** Estimated apparent visual magnitude (lower = brighter). Infinity when the
   * satellite is eclipsed (in Earth's shadow) — not visible regardless of geometry. */
  magnitude: number;
}

/**
 * Propagates one satellite to `date` and returns its topocentric look angles,
 * whether it's currently sunlit, and an estimated apparent magnitude. Returns null
 * if propagation failed (e.g. a decayed object with invalid elements) so callers
 * can skip it.
 */
export function computeSatellitePosition(
  satrec: SatRec,
  observer: ObserverDeg,
  date: Date,
  sizeM2: number,
): SatellitePosition | null {
  const { position } = propagate(satrec, date);
  if (!position || typeof position === 'boolean') return null;

  const look = lookAnglesDeg(position, observer, date);
  const sunUnit = sunEciUnitVector(date);
  const sunlit = !isEclipsed(position, sunUnit);

  const magnitude = sunlit
    ? estimateApparentMagnitude(look.rangeKm, phaseAngleRad(position, observerEciPosition(observer, date), sunUnit), sizeM2)
    : Number.POSITIVE_INFINITY;

  return { azDeg: look.azDeg, elDeg: look.elDeg, rangeKm: look.rangeKm, illuminated: sunlit, magnitude };
}
