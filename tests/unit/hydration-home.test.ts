import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ÖLÇÜLDÜ (canlı hata kaydı, 23 Eylül 2026): ana sayfada React #418
 * (hidrasyon uyuşmazlığı), 281 kez. Geliştirme modunda React farkı gösterdi:
 * sunucu `index.tsx`'teki "N işletme listeleniyor" satırını basmış, istemci
 * basmamış. Sebep: yükleyici listeyi sunucunun sorgu önbelleğine koyuyordu ama
 * sorgu önbelleği istemciye taşınmıyor; istemci hidrasyonda listeyi
 * "yükleniyor" sanıyordu. Yükleyici verisi ise taşınır: liste oradan verilir.
 */
describe("ana sayfa hidrasyonu", () => {
  const page = readFileSync("src/routes/index.tsx", "utf8");

  it("yükleyici listeyi döndürür", () => {
    expect(page).toContain(
      "const businesses = await context.queryClient.ensureQueryData(homeQuery(deps));",
    );
    expect(page).toContain("return { businesses, loadedAt: Date.now() };");
  });

  it("bileşen sorguyu yükleyici verisiyle başlatır", () => {
    expect(page).toContain("const loaderData = Route.useLoaderData();");
    expect(page).toContain("initialData: () => loaderData?.businesses,");
    expect(page).toContain("initialDataUpdatedAt: () => loaderData?.loadedAt,");
  });
});

/**
 * ÖLÇÜLDÜ (canlı hata kaydı): "Failed to set the 'currentTime' property".
 * Sesli sohbette araya girince çalan ses susturulurken currentTime'a
 * `duration` yazılıyordu; canlı WebRTC akışında duration = Infinity.
 */
describe("sesli sohbette araya girme", () => {
  it("canlı akışta currentTime'a sonsuz yazılmaz", () => {
    const voice = readFileSync("src/components/assistant/useRealtimeVoice.ts", "utf8");
    expect(voice).not.toContain("element.currentTime = element.duration || 0;");
    expect(voice).toContain(
      "if (Number.isFinite(element.duration)) element.currentTime = element.duration;",
    );
  });
});
