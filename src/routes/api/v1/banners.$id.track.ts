import { createFileRoute } from "@tanstack/react-router";
import { applySecurityHeaders } from "@/lib/security-wall.server";
import { isMissingAdvertisementsSchema } from "@/lib/advertisements";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return applySecurityHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }),
  );
}

export const Route = createFileRoute("/api/v1/banners/$id/track")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const id = params.id ?? "";
        if (!UUID_RE.test(id)) return json({ error: "Geçersiz reklam" }, 400);

        let type: unknown = null;
        try {
          const body: unknown = await request.json();
          type = body && typeof body === "object" ? (body as Record<string, unknown>)["type"] : null;
        } catch {
          return json({ error: "Geçersiz gövde" }, 400);
        }
        if (type !== "impression" && type !== "click") {
          return json({ error: "type impression veya click olmalı" }, 400);
        }

        try {
          const { createPublicClient } = await import("@/lib/catalog.server");
          const supabase = createPublicClient();
          const { error } = await supabase.rpc("track_advertisement", {
            p_id: id,
            p_type: type,
          });
          if (error) {
            if (isMissingAdvertisementsSchema(error)) return json({ ok: true });
            console.error("[banners.track]", error.message);
            return json({ error: "Kayıt alınamadı" }, 500);
          }
          return json({ ok: true });
        } catch (error) {
          console.error("[banners.track]", error);
          return json({ ok: true });
        }
      },
    },
  },
});
