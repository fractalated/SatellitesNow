import { getCurrentObserver, GeolocationError } from '../../geolocation/geolocation';
import type { Observer } from '../../model/types';
import { describeGeolocationError } from '../../permissions/permissions';
import { HERO_GRAPHIC_SVG } from '../hero-graphic';

export function mountOnboardingScreen(container: HTMLElement, onReady: (observer: Observer) => void): void {
  function render(errorMessage: string | null, busy: boolean): void {
    container.innerHTML = `
      <div class="screen">
        ${HERO_GRAPHIC_SVG}
        <h1>SatellitesNow</h1>
        <p>To show which satellites are overhead, SatellitesNow needs your location. Nothing is sent to a server — everything runs on your device.</p>
        ${errorMessage ? `<p class="onboarding-error">${errorMessage}</p>` : ''}
        <button id="allow-location" ${busy ? 'disabled' : ''}>${busy ? 'Requesting…' : errorMessage ? 'Try again' : 'Allow location'}</button>
      </div>
    `;

    container.querySelector<HTMLButtonElement>('#allow-location')?.addEventListener('click', () => void requestLocation());
  }

  async function requestLocation(): Promise<void> {
    render(null, true);
    try {
      const observer = await getCurrentObserver();
      onReady(observer);
    } catch (error) {
      const message =
        error instanceof GeolocationError
          ? describeGeolocationError(error)
          : "Couldn't determine your location. Try again in a moment.";
      render(message, false);
    }
  }

  render(null, false);
}
