import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ResizableMediaFile = {
  bucket: "business-images" | "product-images" | "banners";
  path: string;
  size: number;
  url: string;
};

/** Görsel küçültme yalnızca yeni yüklemelerde devreye girdiği için (bkz.
 * ImageDropzone.tsx), daha önce yüklenmiş dosyaları listeler — kurucu paneli
 * bunları tarayıcıda küçültüp aynı yola geri yükler (bkz. reprocessMediaFile). */
export const listResizableMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ALLOWED_MEDIA_BUCKETS } = await import("./vendor-media.server");

    async function listAll(
      bucket: ResizableMediaFile["bucket"],
      prefix = "",
    ): Promise<ResizableMediaFile[]> {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(prefix, { limit: 1000 });
      if (error) throw new Error(error.message);
      let out: ResizableMediaFile[] = [];
      for (const entry of data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          out = out.concat(await listAll(bucket, path));
        } else {
          out.push({
            bucket,
            path,
            size: entry.metadata?.size ?? 0,
            url: `/api/public/media/${bucket}/${path}`,
          });
        }
      }
      return out;
    }

    let files: ResizableMediaFile[] = [];
    for (const bucket of ALLOWED_MEDIA_BUCKETS) {
      files = files.concat(await listAll(bucket as ResizableMediaFile["bucket"]));
    }
    return files.sort((a, b) => b.size - a.size);
  });

const reprocessSchema = z.object({
  bucket: z.enum(["business-images", "product-images", "banners"]),
  path: z.string().min(1).max(300),
  contentType: z.enum(["image/jpeg", "image/png"]),
  base64: z.string().min(16).max(6_000_000),
});

/** Kurucu panelinde tarayıcıda küçültülen bir görseli, aynı depolama yoluna
 * (üzerine yazarak) geri yükler — adres değişmediği için hiçbir işletme/ürün
 * kaydını güncellemek gerekmez. */
export const reprocessMediaFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => reprocessSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { SAFE_MEDIA_PATH, decodeValidatedImage } = await import("./vendor-media.server");
    if (!SAFE_MEDIA_PATH.test(data.path)) throw new Error("Geçersiz dosya yolu");

    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "media.reprocess",
        entity: "storage",
        entityId: `${data.bucket}/${data.path}`,
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const binary = decodeValidatedImage(data.base64, data.contentType, 4 * 1024 * 1024);
        const { error } = await supabaseAdmin.storage
          .from(data.bucket)
          .upload(data.path, binary, { contentType: data.contentType, upsert: true });
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });
