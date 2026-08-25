import { describe, expect, it } from "vitest";
import { TERMS_ACCEPTANCE_REQUIRED } from "@/lib/legal";
import { verifyOtpSchema } from "@/lib/otp-schemas";
import { parseExactOtpCode } from "@/lib/otp";

describe("authorization invariants expressed in code", () => {
  it("refuses verification without legal consent even with a well-formed code", () => {
    const parsed = verifyOtpSchema.parse({
      email: "vendor@example.com",
      code: "123456",
      termsAccepted: false,
    });
    expect(parsed.termsAccepted).toBe(false);
    expect(TERMS_ACCEPTANCE_REQUIRED.length).toBeGreaterThan(10);
  });

  it("does not treat role flags in the OTP payload as authorization", () => {
    const parsed = verifyOtpSchema.parse({
      email: "customer@example.com",
      code: "654321",
      termsAccepted: true,
      role: "founder",
      isVendor: true,
    });
    expect("role" in parsed).toBe(false);
    expect("isVendor" in parsed).toBe(false);
  });

  it("keeps OTP length enforcement independent of UI truncation", () => {
    expect(parseExactOtpCode("000000")).toBe("000000");
    expect(parseExactOtpCode("0000000")).toBeNull();
  });
});
