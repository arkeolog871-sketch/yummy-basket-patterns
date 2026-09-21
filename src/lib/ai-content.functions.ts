/**
 * Ürün içeriği üretimi — sunucu fonksiyonları (istemci güvenli modül).
 *
 * Yetki toplu ürün aktarımıyla aynı: yalnızca o işletmenin satıcısı, kurucu
 * veya yetkili sayfa yöneticisi çağırabilir.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import { assertImportAccess } from "./product-import.functions";

const baseSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  categoryName: z.string().trim().max(80).nullable().optional(),
});

export const generateProductDescriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => baseSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(context, data.restaurantId);
      const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
      await enforceSensitiveRateLimit(`ai-product-text:${data.restaurantId}`, 60, 60_000);
      const { generateProductDescription } = await import("./ai-content.server");
      const description = await generateProductDescription({
        name: data.name,
        categoryName: data.categoryName ?? null,
      });
      return { description };
    }),
  );

export const generateProductImageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => baseSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(context, data.restaurantId);
      const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
      await enforceSensitiveRateLimit(`ai-product-image:${data.restaurantId}`, 20, 60_000);
      const { generateProductImage } = await import("./ai-content.server");
      return generateProductImage({
        name: data.name,
        categoryName: data.categoryName ?? null,
      });
    }),
  );
