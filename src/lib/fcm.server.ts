import { SignJWT, importPKCS8 } from "jose";

/**
 * Android native uygulama (android-wrapper) WebView içinde Web Push API'yi
 * desteklemiyor; bu yüzden FCM (Firebase Cloud Messaging) HTTP v1 API'sini
 * doğrudan fetch ile kullanıyoruz — firebase-admin SDK Cloudflare Workers'ta
 * çalışmıyor (Node-özel API'lere bağımlı), bu yüzden servis hesabı JWT'sini
 * jose (Web Crypto tabanlı, edge-uyumlu) ile kendimiz imzalıyoruz.
 */

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let cachedServiceAccount: ServiceAccount | null | undefined;
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function readServiceAccount(): ServiceAccount | null {
  if (cachedServiceAccount !== undefined) return cachedServiceAccount;
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!raw) {
    cachedServiceAccount = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      console.error("[fcm] FIREBASE_SERVICE_ACCOUNT_JSON eksik alanlar içeriyor");
      cachedServiceAccount = null;
      return null;
    }
    cachedServiceAccount = {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
    return cachedServiceAccount;
  } catch {
    console.error("[fcm] FIREBASE_SERVICE_ACCOUNT_JSON geçerli JSON değil");
    cachedServiceAccount = null;
    return null;
  }
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const privateKey = await importPKCS8(account.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!response.ok) {
    throw new Error(`FCM OAuth token değişimi başarısız: ${response.status}`);
  }
  const json = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

export type FcmSendResult = "sent" | "invalid_token" | "error" | "unconfigured";

/**
 * FCM'in hata gövdesinden yalnızca makine tarafından okunabilir kodu ayıklar.
 * Gövdenin tamamı günlüğe yazılmıyor: içinde jeton ve bildirim metni geçebilir.
 */
function fcmErrorCode(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as {
      error?: { status?: string; details?: { errorCode?: string }[] };
    };
    return (
      parsed.error?.details?.find((detail) => detail.errorCode)?.errorCode ?? parsed.error?.status
    );
  } catch {
    return undefined;
  }
}

/**
 * Uygulamanın açılışta oluşturduğu yüksek önemli bildirim kanalı
 * (MainActivity.ORDER_CHANNEL_ID ve PushService.CHANNEL_ID ile aynı olmak
 * zorunda). Mesajda bu belirtilmezse uygulama arka plandayken bildirimi
 * Firebase'in kendi kodu gösteriyor ve kanalı bilmediği için sistemin
 * varsayılan "Diğer" kanalına düşürüyor — o kanal normal önem seviyesinde,
 * yani ekranın üstünde belirmiyor ve titremiyor. Kanalın yüksek önemi tam da
 * en çok gerektiği anda, uygulama kapalıyken, devre dışı kalıyordu.
 */
const ANDROID_CHANNEL_ID = "orders";

/**
 * Teslim edilemeyen mesaj bu süre sonunda düşer. Varsayılan 4 hafta: cihaz
 * (zorla durdurma, pil kısıtlaması, kapalı internet) mesajı alamadığında
 * Google onu haftalarca saklıyor ve bağlantı kurulduğu an hepsini birden
 * boşaltıyor — 1-2 Eylül'deki sekiz test bildiriminin 14 Eylül'de tek
 * seferde düşmesinin sebebi buydu. Bir günü geçmiş bildirim zaten
 * kullanıcıya bir şey ifade etmiyor; geç gelmektense hiç gelmesin.
 */
const TTL_SECONDS = 86_400;
const ANDROID_TTL = `${TTL_SECONDS}s`;

/**
 * Tüm kurulumların abone olduğu yayın konusu.
 *
 * Konu yayını, "herkese duyuru"nun tek doğru yolu: cihaz açılışta bir kez
 * abone oluyor ve sunucu tek mesajı konuya gönderiyor. Cihaz listesi
 * tutmaya, dolayısıyla kullanıcının giriş yapmış olmasına gerek kalmıyor --
 * uygulamayı kurup hiç giriş yapmamış bir telefon da duyuruyu alıyor.
 *
 * Kişiye özel bildirimler (sipariş durumu) bunun dışında: onlar doğal olarak
 * belirli bir kullanıcıyı hedeflediği için token ile gönderiliyor.
 *
 * Android ve iOS tarafında aynı ad kullanılıyor; değişirse üçü birden
 * değişmeli, yoksa yayın kimseye ulaşmaz.
 */
