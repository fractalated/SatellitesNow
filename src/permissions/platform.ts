export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports as "MacIntel" in userAgent but is touch-capable, unlike a real Mac.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

/** True when running as an installed Home Screen / standalone app rather than a
 * regular browser tab. iOS gives standalone web apps a separate, historically
 * flakier permission story (geolocation/camera) than Safari itself — a known
 * WebKit limitation, not something app code can fix. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}
