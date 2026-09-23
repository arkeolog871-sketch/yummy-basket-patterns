/**
 * Asistanın konuşma sesleri (ses kategorisi).
 *
 * Liste hem arayüzde hem sunucuda kullanılır: kullanıcı sadece bu listeden
 * seçebilir, sunucu da gelen değeri bu listeye göre doğrular. Böylece
 * istemciden gelen serbest metin sağlayıcıya olduğu gibi geçmez.
 *
 * Sesler kasıtlı olarak "zarif, sıcak ve güçlü" tonlardan seçildi; eski
 * varsayılan (alloy) düz ve metalik duyuluyordu.
 */
export interface AssistantVoice {
  /** Sağlayıcıya gönderilen ses kimliği. */
  id: string;
  /** Kullanıcıya gösterilen ad. */
  label: string;
  /** Kısa ton açıklaması. */
  hint: string;
}

export const ASSISTANT_VOICES: AssistantVoice[] = [
  { id: "coral", label: "Lidya (kadın)", hint: "Zarif, sıcak" },
  { id: "sage", label: "Parla (kadın)", hint: "Sakin, güven veren" },
  { id: "shimmer", label: "Arya (kadın)", hint: "Parlak, canlı" },
  { id: "verse", label: "Alim (erkek)", hint: "Güçlü, cömert" },
  { id: "onyx", label: "Polat (erkek)", hint: "Derin, ağırbaşlı" },
  { id: "ballad", label: "Alperen (erkek)", hint: "Yumuşak, hikâyeci" },
];

export const DEFAULT_ASSISTANT_VOICE = "coral";

/** Geçersiz veya bilinmeyen ses kimliğini varsayılana çeker. */
export function normalizeAssistantVoice(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_ASSISTANT_VOICE;
  const clean = value.trim().toLowerCase();
  return ASSISTANT_VOICES.some((voice) => voice.id === clean) ? clean : DEFAULT_ASSISTANT_VOICE;
}

export function assistantVoiceLabel(id: string): string {
  return ASSISTANT_VOICES.find((voice) => voice.id === normalizeAssistantVoice(id))!.label;
}
