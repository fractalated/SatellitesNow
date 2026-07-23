import { ageMs } from '../../data/tle-cache';
import { getTleSet, TleUnavailableError } from '../../data/tle-fetch';
import { buildSizeIndex, getSizeSet } from '../../data/satcat-fetch';
import type { SizeRecord } from '../../data/types';
import type { Observer } from '../../model/types';
import { PropagationClient } from '../../propagation/worker/propagation-client';
import { PlanisphereRenderer } from '../../render/planisphere/planisphere-renderer';
import { mountSatellitePopup } from '../satellite-popup';

function formatAge(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

async function loadSizeIndex(): Promise<Map<number, SizeRecord>> {
  try {
    return buildSizeIndex(await getSizeSet());
  } catch {
    // Size data only refines the brightness estimate; missing it just means every
    // object falls back to a generic size assumption, not a blocking failure.
    return new Map();
  }
}

export async function mountPlanisphereScreen(
  container: HTMLElement,
  observer: Observer,
  onSwitchToAr: () => void,
): Promise<() => void> {
  container.innerHTML = `
    <div class="planisphere-screen">
      <div class="planisphere-status" id="planisphere-status">Loading satellite data…</div>
      <button id="switch-to-ar" class="view-switch">AR view</button>
      <canvas id="planisphere-canvas"></canvas>
    </div>
  `;

  const screenEl = container.querySelector<HTMLDivElement>('.planisphere-screen');
  const statusEl = container.querySelector<HTMLDivElement>('#planisphere-status');
  const canvas = container.querySelector<HTMLCanvasElement>('#planisphere-canvas');
  const switchButton = container.querySelector<HTMLButtonElement>('#switch-to-ar');
  if (!screenEl || !statusEl || !canvas || !switchButton) throw new Error('Planisphere screen failed to mount.');

  let tleResult;
  let sizeIndex;
  try {
    // loadSizeIndex() never rejects (it degrades to an empty map internally), so
    // only the TLE fetch can cause this to throw.
    [tleResult, sizeIndex] = await Promise.all([getTleSet(), loadSizeIndex()]);
  } catch (error) {
    statusEl.textContent =
      error instanceof TleUnavailableError
        ? 'No satellite data available (offline and no cached data yet).'
        : 'Failed to load satellite data.';
    return () => {};
  }

  if (tleResult.refreshFailed) {
    statusEl.textContent = `Showing cached data (refresh failed) — ${formatAge(ageMs(tleResult.tleSet))} — build ${__BUILD_ID__}`;
  } else {
    statusEl.textContent = `${tleResult.tleSet.records.length} satellites tracked, showing brightest visible — data ${formatAge(ageMs(tleResult.tleSet))} — build ${__BUILD_ID__}`;
  }

  const renderer = new PlanisphereRenderer(canvas);
  const popup = mountSatellitePopup(screenEl, () => renderer.setSelectedId(null));
  renderer.onSatelliteClick((satellite) => {
    renderer.setSelectedId(satellite.id);
    popup.show(satellite, sizeIndex.get(Number(satellite.id)));
  });

  const client = new PropagationClient();
  const unsubscribe = client.onUpdate((update) => renderer.render(update.satellites, update.tracks));
  await client.start(tleResult.tleSet.records, sizeIndex, observer);

  function cleanup(): void {
    unsubscribe();
    client.stop();
    renderer.destroy();
  }

  switchButton.addEventListener('click', () => {
    cleanup();
    onSwitchToAr();
  });

  return cleanup;
}
