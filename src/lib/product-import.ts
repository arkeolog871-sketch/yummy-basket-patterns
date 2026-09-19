/**
 * Market ürün listesi (CSV/Excel aktarımı) okuma ve normalleştirme.
 *
 * Hedef kitle Silvan ölçeğindeki bağımsız marketler: ürün listesini kendi
 * otomasyonundan (Wolvox, Mikro, Zirve, Barkodsan…) "dışa aktar" ile alıp
 * panele yüklüyorlar. Bu dosya saf (yan etkisiz) kalır ki test edilebilsin;
 * veritabanına yazan kısım product-import.functions.ts'te.
 *
 * Bu listelerin gerçekte nasıl geldiğini varsayım yapmadan ele alıyoruz:
 * - Türkçe Excel CSV'yi NOKTALI VİRGÜLLE ayırır, virgülle değil.
 * - Dosya başında BOM (U+FEFF) olur; ilk başlık adı eşleşmez hale gelir.
 * - Fiyat "12,50" ya da "1.234,56" yazılır.
 * - Excel 13 haneli barkodu SAYI sanıp "8.69102E+12" yapar; bu geri
 *   döndürülemez bir kayıptır, sessizce almak yerine satırı reddediyoruz.
 * - Barkod alanı metin biçimlendirildiğinde başına kesme işareti ('8690...)
 *   gelir.
 */

export const IMPORT_UNITS = ["adet", "kg", "gr", "lt", "ml", "paket", "koli"] as const;
export type ImportUnit = (typeof IMPORT_UNITS)[number];

export type ImportField =
  "barcode" | "name" | "price" | "stock" | "vat" | "unit" | "category" | "externalId";

export type ImportRow = {
  /** Dosyadaki satır numarası (başlık 1. satır); hata mesajlarında gösterilir. */
  line: number;
  barcode: string | null;
  externalId: string | null;
  name: string | null;
  price: number;
  stock: number | null;
  vatRate: number | null;
  unit: ImportUnit | null;
  category: string | null;
};

export type SkippedRow = { line: number; reason: string; raw: string };

export type ParsedImport = {
  headers: string[];
  mapping: Partial<Record<ImportField, number>>;
  rows: ImportRow[];
  skipped: SkippedRow[];
};

/** Başlık adı eşleştirmesi: küçük harf, Türkçe harfler sadeleştirilmiş, boşluksuz. */
function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Başlık adlarının bilinen karşılıkları. Aynı programın farklı sürümleri bile
 * farklı ad kullandığı için liste geniş tutuluyor; eşleşmeyen sütun yok sayılır.
 */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  barcode: ["barkod", "barkodno", "barcode", "ean", "ean13", "gtin", "barkod1"],
  name: ["ad", "adi", "isim", "urunadi", "stokadi", "malzemeadi", "aciklama", "name", "urun"],
  price: [
    "fiyat",
    "satisfiyati",
    "satisfiyat",
    "birimfiyat",
    "birimfiyati",
    "perakendefiyat",
    "perakendesatisfiyati",
    "price",
    "tutar",
    "kdvlifiyat",
  ],
  stock: ["stok", "stokmiktari", "miktar", "adet", "bakiye", "stock", "quantity"],
  vat: ["kdv", "kdvorani", "kdvyuzde", "vat", "vergi"],
  unit: ["birim", "olcubirimi", "unit", "birimi"],
  category: ["kategori", "grup", "urungrubu", "anagrup", "reyon", "category"],
  externalId: ["stokkodu", "urunkodu", "kod", "stokkod", "sku", "malzemekodu"],
};

/** Başlık satırından alan -> sütun indeksi eşlemesi çıkarır. */
export function detectColumns(headers: string[]): Partial<Record<ImportField, number>> {
  const normalized = headers.map(normalizeHeader);
  const mapping: Partial<Record<ImportField, number>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ImportField, string[]][]) {
    // Önce birebir eşleşme; bulunamazsa "içeren" eşleşme. Birebir önce gelmeli:
    // "stokkodu" hem externalId hem (içerdiği için) stock'a benziyor.
    let index = normalized.findIndex((header) => aliases.includes(header));
    if (index < 0) {
      index = normalized.findIndex(
        (header) => header.length > 2 && aliases.some((alias) => header === alias),
      );
    }
    if (index >= 0) mapping[field] = index;
  }
  return mapping;
}

