import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const imageSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  contentType: z
    .string()
    .trim()
    .regex(/^image\/(png|jpeg|jpg|webp|avif)$/, "Desteklenmeyen görsel türü"),
  /** data URL öneki olmadan base64, en fazla ~4MB */
  base64: z.string().min(16).max(6_000_000),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional().nullable(),
  price: z.number().nonnegative().max(1_000_000),
  categoryId: z.string().uuid().nullable().optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  image: imageSchema.nullable().optional(),
  isAvailable: z.boolean().optional(),
  isPopular: z.boolean().optional(),
});

/** Ürün ekler (görsel yüklemesi opsiyoneldir). */
export const createVendorProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => productSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);

    let imageUrl = data.imageUrl?.trim() || null;
    if (data.image) {
      const { uploadRestaurantImage } = await import("./vendor-media.server");
      const uploaded = await uploadRestaurantImage({
        bucket: "product-images",
        restaurantId,
        ...data.image,
      });
      imageUrl = uploaded.url;
    }

    const { data: created, error } = await context.supabase
      .from("menu_items")
      .insert({
        restaurant_id: restaurantId,
        name: data.name,
        description: data.description?.trim() || null,
        price: data.price,
        category_id: data.categoryId ?? null,
        stock_quantity: data.stockQuantity,
        image_url: imageUrl,
        is_available: data.isAvailable ?? data.stockQuantity > 0,
        is_popular: data.isPopular ?? false,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: created?.id ?? null };
  });

/** Mevcut ürünü günceller; yalnızca işletmenin kendi ürünü. */
export const updateVendorProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    productSchema
      .extend({
        id: z.string().uuid(),
        // Form açıldığında görülen stok değeri: mutlak bir sayı yazmak yerine
        // farkı (delta) uygulamak için gerekli — aksi halde form açıkken
        // gelen eşzamanlı siparişlerin düştüğü stok, bu kayıtla geri gelirdi.
        previousStockQuantity: z.number().int().min(0).max(1_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);

    let imageUrl = data.imageUrl?.trim() || null;
    if (data.image) {
      const { uploadRestaurantImage } = await import("./vendor-media.server");
      const uploaded = await uploadRestaurantImage({
        bucket: "product-images",
        restaurantId,
        ...data.image,
      });
      imageUrl = uploaded.url;
    }

    const { data: updated, error } = await context.supabase
      .from("menu_items")
      .update({
        name: data.name,
        description: data.description?.trim() || null,
        price: data.price,
        category_id: data.categoryId ?? null,
        image_url: imageUrl,
        ...(data.isAvailable === undefined ? {} : { is_available: data.isAvailable }),
        ...(data.isPopular === undefined ? {} : { is_popular: data.isPopular }),
      })
      .eq("id", data.id)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Bu ürün işletmenize ait değil");

    const stockDelta = data.stockQuantity - data.previousStockQuantity;
    if (stockDelta !== 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: stockError } = await supabaseAdmin.rpc("increment_menu_item_stock", {
        p_id: data.id,
        p_delta: stockDelta,
      });
      if (stockError) throw new Error(stockError.message);
    }
    return { ok: true };
  });

/** Ürünü siler. */
export const deleteVendorProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);

    const { data: deleted, error } = await context.supabase
      .from("menu_items")
      .delete()
      .eq("id", data.id)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Bu ürün işletmenize ait değil veya siparişlerde kullanılıyor");
    return { ok: true };
  });

/** Ürün kategorisi (menü grubu) oluşturur. */
export const createVendorCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ name: z.string().trim().min(2).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);

    const { data: created, error } = await context.supabase
      .from("menu_categories")
      .insert({ restaurant_id: restaurantId, name: data.name, position: 0 })
      .select("id, name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, category: created };
  });

/** İşletme logosu veya kapak görselini yükler. */
export const uploadVendorBrandImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    imageSchema.extend({ kind: z.enum(["logo", "cover"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);
    const { uploadRestaurantImage } = await import("./vendor-media.server");

    const uploaded = await uploadRestaurantImage({
      bucket: "business-images",
      restaurantId,
      fileName: data.fileName,
      contentType: data.contentType,
      base64: data.base64,
    });

    const patch =
      data.kind === "logo" ? { logo_url: uploaded.url } : { cover_image_url: uploaded.url };
    const { error } = await context.supabase
      .from("restaurants")
      .update(patch)
      .eq("id", restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true, url: uploaded.url };
  });

/** İşletme logosu veya kapak görselini kaldırır. */
export const removeVendorBrandImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ kind: z.enum(["logo", "cover"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);
    const patch = data.kind === "logo" ? { logo_url: null } : { cover_image_url: null };
    const { error } = await context.supabase
      .from("restaurants")
      .update(patch)
      .eq("id", restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Galeriye bir veya birden çok görsel ekler. */
export const addVendorGalleryImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ images: z.array(imageSchema).min(1).max(10) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);
    const { uploadRestaurantImage } = await import("./vendor-media.server");

    const rows: Array<{
      restaurant_id: string;
      url: string;
      storage_path: string;
      kind: string;
      position: number;
    }> = [];

    for (const [index, image] of data.images.entries()) {
      const uploaded = await uploadRestaurantImage({
        bucket: "business-images",
        restaurantId,
        ...image,
      });
      rows.push({
        restaurant_id: restaurantId,
        url: uploaded.url,
        storage_path: uploaded.path,
        kind: "gallery",
        position: index,
      });
    }

    const { error } = await context.supabase.from("business_media").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

/** Galeri görselini kaldırır. */
export const deleteVendorGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);

    const { data: deleted, error } = await context.supabase
      .from("business_media")
      .delete()
      .eq("id", data.id)
      .eq("restaurant_id", restaurantId)
      .select("storage_path")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Bu görsel işletmenize ait değil");

    const { removeRestaurantImage } = await import("./vendor-media.server");
    await removeRestaurantImage("business-images", deleted.storage_path);
    return { ok: true };
  });
