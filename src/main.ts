import { registerServiceWorker } from './pwa/register-sw';
import { mountPlanisphereScreen } from './ui/screens/planisphere-screen';

function renderStartScreen(app: HTMLElement): void {
  app.innerHTML = `
    <div class="screen">
      <h1>SatellitesNow</h1>
      <p>Live sky-map of the brightest satellites passing overhead, using your location. An AR camera view is coming next.</p>
      <button id="start-planisphere">Show sky map</button>
    </div>
  `;

  app.querySelector<HTMLButtonElement>('#start-planisphere')?.addEventListener('click', () => {
    void mountPlanisphereScreen(app);
  });
}

const app = document.getElementById('app');
if (app) renderStartScreen(app);

registerServiceWorker();
