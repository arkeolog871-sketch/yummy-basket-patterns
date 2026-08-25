/** iOS Safari / ana ekran Web Clip / PWA yardımcıları. Native Xcode veya Capacitor hedefi yoktur. */

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    /iPad|iPhone|iPod/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1)
  );
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

function isTelHref(href: string): boolean {
  return /^tel:\+?\d{10,15}$/i.test(href.trim());
}

/**
 * `tel:` aramasını iOS ana ekran (Web Clip / PWA) dahil açar.
 * Standalone iOS’ta `<a href="tel:">` tıklaması çoğu zaman yutulur; `location.href` gerekir.
 * Android WebView aynı adresi `shouldOverrideUrlLoading` ile ACTION_DIAL’a çevirir.
 */
export function openTelHref(href: string): boolean {
  if (typeof window === "undefined") return false;
  const tel = href.trim();
  if (!/^tel:/i.test(tel) || tel.length <= 4) return false;
  const compact = `tel:${tel.slice(4).replace(/[^\d+]/g, "")}`;
  if (!isTelHref(compact)) return false;
  try {
    if (isIosDevice() && isStandaloneDisplay()) {
      window.location.href = compact;
      return true;
    }
    window.location.assign(compact);
    return true;
  } catch {
    return false;
  }
}

/** Ana ekran Web Clip’te kalan `tel:` bağlantılarını Phone.app’e iletir. */
export function installTelSchemeGuard() {
  if (typeof document === "undefined") return () => undefined;
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href") ?? "";
    if (!/^tel:/i.test(href)) return;
    if (!isIosDevice() || !isStandaloneDisplay()) return;
    event.preventDefault();
    event.stopPropagation();
    openTelHref(href);
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
