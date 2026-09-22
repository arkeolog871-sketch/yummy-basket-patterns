import { useCallback, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  TriangleAlert,
  Check,
  Download,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoMenuImport } from "@/components/products/PhotoMenuImport";
import { AI_UI_ENABLED } from "@/lib/ai-features";
import { toPublicErrorMessage } from "@/lib/public-error";
import { formatPrice } from "@/lib/format";
import {
  IMPORT_MAX_ROWS,
  missingRequiredFields,
  parseProductRows,
  sheetCellToText,
  toGrid,
  type ImportField,
  type ParsedImport,
} from "@/lib/product-import";
import {
  deleteProductsByCategory,
  importProducts,
  listImportCategories,
  listProductImports,
} from "@/lib/product-import.functions";

/** Sunucu şeması parça başına 500 satır kabul ediyor. */
const CHUNK_SIZE = 500;

const FIELD_LABELS: Record<ImportField, string> = {
  barcode: "Barkod",
  name: "Ürün adı",
  price: "Fiyat",
  stock: "Stok",
  vat: "KDV %",
  unit: "Birim",
  category: "Kategori",
  externalId: "Stok kodu",
};

const FIELD_ORDER: ImportField[] = [
  "barcode",
  "externalId",
  "name",
  "price",
  "stock",
  "vat",
  "unit",
  "category",
];

/**
 * CSV metnini okur.
 *
 * Türkçe Excel CSV'yi çoğunlukla Windows-1254 ile kaydeder; UTF-8 sanıp
 * okursak "Süt" yerine "S�t" çıkar ve ürün adları bozuk kaydedilir. Önce
 * UTF-8 deniyor, değiştirme karakteri (U+FFFD) görürsek 1254 ile yeniden
 * okuyoruz — BOM'lu UTF-8 dosyalar da böylece doğru kalıyor.
 */
async function readCsvText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1254").decode(buffer);
  } catch {
    return utf8;
  }
}

const isXlsxFile = (file: File) => /\.xlsx$/i.test(file.name);
/**
 * Eski Excel biçimi (.xls, BIFF) ayrı ele alınıyor: okuyucu yalnızca .xlsx
 * destekliyor. Ayırt etmeseydik kullanıcı "dosya okunamadı" görüp ne
 * yapacağını bilemezdi; oysa çözüm tek tıklık.
 */
const isLegacyXlsFile = (file: File) => /\.xls$/i.test(file.name);

/** Kullanıcıya ne yapacağını söyleyen, ayırt edilebilir hata. */
export class UnsupportedSpreadsheetError extends Error {}

/**
 * Dosyayı hücre ızgarasına çevirir.
 *
 * Excel desteği neden şart: Türk market programlarının çoğu ürün listesini
 * CSV değil .xlsx verir. Kullanıcı dosyayı Excel'de açıp "CSV olarak kaydet"
 * yaptığında Excel 13 haneli barkodu "8.69102E+12" yapıp GERİ GETİRİLEMEZ
 * şekilde bozuyor — aktarımın en olası başarısızlık sebebi buydu. .xlsx
 * doğrudan okununca barkod hücresi sayı bile olsa tam değerini koruyor,
 * kodlama sorunu da yaşanmıyor (xlsx zaten Unicode).
 *
 * Kütüphane yalnızca Excel dosyası seçildiğinde yükleniyor: paneli açan
 * herkese yüz kilobaytlarca ayrıştırıcı indirtmenin anlamı yok.
 */
async function readSpreadsheetGrid(file: File): Promise<string[][]> {
  if (isLegacyXlsFile(file)) {
    throw new UnsupportedSpreadsheetError(
      "Bu dosya eski Excel biçiminde (.xls). Excel'de açıp \u201cFarklı Kaydet \u2192 Excel Çalışma Kitabı (.xlsx)\u201d ile kaydedip tekrar yükleyin.",
    );
  }
  if (!isXlsxFile(file)) return toGrid(await readCsvText(file));
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  // Kütüphane sayfa dizisi döner ({sheet, data}), satır dizisi değil. Boş
  // olmayan ilk sayfa alınıyor: bazı programlar dosyanın başına kapak/ayar
  // sayfası koyuyor ve körlemesine ilk sayfayı almak boş liste verirdi.
  const sheets = await readXlsxFile(file);
  const data = sheets.find((sheet) => sheet.data.length > 0)?.data ?? [];
  return data.map((row) => row.map((cell) => sheetCellToText(cell)));
}

