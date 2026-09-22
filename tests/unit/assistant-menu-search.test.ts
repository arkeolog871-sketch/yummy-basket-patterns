import { describe, expect, it } from "vitest";
import { findMenuItems } from "@/lib/ai-assistant.server";

/**
 * YAŞANMIŞ ARIZA: asistan ürünlerin yalnızca alfabetik ilk 200'ünü çekip
 * süzüyordu. 5000 ürünlü markette aranan ürün o pencereye girmediği için
 * "bulunamadı" dönüyor, sesli sipariş büyük katalogda hiç çalışmıyordu.
 * Aşağıdaki sahte istemci tam o durumu kuruyor.
 */

type Row = { id: string; name: string; description: string | null; price: number };

/** 5000 ürünlük katalog; aranan ürünler alfabetik olarak çok sonda. */
function buildCatalog(): Row[] {
  const rows: Row[] = [];
  for (let index = 0; index < 4998; index += 1) {
    rows.push({
      id: `a-${index}`,
      name: `Aaa ürün ${String(index).padStart(4, "0")}`,
      description: null,
      price: 10,
    });
  }
  rows.push({ id: "sut", name: "Süt 1 lt", description: "Günlük süt", price: 32 });
  rows.push({ id: "sut-yarim", name: "Süt 500 ml", description: null, price: 19 });
  return rows.sort((left, right) => left.name.localeCompare(right.name, "tr"));
}

/**
 * PostgREST istemcisinin bu kod yolunda kullanılan parçalarını taklit eder.
 * `ilike` bilerek AKSANA DUYARLI: gerçek Postgres davranışı budur ve yedek
 * tarama yolunun gerçekten çalıştığını ancak böyle ölçebiliriz.
 */
function fakeClient(rows: Row[], calls: string[]) {
  const builder = (current: Row[]) => {
    const api = {
      eq: () => api,
      or: (expression: string) => {
        calls.push("or");
        const match = /%(.*?)%/.exec(expression);
        const needle = (match?.[1] ?? "").toLowerCase();
        return builder(
          current.filter(
            (row) =>
              row.name.toLowerCase().includes(needle) ||
              (row.description ?? "").toLowerCase().includes(needle),
          ),
        );
      },
      order: () => api,
      limit: (count: number) => Promise.resolve({ data: current.slice(0, count), error: null }),
      range: (from: number, to: number) => {
        calls.push(`range:${from}`);
        return Promise.resolve({ data: current.slice(from, to + 1), error: null });
      },
    };
    return api;
  };
  return {
    from: () => ({ select: () => builder(rows) }),
  } as never;
}

describe("findMenuItems", () => {
  it("alfabetik olarak çok sonda olan ürünü bulur", async () => {
    const calls: string[] = [];
    const found = await findMenuItems(fakeClient(buildCatalog(), calls), "biz", "süt");
    expect(found.items.map((item) => item.id)).toEqual(["sut", "sut-yarim"]);
  });

  it("aksansız yazımda katalogu tarayarak bulur", async () => {
    const calls: string[] = [];
    const found = await findMenuItems(fakeClient(buildCatalog(), calls), "biz", "sut");
    // ilike aksanı tutmadı; yedek sayfalı tarama devreye girdi.
    expect(calls.some((call) => call.startsWith("range:"))).toBe(true);
    expect(found.items.map((item) => item.id).sort()).toEqual(["sut", "sut-yarim"]);
  });

  it("aramasız çağrıda sonuçları sınırlar ve kırpıldığını bildirir", async () => {
    const found = await findMenuItems(fakeClient(buildCatalog(), []), "biz", null);
    expect(found.items).toHaveLength(40);
    expect(found.truncated).toBe(true);
  });

  it("hiç eşleşme yoksa boş döner", async () => {
    const found = await findMenuItems(fakeClient(buildCatalog(), []), "biz", "helikopter");
    expect(found.items).toEqual([]);
  });
});
