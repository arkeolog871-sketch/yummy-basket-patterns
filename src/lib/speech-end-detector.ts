/**
 * Konuşmanın bittiğini ses seviyesinden anlar.
 *
 * NEDEN: sesli sohbette kullanıcı düğmeye basıp bırakmaz — konuşur ve susar.
 * "Sustu" kararını vermek için mikrofon seviyesini izlemek gerekiyor.
 *
 * Kural üç eşikten oluşuyor ve üçü de gerçek bir sohbeti bozmamak için var:
 * - speechThreshold: bunun üstü konuşma sayılır. Altındaki fısıltı ve oda
 *   gürültüsü kaydı bitirmez ama başlatmaz da.
 * - silenceMs: konuşma BAŞLADIKTAN sonra bu kadar sessizlik "bitti" demek.
 *   Cümle arasındaki nefesi bitiş sanmayacak kadar uzun olmalı.
 * - maxMs: hiç susmayan kullanıcıda kayıt sonsuza kadar sürmesin.
 *
 * Ayrıca minSpeechMs var: hiç konuşulmadan gelen sessizlik "boş kayıt"tır,
 * sunucuya gönderilmez; kullanıcı yanlışlıkla dokunmuştur.
 */
export interface SpeechEndOptions {
  /** Konuşma sayılan en düşük seviye (0-1 arası RMS). */
  speechThreshold: number;
  /** Konuşmadan sonra kaydı bitiren sessizlik süresi (ms). */
  silenceMs: number;
  /** Kaydın en uzun süresi (ms). */
  maxMs: number;
  /** Bu süreden az konuşma varsa kayıt boş sayılır (ms). */
  minSpeechMs: number;
}

export const DEFAULT_SPEECH_END_OPTIONS: SpeechEndOptions = {
  // Sessiz bir odada mikrofon tabanı ~0.01; normal konuşma 0.05 üstü.
  speechThreshold: 0.035,
  // 1200 ms: cümle arası nefes bitiş sanılmasın, ama bekletmesin.
  silenceMs: 1200,
  // 30 sn: uzun bir sipariş tarifi bile sığar.
  maxMs: 30_000,
  // 300 ms altındaki ses öksürük veya kapı sesi olabilir.
  minSpeechMs: 300,
};

/** Karar: kayda devam, konuşma bitti, ya da hiç konuşulmadı. */
export type SpeechEndVerdict = "devam" | "bitti" | "bos";

export class SpeechEndDetector {
  private speechMs = 0;
  private silenceRunMs = 0;
  private lastAtMs: number | null = null;
  private heardSpeech = false;

  constructor(private readonly options: SpeechEndOptions = DEFAULT_SPEECH_END_OPTIONS) {}

  /** Konuşma hiç duyuldu mu (arayüzde "seni duyuyorum" göstergesi için). */
  get speaking(): boolean {
    return this.heardSpeech;
  }

  /**
   * Yeni bir seviye örneği ekler ve kararı döndürür.
   * `atMs` kaydın başından beri geçen süre.
   */
  push(level: number, atMs: number): SpeechEndVerdict {
    const previous = this.lastAtMs;
    this.lastAtMs = atMs;
    // İlk örnekte geçen süre yok; negatif veya geri giden zaman yok sayılır.
    const elapsed = previous === null ? 0 : Math.max(0, atMs - previous);

    if (level >= this.options.speechThreshold) {
      this.speechMs += elapsed;
      this.silenceRunMs = 0;
      if (this.speechMs >= this.options.minSpeechMs) this.heardSpeech = true;
    } else {
      this.silenceRunMs += elapsed;
    }

    if (atMs >= this.options.maxMs) {
      return this.heardSpeech ? "bitti" : "bos";
    }
    if (this.heardSpeech && this.silenceRunMs >= this.options.silenceMs) {
      return "bitti";
    }
    // Hiç konuşmadan uzun süre sessizlik: boşuna kayıt tutma.
    if (!this.heardSpeech && this.silenceRunMs >= this.options.silenceMs * 4) {
      return "bos";
    }
    return "devam";
  }
}

/** Zaman alanı örneklerinden (-1..1) RMS seviyesi. */
export function rmsLevel(samples: Float32Array | number[]): number {
  let total = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0;
    total += value * value;
  }
  if (samples.length === 0) return 0;
  return Math.sqrt(total / samples.length);
}
