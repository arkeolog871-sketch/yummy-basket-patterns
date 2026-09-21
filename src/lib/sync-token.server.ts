/**
 * Market senkron jetonları — yalnızca sunucu tarafı.
 *
 * Jeton bir paroladır: üretildiği an bir kez gösterilir, veritabanında
 * yalnızca SHA-256 özeti durur. Kaybedilirse yenisi üretilir, eskisi iptal
 * edilir; geri okunamaz.
 */

/** Karışması kolay karakterler yok (0/O, 1/I/l): telefonla okunabilsin. */
const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TOKEN_BODY_LENGTH = 40;
export const TOKEN_PREFIX = "scb_";

export function generateSyncToken(): string {
  const bytes = new Uint8Array(TOKEN_BODY_LENGTH);
  crypto.getRandomValues(bytes);
  let body = "";
  for (const byte of bytes) body += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return `${TOKEN_PREFIX}${body}`;
}

/** Web Crypto ile SHA-256: Cloudflare Workers'da node:crypto yok. */
export async function hashSyncToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Panelde gösterilen tanıtıcı parça; tek başına jetonu ele vermez. */
export function syncTokenPrefix(token: string): string {
  return token.slice(0, TOKEN_PREFIX.length + 6);
}

export type SyncTokenOwner = { tokenId: string; restaurantId: string };

/**
 * `Authorization: Bearer <jeton>` başlığını çözer ve hangi işletmeye ait
 * olduğunu döner. Geçersiz/iptal edilmiş jetonda null.
 *
 * Özet üzerinden aranıyor, düz jeton hiç sorgulanmıyor: veritabanı
 * günlüklerine bile jeton düşmesin.
 */
export async function resolveSyncToken(header: string | null): Promise<SyncTokenOwner | null> {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1];
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await hashSyncToken(token);
  const { data, error } = await supabaseAdmin
    .from("restaurant_sync_tokens")
    .select("id, restaurant_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { tokenId: data.id, restaurantId: data.restaurant_id };
}

/**
 * "Son kullanım" damgası — işletme köprünün çalışıp çalışmadığını panelden
 * görebilsin. Hata vermesi isteği düşürmemeli: bu bir istatistik.
 */
export async function touchSyncToken(tokenId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("restaurant_sync_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenId);
  } catch (error) {
    console.error("[sync-token] last_used_at yazılamadı", error);
  }
}
