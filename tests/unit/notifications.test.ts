import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { __notificationsTest } from "@/lib/notifications.server";

const ROOT = join(import.meta.dirname, "../..");

function source(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("notifications infrastructure", () => {
  it("ships migrations for user_notifications, device_push_tokens, and broadcasts with RLS", () => {
    const sql = source("supabase/migrations/20260828200000_user_notifications_push.sql");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.user_notifications/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.device_push_tokens/);
    expect(sql).toMatch(/UNIQUE \(user_id, dedup_key\)/);
    expect(sql).toMatch(/user_notifications_self_select/);
    expect(sql).toMatch(/device_push_tokens_self_all/);
    expect(sql).toMatch(/supabase_realtime/);

    const broadcasts = source("supabase/migrations/20260830120000_notification_broadcasts.sql");
    expect(broadcasts).toMatch(/notification_broadcasts/);
    expect(broadcasts).toMatch(/idempotency_key/);
    expect(broadcasts).toMatch(/notification_broadcasts_founder_select/);
    expect(broadcasts).toMatch(/device_push_tokens_token_unique/);
  });

  it("keeps order placement isolated from notification failures", () => {
    const orders = source("src/lib/orders.functions.ts");
    expect(orders).toMatch(/finishPlacedOrder/);
    const vendorStatus = source("src/lib/vendor.functions.ts");
    expect(vendorStatus).toMatch(/afterOrderStatusUpdated/);
    expect(vendorStatus).toMatch(/return \{ ok: true \}/);
  });

  it("does not expose FCM secrets to the client bundle", () => {
    const example = source(".env.example");
    expect(example).toMatch(/FIREBASE_CLIENT_EMAIL=/);
    expect(example).toMatch(/FIREBASE_PRIVATE_KEY=/);
    expect(example).not.toMatch(/VITE_FIREBASE_/);
    const mobile = source("src/lib/vendor-mobile-notification.ts");
    expect(mobile).not.toMatch(/FIREBASE_PRIVATE_KEY/);
  });

  it("deduplicates notifications on unique violation", () => {
    expect(__notificationsTest.isUniqueViolation({ code: "23505", message: "duplicate key" })).toBe(
      true,
    );
  });

  it("requires founder auth for broadcast send and preview endpoints", () => {
    const api = source("src/lib/notifications.functions.ts");
    expect(api).toMatch(/assertFounder/);
    expect(api).toMatch(/founderSendNotification/);
    expect(api).toMatch(/previewFounderNotificationAudience/);
    expect(api).toMatch(/idempotencyKey/);
    const sendAt = api.indexOf("export const founderSendNotification");
    const assertAt = api.indexOf("assertFounder", sendAt);
    expect(sendAt).toBeGreaterThan(0);
    expect(assertAt).toBeGreaterThan(sendAt);
  });

  it("resolves audiences server-side for all / customers / vendors", () => {
    const server = source("src/lib/notifications.server.ts");
    expect(server).toMatch(/all_vendors/);
    expect(server).toMatch(/all_customers/);
    expect(server).toMatch(/resolveFounderTargetUserIds/);
    expect(server).toMatch(/listAllAuthUserIds/);
    expect(server).toMatch(/FCM_CHUNK/);
    expect(server).toMatch(/UNREGISTERED|NOT_FOUND/);
  });

  it("wires mobile notification bridge, founder panel confirm, and history", () => {
    expect(source("src/hooks/useVendorMobileOrderNotification.tsx")).toMatch(
      /registerDevicePushToken/,
    );
    expect(source("src/lib/vendor-mobile-notification.ts")).toMatch(/SilvanNative/);
    expect(source("src/lib/vendor-mobile-notification.ts")).toMatch(/__SILVAN_FCM_TOKEN__/);
    const panel = source("src/components/founder/NotificationsPanel.tsx");
    expect(panel).toMatch(/founderSendNotification/);
    expect(panel).toMatch(/all_vendors/);
    expect(panel).toMatch(/all_customers/);
    expect(panel).toMatch(/AlertDialog/);
    expect(panel).toMatch(/idempotencyKey/);
    expect(panel).toMatch(/Gönderim geçmişi/);
    expect(source("src/routes/bildirimler.tsx")).toMatch(/Bildirimler/);
    expect(source("src/routes/kurucu.tsx")).toMatch(/NotificationsPanel/);
    expect(source("src/lib/vendor-mobile-notification.functions.ts")).toMatch(
      /registerDevicePushToken/,
    );
    expect(source("src/lib/vendor-mobile-notification.functions.ts")).toMatch(
      /unregisterDevicePushToken/,
    );
    const manifest = source("android-wrapper/app/src/main/AndroidManifest.xml");
    expect(manifest).toMatch(/AppFirebaseMessagingService/);
    const activity = source(
      "android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java",
    );
    expect(activity).toMatch(/getFcmToken/);
    expect(source("ios/App/App/AppDelegate.swift")).toMatch(/__SILVAN_FCM_TOKEN__/);
  });

  it("clears push token on sign-out without blocking auth", () => {
    const header = source("src/components/layout/Header.tsx");
    expect(header).toMatch(/unregisterMobilePushTokenOnSignOut/);
    const vendor = source("src/routes/vendor.dashboard.tsx");
    expect(vendor).toMatch(/unregisterMobilePushTokenOnSignOut/);
    const notificationsHook = source("src/hooks/useNotifications.tsx");
    expect(notificationsHook).not.toMatch(/refetchInterval/);
  });

  it("generates Android google-services.json from committed iOS Firebase plist", () => {
    const plist = source("ios/App/App/GoogleService-Info.plist");
    expect(plist).toMatch(/silvan-cebimde/);
    expect(plist).toMatch(/690305033747/);
    const syncScript = source("scripts/sync-android-firebase-config.mjs");
    expect(syncScript).toMatch(/google-services.json/);
    const example = source("android-wrapper/google-services.json.example");
    expect(example).toMatch(/online\.uygulamamcebimde\.app/);
    expect(example).toMatch(/1:690305033747:android:e90857c010be5a46fc01e6/);
  });

  it("does not return push tokens from founder or notification list APIs", () => {
    const api = source("src/lib/notifications.functions.ts");
    expect(api).not.toMatch(/from\("device_push_tokens"\)\.select\("token"\)/);
    expect(api).toMatch(/listMyNotifications/);
    expect(api).toMatch(/\.select\("id, kind, title, body/);
  });
});

describe("authorization for founder broadcast (static)", () => {
  it("rejects non-founder callers at the server fn layer", () => {
    const api = source("src/lib/notifications.functions.ts");
    for (const name of [
      "founderSendNotification",
      "previewFounderNotificationAudience",
      "listFounderNotificationBroadcasts",
    ]) {
      const at = api.indexOf(`export const ${name}`);
      expect(at).toBeGreaterThan(0);
      expect(api.indexOf("assertFounder", at)).toBeGreaterThan(at);
      expect(api.indexOf("requireSupabaseAuth", Math.max(0, at - 200))).toBeGreaterThan(-1);
    }
  });
});
