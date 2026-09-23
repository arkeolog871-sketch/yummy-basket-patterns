import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assignCategoryColors,
  categoryColorCandidates,
  chipTint,
  contrastRatio,
  isReadableCategoryColor,
  MIN_CONTRAST,
  perceptualDistance,
  pickCategoryColor,
} from "@/lib/category-colors";

/**
 * Kategori renkleri otomatik ("en uzak renk", kullanıcı seçimi).
 *
 * ÖLÇÜLDÜ (elle seçimin sonucu, 23 Eylül 2026): 14 kategoriden üçü aynı
 * maviyi, ikişer tanesi aynı moru ve bordoyu paylaşıyordu; 12 kategorinin
 * çip yazısı 4.5:1'in altındaydı, Market 1.5:1.
 */
const minDistanceTo = (color: string, others: string[]) =>
  Math.min(...others.map((other) => perceptualDistance(color, other)));

describe("aday renkler", () => {
  it("her aday çipin iki hâlinde de okunaklı", () => {
    const candidates = categoryColorCandidates();
    expect(candidates.length).toBeGreaterThan(100);
    for (const { hex } of candidates) {
      expect(contrastRatio("#ffffff", hex), `${hex} beyaz yazı`).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
      expect(contrastRatio(hex, chipTint(hex)), `${hex} krem zemin`).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
    }
  });

  it("eski elle seçilmiş renklerin çoğu okunaklılık sınavından geçemezdi", () => {
    // Filtrenin gerçekten bir şey yaptığını gösterir.
    for (const legacy of ["#f2b705", "#0ea5e9", "#D9A544", "#ff8c42", "#2f9e6b"]) {
      expect(isReadableCategoryColor(legacy), legacy).toBe(false);
    }
  });
});

describe("en uzak renk seçimi", () => {
  it("hiç kategori yokken ilk aday seçilir", () => {
    expect(pickCategoryColor([])).toBe(categoryColorCandidates()[0]!.hex);
  });

  it("belirlenimci: aynı girdi hep aynı rengi verir", () => {
    const existing = ["#ac262a", "#0541a4", "#105b00"];
    expect(pickCategoryColor(existing)).toBe(pickCategoryColor([...existing]));
  });

  it("seçilen renk, mevcutlara en uzak adaydır", () => {
    const existing = assignCategoryColors(5);
    const chosen = pickCategoryColor(existing);
    const chosenScore = minDistanceTo(chosen, existing);
    for (const { hex } of categoryColorCandidates()) {
      expect(minDistanceTo(hex, existing)).toBeLessThanOrEqual(chosenScore + 1e-9);
    }
  });

  it("yeni kategori eklemek mevcut renkleri değiştirmez", () => {
    const fourteen = assignCategoryColors(14);
    const twenty = assignCategoryColors(20);
    expect(twenty.slice(0, 14)).toEqual(fourteen);
  });

  it("14 kategoride tekrar yok, hepsi okunaklı ve belirgin şekilde ayrışık", () => {
    const colors = assignCategoryColors(14);
    expect(new Set(colors).size).toBe(14);
    for (const color of colors) expect(isReadableCategoryColor(color), color).toBe(true);
    let nearest = Infinity;
    for (let i = 0; i < colors.length; i += 1) {
      for (let j = i + 1; j < colors.length; j += 1) {
        nearest = Math.min(nearest, perceptualDistance(colors[i]!, colors[j]!));
      }
    }
    // Göz ~0.02'den büyük farkı ayırt eder; 14 renkte en yakın çift bunun
    // en az üç katı.
    expect(nearest).toBeGreaterThan(0.06);
  });

  it("canlıdaki 14 kategori rengi birebir yeniden üretilir (renk kayması yok)", () => {
    // 23 Eylül 2026'da veritabanına yazılan değerler. Hesap kodu yeniden
    // düzenlense de mevcut kategorilerin rengi DEĞİŞMEMELİ.
    expect(assignCategoryColors(14)).toEqual([
      "#ac262a",
      "#0541a4",
      "#105b00",
      "#88379c",
      "#006d78",
      "#7c5a00",
      "#870155",
      "#7b3000",
      "#572999",
      "#504ebd",
      "#005074",
      "#564a00",
      "#0063a9",
      "#00584a",
    ]);
  });

  it("boş veya bozuk mevcut renkler yok sayılır", () => {
    expect(pickCategoryColor([null, undefined, "", "mavi", "#12"])).toBe(pickCategoryColor([]));
  });

  it("eski (elle seçilmiş) renkler varken de okunaklı ve farklı renk verir", () => {
    const legacy = ["#2563eb", "#2f9e6b", "#e63946", "#f2b705", "#0ea5e9", "#9d174d"];
    const chosen = pickCategoryColor(legacy);
    expect(isReadableCategoryColor(chosen)).toBe(true);
    expect(legacy).not.toContain(chosen);
  });
});

describe("elle renk seçme yolu kapalı", () => {
  it("kurucu panelinde kategori rengi seçme bölümü yok", () => {
    const panel = readFileSync("src/components/founder/AppearancePanel.tsx", "utf8");
    expect(panel).not.toContain("CategoryColorPanel");
    expect(panel).not.toContain("CATEGORY_COLOR_SUGGESTIONS");
  });

  it("sunucu istemciden renk kabul etmiyor, rengi kendisi atıyor", () => {
    const source = readFileSync("src/lib/taxonomy.functions.ts", "utf8");
    const schema = source.slice(
      source.indexOf("const categorySchema"),
      source.indexOf("const areaSchema"),
    );
    expect(schema).not.toMatch(/^\s*color:/m);
    expect(source).toContain("pickCategoryColor(");
  });
});