/**
 * Para/sayı okur. `parseDecimalInput`ten farkı binlik ayırıcıyı da çözmesi:
 * fiyat listelerinde "1.234,56" sık görülür, form alanlarında görülmez.
 * İki ayırıcı birden varsa SONDAKİ ondalıktır — hem "1.234,56" hem "1,234.56"
 * doğru okunur.
 */
export function parseImportNumber(value: string): number | null {
  const text = value.trim().replace(/\s|₺|TL/gi, "");
  if (!text) return null;
  if (!/^-?[\d.,]+$/.test(text)) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalAt = Math.max(lastComma, lastDot);
    normalized = text.slice(0, decimalAt).replace(/[.,]/g, "") + "." + text.slice(decimalAt + 1);
  } else if (lastComma >= 0) {
    normalized = text.replace(",", ".");
  } else {
    normalized = text;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Barkodu temizler. Excel'in bilimsel gösterime çevirdiği ("8.69102E+12")
 * değerler geri getirilemez; null yerine "bozuk" işareti döndürmek için
 * çağıran taraf bunu ayrı ele alır.
 */
export function normalizeBarcode(value: string): { barcode: string | null; corrupt: boolean } {
  const text = value.trim().replace(/^'/, "");
  if (!text) return { barcode: null, corrupt: false };
  if (/e\+?\d+$/i.test(text)) return { barcode: null, corrupt: true };
  const digits = text.replace(/\D/g, "");
  if (!digits) return { barcode: null, corrupt: false };
  // EAN-8, UPC-A(12), EAN-13, ITF-14 ve markete özel 6-7 haneli tartı
  // barkodları. Daha uzunu bozuk veriye işaret eder.
  if (digits.length < 6 || digits.length > 14) return { barcode: null, corrupt: true };
  return { barcode: digits, corrupt: false };
}

export function normalizeUnit(value: string): ImportUnit | null {
  const text = normalizeHeader(value);
  if (!text) return null;
  const direct = IMPORT_UNITS.find((unit) => unit === text);
  if (direct) return direct;
  const aliases: Record<string, ImportUnit> = {
    ad: "adet",
    ades: "adet",
    tane: "adet",
    kilogram: "kg",
    kilo: "kg",
    gram: "gr",
    g: "gr",
    litre: "lt",
    l: "lt",
    mililitre: "ml",
    pk: "paket",
    kt: "koli",
    kutu: "koli",
  };
  return aliases[text] ?? null;
}

/**
 * Excel (.xlsx) hücresini metne çevirir.
 *
 * Asıl mesele barkod: market programı barkodu SAYI hücresi olarak yazmış
 * olabilir. 13-14 haneli barkod 2^53'ün altında kaldığı için değer tam
 * korunur ve burada tam sayı biçiminde yazılır — CSV yolunda Excel'in
 * "8.69102E+12" yapıp geri getirilemez şekilde bozduğu hata .xlsx'te hiç
 * oluşmuyor.
 *
 * Tarih hücreleri boş dönüyor: ürün listelerinde eşlenen bir alana denk
 * gelmiyorlar ve "Mon Sep 19 2026..." gibi bir metin ürün adına yazılsa
 * zarardan başka bir şey olmaz.
 */
export function sheetCellToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return "";
  return String(value);
}

/** Tek satırlık CSV/TSV ayrıştırma: tırnaklı alanlar ve kaçışlı tırnak dahil. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Ayırıcıyı başlık satırından tahmin eder. Türkçe Excel noktalı virgül
 * kullandığı için önce onu deniyoruz; yanlış tahmin tüm satırı tek sütun
 * yapıp dosyayı okunamaz gösterirdi.
 */
export function detectDelimiter(headerLine: string): string {
  const candidates = [";", "\t", ",", "|"];
  let best = ";";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = splitLine(headerLine, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export type ParseOptions = {
  /** Kullanıcı sütun eşlemesini elle düzelttiyse bu geçersiz kılar. */
  mapping?: Partial<Record<ImportField, number>>;
  maxRows?: number;
};

export const IMPORT_MAX_ROWS = 20000;

/**
 * CSV metnini hücre ızgarasına çevirir. Ayrıştırmanın Türkçeye özgü kısmı
 * (başlık tanıma, fiyat, barkod, birim) `parseProductRows`'ta ortak; burada
 * yalnızca metni satır/sütuna bölmek var.
 */
export function toGrid(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]!);
  return lines.map((line) => splitLine(line, delimiter));
}

export function parseProductFile(text: string, options: ParseOptions = {}): ParsedImport {
  return parseProductRows(toGrid(text), options);
}

/**
 * Asıl ayrıştırıcı: kaynağı ne olursa olsun (CSV ya da Excel) hücre
 * ızgarasından ürün satırlarını çıkarır.
 *
 * Excel yolu bu yüzden var: Türk market programlarının çoğu listeyi CSV
 * değil .xlsx verir. Kullanıcı dosyayı Excel'de açıp "CSV olarak kaydet"
 * yaptığında Excel 13 haneli barkodu bilimsel gösterime çevirip geri
 * getirilemez şekilde bozuyordu. .xlsx doğrudan okununca barkod hücresi
 * sayı bile olsa tam değerini koruyor — sorun kaynağında bitiyor.
 */
export function parseProductRows(grid: string[][], options: ParseOptions = {}): ParsedImport {
  if (grid.length === 0) return { headers: [], mapping: {}, rows: [], skipped: [] };

  const headers = (grid[0] ?? []).map((header) => header.trim());
  const mapping = options.mapping ?? detectColumns(headers);
  const maxRows = options.maxRows ?? IMPORT_MAX_ROWS;

  const rows: ImportRow[] = [];
  const skipped: SkippedRow[] = [];
  const seenBarcodes = new Set<string>();

  for (let i = 1; i < grid.length && rows.length + skipped.length < maxRows; i += 1) {
    const line = i + 1;
    const cells = grid[i] ?? [];
    // Tamamen boş satır (Excel dosyalarında sonda sık olur) sessizce atlanır;
    // "atlandı" listesini gereksiz yere şişirmesin.
    if (cells.every((value) => !value || !value.trim())) continue;
    const cell = (field: ImportField): string => {
      const index = mapping[field];
      return index == null ? "" : (cells[index] ?? "");
    };

    const { barcode, corrupt } = normalizeBarcode(cell("barcode"));
    if (corrupt) {
      skipped.push({
        line,
        reason:
          "Barkod okunamadı (Excel sayıya çevirmiş olabilir). Barkod sütununu 'Metin' biçiminde kaydedip tekrar aktarın.",
        raw: cell("barcode").trim(),
      });
      continue;
    }

    const externalId = cell("externalId").trim().slice(0, 64) || null;
    if (!barcode && !externalId) {
      skipped.push({ line, reason: "Barkod ve stok kodu boş", raw: cell("name").trim() });
      continue;
    }

    const price = parseImportNumber(cell("price"));
    if (price == null) {
      skipped.push({
        line,
        reason: "Fiyat okunamadı",
        raw: `${barcode ?? externalId} — ${cell("price").trim()}`,
      });
      continue;
    }
    if (price < 0 || price > 100000) {
      skipped.push({
        line,
        reason: "Fiyat aralık dışı (0 – 100.000 ₺)",
        raw: `${barcode ?? externalId} — ${cell("price").trim()}`,
      });
      continue;
    }

    // Aynı dosyada tekrarlayan barkod: tek ürüne iki fiyat yazmak yerine
    // ilkini alıp ikincisini nedeniyle birlikte bildiriyoruz.
    if (barcode && seenBarcodes.has(barcode)) {
      skipped.push({ line, reason: "Bu barkod dosyada tekrar ediyor", raw: barcode });
      continue;
    }
    if (barcode) seenBarcodes.add(barcode);

    const stock = parseImportNumber(cell("stock"));
    const vat = parseImportNumber(cell("vat"));
    const name = cell("name").trim().slice(0, 80) || null;

    rows.push({
      line,
      barcode,
      externalId,
      name,
      price: Math.round(price * 100) / 100,
      // Stok tam sayıya yuvarlanır: şemada integer. Tartılı ürün (0,5 kg)
      // desteği ayrı bir iş; yuvarlamak stoku eksik göstermekten iyi.
      stock: stock == null ? null : Math.max(0, Math.min(1_000_000, Math.round(stock))),
      vatRate: vat == null ? null : Math.max(0, Math.min(100, vat)),
      unit: normalizeUnit(cell("unit")),
      category: cell("category").trim().slice(0, 60) || null,
    });
  }

  return { headers, mapping, rows, skipped };
}

/** Eşlemenin aktarım için yeterli olup olmadığı; arayüz uyarısı için. */
export function missingRequiredFields(
  mapping: Partial<Record<ImportField, number>>,
): ImportField[] {
  const missing: ImportField[] = [];
  if (mapping.barcode == null && mapping.externalId == null) missing.push("barcode");
  if (mapping.price == null) missing.push("price");
  return missing;
}
