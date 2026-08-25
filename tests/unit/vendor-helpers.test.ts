import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePhone, maskEmail, isEmailIdentifier, GENERIC_VENDOR_MASKED_EMAIL } from "@/lib/vendor-auth.server";
import { isBusinessOpen } from "@/lib/hours";

const ROOT = join(import.meta.dirname, "../..");

describe("vendor identifier helpers", () => {
  it("normalizes TR phone numbers to last 10 digits", () => {
    expect(normalizePhone("0532 123 45 67")).toBe("5321234567");
    expect(normalizePhone("+90 532 123 45 67")).toBe("5321234567");
  });

  it("masks emails for internal logs, not public vendor-login success bodies", () => {
    expect(maskEmail("esnaf@gmail.com")).toMatch(/^es.+@gmail\.com$/);
    expect(maskEmail("esnaf@gmail.com")).not.toBe("esnaf@gmail.com");
    expect(GENERIC_VENDOR_MASKED_EMAIL).toBe("kayıtlı e-posta");
  });

  it("detects email vs phone identifiers", () => {
    expect(isEmailIdentifier("a@b.co")).toBe(true);
    expect(isEmailIdentifier("05321234567")).toBe(false);
  });

  it("returns the same success mask for known and unknown vendor identifiers", () => {
    const source = readFileSync(join(ROOT, "src/lib/vendor-auth.functions.ts"), "utf8");
    expect(source).toMatch(/maskedEmail: GENERIC_VENDOR_MASKED_EMAIL/);
    expect(source).not.toMatch(/maskedEmail: maskEmail\(/);
    expect(source).toMatch(/parseExactOtpCode/);
    expect(source).toMatch(/consumeIssuedOtp/);
  });
});

describe("business hours", () => {
  it("honors manual close regardless of clock", () => {
    expect(isBusinessOpen({ opens_at: "00:00", closes_at: "23:59", is_open_manual: false })).toBe(false);
  });
});
