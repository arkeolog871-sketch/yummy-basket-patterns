import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function codeOnly(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Sıra `position` değerlerinin takasıyla yürüyordu. Değerler benzersiz
 * olmadığında (üretimde yedi kategori birden position=0) takas 0 ile 0'ı yer
 * değiştirip hiçbir şey yapmıyor, eşitlikte Postgres sırayı garanti etmediği
 * için liste her sorguda başka türlü diziliyordu.
 */
describe("kategori sıralaması", () => {
  const taxonomy = codeOnly("src/lib/taxonomy.functions.ts");
  const hook = codeOnly("src/hooks/useTaxonomy.tsx");
  const panel = codeOnly("src/components/founder/CategoryPanel.tsx");

  it("konum değerlerini takas etmiyor", () => {
    expect(taxonomy).not.toContain("position: target.position");
    expect(taxonomy).not.toContain("position: current.position");
  });

  it("listeyi yeniden dizip 0..n-1 konum yazıyor", () => {
    const fn = taxonomy.slice(taxonomy.indexOf("export const moveCategory"));
    expect(fn).toContain("reordered.splice(index, 1)");
    expect(fn).toContain("reordered.splice(targetIndex, 0, moved!)");
    expect(fn).toContain("update({ position: order })");
  });

  it("yalnızca konumu değişen satırları yazıyor", () => {
    const fn = taxonomy.slice(taxonomy.indexOf("export const moveCategory"));
    expect(fn).toContain("row.position !== order");
  });

  /** Eşitlikte sıranın sorgudan sorguya değişmemesi için ikincil anahtar. */
  it("kategori sorgusunda kararlı ikincil sıralama var", () => {
    expect(taxonomy).toMatch(/\.order\("position"\)\s*\n?\s*\.order\("label"\)/);
    expect(hook).toMatch(/\.order\("position"\)\s*\n?\s*\.order\("label"\)/);
  });

  it("teslimat bölgesi sorgusunda da kararlı sıralama var", () => {
    expect(hook).toMatch(/\.order\("position"\)\s*\n?\s*\.order\("city"\)/);
  });

  it("yeni kategori listenin sonuna açılıyor", () => {
    expect(panel).toContain("function nextFormFor(count: number)");
    expect(panel).toContain("nextFormFor(categories.length)");
  });
});

describe("kategori ikonları", () => {
  const panel = codeOnly("src/components/founder/CategoryPanel.tsx");

  it("sektörlere göre gruplanmış", () => {
    expect(panel).toContain("ICON_GROUPS");
    for (const group of [
      "Zanaat ve teknik",
      "Ulaşım ve lojistik",
      "Teknoloji",
      "Tarım ve hayvancılık",
      "Kişisel bakım ve sağlık",
    ]) {
      expect(panel).toContain(group);
    }
  });

  /** Uygulamadaki gerçek kategoriler karşılıksız kalmamalı. */
  it("mevcut sektörlerin hepsine uygun ikon var", () => {
    for (const icon of ["Scissors", "Truck", "Wrench", "Flame", "Laptop", "PawPrint", "Store"]) {
      expect(panel).toContain(`"${icon}"`);
    }
  });

  it("tüm kütüphaneyi pakete gömmüyor", () => {
    expect(panel).not.toContain("import * as Icons");
  });
});
