import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- betik JS; tip bildirimi yok, davranışı burada ölçülüyor.
import { formatBuilds, makeToken } from "../../scripts/testflight-status.mjs";

/**
 * App Store Connect API'sine giden jeton yanlışsa Apple 401 döndürür ve
 * gerekçe söylemez: "hangi alan yanlış" diye bir mesaj gelmez. İki tuzak
 * sessizce bu sonucu veriyor — imzanın DER yerine ham r||s olması ve aud'un
 * tam olarak "appstoreconnect-v1" olması. İkisi de burada ölçülüyor.
 */
describe("App Store Connect jetonu", () => {
  // Apple'ın .p8 dosyasıyla aynı eğri (P-256) ve aynı kodlama (PKCS#8 PEM).
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const token = makeToken({
    keyId: "ABC123DEFG",
    issuerId: "69a6de70-1111-2222-3333-444444444444",
    privateKey,
    now: 1_758_470_000_000,
  });
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString());
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
  const signature = Buffer.from(encodedSignature, "base64url");

  it("ES256 başlığı ve anahtar kimliği taşır", () => {
    expect(header).toEqual({ alg: "ES256", kid: "ABC123DEFG", typ: "JWT" });
  });

  it("aud sabit appstoreconnect-v1", () => {
    expect(payload.aud).toBe("appstoreconnect-v1");
    expect(payload.iss).toBe("69a6de70-1111-2222-3333-444444444444");
  });

  it("ömür Apple'ın 20 dakikalık üst sınırını aşmaz", () => {
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(1200);
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("imza ham r||s (64 bayt), DER değil", () => {
    // DER imza 70-72 bayt ve 0x30 ile başlar; Node'un varsayılanı budur.
    expect(signature.length).toBe(64);
  });

  it("imza üretildiği anahtarla doğrulanıyor", () => {
    const verifier = createVerify("SHA256");
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    expect(verifier.verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, signature)).toBe(true);
  });

  it("base64url kullanır, dolgu karakteri bırakmaz", () => {
    expect(token).not.toContain("=");
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
  });
});

describe("build listesi biçimlendirme", () => {
  const sample = {
    data: [
      {
        type: "builds",
        attributes: {
          version: "29",
          processingState: "PROCESSING",
          uploadedDate: "2026-09-21T16:13:04Z",
          expired: false,
          expirationDate: null,
        },
        relationships: { preReleaseVersion: { data: { id: "v11" } } },
      },
      {
        type: "builds",
        attributes: {
          version: "27",
          processingState: "VALID",
          uploadedDate: "2026-09-15T14:49:00Z",
          expired: true,
          expirationDate: "2026-12-14T14:49:00Z",
        },
        relationships: { preReleaseVersion: { data: { id: "v10" } } },
      },
    ],
    included: [
      { type: "preReleaseVersions", id: "v11", attributes: { version: "1.1" } },
      { type: "preReleaseVersions", id: "v10", attributes: { version: "1.0" } },
    ],
  };

  it("build'i pazarlama sürümüyle eşler", () => {
    // Sürüm numarası build kaydında değil, ilişkili preReleaseVersion'da
    // duruyor; eşleme kopunca liste "1.1 (29)" yerine "? (29)" gösterir.
    expect(formatBuilds(sample)).toEqual([
      {
        surum: "1.1",
        build: "29",
        durum: "PROCESSING",
        yuklendi: "2026-09-21T16:13:04Z",
        sonKullanma: "-",
        suresiDoldu: false,
      },
      {
        surum: "1.0",
        build: "27",
        durum: "VALID",
        yuklendi: "2026-09-15T14:49:00Z",
        sonKullanma: "2026-12-14T14:49:00Z",
        suresiDoldu: true,
      },
    ]);
  });

  it("boş ve eksik alanlı yanıtta çökmez", () => {
    expect(formatBuilds({})).toEqual([]);
    expect(formatBuilds({ data: [{ attributes: {} }] })[0].surum).toBe("?");
  });
});
