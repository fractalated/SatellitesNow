import { twoline2satrec } from 'satellite.js';
import type { SatRec } from 'satellite.js';
import { resolveSizeM2 } from '../astro/magnitude';
import type { SizeRecord, TleRecord } from '../data/types';

export interface SatrecEntry {
  id: string;
  name: string;
  satrec: SatRec;
  sizeM2: number;
}

/** Parses each TLE into a satrec once. Never re-parse per tick — propagate() against
 * an already-built satrec is the cheap, intended repeat-call pattern in satellite.js.
 * Joins in SATCAT size data by NORAD ID where available (see astro/magnitude.ts for
 * the fallback assumptions used when it isn't, which is most objects). */
export function buildSatrecStore(records: TleRecord[], sizeIndex: Map<number, SizeRecord>): SatrecEntry[] {
  return records.map((record) => {
    const size = sizeIndex.get(record.noradId);
    return {
      id: String(record.noradId),
      name: record.name,
      satrec: twoline2satrec(record.line1, record.line2),
      sizeM2: resolveSizeM2(record.name, size?.objectType, size?.rcsM2),
    };
  });
}
