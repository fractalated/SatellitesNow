export interface TleRecord {
  noradId: number;
  name: string;
  line1: string;
  line2: string;
}

export interface TleSet {
  records: TleRecord[];
  fetchedAt: number;
}

/**
 * Sourced from CelesTrak's SATCAT. Despite the name, this now doubles as the
 * "basic information" shown in the satellite detail popup, not just a magnitude
 * input -- rcsM2/objectType feed astro/magnitude.ts, the rest is display-only.
 */
export interface SizeRecord {
  noradId: number;
  /** Radar cross-section in m^2, when CelesTrak's SATCAT has a measured value.
   * Only ~5% of active objects have this -- notably zero Starlinks -- so most
   * satellites fall back to a generic size assumption (see astro/magnitude.ts). */
  rcsM2?: number;
  objectType?: string;
  objectId?: string;
  owner?: string;
  launchDate?: string;
  period?: number;
  inclination?: number;
  apogeeKm?: number;
  perigeeKm?: number;
}

export interface SizeSet {
  records: SizeRecord[];
  fetchedAt: number;
}