/**
 * Örnek dosya: market sahibi hangi sütunların beklendiğini görsün diye.
 * Noktalı virgül + BOM ile yazılıyor — Türkçe Excel dosyayı çift tıklayınca
 * sütunlara doğru bölsün ve Türkçe karakterler bozulmasın.
 */
function downloadTemplate() {
  const csv = [
    "Barkod;Stok Kodu;Ürün Adı;Fiyat;Stok;KDV;Birim;Kategori",
    "8690123456789;URN-001;Örnek Ürün 1 Lt;45,90;12;10;adet;İçecek",
    "8690987654321;URN-002;Örnek Ürün 500 gr;38,50;5;1;gr;Gıda",
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ornek-urun-listesi.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/** Select değeri: kategorisiz ürünler için sentinel (boş dize "seçilmedi" demek). */
const UNCATEGORIZED = "__uncategorized__";

/**
 * Kategoriye göre toplu ürün silme. Yanlış kategori seçimine karşı iki
 * aşamalı onay: önce "Sil" düğmesi, sonra kategori adını ve ürün sayısını
 * tekrar gösteren kırmızı onay düğmesi.
 */
function BulkDeleteSection({ restaurantId }: { restaurantId: string | null }) {
  const queryClient = useQueryClient();
  const fetchCategories = useServerFn(listImportCategories);
  const runDelete = useServerFn(deleteProductsByCategory);
  const [choice, setChoice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const categories = useQuery({
    queryKey: ["import-categories", restaurantId],
    queryFn: () => fetchCategories({ data: { restaurantId: restaurantId! } }),
    enabled: Boolean(restaurantId),
  });

  if (!restaurantId) return null;
  const list = categories.data?.categories ?? [];
  const withItems = list.filter((category) => category.itemCount > 0);
  if (categories.data && withItems.length === 0) return null;

  const selected = withItems.find(
    (category) => (category.id ?? UNCATEGORIZED) === choice,
  );

  async function remove() {
    if (!selected || !restaurantId) return;
    setBusy(true);
    try {
      const { deleted } = await runDelete({
        data: { restaurantId, categoryId: selected.id },
      });
      toast.success(`"${selected.name}" kategorisindeki ${deleted} ürün silindi`);
      setChoice("");
      setConfirming(false);
      void categories.refetch();
      void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["business-catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } catch (error) {
      toast.error(toPublicErrorMessage(error, "Ürünler silinemedi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Trash2 className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Kategoriye göre toplu silme</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Seçtiğiniz kategorideki <strong>tüm ürünler</strong> silinir; kategori kaydı ve
            geçmiş siparişler korunur. Bu işlem geri alınamaz.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none sm:min-w-56"
          value={choice}
          onChange={(event) => {
            setChoice(event.target.value);
            setConfirming(false);
          }}
          disabled={busy}
        >
          <option value="">Kategori seçin…</option>
          {withItems.map((category) => (
            <option key={category.id ?? UNCATEGORIZED} value={category.id ?? UNCATEGORIZED}>
              {category.name} ({category.itemCount} ürün)
            </option>
          ))}
        </select>

        {selected && !confirming ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setConfirming(true)}
            disabled={busy}
          >
            <Trash2 className="size-4" /> Sil
          </Button>
        ) : null}

        {selected && confirming ? (
          <Button
            type="button"
            variant="destructive"
            className="rounded-full"
            onClick={() => void remove()}
            disabled={busy}
          >
            {busy
              ? "Siliniyor…"
              : `Evet, "${selected.name}" içindeki ${selected.itemCount} ürünü sil`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ProductImportPanel({
  restaurantId,
  /** Kurucu panelinde işletme seçilmeden aktarım yapılamaz. */
  disabledReason,
}: {
  restaurantId: string | null;
  disabledReason?: string;
}) {
  const runImport = useServerFn(importProducts);
  const fetchImports = useServerFn(listProductImports);
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    enriched: number;
  } | null>(null);

  const history = useQuery({
    queryKey: ["product-imports", restaurantId],
    queryFn: () => fetchImports({ data: { restaurantId: restaurantId! } }),
    enabled: Boolean(restaurantId),
  });

  // Eşleme kullanıcı tarafından değiştirilebildiği için ayrıştırma her
  // değişiklikte yeniden çalışır; dosya bellekte metin olarak tutuluyor.
  const parsed: ParsedImport | null = useMemo(() => {
    if (!grid) return null;
    return parseProductRows(grid, mapping ? { mapping } : {});
  }, [grid, mapping]);

  const missing = parsed ? missingRequiredFields(parsed.mapping) : [];

  const onPickFile = useCallback(async (file: File | undefined) => {
    setResult(null);
    setProgress(0);
    if (!file) return;
    try {
      const cells = await readSpreadsheetGrid(file);
      setFileName(file.name);
      setGrid(cells);
      // Sütun eşlemesi dosyadan yeniden tanınsın; önceki dosyanın eşlemesi
      // yeni dosyaya yanlış uygulanırsa hatanın sebebi anlaşılmaz olurdu.
      setMapping(parseProductRows(cells).mapping);
    } catch (error) {
      toast.error(
        error instanceof UnsupportedSpreadsheetError
          ? error.message
          : "Dosya okunamadı. Excel (.xlsx) veya CSV dosyası seçin.",
      );
    }
  }, []);

  function reset() {
    setFileName(null);
    setGrid(null);
    setMapping(null);
    setResult(null);
    setProgress(0);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit() {
    if (!restaurantId || !parsed || parsed.rows.length === 0) return;
    setBusy(true);
    setProgress(0);
    const totals = { created: 0, updated: 0, skipped: 0, enriched: 0 };
    try {
      let importId: string | null = null;
      // Elenen satırlar ilk parçayla birlikte gönderilir; parça sayısından
      // bağımsız olarak günlükte tek yerde toplansınlar.
      let pendingSkipped = parsed.skipped.slice(0, CHUNK_SIZE);
      for (let index = 0; index < parsed.rows.length; index += CHUNK_SIZE) {
        const chunk = parsed.rows.slice(index, index + CHUNK_SIZE);
        const response = await runImport({
          data: {
            restaurantId,
            importId,
            fileName,
            rows: chunk,
            skipped: pendingSkipped,
            totalRows: parsed.rows.length + parsed.skipped.length,
          },
        });
        pendingSkipped = [];
        importId = response.importId;
        totals.created += response.created;
        totals.updated += response.updated;
        totals.skipped += response.skipped;
        totals.enriched += response.enriched;
        setProgress(Math.min(parsed.rows.length, index + chunk.length));
      }
      totals.skipped = parsed.skipped.length;
      setResult(totals);
      toast.success(`${totals.created} ürün eklendi, ${totals.updated} ürün güncellendi`);
      void history.refetch();
    } catch (error) {
      toast.error(toPublicErrorMessage(error, "Aktarım tamamlanamadı."));
    } finally {
      setBusy(false);
    }
  }

  const blocked = disabledReason ?? (restaurantId ? null : "Önce bir işletme seçin.");

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-warm text-warm-foreground">
            <FileSpreadsheet className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Toplu ürün aktarımı</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Market programınızdan aldığınız ürün listesini yükleyin —{" "}
              <strong>Excel (.xlsx)</strong> veya CSV olabilir. Dosyada <strong>barkod</strong>{" "}
              (veya stok kodu) ve <strong>fiyat</strong> sütunu bulunması yeterli; ad, stok, KDV,
              birim ve kategori varsa onlar da okunur.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Fiyat ve stok her aktarımda güncellenir. Elle düzelttiğiniz ürün adı, görsel ve
              açıklama korunur — aktarım bunları bozmaz.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Programınız Excel veriyorsa <strong>dosyayı olduğu gibi yükleyin</strong>; Excel'de
              açıp CSV'ye çevirmeyin — Excel uzun barkodları bozuyor.
            </p>
          </div>
        </div>

        {blocked ? (
          <p className="mt-4 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">{blocked}</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              // accept BİLEREK "*/*": Android kabuğu web'deki accept listesini
              // dosya seçiciye MIME türü olarak geçiriyor ve indirilen .xlsx
              // dosyaları çoğu zaman application/octet-stream taşıdığı için
              // dar bir listede SOLUK görünüp seçilemiyorlardı (.txt seçilip
              // .xlsx seçilememesinin sebebi buydu). Doğru dosya kontrolünü
              // zaten kendimiz yapıyoruz: uzantıya göre ayrıştırıcı seçiliyor
              // ve tanınmayan dosyada ne yapılacağını söyleyen hata çıkıyor.
              accept="*/*"
              className="hidden"
              onChange={(event) => void onPickFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              <Upload className="size-4" /> Dosya seç
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={downloadTemplate}
            >
              <Download className="size-4" /> Örnek dosya
            </Button>
            {fileName ? (
              <span className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {fileName}
              </span>
            ) : null}
            {fileName ? (
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={reset}
                disabled={busy}
              >
                Temizle
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {AI_UI_ENABLED ? <PhotoMenuImport restaurantId={restaurantId} blocked={blocked} /> : null}

      <BulkDeleteSection restaurantId={restaurantId} />

      {parsed ? (
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="font-semibold">Sütun eşleşmesi</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sütunlar başlık adından otomatik tanındı. Yanlış tanınan varsa buradan düzeltin.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FIELD_ORDER.map((field) => (
              <label key={field} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-muted-foreground">{FIELD_LABELS[field]}</span>
                <select
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  value={parsed.mapping[field] ?? ""}
                  onChange={(event) =>
                    setMapping({
                      ...parsed.mapping,
                      [field]: event.target.value === "" ? undefined : Number(event.target.value),
                    })
                  }
                >
                  <option value="">— yok —</option>
                  {parsed.headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>
                      {header || `Sütun ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {missing.length > 0 ? (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Aktarım için {missing.map((field) => FIELD_LABELS[field]).join(" ve ")} sütunu
                gerekli. Yukarıdan seçin.
              </span>
            </p>
          ) : null}

          {/* Hiçbir satır okunamadıysa sebebini söyle. Yalnızca "0 ürün
              okunacak" yazmak, yanlış dosya seçen kişiye neyin yanlış
              olduğunu anlatmıyordu — nitekim bir metin dosyası seçildiğinde
              panel sessizce 0 gösterdi. */}
          {parsed.rows.length === 0 && missing.length === 0 ? (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Bu dosyadan hiç ürün okunamadı — ürün listesine benzemiyor. Market programınızdan
                aldığınız <strong>stok listesi</strong> dosyasını (Excel veya CSV) seçtiğinizden
                emin olun; ilk satırında <strong>Barkod</strong> ve <strong>Fiyat</strong> gibi
                sütun başlıkları bulunmalı.
              </span>
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span>
              <strong>{parsed.rows.length}</strong> ürün okunacak
            </span>
            {parsed.skipped.length > 0 ? (
              <span className="text-destructive">
                <strong>{parsed.skipped.length}</strong> satır atlanacak
              </span>
            ) : null}
            {parsed.rows.length + parsed.skipped.length >= IMPORT_MAX_ROWS ? (
              <span className="text-muted-foreground">
                (ilk {IMPORT_MAX_ROWS.toLocaleString("tr")} satır)
              </span>
            ) : null}
          </div>

          {parsed.rows.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-border/70">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">Barkod</th>
                    <th className="p-2 font-medium">Ad</th>
                    <th className="p-2 font-medium">Fiyat</th>
                    <th className="p-2 font-medium">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 8).map((row) => (
                    <tr key={row.line} className="border-t border-border/60">
                      <td className="p-2 text-xs text-muted-foreground">
                        {row.barcode ?? row.externalId}
                      </td>
                      <td className="p-2 [overflow-wrap:anywhere]">{row.name ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">{formatPrice(row.price)}</td>
                      <td className="p-2">{row.stock ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {parsed.skipped.length > 0 ? (
            <details className="mt-3 rounded-2xl border border-border/70 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Atlanan {parsed.skipped.length} satırı gör
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {parsed.skipped.slice(0, 50).map((row) => (
                  <li key={row.line} className="[overflow-wrap:anywhere]">
                    <strong>Satır {row.line}:</strong> {row.reason}
                    {row.raw ? ` — ${row.raw}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="rounded-full"
              disabled={busy || parsed.rows.length === 0 || missing.length > 0 || !restaurantId}
              onClick={() => void submit()}
            >
              {busy
                ? `Aktarılıyor… ${progress}/${parsed.rows.length}`
                : `${parsed.rows.length} ürünü aktar`}
            </Button>
            {result ? (
              <span className="flex items-center gap-1 text-sm text-success">
                <Check className="size-4" />
                {result.created} eklendi · {result.updated} güncellendi
                {result.enriched > 0 ? ` · ${result.enriched} ürün katalogdan tamamlandı` : ""}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {history.data && history.data.imports.length > 0 ? (
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="font-semibold">Son aktarımlar</p>
          <ul className="mt-3 space-y-2 text-sm">
            {history.data.imports.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {new Date(row.created_at).toLocaleString("tr")}
                  {row.file_name ? ` · ${row.file_name}` : ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.created_count} yeni · {row.updated_count} güncel
                  {row.skipped_count > 0 ? ` · ${row.skipped_count} atlandı` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
