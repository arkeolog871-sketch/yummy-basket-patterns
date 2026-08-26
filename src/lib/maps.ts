export type BusinessLocation = {
  name: string;
  slug?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_url?: string | null;
};

/** Canonical storefront path: `/restoran/$slug`. */
export function businessDetailPath(slug: string) {
  return `/restoran/${encodeURIComponent(slug)}`;
}

export function toCoord(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Number.isFinite(value) ? value : null;
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
    const fromIntent = toSafeHttpsMapsUrl(candidate);
    if (fromIntent && isGoogleMapsUrl(fromIntent)) return fromIntent;
  }
  return null;
}

function googleMapsDirUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

type NativeMapsBridge = { openMaps?: (url: string) => void };

function nativeMapsBridge(): NativeMapsBridge | null {
  if (typeof window === "undefined") return null;
  const native = (window as Window & { SilvanNative?: NativeMapsBridge }).SilvanNative;
  return native && typeof native.openMaps === "function" ? native : null;
}

/** Android System WebView (APK kabuğu). Google Maps sayfası burada intent:// üretir. */
export function isAndroidWebView() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/SilvanCebimde/i.test(ua)) return true;
  return /Android/i.test(ua) && (/; wv\)/i.test(ua) || /Version\/4\.0/i.test(ua));
}

/** Android intent:// → HTTPS. Önce S.browser_fallback_url, yoksa şema+host, yoksa Maps search. */
export function httpsFromIntentUrl(raw: string, queryFallback = ""): string | null {
  const trimmed = raw.trim();
  if (!/^intent:/i.test(trimmed)) return null;

  const fallbackMatch = trimmed.match(/S\.browser_fallback_url=([^;]*)/i);
  if (fallbackMatch?.[1]) {
    const decoded = tryDecode(fallbackMatch[1]);
    if (/^https:\/\//i.test(decoded)) return decoded;
  }

  const marker = trimmed.indexOf("#Intent;");
  const schemeMatch = trimmed.match(/;scheme=([^;]+)/i);
  const scheme = (schemeMatch?.[1] || "https").toLowerCase();
  if (marker > "intent://".length && (scheme === "https" || scheme === "http")) {
    return `${scheme}://${trimmed.slice("intent://".length, marker)}`;
  }

  const coords = matchCoords(trimmed);
  if (coords) return googleMapsSearchUrl(`${coords.lat},${coords.lng}`);
  const dest = trimmed.match(/[?&](?:destination|query|q)=([^&;#]+)/i);
  if (dest?.[1]) return googleMapsSearchUrl(tryDecode(dest[1]));
  if (queryFallback.trim()) return googleMapsSearchUrl(queryFallback.trim());
  return googleMapsSearchUrl("");
}

function httpsFromGeoUrl(raw: string): string | null {
  const coords = matchCoords(raw);
  if (coords) return googleMapsSearchUrl(`${coords.lat},${coords.lng}`);
  const q = raw.match(/[?&]q=([^&]*)/i);
  if (q?.[1]) return googleMapsSearchUrl(tryDecode(q[1]));
  return null;
}

/** intent://, geo: ve google.navigation: adreslerini WebView'in yükleyebileceği HTTPS'e çevirir. */
export function toSafeHttpsMapsUrl(raw: string, queryFallback = ""): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^intent:/i.test(trimmed)) return httpsFromIntentUrl(trimmed, queryFallback);
  if (/^geo:/i.test(trimmed) || /^google\.navigation:/i.test(trimmed)) {
    return httpsFromGeoUrl(trimmed) ?? (queryFallback.trim() ? googleMapsSearchUrl(queryFallback.trim()) : googleMapsSearchUrl(""));
  }
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  return null;
}

/**
 * Harici harita / bağlantı aç. intent:// asla location'a yazılmaz.
 * WebView'de native köprü, yoksa HTTPS (try/catch).
 */
export function openExternalUrl(raw: string, queryFallback = ""): boolean {
  if (typeof window === "undefined") return false;
  try {
    const https = toSafeHttpsMapsUrl(raw, queryFallback);
    if (!https || !/^https:\/\//i.test(https)) return false;

    const native = nativeMapsBridge();
    if (native?.openMaps) {
      try {
        native.openMaps(https);
        return true;
      } catch {
        /* native yok / reddetti */
      }
    }

    if (isAndroidWebView()) {
      window.location.href = https;
      return true;
    }

    const opened = window.open(https, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = https;
    return true;
  } catch {
    return false;
  }
}

/** intent:// ve geo: link tıklamalarını HTTPS'e çevirir. */
export function installMapsSchemeGuard() {
  if (typeof document === "undefined") return () => undefined;
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href") ?? "";
    if (!/^(intent:|geo:|google\.navigation:)/i.test(href)) return;
    event.preventDefault();
    event.stopPropagation();
    openExternalUrl(href, anchor.textContent?.trim() ?? "");
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

/** Yol tarifi: her zaman HTTPS Google Maps; intent:// WebView'e hiç yazılmaz. */
export function openDirections(business: BusinessLocation) {
  if (typeof window === "undefined") return false;
  const googleUrl = buildMapsUrl(business);
  if (!googleUrl) return false;
  return openExternalUrl(googleUrl, destinationQuery(business) ?? business.name);
}

/** <a href> her zaman https:// — intent:// / geo: yok. */
export function directionsLinkUrl(business: BusinessLocation) {
  const url = buildMapsUrl(business);
  if (!url) return null;
  return toSafeHttpsMapsUrl(url, destinationQuery(business) ?? business.name) ?? url;
}

/**
 * Builds a Google Maps directions URL from latitude/longitude, then address.
 * `maps_url` is not a location source.
 */
export function buildMapsUrl(business: BusinessLocation) {
  const coords = resolveBusinessCoords(business);
  if (coords) return googleMapsDirUrl(`${coords.lat},${coords.lng}`);

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

/** Harita pini yalnızca kayıttaki latitude + longitude değerinden oluşur. */
export function resolveBusinessCoords(business: BusinessLocation) {
  const lat = toCoord(business.latitude);
  const lng = toCoord(business.longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
