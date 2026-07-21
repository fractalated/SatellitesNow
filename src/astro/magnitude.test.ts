import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSUMED_SIZE_M2,
  estimateApparentMagnitude,
  phaseAngleRad,
  resolveSizeM2,
  ROCKET_BODY_ASSUMED_SIZE_M2,
  STARLINK_ASSUMED_SIZE_M2,
} from './magnitude';

describe('resolveSizeM2', () => {
  it('prefers a real measured RCS value when present', () => {
    expect(resolveSizeM2('STARLINK-1234', 'PAY', 12.5)).toBe(12.5);
  });

  it('falls back to the Starlink assumption by name when RCS is missing', () => {
    expect(resolveSizeM2('STARLINK-1234', 'PAY', undefined)).toBe(STARLINK_ASSUMED_SIZE_M2);
  });

  it('falls back to the rocket-body assumption for R/B objects without RCS', () => {
    expect(resolveSizeM2('ARIANE 5 R/B', 'R/B', undefined)).toBe(ROCKET_BODY_ASSUMED_SIZE_M2);
  });

  it('falls back to a generic default otherwise', () => {
    expect(resolveSizeM2('SOME CUBESAT', 'PAY', undefined)).toBe(DEFAULT_ASSUMED_SIZE_M2);
  });

  it('ignores a zero or negative RCS value as if missing', () => {
    expect(resolveSizeM2('STARLINK-1234', 'PAY', 0)).toBe(STARLINK_ASSUMED_SIZE_M2);
  });
});

describe('phaseAngleRad', () => {
  it('is near 0 when the observer is roughly in the same direction as the sun', () => {
    const satEci = { x: 7000, y: 0, z: 0 };
    const sunUnit = { x: 1, y: 0, z: 0 };
    const observerEci = { x: 7000 + 1000, y: 0, z: 0 }; // further along +x, same direction as the sun
    expect(phaseAngleRad(satEci, observerEci, sunUnit)).toBeCloseTo(0, 3);
  });

  it('is near pi when the observer is roughly opposite the sun direction', () => {
    const satEci = { x: 7000, y: 0, z: 0 };
    const sunUnit = { x: 1, y: 0, z: 0 };
    const observerEci = { x: 7000 - 1000, y: 0, z: 0 }; // toward -x, opposite the sun
    expect(phaseAngleRad(satEci, observerEci, sunUnit)).toBeCloseTo(Math.PI, 3);
  });

  it('is near pi/2 when the observer direction is perpendicular to the sun direction', () => {
    const satEci = { x: 7000, y: 0, z: 0 };
    const sunUnit = { x: 1, y: 0, z: 0 };
    const observerEci = { x: 7000, y: 1000, z: 0 };
    expect(phaseAngleRad(satEci, observerEci, sunUnit)).toBeCloseTo(Math.PI / 2, 3);
  });
});

describe('estimateApparentMagnitude', () => {
  it('is calibrated so ISS-like parameters (400km, fully lit, 399m^2) land near its known peak brightness', () => {
    const mag = estimateApparentMagnitude(400, 0.01, 399);
    expect(mag).toBeGreaterThan(-4);
    expect(mag).toBeLessThan(-1);
  });

  it('gets dimmer (larger magnitude) at greater range', () => {
    const near = estimateApparentMagnitude(400, 0.1, 10);
    const far = estimateApparentMagnitude(2000, 0.1, 10);
    expect(far).toBeGreaterThan(near);
  });

  it('gets dimmer for a smaller object', () => {
    const big = estimateApparentMagnitude(800, 0.1, 10);
    const small = estimateApparentMagnitude(800, 0.1, 1);
    expect(small).toBeGreaterThan(big);
  });

  it('returns an effectively-infinite (unseeable) magnitude when fully backlit', () => {
    expect(estimateApparentMagnitude(800, Math.PI, 10)).toBe(Number.POSITIVE_INFINITY);
  });
});
