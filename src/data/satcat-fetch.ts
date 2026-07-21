import { CELESTRAK_SATCAT_ACTIVE_URL, IDB_SIZE_STORE, SIZE_DATA_MAX_AGE_MS } from '../utils/constants';
import { idbGet, idbSet } from './idb-cache';
import { isStale } from './tle-cache';
import type { SizeRecord, SizeSet } from './types';

const SIZE_CACHE_KEY = 'active';

interface RawSatcatRecord {
  NORAD_CAT_ID: number;
  RCS?: number;
  OBJECT_TYPE?: string;
}

async function fetchFreshSizeSet(): Promise<SizeSet> {
  const response = await fetch(CELESTRAK_SATCAT_ACTIVE_URL);
  if (!response.ok) {
    throw new Error(`CelesTrak SATCAT request failed: ${response.status}`);
  }
  const raw = (await response.json()) as RawSatcatRecord[];
  const records: SizeRecord[] = raw.map((r) => ({
    noradId: r.NORAD_CAT_ID,
    rcsM2: typeof r.RCS === 'number' && r.RCS > 0 ? r.RCS : undefined,
    objectType: r.OBJECT_TYPE,
  }));
  return { records, fetchedAt: Date.now() };
}

/**
 * Physical size data changes far less often than orbital elements, so this is
 * cached separately with a much longer TTL to avoid re-downloading a multi-MB
 * dataset every couple of hours. Falls back to a stale cache on fetch failure
 * rather than blocking the app -- size is only used for a rough brightness
 * estimate, not required for core tracking.
 */
export async function getSizeSet(): Promise<SizeSet> {
  const cached = await idbGet<SizeSet>(IDB_SIZE_STORE, SIZE_CACHE_KEY);
  if (cached && !isStale(cached, SIZE_DATA_MAX_AGE_MS)) return cached;

  try {
    const fresh = await fetchFreshSizeSet();
    await idbSet(IDB_SIZE_STORE, SIZE_CACHE_KEY, fresh);
    return fresh;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

export function buildSizeIndex(sizeSet: SizeSet): Map<number, SizeRecord> {
  return new Map(sizeSet.records.map((record) => [record.noradId, record]));
}
