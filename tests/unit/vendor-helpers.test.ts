import { describe, expect, it } from "vitest";
import { normalizePhone, maskEmail, isEmailIdentifier } from "@/lib/vendor-auth.server";
import { isBusinessOpen } from "@/lib/hours";

describe("vendor identifier helpers", () => {
  it("normalizes TR phone numbers to last 10 digits", () => {
    expect(normalizePhone("0532 123 45 67")).toBe("5321234567");
    expect(normalizePhone("+90 532 123 45 67")).toBe("5321234567");
  });

  it("masks emails for vendor login responses", () => {
    expect(maskEmail("esnaf@gmail.com")).toMatch(/^es.+@gmail\.com$/);
    expect(maskEmail("esnaf@gmail.com")).not.toBe("esnaf@gmail.com");
  });

  it("detects email vs phone identifiers", () => {
    expect(isEmailIdentifier("a@b.co")).toBe(true);
    expect(isEmailIdentifier("05321234567")).toBe(false);
  });
});

describe("business hours", () => {
  it("honors manual close regardless of clock", () => {
    expect(isBusinessOpen({ opens_at: "00:00", closes_at: "23:59", is_open_manual: false })).toBe(false);
  });
});
