export const CELESTRAK_ACTIVE_TLE_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';

export const CELESTRAK_SATCAT_ACTIVE_URL = 'https://celestrak.org/satcat/records.php?GROUP=active';

/** CelesTrak asks clients not to poll much more often than this. */
export const TLE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Satellite physical size (RCS) barely ever changes, so this is cached far longer
 * than the TLE set to avoid re-downloading a multi-MB dataset every couple of hours. */
export const SIZE_DATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const EARTH_RADIUS_KM = 6371;

/** How far back/forward a satellite's rendered track extends, and the sampling step. */
export const TRACK_TRAIL_SEC = 120;
export const TRACK_FORWARD_MAX_SEC = 20 * 60;
export const TRACK_STEP_SEC = 15;

/** The active catalog + SATCAT size data run several MB combined -- past typical
 * localStorage quotas -- so both are cached in IndexedDB instead. */
export const IDB_DATABASE_NAME = 'satellitesnow';
export const IDB_TLE_STORE = 'tleCache';
export const IDB_SIZE_STORE = 'sizeCache';

/** Naked-eye limiting magnitude under reasonably dark skies -- a loose upper bound;
 * MAX_VISIBLE_SATELLITES below does most of the actual decluttering. */
export const MAGNITUDE_VISIBLE_THRESHOLD = 6.0;

/** Only the brightest N currently-visible satellites are shown at all, so the view
 * stays readable instead of listing every technically-above-threshold object. */
export const MAX_VISIBLE_SATELLITES = 10;
