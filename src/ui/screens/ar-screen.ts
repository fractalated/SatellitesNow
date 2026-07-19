import { ageMs } from '../../data/tle-cache';
import { getTleSet, TleUnavailableError } from '../../data/tle-fetch';
import { getCurrentObserver, GeolocationError } from '../../geolocation/geolocation';
import type { Observer } from '../../model/types';
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

export async function mountArScreen(container: HTMLElement): Promise<() => void> {
  container.innerHTML = `
    <div class="ar-screen">
      <video id="ar-video" autoplay muted playsinline></video>
      <canvas id="ar-canvas"></canvas>
      <div class="ar-status" id="ar-status">Requesting sensor access…</div>
    </div>
  `;

  const statusEl = container.querySelector<HTMLDivElement>('#ar-status');
  const video = container.querySelector<HTMLVideoElement>('#ar-video');
  const canvas = container.querySelector<HTMLCanvasElement>('#ar-canvas');
  if (!statusEl || !video || !canvas) throw new Error('AR screen failed to mount.');

  // Requested first, synchronously after the tap that opened this screen — iOS
  // Safari only grants DeviceOrientationEvent permission within a live user
  // gesture, which can expire once other awaits (camera/geolocation prompts) run.
  const orientationGranted = await requestOrientationPermission();
  if (!orientationGranted) {
    statusEl.textContent = 'Compass/motion access was denied — AR view needs it to point at satellites.';
    return () => {};
  }

  let stopCamera: () => void;
  try {
    stopCamera = await startRearCamera(video);
  } catch (error) {
    statusEl.textContent =
      error instanceof CameraError ? error.message : 'Camera unavailable.';
    return () => {};
  }

  statusEl.textContent = 'Getting your location…';
  let observer: Observer;
  try {
    observer = await getCurrentObserver();
  } catch (error) {
    stopCamera();
    statusEl.textContent =
      error instanceof GeolocationError ? `Location unavailable: ${error.message}` : 'Location unavailable.';
    return () => {};
  }

  statusEl.textContent = 'Loading satellite data…';
  let tleResult;
  try {
    tleResult = await getTleSet();
  } catch (error) {
    stopCamera();
    statusEl.textContent =
      error instanceof TleUnavailableError
        ? 'No satellite data available (offline and no cached data yet).'
        : 'Failed to load satellite data.';
    return () => {};
  }

  statusEl.textContent = tleResult.refreshFailed
    ? `Showing cached data (refresh failed) — ${formatAge(ageMs(tleResult.tleSet))}`
    : `${tleResult.tleSet.records.length} tracked satellites — data ${formatAge(ageMs(tleResult.tleSet))}`;

  const renderer = new ArRenderer(canvas);
  const stopOrientation = startOrientationTracking((heading) => renderer.updateHeading(heading));

  const client = new PropagationClient();
  const unsubscribe = client.onUpdate((update) => renderer.updateSatellites(update.satellites, update.tracks));
  await client.start(tleResult.tleSet.records, observer);

  renderer.start();

  return () => {
    renderer.destroy();
    stopOrientation();
    unsubscribe();
    client.stop();
    stopCamera();
  };
}
