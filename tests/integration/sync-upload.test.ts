import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SyncFileError, gridFromUpload, parseSyncUpload } from "@/lib/sync-import.server";

/**
 * Köprü ucunun ayrıştırma yarısı — sunucuda, DOM olmadan.
 *
 * Panel tarayıcıda "read-excel-file/browser", sunucu "…/universal" kullanıyor.
 * İkisi ayrı kod yolu olduğu için sunucu yolunun gerçek bir market dosyasıyla
 * çalıştığı ayrıca ölçülmeli.
 */

const bytesOf = (path: string): ArrayBuffer => {
  const buffer = readFileSync(join(process.cwd(), path));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

const encode = (text: string): ArrayBuffer => {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

describe("köprüden gelen dosyanın sunucuda okunması", () => {
  it("gerçek bir .xlsx market listesini DOM olmadan okur", async () => {
    expect(typeof document).toBe("undefined");
    const parsed = await parseSyncUpload(
      "market-listesi.xlsx",
      bytesOf("tests/fixtures/market-listesi.xlsx"),
    );
    expect(parsed.rows.length).toBeGreaterThan(0);
    const first = parsed.rows[0]!;
    expect(first.barcode ?? first.externalId).toBeTruthy();
    expect(first.price).toBeGreaterThan(0);
  });

  it("noktalı virgüllü, virgül ondalıklı Türkçe CSV'yi okur", async () => {
    const csv = "Barkod;Ürün Adı;Fiyat;Stok\r\n8690000000012;Süt 1 L;45,90;12\r\n";
    const parsed = await parseSyncUpload("stok.csv", encode(csv));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.barcode).toBe("8690000000012");
    // 45,90 -> 45.9 olmalı; 4590 olursa fiyatlar 100 katına çıkardı.
    expect(parsed.rows[0]!.price).toBeCloseTo(45.9, 2);
  });

  it("Windows-1254 kodlu dosyada Türkçe karakterleri bozmaz", async () => {
    // Market programlarının çoğu UTF-8 değil Windows-1254 yazıyor.
    const line = "Barkod;Ürün Adı;Fiyat\r\n8690000000029;Çikolatalı Gofret;12,50\r\n";
    const win1254 = Buffer.from(
      line.replace(/Ü/g, "\xdc").replace(/ü/g, "\xfc").replace(/Ç/g, "\xc7").replace(/ı/g, "\xfd"),
      "latin1",
    );
    const parsed = await parseSyncUpload(
      "stok.csv",
      win1254.buffer.slice(win1254.byteOffset, win1254.byteOffset + win1254.byteLength),
    );
    expect(parsed.rows[0]!.name).toContain("Gofret");
    expect(parsed.rows[0]!.name).not.toContain("�");
  });

  it("eski .xls biçimini ne yapacağını söyleyerek reddeder", async () => {
    await expect(parseSyncUpload("stok.xls", encode("x"))).rejects.toThrow(SyncFileError);
    await expect(parseSyncUpload("stok.xls", encode("x"))).rejects.toThrow(/\.xlsx veya CSV/);
  });

  it("ürün listesine benzemeyen dosyayı sessizce içeri almaz", async () => {
    // Yaşanmış olay: kullanıcı yanlış dosyayı seçti, "0 ürün" geldi ve sebebi
    // görünmedi. Köprüde bu daha da tehlikeli: kimse bakmıyor.
    const parsed = parseSyncUpload("notlar.csv", encode("bir\niki\nüç\n"));
    await expect(parsed).rejects.toThrow(SyncFileError);
  });

  it("boş dosyayı reddeder", async () => {
    await expect(parseSyncUpload("stok.csv", new ArrayBuffer(0))).rejects.toThrow(/boş/i);
  });

  it("çok büyük dosyayı okumadan reddeder", async () => {
    const huge = new ArrayBuffer(21 * 1024 * 1024);
    await expect(parseSyncUpload("stok.csv", huge)).rejects.toThrow(/çok büyük/i);
  });

  it("kapak sayfası olan .xlsx'te ilk DOLU sayfayı alır", async () => {
    // Bazı programlar dosyanın başına ayar sayfası koyuyor; körlemesine ilk
    // sayfayı almak boş liste verirdi.
    const grid = await gridFromUpload(
      "market-listesi.xlsx",
      bytesOf("tests/fixtures/market-listesi.xlsx"),
    );
    expect(grid.length).toBeGreaterThan(1);
    expect(grid[0]!.some((cell) => cell.trim().length > 0)).toBe(true);
  });
});
