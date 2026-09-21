/**
 * Fotoğraftan ürün çıkarma — sunucu fonksiyonları (istemci güvenli modül).
 *
 * Ağır iş `ai-menu-import.server.ts`'te; burada yalnızca yetki, doğrulama ve
 * kayıt var. Yetki yolu toplu Excel aktarımıyla BİREBİR aynıdır
 * (assertImportAccess): işletme kendi kataloğunu, kurucu/bölge yöneticisi
 * yalnızca yetki alanındaki işletmenin kataloğunu işleyebilir.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import {
  assertImportAccess,
  resolveCategories,
} from "./product-import.functions";
import {
  MAX_PHOTOS,
  extractProductsFromImages,
} from "./ai-menu-import.server";

const photoSchema = z.object({
  restaurantId: z.string().uuid(),
  /** Veri adresli (data:image/…) küçültülmüş fotoğraflar. */
  images: z
    .array(z.string().startsWith("data:image/").max(6_000_000))
    .min(1)
    .max(MAX_PHOTOS),
});

/** Menü fotoğraflarından ürün listesi çıkarır; hiçbir şey kaydetmez. */
export const extractMenuItemsFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => photoSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(
        { supabase: context.supabase, userId: context.userId, claims: context.claims },
        data.restaurantId,
      );
      const products = await extractProductsFromImages(data.images);
      return { products };
    }),
  );

const saveItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().min(0).max(100_000),
  categoryName: z.string().trim().max(60).nullable(),
  description: z.string().trim().max(300).nullable(),
});

const saveSchema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(saveItemSchema).min(1).max(200),
});

/**
 * Onaylanan ürünleri işletmenin kataloğuna kaydeder. Veritabanı tarafı
 * import_menu_items_by_name RPC'si: isim eşleşirse fiyatı günceller, elle
 * düzeltilmiş ad/görsel/açıklamayı korur; yoksa yeni ürün açar.
 */
export const importExtractedMenuItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(
        { supabase: context.supabase, userId: context.userId, claims: context.claims },
        data.restaurantId,
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const categoryNames = [
        ...new Set(
          data.items
            .map((item) => item.categoryName)
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      const categories = await resolveCategories(data.restaurantId, categoryNames);
      const normalizeName = (value: string) => value.trim().toLocaleLowerCase("tr");

      const rows = data.items.map((item) => ({
        name: item.name,
        price: item.price,
        vat_rate: null,
        unit: null,
        category_id: item.categoryName
          ? (categories.get(normalizeName(item.categoryName)) ?? null)
          : null,
        description: item.description,
      }));

      const { data: result, error } = await supabaseAdmin.rpc("import_menu_items_by_name", {
        p_restaurant_id: data.restaurantId,
        p_rows: rows,
      });
      if (error) throw new Error(error.message);
      const first = Array.isArray(result) ? result[0] : result;
      const created = Number(first?.created_count ?? 0);
      const updated = Number(first?.updated_count ?? 0);

      // Aktarım günlüğü: CSV akışıyla aynı tabloya, kaynağı ayrı yazılır.
      const actorEmail = (context.claims as { email?: string } | null)?.email ?? null;
      const { error: logError } = await supabaseAdmin.from("product_imports").insert({
        restaurant_id: data.restaurantId,
        actor_id: context.userId,
        source: "ai_menu_photo",
        file_name: actorEmail ? `Menü fotoğrafı · ${actorEmail}` : "Menü fotoğrafı",
        total_rows: data.items.length,
        created_count: created,
        updated_count: updated,
        skipped_count: 0,
      });
      if (logError) throw new Error(logError.message);

      return { created, updated };
    }),
  );
