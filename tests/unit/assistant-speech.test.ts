import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldSpeakReply } from "@/lib/assistant-speech";

/**
 * Yaşanmış hata: "Sesli yanıt" anahtarı varsayılan olarak KAPALIYDI ve
 * panelin başlığında duruyordu. Kullanıcı mikrofona basıp konuşuyor, ses
 * metne çevriliyor, asistan cevabı yazıyor ama hiç konuşmuyordu — sesli
 * asistan yazılı asistan gibi davranıyordu.
 */
describe("sesli yanıt kararı", () => {
  it("sesle konuşulduysa anahtar kapalı olsa da konuşur", () => {
    expect(shouldSpeakReply({ voiceOn: false, spoken: true, reply: "Merhaba" })).toBe(true);
  });

  it("yazarak konuşulduysa anahtara uyar", () => {
    expect(shouldSpeakReply({ voiceOn: true, spoken: false, reply: "Merhaba" })).toBe(true);
    expect(shouldSpeakReply({ voiceOn: false, spoken: false, reply: "Merhaba" })).toBe(false);
  });

  it("okunacak bir şey yoksa konuşmaz", () => {
    // Boş yanıtı seslendirmek sunucuya boş TTS isteği göndermek demek.
    for (const reply of ["", "   ", null, undefined]) {
      expect(shouldSpeakReply({ voiceOn: true, spoken: true, reply })).toBe(false);
    }
  });
});

describe("asistan bileşeni sesli sohbeti bağlar", () => {
  const assistant = readFileSync("src/components/assistant/OrderAssistant.tsx", "utf8");

  it("mikrofonla gelen tur 'spoken' olarak işaretlenir", () => {
    // Bu bağ kopunca sesli sohbet sessizleşir ve hata kullanıcıya ancak
    // konuşup cevap alamadığında görünür.
    expect(assistant).toContain("sendText(result.text, { spoken: true })");
  });

  it("karar saf yardımcıdan geçer, koşul bileşene gömülmez", () => {
    expect(assistant).toContain("shouldSpeakReply(");
    expect(assistant).not.toMatch(/if\s*\(\s*voiceOn\s*&&\s*response\.reply\s*\)/);
  });

  it("sesle konuşan kullanıcıda sesli yanıt tercihi açılır", () => {
    expect(assistant).toContain("enableVoiceReplies()");
  });

  it("seslendirme hatası sessizce yutulmaz", () => {
    // Boş catch, özelliğin hiç çalışmadığı durumu kullanıcıdan da bizden de
    // gizliyordu: asistan yazıyor ama konuşmuyordu ve sebep hiçbir yerde
    // görünmüyordu.
    expect(assistant).toContain("Sesli yanıt oynatılamadı");
    expect(assistant).not.toMatch(
      /catch\s*\{\s*\/\* sesli okuma başarısız olsa da yazılı yanıt ekranda duruyor \*\/\s*\}/,
    );
  });
});
