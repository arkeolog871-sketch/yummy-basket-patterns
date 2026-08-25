import { describe, expect, it } from "vitest";
import { registerSchema, sendOtpSchema, verifyOtpSchema } from "@/lib/otp-schemas";

describe("user registration validation", () => {
  const valid = {
    email: "yeni@example.com",
    password: "secret1",
    fullName: "Ali Veli",
    phone: "05321234567",
  };

  it("accepts a complete customer registration payload", () => {
    expect(registerSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid email", () => {
    expect(() => registerSchema.parse({ ...valid, email: "not-an-email" })).toThrow(/e-posta/i);
    expect(() => registerSchema.parse({ ...valid, email: "" })).toThrow();
  });

  it("rejects missing or short passwords", () => {
    expect(() => registerSchema.parse({ ...valid, password: "" })).toThrow(/en az 6/);
    expect(() => registerSchema.parse({ ...valid, password: "12345" })).toThrow(/en az 6/);
  });

  it("rejects empty name and short phone", () => {
    expect(() => registerSchema.parse({ ...valid, fullName: " " })).toThrow();
    expect(() => registerSchema.parse({ ...valid, phone: "123" })).toThrow(/10/);
  });

  it("rejects missing fields", () => {
    expect(() => registerSchema.parse({ email: valid.email })).toThrow();
  });
});

describe("OTP request/verify validation", () => {
  it("rejects invalid email on send", () => {
    expect(() => sendOtpSchema.parse({ email: "bad" })).toThrow(/e-posta/i);
  });

  it("defaults termsAccepted to false so API bypass without consent fails later", () => {
    const parsed = verifyOtpSchema.parse({ email: "a@b.co", code: "123456" });
    expect(parsed.termsAccepted).toBe(false);
  });
});
