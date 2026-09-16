import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function codeOnly(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const header = codeOnly("src/components/layout/Header.tsx");

/**
 * iPhone'da donanım geri tuşu yok ve Capacitor kabuğunda kenardan kaydırma
 * hareketi de kapalı: kullanıcı bir alt sayfaya girdiğinde geri dönmenin
 * hiçbir yolu kalmıyordu. Düğme web tarafında; yeni bir iOS sürümü
 * gerektirmeden yayına çıkıyor.
 */
describe("iOS geri düğmesi", () => {
  it("yalnızca iOS kabuğunda çiziliyor", () => {
    expect(header).toContain("isIosNativeShell()");
    expect(header).toMatch(/\{iosShell && canGoBack \?/);
  });

  it("geri gidilecek adım yoksa çizilmiyor", () => {
    // Ana ekranda çengel göstermek iOS alışkanlığına aykırı; useCanGoBack
    // yığının başında false döner.
    expect(header).toContain("useCanGoBack");
    expect(header).toContain("const canGoBack = useCanGoBack();");
  });

  it("yönlendirici geçmişini kullanıyor", () => {
    expect(header).toContain("router.history.back()");
  });

  it("ekran okuyucu için etiketli", () => {
    expect(header).toMatch(/aria-label="Geri"/);
  });

  /**
   * WKWebView'de sabitlenmiş öğeler kendi derleme katmanına taşınıp ilk
   * boyamada dokunma bölgesini kurmuyor; başlığın yapışkanlığını tam da bu
   * yüzden kaldırmıştık. Geri düğmesi aynı tuzağa düşmemeli.
   */
  it("sabitlenmiş bir katman oluşturmuyor", () => {
    const button = header.slice(
      header.indexOf("{iosShell && canGoBack ?"),
      header.indexOf('<Link to="/" className="flex items-center gap-2">'),
    );
    expect(button.length).toBeGreaterThan(0);
    expect(button).not.toContain("fixed");
    expect(button).not.toContain("sticky");
    expect(button).not.toContain("backdrop-blur");
  });
});
