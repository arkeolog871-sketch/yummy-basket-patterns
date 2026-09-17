import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readableOnWarm } from "@/lib/warm-contrast";

const ROOT = join(import.meta.dirname, "../..");
const header = readFileSync(join(ROOT, "src/components/layout/Header.tsx"), "utf8");

/**
 * Bildirim rozeti, düğmenin sıcak tonunun tersi olmalı: açık zemin + sıcak
 * renkte sayı. Bir kullanıcının teması hem accent hem secondary'yi beyaz
 * yapmıştı; eski rozet (bg-accent text-accent-foreground) beyaz zemin üstünde
 * beyaz yazıya dönüp sayıyı görünmez kılıyordu.
 */
describe("bildirim rozeti okunur", () => {
  it("rozet ters sıcak ton çiftini kullanıyor", () => {
    // Rozeti içeren bloğu al: unreadCount koşulundan sonrası.
    const block = header.slice(
      header.indexOf("unreadCount > 0 ?"),
      header.indexOf("</Link>", header.indexOf("unreadCount > 0 ?")),
    );
    expect(block).toContain("bg-warm-foreground");
    expect(block).toContain("text-warm");
    // Görünmez hale gelen eski çift artık kullanılmıyor.
    expect(block).not.toContain("bg-accent");
  });

  it("çok haneli sayı için genişleyebiliyor", () => {
    const block = header.slice(
      header.indexOf("unreadCount > 0 ?"),
      header.indexOf("</Link>", header.indexOf("unreadCount > 0 ?")),
    );
    expect(block).toContain("min-w-5");
    expect(block).toContain("99+");
  });
});

/**
 * warm ve warm-foreground zıt seçiliyor; hangi marka rengi seçilirse seçilsin
 * rozet zemini ile yazısı kontrast oluşturmalı. Kullanıcının koyu kırmızısı
 * (#b30000) ve varsayılan krem (#f3dfc0) için ikisi farklı çıkmalı.
 */
describe("ters rozet her temada kontrastlı", () => {
  it("koyu kırmızıda zemin ile yazı zıt", () => {
    // Rozet zemini warm-foreground, yazı warm(#b30000). Foreground açık olmalı.
    expect(readableOnWarm("#b30000")).toBe("oklch(0.98 0.01 78)");
  });

  it("açık kremde de zemin ile yazı zıt", () => {
    // warm-foreground krem için koyu; rozet zemini koyu, yazı krem — yine zıt.
    expect(readableOnWarm("#f3dfc0")).toBe("oklch(0.331 0.038 52)");
  });
});
