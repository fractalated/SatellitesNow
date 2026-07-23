import { describe, expect, it } from 'vitest';
import { deriveVerticalFovDeg, horizonScreenY, projectToScreen } from './ar-projection';

const hFov = 65;
const vFov = 65 * (720 / 1280);
const width = 1280;
const height = 720;

describe('projectToScreen', () => {
  it('maps a target dead-center of the camera to the screen center', () => {
    const heading = { headingDeg: 90, pitchDeg: 20 };
    const point = projectToScreen(90, 20, heading, hFov, vFov, width, height);
    expect(point).not.toBeNull();
    expect(point!.x).toBeCloseTo(width / 2, 1);
    expect(point!.y).toBeCloseTo(height / 2, 1);
  });

  it('maps a target to the right when it is east of the camera heading', () => {
    const heading = { headingDeg: 90, pitchDeg: 20 };
    const point = projectToScreen(90 + 10, 20, heading, hFov, vFov, width, height);
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThan(width / 2);
  });

  it('maps a target above center when its elevation is above the camera pitch', () => {
    const heading = { headingDeg: 90, pitchDeg: 20 };
    const point = projectToScreen(90, 30, heading, hFov, vFov, width, height);
    expect(point).not.toBeNull();
    expect(point!.y).toBeLessThan(height / 2);
  });

  it('returns null for a target behind the camera', () => {
    const heading = { headingDeg: 90, pitchDeg: 20 };
    expect(projectToScreen(90 + 170, 20, heading, hFov, vFov, width, height)).toBeNull();
  });

  it('returns null for a target well outside the vertical FOV', () => {
    const heading = { headingDeg: 90, pitchDeg: 20 };
    expect(projectToScreen(90, 80, heading, hFov, vFov, width, height)).toBeNull();
  });

  it('handles azimuth wraparound near 0/360', () => {
    const point = projectToScreen(2, 20, { headingDeg: 358, pitchDeg: 20 }, hFov, vFov, width, height);
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThan(width / 2);
  });

  // Regression test: an earlier implementation treated azimuth-offset and
  // elevation-offset as independent angles and took their tangents separately.
  // That's only valid right at the horizon — azimuth is degenerate at zenith, so
  // it produced warped, discontinuous tracks for anything passing near overhead
  // (reported as "tight curves that don't pass overhead").
  it('projects a great-circle pass through zenith continuously, with no jump at the top', () => {
    // A camera pointed almost straight up, wide FOV so the crossover is on-screen —
    // this isolates the projection math from FOV culling (tested separately above).
    const heading = { headingDeg: 0, pitchDeg: 89 };
    const wideFov = 170;

    // Approaching zenith heading north (az=0)...
    const justBefore = projectToScreen(0, 89.9, heading, wideFov, wideFov, width, height);
    // ...and just past zenith on the far side (az=180) should land almost exactly
    // on the same screen point, since these are two samples arbitrarily close to
    // the same physical point in the sky (the zenith itself).
    const justAfter = projectToScreen(180, 89.9, heading, wideFov, wideFov, width, height);

    expect(justBefore).not.toBeNull();
    expect(justAfter).not.toBeNull();
    expect(justAfter!.x).toBeCloseTo(justBefore!.x, 0);
    expect(justAfter!.y).toBeCloseTo(justBefore!.y, 0);
  });

  it('moves smoothly (no large pixel jumps) along a pass climbing to zenith and back down', () => {
    // Wide FOV, isolating the projection math itself from realistic FOV culling.
    const heading = { headingDeg: 0, pitchDeg: 60 };
    const wideFov = 170;
    const points: { x: number; y: number }[] = [];

    for (let el = 10; el <= 90; el += 5) {
      const p = projectToScreen(0, el, heading, wideFov, wideFov, width, height);
      if (p) points.push(p);
    }
    for (let el = 85; el >= 10; el -= 5) {
      const p = projectToScreen(180, el, heading, wideFov, wideFov, width, height);
      if (p) points.push(p);
    }

    expect(points.length).toBeGreaterThan(10);
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const jump = Math.sqrt(dx * dx + dy * dy);
      expect(jump).toBeLessThan(width * 0.35);
    }
  });
});

describe('horizonScreenY', () => {
  it('matches projectToScreen for el=0 targets at various azimuths within the FOV', () => {
    const heading = { headingDeg: 40, pitchDeg: 15 };
    const expectedY = horizonScreenY(heading.pitchDeg, vFov, height);

    for (const azOffset of [-10, -5, 0, 5, 10]) {
      const point = projectToScreen(heading.headingDeg + azOffset, 0, heading, hFov, vFov, width, height);
      expect(point).not.toBeNull();
      expect(point!.y).toBeCloseTo(expectedY, 6);
    }
  });

  it('is centered when the camera is level (pitch 0)', () => {
    expect(horizonScreenY(0, vFov, height)).toBeCloseTo(height / 2, 6);
  });

  it('moves down the screen as the camera tilts up (more sky visible)', () => {
    const level = horizonScreenY(0, vFov, height);
    const tiltedUp = horizonScreenY(20, vFov, height);
    expect(tiltedUp).toBeGreaterThan(level);
  });
});

// Regression tests for a real bug: vFov was derived as `hFov * (height/width)`,
// scaling the *angle* linearly by aspect ratio. That's not how rectilinear camera
// FOV geometry works -- the *tangent* of the half-angle scales linearly with aspect
// ratio, not the angle. On a portrait phone (height/width ~2.16) the old formula
// inflated a 65deg horizontal FOV into 140deg+ vertical, instead of the correct
// ~108deg, causing severe gnomonic-projection distortion for anything off-center
// (reported as "everything shifts dramatically" near the horizon).
describe('deriveVerticalFovDeg', () => {
  it('returns the same FOV for a square aspect ratio', () => {
    expect(deriveVerticalFovDeg(65, 100, 100)).toBeCloseTo(65, 6);
  });

  it('satisfies the correct tangent-scaling relationship, not linear angle scaling', () => {
    const hFovDeg = 65;
    const widthPx = 1170;
    const heightPx = 2532;
    const vFovDeg = deriveVerticalFovDeg(hFovDeg, widthPx, heightPx);

    const tanHalfV = Math.tan((vFovDeg / 2) * (Math.PI / 180));
    const tanHalfH = Math.tan((hFovDeg / 2) * (Math.PI / 180));
    expect(tanHalfV).toBeCloseTo(tanHalfH * (heightPx / widthPx), 6);

    // The old buggy formula for this exact aspect ratio (~2.16) gave ~140.7deg;
    // the correct value should be meaningfully smaller.
    const oldBuggyValue = hFovDeg * (heightPx / widthPx);
    expect(vFovDeg).toBeLessThan(oldBuggyValue - 20);
  });

  it('stays under 180deg (the tangent-based formula cannot runaway like linear scaling can)', () => {
    expect(deriveVerticalFovDeg(65, 390, 844)).toBeLessThan(180);
  });
});
