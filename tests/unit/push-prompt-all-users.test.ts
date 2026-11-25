import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

/**
 * YAŞANDI: bildirim izni isteği yalnızca işletme hesaplarına gösteriliyordu
 * (`if (!status.isBusiness) return;`). Sıradan bir müşteri "Bildirimler"
 * sayfasını kendi açmadıkça hiç sorulmuyordu — hesapların büyük
 * çoğunluğunda bildirim cihazı kaydı olmamasının en büyük tek sebebi buydu.
 */
describe("bildirim izni isteği artık tüm hesaplara gösteriliyor", () => {
  it("PushPermissionPrompt, işletme olmayan hesapları erkenden eleyen bir kontrol içermiyor", () => {
    const component = read("src/components/notifications/PushPermissionPrompt.tsx");
    expect(component).not.toMatch(/if\s*\(!status\.isBusiness\)\s*return;/);
    expect(component).toContain("export function PushPermissionPrompt()");
    // Kopya metni hesap türüne göre uyarlanıyor; isBusiness yine de kullanılıyor
    // (metin seçimi için) ama akışı durdurmuyor.
    expect(component).toContain("setIsBusiness(status.isBusiness);");
  });

  it("eski işletmeye özel bileşen kaldırıldı, yenisi kök bileşende bağlı", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).not.toContain("BusinessPushPrompt");
    expect(root).toContain("PushPermissionPrompt");
  });
});
