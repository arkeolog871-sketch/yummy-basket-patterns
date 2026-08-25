import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_BUCKETS = new Set(["product-images", "business-images", "banners"]);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const SAFE_MEDIA_PATH = new RegExp(
  `^(?:${UUID}/[A-Za-z0-9-]+\\.(?:png|jpg|webp|avif)|ads/${UUID}\\.(?:png|jpg|jpeg|webp|gif|avif|bmp|heic|heif|mp4|mov|webm))$`,
  "i",
);

export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = params._splat ?? "";
        if (!splat || splat.includes("..") || splat.includes("\\")) {
          return new Response("Not found", { status: 404 });
        }

        const slash = splat.indexOf("/");
        const bucket = slash === -1 ? "" : splat.slice(0, slash);
        const path = slash === -1 ? "" : splat.slice(slash + 1);
        if (!ALLOWED_BUCKETS.has(bucket) || !SAFE_MEDIA_PATH.test(path)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": data.type || "application/octet-stream",
            "Cache-Control": "public, max-age=600",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
