import { ageMs } from '../../data/tle-cache';
import { getTleSet, TleUnavailableError } from '../../data/tle-fetch';
import type { Observer } from '../../model/types';
import { describeCameraError, orientationDeniedMessage } from '../../permissions/permissions';
import { PropagationClient } from '../../propagation/worker/propagation-client';
import { ArRenderer } from '../../render/ar/ar-renderer';
import { CameraError, startRearCamera } from '../../render/ar/camera';
import { requestOrientationPermission, startOrientationTracking } from '../../render/ar/orientation';

function formatAge(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export async function mountArScreen(
  container: HTMLElement,
  observer: Observer,
  onSwitchToPlanisphere: () => void,
): Promise<() => void> {
  function renderError(message: string): () => void {
    container.innerHTML = `
      <div class="screen">
        <p class="onboarding-error">${message}</p>
        <button id="ar-retry">Try again</button>
        <button id="ar-back-to-map">Back to sky map</button>
      </div>
    `;
    container.querySelector<HTMLButtonElement>('#ar-retry')?.addEventListener('click', () => {
      void mountArScreen(container, observer, onSwitchToPlanisphere);
    });
    container.querySelector<HTMLButtonElement>('#ar-back-to-map')?.addEventListener('click', () => {
      onSwitchToPlanisphere();
    });
    return () => {};
  }

  container.innerHTML = `
    <div class="ar-screen">
      <video id="ar-video" autoplay muted playsinline></video>
      <canvas id="ar-canvas"></canvas>
      <div class="ar-status" id="ar-status">Requesting sensor access…</div>
      <div class="ar-compass-warning" id="ar-compass-warning" hidden>
        Compass accuracy is low, so satellite positions may drift or jump — move away from metal, electronics, or building wiring (or try outdoors) for accurate tracking.
      </div>
      <div class="ar-debug" id="ar-debug">
        <div id="ar-debug-heading">build ${__BUILD_ID__} · obs ${observer.latDeg.toFixed(2)},${observer.lonDeg.toFixed(2)}</div>
        <div id="ar-debug-sats">waiting for satellite data…</div>
      </div>
      <button id="switch-to-map" class="view-switch">Sky map</button>
    </div>
  `;

  const statusEl = container.querySelector<HTMLDivElement>('#ar-status');
  const compassWarningEl = container.querySelector<HTMLDivElement>('#ar-compass-warning');
  const debugHeadingEl = container.querySelector<HTMLDivElement>('#ar-debug-heading');
  const debugSatsEl = container.querySelector<HTMLDivElement>('#ar-debug-sats');
  const video = container.querySelector<HTMLVideoElement>('#ar-video');
  const canvas = container.querySelector<HTMLCanvasElement>('#ar-canvas');
  const switchButton = container.querySelector<HTMLButtonElement>('#switch-to-map');
  if (!statusEl || !compassWarningEl || !debugHeadingEl || !debugSatsEl || !video || !canvas || !switchButton) {
    throw new Error('AR screen failed to mount.');
  }

  // Requested first, synchronously after the tap that opened this screen — iOS
  // Safari only grants DeviceOrientationEvent permission within a live user
  // gesture, which can expire once other awaits (camera prompts, etc.) run.
  const orientationGranted = await requestOrientationPermission();
  if (!orientationGranted) {
    return renderError(orientationDeniedMessage());
  }

  let stopCamera: () => void;
  try {
    stopCamera = await startRearCamera(video);
  } catch (error) {
    return renderError(error instanceof CameraError ? describeCameraError(error) : 'Camera unavailable.');
  }

  statusEl.textContent = 'Loading satellite data…';
  let tleResult;
  try {
    tleResult = await getTleSet();
  } catch (error) {
    stopCamera();
    return renderError(
      error instanceof TleUnavailableError
        ? 'No satellite data available (offline and no cached data yet).'
        : 'Failed to load satellite data.',
    );
  }

  statusEl.textContent = tleResult.refreshFailed
    ? `Showing cached data (refresh failed) — ${formatAge(ageMs(tleResult.tleSet))}`
    : `${tleResult.tleSet.records.length} tracked satellites — data ${formatAge(ageMs(tleResult.tleSet))}`;

  const renderer = new ArRenderer(canvas);
  const stopOrientation = startOrientationTracking((heading) => {
    renderer.updateHeading(heading);

    const accuracyText =
      heading.accuracyDeg === undefined ? '' : ` · compass ±${Math.max(heading.accuracyDeg, 0).toFixed(0)}°`;
    debugHeadingEl.textContent = `build ${__BUILD_ID__} · obs ${observer.latDeg.toFixed(2)},${observer.lonDeg.toFixed(2)} · hdg ${heading.headingDeg.toFixed(0)}° pitch ${heading.pitchDeg.toFixed(0)}°${accuracyText}`;

    const compassUnreliable = heading.accuracyDeg !== undefined && (heading.accuracyDeg < 0 || heading.accuracyDeg > 30);
    compassWarningEl.hidden = !compassUnreliable;
  });

  const client = new PropagationClient();
  const unsubscribe = client.onUpdate((update) => {
    renderer.updateSatellites(update.satellites, update.tracks);

    // Top 3 by elevation regardless of sign, so it's obvious even when nothing is
    // currently above the horizon — this is the ground-truth cross-check number:
    // compare against a known site (e.g. Heavens-Above) for the same satellite,
    // time, and location to tell data/math bugs apart from "it just wasn't a good
    // pass right now".
    const topByElevation = [...update.satellites].sort((a, b) => b.elDeg - a.elDeg).slice(0, 3);
    debugSatsEl.textContent = topByElevation.length
      ? topByElevation
          .map((s) => `${s.name} az${s.azDeg.toFixed(0)} el${s.elDeg.toFixed(0)}`)
          .join(' · ')
      : 'no satellite data yet';
  });
  await client.start(tleResult.tleSet.records, observer);

  renderer.start();

  function cleanup(): void {
    renderer.destroy();
    stopOrientation();
    unsubscribe();
    client.stop();
    stopCamera();
  }

  switchButton.addEventListener('click', () => {
    cleanup();
    onSwitchToPlanisphere();
  });

  return cleanup;
}
