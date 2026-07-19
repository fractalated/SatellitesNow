export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      // PWA plugin's virtual module is only present in a built/served app, not always in dev.
    });
}
