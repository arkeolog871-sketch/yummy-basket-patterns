import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isBusinessOpen, isWithinHours } from "@/lib/hours";

const read = (path: string) => readFileSync(join(import.meta.dirname, "../..", path), "utf8");

/**
 * Bazı işletmeler yalnızca vitrin/reklam için var; sipariş almıyorlar
 * ("sipariş alıyor" anahtarı kapalı) ama görünürlük kaybetmemeli. Kullanıcı
 * raporu: bu işletmeler ana sayfada "Kapalı" rozetiyle görünüyordu. Çözüm:
 * "Kapalı" rozeti/uyarısı yalnızca çalışma saatine (isWithinHours) bakar;
 * sipariş engeli (menü soluklaşması, sepete ekleme) yine manuel anahtarı da
 * kapsayan isBusinessOpen'a bağlı kalır.
 */
describe("yalnızca manuel kapalı (vitrin amaçlı) işletme görünürlüğü", () => {
  const withinHoursManualClosed = {
    opens_at: "00:00",
    closes_at: "23:59",
    is_open_manual: false,
  };

  it("çalışma saati içindeyken manuel kapalı işletme 'açık' görünür (Kapalı rozeti göstermez)", () => {
    expect(isWithinHours(withinHoursManualClosed)).toBe(true);
  });

  it("aynı işletme yine de sipariş kabul etmiyor sayılır (sepete eklenemez)", () => {
    expect(isBusinessOpen(withinHoursManualClosed)).toBe(false);
  });

  it("gerçekten saat dışıysa Kapalı rozeti hâlâ doğru şekilde görünür", () => {
    const outsideHours = { opens_at: "09:00", closes_at: "10:00", is_open_manual: true };
    expect(isWithinHours(outsideHours)).toBe(false);
    expect(isBusinessOpen(outsideHours)).toBe(false);
  });

  it("kart rozeti isBusinessOpen değil isWithinHours kullanıyor", () => {
    const card = read("src/components/restaurant/RestaurantCard.tsx");
    expect(card).toContain('import { isWithinHours, hoursLabel } from "@/lib/hours";');
    expect(card).toContain("const open = isWithinHours(restaurant);");
    expect(card).not.toMatch(/isBusinessOpen/);
  });

  it("işletme sayfasında üstteki rozet/uyarı saate, menü soluklaşması ve sepet kilidi sipariş durumuna bakıyor", () => {
    const page = read("src/routes/restoran.$slug.tsx");
    expect(page).toContain("const open = isBusinessOpen(restaurant);");
    expect(page).toContain("const withinHours = isWithinHours(restaurant);");
    // Üst rozet ve "Kapalı" uyarı bandı: yalnızca saat.
    expect(page).toMatch(/withinHours\s*\n?\s*\?\s*"bg-success text-success-foreground"/);
    expect(page).toContain('{withinHours ? "Şu An Açık" : "Şu An Kapalı"}');
    expect(page).toContain("withinHours ? null : (");
    // Menü soluklaşması ve sepete ekleme kilidi: sipariş durumu (manuel + saat).
    expect(page).toContain('className={`min-w-0 ${open ? "" : "opacity-50"}`}');
    expect(page).toMatch(/disabled=\{[\s\S]*?!open[\s\S]*?item\.in_stock === false/);
  });
});
