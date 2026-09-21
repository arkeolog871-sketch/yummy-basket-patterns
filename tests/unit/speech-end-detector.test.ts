import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPEECH_END_OPTIONS,
  SpeechEndDetector,
  rmsLevel,
  type SpeechEndVerdict,
} from "@/lib/speech-end-detector";

/** Verilen seviyeleri 100 ms aralıklarla besler, son kararı döndürür. */
function feed(levels: number[], stepMs = 100): { verdict: SpeechEndVerdict; atMs: number } {
  const detector = new SpeechEndDetector();
  let atMs = 0;
  for (const level of levels) {
    const verdict = detector.push(level, atMs);
    if (verdict !== "devam") return { verdict, atMs };
    atMs += stepMs;
  }
  return { verdict: "devam", atMs };
}

const KONUSMA = 0.2;
const SESSIZ = 0.005;

describe("konuşmanın bittiğini anlama", () => {
  it("konuşma sürerken kayıt devam eder", () => {
    expect(feed(Array(20).fill(KONUSMA)).verdict).toBe("devam");
  });

  it("konuşmadan sonra sessizlik kaydı bitirir", () => {
    // 1 sn konuşma + 1.2 sn sessizlik
    const { verdict } = feed([...Array(10).fill(KONUSMA), ...Array(15).fill(SESSIZ)]);
    expect(verdict).toBe("bitti");
  });

  it("cümle arasındaki kısa nefes kaydı bitirmez", () => {
    // 600 ms sessizlik: varsayılan eşiğin (1200 ms) altında.
    const levels = [...Array(8).fill(KONUSMA), ...Array(6).fill(SESSIZ), ...Array(8).fill(KONUSMA)];
    expect(feed(levels).verdict).toBe("devam");
  });

  it("hiç konuşulmadıysa kayıt boş sayılır", () => {
    // Yanlışlıkla dokunuldu: sunucuya boş ses göndermenin anlamı yok.
    const { verdict } = feed(Array(60).fill(SESSIZ));
    expect(verdict).toBe("bos");
  });

  it("çok kısa bir ses konuşma sayılmaz", () => {
    // 200 ms (minSpeechMs 300) öksürük/kapı sesi.
    const { verdict } = feed([KONUSMA, KONUSMA, ...Array(60).fill(SESSIZ)]);
    expect(verdict).toBe("bos");
  });

  it("hiç susmayan kullanıcıda üst sınırda biter", () => {
    const detector = new SpeechEndDetector();
    let verdict: SpeechEndVerdict = "devam";
    let atMs = 0;
    while (verdict === "devam" && atMs <= 60_000) {
      verdict = detector.push(KONUSMA, atMs);
      atMs += 100;
    }
    expect(verdict).toBe("bitti");
    expect(atMs - 100).toBeGreaterThanOrEqual(DEFAULT_SPEECH_END_OPTIONS.maxMs);
  });

  it("konuşma duyuldu bayrağı arayüz için doğru", () => {
    const detector = new SpeechEndDetector();
    detector.push(SESSIZ, 0);
    expect(detector.speaking).toBe(false);
    detector.push(KONUSMA, 100);
    detector.push(KONUSMA, 200);
    detector.push(KONUSMA, 400);
    expect(detector.speaking).toBe(true);
  });

  it("geri giden veya duran zaman damgası bozmaz", () => {
    // requestAnimationFrame/AudioContext zamanı bazen aynı değeri iki kez verir.
    const detector = new SpeechEndDetector();
    expect(detector.push(KONUSMA, 500)).toBe("devam");
    expect(detector.push(KONUSMA, 400)).toBe("devam");
    expect(detector.push(KONUSMA, 400)).toBe("devam");
  });
});

describe("RMS seviyesi", () => {
  it("sessizlik sıfır", () => {
    expect(rmsLevel(new Float32Array(128))).toBe(0);
  });

  it("tam genlik bir", () => {
    expect(rmsLevel([1, -1, 1, -1])).toBeCloseTo(1, 6);
  });

  it("yarım genlik yarım seviye", () => {
    expect(rmsLevel([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5, 6);
  });

  it("boş dizi çökmez", () => {
    expect(rmsLevel([])).toBe(0);
  });
});
