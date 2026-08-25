export type BusinessLocation = {
  name: string;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_url?: string | null;
};

export function toCoord(value: number | string | null | undefined) {
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
  const coords = resolveBusinessCoords(business);
  if (coords) return `${coords.lat},${coords.lng}`;
  const parts = [business.name, business.address, business.district, business.city]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  return parts.length > 0 ? parts.join(", ") : null;
}

function tryDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === "maps.google.com" || host === "maps.app.goo.gl" || host === "goo.gl") return true;
    if (url.pathname.toLowerCase().includes("/maps") && (host === "google.com" || host === "www.google.com" || host.endsWith(".google.com") || host.endsWith(".google.com.tr"))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function firstGoogleMapsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const decoded = tryDecode(raw.trim());
  const candidates = [raw.trim(), decoded, ...((decoded.match(/https?:\/\/[^\s"'<>]+/gi) as string[] | null) ?? [])];
  for (const candidate of candidates) {
    if (isGoogleMapsUrl(candidate)) return candidate;
  }
  return null;
}

function googleMapsDirUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

type NativeMapsBridge = { openMaps?: (url: string) => void };

function nativeMapsBridge(): NativeMapsBridge | null {
  if (typeof window === "undefined") return null;
  const native = (window as Window & { SilvanNative?: NativeMapsBridge }).SilvanNative;
  return native && typeof native.openMaps === "function" ? native : null;
}

/** Opens Google Maps directions (app on mobile if installed). */
export function openDirections(business: BusinessLocation) {
  const webUrl = buildMapsUrl(business);
  if (!webUrl || typeof window === "undefined") return false;

  const native = nativeMapsBridge();
  if (native?.openMaps) {
    native.openMaps(webUrl);
    return true;
  }

  const opened = window.open(webUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = webUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }
  return true;
}

/**
 * Builds a Google Maps directions URL. WhatsApp konum paylaşımlarındaki
 * Google Maps / geo linklerinden koordinat çıkarılır; ham wa.me açılmaz.
 */
export function buildMapsUrl(business: BusinessLocation) {
  const coords = resolveBusinessCoords(business);
  if (coords) return googleMapsDirUrl(`${coords.lat},${coords.lng}`);

  const share = firstGoogleMapsUrl(business.maps_url);
  if (share) {
    const fromShare = coordsFromMapsUrl(share);
    if (fromShare) return googleMapsDirUrl(`${fromShare.lat},${fromShare.lng}`);
    return share;
  }

  const destination = destinationQuery(business);
  if (!destination) return null;

  const hasAddress = Boolean(
    business.address?.trim() || business.district?.trim() || business.city?.trim(),
  );
  return hasAddress
    ? googleMapsDirUrl(destination)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

function matchCoords(source: string): { lat: number; lng: number } | null {
  const match =
    source.match(/[?&]q=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i) ??
    source.match(/[?&]query=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i) ??
    source.match(/[?&]destination=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i) ??
    source.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ??
    source.match(/[?&](?:ll|center)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/) ??
    source.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ??
    source.match(/geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Google Maps / WhatsApp konum / OSM bağlantısından enlem-boylam çıkarır. */
export function coordsFromMapsUrl(url: string | null | undefined) {
  if (!url) return null;
  const decoded = tryDecode(url);
  const pieces = [url, decoded, ...((decoded.match(/https?:\/\/[^\s"'<>]+/gi) as string[] | null) ?? [])];
  for (const piece of pieces) {
    const found = matchCoords(piece);
    if (found) return found;
  }
  return null;
}

/** İşletme kaydından harita noktası. Koordinat yoksa maps_url içinden okunur. */
export function resolveBusinessCoords(business: BusinessLocation) {
  const lat = toCoord(business.latitude);
  const lng = toCoord(business.longitude);
  if (lat !== null && lng !== null) return { lat, lng };
  return coordsFromMapsUrl(business.maps_url);
}
