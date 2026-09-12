import { describe, expect, it } from "vitest";
import { readableOnWarm } from "@/lib/warm-contrast";

const DARK = "oklch(0.331 0.038 52)";
const LIGHT = "oklch(0.98 0.01 78)";

describe("bg-warm üzerindeki yazı rengi", () => {
  it("varsayılan krem tonunda bugünkü koyu yazıyı korur", () => {
    expect(readableOnWarm("#f3dfc0")).toBe(DARK);
  });

  it("doygun/koyu marka renklerinde açık yazıya geçer", () => {
    // Kurucu panelinden kırmızı seçilince rozetler koyu kahve yazıyla
    // okunmaz hâle geliyordu; bu testin amacı o gerilemeyi yakalamak.
    expect(readableOnWarm("#c62828")).toBe(LIGHT);
    expect(readableOnWarm("#1b1b1b")).toBe(LIGHT);
    expect(readableOnWarm("#e63946")).toBe(LIGHT);
  });

  it("kısa hex ve # olmadan yazımı kabul eder", () => {
    expect(readableOnWarm("#fff")).toBe(DARK);
    expect(readableOnWarm("f3dfc0")).toBe(DARK);
  });

  it("geçersiz değerde varsayılan koyu yazıya döner", () => {
    expect(readableOnWarm("")).toBe(DARK);
    expect(readableOnWarm("mavi")).toBe(DARK);
  });
});
