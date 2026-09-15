import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function codeOnly(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const fcm = codeOnly("src/lib/fcm.server.ts");

/**
 * iOS'ta Odak modu ve Zamanlanmış Özet, işaretlenmemiş bildirimleri bekletiyor.
 * "time-sensitive" bunu deler ama Apple bu işareti kullanıcının hemen görmesi
 * gereken bildirimlere saklıyor; duyuruyu acil işaretlemek inceleme riski.
 */
describe("acil bildirim işareti", () => {
  it("yalnızca istendiğinde ekleniyor", () => {
    expect(fcm).toContain('payload.urgent ? { "interruption-level": "time-sensitive" }');
  });

  it("sipariş bildirimleri acil", () => {
    for (const file of [
      "src/lib/order-vendor-alert.server.ts",
      "src/lib/order-cancel-alert.server.ts",
      "src/lib/order-customer-alert.server.ts",
    ]) {
      expect(codeOnly(file)).toContain("urgent: true");
    }
  });

  /** Duyuru "hemen görülmesi gereken" tanımına girmiyor; Apple'ın kuralı bu. */
  it("genel duyuru acil işaretlenmiyor", () => {
    const alert = codeOnly("src/lib/admin-message-alert.server.ts");
    expect(alert).not.toContain("urgent");
  });

  it("Android tarafı bundan etkilenmiyor", () => {
    const androidBlock = fcm.slice(fcm.indexOf("android: {"));
    expect(androidBlock).not.toContain("interruption-level");
  });
});
