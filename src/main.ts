import { registerServiceWorker } from './pwa/register-sw';
import { mountArScreen } from './ui/screens/ar-screen';
import { mountPlanisphereScreen } from './ui/screens/planisphere-screen';

function renderStartScreen(app: HTMLElement): void {
  app.innerHTML = `
    <div class="screen">
      <h1>SatellitesNow</h1>
      <p>Live view of the brightest satellites passing overhead, using your location. Tracks fade where a satellite crosses into Earth's shadow.</p>
      <button id="start-planisphere">Show sky map</button>
      <button id="start-ar">Point camera at the sky (AR)</button>
    </div>
  `;

  app.querySelector<HTMLButtonElement>('#start-planisphere')?.addEventListener('click', () => {
    void mountPlanisphereScreen(app);
  });
  app.querySelector<HTMLButtonElement>('#start-ar')?.addEventListener('click', () => {
    void mountArScreen(app);
  });
}

const app = document.getElementById('app');
if (app) renderStartScreen(app);

registerServiceWorker();
