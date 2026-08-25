import { createFileRoute } from "@tanstack/react-router";
import { applySecurityHeaders } from "@/lib/security-wall.server";
import { isMissingAdvertisementsSchema, parsePublicBanner } from "@/lib/advertisements";
import { toPublicErrorMessage } from "@/lib/public-error";

function json(data: unknown, status = 200, extra?: Record<string, string>) {
  return applySecurityHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        ...extra,
      },
    }),
  );
}

async function handleSave(request: Request) {
  const { uploadAndSaveFounderBanner } = await import("@/lib/advertisements-upload.server");
  const saved = await uploadAndSaveFounderBanner(request);
  return json({ url: saved.url, path: saved.path, id: saved.id });
}

export const Route = createFileRoute("/api/v1/banners")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { createPublicClient } = await import("@/lib/catalog.server");
          const supabase = createPublicClient();
          const expired = await supabase.rpc("expire_stale_advertisements");
          if (expired.error && !isMissingAdvertisementsSchema(expired.error)) {
            console.error("[banners.expire]", expired.error.message);
          }
          const { data, error } = await supabase.rpc("get_active_banners");
          const rows: unknown = data;
          if (error) {
            if (isMissingAdvertisementsSchema(error)) return json([]);
            console.error("[banners]", error.message);
            return json({ error: "Reklamlar yüklenemedi" }, 500);
          }
          const banners = (Array.isArray(rows) ? rows : [])
            .map(parsePublicBanner)
            .filter((item) => item != null);
          return json(banners);
        } catch (error) {
          console.error("[banners]", error);
          return json([]);
        }
      },
      POST: async ({ request }) => {
        try {
          return await handleSave(request);
        } catch (error) {
          const message = toPublicErrorMessage(error);
          const lower = message.toLowerCase();
          const unauthorized = lower.includes("unauthorized") || lower.includes("oturum");
          const forbidden = lower.includes("yetki") || lower.includes("forbidden");
          const status = unauthorized ? 401 : forbidden ? 403 : 400;
          return json({ error: message }, status);
        }
      },
    },
  },
});
