import { clamp, degToRad, radToDeg, wrapDeg360 } from '../../utils/math';
import type { DeviceHeading } from './ar-projection';

const SMOOTHING_ALPHA = 0.15;

interface IOSDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
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

  next(headingDeg: number): number {
    const rad = degToRad(headingDeg);
    const cx = Math.cos(rad);
    const cy = Math.sin(rad);

    if (this.x === null || this.y === null) {
      this.x = cx;
      this.y = cy;
    } else {
      this.x += (cx - this.x) * SMOOTHING_ALPHA;
      this.y += (cy - this.y) * SMOOTHING_ALPHA;
    }

    return wrapDeg360(radToDeg(Math.atan2(this.y, this.x)));
  }
}

/**
 * Subscribes to device orientation, unifying iOS/Android quirks into a smoothed
 * {headingDeg, pitchDeg} stream. Returns an unsubscribe function.
 *
 * Listens for both 'deviceorientationabsolute' and 'deviceorientation' rather than
 * picking one via `'ondeviceorientationabsolute' in window` — that property can be
 * defined (truthy) by a browser's DOM even when the event itself never actually
 * fires (confirmed in headless Chromium with no real sensors), which would silently
 * freeze tracking on any platform where that mismatch holds. If both fire, it's
 * harmless — they report the same physical orientation.
 */
export function startOrientationTracking(onUpdate: (heading: DeviceHeading) => void): () => void {
  const smoother = new CircularSmoother();
  let smoothedPitch: number | null = null;

  const handler = (event: Event) => {
    const orientationEvent = event as IOSDeviceOrientationEvent;
    if (orientationEvent.beta === null || orientationEvent.gamma === null) return;

    const headingDeg = smoother.next(computeHeadingDeg(orientationEvent));
    const rawPitch = computePitchDeg(orientationEvent.beta ?? 0, orientationEvent.gamma ?? 0);
    smoothedPitch = smoothedPitch === null ? rawPitch : smoothedPitch + (rawPitch - smoothedPitch) * SMOOTHING_ALPHA;

    onUpdate({ headingDeg, pitchDeg: smoothedPitch });
  };

  window.addEventListener('deviceorientationabsolute', handler);
  window.addEventListener('deviceorientation', handler);
  return () => {
    window.removeEventListener('deviceorientationabsolute', handler);
    window.removeEventListener('deviceorientation', handler);
  };
}
