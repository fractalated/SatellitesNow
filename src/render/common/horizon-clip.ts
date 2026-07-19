import type { TrackPoint } from '../../model/types';

/** Splits a point list into contiguous runs where elevation is at/above the horizon,
 * so a track that dips below horizon doesn't get drawn as a straight line through the ground. */
export function splitAboveHorizon(points: TrackPoint[]): TrackPoint[][] {
  const runs: TrackPoint[][] = [];
  let current: TrackPoint[] = [];

  for (const point of points) {
    if (point.elDeg >= 0) {
      current.push(point);
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) runs.push(current);

  return runs;
}
