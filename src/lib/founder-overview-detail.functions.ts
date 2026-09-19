import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import { ORDER_STATUS_LABELS, formatDateTime, formatPrice } from "./format";

/**
 * Genel durum kartlarının ayrıntısı.
 *
 * Kartlar yalnızca sayı gösteriyordu: "bildirim alan cihaz 14/29" doğru ama
 * hangi 15 kullanıcının cihazı yok, hangi işletmenin vitrini boş, açık
 * siparişte kim bekliyor — hiçbiri görünmüyordu. Sayının arkasındaki satırları
 * göstermek, panelin tek tıkla eyleme dönüşmesini sağlıyor.
 *
 * Tek ve aynı biçimde satır döndürüyoruz ki arayüz her ölçüt için ayrı tablo
 * çizmek zorunda kalmasın.
 */

export type OverviewDetailRow = {
  id: string;
  primary: string;
  secondary: string | null;
  meta: string | null;
  /** Satırın vurgusu: iyi durum yeşil, sorunlu satır kırmızı. */
  tone: "ok" | "warn" | null;
};

export type OverviewDetail = {
  title: string;
  note: string | null;
  rows: OverviewDetailRow[];
};

const OPEN_STATUSES = ["pending", "confirmed", "preparing", "on_the_way"] as const;

/** Bir listede gösterilecek en fazla satır; panel özet kalmalı, rapor değil. */
const ROW_LIMIT = 50;

const detailSchema = z.object({
  metric: z.enum(["users", "devices", "businesses", "openOrders", "orders"]),
});

type AdminUser = { id: string; email: string | null; created_at: string };

/** Kayıtlı kullanıcılar + kimin cihazı var. İki kart da bunu kullanıyor. */
async function loadUsers(): Promise<{
  users: AdminUser[];
  nameById: Map<string, string | null>;
  nativeIds: Set<string>;
  webIds: Set<string>;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const users: AdminUser[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    users.push(
      ...data.users.map((user) => ({
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at,
      })),
    );
    if (data.users.length < 200) break;
  }

  const [profiles, tokens, webPush] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name"),
    supabaseAdmin.from("fcm_tokens").select("user_id"),
    supabaseAdmin.from("push_subscriptions").select("user_id"),
  ]);
  for (const row of [profiles, tokens, webPush]) {
    if (row.error) throw new Error(row.error.message);
  }

  return {
    users: users.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    nameById: new Map((profiles.data ?? []).map((row) => [row.id, row.full_name])),
    nativeIds: new Set((tokens.data ?? []).map((row) => row.user_id)),
    webIds: new Set((webPush.data ?? []).map((row) => row.user_id)),
  };
}

