import { GeolocationError } from '../geolocation/geolocation';
import { CameraError } from '../render/ar/camera';
import { isIOS, isStandalone } from './platform';

const IOS_STANDALONE_NOTE =
  ' This looks like it\'s running from the Home Screen icon, which on iOS has a known, separate (and often stricter) permission story from Safari itself — not something this app can override. Since it works in regular Safari, the most reliable fix is to open the link directly in Safari instead of the Home Screen icon. If you\'d rather keep the icon: remove it (touch and hold → Remove App) and re-add it (Share → Add to Home Screen) after confirming it works in Safari first.';

/**
 * Friendly, actionable recovery text for when a permission comes back denied
 * instead of ever prompting — the confusing case where the browser silently
 * remembers a prior denial (or a device-level setting blocks it) and never
 * shows the OS permission dialog again.
 */
export function describeGeolocationError(error: GeolocationError): string {
  if (error.code === 1) {
    // GeolocationPositionError.PERMISSION_DENIED
    if (isIOS() && isStandalone()) {
      return `Location is blocked in this Home Screen app.${IOS_STANDALONE_NOTE}`;
    }
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
    if (isIOS() && isStandalone()) {
      return `Camera access is blocked in this Home Screen app.${IOS_STANDALONE_NOTE}`;
    }
    return isIOS()
      ? 'Camera access is blocked for this site. On iPhone/iPad: Settings → Safari → Camera, and set it to "Ask" or "Allow", then reload this page.'
      : 'Camera access is blocked for this site. Tap the lock/info icon next to the address bar → Permissions → Camera → Allow, then reload this page.';
  }
  if (cause?.name === 'NotFoundError') {
    return 'No camera was found on this device.';
  }
  return 'Camera is unavailable. Try again in a moment.';
}

export function orientationDeniedMessage(): string {
  if (isIOS() && isStandalone()) {
    return `Motion & Orientation access is blocked in this Home Screen app.${IOS_STANDALONE_NOTE}`;
  }
  return isIOS()
    ? 'Motion & Orientation access was denied — AR view needs it to know which way you\'re pointing. Settings → Safari → Motion & Orientation Access, turn it on, then reload this page.'
    : "Motion access was denied — AR view needs it to know which way you're pointing.";
}
