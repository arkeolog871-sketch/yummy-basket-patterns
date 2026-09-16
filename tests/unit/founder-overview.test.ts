import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

function codeOnly(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const functions = codeOnly("src/lib/founder.functions.ts");
const panel = codeOnly("src/components/founder/OverviewPanel.tsx");
const route = codeOnly("src/routes/kurucu.tsx");

/**
 * Özet, toplam kullanıcı ve cihaz sayısı gibi hesap geneli bilgiyi
 * gösteriyor. Bölge yöneticisinin yetkisi kendi bölgesiyle sınırlı, bu
 * yüzden hem sunucu hem arayüz tarafında sahibe kapatılmış olmalı.
 */
describe("kurucu özeti yetkiyle sınırlı", () => {
  it("sunucu fonksiyonu sahiplik doğruluyor", () => {
    const start = functions.indexOf("export const getFounderOverview");
    expect(start).toBeGreaterThan(-1);
    const body = functions.slice(start, start + 600);
    expect(body).toContain("requireSupabaseAuth");
    expect(body).toContain("assertFounder");
  });

  it("panel yalnızca sahibe çiziliyor", () => {
    expect(route).toContain("<OverviewPanel />");
    expect(route).toMatch(/\{isOwner \? <OverviewPanel \/> : null\}/);
  });
});

describe("kurucu özeti harekete geçiriyor", () => {
  it("vitrini boş ve bildirimsiz işletmeleri ayrı ayrı hesaplıyor", () => {
    expect(functions).toContain("emptyCatalog");
    expect(functions).toContain("withoutPush");
  });

  it("uyarılar işletme adlarını taşıyor, yalnızca sayı değil", () => {
    // "3 işletme boş" bir şey yaptırmaz; hangileri olduğu yaptırır.
    expect(functions).toMatch(/emptyCatalog: emptyCatalog\.map\(\(row\) => row\.name\)/);
    expect(functions).toMatch(/withoutPush: withoutPush\.map\(\(row\) => row\.name\)/);
  });

  it("sorun yokken uyarı çizilmiyor", () => {
    expect(panel).toContain("if (names.length === 0) return null;");
  });

  it("özet yüklenemezse panelin geri kalanı ayakta kalıyor", () => {
    expect(panel).toContain("Panelin geri kalanı çalışmaya devam ediyor");
  });
});

describe("kurucu özeti cihazları doğru sayıyor", () => {
  /**
   * Jeton yenilenince yeni satır yazılıyor; aynı telefonu iki kez saymak
   * "kaç cihaza ulaşıyoruz" sorusunu yanlış cevaplar. Cihaz kimliği varsa
   * onunla, yoksa jetonla tekilleşmeli.
   */
  it("aynı cihazın birden çok jetonunu tek sayıyor", () => {
    expect(functions).toMatch(
      /new Set\(\(tokenRows\.data \?\? \[\]\)\.map\(\(row\) => row\.device_id \?\? row\.token\)\)/,
    );
  });
});
