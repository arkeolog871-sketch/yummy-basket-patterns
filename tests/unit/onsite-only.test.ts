import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applicationSchema } from "@/lib/business-applications.functions";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

const base = {
  slug: "ornek-oto-yikama",
  name: "Örnek Oto Yıkama",
  tagline: "Detaylı araç yıkama",
  category: "Oto yıkama",
  sector: "oto-yikama",
  cuisines: [],
  delivery_minutes: 30,
  delivery_fee: 50,
  min_order: 100,
  cover_image_url: null,
  district: "Silvan",
  city: "Diyarbakır",
  contact_email: "yikama@example.com",
  contact_phone: "0555 555 55 55",
  contact_person: "Ali Veli",
  opens_at: "09:00",
  closes_at: "18:00",
  is_open_manual: true,
  address: "Bağlar mahallesi 12",
  latitude: 38.148,
  longitude: 41.006,
};

describe("yerinde hizmet başvurusu", () => {
  it("yerinde hizmet seçilince teslimat ücreti ve min. sepet 0'a sabitlenir", () => {
    const parsed = applicationSchema.parse({
      ...base,
      onsite_only: true,
      delivery_fee: 50,
      min_order: 100,
    });
    expect(parsed.onsite_only).toBe(true);
    expect(parsed.delivery_fee).toBe(0);
    expect(parsed.min_order).toBe(0);
  });

  it("yerinde hizmet değilse teslimat ücreti ve min. sepet gönderildiği gibi kalır", () => {
    const parsed = applicationSchema.parse({ ...base, onsite_only: false });
    expect(parsed.onsite_only).toBe(false);
    expect(parsed.delivery_fee).toBe(50);
    expect(parsed.min_order).toBe(100);
  });

  it("eski istemci (alan göndermeyen) yerinde hizmet olmayan sayılır", () => {
    const parsed = applicationSchema.parse(base);
    expect(parsed.onsite_only).toBe(false);
  });
});

describe("form ve veritabanı", () => {
  it("başvuru formunda 'Yerinde hizmet' çentiği teslimat ücreti alanının hemen üstünde", () => {
    const form = read("src/routes/isletme-basvuru.tsx");
    const switchIndex = form.indexOf('<span className="font-medium">Yerinde hizmet</span>');
    const deliveryFeeIndex = form.indexOf("<Label>Teslimat ücreti</Label>");
    expect(switchIndex).toBeGreaterThan(-1);
    expect(deliveryFeeIndex).toBeGreaterThan(-1);
    expect(switchIndex).toBeLessThan(deliveryFeeIndex);
    expect(form).toContain("disabled={form.onsite_only}");
    expect(form).toContain("required={!form.onsite_only}");
  });

  it("yönetici paneli aynı seçeneği taşıyor, sunucu teslimat ücretini sıfırlıyor", () => {
    const panel = read("src/routes/kurucu.tsx");
    expect(panel).toContain('<span className="font-medium">Yerinde hizmet</span>');
    expect(panel).toContain("onsite_only: form.onsite_only,");
    const server = read("src/lib/founder.functions.ts");
    expect(server).toContain("onsite_only: z.boolean().default(false)");
    expect(server).toMatch(/if \(values\.onsite_only\) \{[\s\S]*values\.delivery_fee = 0;/);
  });

  it("başvuru onaylanınca bilgi işletmeye aktarılıyor", () => {
    expect(read("src/lib/business-applications.functions.ts")).toContain(
      "onsite_only: application.onsite_only,",
    );
  });

  it("göç: yeni sütun eklenir, vitrine açılır, sipariş RPC'si yerinde hizmeti reddeder", () => {
    const sql = read("supabase/migrations/20261126130000_onsite_only_service.sql");
    expect(sql).toContain(
      "ALTER TABLE public.restaurants\n  ADD COLUMN IF NOT EXISTS onsite_only boolean NOT NULL DEFAULT false;",
    );
    expect(sql).toContain(
      "ALTER TABLE public.business_applications\n  ADD COLUMN IF NOT EXISTS onsite_only boolean NOT NULL DEFAULT false;",
    );
    expect(sql).toContain(
      "GRANT SELECT (onsite_only) ON public.restaurants TO anon, authenticated;",
    );
    expect(sql).toContain("IF v_restaurant.onsite_only IS TRUE THEN");
  });
});

describe("müşteri tarafı", () => {
  it("işletme kartında ve sayfasında yerinde hizmet etiketi/mesajı var", () => {
    const card = read("src/components/restaurant/RestaurantCard.tsx");
    expect(card).toContain("onsite_only?: boolean | null;");
    expect(card).toContain("Yerinde hizmet");

    const page = read("src/routes/restoran.$slug.tsx");
    expect(page).toContain("Bu işletme sipariş almıyor");
    // Sepete ekleme kilidi artık yalnızca elle işaretlenen onsite_only'e
    // değil, ürünü hiç olmayan işletmeleri de kapsayan türetilmiş bayrağa
    // bakıyor (bkz. onsite-only-equivalent.test.ts).
    expect(page).toContain("isOnsiteOnly ||");
  });
});
