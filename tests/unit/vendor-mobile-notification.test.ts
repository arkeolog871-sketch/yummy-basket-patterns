import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  __vendorMobileNotificationTest,
  claimVendorMobileNotification,
  formatVendorMobileNotification,
  formatVendorOrderNumber,
  isOrderId,
  vendorOrderDetailUrl,
} from "@/lib/vendor-mobile-notification";

const ROOT = join(import.meta.dirname, "../..");
const ORDER_ID = "b5025e61-773a-451f-816f-071583a3e954";

describe("vendor mobile order notification", () => {
  afterEach(() => {
    __vendorMobileNotificationTest.seenOrderKeys.clear();
    try {
      sessionStorage.removeItem(__vendorMobileNotificationTest.SEEN_STORAGE_KEY);
    } catch {
      // Node.
    }
  });

  it("formats Yeni Sipariş with number, total, and item quantities", () => {
    const notice = formatVendorMobileNotification({
      orderId: ORDER_ID,
      total: 2000,
      items: [
        { name: "6 aylık hindi", quantity: 2 },
        { name: "Ayran", quantity: 1 },
      ],
    });
    expect(notice.title).toBe("Yeni Sipariş");
    expect(notice.body).toContain(`#${formatVendorOrderNumber(ORDER_ID)}`);
    expect(notice.body).toContain("2× 6 aylık hindi");
    expect(notice.body).toContain("1× Ayran");
    expect(notice.body).toMatch(/2[\.,]000/);
    expect(notice.url).toBe(
      `https://uygulamamcebimde.online/vendor/dashboard?order=${ORDER_ID}`,
    );
  });

  it("dedupes the same order for the same user", () => {
    expect(claimVendorMobileNotification("user-a", ORDER_ID)).toBe(true);
    expect(claimVendorMobileNotification("user-a", ORDER_ID)).toBe(false);
    expect(claimVendorMobileNotification("user-b", ORDER_ID)).toBe(true);
  });

  it("rejects non-uuid order ids", () => {
    expect(isOrderId("not-an-id")).toBe(false);
    expect(claimVendorMobileNotification("user-a", "not-an-id")).toBe(false);
    expect(vendorOrderDetailUrl(ORDER_ID, "https://uygulamamcebimde.online/")).toContain(
      "/vendor/dashboard?order=",
    );
  });

  it("does not change createOrder, finishPlacedOrder, or the dashboard realtime channel", () => {
    const createOrder = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    const alerts = readFileSync(join(ROOT, "src/lib/order-vendor-alert.server.ts"), "utf8");
    const dashboard = readFileSync(join(ROOT, "src/routes/vendor.dashboard.tsx"), "utf8");
    const hook = readFileSync(
      join(ROOT, "src/hooks/useVendorMobileOrderNotification.tsx"),
      "utf8",
    );
    expect(createOrder).not.toMatch(/vendor-mobile-notification/);
    expect(alerts).not.toMatch(/vendor-mobile-notification/);
    expect(dashboard).toMatch(/channel\(`vendor-new-order:\$\{restaurantId\}`\)/);
    expect(dashboard).toMatch(/table: "order_vendor_alerts"/);
    expect(dashboard).toMatch(/table: "orders"/);
    expect(hook).toMatch(/vendor-mobile-push/);
    expect(hook).toMatch(/getVendorMobileOrderAlert/);
    expect(hook).toMatch(/assertVendor|restaurant_id=eq/);
  });

  it("loads order payload only after assertVendor on the server", () => {
    const text = readFileSync(
      join(ROOT, "src/lib/vendor-mobile-notification.functions.ts"),
      "utf8",
    );
    expect(text).toMatch(/assertVendor/);
    expect(text).toMatch(/\.eq\("id", data\.orderId\)/);
    expect(text).toMatch(/\.eq\("restaurant_id", restaurantId\)/);
    expect(text).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(text).not.toMatch(/client\.server/);
  });

  it("opens the existing vendor order card from the notification URL", () => {
    const dashboard = readFileSync(join(ROOT, "src/routes/vendor.dashboard.tsx"), "utf8");
    expect(dashboard).toMatch(/id=\{`vendor-order-\$\{order\.id\}`\}/);
    expect(dashboard).toMatch(/scrollIntoView/);
    expect(dashboard).toMatch(/validateSearch/);
  });
});
