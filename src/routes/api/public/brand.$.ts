import { createFileRoute } from "@tanstack/react-router";

const SAFE_BRAND_PATH = /^(logo|favicon|banner|hero|ads)\/[A-Za-z0-9-]{1,80}\.(png|jpg|jpeg|webp|gif|avif|bmp|svg|ico)$/i;

export const Route = createFileRoute("/api/public/brand/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!path || path.includes("..") || path.includes("\\") || !SAFE_BRAND_PATH.test(path)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("branding").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": data.type || "application/octet-stream",
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": "inline",
            "Content-Security-Policy":
              "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