export const FCM_BROADCAST_TOPIC = "tum-cihazlar";

/** Tek bir FCM token'ına bildirim gönderir. VAPID'siz ortamda olduğu gibi,
 * servis hesabı tanımlı değilse sessizce "unconfigured" döner. */
export async function sendFcmMessage(
  token: string,
  payload: { title: string; body: string; url?: string },
): Promise<FcmSendResult> {
  return sendFcm({ token }, payload);
}

/**
 * Yayın konusuna gönderir: konuya abone olan her cihaza ulaşır. Tek istek,
 * kaç cihaz olursa olsun -- token listesiyle tek tek göndermenin aksine
 * eşzamanlı ve cihaz sayısından bağımsız.
 */
export async function sendFcmTopicMessage(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<FcmSendResult> {
  return sendFcm({ topic: FCM_BROADCAST_TOPIC }, payload);
}

async function sendFcm(
  target: { token: string } | { topic: string },
  payload: { title: string; body: string; url?: string },
): Promise<FcmSendResult> {
  const account = readServiceAccount();
  if (!account) return "unconfigured";

  try {
    const accessToken = await getAccessToken(account);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            ...target,
            notification: { title: payload.title, body: payload.body },
            ...(payload.url ? { data: { url: payload.url } } : {}),
            apns: {
              headers: {
                // 10 = "hemen teslim et". Varsayılan 5 ve "uygun bir zamanda"
                // demek; sistem onu pil durumuna göre geciktirebiliyor.
                "apns-priority": "10",
                // Android'deki ttl'in iOS karşılığı. Burada süre değil mutlak
                // zaman damgası isteniyor, o yüzden her gönderimde hesaplanır.
                "apns-expiration": String(Math.floor(Date.now() / 1000) + TTL_SECONDS),
              },
              payload: {
                // Başlık ve gövde üstteki `notification` alanından geliyor;
                // burada yalnızca sesi açıkça istiyoruz.
                // Odak/Rahatsız Etmeyin modunu delen "interruption-level":
                // "time-sensitive" bilerek eklenmedi — Apple Developer
                // portalında "Time Sensitive Notifications" yetkisi
                // açılmadan hiçbir etkisi yok (Sign In with Apple'da olduğu
                // gibi ayrı bir capability).
                aps: { sound: "default" },
              },
            },
            android: {
              // "high": Doze/uyku modunu delip anında teslim edilir.
              priority: "high",
              ttl: ANDROID_TTL,
              notification: {
                channel_id: ANDROID_CHANNEL_ID,
                // Android 8 öncesinde kanal yok; öncelik buradan geliyor.
                notification_priority: "PRIORITY_MAX",
                default_sound: true,
                default_vibrate_timings: true,
                // Kilit ekranında içeriğiyle görünsün.
                visibility: "PUBLIC",
              },
            },
          },
        }),
      },
    );
    if (response.ok) return "sent";

    const text = await response.text();
    if (
      (response.status === 404 || response.status === 400) &&
      /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(text)
    ) {
      return "invalid_token";
    }

    const errorCode = fcmErrorCode(text);
    if (errorCode === "THIRD_PARTY_AUTH_ERROR") {
      // iOS'a teslimatı Google değil APNs yapıyor ve Firebase bunun için bir
      // APNs anahtarına ihtiyaç duyuyor. Anahtar yüklü değilse -- ya da başka
      // bir uygulamaya/takıma aitse -- gönderim tam burada ölür: kod tarafında
      // her şey doğru olsa bile hiçbir iOS cihazına bildirim ulaşmaz. Sebep
      // açıkça yazılmazsa günlükte yalnızca "401" görünüyor ve bu, kodda
      // saatlerce yanlış yerde aranan bir hataya dönüşüyor.
      console.error(
        "[fcm] APNs kimlik doğrulaması reddedildi: Firebase projesinde APNs anahtarı yok ya da bu uygulamaya ait değil (Firebase Console > Project Settings > Cloud Messaging > Apple app configuration). iOS bildirimleri bu düzeltilene kadar teslim edilemez.",
      );
    }
    console.error("[fcm] gönderim başarısız", { status: response.status, errorCode });
    return "error";
  } catch (error) {
    console.error("[fcm] gönderim hatası", error);
    return "error";
  }
}
