#!/usr/bin/env node
/**
 * Bildirim sisteminin production öncesi hazırlık kontrolü.
 * Gerçek secret üretmez / okumaz / yazdırmaz; yalnızca varlık ve yapı denetler.
 *
 * Kullanım:
 *   node scripts/notification-production-preflight.mjs
 *   node scripts/notification-production-preflight.mjs --strict
 *
 * --strict: production deploy kapısı (eksik zorunlu öğelerde exit 1)
 * varsayılan: geliştirme dostu özet (exit 0); eksikler raporlanır
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");

function present(name) {
  const value = process.env[name];
  return Boolean(value && String(value).trim());
}

function fileOk(rel) {
  return existsSync(join(ROOT, rel));
}

function gitignoreBlocks(pattern) {
  const gitignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
  const androidIgnore = existsSync(join(ROOT, "android-wrapper/.gitignore"))
    ? readFileSync(join(ROOT, "android-wrapper/.gitignore"), "utf8")
    : "";
  return gitignore.includes(pattern) || androidIgnore.includes(pattern);
}

const checks = [];

function add(id, ok, requiredForProd, detail) {
  checks.push({ id, ok, requiredForProd, detail });
}

add(
  "migration_user_notifications",
  fileOk("supabase/migrations/20260828200000_user_notifications_push.sql"),
  true,
  "user_notifications + device_push_tokens migration dosyası",
);
add(
  "migration_broadcasts",
  fileOk("supabase/migrations/20260830120000_notification_broadcasts.sql"),
  true,
  "notification_broadcasts migration dosyası",
);
add(
  "apply_script",
  fileOk("scripts/production-apply-user-notifications.mjs"),
  true,
  "Güvenli production migration apply scripti",
);
add(
  "env_example_firebase",
  (() => {
    if (!fileOk(".env.example")) return false;
    const text = readFileSync(join(ROOT, ".env.example"), "utf8");
    return (
      text.includes("FIREBASE_PROJECT_ID=") &&
      text.includes("FIREBASE_CLIENT_EMAIL=") &&
      text.includes("FIREBASE_PRIVATE_KEY=") &&
      !text.includes("VITE_FIREBASE_")
    );
  })(),
  true,
  ".env.example Firebase alanları (VITE_ yok)",
);
add(
  "gitignore_env",
  gitignoreBlocks(".env") && gitignoreBlocks("!.env.example"),
  true,
  ".env commit engeli",
);
add(
  "gitignore_google_services",
  gitignoreBlocks("google-services.json"),
  true,
  "google-services.json commit engeli",
);
add(
  "gitignore_service_account",
  gitignoreBlocks("*-firebase-adminsdk-*.json") ||
    gitignoreBlocks("firebase-adminsdk") ||
    gitignoreBlocks("*service-account*.json"),
  true,
  "Firebase service account JSON commit engeli",
);
add(
  "android_google_services_example",
  fileOk("android-wrapper/google-services.json.example"),
  false,
  "Android google-services örnek şablon (secret içermez)",
);
add(
  "firebase_project_id",
  present("FIREBASE_PROJECT_ID"),
  false,
  "FIREBASE_PROJECT_ID (yoksa kod varsayılanı: silvan-cebimde)",
);
add(
  "firebase_client_email",
  present("FIREBASE_CLIENT_EMAIL"),
  true,
  "FIREBASE_CLIENT_EMAIL (FCM HTTP v1 service account)",
);
add(
  "firebase_private_key",
  present("FIREBASE_PRIVATE_KEY"),
  true,
  "FIREBASE_PRIVATE_KEY (FCM HTTP v1 service account)",
);
add(
  "android_google_services",
  fileOk("android-wrapper/app/google-services.json"),
  true,
  "android-wrapper/app/google-services.json (Firebase Console Android)",
);
add(
  "production_database_url",
  present("PRODUCTION_DATABASE_URL"),
  true,
  "PRODUCTION_DATABASE_URL (yalnızca guarded migration apply)",
);
add(
  "allow_production_migration",
  process.env.ALLOW_PRODUCTION_ORDER_MIGRATION === "YES",
  false,
  "ALLOW_PRODUCTION_ORDER_MIGRATION=YES (yalnızca apply anında)",
);

const missingRequired = checks.filter((c) => c.requiredForProd && !c.ok);
const report = {
  ok: missingRequired.length === 0,
  strict,
  missingRequired: missingRequired.map((c) => c.id),
  checks: checks.map(({ id, ok, requiredForProd, detail }) => ({
    id,
    ok,
    requiredForProd,
    detail,
  })),
  nextSteps: [
    "Lovable/Cloudflare production env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    "Firebase Console → Android app → google-services.json → android-wrapper/app/ (gitignore'da)",
    "PRODUCTION_DATABASE_URL + ALLOW_PRODUCTION_ORDER_MIGRATION=YES ile: npm run notification:prod-migrate",
    "iOS production APNs / aps-environment=production",
    "Kurucu panelinden gerçek cihaz E2E (bu script push testi yapmaz)",
  ],
};

console.log(JSON.stringify(report, null, 2));

if (strict && missingRequired.length > 0) {
  console.error(
    `STRICT FAIL: production için eksik zorunlu kontroller: ${missingRequired
      .map((c) => c.id)
      .join(", ")}`,
  );
  process.exit(1);
}

process.exit(0);
