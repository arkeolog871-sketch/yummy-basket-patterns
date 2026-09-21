/**
 * TestFlight'a yüklenen build'leri App Store Connect API'sinden okur ve yazdırır.
 *
 * NEDEN: App Store Connect'in web arayüzü, özellikle telefon tarayıcısında,
 * sık sık "İsteğinizi işleme alamıyoruz." hatası veriyor. O hata build'in
 * durumu hakkında hiçbir şey söylemiyor — yükleme başarılı olsa da çıkıyor.
 * Bu betik aynı bilgiyi arayüzden bağımsız, API'den okur.
 *
 * SALT OKUNUR: yalnızca GET isteği yapar. Hiçbir şey yüklemez, silmez,
 * dağıtmaz. Aynı API anahtarını (ios-release.yml'deki sırlar) kullanır.
 *
 * Ortam değişkenleri:
 *   APP_STORE_CONNECT_KEY_ID      — anahtar kimliği (kid)
 *   APP_STORE_CONNECT_ISSUER_ID   — takım/veren kimliği (iss)
 *   APP_STORE_CONNECT_API_KEY     — .p8 anahtarının içeriği
 *   ASC_APP_ID                    — uygulama kimliği (varsayılan: 6809810925)
 *   ASC_BUILD_LIMIT               — kaç build listelensin (varsayılan: 10)
 */
import { createSign } from "node:crypto";

const API = "https://api.appstoreconnect.apple.com";
const DEFAULT_APP_ID = "6809810925"; // SİLVAN CEBİMDE

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * App Store Connect için ES256 JWT üretir.
 *
 * İki tuzak var ve ikisi de sessizce 401 döndürür:
 * - İmza ham r||s (64 bayt) olmalı; Node varsayılan olarak DER üretir, bu
 *   yüzden dsaEncoding açıkça veriliyor.
 * - aud sabit "appstoreconnect-v1" olmalı.
 */
export function makeToken({ keyId, issuerId, privateKey, now = Date.now(), ttlSeconds = 600 }) {
  const issuedAt = Math.floor(now / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: issuerId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds, // Apple 20 dakikadan uzun ömrü reddediyor.
    aud: "appstoreconnect-v1",
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Build listesi isteğinin adresi.
 *
 * DİKKAT: /v1/apps/{id}/builds ilişki uçudur ve `include` kabul etmiyor —
 * gerçek koşuda şu hatayla düştü:
 *   PARAMETER_ERROR.ILLEGAL "The parameter 'include' can not be used with
 *   this request"
 * Sürüm numarası build kaydında değil ilişkili preReleaseVersion'da durduğu
 * için include gerekiyor; bu yüzden üst düzey /v1/builds ucu filtreyle
 * kullanılıyor. O uç include'u kabul ediyor.
 */
export function buildsRequestUrl(appId, limit) {
  const params = new URLSearchParams({
    "filter[app]": appId,
    limit: String(limit),
    sort: "-uploadedDate",
    include: "preReleaseVersion",
    // DİKKAT: fields[builds] yalnızca öznitelikleri değil, dönecek
    // İLİŞKİLERİ de kısıtlıyor. preReleaseVersion bu listede yoksa
    // include çalışsa bile build kaydında relationships gelmiyor ve liste
    // "1.1 (30)" yerine "? (30)" gösteriyor — ilk başarılı koşuda aynen
    // böyle çıktı.
    "fields[builds]":
      "version,processingState,uploadedDate,expirationDate,expired,preReleaseVersion",
    "fields[preReleaseVersions]": "version",
  });
  return `${API}/v1/builds?${params.toString()}`;
}

/** API yanıtını insanın okuyabileceği satırlara çevirir. */
export function formatBuilds(body) {
  const versions = new Map();
  for (const item of body.included ?? []) {
    if (item.type === "preReleaseVersions") {
      versions.set(item.id, item.attributes?.version ?? "?");
    }
  }
  return (body.data ?? []).map((build) => {
    const versionId = build.relationships?.preReleaseVersion?.data?.id;
    return {
      surum: versionId ? (versions.get(versionId) ?? "?") : "?",
      build: build.attributes?.version ?? "?",
      durum: build.attributes?.processingState ?? "?",
      yuklendi: build.attributes?.uploadedDate ?? "?",
      sonKullanma: build.attributes?.expirationDate ?? "-",
      suresiDoldu: build.attributes?.expired === true,
    };
  });
}

async function main() {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
  const privateKey = process.env.APP_STORE_CONNECT_API_KEY;
  const appId = process.env.ASC_APP_ID || DEFAULT_APP_ID;
  const limit = process.env.ASC_BUILD_LIMIT || "10";

  const missing = [
    ["APP_STORE_CONNECT_KEY_ID", keyId],
    ["APP_STORE_CONNECT_ISSUER_ID", issuerId],
    ["APP_STORE_CONNECT_API_KEY", privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    console.error(`Eksik ortam değişkeni: ${missing.join(", ")}`);
    process.exit(2);
  }

  const token = makeToken({ keyId, issuerId, privateKey });
  const url = buildsRequestUrl(appId, limit);

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  if (!response.ok) {
    // Apple hata gövdesinde sır taşımıyor; teşhis için olduğu gibi yazdır.
    console.error(`App Store Connect ${response.status}: ${text}`);
    process.exit(1);
  }

  const builds = formatBuilds(JSON.parse(text));
  if (builds.length === 0) {
    console.log("Bu uygulamada hiç build yok.");
    return;
  }

  console.log(`Uygulama ${appId} — son ${builds.length} build (en yeni üstte):\n`);
  for (const build of builds) {
    const flag = build.suresiDoldu ? " [SÜRESİ DOLDU]" : "";
    console.log(`  ${build.surum} (${build.build})  durum: ${build.durum}${flag}`);
    console.log(`      yüklendi: ${build.yuklendi}   son kullanma: ${build.sonKullanma}`);
  }
  console.log(
    "\nDurum anlamları: PROCESSING = Apple işliyor, VALID = TestFlight'ta hazır,\n" +
      "FAILED/INVALID = Apple reddetti (sebebi e-postayla gelir).",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
