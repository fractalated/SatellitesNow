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

/** Beyond this raw frame-to-frame heading jump, treat the sample as compass noise
 * (indoor magnetic interference is the classic cause) rather than real motion, and
 * blend it in far more slowly instead of snapping to it immediately. */
export const OUTLIER_JUMP_THRESHOLD_DEG = 45;
export const OUTLIER_SMOOTHING_ALPHA = 0.03;

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
 * wiring so it's directly unit-testable. Two rules exist specifically because of a
 * real bug: mixing a true-north `webkitCompassHeading` source with a differently
 * referenced raw-`alpha` source in the same smoother produced large, erratic jumps
 * that looked like satellite tracks jumping all over the sky even though heading
 * only changed slightly.
 */
export class OrientationTracker {
  private readonly smoother = new CircularSmoother();
  private smoothedPitch: number | null = null;
  private lastRawHeading: number | null = null;
  private sawCompassHeading = false;

  /** Returns null when this sample should be ignored (a non-compass source arriving
   * after a compass-bearing source is already active). */
  process(sample: RawOrientationSample): DeviceHeading | null {
    if (sample.hasCompassHeading) {
      this.sawCompassHeading = true;
    } else if (this.sawCompassHeading) {
      return null;
    }

    const alpha =
      this.lastRawHeading !== null &&
      Math.abs(wrapDeg180(sample.headingDeg - this.lastRawHeading)) > OUTLIER_JUMP_THRESHOLD_DEG
        ? OUTLIER_SMOOTHING_ALPHA
        : SMOOTHING_ALPHA;
    this.lastRawHeading = sample.headingDeg;

    const headingDeg = this.smoother.next(sample.headingDeg, alpha);
    const rawPitch = computePitchDeg(sample.betaDeg, sample.gammaDeg);
    this.smoothedPitch =
      this.smoothedPitch === null ? rawPitch : this.smoothedPitch + (rawPitch - this.smoothedPitch) * SMOOTHING_ALPHA;

    return { headingDeg, pitchDeg: this.smoothedPitch, accuracyDeg: sample.accuracyDeg };
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
