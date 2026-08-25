import { describe, expect, it } from "vitest";
import { sendSixDigitOtpEmail } from "@/lib/otp-mail.server";
import { EMAIL_SEND_FAILED_MESSAGE } from "@/lib/otp";

describe("OTP mail delivery", () => {
  it("fails closed when LOVABLE_API_KEY is missing", async () => {
    const previous = process.env["LOVABLE_API_KEY"];
    delete process.env["LOVABLE_API_KEY"];
    const result = await sendSixDigitOtpEmail({
      to: "nobody@example.com",
      code: "123456",
      purpose: "signup",
    });
    if (previous) process.env["LOVABLE_API_KEY"] = previous;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(EMAIL_SEND_FAILED_MESSAGE);
  });
});
