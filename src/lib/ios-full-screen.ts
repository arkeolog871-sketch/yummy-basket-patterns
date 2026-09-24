/**
 * iPhone uygulamasında sayfa ekranın altına kadar insin (alt boşluk olmasın).
 *
 * SEBEP (WebKit kaynağından doğrulandı, WKWebViewIOS.mm → activeViewLayoutSize):
 * iPhone uygulaması `contentInset: "automatic"` ile açılıyor. Bu ayarda sayfanın
 * yüksekliği = ekran − üst güvenli alan − alt güvenli alan. 22 Eylül'den beri
 * belge kilitli (yalnız içerik alanı kayıyor, başlık sabit); içerik alt güvenli
 * alana (ana ekran çizgisi bölgesi) hiç inemiyor ve orada boş bir şerit kalıyor.
 *
 * ÇÖZÜM: sayfa, bu cihazda EKSİK KALAN miktar kadar uzatılır; içerik alanının
 * sonuna aynı miktarda pay konur. İçerik çizginin arkasından akar, son satır
 * çizginin üstünde durur. Eksik miktar model tablosundan değil, o telefonun
 * kendi ekranından ölçülür: ekran yüksekliği − sayfanın düzen yüksekliği.
 *
 * Kilit bozulmaz: kök `overflow: hidden` iken WebKit ana sayfanın parmakla
 * kaydırılmasını kapatır (WKWebViewIOS.mm → _updateScrollViewForTransaction:
 * hasScrollableOrZoomedMainFrame yanlışsa pan hareketi kapalı).
 *
 * ANDROID'E DOKUNMAZ: yalnız `data-ios-shell` işaretiyle çalışır; o işaret
 * yalnız Capacitor iOS kabuğunda konur (Android uygulamasında Capacitor yok).
 * Mevcut kilit kuralları ve native-shell.ts'teki işaretleme aynen duruyor.
 *
 * Güvenlik: ölçüm alınamaz ya da makul aralığın dışındaysa uzatma 0 olur,
 * yani bugünkü durum sürer. Uygulama ileride ekranın tamamını sayfaya verirse
 * (contentInset "never") eksik 0 ölçülür ve bu kod kendiliğinden devreden çıkar.
 */

export const IOS_SHELL_ATTRIBUTE = "data-ios-shell";
export const IOS_BOTTOM_BLEED_VAR = "--ios-bottom-bleed";

/** Güvenli alanlar toplamı bu değeri geçemez; geçiyorsa ölçüm yanlıştır. */
const MAX_BLEED = 200;

/**
 * Ekran yüksekliği − sayfanın düzen yüksekliği (CSS pikseli). Dik tutuşta
 * ekranın uzun kenarı, yan tutuşta kısa kenarı esas alınır.
 */
export function measureMissingHeight(input: {
  screenWidth: number;
  screenHeight: number;
  layoutWidth: number;
  layoutHeight: number;
}): number {
  const { screenWidth, screenHeight, layoutWidth, layoutHeight } = input;
  if (![screenWidth, screenHeight, layoutWidth, layoutHeight].every(Number.isFinite)) return 0;
  if (screenWidth <= 0 || screenHeight <= 0 || layoutWidth <= 0 || layoutHeight <= 0) return 0;
  const portrait = layoutWidth <= layoutHeight;
  const fullHeight = portrait
    ? Math.max(screenWidth, screenHeight)
    : Math.min(screenWidth, screenHeight);
  const missing = Math.round(fullHeight - layoutHeight);
  return missing > 0 && missing <= MAX_BLEED ? missing : 0;
}

/** iOS kabuğunu işaretleyen satır içi betik (mevcut işaret betiğinden AYRI). */
export function iosShellMarkerInlineScript(): string {
  return `try{var c=window.Capacitor;if(c&&c.isNativePlatform&&c.isNativePlatform()&&c.getPlatform&&c.getPlatform()==="ios")document.documentElement.setAttribute("${IOS_SHELL_ATTRIBUTE}","")}catch(e){}`;
}

function isIosCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (
    window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }
  ).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.() && capacitor.getPlatform?.() === "ios");
}

function isTyping(): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  return (
    active.tagName === "INPUT" ||
    active.tagName === "TEXTAREA" ||
    active.tagName === "SELECT" ||
    active.isContentEditable
  );
}

/**
 * iPhone kabuğunda ölçer, CSS değişkenini yazar; döndürme ve boyut
 * değişiminde yeniden ölçer. Başka her ortamda hiçbir şey yapmaz.
 */
export function installIosFullScreen(): () => void {
  if (typeof document === "undefined" || !isIosCapacitor()) return () => {};
  const root = document.documentElement;
  root.setAttribute(IOS_SHELL_ATTRIBUTE, "");

  let bleed = 0;
  const apply = () => {
    bleed = measureMissingHeight({
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      layoutWidth: root.clientWidth,
      layoutHeight: root.clientHeight,
    });
    root.style.setProperty(IOS_BOTTOM_BLEED_VAR, `${bleed}px`);
  };

  // Belge kilitli olmalı. Eski iOS sürümlerinde (uygulama iOS 15'i de
  // destekliyor) ana sayfa yine de kayarsa, yazı yazılmıyorken yerine döner.
  // "Yer" açılıştaki konumdur (0 varsayılmaz): dinlenme konumu nasıl
  // raporlanırsa raporlansın sayfa kendiliğinden oynatılmaz. Klavye açıkken
  // iOS'un alanı göstermek için yaptığı kaydırmaya karışılmaz.
  const rest = window.scrollY;
  const settle = () => {
    if (bleed > 0 && window.scrollY !== rest && !isTyping()) window.scrollTo(0, rest);
  };
  const settleLater = () => {
    window.setTimeout(settle, 350);
  };

  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  window.addEventListener("scroll", settle, { passive: true });
  document.addEventListener("focusout", settleLater);
  return () => {
    window.removeEventListener("resize", apply);
    window.removeEventListener("orientationchange", apply);
    window.removeEventListener("scroll", settle);
    document.removeEventListener("focusout", settleLater);
  };
}
