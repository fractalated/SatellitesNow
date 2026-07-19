import { degToRad } from '../../utils/math';

export interface DeviceHeading {
  headingDeg: number;
  pitchDeg: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Unit vector in an East/North/Up frame for a given azimuth (clockwise from
 * North) and elevation (0 = horizon, 90 = zenith). */
function azElToUnitVector(azDeg: number, elDeg: number): Vec3 {
  const azRad = degToRad(azDeg);
  const elRad = degToRad(elDeg);
  const cosEl = Math.cos(elRad);
  return { x: cosEl * Math.sin(azRad), y: cosEl * Math.cos(azRad), z: Math.sin(elRad) };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(a: Vec3): Vec3 {
  const len = Math.sqrt(dot(a, a)) || 1;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
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
