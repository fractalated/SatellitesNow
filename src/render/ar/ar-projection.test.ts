import { describe, expect, it } from 'vitest';
import { projectToScreen } from './ar-projection';

const heading = { headingDeg: 90, pitchDeg: 20 };
const hFov = 65;
const vFov = 65 * (720 / 1280);
const width = 1280;
const height = 720;

describe('projectToScreen', () => {
  it('maps a target dead-center of the camera to the screen center', () => {
    const point = projectToScreen(90, 20, heading, hFov, vFov, width, height);
    expect(point).not.toBeNull();
    expect(point!.x).toBeCloseTo(width / 2, 1);
    expect(point!.y).toBeCloseTo(height / 2, 1);
  });

  it('maps a target at the edge of the horizontal FOV near the screen edge', () => {
    const point = projectToScreen(90 + hFov / 2 - 1, 20, heading, hFov, vFov, width, height);
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThan(width * 0.9);
  });

  it('returns null for a target behind the camera', () => {
    expect(projectToScreen(90 + 170, 20, heading, hFov, vFov, width, height)).toBeNull();
  });

  it('returns null for a target well outside the vertical FOV', () => {
    expect(projectToScreen(90, 80, heading, hFov, vFov, width, height)).toBeNull();
  });

  it('handles azimuth wraparound near 0/360', () => {
    const point = projectToScreen(2, 20, { headingDeg: 358, pitchDeg: 20 }, hFov, vFov, width, height);
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThan(width / 2);
  });
});
