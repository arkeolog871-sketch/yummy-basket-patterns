import { describe, expect, it } from "vitest";
import { applicationSchema } from "@/lib/business-applications.functions";

/**
 * Alan "WhatsApp konum veya Google Maps bağlantısı yapıştırın" diyor, ama
 * WhatsApp'ın paylaştığı metin linkten önce başlık/boşluk içerebiliyor
 * ("Konumum: https://maps.google.com/..."). Eski doğrulama yalnızca metnin
 * TAMAMININ http(s):// ile başlayıp başlamadığına bakıyordu; bu yüzden
 * içinde geçerli bir link olan meşru bir yapıştırma bile reddedilip başvuru
 * genel, alan belirtmeyen bir hata mesajıyla tıkanıyordu (kullanıcı raporu).
 */
const base = {
  slug: "ornek-lokanta",
  name: "Örnek Lokanta",
  tagline: "Ev yemekleri",
  category: "Lokanta",
  sector: "yemek",
  cuisines: [],
  delivery_minutes: 30,
  delivery_fee: 0,
  min_order: 0,
  cover_image_url: null,
  mobile_service: false,
  address: "Boyunlu mahallesi no 1",
  district: "Silvan",
  city: "Diyarbakır",
  latitude: 38.148,
  longitude: 41.006,
  contact_email: "lokanta@example.com",
  contact_phone: "0555 555 55 55",
  contact_person: "Ali Veli",
  opens_at: "09:00",
  closes_at: "18:00",
  is_open_manual: true,
};

describe("harita linki yapıştırmada WhatsApp/paylaşım metni ayıklanıyor", () => {
  it("başında açıklama metni olan WhatsApp konum paylaşımından linki ayıklıyor", () => {
    const parsed = applicationSchema.parse({
      ...base,
      maps_url: "Konumum: https://maps.google.com/?q=38.148,41.006",
    });
    expect(parsed.maps_url).toBe("https://maps.google.com/?q=38.148,41.006");
  });

  it("linkten sonra ek metin varsa da yalnızca linki alıyor", () => {
    const parsed = applicationSchema.parse({
      ...base,
      maps_url: "https://maps.app.goo.gl/abc123 (dükkanın önü)",
    });
    expect(parsed.maps_url).toBe("https://maps.app.goo.gl/abc123");
  });

  it("saf, doğrudan linki değiştirmeden bırakıyor", () => {
    const parsed = applicationSchema.parse({
      ...base,
      maps_url: "https://maps.app.goo.gl/abc123",
    });
    expect(parsed.maps_url).toBe("https://maps.app.goo.gl/abc123");
  });

  it("boş bırakılırsa hâlâ isteğe bağlı kalıyor", () => {
    expect(applicationSchema.parse({ ...base, maps_url: "" }).maps_url).toBe("");
    expect(applicationSchema.parse({ ...base, maps_url: null }).maps_url).toBeNull();
  });

  it("gerçekten link içermeyen metni hâlâ reddediyor, ama hangi alan olduğunu söylüyor", () => {
    const result = applicationSchema.safeParse({
      ...base,
      maps_url: "Silvan çarşı içi, kırmızı kapı",
    });
    expect(result.success).toBe(false);
    const message = result.success ? "" : result.error.issues[0]?.message;
    expect(message).toContain("Harita bağlantısı");
  });
});
