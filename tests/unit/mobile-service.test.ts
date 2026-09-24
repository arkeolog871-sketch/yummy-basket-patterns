import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applicationSchema } from "@/lib/business-applications.functions";
import { buildMapsUrl, hasDirections, resolveBusinessCoords } from "@/lib/maps";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

const base = {
  slug: "ornek-usta",
  name: "Örnek Usta",
  tagline: "Her türlü tesisat işi",
  category: "Su tesisatçısı",
  sector: "tesisat",
  cuisines: [],
  delivery_minutes: 30,
  delivery_fee: 0,
  min_order: 0,
  cover_image_url: null,
  district: "Silvan",
  city: "Diyarbakır",
  contact_email: "usta@example.com",
  contact_phone: "0555 555 55 55",
  contact_person: "Ali Veli",
  opens_at: "09:00",
  closes_at: "18:00",
  is_open_manual: true,
};

describe("iş yeri olmayan işletme başvurusu", () => {
  it("iş yeri yoksa açık adres ve harita konumu istenmez", () => {
    const parsed = applicationSchema.parse({ ...base, mobile_service: true });
    expect(parsed.mobile_service).toBe(true);
    expect(parsed.address).toBeNull();
    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  it("iş yeri yoksa gönderilen konum yine de kaydedilmez (yanlış nokta kalmasın)", () => {
    const parsed = applicationSchema.parse({
      ...base,
      mobile_service: true,
      address: "Bir sokak no 1",
      latitude: 38.1,
      longitude: 41,
      maps_url: "https://maps.app.goo.gl/x",
    });
    expect([parsed.address, parsed.latitude, parsed.longitude, parsed.maps_url]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    // Hizmet bölgesi korunur.
    expect([parsed.district, parsed.city]).toEqual(["Silvan", "Diyarbakır"]);
  });

  it("iş yeri varsa adres ve konum eskisi gibi zorunlu", () => {
    const result = applicationSchema.safeParse({ ...base, mobile_service: false });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("Açık adres girin");
    expect(messages).toContain("Haritadan işletmenizin konumunu işaretleyin");
  });

  it("eski istemci (alan göndermeyen) iş yeri var sayılır ve konum ister", () => {
    expect(applicationSchema.safeParse(base).success).toBe(false);
    const ok = applicationSchema.parse({
      ...base,
      address: "Bağlar mahallesi 12",
      latitude: 38.148,
      longitude: 41.006,
    });
    expect(ok.mobile_service).toBe(false);
    expect(ok.latitude).toBe(38.148);
  });

  it("ilçe ve şehir her iki durumda da zorunlu", () => {
    expect(
      applicationSchema.safeParse({ ...base, mobile_service: true, district: "" }).success,
    ).toBe(false);
  });
});

describe("müşteri tarafı", () => {
  it("iş yeri olmayan işletmeye yol tarifi yok, haritada nokta yok (eski koordinat kalmış olsa bile)", () => {
    const business = {
      name: "Örnek Usta",
      district: "Silvan",
      city: "Diyarbakır",
      latitude: 38.1,
      longitude: 41,
      mobile_service: true,
    };
    expect(buildMapsUrl(business)).toBeNull();
    expect(hasDirections(business)).toBe(false);
    expect(resolveBusinessCoords(business)).toBeNull();
  });

  it("kartta ve sayfada 'Adrese gelir' yazıyor", () => {
    expect(read("src/components/business/LocationButton.tsx")).toContain("MOBILE_SERVICE_LABEL");
    expect(read("src/lib/maps.ts")).toContain('MOBILE_SERVICE_LABEL = "Adrese gelir"');
    expect(read("src/components/business/BusinessMap.tsx")).toContain(
      "müşterinin adresine giderek hizmet veriyor",
    );
  });
});

describe("form ve veritabanı", () => {
  it("başvuru formunda harita altında 'İş yerim yok' seçeneği; seçilince harita pasif", () => {
    const form = read("src/routes/isletme-basvuru.tsx");
    expect(form).toContain("İş yerim yok");
    expect(form).toContain("inert={form.mobile_service || undefined}");
    expect(form).toContain("address: form.mobile_service ? null : form.address.trim(),");
    const checkbox = form.indexOf('<span className="font-medium">İş yerim yok</span>');
    expect(checkbox).toBeGreaterThan(-1);
    expect(form.indexOf("<LocationPicker")).toBeLessThan(checkbox);
  });

  it("yönetici paneli aynı seçeneği taşıyor, sunucu konumu temizliyor", () => {
    expect(read("src/routes/kurucu.tsx")).toContain("mobile_service: form.mobile_service,");
    const server = read("src/lib/founder.functions.ts");
    expect(server).toContain("mobile_service: z.boolean().default(false)");
    expect(server).toMatch(/if \(values\.mobile_service\) \{[\s\S]*values\.latitude = null;/);
  });

  it("başvuru onaylanınca bilgi işletmeye aktarılıyor", () => {
    expect(read("src/lib/business-applications.functions.ts")).toContain(
      "mobile_service: application.mobile_service,",
    );
  });

  it("göç: mevcut kayıtlar 'iş yeri var', iş yeri olan başvuruda konum veritabanında da zorunlu", () => {
    const sql = read("supabase/migrations/20260924200000_mobile_service.sql");
    expect(sql).toContain("mobile_service boolean NOT NULL DEFAULT false");
    expect(sql).toContain(
      "CHECK (mobile_service OR (address IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL))",
    );
    expect(sql).toContain(
      "GRANT SELECT (mobile_service) ON public.restaurants TO anon, authenticated;",
    );
  });
});
