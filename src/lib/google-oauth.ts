import { supabase } from "@/integrations/supabase/client";
import {
  sealGoogleOAuthState,
  exchangeGoogleOAuthCode,
  parkGoogleOAuthCode,
  claimGoogleOAuthCode,
} from "@/lib/google-oauth.functions";
import { getPublicSupabaseEnv } from "@/lib/public-env";

const IN_APP_BROWSER =
  /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|MicroMessenger|Snapchat|TikTok|Pinterest|WhatsApp|Telegram|GSA\//i;

const PKCE_STORAGE_KEY = "silvan.google.oauth.pkce.v1";
/**
 * Custom Tab'da hesap seçimi + şifre + 2FA gerçek kullanımda 10 dakikayı
 * kolayca aşabiliyor; aşılınca "saklanan oturum bulunamadı" hatasıyla akış
 * baştan başlatılmak zorunda kalıyordu. Google'ın kendi yetkilendirme kodu
 * zaten çok daha kısa sürede geçersiz olduğu için bu sınırı gevşetmek ek
 * risk oluşturmuyor; sunucudaki eşleniği (GOOGLE_OAUTH_STATE_TTL_MS) ile
 * aynı tutulmalı.
 */
const GOOGLE_OAUTH_PKCE_TTL_MS = 30 * 60 * 1000;
const ANDROID_APP_PACKAGE = "online.uygulamamcebimde.app";
const GOOGLE_OAUTH_STATE_PREFIX = "sc1";
export const GOOGLE_OAUTH_RETURN_PATH_KEY = "silvan-oauth-return";

export const PRODUCTION_OAUTH_ORIGIN = "https://uygulamamcebimde.online";

type GoogleOAuthPkceRecord = {
  nonce: string;
  verifier: string;
  redirectUri: string;
  ts: number;
  /** Mühürlü state; uygulama tarayıcıda bırakılan kodu bununla geri alır. */
  state?: string;
};

type SilvanNativeOAuth = {
  openOAuth?: (url: string) => void;
  supportsNativeGoogleSignIn?: () => boolean;
  signInWithGoogleNative?: () => void;
  reportsNativeGoogleSignInErrors?: () => boolean;
};

const handledCodes = new Set<string>();

export function nativeOAuthBridge(): SilvanNativeOAuth | null {
  if (typeof window === "undefined") return null;
  const native = (window as Window & { SilvanNative?: SilvanNativeOAuth }).SilvanNative;
  return native && typeof native.openOAuth === "function" ? native : null;
}

/**
 * Android uygulaması Chrome Custom Tab'a hiç çıkmadan, Google'ın native hesap
 * seçme ekranıyla giriş yapabiliyor mu? (bkz. MainActivity#startNativeGoogleSignIn)
 * Tarayıcı tabanlı akışın "otomatik uygulamaya dönme" sorununu tamamen ortadan
 * kaldırır — eski build'lerde bu köprü yok, o zaman normal tarayıcı akışına düşülür.
 */
export function hasNativeGoogleSignIn(): boolean {
  const native = nativeOAuthBridge();
  return Boolean(native?.supportsNativeGoogleSignIn?.());
}

/**
 * Native köprü, gerçek hatayı kullanıcının vazgeçmesinden ayırt edebiliyor mu?
 * 2.9 ve öncesi Android build'leri ikisini de boş ID token olarak bildiriyordu,
 * bu yüzden orada boş token bir çıkmazı gizliyor olabilir. False dönerse çağıran
 * taraf kullanıcıya tarayıcı ile devam etme seçeneğini elle sunmalı.
 */
export function nativeGoogleSignInReportsErrors(): boolean {
  const native = nativeOAuthBridge();
  return Boolean(native?.reportsNativeGoogleSignInErrors?.());
}

export function startNativeGoogleSignIn(): boolean {
  const native = nativeOAuthBridge();
  if (!native?.signInWithGoogleNative) return false;
  native.signInWithGoogleNative();
  return true;
}

/** MainActivity, native hesap seçiminden aldığı ID token'ı buraya iletir. */
export async function completeNativeGoogleSignIn(
  idToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    if (error) return { ok: false, error: humanizeOAuthError(error.message) };
    const { fillFullNameFromProvider } = await import("@/lib/social-profile");
    await fillFullNameFromProvider();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: humanizeOAuthError(error instanceof Error ? error.message : "Google girişi tamamlanamadı."),
    };
  }
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
    if (Date.now() - parsed.ts > GOOGLE_OAUTH_PKCE_TTL_MS) {
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
export function isLikelyMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/Android/i.test(navigator.userAgent)) return true;
  return typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0;
}

/**
 * intent:// devretme yalnızca Android'de anlamlıdır. iPhone/iPad dokunmatik
 * olduğu için `isLikelyMobileDevice()` true döndürür; bu yüzden aktarım kararı
 * ayrı bir Android tespitine bağlanır (iOS asla bu dala girmez).
 */
export function isAndroidDevice(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  if (!ua) return false;
  if (/iPhone|iPad|iPod/i.test(ua)) return false;
  return /Android/i.test(ua);
}

/**
 * Saf karar fonksiyonu (test edilebilir): Google callback'i Android
 * uygulamasına devretmeli miyiz?
 *
 * Devretme yalnızca şu durumda yapılır: gerçek bir Android tarayıcı sekmesi,
 * yerleşik native köprü yok ve bu tarayıcıda başlatılmış bir PKCE kaydı yok
 * (yani akış uygulamada başlamış, tarayıcıda yetim kalmış).
 *
 * ÖNEMLİ: Saklanan `nonce` ham değerdir, URL'deki `state` ise sunucuda
 * mühürlenmiş `sc1...` değeridir; bu ikisi asla birebir eşleşmez. Bu yüzden
 * "bu tarayıcıda başladı mı" kararı kaydın varlığına bakar; nonce/state
 * doğrulaması sunucudaki kod takasında yapılır.
 */
