import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { measureMissingHeight } from "@/lib/ios-full-screen";
import { nativeShellMarkerInlineScript } from "@/lib/native-shell";

/**
 * iPhone uygulamasında alt boşluk (ana ekran çizgisi bölgesi). Sebep WebKit
 * kaynağından doğrulandı: contentInset "automatic" iken sayfa yüksekliği =
 * ekran − üst − alt güvenli alan; 22 Eylül kilidinden beri içerik alta inemiyor.
 * Çözüm yalnız iPhone'da: sayfa, telefonun kendi ekranından ölçülen eksik kadar
 * uzar. ANDROID'E DOKUNULMAZ.
 */
describe("eksik yükseklik ölçümü (model tablosu yok, telefonun kendi ekranı)", () => {
  it("dik tutuş: ekranın uzun kenarı − sayfa yüksekliği", () => {
    // Örnek: 390×844 ekran, üst 47 + alt 34 güvenli alan → sayfa 763.
    expect(
      measureMissingHeight({
        screenWidth: 390,
        screenHeight: 844,
        layoutWidth: 390,
        layoutHeight: 763,
      }),
    ).toBe(81);
  });

  it("yan tutuş: ekranın kısa kenarı esas alınır (iOS ekranı dik raporlasa da)", () => {
    expect(
      measureMissingHeight({
        screenWidth: 390,
        screenHeight: 844,
        layoutWidth: 844,
        layoutHeight: 369,
      }),
    ).toBe(21);
  });

  it("uygulama ekranın tamamını verirse (ileride yeni sürüm) 0: kendiliğinden devreden çıkar", () => {
    expect(
      measureMissingHeight({
        screenWidth: 390,
        screenHeight: 844,
        layoutWidth: 390,
        layoutHeight: 844,
      }),
    ).toBe(0);
  });

  it("anlamsız ölçümde 0: bugünkü duruma düşer", () => {
    expect(
      measureMissingHeight({
        screenWidth: 0,
        screenHeight: 0,
        layoutWidth: 390,
        layoutHeight: 763,
      }),
    ).toBe(0);
    expect(
      measureMissingHeight({
        screenWidth: 390,
        screenHeight: 1400,
        layoutWidth: 390,
        layoutHeight: 763,
      }),
    ).toBe(0);
    expect(
      measureMissingHeight({
        screenWidth: Number.NaN,
        screenHeight: 844,
        layoutWidth: 390,
        layoutHeight: 763,
      }),
    ).toBe(0);
  });
});

describe("Android'e dokunulmadı", () => {
  const css = readFileSync("src/styles.css", "utf8");

  it("Android'in kullandığı kilit kuralları aynen duruyor", () => {
    expect(css).toContain(`html[data-native-shell]:has([data-app-scroll]),
html[data-native-shell]:has([data-app-scroll]) body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}`);
    expect(css).toContain(`html[data-native-shell] [data-app-scroll] {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;`);
    expect(css).toContain(`html[data-android-shell] [data-app-header] {
  padding-top: 0;
}`);
  });

  it("yeni kurallar yalnız iPhone işaretiyle çalışıyor", () => {
    const iosRules = css.match(/^[^\n{]*--ios-bottom-bleed[^\n]*$/gm) ?? [];
    expect(iosRules.length).toBeGreaterThan(0);
    const selectors = css.match(/^html\[[^\]]+\][^{]*\{[^}]*--ios-bottom-bleed/gm) ?? [];
    for (const rule of selectors) expect(rule.startsWith("html[data-ios-shell]")).toBe(true);
  });

  it("mevcut kabuk işaretleme betiği değişmedi (iOS işareti ayrı betikte)", () => {
    expect(nativeShellMarkerInlineScript()).not.toContain("data-ios-shell");
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toContain("__html: nativeShellMarkerInlineScript()");
    expect(root).toContain("__html: iosShellMarkerInlineScript()");
  });

  it("iPhone işareti yalnız Capacitor iOS'ta konuyor", () => {
    const source = readFileSync("src/lib/ios-full-screen.ts", "utf8");
    expect(source).toContain('c.getPlatform()==="ios"');
    expect(source).toContain('capacitor.getPlatform?.() === "ios"');
    expect(source).not.toContain("SilvanNative");
  });
});
