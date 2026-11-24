import { SignJWT, importPKCS8 } from "jose";

/**
 * App Store Connect "Analytics Reports" API'si indirme sayılarını doğrudan
 * tek bir sayı olarak değil, haftalarca süren bir "rapor isteği oluştur →
 * raporları listele → örnekleri listele → parçaları indir" zinciriyle verir.
 * İlk rapor istendikten 1-2 gün sonra hazır olur (Apple belgesi). Bu anahtar
 * yalnızca bunun için: Analytics uç noktaları "Admin" rolü istiyor,
 * TestFlight yüklemesinde kullanılan "Uygulama Yöneticisi" rolü yetmiyor.
 */

type AnalyticsKey = { keyId: string; issuerId: string; privateKey: string };

let cachedKey: AnalyticsKey | null | undefined;
let cachedJwt: { token: string; expiresAt: number } | null = null;

function readKey(): AnalyticsKey | null {
  if (cachedKey !== undefined) return cachedKey;
  const keyId = process.env["APP_STORE_CONNECT_ANALYTICS_KEY_ID"];
  const issuerId = process.env["APP_STORE_CONNECT_ISSUER_ID"];
  const privateKey = process.env["APP_STORE_CONNECT_ANALYTICS_API_KEY"];
  if (!keyId || !issuerId || !privateKey) {
    cachedKey = null;
    return null;
  }
  cachedKey = { keyId, issuerId, privateKey };
  return cachedKey;
}

async function getJwt(key: AnalyticsKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt > now + 30) return cachedJwt.token;

  const privateKey = await importPKCS8(key.privateKey, "ES256");
  // Apple 20 dakikadan uzun ömürlü jetonu reddeder.
  const expiresAt = now + 19 * 60;
  const token = await new SignJWT({ aud: "appstoreconnect-v1" })
    .setProtectedHeader({ alg: "ES256", kid: key.keyId, typ: "JWT" })
    .setIssuer(key.issuerId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(privateKey);
  cachedJwt = { token, expiresAt };
  return token;
}

const API_BASE = "https://api.appstoreconnect.apple.com";

/** Apple'ın sayısal uygulama kimliği (App Store Connect'te "Uygulama Apple Kimliği"). */
const APPLE_APP_ID = "6809810925";

async function appleApiFetch(key: AnalyticsKey, path: string): Promise<unknown> {
  const jwt = await getJwt(key);
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) {
    throw new Error(`App Store Connect isteği başarısız (${path}): ${response.status}`);
  }
  return response.json();
}

type JsonApiResource<Attrs> = { id: string; type: string; attributes?: Attrs };
type JsonApiList<Attrs> = { data: JsonApiResource<Attrs>[] };

