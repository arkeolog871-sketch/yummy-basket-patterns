import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isSellableStock, planStockDecrement } from "@/lib/orders-stock";

const ROOT = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("isSellableStock", () => {
  it("stoğu biten ürünü satılabilir saymaz", () => {
    expect(isSellableStock(0)).toBe(false);
    expect(isSellableStock(-3)).toBe(false);
  });

  it("pozitif stoğu satılabilir sayar", () => {
    expect(isSellableStock(1)).toBe(true);
    expect(isSellableStock(999)).toBe(true);
  });

  it("sayı olmayan değeri sınırsız stok sayar", () => {
    expect(isSellableStock(null)).toBe(true);
    expect(isSellableStock(undefined)).toBe(true);
    expect(isSellableStock(Number.NaN)).toBe(true);
  });

  it("sipariş planlayıcısıyla aynı sonucu verir", () => {
    for (const stock of [0, 1, 5, null]) {
      const plan = planStockDecrement(stock, 1);
      expect(isSellableStock(stock)).toBe(plan.ok);
    }
  });
});

describe("vitrin stok durumu", () => {
  it("katalog sunucu fonksiyonu stok sayısını değil boole bayrağı döndürür", () => {
    const source = stripComments(read("src/lib/catalog.functions.ts"));
    expect(source).toContain("in_stock");
    expect(source).toContain("isSellableStock(row.stock_quantity)");
    // Vitrin sorgusu hâlâ stok kolonunu seçmiyor (anon rolüne kapalı).
    const publicSelect = source.match(/\.from\("menu_items"\)\s*\n\s*\.select\("([^"]+)"\)/);
    expect(publicSelect?.[1]).toBeDefined();
    expect(publicSelect?.[1]).not.toContain("stock_quantity");
  });

  it("tükenen ürün için sepete ekle düğmesi kapalı", () => {
    const source = stripComments(read("src/routes/restoran.$slug.tsx"));
    expect(source).toContain("item.in_stock === false");
    expect(source).toMatch(/disabled=\{!open \|\| item\.in_stock === false/);
    expect(source).toContain("Tükendi");
  });

  it("işletme paneli stok 0 iken 'Stokta var' yazmaz", () => {
    const source = stripComments(read("src/components/vendor/ProductPanel.tsx"));
    expect(source).not.toContain('"Stokta var"');
    expect(source).toContain("Tükendi — sipariş alınamaz");
  });
});
