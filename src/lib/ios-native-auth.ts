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
  /** Native köprünün doğrudan çağrı kanalı; native-bridge.js enjekte eder. */
  nativePromise?: <T>(pluginName: string, methodName: string, options?: unknown) => Promise<T>;
};

type NativeAuthResponse = {
  cancelled?: boolean;
  idToken?: string;
  nonce?: string;
  fullName?: string;
};

/**
 * `ok: null` = kullanıcı vazgeçti; çağıran taraf ne hata gösterir ne de
 * tarayıcı akışına düşer (aksi hâlde "vazgeç"e basmak Safari'yi açardı).
 */
export type NativeIosAuthResult = { ok: true } | { ok: false; error: string } | { ok: null };

/** Akışın hangi adımda olduğunu ekrana yazdırmak için; tanı dışında etkisi yok. */
export type NativeAuthStep = (step: string) => void;

function capacitorGlobal(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/**
 * Eklentinin bu build'de gerçekten kayıtlı olup olmadığını `PluginHeaders`
 * üzerinden ölçer. Yalnızca platforma bakmak yetmez: mağazadaki eski sürümler
 * `SilvanAuth`'u içermiyor ve orada native çağrı "Unimplemented" ile ölürdü.
 */
type PluginMethod = "signInWithGoogle" | "signInWithApple";

export function hasNativeIosAuth(method: PluginMethod): boolean {
  const cap = capacitorGlobal();
  if (!cap?.isNativePlatform?.()) return false;
  if (cap.getPlatform?.() !== "ios") return false;
  const header = cap.PluginHeaders?.find((entry) => entry.name === PLUGIN_NAME);
  return Boolean(header?.methods?.some((entry) => entry.name === method));
}

/**
 * Native metodu köprünün kendi kanalıyla çağırır.
 *
 * Burada bilerek `@capacitor/core`'un registerPlugin'i kullanılmıyor: onu
 * getirmek için gereken dinamik import, WKWebView içinde ne çözülen ne
 * reddedilen bir sözde asılı kalıyordu ve giriş Swift'e hiç ulaşmadan
 * ölüyordu. registerPlugin'in native eklenti için yaptığı şey zaten bu
 * çağrının aynısı; köprü nesnesi de sayfa açılışında enjekte edildiği için
 * ağdan ek bir şey beklemeye gerek yok.
 */
function callNative(method: PluginMethod): Promise<NativeAuthResponse> {
  const cap = capacitorGlobal();
  if (!cap?.nativePromise) {
    return Promise.reject(new Error(`Köprü çağrı kanalı yok. ${nativeIosAuthDiagnostics()}`));
  }
  return cap.nativePromise<NativeAuthResponse>(PLUGIN_NAME, method, {});
}

/**
 * Köprünün o anki hâlini tek satırda özetler. Hata mesajına ekleniyor çünkü
 * cihaza bağlanmadan native tarafı görmenin başka yolu yok.
 */
export function nativeIosAuthDiagnostics(): string {
  const cap = capacitorGlobal();
  if (!cap) return "Capacitor köprüsü yok";
  const header = cap.PluginHeaders?.find((entry) => entry.name === PLUGIN_NAME);
  const names = cap.PluginHeaders?.map((entry) => entry.name).join(", ") || "yok";
  return [
    `platform=${cap.getPlatform?.() ?? "?"}`,
    `native=${cap.isNativePlatform?.() ?? "?"}`,
    `${PLUGIN_NAME}=${header ? (header.methods?.map((m) => m.name).join("+") ?? "metotsuz") : "KAYITLI DEĞİL"}`,
    `eklentiler=[${names}]`,
  ].join(" · ");
}

/**
 * Capacitor, çağrıyı gönderemediğinde (eklenti bulunamadı, metot yok, seçici
 * eşleşmedi) yalnızca konsola yazıp `return` ediyor — söz ne çözülüyor ne
 * reddediliyor. O yüzden ekranda hiçbir şey olmuyor ve sebep görünmüyor.
 * Bekçi, gelmeyen yanıtı görünür bir hataya çevirir; asıl söz iptal edilmez,
 * geç de olsa gelirse giriş normal şekilde tamamlanır.
 */
const NATIVE_CALL_TIMEOUT_MS = 12_000;

function withWatchdog<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label}: native taraf yanıt vermedi. ${nativeIosAuthDiagnostics()}`));
      }, NATIVE_CALL_TIMEOUT_MS);
    }),
  ]);
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export async function signInWithNativeIosGoogle(
  onStep: NativeAuthStep = () => {},
): Promise<NativeIosAuthResult> {
  try {
    onStep("başladı");
    const { humanizeOAuthError } = await import("@/lib/google-oauth");
    const result = await withWatchdog(
      (() => {
        onStep("native çağrı gönderiliyor");
        return callNative("signInWithGoogle");
      })(),
      "Google",
    );
    onStep(`native yanıt: ${JSON.stringify(result)?.slice(0, 120)}`);
    if (result?.cancelled) return { ok: null };
    const token = result?.idToken;
    if (!token) return { ok: false, error: "Google kimlik bilgisi alınamadı." };

    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token });
    if (error) return { ok: false, error: humanizeOAuthError(error.message) };

    const { fillFullNameFromProvider } = await import("@/lib/social-profile");
    await fillFullNameFromProvider();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorText(error, "Google girişi tamamlanamadı.") };
  }
}

export async function signInWithNativeIosApple(
  onStep: NativeAuthStep = () => {},
): Promise<NativeIosAuthResult> {
  try {
    onStep("başladı");
    const { humanizeOAuthError } = await import("@/lib/apple-oauth");
    const result = await withWatchdog(
      (() => {
        onStep("native çağrı gönderiliyor");
        return callNative("signInWithApple");
      })(),
      "Apple",
    );
    onStep(`native yanıt: ${JSON.stringify(result)?.slice(0, 120)}`);
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
    return { ok: false, error: errorText(error, "Apple girişi tamamlanamadı.") };
  }
}
