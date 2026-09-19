import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import { IMPORT_UNITS } from "./product-import";

/**
 * Market ürün listesinin veritabanına işlenmesi.
 *
 * Dosya istemcide ayrıştırılıp (product-import.ts) buraya parça parça gelir:
 * 5.000 satırlık bir liste tek istekte gönderilse hem istek boyutu hem de
 * sunucu süresi sınırlarına takılır. Her parça kendi işleminde birleştirilir;
 * `importId` ile hepsi tek bir aktarım günlüğüne yazılır.
 */

const IMPORT_CHUNK_MAX = 500;

const rowSchema = z.object({
  line: z.number().int().min(1).max(1_000_000),
  barcode: z.string().trim().max(32).nullable(),
  externalId: z.string().trim().max(64).nullable(),
  name: z.string().trim().max(80).nullable(),
  price: z.number().min(0).max(100_000),
  stock: z.number().int().min(0).max(1_000_000).nullable(),
  vatRate: z.number().min(0).max(100).nullable(),
  unit: z.enum(IMPORT_UNITS).nullable(),
  category: z.string().trim().max(60).nullable(),
});

const skippedSchema = z.object({
  line: z.number().int().min(1).max(1_000_000),
  reason: z.string().trim().max(200),
  raw: z.string().trim().max(120),
});

const importSchema = z.object({
  restaurantId: z.string().uuid(),
  /** İlk parçada null; sunucu günlüğü açıp kimliğini döner. */
  importId: z.string().uuid().nullable().default(null),
  fileName: z.string().trim().max(160).nullable().default(null),
  rows: z.array(rowSchema).max(IMPORT_CHUNK_MAX),
  /** Ayrıştırmada elenen satırlar; işletme neyi düzelteceğini görsün diye. */
  skipped: z.array(skippedSchema).max(IMPORT_CHUNK_MAX).default([]),
  totalRows: z.number().int().min(0).max(1_000_000).default(0),
});

export type ImportChunkResult = {
  importId: string;
  created: number;
  updated: number;
  skipped: number;
  /** Ortak katalogdan adı/görseli doldurulan ürün sayısı. */
  enriched: number;
};

/**
 * Aktarımı kimin yapabileceği: işletme kendi kataloğunu, kurucu/bölge
 * yöneticisi ise yetki alanındaki işletmenin kataloğunu aktarabilir.
 * İstemciden gelen restaurantId asla doğrudan kullanılmaz.
 */
async function assertImportAccess(
  context: {
    supabase: Parameters<typeof import("./vendor.server").assertVendor>[0];
    userId: string;
    claims: unknown;
  },
  restaurantId: string,
): Promise<void> {
  const { getVendorRestaurantId } = await import("./vendor.server");
  const ownRestaurantId = await getVendorRestaurantId(context.supabase, context.userId);
  if (ownRestaurantId) {
    // İşletme hesabı: yalnızca kendi işletmesi. Başka bir işletmeyi
    // hedeflediyse panel yetkisine bakmaya gerek yok, zaten yetkisiz.
    if (ownRestaurantId !== restaurantId) throw new Error("Forbidden");
    const { assertVerifiedEmail } = await import("./otp.server");
    await assertVerifiedEmail(context.userId);
    return;
  }
  const { assertPanelAccess, assertRestaurantInScope } = await import("./founder.server");
  const access = await assertPanelAccess(context.supabase, context.userId, context.claims as never);
  await assertRestaurantInScope(access, restaurantId);
}

const normalizeName = (value: string) => value.trim().toLocaleLowerCase("tr");

/** Dosyadaki kategori adlarını işletmenin kategorilerine bağlar, eksikleri açar. */
async function resolveCategories(
  restaurantId: string,
  names: string[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  if (names.length === 0) return resolved;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const existing = await supabaseAdmin
    .from("menu_categories")
    .select("id, name, position")
    .eq("restaurant_id", restaurantId)
    .limit(1000);
  if (existing.error) throw new Error(existing.error.message);

  for (const row of existing.data ?? []) resolved.set(normalizeName(row.name), row.id);

  const missing = names.filter((name) => !resolved.has(normalizeName(name)));
  if (missing.length === 0) return resolved;

  let position = Math.max(0, ...(existing.data ?? []).map((row) => row.position ?? 0)) + 1;
  const created = await supabaseAdmin
    .from("menu_categories")
    .insert(missing.map((name) => ({ restaurant_id: restaurantId, name, position: position++ })))
    .select("id, name");
  if (created.error) throw new Error(created.error.message);
  for (const row of created.data ?? []) resolved.set(normalizeName(row.name), row.id);
  return resolved;
}

type CatalogEntry = {
  name: string;
  image_url: string | null;
  unit: string | null;
  default_vat_rate: number | null;
};

/** Barkodları ortak katalogda arar: ad ve görsel buradan gelir. */
async function lookupCatalog(barcodes: string[]): Promise<Map<string, CatalogEntry>> {
  const found = new Map<string, CatalogEntry>();
  if (barcodes.length === 0) return found;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("product_catalog")
    .select("barcode, name, image_url, unit, default_vat_rate")
    .in("barcode", barcodes);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    found.set(row.barcode, {
      name: row.name,
      image_url: row.image_url,
      unit: row.unit,
      default_vat_rate: row.default_vat_rate,
    });
  }
  return found;
}

