export const CELESTRAK_VISUAL_TLE_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle';

/** CelesTrak asks clients not to poll much more often than this. */
export const TLE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const EARTH_RADIUS_KM = 6371;

/** How far back/forward a satellite's rendered track extends, and the sampling step. */
export const TRACK_TRAIL_SEC = 120;
export const TRACK_FORWARD_MAX_SEC = 20 * 60;
export const TRACK_STEP_SEC = 15;

export const TLE_CACHE_STORAGE_KEY = 'satellitesnow.tle.visual.v1';
