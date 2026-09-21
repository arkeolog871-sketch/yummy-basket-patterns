/**
 * Köprüden gelen dosyanın sunucuda okunup kataloğa işlenmesi.
 *
 * TASARIM KARARI — köprü "aptal yükleyici"dir:
 * Marketin bilgisayarındaki program dosyayı olduğu gibi gönderir, ayrıştırma
 * burada yapılır. Alternatif (köprünün ayrıştırıp JSON göndermesi) Türkçe
 * biçim tuzaklarını — noktalı virgül ayracı, virgüllü ondalık, Windows-1254,
 * bilimsel gösterime dönmüş barkod — ikinci bir yerde yeniden çözmeyi
 * gerektirirdi. Buradaki ayrıştırıcı panelin kullandığının AYNISI ve
 * testlerle korunuyor; köprü bozulduğunda bile biçim mantığı tek yerde kalır.
 */
import {
  IMPORT_MAX_ROWS,
  missingRequiredFields,
  parseProductRows,
  sheetCellToText,
  toGrid,
  type ParsedImport,
} from "./product-import";

/** Panelin parça boyutuyla aynı: RPC'ye tek seferde gidecek satır sayısı. */
const SYNC_CHUNK = 500;

/** Köprü dosyası üst sınırı; 5.000 ürünlük bir liste ~500 KB. */
export const SYNC_MAX_BYTES = 20 * 1024 * 1024;

export class SyncFileError extends Error {}

const isXlsxName = (name: string) => /\.xlsx$/i.test(name);
const isLegacyXlsName = (name: string) => /\.xls$/i.test(name);

/**
 * CSV metnini çözer. Türk market programlarının çoğu Windows-1254 yazıyor;
 * UTF-8 çözümü bozuk karakter (U+FFFD) üretiyorsa ona düşülür — panelle
 * birebir aynı kural.
 */
function decodeCsv(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1254").decode(bytes);
  } catch {
    return utf8;
  }
}

/** Dosya baytlarını hücre ızgarasına çevirir (CSV veya XLSX). */
export async function gridFromUpload(fileName: string, bytes: ArrayBuffer): Promise<string[][]> {
  if (isLegacyXlsName(fileName)) {
    throw new SyncFileError(
      "Eski Excel biçimi (.xls) okunamıyor. Market programından .xlsx veya CSV olarak dışa aktarın.",
    );
  }
  if (!isXlsxName(fileName)) return toGrid(decodeCsv(bytes));

  // "universal" varyantı DOM gerektirmiyor; Workers'da da ArrayBuffer ile
  // çalışıyor (tarayıcı tarafı "browser" varyantını kullanıyor).
  const { default: readXlsxFile } = await import("read-excel-file/universal");
  // Kütüphane sayfa dizisi döner. Boş olmayan ilk sayfa alınıyor: bazı
  // programlar dosyanın başına kapak/ayar sayfası koyuyor.
  const sheets = await readXlsxFile(bytes as never, { getSheets: true } as never);
  const list = sheets as unknown as { data?: unknown[][] }[];
  const data = list.find((sheet) => (sheet.data?.length ?? 0) > 0)?.data ?? [];
  return data.map((row) => row.map((cell) => sheetCellToText(cell)));
}

export type SyncImportResult = {
  importId: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
};

/**
 * Ayrıştırılmış satırları kataloğa işler. Panelin sunucu fonksiyonuyla aynı
 * RPC'yi kullanır (`import_menu_items`): fiyat/stok her seferinde güncellenir,
 * elle düzeltilmiş ad/görsel/açıklama korunur, aynı dosya iki kez gelse bile
 * kopya ürün üretmez. Otomatik senkronu güvenli kılan da bu: köprü aynı
 * listeyi saatte bir gönderse sonuç değişmez.
 */
