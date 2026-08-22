// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";

const IPHONE_PROFILE_URL = "/silvan-cebimde-iphone.mobileconfig";
const IPHONE_PROFILE_MIME = "application/x-apple-aspen-config";
const IPHONE_PROFILE_HEADERS_BLOCK = `${IPHONE_PROFILE_URL}
  Content-Type: ${IPHONE_PROFILE_MIME}
  Content-Disposition: inline; filename=silvan-cebimde-iphone.mobileconfig
`;

/**
 * This project is Vite + TanStack Start, not Next.js — there is no next.config.js.
 * Equivalent of next.config.js headers() for the iPhone install profile.
 */
function iphoneProfileHeadersPlugin(): Plugin {
  return {
    name: "iphone-profile-headers",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] === IPHONE_PROFILE_URL) {
          res.setHeader("Content-Type", IPHONE_PROFILE_MIME);
          res.setHeader(
            "Content-Disposition",
            "inline; filename=silvan-cebimde-iphone.mobileconfig",
          );
        }
        next();
      });
    },
    closeBundle() {
      const headersFile = path.resolve(".output/public/_headers");
      if (!existsSync(headersFile)) return;
      const current = readFileSync(headersFile, "utf8");
      if (current.includes("silvan-cebimde-iphone.mobileconfig")) return;
      writeFileSync(headersFile, `${current.trimEnd()}\n\n${IPHONE_PROFILE_HEADERS_BLOCK}`);
    },
  };
}

// Sunucu rotaları (e-posta webhook'ları vb.) VITE_ öneki olmayan değişkenlere ihtiyaç duyar.
const serverEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [iphoneProfileHeadersPlugin()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
});
