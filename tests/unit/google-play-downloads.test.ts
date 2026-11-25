import { describe, expect, it } from "vitest";
import {
  candidateInstallFiles,
  decodeInstallCsv,
  parseInstallCsv,
} from "@/lib/google-play-downloads.server";

describe("candidateInstallFiles", () => {
  it("bu ayın overview/country dosyalarını önce, geçen ayınkileri sonra dener", () => {
    const files = candidateInstallFiles(new Date(Date.UTC(2026, 10, 24)));
    expect(files).toEqual([
      "stats/installs/installs_online.uygulamamcebimde.app_202611_overview.csv",
      "stats/installs/installs_online.uygulamamcebimde.app_202611_country.csv",
      "stats/installs/installs_online.uygulamamcebimde.app_202610_overview.csv",
      "stats/installs/installs_online.uygulamamcebimde.app_202610_country.csv",
    ]);
  });

  it("yıl sınırını doğru geçer (Ocak → bir önceki Aralık)", () => {
    const files = candidateInstallFiles(new Date(Date.UTC(2027, 0, 5)));
    expect(files[0]).toContain("_202701_");
    expect(files[2]).toContain("_202612_");
  });
});

describe("decodeInstallCsv", () => {
  it("UTF-16LE BOM'lu metni doğru çözer", () => {
    const text = "Date,Total User Installs\n2026-11-20,42\n";
    const utf16 = Buffer.from(text, "utf16le");
    const withBom = Buffer.concat([Buffer.from([0xff, 0xfe]), utf16]);
    expect(
      decodeInstallCsv(
        withBom.buffer.slice(withBom.byteOffset, withBom.byteOffset + withBom.byteLength),
      ),
    ).toBe(text);
  });

  it("BOM yoksa UTF-8 olarak okur", () => {
    const text = "Date,Total User Installs\n2026-11-20,42\n";
    const bytes = new TextEncoder().encode(text);
    expect(decodeInstallCsv(bytes.buffer)).toBe(text);
  });
});

describe("parseInstallCsv", () => {
  it("boyutsuz dosyada en güncel satırdaki kümülatif kurulum sayısını okur", () => {
    const csv = [
      "Date,Package Name,Daily Device Installs,Total User Installs",
      "2026-11-18,online.uygulamamcebimde.app,2,40",
      "2026-11-19,online.uygulamamcebimde.app,1,41",
      "2026-11-20,online.uygulamamcebimde.app,3,44",
    ].join("\n");
    const result = parseInstallCsv(csv);
    expect(result.totalInstalls).toBe(44);
    expect(result.periodInstalls).toBe(6);
    expect(result.lastDate).toBe("2026-11-20");
  });

  it("ülke boyutlu dosyada en güncel tarihteki tüm ülkelerin toplamını verir", () => {
    const csv = [
      "Date,Package Name,Daily Device Installs,Total User Installs,Country",
      "2026-11-19,online.uygulamamcebimde.app,2,30,TR",
      "2026-11-19,online.uygulamamcebimde.app,1,10,DE",
      "2026-11-20,online.uygulamamcebimde.app,3,33,TR",
      "2026-11-20,online.uygulamamcebimde.app,2,12,DE",
    ].join("\n");
    const result = parseInstallCsv(csv);
    // En güncel tarih 2026-11-20: 33 (TR) + 12 (DE) = 45.
    expect(result.totalInstalls).toBe(45);
    // Dönem toplamı tüm satırlar: 2+1+3+2 = 8.
    expect(result.periodInstalls).toBe(8);
    expect(result.lastDate).toBe("2026-11-20");
  });

  it("en güncel günün kümülatif hücresi boşsa bir önceki dolu güne düşer (YAŞANDI: panelde yanlışlıkla 0 görünüyordu)", () => {
    const csv = [
      "Date,Package Name,Daily Device Installs,Total User Installs",
      "2026-11-18,online.uygulamamcebimde.app,2,40",
      "2026-11-19,online.uygulamamcebimde.app,1,41",
      // Play en güncel günün kümülatif sütununu henüz doldurmamış: hücre boş.
      "2026-11-20,online.uygulamamcebimde.app,3,",
    ].join("\n");
    const result = parseInstallCsv(csv);
    expect(result.totalInstalls).toBe(41);
    expect(result.lastDate).toBe("2026-11-19");
    // Dönem toplamı yine tüm günleri kapsar, boş hücre 0 sayılır.
    expect(result.periodInstalls).toBe(6);
  });

  it("boş hücre Number('')===0 yüzünden sahte sıfır üretmez", () => {
    const csv = [
      "Date,Package Name,Total User Installs",
      "2026-11-20,online.uygulamamcebimde.app,",
    ].join("\n");
    const result = parseInstallCsv(csv);
    expect(result.totalInstalls).toBeNull();
    expect(result.lastDate).toBe("2026-11-20");
  });

  it("beklenen sütunlar yoksa null döner, çökmez", () => {
    const csv = "Something,Else\n1,2";
    const result = parseInstallCsv(csv);
    expect(result.totalInstalls).toBeNull();
    expect(result.periodInstalls).toBeNull();
  });

  it("boş metinde çökmez", () => {
    const result = parseInstallCsv("");
    expect(result).toEqual({
      totalInstalls: null,
      periodInstalls: null,
      lastDate: null,
      columns: [],
    });
  });
});
