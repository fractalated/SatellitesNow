import { CELESTRAK_ACTIVE_TLE_URL, TLE_MAX_AGE_MS } from '../utils/constants';
import { isStale, loadCachedTleSet, saveTleSet } from './tle-cache';
import { parseTleText } from './tle-parser';
import type { TleSet } from './types';

export class TleUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('No satellite element data available and the network fetch failed.');
    this.name = 'TleUnavailableError';
    this.cause = cause;
  }
}

async function fetchFreshTleSet(): Promise<TleSet> {
  const response = await fetch(CELESTRAK_ACTIVE_TLE_URL);
  if (!response.ok) {
    throw new Error(`CelesTrak request failed: ${response.status}`);
  }
  const text = await response.text();
  const records = parseTleText(text);
  if (records.length === 0) {
    throw new Error('CelesTrak response contained no parseable TLE records.');
  }
  return { records, fetchedAt: Date.now() };
}

export interface TleResult {
  tleSet: TleSet;
  /** True if we served a cached set instead of a fresh network fetch (either because it was
   * still fresh, or because a refresh attempt failed and this is a stale fallback). */
  fromCache: boolean;
  /** True if a refresh was attempted and failed, and we're serving stale data as a fallback. */
  refreshFailed: boolean;
}

/**
 * Returns the current TLE set, preferring a still-fresh cached copy, refreshing from
 * CelesTrak when stale/missing, and falling back to a stale cache if the refresh fails.
 * Throws TleUnavailableError only when there is no usable data at all.
 */
export async function getTleSet(): Promise<TleResult> {
  const cached = await loadCachedTleSet();

  if (cached && !isStale(cached, TLE_MAX_AGE_MS)) {
    return { tleSet: cached, fromCache: true, refreshFailed: false };
  }

  try {
    const fresh = await fetchFreshTleSet();
    await saveTleSet(fresh);
    return { tleSet: fresh, fromCache: false, refreshFailed: false };
  } catch (error) {
    if (cached) {
      return { tleSet: cached, fromCache: true, refreshFailed: true };
    }
    throw new TleUnavailableError(error);
  }
}
