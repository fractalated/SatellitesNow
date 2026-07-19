import { GeolocationError } from '../geolocation/geolocation';
import { CameraError } from '../render/ar/camera';
import { isIOS } from './platform';

/**
 * Friendly, actionable recovery text for when a permission comes back denied
 * instead of ever prompting — the confusing case where the browser silently
 * remembers a prior denial (or a device-level setting blocks it) and never
 * shows the OS permission dialog again.
 */
export function describeGeolocationError(error: GeolocationError): string {
  if (error.code === 1) {
    // GeolocationPositionError.PERMISSION_DENIED
    return isIOS()
      ? "Location is blocked for this site. On iPhone/iPad: Settings → Privacy & Security → Location Services, make sure it's on, then Settings → Safari → Location, and set it to \"Ask\" or \"Allow\". Then reload this page."
      : 'Location is blocked for this site. Tap the lock/info icon next to the address bar → Permissions → Location → Allow, then reload this page.';
  }
  if (error.code === 3) {
    // GeolocationPositionError.TIMEOUT
    return 'Location took too long to respond. Make sure you have a clear view of the sky or a network connection, then try again.';
  }
  return "Couldn't determine your location. Try again in a moment.";
}

export function describeCameraError(error: CameraError): string {
  const cause = error.cause as { name?: string } | undefined;
  if (cause?.name === 'NotAllowedError') {
    return isIOS()
      ? 'Camera access is blocked for this site. On iPhone/iPad: Settings → Safari → Camera, and set it to "Ask" or "Allow", then reload this page.'
      : 'Camera access is blocked for this site. Tap the lock/info icon next to the address bar → Permissions → Camera → Allow, then reload this page.';
  }
  if (cause?.name === 'NotFoundError') {
    return 'No camera was found on this device.';
  }
  return 'Camera is unavailable. Try again in a moment.';
}

export const ORIENTATION_DENIED_MESSAGE = isIOS()
  ? 'Motion & Orientation access was denied — AR view needs it to know which way you\'re pointing. Settings → Safari → Motion & Orientation Access, turn it on, then reload this page.'
  : "Motion access was denied — AR view needs it to know which way you're pointing.";
