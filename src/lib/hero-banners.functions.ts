import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  HERO_INTERVAL_MAX,
  HERO_INTERVAL_MIN,
  MAX_HERO_BANNERS,
  parseHeroBanners,
  sanitizeBannerHref,
} from "@/lib/hero-banners";
import { isMissingColumnError } from "@/lib/typography";
import type { Json } from "@/integrations/supabase/types";

const slideSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().max(80),
  subtitle: z.string().trim().max(160),
  ctaLabel: z.string().trim().max(40),
  href: z.string().trim().max(500),
  imageUrl: z.string().trim().max(500),
  active: z.boolean(),
});

const bannersSchema = z.object({
  autoplay: z.boolean(),
  intervalMs: z.number().int().min(HERO_INTERVAL_MIN).max(HERO_INTERVAL_MAX),
  slides: z.array(slideSchema).max(MAX_HERO_BANNERS),
});

const MISSING_COLUMN_MESSAGE =
  "Reklam sütunu henüz yok. Supabase SQL Editor’da hero_banners komutunu bir kez çalıştırın.";

export const updateHeroBanners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const parsed = parseHeroBanners(bannersSchema.parse(input));
    return {
      ...parsed,
      slides: parsed.slides.map((slide) => ({
        ...slide,
        href: sanitizeBannerHref(slide.href),
      })),
    };
  })
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "hero_banners.update",
        entity: "site_settings",
        entityId: "global",
        detail: { count: data.slides.length, autoplay: data.autoplay },
      },
      async () => {
        const { error } = await context.supabase
          .from("site_settings")
          .update({ hero_banners: data as unknown as Json })
          .eq("id", "global");
        if (error) {
          if (isMissingColumnError(error, "hero_banners")) {
            throw new Error(MISSING_COLUMN_MESSAGE);
          }
          throw new Error(error.message);
        }
        return { ok: true };
      },
    );
  });

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(120),
  contentType: z
    .string()
    .trim()
    .regex(/^image\/(png|jpeg|jpg|webp)$/, "Yalnızca PNG, JPG veya WEBP"),
  base64: z.string().min(16).max(3_000_000),
});

export const uploadHeroBannerImage = createServerFn({ method: "POST" })
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
        action: "hero_banners.upload",
        entity: "site_settings",
        entityId: "global",
        detail: { file: data.fileName },
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { decodeValidatedBrandImage } = await import("./vendor-media.server");
        const binary = decodeValidatedBrandImage(data.base64, data.contentType);
        const extension = data.contentType.split("/")[1] === "jpeg" ? "jpg" : data.contentType.split("/")[1];
        const path = `hero/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("branding")
          .upload(path, binary, { contentType: data.contentType, upsert: true });
        if (uploadError) throw new Error(uploadError.message);
        return { ok: true, url: `/api/public/brand/${path}` };
      },
    );
  });
