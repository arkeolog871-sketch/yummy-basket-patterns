#!/usr/bin/env node
/**
 * Android google-services.json hazırlar.
 * Gerçek dosya zaten varsa (Firebase Console'dan) üzerine yazmaz.
 * Yoksa iOS GoogleService-Info.plist'ten yalnızca proje metadata ile iskelet üretir.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const plistPath = join(ROOT, "ios/App/App/GoogleService-Info.plist");
const outPath = join(ROOT, "android-wrapper/app/google-services.json");

if (existsSync(outPath)) {
  try {
    const existing = JSON.parse(readFileSync(outPath, "utf8"));
    const appId = existing?.client?.[0]?.client_info?.mobilesdk_app_id;
    const pkg = existing?.client?.[0]?.client_info?.android_client_info?.package_name;
    if (
      typeof appId === "string" &&
      appId.includes(":android:") &&
      pkg === "online.uygulamamcebimde.app" &&
      !appId.includes("REPLACE")
    ) {
      console.log(`[firebase] keep existing ${outPath} (appId=${appId})`);
      process.exit(0);
    }
  } catch {
    // Bozuk dosya varsa aşağıda yeniden üret.
  }
}

function readPlistValue(key) {
  const plist = readFileSync(plistPath, "utf8");
  const match = plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`));
  if (!match) throw new Error(`GoogleService-Info.plist missing ${key}`);
  return match[1];
}

const projectNumber = readPlistValue("GCM_SENDER_ID");
const projectId = readPlistValue("PROJECT_ID");
const storageBucket = readPlistValue("STORAGE_BUCKET");

console.error(
  `[firebase] ${outPath} yok veya geçersiz. Firebase Console Android google-services.json gerekli (package: online.uygulamamcebimde.app, project: ${projectId}/${projectNumber}, bucket: ${storageBucket}).`,
);
process.exit(1);
