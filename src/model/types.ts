export interface Observer {
  latDeg: number;
  lonDeg: number;
  heightKm: number;
}

export interface SatelliteNow {
  id: string;
  name: string;
  azDeg: number;
  elDeg: number;
  rangeKm: number;
  illuminated: boolean;
  /** Estimated apparent visual magnitude (lower = brighter); see astro/magnitude.ts. */
  magnitude: number;
}

export interface TrackPoint {
  tOffsetSec: number;
  azDeg: number;
  elDeg: number;
  sunlit: boolean;
}

export interface TrackSegment {
  sunlit: boolean;
  points: TrackPoint[];
}

export interface SatelliteTrack {
  id: string;
  segments: TrackSegment[];
}
