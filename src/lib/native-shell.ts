/**
 * Uygulama hangi kabuğun içinde çalışıyor?
 *
 * Aynı web kodu üç yerde çalışıyor: tarayıcı, Android WebView sarmalayıcısı ve
 * iOS Capacitor kabuğu. Davranış farkları (Web Push yok, tarayıcıya çıkış yok,
 * window.open'ın dönüş değeri) bu ayrımı birkaç modülde ayrı ayrı yaptırmıştı;
 * kopyalar zamanla birbirinden ayrılıyordu — iOS'un unutulduğu bir kopya,
 * uygulamanın kullanıcıya "bu tarayıcı bildirimleri desteklemiyor" demesine
 * yol açmıştı. Tek kaynak burası.
 */

type CapacitorShell = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function shellWindow(): (Window & { Capacitor?: CapacitorShell; SilvanNative?: unknown }) | null {
  if (typeof window === "undefined") return null;
  return window as Window & { Capacitor?: CapacitorShell; SilvanNative?: unknown };
}

/** iOS Capacitor kabuğunun içinde miyiz? */
export function isIosNativeShell(): boolean {
  const win = shellWindow();
  if (!win?.Capacitor?.isNativePlatform?.()) return false;
  return win.Capacitor.getPlatform?.() === "ios";
}

/** Android sarmalayıcısının içinde miyiz? (JS köprüsü enjekte ediliyor) */
export function isAndroidNativeShell(): boolean {
  return Boolean(shellWindow()?.SilvanNative);
}

/** Herhangi bir native kabuk — yani gerçek bir tarayıcıda değiliz. */
export function isNativeShell(): boolean {
  return isAndroidNativeShell() || isIosNativeShell();
}
