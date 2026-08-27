import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { __vendorFcmTest } from "@/lib/vendor-fcm.server";

const ROOT = join(import.meta.dirname, "../..");

describe("vendor FCM push isolation", () => {
  it("does not change createOrder, placeOrder, or finishPlacedOrder", () => {
    const createOrder = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    const alerts = readFileSync(join(ROOT, "src/lib/order-vendor-alert.server.ts"), "utf8");
    const dashboard = readFileSync(join(ROOT, "src/routes/vendor.dashboard.tsx"), "utf8");
    expect(createOrder).not.toMatch(/vendor-fcm|FIREBASE_SERVICE_ACCOUNT|registerVendorPushToken/);
    expect(createOrder).toMatch(/export const createOrder/);
    expect(createOrder).toMatch(/async function placeOrder\(/);
    expect(alerts).toMatch(/export async function finishPlacedOrder/);
    expect(alerts).toMatch(/continueAfterResponse\(\s*notify\(placed\.id\)/);
    expect(alerts).not.toMatch(/await notify\(/);
    expect(dashboard).toMatch(/channel\(`vendor-new-order:\$\{restaurantId\}`\)/);
  });

  it("sends FCM only from the isolated notify wrapper after in-app/email", () => {
    const alerts = readFileSync(join(ROOT, "src/lib/order-vendor-alert.server.ts"), "utf8");
    const notifyAt = alerts.indexOf("export async function notifyVendorOfNewOrder");
    const fcmAt = alerts.indexOf("notifyVendorFcmPush");
    const unsafeAt = alerts.indexOf("async function notifyVendorOfNewOrderUnsafe");
    expect(notifyAt).toBeGreaterThan(0);
    expect(fcmAt).toBeGreaterThan(notifyAt);
    expect(unsafeAt).toBeGreaterThan(fcmAt);
  });

  it("registers tokens only after assertVendor and never takes restaurant_id from the client", () => {
    const text = readFileSync(join(ROOT, "src/lib/vendor-fcm.functions.ts"), "utf8");
    expect(text).toMatch(/registerVendorPushToken/);
    expect(text).toMatch(/assertVendor/);
    expect(text).toMatch(/vendor_push_tokens/);
    expect(text).not.toMatch(/restaurant_id: data/);
    expect(text).not.toMatch(/VITE_.*SERVICE/);
  });

  it("does not invent a Firebase project and no-ops without server credentials", () => {
    expect(__vendorFcmTest.readServiceAccount()).toBeNull();
    expect(__vendorFcmTest.isGoneToken(404, "")).toBe(true);
    expect(__vendorFcmTest.isGoneToken(403, "UNREGISTERED")).toBe(true);
    expect(__vendorFcmTest.isGoneToken(500, "backend")).toBe(false);
    const example = readFileSync(
      join(ROOT, "android-wrapper/app/google-services.json.example"),
      "utf8",
    );
    expect(example).toMatch(/YOUR_FIREBASE_PROJECT_ID/);
    expect(example).toMatch(/online\.uygulamamcebimde\.app/);
    expect(example).not.toMatch(/AIza/);
  });

  it("keeps FCM secrets off the client and APK google-services example", () => {
    const client = readFileSync(join(ROOT, "src/lib/vendor-mobile-notification.ts"), "utf8");
    const hook = readFileSync(join(ROOT, "src/hooks/useVendorMobileOrderNotification.tsx"), "utf8");
    expect(client).not.toMatch(/FIREBASE_SERVICE_ACCOUNT|private_key/);
    expect(hook).toMatch(/registerVendorPushToken/);
    expect(hook).toMatch(/silvan-fcm-token/);
  });
});
