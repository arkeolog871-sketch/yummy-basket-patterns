export type BusinessLocation = {
  name: string;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_url?: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Human readable location label, or null when the business has no location data. */
export function locationLabel(business: BusinessLocation) {
  const parts = [business.district, business.city].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );
  if (parts.length > 0) return parts.join(", ");
  const address = business.address?.trim();
  return address ? address : null;
}

function destinationQuery(business: BusinessLocation) {
  const lat = toNumber(business.latitude);
  const lng = toNumber(business.longitude);
  if (lat !== null && lng !== null) return `${lat},${lng}`;
  const parts = [business.name, business.address, business.district, business.city]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Builds a maps URL for the business. Falls back to a plain Google Maps
 * search on the address text, and finally to a search on the business name,
 * so a missing coordinate never breaks the UI.
 */
export function buildMapsUrl(business: BusinessLocation) {
  const custom = business.maps_url?.trim();
  if (custom && /^https?:\/\//i.test(custom)) return custom;

  const destination = destinationQuery(business);
  if (!destination) return null;

  const lat = toNumber(business.latitude);
  const lng = toNumber(business.longitude);
  if (lat !== null && lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }

  const hasAddress = Boolean(
    business.address?.trim() || business.district?.trim() || business.city?.trim(),
  );
  return hasAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isApple() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);
}

/** Opens the device map app on mobile, or Google Maps directions in a new tab. */
export function openDirections(business: BusinessLocation) {
  const webUrl = buildMapsUrl(business);
  if (!webUrl) return false;
  if (typeof window === "undefined") return false;

  const destination = destinationQuery(business);
  if (isMobile() && destination) {
    const encoded = encodeURIComponent(destination);
    const appUrl = isApple()
      ? `maps://?daddr=${encoded}`
      : `geo:0,0?q=${encoded}`;
    window.location.href = appUrl;
    window.setTimeout(() => {
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }, 900);
    return true;
  }

  window.open(webUrl, "_blank", "noopener,noreferrer");
  return true;
}