import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

/**
 * Kullanıcı isteği: hiç ürün eklememiş işletmeler için teslimat süresi/
 * ücreti/min. sepet bilgisi gösterilmesin; hem anasayfada hem işletme
 * sayfasında "yerinde hizmet" yazsın — tıpkı elle işaretlenen onsite_only
 * gibi. Mantık: ürünü olmayan işletme zaten sipariş alamaz (sepete
 * eklenecek bir şey yok), teslimat bilgisi göstermek yanıltıcı olurdu.
 */
describe("ürün eklenmemiş işletme: yerinde hizmet gibi gösterilir", () => {
  const catalog = read("src/lib/catalog.functions.ts");
  const card = read("src/components/restaurant/RestaurantCard.tsx");
  const page = read("src/routes/restoran.$slug.tsx");

  it("anasayfa/liste sorgusu her işletme için ürün durumunu (has_products) hesaplıyor", () => {
    const start = catalog.indexOf("export const listRestaurants");
    const body = catalog.slice(start, catalog.indexOf("export const listCategories"));
    expect(body).toContain('.from("menu_items")');
    expect(body).toContain('.eq("is_available", true)');
    expect(body).toContain("has_products: withProducts.has(row.id)");
  });

  it("servis anahtarı yoksa (yerel/ön izleme) hiçbir işletmeyi ürünsüz saymıyor", () => {
    const start = catalog.indexOf("export const listRestaurants");
    const body = catalog.slice(start, catalog.indexOf("export const listCategories"));
    expect(body).toMatch(/catch[\s\S]*?withProducts\.add\(row\.id\)/);
  });

  it("işletme kartında onsite_only VE has_products:false aynı 'yerinde hizmet' davranışını tetikliyor", () => {
    expect(card).toContain("has_products?: boolean");
    expect(card).toContain(
      "const isOnsiteOnly = Boolean(restaurant.onsite_only) || restaurant.has_products === false;",
    );
    // Eski doğrudan onsite_only kontrolleri türetilmiş bayrağa taşınmış olmalı.
    expect(card).not.toMatch(/restaurant\.onsite_only \?/);
  });

  it("işletme sayfasında ürün listesi boşsa da aynı türetilmiş bayrak kullanılıyor", () => {
    const start = page.indexOf("const isOnsiteOnly =");
    expect(start).toBeGreaterThan(-1);
    const line = page.slice(start, page.indexOf("\n", start));
    expect(line).toContain("Boolean(restaurant.onsite_only)");
    expect(line).toContain("items.length === 0");
    // Sepete ekleme, banner ve "Sepetim" alanı artık bu bayrağı kullanıyor.
    expect(page).toContain("if (isOnsiteOnly) {");
    expect(page).toContain("isOnsiteOnly ||");
    // restaurant.onsite_only yalnızca türetilen bayrağın tanımında geçmeli;
    // görüntüleme/engelleme kontrolleri hepsi isOnsiteOnly kullanmalı.
    expect(page).not.toMatch(/restaurant\.onsite_only \?/);
    expect(page.match(/restaurant\.onsite_only/g)).toEqual(["restaurant.onsite_only"]);
  });
});
