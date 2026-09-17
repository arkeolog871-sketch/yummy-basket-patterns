import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const schema = readFileSync(join(ROOT, "src/lib/business-applications.functions.ts"), "utf8");
const form = readFileSync(join(ROOT, "src/routes/isletme-basvuru.tsx"), "utf8");

/**
 * Bir esnaf 160 karakterden uzun "Kısa tanıtım" yazınca Zod'un varsayılan
 * İngilizce mesajı ("String must contain at most 160 character(s)") kullanıcıya
 * sızıyordu. Serbest metin alanlarının hepsinde Türkçe, alan belirten mesaj
 * olmalı; hiçbir uzunluk sınırı mesajsız kalmamalı.
 */
describe("başvuru şeması Türkçe hata veriyor", () => {
  it("kısa tanıtım sınırı Türkçe mesaj taşıyor", () => {
    expect(schema).toContain('"Kısa tanıtım en fazla 160 karakter olabilir"');
  });

  it("serbest metin alanlarında mesajsız max kalmadı", () => {
    // Kullanıcının aşabileceği metin alanları: her .max(sayı) bir mesajla gelmeli.
    const textMaxes = [
      /\.max\(60, "Bağlantı adı/,
      /\.max\(80, "İşletme adı/,
      /\.max\(160, "Kısa tanıtım/,
      /\.max\(240, "Adres/,
      /\.max\(80, "İlçe/,
      /\.max\(80, "Şehir/,
      /\.max\(160, "E-posta/,
      /\.max\(120, "Yetkili/,
    ];
    for (const re of textMaxes) expect(schema).toMatch(re);
  });
});

/**
 * En iyi savunma, hatayı hiç almamak: form alanı 160 karakterde durmalı ve
 * kullanıcı kalan hakkı görmeli.
 */
describe("kısa tanıtım alanı sınırı gösteriyor", () => {
  it("girişte 160 karakter sınırı var", () => {
    expect(form).toContain("maxLength={160}");
    expect(form).toContain("value.slice(0, 160)");
  });

  it("karakter sayacı gösteriliyor", () => {
    expect(form).toContain("{form.tagline.length}/160");
  });
});
