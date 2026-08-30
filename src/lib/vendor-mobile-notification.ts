type SilvanNativeBridge = {
  showNotification?: (title: string, body: string) => void;
  requestNotifications?: () => void;
  getFcmToken?: () => string;
};

declare global {
  interface Window {
    SilvanNative?: SilvanNativeBridge;
    __onNativeFcmToken?: ((token: string) => void) | undefined;
    __SILVAN_FCM_TOKEN__?: string;
  }
}

export function isAndroidShell(): boolean {
  if (typeof navigator === "undefined") return false;
  return /SilvanCebimde/i.test(navigator.userAgent);
}

export function isIosNativeShell(): boolean {
  if (typeof navigator === "undefined") return false;
  // Capacitor iOS UA includes iPhone/iPad; also accept injected token marker.
  const hasCapacitor =
    typeof window !== "undefined" &&
    Boolean((window as Window & { Capacitor?: unknown }).Capacitor);
  return hasCapacitor || /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function requestMobileNotificationPermission(): void {
  try {
    window.SilvanNative?.requestNotifications?.();
  } catch {
    // Native bridge yoksa sessizce geç.
  }
}

export function showMobileNotification(title: string, body: string): void {
  if (!title.trim()) return;
  try {
    window.SilvanNative?.showNotification?.(title, body);
  } catch {
    // Web tarayıcısında native köprü yok.
  }
}

function readInjectedIosToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = (window as Window & { __SILVAN_FCM_TOKEN__?: string }).__SILVAN_FCM_TOKEN__;
  return token && token.trim().length > 20 ? token.trim() : null;
}

export function readNativeFcmTokenSync(): string | null {
  try {
    const android = window.SilvanNative?.getFcmToken?.();
    if (android && android.trim().length > 20) return android.trim();
  } catch {
    // Android köprüsü yok.
  }
  return readInjectedIosToken();
}

export function waitForNativeFcmToken(timeoutMs = 8000): Promise<string | null> {
  const immediate = readNativeFcmTokenSync();
  if (immediate) return Promise.resolve(immediate);
  if (!isAndroidShell() && !isIosNativeShell()) return Promise.resolve(null);

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
      // iOS'ta Java bridge yok; inject edilen token beklenir.
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
