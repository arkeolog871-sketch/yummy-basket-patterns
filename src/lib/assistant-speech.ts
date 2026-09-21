/**
 * Asistanın yanıtı sesli okunacak mı?
 *
 * KURAL: sesle konuşulduysa sesle cevap verilir. Kullanıcı mikrofona basıp
 * konuştuğunda karşılığında konuşma bekler; yazılı bir cevap sohbeti yarıda
 * keser. "Sesli yanıt" anahtarı yalnızca YAZARAK konuşan kullanıcı için
 * geçerli — o anahtar kapalı diye sesli sohbet sessiz kalmamalı.
 *
 * Yaşanmış hata: anahtar varsayılan olarak kapalıydı ve panelin başlığında
 * duruyordu. Mikrofon çalışıyor, konuşma metne çevriliyor, asistan cevabı
 * yazıyordu ama hiç konuşmuyordu; sesli asistan yazılı asistan gibi
 * davranıyordu.
 */
export interface SpeakDecisionInput {
  /** Kullanıcının "Sesli yanıt" tercihi (yazılı sohbet için). */
  voiceOn: boolean;
  /** Bu tur mikrofonla mı başladı? */
  spoken: boolean;
  /** Asistanın yanıtı. Boşsa okunacak bir şey yok. */
  reply: string | null | undefined;
}

export function shouldSpeakReply({ voiceOn, spoken, reply }: SpeakDecisionInput): boolean {
  if (!reply || !reply.trim()) return false;
  return spoken || voiceOn;
}
