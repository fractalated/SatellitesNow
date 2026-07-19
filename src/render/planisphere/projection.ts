import { degToRad } from '../../utils/math';

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Azimuthal-equidistant sky-dome projection: zenith (el=90) at the circle's
 * center, horizon (el=0) at its edge. North at top, East to the right (standard
 * compass-rose orientation, matching "looking up" rather than "looking down at a map").
 */
export function azElToScreen(azDeg: number, elDeg: number, centerX: number, centerY: number, radius: number): ScreenPoint {
  const r = (radius * (90 - elDeg)) / 90;
  const azRad = degToRad(azDeg);
  return {
    x: centerX + r * Math.sin(azRad),
    y: centerY - r * Math.cos(azRad),
  };
}
