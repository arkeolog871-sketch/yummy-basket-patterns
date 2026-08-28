#!/usr/bin/env node
/**
 * Mevcut iOS GoogleService-Info.plist'ten Android google-services.json üretir.
 * Yeni Firebase projesi oluşturmaz; repodaki gerçek plist değerlerini kullanır.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const plistPath = join(ROOT, "ios/App/App/GoogleService-Info.plist");
const outPath = join(ROOT, "android-wrapper/app/google-services.json");

function readPlistValue(key) {
  const plist = readFileSync(plistPath, "utf8");
  const match = plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`));
  if (!match) throw new Error(`GoogleService-Info.plist missing ${key}`);
  return match[1];
}

const projectNumber = readPlistValue("GCM_SENDER_ID");
const projectId = readPlistValue("PROJECT_ID");
const apiKey = readPlistValue("API_KEY");
const iosAppId = readPlistValue("GOOGLE_APP_ID");
const androidAppId = iosAppId.replace(":ios:", ":android:");
const storageBucket = readPlistValue("STORAGE_BUCKET");

const config = {
  project_info: {
    project_number: projectNumber,
    project_id: projectId,
    storage_bucket: storageBucket,
  },
  client: [
    {
      client_info: {
        mobilesdk_app_id: androidAppId,
        android_client_info: {
          package_name: "online.uygulamamcebimde.app",
        },
      },
      oauth_client: [],
      api_key: [{ current_key: apiKey }],
      services: {
        appinvite_service: {
          other_platform_oauth_client: [],
        },
      },
    },
  ],
  configuration_version: "1",
};

writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`[firebase] wrote ${outPath} (appId=${androidAppId})`);
