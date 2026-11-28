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
const PERMISSION_METHOD = "requestNotificationPermission";

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

/**
 * "Soft-ask": Apple'ın sistem izin penceresini YALNIZCA burası açar — kullanıcı
 * bizim kendi açıklama ekranımızda "İzin ver"e bastığı an. Uygulama açılışında
 * artık otomatik istenmiyor (bkz. AppDelegate.swift): Apple bu izni cihaz
 * başına ömür boyu bir kez soruyor, bağlamsız/erken bir açılışta harcanırsa
 * kullanıcı düşünmeden reddedip bir daha asla sorulamaz hâle gelebiliyordu.
 */
export async function requestNativeIosNotificationPermission(): Promise<boolean> {
  const cap = capacitorGlobal();
  if (!hasNativeIosPush() || !cap?.nativePromise) return false;
  try {
    const result = await cap.nativePromise<{ granted?: boolean }>(
      PLUGIN_NAME,
      PERMISSION_METHOD,
      {},
    );
    return Boolean(result?.granted);
  } catch (error) {
    console.error("[ios-push] izin isteği başarısız", error);
    return false;
  }
}

/**
 * İzin verildikten hemen sonra token'ın hazır olması, Apple'ın APNs kaydını
 * tamamlamasına (gerçek bir ağ turu) bağlı — anlık değil. Tek deneme yerine
 * kısa aralıklarla birkaç kez denenir; kullanıcı "İzin ver"e bastığında ekranda
 * makul bir sürede (en fazla ~12sn) sonuç almasını sağlar. Bu süre içinde
 * başarısız olursa arka plandaki daha uzun soluklu deneme (useFcmTokenBridge,
 * 45sn'ye kadar) token'ı yine de yakalayıp sessizce kaydeder.
 */
export async function waitForNativeIosToken(maxWaitMs = 12_000): Promise<string | null> {
  const stepMs = 2_000;
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    const token = await getNativeIosFcmToken();
    if (token) return token;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}
