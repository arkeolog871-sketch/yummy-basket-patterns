import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Google/Apple ile açılmış hesapta şifre yoktur. Kullanıcı kayıt formuna
 * şifre yazdığında sunucu onu sessizce yok sayıyor, ekran ise "Kayıt alındı"
 * diyordu; kullanıcı var olmayan bir şifreyle giriş denemeye kalıyordu.
 */
describe("var olan e-posta ile kayıt", () => {
  it("sunucu, hesabın zaten var olduğunu çağırana bildirir", () => {
    const source = stripComments(read("src/lib/otp.functions.ts"));
    expect(source).toMatch(/return \{ ok: true as const, existing, cooldownSeconds/);
  });

  it("giriş ekranı şifrenin kaydedilmediğini söyler", () => {
    const source = stripComments(read("src/routes/auth.tsx"));
    expect(source).toContain("result.existing");
    expect(source).toContain("Yazdığınız şifre kaydedilmedi");
  });
});

describe("şifre belirleme yolu", () => {
  it("Hesabım sayfasından şifre sayfasına bağlantı var", () => {
    const source = stripComments(read("src/routes/hesabim.tsx"));
    expect(source).toContain('to="/sifre-sifirlama"');
    expect(source).toContain("Şifre belirle veya değiştir");
  });

  it("şifre sayfası açık oturumu da kabul eder (kurtarma bağlantısı şart değil)", () => {
    const source = stripComments(read("src/routes/sifre-sifirlama.tsx"));
    expect(source).toContain('event === "PASSWORD_RECOVERY"');
    expect(source).toMatch(/SIGNED_IN|INITIAL_SESSION/);
  });
});
