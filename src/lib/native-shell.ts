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
 * Native kabukta (iOS Capacitor veya Android sarmalayıcı) `<html
 * data-native-shell>` işaretini koyan satır içi betik.
 *
 * NEDEN: başlığın sabit durması `position: sticky`'ye bırakılamıyor.
 * - iOS'ta WKWebView yapışkan başlığın tuşlarını ilk açılışta dokunmaya
 *   kapatıyordu, bu yüzden iOS'ta yapışkanlık hiç kullanılmıyor.
 * - Android uygulamasında kullanıcı cihazında başlığın kaydırınca kaybolduğunu
 *   bildirdi; aynı sayfa Chromium'da (Android uygulamasının kimliği ve köprüsü
 *   taklit edilerek) yapışkan kalıyordu, yani sebep cihazın WebView'inde.
 *
 * Sabitlik bu yüzden düzenle sağlanıyor: belge kaymıyor, yalnızca başlığın
 * altındaki içerik alanı kayıyor (styles.css → `html[data-native-shell]`).
 * Başlık normal akışta en üstte durduğu için yapışkanlığa ihtiyaç kalmıyor.
 *
 * Erken çalışması şart: düzen React bağlanmadan kurulmazsa sayfa bir an eski
 * düzende çizilip zıplıyor. Capacitor köprüsü ve Android'in
 * `addJavascriptInterface` nesnesi (`SilvanNative`) belge başında hazır.
 */
export const NATIVE_SHELL_ATTRIBUTE = "data-native-shell";

export function nativeShellMarkerInlineScript(): string {
  return `try{var w=window,c=w.Capacitor,ios=!!(c&&c.isNativePlatform&&c.isNativePlatform()&&c.getPlatform&&c.getPlatform()==="ios");if(ios||w.SilvanNative)document.documentElement.setAttribute("${NATIVE_SHELL_ATTRIBUTE}","")}catch(e){}`;
}

/** Erken betik kaçırdıysa (köprü geç geldiyse) işareti sonradan koyar. */
export function markNativeShell(): void {
  if (typeof document === "undefined" || !isNativeShell()) return;
  document.documentElement.setAttribute(NATIVE_SHELL_ATTRIBUTE, "");
}
