/**
 * Gerçek zamanlı ses oturumu — yalnızca sunucu tarafı.
 *
 * Tarayıcıya ASLA OPENAI_API_KEY verilmez. Bunun yerine sunucu, mevcut ses
 * sağlayıcısı (varsa Supabase `openai-gateway`, yoksa sunucudaki anahtarla
 * doğrudan OpenAI) üzerinden kısa ömürlü bir istemci sırrı üretir. Tarayıcı
 * yalnız o sırla WebRTC bağlantısı kurar; sır ~1 dakika sonra geçersizdir.
 *
 * Hata durumunda gerçek durum kodu ve güvenli mesaj yukarı taşınır; sessizce
 * başka bir yapay zekâ sağlayıcısına geçilmez.
 */

import { voiceProvider } from "./ai-provider.server";

const REALTIME_CALL_URL = "https://api.openai.com/v1/realtime/calls";

function realtimeModel(): string {
  const override = process.env["AI_REALTIME_MODEL"]?.trim();
  return override || "gpt-realtime";
}

function safeDetail(body: string): string | null {
  try {
    const payload = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
    const value =
      typeof payload.error?.message === "string" ? payload.error.message : payload.message;
    if (typeof value !== "string") return null;
    const clean = value.replace(/[\r\n]+/g, " ").trim();
    if (!clean || clean.length > 180 || /sk-[A-Za-z0-9_-]+|bearer\s+|OPENAI_API_KEY|secret/i.test(clean))
      return null;
    return clean;
  } catch {
    return null;
  }
}

export interface RealtimeSecret {
  token: string;
  model: string;
  callUrl: string;
  expiresAt: number | null;
}

/** Kısa ömürlü istemci sırrı üretir. */
export async function createRealtimeSecret(): Promise<RealtimeSecret> {
  const provider = voiceProvider();
  if (!provider) {
    throw new Error(
      "Gerçek zamanlı ses yapılandırılmadı: ne geçit adresi ne de yapay zekâ anahtarı tanımlı.",
    );
  }
  const model = realtimeModel();

  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/realtime/client_secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...provider.headers },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 60 },
        session: { type: "realtime", model },
      }),
    });
  } catch (error) {
    const cause =
      error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
    const code = typeof cause?.code === "string" ? cause.code : "FETCH_FAILED";
    throw new Error(`Gerçek zamanlı ses sağlayıcısına ulaşılamadı (ağ hatası: ${code}).`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = safeDetail(body);
    throw new Error(
      `Gerçek zamanlı ses oturumu açılamadı (durum ${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    value?: unknown;
    expires_at?: unknown;
    client_secret?: { value?: unknown; expires_at?: unknown };
  } | null;
  const token =
    typeof payload?.value === "string"
      ? payload.value
      : typeof payload?.client_secret?.value === "string"
        ? payload.client_secret.value
        : "";
  if (!token) throw new Error("Gerçek zamanlı ses oturumu için geçici anahtar alınamadı.");

  const expires = payload?.expires_at ?? payload?.client_secret?.expires_at;
  return {
    token,
    model,
    callUrl: REALTIME_CALL_URL,
    expiresAt: typeof expires === "number" ? expires : null,
  };
}
