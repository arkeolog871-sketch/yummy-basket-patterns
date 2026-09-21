import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TOKEN_PREFIX,
  generateSyncToken,
  hashSyncToken,
  syncTokenPrefix,
} from "@/lib/sync-token.server";

describe("senkron jetonu", () => {
  it("tanınabilir bir önekle ve yeterli uzunlukta üretilir", () => {
    const token = generateSyncToken();
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBe(TOKEN_PREFIX.length + 40);
  });

  it("karıştırılabilir karakter içermez", () => {
    // Jeton telefonla okunabiliyor olmalı: 0/O ve 1/I/l ayırt edilemez.
    const token = generateSyncToken().slice(TOKEN_PREFIX.length);
    expect(token).not.toMatch(/[0O1Il]/);
  });

  it("her çağrıda farklıdır", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateSyncToken()));
    expect(seen.size).toBe(200);
  });

  it("özet kararlıdır ve jetonu ele vermez", async () => {
    const token = generateSyncToken();
    const first = await hashSyncToken(token);
    expect(await hashSyncToken(token)).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    // Özette jetonun kendisi geçmemeli.
    expect(first).not.toContain(token.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + 8));
  });

  it("boşluklar özeti değiştirmez", async () => {
    // Kullanıcı jetonu kopyalarken sonuna boşluk/satır sonu alabiliyor.
    const token = generateSyncToken();
    expect(await hashSyncToken(`  ${token}\n`)).toBe(await hashSyncToken(token));
  });

  it("farklı jetonlar farklı özet verir", async () => {
    expect(await hashSyncToken(generateSyncToken())).not.toBe(
      await hashSyncToken(generateSyncToken()),
    );
  });

  it("önek jetonun küçük bir parçasıdır", () => {
    const token = generateSyncToken();
    const prefix = syncTokenPrefix(token);
    expect(token.startsWith(prefix)).toBe(true);
    // Önek panelde gösteriliyor: tahmin için işe yaramayacak kadar kısa olmalı.
    expect(prefix.length).toBeLessThan(token.length / 3);
  });
});

describe("senkron ucu sözleşmesi", () => {
  const source = readFileSync(join(process.cwd(), "src/routes/api/sync/products.ts"), "utf8");

  it("her istek jeton doğrulamasından geçer", () => {
    expect(source).toContain("resolveSyncToken");
    expect(source).toMatch(/if \(!owner\) return json\(/);
  });

  it("jeton başına hız sınırı uygular", () => {
    expect(source).toMatch(/enforceSensitiveRateLimit\(`sync-products:\$\{owner\.tokenId\}`/);
  });

  it("dosya boyutu sınırlıdır", () => {
    expect(source).toContain("SYNC_MAX_BYTES");
  });
});
