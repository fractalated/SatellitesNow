import { degToRad, wrapDeg180 } from '../../utils/math';

export interface DeviceHeading {
  headingDeg: number;
  pitchDeg: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Projects a satellite's true azimuth/elevation onto the camera screen given the
 * device's current pointing direction and an assumed rear-camera field of view.
 * Uses a gnomonic (tangent) mapping — correct perspective for a pinhole-camera
 * approximation, unlike a naive linear angle-to-pixel mapping.
 *
 * v1 simplification: ignores device roll (assumes the phone is held upright).
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
  const deltaAzDeg = wrapDeg180(targetAzDeg - heading.headingDeg);
  const deltaElDeg = targetElDeg - heading.pitchDeg;

  // Guard the gnomonic tangent singularity — well outside any plausible phone FOV,
  // and definitely behind the camera past +/-90deg.
  if (Math.abs(deltaAzDeg) >= 89 || Math.abs(deltaElDeg) >= 89) return null;

  const xNorm = Math.tan(degToRad(deltaAzDeg)) / Math.tan(degToRad(hFovDeg / 2));
  const yNorm = Math.tan(degToRad(deltaElDeg)) / Math.tan(degToRad(vFovDeg / 2));

  const cullMargin = 1.15;
  if (Math.abs(xNorm) > cullMargin || Math.abs(yNorm) > cullMargin) return null;

  return {
    x: (widthPx / 2) * (1 + xNorm),
    y: (heightPx / 2) * (1 - yNorm),
  };
}
