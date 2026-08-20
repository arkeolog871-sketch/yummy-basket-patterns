import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KINDS = ["logo", "favicon", "banner"] as const;
const COLUMN = {
  logo: "logo_url",
  favicon: "favicon_url",
  banner: "banner_url",
} as const;

const uploadSchema = z.object({
  kind: z.enum(KINDS),
  fileName: z.string().trim().min(1).max(120),
  contentType: z
    .string()
    .trim()
    .regex(/^image\/(png|jpeg|jpg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/, "Desteklenmeyen görsel türü"),
  /** base64 (data URL öneki olmadan), en fazla ~2MB */
  base64: z.string().min(16).max(3_000_000),
});

/** Kurucu, logo / favicon / banner görselini yükler. */
export const uploadBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);

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
        const binary = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0));
        const extension = (data.fileName.split(".").pop() ?? "png").toLowerCase().slice(0, 5);
        const path = `${data.kind}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("branding")
          .upload(path, binary, { contentType: data.contentType, upsert: true });
        if (uploadError) throw new Error(uploadError.message);

        const publicPath = `/api/public/brand/${path}`;
        const { error } = await supabaseAdmin
          .from("site_settings")
          .update({ [COLUMN[data.kind]]: publicPath })
          .eq("id", "global");
        if (error) throw new Error(error.message);
        return { ok: true, url: publicPath };
      },
    );
  });

/** Kurucu, yüklenen görseli kaldırır. */
export const removeBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ kind: z.enum(KINDS) }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);

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
          .update({ [COLUMN[data.kind]]: null })
          .eq("id", "global");
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });