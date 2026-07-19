import * as Comlink from 'comlink';
import { computeSatellitePosition } from '../../model/satellite-state';
import { buildTrack } from '../../model/track-builder';
import type { Observer, SatelliteNow, SatelliteTrack } from '../../model/types';
import type { TleRecord } from '../../data/types';
import { buildSatrecStore } from '../satrec-store';
import type { SatrecEntry } from '../satrec-store';
import type { PropagationWorkerApi } from './propagation-api';

/**
 * Runs all SGP4 propagation, coordinate transforms, and eclipse/track math off the
 * main thread, so it never competes with camera compositing or canvas redraws.
 * Benchmarked at ~0.1ms for a full-snapshot tick and ~12ms for a full track rebuild
 * across all 157 "visual" group satellites on desktop Node — cheap enough that this
 * treats every satellite uniformly rather than tiering propagation rate by elevation.
 */
class PropagationWorker implements PropagationWorkerApi {
  private entries: SatrecEntry[] = [];
  private observer: Observer | null = null;

  loadTle(records: TleRecord[]): void {
    this.entries = buildSatrecStore(records);
  }

  setObserver(observer: Observer): void {
    this.observer = observer;
  }

  computeSnapshot(nowMs: number): SatelliteNow[] {
    if (!this.observer) return [];
    const now = new Date(nowMs);
    const results: SatelliteNow[] = [];

    for (const entry of this.entries) {
      const pos = computeSatellitePosition(entry.satrec, this.observer, now);
      if (!pos) continue;
      results.push({
        id: entry.id,
        name: entry.name,
        azDeg: pos.azDeg,
        elDeg: pos.elDeg,
        rangeKm: pos.rangeKm,
        illuminated: pos.illuminated,
      });
    }

    return results;
  }

  computeTracks(nowMs: number): SatelliteTrack[] {
    if (!this.observer) return [];
    const now = new Date(nowMs);
    return this.entries.map((entry) => buildTrack(entry.satrec, this.observer as Observer, entry.id, now));
  }
}

Comlink.expose(new PropagationWorker());
