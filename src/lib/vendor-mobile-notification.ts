import { VENDOR_ORDERS_ROUTE } from "@/lib/native-notify";

type SilvanNativeBridge = {
  showNotification?: (title: string, body: string, route?: string) => void;
  requestNotifications?: () => void;
  getFcmToken?: () => string;
};

declare global {
  interface Window {
    SilvanNative?: SilvanNativeBridge;
    __onNativeFcmToken?: ((token: string) => void) | undefined;
  }
}

export function isAndroidShell(): boolean {
  if (typeof navigator === "undefined") return false;
  return /SilvanCebimde/i.test(navigator.userAgent);
}

export function requestMobileNotificationPermission(): void {
  try {
    window.SilvanNative?.requestNotifications?.();
  } catch {
    // Native bridge yoksa sessizce geç.
  }
}

export function showMobileNotification(
  title: string,
  body: string,
  route: string = VENDOR_ORDERS_ROUTE,
): void {
  if (!title.trim()) return;
  try {
    window.SilvanNative?.showNotification?.(title, body, route);
  } catch {
    // Web tarayıcısında native köprü yok.
  }
}

export function readNativeFcmTokenSync(): string | null {
  try {
    const token = window.SilvanNative?.getFcmToken?.();
    return token && token.trim().length > 20 ? token.trim() : null;
  } catch {
    return null;
  }
}

export function waitForNativeFcmToken(timeoutMs = 8000): Promise<string | null> {
  const immediate = readNativeFcmTokenSync();
  if (immediate) return Promise.resolve(immediate);
  if (!isAndroidShell()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.__onNativeFcmToken = undefined;
      resolve(readNativeFcmTokenSync());
    }, timeoutMs);

    window.__onNativeFcmToken = (token) => {
      window.clearTimeout(timer);
      window.__onNativeFcmToken = undefined;
      resolve(token?.trim() ? token.trim() : null);
    };

    try {
      window.SilvanNative?.requestNotifications?.();
    } catch {
      window.clearTimeout(timer);
      window.__onNativeFcmToken = undefined;
      resolve(null);
    }
  });
}

export function mobilePushPlatform(): "android" | "ios" | "web" {
  if (isAndroidShell()) return "android";
  if (typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    return "ios";
  }
  return "web";
}

/** Çıkış öncesi kayıtlı FCM tokenını sunucudan kaldırır; hata fırlatmaz. */
export async function unregisterMobilePushTokenOnSignOut(
  unregister: (input: { data: { token: string } }) => Promise<unknown>,
): Promise<void> {
  const token = readNativeFcmTokenSync();
  if (!token) return;
  try {
    await unregister({ data: { token } });
  } catch {
    // Çıkış akışını engelleme.
  }
}
