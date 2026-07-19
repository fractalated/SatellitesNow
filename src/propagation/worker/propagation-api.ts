import type { TleRecord } from '../../data/types';
import type { Observer, SatelliteNow, SatelliteTrack } from '../../model/types';

/** Shape of the Comlink-exposed worker API, shared by the worker and its client wrapper. */
export interface PropagationWorkerApi {
  loadTle(records: TleRecord[]): void;
  setObserver(observer: Observer): void;
  computeSnapshot(nowMs: number): SatelliteNow[];
  computeTracks(nowMs: number): SatelliteTrack[];
}
