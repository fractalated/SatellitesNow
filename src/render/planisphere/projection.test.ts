import { describe, expect, it } from 'vitest';
import { azElToScreen } from './projection';

const centerX = 100;
const centerY = 100;
const radius = 100;

// Regression tests for a real bug: East and West were swapped, discovered by
// comparing this app's planisphere against Heavens-Above's live sky view (which,
// like every standard sky chart, places East on the left with North at top --
// the chart represents looking up at the sky from inside it, the mirror image of
// looking down at a ground map).
describe('azElToScreen', () => {
  it('places North at the top', () => {
    const p = azElToScreen(0, 0, centerX, centerY, radius);
    expect(p.x).toBeCloseTo(centerX, 5);
    expect(p.y).toBeCloseTo(centerY - radius, 5);
  });

  it('places East on the LEFT (not the right)', () => {
    const p = azElToScreen(90, 0, centerX, centerY, radius);
    expect(p.x).toBeCloseTo(centerX - radius, 5);
    expect(p.y).toBeCloseTo(centerY, 5);
  });

  it('places South at the bottom', () => {
    const p = azElToScreen(180, 0, centerX, centerY, radius);
    expect(p.x).toBeCloseTo(centerX, 5);
    expect(p.y).toBeCloseTo(centerY + radius, 5);
  });

  it('places West on the RIGHT (not the left)', () => {
    const p = azElToScreen(270, 0, centerX, centerY, radius);
    expect(p.x).toBeCloseTo(centerX + radius, 5);
    expect(p.y).toBeCloseTo(centerY, 5);
  });

  it('places zenith (el=90) at the center regardless of azimuth', () => {
    for (const az of [0, 45, 90, 180, 270]) {
      const p = azElToScreen(az, 90, centerX, centerY, radius);
      expect(p.x).toBeCloseTo(centerX, 5);
      expect(p.y).toBeCloseTo(centerY, 5);
    }
  });

  it('places the horizon (el=0) exactly one radius from center', () => {
    const p = azElToScreen(123, 0, centerX, centerY, radius);
    const dist = Math.hypot(p.x - centerX, p.y - centerY);
    expect(dist).toBeCloseTo(radius, 5);
  });
});
