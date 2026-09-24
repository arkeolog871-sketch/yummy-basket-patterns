import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canSubmitWithTerms, termsReacceptanceRequired } from "@/lib/legal-consent";
import { LEGAL_VERSIONS, fillLegalText, LEGAL_MISSING_LABEL } from "@/lib/legal";

const read = (p: string) => readFileSync(p, "utf8");

describe("Kullanım Koşulları kabulü", () => {
  it("işaretsiz gönderilemez, işaretliyken gönderilir, kaldırınca yine engellenir", () => {
    expect(canSubmitWithTerms(false)).toBe(false);
    expect(canSubmitWithTerms(true)).toBe(true);
    expect(canSubmitWithTerms(false)).toBe(false);
  });
  it("eski sürüm kabulünde yeniden ister, aynı sürümde istemez", () => {
    expect(termsReacceptanceRequired(2, LEGAL_VERSIONS.terms)).toBe(true);
    expect(termsReacceptanceRequired(LEGAL_VERSIONS.terms, LEGAL_VERSIONS.terms)).toBe(false);
    expect(termsReacceptanceRequired(null, LEGAL_VERSIONS.terms)).toBe(true);
  });
  it("sunucu kabul bayrağı olmadan reddeder", () => {
    const src = read("src/lib/legal.functions.ts");
    expect(src).toMatch(/if \(!data\.accepted\) throw new Error\(TERMS_ACCEPTANCE_REQUIRED\)/);
    expect(read("src/lib/otp.functions.ts")).toMatch(/data\.termsAccepted !== true/);
  });
  it("kabul kaydı yazılamazsa başarı dönmez", () => {
    const src = read("src/lib/otp.server.ts");
    expect(src).toMatch(/if \(termsError\)[\s\S]{0,200}ok: false/);
  });
  it("kutu tek kaynaktan kontrol edilir; bağlantı kutuyu değiştirmez", () => {
    const src = read("src/components/legal/LegalConsentCheckbox.tsx");
    expect(src).toMatch(/checked=\{checked\}/);
    expect(src).toMatch(/event\.stopPropagation\(\);\s*onOpen/);
    expect(src).not.toMatch(/<label\s+[a-zA-Z]/);
  });
});

describe("KVKK aydınlatma ve eksik kimlik", () => {
  it("KVKK için kabul kutusu yok", () => {
    const src = read("src/components/legal/LegalConsentCheckbox.tsx");
    expect(src).toMatch(/onayınızı gerektirmez/);
    expect(read("src/components/legal/LegalDocument.tsx")).not.toMatch(/type="checkbox"/);
  });
  it("eksik alan uydurulmaz, açık etiketle gösterilir", () => {
    const out = fillLegalText("{{PLATFORM_MERSIS}}", {} as never);
    expect(out).toContain(LEGAL_MISSING_LABEL);
  });
  it("yayın eksik zorunlu kimlikte engellenir", () => {
    expect(read("src/lib/compliance.functions.ts")).toMatch(
      /Yayın yapılamaz: eksik platform kimliği/,
    );
  });
  it("eksik kimlik sipariş düğmesini kilitlemez", () => {
    const line = read("src/routes/odeme.tsx").match(/disabled=\{!selectedId[^}]*\}/)?.[0] ?? "";
    expect(line).not.toMatch(/missing|identity/i);
  });
});
