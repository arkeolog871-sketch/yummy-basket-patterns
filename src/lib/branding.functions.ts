import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KINDS = ["logo", "favicon", "banner"] as const;
function patchFor(kind: (typeof KINDS)[number], value: string | null) {
  if (kind === "logo") return { logo_url: value };
  if (kind === "favicon") return { favicon_url: value };
  return { banner_url: value };
}

const uploadSchema = z.object({
  kind: z.enum(KINDS),
  fileName: z.string().trim().min(1).max(120),
  contentType: z
    .string()
    .trim()
    .regex(
      /^image\/(png|jpeg|jpg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/,
      "Desteklenmeyen görsel türü",
    ),
  /** base64 (data URL öneki olmadan), en fazla ~2MB */
  base64: z.string().min(16).max(3_000_000),
});

/** Kurucu, logo / favicon / banner görselini yükler. */
export const uploadBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "branding.upload",
        entity: "site_settings",
        entityId: "global",
        detail: { kind: data.kind, file: data.fileName },
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { decodeValidatedBrandImage } = await import("./vendor-media.server");
        const binary = decodeValidatedBrandImage(data.base64, data.contentType);
        const extension =
          data.contentType === "image/svg+xml"
            ? "svg"
            : data.contentType === "image/x-icon" || data.contentType === "image/vnd.microsoft.icon"
              ? "ico"
              : data.contentType.split("/")[1] === "jpeg"
                ? "jpg"
                : data.contentType.split("/")[1];
        const path = `${data.kind}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("branding")
          .upload(path, binary, { contentType: data.contentType, upsert: true });
        if (uploadError) throw new Error(uploadError.message);

        const publicPath = `/api/public/brand/${path}`;
        const { error } = await supabaseAdmin
          .from("site_settings")
          .update(patchFor(data.kind, publicPath))
          .eq("id", "global");
        if (error) throw new Error(error.message);
        return { ok: true, url: publicPath };
      },
    );
  });

/** Kurucu, yüklenen görseli kaldırır. */
export const removeBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ kind: z.enum(KINDS) }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "branding.remove",
        entity: "site_settings",
        entityId: "global",
        detail: { kind: data.kind },
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("site_settings")
          .update(patchFor(data.kind, null))
          .eq("id", "global");
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });
