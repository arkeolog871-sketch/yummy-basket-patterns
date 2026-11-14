import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_COLUMNS, parseBusinessColumns } from "../../src/lib/business-grid";

describe("business column preference", () => {
  it("defaults to two columns", () => {
    expect(DEFAULT_BUSINESS_COLUMNS).toBe(2);
    expect(parseBusinessColumns(null)).toBe(2);
  });
  it("allows one, two or three columns", () => {
    expect(parseBusinessColumns("1")).toBe(1);
    expect(parseBusinessColumns("2")).toBe(2);
    expect(parseBusinessColumns("3")).toBe(3);
  });
  it("ignores invalid saved preferences", () => {
    expect(parseBusinessColumns("4")).toBe(2);
    expect(parseBusinessColumns("garbage")).toBe(2);
  });
});
