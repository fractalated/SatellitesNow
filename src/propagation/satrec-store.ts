import { twoline2satrec } from 'satellite.js';
import type { SatRec } from 'satellite.js';
import type { TleRecord } from '../data/types';

export interface SatrecEntry {
  id: string;
  name: string;
  satrec: SatRec;
}

/** Parses each TLE into a satrec once. Never re-parse per tick — propagate() against
 * an already-built satrec is the cheap, intended repeat-call pattern in satellite.js. */
export function buildSatrecStore(records: TleRecord[]): SatrecEntry[] {
  return records.map((record) => ({
    id: String(record.noradId),
    name: record.name,
    satrec: twoline2satrec(record.line1, record.line2),
  }));
}
