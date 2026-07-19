import { registerServiceWorker } from './pwa/register-sw';

function renderShell(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="screen">
      <h1>SatellitesNow</h1>
      <p>Live AR and sky-map views of the brightest satellites overhead. Onboarding and views land in the next build phases.</p>
    </div>
  `;
}

renderShell();
registerServiceWorker();