export const getOverviewDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => detailSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      if (data.metric === "users") {
        const { users, nameById, nativeIds, webIds } = await loadUsers();
        return {
          title: "Kayıtlı kullanıcılar",
          note:
            users.length > ROW_LIMIT
              ? `En son kaydolan ${ROW_LIMIT} kişi gösteriliyor (toplam ${users.length}).`
              : null,
          rows: users.slice(0, ROW_LIMIT).map((user) => {
            const hasDevice = nativeIds.has(user.id) || webIds.has(user.id);
            return {
              id: user.id,
              primary: nameById.get(user.id) || user.email || "Adı girilmemiş hesap",
              secondary: user.email,
              meta: formatDateTime(user.created_at),
              tone: hasDevice ? ("ok" as const) : null,
            };
          }),
        } satisfies OverviewDetail;
      }

      if (data.metric === "devices") {
        const { users, nameById, nativeIds, webIds } = await loadUsers();
        // Cihazı olmayanlar önce: kartın asıl sorusu "kime ulaşamıyorum".
        const sorted = [...users].sort((a, b) => {
          const aHas = nativeIds.has(a.id) || webIds.has(a.id);
          const bHas = nativeIds.has(b.id) || webIds.has(b.id);
          if (aHas === bHas) return b.created_at.localeCompare(a.created_at);
          return aHas ? 1 : -1;
        });
        const without = users.filter((user) => !nativeIds.has(user.id) && !webIds.has(user.id));
        return {
          title: "Bildirim alabilen cihazlar",
          note: without.length
            ? `${without.length} kullanıcının kayıtlı cihazı yok; onlara bildirim gönderilemez.`
            : "Tüm kullanıcıların kayıtlı cihazı var.",
          rows: sorted.slice(0, ROW_LIMIT).map((user) => {
            const channels = [
              nativeIds.has(user.id) ? "uygulama" : null,
              webIds.has(user.id) ? "tarayıcı" : null,
            ].filter(Boolean);
            return {
              id: user.id,
              primary: nameById.get(user.id) || user.email || "Adı girilmemiş hesap",
              secondary: user.email,
              meta: channels.length ? channels.join(" + ") : "cihaz yok",
              tone: channels.length ? ("ok" as const) : ("warn" as const),
            };
          }),
        } satisfies OverviewDetail;
      }

      if (data.metric === "businesses") {
        const [restaurants, items, assignments, tokens, webPush, openOrders] = await Promise.all([
          supabaseAdmin
            .from("restaurants")
            .select("id, name, category, is_active")
            .eq("is_active", true)
            .order("name"),
          supabaseAdmin.from("menu_items").select("restaurant_id").eq("is_available", true),
          supabaseAdmin.from("vendor_assignments").select("user_id, restaurant_id"),
          supabaseAdmin.from("fcm_tokens").select("user_id"),
          supabaseAdmin.from("push_subscriptions").select("user_id"),
          supabaseAdmin.from("orders").select("restaurant_id").in("status", OPEN_STATUSES),
        ]);
        for (const row of [restaurants, items, assignments, tokens, webPush, openOrders]) {
          if (row.error) throw new Error(row.error.message);
        }

        const productCount = new Map<string, number>();
        for (const row of items.data ?? []) {
          productCount.set(row.restaurant_id, (productCount.get(row.restaurant_id) ?? 0) + 1);
        }
        const openCount = new Map<string, number>();
        for (const row of openOrders.data ?? []) {
          openCount.set(row.restaurant_id, (openCount.get(row.restaurant_id) ?? 0) + 1);
        }
        const reachableUsers = new Set([
          ...(tokens.data ?? []).map((row) => row.user_id),
          ...(webPush.data ?? []).map((row) => row.user_id),
        ]);
        const reachable = new Set(
          (assignments.data ?? [])
            .filter((row) => reachableUsers.has(row.user_id))
            .map((row) => row.restaurant_id),
        );

        return {
          title: "Aktif işletmeler",
          note: null,
          rows: (restaurants.data ?? []).map((restaurant) => {
            const products = productCount.get(restaurant.id) ?? 0;
            const open = openCount.get(restaurant.id) ?? 0;
            const canNotify = reachable.has(restaurant.id);
            return {
              id: restaurant.id,
              primary: restaurant.name,
              secondary: `${restaurant.category} · ${products} ürün${open > 0 ? ` · ${open} açık sipariş` : ""}`,
              meta: canNotify ? "bildirim açık" : "bildirim YOK",
              tone: canNotify && products > 0 ? ("ok" as const) : ("warn" as const),
            };
          }),
        } satisfies OverviewDetail;
      }

      // openOrders ve orders: aynı sorgu, farklı süzgeç.
      const onlyOpen = data.metric === "openOrders";
      let query = supabaseAdmin
        .from("orders")
        .select("id, status, total, recipient_name, district, created_at, restaurants(name)")
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (onlyOpen) query = query.in("status", OPEN_STATUSES);

      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);

      return {
        title: onlyOpen ? "Açık siparişler" : "Son siparişler",
        note: onlyOpen
          ? "Teslim edilmemiş ve iptal edilmemiş siparişler."
          : `En son ${ROW_LIMIT} sipariş gösteriliyor.`,
        rows: (rows ?? []).map((order) => {
          const restaurantName =
            (order as { restaurants?: { name?: string } | null }).restaurants?.name ?? "İşletme";
          return {
            id: order.id,
            primary: `${restaurantName} · ${formatPrice(Number(order.total))}`,
            secondary: [order.recipient_name, order.district].filter(Boolean).join(" · ") || null,
            meta: `${ORDER_STATUS_LABELS[order.status] ?? order.status} · ${formatDateTime(order.created_at)}`,
            tone:
              order.status === "cancelled"
                ? ("warn" as const)
                : order.status === "delivered"
                  ? ("ok" as const)
                  : null,
          };
        }),
      } satisfies OverviewDetail;
    }),
  );
