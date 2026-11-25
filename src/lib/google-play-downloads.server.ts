import { SignJWT, importPKCS8 } from "jose";

/**
 * Google Play'in "Play Developer Reporting API"si (playdeveloperreporting.googleapis.com)
 * yalnızca çökme/ANR gibi sağlık metrikleri veriyor — kurulum/indirme sayısı YOK.
 * Gerçek kurulum sayıları Play Console'un hesaba özel, Google'ın yönettiği
 * Cloud Storage kovasına (gs://pubsite_prod_<hesap kimliği>/stats/installs/...)
 * aylık CSV olarak düşüyor. Erişim, servis hesabına Play Console'da hesap
 * düzeyinde "Uygulama bilgilerini görüntüleme ve toplu raporları indirme"
 * izni verilerek açılıyor.
 *
 * ÖLÇÜLDÜ (canlı): bu izin yalnızca tek bir dosyayı adıyla İNDİRMEYE
 * (storage.objects.get) yetiyor, dizini LİSTELEMEYE (storage.objects.list)
 * yetmiyor — "Permission 'storage.objects.list' denied" ile reddediliyor.
 * Bu yüzden dosya adı listeden bulunmuyor, Play'in belgelenen adlandırma
 * kalıbına göre doğrudan tahmin edilip indiriliyor.
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

let cachedServiceAccount: ServiceAccount | null | undefined;
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function readServiceAccount(): ServiceAccount | null {
  if (cachedServiceAccount !== undefined) return cachedServiceAccount;
  const raw = process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
  if (!raw) {
    cachedServiceAccount = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) {
      console.error("[play-downloads] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON eksik alanlar içeriyor");
      cachedServiceAccount = null;
      return null;
    }
    cachedServiceAccount = { client_email: parsed.client_email, private_key: parsed.private_key };
    return cachedServiceAccount;
  } catch {
    console.error("[play-downloads] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON geçerli JSON değil");
    cachedServiceAccount = null;
    return null;
  }
}

/** Yalnız GCS'ten salt okunur indirme; FCM/Reporting API'den farklı bir scope. */
const STORAGE_READONLY_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const privateKey = await importPKCS8(account.private_key, "RS256");
  const jwt = await new SignJWT({ scope: STORAGE_READONLY_SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google Play OAuth token değişimi başarısız: ${response.status}`);
  }
  const json = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

/** Yayınlanan Android paket adı (capacitor.config.json / google-services.json ile aynı). */
const PACKAGE_NAME = "online.uygulamamcebimde.app";

function yyyyMM(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

/**
 * Play'in belgelediği dosya adı kalıbı: installs_<paket>_<yyyyMM>_<boyut>.csv.
 * "overview" (boyutsuz) dosyanın her zaman var olduğu belgelerde teyit
 * edilemedi; "country" boyutlu dosya kesin var ve her ülkenin kümülatif
 * sütunu toplanarak aynı toplam elde edilir (bkz. parseInstallCsv). Bu ay
 * henüz rapor düşmemiş olabileceği için bir önceki ay da denenir.
 */
export function candidateInstallFiles(now: Date): string[] {
  const thisMonth = yyyyMM(now);
  const previousMonth = yyyyMM(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const files: string[] = [];
  for (const month of [thisMonth, previousMonth]) {
    for (const dimension of ["overview", "country"]) {
      files.push(`stats/installs/installs_${PACKAGE_NAME}_${month}_${dimension}.csv`);
    }
  }
  return files;
}

/** `objectName` yoksa (404) null döner; her başka durumda (yetki vb.) fırlatır. */
async function downloadObjectIfExists(
  bucket: string,
  objectName: string,
  accessToken: string,
): Promise<ArrayBuffer | null> {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Play kurulum dosyası indirilemedi: ${response.status} ${body.slice(0, 300)}`);
  }
  return response.arrayBuffer();
}

/**
 * Google'ın bulut deposundaki CSV'ler UTF-16'dır (Google'ın kendi BigQuery
 * belgesi de bunu dönüştürmeyi şart koşuyor). BOM'a göre LE/BE ayırt edilir;
 * BOM yoksa UTF-8 olarak okunur (biçim değişirse sessizce bozulmak yerine).
 */
