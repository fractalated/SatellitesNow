/**
 * Small decorative graphic for the start screen: a satellite leaving a fading
 * track behind it, with Earth's limb partially in view. Plain inline SVG — no
 * image asset to source/license, scales crisply, and reuses the app's own
 * track-fade visual language (bright near the satellite, fading along the trail).
 */
export const HERO_GRAPHIC_SVG = `
<svg class="hero-graphic" viewBox="0 0 320 150" width="100%" height="130" aria-hidden="true">
  <defs>
    <radialGradient id="heroEarth" cx="30%" cy="5%" r="70%">
      <stop offset="0%" stop-color="#1c4a5e"/>
      <stop offset="55%" stop-color="#0e2f3d"/>
      <stop offset="100%" stop-color="#081b22"/>
    </radialGradient>
    <linearGradient id="heroTrack" x1="0%" y1="0%" x2="100%" y2="60%">
      <stop offset="0%" stop-color="#6fd3ff" stop-opacity="0"/>
      <stop offset="65%" stop-color="#6fd3ff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#eaf6ff" stop-opacity="0.95"/>
    </linearGradient>
  </defs>

  <circle cx="28" cy="18" r="1.2" fill="#c7d3de" opacity="0.7"/>
  <circle cx="64" cy="10" r="1" fill="#c7d3de" opacity="0.5"/>
  <circle cx="112" cy="22" r="1.4" fill="#c7d3de" opacity="0.6"/>
  <circle cx="150" cy="6" r="1.1" fill="#c7d3de" opacity="0.55"/>
  <circle cx="196" cy="12" r="1" fill="#c7d3de" opacity="0.5"/>
  <circle cx="240" cy="20" r="1.3" fill="#c7d3de" opacity="0.6"/>
  <circle cx="280" cy="14" r="1" fill="#c7d3de" opacity="0.4"/>

  <path d="M 30 26 Q 140 14 248 68" fill="none" stroke="url(#heroTrack)" stroke-width="2.5" stroke-linecap="round"/>

  <circle cx="248" cy="68" r="8" fill="#eaf6ff" opacity="0.18"/>
  <circle cx="248" cy="68" r="3.5" fill="#eaf6ff"/>

  <!-- Earth's limb: a thin curved sliver at the very bottom, like a distant orbital view. -->
  <circle cx="160" cy="380" r="260" fill="url(#heroEarth)"/>
</svg>
`.trim();
