/**
 * Sesli asistan — yalnızca sunucu tarafı.
 *
 * Kullanıcının sesi metne çevrilir (transcribe) ve asistanın yanıtı sese
 * dönüştürülür (speech). Anahtar tarayıcıya çıkmaz.
 *
 * İKİ YAŞANMIŞ ARIZA burada kilitleniyor:
 *
 * 1) KAP ETİKETİ. Kayıt biçimi istemcinin bildirdiği MIME'a göre seçiliyordu.
 *    iOS Safari `audio/mp4` üretiyor, sesli sohbet ekranı ise kaydı koşulsuz
 *    "audio/webm" diye etiketliyordu; dosya `kayit.webm` adıyla mp4 içerikle
 *    gidiyor ve sağlayıcı biçimi reddediyordu. Kap artık BAYTLARDAN tanınıyor.
 *
 * 2) ULAŞILAMAYAN GEÇİT. Geçit adresi çözümlenmediğinde `fetch` istisna
 *    atıyor ve bu istisna kullanıcıya "İşlem tamamlanamadı" olarak dönüyordu.
 *    Artık ağ hatası açıkça bildirilir; başka bir sağlayıcıya sessizce
 *    düşülmez.
 */

import {
  aiFailureMessage,
  aiProvider,
  type AiProviderConfig,
} from "./ai-provider.server";
import { resolveAudioContainer } from "./audio-container";

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(",") ? (base64.split(",")[1] ?? "") : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/**
 * Ses ucuna yalnızca yapılandırılmış geçit üzerinden istek atar.
 * Ağ hatasında başka bir sağlayıcıya düşülmez; kullanıcının OpenAI geçidi
 * dışındaki bir yolun sessizce kullanılması engellenir.
 */
async function fetchFromVoiceGateway(
  path: string,
  build: (provider: AiProviderConfig) => RequestInit,
): Promise<{ provider: AiProviderConfig; response: Response }> {
  const provider = aiProvider();
  try {
    return { provider, response: await fetch(`${provider.baseUrl}${path}`, build(provider)) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error ?? "");
    if (!/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|network|Failed to fetch|getaddrinfo|dns/i.test(detail)) {
      throw error;
    }
    throw new Error(
      "Sesli asistan sunucusuna ulaşılamıyor; yapay zekâ geçidi adresi yanıt vermiyor.",
    );
  }
}

/** Ses kaydını Türkçe metne çevirir. */
export async function transcribeAudio(base64: string, mimeType: string): Promise<string> {
  const bytes = base64ToBytes(base64);
  if (bytes.byteLength === 0) throw new Error("Ses kaydı boş.");
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Ses kaydı çok uzun (en fazla 8 MB).");

  // Kap istemcinin etiketine DEĞİL baytlara göre seçilir; etiket yalnız yedek.
  const container = resolveAudioContainer(bytes, mimeType);

  const { response } = await fetchFromVoiceGateway("/audio/transcriptions", (provider) => {
    const form = new FormData();
    form.append("model", provider.models.transcribe);
    form.append("language", "tr");
    form.append("response_format", "json");
    form.append(
      "file",
      new Blob([bytes as unknown as BlobPart], { type: container.mimeType }),
      `kayit.${container.extension}`,
    );
    // DİKKAT: content-type ELLE verilmez. Verilirse multipart sınır (boundary)
    // eksik kalır ve gövde sunucuda ayrıştırılamaz.
    return { method: "POST", headers: provider.headers, body: form };
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const failure = aiFailureMessage(response.status, body);
    throw new Error(failure ?? "Ses anlaşılamadı, tekrar deneyin.");
  }
  const payload = (await response.json().catch(() => null)) as
    | { text?: string; results?: { text?: string }[] }
    | null;
  const text = (payload?.text ?? payload?.results?.[0]?.text ?? "").trim();
  if (!text) throw new Error("Ses anlaşılamadı, tekrar deneyin.");
  return text.slice(0, 1500);
}

/** Metni sese çevirir; base64 mp3 döndürür. */
export async function synthesizeSpeech(
  text: string,
): Promise<{ base64: string; contentType: string }> {
  const input = text.trim().slice(0, 900);
  if (!input) throw new Error("Okunacak metin yok.");

  const { response } = await fetchFromVoiceGateway("/audio/speech", (provider) => ({
    method: "POST",
    headers: { "Content-Type": "application/json", ...provider.headers },
    body: JSON.stringify({
      model: provider.models.speech,
      input,
      voice: "alloy",
      response_format: "mp3",
      instructions: "Türkçe, sıcak ve sakin bir tonla, doğal hızda konuş.",
    }),
  }));

  if (!response.ok) {
    const failure = aiFailureMessage(response.status, await response.text().catch(() => ""));
    throw new Error(failure ?? "Sesli yanıt üretilemedi.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("Sesli yanıt üretilemedi.");
  return { base64: bytesToBase64(bytes), contentType: "audio/mpeg" };
}
