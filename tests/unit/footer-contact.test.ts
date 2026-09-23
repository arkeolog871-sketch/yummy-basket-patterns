import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Kullanıcı isteği (23 Eylül 2026): alt bilgide Keşfet'te yalnız İletişim
 * kalır; telefon ve e-posta onun içinde açılır. Ana sayfada eskiden telefonun
 * durduğu yerde işletme başvurusu çağrısı var.
 */
describe("Keşfet → İletişim", () => {
  const footer = readFileSync("src/components/layout/Footer.tsx", "utf8");
  const contact = readFileSync("src/components/layout/FooterContact.tsx", "utf8");

  it("Keşfet'te yalnız İletişim var", () => {
    expect(footer).toContain("<FooterContact />");
    for (const removed of ["/restoranlar", "/sepet", "siparisler", "/isletme-basvuru"]) {
      expect(footer, removed).not.toContain(removed);
    }
  });

  it("telefon ve e-posta İletişim'in içinde açılır", () => {
    expect(contact).toContain("<details");
    expect(contact).toMatch(/<summary[\s\S]*İletişim/);
    // iOS kabuğunda tel: bağlantısı yerel köprüden açılır.
    expect(contact).toContain("openTelHref(telHref)");
    expect(contact).toContain("founder_contact_email");
  });
});

describe("ana sayfa: işletme başvurusu çağrısı", () => {
  it("telefon kartının yerinde başvuru çağrısı var", () => {
    const home = readFileSync("src/routes/index.tsx", "utf8");
    expect(home).toContain("<BusinessApplyCta />");
    expect(home).not.toContain("FounderContact");
    const cta = readFileSync("src/components/home/BusinessApplyCta.tsx", "utf8");
    expect(cta).toContain('to="/isletme-basvuru"');
  });
});
