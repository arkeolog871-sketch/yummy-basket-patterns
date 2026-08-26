import { createFileRoute } from "@tanstack/react-router";
import { androidAssetlinksJson } from "@/lib/android-assetlinks";
import { applySecurityHeaders } from "@/lib/security-wall.server";

/** `/.well-known/assetlinks.json` — SPA catch-all bu yolu HTML 404 yapmasın. */
export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () =>
        applySecurityHeaders(
          new Response(androidAssetlinksJson(), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "X-Content-Type-Options": "nosniff",
            },
          }),
        ),
      HEAD: async () =>
        applySecurityHeaders(
          new Response(null, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "X-Content-Type-Options": "nosniff",
            },
          }),
        ),
    },
  },
});
