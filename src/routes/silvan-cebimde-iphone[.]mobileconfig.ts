import { createFileRoute } from "@tanstack/react-router";

import { IPHONE_PROFILE_FILENAME } from "@/lib/app-downloads";
import { iphoneMobileconfig } from "@/lib/iphone-mobileconfig";

export const Route = createFileRoute("/silvan-cebimde-iphone.mobileconfig")({
  server: {
    handlers: {
      GET: async () =>
        new Response(iphoneMobileconfig(), {
          headers: {
            "Content-Type": "application/x-apple-aspen-config; charset=utf-8",
            "Content-Disposition": `inline; filename="${IPHONE_PROFILE_FILENAME}"`,
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
