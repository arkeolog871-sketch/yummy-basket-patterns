import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasListedPrice, PRICE_ON_REQUEST_LABEL } from "@/lib/format";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("fiyatı 0 olan ürün (fiyat sorulur)", () => {
  it("0, negatif ve geçersiz fiyat listelenmiş sayılmaz", () => {
    expect(hasListedPrice(0)).toBe(false);
    expect(hasListedPrice("0.00")).toBe(false);
    expect(hasListedPrice(-5)).toBe(false);
    expect(hasListedPrice(null)).toBe(false);
    expect(hasListedPrice("abc")).toBe(false);
    expect(hasListedPrice("2500.00")).toBe(true);
    expect(hasListedPrice(0.5)).toBe(true);
  });

  it("işletme sayfasında ₺0,00 yerine yazı gösterilir ve sepete ekleme kapalı", () => {
    const page = read("src/routes/restoran.$slug.tsx");
    expect(page).toContain("PRICE_ON_REQUEST_LABEL");
    expect(page).toMatch(/disabled=\{[^}]*!hasListedPrice\(item\.price\)/);
    expect(page).toContain("if (!hasListedPrice(item.price)) return;");
    expect(PRICE_ON_REQUEST_LABEL).toBe("Fiyat için arayın");
  });

  it("sunucu 0 fiyatlı ürünle siparişi RPC'den önce reddeder", () => {
    const src = read("src/lib/orders.functions.ts");
    const guard = src.indexOf('.lte("price", 0)');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(src.indexOf('supabase.rpc("place_customer_order"'));
  });

  it("asistan 0 fiyatlı ürünü sepete önermez", () => {
    expect(read("src/lib/ai-assistant.server.ts")).toContain('.gt("price", 0)');
  });
});
