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
 * Kullanıcı geri bildirimi: ilk sürüm grubun kendi varsayılan sektörünü
 * ("Yeme-İçme" → restoran) otomatik ek sektör sayıyordu; bu yüzden dönerci,
 * büfe gibi "yemek" alt türleri yanlışlıkla "Restoran" filtresine de
 * giriyordu. Doğrusu: ek sektör elle, tek tek seçilir (satırdaki
 * extraSectors). "Restoran" kendi kategorisinde kalır, AYRICA "Yemek"te de
 * görünür; "Dönerci" (zaten "yemek") "Restoran"a sızmaz; "Büfe ve tostçu"
 * hem "Market" hem "Yemek"te görünür; "Kadın kuaförü"/"Berber" "Kişisel
 * bakım"da da görünür.
 */
describe("resolveExtraCatalogSectors", () => {
  const LIVE_SECTORS = ["restoran", "yemek", "kafe", "market", "kisisel-bakim"];

  it("Restoran kendi kategorisinde kalır, ayrıca Yemek'te de görünür", () => {
    const restoran = BUSINESS_CATEGORY_CATALOG.find((entry) => entry.name === "Restoran");
    expect(restoran).toBeDefined();
    expect(restoran!.sector_slug).toBe("restoran");
    expect(resolveExtraCatalogSectors(restoran!, LIVE_SECTORS)).toEqual(["yemek"]);
  });

  it("Dönerci zaten Yemek olduğundan Restoran'a sızmaz", () => {
    const donerci = BUSINESS_CATEGORY_CATALOG.find((entry) => entry.name === "Dönerci");
    expect(donerci).toBeDefined();
    expect(donerci!.sector_slug).toBe("yemek");
    expect(resolveExtraCatalogSectors(donerci!, LIVE_SECTORS)).toEqual([]);
  });

  it("Büfe ve tostçu hem Market hem Yemek'te görünür", () => {
    const bufe = BUSINESS_CATEGORY_CATALOG.find((entry) => entry.name === "Büfe ve tostçu");
    expect(bufe).toBeDefined();
    expect(bufe!.sector_slug).toBe("yemek");
    expect(resolveExtraCatalogSectors(bufe!, LIVE_SECTORS)).toEqual(["market"]);
  });

  it("Kadın kuaförü ve Berber Kişisel bakım'da da görünür", () => {
    const kadinKuaforu = BUSINESS_CATEGORY_CATALOG.find((entry) => entry.name === "Kadın kuaförü");
    const berber = BUSINESS_CATEGORY_CATALOG.find((entry) => entry.name === "Berber");
    expect(resolveExtraCatalogSectors(kadinKuaforu!, LIVE_SECTORS)).toEqual(["kisisel-bakim"]);
    expect(resolveExtraCatalogSectors(berber!, LIVE_SECTORS)).toEqual(["kisisel-bakim"]);
  });

  it("extraSectors işaretlenmemiş bir alt tür ek sektör döndürmez", () => {
    const pideci = BUSINESS_CATEGORY_CATALOG.find((entry) => entry.name === "Pide ve lahmacun");
    expect(pideci).toBeDefined();
    expect(resolveExtraCatalogSectors(pideci!, LIVE_SECTORS)).toEqual([]);
  });

  it("ek sektör birincil sektörle aynıysa veya geçerli değilse dönmez", () => {
    expect(
      resolveExtraCatalogSectors(
        { sector_slug: "yemek", group_name: "Yeme-İçme", extra_sector_slugs: ["yemek"] },
        ["yemek"],
      ),
    ).toEqual([]);
    expect(
      resolveExtraCatalogSectors(
        { sector_slug: "restoran", group_name: "Yeme-İçme", extra_sector_slugs: ["kaldirilmis"] },
        ["restoran"],
      ),
    ).toEqual([]);
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
});

describe("restaurant_extra_sectors_fix göçü (yanlış grup-varsayılanı düzeltmesi)", () => {
  const fix = read("supabase/migrations/20261124090000_restaurant_extra_sectors_fix.sql");

  it("eski (yanlış) satırları temizleyip elle seçilmiş eşlemeyi yazıyor", () => {
    expect(fix).toContain("DELETE FROM public.restaurant_extra_sectors;");
    expect(fix).toContain("('Restoran', 'yemek')");
    expect(fix).toContain("('Büfe ve tostçu', 'market')");
    expect(fix).toContain("('Kadın kuaförü', 'kisisel-bakim')");
    expect(fix).toContain("('Berber', 'kisisel-bakim')");
    // Dönerci/Pideci gibi zaten "yemek" olan alt türler haritada yok;
    // "Restoran" filtresine sızmamalılar.
    expect(fix).not.toContain("('Dönerci'");
    expect(fix).not.toContain("('Pide ve lahmacun'");
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
