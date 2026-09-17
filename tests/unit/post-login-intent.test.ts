import { describe, expect, it } from "vitest";
import { resolvePostLoginTarget, sanitizePostLoginPath } from "@/lib/post-login-intent";

describe("post-login intent", () => {
  it("başvuru ve ödeme yollarını kabul eder", () => {
    expect(sanitizePostLoginPath("/isletme-basvuru")).toBe("/isletme-basvuru");
    expect(sanitizePostLoginPath("/odeme")).toBe("/odeme");
  });

  it("sorgu ve fragment eklerini temizler", () => {
    expect(sanitizePostLoginPath("/isletme-basvuru?ref=apple#form")).toBe("/isletme-basvuru");
  });

  it("dış adresleri ve beyaz liste dışı yolları reddeder", () => {
    expect(sanitizePostLoginPath("https://evil.example/isletme-basvuru")).toBeNull();
    expect(sanitizePostLoginPath("//evil.example")).toBeNull();
    expect(sanitizePostLoginPath("/kurucu")).toBeNull();
    expect(sanitizePostLoginPath("")).toBeNull();
    expect(sanitizePostLoginPath(null)).toBeNull();
  });

  it("adayları sırayla dener", () => {
    expect(resolvePostLoginTarget([null, "/kurucu", "/isletme-basvuru"])).toBe("/isletme-basvuru");
    expect(resolvePostLoginTarget([undefined, "/kurucu"])).toBeNull();
  });
});
