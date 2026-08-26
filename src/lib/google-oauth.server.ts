import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const GOOGLE_OAUTH_STATE_PREFIX = "sc1";
export const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const PRODUCTION_OAUTH_ORIGIN = "https://uygulamamcebimde.online";

export type GoogleOAuthStatePayload = {
  n: string;
  v: string;
  r: string;
  t: number;
};

const PRODUCTION_REDIRECTS = new Set([
  `${PRODUCTION_OAUTH_ORIGIN}/auth`,
  "https://www.uygulamamcebimde.online/auth",
]);

/**
 * Durum jetonu anahtarı. Sabit yedek yok — eksikse OAuth mühürlenmez.
 * Tercih: GOOGLE_OAUTH_STATE_SECRET, yoksa GOOGLE_OAUTH_CLIENT_SECRET.
 * Service-role anahtarı durum jetonu için kullanılmaz.
 */
export function resolveGoogleOAuthStateSecret(): string | null {
  const dedicated = process.env["GOOGLE_OAUTH_STATE_SECRET"]?.trim();
  if (dedicated) return dedicated;
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"]?.trim();
  if (clientSecret) return `sc-google-oauth-state:${clientSecret}`;
  return null;
}

export function isGoogleOAuthStateConfigured(): boolean {
  return Boolean(resolveGoogleOAuthStateSecret());
}

function stateKey(): Buffer {
  const secret = resolveGoogleOAuthStateSecret();
  if (!secret) {
    throw new Error("Google OAuth durum anahtarı yapılandırılmadı.");
  }
  return createHash("sha256").update(secret).digest();
}

export function googleOAuthClientId(): string {
  return (
    process.env["VITE_GOOGLE_OAUTH_CLIENT_ID"] ||
    process.env["GOOGLE_OAUTH_CLIENT_ID"] ||
    ""
  ).trim();
}

export function googleOAuthClientSecret(): string {
  return (process.env["GOOGLE_OAUTH_CLIENT_SECRET"] || "").trim();
}

export function isAllowedGoogleRedirectUri(uri: string): boolean {
  if (PRODUCTION_REDIRECTS.has(uri)) return true;
  try {
    const url = new URL(uri);
    if (url.pathname !== "/auth" || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return url.protocol === "http:";
    if (url.protocol !== "https:") return false;
    if (host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com")) return true;
    return false;
  } catch {
    return false;
  }
}

export function sealGoogleOAuthStatePayload(payload: GoogleOAuthStatePayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", stateKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const packed = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  return `${GOOGLE_OAUTH_STATE_PREFIX}.${packed.toString("base64url")}`;
}

export function unsealGoogleOAuthStatePayload(state: string): GoogleOAuthStatePayload {
  if (!state.startsWith(`${GOOGLE_OAUTH_STATE_PREFIX}.`)) {
    throw new Error("Geçersiz durum belirteci.");
  }
  const packed = Buffer.from(state.slice(GOOGLE_OAUTH_STATE_PREFIX.length + 1), "base64url");
  if (packed.length < 29) throw new Error("Geçersiz durum belirteci.");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const encrypted = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", stateKey(), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  const payload = JSON.parse(json) as GoogleOAuthStatePayload;
  if (!payload?.n || !payload.v || !payload.r || typeof payload.t !== "number") {
    throw new Error("Geçersiz durum belirteci.");
  }
  if (Date.now() - payload.t > GOOGLE_OAUTH_STATE_TTL_MS) {
    throw new Error("Google girişi zaman aşımına uğradı. Lütfen tekrar deneyin.");
  }
  if (!isAllowedGoogleRedirectUri(payload.r)) {
    throw new Error("Google dönüş adresi bu uygulama için kayıtlı değil.");
  }
  return payload;
}

export async function exchangeGoogleAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<{ ok: true; idToken: string; accessToken?: string } | { ok: false; error: string }> {
  const clientId = googleOAuthClientId();
  if (!clientId) {
    return {
      ok: false,
      error: "Google OAuth istemci kimliği eksik. VITE_GOOGLE_OAUTH_CLIENT_ID tanımlayın.",
    };
  }
  if (!isAllowedGoogleRedirectUri(input.redirectUri)) {
    return { ok: false, error: "Google dönüş adresi bu uygulama için kayıtlı değil." };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    code: input.code,
    code_verifier: input.verifier,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
  });
  const secret = googleOAuthClientSecret();
  if (secret) body.set("client_secret", secret);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json().catch(() => ({}))) as {
    id_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !json.id_token) {
    return {
      ok: false,
      error: humanizeGoogleTokenError(json.error_description || json.error || ""),
    };
  }
  if (json.access_token) {
    return { ok: true, idToken: json.id_token, accessToken: json.access_token };
  }
  return { ok: true, idToken: json.id_token };
}

export function humanizeGoogleTokenError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("redirect_uri") || text.includes("unauthorized_client")) {
    return "Google Cloud Console’da yetkili yönlendirme URI’si https://uygulamamcebimde.online/auth olarak eklenmeli.";
  }
  if (text.includes("invalid_grant") || text.includes("code_verifier")) {
    return "Google yetkilendirme kodu doğrulanamadı. Aynı tarayıcıda tekrar deneyin.";
  }
  if (
    text.includes("invalid_client") ||
    text.includes("client_secret") ||
    text.includes("unauthorized")
  ) {
    return "Google OAuth istemci gizli anahtarı eksik veya hatalı. GOOGLE_OAUTH_CLIENT_SECRET değerini kontrol edin.";
  }
  return message || "Google jetonu alınamadı. Lütfen tekrar deneyin.";
}
