import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

/**
 * İşletme hesabı eşleştirme kodu.
 *
 * Neden var: bildirimin işletmeye ulaşması `vendor_assignments` satırına
 * bağlı, o satır da başvurudaki e-postayla açılan hesaba. İşletme sahibi
 * uygulamayı indirip Apple ile giriş yaptığında Apple gerçek e-postayı
 * vermiyor (`xxxx@privaterelay.appleid.com`) ve Supabase ayrı bir kullanıcı
 * açıyor. Sahip uygulamayı kullanıyor, cihazı kayıtlı oluyor, ama o cihaz
 * hiçbir işletmeye bağlı olmadığı için siparişte kimseye bildirim gitmiyor.
 *
 * Kod bunu e-posta eşleşmesine hiç gerek bırakmadan çözüyor: sahip hangi
 * hesapla girerse girsin kodu yazınca o anki hesabı işletmeye bağlanıyor.
 */

/**
 * Karıştırılabilecek harf/rakamlar (0/O, 1/I/L) alfabede yok: kod telefonda
 * elle yazılıyor ve "kod yanlış" demek en sinir bozucu hata olurdu.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_TTL_DAYS = 14;

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

/** Görüntülerken okunaklı olsun: ABCD-EFGH. */
export function formatPairingCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

async function assertPairingAccess(
  context: { supabase: never; userId: string; claims: unknown },
  restaurantId: string,
): Promise<void> {
  const { assertPanelAccess, assertRestaurantInScope } = await import("./founder.server");
  const access = await assertPanelAccess(context.supabase, context.userId, context.claims as never);
  await assertRestaurantInScope(access, restaurantId);
}

/**
 * İşletme için yeni kod üretir (varsa eskisini geçersiz kılar) ve döner.
 * Yalnızca kurucu/bölge yöneticisi çağırabilir; kod onlara gösterilip
 * işletmeye iletilir.
 */
export const createPairingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertPairingAccess(
        { supabase: context.supabase as never, userId: context.userId, claims: context.claims },
        data.restaurantId,
      );
      const { audited } = await import("./audit.server");
      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "vendor.pairing_code.create",
          entity: "restaurants",
          entityId: data.restaurantId,
        },
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const expiresAt = new Date(Date.now() + CODE_TTL_DAYS * 86_400_000).toISOString();
          // Çakışma olasılığı çok düşük ama kod tekil indeksli; birkaç deneme
          // yapmak, kurucuya sebepsiz hata göstermekten iyi.
          for (let attempt = 0; attempt < 5; attempt += 1) {
            const code = generateCode();
            const { error } = await supabaseAdmin
              .from("restaurants")
              .update({ pairing_code: code, pairing_code_expires_at: expiresAt })
              .eq("id", data.restaurantId);
            if (!error) return { code, expiresAt };
            if (!/duplicate key|unique/i.test(error.message)) throw new Error(error.message);
          }
          throw new Error("Kod üretilemedi, tekrar deneyin.");
        },
      );
    }),
  );

/** İşletmenin mevcut kodunu ve bağlı hesapların bildirim durumunu döner. */
export const getPairingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertPairingAccess(
        { supabase: context.supabase as never, userId: context.userId, claims: context.claims },
        data.restaurantId,
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [restaurant, assignments] = await Promise.all([
        supabaseAdmin
          .from("restaurants")
          .select("pairing_code, pairing_code_expires_at")
          .eq("id", data.restaurantId)
          .maybeSingle(),
        supabaseAdmin
          .from("vendor_assignments")
          .select("user_id")
          .eq("restaurant_id", data.restaurantId),
      ]);
      if (restaurant.error) throw new Error(restaurant.error.message);
      if (assignments.error) throw new Error(assignments.error.message);

      const userIds = (assignments.data ?? []).map((row) => row.user_id);
      // Bildirim iki kanaldan gidiyor: native cihaz jetonu (fcm_tokens) ve
      // tarayıcı aboneliği (push_subscriptions). Durumu yalnızca birine
      // bakarak söylemek, ulaşılabilen bir işletmeyi "ulaşılamıyor" gösterirdi.
      const [tokens, webPush, profiles] = await Promise.all([
        userIds.length
          ? supabaseAdmin.from("fcm_tokens").select("user_id").in("user_id", userIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? supabaseAdmin.from("push_subscriptions").select("user_id").in("user_id", userIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const withDevice = new Set([
        ...(tokens.data ?? []).map((row) => row.user_id),
        ...(webPush.data ?? []).map((row) => row.user_id),
      ]);
      const nameById = new Map((profiles.data ?? []).map((row) => [row.id, row.full_name]));

      const now = Date.now();
      const expiresAt = restaurant.data?.pairing_code_expires_at ?? null;
      const active = Boolean(
        restaurant.data?.pairing_code && (!expiresAt || new Date(expiresAt).getTime() > now),
      );

      return {
        code: active ? (restaurant.data?.pairing_code ?? null) : null,
        expiresAt: active ? expiresAt : null,
        accounts: userIds.map((userId) => ({
          userId,
          fullName: nameById.get(userId) ?? null,
          reachable: withDevice.has(userId),
        })),
        reachable: userIds.some((userId) => withDevice.has(userId)),
      };
    }),
  );

/**
 * Kodu kullanarak GİRİŞ YAPMIŞ hesabı işletmeye bağlar.
 *
 * Kod bir parola gibi davranır: deneme yanılmayla bulunabilmesin diye hız
 * sınırı var ve yanlış kodda hangi işletmenin var olduğu hakkında bilgi
 * sızdırılmaz.
 */
export const redeemPairingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ code: z.string().trim().min(6).max(16) }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: allowed, error: limitError } = await supabaseAdmin.rpc(
        "consume_request_rate_limit",
        {
          p_bucket_key: `pairing:${context.userId}`,
          p_limit: 10,
          p_window_seconds: 900,
        },
      );
      if (limitError) throw new Error(limitError.message);
      if (allowed === false) {
        throw new Error("Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin.");
      }

      const normalized = data.code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const { data: result, error } = await supabaseAdmin.rpc("redeem_restaurant_pairing_code", {
        p_user_id: context.userId,
        p_code: normalized,
      });
      if (error) throw new Error(error.message);

      const row = Array.isArray(result) ? result[0] : result;
      if (!row?.restaurant_id) {
        throw new Error("Kod geçersiz veya süresi dolmuş. Kodu veren kişiden yenisini isteyin.");
      }

      const { audited } = await import("./audit.server");
      await audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "vendor.pairing_code.redeem",
          entity: "vendor_assignments",
          entityId: context.userId,
          detail: { restaurant_id: row.restaurant_id },
        },
        async () => ({ ok: true }),
      );

      return { restaurantId: row.restaurant_id, restaurantName: row.restaurant_name };
    }),
  );
