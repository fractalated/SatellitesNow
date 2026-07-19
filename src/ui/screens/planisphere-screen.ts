import { getTleSet, TleUnavailableError } from '../../data/tle-fetch';
import { ageMs } from '../../data/tle-cache';
import type { Observer } from '../../model/types';
import { PropagationClient } from '../../propagation/worker/propagation-client';
import { PlanisphereRenderer } from '../../render/planisphere/planisphere-renderer';

function formatAge(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
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

  const statusEl = container.querySelector<HTMLDivElement>('#planisphere-status');
  const canvas = container.querySelector<HTMLCanvasElement>('#planisphere-canvas');
  const switchButton = container.querySelector<HTMLButtonElement>('#switch-to-ar');
  if (!statusEl || !canvas || !switchButton) throw new Error('Planisphere screen failed to mount.');

  let tleResult;
  try {
    tleResult = await getTleSet();
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
    statusEl.textContent = `${tleResult.tleSet.records.length} tracked satellites — data ${formatAge(ageMs(tleResult.tleSet))} — build ${__BUILD_ID__}`;
  }

  const renderer = new PlanisphereRenderer(canvas);
  const client = new PropagationClient();
  const unsubscribe = client.onUpdate((update) => renderer.render(update.satellites, update.tracks));
  await client.start(tleResult.tleSet.records, observer);

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