export async function runSyncImport(options: {
  restaurantId: string;
  fileName: string;
  parsed: ParsedImport;
}): Promise<SyncImportResult> {
  const { restaurantId, fileName, parsed } = options;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Panelin kullandığı yardımcıların AYNISI: kategori açma, ortak katalogdan
  // ad/görsel doldurma ve katalogu zenginleştirme iki yerde farklı
  // davranmasın diye kopyalanmıyor, paylaşılıyor.
  const { resolveCategories, lookupCatalog, contributeToCatalog, normalizeName } =
    await import("./product-import.functions");

  let created = 0;
  let updated = 0;
  for (let index = 0; index < parsed.rows.length; index += SYNC_CHUNK) {
    const chunk = parsed.rows.slice(index, index + SYNC_CHUNK);

    const categoryNames = [
      ...new Set(chunk.map((row) => row.category).filter((name): name is string => Boolean(name))),
    ];
    const categories = await resolveCategories(restaurantId, categoryNames);
    const catalog = await lookupCatalog(
      chunk.map((row) => row.barcode).filter((barcode): barcode is string => Boolean(barcode)),
    );

    const payload = chunk.map((row) => {
      const entry = row.barcode ? catalog.get(row.barcode) : undefined;
      return {
        barcode: row.barcode,
        external_id: row.externalId,
        // Ad önceliği ortak katalog: insan eliyle düzeltilmiş "Coca-Cola 1 L"
        // marketin "COCA COLA 1LT PET" yazımına yenilmesin.
        name: entry?.name ?? row.name,
        price: row.price,
        stock: row.stock,
        vat_rate: row.vatRate ?? entry?.default_vat_rate ?? null,
        unit: row.unit ?? entry?.unit ?? null,
        category_id: row.category ? (categories.get(normalizeName(row.category)) ?? null) : null,
        image_url: entry?.image_url ?? null,
      };
    });

    const { data, error } = await supabaseAdmin.rpc("import_menu_items", {
      p_restaurant_id: restaurantId,
      p_rows: payload,
    });
    if (error) throw new Error(error.message);
    const first = Array.isArray(data) ? data[0] : data;
    created += Number(first?.created_count ?? 0);
    updated += Number(first?.updated_count ?? 0);
    await contributeToCatalog(restaurantId, chunk);
  }

  const { data: log, error: logError } = await supabaseAdmin
    .from("product_imports")
    .insert({
      restaurant_id: restaurantId,
      actor_id: null,
      // Panelden gelen 'csv' ile ayrışsın: işletme hangi aktarımın otomatik
      // olduğunu görebilmeli.
      source: "api",
      file_name: fileName,
      total_rows: parsed.rows.length + parsed.skipped.length,
      created_count: created,
      updated_count: updated,
      skipped_count: parsed.skipped.length,
      skipped: parsed.skipped.length > 0 ? parsed.skipped.slice(0, 200) : null,
    })
    .select("id")
    .single();
  if (logError) throw new Error(logError.message);

  return {
    importId: log.id,
    totalRows: parsed.rows.length,
    created,
    updated,
    skipped: parsed.skipped.length,
  };
}

/** Dosyadan satırlara: okuma + doğrulama tek yerde. */
export async function parseSyncUpload(fileName: string, bytes: ArrayBuffer): Promise<ParsedImport> {
  if (bytes.byteLength === 0) throw new SyncFileError("Dosya boş.");
  if (bytes.byteLength > SYNC_MAX_BYTES) {
    throw new SyncFileError("Dosya çok büyük (en fazla 20 MB).");
  }
  const grid = await gridFromUpload(fileName, bytes);
  const parsed = parseProductRows(grid);

  const missing = missingRequiredFields(parsed.mapping);
  if (missing.length > 0) {
    throw new SyncFileError(
      "Dosyada barkod (veya stok kodu) ve fiyat sütunu bulunamadı. Market programının dışa aktarma ayarlarını kontrol edin.",
    );
  }
  if (parsed.rows.length === 0) {
    throw new SyncFileError("Bu dosyadan hiç ürün okunamadı — ürün listesine benzemiyor.");
  }
  if (parsed.rows.length > IMPORT_MAX_ROWS) {
    throw new SyncFileError(`Dosyada ${IMPORT_MAX_ROWS} satırdan fazla ürün var.`);
  }
  return parsed;
}
