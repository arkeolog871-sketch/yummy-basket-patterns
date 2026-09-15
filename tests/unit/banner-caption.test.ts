import { describe, expect, it } from "vitest";

import { parsePublicBanner, readableBannerTitle, sanitizeActionValue } from "@/lib/advertisements";

describe("readableBannerTitle", () => {
  it("yer tutucu işaretleri başlık saymaz", () => {
    // Başlık alanı zorunlu olduğu için üretimde "." girilmişti.
    expect(readableBannerTitle(".")).toBe("");
    expect(readableBannerTitle("...")).toBe("");
    expect(readableBannerTitle("-")).toBe("");
    expect(readableBannerTitle("   ")).toBe("");
  });

  it("gerçek başlığı olduğu gibi döndürür", () => {
    expect(readableBannerTitle("  Med Kuaför  ")).toBe("Med Kuaför");
    expect(readableBannerTitle("%50 indirim")).toBe("%50 indirim");
    expect(readableBannerTitle("2026 kampanya")).toBe("2026 kampanya");
  });

  it("dizge olmayan değerle çökmez", () => {
    expect(readableBannerTitle(null)).toBe("");
    expect(readableBannerTitle(undefined)).toBe("");
  });
});

describe("banner eylem değeri", () => {
  it("javascript: adresini reddeder", () => {
    expect(sanitizeActionValue("external_link", "javascript:alert(1)")).toBe("");
  });

  it("uygulama dışına çıkan göreli yolu reddeder", () => {
    expect(sanitizeActionValue("internal_route", "//kotu.example.com")).toBe("");
    expect(sanitizeActionValue("internal_route", "restoranlar")).toBe("");
    expect(sanitizeActionValue("internal_route", "/restoranlar")).toBe("/restoranlar");
  });
});

describe("parsePublicBanner", () => {
  it("görseli olmayan kaydı atar", () => {
    expect(parsePublicBanner({ id: "a", image_url: "" })).toBeNull();
  });
});
