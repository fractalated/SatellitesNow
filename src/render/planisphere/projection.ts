import { degToRad } from '../../utils/math';

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Azimuthal-equidistant sky-dome projection: zenith (el=90) at the circle's
 * center, horizon (el=0) at its edge. North at top, **East to the left** — this
 * looks backwards next to a ground map, but it's the standard, correct convention
 * for sky charts (confirmed against Heavens-Above's live sky view): the chart
 * represents looking *up* at the celestial sphere from inside it, which mirrors a
 * top-down map view of the ground. Getting this backwards was a real bug here
 * (previously East was placed on the right, i.e. mirrored east/west).
 */
export function azElToScreen(azDeg: number, elDeg: number, centerX: number, centerY: number, radius: number): ScreenPoint {
  const r = (radius * (90 - elDeg)) / 90;
  const azRad = degToRad(azDeg);
  return {
    x: centerX - r * Math.sin(azRad),
    y: centerY - r * Math.cos(azRad),
  };
}
