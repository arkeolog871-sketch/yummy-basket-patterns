import { describe, expect, it } from "vitest";
import { cleanProductDescription, PRODUCT_DESCRIPTION_MAX_CHARS } from "@/lib/product-description";

describe("ürün açıklaması", () => {
  it("200 karakteri aşmaz", () => {
    const out = cleanProductDescription("Lezzetli kebap ".repeat(40));
    expect(out.length).toBeLessThanOrEqual(PRODUCT_DESCRIPTION_MAX_CHARS + 1);
  });
  it("tırnakları temizler", () => {
    expect(cleanProductDescription('"Taze ve sıcak."')).toBe("Taze ve sıcak.");
  });
});
