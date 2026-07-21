import * as Comlink from 'comlink';
import type { SizeRecord, TleRecord } from '../../data/types';
import { computeSatellitePosition } from '../../model/satellite-state';
import { buildTrack } from '../../model/track-builder';
import type { Observer, SatelliteNow, SatelliteTrack } from '../../model/types';
import { MAGNITUDE_VISIBLE_THRESHOLD } from '../../utils/constants';
import { buildSatrecStore, type SatrecEntry } from '../satrec-store';
import type { PropagationWorkerApi } from './propagation-api';

/**
 * Runs all SGP4 propagation, coordinate transforms, and eclipse/magnitude/track math
 * off the main thread, so it never competes with camera compositing or canvas
 * redraws. The active catalog is ~16,000 objects (vs. the 157-object curated
 * "visual" group this started with) — propagating all of them was benchmarked at
 * ~80ms on desktop, which is fine at the ~12s track-rebuild cadence but too slow to
 * repeat every second on a phone. So this is tiered:
 *  - computeTracks (slow, ~12s): full scan over every object to find which are
 *    currently above the horizon and bright enough, then builds full tracks for
 *    just that subset (~60 objects typically).
 *  - computeSnapshot (fast, ~1s): only re-propagates that already-known subset, for
 *    smooth position updates between full scans.
 */
class PropagationWorker implements PropagationWorkerApi {
  private entries: SatrecEntry[] = [];
  private observer: Observer | null = null;
  private visibleEntries: SatrecEntry[] = [];

  loadTle(records: TleRecord[], sizeIndex: Map<number, SizeRecord>): void {
    this.entries = buildSatrecStore(records, sizeIndex);
  }

  setObserver(observer: Observer): void {
    this.observer = observer;
  }

  computeSnapshot(nowMs: number): SatelliteNow[] {
    if (!this.observer) return [];
    return this.toSatelliteNow(this.visibleEntries, new Date(nowMs));
  }

  computeTracks(nowMs: number): SatelliteTrack[] {
    if (!this.observer) return [];
    const now = new Date(nowMs);
    const observer = this.observer;

    this.visibleEntries = this.entries.filter((entry) => {
      const pos = computeSatellitePosition(entry.satrec, observer, now, entry.sizeM2);
      return pos !== null && pos.elDeg >= 0 && pos.magnitude <= MAGNITUDE_VISIBLE_THRESHOLD;
    });

    return this.visibleEntries.map((entry) => buildTrack(entry.satrec, observer, entry.id, now, entry.sizeM2));
  }

  private toSatelliteNow(entries: SatrecEntry[], now: Date): SatelliteNow[] {
    const observer = this.observer as Observer;
    const results: SatelliteNow[] = [];

    for (const entry of entries) {
      const pos = computeSatellitePosition(entry.satrec, observer, now, entry.sizeM2);
      if (!pos || pos.elDeg < 0 || pos.magnitude > MAGNITUDE_VISIBLE_THRESHOLD) continue;
      results.push({
        id: entry.id,
        name: entry.name,
        azDeg: pos.azDeg,
        elDeg: pos.elDeg,
        rangeKm: pos.rangeKm,
        illuminated: pos.illuminated,
        magnitude: pos.magnitude,
      });
    }

    return results;
  }
}

Comlink.expose(new PropagationWorker());
