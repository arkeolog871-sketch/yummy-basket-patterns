/**
 * iOS uygulamasının bildirim token'ını native taraftan alır.
 *
 * Uygulamada bildirim altyapısının tamamı vardı — Firebase kuruluyor, izin
 * isteniyor, APNs kaydı yapılıyor, token üretiliyor — ama AppDelegate token'ı
 * `_ = fcmToken` ile çöpe atıyordu. Token sunucuya hiç ulaşmadığı için sunucu
 * iOS uygulamasına bildirim gönderemiyordu ve bu hiçbir yerde hata
 * vermiyordu: iOS'ta native bildirim sessizce hiç çalışmıyordu.
 *
 * Token'ı kaydetmek kullanıcının oturumunu gerektiriyor, o da burada. Bu
 * yüzden native taraf yalnızca token'ı veriyor, kaydı Android'le aynı kod
 * yapıyor (useFcmTokenBridge).
 *
 * Köprü yoksa (tarayıcı, Android, eklentiyi içermeyen eski build) sessizce
 * null döner — hiçbir akış bozulmaz.
 */

const PLUGIN_NAME = "SilvanPush";
const METHOD = "getFcmToken";

type CapacitorPluginHeader = { name: string; methods?: { name: string }[] };

type CapacitorGlobal = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  PluginHeaders?: CapacitorPluginHeader[];
  nativePromise?: <T>(pluginName: string, methodName: string, options?: unknown) => Promise<T>;
};

function capacitorGlobal(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/**
 * Eklentinin bu build'de gerçekten kayıtlı olduğunu `PluginHeaders` üzerinden
 * ölçer. Yalnızca platforma bakmak yetmez: mağazadaki eski sürümler
 * `SilvanPush`'u içermiyor ve orada çağrı hiç sonuçlanmadan asılı kalırdı.
 */
export function hasNativeIosPush(): boolean {
  const cap = capacitorGlobal();
  if (!cap?.isNativePlatform?.()) return false;
  if (cap.getPlatform?.() !== "ios") return false;
  const header = cap.PluginHeaders?.find((entry) => entry.name === PLUGIN_NAME);
  return Boolean(header?.methods?.some((entry) => entry.name === METHOD));
}

/**
 * Token ağdan gelebildiği için çağrı bekletilir; yanıt gelmezse giriş
 * akışının aksine bekleyen bir kullanıcı yok, o yüzden sessizce vazgeçilir.
 */
const TOKEN_TIMEOUT_MS = 30_000;

export async function getNativeIosFcmToken(): Promise<string | null> {
  const cap = capacitorGlobal();
  if (!hasNativeIosPush() || !cap?.nativePromise) return null;

  try {
    const result = await Promise.race([
      cap.nativePromise<{ token?: string }>(PLUGIN_NAME, METHOD, {}),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("token zaman aşımı")), TOKEN_TIMEOUT_MS);
      }),
    ]);
    return result?.token || null;
  } catch (error) {
    console.error("[ios-push] token alınamadı", error);
    return null;
  }
}
