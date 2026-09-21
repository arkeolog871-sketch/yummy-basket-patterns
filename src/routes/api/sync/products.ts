/**
 * Köprü ucu: marketin bilgisayarındaki program ürün listesini buraya gönderir.
 *
 *   POST /api/sync/products
 *   Authorization: Bearer scb_...
 *   X-Sync-File-Name: stok.xlsx        (biçimi ad belirler: .xlsx veya CSV)
 *   gövde: dosyanın ham baytları
 *
 * Neden ham gövde: köprünün her ortamda (PowerShell, curl, .NET) tek satırla
 * gönderebilmesi için. Base64/JSON sarmalamak dosyayı üçte bir büyütür ve
 * köprü tarafında kodlama hatası riski doğurur.
 *
 * Neden tarayıcı oturumu yok: köprü bir sunucu programı, çerezi yok. Kimlik
 * işletmeye bağlı, iptal edilebilir bir jeton (restaurant_sync_tokens).
 */
import { createFileRoute } from "@tanstack/react-router";
import { applySecurityHeaders } from "@/lib/security-wall.server";

function json(data: unknown, status = 200) {
  return applySecurityHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }),
  );
}

export const Route = createFileRoute("/api/sync/products")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { resolveSyncToken, touchSyncToken } = await import("@/lib/sync-token.server");

        let owner;
        try {
          owner = await resolveSyncToken(request.headers.get("authorization"));
        } catch (error) {
          console.error("[sync] jeton çözümlenemedi", error);
          return json({ error: "Senkron şu an yapılamıyor." }, 503);
        }
        // Geçersiz jetonda ayrıntı verme: var/yok ayrımı jeton taramasını
        // kolaylaştırır.
        if (!owner) return json({ error: "Jeton geçersiz veya iptal edilmiş." }, 401);

        // Hız sınırı jeton BAŞINA: yanlış kurulmuş bir köprü dakikada bir
        // yerine saniyede bir gönderirse hem bizi hem kendini yormasın.
        // Sağlıklı kullanım 5-15 dakikada bir, 6/saat fazlasıyla yeter.
        const { enforceSensitiveRateLimit } = await import("@/lib/rate-limit.server");
        try {
          await enforceSensitiveRateLimit(`sync-products:${owner.tokenId}`, 6, 60 * 60_000);
        } catch {
          return json({ error: "Çok sık gönderim. Senkron aralığını en az 10 dakika yapın." }, 429);
        }

        const fileName = (request.headers.get("x-sync-file-name") ?? "liste.csv")
          .replace(/[\r\n]/g, "")
          .slice(0, 160);

        const { SyncFileError, SYNC_MAX_BYTES, parseSyncUpload, runSyncImport } =
          await import("@/lib/sync-import.server");

        // Content-Length'e güvenmeden de koru: başlık yalan söyleyebilir,
        // gövdeyi okuduktan sonra gerçek boyuta bakılıyor.
        const declared = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(declared) && declared > SYNC_MAX_BYTES) {
          return json({ error: "Dosya çok büyük (en fazla 20 MB)." }, 413);
        }

        try {
          const bytes = await request.arrayBuffer();
          const parsed = await parseSyncUpload(fileName, bytes);
          const result = await runSyncImport({
            restaurantId: owner.restaurantId,
            fileName,
            parsed,
          });
          await touchSyncToken(owner.tokenId);
          return json({ ok: true, ...result });
        } catch (error) {
          if (error instanceof SyncFileError) {
            // Köprünün günlüğünde ne yapacağı yazsın: bunlar kullanıcı hatası.
            return json({ error: error.message }, 422);
          }
          console.error("[sync] aktarım başarısız", error);
          return json({ error: "Liste işlenemedi." }, 500);
        }
      },
    },
  },
});
