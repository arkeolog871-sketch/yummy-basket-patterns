import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_SCROLL_ID } from "@/lib/app-scroll";
import {
  ANDROID_SHELL_ATTRIBUTE,
  NATIVE_SHELL_ATTRIBUTE,
  nativeShellMarkerInlineScript,
} from "@/lib/native-shell";

const ROOT = join(import.meta.dirname, "../..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

/**
 * iOS: başlık sayfayla birlikte kayıp gidiyordu (ölçüldü: 300px kaydırınca
 * başlığın üstü −300). Yapışkanlık orada kullanılamıyor (ios-header-touch).
 * Android: kullanıcı cihazında kaydırınca başlığın kaybolduğunu bildirdi;
 * Chromium'da aynı sayfa yapışkan kalıyordu, yani sebep cihazın WebView'inde.
 *
 * İkisinde de sabitlik düzenle sağlanıyor: belge kaymıyor, yalnızca içerik
 * alanı kayıyor. Başlığın yerinde durması artık `sticky`'ye bağlı değil.
 */
describe("uygulamalarda başlık düzenle sabit", () => {
  it("işaret betiği yalnızca iOS ve Android uygulamasında işaret koyar", () => {
    const run = (capacitor: unknown, silvanNative?: unknown) => {
      const attributes = new Map<string, string>();
      const fakeWindow = { Capacitor: capacitor, SilvanNative: silvanNative };
      const fakeDocument = {
        documentElement: {
          setAttribute: (name: string, value: string) => attributes.set(name, value),
        },
      };
      new Function("window", "document", nativeShellMarkerInlineScript())(fakeWindow, fakeDocument);
      return attributes.has(NATIVE_SHELL_ATTRIBUTE);
    };
    expect(run({ isNativePlatform: () => true, getPlatform: () => "ios" })).toBe(true);
    // Android sarmalayıcısı Capacitor değil; köprü nesnesiyle tanınır.
    expect(run(undefined, { micDiagnostics: () => "{}" })).toBe(true);
    // Tarayıcı: işaret yok, belge kayar, başlık yapışkan.
    expect(run({ isNativePlatform: () => true, getPlatform: () => "android" })).toBe(false);
    expect(run({ isNativePlatform: () => false, getPlatform: () => "web" })).toBe(false);
    expect(run(undefined)).toBe(false);
    // Bozuk köprü betiği düşürmemeli.
    expect(
      run({
        isNativePlatform: () => {
          throw new Error("köprü hazır değil");
        },
      }),
    ).toBe(false);
  });

  it("işaret betiği <head>'de, React'ten önce çalışıyor", () => {
    const root = read("src/routes/__root.tsx");
    const head = root.slice(root.indexOf("<head>"), root.indexOf("</head>"));
    expect(head).toContain("nativeShellMarkerInlineScript()");
    expect(head.indexOf("nativeShellMarkerInlineScript()")).toBeLessThan(
      head.indexOf("publicEnvInlineScript()"),
    );
    // Betik <html>'e öznitelik eklediği için hidrasyon uyarısı bastırılıyor.
    expect(root).toMatch(/<html lang="tr" suppressHydrationWarning>/);
  });

  it("uygulamada belge kaymıyor, yalnızca içerik alanı kayıyor", () => {
    const css = read("src/styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const rootRule =
      /html\[data-native-shell\],\s*html\[data-native-shell\] body\s*\{([^}]*)\}/.exec(css);
    expect(rootRule, "html/body kuralı yok").not.toBeNull();
    expect(rootRule![1]).toMatch(/overflow:\s*hidden/);
    expect(rootRule![1]).toMatch(/height:\s*100%/);
    expect(rootRule![1]).toMatch(/overscroll-behavior:\s*none/);

    const scrollRule = /html\[data-native-shell\] \[data-app-scroll\]\s*\{([^}]*)\}/.exec(css);
    expect(scrollRule, "içerik alanı kuralı yok").not.toBeNull();
    expect(scrollRule![1]).toMatch(/overflow-y:\s*auto/);
    expect(scrollRule![1]).toMatch(/min-height:\s*0/);
  });

  it("başlık kayan alanın DIŞINDA, içerik içinde", () => {
    const root = read("src/routes/__root.tsx");
    const chrome = root.slice(
      root.indexOf("function AppChrome"),
      root.indexOf("function RootComponent"),
    );
    const header = chrome.indexOf("<Header />");
    const scroll = chrome.indexOf("data-app-scroll");
    const main = chrome.indexOf("<main");
    expect(header).toBeGreaterThan(-1);
    expect(header).toBeLessThan(scroll);
    expect(scroll).toBeLessThan(main);
    expect(chrome).toContain("id={APP_SCROLL_ID}");
    expect(chrome).toContain("data-scroll-restoration-id={APP_SCROLL_ID}");
  });

  it("yeni sayfa içerik alanının da başından açılıyor", () => {
    expect(APP_SCROLL_ID).toBe("app-scroll");
    expect(read("src/router.tsx")).toContain("scrollToTopSelectors: [`#${APP_SCROLL_ID}`]");
  });

  it("başlık sabit kolonda küçülmüyor", () => {
    expect(read("src/components/layout/Header.tsx")).toMatch(/className=\{`z-40 shrink-0 /);
  });
});

/**
 * Android sarmalayıcısı durum çubuğu boşluğunu zaten bırakıyor ve aynı
 * WindowInsets'i WebView'e de geçiriyor. Başlık env(safe-area-inset-top)'u
 * ikinci kez eklerse üstte fazladan bir boşluk oluşuyor.
 */
describe("Android'de üstte çift boşluk yok", () => {
  const attributesFor = (win: Record<string, unknown>) => {
    const attributes = new Set<string>();
    const fakeDocument = {
      documentElement: { setAttribute: (name: string) => attributes.add(name) },
    };
    new Function("window", "document", nativeShellMarkerInlineScript())(win, fakeDocument);
    return attributes;
  };

  it("Android işareti yalnız Android köprüsü varken konur", () => {
    expect(attributesFor({ SilvanNative: {} }).has(ANDROID_SHELL_ATTRIBUTE)).toBe(true);
    expect(
      attributesFor({
        Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" },
      }).has(ANDROID_SHELL_ATTRIBUTE),
    ).toBe(false);
    expect(attributesFor({}).size).toBe(0);
  });

  it("Android'de başlık üst güvenli alan boşluğunu eklemez", () => {
    const css = read("src/styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).toMatch(
      /html\[data-android-shell\] \[data-app-header\]\s*\{\s*padding-top:\s*0;?\s*\}/,
    );
  });
});
