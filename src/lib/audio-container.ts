/**
 * Ses kaydının GERÇEK kabını baytlardan tanır — saf, tarayıcısız test edilebilir.
 *
 * NEDEN: kabı istemcinin bildirdiği MIME'a göre seçmek güvenilir değil.
 * MediaRecorder iOS Safari'de `audio/mp4` üretiyor, Android Chrome'da
 * `audio/webm;codecs=opus`; bazı sarmalayıcılarda `blob.type` boş geliyor.
 * Yanlış etiket, yazıya çevirme ucuna yanlış uzantı ve yanlış content-type
 * gönderilmesi demek — sağlayıcı "geçersiz dosya biçimi" diyip düşüyor ve
 * kullanıcı sadece "ses anlaşılamadı" görüyor. Kap artık baytlardan okunuyor,
 * istemcinin etiketi yalnızca yedek.
 */

export interface AudioContainer {
  mimeType: string;
  extension: string;
}

const BY_EXTENSION: Record<string, AudioContainer> = {
  webm: { mimeType: "audio/webm", extension: "webm" },
  mp4: { mimeType: "audio/mp4", extension: "m4a" },
  ogg: { mimeType: "audio/ogg", extension: "ogg" },
  wav: { mimeType: "audio/wav", extension: "wav" },
  mp3: { mimeType: "audio/mpeg", extension: "mp3" },
};

const FALLBACK: AudioContainer = BY_EXTENSION["webm"]!;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let index = start; index < start + length && index < bytes.length; index += 1) {
    out += String.fromCharCode(bytes[index]!);
  }
  return out;
}

/** Baytlardan kabı tanır; tanınmazsa null döner. */
export function sniffAudioContainer(bytes: Uint8Array): AudioContainer | null {
  if (bytes.length < 12) return null;
  // Matroska/WebM: EBML başlığı.
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return BY_EXTENSION["webm"]!;
  }
  // ISO-BMFF (mp4/m4a): boyut + "ftyp".
  if (ascii(bytes, 4, 4) === "ftyp") return BY_EXTENSION["mp4"]!;
  if (ascii(bytes, 0, 4) === "OggS") return BY_EXTENSION["ogg"]!;
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return BY_EXTENSION["wav"]!;
  }
  // MP3: ID3 etiketi ya da çerçeve senkron baytları.
  if (ascii(bytes, 0, 3) === "ID3") return BY_EXTENSION["mp3"]!;
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return BY_EXTENSION["mp3"]!;
  return null;
}

/** İstemcinin bildirdiği MIME'ı kaba çevirir (codec eki atılır). */
export function containerFromMimeType(mimeType: string | undefined): AudioContainer | null {
  const base = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!base) return null;
  if (base.includes("webm")) return BY_EXTENSION["webm"]!;
  if (base.includes("mp4") || base.includes("m4a") || base.includes("aac")) {
    return BY_EXTENSION["mp4"]!;
  }
  if (base.includes("ogg") || base.includes("opus")) return BY_EXTENSION["ogg"]!;
  if (base.includes("wav") || base.includes("x-pcm")) return BY_EXTENSION["wav"]!;
  if (base.includes("mpeg") || base.includes("mp3")) return BY_EXTENSION["mp3"]!;
  return null;
}

/**
 * Yazıya çevirme isteğinde kullanılacak kabı seçer: önce baytlar, sonra
 * istemcinin etiketi, en sonda webm.
 */
export function resolveAudioContainer(bytes: Uint8Array, mimeType?: string): AudioContainer {
  return sniffAudioContainer(bytes) ?? containerFromMimeType(mimeType) ?? FALLBACK;
}
