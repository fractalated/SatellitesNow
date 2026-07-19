import { describe, expect, it } from 'vitest';
import { splitAboveHorizon } from './horizon-clip';
import type { TrackPoint } from '../../model/types';

function point(tOffsetSec: number, elDeg: number): TrackPoint {
  return { tOffsetSec, azDeg: 0, elDeg, sunlit: true };
}

describe('splitAboveHorizon', () => {
  it('returns one run when everything is above horizon', () => {
    const runs = splitAboveHorizon([point(0, 10), point(1, 20), point(2, 30)]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(3);
  });

  it('returns no runs when everything is below horizon', () => {
    expect(splitAboveHorizon([point(0, -10), point(1, -5)])).toEqual([]);
  });

  it('splits into separate runs across a below-horizon dip', () => {
    const runs = splitAboveHorizon([
      point(0, 10),
      point(1, -5),
      point(2, -1),
      point(3, 5),
      point(4, 15),
    ]);
    expect(runs).toHaveLength(2);
    expect(runs[0].map((p) => p.tOffsetSec)).toEqual([0]);
    expect(runs[1].map((p) => p.tOffsetSec)).toEqual([3, 4]);
  });

  it('treats exactly 0 elevation as above horizon', () => {
    const runs = splitAboveHorizon([point(0, 0)]);
    expect(runs).toHaveLength(1);
  });
});
