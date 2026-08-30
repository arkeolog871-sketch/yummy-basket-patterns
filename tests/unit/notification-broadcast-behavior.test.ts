import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterAudienceUserIds, __notificationsTest } from "@/lib/notifications.server";

const ROOT = join(import.meta.dirname, "../..");

describe("founder broadcast audience targeting (server-side)", () => {
  const all = ["customer-1", "customer-2", "vendor-1", "vendor-2", "founder-1"];
  const vendors = ["vendor-1", "vendor-2"];

  it("Herkes → kullanıcı + işletme", () => {
    const ids = filterAudienceUserIds({
      target: "all",
      allUserIds: all,
      vendorUserIds: vendors,
    });
    expect(ids.sort()).toEqual([...all].sort());
    expect(ids).toEqual(expect.arrayContaining(["customer-1", "vendor-1"]));
  });

  it("Sadece Kullanıcılar → yalnız normal kullanıcı", () => {
    const ids = filterAudienceUserIds({
      target: "all_customers",
      allUserIds: all,
      vendorUserIds: vendors,
    });
    expect(ids.sort()).toEqual(["customer-1", "customer-2", "founder-1"].sort());
    expect(ids).not.toContain("vendor-1");
    expect(ids).not.toContain("vendor-2");
  });

  it("Sadece İşletmeler → yalnız vendor_assignments", () => {
    const ids = filterAudienceUserIds({
      target: "all_vendors",
      allUserIds: all,
      vendorUserIds: vendors,
    });
    expect(ids.sort()).toEqual(["vendor-1", "vendor-2"]);
    expect(ids).not.toContain("customer-1");
  });

  it("deduplicates ids and ignores empty strings", () => {
    expect(
      filterAudienceUserIds({
        target: "all_vendors",
        allUserIds: [],
        vendorUserIds: ["v1", "v1", "", "v2"],
      }),
    ).toEqual(["v1", "v2"]);
  });
});

describe("founder broadcast authorization (static)", () => {
  it("requires auth + assertFounder on send/preview/history", () => {
    const api = readFileSync(join(ROOT, "src/lib/notifications.functions.ts"), "utf8");
    for (const name of [
      "founderSendNotification",
      "previewFounderNotificationAudience",
      "listFounderNotificationBroadcasts",
    ]) {
      const at = api.indexOf(`export const ${name}`);
      expect(at).toBeGreaterThan(0);
      expect(api.indexOf("requireSupabaseAuth", Math.max(0, at - 120))).toBeGreaterThan(-1);
      expect(api.indexOf("assertFounder", at)).toBeGreaterThan(at);
    }
  });

  it("does not expose broadcast send to vendor or customer helpers", () => {
    const vendor = readFileSync(join(ROOT, "src/lib/vendor.functions.ts"), "utf8");
    expect(vendor).not.toMatch(/founderSendNotification/);
    expect(vendor).not.toMatch(/notification_broadcasts/);
  });
});

describe("idempotency and stale token resilience", () => {
  it("requires UUID idempotencyKey on send API", () => {
    const api = readFileSync(join(ROOT, "src/lib/notifications.functions.ts"), "utf8");
    expect(api).toMatch(/idempotencyKey:\s*z\.string\(\)\.uuid\(\)/);
    const server = readFileSync(join(ROOT, "src/lib/notifications.server.ts"), "utf8");
    expect(server).toMatch(/idempotency_key/);
    expect(server).toMatch(/duplicate:\s*true/);
  });

  it("treats UNREGISTERED/NOT_FOUND as stale without failing the whole batch", () => {
    expect(__notificationsTest.isStaleFcmErrorText("UNREGISTERED")).toBe(true);
    expect(__notificationsTest.isStaleFcmErrorText("Requested entity was not found")).toBe(true);
    expect(__notificationsTest.isStaleFcmErrorText("quota exceeded")).toBe(false);
    const server = readFileSync(join(ROOT, "src/lib/notifications.server.ts"), "utf8");
    expect(server).toMatch(/delete\(\)\.eq\("token", deviceToken\)/);
    expect(server).toMatch(/FCM_CHUNK/);
    expect(server).toMatch(/successCount/);
    expect(server).toMatch(/failureCount/);
  });

  it("registers tokens per user and unique token index prevents cross-user duplicates", () => {
    const fns = readFileSync(join(ROOT, "src/lib/vendor-mobile-notification.functions.ts"), "utf8");
    expect(fns).toMatch(/registerDevicePushToken/);
    expect(fns).toMatch(/\.eq\("token", data\.token\)/);
    expect(fns).toMatch(/user_id:\s*context\.userId/);
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260830120000_notification_broadcasts.sql"),
      "utf8",
    );
    expect(sql).toMatch(/device_push_tokens_token_unique/);
  });
});
