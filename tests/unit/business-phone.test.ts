import { describe, expect, it } from "vitest";
import { isPhoneTaken } from "@/lib/business-phone";

describe("işletme telefonu tekilliği", () => {
  it("aynı numara farklı yazılsa da çakışır", () => {
    expect(isPhoneTaken("0532 111 22 33", ["+90 (532) 111-2233"])).toBe(true);
  });
  it("farklı numara kabul edilir", () => {
    expect(isPhoneTaken("0532 111 22 33", ["0532 111 22 34", null])).toBe(false);
  });
});
