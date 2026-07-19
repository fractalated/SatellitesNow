import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = '/SatellitesNow/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      scope: base,
      manifest: {
        id: base,
        name: 'SatellitesNow',
        short_name: 'SatNow',
        description: 'Live AR and sky-map view of the brightest satellites passing overhead.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#05060a',
        theme_color: '#05060a',
        categories: ['utilities', 'navigation'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
