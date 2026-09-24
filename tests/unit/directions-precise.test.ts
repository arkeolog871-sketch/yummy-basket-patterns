import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMapsUrl, directionsLinkUrl, hasDirections } from "@/lib/maps";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("yol tarifi yalnız kesin konumla", () => {
  it("koordinatı olan işletme o noktaya yönlendirilir", () => {
    const url = buildMapsUrl({
      name: "Kahve diyarı",
      district: "Silvan",
      city: "Diyarbakır",
      latitude: "38.147786",
      longitude: "41.00435",
    });
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=38.147786%2C41.00435");
  });

  it("işletmenin kendi harita bağlantısındaki koordinat kullanılır", () => {
    expect(
      buildMapsUrl({
        name: "Örnek",
        maps_url: "https://www.google.com/maps/place/X/@38.1481,41.0067,17z",
      }),
    ).toBe("https://www.google.com/maps/dir/?api=1&destination=38.1481%2C41.0067");
  });

  it("koordinatsız kısa harita bağlantısı işletmenin kendi bağlantısı olarak açılır", () => {
    expect(buildMapsUrl({ name: "Örnek", maps_url: "https://maps.app.goo.gl/abc123" })).toBe(
      "https://maps.app.goo.gl/abc123",
    );
  });

  it("konumu olmayan işletmede ad/ilçe metni Google'a aratılmaz (canlıdaki iki kayıt)", () => {
    // 24.09.2026 canlı: koordinat ve harita bağlantısı boş.
    for (const business of [
      { name: "Şeçkin Nakliyat", district: "Silvan", city: "Diyarbakır", address: null },
      { name: "Abdurrahman usta", district: "Silvan", city: "Diyarbakır", address: null },
    ]) {
      expect(
        buildMapsUrl({ ...business, latitude: null, longitude: null, maps_url: null }),
      ).toBeNull();
      expect(directionsLinkUrl(business)).toBeNull();
      expect(hasDirections(business)).toBe(false);
    }
  });

  it("yalnız adres metni de tahmine yol açmaz", () => {
    expect(
      buildMapsUrl({
        name: "Örnek",
        address: "Bağlar mahallesi belediye karşısı",
        city: "Diyarbakır",
      }),
    ).toBeNull();
  });

  it("Google dışı ya da bozuk bağlantı tahmine dönüşmez", () => {
    expect(
      buildMapsUrl({ name: "Örnek", district: "Silvan", maps_url: "https://example.com/x" }),
    ).toBeNull();
    expect(buildMapsUrl({ name: "Örnek", latitude: "abc", longitude: "41" })).toBeNull();
  });

  it("konum yoksa ilçe yazısı düğme değil, harita kartı yol tarifi bağlantısı göstermez", () => {
    const button = read("src/components/business/LocationButton.tsx");
    expect(button).toContain("if (!hasDirections(business))");
    const map = read("src/components/business/BusinessMap.tsx");
    expect(map).toContain("Bu işletme henüz haritada konumunu eklemedi.");
    expect(map).toMatch(/\{directionsUrl \? \(/);
  });
});
