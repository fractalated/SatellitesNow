import { TLE_CACHE_STORAGE_KEY, TLE_MAX_AGE_MS } from '../utils/constants';
import type { TleSet } from './types';

export function loadCachedTleSet(): TleSet | null {
  const raw = localStorage.getItem(TLE_CACHE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as TleSet;
    if (!Array.isArray(parsed.records) || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTleSet(tleSet: TleSet): void {
  localStorage.setItem(TLE_CACHE_STORAGE_KEY, JSON.stringify(tleSet));
}

export function isStale(tleSet: TleSet, now: number = Date.now()): boolean {
  return now - tleSet.fetchedAt > TLE_MAX_AGE_MS;
}

export function ageMs(tleSet: TleSet, now: number = Date.now()): number {
  return now - tleSet.fetchedAt;
}
