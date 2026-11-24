import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUSINESS_CATEGORY_CATALOG,
  resolveExtraCatalogSectors,
} from "@/lib/business-category-catalog";

const ROOT = join(import.meta.dirname, "../..");
function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

/**
 * Kullanıcı isteği: bir işletme (ör. dönerci) aynı anda birden fazla ana
 * kategoride görünsün — hem kendi özel sektöründe (yemek) hem grubunun
 * doğal sektöründe (restoran).
 */
describe("resolveExtraCatalogSectors", () => {
  const LIVE_SECTORS = ["restoran", "yemek", "kafe", "market"];

  it("grubun kendi sektörü özel sektörden farklıysa onu döner (dönerci örneği)", () => {
    const donerci = BUSINESS_CATEGORY_CATALOG.find((entry) => entry.name === "Dönerci");
    expect(donerci).toBeDefined();
    expect(donerci!.sector_slug).toBe("yemek");
    expect(donerci!.group_sector_slug).toBe("restoran");
    expect(resolveExtraCatalogSectors(donerci!, LIVE_SECTORS)).toEqual(["restoran"]);
  });

  it("özel sektör yoksa (grupla aynıysa) ek sektör dönmez", () => {
    const restoran = BUSINESS_CATEGORY_CATALOG.find((entry) => entry.name === "Restoran");
    expect(restoran).toBeDefined();
    expect(restoran!.sector_slug).toBe("restoran");
    expect(restoran!.group_sector_slug).toBe("restoran");
    expect(resolveExtraCatalogSectors(restoran!, LIVE_SECTORS)).toEqual([]);
  });

  it("grubun sektörü geçerli bir ana kategori değilse ek sektör dönmez", () => {
    expect(
      resolveExtraCatalogSectors(
        { sector_slug: "yemek", group_name: "Yeme-İçme", group_sector_slug: "restoran" },
        ["yemek"],
      ),
    ).toEqual([]);
  });

  it("satırın kendi sektörü geçersiz (kaldırılmış) olsa bile grup sektörü denenir", () => {
    expect(
      resolveExtraCatalogSectors(
        {
          sector_slug: "kaldirilmis-sektor",
          group_name: "Yeme-İçme",
          group_sector_slug: "restoran",
        },
        ["restoran"],
      ),
    ).toEqual(["restoran"]);
  });
});

describe("restaurant_extra_sectors göçü", () => {
  const migration = read("supabase/migrations/20261124060000_restaurant_extra_sectors.sql");

  it("tablo herkese yalnız okunur, yazma yalnız servis rolüyle", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.restaurant_extra_sectors");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain(
      "GRANT SELECT ON public.restaurant_extra_sectors TO anon, authenticated;",
    );
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*TO (anon|authenticated)/);
  });

  it("geriye dönük doldurma mevcut işletmelerin kategorisine göre yapılıyor", () => {
    expect(migration).toContain(
      "JOIN public.business_category_catalog bcc ON bcc.name = r.category",
    );
    expect(migration).toContain("JOIN public.app_categories ac ON ac.slug = gd.default_sector");
  });
});

describe("işletme kaydı ek sektörleri senkronluyor", () => {
  it("saveBusiness (kurucu paneli) senkronu çağırıyor", () => {
    const source = read("src/lib/founder.functions.ts");
    expect(source).toContain('await import("./restaurant-extra-sectors.server")');
    expect(source).toContain("syncRestaurantExtraSectors(supabaseAdmin");
  });

  it("reviewBusinessApplication (başvuru onayı) senkronu çağırıyor", () => {
    const source = read("src/lib/business-applications.functions.ts");
    expect(source).toContain('await import("./restaurant-extra-sectors.server")');
    expect(source).toContain("syncRestaurantExtraSectors(supabaseAdmin");
  });

  it("ana sayfa filtresi ek sektörleri de eşleştiriyor", () => {
    const source = read("src/lib/catalog.functions.ts");
    expect(source).toContain('.from("restaurant_extra_sectors")');
    expect(source).toContain("query.or(");
  });
});
