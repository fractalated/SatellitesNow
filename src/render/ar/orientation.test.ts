import { describe, expect, it } from 'vitest';
import { computeHeadingDeg, computePitchDeg } from './orientation';

describe('computePitchDeg', () => {
  it('is 0 (horizon) when the phone is held upright with no roll', () => {
    expect(computePitchDeg(90, 0)).toBeCloseTo(0, 5);
  });

  it('increases as the phone tilts back (top toward the sky) past vertical', () => {
    expect(computePitchDeg(135, 0)).toBeCloseTo(45, 1);
    expect(computePitchDeg(180, 0)).toBeCloseTo(90, 1);
  });

  it('decreases (points down) as the phone tilts forward past vertical', () => {
    expect(computePitchDeg(45, 0)).toBeCloseTo(-45, 1);
  });
});

describe('computeHeadingDeg', () => {
  it('uses webkitCompassHeading directly when present (iOS)', () => {
    expect(computeHeadingDeg({ webkitCompassHeading: 123 } as never)).toBe(123);
  });

  it('converts counterclockwise alpha to clockwise compass heading otherwise', () => {
    expect(computeHeadingDeg({ alpha: 0 } as never)).toBeCloseTo(0, 5);
    expect(computeHeadingDeg({ alpha: 90 } as never)).toBeCloseTo(270, 5);
    expect(computeHeadingDeg({ alpha: 270 } as never)).toBeCloseTo(90, 5);
  });
});
