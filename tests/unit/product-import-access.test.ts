import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importAccessPath } from "@/lib/product-import";

const MARKET = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";

describe("toplu aktarımda yetki yolu", () => {
  it("işletme kendi işletmesini hedeflerse kendi yolundan geçer", () => {
    expect(importAccessPath(MARKET, MARKET)).toBe("own");
  });

  it("vendor kaydı tutmuyorsa panel kontrolüne düşer, doğrudan reddetmez", () => {
    // Yaşanmış hata: kurucu hesabının da bir vendor_assignments kaydı var
    // ("Simpil çiftliği"). Eşleşmeyince hemen "Forbidden" atıldığı için kurucu
    // başka bir markete 5.000 ürünlük listeyi yükleyemiyordu.
    expect(importAccessPath(OTHER, MARKET)).toBe("panel");
  });

  it("hiç vendor kaydı olmayan hesap da panel kontrolüne düşer", () => {
    expect(importAccessPath(null, MARKET)).toBe("panel");
    expect(importAccessPath(undefined, MARKET)).toBe("panel");
    expect(importAccessPath("", MARKET)).toBe("panel");
  });
});

describe("aktarım sunucu fonksiyonu", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/product-import.functions.ts"), "utf8");

  it("panel kontrolünden önce vendor eşleşmesine bakıp Forbidden atmaz", () => {
    expect(source).not.toMatch(/ownRestaurantId !== restaurantId/);
  });

  it("her iki sunucu fonksiyonu da yetkiyi doğrular", () => {
    const calls = source.match(/await assertImportAccess\(/g) ?? [];
    expect(calls.length).toBe(2);
  });

  it("restaurantId panel yolunda kapsam kontrolünden geçer", () => {
    expect(source).toMatch(/assertRestaurantInScope\(access, restaurantId\)/);
  });
});
