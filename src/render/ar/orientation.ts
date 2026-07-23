import { clamp, degToRad, radToDeg, wrapDeg180, wrapDeg360 } from '../../utils/math';
import type { DeviceHeading } from './ar-projection';

const SMOOTHING_ALPHA = 0.15;

interface IOSDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

/**
 * Must be called from within a user-gesture handler (e.g. a button tap) on iOS —
 * Safari requires that before it will fire deviceorientation events at all.
 * Returns true if permission is granted (or not required, e.g. on Android).
 */
export async function requestOrientationPermission(): Promise<boolean> {
  const RequestingEvent = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };

  if (typeof RequestingEvent.requestPermission !== 'function') return true;

  try {
    return (await RequestingEvent.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Computes device pitch (elevation of the rear camera's pointing direction, 0 =
 * horizon, 90 = straight up) from beta/gamma. This is the well-grounded half of
 * the device-orientation math: at beta=90 (phone held upright, screen facing the
 * user) with no roll, pitch is 0 (camera pointing at the horizon); tilting the top
 * of the phone back past vertical increases pitch, matching pointing the camera
 * up at the sky.
 */
export function computePitchDeg(betaDeg: number, gammaDeg: number): number {
  const betaRad = degToRad(betaDeg);
  const gammaRad = degToRad(gammaDeg);
  return radToDeg(Math.asin(clamp(-Math.cos(betaRad) * Math.cos(gammaRad), -1, 1)));
}

/**
 * Compass heading of the device's facing direction (0=N, 90=E, clockwise).
 * iOS provides an already tilt-compensated `webkitCompassHeading` directly, so we
 * use it as-is. Elsewhere, `alpha` increases counterclockwise while compass
 * headings increase clockwise, hence `360 - alpha` (a standard, widely-used
 * conversion). v1 explicitly ignores device roll (gamma) in this heading estimate —
 * fine for the common "phone held upright, not tilted sideways" AR pose, but a
 * known simplification; see the plan notes on AR projection.
 */
export function computeHeadingDeg(event: IOSDeviceOrientationEvent): number {
  if (typeof event.webkitCompassHeading === 'number') {
    return event.webkitCompassHeading;
  }
  return wrapDeg360(360 - (event.alpha ?? 0));
}

class CircularSmoother {
  private x: number | null = null;
  private y: number | null = null;

  next(headingDeg: number, alpha: number = SMOOTHING_ALPHA): number {
    const rad = degToRad(headingDeg);
    const cx = Math.cos(rad);
    const cy = Math.sin(rad);

    if (this.x === null || this.y === null) {
      this.x = cx;
      this.y = cy;
    } else {
      this.x += (cx - this.x) * alpha;
      this.y += (cy - this.y) * alpha;
    }

    return wrapDeg360(radToDeg(Math.atan2(this.y, this.x)));
  }
}

/** Beyond this jump from the current displayed heading, don't trust the sample
 * immediately -- some phones' tilt-compensated compass calculation is genuinely
 * unstable at specific pitch transitions (reported: a clean ~180deg flip at
 * pitchDeg~45, reproduced in the phone's own native Compass app, so it's a
 * device/OS sensor-fusion issue, not something wrong with the incoming data
 * stream itself -- webkitCompassHeading really is reporting a different, wrong
 * value some of the time). */
export const OUTLIER_JUMP_THRESHOLD_DEG = 45;
/** How close consecutive big-jump samples must stay to each other to count as the
 * same candidate (rather than each restarting the confirmation count from noise
 * bouncing around). */
export const JUMP_CONFIRM_TOLERANCE_DEG = 25;
/** Consecutive agreeing samples required before a big jump is trusted and applied.
 * At a typical ~30-60Hz event rate this is well under a quarter second -- enough to
 * reject brief flips/flutter without adding noticeable lag to a genuine turn. */
export const JUMP_CONFIRM_SAMPLES = 6;

export interface RawOrientationSample {
  hasCompassHeading: boolean;
  headingDeg: number;
  betaDeg: number;
  gammaDeg: number;
  accuracyDeg?: number;
}

/**
 * Pure, DOM-free decision logic for turning a stream of raw orientation samples
 * into a smoothed heading/pitch, deliberately separated from the window event
 * wiring so it's directly unit-testable.
 *
 * Two defensive rules exist here because of real, observed problems:
 * 1. Mixing a true-north `webkitCompassHeading` source with a differently
 *    referenced raw-`alpha` source in the same smoother produced large, erratic
 *    jumps that looked like satellite tracks jumping all over the sky even though
 *    heading only changed slightly -- fixed by ignoring the non-compass source
 *    once a compass-bearing one is active.
 * 2. Some phones' own tilt-compensated compass reading flips ~180deg at a specific
 *    pitch (reproduced in the phone's native Compass app -- a device/OS issue, not
 *    fixable here). A single bad sample can't be told apart from a genuine fast
 *    turn by looking at it alone, so any jump past OUTLIER_JUMP_THRESHOLD_DEG is
 *    held as a *candidate* and only applied once JUMP_CONFIRM_SAMPLES consecutive
 *    readings agree with each other -- filtering out a brief flip/flutter while
 *    still tracking a real sustained reorientation (turning around, or following a
 *    satellite pass across zenith) after a small, deliberate delay.
 */
export class OrientationTracker {
  private readonly smoother = new CircularSmoother();
  private smoothedPitch: number | null = null;
  private lastSmoothedHeading: number | null = null;
  private pendingHeading: number | null = null;
  private pendingConfirmCount = 0;
  private sawCompassHeading = false;

  /** Returns null when this sample should be ignored (a non-compass source arriving
   * after a compass-bearing source is already active). */
  process(sample: RawOrientationSample): DeviceHeading | null {
    if (sample.hasCompassHeading) {
      this.sawCompassHeading = true;
    } else if (this.sawCompassHeading) {
      return null;
    }

    const headingDeg = this.resolveHeading(sample.headingDeg);

    const rawPitch = computePitchDeg(sample.betaDeg, sample.gammaDeg);
    this.smoothedPitch =
      this.smoothedPitch === null ? rawPitch : this.smoothedPitch + (rawPitch - this.smoothedPitch) * SMOOTHING_ALPHA;

    return { headingDeg, pitchDeg: this.smoothedPitch, accuracyDeg: sample.accuracyDeg };
  }

  private resolveHeading(rawHeadingDeg: number): number {
    if (this.lastSmoothedHeading === null) {
      this.lastSmoothedHeading = this.smoother.next(rawHeadingDeg, 1);
      return this.lastSmoothedHeading;
    }

    const jumpFromCurrent = Math.abs(wrapDeg180(rawHeadingDeg - this.lastSmoothedHeading));
    if (jumpFromCurrent <= OUTLIER_JUMP_THRESHOLD_DEG) {
      this.pendingHeading = null;
      this.pendingConfirmCount = 0;
      this.lastSmoothedHeading = this.smoother.next(rawHeadingDeg, SMOOTHING_ALPHA);
      return this.lastSmoothedHeading;
    }

    // A big jump: only count it toward confirmation if it agrees with whatever
    // candidate we were already tracking, otherwise start a new candidate.
    if (this.pendingHeading !== null && Math.abs(wrapDeg180(rawHeadingDeg - this.pendingHeading)) <= JUMP_CONFIRM_TOLERANCE_DEG) {
      this.pendingConfirmCount++;
    } else {
      this.pendingHeading = rawHeadingDeg;
      this.pendingConfirmCount = 1;
    }

    if (this.pendingConfirmCount >= JUMP_CONFIRM_SAMPLES) {
      this.pendingHeading = null;
      this.pendingConfirmCount = 0;
      this.lastSmoothedHeading = this.smoother.next(rawHeadingDeg, 1); // confirmed: snap, don't blend from the stale old value
      return this.lastSmoothedHeading;
    }

    return this.lastSmoothedHeading; // unconfirmed -- hold at the last trusted value
  }
}

/**
 * Subscribes to device orientation, unifying iOS/Android quirks into a smoothed
 * {headingDeg, pitchDeg} stream via OrientationTracker. Returns an unsubscribe
 * function.
 *
 * Listens for both 'deviceorientationabsolute' and 'deviceorientation' — Chrome
 * exposes 'ondeviceorientationabsolute' in window even when the event never
 * actually fires (confirmed in headless testing with no real sensors), which would
 * silently freeze tracking if that were the only signal picking which event to use.
 */
export function startOrientationTracking(onUpdate: (heading: DeviceHeading) => void): () => void {
  const tracker = new OrientationTracker();

  const handler = (event: Event) => {
    const orientationEvent = event as IOSDeviceOrientationEvent;
    if (orientationEvent.beta === null || orientationEvent.gamma === null) return;

    const heading = tracker.process({
      hasCompassHeading: typeof orientationEvent.webkitCompassHeading === 'number',
      headingDeg: computeHeadingDeg(orientationEvent),
      betaDeg: orientationEvent.beta ?? 0,
      gammaDeg: orientationEvent.gamma ?? 0,
      accuracyDeg: orientationEvent.webkitCompassAccuracy,
    });

    if (heading) onUpdate(heading);
  };

  window.addEventListener('deviceorientationabsolute', handler);
  window.addEventListener('deviceorientation', handler);
  return () => {
    window.removeEventListener('deviceorientationabsolute', handler);
    window.removeEventListener('deviceorientation', handler);
  };
}
