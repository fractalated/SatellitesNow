import { degToRad, radToDeg } from '../../utils/math';
import { cross, dot, normalize, type Vec3 } from '../../utils/vec3';

/**
 * Derives vertical FOV from horizontal FOV and the aspect ratio of the display,
 * for a rectilinear (pinhole) camera. The correct relationship scales the
 * *tangent* of the half-angle by the aspect ratio, not the angle itself —
 * `vFov = hFov * (height/width)` (a previous, incorrect version of this) looks
 * plausible but isn't how FOV geometry works: on a portrait phone screen
 * (height/width ~2.16), it inflated a 65deg horizontal FOV into a 140deg+
 * vertical FOV instead of the correct ~108deg, and the gnomonic projection is
 * extremely sensitive to angle right where FOV is that overestimated —
 * producing exactly the "everything shifts dramatically" distortion reported
 * for anything away from dead-center, worst near the (miscalculated) edges.
 */
export function deriveVerticalFovDeg(hFovDeg: number, widthPx: number, heightPx: number): number {
  const halfHFovRad = degToRad(hFovDeg / 2);
  const halfVFovRad = Math.atan(Math.tan(halfHFovRad) * (heightPx / widthPx));
  return 2 * radToDeg(halfVFovRad);
}

export interface DeviceHeading {
  headingDeg: number;
  pitchDeg: number;
  /** iOS-only compass accuracy in degrees (lower is better); undefined if unknown
   * (e.g. Android, or before the first reading). A large value or -1 (invalid,
   * reported by iOS when the compass hasn't been calibrated) means headingDeg is
   * unreliable — commonly caused by indoor magnetic interference. */
  accuracyDeg?: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Unit vector in an East/North/Up frame for a given azimuth (clockwise from
 * North) and elevation (0 = horizon, 90 = zenith). */
function azElToUnitVector(azDeg: number, elDeg: number): Vec3 {
  const azRad = degToRad(azDeg);
  const elRad = degToRad(elDeg);
  const cosEl = Math.cos(elRad);
  return { x: cosEl * Math.sin(azRad), y: cosEl * Math.cos(azRad), z: Math.sin(elRad) };
}

/**
 * Projects a satellite's true azimuth/elevation onto the camera screen given the
 * device's current pointing direction and an assumed rear-camera field of view.
 *
 * This builds a proper camera-local orthonormal frame (forward/right/up as 3D
 * unit vectors) and projects the target's direction onto it before taking a
 * gnomonic (tangent) mapping — treating azimuth and elevation offsets as
 * independent angles only works right at the horizon; it distorts badly for
 * anything passing near zenith, since azimuth is degenerate there. This 3D
 * approach is what a real pinhole camera does and stays correct overhead.
 *
 * v1 simplification: ignores device roll (assumes the phone is held upright),
 * so "up" here means true vertical rather than the camera's actual roll axis.
 * Returns null when the target is behind the camera or outside its field of view.
 */
export function projectToScreen(
  targetAzDeg: number,
  targetElDeg: number,
  heading: DeviceHeading,
  hFovDeg: number,
  vFovDeg: number,
  widthPx: number,
  heightPx: number,
): ScreenPoint | null {
  const target = azElToUnitVector(targetAzDeg, targetElDeg);
  const forward = azElToUnitVector(heading.headingDeg, heading.pitchDeg);

  const worldUp: Vec3 = { x: 0, y: 0, z: 1 };
  let right = cross(forward, worldUp);
  const rightLen = Math.sqrt(dot(right, right));
  if (rightLen < 1e-6) {
    // Camera pointing almost exactly straight up/down: forward is parallel to
    // worldUp, so cross(forward, worldUp) degenerates. Fall back to a right
    // vector derived from heading alone.
    const headingRad = degToRad(heading.headingDeg);
    right = { x: Math.cos(headingRad), y: -Math.sin(headingRad), z: 0 };
  } else {
    right = { x: right.x / rightLen, y: right.y / rightLen, z: right.z / rightLen };
  }
  const camUp = normalize(cross(right, forward));

  const forwardComponent = dot(target, forward);
  if (forwardComponent <= 0.02) return null; // behind the camera or ~90deg+ off boresight

  const rightComponent = dot(target, right);
  const upComponent = dot(target, camUp);

  const xNorm = rightComponent / forwardComponent / Math.tan(degToRad(hFovDeg / 2));
  const yNorm = upComponent / forwardComponent / Math.tan(degToRad(vFovDeg / 2));

  const cullMargin = 1.15;
  if (Math.abs(xNorm) > cullMargin || Math.abs(yNorm) > cullMargin) return null;

  return {
    x: (widthPx / 2) * (1 + xNorm),
    y: (heightPx / 2) * (1 - yNorm),
  };
}

/**
 * Screen Y coordinate of the true horizon (elevation 0), for a level camera (no
 * roll). Because azimuth is degenerate along the horizon in exactly the way that
 * makes elevation-0 points project to a constant y regardless of azimuth (proven
 * algebraically: upComponent/forwardComponent for any el=0 target reduces to
 * exactly -tan(pitch), independent of azimuth), the horizon is always a perfectly
 * straight horizontal line whose height depends only on pitch and vertical FOV —
 * no per-azimuth sampling needed. Used to draw a ground fill below it.
 */
export function horizonScreenY(pitchDeg: number, vFovDeg: number, heightPx: number): number {
  const yNorm = Math.tan(degToRad(pitchDeg)) / Math.tan(degToRad(vFovDeg / 2));
  return (heightPx / 2) * (1 + yNorm);
}
