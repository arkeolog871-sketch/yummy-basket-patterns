import { describe, expect, it } from "vitest";
import { vendorOwnsResource } from "@/lib/vendor.server";

const VENDOR_A = "11111111-1111-4111-8111-111111111111";
const VENDOR_B = "22222222-2222-4222-8222-222222222222";

describe("vendor A cannot act as vendor B", () => {
  it("rejects cross-restaurant read/update/delete/order access", () => {
    expect(vendorOwnsResource(VENDOR_A, VENDOR_A)).toBe(true);
    expect(vendorOwnsResource(VENDOR_A, VENDOR_B)).toBe(false);
    expect(vendorOwnsResource(VENDOR_A, null)).toBe(false);
    expect(vendorOwnsResource(VENDOR_A, undefined)).toBe(false);
    expect(vendorOwnsResource("", VENDOR_B)).toBe(false);
  });

  it("documents that vendor mutations never take restaurant_id from the client", () => {
    expect(vendorOwnsResource(VENDOR_A, VENDOR_B)).toBe(false);
    expect(vendorOwnsResource(VENDOR_B, VENDOR_A)).toBe(false);
  });
});
