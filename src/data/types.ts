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

export interface SizeRecord {
  noradId: number;
  /** Radar cross-section in m^2, when CelesTrak's SATCAT has a measured value.
   * Only ~5% of active objects have this -- notably zero Starlinks -- so most
   * satellites fall back to a generic size assumption (see astro/magnitude.ts). */
  rcsM2?: number;
  objectType?: string;
}

export interface SizeSet {
  records: SizeRecord[];
  fetchedAt: number;
}
