import { supabase } from "@/integrations/supabase/client";

import {
  isInAppBrowser,
  nativeOAuthBridge,
  isLikelyMobileDevice,
  stripOAuthCallbackFromUrl,
  isGoogleOAuthCallbackParams,
  PRODUCTION_OAUTH_ORIGIN,
} from "@/lib/google-oauth";

const PENDING_STORAGE_KEY = "silvan.apple.oauth.pending.v1";
const RETURN_PATH_KEY = "silvan.apple.oauth.return.v1";
export const APPLE_OAUTH_RETURN_PATH_KEY = RETURN_PATH_KEY;
const ANDROID_APP_PACKAGE = "online.uygulamamcebimde.app";

type AppleOAuthPending = {
  ts: number;
};

function writeStorage(storage: Storage, record: AppleOAuthPending) {
  storage.setItem(PENDING_STORAGE_KEY, JSON.stringify(record));
}

function readStorage(storage: Storage): AppleOAuthPending | null {
  const raw = storage.getItem(PENDING_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppleOAuthPending;
    if (typeof parsed?.ts !== "number") return null;
    if (Date.now() - parsed.ts > 10 * 60 * 1000) {
      storage.removeItem(PENDING_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(PENDING_STORAGE_KEY);
    return null;
  }
}

export function persistAppleOAuthPending(record: AppleOAuthPending) {
  try {
    writeStorage(window.sessionStorage, record);
  } catch {
    /* private mode */
  }
  try {
    writeStorage(window.localStorage, record);
  } catch {
    /* storage blocked */
  }
}

export function readAppleOAuthPending(): AppleOAuthPending | null {
  try {
    const fromSession = readStorage(window.sessionStorage);
    if (fromSession) return fromSession;
  } catch {
    /* private mode */
  }
  try {
    return readStorage(window.localStorage);
  } catch {
    return null;
  }
}

export function clearAppleOAuthPending() {
  try {
    window.sessionStorage.removeItem(PENDING_STORAGE_KEY);
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    /* private mode */
  }
  try {
    window.localStorage.removeItem(PENDING_STORAGE_KEY);
    window.localStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    /* storage blocked */
  }
}

export function appleOAuthRedirectUri(): string {
  if (typeof window === "undefined") return `${PRODUCTION_OAUTH_ORIGIN}/auth`;
  const trimmed = window.location.origin.replace(/\/$/, "");
  try {
    const host = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    ).hostname.toLowerCase();
    if (host === "uygulamamcebimde.online" || host === "www.uygulamamcebimde.online") {
      return `${PRODUCTION_OAUTH_ORIGIN}/auth`;
    }
  } catch {
    /* aynı origin yedek */
  }
  return `${trimmed}/auth`;
}

export function isAppleOAuthCallbackParams(
  search = typeof window === "undefined" ? "" : window.location.search,
) {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const code = params.get("code") || "";
  const oauthError = params.get("error") || "";
  const pending = readAppleOAuthPending();
  if (oauthError && pending) return true;
  if (code && pending && !isGoogleOAuthCallbackParams(search)) return true;
  return false;
}

function shouldHandoffAppleOAuthToAndroidApp(): boolean {
  if (typeof window === "undefined") return false;
  if (nativeOAuthBridge()) return false;
  if (!isLikelyMobileDevice()) return false;
  return isAppleOAuthCallbackParams();
}

export function isOrphanedAndroidAppleOAuthBrowser(): boolean {
  return shouldHandoffAppleOAuthToAndroidApp();
}

function handoffAppleOAuthToAndroidApp() {
  const search = window.location.search || "";
  const intent =
    `intent://oauth${search}#Intent;scheme=silvancebimde;package=${ANDROID_APP_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(`${PRODUCTION_OAUTH_ORIGIN}/auth${search}`)};end`;
  window.location.assign(intent);
}

export function returnToAndroidApp() {
  if (typeof window === "undefined") return;
  handoffAppleOAuthToAndroidApp();
}

export async function startAppleOAuth(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Apple girişi yalnızca tarayıcıda çalışır." };
  }
  if (isInAppBrowser()) {
    return {
      ok: false,
      error:
        "Apple girişi WhatsApp / Instagram / Facebook içi tarayıcıda çalışmaz. Bağlantıyı Chrome veya Safari ile açın.",
    };
  }

  try {
    sessionStorage.setItem(
      RETURN_PATH_KEY,
      `${window.location.pathname}${window.location.search}`,
    );
  } catch {
    /* private mode */
  }

  persistAppleOAuthPending({ ts: Date.now() });

  const redirectTo = appleOAuthRedirectUri();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo,
      scopes: "name email",
    },
  });

  if (error) {
    clearAppleOAuthPending();
    return {
      ok: false,
      error: humanizeOAuthError(error.message || "Apple giriş başlatılamadı."),
    };
  }

  return { ok: true };
}

export async function completeAppleOAuthFromCallback(): Promise<
  { ok: true } | { ok: false; error: string } | { ok: null }
> {
  if (typeof window === "undefined") return { ok: null };
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error");
  const code = params.get("code");

  if (oauthError && isAppleOAuthCallbackParams()) {
    clearAppleOAuthPending();
    return { ok: false, error: humanizeOAuthError(params.get("error_description") || oauthError) };
  }
  if (!code) return { ok: null };
  if (!isAppleOAuthCallbackParams()) return { ok: null };

  if (shouldHandoffAppleOAuthToAndroidApp()) {
    handoffAppleOAuthToAndroidApp();
    return { ok: true };
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    clearAppleOAuthPending();
    if (error) {
      return { ok: false, error: humanizeOAuthError(error.message) };
    }
    return { ok: true };
  } catch (error) {
    clearAppleOAuthPending();
    return {
      ok: false,
      error: humanizeOAuthError(
        error instanceof Error ? error.message : "Apple girişi tamamlanamadı.",
      ),
    };
  }
}

export function stripAppleOAuthCallbackFromUrl() {
  stripOAuthCallbackFromUrl();
}

export function humanizeOAuthError(message: string): string {
  const text = (message || "").toLowerCase();
  if (text.includes("unsupported provider") || text.includes("missing oauth secret")) {
    return "Supabase Auth → Apple sağlayıcısı etkinleştirilmeli ve Apple Developer bilgileri eklenmeli.";
  }
  if (text.includes("invalid_request") || text.includes("state") || text.includes("csrf") || text.includes("durum")) {
    return "Apple yetkilendirmesi kesintiye uğradı. Lütfen tekrar deneyin.";
  }
  if (text.includes("popup")) {
    return "Açılır pencere engellendi. Apple girişini aynı sekmede yeniden deneyin.";
  }
  if (text.includes("cancelled") || text.includes("canceled") || text.includes("access_denied")) {
    return "Apple girişi iptal edildi.";
  }
  if (text.includes("no response")) {
    return "Apple kimlik doğrulama penceresi kapatıldı.";
  }
  return message || "Apple girişi başlatılamadı.";
}
