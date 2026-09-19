import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import readXlsxFile from "read-excel-file/node";
import { parseProductRows, sheetCellToText } from "@/lib/product-import";

/**
 * Uçtan uca Excel testi: gerçek bir .xlsx dosyası kütüphaneyle okunur,
 * hücreler metne çevrilir ve ayrıştırıcıdan geçirilir — tarayıcıdaki yolun
 * birebir aynısı (kütüphanenin /node ve /browser girişleri aynı çekirdeği
 * kullanıyor).
 *
 * Bu testin asıl amacı barkod: dosyada barkod SAYI hücresi olarak duruyor.
 * CSV yolunda Excel bunu "8.69102E+12" yapıp geri getirilemez şekilde
 * bozuyordu; .xlsx doğrudan okununca tam değerini korumalı.
 */
const FIXTURE = join(process.cwd(), "tests/fixtures/market-listesi.xlsx");

async function readFixture() {
  const sheets = await readXlsxFile(readFileSync(FIXTURE));
  const data = sheets.find((sheet) => sheet.data.length > 0)?.data ?? [];
  return data.map((row) => row.map((cell) => sheetCellToText(cell)));
}

describe("gerçek .xlsx dosyasından aktarım", () => {
  it("sayı hücresindeki barkodu bozmadan okur", async () => {
    const result = parseProductRows(await readFixture());
    expect(result.rows.map((row) => row.barcode)).toEqual([
      "8690123456789",
      "8690987654321",
      "8690111111111",
    ]);
    expect(result.skipped).toHaveLength(0);
  });

  it("Türkçe karakterleri bozmaz", async () => {
    const result = parseProductRows(await readFixture());
    expect(result.rows[0]!.name).toBe("Sütaş Süt 1 Lt");
    expect(result.rows[1]!.name).toBe("Çaykur Rize Çayı 500 gr");
  });

  it("fiyat, stok, KDV, birim ve kategoriyi doğru eşler", async () => {
    const result = parseProductRows(await readFixture());
    expect(result.rows[0]).toMatchObject({
      price: 38.5,
      stock: 12,
      vatRate: 1,
      unit: "lt",
      category: "Süt Ürünleri",
    });
    expect(result.rows[1]).toMatchObject({ price: 145.9, stock: 7, vatRate: 10, unit: "gr" });
  });

  /** Barkod metin hücresi olarak da yazılmış olabilir; ikisi de çalışmalı. */
  it("metin hücresindeki barkodu da okur", async () => {
    const result = parseProductRows(await readFixture());
    expect(result.rows[2]).toMatchObject({
      barcode: "8690111111111",
      name: "Eti Çikolatalı Gofret",
      price: 12,
      stock: 150,
    });
  });

  it("sütunları başlıktan kendiliğinden tanır", async () => {
    const result = parseProductRows(await readFixture());
    expect(result.mapping).toMatchObject({
      barcode: 0,
      name: 1,
      price: 2,
      stock: 3,
      vat: 4,
      unit: 5,
      category: 6,
    });
  });
});
