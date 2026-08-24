import { createFileRoute } from "@tanstack/react-router";
import { contentTypeForBrandPath } from "@/lib/upload-limits";

const SAFE_BRAND_PATH =
  /^(logo|favicon|banner|hero|ads)\/[A-Za-z0-9-]{1,80}\.(png|jpg|jpeg|webp|gif|avif|bmp|svg|ico|mp4|mov|webm)$/i;

function parseByteRange(header: string | null, total: number): { start: number; end: number } | null {
  if (!header) return null;
  const unit = header.trim();
  if (!unit.toLowerCase().startsWith("bytes=")) return null;
  const spec = unit.slice(6).split(",")[0]?.trim() ?? "";
  const dash = spec.indexOf("-");
  if (dash === -1) return null;
  const startRaw = spec.slice(0, dash);
  const endRaw = spec.slice(dash + 1);
  if (!startRaw && !endRaw) return null;
  if (!startRaw) {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, total - suffix), end: total - 1 };
  }
  const start = Number(startRaw);
  const end = endRaw ? Math.min(total - 1, Number(endRaw)) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= total) {
    return null;
  }
  return { start, end };
}

export const Route = createFileRoute("/api/public/brand/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = params._splat ?? "";
        if (!path || path.includes("..") || path.includes("\\") || !SAFE_BRAND_PATH.test(path)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("branding").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        const buffer = await data.arrayBuffer();
        const total = buffer.byteLength;
        const contentType = contentTypeForBrandPath(path, data.type || "application/octet-stream");
        const isVideo = contentType.startsWith("video/");
        const baseHeaders: Record<string, string> = {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=300",
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": isVideo
            ? "default-src 'none'; media-src 'self'"
            : "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        };
        if (isVideo) baseHeaders["Accept-Ranges"] = "bytes";

        const range = parseByteRange(request.headers.get("range"), total);
        if (request.headers.has("range") && !range) {
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
          });
        }
        if (range) {
          const slice = buffer.slice(range.start, range.end + 1);
          return new Response(slice, {
            status: 206,
            headers: {
              ...baseHeaders,
              "Content-Range": `bytes ${range.start}-${range.end}/${total}`,
              "Content-Length": String(slice.byteLength),
            },
          });
        }

        return new Response(buffer, {
          headers: {
            ...baseHeaders,
            "Content-Length": String(total),
          },
        });
      },
    },
  },
});
