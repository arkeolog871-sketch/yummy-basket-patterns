import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function codeOnly(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const header = codeOnly("src/components/layout/Header.tsx");

/**
 * WKWebView'de `position: sticky` başlık kendi derleme katmanına taşınıyor ve
 * o katmanın dokunma bölgesi ilk boyamada kurulmuyor: başlık görünüyor ama
 * düğmeleri dokunuşa cevap vermiyor, sayfa birazcık kaydırılınca çalışıyor.
 *
 * Yarı saydamlığı kaldırmak yetmedi (katmanın tek sebebi o değil). Tek kalıcı
 * çözüm iOS kabuğunda yapışkanlığı hiç kullanmamak.
 */
describe("iOS başlığı dokunmayı kaybetmiyor", () => {
  it("yapışkanlık iOS kabuğunda kapalı", () => {
    expect(header).toContain("isIosNativeShell()");
    expect(header).toMatch(/iosShell \? "" : "sticky top-0"/);
  });

  it("yapışkanlık koşulsuz yazılmıyor", () => {
    expect(header).not.toMatch(/className="sticky top-0/);
  });

  it("tarayıcı ve Android'de yapışkanlık korunuyor", () => {
    // Koşul yalnızca iOS'u dışarıda bırakır; diğer kabuklarda sınıf basılır.
    expect(header).toContain('"sticky top-0"');
  });

  /** Yarı saydam zemin katman oluşturup kusuru geri getirebilir. */
  it("başlıkta backdrop-blur yok", () => {
    expect(header).not.toContain("backdrop-blur");
  });
});
