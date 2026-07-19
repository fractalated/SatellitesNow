import { describe, expect, it } from 'vitest';
import { sunEciUnitVector } from './sun';

function magnitude(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

describe('sunEciUnitVector', () => {
  it('always returns a unit vector', () => {
    const dates = [
      new Date('2024-01-01T00:00:00Z'),
      new Date('2024-06-21T12:00:00Z'),
      new Date('2024-12-21T12:00:00Z'),
      new Date('2026-07-19T18:00:00Z'),
    ];
    for (const date of dates) {
      expect(magnitude(sunEciUnitVector(date))).toBeCloseTo(1, 6);
    }
  });

  it('matches Earth axial tilt at the solstices (declination near +/-23.44deg)', () => {
    const obliquity = 23.439291;
    const juneSolstice = sunEciUnitVector(new Date('2024-06-21T00:51:00Z'));
    const decemberSolstice = sunEciUnitVector(new Date('2024-12-21T09:20:00Z'));

    expect(juneSolstice.z).toBeCloseTo(Math.sin((obliquity * Math.PI) / 180), 2);
    expect(decemberSolstice.z).toBeCloseTo(-Math.sin((obliquity * Math.PI) / 180), 2);
  });

  it('has near-zero declination at the equinoxes', () => {
    const marchEquinox = sunEciUnitVector(new Date('2024-03-20T03:06:00Z'));
    const septemberEquinox = sunEciUnitVector(new Date('2024-09-22T12:44:00Z'));

    expect(Math.abs(marchEquinox.z)).toBeLessThan(0.01);
    expect(Math.abs(septemberEquinox.z)).toBeLessThan(0.01);
  });
});
