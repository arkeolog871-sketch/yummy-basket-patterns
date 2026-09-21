import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stripMarkdownForPlainText } from "../../src/lib/assistant-text";

const assistant = readFileSync("src/components/assistant/OrderAssistant.tsx", "utf8");

describe("mobil sesli asistan", () => {
  it("mikrofon izni ön kontrolle engellenmez (Android WebView 'denied' bildiriyor)", () => {
    expect(assistant).not.toMatch(/permissions[\s\S]{0,200}query\(\{\s*name:\s*"microphone"/);
    expect(assistant).toContain('navigator.mediaDevices.getUserMedia({ audio: true })');
  });

  it("ses kaydı desteklenmeyen cihazda kullanıcı yazarak devam edebilir", () => {
    expect(assistant).toContain("Bu cihazda ses kaydı desteklenmiyor");
  });

  it("sesli yanıt Blob adresiyle çalınır (mobilde data: URI engelleniyor)", () => {
    expect(assistant).toContain("URL.createObjectURL");
    expect(assistant).toContain("URL.revokeObjectURL");
  });
});

describe("asistan yanıtı düz metin", () => {
  it("kalın ve başlık işaretleri temizlenir", () => {
    expect(stripMarkdownForPlainText("Açılış **10.00**, kapanış __00.00__.")).toBe(
      "Açılış 10.00, kapanış 00.00.",
    );
    expect(stripMarkdownForPlainText("## Menü\n* Çay\n* Kahve")).toBe("Menü\n- Çay\n- Kahve");
  });

  it("bağlantı metni ve adresi korunur", () => {
    expect(stripMarkdownForPlainText("[Silvan](https://ornek.com)")).toBe(
      "Silvan (https://ornek.com)",
    );
  });

  it("normal metni bozmaz", () => {
    expect(stripMarkdownForPlainText("Fiyat 165 TL, 5*3 = 15 gibi.")).toBe(
      "Fiyat 165 TL, 5*3 = 15 gibi.",
    );
  });
});
