import { describe, expect, it } from 'vitest';
import { isEclipsed } from './eclipse';

const sunUnit = { x: 1, y: 0, z: 0 };

describe('isEclipsed', () => {
  it('is not eclipsed when on the sun-facing side, regardless of distance', () => {
    expect(isEclipsed({ x: 7000, y: 0, z: 0 }, sunUnit)).toBe(false);
    expect(isEclipsed({ x: 100, y: 5000, z: 5000 }, sunUnit)).toBe(false);
  });

  it('is eclipsed directly behind Earth, within the shadow cylinder radius', () => {
    expect(isEclipsed({ x: -7000, y: 0, z: 0 }, sunUnit)).toBe(true);
    expect(isEclipsed({ x: -7000, y: 1000, z: 0 }, sunUnit)).toBe(true); // within 6371km radius
  });

  it('is not eclipsed behind Earth but outside the shadow cylinder radius', () => {
    expect(isEclipsed({ x: -7000, y: 8000, z: 0 }, sunUnit)).toBe(false);
  });

  it('treats the shadow cylinder radius boundary correctly', () => {
    expect(isEclipsed({ x: -7000, y: 6370, z: 0 }, sunUnit)).toBe(true);
    expect(isEclipsed({ x: -7000, y: 6372, z: 0 }, sunUnit)).toBe(false);
  });
});
