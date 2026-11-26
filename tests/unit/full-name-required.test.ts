import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { registerSchema } from "@/lib/otp-schemas";
import { fullNameSchema } from "@/lib/profile.functions";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("ad soyad zorunluluğu", () => {
  it("şifreli kayıtta ad soyad zaten zorunlu", () => {
    expect(() =>
      registerSchema.parse({
        email: "test@example.com",
        password: "secret1",
        fullName: " ",
        phone: "",
      }),
    ).toThrow();
  });

  it("fullNameSchema boş veya tek harfli adı reddeder", () => {
    expect(() => fullNameSchema.parse({ full_name: "" })).toThrow();
    expect(() => fullNameSchema.parse({ full_name: " " })).toThrow();
    expect(() => fullNameSchema.parse({ full_name: "A" })).toThrow();
  });

  it("fullNameSchema geçerli adı kabul eder ve kırpar", () => {
    expect(fullNameSchema.parse({ full_name: "  Ali Veli  " })).toEqual({
      full_name: "Ali Veli",
    });
  });

  it("auth sayfası: e-posta doğrulandıktan sonra, yalnızca müşteri hesaplarında, ad soyad eksikse zorunlu adım gösteriliyor", () => {
    const authPage = read("src/routes/auth.tsx");
    expect(authPage).toContain("const [needsFullName, setNeedsFullName] = useState(false);");
    expect(authPage).toContain(
      "const isCustomerAccount = !access.isVendor && !access.isFounder && !access.isPageManager;",
    );
    expect(authPage).toContain("setNeedsFullName(true);");
    // Vendor/kurucu akışını bu adımdan muaf tutar.
    expect(authPage).toMatch(/if \(isCustomerAccount\) \{[\s\S]*setNeedsFullName\(true\)/);
  });

  it("completeFullName yalnızca full_name yazar, telefonu etkilemez", () => {
    const profileFns = read("src/lib/profile.functions.ts");
    expect(profileFns).toContain("export const completeFullName");
    expect(profileFns).toMatch(
      /completeFullName[\s\S]*upsert\(\{ id: context\.userId, full_name: data\.full_name \}/,
    );
  });

  /**
   * YAŞANDI: ad soyad zorunluluğu yalnızca /auth sayfasının kendi akışına
   * eklenmişti. İşletme başvuru sayfasının (isletme-basvuru.tsx) ayrı,
   * bağımsız Google/Apple giriş düğmeleri hiç /auth'a uğramadığı için,
   * oradan (Apple genelde isim paylaşmaz) giriş yapıp başvuruyu yarıda
   * bırakanlar adı hiç girmeden hesap açabiliyordu.
   */
  it("işletme başvuru sayfası da paylaşılan FullNameGate ile sarmalı", () => {
    const page = read("src/routes/isletme-basvuru.tsx");
    expect(page).toContain('import { FullNameGate } from "@/components/auth/FullNameGate";');
    expect(page).toMatch(/<FullNameGate>\s*<BusinessApplicationPage \/>\s*<\/FullNameGate>/);
  });

  it("FullNameGate de yalnızca müşteri hesaplarını kapsıyor, vendor/kurucuyu değil", () => {
    const gate = read("src/components/auth/FullNameGate.tsx");
    expect(gate).toContain(
      "const isCustomerAccount = !access.isVendor && !access.isFounder && !access.isPageManager;",
    );
    expect(gate).toContain("completeFullName");
  });
});
