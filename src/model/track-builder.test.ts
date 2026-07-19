import { describe, expect, it } from 'vitest';
import { segmentPoints } from './track-builder';
import type { TrackPoint } from './types';

function point(tOffsetSec: number, sunlit: boolean): TrackPoint {
  return { tOffsetSec, azDeg: 0, elDeg: 0, sunlit };
}

describe('segmentPoints', () => {
  it('returns a single segment when all points share the same sunlit state', () => {
    const points = [point(0, true), point(15, true), point(30, true)];
    const segments = segmentPoints(points);

    expect(segments).toHaveLength(1);
    expect(segments[0].sunlit).toBe(true);
    expect(segments[0].points).toHaveLength(3);
  });

  it('splits into segments at each sunlit transition, sharing the boundary point', () => {
    const points = [
      point(0, true),
      point(15, true),
      point(30, false),
      point(45, false),
      point(60, true),
    ];
    const segments = segmentPoints(points);

    expect(segments.map((s) => s.sunlit)).toEqual([true, false, true]);
    // Each new segment starts by duplicating the last point of the previous
    // segment, so the rendered polyline has no gap where the sunlit/eclipsed
    // style changes. The transition sample itself (already classified as the
    // new state) falls inside the new segment, not the old one.
    expect(segments[0].points.map((p) => p.tOffsetSec)).toEqual([0, 15]);
    expect(segments[1].points.map((p) => p.tOffsetSec)).toEqual([15, 30, 45]);
    expect(segments[2].points.map((p) => p.tOffsetSec)).toEqual([45, 60]);
  });

  it('returns an empty array for no points', () => {
    expect(segmentPoints([])).toEqual([]);
  });
});
