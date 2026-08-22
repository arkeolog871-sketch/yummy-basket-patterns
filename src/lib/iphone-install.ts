export const IOS_A2HS_FLAG = "silvan-ios-a2hs";
export const APP_ORIGIN = "https://uygulamamcebimde.online";

export type IosInstallKind =
  "unknown" | "installed" | "safari" | "ios-other" | "android" | "desktop";

export function detectIosInstallKind(): IosInstallKind {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  if (standalone) return "installed";

  const ios =
    /iPhone|iPad|iPod/i.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  if (!ios) {
    if (/android/i.test(ua)) return "android";
    return "desktop";
  }

  const inApp = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Instagram|FBAN|FBAV|Line\/|Twitter/i.test(ua);
  if (inApp) return "ios-other";
  if (/Safari/i.test(ua)) return "safari";
  return "ios-other";
}

export function safariInstallUrl() {
  if (typeof window === "undefined") return `${APP_ORIGIN}/iphone`;
  const host = window.location.hostname;
  if (
    host === "localhost" ||
    host.endsWith("uygulamamcebimde.online") ||
    host.endsWith("lovable.app") ||
    host.endsWith("lovableproject.com")
  ) {
    return `${window.location.origin}/iphone`;
  }
  return `${APP_ORIGIN}/iphone`;
}
