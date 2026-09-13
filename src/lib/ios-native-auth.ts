import { supabase } from "@/integrations/supabase/client";

/**
 * iOS'ta Google ve Apple girişinin uygulama içinde tamamlanan yarısı.
 *
 * Apple, sürümü Guideline 4 kapsamında reddetti: her iki düğme de kullanıcıyı
 * varsayılan tarayıcıya çıkarıyordu (Capacitor, kendi origin'i dışına giden
 * tam sayfa yönlendirmeyi Safari'ye devrediyor). Native taraf artık
 * `SilvanAuthPlugin` ile kimliği uygulama içinde alıyor; burada yalnızca gelen
 * ID token Supabase oturumuna çevriliyor.
 *
 * Köprü yoksa (tarayıcı, Android, eklentiyi içermeyen eski TestFlight build'i)
 * `hasNativeIosAuth()` false döner ve çağıran taraf mevcut tarayıcı akışını
 * kullanmaya devam eder — native yol hiçbir koşulda tek seçenek değildir.
 */

const PLUGIN_NAME = "SilvanAuth";

type CapacitorPluginHeader = { name: string; methods?: { name: string }[] };

type CapacitorGlobal = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  PluginHeaders?: CapacitorPluginHeader[];
};

type NativeAuthResponse = {
  cancelled?: boolean;
  idToken?: string;
  nonce?: string;
  fullName?: string;
};

type SilvanAuthPlugin = {
  signInWithGoogle: () => Promise<NativeAuthResponse>;
  signInWithApple: () => Promise<NativeAuthResponse>;
};

/**
 * `ok: null` = kullanıcı vazgeçti; çağıran taraf ne hata gösterir ne de
 * tarayıcı akışına düşer (aksi hâlde "vazgeç"e basmak Safari'yi açardı).
 */
export type NativeIosAuthResult = { ok: true } | { ok: false; error: string } | { ok: null };

function capacitorGlobal(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/**
 * Eklentinin bu build'de gerçekten kayıtlı olup olmadığını `PluginHeaders`
 * üzerinden ölçer. Yalnızca platforma bakmak yetmez: mağazadaki eski sürümler
 * `SilvanAuth`'u içermiyor ve orada native çağrı "Unimplemented" ile ölürdü.
 */
export function hasNativeIosAuth(method: "signInWithGoogle" | "signInWithApple"): boolean {
  const cap = capacitorGlobal();
  if (!cap?.isNativePlatform?.()) return false;
  if (cap.getPlatform?.() !== "ios") return false;
  const header = cap.PluginHeaders?.find((entry) => entry.name === PLUGIN_NAME);
  return Boolean(header?.methods?.some((entry) => entry.name === method));
}

async function loadPlugin(): Promise<SilvanAuthPlugin> {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<SilvanAuthPlugin>(PLUGIN_NAME);
}

let cached: Promise<SilvanAuthPlugin> | null = null;

/** registerPlugin aynı ad için iki kez çağrılırsa konsola uyarı basıyor. */
function plugin(): Promise<SilvanAuthPlugin> {
  cached ??= loadPlugin();
  return cached;
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export async function signInWithNativeIosGoogle(): Promise<NativeIosAuthResult> {
  const { humanizeOAuthError } = await import("@/lib/google-oauth");
  try {
    const result = await (await plugin()).signInWithGoogle();
    if (result?.cancelled) return { ok: null };
    const token = result?.idToken;
    if (!token) return { ok: false, error: "Google kimlik bilgisi alınamadı." };

    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token });
    if (error) return { ok: false, error: humanizeOAuthError(error.message) };

    const { fillFullNameFromProvider } = await import("@/lib/social-profile");
    await fillFullNameFromProvider();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: humanizeOAuthError(errorText(error, "Google girişi tamamlanamadı.")),
    };
  }
}

export async function signInWithNativeIosApple(): Promise<NativeIosAuthResult> {
  const { humanizeOAuthError } = await import("@/lib/apple-oauth");
  try {
    const result = await (await plugin()).signInWithApple();
    if (result?.cancelled) return { ok: null };
    const token = result?.idToken;
    // Supabase, Apple'a gönderilen SHA-256'nın değil ham nonce'un kendisini
    // ister; ikisi karışırsa doğrulama "invalid nonce" ile reddedilir.
    const nonce = result?.nonce;
    if (!token || !nonce) return { ok: false, error: "Apple kimlik bilgisi alınamadı." };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token,
      nonce,
    });
    if (error) return { ok: false, error: humanizeOAuthError(error.message) };

    // Apple ad soyadı yalnızca ilk girişte, ID token'ın dışında gönderir; bu
    // tek fırsat kaçarsa profil adı kalıcı olarak boş kalır.
    const { fillFullNameFromProvider } = await import("@/lib/social-profile");
    await fillFullNameFromProvider(result?.fullName);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: humanizeOAuthError(errorText(error, "Apple girişi tamamlanamadı.")),
    };
  }
}
