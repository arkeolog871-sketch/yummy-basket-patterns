import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toPublicErrorMessage } from "@/lib/public-error";

const ROOT = join(import.meta.dirname, "../..");

describe("notification production readiness wiring", () => {
  it("documents Firebase and production DB env names without VITE_ secrets", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(example).toMatch(/FIREBASE_PROJECT_ID=/);
    expect(example).toMatch(/FIREBASE_CLIENT_EMAIL=/);
    expect(example).toMatch(/FIREBASE_PRIVATE_KEY=/);
    expect(example).toMatch(/PRODUCTION_DATABASE_URL=/);
    expect(example).toMatch(/notifications\.server/);
    expect(example).not.toMatch(/VITE_FIREBASE_/);
  });

  it("keeps google-services and service-account JSON out of git", () => {
    const rootIgnore = readFileSync(join(ROOT, ".gitignore"), "utf8");
    const androidIgnore = readFileSync(join(ROOT, "android-wrapper/.gitignore"), "utf8");
    expect(rootIgnore).toMatch(/google-services\.json/);
    expect(rootIgnore).toMatch(/firebase-adminsdk/);
    expect(rootIgnore).toMatch(/service-account/);
    expect(androidIgnore).toMatch(/google-services\.json/);
  });

  it("does not leak Firebase env names to end users", () => {
    expect(toPublicErrorMessage("FIREBASE_CLIENT_EMAIL missing")).toMatch(/tamamlanamadı/);
    expect(toPublicErrorMessage("FIREBASE_PRIVATE_KEY invalid")).toMatch(/tamamlanamadı/);
    expect(toPublicErrorMessage("-----BEGIN PRIVATE KEY-----")).toMatch(/tamamlanamadı/);
    const panel = readFileSync(join(ROOT, "src/components/founder/NotificationsPanel.tsx"), "utf8");
    expect(panel).not.toMatch(/FIREBASE_CLIENT_EMAIL/);
    expect(panel).not.toMatch(/FIREBASE_PRIVATE_KEY/);
    expect(panel).toMatch(/Cihaz bildirimi gönderilemedi/);
  });

  it("runs preflight without secrets and fails strict mode when FCM env missing", () => {
    const script = join(ROOT, "scripts/notification-production-preflight.mjs");
    const soft = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_CLIENT_EMAIL: "",
        FIREBASE_PRIVATE_KEY: "",
        PRODUCTION_DATABASE_URL: "",
        ALLOW_PRODUCTION_ORDER_MIGRATION: "",
      },
    });
    expect(soft.status).toBe(0);
    const softJson = JSON.parse(soft.stdout);
    expect(softJson.ok).toBe(false);
    expect(softJson.missingRequired).toEqual(
      expect.arrayContaining([
        "firebase_client_email",
        "firebase_private_key",
        "android_google_services",
        "production_database_url",
      ]),
    );

    const hard = spawnSync(process.execPath, [script, "--strict"], {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_CLIENT_EMAIL: "",
        FIREBASE_PRIVATE_KEY: "",
        PRODUCTION_DATABASE_URL: "",
      },
    });
    expect(hard.status).toBe(1);
  });

  it("guards notification migration apply like other production SQL scripts", () => {
    const script = join(ROOT, "scripts/production-apply-user-notifications.mjs");
    const blocked = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: { ...process.env, ALLOW_PRODUCTION_ORDER_MIGRATION: "", PRODUCTION_DATABASE_URL: "" },
    });
    expect(blocked.status).toBe(3);
    expect(blocked.stderr).toMatch(/ALLOW_PRODUCTION_ORDER_MIGRATION/);

    const wrongUrl = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        ALLOW_PRODUCTION_ORDER_MIGRATION: "YES",
        PRODUCTION_DATABASE_URL: "postgresql://postgres:x@localhost:5432/silvan_rpc_test",
      },
    });
    expect(wrongUrl.status).toBe(2);
    expect(wrongUrl.stderr).toMatch(/production project ref/);
  });

  it("keeps Android google-services plugin optional so builds do not crash", () => {
    const gradle = readFileSync(join(ROOT, "android-wrapper/app/build.gradle.kts"), "utf8");
    expect(gradle).toMatch(/googleServicesFile\.exists\(\)/);
    expect(gradle).toMatch(/com\.google\.gms\.google-services/);
    const apk = readFileSync(join(ROOT, "android-wrapper/build-apk.sh"), "utf8");
    expect(apk).toMatch(/UYARI: android-wrapper\/app\/google-services\.json/);
  });
});
