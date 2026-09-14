import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

const authRoute = readFileSync(join(ROOT, "src/routes/auth.tsx"), "utf8");
const applyRoute = readFileSync(join(ROOT, "src/routes/isletme-basvuru.tsx"), "utf8");
const infoPlist = readFileSync(join(ROOT, "ios/App/App/Info.plist"), "utf8");
const capConfig = readFileSync(join(ROOT, "capacitor.config.ts"), "utf8");

/**
 * Apple sürümü Guideline 4 kapsamında reddetti: "kullanıcı giriş yapmak veya
 * kayıt olmak için varsayılan web tarayıcısına çıkarılıyor". Native yol
 * yazıldı, ama her iki giriş ekranında da köprü bulunamazsa tarayıcı akışına
 * düşen bir dal duruyordu. O dal iOS'ta çalışırsa reddedilen davranış birebir
 * geri gelir — üstelik sessizce, çünkü köprünün neden bulunamadığını kimse
 * görmez. iOS'ta artık uygulamadan çıkılmıyor; görünür hata veriliyor ve
 * e-posta ile giriş açık kalıyor.
 */
describe("iOS'ta tarayıcıya çıkış yok", () => {
  for (const [name, source] of [
    ["giriş ekranı", authRoute],
    ["işletme başvurusu", applyRoute],
  ] as const) {
    it(`${name}: tarayıcı akışından önce iOS'u durduruyor`, () => {
      expect(source).toContain("isIosNativeApp()");
      // Tarayıcıya düşen her dalın öncesinde koruma olmalı.
      for (const fallback of ["startBrowserGoogle()", "startAppleOAuth()"]) {
        const at = source.indexOf(`await ${fallback}`);
        if (at === -1) continue;
        const before = source.slice(0, at);
        expect(before.lastIndexOf("isIosNativeApp()")).toBeGreaterThan(
          before.lastIndexOf("hasNativeIosAuth"),
        );
      }
    });
  }
});

/**
 * Giriş ekranındaki yardım metinleri tarayıcı üzerine kuruluydu. iOS
 * uygulamasında hem yanlış (hiçbir tarayıcı açılmıyor) hem de zararlı:
 * inceleyene tam da düzelttiğimiz kusuru işaret ediyor.
 */
describe("giriş ekranı metinleri", () => {
  it("iOS uygulamasında tarayıcı yönlendirmesi göstermiyor", () => {
    expect(authRoute).toContain("isIosApp ? null : (");
  });

  it("kullanıcıya Safari tavsiye etmiyor", () => {
    expect(authRoute).not.toContain("Safari ile\n                en iyi sonucu verir");
    expect(authRoute).not.toContain("iPhone veya iPad'de Safari");
  });

  /** "Supabase sağlayıcısı etkinleştirildikten sonra çalışır" geliştirici notu,
   *  kullanıcıya uygulamanın yarım olduğunu söylüyordu (Guideline 2.1). */
  it("geliştirici kurulum notu içermiyor", () => {
    expect(authRoute).not.toContain("Supabase");
  });
});

describe("Info.plist izin metinleri", () => {
  /** İzin metni olmadan ilgili izin istendiğinde uygulama anında çöker. */
  for (const key of [
    "NSCameraUsageDescription",
    "NSLocationWhenInUseUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSPhotoLibraryUsageDescription",
  ]) {
    it(`${key} tanımlı ve boş değil`, () => {
      const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`).exec(infoPlist);
      expect(match).not.toBeNull();
      expect((match?.[1] ?? "").trim().length).toBeGreaterThan(10);
    });
  }

  /** Bu olmadan her yüklemede dışa aktarım uyumluluğu sorusu soruluyor. */
  it("şifreleme beyanı yapılmış", () => {
    expect(infoPlist).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  });
});

/**
 * Uygulama uzaktaki adresi yüklüyor. Adres yüklenemezse (kopuk bağlantı,
 * incelemedeki kısıtlı ağ) WKWebView boş beyaz ekran gösteriyor ve uygulama
 * bozuk görünüyor — Guideline 2.1'in en sık tetiklendiği durum.
 */
describe("bağlantı kurulamadığında", () => {
  const errorPage = "public/baglanti-hatasi.html";

  it("yerel hata sayfasına düşüyor", () => {
    expect(capConfig).toContain('errorPath: "baglanti-hatasi.html"');
  });

  it("hata sayfası uygulamayla birlikte paketleniyor", () => {
    expect(capConfig).toMatch(/webDir:\s*"public"/);
    expect(existsSync(join(ROOT, errorPage))).toBe(true);
  });

  /** Sayfa ağsız açılacak; dışarıdan hiçbir şey çekmemeli. */
  it("dış kaynağa bağımlı değil", () => {
    const html = readFileSync(join(ROOT, errorPage), "utf8");
    expect(html).toContain("Tekrar dene");
    const remote = html.match(/(src|href)="https?:\/\/[^"]+"/g) ?? [];
    expect(remote).toEqual([]);
  });
});