/**
 * Katalogda olmayan barkodları katalogla. Var olan kaydın üstüne YAZMAZ:
 * katalog elle düzeltilmiş olabilir, marketin "COCA COLA 1LT PET" yazımı onu
 * bozmamalı. Katalog böylece her yeni marketle kendiliğinden zenginleşir.
 */
async function contributeToCatalog(
  restaurantId: string,
  rows: {
    barcode: string | null;
    name: string | null;
    unit: string | null;
    vatRate: number | null;
  }[],
): Promise<void> {
  const candidates = rows.filter(
    (row): row is typeof row & { barcode: string; name: string } =>
      Boolean(row.barcode) && Boolean(row.name),
  );
  if (candidates.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("product_catalog").upsert(
    candidates.map((row) => ({
      barcode: row.barcode,
      name: row.name,
      unit: row.unit,
      default_vat_rate: row.vatRate,
      first_seen_restaurant_id: restaurantId,
    })),
    { onConflict: "barcode", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export const importProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => importSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(
        { supabase: context.supabase, userId: context.userId, claims: context.claims },
        data.restaurantId,
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const categoryNames = [
        ...new Set(
          data.rows.map((row) => row.category).filter((name): name is string => Boolean(name)),
        ),
      ];
      const categories = await resolveCategories(data.restaurantId, categoryNames);

      const barcodes = data.rows
        .map((row) => row.barcode)
        .filter((barcode): barcode is string => Boolean(barcode));
      const catalog = await lookupCatalog(barcodes);

      let enriched = 0;
      const payload = data.rows.map((row) => {
        const entry = row.barcode ? catalog.get(row.barcode) : undefined;
        // Ad önceliği: ortak katalog > dosyadaki ad. Katalog adı insan eliyle
        // düzeltilmiş "Coca-Cola 1 L" iken market listesi "COCA COLA 1LT PET"
        // yazar; vitrinde okunabilir olanı göstermek istiyoruz.
        const name = entry?.name ?? row.name;
        if (entry && (entry.name || entry.image_url)) enriched += 1;
        return {
          barcode: row.barcode,
          external_id: row.externalId,
          name,
          price: row.price,
          stock: row.stock,
          vat_rate: row.vatRate ?? entry?.default_vat_rate ?? null,
          unit: row.unit ?? entry?.unit ?? null,
          category_id: row.category ? (categories.get(normalizeName(row.category)) ?? null) : null,
          image_url: entry?.image_url ?? null,
        };
      });

      let created = 0;
      let updated = 0;
      if (payload.length > 0) {
        const { data: result, error } = await supabaseAdmin.rpc("import_menu_items", {
          p_restaurant_id: data.restaurantId,
          p_rows: payload,
        });
        if (error) throw new Error(error.message);
        const first = Array.isArray(result) ? result[0] : result;
        created = Number(first?.created_count ?? 0);
        updated = Number(first?.updated_count ?? 0);
        await contributeToCatalog(data.restaurantId, data.rows);
      }

      // Aktarım günlüğü: ilk parça açar, sonraki parçalar sayaçları büyütür.
      let importId = data.importId;
      if (!importId) {
        const { data: log, error } = await supabaseAdmin
          .from("product_imports")
          .insert({
            restaurant_id: data.restaurantId,
            actor_id: context.userId,
            source: "csv",
            file_name: data.fileName,
            total_rows: data.totalRows,
            created_count: created,
            updated_count: updated,
            skipped_count: data.skipped.length,
            skipped: data.skipped.length > 0 ? data.skipped : null,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        importId = log.id;
      } else {
        const current = await supabaseAdmin
          .from("product_imports")
          .select("created_count, updated_count, skipped_count, skipped")
          .eq("id", importId)
          .eq("restaurant_id", data.restaurantId)
          .single();
        if (current.error) throw new Error(current.error.message);
        const previousSkipped = Array.isArray(current.data.skipped) ? current.data.skipped : [];
        const { error } = await supabaseAdmin
          .from("product_imports")
          .update({
            created_count: current.data.created_count + created,
            updated_count: current.data.updated_count + updated,
            skipped_count: current.data.skipped_count + data.skipped.length,
            // Günlük sonsuz büyümesin: ilk 200 elenen satır yeter, gerisi sayıda.
            skipped: [...previousSkipped, ...data.skipped].slice(0, 200),
          })
          .eq("id", importId)
          .eq("restaurant_id", data.restaurantId);
        if (error) throw new Error(error.message);
      }

      return {
        importId,
        created,
        updated,
        skipped: data.skipped.length,
        enriched,
      } satisfies ImportChunkResult;
    }),
  );

/** İşletmenin son aktarımları — panelde "en son ne zaman, kaç ürün" için. */
export const listProductImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(
        { supabase: context.supabase, userId: context.userId, claims: context.claims },
        data.restaurantId,
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("product_imports")
        .select(
          "id, file_name, total_rows, created_count, updated_count, skipped_count, skipped, created_at",
        )
        .eq("restaurant_id", data.restaurantId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return { imports: rows ?? [] };
    }),
  );

export { IMPORT_CHUNK_MAX };
