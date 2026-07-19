const MS_PER_DAY = 86400000;
const UNIX_EPOCH_JD = 2440587.5;

export function julianDate(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** Julian centuries since the J2000.0 epoch (2000-01-01T12:00:00 TT, JD 2451545.0). */
export function julianCenturiesSinceJ2000(jd: number): number {
  return (jd - 2451545.0) / 36525;
}
