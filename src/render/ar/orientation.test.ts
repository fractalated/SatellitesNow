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

  it('holds heading steady on a single large jump instead of moving toward it at all', () => {
    const tracker = new OrientationTracker();
    for (let i = 0; i < 10; i++) {
      tracker.process({ hasCompassHeading: true, headingDeg: 90, betaDeg: 90, gammaDeg: 0 });
    }

    // A single big jump (e.g. one bad compass sample) shouldn't move the displayed
    // heading at all yet -- it's an unconfirmed candidate until several consecutive
    // samples agree with it.
    const afterJump = tracker.process({ hasCompassHeading: true, headingDeg: 270, betaDeg: 90, gammaDeg: 0 });
    expect(afterJump).not.toBeNull();
    expect(afterJump!.headingDeg).toBeCloseTo(90, 5);
  });

  // Regression test for a real, reported device issue: some phones' tilt-compensated
  // compass reading flips ~180deg at a specific pitch and flips back, reproduced by
  // the reporter in their phone's own native Compass app -- confirming it's a
  // device/OS sensor-fusion quirk, not something wrong with this app's math. The
  // fix can't correct the phone's sensor, but it can refuse to react to a flip that
  // doesn't hold steady.
  it('rejects a brief flip/flutter that never sustains for long enough to confirm', () => {
    const tracker = new OrientationTracker();
    for (let i = 0; i < 10; i++) {
      tracker.process({ hasCompassHeading: true, headingDeg: 90, betaDeg: 90, gammaDeg: 0 });
    }

    // Flutters back and forth between the real heading and the flipped one, never
    // staying on either long enough to reach JUMP_CONFIRM_SAMPLES in a row.
    let last;
    for (const headingDeg of [270, 91, 269, 89, 271, 90, 268]) {
      last = tracker.process({ hasCompassHeading: true, headingDeg, betaDeg: 90, gammaDeg: 0 })!;
    }
    // The 91/89/90 samples are within the normal (non-outlier) threshold and blend
    // in as ordinary small jitter, so this won't be exactly 90 -- the point is it
    // stays near the real heading, nowhere near the flipped ~270 candidate.
    expect(last!.headingDeg).toBeCloseTo(90, 1);
  });

  it('accepts a large jump once it sustains for JUMP_CONFIRM_SAMPLES in a row (a real turn)', () => {
    const tracker = new OrientationTracker();
    for (let i = 0; i < 10; i++) {
      tracker.process({ hasCompassHeading: true, headingDeg: 90, betaDeg: 90, gammaDeg: 0 });
    }

    let last;
    for (let i = 0; i < 6; i++) {
      last = tracker.process({ hasCompassHeading: true, headingDeg: 270, betaDeg: 90, gammaDeg: 0 })!;
    }
    expect(last!.headingDeg).toBeCloseTo(270, 5);
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
