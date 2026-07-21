import * as Comlink from 'comlink';
import type { Remote } from 'comlink';
import type { SizeRecord, TleRecord } from '../../data/types';
import type { Observer, SatelliteNow, SatelliteTrack } from '../../model/types';
import type { PropagationWorkerApi } from './propagation-api';

const SNAPSHOT_INTERVAL_MS = 1000;
const TRACK_INTERVAL_MS = 12000;

export interface PropagationUpdate {
  satellites: SatelliteNow[];
  tracks: SatelliteTrack[];
}

/** Main-thread handle to the propagation worker: schedules periodic snapshot/track
 * recomputes and fans the results out to subscribers (the AR and planisphere renderers). */
export class PropagationClient {
  private readonly worker: Worker;
  private readonly api: Remote<PropagationWorkerApi>;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private trackTimer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<(update: PropagationUpdate) => void>();
  private latestTracks: SatelliteTrack[] = [];

  constructor() {
    this.worker = new Worker(new URL('./propagation.worker.ts', import.meta.url), { type: 'module' });
    this.api = Comlink.wrap<PropagationWorkerApi>(this.worker);
  }

  async start(records: TleRecord[], sizeIndex: Map<number, SizeRecord>, observer: Observer): Promise<void> {
    await this.api.loadTle(records, sizeIndex);
    await this.api.setObserver(observer);
    await this.refreshTracks();
    await this.tickSnapshot();

    this.snapshotTimer = setInterval(() => void this.tickSnapshot(), SNAPSHOT_INTERVAL_MS);
    this.trackTimer = setInterval(() => void this.refreshTracks(), TRACK_INTERVAL_MS);
  }

  async updateObserver(observer: Observer): Promise<void> {
    await this.api.setObserver(observer);
  }

  onUpdate(listener: (update: PropagationUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stop(): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    if (this.trackTimer) clearInterval(this.trackTimer);
    this.worker.terminate();
  }

  private async tickSnapshot(): Promise<void> {
    const satellites = await this.api.computeSnapshot(Date.now());
    this.emit({ satellites, tracks: this.latestTracks });
  }

  private async refreshTracks(): Promise<void> {
    this.latestTracks = await this.api.computeTracks(Date.now());
  }

  private emit(update: PropagationUpdate): void {
    for (const listener of this.listeners) listener(update);
  }
}
