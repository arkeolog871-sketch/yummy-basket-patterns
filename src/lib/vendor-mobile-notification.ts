import { formatPrice } from "@/lib/format";

const PRODUCTION_ORIGIN = "https://uygulamamcebimde.online";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEEN_STORAGE_KEY = "silvan.vendor.mobile.notif.v1";

export type VendorMobileOrderPayload = {
  orderId: string;
  total: number;
  items: Array<{ name: string; quantity: number }>;
};

type SilvanNativeNotify = {
  showNotification?: (title: string, body: string, url: string) => void;
  requestNotifications?: () => void;
  getFcmToken?: () => string;
};

export function isOrderId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function vendorOrderDetailPath(orderId: string): string {
  return `/vendor/dashboard?order=${encodeURIComponent(orderId)}`;
}

export function vendorOrderDetailUrl(orderId: string, origin = PRODUCTION_ORIGIN): string {
  const base = origin.replace(/\/$/, "") || PRODUCTION_ORIGIN;
  return `${base}${vendorOrderDetailPath(orderId)}`;
}

export function formatVendorOrderNumber(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function formatVendorMobileNotification(
  payload: VendorMobileOrderPayload,
  origin = PRODUCTION_ORIGIN,
): { title: string; body: string; url: string } {
  const number = formatVendorOrderNumber(payload.orderId);
  const total = formatPrice(Number(payload.total) || 0);
  const items = payload.items
    .map((line) => `${Number(line.quantity) || 0}× ${line.name}`.trim())
    .filter((line) => !line.startsWith("0×"))
    .join(", ");
  return {
    title: "Yeni Sipariş",
    body: items ? `#${number} · ${total} · ${items}` : `#${number} · ${total}`,
    url: vendorOrderDetailUrl(payload.orderId, origin),
  };
}

const seenOrderKeys = new Set<string>();

/** Aynı kullanıcı + sipariş için bir kez true. Bellek + sessionStorage. */
export function claimVendorMobileNotification(userId: string, orderId: string): boolean {
  if (!userId || !isOrderId(orderId)) return false;
  const key = `${userId}:${orderId}`;
  if (seenOrderKeys.has(key)) return false;
  try {
    const raw = sessionStorage.getItem(SEEN_STORAGE_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (Array.isArray(list) && list.includes(key)) {
      seenOrderKeys.add(key);
      return false;
    }
    const next = [...(Array.isArray(list) ? list : []), key].slice(-80);
    sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / SSR: bellek yeter.
  }
  seenOrderKeys.add(key);
  return true;
}

export function nativeNotifyBridge(): SilvanNativeNotify | null {
  if (typeof window === "undefined") return null;
  const native = (window as Window & { SilvanNative?: SilvanNativeNotify }).SilvanNative;
  if (!native) return null;
  if (typeof native.showNotification !== "function" && typeof native.requestNotifications !== "function") {
    return null;
  }
  return native;
}

export function requestVendorNotificationPermission(): void {
  const native = nativeNotifyBridge();
  try {
    native?.requestNotifications?.();
  } catch {
    // Native köprü yoksa tarayıcı izni denenir.
  }
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  void Notification.requestPermission().catch(() => undefined);
}

export function showVendorMobileNotification(
  notice: { title: string; body: string; url: string },
  onOpen: () => void,
): boolean {
  const native = nativeNotifyBridge();
  if (native && typeof native.showNotification === "function") {
    native.showNotification(notice.title, notice.body, notice.url);
    return true;
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    const popup = new Notification(notice.title, {
      body: notice.body,
      tag: notice.url,
    });
    popup.onclick = () => {
      popup.close();
      onOpen();
    };
    return true;
  } catch {
    return false;
  }
}

export const __vendorMobileNotificationTest = {
  UUID_RE,
  SEEN_STORAGE_KEY,
  seenOrderKeys,
};
