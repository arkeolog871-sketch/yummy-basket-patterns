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

/**
 * iOS kabuğunda `<html data-ios-shell>` işaretini koyan satır içi betik.
 *
 * NEDEN erken: iOS'ta başlık yapışkan olamıyor (WKWebView'de yapışkan
 * başlığın tuşları ilk boyamada dokunmaya cevap vermiyordu). Sabit başlık
 * bunun yerine düzenle sağlanıyor: belge kaymıyor, yalnızca başlığın altındaki
 * içerik alanı kayıyor (styles.css → `html[data-ios-shell]`). Bu düzen React
 * bağlanmadan önce kurulmazsa sayfa bir an eski düzende çizilip zıplıyor.
 * Capacitor köprüsü belge başında enjekte edildiği için `window.Capacitor`
 * bu betik çalıştığında hazır.
 */
export const IOS_SHELL_ATTRIBUTE = "data-ios-shell";

export function iosShellMarkerInlineScript(): string {
  return `try{var c=window.Capacitor;if(c&&c.isNativePlatform&&c.isNativePlatform()&&c.getPlatform&&c.getPlatform()==="ios")document.documentElement.setAttribute("${IOS_SHELL_ATTRIBUTE}","")}catch(e){}`;
}

/** Erken betik kaçırdıysa (köprü geç geldiyse) işareti sonradan koyar. */
export function markIosShell(): void {
  if (typeof document === "undefined" || !isIosNativeShell()) return;
  document.documentElement.setAttribute(IOS_SHELL_ATTRIBUTE, "");
}