export function decodeInstallCsv(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  if (view.length >= 2 && view[0] === 0xff && view[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(view.subarray(2));
  }
  if (view.length >= 2 && view[0] === 0xfe && view[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(view.subarray(2));
  }
  return new TextDecoder("utf-8").decode(view);
}

export type InstallStats = {
  /**
   * "Total User Installs" sütunu varsa, o sütunu DOLU olarak taşıyan en
   * güncel tarihteki (tüm boyut satırları toplanmış) kümülatif değer. Play
   * en güncel günün bu hücresini bazen boş yayınlıyor; o gün atlanıp bir
   * önceki dolu güne düşülür (bkz. `lastDate`).
   */
  totalInstalls: number | null;
  /** O sütun yoksa yedek: "Daily Device Installs" sütununun toplamı (dosya kapsamındaki dönem). */
  periodInstalls: number | null;
  /** `totalInstalls`'ın ait olduğu tarih; o hesaplanamadıysa dosyadaki en güncel tarih. */
  lastDate: string | null;
  /** Teşhis için: dosyada gerçekte bulunan sütun adları. */
  columns: string[];
};

const TOTAL_COLUMN_CANDIDATES = ["total user installs", "total installs"];
const PERIOD_COLUMN_CANDIDATES = ["daily device installs", "daily user installs"];
const DATE_COLUMN_CANDIDATES = ["date"];

function findColumnIndex(header: string[], candidates: string[]): number {
  const lower = header.map((cell) => cell.trim().toLowerCase());
  for (const candidate of candidates) {
    const index = lower.indexOf(candidate);
    if (index !== -1) return index;
  }
  return -1;
}

/** Basit CSV satır ayrıştırıcı: bu raporların alanlarında virgül/tırnak geçmiyor. */
function parseCsvLines(text: string): string[][] {
  return text
    .split(/\r\n|\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(","));
}

/**
 * Dosya boyuta bölünmüş olabilir (ör. "country"): aynı tarihte birden çok
 * satır olur, her biri bir ülkenin kümülatif toplamını taşır. En güncel
 * tarihteki TÜM satırların toplamı, boyutsuz dosyadaki tek satırla aynı
 * global toplamı verir — bu yüzden "son satır" yerine "en güncel tarihteki
 * satırların toplamı" kullanılıyor.
 */
export function parseInstallCsv(text: string): InstallStats {
  const rows = parseCsvLines(text);
  if (rows.length === 0) {
    return { totalInstalls: null, periodInstalls: null, lastDate: null, columns: [] };
  }
  const header = rows[0]!;
  const dataRows = rows.slice(1);
  const totalIndex = findColumnIndex(header, TOTAL_COLUMN_CANDIDATES);
  const periodIndex = findColumnIndex(header, PERIOD_COLUMN_CANDIDATES);
  const dateIndex = findColumnIndex(header, DATE_COLUMN_CANDIDATES);

  const toNumber = (raw: string | undefined): number | null => {
    if (raw === undefined) return null;
    const trimmed = raw.trim();
    // Boş hücreyi sayı say(ma): Number("") === 0 olduğu için boş bırakılmış bir
    // hücre sessizce "0" olarak toplanıyordu (YAŞANDI: Play en güncel günün
    // kümülatif sütununu bazen henüz doldurmadan yayınlıyor, bu da gerçek
    // kurulum sayısı yerine panelde "0" göstermeye yol açtı).
    if (trimmed === "") return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  };

  // "En güncel tarih" yerine "kümülatif sütunu dolu olan en güncel tarih"
  // kullanılır: o günün hücresi henüz boşsa bir önceki (dolu) güne düşülür.
  let totalInstalls: number | null = null;
  let lastDate: string | null = null;
  if (totalIndex !== -1 && dateIndex !== -1) {
    const sumsByDate = new Map<string, number>();
    for (const row of dataRows) {
      const date = row[dateIndex];
      const value = toNumber(row[totalIndex]);
      if (!date || value === null) continue;
      sumsByDate.set(date, (sumsByDate.get(date) ?? 0) + value);
    }
    const latestWithData = [...sumsByDate.keys()].sort().at(-1) ?? null;
    if (latestWithData !== null) {
      totalInstalls = sumsByDate.get(latestWithData)!;
      lastDate = latestWithData;
    }
  }
  // Toplam sütunu hiç bulunamadıysa (ör. sütun adı eşleşmedi) yine de
  // dosyadaki en güncel tarihi raporla; teşhis için faydalı.
  if (lastDate === null && dateIndex !== -1) {
    lastDate = dataRows.reduce<string | null>((latest, row) => {
      const value = row[dateIndex];
      if (!value) return latest;
      return !latest || value > latest ? value : latest;
    }, null);
  }

  let periodInstalls: number | null = null;
  if (periodIndex !== -1) {
    periodInstalls = dataRows.reduce((sum, row) => sum + (toNumber(row[periodIndex]) ?? 0), 0);
  }

  return { totalInstalls, periodInstalls, lastDate, columns: header };
}

export type PlayDownloadStats =
  | { ok: true; stats: InstallStats; sourceFile: string }
  | { ok: false; reason: "unconfigured" | "no_report_file" | "error"; detail?: string };

/**
 * `pubsite_prod_<hesap kimliği>` kovası sabit, uygulama başına değişmez.
 * Hesap Play Console'da "İstatistik raporlarını indirme" sayfasında
 * "Cloud Storage URI'sini kopyala" ile doğrulandı.
 */
const PLAY_REPORTS_BUCKET = "pubsite_prod_4840355999194918430";

export async function getPlayDownloadStats(): Promise<PlayDownloadStats> {
  const account = readServiceAccount();
  if (!account) return { ok: false, reason: "unconfigured" };

  try {
    const accessToken = await getAccessToken(account);
    for (const fileName of candidateInstallFiles(new Date())) {
      const bytes = await downloadObjectIfExists(PLAY_REPORTS_BUCKET, fileName, accessToken);
      if (bytes === null) continue;
      const text = decodeInstallCsv(bytes);
      const stats = parseInstallCsv(text);
      return { ok: true, stats, sourceFile: fileName };
    }
    return { ok: false, reason: "no_report_file" };
  } catch (error) {
    console.error("[play-downloads] indirme istatistiği alınamadı", error);
    return {
      ok: false,
      reason: "error",
      ...(error instanceof Error ? { detail: error.message } : {}),
    };
  }
}
