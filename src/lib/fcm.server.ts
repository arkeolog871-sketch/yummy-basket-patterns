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

/** Tek bir FCM token'ına bildirim gönderir. VAPID'siz ortamda olduğu gibi,
 * servis hesabı tanımlı değilse sessizce "unconfigured" döner. */
export async function sendFcmMessage(
  token: string,
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
            token,
            notification: { title: payload.title, body: payload.body },
            ...(payload.url ? { data: { url: payload.url } } : {}),
            android: { priority: "high" },
          },
        }),
      },
    );
    if (response.ok) return "sent";
    if (response.status === 404 || response.status === 400) {
      const text = await response.text();
      if (/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(text)) return "invalid_token";
    }
    console.error("[fcm] gönderim başarısız", { status: response.status });
    return "error";
  } catch (error) {
    console.error("[fcm] gönderim hatası", error);
    return "error";
  }
}
