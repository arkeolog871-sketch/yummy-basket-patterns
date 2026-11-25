import { describe, expect, it } from "vitest";
import { checkFullName } from "@/lib/name-validation";
import { registerSchema } from "@/lib/otp-schemas";
import { fullNameSchema } from "@/lib/profile.functions";
import { applicationSchema } from "@/lib/business-applications.functions";

const BASE_APPLICATION = {
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
  mobile_service: true,
  district: "Silvan",
  city: "Diyarbakır",
  contact_email: "usta@example.com",
  contact_phone: "0555 555 55 55",
  opens_at: "09:00",
  closes_at: "18:00",
  is_open_manual: true,
};

describe("checkFullName", () => {
  it("gerçek görünen ad soyadı kabul eder", () => {
    expect(checkFullName("Ahmet Yılmaz")).toEqual({ ok: true });
    expect(checkFullName("  Ayşe   Nur Kaya  ")).toEqual({ ok: true });
    expect(checkFullName("Mehmet-Ali Öztürk")).toEqual({ ok: true });
  });

  it("tek kelimeyi (soyadsız) reddeder", () => {
    expect(checkFullName("Ahmet").ok).toBe(false);
  });

  it("rakam veya sembol içeren girdiyi reddeder", () => {
    expect(checkFullName("Ahmet123 Yılmaz").ok).toBe(false);
    expect(checkFullName("Ahmet😀 Yılmaz").ok).toBe(false);
  });

  it("klavye karmasını ya da aynı harfin tekrarını reddeder", () => {
    expect(checkFullName("aaaa bbbb").ok).toBe(false);
    expect(checkFullName("xxxx yyyy").ok).toBe(false);
  });

  it("sesli harfi olmayan sahte kelimeyi reddeder", () => {
    expect(checkFullName("Bcdfgh Jklmnp").ok).toBe(false);
  });

  it("argo/küfür içeren ismi reddeder", () => {
    expect(checkFullName("Siktir Git").ok).toBe(false);
    expect(checkFullName("Amk Yavşak").ok).toBe(false);
  });

  it("yaygın doldurma değerlerini reddeder", () => {
    expect(checkFullName("Test Test").ok).toBe(false);
    expect(checkFullName("Asdf Asdf").ok).toBe(false);
    expect(checkFullName("Bilinmiyor Bilinmiyor").ok).toBe(false);
  });

  it("İ/I büyük-küçük harf dönüşümünü Türkçe kurala göre yapar (argo tespiti bundan etkilenmez)", () => {
    expect(checkFullName("SİKTİR GİT").ok).toBe(false);
  });
});

describe("ad soyad kontrolü üç giriş noktasına da bağlı", () => {
  it("şifreli kayıt: argo isim reddedilir", () => {
    expect(() =>
      registerSchema.parse({
        email: "test@example.com",
        password: "secret1",
        fullName: "Siktir Git",
        phone: "",
      }),
    ).toThrow();
  });

  it("zorunlu tamamlama adımı (fullNameSchema): klavye karması reddedilir", () => {
    expect(() => fullNameSchema.parse({ full_name: "asdf asdf" })).toThrow();
    expect(fullNameSchema.parse({ full_name: "Ali Veli" })).toEqual({ full_name: "Ali Veli" });
  });

  it("işletme başvurusu: yetkili adı argo/sahte olunca başvuru reddedilir", () => {
    expect(() =>
      applicationSchema.parse({ ...BASE_APPLICATION, contact_person: "Test Test" }),
    ).toThrow();
    expect(() =>
      applicationSchema.parse({ ...BASE_APPLICATION, contact_person: "Ahmet Yılmaz" }),
    ).not.toThrow();
  });
});
