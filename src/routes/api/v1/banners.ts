import { createFileRoute } from "@tanstack/react-router";
import { applySecurityHeaders } from "@/lib/security-wall.server";
import { isMissingAdvertisementsSchema, parsePublicBanner } from "@/lib/advertisements";

function json(data: unknown, status = 200, extra?: Record<string, string>) {
  return applySecurityHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": status === 200 ? "public, max-age=30" : "no-store",
        ...extra,
      },
    }),
  );
}

export const Route = createFileRoute("/api/v1/banners")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { createPublicClient } = await import("@/lib/catalog.server");
          const supabase = createPublicClient();
          await supabase.rpc("expire_stale_advertisements");
          const { data, error } = await supabase.rpc("get_active_banners");
          if (error) {
            if (isMissingAdvertisementsSchema(error)) return json([]);
            console.error("[banners]", error.message);
            return json({ error: "Reklamlar yüklenemedi" }, 500);
          }
          const banners = (Array.isArray(data) ? data : [])
            .map(parsePublicBanner)
            .filter((item) => item != null);
          return json(banners);
        } catch (error) {
          console.error("[banners]", error);
          return json([]);
        }
      },
    },
  },
});
