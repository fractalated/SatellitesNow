import type { Observer } from '../model/types';

export class GeolocationError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
    this.name = 'GeolocationError';
  }
}

export function getCurrentObserver(): Promise<Observer> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeolocationError(0, 'Geolocation is not available in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latDeg: position.coords.latitude,
          lonDeg: position.coords.longitude,
          heightKm: (position.coords.altitude ?? 0) / 1000,
        });
      },
      (error) => reject(new GeolocationError(error.code, error.message)),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  });
}

/** Continuously watches position, invoking `onUpdate` on each change. Returns an
 * unsubscribe function. Used so a slow walk/drive doesn't stale the observer position. */
export function watchObserver(
  onUpdate: (observer: Observer) => void,
  onError?: (error: GeolocationError) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    onError?.(new GeolocationError(0, 'Geolocation is not available in this browser.'));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        latDeg: position.coords.latitude,
        lonDeg: position.coords.longitude,
        heightKm: (position.coords.altitude ?? 0) / 1000,
      });
    },
    (error) => onError?.(new GeolocationError(error.code, error.message)),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