async function findOrCreateOngoingRequest(
  key: AnalyticsKey,
): Promise<{ id: string; justCreated: boolean }> {
  const existing = (await appleApiFetch(
    key,
    `/v1/apps/${APPLE_APP_ID}/analyticsReportRequests?filter[accessType]=ONGOING&limit=1`,
  )) as JsonApiList<{ accessType: string }>;
  const found = existing.data[0];
  if (found) return { id: found.id, justCreated: false };

  const jwt = await getJwt(key);
  const response = await fetch(`${API_BASE}/v1/analyticsReportRequests`, {
    method: "POST",
    headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({
      data: {
        type: "analyticsReportRequests",
        attributes: { accessType: "ONGOING" },
        relationships: { app: { data: { type: "apps", id: APPLE_APP_ID } } },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Analytics rapor isteği oluşturulamadı: ${response.status}`);
  }
  const json = (await response.json()) as { data: { id: string } };
  return { id: json.data.id, justCreated: true };
}

/** Apple, indirme raporunun tam adını belgelerde vermiyor — kategori ve "download" ile eşleştirilir. */
function pickDownloadsReport(reports: JsonApiResource<{ name: string; category: string }>[]) {
  return reports.find(
    (report) =>
      report.attributes?.category === "COMMERCE" && /download/i.test(report.attributes.name ?? ""),
  );
}

async function downloadAndDecompress(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Rapor parçası indirilemedi: ${response.status}`);
  }
  const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
  const bytes = await new Response(decompressed).arrayBuffer();
  return new TextDecoder("utf-8").decode(bytes);
}

export type DownloadsReportRow = Record<string, string>;

/** Apple'ın analiz raporları sekmeyle (TSV) ayrılmış; "Counts" sütunu toplam indirme sayısı. */
export function parseDownloadsReportText(text: string): DownloadsReportRow[] {
  const lines = text.split(/\r\n|\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines[0]!.includes("\t") ? "\t" : ",";
  const header = lines[0]!.split(delimiter).map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    const row: DownloadsReportRow = {};
    header.forEach((name, index) => {
      row[name] = cells[index] ?? "";
    });
    return row;
  });
}

export function sumCounts(rows: DownloadsReportRow[]): number {
  const countsKey = Object.keys(rows[0] ?? {}).find((key) => key.toLowerCase() === "counts");
  if (!countsKey) return 0;
  return rows.reduce((sum, row) => {
    const value = Number(row[countsKey]);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function latestDate(rows: DownloadsReportRow[]): string | null {
  const dateKey = Object.keys(rows[0] ?? {}).find((key) => key.toLowerCase() === "date");
  if (!dateKey) return null;
  return rows.reduce<string | null>((latest, row) => {
    const value = row[dateKey];
    if (!value) return latest;
    return !latest || value > latest ? value : latest;
  }, null);
}

export type AppleDownloadStats =
  | { ok: true; totalDownloads: number; date: string | null }
  | {
      ok: false;
      reason: "unconfigured" | "request_created" | "pending" | "error";
      detail?: string;
    };

export async function getAppleDownloadStats(): Promise<AppleDownloadStats> {
  const key = readKey();
  if (!key) return { ok: false, reason: "unconfigured" };

  try {
    const { id: requestId, justCreated } = await findOrCreateOngoingRequest(key);
    if (justCreated) {
      return { ok: false, reason: "request_created" };
    }

    const reportsJson = (await appleApiFetch(
      key,
      `/v1/analyticsReportRequests/${requestId}/reports?filter[category]=COMMERCE&limit=50`,
    )) as JsonApiList<{ name: string; category: string }>;
    const downloadsReport = pickDownloadsReport(reportsJson.data);
    if (!downloadsReport) return { ok: false, reason: "pending" };

    const instancesJson = (await appleApiFetch(
      key,
      `/v1/analyticsReports/${downloadsReport.id}/instances?filter[granularity]=DAILY&limit=10`,
    )) as JsonApiList<{ granularity: string; processingDate: string }>;
    const latestInstance = instancesJson.data
      .slice()
      .sort((a, b) =>
        (b.attributes?.processingDate ?? "").localeCompare(a.attributes?.processingDate ?? ""),
      )
      .at(0);
    if (!latestInstance) return { ok: false, reason: "pending" };

    const segmentsJson = (await appleApiFetch(
      key,
      `/v1/analyticsReportInstances/${latestInstance.id}/segments?limit=200`,
    )) as JsonApiList<{ url: string }>;
    const urls = segmentsJson.data
      .map((segment) => segment.attributes?.url)
      .filter(Boolean) as string[];
    if (urls.length === 0) return { ok: false, reason: "pending" };

    const texts = await Promise.all(urls.map((url) => downloadAndDecompress(url)));
    const rows = texts.flatMap(parseDownloadsReportText);
    return { ok: true, totalDownloads: sumCounts(rows), date: latestDate(rows) };
  } catch (error) {
    console.error("[apple-downloads] indirme istatistiği alınamadı", error);
    return {
      ok: false,
      reason: "error",
      ...(error instanceof Error ? { detail: error.message } : {}),
    };
  }
}
