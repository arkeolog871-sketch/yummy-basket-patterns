// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

const ASSETLINKS_URL = "/.well-known/assetlinks.json";

function assetlinksHeadersPlugin(): Plugin {
  return {
    name: "assetlinks-headers",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] === ASSETLINKS_URL) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("X-Content-Type-Options", "nosniff");
        }
        next();
      });
    },
  };
}

function apkLinkRevPlugin(): Plugin {
  const stamp = (html: string) =>
    html.replace(
      /\/silvan-cebimde\.apk(?:\?v=[^"'\s]*)?/g,
      `/silvan-cebimde.apk?v=${encodeURIComponent(apkRev())}`,
    );

  return {
    name: "apk-link-rev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/android.html") {
          next();
          return;
        }
        const file = path.resolve(import.meta.dirname, "public/android.html");
        if (!existsSync(file)) {
          next();
          return;
        }
        const body = stamp(readFileSync(file, "utf8"));
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(body);
      });
    },
    closeBundle() {
      const file = path.resolve(".output/public/android.html");
      if (!existsSync(file)) return;
      writeFileSync(file, stamp(readFileSync(file, "utf8")));
    },
  };
}

function apkVersionName(): string {
  const gradle = path.resolve(import.meta.dirname, "android-wrapper/app/build.gradle.kts");
  if (!existsSync(gradle)) return "";
  const match = readFileSync(gradle, "utf8").match(/versionName\s*=\s*"([^"]+)"/);
  return match?.[1]?.trim() ?? "";
}

function apkRev(): string {
  const version = apkVersionName() || "1";
  const apk = path.resolve(import.meta.dirname, "public/silvan-cebimde.apk");
  if (!existsSync(apk)) return version;
  const st = statSync(apk);
  return `${version}.${st.size}-${Math.trunc(st.mtimeMs)}`;
}

// Sunucu rotaları (e-posta webhook'ları vb.) VITE_ öneki olmayan değişkenlere ihtiyaç duyar.
const serverEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);
process.env["VITE_APK_VERSION"] = apkVersionName() || process.env["VITE_APK_VERSION"] || "1";
process.env["VITE_APK_REV"] = apkRev();

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [iphoneProfileHeadersPlugin(), apkLinkRevPlugin(), assetlinksHeadersPlugin()],
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
