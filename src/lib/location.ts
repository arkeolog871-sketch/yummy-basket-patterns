/**
 * Canonical Silvan pin used only as founder-form coordinate hints.
 *
 * Values match the production `restaurants` row for slug `aydin`
 * (`38.1502421`, `40.9996722`), which live `/restoran/aydin` already
 * uses for "Yol tarifi al".
 *
 * Map canvases do not fall back to this constant: they pin from each
 * restaurant's `latitude`/`longitude` (or coordinates parsed from
 * `maps_url`). Browser storage does not cache map coordinates.
 */
export const SILVAN_DEFAULT_COORDS = {
  latitude: 38.1502421,
  longitude: 40.9996722,
} as const;

export const LATITUDE_FIELD_PLACEHOLDER = `Enlem (${SILVAN_DEFAULT_COORDS.latitude})`;
export const LONGITUDE_FIELD_PLACEHOLDER = `Boylam (${SILVAN_DEFAULT_COORDS.longitude})`;
