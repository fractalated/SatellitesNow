import type { Observer } from './model/types';
import { registerServiceWorker } from './pwa/register-sw';
import { mountArScreen } from './ui/screens/ar-screen';
import { mountOnboardingScreen } from './ui/screens/onboarding-screen';
import { mountPlanisphereScreen } from './ui/screens/planisphere-screen';

function showPlanisphere(app: HTMLElement, observer: Observer): void {
  void mountPlanisphereScreen(app, observer, () => showAr(app, observer));
}

function showAr(app: HTMLElement, observer: Observer): void {
  void mountArScreen(app, observer, () => showPlanisphere(app, observer));
}

function renderModeSelect(app: HTMLElement, observer: Observer): void {
  app.innerHTML = `
    <div class="screen">
      <h1>SatellitesNow</h1>
      <p>Live view of the brightest satellites passing overhead. Tracks fade where a satellite crosses into Earth's shadow.</p>
      <button id="start-planisphere">Show sky map</button>
      <button id="start-ar">Point camera at the sky (AR)</button>
    </div>
  `;

  app.querySelector<HTMLButtonElement>('#start-planisphere')?.addEventListener('click', () => {
    showPlanisphere(app, observer);
  });
  app.querySelector<HTMLButtonElement>('#start-ar')?.addEventListener('click', () => {
    showAr(app, observer);
  });
}

const app = document.getElementById('app');
if (app) {
  mountOnboardingScreen(app, (observer) => renderModeSelect(app, observer));
}

registerServiceWorker();
