export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports as "MacIntel" in userAgent but is touch-capable, unlike a real Mac.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
