import { describe, expect, it } from 'vitest';
import { computeHeadingDeg, computePitchDeg, OrientationTracker } from './orientation';

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

// Regression tests for a real bug: iOS fired both 'deviceorientation' (carrying a
// true-north webkitCompassHeading) and 'deviceorientationabsolute' (a raw alpha
// fallback, differently referenced) for the same physical orientation. Feeding both
// into one smoother made the displayed heading alternate between two disagreeing
// values, which looked exactly like satellite tracks jumping around on a barely-
// moved phone (observed: heading reported 94deg then 271deg from a "slight" tilt).
describe('OrientationTracker', () => {
  it('ignores non-compass samples once a compass-bearing sample has been seen', () => {
    const tracker = new OrientationTracker();

    const first = tracker.process({ hasCompassHeading: true, headingDeg: 90, betaDeg: 90, gammaDeg: 0 });
    expect(first).not.toBeNull();

    // A wildly different reading from a non-compass source (e.g. the alpha
    // fallback on a competing event type) must be ignored, not blended in.
    const second = tracker.process({ hasCompassHeading: false, headingDeg: 270, betaDeg: 90, gammaDeg: 0 });
    expect(second).toBeNull();
  });

  it('accepts alpha-fallback samples throughout when no compass heading is ever available (e.g. Android)', () => {
    const tracker = new OrientationTracker();
    for (const headingDeg of [10, 15, 20, 25]) {
      expect(tracker.process({ hasCompassHeading: false, headingDeg, betaDeg: 90, gammaDeg: 0 })).not.toBeNull();
    }
  });

  it('heavily damps a large sudden heading jump instead of snapping to it', () => {
    const tracker = new OrientationTracker();
    for (let i = 0; i < 10; i++) {
      tracker.process({ hasCompassHeading: true, headingDeg: 90, betaDeg: 90, gammaDeg: 0 });
    }

    // A single big jump (simulating an indoor magnetic glitch) should barely move
    // the smoothed output on the very next sample.
    const afterJump = tracker.process({ hasCompassHeading: true, headingDeg: 270, betaDeg: 90, gammaDeg: 0 });
    expect(afterJump).not.toBeNull();
    expect(Math.abs(afterJump!.headingDeg - 90)).toBeLessThan(15);
  });

  it('tracks a real, gradual turn responsively (not treated as noise)', () => {
    const tracker = new OrientationTracker();
    let last = tracker.process({ hasCompassHeading: true, headingDeg: 0, betaDeg: 90, gammaDeg: 0 })!;
    for (const headingDeg of [10, 20, 30, 40, 50]) {
      last = tracker.process({ hasCompassHeading: true, headingDeg, betaDeg: 90, gammaDeg: 0 })!;
    }
    // After several consistent 10deg steps, smoothed heading should have followed
    // along meaningfully (EMA lags the raw signal, so it won't fully catch up to
    // 50 — the point is it isn't pinned near 0 the way a noise-rejected jump is).
    expect(last.headingDeg).toBeGreaterThan(15);
  });
});
