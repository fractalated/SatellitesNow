import { IDB_TLE_STORE } from '../utils/constants';
import { idbGet, idbSet } from './idb-cache';
import type { TleSet } from './types';

const TLE_CACHE_KEY = 'active';

export function loadCachedTleSet(): Promise<TleSet | null> {
  return idbGet<TleSet>(IDB_TLE_STORE, TLE_CACHE_KEY);
}

export function saveTleSet(tleSet: TleSet): Promise<void> {
  return idbSet(IDB_TLE_STORE, TLE_CACHE_KEY, tleSet);
}

export function isStale(entry: { fetchedAt: number }, maxAgeMs: number, now: number = Date.now()): boolean {
  return now - entry.fetchedAt > maxAgeMs;
}

export function ageMs(entry: { fetchedAt: number }, now: number = Date.now()): number {
  return now - entry.fetchedAt;
}
