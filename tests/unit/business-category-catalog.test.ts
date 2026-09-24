import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUSINESS_CATEGORY_CATALOG,
  BUSINESS_CATEGORY_GROUPS,
  resolveCatalogSector,
} from "@/lib/business-category-catalog";
import { businessCategorySeedSql } from "@/lib/business-category-seed";
import { findExactCategory, searchCategories } from "@/lib/category-search";
import { foldSearchText } from "@/lib/catalog-search";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

/** Canlıdaki 14 ana kategori (app_categories.slug, 24.09.2026). */
const LIVE_SECTORS = [
  "kafe",
  "restoran",
  "yemek",
  "market",
  "giyim",
  "berber",
  "kisisel-bakim",
  "sac-bakimi",
  "nakliye",
  "tesisat",
  "kaynak-ustasi",
  "hayvancilik",
  "eglence",
  "bilisim-ve-teknoloji",
];

const top = (query: string) => searchCategories(BUSINESS_CATEGORY_CATALOG, query, 5)[0]?.entry.name;
const names = (query: string, limit = 8) =>
  searchCategories(BUSINESS_CATEGORY_CATALOG, query, limit).map((hit) => hit.entry.name);

describe("işletme kategori kataloğu", () => {
  it("en az 300 kategori, geniş alan kapsamı", () => {
    expect(BUSINESS_CATEGORY_CATALOG.length).toBeGreaterThanOrEqual(300);
    for (const area of [
      "Market ve Gıda",
      "Yeme-İçme",
      "Giyim ve Moda",
      "Otomotiv",
      "Teknik Servis ve Onarım",
      "Sağlık",
      "Eğitim",
      "Güzellik ve Kişisel Bakım",
      "Ulaşım ve Seyahat",
      "Konaklama",
    ]) {
      expect(BUSINESS_CATEGORY_GROUPS).toContain(area);
    }
  });

  it("tekrar yok: slug ve ad (aksan/büyük harf farkı yok sayılarak) tekil", () => {
    const slugs = BUSINESS_CATEGORY_CATALOG.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const folded = BUSINESS_CATEGORY_CATALOG.map((entry) => foldSearchText(entry.name));
    expect(new Set(folded).size).toBe(folded.length);
  });

  it("bir kategorinin eş anlamlısı başka bir kategorinin adı değil (birleştirilmiş)", () => {
    const byName = new Map(
      BUSINESS_CATEGORY_CATALOG.map((entry) => [foldSearchText(entry.name), entry.name]),
    );
    const clashes = BUSINESS_CATEGORY_CATALOG.flatMap((entry) =>
      entry.synonyms
        .map((synonym) => byName.get(foldSearchText(synonym)))
        .filter((other): other is string => Boolean(other) && other !== entry.name)
        .map((other) => `${entry.name} ↔ ${other}`),
    );
    expect(clashes).toEqual([]);
  });

  it("hiçbir kategorinin eş anlamlısı kendi adı değil", () => {
    const self = BUSINESS_CATEGORY_CATALOG.flatMap((entry) =>
      entry.synonyms
        .filter((synonym) => foldSearchText(synonym) === foldSearchText(entry.name))
        .map((synonym) => `${entry.name} → ${synonym}`),
    );
    expect(self).toEqual([]);
  });

  it("adlar kayıt kurallarına uyuyor (2–40 karakter: başvuru ve panel sınırı)", () => {
    for (const entry of BUSINESS_CATEGORY_CATALOG) {
      expect(entry.name.length, entry.name).toBeGreaterThanOrEqual(2);
      expect(entry.name.length, entry.name).toBeLessThanOrEqual(40);
      expect(entry.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("ana kategori bağlantıları yalnız mevcut 14 kategoriye (yeni ana kategori açılmadı)", () => {
    for (const entry of BUSINESS_CATEGORY_CATALOG) {
      if (entry.sector_slug) expect(LIVE_SECTORS, entry.name).toContain(entry.sector_slug);
    }
    // Her mevcut ana kategorinin en az bir alt türü var.
    for (const sector of LIVE_SECTORS) {
      expect(
        BUSINESS_CATEGORY_CATALOG.some((entry) => entry.sector_slug === sector),
        sector,
      ).toBe(true);
    }
  });

  it("canlıdaki işletmelerin alt türleri katalogdan bulunuyor", () => {
    expect(top("Kahve")).toBe("Kahveci");
    expect(top("kuaför")).toBe("Kadın kuaförü");
    expect(names("Nakliye", 3)).toContain("Şehir içi nakliye");
    expect(top("hindi")).toBe("Kanatlı çiftliği");
  });
});

describe("kategori arama motoru", () => {
  it("adın tamamı ya da başı", () => {
    expect(top("kasap")).toBe("Kasap");
    expect(top("kas")).toBe("Kasap");
    expect(top("eczane")).toBe("Eczane");
    expect(top("su")).toBe("Su bayii");
  });

  it("eş anlamlı ve yakın anlamlı ifadeler", () => {
    expect(top("dişçi")).toBe("Diş kliniği");
    expect(top("diş hekimi")).toBe("Diş kliniği");
    expect(top("diş doktoru")).toBe("Diş kliniği");
    expect(top("keratin")).toBe("Kadın kuaförü");
    expect(top("nalbur")).toBe("Hırdavat");
    expect(top("ehliyet")).toBe("Sürücü kursu");
    expect(top("araba tamiri")).toBe("Oto tamir servisi");
    expect(top("araç yıkama")).toBe("Oto yıkama");
    expect(top("muhasebe")).toBe("Mali müşavir");
  });

  it("yazım farkları: aksansız, hatalı, ekli yazım", () => {
    expect(top("kuafor")).toBe("Kadın kuaförü");
    expect(top("kahvalti")).toBe("Kahvaltı salonu");
    expect(top("berbr")).toBe("Berber");
    expect(top("elektirikçi")).toBe("Elektrikçi");
    expect(top("veterinr")).toBe("Veteriner");
    expect(names("kuaförler")).toContain("Kadın kuaförü");
  });

  it("fazladan kelime aramayı bozmuyor", () => {
    expect(top("kuaför salonu")).toBe("Kadın kuaförü");
    expect(top("berber dükkanı")).toBe("Berber");
    expect(top("ucuz kasap")).toBe("Kasap");
  });

  it("alakasız sonuç göstermiyor", () => {
    expect(names("kasap")).toEqual(["Kasap"]);
    expect(names("emlak")).toEqual(["Emlakçı"]);
    expect(names("kırtasiye")).toEqual(["Kırtasiye"]);
    expect(names("xyzq")).toEqual([]);
    expect(names("")).toEqual([]);
  });

  it("grup adıyla arama o alanın kategorilerini getiriyor", () => {
    const hits = names("otomotiv", 12);
    expect(hits.length).toBeGreaterThan(5);
    expect(hits).toContain("Oto tamir servisi");
  });

  it("anlık: 400 kategoride ortalama arama 5 ms'nin altında", () => {
    const queries = ["k", "ka", "kas", "kasap", "kuafor", "oto yıkama", "elektirikçi", "xyzq"];
    searchCategories(BUSINESS_CATEGORY_CATALOG, "ısınma");
    const started = performance.now();
    for (let i = 0; i < 400; i++) searchCategories(BUSINESS_CATEGORY_CATALOG, queries[i % 8]!);
    expect((performance.now() - started) / 400).toBeLessThan(5);
  });

  it("tam ad eşleşmesi aksan ve büyük harf duyarsız", () => {
    expect(findExactCategory(BUSINESS_CATEGORY_CATALOG, "KADIN KUAFÖRÜ")?.slug).toBe(
      "kadin-kuaforu",
    );
    expect(findExactCategory(BUSINESS_CATEGORY_CATALOG, "Kahve, pasta")).toBeNull();
  });
});

describe("ana kategori eşleşmesi", () => {
  it("kayıttaki ana kategori etkinse o seçilir", () => {
    expect(
      resolveCatalogSector({ sector_slug: "berber", group_name: "Güzellik" }, LIVE_SECTORS),
    ).toBe("berber");
  });

  it("ana kategori yoksa grup adıyla eşleşir, o da yoksa seçim değişmez (null)", () => {
    const entry = { sector_slug: null, group_name: "Otomotiv" };
    expect(resolveCatalogSector(entry, LIVE_SECTORS)).toBeNull();
    expect(resolveCatalogSector(entry, [...LIVE_SECTORS, "otomotiv"])).toBe("otomotiv");
  });

  it("gizlenmiş ana kategori seçilmez", () => {
    expect(
      resolveCatalogSector(
        { sector_slug: "berber", group_name: "Güzellik" },
        LIVE_SECTORS.filter((slug) => slug !== "berber"),
      ),
    ).toBeNull();
  });
});

describe("merkezi veritabanı ve sayfalar", () => {
  const migration = read("supabase/migrations/20260924150000_business_category_catalog.sql");

  it("göç dosyası kataloğun bugünkü hâliyle aynı", () => {
    expect(migration).toContain(businessCategorySeedSql(BUSINESS_CATEGORY_CATALOG));
  });

  it("tablo herkese yalnız okunur; mevcut kategori tablosuna dokunulmuyor", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FOR SELECT");
    expect(migration).toContain(
      "GRANT SELECT ON public.business_category_catalog TO anon, authenticated;",
    );
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*TO (anon|authenticated)/);
    expect(migration).not.toMatch(
      /app_categories\s*(SET|ADD|DROP|RENAME)|(ALTER|DROP|DELETE FROM|UPDATE)\s+(TABLE\s+)?public\.app_categories/i,
    );
  });

  it("başvuru sayfası ve yönetici paneli aynı katalog ve aynı arama kutusunu kullanıyor", () => {
    for (const path of ["src/routes/isletme-basvuru.tsx", "src/routes/kurucu.tsx"]) {
      const source = read(path);
      expect(source, path).toContain("useBusinessCategoryCatalog()");
      expect(source, path).toContain("<CategorySearchField");
      expect(source, path).toContain("resolveCatalogSector(");
    }
  });

  it("alt tür hâlâ serbest metin olarak gönderiliyor (geriye dönük uyum)", () => {
    expect(read("src/routes/isletme-basvuru.tsx")).toContain("category: form.category.trim(),");
    expect(read("src/routes/kurucu.tsx")).toContain('category: form.category || "Genel",');
  });
});
