import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const founderFns = read("src/lib/founder.functions.ts");
const kurucu = read("src/routes/kurucu.tsx");

/**
 * Sayfa yöneticisi paneli: işletmeyi basılı tutup sürükleyerek sıralama.
 * moveRestaurant artık direction (yukarı/aşağı) yanında toIndex (hedef sıra,
 * sürükle-bırak) da kabul ediyor — ikisi karşılıklı dışlar.
 */
describe("işletme sürükle-bırak sıralama", () => {
  it("moveRestaurant toIndex ile direction'ı karşılıklı dışlıyor", () => {
    const start = founderFns.indexOf("export const moveRestaurant");
    const body = founderFns.slice(
      start,
      founderFns.indexOf("export const updateOrderStatus", start),
    );
    expect(body).toContain("toIndex: z.number().int().min(0).optional()");
    expect(body).toContain("(value.direction == null) !== (value.toIndex == null)");
  });

  it("toIndex verildiğinde hedef sıraya göre taşınıyor, sınırlar aşılmıyor", () => {
    const start = founderFns.indexOf("export const moveRestaurant");
    const body = founderFns.slice(
      start,
      founderFns.indexOf("export const updateOrderStatus", start),
    );
    expect(body).toContain("data.toIndex != null");
    expect(body).toContain("Math.min(Math.max(data.toIndex, 0), scoped.length - 1)");
    // Aynı yeniden-numaralandırma mantığı korunuyor (değer takası değil).
    expect(body).toContain("splice");
    expect(body).toContain("display_order: order");
  });

  it("panelde sürükleme tutamacı (basılı tutma) var, dnd-kit kullanılıyor", () => {
    expect(kurucu).toContain('from "@dnd-kit/core"');
    expect(kurucu).toContain('from "@dnd-kit/sortable"');
    expect(kurucu).toContain("GripVertical");
    expect(kurucu).toContain('aria-label="Basılı tutup sürükleyerek sırala"');
    // Basılı tutma gecikmesi: anlık dokunuş/kaydırmayla çakışmasın.
    expect(kurucu).toMatch(/activationConstraint:\s*\{\s*delay:\s*\d+/);
  });

  it("sürükleme bırakılınca toIndex ile sunucuya taşıma isteği gönderiliyor", () => {
    const start = kurucu.indexOf("function handleDragEnd");
    expect(start).toBeGreaterThan(-1);
    const body = kurucu.slice(start, kurucu.indexOf("\n  }", start));
    expect(body).toContain("arrayMove(order, oldIndex, newIndex)");
    expect(body).toContain("moveMutation.mutate({ id: String(active.id), toIndex: newIndex })");
  });

  it("arama açıkken sürükleme de oklar gibi devre dışı kalıyor", () => {
    expect(kurucu).toContain("disabled={!canReorder}");
  });

  it("yukarı/aşağı düğmeleri hâlâ duruyor (erişilebilirlik/geri uyumluluk)", () => {
    expect(kurucu).toContain('aria-label="Yukarı taşı"');
    expect(kurucu).toContain('aria-label="Aşağı taşı"');
  });
});
