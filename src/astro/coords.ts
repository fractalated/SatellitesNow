import { ecfToEci, ecfToLookAngles, eciToEcf, geodeticToEcf, gstime } from 'satellite.js';
import type { EciVec3, GeodeticLocation } from 'satellite.js';
import { degToRad, radToDeg, wrapDeg360 } from '../utils/math';

export interface ObserverDeg {
  latDeg: number;
  lonDeg: number;
  heightKm: number;
}

export interface LookAnglesDeg {
  azDeg: number;
  elDeg: number;
  rangeKm: number;
}

export function toGeodeticLocation(observer: ObserverDeg): GeodeticLocation {
  return {
    latitude: degToRad(observer.latDeg),
    longitude: degToRad(observer.lonDeg),
    height: observer.heightKm,
  };
}

/** Topocentric azimuth/elevation/range of an ECI position as seen by an observer at a given instant. */
export function lookAnglesDeg(
  satEci: EciVec3<number>,
  observer: ObserverDeg,
  date: Date,
): LookAnglesDeg {
  const gmst = gstime(date);
  const ecf = eciToEcf(satEci, gmst);
  const look = ecfToLookAngles(toGeodeticLocation(observer), ecf);

  return {
    azDeg: wrapDeg360(radToDeg(look.azimuth)),
    elDeg: radToDeg(look.elevation),
    rangeKm: look.rangeSat,
  };
}

/** Observer's position in the ECI frame at a given instant — needed to compute the
 * satellite-to-observer direction for phase-angle-based brightness estimation. */
export function observerEciPosition(observer: ObserverDeg, date: Date): EciVec3<number> {
  const gmst = gstime(date);
  const ecf = geodeticToEcf(toGeodeticLocation(observer));
  return ecfToEci(ecf, gmst);
}
