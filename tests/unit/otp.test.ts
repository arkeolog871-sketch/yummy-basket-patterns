import { describe, expect, it } from "vitest";
import {
  OTP_CODE_LENGTH,
  formatOtpToken,
  isCompleteOtpCode,
  normalizeOtpCode,
  parseExactOtpCode,
} from "@/lib/otp";

describe("OTP input parsing", () => {
  it("normalizes spaces, letters, and extra digits for typing", () => {
    expect(normalizeOtpCode("12 34 56")).toBe("123456");
    expect(normalizeOtpCode("12ab34cd56")).toBe("123456");
    expect(normalizeOtpCode("  987654321 ")).toBe("987654");
  });

  it("rejects empty, 5-digit, and 7-digit codes at verification", () => {
    expect(parseExactOtpCode("")).toBeNull();
    expect(parseExactOtpCode("     ")).toBeNull();
    expect(parseExactOtpCode("12345")).toBeNull();
    expect(parseExactOtpCode("1234567")).toBeNull();
    expect(parseExactOtpCode(null)).toBeNull();
    expect(parseExactOtpCode(undefined)).toBeNull();
    expect(parseExactOtpCode({})).toBeNull();
  });

  it("accepts exactly 6 digits including leading zeros", () => {
    expect(parseExactOtpCode("012345")).toBe("012345");
    expect(parseExactOtpCode("  654321  ")).toBe("654321");
    expect(parseExactOtpCode("98-76-54")).toBe("987654");
  });

  it("rejects numeric JSON values that lost a leading zero", () => {
    expect(parseExactOtpCode(12345)).toBeNull();
    expect(parseExactOtpCode(123456)).toBe("123456");
  });

  it("rejects letter-containing codes at verification even if digits remain", () => {
    expect(parseExactOtpCode("12ab34cd56")).toBeNull();
    expect(parseExactOtpCode("abcdef")).toBeNull();
    expect(parseExactOtpCode("12345a")).toBeNull();
    expect(parseExactOtpCode("12 34 56")).toBe("123456");
  });

  it("treats complete codes as 6 digits only", () => {
    expect(isCompleteOtpCode("123456")).toBe(true);
    expect(isCompleteOtpCode("12345")).toBe(false);
    expect(isCompleteOtpCode("1234567")).toBe(false);
    expect(OTP_CODE_LENGTH).toBe(6);
  });

  it("formats email tokens without leaking non-digits", () => {
    expect(formatOtpToken("12 34 56")).toBe("123456");
    expect(formatOtpToken(null)).toBe("");
  });
});
