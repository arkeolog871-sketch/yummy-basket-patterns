/**
 * Sesli asistan — yalnızca sunucu tarafı.
 *
 * Kullanıcının sesi metne çevrilir (transcribe) ve asistanın yanıtı sese
 * dönüştürülür (speech). Anahtar tarayıcıya çıkmaz.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TRANSCRIBE_MODEL = "google/gemini-3.5-transcribe";
const SPEECH_MODEL = "openai/gpt-4o-mini-tts";

/** İzin verilen ses türleri — tarayıcı kaydı webm/mp4/ogg/wav üretir. */
const ALLOWED_AUDIO = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a"];

function requireKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Yapay zekâ yapılandırması eksik.");
  return key;
}

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

/** Ses kaydını Türkçe metne çevirir. */
export async function transcribeAudio(base64: string, mimeType: string): Promise<string> {
  const type = ALLOWED_AUDIO.includes(mimeType) ? mimeType : "audio/webm";
  const bytes = base64ToBytes(base64);
  if (bytes.byteLength === 0) throw new Error("Ses kaydı boş.");
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Ses kaydı çok uzun (en fazla 8 MB).");

  const extension = type.includes("mp4") || type.includes("m4a")
    ? "m4a"
    : type.includes("mpeg")
      ? "mp3"
      : type.includes("ogg")
        ? "ogg"
        : type.includes("wav")
          ? "wav"
          : "webm";

  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", new Blob([bytes as unknown as BlobPart], { type }), `kayit.${extension}`);

  const response = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { "Lovable-API-Key": requireKey(), "X-Lovable-AIG-SDK": "fetch" },
    body: form,
  });
  if (!response.ok) {
    if (response.status === 402) throw new Error("Yapay zekâ kredisi tükendi.");
    throw new Error("Ses anlaşılamadı, tekrar deneyin.");
  }
  const payload = (await response.json()) as { text?: string };
  const text = (payload.text ?? "").trim();
  if (!text) throw new Error("Ses anlaşılamadı, tekrar deneyin.");
  return text.slice(0, 1500);
}

/** Metni sese çevirir; base64 mp3 döndürür. */
export async function synthesizeSpeech(text: string): Promise<{ base64: string; contentType: string }> {
  const input = text.trim().slice(0, 900);
  if (!input) throw new Error("Okunacak metin yok.");

  const response = await fetch(`${GATEWAY}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": requireKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      input,
      voice: "alloy",
      response_format: "mp3",
      instructions: "Türkçe, sıcak ve sakin bir tonla, doğal hızda konuş.",
    }),
  });
  if (!response.ok) {
    if (response.status === 402) throw new Error("Yapay zekâ kredisi tükendi.");
    throw new Error("Sesli yanıt üretilemedi.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("Sesli yanıt üretilemedi.");
  return { base64: bytesToBase64(bytes), contentType: "audio/mpeg" };
}
