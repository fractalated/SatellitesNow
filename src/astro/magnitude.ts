import type { EciVec3 } from 'satellite.js';
import { dot, normalize, subtract, type Vec3 } from '../utils/vec3';

/**
 * Generic size assumptions (m^2 of reflective cross-section) used when CelesTrak's
 * SATCAT has no measured RCS for an object -- which is most of them, and *all*
 * Starlinks specifically. These are deliberately rough: Starlink's flat-panel bus is
 * a publicly documented, roughly uniform design (~2.8m x 1.4m), so one assumption
 * reasonably covers the whole constellation; rocket bodies tend to be large
 * cylindrical stages; everything else falls back to a generic mid-size guess. This
 * is a physics-based brightness *ranking*, not a precise magnitude match to
 * empirically-calibrated services like Heavens-Above.
 */
export const STARLINK_ASSUMED_SIZE_M2 = 4;
export const ROCKET_BODY_ASSUMED_SIZE_M2 = 10;
export const DEFAULT_ASSUMED_SIZE_M2 = 2;

export function resolveSizeM2(name: string, objectType: string | undefined, rcsM2: number | undefined): number {
  if (typeof rcsM2 === 'number' && rcsM2 > 0) return rcsM2;
  if (name.toUpperCase().includes('STARLINK')) return STARLINK_ASSUMED_SIZE_M2;
  if (objectType === 'R/B') return ROCKET_BODY_ASSUMED_SIZE_M2;
  return DEFAULT_ASSUMED_SIZE_M2;
}

/** Sun-satellite-observer phase angle in radians (0 = fully lit facing the observer,
 * pi = backlit). The satellite-to-sun direction is approximated as the Earth-to-sun
 * unit vector (sunUnit) -- the sun is ~150 million km away vs. a satellite's few
 * thousand km from Earth's center, so the parallax this ignores is negligible. */
export function phaseAngleRad(satEci: EciVec3<number>, observerEci: EciVec3<number>, sunUnit: Vec3): number {
  const toObserver = normalize(subtract(observerEci, satEci));
  const cosPhase = Math.max(-1, Math.min(1, dot(sunUnit, toObserver)));
  return Math.acos(cosPhase);
}

/**
 * Rough apparent visual magnitude via the standard diffuse-sphere reflection model:
 * a satellite of cross-sectional area A at range d, phase angle beta, reflects
 * sunlight proportional to A * [sin(beta) + (pi-beta)*cos(beta)] / d^2. The additive
 * constant is calibrated so a ~400km-range, fully-lit (beta~0), 399m^2 object (the
 * ISS's actual RCS) comes out around magnitude -2.5, matching its well-known typical
 * peak brightness -- a single calibration point, not an empirically fitted model, so
 * treat the result as a brightness *ranking* rather than a precise prediction.
 */
export function estimateApparentMagnitude(rangeKm: number, phaseAngleRadians: number, sizeM2: number): number {
  const phaseFactor = Math.sin(phaseAngleRadians) + (Math.PI - phaseAngleRadians) * Math.cos(phaseAngleRadians);
  // A small epsilon rather than a strict <=0, since floating point leaves a tiny
  // (~1e-16) positive residual at phaseAngle=pi instead of an exact zero.
  if (phaseFactor < 1e-6) return Number.POSITIVE_INFINITY; // effectively unlit from the observer's viewpoint

  const CALIBRATION_CONSTANT = 7.2;
  return (
    CALIBRATION_CONSTANT -
    2.5 * Math.log10(sizeM2) +
    5 * Math.log10(rangeKm / 1000) -
    2.5 * Math.log10(phaseFactor)
  );
}
