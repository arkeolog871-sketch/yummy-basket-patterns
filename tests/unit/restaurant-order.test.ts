import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const founderFns = read("src/lib/founder.functions.ts");
const catalog = read("src/lib/catalog.functions.ts");
const kurucu = read("src/routes/kurucu.tsx");

/**
 * İşletme sıralaması: sahip her işletmeyi, sayfa yöneticisi yalnızca kendi
 * bölgesindeki işletmeleri taşıyabilir. Yetki iki katmanda da uygulanmalı.
 */
describe("işletme sıralama yetkisi", () => {
  it("moveRestaurant panel erişimi ve bölge doğruluyor", () => {
    const start = founderFns.indexOf("export const moveRestaurant");
    expect(start).toBeGreaterThan(-1);
    const body = founderFns.slice(
      start,
      founderFns.indexOf("export const updateOrderStatus", start),
    );
    expect(body).toContain("assertPanelAccess");
    expect(body).toContain("accessAllowsRegion");
    // Kapsam dışı işletme reddedilmeli.
    expect(body).toContain("Forbidden");
  });

  it("değer takası değil yeniden numaralandırma yapıyor", () => {
    const start = founderFns.indexOf("export const moveRestaurant");
    const body = founderFns.slice(
      start,
      founderFns.indexOf("export const updateOrderStatus", start),
    );
    expect(body).toContain("splice");
    expect(body).toContain("display_order: order");
    // Yalnızca sırası değişen satırlar yazılır.
    expect(body).toContain("row.display_order !== order");
  });
});

/**
 * Elle sıralananlar önce (NULL en sona), sonra puana göre — hem müşteri
 * listesinde hem panelde aynı sıra kullanılmalı ki taşıma sezgisel olsun.
 */
describe("işletme listeleme sırası", () => {
  it("genel katalog display_order NULLS LAST kullanıyor", () => {
    const occurrences = catalog.match(
      /display_order",\s*\{ ascending: true, nullsFirst: false \}/g,
    );
    // Ana sorgu + aksana duyarsız yedek sorgu: iki yerde de.
    expect(occurrences?.length).toBe(2);
  });

  it("panel de aynı etkin sırayı gösteriyor", () => {
    expect(founderFns).toContain('.order("display_order", { ascending: true, nullsFirst: false })');
  });
});

describe("işletme sıralama arayüzü", () => {
  it("panelde yukarı/aşağı düğmeleri var", () => {
    expect(kurucu).toContain("moveRestaurant");
    expect(kurucu).toContain('aria-label="Yukarı taşı"');
    expect(kurucu).toContain('aria-label="Aşağı taşı"');
  });

  it("arama açıkken sıralama gizleniyor", () => {
    // Filtrelenmiş listede taşıma yanıltıcı olurdu.
    expect(kurucu).toContain("canReorder");
    expect(kurucu).toContain("search.trim().length === 0");
  });
});

describe("sıra sütunu göçü", () => {
  it("migration dosyası mevcut", () => {
    expect(
      existsSync(join(ROOT, "supabase/migrations/20260917130000_restaurants_display_order.sql")),
    ).toBe(true);
  });
});

/**
 * Bu tablo sütun bazlı yetki kullanıyor (stock_quantity anon'dan çekili).
 * display_order eklenince anon'a SELECT verilmezse, halka açık katalog o
 * sütuna göre sıralarken izin hatası alıp BOŞ liste döndürüyordu. Migration
 * yetkiyi vermeli.
 */
describe("display_order anon'a açık", () => {
  it("migration display_order için SELECT grant içeriyor", () => {
    const mig = read("supabase/migrations/20260917130000_restaurants_display_order.sql");
    expect(mig).toMatch(
      /grant select \(display_order\) on public\.restaurants to anon, authenticated/i,
    );
  });
});
