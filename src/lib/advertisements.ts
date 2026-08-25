export const AD_ACTION_TYPES = ["phone", "internal_route", "external_link"] as const;
export type AdActionType = (typeof AD_ACTION_TYPES)[number];
export type AdTrackType = "impression" | "click";

export type Advertisement = {
  id: string;
  title: string;
  client_name: string;
  client_phone: string;
  image_url: string;
  action_type: AdActionType;
  action_value: string;
  display_order: number;
  is_active: boolean;
  start_date: string;
  end_date: string;
  impression_count: number;
  click_count: number;
  created_at: string;
  updated_at: string;
};

/** Mobil / public API — müşteri ve istatistik yok. */
export type PublicBanner = {
  id: string;
  title: string;
  image_url: string;
  action_type: AdActionType;
  action_value: string;
  display_order: number;
};

export const MAX_ADVERTISEMENTS = 24;
export const BANNER_AUTOPLAY_MS = 4000;
export const BANNER_IMPRESSION_MS = 1000;

export const ADVERTISEMENTS_SQL = `-- advertisements tablosu (SQL Editor'da bir kez). Token gerekmez.
-- Tam şema: supabase/migrations/20260824160000_advertisements.sql
`;

export function isMissingAdvertisementsSchema(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    (msg.includes("advertisements") ||
      msg.includes("get_active_banners") ||
      msg.includes("track_advertisement") ||
      msg.includes("expire_stale")) &&
    (msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("could not find") ||
      error.code === "PGRST202" ||
      error.code === "PGRST204" ||
      error.code === "PGRST205" ||
      error.code === "42P01" ||
      error.code === "42883")
  );
}

/** Listeleme duvarı: yalnızca tablo yoksa. RPC 404 paneli kilitlemesin. */
export function isMissingAdvertisementsTable(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    msg.includes("advertisements") &&
    (error.code === "PGRST205" ||
      error.code === "42P01" ||
      msg.includes("could not find the table") ||
      (msg.includes("relation") && msg.includes("does not exist")))
  );
}

function str(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sanitizeActionValue(type: AdActionType, raw: string): string {
  const value = raw.trim();
  if (type === "phone") {
    const digits = value.replace(/[^\d+]/g, "");
    if (digits.length < 10 || digits.length > 16) return "";
    return digits.slice(0, 16);
  }
  if (type === "internal_route") {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "";
    return value.slice(0, 300);
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString().slice(0, 500);
  } catch {
    /* geçersiz */
  }
  return "";
}

export function parseActionType(value: unknown): AdActionType {
  return AD_ACTION_TYPES.includes(value as AdActionType) ? (value as AdActionType) : "internal_route";
}

function isoDate(value: unknown, fallback: Date): string {
  if (typeof value === "string" && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback.toISOString();
}

export function defaultAdDates(): { start_date: string; end_date: string } {
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

export function parseAdvertisement(raw: unknown): Advertisement | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row["id"], "", 80);
  const imageUrl = str(row["image_url"], "", 500);
  if (!id || !imageUrl) return null;
  const actionType = parseActionType(row["action_type"]);
  const dates = defaultAdDates();
  return {
    id,
    title: str(row["title"], "Reklam", 120),
    client_name: str(row["client_name"], "", 80),
    client_phone: str(row["client_phone"], "", 30),
    image_url: imageUrl,
    action_type: actionType,
    action_value: sanitizeActionValue(actionType, str(row["action_value"], "/", 500)) || "/",
    display_order: int(row["display_order"], 0, 0, 9999),
    is_active: bool(row["is_active"], true),
    start_date: isoDate(row["start_date"], new Date(dates.start_date)),
    end_date: isoDate(row["end_date"], new Date(dates.end_date)),
    impression_count: int(row["impression_count"], 0, 0, 1_000_000_000),
    click_count: int(row["click_count"], 0, 0, 1_000_000_000),
    created_at: isoDate(row["created_at"], new Date()),
    updated_at: isoDate(row["updated_at"], new Date()),
  };
}

export function parsePublicBanner(raw: unknown): PublicBanner | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row["id"], "", 80);
  const imageUrl = str(row["image_url"], "", 500);
  if (!id || !imageUrl) return null;
  const actionType = parseActionType(row["action_type"]);
  return {
    id,
    title: str(row["title"], "", 120),
    image_url: imageUrl,
    action_type: actionType,
    action_value: sanitizeActionValue(actionType, str(row["action_value"], "", 500)),
    display_order: int(row["display_order"], 0, 0, 9999),
  };
}

export function isAdExpired(ad: Pick<Advertisement, "end_date">, now = Date.now()): boolean {
  return new Date(ad.end_date).getTime() <= now;
}

export function isAdScheduled(ad: Pick<Advertisement, "start_date">, now = Date.now()): boolean {
  return new Date(ad.start_date).getTime() > now;
}

export function clickThroughRate(impressions: number, clicks: number): number | null {
  if (impressions <= 0) return null;
  return Math.round((clicks / impressions) * 10000) / 100;
}

export function formatCtr(impressions: number, clicks: number): string {
  const rate = clickThroughRate(impressions, clicks);
  return rate == null ? "—" : `${rate.toFixed(2)}%`;
}

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function emptyAdvertisementDraft(): Omit<Advertisement, "id" | "created_at" | "updated_at" | "impression_count" | "click_count"> {
  const dates = defaultAdDates();
  return {
    title: "",
    client_name: "",
    client_phone: "",
    image_url: "",
    action_type: "internal_route",
    action_value: "/",
    display_order: 0,
    is_active: true,
    start_date: dates.start_date,
    end_date: dates.end_date,
  };
}

export async function fetchPublicBanners(): Promise<PublicBanner[]> {
  try {
    const response = await fetch("/api/v1/banners", { headers: { accept: "application/json" } });
    if (!response.ok) return [];
    const body: unknown = await response.json();
    const list = Array.isArray(body)
      ? body
      : body && typeof body === "object" && Array.isArray((body as { data?: unknown })["data"])
        ? ((body as { data: unknown[] })["data"] as unknown[])
        : [];
    return list.map(parsePublicBanner).filter((item): item is PublicBanner => item != null);
  } catch {
    return [];
  }
}

export function trackBanner(id: string, type: AdTrackType): void {
  if (typeof fetch === "undefined" || !id) return;
  const url = `/api/v1/banners/${encodeURIComponent(id)}/track`;
  const payload = JSON.stringify({ type });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    /* sendBeacon yok / reddedildi */
  }
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
