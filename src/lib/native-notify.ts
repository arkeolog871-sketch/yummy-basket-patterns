import { isNativeShell } from "@/lib/native-shell";

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

/**
 * Native uygulama kabuğunun (Android WebView ya da iOS) içinde miyiz?
 *
 * İkisi de tarayıcının Web Push API'sini desteklemiyor; bildirimler orada ayrı
 * bir köprüyle (useFcmTokenBridge) zaten çalışıyor. Bu kontrol, "bu tarayıcı
 * bildirimleri desteklemiyor" uyarısının yalnızca gerçekten tarayıcıda
 * çıkmasını sağlıyor.
 *
 * iOS başta kapsam dışındaydı ve yalnızca Android köprüsüne bakılıyordu; o
 * yüzden iOS uygulamasında Bildirimler sayfası -- başlıktaki zil simgesinden
 * bir dokunuş uzakta -- kullanıcıya "bu TARAYICI bildirimleri desteklemiyor"
 * diyordu. Hem yanlış (uygulama APNs ile bildirim alıyor) hem de native bir
 * uygulamanın içinde kullanıcıya tarayıcıda olduğunu söylüyordu.
 */
export function isNativeApp(): boolean {
  return isNativeShell();
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

const SEEN_LIMIT = 200;

/** Aynı bildirimin sayfa yenilense bile tekrar tekrar gösterilmesini engeller. */
function loadSeenIds(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveSeenIds(storageKey: string, ids: Iterable<string>): void {
  if (typeof window === "undefined") return;
  try {
    const list = Array.from(ids).slice(-SEEN_LIMIT);
    window.localStorage.setItem(storageKey, JSON.stringify(list));
  } catch {
    // storage kapalıysa bildirim yine gösterilir, sadece kalıcılık olmaz
  }
}

const ALERT_SEEN_KEY = "silvan.vendor.seenAlertIds";
export const loadSeenAlertIds = () => loadSeenIds(ALERT_SEEN_KEY);
export const saveSeenAlertIds = (ids: Iterable<string>) => saveSeenIds(ALERT_SEEN_KEY, ids);

const MESSAGE_SEEN_KEY = "silvan.seenAdminMessageIds";
export const loadSeenMessageIds = () => loadSeenIds(MESSAGE_SEEN_KEY);
export const saveSeenMessageIds = (ids: Iterable<string>) => saveSeenIds(MESSAGE_SEEN_KEY, ids);
