import { describe, expect, it } from "vitest";
import { trustedClientAddress } from "@/lib/trusted-ip";

describe("rate-limit client identity", () => {
  it("prefers Cloudflare connecting IP", () => {
    expect(
      trustedClientAddress((name) => (name === "cf-connecting-ip" ? "203.0.113.9" : "1.2.3.4")),
    ).toBe("203.0.113.9");
  });

  it("ignores spoofable forwarded headers so OTP send/verify IP limits cannot be rotated", () => {
    expect(
      trustedClientAddress((name) => {
        if (name === "x-forwarded-for") return "198.51.100.1, 10.0.0.1";
        if (name === "x-real-ip") return "198.51.100.2";
        return null;
      }),
    ).toBe("unknown");
  });
});
