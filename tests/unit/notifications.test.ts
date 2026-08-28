import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { __notificationsTest } from "@/lib/notifications.server";

const ROOT = join(import.meta.dirname, "../..");

describe("notifications infrastructure", () => {
  it("ships migration for user_notifications and device_push_tokens with RLS", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260828200000_user_notifications_push.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.user_notifications/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.device_push_tokens/);
    expect(sql).toMatch(/UNIQUE \(user_id, dedup_key\)/);
    expect(sql).toMatch(/user_notifications_self_select/);
    expect(sql).toMatch(/device_push_tokens_self_all/);
    expect(sql).toMatch(/supabase_realtime/);
  });

  it("keeps order placement isolated from notification failures", () => {
    const orders = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    expect(orders).toMatch(/finishPlacedOrder/);
    const vendorStatus = readFileSync(join(ROOT, "src/lib/vendor.functions.ts"), "utf8");
    expect(vendorStatus).toMatch(/afterOrderStatusUpdated/);
    expect(vendorStatus).toMatch(/return \{ ok: true \}/);
  });

  it("does not expose FCM secrets to the client bundle", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(example).toMatch(/FIREBASE_CLIENT_EMAIL=/);
    expect(example).toMatch(/FIREBASE_PRIVATE_KEY=/);
    expect(example).not.toMatch(/VITE_FIREBASE_/);
    const mobile = readFileSync(join(ROOT, "src/lib/vendor-mobile-notification.ts"), "utf8");
    expect(mobile).not.toMatch(/FIREBASE_PRIVATE_KEY/);
  });

  it("deduplicates notifications on unique violation", () => {
    expect(
      __notificationsTest.isUniqueViolation({ code: "23505", message: "duplicate key" }),
    ).toBe(true);
  });

  it("wires mobile notification bridge and founder panel", () => {
    expect(readFileSync(join(ROOT, "src/hooks/useVendorMobileOrderNotification.tsx"), "utf8")).toMatch(
      /showMobileNotification/,
    );
    expect(readFileSync(join(ROOT, "src/lib/vendor-mobile-notification.ts"), "utf8")).toMatch(
      /SilvanNative/,
    );
    expect(readFileSync(join(ROOT, "src/components/founder/NotificationsPanel.tsx"), "utf8")).toMatch(
      /founderSendNotification/,
    );
    expect(readFileSync(join(ROOT, "src/components/founder/NotificationsPanel.tsx"), "utf8")).toMatch(
      /all_vendors/,
    );
    expect(readFileSync(join(ROOT, "src/routes/bildirimler.tsx"), "utf8")).toMatch(/Bildirimler/);
    const tokenFns = readFileSync(join(ROOT, "src/lib/vendor-mobile-notification.functions.ts"), "utf8");
    expect(tokenFns).toMatch(/registerDevicePushToken/);
    expect(tokenFns).toMatch(/unregisterDevicePushToken/);
    const manifest = readFileSync(
      join(ROOT, "android-wrapper/app/src/main/AndroidManifest.xml"),
      "utf8",
    );
    expect(manifest).toMatch(/AppFirebaseMessagingService/);
    const activity = readFileSync(
      join(ROOT, "android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java"),
      "utf8",
    );
    expect(activity).toMatch(/getFcmToken/);
  });

  it("clears push token on sign-out without blocking auth", () => {
    const header = readFileSync(join(ROOT, "src/components/layout/Header.tsx"), "utf8");
    expect(header).toMatch(/unregisterMobilePushTokenOnSignOut/);
    const vendor = readFileSync(join(ROOT, "src/routes/vendor.dashboard.tsx"), "utf8");
    expect(vendor).toMatch(/unregisterMobilePushTokenOnSignOut/);
    const notificationsHook = readFileSync(join(ROOT, "src/hooks/useNotifications.tsx"), "utf8");
    expect(notificationsHook).not.toMatch(/refetchInterval/);
  });

  it("generates Android google-services.json from committed iOS Firebase plist", () => {
    const plist = readFileSync(join(ROOT, "ios/App/App/GoogleService-Info.plist"), "utf8");
    expect(plist).toMatch(/silvan-cebimde/);
    expect(plist).toMatch(/690305033747/);
    const syncScript = readFileSync(join(ROOT, "scripts/sync-android-firebase-config.mjs"), "utf8");
    expect(syncScript).toMatch(/GoogleService-Info.plist/);
    expect(syncScript).toMatch(/android-wrapper\/app\/google-services.json/);
  });

  it("supports founder broadcast targets", () => {
    const server = readFileSync(join(ROOT, "src/lib/notifications.server.ts"), "utf8");
    expect(server).toMatch(/all_vendors/);
    expect(server).toMatch(/all_customers/);
    const api = readFileSync(join(ROOT, "src/lib/notifications.functions.ts"), "utf8");
    expect(api).toMatch(/all_vendors/);
    expect(api).toMatch(/assertFounder/);
  });
});
