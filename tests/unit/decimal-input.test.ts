import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDecimalInput } from "@/lib/decimal-input";

const ROOT = join(import.meta.dirname, "../..");

/**
 * Türkçe klavyede ondalık ayırıcı virgül. Kullanıcı enlemi "38,1502",
 * teslimat ücretini "10,50" yazınca Number() NaN üretiyordu ve başvuru
 * "Expected number, received nan" ile reddediliyordu -- İngilizce, hangi
 * alan olduğunu söylemeyen bir mesaj.
 */
describe("parseDecimalInput", () => {
  it("virgüllü ondalığı okur", () => {
    expect(parseDecimalInput("38,1502")).toBe(38.1502);
    expect(parseDecimalInput("10,50")).toBe(10.5);
  });

  it("noktalı ondalığı okur", () => {
    expect(parseDecimalInput("38.1502")).toBe(38.1502);
  });

  it("tam sayıyı ve negatifi okur", () => {
    expect(parseDecimalInput("30")).toBe(30);
    expect(parseDecimalInput("-41,0021")).toBe(-41.0021);
  });

  it("baştaki ve sondaki boşluğu yok sayar", () => {
    expect(parseDecimalInput("  38,15  ")).toBe(38.15);
  });

  it("boş değeri reddeder", () => {
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("   ")).toBeNull();
  });

  it("sayı olmayanı reddeder", () => {
    expect(parseDecimalInput("abc")).toBeNull();
    expect(parseDecimalInput("30 dk")).toBeNull();
  });

  /**
   * Google Maps'ten kopyalanan çift ("38.15, 40.99") sessizce ilk sayıya
   * indirgenmemeli: kullanıcı boylam kutusuna da aynı metni yapıştırırsa
   * işletme yanlış konuma düşerdi. Reddedip ne yazması gerektiğini söylemek
   * doğrusu.
   */
  it("yapıştırılmış koordinat çiftini reddeder", () => {
    expect(parseDecimalInput("38.1502, 40.9996")).toBeNull();
  });
});

describe("işletme başvurusu sayı alanları", () => {
  const route = readFileSync(join(ROOT, "src/routes/isletme-basvuru.tsx"), "utf8");
  const schema = readFileSync(join(ROOT, "src/lib/business-applications.functions.ts"), "utf8");

  it("ham Number() ile göndermiyor", () => {
    expect(route).not.toMatch(/Number\(form\.(latitude|longitude|delivery_|min_order)/);
    expect(route).toContain("parseDecimalInput");
  });

  it("okunamayan alanda isteği hiç göndermiyor", () => {
    expect(route).toContain("const numbers = readNumbers();");
    expect(route).toContain("if (!numbers) return;");
  });

  /** Formda beş sayı alanı var; hata hangisi olduğunu söylemeli. */
  it("hata mesajında alan adı geçiyor", () => {
    expect(route).toMatch(/\$\{field\.label\}/);
  });

  it("sunucu da Türkçe mesaj veriyor", () => {
    expect(schema).toContain("invalid_type_error");
    expect(schema).not.toMatch(/latitude: z\.number\(\)/);
  });
});
