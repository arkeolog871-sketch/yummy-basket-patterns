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

async function handleUpload(request: Request) {
  const { founderClientFromRequest, uploadFounderBannerFile } = await import(
    "@/lib/advertisements-upload.server"
  );
  const supabase = await founderClientFromRequest(request);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return json({ error: "Dosya seçilmedi" }, 400);
  }
  const named = file as Blob & { name?: string };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await uploadFounderBannerFile({
    supabase,
    bytes,
    fileName: typeof named.name === "string" ? named.name : "reklam",
    contentType: file.type || "application/octet-stream",
  });
  return json({ url: uploaded.url, path: uploaded.path });
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
      POST: async ({ request }) => {
        try {
          return await handleUpload(request);
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
