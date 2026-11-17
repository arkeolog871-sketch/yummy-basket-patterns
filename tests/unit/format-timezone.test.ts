import { describe, it, expect } from "vitest";
import { formatDateTime } from "@/lib/format";
describe("formatDateTime", () => {
  it("Türkiye saatiyle yazar (sunucu UTC olsa da)", () => {
    expect(formatDateTime("2026-11-17T14:12:00Z")).toContain("17:12");
  });
});
