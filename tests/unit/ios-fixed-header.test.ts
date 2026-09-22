import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_SCROLL_ID } from "@/lib/app-scroll";
import { IOS_SHELL_ATTRIBUTE, iosShellMarkerInlineScript } from "@/lib/native-shell";

const ROOT = join(import.meta.dirname, "../..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

/**
 * ÖLÇÜLDÜ (iOS kabuğu taklidi): başlık sayfayla birlikte kayıp gidiyordu
 * (300px kaydırınca başlığın üstü −300) ve kabuk `contentInset: automatic`
 * ile çalıştığı için sayfa çentik şeridinin altından akıyordu.
 *
 * Başlığa `sticky` vermek çözüm değil (ios-header-touch.test.ts). Sabitlik
 * düzenle sağlanıyor: iOS'ta belge kaymıyor, yalnızca içerik alanı kayıyor.
 */
describe("iOS'ta başlık düzenle sabit", () => {
  it("işaret betiği yalnızca iOS Capacitor kabuğunda işaret koyar", () => {
    const run = (capacitor: unknown) => {
      const attributes = new Map<string, string>();
      const fakeWindow = { Capacitor: capacitor };
      const fakeDocument = {
        documentElement: {
          setAttribute: (name: string, value: string) => attributes.set(name, value),
        },
      };
      new Function("window", "document", iosShellMarkerInlineScript())(fakeWindow, fakeDocument);
      return attributes.has(IOS_SHELL_ATTRIBUTE);
    };
    expect(run({ isNativePlatform: () => true, getPlatform: () => "ios" })).toBe(true);
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
    expect(head).toContain("iosShellMarkerInlineScript()");
    expect(head.indexOf("iosShellMarkerInlineScript()")).toBeLessThan(
      head.indexOf("publicEnvInlineScript()"),
    );
    // Betik <html>'e öznitelik eklediği için hidrasyon uyarısı bastırılıyor.
    expect(root).toMatch(/<html lang="tr" suppressHydrationWarning>/);
  });

  it("iOS'ta belge kaymıyor, yalnızca içerik alanı kayıyor", () => {
    const css = read("src/styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const rootRule = /html\[data-ios-shell\],\s*html\[data-ios-shell\] body\s*\{([^}]*)\}/.exec(
      css,
    );
    expect(rootRule, "html/body kuralı yok").not.toBeNull();
    expect(rootRule![1]).toMatch(/overflow:\s*hidden/);
    expect(rootRule![1]).toMatch(/height:\s*100%/);
    expect(rootRule![1]).toMatch(/overscroll-behavior:\s*none/);

    const scrollRule = /html\[data-ios-shell\] \[data-app-scroll\]\s*\{([^}]*)\}/.exec(css);
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
