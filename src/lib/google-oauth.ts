import { supabase } from "@/integrations/supabase/client";
import { sealGoogleOAuthState, exchangeGoogleOAuthCode } from "@/lib/google-oauth.functions";
import { getPublicSupabaseEnv } from "@/lib/public-env";

const IN_APP_BROWSER =
  /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|MicroMessenger|Snapchat|TikTok|Pinterest|WhatsApp|Telegram|GSA\//i;

const PKCE_STORAGE_KEY = "silvan.google.oauth.pkce.v1";
const ANDROID_APP_PACKAGE = "online.uygulamamcebimde.app";
const GOOGLE_OAUTH_STATE_PREFIX = "sc1";

export const PRODUCTION_OAUTH_ORIGIN = "https://uygulamamcebimde.online";

type GoogleOAuthPkceRecord = {
  nonce: string;
  verifier: string;
  redirectUri: string;
  ts: number;
};

type SilvanNativeOAuth = {
  openOAuth?: (url: string) => void;
};

const handledCodes = new Set<string>();

function nativeOAuthBridge(): SilvanNativeOAuth | null {
  if (typeof window === "undefined") return null;
  const native = (window as Window & { SilvanNative?: SilvanNativeOAuth }).SilvanNative;
  return native && typeof native.openOAuth === "function" ? native : null;
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/SilvanCebimde/i.test(ua)) return false;
  return IN_APP_BROWSER.test(ua);
}

/**
 * Google Cloud Console'da kayıtlı üretim dönüş adresi apex `/auth`.
 * www ve apex aynı Web istemcisini paylaşır; www origin'inden başlatılsa bile
 * redirect_uri apex'e sabitlenir (www→apex 302 Google'ın redirect_uri eşlemesini bozar).
 * Önizleme / localhost aynı origin'deki `/auth` yolunu kullanır.
 */
