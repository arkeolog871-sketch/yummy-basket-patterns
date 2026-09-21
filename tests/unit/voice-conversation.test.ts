import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/assistant/VoiceConversation.tsx", "utf8");
const loop = source.slice(
  source.indexOf("const runTurn = useCallback"),
  source.indexOf("function beginMetering"),
);

/**
 * Sesli sohbet döngüsü açılışta BİR KEZ kuruluyor ve kendi kendini çağırıyor.
 * Bu yapının iki sessiz tuzağı var; ikisi de gerçek tarayıcıda ölçülerek
 * bulundu ve burada kilitleniyor.
 */
describe("sesli sohbet döngüsü", () => {
  it("her turda GÜNCEL prop kapanışlarını çağırır", () => {
    // Yaşanmış hata: döngü ilk render'daki kapanışları ömür boyu taşıyordu.
    // Sonucu, ask'in sohbet geçmişini sesli sohbet AÇILDIĞI andaki hâliyle
    // göndermesiydi — asistan ikinci turdan itibaren bir önceki konuşulanı
    // görmüyordu. Tarayıcıda tur sayacının hiç ilerlememesiyle yakalandı.
    expect(loop).toContain("propsRef.current.transcribe(");
    expect(loop).toContain("propsRef.current.ask(");
    expect(loop).toContain("propsRef.current.speak(");
    // Doğrudan çağrı kalmamalı: kalırsa o çağrı ilk turun kapanışında donar.
    expect(loop).not.toMatch(/[^.]\bawait transcribe\(/);
    expect(loop).not.toMatch(/[^.]\bawait ask\(/);
    expect(loop).not.toMatch(/[^.]\bawait speak\(/);
  });

  it("mikrofon hatası ile tur hatası ayrı ele alınır", () => {
    // Yaşanmış hata: her hata mikrofon hatası sayılıyordu. Anlaşılmayan tek
    // bir cümle sohbeti kapatıp kullanıcıya alakasız bir mikrofon tanısı
    // gösteriyordu.
    expect(loop).toContain('let stage: "mikrofon" | "tur"');
    expect(loop).toContain('if (stage === "mikrofon")');
    const micIndex = loop.indexOf('if (stage === "mikrofon")');
    expect(loop.slice(micIndex)).toContain("microphoneAdvice(");
    expect(loop.slice(0, micIndex)).not.toContain("microphoneAdvice(");
  });

  it("tur hatasında sohbet sürer, üst üste başarısızlıkta kapanır", () => {
    expect(source).toContain("MAX_TURN_FAILURES");
    const limit = Number(source.match(/const MAX_TURN_FAILURES = (\d+)/)?.[1]);
    // Bir "anlamadım" sohbeti bitirmemeli; sonsuza kadar da denememeli.
    expect(limit).toBeGreaterThan(1);
    expect(limit).toBeLessThanOrEqual(5);
    expect(loop).toContain("failureRef.current += 1");
    expect(loop).toContain("failureRef.current = 0");
  });

  it("asistan konuşurken mikrofon kapalı kalır", () => {
    // Seslendirme beklenmeden dinlemeye dönülürse asistan kendi sesini
    // duyup kendine cevap verir.
    const speakIndex = loop.indexOf("propsRef.current.speak(");
    expect(speakIndex).toBeGreaterThan(-1);
    expect(loop.slice(speakIndex - 20, speakIndex)).toContain("await");
    expect(loop.indexOf("void runTurn();", speakIndex)).toBeGreaterThan(speakIndex);
  });
});
