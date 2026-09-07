import { createFileRoute } from "@tanstack/react-router";

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
        const { ALLOWED_MEDIA_BUCKETS, SAFE_MEDIA_PATH } =
          await import("@/lib/vendor-media.server");
        if (!ALLOWED_MEDIA_BUCKETS.has(bucket) || !SAFE_MEDIA_PATH.test(path)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": data.type || "application/octet-stream",
            // Dosya adı yükleme başına rastgele üretiliyor (bkz. uploadRestaurantImage);
            // aynı yol her zaman aynı içeriği döner, bu yüzden sonsuza kadar
            // önbelleklenebilir — yeniden yükleme her zaman yeni bir yol üretir.
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