export function googleOAuthRedirectUriForOrigin(origin: string): string {
  const trimmed = origin.replace(/\/$/, "");
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

export function googleOAuthRedirectUri(): string {
  if (typeof window === "undefined") return `${PRODUCTION_OAUTH_ORIGIN}/auth`;
  return googleOAuthRedirectUriForOrigin(window.location.origin);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

function writeStorage(storage: Storage, record: GoogleOAuthPkceRecord) {
  storage.setItem(PKCE_STORAGE_KEY, JSON.stringify(record));
}

function readStorage(storage: Storage): GoogleOAuthPkceRecord | null {
  const raw = storage.getItem(PKCE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GoogleOAuthPkceRecord;
    if (!parsed?.nonce || !parsed.verifier || !parsed.redirectUri) return null;
    if (Date.now() - parsed.ts > 10 * 60 * 1000) {
      storage.removeItem(PKCE_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(PKCE_STORAGE_KEY);
    return null;
  }
}

export function persistGoogleOAuthPkce(record: GoogleOAuthPkceRecord) {
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

export function readGoogleOAuthPkce(): GoogleOAuthPkceRecord | null {
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

export function clearGoogleOAuthPkce() {
  try {
    window.sessionStorage.removeItem(PKCE_STORAGE_KEY);
  } catch {
    /* private mode */
  }
  try {
    window.localStorage.removeItem(PKCE_STORAGE_KEY);
  } catch {
    /* storage blocked */
  }
}

export function isGoogleOAuthCallbackParams(
  search = typeof window === "undefined" ? "" : window.location.search,
) {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const state = params.get("state") || "";
  const code = params.get("code") || "";
  const oauthError = params.get("error") || "";
  const storedNonce = readGoogleOAuthPkce()?.nonce;
  if (oauthError && (state.startsWith(GOOGLE_OAUTH_STATE_PREFIX) || Boolean(storedNonce)))
    return true;
  return Boolean(code && (state.startsWith(GOOGLE_OAUTH_STATE_PREFIX) || storedNonce === state));
}

/**
 * Chrome'un "Masaüstü sitesi" (Request desktop site) ayarı bir alan adı için
 * kalıcı olarak açık kalabilir; bu durumda gerçek bir Android telefonda bile
 * navigator.userAgent masaüstü Linux/X11 gibi görünür. Dokunmatik ekran
 * desteği bu geçişten etkilenmeyen donanımsal bir sinyal olduğu için yedek
 * olarak kullanılır.
 */
function isLikelyMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/Android/i.test(navigator.userAgent)) return true;
  return typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0;
}

function shouldHandoffGoogleOAuthToAndroidApp(): boolean {
  if (typeof window === "undefined") return false;
  if (nativeOAuthBridge()) return false;
  if (!isLikelyMobileDevice()) return false;
  return isGoogleOAuthCallbackParams();
}

/**
 * True when this tab is an orphaned Android browser tab left behind after
 * Google's consent screen — the automatic `intent://` handoff below is not
 * guaranteed to fire without a user gesture on every Chrome/OEM build, so
 * the UI shows a manual "Uygulamaya dön" button whenever this is true.
 */
export function isOrphanedAndroidOAuthBrowser(): boolean {
  return shouldHandoffGoogleOAuthToAndroidApp();
}

function handoffGoogleOAuthToAndroidApp() {
  const search = window.location.search || "";
  const intent =
    `intent://oauth${search}#Intent;scheme=silvancebimde;package=${ANDROID_APP_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(`${PRODUCTION_OAUTH_ORIGIN}/auth${search}`)};end`;
  window.location.assign(intent);
}

/** "Uygulamaya dön" butonu: kullanıcı dokunuşuyla intent:// yönlendirmesini tekrar dener. */
export function returnToAndroidApp() {
  if (typeof window === "undefined") return;
  handoffGoogleOAuthToAndroidApp();
}

export async function startGoogleOAuth(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Google girişi yalnızca tarayıcıda çalışır." };
  }
  if (isInAppBrowser()) {
    return {
      ok: false,
      error:
        "Google girişi WhatsApp / Instagram / Facebook içi tarayıcıda çalışmaz. Bağlantıyı Chrome veya Safari ile açın.",
    };
  }

  const clientId = getPublicSupabaseEnv().VITE_GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) {
    return {
      ok: false,
      error:
        "Google girişi henüz yapılandırılmadı. Google Cloud Console’da Web istemcisi oluşturup dönüş adresini https://uygulamamcebimde.online/auth yapın.",
    };
  }

  try {
    sessionStorage.setItem(
      "silvan-oauth-return",
      `${window.location.pathname}${window.location.search}`,
    );
  } catch {
    /* private mode */
  }

  const redirectUri = googleOAuthRedirectUri();
  const { verifier, challenge } = await createPkcePair();
  const nonce = crypto.randomUUID();
  persistGoogleOAuthPkce({ nonce, verifier, redirectUri, ts: Date.now() });

  let sealed: Awaited<ReturnType<typeof sealGoogleOAuthState>>;
  try {
    sealed = await sealGoogleOAuthState({ data: { nonce, verifier, redirectUri } });
  } catch (error) {
    clearGoogleOAuthPkce();
    return {
      ok: false,
      error: humanizeOAuthError(
        error instanceof Error ? error.message : "Google OAuth durum anahtarı yapılandırılmadı.",
      ),
    };
  }
  if (!sealed.ok) {
    clearGoogleOAuthPkce();
    return { ok: false, error: humanizeOAuthError(sealed.error) };
  }
  const state = sealed.state;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("include_granted_scopes", "true");

  const href = url.toString();
  const native = nativeOAuthBridge();
  if (native?.openOAuth) {
    native.openOAuth(href);
    return { ok: true };
  }
  window.location.assign(href);
  return { ok: true };
}

const OAUTH_DEBUG_STORAGE_KEY = "silvan.google.oauth.debug.v1";

/** Geçici tanı kaydı: hangi bağlamda (WebView/Custom Tab/Chrome) tamamlandığını görmek için. */
function recordOAuthDebugSnapshot(extra: Record<string, unknown>) {
  try {
    const snapshot = {
      ts: Date.now(),
      hasBridge: Boolean(nativeOAuthBridge()),
      isAndroidUa: /Android/i.test(navigator.userAgent),
      maxTouchPoints: navigator.maxTouchPoints,
      isLikelyMobile: isLikelyMobileDevice(),
      ua: navigator.userAgent,
      ...extra,
    };
    window.sessionStorage.setItem(OAUTH_DEBUG_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode veya storage kapalı */
  }
}

export function readAndClearOAuthDebugSnapshot(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(OAUTH_DEBUG_STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(OAUTH_DEBUG_STORAGE_KEY);
    const parsed = JSON.parse(raw) as { ts?: number };
    if (!parsed?.ts || Date.now() - parsed.ts > 5 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function completeGoogleOAuthFromCallback(): Promise<
  { ok: true } | { ok: false; error: string } | { ok: null }
> {
  if (typeof window === "undefined") return { ok: null };
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error");
  const code = params.get("code");
  const state = params.get("state");
  recordOAuthDebugSnapshot({ code: Boolean(code), state: Boolean(state) });

  if (oauthError && (state || readGoogleOAuthPkce())) {
    clearGoogleOAuthPkce();
    return { ok: false, error: humanizeOAuthError(params.get("error_description") || oauthError) };
  }
  if (!code || !state) return { ok: null };
  if (!isGoogleOAuthCallbackParams()) return { ok: null };
  if (handledCodes.has(code)) return { ok: true };

  if (shouldHandoffGoogleOAuthToAndroidApp()) {
    recordOAuthDebugSnapshot({ code: true, state: true, branch: "handoff-to-app" });
    handoffGoogleOAuthToAndroidApp();
    return { ok: true };
  }
  recordOAuthDebugSnapshot({ code: true, state: true, branch: "exchange-here" });

  handledCodes.add(code);
  const stored = readGoogleOAuthPkce();
  try {
    const exchanged = await exchangeGoogleOAuthCode({
      data: {
        code,
        state,
        storedNonce: stored?.nonce,
        storedVerifier: stored?.verifier,
        storedRedirectUri: stored?.redirectUri,
      },
    });
    if (!exchanged.ok) {
      handledCodes.delete(code);
      return { ok: false, error: humanizeOAuthError(exchanged.error) };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: exchanged.idToken,
      ...(exchanged.accessToken ? { access_token: exchanged.accessToken } : {}),
    });
    clearGoogleOAuthPkce();
    if (error) {
      handledCodes.delete(code);
      return { ok: false, error: humanizeOAuthError(error.message) };
    }
    return { ok: true };
  } catch (error) {
    handledCodes.delete(code);
    return {
      ok: false,
      error: humanizeOAuthError(
        error instanceof Error ? error.message : "Google girişi tamamlanamadı.",
      ),
    };
  }
}

export function stripOAuthCallbackFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  ["code", "state", "error", "error_description", "scope", "authuser", "prompt", "hd"].forEach(
    (key) => {
      url.searchParams.delete(key);
    },
  );
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, document.title, next || "/auth");
}

export function humanizeOAuthError(message: string): string {
  const text = (message || "").toLowerCase();
  if (text.includes("unsupported provider") || text.includes("missing oauth secret")) {
    return "Supabase Auth → Google sağlayıcısına aynı Web istemci kimliği ve gizli anahtar eklenmeli.";
  }
  if (
    text.includes("invalid_request") ||
    text.includes("state") ||
    text.includes("csrf") ||
    text.includes("durum")
  ) {
    return "Google yetkilendirmesi tarayıcı çerezi yüzünden kesilmesin diye artık kendi alan adımızda PKCE kullanılıyor. Chrome veya Safari’de tekrar deneyin.";
  }
  if (text.includes("popup")) {
    return "Açılır pencere engellendi. Google girişini aynı sekmede yeniden deneyin.";
  }
  if (text.includes("cancelled") || text.includes("canceled") || text.includes("access_denied")) {
    return "Google girişi iptal edildi.";
  }
  return message || "Google girişi başlatılamadı.";
}
