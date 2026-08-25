import { createFileRoute } from "@tanstack/react-router";
import { applySecurityHeaders } from "@/lib/security-wall.server";
import { isMissingAdvertisementsSchema, parsePublicBanner } from "@/lib/advertisements";

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
          let rows: unknown = data;
          if (error) {
            const fallback = await supabase
              .from("public_banners")
              .select("id,title,image_url,action_type,action_value,display_order")
              .order("display_order", { ascending: true });
            if (fallback.error) {
              if (isMissingAdvertisementsSchema(error) || isMissingAdvertisementsSchema(fallback.error)) {
                return json([]);
              }
              console.error("[banners]", error.message, fallback.error.message);
              return json({ error: "Reklamlar yüklenemedi" }, 500);
            }
            rows = fallback.data;
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
    },
  },
});
