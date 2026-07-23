import type { SizeRecord } from '../data/types';
import type { SatelliteNow } from '../model/types';

const OBJECT_TYPE_LABELS: Record<string, string> = {
  PAY: 'Payload',
  'R/B': 'Rocket body',
  DEB: 'Debris',
  UNK: 'Unknown',
};

export interface SatellitePopupHandle {
  show(satellite: SatelliteNow, catalog: SizeRecord | undefined): void;
  hide(): void;
}

function row(label: string, value: string | undefined): string {
  if (!value) return '';
  return `<dt>${label}</dt><dd>${value}</dd>`;
}

/**
 * A simple modal showing a satellite's name and basic CelesTrak catalog info,
 * opened by tapping a marker in either view. Appends itself to `container` and
 * starts hidden; `onClose` fires both on the X button and on backdrop taps, so
 * callers can clear their "selected" highlight state.
 */
export function mountSatellitePopup(container: HTMLElement, onClose?: () => void): SatellitePopupHandle {
  const overlay = document.createElement('div');
  overlay.className = 'satellite-popup-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="satellite-popup">
      <button class="satellite-popup-close" aria-label="Close">&times;</button>
      <h2 class="satellite-popup-name"></h2>
      <dl class="satellite-popup-details"></dl>
    </div>
  `;
  container.appendChild(overlay);

  const nameEl = overlay.querySelector<HTMLElement>('.satellite-popup-name')!;
  const detailsEl = overlay.querySelector<HTMLElement>('.satellite-popup-details')!;
  const closeButton = overlay.querySelector<HTMLButtonElement>('.satellite-popup-close')!;
  if (!nameEl || !detailsEl || !closeButton) throw new Error('Satellite popup failed to build.');

  function hide(): void {
    overlay.hidden = true;
    onClose?.();
  }

  closeButton.addEventListener('click', hide);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) hide();
  });

  function show(satellite: SatelliteNow, catalog: SizeRecord | undefined): void {
    nameEl.textContent = satellite.name;

    detailsEl.innerHTML = [
      row('NORAD ID', satellite.id),
      row('COSPAR ID', catalog?.objectId),
      row('Type', catalog?.objectType ? (OBJECT_TYPE_LABELS[catalog.objectType] ?? catalog.objectType) : undefined),
      row('Owner', catalog?.owner),
      row('Launched', catalog?.launchDate),
      row('Orbital period', catalog?.period ? `${catalog.period.toFixed(1)} min` : undefined),
      row('Inclination', catalog?.inclination ? `${catalog.inclination.toFixed(1)}°` : undefined),
      row(
        'Apogee / Perigee',
        catalog?.apogeeKm && catalog?.perigeeKm
          ? `${Math.round(catalog.apogeeKm)} / ${Math.round(catalog.perigeeKm)} km`
          : undefined,
      ),
      row('Azimuth / Elevation', `${satellite.azDeg.toFixed(0)}° / ${satellite.elDeg.toFixed(0)}°`),
      row('Range', `${Math.round(satellite.rangeKm)} km`),
      row('Est. magnitude', satellite.magnitude.toFixed(1)),
      row('Sunlit', satellite.illuminated ? 'Yes' : "No (Earth's shadow)"),
    ].join('');

    overlay.hidden = false;
  }

  return { show, hide };
}
