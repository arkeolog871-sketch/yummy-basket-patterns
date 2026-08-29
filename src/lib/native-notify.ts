/** Android WebView köprüsü ile gerçek cihaz bildirimi; tarayıcıda sessizce atlanır. */
type NativeNotifyBridge = {
  showNotification?: (title: string, body: string) => void;
};

function bridge(): NativeNotifyBridge | null {
  if (typeof window === "undefined") return null;
  const native = (window as Window & { SilvanNative?: NativeNotifyBridge }).SilvanNative;
  if (!native || typeof native.showNotification !== "function") return null;
  return native;
}

/** Android uygulaması içindeyse cihaz bildirimi gösterir, değilse false döner. */
export function showNativeNotification(title: string, body: string): boolean {
  const native = bridge();
  if (!native?.showNotification) return false;
  try {
    native.showNotification(title, body);
    return true;
  } catch {
    return false;
  }
}

const SEEN_KEY = "silvan.vendor.seenAlertIds";
const SEEN_LIMIT = 200;

/** Aynı bildirimin sayfa yenilense bile tekrar tekrar gösterilmesini engeller. */
export function loadSeenAlertIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function saveSeenAlertIds(ids: Iterable<string>): void {
  if (typeof window === "undefined") return;
  try {
    const list = Array.from(ids).slice(-SEEN_LIMIT);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    // storage kapalıysa bildirim yine gösterilir, sadece kalıcılık olmaz
  }
}
