import type { SatRec } from 'satellite.js';
import type { ObserverDeg } from '../astro/coords';
import { TRACK_FORWARD_MAX_SEC, TRACK_STEP_SEC, TRACK_TRAIL_SEC } from '../utils/constants';
import { computeSatellitePosition } from './satellite-state';
import type { SatelliteTrack, TrackPoint, TrackSegment } from './types';

/**
 * Samples a satellite's path from a short trailing tail through a forward window,
 * then run-length-encodes consecutive sunlit/eclipsed samples into segments so
 * renderers can style each segment independently (bright while sunlit, faint once
 * it crosses into Earth's shadow). Segments share their boundary point so the
 * polyline stays visually continuous across a style change.
 */
export function buildTrack(satrec: SatRec, observer: ObserverDeg, id: string, now: Date, sizeM2: number): SatelliteTrack {
  const points: TrackPoint[] = [];

  for (let tOffsetSec = -TRACK_TRAIL_SEC; tOffsetSec <= TRACK_FORWARD_MAX_SEC; tOffsetSec += TRACK_STEP_SEC) {
    const sampleDate = new Date(now.getTime() + tOffsetSec * 1000);
    const pos = computeSatellitePosition(satrec, observer, sampleDate, sizeM2);
    if (!pos) continue;
    points.push({ tOffsetSec, azDeg: pos.azDeg, elDeg: pos.elDeg, sunlit: pos.illuminated });
  }

  return { id, segments: segmentPoints(points) };
}

/**
 * Run-length-encodes consecutive same-sunlit points into segments, duplicating each
 * boundary point into both segments so the polyline has no visual gap where the
 * style changes. Exported separately from buildTrack so this logic is unit-testable
 * without needing real SGP4 propagation.
 */
export function segmentPoints(points: TrackPoint[]): TrackSegment[] {
  const segments: TrackSegment[] = [];
  let current: TrackPoint[] = [];
  let currentSunlit: boolean | null = null;

  for (const point of points) {
    if (currentSunlit === null) {
      currentSunlit = point.sunlit;
      current = [point];
      continue;
    }

    if (point.sunlit === currentSunlit) {
      current.push(point);
    } else {
      segments.push({ sunlit: currentSunlit, points: current });
      current = [current[current.length - 1], point];
      currentSunlit = point.sunlit;
    }
  }

  if (current.length > 0 && currentSunlit !== null) {
    segments.push({ sunlit: currentSunlit, points: current });
  }

  return segments;
}