export function decideGoogleOAuthHandoff(input: {
  userAgent: string;
  hasNativeBridge: boolean;
  hasStoredPkce: boolean;
  isCallback: boolean;
}): boolean {
  if (!input.isCallback) return false;
  if (input.hasNativeBridge) return false;
  if (!isAndroidDevice(input.userAgent)) return false;
  return !input.hasStoredPkce;
}

function shouldHandoffGoogleOAuthToAndroidApp(): boolean {
  if (typeof window === "undefined") return false;
  return decideGoogleOAuthHandoff({
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    hasNativeBridge: Boolean(nativeOAuthBridge()),
    hasStoredPkce: Boolean(readGoogleOAuthPkce()?.nonce),
    isCallback: isGoogleOAuthCallbackParams(),
  });
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
      GOOGLE_OAUTH_RETURN_PATH_KEY,
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
  // State'i de sakla: giriş tarayıcı sekmesinde onaylanırsa uygulama bekleyen
  // kodu bu state ile geri alıp girişi kendi içinde tamamlar.
  persistGoogleOAuthPkce({ nonce, verifier, redirectUri, ts: Date.now(), state });

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

export async function completeGoogleOAuthFromCallback(): Promise<
  { ok: true } | { ok: false; error: string } | { ok: null }
> {
  if (typeof window === "undefined") return { ok: null };
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error");
  const code = params.get("code");
  const state = params.get("state");

  if (oauthError && (state || readGoogleOAuthPkce())) {
    clearGoogleOAuthPkce();
    return { ok: false, error: humanizeOAuthError(params.get("error_description") || oauthError) };
  }
  if (!code || !state) return { ok: null };
  if (!isGoogleOAuthCallbackParams()) return { ok: null };
  if (handledCodes.has(code)) return { ok: true };

  const stored = readGoogleOAuthPkce();

  // Bu sekme akışı başlatmadıysa (uygulamadan açılan tarayıcı sekmesi): önce
  // otomatik intent:// devretmeyi SENKRON olarak dene. Bu navigasyon zaman
  // duyarlı — bazı Chrome/OEM sürümleri, sayfa yüklendikten sonra araya bir
  // await (ör. parkGoogleOAuthCode'un ağ isteği) girince script kaynaklı
  // intent:// yönlendirmesini kullanıcı dokunuşu olmadığı gerekçesiyle
  // sessizce engelliyor. Bu yüzden devretme her şeyden önce, senkron olarak
  // denenir; sunucuda bırakma (park) ise devretme başarısız olursa
  // GoogleOAuthRelayBridge'in yakalayabilmesi için arka planda, beklenmeden
  // yapılır.
  if (!stored?.nonce) {
    if (shouldHandoffGoogleOAuthToAndroidApp()) {
      handoffGoogleOAuthToAndroidApp();
      void parkGoogleOAuthCode({ data: { code, state } }).catch(() => {});
      return { ok: true };
    }
    let parked = false;
    try {
      const result = await parkGoogleOAuthCode({ data: { code, state } });
      parked = result.ok === true;
    } catch {
      parked = false;
    }
    if (parked) return { ok: true };
    return {
      ok: false,
      error: humanizeOAuthError("Durum doğrulama başarısız oldu (saklanan oturum bulunamadı)."),
    };
  }

  handledCodes.add(code);
  return finishGoogleOAuthWithCode(code, state, stored);
}

async function finishGoogleOAuthWithCode(
  code: string,
  state: string,
  stored: GoogleOAuthPkceRecord,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const exchanged = await exchangeGoogleOAuthCode({
      data: {
        code,
        state,
        storedNonce: stored.nonce,
        storedVerifier: stored.verifier,
        storedRedirectUri: stored.redirectUri,
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
    // Google'dan gelen isim profildeki ad soyad boşsa otomatik yazılır.
    const { fillFullNameFromProvider } = await import("@/lib/social-profile");
    await fillFullNameFromProvider();
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

/** Uygulamada bekleyen bir Google girişi var mı? (tarayıcıda onay bekleniyor) */
export function hasPendingGoogleOAuth(): boolean {
  if (typeof window === "undefined") return false;
  if (isGoogleOAuthCallbackParams()) return false;
  return Boolean(readGoogleOAuthPkce()?.state);
}

/**
 * Uygulama tarafı: tarayıcıda onaylanmış girişi sunucudan geri alıp burada
 * tamamlar. Kullanıcının tarayıcı sayfasında beklemesine gerek kalmaz.
 */
export async function claimGoogleOAuthFromApp(): Promise<
  { ok: true } | { ok: false; error: string } | { ok: null }
> {
  if (typeof window === "undefined") return { ok: null };
  const stored = readGoogleOAuthPkce();
  if (!stored?.state || !stored.nonce) return { ok: null };
  let claimed: Awaited<ReturnType<typeof claimGoogleOAuthCode>>;
  try {
    claimed = await claimGoogleOAuthCode({
      data: { state: stored.state, storedNonce: stored.nonce },
    });
  } catch {
    return { ok: null };
  }
  if (!claimed.ok) {
    clearGoogleOAuthPkce();
    return { ok: false, error: humanizeOAuthError(claimed.error) };
  }
  if (!claimed.code) return { ok: null };
  if (handledCodes.has(claimed.code)) return { ok: null };
  handledCodes.add(claimed.code);
  return finishGoogleOAuthWithCode(claimed.code, stored.state, stored);
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
